import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Typography, Spin, Button, Card, Table, Tabs, TabPane, InputNumber, Toast, Tag, Space, Radio, RadioGroup, Banner, Select } from '@douyinfe/semi-ui';
import { IconArrowLeft, IconDownload, IconSimilarity, IconHistogram, IconList } from '@douyinfe/semi-icons';
import { db } from '@/data/db';
import type { HarnessRecord, ProjectRecord } from '@/data/db';
import { computeHarnessCost, computeProjectFromHarnesses } from '@/engine/harness_costing';
import { computeChangePricing, buildChangeComparisonTable, computeAnnualDrop } from '@/engine/change_pricing';
import { buildQuoteSheet } from '@/engine/quote_template';
import { computeMetalEscalation, computeSensitivityMatrix, DEFAULT_CONTRACT } from '@/engine/metal_escalation';
import { 
  exportGeelyQuoteExcel, 
  exportBydQuoteExcel, 
  exportGenericQuoteExcel, 
  exportFullQuoteExcel,
  exportChangePricingExcel,
  exportMetalEscalationExcel
} from '@/engine/excel_export';
import type { HarnessInput } from '@/types/harness';
import type { MetalPrices } from '@/types/project';
import type { MetalEscalationResult, TemplateType } from '@/types/quote';
import { RoleGuard } from '@/components/RoleGuard';

const { Title, Text } = Typography;

export default function QuotePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [harnesses, setHarnesses] = useState<HarnessRecord[]>([]);

  // Tab 1 Quote Template State
  const [templateType, setTemplateType] = useState<TemplateType>('geely');

  // Tab 2 Simulation State
  const [changeMode, setChangeMode] = useState<'bom' | 'hours' | 'config'>('bom');
  const [modifiedHarnesses, setModifiedHarnesses] = useState<Record<string, Partial<HarnessInput>>>({});
  const [annualDropRate, setAnnualDropRate] = useState(2);

  // Tab 3 Metal Escalation State
  const [metalPrices, setMetalPrices] = useState<MetalPrices>({ copper: 68400, aluminum: 18200 });
  const [baseMetalPrices, setBaseMetalPrices] = useState<MetalPrices>({ copper: 68400, aluminum: 18200 });
  const [threshold, setThreshold] = useState(5);
  const [escalationRatio, setEscalationRatio] = useState(100);
  const [period, setPeriod] = useState<'quarterly' | 'semiannual' | 'annual'>('quarterly');
  const [metalResult, setMetalResult] = useState<MetalEscalationResult | null>(null);

  useEffect(() => {
    async function loadData() {
      if (!id) return;
      try {
        const p = await db.projects.get(id);
        if (!p) {
          Toast.error('项目不存在');
          return;
        }
        const h = await db.harnesses.where('projectId').equals(id).toArray();
        setProject(p);
        setHarnesses(h);
        setBaseMetalPrices(p.config.metalPrices);
        setMetalPrices(p.config.metalPrices);
      } catch (err) {
        console.error(err);
        Toast.error('数据加载失败');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  // Baseline results
  const baselineResults = useMemo(() => {
    if (!project) return [];
    return harnesses.map(h => computeHarnessCost(h.input, project.config.costRates, project.config.metalPrices));
  }, [project, harnesses]);

  const baselineProject = useMemo(() => {
    return computeProjectFromHarnesses(baselineResults);
  }, [baselineResults]);

  // Tab 1: Quote Template derived data
  const quoteSheet = useMemo(() => {
    if (!project || baselineResults.length === 0) return null;
    return buildQuoteSheet(baselineResults, templateType, {
      projectName: project.meta.projectName,
      customer: project.meta.customer
    }, project.config.nreData, project.config.volumes);
  }, [project, baselineResults, templateType]);

  // Tab 2: Change Pricing Simulation
  const simulatedResults = useMemo(() => {
    if (!project) return [];
    return harnesses.map(h => {
      const modifications = modifiedHarnesses[h.harnessId] || {};
      const simulatedInput = { ...h.input, ...modifications };
      return computeHarnessCost(simulatedInput as HarnessInput, project.config.costRates, project.config.metalPrices);
    });
  }, [project, harnesses, modifiedHarnesses]);

  const simulatedProject = useMemo(() => {
    return computeProjectFromHarnesses(simulatedResults);
  }, [simulatedResults]);

  const changePricingResult = useMemo(() => {
    return computeChangePricing(baselineProject, simulatedProject, changeMode);
  }, [baselineProject, simulatedProject, changeMode]);

  const annualDropData = useMemo(() => {
    return computeAnnualDrop(baselineProject.vehicleCost, annualDropRate / 100, 7);
  }, [baselineProject.vehicleCost, annualDropRate]);

  // Tab 3: Metal Escalation Sensitivity Matrix
  const sensitivityMatrix = useMemo(() => {
    if (baselineResults.length === 0) return null;
    const baseCu = baseMetalPrices.copper;
    const steps = [-0.2, -0.15, -0.1, -0.05, 0, 0.05, 0.1, 0.15, 0.2];
    const copperRange = steps.map(s => baseCu * (1 + s));
    return computeSensitivityMatrix(baselineResults, baseMetalPrices, copperRange, [baseMetalPrices.aluminum]);
  }, [baselineResults, baseMetalPrices]);

  const handleCalculateMetal = () => {
    if (!project) return;
    const contract = {
      ...DEFAULT_CONTRACT,
      baseCopperPrice: baseMetalPrices.copper,
      baseAluminumPrice: baseMetalPrices.aluminum,
      thresholdPercent: threshold / 100,
      escalationRatio: escalationRatio / 100,
      period: period,
    };
    const res = computeMetalEscalation(baselineResults, baseMetalPrices, metalPrices, contract, {
      annualVolumes: project.config.volumes.map(v => v.volume)
    });
    setMetalResult(res);
  };

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
  if (!project) return <div>Project not found</div>;

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
              dataSource={harnesses}
              pagination={false}
              size="small"
              columns={[
                { title: '零件号', render: (_: any, h: any) => h.harnessId },
                { title: '名称', render: (_: any, h: any) => h.harnessName },
                { title: '当前值', render: (_: any, h: any) => {
                    if (changeMode === 'bom') return formatCurrency(baselineResults.find(r => r.harnessId === h.harnessId)?.materialCost);
                    if (changeMode === 'hours') return `${baselineResults.find(r => r.harnessId === h.harnessId)?.processHours.toFixed(2)} h`;
                    return `${(h.input.vehicleRatio * 100).toFixed(0)}%`;
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
                      project.meta.customer,
                      annualDropData
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

        <Card className="glass-card" title="年度降价模拟 (Annual Drop)" style={{ width: '100%' }}>
          <Space align="center" style={{ marginBottom: 16 }}>
            <Text>年降率:</Text>
            <InputNumber value={annualDropRate} onChange={v => setAnnualDropRate(v as number)} suffix="%" style={{ width: 100 }} />
          </Space>
          <Table
            dataSource={annualDropData}
            pagination={false}
            columns={[
              { title: '年度', render: (_: any, r: any) => `Year ${r.year}` },
              { title: '到厂价', render: (_: any, r: any) => formatCurrency(r.deliveredPrice) },
              { title: '降幅', render: (_: any, r: any) => formatCurrency(r.dropFromBase) },
              { title: '累计降幅%', render: (_: any, r: any) => `${r.dropPercent.toFixed(2)}%` },
            ]}
          />
        </Card>
      </Space>
    );
  };

  const renderMetalEscalation = () => {
    const metalColumns = [
      { title: '零件号', render: (_: any, r: any) => r.harnessId },
      { title: '名称', render: (_: any, r: any) => r.harnessName },
      { title: '铜重(kg)', render: (_: any, r: any) => r.copperWeight.toFixed(3) },
      { title: '铝重(kg)', render: (_: any, r: any) => r.aluminumWeight.toFixed(3) },
      { title: '铜价变化', render: (_: any, r: any) => formatDelta(r.copperPriceDelta) },
      { title: '铝价变化', render: (_: any, r: any) => formatDelta(r.aluminumPriceDelta) },
      { title: '材料变化', render: (_: any, r: any) => formatDelta(r.deltaMaterialCost) },
      { title: '废品联动', render: (_: any, r: any) => formatDelta(r.deltaWasteCost) },
      { title: '管理费联动', render: (_: any, r: any) => formatDelta(r.deltaMgmtFee) },
      { title: '利润联动', render: (_: any, r: any) => formatDelta(r.deltaProfit) },
      { title: '到厂价变化', render: (_: any, r: any) => formatDelta(r.deltaDeliveredPrice) },
      { title: '加权影响', render: (_: any, r: any) => formatDelta(r.weightedDelta) },
    ];

    return (
      <Space vertical align="start" style={{ width: '100%' }}>
        <Card className="glass-card" title="金属价格参数" style={{ width: '100%' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}>
            <div>
              <Text style={{ display: 'block', color: 'var(--semi-color-text-2)' }}>基准铜价 (元/吨)</Text>
              <InputNumber value={baseMetalPrices.copper} onChange={v => setBaseMetalPrices({ ...baseMetalPrices, copper: v as number })} style={{ width: '100%' }} />
            </div>
            <div>
              <Text style={{ display: 'block', color: 'var(--semi-color-text-2)' }}>基准铝价 (元/吨)</Text>
              <InputNumber value={baseMetalPrices.aluminum} onChange={v => setBaseMetalPrices({ ...baseMetalPrices, aluminum: v as number })} style={{ width: '100%' }} />
            </div>
            <div>
              <Text style={{ display: 'block', color: 'var(--semi-color-text-2)' }}>新铜价 (元/吨)</Text>
              <InputNumber value={metalPrices.copper} onChange={v => setMetalPrices({ ...metalPrices, copper: v as number })} style={{ width: '100%' }} />
            </div>
            <div>
              <Text style={{ display: 'block', color: 'var(--semi-color-text-2)' }}>新铝价 (元/吨)</Text>
              <InputNumber value={metalPrices.aluminum} onChange={v => setMetalPrices({ ...metalPrices, aluminum: v as number })} style={{ width: '100%' }} />
            </div>
            <div>
              <Text style={{ display: 'block', color: 'var(--semi-color-text-2)' }}>联动阈值 (%)</Text>
              <InputNumber value={threshold} onChange={v => setThreshold(v as number)} style={{ width: '100%' }} />
            </div>
            <div>
              <Text style={{ display: 'block', color: 'var(--semi-color-text-2)' }}>联动比例 (%)</Text>
              <InputNumber value={escalationRatio} onChange={v => setEscalationRatio(v as number)} style={{ width: '100%' }} />
            </div>
            <div>
              <Text style={{ display: 'block', color: 'var(--semi-color-text-2)' }}>联动周期</Text>
              <RadioGroup value={period} onChange={e => setPeriod(e.target.value as any)} type="button" style={{ width: '100%' }}>
                <Radio value="quarterly">季度</Radio>
                <Radio value="semiannual">半年</Radio>
                <Radio value="annual">年度</Radio>
              </RadioGroup>
            </div>
          </div>
          <Space>
            <Button theme="solid" icon={<IconHistogram />} onClick={handleCalculateMetal}>计算联动</Button>
            {metalResult && (
              <RoleGuard field="quoteExport">
              <Button 
                icon={<IconDownload />} 
                onClick={() => {
                  exportMetalEscalationExcel(metalResult, project.meta.projectName, project.meta.customer);
                  Toast.success('金属联动分析报表已导出');
                }}
              >
                导出联动报表
              </Button>
              </RoleGuard>
            )}
          </Space>
        </Card>

        {metalResult && (
          <>
            <div style={{ display: 'flex', gap: 16, width: '100%' }}>
              <Card className="glass-card" style={{ flex: 1 }}>
                <Text style={{ color: 'var(--semi-color-text-2)' }}>单车影响金额</Text>
                <Title heading={2}>{formatDelta(metalResult.summary.totalWeightedDelta)}</Title>
              </Card>
              <Card className="glass-card" style={{ flex: 1 }}>
                <Text style={{ color: 'var(--semi-color-text-2)' }}>全生命周期影响 (预计)</Text>
                <Title heading={2} style={{ color: metalResult.summary.totalWeightedDelta > 0 ? 'var(--semi-color-danger)' : 'var(--semi-color-success)' }}>
                  {metalResult.annualImpact ? formatCurrency(metalResult.annualImpact.totalLifecycleImpact) : '-'}
                </Title>
              </Card>
              <Card className="glass-card" style={{ flex: 1 }}>
                <Text style={{ color: 'var(--semi-color-text-2)' }}>受影响线束</Text>
                <Title heading={2}>{metalResult.summary.affectedCount}</Title>
              </Card>
            </div>
            <Card className="glass-card" title="联动计算明细" style={{ width: '100%' }}>
              <Table columns={metalColumns} dataSource={metalResult.harnesses} pagination={false} scroll={{ x: 1200 }} />
            </Card>
          </>
        )}

        <Card className="glass-card" title="铜价敏感度矩阵 (Sensitivity Matrix)" style={{ width: '100%' }}>
          <Banner
            type="info"
            description="基于基准铜价 ±20% 范围波动，展示对单车总成本的影响金额 (铝价保持基准值)。"
            style={{ marginBottom: 16 }}
          />
          {sensitivityMatrix && (
            <Table
              dataSource={sensitivityMatrix.matrix}
              pagination={false}
              columns={[
                { title: '铜价 (元/吨)', render: (_: any, row: any) => row[0].copper.toLocaleString() },
                { title: '价格变动%', render: (_: any, row: any) => {
                    const pct = (row[0].copper / sensitivityMatrix.baseMetal.copper - 1) * 100;
                    return `${pct > 0 ? '+' : ''}${pct.toFixed(0)}%`;
                  }
                },
                { title: '单车影响 (元)', render: (_: any, row: any) => formatDelta(row[0].deltaPerVehicle) }
              ]}
            />
          )}
        </Card>
      </Space>
    );
  };

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, padding: '16px 0' }}>
        <Button
          icon={<IconArrowLeft />}
          aria-label="返回"
          theme="borderless"
          onClick={() => navigate(`/project/${id}`)}
        />
        <div>
          <Title heading={4} style={{ margin: 0 }}>报价工作台</Title>
          <Text style={{ color: 'var(--semi-color-text-2)' }}>{project.meta.projectName} / {project.meta.customer}</Text>
        </div>
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
        <TabPane tab={<span><IconHistogram style={{ marginRight: 8 }} />金属联动</span>} itemKey="3">
          <div style={{ padding: '16px 0' }}>
            {renderMetalEscalation()}
          </div>
        </TabPane>
      </Tabs>
    </div>
  );
}
