/**
 * app/src/types/financial_schema.ts
 * 内部实绩核算协议 (Internal Financial Schema Protocol V1.0)
 * 由财务专家 (王强) 定义，严禁硬编码
 */

export interface FactoryLaborRates {
  cut: number;      // 切断工位费率 (元/h)
  public: number;   // 公用工位费率 (元/h)
  assembly: number; // 装配工位费率 (元/h)
}

export interface FactoryMOHComponents {
  indirect_labor: number;           // 间接人工 (Variable)
  low_value_consumables: number;    // 低值易耗 (Variable)
  material_consumption: number;     // 机物料消耗 (Variable)
  factory_amortization: number;     // 厂房分摊 (Fixed)
  automation_amortization: number;  // 自动化/仓库分摊 (Fixed)
  other_overhead: number;           // 其他制费
}

export interface FactoryConfig {
  name: string;
  labor_rates: FactoryLaborRates;
  moh_components: FactoryMOHComponents;
  scrap_rate_param: number;             // 财务发布的损耗基准 (e.g. 0.005)
  efficiency_base: number;              // 运营效率基准 (e.g. 0.90)
  automation_utilization_factor: number; // 自动化设备利用率修正系数 (e.g. 1.0)
  lrp_volume_base?: number;             // 产能吸收基准产量 (LRP)
}

/** 
 * Gap Status 状态机定义 (由流程专家张滔滔定义)
 */
export type GapStatus = 
  | 'NORMAL'            // 成本受控
  | 'GAP_TRIGGERED'     // 成本超支触发
  | 'VAVE_OPTIMIZING'   // 技术VAVE优化中
  | 'FACTORY_PITTING'   // 工厂挖潜中
  | 'COMMERCIAL_DECISION' // 商务决策中
  | 'GAP_CLOSED';       // 异常已关闭

export interface FinancialBenchmark {
  version: string;
  effective_date: string;
  base_currency: string;
  audit_trace_id?: string; // 流程足迹 ID
  factories: {
    [factoryId: string]: FactoryConfig;
  };
}

export interface PricingContext {
  activeVersionId: string;
  benchmark: FinancialBenchmark;
  metalPrices: {
    copper: number;
    aluminum: number;
    timestamp: string;
  };
  simulation: {
    efficiency: number;     // 实时模拟效率 (出勤工时效率)
    annualVolume: number;   // 年度产量预测 (用于产能吸收模拟)
    utilizationFactor: number; // 实时模拟设备利用率 (e.g. 0.85)
    salesAdjustmentBuffer?: number; // 商务策略调节项 (元) — 用于异常签核对冲
  };
}
