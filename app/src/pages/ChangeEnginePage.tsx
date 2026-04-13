/**
 * 变更引擎页面
 *
 * 功能：
 * 1. 版本快照管理（创建/列表/状态流转/删除）
 * 2. 版本对比（选择基准版本 vs 变更版本）
 * 3. BOM diff + 成本影响分析（KPI卡片 + 对比表 + 瀑布图）
 */
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Typography, Spin, Button, Table, Tag, Toast, Row, Col,
  Select, Empty, Input, Modal, Popconfirm,
} from '@douyinfe/semi-ui';
import { IconPlus, IconDelete, IconRefresh } from '@douyinfe/semi-icons';
import ReactECharts from 'echarts-for-react/lib/core';
import echarts from '@/lib/echarts';

import { apiClient } from '@/lib/apiClient';
import { buildChangeComparisonTable, computeChangePricing } from '@/engine/change_pricing';
import { computeVersionDiff } from '@/engine/version_diff';
import {
  buildVersionSnapshot,
  computeProjectResultFromSnapshot,
  type HarnessVersionSource,
  type ProjectVersionSource,
} from '@/lib/versionSnapshot';
import type { ChangePricingResult } from '@/types/quote';
import type { VersionDiff, VersionRecord, VersionStatus } from '@/types/version';
import { VERSION_STATUS_LABELS, validateTransition } from '@/types/version';
import type { BomItem, WireItem } from '@/types/harness';
import ScenarioSelector from '@/components/ScenarioSelector';
import { useCascadeImpact } from '@/hooks/useCascadeImpact';
import { db } from '@/data/db';
import { computeHarnessCost } from '@/engine/harness_costing';

const { Title, Text } = Typography;

const STATUS_COLORS: Record<VersionStatus, any> = {
  draft: 'grey',
  bom_ready: 'blue',
  reviewed: 'orange',
  locked: 'green',
  published: 'green',
  archived: 'purple',
};

const NEXT_STATUS: Record<VersionStatus, VersionStatus | null> = {
  draft: 'bom_ready',
  bom_ready: 'reviewed',
  reviewed: 'locked',
  locked: null,
  published: null,
  archived: null,
};

type PersistedChangeType = 'add' | 'replace' | 'cancel' | 'adjust';

interface ChangeBomDiffRow {
  harnessId: string;
  harnessName: string;
  partNo: string;
  partName: string;
  changeType: 'added' | 'removed' | 'qty_changed' | 'price_changed' | 'assembly_replace';
  beforeQty: number;
  afterQty: number;
  beforePrice: number;
  afterPrice: number;
  deltaAmount: number;
  replacedAssembly?: string;
}

interface ChangeEventRecord {
  id: string;
  projectId: string;
  scenarioId: string;
  changeType: PersistedChangeType;
  reason?: string;
  affectedHarnessIds: string[];
  affectedBomRows: ChangeBomDiffRow[];
  costImpact: number;
  quoteImpact: number;
  residualImpact: number;
  baselineVersionId?: string;
  compareVersionId?: string;
  status: string;
  createdBy?: string;
  createdAt: string;
  updatedAt?: string;
}

const CHANGE_EVENT_LABELS: Record<PersistedChangeType, string> = {
  add: '新增',
  replace: '替换',
  cancel: '取消',
  adjust: '调整',
};

const CHANGE_EVENT_COLORS: Record<PersistedChangeType, any> = {
  add: 'green',
  replace: 'purple',
  cancel: 'red',
  adjust: 'orange',
};

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function resolvePersistedChangeType(rows: ChangeBomDiffRow[]): PersistedChangeType {
  const kinds = new Set(rows.map((row) => row.changeType));
  if (kinds.size === 0) return 'adjust';
  if (kinds.size === 1) {
    if (kinds.has('added')) return 'add';
    if (kinds.has('removed')) return 'cancel';
    if (kinds.has('assembly_replace')) return 'replace';
    return 'adjust';
  }
  if (kinds.has('assembly_replace') || (kinds.has('added') && kinds.has('removed'))) {
    return 'replace';
  }
  return 'adjust';
}

function buildChangeReason(
  baseVersion: VersionRecord,
  compareVersion: VersionRecord,
  rows: ChangeBomDiffRow[],
  summary?: ChangePricingResult['summary'] | null,
) {
  const addedCount = rows.filter((row) => row.changeType === 'added').length;
  const removedCount = rows.filter((row) => row.changeType === 'removed').length;
  const adjustedCount = rows.filter((row) => !['added', 'removed'].includes(row.changeType)).length;
  const impactText = summary ? `；单车影响 ${summary.totalDelta >= 0 ? '+' : ''}${summary.totalDelta.toFixed(2)}` : '';
  return `${baseVersion.label} -> ${compareVersion.label}；新增 ${addedCount} 项 / 删除 ${removedCount} 项 / 调整 ${adjustedCount} 项${impactText}`;
}

export default function ChangeEnginePage() {
  const { id: projectId, sid } = useParams<{ id: string; sid: string }>();
  const cascade = useCascadeImpact();
  const [versions, setVersions] = useState<VersionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [baseVersionId, setBaseVersionId] = useState<string | null>(null);
  const [compareVersionId, setCompareVersionId] = useState<string | null>(null);
  const [changePricingResult, setChangePricingResult] = useState<ChangePricingResult | null>(null);
  const [versionDiffResult, setVersionDiffResult] = useState<VersionDiff | null>(null);
  const [comparisonTable, setComparisonTable] = useState<ReturnType<typeof buildChangeComparisonTable> | null>(null);
  const [projectSource, setProjectSource] = useState<ProjectVersionSource | null>(null);
  const [harnessSource, setHarnessSource] = useState<HarnessVersionSource[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [creating, setCreating] = useState(false);
  const [changeEvents, setChangeEvents] = useState<ChangeEventRecord[]>([]);
  const [changeEventsLoading, setChangeEventsLoading] = useState(false);
  const [selectedChangeId, setSelectedChangeId] = useState<string | null>(null);
  const [creatingChangeEvent, setCreatingChangeEvent] = useState(false);
  const [showCascadePreview, setShowCascadePreview] = useState(false);

  const clearComparison = useCallback(() => {
    setChangePricingResult(null);
    setVersionDiffResult(null);
    setComparisonTable(null);
  }, []);

  const clearPageState = useCallback(() => {
    setVersions([]);
    setProjectSource(null);
    setHarnessSource([]);
    setBaseVersionId(null);
    setCompareVersionId(null);
    clearComparison();
  }, [clearComparison]);

  const setCompareVersions = useCallback((baseId: string | null, compareId: string | null) => {
    setBaseVersionId(baseId);
    setCompareVersionId(compareId);
    clearComparison();
  }, [clearComparison]);

  const loadVersions = useCallback(async () => {
    if (!projectId) {
      clearPageState();
      return;
    }

    setLoading(true);
    try {
      const [versionRows, projectRow, harnessRows] = await Promise.all([
        apiClient<VersionRecord[]>(`/versions/project/${projectId}`),
        apiClient<ProjectVersionSource>(`/projects/${projectId}`),
        apiClient<HarnessVersionSource[]>(`/projects/${projectId}/harnesses`),
      ]);

      const nextVersions = Array.isArray(versionRows)
        ? [...versionRows].sort((left, right) => right.versionNumber - left.versionNumber)
        : [];

      setVersions(nextVersions);
      setProjectSource(projectRow ?? null);
      setHarnessSource(Array.isArray(harnessRows) ? harnessRows : []);
      setBaseVersionId((current) => {
        if (current && nextVersions.some((item) => item.id === current)) return current;
        return nextVersions.length >= 2 ? nextVersions[1]!.id : null;
      });
      setCompareVersionId((current) => {
        if (current && nextVersions.some((item) => item.id === current)) return current;
        return nextVersions.length >= 2 ? nextVersions[0]!.id : null;
      });
    } catch (err) {
      console.error('Failed to load change engine data:', err);
      Toast.error(err instanceof Error ? err.message : '版本数据加载失败');
      clearPageState();
    } finally {
      setLoading(false);
    }
  }, [clearPageState, projectId]);

  const loadChangeEvents = useCallback(async () => {
    if (!projectId || !sid) {
      setChangeEvents([]);
      setSelectedChangeId(null);
      return;
    }

    setChangeEventsLoading(true);
    try {
      const rows = await apiClient<ChangeEventRecord[]>(`/projects/${projectId}/scenarios/${sid}/changes`);
      const nextRows = Array.isArray(rows) ? rows : [];
      setChangeEvents(nextRows);
      setSelectedChangeId((current) => (current && nextRows.some((item) => item.id === current) ? current : nextRows[0]?.id ?? null));
    } catch (err) {
      console.error('Failed to load change events:', err);
      setChangeEvents([]);
      setSelectedChangeId(null);
    } finally {
      setChangeEventsLoading(false);
    }
  }, [projectId, sid]);

  const createSnapshot = useCallback(async (label?: string, notes?: string) => {
    if (!projectId) {
      throw new Error('项目不存在');
    }
    if (!projectSource) {
      throw new Error('项目快照源尚未加载完成');
    }

    const nextVersionNumber = versions.reduce((max, item) => Math.max(max, item.versionNumber), 0) + 1;
    const snapshot = buildVersionSnapshot(projectSource, harnessSource);
    const payload = {
      projectId,
      versionNumber: nextVersionNumber,
      label: (label || `v${nextVersionNumber}`).trim(),
      status: 'draft' as VersionStatus,
      notes: notes?.trim() || undefined,
      snapshot,
    };

    return apiClient<VersionRecord>('/versions', {
      method: 'POST',
      body: payload,
    });
  }, [harnessSource, projectId, projectSource, versions]);

  const deleteVersion = useCallback(async (versionId: string) => {
    await apiClient(`/versions/${versionId}`, {
      method: 'DELETE',
    });
  }, []);

  const updateStatus = useCallback(async (versionId: string, newStatus: VersionStatus) => {
    await apiClient<VersionRecord>(`/versions/${versionId}/status`, {
      method: 'PATCH',
      body: { status: newStatus },
    });
  }, []);

  const runComparison = useCallback(async () => {
    if (!baseVersionId || !compareVersionId) {
      return;
    }

    const baseVersion = versions.find((item) => item.id === baseVersionId);
    const compareVersion = versions.find((item) => item.id === compareVersionId);
    if (!baseVersion || !compareVersion) {
      throw new Error('待对比版本不存在');
    }

    const baseProject = computeProjectResultFromSnapshot(baseVersion.snapshot);
    const compareProject = computeProjectResultFromSnapshot(compareVersion.snapshot);
    const changePricing = computeChangePricing(baseProject, compareProject, 'version_compare');
    const versionDiff = computeVersionDiff(baseVersion.snapshot, compareVersion.snapshot);
    versionDiff.beforeVersion = `v${baseVersion.versionNumber} (${baseVersion.label})`;
    versionDiff.afterVersion = `v${compareVersion.versionNumber} (${compareVersion.label})`;

    setChangePricingResult(changePricing);
    setVersionDiffResult(versionDiff);
    setComparisonTable(buildChangeComparisonTable(changePricing));

    if (versionDiff.bomChanges && versionDiff.bomChanges.length > 0) {
      setShowCascadePreview(true);
    }
  }, [baseVersionId, compareVersionId, versions]);

  useEffect(() => {
    void loadVersions();
    void loadChangeEvents();
    return () => {
      clearPageState();
      setChangeEvents([]);
      setSelectedChangeId(null);
    };
  }, [clearPageState, loadChangeEvents, loadVersions]);

  // ── 创建快照 ──
  const handleCreate = useCallback(async () => {
    if (!projectId) return;
    setCreating(true);
    try {
      const label = newLabel.trim();
      const notes = newNotes.trim();
      const v = await createSnapshot(label || undefined, notes || undefined);
      Toast.success(`版本 ${v.label} 创建成功`);
      setShowCreateModal(false);
      setNewLabel('');
      setNewNotes('');
      await loadVersions();
    } catch (err) {
      Toast.error('创建失败: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setCreating(false);
    }
  }, [createSnapshot, loadVersions, newLabel, newNotes, projectId]);

  // ── 删除版本 ──
  const handleDelete = useCallback(async (versionId: string) => {
    try {
      await deleteVersion(versionId);
      Toast.success('版本已删除');
      if (baseVersionId === versionId || compareVersionId === versionId) {
        setCompareVersions(
          baseVersionId === versionId ? null : baseVersionId,
          compareVersionId === versionId ? null : compareVersionId,
        );
      }
      await loadVersions();
    } catch (err) {
      Toast.error(String(err instanceof Error ? err.message : err));
    }
  }, [baseVersionId, compareVersionId, deleteVersion, loadVersions, setCompareVersions]);

  // ── 状态流转 ──
  const handleAdvanceStatus = useCallback(async (v: VersionRecord) => {
    const next = NEXT_STATUS[v.status];
    if (!next) return;
    const validation = validateTransition(v.status, next);
    if (!validation.valid) {
      Toast.error(validation.reason || '非法状态流转');
      return;
    }
    try {
      await updateStatus(v.id, next);
      Toast.success(`状态已更新为「${VERSION_STATUS_LABELS[next]}」`);
      await loadVersions();
    } catch (err) {
      Toast.error(String(err instanceof Error ? err.message : err));
    }
  }, [loadVersions, updateStatus]);

  // ── 执行对比 ──
  const handleCompare = useCallback(async () => {
    if (!baseVersionId || !compareVersionId) {
      Toast.warning('请先选择基准版本和变更版本');
      return;
    }
    if (baseVersionId === compareVersionId) {
      Toast.warning('基准版本和变更版本不能相同');
      return;
    }
    try {
      await runComparison();
    } catch (err) {
      Toast.error(err instanceof Error ? err.message : '版本对比失败');
    }
  }, [baseVersionId, compareVersionId, runComparison]);

  // ── 变更影响瀑布图 ──
  const impactWaterfallChart = useMemo(() => {
    if (!versionDiffResult) return {};
    const projectDiffs = versionDiffResult.projectLevel;
    if (!projectDiffs || projectDiffs.length === 0) return {};

    // 取线束级 diff 的汇总维度
    const summary = changePricingResult?.summary;
    if (!summary) return {};

    // Build items from the changePricingResult changes
    const changes = changePricingResult.changes || [];
    if (changes.length === 0) return {};

    // Aggregate delta by cost dimension
    const dims = [
      { key: 'materialCost', label: '材料' },
      { key: 'wasteCost', label: '废品' },
      { key: 'directLabor', label: '人工' },
      { key: 'manufacturing', label: '制造费' },
      { key: 'mgmtFee', label: '管理费' },
      { key: 'profit', label: '利润' },
      { key: 'packTotal', label: '包装运输' },
    ];

    const dimValues = dims.map(d => {
      const total = changes.reduce((sum, c) => sum + ((c.delta as any)[d.key] || 0), 0);
      return { name: d.label, value: +total.toFixed(2) };
    });

    let cumulative = 0;
    const placeholders: number[] = [];
    const values: number[] = [];

    for (const item of dimValues) {
      if (item.value >= 0) {
        placeholders.push(cumulative);
        values.push(item.value);
        cumulative += item.value;
      } else {
        cumulative += item.value;
        placeholders.push(cumulative);
        values.push(Math.abs(item.value));
      }
    }
    // Total bar
    const totalDelta = summary.totalDelta;
    placeholders.push(0);
    values.push(Math.abs(+totalDelta.toFixed(2)));

    return {
      tooltip: { trigger: 'axis' as const },
      grid: { top: 20, bottom: 40, left: 60, right: 20 },
      xAxis: {
        type: 'category' as const,
        data: [...dimValues.map(d => d.name), '总变化'],
        axisLabel: { fontSize: 11 },
      },
      yAxis: { type: 'value' as const, name: '元/车' },
      series: [
        {
          name: 'placeholder',
          type: 'bar' as const,
          stack: 'waterfall',
          itemStyle: { color: 'transparent' },
          data: placeholders,
        },
        {
          name: 'delta',
          type: 'bar' as const,
          stack: 'waterfall',
          data: values.map((v, i) => ({
            value: v,
            itemStyle: {
              color: i === dimValues.length
                ? (totalDelta >= 0 ? '#dc2626' : '#16a34a')
                : (dimValues[i]?.value ?? 0) >= 0 ? '#dc2626' : '#16a34a',
            },
          })),
          label: {
            show: true,
            position: 'top' as const,
            formatter: (p: any) => {
              const idx = p.dataIndex;
              const originalValue = idx < dimValues.length ? (dimValues[idx]?.value ?? 0) : totalDelta;
              return `${originalValue >= 0 ? '+' : ''}${originalValue.toFixed(2)}`;
            },
            fontSize: 10,
          },
        },
      ],
    };
  }, [versionDiffResult, changePricingResult]);

  // ── BOM 行级 diff ──
  interface BomDiffRow {
    harnessId: string;
    harnessName: string;
    partNo: string;
    partName: string;
    changeType: 'added' | 'removed' | 'qty_changed' | 'price_changed' | 'assembly_replace';
    beforeQty: number;
    afterQty: number;
    beforePrice: number;
    afterPrice: number;
    deltaAmount: number;
    /** 散件替代总成：被替代的总成零件号 */
    replacedAssembly?: string;
  }

  const bomDiffRows = useMemo<BomDiffRow[]>(() => {
    if (!baseVersionId || !compareVersionId) return [];
    const baseVer = versions.find(v => v.id === baseVersionId);
    const compVer = versions.find(v => v.id === compareVersionId);
    if (!baseVer?.snapshot?.harnesses || !compVer?.snapshot?.harnesses) return [];

    const rows: BomDiffRow[] = [];
    const allHarnessIds = new Set([
      ...baseVer.snapshot.harnesses.map(h => h.harnessId),
      ...compVer.snapshot.harnesses.map(h => h.harnessId),
    ]);

    for (const hId of allHarnessIds) {
      const baseH = baseVer.snapshot.harnesses.find(h => h.harnessId === hId);
      const compH = compVer.snapshot.harnesses.find(h => h.harnessId === hId);
      const hName = compH?.harnessName || baseH?.harnessName || hId;
      const baseBom: (BomItem | WireItem)[] = baseH?.input?.bom || [];
      const compBom: (BomItem | WireItem)[] = compH?.input?.bom || [];

      const baseMap = new Map(baseBom.map(b => [b.partNo, b]));
      const compMap = new Map(compBom.map(b => [b.partNo, b]));

      // Added parts
      for (const [pn, item] of compMap) {
        if (!baseMap.has(pn)) {
          rows.push({
            harnessId: hId, harnessName: hName, partNo: pn, partName: item.partName,
            changeType: 'added', beforeQty: 0, afterQty: item.qty,
            beforePrice: 0, afterPrice: item.unitPrice, deltaAmount: item.amount,
          });
        }
      }
      // Removed parts
      for (const [pn, item] of baseMap) {
        if (!compMap.has(pn)) {
          rows.push({
            harnessId: hId, harnessName: hName, partNo: pn, partName: item.partName,
            changeType: 'removed', beforeQty: item.qty, afterQty: 0,
            beforePrice: item.unitPrice, afterPrice: 0, deltaAmount: -item.amount,
          });
        }
      }
      // Changed parts
      for (const [pn, compItem] of compMap) {
        const baseItem = baseMap.get(pn);
        if (!baseItem) continue;
        if (Math.abs(compItem.qty - baseItem.qty) > 0.0001) {
          rows.push({
            harnessId: hId, harnessName: hName, partNo: pn, partName: compItem.partName,
            changeType: 'qty_changed', beforeQty: baseItem.qty, afterQty: compItem.qty,
            beforePrice: baseItem.unitPrice, afterPrice: compItem.unitPrice,
            deltaAmount: compItem.amount - baseItem.amount,
          });
        } else if (Math.abs(compItem.unitPrice - baseItem.unitPrice) > 0.0001) {
          rows.push({
            harnessId: hId, harnessName: hName, partNo: pn, partName: compItem.partName,
            changeType: 'price_changed', beforeQty: baseItem.qty, afterQty: compItem.qty,
            beforePrice: baseItem.unitPrice, afterPrice: compItem.unitPrice,
            deltaAmount: compItem.amount - baseItem.amount,
          });
        }
      }
    }

    // ── 散件替代总成检测 ──
    // 同一线束内：1个removed + 多个added → 标记为 assembly_replace
    const harnessIds = new Set(rows.map(r => r.harnessId));
    for (const hId of harnessIds) {
      const hRows = rows.filter(r => r.harnessId === hId);
      const removedRows = hRows.filter(r => r.changeType === 'removed');
      const addedRows = hRows.filter(r => r.changeType === 'added');
      // 每个被删除的总成：如果同线束有 ≥2 个新增零件，判定为散件替代
      for (const rm of removedRows) {
        if (addedRows.length >= 2) {
          rm.changeType = 'assembly_replace';
          for (const ad of addedRows) {
            ad.changeType = 'assembly_replace';
            ad.replacedAssembly = rm.partNo;
          }
        }
      }
    }

    return rows;
  }, [baseVersionId, compareVersionId, versions]);

  const [expandedHarnesses, setExpandedHarnesses] = useState<Set<string>>(new Set());

  const toggleHarness = useCallback((hId: string) => {
    setExpandedHarnesses(prev => {
      const next = new Set(prev);
      if (next.has(hId)) next.delete(hId); else next.add(hId);
      return next;
    });
  }, []);

  // BOM diff 按线束分组
  const bomDiffGrouped = useMemo(() => {
    const groups = new Map<string, { harnessId: string; harnessName: string; rows: typeof bomDiffRows; totalDelta: number }>();
    for (const row of bomDiffRows) {
      let g = groups.get(row.harnessId);
      if (!g) {
        g = { harnessId: row.harnessId, harnessName: row.harnessName, rows: [], totalDelta: 0 };
        groups.set(row.harnessId, g);
      }
      g.rows.push(row);
      g.totalDelta += row.deltaAmount;
    }
    return Array.from(groups.values());
  }, [bomDiffRows]);

  const bomDiffTotalImpact = useMemo(() => bomDiffRows.reduce((s, r) => s + r.deltaAmount, 0), [bomDiffRows]);
  const selectedChangeEvent = useMemo(
    () => changeEvents.find((item) => item.id === selectedChangeId) ?? changeEvents[0] ?? null,
    [changeEvents, selectedChangeId],
  );
  const recentChangeEvents = useMemo(() => changeEvents.slice(0, 5), [changeEvents]);

  const handleCreateChangeEvent = useCallback(async () => {
    if (!projectId || !sid) {
      Toast.warning('当前页面未绑定场景，无法写入设变台账');
      return;
    }
    if (!baseVersionId || !compareVersionId) {
      Toast.warning('请先完成版本对比，再写入设变事件');
      return;
    }
    if (!changePricingResult) {
      Toast.warning('请先执行版本对比，再写入设变事件');
      return;
    }
    if (bomDiffRows.length === 0) {
      Toast.warning('当前版本对比没有检测到 BOM 差异');
      return;
    }

    const baseVersion = versions.find((item) => item.id === baseVersionId);
    const compareVersion = versions.find((item) => item.id === compareVersionId);
    if (!baseVersion || !compareVersion) {
      Toast.warning('版本快照不存在，无法写入设变事件');
      return;
    }

    setCreatingChangeEvent(true);
    try {
      const created = await apiClient<ChangeEventRecord>(`/projects/${projectId}/scenarios/${sid}/changes`, {
        method: 'POST',
        body: {
          projectId,
          changeType: resolvePersistedChangeType(bomDiffRows),
          reason: buildChangeReason(baseVersion, compareVersion, bomDiffRows, changePricingResult?.summary),
          affectedHarnessIds: uniqueStrings(bomDiffRows.map((row) => row.harnessId)),
          affectedBomRows: bomDiffRows,
          baselineVersionId: baseVersionId,
          compareVersionId,
          status: 'draft',
        },
      });
      const calculated = await apiClient<ChangeEventRecord>(`/changes/${created.id}/calculate-impact`, {
        method: 'POST',
      });
      setSelectedChangeId(calculated.id);

      await propagateChangeToScenario(
        compareVersion,
        uniqueStrings(bomDiffRows.map((r) => r.harnessId)),
        projectId,
        sid,
      );

      await loadChangeEvents();
      Toast.success('设变事件已写入，并完成影响测算与内部核算结果同步');
    } catch (err) {
      Toast.error(err instanceof Error ? err.message : '设变事件写入失败');
    } finally {
      setCreatingChangeEvent(false);
    }
  }, [baseVersionId, bomDiffRows, changePricingResult, changePricingResult?.summary, compareVersionId, loadChangeEvents, projectId, sid, versions]);

  async function propagateChangeToScenario(
    compareVersion: VersionRecord,
    affectedHarnessIds: string[],
    projectId: string,
    scenarioId: string,
  ) {
    const scenario = await db.scenarios.get(scenarioId);
    if (!scenario) throw new Error('场景不存在');

    const project = await db.projects.get(projectId);
    if (!project) throw new Error('项目不存在');

    void project;

    const snapshotHarnesses = compareVersion.snapshot?.harnesses || [];
    const costRates = scenario.config.costRates;
    const metalPrices = scenario.config.metalPrices;

    for (const hId of affectedHarnessIds) {
      const snap = snapshotHarnesses.find((h: any) => h.harnessId === hId);
      if (!snap) continue;

      const existing = await db.harnesses
        .where({ projectId, scenarioId, harnessId: hId })
        .first();

      const result = computeHarnessCost(snap.input, costRates, metalPrices);

      if (existing) {
        await db.harnesses.update(existing.id, {
          input: snap.input,
          harnessName: snap.harnessName,
          result,
          updatedAt: new Date().toISOString(),
        });
      } else {
        await db.harnesses.add({
          id: crypto.randomUUID(),
          projectId,
          scenarioId,
          harnessId: hId,
          harnessName: snap.harnessName,
          input: snap.input,
          result,
          eopYear: null,
          updatedAt: new Date().toISOString(),
        });
      }
    }

    // Sync to backend
    const updatedHarnesses = await db.harnesses
      .where({ projectId, scenarioId })
      .toArray();
    await apiClient('/sync/push', {
      method: 'POST',
      body: {
        changes: updatedHarnesses.map((h) => ({
          id: h.id,
          entity: 'harness',
          operation: 'upsert',
          entityId: h.id,
          payload: h,
        })),
      },
    });

    void project;
    void changeEventId;
  }

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><Spin size="large" /></div>;
  }

  const summary = changePricingResult?.summary;

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', paddingBottom: 64 }}>
      <ScenarioSelector />
      <Row gutter={[16, 16]}>

        {/* ──── 版本管理面板 ──── */}
        <Col span={24}>
          <div className="glass-card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Title heading={5} className="ink-heading" style={{ margin: 0 }}>
                版本管理
              </Title>
              <Button
                aria-label="create-snapshot"
                icon={<IconPlus />}
                theme="solid"
                style={{ borderRadius: 12, background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }}
                onClick={() => setShowCreateModal(true)}
              >
                创建快照
              </Button>
            </div>

            {versions.length === 0 ? (
              <Empty description="暂无版本快照，点击「创建快照」保存当前数据" />
            ) : (
              <Table
                pagination={false}
                size="small"
                dataSource={versions.map(v => ({ ...v, key: v.id }))}
                columns={[
                  {
                    title: '版本',
                    dataIndex: 'label',
                    width: 120,
                    render: (label: string, record: any) => (
                      <Text style={{ fontWeight: 700 }}>{label || `v${record.versionNumber}`}</Text>
                    ),
                  },
                  {
                    title: '状态',
                    dataIndex: 'status',
                    width: 100,
                    render: (status: VersionStatus) => (
                      <Tag color={STATUS_COLORS[status]} size="small">
                        {VERSION_STATUS_LABELS[status]}
                      </Tag>
                    ),
                  },
                  {
                    title: '单车成本',
                    width: 120,
                    align: 'right' as const,
                    render: (_: any, record: any) => (
                      <span className="ledger-number" style={{ fontWeight: 700 }}>
                        ¥{(record.snapshot?.summary?.vehicleCost || 0).toFixed(2)}
                      </span>
                    ),
                  },
                  {
                    title: '线束数',
                    width: 70,
                    align: 'center' as const,
                    render: (_: any, record: any) => record.snapshot?.summary?.harnessCount || 0,
                  },
                  {
                    title: '创建时间',
                    dataIndex: 'createdAt',
                    width: 160,
                    render: (v: string) => new Date(v).toLocaleString('zh-CN'),
                  },
                  {
                    title: '备注',
                    dataIndex: 'notes',
                    width: 200,
                    render: (v: string) => <Text type="tertiary" ellipsis={{ showTooltip: true }}>{v || '-'}</Text>,
                  },
                  {
                    title: '操作',
                    width: 180,
                    fixed: 'right' as const,
                    render: (_: any, record: any) => (
                      <div style={{ display: 'flex', gap: 4 }}>
                        {NEXT_STATUS[record.status as VersionStatus] && (
                          <Button size="small" onClick={() => handleAdvanceStatus(record)}>
                            → {VERSION_STATUS_LABELS[NEXT_STATUS[record.status as VersionStatus]!]}
                          </Button>
                        )}
                        {record.status === 'draft' && (
                          <Popconfirm title="确定删除此版本？" onConfirm={() => handleDelete(record.id)}>
                            <Button size="small" type="danger" icon={<IconDelete />} />
                          </Popconfirm>
                        )}
                      </div>
                    ),
                  },
                ]}
              />
            )}
          </div>
        </Col>

        {/* ──── 版本对比选择器 ──── */}
        <Col span={24}>
          <div className="glass-card" style={{ padding: 24 }}>
            <Title heading={5} className="ink-heading" style={{ margin: 0, marginBottom: 16 }}>
              版本对比
            </Title>
            <Row gutter={16} align="middle">
              <Col span={8}>
                <Text style={{ fontSize: 12, fontWeight: 600, color: '#71717a', display: 'block', marginBottom: 4 }}>基准版本</Text>
                <Select
                  placeholder="选择基准版本"
                  style={{ width: '100%' }}
                  value={baseVersionId || undefined}
                  onChange={(v) => setCompareVersions(v as string, compareVersionId)}
                  optionList={versions.map(v => ({
                    value: v.id,
                    label: `${v.label} — ¥${(v.snapshot?.summary?.vehicleCost || 0).toFixed(2)}/车`,
                  }))}
                />
              </Col>
              <Col span={2} style={{ textAlign: 'center' }}>
                <Text style={{ fontSize: 20, color: '#71717a' }}>→</Text>
              </Col>
              <Col span={8}>
                <Text style={{ fontSize: 12, fontWeight: 600, color: '#71717a', display: 'block', marginBottom: 4 }}>变更版本</Text>
                <Select
                  placeholder="选择变更版本"
                  style={{ width: '100%' }}
                  value={compareVersionId || undefined}
                  onChange={(v) => setCompareVersions(baseVersionId, v as string)}
                  optionList={versions.map(v => ({
                    value: v.id,
                    label: `${v.label} — ¥${(v.snapshot?.summary?.vehicleCost || 0).toFixed(2)}/车`,
                  }))}
                />
              </Col>
              <Col span={6}>
                <Button
                  aria-label="run-version-compare"
                  icon={<IconRefresh />}
                  theme="solid"
                  style={{ borderRadius: 12, background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', marginTop: 20 }}
                  onClick={handleCompare}
                  disabled={!baseVersionId || !compareVersionId}
                >
                  执行对比
                </Button>
              </Col>
            </Row>
          </div>
        </Col>

        {/* ──── 对比结果：KPI ──── */}
        {summary && (
          <>
            <Col span={6}>
              <div className="glass-card" style={{ padding: 20 }}>
                <Text style={{ fontWeight: 600, fontSize: 12, color: '#71717a' }}>单车成本变化</Text>
                <div className="ledger-number" style={{
                  fontSize: 28, marginTop: 8,
                  color: summary.totalDelta > 0 ? '#dc2626' : summary.totalDelta < 0 ? '#16a34a' : '#71717a',
                }}>
                  {summary.totalDelta >= 0 ? '+' : ''}{summary.totalDelta.toFixed(2)}
                </div>
                <Text style={{ fontSize: 11, color: '#71717a', marginTop: 4, display: 'block' }}>
                  变化 {summary.deltaPercent >= 0 ? '+' : ''}{summary.deltaPercent.toFixed(2)}%
                </Text>
              </div>
            </Col>
            <Col span={6}>
              <div className="glass-card" style={{ padding: 20 }}>
                <Text style={{ fontWeight: 600, fontSize: 12, color: '#71717a' }}>影响线束</Text>
                <div className="ledger-number" style={{ fontSize: 28, marginTop: 8 }}>
                  {summary.affectedCount}
                </div>
                <Text style={{ fontSize: 11, color: '#71717a', marginTop: 4, display: 'block' }}>
                  新增 {summary.addedCount} · 删除 {summary.removedCount} · 变更 {summary.modifiedCount}
                </Text>
              </div>
            </Col>
            <Col span={6}>
              <div className="glass-card" style={{ padding: 20 }}>
                <Text style={{ fontWeight: 600, fontSize: 12, color: '#71717a' }}>基准单车</Text>
                <div className="ledger-number" style={{ fontSize: 28, marginTop: 8 }}>
                  ¥{summary.totalBefore.toFixed(2)}
                </div>
              </div>
            </Col>
            <Col span={6}>
              <div className="glass-card" style={{ padding: 20 }}>
                <Text style={{ fontWeight: 600, fontSize: 12, color: '#71717a' }}>变更后单车</Text>
                <div className="ledger-number" style={{ fontSize: 28, marginTop: 8, color: '#2563eb' }}>
                  ¥{summary.totalAfter.toFixed(2)}
                </div>
              </div>
            </Col>
          </>
        )}

        {/* ──── 变更影响瀑布图 ──── */}
        {summary && Object.keys(impactWaterfallChart).length > 0 && (
          <Col span={24}>
            <div className="glass-card" style={{ padding: 24 }}>
              <Title heading={5} className="ink-heading" style={{ margin: 0, marginBottom: 12 }}>
                变更影响分析 (按成本维度)
              </Title>
              <div style={{ height: 300 }}>
                <ReactECharts echarts={echarts} option={impactWaterfallChart} style={{ height: '100%' }} />
              </div>
            </div>
          </Col>
        )}

        {/* ──── 线束级对比表 ──── */}
        {comparisonTable && (
          <Col span={24}>
            <div className="glass-card" style={{ padding: 24 }}>
              <Title heading={5} className="ink-heading" style={{ margin: 0, marginBottom: 16 }}>
                线束级变更明细
              </Title>
              <Table
                pagination={false}
                size="small"
                scroll={{ x: 900 }}
                dataSource={[
                  ...comparisonTable.rows.map((r, i) => ({ ...r, key: String(i) })),
                  { ...comparisonTable.totals, key: 'total', _isTotal: true },
                ]}
                columns={[
                  {
                    title: '零件号',
                    dataIndex: 'harnessId',
                    width: 120,
                    fixed: 'left' as const,
                    render: (v: string, record: any) => (
                      <Text style={{ fontWeight: record._isTotal ? 800 : 600 }}>{v}</Text>
                    ),
                  },
                  { title: '名称', dataIndex: 'harnessName', width: 140 },
                  {
                    title: '变更类型',
                    dataIndex: 'changeCategory',
                    width: 80,
                    align: 'center' as const,
                    render: (v: string) => {
                      const color = v === '新增' ? 'green' : v === '删除' ? 'red' : v === '变更' ? 'orange' : 'grey';
                      return v ? <Tag color={color} size="small">{v}</Tag> : null;
                    },
                  },
                  {
                    title: '定点价',
                    dataIndex: 'beforePrice',
                    width: 100,
                    align: 'right' as const,
                    render: (v: number) => <span className="ledger-number">¥{(v || 0).toFixed(2)}</span>,
                  },
                  {
                    title: '变更后',
                    dataIndex: 'afterPrice',
                    width: 100,
                    align: 'right' as const,
                    render: (v: number) => <span className="ledger-number" style={{ color: '#2563eb' }}>¥{(v || 0).toFixed(2)}</span>,
                  },
                  {
                    title: '差异',
                    dataIndex: 'deltaPrice',
                    width: 100,
                    align: 'right' as const,
                    render: (v: number) => (
                      <span className="ledger-number" style={{
                        color: v > 0.001 ? '#dc2626' : v < -0.001 ? '#16a34a' : '#71717a',
                        fontWeight: 700,
                      }}>
                        {v >= 0 ? '+' : ''}{(v || 0).toFixed(2)}
                      </span>
                    ),
                  },
                  {
                    title: '差异%',
                    dataIndex: 'deltaPercent',
                    width: 80,
                    align: 'right' as const,
                    render: (v: number) => (
                      <span style={{ color: (v || 0) > 0 ? '#dc2626' : (v || 0) < 0 ? '#16a34a' : '#71717a' }}>
                        {(v || 0) >= 0 ? '+' : ''}{(v || 0).toFixed(2)}%
                      </span>
                    ),
                  },
                ]}
              />
            </div>
          </Col>
        )}

        {/* ──── BOM 行级变更明细（按线束分组） ──── */}
        {bomDiffGrouped.length > 0 && (
          <Col span={24}>
            <div className="glass-card" style={{ padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Title heading={5} className="ink-heading" style={{ margin: 0 }}>
                  BOM 变更明细（零件级）
                </Title>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <Text style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {bomDiffRows.length} 项变更 · {bomDiffGrouped.length} 条线束
                  </Text>
                  <span className="ledger-number" style={{
                    fontSize: 14, fontWeight: 700,
                    color: bomDiffTotalImpact > 0.001 ? '#dc2626' : bomDiffTotalImpact < -0.001 ? '#16a34a' : '#71717a',
                  }}>
                    总影响 {bomDiffTotalImpact >= 0 ? '+' : ''}¥{bomDiffTotalImpact.toFixed(2)}
                  </span>
                </div>
              </div>

              {bomDiffGrouped.map(group => {
                const isExpanded = expandedHarnesses.has(group.harnessId);
                const CHANGE_COLORS: Record<string, string> = {
                  added: '#16a34a', removed: '#dc2626', qty_changed: '#f59e0b', price_changed: '#3b82f6', assembly_replace: '#7c3aed',
                };
                const CHANGE_LABELS: Record<string, string> = {
                  added: '新增', removed: '删除', qty_changed: '数量变更', price_changed: '价格变更', assembly_replace: '散件替代',
                };
                return (
                  <div key={group.harnessId} style={{ marginBottom: 8, border: '1px solid rgba(0,0,0,0.06)', borderRadius: 8, overflow: 'hidden' }}>
                    {/* 分组头 */}
                    <div
                      onClick={() => toggleHarness(group.harnessId)}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '10px 16px', cursor: 'pointer',
                        background: group.totalDelta > 0.001 ? 'rgba(220,38,38,0.03)' : group.totalDelta < -0.001 ? 'rgba(22,163,74,0.03)' : 'rgba(0,0,0,0.02)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Text style={{ fontFamily: 'JetBrains Mono, Consolas, monospace', fontWeight: 700, fontSize: 13 }}>
                          {isExpanded ? '▼' : '▶'} {group.harnessId}
                        </Text>
                        <Text style={{ fontSize: 12, color: 'var(--text-muted)' }}>{group.harnessName}</Text>
                        <Tag color="blue" size="small">{group.rows.length} 项</Tag>
                      </div>
                      <span className="ledger-number" style={{
                        fontWeight: 700, fontSize: 13,
                        color: group.totalDelta > 0.001 ? '#dc2626' : group.totalDelta < -0.001 ? '#16a34a' : '#71717a',
                      }}>
                        {group.totalDelta >= 0 ? '+' : ''}¥{group.totalDelta.toFixed(2)}
                      </span>
                    </div>
                    {/* 展开的行 */}
                    {isExpanded && (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'JetBrains Mono, Consolas, monospace' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.08)', background: 'rgba(0,0,0,0.02)' }}>
                            <th style={{ textAlign: 'left', padding: '6px 12px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11 }}>零件号</th>
                            <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11 }}>名称</th>
                            <th style={{ textAlign: 'center', padding: '6px 8px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11 }}>类型</th>
                            <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11 }}>变更前单价</th>
                            <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11 }}>变更后单价</th>
                            <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11 }}>单价差异</th>
                            <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11 }}>原数量</th>
                            <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11 }}>新数量</th>
                            <th style={{ textAlign: 'right', padding: '6px 12px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11 }}>成本影响</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.rows.map((row, ri) => (
                            <tr key={ri} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                              <td style={{ padding: '5px 12px' }}>{row.partNo}</td>
                              <td style={{ padding: '5px 8px', fontSize: 11 }}>{row.partName}</td>
                              <td style={{ textAlign: 'center', padding: '5px 8px' }}>
                                <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: `${CHANGE_COLORS[row.changeType]}18`, color: CHANGE_COLORS[row.changeType] }}>
                                  {CHANGE_LABELS[row.changeType] || row.changeType}
                                </span>
                              </td>
                              <td style={{ textAlign: 'right', padding: '5px 8px' }}>¥{row.beforePrice.toFixed(2)}</td>
                              <td style={{ textAlign: 'right', padding: '5px 8px' }}>¥{row.afterPrice.toFixed(2)}</td>
                              <td style={{ textAlign: 'right', padding: '5px 8px', color: (row.afterPrice - row.beforePrice) > 0.001 ? '#dc2626' : (row.afterPrice - row.beforePrice) < -0.001 ? '#16a34a' : undefined }}>
                                {row.afterPrice !== 0 || row.beforePrice !== 0 ? `${(row.afterPrice - row.beforePrice) >= 0 ? '+' : ''}¥${(row.afterPrice - row.beforePrice).toFixed(2)}` : '—'}
                              </td>
                              <td style={{ textAlign: 'right', padding: '5px 8px' }}>{row.beforeQty}</td>
                              <td style={{ textAlign: 'right', padding: '5px 8px' }}>{row.afterQty}</td>
                              <td style={{ textAlign: 'right', padding: '5px 12px', fontWeight: 700, color: row.deltaAmount > 0.001 ? '#dc2626' : row.deltaAmount < -0.001 ? '#16a34a' : '#71717a' }}>
                                {row.deltaAmount >= 0 ? '+' : ''}¥{row.deltaAmount.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                );
              })}
            </div>
          </Col>
        )}

        {/* ──── 项目级维度对比 ──── */}
        <Col span={24}>
          <div className="glass-card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12 }}>
              <div>
                <Title heading={5} className="ink-heading" style={{ margin: 0 }}>
                  设变台账
                </Title>
                <Text type="tertiary">
                  将当前版本对比结果写入正式 ChangeEvent，并回显成本、报价与残余材料影响。
                </Text>
              </div>
              <Button
                aria-label="create-change-event"
                theme="solid"
                loading={creatingChangeEvent}
                disabled={!baseVersionId || !compareVersionId || !changePricingResult || bomDiffRows.length === 0}
                style={{ borderRadius: 12, background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }}
                onClick={handleCreateChangeEvent}
              >
                写入设变事件
              </Button>
            </div>

            {selectedChangeEvent ? (
              <>
                <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                  <Col span={6}>
                    <div style={{ padding: 16, borderRadius: 12, background: 'rgba(37,99,235,0.06)' }}>
                      <Text style={{ fontSize: 12, color: '#71717a' }}>当前状态</Text>
                      <div style={{ marginTop: 8 }}>
                        <Tag color={selectedChangeEvent.status === 'calculated' ? 'green' : 'orange'}>
                          {selectedChangeEvent.status}
                        </Tag>
                      </div>
                    </div>
                  </Col>
                  <Col span={6}>
                    <div style={{ padding: 16, borderRadius: 12, background: 'rgba(0,0,0,0.02)' }}>
                      <Text style={{ fontSize: 12, color: '#71717a' }}>成本影响</Text>
                      <div className="ledger-number" style={{ marginTop: 8, fontSize: 24, color: selectedChangeEvent.costImpact >= 0 ? '#dc2626' : '#16a34a' }}>
                        {selectedChangeEvent.costImpact >= 0 ? '+' : ''}{selectedChangeEvent.costImpact.toFixed(2)}
                      </div>
                    </div>
                  </Col>
                  <Col span={6}>
                    <div style={{ padding: 16, borderRadius: 12, background: 'rgba(0,0,0,0.02)' }}>
                      <Text style={{ fontSize: 12, color: '#71717a' }}>报价影响</Text>
                      <div className="ledger-number" style={{ marginTop: 8, fontSize: 24, color: selectedChangeEvent.quoteImpact >= 0 ? '#dc2626' : '#16a34a' }}>
                        {selectedChangeEvent.quoteImpact >= 0 ? '+' : ''}{selectedChangeEvent.quoteImpact.toFixed(2)}
                      </div>
                    </div>
                  </Col>
                  <Col span={6}>
                    <div style={{ padding: 16, borderRadius: 12, background: 'rgba(0,0,0,0.02)' }}>
                      <Text style={{ fontSize: 12, color: '#71717a' }}>残余材料影响</Text>
                      <div className="ledger-number" style={{ marginTop: 8, fontSize: 24, color: selectedChangeEvent.residualImpact > 0 ? '#dc2626' : '#71717a' }}>
                        {selectedChangeEvent.residualImpact >= 0 ? '+' : ''}{selectedChangeEvent.residualImpact.toFixed(2)}
                      </div>
                    </div>
                  </Col>
                </Row>

                <div style={{ marginBottom: 16, padding: 16, borderRadius: 12, background: 'rgba(0,0,0,0.02)' }}>
                  <Text style={{ fontSize: 12, color: '#71717a' }}>事件摘要</Text>
                  <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <Tag color={CHANGE_EVENT_COLORS[selectedChangeEvent.changeType]}>{CHANGE_EVENT_LABELS[selectedChangeEvent.changeType]}</Tag>
                    <Tag>{selectedChangeEvent.affectedHarnessIds.length} 条线束</Tag>
                    <Tag>{selectedChangeEvent.affectedBomRows.length} 条 BOM 变更</Tag>
                    <Tag>创建于 {new Date(selectedChangeEvent.createdAt).toLocaleString('zh-CN')}</Tag>
                  </div>
                  <Text style={{ display: 'block', marginTop: 12 }}>
                    {selectedChangeEvent.reason || '未填写设变原因'}
                  </Text>
                </div>
              </>
            ) : (
              <Empty
                description={
                  changeEventsLoading
                    ? '设变台账加载中...'
                    : '当前场景还没有正式设变事件，先完成版本对比后再写入。'
                }
              />
            )}

            {recentChangeEvents.length > 0 && (
              <Table
                pagination={false}
                size="small"
                dataSource={recentChangeEvents.map((item) => ({ ...item, key: item.id }))}
                onRow={(record) => {
                  if (!record) return {};
                  return {
                    onClick: () => setSelectedChangeId(record.id),
                    style: {
                      cursor: 'pointer',
                      background: record.id === selectedChangeEvent?.id ? 'rgba(37,99,235,0.06)' : undefined,
                    },
                  };
                }}
                columns={[
                  {
                    title: '创建时间',
                    dataIndex: 'createdAt',
                    width: 180,
                    render: (value: string) => new Date(value).toLocaleString('zh-CN'),
                  },
                  {
                    title: '类型',
                    dataIndex: 'changeType',
                    width: 100,
                    render: (value: PersistedChangeType) => (
                      <Tag color={CHANGE_EVENT_COLORS[value]} size="small">
                        {CHANGE_EVENT_LABELS[value]}
                      </Tag>
                    ),
                  },
                  {
                    title: '状态',
                    dataIndex: 'status',
                    width: 100,
                    render: (value: string) => <Tag color={value === 'calculated' ? 'green' : 'orange'}>{value}</Tag>,
                  },
                  {
                    title: '成本影响',
                    dataIndex: 'costImpact',
                    width: 120,
                    align: 'right' as const,
                    render: (value: number) => (
                      <span className="ledger-number" style={{ color: value >= 0 ? '#dc2626' : '#16a34a' }}>
                        {value >= 0 ? '+' : ''}{(value || 0).toFixed(2)}
                      </span>
                    ),
                  },
                  {
                    title: '残余材料',
                    dataIndex: 'residualImpact',
                    width: 120,
                    align: 'right' as const,
                    render: (value: number) => (
                      <span className="ledger-number" style={{ color: value > 0 ? '#dc2626' : '#71717a' }}>
                        {value >= 0 ? '+' : ''}{(value || 0).toFixed(2)}
                      </span>
                    ),
                  },
                  {
                    title: '摘要',
                    dataIndex: 'reason',
                    render: (value: string) => <Text ellipsis={{ showTooltip: true }}>{value || '-'}</Text>,
                  },
                ]}
              />
            )}
          </div>
        </Col>

        {versionDiffResult && (
          <Col span={24}>
            <div className="glass-card" style={{ padding: 24 }}>
              <Title heading={5} className="ink-heading" style={{ margin: 0, marginBottom: 16 }}>
                项目级成本维度对比
              </Title>
              <Table
                pagination={false}
                size="small"
                dataSource={versionDiffResult.projectLevel.map((d, i) => ({
                  key: String(i),
                  label: d.label,
                  before: d.before,
                  after: d.after,
                  delta: d.delta,
                  deltaPct: d.deltaPercent,
                }))}
                columns={[
                  { title: '维度', dataIndex: 'label', width: 120 },
                  {
                    title: '基准',
                    dataIndex: 'before',
                    width: 120,
                    align: 'right' as const,
                    render: (v: number) => <span className="ledger-number">{typeof v === 'number' ? v.toFixed(2) : v}</span>,
                  },
                  {
                    title: '变更后',
                    dataIndex: 'after',
                    width: 120,
                    align: 'right' as const,
                    render: (v: number) => <span className="ledger-number" style={{ color: '#2563eb' }}>{typeof v === 'number' ? v.toFixed(2) : v}</span>,
                  },
                  {
                    title: '差异',
                    dataIndex: 'delta',
                    width: 120,
                    align: 'right' as const,
                    render: (v: number) => (
                      <span className="ledger-number" style={{
                        color: v > 0.001 ? '#dc2626' : v < -0.001 ? '#16a34a' : '#71717a',
                        fontWeight: 700,
                      }}>
                        {v >= 0 ? '+' : ''}{typeof v === 'number' ? v.toFixed(2) : v}
                      </span>
                    ),
                  },
                  {
                    title: '差异%',
                    dataIndex: 'deltaPct',
                    width: 80,
                    align: 'right' as const,
                    render: (v: number) => (
                      <span style={{ color: v > 0 ? '#dc2626' : v < 0 ? '#16a34a' : '#71717a' }}>
                        {v >= 0 ? '+' : ''}{(v || 0).toFixed(2)}%
                      </span>
                    ),
                  },
                ]}
              />
            </div>
          </Col>
        )}
      </Row>

      {/* ──── 级联影响预览模态框 ──── */}
      <Modal
        title="级联影响预览"
        visible={showCascadePreview}
        onOk={() => setShowCascadePreview(false)}
        onCancel={() => setShowCascadePreview(false)}
        okText="确认"
        cancelText="取消"
        width={800}
      >
        {cascade.result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Text>
              检测到 <Text strong style={{ color: '#2563eb' }}>{cascade.result.totalActions}</Text> 项级联影响
            </Text>
            {cascade.result.assembly && (
              <div>
                <Text strong>装配件表影响：</Text>
                <Text>{cascade.result.assembly.actions?.length || 0} 项</Text>
              </div>
            )}
            {cascade.result.secondary && (
              <div>
                <Text strong>辅材表影响：</Text>
                <Text>{cascade.result.secondary.actions?.length || 0} 项</Text>
              </div>
            )}
            {cascade.result.ksk && (
              <div>
                <Text strong>KSK表影响：</Text>
                <Text>{cascade.result.ksk.actions?.length || 0} 项</Text>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ──── 创建快照模态框 ──── */}
      <Modal
        title="创建版本快照"
        visible={showCreateModal}
        onOk={handleCreate}
        onCancel={() => setShowCreateModal(false)}
        confirmLoading={creating}
        okText="创建"
        cancelText="取消"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <Text style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' }}>版本标签</Text>
            <Input
              placeholder={`v${(versions.length > 0 ? Math.max(...versions.map(v => v.versionNumber)) + 1 : 1)}`}
              value={newLabel}
              onChange={setNewLabel}
            />
          </div>
          <div>
            <Text style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' }}>备注</Text>
            <Input
              placeholder="如：定点版本 / BOM设变-增加充电插座线束 / 铜价联动Q2"
              value={newNotes}
              onChange={setNewNotes}
            />
          </div>
          <Text type="tertiary" style={{ fontSize: 11 }}>
            快照将保存当前所有线束的 BOM 数据、费率配置和金属价格，不可修改（需新建版本）。
          </Text>
        </div>
      </Modal>
    </div>
  );
}
