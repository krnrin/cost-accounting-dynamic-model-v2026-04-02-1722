import { numberOr, safeArray } from './shared_utils';
import { computeInternalHarnessCost, mapInternalProjectToProjectHarnessResult } from './harness_costing';
import type { HarnessResult, ProjectHarnessResult } from '@/types/harness';
import type { 
  ChangePricingResult, 
  ChangeItem, 
  CostDelta, 
  AnnualImpact, 
  AnnualDropResult, 
} from '@/types/quote';
import type { MetalPrices } from '@/types/project';

/**
 * 空成本对象 (用于delta计算)
 */
function zeroCost(): CostDelta {
  return {
    materialCost: 0, wasteCost: 0, directLabor: 0, manufacturing: 0,
    laborPlusMfg: 0, mgmtFee: 0, profit: 0, exFactoryPrice: 0,
    packSubtotal: 0, freightSubtotal: 0, packTotal: 0, deliveredPrice: 0,
    copperWeight: 0, aluminumWeight: 0, processHours: 0,
  };
}

/**
 * 计算两个版本之间的成本差异 (逐项)
 */
export function buildDelta(before: HarnessResult | null, after: HarnessResult | null): CostDelta {
  const b = (before || zeroCost()) as any;
  const a = (after || zeroCost()) as any;

  return {
    materialCost: numberOr(a.materialCost, 0) - numberOr(b.materialCost, 0),
    wasteCost: numberOr(a.wasteCost, 0) - numberOr(b.wasteCost, 0),
    directLabor: numberOr(a.directLabor, 0) - numberOr(b.directLabor, 0),
    manufacturing: numberOr(a.manufacturing, 0) - numberOr(b.manufacturing, 0),
    laborPlusMfg: numberOr(a.laborPlusMfg, 0) - numberOr(b.laborPlusMfg, 0),
    mgmtFee: numberOr(a.mgmtFee, 0) - numberOr(b.mgmtFee, 0),
    profit: numberOr(a.profit, 0) - numberOr(b.profit, 0),
    exFactoryPrice: numberOr(a.exFactoryPrice, 0) - numberOr(b.exFactoryPrice, 0),
    packSubtotal: numberOr(a.packSubtotal, 0) - numberOr(b.packSubtotal, 0),
    freightSubtotal: numberOr(a.freightSubtotal, 0) - numberOr(b.freightSubtotal, 0),
    packTotal: numberOr(a.packTotal, 0) - numberOr(b.packTotal, 0),
    deliveredPrice: numberOr(a.deliveredPrice, 0) - numberOr(b.deliveredPrice, 0),
    copperWeight: numberOr(a.copperWeight, 0) - numberOr(b.copperWeight, 0),
    aluminumWeight: numberOr(a.aluminumWeight, 0) - numberOr(b.aluminumWeight, 0),
    processHours: numberOr(a.processHours, 0) - numberOr(b.processHours, 0),
  };
}

/**
 * 检测变更类型的细分
 */
function detectDetailedChangeType(before: HarnessResult | null, after: HarnessResult | null): string {
  if (!before) return 'add';
  if (!after) return 'remove';
  const d = buildDelta(before, after);
  const types: string[] = [];
  const beforeRatio = numberOr(before.installationRatio, numberOr(before.vehicleRatio, 0));
  const afterRatio = numberOr(after.installationRatio, numberOr(after.vehicleRatio, 0));
  if (Math.abs(d.materialCost) > 0.001) types.push('material');
  if (Math.abs(d.processHours) > 0.0001) types.push('hours');
  if (Math.abs(d.packTotal) > 0.001) types.push('packaging');
  if (Math.abs(afterRatio - beforeRatio) > 0.000001) types.push('config_ratio');
  return types.length > 0 ? types.join('+') : 'no_change';
}

/**
 * computeChangePricing — 对比两个版本，生成变更报价明细
 *
 * @param baseProject - 基准版本
 * @param newProject  - 变更版本
 * @param changeType  - 变更类型标记
 * @param options     - 可选参数
 * @returns 变更报价结果
 */
export function computeChangePricing(
  baseProject: ProjectHarnessResult, 
  newProject: ProjectHarnessResult, 
  changeType?: string, 
  options?: { annualVolumes?: number[]; lifecycleYears?: number }
): ChangePricingResult {
  const opts = options || {};
  const baseHarnesses = safeArray(baseProject.harnesses);
  const newHarnesses = safeArray(newProject.harnesses);

  // 找出所有涉及的零件号
  const allIds = new Set<string>();
  baseHarnesses.forEach((h) => { allIds.add(h.harnessId); });
  newHarnesses.forEach((h) => { allIds.add(h.harnessId); });

  const baseMap: Record<string, HarnessResult> = {};
  baseHarnesses.forEach((h) => { baseMap[h.harnessId] = h; });
  const newMap: Record<string, HarnessResult> = {};
  newHarnesses.forEach((h) => { newMap[h.harnessId] = h; });

  const changes: ChangeItem[] = [];
  let unchangedCount = 0;

  allIds.forEach((id) => {
    const base = baseMap[id] || null;
    const curr = newMap[id] || null;
    const baseRatio = numberOr(base?.installationRatio, numberOr(base?.vehicleRatio, 0));
    const currRatio = numberOr(curr?.installationRatio, numberOr(curr?.vehicleRatio, 0));
    const baseWeightedPrice = numberOr(base?.deliveredPrice, 0) * baseRatio;
    const currWeightedPrice = numberOr(curr?.deliveredPrice, 0) * currRatio;
    const weightedDeltaPrice = currWeightedPrice - baseWeightedPrice;

    if (!base && curr) {
      // 新增零件号
      changes.push({
        harnessId: id,
        harnessName: curr.harnessName || '',
        changeCategory: 'add',
        detailedType: 'add',
        before: null,
        after: curr,
        delta: buildDelta(null, curr),
        beforeWeightedPrice: 0,
        afterWeightedPrice: currWeightedPrice,
        weightedDeltaPrice,
        ratioDelta: currRatio,
        installationRatioDelta: currRatio,
      });
    } else if (base && !curr) {
      // 删除零件号
      changes.push({
        harnessId: id,
        harnessName: base.harnessName || '',
        changeCategory: 'remove',
        detailedType: 'remove',
        before: base,
        after: null,
        delta: buildDelta(base, null),
        beforeWeightedPrice: baseWeightedPrice,
        afterWeightedPrice: 0,
        weightedDeltaPrice,
        ratioDelta: -baseRatio,
        installationRatioDelta: -baseRatio,
      });
    } else if (base && curr) {
      const delta = buildDelta(base, curr);
      const hasUnitPriceDelta = Math.abs(delta.deliveredPrice) > 0.001;
      const hasWeightedDelta = Math.abs(weightedDeltaPrice) > 0.001;
      if (hasUnitPriceDelta || hasWeightedDelta) {
        changes.push({
          harnessId: id,
          harnessName: curr.harnessName || base.harnessName || '',
          changeCategory: 'modify',
          detailedType: detectDetailedChangeType(base, curr),
          before: base,
          after: curr,
          delta,
          beforeWeightedPrice: baseWeightedPrice,
          afterWeightedPrice: currWeightedPrice,
          weightedDeltaPrice,
          ratioDelta: numberOr(curr.vehicleRatio, 0) - numberOr(base.vehicleRatio, 0),
          installationRatioDelta: currRatio - baseRatio,
        });
      } else {
        unchangedCount++;
      }
    }
  });

  // 项目级汇总
  const totalBefore = numberOr(baseProject.vehicleCost, 0);
  const totalAfter = numberOr(newProject.vehicleCost, 0);
  const totalDelta = totalAfter - totalBefore;

  // 年度影响
  let annualImpact: AnnualImpact | null = null;
  if (opts.annualVolumes && opts.annualVolumes.length > 0) {
    annualImpact = computeAnnualImpact(totalDelta, opts.annualVolumes);
  }

  return {
    changeType: changeType || 'unspecified',
    timestamp: new Date().toISOString(),
    changes: changes,
    summary: {
      totalBefore: totalBefore,
      totalAfter: totalAfter,
      totalDelta: totalDelta,
      deltaPercent: totalBefore > 0 ? (totalDelta / totalBefore * 100) : 0,
      affectedCount: changes.length,
      unchangedCount: unchangedCount,
      addedCount: changes.filter((c) => c.changeCategory === 'add').length,
      removedCount: changes.filter((c) => c.changeCategory === 'remove').length,
      modifiedCount: changes.filter((c) => c.changeCategory === 'modify').length,
    },
    annualImpact: annualImpact,
  };
}

/**
 * 计算年度影响金额
 */
export function computeAnnualImpact(deltaPerVehicle: number, annualVolumes: number[]): AnnualImpact {
  const volumes = safeArray(annualVolumes);
  const years: any[] = [];
  let totalImpact = 0;

  for (let i = 0; i < volumes.length; i++) {
    const vol = numberOr(volumes[i], 0);
    const impact = deltaPerVehicle * vol;
    totalImpact += impact;
    years.push({
      year: i + 1,
      volume: vol,
      deltaPerVehicle: deltaPerVehicle,
      annualImpact: impact,
      cumulativeImpact: totalImpact,
    });
  }

  return {
    years: years,
    totalLifecycleImpact: totalImpact,
    totalLifecycleVolume: volumes.reduce((s, v) => s + numberOr(v, 0), 0),
  };
}

/**
 * computeMetalEscalation — 金属联动专用
 *
 * [成本核算数据原则] 必须传入 internalRates 参数，禁止回退到硬编码默认值
 */
export function computeMetalEscalation(
  baseHarnessConfigs: any[],
  baseMetalPrices: MetalPrices,
  newMetalPrices: MetalPrices,
  params: any
): ChangePricingResult {
  const configs = safeArray(baseHarnessConfigs);

  if (!params?.internalRates) {
    throw new Error(
      '[成本核算] computeMetalEscalation 缺少 internalRates 参数。' +
      '必须传入真实费率配置，禁止使用硬编码默认值。'
    );
  }

  const baseResults = configs.map((c) => computeInternalHarnessCost(c, params.internalRates, baseMetalPrices));
  const newResults = configs.map((c) => computeInternalHarnessCost(c, params.internalRates, newMetalPrices));

  const baseProject = mapInternalProjectToProjectHarnessResult(baseResults);
  const newProject = mapInternalProjectToProjectHarnessResult(newResults);

  const result = computeChangePricing(baseProject, newProject, 'metal_escalation', params);

  // 追加金属价格信息
  result.metalPrices = {
    before: baseMetalPrices,
    after: newMetalPrices,
    delta: {
      copper: numberOr(newMetalPrices.copper, 0) - numberOr(baseMetalPrices.copper, 0),
      aluminum: numberOr(newMetalPrices.aluminum, 0) - numberOr(baseMetalPrices.aluminum, 0),
    },
  };

  return result;
}

/**
 * computeAnnualDrop — 年降计算
 */
export function computeAnnualDrop(baseDeliveredPrice: number, annualDropRate: number, years: number): AnnualDropResult[] {
  const base = numberOr(baseDeliveredPrice, 0);
  const rate = numberOr(annualDropRate, 0);
  const n = Math.max(1, numberOr(years, 6));
  const result: AnnualDropResult[] = [];

  for (let y = 1; y <= n; y++) {
    const factor = Math.pow(1 - rate, y - 1);
    result.push({
      year: y,
      factor: factor,
      deliveredPrice: base * factor,
      dropFromBase: base * (1 - factor),
      dropPercent: (1 - factor) * 100,
    });
  }

  return result;
}

// ── 快捷变更计算函数 ──

export const computeBomChange = (base: ProjectHarnessResult, curr: ProjectHarnessResult, opts?: any) => 
  computeChangePricing(base, curr, 'bom_change', opts);

export const computeMetalChange = (base: ProjectHarnessResult, curr: ProjectHarnessResult, opts?: any) => 
  computeChangePricing(base, curr, 'metal_change', opts);

export const computeHoursChange = (base: ProjectHarnessResult, curr: ProjectHarnessResult, opts?: any) => 
  computeChangePricing(base, curr, 'hours_change', opts);

export const computeConfigChange = (base: ProjectHarnessResult, curr: ProjectHarnessResult, opts?: any) => 
  computeChangePricing(base, curr, 'config_change', opts);

/**
 * buildChangeComparisonTable — 生成变更对比表 (用于UI展示)
 */
export function buildChangeComparisonTable(changePricingResult: ChangePricingResult) {
  const changes = safeArray(changePricingResult.changes);
  const columns = [
    { key: 'harnessId', label: '零件号' },
    { key: 'harnessName', label: '名称' },
    { key: 'changeCategory', label: '变更类型' },
    { key: 'beforePrice', label: '定点价', unit: '元' },
    { key: 'afterPrice', label: '变更后', unit: '元' },
    { key: 'deltaPrice', label: '差异', unit: '元' },
    { key: 'deltaPercent', label: '差异%', unit: '%' },
  ];

  const rows = changes.map((c: ChangeItem) => {
    const beforePrice = c.beforeWeightedPrice ?? (c.before ? c.before.deliveredPrice : 0);
    const afterPrice = c.afterWeightedPrice ?? (c.after ? c.after.deliveredPrice : 0);
    const deltaPrice = c.weightedDeltaPrice ?? c.delta.deliveredPrice;
    return {
      harnessId: c.harnessId,
      harnessName: c.harnessName,
      changeCategory: c.changeCategory === 'add' ? '新增' : c.changeCategory === 'remove' ? '删除' : '变更',
      beforePrice: beforePrice,
      afterPrice: afterPrice,
      deltaPrice: deltaPrice,
      deltaPercent: beforePrice > 0 ? (deltaPrice / beforePrice * 100) : 0,
    };
  });

  const summary = changePricingResult.summary;
  const totals = {
    harnessId: '单车影响',
    harnessName: '',
    changeCategory: '',
    beforePrice: summary.totalBefore,
    afterPrice: summary.totalAfter,
    deltaPrice: summary.totalDelta,
    deltaPercent: summary.deltaPercent,
  };

  return { columns, rows, totals };
}
