/**
 * Version Governance (C23 — Issue #74)
 * 
 * 版本治理完善 — 锁定/审批/回退
 * - 版本锁定: 防止已发布版本被意外修改
 * - 审批流: 版本发布需要审批
 * - 回退策略: 安全回退到任意历史版本
 */

// ─── Types ───

export interface VersionEntry {
  versionId: string;
  scenarioId: string;
  label: string;
  createdAt: string;
  createdBy: string;
  status: VersionStatus;
  lockInfo: LockInfo | null;
  approvalInfo: ApprovalInfo | null;
  snapshotRefs: {
    rateSnapshotId?: string;
    bomSnapshotId?: string;
    quoteParamRefId?: string;
  };
  parentVersionId: string | null;
}

export type VersionStatus = 'draft' | 'pending_approval' | 'approved' | 'published' | 'locked' | 'deprecated';

export interface LockInfo {
  lockedAt: string;
  lockedBy: string;
  reason: string;
  expiresAt: string | null;
}

export interface ApprovalInfo {
  requestedAt: string;
  requestedBy: string;
  approvers: string[];
  status: 'pending' | 'approved' | 'rejected';
  respondedAt: string | null;
  respondedBy: string | null;
  comment: string;
}

export interface RollbackPlan {
  targetVersionId: string;
  currentVersionId: string;
  affectedModules: string[];
  snapshotsToRestore: string[];
  risks: string[];
  requiresApproval: boolean;
}

// ─── Core Functions ───

/** Lock a version to prevent modifications */
export function lockVersion(
  version: VersionEntry,
  lockedBy: string,
  reason: string,
  expiresAt: string | null = null,
): VersionEntry {
  return {
    ...version,
    status: 'locked',
    lockInfo: {
      lockedAt: new Date().toISOString(),
      lockedBy,
      reason,
      expiresAt,
    },
  };
}

/** Unlock a version */
export function unlockVersion(version: VersionEntry): VersionEntry {
  if (version.status !== 'locked') return version;
  return {
    ...version,
    status: version.approvalInfo?.status === 'approved' ? 'approved' : 'draft',
    lockInfo: null,
  };
}

/** Check if a version lock has expired */
export function isLockExpired(version: VersionEntry): boolean {
  if (!version.lockInfo || !version.lockInfo.expiresAt) return false;
  return new Date() > new Date(version.lockInfo.expiresAt);
}

/** Request approval for a version */
export function requestApproval(
  version: VersionEntry,
  requestedBy: string,
  approvers: string[],
): VersionEntry {
  return {
    ...version,
    status: 'pending_approval',
    approvalInfo: {
      requestedAt: new Date().toISOString(),
      requestedBy,
      approvers,
      status: 'pending',
      respondedAt: null,
      respondedBy: null,
      comment: '',
    },
  };
}

/** Approve or reject a version */
export function respondToApproval(
  version: VersionEntry,
  respondedBy: string,
  approved: boolean,
  comment: string = '',
): VersionEntry {
  if (!version.approvalInfo || version.approvalInfo.status !== 'pending') return version;
  return {
    ...version,
    status: approved ? 'approved' : 'draft',
    approvalInfo: {
      ...version.approvalInfo,
      status: approved ? 'approved' : 'rejected',
      respondedAt: new Date().toISOString(),
      respondedBy,
      comment,
    },
  };
}

/** Generate a rollback plan */
export function planRollback(
  current: VersionEntry,
  target: VersionEntry,
  allVersions: VersionEntry[],
): RollbackPlan {
  const affectedModules: string[] = [];
  const snapshotsToRestore: string[] = [];
  const risks: string[] = [];

  // Determine affected modules based on snapshot refs
  if (target.snapshotRefs.rateSnapshotId !== current.snapshotRefs.rateSnapshotId) {
    affectedModules.push('费率参数');
    if (target.snapshotRefs.rateSnapshotId) snapshotsToRestore.push(target.snapshotRefs.rateSnapshotId);
  }
  if (target.snapshotRefs.bomSnapshotId !== current.snapshotRefs.bomSnapshotId) {
    affectedModules.push('BOM');
    if (target.snapshotRefs.bomSnapshotId) snapshotsToRestore.push(target.snapshotRefs.bomSnapshotId);
  }
  if (target.snapshotRefs.quoteParamRefId !== current.snapshotRefs.quoteParamRefId) {
    affectedModules.push('报价参数');
    if (target.snapshotRefs.quoteParamRefId) snapshotsToRestore.push(target.snapshotRefs.quoteParamRefId);
  }

  // Assess risks
  if (current.status === 'published') {
    risks.push('当前版本已发布，回退可能影响已生效的报价');
  }
  const intermediateVersions = allVersions.filter(v =>
    new Date(v.createdAt) > new Date(target.createdAt) &&
    new Date(v.createdAt) < new Date(current.createdAt)
  );
  if (intermediateVersions.length > 2) {
    risks.push(`跳过了 ${intermediateVersions.length} 个中间版本，可能遗漏重要变更`);
  }

  return {
    targetVersionId: target.versionId,
    currentVersionId: current.versionId,
    affectedModules,
    snapshotsToRestore,
    risks,
    requiresApproval: current.status === 'published' || current.status === 'locked',
  };
}

/** Check if version can be modified */
export function canModifyVersion(version: VersionEntry): { allowed: boolean; reason?: string } {
  if (version.status === 'locked') {
    if (isLockExpired(version)) return { allowed: true, reason: '锁定已过期' };
    return { allowed: false, reason: `版本已锁定: ${version.lockInfo?.reason}` };
  }
  if (version.status === 'published') {
    return { allowed: false, reason: '已发布版本不可修改，请创建新版本' };
  }
  if (version.status === 'pending_approval') {
    return { allowed: false, reason: '版本正在审批中' };
  }
  return { allowed: true };
}
