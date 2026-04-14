/**
 * StagnantReportPanel (C16 — Issue #73)
 * 
 * 呆滞物料提报面板
 * - 显示呆滞候选列表（料号/数量/天数/金额/状态）
 * - 采购可录入库存量和估值
 * - 一键批量提报
 * - 汇总卡片（总数/待提报/估值/平均超龄天数）
 * 
 * Usage:
 *   <StagnantReportPanel
 *     candidates={stagnantCandidates}
 *     summary={stagnantSummary}
 *     onUpdate={(itemId, updates) => updateStagnantItem(itemId, updates)}
 *     onBatchReport={(itemIds) => handleBatchReport(itemIds)}
 *   />
 */

import React, { useState, useMemo } from 'react';
import type { StagnantCandidate, StagnantSummary } from '@/engine/progress_price_tracker';

interface StagnantReportPanelProps {
  candidates: StagnantCandidate[];
  summary: StagnantSummary;
  onUpdate: (itemId: string, updates: Partial<StagnantCandidate>) => void;
  onBatchReport?: (itemIds: string[]) => void;
}

const STATUS_LABELS: Record<string, string> = {
  pending_report: '待提报',
  reported: '已提报',
  resolved: '已核销',
  reactivated: '已重新启用',
};

const STATUS_COLORS: Record<string, string> = {
  pending_report: '#faad14',
  reported: '#1890ff',
  resolved: '#52c41a',
  reactivated: '#722ed1',
};

const REASON_LABELS: Record<string, string> = {
  change_cancelled: '设变取消',
  version_missing: '版本缺失',
  obsolete: '老旧淘汰',
};

const S = {
  container: { padding: '16px' } as React.CSSProperties,
  summaryRow: { display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' as const } as React.CSSProperties,
  card: { flex: '1 1 140px', padding: '12px 16px', background: '#fafafa', borderRadius: '8px', textAlign: 'center' as const } as React.CSSProperties,
  cardValue: { fontSize: '24px', fontWeight: 600, color: '#262626' } as React.CSSProperties,
  cardLabel: { fontSize: '12px', color: '#8c8c8c', marginTop: '4px' } as React.CSSProperties,
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '13px' } as React.CSSProperties,
  th: { padding: '8px 12px', background: '#f5f5f5', borderBottom: '1px solid #e8e8e8', textAlign: 'left' as const, fontWeight: 500 } as React.CSSProperties,
  td: { padding: '8px 12px', borderBottom: '1px solid #f0f0f0' } as React.CSSProperties,
  badge: (color: string) => ({ display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', color: '#fff', background: color }) as React.CSSProperties,
  toolbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' } as React.CSSProperties,
  btn: { padding: '6px 16px', background: '#1890ff', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' } as React.CSSProperties,
  input: { width: '80px', padding: '4px 8px', border: '1px solid #d9d9d9', borderRadius: '4px', fontSize: '13px' } as React.CSSProperties,
};

export const StagnantReportPanel: React.FC<StagnantReportPanelProps> = ({
  candidates, summary, onUpdate, onBatchReport,
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const pendingItems = useMemo(
    () => candidates.filter(c => c.status === 'pending_report'),
    [candidates],
  );

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAllPending = () => {
    setSelectedIds(new Set(pendingItems.map(c => c.itemId)));
  };

  const handleBatchReport = () => {
    if (onBatchReport && selectedIds.size > 0) {
      onBatchReport(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
  };

  return (
    <div style={S.container}>
      {/* Summary cards */}
      <div style={S.summaryRow}>
        <div style={S.card}>
          <div style={S.cardValue}>{summary.totalCandidates}</div>
          <div style={S.cardLabel}>呆滞候选总数</div>
        </div>
        <div style={S.card}>
          <div style= ...S.cardValue, color: '#faad14' >{summary.pendingReportCount}</div>
          <div style={S.cardLabel}>待提报</div>
        </div>
        <div style={S.card}>
          <div style={S.cardValue}>
            {summary.totalEstimatedValue > 0 ? `¥${summary.totalEstimatedValue.toLocaleString()}` : '待录入'}
          </div>
          <div style={S.cardLabel}>估计呆滞金额</div>
        </div>
        <div style={S.card}>
          <div style={S.cardValue}>{summary.avgDaysObsolete}天</div>
          <div style={S.cardLabel}>平均超龄天数</div>
        </div>
      </div>

      {/* Toolbar */}
      <div style={S.toolbar}>
        <div style= fontSize: '14px', fontWeight: 500 >
          呆滞物料明细 ({candidates.length})
        </div>
        <div style= display: 'flex', gap: '8px' >
          <button style= ...S.btn, background: '#f5f5f5', color: '#262626'  onClick={selectAllPending}>
            全选待提报 ({pendingItems.length})
          </button>
          <button
            style= ...S.btn, opacity: selectedIds.size > 0 ? 1 : 0.5 
            onClick={handleBatchReport}
            disabled={selectedIds.size === 0}
          >
            批量提报 ({selectedIds.size})
          </button>
        </div>
      </div>

      {/* Table */}
      <table style={S.table}>
        <thead>
          <tr>
            <th style={S.th}>选择</th>
            <th style={S.th}>零件号</th>
            <th style={S.th}>名称</th>
            <th style={S.th}>原因</th>
            <th style={S.th}>BOM数量</th>
            <th style={S.th}>库存量</th>
            <th style={S.th}>估值 (¥)</th>
            <th style={S.th}>超龄天数</th>
            <th style={S.th}>状态</th>
          </tr>
        </thead>
        <tbody>
          {candidates.map(c => (
            <tr key={c.itemId}>
              <td style={S.td}>
                <input
                  type="checkbox"
                  checked={selectedIds.has(c.itemId)}
                  onChange={() => toggleSelect(c.itemId)}
                  disabled={c.status !== 'pending_report'}
                />
              </td>
              <td style= ...S.td, fontFamily: 'monospace' >{c.partNo}</td>
              <td style={S.td}>{c.partName}</td>
              <td style={S.td}>
                <span style={S.badge('#8c8c8c')}>
                  {REASON_LABELS[c.unmatchReason] || c.unmatchReason}
                </span>
              </td>
              <td style={S.td}>{c.lastKnownQty}</td>
              <td style={S.td}>
                <input
                  style={S.input}
                  type="number"
                  value={c.estimatedInventory ?? ''}
                  placeholder="录入"
                  onChange={e => onUpdate(c.itemId, {
                    estimatedInventory: e.target.value ? Number(e.target.value) : null,
                  })}
                />
              </td>
              <td style={S.td}>
                <input
                  style={S.input}
                  type="number"
                  value={c.estimatedValue ?? ''}
                  placeholder="录入"
                  onChange={e => onUpdate(c.itemId, {
                    estimatedValue: e.target.value ? Number(e.target.value) : null,
                  })}
                />
              </td>
              <td style= ...S.td, color: c.daysSinceObsolete >= 90 ? '#ff4d4f' : undefined >
                {c.daysSinceObsolete}
              </td>
              <td style={S.td}>
                <span style={S.badge(STATUS_COLORS[c.status] || '#8c8c8c')}>
                  {STATUS_LABELS[c.status] || c.status}
                </span>
              </td>
            </tr>
          ))}
          {candidates.length === 0 && (
            <tr>
              <td colSpan={9} style= ...S.td, textAlign: 'center', color: '#bfbfbf', padding: '32px' >
                暂无呆滞候选物料
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default StagnantReportPanel;
