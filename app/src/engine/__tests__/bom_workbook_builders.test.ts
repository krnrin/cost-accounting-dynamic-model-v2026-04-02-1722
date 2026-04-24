import { describe, expect, it } from 'vitest';
import type { BomItem, WireItem } from '@/types/harness';
import {
  buildAssemblyPartRows,
  buildBomSheetRows,
  buildKskBomRows,
  buildSecondaryMaterialRows,
  bomRowsToSheetData,
  bomSheetDataToBomItems,
} from '@/engine/bom_workbook_builders';

describe('bom_workbook_builders', () => {
  const connector: BomItem = {
    partNo: 'CON-001',
    partName: 'Connector',
    itemCategory: 'connector',
    spec: '2P',
    unit: 'PCS',
    qty: 2,
    unitPrice: 10,
    amount: 20,
    functionText: 'FG1',
    supplier: 'S1',
    sapNo: 'SAP-1',
    isSemiFinished: false,
  };

  const wire: WireItem = {
    partNo: 'WIRE-001',
    partName: 'Wire',
    itemCategory: 'wire',
    spec: '0.35',
    unit: 'M',
    qty: 1.2,
    unitPrice: 5,
    amount: 6,
    functionText: 'FG1',
    supplier: 'S2',
    sapNo: 'SAP-2',
    isSemiFinished: false,
    copperWeightPerUnit: 0.12,
    aluminumWeightPerUnit: 0,
    nonMetalCostPerUnit: 0.03,
  };

  it('builds BOM rows with stable row keys', () => {
    const rows = buildBomSheetRows('H1', 'Harness 1', [connector, wire]);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.rowKey).toBe('H1::bom::1::CON-001');
    expect(rows[1]?.rowKey).toBe('H1::bom::2::WIRE-001');
    expect(rows[1]?.copperWeightPerUnit).toBeCloseTo(0.12, 6);
  });

  it('builds derived rows and keeps sourceBomRowKey', () => {
    const assembly = buildAssemblyPartRows('H1', 'Harness 1', [connector, wire]);
    const ksk = buildKskBomRows('H1', 'Harness 1', [connector, wire]);

    expect(assembly[0]?.sourceBomRowKey).toBe('H1::bom::1::CON-001');
    expect(ksk[1]?.sourceBomRowKey).toBe('H1::bom::2::WIRE-001');
  });

  it('filters wire rows out of secondary material sheet', () => {
    const secondary = buildSecondaryMaterialRows('H1', 'Harness 1', [connector, wire]);
    expect(secondary).toHaveLength(1);
    expect(secondary[0]?.partNo).toBe('CON-001');
    expect(secondary[0]?.sourceBomRowKey).toBe('H1::bom::1::CON-001');
  });

  it('returns empty rows when BOM input is missing', () => {
    expect(buildBomSheetRows('H1', 'Harness 1', undefined)).toEqual([]);
    expect(buildAssemblyPartRows('H1', 'Harness 1', null)).toEqual([]);
    expect(buildSecondaryMaterialRows('H1', 'Harness 1', undefined)).toEqual([]);
    expect(buildKskBomRows('H1', 'Harness 1', null)).toEqual([]);
  });

  it('round-trips wire metal fields through BOM sheet data', () => {
    const rows = buildBomSheetRows('H1', 'Harness 1', [wire]);
    const sheetData = bomRowsToSheetData(rows);
    const restored = bomSheetDataToBomItems(sheetData);

    expect(restored).toHaveLength(1);
    expect(restored[0]?.itemCategory).toBe('wire');
    expect((restored[0] as WireItem).copperWeightPerUnit).toBeCloseTo(0.12, 6);
    expect((restored[0] as WireItem).aluminumWeightPerUnit).toBeCloseTo(0, 6);
    expect((restored[0] as WireItem).nonMetalCostPerUnit).toBeCloseTo(0.03, 6);
  });
});
