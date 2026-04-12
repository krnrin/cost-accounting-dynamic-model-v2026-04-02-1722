import type {
  AuxiliaryPartRecord,
  ConnectorPricingRecord,
  DevPartPricingRecord,
  DevPartPriceSummary,
  LifecyclePriceBreakdown,
  PriceDiscrepancyRecord,
  PriceQueryResult,
  WirePricingRecord,
} from '@/types/pricing';
import type { BomItem } from '@/types/harness';

export interface MetalPrices {
  copper: number;
  aluminum: number;
}

export function checkConnectorPriceDiscrepancy(
  connector: ConnectorPricingRecord
): Omit<PriceDiscrepancyRecord, 'id' | 'projectId' | 'scenarioId' | 'createdAt' | 'updatedAt'> | null {
  if (connector.customerAgreedPrice <= 0 || connector.supplierQuotedPrice <= connector.customerAgreedPrice) {
    return null;
  }
  const discrepancy = roundMoney(connector.supplierQuotedPrice - connector.customerAgreedPrice);
  const discrepancyRate = connector.customerAgreedPrice === 0 ? 0 : roundMoney(discrepancy / connector.customerAgreedPrice);
  return {
    harnessId: null,
    partNo: connector.partNo,
    partName: connector.partName,
    partCategory: 'connector',
    referencePrice: connector.customerAgreedPrice,
    actualPrice: connector.supplierQuotedPrice,
    discrepancy,
    discrepancyRate,
    status: 'open',
    resolutionType: null,
    resolutionNote: null,
    assignedTo: null,
  };
}

export function getConnectorFinalPrice(connector: ConnectorPricingRecord): number {
  if (connector.finalNegotiatedPrice > 0) {
    return connector.finalNegotiatedPrice;
  }
  if (connector.customerAgreedPrice > 0) {
    return connector.customerAgreedPrice;
  }
  return connector.supplierQuotedPrice;
}

export function calculateWirePrice(
  wire: Pick<WirePricingRecord, 'copperWeightG' | 'aluminumWeightG' | 'nonMetalCost' | 'processingFee'>,
  metalPrices: MetalPrices
): number {
  const copperCost = (wire.copperWeightG * metalPrices.copper) / 1000;
  const aluminumCost = (wire.aluminumWeightG * metalPrices.aluminum) / 1000;
  return roundMoney(copperCost + aluminumCost + wire.nonMetalCost + wire.processingFee);
}

export function updateWirePricingWithMetalPrice(
  wire: WirePricingRecord,
  metalPrices: MetalPrices
): WirePricingRecord {
  return {
    ...wire,
    copperBasePrice: metalPrices.copper,
    aluminumBasePrice: metalPrices.aluminum,
    calculatedPrice: calculateWirePrice(wire, metalPrices),
  };
}

export function parseDevPartNumber(partNo: string): { projectCode: string; type: string; seq: string } | null {
  const match = partNo.match(/^([A-Z0-9]+)-(HB|ZJ|XJ|OTHER)-(\d+)$/i);
  if (!match) return null;
  return {
    projectCode: match[1] ?? '',
    type: (match[2] ?? '').toUpperCase(),
    seq: match[3] ?? '',
  };
}

export function isDevPart(partNo: string): boolean {
  return parseDevPartNumber(partNo) !== null;
}

export function calculateTotalMoldCost(molds: Array<{ moldCost: number }>): number {
  return roundMoney(molds.reduce((sum, mold) => sum + mold.moldCost, 0));
}

export function calculateDevPartPriceWithAmortization(
  unitPriceAfterAmortization: number,
  totalMoldCost: number,
  amortizationQty: number
): number {
  if (amortizationQty <= 0) {
    return roundMoney(unitPriceAfterAmortization);
  }
  return roundMoney(unitPriceAfterAmortization + totalMoldCost / amortizationQty);
}

export function calculateDevPartLifecycleCost(
  devPart: DevPartPricingRecord,
  lifecycleTotalQty: number
): { totalCost: number; avgUnitCost: number; breakdown: DevPartPriceSummary } {
  const moldTotalCost = calculateTotalMoldCost(devPart.molds);
  const amortizedPrice = calculateDevPartPriceWithAmortization(
    devPart.unitPriceAfterAmortization,
    moldTotalCost,
    devPart.amortizationQty
  );
  const preAmortizationQty = Math.min(devPart.amortizationQty, lifecycleTotalQty);
  const postAmortizationQty = Math.max(0, lifecycleTotalQty - preAmortizationQty);
  const preAmortizationAmount = roundMoney(preAmortizationQty * amortizedPrice);
  const postAmortizationAmount = roundMoney(postAmortizationQty * devPart.unitPriceAfterAmortization);
  const totalCost = roundMoney(preAmortizationAmount + postAmortizationAmount);
  const avgUnitCost = lifecycleTotalQty > 0 ? roundMoney(totalCost / lifecycleTotalQty) : 0;

  return {
    totalCost,
    avgUnitCost,
    breakdown: {
      totalQty: lifecycleTotalQty,
      totalAmount: totalCost,
      avgUnitPrice: avgUnitCost,
      preAmortizationQty,
      preAmortizationAmount,
      postAmortizationQty,
      postAmortizationAmount,
      moldTotalCost,
    },
  };
}

export function calculateDevPartFinanceAlgorithm(
  devPart: DevPartPricingRecord,
  lifecycleTotalQty: number
): { totalCost: number; avgUnitCost: number } {
  const moldTotalCost = calculateTotalMoldCost(devPart.molds);
  const amortizedPrice = calculateDevPartPriceWithAmortization(
    devPart.unitPriceAfterAmortization,
    moldTotalCost,
    devPart.amortizationQty
  );
  return {
    totalCost: roundMoney(lifecycleTotalQty * amortizedPrice),
    avgUnitCost: amortizedPrice,
  };
}

export interface PricingContext {
  projectId: string;
  scenarioId: string;
  metalPrices: MetalPrices;
  lifecycleVolumes: Map<string, number>;
}

export function queryPartPrice(
  bomItem: BomItem,
  context: PricingContext,
  pricingData: {
    connectors: Map<string, ConnectorPricingRecord>;
    wires: Map<string, WirePricingRecord>;
    devParts: Map<string, DevPartPricingRecord>;
    auxiliary?: Map<string, AuxiliaryPartRecord>;
  }
): PriceQueryResult {
  const partNo = bomItem.partNo;
  const lifecycleQty = context.lifecycleVolumes.get(partNo) ?? 0;

  if (isDevPart(partNo) && pricingData.devParts.has(partNo)) {
    const devPart = pricingData.devParts.get(partNo)!;
    const lifecycleCost = calculateDevPartLifecycleCost(devPart, lifecycleQty);
    return {
      partNo,
      partName: bomItem.partName,
      category: 'dev_part',
      currentPrice: lifecycleCost.avgUnitCost,
      priceSource: 'lifecycle_amortized',
      validFrom: devPart.createdAt,
      validTo: '',
      priceBreakdown: {
        basePrice: devPart.unitPriceAfterAmortization,
        processingFee: 0,
        amortizationShare: lifecycleQty > 0 ? roundMoney(lifecycleCost.breakdown.moldTotalCost / lifecycleQty) : 0,
        metalCost: 0,
      },
    };
  }

  if (bomItem.itemCategory === 'wire' && pricingData.wires.has(partNo)) {
    const wire = pricingData.wires.get(partNo)!;
    const updatedWire = updateWirePricingWithMetalPrice(wire, context.metalPrices);
    return {
      partNo,
      partName: bomItem.partName,
      category: 'wire',
      currentPrice: updatedWire.calculatedPrice,
      priceSource: 'metal_linked',
      validFrom: updatedWire.validFrom,
      validTo: updatedWire.validTo ?? '',
      priceBreakdown: {
        basePrice: 0,
        processingFee: updatedWire.processingFee,
        amortizationShare: 0,
        metalCost: roundMoney(updatedWire.calculatedPrice - updatedWire.processingFee - updatedWire.nonMetalCost),
      },
    };
  }

  if (pricingData.connectors.has(partNo)) {
    const connector = pricingData.connectors.get(partNo)!;
    return {
      partNo,
      partName: bomItem.partName,
      category: 'connector',
      currentPrice: getConnectorFinalPrice(connector),
      priceSource: connector.finalNegotiatedPrice > 0 ? 'negotiated' : 'agreed',
      validFrom: connector.createdAt,
      validTo: '',
    };
  }

  if (pricingData.auxiliary?.has(partNo)) {
    const auxiliary = pricingData.auxiliary.get(partNo)!;
    return {
      partNo,
      partName: bomItem.partName,
      category: 'auxiliary',
      currentPrice: auxiliary.unitPrice,
      priceSource: 'auxiliary_purchase',
      validFrom: auxiliary.updatedAt,
      validTo: '',
    };
  }

  return {
    partNo,
    partName: bomItem.partName,
    category: 'other',
    currentPrice: bomItem.unitPrice || 0,
    priceSource: 'bom',
    validFrom: '',
    validTo: '',
  };
}

export function calculateLifecyclePriceBreakdown(
  bomItems: BomItem[],
  context: PricingContext,
  pricingData: {
    connectors: Map<string, ConnectorPricingRecord>;
    wires: Map<string, WirePricingRecord>;
    devParts: Map<string, DevPartPricingRecord>;
    auxiliary?: Map<string, AuxiliaryPartRecord>;
  }
): LifecyclePriceBreakdown {
  const result: LifecyclePriceBreakdown = {
    projectId: context.projectId,
    scenarioId: context.scenarioId,
    byCategory: {
      connectors: { totalQty: 0, totalAmount: 0, avgUnitPrice: 0 },
      wires: { totalQty: 0, totalAmount: 0, avgUnitPrice: 0 },
      devParts: {
        totalQty: 0,
        totalAmount: 0,
        avgUnitPrice: 0,
        preAmortizationQty: 0,
        preAmortizationAmount: 0,
        postAmortizationQty: 0,
        postAmortizationAmount: 0,
        moldTotalCost: 0,
      },
      auxiliary: { totalQty: 0, totalAmount: 0, avgUnitPrice: 0 },
      others: { totalQty: 0, totalAmount: 0, avgUnitPrice: 0 },
    },
    totalMaterialCost: 0,
    totalMaterialCostWithAmortization: 0,
    actualLifecycleMaterialCost: 0,
    profitImpact: 0,
  };

  for (const item of bomItems) {
    const lifecycleQty = context.lifecycleVolumes.get(item.partNo) ?? 0;
    if (lifecycleQty <= 0) continue;
    const priceInfo = queryPartPrice(item, context, pricingData);

    if (priceInfo.category === 'connector') {
      result.byCategory.connectors.totalQty += lifecycleQty;
      result.byCategory.connectors.totalAmount = roundMoney(
        result.byCategory.connectors.totalAmount + lifecycleQty * priceInfo.currentPrice
      );
      continue;
    }

    if (priceInfo.category === 'wire') {
      result.byCategory.wires.totalQty += lifecycleQty;
      result.byCategory.wires.totalAmount = roundMoney(
        result.byCategory.wires.totalAmount + lifecycleQty * priceInfo.currentPrice
      );
      continue;
    }

    if (priceInfo.category === 'dev_part') {
      const devPart = pricingData.devParts.get(item.partNo)!;
      const lifecycleCost = calculateDevPartLifecycleCost(devPart, lifecycleQty);
      const financeCost = calculateDevPartFinanceAlgorithm(devPart, lifecycleQty);

      result.byCategory.devParts.totalQty += lifecycleQty;
      result.byCategory.devParts.totalAmount = roundMoney(
        result.byCategory.devParts.totalAmount + lifecycleCost.totalCost
      );
      result.byCategory.devParts.preAmortizationQty += lifecycleCost.breakdown.preAmortizationQty;
      result.byCategory.devParts.preAmortizationAmount = roundMoney(
        result.byCategory.devParts.preAmortizationAmount + lifecycleCost.breakdown.preAmortizationAmount
      );
      result.byCategory.devParts.postAmortizationQty += lifecycleCost.breakdown.postAmortizationQty;
      result.byCategory.devParts.postAmortizationAmount = roundMoney(
        result.byCategory.devParts.postAmortizationAmount + lifecycleCost.breakdown.postAmortizationAmount
      );
      result.byCategory.devParts.moldTotalCost = roundMoney(
        result.byCategory.devParts.moldTotalCost + lifecycleCost.breakdown.moldTotalCost
      );
      result.totalMaterialCostWithAmortization = roundMoney(
        result.totalMaterialCostWithAmortization + financeCost.totalCost
      );
      continue;
    }

    if (priceInfo.category === 'auxiliary') {
      result.byCategory.auxiliary.totalQty += lifecycleQty;
      result.byCategory.auxiliary.totalAmount = roundMoney(
        result.byCategory.auxiliary.totalAmount + lifecycleQty * priceInfo.currentPrice
      );
      continue;
    }

    result.byCategory.others.totalQty += lifecycleQty;
    result.byCategory.others.totalAmount = roundMoney(
      result.byCategory.others.totalAmount + lifecycleQty * priceInfo.currentPrice
    );
  }

  for (const key of Object.keys(result.byCategory) as Array<keyof LifecyclePriceBreakdown['byCategory']>) {
    const summary = result.byCategory[key];
    summary.avgUnitPrice = summary.totalQty > 0 ? roundMoney(summary.totalAmount / summary.totalQty) : 0;
  }

  result.totalMaterialCost = roundMoney(
    result.byCategory.connectors.totalAmount +
    result.byCategory.wires.totalAmount +
    result.byCategory.devParts.totalAmount +
    result.byCategory.auxiliary.totalAmount +
    result.byCategory.others.totalAmount
  );

  result.totalMaterialCostWithAmortization = roundMoney(
    result.totalMaterialCostWithAmortization +
    result.byCategory.connectors.totalAmount +
    result.byCategory.wires.totalAmount +
    result.byCategory.auxiliary.totalAmount +
    result.byCategory.others.totalAmount
  );
  result.actualLifecycleMaterialCost = result.totalMaterialCost;
  result.profitImpact = roundMoney(result.actualLifecycleMaterialCost - result.totalMaterialCostWithAmortization);
  return result;
}

export function scanPriceDiscrepancies(
  bomItems: BomItem[],
  pricingData: {
    connectors: Map<string, ConnectorPricingRecord>;
  }
): Array<Omit<PriceDiscrepancyRecord, 'id' | 'projectId' | 'scenarioId' | 'createdAt' | 'updatedAt'>> {
  const discrepancies: Array<Omit<PriceDiscrepancyRecord, 'id' | 'projectId' | 'scenarioId' | 'createdAt' | 'updatedAt'>> = [];
  for (const item of bomItems) {
    const connector = pricingData.connectors.get(item.partNo);
    if (!connector) continue;
    const discrepancy = checkConnectorPriceDiscrepancy(connector);
    if (discrepancy) {
      discrepancies.push(discrepancy);
    }
  }
  return discrepancies;
}

function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(4));
}
