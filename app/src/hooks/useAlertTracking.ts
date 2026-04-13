/**
 * useAlertTracking Hook (C24 — Issue #76)
 * 
 * React Hook for alert-to-tracking-item lifecycle
 */

import { useState, useCallback, useMemo } from 'react';
import {
  alertToTrackingItem,
  updateTrackingStatus,
  applyEscalationRules,
  buildTrackingSummary,
  type TrackingItem,
  type TrackingStatus,
  type EscalationRule,
  type TrackingSummary,
} from '@/engine/alert_to_tracking';

export interface UseAlertTrackingReturn {
  items: TrackingItem[];
  summary: TrackingSummary;
  escalationRules: EscalationRule[];

  convertAlert: (alertId: string, title: string, description: string, severity: TrackingItem['severity'], assignee?: string | null, dueDate?: string | null) => TrackingItem;
  updateStatus: (itemId: string, status: TrackingStatus, userId: string, details?: string) => void;
  runEscalation: () => { escalatedCount: number; appliedRules: string[] };
  setRules: (rules: EscalationRule[]) => void;
  getItemsByStatus: (status: TrackingStatus) => TrackingItem[];
}

export function useAlertTracking(
  initialItems: TrackingItem[] = [],
  initialRules: EscalationRule[] = [],
): UseAlertTrackingReturn {
  const [items, setItems] = useState<TrackingItem[]>(initialItems);
  const [escalationRules, setEscalationRules] = useState<EscalationRule[]>(initialRules);

  const summary = useMemo(() => buildTrackingSummary(items), [items]);

  const convertAlert = useCallback((alertId: string, title: string, description: string, severity: TrackingItem['severity'], assignee: string | null = null, dueDate: string | null = null): TrackingItem => {
    const item = alertToTrackingItem(alertId, title, description, severity, assignee, dueDate);
    setItems(prev => [...prev, item]);
    return item;
  }, []);

  const updateStatus = useCallback((itemId: string, status: TrackingStatus, userId: string, details: string = '') => {
    setItems(prev => prev.map(item =>
      item.id === itemId ? updateTrackingStatus(item, status, userId, details) : item
    ));
  }, []);

  const runEscalation = useCallback(() => {
    let totalEscalated = 0;
    const allAppliedRules: string[] = [];
    setItems(prev => prev.map(item => {
      if (item.status === 'resolved' || item.status === 'closed') return item;
      const { item: updated, escalated, appliedRules } = applyEscalationRules(item, escalationRules);
      if (escalated) totalEscalated++;
      allAppliedRules.push(...appliedRules);
      return updated;
    }));
    return { escalatedCount: totalEscalated, appliedRules: allAppliedRules };
  }, [escalationRules]);

  const setRules = useCallback((rules: EscalationRule[]) => {
    setEscalationRules(rules);
  }, []);

  const getItemsByStatus = useCallback((status: TrackingStatus): TrackingItem[] => {
    return items.filter(i => i.status === status);
  }, [items]);

  return { items, summary, escalationRules, convertAlert, updateStatus, runEscalation, setRules, getItemsByStatus };
}

export default useAlertTracking;
