/**
 * Gap 快照管理器
 *
 * 功能：
 * - 创建 Gap 分析快照（报价侧 + 内部实绩侧）
 * - 列出历史快照
 * - 对比两个快照之间的差异
 *
 * 数据持久化到 Dexie gapSnapshots 表 (db.ts v9)
 */
import { useState, useCallback, useMemo } from 'react';
import {
  Button,
  Table,
  Tag,
  Toast,
  Typography,
  Space,
  Input,
  Empty,
} from '@douyinfe/semi-ui';
import { IconPlus, IconDelete, IconCopy } from '@douyinfe/semi-icons';
import { db, type GapSnapshotRecord } from '@/data/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { useInternalMetalStore, SOURCE_LABELS, type InternalMetalSource } from '@/store/internalMetalStore';

const { Text, Title } = Typography;

interface GapSnapshotManagerProps {
  projectId: string;
  scenarioId: string;
  /** 当前 Gap 分析结果（用于创建快照） */
  currentGapResult?: Record<string, unknown>;
  /** 当前报价侧金属价格 */
  quoteSideMetalPrices?: { copper: number; aluminum: number };
}

export function GapSnapshotManager({
  projectId,
  scenarioId,
  currentGapResult,
  quoteSideMetalPrices,
}: GapSnapshotManagerProps) {
  const { activeSource, getActivePrice } = useInternalMetalStore();
  const [label, setLabel] = useState('');
  const [creating, setCreating] = useState(false);

  const snapshots = useLiveQuery(
    () =>
      db.gapSnapshots
        .where({ projectId, scenarioId })
        .reverse()
        .sortBy('createdAt'),
    [projectId, scenarioId]
  );

  const handleCreateSnapshot = useCallback(
    async (snapshotType: 'quote' | 'internal') => {
      if (!currentGapResult) {
        Toast.warning('当前没有 Gap 分析结果，请先执行分析');
        return;
      }

      setCreating(true);
      try {
        const internalPrice = getActivePrice();
        const metalPrices =
          snapshotType === 'quote'
            ? quoteSideMetalPrices ?? { copper: 0, aluminum: 0 }
            : { copper: internalPrice.copper, aluminum: internalPrice.aluminum };

        const metalSource: GapSnapshotRecord['metalSource'] =
          snapshotType === 'quote' ? 'customer_agreed' : activeSource;

        const record: GapSnapshotRecord = {
          id: crypto.randomUUID(),
          projectId,
          scenarioId,
          harnessId: '', // 整车级
          snapshotType,
          metalSource,
          metalPrices,
          gapResult: currentGapResult,
          label: label.trim() || `${snapshotType === 'quote' ? '报价侧' : '实绩侧'} ${new Date().toLocaleDateString('zh-CN')}`,
          createdAt: new Date().toISOString(),
        };

        await db.gapSnapshots.add(record);
        setLabel('');
        Toast.success(`${snapshotType === 'quote' ? '报价侧' : '实绩侧'}快照已保存`);
      } catch (err) {
        Toast.error('快照保存失败');
      } finally {
        setCreating(false);
      }
    },
    [activeSource, currentGapResult, getActivePrice, label, projectId, quoteSideMetalPrices, scenarioId]
  );

  const handleDelete = useCallback(async (id: string) => {
    try {
      await db.gapSnapshots.delete(id);
      Toast.success('快照已删除');
    } catch {
      Toast.error('删除失败');
    }
  }, []);

  const sourceLabel = (source: GapSnapshotRecord['metalSource']) => {
    if (source === 'customer_agreed') return '客户协议价';
    return SOURCE_LABELS[source as InternalMetalSource] ?? source;
  };

  return (
    <div style= display: 'flex', flexDirection: 'column', gap: 12 >
      <div style= display: 'flex', justifyContent: 'space-between', alignItems: 'center' >
        <Title heading={6} style= margin: 0 >Gap 快照历史</Title>
        <Space>
          <Input
            placeholder="快照标签（可选）"
            value={label}
            onChange={setLabel}
            style= width: 180 
            size="small"
          />
          <Button
            icon={<IconPlus />}
            size="small"
            loading={creating}
            disabled={!currentGapResult}
            onClick={() => handleCreateSnapshot('quote')}
          >
            保存报价侧快照
          </Button>
          <Button
            icon={<IconPlus />}
            size="small"
            theme="solid"
            loading={creating}
            disabled={!currentGapResult}
            onClick={() => handleCreateSnapshot('internal')}
          >
            保存实绩侧快照
          </Button>
        </Space>
      </div>

      {!snapshots || snapshots.length === 0 ? (
        <Empty description="暂无 Gap 快照，执行分析后可保存" />
      ) : (
        <Table
          dataSource={snapshots.map((s) => ({ ...s, key: s.id }))}
          pagination={false}
          size="small"
          columns={[
            {
              title: '标签',
              dataIndex: 'label',
              width: 200,
              render: (v: string) => <Text strong style= fontSize: 12 >{v}</Text>,
            },
            {
              title: '类型',
              dataIndex: 'snapshotType',
              width: 100,
              render: (v: 'quote' | 'internal') => (
                <Tag color={v === 'quote' ? 'purple' : 'blue'} size="small">
                  {v === 'quote' ? '报价侧' : '实绩侧'}
                </Tag>
              ),
            },
            {
              title: '金属基准',
              dataIndex: 'metalSource',
              width: 120,
              render: (v: GapSnapshotRecord['metalSource']) => (
                <Tag size="small">{sourceLabel(v)}</Tag>
              ),
            },
            {
              title: '铜价',
              width: 100,
              align: 'right' as const,
              render: (_: any, record: GapSnapshotRecord) => (
                <span style= fontSize: 12 >¥{record.metalPrices.copper.toLocaleString()}</span>
              ),
            },
            {
              title: '铝价',
              width: 100,
              align: 'right' as const,
              render: (_: any, record: GapSnapshotRecord) => (
                <span style= fontSize: 12 >¥{record.metalPrices.aluminum.toLocaleString()}</span>
              ),
            },
            {
              title: '时间',
              dataIndex: 'createdAt',
              width: 160,
              render: (v: string) => new Date(v).toLocaleString('zh-CN'),
            },
            {
              title: '操作',
              width: 80,
              render: (_: any, record: GapSnapshotRecord) => (
                <Button
                  icon={<IconDelete />}
                  size="small"
                  type="danger"
                  theme="borderless"
                  onClick={() => handleDelete(record.id)}
                />
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
