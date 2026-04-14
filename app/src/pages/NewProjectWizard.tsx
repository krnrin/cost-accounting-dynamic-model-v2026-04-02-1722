/**
 * NewProjectWizard — 4-step project creation wizard (Issue #31)
 *
 * Flow: Basic Info → Volume Plan → Cost Rates → Confirm & Create
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
import type { CostRates, MetalPrices, VolumeSchedule, ProjectConfig } from '@/types/project';
import { useProjectStore } from '@/store/projectStore';
import type { CSSProperties } from 'react';

const { Title, Text } = Typography;

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

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
  costRates: CostRates;
  metalPrices: MetalPrices;
}

interface StepDef {
  title: string;
  description: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const STEPS: StepDef[] = [
  { title: '基本信息', description: '项目编号与客户' },
  { title: '产量规划', description: '年度产量计划' },
  { title: '成本参数', description: '费率与金属价格' },
  { title: '确认创建', description: '预览并创建项目' },
];

const DEFAULT_COST_RATES: CostRates = {
  laborRate: 35,
  mfgRate: 46.69,
  wasteRate: 0.01,
  mgmtRate: 0.06,
  profitRate: 0.056627,
};

const DEFAULT_METAL_PRICES: MetalPrices = {
  copper: 72.5,
  aluminum: 20.8,
};

function makeDefaultVolumes(years: number): VolumeSchedule[] {
  return Array.from({ length: years }, (_, i) => ({
    year: i + 1,
    volume: 0,
    remark: '',
  }));
}

/* ------------------------------------------------------------------ */
/*  Styles (extracted to avoid double-brace JSX)                       */
/* ------------------------------------------------------------------ */

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
  descCard: { marginBottom: 16 },
  rateRow: { display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap' as const },
  rateItem: { flex: '1 1 200px' },
  summarySection: { marginBottom: 16 },
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

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
    costRates: { ...DEFAULT_COST_RATES },
    metalPrices: { ...DEFAULT_METAL_PRICES },
  });

  /* -- helpers -- */

  const updateBasic = useCallback(
    (patch: Partial<BasicInfo>) => {
      setData((prev) => {
        const next = { ...prev, basic: { ...prev.basic, ...patch } };
        // Sync volume rows when lifecycleYears changes
        if (patch.lifecycleYears && patch.lifecycleYears !== prev.basic.lifecycleYears) {
          const newLen = patch.lifecycleYears;
          const old = prev.volumes;
          next.volumes = Array.from({ length: newLen }, (_, i) => (
            old[i] || { year: i + 1, volume: 0, remark: '' }
          ));
        }
        return next;
      });
    },
    [],
  );

  const updateVolume = useCallback(
    (index: number, patch: Partial<VolumeSchedule>) => {
      setData((prev) => {
        const volumes = [...prev.volumes];
        volumes[index] = { ...volumes[index], ...patch } as VolumeSchedule;
        return { ...prev, volumes };
      });
    },
    [],
  );

  const updateRates = useCallback(
    (patch: Partial<CostRates>) => {
      setData((prev) => ({ ...prev, costRates: { ...prev.costRates, ...patch } }));
    },
    [],
  );

  const updateMetals = useCallback(
    (patch: Partial<MetalPrices>) => {
      setData((prev) => ({ ...prev, metalPrices: { ...prev.metalPrices, ...patch } }));
    },
    [],
  );

  /* -- validation -- */

  const validateStep = (s: number): string | null => {
    if (s === 0) {
      if (!data.basic.projectCode.trim()) return '请填写项目编号';
      if (!data.basic.projectName.trim()) return '请填写项目名称';
      if (!data.basic.customer.trim()) return '请填写客户名称';
    }
    if (s === 1) {
      const totalVol = data.volumes.reduce((s, v) => s + v.volume, 0);
      if (totalVol <= 0) return '至少填写一年的产量';
    }
    return null;
  };

  const handleNext = () => {
    const err = validateStep(step);
    if (err) { Toast.warning(err); return; }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const handlePrev = () => setStep((s) => Math.max(s - 1, 0));

  /* -- create project -- */

  const handleCreate = async () => {
    try {
      setSubmitting(true);

      // 1) Create project via API
      const apiPayload = {
        projectCode: data.basic.projectCode.trim(),
        projectName: data.basic.projectName.trim(),
        customer: data.basic.customer.trim(),
        platform: data.basic.platform.trim() || undefined,
        status: 'draft' as const,
        costRates: data.costRates,
        metalPrices: data.metalPrices,
        volumes: data.volumes.filter((v) => v.volume > 0),
      };

      const created = await apiClient<{
        id: string;
        projectCode: string;
        projectName: string;
        customer: string;
        platform?: string;
        status: string;
        createdAt: string;
        updatedAt: string;
      }>('/projects', { method: 'POST', body: apiPayload });

      // 2) Sync project record to Dexie
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
        config: {
          costRates: data.costRates,
          metalPrices: data.metalPrices,
          volumes: data.volumes.filter((v) => v.volume > 0),
          annualDropRate: 0,
        },
      };
      await db.projects.put(projectRecord);

      // 3) Create baseline scenario in Dexie
      const scenarioId = crypto.randomUUID();
      const now = new Date().toISOString();
      const config: ProjectConfig = {
        costRates: data.costRates,
        metalPrices: data.metalPrices,
        volumes: data.volumes.filter((v) => v.volume > 0),
        annualDropRate: 0,
      };

      const scenario: ScenarioRecord = {
        id: scenarioId,
        projectId: created.id,
        scenarioCode: 'SCN-001',
        scenarioName: '初始报价',
        scenarioType: 'initial_quote',
        parentScenarioId: null,
        isBaseline: true,
        lifecycleYears: data.basic.lifecycleYears,
        config,
        note: '项目创建时自动生成的基准场景',
        status: 'draft',
        createdAt: now,
        updatedAt: now,
      };
      await db.scenarios.put(scenario);

      // 4) Set project store & navigate
      setCurrentProject(created.id, created.projectName);
      Toast.success('项目创建成功');
      navigate('/project/' + created.id + '/s/' + scenarioId);
    } catch (e) {
      Toast.error('创建失败: ' + (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  /* -- total volume for summary -- */
  const totalVolume = data.volumes.reduce((s, v) => s + v.volume, 0);

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div style={S.root}>
      <Title heading={3}>🆕 新建项目</Title>
      <Steps current={step} style={S.steps}>
        {STEPS.map((s, i) => (
          <Steps.Step key={i} title={s.title} description={s.description} />
        ))}
      </Steps>

      {/* ===== Step 0: Basic Info ===== */}
      {step === 0 && (
        <Card style={S.card}>
          <div style={S.field}>
            <Text style={S.label}>项目编号 *</Text>
            <Input
              value={data.basic.projectCode}
              placeholder="如 E281"
              onChange={(v) => updateBasic({ projectCode: v })}
            />
          </div>
          <div style={S.field}>
            <Text style={S.label}>项目名称 *</Text>
            <Input
              value={data.basic.projectName}
              placeholder="如 E281高压线束包"
              onChange={(v) => updateBasic({ projectName: v })}
            />
          </div>
          <div style={S.field}>
            <Text style={S.label}>客户名称 *</Text>
            <Input
              value={data.basic.customer}
              placeholder="如 吉利汽车"
              onChange={(v) => updateBasic({ customer: v })}
            />
          </div>
          <div style={S.field}>
            <Text style={S.label}>平台/车型</Text>
            <Input
              value={data.basic.platform}
              placeholder="如 SEA架构"
              onChange={(v) => updateBasic({ platform: v })}
            />
          </div>
          <div style={S.field}>
            <Text style={S.label}>生命周期 (年)</Text>
            <InputNumber
              value={data.basic.lifecycleYears}
              min={1}
              max={15}
              onChange={(v) => updateBasic({ lifecycleYears: Number(v) || 6 })}
            />
          </div>
        </Card>
      )}

      {/* ===== Step 1: Volume Plan ===== */}
      {step === 1 && (
        <Card style={S.card} title="年度产量规划">
          <Banner
            type="info"
            description="填写项目生命周期内每年的计划产量（台），用于分摊回收计算。"
            style={S.field}
          />
          {data.volumes.map((vol, i) => (
            <div key={i} style={S.row}>
              <Text style={S.yearTag}>第{vol.year}年</Text>
              <InputNumber
                style={S.volInput}
                value={vol.volume}
                min={0}
                step={1000}
                formatter={(v) => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={(v) => String(v).replace(/,/g, '')}
                placeholder="年产量"
                onChange={(v) => updateVolume(i, { volume: Number(v) || 0 })}
              />
              <Input
                style={S.remarkInput}
                value={vol.remark || ''}
                placeholder="备注"
                onChange={(v) => updateVolume(i, { remark: v })}
              />
            </div>
          ))}
          <Text type="tertiary">
            生命周期总产量: {totalVolume.toLocaleString()} 台
          </Text>
        </Card>
      )}

      {/* ===== Step 2: Cost Rates ===== */}
      {step === 2 && (
        <Card style={S.card} title="成本参数配置">
          <Title heading={6}>费率参数</Title>
          <div style={S.rateRow}>
            <div style={S.rateItem}>
              <Text style={S.label}>人工费率 (元/h)</Text>
              <InputNumber
                value={data.costRates.laborRate}
                min={0}
                step={1}
                onChange={(v) => updateRates({ laborRate: Number(v) || 0 })}
              />
            </div>
            <div style={S.rateItem}>
              <Text style={S.label}>制造费率 (元/h)</Text>
              <InputNumber
                value={data.costRates.mfgRate}
                min={0}
                step={0.01}
                onChange={(v) => updateRates({ mfgRate: Number(v) || 0 })}
              />
            </div>
          </div>
          <div style={S.rateRow}>
            <div style={S.rateItem}>
              <Text style={S.label}>废品率</Text>
              <InputNumber
                value={data.costRates.wasteRate}
                min={0}
                max={0.5}
                step={0.001}
                onChange={(v) => updateRates({ wasteRate: Number(v) || 0 })}
              />
            </div>
            <div style={S.rateItem}>
              <Text style={S.label}>管理费率</Text>
              <InputNumber
                value={data.costRates.mgmtRate}
                min={0}
                max={0.5}
                step={0.01}
                onChange={(v) => updateRates({ mgmtRate: Number(v) || 0 })}
              />
            </div>
            <div style={S.rateItem}>
              <Text style={S.label}>利润率</Text>
              <InputNumber
                value={data.costRates.profitRate}
                min={0}
                max={0.5}
                step={0.0001}
                onChange={(v) => updateRates({ profitRate: Number(v) || 0 })}
              />
            </div>
          </div>

          <Title heading={6} style={S.field}>金属基准价 (元/千克)</Title>
          <div style={S.rateRow}>
            <div style={S.rateItem}>
              <Text style={S.label}>铜价</Text>
              <InputNumber
                value={data.metalPrices.copper}
                min={0}
                step={0.1}
                onChange={(v) => updateMetals({ copper: Number(v) || 0 })}
              />
            </div>
            <div style={S.rateItem}>
              <Text style={S.label}>铝价</Text>
              <InputNumber
                value={data.metalPrices.aluminum}
                min={0}
                step={0.1}
                onChange={(v) => updateMetals({ aluminum: Number(v) || 0 })}
              />
            </div>
          </div>
        </Card>
      )}

      {/* ===== Step 3: Confirm ===== */}
      {step === 3 && (
        <Card style={S.card} title="确认项目配置">
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
              data={data.volumes
                .filter((v) => v.volume > 0)
                .map((v) => ({
                  key: '第' + v.year + '年',
                  value: v.volume.toLocaleString() + ' 台' + (v.remark ? ' (' + v.remark + ')' : ''),
                }))
                .concat([{ key: '总产量', value: totalVolume.toLocaleString() + ' 台' }])}
            />
          </div>
          <div style={S.summarySection}>
            <Title heading={6}>成本参数</Title>
            <Descriptions
              data={[
                { key: '人工费率', value: data.costRates.laborRate + ' 元/h' },
                { key: '制造费率', value: data.costRates.mfgRate + ' 元/h' },
                { key: '废品率', value: (data.costRates.wasteRate * 100).toFixed(2) + '%' },
                { key: '管理费率', value: (data.costRates.mgmtRate * 100).toFixed(1) + '%' },
                { key: '利润率', value: (data.costRates.profitRate * 100).toFixed(4) + '%' },
                { key: '铜基准价', value: data.metalPrices.copper + ' 元/千克' },
                { key: '铝基准价', value: data.metalPrices.aluminum + ' 元/千克' },
              ]}
            />
          </div>
          <Banner
            type="success"
            description="创建后将自动生成基准场景 (SCN-001 初始报价)，您可以立即开始导入线束 BOM 并进行报价计算。"
          />
        </Card>
      )}

      {/* ===== Footer Navigation ===== */}
      <div style={S.footer}>
        <Space>
          <Button
            icon={<IconArrowLeft />}
            onClick={() => navigate('/')}
            theme="borderless"
          >
            返回列表
          </Button>
          {step > 0 && (
            <Button icon={<IconArrowLeft />} onClick={handlePrev}>
              上一步
            </Button>
          )}
        </Space>
        {step < STEPS.length - 1 ? (
          <Button
            type="primary"
            theme="solid"
            icon={<IconArrowRight />}
            iconPosition="right"
            onClick={handleNext}
          >
            下一步
          </Button>
        ) : (
          <Button
            type="primary"
            theme="solid"
            icon={<IconTick />}
            loading={submitting}
            onClick={handleCreate}
          >
            ✅ 确认创建项目
          </Button>
        )}
      </div>
    </div>
  );
}
