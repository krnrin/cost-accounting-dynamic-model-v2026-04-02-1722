import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Typography, Spin, Button, Card, Table, InputNumber,
  Space, Breadcrumb, Toast, Tag, Tabs, TabPane, Radio, RadioGroup, Banner
} from '@douyinfe/semi-ui';
import {
  IconDownload, IconHistogram
} from '@douyinfe/semi-icons';
import ReactECharts from 'echarts-for-react/lib/core';
import echarts from '@/lib/echarts';

import { db } from '@/data/db';
import type { ProjectRecord, ScenarioRecord } from '@/data/db';
import { useProjectStore } from '@/store/projectStore';
import { useSettingsStore } from '@/store/settingsStore';
import { computeHarnessCost, computeProjectFromHarnesses, computeInternalHarnessCost, computeInternalProjectFromHarnesses, INTERNAL_DEFAULTS } from '@/engine/harness_costing';
import { computeMetalEscalation, computeSensitivityMatrix, DEFAULT_CONTRACT } from '@/engine/metal_escalation';
import { exportAnnualDropExcel, exportMetalEscalationExcel } from '@/engine/excel_export';
import type { HarnessResult, ProjectHarnessResult } from '@/types/harness';
import type { MetalPrices } from '@/types/project';
import type { MetalEscalationResult } from '@/types/quote';
import AlertBanner from '@/components/AlertBanner';
import { RoleGuard } from '@/components/RoleGuard';
import ScenarioSelector from '@/components/ScenarioSelector';

const { Title, Text } = Typography;

interface AnnualDropRow {
  year: number;
  dropRate: number; // %
  deliveredPrice: number;
  dropAmount: number;
  cumulativeDropPercent: number;
}

export default function AnnualDropPage() {
  const { id, sid } = useParams<{ id: string; sid: string }>();
  const navigate = useNavigate();
  const { setCurrentProject } = useProjectStore();
  const { alertThresholds } = useSettingsStore();

  const [isLoading, setLocalLoading] = useState(true);
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [scenario, setScenario] = useState<ScenarioRecord | null>(null);
  const [harnessResults, setHarnessResults] = useState<HarnessResult[]>([]);
  const [summary, setSummary] = useState<ProjectHarnessResult | null>(null);
  const [internalVehicleCost, setInternalVehicleCost] = useState(0);
  
  const [annualDropRates, setAnnualDropRates] = useState<number[]>([]); // 1-based, index 0 is year 1
  const [simulatedMetalPrices, setSimulatedMetalPrices] = useState<MetalPrices>({ copper: 0, aluminum: 0 });

  // Tab 2: 金属联动 state
  const [escMetalPrices, setEscMetalPrices] = useState<MetalPrices>({ copper: 68400, aluminum: 18200 });
  const [escBaseMetalPrices, setEscBaseMetalPrices] = useState<MetalPrices>({ copper: 68400, aluminum: 18200 });
  const [escThreshold, setEscThreshold] = useState(5);
  const [escRatio, setEscRatio] = useState(100);
  const [escPeriod, setEscPeriod] = useState<'quarterly' | 'semiannual' | 'annual'>('quarterly');
  const [escResult, setEscResult] = useState<MetalEscalationResult | null>(null);

  useEffect(() => {
    if (!id || !sid) return;

    const loadData = async () => {
      setLocalLoading(true);
      try {
        const projectData = await db.projects.get(id);
        const scenarioData = await db.scenarios.get(sid!);
        if (projectData && scenarioData) {
          setProject(projectData);
          setScenario(scenarioData);
          setCurrentProject(projectData.id, projectData.meta.projectName);
          setSimulatedMetalPrices(scenarioData.config.metalPrices);
          setEscBaseMetalPrices(scenarioData.config.metalPrices);
          setEscMetalPrices(scenarioData.config.metalPrices);

          const harnessRecords = await db.harnesses.where('scenarioId').equals(sid!).toArray();
          const results = harnessRecords.map(record =>
            computeHarnessCost(record.input, scenarioData.config.costRates, scenarioData.config.metalPrices)
          );
          setHarnessResults(results);
          setSummary(computeProjectFromHarnesses(results));

          // 内部实绩成本
          const internalRates = scenarioData.config.internalRates || INTERNAL_DEFAULTS;
          const internalResults = harnessRecords.map(record =>
            computeInternalHarnessCost(record.input, internalRates, scenarioData.config.metalPrices)
          );
          const intProject = computeInternalProjectFromHarnesses(internalResults);
          setInternalVehicleCost(intProject.vehicleCost);

          // Initialize annual drop rates
          const years = scenarioData.lifecycleYears || 6;
          const defaultRate = scenarioData.config.annualDropRate || 0.03;
          const initialRates = new Array(years).fill(0).map((_, i) => i === 0 ? 0 : defaultRate * 100);
          setAnnualDropRates(initialRates);
        }
      } catch (error) {
        console.error('Failed to load project data:', error);
      } finally {
        setLocalLoading(false);
      }
    };

    loadData();
  }, [id, sid, setCurrentProject]);

  const baseDeliveredPrice = summary?.vehicleCost || 0;

  const annualDropData = useMemo(() => {
    const rows: AnnualDropRow[] = [];
    let totalFactor = 1.0;

    for (let i = 0; i < annualDropRates.length; i++) {
      const year = i + 1;
      const rate = (annualDropRates[i] || 0) / 100;
      
      if (year > 1) {
        totalFactor *= (1 - rate);
      }
      
      const priceAfterDrop = baseDeliveredPrice * totalFactor;
      
      rows.push({
        year,
        dropRate: annualDropRates[i] || 0,
        deliveredPrice: priceAfterDrop,
        dropAmount: baseDeliveredPrice - priceAfterDrop,
        cumulativeDropPercent: (1 - totalFactor) * 100
      });
    }
    return rows;
  }, [baseDeliveredPrice, annualDropRates]);

  const metalAdjustmentPerVehicle = useMemo(() => {
    if (!scenario || !harnessResults.length) return 0;
    const escalation = computeMetalEscalation(
      harnessResults,
      scenario.config.metalPrices,
      simulatedMetalPrices
    );
    return escalation.summary.totalWeightedDelta;
  }, [scenario, harnessResults, simulatedMetalPrices]);

  const combinedData = useMemo(() => {
    return annualDropData.map(row => ({
      year: row.year,
      annualDropPrice: row.deliveredPrice,
      metalAdjustment: metalAdjustmentPerVehicle,
      finalDeliveredPrice: row.deliveredPrice + metalAdjustmentPerVehicle,
      totalDeltaAmount: baseDeliveredPrice - (row.deliveredPrice + metalAdjustmentPerVehicle)
    }));
  }, [annualDropData, metalAdjustmentPerVehicle, baseDeliveredPrice]);

  // Tab 2: 金属联动 — 敏感度矩阵
  const escSensitivityMatrix = useMemo(() => {
    if (harnessResults.length === 0) return null;
    const baseCu = escBaseMetalPrices.copper;
    const steps = [-0.2, -0.15, -0.1, -0.05, 0, 0.05, 0.1, 0.15, 0.2];
    const copperRange = steps.map(s => baseCu * (1 + s));
    return computeSensitivityMatrix(harnessResults, escBaseMetalPrices, copperRange, [escBaseMetalPrices.aluminum]);
  }, [harnessResults, escBaseMetalPrices]);

  const handleCalculateEscalation = () => {
    if (!scenario) return;
    const contract = {
      ...DEFAULT_CONTRACT,
      baseCopperPrice: escBaseMetalPrices.copper,
      baseAluminumPrice: escBaseMetalPrices.aluminum,
      thresholdPercent: escThreshold / 100,
      escalationRatio: escRatio / 100,
      period: escPeriod,
    };
    const res = computeMetalEscalation(harnessResults, escBaseMetalPrices, escMetalPrices, contract, {
      annualVolumes: scenario.config.volumes.map(v => v.volume)
    });
    setEscResult(res);
  };

  const formatCurrency = (val: number | undefined) => {
    if (val === undefined) return '-';
    return `¥${val.toFixed(2)}`;
  };

  const formatDelta = (val: number | undefined) => {
    if (val === undefined) return '-';
    const color = val > 0 ? 'var(--semi-color-danger)' : val < 0 ? 'var(--semi-color-success)' : 'inherit';
    const prefix = val > 0 ? '+' : '';
    return <span style={{ color }}>{prefix}{val.toFixed(2)}</span>;
  };

  const chartOptions = {
    title: { text: '到厂价趋势分析', left: 'center', textStyle: { color: 'var(--text-primary)' } },
    tooltip: { trigger: 'axis' },
    legend: { data: ['年降后价格', '综合到厂价', '内部实绩成本'], bottom: 0, textStyle: { color: 'var(--text-secondary)' } },
    xAxis: {
      type: 'category',
      data: annualDropData.map(d => `Year ${d.year}`),
      axisLabel: { color: 'var(--text-secondary)' }
    },
    yAxis: {
      type: 'value',
      name: '金额 (元)',
      axisLabel: { color: 'var(--text-secondary)' },
      splitLine: { lineStyle: { color: 'var(--border)' } }
    },
    series: [
      {
        name: '年降后价格',
        type: 'bar',
        data: annualDropData.map(d => d.deliveredPrice.toFixed(2)),
        itemStyle: {
          color: (params: any) => {
            const price = annualDropData[params.dataIndex]?.deliveredPrice ?? 0;
            return price < internalVehicleCost ? '#dc2626' : '#5470c6';
          }
        }
      },
      {
        name: '综合到厂价',
        type: 'line',
        data: combinedData.map(d => d.finalDeliveredPrice.toFixed(2)),
        itemStyle: { color: '#91cc75' }
      },
      {
        name: '内部实绩成本',
        type: 'line',
        data: annualDropData.map(() => internalVehicleCost.toFixed(2)),
        lineStyle: { type: 'dashed', width: 2, color: '#dc2626' },
        itemStyle: { color: '#dc2626' },
        symbol: 'none',
        markLine: {
          silent: true,
          data: [{ yAxis: internalVehicleCost, label: { formatter: `成本线 ¥${internalVehicleCost.toFixed(2)}`, position: 'insideEndTop' } }],
          lineStyle: { type: 'dashed', color: '#dc2626' }
        }
      }
    ]
  };

  const handleRateChange = (year: number, value: number) => {
    const newRates = [...annualDropRates];
    newRates[year - 1] = value;
    setAnnualDropRates(newRates);
  };

  const exportToExcel = () => {
    if (!project) return;
    exportAnnualDropExcel(
      project.meta.projectName,
      annualDropData,
      combinedData,
      harnessResults,
      baseDeliveredPrice
    );
    Toast.success('年降分析表已导出');
  };

  if (isLoading || !project || !scenario) {
    return <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 100 }}><Spin size="large" /></div>;
  }

  const columns = [
    { title: '年度', dataIndex: 'year', key: 'year', width: 80 },
    { 
      title: '年降率 (%)', 
      dataIndex: 'dropRate', 
      key: 'dropRate',
      render: (val: number, record: AnnualDropRow) => (
        record.year === 1 ? '—' : 
        <InputNumber 
          value={val} 
          min={0} max={100} step={0.1} 
          style={{ width: 100 }}
          onChange={(v) => handleRateChange(record.year, Number(v))}
        />
      )
    },
    { title: '年降后到厂价', dataIndex: 'deliveredPrice', key: 'deliveredPrice', render: (v: number) => `¥${v.toFixed(2)}` },
    { title: '单车降额', dataIndex: 'dropAmount', key: 'dropAmount', render: (v: number) => `¥${v.toFixed(2)}` },
    { title: '累计降幅', dataIndex: 'cumulativeDropPercent', key: 'cumulativeDropPercent', render: (v: number) => `${v.toFixed(2)}%` },
    { title: '内部实绩成本', key: 'internalCost', render: () => <span className="ledger-number">¥{internalVehicleCost.toFixed(2)}</span> },
    {
      title: '单车利润',
      key: 'unitProfit',
      render: (_: any, record: AnnualDropRow) => {
        const profit = record.deliveredPrice - internalVehicleCost;
        return <span className="ledger-number" style={{ color: profit < 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>¥{profit.toFixed(2)}</span>;
      }
    },
    {
      title: '利润率',
      key: 'profitMargin',
      render: (_: any, record: AnnualDropRow) => {
        const margin = record.deliveredPrice > 0 ? ((record.deliveredPrice - internalVehicleCost) / record.deliveredPrice) * 100 : 0;
        return <span style={{ color: margin < 0 ? 'var(--danger)' : margin < 5 ? 'var(--warning)' : 'var(--success)', fontWeight: 600 }}>{margin.toFixed(1)}%</span>;
      }
    },
    {
      title: '状态',
      key: 'status',
      render: (_: any, record: AnnualDropRow) => {
        const profit = record.deliveredPrice - internalVehicleCost;
        return profit < 0
          ? <Tag color="red" size="small">亏损</Tag>
          : <Tag color="green" size="small">盈利</Tag>;
      }
    },
  ];

  const combinedColumns = [
    { title: '年度', dataIndex: 'year', key: 'year' },
    { title: '年降到厂价', dataIndex: 'annualDropPrice', key: 'annualDropPrice', render: (v: number) => `¥${v.toFixed(2)}` },
    { title: '金属联动调整', dataIndex: 'metalAdjustment', key: 'metalAdjustment', render: (v: number) => `¥${v.toFixed(2)}` },
    { title: '综合到厂价', dataIndex: 'finalDeliveredPrice', key: 'finalDeliveredPrice', render: (v: number) => `¥${v.toFixed(2)}` },
    { title: '综合变化金额', dataIndex: 'totalDeltaAmount', key: 'totalDeltaAmount', render: (v: number) => `¥${v.toFixed(2)}` },
  ];

  return (
    <div style={{ padding: '0 24px 24px' }}>
      <ScenarioSelector />
      <div style={{ margin: '16px 0' }}>
        <Breadcrumb>
          <Breadcrumb.Item onClick={() => navigate('/')}>项目列表</Breadcrumb.Item>
          <Breadcrumb.Item onClick={() => navigate(`/project/${id}/s/${sid}`)}>{project.meta.projectName}</Breadcrumb.Item>
          <Breadcrumb.Item>价格管理</Breadcrumb.Item>
        </Breadcrumb>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title heading={3}>价格管理</Title>
        <Button icon={<IconDownload />} onClick={exportToExcel}>导出 Excel</Button>
      </div>

      <AlertBanner
        projectId={id!}
        currentPrices={simulatedMetalPrices}
        basePrices={scenario!.config.metalPrices}
        thresholds={alertThresholds}
      />

      <Tabs type="line" defaultActiveKey="annualDrop">
        {/* ──── Tab 1: 年降合同 ──── */}
        <TabPane tab="年降合同" itemKey="annualDrop">
          <div style={{ padding: '16px 0' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 24, marginBottom: 24 }}>
              <Card title="年降合同计划 (多年度)" headerExtraContent={<Text type="secondary">基准价格: ¥{baseDeliveredPrice.toFixed(2)}</Text>}>
                <Table columns={columns} dataSource={annualDropData} pagination={false} size="small" />
              </Card>
              <Card title="价格走势预测">
                <ReactECharts echarts={echarts} option={chartOptions} style={{ height: 350 }} />
              </Card>
            </div>
          </div>
        </TabPane>

        {/* ──── Tab 2: 金属联动 ──── */}
        <TabPane tab="金属联动" itemKey="metalEscalation">
          <div style={{ padding: '16px 0' }}>
            <Card className="glass-card" title="金属价格参数" style={{ marginBottom: 24 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}>
                <div>
                  <Text style={{ display: 'block', color: 'var(--semi-color-text-2)' }}>基准铜价 (元/吨)</Text>
                  <InputNumber value={escBaseMetalPrices.copper} onChange={v => setEscBaseMetalPrices({ ...escBaseMetalPrices, copper: v as number })} style={{ width: '100%' }} />
                </div>
                <div>
                  <Text style={{ display: 'block', color: 'var(--semi-color-text-2)' }}>基准铝价 (元/吨)</Text>
                  <InputNumber value={escBaseMetalPrices.aluminum} onChange={v => setEscBaseMetalPrices({ ...escBaseMetalPrices, aluminum: v as number })} style={{ width: '100%' }} />
                </div>
                <div>
                  <Text style={{ display: 'block', color: 'var(--semi-color-text-2)' }}>新铜价 (元/吨)</Text>
                  <InputNumber value={escMetalPrices.copper} onChange={v => setEscMetalPrices({ ...escMetalPrices, copper: v as number })} style={{ width: '100%' }} />
                </div>
                <div>
                  <Text style={{ display: 'block', color: 'var(--semi-color-text-2)' }}>新铝价 (元/吨)</Text>
                  <InputNumber value={escMetalPrices.aluminum} onChange={v => setEscMetalPrices({ ...escMetalPrices, aluminum: v as number })} style={{ width: '100%' }} />
                </div>
                <div>
                  <Text style={{ display: 'block', color: 'var(--semi-color-text-2)' }}>联动阈值 (%)</Text>
                  <InputNumber value={escThreshold} onChange={v => setEscThreshold(v as number)} style={{ width: '100%' }} />
                </div>
                <div>
                  <Text style={{ display: 'block', color: 'var(--semi-color-text-2)' }}>联动比例 (%)</Text>
                  <InputNumber value={escRatio} onChange={v => setEscRatio(v as number)} style={{ width: '100%' }} />
                </div>
                <div>
                  <Text style={{ display: 'block', color: 'var(--semi-color-text-2)' }}>联动周期</Text>
                  <RadioGroup value={escPeriod} onChange={e => setEscPeriod(e.target.value as any)} type="button" style={{ width: '100%' }}>
                    <Radio value="quarterly">季度</Radio>
                    <Radio value="semiannual">半年</Radio>
                    <Radio value="annual">年度</Radio>
                  </RadioGroup>
                </div>
              </div>
              <Space>
                <Button theme="solid" icon={<IconHistogram />} onClick={handleCalculateEscalation}>计算联动</Button>
                {escResult && (
                  <RoleGuard field="quoteExport">
                    <Button icon={<IconDownload />} onClick={() => {
                      exportMetalEscalationExcel(escResult, project.meta.projectName, project.meta.customer);
                      Toast.success('金属联动分析报表已导出');
                    }}>导出联动报表</Button>
                  </RoleGuard>
                )}
              </Space>
            </Card>

            {escResult && (
              <>
                <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
                  <Card className="glass-card" style={{ flex: 1 }}>
                    <Text style={{ color: 'var(--semi-color-text-2)' }}>单车影响金额</Text>
                    <Title heading={2}>{formatDelta(escResult.summary.totalWeightedDelta)}</Title>
                  </Card>
                  <Card className="glass-card" style={{ flex: 1 }}>
                    <Text style={{ color: 'var(--semi-color-text-2)' }}>全生命周期影响</Text>
                    <Title heading={2} style={{ color: escResult.summary.totalWeightedDelta > 0 ? 'var(--semi-color-danger)' : 'var(--semi-color-success)' }}>
                      {escResult.annualImpact ? formatCurrency(escResult.annualImpact.totalLifecycleImpact) : '-'}
                    </Title>
                  </Card>
                  <Card className="glass-card" style={{ flex: 1 }}>
                    <Text style={{ color: 'var(--semi-color-text-2)' }}>受影响线束</Text>
                    <Title heading={2}>{escResult.summary.affectedCount}</Title>
                  </Card>
                </div>
                <Card className="glass-card" title="联动计算明细" style={{ marginBottom: 24 }}>
                  <Table
                    pagination={false}
                    scroll={{ x: 1200 }}
                    dataSource={escResult.harnesses}
                    columns={[
                      { title: '零件号', render: (_: any, r: any) => r.harnessId },
                      { title: '名称', render: (_: any, r: any) => r.harnessName },
                      { title: '铜重(kg)', render: (_: any, r: any) => r.copperWeight.toFixed(3) },
                      { title: '铝重(kg)', render: (_: any, r: any) => r.aluminumWeight.toFixed(3) },
                      { title: '材料变化', render: (_: any, r: any) => formatDelta(r.deltaMaterialCost) },
                      { title: '到厂价变化', render: (_: any, r: any) => formatDelta(r.deltaDeliveredPrice) },
                      { title: '加权影响', render: (_: any, r: any) => formatDelta(r.weightedDelta) },
                    ]}
                  />
                </Card>
              </>
            )}

            <Card className="glass-card" title="铜价敏感度矩阵" style={{ marginBottom: 24 }}>
              <Banner type="info" description="基于基准铜价 ±20% 范围波动，展示对单车总成本的影响金额 (铝价保持基准值)。" style={{ marginBottom: 16 }} />
              {escSensitivityMatrix && (
                <Table
                  dataSource={escSensitivityMatrix.matrix}
                  pagination={false}
                  columns={[
                    { title: '铜价 (元/吨)', render: (_: any, row: any) => row[0].copper.toLocaleString() },
                    { title: '价格变动%', render: (_: any, row: any) => {
                        const pct = (row[0].copper / escSensitivityMatrix.baseMetal.copper - 1) * 100;
                        return `${pct > 0 ? '+' : ''}${pct.toFixed(0)}%`;
                      }
                    },
                    { title: '单车影响 (元)', render: (_: any, row: any) => formatDelta(row[0].deltaPerVehicle) }
                  ]}
                />
              )}
            </Card>
          </div>
        </TabPane>

        {/* ──── Tab 3: 综合影响 ──── */}
        <TabPane tab="综合影响" itemKey="combined">
          <div style={{ padding: '16px 0' }}>
            <Card title="金属联动 + 年降 综合影响分析" style={{ marginBottom: 24 }}>
              <div style={{ marginBottom: 16, display: 'flex', gap: 24, alignItems: 'center', background: 'var(--semi-color-bg-1)', padding: 16, borderRadius: 8 }}>
                <Text strong>模拟金属价格：</Text>
                <Space>
                  <Text>铜 (元/吨)</Text>
                  <InputNumber value={simulatedMetalPrices.copper} onChange={(v) => setSimulatedMetalPrices(p => ({ ...p, copper: Number(v) }))} />
                </Space>
                <Space>
                  <Text>铝 (元/吨)</Text>
                  <InputNumber value={simulatedMetalPrices.aluminum} onChange={(v) => setSimulatedMetalPrices(p => ({ ...p, aluminum: Number(v) }))} />
                </Space>
                <Button theme="light" onClick={() => setSimulatedMetalPrices(scenario!.config.metalPrices)}>重置</Button>
              </div>
              <Table columns={combinedColumns} dataSource={combinedData} pagination={false} />
            </Card>

            <Card title="各线束年降明细 (第一年 vs 最后一年)">
              <Table
                dataSource={harnessResults}
                pagination={false}
                size="small"
                columns={[
                  { title: '零件号', dataIndex: 'harnessId', key: 'harnessId' },
                  { title: '名称', dataIndex: 'harnessName', key: 'harnessName' },
                  { title: '基准单价', dataIndex: 'deliveredPrice', key: 'base', render: (v: number) => `¥${v.toFixed(2)}` },
                  {
                    title: `Year ${annualDropData.length} 价格`,
                    key: 'lastYear',
                    render: (_, record) => {
                      const lastRow = annualDropData[annualDropData.length - 1];
                      const lastYearFactor = lastRow ? lastRow.deliveredPrice / baseDeliveredPrice : 1;
                      return `¥${(record.deliveredPrice * lastYearFactor).toFixed(2)}`;
                    }
                  },
                  {
                    title: '累计年降额',
                    key: 'totalDrop',
                    render: (_, record) => {
                      const lastRow = annualDropData[annualDropData.length - 1];
                      const lastYearFactor = lastRow ? lastRow.deliveredPrice / baseDeliveredPrice : 1;
                      return `¥${(record.deliveredPrice * (1 - lastYearFactor)).toFixed(2)}`;
                    }
                  }
                ]}
              />
            </Card>
          </div>
        </TabPane>
      </Tabs>
    </div>
  );
}
