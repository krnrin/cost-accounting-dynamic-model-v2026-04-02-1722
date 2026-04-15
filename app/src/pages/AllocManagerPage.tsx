/**
 * 一次性费用分摊管理页面
 * 
 * 功能：
 * 1. 一次性费用录入表（每条线束的工装/试验/研发费用）
 * 2. 分摊计算结果展示（单根分摊额、含分摊到厂价）
 * 3. 回收进度可视化（进度条 + 回收时间轴图表）
 * 4. 调价提醒
 */
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Typography, Spin, Table, Row, Col, Toast, InputNumber,
  Button, Empty, Tag, Progress, Banner, Space, Tooltip, Select,
} from '@douyinfe/semi-ui';
import { IconSave, IconRefresh, IconAlertTriangle } from '@douyinfe/semi-icons';
import ReactECharts from 'echarts-for-react/lib/core';
import echarts from '@/lib/echarts';
import { db } from '@/data/db';
import type { ProjectRecord, ScenarioRecord } from '@/data/db';
import { useAllocStore } from '@/store/allocStore';
import {
  normalizeOnetimeInputs,
  simulateRecoveryTimeline,
  type OnetimeCostInput,
  type PaymentMode,
} from '@/engine/onetime_alloc';
import ScenarioSelector from '@/components/ScenarioSelector';

const { Title, Text } = Typography;

const PAYMENT_MODE_OPTIONS = [
  { value: 'amortized', label: '分摊' },
  { value: 'lumpsum', label: '一次性' },
  { value: 'mixed', label: '混合' },
];

const RECOVERY_STATUS_MAP: Record<string, { color: string; label: string }> = {
  recovering: { color: 'blue', label: '回收中' },
  recovered: { color: 'green', label: '已回收' },
  overdue: { color: 'red', label: '超期' },
};

/** 编辑行数据 */
interface EditRow {
  harnessId: string;
  harnessName: string;
  vehicleRatio: number;
  toolingCost: number;
  testingCost: number;
  rndCost: number;
  allocBase: number;
  paymentMode: PaymentMode;
  cumProduced: number;
}

export default function AllocManagerPage() {
  const { id: projectId, sid } = useParams<{ id: string; sid: string }>();
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [scenario, setScenario] = useState<ScenarioRecord | null>(null);
  const [editRows, setEditRows] = useState<EditRow[]>([]);
  const [saving, setSaving] = useState(false);

  const { recoverySummary, loadProjectAlloc, loadScenarioAlloc, batchSaveOnetimeCosts, syncScenarioAllocRows } = useAllocStore();

  // 加载数据
  const loadData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const p = await db.projects.get(projectId);
      if (!p) return;
      setProject(p);

      // 加载场景
      const sc = sid ? await db.scenarios.get(sid) : null;
      setScenario(sc ?? null);

      // 线束查询：优先按 scenarioId，回退到 projectId
      const hRecords = sid
        ? await db.harnesses.where('scenarioId').equals(sid).toArray()
        : await db.harnesses.where('projectId').equals(projectId).toArray();

      // 加载已有的分摊数据
      if (sid) {
        await loadScenarioAlloc(sid);
      } else {
        await loadProjectAlloc(projectId);
      }

      // 初始化编辑行
      const persistedRows = useAllocStore.getState().scenarioRows;
      const persistedRowMap = new Map(persistedRows.map((row) => [row.harnessId, row]));

      const rows: EditRow[] = hRecords.map(h => {
        const existing = persistedRowMap.get(h.harnessId);
        return {
          harnessId: h.harnessId,
          harnessName: h.harnessName,
          vehicleRatio: h.input.vehicleRatio,
          toolingCost: existing?.toolingCost ?? 0,
          testingCost: existing?.testingCost ?? 0,
          rndCost: existing?.rndCost ?? 0,
          allocBase: existing?.allocBase ?? 50000,
          paymentMode: existing?.paymentMode ?? 'amortized',
          cumProduced: existing?.cumProduced ?? 0,
        };
      });
      setEditRows(rows);
    } catch (err) {
      console.error('AllocManager load error:', err);
      Toast.error('加载失败: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  }, [projectId, sid, loadProjectAlloc, loadScenarioAlloc]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 更新编辑行
  const updateRow = (harnessId: string, field: keyof EditRow, value: number | string) => {
    setEditRows(prev =>
      prev.map(r => (r.harnessId === harnessId ? { ...r, [field]: value } : r))
    );
  };

  // 保存全部
  const handleSave = async () => {
    if (!projectId) return;
    setSaving(true);
    try {
      const inputs: OnetimeCostInput[] = editRows.map(r => ({
        harnessId: r.harnessId,
        harnessName: r.harnessName,
        vehicleRatio: r.vehicleRatio,
        toolingCost: r.toolingCost,
        testingCost: r.testingCost,
        rndCost: r.rndCost,
        allocBase: r.allocBase,
        paymentMode: r.paymentMode,
      }));
      if (sid) {
        await syncScenarioAllocRows(projectId, editRows, sid);
      } else {
        await batchSaveOnetimeCosts(projectId, inputs, sid);
      }
      // 保存 cumProduced
      await loadData();
      Toast.success('分摊数据已保存');
    } catch (err) {
      Toast.error('保存失败: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  };

  // 项目生命周期和年产能
  const lifecycleYears = project?.meta?.lifecycleYears ?? 6;
  const annualCapacity = (scenario?.config ?? project?.config)?.volumes?.[0]?.volume ?? 100000;

  // 实时计算预览
  const previewSummary = useMemo(() => {
    const inputs: OnetimeCostInput[] = editRows.map(r => ({
      harnessId: r.harnessId,
      harnessName: r.harnessName,
      vehicleRatio: r.vehicleRatio,
      toolingCost: r.toolingCost,
      testingCost: r.testingCost,
      rndCost: r.rndCost,
      allocBase: r.allocBase,
      paymentMode: r.paymentMode,
    }));
    return inputs.length > 0 ? normalizeOnetimeInputs(inputs) : null;
  }, [editRows]);

  // 回收时间轴图表
  const recoveryChart = useMemo(() => {
    if (!previewSummary) return {};
    const timeline = simulateRecoveryTimeline(
      previewSummary.allocations,
      annualCapacity,
      lifecycleYears
    );

    const participating = previewSummary.allocations.filter(a => a.participates);
    const years = timeline.map((_, i) => `第${i + 1}年`);

    const series = participating.map(alloc => {
      const data = timeline.map(snap => {
        const tracker = snap.trackers.find(t => t.harnessId === alloc.harnessId);
        return tracker ? +(tracker.recoveryProgress * 100).toFixed(1) : 0;
      });
      return {
        name: alloc.harnessId.slice(-4),
        type: 'line' as const,
        data,
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
      };
    });

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
        data: participating.map(a => a.harnessId.slice(-4)),
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
  }, [previewSummary]);

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

  // 汇总数据
  const summary = previewSummary;
  const totalTooling = summary?.totalTooling ?? 0;
  const totalTesting = summary?.totalTesting ?? 0;
  const grandTotal = summary?.grandTotal ?? 0;
  const weightedAlloc = summary?.weightedAllocPerVehicle ?? 0;

  // 费用录入表列定义
  const columns = [
    {
      title: '零件号',
      dataIndex: 'harnessId',
      width: 120,
      fixed: 'left' as const,
      render: (v: string) => <Text strong style={{ fontFamily: 'JetBrains Mono, Consolas, monospace' }}>{v}</Text>,
    },
    {
      title: '名称',
      dataIndex: 'harnessName',
      width: 160,
    },
    {
      title: '装车比',
      dataIndex: 'vehicleRatio',
      width: 80,
      align: 'center' as const,
      render: (v: number) => <Tag>{(v * 100).toFixed(1)}%</Tag>,
    },
    {
      title: '工装费 (元)',
      dataIndex: 'toolingCost',
      width: 130,
      align: 'right' as const,
      render: (v: number, record: EditRow) => (
        <InputNumber
          value={v}
          min={0}
          step={1000}
          formatter={(val) => `¥ ${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          style={{ width: 120 }}
          onChange={(val) => updateRow(record.harnessId, 'toolingCost', Number(val) || 0)}
        />
      ),
    },
    {
      title: '试验费 (元)',
      dataIndex: 'testingCost',
      width: 130,
      align: 'right' as const,
      render: (v: number, record: EditRow) => (
        <InputNumber
          value={v}
          min={0}
          step={1000}
          formatter={(val) => `¥ ${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          style={{ width: 120 }}
          onChange={(val) => updateRow(record.harnessId, 'testingCost', Number(val) || 0)}
        />
      ),
    },
    {
      title: '研发费 (元)',
      dataIndex: 'rndCost',
      width: 130,
      align: 'right' as const,
      render: (v: number, record: EditRow) => (
        <InputNumber
          value={v}
          min={0}
          step={1000}
          formatter={(val) => `¥ ${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          style={{ width: 120 }}
          onChange={(val) => updateRow(record.harnessId, 'rndCost', Number(val) || 0)}
        />
      ),
    },
    {
      title: '分摊基数',
      dataIndex: 'allocBase',
      width: 110,
      align: 'right' as const,
      render: (v: number, record: EditRow) => (
        <InputNumber
          value={v}
          min={1000}
          step={10000}
          formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          style={{ width: 100 }}
          onChange={(val) => updateRow(record.harnessId, 'allocBase', Number(val) || 50000)}
        />
      ),
    },
    {
      title: '支付模式',
      dataIndex: 'paymentMode',
      width: 110,
      align: 'center' as const,
      render: (v: string, record: EditRow) => (
        <Select
          value={v}
          optionList={PAYMENT_MODE_OPTIONS}
          style={{ width: 95 }}
          onChange={(val) => updateRow(record.harnessId, 'paymentMode', val as string)}
        />
      ),
    },
    {
      title: '已产量',
      dataIndex: 'cumProduced',
      width: 120,
      align: 'right' as const,
      render: (v: number, record: EditRow) => (
        <InputNumber
          value={v}
          min={0}
          step={1000}
          formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          style={{ width: 110 }}
          onChange={(val) => updateRow(record.harnessId, 'cumProduced', Number(val) || 0)}
        />
      ),
    },
    {
      title: '单根分摊',
      dataIndex: 'totalPerUnit',
      width: 100,
      align: 'right' as const,
      render: (_: any, record: EditRow) => {
        const total = record.toolingCost + record.testingCost + record.rndCost;
        const perUnit = record.allocBase > 0 ? total / record.allocBase : 0;
        return (
          <span className="ledger-number" style={{ fontWeight: 700, color: total > 0 ? '#2563eb' : '#a1a1aa' }}>
            ¥{perUnit.toFixed(4)}
          </span>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'participates',
      width: 80,
      align: 'center' as const,
      render: (_: any, record: EditRow) => {
        const total = record.toolingCost + record.testingCost + record.rndCost;
        return total > 0
          ? <Tag color="blue" size="small">参与</Tag>
          : <Tag color="grey" size="small">不参与</Tag>;
      },
    },
  ];

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', paddingBottom: 64 }}>
      <ScenarioSelector />
      {/* 调价提醒 */}
      {recoverySummary && recoverySummary.priceAdjustmentAlerts.length > 0 && (
        <Banner
          type="warning"
          icon={<IconAlertTriangle />}
          description={`以下线束分摊已回收完毕，建议调整报价：${recoverySummary.priceAdjustmentAlerts.join(', ')}`}
          style={{ marginBottom: 16 }}
        />
      )}

      {/* 超期预警 */}
      {recoverySummary && (() => {
        const overdueTrackers = recoverySummary.trackers.filter(t => t.status === 'overdue');
        if (!overdueTrackers.length) return null;
        return (
          <Banner
            type="danger"
            icon={<IconAlertTriangle />}
            description={
              <span>
                {overdueTrackers.length} 条线束分摊回收超出项目周期：
                {overdueTrackers.map(t => (
                  <span key={t.harnessId} style={{ marginLeft: 8, fontWeight: 600 }}>
                    {t.harnessId}（预计 {t.estimatedRecoveryYear ?? '?'} 年）
                  </span>
                ))}
              </span>
            }
            style={{ marginBottom: 16 }}
          />
        );
      })()}

      <Row gutter={[24, 24]}>
        {/* 汇总 KPI 卡片 */}
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

        {/* 费用录入表 */}
        <Col span={24}>
          <div className="glass-card" style={{ padding: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Title heading={4} className="ink-heading" style={{ margin: 0 }}>
                一次性费用录入（按根独立分摊）
              </Title>
              <Space>
                <Button icon={<IconRefresh />} onClick={loadData}>刷新</Button>
                <Button
                  type="primary"
                  icon={<IconSave />}
                  loading={saving}
                  onClick={handleSave}
                >
                  保存全部
                </Button>
              </Space>
            </div>
            <Table
              pagination={false}
              size="small"
              scroll={{ x: 1200 }}
              columns={columns}
              dataSource={editRows}
              rowKey="harnessId"
            />
          </div>
        </Col>

        {/* 分摊计算结果明细 */}
        {summary && summary.allocations.filter(a => a.participates).length > 0 && (
          <Col span={24}>
            <div className="glass-card" style={{ padding: 32 }}>
              <Title heading={4} className="ink-heading" style={{ marginBottom: 16 }}>
                分摊计算明细
              </Title>
              <Table
                pagination={false}
                size="small"
                columns={[
                  { title: '零件号', dataIndex: 'harnessId', width: 120, render: (v: string) => <Text strong>{v}</Text> },
                  { title: '名称', dataIndex: 'harnessName', width: 160 },
                  { title: '装车比', dataIndex: 'vehicleRatio', width: 80, align: 'center' as const, render: (v: number) => `${(v * 100).toFixed(1)}%` },
                  { title: '工装/根', dataIndex: 'toolingPerUnit', width: 100, align: 'right' as const, render: (v: number) => <span className="ledger-number">¥{v.toFixed(4)}</span> },
                  { title: '试验/根', dataIndex: 'testingPerUnit', width: 100, align: 'right' as const, render: (v: number) => <span className="ledger-number">¥{v.toFixed(4)}</span> },
                  { title: '研发/根', dataIndex: 'rndPerUnit', width: 100, align: 'right' as const, render: (v: number) => <span className="ledger-number">¥{v.toFixed(4)}</span> },
                  { title: '合计/根', dataIndex: 'totalPerUnit', width: 110, align: 'right' as const, render: (v: number) => <span className="ledger-number" style={{ fontWeight: 700, color: '#2563eb' }}>¥{v.toFixed(4)}</span> },
                  { title: '总费用', dataIndex: 'totalOnetimeCost', width: 120, align: 'right' as const, render: (v: number) => <span className="ledger-number">¥{v.toLocaleString()}</span> },
                ]}
                dataSource={summary.allocations.filter(a => a.participates)}
                rowKey="harnessId"
              />
            </div>
          </Col>
        )}

        {/* 回收进度时间轴 */}
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

        {/* 回收进度条 */}
        {recoverySummary && recoverySummary.trackers.filter(t => t.totalOnetimeCost > 0).length > 0 && (
          <Col span={24}>
            <div className="glass-card" style={{ padding: 32 }}>
              <Title heading={4} className="ink-heading" style={{ marginBottom: 16 }}>
                当前回收进度
              </Title>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {recoverySummary.trackers
                  .filter(t => t.totalOnetimeCost > 0)
                  .map(tracker => (
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
                        const s = RECOVERY_STATUS_MAP[tracker.status];
                        return s ? <Tag color={s.color as any} size="small">{s.label}</Tag> : null;
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
