import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Steps,
  Form,
  Button,
  Card,
  Typography,
  Table,
  Banner,
  Layout,
  Divider,
  InputNumber,
  Input,
  Space,
  Toast,
} from '@douyinfe/semi-ui';
import { IconPlus, IconDelete, IconArrowRight, IconArrowLeft, IconTick } from '@douyinfe/semi-icons';
import { db, type ProjectRecord } from '@/data/db';
import type { VolumeSchedule } from '@/types/project';

const { Title, Text } = Typography;
const { Content } = Layout;

const WizardPage: React.FC = () => {

  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);

  // Form states
  const [basicInfo, setBasicInfo] = useState({
    projectCode: '',
    projectName: '',
    customer: '',
    platform: '',
    lifecycleYears: 7,
  });

  const [rates, setRates] = useState({
    laborRate: 35,
    mfgRate: 46.69,
    wasteRate: 0.01,
    mgmtRate: 0.06,
    profitRate: 0.056627,
    copper: 72800,
    aluminum: 20500,
    annualDropRate: 3,
  });

  const [volumes, setVolumes] = useState<VolumeSchedule[]>(
    Array.from({ length: 7 }, (_, i) => ({ year: i + 1, volume: 0 }))
  );

  const [nreData, setNreData] = useState({
    borrowedTooling: 0,
    newTooling: 0,
    borrowedTesting: 0,
    newTesting: 0,
    borrowedRnd: 0,
    newRnd: 0,
    amortizationVolume: 0,
  });

  const handleNext = () => setCurrentStep(currentStep + 1);
  const handlePrev = () => setCurrentStep(currentStep - 1);

  const handleAddYear = () => {
    const nextYear = volumes.length + 1;
    setVolumes([...volumes, { year: nextYear, volume: 0 }]);
  };

  const handleRemoveYear = (year: number) => {
    setVolumes(volumes.filter((v) => v.year !== year).map((v, i) => ({ ...v, year: i + 1 })));
  };

  const handleVolumeChange = (year: number, value: number) => {
    setVolumes(volumes.map((v) => (v.year === year ? { ...v, volume: value } : v)));
  };

  const handleRemarkChange = (year: number, value: string) => {
    setVolumes(volumes.map((v) => (v.year === year ? { ...v, remark: value } : v)));
  };

  const createProject = async () => {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const newProject: ProjectRecord = {
      id,
      meta: {
        projectCode: basicInfo.projectCode,
        projectName: basicInfo.projectName,
        customer: basicInfo.customer,
        platform: basicInfo.platform,
        lifecycleYears: basicInfo.lifecycleYears,
        createdAt: now,
        updatedAt: now,
        status: 'draft',
      },
      config: {
        costRates: {
          laborRate: rates.laborRate,
          mfgRate: rates.mfgRate,
          wasteRate: rates.wasteRate,
          mgmtRate: rates.mgmtRate,
          profitRate: rates.profitRate,
        },
        metalPrices: {
          copper: rates.copper,
          aluminum: rates.aluminum,
        },
        volumes: volumes,
        annualDropRate: rates.annualDropRate / 100,
        nreData: nreData,
      },
    };

    try {
      await db.projects.put(newProject);
      navigate(`/project/${id}`);
    } catch (err) {
      console.error('Failed to create project:', err);
      Toast.error('创建项目失败，请重试');
    }
  };

  const renderStep1 = () => (
    <Form
      initValues={basicInfo}
      onValueChange={(values) => setBasicInfo((prev) => ({ ...prev, ...values }))}
      style={{ width: '100%', maxWidth: 600, margin: '0 auto' }}
    >
      <Form.Input field="projectCode" label="项目编号" placeholder="例如: E281" required />
      <Form.Input field="projectName" label="项目名称" placeholder="例如: 吉利E281高压线束" required />
      <Form.Input field="customer" label="客户名称" placeholder="例如: 吉利汽车" required />
      <Form.Input field="platform" label="平台/车型" placeholder="例如: G281 / SEA" />
      <Form.InputNumber
        field="lifecycleYears"
        label="生命周期 (年)"
        min={1}
        max={15}
        onChange={(val) => {
          const newYears = Number(val);
          if (newYears > volumes.length) {
            const added = Array.from({ length: newYears - volumes.length }, (_, i) => ({
              year: volumes.length + i + 1,
              volume: 0,
            }));
            setVolumes([...volumes, ...added]);
          } else if (newYears < volumes.length) {
            setVolumes(volumes.slice(0, newYears));
          }
        }}
      />
    </Form>
  );

  const renderStep2 = () => (
    <Form
      initValues={rates}
      onValueChange={(values) => setRates((prev) => ({ ...prev, ...values }))}
      style={{ width: '100%', maxWidth: 800, margin: '0 auto' }}
    >
      <Title heading={5} style={{ marginBottom: 16 }}>
        成本费率
      </Title>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
        <Form.InputNumber field="laborRate" label="直接人工费率 (元/小时)" step={0.1} />
        <Form.InputNumber field="mfgRate" label="制造费率 (元/小时)" step={0.01} />
        <Form.InputNumber field="wasteRate" label="废品率" step={0.001} showClear />
        <Form.InputNumber field="mgmtRate" label="管理费率" step={0.001} />
        <Form.InputNumber field="profitRate" label="利润率" step={0.0001} />
        <Form.InputNumber field="annualDropRate" label="年降率 (%)" min={0} max={20} step={0.5} />
      </div>
      <Divider style={{ margin: '24px 0' }} />
      <Title heading={5} style={{ marginBottom: 16 }}>
        金属价格 (元/吨)
      </Title>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
        <Form.InputNumber field="copper" label="铜价 (Cu)" step={100} />
        <Form.InputNumber field="aluminum" label="铝价 (Al)" step={100} />
      </div>
    </Form>
  );

  const renderStep3 = () => {
    const columns = [
      {
        title: '年度',
        dataIndex: 'year',
        render: (text: number) => `第 ${text} 年`,
      },
      {
        title: '年产量 (台)',
        dataIndex: 'volume',
        render: (_: any, record: VolumeSchedule) => (
          <InputNumber
            value={record.volume}
            onChange={(val) => handleVolumeChange(record.year, Number(val))}
            style={{ width: '100%' }}
          />
        ),
      },
      {
        title: '备注',
        dataIndex: 'remark',
        render: (_: any, record: VolumeSchedule) => (
          <Input
            value={record.remark ?? ''}
            onChange={(val) => handleRemarkChange(record.year, val)}
            style={{ width: '100%' }}
          />
        ),
      },
      {
        title: '操作',
        dataIndex: 'action',
        render: (_: any, record: VolumeSchedule) => (
          <Button
            icon={<IconDelete />}
            type="danger"
            theme="borderless"
            onClick={() => handleRemoveYear(record.year)}
          />
        ),
      },
    ];

    return (
      <div style={{ width: '100%', maxWidth: 800, margin: '0 auto' }}>
        <Title heading={5} style={{ marginBottom: 16 }}>产量计划</Title>
        <Table columns={columns} dataSource={volumes} pagination={false} />
        <Button
          icon={<IconPlus />}
          onClick={handleAddYear}
          style={{ marginTop: 16 }}
          block
          theme="light"
        >
          添加年度
        </Button>

        <Card className="glass-card" title="一次性费用 (NRE分摊)" style={{ marginTop: 32 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px' }}>
            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>借用工装费用</Text>
              <InputNumber 
                value={nreData.borrowedTooling} 
                onChange={v => setNreData(prev => ({ ...prev, borrowedTooling: Number(v) }))}
                prefix="¥"
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>新开工装费用</Text>
              <InputNumber 
                value={nreData.newTooling} 
                onChange={v => setNreData(prev => ({ ...prev, newTooling: Number(v) }))}
                prefix="¥"
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>借用试验费用</Text>
              <InputNumber 
                value={nreData.borrowedTesting} 
                onChange={v => setNreData(prev => ({ ...prev, borrowedTesting: Number(v) }))}
                prefix="¥"
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>新开试验费用</Text>
              <InputNumber 
                value={nreData.newTesting} 
                onChange={v => setNreData(prev => ({ ...prev, newTesting: Number(v) }))}
                prefix="¥"
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>借用研发费用</Text>
              <InputNumber 
                value={nreData.borrowedRnd} 
                onChange={v => setNreData(prev => ({ ...prev, borrowedRnd: Number(v) }))}
                prefix="¥"
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>新开研发费用</Text>
              <InputNumber 
                value={nreData.newRnd} 
                onChange={v => setNreData(prev => ({ ...prev, newRnd: Number(v) }))}
                prefix="¥"
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>分摊数量</Text>
              <Space>
                <InputNumber 
                  value={nreData.amortizationVolume} 
                  onChange={v => setNreData(prev => ({ ...prev, amortizationVolume: Number(v) }))}
                  suffix="台"
                  style={{ width: 240 }}
                  placeholder="留空或0将自动使用前3年产量"
                />
                <Button 
                  theme="light" 
                  onClick={() => {
                    const first3 = volumes.slice(0, 3).reduce((sum, v) => sum + (v.volume || 0), 0);
                    setNreData(prev => ({ ...prev, amortizationVolume: first3 }));
                  }}
                >
                  自动计算 (前3年产量)
                </Button>
              </Space>
            </div>
          </div>
        </Card>
      </div>
    );
  };

  const renderStep4 = () => (
    <div style={{ width: '100%', maxWidth: 800, margin: '0 auto' }}>
      <Card className="glass-card"
        title="项目信息确认"
        headerExtraContent={
          <Text type="secondary">
            ID: <Text copyable>Auto-Generated</Text>
          </Text>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <Text strong>项目编号: </Text>
            <Text>{basicInfo.projectCode}</Text>
          </div>
          <div>
            <Text strong>项目名称: </Text>
            <Text>{basicInfo.projectName}</Text>
          </div>
          <div>
            <Text strong>客户: </Text>
            <Text>{basicInfo.customer}</Text>
          </div>
          <div>
            <Text strong>平台: </Text>
            <Text>{basicInfo.platform || '-'}</Text>
          </div>
          <div>
            <Text strong>生命周期: </Text>
            <Text>{basicInfo.lifecycleYears} 年</Text>
          </div>
        </div>

        <Divider style={{ margin: '16px 0' }} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <Text strong>人工费率: </Text>
            <Text>{rates.laborRate} 元/h</Text>
          </div>
          <div>
            <Text strong>制造费率: </Text>
            <Text>{rates.mfgRate} 元/h</Text>
          </div>
          <div>
            <Text strong>基准铜价: </Text>
            <Text>{rates.copper} 元/t</Text>
          </div>
          <div>
            <Text strong>基准铝价: </Text>
            <Text>{rates.aluminum} 元/t</Text>
          </div>
          <div>
            <Text strong>年降率: </Text>
            <Text>{rates.annualDropRate}%</Text>
          </div>
        </div>

        <Divider style={{ margin: '16px 0' }} />

        <Text strong>产量计划摘要: </Text>
        <div style={{ marginTop: 8 }}>
          {volumes.slice(0, 3).map((v) => (
            <span key={v.year} style={{ marginRight: 16 }}>
              Year {v.year}: {v.volume}
            </span>
          ))}
          {volumes.length > 3 && <span>... (+{volumes.length - 3} years)</span>}
        </div>

        <Divider style={{ margin: '16px 0' }} />

        <Text strong>NRE 分摊配置: </Text>
        <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <div><Text type="secondary">工装: </Text><Text>¥{(nreData.borrowedTooling + nreData.newTooling).toLocaleString()}</Text></div>
          <div><Text type="secondary">试验: </Text><Text>¥{(nreData.borrowedTesting + nreData.newTesting).toLocaleString()}</Text></div>
          <div><Text type="secondary">研发: </Text><Text>¥{(nreData.borrowedRnd + nreData.newRnd).toLocaleString()}</Text></div>
          <div><Text type="secondary">分摊量: </Text><Text>{nreData.amortizationVolume || '自动计算'} 台</Text></div>
        </div>
      </Card>
      <Banner
        fullMode={false}
        type="info"
        bordered
        description="创建项目后，您可以进入项目详情页导入 BOM 数据或手动添加线束号。"
        style={{ marginTop: 16 }}
      />
    </div>
  );

  return (
    <Layout style={{ minHeight: '100vh', padding: '40px 20px' }}>
      <Content style={{ maxWidth: 1000, margin: '0 auto', width: '100%' }}>
        <Card className="glass-card" style={{ padding: '20px 40px' }}>
          <Title heading={2} style={{ textAlign: 'center', marginBottom: 40 }}>
            创建新核算项目
          </Title>

          <Steps current={currentStep} style={{ marginBottom: 40 }}>
            <Steps.Step title="基本信息" description="填写项目背景" />
            <Steps.Step title="费率配置" description="设定费率与基价" />
            <Steps.Step title="产量计划" description="规划生命周期产量" />
            <Steps.Step title="确认" description="核对并创建" />
          </Steps>

          <div style={{ minHeight: 400, marginBottom: 40 }}>
            {currentStep === 0 && renderStep1()}
            {currentStep === 1 && renderStep2()}
            {currentStep === 2 && renderStep3()}
            {currentStep === 3 && renderStep4()}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button
              icon={<IconArrowLeft />}
              onClick={handlePrev}
              disabled={currentStep === 0}
              theme="light"
            >
              上一步
            </Button>
            {currentStep < 3 ? (
              <Button
                icon={<IconArrowRight />}
                iconPosition="right"
                onClick={handleNext}
                theme="solid"
              >
                下一步
              </Button>
            ) : (
              <Button icon={<IconTick />} theme="solid" onClick={createProject}>
                创建项目
              </Button>
            )}
          </div>
        </Card>
      </Content>
    </Layout>
  );
};

export default WizardPage;
