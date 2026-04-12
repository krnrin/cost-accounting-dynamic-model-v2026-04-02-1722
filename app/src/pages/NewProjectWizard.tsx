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
  Popconfirm,
  Banner,
} from '@douyinfe/semi-ui';
import { IconArrowLeft, IconArrowRight, IconPlus, IconDelete, IconTick } from '@douyinfe/semi-icons';
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
  { title: '\u57FA\u672C\u4FE1\u606F', description: '\u9879\u76EE\u7F16\u53F7\u4E0E\u5BA2\u6237' },
  { title: '\u4EA7\u91CF\u89C4\u5212', description: '\u5E74\u5EA6\u4EA7\u91CF\u8BA1\u5212' },
  { title: '\u6210\u672C\u53C2\u6570', description: '\u8D39\u7387\u4E0E\u91D1\u5C5E\u4EF7\u683C' },
  { title: '\u786E\u8BA4\u521B\u5EFA', description: '\u9884\u89C8\u5E76\u521B\u5EFA\u9879\u76EE' },
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
        volumes[index] = { ...volumes[index], ...patch };
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
      if (!data.basic.projectCode.trim()) return '\u8BF7\u586B\u5199\u9879\u76EE\u7F16\u53F7';
      if (!data.basic.projectName.trim()) return '\u8BF7\u586B\u5199\u9879\u76EE\u540D\u79F0';
      if (!data.basic.customer.trim()) return '\u8BF7\u586B\u5199\u5BA2\u6237\u540D\u79F0';
    }
    if (s === 1) {
      const totalVol = data.volumes.reduce((s, v) => s + v.volume, 0);
      if (totalVol <= 0) return '\u81F3\u5C11\u586B\u5199\u4E00\u5E74\u7684\u4EA7\u91CF';
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
        scenarioName: '\u521D\u59CB\u62A5\u4EF7',
        scenarioType: 'initial_quote',
        parentScenarioId: null,
        isBaseline: true,
        lifecycleYears: data.basic.lifecycleYears,
        config,
        note: '\u9879\u76EE\u521B\u5EFA\u65F6\u81EA\u52A8\u751F\u6210\u7684\u57FA\u51C6\u573A\u666F',
        status: 'draft',
        createdAt: now,
        updatedAt: now,
      };
      await db.scenarios.put(scenario);

      // 4) Set project store & navigate
      setCurrentProject(created.id, created.projectName);
      Toast.success('\u9879\u76EE\u521B\u5EFA\u6210\u529F');
      navigate('/project/' + created.id + '/s/' + scenarioId);
    } catch (e) {
      Toast.error('\u521B\u5EFA\u5931\u8D25: ' + (e as Error).message);
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
      <Title heading={3}>\uD83C\uDD95 \u65B0\u5EFA\u9879\u76EE</Title>
      <Steps current={step} style={S.steps}>
        {STEPS.map((s, i) => (
          <Steps.Step key={i} title={s.title} description={s.description} />
        ))}
      </Steps>

      {/* ===== Step 0: Basic Info ===== */}
      {step === 0 && (
        <Card style={S.card}>
          <div style={S.field}>
            <Text style={S.label}>\u9879\u76EE\u7F16\u53F7 *</Text>
            <Input
              value={data.basic.projectCode}
              placeholder="\u5982 E281"
              onChange={(v) => updateBasic({ projectCode: v })}
            />
          </div>
          <div style={S.field}>
            <Text style={S.label}>\u9879\u76EE\u540D\u79F0 *</Text>
            <Input
              value={data.basic.projectName}
              placeholder="\u5982 E281\u9AD8\u538B\u7EBF\u675F\u5305"
              onChange={(v) => updateBasic({ projectName: v })}
            />
          </div>
          <div style={S.field}>
            <Text style={S.label}>\u5BA2\u6237\u540D\u79F0 *</Text>
            <Input
              value={data.basic.customer}
              placeholder="\u5982 \u5409\u5229\u6C7D\u8F66"
              onChange={(v) => updateBasic({ customer: v })}
            />
          </div>
          <div style={S.field}>
            <Text style={S.label}>\u5E73\u53F0/\u8F66\u578B</Text>
            <Input
              value={data.basic.platform}
              placeholder="\u5982 SEA\u67B6\u6784"
              onChange={(v) => updateBasic({ platform: v })}
            />
          </div>
          <div style={S.field}>
            <Text style={S.label}>\u751F\u547D\u5468\u671F (\u5E74)</Text>
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
        <Card style={S.card} title="\u5E74\u5EA6\u4EA7\u91CF\u89C4\u5212">
          <Banner
            type="info"
            description="\u586B\u5199\u9879\u76EE\u751F\u547D\u5468\u671F\u5185\u6BCF\u5E74\u7684\u8BA1\u5212\u4EA7\u91CF\uFF08\u53F0\uFF09\uFF0C\u7528\u4E8E\u5206\u644A\u56DE\u6536\u8BA1\u7B97\u3002"
            style={S.field}
          />
          {data.volumes.map((vol, i) => (
            <div key={i} style={S.row}>
              <Text style={S.yearTag}>\u7B2C{vol.year}\u5E74</Text>
              <InputNumber
                style={S.volInput}
                value={vol.volume}
                min={0}
                step={1000}
                formatter={(v) => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={(v) => Number(String(v).replace(/,/g, ''))}
                placeholder="\u5E74\u4EA7\u91CF"
                onChange={(v) => updateVolume(i, { volume: Number(v) || 0 })}
              />
              <Input
                style={S.remarkInput}
                value={vol.remark || ''}
                placeholder="\u5907\u6CE8"
                onChange={(v) => updateVolume(i, { remark: v })}
              />
            </div>
          ))}
          <Text type="tertiary">
            \u751F\u547D\u5468\u671F\u603B\u4EA7\u91CF: {totalVolume.toLocaleString()} \u53F0
          </Text>
        </Card>
      )}

      {/* ===== Step 2: Cost Rates ===== */}
      {step === 2 && (
        <Card style={S.card} title="\u6210\u672C\u53C2\u6570\u914D\u7F6E">
          <Title heading={6}>\u8D39\u7387\u53C2\u6570</Title>
          <div style={S.rateRow}>
            <div style={S.rateItem}>
              <Text style={S.label}>\u4EBA\u5DE5\u8D39\u7387 (\u5143/h)</Text>
              <InputNumber
                value={data.costRates.laborRate}
                min={0}
                step={1}
                onChange={(v) => updateRates({ laborRate: Number(v) || 0 })}
              />
            </div>
            <div style={S.rateItem}>
              <Text style={S.label}>\u5236\u9020\u8D39\u7387 (\u5143/h)</Text>
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
              <Text style={S.label}>\u5E9F\u54C1\u7387</Text>
              <InputNumber
                value={data.costRates.wasteRate}
                min={0}
                max={0.5}
                step={0.001}
                onChange={(v) => updateRates({ wasteRate: Number(v) || 0 })}
              />
            </div>
            <div style={S.rateItem}>
              <Text style={S.label}>\u7BA1\u7406\u8D39\u7387</Text>
              <InputNumber
                value={data.costRates.mgmtRate}
                min={0}
                max={0.5}
                step={0.01}
                onChange={(v) => updateRates({ mgmtRate: Number(v) || 0 })}
              />
            </div>
            <div style={S.rateItem}>
              <Text style={S.label}>\u5229\u6DA6\u7387</Text>
              <InputNumber
                value={data.costRates.profitRate}
                min={0}
                max={0.5}
                step={0.0001}
                onChange={(v) => updateRates({ profitRate: Number(v) || 0 })}
              />
            </div>
          </div>

          <Title heading={6} style={S.field}>\u91D1\u5C5E\u57FA\u51C6\u4EF7 (\u5143/\u5343\u514B)</Title>
          <div style={S.rateRow}>
            <div style={S.rateItem}>
              <Text style={S.label}>\u94DC\u4EF7</Text>
              <InputNumber
                value={data.metalPrices.copper}
                min={0}
                step={0.1}
                onChange={(v) => updateMetals({ copper: Number(v) || 0 })}
              />
            </div>
            <div style={S.rateItem}>
              <Text style={S.label}>\u94DD\u4EF7</Text>
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
        <Card style={S.card} title="\u786E\u8BA4\u9879\u76EE\u914D\u7F6E">
          <div style={S.summarySection}>
            <Title heading={6}>\u57FA\u672C\u4FE1\u606F</Title>
            <Descriptions
              data={[
                { key: '\u9879\u76EE\u7F16\u53F7', value: data.basic.projectCode },
                { key: '\u9879\u76EE\u540D\u79F0', value: data.basic.projectName },
                { key: '\u5BA2\u6237', value: data.basic.customer },
                { key: '\u5E73\u53F0', value: data.basic.platform || '-' },
                { key: '\u751F\u547D\u5468\u671F', value: data.basic.lifecycleYears + ' \u5E74' },
              ]}
            />
          </div>
          <div style={S.summarySection}>
            <Title heading={6}>\u4EA7\u91CF\u89C4\u5212</Title>
            <Descriptions
              data={data.volumes
                .filter((v) => v.volume > 0)
                .map((v) => ({
                  key: '\u7B2C' + v.year + '\u5E74',
                  value: v.volume.toLocaleString() + ' \u53F0' + (v.remark ? ' (' + v.remark + ')' : ''),
                }))
                .concat([{ key: '\u603B\u4EA7\u91CF', value: totalVolume.toLocaleString() + ' \u53F0' }])}
            />
          </div>
          <div style={S.summarySection}>
            <Title heading={6}>\u6210\u672C\u53C2\u6570</Title>
            <Descriptions
              data={[
                { key: '\u4EBA\u5DE5\u8D39\u7387', value: data.costRates.laborRate + ' \u5143/h' },
                { key: '\u5236\u9020\u8D39\u7387', value: data.costRates.mfgRate + ' \u5143/h' },
                { key: '\u5E9F\u54C1\u7387', value: (data.costRates.wasteRate * 100).toFixed(2) + '%' },
                { key: '\u7BA1\u7406\u8D39\u7387', value: (data.costRates.mgmtRate * 100).toFixed(1) + '%' },
                { key: '\u5229\u6DA6\u7387', value: (data.costRates.profitRate * 100).toFixed(4) + '%' },
                { key: '\u94DC\u57FA\u51C6\u4EF7', value: data.metalPrices.copper + ' \u5143/\u5343\u514B' },
                { key: '\u94DD\u57FA\u51C6\u4EF7', value: data.metalPrices.aluminum + ' \u5143/\u5343\u514B' },
              ]}
            />
          </div>
          <Banner
            type="success"
            description="\u521B\u5EFA\u540E\u5C06\u81EA\u52A8\u751F\u6210\u57FA\u51C6\u573A\u666F (SCN-001 \u521D\u59CB\u62A5\u4EF7)\uFF0C\u60A8\u53EF\u4EE5\u7ACB\u5373\u5F00\u59CB\u5BFC\u5165\u7EBF\u675F BOM \u5E76\u8FDB\u884C\u62A5\u4EF7\u8BA1\u7B97\u3002"
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
            \u8FD4\u56DE\u5217\u8868
          </Button>
          {step > 0 && (
            <Button icon={<IconArrowLeft />} onClick={handlePrev}>
              \u4E0A\u4E00\u6B65
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
            \u4E0B\u4E00\u6B65
          </Button>
        ) : (
          <Button
            type="primary"
            theme="solid"
            icon={<IconTick />}
            loading={submitting}
            onClick={handleCreate}
          >
            \u2705 \u786E\u8BA4\u521B\u5EFA\u9879\u76EE
          </Button>
        )}
      </div>
    </div>
  );
}
