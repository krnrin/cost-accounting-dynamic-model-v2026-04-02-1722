/**
 * 配置关系图 — HTML 圆点矩阵 + UpSet Plot
 * 行=线束(按功能位置分组), 列=车型配置
 * 点击配置列圆点 toggle 0↔1 (灰色=未选, 蓝色发光=已选)
 * draft: 可编辑 + 外部增删按钮
 * engineer_published: salesRatio 行可编辑
 * sales_published: 全部只读
 */
import { useState, useMemo, useCallback, useRef } from 'react';
import { Input, Button, Tooltip } from '@douyinfe/semi-ui';
import { IconPlus, IconClose } from '@douyinfe/semi-icons';
import type { HarnessInput, VehicleConfig, ConfigPublishState } from '@/types/harness';
import '@/styles/common.css';

interface Props {
  vehicleConfigs: VehicleConfig[];
  harnesses: HarnessInput[];
  publishState: ConfigPublishState;
  onAddConfig: () => void;
  onRemoveConfig: (configId: string) => void;
  onRenameConfig: (configId: string, name: string) => void;
  onToggleHarness: (configId: string, harnessId: string) => void;
  onUpdateSalesRatio: (configId: string, ratio: number) => void;
  onAddHarness: (harnessId: string, harnessName: string, functionalSlot: string) => void;
  onRemoveHarness: (harnessId: string) => void;
  onUpdateConfigType: (harnessId: string, configType: 'S' | 'O' | undefined) => void;
}

// Header background colors for config columns
const COL_BG = ['#dbeafe','#d1fae5','#fef3c7','#ede9fe','#fce7f3','#cffafe','#fee2e2','#ecfccb'];
const COL_TEXT = ['#1e40af','#065f46','#92400e','#5b21b6','#9d174d','#155e75','#991b1b','#3f6212'];

export default function ConfigSetDiagram({
  vehicleConfigs, harnesses, publishState,
  onAddConfig, onRemoveConfig, onRenameConfig,
  onToggleHarness, onUpdateSalesRatio,
  onAddHarness, onRemoveHarness, onUpdateConfigType,
}: Props) {
  const isDraft = publishState === 'draft';
  const isEngineerPub = publishState === 'engineer_published';
  const isSalesPub = publishState === 'sales_published';

  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [newSlot, setNewSlot] = useState('');

  const handleAddHarness = () => {
    const id = newId.trim();
    if (!id) return;
    if (harnesses.some(h => h.harnessId === id)) return;
    onAddHarness(id, newName.trim() || id, newSlot.trim() || id);
    setNewId(''); setNewName(''); setNewSlot('');
  };

  // Stable refs for callbacks
  const callbacksRef = useRef({ onRenameConfig, onToggleHarness, onUpdateSalesRatio, onUpdateConfigType, onAddHarness });
  callbacksRef.current = { onRenameConfig, onToggleHarness, onUpdateSalesRatio, onUpdateConfigType, onAddHarness };

  // Handle dot click — toggle harness in config
  const handleDotClick = useCallback((configId: string, harnessId: string) => {
    if (isSalesPub) return;
    callbacksRef.current.onToggleHarness(configId, harnessId);
  }, [isSalesPub]);

  // Handle sales ratio change
  const handleRatioBlur = useCallback((configId: string, value: string) => {
    const val = Number(value);
    if (!isNaN(val)) callbacksRef.current.onUpdateSalesRatio(configId, val);
  }, []);

  // UpSet Plot data computation
  const upsetData = useMemo(() => {
    if (vehicleConfigs.length === 0 || harnesses.length === 0) return null;

    // For each harness, compute membership key (which configs include it)
    const intersections = new Map<string, { key: boolean[]; harnessIds: string[]; harnessNames: string[] }>();
    for (const h of harnesses) {
      const key = vehicleConfigs.map(cfg => cfg.harnessIds.includes(h.harnessId));
      const keyStr = key.map(b => b ? '1' : '0').join(',');
      const existing = intersections.get(keyStr);
      if (existing) {
        existing.harnessIds.push(h.harnessId);
        existing.harnessNames.push(h.harnessName);
      } else {
        intersections.set(keyStr, { key, harnessIds: [h.harnessId], harnessNames: [h.harnessName] });
      }
    }

    // Sort by cardinality (number of configs in intersection) descending, then by count
    const sorted = [...intersections.values()].sort((a, b) => {
      const cardA = a.key.filter(Boolean).length;
      const cardB = b.key.filter(Boolean).length;
      if (cardB !== cardA) return cardB - cardA;
      return b.harnessIds.length - a.harnessIds.length;
    });

    // Per-config totals (for left bar chart)
    const configTotals = vehicleConfigs.map(cfg => cfg.harnessIds.length);

    return { intersections: sorted, configTotals };
  }, [vehicleConfigs, harnesses]);

  const ratioSum = vehicleConfigs.reduce((s, c) => s + c.salesRatio, 0);

  return (
    <div>
      {/* Toolbar — add/remove config & harness */}
      {isDraft && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Button size="small" icon={<IconPlus />} onClick={onAddConfig}>新增配置</Button>
          {vehicleConfigs.length > 0 && (
            <Tooltip content="删除最后一列配置">
              <Button size="small" theme="borderless"
                icon={<IconClose style={{ fontSize: 12 }} />}
                onClick={() => onRemoveConfig(vehicleConfigs[vehicleConfigs.length - 1]!.configId)} />
            </Tooltip>
          )}
          <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>|</span>
          <Input size="small" placeholder="功能位置" value={newSlot}
            onChange={setNewSlot} style={{ width: 90, fontSize: 11 }} />
          <Input size="small" placeholder="线束号" value={newId}
            onChange={setNewId} style={{ width: 110, fontSize: 11 }} />
          <Input size="small" placeholder="线束名称" value={newName}
            onChange={setNewName} style={{ width: 110, fontSize: 11 }} />
          <Button size="small" icon={<IconPlus />} disabled={!newId.trim()}
            onClick={handleAddHarness}>添加线束</Button>
          {harnesses.length > 0 && (
            <Tooltip content="删除最后一条线束">
              <Button size="small" theme="borderless"
                icon={<IconClose style={{ fontSize: 12 }} />}
                onClick={() => onRemoveHarness(harnesses[harnesses.length - 1]!.harnessId)} />
            </Tooltip>
          )}
        </div>
      )}

      {/* Ratio sum hint */}
      {isEngineerPub && (
        <div style={{ marginBottom: 8, fontSize: 12 }}>
          <span style={{ color: Math.abs(ratioSum - 1.0) > 0.005 ? 'var(--danger)' : 'var(--text-muted)' }}>
            销售比例合计: {ratioSum.toFixed(3)} {Math.abs(ratioSum - 1.0) > 0.005 ? '(应为 1.000)' : ''}
          </span>
        </div>
      )}

      {/* Dot matrix table */}
      <div style={{ overflowX: 'auto' }}>
        <table className="config-matrix">
          <thead>
            <tr>
              <th style={{ textAlign: 'left', minWidth: 90 }}>功能位置</th>
              <th style={{ textAlign: 'left', minWidth: 110 }}>线束号</th>
              <th style={{ textAlign: 'left', minWidth: 110 }}>线束名称</th>
              <th style={{ minWidth: 80 }}>标配/选配</th>
              {vehicleConfigs.map((cfg, ci) => (
                <th key={cfg.configId} style={{ minWidth: 60, background: COL_BG[ci % COL_BG.length], color: COL_TEXT[ci % COL_TEXT.length] }}>
                  {cfg.configName}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isEngineerPub && (
              <tr style={{ background: '#f9fafb' }}>
                <td className="fixed-col" style={{ fontWeight: 600, color: '#6b7280' }}>销售比例</td>
                <td className="fixed-col" />
                <td className="fixed-col" />
                <td className="fixed-col" />
                {vehicleConfigs.map(cfg => (
                  <td key={cfg.configId}>
                    <input
                      className="ratio-input"
                      type="number"
                      step="0.01"
                      defaultValue={cfg.salesRatio}
                      onBlur={e => handleRatioBlur(cfg.configId, e.target.value)}
                    />
                  </td>
                ))}
              </tr>
            )}
            {harnesses.map(h => {
              const configText = h.configType === 'S' ? 'S 标配' : h.configType === 'O' ? 'O 选配' : '—';
              return (
                <tr key={h.harnessId}>
                  <td className="fixed-col">{h.functionalSlot || h.harnessName}</td>
                  <td className="fixed-col" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{h.harnessId}</td>
                  <td className="fixed-col">{h.harnessName}</td>
                  <td style={{ color: '#6b7280' }}>{configText}</td>
                  {vehicleConfigs.map(cfg => {
                    const included = cfg.harnessIds.includes(h.harnessId);
                    return (
                      <td
                        key={cfg.configId}
                        className={`dot-cell${isSalesPub ? ' readonly' : ''}`}
                        data-v={included ? '1' : '0'}
                        onClick={() => handleDotClick(cfg.configId, h.harnessId)}
                      />
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* UpSet Plot */}
      {upsetData && upsetData.intersections.length > 0 && (
        <UpSetPlot
          intersections={upsetData.intersections}
          configNames={vehicleConfigs.map(c => c.configName)}
          configTotals={upsetData.configTotals}
        />
      )}
    </div>
  );
}

// ── UpSet Plot SVG Component ─────────────────────────────────────────────────

interface UpSetPlotProps {
  intersections: { key: boolean[]; harnessIds: string[]; harnessNames: string[] }[];
  configNames: string[];
  configTotals: number[];
}

function UpSetPlot({ intersections, configNames, configTotals }: UpSetPlotProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const nConfigs = configNames.length;
  const nIntersections = intersections.length;

  // Layout constants
  const LEFT_LABEL_W = 100;
  const LEFT_BAR_W = 60;
  const COL_W = 40;
  const ROW_H = 20;
  const BAR_AREA_H = 100;
  const GAP = 8;
  const DOT_R = 6;

  const matrixW = nIntersections * COL_W;
  const matrixH = nConfigs * ROW_H;
  const totalW = LEFT_LABEL_W + LEFT_BAR_W + GAP + matrixW + 20;
  const totalH = BAR_AREA_H + GAP + matrixH + 10;

  const maxCount = Math.max(...intersections.map(i => i.harnessIds.length), 1);
  const maxConfigTotal = Math.max(...configTotals, 1);

  const barX = (idx: number) => LEFT_LABEL_W + LEFT_BAR_W + GAP + idx * COL_W + COL_W / 2;
  const dotY = (cfgIdx: number) => BAR_AREA_H + GAP + cfgIdx * ROW_H + ROW_H / 2;

  return (
    <div style={{ marginTop: 16, position: 'relative' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
        配置集合交并关系 (UpSet Plot)
      </div>
      <svg width={totalW} height={totalH} style={{ display: 'block' }}>
        {/* Top bar chart */}
        {intersections.map((inter, idx) => {
          const count = inter.harnessIds.length;
          const barH = (count / maxCount) * (BAR_AREA_H - 20);
          const x = barX(idx);
          const isHovered = hoveredIdx === idx;
          return (
            <g key={idx}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{ cursor: 'pointer' }}>
              <rect
                x={x - COL_W / 2 + 4} y={BAR_AREA_H - barH}
                width={COL_W - 8} height={barH}
                rx={3}
                fill={isHovered ? '#1d4ed8' : '#2563eb'}
                opacity={isHovered ? 1 : 0.8}
              />
              <text x={x} y={BAR_AREA_H - barH - 4}
                textAnchor="middle" fontSize={10} fontWeight={600}
                fontFamily="'JetBrains Mono', monospace"
                fill="var(--text-primary)">
                {count}
              </text>
            </g>
          );
        })}

        {/* Left config labels + horizontal bar chart */}
        {configNames.map((name, ci) => {
          const y = dotY(ci);
          const barW = (configTotals[ci]! / maxConfigTotal) * LEFT_BAR_W;
          return (
            <g key={ci}>
              <text x={LEFT_LABEL_W - 4} y={y + 4}
                textAnchor="end" fontSize={11}
                fill="var(--text-secondary)">
                {name}
              </text>
              <rect
                x={LEFT_LABEL_W} y={y - 6}
                width={barW} height={12}
                rx={2}
                fill="#94a3b8" opacity={0.4}
              />
              <text x={LEFT_LABEL_W + barW + 3} y={y + 4}
                fontSize={9} fontFamily="'JetBrains Mono', monospace"
                fill="var(--text-muted)">
                {configTotals[ci]}
              </text>
            </g>
          );
        })}

        {/* Dot matrix + connecting lines */}
        {intersections.map((inter, idx) => {
          const x = barX(idx);
          const activeDots = inter.key.map((active, ci) => ({ active, ci })).filter(d => d.active);
          const isHovered = hoveredIdx === idx;

          return (
            <g key={idx}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}>
              {/* Vertical connecting line between active dots */}
              {activeDots.length > 1 && (
                <line
                  x1={x} y1={dotY(activeDots[0]!.ci)}
                  x2={x} y2={dotY(activeDots[activeDots.length - 1]!.ci)}
                  stroke={isHovered ? '#1d4ed8' : '#2563eb'}
                  strokeWidth={2}
                  opacity={isHovered ? 1 : 0.7}
                />
              )}
              {/* All dots */}
              {inter.key.map((active, ci) => (
                <circle key={ci}
                  cx={x} cy={dotY(ci)} r={DOT_R}
                  fill={active ? (isHovered ? '#1d4ed8' : '#2563eb') : '#e5e7eb'}
                  stroke={active ? 'none' : '#d1d5db'}
                  strokeWidth={active ? 0 : 1}
                  opacity={active && isHovered ? 1 : active ? 0.8 : 0.5}
                />
              ))}
            </g>
          );
        })}

        {/* Horizontal grid lines for matrix */}
        {configNames.map((_, ci) => (
          <line key={ci}
            x1={LEFT_LABEL_W + LEFT_BAR_W + GAP - 4}
            y1={dotY(ci)}
            x2={LEFT_LABEL_W + LEFT_BAR_W + GAP + matrixW}
            y2={dotY(ci)}
            stroke="rgba(0,0,0,0.04)" strokeWidth={1}
          />
        ))}
      </svg>

      {/* Tooltip */}
      {hoveredIdx !== null && (() => {
        const inter = intersections[hoveredIdx]!;
        const x = barX(hoveredIdx);
        return (
          <div style={{
            position: 'absolute',
            left: x - 60,
            top: BAR_AREA_H + GAP + configNames.length * ROW_H + 4,
            background: 'rgba(255,255,255,0.95)',
            border: '1px solid rgba(0,0,0,0.1)',
            borderRadius: 8,
            padding: '6px 10px',
            fontSize: 11,
            color: 'var(--text-secondary)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            zIndex: 10,
            minWidth: 120,
            pointerEvents: 'none',
          }}>
            <div style={{ fontWeight: 600, marginBottom: 2 }}>
              {inter.harnessIds.length} 根线束
            </div>
            {inter.harnessIds.map((hid, i) => (
              <div key={hid} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10 }}>
                {hid} {inter.harnessNames[i] !== hid ? `(${inter.harnessNames[i]})` : ''}
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}
