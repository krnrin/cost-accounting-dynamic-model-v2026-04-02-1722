export type ConnectorPricingStatus = 'pending' | 'agreed' | 'dispute' | 'approved';

export interface ConnectorPricingRecord {
  id: string;
  projectId: string;
  partNo: string;
  partName: string;
  supplier: string;
  customerAgreedPrice: number;
  supplierQuotedPrice: number;
  finalNegotiatedPrice: number;
  status: ConnectorPricingStatus;
  disputeReason?: string | null;
  createdBy?: string | null;
  approvedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectorPricingPayload {
  partNo: string;
  partName: string;
  supplier: string;
  customerAgreedPrice: number;
  supplierQuotedPrice: number;
  finalNegotiatedPrice: number;
  status: ConnectorPricingStatus;
  disputeReason?: string;
  approvedBy?: string;
}

export interface WirePricingRecord {
  id: string;
  projectId: string;
  partNo: string;
  partName: string;
  supplier: string;
  wireSize: string;
  copperWeightG: number;
  aluminumWeightG: number;
  nonMetalCost: number;
  copperBasePrice: number;
  aluminumBasePrice: number;
  processingFee: number;
  calculatedPrice: number;
  validFrom: string;
  validTo?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WirePricingPayload {
  partNo: string;
  partName: string;
  supplier: string;
  wireSize: string;
  copperWeightG: number;
  aluminumWeightG: number;
  nonMetalCost: number;
  copperBasePrice: number;
  aluminumBasePrice: number;
  processingFee: number;
  validFrom?: string;
  validTo?: string | null;
}

export type DevPartCategory = 'plastic' | 'metal' | 'rubber' | 'other';

export interface MoldInfo {
  id: string;
  devPartPricingId: string;
  moldType: 'sample' | 'mass';
  moldName: string;
  moldCost: number;
  isAmortized: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DevPartPricingRecord {
  id: string;
  projectId: string;
  partNo: string;
  partName: string;
  category: DevPartCategory;
  molds: MoldInfo[];
  amortizationQty: number;
  unitPriceWithAmortization: number;
  unitPriceAfterAmortization: number;
  lifecycleTotalQty: number;
  createdAt: string;
  updatedAt: string;
}

export interface DevPartPricingPayload {
  partNo: string;
  partName: string;
  category: DevPartCategory;
  amortizationQty: number;
  unitPriceAfterAmortization: number;
  lifecycleTotalQty: number;
}

export interface DevPartMoldPayload {
  moldType: 'sample' | 'mass';
  moldName: string;
  moldCost: number;
  isAmortized?: boolean;
}

export interface AuxiliaryPartRecord {
  id: string;
  projectId: string;
  partNo: string;
  partName: string;
  supplier: string;
  unitPrice: number;
  createdAt: string;
  updatedAt: string;
}

export interface AuxiliaryPartPayload {
  partNo: string;
  partName: string;
  supplier: string;
  unitPrice: number;
}

export type PriceDiscrepancyStatus = 'open' | 'escalated' | 'resolved' | 'accepted';
export type PricePartCategory = 'connector' | 'wire' | 'dev_part' | 'auxiliary' | 'other';
export type DiscrepancyResolutionType = 'harness_price_up' | 'supplier_price_down' | 'accepted_loss';

export interface PriceDiscrepancyRecord {
  id: string;
  projectId: string;
  scenarioId?: string | null;
  harnessId?: string | null;
  partNo: string;
  partName: string;
  partCategory: PricePartCategory;
  referencePrice: number;
  actualPrice: number;
  discrepancy: number;
  discrepancyRate: number;
  status: PriceDiscrepancyStatus;
  resolutionType?: DiscrepancyResolutionType | null;
  resolutionNote?: string | null;
  assignedTo?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PriceDiscrepancyPayload {
  harnessId?: string;
  partNo: string;
  partName: string;
  partCategory: PricePartCategory;
  referencePrice: number;
  actualPrice: number;
  status?: PriceDiscrepancyStatus;
  resolutionType?: DiscrepancyResolutionType;
  resolutionNote?: string;
  assignedTo?: string;
}

export interface CategoryPriceSummary {
  totalQty: number;
  totalAmount: number;
  avgUnitPrice: number;
}

export interface DevPartPriceSummary extends CategoryPriceSummary {
  preAmortizationQty: number;
  preAmortizationAmount: number;
  postAmortizationQty: number;
  postAmortizationAmount: number;
  moldTotalCost: number;
}

export interface LifecyclePriceBreakdown {
  projectId: string;
  scenarioId: string;
  byCategory: {
    connectors: CategoryPriceSummary;
    wires: CategoryPriceSummary;
    devParts: DevPartPriceSummary;
    auxiliary: CategoryPriceSummary;
    others: CategoryPriceSummary;
  };
  totalMaterialCost: number;
  totalMaterialCostWithAmortization: number;
  actualLifecycleMaterialCost: number;
  profitImpact: number;
}

export interface PriceQueryResult {
  partNo: string;
  partName: string;
  category: PricePartCategory;
  currentPrice: number;
  priceSource: string;
  validFrom: string;
  validTo: string;
  priceBreakdown?: {
    basePrice: number;
    processingFee: number;
    amortizationShare: number;
    metalCost: number;
  };
}
