import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Empty,
  Form,
  Modal,
  Select,
  Space,
  Spin,
  TabPane,
  Table,
  Tabs,
  Tag,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { IconAlertTriangle, IconDelete, IconEdit, IconPlus, IconRefresh } from '@douyinfe/semi-icons';
import {
  detectAlerts,
  fetchAlertById,
  fetchAlerts,
  fetchAlertSummary,
  fetchProjectAlerts,
  updateAlert,
  type AlertEvent,
  type AlertEventCategory,
  type AlertEventSeverity,
  type AlertEventStatus,
  type AlertSummary,
} from '@/lib/alertEventApi';
import {
  createAlertRule,
  deleteAlertRule,
  fetchAlertRules,
  updateAlertRule,
  type AlertRule,
  type AlertRuleCategory,
  type AlertRuleOperator,
  type AlertRuleSeverity,
} from '@/lib/alertRuleApi';
import { useAlertWorkflow } from '@/hooks/useAlertWorkflow';
import { useSettingsStore } from '@/store/settingsStore';
import { useInternalMetalStore } from '@/store/internalMetalStore';
import { computeMetalAlerts } from '@/engine/metal_alert';

const { Title, Text } = Typography;

const CATEGORY_LABELS: Record<AlertRuleCategory | AlertEventCategory, string> = {
  metal_price: '金属价格',
  allocation_recovery: '分摊回收',
  cost_anomaly: '成本异常',
  execution: '执行节点',
  deadline: '截止日期',
};

const SEVERITY_META = {
  info: { color: 'blue', label: '提示' },
  warning: { color: 'orange', label: '预警' },
  critical: { color: 'red', label: '严重' },
} as const;

const EVENT_STATUS_META = {
  active: { color: 'red', label: '活跃' },
  acknowledged: { color: 'orange', label: '已确认' },
  resolved: { color: 'green', label: '已解决' },
  dismissed: { color: 'grey', label: '已忽略' },
} as const;

const OPERATOR_LABELS: Record<AlertRuleOperator, string> = {
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
  eq: '=',
  neq: '!=',
  contains: '包含',
};

function formatDateTime(value?: string | null) {
  if (!value) {
    return '-';
  }
  return new Date(value).toLocaleString('zh-CN');
}

function buildAlertSourceTarget(projectId: string | undefined, event: AlertEvent) {
  const resolvedProjectId = projectId || event.projectId;
  if (!resolvedProjectId) {
    return null;
  }

  switch (event.sourceObjectType) {
    case 'project':
      return { label: '前往项目总览', path: `/project/${resolvedProjectId}` };
    case 'allocation':
      if (!event.scenarioId) return null;
      return { label: '前往分摊回收', path: `/project/${resolvedProjectId}/s/${event.scenarioId}/alloc` };
    case 'change':
      if (!event.scenarioId) return null;
      return { label: '前往设变管理', path: `/project/${resolvedProjectId}/s/${event.scenarioId}/change-engine` };
    case 'tracking':
      if (!event.scenarioId) return null;
      return { label: '前往追踪工作台', path: `/project/${resolvedProjectId}/s/${event.scenarioId}/tracking` };
    default:
      return null;
  }
}

export default function AlertsPage({ mode = 'center' }: { mode?: 'center' | 'rules' }) {
  if (mode === 'rules') {
    return <AlertRulesPage />;
  }
  return <AlertCenterPage />;
}

function AlertCenterPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const workflow = useAlertWorkflow();
  const defaultMetalPrices = useSettingsStore((state) => state.defaultMetalPrices);
  const alertThresholds = useSettingsStore((state) => state.alertThresholds);
  const activeSource = useInternalMetalStore((state) => state.activeSource);
  const activeMetalPrice = useInternalMetalStore((state) => state.getActivePrice());

  const [loading, setLoading] = useState(true);
  const [detecting, setDetecting] = useState(false);
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [summary, setSummary] = useState<AlertSummary>({
    total: 0,
    active: 0,
    acknowledged: 0,
    resolved: 0,
    dismissed: 0,
    critical: 0,
    warning: 0,
    totalImpact: 0,
  });
  const [activeTab, setActiveTab] = useState<'all' | AlertEventCategory>('all');
  const [severityFilter, setSeverityFilter] = useState<AlertEventSeverity | undefined>();
  const [statusFilter, setStatusFilter] = useState<AlertEventStatus | undefined>();
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<AlertEvent | null>(null);

  const reload = async () => {
    setLoading(true);
    try {
      const [eventRows, summaryRow] = await Promise.all([
        projectId ? fetchProjectAlerts(projectId) : fetchAlerts(),
        fetchAlertSummary(projectId),
      ]);
      setEvents(eventRows);
      setSummary(summaryRow);
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '加载预警事件失败。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, [projectId]);

  const metalClientCheck = useMemo(() => {
    const result = computeMetalAlerts(
      defaultMetalPrices,
      {
        copper: activeMetalPrice.copper,
        aluminum: activeMetalPrice.aluminum,
      },
      {
        copper: {
          warnPct: alertThresholds.copperPercent,
          dangerPct: alertThresholds.copperPercent * 2,
        },
        aluminum: {
          warnPct: alertThresholds.aluminumPercent,
          dangerPct: alertThresholds.aluminumPercent * 2,
        },
      }
    );
    return {
      ...result,
      activeSource,
      activeTimestamp: activeMetalPrice.timestamp,
    };
  }, [activeMetalPrice.aluminum, activeMetalPrice.copper, activeMetalPrice.timestamp, activeSource, alertThresholds.aluminumPercent, alertThresholds.copperPercent, defaultMetalPrices]);

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (activeTab !== 'all' && event.category !== activeTab) {
        return false;
      }
      if (severityFilter && event.severity !== severityFilter) {
        return false;
      }
      if (statusFilter && event.status !== statusFilter) {
        return false;
      }
      return true;
    });
  }, [activeTab, events, severityFilter, statusFilter]);

  const clientCheckSummary = useMemo(() => {
    const alertCount = metalClientCheck.items.filter((item) => item.level !== 'normal').length;
    if (!alertCount) {
      return `当前金属价格来源 ${metalClientCheck.activeSource} 未触发阈值预警。`;
    }
    return `当前金属价格来源 ${metalClientCheck.activeSource} 检出 ${alertCount} 条金属价格预警。`;
  }, [metalClientCheck.activeSource, metalClientCheck.items]);

  const openDetail = async (event: AlertEvent) => {
    setDetailVisible(true);
    setDetailLoading(true);
    try {
      const detail = await fetchAlertById(event.id);
      setSelectedEvent(detail);
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '加载预警详情失败。');
      setSelectedEvent(event);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleStatusChange = async (event: AlertEvent, status: AlertEventStatus) => {
    try {
      const shouldEscalate = (workflow.checkEscalation as any)(event as any, new Date().toISOString());
      if (shouldEscalate && status !== 'resolved') {
        Toast.warning('此预警已超时，建议优先处理或升级。');
      }
      await updateAlert(event.id, { status });
      Toast.success('预警状态已更新。');
      await reload();
      if (selectedEvent?.id === event.id) {
        setSelectedEvent(await fetchAlertById(event.id));
      }
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '更新预警状态失败。');
    }
  };

  const handleDetect = async () => {
    setDetecting(true);
    try {
      const result = await detectAlerts();
      Toast.success(`预警检测完成，本次更新 ${result.count} 条事件。`);
      await reload();
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '预警检测失败。');
    } finally {
      setDetecting(false);
    }
  };

  const handleRunClientChecks = () => {
    try {
      const checkResult = workflow.runChecks({});
      const metalAlertCount = metalClientCheck.items.filter((item) => item.level !== 'normal').length;
      if (checkResult.alerts.length > 0 || metalAlertCount > 0) {
        Toast.warning(`客户端预检发现 ${checkResult.alerts.length + metalAlertCount} 条潜在预警，建议运行完整检测。`);
      } else {
        Toast.info('客户端预检未发现异常。');
      }
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '客户端预检失败。');
    }
  };

  const columns = [
    {
      title: '类别',
      dataIndex: 'category',
      width: 120,
      render: (value: AlertEventCategory) => <Tag color="blue">{CATEGORY_LABELS[value]}</Tag>,
    },
    {
      title: '预警内容',
      dataIndex: 'title',
      width: 260,
      render: (value: string, record: AlertEvent) => (
        <Button
          theme="borderless"
          style={{ padding: 0, height: 'auto', fontWeight: 700, textAlign: 'left' }}
          onClick={() => void openDetail(record)}
        >
          {value}
        </Button>
      ),
    },
    {
      title: '严重度',
      dataIndex: 'severity',
      width: 100,
      align: 'center' as const,
      render: (value: AlertEventSeverity) => {
        const meta = SEVERITY_META[value];
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      align: 'center' as const,
      render: (value: AlertEventStatus) => {
        const meta = EVENT_STATUS_META[value];
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: '影响金额',
      dataIndex: 'impactAmount',
      width: 130,
      align: 'right' as const,
      render: (value: number) => <span className="consolas-font" style={{ fontWeight: 700 }}>楼{Number(value || 0).toFixed(2)}</span>,
    },
    {
      title: '发生时间',
      dataIndex: 'occurredAt',
      width: 170,
      render: (value: string) => formatDateTime(value),
    },
    {
      title: '详情',
      dataIndex: 'detail',
      render: (value: string | null | undefined) => <Text type="tertiary">{value || '-'}</Text>,
    },
    {
      title: '操作',
      width: 240,
      fixed: 'right' as const,
      render: (_: unknown, record: AlertEvent) => (
        <Space>
          {record.status === 'active' && (
            <Button size="small" onClick={() => void handleStatusChange(record, 'acknowledged')}>
              确认
            </Button>
          )}
          {(record.status === 'active' || record.status === 'acknowledged') && (
            <Button size="small" type="primary" onClick={() => void handleStatusChange(record, 'resolved')}>
              解决
            </Button>
          )}
          {record.status !== 'dismissed' && (
            <Button size="small" theme="borderless" type="danger" onClick={() => void handleStatusChange(record, 'dismissed')}>
              忽略
            </Button>
          )}
        </Space>
      ),
    },
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 24px' }}>
        <Spin size="large" tip="正在加载预警事件..." />
      </div>
    );
  }

  const detailTarget = selectedEvent ? buildAlertSourceTarget(projectId, selectedEvent) : null;

  return (
    <div className="page-container" style={{ maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, gap: 12, flexWrap: 'wrap' }}>
        <Title heading={2} className="ink-heading" style={{ margin: 0 }}>
          {projectId ? '项目预警中心' : '全局预警中心'}
        </Title>
        <Space>
          <Button onClick={handleRunClientChecks}>
            客户端预检
          </Button>
          <Button icon={<IconRefresh />} loading={detecting} onClick={() => void handleDetect()}>
            刷新检测
          </Button>
        </Space>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: '活跃预警', value: summary.active, color: 'var(--danger)' },
          { label: '已确认', value: summary.acknowledged, color: 'var(--warning)' },
          { label: '严重级别', value: summary.critical, color: '#7c3aed' },
          { label: '总影响金额', value: `¥${summary.totalImpact.toFixed(2)}`, color: 'var(--accent)' },
        ].map((card) => (
          <div key={card.label} className="glass-card animate-fade-up" style={{ padding: '24px 20px' }}>
            <Text style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 14 }}>
              {card.label}
            </Text>
            <div className="consolas-font" style={{ fontSize: 30, fontWeight: 800, color: card.color, lineHeight: 1 }}>
              {card.value}
            </div>
          </div>
        ))}
      </div>

      <div className="glass-card animate-fade-up" style={{ padding: 20, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'grid', gap: 8 }}>
            <Text strong>金属价格客户端联动预检</Text>
            <Text type="tertiary">{clientCheckSummary}</Text>
            <Text type="tertiary">基准价：铜 ¥{defaultMetalPrices.copper}/吨，铝 ¥{defaultMetalPrices.aluminum}/吨；当前来源：{metalClientCheck.activeSource}（{formatDateTime(metalClientCheck.activeTimestamp)}）</Text>
          </div>
          <Space wrap>
            {metalClientCheck.items.map((item) => {
              const color = item.level === 'danger' ? 'red' : item.level === 'warn' ? 'orange' : 'grey';
              return (
                <Tag key={item.metal} color={color} size="large">
                  {item.label} {item.deltaPct >= 0 ? '+' : ''}{item.deltaPct.toFixed(1)}%
                </Tag>
              );
            })}
          </Space>
        </div>
      </div>

      <div className="glass-card animate-fade-up" style={{ padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
          <Tabs type="button" activeKey={activeTab} onChange={(key) => setActiveTab(key as 'all' | AlertEventCategory)} style={{ marginBottom: 0 }}>
            <TabPane tab="全部" itemKey="all" />
            <TabPane tab="金属价格" itemKey="metal_price" />
            <TabPane tab="分摊回收" itemKey="allocation_recovery" />
            <TabPane tab="成本异常" itemKey="cost_anomaly" />
            <TabPane tab="执行节点" itemKey="execution" />
            <TabPane tab="截止日期" itemKey="deadline" />
          </Tabs>
          <div style={{ display: 'flex', gap: 12 }}>
            <Select
              placeholder="按严重度筛选"
              style={{ width: 150 }}
              value={severityFilter}
              onChange={(value) => setSeverityFilter(value as AlertEventSeverity | undefined)}
              showClear
              optionList={[
                { value: 'info', label: '提示' },
                { value: 'warning', label: '预警' },
                { value: 'critical', label: '严重' },
              ]}
            />
            <Select
              placeholder="按状态筛选"
              style={{ width: 150 }}
              value={statusFilter}
              onChange={(value) => setStatusFilter(value as AlertEventStatus | undefined)}
              showClear
              optionList={[
                { value: 'active', label: '活跃' },
                { value: 'acknowledged', label: '已确认' },
                { value: 'resolved', label: '已解决' },
                { value: 'dismissed', label: '已忽略' },
              ]}
            />
          </div>
        </div>

        <Table
          columns={columns}
          dataSource={filteredEvents}
          rowKey="id"
          pagination={{ pageSize: 20 }}
          size="small"
          scroll={{ x: 1300 }}
          empty={(
            <Empty description="暂无预警事件" style={{ padding: '60px 0' }}>
              <div style={{ fontSize: 48, opacity: 0.15, marginBottom: 8 }}>
                <IconAlertTriangle />
              </div>
            </Empty>
          )}
        />
      </div>

      <Modal
        title="预警详情"
        visible={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={720}
      >
        {detailLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
            <Spin />
          </div>
        ) : selectedEvent ? (
          <div style={{ display: 'grid', gap: 12 }}>
            <div><Text strong>标题：</Text><Text>{selectedEvent.title}</Text></div>
            <div><Text strong>类别：</Text><Tag color="blue">{CATEGORY_LABELS[selectedEvent.category]}</Tag></div>
            <div><Text strong>严重度：</Text><Tag color={SEVERITY_META[selectedEvent.severity].color}>{SEVERITY_META[selectedEvent.severity].label}</Tag></div>
            <div><Text strong>状态：</Text><Tag color={EVENT_STATUS_META[selectedEvent.status].color}>{EVENT_STATUS_META[selectedEvent.status].label}</Tag></div>
            <div><Text strong>影响金额：</Text><Text className="consolas-font">楼{selectedEvent.impactAmount.toFixed(2)}</Text></div>
            <div><Text strong>详情：</Text><Text>{selectedEvent.detail || '-'}</Text></div>
            <div><Text strong>来源对象：</Text><Text>{selectedEvent.sourceObjectType || '-'} {selectedEvent.sourceObjectId || ''}</Text></div>
            <div><Text strong>发生时间：</Text><Text>{formatDateTime(selectedEvent.occurredAt)}</Text></div>
            {detailTarget && (
              <div>
                <Button
                  theme="solid"
                  onClick={() => {
                    navigate(detailTarget.path);
                    setDetailVisible(false);
                  }}
                >
                  {detailTarget.label}
                </Button>
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function AlertRulesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);

  const reload = async () => {
    setLoading(true);
    try {
      setRules(await fetchAlertRules());
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '加载预警规则失败。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  const handleDelete = (rule: AlertRule) => {
    Modal.confirm({
      title: '删除预警规则',
      content: `确定删除“${rule.name}”吗？`,
      onOk: async () => {
        try {
          await deleteAlertRule(rule.id);
          Toast.success('预警规则已删除。');
          await reload();
        } catch (error) {
          Toast.error(error instanceof Error ? error.message : '删除预警规则失败。');
        }
      },
    });
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    setSaving(true);
    try {
      const payload = {
        name: String(values.name || ''),
        category: values.category as AlertRuleCategory,
        severity: values.severity as AlertRuleSeverity,
        enabled: Boolean(values.enabled ?? true),
        description: String(values.description || ''),
        condition: {
          metric: String(values.metric || ''),
          operator: values.operator as AlertRuleOperator,
          threshold: parseThreshold(String(values.threshold || '')),
          unit: String(values.unit || '') || undefined,
          window: String(values.window || '') || undefined,
          targetField: String(values.targetField || '') || undefined,
        },
      };

      if (editingRule) {
        await updateAlertRule(editingRule.id, payload);
        Toast.success('预警规则已更新。');
      } else {
        await createAlertRule(payload);
        Toast.success('预警规则已创建。');
      }

      setModalVisible(false);
      setEditingRule(null);
      await reload();
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '保存预警规则失败。');
    } finally {
      setSaving(false);
    }
  };

  const stats = useMemo(() => ({
    total: rules.length,
    enabled: rules.filter((rule) => rule.enabled).length,
    critical: rules.filter((rule) => rule.severity === 'critical').length,
    categories: new Set(rules.map((rule) => rule.category)).size,
  }), [rules]);

  const columns = [
    { title: '规则名称', dataIndex: 'name', width: 220, render: (value: string) => <Text strong>{value}</Text> },
    { title: '类别', dataIndex: 'category', width: 120, render: (value: AlertRuleCategory) => <Tag color="blue">{CATEGORY_LABELS[value]}</Tag> },
    {
      title: '级别',
      dataIndex: 'severity',
      width: 100,
      align: 'center' as const,
      render: (value: AlertRuleSeverity) => {
        const meta = SEVERITY_META[value];
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: '条件',
      dataIndex: 'condition',
      render: (value: AlertRule['condition']) => (
        <Text>
          {value.metric} {OPERATOR_LABELS[value.operator]} {String(value.threshold)}
          {value.unit ? ` ${value.unit}` : ''}
        </Text>
      ),
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      width: 90,
      align: 'center' as const,
      render: (value: boolean) => <Tag color={value ? 'green' : 'grey'}>{value ? '启用' : '停用'}</Tag>,
    },
    { title: '说明', dataIndex: 'description', render: (value: string | null | undefined) => <Text type="tertiary">{value || '-'}</Text> },
    {
      title: '操作',
      width: 120,
      align: 'center' as const,
      render: (_: unknown, record: AlertRule) => (
        <Space>
          <Button icon={<IconEdit />} size="small" theme="borderless" onClick={() => { setEditingRule(record); setModalVisible(true); }} />
          <Button icon={<IconDelete />} size="small" theme="borderless" type="danger" onClick={() => handleDelete(record)} />
        </Space>
      ),
    },
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 24px' }}>
        <Spin size="large" tip="正在加载预警规则..." />
      </div>
    );
  }

  return (
    <div style={{ padding: '0 24px 24px', maxWidth: 1280, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title heading={3}>预警规则</Title>
          <Text type="tertiary">配置规则列表、新建规则、编辑规则和删除规则。</Text>
        </div>
        <Button
          icon={<IconPlus />}
          theme="solid"
          type="primary"
          onClick={() => {
            setEditingRule(null);
            setModalVisible(true);
          }}
        >
          新建规则
        </Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: '规则总数', value: stats.total, color: 'var(--accent)' },
          { label: '启用规则', value: stats.enabled, color: 'var(--success)' },
          { label: '严重级别', value: stats.critical, color: 'var(--danger)' },
          { label: '覆盖类别', value: stats.categories, color: '#7c3aed' },
        ].map((card) => (
          <div key={card.label} className="glass-card" style={{ padding: '20px 24px' }}>
            <Text type="tertiary" size="small">{card.label}</Text>
            <div className="consolas-font" style={{ fontSize: 28, fontWeight: 800, color: card.color, marginTop: 4 }}>
              {card.value}
            </div>
          </div>
        ))}
      </div>

      <div className="glass-card" style={{ padding: 24 }}>
        <Table
          columns={columns}
          dataSource={rules}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          empty={<Empty description="暂无预警规则" />}
        />
      </div>

      <Modal
        title={editingRule ? '编辑预警规则' : '新建预警规则'}
        visible={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingRule(null);
        }}
        footer={null}
        width={640}
      >
        <AlertRuleForm
          rule={editingRule}
          saving={saving}
          onSubmit={handleSubmit}
          onCancel={() => {
            setModalVisible(false);
            setEditingRule(null);
          }}
        />
      </Modal>
    </div>
  );
}

function AlertRuleForm({
  rule,
  saving,
  onSubmit,
  onCancel,
}: {
  rule: AlertRule | null;
  saving: boolean;
  onSubmit: (values: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const defaults = rule
    ? {
        ...rule,
        metric: rule.condition.metric,
        operator: rule.condition.operator,
        threshold: String(rule.condition.threshold),
        unit: rule.condition.unit,
        window: rule.condition.window,
        targetField: rule.condition.targetField,
      }
    : {
        name: '',
        category: 'metal_price',
        severity: 'warning',
        enabled: true,
        description: '',
        metric: '',
        operator: 'gte',
        threshold: '',
        unit: '',
        window: '',
        targetField: '',
      };

  return (
    <Form
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore Semi Form 泛型推导过深
      initValues={defaults}
      onSubmit={onSubmit}
      labelPosition="left"
      labelWidth={100}
    >
      <Form.Input field="name" label="规则名称" rules={[{ required: true, message: '请输入规则名称' }]} />
      <Form.Select
        field="category"
        label="类别"
        optionList={Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }))}
        rules={[{ required: true }]}
      />
      <Form.Select
        field="severity"
        label="级别"
        optionList={[
          { value: 'info', label: '提示' },
          { value: 'warning', label: '预警' },
          { value: 'critical', label: '严重' },
        ]}
        rules={[{ required: true }]}
      />
      <Form.Switch field="enabled" label="启用" />
      <Form.TextArea field="description" label="说明" rows={2} />
      <Form.Input field="metric" label="指标" rules={[{ required: true, message: '请输入指标' }]} />
      <Form.Select
        field="operator"
        label="运算符"
        optionList={Object.entries(OPERATOR_LABELS).map(([value, label]) => ({ value, label }))}
        rules={[{ required: true }]}
      />
      <Form.Input field="threshold" label="阈值" rules={[{ required: true, message: '请输入阈值' }]} />
      <Form.Input field="unit" label="单位" />
      <Form.Input field="window" label="窗口" />
      <Form.Input field="targetField" label="目标字段" />
      <div style={{ textAlign: 'right', marginTop: 16 }}>
        <Button onClick={onCancel} style={{ marginRight: 8 }}>取消</Button>
        <Button theme="solid" type="primary" htmlType="submit" loading={saving}>
          {rule ? '保存' : '创建'}
        </Button>
      </div>
    </Form>
  );
}

function parseThreshold(value: string) {
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  const numeric = Number(value);
  if (!Number.isNaN(numeric) && value.trim() !== '') {
    return numeric;
  }
  return value;
}
