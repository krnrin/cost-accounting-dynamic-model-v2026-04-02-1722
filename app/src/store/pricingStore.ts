import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { FinancialBenchmark, PricingContext } from '@/types/financial_schema';
import type {
  AuxiliaryPartPayload,
  AuxiliaryPartRecord,
  ConnectorPricingPayload,
  ConnectorPricingRecord,
  DevPartMoldPayload,
  DevPartPricingPayload,
  DevPartPricingRecord,
  PriceDiscrepancyRecord,
  WirePricingPayload,
  WirePricingRecord,
} from '@/types/pricing';
import {
  addDevPartMold as addDevPartMoldApi,
  createAuxiliaryPricing,
  createConnectorPricing,
  createDevPartPricing,
  createPriceDiscrepancy,
  createWirePricing,
  fetchAuxiliaryPricing,
  fetchConnectorPricing,
  fetchDevPartPricing,
  fetchPriceDiscrepancies,
  fetchWirePricing,
  recalculateWirePricing,
  updateAuxiliaryPricing,
  updateConnectorPricing,
  updateDevPartPricing,
  updatePriceDiscrepancy,
  updateWirePricing,
} from '@/lib/pricingApi';
import {
  calculateDevPartLifecycleCost,
  calculateDevPartPriceWithAmortization,
  calculateWirePrice,
  checkConnectorPriceDiscrepancy,
  getConnectorFinalPrice,
  type MetalPrices,
} from '@/engine/pricing_engine';

type ProcessStatus = { status: 'GREEN' | 'YELLOW' | 'RED'; messages: string[] };

interface PricingState {
  benchmark: FinancialBenchmark | null;
  activeVersionId: string | null;
  metalPrices: {
    copper: number;
    aluminum: number;
    timestamp: string;
  };
  simulation: {
    efficiency: number;
    annualVolume: number;
    utilizationFactor: number;
    salesAdjustmentBuffer: number;
  };
  connectorPricing: Record<string, ConnectorPricingRecord>;
  wirePricing: Record<string, WirePricingRecord>;
  devPartPricing: Record<string, DevPartPricingRecord>;
  auxiliaryPricing: Record<string, AuxiliaryPartRecord>;
  priceDiscrepancies: PriceDiscrepancyRecord[];
  currentProjectId: string | null;
  currentScenarioId: string | null;
  isLoading: boolean;
  error: string | null;

  setBenchmark: (benchmark: FinancialBenchmark) => void;
  setActiveVersion: (versionId: string) => void;
  updateMetalPrices: (copper: number, aluminum: number) => void;
  updateSimulation: (efficiency: number, annualVolume: number, utilizationFactor: number, salesAdjustmentBuffer?: number) => void;
  getPricingContext: () => PricingContext | null;
  getProcessStatus: () => ProcessStatus;

  loadPricingData: (projectId: string, scenarioId?: string) => Promise<void>;

  addConnectorPricing: (payload: ConnectorPricingPayload) => Promise<void>;
  updateConnectorPrice: (id: string, updates: Partial<ConnectorPricingPayload>) => Promise<void>;
  checkConnectorDiscrepancies: (scenarioId: string, harnessId: string, bomItems: Array<{ partNo: string; partName: string }>) => Promise<void>;
  getConnectorPrice: (partNo: string) => number;

  addWirePricing: (payload: WirePricingPayload) => Promise<void>;
  updateWirePricingRecord: (id: string, payload: Partial<WirePricingPayload>) => Promise<void>;
  updateWireWithMetalPrice: (partNo: string, metalPrice: MetalPrices) => Promise<void>;
  batchUpdateWirePrices: (metalPrice: MetalPrices) => Promise<void>;

  addDevPartPricing: (payload: DevPartPricingPayload) => Promise<void>;
  addDevPartMold: (partNo: string, payload: DevPartMoldPayload) => Promise<void>;
  updateDevPartAmortization: (partNo: string, amortizationQty: number, unitPriceAfterAmortization: number) => Promise<void>;
  calculateDevPartPrice: (partNo: string, lifecycleTotalQty: number) => { unitPrice: number; breakdown: unknown } | null;

  addAuxiliaryPricing: (payload: AuxiliaryPartPayload) => Promise<void>;
  updateAuxiliaryPrice: (partNo: string, unitPrice: number, supplier: string) => Promise<void>;

  resolveDiscrepancy: (id: string, resolution: { type: 'harness_price_up' | 'supplier_price_down' | 'accepted_loss'; note: string }) => Promise<void>;
  assignDiscrepancy: (id: string, assignedTo: string) => Promise<void>;
  getOpenDiscrepancies: () => PriceDiscrepancyRecord[];

  reset: () => void;
}

const initialState = {
  benchmark: null,
  activeVersionId: null,
  metalPrices: {
    copper: 65000,
    aluminum: 18000,
    timestamp: new Date().toISOString(),
  },
  simulation: {
    efficiency: 0.9,
    annualVolume: 100000,
    utilizationFactor: 0.85,
    salesAdjustmentBuffer: 0,
  },
  connectorPricing: {} as Record<string, ConnectorPricingRecord>,
  wirePricing: {} as Record<string, WirePricingRecord>,
  devPartPricing: {} as Record<string, DevPartPricingRecord>,
  auxiliaryPricing: {} as Record<string, AuxiliaryPartRecord>,
  priceDiscrepancies: [] as PriceDiscrepancyRecord[],
  currentProjectId: null as string | null,
  currentScenarioId: null as string | null,
  isLoading: false,
  error: null as string | null,
};

function toPartNoMap<T extends { partNo: string }>(rows: T[]): Record<string, T> {
  return Object.fromEntries(rows.map((row) => [row.partNo, row]));
}

function updateMapById<T extends { id: string; partNo: string }>(
  source: Record<string, T>,
  id: string,
  next: T
): Record<string, T> {
  const mapped = { ...source };
  for (const partNo in mapped) {
    if (mapped[partNo]?.id === id) {
      delete mapped[partNo];
      break;
    }
  }
  mapped[next.partNo] = next;
  return mapped;
}

export const usePricingStore = create<PricingState>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        setBenchmark: (benchmark) => set({
          benchmark,
          activeVersionId: benchmark.version || 'v1',
        }),

        setActiveVersion: (activeVersionId) => set({ activeVersionId }),

        updateMetalPrices: (copper, aluminum) => set({
          metalPrices: {
            copper,
            aluminum,
            timestamp: new Date().toISOString(),
          },
        }),

        updateSimulation: (efficiency, annualVolume, utilizationFactor, salesAdjustmentBuffer) => set((state) => ({
          simulation: {
            efficiency,
            annualVolume,
            utilizationFactor,
            salesAdjustmentBuffer: salesAdjustmentBuffer ?? state.simulation.salesAdjustmentBuffer,
          },
        })),

        getPricingContext: () => {
          const state = get();
          if (!state.benchmark) return null;
          return {
            activeVersionId: state.activeVersionId || 'v1',
            benchmark: state.benchmark,
            metalPrices: state.metalPrices,
            simulation: state.simulation,
          };
        },

        getProcessStatus: () => {
          const { benchmark } = get();
          const messages: string[] = [];
          if (!benchmark) return { status: 'RED', messages: ['未加载财务基准数据'] };

          const factories = Object.values(benchmark.factories);
          if (factories.length < 7) {
            messages.push(`基地数据不全: 仅包含 ${factories.length}/7 个基地`);
          }

          const benchmarkScrap = 0.005;
          const deviatedFactories = Object.entries(benchmark.factories)
            .filter(([, row]) => row.scrap_rate_param !== benchmarkScrap)
            .map(([factoryId, row]) => {
              const diff = ((row.scrap_rate_param - benchmarkScrap) * 100).toFixed(2);
              return `${factoryId}(${(row.scrap_rate_param * 100).toFixed(2)}%, 偏差 ${diff}pt)`;
            });

          if (deviatedFactories.length > 0) {
            messages.push(`损耗实绩偏差: ${deviatedFactories.join(', ')}`);
          }

          if (messages.length > 0) return { status: 'YELLOW', messages };
          return { status: 'GREEN', messages: ['财务基准合规，流程就绪'] };
        },

        loadPricingData: async (projectId, scenarioId) => {
          set({ isLoading: true, error: null });
          try {
            const [connectors, wires, devParts, auxiliary, discrepancies] = await Promise.all([
              fetchConnectorPricing(projectId),
              fetchWirePricing(projectId),
              fetchDevPartPricing(projectId),
              fetchAuxiliaryPricing(projectId),
              scenarioId ? fetchPriceDiscrepancies(projectId, scenarioId) : Promise.resolve([]),
            ]);
            set({
              connectorPricing: toPartNoMap(connectors),
              wirePricing: toPartNoMap(wires),
              devPartPricing: toPartNoMap(devParts),
              auxiliaryPricing: toPartNoMap(auxiliary),
              priceDiscrepancies: discrepancies,
              currentProjectId: projectId,
              currentScenarioId: scenarioId ?? null,
              isLoading: false,
              error: null,
            });
          } catch (error) {
            set({
              isLoading: false,
              error: error instanceof Error ? error.message : '价格数据加载失败',
            });
          }
        },

        addConnectorPricing: async (payload) => {
          const { currentProjectId, connectorPricing } = get();
          if (!currentProjectId) {
            throw new Error('未选择项目');
          }
          const created = await createConnectorPricing(currentProjectId, payload);
          set({ connectorPricing: { ...connectorPricing, [created.partNo]: created } });
        },

        updateConnectorPrice: async (id, updates) => {
          const { currentProjectId, connectorPricing } = get();
          if (!currentProjectId) {
            throw new Error('未选择项目');
          }
          const updated = await updateConnectorPricing(currentProjectId, id, updates);
          set({ connectorPricing: updateMapById(connectorPricing, id, updated) });
        },

        checkConnectorDiscrepancies: async (scenarioId, harnessId, bomItems) => {
          const { currentProjectId, connectorPricing, priceDiscrepancies } = get();
          if (!currentProjectId) return;

          const createdRows = await Promise.all(
            bomItems.map(async (item) => {
              const connector = connectorPricing[item.partNo];
              if (!connector) return null;
              const discrepancy = checkConnectorPriceDiscrepancy(connector);
              if (!discrepancy) return null;
              return createPriceDiscrepancy(currentProjectId, scenarioId, {
                harnessId,
                partNo: item.partNo,
                partName: item.partName || connector.partName,
                partCategory: 'connector',
                referencePrice: discrepancy.referencePrice,
                actualPrice: discrepancy.actualPrice,
                status: discrepancy.status,
              });
            })
          );
          const validRows = createdRows.filter((row): row is PriceDiscrepancyRecord => Boolean(row));
          if (validRows.length > 0) {
            set({ priceDiscrepancies: [...priceDiscrepancies, ...validRows] });
          }
        },

        getConnectorPrice: (partNo) => {
          const row = get().connectorPricing[partNo];
          if (!row) return 0;
          return getConnectorFinalPrice(row);
        },

        addWirePricing: async (payload) => {
          const { currentProjectId, wirePricing } = get();
          if (!currentProjectId) {
            throw new Error('未选择项目');
          }
          const created = await createWirePricing(currentProjectId, payload);
          set({ wirePricing: { ...wirePricing, [created.partNo]: created } });
        },

        updateWirePricingRecord: async (id, payload) => {
          const { currentProjectId, wirePricing } = get();
          if (!currentProjectId) {
            throw new Error('未选择项目');
          }
          const updated = await updateWirePricing(currentProjectId, id, payload);
          set({ wirePricing: updateMapById(wirePricing, id, updated) });
        },

        updateWireWithMetalPrice: async (partNo, metalPrice) => {
          const { currentProjectId, wirePricing } = get();
          if (!currentProjectId) {
            throw new Error('未选择项目');
          }
          const wire = wirePricing[partNo];
          if (!wire) return;
          const updated = await updateWirePricing(currentProjectId, wire.id, {
            copperBasePrice: metalPrice.copper,
            aluminumBasePrice: metalPrice.aluminum,
            copperWeightG: wire.copperWeightG,
            aluminumWeightG: wire.aluminumWeightG,
            nonMetalCost: wire.nonMetalCost,
            processingFee: wire.processingFee,
          });
          set({ wirePricing: updateMapById(wirePricing, wire.id, updated) });
        },

        batchUpdateWirePrices: async (metalPrice) => {
          const { currentProjectId } = get();
          if (!currentProjectId) {
            throw new Error('未选择项目');
          }
          const rows = await recalculateWirePricing(currentProjectId, {
            copperBasePrice: metalPrice.copper,
            aluminumBasePrice: metalPrice.aluminum,
          });
          set({
            wirePricing: toPartNoMap(rows),
            metalPrices: {
              copper: metalPrice.copper,
              aluminum: metalPrice.aluminum,
              timestamp: new Date().toISOString(),
            },
          });
        },

        addDevPartPricing: async (payload) => {
          const { currentProjectId, devPartPricing } = get();
          if (!currentProjectId) {
            throw new Error('未选择项目');
          }
          const created = await createDevPartPricing(currentProjectId, payload);
          set({ devPartPricing: { ...devPartPricing, [created.partNo]: created } });
        },

        addDevPartMold: async (partNo, payload) => {
          const { currentProjectId, devPartPricing } = get();
          if (!currentProjectId) {
            throw new Error('未选择项目');
          }
          const record = devPartPricing[partNo];
          if (!record) return;
          const updated = await addDevPartMoldApi(currentProjectId, record.id, payload);
          set({ devPartPricing: { ...devPartPricing, [updated.partNo]: updated } });
        },

        updateDevPartAmortization: async (partNo, amortizationQty, unitPriceAfterAmortization) => {
          const { currentProjectId, devPartPricing } = get();
          if (!currentProjectId) {
            throw new Error('未选择项目');
          }
          const record = devPartPricing[partNo];
          if (!record) return;
          const updated = await updateDevPartPricing(currentProjectId, record.id, {
            amortizationQty,
            unitPriceAfterAmortization,
          });
          set({ devPartPricing: { ...devPartPricing, [updated.partNo]: updated } });
        },

        calculateDevPartPrice: (partNo, lifecycleTotalQty) => {
          const record = get().devPartPricing[partNo];
          if (!record) return null;
          const result = calculateDevPartLifecycleCost(record, lifecycleTotalQty);
          return {
            unitPrice: result.avgUnitCost,
            breakdown: result.breakdown,
          };
        },

        addAuxiliaryPricing: async (payload) => {
          const { currentProjectId, auxiliaryPricing } = get();
          if (!currentProjectId) {
            throw new Error('未选择项目');
          }
          const created = await createAuxiliaryPricing(currentProjectId, payload);
          set({ auxiliaryPricing: { ...auxiliaryPricing, [created.partNo]: created } });
        },

        updateAuxiliaryPrice: async (partNo, unitPrice, supplier) => {
          const { currentProjectId, auxiliaryPricing } = get();
          if (!currentProjectId) {
            throw new Error('未选择项目');
          }
          const existing = auxiliaryPricing[partNo];
          if (existing) {
            const updated = await updateAuxiliaryPricing(currentProjectId, existing.id, {
              partNo,
              partName: existing.partName,
              supplier: supplier || existing.supplier,
              unitPrice,
            });
            set({ auxiliaryPricing: { ...auxiliaryPricing, [updated.partNo]: updated } });
            return;
          }
          const created = await createAuxiliaryPricing(currentProjectId, {
            partNo,
            partName: partNo,
            supplier,
            unitPrice,
          });
          set({ auxiliaryPricing: { ...auxiliaryPricing, [created.partNo]: created } });
        },

        resolveDiscrepancy: async (id, resolution) => {
          const { currentProjectId, currentScenarioId, priceDiscrepancies } = get();
          const current = priceDiscrepancies.find((row) => row.id === id);
          if (!current) return;

          if (currentProjectId && currentScenarioId) {
            const updated = await updatePriceDiscrepancy(currentProjectId, currentScenarioId, id, {
              status: 'resolved',
              resolutionType: resolution.type,
              resolutionNote: resolution.note,
            });
            set({
              priceDiscrepancies: priceDiscrepancies.map((row) => (row.id === id ? updated : row)),
            });
            return;
          }

          set({
            priceDiscrepancies: priceDiscrepancies.map((row) => row.id === id ? {
              ...row,
              status: 'resolved',
              resolutionType: resolution.type,
              resolutionNote: resolution.note,
              updatedAt: new Date().toISOString(),
            } : row),
          });
        },

        assignDiscrepancy: async (id, assignedTo) => {
          const { currentProjectId, currentScenarioId, priceDiscrepancies } = get();
          if (currentProjectId && currentScenarioId) {
            const updated = await updatePriceDiscrepancy(currentProjectId, currentScenarioId, id, {
              assignedTo,
            });
            set({
              priceDiscrepancies: priceDiscrepancies.map((row) => row.id === id ? updated : row),
            });
            return;
          }
          set({
            priceDiscrepancies: priceDiscrepancies.map((row) => row.id === id ? {
              ...row,
              assignedTo,
              updatedAt: new Date().toISOString(),
            } : row),
          });
        },

        getOpenDiscrepancies: () => get().priceDiscrepancies.filter((row) => row.status === 'open' || row.status === 'escalated'),

        reset: () => set({
          ...initialState,
        }),
      }),
      {
        name: 'pricing-store',
        partialize: (state) => ({
          benchmark: state.benchmark,
          activeVersionId: state.activeVersionId,
          metalPrices: state.metalPrices,
          simulation: state.simulation,
          currentProjectId: state.currentProjectId,
          currentScenarioId: state.currentScenarioId,
        }),
      }
    ),
    { name: 'pricing-store' }
  )
);

export function calculateDraftWirePrice(payload: WirePricingPayload): number {
  return calculateWirePrice(payload, {
    copper: payload.copperBasePrice,
    aluminum: payload.aluminumBasePrice,
  });
}

export function calculateDraftDevPartAmortizedPrice(payload: DevPartPricingPayload, moldTotalCost = 0): number {
  return calculateDevPartPriceWithAmortization(
    payload.unitPriceAfterAmortization,
    moldTotalCost,
    payload.amortizationQty
  );
}
