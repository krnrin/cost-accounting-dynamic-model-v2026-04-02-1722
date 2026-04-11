import { apiClient } from './apiClient';

export interface ManagerProjectSummary {
  projectId: string;
  projectCode: string;
  projectName: string;
  customer: string;
  status: string;
  harnessCount: number;
  scenarioCount: number;
  quoteCount: number;
  alertCount: number;
  activeAlertCount: number;
  totalRevenue: number;
  totalInternalCost: number;
  totalProfitGap: number;
  totalAllocationAmount: number;
  totalRecoveredAmount: number;
  recoveryRate: number;
  latestQuoteUpdatedAt: string | null;
  updatedAt: string;
}

export interface ManagerOverview {
  projectCount: number;
  harnessCount: number;
  scenarioCount: number;
  quoteCount: number;
  activeAlertCount: number;
  totalRevenue: number;
  totalInternalCost: number;
  totalProfitGap: number;
  totalAllocationAmount: number;
  totalRecoveredAmount: number;
  recoveryRate: number;
  projects: ManagerProjectSummary[];
}

export interface ManagerProfitSummary {
  projectId: string;
  projectCode: string;
  projectName: string;
  customer: string;
  revenue: number;
  internalCost: number;
  profitGap: number;
  profitRate: number;
}

export interface ManagerRecoverySummary {
  projectId: string;
  projectCode: string;
  projectName: string;
  totalAllocationAmount: number;
  totalRecoveredAmount: number;
  remainingRecoveryAmount: number;
  recoveryRate: number;
}

export interface ManagerAlertSummary {
  projectId: string;
  projectCode: string;
  projectName: string;
  alertCount: number;
  activeAlertCount: number;
}

export interface ManagerScenarioComparison {
  projectId: string;
  projectCode: string;
  projectName: string;
  customer: string;
  scenarioId: string;
  scenarioName: string;
  scenarioType: string;
  scenarioStatus: string;
  lifecycleYears: number;
  volume: number;
  compareBaselineId?: string | null;
  sourceScenarioId?: string | null;
  createdAt: string;
}

export interface ManagerAnomalySummary {
  projectId: string;
  projectCode: string;
  projectName: string;
  changeId: string;
  scenarioId: string;
  changeType: string;
  status: string;
  costImpact: number;
  residualImpact: number;
  totalImpact: number;
  updatedAt: string;
}

export function fetchManagerOverview() {
  return apiClient<ManagerOverview>('/manager-dashboard');
}

export function fetchManagerProfitSummary() {
  return apiClient<ManagerProfitSummary[]>('/manager-dashboard/profit-summary');
}

export function fetchManagerRecoverySummary() {
  return apiClient<ManagerRecoverySummary[]>('/manager-dashboard/recovery-summary');
}

export function fetchManagerAlertSummary() {
  return apiClient<ManagerAlertSummary[]>('/manager-dashboard/alert-summary');
}

export function fetchManagerScenarioComparison() {
  return apiClient<ManagerScenarioComparison[]>('/manager-dashboard/scenario-comparison');
}

export function fetchManagerAnomalySummary() {
  return apiClient<ManagerAnomalySummary[]>('/manager-dashboard/anomaly-summary');
}
