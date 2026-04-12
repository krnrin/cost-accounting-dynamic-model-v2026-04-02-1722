import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Typography,
  Button,
  Row,
  Col,
  Input,
  InputNumber,
  Space,
  Toast,
  Tag,
  Divider,
  Popconfirm,
  Popover,
  Slider,
  Tooltip,
} from '@douyinfe/semi-ui';
import { IconArrowLeft, IconSave, IconClose, IconUpload, IconSetting, IconBox, IconPulse, IconAlertTriangle, IconTickCircle } from '@douyinfe/semi-icons';
import { useLiveQuery } from 'dexie-react-hooks';
import { RoleGuard } from '@/components/RoleGuard';

import { db } from '@/data/db';
import type { ScenarioRecord } from '@/data/db';
import { computeHarnessCostDynamic, computeHarnessCost, getInternalFactoryRates, computeInternalHarnessCost } from '@/engine/harness_costing';
import { detectPrecisionLevel } from '@/engine/precision';
import type { HarnessInput, BomItem, WireItem, HarnessResult } from '@/types/harness';
import { BomImportDialog } from '@/components/BomImportDialog';
import { UniverSheet } from '@/components/UniverSheet';
import { usePricingStore } from '@/store/pricingStore';

const { Title, Text } = Typography;

const BLANK_HARNESS: HarnessInput = {
  harnessId: '',
  harnessName: '',
  vehicleRatio: 1,
  bom: [],
  frontHours: 0,
  backHours: 0,
  packaging: { 
    innerBoxCost: 0, outerBoxCost: 0, palletCost: 0, 
    trayDividerCost: 0, bubbleWrapCost: 0, labelCost: 0, 
    subtotal: 0 
  },
  freight: { freight: 0, excessFreight: 0, shortHaul: 0, thirdPartyWarehouse: 0, storage: 0, subtotal: 0 },
};

const TOOLBAR_HEIGHT = 48;
const STATUS_BAR_HEIGHT = 36;

export default function HarnessEditPage() {
  const { id, sid, harnessId } = useParams<{ id: string; sid?: string; harnessId: string }>();
  const navigate = useNavigate();
  const isNew = harnessId === 'new';

  // 1. Data Loading
  const data = useLiveQuery(async () => {
    if (!id) return null;
    const project = await db.projects.get(id);
    // 加载场景配置（v7+ config 在 scenario 上，不在 project 上）
    const scenario = sid ? await db.scenarios.get(sid) : null;
    if (isNew) return { project, scenario, harness: null };
    if (!harnessId) return null;
    // 按 scenarioId 过滤，避免多场景同零件号冲突
    let harness;
    if (sid) {
      harness = await db.harnesses
        .where('[scenarioId+harnessId]')
        .equals([sid, harnessId])
        .first();
      // 兜底：查空 scenarioId 的遗留数据
      if (!harness) {
        harness = await db.harnesses
          .where({ projectId: id, harnessId })
          .filter(h => !h.scenarioId || h.scenarioId === '')
          .first();
      }
    } else {
      harness = await db.harnesses.where({ projectId: id, harnessId }).first();
    }
    return { project, scenario, harness: harness ?? null };
  }, [id, sid, harnessId]);

  // 2. Local State for Form
  const [formData, setFormData] = useState<HarnessInput | null>(null);
  const [initialData, setInitialData] = useState<string>('');
  const [inited, setInited] = useState(false);
  const [importVisible, setImportVisible] = useState(false);

  useEffect(() => {
    if (inited) return;
    if (isNew && data?.project) {
      const blank = JSON.parse(JSON.stringify(BLANK_HARNESS));
      setFormData(blank);
      setInitialData(JSON.stringify(blank));
      setInited(true);
    } else if (data?.harness?.input) {
      const input = JSON.parse(JSON.stringify(data.harness.input));
      setFormData(input);
      setInitialData(JSON.stringify(input));
      setInited(true);
    }
  }, [data, isNew, inited]);

  const isDirty = useMemo(() => {
    if (!formData) return false;
    return JSON.stringify(formData) !== initialData;
  }, [formData, initialData]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // 3. Cost Computation for Preview
  const { getPricingContext, simulation, updateSimulation, updateMetalPrices, metalPrices } = usePricingStore();
  const pricingContext = getPricingContext();

  const result: HarnessResult | null = useMemo(() => {
    if (!data?.project || !data?.scenario || !formData) return null;
    if (!formData.harnessId) return null;
    const cfg = data.scenario.config;

    if (pricingContext) {
      // 注入动态工厂费率 (Issue #45)
      return computeHarnessCostDynamic(formData, pricingContext, cfg.factories?.[0]?.factoryId || 'K1K2_Factory');
    }

    return computeHarnessCost(
      formData,
      cfg.costRates,
      cfg.metalPrices
    );
  }, [data, formData, pricingContext]);

  const internalResult = useMemo(() => {
    if (!data?.project || !data?.scenario || !formData || !pricingContext) return null;
    if (!formData.harnessId) return null;
    const cfg = data.scenario.config;

    const rates = getInternalFactoryRates(cfg.factories?.[0]?.factoryId || 'K1K2_Factory', pricingContext.benchmark, pricingContext.simulation);
    return computeInternalHarnessCost(formData, rates, pricingContext.metalPrices, null, pricingContext.benchmark.audit_trace_id);
  }, [data, formData, pricingContext]);

  if (!data?.project || !formData) {
    return (
      <div style={{ padding: 100, textAlign: 'center' }}>
        <Title heading={4}>正在加载数据...</Title>
      </div>
    );
  }

  // 4. Handlers
  const handleSave = async () => {
    if (!id || !formData) return;

    if (!formData.harnessId.trim()) {
      Toast.warning('请填写零件号');
      return;
    }

    try {
      if (isNew) {
        const newId = crypto.randomUUID();
        await db.harnesses.put({
          id: newId,
          projectId: id,
          scenarioId: sid || '',
          eopYear: null,
          harnessId: formData.harnessId,
          harnessName: formData.harnessName || formData.harnessId,
          input: formData,
          updatedAt: new Date().toISOString(),
        });
        Toast.success('线束创建成功');
        navigate(`/project/${id}/harness/${formData.harnessId}`, { replace: true });
      } else {
        if (!data.harness) return;
        await db.harnesses.update(data.harness.id, {
          input: formData,
          harnessName: formData.harnessName,
          updatedAt: new Date().toISOString(),
        });
        Toast.success('保存成功');
        setInitialData(JSON.stringify(formData));
      }
    } catch (error) {
      console.error('Save failed:', error);
      Toast.error('保存失败');
    }
  };

  const updateFormData = (patch: Partial<HarnessInput>) => {
    setFormData(prev => prev ? { ...prev, ...patch } : null);
  };

  const updatePackaging = (patch: Partial<HarnessInput['packaging']>) => {
    setFormData(prev => prev ? { ...prev, packaging: { ...prev.packaging, ...patch } } : null);
  };

  const updateFreight = (patch: Partial<HarnessInput['freight']>) => {
    setFormData(prev => prev ? { ...prev, freight: { ...prev.freight, ...patch } } : null);
  };

  const handleImportBom = (newBom: (BomItem | WireItem)[]) => {
    setFormData(prev => prev ? { ...prev, bom: newBom } : null);
  };

  // 6. Univer BOM conversions
  // Column layout mirrors BOM Excel: engineering columns first, costing columns after
  // 序号 | 功能 | 零件号 | 零件名称 | 半成品 | SAP物料号 | 规格 | 数量 | 单位 | 供应商 | 分类 | 单价(元) | 金额(元) | 铜重(kg) | 铝重(kg) | 非金属成本(元)
  const BOM_HEADERS = [
    '序号', '功能', '零件号', '零件名称', '半成品',
    'SAP物料号', '规格', '数量', '单位', '供应商',
    '分类', '单价(元)', '金额(元)', '铜重(kg)', '铝重(kg)', '非金属成本(元)',
  ];

  const bomToArray = (bom: (BomItem | WireItem)[]): (string | number | null)[][] => {
    const rows = bom.map((item, index) => [
      index + 1,                                          // 0: 序号
      item.functionText || item.endGroup || '',           // 1: 功能
      item.partNo,                                        // 2: 零件号
      item.partName,                                      // 3: 零件名称
      item.isSemiFinished ? 'Y' : 'N',                   // 4: 半成品
      item.sapNo || '',                                   // 5: SAP物料号
      item.spec || '',                                    // 6: 规格
      item.qty,                                           // 7: 数量
      item.unit,                                          // 8: 单位
      item.supplier || '',                                // 9: 供应商
      item.itemCategory,                                  // 10: 分类
      item.unitPrice,                                     // 11: 单价
      item.amount,                                        // 12: 金额
      (item as WireItem).copperWeightPerUnit || 0,        // 13: 铜重
      (item as WireItem).aluminumWeightPerUnit || 0,      // 14: 铝重
      (item as WireItem).nonMetalCostPerUnit || 0,        // 15: 非金属成本
    ]);
    return [BOM_HEADERS, ...rows];
  };

  const arrayToBom = (data: (string | number | null)[][]): (BomItem | WireItem)[] => {
    const rows = data.slice(1);
    return rows
      .filter(row => row.some((cell, i) => i > 0 && cell !== null && cell !== ''))
      .map(row => {
        const itemCategory = (row[10] as any) || 'other';
        const qty = Number(row[7] || 0);
        const unitPrice = Number(row[11] || 0);
        const semiFlag = String(row[4] || '').toUpperCase();

        const base: BomItem = {
          partNo: String(row[2] || ''),
          partName: String(row[3] || ''),
          itemCategory,
          spec: String(row[6] || ''),
          unit: String(row[8] || ''),
          qty,
          unitPrice,
          amount: Number((qty * unitPrice).toFixed(4)),
          functionText: String(row[1] || ''),
          sapNo: String(row[5] || ''),
          supplier: String(row[9] || ''),
          isSemiFinished: semiFlag === 'Y' || semiFlag === '是',
        };

        if (itemCategory === 'wire') {
          return {
            ...base,
            copperWeightPerUnit: Number(row[13] || 0),
            aluminumWeightPerUnit: Number(row[14] || 0),
            nonMetalCostPerUnit: Number(row[15] || 0),
          } as WireItem;
        }
        return base;
      });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* 1. Single-row Toolbar — all controls merged into one bar */}
      <div className="glass-panel" style={{ 
        height: TOOLBAR_HEIGHT, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        padding: '0 12px',
        borderBottom: '1px solid var(--border)',
        zIndex: 10
      }}>
        {/* Left: back + title */}
        <Space spacing={4}>
          <Button
            icon={<IconArrowLeft />}
            theme="borderless"
            size="small"
            onClick={() => isNew ? navigate(`/project/${id}`) : navigate(`/project/${id}/harness/${harnessId}`)}
          />
          <Text strong style={{ fontSize: 14 }}>
            {isNew ? '新建线束' : `${formData.harnessId} · ${formData.harnessName || ''}`}
          </Text>
          <Divider layout="vertical" style={{ margin: '0 4px' }} />
          {(() => {
            const level = detectPrecisionLevel(formData);
            if (level === 3) return <Tag size="small" color="green">B级</Tag>;
            if (level === 2) return <Tag size="small" color="orange">C级</Tag>;
            return <Tag size="small" color="red">D级</Tag>;
          })()}
        </Space>

        {/* Right: popover panels + action buttons */}
        <Space spacing={4}>
          {/* 基本信息 & 工时 — Popover */}
          <Popover
            trigger="click"
            position="bottomRight"
            showArrow
            content={
              <div style={{ padding: '12px 16px', width: 620 }}>
                <Text strong size="small" style={{ marginBottom: 8, display: 'block' }}>基本信息 & 工时</Text>
                <Row gutter={8}>
                  <Col span={5}>
                    <Text type="secondary" style={{ fontSize: 11 }}>零件号</Text>
                    <Input size="small" value={formData.harnessId} disabled={!isNew} onChange={val => isNew && updateFormData({ harnessId: val })} />
                  </Col>
                  <Col span={5}>
                    <Text type="secondary" style={{ fontSize: 11 }}>名称</Text>
                    <Input size="small" value={formData.harnessName} onChange={val => updateFormData({ harnessName: val })} />
                  </Col>
                  <Col span={4}>
                    <Text type="secondary" style={{ fontSize: 11 }}>装车比</Text>
                    <InputNumber size="small" value={formData.vehicleRatio} onChange={val => updateFormData({ vehicleRatio: Number(val) })} precision={3} style={{ width: '100%' }} />
                  </Col>
                  <Col span={5}>
                    <Text type="secondary" style={{ fontSize: 11 }}>前道工时(h)</Text>
                    <InputNumber size="small" value={formData.frontHours} onChange={val => updateFormData({ frontHours: Number(val) })} precision={6} style={{ width: '100%' }} />
                  </Col>
                  <Col span={5}>
                    <Text type="secondary" style={{ fontSize: 11 }}>后道工时(h)</Text>
                    <InputNumber size="small" value={formData.backHours} onChange={val => updateFormData({ backHours: Number(val) })} precision={6} style={{ width: '100%' }} />
                  </Col>
                </Row>
              </div>
            }
          >
            <Button icon={<IconSetting />} theme="borderless" size="small">基本信息</Button>
          </Popover>

          {/* 包装 & 运输费 — Popover */}
          <Popover
            trigger="click"
            position="bottomRight"
            showArrow
            content={
              <div style={{ padding: '12px 16px', width: 720 }}>
                <Row gutter={24}>
                  <Col span={12}>
                    <Text strong size="small" style={{ marginBottom: 8, display: 'block' }}>包装费</Text>
                    <Row gutter={6}>
                      <Col span={4}><Text type="secondary" style={{ fontSize: 11 }}>内盒</Text><InputNumber size="small" value={formData.packaging.innerBoxCost} onChange={val => updatePackaging({ innerBoxCost: Number(val) })} style={{ width: '100%' }} /></Col>
                      <Col span={4}><Text type="secondary" style={{ fontSize: 11 }}>外箱</Text><InputNumber size="small" value={formData.packaging.outerBoxCost} onChange={val => updatePackaging({ outerBoxCost: Number(val) })} style={{ width: '100%' }} /></Col>
                      <Col span={4}><Text type="secondary" style={{ fontSize: 11 }}>托盘</Text><InputNumber size="small" value={formData.packaging.palletCost} onChange={val => updatePackaging({ palletCost: Number(val) })} style={{ width: '100%' }} /></Col>
                      <Col span={4}><Text type="secondary" style={{ fontSize: 11 }}>隔板</Text><InputNumber size="small" value={formData.packaging.trayDividerCost} onChange={val => updatePackaging({ trayDividerCost: Number(val) })} style={{ width: '100%' }} /></Col>
                      <Col span={4}><Text type="secondary" style={{ fontSize: 11 }}>缓冲</Text><InputNumber size="small" value={formData.packaging.bubbleWrapCost} onChange={val => updatePackaging({ bubbleWrapCost: Number(val) })} style={{ width: '100%' }} /></Col>
                      <Col span={4}><Text type="secondary" style={{ fontSize: 11 }}>标签</Text><InputNumber size="small" value={formData.packaging.labelCost} onChange={val => updatePackaging({ labelCost: Number(val) })} style={{ width: '100%' }} /></Col>
                    </Row>
                  </Col>
                  <Col span={12}>
                    <Text strong size="small" style={{ marginBottom: 8, display: 'block' }}>运输费</Text>
                    <Row gutter={6}>
                      <Col span={6}><Text type="secondary" style={{ fontSize: 11 }}>运费</Text><InputNumber size="small" value={formData.freight.freight} onChange={val => updateFreight({ freight: Number(val) })} style={{ width: '100%' }} /></Col>
                      <Col span={6}><Text type="secondary" style={{ fontSize: 11 }}>超额运费</Text><InputNumber size="small" value={formData.freight.excessFreight} onChange={val => updateFreight({ excessFreight: Number(val) })} style={{ width: '100%' }} /></Col>
                      <Col span={4}><Text type="secondary" style={{ fontSize: 11 }}>短驳</Text><InputNumber size="small" value={formData.freight.shortHaul} onChange={val => updateFreight({ shortHaul: Number(val) })} style={{ width: '100%' }} /></Col>
                      <Col span={4}><Text type="secondary" style={{ fontSize: 11 }}>三方仓</Text><InputNumber size="small" value={formData.freight.thirdPartyWarehouse} onChange={val => updateFreight({ thirdPartyWarehouse: Number(val) })} style={{ width: '100%' }} /></Col>
                      <Col span={4}><Text type="secondary" style={{ fontSize: 11 }}>仓储</Text><InputNumber size="small" value={formData.freight.storage} onChange={val => updateFreight({ storage: Number(val) })} style={{ width: '100%' }} /></Col>
                    </Row>
                  </Col>
                </Row>
              </div>
            }
          >
            <Button icon={<IconBox />} theme="borderless" size="small">包装运输</Button>
          </Popover>

          <Divider layout="vertical" style={{ margin: '0 4px' }} />

          <Popover
            content={
              <div className="glass-card" style={{ padding: 12, width: 300, color: 'var(--text-primary)' }}>
                <Title heading={6} style={{ marginBottom: 12, color: 'var(--text-primary)' }}>内部实绩精算模拟 (决策舱)</Title>
                <Space vertical align="start" style={{ width: '100%' }}>
                  <div style={{ width: '100%' }}>
                    <Text type="secondary" style={{ color: 'var(--text-secondary)' }}>出勤工时效率 (基准: {(0.9 * 100).toFixed(0)}%)</Text>
                    <Slider 
                      step={0.01} min={0.5} max={1.2} 
                      value={simulation.efficiency} 
                      onChange={val => updateSimulation(Number(val), simulation.annualVolume, simulation.utilizationFactor)} 
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                      <Text size="small" style={{ color: '#fff' }}>{(simulation.efficiency * 100).toFixed(0)}%</Text>
                      <Tag color={simulation.efficiency >= 0.9 ? 'green' : 'red'} size="small">
                        {simulation.efficiency >= 0.9 ? '高于基准' : '低于基准'}
                      </Tag>
                    </div>
                  </div>

                  <Divider style={{ margin: '8px 0', opacity: 0.1 }} />
                  
                  <div style={{ width: '100%' }}>
                    <Text type="secondary" style={{ color: 'var(--text-secondary)' }}>年度产量预测 (LRP)</Text>
                    <InputNumber 
                      size="small" 
                      value={simulation.annualVolume} 
                      onChange={val => updateSimulation(simulation.efficiency, Number(val), simulation.utilizationFactor)} 
                      style={{ width: '100%', marginTop: 8 }}
                    />
                  </div>

                  <Divider style={{ margin: '8px 0', opacity: 0.1 }} />

                  <div style={{ width: '100%' }}>
                    <Text type="secondary" style={{ color: 'var(--text-secondary)' }}>自动化设备利用率 (基准: 85%)</Text>
                    <Slider 
                      step={0.05} min={0.4} max={1.0} 
                      value={simulation.utilizationFactor} 
                      onChange={val => updateSimulation(simulation.efficiency, simulation.annualVolume, Number(val))} 
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                      <Text size="small" style={{ color: '#fff' }}>{(simulation.utilizationFactor * 100).toFixed(0)}%</Text>
                      <Tag color={simulation.utilizationFactor >= 0.85 ? 'green' : 'red'} size="small">
                        {simulation.utilizationFactor >= 0.85 ? '高效运行' : '低负荷预警'}
                      </Tag>
                    </div>
                  </div>

                  <Divider style={{ margin: '8px 0', opacity: 0.1 }} />

                  <div style={{ width: '100%' }}>
                    <Text type="secondary" style={{ color: 'var(--text-secondary)' }}>金属行情实时穿透 (LME/SMM)</Text>
                    <Row gutter={8} style={{ marginTop: 8 }}>
                      <Col span={12}>
                        <Text size="small" style={{ color: '#fff' }}>铜 (Cu)</Text>
                        <InputNumber size="small" value={metalPrices.copper} onChange={val => updateMetalPrices(Number(val), metalPrices.aluminum)} prefix="¥" />
                      </Col>
                      <Col span={12}>
                        <Text size="small" style={{ color: '#fff' }}>铝 (Al)</Text>
                        <InputNumber size="small" value={metalPrices.aluminum} onChange={val => updateMetalPrices(metalPrices.copper, Number(val))} prefix="¥" />
                      </Col>
                    </Row>
                  </div>
                </Space>
              </div>
            }
          >
            <Button icon={<IconPulse />} theme="light" type="warning" size="small">模拟预演</Button>
          </Popover>

          <Divider layout="vertical" style={{ margin: '0 4px' }} />

          <RoleGuard field="bomEdit">
            <Button icon={<IconUpload />} size="small" onClick={() => setImportVisible(true)}>导入BOM</Button>
          </RoleGuard>
          
          {isDirty && (
            <Popconfirm
              title="放弃未保存的更改?"
              onConfirm={() => isNew ? navigate(`/project/${id}`) : navigate(`/project/${id}/harness/${harnessId}`)}
            >
              <Button icon={<IconClose />} theme="light" type="danger" size="small">放弃</Button>
            </Popconfirm>
          )}

          <RoleGuard field="bomEdit" readOnlyFallback>
            <Button icon={<IconSave />} type="primary" theme="solid" size="small" disabled={!isDirty} onClick={handleSave}>保存</Button>
          </RoleGuard>
        </Space>
      </div>

      {/* 3. Univer BOM Sheet — full width, no border for immersive Excel look */}
      <div style={{ flex: 1, position: 'relative' }}>
        <UniverSheet
          data={bomToArray(formData.bom)}
          onChange={newData => {
            const newBom = arrayToBom(newData);
            updateFormData({ bom: newBom });
          }}
          columnWidths={[45, 120, 160, 180, 55, 110, 160, 65, 50, 120, 80, 75, 85, 70, 70, 90]}
          height="100%"
          freezeRows={1}
          hideToolbar
        />
      </div>

      {/* 4. Status Bar */}
      <div style={{ 
        height: STATUS_BAR_HEIGHT, 
        backgroundColor: 'rgba(255, 255, 255, 0.85)', 
        backdropFilter: 'blur(16px)',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        fontSize: '12px',
        color: '#fff'
      }}>
        <Space spacing="medium">
          <Text type="secondary">BOM: <Text strong>{formData.bom.length}</Text> 项</Text>
          <Divider layout="vertical" />
          {result ? (
            <>
              <Text style={{ color: 'var(--text-secondary)' }}>材料: <Text strong style={{ color: 'var(--text-primary)', fontFamily: 'JetBrains Mono' }}>¥{result.materialCost.toFixed(2)}</Text></Text>
              <Text style={{ color: 'var(--text-secondary)' }}>人工: <Text strong style={{ color: 'var(--text-primary)', fontFamily: 'JetBrains Mono' }}>¥{result.directLabor.toFixed(2)}</Text></Text>
              <Text style={{ color: 'var(--text-secondary)' }}>制造: <Text strong style={{ color: 'var(--text-primary)', fontFamily: 'JetBrains Mono' }}>¥{result.manufacturing.toFixed(2)}</Text></Text>
              <Text style={{ color: 'var(--text-secondary)' }}>出厂: <Text strong style={{ color: 'var(--warning)', fontFamily: 'JetBrains Mono' }}>¥{result.exFactoryPrice.toFixed(2)}</Text></Text>
              <Text style={{ color: 'var(--text-secondary)' }}>到厂: <Text strong style={{ color: 'var(--danger)', fontFamily: 'JetBrains Mono' }}>¥{result.deliveredPrice.toFixed(2)}</Text></Text>
              
              {internalResult && (
                <>
                  <Divider layout="vertical" />
                  <Tooltip content={
                    <div>
                      <Text strong style={{ color: '#0f172a' }}>内部实绩精算 (Actual): ¥{internalResult.internalCost.toFixed(2)}</Text>
                      <br />
                      <Text size="small" style={{ color: 'var(--text-secondary)' }}>Audit Trace: {internalResult.auditTraceId || 'N/A'}</Text>
                    </div>
                  }>
                    <Tag 
                      color={internalResult.gapStatus === 'NORMAL' ? 'green' : 'red'} 
                      prefixIcon={internalResult.gapStatus === 'NORMAL' ? <IconTickCircle /> : <IconAlertTriangle />}
                    >
                      {internalResult.gapStatus === 'NORMAL' ? '利润达标' : '成本超支'}
                    </Tag>
                  </Tooltip>
                </>
              )}
            </>
          ) : (
            <Text>正在计算...</Text>
          )}
        </Space>
      </div>

      <BomImportDialog
        visible={importVisible}
        projectId={id!}
        harnessId={formData.harnessId}
        harnessName={formData.harnessName}
        existingBomItems={formData.bom}
        onClose={() => setImportVisible(false)}
        onImport={handleImportBom}
      />
    </div>
  );
}
