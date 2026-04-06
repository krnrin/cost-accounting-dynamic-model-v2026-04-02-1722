import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Typography, Spin, Button, Card, Table, Layout, Empty, Modal, Space, Toast, InputNumber, Row, Col, RadioGroup, Radio, Banner, Tag } from '@douyinfe/semi-ui';
import { IconArrowLeft, IconPlus, IconDownload, IconSend, IconUpload, IconDelete, IconCopy, IconSetting, IconEdit, IconEyeOpened } from '@douyinfe/semi-icons';
import ReactECharts from 'echarts-for-react/lib/core';
import echarts from '@/lib/echarts';

import { db } from '@/data/db';
import type { ProjectRecord } from '@/data/db';
import { 
  computeHarnessCost, 
  computeProjectFromHarnesses, 
  buildHarnessCostTable,
  computeInternalHarnessCost,
  computeInternalProjectFromHarnesses,
  INTERNAL_DEFAULTS
} from '@/engine/harness_costing';
import { exportInternalCostExcel } from '@/engine/excel_export';
import { downloadProjectPackage } from '@/engine/project_io';
import { validateAll, summarizeValidation } from '@/engine/consistency_check';
import type { ValidationResult, ValidationSeverity } from '@/engine/consistency_check';
import type { HarnessInput, HarnessResult, ProjectHarnessResult, InternalHarnessResult, InternalProjectResult } from '@/types/harness';
import type { CostRates } from '@/types/project';
import { useProjectStore } from '@/store/projectStore';
import { useSettingsStore } from '@/store/settingsStore';
import { VersionPanel } from '@/components/VersionPanel';
import { MultiImportDialog } from '@/components/MultiImportDialog';
import { AuditLogPanel } from '@/components/AuditLogPanel';
import KpiCard from '@/components/KpiCard';
import AlertBanner from '@/components/AlertBanner';
import { RoleGuard } from '@/components/RoleGuard';
import { usePermission, type PermissionField } from '@/hooks/usePermission';

const { Title, Text } = Typography;

/** Maps column keys to permission fields — columns requiring restricted access */
const COLUMN_PERMISSION_MAP: Record<string, PermissionField> = {
  mgmtFee: 'mgmtFee',
  profit: 'profit',
  profitRate: 'profitRate',
  mgmtRate: 'mgmtRate',
};

interface CostTableRow {
  id: string;
  harnessId: string;
  harnessName: string;
  vehicleRatio: number;
  materialCost: number;
  wasteCost: number;
  directLabor: number;
  manufacturing: number;
  mgmtFee: number;
  profit: number;
  exFactoryPrice: number;
  packSubtotal: number;
  freightSubtotal: number;
  deliveredPrice: number;
  isTotal?: boolean;
}

const ValidationPanel = ({ harnesses, costRates }: { harnesses: HarnessInput[]; costRates: CostRates }) => {
  const results = useMemo<ValidationResult[]>(() => {
    return validateAll(harnesses, costRates).sort((a, b) => {
      const order = { error: 0, warning: 1, info: 2 };
      return order[a.severity] - order[b.severity];
    });
  }, [harnesses, costRates]);

  const summary = useMemo(() => summarizeValidation(results), [results]);

  if (results.length === 0) {
    return (
      <Banner
        type="success"
        description="✓ 所有校验通过"
      />
    );
  }

  const columns = [
    { title: '规则编号', dataIndex: 'code', key: 'code', width: 100 },
    { 
      title: '级别', 
      dataIndex: 'severity', 
      key: 'severity', 
      width: 100,
      render: (sev: ValidationSeverity) => {
        const colors: Record<ValidationSeverity, 'red' | 'orange' | 'blue'> = {
          error: 'red',
          warning: 'orange',
          info: 'blue'
        };
        const labels: Record<ValidationSeverity, string> = {
          error: '错误',
          warning: '警告',
          info: '提示'
        };
        return <Tag color={colors[sev]}>{labels[sev]}</Tag>;
      }
    },
    { title: '目标', dataIndex: 'target', key: 'target', width: 150 },
    { title: '消息', dataIndex: 'message', key: 'message' },
    { title: '字段', dataIndex: 'field', key: 'field', width: 120 },
    { title: '实际值', dataIndex: 'actual', key: 'actual', width: 100 },
    { title: '期望值', dataIndex: 'expected', key: 'expected', width: 150 },
  ];

  return (
    <Space vertical align="start" style={{ width: '100%' }}>
      <Space spacing={12} style={{ marginBottom: 16 }}>
        <Tag color="red" type="light">{summary.errors} 错误</Tag>
        <Tag color="orange" type="light">{summary.warnings} 警告</Tag>
        <Tag color="blue" type="light">{summary.infos} 提示</Tag>
      </Space>
      <Table 
        columns={columns} 
        dataSource={results} 
        pagination={false} 
        size="small"
        style={{ width: '100%' }}
      />
    </Space>
  );
};

export default function DashboardPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isLoading, setCurrentProject, setLoading, projectName } = useProjectStore();
  const { defaultMetalPrices, alertThresholds, defaultAnnualDropRate } = useSettingsStore();
  const { can } = usePermission();

  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [mode, setMode] = useState<'customer' | 'internal'>('customer');
  const [computedResults, setComputedResults] = useState<HarnessResult[]>([]);
  const [summary, setSummary] = useState<ProjectHarnessResult | null>(null);
  const [internalResults, setInternalResults] = useState<InternalHarnessResult[]>([]);
  const [internalSummary, setInternalSummary] = useState<InternalProjectResult | null>(null);
  const [selectedHarnessIds, setSelectedHarnessIds] = useState<string[]>([]);
  const [showRateConfig, setShowRateConfig] = useState(false);
  const [showMultiImport, setShowMultiImport] = useState(false);
  const [harnessInputs, setHarnessInputs] = useState<HarnessInput[]>([]);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const projectData = await db.projects.get(id);
      if (projectData) {
        setProject(projectData);
        setCurrentProject(projectData.id, projectData.meta.projectName);

        const harnessRecords = await db.harnesses.where('projectId').equals(id).toArray();
        setHarnessInputs(harnessRecords.map(r => r.input));

        // Perform customer quote computation
        const results = harnessRecords.map(record => {
          const res = computeHarnessCost(
            record.input,
            projectData.config.costRates,
            projectData.config.metalPrices
          );
          (res as any).id = record.id;
          return res;
        });
        setComputedResults(results);
        setSummary(computeProjectFromHarnesses(results));

        // Perform internal cost computation
        const intResults = harnessRecords.map(record => {
          const res = computeInternalHarnessCost(
            record.input,
            projectData.config.internalRates || INTERNAL_DEFAULTS,
            projectData.config.metalPrices
          );
          (res as any).id = record.id;
          return res;
        });
        setInternalResults(intResults);
        setInternalSummary(computeInternalProjectFromHarnesses(intResults));
      }
    } catch (error) {
      console.error('Failed to load project data:', error);
    } finally {
      setLoading(false);
    }
  }, [id, setCurrentProject, setLoading]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleBatchDelete = () => {
    Modal.confirm({
      title: '确认批量删除',
      content: `确定要删除选中的 ${selectedHarnessIds.length} 条线束吗？此操作不可撤销。`,
      onOk: async () => {
        await db.harnesses.where('id').anyOf(selectedHarnessIds).delete();
        setSelectedHarnessIds([]);
        loadData();
        Toast.success(`已删除 ${selectedHarnessIds.length} 条线束`);
      },
    });
  };

  const handleBatchCopy = async () => {
    const records = await db.harnesses.where('id').anyOf(selectedHarnessIds).toArray();
    for (const record of records) {
      const cloned = JSON.parse(JSON.stringify(record));
      cloned.id = crypto.randomUUID();
      cloned.harnessId = cloned.harnessId + '-copy';
      cloned.harnessName = (cloned.harnessName || '') + ' (副本)';
      cloned.updatedAt = new Date().toISOString();
      await db.harnesses.add(cloned);
    }
    setSelectedHarnessIds([]);
    loadData();
    Toast.success(`成功复制 ${records.length} 条线束`);
  };

  const handleBatchExport = () => {
    const selectedResults = computedResults.filter(h => selectedHarnessIds.includes((h as any).id));
    if (selectedResults.length > 0) {
      const selectedSummary = computeProjectFromHarnesses(selectedResults);
      exportInternalCostExcel(
        selectedResults, 
        selectedSummary, 
        `线束明细_批量导出_${selectedResults.length}条`
      );
      Toast.success(`已导出 ${selectedResults.length} 条线束`);
      setSelectedHarnessIds([]);
    }
  };

  const tableData = useMemo(() => {
    if (mode === 'customer') {
      if (computedResults.length === 0) return { columns: [], rows: [], totals: {} };
      return buildHarnessCostTable(computedResults);
    } else {
      if (internalResults.length === 0) return { columns: [], rows: [], totals: {} };
      // 内部核算表格列
      const columns = [
        { key: 'harnessId', label: '零件号' },
        { key: 'harnessName', label: '名称' },
        { key: 'vehicleRatio', label: '装车比' },
        { key: 'materialCost', label: '材料成本' },
        { key: 'directLabor', label: '直接人工' },
        { key: 'mfgOverheadTotal', label: '制造费小计' },
        { key: 'packTotal', label: '包装运输' },
        { key: 'internalCost', label: '内部总成本' },
      ];
      const rows = internalResults.map(h => ({
        harnessId: h.harnessId,
        harnessName: h.harnessName,
        vehicleRatio: h.vehicleRatio,
        materialCost: h.materialCost,
        directLabor: h.directLabor,
        mfgOverheadTotal: h.mfgOverheadTotal,
        packTotal: h.packTotal,
        internalCost: h.internalCost,
      }));
      const totals = {
        harnessId: '加权合计',
        harnessName: '',
        vehicleRatio: '',
        materialCost: internalSummary?.weightedMaterial,
        directLabor: internalSummary?.weightedDirectLabor,
        mfgOverheadTotal: internalSummary?.weightedMfgOverheadTotal,
        packTotal: internalSummary?.weightedPack,
        internalCost: internalSummary?.vehicleCost,
      };
      return { columns, rows, totals };
    }
  }, [mode, computedResults, internalResults, internalSummary]);

  const annualDropRate = project?.config.annualDropRate ?? defaultAnnualDropRate ?? 0.03;

  const weightedMetalCost = useMemo(() => {
    return computedResults.reduce((acc, h) => acc + (h.materialBreakdown?.totalMetalCost || 0) * (h.vehicleRatio || 0), 0);
  }, [computedResults]);

  const lifecycleData = useMemo(() => {
    const currentSummary = mode === 'customer' ? summary : (internalSummary as any);
    if (!currentSummary) return null;
    const years = [1, 2, 3, 4, 5, 6, 7];
    const totalCosts = years.map(y => currentSummary.vehicleCost * Math.pow(1 - annualDropRate, y - 1));
    const materialCosts = years.map(y => currentSummary.weightedMaterial * Math.pow(1 - annualDropRate, y - 1));
    return { years, totalCosts, materialCosts };
  }, [summary, internalSummary, mode, annualDropRate]);

  const chartOptions = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)',
    },
    legend: {
      orient: 'vertical',
      left: 'left',
      textStyle: { color: 'var(--semi-color-text-2)' },
    },
    series: [
      {
        name: '成本结构',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: 'var(--semi-color-bg-1)',
          borderWidth: 2,
        },
        label: {
          show: false,
          position: 'center',
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 16,
            fontWeight: 'bold',
            color: 'var(--semi-color-text-0)',
          },
        },
        labelLine: {
          show: false,
        },
        data: mode === 'customer' ? [
          { value: summary?.weightedMaterial || 0, name: '材料成本' },
          { value: summary?.weightedWaste || 0, name: '废品' },
          { value: summary?.weightedLabor || 0, name: '直接人工' },
          { value: summary?.weightedMfg || 0, name: '制造费' },
          ...(can('mgmtFee') ? [{ value: summary?.weightedMgmtFee || 0, name: '管理费' }] : []),
          ...(can('profit') ? [{ value: summary?.weightedProfit || 0, name: '利润' }] : []),
          { value: summary?.weightedPack || 0, name: '包装费' },
          { value: summary?.weightedFreight || 0, name: '运输费' },
        ] : [
          { value: internalSummary?.weightedMaterial || 0, name: '材料成本' },
          { value: internalSummary?.weightedDirectLabor || 0, name: '直接人工' },
          { value: internalSummary?.weightedIndirectLabor || 0, name: '间接人工' },
          { value: internalSummary?.plantAllocation || 0, name: '厂房分摊' },
          { value: internalSummary?.consumables || 0, name: '机物料消耗' },
          { value: internalSummary?.otherMfg || 0, name: '其他制造' },
          { value: internalSummary?.weightedMaterialWaste || 0, name: '材料损耗' },
          { value: internalSummary?.weightedLowValueConsumables || 0, name: '低值易耗' },
          { value: internalSummary?.autoWarehouse || 0, name: '自动化仓' },
          { value: internalSummary?.weightedPack || 0, name: '包装运输' },
        ],
      },
    ],
  };

  const lifecycleChartOptions = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        let res = `${params[0].name}<br/>`;
        params.forEach((item: any) => {
          res += `${item.marker} ${item.seriesName}: ¥${item.value.toFixed(2)}<br/>`;
        });
        return res;
      }
    },
    legend: {
      data: [mode === 'customer' ? '到厂总成本' : '内部总成本', '材料成本趋势'],
      textStyle: { color: 'var(--semi-color-text-2)' },
      bottom: 0
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '12%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: lifecycleData?.years.map(y => `Year ${y}`) || [],
      axisLabel: { color: 'var(--semi-color-text-2)' }
    },
    yAxis: {
      type: 'value',
      name: '元/车',
      axisLabel: { color: 'var(--semi-color-text-2)' },
      splitLine: { lineStyle: { color: 'var(--semi-color-border)' } }
    },
    series: [
      {
        name: mode === 'customer' ? '到厂总成本' : '内部总成本',
        type: 'line',
        data: lifecycleData?.totalCosts || [],
        smooth: true,
        lineStyle: { width: 3, color: '#5470c6' },
        itemStyle: { color: '#5470c6' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [{ offset: 0, color: 'rgba(84,112,198,0.3)' }, { offset: 1, color: 'rgba(84,112,198,0)' }]
          }
        }
      },
      {
        name: '材料成本趋势',
        type: 'line',
        data: lifecycleData?.materialCosts || [],
        smooth: true,
        lineStyle: { width: 2, type: 'dashed', color: '#91cc75' },
        itemStyle: { color: '#91cc75' }
      }
    ]
  };

  const harnessDistributionOption = useMemo(() => {
    const data = mode === 'customer' 
      ? computedResults.map(h => ({
          value: parseFloat((h.deliveredPrice * h.vehicleRatio).toFixed(2)),
          name: h.harnessName || h.harnessId,
          harnessId: h.harnessId,
        }))
      : internalResults.map(h => ({
          value: parseFloat((h.internalCost * h.vehicleRatio).toFixed(2)),
          name: h.harnessName || h.harnessId,
          harnessId: h.harnessId,
        }));

    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'item', formatter: '{b}: ¥{c} ({d}%)' },
      legend: { 
        orient: 'vertical', 
        right: 10, 
        top: 'center',
        textStyle: { color: 'var(--semi-color-text-2)' }
      },
      series: [{
        name: '线束成本',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: { 
          borderRadius: 10, 
          borderColor: 'var(--semi-color-bg-1)', 
          borderWidth: 2 
        },
        label: { show: false },
        emphasis: { 
          label: { 
            show: true, 
            fontSize: 14, 
            fontWeight: 'bold',
            color: 'var(--semi-color-text-0)'
          } 
        },
        data,
      }],
    };
  }, [mode, computedResults, internalResults]);

  const handleHarnessChartClick = useCallback((params: any) => {
    const harnessId = params.data?.harnessId;
    if (harnessId) {
      navigate(`/project/${id}/harness/${harnessId}`);
    }
  }, [navigate, id]);

  const columns: any[] = tableData.columns
    .filter(col => {
      const requiredPerm = COLUMN_PERMISSION_MAP[col.key];
      return !requiredPerm || can(requiredPerm);
    })
    .map(col => ({
      title: col.label,
      dataIndex: col.key,
      key: col.key,
      render: (text: any) => {
        if (typeof text === 'number' && col.key !== 'vehicleRatio' && col.key !== 'harnessId') {
          return `¥${text.toFixed(2)}`;
        }
        return text;
      },
    }));

  // Append action column with Edit / Detail buttons
  columns.push({
    title: '操作',
    dataIndex: '_action',
    key: '_action',
    fixed: 'right' as const,
    width: 180,
    render: (_: any, record: any) => {
      if (record.isTotal) return null;
      return (
        <Space>
          <Button
            icon={<IconEdit />}
            theme="solid"
            type="primary"
            size="small"
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              navigate(`/project/${id}/harness/${record.harnessId}/edit`);
            }}
          >
            编辑
          </Button>
          <Button
            icon={<IconEyeOpened />}
            theme="light"
            size="small"
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              navigate(`/project/${id}/harness/${record.harnessId}`);
            }}
          >
            详情
          </Button>
        </Space>
      );
    },
  });

  const dataSource = useMemo(() => {
    const results = mode === 'customer' ? computedResults : internalResults;
    const rows = tableData.rows.map((row, index) => ({
      ...row,
      id: (results[index] as any)?.id
    }));
    return [
      ...rows,
      { ...tableData.totals, isTotal: true, id: 'total' }
    ] as CostTableRow[];
  }, [tableData, mode, computedResults, internalResults]);

  const handleRateChange = async (field: string, value: number) => {
    if (!project || !id) return;
    const updated = {
      ...project,
      config: {
        ...project.config,
        costRates: { ...project.config.costRates, [field]: value },
      },
    };
    await db.projects.put(updated);
    setProject(updated);
    // Re-compute
    const harnessRecords = await db.harnesses.where('projectId').equals(id).toArray();
    
    const results = harnessRecords.map(record => {
      const res = computeHarnessCost(record.input, updated.config.costRates, updated.config.metalPrices);
      (res as any).id = record.id;
      return res;
    });
    setComputedResults(results);
    setSummary(computeProjectFromHarnesses(results));

    const intResults = harnessRecords.map(record => {
      const res = computeInternalHarnessCost(record.input, updated.config.internalRates || INTERNAL_DEFAULTS, updated.config.metalPrices);
      (res as any).id = record.id;
      return res;
    });
    setInternalResults(intResults);
    setInternalSummary(computeInternalProjectFromHarnesses(intResults));
  };

  const handleMetalChange = async (field: string, value: number) => {
    if (!project || !id) return;
    const updated = {
      ...project,
      config: {
        ...project.config,
        metalPrices: { ...project.config.metalPrices, [field]: value },
      },
    };
    await db.projects.put(updated);
    setProject(updated);
    
    const harnessRecords = await db.harnesses.where('projectId').equals(id).toArray();
    
    const results = harnessRecords.map(record => {
      const res = computeHarnessCost(record.input, updated.config.costRates, updated.config.metalPrices);
      (res as any).id = record.id;
      return res;
    });
    setComputedResults(results);
    setSummary(computeProjectFromHarnesses(results));

    const intResults = harnessRecords.map(record => {
      const res = computeInternalHarnessCost(record.input, updated.config.internalRates || INTERNAL_DEFAULTS, updated.config.metalPrices);
      (res as any).id = record.id;
      return res;
    });
    setInternalResults(intResults);
    setInternalSummary(computeInternalProjectFromHarnesses(intResults));
  };

  // Early return MUST be after ALL hooks to avoid "Rendered more hooks" error
  if (isLoading || !project) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 120 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <Layout className="page-container">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '24px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button
            icon={<IconArrowLeft />}
            aria-label="返回"
            theme="borderless"
            onClick={() => navigate('/')}
          />
          <Title heading={3} style={{ margin: 0 }}>
            {projectName || '项目仪表盘'}
          </Title>
          <RadioGroup 
            type="button" 
            value={mode} 
            onChange={(e) => setMode(e.target.value as any)}
            style={{ marginLeft: 16 }}
          >
            <Radio value="customer">客户报价</Radio>
            <RoleGuard field="internalCost">
              <Radio value="internal">内部核算</Radio>
            </RoleGuard>
          </RadioGroup>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            icon={<IconSend />}
            theme="light"
            onClick={() => navigate(`/project/${id}/quote`)}
          >
            报价工作台
          </Button>
          <Button
            icon={<IconDownload />}
            theme="light"
            onClick={() => {
              if (id) downloadProjectPackage(id);
            }}
          >
            导出项目包
          </Button>
          <Button
            icon={<IconDownload />}
            theme="light"
            onClick={() => {
              if (summary) exportInternalCostExcel(computedResults, summary, projectName || '项目');
            }}
          >
            导出 Excel
          </Button>
          <Button
            theme="solid"
            type="secondary"
            onClick={() => navigate(`/project/${id}/bom-workbook`)}
          >
            BOM工作簿
          </Button>
          <Button
            icon={<IconUpload />}
            theme="light"
            onClick={() => setShowMultiImport(true)}
          >
            Excel 一键导入
          </Button>
          <Button icon={<IconSetting />} onClick={() => setShowRateConfig(!showRateConfig)}>
            费率配置
          </Button>
          <Button
            icon={<IconPlus />}
            theme="solid"
            type="primary"
            onClick={() => navigate(`/project/${id}/harness/new/edit`)}
          >
            添加线束
          </Button>
        </div>
      </div>

      {showRateConfig && project && (
        <RoleGuard field="costRates" readOnlyFallback>
          <Card title="项目费率配置" className="glass-card" style={{ marginBottom: 16 }}>
            <Row gutter={[12, 12]}>
              <Col span={4}>
                <Text strong style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>人工费率 (元/h)</Text>
                <InputNumber 
                  value={project.config.costRates.laborRate} 
                  step={0.01} 
                  style={{ width: '100%' }}
                  onChange={(v) => handleRateChange('laborRate', Number(v))}
                />
              </Col>
              <Col span={4}>
                <Text strong style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>制造费率 (元/h)</Text>
                <InputNumber 
                  value={project.config.costRates.mfgRate} 
                  step={0.01} 
                  style={{ width: '100%' }}
                  onChange={(v) => handleRateChange('mfgRate', Number(v))}
                />
              </Col>
              <Col span={4}>
                <Text strong style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>废品率</Text>
                <InputNumber 
                  value={project.config.costRates.wasteRate} 
                  step={0.001} 
                  style={{ width: '100%' }}
                  onChange={(v) => handleRateChange('wasteRate', Number(v))}
                />
              </Col>
              <Col span={4}>
                <Text strong style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>管理费率</Text>
                <InputNumber 
                  value={project.config.costRates.mgmtRate} 
                  step={0.001} 
                  style={{ width: '100%' }}
                  onChange={(v) => handleRateChange('mgmtRate', Number(v))}
                />
              </Col>
              <Col span={4}>
                <Text strong style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>利润率</Text>
                <InputNumber 
                  value={project.config.costRates.profitRate} 
                  step={0.0001} 
                  style={{ width: '100%' }}
                  onChange={(v) => handleRateChange('profitRate', Number(v))}
                />
              </Col>
              <Col span={4}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <Text strong style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>铜价 (元/吨)</Text>
                    <InputNumber 
                      value={project.config.metalPrices.copper} 
                      step={100} 
                      style={{ width: '100%' }}
                      onChange={(v) => handleMetalChange('copper', Number(v))}
                    />
                  </div>
                </div>
              </Col>
              <Col span={4}>
                <Text strong style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>铝价 (元/吨)</Text>
                <InputNumber 
                  value={project.config.metalPrices.aluminum} 
                  step={100} 
                  style={{ width: '100%' }}
                  onChange={(v) => handleMetalChange('aluminum', Number(v))}
                />
              </Col>
            </Row>
          </Card>
        </RoleGuard>
      )}

      <AlertBanner 
        projectId={id!}
        currentPrices={defaultMetalPrices}
        basePrices={project.config.metalPrices}
        thresholds={alertThresholds}
      />

      {computedResults.length === 0 ? (
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, borderRadius: 8, marginTop: 24 }}>
          <Empty title="暂无线束数据" description="开始添加项目下的第一个线束" />
          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
             <Button
              icon={<IconPlus />}
              theme="solid"
              type="primary"
              onClick={() => navigate(`/project/${id}/harness/new/edit`)}
            >
              添加线束
            </Button>
            <Button
              icon={<IconUpload />}
              theme="light"
              onClick={() => navigate(`/project/${id}/harness/new/edit`)}
            >
              导入BOM
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* Section 1: KPI Cards */}
          <div className="kpi-grid">
            <KpiCard 
              label={mode === 'customer' ? '到厂单车报价' : '单车内部成本'} 
              value={(mode === 'customer' ? summary?.vehicleCost : internalSummary?.vehicleCost)?.toFixed(2) || '0.00'} 
              prefix="¥" 
            />
            <KpiCard label="线束数量" value={summary?.harnessCount || 0} />
            <KpiCard label="总铜重" value={summary?.totalCopperWeight.toFixed(3) || '0.000'} unit="kg" />
            <KpiCard label="总工时" value={summary?.totalProcessHours.toFixed(2) || '0.00'} unit="h" />
          </div>

          {/* Extra KPI Cards */}
          <div className="kpi-grid">
            <KpiCard 
              label="材料占比" 
              value={(() => {
                const s = mode === 'customer' ? summary : internalSummary;
                if (!s || s.vehicleCost === 0) return '0.0';
                return ((s.weightedMaterial / s.vehicleCost) * 100).toFixed(1);
              })()} 
              unit="%" 
            />
            <KpiCard 
              label="金属占比(占材料)" 
              value={summary && summary.weightedMaterial > 0 ? (weightedMetalCost / summary.weightedMaterial * 100).toFixed(1) : '0.0'} 
              unit="%" 
            />
            {mode === 'customer' ? (
              <KpiCard label="出厂价(加权)" value={summary?.weightedExFactory.toFixed(2) || '0.00'} prefix="¥" />
            ) : (
              <KpiCard label="加权人工" value={internalSummary?.weightedDirectLabor.toFixed(2) || '0.00'} prefix="¥" />
            )}
            <KpiCard label="7年累计价格降幅" value={((1 - Math.pow(1 - annualDropRate, 6)) * 100).toFixed(1)} unit="%" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 24, marginBottom: 24 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Section 2: Pie Chart */}
              <Card title="成本构成分析" className="glass-card">
                <ReactECharts echarts={echarts} option={chartOptions} style={{ height: 300 }} theme="dark" />
              </Card>

              {/* Section 2.5: Harness Distribution Pie Chart */}
              <Card title="线束成本分布" className="glass-card">
                <ReactECharts 
                  echarts={echarts}
                  option={harnessDistributionOption} 
                  style={{ height: 350 }} 
                  onEvents={{ click: handleHarnessChartClick }}
                  theme="dark"
                />
              </Card>
            </div>

            {/* Section 3: Detailed Table */}
            <Card className="glass-card" title="线束成本清单" style={{ background: 'var(--semi-color-bg-2)' }}>
              {selectedHarnessIds.length > 0 && (
                <div style={{ 
                  padding: '8px 16px', 
                  background: 'var(--semi-color-primary-light-default)', 
                  borderRadius: 8,
                  marginBottom: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <span style={{ color: 'var(--semi-color-primary)' }}>已选择 {selectedHarnessIds.length} 条线束</span>
                  <Space>
                    <RoleGuard field="deleteHarness">
                      <Button 
                        icon={<IconDelete />}
                        type="danger"
                        onClick={handleBatchDelete}
                      >
                        批量删除
                      </Button>
                    </RoleGuard>
                    <Button 
                      icon={<IconCopy />}
                      onClick={handleBatchCopy}
                    >
                      批量复制
                    </Button>
                    <Button 
                      icon={<IconDownload />}
                      onClick={handleBatchExport}
                    >
                      批量导出
                    </Button>
                  </Space>
                </div>
              )}
              <Table<CostTableRow>
                columns={columns}
                dataSource={dataSource}
                rowKey="id"
                rowSelection={{
                  selectedRowKeys: selectedHarnessIds,
                  onChange: (selectedRowKeys) => setSelectedHarnessIds(selectedRowKeys as string[]),
                  getCheckboxProps: (record: any) => ({ 
                    disabled: record.isTotal, 
                    'aria-label': `选择 ${record.harnessName || record.harnessId}` 
                  }),
                }}
                pagination={{ pageSize: 20 }}
                size="small"
                onRow={(record?: CostTableRow) => ({
                  onClick: () => {
                    if (record && !record.isTotal) {
                      navigate(`/project/${id}/harness/${record.harnessId}`);
                    }
                  },
                  style: { cursor: record?.isTotal ? 'default' : 'pointer' },
                  className: record?.isTotal ? 'table-total-row' : ''
                })}
                style={{ overflowX: 'auto' }}
              />
            </Card>
          </div>

          {/* Lifecycle Trend Chart */}
          <Card className="glass-card" title="项目生命周期成本趋势" style={{ background: 'var(--semi-color-bg-2)', marginBottom: 24 }}>
            <ReactECharts echarts={echarts} option={lifecycleChartOptions} style={{ height: 400 }} theme="dark" />
          </Card>
        </>
      )}

      <VersionPanel projectId={id!} />
      <Card className="glass-card" title="数据校验" style={{ background: 'var(--semi-color-bg-2)', marginBottom: 24 }}>
        <ValidationPanel harnesses={harnessInputs} costRates={project.config.costRates} />
      </Card>
      <RoleGuard field="auditLog">
        <AuditLogPanel projectId={id!} />
      </RoleGuard>
      <MultiImportDialog
        visible={showMultiImport}
        projectId={id!}
        onClose={() => setShowMultiImport(false)}
        onImported={() => loadData()}
      />
    </Layout>
  );
}
