import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { IconEdit, IconPlus, IconPriceTag, IconSearch } from '@douyinfe/semi-icons';
import { usePricingStore } from '@/store/pricingStore';
import PricingDiscrepancyPanel from '@/components/PricingDiscrepancyPanel';
import type { ConnectorPricingPayload, ConnectorPricingRecord } from '@/types/pricing';

const { Title, Text } = Typography;

const STATUS_OPTIONS = [
  { value: 'pending', label: '待确认' },
  { value: 'agreed', label: '已协商' },
  { value: 'dispute', label: '有争议' },
  { value: 'approved', label: '已敲定' },
] as const;

type ConnectorFormValues = {
  partNo: string;
  partName: string;
  supplier: string;
  customerAgreedPrice: number;
  supplierQuotedPrice: number;
  finalNegotiatedPrice: number;
  status: ConnectorPricingPayload['status'];
  disputeReason?: string;
  approvedBy?: string;
};

function toPayload(values: ConnectorFormValues): ConnectorPricingPayload {
  return {
    partNo: values.partNo.trim(),
    partName: values.partName.trim(),
    supplier: values.supplier.trim(),
    customerAgreedPrice: values.customerAgreedPrice || 0,
    supplierQuotedPrice: values.supplierQuotedPrice || 0,
    finalNegotiatedPrice: values.finalNegotiatedPrice || 0,
    status: values.status || 'pending',
    disputeReason: values.disputeReason?.trim(),
    approvedBy: values.approvedBy?.trim(),
  };
}

const STATUS_META = {
  pending: { color: 'grey', label: '待确认' },
  agreed: { color: 'blue', label: '已协商' },
  dispute: { color: 'red', label: '有争议' },
  approved: { color: 'green', label: '已敲定' },
} as const satisfies Record<ConnectorPricingRecord['status'], { color: 'grey' | 'blue' | 'red' | 'green'; label: string }>;

export default function ConnectorPricingPage() {
  const { id: projectId, sid: scenarioId } = useParams<{ id: string; sid: string }>();
  const {
    connectorPricing,
    priceDiscrepancies,
    loadPricingData,
    addConnectorPricing,
    updateConnectorPrice,
    isLoading,
    error,
  } = usePricingStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ConnectorPricingPayload['status'] | undefined>();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ConnectorPricingRecord | null>(null);

  useEffect(() => {
    if (!projectId) return;
    void loadPricingData(projectId, scenarioId);
  }, [projectId, scenarioId, loadPricingData]);

  const records = useMemo(() => Array.from(connectorPricing.values()), [connectorPricing]);
  const openDiscrepancyCount = useMemo(
    () => priceDiscrepancies.filter((row) => row.partCategory === 'connector' && (row.status === 'open' || row.status === 'escalated')).length,
    [priceDiscrepancies]
  );

  const filtered = useMemo(() => {
    return records
      .filter((row) => {
        if (searchTerm) {
          const q = searchTerm.toLowerCase();
          if (!row.partNo.toLowerCase().includes(q) && !row.partName.toLowerCase().includes(q)) {
            return false;
          }
        }
        if (statusFilter && row.status !== statusFilter) return false;
        return true;
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [records, searchTerm, statusFilter]);

  const kpi = useMemo(
    () => ({
      total: records.length,
      pending: records.filter((row) => row.status === 'pending').length,
      dispute: records.filter((row) => row.status === 'dispute').length,
      approved: records.filter((row) => row.status === 'approved').length,
      openDiscrepancyCount,
    }),
    [records, openDiscrepancyCount]
  );

  const onSubmit = async (values: ConnectorFormValues) => {
    try {
      const payload = toPayload(values);
      if (editingRecord) {
        await updateConnectorPrice(editingRecord.id, payload);
        Toast.success('连接器价格已更新');
      } else {
        await addConnectorPricing(payload);
        Toast.success('连接器价格已创建');
      }
      setModalVisible(false);
      setEditingRecord(null);
    } catch (submitError) {
      Toast.error(submitError instanceof Error ? submitError.message : '保存失败');
    }
  };

  const columns = [
    {
      title: '料号',
      dataIndex: 'partNo',
      width: 150,
      render: (value: string) => <Text style={{ fontFamily: 'Consolas, monospace', fontWeight: 600 }}>{value}</Text>,
    },
    {
      title: '名称',
      dataIndex: 'partName',
      width: 220,
      render: (value: string) => <Text ellipsis={{ showTooltip: true }} style={{ maxWidth: 200 }}>{value}</Text>,
    },
    { title: '供应商', dataIndex: 'supplier', width: 120 },
    {
      title: '客户协议价',
      dataIndex: 'customerAgreedPrice',
      width: 120,
      align: 'right' as const,
      render: (value: number) => <span className="ledger-number">¥{value.toFixed(2)}</span>,
    },
    {
      title: '供应商报价',
      dataIndex: 'supplierQuotedPrice',
      width: 120,
      align: 'right' as const,
      render: (value: number) => <span className="ledger-number">¥{value.toFixed(2)}</span>,
    },
    {
      title: '敲定价',
      dataIndex: 'finalNegotiatedPrice',
      width: 120,
      align: 'right' as const,
      render: (value: number) =>
        value > 0 ? <span className="ledger-number" style={{ color: '#059669', fontWeight: 700 }}>¥{value.toFixed(2)}</span> : '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      align: 'center' as const,
      render: (value: ConnectorPricingRecord['status']) => {
        const meta = STATUS_META[value];
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      width: 120,
      render: (value: string) => value.slice(0, 10),
    },
    {
      title: '操作',
      width: 80,
      fixed: 'right' as const,
      render: (_: unknown, row: ConnectorPricingRecord) => (
        <Button
          icon={<IconEdit />}
          size="small"
          theme="borderless"
          onClick={() => {
            setEditingRecord(row);
            setModalVisible(true);
          }}
        />
      ),
    },
  ];

  if (isLoading) {
    return (
      <div style={{ minHeight: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1360, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Title heading={3} style={{ margin: 0 }}>
          <IconPriceTag style={{ marginRight: 8 }} />
          连接器价格管理
        </Title>
        <Button
          icon={<IconPlus />}
          theme="solid"
          onClick={() => {
            setEditingRecord(null);
            setModalVisible(true);
          }}
        >
          新建记录
        </Button>
      </div>

      {error ? (
        <Card style={{ marginBottom: 16 }}>
          <Text type="danger">加载失败: {error}</Text>
        </Card>
      ) : null}

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={5}><Card><Text type="tertiary">总记录</Text><div style={{ fontSize: 26, fontWeight: 800 }}>{kpi.total}</div></Card></Col>
        <Col span={5}><Card><Text type="tertiary">待确认</Text><div style={{ fontSize: 26, fontWeight: 800 }}>{kpi.pending}</div></Card></Col>
        <Col span={5}><Card><Text type="tertiary">争议中</Text><div style={{ fontSize: 26, fontWeight: 800, color: '#dc2626' }}>{kpi.dispute}</div></Card></Col>
        <Col span={5}><Card><Text type="tertiary">已敲定</Text><div style={{ fontSize: 26, fontWeight: 800, color: '#059669' }}>{kpi.approved}</div></Card></Col>
        <Col span={4}><Card><Text type="tertiary">未关闭差异</Text><div style={{ fontSize: 26, fontWeight: 800, color: '#dc2626' }}>{kpi.openDiscrepancyCount}</div></Card></Col>
      </Row>

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <Input
            style={{ width: 240 }}
            value={searchTerm}
            onChange={setSearchTerm}
            prefix={<IconSearch />}
            placeholder="搜索料号/名称"
          />
          <Select
            style={{ width: 150 }}
            value={statusFilter}
            onChange={(value) => setStatusFilter(value as ConnectorPricingPayload['status'] | undefined)}
            showClear
            placeholder="状态筛选"
            optionList={STATUS_OPTIONS.map((item) => ({ value: item.value, label: item.label }))}
          />
        </div>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={filtered}
          size="small"
          pagination={{ pageSize: 20 }}
          scroll={{ x: 1150 }}
          empty={<Empty description="暂无连接器价格数据" />}
        />
      </Card>

      <PricingDiscrepancyPanel category="connector" projectId={projectId} scenarioId={scenarioId} />

      <Modal
        visible={modalVisible}
        title={editingRecord ? '编辑连接器价格' : '新建连接器价格'}
        onCancel={() => {
          setModalVisible(false);
          setEditingRecord(null);
        }}
        footer={null}
        width={560}
      >
        <ConnectorPricingForm
          initial={editingRecord}
          onSubmit={onSubmit}
          onCancel={() => {
            setModalVisible(false);
            setEditingRecord(null);
          }}
        />
      </Modal>
    </div>
  );
}

function ConnectorPricingForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial: ConnectorPricingRecord | null;
  onSubmit: (values: ConnectorFormValues) => Promise<void> | void;
  onCancel: () => void;
}) {
  const defaults: ConnectorFormValues = initial
    ? {
        partNo: initial.partNo,
        partName: initial.partName,
        supplier: initial.supplier,
        customerAgreedPrice: initial.customerAgreedPrice,
        supplierQuotedPrice: initial.supplierQuotedPrice,
        finalNegotiatedPrice: initial.finalNegotiatedPrice,
        status: initial.status,
        disputeReason: initial.disputeReason || '',
        approvedBy: initial.approvedBy || '',
      }
    : {
        partNo: '',
        partName: '',
        supplier: '',
        customerAgreedPrice: 0,
        supplierQuotedPrice: 0,
        finalNegotiatedPrice: 0,
        status: 'pending',
        disputeReason: '',
        approvedBy: '',
      };

  return (
    <Form<ConnectorFormValues>
      initValues={defaults}
      labelPosition="left"
      labelWidth={110}
      onSubmit={(values) => void onSubmit(values)}
    >
      <Form.Input field="partNo" label="料号" rules={[{ required: true, message: '请输入料号' }]} />
      <Form.Input field="partName" label="名称" rules={[{ required: true, message: '请输入名称' }]} />
      <Form.Input field="supplier" label="供应商" />
      <Form.InputNumber field="customerAgreedPrice" label="客户协议价" min={0} prefix="¥" />
      <Form.InputNumber field="supplierQuotedPrice" label="供应商报价" min={0} prefix="¥" />
      <Form.InputNumber field="finalNegotiatedPrice" label="敲定价" min={0} prefix="¥" />
      <Form.Select
        field="status"
        label="状态"
        optionList={STATUS_OPTIONS.map((item) => ({ value: item.value, label: item.label }))}
      />
      <Form.Input field="disputeReason" label="争议说明" />
      <Form.Input field="approvedBy" label="审批人" />
      <div style={{ textAlign: 'right', marginTop: 16 }}>
        <Space>
          <Button onClick={onCancel}>取消</Button>
          <Button theme="solid" htmlType="submit">{initial ? '保存' : '创建'}</Button>
        </Space>
      </div>
    </Form>
  );
}
