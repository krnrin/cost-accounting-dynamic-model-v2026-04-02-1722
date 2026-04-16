import { useEffect, useMemo, useState } from 'react';
import {
  Typography, Button, Toast, InputNumber, Switch, Card, RadioGroup, Radio,
  Row, Col, Select, Table, Input, Tag, Tabs, TabPane, Spin,
} from '@douyinfe/semi-ui';
import { IconPlus, IconDelete, IconRefresh } from '@douyinfe/semi-icons';
import { useSettingsStore } from '@/store/settingsStore';
import { db } from '@/data/db';
import type {
  CostItemDef, CostItemCalcMethod, FactoryConfig,
  AllocationDriver, AllocationConfig, BomClassificationRule, ProjectFactoryId,
} from '@/types/project';
import type { Level1Coefficients } from '@/types';
import type { InternalCostRates } from '@/types/project';
import { REFERENCE_FACTORIES } from '@/engine/factory_comparison';
import { DEFAULT_CLASSIFICATION_RULES, DEFAULT_COST_STRUCTURE, getSelectedFactoryId } from '@/engine/harness_costing';
import { RoleGuard } from '@/components/RoleGuard';
import {
  fetchSettingsCategory,
  fetchSettingsHistory,
  fetchSettingsSnapshot,
  publishSettings,
  updateSetting,
  type SettingRow,
  type SettingsPublishResult,
  type SettingsSnapshotRow,
} from '@/lib/settingsApi';

const { Title, Text } = Typography;

const SETTINGS_CATEGORY_MAP = {
  costStructure: 'cost_structure',
  alertThreshold: 'alert_threshold',
  factories: 'factories',
  allocation: 'allocation_config',
  coefficients: 'level1_coefficients',
  bomRules: 'bom_classification',
} as const;

const CALC_METHOD_OPTIONS: { value: CostItemCalcMethod; label: string }[] = [
  { value: 'bom_sum', label: 'BOM汇总' },
  { value: 'rate_x_hours', label: '费率x工时' },
  { value: 'rate_x_base', label: '费率x基数' },
  { value: 'direct', label: '直接输入' },
  { value: 'fixed_per_unit', label: '固定单件费' },
  { value: 'custom_formula', label: '自定义公式' },
];

const ALLOCATION_DRIVER_OPTIONS: { value: AllocationDriver; label: string }[] = [
  { value: 'hours', label: '工时占比' },
  { value: 'revenue', label: '收入占比' },
  { value: 'material_cost', label: '材料成本占比' },
  { value: 'volume', label: '产量占比' },
  { value: 'direct', label: '直接归属' },
  { value: 'equal', label: '平均分摊' },
];

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  wire: { label: '线缆', color: 'blue' },
  connector: { label: '连接器', color: 'green' },
  terminal: { label: '端子', color: 'orange' },
  ipt_terminal: { label: 'IPT端子', color: 'purple' },
  bracket_rubber: { label: '支架/橡胶件', color: 'cyan' },
  tape_tube: { label: '胶带/波纹管', color: 'teal' },
  other: { label: '其他', color: 'grey' },
};

function rowsToRecord(rows: Array<{ key: string; value: any }>) {
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

function safeNumber(value: any, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function formatDateTime(value?: string | Date | null) {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('zh-CN', { hour12: false });
}

function previewSnapshotValue(value: unknown) {
  if (value == null) return '-';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return `${value.length} 项`;
  if (typeof value === 'object') return `${Object.keys(value as Record<string, unknown>).length} 个字段`;
  return String(value);
}

function useSettingsSync() {
  const store = useSettingsStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [history, setHistory] = useState<SettingRow<SettingsPublishResult>[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [snapshotRows, setSnapshotRows] = useState<SettingsSnapshotRow[]>([]);

  const reloadSettings = async () => {
    const [costRows, alertRows, factoryRows, allocationRows, coefficientRows, bomRows] = await Promise.all([
      fetchSettingsCategory(SETTINGS_CATEGORY_MAP.costStructure),
      fetchSettingsCategory(SETTINGS_CATEGORY_MAP.alertThreshold),
      fetchSettingsCategory(SETTINGS_CATEGORY_MAP.factories),
      fetchSettingsCategory(SETTINGS_CATEGORY_MAP.allocation),
      fetchSettingsCategory(SETTINGS_CATEGORY_MAP.coefficients),
      fetchSettingsCategory(SETTINGS_CATEGORY_MAP.bomRules),
    ]);

    const cost = rowsToRecord(costRows);
    const alert = rowsToRecord(alertRows);
    const factories = rowsToRecord(factoryRows);
    const allocation = rowsToRecord(allocationRows);
    const coefficients = rowsToRecord(coefficientRows);
    const bom = rowsToRecord(bomRows);

    store.updateCostRates({
      laborRate: safeNumber(cost.defaultCostRates?.laborRate, 35),
      mfgRate: safeNumber(cost.defaultCostRates?.mfgRate, 46.69),
      wasteRate: safeNumber(cost.defaultCostRates?.wasteRate, 0.01),
      mgmtRate: safeNumber(cost.defaultCostRates?.mgmtRate, 0.06),
      profitRate: safeNumber(cost.defaultCostRates?.profitRate, 0.056627),
    });
    store.updateMetalPrices({
      copper: safeNumber(cost.defaultMetalPrices?.copper, 72800),
      aluminum: safeNumber(cost.defaultMetalPrices?.aluminum, 20500),
    });
    store.setDefaultTemplateType((cost.defaultTemplateType ?? 'geely') as any);
    store.setDefaultAnnualDropRate(safeNumber(cost.defaultAnnualDropRate, 0.03));
    store.setCostStructure(cost.schema?.items ? cost.schema : DEFAULT_COST_STRUCTURE);
    store.setUseSchemaEngine(Boolean(cost.useSchemaEngine));
    store.updateAlertThresholds({
      copperPercent: safeNumber(alert.copperPercent, 5),
      aluminumPercent: safeNumber(alert.aluminumPercent, 5),
      enabled: alert.enabled !== false,
    });
    store.setFactories(Array.isArray(factories.list) ? factories.list : []);
    store.setSelectedFactory(getSelectedFactoryId(factories.selectedFactory));
    store.setInternalFactoryRates(factories.internalFactoryRates ?? {});
    store.setAllocationConfig({
      equipment: allocation.drivers?.equipment ?? 'hours',
      rnd: allocation.drivers?.rnd ?? 'revenue',
      indirectLabor: allocation.drivers?.indirectLabor ?? 'hours',
      management: allocation.drivers?.management ?? 'direct',
    });
    store.setLevel1Coefficients({
      materialRatio: safeNumber(coefficients.default?.materialRatio, 0.65),
      laborRatio: safeNumber(coefficients.default?.laborRatio, 0.09),
      mfgRatio: safeNumber(coefficients.default?.mfgRatio, 0.12),
      packagingRatio: safeNumber(coefficients.default?.packagingRatio, 0.024),
      freightRatio: safeNumber(coefficients.default?.freightRatio, 0.006),
    });
    store.setBomClassificationRules(Array.isArray(bom.rules) ? bom.rules : DEFAULT_CLASSIFICATION_RULES);
  };

  const reloadHistory = async (versionToOpen?: string | null) => {
    setHistoryLoading(true);
    try {
      const rows = await fetchSettingsHistory();
      setHistory(rows);
      const nextVersion = versionToOpen ?? rows[0]?.key ?? null;
      setSelectedVersion(nextVersion);
      if (nextVersion) {
        setSnapshotLoading(true);
        try {
          const snapshot = await fetchSettingsSnapshot(nextVersion);
          setSnapshotRows(snapshot);
        } finally {
          setSnapshotLoading(false);
        }
      } else {
        setSnapshotRows([]);
      }
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await reloadSettings();
        if (!active) return;
        await reloadHistory();
      } catch (error: any) {
        Toast.error(error?.message || '加载系统设置失败');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const saveAll = async () => {
    setSaving(true);
    try {
      await Promise.all([
        updateSetting(SETTINGS_CATEGORY_MAP.costStructure, 'defaultCostRates', store.defaultCostRates),
        updateSetting(SETTINGS_CATEGORY_MAP.costStructure, 'defaultMetalPrices', store.defaultMetalPrices),
        updateSetting(SETTINGS_CATEGORY_MAP.costStructure, 'defaultTemplateType', store.defaultTemplateType),
        updateSetting(SETTINGS_CATEGORY_MAP.costStructure, 'defaultAnnualDropRate', store.defaultAnnualDropRate),
        updateSetting(SETTINGS_CATEGORY_MAP.costStructure, 'schema', store.costStructure),
        updateSetting(SETTINGS_CATEGORY_MAP.costStructure, 'useSchemaEngine', store.useSchemaEngine),
        updateSetting(SETTINGS_CATEGORY_MAP.alertThreshold, 'copperPercent', store.alertThresholds.copperPercent),
        updateSetting(SETTINGS_CATEGORY_MAP.alertThreshold, 'aluminumPercent', store.alertThresholds.aluminumPercent),
        updateSetting(SETTINGS_CATEGORY_MAP.alertThreshold, 'enabled', store.alertThresholds.enabled),
        updateSetting(SETTINGS_CATEGORY_MAP.factories, 'list', store.factories),
        updateSetting(SETTINGS_CATEGORY_MAP.factories, 'selectedFactory', store.selectedFactory),
        updateSetting(SETTINGS_CATEGORY_MAP.factories, 'internalFactoryRates', store.internalFactoryRates),
        updateSetting(SETTINGS_CATEGORY_MAP.allocation, 'drivers', store.allocationConfig),
        updateSetting(SETTINGS_CATEGORY_MAP.coefficients, 'default', store.level1Coefficients),
        updateSetting(SETTINGS_CATEGORY_MAP.bomRules, 'rules', store.bomClassificationRules),
      ]);
      const publishResult = await publishSettings();
      await reloadHistory(publishResult.version);
      Toast.success(`设置已保存并发布：${publishResult.version}`);
    } catch (error: any) {
      Toast.error(error?.message || '保存系统设置失败');
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const selectVersion = async (version: string) => {
    setSelectedVersion(version);
    setSnapshotLoading(true);
    try {
      const snapshot = await fetchSettingsSnapshot(version);
      setSnapshotRows(snapshot);
    } catch (error: any) {
      Toast.error(error?.message || '加载设置快照失败');
    } finally {
      setSnapshotLoading(false);
    }
  };

  return {
    store,
    loading,
    saving,
    saveAll,
    historyLoading,
    history,
    selectedVersion,
    selectVersion,
    snapshotLoading,
    snapshotRows,
  };
}

export default function SettingsPage() {
  const {
    store,
    loading,
    saving,
    saveAll,
    historyLoading,
    history,
    selectedVersion,
    selectVersion,
    snapshotLoading,
    snapshotRows,
  } = useSettingsSync();
  const {
    defaultCostRates, defaultMetalPrices, alertThresholds,
    defaultTemplateType, defaultAnnualDropRate,
    updateCostRates, updateMetalPrices, updateAlertThresholds,
    setDefaultTemplateType, setDefaultAnnualDropRate, resetCostRates,
    costStructure, setCostStructure, useSchemaEngine, setUseSchemaEngine,
    factories, addFactory, updateFactory, removeFactory,
    selectedFactory, setSelectedFactory, internalFactoryRates,
    allocationConfig, updateAllocationDriver, setAllocationConfig,
    level1Coefficients, setLevel1Coefficients, resetLevel1Coefficients,
    bomClassificationRules, setBomClassificationRules,
  } = store;

  const handleClearData = async () => {
    try {
      await db.delete();
      Toast.success('所有数据已清除');
      setTimeout(() => { window.location.reload(); }, 1000);
    } catch {
      Toast.error('清除数据失败');
    }
  };

  const handleRestoreAdvancedDefaults = () => {
    setCostStructure(DEFAULT_COST_STRUCTURE);
    setAllocationConfig({ equipment: 'hours', rnd: 'revenue', indirectLabor: 'hours', management: 'direct' });
    setLevel1Coefficients({ materialRatio: 0.65, laborRatio: 0.09, mfgRatio: 0.12, packagingRatio: 0.024, freightRatio: 0.006 });
    setBomClassificationRules([...DEFAULT_CLASSIFICATION_RULES]);
    Toast.success('已恢复高级默认值');
  };

  const summary = useMemo(() => ({
    factories: factories.length,
    schemaItems: costStructure.items.length,
    bomRules: bomClassificationRules.length,
  }), [factories.length, costStructure.items.length, bomClassificationRules.length]);

  if (loading) {
    return <div style={{ padding: '48px 24px', display: 'flex', justifyContent: 'center' }}><Spin size="large" tip="正在加载系统设置..." /></div>;
  }

  return (
    <div style={{ padding: '0 24px 24px', maxWidth: 1280, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title heading={3}>系统设置</Title>
          <Text type="tertiary">全局基准 → 发布快照 → 项目/场景引用。</Text>
        </div>
        <Button theme="solid" type="primary" loading={saving} onClick={saveAll}>保存配置并发布</Button>
      </div>

      <Card className="glass-card" headerLine={false} style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <Tag color="blue">工厂 {summary.factories}</Tag>
            <Tag color="green">成本项 {summary.schemaItems}</Tag>
            <Tag color="cyan">BOM规则 {summary.bomRules}</Tag>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button theme="light" icon={<IconRefresh />} onClick={() => setCostStructure(DEFAULT_COST_STRUCTURE)}>恢复默认成本结构</Button>
            <Button theme="light" onClick={handleRestoreAdvancedDefaults}>恢复高级默认</Button>
          </div>
        </div>
      </Card>

      <Tabs type="line" defaultActiveKey="basic">
        <TabPane tab="基础配置" itemKey="basic">
          <BasicSettings
            defaultCostRates={defaultCostRates}
            updateCostRates={updateCostRates}
            defaultMetalPrices={defaultMetalPrices}
            updateMetalPrices={updateMetalPrices}
            alertThresholds={alertThresholds}
            updateAlertThresholds={updateAlertThresholds}
            defaultTemplateType={defaultTemplateType}
            setDefaultTemplateType={setDefaultTemplateType}
            defaultAnnualDropRate={defaultAnnualDropRate}
            setDefaultAnnualDropRate={setDefaultAnnualDropRate}
            resetCostRates={resetCostRates}
            handleClearData={handleClearData}
          />
        </TabPane>
        <TabPane tab="发布流" itemKey="publishFlow">
          <PublishFlowPanel
            historyLoading={historyLoading}
            history={history}
            selectedVersion={selectedVersion}
            selectVersion={selectVersion}
            snapshotLoading={snapshotLoading}
            snapshotRows={snapshotRows}
          />
        </TabPane>
        <TabPane tab="成本结构" itemKey="costStructure">
          <CostStructurePanel costStructure={costStructure} setCostStructure={setCostStructure} useSchemaEngine={useSchemaEngine} setUseSchemaEngine={setUseSchemaEngine} />
        </TabPane>
        <TabPane tab="多工厂" itemKey="factories">
          <FactoryPanel
            factories={factories}
            addFactory={addFactory}
            updateFactory={updateFactory}
            removeFactory={removeFactory}
            selectedFactory={selectedFactory}
            setSelectedFactory={setSelectedFactory}
            internalFactoryRates={internalFactoryRates}
          />
        </TabPane>
        <TabPane tab="费用分摊" itemKey="allocation">
          <AllocationPanel allocationConfig={allocationConfig} updateAllocationDriver={updateAllocationDriver} />
        </TabPane>
        <TabPane tab="系数近似" itemKey="coefficients">
          <Level1CoefficientsPanel coefficients={level1Coefficients} setCoefficients={setLevel1Coefficients} resetCoefficients={resetLevel1Coefficients} />
        </TabPane>
        <TabPane tab="BOM分类" itemKey="bomRules">
          <BomClassificationPanel rules={bomClassificationRules} setRules={setBomClassificationRules} />
        </TabPane>
      </Tabs>
    </div>
  );
}

function BasicSettings(props: any) {
  const {
    defaultCostRates, updateCostRates,
    defaultMetalPrices, updateMetalPrices,
    alertThresholds, updateAlertThresholds,
    defaultTemplateType, setDefaultTemplateType,
    defaultAnnualDropRate, setDefaultAnnualDropRate,
    resetCostRates, handleClearData,
  } = props;

  return (
    <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
      <Col span={12}>
        <RoleGuard field="costRates" readOnlyFallback>
          <Card className="glass-card" title="费率配置" headerLine={false}>
            <Row gutter={[12, 12]}>
              <Col span={12}><Text strong>人工费率</Text><InputNumber value={defaultCostRates.laborRate} style={{ width: '100%' }} onChange={(v: any) => updateCostRates({ laborRate: Number(v) })} /></Col>
              <Col span={12}><Text strong>制造费率</Text><InputNumber value={defaultCostRates.mfgRate} style={{ width: '100%' }} onChange={(v: any) => updateCostRates({ mfgRate: Number(v) })} /></Col>
              <Col span={12}><Text strong>废品率</Text><InputNumber value={defaultCostRates.wasteRate} style={{ width: '100%' }} onChange={(v: any) => updateCostRates({ wasteRate: Number(v) })} /></Col>
              <Col span={12}><Text strong>管理费率</Text><InputNumber value={defaultCostRates.mgmtRate} style={{ width: '100%' }} onChange={(v: any) => updateCostRates({ mgmtRate: Number(v) })} /></Col>
              <Col span={12}><Text strong>利润率</Text><InputNumber value={defaultCostRates.profitRate} style={{ width: '100%' }} onChange={(v: any) => updateCostRates({ profitRate: Number(v) })} /></Col>
              <Col span={12}><Text strong>默认年降率</Text><InputNumber value={defaultAnnualDropRate} style={{ width: '100%' }} onChange={(v: any) => setDefaultAnnualDropRate(Number(v))} /></Col>
            </Row>
          </Card>
        </RoleGuard>
      </Col>
      <Col span={12}>
        <Card className="glass-card" title="金属价格" headerLine={false}>
          <Row gutter={[12, 12]}>
            <Col span={12}><Text strong>铜价</Text><InputNumber value={defaultMetalPrices.copper} style={{ width: '100%' }} onChange={(v: any) => updateMetalPrices({ copper: Number(v) })} /></Col>
            <Col span={12}><Text strong>铝价</Text><InputNumber value={defaultMetalPrices.aluminum} style={{ width: '100%' }} onChange={(v: any) => updateMetalPrices({ aluminum: Number(v) })} /></Col>
          </Row>
        </Card>
      </Col>
      <Col span={12}>
        <Card className="glass-card" title="预警阈值" headerLine={false} headerExtraContent={<Switch checked={alertThresholds.enabled} onChange={(checked: boolean) => updateAlertThresholds({ enabled: checked })} />}>
          <Row gutter={[12, 12]}>
            <Col span={12}><Text strong>铜价阈值 (%)</Text><InputNumber value={alertThresholds.copperPercent} style={{ width: '100%' }} disabled={!alertThresholds.enabled} onChange={(v: any) => updateAlertThresholds({ copperPercent: Number(v) })} /></Col>
            <Col span={12}><Text strong>铝价阈值 (%)</Text><InputNumber value={alertThresholds.aluminumPercent} style={{ width: '100%' }} disabled={!alertThresholds.enabled} onChange={(v: any) => updateAlertThresholds({ aluminumPercent: Number(v) })} /></Col>
          </Row>
        </Card>
      </Col>
      <Col span={12}>
        <Card className="glass-card" title="默认模板" headerLine={false}>
          <RadioGroup value={defaultTemplateType} onChange={(e: any) => setDefaultTemplateType(e.target.value)} type="button">
            <Radio value="geely">吉利模板</Radio>
            <Radio value="byd">比亚迪模板</Radio>
            <Radio value="generic">通用模板</Radio>
          </RadioGroup>
        </Card>
      </Col>
      <Col span={24}>
        <Card className="glass-card" title="数据管理" headerLine={false}>
          <div style={{ display: 'flex', gap: 12 }}>
            <Button theme="light" onClick={resetCostRates}>重置费率</Button>
            <Button theme="light" type="danger" onClick={handleClearData}>清除所有数据</Button>
          </div>
        </Card>
      </Col>
    </Row>
  );
}

function PublishFlowPanel({
  historyLoading,
  history,
  selectedVersion,
  selectVersion,
  snapshotLoading,
  snapshotRows,
}: {
  historyLoading: boolean;
  history: SettingRow<SettingsPublishResult>[];
  selectedVersion: string | null;
  selectVersion: (version: string) => Promise<void>;
  snapshotLoading: boolean;
  snapshotRows: SettingsSnapshotRow[];
}) {
  return (
    <div style={{ marginTop: 16, display: 'grid', gap: 16 }}>
      <Card className="glass-card" title="费率发布流" headerLine={false}>
        <div style={{ display: 'grid', gap: 12 }}>
          <Text>全局基准 → 保存配置并发布 → 项目/场景引用快照。</Text>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Tag color="blue">全局基准</Tag>
            <Tag color="cyan">发布快照</Tag>
            <Tag color="green">项目/场景引用</Tag>
          </div>
        </div>
      </Card>

      <Card className="glass-card" title="发布历史" headerLine={false}>
        {historyLoading ? <Spin tip="正在加载发布历史..." /> : (
          <Table
            pagination={false}
            rowKey="id"
            dataSource={history}
            rowSelection={{
              selectedRowKeys: selectedVersion ? [selectedVersion] : [],
              onChange: (keys) => {
                const version = Array.isArray(keys) && keys.length > 0 ? String(keys[0]) : '';
                if (version) void selectVersion(version);
              },
            }}
            columns={[
              { title: '版本', dataIndex: 'key', render: (value: string) => <Button theme="borderless" onClick={() => void selectVersion(value)}>{value}</Button> },
              { title: '发布时间', dataIndex: 'value', render: (value: SettingsPublishResult) => formatDateTime(value?.publishedAt) },
              { title: '快照数', dataIndex: 'value', render: (value: SettingsPublishResult) => value?.itemCount ?? 0 },
              { title: '状态', dataIndex: 'value', render: (value: SettingsPublishResult) => <Tag color="green">{value?.status ?? 'published'}</Tag> },
            ]}
          />
        )}
      </Card>

      <Card className="glass-card" title="快照详情" headerLine={false}>
        {snapshotLoading ? <Spin tip="正在加载快照详情..." /> : (
          <Table
            pagination={false}
            rowKey="id"
            dataSource={snapshotRows}
            columns={[
              { title: '分类', dataIndex: 'sourceCategory', render: (value: string) => <Tag color="blue">{value}</Tag> },
              { title: '键', dataIndex: 'key' },
              { title: '内容预览', dataIndex: 'value', render: (value: unknown) => previewSnapshotValue(value) },
              { title: '版本', dataIndex: 'versionRef', render: (value: string | null) => value || '-' },
            ]}
          />
        )}
      </Card>
    </div>
  );
}

function CostStructurePanel({ costStructure, setCostStructure, useSchemaEngine, setUseSchemaEngine }: { costStructure: any; setCostStructure: (s: any) => void; useSchemaEngine: boolean; setUseSchemaEngine: (v: boolean) => void; }) {
  const items = costStructure.items as CostItemDef[];
  const updateItem = (index: number, patch: Partial<CostItemDef>) => setCostStructure({ ...costStructure, items: items.map((it, i) => i === index ? { ...it, ...patch } : it) });
  const removeItem = (index: number) => setCostStructure({ ...costStructure, items: items.filter((_: any, i: number) => i !== index) });
  const addItem = () => setCostStructure({ ...costStructure, items: [...items, { key: `custom_${Date.now()}`, label: '新成本项', calcMethod: 'direct', order: (items.length + 1) * 10 }] });

  const columns = [
    { title: '标识', dataIndex: 'key', render: (text: string, _r: any, i: number) => <Input value={text} onChange={(v: string) => updateItem(i, { key: v })} /> },
    { title: '名称', dataIndex: 'label', render: (text: string, _r: any, i: number) => <Input value={text} onChange={(v: string) => updateItem(i, { label: v })} /> },
    { title: '计算方式', dataIndex: 'calcMethod', render: (text: CostItemCalcMethod, _r: any, i: number) => <Select value={text} optionList={CALC_METHOD_OPTIONS} onChange={(v: any) => updateItem(i, { calcMethod: v })} /> },
    { title: '费率/金额', dataIndex: 'rate', render: (_: any, record: CostItemDef, i: number) => <InputNumber value={record.rate ?? record.fixedAmount ?? 0} onChange={(v: any) => updateItem(i, record.calcMethod === 'rate_x_hours' || record.calcMethod === 'rate_x_base' ? { rate: Number(v) } : { fixedAmount: Number(v) })} /> },
    { title: '基数引用', dataIndex: 'baseRef', render: (_: any, record: CostItemDef, i: number) => <Input value={(record.baseRef || []).join(',')} onChange={(v: string) => updateItem(i, { baseRef: v.split(',').map((s) => s.trim()).filter(Boolean) })} /> },
    { title: '排序', dataIndex: 'order', render: (text: number, _r: any, i: number) => <InputNumber value={text} onChange={(v: any) => updateItem(i, { order: Number(v) })} /> },
    { title: '出厂价', dataIndex: 'inExFactory', render: (_: any, record: CostItemDef, i: number) => <Switch checked={record.inExFactory !== false} onChange={(v: boolean) => updateItem(i, { inExFactory: v })} /> },
    { title: '', dataIndex: 'op', render: (_: any, _r: any, i: number) => <Button icon={<IconDelete />} theme="borderless" type="danger" onClick={() => removeItem(i)} /> },
  ];

  return (
    <div style={{ marginTop: 16 }}>
      <Card className="glass-card" title="成本结构定义" headerLine={false} headerExtraContent={<div style={{ display: 'flex', gap: 12, alignItems: 'center' }}><Text>启用 Schema 引擎</Text><Switch checked={useSchemaEngine} onChange={setUseSchemaEngine} /></div>}>
        <Row gutter={12} style={{ marginBottom: 12 }}>
          <Col span={8}><Text strong>Schema 名称</Text><Input value={costStructure.name} onChange={(v: string) => setCostStructure({ ...costStructure, name: v })} /></Col>
          <Col span={4}><Text strong>版本</Text><Input value={costStructure.version || ''} onChange={(v: string) => setCostStructure({ ...costStructure, version: v })} /></Col>
        </Row>
        <Table columns={columns} dataSource={items} rowKey="key" pagination={false} size="small" />
        <Button icon={<IconPlus />} theme="light" style={{ marginTop: 12 }} onClick={addItem}>添加成本项</Button>
      </Card>
    </div>
  );
}

function FactoryPanel({
  factories,
  addFactory,
  updateFactory,
  removeFactory,
  selectedFactory,
  setSelectedFactory,
  internalFactoryRates,
}: {
  factories: FactoryConfig[];
  addFactory: (f: FactoryConfig) => void;
  updateFactory: (id: string, p: Partial<FactoryConfig>) => void;
  removeFactory: (id: string) => void;
  selectedFactory: ProjectFactoryId;
  setSelectedFactory: (id: ProjectFactoryId) => void;
  internalFactoryRates: Partial<Record<ProjectFactoryId, InternalCostRates>>;
}) {
  const addNewFactory = () => addFactory({ factoryId: `F${Date.now().toString(36).toUpperCase()}`, factoryName: '新工厂', costRates: { laborRate: 35, mfgRate: 46.69, wasteRate: 0.01, mgmtRate: 0.06, profitRate: 0.056627 }, efficiencyFactor: 1.0 });
  const currentInternalRates = internalFactoryRates[selectedFactory];
  const loadRefFactories = () => {
    for (const ref of REFERENCE_FACTORIES) if (!factories.find((f) => f.factoryId === ref.factoryId)) addFactory({ ...ref });
    Toast.success('已加载参考工厂数据');
  };
  const baseFactory = factories.find((factory) => factory.isBase) ?? factories[0] ?? null;
  const columns = [
    { title: 'ID', dataIndex: 'factoryId', render: (text: string) => <Tag>{text}</Tag> },
    { title: '工厂名称', dataIndex: 'factoryName', render: (text: string, r: FactoryConfig) => <Input value={text} onChange={(v: string) => updateFactory(r.factoryId, { factoryName: v })} /> },
    { title: '人工费率', dataIndex: 'laborRate', render: (_: any, r: FactoryConfig) => <InputNumber value={r.costRates.laborRate} onChange={(v: any) => updateFactory(r.factoryId, { costRates: { ...r.costRates, laborRate: Number(v) } })} /> },
    { title: '制造费率', dataIndex: 'mfgRate', render: (_: any, r: FactoryConfig) => <InputNumber value={r.costRates.mfgRate} onChange={(v: any) => updateFactory(r.factoryId, { costRates: { ...r.costRates, mfgRate: Number(v) } })} /> },
    { title: '废品率', dataIndex: 'wasteRate', render: (_: any, r: FactoryConfig) => <InputNumber value={r.costRates.wasteRate} onChange={(v: any) => updateFactory(r.factoryId, { costRates: { ...r.costRates, wasteRate: Number(v) } })} /> },
    { title: '管理费率', dataIndex: 'mgmtRate', render: (_: any, r: FactoryConfig) => <InputNumber value={r.costRates.mgmtRate} onChange={(v: any) => updateFactory(r.factoryId, { costRates: { ...r.costRates, mgmtRate: Number(v) } })} /> },
    { title: '利润率', dataIndex: 'profitRate', render: (_: any, r: FactoryConfig) => <InputNumber value={r.costRates.profitRate} onChange={(v: any) => updateFactory(r.factoryId, { costRates: { ...r.costRates, profitRate: Number(v) } })} /> },
    { title: '效率系数', dataIndex: 'efficiencyFactor', render: (_: any, r: FactoryConfig) => <InputNumber value={r.efficiencyFactor} onChange={(v: any) => updateFactory(r.factoryId, { efficiencyFactor: Number(v) })} /> },
    { title: '基准', dataIndex: 'isBase', render: (_: any, r: FactoryConfig) => <Switch checked={!!r.isBase} onChange={(v: boolean) => updateFactory(r.factoryId, { isBase: v })} /> },
    { title: '费率来源/备注', dataIndex: 'remark', render: (text: string | undefined, r: FactoryConfig) => <Input value={text ?? ''} placeholder="如：来自《运营工时费报价基准》" onChange={(v: string) => updateFactory(r.factoryId, { remark: v })} /> },
    { title: '', dataIndex: 'op', render: (_: any, r: FactoryConfig) => <Button icon={<IconDelete />} theme="borderless" type="danger" onClick={() => removeFactory(r.factoryId)} /> },
  ];
  return <div style={{ marginTop: 16 }}><Card className="glass-card" title={`工厂配置 (${factories.length})`} headerLine={false} headerExtraContent={<Button theme="light" onClick={loadRefFactories}>加载参考工厂</Button>}><div style={{ display: 'grid', gap: 12, marginBottom: 12 }}><Text type="tertiary">工厂费率基准会随发布流快照化；这里显式记录基准工厂与费率来源，便于追溯《运营工时费报价基准》口径。</Text>{baseFactory && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><Tag color="blue">基准工厂 {baseFactory.factoryId} / {baseFactory.factoryName}</Tag><Tag color="cyan">人工 {safeNumber(baseFactory.costRates?.laborRate)}</Tag><Tag color="green">制造 {safeNumber(baseFactory.costRates?.mfgRate)}</Tag>{baseFactory.remark ? <Tag color="grey">{baseFactory.remark}</Tag> : null}</div>}<Card
  bodyStyle={{ padding: 16 }}
  style={{ background: 'rgba(15, 23, 42, 0.35)', border: '1px solid rgba(96, 165, 250, 0.2)' }}
  title="内部成本工厂切换"
  headerLine={false}
>
  <div style={{ display: 'grid', gap: 12 }}>
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
      <Text strong>当前工厂</Text>
      <Select
        value={selectedFactory}
        style={{ width: 220 }}
        optionList={(Object.keys(internalFactoryRates) as ProjectFactoryId[]).map((factoryId) => ({
          value: factoryId,
          label: `${factoryId}${factoryId === 'K3' ? '（默认）' : ''}`,
        }))}
        onChange={(value: any) => setSelectedFactory(getSelectedFactoryId(value))}
      />
      <Tag color="blue">当前 {selectedFactory}</Tag>
      <Tag color="green">默认打开 K3</Tag>
    </div>
    {currentInternalRates ? (
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Tag color="cyan">直接人工 {safeNumber(currentInternalRates.laborRate)}</Tag>
        <Tag color="green">间接人工 {safeNumber(currentInternalRates.indirectLaborRate)}</Tag>
        <Tag color="orange">厂房分摊 {safeNumber(currentInternalRates.factoryAmortizationRate)}</Tag>
        <Tag color="purple">自动化分摊 {safeNumber(currentInternalRates.automationAmortizationRate)}</Tag>
        <Tag color="grey">材料损耗 {safeNumber(currentInternalRates.materialWasteRate)}</Tag>
      </div>
    ) : null}
    <Text type="tertiary">切换后会更新系统设置中的 selectedFactory，内部成本链按所选工厂费率重新读取并重算。</Text>
  </div>
</Card></div><Table columns={columns} dataSource={factories} rowKey="factoryId" pagination={false} /><Button icon={<IconPlus />} theme="light" style={{ marginTop: 12 }} onClick={addNewFactory}>添加工厂</Button></Card></div>;
}

function AllocationPanel({ allocationConfig, updateAllocationDriver }: { allocationConfig: AllocationConfig; updateAllocationDriver: (key: keyof AllocationConfig, driver: AllocationDriver) => void; }) {
  const entries: { key: keyof AllocationConfig; label: string; desc: string }[] = [
    { key: 'equipment', label: '设备折旧', desc: '设备折旧分摊方式' },
    { key: 'rnd', label: '研发费用', desc: '研发试验费分摊方式' },
    { key: 'indirectLabor', label: '间接人工', desc: '间接人工分摊方式' },
    { key: 'management', label: '管理费', desc: '管理费全局分摊或各线束独立计算' },
  ];
  return <div style={{ marginTop: 16 }}><Card className="glass-card" title="间接费用分摊配置" headerLine={false}><div style={{ display: 'grid', gap: 16 }}>{entries.map(({ key, label, desc }) => <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 16 }}><div style={{ minWidth: 120 }}><Text strong>{label}</Text><div><Text type="tertiary">{desc}</Text></div></div><Select value={allocationConfig[key]} optionList={ALLOCATION_DRIVER_OPTIONS} style={{ width: 220 }} onChange={(v: any) => updateAllocationDriver(key, v)} /><Tag color={allocationConfig[key] === 'direct' ? 'blue' : 'green'}>{allocationConfig[key]}</Tag></div>)}</div></Card></div>;
}

function Level1CoefficientsPanel({ coefficients, setCoefficients, resetCoefficients }: { coefficients: Level1Coefficients; setCoefficients: (c: Level1Coefficients) => void; resetCoefficients: () => void; }) {
  const entries: { key: keyof Level1Coefficients; label: string }[] = [
    { key: 'materialRatio', label: '材料占比' },
    { key: 'laborRatio', label: '人工占比' },
    { key: 'mfgRatio', label: '制造占比' },
    { key: 'packagingRatio', label: '包装占比' },
    { key: 'freightRatio', label: '运输占比' },
  ];
  const total = Object.values(coefficients).reduce((sum, value) => sum + value, 0);
  return <div style={{ marginTop: 16 }}><Card className="glass-card" title="Level 1 系数近似" headerLine={false} headerExtraContent={<Button theme="light" onClick={resetCoefficients}>恢复默认</Button>}><Row gutter={[16, 16]}>{entries.map(({ key, label }) => <Col span={8} key={key}><Text strong>{label}</Text><InputNumber value={coefficients[key]} step={0.01} min={0} max={1} style={{ width: '100%' }} onChange={(v: any) => setCoefficients({ ...coefficients, [key]: Number(v) })} /></Col>)}<Col span={8}><Text strong>系数合计</Text><div><Text style={{ fontSize: 18 }}>{total.toFixed(4)}</Text>{total > 1 && <Tag color="red" style={{ marginLeft: 8 }}>超过 1.0</Tag>}</div></Col></Row></Card></div>;
}

function BomClassificationPanel({ rules, setRules }: { rules: BomClassificationRule[]; setRules: (rules: BomClassificationRule[]) => void; }) {
  const addRule = () => setRules([...rules, { category: 'other', patterns: [], matchFields: ['partName', 'itemCategory'], priority: 10 }]);
  const updateRule = (index: number, patch: Partial<BomClassificationRule>) => setRules(rules.map((rule, i) => i === index ? { ...rule, ...patch } : rule));
  const removeRule = (index: number) => setRules(rules.filter((_, i) => i !== index));
  const columns = [
    { title: '类别', dataIndex: 'category', render: (text: string, _r: any, i: number) => <Select value={text} style={{ width: 160 }} optionList={Object.entries(CATEGORY_LABELS).map(([value, meta]) => ({ value, label: meta.label }))} onChange={(v: any) => updateRule(i, { category: v })} /> },
    { title: '模式', dataIndex: 'patterns', render: (value: string[], _r: any, i: number) => <Input value={(value || []).join(',')} onChange={(v: string) => updateRule(i, { patterns: v.split(',').map((s) => s.trim()).filter(Boolean) })} /> },
    { title: '匹配字段', dataIndex: 'matchFields', render: (value: string[], _r: any, i: number) => <Input value={(value || []).join(',')} onChange={(v: string) => updateRule(i, { matchFields: v.split(',').map((s) => s.trim()).filter(Boolean) as any })} /> },
    { title: '优先级', dataIndex: 'priority', render: (value: number, _r: any, i: number) => <InputNumber value={value ?? 0} onChange={(v: any) => updateRule(i, { priority: Number(v) })} /> },
    { title: '', dataIndex: 'op', render: (_: any, _r: any, i: number) => <Button icon={<IconDelete />} theme="borderless" type="danger" onClick={() => removeRule(i)} /> },
  ];
  return <div style={{ marginTop: 16 }}><Card className="glass-card" title="BOM分类规则" headerLine={false} headerExtraContent={<Button theme="light" onClick={() => setRules([...DEFAULT_CLASSIFICATION_RULES])}>恢复默认规则</Button>}><Table columns={columns} dataSource={rules.map((rule, index) => ({ ...rule, __rowKey: `rule-${index}` }))} rowKey="__rowKey" pagination={false} /><Button icon={<IconPlus />} theme="light" style={{ marginTop: 12 }} onClick={addRule}>添加规则</Button></Card></div>;
}
