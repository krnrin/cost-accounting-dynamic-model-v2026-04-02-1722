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
  Space,
  Spin,
  Table,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { IconBolt, IconEdit, IconPlus, IconSearch } from '@douyinfe/semi-icons';
import PricingDiscrepancyPanel from '@/components/PricingDiscrepancyPanel';
import { usePricingStore } from '@/store/pricingStore';
import type { WirePricingPayload, WirePricingRecord } from '@/types/pricing';

const { Title, Text } = Typography;

type WireFormValues = {
  partNo: string;
  partName: string;
  supplier: string;
  wireSize: string;
  copperWeightG: number;
  aluminumWeightG: number;
  nonMetalCost: number;
  processingFee: number;
};

function toPayload(values: WireFormValues, copperBasePrice: number, aluminumBasePrice: number): WirePricingPayload {
  return {
    partNo: values.partNo.trim(),
    partName: values.partName.trim(),
    supplier: values.supplier.trim(),
    wireSize: values.wireSize.trim(),
    copperWeightG: values.copperWeightG || 0,
    aluminumWeightG: values.aluminumWeightG || 0,
    nonMetalCost: values.nonMetalCost || 0,
    processingFee: values.processingFee || 0,
    copperBasePrice,
    aluminumBasePrice,
  };
}

export default function WirePricingPage() {
  const { id: projectId, sid: scenarioId } = useParams<{ id: string; sid: string }>();
  const {
    wirePricing,
    metalPrices,
    priceDiscrepancies,
    loadPricingData,
    addWirePricing,
    updateWirePricingRecord,
    batchUpdateWirePrices,
    isLoading,
    error,
  } = usePricingStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [metalModalVisible, setMetalModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<WirePricingRecord | null>(null);

  useEffect(() => {
    if (!projectId) return;
    void loadPricingData(projectId, scenarioId);
  }, [projectId, scenarioId, loadPricingData]);

  const records = useMemo(() => Array.from(wirePricing.values()), [wirePricing]);
  const openDiscrepancyCount = useMemo(
    () => priceDiscrepancies.filter((row) => row.partCategory === 'wire' && (row.status === 'open' || row.status === 'escalated')).length,
    [priceDiscrepancies]
  );

  const filtered = useMemo(() => {
    return records
      .filter((row) => {
        if (!searchTerm) return true;
        const q = searchTerm.toLowerCase();
        return row.partNo.toLowerCase().includes(q) || row.partName.toLowerCase().includes(q);
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [records, searchTerm]);

  const kpi = useMemo(
    () => ({
      total: records.length,
      copperKg: records.reduce((sum, row) => sum + row.copperWeightG, 0) / 1000,
      aluminumKg: records.reduce((sum, row) => sum + row.aluminumWeightG, 0) / 1000,
      openDiscrepancyCount,
    }),
    [records, openDiscrepancyCount]
  );

  const onSubmit = async (values: WireFormValues) => {
    try {
      const payload = toPayload(values, metalPrices.copper, metalPrices.aluminum);
      if (editingRecord) {
        await updateWirePricingRecord(editingRecord.id, payload);
        Toast.success('导线价格已更新');
      } else {
        await addWirePricing(payload);
        Toast.success('导线价格已创建');
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
      width: 160,
      render: (value: string) => <Text style={{ fontFamily: 'Consolas, monospace', fontWeight: 600 }}>{value}</Text>,
    },
    {
      title: '名称',
      dataIndex: 'partName',
      width: 220,
      render: (value: string) => <Text ellipsis={{ showTooltip: true }} style={{ maxWidth: 200 }}>{value}</Text>,
    },
    {
      title: '规格',
      dataIndex: 'wireSize',
      width: 100,
      render: (value: string) => value || '-',
    },
    {
      title: '铜重(g)',
      dataIndex: 'copperWeightG',
      width: 100,
      align: 'right' as const,
      render: (value: number) => <span className="ledger-number">{value.toFixed(2)}</span>,
    },
    {
      title: '铝重(g)',
      dataIndex: 'aluminumWeightG',
      width: 100,
      align: 'right' as const,
      render: (value: number) => <span className="ledger-number">{value.toFixed(2)}</span>,
    },
    {
      title: '非金属成本',
      dataIndex: 'nonMetalCost',
      width: 120,
      align: 'right' as const,
      render: (value: number) => <span className="ledger-number">¥{value.toFixed(2)}</span>,
    },
    {
      title: '加工费',
      dataIndex: 'processingFee',
      width: 100,
      align: 'right' as const,
      render: (value: number) => <span className="ledger-number">¥{value.toFixed(2)}</span>,
    },
    {
      title: '计算价',
      dataIndex: 'calculatedPrice',
      width: 120,
      align: 'right' as const,
      render: (value: number) => <span className="ledger-number" style={{ color: '#2563eb', fontWeight: 700 }}>¥{value.toFixed(2)}</span>,
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
      render: (_: unknown, row: WirePricingRecord) => (
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
      <div style={{ minHeight: 320, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1360, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Title heading={3} style={{ margin: 0 }}>
          <IconBolt style={{ marginRight: 8 }} />
          导线价格管理
        </Title>
        <Space>
          <Button onClick={() => setMetalModalVisible(true)}>更新铜铝基价</Button>
          <Button
            icon={<IconPlus />}
            theme="solid"
            onClick={() => {
              setEditingRecord(null);
              setModalVisible(true);
            }}
          >
            新建导线
          </Button>
        </Space>
      </div>

      {error ? (
        <Card style={{ marginBottom: 16 }}>
          <Text type="danger">加载失败: {error}</Text>
        </Card>
      ) : null}

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={8}><Text type="tertiary">铜基价</Text><div style={{ fontSize: 28, fontWeight: 800 }}>¥{metalPrices.copper.toLocaleString()}/kg</div></Col>
          <Col span={8}><Text type="tertiary">铝基价</Text><div style={{ fontSize: 28, fontWeight: 800 }}>¥{metalPrices.aluminum.toLocaleString()}/kg</div></Col>
          <Col span={8}><Text type="tertiary">更新时间</Text><div style={{ marginTop: 6 }}>{metalPrices.timestamp.slice(0, 10)}</div></Col>
        </Row>
      </Card>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card><Text type="tertiary">导线数</Text><div style={{ fontSize: 26, fontWeight: 800 }}>{kpi.total}</div></Card></Col>
        <Col span={6}><Card><Text type="tertiary">铜总重</Text><div style={{ fontSize: 26, fontWeight: 800 }}>{kpi.copperKg.toFixed(2)} kg</div></Card></Col>
        <Col span={6}><Card><Text type="tertiary">铝总重</Text><div style={{ fontSize: 26, fontWeight: 800 }}>{kpi.aluminumKg.toFixed(2)} kg</div></Card></Col>
        <Col span={6}><Card><Text type="tertiary">未关闭差异</Text><div style={{ fontSize: 26, fontWeight: 800, color: '#dc2626' }}>{kpi.openDiscrepancyCount}</div></Card></Col>
      </Row>

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <Input
            value={searchTerm}
            onChange={setSearchTerm}
            style={{ width: 240 }}
            prefix={<IconSearch />}
            placeholder="搜索料号/名称"
          />
          <Text type="tertiary">公式: 铜重*铜价/1000 + 铝重*铝价/1000 + 非金属成本 + 加工费</Text>
        </div>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filtered}
          size="small"
          pagination={{ pageSize: 20 }}
          scroll={{ x: 1280 }}
          empty={<Empty description="暂无导线价格数据" />}
        />
      </Card>

      <PricingDiscrepancyPanel category="wire" projectId={projectId} scenarioId={scenarioId} />

      <Modal
        visible={modalVisible}
        title={editingRecord ? '编辑导线价格' : '新建导线价格'}
        onCancel={() => {
          setModalVisible(false);
          setEditingRecord(null);
        }}
        footer={null}
        width={580}
      >
        <WirePricingForm
          initial={editingRecord}
          onSubmit={onSubmit}
          onCancel={() => {
            setModalVisible(false);
            setEditingRecord(null);
          }}
        />
      </Modal>

      <Modal
        visible={metalModalVisible}
        title="批量重算导线价格"
        onCancel={() => setMetalModalVisible(false)}
        footer={null}
      >
        <MetalPriceForm
          copper={metalPrices.copper}
          aluminum={metalPrices.aluminum}
          onSubmit={async (copperBasePrice, aluminumBasePrice) => {
            try {
              await batchUpdateWirePrices({
                copper: copperBasePrice,
                aluminum: aluminumBasePrice,
              });
              setMetalModalVisible(false);
              Toast.success('已按最新铜铝基价重算导线价格');
            } catch (submitError) {
              Toast.error(submitError instanceof Error ? submitError.message : '重算失败');
            }
          }}
          onCancel={() => setMetalModalVisible(false)}
        />
      </Modal>
    </div>
  );
}

function WirePricingForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial: WirePricingRecord | null;
  onSubmit: (values: WireFormValues) => Promise<void> | void;
  onCancel: () => void;
}) {
  const defaults: WireFormValues = initial
    ? {
        partNo: initial.partNo,
        partName: initial.partName,
        supplier: initial.supplier,
        wireSize: initial.wireSize,
        copperWeightG: initial.copperWeightG,
        aluminumWeightG: initial.aluminumWeightG,
        nonMetalCost: initial.nonMetalCost,
        processingFee: initial.processingFee,
      }
    : {
        partNo: '',
        partName: '',
        supplier: '',
        wireSize: '',
        copperWeightG: 0,
        aluminumWeightG: 0,
        nonMetalCost: 0,
        processingFee: 0,
      };

  return (
    <Form<WireFormValues>
      initValues={defaults}
      labelPosition="left"
      labelWidth={110}
      onSubmit={(values) => void onSubmit(values)}
    >
      <Form.Input field="partNo" label="料号" rules={[{ required: true, message: '请输入料号' }]} />
      <Form.Input field="partName" label="名称" rules={[{ required: true, message: '请输入名称' }]} />
      <Form.Input field="supplier" label="供应商" />
      <Form.Input field="wireSize" label="规格" />
      <Form.InputNumber field="copperWeightG" label="铜重(g)" min={0} />
      <Form.InputNumber field="aluminumWeightG" label="铝重(g)" min={0} />
      <Form.InputNumber field="nonMetalCost" label="非金属成本" min={0} prefix="¥" />
      <Form.InputNumber field="processingFee" label="加工费" min={0} prefix="¥" />
      <div style={{ textAlign: 'right', marginTop: 16 }}>
        <Space>
          <Button onClick={onCancel}>取消</Button>
          <Button theme="solid" htmlType="submit">{initial ? '保存' : '创建'}</Button>
        </Space>
      </div>
    </Form>
  );
}

function MetalPriceForm({
  copper,
  aluminum,
  onSubmit,
  onCancel,
}: {
  copper: number;
  aluminum: number;
  onSubmit: (copper: number, aluminum: number) => Promise<void> | void;
  onCancel: () => void;
}) {
  return (
    <Form<{ copper: number; aluminum: number }>
      initValues={{ copper, aluminum }}
      labelPosition="left"
      labelWidth={90}
      onSubmit={(values) => void onSubmit(values.copper, values.aluminum)}
    >
      <Form.InputNumber field="copper" label="铜基价(¥/kg)" min={0} />
      <Form.InputNumber field="aluminum" label="铝基价(¥/kg)" min={0} />
      <div style={{ textAlign: 'right', marginTop: 16 }}>
        <Space>
          <Button onClick={onCancel}>取消</Button>
          <Button theme="solid" htmlType="submit">重算</Button>
        </Space>
      </div>
    </Form>
  );
}
