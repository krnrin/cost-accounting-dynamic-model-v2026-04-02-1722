import { describe, expect, it } from 'vitest';
import {
  calculateDevPartLifecycleCost,
  calculateWirePrice,
  checkConnectorPriceDiscrepancy,
  getConnectorFinalPrice,
} from '../pricing_engine';
import type { ConnectorPricingRecord, DevPartPricingRecord } from '@/types/pricing';

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
