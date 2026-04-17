/**
 * NewProjectWizard — 4-step project creation wizard (Issue #31)
 *
 * Flow: Basic Info → Volume Plan → Confirm & Create
 *
 * Uses apiClient for backend project creation, then creates a baseline
 * scenario in Dexie and navigates to the project dashboard.
 */
import { useState, useCallback } from 'react';
import {
  Steps,
  Button,
  Typography,
  Toast,
  Card,
  Input,
  InputNumber,
  Space,
  Descriptions,
  Banner,
} from '@douyinfe/semi-ui';
import { IconArrowLeft, IconArrowRight, IconTick } from '@douyinfe/semi-icons';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '@/lib/apiClient';
import { db } from '@/data/db';
import type { ProjectRecord, ScenarioRecord } from '@/data/db';
import type { VolumeSchedule, ProjectConfig } from '@/types/project';
import { useProjectStore } from '@/store/projectStore';
import type { CSSProperties } from 'react';

const { Title, Text } = Typography;

interface BasicInfo {
  projectCode: string;
  projectName: string;
  customer: string;
  platform: string;
  lifecycleYears: number;
}

interface WizardData {
  basic: BasicInfo;
  volumes: VolumeSchedule[];
}

interface StepDef {
  title: string;
  description: string;
}

const STEPS: StepDef[] = [
  { title: '基本信息', description: '项目编号与客户' },
  { title: '产量规划', description: '年度产量计划' },
  { title: '确认创建', description: '预览并创建项目' },
];

const DEFAULT_PROJECT_CONFIG: ProjectConfig = {
  costRates: {
    laborRate: 35,
    mfgRate: 46.69,
    wasteRate: 0.01,
    mgmtRate: 0.06,
    profitRate: 0.056627,
  },
  metalPrices: {
    copper: 72.5,
    aluminum: 20.8,
  },
  volumes: [],
  annualDropRate: 0,
};

const BASIC_PLACEHOLDERS = {
  projectCode: '如 E281',
  projectName: '如 E281高压线束包',
  customer: '如 吉利汽车',
  platform: '如 SEA架构',
};

function makeDefaultVolumes(years: number): VolumeSchedule[] {
  return Array.from({ length: years }, (_, i) => ({
    year: i + 1,
    volume: 0,
    remark: '',
  }));
}

function buildProjectConfig(volumes: VolumeSchedule[]): ProjectConfig {
  return {
    ...DEFAULT_PROJECT_CONFIG,
    costRates: { ...DEFAULT_PROJECT_CONFIG.costRates },
    metalPrices: { ...DEFAULT_PROJECT_CONFIG.metalPrices },
    volumes,
  };
}

function buildApiPayload(data: WizardData) {
  const volumes = data.volumes.filter((v) => v.volume > 0);
  return {
    projectCode: data.basic.projectCode.trim(),
    projectName: data.basic.projectName.trim(),
    customer: data.basic.customer.trim(),
    platform: data.basic.platform.trim() || undefined,
    status: 'draft' as const,
    volumes,
  };
}

function buildProjectRecordConfig(data: WizardData): ProjectConfig {
  return buildProjectConfig(data.volumes.filter((v) => v.volume > 0));
}

function buildScenarioConfig(data: WizardData): ProjectConfig {
  return buildProjectConfig(data.volumes.filter((v) => v.volume > 0));
}

function renderVolumeValue(v: VolumeSchedule) {
  return v.volume.toLocaleString() + ' 台' + (v.remark ? ' (' + v.remark + ')' : '');
}

function renderSetupNotice() {
  return '创建后将自动生成基准场景 (SCN-001 初始报价)，系统默认费率与金属基准请在“设置”中维护。';
}

function renderProjectScopeHint() {
  return '项目创建只录入项目基础信息与生命周期产量，客户模板中的费率/金属价不在此处维护。';
}

function renderConfirmHint() {
  return '客户模板费率、利润率和铜铝基准价不在项目创建时录入，避免混淆内部核算与客户报价口径。';
}

function buildCreateFailureMessage(error: unknown) {
  return '创建失败: ' + (error as Error).message;
}

function buildProjectPath(projectId: string, scenarioId: string) {
  return '/project/' + projectId + '/s/' + scenarioId;
}

const S: Record<string, CSSProperties> = {
  root: { maxWidth: 860, margin: '0 auto', padding: '24px 16px' },
  steps: { marginBottom: 32 },
  card: { marginBottom: 16 },
  field: { marginBottom: 16 },
  label: { display: 'block', marginBottom: 4, fontWeight: 500 },
  row: { display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 },
  yearTag: { minWidth: 60, textAlign: 'center' as const },
  volInput: { flex: 1 },
  remarkInput: { flex: 2 },
  footer: { marginTop: 32, display: 'flex', justifyContent: 'space-between' },
  summarySection: { marginBottom: 16 },
};

export default function NewProjectWizard() {
  const navigate = useNavigate();
  const { setCurrentProject } = useProjectStore();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const [data, setData] = useState<WizardData>({
    basic: {
      projectCode: '',
      projectName: '',
      customer: '',
      platform: '',
      lifecycleYears: 6,
    },
    volumes: makeDefaultVolumes(6),
  });

  const totalVolume = data.volumes.reduce((sum, item) => sum + item.volume, 0);
  const filteredVolumes = data.volumes.filter((v) => v.volume > 0);

  const updateBasic = useCallback((patch: Partial<BasicInfo>) => {
    setData((prev) => {
      const next = { ...prev, basic: { ...prev.basic, ...patch } };
      if (patch.lifecycleYears && patch.lifecycleYears !== prev.basic.lifecycleYears) {
        const old = prev.volumes;
        next.volumes = Array.from({ length: patch.lifecycleYears }, (_, i) => (
          old[i] || { year: i + 1, volume: 0, remark: '' }
        ));
      }
      return next;
    });
  }, []);

  const updateVolume = useCallback((index: number, patch: Partial<VolumeSchedule>) => {
    setData((prev) => {
      const volumes = [...prev.volumes];
      volumes[index] = { ...volumes[index], ...patch } as VolumeSchedule;
      return { ...prev, volumes };
    });
  }, []);

  const validateStep = (currentStep: number): string | null => {
    if (currentStep === 0) {
      if (!data.basic.projectCode.trim()) return '请填写项目编号';
      if (!data.basic.projectName.trim()) return '请填写项目名称';
      if (!data.basic.customer.trim()) return '请填写客户名称';
    }
    if (currentStep === 1 && totalVolume <= 0) {
      return '至少填写一年的产量';
    }
    return null;
  };

  const handleNext = () => {
    const error = validateStep(step);
    if (error) {
      Toast.warning(error);
      return;
    }
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  };

  const handlePrev = () => setStep((current) => Math.max(current - 1, 0));

  const handleCreate = async () => {
    try {
      setSubmitting(true);

      const created = await apiClient<{
        id: string;
        projectCode: string;
        projectName: string;
        customer: string;
        platform?: string;
        status: string;
        createdAt: string;
        updatedAt: string;
      }>('/projects', { method: 'POST', body: buildApiPayload(data) });

      const projectRecord: ProjectRecord = {
        id: created.id,
        meta: {
          id: created.id,
          projectCode: created.projectCode,
          projectName: created.projectName,
          customer: created.customer,
          platform: created.platform,
          status: 'draft',
          createdAt: created.createdAt,
          updatedAt: created.updatedAt,
        },
        config: buildProjectRecordConfig(data),
      };
      await db.projects.put(projectRecord);

      const scenarioId = crypto.randomUUID();
      const now = new Date().toISOString();
      const scenario: ScenarioRecord = {
        id: scenarioId,
        projectId: created.id,
        scenarioCode: 'SCN-001',
        scenarioName: '初始报价',
        scenarioType: 'initial_quote',
        parentScenarioId: null,
        isBaseline: true,
        lifecycleYears: data.basic.lifecycleYears,
        config: buildScenarioConfig(data),
        note: '项目创建时自动生成的基准场景',
        status: 'draft',
        createdAt: now,
        updatedAt: now,
      };
      await db.scenarios.put(scenario);

      setCurrentProject(created.id, created.projectName);
      Toast.success('项目创建成功');
      navigate(buildProjectPath(created.id, scenarioId));
    } catch (error) {
      Toast.error(buildCreateFailureMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={S.root}>
      <Title heading={3}>🆕 新建项目</Title>
      <Steps current={step} style={S.steps}>
        {STEPS.map((item, index) => (
          <Steps.Step key={index} title={item.title} description={item.description} />
        ))}
      </Steps>

      {step === 0 && (
        <Card style={S.card}>
          <div style={S.field}>
            <Text style={S.label}>项目编号 *</Text>
            <Input
              value={data.basic.projectCode}
              placeholder={BASIC_PLACEHOLDERS.projectCode}
              onChange={(value) => updateBasic({ projectCode: value })}
            />
          </div>
          <div style={S.field}>
            <Text style={S.label}>项目名称 *</Text>
            <Input
              value={data.basic.projectName}
              placeholder={BASIC_PLACEHOLDERS.projectName}
              onChange={(value) => updateBasic({ projectName: value })}
            />
          </div>
          <div style={S.field}>
            <Text style={S.label}>客户名称 *</Text>
            <Input
              value={data.basic.customer}
              placeholder={BASIC_PLACEHOLDERS.customer}
              onChange={(value) => updateBasic({ customer: value })}
            />
          </div>
          <div style={S.field}>
            <Text style={S.label}>平台/车型</Text>
            <Input
              value={data.basic.platform}
              placeholder={BASIC_PLACEHOLDERS.platform}
              onChange={(value) => updateBasic({ platform: value })}
            />
          </div>
          <div style={S.field}>
            <Text style={S.label}>生命周期 (年)</Text>
            <InputNumber
              value={data.basic.lifecycleYears}
              min={1}
              max={15}
              onChange={(value) => updateBasic({ lifecycleYears: Number(value) || 6 })}
            />
          </div>
        </Card>
      )}

      {step === 1 && (
        <Card style={S.card} title="年度产量规划">
          <Banner type="info" description="填写项目生命周期内每年的计划产量（台），用于分摊回收计算。" style={S.field} />
          <Banner type="warning" description={renderProjectScopeHint()} style={S.field} />
          {data.volumes.map((item, index) => (
            <div key={index} style={S.row}>
              <Text style={S.yearTag}>第{item.year}年</Text>
              <InputNumber
                style={S.volInput}
                value={item.volume}
                min={0}
                step={1000}
                formatter={(value) => String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={(value) => String(value).replace(/,/g, '')}
                placeholder="年产量"
                onChange={(value) => updateVolume(index, { volume: Number(value) || 0 })}
              />
              <Input
                style={S.remarkInput}
                value={item.remark || ''}
                placeholder="备注"
                onChange={(value) => updateVolume(index, { remark: value })}
              />
            </div>
          ))}
          <Text type="tertiary">生命周期总产量: {totalVolume.toLocaleString()} 台</Text>
        </Card>
      )}

      {step === 2 && (
        <Card style={S.card} title="确认项目配置">
          <Banner type="warning" description="项目创建阶段不录入客户模板成本参数，内部核算基线由系统设置统一维护。" style={S.field} />
          <div style={S.summarySection}>
            <Title heading={6}>基本信息</Title>
            <Descriptions
              data={[
                { key: '项目编号', value: data.basic.projectCode },
                { key: '项目名称', value: data.basic.projectName },
                { key: '客户', value: data.basic.customer },
                { key: '平台', value: data.basic.platform || '-' },
                { key: '生命周期', value: data.basic.lifecycleYears + ' 年' },
              ]}
            />
          </div>
          <div style={S.summarySection}>
            <Title heading={6}>产量规划</Title>
            <Descriptions
              data={filteredVolumes
                .map((item) => ({ key: '第' + item.year + '年', value: renderVolumeValue(item) }))
                .concat([{ key: '总产量', value: totalVolume.toLocaleString() + ' 台' }])}
            />
          </div>
          <Banner type="warning" description={renderConfirmHint()} style={S.field} />
          <Banner type="success" description={renderSetupNotice()} />
        </Card>
      )}

      <div style={S.footer}>
        <Space>
          <Button icon={<IconArrowLeft />} onClick={() => navigate('/')} theme="borderless">
            返回列表
          </Button>
          {step > 0 && (
            <Button icon={<IconArrowLeft />} onClick={handlePrev}>
              上一步
            </Button>
          )}
        </Space>
        {step < STEPS.length - 1 ? (
          <Button type="primary" theme="solid" icon={<IconArrowRight />} iconPosition="right" onClick={handleNext}>
            下一步
          </Button>
        ) : (
          <Button type="primary" theme="solid" icon={<IconTick />} loading={submitting} onClick={handleCreate}>
            ✅ 确认创建项目
          </Button>
        )}
      </div>
    </div>
  );
}
