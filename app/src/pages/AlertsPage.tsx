import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Typography, Table, Empty, Tabs, TabPane, Select, Spin, Button, Modal, Form, Toast, Space, Tag,
} from '@douyinfe/semi-ui';
import { IconAlertTriangle, IconPlus, IconDelete, IconEdit } from '@douyinfe/semi-icons';
import {
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

const { Title, Text } = Typography;

const RULE_CATEGORY_LABELS: Record<AlertRuleCategory | AlertEventCategory, string> = {
  metal_price: '金属价格',
  allocation_recovery: '分摊回收',
  cost_anomaly: '成本异常',
  execution: '执行节点',
  deadline: '截止日期',
};

const RULE_SEVERITY_COLORS: Record<AlertRuleSeverity | AlertEventSeverity, string> = {
  info: 'blue',
  warning: 'orange',
  critical: 'red',
};

const EVENT_STATUS_COLORS: Record<AlertEventStatus, string> = {
  active: 'red',
  acknowledged: 'orange',
  resolved: 'green',
  dismissed: 'grey',
};

const EVENT_STATUS_LABELS: Record<AlertEventStatus, string> = {
  active: '活跃',
  acknowledged: '已确认',
  resolved: '已解决',
  dismissed: '已忽略',
};

const OPERATOR_LABELS: Record<AlertRuleOperator, string> = {
  gt: '>',
  gte: '≥',
  lt: '<',
  lte: '≤',
  eq: '=',
  neq: '≠',
  contains: '包含',
};

export default function AlertsPage({ mode = 'center' }: { mode?: 'center' | 'rules' }) {
  if (mode === 'rules') return <AlertRulesPage />;
  return <AlertCenterPage />;
}

function AlertCenterPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [summary, setSummary] = useState<AlertSummary>({ total: 0, active: 0, acknowledged: 0, resolved: 0, dismissed: 0, critical: 0, warning: 0, totalImpact: 0 });
  const [activeTab, setActiveTab] = useState<'all' | AlertEventCategory>('all');
  const [severityFilter, setSeverityFilter] = useState<AlertEventSeverity | undefined>();
  const [statusFilter, setStatusFilter] = useState<AlertEventStatus | undefined>();
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<AlertEvent | null>(null);

  const reload = async () => {
    setLoading(true);
    try {
      const [eventData, summaryData] = await Promise.all([
        projectId ? fetchProjectAlerts(projectId) : fetchAlerts(),
        fetchAlertSummary(projectId),
      ]);
      setEvents(eventData);
      setSummary(summaryData);
    } catch (error: any) {
      Toast.error(error?.message || '加载预警事件失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, [projectId]);

  const filtered = useMemo(() => {
    return events.filter((event) => {
      if (activeTab !== 'all' && event.category !== activeTab) return false;
      if (severityFilter && event.severity !== severityFilter) return false;
      if (statusFilter && event.status !== statusFilter) return false;
      return true;
    });
  }, [events, activeTab, severityFilter, statusFilter]);

  const openDetail = async (event: AlertEvent) => {
    setDetailVisible(true);
    setDetailLoading(true);
    try {
      const detail = await fetchAlertById(event.id);
      setSelectedEvent(detail);
    } catch (error: any) {
      Toast.error(error?.message || '加载预警详情失败');
      setSelectedEvent(event);
    } finally {
      setDetailLoading(false);
    }
  };

  const changeStatus = async (event: AlertEvent, status: AlertEventStatus) => {
    try {
      await updateAlert(event.id, { status });
      Toast.success('预警状态已更新');
      await reload();
      if (selectedEvent?.id === event.id) {
        const detail = await fetchAlertById(event.id);
        setSelectedEvent(detail);
      }
    } catch (error: any) {
      Toast.error(error?.message || '更新预警状态失败');
    }
  };

  const columns = [
    {
      title: '类别',
      dataIndex: 'category',
      width: 120,
      render: (value: AlertEventCategory) => <Tag color="blue">{RULE_CATEGORY_LABELS[value]}</Tag>,
    },
    {
      title: '预警内容',
      dataIndex: 'title',
      width: 260,
      render: (value: string, record: AlertEvent) => (
        <Button theme="borderless" style={{ padding: 0, height: 'auto', fontWeight: 700 }} onClick={() => openDetail(record)}>{value}</Button>
      ),
    },
    {
      title: '严重度',
      dataIndex: 'severity',
      width: 100,
      align: 'center' as const,
      render: (value: AlertEventSeverity) => <Tag color={RULE_SEVERITY_COLORS[value] as any}>{value}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      align: 'center' as const,
      render: (value: AlertEventStatus) => <Tag color={EVENT_STATUS_COLORS[value] as any}>{EVENT_STATUS_LABELS[value]}</Tag>,
    },
    {
      title: '影响金额',
      dataIndex: 'impactAmount',
      width: 130,
      align: 'right' as const,
      render: (value: number) => <span className="consolas-font" style={{ fontWeight: 700 }}>¥{Number(value || 0).toFixed(2)}</span>,
    },
    {
      title: '发生时间',
      dataIndex: 'occurredAt',
      width: 110,
      render: (value: string) => value?.slice(0, 10) || '-',
    },
    {
      title: '详情',
      dataIndex: 'detail',
      render: (value: string | null | undefined) => <Text type="tertiary">{value || '-'}</Text>,
    },
    {
      title: '操作',
      width: 220,
      fixed: 'right' as const,
      render: (_: any, record: AlertEvent) => (
        <Space>
          {record.status === 'active' && <Button size="small" onClick={() => changeStatus(record, 'acknowledged')}>确认</Button>}
          {(record.status === 'active' || record.status === 'acknowledged') && <Button size="small" type="primary" onClick={() => changeStatus(record, 'resolved')}>解决</Button>}
          {record.status !== 'dismissed' && <Button size="small" theme="borderless" type="danger" onClick={() => changeStatus(record, 'dismissed')}>忽略</Button>}
        </Space>
      ),
    },
  ];

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 24px' }}><Spin size="large" tip="正在加载预警事件..." /></div>;
  }

  return (
    <div className="page-container" style={{ maxWidth: 1400, margin: '0 auto' }}>
      <Title heading={2} className="ink-heading" style={{ marginBottom: 28 }}>{projectId ? '项目预警中心' : '全局预警中心'}</Title>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: '活跃预警', value: summary.active, color: '#dc2626' },
          { label: '已确认', value: summary.acknowledged, color: '#d97706' },
          { label: '关键级别', value: summary.critical, color: '#7c3aed' },
          { label: '总影响金额', value: `¥${summary.totalImpact.toFixed(2)}`, color: '#1d4ed8' },
        ].map((card) => (
          <div key={card.label} className="glass-card animate-fade-up" style={{ padding: '24px 20px' }}>
            <Text style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 14 }}>{card.label}</Text>
            <div className="consolas-font" style={{ fontSize: 30, fontWeight: 800, color: card.color, lineHeight: 1 }}>{card.value}</div>
          </div>
        ))}
      </div>

      <div className="glass-card animate-fade-up" style={{ padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
          <Tabs type="button" activeKey={activeTab} onChange={(key) => setActiveTab(key as any)} style={{ marginBottom: 0 }}>
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
              onChange={(v) => setSeverityFilter(v as AlertEventSeverity | undefined)}
              showClear
              optionList={[
                { value: 'info', label: 'info' },
                { value: 'warning', label: 'warning' },
                { value: 'critical', label: 'critical' },
              ]}
            />
            <Select
              placeholder="按状态筛选"
              style={{ width: 150 }}
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as AlertEventStatus | undefined)}
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
        <Table columns={columns} dataSource={filtered} rowKey="id" pagination={{ pageSize: 20 }} empty={<Empty description="暂无预警事件" style={{ padding: '60px 0' }}><div style={{ fontSize: 48, opacity: 0.15, marginBottom: 8 }}><IconAlertTriangle /></div></Empty>} size="small" scroll={{ x: 1300 }} />
      </div>

      <Modal title="预警详情" visible={detailVisible} onCancel={() => setDetailVisible(false)} footer={null} width={720}>
        {detailLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><Spin /></div>
        ) : selectedEvent ? (
          <div style={{ display: 'grid', gap: 12 }}>
            <div><Text strong>标题：</Text><Text>{selectedEvent.title}</Text></div>
            <div><Text strong>类别：</Text><Tag color="blue">{RULE_CATEGORY_LABELS[selectedEvent.category]}</Tag></div>
            <div><Text strong>严重度：</Text><Tag color={RULE_SEVERITY_COLORS[selectedEvent.severity] as any}>{selectedEvent.severity}</Tag></div>
            <div><Text strong>状态：</Text><Tag color={EVENT_STATUS_COLORS[selectedEvent.status] as any}>{EVENT_STATUS_LABELS[selectedEvent.status]}</Tag></div>
            <div><Text strong>影响金额：</Text><Text className="consolas-font">¥{selectedEvent.impactAmount.toFixed(2)}</Text></div>
            <div><Text strong>详情：</Text><Text>{selectedEvent.detail || '-'}</Text></div>
            <div><Text strong>来源对象：</Text><Text>{selectedEvent.sourceObjectType || '-'} {selectedEvent.sourceObjectId || ''}</Text></div>
            <div><Text strong>发生时间：</Text><Text>{selectedEvent.occurredAt}</Text></div>
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
    } catch (error: any) {
      Toast.error(error?.message || '加载预警规则失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  const openCreate = () => {
    setEditingRule(null);
    setModalVisible(true);
  };

  const openEdit = (rule: AlertRule) => {
    setEditingRule(rule);
    setModalVisible(true);
  };

  const handleDelete = (rule: AlertRule) => {
    Modal.confirm({
      title: '删除预警规则',
      content: `确定删除「${rule.name}」？`,
      onOk: async () => {
        await deleteAlertRule(rule.id);
        Toast.success('预警规则已删除');
        await reload();
      },
    });
  };

  const handleSubmit = async (values: any) => {
    setSaving(true);
    try {
      const payload = {
        name: values.name,
        category: values.category,
        severity: values.severity,
        enabled: values.enabled ?? true,
        description: values.description,
        condition: {
          metric: values.metric,
          operator: values.operator,
          threshold: parseThreshold(values.threshold),
          unit: values.unit || undefined,
          window: values.window || undefined,
          targetField: values.targetField || undefined,
        },
      };

      if (editingRule) {
        await updateAlertRule(editingRule.id, payload);
        Toast.success('预警规则已更新');
      } else {
        await createAlertRule(payload);
        Toast.success('预警规则已创建');
      }
      setModalVisible(false);
      setEditingRule(null);
      await reload();
    } catch (error: any) {
      Toast.error(error?.message || '保存预警规则失败');
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
    { title: '规则名称', dataIndex: 'name', width: 220, render: (v: string) => <Text strong>{v}</Text> },
    { title: '类别', dataIndex: 'category', width: 120, render: (v: AlertRuleCategory) => <Tag color="blue">{RULE_CATEGORY_LABELS[v]}</Tag> },
    { title: '级别', dataIndex: 'severity', width: 100, align: 'center' as const, render: (v: AlertRuleSeverity) => <Tag color={RULE_SEVERITY_COLORS[v] as any}>{v}</Tag> },
    { title: '条件', dataIndex: 'condition', render: (v: AlertRule['condition']) => <Text>{v.metric} {OPERATOR_LABELS[v.operator]} {String(v.threshold)}{v.unit ? ` ${v.unit}` : ''}</Text> },
    { title: '状态', dataIndex: 'enabled', width: 90, align: 'center' as const, render: (v: boolean) => <Tag color={v ? 'green' : 'grey'}>{v ? '启用' : '停用'}</Tag> },
    { title: '说明', dataIndex: 'description', render: (v: string | null | undefined) => <Text type="tertiary">{v || '-'}</Text> },
    {
      title: '操作', width: 120, align: 'center' as const, render: (_: any, record: AlertRule) => (
        <Space>
          <Button icon={<IconEdit />} size="small" theme="borderless" onClick={() => openEdit(record)} />
          <Button icon={<IconDelete />} size="small" theme="borderless" type="danger" onClick={() => handleDelete(record)} />
        </Space>
      ),
    },
  ];

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 24px' }}><Spin size="large" tip="正在加载预警规则..." /></div>;
  }

  return (
    <div style={{ padding: '0 24px 24px', maxWidth: 1280, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title heading={3}>预警规则</Title>
          <Text type="tertiary">配置规则列表、新建规则、编辑规则和删除规则。</Text>
        </div>
        <Button icon={<IconPlus />} theme="solid" type="primary" onClick={openCreate}>新建规则</Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: '规则总数', value: stats.total, color: '#1d4ed8' },
          { label: '启用规则', value: stats.enabled, color: '#059669' },
          { label: '关键级别', value: stats.critical, color: '#dc2626' },
          { label: '覆盖类别', value: stats.categories, color: '#7c3aed' },
        ].map((card) => (
          <div key={card.label} className="glass-card" style={{ padding: '20px 24px' }}>
            <Text type="tertiary" size="small">{card.label}</Text>
            <div className="consolas-font" style={{ fontSize: 28, fontWeight: 800, color: card.color, marginTop: 4 }}>{card.value}</div>
          </div>
        ))}
      </div>

      <div className="glass-card" style={{ padding: 24 }}>
        <Table columns={columns} dataSource={rules} rowKey="id" pagination={{ pageSize: 10 }} empty={<Empty description="暂无预警规则" />} />
      </div>

      <Modal title={editingRule ? '编辑预警规则' : '新建预警规则'} visible={modalVisible} onCancel={() => { setModalVisible(false); setEditingRule(null); }} footer={null} width={640}>
        <AlertRuleForm rule={editingRule} saving={saving} onSubmit={handleSubmit} onCancel={() => { setModalVisible(false); setEditingRule(null); }} />
      </Modal>
    </div>
  );
}

function AlertRuleForm({ rule, saving, onSubmit, onCancel }: { rule: AlertRule | null; saving: boolean; onSubmit: (values: any) => void; onCancel: () => void; }) {
  const defaults = rule ? {
    ...rule,
    metric: rule.condition.metric,
    operator: rule.condition.operator,
    threshold: String(rule.condition.threshold),
    unit: rule.condition.unit,
    window: rule.condition.window,
    targetField: rule.condition.targetField,
  } : {
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
      // @ts-ignore — Semi Form 泛型过深
      initValues={defaults}
      onSubmit={onSubmit}
      labelPosition="left"
      labelWidth={100}
    >
      <Form.Input field="name" label="规则名称" rules={[{ required: true, message: '请输入规则名称' }]} />
      <Form.Select field="category" label="类别" optionList={Object.entries(RULE_CATEGORY_LABELS).map(([value, label]) => ({ value, label }))} rules={[{ required: true }]} />
      <Form.Select field="severity" label="级别" optionList={[{ value: 'info', label: 'info' }, { value: 'warning', label: 'warning' }, { value: 'critical', label: 'critical' }]} rules={[{ required: true }]} />
      <Form.Switch field="enabled" label="启用" />
      <Form.TextArea field="description" label="说明" rows={2} />
      <Form.Input field="metric" label="指标" rules={[{ required: true, message: '请输入指标' }]} />
      <Form.Select field="operator" label="运算符" optionList={Object.entries(OPERATOR_LABELS).map(([value, label]) => ({ value, label }))} rules={[{ required: true }]} />
      <Form.Input field="threshold" label="阈值" rules={[{ required: true, message: '请输入阈值' }]} />
      <Form.Input field="unit" label="单位" />
      <Form.Input field="window" label="窗口" />
      <Form.Input field="targetField" label="目标字段" />
      <div style={{ textAlign: 'right', marginTop: 16 }}>
        <Button onClick={onCancel} style={{ marginRight: 8 }}>取消</Button>
        <Button theme="solid" type="primary" htmlType="submit" loading={saving}>{rule ? '保存' : '创建'}</Button>
      </div>
    </Form>
  );
}

function parseThreshold(value: string) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  const numeric = Number(value);
  if (!Number.isNaN(numeric) && value.trim() !== '') return numeric;
  return value;
}
