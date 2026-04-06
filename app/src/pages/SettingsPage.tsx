import { useState } from 'react';
import {
  Typography, Button, Toast, InputNumber, Switch, Card, RadioGroup, Radio,
  Popconfirm, Row, Col, Select, Table, Input, Tag, Tabs, TabPane,
} from '@douyinfe/semi-ui';
import { IconPlus, IconDelete, IconEdit, IconSave, IconClose, IconRefresh } from '@douyinfe/semi-icons';
import { useSettingsStore } from '@/store/settingsStore';
import { db } from '@/data/db';
import type {
  CostItemDef, CostItemCalcMethod, FactoryConfig,
  AllocationDriver, AllocationConfig, BomClassificationRule,
} from '@/types/project';
import { REFERENCE_FACTORIES } from '@/engine/factory_comparison';
import { DEFAULT_CLASSIFICATION_RULES } from '@/engine/harness_costing';
import { RoleGuard } from '@/components/RoleGuard';

const { Title, Text } = Typography;

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

export default function SettingsPage() {
  const {
    themeMode, setThemeMode,
    defaultCostRates, defaultMetalPrices, alertThresholds,
    defaultTemplateType, defaultAnnualDropRate,
    updateCostRates, updateMetalPrices, updateAlertThresholds,
    setDefaultTemplateType, setDefaultAnnualDropRate, resetCostRates,
    // P1
    costStructure, setCostStructure, useSchemaEngine, setUseSchemaEngine,
    factories, addFactory, updateFactory, removeFactory,
    allocationConfig, updateAllocationDriver,
    level1Coefficients, setLevel1Coefficients, resetLevel1Coefficients,
    bomClassificationRules, setBomClassificationRules,
  } = useSettingsStore();

  const handleSave = () => {
    Toast.success('设置已保存');
  };

  const handleClearData = async () => {
    try {
      await db.delete();
      Toast.success('所有数据已清除');
      setTimeout(() => { window.location.reload(); }, 1000);
    } catch { Toast.error('清除数据失败'); }
  };

  return (
    <div style={{ padding: '0 24px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title heading={3}>系统设置</Title>
        <Button theme="solid" type="primary" onClick={handleSave}>保存配置</Button>
      </div>

      <Tabs type="line" defaultActiveKey="basic">
        <TabPane tab="基础配置" itemKey="basic">
          <BasicSettings
            themeMode={themeMode} setThemeMode={setThemeMode}
            defaultCostRates={defaultCostRates} updateCostRates={updateCostRates}
            defaultMetalPrices={defaultMetalPrices} updateMetalPrices={updateMetalPrices}
            alertThresholds={alertThresholds} updateAlertThresholds={updateAlertThresholds}
            defaultTemplateType={defaultTemplateType} setDefaultTemplateType={setDefaultTemplateType}
            defaultAnnualDropRate={defaultAnnualDropRate} setDefaultAnnualDropRate={setDefaultAnnualDropRate}
            resetCostRates={resetCostRates} handleClearData={handleClearData}
          />
        </TabPane>
        <TabPane tab="成本结构" itemKey="costStructure">
          <CostStructurePanel
            costStructure={costStructure} setCostStructure={setCostStructure}
            useSchemaEngine={useSchemaEngine} setUseSchemaEngine={setUseSchemaEngine}
          />
        </TabPane>
        <TabPane tab="多工厂管理" itemKey="factories">
          <FactoryPanel
            factories={factories} addFactory={addFactory}
            updateFactory={updateFactory} removeFactory={removeFactory}
          />
        </TabPane>
        <TabPane tab="费用分摊" itemKey="allocation">
          <AllocationPanel
            allocationConfig={allocationConfig} updateAllocationDriver={updateAllocationDriver}
          />
        </TabPane>
        <TabPane tab="系数近似" itemKey="coefficients">
          <Level1CoefficientsPanel
            coefficients={level1Coefficients}
            setCoefficients={setLevel1Coefficients}
            resetCoefficients={resetLevel1Coefficients}
          />
        </TabPane>
        <TabPane tab="BOM分类规则" itemKey="bomRules">
          <BomClassificationPanel
            rules={bomClassificationRules}
            setRules={setBomClassificationRules}
          />
        </TabPane>
      </Tabs>
    </div>
  );
}

// ── Basic Settings (original) ──
function BasicSettings(props: any) {
  const {
    themeMode, setThemeMode, defaultCostRates, updateCostRates,
    defaultMetalPrices, updateMetalPrices, alertThresholds, updateAlertThresholds,
    defaultTemplateType, setDefaultTemplateType, defaultAnnualDropRate,
    setDefaultAnnualDropRate, resetCostRates, handleClearData,
  } = props;

  return (
    <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
      <Col span={12}>
        <Card className="glass-card" title="外观设置" headerLine={false} style={{ height: '100%' }}>
          <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>主题模式</Text>
          <RadioGroup value={themeMode} onChange={(e: any) => setThemeMode(e.target.value)} type="button">
            <Radio value="light">浅色</Radio>
            <Radio value="dark">深色</Radio>
            <Radio value="system">跟随系统</Radio>
          </RadioGroup>
        </Card>
      </Col>
      <Col span={12}>
        <RoleGuard field="costRates" readOnlyFallback>
          <Card className="glass-card" title="费率配置" headerLine={false} style={{ height: '100%' }}>
            <Row gutter={[12, 12]}>
              <Col span={12}>
                <Text strong style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>人工费率 (元/时)</Text>
                <InputNumber value={defaultCostRates.laborRate} step={0.01} style={{ width: '100%' }}
                  onChange={(v: any) => updateCostRates({ laborRate: Number(v) })} />
              </Col>
              <Col span={12}>
                <Text strong style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>制造费率 (元/时)</Text>
                <InputNumber value={defaultCostRates.mfgRate} step={0.01} style={{ width: '100%' }}
                  onChange={(v: any) => updateCostRates({ mfgRate: Number(v) })} />
              </Col>
              <Col span={12}>
                <Text strong style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>废品率</Text>
                <InputNumber value={defaultCostRates.wasteRate} step={0.001} style={{ width: '100%' }}
                  onChange={(v: any) => updateCostRates({ wasteRate: Number(v) })} />
              </Col>
              <Col span={12}>
                <Text strong style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>管理费率</Text>
                <InputNumber value={defaultCostRates.mgmtRate} step={0.001} style={{ width: '100%' }}
                  onChange={(v: any) => updateCostRates({ mgmtRate: Number(v) })} />
              </Col>
              <Col span={12}>
                <Text strong style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>利润率</Text>
                <InputNumber value={defaultCostRates.profitRate} step={0.0001} style={{ width: '100%' }}
                  onChange={(v: any) => updateCostRates({ profitRate: Number(v) })} />
              </Col>
              <Col span={12}>
                <Text strong style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>默认年降率</Text>
                <InputNumber value={defaultAnnualDropRate} step={0.001} style={{ width: '100%' }}
                  onChange={(v: any) => setDefaultAnnualDropRate(Number(v))} />
              </Col>
            </Row>
          </Card>
        </RoleGuard>
      </Col>
      <Col span={12}>
        <Card className="glass-card" title="金属基准价 (元/吨)" headerLine={false} style={{ height: '100%' }}>
          <Row gutter={[12, 12]}>
            <Col span={12}>
              <Text strong style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>铜价</Text>
              <InputNumber value={defaultMetalPrices.copper} step={100} style={{ width: '100%' }}
                onChange={(v: any) => updateMetalPrices({ copper: Number(v) })} />
            </Col>
            <Col span={12}>
              <Text strong style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>铝价</Text>
              <InputNumber value={defaultMetalPrices.aluminum} step={100} style={{ width: '100%' }}
                onChange={(v: any) => updateMetalPrices({ aluminum: Number(v) })} />
            </Col>
          </Row>
        </Card>
      </Col>
      <Col span={12}>
        <Card className="glass-card" title="预警设置" headerLine={false}
          headerExtraContent={<Switch checked={alertThresholds.enabled} onChange={(checked: boolean) => updateAlertThresholds({ enabled: checked })} />}
          style={{ height: '100%' }}
        >
          <Row gutter={[12, 12]}>
            <Col span={12}>
              <Text strong style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>铜价预警阈值 (%)</Text>
              <InputNumber value={alertThresholds.copperPercent} step={0.1} style={{ width: '100%' }}
                onChange={(v: any) => updateAlertThresholds({ copperPercent: Number(v) })} disabled={!alertThresholds.enabled} />
            </Col>
            <Col span={12}>
              <Text strong style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>铝价预警阈值 (%)</Text>
              <InputNumber value={alertThresholds.aluminumPercent} step={0.1} style={{ width: '100%' }}
                onChange={(v: any) => updateAlertThresholds({ aluminumPercent: Number(v) })} disabled={!alertThresholds.enabled} />
            </Col>
          </Row>
        </Card>
      </Col>
      <Col span={12}>
        <Card className="glass-card" title="默认模板" headerLine={false} style={{ height: '100%' }}>
          <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>默认报价模板</Text>
          <RadioGroup value={defaultTemplateType} onChange={(e: any) => setDefaultTemplateType(e.target.value)} type="button">
            <Radio value="geely">吉利模板</Radio>
            <Radio value="byd">比亚迪模板</Radio>
            <Radio value="generic">通用模板</Radio>
          </RadioGroup>
        </Card>
      </Col>
      <Col span={12}>
        <Card className="glass-card" title="系统信息" headerLine={false} style={{ height: '100%' }}>
          <div style={{ display: 'grid', gap: 8 }}>
            <div><Text strong style={{ fontSize: 13 }}>软件版本：</Text><Text style={{ fontSize: 13 }}>v2026.04.05</Text></div>
            <div><Text strong style={{ fontSize: 13 }}>构建信息：</Text><Text style={{ fontSize: 13 }}>React 18 + TypeScript + Semi Design</Text></div>
            <div><Text strong style={{ fontSize: 13 }}>数据库：</Text><Text style={{ fontSize: 13 }}>IndexedDB (Dexie v4)</Text></div>
          </div>
        </Card>
      </Col>
      <Col span={12}>
        <Card className="glass-card" title="数据管理" headerLine={false} style={{ height: '100%' }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <RoleGuard field="costRates">
              <Button theme="light" onClick={resetCostRates}>重置费率</Button>
            </RoleGuard>
            <RoleGuard field="deleteProject">
              <Popconfirm title="确定要清除所有数据吗？" content="此操作将永久删除所有项目、线束和报价记录，且不可恢复。"
                onConfirm={handleClearData} okType="danger">
                <Button theme="light" type="danger">清除所有数据</Button>
              </Popconfirm>
            </RoleGuard>
          </div>
        </Card>
      </Col>
    </Row>
  );
}

// ── Cost Structure Schema Panel ──
function CostStructurePanel({ costStructure, setCostStructure, useSchemaEngine, setUseSchemaEngine }: {
  costStructure: any; setCostStructure: (s: any) => void;
  useSchemaEngine: boolean; setUseSchemaEngine: (v: boolean) => void;
}) {
  const items = costStructure.items as CostItemDef[];

  const handleAddItem = () => {
    const newItem: CostItemDef = {
      key: `custom_${Date.now()}`,
      label: '新成本项',
      calcMethod: 'direct',
      order: (items.length + 1) * 10,
    };
    setCostStructure({ ...costStructure, items: [...items, newItem] });
  };

  const handleUpdateItem = (index: number, patch: Partial<CostItemDef>) => {
    const updated = items.map((it, i) => i === index ? { ...it, ...patch } : it);
    setCostStructure({ ...costStructure, items: updated });
  };

  const handleRemoveItem = (index: number) => {
    setCostStructure({ ...costStructure, items: items.filter((_, i) => i !== index) });
  };

  const columns = [
    {
      title: '标识', dataIndex: 'key', width: 140,
      render: (text: string, _rec: any, index: number) => (
        <Input size="small" value={text} style={{ width: 120 }}
          onChange={(v: string) => handleUpdateItem(index, { key: v })} />
      ),
    },
    {
      title: '名称', dataIndex: 'label', width: 120,
      render: (text: string, _rec: any, index: number) => (
        <Input size="small" value={text} style={{ width: 100 }}
          onChange={(v: string) => handleUpdateItem(index, { label: v })} />
      ),
    },
    {
      title: '计算方式', dataIndex: 'calcMethod', width: 150,
      render: (text: CostItemCalcMethod, _rec: any, index: number) => (
        <Select size="small" value={text} style={{ width: 130 }}
          onChange={(v: any) => handleUpdateItem(index, { calcMethod: v })}
          optionList={CALC_METHOD_OPTIONS} />
      ),
    },
    {
      title: '费率/金额', dataIndex: 'rate', width: 110,
      render: (_: any, record: CostItemDef, index: number) => (
        <InputNumber size="small" value={record.rate ?? record.fixedAmount ?? 0} step={0.001}
          style={{ width: 90 }}
          onChange={(v: any) => {
            if (['rate_x_hours', 'rate_x_base'].includes(record.calcMethod)) {
              handleUpdateItem(index, { rate: Number(v) });
            } else {
              handleUpdateItem(index, { fixedAmount: Number(v) });
            }
          }}
        />
      ),
    },
    {
      title: '基数引用', dataIndex: 'baseRef', width: 160,
      render: (_: any, record: CostItemDef, index: number) => (
        record.calcMethod === 'rate_x_base' ? (
          <Input size="small" value={(record.baseRef || []).join(',')} style={{ width: 140 }}
            placeholder="key1,key2"
            onChange={(v: string) => handleUpdateItem(index, { baseRef: v.split(',').map(s => s.trim()).filter(Boolean) })} />
        ) : <Text type="quaternary">-</Text>
      ),
    },
    {
      title: '排序', dataIndex: 'order', width: 80,
      render: (text: number, _rec: any, index: number) => (
        <InputNumber size="small" value={text} style={{ width: 60 }}
          onChange={(v: any) => handleUpdateItem(index, { order: Number(v) })} />
      ),
    },
    {
      title: '出厂价', dataIndex: 'inExFactory', width: 70,
      render: (_: any, record: CostItemDef, index: number) => (
        <Switch size="small" checked={record.inExFactory !== false}
          onChange={(c: boolean) => handleUpdateItem(index, { inExFactory: c })} />
      ),
    },
    {
      title: '', dataIndex: 'op', width: 50,
      render: (_: any, _rec: any, index: number) => (
        <Button icon={<IconDelete />} size="small" type="danger" theme="borderless"
          onClick={() => handleRemoveItem(index)} />
      ),
    },
  ];

  return (
    <div style={{ marginTop: 16 }}>
      <Card className="glass-card" title="成本结构定义" headerLine={false}
        headerExtraContent={
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Text style={{ fontSize: 13 }}>启用 Schema 引擎</Text>
            <Switch checked={useSchemaEngine} onChange={setUseSchemaEngine} />
          </div>
        }
      >
        <div style={{ marginBottom: 12 }}>
          <Row gutter={12}>
            <Col span={8}>
              <Text strong style={{ fontSize: 13 }}>Schema 名称</Text>
              <Input value={costStructure.name} style={{ marginTop: 4 }}
                onChange={(v: string) => setCostStructure({ ...costStructure, name: v })} />
            </Col>
            <Col span={4}>
              <Text strong style={{ fontSize: 13 }}>版本</Text>
              <Input value={costStructure.version || ''} style={{ marginTop: 4 }}
                onChange={(v: string) => setCostStructure({ ...costStructure, version: v })} />
            </Col>
          </Row>
        </div>
        <Table
          columns={columns}
          dataSource={items}
          pagination={false}
          size="small"
          rowKey={(record) => record?.key ?? ''}
        />
        <Button icon={<IconPlus />} theme="light" style={{ marginTop: 12 }} onClick={handleAddItem}>
          添加成本项
        </Button>
        {!useSchemaEngine && (
          <Tag color="amber" style={{ marginLeft: 12 }}>Schema 引擎未启用，当前使用标准硬编码模式</Tag>
        )}
      </Card>
    </div>
  );
}

// ── Factory Management Panel ──
function FactoryPanel({ factories, addFactory, updateFactory, removeFactory }: {
  factories: FactoryConfig[]; addFactory: (f: FactoryConfig) => void;
  updateFactory: (id: string, p: Partial<FactoryConfig>) => void;
  removeFactory: (id: string) => void;
}) {
  // Reference factories can be loaded with the button below

  const handleAddFactory = () => {
    const id = `F${Date.now().toString(36).toUpperCase()}`;
    addFactory({
      factoryId: id,
      factoryName: '新工厂',
      costRates: { laborRate: 35, mfgRate: 46.69, wasteRate: 0.01, mgmtRate: 0.06, profitRate: 0.056627 },
      efficiencyFactor: 1.0,
    });
  };

  const handleLoadRefFactories = () => {
    for (const ref of REFERENCE_FACTORIES) {
      if (!factories.find(f => f.factoryId === ref.factoryId)) {
        addFactory({ ...ref });
      }
    }
    Toast.success('已加载参考工厂数据');
  };

  const columns = [
    {
      title: 'ID', dataIndex: 'factoryId', width: 80,
      render: (text: string) => <Tag>{text}</Tag>,
    },
    {
      title: '工厂名称', dataIndex: 'factoryName', width: 120,
      render: (text: string, record: FactoryConfig) => (
        <Input size="small" value={text} style={{ width: 100 }}
          onChange={(v: string) => updateFactory(record.factoryId, { factoryName: v })} />
      ),
    },
    {
      title: '人工费率', dataIndex: 'laborRate', width: 100,
      render: (_: any, record: FactoryConfig) => (
        <InputNumber size="small" value={record.costRates.laborRate} step={0.5} style={{ width: 80 }}
          onChange={(v: any) => updateFactory(record.factoryId, { costRates: { ...record.costRates, laborRate: Number(v) } })} />
      ),
    },
    {
      title: '制造费率', dataIndex: 'mfgRate', width: 100,
      render: (_: any, record: FactoryConfig) => (
        <InputNumber size="small" value={record.costRates.mfgRate} step={0.5} style={{ width: 80 }}
          onChange={(v: any) => updateFactory(record.factoryId, { costRates: { ...record.costRates, mfgRate: Number(v) } })} />
      ),
    },
    {
      title: '效率系数', dataIndex: 'efficiencyFactor', width: 100,
      render: (_: any, record: FactoryConfig) => (
        <InputNumber size="small" value={record.efficiencyFactor} step={0.01} style={{ width: 80 }}
          onChange={(v: any) => updateFactory(record.factoryId, { efficiencyFactor: Number(v) })} />
      ),
    },
    {
      title: '基准', dataIndex: 'isBase', width: 60,
      render: (_: any, record: FactoryConfig) => (
        <Switch size="small" checked={!!record.isBase}
          onChange={(c: boolean) => updateFactory(record.factoryId, { isBase: c })} />
      ),
    },
    {
      title: '', dataIndex: 'op', width: 50,
      render: (_: any, record: FactoryConfig) => (
        <Button icon={<IconDelete />} size="small" type="danger" theme="borderless"
          onClick={() => removeFactory(record.factoryId)} />
      ),
    },
  ];

  return (
    <div style={{ marginTop: 16 }}>
      <Card className="glass-card" title={`工厂配置 (${factories.length})`} headerLine={false}
        headerExtraContent={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button size="small" theme="light" onClick={handleLoadRefFactories}>
              加载参考数据 (7厂)
            </Button>
          </div>
        }
      >
        {factories.length > 0 ? (
          <Table columns={columns} dataSource={factories} pagination={false} size="small"
            rowKey="factoryId" />
        ) : (
          <div style={{ textAlign: 'center', padding: 24, color: 'var(--semi-color-text-2)' }}>
            <Text type="quaternary">尚未配置工厂，点击下方按钮添加</Text>
          </div>
        )}
        <Button icon={<IconPlus />} theme="light" style={{ marginTop: 12 }} onClick={handleAddFactory}>
          添加工厂
        </Button>
        <Text type="quaternary" style={{ marginLeft: 12, fontSize: 12 }}>
          配置多工厂后可在模拟页面进行跨厂成本比价分析
        </Text>
      </Card>
    </div>
  );
}

// ── Allocation Config Panel ──
function AllocationPanel({ allocationConfig, updateAllocationDriver }: {
  allocationConfig: AllocationConfig;
  updateAllocationDriver: (key: keyof AllocationConfig, driver: AllocationDriver) => void;
}) {
  const entries: { key: keyof AllocationConfig; label: string; desc: string }[] = [
    { key: 'equipment', label: '设备折旧', desc: '设备折旧年额在各线束间的分摊方式' },
    { key: 'rnd', label: '研发费用', desc: '研发/试验费的分摊方式' },
    { key: 'indirectLabor', label: '间接人工', desc: '间接人工费的分摊方式' },
    { key: 'management', label: '管理费', desc: '"direct"表示各线束独立计算管理费，其他值表示按驱动因子分配总额' },
  ];

  return (
    <div style={{ marginTop: 16 }}>
      <Card className="glass-card" title="间接费用分摊配置" headerLine={false}>
        <div style={{ display: 'grid', gap: 16 }}>
          {entries.map(({ key, label, desc }) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ minWidth: 100 }}>
                <Text strong style={{ fontSize: 14 }}>{label}</Text>
                <div><Text type="quaternary" style={{ fontSize: 12 }}>{desc}</Text></div>
              </div>
              <Select
                value={allocationConfig[key]}
                onChange={(v: any) => updateAllocationDriver(key, v)}
                optionList={ALLOCATION_DRIVER_OPTIONS}
                style={{ width: 200 }}
              />
              <Tag color={allocationConfig[key] === 'direct' ? 'blue' : 'green'}>
                {ALLOCATION_DRIVER_OPTIONS.find(o => o.value === allocationConfig[key])?.label}
              </Tag>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ── Level 1 Coefficients Panel ──
function Level1CoefficientsPanel({ coefficients, setCoefficients, resetCoefficients }: {
  coefficients: { materialRatio: number; laborRatio: number; mfgRatio: number; packagingRatio: number; freightRatio: number };
  setCoefficients: (c: typeof coefficients) => void;
  resetCoefficients: () => void;
}) {
  const entries: { key: keyof typeof coefficients; label: string; desc: string }[] = [
    { key: 'materialRatio', label: '材料占比', desc: '材料成本占参考总价的比例' },
    { key: 'laborRatio', label: '人工占比', desc: '直接人工占参考总价的比例' },
    { key: 'mfgRatio', label: '制造占比', desc: '制造费用占参考总价的比例' },
    { key: 'packagingRatio', label: '包装占比', desc: '包装费占参考总价的比例' },
    { key: 'freightRatio', label: '运输占比', desc: '运输费占参考总价的比例' },
  ];

  const total = Object.values(coefficients).reduce((s, v) => s + v, 0);

  return (
    <div style={{ marginTop: 16 }}>
      <Card className="glass-card" title="Level 1 系数近似参数" headerLine={false}
        headerExtraContent={
          <Button size="small" theme="light" onClick={resetCoefficients}>恢复默认</Button>
        }
      >
        <Text type="quaternary" style={{ display: 'block', marginBottom: 16, fontSize: 13 }}>
          当线束仅有参考总价（无BOM/无工时）时，使用这些系数将总价分解为各成本项。系数之和应接近 1.0（剩余部分归入管理费和利润）。
        </Text>
        <Row gutter={[16, 16]}>
          {entries.map(({ key, label, desc }) => (
            <Col span={8} key={key}>
              <Text strong style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>{label}</Text>
              <InputNumber
                value={coefficients[key]}
                step={0.01}
                min={0}
                max={1}
                style={{ width: '100%' }}
                onChange={(v: any) => setCoefficients({ ...coefficients, [key]: Number(v) })}
              />
              <Text type="quaternary" style={{ fontSize: 12 }}>{desc}</Text>
            </Col>
          ))}
          <Col span={8}>
            <Text strong style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>系数合计</Text>
            <div className='glass-card' style={{   }}>
              <Text style={{ fontSize: 16, color: total > 1 ? 'var(--semi-color-danger)' : 'var(--semi-color-success)' }}>
                {total.toFixed(4)}
              </Text>
              {total > 1 && <Tag color="red" size="small" style={{ marginLeft: 8 }}>超过 1.0</Tag>}
            </div>
            <Text type="quaternary" style={{ fontSize: 12 }}>剩余 {Math.max(0, 1 - total).toFixed(4)} 归入管理费 + 利润</Text>
          </Col>
        </Row>
      </Card>
    </div>
  );
}

// ── BOM Classification Rules Panel ──

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  wire: { label: '线缆', color: 'blue' },
  connector: { label: '连接器', color: 'green' },
  terminal: { label: '端子', color: 'orange' },
  ipt_terminal: { label: 'IPT端子', color: 'purple' },
  bracket_rubber: { label: '支架/橡胶件', color: 'cyan' },
  tape_tube: { label: '胶带/波纹管', color: 'teal' },
  other: { label: '其他', color: 'grey' },
};

const MATCH_FIELD_OPTIONS = [
  { value: 'partName', label: '零件名称' },
  { value: 'partNo', label: '零件号' },
  { value: 'spec', label: '规格' },
  { value: 'itemCategory', label: '品类' },
];

function BomClassificationPanel({ rules, setRules }: {
  rules: BomClassificationRule[];
  setRules: (rules: BomClassificationRule[]) => void;
}) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<BomClassificationRule | null>(null);
  const [showAddRow, setShowAddRow] = useState(false);
  const [newRule, setNewRule] = useState<BomClassificationRule>({
    category: 'other',
    patterns: [],
    matchFields: ['partName', 'itemCategory'],
    priority: 10,
  });

  const handleReset = () => {
    setRules([...DEFAULT_CLASSIFICATION_RULES]);
    Toast.success('已恢复默认规则');
  };

  const handleDelete = (index: number) => {
    const newRules = [...rules];
    newRules.splice(index, 1);
    setRules(newRules);
    Toast.success('规则已删除');
  };

  const handleStartEdit = (index: number) => {
    setEditingIndex(index);
    setEditForm({ ...rules[index] } as BomClassificationRule);
  };

  const handleSaveEdit = () => {
    if (editingIndex !== null && editForm) {
      const newRules = [...rules];
      newRules[editingIndex] = editForm;
      setRules(newRules);
      setEditingIndex(null);
      setEditForm(null);
      Toast.success('规则已更新');
    }
  };

  const handleAdd = () => {
    if (newRule.patterns.length === 0) {
      Toast.warning('请输入至少一个匹配模式');
      return;
    }
    setRules([...rules, newRule]);
    setNewRule({
      category: 'other',
      patterns: [],
      matchFields: ['partName', 'itemCategory'],
      priority: 10,
    });
    setShowAddRow(false);
    Toast.success('规则已添加');
  };

  const columns = [
    {
      title: '类别',
      dataIndex: 'category',
      width: 150,
      render: (text: string, _record: any, index: number) => {
        const isEditing = editingIndex === index;
        if (isEditing && editForm) {
          return (
            <Select
              value={editForm.category}
              onChange={(v: any) => setEditForm({ ...editForm, category: v })}
              style={{ width: '100%' }}
            >
              {Object.entries(CATEGORY_LABELS).map(([value, { label, color }]) => (
                <Select.Option key={value} value={value}>
                  <Tag color={color as any}>{label}</Tag>
                </Select.Option>
              ))}
            </Select>
          );
        }
        const cfg = CATEGORY_LABELS[text] ?? CATEGORY_LABELS.other;
        return <Tag color={(cfg?.color ?? 'grey') as any}>{cfg?.label ?? text}</Tag>;
      },
    },
    {
      title: '匹配模式 (正则)',
      dataIndex: 'patterns',
      render: (patterns: string[], _record: any, index: number) => {
        const isEditing = editingIndex === index;
        if (isEditing && editForm) {
          return (
            <Input
              value={editForm.patterns.join(', ')}
              placeholder="多个模式用逗号分隔"
              onChange={(v) => setEditForm({ ...editForm, patterns: v.split(',').map(s => s.trim()).filter(Boolean) })}
            />
          );
        }
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {patterns.map((p, i) => <Tag key={i} color="white" style={{ border: '1px solid var(--semi-color-border)' }}>{p}</Tag>)}
          </div>
        );
      },
    },
    {
      title: '排除模式',
      dataIndex: 'excludePatterns',
      render: (excludes: string[] | undefined, _record: any, index: number) => {
        const isEditing = editingIndex === index;
        if (isEditing && editForm) {
          return (
            <Input
              value={(editForm.excludePatterns || []).join(', ')}
              placeholder="可选，逗号分隔"
              onChange={(v) => setEditForm({ ...editForm, excludePatterns: v.split(',').map(s => s.trim()).filter(Boolean) })}
            />
          );
        }
        if (!excludes || excludes.length === 0) return <Text type="quaternary">-</Text>;
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {excludes.map((p, i) => <Tag key={i} color="red">{p}</Tag>)}
          </div>
        );
      },
    },
    {
      title: '匹配字段',
      dataIndex: 'matchFields',
      width: 180,
      render: (fields: string[] | undefined, _record: any, index: number) => {
        const isEditing = editingIndex === index;
        if (isEditing && editForm) {
          return (
            <Select
              multiple
              value={editForm.matchFields || []}
              onChange={(v: any) => setEditForm({ ...editForm, matchFields: v })}
              optionList={MATCH_FIELD_OPTIONS}
              style={{ width: '100%' }}
            />
          );
        }
        const currentFields = fields || ['partName', 'itemCategory'];
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            {currentFields.map(f => (
              <Tag key={f} size="small" color="grey">
                {MATCH_FIELD_OPTIONS.find(o => o.value === f)?.label || f}
              </Tag>
            ))}
          </div>
        );
      },
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 100,
      render: (p: number, _record: any, index: number) => {
        const isEditing = editingIndex === index;
        if (isEditing && editForm) {
          return (
            <InputNumber
              value={editForm.priority}
              onChange={(v) => setEditForm({ ...editForm, priority: Number(v) })}
              style={{ width: '100%' }}
            />
          );
        }
        return <Text>{p ?? 0}</Text>;
      },
    },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 100,
      render: (_: any, _record: any, index: number) => {
        const isEditing = editingIndex === index;
        if (isEditing) {
          return (
            <div style={{ display: 'flex', gap: 4 }}>
              <Button icon={<IconSave />} size="small" theme="light" onClick={handleSaveEdit} />
              <Button icon={<IconClose />} size="small" theme="light" onClick={() => setEditingIndex(null)} />
            </div>
          );
        }
        return (
          <div style={{ display: 'flex', gap: 4 }}>
            <Button icon={<IconEdit />} size="small" theme="borderless" onClick={() => handleStartEdit(index)} />
            <Popconfirm title="确定删除此规则吗？" onConfirm={() => handleDelete(index)}>
              <Button icon={<IconDelete />} size="small" theme="borderless" type="danger" />
            </Popconfirm>
          </div>
        );
      },
    },
  ];

  return (
    <div style={{ marginTop: 16 }}>
      <Card className="glass-card"
        title="BOM分类规则配置"
        headerLine={false}
        headerExtraContent={
          <Button icon={<IconRefresh />} size="small" theme="light" onClick={handleReset}>
            恢复默认
          </Button>
        }
      >
        <div style={{ marginBottom: 12 }}>
          <Text type="secondary" style={{ fontSize: 13 }}>
            系统通过以下规则自动判断BOM中的零件分类（如线缆、连接器等）。
            规则按优先级从高到低匹配。匹配字段支持正则表达式。
          </Text>
        </div>

        <Table
          columns={columns}
          dataSource={rules}
          pagination={false}
          size="small"
          rowKey={(record) => `${record?.category}-${rules.indexOf(record!)}`}
        />

        {showAddRow ? (
          <Card className="glass-card"
            style={{ marginTop: 16, backgroundColor: 'var(--semi-color-fill-0)' }}
            bodyStyle={{ padding: 16 }}
          >
            <Title heading={6} style={{ marginBottom: 12 }}>添加新规则</Title>
            <Row gutter={16}>
              <Col span={4}>
                <Text strong style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>类别</Text>
                <Select
                  value={newRule.category}
                  onChange={(v: any) => setNewRule({ ...newRule, category: v })}
                  style={{ width: '100%' }}
                >
                  {Object.entries(CATEGORY_LABELS).map(([value, { label, color }]) => (
                    <Select.Option key={value} value={value}>
                      <Tag color={color as any}>{label}</Tag>
                    </Select.Option>
                  ))}
                </Select>
              </Col>
              <Col span={6}>
                <Text strong style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>匹配模式 (正则, 逗号分隔)</Text>
                <Input
                  value={newRule.patterns.join(', ')}
                  placeholder="如: ^wire$, 导线"
                  onChange={(v) => setNewRule({ ...newRule, patterns: v.split(',').map(s => s.trim()).filter(Boolean) })}
                />
              </Col>
              <Col span={6}>
                <Text strong style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>排除模式 (正则, 逗号分隔)</Text>
                <Input
                  value={(newRule.excludePatterns || []).join(', ')}
                  onChange={(v) => setNewRule({ ...newRule, excludePatterns: v.split(',').map(s => s.trim()).filter(Boolean) })}
                />
              </Col>
              <Col span={5}>
                <Text strong style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>匹配字段</Text>
                <Select
                  multiple
                  value={newRule.matchFields || []}
                  onChange={(v: any) => setNewRule({ ...newRule, matchFields: v })}
                  optionList={MATCH_FIELD_OPTIONS}
                  style={{ width: '100%' }}
                />
              </Col>
              <Col span={3}>
                <Text strong style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>优先级</Text>
                <InputNumber
                  value={newRule.priority}
                  onChange={(v) => setNewRule({ ...newRule, priority: Number(v) })}
                  style={{ width: '100%' }}
                />
              </Col>
            </Row>
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button onClick={() => setShowAddRow(false)}>取消</Button>
              <Button theme="solid" type="primary" onClick={handleAdd}>确认添加</Button>
            </div>
          </Card>
        ) : (
          <Button
            icon={<IconPlus />}
            theme="light"
            style={{ marginTop: 12 }}
            onClick={() => setShowAddRow(true)}
          >
            添加分类规则
          </Button>
        )}
      </Card>
    </div>
  );
}
