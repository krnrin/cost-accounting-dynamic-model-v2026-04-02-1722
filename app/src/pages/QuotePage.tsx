import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Card,
  InputNumber,
  Radio,
  RadioGroup,
  Space,
  Spin,
  Table,
  Tabs,
  TabPane,
  Tag,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { IconArrowLeft, IconDownload, IconList, IconSimilarity } from '@douyinfe/semi-icons';
import { db } from '@/data/db';
import { requireScenarioConfig } from '@/data/scenarioGuards';
import { ensureScenarioWorkspaceHydrated } from '@/data/serverScenarioSync';
import type { HarnessRecord, ProjectRecord, ScenarioRecord } from '@/data/db';
import { computeHarnessCost, computeProjectFromHarnesses } from '@/engine/harness_costing';
import { buildChangeComparisonTable, computeChangePricing } from '@/engine/change_pricing';
import { exportChangePricingExcel } from '@/engine/excel_export';
import { exportQuoteExcel, exportQuotePdf } from '@/lib/exportApi';
import { apiClient } from '@/lib/apiClient';
import { applyCustomerQuoteSnapshot } from '@/utils/customerQuoteSnapshots';
import type { HarnessInput } from '@/types/harness';
import { RoleGuard } from '@/components/RoleGuard';
import ScenarioSelector from '@/components/ScenarioSelector';
import QuoteGapEntry from '@/components/QuoteGapEntry';
import { QuoteEmptyState } from '@/components/QuoteEmptyState';
import QuoteParamChecklist from '@/components/QuoteParamChecklist';
import { usePermission } from '@/hooks/usePermission';
import { applyParamBoundaryRules } from '@/lib/paramBoundaryUi';
import {
  applyInstallationRatiosToHarnessRecords,
  resolveScenarioVehicleConfigs,
} from '@/engine/configuration_model';

const { Title, Text } = Typography;

type ApiQuote = {
  id: string;
  version: string;
  projectId: string;
  scenarioId?: string | null;
  harnessId?: string | null;
  status: string;
  template: string;
  data?: Record<string, unknown>;
};

type QuoteStatus = 'draft' | 'confirmed' | 'published';
type ChangeMode = 'bom' | 'hours' | 'config';

function computeSuggestedPrice(baselineCost: number, marginPercent: number): number {
  if (marginPercent <= 0 || marginPercent >= 100) return baselineCost;
  return baselineCost / (1 - marginPercent / 100);
}

function normalizeQuoteStatus(status?: string | null): QuoteStatus {
  if (status === 'published') return 'published';
  if (status === 'confirmed') return 'confirmed';
  return 'draft';
}

function quoteStatusMeta(status: QuoteStatus): { color: 'blue' | 'green' | 'purple'; label: string } {
  if (status === 'published') return { color: 'purple', label: '已发布' };
  if (status === 'confirmed') return { color: 'green', label: '已确认' };
  return { color: 'blue', label: '草稿' };
}

function buildHoursPatch(input: HarnessInput, nextTotalHours: number): Partial<HarnessInput> {
  const currentFront = input.frontHours ?? 0;
  const currentBack = input.backHours ?? 0;
  const currentTotal = currentFront + currentBack;
  if (currentTotal <= 0) {
    return { frontHours: nextTotalHours, backHours: 0 };
  }
  const scale = nextTotalHours / currentTotal;
  return {
    frontHours: currentFront * scale,
    backHours: currentBack * scale,
  };
}

export default function QuotePage() {
  const { id, sid } = useParams<{ id: string; sid: string }>();
  const navigate = useNavigate();
  const { role } = usePermission();

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [scenario, setScenario] = useState<ScenarioRecord | null>(null);
  const [harnesses, setHarnesses] = useState<HarnessRecord[]>([]);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [quoteRecords, setQuoteRecords] = useState<ApiQuote[]>([]);
  const [targetMarginPercent, setTargetMarginPercent] = useState(15);
  const [changeMode, setChangeMode] = useState<ChangeMode>('bom');
  const [modifiedHarnesses, setModifiedHarnesses] = useState<Record<string, Partial<HarnessInput>>>({});

  const refreshQuotes = useCallback(async () => {
    if (!sid) return;
    const quotes = await apiClient<ApiQuote[]>(`/quotes/scenario/${sid}`);
    setQuoteRecords(quotes);
    setSelectedQuoteId(quotes[0]?.id ?? null);
  }, [sid]);

  useEffect(() => {
    async function loadData() {
      if (!id || !sid) return;
      setLoading(true);
      try {
        await ensureScenarioWorkspaceHydrated(id, sid);
        const loadedProject = await db.projects.get(id);
        if (!loadedProject) throw new Error('项目不存在');
        const loadedScenario = await db.scenarios.get(sid);
        requireScenarioConfig(loadedScenario, '报价页加载');

        const loadedHarnesses = await db.harnesses.where('scenarioId').equals(sid).toArray();
        const quotes = await apiClient<ApiQuote[]>(`/quotes/scenario/${sid}`);

        setProject(loadedProject);
        setScenario(loadedScenario ?? null);
        setHarnesses(loadedHarnesses);
        setQuoteRecords(quotes);
        setSelectedQuoteId(quotes[0]?.id ?? null);
      } catch (error) {
        console.error(error);
        setQuoteRecords([]);
        setSelectedQuoteId(null);
        Toast.error(error instanceof Error ? error.message : '数据加载失败');
      } finally {
        setLoading(false);
      }
    }
    void loadData();
  }, [id, sid]);

  const customerQuoteSnapshots = scenario?.config.customerQuoteSnapshots;
  const effectiveHarnesses = useMemo(
    () => (
      scenario
        ? applyInstallationRatiosToHarnessRecords(
          harnesses,
          resolveScenarioVehicleConfigs(scenario),
          scenario.harnessConfigMappings ?? [],
        )
        : harnesses
    ),
    [scenario, harnesses],
  );

  const baselineComputedResults = useMemo(() => {
    if (!scenario) return [];
    return effectiveHarnesses
      .map((harness) => computeHarnessCost(harness.input, scenario.config.costRates, scenario.config.metalPrices))
      .sort((a, b) => a.harnessId.localeCompare(b.harnessId));
  }, [scenario, effectiveHarnesses]);

  const baselineResults = useMemo(
    () =>
      baselineComputedResults.map((result) =>
        applyCustomerQuoteSnapshot(result, customerQuoteSnapshots?.[result.harnessId]),
      ),
    [baselineComputedResults, customerQuoteSnapshots],
  );

  const baselineProject = useMemo(() => computeProjectFromHarnesses(baselineResults), [baselineResults]);

  const suggestedPrice = useMemo(
    () => computeSuggestedPrice(baselineProject.vehicleCost, targetMarginPercent),
    [baselineProject.vehicleCost, targetMarginPercent],
  );

  const sortedHarnesses = useMemo(
    () => [...effectiveHarnesses].sort((a, b) => a.harnessId.localeCompare(b.harnessId)),
    [effectiveHarnesses],
  );

  const baselineResultsById = useMemo(
    () => new Map(baselineResults.map((result) => [result.harnessId, result])),
    [baselineResults],
  );

  const selectedQuote = useMemo(
    () => quoteRecords.find((quote) => quote.id === selectedQuoteId) || null,
    [quoteRecords, selectedQuoteId],
  );
  const selectedQuoteStatus = normalizeQuoteStatus(selectedQuote?.status);
  const selectedQuoteStatusMeta = quoteStatusMeta(selectedQuoteStatus);
  const isDraftQuote = selectedQuoteStatus === 'draft';
  const isConfirmedQuote = selectedQuoteStatus === 'confirmed';
  const isPublishedQuote = selectedQuoteStatus === 'published';
  const checklistItems = useMemo(() => [
    {
      label: '成本费率已配置',
      status: scenario?.config?.costRates ? 'pass' as const : 'fail' as const,
      detail: scenario?.config?.costRates ? undefined : '缺少场景 costRates',
    },
    {
      label: '金属价格已配置',
      status: scenario?.config?.metalPrices ? 'pass' as const : 'fail' as const,
      detail: scenario?.config?.metalPrices ? undefined : '缺少场景 metalPrices',
    },
    {
      label: '线束基线结果可用',
      status: baselineResults.length > 0 ? 'pass' as const : 'fail' as const,
      detail: baselineResults.length > 0 ? `${baselineResults.length} 条线束` : '尚未生成报价基线',
    },
    {
      label: '当前报价状态',
      status: isPublishedQuote ? 'pass' as const : isConfirmedQuote ? 'warn' as const : 'warn' as const,
      detail: selectedQuote ? `${selectedQuote.version} / ${selectedQuoteStatusMeta.label}` : '尚未生成报价',
    },
  ], [baselineResults.length, isConfirmedQuote, isPublishedQuote, scenario?.config?.costRates, scenario?.config?.metalPrices, selectedQuote, selectedQuoteStatusMeta.label]);

  const persistCurrentQuote = useCallback(async () => {
    if (!id || !sid || !scenario || baselineResults.length === 0) {
      throw new Error('当前报价内容尚未准备完成');
    }

    const boundary = applyParamBoundaryRules({
      laborRate: scenario.config.costRates.laborRate,
      mfgRate: scenario.config.costRates.mfgRate,
      wasteRate: scenario.config.costRates.wasteRate,
      mgmtRate: scenario.config.costRates.mgmtRate,
      profitRate: scenario.config.costRates.profitRate,
      copper: scenario.config.metalPrices.copper,
      aluminum: scenario.config.metalPrices.aluminum,
      annualDropRate: scenario.config.annualDropRate,
    }, role);

    boundary.messages.forEach((message) => {
      if (message.level === 'error') {
        Toast.error(message.text);
      } else if (message.level === 'warning') {
        Toast.warning(message.text);
      } else {
        Toast.info(message.text);
      }
    });
    if (!boundary.valid) {
      throw new Error('当前场景参数越界，无法保存或发布报价');
    }

    const payload = {
      projectId: id,
      version: `${scenario.scenarioCode}-suggested`,
      template: 'suggested',
      data: {
        internalCost: baselineProject.vehicleCost,
        targetMarginPercent,
        suggestedPrice,
        harnessCount: baselineResults.length,
      },
      quoteParams: {
        templateType: 'suggested',
        scenarioId: sid,
        scenarioCode: scenario.scenarioCode,
        scenarioName: scenario.scenarioName,
        scenarioType: scenario.scenarioType,
      },
      quoteResult: {
        totals: {
          internalCost: baselineProject.vehicleCost,
          suggestedPrice,
          targetMarginPercent,
        },
        harnessCount: baselineResults.length,
        baselineVehicleCost: baselineProject.vehicleCost,
      },
      internalCostBaseline: baselineProject.vehicleCost,
      exWorksPrice: suggestedPrice,
      arrivalPrice: suggestedPrice,
      effectivePrice: suggestedPrice,
      effectivePriceMode: 'suggested',
    };

    const canUpdateCurrent = selectedQuoteId && normalizeQuoteStatus(selectedQuote?.status) === 'draft';
    if (canUpdateCurrent) {
      return apiClient<ApiQuote>(`/quotes/${selectedQuoteId}`, {
        method: 'PUT',
        body: payload,
      });
    }

    return apiClient<ApiQuote>(`/quotes/scenario/${sid}`, {
      method: 'POST',
      body: payload,
    });
  }, [
    baselineProject.vehicleCost,
    baselineResults.length,
    id,
    scenario,
    role,
    selectedQuote?.status,
    selectedQuoteId,
    sid,
    suggestedPrice,
    targetMarginPercent,
  ]);

  const handleSaveQuote = useCallback(async () => {
    try {
      const saved = await persistCurrentQuote();
      setSelectedQuoteId(saved.id);
      await refreshQuotes();
      Toast.success('报价草稿已保存');
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '报价保存失败');
    }
  }, [persistCurrentQuote, refreshQuotes]);

  const handleConfirmQuote = useCallback(async () => {
    try {
      const saved = await persistCurrentQuote();
      await apiClient(`/quotes/${saved.id}/confirm`, { method: 'POST' });
      setSelectedQuoteId(saved.id);
      await refreshQuotes();
      Toast.success('报价已确认并写入版本/审计');
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '报价确认失败');
    }
  }, [persistCurrentQuote, refreshQuotes]);

  const handlePublishQuote = useCallback(async () => {
    if (!selectedQuoteId) {
      Toast.warning('当前没有可发布的报价');
      return;
    }
    try {
      await apiClient(`/quotes/${selectedQuoteId}/publish`, { method: 'POST' });
      await refreshQuotes();
      Toast.success('报价已发布并写入版本/审计');
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '报价发布失败');
    }
  }, [selectedQuoteId, refreshQuotes]);

  const simulatedResults = useMemo(() => {
    if (!scenario) return [];
    return effectiveHarnesses.map((harness) => {
      const modifications = modifiedHarnesses[harness.harnessId] || {};
      const simulatedInput = { ...harness.input, ...modifications } as HarnessInput;
      return applyCustomerQuoteSnapshot(
        computeHarnessCost(simulatedInput, scenario.config.costRates, scenario.config.metalPrices),
        customerQuoteSnapshots?.[harness.harnessId],
      );
    });
  }, [scenario, effectiveHarnesses, modifiedHarnesses, customerQuoteSnapshots]);

  const simulatedProject = useMemo(() => computeProjectFromHarnesses(simulatedResults), [simulatedResults]);
  const changePricingResult = useMemo(
    () => computeChangePricing(baselineProject, simulatedProject, changeMode),
    [baselineProject, simulatedProject, changeMode],
  );

  const formatCurrency = (val: number | undefined) => (val === undefined ? '-' : `¥${val.toFixed(2)}`);
  const formatDelta = (val: number | undefined) => {
    if (val === undefined) return '-';
    const color = val > 0 ? 'var(--semi-color-danger)' : val < 0 ? 'var(--semi-color-success)' : 'inherit';
    const prefix = val > 0 ? '+' : '';
    return <span style={{ color }}>{prefix}{val.toFixed(2)}</span>;
  };

  if (loading) return <Spin size="large" style={{ margin: '40px auto', display: 'block' }} />;
  if (!project || !scenario) return <div>项目或场景不存在</div>;
  if (effectiveHarnesses.length === 0) {
    return (
      <div className="page-container">
        <ScenarioSelector />
        <QuoteEmptyState projectId={id!} scenarioId={sid!} projectName={project.meta.projectName} />
      </div>
    );
  }

  const renderSuggestedPrice = () => {
    const profitAmount = suggestedPrice - baselineProject.vehicleCost;
    const actualMargin = suggestedPrice > 0 ? (profitAmount / suggestedPrice) * 100 : 0;

    const costColumns = [
      { title: '零件号', dataIndex: 'harnessId', width: 120, fixed: 'left' as const },
      { title: '名称', dataIndex: 'harnessName', width: 150, fixed: 'left' as const },
      { title: '材料成本', dataIndex: 'materialCost', render: (v: number) => formatCurrency(v) },
      { title: '人工', dataIndex: 'directLabor', render: (v: number) => formatCurrency(v) },
      { title: '制造费', dataIndex: 'manufacturing', render: (v: number) => formatCurrency(v) },
      { title: '废品', dataIndex: 'wasteCost', render: (v: number) => formatCurrency(v) },
      { title: '包装运输', dataIndex: 'packTotal', render: (v: number) => formatCurrency(v) },
      { title: '内部成本', dataIndex: 'deliveredPrice', render: (v: number) => formatCurrency(v), fixed: 'right' as const, width: 100 },
    ];

    return (
      <Space vertical align="start" style={{ width: '100%' }}>
        <Card className="glass-card" style={{ width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 32, flexWrap: 'wrap' }}>
            <div>
              <Text style={{ display: 'block', marginBottom: 4 }} type="tertiary">内部成本(单车)</Text>
              <Title heading={4} style={{ margin: 0 }}>{formatCurrency(baselineProject.vehicleCost)}</Title>
            </div>
            <div>
              <Text style={{ display: 'block', marginBottom: 4 }} type="tertiary">目标毛利率</Text>
              <InputNumber
                value={targetMarginPercent}
                onChange={(v) => setTargetMarginPercent(Number(v || 0))}
                min={0}
                max={99}
                step={0.5}
                suffix="%"
                style={{ width: 120 }}
              />
            </div>
            <div>
              <Text style={{ display: 'block', marginBottom: 4 }} type="tertiary">建议售价</Text>
              <Title heading={3} style={{ margin: 0, color: 'var(--semi-color-primary)' }}>{formatCurrency(suggestedPrice)}</Title>
            </div>
            <div>
              <Text style={{ display: 'block', marginBottom: 4 }} type="tertiary">利润额</Text>
              <Title heading={4} style={{ margin: 0, color: profitAmount > 0 ? 'var(--semi-color-success)' : 'var(--semi-color-danger)' }}>
                {formatCurrency(profitAmount)}
              </Title>
            </div>
            <div>
              <Text style={{ display: 'block', marginBottom: 4 }} type="tertiary">实际毛利率</Text>
              <Text strong>{actualMargin.toFixed(2)}%</Text>
            </div>
          </div>
        </Card>

        <Space>
          <RoleGuard field="quoteExport">
            <Button
              icon={<IconDownload />}
              theme="borderless"
              disabled={!selectedQuoteId}
              onClick={async () => {
                if (!selectedQuoteId) {
                  Toast.warning('当前场景暂无可导出的报价记录');
                  return;
                }
                try {
                  await exportQuoteExcel(selectedQuoteId);
                  Toast.success('报价 Excel 已导出');
                } catch (error) {
                  Toast.error(error instanceof Error ? error.message : '报价 Excel 导出失败');
                }
              }}
            >
              导出报价Excel
            </Button>
          </RoleGuard>
          <RoleGuard field="quoteExport">
            <Button
              icon={<IconDownload />}
              theme="borderless"
              disabled={!selectedQuoteId}
              onClick={async () => {
                if (!selectedQuoteId) {
                  Toast.warning('当前场景暂无可导出的报价记录');
                  return;
                }
                try {
                  await exportQuotePdf(selectedQuoteId);
                  Toast.success('报价 PDF 已导出');
                } catch (error) {
                  Toast.error(error instanceof Error ? error.message : '报价 PDF 导出失败');
                }
              }}
            >
              导出报价PDF
            </Button>
          </RoleGuard>
        </Space>

        <Table
          columns={costColumns}
          dataSource={baselineResults}
          pagination={false}
          scroll={{ x: 900 }}
          style={{ width: '100%' }}
          rowKey="harnessId"
        />
      </Space>
    );
  };

  const renderChangePricing = () => {
    const comp = buildChangeComparisonTable(changePricingResult);
    const comparisonColumns = [
      { title: '零件号', render: (_: any, row: any) => row.harnessId },
      { title: '名称', render: (_: any, row: any) => row.harnessName },
      {
        title: '变更类型',
        render: (_: any, row: any) => {
          const colors: Record<string, string> = { 新增: 'green', 删除: 'red', 变更: 'orange' };
          const category = (row.changeCategory || '') as string;
          return <Tag color={(colors[category] || 'grey') as any}>{row.changeCategory}</Tag>;
        },
      },
      { title: '定点价', render: (_: any, row: any) => formatCurrency(row.beforePrice) },
      { title: '变更后', render: (_: any, row: any) => formatCurrency(row.afterPrice) },
      { title: '差异', render: (_: any, row: any) => formatDelta(row.deltaPrice) },
      {
        title: '差异%',
        render: (_: any, row: any) => {
          const color = row.deltaPercent > 0 ? 'var(--semi-color-danger)' : row.deltaPercent < 0 ? 'var(--semi-color-success)' : 'inherit';
          return <span style={{ color }}>{row.deltaPercent > 0 ? '+' : ''}{row.deltaPercent.toFixed(2)}%</span>;
        },
      },
    ];

    return (
      <Space vertical align="start" style={{ width: '100%' }}>
        <Card className="glass-card" title="变更场景模拟" style={{ width: '100%' }}>
          <Space vertical align="start">
            <RadioGroup value={changeMode} onChange={(e) => setChangeMode(e.target.value as ChangeMode)} type="button">
              <Radio value="bom">BOM变更</Radio>
              <Radio value="hours">工时变更</Radio>
              <Radio value="config">配置变更</Radio>
            </RadioGroup>

            <Table
              dataSource={sortedHarnesses}
              pagination={false}
              size="small"
              columns={[
                { title: '零件号', render: (_: any, harness: HarnessRecord) => harness.harnessId },
                { title: '名称', render: (_: any, harness: HarnessRecord) => harness.harnessName },
                {
                  title: '当前值',
                  render: (_: any, harness: HarnessRecord) => {
                    const current = baselineResultsById.get(harness.harnessId);
                    if (changeMode === 'bom') return `${formatCurrency(current?.materialCost)} (只读)`;
                    if (changeMode === 'hours') {
                      const totalHours = (harness.input.frontHours ?? 0) + (harness.input.backHours ?? 0);
                      return `${totalHours.toFixed(2)} h`;
                    }
                    return `${((harness.input.vehicleRatio ?? 0) * 100).toFixed(1)}%`;
                  },
                },
                {
                  title: changeMode === 'bom' ? '新材料成本' : changeMode === 'hours' ? '新工时' : '新装车比',
                  render: (_: any, harness: HarnessRecord) => (
                    <InputNumber
                      value={(() => {
                        const modified = modifiedHarnesses[harness.harnessId];
                        if (changeMode === 'bom') return baselineResultsById.get(harness.harnessId)?.materialCost;
                        if (changeMode === 'hours') {
                          const front = modified?.frontHours ?? harness.input.frontHours ?? 0;
                          const back = modified?.backHours ?? harness.input.backHours ?? 0;
                          return front + back;
                        }
                        return (modified?.vehicleRatio ?? harness.input.vehicleRatio ?? 0) * 100;
                      })()}
                      disabled={changeMode === 'bom'}
                      onChange={(val) => {
                        if (changeMode === 'bom') return;
                        const nextValue = Number(val) || 0;
                        const patch = changeMode === 'hours'
                          ? buildHoursPatch(harness.input, nextValue)
                          : { vehicleRatio: nextValue / 100 };
                        setModifiedHarnesses((current) => ({
                          ...current,
                          [harness.harnessId]: { ...current[harness.harnessId], ...patch },
                        }));
                      }}
                      style={{ width: 120 }}
                      prefix={changeMode === 'bom' ? '¥' : ''}
                      suffix={changeMode === 'hours' ? 'h' : changeMode === 'config' ? '%' : ''}
                    />
                  ),
                },
              ]}
            />
          </Space>
        </Card>

        <Card className="glass-card" title="变更对比结果" style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <Text style={{ display: 'block' }}>单车影响金额</Text>
              <Title heading={3} style={{ margin: 0 }}>{formatDelta(changePricingResult.summary.totalDelta)}</Title>
            </div>
            <div>
              <Text style={{ display: 'block' }}>单车变化率</Text>
              <Title heading={3} style={{ margin: 0 }}>{formatDelta(changePricingResult.summary.deltaPercent)}%</Title>
            </div>
            <div>
              <Text style={{ display: 'block' }}>变更线束数</Text>
              <Title heading={3} style={{ margin: 0 }}>{changePricingResult.summary.affectedCount}</Title>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <Space>
                <RoleGuard field="changeExport">
                  <Button
                    icon={<IconDownload />}
                    onClick={() => {
                      exportChangePricingExcel(
                        changePricingResult,
                        baselineResults,
                        project.meta.projectName,
                        project.meta.customer,
                      );
                      Toast.success('设变报价对比报表已导出');
                    }}
                  >
                    导出对比报表
                  </Button>
                </RoleGuard>
                <Button
                  type="tertiary"
                  onClick={() => setModifiedHarnesses({})}
                  disabled={Object.keys(modifiedHarnesses).length === 0}
                >
                  重置变更
                </Button>
              </Space>
            </div>
          </div>
          <Table columns={comparisonColumns} dataSource={comp.rows} pagination={false} />
        </Card>
      </Space>
    );
  };

  return (
    <div className="page-container" data-testid="quote-page">
      <ScenarioSelector />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Button
          icon={<IconArrowLeft />}
          aria-label="返回"
          theme="borderless"
          onClick={() => navigate(`/project/${id}/s/${sid}`)}
        />
        <div style={{ flex: 1 }}>
          <Title heading={4} style={{ margin: 0 }}>报价工作台</Title>
          <Text style={{ display: 'block' }}>{project.meta.projectName} / {project.meta.customer}</Text>
        </div>
        <Space>
          <Tag color={selectedQuoteStatusMeta.color}>
            {selectedQuote
              ? `当前报价：${selectedQuote.version} / ${selectedQuoteStatusMeta.label}`
              : '当前报价：未生成'}
          </Tag>
          {isDraftQuote && (
            <>
              <Button
                data-testid="quote-save-draft"
                theme="light"
                disabled={isPublishedQuote || baselineResults.length === 0}
                onClick={handleSaveQuote}
              >
                保存报价草稿
              </Button>
              <Button
                data-testid="quote-confirm"
                theme="solid"
                disabled={isPublishedQuote || baselineResults.length === 0}
                onClick={handleConfirmQuote}
              >
                确认报价
              </Button>
            </>
          )}
          {isConfirmedQuote && (
            <Button
              data-testid="quote-publish"
              theme="solid"
              type="primary"
              disabled={!selectedQuoteId}
              onClick={handlePublishQuote}
            >
              发布报价
            </Button>
          )}
          {isPublishedQuote && <Tag color="purple">已发布报价只读</Tag>}
        </Space>
      </div>

      <Card style={{ marginBottom: 16 }} title="发布前检查">
        <QuoteParamChecklist items={checklistItems} />
      </Card>

      <Tabs type="line">
        <TabPane tab={<span><IconList style={{ marginRight: 4 }} />建议售价</span>} itemKey="1">
          <div style={{ padding: '16px 0' }} data-testid="quote-suggested-tab">{renderSuggestedPrice()}</div>
        </TabPane>
        <TabPane tab={<span><IconSimilarity style={{ marginRight: 4 }} />设变报价</span>} itemKey="2">
          <div style={{ padding: '16px 0' }} data-testid="quote-change-tab">{renderChangePricing()}</div>
        </TabPane>
      </Tabs>

      {id && sid && <QuoteGapEntry projectId={id} scenarioId={sid} />}
    </div>
  );
}
