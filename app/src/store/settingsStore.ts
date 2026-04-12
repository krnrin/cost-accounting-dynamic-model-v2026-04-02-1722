import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { CostRates, MetalPrices, CostStructureSchema, FactoryConfig, AllocationConfig, BomClassificationRule, Level1Coefficients } from '@/types';
import { DEFAULT_COST_STRUCTURE, DEFAULT_CLASSIFICATION_RULES } from '@/engine/harness_costing';
import { DEFAULT_ALLOCATION } from '@/engine/allocation';
import { LEVEL1_COEFFICIENTS } from '@/engine/precision';
// REFERENCE_FACTORIES available from '@/engine/factory_comparison' for UI presets

interface SettingsState {
  defaultCostRates: CostRates;
  defaultMetalPrices: MetalPrices;
  displayCurrency: string;
  decimalPlaces: number;
  defaultTemplateType: 'geely' | 'byd' | 'generic';
  defaultAnnualDropRate: number;
  alertThresholds: {
    copperPercent: number;
    aluminumPercent: number;
    enabled: boolean;
  };
  themeMode: 'light' | 'dark' | 'system';

  // ── P1: 高级配置 ──
  /** 成本结构 Schema */
  costStructure: CostStructureSchema;
  /** 是否启用 Schema 驱动模式 */
  useSchemaEngine: boolean;
  /** 多工厂配置 */
  factories: FactoryConfig[];
  /** 间接费用分摊配置 */
  allocationConfig: AllocationConfig;
  /** BOM 分类规则 */
  bomClassificationRules: BomClassificationRule[];
  /** Level 1 系数近似参数 */
  level1Coefficients: Level1Coefficients;
  
  // ── Actions ──
  updateCostRates: (rates: Partial<CostRates>) => void;
  updateMetalPrices: (prices: Partial<MetalPrices>) => void;
  setDisplayCurrency: (currency: string) => void;
  setDecimalPlaces: (places: number) => void;
  setDefaultTemplateType: (type: 'geely' | 'byd' | 'generic') => void;
  setDefaultAnnualDropRate: (rate: number) => void;
  updateAlertThresholds: (patch: Partial<SettingsState['alertThresholds']>) => void;
  setThemeMode: (mode: 'light' | 'dark' | 'system') => void;
  resetCostRates: () => void;
  
  // P1 Actions
  setCostStructure: (schema: CostStructureSchema) => void;
  setUseSchemaEngine: (use: boolean) => void;
  setFactories: (factories: FactoryConfig[]) => void;
  addFactory: (factory: FactoryConfig) => void;
  updateFactory: (factoryId: string, patch: Partial<FactoryConfig>) => void;
  removeFactory: (factoryId: string) => void;
  setAllocationConfig: (config: AllocationConfig) => void;
  updateAllocationDriver: (key: keyof AllocationConfig, driver: AllocationConfig[keyof AllocationConfig]) => void;
  setBomClassificationRules: (rules: BomClassificationRule[]) => void;
  setLevel1Coefficients: (coefficients: Level1Coefficients) => void;
  resetLevel1Coefficients: () => void;
  resetAdvancedConfig: () => void;
}

const DEFAULT_RATES: CostRates = {
  laborRate: 35,
  mfgRate: 46.69,
  wasteRate: 0.01,
  mgmtRate: 0.06,
  profitRate: 0.056627,
};

export const useSettingsStore = create<SettingsState>()(
  devtools(
    persist(
      (set) => ({
        defaultCostRates: { ...DEFAULT_RATES },
        defaultMetalPrices: {
          copper: 72800,
          aluminum: 20500,
        },
        displayCurrency: 'CNY',
        decimalPlaces: 2,
        defaultTemplateType: 'geely',
        defaultAnnualDropRate: 0.03,
        alertThresholds: {
          copperPercent: 5,
          aluminumPercent: 5,
          enabled: true,
        },
        themeMode: 'system',
        
        // P1 defaults
        costStructure: { ...DEFAULT_COST_STRUCTURE },
        useSchemaEngine: false,
        factories: [],
        allocationConfig: { ...DEFAULT_ALLOCATION },
        bomClassificationRules: [...DEFAULT_CLASSIFICATION_RULES],
        level1Coefficients: { ...LEVEL1_COEFFICIENTS },
        
        updateCostRates: (rates) => 
          set((state) => ({ 
            defaultCostRates: { ...state.defaultCostRates, ...rates } 
          })),
        updateMetalPrices: (prices) => 
          set((state) => ({ 
            defaultMetalPrices: { ...state.defaultMetalPrices, ...prices } 
          })),
        setDisplayCurrency: (currency) => set({ displayCurrency: currency }),
        setDecimalPlaces: (places) => set({ decimalPlaces: places }),
        setDefaultTemplateType: (type) => set({ defaultTemplateType: type }),
        setDefaultAnnualDropRate: (rate) => set({ defaultAnnualDropRate: rate }),
        updateAlertThresholds: (patch) =>
          set((state) => ({
            alertThresholds: { ...state.alertThresholds, ...patch }
          })),
        setThemeMode: (mode) => set({ themeMode: mode }),
        resetCostRates: () => set({ defaultCostRates: { ...DEFAULT_RATES } }),
        
        // P1 Actions
        setCostStructure: (schema) => set({ costStructure: schema }),
        setUseSchemaEngine: (use) => set({ useSchemaEngine: use }),
        setFactories: (factories) => set({ factories }),
        addFactory: (factory) => set((state) => ({
          factories: [...state.factories, factory]
        })),
        updateFactory: (factoryId, patch) => set((state) => ({
          factories: state.factories.map(f => 
            f.factoryId === factoryId ? { ...f, ...patch } : f
          )
        })),
        removeFactory: (factoryId) => set((state) => ({
          factories: state.factories.filter(f => f.factoryId !== factoryId)
        })),
        setAllocationConfig: (config) => set({ allocationConfig: config }),
        updateAllocationDriver: (key, driver) => set((state) => ({
          allocationConfig: { ...state.allocationConfig, [key]: driver }
        })),
        setBomClassificationRules: (rules) => set({ bomClassificationRules: rules }),
        setLevel1Coefficients: (coefficients) => set({ level1Coefficients: coefficients }),
        resetLevel1Coefficients: () => set({ level1Coefficients: { ...LEVEL1_COEFFICIENTS } }),
        resetAdvancedConfig: () => set({
          costStructure: { ...DEFAULT_COST_STRUCTURE },
          useSchemaEngine: false,
          factories: [],
          allocationConfig: { ...DEFAULT_ALLOCATION },
          bomClassificationRules: [...DEFAULT_CLASSIFICATION_RULES],
          level1Coefficients: { ...LEVEL1_COEFFICIENTS },
        }),
      }),
      {
        name: 'settings-storage',
      }
    ),
    { name: 'settings-store' }
  )
);
