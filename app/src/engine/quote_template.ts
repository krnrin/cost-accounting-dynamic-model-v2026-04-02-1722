import { numberOr } from './shared_utils';
import type { HarnessResult, InternalHarnessResult } from '@/types/harness';
import type { 
  GeelyRates, 
  GeelyTemplateResult, 
  BydTemplateResult,
  GenericTemplateResult,
  InternalTemplateResult, 
  NreData, 
  TemplatePreset,
  QuoteSheet,
  QuoteSheetMeta
} from '@/types/quote';
import type { GapStatus as _GapStatus } from '@/types/financial_schema';
import type { VolumeSchedule, CustomerQuoteSnapshot } from '@/types/project';

/** 吉利标准费率 */
export const GEELY_RATES: GeelyRates = {
  mgmtRate: 0.04,      // 管理费 4%
  financeRate: 0.04,    // 财务费 4%
  salesRate: 0.04,      // 销售费 4%
  profitRate: 0.04,     // 利润 4%
  wasteRate: 0.01,      // 废品率 1%
};

/** 比亚迪标准费率 */
export const BYD_RATES = {
  mgmtRate: 0.06,      // 管理费 6%
  profitRate: 0.05,    // 利润 5%
  wasteRate: 0.01,     // 默认废品率
};

/**
 * 预定义的客户模板配置
 */
export const TEMPLATE_PRESETS: Record<string, TemplatePreset> = {
  geely: {
    name: '吉利',
    structure: 'A1+A2+B1+B2+C1+C2+C3+D+E+F+G',
    rates: GEELY_RATES as unknown as Record<string, number>,
    amortizationFields: ['tooling', 'testing', 'rnd'],
  },
  byd: {
    name: '比亚迪',
    structure: '直接材料+加工费+废品+管理费(6%)+利润(5%)',
    rates: BYD_RATES,
    amortizationFields: [],
  },
  generic: {
    name: '通用',
    structure: '材料+人工+制造+废品+管理费(%)+利润(%)',
    rates: {},
    amortizationFields: [],
  },
  internal: {
    name: '内部核算',
    structure: '材料+废品+人工+制造+管理+利润',
    rates: {
      wasteRate: 0.009,
      mgmtRate: 0.06,
      profitRate: 0.0566,
    },
    amortizationFields: [],
  },
};

/**
 * 获取模板预设
 */
export function getTemplatePresets() {
  return TEMPLATE_PRESETS;
}

// ──────────────────────────────────────────────────────
// 建议售价计算
// ──────────────────────────────────────────────────────

/**
 * computeSuggestedPrice — 根据内部成本和目标毛利率计算建议售价
 *
 * 公式: 建议售价 = 内部成本 / (1 - 毛利率)
 * 例如: 成本 100，毛利 15% → 售价 = 100 / 0.85 = 117.65
 *
 * 说明: 客户报价需要销售按商务策略去调整，程序只负责计算建议售价。
 * 毛利率由销售手动输入（如 15%），程序算出建议价，销售可在此基础上调整。
 *
 * @param internalCost - 内部实际成本 (元)
 * @param targetMarginPercent - 目标毛利率 (如 15 表示 15%)
 * @returns 建议售价 (元)
 */
export function computeSuggestedPrice(
  internalCost: number,
  targetMarginPercent: number,
): number {
  const cost = numberOr(internalCost, 0);
  const margin = numberOr(targetMarginPercent, 0) / 100;
  if (margin <= 0 || margin >= 1) return cost; // 无效毛利率时返回成本价
  return cost / (1 - margin);
}

// ──────────────────────────────────────────────────────
// 吉利模板映射
// ──────────────────────────────────────────────────────

/**
 * mapToGeelyTemplate — 映射到吉利报价模板
 *
 * A1 = 原材料 (自制件原材料，如塑胶粒子、金属坯料等)
 * A2 = 外购件 (直接外购的成品/半成品，如导线、连接器、端子、衢套等)
 *
 * 说明: A1/A2 的区分取决于供应商类型。
 * - 线束供应商: 导线、连接器、端子全部是外购 → A1=0, A2=全部材料
 * - 支架供应商: 塑胶自制 → A1=塑胶成本, A2=金属衢套(外购)
 * - 通用逻辑: 从 materialBreakdown.selfManufactured 取 A1，其余归 A2
 *
 * @param harnessResult - computeHarnessCost() 的结果
 * @param nreData - NRE(一次性费用)数据
 * @param overrideRates - 覆盖默认费率 (可选)
 * @returns 吉利模板格式的报价明细
 */
export function mapToGeelyTemplate(
  harnessResult: HarnessResult, 
  nreData?: NreData, 
  overrideRates?: Partial<GeelyRates>
): GeelyTemplateResult {
  const h = harnessResult || {} as HarnessResult;
  const nre = nreData || {};
  const rates = { ...GEELY_RATES, ...(overrideRates || {}) };

  // A1 = 原材料 (自制件)
  // A2 = 外购件
  let A1 = 0;
  let A2 = 0;

  if (h.materialBreakdown) {
    const mb = h.materialBreakdown as any;
    // 优先从 selfManufactured 字段取自制件成本
    if (mb.selfManufactured !== undefined && mb.selfManufactured !== null) {
      A1 = numberOr(mb.selfManufactured, 0);
      A2 = numberOr(h.materialCost, 0) - A1;
    } else if (mb.byType && mb.byType.wire !== undefined) {
      // 向后兼容: 旧版本用 byType.wire 区分导线/外购
      // 注意: 导线也是外购件，这里仅为兼容旧数据保留
      A1 = numberOr(mb.byType.wire, 0);
      A2 = numberOr(h.materialCost, 0) - A1;
    } else {
      // 无拆分数据，全部归入外购件
      A1 = 0;
      A2 = numberOr(h.materialCost, 0);
    }
  } else {
    // 无 materialBreakdown，全部归入外购件
    A1 = 0;
    A2 = numberOr(h.materialCost, 0);
  }

  // B1 = 加工费
  const B1 = numberOr(h.manufacturing, 0);

  // B2 = 废品损失 = (A1+A2) × 废品率
  const B2 = (A1 + A2) * rates.wasteRate;

  // 基数 = A1+A2+B1+B2
  const base = A1 + A2 + B1 + B2;

  // C1 = 管理费
  const C1 = base * rates.mgmtRate;
  // C2 = 财务费
  const C2 = base * rates.financeRate;
  // C3 = 销售费
  const C3 = base * rates.salesRate;
  // D = 利润
  const D = base * rates.profitRate;

  // 出厂价 (不含分摊)
  const exFactoryPrice = A1 + A2 + B1 + B2 + C1 + C2 + C3 + D;

  // 分摊费用
  const amortVol = nre.amortizationVolume && nre.amortizationVolume > 0 ? nre.amortizationVolume : 1;
  const E1 = numberOr(nre.borrowedTooling, 0) / amortVol;
  const E2 = numberOr(nre.newTooling, 0) / amortVol;
  const F1 = numberOr(nre.borrowedTesting, 0) / amortVol;
  const F2 = numberOr(nre.newTesting, 0) / amortVol;
  const G1 = numberOr(nre.borrowedRnd, 0) / amortVol;
  const G2 = numberOr(nre.newRnd, 0) / amortVol;

  const amortTotal = E1 + E2 + F1 + F2 + G1 + G2;

  // 到厂价
  const deliveredPrice = exFactoryPrice + amortTotal;

  return {
    templateName: '吉利高压线束报价',
    harnessId: h.harnessId,
    harnessName: h.harnessName,

    // 直接成本
    A1_rawMaterial: A1,
    A2_purchasedParts: A2,
    B1_processingFee: B1,
    B2_wasteLoss: B2,

    // 期间费用
    C1_managementFee: C1,
    C2_financeFee: C2,
    C3_salesFee: C3,
    D_profit: D,

    // 分摊费用
    E1_borrowedTooling: E1,
    E2_newTooling: E2,
    F1_borrowedTesting: F1,
    F2_newTesting: F2,
    G1_borrowedRnd: G1,
    G2_newRnd: G2,

    // 小计
    directMaterial: A1 + A2,
    manufacturingCost: B1 + B2,
    periodExpense: C1 + C2 + C3,
    amortization: amortTotal,

    // 总价
    exFactoryPrice: exFactoryPrice,
    deliveredPrice: deliveredPrice,

    // 费率
    rates: rates,
  };
}

// ──────────────────────────────────────────────────────
// 比亚迪 / 通用 / 内部核算 模板
// ──────────────────────────────────────────────────────

/**
 * mapToBydTemplate — 映射到比亚迪报价模板
 * 结构: 直接材料 + 加工费 + 废品 + 管理费(6%) + 利润(5%)
 */
export function mapToBydTemplate(h: HarnessResult): BydTemplateResult {
  const directMaterial = numberOr(h.materialCost, 0);
  const processingFee = numberOr(h.directLabor, 0) + numberOr(h.manufacturing, 0);
  const wasteLoss = numberOr(h.wasteCost, 0);
  
  // 管理费 = (直接材料 + 加工费) × 6%
  const managementFee = (directMaterial + processingFee) * 0.06;
  
  // 利润 = (直接材料 + 加工费 + 废品 + 管理费) × 5%
  const profit = (directMaterial + processingFee + wasteLoss + managementFee) * 0.05;
  
  const exFactoryPrice = directMaterial + processingFee + wasteLoss + managementFee + profit;
  const packagingCost = numberOr(h.packSubtotal, 0);
  const freightCost = numberOr(h.freightSubtotal, 0);
  const deliveredPrice = exFactoryPrice + packagingCost + freightCost;

  return {
    templateName: '比亚迪报价模板',
    harnessId: h.harnessId,
    harnessName: h.harnessName,
    directMaterial,
    processingFee,
    wasteLoss,
    managementFee,
    profit,
    exFactoryPrice,
    packagingCost,
    freightCost,
    deliveredPrice,
    rates: { mgmtRate: 0.06, profitRate: 0.05, wasteRate: 0.01 }
  };
}

/**
 * mapToGenericTemplate — 映射到通用模板
 * 结构: 材料 + 人工 + 制造 + 废品 + 管理费(%) + 利润(%)
 */
export function mapToGenericTemplate(
  h: HarnessResult, 
  rates?: { mgmtRate?: number; profitRate?: number }
): GenericTemplateResult {
  const materialCost = numberOr(h.materialCost, 0);
  const laborCost = numberOr(h.directLabor, 0);
  const mfgCost = numberOr(h.manufacturing, 0);
  const wasteCost = numberOr(h.wasteCost, 0);
  
  const mgmtFee = numberOr(h.mgmtFee, 0);
  const profit = numberOr(h.profit, 0);
  
  const exFactoryPrice = materialCost + laborCost + mfgCost + wasteCost + mgmtFee + profit;
  const packagingCost = numberOr(h.packSubtotal, 0);
  const freightCost = numberOr(h.freightSubtotal, 0);
  const deliveredPrice = exFactoryPrice + packagingCost + freightCost;

  return {
    templateName: '通用报价模板',
    harnessId: h.harnessId,
    harnessName: h.harnessName,
    materialCost,
    laborCost,
    mfgCost,
    wasteCost,
    mgmtFee,
    profit,
    exFactoryPrice,
    packagingCost,
    freightCost,
    deliveredPrice,
    rates: { 
      mgmtRate: rates?.mgmtRate || 0.06, 
      profitRate: rates?.profitRate || 0.05, 
      wasteRate: 0.01 
    }
  };
}

/**
 * mapToInternalTemplate — 映射到内部核算格式
 */
export function mapToInternalTemplate(harnessResult: HarnessResult): InternalTemplateResult {
  const h = harnessResult || {} as HarnessResult;
  return {
    templateName: '内部核算',
    harnessId: h.harnessId,
    harnessName: h.harnessName,
    vehicleRatio: h.vehicleRatio,
    copperWeight: h.copperWeight,
    aluminumWeight: h.aluminumWeight,
    materialCost: h.materialCost,
    wasteCost: h.wasteCost,
    processHours: h.processHours,
    directLabor: h.directLabor,
    manufacturing: h.manufacturing,
    laborPlusMfg: h.laborPlusMfg,
    mgmtFee: h.mgmtFee,
    profit: h.profit,
    exFactoryPrice: h.exFactoryPrice,
    packSubtotal: h.packSubtotal,
    freightSubtotal: h.freightSubtotal,
    deliveredPrice: h.deliveredPrice,
  };
}

/**
 * mapToTemplate — 通用模板映射入口
 */
export function mapToTemplate(
  harnessResult: HarnessResult, 
  templateName?: string, 
  templateConfig?: any, 
  nreData?: NreData
): GeelyTemplateResult | BydTemplateResult | GenericTemplateResult | InternalTemplateResult {
  const name = (templateName || 'internal').toLowerCase();

  if (name === 'geely' || name === '吉利') {
    return mapToGeelyTemplate(harnessResult, nreData, templateConfig);
  }

  if (name === 'byd' || name === '比亚迪') {
    return mapToBydTemplate(harnessResult);
  }

  if (name === 'generic' || name === '通用') {
    return mapToGenericTemplate(harnessResult, templateConfig);
  }

  return mapToInternalTemplate(harnessResult);
}

// ──────────────────────────────────────────────────────
// 内部实绩 → OEM 报价映射 (V3.1)
// ──────────────────────────────────────────────────────

/**
 * mapInternalToOem — 内部实绩映射至 OEM 报价格式
 *
 * V3.1 重写说明:
 *   - 移除了旧版 A1=materialCost*0.4 / A2=materialCost*0.6 的硬编码比例
 *   - A1(原材料) = 自制件成本 (如塑胶粒子、金属坯料等供应商自己加工的原材料)
 *   - A2(外购件) = 直接外购的成品/半成品 (导线、连接器、端子、衢套等)
 *   - 对于全部外购的供应商 (如线束厂): A1=0, A2=全部材料成本
 *   - 新增建议售价计算: suggestedPrice = internalCost / (1 - targetMargin%)
 *   - 客户报价调整由销售按商务策略执行，程序只输出建议价
 *
 * @param internal - 内部核算结果
 * @param oemType - OEM 类型
 * @param options - 可选参数 { targetMarginPercent: 目标毛利率(%) }
 */
export function mapInternalToOem(
  internal: InternalHarnessResult,
  oemType: 'Geely' | 'BYD' | 'GreatWall',
  options?: { targetMarginPercent?: number }
): any {
  const h = internal;
  const opts = options || {};
  const targetMargin = numberOr(opts.targetMarginPercent, 0);

  if (oemType === 'Geely') {
    // A1 = 原材料 (自制件)
    // A2 = 外购件
    // 从 materialBreakdown 取实际拆分，无拆分数据则全部归入 A2
    let A1 = 0;
    let A2 = numberOr(h.materialCost, 0);

    const mb = (h as any).materialBreakdown;
    if (mb) {
      if (mb.selfManufactured !== undefined && mb.selfManufactured !== null) {
        A1 = numberOr(mb.selfManufactured, 0);
        A2 = numberOr(h.materialCost, 0) - A1;
      }
      // 无 selfManufactured 字段时全部归 A2 (外购)
    }

    // B1 = 加工费 = 6D MOH (除废品外) + 直接人工
    const B1 = numberOr(h.mfgOverheadTotal, 0) - numberOr(h.materialWaste, 0) + numberOr(h.directLabor, 0);
    
    // B2 = 废品损失 = 实绩损耗
    const B2 = numberOr(h.materialWaste, 0);
    
    const base = A1 + A2 + B1 + B2;

    // 期间费用 + 利润 (4% 标准费率)
    const C1 = base * 0.04; // 管理费
    const C2 = base * 0.04; // 财务费
    const C3 = base * 0.04; // 销售费
    const D  = base * 0.04; // 利润
    
    const exFactoryPrice = A1 + A2 + B1 + B2 + C1 + C2 + C3 + D;
    const deliveredPrice = exFactoryPrice + numberOr(h.packTotal, 0);

    // 建议售价 (基于内部成本 + 目标毛利)
    const internalCost = numberOr(h.internalCost, deliveredPrice);
    const suggestedPrice = targetMargin > 0
      ? computeSuggestedPrice(internalCost, targetMargin)
      : deliveredPrice;
    
    return {
      templateName: '吉利 V3.1 (实绩映射)',
      harnessId: h.harnessId,
      harnessName: h.harnessName,
      A1_rawMaterial: A1,
      A2_purchasedParts: A2,
      B1_processingFee: B1,
      B2_wasteLoss: B2,
      C1_managementFee: C1,
      C2_financeFee: C2,
      C3_salesFee: C3,
      D_profit: D,
      exFactoryPrice,
      deliveredPrice,
      // 建议售价信息
      internalCost,
      suggestedPrice,
      targetMarginPercent: targetMargin,
      auditTraceId: h.auditTraceId,
    };
  }
  
  if (oemType === 'BYD') {
    // BYD All-in 逻辑: 全部材料归入直接材料 + 废品
    const directMaterial = numberOr(h.materialCost, 0) + numberOr(h.materialWaste, 0);
    const processingFee = numberOr(h.mfgOverheadTotal, 0) - numberOr(h.materialWaste, 0) + numberOr(h.directLabor, 0);
    
    // 管理费 6%, 利润 5%
    const managementFee = (directMaterial + processingFee) * 0.06;
    const profit = (directMaterial + processingFee + managementFee) * 0.05;
    
    const exFactoryPrice = directMaterial + processingFee + managementFee + profit;
    const deliveredPrice = exFactoryPrice + numberOr(h.packTotal, 0);

    const internalCost = numberOr(h.internalCost, deliveredPrice);
    const suggestedPrice = targetMargin > 0
      ? computeSuggestedPrice(internalCost, targetMargin)
      : deliveredPrice;
    
    return {
      templateName: '比亚迪 V3.1 (实绩映射)',
      harnessId: h.harnessId,
      harnessName: h.harnessName,
      directMaterial,
      processingFee,
      wasteLoss: 0, // 埋入材料中
      managementFee,
      profit,
      exFactoryPrice,
      deliveredPrice,
      internalCost,
      suggestedPrice,
      targetMarginPercent: targetMargin,
      auditTraceId: h.auditTraceId,
    };
  }

  // GreatWall / 其他: 通用逻辑 — 内部成本 + 建议售价
  const internalCost = numberOr(h.internalCost, 0);
  const suggestedPrice = targetMargin > 0
    ? computeSuggestedPrice(internalCost, targetMargin)
    : internalCost;

  return {
    templateName: '通用 V3.1 (实绩映射)',
    harnessId: h.harnessId,
    harnessName: h.harnessName,
    internalCost,
    suggestedPrice,
    targetMarginPercent: targetMargin,
    deliveredPrice: suggestedPrice,
    deviationAnalysis: (h as any).deviationAnalysis || '',
    auditTraceId: h.auditTraceId,
  };
}

// ──────────────────────────────────────────────────────
// 报价单生成
// ──────────────────────────────────────────────────────

/**
 * buildQuoteSheet — 生成报价单数据 (多零件号)
 */
export function buildQuoteSheet(
  harnessResults: HarnessResult[],
  templateName: string,
  projectMeta?: Partial<QuoteSheetMeta>,
  nreData?: NreData,
  volumes?: VolumeSchedule[],
  customerQuoteSnapshots?: Record<string, CustomerQuoteSnapshot>
): QuoteSheet {
  const meta = projectMeta || {};
  
  let effectiveNre = nreData || {};
  if (!effectiveNre.amortizationVolume || effectiveNre.amortizationVolume === 0) {
    if (volumes && volumes.length > 0) {
      const first3Years = volumes.slice(0, 3).reduce((sum, v) => sum + (v.volume || 0), 0);
      if (first3Years > 0) {
        effectiveNre = { ...effectiveNre, amortizationVolume: first3Years };
      }
    }
  }

  const harnesses = (harnessResults || []).map((h) => {
    const item = mapToTemplate(h, templateName, null, effectiveNre);
    const snapshot = customerQuoteSnapshots?.[h.harnessId];
    if (!snapshot) {
      return item;
    }
    return {
      ...item,
      exFactoryPrice: snapshot.exFactoryPrice ?? item.exFactoryPrice,
      deliveredPrice: snapshot.deliveredPrice,
    };
  });

  const totals: Record<string, number> = {};
  if (harnesses.length > 0) {
    const keys = Object.keys(harnesses[0]!).filter((k) => {
      return typeof (harnesses[0] as any)[k] === 'number' && k !== 'vehicleRatio';
    });
    keys.forEach((key) => {
      totals[key] = harnesses.reduce((sum, h) => {
        return sum + numberOr((h as any)[key], 0);
      }, 0);
    });
  }

  return {
    meta: {
      projectName: meta.projectName || '',
      customer: meta.customer || '',
      quotePerson: meta.quotePerson || '',
      quoteDate: meta.quoteDate || new Date().toISOString().slice(0, 10),
      templateName: templateName,
      version: meta.version || 'v1',
      status: meta.status || 'draft',
    },
    harnesses: harnesses,
    totals: totals,
    harnessCount: harnesses.length,
  };
}
