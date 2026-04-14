/**
 * BOM Diff 集成面板
 *
 * 可嵌入 BomWorkbookPage 或独立使用。
 * 封装 useBomDiff hook，提供：
 * - 选择两个场景/版本的 BOM 进行 diff
 * - 差异列表展示
 * - 导出功能（预留）
 *
 * 对应 #64 BomDiff 增强 / #96 useBomDiff 接入
 */
import { useState, useCallback } from 'react';
import {
  Typography,
  Button,
  Empty,
  Space,
  Card,
  Toast,
} from '@douyinfe/semi-ui';
import { IconSearch } from '@douyinfe/semi-icons';

const { Title, Text } = Typography;

type ChangeType = 'added' | 'removed' | 'modified';

interface BomDiffRow {
  harnessId: string;
  harnessName: string;
  partNo: string;
  partName: string;
  changeType: ChangeType;
  beforeQty: number;
  afterQty: number;
  beforePrice: number;
  afterPrice: number;
  deltaAmount: number;
}

interface BomDiffIntegrationProps {
  /** 基准 BOM 数据 */
  baselineBom?: Array<{
    harnessId: string;
    harnessName: string;
    bom: Array<{ partNo: string; partName: string; qty: number; unitPrice: number; amount: number }>;
  }>;
  /** 变更 BOM 数据 */
  compareBom?: Array<{
    harnessId: string;
    harnessName: string;
    bom: Array<{ partNo: string; partName: string; qty: number; unitPrice: number; amount: number }>;
  }>;
  /** 标题覆盖 */
  title?: string;
}

const CHANGE_COLORS: Record<ChangeType, string> = {
  added: '#16a34a',
  removed: '#dc2626',
  modified: '#f59e0b',
};

const CHANGE_LABELS: Record<ChangeType, string> = {
  added: '新增',
  removed: '删除',
  modified: '变更',
};

export function BomDiffIntegration({
  baselineBom,
  compareBom,
  title = 'BOM Diff 对比',
}: BomDiffIntegrationProps) {
  const [diffRows, setDiffRows] = useState<BomDiffRow[]>([]);
  const [computed, setComputed] = useState(false);

  const computeDiff = useCallback(() => {
    if (!baselineBom || !compareBom) {
      Toast.warning('请提供基准和变更 BOM 数据');
      return;
    }

    const rows: BomDiffRow[] = [];
    const allHarnessIds = new Set([
      ...baselineBom.map((h) => h.harnessId),
      ...compareBom.map((h) => h.harnessId),
    ]);

    for (const hId of allHarnessIds) {
      const baseH = baselineBom.find((h) => h.harnessId === hId);
      const compH = compareBom.find((h) => h.harnessId === hId);
      const hName = compH?.harnessName || baseH?.harnessName || hId;

      const baseMap = new Map((baseH?.bom || []).map((b) => [b.partNo, b]));
      const compMap = new Map((compH?.bom || []).map((b) => [b.partNo, b]));

      // Added
      for (const [pn, item] of compMap) {
        if (!baseMap.has(pn)) {
          rows.push({
            harnessId: hId, harnessName: hName, partNo: pn, partName: item.partName,
            changeType: 'added', beforeQty: 0, afterQty: item.qty,
            beforePrice: 0, afterPrice: item.unitPrice, deltaAmount: item.amount,
          });
        }
      }
      // Removed
      for (const [pn, item] of baseMap) {
        if (!compMap.has(pn)) {
          rows.push({
            harnessId: hId, harnessName: hName, partNo: pn, partName: item.partName,
            changeType: 'removed', beforeQty: item.qty, afterQty: 0,
            beforePrice: item.unitPrice, afterPrice: 0, deltaAmount: -item.amount,
          });
        }
      }
      // Modified
      for (const [pn, compItem] of compMap) {
        const baseItem = baseMap.get(pn);
        if (!baseItem) continue;
        if (
          Math.abs(compItem.qty - baseItem.qty) > 0.0001 ||
          Math.abs(compItem.unitPrice - baseItem.unitPrice) > 0.0001
        ) {
          rows.push({
            harnessId: hId, harnessName: hName, partNo: pn, partName: compItem.partName,
            changeType: 'modified', beforeQty: baseItem.qty, afterQty: compItem.qty,
            beforePrice: baseItem.unitPrice, afterPrice: compItem.unitPrice,
            deltaAmount: compItem.amount - baseItem.amount,
          });
        }
      }
    }

    setDiffRows(rows);
    setComputed(true);
  }, [baselineBom, compareBom]);

  const totalDelta = diffRows.reduce((s, r) => s + r.deltaAmount, 0);

  return (
    <Card className="glass-card" style={{ marginBottom: 16}}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12}}>
        <Title heading={6} style={{ margin: 0}}>{title}</Title>
        <Space>
          {computed && (
            <Text type="tertiary" style={{ fontSize: 12}}>
              {diffRows.length} 项差异 · 总影响 {totalDelta >= 0 ? '+' : ''}¥{totalDelta.toFixed(2)}
            </Text>
          )}
          <Button
            icon={<IconSearch />}
            theme="solid"
            size="small"
            disabled={!baselineBom || !compareBom}
            onClick={computeDiff}
          >
            执行 Diff
          </Button>
        </Space>
      </div>

      {!computed ? (
        <Empty description="点击「执行 Diff」开始 BOM 对比" />
      ) : diffRows.length === 0 ? (
        <Empty description="两版 BOM 完全一致，无差异" />
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12}}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left'}}>
              <th style={{ padding: '6px 8px'}}>线束</th>
              <th style={{ padding: '6px 8px'}}>零件号</th>
              <th style={{ padding: '6px 8px'}}>名称</th>
              <th style={{ padding: '6px 8px', textAlign: 'center'}}>类型</th>
              <th style={{ padding: '6px 8px', textAlign: 'right'}}>原数量</th>
              <th style={{ padding: '6px 8px', textAlign: 'right'}}>新数量</th>
              <th style={{ padding: '6px 8px', textAlign: 'right'}}>原单价</th>
              <th style={{ padding: '6px 8px', textAlign: 'right'}}>新单价</th>
              <th style={{ padding: '6px 8px', textAlign: 'right'}}>成本影响</th>
            </tr>
          </thead>
          <tbody>
            {diffRows.map((row, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid #f0f0f0'}}>
                <td style={{ padding: '4px 8px', fontFamily: 'monospace'}}>{row.harnessId}</td>
                <td style={{ padding: '4px 8px', fontFamily: 'monospace'}}>{row.partNo}</td>
                <td style={{ padding: '4px 8px'}}>{row.partName}</td>
                <td style={{ padding: '4px 8px', textAlign: 'center'}}>
                  <span
                    style={{
                      fontSize: 10,
                      padding: '1px 6px',
                      borderRadius: 4,
                      background: `${CHANGE_COLORS[row.changeType]}18`,
                      color: CHANGE_COLORS[row.changeType],
                    }}
                  >
                    {CHANGE_LABELS[row.changeType]}
                  </span>
                </td>
                <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace'}}>{row.beforeQty}</td>
                <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace'}}>{row.afterQty}</td>
                <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace'}}>¥{row.beforePrice.toFixed(2)}</td>
                <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace'}}>¥{row.afterPrice.toFixed(2)}</td>
                <td
                  style={{
                    padding: '4px 8px',
                    textAlign: 'right',
                    fontFamily: 'monospace',
                    fontWeight: 600,
                    color: row.deltaAmount >= 0 ? '#dc2626' : '#16a34a',}}>
                  {row.deltaAmount >= 0 ? '+' : ''}¥{row.deltaAmount.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
