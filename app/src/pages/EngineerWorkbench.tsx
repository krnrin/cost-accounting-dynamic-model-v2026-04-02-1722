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
  return `\u00A5${val.toFixed(2)}`;
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
    Toast.success(`\u8BBE\u53D8\u5355 ${order.changeNo} \u5DF2\u521B\u5EFA`);
  }, []);

  if (!data) {
    return (
      <div style={S.loading}>
        <Spin size="large" tip="\u6B63\u5728\u52A0\u8F7D\u5DE5\u4F5C\u53F0\u6570\u636E..." />
      </div>
    );
  }

  const { project, scenario, harnesses } = data;

  // ── Customer cost table columns ──
  const customerCostColumns = [
    { title: '\u96F6\u4EF6\u53F7', dataIndex: 'harnessId', width: 140 },
    { title: '\u540D\u79F0', dataIndex: 'harnessName', width: 160 },
    { title: '\u6750\u6599\u6210\u672C', render: (_: unknown, r: HarnessResult) => formatCurrency(r.materialCost), width: 100 },
    { title: '\u4EBA\u5DE5', render: (_: unknown, r: HarnessResult) => formatCurrency(r.directLabor), width: 90 },
    { title: '\u5236\u9020\u8D39', render: (_: unknown, r: HarnessResult) => formatCurrency(r.manufacturing), width: 90 },
    { title: '\u51FA\u5382\u4EF7', render: (_: unknown, r: HarnessResult) => formatCurrency(r.exFactoryPrice), width: 100 },
    { title: '\u5230\u5382\u4EF7', render: (_: unknown, r: HarnessResult) => formatCurrency(r.deliveredPrice), width: 100 },
  ];

  // ── Internal cost table columns (6D MOH) ──
  const internalCostColumns = [
    { title: '\u96F6\u4EF6\u53F7', dataIndex: 'harnessId', width: 130 },
    { title: '\u540D\u79F0', dataIndex: 'harnessName', width: 140 },
    { title: '\u6750\u6599', render: (_: unknown, r: InternalHarnessResult) => formatCurrency(r.materialCost), width: 90 },
    { title: '\u76F4\u63A5\u4EBA\u5DE5', render: (_: unknown, r: InternalHarnessResult) => formatCurrency(r.directLabor), width: 90 },
    { title: '\u95F4\u63A5\u4EBA\u5DE5', render: (_: unknown, r: InternalHarnessResult) => formatCurrency(r.indirectLabor), width: 90 },
    { title: '\u5382\u623F\u5206\u644A', render: (_: unknown, r: InternalHarnessResult) => formatCurrency(r.factoryAmortization), width: 90 },
    { title: '\u5236\u9020\u8D39\u5C0F\u8BA1', render: (_: unknown, r: InternalHarnessResult) => formatCurrency(r.mfgOverheadTotal), width: 100 },
    { title: '\u5B9E\u7EE9\u603B\u6210\u672C', render: (_: unknown, r: InternalHarnessResult) => formatCurrency(r.internalCost), width: 110 },
    { title: '\u72B6\u6001', dataIndex: 'gapStatus', width: 90 },
  ];

  return (
    <Layout style={S.layout}>
      <ScenarioSelector />
      <Sider style={S.sider}>
        <Nav
          style={S.nav}
          items={[
            { itemKey: 'bom', text: 'BOM\u7F16\u8F91', icon: <IconEdit /> },
            { itemKey: 'calc', text: '\u6210\u672C\u8BA1\u7B97', icon: <IconCode /> },
            { itemKey: 'sim', text: '\u4EFF\u771F\u5206\u5C42', icon: <IconLayers /> },
            { itemKey: 'compare', text: '\u7EBF\u675F\u5BF9\u6BD4', icon: <IconSearch /> },
            { itemKey: 'settings', text: '\u53C2\u6570\u8BBE\u7F6E', icon: <IconSetting /> },
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
              {String.fromCodePoint(0x1F527)} \u5DE5\u7A0B\u5E08\u5DE5\u4F5C\u53F0
            </Title>
            <Text type="tertiary">
              {project.meta.projectName || project.meta.projectCode}
              {scenario ? ` / ${scenario.scenarioName}` : ''}
            </Text>
          </div>
          <Space>
            <EngineSelector value={engine} onChange={setEngine} />
            <Tag color={isInternal ? 'blue' : 'green'} size="large">
              {isInternal ? '\u5185\u90E8\u5B9E\u7EE9' : '\u5BA2\u6237\u62A5\u4EF7'}
            </Tag>
          </Space>
        </div>

        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          {/* BOM Tab */}
          <TabPane tab="BOM\u7F16\u8F91" itemKey="bom">
            <div style={S.tabContent}>
              <Title heading={5}>BOM \u6570\u636E\u7F16\u8F91</Title>
              <Text type="tertiary">
                \u5F53\u524D\u573A\u666F\u5171 {harnesses.length} \u6761\u7EBF\u675F\uFF0C\u70B9\u51FB\u4E0B\u65B9\u6309\u94AE\u8FDB\u5165\u5168\u529F\u80FD BOM \u5DE5\u4F5C\u7C3F
              </Text>
              <div style={S.toolbar}>
                <Space>
                  <Button
                    type="primary"
                    theme="solid"
                    icon={<IconExternalOpen />}
                    onClick={() => navigate(sid ? `/project/${id}/s/${sid}/bom-workbook` : `/project/${id}/bom-workbook`)}
                  >
                    \u6253\u5F00 BOM \u5DE5\u4F5C\u7C3F
                  </Button>
                  <Button type="warning" onClick={() => setChangeOrderVisible(true)}>
                    {String.fromCodePoint(0x1F527)} \u521B\u5EFA\u8BBE\u53D8\u5355
                  </Button>
                </Space>
              </div>
              {harnesses.length === 0 ? (
                <div style={S.placeholder}>
                  <Empty
                    title="\u6682\u65E0\u7EBF\u675F\u6570\u636E"
                    description="\u8BF7\u5148\u521B\u5EFA\u7EBF\u675F\u5E76\u586B\u5199 BOM"
                  />
                </div>
              ) : (
                <Table
                  dataSource={harnesses}
                  columns={[
                    { title: '\u96F6\u4EF6\u53F7', dataIndex: 'harnessId', width: 140 },
                    { title: '\u540D\u79F0', dataIndex: 'harnessName', width: 180 },
                    { title: 'BOM\u9879\u6570', render: (_: unknown, h: { input: { bom: unknown[] } }) => h.input?.bom?.length || 0, width: 90 },
                    { title: '\u88C5\u8F66\u6BD4', render: (_: unknown, h: { input: { vehicleRatio: number } }) => `${((h.input?.vehicleRatio || 0) * 100).toFixed(1)}%`, width: 80 },
                    {
                      title: '\u64CD\u4F5C',
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
                          \u7F16\u8F91
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
          <TabPane tab="\u6210\u672C\u8BA1\u7B97" itemKey="calc">
            <div style={S.tabContent}>
              <Title heading={5}>\u6210\u672C\u8BA1\u7B97\u7ED3\u679C</Title>
              {!scenario ? (
                <Text type="warning">\u672A\u9009\u62E9\u573A\u666F\uFF0C\u65E0\u6CD5\u8BA1\u7B97\u6210\u672C</Text>
              ) : isInternal ? (
                /* ── Internal engine view ── */
                internalResults.length === 0 ? (
                  <Empty title="\u65E0\u8BA1\u7B97\u7ED3\u679C" description="\u8BF7\u5148\u586B\u5199\u7EBF\u675F BOM \u6570\u636E" />
                ) : (
                  <>
                    {internalSummary && (
                      <div style={S.kpiRow}>
                        <Card style={S.kpiCard} title="\u5355\u8F66\u5185\u90E8\u6210\u672C" headerLine={false}>
                          <Title heading={3}>{formatCurrency(internalSummary.vehicleCost)}</Title>
                        </Card>
                        <Card style={S.kpiCard} title="\u5355\u8F66\u6750\u6599" headerLine={false}>
                          <Title heading={3}>{formatCurrency(internalSummary.weightedMaterial)}</Title>
                        </Card>
                        <Card style={S.kpiCard} title="\u5355\u8F66\u76F4\u63A5\u4EBA\u5DE5" headerLine={false}>
                          <Title heading={3}>{formatCurrency(internalSummary.weightedDirectLabor)}</Title>
                        </Card>
                        <Card style={S.kpiCard} title="\u5355\u8F66\u5236\u9020\u8D39" headerLine={false}>
                          <Title heading={3}>{formatCurrency(internalSummary.weightedMfgOverheadTotal)}</Title>
                        </Card>
                        <Card style={S.kpiCard} title="\u7EBF\u675F\u6570" headerLine={false}>
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
                  <Empty title="\u65E0\u8BA1\u7B97\u7ED3\u679C" description="\u8BF7\u5148\u586B\u5199\u7EBF\u675F BOM \u6570\u636E" />
                ) : (
                  <>
                    {customerSummary && (
                      <div style={S.kpiRow}>
                        <Card style={S.kpiCard} title="\u5355\u8F66\u6210\u672C" headerLine={false}>
                          <Title heading={3}>{formatCurrency(customerSummary.vehicleCost)}</Title>
                        </Card>
                        <Card style={S.kpiCard} title="\u5355\u8F66\u6750\u6599" headerLine={false}>
                          <Title heading={3}>{formatCurrency(customerSummary.weightedMaterial)}</Title>
                        </Card>
                        <Card style={S.kpiCard} title="\u5355\u8F66\u4EBA\u5DE5" headerLine={false}>
                          <Title heading={3}>{formatCurrency(customerSummary.weightedLabor)}</Title>
                        </Card>
                        <Card style={S.kpiCard} title="\u7EBF\u675F\u6570" headerLine={false}>
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
          <TabPane tab="\u4EFF\u771F\u5206\u5C42" itemKey="sim">
            <div style={S.tabContent}>
              <Title heading={5}>\u4EFF\u771F\u5206\u5C42</Title>
              <Text type="tertiary">\u53E0\u52A0\u591A\u7EF4\u5EA6\u4EFF\u771F\u5C42\uFF0C\u5206\u6790\u6210\u672C\u654F\u611F\u6027</Text>
              <div style={S.toolbar}>
                <Button
                  type="primary"
                  theme="solid"
                  icon={<IconExternalOpen />}
                  onClick={() => sid && navigate(`/project/${id}/s/${sid}/simulation`)}
                  disabled={!sid}
                >
                  \u6253\u5F00\u4EFF\u771F\u9875\u9762
                </Button>
              </div>
              {!sid && (
                <div style={S.placeholder}>
                  <Text type="tertiary">\u8BF7\u5148\u9009\u62E9\u573A\u666F</Text>
                </div>
              )}
            </div>
          </TabPane>

          {/* Compare Tab */}
          <TabPane tab="\u7EBF\u675F\u5BF9\u6BD4" itemKey="compare">
            {compareHarnesses.length > 0 ? (
              <HarnessCompareView harnesses={compareHarnesses} />
            ) : (
              <div style={S.tabContent}>
                <Empty title="\u65E0\u53EF\u5BF9\u6BD4\u7684\u7EBF\u675F" description="\u8BF7\u5148\u586B\u5199 BOM \u5E76\u8BA1\u7B97\u6210\u672C" />
              </div>
            )}
          </TabPane>

          {/* Settings Tab */}
          <TabPane tab="\u53C2\u6570\u8BBE\u7F6E" itemKey="settings">
            <div style={S.tabContent}>
              <Title heading={5}>\u53C2\u6570\u8BBE\u7F6E</Title>
              <Text type="tertiary">\u8D39\u7387\u3001\u91D1\u5C5E\u4EF7\u683C\u3001\u5E74\u964D\u53C2\u6570\u914D\u7F6E</Text>
              <div style={S.toolbar}>
                <Button
                  theme="solid"
                  icon={<IconExternalOpen />}
                  onClick={() => navigate('/settings')}
                >
                  \u6253\u5F00\u8BBE\u7F6E\u9875
                </Button>
              </div>
              {scenario && (
                <Card style={S.cardMarginTop} title="\u5F53\u524D\u573A\u666F\u914D\u7F6E\u6458\u8981" headerLine={false}>
                  <Text>\u573A\u666F: {scenario.scenarioName}</Text>
                  <br />
                  <Text type="tertiary">\u573A\u666F\u7C7B\u578B: {scenario.scenarioType}</Text>
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
              {String.fromCodePoint(0x1F4CB)} \u8BBE\u53D8\u5355\u8BB0\u5F55 ({changeOrders.length})
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
