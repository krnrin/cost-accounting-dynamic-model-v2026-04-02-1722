export type VersionStatus = 'draft' | 'bom_ready' | 'reviewed' | 'locked' | 'archived';

export interface VersionSnapshot {
  /** Snapshot of all harness inputs at version creation time */
  harnesses: Array<{
    harnessId: string;
    harnessName: string;
    input: import('./harness').HarnessInput;
  }>;
  /** Snapshot of project config */
  config: import('./project').ProjectConfig;
  /** Computed summary at snapshot time */
  summary: {
    vehicleCost: number;
    totalMaterial: number;
    totalLabor: number;
    harnessCount: number;
  };
}

export interface VersionRecord {
  id: string;
  projectId: string;
  /** Version number (v1, v2, ...) */
  versionNumber: number;
  /** User-defined label */
  label: string;
  status: VersionStatus;
  snapshot: VersionSnapshot;
  /** Who created this version */
  createdBy?: string;
  createdAt: string;
  /** Optional notes */
  notes?: string;
}

export interface VersionDiffItem {
  field: string;
  label: string;
  before: number;
  after: number;
  delta: number;
  deltaPercent: number;
}

export interface VersionDiff {
  beforeVersion: string;
  afterVersion: string;
  projectLevel: VersionDiffItem[];
  harnessLevel: Array<{
    harnessId: string;
    harnessName: string;
    diffs: VersionDiffItem[];
  }>;
}

/** Valid state transitions */
export const VERSION_TRANSITIONS: Record<VersionStatus, VersionStatus[]> = {
  draft: ['bom_ready'],
  bom_ready: ['reviewed', 'draft'],
  reviewed: ['locked', 'bom_ready'],
  locked: ['archived'],
  archived: [],
};

export const VERSION_STATUS_LABELS: Record<VersionStatus, string> = {
  draft: '草稿',
  bom_ready: 'BOM就绪',
  reviewed: '已审核',
  locked: '已锁定',
  archived: '已归档',
};

export function validateTransition(current: VersionStatus, next: VersionStatus): { valid: boolean; reason?: string } {
  if (current === next) {
    return { valid: true };
  }

  const allowed = VERSION_TRANSITIONS[current];
  if (!allowed.includes(next)) {
    return { 
      valid: false, 
      reason: `从 [${VERSION_STATUS_LABELS[current]}] 切换到 [${VERSION_STATUS_LABELS[next]}] 是非法操作` 
    };
  }

  // Special rule: can't lock if status is still 'draft' (must go through bom_ready first)
  // Although VERSION_TRANSITIONS already prevents draft -> locked, we add it explicitly as requested.
  if (next === 'locked' && current === 'draft') {
    return { valid: false, reason: '草稿版本必须先标记为BOM就绪并经过审核才能锁定' };
  }

  return { valid: true };
}

export function isVersionEditable(status: VersionStatus): boolean {
  return status === 'draft' || status === 'bom_ready';
}
