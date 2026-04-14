/**
 * 金属价格影响汇总卡片 (Issue #61)
 *
 * 展示金属价格变动对所有线束成本的影响汇总。
 * 适合嵌入 Dashboard 或 QuotePage 侧边栏。
 */
import { useMemo } from 'react';
import { Card, Table, Tag, Typography, Descriptions } from '@douyinfe/semi-ui';
import type { HarnessResult } from '@/types/harness';
import type { MetalPrices } from '@/types/project';
import { computeMetalDelta } from '@/engine/metal_escalation';
import { numberOr } from '@/engine/shared_utils';
import type { CSSProperties } from 'react';

const { Text } = Typography;

const S: Record<string, CSSProperties> = {
  card: { height: '100%' },
};

interface MetalImpactSummaryProps {
  harnesses: Array<{
    harnessId: string;
    harnessName: string;
    result: HarnessResult;
  }>;
  basePrices: Partial<MetalPrices>;
  newPrices: Partial<MetalPrices>;
  /** 可选标题 */
  title?: string;
}

interface MetalImpactRow {
  harnessId: string;
  harnessName: string;
  copperWeight: number;
  aluminumWeight: number;
  deltaMaterial: number;
  deltaDelivered: number;
  vehicleRatio: number;
  weightedDelta: number;
}

export default function MetalImpactSummary({
  harnesses,
  basePrices,
  newPrices,
  title = '金属联动影响',
}: MetalImpactSummaryProps) {
  const rows = useMemo<MetalImpactRow[]>(() => {
    return harnesses.map((h) => {
      const delta = computeMetalDelta(h.result, basePrices, newPrices);
      return {
        harnessId: h.harnessId,
        harnessName: h.harnessName,
        copperWeight: numberOr(h.result.copperWeight, 0),
        aluminumWeight: numberOr(h.result.aluminumWeight, 0),
        deltaMaterial: delta.deltaMaterialCost,
        deltaDelivered: delta.deltaMaterialCost + delta.deltaWasteCost + delta.deltaMgmtFee + delta.deltaProfit,
        vehicleRatio: numberOr(h.result.vehicleRatio, 0),
        weightedDelta: (delta.deltaMaterialCost + delta.deltaWasteCost + delta.deltaMgmtFee + delta.deltaProfit) * numberOr(h.result.vehicleRatio, 0),
      };
    });
  }, [harnesses, basePrices, newPrices]);

  const totalWeightedImpact = useMemo(
    () => rows.reduce((sum, r) => sum + r.weightedDelta, 0),
    [rows]
  );

  const positiveCount = rows.filter((r) => r.deltaDelivered > 0).length;
  const negativeCount = rows.filter((r) => r.deltaDelivered < 0).length;

  // 铜/铝价格变化摘要
  const cuBefore = numberOr((basePrices as any)?.copper ?? (basePrices as any)?.cu, 0);
  const cuAfter = numberOr((newPrices as any)?.copper ?? (newPrices as any)?.cu, 0);
  const alBefore = numberOr((basePrices as any)?.aluminum ?? (basePrices as any)?.al, 0);
  const alAfter = numberOr((newPrices as any)?.aluminum ?? (newPrices as any)?.al, 0);

  const columns = [
    { title: '线束', dataIndex: 'harnessName', width: 160 },
    {
      title: '铜(kg)',
      dataIndex: 'copperWeight',
      width: 70,
      render: (v: number) => v.toFixed(2),
    },
    {
      title: '铝(kg)',
      dataIndex: 'aluminumWeight',
      width: 70,
      render: (v: number) => v.toFixed(2),
    },
    {
      title: '到厂价Δ',
      dataIndex: 'deltaDelivered',
      width: 100,
      render: (v: number) => (
        <Tag color={v > 0 ? 'red' : v < 0 ? 'green' : 'grey'} style={{ fontFamily: 'monospace'}}>
          {v > 0 ? '+' : ''}¥{v.toFixed(2)}
        </Tag>
      ),
    },
  ];

  return (
    <Card title={title} style={S.card}>
      <Descriptions
        data={[
          { key: '铜价', value: `¥${cuBefore.toFixed(0)} → ¥${cuAfter.toFixed(0)} /t` },
          { key: '铝价', value: `¥${alBefore.toFixed(0)} → ¥${alAfter.toFixed(0)} /t` },
          {
            key: '单车加权影响',
            value: (
              <Text strong style={{ color: totalWeightedImpact > 0 ? '#f5222d' : '#52c41a', fontSize: 16}}>
                {totalWeightedImpact > 0 ? '+' : ''}¥{totalWeightedImpact.toFixed(4)}
              </Text>
            ),
          },
          { key: '涨价/降价', value: `${positiveCount} 涨 / ${negativeCount} 降` },
        ]}
        row
        style={{ marginBottom: 12}}/>

      <Table
        dataSource={rows}
        columns={columns}
        rowKey="harnessId"
        pagination={false}
        size="small"
      />
    </Card>
  );
}
