/**
 * 金属价格预警引擎
 * 基于阈值规则生成预警提示
 */
import type { MetalPrices } from '@/types/project';

/** 预警阈值配置 */
export interface MetalAlertThresholds {
  copper: { warnPct: number; dangerPct: number };
  aluminum: { warnPct: number; dangerPct: number };
}

/** 预警级别 */
export type AlertLevel = 'normal' | 'warn' | 'danger';

/** 单项预警结果 */
export interface MetalAlertItem {
  metal: 'copper' | 'aluminum';
  label: string;
  basePrice: number;
  currentPrice: number;
  deltaPrice: number;
  deltaPct: number;
  level: AlertLevel;
  message: string;
}

/** 综合预警结果 */
export interface MetalAlertResult {
  hasAlert: boolean;
  maxLevel: AlertLevel;
  items: MetalAlertItem[];
}

/** 默认阈值 */
export const DEFAULT_METAL_THRESHOLDS: MetalAlertThresholds = {
  copper: { warnPct: 5, dangerPct: 10 },
  aluminum: { warnPct: 5, dangerPct: 10 },
};

/**
 * 计算金属价格预警
 * @param basePrices - 项目基准金属价格（定点时锁定）
 * @param currentPrices - 当前/实时金属价格
 * @param thresholds - 预警阈值配置
 */
export function computeMetalAlerts(
  basePrices: MetalPrices,
  currentPrices: MetalPrices,
  thresholds?: MetalAlertThresholds
): MetalAlertResult {
  const t = thresholds || DEFAULT_METAL_THRESHOLDS;
  const items: MetalAlertItem[] = [];

  // 铜价检测
  const cuBase = basePrices.copper || 0;
  const cuCurrent = currentPrices.copper || 0;
  if (cuBase > 0) {
    const cuDelta = cuCurrent - cuBase;
    const cuPct = (cuDelta / cuBase) * 100;
    const cuAbsPct = Math.abs(cuPct);
    let cuLevel: AlertLevel = 'normal';
    if (cuAbsPct >= t.copper.dangerPct) cuLevel = 'danger';
    else if (cuAbsPct >= t.copper.warnPct) cuLevel = 'warn';

    items.push({
      metal: 'copper',
      label: '铜价',
      basePrice: cuBase,
      currentPrice: cuCurrent,
      deltaPrice: cuDelta,
      deltaPct: cuPct,
      level: cuLevel,
      message: cuLevel === 'normal'
        ? `铜价变动 ${cuPct >= 0 ? '+' : ''}${cuPct.toFixed(1)}%，在安全范围内`
        : `铜价${cuPct > 0 ? '上涨' : '下跌'} ${cuAbsPct.toFixed(1)}%（${cuLevel === 'danger' ? '⚠️ 超出危险阈值' : '⚡ 触发预警阈值'}）`,
    });
  }

  // 铝价检测
  const alBase = basePrices.aluminum || 0;
  const alCurrent = currentPrices.aluminum || 0;
  if (alBase > 0) {
    const alDelta = alCurrent - alBase;
    const alPct = (alDelta / alBase) * 100;
    const alAbsPct = Math.abs(alPct);
    let alLevel: AlertLevel = 'normal';
    if (alAbsPct >= t.aluminum.dangerPct) alLevel = 'danger';
    else if (alAbsPct >= t.aluminum.warnPct) alLevel = 'warn';

    items.push({
      metal: 'aluminum',
      label: '铝价',
      basePrice: alBase,
      currentPrice: alCurrent,
      deltaPrice: alDelta,
      deltaPct: alPct,
      level: alLevel,
      message: alLevel === 'normal'
        ? `铝价变动 ${alPct >= 0 ? '+' : ''}${alPct.toFixed(1)}%，在安全范围内`
        : `铝价${alPct > 0 ? '上涨' : '下跌'} ${alAbsPct.toFixed(1)}%（${alLevel === 'danger' ? '⚠️ 超出危险阈值' : '⚡ 触发预警阈值'}）`,
    });
  }

  // 综合判断
  const alertItems = items.filter(i => i.level !== 'normal');
  const maxLevel: AlertLevel = items.some(i => i.level === 'danger')
    ? 'danger'
    : items.some(i => i.level === 'warn')
    ? 'warn'
    : 'normal';

  return {
    hasAlert: alertItems.length > 0,
    maxLevel,
    items,
  };
}

/**
 * 估算金属价格变动对单车成本的影响
 * @param basePrices - 基准金属价格
 * @param currentPrices - 当前金属价格
 * @param totalCopperWeight - 项目总铜重量 (kg)
 * @param totalAluminumWeight - 项目总铝重量 (kg)
 */
export function estimateMetalImpact(
  basePrices: MetalPrices,
  currentPrices: MetalPrices,
  totalCopperWeight: number,
  totalAluminumWeight: number
): { cuImpact: number; alImpact: number; totalImpact: number } {
  const cuBase = basePrices.copper || 0;
  const cuCurrent = currentPrices.copper || 0;
  const alBase = basePrices.aluminum || 0;
  const alCurrent = currentPrices.aluminum || 0;

  // 价格都是 元/吨，重量是 kg → 元/吨 × kg / 1000 = 元
  const cuImpact = ((cuCurrent - cuBase) / 1000) * totalCopperWeight;
  const alImpact = ((alCurrent - alBase) / 1000) * totalAluminumWeight;

  return {
    cuImpact,
    alImpact,
    totalImpact: cuImpact + alImpact,
  };
}
