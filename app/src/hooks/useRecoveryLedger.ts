/**
 * useRecoveryLedger Hook (C19 — Issue #70)
 * 
 * React Hook for recovery ledger management
 */

import { useState, useCallback, useMemo } from 'react';
import {
  addRecoveryRecord,
  computeAllocItemSummary,
  buildLedgerSummary,
  type AllocItemSummary,
  type RecoveryRecord,
  type RecoveryLedgerSummary,
  type RecoveryAlert,
} from '@/engine/recovery_ledger';

export interface UseRecoveryLedgerReturn {
  items: AllocItemSummary[];
  summary: RecoveryLedgerSummary;
  alerts: RecoveryAlert[];

  addRecord: (allocItemId: string, amount: number, volume: number, note?: string) => RecoveryRecord | null;
  loadItems: (items: AllocItemSummary[]) => void;
  getItem: (allocItemId: string) => AllocItemSummary | undefined;
}

export function useRecoveryLedger(
  initialItems: AllocItemSummary[] = [],
): UseRecoveryLedgerReturn {
  const [items, setItems] = useState<AllocItemSummary[]>(initialItems);

  const summary = useMemo(() => buildLedgerSummary(items), [items]);
  const alerts = useMemo(() => summary.alerts, [summary]);

  const addRecord = useCallback((allocItemId: string, amount: number, volume: number, note: string = ''): RecoveryRecord | null => {
    let newRecord: RecoveryRecord | null = null;
    setItems(prev => prev.map(item => {
      if (item.allocItemId !== allocItemId) return item;
      const record = addRecoveryRecord(item, amount, volume, undefined, note);
      newRecord = record;
      const updatedRecords = [...item.records, record];
      return computeAllocItemSummary(
        item.allocItemId, item.scenarioId, item.costType,
        item.totalNre, item.allocMethod, item.allocPeriodMonths,
        item.startDate, updatedRecords,
      );
    }));
    return newRecord;
  }, []);

  const loadItems = useCallback((newItems: AllocItemSummary[]) => {
    setItems(newItems);
  }, []);

  const getItem = useCallback((allocItemId: string): AllocItemSummary | undefined => {
    return items.find(i => i.allocItemId === allocItemId);
  }, [items]);

  return { items, summary, alerts, addRecord, loadItems, getItem };
}

export default useRecoveryLedger;
