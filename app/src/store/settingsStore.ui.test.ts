import { describe, it, expect, beforeEach } from 'vitest';
import { useSettingsStore } from './settingsStore';
import { act, renderHook } from '@testing-library/react';

describe('settingsStore', () => {
  beforeEach(() => {
    act(() => {
      useSettingsStore.getState().resetCostRates();
      useSettingsStore.setState({ themeMode: 'system' });
    });
  });

  it('has correct default values', () => {
    const { result } = renderHook(() => useSettingsStore());
    expect(result.current.defaultCostRates.laborRate).toBe(35);
    expect(result.current.themeMode).toBe('system');
    expect(result.current.displayCurrency).toBe('CNY');
  });

  it('updates theme mode', () => {
    const { result } = renderHook(() => useSettingsStore());
    act(() => {
      result.current.setThemeMode('dark');
    });
    expect(result.current.themeMode).toBe('dark');
  });

  it('updates cost rates incrementally', () => {
    const { result } = renderHook(() => useSettingsStore());
    act(() => {
      result.current.updateCostRates({ laborRate: 40 });
    });
    expect(result.current.defaultCostRates.laborRate).toBe(40);
    expect(result.current.defaultCostRates.mfgRate).toBe(46.69); // Unchanged
  });

  it('resets cost rates', () => {
    const { result } = renderHook(() => useSettingsStore());
    act(() => {
      result.current.updateCostRates({ laborRate: 100 });
      result.current.resetCostRates();
    });
    expect(result.current.defaultCostRates.laborRate).toBe(35);
  });
});
