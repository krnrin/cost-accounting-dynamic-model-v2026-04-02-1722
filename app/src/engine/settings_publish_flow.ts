/**
 * Settings Publish Flow (C26 — Issue #78)
 * 
 * 参数发布流 + 权限隔离
 * - 设置发布流状态机: draft → staging → pending_approval → published
 * - 环境隔离: staging环境预览 vs production生效
 * - 审批流: 发布前需要审批
 * - 回退: 一键回退到上一个发布版本
 */

// ─── Types ───

export type PublishState = 'draft' | 'staging' | 'pending_approval' | 'published' | 'rolled_back';

export interface PublishVersion {
  id: string;
  scenarioId: string;
  state: PublishState;
  createdAt: string;
  createdBy: string;
  settings: Record<string, unknown>;
  changelog: string;
  approvalInfo: PublishApproval | null;
  publishedAt: string | null;
  environment: 'staging' | 'production';
}

export interface PublishApproval {
  requestedBy: string;
  requestedAt: string;
  approver: string | null;
  status: 'pending' | 'approved' | 'rejected';
  respondedAt: string | null;
  comment: string;
}

export interface PublishTransitionResult {
  success: boolean;
  version: PublishVersion;
  error?: string;
  needsApproval?: boolean;
}

export interface EnvironmentDiff {
  field: string;
  label: string;
  stagingValue: unknown;
  productionValue: unknown;
  changed: boolean;
}

// ─── Valid Transitions ───

const TRANSITIONS: Record<PublishState, PublishState[]> = {
  draft: ['staging'],
  staging: ['draft', 'pending_approval'],
  pending_approval: ['staging', 'published'],
  published: ['rolled_back'],
  rolled_back: ['draft'],
};

// ─── Core Functions ───

/** Create a new publish version */
export function createPublishVersion(
  scenarioId: string,
  settings: Record<string, unknown>,
  createdBy: string,
  changelog: string = '',
): PublishVersion {
  return {
    id: `pub-${scenarioId}-${Date.now().toString(36)}`,
    scenarioId,
    state: 'draft',
    createdAt: new Date().toISOString(),
    createdBy,
    settings: JSON.parse(JSON.stringify(settings)),
    changelog,
    approvalInfo: null,
    publishedAt: null,
    environment: 'staging',
  };
}

/** Check if a transition is valid */
export function canTransitionPublish(from: PublishState, to: PublishState): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/** Deploy to staging environment */
export function deployToStaging(version: PublishVersion): PublishTransitionResult {
  if (!canTransitionPublish(version.state, 'staging')) {
    return { success: false, version, error: `不能从 ${version.state} 部署到staging` };
  }
  return {
    success: true,
    version: { ...version, state: 'staging', environment: 'staging' },
  };
}

/** Submit for approval */
export function submitForPublishApproval(
  version: PublishVersion,
  requestedBy: string,
  approver: string,
): PublishTransitionResult {
  if (!canTransitionPublish(version.state, 'pending_approval')) {
    return { success: false, version, error: `不能从 ${version.state} 提交审批` };
  }
  return {
    success: true,
    needsApproval: true,
    version: {
      ...version,
      state: 'pending_approval',
      approvalInfo: {
        requestedBy,
        requestedAt: new Date().toISOString(),
        approver,
        status: 'pending',
        respondedAt: null,
        comment: '',
      },
    },
  };
}

/** Approve and publish to production */
export function approveAndPublish(
  version: PublishVersion,
  approver: string,
  comment: string = '',
): PublishTransitionResult {
  if (version.state !== 'pending_approval') {
    return { success: false, version, error: '仅审批中的版本可以审批发布' };
  }
  return {
    success: true,
    version: {
      ...version,
      state: 'published',
      environment: 'production',
      publishedAt: new Date().toISOString(),
      approvalInfo: version.approvalInfo ? {
        ...version.approvalInfo,
        approver,
        status: 'approved',
        respondedAt: new Date().toISOString(),
        comment,
      } : null,
    },
  };
}

/** Reject and return to staging */
export function rejectPublish(
  version: PublishVersion,
  approver: string,
  comment: string,
): PublishTransitionResult {
  if (version.state !== 'pending_approval') {
    return { success: false, version, error: '仅审批中的版本可以驳回' };
  }
  return {
    success: true,
    version: {
      ...version,
      state: 'staging',
      approvalInfo: version.approvalInfo ? {
        ...version.approvalInfo,
        approver,
        status: 'rejected',
        respondedAt: new Date().toISOString(),
        comment,
      } : null,
    },
  };
}

/** Rollback a published version */
export function rollbackPublish(version: PublishVersion): PublishTransitionResult {
  if (version.state !== 'published') {
    return { success: false, version, error: '仅已发布版本可以回退' };
  }
  return {
    success: true,
    version: { ...version, state: 'rolled_back' },
  };
}

/** Compare staging vs production settings */
export function diffEnvironments(
  staging: Record<string, unknown>,
  production: Record<string, unknown>,
  fieldLabels: Record<string, string> = {},
): EnvironmentDiff[] {
  const allKeys = new Set([...Object.keys(staging), ...Object.keys(production)]);
  const diffs: EnvironmentDiff[] = [];

  for (const key of allKeys) {
    const sv = staging[key];
    const pv = production[key];
    diffs.push({
      field: key,
      label: fieldLabels[key] || key,
      stagingValue: sv,
      productionValue: pv,
      changed: JSON.stringify(sv) !== JSON.stringify(pv),
    });
  }

  return diffs;
}
