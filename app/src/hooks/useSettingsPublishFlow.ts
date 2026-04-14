/**
 * useSettingsPublishFlow Hook (C26 — Issue #78)
 * 
 * React Hook for settings publish flow + environment switching
 */

import { useState, useCallback, useMemo } from 'react';
import {
  createPublishVersion,
  deployToStaging,
  submitForPublishApproval,
  approveAndPublish,
  rejectPublish,
  rollbackPublish,
  diffEnvironments,
  type PublishVersion,
  type PublishState,
  type EnvironmentDiff,
} from '@/engine/settings_publish_flow';

export type ActiveEnvironment = 'staging' | 'production';

export interface UseSettingsPublishFlowReturn {
  versions: PublishVersion[];
  currentVersion: PublishVersion | null;
  activeEnv: ActiveEnvironment;
  envDiff: EnvironmentDiff[];

  createVersion: (scenarioId: string, settings: Record<string, unknown>, userId: string, changelog?: string) => PublishVersion;
  toStaging: (versionId: string) => { success: boolean; error?: string };
  submitApproval: (versionId: string, userId: string, approver: string) => { success: boolean; error?: string };
  approve: (versionId: string, userId: string, comment?: string) => { success: boolean; error?: string };
  reject: (versionId: string, userId: string, comment: string) => { success: boolean; error?: string };
  rollback: (versionId: string) => { success: boolean; error?: string };
  switchEnv: (env: ActiveEnvironment) => void;
  compareEnvs: (stagingSettings: Record<string, unknown>, prodSettings: Record<string, unknown>) => EnvironmentDiff[];
}

export function useSettingsPublishFlow(): UseSettingsPublishFlowReturn {
  const [versions, setVersions] = useState<PublishVersion[]>([]);
  const [activeEnv, setActiveEnv] = useState<ActiveEnvironment>('production');
  const [envDiff, setEnvDiff] = useState<EnvironmentDiff[]>([]);

  const currentVersion = useMemo(() => {
    const published = versions.filter(v => v.state === 'published');
    if (published.length > 0) return published[published.length - 1]!;
    return versions[versions.length - 1] || null;
  }, [versions]);

  const updateVersion = (id: string, updater: (v: PublishVersion) => PublishVersion) => {
    setVersions(prev => prev.map(v => v.id === id ? updater(v) : v));
  };

  const createVersion = useCallback((scenarioId: string, settings: Record<string, unknown>, userId: string, changelog: string = ''): PublishVersion => {
    const v = createPublishVersion(scenarioId, settings, userId, changelog);
    setVersions(prev => [...prev, v]);
    return v;
  }, []);

  const toStaging = useCallback((versionId: string) => {
    const v = versions.find(v => v.id === versionId);
    if (!v) return { success: false, error: '版本不存在' };
    const result = deployToStaging(v);
    if (result.success) updateVersion(versionId, () => result.version);
    return { success: result.success, error: result.error };
  }, [versions]);

  const submitApproval = useCallback((versionId: string, userId: string, approver: string) => {
    const v = versions.find(v => v.id === versionId);
    if (!v) return { success: false, error: '版本不存在' };
    const result = submitForPublishApproval(v, userId, approver);
    if (result.success) updateVersion(versionId, () => result.version);
    return { success: result.success, error: result.error };
  }, [versions]);

  const approve = useCallback((versionId: string, userId: string, comment: string = '') => {
    const v = versions.find(v => v.id === versionId);
    if (!v) return { success: false, error: '版本不存在' };
    const result = approveAndPublish(v, userId, comment);
    if (result.success) updateVersion(versionId, () => result.version);
    return { success: result.success, error: result.error };
  }, [versions]);

  const reject = useCallback((versionId: string, userId: string, comment: string) => {
    const v = versions.find(v => v.id === versionId);
    if (!v) return { success: false, error: '版本不存在' };
    const result = rejectPublish(v, userId, comment);
    if (result.success) updateVersion(versionId, () => result.version);
    return { success: result.success, error: result.error };
  }, [versions]);

  const rollback = useCallback((versionId: string) => {
    const v = versions.find(v => v.id === versionId);
    if (!v) return { success: false, error: '版本不存在' };
    const result = rollbackPublish(v);
    if (result.success) updateVersion(versionId, () => result.version);
    return { success: result.success, error: result.error };
  }, [versions]);

  const switchEnv = useCallback((env: ActiveEnvironment) => {
    setActiveEnv(env);
  }, []);

  const compareEnvs = useCallback((stagingSettings: Record<string, unknown>, prodSettings: Record<string, unknown>): EnvironmentDiff[] => {
    const diff = diffEnvironments(stagingSettings, prodSettings);
    setEnvDiff(diff);
    return diff;
  }, []);

  return {
    versions, currentVersion, activeEnv, envDiff,
    createVersion, toStaging, submitApproval, approve, reject, rollback, switchEnv, compareEnvs,
  };
}

export default useSettingsPublishFlow;
