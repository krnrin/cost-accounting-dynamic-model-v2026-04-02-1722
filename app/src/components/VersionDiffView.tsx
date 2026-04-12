import React, { useMemo } from 'react';
import { Table, Typography, Space } from '@douyinfe/semi-ui';
import type { VersionDiff, VersionDiffItem } from '../types/version';

const { Title, Text } = Typography;

interface Props {
  diff: VersionDiff;
}

type HarnessRow = VersionDiff['harnessLevel'][number];

export const VersionDiffView: React.FC<Props> = ({ diff }) => {
  const renderFieldDiff = (item?: VersionDiffItem) => {
    if (!item) return '-';
    const { before, after, delta, deltaPercent } = item;
    const isIncrease = delta > 0.001;
    const isDecrease = delta < -0.001;
    const color = isIncrease ? 'var(--semi-color-danger)' : isDecrease ? 'var(--semi-color-success)' : 'var(--semi-color-text-2)';
    const prefix = isIncrease ? '+' : '';
    
    return (
      <Space vertical align="end" spacing={0}>
        <Text size="small" type="secondary" style={{ fontSize: '10px' }}>
          {before.toFixed(2)} → {after.toFixed(2)}
        </Text>
        <Space spacing={4}>
          <Text style={{ color, fontWeight: 'bold' }}>{prefix}{delta.toFixed(2)}</Text>
          <Text size="small" style={{ color }}>{prefix}{deltaPercent.toFixed(2)}%</Text>
        </Space>
      </Space>
    );
  };

  const projectColumns = [
    { title: '指标', dataIndex: 'label', key: 'label' },
    { 
      title: diff.beforeVersion || '前一版本', 
      dataIndex: 'before', 
      key: 'before', 
      render: (v: number) => `¥${v.toFixed(2)}` 
    },
    { 
      title: diff.afterVersion || '当前版本', 
      dataIndex: 'after', 
      key: 'after', 
      render: (v: number) => `¥${v.toFixed(2)}` 
    },
    { 
      title: '差异 (Delta)', 
      key: 'delta', 
      align: 'right' as const,
      render: (_: any, record: VersionDiffItem) => {
        const isIncrease = record.delta > 0.001;
        const isDecrease = record.delta < -0.001;
        const color = isIncrease ? 'var(--semi-color-danger)' : isDecrease ? 'var(--semi-color-success)' : 'var(--semi-color-text-2)';
        const prefix = isIncrease ? '+' : '';
        return (
          <Space vertical align="end">
            <Text style={{ color, fontWeight: 'bold' }}>{prefix}{record.delta.toFixed(2)}</Text>
            <Text size="small" style={{ color }}>{prefix}{record.deltaPercent.toFixed(2)}%</Text>
          </Space>
        );
      }
    },
  ];

  const diffFields = ['deliveredPrice', 'materialCost', 'waste', 'directLabor', 'manufacturing', 'managementFee', 'profit', 'exFactoryPrice', 'packSubtotal', 'freightSubtotal'];

  // Compute summary row and append to data
  const harnessDataWithSummary = useMemo(() => {
    const totals: Record<string, { before: number; after: number; delta: number }> = {};
    diffFields.forEach(f => {
      totals[f] = { before: 0, after: 0, delta: 0 };
    });
    diff.harnessLevel.forEach(h => {
      diffFields.forEach(f => {
        const item = h.diffs.find(d => d.field === f);
        if (item) {
          const t = totals[f]!;
          t.before += item.before;
          t.after += item.after;
          t.delta += item.delta;
        }
      });
    });

    const summaryDiffs: VersionDiffItem[] = diffFields.map(f => {
      const t = totals[f]!;
      return {
        field: f,
        label: f,
        before: t.before,
        after: t.after,
        delta: t.delta,
        deltaPercent: t.before !== 0 ? (t.delta / t.before) * 100 : 0,
      };
    });

    const summaryRow: HarnessRow = {
      harnessId: '__summary__',
      harnessName: '合计',
      diffs: summaryDiffs,
    };

    return [...diff.harnessLevel, summaryRow];
  }, [diff.harnessLevel]);

  const makeHarnessCol = (title: string, field: string) => ({
    title,
    key: field,
    align: 'right' as const,
    render: (_: any, record: HarnessRow) => renderFieldDiff(record.diffs.find((d) => d.field === field)),
  });

  const harnessColumns = [
    { 
      title: '线束号', dataIndex: 'harnessId', key: 'harnessId', width: 150, fixed: 'left' as const,
      render: (id: string) => id === '__summary__' ? <Text strong>合计</Text> : id,
    },
    { 
      title: '名称', dataIndex: 'harnessName', key: 'harnessName', width: 150,
      render: (name: string, record: HarnessRow) => record.harnessId === '__summary__' ? <Text strong>汇总</Text> : name,
    },
    makeHarnessCol('到厂价差异', 'deliveredPrice'),
    makeHarnessCol('材料差异', 'materialCost'),
    makeHarnessCol('损耗', 'waste'),
    makeHarnessCol('直接人工', 'directLabor'),
    makeHarnessCol('制造费', 'manufacturing'),
    makeHarnessCol('管理费', 'managementFee'),
    makeHarnessCol('利润', 'profit'),
    makeHarnessCol('出厂价', 'exFactoryPrice'),
    makeHarnessCol('包装费', 'packSubtotal'),
    makeHarnessCol('运输费', 'freightSubtotal'),
  ];

  return (
    <div style={{ padding: 16 }}>
      <Title heading={4} style={{ marginBottom: 16 }}>项目级指标对比</Title>
      <Table 
        columns={projectColumns} 
        dataSource={diff.projectLevel} 
        pagination={false} 
        size="small"
        style={{ marginBottom: 32 }}
      />

      <Title heading={4} style={{ marginBottom: 16 }}>分线束号对比</Title>
      <Table 
        columns={harnessColumns} 
        dataSource={harnessDataWithSummary} 
        pagination={false} 
        size="small"
        scroll={{ x: 1600 }}
        rowKey="harnessId"
      />
    </div>
  );
};
