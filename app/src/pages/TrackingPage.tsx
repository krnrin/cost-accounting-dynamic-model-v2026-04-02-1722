/**
 * 跟踪页 — 异常问题 & 费用追回跟踪
 */
import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  Typography, Spin, Table, Row, Col, Toast, Button, Empty, Tag,
  Modal, Form, Select, Space, Tabs, TabPane,
} from '@douyinfe/semi-ui';
import { IconPlus, IconEdit, IconDelete, IconTick } from '@douyinfe/semi-icons';
import type { TrackingItemRecord } from '@/data/db';
import { useTrackingStore } from '@/store/trackingStore';

const { Title, Text } = Typography;

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  open: { color: 'red', label: '待处理' },
  investigating: { color: 'orange', label: '调查中' },
  resolved: { color: 'green', label: '已解决' },
  closed: { color: 'grey', label: '已关闭' },
};

const PRIORITY_MAP: Record<string, { color: string; label: string }> = {
  high: { color: 'red', label: '高' },
  medium: { color: 'orange', label: '中' },
  low: { color: 'blue', label: '低' },
};

const CATEGORY_MAP: Record<string, { color: string; label: string }> = {
  anomaly: { color: 'amber', label: '异常问题' },
  recovery: { color: 'cyan', label: '费用追回' },
};

export default function TrackingPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const { items, loading, loadItems, addItem, updateItem, deleteItem } = useTrackingStore();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<TrackingItemRecord | null>(null);
  const [activeTab, setActiveTab] = useState('all');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();

  useEffect(() => {
    if (projectId) loadItems(projectId);
  }, [projectId, loadItems]);

  // 筛选
  const filtered = useMemo(() => {
    let list = items;
    if (activeTab === 'anomaly') list = list.filter(i => i.category === 'anomaly');
    if (activeTab === 'recovery') list = list.filter(i => i.category === 'recovery');
    if (statusFilter) list = list.filter(i => i.status === statusFilter);
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [items, activeTab, statusFilter]);

  // KPI
  const kpi = useMemo(() => {
    const open = items.filter(i => i.status === 'open').length;
    const investigating = items.filter(i => i.status === 'investigating').length;
    const totalImpact = items.reduce((s, i) => s + i.costImpact, 0);
    const recoveryItems = items.filter(i => i.category === 'recovery');
    const totalRecoveryTarget = recoveryItems.reduce((s, i) => s + i.costImpact, 0);
    const totalRecovered = recoveryItems.reduce((s, i) => s + (i.recoveredAmount ?? 0), 0);
    const recoveryRate = totalRecoveryTarget > 0 ? totalRecovered / totalRecoveryTarget : 0;
    return { open, investigating, totalImpact, recoveryRate };
  }, [items]);

  // 新建/编辑
  const openModal = (item?: TrackingItemRecord) => {
    setEditingItem(item ?? null);
    setModalVisible(true);
  };

  const handleSubmit = async (values: any) => {
    if (!projectId) return;
    const now = new Date().toISOString();
    if (editingItem) {
      await updateItem(editingItem.id, {
        ...values,
        recoveredAmount: values.recoveredAmount ?? undefined,
      });
      Toast.success('跟踪项已更新');
    } else {
      const item: TrackingItemRecord = {
        id: `track-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        projectId,
        ...values,
        recoveredAmount: values.recoveredAmount ?? undefined,
        costImpact: values.costImpact ?? 0,
        status: 'open',
        createdAt: now,
        updatedAt: now,
      };
      await addItem(item);
      Toast.success('跟踪项已创建');
    }
    setModalVisible(false);
    setEditingItem(null);
  };

  const handleDelete = async (item: TrackingItemRecord) => {
    if (!projectId) return;
    Modal.confirm({
      title: '确认删除',
      content: `确定删除「${item.title}」？`,
      onOk: async () => {
        await deleteItem(item.id, projectId);
        Toast.success('已删除');
      },
    });
  };

  const handleStatusChange = async (item: TrackingItemRecord, newStatus: string) => {
    const patch: Partial<TrackingItemRecord> = { status: newStatus as any };
    if (newStatus === 'resolved') patch.resolvedAt = new Date().toISOString();
    await updateItem(item.id, patch);
    Toast.success(`状态已更新为「${STATUS_MAP[newStatus]?.label}」`);
  };

  const columns = [
    {
      title: '标题',
      dataIndex: 'title',
      width: 260,
      render: (v: string) => <Text strong ellipsis={{ showTooltip: true }} style={{ maxWidth: 240 }}>{v}</Text>,
    },
    {
      title: '类别',
      dataIndex: 'category',
      width: 100,
      align: 'center' as const,
      render: (v: string) => {
        const c = CATEGORY_MAP[v];
        return c ? <Tag color={c.color as any}>{c.label}</Tag> : v;
      },
    },
    {
      title: '线束号',
      dataIndex: 'harnessId',
      width: 120,
      render: (v: string) => v ? <Text style={{ fontFamily: 'JetBrains Mono, Consolas, monospace' }}>{v}</Text> : '-',
    },
    {
      title: '零件号',
      dataIndex: 'partNo',
      width: 140,
      render: (v: string) => v ? <Text style={{ fontFamily: 'JetBrains Mono, Consolas, monospace' }}>{v}</Text> : '-',
    },
    {
      title: '影响金额',
      dataIndex: 'costImpact',
      width: 110,
      align: 'right' as const,
      render: (v: number) => <span className="ledger-number" style={{ fontWeight: 700 }}>¥{v.toFixed(2)}</span>,
    },
    {
      title: '已追回',
      dataIndex: 'recoveredAmount',
      width: 100,
      align: 'right' as const,
      render: (v: number | undefined, record: TrackingItemRecord) =>
        record.category === 'recovery' ? <span className="ledger-number">¥{(v ?? 0).toFixed(2)}</span> : '-',
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 80,
      align: 'center' as const,
      render: (v: string) => {
        const p = PRIORITY_MAP[v];
        return p ? <Tag color={p.color as any} size="small">{p.label}</Tag> : v;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      align: 'center' as const,
      render: (v: string) => {
        const s = STATUS_MAP[v];
        return s ? <Tag color={s.color as any}>{s.label}</Tag> : v;
      },
    },
    {
      title: '创建日期',
      dataIndex: 'createdAt',
      width: 110,
      render: (v: string) => v ? v.slice(0, 10) : '-',
    },
    {
      title: '操作',
      width: 160,
      fixed: 'right' as const,
      render: (_: any, record: TrackingItemRecord) => (
        <Space>
          <Button icon={<IconEdit />} size="small" theme="borderless" onClick={() => openModal(record)} />
          {record.status === 'open' && (
            <Button icon={<IconTick />} size="small" theme="borderless" type="tertiary"
              onClick={() => handleStatusChange(record, 'investigating')} />
          )}
          {record.status === 'investigating' && (
            <Button icon={<IconTick />} size="small" theme="borderless" type="primary"
              onClick={() => handleStatusChange(record, 'resolved')} />
          )}
          <Button icon={<IconDelete />} size="small" theme="borderless" type="danger"
            onClick={() => handleDelete(record)} />
        </Space>
      ),
    },
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title heading={3} style={{ margin: 0 }}>跟踪管理</Title>
        <Button icon={<IconPlus />} theme="solid" onClick={() => openModal()}>新建跟踪项</Button>
      </div>

      {/* KPI Cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        {[
          { label: '待处理', value: kpi.open, color: '#ef4444' },
          { label: '调查中', value: kpi.investigating, color: '#f59e0b' },
          { label: '总影响金额', value: `¥${kpi.totalImpact.toFixed(2)}`, color: '#2563eb' },
          { label: '追回率', value: `${(kpi.recoveryRate * 100).toFixed(1)}%`, color: '#10b981' },
        ].map((card) => (
          <Col span={6} key={card.label}>
            <div className="glass-card" style={{ padding: '20px 24px', borderRadius: 16, textAlign: 'center' }}>
              <Text type="tertiary" size="small">{card.label}</Text>
              <div style={{ fontSize: 28, fontWeight: 800, color: card.color, marginTop: 4, fontFamily: 'JetBrains Mono, Consolas, monospace' }}>
                {card.value}
              </div>
            </div>
          </Col>
        ))}
      </Row>

      {/* Tabs + Filter */}
      <div className="glass-card" style={{ padding: 24, borderRadius: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Tabs type="button" activeKey={activeTab} onChange={setActiveTab} style={{ marginBottom: 0 }}>
            <TabPane tab="全部" itemKey="all" />
            <TabPane tab="异常问题" itemKey="anomaly" />
            <TabPane tab="费用追回" itemKey="recovery" />
          </Tabs>
          <Select
            placeholder="按状态筛选"
            style={{ width: 140 }}
            value={statusFilter}
            onChange={v => setStatusFilter(v as string | undefined)}
            showClear
            optionList={[
              { value: 'open', label: '待处理' },
              { value: 'investigating', label: '调查中' },
              { value: 'resolved', label: '已解决' },
              { value: 'closed', label: '已关闭' },
            ]}
          />
        </div>

        <Table
          columns={columns}
          dataSource={filtered}
          rowKey="id"
          pagination={{ pageSize: 20 }}
          empty={<Empty description="暂无跟踪项" />}
          size="small"
          scroll={{ x: 1200 }}
        />
      </div>

      {/* Create/Edit Modal */}
      <Modal
        title={editingItem ? '编辑跟踪项' : '新建跟踪项'}
        visible={modalVisible}
        onCancel={() => { setModalVisible(false); setEditingItem(null); }}
        footer={null}
        width={560}
      >
        <TrackingForm
          key={editingItem?.id ?? 'new'}
          editingItem={editingItem}
          onSubmit={handleSubmit}
          onCancel={() => { setModalVisible(false); setEditingItem(null); }}
        />
      </Modal>
    </div>
  );
}

function TrackingForm({ editingItem, onSubmit, onCancel }: {
  editingItem: TrackingItemRecord | null;
  onSubmit: (values: any) => void;
  onCancel: () => void;
}) {
  const defaults: Record<string, any> = editingItem ?? { category: 'anomaly', priority: 'medium', costImpact: 0 };
  return (
    <Form
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore — Semi Form deep type instantiation
      initValues={defaults}
      onSubmit={onSubmit}
      labelPosition="left"
      labelWidth={90}
    >
      <Form.Select field="category" label="类别" rules={[{ required: true }]}
        optionList={[
          { value: 'anomaly', label: '异常问题' },
          { value: 'recovery', label: '费用追回' },
        ]}
      />
      <Form.Input field="title" label="标题" rules={[{ required: true, message: '请输入标题' }]} />
      <Form.TextArea field="description" label="描述" rows={3} />
      <Form.Input field="harnessId" label="线束号" />
      <Form.Input field="harnessName" label="线束名称" />
      <Form.Input field="partNo" label="零件号" />
      <Form.Input field="partName" label="零件名称" />
      <Form.InputNumber field="costImpact" label="影响金额" prefix="¥" min={0} style={{ width: '100%' }} />
      {editingItem?.category === 'recovery' && (
        <Form.InputNumber field="recoveredAmount" label="已追回" prefix="¥" min={0} style={{ width: '100%' }} />
      )}
      <Form.Select field="priority" label="优先级"
        optionList={[
          { value: 'high', label: '高' },
          { value: 'medium', label: '中' },
          { value: 'low', label: '低' },
        ]}
      />
      {editingItem && (
        <Form.Select field="status" label="状态"
          optionList={[
            { value: 'open', label: '待处理' },
            { value: 'investigating', label: '调查中' },
            { value: 'resolved', label: '已解决' },
            { value: 'closed', label: '已关闭' },
          ]}
        />
      )}
      <Form.TextArea field="note" label="备注" rows={2} />
      <div style={{ textAlign: 'right', marginTop: 16 }}>
        <Button style={{ marginRight: 8 }} onClick={onCancel}>取消</Button>
        <Button theme="solid" htmlType="submit">{editingItem ? '保存' : '创建'}</Button>
      </div>
    </Form>
  );
}
