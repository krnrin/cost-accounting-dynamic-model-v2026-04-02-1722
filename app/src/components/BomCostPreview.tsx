/**
 * D1: BOM 实时成本预览
 * 
 * 在 BOM 编辑区域侧边或底部实时显示:
 * - 当前材料成本
 * - 金属成本占比
 * - 与上次快照的差异
 * 
 * 随 BOM 数据变动实时重算 (debounced)
 */
import { useMemo, useEffect, useState, useRef, useCallback } from 'react';
import { Card, Typography, Descriptions, Tag, Spin, Tooltip } from '@douyinfe/semi-ui';
import { IconArrowUp, IconArrowDown, IconMinus } from '@douyinfe/semi-icons';
import type { BomItem, WireItem, HarnessResult } from '@/types/harness';
import type { CostRates, MetalPrices } from '@/types/project';
import { tField } from '@/lib/i18n';

const { Text, Title } = Typography;

interface BomCostPreviewProps {
  bom: Array<BomItem | WireItem>;
  costRates: CostRates;
  metalPrices: MetalPrices;
  /** 上一次报价结果 (用于 diff) */
  previousResult?: HarnessResult;
  /** 计算引擎 (injected) */
  computeEngine?: (bom: Array<BomItem | WireItem>, rates: CostRates, prices: MetalPrices) => HarnessResult;
  /** 紧凑模式 */
  compact?: boolean;
}

/** 简易成本计算 (不依赖引擎时的 fallback) */
function quickEstimate(
  bom: Array<BomItem | WireItem>,
  rates: CostRates,
  metalPrices: MetalPrices
): HarnessResult {
  let materialCost = 0;
  let copperWeight = 0;
  let aluminumWeight = 0;

  for (const item of bom) {
    const amount = (item.qty || 0) * (item.unitPrice || 0);
    materialCost += amount;

    if (item.itemCategory === 'wire') {
      const wire = item as WireItem;
      copperWeight += (wire.copperWeightPerUnit || 0) * (wire.qty || 0);
      aluminumWeight += (wire.aluminumWeightPerUnit || 0) * (wire.qty || 0);
    }
  }

  // 金属成本
  const metalCost = copperWeight * metalPrices.copper / 1000 + aluminumWeight * metalPrices.aluminum / 1000;

  const wasteCost = materialCost * rates.wasteRate;
  const directLabor = 0; // 需工时数据，预览时略过
  const manufacturing = 0;
  const laborPlusMfg = directLabor + manufacturing;
  const mgmtFee = (materialCost + wasteCost + laborPlusMfg) * rates.mgmtRate;
  const subtotal = materialCost + wasteCost + laborPlusMfg + mgmtFee;
  const profit = subtotal * rates.profitRate;
  const exFactoryPrice = subtotal + profit;
  const deliveredPrice = exFactoryPrice; // 包装运输需单独配置

  return {
    materialCost,
    wasteCost,
    directLabor,
    manufacturing,
    laborPlusMfg,
    mgmtFee,
    profit,
    exFactoryPrice,
    deliveredPrice,
    copperWeight,
    aluminumWeight,
    packTotal: 0,
    packSubtotal: 0,
    freightSubtotal: 0,
    frontHours: 0,
    backHours: 0,
    processHours: 0,
  } as HarnessResult;
}

/** Debounce hook */
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

/** 差异标签 */
function DiffTag({ current, previous, unit = '元' }: { current: number; previous?: number; unit?: string }) {
  if (previous === undefined) return null;
  const diff = current - previous;
  const rate = previous !== 0 ? (diff / previous) * 100 : 0;
  if (Math.abs(diff) < 0.01) {
    return <Tag size="small" color="grey"><IconMinus size="small" /> 无变化</Tag>;
  }
  return diff > 0 ? (
    <Tag size="small" color="red">
      <IconArrowUp size="small" /> +{diff.toFixed(2)}{unit} ({rate.toFixed(1)}%)
    </Tag>
  ) : (
    <Tag size="small" color="green">
      <IconArrowDown size="small" /> {diff.toFixed(2)}{unit} ({rate.toFixed(1)}%)
    </Tag>
  );
}

export default function BomCostPreview({
  bom,
  costRates,
  metalPrices,
  previousResult,
  computeEngine,
  compact = false,
}: BomCostPreviewProps) {
  const debouncedBom = useDebounce(bom, 300);
  const [computing, setComputing] = useState(false);

  const result = useMemo(() => {
    setComputing(true);
    try {
      if (computeEngine) {
        return computeEngine(debouncedBom, costRates, metalPrices);
      }
      return quickEstimate(debouncedBom, costRates, metalPrices);
    } finally {
      setComputing(false);
    }
  }, [debouncedBom, costRates, metalPrices, computeEngine]);

  const metalCostRatio = result.materialCost > 0
    ? ((result.copperWeight * metalPrices.copper / 1000 + result.aluminumWeight * metalPrices.aluminum / 1000) / result.materialCost * 100)
    : 0;

  if (compact) {
    return (
      <div style= display: 'flex', gap: '16px', alignItems: 'center', padding: '8px 12px', background: '#f7f8fa', borderRadius: '6px' >
        <Spin spinning={computing} size="small">
          <Text type="tertiary" size="small">材料成本</Text>
          <Text strong style= marginLeft: 4 >¥{result.materialCost.toFixed(2)}</Text>
          <DiffTag current={result.materialCost} previous={previousResult?.materialCost} />

          <Text type="tertiary" size="small" style= marginLeft: 16 >出厂价</Text>
          <Text strong style= marginLeft: 4 >¥{result.exFactoryPrice.toFixed(2)}</Text>
          <DiffTag current={result.exFactoryPrice} previous={previousResult?.exFactoryPrice} />

          <Text type="tertiary" size="small" style= marginLeft: 16 >金属占比</Text>
          <Text style= marginLeft: 4 >{metalCostRatio.toFixed(1)}%</Text>
        </Spin>
      </div>
    );
  }

  return (
    <Card
      title={
        <div style= display: 'flex', alignItems: 'center', gap: '8px' >
          <Title heading={6} style= margin: 0 >📊 实时成本预览</Title>
          {computing && <Spin size="small" />}
        </div>
      }
      style= marginTop: 12 
      bodyStyle= padding: '12px 16px' 
    >
      <Descriptions
        data={[
          { key: '材料成本', value: <><Text strong>¥{result.materialCost.toFixed(2)}</Text> <DiffTag current={result.materialCost} previous={previousResult?.materialCost} /></> },
          { key: '废品成本', value: `¥${result.wasteCost.toFixed(2)}` },
          { key: '管理费', value: `¥${result.mgmtFee.toFixed(2)}` },
          { key: '利润', value: `¥${result.profit.toFixed(2)}` },
          { key: '出厂价', value: <><Text strong style= color: '#0070f3' >¥{result.exFactoryPrice.toFixed(2)}</Text> <DiffTag current={result.exFactoryPrice} previous={previousResult?.exFactoryPrice} /></> },
          { key: '到厂价', value: <><Text strong style= color: '#d32f2f' >¥{result.deliveredPrice.toFixed(2)}</Text> <DiffTag current={result.deliveredPrice} previous={previousResult?.deliveredPrice} /></> },
          { key: '铜重', value: `${result.copperWeight.toFixed(3)} kg` },
          { key: '铝重', value: `${result.aluminumWeight.toFixed(3)} kg` },
          { key: '金属成本占比', value: <Tooltip content="金属成本/材料成本"><Tag color={metalCostRatio > 30 ? 'orange' : 'green'}>{metalCostRatio.toFixed(1)}%</Tag></Tooltip> },
        ]}
        row
        size="small"
      />
    </Card>
  );
}
