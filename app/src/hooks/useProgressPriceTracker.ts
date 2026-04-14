/**
 * useProgressPriceTracker Hook (C16 — Issue #73)
 * 
 * React Hook for protocol price tracking:
 * - Manage tracking items per scenario
 * - Auto-compute gaps and status
 * - Build summary and top-gap list
 * - Identify stagnant material candidates
 */

import { useState, useCallback, useMemo } from 'react';
import {
  computeItemGap,
  deriveProtocolStatus,
  buildProtocolSummary,
  identifyStagnantCandidates,
  buildStagnantSummary,
  shouldTriggerStagnantAlert,
  type ProtocolTrackingItem,
  type ProtocolTrackingSummary,
  type StagnantCandidate,
  type StagnantSummary,
} from '@/engine/progress_price_tracker';

export interface UseProgressPriceTrackerReturn {
  // Protocol tracking
  trackingItems: ProtocolTrackingItem[];
  summary: ProtocolTrackingSummary;
  updateItem: (itemId: string, updates: Partial<ProtocolTrackingItem>) => void;
  addItem: (item: Omit<ProtocolTrackingItem, 'gap' | 'gapRate' | 'annualGapAmount' | 'status' | 'updatedAt'>) => void;
  recalculateAll: () => void;

  // Stagnant tracking
  stagnantCandidates: StagnantCandidate[];
  stagnantSummary: StagnantSummary;
  addStagnantFromBomDiff: (removedItems: Array<{ partNo: string; partName?: string; harnessId?: string; quantity?: number; changeRef?: string }>) => void;
  updateStagnantItem: (itemId: string, updates: Partial<StagnantCandidate>) => void;
  alertCandidates: StagnantCandidate[];
}

export function useProgressPriceTracker(
  initialItems: ProtocolTrackingItem[] = [],
): UseProgressPriceTrackerReturn {
  const [trackingItems, setTrackingItems] = useState<ProtocolTrackingItem[]>(initialItems);
  const [stagnantCandidates, setStagnantCandidates] = useState<StagnantCandidate[]>([]);

  const summary = useMemo(() => buildProtocolSummary(trackingItems), [trackingItems]);
  const stagnantSummary = useMemo(() => buildStagnantSummary(stagnantCandidates), [stagnantCandidates]);

  const alertCandidates = useMemo(
    () => stagnantCandidates.filter(c => shouldTriggerStagnantAlert(c)),
    [stagnantCandidates],
  );

  const updateItem = useCallback((itemId: string, updates: Partial<ProtocolTrackingItem>) => {
    setTrackingItems(prev => prev.map(item => {
      if (item.itemId !== itemId) return item;
      const merged = { ...item, ...updates, updatedAt: new Date().toISOString() };
      const metrics = computeItemGap(merged);
      const status = deriveProtocolStatus({ ...merged, ...metrics });
      return { ...merged, ...metrics, status };
    }));
  }, []);

  const addItem = useCallback((item: Omit<ProtocolTrackingItem, 'gap' | 'gapRate' | 'annualGapAmount' | 'status' | 'updatedAt'>) => {
    const metrics = computeItemGap(item);
    const status = deriveProtocolStatus({ ...item, ...metrics });
    const newItem: ProtocolTrackingItem = {
      ...item,
      ...metrics,
      status,
      updatedAt: new Date().toISOString(),
    };
    setTrackingItems(prev => [...prev, newItem]);
  }, []);

  const recalculateAll = useCallback(() => {
    setTrackingItems(prev => prev.map(item => {
      const metrics = computeItemGap(item);
      const status = deriveProtocolStatus({ ...item, ...metrics });
      return { ...item, ...metrics, status, updatedAt: new Date().toISOString() };
    }));
  }, []);

  const addStagnantFromBomDiff = useCallback((removedItems: Array<{ partNo: string; partName?: string; harnessId?: string; quantity?: number; changeRef?: string }>) => {
    const candidates = identifyStagnantCandidates(removedItems);
    setStagnantCandidates(prev => [...prev, ...candidates]);
  }, []);

  const updateStagnantItem = useCallback((itemId: string, updates: Partial<StagnantCandidate>) => {
    setStagnantCandidates(prev => prev.map(c =>
      c.itemId === itemId ? { ...c, ...updates } : c
    ));
  }, []);

  return {
    trackingItems,
    summary,
    updateItem,
    addItem,
    recalculateAll,
    stagnantCandidates,
    stagnantSummary,
    addStagnantFromBomDiff,
    updateStagnantItem,
    alertCandidates,
  };
}

export default useProgressPriceTracker;
