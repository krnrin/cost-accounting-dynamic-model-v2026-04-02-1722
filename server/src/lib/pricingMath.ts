export type MetalBasePrice = {
  copperBasePrice: number;
  aluminumBasePrice: number;
};

export type WirePriceInput = MetalBasePrice & {
  copperWeightG: number;
  aluminumWeightG: number;
  nonMetalCost: number;
  processingFee: number;
};

export function calculateWirePrice(input: WirePriceInput): number {
  const copperCost = (input.copperWeightG * input.copperBasePrice) / 1000;
  const aluminumCost = (input.aluminumWeightG * input.aluminumBasePrice) / 1000;
  return roundMoney(copperCost + aluminumCost + input.nonMetalCost + input.processingFee);
}

export function calculateMoldTotalCost(molds: Array<{ moldCost: number }>): number {
  return roundMoney(molds.reduce((sum, mold) => sum + mold.moldCost, 0));
}

export function calculateDevPartAmortizedPrice(
  unitPriceAfterAmortization: number,
  totalMoldCost: number,
  amortizationQty: number
): number {
  if (amortizationQty <= 0) {
    return roundMoney(unitPriceAfterAmortization);
  }
  return roundMoney(unitPriceAfterAmortization + totalMoldCost / amortizationQty);
}

export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(4));
}
