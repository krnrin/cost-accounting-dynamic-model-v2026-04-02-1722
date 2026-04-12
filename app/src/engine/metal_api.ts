/**
 * 金属价格 API 接入模块
 * 
 * 支持多数据源: metals-api.com / commodities-api.com / 手动输入
 * 离线优先: localStorage 缓存 → API 请求 → 用户手动
 * 
 * 注: 大部分免费 API 有额度限制 (100~250 次/月)，
 * 本模块使用 TTL 缓存 + localStorage 持久化减少请求频率。
 */

export interface MetalPriceData {
  /** 铜价 (元/kg) */
  copper: number;
  /** 铝价 (元/kg) */
  aluminum: number;
  /** 数据来源标识 */
  source: string;
  /** 数据获取时间 (ISO-8601) */
  fetchedAt: string;
  /** 数据日期 (API 返回的日期) */
  dataDate?: string;
  /** 是否来自缓存 */
  fromCache: boolean;
}

export interface MetalPriceHistoryPoint {
  date: string;
  copper: number;
  aluminum: number;
}

export interface MetalApiConfig {
  /** API 密钥 (metals-api 或 commodities-api) */
  apiKey?: string;
  /** API 提供商 */
  provider?: 'metals-api' | 'commodities-api' | 'manual';
  /** 缓存 TTL (毫秒)，默认 4 小时 */
  cacheTtlMs?: number;
  /** 基准货币 (默认 CNY) */
  baseCurrency?: string;
}

/** localStorage key for cached prices */
const CACHE_KEY = 'metal_price_cache';
/** localStorage key for price history */
const HISTORY_KEY = 'metal_price_history';
/** Default cache TTL: 4 hours */
const DEFAULT_CACHE_TTL = 4 * 60 * 60 * 1000;
/** Max history entries to keep */
const MAX_HISTORY_ENTRIES = 90;

// --- API Response Parsing ---

/**
 * metals-api.com 响应格式:
 * { success: true, base: "USD", date: "2026-04-06",
 *   rates: { XCU: 0.000112, XAL: 0.000405 } }
 * 
 * 注意: rates 是 1 USD = X 单位金属 (盎司制), 需要转换
 */
export interface MetalsApiResponse {
  success: boolean;
  base: string;
  date: string;
  rates: Record<string, number>;
  error?: { code: number; info: string };
}

/**
 * 解析 metals-api 响应 → MetalPriceData
 * 
 * metals-api rates 格式: 1 USD = X oz of metal
 * 铜: 1 troy oz = 31.1035 g → 1 kg = 32.1507 troy oz
 * 铝: 以 metric ton 为单位 → 1 metric ton = 1000 kg
 * 
 * 简化: 直接使用 LME/SHFE 常见报价体系 (元/吨→元/kg)
 */
export function parseMetalsApiResponse(
  response: MetalsApiResponse,
  usdToCny: number = 7.25
): MetalPriceData | null {
  if (!response.success || !response.rates) return null;
  
  // metals-api copper symbol: XCU (per troy oz in USD)
  // metals-api aluminum symbol: XAL (per troy oz in USD)
  const cuRatePerOz = response.rates['XCU'];
  const alRatePerOz = response.rates['XAL'];
  
  if (!cuRatePerOz || !alRatePerOz) return null;
  
  // Convert: rate = 1/USD-per-oz → USD per oz = 1/rate
  // 1 troy oz = 31.1035g → 1 kg = 32.1507 troy oz
  const cuUsdPerOz = 1 / cuRatePerOz;
  const cuUsdPerKg = cuUsdPerOz * 32.1507;
  const cuCnyPerKg = cuUsdPerKg * usdToCny;
  
  const alUsdPerOz = 1 / alRatePerOz;
  const alUsdPerKg = alUsdPerOz * 32.1507;
  const alCnyPerKg = alUsdPerKg * usdToCny;
  
  return {
    copper: Math.round(cuCnyPerKg * 100) / 100,
    aluminum: Math.round(alCnyPerKg * 100) / 100,
    source: 'metals-api',
    fetchedAt: new Date().toISOString(),
    dataDate: response.date,
    fromCache: false,
  };
}

/**
 * 解析通用 JSON 格式的金属价格数据
 * 支持格式:
 *   { copper: number, aluminum: number } — 直接值 (元/kg)
 *   { cu: number, al: number } — 简写
 *   { copper_price: number, aluminum_price: number } — 带后缀
 */
export function parseGenericResponse(data: Record<string, unknown>): MetalPriceData | null {
  const copper = extractNumber(data, ['copper', 'cu', 'copper_price', 'cu_price', 'CU']);
  const aluminum = extractNumber(data, ['aluminum', 'aluminium', 'al', 'aluminum_price', 'al_price', 'AL']);
  
  if (copper === null || aluminum === null) return null;
  
  return {
    copper,
    aluminum,
    source: 'generic',
    fetchedAt: new Date().toISOString(),
    fromCache: false,
  };
}

function extractNumber(data: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const val = data[key];
    if (typeof val === 'number' && isFinite(val) && val > 0) return val;
    if (typeof val === 'string') {
      const parsed = parseFloat(val);
      if (isFinite(parsed) && parsed > 0) return parsed;
    }
  }
  return null;
}

// --- Cache Management ---

export function getCachedPrice(ttlMs: number = DEFAULT_CACHE_TTL): MetalPriceData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    
    const cached: MetalPriceData = JSON.parse(raw);
    const fetchedAt = new Date(cached.fetchedAt).getTime();
    const now = Date.now();
    
    if (now - fetchedAt > ttlMs) return null; // expired
    
    return { ...cached, fromCache: true };
  } catch {
    return null;
  }
}

export function setCachedPrice(data: MetalPriceData): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    appendHistory(data);
  } catch {
    // localStorage quota exceeded — ignore
  }
}

function appendHistory(data: MetalPriceData): void {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const history: MetalPriceHistoryPoint[] = raw ? JSON.parse(raw) : [];
    
    const dateKey = data.dataDate || data.fetchedAt.slice(0, 10);
    
    // Deduplicate by date
    const existing = history.findIndex(h => h.date === dateKey);
    const point: MetalPriceHistoryPoint = {
      date: dateKey,
      copper: data.copper,
      aluminum: data.aluminum,
    };
    
    if (existing >= 0) {
      history[existing] = point;
    } else {
      history.push(point);
    }
    
    // Keep only recent entries, sorted by date
    history.sort((a, b) => a.date.localeCompare(b.date));
    const trimmed = history.slice(-MAX_HISTORY_ENTRIES);
    
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  } catch {
    // ignore
  }
}

export function getPriceHistory(): MetalPriceHistoryPoint[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function clearPriceCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // ignore
  }
}

// --- API Fetcher ---

/**
 * 获取金属实时价格
 * 
 * 优先级: 内存缓存 → localStorage 缓存 → API 请求 → 返回 null
 * 
 * @param config API 配置
 * @returns MetalPriceData or null if all sources fail
 */
export async function fetchMetalPrices(config: MetalApiConfig = {}): Promise<MetalPriceData | null> {
  const ttl = config.cacheTtlMs ?? DEFAULT_CACHE_TTL;
  
  // 1. Check cache
  const cached = getCachedPrice(ttl);
  if (cached) return cached;
  
  // 2. Try API
  if (config.apiKey && config.provider) {
    try {
      const data = await fetchFromProvider(config);
      if (data) {
        setCachedPrice(data);
        return data;
      }
    } catch (e) {
      console.warn('Metal API fetch failed:', e);
    }
  }
  
  // 3. Return stale cache (ignore TTL) as last resort
  const stale = getCachedPrice(Infinity);
  if (stale) return { ...stale, fromCache: true };
  
  return null;
}

async function fetchFromProvider(config: MetalApiConfig): Promise<MetalPriceData | null> {
  const { apiKey, provider, baseCurrency = 'USD' } = config;
  if (!apiKey) return null;
  
  let url: string;
  
  switch (provider) {
    case 'metals-api':
      url = `https://metals-api.com/api/latest?access_key=${apiKey}&base=${baseCurrency}&symbols=XCU,XAL`;
      break;
    case 'commodities-api':
      url = `https://commodities-api.com/api/latest?access_key=${apiKey}&base=${baseCurrency}&symbols=XCU,XAL`;
      break;
    default:
      return null;
  }
  
  const response = await fetch(url, { 
    signal: AbortSignal.timeout(10000),
    headers: { 'Accept': 'application/json' },
  });
  
  if (!response.ok) return null;
  
  const json = await response.json() as MetalsApiResponse;
  return parseMetalsApiResponse(json);
}

/**
 * 手动设置金属价格 (用户直接输入)
 * 自动缓存到 localStorage
 */
export function setManualMetalPrices(copper: number, aluminum: number): MetalPriceData {
  const data: MetalPriceData = {
    copper,
    aluminum,
    source: 'manual',
    fetchedAt: new Date().toISOString(),
    fromCache: false,
  };
  setCachedPrice(data);
  return data;
}

// --- SHFE Reference Prices ---

/**
 * 上期所近月合约参考价 (元/吨)
 * 用于当 API 不可用时的参考估算
 * 每季度手动更新或通过 API 刷新
 */
export const SHFE_REFERENCE_PRICES = {
  /** 铜 (元/吨) — 约 2026Q1 参考价 */
  copper: 72000,
  /** 铝 (元/吨) — 约 2026Q1 参考价 */
  aluminum: 20500,
  /** 更新日期 */
  updatedAt: '2026-03-01',
};

/**
 * 将 SHFE 参考价 (元/吨) 转换为 元/kg
 */
export function shfeToPerKg(pricePerTon: number): number {
  return Math.round((pricePerTon / 1000) * 100) / 100;
}

/**
 * 获取 SHFE 参考价 (元/kg)
 */
export function getShfeReferencePrices(): { copper: number; aluminum: number } {
  return {
    copper: shfeToPerKg(SHFE_REFERENCE_PRICES.copper),
    aluminum: shfeToPerKg(SHFE_REFERENCE_PRICES.aluminum),
  };
}
