/**
 * manual_price_provider.test.ts
 * Phase 1 手动金属价格提供者测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ManualPriceProvider,
  createManualProvider,
  formatPriceDisplay,
  formatSpreadDisplay,
} from '../manual_price_provider';

describe('ManualPriceProvider', () => {
  let provider: ManualPriceProvider;

  beforeEach(() => {
    provider = new ManualPriceProvider(48);
  });

  describe('fetchPrices', () => {
    it('未录入时返回 success=false', async () => {
      const result = await provider.fetchPrices();
      expect(result.success).toBe(false);
      expect(result.copper).toBe(0);
      expect(result.error).toContain('尚未录入');
    });

    it('录入后返回正确价格', async () => {
      provider.setManualPrices({
        copper: 72150,
        aluminum: 19000,
        enteredAt: new Date().toISOString(),
        note: 'SMM 04-13',
      });

      const result = await provider.fetchPrices();
      expect(result.success).toBe(true);
      expect(result.copper).toBe(72150);
      expect(result.aluminum).toBe(19000);
      expect(result.source).toBe('manual');
    });
  });

  describe('checkStaleness', () => {
    it('未录入时返回 isStale=true', () => {
      const check = provider.checkStaleness();
      expect(check.isStale).toBe(true);
      expect(check.hoursSinceUpdate).toBe(Infinity);
    });

    it('刚录入时返回 isStale=false', () => {
      provider.setManualPrices({
        copper: 72000,
        aluminum: 19000,
        enteredAt: new Date().toISOString(),
      });

      const check = provider.checkStaleness();
      expect(check.isStale).toBe(false);
    });

    it('超过阈值后返回 isStale=true', () => {
      const twoDaysAgo = new Date(Date.now() - 49 * 60 * 60 * 1000).toISOString();
      provider.setManualPrices({
        copper: 72000,
        aluminum: 19000,
        enteredAt: twoDaysAgo,
      });

      const check = provider.checkStaleness();
      expect(check.isStale).toBe(true);
      expect(check.message).toContain('已过期');
    });

    it('自定义阈值生效', () => {
      provider.setStaleThreshold(1); // 1小时
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      provider.setManualPrices({
        copper: 72000,
        aluminum: 19000,
        enteredAt: twoHoursAgo,
      });

      expect(provider.checkStaleness().isStale).toBe(true);
    });
  });

  describe('getCurrentData', () => {
    it('未录入时返回 null', () => {
      expect(provider.getCurrentData()).toBeNull();
    });

    it('返回副本，修改不影响原始数据', () => {
      provider.setManualPrices({
        copper: 72000,
        aluminum: 19000,
        enteredAt: new Date().toISOString(),
      });

      const data = provider.getCurrentData();
      if (data) {
        data.copper = 99999;
      }
      expect(provider.getCurrentData()?.copper).toBe(72000);
    });
  });
});

describe('createManualProvider', () => {
  it('无初始数据时创建空 Provider', async () => {
    const p = createManualProvider();
    const result = await p.fetchPrices();
    expect(result.success).toBe(false);
  });

  it('有初始数据时直接可用', async () => {
    const p = createManualProvider({
      copper: 70000,
      aluminum: 18500,
      enteredAt: new Date().toISOString(),
    });

    const result = await p.fetchPrices();
    expect(result.success).toBe(true);
    expect(result.copper).toBe(70000);
  });
});

describe('格式化函数', () => {
  it('formatPriceDisplay 格式化价格', () => {
    const display = formatPriceDisplay(72150);
    expect(display).toContain('72');
    expect(display).toContain('/吨');
  });

  it('formatSpreadDisplay 正值带+号', () => {
    const display = formatSpreadDisplay(3750);
    expect(display).toContain('+');
  });

  it('formatSpreadDisplay 负值带-号', () => {
    const display = formatSpreadDisplay(-2000);
    expect(display).toContain('-');
  });
});
