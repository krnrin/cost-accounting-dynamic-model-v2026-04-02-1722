import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Typography,
  Spin,
  Table,
  Row,
  Col,
  Toast,
  Button,
  Empty,
  Tag,
  Modal,
  Form,
  Select,
  Space,
  Tabs,
  TabPane,
} from '@douyinfe/semi-ui';
import { IconPlus, IconEdit, IconTick } from '@douyinfe/semi-icons';
import { apiClient } from '@/lib/apiClient';

const { Title, Text } = Typography;

type TrackingType = 'agreed_price' | 'progress_price' | 'allocation_recovery' | 'residual' | 'exception';
type TrackingStatus = 'pending' | 'in_progress' | 'to_confirm' | 'completed' | 'closed';
type TrackingSeverity = 'low' | 'medium' | 'high' | 'critical';

interface TrackingItemRecord {
  id: string;
  projectId: string;
  scenarioId: string;
  trackingType: TrackingType;
  title: string;
  sourceRef?: string | null;
  currentStatus: TrackingStatus;
  severity: TrackingSeverity;
  owner?: string | null;
  plannedAction?: string | null;
  actualResult?: string | null;
  closeReason?: string | null;
  warningRef?: string | null;
  closedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TrackingFormValues {
  trackingType: TrackingType;
  title: string;
  sourceRef?: string;
  severity: TrackingSeverity;
  currentStatus?: TrackingStatus;
  owner?: string;
  plannedAction?: string;
  actualResult?: string;
  warningRef?: string;
  closeReason?: string;
}

const TRACKING_TYPE_MAP: Record<TrackingType, { color: string; label: string }> = {
  agreed_price: { color: 'cyan', label: '协议价落实' },
  progress_price: { color: 'indigo', label: '年降谈判' },
  allocation_recovery: { color: 'green', label: '一次性费用回收' },
  residual: { color: 'orange', label: '残余料/呆滞料' },
  exception: { color: 'red', label: '成本偏差' },
};

const STATUS_MAP: Record<TrackingStatus, { color: string; label: string }> = {
  pending: { color: 'red', label: '待处理' },
  in_progress: { color: 'orange', label: '跟进中' },
  to_confirm: { color: 'cyan', label: '待确认' },
  completed: { color: 'green', label: '已完成' },
  closed: { color: 'grey', label: '已关闭' },
};

const SEVERITY_MAP: Record<TrackingSeverity, { color: string; label: string }> = {
  low: { color: 'grey', label: '低' },
  medium: { color: 'blue', label: '中' },
  high: { color: 'orange', label: '高' },
  critical: { color: 'red', label: '严重' },
};

const DEFAULT_FORM: TrackingFormValues = {
  trackingType: 'exception',
  title: '',
  severity: 'medium',
  currentStatus: 'pending',
  sourceRef: '',
  owner: '',
  plannedAction: '',
  actualResult: '',
  warningRef: '',
  closeReason: '',
};

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('zh-CN');
}

export default function TrackingPage() {
  const { id: projectId, sid } = useParams<{ id: string; sid: string }>();
  const [items, setItems] = useState<TrackingItemRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<TrackingItemRecord | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | TrackingType>('all');
  const [statusFilter, setStatusFilter] = useState<TrackingStatus | undefined>();

  const loadItems = useCallback(async () => {
    if (!projectId || !sid) return;
    setLoading(true);
    try {
      const data = await apiClient<TrackingItemRecord[]>(`/projects/${projectId}/scenarios/${sid}/tracking`);
      setItems(Array.isArray(data) ? data : []);
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '跟踪项加载失败');
    } finally {
      setLoading(false);
    }
  }, [projectId, sid]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const filteredItems = useMemo(() => {
    return items
      .filter((item) => (activeTab === 'all' ? true : item.trackingType === activeTab))
      .filter((item) => (statusFilter ? item.currentStatus === statusFilter : true))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [activeTab, items, statusFilter]);

  const kpi = useMemo(() => {
    return {
      pending: items.filter((item) => item.currentStatus === 'pending').length,
      inProgress: items.filter((item) => item.currentStatus === 'in_progress').length,
      toConfirm: items.filter((item) => item.currentStatus === 'to_confirm').length,
      closed: items.filter((item) => item.currentStatus === 'closed').length,
    };
  }, [items]);

  const openModal = (item?: TrackingItemRecord) => {
    setEditingItem(item ?? null);
    setModalVisible(true);
  };

  const closeModal = () => {
    setEditingItem(null);
    setModalVisible(false);
  };

  const handleSubmit = async (values: TrackingFormValues) => {
    if (!projectId || !sid) return;

    const payload = {
      trackingType: values.trackingType,
      title: values.title.trim(),
      sourceRef: values.sourceRef?.trim() || undefined,
      severity: values.severity,
      currentStatus: values.currentStatus,
      owner: values.owner?.trim() || undefined,
      plannedAction: values.plannedAction?.trim() || undefined,
      actualResult: values.actualResult?.trim() || undefined,
      warningRef: values.warningRef?.trim() || undefined,
      closeReason: values.closeReason?.trim() || undefined,
    };

    try {
      if (editingItem) {
        await apiClient(`/tracking/${editingItem.id}`, {
          method: 'PUT',
          body: payload,
        });
        Toast.success('跟踪项已更新');
      } else {
        await apiClient(`/projects/${projectId}/scenarios/${sid}/tracking`, {
          method: 'POST',
          body: {
            projectId,
            ...payload,
          },
        });
        Toast.success('跟踪项已创建');
      }
      closeModal();
      await loadItems();
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '跟踪项保存失败');
    }
  };

  const handleStatusChange = async (item: TrackingItemRecord, nextStatus: TrackingStatus) => {
    try {
      await apiClient(`/tracking/${item.id}`, {
        method: 'PUT',
        body: {
          currentStatus: nextStatus,
        },
      });
      Toast.success(`状态已更新为${STATUS_MAP[nextStatus].label}`);
      await loadItems();
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '状态更新失败');
    }
  };

  const handleClose = async (item: TrackingItemRecord) => {
    Modal.confirm({
      title: '关闭跟踪项',
      content: `确认关闭“${item.title}”吗？`,
      onOk: async () => {
        try {
          await apiClient(`/tracking/${item.id}/close`, {
            method: 'POST',
            body: {
              closeReason: 'Closed from tracking workbench',
            },
          });
          Toast.success('跟踪项已关闭');
          await loadItems();
        } catch (error) {
          Toast.error(error instanceof Error ? error.message : '关闭失败');
        }
      },
    });
  };

  const columns = [
    {
      title: '主题',
      dataIndex: 'title',
      width: 240,
      render: (_: unknown, record: TrackingItemRecord) => (
        <div>
          <Text strong>{record.title}</Text>
          <Text style={{ display: 'block', marginTop: 4 }} type="tertiary">
            {record.sourceRef || '无来源引用'}
          </Text>
        </div>
      ),
    },
    {
      title: '分类',
      dataIndex: 'trackingType',
      width: 130,
      render: (_: unknown, record: TrackingItemRecord) => (
        <Tag color={TRACKING_TYPE_MAP[record.trackingType].color as any}>
          {TRACKING_TYPE_MAP[record.trackingType].label}
        </Tag>
      ),
    },
    {
      title: '严重度',
      dataIndex: 'severity',
      width: 100,
      render: (_: unknown, record: TrackingItemRecord) => (
        <Tag color={SEVERITY_MAP[record.severity].color as any}>
          {SEVERITY_MAP[record.severity].label}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'currentStatus',
      width: 110,
      render: (_: unknown, record: TrackingItemRecord) => (
        <Tag color={STATUS_MAP[record.currentStatus].color as any}>
          {STATUS_MAP[record.currentStatus].label}
        </Tag>
      ),
    },
    {
      title: '负责人',
      dataIndex: 'owner',
      width: 120,
      render: (_: unknown, record: TrackingItemRecord) => record.owner || '—',
    },
    {
      title: '计划动作',
      dataIndex: 'plannedAction',
      render: (_: unknown, record: TrackingItemRecord) => record.plannedAction || '—',
    },
    {
      title: '实际结果',
      dataIndex: 'actualResult',
      render: (_: unknown, record: TrackingItemRecord) => record.actualResult || '—',
    },
    {
      title: '最近更新',
      dataIndex: 'updatedAt',
      width: 170,
      render: (_: unknown, record: TrackingItemRecord) => formatDateTime(record.updatedAt),
    },
    {
      title: '操作',
      width: 220,
      fixed: 'right' as const,
      render: (_: unknown, record: TrackingItemRecord) => (
        <Space>
          <Button icon={<IconEdit />} size="small" theme="borderless" onClick={() => openModal(record)} />
          {record.currentStatus === 'pending' && (
            <Button size="small" theme="light" onClick={() => handleStatusChange(record, 'in_progress')}>
              开始跟进
            </Button>
          )}
          {record.currentStatus === 'in_progress' && (
            <Button size="small" theme="light" onClick={() => handleStatusChange(record, 'to_confirm')}>
              提交确认
            </Button>
          )}
          {record.currentStatus === 'to_confirm' && (
            <Button
              icon={<IconTick />}
              size="small"
              theme="light"
              type="primary"
              onClick={() => handleStatusChange(record, 'completed')}
            >
              标记完成
            </Button>
          )}
          {record.currentStatus !== 'closed' && (
            <Button size="small" theme="borderless" type="danger" onClick={() => handleClose(record)}>
              关闭
            </Button>
          )}
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
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title heading={3} style={{ margin: 0 }}>成本异常治理</Title>
          <Text type="tertiary">场景级跟踪台账，事实源来自 server/Prisma。</Text>
        </div>
        <Button icon={<IconPlus />} theme="solid" onClick={() => openModal()}>
          新建跟踪项
        </Button>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        {[
          { label: '待处理', value: kpi.pending, color: '#ef4444' },
          { label: '跟进中', value: kpi.inProgress, color: '#f59e0b' },
          { label: '待确认', value: kpi.toConfirm, color: '#2563eb' },
          { label: '已关闭', value: kpi.closed, color: '#10b981' },
        ].map((card) => (
          <Col span={6} key={card.label}>
            <div className="glass-card" style={{ padding: '20px 24px', borderRadius: 16, textAlign: 'center' }}>
              <Text type="tertiary" size="small">{card.label}</Text>
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  color: card.color,
                  marginTop: 4,
                  fontFamily: 'JetBrains Mono, Consolas, monospace',
                }}
              >
                {card.value}
              </div>
            </div>
          </Col>
        ))}
      </Row>

      <div className="glass-card" style={{ padding: 24, borderRadius: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Tabs type="button" activeKey={activeTab} onChange={(key) => setActiveTab(key as 'all' | TrackingType)} style={{ marginBottom: 0 }}>
            <TabPane tab="全部" itemKey="all" />
            <TabPane tab="协议价" itemKey="agreed_price" />
            <TabPane tab="年降" itemKey="progress_price" />
            <TabPane tab="回收" itemKey="allocation_recovery" />
            <TabPane tab="残余料" itemKey="residual" />
            <TabPane tab="异常" itemKey="exception" />
          </Tabs>
          <Select
            placeholder="按状态筛选"
            style={{ width: 160 }}
            value={statusFilter}
            onChange={(value) => setStatusFilter(value as TrackingStatus | undefined)}
            showClear
            optionList={[
              { value: 'pending', label: '待处理' },
              { value: 'in_progress', label: '跟进中' },
              { value: 'to_confirm', label: '待确认' },
              { value: 'completed', label: '已完成' },
              { value: 'closed', label: '已关闭' },
            ]}
          />
        </div>

        <Table
          columns={columns}
          dataSource={filteredItems}
          rowKey="id"
          pagination={{ pageSize: 20 }}
          empty={<Empty description="当前场景暂无跟踪项" />}
          size="small"
          scroll={{ x: 1400 }}
        />
      </div>

      <Modal
        title={editingItem ? '编辑跟踪项' : '新建跟踪项'}
        visible={modalVisible}
        onCancel={closeModal}
        footer={null}
        width={640}
      >
        <TrackingForm
          editingItem={editingItem}
          onSubmit={handleSubmit}
          onCancel={closeModal}
        />
      </Modal>
    </div>
  );
}

function TrackingForm({
  editingItem,
  onSubmit,
  onCancel,
}: {
  editingItem: TrackingItemRecord | null;
  onSubmit: (values: TrackingFormValues) => void;
  onCancel: () => void;
}) {
  const defaults: TrackingFormValues = editingItem
    ? {
        trackingType: editingItem.trackingType,
        title: editingItem.title,
        sourceRef: editingItem.sourceRef || '',
        severity: editingItem.severity,
        currentStatus: editingItem.currentStatus,
        owner: editingItem.owner || '',
        plannedAction: editingItem.plannedAction || '',
        actualResult: editingItem.actualResult || '',
        warningRef: editingItem.warningRef || '',
        closeReason: editingItem.closeReason || '',
      }
    : DEFAULT_FORM;

  return (
    <Form
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore Semi Form generic depth
      initValues={defaults}
      onSubmit={(values) => onSubmit(values as TrackingFormValues)}
      labelPosition="left"
      labelWidth={100}
    >
      <Form.Select
        field="trackingType"
        label="分类"
        rules={[{ required: true, message: '请选择分类' }]}
        optionList={[
          { value: 'agreed_price', label: '协议价落实' },
          { value: 'progress_price', label: '年降谈判' },
          { value: 'allocation_recovery', label: '一次性费用回收' },
          { value: 'residual', label: '残余料/呆滞料' },
          { value: 'exception', label: '成本偏差' },
        ]}
      />
      <Form.Input field="title" label="主题" rules={[{ required: true, message: '请输入主题' }]} />
      <Form.Input field="sourceRef" label="来源引用" placeholder="例如: quote/2026-001 or change-ecn-003" />
      <Form.Input field="owner" label="负责人" />
      <Form.Select
        field="severity"
        label="严重度"
        optionList={[
          { value: 'low', label: '低' },
          { value: 'medium', label: '中' },
          { value: 'high', label: '高' },
          { value: 'critical', label: '严重' },
        ]}
      />
      {editingItem && (
        <Form.Select
          field="currentStatus"
          label="状态"
          optionList={[
            { value: 'pending', label: '待处理' },
            { value: 'in_progress', label: '跟进中' },
            { value: 'to_confirm', label: '待确认' },
            { value: 'completed', label: '已完成' },
            { value: 'closed', label: '已关闭' },
          ]}
        />
      )}
      <Form.TextArea field="plannedAction" label="计划动作" rows={3} />
      <Form.TextArea field="actualResult" label="实际结果" rows={3} />
      <Form.Input field="warningRef" label="预警引用" />
      {editingItem?.currentStatus === 'closed' && (
        <Form.TextArea field="closeReason" label="关闭原因" rows={2} />
      )}
      <div style={{ textAlign: 'right', marginTop: 16 }}>
        <Button style={{ marginRight: 8 }} onClick={onCancel}>取消</Button>
        <Button theme="solid" htmlType="submit">{editingItem ? '保存' : '创建'}</Button>
      </div>
    </Form>
  );
}
