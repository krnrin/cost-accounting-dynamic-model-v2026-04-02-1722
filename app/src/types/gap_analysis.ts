/**
 * app/src/types/gap_analysis.ts
 * 报价 vs 实绩 Gap 分析类型定义
 *
 * 核心设计：
 * - 客户报价侧使用销售输入的「客户口径」铜铝价
 * - 内部实绩侧支持切换：财务基准价 / 上期所现货 / SMM现货
 * - 材料 Gap 拆解为「价格效应」和「用量效应」
 */

import type { BomItem, WireItem, HarnessResult, InternalHarnessResult, MaterialBreakdown } from './harness';
import type { GapStatus } from './financial_schema';

// ════════════════════════════════════════════
// 金属价格体系
// ════════════════════════════════════════════

/** 内部金属价格源类型 */
export type InternalMetalSource =
  | 'benchmark'    // 财务发布基准价 (来自 FinancialBenchmark)
  | 'spot_shfe'    // 上海期货交易所现货
  | 'spot_smm'     // 上海有色金属网现货
  | 'manual';      // 手动录入 (Phase 1 通用)

/** 单侧金属价格 */
export interface MetalPriceEntry {
  copper: number;           // 元/吨
  aluminum: number;         // 元/吨
  source: InternalMetalSource | 'sales_input' | 'contract';
  label: string;            // 显示标签: "客户口径" / "财务基准" / "SMM现货" 等
  effectiveDate: string;    // 生效日期 ISO
  fetchedAt?: string;       // 取价时间 ISO (现货类)
}

/** 双金属价格输入 (报价侧 + 实绩侧) */
export interface DualMetalPrices {
  /** 客户口径 (销售输入) */
  customer: MetalPriceEntry;
  /** 内部实绩口径 (可切换源) */
  internal: MetalPriceEntry;
  /** 铜价价差 = customer.copper - internal.copper (正值=报价高于实绩) */
  copperSpread: number;
  /** 铝价价差 */
  aluminumSpread: number;
}

/** 内部金属价格配置 (pricingStore 扩展用) */
export interface InternalMetalConfig {
  /** 当前选择的价格源 */
  activeSource: InternalMetalSource;
  /** 各源的价格数据 */
  sources: {
    benchmark: {
      copper: number;
      aluminum: number;
      version: string;
      effectiveDate: string;
    };
    spot: {
      copper: number;
      aluminum: number;
      provider: 'shfe' | 'smm' | 'manual';
      fetchedAt: string;
      /** 是否已过期 (超过设定阈值未更新) */
      isStale: boolean;
      /** 过期阈值 (小时) */
      staleThresholdHours: number;
    };
  };
}

// ════════════════════════════════════════════
// MetalPriceProvider 接口 (可扩展)
// ════════════════════════════════════════════

/** 金属价格提供者接口 */
export interface MetalPriceProvider {
  name: string;
  source: InternalMetalSource;
  /** 获取最新价格 */
  fetchPrices(): Promise<MetalPriceFetchResult>;
  /** 是否支持自动获取 (false = 手动录入) */
  isAutomatic: boolean;
}

/** 价格获取结果 */
export interface MetalPriceFetchResult {
  copper: number;
  aluminum: number;
  timestamp: string;
  source: InternalMetalSource;
  /** 获取是否成功 */
  success: boolean;
  /** 错误信息 */
  error?: string;
}

// ════════════════════════════════════════════
// Gap 分析核心类型
// ════════════════════════════════════════════

/** 瀑布图单项 */
export interface GapWaterfallItem {
  key: string;
  label: string;
  /** 正值=报价高于实绩（有利润空间），负值=实绩高于报价（亏损） */
  value: number;
  category: 'metal_price' | 'material' | 'processing' | 'overhead' | 'margin' | 'logistics';
}

/** Gap 分析结果 */
export interface GapAnalysis {
  // ── 总价级 ──
  /** 总 Gap = deliveredPrice - internalCost */
  totalGap: number;
  /** 总 Gap 率 = totalGap / internalCost */
  totalGapRate: number;

  // ── 材料层拆解 ──
  /** 材料总 Gap = 报价材料成本 - 实绩材料成本 */
  materialGap: number;
  /** 铜价效应 = Σ(copperWeight × (客户铜价 - 实绩铜价) / 1000) */
  copperPriceEffect: number;
  /** 铝价效应 = Σ(aluminumWeight × (客户铝价 - 实绩铝价) / 1000) */
  aluminumPriceEffect: number;
  /** 总金属价格效应 = copperPriceEffect + aluminumPriceEffect */
  metalPriceEffect: number;
  /** 用量/BOM差异效应 = materialGap - metalPriceEffect */
  volumeEffect: number;

  // ── 加工层 ──
  /** 损耗差异 = 报价wasteCost - 实绩materialWaste */
  wasteGap: number;
  /** 人工差异 = 报价directLabor - 实绩directLabor */
  laborGap: number;
  /** 制造费差异 = 报价manufacturing - 实绩mfgOverheadTotal */
  mfgGap: number;
  /** 加工费差异合计 = laborGap + mfgGap */
  processingGap: number;

  // ── 报价独有层 ──
  /** 管理费 (报价侧独有) */
  mgmtFee: number;
  /** 利润 (报价侧独有) */
  profit: number;
  /** 毛利空间 = 管理费 + 利润 */
  grossMarginDesigned: number;
  /** 包装运输差异 */
  logisticsGap: number;

  // ── 瀑布图 ──
  waterfall: GapWaterfallItem[];

  // ── 风险判定 ──
  riskLevel: 'safe' | 'watch' | 'danger';
  riskReason?: string;

  // ── 校验 ──
  /** 瀑布图各项之和是否等于 totalGap (允许 0.01 误差) */
  waterfallBalanced: boolean;
}

/** Gap 对齐快照 */
export interface GapAlignedSnapshot {
  id: string;
  scenarioId: string;
  projectId: string;
  createdAt: string;
  /** 触发来源 */
  trigger: 'freeze' | 'manual' | 'periodic';

  /** 共享 BOM 输入 (两侧用同一份 BOM 结构) */
  sharedBom: {
    bom: (BomItem | WireItem)[];
    processHours: number;
  };

  /** 金属价格 (双口径) */
  metalPrices: DualMetalPrices;

  /** 客户报价侧 */
  quote: {
    rates: {
      wasteRate: number;
      mgmtRate: number;
      profitRate: number;
      laborRate: number;
      mfgRate: number;
    };
    result: HarnessResult;
  };

  /** 内部实绩侧 */
  internal: {
    factoryId: string;
    rates: {
      assemblyLaborRate: number;
      scrapRate: number;
      mohComponents: Record<string, number>;
    };
    result: InternalHarnessResult;
  };

  /** 计算出的 Gap 分析 */
  gap: GapAnalysis;
}

/** 项目级 Gap 汇总 */
export interface ProjectGapSummary {
  snapshots: GapAlignedSnapshot[];
  /** 加权总 Gap = Σ(totalGap × vehicleRatio) */
  weightedTotalGap: number;
  /** 加权毛利率 */
  weightedGrossMarginRate: number;
  /** 各成本层加权 Gap (瀑布图) */
  weightedWaterfall: GapWaterfallItem[];
  /** 亏损线束列表 */
  dangerHarnesses: Array<{
    harnessId: string;
    harnessName: string;
    gap: number;
    gapRate: number;
  }>;
  /** 项目整体风险 */
  projectRiskLevel: 'safe' | 'watch' | 'danger';
  /** 金属价格源信息 */
  metalPriceSource: {
    customer: string;
    internal: string;
    copperSpread: number;
    aluminumSpread: number;
  };
}
