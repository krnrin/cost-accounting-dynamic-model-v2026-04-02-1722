import type { BomItem, WireItem } from '@/types/harness';

export interface BomDiffRow {
  partNo: string;
  partName: string;
  changeType: 'added' | 'removed' | 'modified' | 'unchanged';
  fieldChanges: Array<{
    field: string;
    label: string;
    oldValue: unknown;
    newValue: unknown;
  }>;
  costImpact: number;
  oldItem?: BomItem | WireItem;
  newItem?: BomItem | WireItem;
}

export interface BomDiffResult {
  rows: BomDiffRow[];
  summary: {
    added: number;
    removed: number;
    modified: number;
    unchanged: number;
    totalCostImpact: number;
  };
}

const COMPARE_FIELDS: Array<{ field: string; label: string }> = [
  { field: 'partName', label: '物料名称' },
  { field: 'qty', label: '用量' },
  { field: 'unitPrice', label: '单价' },
  { field: 'unit', label: '单位' },
  { field: 'itemCategory', label: '分类' },
  { field: 'supplier', label: '供应商' },
  { field: 'spec', label: '规格' },
  { field: 'vehicleRatio', label: '装车比' },
  { field: 'configType', label: '标配/选配' },
  { field: 'copperWeightPerUnit', label: '铜重' },
  { field: 'aluminumWeightPerUnit', label: '铝重' },
];

export function diffBom(
  oldBom: Array<BomItem | WireItem>,
  newBom: Array<BomItem | WireItem>
): BomDiffResult {
  const oldMap = new Map(oldBom.map(item => [item.partNo, item]));
  const newMap = new Map(newBom.map(item => [item.partNo, item]));
  const allPartNos = new Set([...oldMap.keys(), ...newMap.keys()]);

  const rows: BomDiffRow[] = [];
  let added = 0, removed = 0, modified = 0, unchanged = 0;
  let totalCostImpact = 0;

  for (const partNo of allPartNos) {
    const oldItem = oldMap.get(partNo);
    const newItem = newMap.get(partNo);

    if (!oldItem && newItem) {
      const cost = (newItem.qty || 0) * (newItem.unitPrice || 0);
      rows.push({ partNo, partName: newItem.partName || '', changeType: 'added', fieldChanges: [], costImpact: cost, newItem });
      added++;
      totalCostImpact += cost;
    } else if (oldItem && !newItem) {
      const cost = -((oldItem.qty || 0) * (oldItem.unitPrice || 0));
      rows.push({ partNo, partName: oldItem.partName || '', changeType: 'removed', fieldChanges: [], costImpact: cost, oldItem });
      removed++;
      totalCostImpact += cost;
    } else if (oldItem && newItem) {
      const fieldChanges: BomDiffRow['fieldChanges'] = [];
      for (const { field, label } of COMPARE_FIELDS) {
        const ov = (oldItem as any)[field];
        const nv = (newItem as any)[field];
        if (JSON.stringify(ov) !== JSON.stringify(nv)) {
          fieldChanges.push({ field, label, oldValue: ov, newValue: nv });
        }
      }
      const oldCost = (oldItem.qty || 0) * (oldItem.unitPrice || 0);
      const newCost = (newItem.qty || 0) * (newItem.unitPrice || 0);
      const costImpact = newCost - oldCost;

      if (fieldChanges.length > 0) {
        rows.push({ partNo, partName: newItem.partName || '', changeType: 'modified', fieldChanges, costImpact, oldItem, newItem });
        modified++;
        totalCostImpact += costImpact;
      } else {
        rows.push({ partNo, partName: newItem.partName || '', changeType: 'unchanged', fieldChanges: [], costImpact: 0, oldItem, newItem });
        unchanged++;
      }
    }
  }

  const order = { added: 0, removed: 1, modified: 2, unchanged: 3 };
  rows.sort((a, b) => order[a.changeType] - order[b.changeType]);

  return { rows, summary: { added, removed, modified, unchanged, totalCostImpact } };
}
