import type {
  MaterialPriceSource,
  PriceSourceCandidate,
  ResolvedPriceSource,
} from './project';

export type ConnectorPricingStatus = 'pending' | 'agreed' | 'dispute' | 'approved';

export { type MaterialPriceSource, type PriceSourceCandidate, type ResolvedPriceSource };

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

export interface WireCostBreakdown {
  copperCost: number;
  aluminumCost: number;
  nonMetalCost: number;
  processingFee: number;
  total: number;
}

export interface WirePricingInput {
  copperWeightG: number;
  aluminumWeightG: number;
  nonMetalCost: number;
  processingFee: number;
}

export interface PriceQueryResult {
  partNo: string;
  partName: string;
  category: PricePartCategory;
  currentPrice: number;
  priceSource: MaterialPriceSource;
  sourcePriority: number;
  sourceTrace: PriceSourceCandidate[];
  fallbackApplied: boolean;
  resolvedSource: ResolvedPriceSource;
  validFrom: string;
  validTo: string;
  priceBreakdown?: {
    basePrice: number;
    processingFee: number;
    amortizationShare: number;
    metalCost: number;
  };
}

export type DevPartPriceStage = 'during_recovery' | 'after_recovery' | 'no_recovery_binding';

export interface ResolvedDevPartPrice {
  partNo: string;
  partName: string;
  currentEffectivePrice: number;
  priceDuringRecovery: number;
  priceAfterRecovery: number;
  recoveryBound: boolean;
  fullyRecovered: boolean;
  stage: DevPartPriceStage;
  switchSuggested: boolean;
}

export interface DevPartRecoveryState {
  fullyRecovered: boolean;
  recoveryBound?: boolean;
}

export interface DevPartPriceMode {
  isSynchronousDevPart: boolean;
  hasAmortization: boolean;
  hasMolds: boolean;
}

export interface DevPartPriceTimeline {
  priceDuringRecovery: number;
  priceAfterRecovery: number;
  currentEffectivePrice: number;
  fullyRecovered: boolean;
}

export interface DevPartRecoveryBinding {
  recoveryBound: boolean;
  fullyRecovered: boolean;
}

export interface DevPartPriceResolution {
  stage: DevPartPriceStage;
  currentEffectivePrice: number;
  priceDuringRecovery: number;
  priceAfterRecovery: number;
}

export interface DevPartRecoveryPriceResult extends ResolvedDevPartPrice {}

export interface DevPartPriceSwitchResult extends ResolvedDevPartPrice {}

export interface DevPartCurrentPriceResult extends ResolvedDevPartPrice {}

export interface DevPartPriceRecoveryResult extends ResolvedDevPartPrice {}

export interface DevPartPriceRecoveryState extends DevPartRecoveryState {}

export interface DevPartPriceRecoveryBinding extends DevPartRecoveryBinding {}

export interface DevPartCurrentPriceResolution extends DevPartPriceResolution {}

export interface DevPartCurrentPriceTimeline extends DevPartPriceTimeline {}

export interface DevPartCurrentPriceMode extends DevPartPriceMode {}

export interface DevPartPriceRecoveryTimeline extends DevPartPriceTimeline {}

export interface DevPartPriceRecoveryMode extends DevPartPriceMode {}

export interface DevPartPriceRecoveryResolution extends DevPartPriceResolution {}

export interface DevPartPriceCurrentResolution extends DevPartPriceResolution {}

export interface DevPartPriceCurrentTimeline extends DevPartPriceTimeline {}

export interface DevPartPriceCurrentMode extends DevPartPriceMode {}

export interface DevPartPriceCurrentBinding extends DevPartRecoveryBinding {}

export interface DevPartPriceCurrentState extends DevPartRecoveryState {}

export interface DevPartPriceCurrentResult extends ResolvedDevPartPrice {}

export interface DevPartPriceCurrentSwitchResult extends ResolvedDevPartPrice {}

export interface DevPartPriceRecoverySwitchResult extends ResolvedDevPartPrice {}

export interface DevPartPriceLifecycleResult extends ResolvedDevPartPrice {}

export interface DevPartPriceLifecycleResolution extends DevPartPriceResolution {}

export interface DevPartPriceLifecycleTimeline extends DevPartPriceTimeline {}

export interface DevPartPriceLifecycleMode extends DevPartPriceMode {}

export interface DevPartPriceLifecycleBinding extends DevPartRecoveryBinding {}

export interface DevPartPriceLifecycleState extends DevPartRecoveryState {}

export interface DevPartPriceLifecycleSwitchResult extends ResolvedDevPartPrice {}

export interface DevPartPriceLifecycleCurrentResult extends ResolvedDevPartPrice {}

export interface DevPartPriceLifecycleRecoveryResult extends ResolvedDevPartPrice {}

export interface DevPartPriceLifecycleRecoveryResolution extends DevPartPriceResolution {}

export interface DevPartPriceLifecycleRecoveryTimeline extends DevPartPriceTimeline {}

export interface DevPartPriceLifecycleRecoveryMode extends DevPartPriceMode {}

export interface DevPartPriceLifecycleRecoveryBinding extends DevPartRecoveryBinding {}

export interface DevPartPriceLifecycleRecoveryState extends DevPartRecoveryState {}

export interface DevPartPriceLifecycleRecoverySwitch extends ResolvedDevPartPrice {}

export interface DevPartPriceLifecycleCurrentSwitch extends ResolvedDevPartPrice {}

export interface DevPartPriceLifecycleCurrentBinding extends DevPartRecoveryBinding {}

export interface DevPartPriceLifecycleCurrentState extends DevPartRecoveryState {}

export interface DevPartPriceLifecycleCurrentModeState extends DevPartPriceMode {}

export interface DevPartPriceLifecycleCurrentTimelineState extends DevPartPriceTimeline {}

export interface DevPartPriceLifecycleCurrentResolutionState extends DevPartPriceResolution {}

export interface DevPartPriceLifecycleCurrentOutput extends ResolvedDevPartPrice {}

export interface DevPartPriceLifecycleRecoveryOutput extends ResolvedDevPartPrice {}

export interface DevPartPriceLifecycleResolvedOutput extends ResolvedDevPartPrice {}

export interface DevPartPriceLifecycleFinalOutput extends ResolvedDevPartPrice {}

export interface DevPartPriceRecoveryFinalOutput extends ResolvedDevPartPrice {}

export interface DevPartPriceCurrentFinalOutput extends ResolvedDevPartPrice {}

export interface DevPartPriceResolvedOutput extends ResolvedDevPartPrice {}

export interface DevPartCurrentResolvedOutput extends ResolvedDevPartPrice {}

export interface DevPartRecoveryResolvedOutput extends ResolvedDevPartPrice {}

export interface DevPartPriceSwitchOutput extends ResolvedDevPartPrice {}

export interface DevPartPriceCurrentSwitchOutput extends ResolvedDevPartPrice {}

export interface DevPartPriceRecoverySwitchOutput extends ResolvedDevPartPrice {}

export interface DevPartLifecycleSwitchOutput extends ResolvedDevPartPrice {}

export interface DevPartLifecycleCurrentSwitchOutput extends ResolvedDevPartPrice {}

export interface DevPartLifecycleRecoverySwitchOutput extends ResolvedDevPartPrice {}

export interface DevPartLifecycleResolvedSwitchOutput extends ResolvedDevPartPrice {}

export interface DevPartEffectivePriceResult extends ResolvedDevPartPrice {}

export interface DevPartEffectivePriceResolution extends DevPartPriceResolution {}

export interface DevPartEffectivePriceTimeline extends DevPartPriceTimeline {}

export interface DevPartEffectivePriceMode extends DevPartPriceMode {}

export interface DevPartEffectivePriceBinding extends DevPartRecoveryBinding {}

export interface DevPartEffectivePriceState extends DevPartRecoveryState {}

export interface DevPartEffectivePriceSwitchResult extends ResolvedDevPartPrice {}

export interface DevPartEffectivePriceCurrentResult extends ResolvedDevPartPrice {}

export interface DevPartEffectivePriceRecoveryResult extends ResolvedDevPartPrice {}

export interface DevPartEffectivePriceLifecycleResult extends ResolvedDevPartPrice {}

export interface DevPartEffectivePriceFinalResult extends ResolvedDevPartPrice {}

export interface DevPartEffectivePriceOutput extends ResolvedDevPartPrice {}

export interface DevPartSynchronousPriceResult extends ResolvedDevPartPrice {}

export interface DevPartSynchronousPriceResolution extends DevPartPriceResolution {}

export interface DevPartSynchronousPriceTimeline extends DevPartPriceTimeline {}

export interface DevPartSynchronousPriceMode extends DevPartPriceMode {}

export interface DevPartSynchronousPriceBinding extends DevPartRecoveryBinding {}

export interface DevPartSynchronousPriceState extends DevPartRecoveryState {}

export interface DevPartSynchronousPriceOutput extends ResolvedDevPartPrice {}

export interface DevPartSynchronousPriceSwitchResult extends ResolvedDevPartPrice {}

export interface DevPartSynchronousPriceCurrentResult extends ResolvedDevPartPrice {}

export interface DevPartSynchronousPriceRecoveryResult extends ResolvedDevPartPrice {}

export interface DevPartSynchronousPriceLifecycleResult extends ResolvedDevPartPrice {}

export interface DevPartSynchronousPriceFinalResult extends ResolvedDevPartPrice {}

export interface DevPartRecoveredPriceResult extends ResolvedDevPartPrice {}

export interface DevPartRecoveredPriceResolution extends DevPartPriceResolution {}

export interface DevPartRecoveredPriceTimeline extends DevPartPriceTimeline {}

export interface DevPartRecoveredPriceMode extends DevPartPriceMode {}

export interface DevPartRecoveredPriceBinding extends DevPartRecoveryBinding {}

export interface DevPartRecoveredPriceState extends DevPartRecoveryState {}

export interface DevPartRecoveredPriceOutput extends ResolvedDevPartPrice {}

export interface DevPartRecoveredPriceSwitchResult extends ResolvedDevPartPrice {}

export interface DevPartRecoveredPriceCurrentResult extends ResolvedDevPartPrice {}

export interface DevPartRecoveredPriceRecoveryResult extends ResolvedDevPartPrice {}

export interface DevPartRecoveredPriceLifecycleResult extends ResolvedDevPartPrice {}

export interface DevPartRecoveredPriceFinalResult extends ResolvedDevPartPrice {}

export interface DevPartDuringRecoveryPriceResult extends ResolvedDevPartPrice {}

export interface DevPartAfterRecoveryPriceResult extends ResolvedDevPartPrice {}

export interface DevPartRecoverySwitchState {
  recoveryBound: boolean;
  fullyRecovered: boolean;
}

export interface DevPartEffectivePriceStateResult extends ResolvedDevPartPrice {}

export interface DevPartEffectivePriceSwitchStateResult extends ResolvedDevPartPrice {}

export interface DevPartEffectivePriceTimelineResult extends ResolvedDevPartPrice {}

export interface DevPartEffectivePriceModeResult extends ResolvedDevPartPrice {}

export interface DevPartEffectivePriceBindingResult extends ResolvedDevPartPrice {}

export interface DevPartEffectivePriceResolvedState extends ResolvedDevPartPrice {}

export interface DevPartEffectivePriceResolvedResult extends ResolvedDevPartPrice {}

export interface DevPartEffectivePriceResolvedTimeline extends ResolvedDevPartPrice {}

export interface DevPartEffectivePriceResolvedMode extends ResolvedDevPartPrice {}

export interface DevPartEffectivePriceResolvedBinding extends ResolvedDevPartPrice {}

export interface DevPartEffectivePriceResolvedOutput extends ResolvedDevPartPrice {}

export interface DevPartPriceSwitchStateResult extends ResolvedDevPartPrice {}

export interface DevPartPriceDuringRecoveryResult extends ResolvedDevPartPrice {}

export interface DevPartPriceAfterRecoveryResult extends ResolvedDevPartPrice {}

export interface DevPartPriceFallbackResult extends ResolvedDevPartPrice {}

export interface DevPartPriceRecoveredResult extends ResolvedDevPartPrice {}

export interface DevPartPriceStageResult extends ResolvedDevPartPrice {}

export interface DevPartPriceTransitionResult extends ResolvedDevPartPrice {}

export interface DevPartPriceTransitionState extends DevPartRecoveryState {}

export interface DevPartPriceTransitionMode extends DevPartPriceMode {}

export interface DevPartPriceTransitionTimeline extends DevPartPriceTimeline {}

export interface DevPartPriceTransitionResolution extends DevPartPriceResolution {}

export interface DevPartPriceTransitionBinding extends DevPartRecoveryBinding {}

export interface DevPartPriceTransitionOutput extends ResolvedDevPartPrice {}

export interface DevPartPriceTransitionFinalOutput extends ResolvedDevPartPrice {}

export interface DevPartPriceTransitionCurrentOutput extends ResolvedDevPartPrice {}

export interface DevPartPriceTransitionRecoveryOutput extends ResolvedDevPartPrice {}

export interface DevPartPriceTransitionLifecycleOutput extends ResolvedDevPartPrice {}

export interface DevPartPriceTransitionResolvedOutput extends ResolvedDevPartPrice {}

export interface DevPartPriceTransitionSwitchOutput extends ResolvedDevPartPrice {}

export interface DevPartPriceTransitionSummaryOutput extends ResolvedDevPartPrice {}

export interface DevPartPriceTransitionStageOutput extends ResolvedDevPartPrice {}

export interface DevPartPriceTransitionModeOutput extends ResolvedDevPartPrice {}

export interface DevPartPriceTransitionTimelineOutput extends ResolvedDevPartPrice {}

export interface DevPartPriceTransitionBindingOutput extends ResolvedDevPartPrice {}

export interface DevPartPriceTransitionStateOutput extends ResolvedDevPartPrice {}

export interface DevPartPriceTransitionResolvedStateOutput extends ResolvedDevPartPrice {}

export interface DevPartPriceTransitionResolvedModeOutput extends ResolvedDevPartPrice {}

export interface DevPartPriceTransitionResolvedTimelineOutput extends ResolvedDevPartPrice {}

export interface DevPartPriceTransitionResolvedBindingOutput extends ResolvedDevPartPrice {}

export interface DevPartPriceTransitionResolvedSummaryOutput extends ResolvedDevPartPrice {}

export interface DevPartPriceTransitionResolvedStageOutput extends ResolvedDevPartPrice {}

export interface DevPartPriceTransitionResolvedFinalOutput extends ResolvedDevPartPrice {}

export interface DevPartPriceTransitionResolvedCurrentOutput extends ResolvedDevPartPrice {}

export interface DevPartPriceTransitionResolvedRecoveryOutput extends ResolvedDevPartPrice {}

export interface DevPartPriceTransitionResolvedLifecycleOutput extends ResolvedDevPartPrice {}

export interface DevPartPriceTransitionResolvedSwitchOutput extends ResolvedDevPartPrice {}

export interface DevPartPriceTransitionResolvedStateResult extends ResolvedDevPartPrice {}

export interface DevPartPriceTransitionResolvedModeResult extends ResolvedDevPartPrice {}

export interface DevPartPriceTransitionResolvedTimelineResult extends ResolvedDevPartPrice {}

export interface DevPartPriceTransitionResolvedBindingResult extends ResolvedDevPartPrice {}

export interface DevPartPriceTransitionResolvedSummaryResult extends ResolvedDevPartPrice {}

export interface DevPartPriceTransitionResolvedStageResult extends ResolvedDevPartPrice {}

export interface DevPartPriceTransitionResolvedFinalResult extends ResolvedDevPartPrice {}

export interface DevPartPriceTransitionResolvedCurrentResult extends ResolvedDevPartPrice {}

export interface DevPartPriceTransitionResolvedRecoveryResult extends ResolvedDevPartPrice {}

export interface DevPartPriceTransitionResolvedLifecycleResult extends ResolvedDevPartPrice {}

export interface DevPartPriceTransitionResolvedSwitchResult extends ResolvedDevPartPrice {}

export interface DevPartCurrentEffectivePriceResult extends ResolvedDevPartPrice {}

export interface DevPartCurrentEffectivePriceResolution extends DevPartPriceResolution {}

export interface DevPartCurrentEffectivePriceTimeline extends DevPartPriceTimeline {}

export interface DevPartCurrentEffectivePriceMode extends DevPartPriceMode {}

export interface DevPartCurrentEffectivePriceBinding extends DevPartRecoveryBinding {}

export interface DevPartCurrentEffectivePriceState extends DevPartRecoveryState {}

export interface DevPartCurrentEffectivePriceSwitchResult extends ResolvedDevPartPrice {}

export interface DevPartCurrentEffectivePriceOutput extends ResolvedDevPartPrice {}

export interface DevPartCurrentEffectivePriceFinalOutput extends ResolvedDevPartPrice {}

export interface DevPartCurrentEffectivePriceRecoveryOutput extends ResolvedDevPartPrice {}

export interface DevPartCurrentEffectivePriceLifecycleOutput extends ResolvedDevPartPrice {}

export interface DevPartCurrentEffectivePriceResolvedOutput extends ResolvedDevPartPrice {}

export interface DevPartCurrentEffectivePriceStageOutput extends ResolvedDevPartPrice {}

export interface DevPartCurrentEffectivePriceSummaryOutput extends ResolvedDevPartPrice {}

export interface DevPartCurrentEffectivePriceModeOutput extends ResolvedDevPartPrice {}

export interface DevPartCurrentEffectivePriceTimelineOutput extends ResolvedDevPartPrice {}

export interface DevPartCurrentEffectivePriceBindingOutput extends ResolvedDevPartPrice {}

export interface DevPartCurrentEffectivePriceStateOutput extends ResolvedDevPartPrice {}

export interface DevPartCurrentEffectivePriceResolvedStateOutput extends ResolvedDevPartPrice {}

export interface DevPartCurrentEffectivePriceResolvedModeOutput extends ResolvedDevPartPrice {}

export interface DevPartCurrentEffectivePriceResolvedTimelineOutput extends ResolvedDevPartPrice {}

export interface DevPartCurrentEffectivePriceResolvedBindingOutput extends ResolvedDevPartPrice {}

export interface DevPartCurrentEffectivePriceResolvedSummaryOutput extends ResolvedDevPartPrice {}

export interface DevPartCurrentEffectivePriceResolvedStageOutput extends ResolvedDevPartPrice {}

export interface DevPartCurrentEffectivePriceResolvedFinalOutput extends ResolvedDevPartPrice {}

export interface DevPartCurrentEffectivePriceResolvedRecoveryOutput extends ResolvedDevPartPrice {}

export interface DevPartCurrentEffectivePriceResolvedLifecycleOutput extends ResolvedDevPartPrice {}

export interface DevPartCurrentEffectivePriceResolvedSwitchOutput extends ResolvedDevPartPrice {}

export interface DevPartCurrentEffectivePriceResolvedResult extends ResolvedDevPartPrice {}

export interface DevPartCurrentEffectivePriceResolvedStateResult extends ResolvedDevPartPrice {}

export interface DevPartCurrentEffectivePriceResolvedModeResult extends ResolvedDevPartPrice {}

export interface DevPartCurrentEffectivePriceResolvedTimelineResult extends ResolvedDevPartPrice {}

export interface DevPartCurrentEffectivePriceResolvedBindingResult extends ResolvedDevPartPrice {}

export interface DevPartCurrentEffectivePriceResolvedSummaryResult extends ResolvedDevPartPrice {}

export interface DevPartCurrentEffectivePriceResolvedStageResult extends ResolvedDevPartPrice {}

export interface DevPartCurrentEffectivePriceResolvedFinalResult extends ResolvedDevPartPrice {}

export interface DevPartCurrentEffectivePriceResolvedRecoveryResult extends ResolvedDevPartPrice {}

export interface DevPartCurrentEffectivePriceResolvedLifecycleResult extends ResolvedDevPartPrice {}

export interface DevPartCurrentEffectivePriceResolvedSwitchResult extends ResolvedDevPartPrice {}

export interface DevPartSynchronousEffectivePriceResult extends ResolvedDevPartPrice {}

export interface DevPartSynchronousEffectivePriceResolution extends DevPartPriceResolution {}

export interface DevPartSynchronousEffectivePriceTimeline extends DevPartPriceTimeline {}

export interface DevPartSynchronousEffectivePriceMode extends DevPartPriceMode {}

export interface DevPartSynchronousEffectivePriceBinding extends DevPartRecoveryBinding {}

export interface DevPartSynchronousEffectivePriceState extends DevPartRecoveryState {}

export interface DevPartSynchronousEffectivePriceSwitchResult extends ResolvedDevPartPrice {}

export interface DevPartSynchronousEffectivePriceOutput extends ResolvedDevPartPrice {}

export interface DevPartSynchronousEffectivePriceFinalOutput extends ResolvedDevPartPrice {}

export interface DevPartSynchronousEffectivePriceRecoveryOutput extends ResolvedDevPartPrice {}

export interface DevPartSynchronousEffectivePriceLifecycleOutput extends ResolvedDevPartPrice {}

export interface DevPartSynchronousEffectivePriceResolvedOutput extends ResolvedDevPartPrice {}

export interface DevPartSynchronousEffectivePriceStageOutput extends ResolvedDevPartPrice {}

export interface DevPartSynchronousEffectivePriceSummaryOutput extends ResolvedDevPartPrice {}

export interface DevPartSynchronousEffectivePriceModeOutput extends ResolvedDevPartPrice {}

export interface DevPartSynchronousEffectivePriceTimelineOutput extends ResolvedDevPartPrice {}

export interface DevPartSynchronousEffectivePriceBindingOutput extends ResolvedDevPartPrice {}

export interface DevPartSynchronousEffectivePriceStateOutput extends ResolvedDevPartPrice {}

export interface DevPartSynchronousEffectivePriceResolvedStateOutput extends ResolvedDevPartPrice {}

export interface DevPartSynchronousEffectivePriceResolvedModeOutput extends ResolvedDevPartPrice {}

export interface DevPartSynchronousEffectivePriceResolvedTimelineOutput extends ResolvedDevPartPrice {}

export interface DevPartSynchronousEffectivePriceResolvedBindingOutput extends ResolvedDevPartPrice {}

export interface DevPartSynchronousEffectivePriceResolvedSummaryOutput extends ResolvedDevPartPrice {}

export interface DevPartSynchronousEffectivePriceResolvedStageOutput extends ResolvedDevPartPrice {}

export interface DevPartSynchronousEffectivePriceResolvedFinalOutput extends ResolvedDevPartPrice {}

export interface DevPartSynchronousEffectivePriceResolvedRecoveryOutput extends ResolvedDevPartPrice {}

export interface DevPartSynchronousEffectivePriceResolvedLifecycleOutput extends ResolvedDevPartPrice {}

export interface DevPartSynchronousEffectivePriceResolvedSwitchOutput extends ResolvedDevPartPrice {}

export interface DevPartSynchronousEffectivePriceResolvedResult extends ResolvedDevPartPrice {}

export interface DevPartSynchronousEffectivePriceResolvedStateResult extends ResolvedDevPartPrice {}

export interface DevPartSynchronousEffectivePriceResolvedModeResult extends ResolvedDevPartPrice {}

export interface DevPartSynchronousEffectivePriceResolvedTimelineResult extends ResolvedDevPartPrice {}

export interface DevPartSynchronousEffectivePriceResolvedBindingResult extends ResolvedDevPartPrice {}

export interface DevPartSynchronousEffectivePriceResolvedSummaryResult extends ResolvedDevPartPrice {}

export interface DevPartSynchronousEffectivePriceResolvedStageResult extends ResolvedDevPartPrice {}

export interface DevPartSynchronousEffectivePriceResolvedFinalResult extends ResolvedDevPartPrice {}

export interface DevPartSynchronousEffectivePriceResolvedRecoveryResult extends ResolvedDevPartPrice {}

export interface DevPartSynchronousEffectivePriceResolvedLifecycleResult extends ResolvedDevPartPrice {}

export interface DevPartSynchronousEffectivePriceResolvedSwitchResult extends ResolvedDevPartPrice {}
