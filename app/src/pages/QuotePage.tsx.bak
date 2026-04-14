import { useCallback, useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Typography, Spin, Button, Card, Table, Tabs, TabPane, InputNumber, Toast, Tag, Space, Radio, RadioGroup } from '@douyinfe/semi-ui';
import { IconArrowLeft, IconDownload, IconSimilarity, IconList } from '@douyinfe/semi-icons';
import { db } from '@/data/db';
import { applyE281ScenarioFallback } from '@/data/e281Fallback';
import type { HarnessRecord, ProjectRecord, ScenarioRecord } from '@/data/db';
import { computeHarnessCost, computeProjectFromHarnesses } from '@/engine/harness_costing';
import { computeChangePricing, buildChangeComparisonTable } from '@/engine/change_pricing';
import { computeSuggestedPrice } from '@/engine/quote_template';
import { exportChangePricingExcel } from '@/engine/excel_export';
import { exportQuoteExcel, exportQuotePdf } from '@/lib/exportApi';
import { apiClient } from '@/lib/apiClient';
import { applyCustomerQuoteSnapshot } from '@/utils/customerQuoteSnapshots';
import type { HarnessInput } from '@/types/harness';
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
  data?: Record<string, unknown>;
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

  // Tab 1 Suggested Price State
  const [targetMarginPercent, setTargetMarginPercent] = useState(15);

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
        const preferredQuote = quotes[0] || null;
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
  }, [id, sid]);

  const customerQuoteSnapshots = useMemo(() => {
    return scenario?.config.customerQuoteSnapshots;
  }, [scenario]);

  const baselineComputedResults = useMemo(() => {
    if (!scenario) return [];
    return harnesses
      .map(h => computeHarnessCost(h.input, scenario.config.costRates, scenario.config.metalPrices))
      .sort((a, b) => a.harnessId.localeCompare(b.harnessId));
  }, [scenario, harnesses]);

  const baselineResults = useMemo(() => {
    return baselineComputedResults.map(result => applyCustomerQuoteSnapshot(
      result,
      customerQuoteSnapshots?.[result.harnessId],
    ));
  }, [baselineComputedResults, customerQuoteSnapshots]);

  const baselineProject = useMemo(() => {
    return computeProjectFromHarnesses(baselineResults);
  }, [baselineResults]);

  // Tab 1: Suggested price from internal cost + target margin
  const suggestedPrice = useMemo(() => {
    return computeSuggestedPrice(baselineProject.vehicleCost, targetMarginPercent);
  }, [baselineProject.vehicleCost, targetMarginPercent]);

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
        const preferredQuote = quotes[0] || null;
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
  }, [sid]);

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
    const preferredQuote = quotes[0] || null;
    setSelectedQuoteId(preferredQuote?.id ?? null);
  };

  const persistCurrentQuote = useCallback(async () => {
    if (!id || !sid || !scenario || baselineResults.length === 0) {
      throw new Error('当前报价内容尚未准备完成');
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
  }, [baselineProject.vehicleCost, baselineResults.length, id, scenario, selectedQuote?.status, selectedQuoteId, sid, suggestedPrice, targetMarginPercent]);

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
    return <span style= color >{prefix}{val.toFixed(2)}</span>;
  };

  if (loading) return <Spin size="large" style= margin: '40px auto', display: 'block'  />;
  if (!project || !scenario) return <div>项目不存在</div>;

  // ── Tab 1: 建议售价 + 内部成本明细 ──
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
      <Space vertical align="start" style= width: '100%' >
        {/* 建议售价计算器 */}
        <Card className="glass-card" style= width: '100%' >
          <div style= display: 'flex', alignItems: 'center', gap: 32, flexWrap: 'wrap' >
            <div>
              <Text style= display: 'block', marginBottom: 4  type="tertiary">内部成本(单车)</Text>
              <Title heading={4} style= margin: 0 >{formatCurrency(baselineProject.vehicleCost)}</Title>
            </div>
            <div>
              <Text style= display: 'block', marginBottom: 4  type="tertiary">目标毛利率</Text>
              <InputNumber
                value={targetMarginPercent}
                onChange={(v) => setTargetMarginPercent(Number(v || 0))}
                min={0}
                max={99}
                step={0.5}
                suffix="%"
                style= width: 120 
              />
            </div>
            <div>
              <Text style= display: 'block', marginBottom: 4  type="tertiary">建议售价</Text>
              <Title heading={3} style= margin: 0, color: 'var(--semi-color-primary)' >{formatCurrency(suggestedPrice)}</Title>
            </div>
            <div>
              <Text style= display: 'block', marginBottom: 4  type="tertiary">利润额</Text>
              <Title heading={4} style= margin: 0, color: profitAmount > 0 ? 'var(--semi-color-success)' : 'var(--semi-color-danger)' >
                {formatCurrency(profitAmount)}
              </Title>
            </div>
            <div>
              <Text style= display: 'block', marginBottom: 4  type="tertiary">实际毛利率</Text>
              <Text strong>{actualMargin.toFixed(2)}%</Text>
            </div>
          </div>
        </Card>

        {/* 导出按钮 */}
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

        {/* 内部成本明细表 */}
        <Table
          columns={costColumns}
          dataSource={baselineResults}
          pagination={false}
          scroll= x: 900 
          style= width: '100%' 
          rowKey="harnessId"
        />
      </Space>
    );
  };

  // ── Tab 2: 设变报价 ──
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
          return <span style= color >{r.deltaPercent > 0 ? '+' : ''}{r.deltaPercent.toFixed(2)}%</span>;
        }
      },
    ];

    return (
      <Space vertical align="start" style= width: '100%' >
        <Card className="glass-card" title="变更场景模拟" style= width: '100%' >
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
                      style= width: 120 
                      prefix={changeMode === 'bom' ? '¥' : ''}
                      suffix={changeMode === 'hours' ? 'h' : changeMode === 'config' ? '%' : ''}
                    />
                  )
                }
              ]}
            />
          </Space>
        </Card>

        <Card className="glass-card" title="变更对比结果" style= width: '100%' >
          <div style= display: 'flex', justifyContent: 'space-between', marginBottom: 16 >
            <div>
              <Text style= display: 'block' >单车影响金额</Text>
              <Title heading={3} style= margin: 0 >{formatDelta(changePricingResult.summary.totalDelta)}</Title>
            </div>
            <div>
              <Text style= display: 'block' >单车变化率</Text>
              <Title heading={3} style= margin: 0 >
                {formatDelta(changePricingResult.summary.deltaPercent)}%
              </Title>
            </div>
            <div>
              <Text style= display: 'block' >变更线束数</Text>
              <Title heading={3} style= margin: 0 >{changePricingResult.summary.affectedCount}</Title>
            </div>
            <div style= display: 'flex', alignItems: 'flex-end' >
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
      <div style= display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 >
        <Button
          icon={<IconArrowLeft />}
          aria-label="返回"
          theme="borderless"
          onClick={() => navigate(`/project/${id}/s/${sid}`)}
        />
        <div style= flex: 1 >
          <Title heading={4} style= margin: 0 >报价工作台</Title>
          <Text style= display: 'block' >{project.meta.projectName} / {project.meta.customer}</Text>
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
                disabled={isPublishedQuote || baselineResults.length === 0}
                onClick={handleSaveQuote}
              >
                保存报价草稿
              </Button>
              <Button
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
        <TabPane tab={<span><IconList style= marginRight: 4  />建议售价</span>} itemKey="1">
          <div style= padding: '16px 0' >
            {renderSuggestedPrice()}
          </div>
        </TabPane>
        <TabPane tab={<span><IconSimilarity style= marginRight: 4  />设变报价</span>} itemKey="2">
          <div style= padding: '16px 0' >
            {renderChangePricing()}
          </div>
        </TabPane>
      </Tabs>
    </div>
  );
}
