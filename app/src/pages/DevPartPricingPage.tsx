import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Space,
  Spin,
  TabPane,
  Table,
  Tabs,
  Tag,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { IconBox, IconEdit, IconPlus, IconSearch, IconSetting } from '@douyinfe/semi-icons';
import PricingDiscrepancyPanel from '@/components/PricingDiscrepancyPanel';
import { usePricingStore } from '@/store/pricingStore';
import type { DevPartCategory, DevPartMoldPayload, DevPartPricingPayload, DevPartPricingRecord } from '@/types/pricing';

const { Title, Text } = Typography;

const CATEGORY_META: Record<DevPartCategory, { label: string; color: 'blue' | 'amber' | 'red' | 'grey'; code: string }> = {
  plastic: { label: '塑胶件', color: 'blue', code: 'HB' },
  metal: { label: '金属件', color: 'amber', code: 'ZJ' },
  rubber: { label: '橡胶件', color: 'red', code: 'XJ' },
  other: { label: '其他', color: 'grey', code: 'OTHER' },
};

type DevPartFormValues = {
  category: DevPartCategory;
  seq: number;
  partName: string;
  amortizationQty: number;
  unitPriceAfterAmortization: number;
  lifecycleTotalQty: number;
};

type MoldFormValues = {
  moldType: 'sample' | 'mass';
  moldName: string;
  moldCost: number;
};

export default function DevPartPricingPage() {
  const { id: projectId, sid: scenarioId } = useParams<{ id: string; sid: string }>();
  const {
    devPartPricing,
    priceDiscrepancies,
    loadPricingData,
    addDevPartPricing,
    addDevPartMold,
    updateDevPartAmortization,
    calculateDevPartPrice,
    isLoading,
    error,
  } = usePricingStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | DevPartCategory>('all');
  const [createVisible, setCreateVisible] = useState(false);
  const [moldVisible, setMoldVisible] = useState(false);
  const [analysisVisible, setAnalysisVisible] = useState(false);
  const [selectedPart, setSelectedPart] = useState<DevPartPricingRecord | null>(null);

  useEffect(() => {
    if (!projectId) return;
    void loadPricingData(projectId, scenarioId);
  }, [projectId, scenarioId, loadPricingData]);

  const records = useMemo(() => Array.from(devPartPricing.values()), [devPartPricing]);
  const openDiscrepancyCount = useMemo(
    () => priceDiscrepancies.filter((row) => row.partCategory === 'dev_part' && (row.status === 'open' || row.status === 'escalated')).length,
    [priceDiscrepancies]
  );

  const filtered = useMemo(() => {
    return records
      .filter((row) => {
        if (activeTab !== 'all' && row.category !== activeTab) return false;
        if (!searchTerm) return true;
        const q = searchTerm.toLowerCase();
        return row.partNo.toLowerCase().includes(q) || row.partName.toLowerCase().includes(q);
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [records, activeTab, searchTerm]);

  const kpi = useMemo(
    () => ({
      total: records.length,
      plastic: records.filter((r) => r.category === 'plastic').length,
      metal: records.filter((r) => r.category === 'metal').length,
      rubber: records.filter((r) => r.category === 'rubber').length,
      moldTotal: records.reduce((sum, row) => sum + row.molds.reduce((acc, mold) => acc + mold.moldCost, 0), 0),
      openDiscrepancyCount,
    }),
    [records, openDiscrepancyCount]
  );

  const onCreate = async (values: DevPartFormValues) => {
    if (!projectId) return;
    const categoryCode = CATEGORY_META[values.category].code;
    const partNo = `${projectId}-${categoryCode}-${String(values.seq).padStart(2, '0')}`;
    const payload: DevPartPricingPayload = {
      partNo,
      partName: values.partName.trim(),
      category: values.category,
      amortizationQty: values.amortizationQty || 0,
      unitPriceAfterAmortization: values.unitPriceAfterAmortization || 0,
      lifecycleTotalQty: values.lifecycleTotalQty || 0,
    };
    try {
      await addDevPartPricing(payload);
      setCreateVisible(false);
      Toast.success('开发件价格记录已创建');
    } catch (submitError) {
      Toast.error(submitError instanceof Error ? submitError.message : '创建失败');
    }
  };

  const onAddMold = async (values: MoldFormValues) => {
    if (!selectedPart) return;
    const payload: DevPartMoldPayload = {
      moldType: values.moldType,
      moldName: values.moldName.trim(),
      moldCost: values.moldCost || 0,
    };
    try {
      await addDevPartMold(selectedPart.partNo, payload);
      setMoldVisible(false);
      Toast.success('模具已添加并重算分摊');
    } catch (submitError) {
      Toast.error(submitError instanceof Error ? submitError.message : '新增模具失败');
    }
  };

  const columns = [
    {
      title: '料号',
      dataIndex: 'partNo',
      width: 180,
      render: (value: string) => <Text style={{ fontFamily: 'Consolas, monospace', fontWeight: 600 }}>{value}</Text>,
    },
    {
      title: '名称',
      dataIndex: 'partName',
      width: 220,
      render: (value: string) => <Text ellipsis={{ showTooltip: true }} style={{ maxWidth: 200 }}>{value}</Text>,
    },
    {
      title: '类别',
      dataIndex: 'category',
      width: 90,
      render: (value: DevPartCategory) => <Tag color={CATEGORY_META[value].color}>{CATEGORY_META[value].label}</Tag>,
    },
    {
      title: '模具数',
      width: 90,
      align: 'right' as const,
      render: (_: unknown, row: DevPartPricingRecord) => row.molds.length,
    },
    {
      title: '模具总费',
      width: 120,
      align: 'right' as const,
      render: (_: unknown, row: DevPartPricingRecord) => {
        const total = row.molds.reduce((sum, mold) => sum + mold.moldCost, 0);
        return <span className="ledger-number">¥{total.toFixed(2)}</span>;
      },
    },
    {
      title: '分摊量',
      dataIndex: 'amortizationQty',
      width: 120,
      align: 'right' as const,
      render: (value: number) => <span className="ledger-number">{value.toLocaleString()}</span>,
    },
    {
      title: '批量价',
      dataIndex: 'unitPriceAfterAmortization',
      width: 100,
      align: 'right' as const,
      render: (value: number) => <span className="ledger-number">¥{value.toFixed(2)}</span>,
    },
    {
      title: '含分摊价',
      dataIndex: 'unitPriceWithAmortization',
      width: 110,
      align: 'right' as const,
      render: (value: number) => <span className="ledger-number" style={{ color: '#b45309', fontWeight: 700 }}>¥{value.toFixed(2)}</span>,
    },
    {
      title: '操作',
      width: 150,
      fixed: 'right' as const,
      render: (_: unknown, row: DevPartPricingRecord) => (
        <Space>
          <Button
            icon={<IconSetting />}
            size="small"
            theme="borderless"
            onClick={() => {
              setSelectedPart(row);
              setMoldVisible(true);
            }}
          />
          <Button
            icon={<IconEdit />}
            size="small"
            theme="borderless"
            onClick={() => {
              setSelectedPart(row);
              setAnalysisVisible(true);
            }}
          />
        </Space>
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
          <IconBox style={{ marginRight: 8 }} />
          开发件价格管理
        </Title>
        <Button icon={<IconPlus />} theme="solid" onClick={() => setCreateVisible(true)}>新建开发件</Button>
      </div>

      {error ? (
        <Card style={{ marginBottom: 16 }}>
          <Text type="danger">加载失败: {error}</Text>
        </Card>
      ) : null}

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}><Card><Text type="tertiary">总数</Text><div style={{ fontSize: 24, fontWeight: 800 }}>{kpi.total}</div></Card></Col>
        <Col span={4}><Card><Text type="tertiary">塑胶件</Text><div style={{ fontSize: 24, fontWeight: 800 }}>{kpi.plastic}</div></Card></Col>
        <Col span={4}><Card><Text type="tertiary">金属件</Text><div style={{ fontSize: 24, fontWeight: 800 }}>{kpi.metal}</div></Card></Col>
        <Col span={4}><Card><Text type="tertiary">橡胶件</Text><div style={{ fontSize: 24, fontWeight: 800 }}>{kpi.rubber}</div></Card></Col>
        <Col span={4}><Card><Text type="tertiary">模具总费用</Text><div style={{ fontSize: 20, fontWeight: 800 }}>¥{kpi.moldTotal.toLocaleString()}</div></Card></Col>
        <Col span={4}><Card><Text type="tertiary">未关闭差异</Text><div style={{ fontSize: 24, fontWeight: 800, color: '#dc2626' }}>{kpi.openDiscrepancyCount}</div></Card></Col>
      </Row>

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <Tabs type="button" activeKey={activeTab} onChange={(key) => setActiveTab(key as 'all' | DevPartCategory)} style={{ marginBottom: 0 }}>
            <TabPane itemKey="all" tab="全部" />
            <TabPane itemKey="plastic" tab="塑胶件" />
            <TabPane itemKey="metal" tab="金属件" />
            <TabPane itemKey="rubber" tab="橡胶件" />
          </Tabs>
          <Input
            style={{ width: 240 }}
            value={searchTerm}
            onChange={setSearchTerm}
            prefix={<IconSearch />}
            placeholder="搜索料号/名称"
          />
        </div>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filtered}
          size="small"
          pagination={{ pageSize: 20 }}
          scroll={{ x: 1300 }}
          empty={<Empty description="暂无开发件价格数据" />}
        />
      </Card>

      <PricingDiscrepancyPanel category="dev_part" projectId={projectId} scenarioId={scenarioId} />

      <Modal
        visible={createVisible}
        title="新建开发件价格"
        onCancel={() => setCreateVisible(false)}
        footer={null}
        width={520}
      >
        <CreateDevPartForm onSubmit={onCreate} onCancel={() => setCreateVisible(false)} />
      </Modal>

      <Modal
        visible={moldVisible}
        title={`新增模具 - ${selectedPart?.partNo || ''}`}
        onCancel={() => setMoldVisible(false)}
        footer={null}
      >
        <AddMoldForm
          selectedPart={selectedPart}
          onSubmit={onAddMold}
          onCancel={() => setMoldVisible(false)}
        />
      </Modal>

      <Modal
        visible={analysisVisible}
        title={`生命周期分摊分析 - ${selectedPart?.partNo || ''}`}
        onCancel={() => setAnalysisVisible(false)}
        footer={null}
        width={700}
      >
        <LifecyclePanel
          selectedPart={selectedPart}
          calculateDevPartPrice={calculateDevPartPrice}
          updateDevPartAmortization={updateDevPartAmortization}
          onClose={() => setAnalysisVisible(false)}
        />
      </Modal>
    </div>
  );
}

function CreateDevPartForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (values: DevPartFormValues) => Promise<void> | void;
  onCancel: () => void;
}) {
  const defaults: DevPartFormValues = {
    category: 'plastic',
    seq: 1,
    partName: '',
    amortizationQty: 15000,
    unitPriceAfterAmortization: 0,
    lifecycleTotalQty: 600000,
  };

  return (
    <Form<DevPartFormValues>
      initValues={defaults}
      labelPosition="left"
      labelWidth={120}
      onSubmit={(values) => void onSubmit(values)}
    >
      <Form.Select
        field="category"
        label="类别"
        optionList={[
          { value: 'plastic', label: '塑胶件(HB)' },
          { value: 'metal', label: '金属件(ZJ)' },
          { value: 'rubber', label: '橡胶件(XJ)' },
          { value: 'other', label: '其他(OTHER)' },
        ]}
      />
      <Form.InputNumber field="seq" label="序号" min={1} />
      <Form.Input field="partName" label="名称" rules={[{ required: true, message: '请输入名称' }]} />
      <Form.InputNumber field="amortizationQty" label="分摊数量" min={0} />
      <Form.InputNumber field="unitPriceAfterAmortization" label="批量价" min={0} prefix="¥" />
      <Form.InputNumber field="lifecycleTotalQty" label="生命周期总量" min={0} />
      <div style={{ textAlign: 'right', marginTop: 16 }}>
        <Space>
          <Button onClick={onCancel}>取消</Button>
          <Button theme="solid" htmlType="submit">创建</Button>
        </Space>
      </div>
    </Form>
  );
}

function AddMoldForm({
  selectedPart,
  onSubmit,
  onCancel,
}: {
  selectedPart: DevPartPricingRecord | null;
  onSubmit: (values: MoldFormValues) => Promise<void> | void;
  onCancel: () => void;
}) {
  const defaults: MoldFormValues = {
    moldType: 'mass',
    moldName: '',
    moldCost: 0,
  };

  return (
    <Form<MoldFormValues>
      initValues={defaults}
      labelPosition="left"
      labelWidth={110}
      onSubmit={(values) => void onSubmit(values)}
    >
      <Form.Select
        field="moldType"
        label="模具类型"
        optionList={[
          { value: 'sample', label: '样件模具' },
          { value: 'mass', label: '量产模具' },
        ]}
      />
      <Form.Input field="moldName" label="模具名称" rules={[{ required: true, message: '请输入模具名称' }]} />
      <Form.InputNumber field="moldCost" label="模具费用" min={0} prefix="¥" />
      <div style={{ marginBottom: 12 }}>
        <Text type="tertiary">当前对象: {selectedPart?.partNo || '-'}</Text>
      </div>
      <div style={{ textAlign: 'right' }}>
        <Space>
          <Button onClick={onCancel}>取消</Button>
          <Button theme="solid" htmlType="submit">保存</Button>
        </Space>
      </div>
    </Form>
  );
}

function LifecyclePanel({
  selectedPart,
  calculateDevPartPrice,
  updateDevPartAmortization,
  onClose,
}: {
  selectedPart: DevPartPricingRecord | null;
  calculateDevPartPrice: (partNo: string, lifecycleTotalQty: number) => { unitPrice: number; breakdown: unknown } | null;
  updateDevPartAmortization: (partNo: string, amortizationQty: number, unitPriceAfterAmortization: number) => Promise<void>;
  onClose: () => void;
}) {
  const [lifecycleQty, setLifecycleQty] = useState<number>(selectedPart?.lifecycleTotalQty ?? 600000);
  const [amortizationQty, setAmortizationQty] = useState<number>(selectedPart?.amortizationQty ?? 0);
  const [unitPriceAfterAmortization, setUnitPriceAfterAmortization] = useState<number>(selectedPart?.unitPriceAfterAmortization ?? 0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLifecycleQty(selectedPart?.lifecycleTotalQty ?? 600000);
    setAmortizationQty(selectedPart?.amortizationQty ?? 0);
    setUnitPriceAfterAmortization(selectedPart?.unitPriceAfterAmortization ?? 0);
  }, [selectedPart]);

  const analysis = useMemo(() => {
    if (!selectedPart) return null;
    return calculateDevPartPrice(selectedPart.partNo, lifecycleQty);
  }, [selectedPart, calculateDevPartPrice, lifecycleQty]);

  return (
    <div>
      <Descriptions data={[
        { key: '料号', value: selectedPart?.partNo || '-' },
        { key: '名称', value: selectedPart?.partName || '-' },
        { key: '模具数', value: selectedPart?.molds.length ?? 0 },
        { key: '当前含分摊价', value: selectedPart ? `¥${selectedPart.unitPriceWithAmortization.toFixed(2)}` : '-' },
      ]} />

      <Card style={{ marginTop: 12 }}>
        <Space align="center">
          <Text>生命周期总量</Text>
          <InputNumber value={lifecycleQty} min={0} onChange={(value) => setLifecycleQty(Number(value || 0))} />
          <Text type="tertiary">用于估算生命周期均价</Text>
        </Space>
      </Card>

      <Card style={{ marginTop: 12 }}>
        <Space align="center">
          <Text>分摊数量</Text>
          <InputNumber value={amortizationQty} min={0} onChange={(value) => setAmortizationQty(Number(value || 0))} />
          <Text>批量价</Text>
          <InputNumber value={unitPriceAfterAmortization} min={0} onChange={(value) => setUnitPriceAfterAmortization(Number(value || 0))} />
        </Space>
      </Card>

      <Card style={{ marginTop: 12 }}>
        <Text type="tertiary">生命周期估算</Text>
        <div style={{ fontSize: 24, fontWeight: 700, marginTop: 8 }}>
          {analysis ? `¥${analysis.unitPrice.toFixed(2)}` : '-'}
        </div>
      </Card>

      <div style={{ textAlign: 'right', marginTop: 16 }}>
        <Space>
          <Button onClick={onClose}>关闭</Button>
          <Button
            theme="solid"
            loading={submitting}
            onClick={async () => {
              if (!selectedPart) return;
              setSubmitting(true);
              try {
                await updateDevPartAmortization(selectedPart.partNo, amortizationQty, unitPriceAfterAmortization);
                Toast.success('分摊参数已更新');
                onClose();
              } catch (error) {
                Toast.error(error instanceof Error ? error.message : '更新失败');
              } finally {
                setSubmitting(false);
              }
            }}
          >
            保存参数
          </Button>
        </Space>
      </div>
    </div>
  );
}
