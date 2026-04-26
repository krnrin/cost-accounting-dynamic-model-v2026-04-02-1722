import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Breadcrumb,
  Button,
  Card,
  Empty,
  InputNumber,
  Space,
  Spin,
  Table,
  Tabs,
  TabPane,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { IconDownload, IconHistogram, IconSave } from '@douyinfe/semi-icons';
import ReactECharts from 'echarts-for-react/lib/core';
import echarts from '@/lib/echarts';
import { db } from '@/data/db';
import type { ProjectRecord, ScenarioRecord } from '@/data/db';
import { ensureScenarioWorkspaceHydrated } from '@/data/serverScenarioSync';
import { useProjectStore } from '@/store/projectStore';
import { computeHarnessCost, computeProjectFromHarnesses, computeInternalHarnessCost, computeInternalProjectFromHarnesses } from '@/engine/harness_costing';
import {
  applyInstallationRatiosToHarnessRecords,
  resolveScenarioVehicleConfigs,
} from '@/engine/configuration_model';
import { exportAnnualDropExcel } from '@/engine/excel_export';
import type { HarnessResult, ProjectHarnessResult } from '@/types/harness';
import { computeProjectAlloc, computeProjectRecovery } from '@/engine/onetime_alloc';
import { computeRunningPrice } from '@/engine/running_price';
import ScenarioSelector from '@/components/ScenarioSelector';
import AlertBanner from '@/components/AlertBanner';
import { useSettingsStore } from '@/store/settingsStore';
import { apiClient } from '@/lib/apiClient';
import {
  createAnnualDrop,
  fetchAnnualDropImpact,
  fetchAnnualDrops,
  updateAnnualDrop,
  type AnnualDropRow as AnnualDropApiRow,
} from '@/lib/simulationApi';

const { Title, Text } = Typography;

interface AnnualDropRow {
  year: number;
  dropRate: number;
  deliveredPrice: number;
  dropAmount: number;
  cumulativeDropPercent: number;
}

interface QuoteSummary {
  id: string;
  version: string;
  status: string;
  effectivePrice: number | null;
  effectivePriceMode: string;
  updatedAt: string;
}

interface ProjectDashboardData {
  internalCostBaseline: number | null;
  latestQuote: QuoteSummary | null;
}

interface AnnualDropRecord extends AnnualDropApiRow {
  key: string;
}

function formatCurrency(value: number) {
  return `¥${value.toFixed(2)}`;
}

export default function AnnualDropPage() {
  const { id, sid } = useParams<{ id: string; sid: string }>();
  const navigate = useNavigate();
  const { setCurrentProject } = useProjectStore();
  const { alertThresholds } = useSettingsStore();

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [scenario, setScenario] = useState<ScenarioRecord | null>(null);
  const [harnessResults, setHarnessResults] = useState<HarnessResult[]>([]);
  const [summary, setSummary] = useState<ProjectHarnessResult | null>(null);
  const [internalVehicleCost, setInternalVehicleCost] = useState(0);
  const [annualDropRates, setAnnualDropRates] = useState<number[]>([]);
  const [savedAnnualDrops, setSavedAnnualDrops] = useState<AnnualDropRecord[]>([]);
  const [savingAnnualDrop, setSavingAnnualDrop] = useState(false);
  const [editingAnnualDropId, setEditingAnnualDropId] = useState<string | null>(null);
  const [impactSummary, setImpactSummary] = useState<string | null>(null);
  const [weightedOnetimeAddon, setWeightedOnetimeAddon] = useState(0);
  const [onetimeRecoveryProgress, setOnetimeRecoveryProgress] = useState(0);

  useEffect(() => {
    if (!id || !sid) return;

    const loadData = async () => {
      setLoading(true);
      try {
        await ensureScenarioWorkspaceHydrated(id, sid);
        const projectData = await db.projects.get(id);
        const scenarioData = await db.scenarios.get(sid);
        if (!projectData || !scenarioData) return;

        setProject(projectData);
        setScenario(scenarioData);
        setCurrentProject(projectData.id, projectData.meta.projectName);

        const [harnessRecords, onetimeCosts, allocTrackers] = await Promise.all([
          db.harnesses.where('scenarioId').equals(sid).toArray(),
          db.onetimeCosts.where('scenarioId').equals(sid).toArray(),
          db.allocTrackers.where('scenarioId').equals(sid).toArray(),
        ]);
        const effectiveRecords = applyInstallationRatiosToHarnessRecords(
          harnessRecords,
          resolveScenarioVehicleConfigs(scenarioData),
          scenarioData.harnessConfigMappings ?? [],
        );
        const results = effectiveRecords.map((record) =>
          computeHarnessCost(record.input, scenarioData.config.costRates, scenarioData.config.metalPrices),
        );
        setHarnessResults(results);
        setSummary(computeProjectFromHarnesses(results));

        // [成本核算数据原则] 必须传入 internalRates，禁止回退
        if (!scenarioData.config.internalRates) {
          throw new Error(
            '[成本核算] 场景缺少 internalRates 配置。' +
            '请在系统设置中配置真实费率，禁止使用硬编码默认值。'
          );
        }
        const internalRates = scenarioData.config.internalRates;
        const internalResults = effectiveRecords.map((record) =>
          computeInternalHarnessCost(record.input, internalRates, scenarioData.config.metalPrices),
        );
        const internalProject = computeInternalProjectFromHarnesses(internalResults);
        setInternalVehicleCost(internalProject.vehicleCost);

        if (onetimeCosts.length > 0) {
          const allocSummary = computeProjectAlloc(onetimeCosts.map((record) => record.input));
          const cumProducedMap = Object.fromEntries(
            allocTrackers.map((tracker) => [tracker.harnessId, tracker.cumProduced]),
          );
          const recovery = computeProjectRecovery(
            allocSummary.allocations,
            cumProducedMap,
            scenarioData.config.volumes?.[0]?.volume ?? 100000,
            scenarioData.lifecycleYears,
          );
          setWeightedOnetimeAddon(allocSummary.weightedAllocPerVehicle);
          setOnetimeRecoveryProgress(recovery.overallRecoveryProgress);
        } else {
          setWeightedOnetimeAddon(0);
          setOnetimeRecoveryProgress(0);
        }

        const years = scenarioData.lifecycleYears || 6;
        const defaultRate = scenarioData.config.annualDropRate || 0.03;
        setAnnualDropRates(new Array(years).fill(0).map((_, index) => (index === 0 ? 0 : defaultRate * 100)));
      } catch (error) {
        console.error('Failed to load annual drop data:', error);
        Toast.error('年降页面数据加载失败');
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [id, sid, setCurrentProject]);

  const refreshAnnualDrops = async () => {
    if (!sid) return;
    try {
      const rows = await fetchAnnualDrops(sid);
      setSavedAnnualDrops(rows.map((row) => ({ ...row, key: row.id })));
    } catch (error) {
      console.error('Failed to fetch annual drops:', error);
    }
  };

  useEffect(() => {
    void refreshAnnualDrops();
  }, [sid]);

  const baseDeliveredPrice = summary?.vehicleCost || 0;

  const annualDropData = useMemo(() => {
    const rows: AnnualDropRow[] = [];
    let totalFactor = 1;

    for (let i = 0; i < annualDropRates.length; i += 1) {
      const year = i + 1;
      const rate = (annualDropRates[i] || 0) / 100;
      if (year > 1) totalFactor *= 1 - rate;
      const deliveredPrice = baseDeliveredPrice * totalFactor;
      rows.push({
        year,
        dropRate: annualDropRates[i] || 0,
        deliveredPrice,
        dropAmount: baseDeliveredPrice - deliveredPrice,
        cumulativeDropPercent: (1 - totalFactor) * 100,
      });
    }

    return rows;
  }, [annualDropRates, baseDeliveredPrice]);

  const runningPriceData = useMemo(() => {
    if (!scenario || !summary) return [];

    return annualDropData.map((row) => {
      const record = computeRunningPrice({
        quoteDeliveredPrice: baseDeliveredPrice,
        quoteMetalPrices: scenario.config.metalPrices,
        currentMetalPrices: scenario.config.metalPrices,
        copperWeightKg: summary.weightedCopperWeight,
        aluminumWeightKg: summary.weightedAluminumWeight,
        annualDropRate: row.year === 1 ? 0 : (annualDropRates[row.year - 1] || 0) / 100,
        yearsSinceQuote: row.year - 1,
        quoteOnetimeAddon: weightedOnetimeAddon,
        currentOnetimeAddon: weightedOnetimeAddon * (1 - onetimeRecoveryProgress),
        onetimeRecoveryProgress,
        installationRatio: 1,
      });

      return {
        year: row.year,
        runningPrice: record.runningPrice,
        recurringQuotePrice: record.recurringQuotePrice,
        metalAdjustment: record.metalAdjustment,
        annualDropAdjustment: record.annualDropAdjustment,
        activeOnetimeAddon: record.activeOnetimeAddon,
        onetimeRecovered: record.onetimeRecovered,
      };
    });
  }, [annualDropData, annualDropRates, baseDeliveredPrice, onetimeRecoveryProgress, scenario, summary, weightedOnetimeAddon]);

  const handleRateChange = (year: number, value: number) => {
    setAnnualDropRates((current) => {
      const next = [...current];
      next[year - 1] = value;
      return next;
    });
  };

  const annualDropColumns = [
    { title: '年度', dataIndex: 'year', key: 'year', width: 80 },
    {
      title: '年降率 (%)',
      dataIndex: 'dropRate',
      key: 'dropRate',
      width: 140,
      render: (value: number, record: AnnualDropRow) => (
        record.year === 1
          ? '—'
          : (
            <InputNumber
              value={value}
              min={0}
              max={100}
              step={0.1}
              style={{ width: 100 }}
              onChange={(next) => handleRateChange(record.year, Number(next || 0))}
            />
          )
      ),
    },
    { title: '年降后价格', dataIndex: 'deliveredPrice', key: 'deliveredPrice', render: (value: number) => formatCurrency(value) },
    { title: '单车降额', dataIndex: 'dropAmount', key: 'dropAmount', render: (value: number) => formatCurrency(value) },
    { title: '累计降幅', dataIndex: 'cumulativeDropPercent', key: 'cumulativeDropPercent', render: (value: number) => `${value.toFixed(2)}%` },
    {
      title: '内部实绩成本',
      key: 'internalVehicleCost',
      render: () => formatCurrency(internalVehicleCost),
    },
    {
      title: '利润差',
      key: 'profitGap',
      render: (_: unknown, record: AnnualDropRow) => {
        const profit = record.deliveredPrice - internalVehicleCost;
        return <span style={{ color: profit >= 0 ? 'var(--semi-color-success)' : 'var(--semi-color-danger)' }}>{formatCurrency(profit)}</span>;
      },
    },
  ];

  const savedColumns = [
    { title: '记录名', dataIndex: 'name', key: 'name' },
    { title: '年度', dataIndex: 'year', key: 'year', width: 80 },
    { title: '降幅', dataIndex: 'dropRate', key: 'dropRate', width: 100, render: (value: number) => `${(value * 100).toFixed(2)}%` },
    { title: '成本影响', key: 'cost', render: (_: unknown, record: AnnualDropRecord) => `${formatCurrency(record.costBefore)} → ${formatCurrency(record.costAfter)}` },
    { title: '利润影响', key: 'profit', render: (_: unknown, record: AnnualDropRecord) => `${formatCurrency(record.profitBefore)} → ${formatCurrency(record.profitAfter)}` },
    {
      title: '查看',
      key: 'view',
      width: 100,
      render: (_: unknown, record: AnnualDropRecord) => (
        <Button size="small" theme="borderless" onClick={async () => {
          const impact = await fetchAnnualDropImpact(record.id);
          setEditingAnnualDropId(record.id);
          setImpactSummary(formatImpactSummary(impact));
        }}>
          载入影响
        </Button>
      ),
    },
  ];

  const chartOption = useMemo(() => ({
    title: { text: '年降趋势', left: 'center', textStyle: { color: 'var(--semi-color-text-0)' } },
    tooltip: { trigger: 'axis' as const },
    legend: { bottom: 0, textStyle: { color: 'var(--semi-color-text-0)' } },
    xAxis: {
      type: 'category' as const,
      data: annualDropData.map((item) => `Year ${item.year}`),
      axisLabel: { color: 'var(--semi-color-text-0)' },
    },
    yAxis: {
      type: 'value' as const,
      axisLabel: { color: 'var(--semi-color-text-0)' },
      splitLine: { lineStyle: { color: 'var(--semi-color-border)' } },
    },
    series: [
      {
        name: '年降后价格',
        type: 'line' as const,
        smooth: true,
        data: annualDropData.map((item) => item.deliveredPrice.toFixed(2)),
        itemStyle: { color: '#6c7ee1' },
      },
      {
        name: '内部实绩成本',
        type: 'line' as const,
        smooth: true,
        data: annualDropData.map(() => internalVehicleCost.toFixed(2)),
        lineStyle: { type: 'dashed' as const, color: '#ef5350' },
        itemStyle: { color: '#ef5350' },
      },
    ],
  }), [annualDropData, internalVehicleCost]);

  const exportRows = annualDropData.map((item) => ({
    year: item.year,
    annualDropPrice: item.deliveredPrice,
    metalAdjustment: 0,
    finalDeliveredPrice: item.deliveredPrice,
    totalDeltaAmount: item.dropAmount,
  }));

  const handleExport = () => {
    if (!project) return;
    exportAnnualDropExcel(project.meta.projectName, annualDropData, exportRows, harnessResults, baseDeliveredPrice);
    Toast.success('年降分析表已导出');
  };

  const formatImpactSummary = (impact: AnnualDropApiRow) => `第 ${impact.year} 年：成本 ${impact.costBefore.toFixed(2)} → ${impact.costAfter.toFixed(2)}，报价 ${impact.priceBefore.toFixed(2)} → ${impact.priceAfter.toFixed(2)}，利润 ${impact.profitBefore.toFixed(2)} → ${impact.profitAfter.toFixed(2)}`;

  const handleSaveAnnualDrop = async () => {
    if (!id || !sid || annualDropData.length <= 1) return;
    setSavingAnnualDrop(true);
    try {
      const dashboard = await apiClient<ProjectDashboardData>(`/projects/${id}/dashboard`);
      const costBefore = dashboard.internalCostBaseline ?? internalVehicleCost;
      const priceBefore = dashboard.latestQuote?.effectivePrice ?? baseDeliveredPrice;
      let savedCount = 0;

      for (const target of annualDropData.slice(1)) {
        const existing = savedAnnualDrops.find((row) => row.year === target.year);
        const payload = {
          name: `年降-${target.year}年`,
          year: target.year,
          dropRate: (target.dropRate || 0) / 100,
          costBefore,
          priceBefore,
          status: existing?.status ?? 'draft',
        };

        const saved = existing
          ? await updateAnnualDrop(existing.id, payload)
          : await createAnnualDrop(sid, {
              projectId: id,
              ...payload,
            });

        savedCount += 1;
        if (target.year === annualDropData[1]?.year) {
          const impact = await fetchAnnualDropImpact(saved.id);
          setImpactSummary(formatImpactSummary(impact));
          setEditingAnnualDropId(saved.id);
        }
      }

      await refreshAnnualDrops();
      Toast.success(savedCount === annualDropData.length - 1 ? '年降周期记录已保存' : '部分年降记录已保存');
    } catch (error: any) {
      Toast.error(error.message || '保存年降记录失败');
    } finally {
      setSavingAnnualDrop(false);
    }
  };

  if (loading || !project || !scenario || !summary) {
    return <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 120 }}><Spin size="large" /></div>;
  }

  return (
    <div style={{ padding: '0 24px 24px' }} data-testid="annual-drop-page">
      <ScenarioSelector />

      <div style={{ margin: '16px 0' }}>
        <Breadcrumb>
          <Breadcrumb.Item onClick={() => navigate('/')}>项目列表</Breadcrumb.Item>
          <Breadcrumb.Item onClick={() => navigate(`/project/${id}/s/${sid}`)}>{project.meta.projectName}</Breadcrumb.Item>
          <Breadcrumb.Item>年降管理</Breadcrumb.Item>
        </Breadcrumb>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
        <Title heading={3} style={{ margin: 0 }}>年降管理</Title>
        <Space>
          <Button data-testid="annual-drop-save" icon={<IconSave />} loading={savingAnnualDrop} onClick={handleSaveAnnualDrop}>保存年降记录</Button>
          <Button icon={<IconHistogram />} theme="light">经营预警</Button>
          <Button icon={<IconDownload />} onClick={handleExport}>导出 Excel</Button>
        </Space>
      </div>

      <AlertBanner
        projectId={id!}
        currentPrices={scenario.config.metalPrices}
        basePrices={scenario.config.metalPrices}
        thresholds={alertThresholds}
      />

      {impactSummary && (
        <Card className="glass-card" style={{ marginBottom: 16 }}>
          <Text>{impactSummary}</Text>
        </Card>
      )}

      <Card className="glass-card" title="已保存年降记录" style={{ marginBottom: 16 }}>
        {savedAnnualDrops.length === 0 ? (
          <Empty description="暂无年降记录，保存当前测算后可追踪影响" />
        ) : (
          <>
            <div style={{ marginBottom: 12 }}>
              <Text type="tertiary">
                已保存 {savedAnnualDrops.length} 条周期记录{editingAnnualDropId ? '，当前查看已选中记录影响' : ''}
              </Text>
            </div>
            <Table columns={savedColumns} dataSource={savedAnnualDrops} pagination={false} size="small" />
          </>
        )}
      </Card>

      <Tabs type="line" defaultActiveKey="annualDrop">
        <TabPane tab="年降测算" itemKey="annualDrop">
          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16, marginTop: 16 }}>
            <Card className="glass-card" title="年降参数与结果">
              <Table columns={annualDropColumns} dataSource={annualDropData} pagination={false} size="small" rowKey="year" />
            </Card>
            <Card className="glass-card" title="经营摘要">
              <Space vertical align="start">
                <div>
                  <Text type="tertiary">当前有效报价基线</Text>
                  <Title heading={4} style={{ margin: '8px 0 0' }}>{formatCurrency(baseDeliveredPrice)}</Title>
                </div>
                <div>
                  <Text type="tertiary">内部实绩成本</Text>
                  <Title heading={4} style={{ margin: '8px 0 0' }}>{formatCurrency(internalVehicleCost)}</Title>
                </div>
                <div>
                  <Text type="tertiary">生命周期年度数</Text>
                  <Title heading={4} style={{ margin: '8px 0 0' }}>{annualDropData.length}</Title>
                </div>
              </Space>
            </Card>
          </div>

          <Card className="glass-card" style={{ marginTop: 16 }}>
            <ReactECharts echarts={echarts} option={chartOption} style={{ height: 360 }} theme="" />
          </Card>
        </TabPane>
        <TabPane tab="运行价" itemKey="runningPrice">
          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16, marginTop: 16 }}>
            <Card className="glass-card" title="运行价测算">
              <Table
                data-testid="running-price-table"
                rowKey="year"
                pagination={false}
                size="small"
                dataSource={runningPriceData}
                columns={[
                  { title: '年度', dataIndex: 'year', width: 80 },
                  { title: '运行价', dataIndex: 'runningPrice', render: (value: number) => formatCurrency(value) },
                  { title: '年降调整', dataIndex: 'annualDropAdjustment', render: (value: number) => formatCurrency(value) },
                  { title: '金属联动', dataIndex: 'metalAdjustment', render: (value: number) => formatCurrency(value) },
                  { title: '有效一次性 addon', dataIndex: 'activeOnetimeAddon', render: (value: number) => formatCurrency(value) },
                  { title: '一次性费用已回收', dataIndex: 'onetimeRecovered', render: (value: boolean) => value ? '是' : '否' },
                ]}
              />
            </Card>
            <Card className="glass-card" title="运行价说明">
              <Space vertical align="start">
                <div>
                  <Text type="tertiary">报价一次性 addon</Text>
                  <Title heading={4} style={{ margin: '8px 0 0' }}>{formatCurrency(weightedOnetimeAddon)}</Title>
                </div>
                <div>
                  <Text type="tertiary">一次性费用回收进度</Text>
                  <Title heading={4} style={{ margin: '8px 0 0' }}>{(onetimeRecoveryProgress * 100).toFixed(2)}%</Title>
                </div>
                <div>
                  <Text type="tertiary">当前预计运行价</Text>
                  <Title heading={4} style={{ margin: '8px 0 0' }}>{formatCurrency(runningPriceData[0]?.runningPrice ?? 0)}</Title>
                </div>
              </Space>
            </Card>
          </div>
        </TabPane>
      </Tabs>
    </div>
  );
}
