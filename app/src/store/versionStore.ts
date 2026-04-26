import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { db } from '@/data/db';
import { requireScenarioConfig, requireScenarioRecord } from '@/data/scenarioGuards';
import {
  applyInstallationRatiosToHarnessInputs,
  resolveScenarioVehicleConfigs,
} from '@/engine/configuration_model';
import { computeHarnessCost, computeProjectFromHarnesses } from '@/engine/harness_costing';
import { buildChangeComparisonTable, computeChangePricing } from '@/engine/change_pricing';
import { computeVersionDiff } from '@/engine/version_diff';
import {
  broadcastStoreInvalidation,
  subscribeToStoreInvalidation,
  isBroadcastChannelSupported,
} from '@/lib/crossTabSync';
import type { ChangePricingResult } from '@/types/quote';
import type { HarnessRecord, ScenarioRecord } from '@/data/db';
import type { VersionDiff, VersionRecord, VersionSnapshot, VersionStatus } from '@/types/version';
import { validateTransition } from '@/types/version';

interface CreateSnapshotOptions {
  projectId: string;
  scenarioId: string;
  label?: string;
  notes?: string;
  parentVersionId?: string;
  createdBy?: string;
}

interface ApprovalOptions {
  userId?: string;
  comment?: string;
}

interface LockOptions {
  userId?: string;
  reason?: string;
}

interface VersionState {
  projectId: string | null;
  scenarioId: string | null;
  versions: VersionRecord[];
  loading: boolean;
  error: string | null;
  baseVersionId: string | null;
  compareVersionId: string | null;
  changePricingResult: ChangePricingResult | null;
  versionDiffResult: VersionDiff | null;
  comparisonTable: ReturnType<typeof buildChangeComparisonTable> | null;
  /** 请求序号，用于丢弃过期回调 */
  _requestId: number;

  loadVersions: (projectId: string, scenarioId?: string | null) => Promise<void>;
  createSnapshot: (options: CreateSnapshotOptions) => Promise<VersionRecord>;
  deleteVersion: (versionId: string) => Promise<void>;
  updateLabel: (versionId: string, label: string, notes?: string) => Promise<void>;
  updateStatus: (versionId: string, status: VersionStatus) => Promise<void>;
  lockVersion: (versionId: string, options?: LockOptions) => Promise<void>;
  unlockVersion: (versionId: string, options?: LockOptions) => Promise<void>;
  submitApproval: (versionId: string, options?: ApprovalOptions) => Promise<void>;
  approveVersion: (versionId: string, options?: ApprovalOptions) => Promise<void>;
  rejectVersion: (versionId: string, options?: ApprovalOptions) => Promise<void>;
  restoreSnapshot: (versionId: string) => Promise<void>;
  setCompareVersions: (baseId: string | null, compareId: string | null) => void;
  runComparison: () => Promise<void>;
  clear: () => void;
}

function cloneSnapshotInput<T>(value: T): T {
  return structuredClone(value);
}

function buildSnapshotScenarioMeta(
  scenario: Pick<ScenarioRecord, 'id' | 'scenarioCode' | 'scenarioName' | 'configSkus' | 'harnessConfigMappings' | 'vehicleConfigs'>,
): NonNullable<VersionSnapshot['scenario']> {
  return {
    id: scenario.id,
    scenarioCode: scenario.scenarioCode,
    scenarioName: scenario.scenarioName,
    configSkus: cloneSnapshotInput(scenario.configSkus),
    harnessConfigMappings: cloneSnapshotInput(scenario.harnessConfigMappings),
    vehicleConfigs: cloneSnapshotInput(scenario.vehicleConfigs),
  };
}

function computeSnapshotProjectResult(snapshot: Pick<VersionSnapshot, 'scenario' | 'harnesses' | 'config'>) {
  const vehicleConfigs = resolveScenarioVehicleConfigs({
    vehicleConfigs: snapshot.scenario?.vehicleConfigs,
    configSkus: snapshot.scenario?.configSkus,
    harnessConfigMappings: snapshot.scenario?.harnessConfigMappings,
  });
  const inputs = applyInstallationRatiosToHarnessInputs(
    snapshot.harnesses.map((record) => cloneSnapshotInput(record.input)),
    vehicleConfigs,
    snapshot.scenario?.harnessConfigMappings ?? [],
  );
  const results = inputs.map((input) =>
    computeHarnessCost(input, snapshot.config.costRates, snapshot.config.metalPrices),
  );
  return computeProjectFromHarnesses(results);
}

function buildSnapshotFromScenario(
  scenario: Pick<ScenarioRecord, 'id' | 'scenarioCode' | 'scenarioName' | 'config' | 'configSkus' | 'harnessConfigMappings' | 'vehicleConfigs'>,
  harnesses: HarnessRecord[],
): VersionSnapshot {
  const scenarioConfig = requireScenarioConfig(scenario, 'buildSnapshotFromScenario');
  const orderedHarnesses = [...harnesses].sort((left, right) => left.harnessId.localeCompare(right.harnessId));
  const snapshot: VersionSnapshot = {
    scenario: buildSnapshotScenarioMeta(scenario),
    harnesses: orderedHarnesses.map((record) => ({
      harnessId: record.harnessId,
      harnessName: record.harnessName,
      input: cloneSnapshotInput(record.input),
    })),
    config: cloneSnapshotInput(scenarioConfig),
    summary: {
      vehicleCost: 0,
      totalMaterial: 0,
      totalLabor: 0,
      harnessCount: orderedHarnesses.length,
    },
  };
  const summary = computeSnapshotProjectResult(snapshot);

  return {
    ...snapshot,
    summary: {
      vehicleCost: summary.vehicleCost,
      totalMaterial: summary.weightedMaterial,
      totalLabor: summary.weightedLabor,
      harnessCount: summary.harnessCount,
    },
  };
}

async function createVersionSnapshot(options: CreateSnapshotOptions): Promise<VersionRecord> {
  const scenario = requireScenarioRecord(
    await db.scenarios.get(options.scenarioId),
    'createSnapshot',
  );
  if (scenario.projectId !== options.projectId) {
    throw new Error('version snapshot project/scenario mismatch');
  }

  const harnesses = await db.harnesses.where('scenarioId').equals(options.scenarioId).sortBy('harnessId');
  const versions = await db.versions.where('scenarioId').equals(options.scenarioId).toArray();
  const nextVersionNumber = versions.reduce((max, item) => Math.max(max, item.versionNumber), 0) + 1;
  const snapshot = buildSnapshotFromScenario(scenario, harnesses);

  const now = new Date().toISOString();
  const record: VersionRecord = {
    id: crypto.randomUUID(),
    projectId: options.projectId,
    scenarioId: options.scenarioId,
    versionNumber: nextVersionNumber,
    label: (options.label || `v${nextVersionNumber}`).trim(),
    status: 'draft',
    snapshot,
    createdBy: options.createdBy || 'local-user',
    createdAt: now,
    notes: options.notes?.trim() || undefined,
    parentVersionId: options.parentVersionId,
    lockInfo: { locked: false },
    approvalInfo: { status: 'not_submitted' },
  };

  await db.versions.put(record);
  return record;
}

async function reloadVersions(projectId: string, scenarioId?: string | null): Promise<VersionRecord[]> {
  const query = scenarioId
    ? await db.versions.where('scenarioId').equals(scenarioId).toArray()
    : await db.versions.where('projectId').equals(projectId).toArray();
  return query.sort((left, right) => right.versionNumber - left.versionNumber);
}

export const useVersionStore = create<VersionState>()(
  devtools(
    (set, get) => ({
      projectId: null,
      scenarioId: null,
      versions: [],
      loading: false,
      error: null,
      baseVersionId: null,
      compareVersionId: null,
      changePricingResult: null,
      versionDiffResult: null,
      comparisonTable: null,
      _requestId: 0,

      loadVersions: async (projectId, scenarioId = null) => {
        const requestId = get()._requestId + 1;
        set({ loading: true, _requestId: requestId });
        try {
          const versions = await reloadVersions(projectId, scenarioId);
          // 丢弃过期回调
          if (get()._requestId !== requestId) {
            return;
          }
          set((state) => ({
            projectId,
            scenarioId,
            versions,
            loading: false,
            baseVersionId: state.baseVersionId && versions.some((item) => item.id === state.baseVersionId)
              ? state.baseVersionId
              : versions[1]?.id ?? null,
            compareVersionId: state.compareVersionId && versions.some((item) => item.id === state.compareVersionId)
              ? state.compareVersionId
              : versions[0]?.id ?? null,
          }));
        } catch (error) {
          console.error('loadVersions error:', error);
          // 丢弃过期回调
          if (get()._requestId !== requestId) {
            return;
          }
          set({ loading: false });
          throw error;
        }
      },

      createSnapshot: async (options) => {
        const record = await createVersionSnapshot(options);
        await get().loadVersions(options.projectId, options.scenarioId);
        broadcastStoreInvalidation('version-store', { projectId: options.projectId, scenarioId: options.scenarioId });
        return record;
      },

      deleteVersion: async (versionId) => {
        const record = await db.versions.get(versionId);
        if (!record) {
          throw new Error('版本不存在');
        }
        if (record.status !== 'draft') {
          throw new Error('仅草稿版本允许删除');
        }

        await db.versions.delete(versionId);
        await get().loadVersions(record.projectId, record.scenarioId ?? null);
        broadcastStoreInvalidation('version-store', { projectId: record.projectId, scenarioId: record.scenarioId ?? undefined });
      },

      updateLabel: async (versionId, label, notes) => {
        const record = await db.versions.get(versionId);
        if (!record) {
          throw new Error('版本不存在');
        }

        await db.versions.update(versionId, {
          label: label.trim(),
          notes: notes?.trim() || undefined,
        });
        await get().loadVersions(record.projectId, record.scenarioId ?? null);
        broadcastStoreInvalidation('version-store', { projectId: record.projectId, scenarioId: record.scenarioId ?? undefined });
      },

      updateStatus: async (versionId, status) => {
        const record = await db.versions.get(versionId);
        if (!record) {
          throw new Error('版本不存在');
        }
        const validation = validateTransition(record.status, status);
        if (!validation.valid) {
          throw new Error(validation.reason || '非法版本状态流转');
        }

        await db.versions.update(versionId, { status });
        await get().loadVersions(record.projectId, record.scenarioId ?? null);
      },

      lockVersion: async (versionId, options) => {
        const record = await db.versions.get(versionId);
        if (!record) {
          throw new Error('版本不存在');
        }
        // 状态流转校验
        const targetStatus: VersionStatus = record.status === 'draft' ? 'locked' : record.status;
        const validation = validateTransition(record.status, targetStatus);
        if (!validation.valid) {
          throw new Error(validation.reason || '非法版本状态流转');
        }
        const now = new Date().toISOString();
        await db.versions.update(versionId, {
          status: targetStatus,
          lockInfo: {
            locked: true,
            lockedAt: now,
            lockedBy: options?.userId || 'local-user',
            reason: options?.reason || record.lockInfo?.reason,
          },
        });
        await get().loadVersions(record.projectId, record.scenarioId ?? null);
      },

      unlockVersion: async (versionId, options) => {
        const record = await db.versions.get(versionId);
        if (!record) {
          throw new Error('版本不存在');
        }
        // 解锁后回到 reviewed 状态
        const targetStatus: VersionStatus = record.status === 'locked' ? 'reviewed' : record.status;
        const validation = validateTransition(record.status, targetStatus);
        if (!validation.valid) {
          throw new Error(validation.reason || '非法版本状态流转');
        }
        await db.versions.update(versionId, {
          status: targetStatus,
          lockInfo: {
            locked: false,
            lockedAt: record.lockInfo?.lockedAt,
            lockedBy: options?.userId || record.lockInfo?.lockedBy,
            reason: options?.reason || record.lockInfo?.reason,
          },
        });
        await get().loadVersions(record.projectId, record.scenarioId ?? null);
      },

      submitApproval: async (versionId, options) => {
        const record = await db.versions.get(versionId);
        if (!record) {
          throw new Error('版本不存在');
        }
        const now = new Date().toISOString();
        await db.versions.update(versionId, {
          approvalInfo: {
            ...(record.approvalInfo ?? { status: 'not_submitted' }),
            status: 'pending',
            submittedAt: now,
            submittedBy: options?.userId || 'local-user',
            comment: options?.comment,
          },
        });
        await get().loadVersions(record.projectId, record.scenarioId ?? null);
      },

      approveVersion: async (versionId, options) => {
        const record = await db.versions.get(versionId);
        if (!record) {
          throw new Error('版本不存在');
        }
        // 审批通过后状态流转
        const targetStatus: VersionStatus = record.status === 'draft' ? 'reviewed' : record.status;
        const validation = validateTransition(record.status, targetStatus);
        if (!validation.valid) {
          throw new Error(validation.reason || '非法版本状态流转');
        }
        const now = new Date().toISOString();
        await db.versions.update(versionId, {
          status: targetStatus,
          approvalInfo: {
            ...(record.approvalInfo ?? { status: 'not_submitted' }),
            status: 'approved',
            reviewedAt: now,
            reviewedBy: options?.userId || 'local-user',
            comment: options?.comment,
          },
        });
        await get().loadVersions(record.projectId, record.scenarioId ?? null);
      },

      rejectVersion: async (versionId, options) => {
        const record = await db.versions.get(versionId);
        if (!record) {
          throw new Error('版本不存在');
        }
        // 驳回后状态不变，但记录审批信息
        const now = new Date().toISOString();
        await db.versions.update(versionId, {
          approvalInfo: {
            ...(record.approvalInfo ?? { status: 'not_submitted' }),
            status: 'rejected',
            reviewedAt: now,
            reviewedBy: options?.userId || 'local-user',
            comment: options?.comment,
          },
        });
        await get().loadVersions(record.projectId, record.scenarioId ?? null);
      },

      restoreSnapshot: async (versionId) => {
        const record = await db.versions.get(versionId);
        if (!record || !record.scenarioId) {
          throw new Error('版本不存在或缺少场景绑定');
        }

        // 状态校验：只有 reviewed/published 且 locked 的版本可以恢复
        if (!['reviewed', 'published'].includes(record.status)) {
          throw new Error('只有已审核或已发布的版本可以恢复');
        }
        if (!record.lockInfo?.locked) {
          throw new Error('只有已锁定的版本可以恢复');
        }

        const scenario = requireScenarioRecord(
          await db.scenarios.get(record.scenarioId),
          'restoreSnapshot',
        );
        const config = cloneSnapshotInput(record.snapshot.config);
        const now = new Date().toISOString();

        await db.transaction('rw', [db.scenarios, db.harnesses], async () => {
          await db.scenarios.update(scenario.id, {
            config,
            vehicleConfigs: cloneSnapshotInput(record.snapshot.scenario?.vehicleConfigs),
            configSkus: cloneSnapshotInput(record.snapshot.scenario?.configSkus),
            harnessConfigMappings: cloneSnapshotInput(record.snapshot.scenario?.harnessConfigMappings),
            updatedAt: now,
          });

          const existingHarnesses = await db.harnesses.where('scenarioId').equals(scenario.id).toArray();
          const existingByHarnessId = new Map(existingHarnesses.map((item) => [item.harnessId, item]));
          const snapshotHarnessIds = new Set(record.snapshot.harnesses.map((item) => item.harnessId));

          for (const harness of record.snapshot.harnesses) {
            const result = computeHarnessCost(harness.input, config.costRates, config.metalPrices);
            const current = existingByHarnessId.get(harness.harnessId);
            if (current) {
              await db.harnesses.update(current.id, {
                harnessName: harness.harnessName,
                input: cloneSnapshotInput(harness.input),
                result,
                updatedAt: now,
              });
              continue;
            }

            await db.harnesses.add({
              id: crypto.randomUUID(),
              projectId: record.projectId,
              scenarioId: scenario.id,
              harnessId: harness.harnessId,
              harnessName: harness.harnessName,
              input: cloneSnapshotInput(harness.input),
              result,
              eopYear: null,
              updatedAt: now,
            });
          }

          const obsoleteHarnessIds = existingHarnesses
            .filter((item) => !snapshotHarnessIds.has(item.harnessId))
            .map((item) => item.id);
          if (obsoleteHarnessIds.length > 0) {
            await db.harnesses.bulkDelete(obsoleteHarnessIds);
          }
        });

        await get().loadVersions(record.projectId, record.scenarioId);
      },

      setCompareVersions: (baseVersionId, compareVersionId) => {
        set({
          baseVersionId,
          compareVersionId,
          changePricingResult: null,
          versionDiffResult: null,
          comparisonTable: null,
        });
      },

      runComparison: async () => {
        const { versions, baseVersionId, compareVersionId } = get();
        if (!baseVersionId || !compareVersionId) {
          throw new Error('请先选择对比版本');
        }
        if (baseVersionId === compareVersionId) {
          throw new Error('基准版本和对比版本不能相同');
        }

        const baseVersion = versions.find((item) => item.id === baseVersionId);
        const compareVersion = versions.find((item) => item.id === compareVersionId);
        if (!baseVersion || !compareVersion) {
          throw new Error('待对比版本不存在');
        }

        const baseProject = computeSnapshotProjectResult(baseVersion.snapshot);
        const compareProject = computeSnapshotProjectResult(compareVersion.snapshot);
        const changePricingResult = computeChangePricing(baseProject, compareProject, 'version_compare');
        const versionDiffResult = computeVersionDiff(baseVersion.snapshot, compareVersion.snapshot);
        versionDiffResult.beforeVersion = `v${baseVersion.versionNumber} (${baseVersion.label})`;
        versionDiffResult.afterVersion = `v${compareVersion.versionNumber} (${compareVersion.label})`;

        set({
          changePricingResult,
          versionDiffResult,
          comparisonTable: buildChangeComparisonTable(changePricingResult),
        });
      },

      clear: () => {
        set({
          projectId: null,
          scenarioId: null,
          versions: [],
          loading: false,
          error: null,
          baseVersionId: null,
          compareVersionId: null,
          changePricingResult: null,
          versionDiffResult: null,
          comparisonTable: null,
          _requestId: 0,
        });
      },
    }),
    { name: 'version-store' },
  ),
);

// 跨 Tab 同步订阅
if (isBroadcastChannelSupported()) {
  subscribeToStoreInvalidation((message) => {
    if (message.storeName === 'version-store') {
      const state = useVersionStore.getState();
      // 如果消息来自其他 tab 且涉及当前项目，重新加载
      if (state.projectId && (!message.projectId || message.projectId === state.projectId)) {
        void state.loadVersions(state.projectId, state.scenarioId);
      }
    }
  });
}
