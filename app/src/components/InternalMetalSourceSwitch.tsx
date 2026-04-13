/**
 * app/src/components/InternalMetalSourceSwitch.tsx
 * 实绩侧金属价格源切换组件
 *
 * 三选一 SegmentedControl:
 * - 财务基准 (benchmark)
 * - 现货 (spot_shfe / spot_smm / manual)
 * - 手动录入 (manual) — Phase 1 主要入口
 *
 * 显示当前价格、价差、过期提醒
 */

import React, { useState, useCallback } from 'react';
import type { InternalMetalSource, InternalMetalConfig, DualMetalPrices } from '@/types/gap_analysis';
import type { StalenessCheck } from '@/engine/manual_price_provider';
import { formatPriceDisplay, formatSpreadDisplay } from '@/engine/manual_price_provider';

// ══════════════════════════════════════════════════
// Props
// ══════════════════════════════════════════════════

export interface InternalMetalSourceSwitchProps {
  /** 内部金属价格配置 */
  config: InternalMetalConfig;
  /** 当前选中源 */
  activeSource: InternalMetalSource;
  /** 客户口径铜价 (用于计算价差) */
  customerCopperPrice: number;
  /** 客户口径铝价 */
  customerAluminumPrice: number;
  /** 过期检测 */
  stalenessCheck: StalenessCheck | null;
  /** 切换事件 */
  onSourceChange: (source: InternalMetalSource) => void;
  /** 手动价格更新事件 */
  onManualPriceUpdate: (copper: number, aluminum: number, note?: string) => void;
}

// ══════════════════════════════════════════════════
// 源选项配置
// ══════════════════════════════════════════════════

interface SourceOption {
  key: InternalMetalSource;
  label: string;
  description: string;
}

const SOURCE_OPTIONS: SourceOption[] = [
  { key: 'benchmark', label: '财务基准', description: '财务发布的基准金属价' },
  { key: 'manual',    label: '手动现货', description: '手动录入现铜/现铝价格' },
];

// ══════════════════════════════════════════════════
// Component
// ══════════════════════════════════════════════════

export const InternalMetalSourceSwitch: React.FC<InternalMetalSourceSwitchProps> = ({
  config,
  activeSource,
  customerCopperPrice,
  customerAluminumPrice,
  stalenessCheck,
  onSourceChange,
  onManualPriceUpdate,
}) => {
  const [editMode, setEditMode] = useState(false);
  const [editCopper, setEditCopper] = useState('');
  const [editAluminum, setEditAluminum] = useState('');
  const [editNote, setEditNote] = useState('');

  // 获取当前源的价格
  const currentPrices = activeSource === 'benchmark'
    ? { copper: config.sources.benchmark.copper, aluminum: config.sources.benchmark.aluminum }
    : { copper: config.sources.spot.copper, aluminum: config.sources.spot.aluminum };

  // 计算价差
  const copperSpread = customerCopperPrice - currentPrices.copper;
  const aluminumSpread = customerAluminumPrice - currentPrices.aluminum;

  // 处理手动价格提交
  const handleManualSubmit = useCallback(() => {
    const cu = parseFloat(editCopper);
    const al = parseFloat(editAluminum);
    if (!isNaN(cu) && !isNaN(al) && cu > 0 && al > 0) {
      onManualPriceUpdate(cu, al, editNote || undefined);
      setEditMode(false);
      setEditCopper('');
      setEditAluminum('');
      setEditNote('');
    }
  }, [editCopper, editAluminum, editNote, onManualPriceUpdate]);

  return (
    <div className="internal-metal-source-switch">
      {/* 标题 */}
      <div className="section-header">
        <h4>实绩金属价格源</h4>
        {stalenessCheck?.isStale && (
          <span className="stale-badge" title={stalenessCheck.message}>
            ⚠️ 已过期
          </span>
        )}
      </div>

      {/* SegmentedControl */}
      <div className="source-tabs">
        {SOURCE_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            className={`source-tab ${activeSource === opt.key ? 'active' : ''}`}
            onClick={() => onSourceChange(opt.key)}
            title={opt.description}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* 价格展示卡片 */}
      <div className="price-display">
        <div className="price-row">
          <span className="price-label">铜</span>
          <span className="price-value">{formatPriceDisplay(currentPrices.copper)}</span>
          <span className={`price-spread ${copperSpread >= 0 ? 'positive' : 'negative'}`}>
            {formatSpreadDisplay(copperSpread)}
          </span>
        </div>
        <div className="price-row">
          <span className="price-label">铝</span>
          <span className="price-value">{formatPriceDisplay(currentPrices.aluminum)}</span>
          <span className={`price-spread ${aluminumSpread >= 0 ? 'positive' : 'negative'}`}>
            {formatSpreadDisplay(aluminumSpread)}
          </span>
        </div>

        {/* 来源信息 */}
        <div className="price-meta">
          {activeSource === 'benchmark' && (
            <span>版本: {config.sources.benchmark.version} · 生效: {config.sources.benchmark.effectiveDate}</span>
          )}
          {activeSource !== 'benchmark' && (
            <span>
              取价: {config.sources.spot.fetchedAt
                ? new Date(config.sources.spot.fetchedAt).toLocaleString('zh-CN')
                : '未录入'}
            </span>
          )}
        </div>
      </div>

      {/* 手动录入区域 */}
      {activeSource === 'manual' && (
        <div className="manual-input-area">
          {!editMode ? (
            <button
              className="edit-prices-btn"
              onClick={() => {
                setEditCopper(currentPrices.copper > 0 ? String(currentPrices.copper) : '');
                setEditAluminum(currentPrices.aluminum > 0 ? String(currentPrices.aluminum) : '');
                setEditMode(true);
              }}
            >
              {currentPrices.copper > 0 ? '更新价格' : '录入价格'}
            </button>
          ) : (
            <div className="manual-form">
              <div className="form-row">
                <label>现铜 (元/吨)</label>
                <input
                  type="number"
                  value={editCopper}
                  onChange={(e) => setEditCopper(e.target.value)}
                  placeholder="如 72150"
                  min={0}
                />
              </div>
              <div className="form-row">
                <label>现铝 (元/吨)</label>
                <input
                  type="number"
                  value={editAluminum}
                  onChange={(e) => setEditAluminum(e.target.value)}
                  placeholder="如 19800"
                  min={0}
                />
              </div>
              <div className="form-row">
                <label>备注</label>
                <input
                  type="text"
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  placeholder="如 SMM 04-13 上午报价"
                />
              </div>
              <div className="form-actions">
                <button className="btn-confirm" onClick={handleManualSubmit}>
                  确认
                </button>
                <button className="btn-cancel" onClick={() => setEditMode(false)}>
                  取消
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 过期提醒 */}
      {stalenessCheck && activeSource !== 'benchmark' && (
        <div className={`staleness-info ${stalenessCheck.isStale ? 'stale' : 'fresh'}`}>
          {stalenessCheck.message}
        </div>
      )}
    </div>
  );
};

export default InternalMetalSourceSwitch;
