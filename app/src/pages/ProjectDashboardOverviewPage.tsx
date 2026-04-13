import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Empty, Progress, Space, Spin, Tag, Typography } from '@douyinfe/semi-ui';
import { IconArrowLeft, IconBranch, IconGridView, IconList } from '@douyinfe/semi-icons';
import { apiClient } from '@/lib/apiClient';
import { db, type ProjectRecord } from '@/data/db';
import { useProjectStore } from '@/store/projectStore';
import { VersionPanel } from '@/components/VersionPanel';
import { AuditLogPanel } from '@/components/AuditLogPanel';

const { Title, Text } = Typography;

interface ScenarioSummary {
  id: string;
  name: string;
  type: string;
  status: string;
  lifecycleYears: number;
  createdAt: string;
}

interface ProjectDashboardData {
  id: string;
  projectCode: string;
  projectName: string;
  customer: string;
  platform?: string | null;
  status: string;
  harnessCount: number;
  scenarioCount: number;
  quoteCount: number;
  versionCount: number;
  latestQuoteTotal: number | null;
  internalCostBaseline: number | null;
  latestProfitGap: number | null;
  totalAllocationAmount: number;
  totalRecoveredAmount: number;
  recoveryRate: number;
  updatedAt: string;
  scenarios: ScenarioSummary[];
  latestQuote: {
    id: string;
    version: string;
    template: string;
    status: string;
    effectivePrice: number | null;
    effectivePriceMode: string;
    updatedAt: string;
  } | null;
}

interface ProjectVersionSummary {
  id: string;
  versionNumber: number;
  label: string;
  status: string;
  createdAt: string;
}

interface ProjectAuditLogSummary {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  createdAt: string;
  user?: {
    id: string;
    name?: string | null;
    email?: string | null;
  } | null;
}

const scenarioTypeLabels: Record<string, string> = {
  initial_quote: '初始报价',
  fixed_point: '定点',
  change: '设变',
  annual_drop: '年降',
};

const statusColorMap: Record<string, 'blue' | 'green' | 'red' | 'cyan' | 'grey' | 'orange'> = {
  draft: 'grey',
  quoted: 'blue',
  awarded: 'green',
  production: 'cyan',
  eol: 'red',
  active: 'blue',
  released: 'green',
  frozen: 'orange',
  published: 'green',
};

function formatCurrency(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '—';
  }
  return `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('zh-CN');
}

export default function ProjectDashboardOverviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setCurrentProject } = useProjectStore();
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [dashboard, setDashboard] = useState<ProjectDashboardData | null>(null);
  const [versions, setVersions] = useState<ProjectVersionSummary[]>([]);
  const [auditLogs, setAuditLogs] = useState<ProjectAuditLogSummary[]>([]);

  useEffect(() => {
    async function load() {
      if (!id) return;
      setLoading(true);
      try {
        const localProject = await db.projects.get(id);
        if (localProject) {
          setProject(localProject);
          setCurrentProject(localProject.id, localProject.meta.projectName);
        }
        try {
          const [dashboardData, versionData, auditData] = await Promise.all([
            apiClient<ProjectDashboardData>(`/projects/${id}/dashboard`),
            apiClient<ProjectVersionSummary[]>(`/versions/project/${id}`),
            apiClient<ProjectAuditLogSummary[]>(`/projects/${id}/audit-logs`),
          ]);
          setDashboard(dashboardData);
          setVersions(versionData);
          setAuditLogs(auditData);
          if (!localProject) {
            setCurrentProject(dashboardData.id, dashboardData.projectName);
          }
        } catch {
          if (localProject) {
            const [localScenarios, localQuotes, localVersions] = await Promise.all([
              db.scenarios.where('projectId').equals(id).toArray(),
              db.quotes.where('projectId').equals(id).toArray(),
              db.versions.where('projectId').equals(id).toArray(),
            ]);
            setDashboard({
              id: localProject.id,
              projectCode: localProject.meta.projectCode,
              projectName: localProject.meta.projectName,
              customer: localProject.meta.customer,
              platform: localProject.meta.platform,
              status: localProject.meta.status,
              harnessCount: 0,
              scenarioCount: localScenarios.length,
              quoteCount: localQuotes.length,
              versionCount: localVersions.length,
              latestQuoteTotal: null,
              internalCostBaseline: null,
              latestProfitGap: null,
              totalAllocationAmount: 0,
              totalRecoveredAmount: 0,
              recoveryRate: 0,
              updatedAt: localProject.meta.updatedAt,
              scenarios: localScenarios.map((s) => ({
                id: s.id,
                name: s.scenarioName,
                type: s.scenarioType,
                status: s.status || 'draft',
                lifecycleYears: s.lifecycleYears,
                createdAt: s.createdAt,
              })),
              latestQuote: null,
            });
            setVersions(localVersions.map((v) => ({
              id: v.id,
              versionNumber: v.versionNumber,
              label: v.label,
              status: v.status,
              createdAt: v.createdAt,
            })));
            setAuditLogs([]);
          }
        }
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [id, setCurrentProject]);

  const sortedScenarios = useMemo(() => {
    return [...(dashboard?.scenarios ?? [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [dashboard?.scenarios]);

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 120 }}><Spin size="large" /></div>;
  }

  if (!dashboard) {
    return <Empty description="项目不存在" />;
  }

  const projectName = project?.meta.projectName ?? dashboard.projectName;
  const moduleCards = [
    {
      key: 'dashboard',
      title: '场景列表',
      icon: <IconBranch />,
      description: '查看项目下全部场景并继续进入场景级工作台',
      onClick: () => navigate(`/project/${dashboard.id}/scenarios`),
    },
    {
      key: 'quote',
      title: '报价工作台',
      icon: <IconList />,
      description: '进入最近场景的报价与利润分析',
      onClick: () => {
        const target = sortedScenarios[0]?.id;
        if (target) navigate(`/project/${dashboard.id}/s/${target}/quote`);
      },
      disabled: sortedScenarios.length === 0,
    },
    {
      key: 'bom',
      title: 'BOM 工作簿',
      icon: <IconGridView />,
      description: '查看最近场景的 BOM 数据与汇总',
      onClick: () => {
        const target = sortedScenarios[0]?.id;
        if (target) navigate(`/project/${dashboard.id}/s/${target}/bom-workbook`);
      },
      disabled: sortedScenarios.length === 0,
    },
    {
      key: 'alloc',
      title: '分摊回收',
      icon: <IconBranch />,
      description: '查看一次性费用与回收进度',
      onClick: () => {
        const target = sortedScenarios[0]?.id;
        if (target) navigate(`/project/${dashboard.id}/s/${target}/alloc`);
      },
      disabled: sortedScenarios.length === 0,
    },
    {
      key: 'pricing',
      title: '价格工作台',
      icon: <IconList />,
      description: '进入最近场景的连接器、导线与开发件价格台账',
      onClick: () => {
        const target = sortedScenarios[0]?.id;
        if (target) navigate(`/project/${dashboard.id}/s/${target}/pricing/connectors`);
      },
      disabled: sortedScenarios.length === 0,
    },
    {
      key: 'governance',
      title: '版本与审计',
      icon: <IconList />,
      description: '查看最近版本、发布快照和审计记录',
      onClick: () => {
        document.getElementById('governance-summary')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      },
    },
  ];

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, padding: '16px 0' }}>
        <Button icon={<IconArrowLeft />} aria-label="返回" theme="borderless" onClick={() => navigate('/')} />
        <div>
          <Title heading={4} style={{ margin: 0 }}>{projectName}</Title>
          <Text style={{ color: 'var(--semi-color-text-2)' }}>
            {dashboard.projectCode} / {dashboard.customer}{dashboard.platform ? ` / ${dashboard.platform}` : ''}
          </Text>
        </div>
      </div>

      <Card className="glass-card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <Space>
              <Tag color={statusColorMap[dashboard.status] || 'grey'}>{dashboard.status}</Tag>
              <Tag color="blue">场景 {dashboard.scenarioCount}</Tag>
              <Tag color="cyan">线束 {dashboard.harnessCount}</Tag>
              <Tag color="green">报价 {dashboard.quoteCount}</Tag>
              <Tag color="purple">版本 {dashboard.versionCount}</Tag>
            </Space>
            <Text style={{ display: 'block', marginTop: 12, color: 'var(--semi-color-text-2)' }}>
              最近更新：{formatDate(dashboard.updatedAt)}
            </Text>
          </div>
          <Button theme="solid" onClick={() => navigate(`/project/${dashboard.id}/scenarios`)}>
            管理场景
          </Button>
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16, marginBottom: 24 }}>
        <Card className="glass-card">
          <Text type="tertiary">内部成本基线</Text>
          <Title heading={3} style={{ margin: '8px 0 0' }}>{formatCurrency(dashboard.internalCostBaseline)}</Title>
        </Card>
        <Card className="glass-card">
          <Text type="tertiary">当前有效报价</Text>
          <Title heading={3} style={{ margin: '8px 0 0' }}>{formatCurrency(dashboard.latestQuoteTotal)}</Title>
        </Card>
        <Card className="glass-card">
          <Text type="tertiary">利润差异</Text>
          <Title heading={3} style={{ margin: '8px 0 0', color: (dashboard.latestProfitGap ?? 0) >= 0 ? 'var(--semi-color-success)' : 'var(--semi-color-danger)' }}>
            {formatCurrency(dashboard.latestProfitGap)}
          </Title>
        </Card>
        <Card className="glass-card">
          <Text type="tertiary">回收进度</Text>
          <div style={{ marginTop: 10 }}>
            <Progress percent={Math.round((dashboard.recoveryRate || 0) * 100)} showInfo />
            <Text style={{ display: 'block', marginTop: 8, color: 'var(--semi-color-text-2)' }}>
              {formatCurrency(dashboard.totalRecoveredAmount)} / {formatCurrency(dashboard.totalAllocationAmount)}
            </Text>
          </div>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        <Card className="glass-card" title="模块导航">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
            {moduleCards.map((card) => (
              <div
                key={card.key}
                onClick={() => !card.disabled && card.onClick()}
                style={{
                  border: '1px solid var(--semi-color-border)',
                  borderRadius: 12,
                  padding: 16,
                  cursor: card.disabled ? 'not-allowed' : 'pointer',
                  opacity: card.disabled ? 0.5 : 1,
                }}
              >
                <Space align="start">
                  <div style={{ fontSize: 18 }}>{card.icon}</div>
                  <div>
                    <Text strong>{card.title}</Text>
                    <Text style={{ display: 'block', marginTop: 8, color: 'var(--semi-color-text-2)' }}>{card.description}</Text>
                  </div>
                </Space>
              </div>
            ))}
          </div>
        </Card>

        <Card className="glass-card" title="最近场景与报价">
          {sortedScenarios.length === 0 ? (
            <Empty description="暂无场景" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {sortedScenarios.slice(0, 5).map((scenario) => (
                <div
                  key={scenario.id}
                  style={{ border: '1px solid var(--semi-color-border)', borderRadius: 12, padding: 12, cursor: 'pointer' }}
                  onClick={() => navigate(`/project/${dashboard.id}/s/${scenario.id}`)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <Text strong>{scenario.name}</Text>
                    <Tag color={statusColorMap[scenario.status] || 'grey'}>{scenario.status}</Tag>
                  </div>
                  <Text style={{ display: 'block', marginTop: 6, color: 'var(--semi-color-text-2)' }}>
                    {scenarioTypeLabels[scenario.type] || scenario.type} · 生命周期 {scenario.lifecycleYears} 年
                  </Text>
                </div>
              ))}
              {dashboard.latestQuote && (
                <Card bodyStyle={{ padding: 12 }}>
                  <Text type="tertiary">最近报价</Text>
                  <div style={{ marginTop: 8 }}>
                    <Text strong>{dashboard.latestQuote.version}</Text>
                    <Text style={{ display: 'block', marginTop: 4, color: 'var(--semi-color-text-2)' }}>
                      {dashboard.latestQuote.template} · {dashboard.latestQuote.status} · {dashboard.latestQuote.effectivePriceMode}
                    </Text>
                    <Text style={{ display: 'block', marginTop: 4 }}>{formatCurrency(dashboard.latestQuote.effectivePrice)}</Text>
                  </div>
                </Card>
              )}
              <Button icon={<IconList />} onClick={() => navigate(`/project/${dashboard.id}/scenarios`)}>
                查看全部场景
              </Button>
            </div>
          )}
        </Card>
      </div>

      <div id="governance-summary">
      <Card
        className="glass-card"
        title="治理摘要"
        style={{ marginTop: 24 }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Card bodyStyle={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text strong>最近版本</Text>
              <Button size="small" theme="borderless" onClick={() => navigate(`/project/${dashboard.id}/scenarios`)}>
                去场景治理
              </Button>
            </div>
            {versions.length === 0 ? (
              <Empty description="暂无版本记录" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {versions.slice(0, 5).map((version) => (
                  <div
                    key={version.id}
                    style={{
                      border: '1px solid var(--semi-color-border)',
                      borderRadius: 12,
                      padding: 12,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <Text strong>v{version.versionNumber} · {version.label}</Text>
                      <Tag color={statusColorMap[version.status] || 'grey'}>{version.status}</Tag>
                    </div>
                    <Text style={{ display: 'block', marginTop: 6, color: 'var(--semi-color-text-2)' }}>
                      创建时间：{formatDate(version.createdAt)}
                    </Text>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card bodyStyle={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text strong>最近审计</Text>
              <Button size="small" theme="borderless" onClick={() => navigate(`/project/${dashboard.id}/scenarios`)}>
                查看场景动作
              </Button>
            </div>
            {auditLogs.length === 0 ? (
              <Empty description="暂无审计记录" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {auditLogs.slice(0, 5).map((log) => (
                  <div
                    key={log.id}
                    style={{
                      border: '1px solid var(--semi-color-border)',
                      borderRadius: 12,
                      padding: 12,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <Text strong>{log.action} · {log.entity}</Text>
                      <Text type="tertiary">{formatDate(log.createdAt)}</Text>
                    </div>
                    <Text style={{ display: 'block', marginTop: 6, color: 'var(--semi-color-text-2)' }}>
                      {log.user?.name || log.user?.email || '系统'} · {log.entityId.slice(0, 8)}
                    </Text>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </Card>
      </div>

      <VersionPanel projectId={dashboard.id} />
      <AuditLogPanel projectId={dashboard.id} />
    </div>
  );
}
