import { numberOr } from './shared_utils';
import type { HarnessResult, InternalHarnessResult } from '@/types/harness';
import type {
  GeelyRates,
  GeelyTemplateResult,
  NreData,
  QuoteSheet,
  QuoteSheetMeta,
} from '@/types/quote';
import type { VolumeSchedule, CustomerQuoteSnapshot } from '@/types/project';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 默认费率 (吉利标准，可按客户覆盖)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** 默认费率 — 以吉利标准为基准，创建报价时可按客户覆盖 */
export const DEFAULT_RATES: GeelyRates = {
  mgmtRate: 0.04,      // 管理费 4%
  financeRate: 0.04,    // 财务费 4%
  salesRate: 0.04,      // 销售费 4%
  profitRate: 0.04,     // 利润 4%
  wasteRate: 0.01,      // 废品率 1%
};

/** @deprecated 使用 DEFAULT_RATES */
export const GEELY_RATES = DEFAULT_RATES;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 建议售价计算
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 通用报价模板映射
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * mapToQuoteTemplate — 将内部核算结果映射到报价模板
 *
 * 模板结构 (通用):
 *   A1 = 原材料 (自制件原材料，如塑胶粒子、金属坯料 — 供应商自己加工的)
 *   A2 = 外购件 (直接外购的成品/半成品，如导线、连接器、端子、衬套等)
 *   B1 = 加工费
 *   B2 = 废品损失
 *   C1 = 管理费 (基数 × 费率)
 *   C2 = 财务费 (基数 × 费率)
 *   C3 = 销售费 (基数 × 费率)
 *   D  = 利润   (基数 × 费率)
 *   E/F/G = NRE 分摊 (模具/检具/研发)
 *
 * A1/A2 的区分取决于供应商类型:
 *   - 线束供应商: 导线、连接器、端子全部是外购 → A1=0, A2=全部材料
 *   - 支架供应商: 塑胶自制 → A1=塑胶成本, A2=金属衬套(外购)
 *   - 通用逻辑: 从 materialBreakdown.selfManufactured 取 A1，其余归 A2
 *
 * @param harnessResult - computeHarnessCost() 的结果
 * @param nreData - NRE(一次性费用)数据
 * @param overrideRates - 覆盖默认费率 (可选，按客户调整)
 * @returns 报价模板格式的明细
 */
export function mapToQuoteTemplate(
  harnessResult: HarnessResult,
  nreData?: NreData,
  overrideRates?: Partial<GeelyRates>,
): GeelyTemplateResult {
  const h = harnessResult || ({} as HarnessResult);
  const nre = nreData || {};
  const rates = { ...DEFAULT_RATES, ...(overrideRates || {}) };

  // ── A: 材料成本 ──
  // A1 = 原材料 (自制件)
  // A2 = 外购件
  let A1 = 0;
  let A2 = 0;

  if (h.materialBreakdown) {
    const mb = h.materialBreakdown as any;
    if (mb.selfManufactured !== undefined && mb.selfManufactured !== null) {
      // 有自制件数据: A1 = 自制件, A2 = 总材料 - 自制件
      A1 = numberOr(mb.selfManufactured, 0);
      A2 = numberOr(h.materialCost, 0) - A1;
    } else {
      // 无自制件数据 → 全部归入外购件
      A1 = 0;
      A2 = numberOr(h.materialCost, 0);
    }
  } else {
    // 无 materialBreakdown → 全部归入外购件
    A1 = 0;
    A2 = numberOr(h.materialCost, 0);
  }

  // ── B: 加工费 + 废品 ──
  const B1 = numberOr(h.manufacturing, 0);
  const B2 = (A1 + A2) * rates.wasteRate;

  // ── 基数 ──
  const base = A1 + A2 + B1 + B2;

  // ── C: 期间费用 ──
  const C1 = base * rates.mgmtRate;     // 管理费
  const C2 = base * rates.financeRate;  // 财务费
  const C3 = base * rates.salesRate;    // 销售费

  // ── D: 利润 ──
  const D = base * rates.profitRate;

  // 出厂价 (不含分摊)
  const exFactoryPrice = A1 + A2 + B1 + B2 + C1 + C2 + C3 + D;

  // ── E/F/G: NRE 分摊 ──
  const amortVol =
    nre.amortizationVolume && nre.amortizationVolume > 0
      ? nre.amortizationVolume
      : 1;
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
    templateName: '报价模板',
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
    exFactoryPrice,
    deliveredPrice,

    // 费率
    rates,
  };
}

/** @deprecated 使用 mapToQuoteTemplate */
export const mapToGeelyTemplate = mapToQuoteTemplate;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 通用模板入口
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * mapToTemplate — 统一入口，按客户名选择费率，结构统一
 *
 * 所有客户使用同一模板结构 (A1+A2+B1+B2+C1+C2+C3+D+NRE)
 * 不同客户只是费率不同，可通过 templateConfig 覆盖默认费率
 */
export function mapToTemplate(
  harnessResult: HarnessResult,
  _templateName?: string,
  templateConfig?: any,
  nreData?: NreData,
): GeelyTemplateResult {
  return mapToQuoteTemplate(harnessResult, nreData, templateConfig);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 内部实绩 → 报价映射 (V3.1)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * mapInternalToOem — 内部实绩映射至客户报价格式
 *
 * V3.1 说明:
 *   - 移除了旧版 A1=materialCost*0.4 / A2=materialCost*0.6 的硬编码比例
 *   - A1(原材料) = 自制件成本 (如塑胶粒子、金属坯料等供应商自己加工的原材料)
 *   - A2(外购件) = 直接外购的成品/半成品 (导线、连接器、端子、衬套等)
 *   - 对于全部外购的供应商 (如线束厂): A1=0, A2=全部材料成本
 *   - 新增建议售价计算: suggestedPrice = internalCost / (1 - targetMargin%)
 *   - 客户报价调整由销售按商务策略执行，程序只输出建议价
 *
 * @param internal - 内部核算结果
 * @param _oemType - 保留参数 (所有客户使用同一模板结构)
 * @param options - 可选参数 { targetMarginPercent: 目标毛利率(%) }
 */
export function mapInternalToOem(
  internal: InternalHarnessResult,
  _oemType?: string,
  options?: { targetMarginPercent?: number },
): any {
  const h = internal;
  const opts = options || {};
  const targetMargin = numberOr(opts.targetMarginPercent, 0);

  // ── A1/A2: 从 materialBreakdown 取实际拆分 ──
  let A1 = 0;
  let A2 = numberOr(h.materialCost, 0);

  const mb = (h as any).materialBreakdown;
  if (mb && mb.selfManufactured !== undefined && mb.selfManufactured !== null) {
    A1 = numberOr(mb.selfManufactured, 0);
    A2 = numberOr(h.materialCost, 0) - A1;
  }
  // 无 selfManufactured → 全部归 A2 (外购)

  // ── B1: 加工费 = MOH(除废品) + 直接人工 ──
  const B1 =
    numberOr(h.mfgOverheadTotal, 0) -
    numberOr(h.materialWaste, 0) +
    numberOr(h.directLabor, 0);

  // ── B2: 废品损失 ──
  const B2 = numberOr(h.materialWaste, 0);

  const base = A1 + A2 + B1 + B2;

  // ── 期间费用 + 利润 (4% 标准费率) ──
  const C1 = base * 0.04; // 管理费
  const C2 = base * 0.04; // 财务费
  const C3 = base * 0.04; // 销售费
  const D = base * 0.04; // 利润

  const exFactoryPrice = A1 + A2 + B1 + B2 + C1 + C2 + C3 + D;
  const deliveredPrice = exFactoryPrice + numberOr(h.packTotal, 0);

  // ── 建议售价 (基于内部成本 + 目标毛利) ──
  const internalCost = numberOr(h.internalCost, deliveredPrice);
  const suggestedPrice =
    targetMargin > 0
      ? computeSuggestedPrice(internalCost, targetMargin)
      : deliveredPrice;

  return {
    templateName: '报价模板 V3.1 (实绩映射)',
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 报价单生成
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * buildQuoteSheet — 生成报价单数据 (多零件号)
 */
export function buildQuoteSheet(
  harnessResults: HarnessResult[],
  templateName: string,
  projectMeta?: Partial<QuoteSheetMeta>,
  nreData?: NreData,
  volumes?: VolumeSchedule[],
  customerQuoteSnapshots?: Record<string, CustomerQuoteSnapshot>,
): QuoteSheet {
  const meta = projectMeta || {};

  let effectiveNre = nreData || {};
  if (!effectiveNre.amortizationVolume || effectiveNre.amortizationVolume === 0) {
    if (volumes && volumes.length > 0) {
      const first3Years = volumes
        .slice(0, 3)
        .reduce((sum, v) => sum + (v.volume || 0), 0);
      if (first3Years > 0) {
        effectiveNre = { ...effectiveNre, amortizationVolume: first3Years };
      }
    }
  }

  const harnesses = (harnessResults || []).map((h) => {
    const item = mapToQuoteTemplate(h, effectiveNre);
    const snapshot = customerQuoteSnapshots?.[h.harnessId];
    if (!snapshot) return item;
    return {
      ...item,
      exFactoryPrice: snapshot.exFactoryPrice ?? item.exFactoryPrice,
      deliveredPrice: snapshot.deliveredPrice,
    };
  });

  const totals: Record<string, number> = {};
  if (harnesses.length > 0) {
    const keys = Object.keys(harnesses[0]!).filter((k) => {
      return (
        typeof (harnesses[0] as any)[k] === 'number' && k !== 'vehicleRatio'
      );
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
    harnesses,
    totals,
    harnessCount: harnesses.length,
  };
}
