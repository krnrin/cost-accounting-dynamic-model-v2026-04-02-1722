import type { VersionSnapshot, VersionDiff, VersionDiffItem } from '../types/version';
import { computeInternalHarnessCost, mapInternalToHarnessResult } from './harness_costing';

/**
 * [成本核算数据原则] 必须传入 internalRates，禁止回退到硬编码默认值
 */
function requireInternalRates(config: { internalRates?: any }, context: string): any {
  if (!config.internalRates) {
    throw new Error(
      `[成本核算] ${context} 缺少 internalRates 配置。` +
      '必须传入真实费率配置，禁止使用硬编码默认值。'
    );
  }
  return config.internalRates;
}

// [PR-036] 增加 beforeVersionId 和 afterVersionId 参数
export function computeVersionDiff(
  before: VersionSnapshot,
  after: VersionSnapshot,
  beforeVersionId?: string,
  afterVersionId?: string
): VersionDiff {
  const projectLevel: VersionDiffItem[] = [
    createDiffItem('vehicleCost', '单车成本', before.summary.vehicleCost, after.summary.vehicleCost),
    createDiffItem('totalMaterial', '材料成本', before.summary.totalMaterial, after.summary.totalMaterial),
    createDiffItem('totalLabor', '人工成本', before.summary.totalLabor, after.summary.totalLabor),
    createDiffItem('harnessCount', '线束数量', before.summary.harnessCount, after.summary.harnessCount),
  ];

  const harnessMapBefore = new Map(before.harnesses.map(h => [h.harnessId, h]));
  const harnessMapAfter = new Map(after.harnesses.map(h => [h.harnessId, h]));
  const allHarnessIds = Array.from(new Set([...harnessMapBefore.keys(), ...harnessMapAfter.keys()]));

  const harnessLevel = allHarnessIds.map(harnessId => {
    const b = harnessMapBefore.get(harnessId);
    const a = harnessMapAfter.get(harnessId);
    const harnessName = a?.harnessName || b?.harnessName || 'Unknown';

    const beforeRates = b ? requireInternalRates(before.config, 'before 版本') : null;
    const afterRates = a ? requireInternalRates(after.config, 'after 版本') : null;

    const resultBefore = b ? mapInternalToHarnessResult(computeInternalHarnessCost(b.input, beforeRates, before.config.metalPrices)) : null;
    const resultAfter = a ? mapInternalToHarnessResult(computeInternalHarnessCost(a.input, afterRates, after.config.metalPrices)) : null;

    const diffs: VersionDiffItem[] = [
      createDiffItem('deliveredPrice', '到厂价', resultBefore?.deliveredPrice || 0, resultAfter?.deliveredPrice || 0),
      createDiffItem('materialCost', '材料', resultBefore?.materialCost || 0, resultAfter?.materialCost || 0),
      createDiffItem('waste', '损耗', resultBefore?.wasteCost || 0, resultAfter?.wasteCost || 0),
      createDiffItem('directLabor', '直接人工', resultBefore?.directLabor || 0, resultAfter?.directLabor || 0),
      createDiffItem('manufacturing', '制造费', resultBefore?.manufacturing || 0, resultAfter?.manufacturing || 0),
      createDiffItem('managementFee', '管理费', resultBefore?.mgmtFee || 0, resultAfter?.mgmtFee || 0),
      createDiffItem('profit', '利润', resultBefore?.profit || 0, resultAfter?.profit || 0),
      createDiffItem('exFactoryPrice', '出厂价', resultBefore?.exFactoryPrice || 0, resultAfter?.exFactoryPrice || 0),
      createDiffItem('packSubtotal', '包装费', resultBefore?.packSubtotal || 0, resultAfter?.packSubtotal || 0),
      createDiffItem('freightSubtotal', '运输费', resultBefore?.freightSubtotal || 0, resultAfter?.freightSubtotal || 0),
    ];

    return {
      harnessId,
      harnessName,
      diffs,
    };
  });

  return {
    // [PR-036] 填充 beforeVersion/afterVersion 字段
    // VersionSnapshot 没有 versionId 字段，使用传入的参数或空字符串
    beforeVersion: beforeVersionId || '',
    afterVersion: afterVersionId || '',
    projectLevel,
    harnessLevel,
  };
}

function createDiffItem(field: string, label: string, before: number, after: number): VersionDiffItem {
  const delta = after - before;
  const deltaPercent = (before !== 0 && !isNaN(before)) ? (delta / before) * 100 : 0;
  return {
    field,
    label,
    before,
    after,
    delta,
    deltaPercent,
  };
}
