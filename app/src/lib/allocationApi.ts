import { apiClient } from './apiClient';
import type { PaymentMode } from '@/engine/onetime_alloc';

export type ScenarioAllocationExpenseType = 'tooling' | 'mold' | 'testing' | 'rnd' | 'other' | string;
export type ScenarioAllocationBurdenSide = 'supplier' | 'customer' | 'shared' | string;
export type ScenarioAllocationPricingEffect = 'included_in_price' | 'separate_invoice' | 'internal_only' | string;
export type ScenarioAllocationCompletionBehavior = 'trigger_price_adjust' | 'notify_only' | 'archive' | string;

export interface ScenarioAllocationItem {
  id: string;
  projectId: string;
  scenarioId: string;
  harnessId: string;
  expenseType: ScenarioAllocationExpenseType;
  expenseName: string;
  totalAmount: number;
  allocationBasis?: string | null;
  baselineVolume: number;
  unitAllocation: number;
  plannedRecovery: number;
  actualRecovered: number;
  remainingRecovery: number;
  recoveryProgress: number;
  burdenSide: ScenarioAllocationBurdenSide;
  pricingEffect: ScenarioAllocationPricingEffect;
  recoveryCompletionBehavior: ScenarioAllocationCompletionBehavior;
  priceAdjustReminder: boolean;
  targetRecoveryDate?: string | null;
  completedAt?: string | null;
  status: string;
  sourceVersionId?: string | null;
  latestCumulativeVolume?: number;
  latestInstallRatioSnapshot?: number;
  latestRecoveryPeriod?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ScenarioAllocationParticipant {
  harnessId: string;
  harnessName: string;
  vehicleRatio: number;
  quantity: number;
  allocationItemId?: string;
  latestCumulativeVolume?: number;
  latestInstallRatioSnapshot?: number;
  latestRecoveryPeriod?: string | null;
}

export interface ScenarioAllocationFeeItem {
  feeId: string;
  projectId: string;
  scenarioId: string;
  feeName: string;
  feeCategory: ScenarioAllocationExpenseType;
  unitPrice: number;
  allocBase: number;
  paymentMode: PaymentMode;
  burdenSide: ScenarioAllocationBurdenSide;
  pricingEffect: ScenarioAllocationPricingEffect;
  recoveryCompletionBehavior: ScenarioAllocationCompletionBehavior;
  priceAdjustReminder: boolean;
  targetRecoveryDate?: string | null;
  completedAt?: string | null;
  status: string;
  sourceVersionId?: string | null;
  participants: ScenarioAllocationParticipant[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ScenarioAllocationFeeItemInput {
  feeId?: string;
  feeName: string;
  feeCategory: ScenarioAllocationExpenseType;
  unitPrice: number;
  allocBase: number;
  paymentMode?: PaymentMode;
  burdenSide?: ScenarioAllocationBurdenSide;
  pricingEffect?: ScenarioAllocationPricingEffect;
  recoveryCompletionBehavior?: ScenarioAllocationCompletionBehavior;
  priceAdjustReminder?: boolean;
  targetRecoveryDate?: string | null;
  completedAt?: string | null;
  status?: string;
  sourceVersionId?: string | null;
  participants: ScenarioAllocationParticipant[];
}

export interface ScenarioAllocationSyncRow {
  harnessId: string;
  harnessName: string;
  vehicleRatio: number;
  toolingCost: number;
  testingCost: number;
  rndCost: number;
  allocBase: number;
  paymentMode: PaymentMode;
  cumProduced: number;
}

const DEFAULT_BURDEN_SIDE: ScenarioAllocationBurdenSide = 'customer';
const DEFAULT_PRICING_EFFECT: ScenarioAllocationPricingEffect = 'included_in_price';
const DEFAULT_COMPLETION_BEHAVIOR: ScenarioAllocationCompletionBehavior = 'trigger_price_adjust';
const DEFAULT_STATUS = 'allocated';

function normalizePaymentMode(value?: string | null): PaymentMode {
  if (value === 'lumpsum' || value === 'mixed') {
    return value;
  }
  return 'amortized';
}

function toAllocationBasis(paymentMode?: PaymentMode): string {
  if (paymentMode === 'lumpsum') return 'lumpsum';
  if (paymentMode === 'mixed') return 'mixed';
  return 'amortized';
}

function makeFeeGroupKey(item: ScenarioAllocationItem) {
  return [
    item.expenseType,
    item.expenseName,
    Number(item.unitAllocation || 0),
    Number(item.baselineVolume || 0),
    item.allocationBasis || '',
    item.burdenSide || '',
    item.pricingEffect || '',
    item.recoveryCompletionBehavior || '',
    item.priceAdjustReminder ? '1' : '0',
    item.targetRecoveryDate || '',
    item.completedAt || '',
    item.status || '',
    item.sourceVersionId || '',
  ].join('::');
}

export function mapAllocationItemsToFeeItems(items: ScenarioAllocationItem[]): ScenarioAllocationFeeItem[] {
  const groups = new Map<string, ScenarioAllocationFeeItem>();

  for (const item of items) {
    const key = makeFeeGroupKey(item);
    const existing = groups.get(key);
    const participant: ScenarioAllocationParticipant = {
      harnessId: item.harnessId,
      harnessName: item.harnessId,
      vehicleRatio: Number(item.latestInstallRatioSnapshot || 1) || 1,
      quantity: Number(item.unitAllocation || 0) > 0 ? Number(item.totalAmount || 0) / Number(item.unitAllocation || 1) : 0,
      allocationItemId: item.id,
      latestCumulativeVolume: Number(item.latestCumulativeVolume || 0),
      latestInstallRatioSnapshot: Number(item.latestInstallRatioSnapshot || 0),
      latestRecoveryPeriod: item.latestRecoveryPeriod ?? null,
    };

    if (existing) {
      existing.participants.push(participant);
      continue;
    }

    groups.set(key, {
      feeId: item.id,
      projectId: item.projectId,
      scenarioId: item.scenarioId,
      feeName: item.expenseName,
      feeCategory: item.expenseType,
      unitPrice: Number(item.unitAllocation || 0),
      allocBase: Math.max(1, Number(item.baselineVolume || 1)),
      paymentMode: normalizePaymentMode(item.allocationBasis),
      burdenSide: item.burdenSide || DEFAULT_BURDEN_SIDE,
      pricingEffect: item.pricingEffect || DEFAULT_PRICING_EFFECT,
      recoveryCompletionBehavior: item.recoveryCompletionBehavior || DEFAULT_COMPLETION_BEHAVIOR,
      priceAdjustReminder: Boolean(item.priceAdjustReminder),
      targetRecoveryDate: item.targetRecoveryDate ?? null,
      completedAt: item.completedAt ?? null,
      status: item.status || DEFAULT_STATUS,
      sourceVersionId: item.sourceVersionId ?? null,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      participants: [participant],
    });
  }

  return Array.from(groups.values()).map((item) => ({
    ...item,
    participants: item.participants.sort((a, b) => a.harnessId.localeCompare(b.harnessId)),
  }));
}

function mapFeeItemToAllocationCreatePayload(
  projectId: string,
  feeItem: ScenarioAllocationFeeItemInput,
  participant: ScenarioAllocationParticipant,
) {
  const unitPrice = Number(feeItem.unitPrice || 0);
  const quantity = Number(participant.quantity || 0);
  return {
    projectId,
    harnessId: participant.harnessId,
    expenseType: feeItem.feeCategory,
    expenseName: feeItem.feeName,
    totalAmount: unitPrice * quantity,
    allocationBasis: toAllocationBasis(feeItem.paymentMode),
    baselineVolume: Math.max(1, Number(feeItem.allocBase || 1)),
    burdenSide: feeItem.burdenSide || DEFAULT_BURDEN_SIDE,
    pricingEffect: feeItem.pricingEffect || DEFAULT_PRICING_EFFECT,
    recoveryCompletionBehavior: feeItem.recoveryCompletionBehavior || DEFAULT_COMPLETION_BEHAVIOR,
    priceAdjustReminder: Boolean(feeItem.priceAdjustReminder),
    targetRecoveryDate: feeItem.targetRecoveryDate ?? undefined,
    completedAt: feeItem.completedAt ?? undefined,
    status: feeItem.status || DEFAULT_STATUS,
    sourceVersionId: feeItem.sourceVersionId ?? undefined,
  };
}

export async function fetchScenarioAllocations(scenarioId: string, burdenSide?: string) {
  const query = burdenSide ? `?burden_side=${encodeURIComponent(burdenSide)}` : '';
  return apiClient<ScenarioAllocationItem[]>(`/scenarios/${scenarioId}/allocations${query}`);
}

export async function fetchScenarioAllocationFeeItems(scenarioId: string, burdenSide?: string) {
  const items = await fetchScenarioAllocations(scenarioId, burdenSide);
  return mapAllocationItemsToFeeItems(items);
}

export async function createScenarioAllocationFeeItem(
  scenarioId: string,
  projectId: string,
  feeItem: ScenarioAllocationFeeItemInput,
) {
  const created = await Promise.all(
    feeItem.participants
      .filter((participant) => Number(participant.quantity || 0) > 0)
      .map((participant) => apiClient<ScenarioAllocationItem>(`/scenarios/${scenarioId}/allocations`, {
        method: 'POST',
        body: mapFeeItemToAllocationCreatePayload(projectId, feeItem, participant),
      })),
  );

  return mapAllocationItemsToFeeItems(created)[0] ?? null;
}

export async function saveScenarioAllocationFeeItems(
  scenarioId: string,
  payload: { projectId: string; feeItems: ScenarioAllocationFeeItemInput[] },
) {
  const createdGroups = await Promise.all(
    payload.feeItems.map((feeItem) => createScenarioAllocationFeeItem(scenarioId, payload.projectId, feeItem)),
  );

  return createdGroups.filter(Boolean) as ScenarioAllocationFeeItem[];
}

export async function bulkSyncScenarioAllocations(
  scenarioId: string,
  payload: { projectId: string; rows: ScenarioAllocationSyncRow[] },
) {
  return apiClient<ScenarioAllocationItem[]>(`/scenarios/${scenarioId}/allocations/bulk-sync`, {
    method: 'POST',
    body: payload,
  });
}
