/**
 * 预警中心 / 预警规则页
 */
import { useEffect, useState, useMemo } from 'react';
import {
  Typography, Table, Empty, Tabs, TabPane, Select, Spin, Button, Modal, Form, Toast, Space, Tag,
} from '@douyinfe/semi-ui';
import { IconAlertTriangle, IconPlus, IconDelete, IconEdit } from '@douyinfe/semi-icons';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db';
import { computeMetalAlerts, type AlertLevel } from '@/engine/metal_alert';
import { useTrackingStore } from '@/store/trackingStore';
import { useSettingsStore } from '@/store/settingsStore';
import type { MetalPrices } from '@/types/project';
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

const LEVEL_CONFIG: Record<AlertLevel, { color: string; bg: string; border: string; label: string; dot: string }> = {
  normal: { color: '#71717a', bg: 'rgba(0,0,0,0.03)', border: 'rgba(0,0,0,0.06)', label: '正常', dot: '#a1a1aa' },
  warn: { color: '#d97706', bg: 'rgba(217,119,6,0.06)', border: 'rgba(217,119,6,0.12)', label: '预警', dot: '#d97706' },
  danger: { color: '#dc2626', bg: 'rgba(220,38,38,0.06)', border: 'rgba(220,38,38,0.12)', label: '危险', dot: '#dc2626' },
};

const RULE_CATEGORY_LABELS: Record<AlertRuleCategory, string> = {
  metal_price: '金属价格',
  allocation_recovery: '分摊回收',
  cost_anomaly: '成本异常',
  execution: '执行节点',
  deadline: '截止日期',
};

const RULE_SEVERITY_COLORS: Record<AlertRuleSeverity, string> = {
  info: 'blue',
  warning: 'orange',
  critical: 'red',
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

type AlertRow = {
  id: string;
  type: 'metal' | 'alloc' | 'anomaly';
  typeLabel: string;
  title: string;
  level: AlertLevel;
  impact: number;
  detail: string;
  project?: string;
  date: string;
};

export default function AlertsPage({ mode = 'center' }: { mode?: 'center' | 'rules' }) {
  if (mode === 'rules') return <AlertRulesPage />;
  return <AlertCenterPage />;
}

function AlertCenterPage() {
  const [activeTab, setActiveTab] = useState('all');
  const [levelFilter, setLevelFilter] = useState<string | undefined>();

  const projects = useLiveQuery(() => db.projects.toArray(), []);
  const allHarnesses = useLiveQuery(() => db.harnesses.toArray(), []);
  const { items: trackingItems, loadItems } = useTrackingStore();
  const settings = useSettingsStore();

  useEffect(() => {
    if (projects?.length) {
      projects.forEach((p) => loadItems(p.id));
    }
  }, [projects, loadItems]);

  const alertRows = useMemo<AlertRow[]>(() => {
    if (!projects?.length) return [];
    const rows: AlertRow[] = [];
    const now = new Date().toISOString().slice(0, 10);
    const currentPrices: MetalPrices = settings.defaultMetalPrices;
    const thresholds = {
      copper: { warnPct: settings.alertThresholds.copperPercent || 5, dangerPct: (settings.alertThresholds.copperPercent || 5) * 2 },
      aluminum: { warnPct: settings.alertThresholds.aluminumPercent || 5, dangerPct: (settings.alertThresholds.aluminumPercent || 5) * 2 },
    };

    for (const proj of projects) {
      const basePrices: MetalPrices = proj.config?.metalPrices || currentPrices;
      const result = computeMetalAlerts(basePrices, currentPrices, thresholds);
      for (const item of result.items) {
        if (item.level !== 'normal') {
          rows.push({
            id: `metal-${proj.id}-${item.metal}`,
            type: 'metal',
            typeLabel: '金属价格',
            title: `${item.label}${item.deltaPct > 0 ? '上涨' : '下跌'} ${Math.abs(item.deltaPct).toFixed(1)}%`,
            level: item.level,
            impact: item.deltaPrice,
            detail: item.message,
            project: proj.meta?.projectName,
            date: now,
          });
        }
      }
    }

    for (const item of trackingItems) {
      if (item.status === 'open' || item.status === 'investigating') {
        const proj = projects.find((p) => p.id === item.projectId);
        rows.push({
          id: `anomaly-${item.id}`,
          type: 'anomaly',
          typeLabel: item.category === 'recovery' ? '费用追回' : '异常问题',
          title: item.title,
          level: item.priority === 'high' ? 'danger' : item.priority === 'medium' ? 'warn' : 'normal',
          impact: item.costImpact,
          detail: item.description || '',
          project: proj?.meta?.projectName,
          date: item.createdAt?.slice(0, 10) || now,
        });
      }
    }

    if (allHarnesses?.length) {
      db.onetimeCosts.toArray().then(() => {});
    }

    return rows.sort((a, b) => {
      const levelOrder: Record<AlertLevel, number> = { danger: 0, warn: 1, normal: 2 };
      return levelOrder[a.level] - levelOrder[b.level];
    });
  }, [projects, allHarnesses, trackingItems, settings]);

  const filtered = useMemo(() => {
    let list = alertRows;
    if (activeTab === 'metal') list = list.filter((r) => r.type === 'metal');
    if (activeTab === 'anomaly') list = list.filter((r) => r.type === 'anomaly');
    if (activeTab === 'alloc') list = list.filter((r) => r.type === 'alloc');
    if (levelFilter) list = list.filter((r) => r.level === levelFilter);
    return list;
  }, [alertRows, activeTab, levelFilter]);

  const kpi = useMemo(() => {
    const total = alertRows.length;
    const dangerCount = alertRows.filter((r) => r.level === 'danger').length;
    const warnCount = alertRows.filter((r) => r.level === 'warn').length;
    const totalImpact = alertRows.reduce((s, r) => s + Math.abs(r.impact), 0);
    return { total, dangerCount, warnCount, totalImpact };
  }, [alertRows]);

  const columns = [
    { title: '类别', dataIndex: 'typeLabel', width: 120, render: (v: string) => <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{v}</span> },
    { title: '预警内容', dataIndex: 'title', width: 280, render: (v: string) => <Text strong ellipsis={{ showTooltip: true }} style={{ maxWidth: 260, fontSize: 13 }}>{v}</Text> },
    {
      title: '级别', dataIndex: 'level', width: 90, align: 'center' as const, render: (v: AlertLevel) => {
        const cfg = LEVEL_CONFIG[v];
        return <span style={{ fontSize: 12, fontWeight: 600, color: cfg.color }}>{cfg.label}</span>;
      },
    },
    {
      title: '影响金额', dataIndex: 'impact', width: 130, align: 'right' as const, render: (v: number) => (
        <span className="consolas-font" style={{ fontWeight: 800, fontSize: 14, color: v > 0 ? '#dc2626' : v < 0 ? '#059669' : '#000' }}>
          {v > 0 ? '+' : ''}¥{Math.abs(v).toFixed(2)}
        </span>
      ),
    },
    { title: '关联项目', dataIndex: 'project', width: 160, render: (v: string) => v ? <span style={{ fontSize: 12, fontWeight: 600 }}>{v}</span> : <Text type="tertiary">-</Text> },
    { title: '详情', dataIndex: 'detail', render: (v: string) => <Text type="tertiary" ellipsis={{ showTooltip: true }} style={{ maxWidth: 300, fontSize: 12 }}>{v || '-'}</Text> },
    { title: '日期', dataIndex: 'date', width: 110, render: (v: string) => <span className="consolas-font" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{v}</span> },
  ];

  if (!projects) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: 400 }}><Spin size="large" /></div>;
  }

  return (
    <div className="page-container" style={{ maxWidth: 1400, margin: '0 auto' }}>
      <Title heading={2} className="ink-heading" style={{ marginBottom: 28 }}>预警中心</Title>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: '活跃预警', value: kpi.total, suffix: ' 条', color: '#000' },
          { label: '危险级别', value: kpi.dangerCount, suffix: ' 条', color: kpi.dangerCount > 0 ? '#dc2626' : '#000' },
          { label: '预警级别', value: kpi.warnCount, suffix: ' 条', color: kpi.warnCount > 0 ? '#d97706' : '#000' },
          { label: '总影响金额', value: `¥${kpi.totalImpact.toFixed(2)}`, color: '#000' },
        ].map((card) => (
          <div key={card.label} className="glass-card animate-fade-up" style={{ padding: '24px 20px' }}>
            <Text style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{card.label}</Text>
            <div className="consolas-font" style={{ fontSize: 30, fontWeight: 800, color: card.color, lineHeight: 1 }}>
              {card.value}
              {typeof card.value === 'number' && <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)', marginLeft: 2 }}>{card.suffix}</span>}
            </div>
          </div>
        ))}
      </div>

      <div className="glass-card animate-fade-up" style={{ padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <Tabs type="button" activeKey={activeTab} onChange={setActiveTab} style={{ marginBottom: 0 }}>
            <TabPane tab="全部" itemKey="all" />
            <TabPane tab="金属价格" itemKey="metal" />
            <TabPane tab="异常跟踪" itemKey="anomaly" />
            <TabPane tab="分摊回收" itemKey="alloc" />
          </Tabs>
          <Select
            placeholder="按级别筛选"
            style={{ width: 150 }}
            value={levelFilter}
            onChange={(v) => setLevelFilter(v as string | undefined)}
            showClear
            optionList={[
              { value: 'danger', label: '危险' },
              { value: 'warn', label: '预警' },
              { value: 'normal', label: '正常' },
            ]}
          />
        </div>
        <Table columns={columns} dataSource={filtered} rowKey="id" pagination={{ pageSize: 20 }} empty={<Empty description="暂无预警信息" style={{ padding: '60px 0' }}><div style={{ fontSize: 48, opacity: 0.15, marginBottom: 8 }}><IconAlertTriangle /></div></Empty>} size="small" scroll={{ x: 1100 }} />
      </div>
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
