import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  parseMetalsApiResponse,
  parseGenericResponse,
  getCachedPrice,
  setCachedPrice,
  clearPriceCache,
  getPriceHistory,
  setManualMetalPrices,
  shfeToPerKg,
  getShfeReferencePrices,
  SHFE_REFERENCE_PRICES,
  type MetalsApiResponse,
  type MetalPriceData,
} from '../metal_api';

// Mock localStorage
const storage = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
  clear: () => storage.clear(),
  get length() { return storage.size; },
  key: (_i: number) => null,
};

vi.stubGlobal('localStorage', localStorageMock);

beforeEach(() => {
  storage.clear();
});

describe('parseMetalsApiResponse', () => {
  it('should parse valid metals-api response', () => {
    const response: MetalsApiResponse = {
      success: true,
      base: 'USD',
      date: '2026-04-06',
      rates: {
        XCU: 0.000112,  // 1 USD = 0.000112 oz of copper → 1 oz = ~$8928
        XAL: 0.000405,  // 1 USD = 0.000405 oz of aluminum → 1 oz = ~$2469
      },
    };

    const result = parseMetalsApiResponse(response, 7.25);
    expect(result).not.toBeNull();
    expect(result!.copper).toBeGreaterThan(0);
    expect(result!.aluminum).toBeGreaterThan(0);
    expect(result!.source).toBe('metals-api');
    expect(result!.dataDate).toBe('2026-04-06');
    expect(result!.fromCache).toBe(false);
  });

  it('should return null for failed response', () => {
    const response: MetalsApiResponse = {
      success: false,
      base: 'USD',
      date: '2026-04-06',
      rates: {},
      error: { code: 101, info: 'Invalid API key' },
    };
    expect(parseMetalsApiResponse(response)).toBeNull();
  });

  it('should return null when missing metal symbols', () => {
    const response: MetalsApiResponse = {
      success: true,
      base: 'USD',
      date: '2026-04-06',
      rates: { XAU: 0.0005 }, // only gold, no copper/aluminum
    };
    expect(parseMetalsApiResponse(response)).toBeNull();
  });

  it('should calculate reasonable price with given exchange rate', () => {
    // LME copper ~$8500/ton = $8.5/kg → ¥61.6/kg
    // 1 oz = 31.1g → 1 ton = 32150.7 oz → $8500/32150.7 = $0.2644/oz
    // rate = 1/0.2644 = 3.782 → no, the rate is 1 USD = X oz
    // If copper = $8500/ton: $8.5/kg → $0.2644/oz → rate = 1/$0.2644 = ~3.782? No...
    // metals-api: rate is inverse: 1 base currency = X oz of metal
    // So if copper = $8.5/kg = $0.2644/oz, then 1 USD buys 1/8.5*1000/32.1507 oz
    // Actually rate = 1 USD / (USD per oz) = 1 / 0.2644 ≈ 3.782 
    // Wait no: rate = amount of metal per 1 USD
    // 1 USD / $0.2644 per oz = 3.782 oz per USD? That's WAY too much...
    // Let me reconsider: copper at $9000/metric ton = $9/kg
    // 1 kg = 32.1507 troy oz → $9/kg = $9/32.1507 per oz = $0.28 per oz
    // rate = 1 USD / $0.28 per oz ≈ 3.57 oz? No this is also wrong
    // Actually the API rate means: 1 USD = rate units of commodity
    // So if copper = $0.28/oz, then 1 USD = 1/0.28 = 3.57 oz → rate = 3.57
    // Hmm no. Let me re-examine the real API behavior.
    // metals-api: for XAU (gold at ~$2000/oz): rate ≈ 0.0005
    // This means: 1 USD = 0.0005 oz gold → 1 oz = $2000. Correct!
    // So: 1 USD = rate oz → 1 oz = 1/rate USD → USD/oz = 1/rate
    // For copper at $9000/ton: per oz = $9000/1000/31.1035*1000 = $9/kg
    // Actually copper is LME traded per metric ton, not per troy oz
    // metals-api converts to troy oz: copper $9000/ton = $0.2894/troy oz
    // rate = 1/0.2894 ≈ 3.455... hmm the example above used 0.000112 which is tiny
    // That would mean 1 oz = 1/0.000112 = $8928.57 per oz
    // $8928.57 per oz × 32.1507 oz/kg = $287,066/kg → way too high for copper
    // So 0.000112 doesn't match reality for copper
    // Real scenario: copper ~$9/kg, so let's use a realistic rate
    
    // Use more realistic values
    // Copper: $9/kg → $9/(32.1507) per oz = $0.28/oz → rate = 1/0.28 = 3.571
    // Aluminum: $2.5/kg → $2.5/(32.1507) per oz = $0.0778/oz → rate = 1/0.0778 = 12.857
    const response: MetalsApiResponse = {
      success: true,
      base: 'USD',
      date: '2026-04-06',
      rates: { XCU: 3.571, XAL: 12.857 },
    };
    const result = parseMetalsApiResponse(response, 7.25);
    expect(result).not.toBeNull();
    // copper: 1/3.571 $/oz × 32.1507 oz/kg × 7.25 CNY/$ ≈ 65.2 CNY/kg
    expect(result!.copper).toBeGreaterThan(50);
    expect(result!.copper).toBeLessThan(90);
    // aluminum: 1/12.857 $/oz × 32.1507 oz/kg × 7.25 CNY/$ ≈ 18.1 CNY/kg
    expect(result!.aluminum).toBeGreaterThan(10);
    expect(result!.aluminum).toBeLessThan(30);
  });
});

describe('parseGenericResponse', () => {
  it('should parse copper/aluminum keys', () => {
    const result = parseGenericResponse({ copper: 72, aluminum: 20.5 });
    expect(result).not.toBeNull();
    expect(result!.copper).toBe(72);
    expect(result!.aluminum).toBe(20.5);
    expect(result!.source).toBe('generic');
  });

  it('should parse short-form keys (cu/al)', () => {
    const result = parseGenericResponse({ cu: 72, al: 20.5 });
    expect(result).not.toBeNull();
    expect(result!.copper).toBe(72);
    expect(result!.aluminum).toBe(20.5);
  });

  it('should parse _price suffix keys', () => {
    const result = parseGenericResponse({ copper_price: 72, aluminum_price: 20.5 });
    expect(result).not.toBeNull();
    expect(result!.copper).toBe(72);
    expect(result!.aluminum).toBe(20.5);
  });

  it('should parse string values', () => {
    const result = parseGenericResponse({ copper: '72.5', aluminum: '20.5' });
    expect(result).not.toBeNull();
    expect(result!.copper).toBe(72.5);
  });

  it('should return null for missing keys', () => {
    expect(parseGenericResponse({ gold: 500 })).toBeNull();
  });

  it('should return null for zero/negative values', () => {
    expect(parseGenericResponse({ copper: 0, aluminum: 20 })).toBeNull();
    expect(parseGenericResponse({ copper: -5, aluminum: 20 })).toBeNull();
  });
});

describe('Cache', () => {
  it('should store and retrieve cached price', () => {
    const data: MetalPriceData = {
      copper: 72, aluminum: 20.5,
      source: 'test', fetchedAt: new Date().toISOString(), fromCache: false,
    };
    setCachedPrice(data);
    const cached = getCachedPrice();
    expect(cached).not.toBeNull();
    expect(cached!.copper).toBe(72);
    expect(cached!.fromCache).toBe(true);
  });

  it('should return null for expired cache', () => {
    const data: MetalPriceData = {
      copper: 72, aluminum: 20.5,
      source: 'test',
      fetchedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5 hours ago
      fromCache: false,
    };
    setCachedPrice(data);
    // Default TTL is 4 hours
    expect(getCachedPrice()).toBeNull();
  });

  it('should return cache within TTL', () => {
    const data: MetalPriceData = {
      copper: 72, aluminum: 20.5,
      source: 'test',
      fetchedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // 3 hours ago
      fromCache: false,
    };
    setCachedPrice(data);
    expect(getCachedPrice()).not.toBeNull();
  });

  it('should clear cache', () => {
    setCachedPrice({
      copper: 72, aluminum: 20.5,
      source: 'test', fetchedAt: new Date().toISOString(), fromCache: false,
    });
    clearPriceCache();
    expect(getCachedPrice()).toBeNull();
  });
});

describe('Price History', () => {
  it('should append and retrieve history', () => {
    setCachedPrice({
      copper: 72, aluminum: 20.5,
      source: 'test', fetchedAt: '2026-04-01T10:00:00Z',
      dataDate: '2026-04-01', fromCache: false,
    });
    setCachedPrice({
      copper: 73, aluminum: 21,
      source: 'test', fetchedAt: '2026-04-02T10:00:00Z',
      dataDate: '2026-04-02', fromCache: false,
    });

    const history = getPriceHistory();
    expect(history).toHaveLength(2);
    expect(history[0].date).toBe('2026-04-01');
    expect(history[1].date).toBe('2026-04-02');
    expect(history[1].copper).toBe(73);
  });

  it('should deduplicate by date', () => {
    setCachedPrice({
      copper: 72, aluminum: 20.5,
      source: 'test', fetchedAt: '2026-04-01T08:00:00Z',
      dataDate: '2026-04-01', fromCache: false,
    });
    setCachedPrice({
      copper: 73, aluminum: 21,
      source: 'test', fetchedAt: '2026-04-01T16:00:00Z',
      dataDate: '2026-04-01', fromCache: false,
    });

    const history = getPriceHistory();
    expect(history).toHaveLength(1);
    expect(history[0].copper).toBe(73); // latest value
  });
});

describe('Manual Price Setting', () => {
  it('should set and cache manual prices', () => {
    const result = setManualMetalPrices(72, 20.5);
    expect(result.copper).toBe(72);
    expect(result.aluminum).toBe(20.5);
    expect(result.source).toBe('manual');

    const cached = getCachedPrice();
    expect(cached).not.toBeNull();
    expect(cached!.copper).toBe(72);
  });
});

describe('SHFE Reference', () => {
  it('should convert ton to kg', () => {
    expect(shfeToPerKg(72000)).toBe(72);
    expect(shfeToPerKg(20500)).toBe(20.5);
  });

  it('should return reference prices in kg', () => {
    const ref = getShfeReferencePrices();
    expect(ref.copper).toBe(shfeToPerKg(SHFE_REFERENCE_PRICES.copper));
    expect(ref.aluminum).toBe(shfeToPerKg(SHFE_REFERENCE_PRICES.aluminum));
    expect(ref.copper).toBeGreaterThan(50);
    expect(ref.aluminum).toBeGreaterThan(10);
  });
});
