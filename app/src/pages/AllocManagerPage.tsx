import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Typography,
  Spin,
  Table,
  Row,
  Col,
  Toast,
  InputNumber,
  Button,
  Empty,
  Tag,
  Progress,
  Banner,
  Space,
  Tooltip,
  Select,
  Input,
} from '@douyinfe/semi-ui';
import { IconSave, IconRefresh, IconAlertTriangle } from '@douyinfe/semi-icons';
import ReactECharts from 'echarts-for-react/lib/core';
import echarts from '@/lib/echarts';
import { db } from '@/data/db';
import type { ProjectRecord, ScenarioRecord } from '@/data/db';
import { ensureScenarioWorkspaceHydrated } from '@/data/serverScenarioSync';
import { useAllocStore, type ScenarioFeeItem } from '@/store/allocStore';
import {
  computeProjectAllocFromItems,
  computeProjectRecoveryFromItems,
  simulateRecoveryTimelineFromItems,
  type OnetimeCostItem,
  type PaymentMode,
} from '@/engine/onetime_alloc';
import ScenarioSelector from '@/components/ScenarioSelector';

const { Title, Text } = Typography;

const DEFAULT_ALLOC_BASE = 50000;

const PAYMENT_MODE_OPTIONS = [
  { value: 'amortized', label: '分摊' },
  { value: 'lumpsum', label: '一次性' },
  { value: 'mixed', label: '混合' },
];

const FEE_CATEGORY_OPTIONS = [
  { value: 'tooling', label: '工装费' },
  { value: 'testing', label: '试验费' },
  { value: 'rnd', label: '研发费' },
];

const RECOVERY_STATUS_MAP: Record<string, { color: string; label: string }> = {
  recovering: { color: 'blue', label: '回收中' },
  recovered: { color: 'green', label: '已回收' },
  overdue: { color: 'red', label: '超期' },
};

interface HarnessMeta {
  harnessId: string;
  harnessName: string;
  vehicleRatio: number;
}

function createEmptyParticipants(harnesses: HarnessMeta[], cumProducedMap: Record<string, number>) {
  return harnesses.map((harness) => ({
    harnessId: harness.harnessId,
    harnessName: harness.harnessName,
    vehicleRatio: harness.vehicleRatio,
    quantity: 0,
    latestCumulativeVolume: Math.max(0, Number(cumProducedMap[harness.harnessId] || 0)),
    latestInstallRatioSnapshot: harness.vehicleRatio,
    latestRecoveryPeriod: null,
  }));
}

function normalizeEditableFeeItems(
  feeItems: ScenarioFeeItem[],
  harnesses: HarnessMeta[],
  cumProducedMap: Record<string, number>,
) {
  return feeItems.map((feeItem) => {
    const participantMap = new Map(feeItem.participants.map((participant) => [participant.harnessId, participant]));
    return {
      ...feeItem,
      participants: harnesses.map((harness) => {
        const existing = participantMap.get(harness.harnessId);
        return {
          harnessId: harness.harnessId,
          harnessName: harness.harnessName,
          vehicleRatio: harness.vehicleRatio,
          quantity: Number(existing?.quantity || 0),
          allocationItemId: existing?.allocationItemId,
          latestCumulativeVolume: Math.max(
            0,
            Number(existing?.latestCumulativeVolume ?? cumProducedMap[harness.harnessId] ?? 0),
          ),
          latestInstallRatioSnapshot: Number(existing?.latestInstallRatioSnapshot ?? harness.vehicleRatio),
          latestRecoveryPeriod: existing?.latestRecoveryPeriod ?? null,
        };
      }),
    } satisfies ScenarioFeeItem;
  });
}

function buildEmptyFeeItem(
  projectId: string,
  scenarioId: string,
  harnesses: HarnessMeta[],
  cumProducedMap: Record<string, number>,
  index: number,
): ScenarioFeeItem {
  return {
    feeId: crypto.randomUUID(),
    projectId,
    scenarioId,
    feeName: `新费用项${index}`,
    feeCategory: 'tooling',
    unitPrice: 0,
    allocBase: DEFAULT_ALLOC_BASE,
    paymentMode: 'amortized',
    burdenSide: 'customer',
    pricingEffect: 'included_in_price',
    recoveryCompletionBehavior: 'trigger_price_adjust',
    priceAdjustReminder: false,
    targetRecoveryDate: null,
    completedAt: null,
    status: 'allocated',
    sourceVersionId: null,
    participants: createEmptyParticipants(harnesses, cumProducedMap),
  };
}

function toPreviewItems(feeItems: ScenarioFeeItem[], cumProducedMap: Record<string, number>): OnetimeCostItem[] {
  return feeItems.map((feeItem) => ({
    feeId: feeItem.feeId,
    feeName: feeItem.feeName,
    feeCategory: feeItem.feeCategory === 'testing' || feeItem.feeCategory === 'rnd' ? feeItem.feeCategory : 'tooling',
    unitPrice: Number(feeItem.unitPrice || 0),
    allocBase: Math.max(1, Number(feeItem.allocBase || 1)),
    paymentMode: feeItem.paymentMode ?? 'amortized',
    recoveryCompletionBehavior: feeItem.recoveryCompletionBehavior,
    priceAdjustReminder: feeItem.priceAdjustReminder,
    targetRecoveryDate: feeItem.targetRecoveryDate ?? null,
    completedAt: feeItem.completedAt ?? null,
    status: feeItem.status,
    participants: feeItem.participants.map((participant) => ({
      harnessId: participant.harnessId,
      harnessName: participant.harnessName,
      vehicleRatio: Number(participant.vehicleRatio || 0),
      quantity: Number(participant.quantity || 0),
      latestCumulativeVolume: Math.max(0, Number(cumProducedMap[participant.harnessId] ?? participant.latestCumulativeVolume ?? 0)),
    })),
  }));
}

export function buildFallbackFeeItemsFromRows(
  rows: Array<{
    harnessId: string;
    harnessName: string;
    vehicleRatio: number;
    toolingCost: number;
    testingCost: number;
    rndCost: number;
    allocBase: number;
    paymentMode: PaymentMode;
    cumProduced: number;
  }>,
  projectId: string,
  scenarioId: string,
): ScenarioFeeItem[] {
  throw new Error('当前场景缺少真实一次性费用矩阵，已禁止从旧分摊行伪造 feeItems。请先维护费用矩阵后再进入分摊页。');

  const feeItems: ScenarioFeeItem[] = [];

  rows.forEach((row) => {
    const defs = [
      { feeCategory: 'tooling' as const, feeName: `工装费-${row.harnessId}`, unitPrice: Number(row.toolingCost || 0) },
      { feeCategory: 'testing' as const, feeName: `试验费-${row.harnessId}`, unitPrice: Number(row.testingCost || 0) },
      { feeCategory: 'rnd' as const, feeName: `研发费-${row.harnessId}`, unitPrice: Number(row.rndCost || 0) },
    ];

    defs.forEach((def) => {
      if (def.unitPrice <= 0) return;
      feeItems.push({
        feeId: `${row.harnessId}-${def.feeCategory}`,
        projectId,
        scenarioId,
        feeName: def.feeName,
        feeCategory: def.feeCategory,
        unitPrice: def.unitPrice,
        allocBase: Math.max(1, Number(row.allocBase || 1)),
        paymentMode: row.paymentMode ?? 'amortized',
        burdenSide: 'customer',
        pricingEffect: 'included_in_price',
        recoveryCompletionBehavior: 'trigger_price_adjust',
        priceAdjustReminder: false,
        targetRecoveryDate: null,
        completedAt: null,
        status: 'allocated',
        sourceVersionId: null,
        participants: [
          {
            harnessId: row.harnessId,
            harnessName: row.harnessName,
            vehicleRatio: row.vehicleRatio,
            quantity: 1,
            latestCumulativeVolume: Math.max(0, Number(row.cumProduced || 0)),
            latestInstallRatioSnapshot: row.vehicleRatio,
            latestRecoveryPeriod: null,
          },
        ],
      });
    });
  });

  return feeItems;
}

export default function AllocManagerPage() {
  const { id: projectId, sid } = useParams<{ id: string; sid: string }>();
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [scenario, setScenario] = useState<ScenarioRecord | null>(null);
  const [harnesses, setHarnesses] = useState<HarnessMeta[]>([]);
  const [editFeeItems, setEditFeeItems] = useState<ScenarioFeeItem[]>([]);
  const [cumProducedMap, setCumProducedMap] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  const {
    loadProjectAlloc,
    loadScenarioAlloc,
    saveFeeItem,
    updateFeeItem,
    deleteFeeItem,
  } = useAllocStore();

  const loadData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setPageError(null);
    try {
      if (sid) {
        await ensureScenarioWorkspaceHydrated(projectId, sid);
      }

      const p = await db.projects.get(projectId);
      if (!p) return;
      setProject(p);

      const sc = sid ? await db.scenarios.get(sid) : null;
      setScenario(sc ?? null);

      const hRecords = sid
        ? await db.harnesses.where('scenarioId').equals(sid).toArray()
        : await db.harnesses.where('projectId').equals(projectId).toArray();

      if (sid) {
        await loadScenarioAlloc(sid);
      } else {
        await loadProjectAlloc(projectId);
      }

      const storeState = useAllocStore.getState();
      const persistedRows = storeState.scenarioRows;
      const nextHarnesses: HarnessMeta[] = hRecords.map((h) => ({
        harnessId: h.harnessId,
        harnessName: h.harnessName,
        vehicleRatio: Number(h.input.vehicleRatio || 0),
      }));
      const nextCumProducedMap = Object.fromEntries(
        nextHarnesses.map((harness) => {
          const persisted = persistedRows.find((row) => row.harnessId === harness.harnessId);
          return [harness.harnessId, Math.max(0, Number(persisted?.cumProduced || 0))];
        }),
      );
      const hasRealFeeMatrix = storeState.feeItems.length > 0;
      const normalizedFeeItems = hasRealFeeMatrix
        ? normalizeEditableFeeItems(storeState.feeItems, nextHarnesses, nextCumProducedMap)
        : [];

      setHarnesses(nextHarnesses);
      setCumProducedMap(nextCumProducedMap);
      setEditFeeItems(normalizedFeeItems);
      if (!hasRealFeeMatrix) {
        setPageError('当前场景缺少真实一次性费用矩阵。请先录入费用项，系统不会再从旧分摊行伪造 feeItems。');
      }
    } catch (err) {
      console.error('AllocManager load error:', err);
      setPageError(err instanceof Error ? err.message : String(err));
      Toast.error('加载失败: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  }, [projectId, sid, loadProjectAlloc, loadScenarioAlloc]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const annualCapacity = (scenario?.config ?? project?.config)?.volumes?.[0]?.volume ?? 100000;
  const lifecycleYears = project?.meta?.lifecycleYears ?? 6;

  const previewItems = useMemo(
    () => toPreviewItems(editFeeItems, cumProducedMap),
    [editFeeItems, cumProducedMap],
  );

  const previewSummary = useMemo(() => {
    if (previewItems.length === 0) return null;
    return computeProjectAllocFromItems(previewItems);
  }, [previewItems]);

  const previewRecovery = useMemo(() => {
    if (previewItems.length === 0) return null;
    return computeProjectRecoveryFromItems(previewItems, annualCapacity, lifecycleYears);
  }, [previewItems, annualCapacity, lifecycleYears]);

  const updateFeeItemField = useCallback(
    <K extends keyof ScenarioFeeItem>(feeId: string, field: K, value: ScenarioFeeItem[K]) => {
      setEditFeeItems((prev) => prev.map((item) => (item.feeId === feeId ? { ...item, [field]: value } : item)));
    },
    [],
  );

  const updateParticipantQuantity = useCallback((feeId: string, harnessId: string, quantity: number) => {
    setEditFeeItems((prev) => prev.map((item) => (
      item.feeId === feeId
        ? {
          ...item,
          participants: item.participants.map((participant) => (
            participant.harnessId === harnessId
              ? { ...participant, quantity: Math.max(0, Number(quantity || 0)) }
              : participant
          )),
        }
        : item
    )));
  }, []);

  const updateCumProduced = useCallback((harnessId: string, value: number) => {
    setCumProducedMap((prev) => ({
      ...prev,
      [harnessId]: Math.max(0, Number(value || 0)),
    }));
  }, []);

  const addFeeItem = () => {
    if (!projectId) return;
    setEditFeeItems((prev) => [
      ...prev,
      buildEmptyFeeItem(projectId, sid ?? '', harnesses, cumProducedMap, prev.length + 1),
    ]);
  };

  const removeFeeItem = (feeId: string) => {
    setEditFeeItems((prev) => prev.filter((item) => item.feeId !== feeId));
  };

  const handleSave = async () => {
    if (!projectId) return;
    setSaving(true);
    try {
      if (!sid) {
        Toast.warning('当前页面未绑定场景，矩阵费用项仅在场景模式下支持保存。');
        setSaving(false);
        return;
      }

      const existingIds = new Set(useAllocStore.getState().feeItems.map((item) => item.feeId));
      const nextIds = new Set(editFeeItems.map((item) => item.feeId));

      for (const item of editFeeItems) {
        const payload = {
          feeName: item.feeName,
          feeCategory: item.feeCategory,
          unitPrice: Number(item.unitPrice || 0),
          allocBase: Math.max(1, Number(item.allocBase || 1)),
          paymentMode: item.paymentMode,
          burdenSide: item.burdenSide,
          pricingEffect: item.pricingEffect,
          recoveryCompletionBehavior: item.recoveryCompletionBehavior,
          priceAdjustReminder: item.priceAdjustReminder,
          targetRecoveryDate: item.targetRecoveryDate ?? null,
          completedAt: item.completedAt ?? null,
          status: item.status,
          sourceVersionId: item.sourceVersionId ?? null,
          participants: item.participants.map((participant) => ({
            ...participant,
            latestCumulativeVolume: Math.max(0, Number(cumProducedMap[participant.harnessId] ?? participant.latestCumulativeVolume ?? 0)),
            latestInstallRatioSnapshot: Number(participant.vehicleRatio || 0),
          })),
        };

        if (existingIds.has(item.feeId)) {
          await updateFeeItem(projectId, item.feeId, payload, sid);
        } else {
          await saveFeeItem(projectId, { feeId: item.feeId, ...payload }, sid);
        }
      }

      for (const existingId of existingIds) {
        if (!nextIds.has(existingId)) {
          await deleteFeeItem(projectId, existingId, sid);
        }
      }

      await loadData();
      Toast.success('费用项矩阵已保存');
    } catch (err) {
      Toast.error('保存失败: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  };

  const recoveryChart = useMemo(() => {
    if (!previewSummary) return {};
    const timeline = simulateRecoveryTimelineFromItems(
      previewItems,
      annualCapacity,
      lifecycleYears,
      lifecycleYears,
    );

    const participating = previewSummary.allocations.filter((allocation) => allocation.participates);
    const years = timeline.map((_, i) => `第${i + 1}年`);

    const series = participating.map((alloc) => ({
      name: alloc.harnessId.slice(-4),
      type: 'line' as const,
      data: timeline.map((snap) => {
        const tracker = snap.trackers.find((t) => t.harnessId === alloc.harnessId);
        return tracker ? +(tracker.recoveryProgress * 100).toFixed(1) : 0;
      }),
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
    }));

    return {
      tooltip: {
        trigger: 'axis' as const,
        formatter: (params: any) => {
          if (!Array.isArray(params)) return '';
          let html = `<b>${params[0].axisValue}</b><br/>`;
          for (const p of params) {
            html += `${p.marker} ${p.seriesName}: ${p.value}%<br/>`;
          }
          return html;
        },
      },
      legend: {
        data: participating.map((item) => item.harnessId.slice(-4)),
        bottom: 0,
      },
      grid: { top: 30, bottom: 60, left: 60, right: 20 },
      xAxis: { type: 'category' as const, data: years },
      yAxis: {
        type: 'value' as const,
        name: '回收进度 (%)',
        max: 100,
        axisLabel: { formatter: '{value}%' },
      },
      series,
    };
  }, [previewItems, previewSummary, annualCapacity, lifecycleYears]);

  const matrixGrandTotal = useMemo(
    () => editFeeItems.reduce((sum, item) => sum + Number(item.unitPrice || 0) * item.participants.reduce((rowSum, p) => rowSum + Number(p.quantity || 0), 0), 0),
    [editFeeItems],
  );

  const matrixColumns = useMemo(() => {
    const harnessColumns = harnesses.map((harness) => ({
      title: (
        <div style={{ minWidth: 140 }}>
          <div style={{ fontWeight: 700 }}>{harness.harnessId}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{(harness.vehicleRatio * 100).toFixed(1)}%</div>
        </div>
      ),
      dataIndex: harness.harnessId,
      width: 170,
      render: (_: unknown, record: ScenarioFeeItem) => {
        const participant = record.participants.find((item) => item.harnessId === harness.harnessId);
        const quantity = Number(participant?.quantity || 0);
        const totalAmount = Number(record.unitPrice || 0) * quantity;
        const perUnit = record.allocBase > 0 ? totalAmount / Number(record.allocBase || 1) : 0;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <InputNumber
              min={0}
              step={1}
              precision={0}
              value={quantity}
              style={{ width: 130 }}
              onChange={(value) => updateParticipantQuantity(record.feeId, harness.harnessId, Number(value) || 0)}
            />
            <Text style={{ fontSize: 12, color: quantity > 0 ? 'var(--accent)' : 'var(--text-secondary)' }}>
              ¥{perUnit.toFixed(4)}/根
            </Text>
          </div>
        );
      },
    }));

    return [
      {
        title: '费用项名称',
        dataIndex: 'feeName',
        width: 180,
        fixed: 'left' as const,
        render: (value: string, record: ScenarioFeeItem) => (
          <Input
            value={value}
            maxLength={40}
            onChange={(next) => updateFeeItemField(record.feeId, 'feeName', next)}
          />
        ),
      },
      {
        title: '费用类别',
        dataIndex: 'feeCategory',
        width: 120,
        fixed: 'left' as const,
        render: (value: string, record: ScenarioFeeItem) => (
          <Select
            value={value}
            optionList={FEE_CATEGORY_OPTIONS}
            style={{ width: 100 }}
            onChange={(next) => updateFeeItemField(record.feeId, 'feeCategory', String(next))}
          />
        ),
      },
      {
        title: '单价',
        dataIndex: 'unitPrice',
        width: 120,
        align: 'right' as const,
        render: (value: number, record: ScenarioFeeItem) => (
          <InputNumber
            min={0}
            step={100}
            value={Number(value || 0)}
            style={{ width: 110 }}
            onChange={(next) => updateFeeItemField(record.feeId, 'unitPrice', Number(next) || 0)}
          />
        ),
      },
      {
        title: '分摊基数',
        dataIndex: 'allocBase',
        width: 120,
        align: 'right' as const,
        render: (value: number, record: ScenarioFeeItem) => (
          <InputNumber
            min={1}
            step={1000}
            value={Number(value || DEFAULT_ALLOC_BASE)}
            style={{ width: 110 }}
            onChange={(next) => updateFeeItemField(record.feeId, 'allocBase', Math.max(1, Number(next) || DEFAULT_ALLOC_BASE))}
          />
        ),
      },
      {
        title: '支付模式',
        dataIndex: 'paymentMode',
        width: 110,
        align: 'center' as const,
        render: (value: string, record: ScenarioFeeItem) => (
          <Select
            value={value}
            optionList={PAYMENT_MODE_OPTIONS}
            style={{ width: 96 }}
            onChange={(next) => updateFeeItemField(record.feeId, 'paymentMode', next as PaymentMode)}
          />
        ),
      },
      ...harnessColumns,
      {
        title: '费用合计',
        dataIndex: 'rowTotal',
        width: 130,
        align: 'right' as const,
        render: (_: unknown, record: ScenarioFeeItem) => {
          const rowTotal = Number(record.unitPrice || 0)
            * record.participants.reduce((sum, participant) => sum + Number(participant.quantity || 0), 0);
          return <span className="ledger-number">¥{rowTotal.toLocaleString()}</span>;
        },
      },
      {
        title: '操作',
        dataIndex: 'actions',
        width: 90,
        fixed: 'right' as const,
        align: 'center' as const,
        render: (_: unknown, record: ScenarioFeeItem) => (
          <Button theme="borderless" type="danger" onClick={() => removeFeeItem(record.feeId)}>
            删除
          </Button>
        ),
      },
    ];
  }, [harnesses, updateFeeItemField, updateParticipantQuantity]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!project) {
    return <Empty description="未找到项目" />;
  }

  if (pageError && harnesses.length === 0) {
    return (
      <div style={{ maxWidth: 1400, margin: '0 auto', paddingBottom: 64 }}>
        <ScenarioSelector />
        <Banner type="danger" description={pageError} style={{ marginBottom: 16 }} />
        <Empty description="请补齐一次性费用矩阵后重试" />
      </div>
    );
  }

  if (harnesses.length === 0) {
    return (
      <div style={{ maxWidth: 1400, margin: '0 auto', paddingBottom: 64 }}>
        <ScenarioSelector />
        <Empty description="当前场景下暂无线束数据" />
      </div>
    );
  }

  const summary = previewSummary;
  const recoverySummary = previewRecovery;
  const totalTooling = summary?.totalTooling ?? 0;
  const totalTesting = summary?.totalTesting ?? 0;
  const totalRnd = summary?.totalRnd ?? 0;
  const grandTotal = summary?.grandTotal ?? 0;
  const weightedAlloc = summary?.weightedAllocPerVehicle ?? 0;

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', paddingBottom: 64 }} data-testid="alloc-manager-page">
      <ScenarioSelector />

      {pageError ? (
        <Banner type="danger" description={pageError} style={{ marginBottom: 16 }} />
      ) : null}

      {recoverySummary && recoverySummary.priceAdjustmentAlerts.length > 0 && (
        <Banner
          type="warning"
          icon={<IconAlertTriangle />}
          description={`以下线束分摊已回收完毕，建议调整报价：${recoverySummary.priceAdjustmentAlerts.map((alert) => alert.harnessName || alert.harnessId).join(', ')}`}
          style={{ marginBottom: 16 }}
        />
      )}

      {recoverySummary && (() => {
        const overdueTrackers = recoverySummary.trackers.filter((tracker) => tracker.status === 'overdue');
        if (!overdueTrackers.length) return null;
        return (
          <Banner
            type="danger"
            icon={<IconAlertTriangle />}
            description={
              <span>
                {overdueTrackers.length} 条线束分摊回收超出项目周期：
                {overdueTrackers.map((tracker) => (
                  <span key={tracker.harnessId} style={{ marginLeft: 8, fontWeight: 600 }}>
                    {tracker.harnessId}（预计 {tracker.estimatedRecoveryYear ?? '?'} 年）
                  </span>
                ))}
              </span>
            }
            style={{ marginBottom: 16 }}
          />
        );
      })()}

      <Row gutter={[24, 24]}>
        <Col span={6}>
          <div className="glass-card" style={{ padding: 24, height: '100%' }}>
            <Text style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-secondary)' }}>工装费合计</Text>
            <div className="ledger-number" style={{ fontSize: 28, marginTop: 8 }}>
              ¥{totalTooling.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </div>
        </Col>
        <Col span={6}>
          <div className="glass-card" style={{ padding: 24, height: '100%' }}>
            <Text style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-secondary)' }}>试验费合计</Text>
            <div className="ledger-number" style={{ fontSize: 28, marginTop: 8 }}>
              ¥{totalTesting.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </div>
        </Col>
        <Col span={6}>
          <div className="glass-card" style={{ padding: 24, height: '100%' }}>
            <Text style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-secondary)' }}>研发费合计</Text>
            <div className="ledger-number" style={{ fontSize: 28, marginTop: 8 }}>
              ¥{totalRnd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </div>
        </Col>
        <Col span={6}>
          <div className="glass-card" style={{ padding: 24, height: '100%' }}>
            <Text style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-secondary)' }}>一次性费用总计</Text>
            <div className="ledger-number" style={{ fontSize: 28, marginTop: 8, color: 'var(--accent)' }}>
              ¥{grandTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <Text style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, display: 'block' }}>
              参与: {summary?.participatingCount ?? 0} / 不参与: {summary?.nonParticipatingCount ?? 0}
            </Text>
          </div>
        </Col>
        <Col span={6}>
          <div className="glass-card" style={{ padding: 24, height: '100%' }}>
            <Text style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-secondary)' }}>加权单车分摊</Text>
            <div className="ledger-number" style={{ fontSize: 28, marginTop: 8, color: 'var(--danger)' }}>
              ¥{weightedAlloc.toFixed(4)}
            </div>
            <Text style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, display: 'block' }}>
              Σ(单根分摊 × 装车比)
            </Text>
          </div>
        </Col>

        <Col span={24}>
          <div className="glass-card" style={{ padding: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <Title heading={4} className="ink-heading" style={{ margin: 0 }}>
                  费用项矩阵录入
                </Title>
                <Text style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  每费用项一行，动态填写参与线束数量，单元格实时预览单根分摊额。
                </Text>
              </div>
              <Space>
                <Text style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  共 {editFeeItems.length} 项 · 合计 ¥{matrixGrandTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </Text>
                <Button data-testid="alloc-add-fee-item" onClick={addFeeItem}>新增费用项</Button>
                <Button data-testid="alloc-refresh" icon={<IconRefresh />} onClick={loadData}>刷新</Button>
                <Button data-testid="alloc-save-matrix" type="primary" icon={<IconSave />} loading={saving} onClick={handleSave}>
                  保存矩阵
                </Button>
              </Space>
            </div>
            <Table
              data-testid="alloc-fee-matrix-table"
              pagination={false}
              size="small"
              scroll={{ x: Math.max(1600, 980 + harnesses.length * 170) }}
              columns={matrixColumns}
              dataSource={editFeeItems}
              rowKey="feeId"
              empty={<Empty description="暂无费用项，点击“新增费用项”开始录入" image={null} />}
            />
          </div>
        </Col>

        <Col span={24}>
          <div className="glass-card" style={{ padding: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Title heading={4} className="ink-heading" style={{ margin: 0 }}>
                回收输入
              </Title>
              <Text style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                按线束维护累计产量，驱动下方回收进度与调价提醒实时预览。
              </Text>
            </div>
            <Table
              data-testid="alloc-cum-produced-table"
              pagination={false}
              size="small"
              columns={[
                {
                  title: '零件号',
                  dataIndex: 'harnessId',
                  width: 140,
                  render: (value: string) => <Text strong>{value}</Text>,
                },
                {
                  title: '名称',
                  dataIndex: 'harnessName',
                  width: 180,
                },
                {
                  title: '装车比',
                  dataIndex: 'vehicleRatio',
                  width: 90,
                  align: 'center' as const,
                  render: (value: number) => <Tag>{(value * 100).toFixed(1)}%</Tag>,
                },
                {
                  title: '累计产量',
                  dataIndex: 'cumProduced',
                  width: 160,
                  align: 'right' as const,
                  render: (_: unknown, record: HarnessMeta) => (
                    <InputNumber
                      min={0}
                      step={1000}
                      value={Number(cumProducedMap[record.harnessId] || 0)}
                      style={{ width: 140 }}
                      onChange={(value) => updateCumProduced(record.harnessId, Number(value) || 0)}
                    />
                  ),
                },
              ]}
              dataSource={harnesses}
              rowKey="harnessId"
              scroll={{ x: 700 }}
            />
          </div>
        </Col>

        {summary && summary.allocations.filter((allocation) => allocation.participates).length > 0 && (
          <Col span={24}>
            <div className="glass-card" style={{ padding: 32 }}>
              <Title heading={4} className="ink-heading" style={{ marginBottom: 16 }}>
                按线束聚合后的分摊计算明细
              </Title>
              <Table
                pagination={false}
                size="small"
                columns={[
                  { title: '零件号', dataIndex: 'harnessId', width: 120, render: (value: string) => <Text strong>{value}</Text> },
                  { title: '名称', dataIndex: 'harnessName', width: 160 },
                  { title: '装车比', dataIndex: 'vehicleRatio', width: 90, align: 'center' as const, render: (value: number) => `${(value * 100).toFixed(1)}%` },
                  { title: '工装/根', dataIndex: 'toolingPerUnit', width: 100, align: 'right' as const, render: (value: number) => <span className="ledger-number">¥{value.toFixed(4)}</span> },
                  { title: '试验/根', dataIndex: 'testingPerUnit', width: 100, align: 'right' as const, render: (value: number) => <span className="ledger-number">¥{value.toFixed(4)}</span> },
                  { title: '研发/根', dataIndex: 'rndPerUnit', width: 100, align: 'right' as const, render: (value: number) => <span className="ledger-number">¥{value.toFixed(4)}</span> },
                  { title: '合计/根', dataIndex: 'totalPerUnit', width: 110, align: 'right' as const, render: (value: number) => <span className="ledger-number" style={{ fontWeight: 700, color: 'var(--accent)' }}>¥{value.toFixed(4)}</span> },
                  { title: '总费用', dataIndex: 'totalOnetimeCost', width: 120, align: 'right' as const, render: (value: number) => <span className="ledger-number">¥{value.toLocaleString()}</span> },
                ]}
                dataSource={summary.allocations.filter((allocation) => allocation.participates)}
                rowKey="harnessId"
                scroll={{ x: 1000 }}
              />
            </div>
          </Col>
        )}

        {summary && summary.participatingCount > 0 && (
          <Col span={24}>
            <div className="glass-card" style={{ padding: 32 }}>
              <Title heading={4} className="ink-heading" style={{ marginBottom: 16 }}>
                分摊回收进度预测（{lifecycleYears}年生命周期 · 年产能 {(annualCapacity / 10000).toFixed(0)}万台）
              </Title>
              <div style={{ height: 350 }}>
                <ReactECharts echarts={echarts} option={recoveryChart} style={{ height: '100%' }} />
              </div>
              <Text style={{ fontSize: 12, color: '#71717a', marginTop: 8, display: 'block' }}>
                * 回收进度 = 累计产量 ÷ 分摊基数 × 100%，达到100%后建议销售调整报价（去掉分摊部分）
              </Text>
            </div>
          </Col>
        )}

        {recoverySummary && recoverySummary.trackers.filter((tracker) => tracker.totalOnetimeCost > 0).length > 0 && (
          <Col span={24}>
            <div className="glass-card" style={{ padding: 32 }}>
              <Title heading={4} className="ink-heading" style={{ marginBottom: 16 }}>
                当前回收进度
              </Title>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {recoverySummary.trackers
                  .filter((tracker) => tracker.totalOnetimeCost > 0)
                  .map((tracker) => (
                    <div key={tracker.harnessId} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <Text style={{ width: 120, fontFamily: 'JetBrains Mono, Consolas, monospace', fontWeight: 600 }}>
                        {tracker.harnessId.slice(-4)}
                      </Text>
                      <Progress
                        percent={Math.round(tracker.recoveryProgress * 100)}
                        showInfo
                        style={{ flex: 1 }}
                        stroke={tracker.status === 'recovered' ? '#16a34a' : tracker.status === 'overdue' ? '#dc2626' : '#2563eb'}
                      />
                      {(() => {
                        const statusMeta = RECOVERY_STATUS_MAP[tracker.status];
                        return statusMeta ? <Tag color={statusMeta.color as any} size="small">{statusMeta.label}</Tag> : null;
                      })()}
                      {tracker.needsPriceAdjustment && (
                        <Tooltip content="建议调整报价，去掉分摊部分">
                          <IconAlertTriangle style={{ color: '#d97706' }} />
                        </Tooltip>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          </Col>
        )}
      </Row>
    </div>
  );
}
