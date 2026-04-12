/**
 * A4: 新建项目 UI 向导 (Issue #31)
 * 四步向导: 基本信息 → 线束配置 → 成本参数 → 确认创建
 */
import { useState } from 'react';
import { Steps, Form, Input, InputNumber, Button, ArrayField, Typography, Toast, Card } from '@douyinfe/semi-ui';
import type { ProjectConfig } from '@/types/project';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

interface WizardStep {
  title: string;
  description: string;
}

const STEPS: WizardStep[] = [
  { title: '基本信息', description: '项目编号与客户' },
  { title: '线束配置', description: '添加线束与车型比例' },
  { title: '成本参数', description: '费率与金属价格' },
  { title: '确认创建', description: '预览并创建项目' },
];

export default function NewProjectWizard() {
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState<Partial<ProjectConfig>>({
    projectCode: '',
    projectName: '',
    customer: '',
    platform: '',
    lifecycleYears: 6,
    vehicleConfigs: [],
    costRates: {
      laborRate: 35,
      mfgRate: 45,
      wasteRate: 0.02,
      mgmtRate: 0.06,
      profitRate: 0.0001,
    },
    metalPrices: {
      copper: 65000,
      aluminum: 18000,
    },
  });
  const navigate = useNavigate();

  const handleNext = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
  };
  const handlePrev = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleCreate = async () => {
    try {
      const { db } = await import('@/data/db');
      const projectId = `proj-${formData.projectCode}-${Date.now()}`;
      await db.table('projects').add({
        id: projectId,
        ...formData,
        createdAt: new Date().toISOString(),
        status: 'draft',
      });
      Toast.success('项目创建成功');
      navigate(`/project/${projectId}`);
    } catch (e) {
      Toast.error('创建失败: ' + (e as Error).message);
    }
  };

  return (
    <div style= maxWidth: 800, margin: '0 auto', padding: 24 >
      <Title heading={3}>🆕 新建项目</Title>
      <Steps current={step} style= marginBottom: 24 >
        {STEPS.map((s, i) => (
          <Steps.Step key={i} title={s.title} description={s.description} />
        ))}
      </Steps>

      {step === 0 && (
        <Card>
          <Form
            initValues={formData}
            onValueChange={(values) => setFormData({ ...formData, ...values })}
          >
            <Form.Input field="projectCode" label="项目编号" placeholder="如 G281" rules={[{ required: true }]} />
            <Form.Input field="projectName" label="项目名称" placeholder="如 G281主驾线束包" />
            <Form.Input field="customer" label="客户名称" />
            <Form.Input field="platform" label="平台/车型" />
            <Form.InputNumber field="lifecycleYears" label="生命周期(年)" min={1} max={15} />
          </Form>
        </Card>
      )}

      {step === 1 && (
        <Card title="线束与车型配置">
          <Text type="tertiary">添加线束号，设置标配/选配比例</Text>
          <Form initValues={formData} onValueChange={(v) => setFormData({ ...formData, ...v })}>
            <ArrayField field="vehicleConfigs">
              {({ add, arrayFields }) => (
                <>
                  {arrayFields.map(({ field, key, remove }) => (
                    <div key={key} style= display: 'flex', gap: 8, marginBottom: 8 >
                      <Form.Input field={`${field}.harnessId`} placeholder="线束号" style= flex: 2  />
                      <Form.Input field={`${field}.configType`} placeholder="标配/选配" style= flex: 1  />
                      <Form.InputNumber field={`${field}.vehicleRatio`} placeholder="装车比" min={0} max={1} step={0.01} style= flex: 1  />
                      <Button type="danger" theme="borderless" onClick={remove}>删除</Button>
                    </div>
                  ))}
                  <Button onClick={add} theme="light">+ 添加线束</Button>
                </>
              )}
            </ArrayField>
          </Form>
        </Card>
      )}

      {step === 2 && (
        <Card title="成本参数">
          <Form initValues={formData} onValueChange={(v) => setFormData({ ...formData, ...v })}>
            <Form.InputNumber field="costRates.laborRate" label="人工费率(元/h)" />
            <Form.InputNumber field="costRates.mfgRate" label="制造费率(元/h)" />
            <Form.InputNumber field="costRates.wasteRate" label="废品率" step={0.001} />
            <Form.InputNumber field="costRates.mgmtRate" label="管理费率" step={0.01} />
            <Form.InputNumber field="costRates.profitRate" label="利润率" step={0.0001} />
            <Form.InputNumber field="metalPrices.copper" label="铜基准价(元/吨)" />
            <Form.InputNumber field="metalPrices.aluminum" label="铝基准价(元/吨)" />
          </Form>
        </Card>
      )}

      {step === 3 && (
        <Card title="确认项目配置">
          <pre style= background: '#f5f5f5', padding: 16, borderRadius: 8, fontSize: 12, overflow: 'auto', maxHeight: 400 >
            {JSON.stringify(formData, null, 2)}
          </pre>
        </Card>
      )}

      <div style= marginTop: 24, display: 'flex', justifyContent: 'space-between' >
        <Button disabled={step === 0} onClick={handlePrev}>上一步</Button>
        {step < STEPS.length - 1 ? (
          <Button type="primary" theme="solid" onClick={handleNext}>下一步</Button>
        ) : (
          <Button type="primary" theme="solid" onClick={handleCreate}>✅ 确认创建项目</Button>
        )}
      </div>
    </div>
  );
}
