/**
 * app/src/engine/manual_price_provider.ts
 * Phase 1: 手动录入金属价格提供者
 *
 * 设计意图：
 * - 用户手动输入现铜/现铝价格
 * - 检测价格是否过期 (超过 staleThresholdHours 未更新)
 * - 未来替换为 SMM API 时，只需新增 SmmApiProvider，UI 不变
 */

import type {
  MetalPriceProvider,
  MetalPriceFetchResult,
  InternalMetalSource,
} from '@/types/gap_analysis';

/** 手动录入的价格数据 */
export interface ManualPriceData {
  copper: number;
  aluminum: number;
  /** 录入时间 ISO */
  enteredAt: string;
  /** 录入人 (可选) */
  enteredBy?: string;
  /** 备注 (如 "SMM 04-13 上午报价") */
  note?: string;
}

/** 过期检测结果 */
export interface StalenessCheck {
  isStale: boolean;
  /** 距上次更新的小时数 */
  hoursSinceUpdate: number;
  /** 阈值 (小时) */
  thresholdHours: number;
  /** 提示信息 */
  message: string;
}

/**
 * ManualPriceProvider — Phase 1 手动录入实现
 */
export class ManualPriceProvider implements MetalPriceProvider {
  name = '手动录入';
  source: InternalMetalSource = 'manual';
  isAutomatic = false;

  private _data: ManualPriceData | null = null;
  private _staleThresholdHours: number;

  /**
   * @param staleThresholdHours 过期阈值 (默认 48 小时)
   */
  constructor(staleThresholdHours = 48) {
    this._staleThresholdHours = staleThresholdHours;
  }

  /** 设置手动录入的价格 */
  setManualPrices(data: ManualPriceData): void {
    this._data = {
      ...data,
      enteredAt: data.enteredAt || new Date().toISOString(),
    };
  }

  /** 获取当前价格 */
  async fetchPrices(): Promise<MetalPriceFetchResult> {
    if (!this._data) {
      return {
        copper: 0,
        aluminum: 0,
        timestamp: new Date().toISOString(),
        source: 'manual',
        success: false,
        error: '尚未录入金属价格，请手动输入现铜/现铝价格',
      };
    }

    return {
      copper: this._data.copper,
      aluminum: this._data.aluminum,
      timestamp: this._data.enteredAt,
      source: 'manual',
      success: true,
    };
  }

  /** 检测价格是否过期 */
  checkStaleness(): StalenessCheck {
    if (!this._data) {
      return {
        isStale: true,
        hoursSinceUpdate: Infinity,
        thresholdHours: this._staleThresholdHours,
        message: '尚未录入金属价格',
      };
    }

    const now = Date.now();
    const enteredAt = new Date(this._data.enteredAt).getTime();
    const hoursSinceUpdate = (now - enteredAt) / (1000 * 60 * 60);
    const isStale = hoursSinceUpdate > this._staleThresholdHours;

    let message: string;
    if (isStale) {
      const days = Math.floor(hoursSinceUpdate / 24);
      message = `现货价格已过期 (${days}天前更新)，建议更新`;
    } else {
      const hoursLeft = Math.ceil(this._staleThresholdHours - hoursSinceUpdate);
      message = `价格有效，${hoursLeft}小时后需更新`;
    }

    return {
      isStale,
      hoursSinceUpdate: Math.round(hoursSinceUpdate * 10) / 10,
      thresholdHours: this._staleThresholdHours,
      message,
    };
  }

  /** 获取当前数据 (供 UI 展示) */
  getCurrentData(): ManualPriceData | null {
    return this._data ? { ...this._data } : null;
  }

  /** 更新过期阈值 */
  setStaleThreshold(hours: number): void {
    this._staleThresholdHours = Math.max(1, hours);
  }
}

/**
 * createManualProvider — 工厂函数
 */
export function createManualProvider(
  initialData?: ManualPriceData,
  staleThresholdHours = 48
): ManualPriceProvider {
  const provider = new ManualPriceProvider(staleThresholdHours);
  if (initialData) {
    provider.setManualPrices(initialData);
  }
  return provider;
}

/**
 * formatPriceDisplay — 格式化金属价格显示
 * @example formatPriceDisplay(72150) => "¥72,150/吨"
 */
export function formatPriceDisplay(pricePerTon: number): string {
  return `¥${pricePerTon.toLocaleString('zh-CN')}/吨`;
}

/**
 * formatSpreadDisplay — 格式化价差显示
 * @example formatSpreadDisplay(3750) => "+¥3,750/吨"
 * @example formatSpreadDisplay(-2000) => "-¥2,000/吨"
 */
export function formatSpreadDisplay(spread: number): string {
  const sign = spread >= 0 ? '+' : '-';
  return `${sign}¥${Math.abs(spread).toLocaleString('zh-CN')}/吨`;
}
