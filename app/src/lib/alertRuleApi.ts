import { apiClient } from './apiClient';

export type AlertRuleCategory = 'metal_price' | 'allocation_recovery' | 'cost_anomaly' | 'execution' | 'deadline';
export type AlertRuleSeverity = 'info' | 'warning' | 'critical';
export type AlertRuleOperator = 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq' | 'contains';

export interface AlertRuleCondition {
  metric: string;
  operator: AlertRuleOperator;
  threshold: string | number | boolean;
  unit?: string;
  window?: string;
  targetField?: string;
}

export interface AlertRule {
  id: string;
  name: string;
  category: AlertRuleCategory;
  severity: AlertRuleSeverity;
  enabled: boolean;
  description?: string | null;
  condition: AlertRuleCondition;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function fetchAlertRules() {
  return apiClient<AlertRule[]>('/alert-rules');
}

export async function createAlertRule(payload: Omit<AlertRule, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>) {
  return apiClient<AlertRule>('/alert-rules', { method: 'POST', body: payload });
}

export async function updateAlertRule(id: string, payload: Partial<Omit<AlertRule, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>>) {
  return apiClient<AlertRule>(`/alert-rules/${id}`, { method: 'PUT', body: payload });
}

export async function deleteAlertRule(id: string) {
  return apiClient<void>(`/alert-rules/${id}`, { method: 'DELETE' });
}
