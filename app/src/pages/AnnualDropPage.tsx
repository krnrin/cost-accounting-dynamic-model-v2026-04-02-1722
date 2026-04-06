import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Typography, Spin, Button, Card, Table, InputNumber, 
  Space, Breadcrumb, Toast 
} from '@douyinfe/semi-ui';
import { 
  IconDownload 
} from '@douyinfe/semi-icons';
import ReactECharts from 'echarts-for-react/lib/core';
import echarts from '@/lib/echarts';

import { db } from '@/data/db';
import type { ProjectRecord } from '@/data/db';
import { useProjectStore } from '@/store/projectStore';
import { useSettingsStore } from '@/store/settingsStore';
import { computeHarnessCost, computeProjectFromHarnesses } from '@/engine/harness_costing';
import { computeMetalEscalation } from '@/engine/metal_escalation';
import { exportAnnualDropExcel } from '@/engine/excel_export';
import type { HarnessResult, ProjectHarnessResult } from '@/types/harness';
import type { MetalPrices } from '@/types/project';
import AlertBanner from '@/components/AlertBanner';

const { Title, Text } = Typography;

interface AnnualDropRow {
  year: number;
  dropRate: number; // %
  deliveredPrice: number;
  dropAmount: number;
  cumulativeDropPercent: number;
}

export default function AnnualDropPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setCurrentProject } = useProjectStore();
  const { alertThresholds } = useSettingsStore();

  const [isLoading, setLocalLoading] = useState(true);
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [harnessResults, setHarnessResults] = useState<HarnessResult[]>([]);
  const [summary, setSummary] = useState<ProjectHarnessResult | null>(null);
  
  const [annualDropRates, setAnnualDropRates] = useState<number[]>([]); // 1-based, index 0 is year 1
  const [simulatedMetalPrices, setSimulatedMetalPrices] = useState<MetalPrices>({ copper: 0, aluminum: 0 });

  useEffect(() => {
    if (!id) return;

    const loadData = async () => {
      setLocalLoading(true);
      try {
        const projectData = await db.projects.get(id);
        if (projectData) {
          setProject(projectData);
          setCurrentProject(projectData.id, projectData.meta.projectName);
          setSimulatedMetalPrices(projectData.config.metalPrices);

          const harnessRecords = await db.harnesses.where('projectId').equals(id).toArray();
          const results = harnessRecords.map(record => 
            computeHarnessCost(record.input, projectData.config.costRates, projectData.config.metalPrices)
          );
          setHarnessResults(results);
          setSummary(computeProjectFromHarnesses(results));

          // Initialize annual drop rates
          const years = projectData.meta.lifecycleYears || 6;
          const defaultRate = projectData.config.annualDropRate || 0.03;
          const initialRates = new Array(years).fill(0).map((_, i) => i === 0 ? 0 : defaultRate * 100);
          setAnnualDropRates(initialRates);
        }
      } catch (error) {
        console.error('Failed to load project data:', error);
      } finally {
        setLocalLoading(false);
      }
    };

    loadData();
  }, [id, setCurrentProject]);

  const baseDeliveredPrice = summary?.vehicleCost || 0;

  const annualDropData = useMemo(() => {
    const rows: AnnualDropRow[] = [];
    let totalFactor = 1.0;

    for (let i = 0; i < annualDropRates.length; i++) {
      const year = i + 1;
      const rate = (annualDropRates[i] || 0) / 100;
      
      if (year > 1) {
        totalFactor *= (1 - rate);
      }
      
      const priceAfterDrop = baseDeliveredPrice * totalFactor;
      
      rows.push({
        year,
        dropRate: annualDropRates[i] || 0,
        deliveredPrice: priceAfterDrop,
        dropAmount: baseDeliveredPrice - priceAfterDrop,
        cumulativeDropPercent: (1 - totalFactor) * 100
      });
    }
    return rows;
  }, [baseDeliveredPrice, annualDropRates]);

  const metalAdjustmentPerVehicle = useMemo(() => {
    if (!project || !harnessResults.length) return 0;
    const escalation = computeMetalEscalation(
      harnessResults,
      project.config.metalPrices,
      simulatedMetalPrices
    );
    return escalation.summary.totalWeightedDelta;
  }, [project, harnessResults, simulatedMetalPrices]);

  const combinedData = useMemo(() => {
    return annualDropData.map(row => ({
      year: row.year,
      annualDropPrice: row.deliveredPrice,
      metalAdjustment: metalAdjustmentPerVehicle,
      finalDeliveredPrice: row.deliveredPrice + metalAdjustmentPerVehicle,
      totalDeltaAmount: baseDeliveredPrice - (row.deliveredPrice + metalAdjustmentPerVehicle)
    }));
  }, [annualDropData, metalAdjustmentPerVehicle, baseDeliveredPrice]);

  const chartOptions = {
    title: { text: '到厂价趋势分析', left: 'center', textStyle: { color: 'var(--text-primary)' } },
    tooltip: { trigger: 'axis' },
    legend: { data: ['年降后价格', '综合到厂价'], bottom: 0, textStyle: { color: 'var(--text-secondary)' } },
    xAxis: {
      type: 'category',
      data: annualDropData.map(d => `Year ${d.year}`),
      axisLabel: { color: 'var(--text-secondary)' }
    },
    yAxis: {
      type: 'value',
      name: '金额 (元)',
      axisLabel: { color: 'var(--text-secondary)' },
      splitLine: { lineStyle: { color: 'var(--border)' } }
    },
    series: [
      {
        name: '年降后价格',
        type: 'bar',
        data: annualDropData.map(d => d.deliveredPrice.toFixed(2)),
        itemStyle: { color: '#5470c6' }
      },
      {
        name: '综合到厂价',
        type: 'line',
        data: combinedData.map(d => d.finalDeliveredPrice.toFixed(2)),
        itemStyle: { color: '#91cc75' }
      }
    ]
  };

  const handleRateChange = (year: number, value: number) => {
    const newRates = [...annualDropRates];
    newRates[year - 1] = value;
    setAnnualDropRates(newRates);
  };

  const exportToExcel = () => {
    if (!project) return;
    exportAnnualDropExcel(
      project.meta.projectName,
      annualDropData,
      combinedData,
      harnessResults,
      baseDeliveredPrice
    );
    Toast.success('年降分析表已导出');
  };

  if (isLoading || !project) {
    return <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 100 }}><Spin size="large" /></div>;
  }

  const columns = [
    { title: '年度', dataIndex: 'year', key: 'year', width: 80 },
    { 
      title: '年降率 (%)', 
      dataIndex: 'dropRate', 
      key: 'dropRate',
      render: (val: number, record: AnnualDropRow) => (
        record.year === 1 ? '—' : 
        <InputNumber 
          value={val} 
          min={0} max={100} step={0.1} 
          style={{ width: 100 }}
          onChange={(v) => handleRateChange(record.year, Number(v))}
        />
      )
    },
    { title: '年降后到厂价', dataIndex: 'deliveredPrice', key: 'deliveredPrice', render: (v: number) => `¥${v.toFixed(2)}` },
    { title: '单车降额', dataIndex: 'dropAmount', key: 'dropAmount', render: (v: number) => `¥${v.toFixed(2)}` },
    { title: '累计降幅', dataIndex: 'cumulativeDropPercent', key: 'cumulativeDropPercent', render: (v: number) => `${v.toFixed(2)}%` },
  ];

  const combinedColumns = [
    { title: '年度', dataIndex: 'year', key: 'year' },
    { title: '年降到厂价', dataIndex: 'annualDropPrice', key: 'annualDropPrice', render: (v: number) => `¥${v.toFixed(2)}` },
    { title: '金属联动调整', dataIndex: 'metalAdjustment', key: 'metalAdjustment', render: (v: number) => `¥${v.toFixed(2)}` },
    { title: '综合到厂价', dataIndex: 'finalDeliveredPrice', key: 'finalDeliveredPrice', render: (v: number) => `¥${v.toFixed(2)}` },
    { title: '综合变化金额', dataIndex: 'totalDeltaAmount', key: 'totalDeltaAmount', render: (v: number) => `¥${v.toFixed(2)}` },
  ];

  return (
    <div style={{ padding: '0 24px 24px' }}>
      <div style={{ margin: '16px 0' }}>
        <Breadcrumb>
          <Breadcrumb.Item onClick={() => navigate('/')}>项目列表</Breadcrumb.Item>
          <Breadcrumb.Item onClick={() => navigate(`/project/${id}`)}>{project.meta.projectName}</Breadcrumb.Item>
          <Breadcrumb.Item>年降与联动管理</Breadcrumb.Item>
        </Breadcrumb>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title heading={3}>年降与联动管理</Title>
        <Button icon={<IconDownload />} onClick={exportToExcel}>导出 Excel</Button>
      </div>

      <AlertBanner 
        projectId={id!}
        currentPrices={simulatedMetalPrices}
        basePrices={project.config.metalPrices}
        thresholds={alertThresholds}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 24, marginBottom: 24 }}>
        <Card title="年降合同计划 (多年度)" headerExtraContent={<Text type="secondary">基准价格: ¥{baseDeliveredPrice.toFixed(2)}</Text>}>
          <Table columns={columns} dataSource={annualDropData} pagination={false} size="small" />
        </Card>
        <Card title="价格走势预测">
          <ReactECharts echarts={echarts} option={chartOptions} style={{ height: 350 }} />
        </Card>
      </div>

      <Card title="金属联动 + 年降 综合影响分析" style={{ marginBottom: 24 }}>
        <div style={{ marginBottom: 16, display: 'flex', gap: 24, alignItems: 'center', background: 'var(--semi-color-bg-1)', padding: 16, borderRadius: 8 }}>
          <Text strong>模拟金属价格：</Text>
          <Space>
            <Text>铜 (元/吨)</Text>
            <InputNumber value={simulatedMetalPrices.copper} onChange={(v) => setSimulatedMetalPrices(p => ({ ...p, copper: Number(v) }))} />
          </Space>
          <Space>
            <Text>铝 (元/吨)</Text>
            <InputNumber value={simulatedMetalPrices.aluminum} onChange={(v) => setSimulatedMetalPrices(p => ({ ...p, aluminum: Number(v) }))} />
          </Space>
          <Button theme="light" onClick={() => setSimulatedMetalPrices(project.config.metalPrices)}>重置</Button>
        </div>
        <Table columns={combinedColumns} dataSource={combinedData} pagination={false} />
      </Card>

      <Card title="各线束年降明细 (第一年 vs 最后一年)">
        <Table 
          dataSource={harnessResults}
          pagination={false}
          size="small"
          columns={[
            { title: '零件号', dataIndex: 'harnessId', key: 'harnessId' },
            { title: '名称', dataIndex: 'harnessName', key: 'harnessName' },
            { title: '基准单价', dataIndex: 'deliveredPrice', key: 'base', render: (v: number) => `¥${v.toFixed(2)}` },
            { 
              title: `Year ${annualDropData.length} 价格`, 
              key: 'lastYear', 
              render: (_, record) => {
                const lastRow = annualDropData[annualDropData.length - 1];
                const lastYearFactor = lastRow ? lastRow.deliveredPrice / baseDeliveredPrice : 1;
                return `¥${(record.deliveredPrice * lastYearFactor).toFixed(2)}`;
              }
            },
            {
              title: '累计年降额',
              key: 'totalDrop',
              render: (_, record) => {
                const lastRow = annualDropData[annualDropData.length - 1];
                const lastYearFactor = lastRow ? lastRow.deliveredPrice / baseDeliveredPrice : 1;
                return `¥${(record.deliveredPrice * (1 - lastYearFactor)).toFixed(2)}`;
              }
            }
          ]}
        />
      </Card>
    </div>
  );
}
