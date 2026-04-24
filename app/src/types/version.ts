export type VersionStatus = 'draft' | 'bom_ready' | 'reviewed' | 'locked' | 'published' | 'archived';

export interface VersionSnapshot {
  scenario?: {
    id: string;
    scenarioCode: string;
    scenarioName: string;
    configSkus?: import('./harness').ConfigSku[];
    harnessConfigMappings?: import('./harness').HarnessConfigMapping[];
    vehicleConfigs?: import('./harness').VehicleConfig[];
  };
  harnesses: Array<{
    harnessId: string;
    harnessName: string;
    input: import('./harness').HarnessInput;
  }>;
  config: import('./project').ProjectConfig;
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
  scenarioId?: string;
  versionNumber: number;
  label: string;
  status: VersionStatus;
  snapshot: VersionSnapshot;
  createdBy?: string;
  createdAt: string;
  notes?: string;
  parentVersionId?: string;
  snapshotRefs?: {
    quoteSnapshotIds?: string[];
    settingsSnapshotIds?: string[];
  };
  lockInfo?: {
    locked: boolean;
    lockedAt?: string;
    lockedBy?: string;
    reason?: string;
  };
  approvalInfo?: {
    status: 'not_submitted' | 'pending' | 'approved' | 'rejected';
    submittedAt?: string;
    submittedBy?: string;
    reviewedAt?: string;
    reviewedBy?: string;
    comment?: string;
  };
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

export const VERSION_TRANSITIONS: Record<VersionStatus, VersionStatus[]> = {
  draft: ['bom_ready'],
  bom_ready: ['reviewed', 'draft'],
  reviewed: ['locked', 'bom_ready'],
  locked: ['archived'],
  published: ['archived'],
  archived: [],
};

export const VERSION_STATUS_LABELS: Record<VersionStatus, string> = {
  draft: '草稿',
  bom_ready: 'BOM就绪',
  reviewed: '已审核',
  locked: '已锁定',
  published: '已发布',
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
      reason: `从[${VERSION_STATUS_LABELS[current]}]切换到[${VERSION_STATUS_LABELS[next]}]是非法操作`,
    };
  }

  if (next === 'locked' && current === 'draft') {
    return { valid: false, reason: '草稿版本必须先标记为BOM就绪并经过审核后才能锁定' };
  }

  return { valid: true };
}

export function isVersionEditable(status: VersionStatus): boolean {
  return status === 'draft' || status === 'bom_ready';
}
