import { apiClient } from './apiClient';
import type { PaymentMode } from '@/engine/onetime_alloc';

export interface ScenarioAllocationItem {
  id: string;
  projectId: string;
  scenarioId: string;
  harnessId: string;
  expenseType: 'tooling' | 'mold' | 'testing' | 'rnd' | 'other' | string;
  expenseName: string;
  totalAmount: number;
  allocationBasis?: string | null;
  baselineVolume: number;
  unitAllocation: number;
  plannedRecovery: number;
  actualRecovered: number;
  remainingRecovery: number;
  recoveryProgress: number;
  burdenSide: string;
  pricingEffect: string;
  recoveryCompletionBehavior: string;
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

export async function fetchScenarioAllocations(scenarioId: string, burdenSide?: string) {
  const query = burdenSide ? `?burden_side=${encodeURIComponent(burdenSide)}` : '';
  return apiClient<ScenarioAllocationItem[]>(`/scenarios/${scenarioId}/allocations${query}`);
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
