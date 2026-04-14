/**
 * 内部金属价格来源切换组件
 *
 * 用于 Gap 分析页面，切换内部实绩侧的金属基准：
 *   1. 财务发布基准价 (benchmark)
 *   2. 上海期货交易所现货价 (shfe_spot)
 *   3. 上海有色金属网现货价 (smm_spot)
 *
 * Phase 1: 手动录入 + 过期检测
 * Phase 2 (backlog): SMM API 自动拉取
 */
import { useState } from 'react';
import {
  RadioGroup,
  Radio,
  InputNumber,
  Button,
  Tag,
  Toast,
  Typography,
  Space,
  Tooltip,
} from '@douyinfe/semi-ui';
import { IconAlertTriangle, IconTick, IconRefresh } from '@douyinfe/semi-icons';
import {
  useInternalMetalStore,
  SOURCE_LABELS,
  type InternalMetalSource,
} from '@/store/internalMetalStore';

const { Text } = Typography;

interface InternalMetalSourceSwitchProps {
  /** 紧凑模式（只显示切换器，不显示录入表单） */
  compact?: boolean;
  /** 切换回调 */
  onSourceChange?: (source: InternalMetalSource) => void;
  /** 价格更新回调 */
  onPriceUpdate?: (source: InternalMetalSource, copper: number, aluminum: number) => void;
}

export function InternalMetalSourceSwitch({
  compact = false,
  onSourceChange,
  onPriceUpdate,
}: InternalMetalSourceSwitchProps) {
  const {
    activeSource,
    setActiveSource,
    updatePrice,
    getActivePrice,
    isStale,
    getStalenessLabel,
    getAllPriceSummary,
  } = useInternalMetalStore();

  const [editCopper, setEditCopper] = useState<number | undefined>(undefined);
  const [editAluminum, setEditAluminum] = useState<number | undefined>(undefined);
  const [editNote, setEditNote] = useState('');
  const [saving, setSaving] = useState(false);

  const activePrice = getActivePrice();
  const stale = isStale();
  const stalenessLabel = getStalenessLabel();
  const summary = getAllPriceSummary();

  const handleSwitch = (source: InternalMetalSource) => {
    setActiveSource(source);
    const price = useInternalMetalStore.getState().prices[source];
    setEditCopper(price.copper);
    setEditAluminum(price.aluminum);
    onSourceChange?.(source);
  };

  const handleSave = async () => {
    if (editCopper === undefined || editAluminum === undefined) {
      Toast.warning('请输入铜价和铝价');
      return;
    }
    setSaving(true);
    try {
      await updatePrice(activeSource, editCopper, editAluminum, editNote || undefined);
      onPriceUpdate?.(activeSource, editCopper, editAluminum);
      Toast.success(`${SOURCE_LABELS[activeSource]} 已更新`);
    } catch (err) {
      Toast.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style= display: 'flex', flexDirection: 'column', gap: 12 >
      {/* 来源切换 */}
      <div style= display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' >
        <Text strong style= fontSize: 13 >内部金属基准：</Text>
        <RadioGroup
          type="button"
          value={activeSource}
          onChange={(e) => handleSwitch(e.target.value as InternalMetalSource)}
        >
          <Radio value="benchmark">财务基准价</Radio>
          <Radio value="shfe_spot">SHFE 现货</Radio>
          <Radio value="smm_spot">SMM 现货</Radio>
        </RadioGroup>

        {stale ? (
          <Tooltip content={`${SOURCE_LABELS[activeSource]} ${stalenessLabel}，建议更新`}>
            <Tag color="orange" prefixIcon={<IconAlertTriangle />} size="small">
              {stalenessLabel}
            </Tag>
          </Tooltip>
        ) : (
          <Tag color="green" prefixIcon={<IconTick />} size="small">
            {stalenessLabel}
          </Tag>
        )}
      </div>

      {/* 当前价格展示 */}
      <div style= display: 'flex', gap: 24, flexWrap: 'wrap' >
        {summary.map((item) => (
          <div
            key={item.source}
            style=
              padding: '8px 14px',
              borderRadius: 8,
              background: item.source === activeSource ? 'rgba(37,99,235,0.06)' : 'rgba(0,0,0,0.02)',
              border: item.source === activeSource ? '1px solid rgba(37,99,235,0.2)' : '1px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.2s',
              minWidth: 160,
            
            onClick={() => handleSwitch(item.source)}
          >
            <div style= display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 >
              <Text strong style= fontSize: 12 >{item.label}</Text>
              {item.isStale && <Tag color="orange" size="small">过期</Tag>}
            </div>
            <div style= fontSize: 12, color: '#666' >
              铜 ¥{item.copper.toLocaleString()}/吨 · 铝 ¥{item.aluminum.toLocaleString()}/吨
            </div>
          </div>
        ))}
      </div>

      {/* 录入表单（非紧凑模式） */}
      {!compact && (
        <div
          style=
            display: 'flex',
            alignItems: 'flex-end',
            gap: 12,
            padding: '12px 0',
            borderTop: '1px solid rgba(0,0,0,0.06)',
            flexWrap: 'wrap',
          
        >
          <div>
            <Text style= fontSize: 12, color: '#999', display: 'block', marginBottom: 4 >
              铜价 (元/吨)
            </Text>
            <InputNumber
              value={editCopper ?? activePrice.copper}
              onChange={(v) => setEditCopper(v as number)}
              style= width: 140 
              min={0}
              step={100}
              prefix="¥"
            />
          </div>
          <div>
            <Text style= fontSize: 12, color: '#999', display: 'block', marginBottom: 4 >
              铝价 (元/吨)
            </Text>
            <InputNumber
              value={editAluminum ?? activePrice.aluminum}
              onChange={(v) => setEditAluminum(v as number)}
              style= width: 140 
              min={0}
              step={100}
              prefix="¥"
            />
          </div>
          <Button
            icon={<IconRefresh />}
            theme="solid"
            loading={saving}
            onClick={handleSave}
            style= height: 32 
          >
            更新 {SOURCE_LABELS[activeSource]}
          </Button>
        </div>
      )}
    </div>
  );
}
