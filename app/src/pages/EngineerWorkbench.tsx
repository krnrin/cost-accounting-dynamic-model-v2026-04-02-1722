/**
 * EngineerWorkbench - One-stop workstation for engineers
 * Integrates BOM editing, cost calculation, simulation, comparison, and settings
 *
 * Now connected to real Dexie data via route params (:id, :sid)
 * Dual engine: customer (computeHarnessCost) / internal (computeInternalHarnessCost)
 */
import { useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Layout,
  Nav,
  Typography,
  Button,
  Tabs,
  TabPane,
  Toast,
  Space,
  Tag,
  Table,
  Spin,
  Empty,
  Card,
} from '@douyinfe/semi-ui';
import {
  IconCode,
  IconSetting,
  IconLayers,
  IconEdit,
  IconSearch,
  IconExternalOpen,
} from '@douyinfe/semi-icons';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db';
import {
  computeHarnessCost,
  computeProjectFromHarnesses,
  computeInternalHarnessCost,
  computeInternalProjectFromHarnesses,
  INTERNAL_DEFAULTS,
} from '@/engine/harness_costing';
import EngineSelector, { type EngineType } from '@/components/EngineSelector';
import HarnessCompareView from '@/components/HarnessCompareView';
import ChangeOrderWizard from '@/components/ChangeOrderWizard';
import ScenarioSelector from '@/components/ScenarioSelector';
import { useHarnessSync } from '@/hooks/useHarnessSync';
import type { HarnessResult, InternalHarnessResult } from '@/types/harness';
import type { ChangeOrder } from '@/engine/change_verification';
import type { CSSProperties } from 'react';

const { Title, Text } = Typography;
const { Sider, Content } = Layout;

const S: Record<string, CSSProperties> = {
  layout: { height: '100%', minHeight: 'calc(100vh - 60px)' },
  sider: { width: 220, background: 'var(--semi-color-bg-0)', borderRight: '1px solid var(--semi-color-border)' },
  nav: { height: '100%' },
  content: { padding: 24, overflow: 'auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  tabContent: { padding: 16 },
  toolbar: { marginTop: 16, display: 'flex', gap: 8 },
  placeholder: { marginTop: 24, padding: 48, background: 'var(--semi-color-fill-0)', textAlign: 'center' as const, borderRadius: 8 },
  sectionTitle: { marginTop: 24 },
  tag: { margin: 4 },
  kpiRow: { display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' as const },
  kpiCard: { flex: '1 1 140px', minWidth: 140 },
  fullWidth: { width: '100%' },
  loading: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 },
  tableMarginTop: { marginTop: 16 },
  cardMarginTop: { marginTop: 16 },
};

const navFooterConfig = { collapseButton: true };

function formatCurrency(val: number | undefined): string {
  if (val === undefined || val === null) return '-';
  return `¥${val.toFixed(2)}`;
}

export default function EngineerWorkbench() {
  const { id, sid } = useParams<{ id: string; sid: string }>();
  const navigate = useNavigate();
  const [engine, setEngine] = useState<EngineType>('customer');
  const [activeTab, setActiveTab] = useState('bom');
  const [changeOrderVisible, setChangeOrderVisible] = useState(false);
  const [changeOrders, setChangeOrders] = useState<ChangeOrder[]>([]);

  // Auto-sync harness results on mount
  useHarnessSync(sid);

  // Load real data from Dexie
  const data = useLiveQuery(async () => {
    if (!id) return null;
    const project = await db.projects.get(id);
    if (!project) return null;
    const scenario = sid ? await db.scenarios.get(sid) : null;
    const allHarnesses = await db.harnesses.where('projectId').equals(id).toArray();
    const harnesses = sid
      ? allHarnesses.filter(h => h.scenarioId === sid || h.scenarioId === '')
      : allHarnesses;
    harnesses.sort((a, b) => a.harnessId.localeCompare(b.harnessId));
    return { project, scenario, harnesses };
  }, [id, sid]);

  // ── Customer engine results ──
  const customerResults = useMemo(() => {
    if (!data?.scenario || !data.harnesses.length) return [];
    const config = data.scenario.config;
    if (!config?.costRates || !config?.metalPrices) return [];
    return data.harnesses
      .map(h => {
        try {
          return computeHarnessCost(h.input, config.costRates, config.metalPrices);
        } catch {
          return null;
        }
      })
      .filter((r): r is HarnessResult => r !== null);
  }, [data?.scenario, data?.harnesses]);

  // ── Internal engine results ──
  const internalResults = useMemo(() => {
    if (!data?.scenario || !data.harnesses.length) return [];
    const config = data.scenario.config;
    if (!config?.metalPrices) return [];
    const internalRates = config.internalRates || INTERNAL_DEFAULTS;
    return data.harnesses
      .map(h => {
        try {
          return computeInternalHarnessCost(h.input, internalRates, config.metalPrices);
        } catch {
          return null;
        }
      })
      .filter((r): r is InternalHarnessResult => r !== null);
  }, [data?.scenario, data?.harnesses]);

  // ── Active results based on engine selection ──
  const isInternal = engine === 'internal';

  const customerSummary = useMemo(() => {
    if (customerResults.length === 0) return null;
    return computeProjectFromHarnesses(customerResults);
  }, [customerResults]);

  const internalSummary = useMemo(() => {
    if (internalResults.length === 0) return null;
    return computeInternalProjectFromHarnesses(internalResults);
  }, [internalResults]);

  // Build harness list for CompareView (customer engine only — compare view uses HarnessResult)
  const compareHarnesses = useMemo(() => {
    return customerResults.map(r => ({
      harnessId: r.harnessId,
      harnessName: r.harnessName || r.harnessId,
      result: r,
    }));
  }, [customerResults]);

  const handleChangeOrderSubmit = useCallback((order: ChangeOrder) => {
    setChangeOrders(prev => [...prev, order]);
    Toast.success(`设变单 ${order.changeNo} 已创建`);
  }, []);

  if (!data) {
    return (
      <div style={S.loading}>
        <Spin size="large" tip="正在加载工作台数据..." />
      </div>
    );
  }

  const { project, scenario, harnesses } = data;

  // ── Customer cost table columns ──
  const customerCostColumns = [
    { title: '零件号', dataIndex: 'harnessId', width: 140 },
    { title: '名称', dataIndex: 'harnessName', width: 160 },
    { title: '材料成本', render: (_: unknown, r: HarnessResult) => formatCurrency(r.materialCost), width: 100 },
    { title: '人工', render: (_: unknown, r: HarnessResult) => formatCurrency(r.directLabor), width: 90 },
    { title: '制造费', render: (_: unknown, r: HarnessResult) => formatCurrency(r.manufacturing), width: 90 },
    { title: '出厂价', render: (_: unknown, r: HarnessResult) => formatCurrency(r.exFactoryPrice), width: 100 },
    { title: '到厂价', render: (_: unknown, r: HarnessResult) => formatCurrency(r.deliveredPrice), width: 100 },
  ];

  // ── Internal cost table columns (6D MOH) ──
  const internalCostColumns = [
    { title: '零件号', dataIndex: 'harnessId', width: 130 },
    { title: '名称', dataIndex: 'harnessName', width: 140 },
    { title: '材料', render: (_: unknown, r: InternalHarnessResult) => formatCurrency(r.materialCost), width: 90 },
    { title: '直接人工', render: (_: unknown, r: InternalHarnessResult) => formatCurrency(r.directLabor), width: 90 },
    { title: '间接人工', render: (_: unknown, r: InternalHarnessResult) => formatCurrency(r.indirectLabor), width: 90 },
    { title: '厂房分摊', render: (_: unknown, r: InternalHarnessResult) => formatCurrency(r.factoryAmortization), width: 90 },
    { title: '制造费小计', render: (_: unknown, r: InternalHarnessResult) => formatCurrency(r.mfgOverheadTotal), width: 100 },
    { title: '实绩总成本', render: (_: unknown, r: InternalHarnessResult) => formatCurrency(r.internalCost), width: 110 },
    { title: '状态', dataIndex: 'gapStatus', width: 90 },
  ];

  return (
    <Layout style={S.layout}>
      <ScenarioSelector />
      <Sider style={S.sider}>
        <Nav
          style={S.nav}
          items={[
            { itemKey: 'bom', text: 'BOM编辑', icon: <IconEdit /> },
            { itemKey: 'calc', text: '成本计算', icon: <IconCode /> },
            { itemKey: 'sim', text: '仿真分层', icon: <IconLayers /> },
            { itemKey: 'compare', text: '线束对比', icon: <IconSearch /> },
            { itemKey: 'settings', text: '参数设置', icon: <IconSetting /> },
          ]}
          selectedKeys={[activeTab]}
          onSelect={({ itemKey }) => setActiveTab(itemKey as string)}
          footer={navFooterConfig}
        />
      </Sider>

      <Content style={S.content}>
        <div style={S.header}>
          <div>
            <Title heading={3}>
              {String.fromCodePoint(0x1F527)} 工程师工作台
            </Title>
            <Text type="tertiary">
              {project.meta.projectName || project.meta.projectCode}
              {scenario ? ` / ${scenario.scenarioName}` : ''}
            </Text>
          </div>
          <Space>
            <EngineSelector value={engine} onChange={setEngine} />
            <Tag color={isInternal ? 'blue' : 'green'} size="large">
              {isInternal ? '内部实绩' : '客户报价'}
            </Tag>
          </Space>
        </div>

        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          {/* BOM Tab */}
          <TabPane tab="BOM编辑" itemKey="bom">
            <div style={S.tabContent}>
              <Title heading={5}>BOM 数据编辑</Title>
              <Text type="tertiary">
                当前场景共 {harnesses.length} 条线束，点击下方按钮进入全功能 BOM 工作簿
              </Text>
              <div style={S.toolbar}>
                <Space>
                  <Button
                    type="primary"
                    theme="solid"
                    icon={<IconExternalOpen />}
                    onClick={() => navigate(sid ? `/project/${id}/s/${sid}/bom-workbook` : `/project/${id}/bom-workbook`)}
                  >
                    打开 BOM 工作簿
                  </Button>
                  <Button type="warning" onClick={() => setChangeOrderVisible(true)}>
                    {String.fromCodePoint(0x1F527)} 创建设变单
                  </Button>
                </Space>
              </div>
              {harnesses.length === 0 ? (
                <div style={S.placeholder}>
                  <Empty
                    title="暂无线束数据"
                    description="请先创建线束并填写 BOM"
                  />
                </div>
              ) : (
                <Table
                  dataSource={harnesses}
                  columns={[
                    { title: '零件号', dataIndex: 'harnessId', width: 140 },
                    { title: '名称', dataIndex: 'harnessName', width: 180 },
                    { title: 'BOM项数', render: (_: unknown, h: { input: { bom: unknown[] } }) => h.input?.bom?.length || 0, width: 90 },
                    { title: '装车比', render: (_: unknown, h: { input: { vehicleRatio: number } }) => `${((h.input?.vehicleRatio || 0) * 100).toFixed(1)}%`, width: 80 },
                    {
                      title: '操作',
                      width: 120,
                      render: (_: unknown, h: { harnessId: string }) => (
                        <Button
                          size="small"
                          theme="light"
                          onClick={() => navigate(
                            sid
                              ? `/project/${id}/s/${sid}/harness/${h.harnessId}/edit`
                              : `/project/${id}/harness/${h.harnessId}/edit`
                          )}
                        >
                          编辑
                        </Button>
                      ),
                    },
                  ]}
                  pagination={false}
                  size="small"
                  style={S.tableMarginTop}
                />
              )}
            </div>
          </TabPane>

          {/* Cost Calc Tab */}
          <TabPane tab="成本计算" itemKey="calc">
            <div style={S.tabContent}>
              <Title heading={5}>成本计算结果</Title>
              {!scenario ? (
                <Text type="warning">未选择场景，无法计算成本</Text>
              ) : isInternal ? (
                /* ── Internal engine view ── */
                internalResults.length === 0 ? (
                  <Empty title="无计算结果" description="请先填写线束 BOM 数据" />
                ) : (
                  <>
                    {internalSummary && (
                      <div style={S.kpiRow}>
                        <Card style={S.kpiCard} title="单车内部成本" headerLine={false}>
                          <Title heading={3}>{formatCurrency(internalSummary.vehicleCost)}</Title>
                        </Card>
                        <Card style={S.kpiCard} title="单车材料" headerLine={false}>
                          <Title heading={3}>{formatCurrency(internalSummary.weightedMaterial)}</Title>
                        </Card>
                        <Card style={S.kpiCard} title="单车直接人工" headerLine={false}>
                          <Title heading={3}>{formatCurrency(internalSummary.weightedDirectLabor)}</Title>
                        </Card>
                        <Card style={S.kpiCard} title="单车制造费" headerLine={false}>
                          <Title heading={3}>{formatCurrency(internalSummary.weightedMfgOverheadTotal)}</Title>
                        </Card>
                        <Card style={S.kpiCard} title="线束数" headerLine={false}>
                          <Title heading={3}>{internalResults.length}</Title>
                        </Card>
                      </div>
                    )}
                    <Table
                      dataSource={internalResults}
                      columns={internalCostColumns}
                      pagination={false}
                      size="small"
                      rowKey="harnessId"
                    />
                  </>
                )
              ) : (
                /* ── Customer engine view ── */
                customerResults.length === 0 ? (
                  <Empty title="无计算结果" description="请先填写线束 BOM 数据" />
                ) : (
                  <>
                    {customerSummary && (
                      <div style={S.kpiRow}>
                        <Card style={S.kpiCard} title="单车成本" headerLine={false}>
                          <Title heading={3}>{formatCurrency(customerSummary.vehicleCost)}</Title>
                        </Card>
                        <Card style={S.kpiCard} title="单车材料" headerLine={false}>
                          <Title heading={3}>{formatCurrency(customerSummary.weightedMaterial)}</Title>
                        </Card>
                        <Card style={S.kpiCard} title="单车人工" headerLine={false}>
                          <Title heading={3}>{formatCurrency(customerSummary.weightedLabor)}</Title>
                        </Card>
                        <Card style={S.kpiCard} title="线束数" headerLine={false}>
                          <Title heading={3}>{customerResults.length}</Title>
                        </Card>
                      </div>
                    )}
                    <Table
                      dataSource={customerResults}
                      columns={customerCostColumns}
                      pagination={false}
                      size="small"
                      rowKey="harnessId"
                    />
                  </>
                )
              )}
            </div>
          </TabPane>

          {/* Simulation Tab */}
          <TabPane tab="仿真分层" itemKey="sim">
            <div style={S.tabContent}>
              <Title heading={5}>仿真分层</Title>
              <Text type="tertiary">叠加多维度仿真层，分析成本敏感性</Text>
              <div style={S.toolbar}>
                <Button
                  type="primary"
                  theme="solid"
                  icon={<IconExternalOpen />}
                  onClick={() => sid && navigate(`/project/${id}/s/${sid}/simulation`)}
                  disabled={!sid}
                >
                  打开仿真页面
                </Button>
              </div>
              {!sid && (
                <div style={S.placeholder}>
                  <Text type="tertiary">请先选择场景</Text>
                </div>
              )}
            </div>
          </TabPane>

          {/* Compare Tab */}
          <TabPane tab="线束对比" itemKey="compare">
            {compareHarnesses.length > 0 ? (
              <HarnessCompareView harnesses={compareHarnesses} />
            ) : (
              <div style={S.tabContent}>
                <Empty title="无可对比的线束" description="请先填写 BOM 并计算成本" />
              </div>
            )}
          </TabPane>

          {/* Settings Tab */}
          <TabPane tab="参数设置" itemKey="settings">
            <div style={S.tabContent}>
              <Title heading={5}>参数设置</Title>
              <Text type="tertiary">费率、金属价格、年降参数配置</Text>
              <div style={S.toolbar}>
                <Button
                  theme="solid"
                  icon={<IconExternalOpen />}
                  onClick={() => navigate('/settings')}
                >
                  打开设置页
                </Button>
              </div>
              {scenario && (
                <Card style={S.cardMarginTop} title="当前场景配置摘要" headerLine={false}>
                  <Text>场景: {scenario.scenarioName}</Text>
                  <br />
                  <Text type="tertiary">场景类型: {scenario.scenarioType}</Text>
                </Card>
              )}
            </div>
          </TabPane>
        </Tabs>

        <ChangeOrderWizard
          visible={changeOrderVisible}
          onClose={() => setChangeOrderVisible(false)}
          onSubmit={handleChangeOrderSubmit}
          availableParts={[]}
        />

        {changeOrders.length > 0 && (
          <div style={S.sectionTitle}>
            <Title heading={5}>
              {String.fromCodePoint(0x1F4CB)} 设变单记录 ({changeOrders.length})
            </Title>
            {changeOrders.map(co => (
              <Tag key={co.id} color="orange" style={S.tag}>
                {co.changeNo}: {co.reason || co.type}
              </Tag>
            ))}
          </div>
        )}
      </Content>
    </Layout>
  );
}
