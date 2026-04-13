/**
 * useBomSnapshot Hook (C14 — Issue #67)
 * 
 * React Hook for BOM snapshot management:
 * - Create snapshots at key lifecycle points
 * - Compare any two snapshots
 * - Restore from historical snapshot
 * - Validate BOM before operations
 */

import { useState, useCallback, useMemo } from 'react';
import {
  createBomSnapshot,
  diffBomSnapshots,
  validateBomItems,
  notifyDownstreamStale,
  shouldAutoSnapshot,
  type BomSnapshot,
  type BomSnapshotReason,
  type BomDiffResult,
  type BomValidationResult,
  type StaleNotification,
} from '@/engine/bom_snapshot_manager';
import type { BomItem } from '@/types/harness';

export interface UseBomSnapshotReturn {
  // State
  snapshots: BomSnapshot[];
  selectedPair: [BomSnapshot | null, BomSnapshot | null];
  diffResult: BomDiffResult | null;
  validationResult: BomValidationResult | null;
  staleNotifications: StaleNotification[];

  // Actions
  takeSnapshot: (items: BomItem[], reason: BomSnapshotReason) => BomSnapshot;
  compareSnapshots: (baseId: string, currentId: string) => BomDiffResult | null;
  selectForCompare: (index: 0 | 1, snapshotId: string) => void;
  validateItems: (items: BomItem[]) => BomValidationResult;
  checkAutoSnapshot: (reason: BomSnapshotReason) => boolean;
  restoreSnapshot: (snapshotId: string) => BomItem[] | null;
  clearDiff: () => void;
}

export function useBomSnapshot(
  scenarioId: string,
  harnessId: string,
  initialSnapshots: BomSnapshot[] = [],
): UseBomSnapshotReturn {
  const [snapshots, setSnapshots] = useState<BomSnapshot[]>(initialSnapshots);
  const [selectedPair, setSelectedPair] = useState<[BomSnapshot | null, BomSnapshot | null]>([null, null]);
  const [diffResult, setDiffResult] = useState<BomDiffResult | null>(null);
  const [validationResult, setValidationResult] = useState<BomValidationResult | null>(null);
  const [staleNotifications, setStaleNotifications] = useState<StaleNotification[]>([]);

  const takeSnapshot = useCallback((items: BomItem[], reason: BomSnapshotReason): BomSnapshot => {
    const snapshot = createBomSnapshot(scenarioId, harnessId, items, reason, 'user', snapshots);
    setSnapshots(prev => [...prev, snapshot]);

    // Notify downstream
    const notifications = notifyDownstreamStale(scenarioId, harnessId, snapshot.id);
    setStaleNotifications(prev => [...prev, ...notifications]);

    return snapshot;
  }, [scenarioId, harnessId, snapshots]);

  const compareSnapshots = useCallback((baseId: string, currentId: string): BomDiffResult | null => {
    const base = snapshots.find(s => s.id === baseId);
    const current = snapshots.find(s => s.id === currentId);
    if (!base || !current) return null;

    const result = diffBomSnapshots(base, current);
    setDiffResult(result);
    return result;
  }, [snapshots]);

  const selectForCompare = useCallback((index: 0 | 1, snapshotId: string) => {
    const snapshot = snapshots.find(s => s.id === snapshotId) || null;
    setSelectedPair(prev => {
      const next: [BomSnapshot | null, BomSnapshot | null] = [...prev];
      next[index] = snapshot;
      return next;
    });
  }, [snapshots]);

  const validateItems = useCallback((items: BomItem[]): BomValidationResult => {
    const result = validateBomItems(items);
    setValidationResult(result);
    return result;
  }, []);

  const checkAutoSnapshot = useCallback((reason: BomSnapshotReason): boolean => {
    return shouldAutoSnapshot(reason, snapshots, scenarioId, harnessId);
  }, [snapshots, scenarioId, harnessId]);

  const restoreSnapshot = useCallback((snapshotId: string): BomItem[] | null => {
    const snapshot = snapshots.find(s => s.id === snapshotId);
    if (!snapshot) return null;
    return JSON.parse(JSON.stringify(snapshot.items));
  }, [snapshots]);

  const clearDiff = useCallback(() => {
    setDiffResult(null);
    setSelectedPair([null, null]);
  }, []);

  return {
    snapshots,
    selectedPair,
    diffResult,
    validationResult,
    staleNotifications,
    takeSnapshot,
    compareSnapshots,
    selectForCompare,
    validateItems,
    checkAutoSnapshot,
    restoreSnapshot,
    clearDiff,
  };
}

export default useBomSnapshot;
