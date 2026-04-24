import type { BomItem, WireItem } from '@/types/harness';
import type {
  AssemblyPartRow,
  BomSheetRow,
  ChangeHistoryRow,
  KskBomRow,
  SecondaryMaterialRow,
} from '@/types/bomWorkbook';
import { getSafeBom } from '@/lib/harnessInputDefaults';

export const BOM_HEADERS = [
  'No.',
  'Function',
  'Part No.',
  'Part Name',
  'Semi-finished',
  'SAP No.',
  'Spec',
  'Qty',
  'Unit',
  'Supplier',
  'Category',
  'Unit Price',
  'Amount',
  'Copper Weight / Unit',
  'Aluminum Weight / Unit',
  'Non-metal Cost / Unit',
] as const;

export const ASSEMBLY_PARTS_HEADERS = [
  'NO.',
  'Function',
  'Part Number',
  'Part Name',
  'Semi-Finished',
  'Wire NO.',
  'PIN',
  'OPTION',
  'SPEC',
  'Quantity',
  'Unit',
  'Supplier',
  'Remark',
] as const;

export const SECONDARY_MATERIAL_HEADERS = [
  'Component Desc',
  'Part Name',
  'Part No.',
  'Qty',
  'Unit',
  'Unit Price',
  'Copper Weight Per Unit',
  'Copper Weight Total',
  'Supplier',
  'Origin',
  'SAP No.',
  'Remark',
] as const;

export const KSK_HEADERS = [
  'Harness Id',
  'Harness Name',
  'Assembly No.',
  'Part No.',
  'Part Name',
  'Semi-Finished',
  'SAP No.',
  'Wire No.',
  'Qty',
  'Unit',
  'Supplier',
  'Remark',
] as const;

export const HISTORY_HEADERS = [
  'Seq',
  'Package Name',
  'Harness Part No.',
  'Part Name',
  'Change History',
  'Change Date',
  'Remark',
] as const;

function asWireItem(item: BomItem | WireItem): WireItem | null {
  return item.itemCategory === 'wire' ? (item as WireItem) : null;
}

function buildRowKey(harnessId: string, bucket: string, seqNo: number, partNo: string): string {
  return [harnessId, bucket, String(seqNo), partNo].join('::');
}

export function buildBomSheetRows(
  harnessId: string,
  harnessName: string,
  bom: Array<BomItem | WireItem> | null | undefined
): BomSheetRow[] {
  return getSafeBom(bom).map((item, index) => {
    const wire = asWireItem(item);
    const seqNo = index + 1;
    return {
      rowKey: buildRowKey(harnessId, 'bom', seqNo, item.partNo),
      sheetType: 'bom',
      harnessId,
      harnessName,
      seqNo,
      functionText: item.functionText || item.endGroup || '',
      partNo: item.partNo,
      partName: item.partName,
      isSemiFinished: Boolean(item.isSemiFinished),
      sapNo: item.sapNo,
      spec: item.spec,
      qty: item.qty,
      unit: item.unit,
      supplier: item.supplier,
      itemCategory: item.itemCategory,
      unitPrice: item.unitPrice,
      amount: item.amount,
      copperWeightPerUnit: wire?.copperWeightPerUnit || 0,
      aluminumWeightPerUnit: wire?.aluminumWeightPerUnit || 0,
      nonMetalCostPerUnit: wire?.nonMetalCostPerUnit || 0,
    };
  });
}

export function buildAssemblyPartRows(
  harnessId: string,
  harnessName: string,
  bom: Array<BomItem | WireItem> | null | undefined
): AssemblyPartRow[] {
  return getSafeBom(bom).map((item, index) => {
    const seqNo = index + 1;
    const sourceBomRowKey = buildRowKey(harnessId, 'bom', seqNo, item.partNo);
    return {
      rowKey: buildRowKey(harnessId, 'assembly', seqNo, item.partNo),
      sheetType: 'assembly_parts',
      harnessId,
      harnessName,
      sourceBomRowKey,
      seqNo,
      functionText: item.functionText || item.endGroup || '',
      partNo: item.partNo,
      partName: item.partName,
      isSemiFinished: Boolean(item.isSemiFinished),
      spec: item.spec,
      qty: item.qty,
      unit: item.unit,
      supplier: item.supplier,
      remark: '',
    };
  });
}

export function buildSecondaryMaterialRows(
  harnessId: string,
  harnessName: string,
  bom: Array<BomItem | WireItem> | null | undefined
): SecondaryMaterialRow[] {
  return getSafeBom(bom)
    .map((item, index) => {
      const seqNo = index + 1;
      const sourceBomRowKey = buildRowKey(harnessId, 'bom', seqNo, item.partNo);
      const wire = asWireItem(item);
      return {
        rowKey: buildRowKey(harnessId, 'secondary', seqNo, item.partNo),
        sheetType: 'secondary_material',
        harnessId,
        harnessName,
        sourceBomRowKey,
        componentDesc: harnessName,
        partNo: item.partNo,
        partName: item.partName,
        itemCategory: item.itemCategory,
        qty: item.qty,
        unit: item.unit,
        unitPrice: item.unitPrice,
        copperWeightPerUnit: wire?.copperWeightPerUnit || 0,
        copperWeightTotal: 0,
        supplier: item.supplier,
        origin: '',
        sapNo: item.sapNo,
        remark: '',
      };
    });
}

export function buildKskBomRows(
  harnessId: string,
  harnessName: string,
  bom: Array<BomItem | WireItem> | null | undefined
): KskBomRow[] {
  return getSafeBom(bom).map((item, index) => {
    const seqNo = index + 1;
    const sourceBomRowKey = buildRowKey(harnessId, 'bom', seqNo, item.partNo);
    return {
      rowKey: buildRowKey(harnessId, 'ksk', seqNo, item.partNo),
      sheetType: 'ksk_bom',
      harnessId,
      harnessName,
      sourceBomRowKey,
      assemblyNo: item.itemCategory === 'connector' ? item.partNo : '',
      partNo: item.partNo,
      partName: item.partName,
      isSemiFinished: item.isSemiFinished,
      sapNo: item.sapNo,
      wireNo: item.functionText || item.endGroup || '',
      qty: item.qty,
      unit: item.unit,
      supplier: item.supplier,
      remark: '',
    };
  });
}

export function bomRowsToSheetData(rows: BomSheetRow[]): Array<Array<string | number | null>> {
  return [
    [...BOM_HEADERS],
    ...rows.map(row => [
      row.seqNo,
      row.functionText,
      row.partNo,
      row.partName,
      row.isSemiFinished ? 'Y' : 'N',
      row.sapNo || '',
      row.spec || '',
      row.qty,
      row.unit,
      row.supplier || '',
      row.itemCategory,
      row.unitPrice,
      row.amount,
      row.copperWeightPerUnit || 0,
      row.aluminumWeightPerUnit || 0,
      row.nonMetalCostPerUnit || 0,
    ]),
  ];
}

export function bomSheetDataToBomItems(
  data: (string | number | null)[][],
  previousBom: Array<BomItem | WireItem> = [],
): Array<BomItem | WireItem> {
  return data
    .slice(1)
    .filter((row) => String(row[2] || '').trim().length > 0)
    .map((row, index) => {
      const itemCategory = String(row[10] || 'other');
      const qty = Number(row[7] || 0);
      const unitPrice = Number(row[11] || 0);
      const semiFlag = String(row[4] || '').toUpperCase();
      const previousItem = previousBom[index];
      const previousWire = previousItem?.itemCategory === 'wire' ? previousItem as WireItem : null;

      const base: BomItem = {
        partNo: String(row[2] || ''),
        partName: String(row[3] || ''),
        itemCategory: itemCategory as BomItem['itemCategory'],
        spec: String(row[6] || ''),
        unit: String(row[8] || ''),
        qty,
        unitPrice,
        amount: Number((qty * unitPrice).toFixed(4)),
        functionText: String(row[1] || ''),
        sapNo: String(row[5] || ''),
        supplier: String(row[9] || ''),
        isSemiFinished: semiFlag === 'Y' || semiFlag === '是',
      };

      if (itemCategory === 'wire') {
        return {
          ...base,
          copperWeightPerUnit: Number(row[13] ?? previousWire?.copperWeightPerUnit ?? 0) || 0,
          aluminumWeightPerUnit: Number(row[14] ?? previousWire?.aluminumWeightPerUnit ?? 0) || 0,
          nonMetalCostPerUnit: Number(row[15] ?? previousWire?.nonMetalCostPerUnit ?? 0) || 0,
        } as WireItem;
      }

      return base;
    });
}

export function assemblyRowsToSheetData(rows: AssemblyPartRow[]): Array<Array<string | number | null>> {
  return [
    [...ASSEMBLY_PARTS_HEADERS],
    ...rows.map(row => [
      row.seqNo,
      row.functionText,
      row.partNo,
      row.partName,
      row.isSemiFinished ? 'Y' : 'N',
      row.wireNo || '',
      row.pin || '',
      row.optionCode || '',
      row.spec || '',
      row.qty,
      row.unit,
      row.supplier || '',
      row.remark || '',
    ]),
  ];
}

export function secondaryRowsToSheetData(rows: SecondaryMaterialRow[]): Array<Array<string | number | null>> {
  return [
    [...SECONDARY_MATERIAL_HEADERS],
    ...rows.map(row => [
      row.componentDesc,
      row.partName,
      row.partNo,
      row.qty,
      row.unit,
      row.unitPrice,
      row.copperWeightPerUnit || 0,
      row.copperWeightTotal || 0,
      row.supplier || '',
      row.origin || '',
      row.sapNo || '',
      row.remark || '',
    ]),
  ];
}

export function kskRowsToSheetData(rows: KskBomRow[]): Array<Array<string | number | null>> {
  return [
    [...KSK_HEADERS],
    ...rows.map(row => [
      row.harnessId || '',
      row.harnessName || '',
      row.assemblyNo || '',
      row.partNo,
      row.partName,
      row.isSemiFinished ? 'Y' : 'N',
      row.sapNo || '',
      row.wireNo || '',
      row.qty,
      row.unit,
      row.supplier || '',
      row.remark || '',
    ]),
  ];
}

export function historyRowsToSheetData(rows: ChangeHistoryRow[]): Array<Array<string | number | null>> {
  return [
    [...HISTORY_HEADERS],
    ...rows.map(row => [
      row.seqNo,
      row.packageName,
      row.harnessPartNo,
      row.partName,
      row.changeDescription,
      row.changeDate,
      row.remark || '',
    ]),
  ];
}
