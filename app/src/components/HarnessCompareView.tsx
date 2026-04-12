/**
 * D6: 线束对比视图
 * 多线束指标并排对比表格
 */
import { Table, Tag, Typography, Select, Space } from '@douyinfe/semi-ui';
import { useState, useMemo } from 'react';
import type { HarnessResult } from '@/types/harness';

const { Text } = Typography;

interface HarnessData {
  harnessId: string;
  harnessName: string;
  result: HarnessResult;
}

interface HarnessCompareViewProps {
  harnesses: HarnessData[];
  selectedIds?: string[];
  onSelect?: (ids: string[]) => void;
}

const COMPARE_METRICS: Array<{ key: keyof HarnessResult; label: string; format: (v: number) => string }> = [
  { key: 'materialCost', label: '材料成本', format: v => `¥${v.toFixed(2)}` },
  { key: 'wasteCost', label: '废品成本', format: v => `¥${v.toFixed(2)}` },
  { key: 'laborPlusMfg', label: '人工+制造', format: v => `¥${v.toFixed(2)}` },
  { key: 'mgmtFee', label: '管理费', format: v => `¥${v.toFixed(2)}` },
  { key: 'profit', label: '利润', format: v => `¥${v.toFixed(2)}` },
  { key: 'exFactoryPrice', label: '出厂价', format: v => `¥${v.toFixed(2)}` },
  { key: 'packTotal', label: '包装运输', format: v => `¥${v.toFixed(2)}` },
  { key: 'deliveredPrice', label: '到厂价', format: v => `¥${v.toFixed(2)}` },
  { key: 'copperWeight', label: '铜重', format: v => `${v.toFixed(3)} kg` },
  { key: 'aluminumWeight', label: '铝重', format: v => `${v.toFixed(3)} kg` },
  { key: 'processHours', label: '总工时', format: v => `${v.toFixed(2)} h` },
];

export default function HarnessCompareView({ harnesses, selectedIds, onSelect }: HarnessCompareViewProps) {
  const [internalSelected, setInternalSelected] = useState<string[]>(harnesses.slice(0, 3).map(h => h.harnessId));
  const selected = selectedIds || internalSelected;
  const setSelected = onSelect || setInternalSelected;

  const selectedHarnesses = useMemo(
    () => harnesses.filter(h => selected.includes(h.harnessId)),
    [harnesses, selected]
  );

  const tableData = COMPARE_METRICS.map(metric => {
    const row: Record<string, unknown> = { metric: metric.label };
    const values: number[] = [];
    for (const h of selectedHarnesses) {
      const val = (h.result as any)[metric.key] as number || 0;
      row[h.harnessId] = metric.format(val);
      values.push(val);
    }
    row._spread = values.length > 0 ? Math.max(...values) - Math.min(...values) : 0;
    return row;
  });

  const columns = [
    { title: '指标', dataIndex: 'metric', fixed: true as const, width: 120 },
    ...selectedHarnesses.map(h => ({
      title: h.harnessName || h.harnessId,
      dataIndex: h.harnessId,
      width: 140,
    })),
    { title: '极差', dataIndex: '_spread', width: 100, render: (v: number) => <Tag color={v > 10 ? 'red' : 'green'}>{v.toFixed(2)}</Tag> },
  ];

  return (
    <div>
      <Space style= marginBottom: 16 >
        <Text strong>选择对比线束:</Text>
        <Select
          multiple
          value={selected}
          onChange={(v) => setSelected(v as string[])}
          style= width: 400 
          maxTagCount={3}
        >
          {harnesses.map(h => (
            <Select.Option key={h.harnessId} value={h.harnessId}>
              {h.harnessName || h.harnessId}
            </Select.Option>
          ))}
        </Select>
      </Space>

      <Table
        columns={columns}
        dataSource={tableData}
        rowKey="metric"
        pagination={false}
        size="small"
        scroll= x: 'max-content' 
      />
    </div>
  );
}
