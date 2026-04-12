import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Card,
  Empty,
  InputNumber,
  Layout,
  Row,
  Col,
  Slider,
  Space,
  Spin,
  Table,
  Tabs,
  TabPane,
  Tag,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { IconArrowLeft, IconBranch, IconDownload, IconPlay, IconSave } from '@douyinfe/semi-icons';
import ReactECharts from 'echarts-for-react/lib/core';
import * as XLSX from 'xlsx';
import echarts from '@/lib/echarts';
import { db } from '@/data/db';
import type { HarnessRecord, ProjectRecord, ScenarioRecord } from '@/data/db';
import { computeHarnessCost, computeProjectFromHarnesses } from '@/engine/harness_costing';
import { compareFactoryCosts } from '@/engine/factory_comparison';
import type { FactoryComparisonResult } from '@/engine/factory_comparison';
import { computeProjectAnnualizedCost } from '@/engine/annualized_cost';
import type { HarnessInput } from '@/types/harness';
import type { EquipmentConfig, FactoryConfig } from '@/types/project';
import { useProjectStore } from '@/store/projectStore';
import { useSettingsStore } from '@/store/settingsStore';
import { usePermission } from '@/hooks/usePermission';
import ScenarioSelector from '@/components/ScenarioSelector';
import {
  createSimulationTask,
  fetchSimulations,
  runSimulationTask,
  convertSimulationTask,
  type SimulationTaskRow,
} from '@/lib/simulationApi';

const { Title, Text } = Typography;

const DEFAULT_EQUIPMENT: EquipmentConfig = {
  sharedInvestment: 500000,
  dedicatedInvestment: 200000,
  annualDepreciation: 100000,
  depreciationYears: 7,
  residualRate: 0.05,
};

export default function SimulationPage() {
  const { id, sid } = useParams<{ id: string; sid: string }>();
  const navigate = useNavigate();
  const { setCurrentProject } = useProjectStore();
  const { can } = usePermission();
  const { factories: settingsFactories } = useSettingsStore();

  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [scenario, setScenario] = useState<ScenarioRecord | null>(null);
  const [harnesses, setHarnesses] = useState<HarnessRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [copperAdj, setCopperAdj] = useState(0);
  const [aluminumAdj, setAluminumAdj] = useState(0);
  const [volumeAdj, setVolumeAdj] = useState(0);
  const [dropRate, setDropRate] = useState(0);
  const [hoursAdj, setHoursAdj] = useState(0);

  const [taskName, setTaskName] = useState('默认仿真');
  const [savedSimulations, setSavedSimulations] = useState<SimulationTaskRow[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [runTaskId, setRunTaskId] = useState<string | null>(null);
  const [convertTaskId, setConvertTaskId] = useState<string | null>(null);
  const [summaryText, setSummaryText] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !sid) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const projectData = await db.projects.get(id);
        const scenarioData = await db.scenarios.get(sid);
        if (!projectData || !scenarioData) return;

        setProject(projectData);
        setScenario(scenarioData);
        setCurrentProject(projectData.id, projectData.meta.projectName);
        setDropRate(scenarioData.config.annualDropRate || 0);

        const harnessData = await db.harnesses.where('scenarioId').equals(sid).toArray();
        setHarnesses(harnessData);
      } catch (error) {
        console.error('Failed to load simulation data:', error);
        Toast.error('数据加载失败');
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [id, sid, setCurrentProject]);

  const refreshSavedSimulations = async () => {
    if (!sid) return;
    try {
      const rows = await fetchSimulations(sid);
      setSavedSimulations(rows);
      if (!selectedTaskId && rows.length > 0) {
        setSelectedTaskId(rows[0]!.id);
      }
    } catch (error) {
      console.error('Failed to fetch simulations:', error);
    }
  };

  useEffect(() => {
    void refreshSavedSimulations();
  }, [sid]);

  const baselineResults = useMemo(() => {
    if (!scenario || harnesses.length === 0) return null;
    const results = harnesses.map((item) => computeHarnessCost(item.input, scenario.config.costRates, scenario.config.metalPrices));
    return computeProjectFromHarnesses(results);
  }, [scenario, harnesses]);

  const simulatedResults = useMemo(() => {
    if (!scenario || harnesses.length === 0) return null;
    const simMetalPrices = {
      copper: scenario.config.metalPrices.copper * (1 + copperAdj / 100),
      aluminum: scenario.config.metalPrices.aluminum * (1 + aluminumAdj / 100),
    };
    const hoursFactor = 1 + hoursAdj / 100;
    const results = harnesses.map((item) => {
      const simInput: HarnessInput = {
        ...item.input,
        frontHours: item.input.frontHours * hoursFactor,
        backHours: item.input.backHours * hoursFactor,
      };
      return computeHarnessCost(simInput, scenario.config.costRates, simMetalPrices);
    });
    return computeProjectFromHarnesses(results);
  }, [scenario, harnesses, copperAdj, aluminumAdj, hoursAdj]);

  const volumeSchedule = scenario?.config?.volumes ?? [];
  const baseVolume = volumeSchedule[0]?.volume ?? 100000;
  const simVolume = Math.round(baseVolume * (1 + volumeAdj / 100));
  const baseAnnualCost = baselineResults ? baselineResults.vehicleCost * baseVolume : 0;
  const simAnnualCost = simulatedResults ? simulatedResults.vehicleCost * simVolume : 0;

  const activeFactories = useMemo<FactoryConfig[]>(() => {
    const scenarioFactories = scenario?.config?.factories ?? [];
    return scenarioFactories.length > 0 ? scenarioFactories : settingsFactories;
  }, [scenario, settingsFactories]);

  const factoryComparison = useMemo<FactoryComparisonResult[]>(() => {
    if (!scenario || harnesses.length === 0 || activeFactories.length === 0) return [];
    return harnesses.map((item) => compareFactoryCosts(item.input, activeFactories, scenario.config.metalPrices));
  }, [scenario, harnesses, activeFactories]);

  const annualizedResult = useMemo(() => {
    if (!scenario || !baselineResults) return null;
    const equipment = scenario.config.equipmentConfig ?? DEFAULT_EQUIPMENT;
    const volumes = volumeSchedule.length > 0
      ? volumeSchedule
      : Array.from({ length: 7 }, (_, index) => ({ year: index + 1, volume: baseVolume }));
    return computeProjectAnnualizedCost(baselineResults.harnesses, equipment, volumes);
  }, [scenario, baselineResults, volumeSchedule, baseVolume]);

  const selectedTask = useMemo(
    () => savedSimulations.find((item) => item.id === selectedTaskId) ?? null,
    [savedSimulations, selectedTaskId],
  );

  const applyTask = (task: SimulationTaskRow) => {
    setSelectedTaskId(task.id);
    setTaskName(task.name);
    setCopperAdj(task.parameterSnapshot?.copperAdj ?? 0);
    setAluminumAdj(task.parameterSnapshot?.aluminumAdj ?? 0);
    setVolumeAdj(task.parameterSnapshot?.volumeAdj ?? 0);
    setDropRate(task.parameterSnapshot?.dropRate ?? (scenario?.config.annualDropRate || 0));
    setHoursAdj(task.parameterSnapshot?.hoursAdj ?? 0);
    const vehicleCost = task.resultSnapshot?.simulation?.vehicleCost;
    setSummaryText(typeof vehicleCost === 'number' ? `已载入 ${task.name}，最近模拟单车成本 ¥${vehicleCost.toFixed(2)}` : `已载入 ${task.name}`);
  };

  const saveTask = async () => {
    if (!id || !sid) return;
    setSaveLoading(true);
    try {
      const created = await createSimulationTask(sid, {
        projectId: id,
        name: taskName.trim() || '默认仿真',
        baselineScenarioId: sid,
        parameterSnapshot: { copperAdj, aluminumAdj, volumeAdj, dropRate, hoursAdj },
      });
      await refreshSavedSimulations();
      applyTask(created);
      Toast.success('仿真任务已保存');
    } catch (error: any) {
      Toast.error(error.message || '保存仿真任务失败');
    } finally {
      setSaveLoading(false);
    }
  };

  const runTask = async (task: SimulationTaskRow) => {
    setRunTaskId(task.id);
    try {
      const result = await runSimulationTask(task.id);
      await refreshSavedSimulations();
      applyTask(result);
      setSummaryText(`最新运行：${result.name}，模拟单车成本 ¥${result.resultSnapshot?.simulation?.vehicleCost?.toFixed?.(2) ?? '--'}`);
      Toast.success('仿真任务已运行');
    } catch (error: any) {
      Toast.error(error.message || '运行仿真任务失败');
    } finally {
      setRunTaskId(null);
    }
  };

  const convertTask = async (task: SimulationTaskRow) => {
    if (!id) return;
    setConvertTaskId(task.id);
    try {
      const result = await convertSimulationTask(task.id);
      await refreshSavedSimulations();
      Toast.success(`已转为场景：${result.scenario.name}`);
      navigate(`/project/${id}/s/${result.scenario.id}`);
    } catch (error: any) {
      Toast.error(error.message || '转正式场景失败');
    } finally {
      setConvertTaskId(null);
    }
  };

  const resetParams = () => {
    setCopperAdj(0);
    setAluminumAdj(0);
    setVolumeAdj(0);
    setDropRate(scenario?.config.annualDropRate || 0);
    setHoursAdj(0);
  };

  const handleExport = () => {
    if (!baselineResults || !simulatedResults || !project || !scenario) return;
    const data = [
      ['指标', '基准方案', '模拟方案', '变动'],
      ['单车成本 (元)', baselineResults.vehicleCost.toFixed(2), simulatedResults.vehicleCost.toFixed(2), (simulatedResults.vehicleCost - baselineResults.vehicleCost).toFixed(2)],
      ['材料成本 (元)', baselineResults.weightedMaterial.toFixed(2), simulatedResults.weightedMaterial.toFixed(2), (simulatedResults.weightedMaterial - baselineResults.weightedMaterial).toFixed(2)],
      ['出厂价 (元)', baselineResults.weightedExFactory.toFixed(2), simulatedResults.weightedExFactory.toFixed(2), (simulatedResults.weightedExFactory - baselineResults.weightedExFactory).toFixed(2)],
      ['铜价 (元/吨)', scenario.config.metalPrices.copper, scenario.config.metalPrices.copper * (1 + copperAdj / 100), `${copperAdj}%`],
      ['铝价 (元/吨)', scenario.config.metalPrices.aluminum, scenario.config.metalPrices.aluminum * (1 + aluminumAdj / 100), `${aluminumAdj}%`],
      ['年降率 (%)', scenario.config.annualDropRate, dropRate, `${(dropRate - scenario.config.annualDropRate).toFixed(1)}%`],
      ['年产量', baseVolume, simVolume, `${volumeAdj}%`],
      ['年产值 (万元)', (baseAnnualCost / 10000).toFixed(1), (simAnnualCost / 10000).toFixed(1), `${baseAnnualCost > 0 ? ((simAnnualCost / baseAnnualCost - 1) * 100).toFixed(1) : 0}%`],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Simulation');
    XLSX.writeFile(wb, `${project.meta.projectName}_模拟分析.xlsx`);
  };

  const waterfallOption = useMemo(() => {
    if (!baselineResults || !simulatedResults) return null;
    return {
      title: { text: '模拟结果对比', textStyle: { color: 'var(--semi-color-text-0)', fontSize: 14 } },
      tooltip: { trigger: 'axis' as const },
      xAxis: { type: 'category' as const, data: ['基准成本', '模拟成本', '基准年产值', '模拟年产值'], axisLabel: { color: 'var(--semi-color-text-0)' } },
      yAxis: { type: 'value' as const, axisLabel: { color: 'var(--semi-color-text-0)' }, splitLine: { lineStyle: { color: 'var(--semi-color-border)' } } },
      series: [{ type: 'bar' as const, data: [baselineResults.vehicleCost, simulatedResults.vehicleCost, baseAnnualCost / 10000, simAnnualCost / 10000], itemStyle: { color: '#6c7ee1' } }],
    };
  }, [baselineResults, simulatedResults, baseAnnualCost, simAnnualCost]);

  const lifecycleOption = useMemo(() => {
    if (!baselineResults || !simulatedResults || !scenario) return null;
    const years = Array.from({ length: 7 }, (_, index) => index + 1);
    return {
      title: { text: '生命周期价格走势', textStyle: { color: 'var(--semi-color-text-0)', fontSize: 14 } },
      tooltip: { trigger: 'axis' as const },
      legend: { bottom: 0, textStyle: { color: 'var(--semi-color-text-0)' } },
      xAxis: { type: 'category' as const, data: years.map((year) => `第${year}年`), axisLabel: { color: 'var(--semi-color-text-0)' } },
      yAxis: { type: 'value' as const, axisLabel: { color: 'var(--semi-color-text-0)' }, splitLine: { lineStyle: { color: 'var(--semi-color-border)' } } },
      series: [
        {
          name: '基准',
          type: 'line' as const,
          data: years.map((year) => (baselineResults.vehicleCost * Math.pow(1 - (scenario.config.annualDropRate || 0) / 100, year - 1)).toFixed(2)),
        },
        {
          name: '模拟',
          type: 'line' as const,
          data: years.map((year) => (simulatedResults.vehicleCost * Math.pow(1 - dropRate / 100, year - 1)).toFixed(2)),
          lineStyle: { color: '#ffca28', width: 3 },
          itemStyle: { color: '#ffca28' },
        },
      ],
    };
  }, [baselineResults, simulatedResults, scenario, dropRate]);

  if (loading || !project || !scenario || !baselineResults || !simulatedResults) {
    return <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 120 }}><Spin size="large" /></div>;
  }

  const savedColumns = [
    {
      title: '任务名称',
      dataIndex: 'name',
      key: 'name',
      render: (_: string, record: SimulationTaskRow) => <Button theme="borderless" onClick={() => applyTask(record)}>{record.name}</Button>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (value: string) => <Tag color={value === 'completed' ? 'green' : value === 'converted' ? 'blue' : 'grey'}>{value}</Tag>,
    },
    {
      title: '参数快照',
      key: 'params',
      render: (_: unknown, record: SimulationTaskRow) => `铜 ${record.parameterSnapshot?.copperAdj ?? 0}% / 铝 ${record.parameterSnapshot?.aluminumAdj ?? 0}% / 量 ${record.parameterSnapshot?.volumeAdj ?? 0}% / 降 ${record.parameterSnapshot?.dropRate ?? 0}% / 工时 ${record.parameterSnapshot?.hoursAdj ?? 0}%`,
    },
    {
      title: '结果',
      key: 'result',
      width: 140,
      render: (_: unknown, record: SimulationTaskRow) => {
        const value = record.resultSnapshot?.simulation?.vehicleCost;
        return typeof value === 'number' ? `¥${value.toFixed(2)}` : '未运行';
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: 220,
      render: (_: unknown, record: SimulationTaskRow) => (
        <Space>
          <Button size="small" icon={<IconPlay />} loading={runTaskId === record.id} onClick={() => runTask(record)}>运行</Button>
          <Button size="small" icon={<IconBranch />} loading={convertTaskId === record.id} disabled={record.status !== 'completed' && record.status !== 'converted'} onClick={() => convertTask(record)}>转场景</Button>
        </Space>
      ),
    },
  ];

  return (
    <Layout style={{ padding: '0 24px 24px', background: 'transparent', minHeight: '100vh' }}>
      <ScenarioSelector />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '24px 0', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Button icon={<IconArrowLeft />} aria-label="返回" theme="borderless" onClick={() => navigate(`/project/${id}/s/${sid}`)} />
          <Title heading={3} style={{ margin: 0, color: 'var(--semi-color-text-0)' }}>成本分析工作台</Title>
          {selectedTask && <Tag color="blue">当前任务：{selectedTask.name}</Tag>}
        </div>
        <Space wrap>
          <input
            value={taskName}
            onChange={(event) => setTaskName(event.target.value)}
            placeholder="输入仿真任务名称"
            aria-label="仿真任务名称"
            style={{ height: 32, minWidth: 180, padding: '0 12px', borderRadius: 6, border: '1px solid var(--semi-color-border)', background: 'var(--semi-color-bg-1)', color: 'var(--semi-color-text-0)' }}
          />
          <Button icon={<IconSave />} onClick={saveTask} loading={saveLoading} disabled={!can('simulation')}>保存仿真</Button>
          <Button icon={<IconDownload />} theme="solid" onClick={handleExport} style={{ backgroundColor: 'var(--semi-color-primary)' }} disabled={!can('simulation')}>导出模拟报告</Button>
        </Space>
      </div>

      {summaryText && (
        <Card className="glass-card" style={{ marginBottom: 16 }}>
          <Text>{summaryText}</Text>
        </Card>
      )}

      <Card className="glass-card" title="已保存仿真" style={{ marginBottom: 16 }}>
        {savedSimulations.length === 0 ? (
          <Empty description="暂无仿真任务，先保存当前参数" />
        ) : (
          <Table columns={savedColumns} dataSource={savedSimulations.map((item) => ({ ...item, key: item.id }))} pagination={false} size="small" />
        )}
      </Card>

      <Tabs type="line" defaultActiveKey="whatif">
        <TabPane tab="What-if 模拟" itemKey="whatif">
          <Row gutter={24} style={{ marginTop: 16 }}>
            <Col span={6}>
              <Card title="模拟参数控制" className="glass-card">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  <ParamControl label="铜价变动 (%)" value={copperAdj} setValue={setCopperAdj} min={-30} max={30} disabled={!can('simulation')} />
                  <ParamControl label="铝价变动 (%)" value={aluminumAdj} setValue={setAluminumAdj} min={-30} max={30} disabled={!can('simulation')} />
                  <ParamControl label="产量变动 (%)" value={volumeAdj} setValue={setVolumeAdj} min={-50} max={50} step={5} disabled={!can('simulation')} />
                  <ParamControl label="年降率 (%)" value={dropRate} setValue={setDropRate} min={0} max={8} step={0.5} disabled={!can('simulation')} />
                  <ParamControl label="工时调整 (%)" value={hoursAdj} setValue={setHoursAdj} min={-20} max={20} disabled={!can('simulation')} />
                  <Button block onClick={resetParams} disabled={!can('simulation')}>重置参数</Button>
                </div>
              </Card>
            </Col>
            <Col span={18}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}>
                <MetricCard title="模拟单车成本" value={`¥${simulatedResults.vehicleCost.toFixed(2)}`} delta={(simulatedResults.vehicleCost - baselineResults.vehicleCost).toFixed(2)} danger={simulatedResults.vehicleCost > baselineResults.vehicleCost} />
                <MetricCard title="材料成本变动" value={`¥${simulatedResults.weightedMaterial.toFixed(2)}`} delta={`${((simulatedResults.weightedMaterial / baselineResults.weightedMaterial - 1) * 100).toFixed(1)}%`} danger={simulatedResults.weightedMaterial > baselineResults.weightedMaterial} />
                <MetricCard title="年产值 (模拟)" value={`¥${(simAnnualCost / 10000).toFixed(1)}万`} delta={`${baseAnnualCost > 0 ? ((simAnnualCost / baseAnnualCost - 1) * 100).toFixed(1) : 0}%`} danger={simAnnualCost > baseAnnualCost} />
                <MetricCard title="模拟产量" value={simVolume.toLocaleString()} delta={`${volumeAdj}%`} danger={false} />
              </div>
              <Row gutter={16}>
                <Col span={12}><Card className="glass-card">{waterfallOption && <ReactECharts echarts={echarts} option={waterfallOption} style={{ height: 350 }} theme="" />}</Card></Col>
                <Col span={12}><Card className="glass-card">{lifecycleOption && <ReactECharts echarts={echarts} option={lifecycleOption} style={{ height: 350 }} theme="" />}</Card></Col>
              </Row>
            </Col>
          </Row>
        </TabPane>
        <TabPane tab="工厂成本对比" itemKey="factoryCompare">
          <FactoryCompareTab factoryComparison={factoryComparison} activeFactories={activeFactories} />
        </TabPane>
        <TabPane tab="年度成本分摊" itemKey="annualized">
          <AnnualizedTab annualizedResult={annualizedResult} />
        </TabPane>
      </Tabs>
    </Layout>
  );
}

function ParamControl({ label, value, setValue, min, max, step = 1, disabled }: { label: string; value: number; setValue: (value: number) => void; min: number; max: number; step?: number; disabled: boolean }) {
  return (
    <div>
      <Text strong style={{ color: 'var(--semi-color-text-0)' }}>{label}</Text>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Slider min={min} max={max} step={step} value={value} onChange={(next: any) => setValue(next as number)} style={{ flex: 1 }} disabled={disabled} />
        <InputNumber value={value} onChange={(next: any) => setValue(Number(next || 0))} style={{ width: 70 }} disabled={disabled} />
      </div>
    </div>
  );
}

function MetricCard({ title, value, delta, danger }: { title: string; value: string; delta: string; danger: boolean }) {
  return (
    <Card className="glass-card">
      <Text size="small" style={{ color: 'var(--semi-color-text-2)' }}>{title}</Text>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
        <Title heading={3} style={{ margin: 0, color: 'var(--semi-color-text-0)' }}>{value}</Title>
        <Text type={danger ? 'danger' : 'success'}>{danger && !delta.startsWith('-') ? '+' : ''}{delta}</Text>
      </div>
    </Card>
  );
}

function FactoryCompareTab({ factoryComparison, activeFactories }: { factoryComparison: FactoryComparisonResult[]; activeFactories: FactoryConfig[] }) {
  if (activeFactories.length === 0) {
    return <div style={{ marginTop: 16 }}><Empty title="尚未配置工厂" description="请先在设置中配置多工厂参数。" /></div>;
  }
  if (factoryComparison.length === 0) {
    return <div style={{ marginTop: 16 }}><Empty title="无线束数据" description="当前项目无线束数据，无法进行工厂比价。" /></div>;
  }

  const columns = [
    { title: '线束', dataIndex: 'harnessName', width: 150 },
    ...activeFactories.map((factory) => ({
      title: factory.factoryName,
      dataIndex: factory.factoryId,
      width: 140,
      render: (value: any) => value ? `¥${value.deliveredPrice.toFixed(2)}` : '-',
    })),
    { title: '价差幅度', dataIndex: 'costRange', width: 120, render: (value: number) => `¥${value.toFixed(2)}` },
  ];

  const data = factoryComparison.map((item) => {
    const row: any = { key: item.harnessId, harnessName: item.harnessName, costRange: item.costRange };
    for (const factory of item.factories) {
      row[factory.factoryId] = { deliveredPrice: factory.result.deliveredPrice };
    }
    return row;
  });

  return <Card className="glass-card" style={{ marginTop: 16 }}><Table columns={columns} dataSource={data} pagination={false} size="small" scroll={{ x: 900 }} /></Card>;
}

function AnnualizedTab({ annualizedResult }: { annualizedResult: any }) {
  if (!annualizedResult) {
    return <div style={{ marginTop: 16 }}><Empty title="暂无数据" description="需要先有基准核算结果和产量计划。" /></div>;
  }

  const { projectAnnualBreakdown, lifecycleWeightedAvg, harnesses } = annualizedResult;
  const columns = [
    { title: '年度', dataIndex: 'year', width: 70, render: (value: number) => `第${value}年` },
    { title: '产量', dataIndex: 'volume', width: 100, render: (value: number) => value.toLocaleString() },
    { title: '设备分摊', dataIndex: 'equipmentPerUnit', width: 120, render: (value: number) => value.toFixed(4) },
    { title: '固定制造费', dataIndex: 'fixedMfgPerUnit', width: 120, render: (value: number) => value.toFixed(4) },
    { title: '单件总成本', dataIndex: 'totalCostPerUnit', width: 120, render: (value: number) => value.toFixed(2) },
    { title: '与第1年差异', dataIndex: 'deltaFromBase', width: 120, render: (value: number) => value.toFixed(4) },
    { title: '差异率', dataIndex: 'deltaPercent', width: 100, render: (value: number) => `${value.toFixed(1)}%` },
  ];

  return (
    <div style={{ marginTop: 16 }}>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}><MetricCard title="生命周期加权平均" value={`¥${lifecycleWeightedAvg.toFixed(2)}`} delta="" danger={false} /></Col>
        <Col span={8}><MetricCard title="线束数量" value={String(harnesses.length)} delta="" danger={false} /></Col>
        <Col span={8}><MetricCard title="年度数" value={String(projectAnnualBreakdown.length)} delta="" danger={false} /></Col>
      </Row>
      <Card className="glass-card"><Table columns={columns} dataSource={projectAnnualBreakdown} pagination={false} size="small" rowKey={(record: any) => String(record.year)} /></Card>
    </div>
  );
}
