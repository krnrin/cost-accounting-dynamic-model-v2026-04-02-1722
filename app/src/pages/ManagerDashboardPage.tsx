import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Typography, Card, Table, Spin, Space, Tag, Empty, Row, Col, Tabs, TabPane } from '@douyinfe/semi-ui';
import ReactECharts from 'echarts-for-react/lib/core';
import echarts from '@/lib/echarts';
import { db, ProjectRecord } from '@/data/db';
import KpiCard from '@/components/KpiCard';
import { UniverSheet } from '@/components/UniverSheet';
import { computeHarnessCost, computeProjectFromHarnesses } from '@/engine/harness_costing';
import type { ProjectHarnessResult, HarnessResult, HarnessInput } from '@/types/harness';
import { computePortfolioSummary, computeProjectContribution, analyzeRiskExposure } from '@/engine/portfolio_analysis';
import type { ProjectSummaryInput, ProjectContribution, RiskExposure } from '@/engine/portfolio_analysis';
import { usePermission } from '@/hooks/usePermission';

const { Title, Text } = Typography;

interface ProjectSummary {
  project: ProjectRecord;
  harnessCount: number;
  summary: ProjectHarnessResult;
  results: HarnessResult[];
  harnessInputs: HarnessInput[];
}

export default function ManagerDashboardPage() {
  const navigate = useNavigate();
  const { can } = usePermission();
  const [loading, setLoading] = useState(true);
  const [dashboardView, setDashboardView] = useState<'table' | 'sheet'>('table');
  const [projectSummaries, setProjectSummaries] = useState<ProjectSummary[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const projects = await db.projects.toArray();
        const allHarnesses = await db.harnesses.toArray();
        
        const summaries = projects.map(proj => {
          const projHarnesses = allHarnesses.filter(h => h.projectId === proj.id);
          const results = projHarnesses.map(h => 
            computeHarnessCost(h.input, proj.config!.costRates, proj.config!.metalPrices)
          );
          const summary = computeProjectFromHarnesses(results);
          const harnessInputs = projHarnesses.map(h => h.input);
          return { project: proj, harnessCount: projHarnesses.length, summary, results, harnessInputs };
        });
        
        setProjectSummaries(summaries);
        if (summaries.length > 0) {
          setSelectedIds(summaries.slice(0, 5).map(s => s.project.id));
        }
      } catch (error) {
        console.error('Failed to load project data', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const selectedSummaries = useMemo(() => {
    return projectSummaries.filter(s => selectedIds.includes(s.project.id));
  }, [projectSummaries, selectedIds]);

  const handleProjectChartClick = useCallback((params: any) => {
    const projectId = params.data?.projectId;
    if (projectId) {
      navigate(`/project/${projectId}`);
    }
  }, [navigate]);

  // Global KPIs
  const kpis = useMemo(() => {
    const totalProjects = projectSummaries.length;
    const totalHarnesses = projectSummaries.reduce((sum, s) => sum + s.harnessCount, 0);
    const avgVehicleCost = totalProjects > 0 
      ? projectSummaries.reduce((sum, s) => sum + s.summary.vehicleCost, 0) / totalProjects 
      : 0;
    const totalProfit = projectSummaries.reduce((sum, s) => sum + s.summary.weightedProfit, 0);
    const totalCost = projectSummaries.reduce((sum, s) => sum + s.summary.vehicleCost, 0);
    const avgProfitMargin = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;

    const result = [
      { label: '活跃项目数', value: totalProjects, unit: '个' },
      { label: '总线束数', value: totalHarnesses, unit: '款' },
      { label: '平均单车成本', value: avgVehicleCost.toFixed(2), unit: '元' },
    ];
    if (can('profit')) {
      result.push({ label: '总利润率', value: avgProfitMargin.toFixed(2), unit: '%' });
    }
    return result;
  }, [projectSummaries, can]);

  // Portfolio analysis state
  const portfolioInputs: ProjectSummaryInput[] = useMemo(() => {
    return projectSummaries.map(s => ({
      projectId: s.project.id,
      projectName: s.project.meta.projectName,
      customer: s.project.meta.customer || '未知',
      annualVolume: s.project.config!.volumes?.[0]?.volume || 10000,
      projectResult: s.summary,
      harnessInputs: s.harnessInputs,
      costRates: s.project.config!.costRates,
      metalPrices: s.project.config!.metalPrices,
    }));
  }, [projectSummaries]);

  const portfolioSummary = useMemo(() => computePortfolioSummary(portfolioInputs), [portfolioInputs]);
  const contributions = useMemo(() => computeProjectContribution(portfolioInputs), [portfolioInputs]);

  const scenarios = [-0.2, -0.1, -0.05, 0.05, 0.1, 0.2];
  const riskData = useMemo(() => {
    const copper = scenarios.map(s => analyzeRiskExposure(portfolioInputs, 'copper', s));
    const aluminum = scenarios.map(s => analyzeRiskExposure(portfolioInputs, 'aluminum', s));
    return { copper, aluminum };
  }, [portfolioInputs]);

  const riskChartOption = useMemo(() => ({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { textStyle: { color: 'var(--semi-color-text-2)' }, bottom: 0 },
    grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
    xAxis: {
      type: 'category',
      data: scenarios.map(s => `${(s * 100).toFixed(0)}%`),
      axisLabel: { color: 'var(--semi-color-text-2)' }
    },
    yAxis: { 
      type: 'value', 
      name: '利润影响 (¥)',
      axisLabel: { color: 'var(--semi-color-text-2)' }, 
      splitLine: { lineStyle: { color: 'var(--semi-color-border)' } } 
    },
    series: [
      {
        name: '铜价波动',
        type: 'bar',
        data: riskData.copper.map((r: RiskExposure) => r.totalProfitDelta),
        itemStyle: { color: '#ef5350' }
      },
      {
        name: '铝价波动',
        type: 'bar',
        data: riskData.aluminum.map((r: RiskExposure) => r.totalProfitDelta),
        itemStyle: { color: '#42a5f5' }
      }
    ]
  }), [riskData]);

  const revenuePieOption = useMemo(() => ({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { textStyle: { color: 'var(--semi-color-text-2)' }, bottom: 0 },
    series: [{
      name: '产值占比',
      type: 'pie',
      radius: ['40%', '70%'],
      data: contributions.map((c: ProjectContribution) => ({ name: c.projectName, value: c.revenue })),
      label: { color: 'var(--semi-color-text-2)' }
    }]
  }), [contributions]);

  const profitPieOption = useMemo(() => ({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { textStyle: { color: 'var(--semi-color-text-2)' }, bottom: 0 },
    series: [{
      name: '利润占比',
      type: 'pie',
      radius: ['40%', '70%'],
      data: contributions.map((c: ProjectContribution) => ({ name: c.projectName, value: c.profit })),
      label: { color: 'var(--semi-color-text-2)' }
    }]
  }), [contributions]);

  const costChartOption = useMemo(() => {
    if (selectedSummaries.length === 0) return {};
    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { textStyle: { color: 'var(--semi-color-text-2)' }, bottom: 0 },
      grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
      xAxis: {
        type: 'category',
        data: selectedSummaries.map(s => s.project.meta.projectCode),
        axisLabel: { color: 'var(--semi-color-text-2)' }
      },
      yAxis: { type: 'value', axisLabel: { color: 'var(--semi-color-text-2)' }, splitLine: { lineStyle: { color: 'var(--semi-color-border)' } } },
      series: [
        { 
          name: '材料', 
          type: 'bar', 
          stack: 'total', 
          data: selectedSummaries.map(s => ({ 
            value: parseFloat(s.summary.weightedMaterial.toFixed(2)), 
            projectId: s.project.id 
          })) 
        },
        { 
          name: '人工', 
          type: 'bar', 
          stack: 'total', 
          data: selectedSummaries.map(s => ({ 
            value: parseFloat(s.summary.weightedLabor.toFixed(2)), 
            projectId: s.project.id 
          })) 
        },
        { 
          name: '制造', 
          type: 'bar', 
          stack: 'total', 
          data: selectedSummaries.map(s => ({ 
            value: parseFloat(s.summary.weightedMfg.toFixed(2)), 
            projectId: s.project.id 
          })) 
        },
        ...(can('mgmtFee') ? [{ 
          name: '管理', 
          type: 'bar' as const, 
          stack: 'total', 
          data: selectedSummaries.map(s => ({ 
            value: parseFloat(s.summary.weightedMgmtFee.toFixed(2)), 
            projectId: s.project.id 
          })) 
        }] : []),
        ...(can('profit') ? [{ 
          name: '利润', 
          type: 'bar' as const, 
          stack: 'total', 
          data: selectedSummaries.map(s => ({ 
            value: parseFloat(s.summary.weightedProfit.toFixed(2)), 
            projectId: s.project.id 
          })) 
        }] : []),
        { 
          name: '包装', 
          type: 'bar', 
          stack: 'total', 
          data: selectedSummaries.map(s => ({ 
            value: parseFloat(s.summary.weightedPack.toFixed(2)), 
            projectId: s.project.id 
          })) 
        },
        { 
          name: '运输', 
          type: 'bar', 
          stack: 'total', 
          data: selectedSummaries.map(s => ({ 
            value: parseFloat(s.summary.weightedFreight.toFixed(2)), 
            projectId: s.project.id 
          })) 
        },
      ]
    };
  }, [selectedSummaries]);

  const profitTrendOption = useMemo(() => {
    if (selectedSummaries.length === 0) return {};
    const years = [1, 2, 3, 4, 5, 6, 7];
    const series = selectedSummaries.map(s => {
      const volumeMap = new Map(s.project.config!.volumes?.map(v => [v.year, v.volume]) || []);
      const data = years.map(y => {
        const vol = volumeMap.get(y) || 0;
        return (s.summary.weightedProfit * vol).toFixed(0);
      });
      return {
        name: s.project.meta.projectCode,
        type: 'line',
        smooth: true,
        data
      };
    });

    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' },
      legend: { textStyle: { color: 'var(--semi-color-text-2)' }, bottom: 0 },
      grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: years.map(y => `Year ${y}`),
        axisLabel: { color: 'var(--semi-color-text-2)' }
      },
      yAxis: { type: 'value', axisLabel: { color: 'var(--semi-color-text-2)' }, splitLine: { lineStyle: { color: 'var(--semi-color-border)' } } },
      series
    };
  }, [selectedSummaries]);

  const customerPieOption = useMemo(() => {
    if (projectSummaries.length === 0) return {};
    const customerDataMap = new Map<string, number>();
    projectSummaries.forEach(s => {
      const customer = s.project.meta.customer || '未知客户';
      const totalVol = s.project.config!.volumes?.reduce((sum, v) => sum + v.volume, 0) || 0;
      const revenue = s.summary.vehicleCost * totalVol;
      customerDataMap.set(customer, (customerDataMap.get(customer) || 0) + revenue);
    });

    const data = Array.from(customerDataMap.entries()).map(([name, value]) => ({ name, value }));

    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: { textStyle: { color: 'var(--semi-color-text-2)' }, orient: 'vertical', left: 'left' },
      series: [
        {
          name: '客户占比',
          type: 'pie',
          radius: '50%',
          data,
          emphasis: {
            itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.5)' }
          },
          label: { color: 'var(--semi-color-text-2)' }
        }
      ]
    };
  }, [projectSummaries]);

  const columns = useMemo(() => {
    const cols: any[] = [
      {
        title: '项目编号',
        render: (_text: any, record: ProjectSummary) => (
          <Text link onClick={() => navigate(`/project/${record.project.id}`)}>{record.project.meta.projectCode}</Text>
        ),
      },
      { title: '项目名称', render: (_text: any, record: ProjectSummary) => record.project.meta.projectName },
      { title: '客户', render: (_text: any, record: ProjectSummary) => record.project.meta.customer },
      { title: '线束数', dataIndex: 'harnessCount' },
      { 
        title: '单车成本', 
        render: (_text: any, record: ProjectSummary) => `¥${record.summary.vehicleCost.toFixed(2)}`
      },
      { 
        title: '材料占比', 
        render: (_text: any, record: ProjectSummary) => {
          const ratio = record.summary.vehicleCost > 0 
            ? (record.summary.weightedMaterial / record.summary.vehicleCost) * 100 
            : 0;
          return `${ratio.toFixed(1)}%`;
        }
      },
    ];
    if (can('profitRate')) {
      cols.push({ 
        title: '利润率', 
        render: (_text: any, record: ProjectSummary) => {
          const ratio = record.summary.vehicleCost > 0 
            ? (record.summary.weightedProfit / record.summary.vehicleCost) * 100 
            : 0;
          return `${ratio.toFixed(1)}%`;
        }
      });
    }
    cols.push(
      { 
        title: '状态', 
        render: (_text: any, record: ProjectSummary) => {
          const status = record.project.meta.status;
          const colors: Record<string, string> = {
            draft: 'grey',
            quoted: 'blue',
            awarded: 'green',
            production: 'cyan',
            eol: 'volcano'
          };
          const labels: Record<string, string> = {
            draft: '草稿',
            quoted: '已报价',
            awarded: '已中标',
            production: '量产',
            eol: '退市'
          };
          return <Tag color={(colors[status] || 'grey') as any}>{labels[status] || status}</Tag>;
        }
      },
      { title: '最后更新', render: (_text: any, record: ProjectSummary) => record ? new Date(record.project.meta.updatedAt).toLocaleDateString() : '-' },
    );
    return cols;
  }, [can, navigate]);

  const projectSheetData = useMemo(() => {
    if (projectSummaries.length === 0) return null;
    
    const header: (string | number | null)[] = [
      '项目编号', '项目名称', '客户', '线束数', '单车成本(元)',
      '材料占比(%)', ...(can('profitRate') ? ['利润率(%)'] : []),
      '状态', '最后更新'
    ];
    
    const statusLabels: Record<string, string> = {
      draft: '草稿', quoted: '已报价', awarded: '已中标',
      production: '量产', eol: '退市'
    };
    
    const rows = projectSummaries.map(s => {
      const ratio = s.summary.vehicleCost > 0
        ? ((s.summary.weightedMaterial / s.summary.vehicleCost) * 100).toFixed(1)
        : '0.0';
      const profitRatio = s.summary.vehicleCost > 0
        ? ((s.summary.weightedProfit / s.summary.vehicleCost) * 100).toFixed(1)
        : '0.0';
      
      const row: (string | number | null)[] = [
        s.project.meta.projectCode,
        s.project.meta.projectName,
        s.project.meta.customer || '',
        s.harnessCount,
        parseFloat(s.summary.vehicleCost.toFixed(2)),
        parseFloat(ratio),
        ...(can('profitRate') ? [parseFloat(profitRatio)] : []),
        statusLabels[s.project.meta.status] || s.project.meta.status,
        new Date(s.project.meta.updatedAt).toLocaleDateString(),
      ];
      return row;
    });
    
    return [header, ...rows];
  }, [projectSummaries, can]);

  const rowSelection = {
    selectedRowKeys: selectedIds,
    onChange: (selectedRowKeys?: (string | number)[]) => {
      setSelectedIds((selectedRowKeys || []) as string[]);
    },
  };

  const contributionColumns = useMemo(() => [
    { title: '项目名称', dataIndex: 'projectName' },
    { title: '客户', dataIndex: 'customer' },
    { title: '年产值(¥)', dataIndex: 'revenue', render: (val: number) => val.toLocaleString('zh-CN', { maximumFractionDigits: 0 }) },
    { title: '产值占比(%)', dataIndex: 'revenueShare', render: (val: number) => `${(val * 100).toFixed(1)}%` },
    { title: '年利润(¥)', dataIndex: 'profit', render: (val: number) => val.toLocaleString('zh-CN', { maximumFractionDigits: 0 }) },
    { title: '利润占比(%)', dataIndex: 'profitShare', render: (val: number) => `${(val * 100).toFixed(1)}%` },
    { title: '边际贡献率(%)', dataIndex: 'marginalContributionRate', render: (val: number) => `${(val * 100).toFixed(1)}%` },
    { title: '材料占比(%)', dataIndex: 'materialRatio', render: (val: number) => `${(val * 100).toFixed(1)}%` },
    { title: '利润率(%)', dataIndex: 'profitRate', render: (val: number) => `${(val * 100).toFixed(1)}%` },
  ], []);

  const riskImpactColumns = useMemo(() => [
    { title: '项目名称', dataIndex: 'projectName' },
    { title: '铜价 +10% 影响 (¥)', render: (_: any, record: ProjectContribution) => {
      const projRisk = riskData.copper[4]?.projectImpacts.find(p => p.projectId === record.projectId);
      return projRisk?.profitDelta.toLocaleString('zh-CN', { maximumFractionDigits: 0 }) || '0';
    }},
    { title: '铜价 -10% 影响 (¥)', render: (_: any, record: ProjectContribution) => {
      const projRisk = riskData.copper[1]?.projectImpacts.find(p => p.projectId === record.projectId);
      return projRisk?.profitDelta.toLocaleString('zh-CN', { maximumFractionDigits: 0 }) || '0';
    }},
    { title: '铝价 +10% 影响 (¥)', render: (_: any, record: ProjectContribution) => {
      const projRisk = riskData.aluminum[4]?.projectImpacts.find(p => p.projectId === record.projectId);
      return projRisk?.profitDelta.toLocaleString('zh-CN', { maximumFractionDigits: 0 }) || '0';
    }},
    { title: '铝价 -10% 影响 (¥)', render: (_: any, record: ProjectContribution) => {
      const projRisk = riskData.aluminum[1]?.projectImpacts.find(p => p.projectId === record.projectId);
      return projRisk?.profitDelta.toLocaleString('zh-CN', { maximumFractionDigits: 0 }) || '0';
    }},
  ], [riskData]);

  return (
    <div className="page-container" style={{ maxWidth: 1400, margin: '0 auto' }}>
      <Title heading={2} style={{ marginBottom: 24, color: 'var(--semi-color-text-0)' }}>管理仪表盘</Title>
      
      {loading ? (
        <div style={{ textAlign: 'center', padding: '100px 0' }}><Spin size="large" /></div>
      ) : (
        <Tabs type="line" style={{ width: '100%' }}>
          <TabPane tab="仪表盘" itemKey="dashboard">
            <Space vertical align="start" spacing="loose" style={{ width: '100%', marginTop: 16 }}>
              {/* KPI Cards */}
              <div className="kpi-grid" style={{ width: '100%' }}>
                {kpis.map((kpi, index) => (
                  <KpiCard key={index} label={kpi.label} value={kpi.value} unit={kpi.unit} />
                ))}
              </div>

              {/* Project Table */}
              <Card
                title="项目概览"
                className="data-table"
                style={{ width: '100%' }}
                headerStyle={{ borderBottom: '1px solid var(--semi-color-border)' }}
                headerExtraContent={
                  <Tabs
                    type="button"
                    size="small"
                    activeKey={dashboardView}
                    onChange={(key) => setDashboardView(key as 'table' | 'sheet')}
                    style={{ marginBottom: -12 }}
                  >
                    <TabPane tab="表格" itemKey="table" />
                    <TabPane tab="电子表格" itemKey="sheet" />
                  </Tabs>
                }
              >
                {dashboardView === 'table' ? (
                  <Table
                    columns={columns}
                    dataSource={projectSummaries}
                    rowKey={record => record?.project?.id || ''}
                    rowSelection={rowSelection}
                    pagination={false}
                    size="small"
                    style={{ background: 'transparent' }}
                  />
                ) : (
                  projectSheetData ? (
                    <UniverSheet
                      data={projectSheetData}
                      readOnly={true}
                      height={Math.min(500, 40 + projectSheetData.length * 28)}
                      columnWidths={[120, 160, 100, 80, 120, 100, ...(can('profitRate') ? [100] : []), 80, 120]}
                      freezeRows={1}
                    />
                  ) : (
                    <Empty description="暂无项目数据" />
                  )
                )}
              </Card>

              {/* Charts Row 1 */}
              <Row gutter={16} style={{ width: '100%' }}>
                <Col span={12}>
                  <Card 
                    title="成本结构对比 (选定项目)" 
                    className='glass-card' style={{ border: 'none' }}
                    headerStyle={{ borderBottom: '1px solid var(--semi-color-border)' }}
                  >
                    {selectedSummaries.length > 0 ? (
                      <ReactECharts 
                        echarts={echarts} 
                        option={costChartOption} 
                        style={{ height: 400 }} 
                        theme="" 
                        onEvents={{ click: handleProjectChartClick }}
                      />
                    ) : (
                      <Empty description="请在上方表格选择项目进行对比" />
                    )}
                  </Card>
                </Col>
                <Col span={12}>
                  <Card 
                    title="利润趋势 (选定项目)" 
                    className='glass-card' style={{ border: 'none' }}
                    headerStyle={{ borderBottom: '1px solid var(--semi-color-border)' }}
                  >
                    {selectedSummaries.length > 0 ? (
                      <ReactECharts echarts={echarts} option={profitTrendOption} style={{ height: 400 }} theme="" />
                    ) : (
                      <Empty description="请在上方表格选择项目进行对比" />
                    )}
                  </Card>
                </Col>
              </Row>

              {/* Charts Row 2 */}
              <Row gutter={16} style={{ width: '100%' }}>
                <Col span={24}>
                  <Card
                    title="客户营收占比"
                    className='glass-card' style={{ border: 'none' }}
                    headerStyle={{ borderBottom: '1px solid var(--semi-color-border)' }}
                  >
                    {projectSummaries.length > 0 ? (
                      <ReactECharts echarts={echarts} option={customerPieOption} style={{ height: 400 }} theme="" />
                    ) : (
                      <Empty description="暂无项目数据" />
                    )}
                  </Card>
                </Col>
              </Row>
            </Space>
          </TabPane>
          <TabPane tab="组合分析" itemKey="portfolio">
            <Space vertical align="start" spacing="loose" style={{ width: '100%', marginTop: 16 }}>
              {/* Portfolio KPI Cards */}
              <div className="kpi-grid" style={{ width: '100%' }}>
                <KpiCard label="总产值" value={portfolioSummary.totalRevenue.toLocaleString('zh-CN', { maximumFractionDigits: 0 })} unit="¥" />
                <KpiCard label="总利润" value={portfolioSummary.totalProfit.toLocaleString('zh-CN', { maximumFractionDigits: 0 })} unit="¥" />
                <KpiCard label="加权利润率" value={(portfolioSummary.weightedProfitRate * 100).toFixed(1)} unit="%" />
                <KpiCard label="材料成本占比" value={(portfolioSummary.weightedMaterialRatio * 100).toFixed(1)} unit="%" />
              </div>

              {/* Project Contribution Table */}
              <Card title="项目贡献度分析" className="glass-card" style={{ width: '100%' }}>
                <Table 
                  columns={contributionColumns} 
                  dataSource={contributions} 
                  pagination={false} 
                  size="small"
                  rowKey="projectId"
                />
              </Card>

              {/* Contribution Pie Charts */}
              <Row gutter={16} style={{ width: '100%' }}>
                <Col span={12}>
                  <Card title="产值占比" className='glass-card' style={{ border: 'none' }}>
                    <ReactECharts echarts={echarts} option={revenuePieOption} style={{ height: 400 }} theme="" />
                  </Card>
                </Col>
                <Col span={12}>
                  <Card title="利润占比" className='glass-card' style={{ border: 'none' }}>
                    <ReactECharts echarts={echarts} option={profitPieOption} style={{ height: 400 }} theme="" />
                  </Card>
                </Col>
              </Row>

              {/* Metal Risk Exposure */}
              <Card className="glass-card" title="金属价格风险敞口分析" style={{ width: '100%' }}>
                <ReactECharts echarts={echarts} option={riskChartOption} style={{ height: 400 }} theme="" />
                <div style={{ marginTop: 24 }}>
                  <Text strong style={{ marginBottom: 12, display: 'block' }}>项目级影响汇总 (±10% 场景)</Text>
                  <Table 
                    columns={riskImpactColumns} 
                    dataSource={contributions} 
                    pagination={false} 
                    size="small"
                    rowKey="projectId"
                  />
                </div>
              </Card>
            </Space>
          </TabPane>
        </Tabs>
      )}
    </div>
  );
}
