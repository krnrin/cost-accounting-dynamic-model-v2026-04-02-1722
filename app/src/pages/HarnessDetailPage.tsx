import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Typography, 
  Button, 
  Card, 
  Row, 
  Col, 
  Tag, 
  Table, 
  Descriptions, 
  Spin,
  Empty,
  Layout,
  Popconfirm,
  Toast
} from '@douyinfe/semi-ui';
import { IconArrowLeft, IconEdit, IconDelete, IconCopy } from '@douyinfe/semi-icons';
import { useLiveQuery } from 'dexie-react-hooks';
import ReactECharts from 'echarts-for-react/lib/core';
import echarts from '@/lib/echarts';

import { db } from '@/data/db';
import { requireScenarioConfig } from '@/data/scenarioGuards';
import { ensureScenarioWorkspaceHydrated } from '@/data/serverScenarioSync';
import { computeHarnessCost } from '@/engine/harness_costing';
import type { HarnessResult } from '@/types/harness';
import { usePermission } from '@/hooks/usePermission';
import { RoleGuard } from '@/components/RoleGuard';
import BomCostPreview from '@/components/BomCostPreview';
import { UniverSheet } from '@/components/UniverSheet';
import ScenarioSelector from '@/components/ScenarioSelector';

const { Title, Text } = Typography;
const { Content } = Layout;

export default function HarnessDetailPage() {
  const { id, sid, harnessId } = useParams<{ id: string; sid: string; harnessId: string }>();
  const navigate = useNavigate();
  const { can } = usePermission();
  const [hydrationReady, setHydrationReady] = useState(!sid);
  const [hydrationError, setHydrationError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!id || !sid) {
      setHydrationReady(true);
      setHydrationError(null);
      return () => {
        cancelled = true;
      };
    }

    setHydrationReady(false);
    setHydrationError(null);

    void ensureScenarioWorkspaceHydrated(id, sid)
      .then(() => {
        if (cancelled) return;
        setHydrationReady(true);
      })
      .catch((error) => {
        if (cancelled) return;
        setHydrationError(error instanceof Error ? error.message : '场景工作区加载失败');
      });

    return () => {
      cancelled = true;
    };
  }, [id, sid]);

  // 1. Data Loading
  const data = useLiveQuery(async () => {
    if (!id || !harnessId || !hydrationReady) return null;
    const project = await db.projects.get(id);
    const scenario = sid ? await db.scenarios.get(sid) : null;
    const harness = sid
      ? await db.harnesses.where('[scenarioId+harnessId]').equals([sid, harnessId]).first()
      : await db.harnesses.where({ projectId: id, harnessId: harnessId }).first();
    return { project, scenario, harness };
  }, [id, sid, harnessId, hydrationReady]);

  // 2. Cost Computation
  const { result, detailError } = useMemo((): { result: HarnessResult | null; detailError: string | null } => {
    if (!data) return { result: null, detailError: null };
    if (!data.project) return { result: null, detailError: '项目不存在' };
    if (!data.scenario) return { result: null, detailError: '场景不存在或未绑定' };
    if (!data.harness) return { result: null, detailError: '线束不存在' };

    try {
      const config = requireScenarioConfig(data.scenario, 'HarnessDetailPage');
      return {
        result: computeHarnessCost(
          data.harness.input,
          config.costRates,
          config.metalPrices,
        ),
        detailError: null,
      };
    } catch (error) {
      return {
        result: null,
        detailError: error instanceof Error ? error.message : '线束明细计算失败',
      };
    }
  }, [data]);

  // 2.5 BOM data conversion for UniverSheet
  const bomSheetData = useMemo(() => {
    if (!data?.harness?.input?.bom) return null;
    const bom = data.harness.input.bom;
    
    // Category labels
    const categoryLabels: Record<string, string> = {
      wire: '导线', connector: '连接器', terminal: '端子',
      ipt_terminal: '高压端子', bracket_rubber: '支架/橡胶',
      tape_tube: '胶带/套管', other: '其他'
    };
    
    const header: (string | number | null)[] = [
      '物料编号', '物料名称', '分类', '用量', '单位', '单价(元)',
      '金额(元)', '铜重(kg)', '铝重(kg)', '非金属成本(元)'
    ];
    
    const rows = bom.map((item: any) => {
      const isWire = item.itemCategory === 'wire';
      return [
        item.partNo || '',
        item.partName || '',
        categoryLabels[item.itemCategory] || item.itemCategory,
        item.qty,
        item.unit || '',
        item.unitPrice,
        item.amount,
        isWire ? (item.copperWeightPerUnit || 0) : 0,
        isWire ? (item.aluminumWeightPerUnit || 0) : 0,
        isWire ? (item.nonMetalCostPerUnit || 0) : 0,
      ] as (string | number | null)[];
    });
    
    // Add totals row
    const totalAmount = bom.reduce((s: number, b: any) => s + (b.amount || 0), 0);
    rows.push(['', '合计', '', '', '', '', totalAmount, '', '', '']);
    
    return [header, ...rows];
  }, [data]);

  if (!hydrationReady && !hydrationError) {
    return (
      <div style={{ padding: 100, textAlign: 'center' }}>
        <Spin size="large" tip="正在加载场景工作区..." />
      </div>
    );
  }

  if (hydrationError) {
    return (
      <div style={{ padding: 100 }}>
        <Empty description={hydrationError} />
        <Button onClick={() => navigate(id ? `/project/${id}` : '/')}>返回项目</Button>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: 100, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!data?.project || !data?.harness || !result || detailError) {
    return (
      <div style={{ padding: 100 }}>
        <Empty description={detailError || '未找到该线束或项目信息'} />
        <Button onClick={() => navigate(`/project/${id}/s/${sid}`)}>返回项目</Button>
      </div>
    );
  }

  const res = result;

  const handleCopy = async () => {
    if (!data?.harness) return;
    const original = data.harness;
    const newId = crypto.randomUUID();
    const newHarnessId = `${original.harnessId}-copy-${Date.now().toString(36)}`;
    const copied = {
      ...original,
      id: newId,
      harnessId: newHarnessId,
      harnessName: (original.harnessName || '') + ' (副本)',
      input: {
        ...original.input,
        harnessId: newHarnessId,
        harnessName: (original.input.harnessName || '') + ' (副本)',
      },
      updatedAt: new Date().toISOString()
    };
    await db.harnesses.add(copied);
    Toast.success('复制成功');
    navigate(`/project/${id}/s/${sid}/harness/${newHarnessId}`);
  };


  // 3. Chart Configuration
  const getWaterfallOption = () => {
    const material = res.materialCost;
    const waste = res.wasteCost;
    const labor = res.directLabor;
    const mfg = res.manufacturing;
    const mgmt = res.mgmtFee;
    const profit = res.profit;
    const exFactory = res.exFactoryPrice;
    const pack = res.packSubtotal;
    const freight = res.freightSubtotal;
    const delivered = res.deliveredPrice;

    // Build bars conditionally based on permissions
    type WfBar = { label: string; base: number; value: number };
    const bars: WfBar[] = [
      { label: '材料成本', base: 0, value: material },
      { label: '废品', base: material, value: waste },
      { label: '直接人工', base: material + waste, value: labor },
      { label: '制造费', base: material + waste + labor, value: mfg },
    ];
    if (can('mgmtFee')) {
      bars.push({ label: '管理费', base: material + waste + labor + mfg, value: mgmt });
    }
    if (can('profit')) {
      const mgmtOffset = can('mgmtFee') ? mgmt : 0;
      bars.push({ label: '利润', base: material + waste + labor + mfg + mgmtOffset, value: profit });
    }
    bars.push({ label: '出厂价', base: 0, value: exFactory });
    bars.push({ label: '包装费', base: exFactory, value: pack });
    bars.push({ label: '运输费', base: exFactory + pack, value: freight });
    bars.push({ label: '到厂价', base: 0, value: delivered });

    const categories = bars.map(b => b.label);
    const baseData = bars.map(b => b.base);
    const valueData = bars.map(b => b.value);

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          const tar = params[1];
          return `${tar.name}<br/>${tar.seriesName}: ¥${tar.value.toFixed(2)}`;
        }
      },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: {
        type: 'category',
        data: categories,
        axisLabel: { color: 'var(--text-secondary)', interval: 0 }
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: 'var(--text-secondary)' },
        splitLine: { lineStyle: { color: 'var(--border)', type: 'dashed' } }
      },
      series: [
        {
          name: 'Placeholder',
          type: 'bar',
          stack: 'Total',
          itemStyle: { borderColor: 'transparent', color: 'transparent' },
          emphasis: { itemStyle: { borderColor: 'transparent', color: 'transparent' } },
          data: baseData
        },
        {
          name: '金额',
          type: 'bar',
          stack: 'Total',
          label: {
            show: true,
            position: 'inside',
            formatter: (p: any) => p.value > 0 ? `¥${p.value.toFixed(1)}` : ''
          },
          data: valueData.map((v, i) => {
            // Colors for specific bars
            if (i === 6 || i === 9) return { value: v, itemStyle: { color: 'var(--semi-color-primary)' } };
            if (i === 0) return { value: v, itemStyle: { color: '#5470c6' } };
            return { value: v, itemStyle: { color: '#91cc75' } };
          })
        }
      ]
    };
  };

  // 4. Tables and Lists
  const materialTableColumns = [
    { title: '类型', dataIndex: 'type', key: 'type' },
    { title: '金额 (¥)', dataIndex: 'value', key: 'value', align: 'right' as const, render: (v: number) => v.toFixed(2) },
    { title: '占比 (%)', dataIndex: 'percent', key: 'percent', align: 'right' as const, render: (v: number) => `${(v * 100).toFixed(1)}%` },
  ];

  const materialTableData = [
    { type: '导线', value: res.materialBreakdown.byType.wire, percent: res.materialBreakdown.byType.wire / res.materialCost },
    { type: '连接器', value: res.materialBreakdown.byType.connector, percent: res.materialBreakdown.byType.connector / res.materialCost },
    { type: '端子', value: res.materialBreakdown.byType.terminal, percent: res.materialBreakdown.byType.terminal / res.materialCost },
    { type: '高压端子 (IPT)', value: res.materialBreakdown.byType.ipt_terminal, percent: res.materialBreakdown.byType.ipt_terminal / res.materialCost },
    { type: '支架/橡胶', value: res.materialBreakdown.byType.bracket_rubber, percent: res.materialBreakdown.byType.bracket_rubber / res.materialCost },
    { type: '胶带/套管', value: res.materialBreakdown.byType.tape_tube, percent: res.materialBreakdown.byType.tape_tube / res.materialCost },
    { type: '其他', value: res.materialBreakdown.byType.other, percent: res.materialBreakdown.byType.other / res.materialCost },
  ].filter(item => item.value > 0);

  const summaryCards = [
    { label: '材料成本', value: res.materialCost, color: 'var(--semi-color-text-0)' },
    { label: '直接人工', value: res.directLabor, color: 'var(--semi-color-text-0)' },
    { label: '制造费', value: res.manufacturing, color: 'var(--semi-color-text-0)' },
    ...(can('mgmtFee') ? [{ label: '管理费', value: res.mgmtFee, color: 'var(--semi-color-text-0)' }] : []),
    { label: '出厂价', value: res.exFactoryPrice, color: 'var(--warning)' },
    { label: '到厂价', value: res.deliveredPrice, color: 'var(--semi-color-primary)', highlight: true },
  ];

  return (
    <div style={{ padding: '0 0 40px 0' }}>
      <ScenarioSelector />
      {/* Section 1: Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button
            icon={<IconArrowLeft />}
            aria-label="返回"
            theme="borderless"
            onClick={() => navigate(`/project/${id}/s/${sid}`)}
          />
          <Title heading={4} style={{ color: 'var(--semi-color-text-0)', margin: 0 }}>
            线束详情: {res.harnessId} — {res.harnessName}
          </Title>
          <Tag color="blue" size="large" style={{ marginLeft: 8 }}>
            装车比: {(res.vehicleRatio * 100).toFixed(1)}%
          </Tag>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Button 
            icon={<IconEdit />} 
            onClick={() => navigate(`/project/${id}/s/${sid}/harness/${harnessId}/edit`)}
          >
            编辑
          </Button>
          <Button 
            icon={<IconCopy />} 
            onClick={handleCopy}
          >
            复制线束
          </Button>
          <Button theme="solid" type="primary" onClick={() => window.print()}>导出 PDF</Button>
          <RoleGuard field="deleteHarness">
            <Popconfirm
              title="确定删除此线束吗？"
              content="删除后不可恢复"
              onConfirm={async () => {
                if (data.harness) {
                  await db.harnesses.delete(data.harness.id!);
                  Toast.success('线束已删除');
                  navigate(`/project/${id}/s/${sid}`);
                }
              }}
            >
              <Button icon={<IconDelete />} type="danger" theme="borderless">删除线束</Button>
            </Popconfirm>
          </RoleGuard>
        </div>
      </div>

      <Content>
        <Card
          title="BOM 成本预览"
          headerStyle={{ borderBottom: '1px solid var(--border)' }}
          style={{ marginBottom: 24, backgroundColor: 'var(--semi-color-bg-1)' }}
        >
          <BomCostPreview harnessName={res.harnessName} result={res} />
        </Card>

        {/* Section 2: Cost Summary Cards */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          {summaryCards.map((card, idx) => (
            <Col span={4} key={idx}>
              <Card 
                bodyStyle={{ 
                  padding: '16px 20px', 
                  backgroundColor: 'var(--semi-color-bg-2)',
                  border: card.highlight ? '1px solid var(--semi-color-primary)' : '1px solid var(--border)',
                  borderRadius: 8
                }}
              >
                <Text style={{ color: 'var(--semi-color-text-2)', fontSize: 12 }}>{card.label}</Text>
                <div style={{ 
                  fontSize: 20, 
                  fontWeight: 600, 
                  color: card.color, 
                  marginTop: 4,
                  fontFamily: "'JetBrains Mono', 'Consolas', monospace"
                }}>
                  ¥{card.value.toFixed(2)}
                </div>
              </Card>
            </Col>
          ))}
        </Row>

        {/* Section 3: Cost Waterfall Chart */}
        <Card 
          title="成本构成瀑布图" 
          headerStyle={{ borderBottom: '1px solid var(--border)' }}
          style={{ marginBottom: 24, backgroundColor: 'var(--semi-color-bg-1)' }}
        >
          <ReactECharts
            echarts={echarts}
            option={getWaterfallOption()}
            style={{ height: 400 }}
            theme=""

          />
        </Card>

        {/* Section 4: Cost Breakdown Details */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col span={8}>
            <Card title="材料成本拆分" style={{ height: '100%', backgroundColor: 'var(--semi-color-bg-1)' }}>
              <Table 
                dataSource={materialTableData} 
                columns={materialTableColumns} 
                pagination={false} 
                size="small"
                style={{ marginBottom: 16 }}
              />
              <Descriptions
                size="small"
                row
                data={[
                  { key: '铜成本', value: `¥${res.materialBreakdown.cuCost.toFixed(2)}` },
                  { key: '铝成本', value: `¥${res.materialBreakdown.alCost.toFixed(2)}` },
                  { key: '非金属成本', value: `¥${res.materialBreakdown.nonMetalCost.toFixed(2)}` },
                  { key: '材料总计', value: `¥${res.materialCost.toFixed(2)}` },
                ]}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card title="包装费明细" style={{ height: '100%', backgroundColor: 'var(--semi-color-bg-1)' }}>
              <Descriptions
                column={1}
                data={[
                  { key: '内盒/内箱', value: `¥${res.packagingDetail.innerBoxCost.toFixed(2)}` },
                  { key: '外箱/纸箱', value: `¥${res.packagingDetail.outerBoxCost.toFixed(2)}` },
                  { key: '托盘/栈板', value: `¥${res.packagingDetail.palletCost.toFixed(2)}` },
                  { key: '隔板/隔片', value: `¥${res.packagingDetail.trayDividerCost.toFixed(2)}` },
                  { key: '气泡膜/缓冲', value: `¥${res.packagingDetail.bubbleWrapCost.toFixed(2)}` },
                  { key: '标签', value: `¥${res.packagingDetail.labelCost.toFixed(2)}` },
                  { key: '包装小计', value: `¥${res.packagingDetail.subtotal.toFixed(2)}` },
                ]}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card title="运输费明细" style={{ height: '100%', backgroundColor: 'var(--semi-color-bg-1)' }}>
              <Descriptions
                column={1}
                data={[
                  { key: '运费', value: `¥${res.freightDetail.freight.toFixed(2)}` },
                  { key: '超额运费', value: `¥${res.freightDetail.excessFreight.toFixed(2)}` },
                  { key: '短驳费', value: `¥${res.freightDetail.shortHaul.toFixed(2)}` },
                  { key: '三方仓', value: `¥${res.freightDetail.thirdPartyWarehouse.toFixed(2)}` },
                  { key: '仓储费', value: `¥${res.freightDetail.storage.toFixed(2)}` },
                  { key: '运输小计', value: `¥${res.freightDetail.subtotal.toFixed(2)}` },
                ]}
              />
            </Card>
          </Col>
        </Row>

        {/* Section 4.5: BOM 成本明细电子表格 */}
        {bomSheetData && (
          <Card
            title="BOM 成本明细 (电子表格视图)"
            headerStyle={{ borderBottom: '1px solid var(--border)' }}
            style={{ marginBottom: 24, backgroundColor: 'var(--semi-color-bg-1)' }}
          >
            <UniverSheet
              data={bomSheetData}
              readOnly={true}
              height={Math.min(400, 40 + bomSheetData.length * 28)}
              columnWidths={[120, 160, 100, 80, 60, 100, 100, 100, 100, 120]}
              freezeRows={1}
            />
          </Card>
        )}

        {/* Section 5: 核算参数 */}
        <Card title="核算参数" style={{ backgroundColor: 'var(--semi-color-bg-1)' }}>
          <Descriptions
            row
            data={[
              { key: '人工费率', value: `¥${res._params.laborRate.toFixed(2)} /h` },
              { key: '制造费率', value: `¥${res._params.mfgRate.toFixed(2)} /h` },
              { key: '废品率', value: `${(res._params.wasteRate * 100).toFixed(1)}%` },
              ...(can('mgmtRate') ? [{ key: '管理费率', value: `${(res._params.mgmtRate * 100).toFixed(1)}%` }] : []),
              ...(can('profitRate') ? [{ key: '利润率', value: `${(res._params.profitRate * 100).toFixed(2)}%` }] : []),
              { key: '加工工时', value: `${res.processHours.toFixed(4)} h` },
              { key: '铜用量', value: `${res.copperWeight.toFixed(4)} kg` },
              { key: '铝用量', value: `${res.aluminumWeight.toFixed(4)} kg` },
            ]}
          />
        </Card>
      </Content>
    </div>
  );
}
