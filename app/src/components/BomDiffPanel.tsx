/**
 * C10: BOM 版本差异可视化面板
 *
 * 功能：
 * - 变更类型筛选 tabs (全部/新增/删除/变更)
 * - 差异表格（高亮行 + 字段级 diff）
 * - 成本影响汇总卡片
 * - 导出摘要按钮
 *
 * 对应 Issue #64
 */

import React, { useMemo } from 'react';
import type { BomDiffResult, BomDiffRow } from '@/engine/bom_diff';
import type { DiffFilterType } from '@/hooks/useBomDiff';

// ─── Props ───────────────────────────────────────────────

export interface BomDiffPanelProps {
  diffResult: BomDiffResult | null;
  filteredRows: BomDiffRow[];
  filter: DiffFilterType;
  onFilterChange: (filter: DiffFilterType) => void;
  onExport: () => void;
  leftLabel?: string;
  rightLabel?: string;
  loading?: boolean;
}

// ─── Constants ───────────────────────────────────────────

const FILTER_TABS: Array<{ key: DiffFilterType; label: string; icon: string }> = [
  { key: 'all', label: '全部', icon: '📋' },
  { key: 'added', label: '新增', icon: '🟢' },
  { key: 'removed', label: '删除', icon: '🔴' },
  { key: 'modified', label: '变更', icon: '🟡' },
  { key: 'unchanged', label: '未变', icon: '⚪' },
];

const CHANGE_COLORS: Record<string, string> = {
  added: '#e6f7e6',
  removed: '#fde8e8',
  modified: '#fff7e6',
  unchanged: 'transparent',
};

const CHANGE_LABELS: Record<string, string> = {
  added: '新增',
  removed: '删除',
  modified: '变更',
  unchanged: '未变',
};

// ─── Component ───────────────────────────────────────────

export const BomDiffPanel: React.FC<BomDiffPanelProps> = ({
  diffResult,
  filteredRows,
  filter,
  onFilterChange,
  onExport,
  leftLabel = '旧版本',
  rightLabel = '新版本',
  loading = false,
}) => {
  const summaryCards = useMemo(() => {
    if (!diffResult) return null;
    const s = diffResult.summary;
    return [
      { label: '新增', count: s.added, color: '#52c41a' },
      { label: '删除', count: s.removed, color: '#ff4d4f' },
      { label: '变更', count: s.modified, color: '#faad14' },
      { label: '成本影响', count: null, value: s.totalCostImpact, color: s.totalCostImpact >= 0 ? '#ff4d4f' : '#52c41a' },
    ];
  }, [diffResult]);

  if (loading) {
    return <div style= padding: 40, textAlign: 'center', color: '#999' >正在计算 BOM 差异...</div>;
  }

  if (!diffResult) {
    return <div style= padding: 40, textAlign: 'center', color: '#999' >请选择两个 BOM 版本进行对比</div>;
  }

  return (
    <div style= display: 'flex', flexDirection: 'column', gap: 16 >
      {/* Header */}
      <div style= display: 'flex', justifyContent: 'space-between', alignItems: 'center' >
        <div style= display: 'flex', gap: 8, alignItems: 'center' >
          <span style= fontWeight: 600 >{leftLabel}</span>
          <span style= color: '#999' >→</span>
          <span style= fontWeight: 600 >{rightLabel}</span>
        </div>
        <button onClick={onExport} style= cursor: 'pointer', padding: '4px 12px', borderRadius: 4, border: '1px solid #d9d9d9', background: '#fff' >
          📋 导出摘要
        </button>
      </div>

      {/* Summary Cards */}
      {summaryCards && (
        <div style= display: 'flex', gap: 12, flexWrap: 'wrap' >
          {summaryCards.map((card, i) => (
            <div key={i} style={{ flex: '1 1 120px', padding: '12px 16px', borderRadius: 8, border: `1px solid ${card.color}20`, background: `${card.color}08` }}>
              <div style= fontSize: 12, color: '#666' >{card.label}</div>
              <div style= fontSize: 20, fontWeight: 700, color: card.color >
                {card.count !== null ? card.count : `${card.value! >= 0 ? '+' : ''}${card.value!.toFixed(2)}`}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filter Tabs */}
      <div style= display: 'flex', gap: 4 >
        {FILTER_TABS.map(tab => {
          const isActive = filter === tab.key;
          const count = tab.key === 'all' ? diffResult.rows.length : diffResult.rows.filter(r => r.changeType === tab.key).length;
          return (
            <button
              key={tab.key}
              onClick={() => onFilterChange(tab.key)}
              style=
                padding: '6px 12px', borderRadius: 4, cursor: 'pointer',
                border: isActive ? '1px solid #1677ff' : '1px solid #d9d9d9',
                background: isActive ? '#e6f4ff' : '#fff',
                color: isActive ? '#1677ff' : '#333', fontWeight: isActive ? 600 : 400,
              
            >
              {tab.icon} {tab.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Diff Table */}
      <div style= overflowX: 'auto' >
        <table style= width: '100%', borderCollapse: 'collapse', fontSize: 13 >
          <thead>
            <tr style= borderBottom: '2px solid #f0f0f0' >
              <th style={thStyle}>状态</th>
              <th style={thStyle}>物料号</th>
              <th style={thStyle}>物料名称</th>
              <th style={thStyle}>变更字段</th>
              <th style= ...thStyle, textAlign: 'right' >成本影响</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr><td colSpan={5} style= padding: 24, textAlign: 'center', color: '#999' >无匹配记录</td></tr>
            ) : (
              filteredRows.map((row, idx) => (
                <tr key={`${row.partNo}-${idx}`} style= background: CHANGE_COLORS[row.changeType], borderBottom: '1px solid #f0f0f0' >
                  <td style={tdStyle}>
                    <span style= padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 >
                      {CHANGE_LABELS[row.changeType]}
                    </span>
                  </td>
                  <td style= ...tdStyle, fontFamily: 'monospace', fontSize: 12 >{row.partNo}</td>
                  <td style={tdStyle}>{row.partName}</td>
                  <td style={tdStyle}>
                    {row.fieldChanges.length === 0
                      ? <span style= color: '#999' >—</span>
                      : row.fieldChanges.map((fc, fi) => (
                          <div key={fi} style= fontSize: 12, lineHeight: 1.6 >
                            <span style= color: '#999' >{fc.label}: </span>
                            <span style= textDecoration: 'line-through', color: '#ff4d4f' >{String(fc.oldValue ?? '-')}</span>
                            <span style= margin: '0 4px', color: '#999' >→</span>
                            <span style= color: '#52c41a', fontWeight: 600 >{String(fc.newValue ?? '-')}</span>
                          </div>
                        ))
                    }
                  </td>
                  <td style= ...tdStyle, textAlign: 'right', fontFamily: 'monospace' >
                    {row.costImpact !== 0 ? (
                      <span style= color: row.costImpact > 0 ? '#ff4d4f' : '#52c41a', fontWeight: 600 >
                        {row.costImpact > 0 ? '+' : ''}{row.costImpact.toFixed(2)}
                      </span>
                    ) : (
                      <span style= color: '#999' >—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const thStyle: React.CSSProperties = {
  padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#333', whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '8px 12px', verticalAlign: 'top',
};

export default BomDiffPanel;
