import { describe, expect, it } from 'vitest';
import {
  calculateDevPartLifecycleCost,
  calculateWireCostBreakdown,
  calculateWirePrice,
  calculateWirePricesBatch,
  checkConnectorPriceDiscrepancy,
  getConnectorFinalPrice,
  getConnectorPrice,
  getWirePricingSnapshot,
  queryPartPrice,
  updateWirePricingWithMetalPrice,
  wirePricingService,
} from '../pricing_engine';
import { buildPriceSourceCandidate, resolveMaterialPriceSource } from '@/types/project';
import type {
  ConnectorPricingRecord,
  DevPartPricingRecord,
  WirePricingRecord,
} from '@/types/pricing';
import type { BomItem } from '@/types/harness';

describe('pricing_engine', () => {
  it('checks connector discrepancy when supplier price is higher', () => {
    const connector: ConnectorPricingRecord = {
      id: 'c1',
      projectId: 'p1',
      partNo: '2281234-1',
      partName: 'Connector',
      supplier: 'S1',
      customerAgreedPrice: 10,
      supplierQuotedPrice: 12,
      finalNegotiatedPrice: 0,
      status: 'pending',
      createdBy: 'u1',
      approvedBy: null,
      disputeReason: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const discrepancy = checkConnectorPriceDiscrepancy(connector);

    expect(discrepancy).not.toBeNull();
    expect(discrepancy?.discrepancy).toBe(2);
    expect(getConnectorFinalPrice(connector)).toBe(10);
    expect(getConnectorPrice(connector)).toBe(10);
  });

  it('resolves connector price source with priority and fallback trace', () => {
    const resolved = resolveMaterialPriceSource([
      buildPriceSourceCandidate('final_negotiated', 0, 'missing_final'),
      buildPriceSourceCandidate('customer_agreed', 10, 'agreed'),
      buildPriceSourceCandidate('supplier_quoted', 12, 'quoted'),
    ]);

    expect(resolved.source).toBe('customer_agreed');
    expect(resolved.price).toBe(10);
    expect(resolved.priority).toBeGreaterThanOrEqual(0);
    expect(resolved.fallbackApplied).toBe(true);
    expect(resolved.candidates).toHaveLength(3);
  });

  it('calculates wire price with metal linkage', () => {
    const price = calculateWirePrice(
      {
        copperWeightG: 500,
        aluminumWeightG: 100,
        nonMetalCost: 5,
        processingFee: 10,
      },
      {
        copper: 70,
        aluminum: 20,
      }
    );

    expect(price).toBe(52);
  });

  it('returns wire cost breakdown with copper aluminum and non-metal parts', () => {
    const breakdown = calculateWireCostBreakdown(
      {
        copperWeightG: 500,
        aluminumWeightG: 100,
        nonMetalCost: 5,
        processingFee: 10,
      },
      {
        copper: 70,
        aluminum: 20,
      }
    );

    expect(breakdown).toEqual({
      copperCost: 35,
      aluminumCost: 2,
      nonMetalCost: 5,
      processingFee: 10,
      total: 52,
    });
  });

  it('supports batch wire price calculation', () => {
    const batch = calculateWirePricesBatch(
      [
        { copperWeightG: 500, aluminumWeightG: 0, nonMetalCost: 5, processingFee: 10 },
        { copperWeightG: 200, aluminumWeightG: 100, nonMetalCost: 3, processingFee: 2 },
      ],
      { copper: 70, aluminum: 20 }
    );

    expect(batch).toHaveLength(2);
    expect(batch[0]?.total).toBe(50);
    expect(batch[1]?.total).toBe(21);
  });

  it('creates wire pricing snapshot and updates wire record with new metal prices', () => {
    const snapshot = getWirePricingSnapshot(
      {
        copperWeightG: 500,
        aluminumWeightG: 100,
        nonMetalCost: 5,
        processingFee: 10,
      },
      {
        copper: 70,
        aluminum: 20,
      }
    );

    expect(snapshot).toEqual({
      unitPrice: 52,
      copperCost: 35,
      aluminumCost: 2,
      nonMetalCost: 5,
      processingFee: 10,
    });

    const record: WirePricingRecord = {
      id: 'w1',
      projectId: 'p1',
      partNo: 'wire-1',
      partName: 'Wire',
      supplier: 'S1',
      wireSize: '50',
      copperWeightG: 500,
      aluminumWeightG: 100,
      nonMetalCost: 5,
      copperBasePrice: 0,
      aluminumBasePrice: 0,
      processingFee: 10,
      calculatedPrice: 0,
      validFrom: new Date().toISOString(),
      validTo: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updated = updateWirePricingWithMetalPrice(record, { copper: 70, aluminum: 20 });
    expect(updated.copperBasePrice).toBe(70);
    expect(updated.aluminumBasePrice).toBe(20);
    expect(updated.calculatedPrice).toBe(52);
  });

  it('exposes wire pricing service for single and batch calculation', () => {
    const single = {
      copperWeightG: 500,
      aluminumWeightG: 100,
      nonMetalCost: 5,
      processingFee: 10,
    };
    const batch = [single, { copperWeightG: 200, aluminumWeightG: 0, nonMetalCost: 1, processingFee: 4 }];

    const singleResult = wirePricingService.calculate(single, { copper: 70, aluminum: 20 });
    const batchResult = wirePricingService.calculateBatch(batch, { copper: 70, aluminum: 20 });

    expect(singleResult.price).toBe(52);
    expect(singleResult.breakdown.total).toBe(52);
    expect(batchResult).toHaveLength(2);
    expect(batchResult[1]?.price).toBe(19);
  });

  it('returns traceable current price query result', () => {
    const connector: ConnectorPricingRecord = {
      id: 'c2',
      projectId: 'p1',
      partNo: '282000-1',
      partName: 'Connector 2',
      supplier: 'S2',
      customerAgreedPrice: 8,
      supplierQuotedPrice: 12,
      finalNegotiatedPrice: 9,
      status: 'approved',
      createdBy: 'u1',
      approvedBy: 'mgr',
      disputeReason: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const bomItem: BomItem = {
      partNo: '282000-1',
      partName: 'Connector 2',
      itemCategory: 'connector',
      qty: 1,
      unit: 'PCS',
      unitPrice: 7,
      amount: 7,
    };

    const result = queryPartPrice(
      bomItem,
      {
        projectId: 'p1',
        scenarioId: 's1',
        metalPrices: { copper: 70, aluminum: 20 },
        lifecycleVolumes: new Map(),
      },
      {
        connectors: new Map([[connector.partNo, connector]]),
        wires: new Map(),
        devParts: new Map(),
      }
    );

    expect(result.currentPrice).toBe(9);
    expect(result.priceSource).toBe('final_negotiated');
    expect(result.sourceTrace).toHaveLength(3);
    expect(result.fallbackApplied).toBe(false);
    expect(result.resolvedSource.source).toBe('final_negotiated');
  });

  it('calculates lifecycle dev-part amortization correctly', () => {
    const part: DevPartPricingRecord = {
      id: 'd1',
      projectId: 'p1',
      partNo: 'P1-HB-01',
      partName: 'Dev part',
      category: 'plastic',
      molds: [
        {
          id: 'm1',
          devPartPricingId: 'd1',
          moldType: 'mass',
          moldName: 'Mold',
          moldCost: 30000,
          isAmortized: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      amortizationQty: 15000,
      unitPriceWithAmortization: 0,
      unitPriceAfterAmortization: 0.8,
      lifecycleTotalQty: 600000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const lifecycle = calculateDevPartLifecycleCost(part, 600000);

    expect(lifecycle.breakdown.preAmortizationQty).toBe(15000);
    expect(lifecycle.breakdown.postAmortizationQty).toBe(585000);
    expect(lifecycle.totalCost).toBe(510000);
  });
});
