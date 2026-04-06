import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { FinancialBenchmark, PricingContext } from '@/types/financial_schema';

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

  // Actions
  setBenchmark: (benchmark: FinancialBenchmark) => void;
  setActiveVersion: (versionId: string) => void;
  updateMetalPrices: (copper: number, aluminum: number) => void;
  updateSimulation: (efficiency: number, annualVolume: number, utilizationFactor: number, salesAdjustmentBuffer?: number) => void;
  
  // Computed
  getPricingContext: () => PricingContext | null;
  getProcessStatus: () => { status: 'GREEN' | 'YELLOW' | 'RED'; messages: string[] };
}

export const usePricingStore = create<PricingState>()(
  devtools(
    persist(
      (set, get) => ({
        benchmark: null,
        activeVersionId: null,
        metalPrices: {
          copper: 65000, // Default copper price
          aluminum: 18000, // Default aluminum price
          timestamp: new Date().toISOString(),
        },
        simulation: {
          efficiency: 0.90, // Default 90%
          annualVolume: 100000, // Default 100k
          utilizationFactor: 0.85, // Default 85%
          salesAdjustmentBuffer: 0, // Default 0
        },

        setBenchmark: (benchmark) => set({ benchmark, activeVersionId: benchmark.version || 'v1' }),
        setActiveVersion: (activeVersionId) => set({ activeVersionId }),
        updateMetalPrices: (copper, aluminum) => set({ 
          metalPrices: { copper, aluminum, timestamp: new Date().toISOString() } 
        }),
        updateSimulation: (efficiency, annualVolume, utilizationFactor, salesAdjustmentBuffer) => set({ 
          simulation: { 
            efficiency, 
            annualVolume, 
            utilizationFactor,
            salesAdjustmentBuffer: salesAdjustmentBuffer !== undefined ? salesAdjustmentBuffer : get().simulation.salesAdjustmentBuffer 
          } 
        }),

        getPricingContext: () => {
          const state = get();
          const { benchmark, activeVersionId, metalPrices, simulation } = state;
          if (!benchmark) return null;
          return {
            activeVersionId: activeVersionId || 'v1',
            benchmark: benchmark,
            metalPrices,
            simulation,
          };
        },

        getProcessStatus: () => {
          const { benchmark } = get();
          const messages: string[] = [];
          if (!benchmark) return { status: 'RED', messages: ['未加载财务基准数据'] };

          const factories = Object.values(benchmark.factories);
          
          // 1. Check for 7 factories (as required by PRD)
          if (factories.length < 7) {
            messages.push(`基地数据不全: 仅包含 ${factories.length}/7 个基地`);
          }

          // 2. Check 0.5% scrap variance (Warning, not blocking)
          const benchmarkScrap = 0.005;
          const deviatedFactories = Object.entries(benchmark.factories)
            .filter(([_, f]) => f.scrap_rate_param !== benchmarkScrap)
            .map(([id, f]) => {
              const diff = ((f.scrap_rate_param - benchmarkScrap) * 100).toFixed(2);
              return `${id}(${(f.scrap_rate_param * 100).toFixed(2)}%, 偏差 ${diff}pt)`;
            });
          
          if (deviatedFactories.length > 0) {
            messages.push(`损耗实绩偏差: ${deviatedFactories.join(', ')}`);
          }

          if (messages.length > 0) {
            return { status: 'YELLOW', messages };
          }

          return { status: 'GREEN', messages: ['财务基准合规，流程就绪'] };
        },
      }),
      { name: 'pricing-store' }
    ),
    { name: 'pricing-store' }
  )
);
