/**
 * D10: BOM 视图分离 — 工程视图 / 成本视图 / 客户视图
 * 
 * 同一份 BOM 数据，三种不同展示角度:
 * - 工程视图: 展示全部字段，可编辑
 * - 成本视图: 聚焦成本分解，只读
 * - 客户视图: 脱敏后对外输出
 */
import { Tabs, TabPane, Typography, Tag } from '@douyinfe/semi-ui';
import { useState, useMemo } from 'react';
import type { BomItem, WireItem, HarnessResult } from '@/types/harness';
import { tField } from '@/lib/i18n';

const { Text, Title } = Typography;

export type BomViewMode = 'engineering' | 'cost' | 'customer';

interface BomViewSwitcherProps {
  bom: Array<BomItem | WireItem>;
  result?: HarnessResult;
  mode?: BomViewMode;
  onModeChange?: (mode: BomViewMode) => void;
  editable?: boolean;
  onBomChange?: (bom: Array<BomItem | WireItem>) => void;
  /** 客户视图脱敏字段 */
  maskedFields?: string[];
}

/** 各视图展示的列 */
const VIEW_COLUMNS: Record<BomViewMode, string[]> = {
  engineering: [
    'partNo', 'partName', 'itemCategory', 'spec', 'endGroup',
    'qty', 'unit', 'supplier', 'copperWeightPerUnit', 'aluminumWeightPerUnit',
    'crossSection', 'vehicleRatio', 'configType', 'sapNo',
  ],
  cost: [
    'partNo', 'partName', 'itemCategory', 'qty', 'unit',
    'unitPrice', 'amount', 'copperWeight', 'aluminumWeight',
    'materialCost', 'wasteCost', 'directLabor', 'manufacturing',
    'exFactoryPrice', 'deliveredPrice',
  ],
  customer: [
    'partNo', 'partName', 'itemCategory', 'qty', 'unit',
    'unitPrice', 'amount',
  ],
};

/** 脱敏处理 */
function maskValue(value: unknown, field: string, maskedFields: string[]): unknown {
  if (maskedFields.includes(field)) return '***';
  return value;
}

export default function BomViewSwitcher({
  bom,
  result,
  mode: controlledMode,
  onModeChange,
  editable = false,
  onBomChange,
  maskedFields = ['supplier', 'copperWeightPerUnit', 'aluminumWeightPerUnit'],
}: BomViewSwitcherProps) {
  const [internalMode, setInternalMode] = useState<BomViewMode>('engineering');
  const mode = controlledMode || internalMode;

  const handleModeChange = (newMode: string) => {
    const m = newMode as BomViewMode;
    setInternalMode(m);
    onModeChange?.(m);
  };

  const columns = VIEW_COLUMNS[mode];

  const tableRows = useMemo(() => {
    return bom.map((item, idx) => {
      const row: Record<string, unknown> = {};
      for (const col of columns) {
        let value = (item as any)[col];
        if (mode === 'customer') {
          value = maskValue(value, col, maskedFields);
        }
        row[col] = value;
      }
      return { key: idx, ...row };
    });
  }, [bom, columns, mode, maskedFields]);

  return (
    <div style= width: '100%' >
      <Tabs type="button" activeKey={mode} onChange={handleModeChange}>
        <TabPane tab={<span>🔧 工程视图</span>} itemKey="engineering" />
        <TabPane tab={<span>💰 成本视图</span>} itemKey="cost" />
        <TabPane tab={<span>👤 客户视图</span>} itemKey="customer" />
      </Tabs>

      <div style= marginTop: 12 >
        {mode === 'customer' && (
          <Tag color="orange" style= marginBottom: 8 >
            客户视图 — 已脱敏 ({maskedFields.length}个字段)
          </Tag>
        )}

        <table style= width: '100%', borderCollapse: 'collapse', fontSize: 13 >
          <thead>
            <tr style= background: '#f5f5f5' >
              <th style= padding: '6px 8px', borderBottom: '1px solid #ddd', textAlign: 'left' >#</th>
              {columns.map((col) => (
                <th key={col} style= padding: '6px 8px', borderBottom: '1px solid #ddd', textAlign: 'left', whiteSpace: 'nowrap' >
                  {tField(col)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableRows.map((row, idx) => (
              <tr key={row.key} style= borderBottom: '1px solid #eee' >
                <td style= padding: '4px 8px', color: '#999' >{idx + 1}</td>
                {columns.map((col) => (
                  <td key={col} style= padding: '4px 8px' >
                    {row[col] !== undefined && row[col] !== null ? String(row[col]) : '-'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {result && mode === 'cost' && (
          <div style= marginTop: 12, padding: 12, background: '#fafafa', borderRadius: 6 >
            <Title heading={6}>成本汇总</Title>
            <div style= display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 >
              <div><Text type="tertiary">材料成本</Text><br /><Text strong>{result.materialCost?.toFixed(2)}</Text></div>
              <div><Text type="tertiary">人工+制造</Text><br /><Text strong>{result.laborPlusMfg?.toFixed(2)}</Text></div>
              <div><Text type="tertiary">出厂价</Text><br /><Text strong>{result.exFactoryPrice?.toFixed(2)}</Text></div>
              <div><Text type="tertiary">到厂价</Text><br /><Text strong>{result.deliveredPrice?.toFixed(2)}</Text></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
