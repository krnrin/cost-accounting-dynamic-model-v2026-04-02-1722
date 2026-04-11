import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Empty, Progress, Space, Spin, Table, Tag, Tabs, TabPane, Typography } from '@douyinfe/semi-ui';
import { IconArrowRight, IconAlertTriangle } from '@douyinfe/semi-icons';
import KpiCard from '@/components/KpiCard';
import {
  fetchManagerAlertSummary,
  fetchManagerAnomalySummary,
  fetchManagerOverview,
  fetchManagerProfitSummary,
  fetchManagerRecoverySummary,
  fetchManagerScenarioComparison,
  type ManagerAlertSummary,
  type ManagerAnomalySummary,
  type ManagerOverview,
  type ManagerProfitSummary,
  type ManagerRecoverySummary,
  type ManagerScenarioComparison,
} from '@/lib/managerDashboardApi';

const { Title, Text } = Typography;

function formatCurrency(value: number) {
  return `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

const statusColorMap: Record<string, 'blue' | 'green' | 'red' | 'cyan' | 'grey' | 'orange'> = {
  active: 'blue',
  draft: 'grey',
  quoted: 'blue',
  awarded: 'green',
  production: 'cyan',
  eol: 'red',
  frozen: 'orange',
  released: 'green',
};

export default function ManagerDashboardPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<ManagerOverview | null>(null);
  const [profitSummary, setProfitSummary] = useState<ManagerProfitSummary[]>([]);
  const [recoverySummary, setRecoverySummary] = useState<ManagerRecoverySummary[]>([]);
  const [alertSummary, setAlertSummary] = useState<ManagerAlertSummary[]>([]);
  const [scenarioComparison, setScenarioComparison] = useState<ManagerScenarioComparison[]>([]);
  const [anomalySummary, setAnomalySummary] = useState<ManagerAnomalySummary[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [overviewData, profitData, recoveryData, alertData, scenarioData, anomalyData] = await Promise.all([
          fetchManagerOverview(),
          fetchManagerProfitSummary(),
          fetchManagerRecoverySummary(),
          fetchManagerAlertSummary(),
          fetchManagerScenarioComparison(),
          fetchManagerAnomalySummary(),
        ]);
        setOverview(overviewData);
        setProfitSummary(profitData);
        setRecoverySummary(recoveryData);
        setAlertSummary(alertData);
        setScenarioComparison(scenarioData);
        setAnomalySummary(anomalyData);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const topRiskProjects = useMemo(() => {
    return [...alertSummary]
      .sort((a, b) => b.activeAlertCount - a.activeAlertCount)
      .slice(0, 5);
  }, [alertSummary]);

  const kpis = useMemo(() => {
    if (!overview) return [];
    return [
      { label: '项目数', value: overview.projectCount, unit: '' },
      { label: '场景数', value: overview.scenarioCount, unit: '' },
      { label: '总利润差异', value: overview.totalProfitGap.toFixed(2), unit: '' },
      { label: '回收进度', value: (overview.recoveryRate * 100).toFixed(1), unit: '%' },
      { label: '活跃预警', value: overview.activeAlertCount, unit: '' },
    ];
  }, [overview]);

  const overviewColumns = [
    {
      title: '项目',
      dataIndex: 'projectName',
      render: (_: string, record: ManagerOverview['projects'][number]) => (
        <Button theme="borderless" style={{ padding: 0, height: 'auto', fontWeight: 700 }} onClick={() => navigate(`/project/${record.projectId}`)}>
          {record.projectCode} / {record.projectName}
        </Button>
      ),
    },
    { title: '客户', dataIndex: 'customer' },
    { title: '状态', dataIndex: 'status', render: (value: string) => <Tag color={statusColorMap[value] || 'grey'}>{value}</Tag> },
    { title: '线束', dataIndex: 'harnessCount', width: 90 },
    { title: '场景', dataIndex: 'scenarioCount', width: 90 },
    { title: '报价', dataIndex: 'quoteCount', width: 90 },
    { title: '利润差异', dataIndex: 'totalProfitGap', render: (value: number) => formatCurrency(value) },
    { title: '回收进度', dataIndex: 'recoveryRate', render: (value: number) => formatPercent(value) },
    { title: '活跃预警', dataIndex: 'activeAlertCount', width: 110 },
  ];

  const profitColumns = [
    { title: '项目', dataIndex: 'projectName' },
    { title: '客户', dataIndex: 'customer' },
    { title: '收入', dataIndex: 'revenue', render: (value: number) => formatCurrency(value) },
    { title: '内部成本', dataIndex: 'internalCost', render: (value: number) => formatCurrency(value) },
    { title: '利润差异', dataIndex: 'profitGap', render: (value: number) => formatCurrency(value) },
    { title: '利润率', dataIndex: 'profitRate', render: (value: number) => formatPercent(value) },
  ];

  const recoveryColumns = [
    { title: '项目', dataIndex: 'projectName' },
    { title: '总分摊', dataIndex: 'totalAllocationAmount', render: (value: number) => formatCurrency(value) },
    { title: '已回收', dataIndex: 'totalRecoveredAmount', render: (value: number) => formatCurrency(value) },
    { title: '待回收', dataIndex: 'remainingRecoveryAmount', render: (value: number) => formatCurrency(value) },
    {
      title: '进度',
      dataIndex: 'recoveryRate',
      render: (value: number) => <Progress percent={Math.round(value * 100)} showInfo />,
    },
  ];

  const alertColumns = [
    { title: '项目', dataIndex: 'projectName' },
    { title: '预警总数', dataIndex: 'alertCount', width: 120 },
    { title: '活跃预警', dataIndex: 'activeAlertCount', width: 120 },
  ];

  const scenarioColumns = [
    { title: '项目', dataIndex: 'projectName' },
    { title: '场景', dataIndex: 'scenarioName' },
    { title: '类型', dataIndex: 'scenarioType' },
    { title: '状态', dataIndex: 'scenarioStatus', render: (value: string) => <Tag color={statusColorMap[value] || 'grey'}>{value}</Tag> },
    { title: '生命周期(年)', dataIndex: 'lifecycleYears', width: 120 },
    { title: '基线产量', dataIndex: 'volume', width: 120 },
  ];

  const anomalyColumns = [
    { title: '项目', dataIndex: 'projectName' },
    { title: '设变类型', dataIndex: 'changeType' },
    { title: '状态', dataIndex: 'status', width: 100 },
    { title: '成本影响', dataIndex: 'costImpact', render: (value: number) => formatCurrency(value) },
    { title: '残余材料影响', dataIndex: 'residualImpact', render: (value: number) => formatCurrency(value) },
    { title: '总影响', dataIndex: 'totalImpact', render: (value: number) => formatCurrency(value) },
  ];

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 120 }}><Spin size="large" /></div>;
  }

  if (!overview) {
    return <Empty description="暂无管理决策数据" />;
  }

  return (
    <div className="page-container" style={{ maxWidth: 1440, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 24 }}>
        <div>
          <Title heading={3} style={{ margin: 0 }}>管理决策舱</Title>
          <Text style={{ color: 'var(--semi-color-text-2)' }}>跨项目利润、回收、预警与异常总览</Text>
        </div>
        <Button icon={<IconArrowRight />} onClick={() => navigate('/alerts')}>查看全局预警</Button>
      </div>

      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        {kpis.map((item) => (
          <KpiCard key={item.label} label={item.label} value={item.value} unit={item.unit} />
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, marginBottom: 24 }}>
        <Card className="glass-card" title="项目总览">
          <Table columns={overviewColumns} dataSource={overview.projects} rowKey="projectId" pagination={{ pageSize: 8 }} />
        </Card>
        <Card className="glass-card" title="高风险项目">
          {topRiskProjects.length === 0 ? (
            <Empty description="暂无活跃预警" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {topRiskProjects.map((project) => (
                <div key={project.projectId} style={{ border: '1px solid var(--semi-color-border)', borderRadius: 12, padding: 12 }}>
                  <Space align="start">
                    <IconAlertTriangle style={{ color: 'var(--semi-color-warning)' }} />
                    <div>
                      <Text strong>{project.projectCode} / {project.projectName}</Text>
                      <Text style={{ display: 'block', marginTop: 4, color: 'var(--semi-color-text-2)' }}>
                        活跃预警 {project.activeAlertCount} / 总预警 {project.alertCount}
                      </Text>
                    </div>
                  </Space>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="glass-card" style={{ marginBottom: 24 }}>
        <Tabs type="line">
          <TabPane tab="利润汇总" itemKey="profit">
            <Table columns={profitColumns} dataSource={profitSummary} rowKey="projectId" pagination={{ pageSize: 8 }} />
          </TabPane>
          <TabPane tab="回收汇总" itemKey="recovery">
            <Table columns={recoveryColumns} dataSource={recoverySummary} rowKey="projectId" pagination={{ pageSize: 8 }} />
          </TabPane>
          <TabPane tab="预警汇总" itemKey="alerts">
            <Table columns={alertColumns} dataSource={alertSummary} rowKey="projectId" pagination={{ pageSize: 8 }} />
          </TabPane>
          <TabPane tab="场景对比" itemKey="scenarios">
            <Table columns={scenarioColumns} dataSource={scenarioComparison} rowKey="scenarioId" pagination={{ pageSize: 8 }} />
          </TabPane>
          <TabPane tab="异常汇总" itemKey="anomalies">
            <Table columns={anomalyColumns} dataSource={anomalySummary} rowKey="changeId" pagination={{ pageSize: 8 }} empty={<Empty description="暂无成本异常" />} />
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
}
