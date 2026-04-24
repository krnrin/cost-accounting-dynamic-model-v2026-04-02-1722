/**
 * 包装方案与包装物流费用 Zustand Store
 * 管理 F09 包装方案 和 F10 包装物流费用
 */
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { db } from '@/data/db';
import type { PackagingSchemeRecord, PackagingLogisticsRecord, HarnessRecord } from '@/data/db';
import {
  type PackagingScheme,
  type PackagingLogisticsCost,
  type PackagingSchemeSummary,
  type PackagingLogisticsSummary,
  createEmptyPackagingScheme,
  createEmptyPackagingLogisticsCost,
  calculatePackagingLogisticsTotals,
} from '@/types/packaging';
import type { PackagingCost, FreightCost } from '@/types/harness';

interface PackagingState {
  // ─── 包装方案 (F09) ───
  /** 当前项目的包装方案记录 */
  schemeRecords: PackagingSchemeRecord[];
  /** 包装方案汇总统计 */
  schemeSummary: PackagingSchemeSummary | null;

  // ─── 包装物流费用 (F10) ───
  /** 当前项目的包装物流费用记录 */
  logisticsRecords: PackagingLogisticsRecord[];
  /** 包装物流费用汇总统计 */
  logisticsSummary: PackagingLogisticsSummary | null;

  // ─── 通用状态 ───
  /** 加载中标志 */
  loading: boolean;
  /** 当前项目ID */
  currentProjectId: string | null;

  // ─── 包装方案 Actions (F09) ───
  /** 加载项目的包装方案数据 */
  loadPackagingSchemes: (projectId: string) => Promise<void>;
  /** 保存/更新单条线束的包装方案 */
  savePackagingScheme: (projectId: string, scheme: PackagingScheme) => Promise<void>;
  /** 批量保存包装方案 */
  batchSavePackagingSchemes: (projectId: string, schemes: PackagingScheme[]) => Promise<void>;
  /** 删除单条线束的包装方案 */
  deletePackagingScheme: (projectId: string, harnessId: string) => Promise<void>;
  /** 从项目线束初始化包装方案（创建空记录） */
  initSchemesFromHarnesses: (projectId: string, harnesses: HarnessRecord[]) => Promise<void>;

  // ─── 包装物流费用 Actions (F10) ───
  /** 加载项目的包装物流费用数据 */
  loadPackagingLogistics: (projectId: string) => Promise<void>;
  /** 保存/更新单条线束的包装物流费用 */
  savePackagingLogistics: (projectId: string, cost: PackagingLogisticsCost) => Promise<void>;
  /** 批量保存包装物流费用 */
  batchSavePackagingLogistics: (projectId: string, costs: PackagingLogisticsCost[]) => Promise<void>;
  /** 删除单条线束的包装物流费用 */
  deletePackagingLogistics: (projectId: string, harnessId: string) => Promise<void>;
  /** 从项目线束初始化包装物流费用（创建空记录） */
  initLogisticsFromHarnesses: (projectId: string, harnesses: HarnessRecord[]) => Promise<void>;

  // ─── 通用 Actions ───
  /** 同时加载包装方案和物流费用 */
  loadAll: (projectId: string) => Promise<void>;
  /** 清空状态 */
  clear: () => void;
}

/** 计算包装方案汇总 */
function computeSchemeSummary(records: PackagingSchemeRecord[]): PackagingSchemeSummary {
  const boxTypeCounts: Record<string, number> = {
    '围板箱': 0,
    '塑料箱': 0,
    '纸箱': 0,
    '铁箱': 0,
  };

  for (const r of records) {
    const boxType = r.scheme.boxType;
    if (boxTypeCounts[boxType] !== undefined) {
      boxTypeCounts[boxType]++;
    }
  }

  return {
    totalHarnesses: records.length,
    recordedCount: records.filter(r => r.scheme.totalPerBox > 0).length,
    boxTypeCounts: boxTypeCounts as PackagingSchemeSummary['boxTypeCounts'],
  };
}

/** 计算包装物流费用汇总 */
function computeLogisticsSummary(
  records: PackagingLogisticsRecord[],
  harnesses: HarnessRecord[]
): PackagingLogisticsSummary {
  let totalInnerPackaging = 0;
  let totalOuterPackaging = 0;
  let totalFreight = 0;
  let totalExcessFreight = 0;
  let totalShortHaul = 0;
  let totalThirdPartyWarehouse = 0;
  let totalStorage = 0;

  for (const r of records) {
    totalInnerPackaging += r.cost.innerPackaging;
    totalOuterPackaging += r.cost.outerPackaging;
    totalFreight += r.cost.freight;
    totalExcessFreight += r.cost.excessFreight;
    totalShortHaul += r.cost.shortHaul;
    totalThirdPartyWarehouse += r.cost.thirdPartyWarehouse;
    totalStorage += r.cost.storage;
  }

  const totalPackaging = totalInnerPackaging + totalOuterPackaging;
  const totalLogistics = totalFreight + totalExcessFreight + totalShortHaul + totalThirdPartyWarehouse + totalStorage;
  const grandTotal = totalPackaging + totalLogistics;

  // 计算按装车比加权后的单套费用
  let weightedPerUnit = 0;
  const vehicleRatioMap: Record<string, number> = {};
  for (const h of harnesses) {
    vehicleRatioMap[h.harnessId] = h.input.vehicleRatio;
  }
  for (const r of records) {
    const ratio = vehicleRatioMap[r.harnessId] ?? 0;
    weightedPerUnit += r.cost.grandTotal * ratio;
  }

  return {
    totalHarnesses: harnesses.length,
    recordedCount: records.filter(r => r.cost.grandTotal > 0).length,
    totalInnerPackaging: Math.round(totalInnerPackaging * 10000) / 10000,
    totalOuterPackaging: Math.round(totalOuterPackaging * 10000) / 10000,
    totalFreight: Math.round(totalFreight * 10000) / 10000,
    totalExcessFreight: Math.round(totalExcessFreight * 10000) / 10000,
    totalShortHaul: Math.round(totalShortHaul * 10000) / 10000,
    totalThirdPartyWarehouse: Math.round(totalThirdPartyWarehouse * 10000) / 10000,
    totalStorage: Math.round(totalStorage * 10000) / 10000,
    totalPackaging: Math.round(totalPackaging * 10000) / 10000,
    totalLogistics: Math.round(totalLogistics * 10000) / 10000,
    grandTotal: Math.round(grandTotal * 10000) / 10000,
    weightedPerUnit: Math.round(weightedPerUnit * 10000) / 10000,
  };
}

export const usePackagingStore = create<PackagingState>()(
  devtools(
    (set, get) => ({
      // 初始状态
      schemeRecords: [],
      schemeSummary: null,
      logisticsRecords: [],
      logisticsSummary: null,
      loading: false,
      currentProjectId: null,

      // ─── 包装方案 Actions (F09) ───

      loadPackagingSchemes: async (projectId: string) => {
        set({ loading: true, currentProjectId: projectId });
        try {
          const schemeRecords = await db.packagingSchemes
            .where('projectId')
            .equals(projectId)
            .toArray();

          const schemeSummary = computeSchemeSummary(schemeRecords);

          set({ schemeRecords, schemeSummary, loading: false });
        } catch (err) {
          console.error('Failed to load packaging schemes:', err);
          set({ loading: false });
        }
      },

      savePackagingScheme: async (projectId: string, scheme: PackagingScheme) => {
        const now = new Date().toISOString();
        const record: PackagingSchemeRecord = {
          id: `${projectId}::${scheme.harnessId}`,
          projectId,
          harnessId: scheme.harnessId,
          scheme,
          updatedAt: now,
        };
        await db.packagingSchemes.put(record);
        await get().loadPackagingSchemes(projectId);
      },

      batchSavePackagingSchemes: async (projectId: string, schemes: PackagingScheme[]) => {
        const now = new Date().toISOString();
        const records: PackagingSchemeRecord[] = schemes.map(scheme => ({
          id: `${projectId}::${scheme.harnessId}`,
          projectId,
          harnessId: scheme.harnessId,
          scheme,
          updatedAt: now,
        }));
        await db.packagingSchemes.bulkPut(records);
        await get().loadPackagingSchemes(projectId);
      },

      deletePackagingScheme: async (projectId: string, harnessId: string) => {
        const id = `${projectId}::${harnessId}`;
        await db.packagingSchemes.delete(id);
        await get().loadPackagingSchemes(projectId);
      },

      initSchemesFromHarnesses: async (projectId: string, harnesses: HarnessRecord[]) => {
        const existingRecords = await db.packagingSchemes
          .where('projectId')
          .equals(projectId)
          .toArray();
        const existingIds = new Set(existingRecords.map(r => r.harnessId));

        const newSchemes: PackagingScheme[] = [];
        for (const h of harnesses) {
          if (!existingIds.has(h.harnessId)) {
            newSchemes.push(createEmptyPackagingScheme(h.harnessId, h.harnessName));
          }
        }

        if (newSchemes.length > 0) {
          await get().batchSavePackagingSchemes(projectId, newSchemes);
        }
      },

      // ─── 包装物流费用 Actions (F10) ───

      loadPackagingLogistics: async (projectId: string) => {
        set({ loading: true, currentProjectId: projectId });
        try {
          const logisticsRecords = await db.packagingLogistics
            .where('projectId')
            .equals(projectId)
            .toArray();

          // 加载线束数据用于计算加权汇总
          const harnesses = await db.harnesses
            .where('projectId')
            .equals(projectId)
            .toArray();

          const logisticsSummary = computeLogisticsSummary(logisticsRecords, harnesses);

          set({ logisticsRecords, logisticsSummary, loading: false });
        } catch (err) {
          console.error('Failed to load packaging logistics:', err);
          set({ loading: false });
        }
      },

      savePackagingLogistics: async (projectId: string, cost: PackagingLogisticsCost) => {
        const now = new Date().toISOString();
        // 计算小计
        const totals = calculatePackagingLogisticsTotals(cost);
        const fullCost: PackagingLogisticsCost = {
          ...cost,
          ...totals,
        };

        const record: PackagingLogisticsRecord = {
          id: `${projectId}::${cost.harnessId}`,
          projectId,
          harnessId: cost.harnessId,
          cost: fullCost,
          updatedAt: now,
        };
        await db.packagingLogistics.put(record);

        // 同步包装/运费到 harness.input
        await syncLogisticsToHarness(projectId, cost.harnessId, fullCost);

        await get().loadPackagingLogistics(projectId);
      },

      batchSavePackagingLogistics: async (projectId: string, costs: PackagingLogisticsCost[]) => {
        const now = new Date().toISOString();
        const records: PackagingLogisticsRecord[] = costs.map(cost => {
          const totals = calculatePackagingLogisticsTotals(cost);
          return {
            id: `${projectId}::${cost.harnessId}`,
            projectId,
            harnessId: cost.harnessId,
            cost: { ...cost, ...totals },
            updatedAt: now,
          };
        });
        await db.packagingLogistics.bulkPut(records);

        // 同步包装/运费到 harness.input
        for (let i = 0; i < costs.length; i++) {
          const costItem = costs[i]!;
          const recordItem = records[i]!;
          await syncLogisticsToHarness(projectId, costItem.harnessId, recordItem.cost);
        }

        await get().loadPackagingLogistics(projectId);
      },

      deletePackagingLogistics: async (projectId: string, harnessId: string) => {
        const id = `${projectId}::${harnessId}`;
        await db.packagingLogistics.delete(id);
        await get().loadPackagingLogistics(projectId);
      },

      initLogisticsFromHarnesses: async (projectId: string, harnesses: HarnessRecord[]) => {
        const existingRecords = await db.packagingLogistics
          .where('projectId')
          .equals(projectId)
          .toArray();
        const existingIds = new Set(existingRecords.map(r => r.harnessId));

        const newCosts: PackagingLogisticsCost[] = [];
        for (const h of harnesses) {
          if (!existingIds.has(h.harnessId)) {
            newCosts.push(createEmptyPackagingLogisticsCost(h.harnessId, h.harnessName));
          }
        }

        if (newCosts.length > 0) {
          await get().batchSavePackagingLogistics(projectId, newCosts);
        }
      },

      // ─── 通用 Actions ───

      loadAll: async (projectId: string) => {
        set({ loading: true, currentProjectId: projectId });
        try {
          // 并行加载包装方案和物流费用
          const [schemeRecords, logisticsRecords, harnesses] = await Promise.all([
            db.packagingSchemes.where('projectId').equals(projectId).toArray(),
            db.packagingLogistics.where('projectId').equals(projectId).toArray(),
            db.harnesses.where('projectId').equals(projectId).toArray(),
          ]);

          const schemeSummary = computeSchemeSummary(schemeRecords);
          const logisticsSummary = computeLogisticsSummary(logisticsRecords, harnesses);

          set({
            schemeRecords,
            schemeSummary,
            logisticsRecords,
            logisticsSummary,
            loading: false,
          });
        } catch (err) {
          console.error('Failed to load packaging data:', err);
          set({ loading: false });
        }
      },

      clear: () => {
        set({
          schemeRecords: [],
          schemeSummary: null,
          logisticsRecords: [],
          logisticsSummary: null,
          loading: false,
          currentProjectId: null,
        });
      },
    }),
    { name: 'packaging-store' }
  )
);

/**
 * 将包装物流费用同步到 harness.input.packaging / harness.input.freight
 * 打通断链#3：包装数据 → 成本计算引擎
 */
async function syncLogisticsToHarness(
  projectId: string,
  harnessId: string,
  cost: PackagingLogisticsCost
): Promise<void> {
  try {
    const harness = await db.harnesses
      .where('[projectId+harnessId]')
      .equals([projectId, harnessId])
      .first();
    if (harness && harness.input) {
      const packagingCost: PackagingCost = {
        innerBoxCost: cost.innerPackaging,
        outerBoxCost: cost.outerPackaging,
        palletCost: 0,
        trayDividerCost: 0,
        bubbleWrapCost: 0,
        labelCost: 0,
        subtotal: cost.totalPackaging ?? (cost.innerPackaging + cost.outerPackaging),
      };
      const freightCost: FreightCost = {
        freight: cost.freight,
        excessFreight: cost.excessFreight,
        shortHaul: cost.shortHaul,
        thirdPartyWarehouse: cost.thirdPartyWarehouse,
        storage: cost.storage,
        subtotal: cost.totalLogistics ?? (cost.freight + cost.excessFreight + cost.shortHaul + cost.thirdPartyWarehouse + cost.storage),
      };
      await db.harnesses.update(harness.id, {
        input: {
          ...harness.input,
          packaging: packagingCost,
          freight: freightCost,
        },
      });
    }
  } catch (err) {
    console.error(`Failed to sync logistics to harness ${harnessId}:`, err);
  }
}
