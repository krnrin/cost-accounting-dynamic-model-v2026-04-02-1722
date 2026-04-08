import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Typography, Spin, Empty, Space, Toast, Row, Col, RadioGroup, Radio, Tag, Progress } from '@douyinfe/semi-ui';
import { IconUpload, IconDownload } from '@douyinfe/semi-icons';
import ReactECharts from 'echarts-for-react/lib/core';
import echarts from '@/lib/echarts';

import { db } from '@/data/db';
import type { ProjectRecord, ScenarioRecord } from '@/data/db';
import {
  computeHarnessCost,
  computeProjectFromHarnesses,
  computeInternalHarnessCost,
  computeInternalProjectFromHarnesses,
  INTERNAL_DEFAULTS
} from '@/engine/harness_costing';
import { exportInternalCostExcel } from '@/engine/excel_export';
import { computeSensitivityMatrix } from '@/engine/metal_escalation';
import type { HarnessResult, ProjectHarnessResult, InternalHarnessResult, InternalProjectResult } from '@/types/harness';
import { useProjectStore } from '@/store/projectStore';
import { useAllocStore } from '@/store/allocStore';
import { MultiImportDialog } from '@/components/MultiImportDialog';
import ScenarioSelector from '@/components/ScenarioSelector';

const { Title, Text } = Typography;

export default function DashboardPage() {
  const { id, sid } = useParams<{ id: string; sid: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [scenario, setScenario] = useState<ScenarioRecord | null>(null);
  const [harnesses, setHarnesses] = useState<ProjectHarnessResult | null>(null);

  const [internalProject, setInternalProject] = useState<InternalProjectResult | null>(null);
  const [internalHarnesses, setInternalHarnesses] = useState<InternalHarnessResult[]>([]);
  const [mode, setMode] = useState<'customer' | 'internal'>('internal');
  const [showMultiImport, setShowMultiImport] = useState(false);
  const [showMohDetail, setShowMohDetail] = useState(false);

  const { setCurrentProject, setCurrentScenario } = useProjectStore();
  const { allocSummary, recoverySummary, loadProjectAlloc, loadScenarioAlloc } = useAllocStore();

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const p = await db.projects.get(id);
      if (p) {
        setProject(p);
        setCurrentProject(p.id, p.meta?.projectName || p.id);

        // 加载场景
        const sc = sid ? await db.scenarios.get(sid) : null;
        setScenario(sc ?? null);
        if (sc) {
          setCurrentScenario(sc.id, sc.scenarioName);
        }

        // 线束查询：优先按 scenarioId，回退到 projectId
        const hRecords = sid
          ? await db.harnesses.where('scenarioId').equals(sid).toArray()
          : await db.harnesses.where('projectId').equals(id).toArray();

        const rates = sc!.config.costRates;
        const metalPrices = sc!.config.metalPrices;
        const internalRates = sc!.config.internalRates || INTERNAL_DEFAULTS;

        // 1. 每条线束客户报价
        const harnessResults: HarnessResult[] = hRecords.map(rec =>
          computeHarnessCost(rec.input, rates, metalPrices)
        );
        const projectResult = computeProjectFromHarnesses(harnessResults);
        setHarnesses(projectResult);

        // 2. 每条线束内部实绩
        const internalResults: InternalHarnessResult[] = hRecords.map(rec =>
          computeInternalHarnessCost(rec.input, internalRates, metalPrices)
        );
        const intProjectResult = computeInternalProjectFromHarnesses(internalResults);
        setInternalProject(intProjectResult);
        setInternalHarnesses(intProjectResult.harnesses);

        // 3. 分摊数据
        if (sid) {
          await loadScenarioAlloc(sid);
        } else {
          await loadProjectAlloc(id);
        }
      }
    } catch (err) {
      console.error('Dashboard loadData error:', err);
      Toast.error('加载项目失败: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  }, [id, sid, setCurrentProject, setCurrentScenario, loadProjectAlloc, loadScenarioAlloc]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const summary = harnesses;
  const internalSummary = internalProject;

  // ═══════════════════════════════════════════
  // 计算派生指标
  // ═══════════════════════════════════════════
  const customerVehicleCost = summary?.vehicleCost || 0;
  const internalVehicleCost = internalSummary?.vehicleCost || 0;

  // 内部毛利率 = (客户报价 - 内部实绩) / 客户报价
  const grossMargin = customerVehicleCost > 0
    ? ((customerVehicleCost - internalVehicleCost) / customerVehicleCost) * 100
    : 0;

  // 单车成本（含分摊）
  const allocPerVehicle = allocSummary?.weightedAllocPerVehicle || 0;
  const costWithAlloc = customerVehicleCost + allocPerVehicle;

  const vehicleCost = mode === 'internal' ? internalVehicleCost : customerVehicleCost;
  const harnessCount = summary?.harnessCount || 0;
  const totalHours = summary?.totalProcessHours || 0;

  // ═══════════════════════════════════════════
  // 生命周期损益表数据
  // ═══════════════════════════════════════════
  const lifecyclePnL = useMemo(() => {
    if (!project || !scenario || !summary || !internalProject) return null;
    const volumes = (scenario.config.volumes || []).map(v => v.volume);
    const years = volumes.length;
    if (!years) return null;

    const unitRevenue = summary.vehicleCost;        // 单车收入（中标价加权）
    const unitCost = internalProject.vehicleCost;    // 单车内部成本
    const rebate = scenario.config.rebate;
    const allocUnit = allocSummary?.weightedAllocPerVehicle || 0;

    const rows: {
      year: number; volume: number;
      revenue: number; cost: number; allocRecovery: number;
      rebateAmount: number; grossProfit: number; netProfit: number; netMargin: number;
    }[] = [];

    let cumVolume = 0;
    let totalRevenue = 0, totalCost = 0, totalAlloc = 0, totalRebate = 0;

    for (let i = 0; i < years; i++) {
      const vol = volumes[i] || 0;
      cumVolume += vol;
      const rev = unitRevenue * vol;
      const cost = unitCost * vol;
      const alloc = allocUnit * vol;
      const reb = rebate?.yearDistribution?.[i] || 0;
      const gross = rev - cost;
      const net = gross - reb - alloc;
      const margin = rev > 0 ? (net / rev) * 100 : 0;

      totalRevenue += rev;
      totalCost += cost;
      totalAlloc += alloc;
      totalRebate += reb;

      rows.push({
        year: i + 1, volume: vol,
        revenue: rev, cost, allocRecovery: alloc,
        rebateAmount: reb, grossProfit: gross, netProfit: net, netMargin: margin,
      });
    }

    const totalGross = totalRevenue - totalCost;
    const totalNet = totalGross - totalRebate - totalAlloc;
    const totalMargin = totalRevenue > 0 ? (totalNet / totalRevenue) * 100 : 0;
    const totalVolume = volumes.reduce((s, v) => s + v, 0);

    return {
      rows, unitRevenue, unitCost, allocUnit,
      total: {
        volume: totalVolume, revenue: totalRevenue, cost: totalCost,
        allocRecovery: totalAlloc, rebateAmount: totalRebate,
        grossProfit: totalGross, netProfit: totalNet, netMargin: totalMargin,
      },
      rebateLabel: rebate?.label || '返点',
      hasRebate: (rebate?.totalAmount || 0) > 0,
    };
  }, [project, scenario, summary, internalProject, allocSummary]);

  // ═══════════════════════════════════════════
  // 成本桥瀑布图
  // ═══════════════════════════════════════════
  const waterfallChart = useMemo(() => {
    if (!summary) return {};
    const items = [
      { name: '材料', value: summary.weightedMaterial },
      { name: '废品', value: summary.weightedWaste },
      { name: '人工', value: summary.weightedLabor },
      { name: '制造费', value: summary.weightedMfg },
      { name: '管理费', value: summary.weightedMgmtFee },
      { name: '利润', value: summary.weightedProfit },
      { name: '包装运输', value: summary.weightedPack + summary.weightedFreight },
    ];

    // For waterfall: each bar sits on top of previous cumulative
    let cumulative = 0;
    const placeholders: number[] = [];
    const values: number[] = [];
    for (const item of items) {
      placeholders.push(cumulative);
      values.push(+item.value.toFixed(2));
      cumulative += item.value;
    }
    // Final total bar
    placeholders.push(0);
    values.push(+cumulative.toFixed(2));

    return {
      tooltip: {
        trigger: 'axis' as const,
        formatter: (params: any) => {
          const idx: number = params[1]?.dataIndex ?? params[0]?.dataIndex ?? 0;
          const val = values[idx] ?? 0;
          if (idx === items.length) {
            return `单车成本: ¥${val.toFixed(2)}`;
          }
          const item = items[idx];
          return item ? `${item.name}: ¥${val.toFixed(2)}` : `¥${val.toFixed(2)}`;
        },
      },
      grid: { top: 20, bottom: 40, left: 60, right: 20 },
      xAxis: {
        type: 'category' as const,
        data: [...items.map(i => i.name), '单车成本'],
        axisLabel: { fontSize: 11 },
      },
      yAxis: { type: 'value' as const, name: '元' },
      series: [
        {
          name: 'placeholder',
          type: 'bar' as const,
          stack: 'waterfall',
          itemStyle: { color: 'transparent' },
          data: placeholders,
        },
        {
          name: 'value',
          type: 'bar' as const,
          stack: 'waterfall',
          data: values.map((v, i) => ({
            value: v,
            itemStyle: {
              color: i === items.length
                ? '#2563eb'
                : ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#6b7280'][i],
            },
          })),
          label: {
            show: true,
            position: 'top' as const,
            formatter: (p: any) => `¥${p.value.toFixed(1)}`,
            fontSize: 10,
            color: '#333',
          },
        },
      ],
    };
  }, [summary]);

  // ═══════════════════════════════════════════
  // 线束利润对比柱状图
  // ═══════════════════════════════════════════
  const profitCompareChart = useMemo(() => {
    if (!summary || !internalSummary) return {};
    const labels = (summary.harnesses || []).map(h => h.harnessId.slice(-4));
    const customerPrices = (summary.harnesses || []).map(h => +h.deliveredPrice.toFixed(2));
    const internalCosts = internalHarnesses.map(h => +h.internalCost.toFixed(2));
    const margins = customerPrices.map((c, i) => +(c - (internalCosts[i] ?? 0)).toFixed(2));

    return {
      tooltip: { trigger: 'axis' as const },
      legend: { data: ['客户到厂价', '内部实绩', '毛利额'], bottom: 0 },
      grid: { top: 20, bottom: 60, left: 60, right: 20 },
      xAxis: {
        type: 'category' as const,
        data: labels,
        axisLabel: { fontSize: 11 },
      },
      yAxis: { type: 'value' as const, name: '元/根' },
      series: [
        {
          name: '客户到厂价',
          type: 'bar' as const,
          data: customerPrices,
          itemStyle: { color: '#3b82f6' },
        },
        {
          name: '内部实绩',
          type: 'bar' as const,
          data: internalCosts,
          itemStyle: { color: '#f59e0b' },
        },
        {
          name: '毛利额',
          type: 'bar' as const,
          data: margins,
          itemStyle: {
            color: (params: any) => params.value >= 0 ? '#16a34a' : '#dc2626',
          },
        },
      ],
    };
  }, [summary, internalSummary, internalHarnesses]);

  // ═══════════════════════════════════════════
  // 成本构成堆叠柱图
  // ═══════════════════════════════════════════
  const costBreakdownChart = useMemo(() => {
    if (!summary) return {};
    return {
      tooltip: { trigger: 'axis' as const },
      legend: { data: ['材料', '人工', '制造费', '管理费', '利润', '包装运输'], bottom: 0 },
      grid: { top: 20, bottom: 60, left: 60, right: 20 },
      xAxis: { type: 'category' as const, data: (summary.harnesses || []).map(h => h.harnessId.slice(-4)), axisLabel: { rotate: 0, fontSize: 11 } },
      yAxis: { type: 'value' as const, name: '元' },
      series: [
        { name: '材料', type: 'bar' as const, stack: 'cost', data: (summary.harnesses || []).map(h => +h.materialCost.toFixed(2)), itemStyle: { color: '#3b82f6' } },
        { name: '人工', type: 'bar' as const, stack: 'cost', data: (summary.harnesses || []).map(h => +h.directLabor.toFixed(2)), itemStyle: { color: '#f59e0b' } },
        { name: '制造费', type: 'bar' as const, stack: 'cost', data: (summary.harnesses || []).map(h => +h.manufacturing.toFixed(2)), itemStyle: { color: '#10b981' } },
        { name: '管理费', type: 'bar' as const, stack: 'cost', data: (summary.harnesses || []).map(h => +h.mgmtFee.toFixed(2)), itemStyle: { color: '#8b5cf6' } },
        { name: '利润', type: 'bar' as const, stack: 'cost', data: (summary.harnesses || []).map(h => +h.profit.toFixed(2)), itemStyle: { color: '#ec4899' } },
        { name: '包装运输', type: 'bar' as const, stack: 'cost', data: (summary.harnesses || []).map(h => +(h.packSubtotal + h.freightSubtotal).toFixed(2)), itemStyle: { color: '#6b7280' } },
      ]
    };
  }, [summary]);

  // ═══════════════════════════════════════════
  // 金属敏感性热力图
  // ═══════════════════════════════════════════
  const metalSensitivityChart = useMemo(() => {
    if (!summary || !scenario) return {};
    const baseMetal = scenario.config.metalPrices;
    const baseCu = baseMetal.copper;
    const baseAl = baseMetal.aluminum;
    const cuRange = [-20, -10, 0, 10, 20].map(p => Math.round(baseCu * (1 + p / 100)));
    const alRange = [-20, -10, 0, 10, 20].map(p => Math.round(baseAl * (1 + p / 100)));

    const harnessResults: HarnessResult[] = summary.harnesses || [];
    const matrix = computeSensitivityMatrix(harnessResults, baseMetal, cuRange, alRange);

    const data: [number, number, number][] = [];
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < matrix.matrix.length; i++) {
      const row = matrix.matrix[i];
      if (!row) continue;
      for (let j = 0; j < row.length; j++) {
        const cell = row[j];
        if (!cell) continue;
        const val = +cell.deltaPerVehicle.toFixed(2);
        data.push([i, j, val]);
        if (val < min) min = val;
        if (val > max) max = val;
      }
    }

    return {
      tooltip: {
        formatter: (p: any) => {
          const [ci, ai, val] = p.data;
          const cuLabel = cuRange[ci]?.toLocaleString() ?? '';
          const alLabel = alRange[ai]?.toLocaleString() ?? '';
          return `铜 ${cuLabel} · 铝 ${alLabel}<br/>单车变动: <b>¥${val >= 0 ? '+' : ''}${val.toFixed(2)}</b>`;
        },
      },
      grid: { top: 10, bottom: 50, left: 80, right: 60 },
      xAxis: {
        type: 'category' as const,
        data: cuRange.map(v => `${((v / baseCu - 1) * 100).toFixed(0)}%`),
        name: '铜价变动',
        nameLocation: 'center' as const,
        nameGap: 30,
      },
      yAxis: {
        type: 'category' as const,
        data: alRange.map(v => `${((v / baseAl - 1) * 100).toFixed(0)}%`),
        name: '铝价变动',
      },
      visualMap: {
        min: Math.min(min, -1),
        max: Math.max(max, 1),
        calculable: true,
        orient: 'vertical' as const,
        right: 0,
        top: 'center',
        inRange: { color: ['#16a34a', '#fafafa', '#dc2626'] },
        formatter: (v: number) => `¥${v.toFixed(1)}`,
      },
      series: [{
        type: 'heatmap' as const,
        data,
        label: { show: true, formatter: (p: any) => `${p.data[2] >= 0 ? '+' : ''}${p.data[2].toFixed(1)}`, fontSize: 10 },
      }],
    };
  }, [summary, scenario]);

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><Spin size="large" /></div>;
  if (!project) return <Empty description="未找到项目" />;

  // 线束利润明细表数据
  const harnessTableData = (summary?.harnesses || []).map((h, i) => {
    const ih = internalHarnesses.find(x => x.harnessId === h.harnessId);
    const allocItem = allocSummary?.allocations?.find(a => a.harnessId === h.harnessId);
    const allocPerUnit = allocItem?.totalPerUnit || 0;
    const intCost = ih?.internalCost || 0;
    const netProfit = h.deliveredPrice - intCost - allocPerUnit;
    const margin = h.deliveredPrice > 0 ? (netProfit / h.deliveredPrice) * 100 : 0;
    const vehicleContrib = netProfit * h.vehicleRatio;

    // 成本占比诊断
    const matRatio = intCost > 0 ? (ih?.materialCost || 0) / intCost : 0;
    const laborRatio = intCost > 0 ? (ih?.directLabor || 0) / intCost : 0;
    const fixedRatio = intCost > 0 ? ((ih?.factoryAmortization || 0) + (ih?.automationAmortization || 0)) / intCost : 0;
    const tags: string[] = [];
    if (matRatio > 0.7) tags.push('材料敏感');
    if (laborRatio > 0.2) tags.push('工时偏高');
    if (fixedRatio > 0.15) tags.push('固定成本重');
    if (netProfit < 0) tags.push('亏损');

    return {
      key: String(i),
      harnessId: h.harnessId,
      name: h.harnessName,
      ratio: h.vehicleRatio,
      delivered: h.deliveredPrice,
      material: ih?.materialCost || 0,
      directLabor: ih?.directLabor || 0,
      mfgTotal: ih?.mfgOverheadTotal || 0,
      indirectLabor: ih?.indirectLabor || 0,
      lowValue: ih?.lowValueConsumables || 0,
      matConsumption: ih?.materialConsumption || 0,
      factoryAmort: ih?.factoryAmortization || 0,
      autoAmort: ih?.automationAmortization || 0,
      otherOH: ih?.otherOverhead || 0,
      materialWaste: ih?.materialWaste || 0,
      packTotal: ih?.packTotal || 0,
      internalCost: intCost,
      allocPerUnit,
      netProfit,
      margin,
      vehicleContrib,
      tags,
      matRatio, laborRatio,
    };
  });

  // 分摊回收简化进度（从 allocSummary）
  const allocRecoveryItems = allocSummary?.allocations?.filter(a => a.participates) || [];

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', paddingBottom: 64 }}>
      <ScenarioSelector />
      <Row gutter={[16, 16]}>

        {/* ──── 第一行：项目信息 + 核心KPI ──── */}
        <Col span={8}>
          <div className="glass-card" style={{ padding: 32, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <Title heading={3} className="ink-heading" style={{ margin: 0, fontSize: 24 }}>
              {project.meta?.projectName || project.id}
            </Title>
            <Text type="secondary" style={{ fontSize: 13, marginTop: 6 }}>
              {project.meta?.customer} · {project.meta?.platform} · {harnessCount} 件
            </Text>
            <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
              <Tag color="blue">{project.meta?.status === 'quoted' ? '已报价' : project.meta?.status}</Tag>
              <Tag>生命周期 {scenario?.lifecycleYears || '-'} 年</Tag>
              <Tag color="green">总工时 {totalHours.toFixed(2)}h</Tag>
            </div>
            {/* 快捷入口 */}
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              {[
                { label: 'BOM', path: `/project/${id}/s/${sid}/bom-workbook` },
                { label: '报价', path: `/project/${id}/s/${sid}/quote` },
                { label: '价格', path: `/project/${id}/s/${sid}/annual-drop` },
                { label: '分摊', path: `/project/${id}/s/${sid}/alloc` },
                { label: '变更', path: `/project/${id}/s/${sid}/change-engine` },
                { label: '模拟', path: `/project/${id}/s/${sid}/simulation` },
                { label: '跟踪', path: `/project/${id}/s/${sid}/tracking` },
                { label: '预警', path: `/alerts` },
              ].map(btn => (
                <div
                  key={btn.path}
                  onClick={() => navigate(btn.path)}
                  style={{
                    padding: '4px 14px', borderRadius: 8, cursor: 'pointer',
                    background: 'rgba(37,99,235,0.08)', color: 'var(--accent)', fontSize: 12, fontWeight: 600,
                    transition: '0.2s',
                  }}
                >
                  {btn.label} →
                </div>
              ))}
            </div>
          </div>
        </Col>

        {/* 单车成本 KPI */}
        <Col span={4}>
          <div className="glass-card" style={{ padding: 20, height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Text style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-muted)' }}>单车成本</Text>
              <RadioGroup type="button" buttonSize="small" value={mode} onChange={(e) => setMode(e.target.value)}>
                <Radio value="customer">客户</Radio>
                <Radio value="internal">内部</Radio>
              </RadioGroup>
            </div>
            <div className="ledger-number" style={{ fontSize: 28, marginTop: 8 }}>
              ¥{vehicleCost?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '--'}
            </div>
          </div>
        </Col>

        {/* 毛利率 KPI */}
        <Col span={4}>
          <div className="glass-card" style={{ padding: 20, height: '100%' }}>
            <Text style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-muted)' }}>内部毛利率</Text>
            <div className="ledger-number" style={{
              fontSize: 28, marginTop: 8,
              color: grossMargin >= 15 ? 'var(--success)' : grossMargin >= 5 ? 'var(--warning)' : 'var(--danger)'
            }}>
              {grossMargin.toFixed(1)}%
            </div>
            <Text style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
              差额 ¥{(customerVehicleCost - internalVehicleCost).toFixed(2)}/车
            </Text>
          </div>
        </Col>

        {/* 含分摊单车成本 */}
        <Col span={4}>
          <div className="glass-card" style={{ padding: 20, height: '100%' }}>
            <Text style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-muted)' }}>含分摊单车</Text>
            <div className="ledger-number" style={{ fontSize: 28, marginTop: 8, color: 'var(--accent)' }}>
              ¥{costWithAlloc.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <Text style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
              分摊 +¥{allocPerVehicle.toFixed(2)}/车
            </Text>
          </div>
        </Col>

        {/* 一次性费用 KPI */}
        <Col span={4}>
          <div className="glass-card" style={{ padding: 20, height: '100%' }}>
            <Text style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-muted)' }}>一次性费用</Text>
            <div className="ledger-number" style={{ fontSize: 28, marginTop: 8 }}>
              ¥{(allocSummary?.grandTotal || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <Text style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
              工装 {(allocSummary?.totalTooling || 0).toLocaleString()} · 试验 {(allocSummary?.totalTesting || 0).toLocaleString()}
            </Text>
          </div>
        </Col>

        {/* 分摊回收进度 KPI */}
        <Col span={24}>
          <Row gutter={16}>
            <Col span={6}>
              <div className="glass-card" style={{ padding: 20 }}>
                <Text style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-muted)' }}>分摊回收进度</Text>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
                  <Progress
                    percent={Math.round((recoverySummary?.overallRecoveryProgress ?? 0) * 100)}
                    type="circle"
                    width={56}
                    strokeWidth={6}
                    stroke={(recoverySummary?.overallRecoveryProgress ?? 0) >= 1 ? 'var(--success)' : 'var(--accent)'}
                  />
                  <div>
                    <div className="ledger-number" style={{ fontSize: 22, fontWeight: 700 }}>
                      {((recoverySummary?.overallRecoveryProgress ?? 0) * 100).toFixed(1)}%
                    </div>
                    <Text style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      已回收 {recoverySummary?.fullyRecoveredCount ?? 0} / {recoverySummary?.trackers?.filter(t => t.totalOnetimeCost > 0).length ?? 0}
                    </Text>
                  </div>
                </div>
              </div>
            </Col>
            <Col span={6}>
              <div className="glass-card" style={{ padding: 20 }}>
                <Text style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-muted)' }}>已回收金额</Text>
                <div className="ledger-number" style={{ fontSize: 22, marginTop: 8, color: 'var(--success)' }}>
                  ¥{(recoverySummary?.totalRecovered ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              </div>
            </Col>
            <Col span={6}>
              <div className="glass-card" style={{ padding: 20 }}>
                <Text style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-muted)' }}>待回收金额</Text>
                <div className="ledger-number" style={{ fontSize: 22, marginTop: 8, color: 'var(--danger)' }}>
                  ¥{(recoverySummary?.totalRemaining ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              </div>
            </Col>
            <Col span={6}>
              <div className="glass-card" style={{ padding: 20 }}>
                <Text style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-muted)' }}>调价提醒</Text>
                <div className="ledger-number" style={{ fontSize: 22, marginTop: 8, color: (recoverySummary?.priceAdjustmentAlerts?.length ?? 0) > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>
                  {recoverySummary?.priceAdjustmentAlerts?.length ?? 0} 条
                </div>
              </div>
            </Col>
          </Row>
        </Col>

        {/* ──── 第二行：成本桥瀑布图 + 利润对比 ──── */}
        <Col span={12}>
          <div className="glass-card" style={{ padding: 24 }}>
            <Title heading={5} className="ink-heading" style={{ margin: 0, marginBottom: 12 }}>
              成本桥 (单车加权)
            </Title>
            <div style={{ height: 300 }}>
              <ReactECharts echarts={echarts} option={waterfallChart} style={{ height: '100%' }} />
            </div>
          </div>
        </Col>

        <Col span={12}>
          <div className="glass-card" style={{ padding: 24 }}>
            <Title heading={5} className="ink-heading" style={{ margin: 0, marginBottom: 12 }}>
              线束利润对比 (客户报价 vs 内部实绩)
            </Title>
            <div style={{ height: 300 }}>
              <ReactECharts echarts={echarts} option={profitCompareChart} style={{ height: '100%' }} />
            </div>
          </div>
        </Col>

        {/* ──── 第三行：成本构成堆叠图 + 金属敏感性热力图 ──── */}
        <Col span={14}>
          <div className="glass-card" style={{ padding: 24 }}>
            <Title heading={5} className="ink-heading" style={{ margin: 0, marginBottom: 12 }}>
              线束成本构成分析
            </Title>
            <div style={{ height: 300 }}>
              <ReactECharts echarts={echarts} option={costBreakdownChart} style={{ height: '100%' }} />
            </div>
          </div>
        </Col>

        <Col span={10}>
          <div className="glass-card" style={{ padding: 24, height: '100%' }}>
            <Title heading={5} className="ink-heading" style={{ margin: 0, marginBottom: 12 }}>
              金属价格敏感性 (单车变动)
            </Title>
            <div style={{ height: 300 }}>
              <ReactECharts echarts={echarts} option={metalSensitivityChart} style={{ height: '100%' }} />
            </div>
          </div>
        </Col>

        {/* ──── 第四行：分摊回收进度 ──── */}
        <Col span={24}>
          <div className="glass-card" style={{ padding: 24, height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Title heading={5} className="ink-heading" style={{ margin: 0 }}>
                分摊回收进度
              </Title>
              <Text
                style={{ color: 'var(--accent)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                onClick={() => navigate(`/project/${id}/s/${sid}/alloc`)}
              >
                查看明细 →
              </Text>
            </div>
            {allocRecoveryItems.length === 0 ? (
              <Empty description="暂无分摊数据" style={{ marginTop: 40 }} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflow: 'auto', maxHeight: 280 }}>
                {allocRecoveryItems.map(alloc => {
                  const tracker = recoverySummary?.trackers?.find(t => t.harnessId === alloc.harnessId);
                  const percent = tracker ? Math.round(tracker.recoveryProgress * 100) : 0;
                  return (
                  <div key={alloc.harnessId} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Text style={{ fontSize: 12, fontWeight: 600, width: 50, flexShrink: 0, fontFamily: 'JetBrains Mono, Consolas, monospace' }}>
                      …{alloc.harnessId.slice(-4)}
                    </Text>
                    <div style={{ flex: 1 }}>
                      <Progress
                        percent={percent}
                        size="small"
                        style={{ marginBottom: 0 }}
                        stroke={tracker?.status === 'overdue' ? 'var(--danger)' : percent >= 100 ? 'var(--success)' : 'var(--accent)'}
                      />
                    </div>
                    {tracker?.status === 'overdue' && (
                      <Tag color="red" size="small" style={{ flexShrink: 0 }}>超期</Tag>
                    )}
                    <Text className="ledger-number" style={{ fontSize: 12, width: 55, textAlign: 'right', flexShrink: 0 }}>
                      ¥{alloc.totalPerUnit.toFixed(2)}
                    </Text>
                  </div>
                  );
                })}
                <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 8, marginTop: 4 }}>
                  <Text style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    参与 {allocSummary?.participatingCount || 0} / 不参与 {allocSummary?.nonParticipatingCount || 0}
                    　·　加权分摊 ¥{allocPerVehicle.toFixed(4)}/车
                  </Text>
                </div>
              </div>
            )}
          </div>
        </Col>

        {/* ──── 第4.5行：生命周期损益表 ──── */}
        {lifecyclePnL && (
          <Col span={24}>
            <div className="glass-card" style={{ padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Title heading={5} className="ink-heading" style={{ margin: 0 }}>
                  项目生命周期损益
                </Title>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <Text style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    单车收入 ¥{lifecyclePnL.unitRevenue.toFixed(2)} · 单车成本 ¥{lifecyclePnL.unitCost.toFixed(2)}
                    · 分摊 ¥{lifecyclePnL.allocUnit.toFixed(4)}/车
                  </Text>
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'JetBrains Mono, Consolas, monospace' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid rgba(37,99,235,0.2)' }}>
                      <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11 }}>项目</th>
                      {lifecyclePnL.rows.map(r => (
                        <th key={r.year} style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11, minWidth: 110 }}>
                          第{r.year}年
                        </th>
                      ))}
                      <th style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 700, color: 'var(--accent)', fontSize: 11, minWidth: 120 }}>生命周期合计</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* 产量 */}
                    <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                      <td style={{ padding: '6px 10px', color: 'var(--text-muted)' }}>产量 (台)</td>
                      {lifecyclePnL.rows.map(r => (
                        <td key={r.year} style={{ textAlign: 'right', padding: '6px 10px' }}>{r.volume.toLocaleString()}</td>
                      ))}
                      <td style={{ textAlign: 'right', padding: '6px 10px', fontWeight: 700 }}>{lifecyclePnL.total.volume.toLocaleString()}</td>
                    </tr>
                    {/* 总收入 */}
                    <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                      <td style={{ padding: '6px 10px', color: 'var(--text-muted)' }}>总收入</td>
                      {lifecyclePnL.rows.map(r => (
                        <td key={r.year} style={{ textAlign: 'right', padding: '6px 10px' }}>¥{(r.revenue / 10000).toFixed(1)}万</td>
                      ))}
                      <td style={{ textAlign: 'right', padding: '6px 10px', fontWeight: 700 }}>¥{(lifecyclePnL.total.revenue / 10000).toFixed(1)}万</td>
                    </tr>
                    {/* 总成本 */}
                    <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                      <td style={{ padding: '6px 10px', color: 'var(--text-muted)' }}>总成本 (内部实绩)</td>
                      {lifecyclePnL.rows.map(r => (
                        <td key={r.year} style={{ textAlign: 'right', padding: '6px 10px' }}>¥{(r.cost / 10000).toFixed(1)}万</td>
                      ))}
                      <td style={{ textAlign: 'right', padding: '6px 10px', fontWeight: 700 }}>¥{(lifecyclePnL.total.cost / 10000).toFixed(1)}万</td>
                    </tr>
                    {/* 一次性费用分摊 */}
                    <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                      <td style={{ padding: '6px 10px', color: 'var(--text-muted)' }}>一次性费用分摊</td>
                      {lifecyclePnL.rows.map(r => (
                        <td key={r.year} style={{ textAlign: 'right', padding: '6px 10px' }}>¥{(r.allocRecovery / 10000).toFixed(1)}万</td>
                      ))}
                      <td style={{ textAlign: 'right', padding: '6px 10px', fontWeight: 700 }}>¥{(lifecyclePnL.total.allocRecovery / 10000).toFixed(1)}万</td>
                    </tr>
                    {/* 返点 */}
                    {lifecyclePnL.hasRebate && (
                      <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.04)', background: 'rgba(220,38,38,0.03)' }}>
                        <td style={{ padding: '6px 10px', color: 'var(--danger)', fontWeight: 600 }}>{lifecyclePnL.rebateLabel}</td>
                        {lifecyclePnL.rows.map(r => (
                          <td key={r.year} style={{ textAlign: 'right', padding: '6px 10px', color: r.rebateAmount > 0 ? 'var(--danger)' : undefined, fontWeight: r.rebateAmount > 0 ? 600 : 400 }}>
                            {r.rebateAmount > 0 ? `¥${(r.rebateAmount / 10000).toFixed(0)}万` : '—'}
                          </td>
                        ))}
                        <td style={{ textAlign: 'right', padding: '6px 10px', fontWeight: 700, color: 'var(--danger)' }}>
                          ¥{(lifecyclePnL.total.rebateAmount / 10000).toFixed(0)}万
                        </td>
                      </tr>
                    )}
                    {/* 毛利 */}
                    <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                      <td style={{ padding: '6px 10px', color: 'var(--text-muted)' }}>毛利 (扣返点前)</td>
                      {lifecyclePnL.rows.map(r => (
                        <td key={r.year} style={{ textAlign: 'right', padding: '6px 10px', color: r.grossProfit < 0 ? 'var(--danger)' : 'var(--success)' }}>
                          ¥{(r.grossProfit / 10000).toFixed(1)}万
                        </td>
                      ))}
                      <td style={{ textAlign: 'right', padding: '6px 10px', fontWeight: 700, color: lifecyclePnL.total.grossProfit < 0 ? 'var(--danger)' : 'var(--success)' }}>
                        ¥{(lifecyclePnL.total.grossProfit / 10000).toFixed(1)}万
                      </td>
                    </tr>
                    {/* 净利润 */}
                    <tr style={{ borderBottom: '2px solid rgba(37,99,235,0.2)', background: 'rgba(37,99,235,0.02)' }}>
                      <td style={{ padding: '8px 10px', fontWeight: 700 }}>净利润</td>
                      {lifecyclePnL.rows.map(r => (
                        <td key={r.year} style={{
                          textAlign: 'right', padding: '8px 10px', fontWeight: 700,
                          color: r.netProfit < 0 ? 'var(--danger)' : 'var(--success)',
                          background: r.netProfit < 0 ? 'rgba(220,38,38,0.06)' : undefined,
                        }}>
                          ¥{(r.netProfit / 10000).toFixed(1)}万
                        </td>
                      ))}
                      <td style={{
                        textAlign: 'right', padding: '8px 10px', fontWeight: 700,
                        color: lifecyclePnL.total.netProfit < 0 ? 'var(--danger)' : 'var(--success)',
                      }}>
                        ¥{(lifecyclePnL.total.netProfit / 10000).toFixed(1)}万
                      </td>
                    </tr>
                    {/* 净利润率 */}
                    <tr>
                      <td style={{ padding: '6px 10px', color: 'var(--text-muted)' }}>净利润率</td>
                      {lifecyclePnL.rows.map(r => (
                        <td key={r.year} style={{
                          textAlign: 'right', padding: '6px 10px', fontWeight: 600,
                          color: r.netMargin < 0 ? 'var(--danger)' : r.netMargin < 5 ? 'var(--warning)' : 'var(--success)',
                        }}>
                          {r.netMargin.toFixed(1)}%
                        </td>
                      ))}
                      <td style={{
                        textAlign: 'right', padding: '6px 10px', fontWeight: 700,
                        color: lifecyclePnL.total.netMargin < 0 ? 'var(--danger)' : lifecyclePnL.total.netMargin < 5 ? 'var(--warning)' : 'var(--success)',
                      }}>
                        {lifecyclePnL.total.netMargin.toFixed(1)}%
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </Col>
        )}

        {/* ──── 第五行：线束利润明细表 ──── */}
        <Col span={24}>
          <div className="glass-card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Title heading={5} className="ink-heading" style={{ margin: 0 }}>
                线束利润明细 (内部实绩)
              </Title>
              <Space>
                <div
                  onClick={() => setShowMohDetail(!showMohDetail)}
                  style={{ padding: '6px 14px', borderRadius: 8, cursor: 'pointer', background: showMohDetail ? 'rgba(37,99,235,0.15)' : 'rgba(0,0,0,0.04)', color: showMohDetail ? 'var(--accent)' : undefined, fontSize: 12, fontWeight: 600 }}
                >
                  {showMohDetail ? '收起制造费明细 ↑' : '展开制造费明细 ↓'}
                </div>
                <div
                  onClick={() => setShowMultiImport(true)}
                  style={{ padding: '6px 14px', borderRadius: 8, cursor: 'pointer', background: 'rgba(0,0,0,0.04)', fontSize: 12, fontWeight: 600 }}
                >
                  <IconUpload style={{ marginRight: 4 }} />批量导入
                </div>
                <div
                  onClick={() => project && summary && exportInternalCostExcel(summary.harnesses, summary, project.meta?.projectName || 'export')}
                  style={{ padding: '6px 14px', borderRadius: 8, cursor: 'pointer', background: 'rgba(37,99,235,0.08)', color: 'var(--accent)', fontSize: 12, fontWeight: 600 }}
                >
                  <IconDownload style={{ marginRight: 4 }} />导出 Excel
                </div>
              </Space>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'JetBrains Mono, Consolas, monospace' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid rgba(37,99,235,0.2)' }}>
                    <th style={{ textAlign: 'left', padding: '8px 6px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11, position: 'sticky', left: 0, background: 'var(--bg-card, #fff)', zIndex: 1, minWidth: 100 }}>零件号</th>
                    <th style={{ textAlign: 'left', padding: '8px 6px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11, minWidth: 90 }}>名称</th>
                    <th style={{ textAlign: 'center', padding: '8px 6px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11, minWidth: 50 }}>装车比</th>
                    <th style={{ textAlign: 'right', padding: '8px 6px', fontWeight: 600, color: 'var(--accent)', fontSize: 11, minWidth: 80 }}>到厂价</th>
                    <th style={{ textAlign: 'right', padding: '8px 6px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11, minWidth: 70 }}>材料</th>
                    <th style={{ textAlign: 'right', padding: '8px 6px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11, minWidth: 70 }}>直接人工</th>
                    <th style={{ textAlign: 'right', padding: '8px 6px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11, minWidth: 75, cursor: 'pointer' }} onClick={() => setShowMohDetail(!showMohDetail)}>制造费合计 {showMohDetail ? '↑' : '↓'}</th>
                    {showMohDetail && <>
                      <th style={{ textAlign: 'right', padding: '8px 6px', fontWeight: 500, color: 'var(--text-muted)', fontSize: 10, minWidth: 60 }}>间接人工</th>
                      <th style={{ textAlign: 'right', padding: '8px 6px', fontWeight: 500, color: 'var(--text-muted)', fontSize: 10, minWidth: 60 }}>低值易耗</th>
                      <th style={{ textAlign: 'right', padding: '8px 6px', fontWeight: 500, color: 'var(--text-muted)', fontSize: 10, minWidth: 60 }}>机物料</th>
                      <th style={{ textAlign: 'right', padding: '8px 6px', fontWeight: 500, color: 'var(--text-muted)', fontSize: 10, minWidth: 60 }}>厂房分摊</th>
                      <th style={{ textAlign: 'right', padding: '8px 6px', fontWeight: 500, color: 'var(--text-muted)', fontSize: 10, minWidth: 65 }}>自动化分摊</th>
                      <th style={{ textAlign: 'right', padding: '8px 6px', fontWeight: 500, color: 'var(--text-muted)', fontSize: 10, minWidth: 60 }}>其他制费</th>
                    </>}
                    <th style={{ textAlign: 'right', padding: '8px 6px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11, minWidth: 60 }}>损耗</th>
                    <th style={{ textAlign: 'right', padding: '8px 6px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11, minWidth: 65 }}>包装运输</th>
                    <th style={{ textAlign: 'right', padding: '8px 6px', fontWeight: 600, color: 'var(--warning)', fontSize: 11, minWidth: 80 }}>内部成本</th>
                    <th style={{ textAlign: 'right', padding: '8px 6px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11, minWidth: 55 }}>分摊</th>
                    <th style={{ textAlign: 'right', padding: '8px 6px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11, minWidth: 70 }}>净利润</th>
                    <th style={{ textAlign: 'right', padding: '8px 6px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11, minWidth: 55 }}>利润率</th>
                    <th style={{ textAlign: 'right', padding: '8px 6px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11, minWidth: 70 }}>单车贡献</th>
                    <th style={{ textAlign: 'left', padding: '8px 6px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11, minWidth: 100 }}>诊断</th>
                  </tr>
                </thead>
                <tbody>
                  {harnessTableData.map(row => {
                    const barTotal = row.material + row.directLabor + row.mfgTotal + row.packTotal;
                    const matPct = barTotal > 0 ? (row.material / barTotal) * 100 : 0;
                    const labPct = barTotal > 0 ? (row.directLabor / barTotal) * 100 : 0;
                    const mfgPct = barTotal > 0 ? (row.mfgTotal / barTotal) * 100 : 0;
                    const packPct = barTotal > 0 ? (row.packTotal / barTotal) * 100 : 0;
                    return (
                    <tr key={row.key} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)', background: row.netProfit < 0 ? 'rgba(220,38,38,0.04)' : undefined }}>
                      <td style={{ padding: '6px 6px', position: 'sticky', left: 0, background: row.netProfit < 0 ? 'rgba(220,38,38,0.04)' : 'var(--bg-card, #fff)', zIndex: 1 }}>
                        <a onClick={() => navigate(`/project/${id}/s/${sid}/harness/${row.harnessId}`)} style={{ cursor: 'pointer', fontWeight: 600, fontSize: 11 }}>{row.harnessId}</a>
                      </td>
                      <td style={{ padding: '6px 6px', fontSize: 11 }}>{row.name}</td>
                      <td style={{ textAlign: 'center', padding: '6px 6px' }}>{(row.ratio * 100).toFixed(1)}%</td>
                      <td style={{ textAlign: 'right', padding: '6px 6px', fontWeight: 700, color: 'var(--accent)' }}>¥{row.delivered.toFixed(2)}</td>
                      <td style={{ textAlign: 'right', padding: '6px 6px' }}>¥{row.material.toFixed(2)}</td>
                      <td style={{ textAlign: 'right', padding: '6px 6px' }}>¥{row.directLabor.toFixed(2)}</td>
                      <td style={{ textAlign: 'right', padding: '6px 6px', fontWeight: 600 }}>¥{row.mfgTotal.toFixed(2)}</td>
                      {showMohDetail && <>
                        <td style={{ textAlign: 'right', padding: '6px 6px', fontSize: 11, color: 'var(--text-muted)' }}>¥{row.indirectLabor.toFixed(2)}</td>
                        <td style={{ textAlign: 'right', padding: '6px 6px', fontSize: 11, color: 'var(--text-muted)' }}>¥{row.lowValue.toFixed(2)}</td>
                        <td style={{ textAlign: 'right', padding: '6px 6px', fontSize: 11, color: 'var(--text-muted)' }}>¥{row.matConsumption.toFixed(2)}</td>
                        <td style={{ textAlign: 'right', padding: '6px 6px', fontSize: 11, color: 'var(--text-muted)' }}>¥{row.factoryAmort.toFixed(2)}</td>
                        <td style={{ textAlign: 'right', padding: '6px 6px', fontSize: 11, color: 'var(--text-muted)' }}>¥{row.autoAmort.toFixed(2)}</td>
                        <td style={{ textAlign: 'right', padding: '6px 6px', fontSize: 11, color: 'var(--text-muted)' }}>¥{row.otherOH.toFixed(2)}</td>
                      </>}
                      <td style={{ textAlign: 'right', padding: '6px 6px' }}>¥{row.materialWaste.toFixed(2)}</td>
                      <td style={{ textAlign: 'right', padding: '6px 6px' }}>¥{row.packTotal.toFixed(2)}</td>
                      <td style={{ textAlign: 'right', padding: '6px 6px' }}>
                        <span style={{ fontWeight: 700, color: 'var(--warning)' }}>¥{row.internalCost.toFixed(2)}</span>
                        <div style={{ height: 4, borderRadius: 2, marginTop: 3, display: 'flex', overflow: 'hidden' }}>
                          <div style={{ width: `${matPct}%`, background: '#3b82f6' }} />
                          <div style={{ width: `${labPct}%`, background: '#f59e0b' }} />
                          <div style={{ width: `${mfgPct}%`, background: '#10b981' }} />
                          <div style={{ width: `${packPct}%`, background: '#6b7280' }} />
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', padding: '6px 6px' }}>¥{row.allocPerUnit.toFixed(2)}</td>
                      <td style={{ textAlign: 'right', padding: '6px 6px', fontWeight: 700, color: row.netProfit < 0 ? 'var(--danger)' : 'var(--success)' }}>¥{row.netProfit.toFixed(2)}</td>
                      <td style={{ textAlign: 'right', padding: '6px 6px', fontWeight: 600, color: row.margin < 0 ? 'var(--danger)' : row.margin < 5 ? 'var(--warning)' : 'var(--success)' }}>{row.margin.toFixed(1)}%</td>
                      <td style={{ textAlign: 'right', padding: '6px 6px', fontWeight: 600 }}>¥{row.vehicleContrib.toFixed(2)}</td>
                      <td style={{ padding: '6px 6px' }}>
                        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                          {row.tags.map(t => (
                            <span key={t} style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, background: t === '亏损' ? 'rgba(220,38,38,0.1)' : 'rgba(37,99,235,0.08)', color: t === '亏损' ? 'var(--danger)' : 'var(--accent)' }}>{t}</span>
                          ))}
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                  {/* 汇总行 */}
                  <tr style={{ borderTop: '2px solid rgba(37,99,235,0.2)', background: 'rgba(37,99,235,0.02)' }}>
                    <td colSpan={3} style={{ padding: '8px 6px', fontWeight: 700 }}>单车合计</td>
                    <td style={{ textAlign: 'right', padding: '8px 6px', fontWeight: 700, color: 'var(--accent)' }}>¥{customerVehicleCost.toFixed(2)}</td>
                    <td style={{ textAlign: 'right', padding: '8px 6px', fontWeight: 700 }}>¥{(internalProject?.weightedMaterial || 0).toFixed(2)}</td>
                    <td style={{ textAlign: 'right', padding: '8px 6px', fontWeight: 700 }}>¥{(internalProject?.weightedDirectLabor || 0).toFixed(2)}</td>
                    <td colSpan={showMohDetail ? 7 : 1} style={{ textAlign: 'right', padding: '8px 6px' }} />
                    <td style={{ textAlign: 'right', padding: '8px 6px' }} />
                    <td style={{ textAlign: 'right', padding: '8px 6px' }} />
                    <td style={{ textAlign: 'right', padding: '8px 6px', fontWeight: 700, color: 'var(--warning)' }}>¥{internalVehicleCost.toFixed(2)}</td>
                    <td style={{ textAlign: 'right', padding: '8px 6px', fontWeight: 700 }}>¥{allocPerVehicle.toFixed(2)}</td>
                    <td style={{ textAlign: 'right', padding: '8px 6px', fontWeight: 700, color: (customerVehicleCost - internalVehicleCost - allocPerVehicle) < 0 ? 'var(--danger)' : 'var(--success)' }}>
                      ¥{(customerVehicleCost - internalVehicleCost - allocPerVehicle).toFixed(2)}
                    </td>
                    <td style={{ textAlign: 'right', padding: '8px 6px', fontWeight: 700, color: grossMargin < 5 ? 'var(--warning)' : 'var(--success)' }}>
                      {(customerVehicleCost > 0 ? ((customerVehicleCost - internalVehicleCost - allocPerVehicle) / customerVehicleCost * 100) : 0).toFixed(1)}%
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </Col>
      </Row>

      <MultiImportDialog visible={showMultiImport} onClose={() => setShowMultiImport(false)} projectId={id!} onImported={loadData} />
    </div>
  );
}
