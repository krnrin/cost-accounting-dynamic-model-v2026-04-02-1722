export type WorkbookSheetType =
  | 'bom'
  | 'assembly_parts'
  | 'secondary_material'
  | 'ksk_bom'
  | 'change_history';

export interface WorkbookRowBase {
  rowKey: string;
  sheetType: WorkbookSheetType;
  harnessId?: string;
  harnessName?: string;
  sourceBomRowKey?: string;
}

export interface BomSheetRow extends WorkbookRowBase {
  sheetType: 'bom';
  seqNo: number;
  functionText: string;
  partNo: string;
  partName: string;
  isSemiFinished: boolean;
  sapNo?: string;
  spec?: string;
  qty: number;
  unit: string;
  supplier?: string;
  itemCategory: string;
  unitPrice: number;
  amount: number;
  copperWeightPerUnit?: number;
  aluminumWeightPerUnit?: number;
  nonMetalCostPerUnit?: number;
}

export interface AssemblyPartRow extends WorkbookRowBase {
  sheetType: 'assembly_parts';
  seqNo: number;
  functionText: string;
  partNo: string;
  partName: string;
  isSemiFinished: boolean;
  wireNo?: string;
  pin?: string;
  optionCode?: string;
  spec?: string;
  qty: number;
  unit: string;
  supplier?: string;
  unitPrice?: number;
  remark?: string;
}

export interface SecondaryMaterialRow extends WorkbookRowBase {
  sheetType: 'secondary_material';
  componentDesc: string;
  partNo: string;
  partName: string;
  itemCategory: string;
  qty: number;
  unit: string;
  unitPrice: number;
  copperWeightPerUnit?: number;
  copperWeightTotal?: number;
  supplier?: string;
  origin?: string;
  sapNo?: string;
  remark?: string;
}

export interface KskBomRow extends WorkbookRowBase {
  sheetType: 'ksk_bom';
  assemblyNo?: string;
  partNo: string;
  partName: string;
  isSemiFinished?: boolean;
  sapNo?: string;
  wireNo?: string;
  qty: number;
  unit: string;
  supplier?: string;
  remark?: string;
}

export interface ChangeHistoryRow extends WorkbookRowBase {
  sheetType: 'change_history';
  seqNo: number;
  packageName: string;
  harnessPartNo: string;
  partName: string;
  changeDescription: string;
  changeDate: string;
  remark?: string;
}
