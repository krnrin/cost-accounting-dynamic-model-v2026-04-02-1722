import { apiClient } from './apiClient';

export type AlertEventCategory = 'metal_price' | 'allocation_recovery' | 'cost_anomaly' | 'execution' | 'deadline';
export type AlertEventSeverity = 'info' | 'warning' | 'critical';
export type AlertEventStatus = 'active' | 'acknowledged' | 'resolved' | 'dismissed';

export interface AlertEvent {
  id: string;
  projectId: string;
  scenarioId?: string | null;
  ruleId?: string | null;
  category: AlertEventCategory;
  severity: AlertEventSeverity;
  status: AlertEventStatus;
  title: string;
  detail?: string | null;
  sourceObjectType?: string | null;
  sourceObjectId?: string | null;
  impactAmount: number;
  assignedTo?: string | null;
  metadata: Record<string, any>;
  occurredAt: string;
  acknowledgedAt?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AlertSummary {
  total: number;
  active: number;
  acknowledged: number;
  resolved: number;
  dismissed: number;
  critical: number;
  warning: number;
  totalImpact: number;
}

export async function fetchProjectAlerts(projectId: string, filters?: Partial<Pick<AlertEvent, 'category' | 'severity' | 'status'>>) {
  const params = new URLSearchParams();
  if (filters?.category) params.set('category', filters.category);
  if (filters?.severity) params.set('severity', filters.severity);
  if (filters?.status) params.set('status', filters.status);
  const query = params.toString();
  return apiClient<AlertEvent[]>(`/projects/${projectId}/alerts${query ? `?${query}` : ''}`);
}

export async function fetchAlerts(filters?: Partial<Pick<AlertEvent, 'category' | 'severity' | 'status'>>) {
  const params = new URLSearchParams();
  if (filters?.category) params.set('category', filters.category);
  if (filters?.severity) params.set('severity', filters.severity);
  if (filters?.status) params.set('status', filters.status);
  const query = params.toString();
  return apiClient<AlertEvent[]>(`/alerts${query ? `?${query}` : ''}`);
}

export async function fetchAlertSummary(projectId?: string) {
  const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
  return apiClient<AlertSummary>(`/alerts/summary${query}`);
}

export async function fetchAlertById(id: string) {
  return apiClient<AlertEvent>(`/alerts/${id}`);
}

export async function detectAlerts() {
  return apiClient<{ count: number; items: AlertEvent[] }>(`/alerts/detect`, {
    method: 'POST',
  });
}

export async function updateAlert(id: string, payload: Partial<Pick<AlertEvent, 'status' | 'assignedTo' | 'detail' | 'metadata'>>) {
  return apiClient<AlertEvent>(`/alerts/${id}`, { method: 'PUT', body: payload });
}
