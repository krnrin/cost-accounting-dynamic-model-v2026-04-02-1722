import { describe, it, expect } from 'vitest';
import {
  buildCostDAG, computeAll, recomputeFrom, paramChangeToNodes,
  CostParams, CostNodeId
} from '../incremental_calc';

const BASE_PARAMS: CostParams = {
  rawMaterialCost: 200,
  processHours: 0.15,
  laborRate: 35,
  mfgRate: 46.69,
  wasteRate: 0.01,
  mgmtRate: 0.06,
  profitRate: 0.056627,
  packTotal: 5,
  freightTotal: 3,
};

describe('Incremental Calc Engine', () => {
  describe('buildCostDAG', () => {
    it('should create DAG with 10 nodes', () => {
      const dag = buildCostDAG();
      expect(dag.size).toBe(10);
    });
    
    it('should have correct dependencies for deliveredPrice', () => {
      const dag = buildCostDAG();
      const node = dag.get('deliveredPrice')!;
      expect(node.dependencies).toEqual(['exFactoryPrice', 'packSubtotal', 'freightSubtotal']);
    });
    
    it('material, labor, manufacturing, pack, freight should be root nodes (no deps)', () => {
      const dag = buildCostDAG();
      expect(dag.get('material')!.dependencies).toEqual([]);
      expect(dag.get('labor')!.dependencies).toEqual([]);
      expect(dag.get('manufacturing')!.dependencies).toEqual([]);
      expect(dag.get('packSubtotal')!.dependencies).toEqual([]);
      expect(dag.get('freightSubtotal')!.dependencies).toEqual([]);
    });
  });

  describe('computeAll', () => {
    it('should compute all nodes correctly', () => {
      const values = computeAll(BASE_PARAMS);
      expect(values.material).toBe(200);
      expect(values.waste).toBeCloseTo(2, 2);
      expect(values.labor).toBeCloseTo(5.25, 2);
      expect(values.manufacturing).toBeCloseTo(7.0035, 4);
      expect(values.packSubtotal).toBe(5);
      expect(values.freightSubtotal).toBe(3);
      expect(values.deliveredPrice).toBeGreaterThan(0);
      // deliveredPrice = exFactory + pack + freight
      expect(values.deliveredPrice).toBeCloseTo(values.exFactoryPrice + 5 + 3, 4);
    });

    it('should match manual calculation', () => {
      const values = computeAll(BASE_PARAMS);
      const mat = 200;
      const waste = mat * 0.01;
      const labor = 0.15 * 35;
      const mfg = 0.15 * 46.69;
      const subtotal = mat + waste + labor + mfg;
      const mgmt = subtotal * 0.06;
      const profit = (subtotal + mgmt) * 0.056627;
      const exFactory = subtotal + mgmt + profit;
      const delivered = exFactory + 5 + 3;
      
      expect(values.exFactoryPrice).toBeCloseTo(exFactory, 4);
      expect(values.deliveredPrice).toBeCloseTo(delivered, 4);
    });
  });

  describe('recomputeFrom', () => {
    it('changing material should only recompute material→waste→mgmt→profit→exFactory→delivered', () => {
      const prevValues = computeAll(BASE_PARAMS);
      const newParams = { ...BASE_PARAMS, rawMaterialCost: 250 };
      
      const { values, recomputed } = recomputeFrom(
        prevValues,
        new Set<CostNodeId>(['material']),
        newParams
      );
      
      // material changed
      expect(values.material).toBe(250);
      // waste should change (depends on material)
      expect(values.waste).toBeCloseTo(250 * 0.01, 4);
      // labor should NOT change
      expect(values.labor).toBe(prevValues.labor);
      // manufacturing should NOT change
      expect(values.manufacturing).toBe(prevValues.manufacturing);
      // pack/freight should NOT change
      expect(values.packSubtotal).toBe(prevValues.packSubtotal);
      expect(values.freightSubtotal).toBe(prevValues.freightSubtotal);
      
      // Verify recomputed list does NOT include labor, manufacturing, pack, freight
      expect(recomputed).not.toContain('labor');
      expect(recomputed).not.toContain('manufacturing');
      expect(recomputed).not.toContain('packSubtotal');
      expect(recomputed).not.toContain('freightSubtotal');
      
      // Should include these
      expect(recomputed).toContain('material');
      expect(recomputed).toContain('waste');
      expect(recomputed).toContain('mgmtFee');
      expect(recomputed).toContain('profit');
      expect(recomputed).toContain('exFactoryPrice');
      expect(recomputed).toContain('deliveredPrice');
    });

    it('changing laborRate should only recompute labor→mgmt→profit→exFactory→delivered', () => {
      const prevValues = computeAll(BASE_PARAMS);
      const newParams = { ...BASE_PARAMS, laborRate: 40 };
      
      const { values, recomputed } = recomputeFrom(
        prevValues,
        new Set<CostNodeId>(['labor']),
        newParams
      );
      
      expect(values.labor).toBeCloseTo(0.15 * 40, 4);
      expect(values.material).toBe(prevValues.material);
      expect(values.waste).toBe(prevValues.waste);
      
      expect(recomputed).toContain('labor');
      expect(recomputed).not.toContain('material');
      expect(recomputed).not.toContain('waste');
      expect(recomputed).not.toContain('packSubtotal');
    });
    
    it('changing packTotal should only recompute packSubtotal→delivered', () => {
      const prevValues = computeAll(BASE_PARAMS);
      const newParams = { ...BASE_PARAMS, packTotal: 10 };
      
      const { values, recomputed } = recomputeFrom(
        prevValues,
        new Set<CostNodeId>(['packSubtotal']),
        newParams
      );
      
      expect(values.packSubtotal).toBe(10);
      expect(values.exFactoryPrice).toBe(prevValues.exFactoryPrice);
      expect(recomputed).toEqual(['packSubtotal', 'deliveredPrice']);
    });
    
    it('incremental result should match full recomputation', () => {
      const prevValues = computeAll(BASE_PARAMS);
      const newParams = { ...BASE_PARAMS, rawMaterialCost: 300, laborRate: 40 };
      
      const { values: incValues } = recomputeFrom(
        prevValues,
        new Set<CostNodeId>(['material', 'labor']),
        newParams
      );
      
      const fullValues = computeAll(newParams);
      
      // All values should match
      const nodeIds: CostNodeId[] = [
        'material', 'waste', 'labor', 'manufacturing',
        'mgmtFee', 'profit', 'exFactoryPrice',
        'packSubtotal', 'freightSubtotal', 'deliveredPrice'
      ];
      for (const id of nodeIds) {
        expect(incValues[id]).toBeCloseTo(fullValues[id], 6);
      }
    });
  });

  describe('paramChangeToNodes', () => {
    it('should map copperPrice to material', () => {
      expect(paramChangeToNodes('copperPrice')).toEqual(['material']);
    });
    it('should map processHours to labor + manufacturing', () => {
      expect(paramChangeToNodes('processHours')).toEqual(['labor', 'manufacturing']);
    });
    it('should return empty for unknown param', () => {
      expect(paramChangeToNodes('unknown')).toEqual([]);
    });
  });
});
