/**
 * 级联影响预览组件 (Issue #60)
 *
 * 在变更确认前，展示变更对各线束成本的级联影响。
 * 支持按影响大小排序，高亮超阈值项。
 */
import { useMemo } from 'react';
import { Table, Tag, Typography, Card, Descriptions, Banner, Button } from '@douyinfe/semi-ui';
import type { PropagationResult, PropagationImpact } from '@/engine/change_propagation';
import type { CSSProperties } from 'react';

const { Title, Text } = Typography;

const S: Record<string, CSSProperties> = {
  card: { marginBottom: 16 },
  summary: { marginBottom: 16 },
  actions: { marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 },
};

interface CascadeImpactPreviewProps {
  result: PropagationResult;
  onConfirm?: () => void;
  onCancel?: () => void;
}

export default function CascadeImpactPreview({
  result,
  onConfirm,
  onCancel,
}: CascadeImpactPreviewProps) {
  const sortedImpacts = useMemo(
    () => [...result.impacts].sort((a, b) => Math.abs(b.weightedDelta) - Math.abs(a.weightedDelta)),
    [result.impacts]
  );

  const eventTypeLabel: Record<string, string> = {
    ecn: '设变通知 (ECN)',
    metal_price: '金属价格变动',
    annual_drop: '年降触发',
    rate_change: '费率变更',
    bom_update: 'BOM数据更新',
    volume_change: '销量变更',
  };

  const columns = [
    {
      title: '线束',
      dataIndex: 'harnessName',
      width: 180,
    },
    {
      title: '装车比',
      dataIndex: 'vehicleRatio',
      width: 80,
      render: (v: number) => `${(v * 100).toFixed(0)}%`,
    },
    {
      title: '原到厂价',
      dataIndex: 'baseDeliveredPrice',
      width: 100,
      render: (v: number) => `¥${v.toFixed(2)}`,
    },
    {
      title: '新到厂价',
      dataIndex: 'newDeliveredPrice',
      width: 100,
      render: (v: number) => `¥${v.toFixed(2)}`,
    },
    {
      title: '变化',
      dataIndex: 'deltaDeliveredPrice',
      width: 100,
      render: (v: number) => (
        <Tag color={v > 0 ? 'red' : v < 0 ? 'green' : 'grey'} style= fontFamily: 'monospace' >
          {v > 0 ? '+' : ''}¥{v.toFixed(2)}
        </Tag>
      ),
    },
    {
      title: '加权影响',
      dataIndex: 'weightedDelta',
      width: 100,
      render: (v: number) => (
        <Text strong style= color: v > 0 ? '#f5222d' : v < 0 ? '#52c41a' : undefined >
          {v > 0 ? '+' : ''}¥{v.toFixed(4)}
        </Text>
      ),
    },
  ];

  const expandedRowRender = (record: PropagationImpact) => (
    <Descriptions
      data={[
        { key: '材料成本Δ', value: `¥${record.breakdown.deltaMaterialCost.toFixed(4)}` },
        { key: '加工成本Δ', value: `¥${record.breakdown.deltaProcessCost.toFixed(4)}` },
        { key: '废品成本Δ', value: `¥${record.breakdown.deltaWasteCost.toFixed(4)}` },
        { key: '管理费Δ', value: `¥${record.breakdown.deltaMgmtFee.toFixed(4)}` },
        { key: '利润Δ', value: `¥${record.breakdown.deltaProfit.toFixed(4)}` },
      ]}
      row
      size="small"
    />
  );

  return (
    <Card style={S.card} title="级联影响预览">
      {result.requiresConfirmation && (
        <Banner
          type="warning"
          description={result.confirmReason || '变更影响较大，需要人工确认'}
          style= marginBottom: 16 
        />
      )}

      <Descriptions
        data={[
          { key: '变更类型', value: eventTypeLabel[result.event.type] || result.event.type },
          { key: '影响线束数', value: `${result.affectedCount} 条` },
          {
            key: '单车加权总影响',
            value: (
              <Text strong style= color: result.totalWeightedImpact > 0 ? '#f5222d' : '#52c41a' >
                {result.totalWeightedImpact > 0 ? '+' : ''}¥{result.totalWeightedImpact.toFixed(4)}
              </Text>
            ),
          },
        ]}
        row
        style={S.summary}
      />

      <Table
        dataSource={sortedImpacts}
        columns={columns}
        rowKey="harnessId"
        pagination={false}
        size="small"
        expandedRowRender={expandedRowRender}
      />

      <div style={S.actions}>
        {onCancel && <Button onClick={onCancel}>取消</Button>}
        {onConfirm && (
          <Button
            type={result.requiresConfirmation ? 'warning' : 'primary'}
            onClick={onConfirm}
          >
            {result.requiresConfirmation ? '确认应用 (需审批)' : '确认应用'}
          </Button>
        )}
      </div>
    </Card>
  );
}
