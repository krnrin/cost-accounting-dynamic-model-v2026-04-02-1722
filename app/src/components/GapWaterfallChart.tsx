/**
 * app/src/components/GapWaterfallChart.tsx
 * Gap 分析瀑布图组件
 *
 * 展示从「内部实绩成本」到「客户报价」的逐层拆解：
 * 铜价效应 → 铝价效应 → BOM用量差异 → 损耗差异 → 人工差异
 * → 制造费差异 → 管理费 → 利润 → 包装运输差异
 *
 * 颜色编码：
 * - metal_price: 蓝色系
 * - material: 灰色
 * - processing: 橙色系
 * - margin: 绿色系 (正值=有利润空间)
 * - logistics: 紫色
 * - 负值项: 红色边框标记
 */

import React, { useMemo } from 'react';
import type { GapAnalysis, GapWaterfallItem } from '@/types/gap_analysis';

// ══════════════════════════════════════════════════
// Props
// ══════════════════════════════════════════════════

export interface GapWaterfallChartProps {
  gap: GapAnalysis;
  /** 内部实绩总成本 (瀑布图起点) */
  internalCost: number;
  /** 客户报价 (瀑布图终点) */
  deliveredPrice: number;
  /** 线束名称 (标题) */
  harnessName?: string;
  /** 高度 (px) */
  height?: number;
}

// ══════════════════════════════════════════════════
// 颜色映射
// ══════════════════════════════════════════════════

const CATEGORY_COLORS: Record<GapWaterfallItem['category'], string> = {
  metal_price: '#3B82F6',  // 蓝色
  material:    '#6B7280',  // 灰色
  processing:  '#F59E0B',  // 橙色
  overhead:    '#8B5CF6',  // 紫色
  margin:      '#10B981',  // 绿色
  logistics:   '#A855F7',  // 紫色
};

const RISK_COLORS: Record<GapAnalysis['riskLevel'], string> = {
  safe:   '#10B981',
  watch:  '#F59E0B',
  danger: '#EF4444',
};

const RISK_LABELS: Record<GapAnalysis['riskLevel'], string> = {
  safe:   '✅ 安全',
  watch:  '⚠️ 关注',
  danger: '🚨 亏损',
};

// ══════════════════════════════════════════════════
// 条形数据计算
// ══════════════════════════════════════════════════

interface WaterfallBar {
  key: string;
  label: string;
  value: number;
  startY: number;   // 条形起始位置 (累计值)
  endY: number;     // 条形结束位置
  color: string;
  isNegative: boolean;
}

function computeBars(
  waterfall: GapWaterfallItem[],
  internalCost: number
): WaterfallBar[] {
  const bars: WaterfallBar[] = [];
  let cumulative = internalCost;

  for (const item of waterfall) {
    const startY = cumulative;
    const endY = cumulative + item.value;
    bars.push({
      key: item.key,
      label: item.label,
      value: item.value,
      startY,
      endY,
      color: item.value < 0 ? '#EF4444' : CATEGORY_COLORS[item.category],
      isNegative: item.value < 0,
    });
    cumulative = endY;
  }

  return bars;
}

// ══════════════════════════════════════════════════
// Component
// ══════════════════════════════════════════════════

export const GapWaterfallChart: React.FC<GapWaterfallChartProps> = ({
  gap,
  internalCost,
  deliveredPrice,
  harnessName,
  height = 320,
}) => {
  const bars = useMemo(() => computeBars(gap.waterfall, internalCost), [gap.waterfall, internalCost]);

  // 找到最大/最小值用于缩放
  const allValues = [internalCost, deliveredPrice, ...bars.map(b => b.startY), ...bars.map(b => b.endY)];
  const minVal = Math.min(...allValues) * 0.95;
  const maxVal = Math.max(...allValues) * 1.05;
  const range = maxVal - minVal || 1;

  // 条形宽度和间距
  const totalItems = bars.length + 2; // +2 for start/end markers
  const barWidth = Math.max(30, Math.min(60, 600 / totalItems));
  const chartWidth = totalItems * (barWidth + 12) + 40;

  const scaleY = (val: number) => height - 60 - ((val - minVal) / range) * (height - 80);

  return (
    <div className="gap-waterfall-chart" style= overflowX: 'auto' >
      {/* 标题栏 */}
      <div className="waterfall-header">
        <h4>
          {harnessName ? `${harnessName} · ` : ''}
          报价 vs 实绩 Gap 分析
        </h4>
        <div className="waterfall-summary">
          <span className="gap-total" style= color: RISK_COLORS[gap.riskLevel] >
            Gap: ¥{gap.totalGap.toFixed(2)} ({(gap.totalGapRate * 100).toFixed(1)}%)
          </span>
          <span className="gap-risk" style= color: RISK_COLORS[gap.riskLevel] >
            {RISK_LABELS[gap.riskLevel]}
          </span>
          {gap.riskReason && (
            <span className="gap-reason" title={gap.riskReason}>
              · {gap.riskReason}
            </span>
          )}
        </div>
      </div>

      {/* SVG 瀑布图 */}
      <svg
        width={chartWidth}
        height={height}
        viewBox={`0 0 ${chartWidth} ${height}`}
        className="waterfall-svg"
      >
        {/* 基准线 (零线 = 内部实绩) */}
        <line
          x1={0}
          y1={scaleY(internalCost)}
          x2={chartWidth}
          y2={scaleY(internalCost)}
          stroke="#D1D5DB"
          strokeDasharray="4 2"
          strokeWidth={1}
        />

        {/* 起始标记: 内部实绩 */}
        <g transform={`translate(20, 0)`}>
          <rect
            x={0}
            y={scaleY(internalCost)}
            width={barWidth}
            height={4}
            fill="#374151"
            rx={2}
          />
          <text
            x={barWidth / 2}
            y={scaleY(internalCost) - 8}
            textAnchor="middle"
            fontSize={11}
            fill="#374151"
            fontWeight="bold"
          >
            ¥{internalCost.toFixed(0)}
          </text>
          <text
            x={barWidth / 2}
            y={height - 8}
            textAnchor="middle"
            fontSize={10}
            fill="#6B7280"
          >
            实绩
          </text>
        </g>

        {/* 瀑布条形 */}
        {bars.map((bar, idx) => {
          const x = 20 + (idx + 1) * (barWidth + 12);
          const top = Math.min(scaleY(bar.startY), scaleY(bar.endY));
          const barH = Math.max(2, Math.abs(scaleY(bar.startY) - scaleY(bar.endY)));

          return (
            <g key={bar.key} transform={`translate(${x}, 0)`}>
              {/* 连接虚线 */}
              {idx > 0 && (
                <line
                  x1={-12}
                  y1={scaleY(bar.startY)}
                  x2={0}
                  y2={scaleY(bar.startY)}
                  stroke="#D1D5DB"
                  strokeDasharray="2 2"
                  strokeWidth={1}
                />
              )}

              {/* 条形 */}
              <rect
                x={0}
                y={top}
                width={barWidth}
                height={barH}
                fill={bar.color}
                opacity={0.85}
                rx={3}
              />

              {/* 值标签 */}
              <text
                x={barWidth / 2}
                y={top - 6}
                textAnchor="middle"
                fontSize={10}
                fill={bar.isNegative ? '#EF4444' : '#374151'}
                fontWeight={bar.isNegative ? 'bold' : 'normal'}
              >
                {bar.value >= 0 ? '+' : ''}{bar.value.toFixed(1)}
              </text>

              {/* 类别标签 */}
              <text
                x={barWidth / 2}
                y={height - 8}
                textAnchor="middle"
                fontSize={9}
                fill="#6B7280"
              >
                {bar.label}
              </text>
            </g>
          );
        })}

        {/* 终点标记: 客户报价 */}
        <g transform={`translate(${20 + (bars.length + 1) * (barWidth + 12)}, 0)`}>
          <rect
            x={0}
            y={scaleY(deliveredPrice)}
            width={barWidth}
            height={4}
            fill={RISK_COLORS[gap.riskLevel]}
            rx={2}
          />
          <text
            x={barWidth / 2}
            y={scaleY(deliveredPrice) - 8}
            textAnchor="middle"
            fontSize={11}
            fill={RISK_COLORS[gap.riskLevel]}
            fontWeight="bold"
          >
            ¥{deliveredPrice.toFixed(0)}
          </text>
          <text
            x={barWidth / 2}
            y={height - 8}
            textAnchor="middle"
            fontSize={10}
            fill="#6B7280"
          >
            报价
          </text>
        </g>
      </svg>

      {/* 图例 */}
      <div className="waterfall-legend">
        {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
          <span key={cat} className="legend-item">
            <span className="legend-dot" style= backgroundColor: color  />
            {{
              metal_price: '金属价格',
              material: 'BOM差异',
              processing: '加工费',
              overhead: '间接费',
              margin: '管理费+利润',
              logistics: '物流',
            }[cat]}
          </span>
        ))}
      </div>

      {/* 校验 */}
      {!gap.waterfallBalanced && (
        <div className="waterfall-warning">
          ⚠️ 瀑布图校验失败：各项之和与 totalGap 不一致
        </div>
      )}
    </div>
  );
};

export default GapWaterfallChart;
