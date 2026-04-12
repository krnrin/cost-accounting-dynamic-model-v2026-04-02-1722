import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Empty, Input, Space, Table, Tag, Toast, Typography } from '@douyinfe/semi-ui';
import type { PriceDiscrepancyRecord, PricePartCategory } from '@/types/pricing';
import { usePricingStore } from '@/store/pricingStore';

const { Text } = Typography;

const CATEGORY_TITLE: Record<PricePartCategory, string> = {
  connector: '连接器差异治理',
  wire: '导线差异治理',
  dev_part: '开发件差异治理',
  auxiliary: '辅助件差异治理',
  other: '其他差异治理',
};

const STATUS_META = {
  open: { color: 'red', label: '待处理' },
  escalated: { color: 'orange', label: '已升级' },
  resolved: { color: 'green', label: '已解决' },
  accepted: { color: 'grey', label: '已接受' },
} as const;

type Props = {
  category: PricePartCategory;
  projectId?: string;
  scenarioId?: string;
};

export default function PricingDiscrepancyPanel({ category, projectId, scenarioId }: Props) {
  const navigate = useNavigate();
  const { priceDiscrepancies, assignDiscrepancy, resolveDiscrepancy } = usePricingStore();
  const [assigneeDraft, setAssigneeDraft] = useState<Record<string, string>>({});

  const allCategoryRows = useMemo(
    () => priceDiscrepancies.filter((row) => row.partCategory === category),
    [category, priceDiscrepancies]
  );

  const openRows = useMemo(
    () => allCategoryRows.filter((row) => row.status === 'open' || row.status === 'escalated'),
    [allCategoryRows]
  );

  const resolvedCount = allCategoryRows.length - openRows.length;

  const onAssign = async (row: PriceDiscrepancyRecord) => {
    const nextOwner = (assigneeDraft[row.id] || row.assignedTo || '').trim();
    if (!nextOwner) {
      Toast.warning('请先输入责任人。');
      return;
    }
    try {
      await assignDiscrepancy(row.id, nextOwner);
      Toast.success('责任人已更新。');
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '责任人更新失败。');
    }
  };

  const onClose = async (row: PriceDiscrepancyRecord) => {
    try {
      await resolveDiscrepancy(row.id, {
        type: 'accepted_loss',
        note: '从价格页快速关闭',
      });
      Toast.success('差异已关闭。');
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '差异关闭失败。');
    }
  };

  const columns = [
    {
      title: '料号',
      dataIndex: 'partNo',
      width: 150,
      render: (value: string) => <Text style={{ fontFamily: 'Consolas, monospace', fontWeight: 600 }}>{value}</Text>,
    },
    {
      title: '名称',
      dataIndex: 'partName',
      width: 180,
      render: (value: string) => <Text ellipsis={{ showTooltip: true }} style={{ maxWidth: 170 }}>{value}</Text>,
    },
    {
      title: '参考价',
      dataIndex: 'referencePrice',
      width: 96,
      align: 'right' as const,
      render: (value: number) => <span className="ledger-number">楼{value.toFixed(2)}</span>,
    },
    {
      title: '实际价',
      dataIndex: 'actualPrice',
      width: 96,
      align: 'right' as const,
      render: (value: number) => <span className="ledger-number">楼{value.toFixed(2)}</span>,
    },
    {
      title: '差异率',
      dataIndex: 'discrepancyRate',
      width: 90,
      align: 'right' as const,
      render: (value: number) => {
        const rate = Number.isFinite(value) ? value * 100 : 0;
        const color = rate >= 0 ? '#dc2626' : '#2563eb';
        return <span className="ledger-number" style={{ color }}>{rate.toFixed(2)}%</span>;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 88,
      render: (value: PriceDiscrepancyRecord['status']) => {
        const meta = STATUS_META[value];
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: '责任人',
      width: 200,
      render: (_: unknown, row: PriceDiscrepancyRecord) => (
        <Space>
          <Input
            style={{ width: 120 }}
            value={assigneeDraft[row.id] ?? row.assignedTo ?? ''}
            onChange={(value) => setAssigneeDraft((prev) => ({ ...prev, [row.id]: value }))}
            placeholder="输入姓名"
          />
          <Button size="small" onClick={() => void onAssign(row)}>指派</Button>
        </Space>
      ),
    },
    {
      title: '操作',
      width: 90,
      fixed: 'right' as const,
      render: (_: unknown, row: PriceDiscrepancyRecord) => (
        <Button size="small" theme="solid" type="danger" onClick={() => void onClose(row)}>
          关闭
        </Button>
      ),
    },
  ];

  return (
    <Card
      title={CATEGORY_TITLE[category]}
      headerExtraContent={(
        <Space>
          <Tag color="red">未关闭 {openRows.length}</Tag>
          <Tag color="green">已关闭 {resolvedCount}</Tag>
          <Button
            size="small"
            theme="outline"
            disabled={!projectId || !scenarioId}
            onClick={() => {
              if (projectId && scenarioId) {
                navigate(`/project/${projectId}/s/${scenarioId}/tracking`);
              }
            }}
          >
            跳转 Tracking
          </Button>
        </Space>
      )}
      style={{ marginTop: 16 }}
    >
      <Table
        rowKey="id"
        size="small"
        columns={columns}
        dataSource={openRows}
        pagination={{ pageSize: 6 }}
        scroll={{ x: 980 }}
        empty={<Empty description="当前分类暂无未关闭差异。" />}
      />
    </Card>
  );
}
