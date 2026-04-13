import { useCallback, useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Typography, Spin, Button, Card, Table, Tabs, TabPane, InputNumber, Toast, Tag, Space, Radio, RadioGroup, Select } from '@douyinfe/semi-ui';
import { IconArrowLeft, IconDownload, IconSimilarity, IconList } from '@douyinfe/semi-icons';
import { db } from '@/data/db';
import { applyE281ScenarioFallback } from '@/data/e281Fallback';
import type { HarnessRecord, ProjectRecord, ScenarioRecord } from '@/data/db';
import { computeHarnessCost, computeProjectFromHarnesses } from '@/engine/harness_costing';
import { computeChangePricing, buildChangeComparisonTable } from '@/engine/change_pricing';
import { buildQuoteSheet } from '@/engine/quote_template';
import {
  exportGeelyQuoteExcel,
  exportBydQuoteExcel,
  exportGenericQuoteExcel,
  exportFullQuoteExcel,
  exportChangePricingExcel,
} from '@/engine/excel_export';
import { exportQuoteExcel, exportQuotePdf } from '@/lib/exportApi';
import { apiClient } from '@/lib/apiClient';
import { applyCustomerQuoteSnapshot } from '@/utils/customerQuoteSnapshots';
import type { HarnessInput } from '@/types/harness';
import type { QuoteSheet, TemplateType } from '@/types/quote';
import { RoleGuard } from '@/components/RoleGuard';
import ScenarioSelector from '@/components/ScenarioSelector';

const { Title, Text } = Typography;

type ApiQuote = {
  id: string;
  version: string;
  projectId: string;
  scenarioId?: string | null;
  harnessId?: string | null;
  status: string;
  template: string;
  data?: QuoteSheet;
};

type QuoteStatus = 'draft' | 'confirmed' | 'published';

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

export default function QuotePage() {
  const { id, sid } = useParams<{ id: string; sid: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [scenario, setScenario] = useState<ScenarioRecord | null>(null);
  const [harnesses, setHarnesses] = useState<HarnessRecord[]>([]);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [quoteRecords, setQuoteRecords] = useState<ApiQuote[]>([]);

  // Tab 1 Quote Template State
  const [templateType, setTemplateType] = useState<TemplateType>('geely');

  // Tab 2 Simulation State
  const [changeMode, setChangeMode] = useState<'bom' | 'hours' | 'config'>('bom');
  const [modifiedHarnesses, setModifiedHarnesses] = useState<Record<string, Partial<HarnessInput>>>({});

  useEffect(() => {
    async function loadData() {
      if (!id || !sid) return;
      try {
        const p = await db.projects.get(id);
        if (!p) {
          Toast.error('项目不存在');
          return;
        }
        const s = await db.scenarios.get(sid);
        if (!s) {
          Toast.error('场景不存在');
          return;
        }
        const scenarioWithFallback = applyE281ScenarioFallback(s);
        const h = await db.harnesses.where('scenarioId').equals(sid).toArray();
        const quotes = await apiClient<ApiQuote[]>(`/quotes/scenario/${sid}`);
        const preferredQuote = quotes.find((quote) => quote.template === templateType) || quotes[0] || null;
        setProject(p);
        setScenario(scenarioWithFallback);
        setHarnesses(h);
        setQuoteRecords(quotes);
        setSelectedQuoteId(preferredQuote?.id ?? null);
      } catch (err) {
        console.error(err);
        setQuoteRecords([]);
        setSelectedQuoteId(null);
        Toast.error('数据加载失败');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id, sid, templateType]);

  const customerQuoteSnapshots = useMemo(() => {
    return scenario?.config.customerQuoteSnapshots;
  }, [scenario]);

  const baselineComputedResults = useMemo(() => {
    if (!scenario) return [];
    return harnesses
      .map(h => computeHarnessCost(h.input, scenario.config.costRates, scenario.config.metalPrices))
      .sort((a, b) => a.harnessId.localeCompare(b.harnessId));
  }, [scenario, harnesses]);

  // Baseline results
  const baselineResults = useMemo(() => {
    return baselineComputedResults.map(result => applyCustomerQuoteSnapshot(
      result,
      customerQuoteSnapshots?.[result.harnessId],
    ));
  }, [baselineComputedResults, customerQuoteSnapshots]);

  const baselineProject = useMemo(() => {
    return computeProjectFromHarnesses(baselineResults);
  }, [baselineResults]);

  // Tab 1: Quote Template derived data
  const quoteSheet = useMemo(() => {
    if (!project || !scenario || baselineComputedResults.length === 0) return null;
    return buildQuoteSheet(
      baselineComputedResults,
      templateType,
      {
        projectName: project.meta.projectName,
        customer: project.meta.customer,
      },
      scenario.config.nreData,
      scenario.config.volumes,
      customerQuoteSnapshots,
    );
  }, [project, scenario, baselineComputedResults, templateType, customerQuoteSnapshots]);

  const sortedHarnesses = useMemo(() => {
    return [...harnesses].sort((a, b) => a.harnessId.localeCompare(b.harnessId));
  }, [harnesses]);

  const baselineResultsById = useMemo(() => {
    return new Map(baselineResults.map(result => [result.harnessId, result]));
  }, [baselineResults]);

  useEffect(() => {
    if (!sid) return;
    let active = true;
    async function syncSelectedQuote() {
      try {
        const quotes = await apiClient<ApiQuote[]>(`/quotes/scenario/${sid}`);
        setQuoteRecords(quotes);
        if (!active) return;
        const preferredQuote = quotes.find((quote) => quote.template === templateType) || quotes[0] || null;
        setSelectedQuoteId(preferredQuote?.id ?? null);
      } catch {
        setQuoteRecords([]);
        if (active) setSelectedQuoteId(null);
      }
    }
    void syncSelectedQuote();
    return () => {
      active = false;
    };
  }, [sid, templateType]);

  const selectedQuote = useMemo(() => {
    return quoteRecords.find((quote) => quote.id === selectedQuoteId) || null;
  }, [quoteRecords, selectedQuoteId]);
  const selectedQuoteStatus = useMemo(
    () => normalizeQuoteStatus(selectedQuote?.status),
    [selectedQuote?.status],
  );
  const selectedQuoteStatusMeta = useMemo(
    () => quoteStatusMeta(selectedQuoteStatus),
    [selectedQuoteStatus],
  );
  const isDraftQuote = selectedQuoteStatus === 'draft';
  const isConfirmedQuote = selectedQuoteStatus === 'confirmed';
  const isPublishedQuote = selectedQuoteStatus === 'published';

  const refreshQuotes = async () => {
    if (!sid) return;
    const quotes = await apiClient<ApiQuote[]>(`/quotes/scenario/${sid}`);
    setQuoteRecords(quotes);
    const preferredQuote = quotes.find((quote) => quote.template === templateType) || quotes[0] || null;
    setSelectedQuoteId(preferredQuote?.id ?? null);
  };

  const persistCurrentQuote = useCallback(async () => {
    if (!id || !sid || !scenario || !quoteSheet) {
      throw new Error('当前报价内容尚未准备完成');
    }

    const payload = {
      projectId: id,
      version: `${scenario.scenarioCode}-${templateType}`,
      template: templateType,
      data: quoteSheet,
      quoteParams: {
        templateType,
        scenarioId: sid,
        scenarioCode: scenario.scenarioCode,
        scenarioName: scenario.scenarioName,
        scenarioType: scenario.scenarioType,
      },
      quoteResult: {
        totals: quoteSheet.totals,
        harnessCount: quoteSheet.harnessCount,
        baselineVehicleCost: baselineProject.vehicleCost,
      },
      internalCostBaseline: baselineProject.vehicleCost,
      exWorksPrice: Number(quoteSheet.totals.exFactoryPrice ?? 0),
      arrivalPrice: Number(quoteSheet.totals.deliveredPrice ?? 0),
      effectivePrice: Number(quoteSheet.totals.deliveredPrice ?? quoteSheet.totals.exFactoryPrice ?? 0),
      effectivePriceMode: 'arrival',
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
  }, [baselineProject.vehicleCost, id, quoteSheet, scenario, selectedQuote?.status, selectedQuoteId, sid, templateType]);

  const handleSaveQuote = useCallback(async () => {
    try {
      const saved = await persistCurrentQuote();
      setSelectedQuoteId(saved.id);
      await refreshQuotes();
      Toast.success('报价草稿已保存');
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '报价保存失败');
    }
  }, [persistCurrentQuote]);

  const handleConfirmQuote = async () => {
    try {
      const saved = await persistCurrentQuote();
      await apiClient(`/quotes/${saved.id}/confirm`, {
        method: 'POST',
      });
      setSelectedQuoteId(saved.id);
      Toast.success('报价已确认并写入版本/审计');
      await refreshQuotes();
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '报价确认失败');
    }
  };

  const handlePublishQuote = useCallback(async () => {
    if (!selectedQuoteId) {
      Toast.warning('当前没有可发布的报价');
      return;
    }
    try {
      await apiClient(`/quotes/${selectedQuoteId}/publish`, {
        method: 'POST',
      });
      Toast.success('报价已发布并写入版本/审计');
      await refreshQuotes();
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '报价发布失败');
    }
  }, [selectedQuoteId]);

  // Tab 2: Change Pricing Simulation
  const simulatedResults = useMemo(() => {
    if (!scenario) return [];
    return harnesses.map(h => {
      const modifications = modifiedHarnesses[h.harnessId] || {};
      const simulatedInput = { ...h.input, ...modifications };
      return applyCustomerQuoteSnapshot(
        computeHarnessCost(simulatedInput as HarnessInput, scenario.config.costRates, scenario.config.metalPrices),
        customerQuoteSnapshots?.[h.harnessId],
      );
    });
  }, [scenario, harnesses, modifiedHarnesses]);

  const simulatedProject = useMemo(() => {
    return computeProjectFromHarnesses(simulatedResults);
  }, [simulatedResults]);

  const changePricingResult = useMemo(() => {
    return computeChangePricing(baselineProject, simulatedProject, changeMode);
  }, [baselineProject, simulatedProject, changeMode]);

  const formatCurrency = (val: number | undefined) => {
    if (val === undefined) return '-';
    return `¥${val.toFixed(2)}`;
  };

  const formatDelta = (val: number | undefined) => {
    if (val === undefined) return '-';
    const color = val > 0 ? 'var(--semi-color-danger)' : val < 0 ? 'var(--semi-color-success)' : 'inherit';
    const prefix = val > 0 ? '+' : '';
    return <span style={{ color }}>{prefix}{val.toFixed(2)}</span>;
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  if (!project || !scenario) return <div>项目不存在</div>;

  const geelyColumns = [
    { title: '零件号', render: (_: any, h: any) => h.harnessId, width: 120, fixed: 'left' as const },
    { title: '名称', render: (_: any, h: any) => h.harnessName, width: 150, fixed: 'left' as const },
    { title: 'A1原材料', render: (_: any, h: any) => formatCurrency(h.A1_rawMaterial) },
    { title: 'A2外购件', render: (_: any, h: any) => formatCurrency(h.A2_purchasedParts) },
    { title: 'B1加工费', render: (_: any, h: any) => formatCurrency(h.B1_processingFee) },
    { title: 'B2废品', render: (_: any, h: any) => formatCurrency(h.B2_wasteLoss) },
    { title: 'C1管理费', render: (_: any, h: any) => formatCurrency(h.C1_managementFee) },
    { title: 'C2财务费', render: (_: any, h: any) => formatCurrency(h.C2_financeFee) },
    { title: 'C3销售费', render: (_: any, h: any) => formatCurrency(h.C3_salesFee) },
    { title: 'D利润', render: (_: any, h: any) => <RoleGuard field="profitRate">{formatCurrency(h.D_profit)}</RoleGuard> },
    { title: '出厂价', render: (_: any, h: any) => formatCurrency(h.exFactoryPrice) },
    { title: 'E工装分摊', render: (_: any, h: any) => formatCurrency(h.E1_borrowedTooling + h.E2_newTooling) },
    { title: 'F试验分摊', render: (_: any, h: any) => formatCurrency(h.F1_borrowedTesting + h.F2_newTesting) },
    { title: 'G研发分摊', render: (_: any, h: any) => formatCurrency(h.G1_borrowedRnd + h.G2_newRnd) },
    { title: '到厂价', render: (_: any, h: any) => formatCurrency(h.deliveredPrice), fixed: 'right' as const, width: 100 },
  ];

  const renderQuoteTemplate = () => {
    if (!quoteSheet) return null;
    const dataSource = [...quoteSheet.harnesses];
    const totals = quoteSheet.totals as any;

    let columns = [];
    if (templateType === 'byd') {
      columns = [
        { title: '零件号', render: (_: any, h: any) => h.harnessId, width: 120, fixed: 'left' as const },
        { title: '名称', render: (_: any, h: any) => h.harnessName, width: 150, fixed: 'left' as const },
        { title: '直接材料', render: (_: any, h: any) => formatCurrency(h.directMaterial) },
        { title: '加工费', render: (_: any, h: any) => formatCurrency(h.processingFee) },
        { title: '废品', render: (_: any, h: any) => formatCurrency(h.wasteLoss) },
        { title: '管理费(6%)', render: (_: any, h: any) => formatCurrency(h.managementFee) },
        { title: '利润(5%)', render: (_: any, h: any) => <RoleGuard field="profitRate">{formatCurrency(h.profit)}</RoleGuard> },
        { title: '出厂价', render: (_: any, h: any) => formatCurrency(h.exFactoryPrice) },
        { title: '包装费', render: (_: any, h: any) => formatCurrency(h.packagingCost) },
        { title: '运输费', render: (_: any, h: any) => formatCurrency(h.freightCost) },
        { title: '到厂价', render: (_: any, h: any) => formatCurrency(h.deliveredPrice), fixed: 'right' as const, width: 100 },
      ];
    } else if (templateType === 'generic') {
      columns = [
        { title: '零件号', render: (_: any, h: any) => h.harnessId, width: 120, fixed: 'left' as const },
        { title: '名称', render: (_: any, h: any) => h.harnessName, width: 150, fixed: 'left' as const },
        { title: '材料成本', render: (_: any, h: any) => formatCurrency(h.materialCost) },
        { title: '人工', render: (_: any, h: any) => formatCurrency(h.laborCost) },
        { title: '制造', render: (_: any, h: any) => formatCurrency(h.mfgCost) },
        { title: '废品', render: (_: any, h: any) => formatCurrency(h.wasteCost) },
        { title: '管理费', render: (_: any, h: any) => formatCurrency(h.mgmtFee) },
        { title: '利润', render: (_: any, h: any) => <RoleGuard field="profitRate">{formatCurrency(h.profit)}</RoleGuard> },
        { title: '出厂价', render: (_: any, h: any) => formatCurrency(h.exFactoryPrice) },
        { title: '包装费', render: (_: any, h: any) => formatCurrency(h.packagingCost) },
        { title: '运输费', render: (_: any, h: any) => formatCurrency(h.freightCost) },
        { title: '到厂价', render: (_: any, h: any) => formatCurrency(h.deliveredPrice), fixed: 'right' as const, width: 100 },
      ];
    } else {
      columns = geelyColumns;
    }

    return (
      <Space vertical align="start" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
          <Space>
            <Select 
              value={templateType} 
              onChange={v => setTemplateType(v as TemplateType)}
              style={{ width: 150 }}
              prefix="切换模板: "
            >
              <Select.Option value="geely">吉利 (Geely)</Select.Option>
              <Select.Option value="byd">比亚迪 (BYD)</Select.Option>
              <Select.Option value="generic">通用模板</Select.Option>
            </Select>
            <Card className="glass-card" style={{ padding: '4px 12px' }}>
              {templateType === 'geely' && (
                <div style={{ display: 'flex', gap: 16 }}>
                  <div><Text size="small" type="secondary">管理:</Text> <Text strong size="small">4%</Text></div>
                  <div><Text size="small" type="secondary">财务:</Text> <Text strong size="small">4%</Text></div>
                  <div><Text size="small" type="secondary">销售:</Text> <Text strong size="small">4%</Text></div>
                  <div><Text size="small" type="secondary">利润:</Text> <Text strong size="small">4%</Text></div>
                </div>
              )}
              {templateType === 'byd' && (
                <div style={{ display: 'flex', gap: 16 }}>
                  <div><Text size="small" type="secondary">管理费:</Text> <Text strong size="small">6%</Text></div>
                  <div><Text size="small" type="secondary">利润:</Text> <Text strong size="small">5%</Text></div>
                </div>
              )}
              {templateType === 'generic' && (
                <div style={{ display: 'flex', gap: 16 }}>
                  <div><Text size="small" type="secondary">说明:</Text> <Text size="small">使用项目全局核算费率</Text></div>
                </div>
              )}
            </Card>
          </Space>
          <Space>
            <RoleGuard field="quoteExport">
            <Button icon={<IconDownload />} onClick={() => {
              if (templateType === 'byd') exportBydQuoteExcel(baselineResults, project.meta.projectName, project.meta.customer);
              else if (templateType === 'generic') exportGenericQuoteExcel(baselineResults, project.meta.projectName, project.meta.customer);
              else exportGeelyQuoteExcel(baselineResults, project.meta.projectName, project.meta.customer);
              Toast.success('报价模板已导出');
            }}>导出客户模板</Button>
            </RoleGuard>
            <RoleGuard field="quoteExport">
            <Button icon={<IconDownload />} theme="light" onClick={() => {
              exportFullQuoteExcel(baselineResults, baselineProject, project.meta.projectName, project.meta.customer, templateType);
              Toast.success('综合报价已导出');
            }}>导出综合报价</Button>
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
                  await exportQuoteExcel(selectedQuoteId);
                  Toast.success('报价 Excel 已导出');
                } catch (error) {
                  Toast.error(error instanceof Error ? error.message : '报价 Excel 导出失败');
                }
              }}
            >导出报价Excel</Button>
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
            >导出报价PDF</Button>
            </RoleGuard>
          </Space>
        </div>
        <Table
          columns={columns}
          dataSource={dataSource}
          pagination={false}
          scroll={{ x: 1400 }}
          style={{ width: '100%' }}
          footer={() => {
            const row: any = { harnessId: '合计', harnessName: '' };
            columns.forEach((c: any) => {
              const title = c.title as string;
              if (title === '零件号') return;
              if (title === '名称') return;
              
              // 匹配合计数据
              let dataKey: string | undefined = undefined;
              if (templateType === 'geely') {
                const keyMap: Record<string, string> = {
                  'A1原材料': 'A1_rawMaterial', 'A2外购件': 'A2_purchasedParts', 'B1加工费': 'B1_processingFee',
                  'B2废品': 'B2_wasteLoss', 'C1管理费': 'C1_managementFee', 'C2财务费': 'C2_financeFee',
                  'C3销售费': 'C3_salesFee', 'D利润': 'D_profit', '出厂价': 'exFactoryPrice', '到厂价': 'deliveredPrice'
                };
                if(title === 'E工装分摊') row[title] = totals.E1_borrowedTooling + totals.E2_newTooling;
                else if(title === 'F试验分摊') row[title] = totals.F1_borrowedTesting + totals.F2_newTesting;
                else if(title === 'G研发分摊') row[title] = totals.G1_borrowedRnd + totals.G2_newRnd;
                else if(keyMap[title]) dataKey = keyMap[title];
              } else if (templateType === 'byd') {
                const keyMap: Record<string, string> = {
                   '直接材料': 'directMaterial', '加工费': 'processingFee', '废品': 'wasteLoss',
                   '管理费(6%)': 'managementFee', '利润(5%)': 'profit', '出厂价': 'exFactoryPrice',
                   '包装费': 'packagingCost', '运输费': 'freightCost', '到厂价': 'deliveredPrice'
                };
                dataKey = keyMap[title];
              } else {
                const keyMap: Record<string, string> = {
                  '材料成本': 'materialCost', '人工': 'laborCost', '制造': 'mfgCost', '废品': 'wasteCost',
                  '管理费': 'mgmtFee', '利润': 'profit', '出厂价': 'exFactoryPrice',
                  '包装费': 'packagingCost', '运输费': 'freightCost', '到厂价': 'deliveredPrice'
                };
                dataKey = keyMap[title];
              }

              if (dataKey) row[title] = totals[dataKey];
            });

            return (
              <div style={{ display: 'flex', fontWeight: 'bold', padding: '12px 16px', borderTop: '1px solid var(--semi-color-border)' }}>
                <div style={{ width: 120 }}>合计</div>
                <div style={{ width: 150 }}></div>
                {columns.slice(2, -1).map((c: any) => (
                  <div key={c.title} style={{ flex: 1, textAlign: 'left' }}>
                    {c.title.includes('利润') ? (
                      <RoleGuard field="profitRate">{formatCurrency(row[c.title])}</RoleGuard>
                    ) : (
                      formatCurrency(row[c.title])
                    )}
                  </div>
                ))}
                <div style={{ width: 100, textAlign: 'left' }}>{formatCurrency(row['到厂价'])}</div>
              </div>
            );
          }}
        />
      </Space>
    );
  };

  const renderChangePricing = () => {
    const comp = buildChangeComparisonTable(changePricingResult);
    const comparisonColumns = [
      { title: '零件号', render: (_: any, r: any) => r.harnessId },
      { title: '名称', render: (_: any, r: any) => r.harnessName },
      { title: '变更类型', render: (_: any, r: any) => {
          const colors: Record<string, string> = { '新增': 'green', '删除': 'red', '变更': 'orange' };
          const category = (r.changeCategory || '') as string;
          return <Tag color={(colors[category] || 'grey') as any}>{r.changeCategory}</Tag>;
        }
      },
      { title: '定点价', render: (_: any, r: any) => formatCurrency(r.beforePrice) },
      { title: '变更后', render: (_: any, r: any) => formatCurrency(r.afterPrice) },
      { title: '差异', render: (_: any, r: any) => formatDelta(r.deltaPrice) },
      { title: '差异%', render: (_: any, r: any) => {
          const color = r.deltaPercent > 0 ? 'var(--semi-color-danger)' : r.deltaPercent < 0 ? 'var(--semi-color-success)' : 'inherit';
          return <span style={{ color }}>{r.deltaPercent > 0 ? '+' : ''}{r.deltaPercent.toFixed(2)}%</span>;
        }
      },
    ];

    return (
      <Space vertical align="start" style={{ width: '100%' }}>
        <Card className="glass-card" title="变更场景模拟" style={{ width: '100%' }}>
          <Space vertical align="start">
            <RadioGroup value={changeMode} onChange={(e) => setChangeMode(e.target.value as any)} type="button">
              <Radio value="bom">BOM变更</Radio>
              <Radio value="hours">工时变更</Radio>
              <Radio value="config">配置变更</Radio>
            </RadioGroup>
            
            <Table
              dataSource={sortedHarnesses}
              pagination={false}
              size="small"
              columns={[
                { title: '零件号', render: (_: any, h: any) => h.harnessId },
                { title: '名称', render: (_: any, h: any) => h.harnessName },
                { title: '当前值', render: (_: any, h: any) => {
                    const current = baselineResultsById.get(h.harnessId);
                    if (changeMode === 'bom') return formatCurrency(current?.materialCost);
                    if (changeMode === 'hours') return current ? `${(current.processHours ?? 0).toFixed(2)} h` : '-';
                    return `${((h.input.vehicleRatio ?? 0) * 100).toFixed(1)}%`;
                  }
                },
                { title: changeMode === 'bom' ? '新材料成本' : changeMode === 'hours' ? '新工时' : '新装车比',
                  render: (_: any, h: any) => (
                    <InputNumber
                      value={(modifiedHarnesses[h.harnessId] as any)?.[changeMode === 'bom' ? 'materialCost' : changeMode === 'hours' ? 'processHours' : 'vehicleRatio']}
                      onChange={(val) => {
                        const field = changeMode === 'bom' ? 'materialCost' : changeMode === 'hours' ? 'processHours' : 'vehicleRatio';
                        setModifiedHarnesses({
                          ...modifiedHarnesses,
                          [h.harnessId]: { ...modifiedHarnesses[h.harnessId], [field]: val }
                        });
                      }}
                      style={{ width: 120 }}
                      prefix={changeMode === 'bom' ? '¥' : ''}
                      suffix={changeMode === 'hours' ? 'h' : changeMode === 'config' ? '%' : ''}
                    />
                  )
                }
              ]}
            />
          </Space>
        </Card>

        <Card className="glass-card" title="变更对比结果" style={{ width: '100%' }}>
          <div style={{ display: 'flex', gap: 48, marginBottom: 24 }}>
            <div>
              <Text style={{ color: 'var(--semi-color-text-2)' }}>单车影响金额</Text>
              <Title heading={3} style={{ margin: 0 }}>{formatDelta(changePricingResult.summary.totalDelta)}</Title>
            </div>
            <div>
              <Text style={{ color: 'var(--semi-color-text-2)' }}>单车变化率</Text>
              <Title heading={3} style={{ margin: 0 }}>
                {formatDelta(changePricingResult.summary.deltaPercent)}%
              </Title>
            </div>
            <div>
              <Text style={{ color: 'var(--semi-color-text-2)' }}>变更线束数</Text>
              <Title heading={3} style={{ margin: 0 }}>{changePricingResult.summary.affectedCount}</Title>
            </div>
            <div style={{ flex: 1, textAlign: 'right', alignSelf: 'flex-end' }}>
              <Space>
                <RoleGuard field="changeExport">
                <Button
                  icon={<IconDownload />}
                  onClick={() => {
                    exportChangePricingExcel(
                      changePricingResult,
                      baselineResults,
                      project.meta.projectName,
                      project.meta.customer
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
    <div className="page-container">
      <ScenarioSelector />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, padding: '16px 0' }}>
        <Button
          icon={<IconArrowLeft />}
          aria-label="返回"
          theme="borderless"
          onClick={() => navigate(`/project/${id}/s/${sid}`)}
        />
        <div style={{ flex: 1 }}>
          <Title heading={4} style={{ margin: 0 }}>报价工作台</Title>
          <Text style={{ color: 'var(--semi-color-text-2)' }}>{project.meta.projectName} / {project.meta.customer}</Text>
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
                theme="light"
                disabled={!quoteSheet || isPublishedQuote}
                onClick={handleSaveQuote}
              >
                保存报价草稿
              </Button>
              <Button
                theme="solid"
                disabled={!quoteSheet || isPublishedQuote}
                onClick={handleConfirmQuote}
              >
                确认报价
              </Button>
            </>
          )}
          {isConfirmedQuote && (
            <Button
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

      <Tabs type="line">
        <TabPane tab={<span><IconList style={{ marginRight: 8 }} />报价模板</span>} itemKey="1">
          <div style={{ padding: '16px 0' }}>
            {renderQuoteTemplate()}
          </div>
        </TabPane>
        <TabPane tab={<span><IconSimilarity style={{ marginRight: 8 }} />设变报价</span>} itemKey="2">
          <div style={{ padding: '16px 0' }}>
            {renderChangePricing()}
          </div>
        </TabPane>
      </Tabs>
    </div>
  );
}
