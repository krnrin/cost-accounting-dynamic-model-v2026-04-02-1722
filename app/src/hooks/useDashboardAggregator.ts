/**
 * useDashboardAggregator Hook (C18 — Issue #66)
 * 
 * React Hook for Dashboard data aggregation:
 * - Alert summary with severity breakdown
 * - Version status summary
 * - Project import validation
 */

import { useState, useCallback, useMemo } from 'react';
import {
  aggregateAlerts,
  buildVersionSummary,
  validateProjectImport,
  type AlertEvent,
  type AlertAggregate,
  type VersionChange,
  type VersionSummary,
  type ProjectImportResult,
} from '@/engine/dashboard_aggregator';

export interface UseDashboardAggregatorReturn {
  // Alert aggregate
  alertAggregate: AlertAggregate | null;
  loadAlerts: (events: AlertEvent[]) => void;

  // Version summary
  versionSummary: VersionSummary | null;
  loadVersionInfo: (version: string, changes: VersionChange[], snapshots: number, pending?: number) => void;

  // Project import
  importResult: ProjectImportResult | null;
  validateImport: (rows: Array<Record<string, unknown>>) => ProjectImportResult;
  clearImport: () => void;
}

export function useDashboardAggregator(): UseDashboardAggregatorReturn {
  const [alertAggregate, setAlertAggregate] = useState<AlertAggregate | null>(null);
  const [versionSummary, setVersionSummary] = useState<VersionSummary | null>(null);
  const [importResult, setImportResult] = useState<ProjectImportResult | null>(null);

  const loadAlerts = useCallback((events: AlertEvent[]) => {
    setAlertAggregate(aggregateAlerts(events));
  }, []);

  const loadVersionInfo = useCallback((version: string, changes: VersionChange[], snapshots: number, pending: number = 0) => {
    setVersionSummary(buildVersionSummary(version, changes, snapshots, pending));
  }, []);

  const validateImport = useCallback((rows: Array<Record<string, unknown>>): ProjectImportResult => {
    const result = validateProjectImport(rows);
    setImportResult(result);
    return result;
  }, []);

  const clearImport = useCallback(() => {
    setImportResult(null);
  }, []);

  return {
    alertAggregate,
    loadAlerts,
    versionSummary,
    loadVersionInfo,
    importResult,
    validateImport,
    clearImport,
  };
}

export default useDashboardAggregator;
