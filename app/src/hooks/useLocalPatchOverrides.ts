/**
 * useLocalPatchOverrides Hook (C27 — Issue #77)
 * 
 * 统一集成所有14项本地补丁的Hook
 * 在现有页面中只需: const patches = useLocalPatchOverrides(scenarioId)
 */

import { useState, useCallback, useMemo } from 'react';
import {
  handleScenarioFreeze,
  createDefaultMetalState,
  checkMetalStaleness,
  guardBomLoad,
  buildBatchConfirmation,
  checkScenarioIntegrity,
  detectDuplicateBomRows,
  checkRateBounds,
  estimateChangeImpact,
  validateScenarioName,
  markCacheInvalid,
  checkEditConflict,
  acquireEditLock,
  type InternalMetalState,
  type BomLoadGuardResult,
  type BatchOpConfirmation,
  type IntegrityCheckResult,
  type CacheInvalidation,
  type EditLock,
} from '@/engine/local_patch_overrides';
import type { BomItem } from '@/types/harness';

export interface UseLocalPatchOverridesReturn {
  // Metal state
  metalState: InternalMetalState;
  updateMetalState: (updates: Partial<InternalMetalState>) => void;
  refreshStaleness: () => void;

  // BOM guard
  guardedBomLoad: (items: unknown) => BomLoadGuardResult;
  duplicates: Array<{ partNo: string; indices: number[]; count: number }>;
  checkDuplicates: (items: BomItem[]) => void;

  // Scenario operations
  freezeWithSnapshot: (triggerSnapshot: (id: string, reason: string) => void) => void;
  validateName: (name: string) => { valid: boolean; errors: string[] };
  checkIntegrity: (scenario: { harnesses?: unknown[]; rates?: Record<string, number> }) => IntegrityCheckResult;

  // Rates
  checkRates: (rates: Record<string, number>) => Array<{ rate: string; value: number; violation: 'below' | 'above' }>;

  // Batch ops
  buildConfirmation: (operation: string, count: number) => BatchOpConfirmation;

  // Edit lock
  editLock: EditLock | null;
  acquireLock: (userId: string) => EditLock;
  checkConflict: (userId: string, locks: EditLock[]) => { conflict: boolean; holder?: string };

  // Cache
  invalidateCache: (module: string, reason: string) => CacheInvalidation;
}

export function useLocalPatchOverrides(
  scenarioId: string,
): UseLocalPatchOverridesReturn {
  const [metalState, setMetalState] = useState<InternalMetalState>(createDefaultMetalState());
  const [duplicates, setDuplicates] = useState<Array<{ partNo: string; indices: number[]; count: number }>>([]);
  const [editLock, setEditLock] = useState<EditLock | null>(null);

  const updateMetalState = useCallback((updates: Partial<InternalMetalState>) => {
    setMetalState(prev => ({ ...prev, ...updates, lastUpdated: new Date().toISOString() }));
  }, []);

  const refreshStaleness = useCallback(() => {
    setMetalState(prev => ({
      ...prev,
      staleness: checkMetalStaleness(prev.lastUpdated),
    }));
  }, []);

  const guardedBomLoad = useCallback((items: unknown): BomLoadGuardResult => {
    return guardBomLoad(items);
  }, []);

  const checkDuplicates = useCallback((items: BomItem[]) => {
    setDuplicates(detectDuplicateBomRows(items));
  }, []);

  const freezeWithSnapshot = useCallback((triggerSnapshot: (id: string, reason: string) => void) => {
    handleScenarioFreeze({ scenarioId, triggerSnapshot });
  }, [scenarioId]);

  const validateName = useCallback((name: string) => validateScenarioName(name), []);

  const checkIntegrity = useCallback((scenario: { harnesses?: unknown[]; rates?: Record<string, number> }) => {
    return checkScenarioIntegrity(scenario);
  }, []);

  const checkRates = useCallback((rates: Record<string, number>) => {
    return checkRateBounds(rates).map(v => ({ rate: v.rate, value: v.value, violation: v.violation }));
  }, []);

  const buildConfirmation = useCallback((operation: string, count: number) => {
    return buildBatchConfirmation(operation, count);
  }, []);

  const acquireLock = useCallback((userId: string): EditLock => {
    const lock = acquireEditLock(scenarioId, userId);
    setEditLock(lock);
    return lock;
  }, [scenarioId]);

  const checkConflict = useCallback((userId: string, locks: EditLock[]) => {
    return checkEditConflict(scenarioId, userId, locks);
  }, [scenarioId]);

  const invalidateCache = useCallback((module: string, reason: string) => {
    return markCacheInvalid(module, reason);
  }, []);

  return {
    metalState, updateMetalState, refreshStaleness,
    guardedBomLoad, duplicates, checkDuplicates,
    freezeWithSnapshot, validateName, checkIntegrity,
    checkRates, buildConfirmation,
    editLock, acquireLock, checkConflict,
    invalidateCache,
  };
}

export default useLocalPatchOverrides;
