/**
 * 版本快照 Zustand Store
 * 管理报价版本的 CRUD、状态流转和对比
 */
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { db } from '@/data/db';
import type { VersionRecord, VersionSnapshot, VersionStatus } from '@/types/version';
import { validateTransition } from '@/types/version';
import { computeHarnessCost, computeProjectFromHarnesses } from '@/engine/harness_costing';
import { computeChangePricing, buildChangeComparisonTable } from '@/engine/change_pricing';
import { computeVersionDiff } from '@/engine/version_diff';
import type { ChangePricingResult } from '@/types/quote';
import type { VersionDiff } from '@/types/version';

interface VersionState {
  /** 当前项目的所有版本 */
  versions: VersionRecord[];
  /** 加载状态 */
  loading: boolean;
  /** 当前选中的基准版本 ID */
  baseVersionId: string | null;
  /** 当前选中的变更版本 ID */
  compareVersionId: string | null;
  /** 对比结果 */
  changePricingResult: ChangePricingResult | null;
  /** 版本 diff 结果 */
  versionDiffResult: VersionDiff | null;
  /** 对比表格数据 */
  comparisonTable: ReturnType<typeof buildChangeComparisonTable> | null;

  /** 加载项目的所有版本 */
  loadVersions: (projectId: string) => Promise<void>;
  /** 创建当前数据的快照 */
  createSnapshot: (projectId: string, label?: string, notes?: string) => Promise<VersionRecord>;
  /** 删除版本（仅 draft 可删） */
  deleteVersion: (versionId: string) => Promise<void>;
  /** 更新版本状态 */
  updateStatus: (versionId: string, newStatus: VersionStatus) => Promise<void>;
  /** 更新版本标签和备注 */
  updateLabel: (versionId: string, label: string, notes?: string) => Promise<void>;
  /** 设置对比版本 */
  setCompareVersions: (baseId: string | null, compareId: string | null) => void;
  /** 执行版本对比 */
  runComparison: () => Promise<void>;
  /** 清空状态 */
  clear: () => void;
}

export const useVersionStore = create<VersionState>()(
  devtools(
    (set, get) => ({
      versions: [],
      loading: false,
      baseVersionId: null,
      compareVersionId: null,
      changePricingResult: null,
      versionDiffResult: null,
      comparisonTable: null,

      loadVersions: async (projectId: string) => {
        set({ loading: true });
        try {
          const records = await db.versions
            .where('projectId')
            .equals(projectId)
            .reverse()
            .sortBy('versionNumber');
          set({ versions: records, loading: false });
        } catch (err) {
          console.error('loadVersions error:', err);
          set({ loading: false });
        }
      },

      createSnapshot: async (projectId: string, label?: string, notes?: string) => {
        // 1. 读取当前项目数据
        const project = await db.projects.get(projectId);
        if (!project) throw new Error('项目不存在');

        const harnessRecords = await db.harnesses
          .where('projectId')
          .equals(projectId)
          .toArray();

        // 2. 计算汇总
        const harnessResults = harnessRecords.map(rec =>
          computeHarnessCost(rec.input, project.config!.costRates, project.config!.metalPrices)
        );
        const projectResult = computeProjectFromHarnesses(harnessResults);

        // 3. 构建快照
        const snapshot: VersionSnapshot = {
          harnesses: harnessRecords.map(rec => ({
            harnessId: rec.harnessId,
            harnessName: rec.harnessName,
            input: JSON.parse(JSON.stringify(rec.input)), // deep clone
          })),
          config: JSON.parse(JSON.stringify(project.config!)),
          summary: {
            vehicleCost: projectResult.vehicleCost,
            totalMaterial: projectResult.weightedMaterial,
            totalLabor: projectResult.weightedLabor,
            harnessCount: projectResult.harnessCount,
          },
        };

        // 4. 确定版本号
        const existingVersions = get().versions;
        const maxVersionNum = existingVersions.reduce(
          (max, v) => Math.max(max, v.versionNumber),
          0
        );
        const newVersionNum = maxVersionNum + 1;

        // 5. 创建记录
        const record: VersionRecord = {
          id: `${projectId}::v${newVersionNum}`,
          projectId,
          versionNumber: newVersionNum,
          label: label || `v${newVersionNum}`,
          status: 'draft' as VersionStatus,
          snapshot,
          createdAt: new Date().toISOString(),
          notes: notes || undefined,
        };

        await db.versions.put(record);

        // 6. 刷新列表
        await get().loadVersions(projectId);

        return record;
      },

      deleteVersion: async (versionId: string) => {
        const record = await db.versions.get(versionId);
        if (!record) throw new Error('版本不存在');
        if (record.status !== 'draft') {
          throw new Error('仅「草稿」状态的版本可以删除');
        }
        await db.versions.delete(versionId);

        // 清空对比（如果删除的是对比版本）
        const state = get();
        if (state.baseVersionId === versionId || state.compareVersionId === versionId) {
          set({
            baseVersionId: null,
            compareVersionId: null,
            changePricingResult: null,
            versionDiffResult: null,
            comparisonTable: null,
          });
        }

        await get().loadVersions(record.projectId);
      },

      updateStatus: async (versionId: string, newStatus: VersionStatus) => {
        const record = await db.versions.get(versionId);
        if (!record) throw new Error('版本不存在');

        const validation = validateTransition(record.status, newStatus);
        if (!validation.valid) {
          throw new Error(validation.reason || '非法状态转换');
        }

        await db.versions.update(versionId, { status: newStatus });
        await get().loadVersions(record.projectId);
      },

      updateLabel: async (versionId: string, label: string, notes?: string) => {
        const record = await db.versions.get(versionId);
        if (!record) throw new Error('版本不存在');

        const updates: Partial<VersionRecord> = { label };
        if (notes !== undefined) updates.notes = notes;
        await db.versions.update(versionId, updates);
        await get().loadVersions(record.projectId);
      },

      setCompareVersions: (baseId: string | null, compareId: string | null) => {
        set({
          baseVersionId: baseId,
          compareVersionId: compareId,
          changePricingResult: null,
          versionDiffResult: null,
          comparisonTable: null,
        });
      },

      runComparison: async () => {
        const { baseVersionId, compareVersionId, versions } = get();
        if (!baseVersionId || !compareVersionId) return;

        const baseVersion = versions.find(v => v.id === baseVersionId);
        const compareVersion = versions.find(v => v.id === compareVersionId);
        if (!baseVersion || !compareVersion) return;

        try {
          // 1. 从快照重新计算项目结果
          const baseResults = baseVersion.snapshot.harnesses.map(h =>
            computeHarnessCost(h.input, baseVersion.snapshot.config.costRates, baseVersion.snapshot.config.metalPrices)
          );
          const baseProject = computeProjectFromHarnesses(baseResults);

          const compareResults = compareVersion.snapshot.harnesses.map(h =>
            computeHarnessCost(h.input, compareVersion.snapshot.config.costRates, compareVersion.snapshot.config.metalPrices)
          );
          const compareProject = computeProjectFromHarnesses(compareResults);

          // 2. 计算变更报价
          const changePricing = computeChangePricing(baseProject, compareProject, 'version_compare');

          // 3. 计算版本 diff
          const versionDiff = computeVersionDiff(baseVersion.snapshot, compareVersion.snapshot);

          // 4. 构建对比表
          const table = buildChangeComparisonTable(changePricing);

          set({
            changePricingResult: changePricing,
            versionDiffResult: versionDiff,
            comparisonTable: table,
          });
        } catch (err) {
          console.error('runComparison error:', err);
        }
      },

      clear: () => {
        set({
          versions: [],
          baseVersionId: null,
          compareVersionId: null,
          changePricingResult: null,
          versionDiffResult: null,
          comparisonTable: null,
        });
      },
    }),
    { name: 'version-store' }
  )
);
