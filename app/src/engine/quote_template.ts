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
import type { VolumeSchedule } from '@/types/project';

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
  wasteRate: 0.01,     // 默认废品率 (仅用于占位，实际可从项目配置取)
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

/**
 * mapToGeelyTemplate — 映射到吉利报价模板
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

  // A1 = 原材料 (导线类)
  let A1 = 0;
  // A2 = 外购件 (连接器+端子+辅料)
  let A2 = 0;

  if (h.materialBreakdown) {
    A1 = numberOr(h.materialBreakdown.byType && h.materialBreakdown.byType.wire, 0);
    A2 = numberOr(h.materialCost, 0) - A1;
  } else {
    // 如果没有 byType 数据，使用金属/非金属拆分近似
    const mb = h.materialBreakdown as any;
    const cuAlCost = numberOr(mb && mb.cuCost, 0)
      + numberOr(mb && mb.alCost, 0)
      + numberOr(mb && mb.nonMetalCost, 0);
    A1 = cuAlCost;
    A2 = numberOr(h.materialCost, 0) - A1;
  }

  // B1 = 加工费 (这里用制造费，不是直接人工+制造费)
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
  
  // 使用项目自身的费率
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
 *
 * @param harnessResult - 核算结果
 * @param templateName - 模板名称 ('geely' | 'internal')
 * @param templateConfig - 模板配置 (覆盖预设)
 * @param nreData - NRE数据 (仅 geely 模板需要)
 * @returns 映射后的报价结构
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

/**
 * mapInternalToOem — 内部实绩映射至 OEM 报价格式 (Sales Hook)
 * 遵循 翁骏 (销售) 与 王强 (财务) 的联合定义:
 * 1. 吉利: 0.6% 损耗 -> B2 废品损失; Gap -> C1 管理费修正; 6D MOH -> B1 加工费
 * 2. 比亚迪: All-in 摊销, 0.6% 损耗埋入单价; 6D MOH -> 加工费
 */
export function mapInternalToOem(
  internal: InternalHarnessResult,
  oemType: 'Geely' | 'BYD' | 'GreatWall'
): any {
  const h = internal;
  
  if (oemType === 'Geely') {
    // A1 = 原材料 (导线), A2 = 外购件
    // 简化处理: 假设导线占比 40%
    const A1 = h.materialCost * 0.4;
    const A2 = h.materialCost * 0.6;
    
    // B1 = 加工费 = 6D MOH (除废品外)
    const B1 = h.mfgOverheadTotal - h.materialWaste + h.directLabor;
    
    // B2 = 废品损失 = 实绩损耗 (0.6%)
    const B2 = h.materialWaste;
    
  // C1 = 管理费 (基准 4% + Gap 修正 + 商务策略调节)
  // 简单逻辑: 如果有 GapStatus 异常，将偏差金额计入管理费
  const gapAmount = (h as any).managementGapAmount || 0;
  const salesAdjustmentBuffer = (h as any).salesAdjustmentBuffer || 0;
  const C1 = (A1 + A2 + B1 + B2) * 0.04 + gapAmount + salesAdjustmentBuffer;
    
    const C2 = (A1 + A2 + B1 + B2) * 0.04; // 财务费
    const C3 = (A1 + A2 + B1 + B2) * 0.04; // 销售费
    const D = (A1 + A2 + B1 + B2) * 0.04;  // 利润
    
    const exFactoryPrice = A1 + A2 + B1 + B2 + C1 + C2 + C3 + D;
    
    return {
      templateName: '吉利 V3.0 (实绩映射)',
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
      exFactoryPrice: exFactoryPrice,
      deliveredPrice: exFactoryPrice + h.packTotal,
      auditTraceId: h.auditTraceId
    };
  }
  
  if (oemType === 'BYD') {
    // BYD All-in 逻辑: 损耗埋入物料单价，商务调节也埋入
    const salesAdjustmentBuffer = (h as any).salesAdjustmentBuffer || 0;
    const directMaterial = h.materialCost + h.materialWaste + salesAdjustmentBuffer;
    const processingFee = h.mfgOverheadTotal - h.materialWaste + h.directLabor;
    
    // 管理费 6%, 利润 5% (基准)
    const managementFee = (directMaterial + processingFee) * 0.06;
    const profit = (directMaterial + processingFee + managementFee) * 0.05;
    
    const exFactoryPrice = directMaterial + processingFee + managementFee + profit;
    
    return {
      templateName: '比亚迪 V3.0 (实绩映射)',
      harnessId: h.harnessId,
      harnessName: h.harnessName,
      directMaterial,
      processingFee,
      wasteLoss: 0, // 埋入材料中
      managementFee,
      profit,
      exFactoryPrice,
      deliveredPrice: exFactoryPrice + h.packTotal,
      auditTraceId: h.auditTraceId
    };
  }

  return mapToInternalTemplate(h as any);
}

/**
 * buildQuoteSheet — 生成报价单数据 (多零件号)
 *
 * @param harnessResults - 多个零件号的核算结果
 * @param templateName - 模板名称
 * @param projectMeta - 项目元信息
 * @param nreData - NRE数据
 * @param volumes - 项目年度产量 (用于计算默认分摊数量)
 * @returns 完整的报价单数据
 */
export function buildQuoteSheet(
  harnessResults: HarnessResult[], 
  templateName: string, 
  projectMeta?: Partial<QuoteSheetMeta>, 
  nreData?: NreData,
  volumes?: VolumeSchedule[]
): QuoteSheet {
  const meta = projectMeta || {};
  
  // 处理分摊数量默认逻辑: 如果未定义或为0，则取前3年产量之和
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
    return mapToTemplate(h, templateName, null, effectiveNre);
  });

  // 计算合计
  const totals: Record<string, number> = {};
  if (harnesses.length > 0) {
    const firstHarness = harnesses[0]!;
    const keys = Object.keys(firstHarness).filter((k) => {
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
