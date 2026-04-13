/**
 * useVersionGovernance Hook (C23 — Issue #74)
 * 
 * React Hook for version governance
 */

import { useState, useCallback, useMemo } from 'react';
import {
  lockVersion,
  unlockVersion,
  requestApproval,
  respondToApproval,
  planRollback,
  canModifyVersion,
  type VersionEntry,
  type RollbackPlan,
} from '@/engine/version_governance';

export interface UseVersionGovernanceReturn {
  versions: VersionEntry[];
  currentVersion: VersionEntry | null;
  rollbackPlan: RollbackPlan | null;
  canModify: boolean;
  modifyReason: string | undefined;

  loadVersions: (versions: VersionEntry[], currentId?: string) => void;
  lock: (versionId: string, userId: string, reason: string, expiresAt?: string | null) => void;
  unlock: (versionId: string) => void;
  submitForApproval: (versionId: string, userId: string, approvers: string[]) => void;
  approve: (versionId: string, userId: string, comment?: string) => void;
  reject: (versionId: string, userId: string, comment?: string) => void;
  prepareRollback: (targetVersionId: string) => RollbackPlan | null;
  executeRollback: () => void;
}

export function useVersionGovernance(): UseVersionGovernanceReturn {
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(null);
  const [rollbackPlan, setRollbackPlan] = useState<RollbackPlan | null>(null);

  const currentVersion = useMemo(
    () => versions.find(v => v.versionId === currentVersionId) || null,
    [versions, currentVersionId],
  );

  const { canModify, modifyReason } = useMemo(() => {
    if (!currentVersion) return { canModify: false, modifyReason: '无当前版本' };
    const check = canModifyVersion(currentVersion);
    return { canModify: check.allowed, modifyReason: check.reason };
  }, [currentVersion]);

  const updateVersion = (versionId: string, updater: (v: VersionEntry) => VersionEntry) => {
    setVersions(prev => prev.map(v => v.versionId === versionId ? updater(v) : v));
  };

  const loadVersions = useCallback((vs: VersionEntry[], currentId?: string) => {
    setVersions(vs);
    if (currentId) setCurrentVersionId(currentId);
    else if (vs.length > 0) setCurrentVersionId(vs[vs.length - 1]!.versionId);
  }, []);

  const lock = useCallback((versionId: string, userId: string, reason: string, expiresAt: string | null = null) => {
    updateVersion(versionId, v => lockVersion(v, userId, reason, expiresAt));
  }, []);

  const unlock = useCallback((versionId: string) => {
    updateVersion(versionId, v => unlockVersion(v));
  }, []);

  const submitForApproval = useCallback((versionId: string, userId: string, approvers: string[]) => {
    updateVersion(versionId, v => requestApproval(v, userId, approvers));
  }, []);

  const approve = useCallback((versionId: string, userId: string, comment: string = '') => {
    updateVersion(versionId, v => respondToApproval(v, userId, true, comment));
  }, []);

  const reject = useCallback((versionId: string, userId: string, comment: string = '') => {
    updateVersion(versionId, v => respondToApproval(v, userId, false, comment));
  }, []);

  const prepareRollback = useCallback((targetVersionId: string): RollbackPlan | null => {
    if (!currentVersion) return null;
    const target = versions.find(v => v.versionId === targetVersionId);
    if (!target) return null;
    const plan = planRollback(currentVersion, target, versions);
    setRollbackPlan(plan);
    return plan;
  }, [currentVersion, versions]);

  const executeRollback = useCallback(() => {
    if (!rollbackPlan) return;
    setCurrentVersionId(rollbackPlan.targetVersionId);
    setRollbackPlan(null);
  }, [rollbackPlan]);

  return {
    versions, currentVersion, rollbackPlan, canModify, modifyReason,
    loadVersions, lock, unlock, submitForApproval, approve, reject, prepareRollback, executeRollback,
  };
}

export default useVersionGovernance;
