/**
 * D9: BOM 视图切换器
 * 工程视图 / 成本视图 / 客户视图 切换
 */
import { useState } from 'react';
import { Radio, Typography, Tag, Divider } from '@douyinfe/semi-ui';
import { tField } from '@/lib/i18n';
import type { CSSProperties } from 'react';

const { Text } = Typography;

export type BomViewMode = 'engineering' | 'cost' | 'customer';

interface BomViewSwitcherProps {
  value?: BomViewMode;
  onChange?: (mode: BomViewMode) => void;
  bomItemCount?: number;
}

const VIEW_DESCRIPTIONS: Record<BomViewMode, string> = {
  engineering: '全字段可编辑，包含规格、用量、单价、供应商等',
  cost: '只读视图，展示成本分解和金属权重',
  customer: '脱敏视图，仅展示可对外报价字段',
};

const S: Record<string, CSSProperties> = {
  container: { width: '100%' },
  radioGroup: { marginBottom: 8 },
  radioBtn: { padding: '6px 8px', display: 'inline-flex', alignItems: 'center', gap: 4 },
  radioInner: { padding: '4px 8px' },
  infoBar: { marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 },
  grid: { display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center' },
};

export default function BomViewSwitcher({ value = 'engineering', onChange, bomItemCount }: BomViewSwitcherProps) {
  const [mode, setMode] = useState<BomViewMode>(value);
  const currentMode = value ?? mode;

  const handleChange = (val: { target: { value: BomViewMode } }) => {
    const newMode = val.target.value;
    setMode(newMode);
    onChange?.(newMode);
  };

  return (
    <div style={S.container}>
      <div style={S.grid}>
        <Radio.Group
          type="button"
          value={currentMode}
          onChange={handleChange as any}
          style={S.radioGroup}
        >
          <Radio value="engineering" style={S.radioBtn}>
            <span style={S.radioInner}>🔧 {tField('engineeringView')}</span>
          </Radio>
          <Radio value="cost" style={S.radioBtn}>
            <span style={S.radioInner}>💰 {tField('costView')}</span>
          </Radio>
          <Radio value="customer" style={S.radioBtn}>
            <span style={S.radioInner}>👤 {tField('customerView')}</span>
          </Radio>
        </Radio.Group>
        {bomItemCount !== undefined && (
          <Tag size="small" color="blue">{bomItemCount} 行</Tag>
        )}
      </div>

      <div style={S.infoBar}>
        <Text type="tertiary" size="small">{VIEW_DESCRIPTIONS[currentMode]}</Text>
      </div>
    </div>
  );
}
