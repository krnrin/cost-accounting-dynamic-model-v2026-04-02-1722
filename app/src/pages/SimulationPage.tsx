import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Typography, Spin, Button, Card, Slider, InputNumber, Toast, Layout,
  Row, Col, Tabs, TabPane, Table, Tag, Empty,
} from '@douyinfe/semi-ui';
import { IconArrowLeft, IconDownload } from '@douyinfe/semi-icons';
import ReactECharts from 'echarts-for-react/lib/core';
import echarts from '@/lib/echarts';
import * as XLSX from 'xlsx';

import { db } from '@/data/db';
import type { HarnessRecord, ProjectRecord, ScenarioRecord } from '@/data/db';
import { computeHarnessCost, computeProjectFromHarnesses } from '@/engine/harness_costing';
import { compareFactoryCosts } from '@/engine/factory_comparison';
import type { FactoryComparisonResult } from '@/engine/factory_comparison';
import { computeProjectAnnualizedCost } from '@/engine/annualized_cost';
import { computeAll, recomputeFrom, paramChangeToNodes } from '@/engine/incremental_calc';
import type { CostParams, CostNodeId } from '@/engine/incremental_calc';
import { getPriceHistory, getShfeReferencePrices } from '@/engine/metal_api';
import type { MetalPriceData } from '@/engine/metal_api';
import type { HarnessInput } from '@/types/harness';
import type { EquipmentConfig, FactoryConfig } from '@/types/project';
import { useProjectStore } from '@/store/projectStore';
import { useSettingsStore } from '@/store/settingsStore';
import { usePermission } from '@/hooks/usePermission';
import ScenarioSelector from '@/components/ScenarioSelector';

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
  const [loading, setLocalLoading] = useState(true);

  // Sliders state
  const [copperAdj, setCopperAdj] = useState(0);
  const [aluminumAdj, setAluminumAdj] = useState(0);
  const [volumeAdj, setVolumeAdj] = useState(0);
  const [dropRate, setDropRate] = useState(0);
  const [hoursAdj, setHoursAdj] = useState(0);

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
          setDropRate(scenarioData.config.annualDropRate || 0);

          const harnessData = await db.harnesses.where('scenarioId').equals(sid!).toArray();
          setHarnesses(harnessData);
        }
      } catch (error) {
        console.error('Failed to load simulation data:', error);
        Toast.error('数据加载失败');
      } finally {
        setLocalLoading(false);
      }
    };

    loadData();
  }, [id, sid, setCurrentProject]);

  const baselineResults = useMemo(() => {
    if (!scenario || harnesses.length === 0) return null;
    const results = harnesses.map(h => computeHarnessCost(h.input, scenario.config.costRates, scenario.config.metalPrices));
    return computeProjectFromHarnesses(results);
  }, [scenario, harnesses]);

  // DAG baseline: compute all cost nodes for each harness
  const dagBaseline = useMemo(() => {
    if (!scenario || harnesses.length === 0) return null;
    return harnesses.map(h => {
      const input = h.input;
      const bom = input.bom || [];
      const rawMaterialCost = bom.reduce((s, b) => s + (b.amount || 0), 0);
      const processHours = (input.frontHours || 0) + (input.backHours || 0);
      const packTotal = input.packaging?.subtotal || 0;
      const freightTotal = input.freight?.subtotal || 0;

      const params: CostParams = {
        rawMaterialCost,
        processHours,
        laborRate: scenario.config.costRates.laborRate,
        mfgRate: scenario.config.costRates.mfgRate,
        wasteRate: scenario.config.costRates.wasteRate,
        mgmtRate: scenario.config.costRates.mgmtRate,
        profitRate: scenario.config.costRates.profitRate,
        packTotal,
        freightTotal,
      };

      return { params, values: computeAll(params), harnessId: h.input.harnessId };
    });
  }, [scenario, harnesses]);

  const simulatedResults = useMemo(() => {
    if (!scenario || harnesses.length === 0) return null;

    const simMetalPrices = {
      copper: scenario.config.metalPrices.copper * (1 + copperAdj / 100),
      aluminum: scenario.config.metalPrices.aluminum * (1 + aluminumAdj / 100),
    };

    const hoursFactor = 1 + hoursAdj / 100;

    const results = harnesses.map(h => {
      const simInput: HarnessInput = {
        ...h.input,
        frontHours: h.input.frontHours * hoursFactor,
        backHours: h.input.backHours * hoursFactor,
      };
      return computeHarnessCost(simInput, scenario.config.costRates, simMetalPrices);
    });

    return computeProjectFromHarnesses(results);
  }, [scenario, harnesses, copperAdj, aluminumAdj, hoursAdj]);

  const dagSimulation = useMemo(() => {
    if (!dagBaseline || !scenario) return null;
    
    const changedRootNodes = new Set<CostNodeId>();
    if (copperAdj !== 0 || aluminumAdj !== 0) {
      paramChangeToNodes('copperPrice').forEach(n => changedRootNodes.add(n));
    }
    if (hoursAdj !== 0) {
      paramChangeToNodes('processHours').forEach(n => changedRootNodes.add(n));
    }
    
    if (changedRootNodes.size === 0) return null;
    
    let totalRecomputed = 0;
    const totalNodes = dagBaseline.length * 10;
    
    const perHarness = dagBaseline.map(({ params, values }) => {
      // Adjust material for copper/aluminum price changes
      const metalFactor = 1 + copperAdj / 100; // simplified
      const newParams: CostParams = {
        ...params,
        rawMaterialCost: params.rawMaterialCost * metalFactor,
        processHours: params.processHours * (1 + hoursAdj / 100),
      };
      
      const { values: newValues, recomputed } = recomputeFrom(values, changedRootNodes, newParams);
      totalRecomputed += recomputed.length;
      return newValues;
    });
    
    return {
      perHarness,
      stats: {
        recomputed: totalRecomputed,
        total: totalNodes,
        skipped: totalNodes - totalRecomputed,
      },
    };
  }, [dagBaseline, scenario, copperAdj, aluminumAdj, hoursAdj]);

  // 产量计算
  const volumeSchedule = scenario?.config?.volumes ?? [];
  const baseVolume = (volumeSchedule.length > 0 && volumeSchedule[0]) ? volumeSchedule[0].volume : 100000;
  const simVolume = Math.round(baseVolume * (1 + volumeAdj / 100));
  const baseAnnualCost = baselineResults ? baselineResults.vehicleCost * baseVolume : 0;
  const simAnnualCost = simulatedResults ? simulatedResults.vehicleCost * simVolume : 0;

  // ── Factory comparison ──
  const activeFactories = useMemo<FactoryConfig[]>(() => {
    const projFactories = scenario?.config?.factories ?? [];
    return projFactories.length > 0 ? projFactories : settingsFactories;
  }, [scenario, settingsFactories]);

  const factoryComparison = useMemo<FactoryComparisonResult[]>(() => {
    if (!scenario || harnesses.length === 0 || activeFactories.length === 0) return [];
    return harnesses.map(h =>
      compareFactoryCosts(h.input, activeFactories, scenario.config.metalPrices)
    );
  }, [scenario, harnesses, activeFactories]);

  // ── Annualized cost ──
  const annualizedResult = useMemo(() => {
    if (!scenario || !baselineResults) return null;
    const equipment = scenario.config.equipmentConfig ?? DEFAULT_EQUIPMENT;
    const volumes = volumeSchedule.length > 0
      ? volumeSchedule
      : Array.from({ length: 7 }, (_, i) => ({ year: i + 1, volume: baseVolume }));
    return computeProjectAnnualizedCost(baselineResults.harnesses, equipment, volumes);
  }, [scenario, baselineResults, volumeSchedule, baseVolume]);

  if (loading || !project || !scenario || !baselineResults || !simulatedResults) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 120 }}>
        <Spin size="large" />
      </div>
    );
  }

  // Waterfall Chart data
  const waterfallOptions = buildWaterfallOptions(baselineResults, simulatedResults);
  // Lifecycle Line Chart
  const lifecycleOptions = buildLifecycleOptions(baselineResults, simulatedResults, scenario!, dropRate, volumeAdj, volumeSchedule, baseVolume);

  const cuWeight = simulatedResults.weightedCopperWeight;
  const cuBreakPrice = cuWeight > 0 && baselineResults.weightedProfit > 0
    ? (baselineResults.weightedProfit / cuWeight) * 1000 + scenario!.config.metalPrices.copper
    : 0;

  const handleExport = () => {
    const data = [
      ['指标', '基准方案', '模拟方案', '变动'],
      ['单车成本 (元)', baselineResults.vehicleCost.toFixed(2), simulatedResults.vehicleCost.toFixed(2), (simulatedResults.vehicleCost - baselineResults.vehicleCost).toFixed(2)],
      ['材料成本 (元)', baselineResults.weightedMaterial.toFixed(2), simulatedResults.weightedMaterial.toFixed(2), (simulatedResults.weightedMaterial - baselineResults.weightedMaterial).toFixed(2)],
      ['出厂价 (元)', baselineResults.weightedExFactory.toFixed(2), simulatedResults.weightedExFactory.toFixed(2), (simulatedResults.weightedExFactory - baselineResults.weightedExFactory).toFixed(2)],
      ['铜价 (元/吨)', scenario!.config.metalPrices.copper, scenario!.config.metalPrices.copper * (1 + copperAdj / 100), `${copperAdj}%`],
      ['铝价 (元/吨)', scenario!.config.metalPrices.aluminum, scenario!.config.metalPrices.aluminum * (1 + aluminumAdj / 100), `${aluminumAdj}%`],
      ['年降率 (%)', scenario!.config.annualDropRate, dropRate, `${(dropRate - scenario!.config.annualDropRate).toFixed(1)}%`],
      ['年产量', baseVolume, simVolume, `${volumeAdj}%`],
      ['年产值 (万元)', (baseAnnualCost / 10000).toFixed(1), (simAnnualCost / 10000).toFixed(1), `${baseAnnualCost > 0 ? ((simAnnualCost / baseAnnualCost - 1) * 100).toFixed(1) : 0}%`],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Simulation');
    XLSX.writeFile(wb, `${project.meta.projectName}_模拟分析.xlsx`);
  };

  return (
    <Layout style={{ padding: '0 24px 24px', background: 'transparent', minHeight: '100vh' }}>
      <ScenarioSelector />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '24px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button
            icon={<IconArrowLeft />}
            aria-label="返回"
            theme="borderless"
            onClick={() => navigate(`/project/${id}/s/${sid}`)}
          />
          <Title heading={3} style={{ margin: 0, color: 'var(--semi-color-text-0)' }}>成本分析工作台</Title>
          {dagSimulation?.stats && (
            <Tag color="green" size="small" style={{ marginLeft: 12 }}>
              增量计算: {dagSimulation.stats.recomputed}/{dagSimulation.stats.total} 节点 (跳过 {dagSimulation.stats.skipped})
            </Tag>
          )}
        </div>
        <Button icon={<IconDownload />} theme="solid" onClick={handleExport} style={{ backgroundColor: 'var(--semi-color-primary)' }} disabled={!can('simulation')}>导出模拟报告</Button>
      </div>

      <Tabs type="line" defaultActiveKey="whatif">
        <TabPane tab="What-if 模拟" itemKey="whatif">
          <WhatIfTab
            scenario={scenario}
            baselineResults={baselineResults}
            simulatedResults={simulatedResults}
            copperAdj={copperAdj} setCopperAdj={setCopperAdj}
            aluminumAdj={aluminumAdj} setAluminumAdj={setAluminumAdj}
            volumeAdj={volumeAdj} setVolumeAdj={setVolumeAdj}
            dropRate={dropRate} setDropRate={setDropRate}
            hoursAdj={hoursAdj} setHoursAdj={setHoursAdj}
            simVolume={simVolume} simAnnualCost={simAnnualCost}
            baseAnnualCost={baseAnnualCost} cuBreakPrice={cuBreakPrice}
            waterfallOptions={waterfallOptions} lifecycleOptions={lifecycleOptions}
            can={can}
          />
        </TabPane>
        <TabPane tab="工厂成本对比" itemKey="factoryCompare">
          <FactoryCompareTab
            factoryComparison={factoryComparison}
            activeFactories={activeFactories}
          />
        </TabPane>
        <TabPane tab="年度成本分摊" itemKey="annualized">
          <AnnualizedTab annualizedResult={annualizedResult} />
        </TabPane>
      </Tabs>
    </Layout>
  );
}

// ── What-if Tab (original content) ──
function WhatIfTab(props: any) {
  const {
    scenario, baselineResults, simulatedResults,
    copperAdj, setCopperAdj, aluminumAdj, setAluminumAdj,
    volumeAdj, setVolumeAdj, dropRate, setDropRate,
    hoursAdj, setHoursAdj,
    simAnnualCost, baseAnnualCost, cuBreakPrice,
    waterfallOptions, lifecycleOptions, can,
  } = props;

  const [fetchingPrice, setFetchingPrice] = useState(false);
  const [latestPrice, setLatestPrice] = useState<MetalPriceData | null>(null);
  const [priceHistory, setPriceHistory] = useState<{ date: string; copper: number; aluminum: number }[]>([]);

  // Load cached price history on mount
  useEffect(() => {
    const history = getPriceHistory();
    setPriceHistory(history);
  }, []);

  const handleFetchPrice = async () => {
    setFetchingPrice(true);
    try {
      const shfeRef = getShfeReferencePrices();
      setLatestPrice({
        copper: shfeRef.copper,
        aluminum: shfeRef.aluminum,
        source: 'SHFE参考价',
        fetchedAt: new Date().toISOString(),
        fromCache: false,
      });
      Toast.success(`铜价: ¥${shfeRef.copper.toFixed(2)}/kg, 铝价: ¥${shfeRef.aluminum.toFixed(2)}/kg (SHFE参考价)`);
      const updatedHistory = getPriceHistory();
      setPriceHistory(updatedHistory);
    } catch (err) {
      Toast.error('获取金属价格失败，请稍后重试');
      console.error('Metal price fetch error:', err);
    } finally {
      setFetchingPrice(false);
    }
  };

  const handleApplyPrice = () => {
    if (!latestPrice || !scenario) return;
    const baseCu = scenario.config.metalPrices.copper;
    const baseAl = scenario.config.metalPrices.aluminum;
    if (baseCu > 0) {
      setCopperAdj(Math.round(((latestPrice.copper - baseCu) / baseCu) * 100));
    }
    if (baseAl > 0) {
      setAluminumAdj(Math.round(((latestPrice.aluminum - baseAl) / baseAl) * 100));
    }
    Toast.info('已将实时价格差异应用到模拟参数');
  };

  // Price history sparkline option
  const sparklineOption = useMemo(() => {
    if (priceHistory.length < 2) return null;
    const recent = priceHistory.slice(-30);
    return {
      grid: { left: 0, right: 0, top: 4, bottom: 0, containLabel: false },
      xAxis: { type: 'category' as const, show: false, data: recent.map(p => p.date) },
      yAxis: [
        { type: 'value' as const, show: false, min: 'dataMin' as const, max: 'dataMax' as const },
        { type: 'value' as const, show: false, min: 'dataMin' as const, max: 'dataMax' as const },
      ],
      series: [
        {
          name: '铜',
          type: 'line' as const,
          data: recent.map(p => p.copper),
          smooth: true,
          symbol: 'none',
          lineStyle: { color: '#F5A623', width: 2 },
          yAxisIndex: 0,
        },
        {
          name: '铝',
          type: 'line' as const,
          data: recent.map(p => p.aluminum),
          smooth: true,
          symbol: 'none',
          lineStyle: { color: '#4FC3F7', width: 2 },
          yAxisIndex: 1,
        },
      ],
      tooltip: { show: false },
    };
  }, [priceHistory]);

  return (
    <Row gutter={24} style={{ marginTop: 16 }}>
      <Col span={6}>
        <Card title="模拟参数控制" className='glass-card' style={{   }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
              <Text strong style={{ color: 'var(--semi-color-text-0)' }}>铜价变动 (%)</Text>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Slider min={-30} max={30} step={1} value={copperAdj} onChange={(v: any) => setCopperAdj(v as number)} style={{ flex: 1 }} disabled={!can('simulation')} />
                <InputNumber value={copperAdj} onChange={(v: any) => setCopperAdj(v as number || 0)} style={{ width: 70 }} disabled={!can('simulation')} />
              </div>
            </div>
            <div>
              <Text strong style={{ color: 'var(--semi-color-text-0)' }}>铝价变动 (%)</Text>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Slider min={-30} max={30} step={1} value={aluminumAdj} onChange={(v: any) => setAluminumAdj(v as number)} style={{ flex: 1 }} disabled={!can('simulation')} />
                <InputNumber value={aluminumAdj} onChange={(v: any) => setAluminumAdj(v as number || 0)} style={{ width: 70 }} disabled={!can('simulation')} />
              </div>
            </div>

            {/* 获取实时金属价格 */}
            <div className='glass-card' style={{  }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text strong size="small" style={{ color: 'var(--semi-color-text-0)' }}>实时金属价格</Text>
                <Button
                  size="small"
                  theme="light"
                  loading={fetchingPrice}
                  onClick={handleFetchPrice}
                  disabled={!can('simulation')}
                >
                  获取价格
                </Button>
              </div>
              {latestPrice && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text size="small" style={{ color: '#F5A623' }}>铜: ¥{latestPrice.copper.toFixed(2)}/kg</Text>
                    <Text size="small" style={{ color: '#4FC3F7' }}>铝: ¥{latestPrice.aluminum.toFixed(2)}/kg</Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text size="small" style={{ color: 'var(--semi-color-text-2)' }}>{latestPrice.source}</Text>
                    <Button size="small" theme="borderless" onClick={handleApplyPrice} disabled={!can('simulation')}>
                      应用到模拟
                    </Button>
                  </div>
                </div>
              )}
              {sparklineOption && (
                <div>
                  <Text size="small" style={{ color: 'var(--semi-color-text-2)' }}>价格趋势</Text>
                  <ReactECharts echarts={echarts} option={sparklineOption} style={{ height: 50 }} theme="" />
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text size="small" style={{ color: '#F5A623' }}>铜</Text>
                    <Text size="small" style={{ color: '#4FC3F7' }}>铝</Text>
                  </div>
                </div>
              )}
            </div>

            <div>
              <Text strong style={{ color: 'var(--semi-color-text-0)' }}>产量变动 (%)</Text>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Slider min={-50} max={50} step={5} value={volumeAdj} onChange={(v: any) => setVolumeAdj(v as number)} style={{ flex: 1 }} disabled={!can('simulation')} />
                <InputNumber value={volumeAdj} onChange={(v: any) => setVolumeAdj(v as number || 0)} style={{ width: 70 }} disabled={!can('simulation')} />
              </div>
            </div>
            <div>
              <Text strong style={{ color: 'var(--semi-color-text-0)' }}>年降率 (%)</Text>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Slider min={0} max={8} step={0.5} value={dropRate} onChange={(v: any) => setDropRate(v as number)} style={{ flex: 1 }} disabled={!can('simulation')} />
                <InputNumber value={dropRate} onChange={(v: any) => setDropRate(v as number || 0)} style={{ width: 70 }} disabled={!can('simulation')} />
              </div>
            </div>
            <div>
              <Text strong style={{ color: 'var(--semi-color-text-0)' }}>工时调整 (%)</Text>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Slider min={-20} max={20} step={1} value={hoursAdj} onChange={(v: any) => setHoursAdj(v as number)} style={{ flex: 1 }} disabled={!can('simulation')} />
                <InputNumber value={hoursAdj} onChange={(v: any) => setHoursAdj(v as number || 0)} style={{ width: 70 }} disabled={!can('simulation')} />
              </div>
            </div>
            <Button block onClick={() => { setCopperAdj(0); setAluminumAdj(0); setVolumeAdj(0); setDropRate(scenario.config.annualDropRate || 0); setHoursAdj(0); }} disabled={!can('simulation')}>
              重置参数
            </Button>
          </div>
        </Card>
      </Col>

      <Col span={18}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}>
          <Card className='glass-card' style={{  }}>
            <Text size="small" style={{ color: 'var(--semi-color-text-2)' }}>模拟单车成本</Text>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
              <Title heading={3} style={{ margin: 0, color: 'var(--semi-color-text-0)' }}>{'\u00A5'}{simulatedResults.vehicleCost.toFixed(2)}</Title>
              <Text type={simulatedResults.vehicleCost > baselineResults.vehicleCost ? 'danger' : 'success'}>
                {simulatedResults.vehicleCost > baselineResults.vehicleCost ? '+' : ''}
                {(simulatedResults.vehicleCost - baselineResults.vehicleCost).toFixed(2)}
              </Text>
            </div>
          </Card>
          <Card className='glass-card' style={{  }}>
            <Text size="small" style={{ color: 'var(--semi-color-text-2)' }}>材料成本变动</Text>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
              <Title heading={3} style={{ margin: 0, color: 'var(--semi-color-text-0)' }}>{'\u00A5'}{simulatedResults.weightedMaterial.toFixed(2)}</Title>
              <Text type={simulatedResults.weightedMaterial > baselineResults.weightedMaterial ? 'danger' : 'success'}>
                {((simulatedResults.weightedMaterial / baselineResults.weightedMaterial - 1) * 100).toFixed(1)}%
              </Text>
            </div>
          </Card>
          <Card className='glass-card' style={{  }}>
            <Text size="small" style={{ color: 'var(--semi-color-text-2)' }}>年产值 (模拟)</Text>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
              <Title heading={3} style={{ margin: 0, color: 'var(--semi-color-text-0)' }}>{'\u00A5'}{(simAnnualCost / 10000).toFixed(1)}万</Title>
              <Text type={simAnnualCost > baseAnnualCost ? 'danger' : 'success'}>
                {simAnnualCost > baseAnnualCost ? '+' : ''}{((simAnnualCost / baseAnnualCost - 1) * 100).toFixed(1)}%
              </Text>
            </div>
          </Card>
          <Card className='glass-card' style={{  }}>
            <Text size="small" style={{ color: 'var(--semi-color-text-2)' }}>{cuBreakPrice > 0 ? '盈亏平衡铜价' : '盈亏平衡铜价 (N/A)'}</Text>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
              {cuBreakPrice > 0 ? (
                <>
                  <Title heading={3} style={{ margin: 0, color: 'var(--semi-color-text-0)' }}>{'\u00A5'}{(cuBreakPrice / 1000).toFixed(1)}k</Title>
                  <Text style={{ color: 'var(--semi-color-text-2)' }}>/ 吨</Text>
                </>
              ) : (
                <Title heading={3} style={{ margin: 0, color: 'var(--semi-color-warning)' }}>&mdash;</Title>
              )}
            </div>
          </Card>
        </div>

        <Row gutter={16}>
          <Col span={12}>
            <Card className='glass-card' style={{  }}>
              <ReactECharts echarts={echarts} option={waterfallOptions} style={{ height: 350 }} theme="" />
            </Card>
          </Col>
          <Col span={12}>
            <Card className='glass-card' style={{  }}>
              <ReactECharts echarts={echarts} option={lifecycleOptions} style={{ height: 350 }} theme="" />
            </Card>
          </Col>
        </Row>
      </Col>
    </Row>
  );
}

// ── Factory Compare Tab ──
function FactoryCompareTab({ factoryComparison, activeFactories }: {
  factoryComparison: FactoryComparisonResult[];
  activeFactories: FactoryConfig[];
}) {
  if (activeFactories.length === 0) {
    return (
      <div style={{ marginTop: 16 }}>
        <Empty
          title="尚未配置工厂"
          description="请在「设置 → 多工厂管理」中配置工厂，或加载参考数据后再使用此功能。"
        />
      </div>
    );
  }

  if (factoryComparison.length === 0) {
    return (
      <div style={{ marginTop: 16 }}>
        <Empty title="无线束数据" description="当前项目无线束数据，无法进行多工厂比价分析。" />
      </div>
    );
  }

  // Table: one row per harness, columns per factory
  const tableColumns = [
    { title: '线束', dataIndex: 'harnessName', width: 150, fixed: true as const },
    ...activeFactories.map(f => ({
      title: f.factoryName,
      dataIndex: f.factoryId,
      width: 140,
      render: (val: any) => {
        if (!val) return '-';
        return (
          <div>
            <Text strong>{'\u00A5'}{val.deliveredPrice.toFixed(2)}</Text>
            {val.deltaPercent !== 0 && (
              <Tag size="small" color={val.deltaPercent > 0 ? 'red' : 'green'} style={{ marginLeft: 4 }}>
                {val.deltaPercent > 0 ? '+' : ''}{val.deltaPercent.toFixed(1)}%
              </Tag>
            )}
            {val.isLowest && <Tag size="small" color="blue" style={{ marginLeft: 4 }}>最低</Tag>}
          </div>
        );
      },
    })),
    { title: '价差幅度', dataIndex: 'costRange', width: 100,
      render: (v: number) => <Text type="warning">{'\u00A5'}{v.toFixed(2)}</Text>
    },
  ];

  const tableData = factoryComparison.map(fc => {
    const row: any = {
      key: fc.harnessId,
      harnessName: fc.harnessName,
      costRange: fc.costRange,
    };
    for (const fr of fc.factories) {
      row[fr.factoryId] = {
        deliveredPrice: fr.result.deliveredPrice,
        deltaPercent: fr.deltaPercent,
        isLowest: fr.factoryId === fc.lowestCostFactory,
      };
    }
    return row;
  });

  // Bar chart: grouped bar per harness
  const chartFactoryNames = activeFactories.map(f => f.factoryName);
  const harnessNames = factoryComparison.map(fc => fc.harnessName);
  const series = activeFactories.map((f, idx) => ({
    name: f.factoryName,
    type: 'bar' as const,
    data: factoryComparison.map(fc => {
      const match = fc.factories.find(fr => fr.factoryId === f.factoryId);
      return match ? match.result.deliveredPrice : 0;
    }),
    itemStyle: {
      color: ['#6c7ee1', '#ffca28', '#66bb6a', '#ef5350', '#ab47bc', '#26c6da', '#ff7043'][idx % 7],
    },
  }));

  const barOptions = {
    backgroundColor: 'transparent',
    title: { text: '多工厂到厂价对比', textStyle: { color: 'var(--semi-color-text-0)', fontSize: 14 } },
    tooltip: { trigger: 'axis' as const },
    legend: { bottom: 0, textStyle: { color: 'var(--semi-color-text-0)' }, data: chartFactoryNames },
    xAxis: { type: 'category' as const, data: harnessNames, axisLabel: { color: 'var(--semi-color-text-0)', rotate: harnessNames.length > 6 ? 30 : 0 } },
    yAxis: { type: 'value' as const, name: '到厂价 (元)', axisLabel: { color: 'var(--semi-color-text-0)' }, splitLine: { lineStyle: { color: 'var(--semi-color-border)' } } },
    series,
  };

  return (
    <div style={{ marginTop: 16 }}>
      <Row gutter={16}>
        <Col span={24}>
          <Card className='glass-card' style={{  }}>
            <ReactECharts echarts={echarts} option={barOptions} style={{ height: 380 }} theme="" />
          </Card>
        </Col>
      </Row>
      <Card title={`工厂比价明细 (${activeFactories.length} 工厂 × ${factoryComparison.length} 线束)`}
        className='glass-card' style={{  }}>
        <Table columns={tableColumns} dataSource={tableData} pagination={false} size="small"
          scroll={{ x: 150 + activeFactories.length * 140 + 100 }} />
      </Card>
    </div>
  );
}

// ── Annualized Cost Tab ──
function AnnualizedTab({ annualizedResult }: { annualizedResult: any }) {
  if (!annualizedResult) {
    return (
      <div style={{ marginTop: 16 }}>
        <Empty title="暂无数据" description="需要有基准核算结果和产量计划才能计算年度差异化。" />
      </div>
    );
  }

  const { projectAnnualBreakdown, lifecycleWeightedAvg, harnesses: annualizedHarnesses } = annualizedResult;

  // Table
  const tableColumns = [
    { title: '年度', dataIndex: 'year', width: 70, render: (v: number) => `第${v}年` },
    { title: '产量', dataIndex: 'volume', width: 100, render: (v: number) => v.toLocaleString() },
    { title: '设备分摊 (元/件)', dataIndex: 'equipmentPerUnit', width: 130, render: (v: number) => v.toFixed(4) },
    { title: '固定制造费 (元/件)', dataIndex: 'fixedMfgPerUnit', width: 130, render: (v: number) => v.toFixed(4) },
    { title: '单件总成本 (元)', dataIndex: 'totalCostPerUnit', width: 130,
      render: (v: number) => <Text strong>{v.toFixed(2)}</Text>
    },
    { title: '与第1年差异', dataIndex: 'deltaFromBase', width: 120,
      render: (v: number) => (
        <Text type={v > 0 ? 'danger' : v < 0 ? 'success' : undefined}>
          {v > 0 ? '+' : ''}{v.toFixed(4)}
        </Text>
      ),
    },
    { title: '差异率', dataIndex: 'deltaPercent', width: 80,
      render: (v: number) => (
        <Tag size="small" color={Math.abs(v) > 5 ? 'red' : Math.abs(v) > 2 ? 'amber' : 'green'}>
          {v > 0 ? '+' : ''}{v.toFixed(1)}%
        </Tag>
      ),
    },
  ];

  // Line chart: annual cost variation
  const years = projectAnnualBreakdown.map((b: any) => `第${b.year}年`);
  const totalCosts = projectAnnualBreakdown.map((b: any) => b.totalCostPerUnit);
  const equipmentCosts = projectAnnualBreakdown.map((b: any) => b.equipmentPerUnit);
  const volumes = projectAnnualBreakdown.map((b: any) => b.volume);

  const lineOptions = {
    backgroundColor: 'transparent',
    title: { text: '年度单件成本变化趋势', textStyle: { color: 'var(--semi-color-text-0)', fontSize: 14 } },
    tooltip: { trigger: 'axis' as const },
    legend: { bottom: 0, textStyle: { color: 'var(--semi-color-text-0)' } },
    xAxis: { type: 'category' as const, data: years, axisLabel: { color: 'var(--semi-color-text-0)' } },
    yAxis: [
      { type: 'value' as const, name: '成本 (元/件)', axisLabel: { color: 'var(--semi-color-text-0)' }, splitLine: { lineStyle: { color: 'var(--semi-color-border)' } } },
      { type: 'value' as const, name: '产量', axisLabel: { color: 'var(--semi-color-text-0)' }, splitLine: { show: false } },
    ],
    series: [
      {
        name: '单件总成本',
        type: 'line',
        data: totalCosts.map((v: number) => v.toFixed(2)),
        smooth: true,
        lineStyle: { width: 3, color: '#6c7ee1' },
        itemStyle: { color: '#6c7ee1' },
        markLine: {
          data: [{ yAxis: lifecycleWeightedAvg, name: '加权平均' }],
          lineStyle: { type: 'dashed', color: '#ffca28' },
          label: { formatter: `加权平均: ${lifecycleWeightedAvg.toFixed(2)}`, color: '#ffca28' },
        },
      },
      {
        name: '设备分摊',
        type: 'line',
        data: equipmentCosts.map((v: number) => v.toFixed(4)),
        smooth: true,
        lineStyle: { width: 2, color: '#ef5350', type: 'dashed' as const },
        itemStyle: { color: '#ef5350' },
      },
      {
        name: '年产量',
        type: 'bar',
        yAxisIndex: 1,
        data: volumes,
        barWidth: 20,
        itemStyle: { color: 'rgba(108, 126, 225, 0.2)' },
      },
    ],
  };

  return (
    <div style={{ marginTop: 16 }}>
      {/* Summary cards */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card className='glass-card' style={{  }}>
            <Text size="small" style={{ color: 'var(--semi-color-text-2)' }}>生命周期加权平均</Text>
            <Title heading={3} style={{ margin: '8px 0 0', color: 'var(--semi-color-text-0)' }}>
              {'\u00A5'}{lifecycleWeightedAvg.toFixed(2)}
            </Title>
          </Card>
        </Col>
        <Col span={6}>
          <Card className='glass-card' style={{  }}>
            <Text size="small" style={{ color: 'var(--semi-color-text-2)' }}>第1年成本</Text>
            <Title heading={3} style={{ margin: '8px 0 0', color: 'var(--semi-color-text-0)' }}>
              {'\u00A5'}{(projectAnnualBreakdown[0]?.totalCostPerUnit ?? 0).toFixed(2)}
            </Title>
          </Card>
        </Col>
        <Col span={6}>
          <Card className='glass-card' style={{  }}>
            <Text size="small" style={{ color: 'var(--semi-color-text-2)' }}>线束数量</Text>
            <Title heading={3} style={{ margin: '8px 0 0', color: 'var(--semi-color-text-0)' }}>
              {annualizedHarnesses.length}
            </Title>
          </Card>
        </Col>
        <Col span={6}>
          <Card className='glass-card' style={{  }}>
            <Text size="small" style={{ color: 'var(--semi-color-text-2)' }}>年度数</Text>
            <Title heading={3} style={{ margin: '8px 0 0', color: 'var(--semi-color-text-0)' }}>
              {projectAnnualBreakdown.length}
            </Title>
          </Card>
        </Col>
      </Row>

      {/* Chart */}
      <Card className='glass-card' style={{  }}>
        <ReactECharts echarts={echarts} option={lineOptions} style={{ height: 380 }} theme="" />
      </Card>

      {/* Table */}
      <Card title="年度成本明细" className='glass-card' style={{  }}>
        <Table columns={tableColumns} dataSource={projectAnnualBreakdown} pagination={false} size="small"
          rowKey={(record: any) => String(record?.year ?? '')} />
      </Card>
    </div>
  );
}

// ── Chart builders ──
function buildWaterfallOptions(baselineResults: any, simulatedResults: any) {
  return {
    backgroundColor: 'transparent',
    title: { text: '成本变动因素分解', textStyle: { color: 'var(--semi-color-text-0)', fontSize: 14 } },
    tooltip: { trigger: 'axis' as const, axisPointer: { type: 'shadow' as const } },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category' as const, data: ['基准成本', '铜价影响', '铝价影响', '工时影响', '其他变动', '模拟成本'], axisLabel: { color: 'var(--semi-color-text-0)' } },
    yAxis: { type: 'value' as const, axisLabel: { color: 'var(--semi-color-text-0)' }, splitLine: { lineStyle: { color: 'var(--semi-color-border)' } } },
    series: [
      {
        name: 'Placeholder',
        type: 'bar',
        stack: 'Total',
        itemStyle: { borderColor: 'transparent', color: 'transparent' },
        emphasis: { itemStyle: { borderColor: 'transparent', color: 'transparent' } },
        data: (() => {
          const base = baselineResults.vehicleCost;
          const cuCostDiff = simulatedResults.harnesses.reduce((sum: number, h: any, i: number) => {
            const bh = baselineResults.harnesses[i];
            return sum + (h.materialBreakdown.cuCost - (bh ? bh.materialBreakdown.cuCost : 0)) * h.vehicleRatio;
          }, 0);
          const alCostDiff = simulatedResults.harnesses.reduce((sum: number, h: any, i: number) => {
            const bh = baselineResults.harnesses[i];
            return sum + (h.materialBreakdown.alCost - (bh ? bh.materialBreakdown.alCost : 0)) * h.vehicleRatio;
          }, 0);
          const laborMfgDiff = (simulatedResults.weightedLaborPlusMfg - baselineResults.weightedLaborPlusMfg);
          const p1 = base;
          const p2 = base + cuCostDiff;
          const p3 = p2 + alCostDiff;
          const p4 = p3 + laborMfgDiff;
          const p5 = simulatedResults.vehicleCost;
          return [0, Math.min(p1, p2), Math.min(p2, p3), Math.min(p3, p4), Math.min(p4, p5), 0];
        })(),
      },
      {
        name: '成本变动',
        type: 'bar',
        stack: 'Total',
        label: { show: true, position: 'inside', formatter: (params: any) => params.value !== 0 ? params.value.toFixed(2) : '' },
        data: (() => {
          const base = baselineResults.vehicleCost;
          const cuCostDiff = simulatedResults.harnesses.reduce((sum: number, h: any, i: number) => {
            const bh = baselineResults.harnesses[i];
            return sum + (h.materialBreakdown.cuCost - (bh ? bh.materialBreakdown.cuCost : 0)) * h.vehicleRatio;
          }, 0);
          const alCostDiff = simulatedResults.harnesses.reduce((sum: number, h: any, i: number) => {
            const bh = baselineResults.harnesses[i];
            return sum + (h.materialBreakdown.alCost - (bh ? bh.materialBreakdown.alCost : 0)) * h.vehicleRatio;
          }, 0);
          const laborMfgDiff = (simulatedResults.weightedLaborPlusMfg - baselineResults.weightedLaborPlusMfg);
          const otherDiff = (simulatedResults.vehicleCost - baselineResults.vehicleCost) - (cuCostDiff + alCostDiff + laborMfgDiff);
          return [
            { value: base, itemStyle: { color: '#6c7ee1' } },
            { value: cuCostDiff, itemStyle: { color: cuCostDiff >= 0 ? '#ef5350' : '#66bb6a' } },
            { value: alCostDiff, itemStyle: { color: alCostDiff >= 0 ? '#ef5350' : '#66bb6a' } },
            { value: laborMfgDiff, itemStyle: { color: laborMfgDiff >= 0 ? '#ef5350' : '#66bb6a' } },
            { value: otherDiff, itemStyle: { color: otherDiff >= 0 ? '#ef5350' : '#66bb6a' } },
            { value: simulatedResults.vehicleCost, itemStyle: { color: '#6c7ee1' } },
          ];
        })(),
      },
    ],
  };
}

function buildLifecycleOptions(baselineResults: any, simulatedResults: any, scenario: any, dropRate: number, volumeAdj: number, volumeSchedule: any[], baseVolume: number) {
  const lifecycleYears = 7;
  const years = Array.from({ length: lifecycleYears }, (_, i) => i + 1);
  return {
    backgroundColor: 'transparent',
    title: { text: '全生命周期成本走势 (LCC)', textStyle: { color: 'var(--semi-color-text-0)', fontSize: 14 } },
    tooltip: { trigger: 'axis' as const },
    legend: { bottom: 0, textStyle: { color: 'var(--semi-color-text-0)' } },
    xAxis: { type: 'category' as const, data: years.map(y => `第${y}年`), axisLabel: { color: 'var(--semi-color-text-0)' } },
    yAxis: [
      { type: 'value' as const, name: '单车成本 (元)', axisLabel: { color: 'var(--semi-color-text-0)' }, splitLine: { lineStyle: { color: 'var(--semi-color-border)' } } },
      { type: 'value' as const, name: '年产值 (万元)', axisLabel: { color: 'var(--semi-color-text-0)' }, splitLine: { show: false } },
    ],
    series: [
      {
        name: '基准单车成本',
        type: 'line',
        data: years.map(y => (baselineResults.vehicleCost * Math.pow(1 - (scenario.config.annualDropRate || 0) / 100, y - 1)).toFixed(2)),
        smooth: true,
      },
      {
        name: '模拟单车成本',
        type: 'line',
        data: years.map(y => (simulatedResults.vehicleCost * Math.pow(1 - dropRate / 100, y - 1)).toFixed(2)),
        smooth: true,
        lineStyle: { width: 3, color: '#ffca28' },
        itemStyle: { color: '#ffca28' },
      },
      {
        name: '模拟年产值',
        type: 'bar',
        yAxisIndex: 1,
        data: years.map((y, i) => {
          const yearBaseVol = volumeSchedule[i]?.volume ?? baseVolume;
          const yearVol = Math.round(yearBaseVol * (1 + volumeAdj / 100));
          const yearCost = simulatedResults.vehicleCost * Math.pow(1 - dropRate / 100, y - 1);
          return (yearCost * yearVol / 10000).toFixed(1);
        }),
        barWidth: 20,
        itemStyle: { color: 'rgba(108, 126, 225, 0.3)' },
      },
    ],
  };
}
