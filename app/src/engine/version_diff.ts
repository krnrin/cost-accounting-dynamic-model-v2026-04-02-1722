import type { VersionSnapshot, VersionDiff, VersionDiffItem } from '../types/version';
import { computeHarnessCost } from './harness_costing';

export function computeVersionDiff(before: VersionSnapshot, after: VersionSnapshot): VersionDiff {
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

    const resultBefore = b ? computeHarnessCost(b.input, before.config.costRates, before.config.metalPrices) : null;
    const resultAfter = a ? computeHarnessCost(a.input, after.config.costRates, after.config.metalPrices) : null;

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
    beforeVersion: '', 
    afterVersion: '',
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
