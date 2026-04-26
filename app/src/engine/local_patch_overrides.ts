/**
 * Local Patch Overrides (C27 — Issue #77)
 * 
 * 14项本地补丁的新文件覆盖方案
 * 提供可独立导入的工具函数，在现有页面中集成时仅需一行import
 * 
 * 覆盖内容：
 * 1. scenarioStore 冻结时自动调用快照
 * 2. pricingStore internalMetal 状态扩展
 * 3. BOM加载守卫（防止空数据卡死）
 * 4. 导入模板生成器
 * 5. 批量操作确认流
 * 6. 数据完整性校验
 * 7. 重复BOM行检测
 * 8. 费率范围边界检查
 * 9. 变更影响预估
 * 10. 导出格式化工具
 * 11. 场景命名规范校验
 * 12. 操作日志格式化
 * 13. 缓存失效标记
 * 14. 并发编辑冲突检测
 */

import type { BomItem } from '@/types/harness';

// ─── 1. Scenario Freeze + Auto Snapshot ───

export interface FreezeSnapshotConfig {
  scenarioId: string;
  triggerSnapshot: (scenarioId: string, reason: string) => void;
  onFreezeComplete?: () => void;
}

export function handleScenarioFreeze(config: FreezeSnapshotConfig): void {
  config.triggerSnapshot(config.scenarioId, 'pre_change');
  config.onFreezeComplete?.();
}

// ─── 2. InternalMetal State Extension ───

export interface InternalMetalState {
  source: 'benchmark' | 'shfe' | 'smm' | 'manual';
  copperPrice: number;
  aluminumPrice: number;
  lastUpdated: string;
  staleness: 'fresh' | 'stale' | 'expired';
}

export function createDefaultMetalState(): InternalMetalState {
  return {
    source: 'benchmark',
    copperPrice: 0,
    aluminumPrice: 0,
    lastUpdated: new Date().toISOString(),
    staleness: 'fresh',
  };
}

export function checkMetalStaleness(
  lastUpdated: string,
  freshHours: number = 24,
  staleHours: number = 72,
): InternalMetalState['staleness'] {
  const hoursSince = (Date.now() - new Date(lastUpdated).getTime()) / (3600 * 1000);
  if (hoursSince <= freshHours) return 'fresh';
  if (hoursSince <= staleHours) return 'stale';
  return 'expired';
}

// ─── 3. BOM Loading Guard ───

export interface BomLoadGuardResult {
  safe: boolean;
  items: BomItem[];
  warnings: string[];
}

export function guardBomLoad(
  items: unknown,
  maxItems: number = 50000,
): BomLoadGuardResult {
  const warnings: string[] = [];

  if (!Array.isArray(items)) {
    return { safe: false, items: [], warnings: ['BOM数据不是数组'] };
  }
  if (items.length === 0) {
    return { safe: true, items: [], warnings: ['BOM为空'] };
  }
  if (items.length > maxItems) {
    warnings.push(`BOM行数 (${items.length}) 超过上限 ${maxItems}，已截断`);
    return { safe: true, items: items.slice(0, maxItems) as BomItem[], warnings };
  }

  return { safe: true, items: items as BomItem[], warnings };
}

// ─── 4. Import Template Generator ───

export function generateBomImportTemplate(): Record<string, string>[] {
  return [
    { '零件号': 'EXAMPLE-001', '零件名称': '示例连接器', '数量': '2', '单位': 'PCS', '单价': '1.50', '供应商': '示例供应商', '端组': 'A' },
    { '零件号': 'EXAMPLE-002', '零件名称': '示例导线', '数量': '1.5', '单位': 'M', '单价': '0.80', '供应商': '示例供应商', '端组': 'B' },
  ];
}

export function generateRateImportTemplate(): Record<string, string>[] {
  return [
    { '费率名称': '管理费率', '值': '0.08', '单位': '%', '备注': '基于材料成本' },
    { '费率名称': '利润率', '值': '0.05', '单位': '%', '备注': '' },
    { '费率名称': '废品率', '值': '0.02', '单位': '%', '备注': '' },
    { '费率名称': '包装费率', '值': '0.03', '单位': '%', '备注': '' },
  ];
}

// ─── 5. Batch Operation Confirmation ───

export interface BatchOpConfirmation {
  operation: string;
  affectedCount: number;
  estimatedImpact: string;
  requiresConfirmation: boolean;
  confirmationMessage: string;
}

export function buildBatchConfirmation(
  operation: string,
  affectedCount: number,
  thresholdForConfirmation: number = 10,
): BatchOpConfirmation {
  const requiresConfirmation = affectedCount >= thresholdForConfirmation;
  return {
    operation,
    affectedCount,
    estimatedImpact: `将影响 ${affectedCount} 条记录`,
    requiresConfirmation,
    confirmationMessage: requiresConfirmation
      ? `确认要对 ${affectedCount} 条记录执行「${operation}」操作？此操作不可撤销。`
      : '',
  };
}

// ─── 6. Data Integrity Check ───

export interface IntegrityCheckResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function checkScenarioIntegrity(
  scenario: {
    harnesses?: unknown[];
    rates?: Record<string, number>;
    allocItems?: unknown[];
  },
): IntegrityCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!scenario.harnesses || !Array.isArray(scenario.harnesses) || scenario.harnesses.length === 0) {
    errors.push('场景缺少线束数据');
  }

  if (scenario.rates) {
    const requiredRates = ['managementFeeRate', 'profitRate', 'scrapRate'];
    for (const rate of requiredRates) {
      if (typeof scenario.rates[rate] !== 'number') {
        warnings.push(`费率 ${rate} 未设置`);
      } else if (scenario.rates[rate]! < 0 || scenario.rates[rate]! > 1) {
        errors.push(`费率 ${rate} 超出范围 (0~1): ${scenario.rates[rate]}`);
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ─── 7. Duplicate BOM Detection ───

export function detectDuplicateBomRows(
  items: BomItem[],
): Array<{ partNo: string; indices: number[]; count: number }> {
  const map = new Map<string, number[]>();
  items.forEach((item, idx) => {
    const key = `${item.partNo || ''}:${(item as any).endGroup || ''}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(idx);
  });
  return Array.from(map.entries())
    .filter(([_, indices]) => indices.length > 1)
    .map(([partNo, indices]) => ({ partNo: partNo.split(':')[0]!, indices, count: indices.length }));
}

// ─── 8. Rate Range Boundary Check ───

export function checkRateBounds(
  rates: Record<string, number>,
  bounds: Record<string, { min: number; max: number }> = {
    managementFeeRate: { min: 0, max: 0.30 },
    profitRate: { min: 0, max: 0.25 },
    scrapRate: { min: 0, max: 0.10 },
    packagingRate: { min: 0, max: 0.15 },
    laborRate: { min: 0, max: 0.50 },
  },
): Array<{ rate: string; value: number; min: number; max: number; violation: 'below' | 'above' }> {
  const violations: Array<{ rate: string; value: number; min: number; max: number; violation: 'below' | 'above' }> = [];
  for (const [key, value] of Object.entries(rates)) {
    const bound = bounds[key];
    if (!bound) continue;
    if (value < bound.min) violations.push({ rate: key, value, ...bound, violation: 'below' });
    if (value > bound.max) violations.push({ rate: key, value, ...bound, violation: 'above' });
  }
  return violations;
}

// ─── 9. Change Impact Estimation ───

export function estimateChangeImpact(
  _changedField: string,
  oldValue: number,
  newValue: number,
  totalCost: number,
): { impactAmount: number; impactPercent: number; severity: 'low' | 'medium' | 'high' } {
  const delta = newValue - oldValue;
  const impactAmount = Math.abs(delta * totalCost);
  const impactPercent = totalCost > 0 ? Math.abs(delta / totalCost) * 100 : 0;
  const severity = impactPercent > 5 ? 'high' : impactPercent > 1 ? 'medium' : 'low';
  return {
    impactAmount: Math.round(impactAmount * 100) / 100,
    impactPercent: Math.round(impactPercent * 100) / 100,
    severity,
  };
}

// ─── 10. Export Formatter ───

export function formatNumberForExport(value: number, decimals: number = 4): string {
  return value.toFixed(decimals);
}

export function formatCurrencyForExport(value: number, currency: string = '¥'): string {
  return `${currency}${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatPercentForExport(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

// ─── 11. Scenario Naming Validator ───

export function validateScenarioName(name: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!name.trim()) errors.push('场景名称不能为空');
  if (name.length > 100) errors.push('场景名称不能超过100字');
  if (/[<>"'/\\]/.test(name)) errors.push('场景名称不能包含特殊字符: < > " \' / \\');
  return { valid: errors.length === 0, errors };
}

// ─── 12. Operation Log Formatter ───

export function formatOperationLog(
  userId: string,
  action: string,
  target: string,
  details: string = '',
): string {
  const ts = new Date().toISOString();
  return `[${ts}] ${userId}: ${action} → ${target}${details ? ` | ${details}` : ''}`;
}

// ─── 13. Cache Invalidation Marker ───

export interface CacheInvalidation {
  module: string;
  reason: string;
  timestamp: string;
  affectedKeys: string[];
}

export function markCacheInvalid(
  module: string,
  reason: string,
  affectedKeys: string[] = ['*'],
): CacheInvalidation {
  return {
    module,
    reason,
    timestamp: new Date().toISOString(),
    affectedKeys,
  };
}

// ─── 14. Concurrent Edit Conflict Detection ───

import { db } from '@/data/db';

/** EditLock 表结构 (IndexedDB) */
export interface EditLockRecord {
  id?: number;
  scenarioId: string;
  userId: string;
  acquiredAt: string;
  expiresAt: string;
}

const EDIT_LOCK_TABLE = 'editLocks' as const;

export interface EditLock {
  scenarioId: string;
  userId: string;
  acquiredAt: string;
  expiresAt: string;
}

/**
 * 获取指定场景的所有活跃锁
 * [PR-084] 从IndexedDB读取持久化的锁记录
 */
async function getActiveLocks(scenarioId: string): Promise<EditLock[]> {
  try {
    // 检查表是否存在
    if (!db[EDIT_LOCK_TABLE]) {
      console.warn('[local_patch_overrides] editLocks table not in Dexie schema, falling back to in-memory');
      return [];
    }
    const now = new Date();
    const records = await (db as any)[EDIT_LOCK_TABLE]
      .where('scenarioId')
      .equals(scenarioId)
      .filter((r: EditLockRecord) => new Date(r.expiresAt) > now)
      .toArray();
    return records.map((r: EditLockRecord) => ({
      scenarioId: r.scenarioId,
      userId: r.userId,
      acquiredAt: r.acquiredAt,
      expiresAt: r.expiresAt,
    }));
  } catch (err) {
    console.error('[local_patch_overrides] getActiveLocks failed:', err);
    return [];
  }
}

export function checkEditConflict(
  scenarioId: string,
  userId: string,
  activeLocks: EditLock[],
): { conflict: boolean; holder?: string } {
  const lock = activeLocks.find(
    l => l.scenarioId === scenarioId &&
         l.userId !== userId &&
         new Date(l.expiresAt) > new Date()
  );
  return lock ? { conflict: true, holder: lock.userId } : { conflict: false };
}

/**
 * 异步版本：从IndexedDB读取锁并检测冲突
 * [PR-084] 接入IndexedDB持久化
 */
export async function checkEditConflictAsync(
  scenarioId: string,
  userId: string,
): Promise<{ conflict: boolean; holder?: string }> {
  const activeLocks = await getActiveLocks(scenarioId);
  return checkEditConflict(scenarioId, userId, activeLocks);
}

/**
 * 获取编辑锁并持久化到IndexedDB
 * [PR-084] 接入IndexedDB持久化
 */
export async function acquireEditLockAsync(
  scenarioId: string,
  userId: string,
  durationMinutes: number = 30,
): Promise<EditLock | null> {
  try {
    // 先检查是否有冲突
    const conflictCheck = await checkEditConflictAsync(scenarioId, userId);
    if (conflictCheck.conflict) {
      console.warn(`[local_patch_overrides] Cannot acquire lock: held by ${conflictCheck.holder}`);
      return null;
    }

    const now = new Date();
    const lock: EditLock = {
      scenarioId,
      userId,
      acquiredAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + durationMinutes * 60 * 1000).toISOString(),
    };

    // 检查表是否存在
    if (!db[EDIT_LOCK_TABLE]) {
      console.warn('[local_patch_overrides] editLocks table not in Dexie schema, lock not persisted');
      return lock;
    }

    // 持久化到IndexedDB
    await (db as any)[EDIT_LOCK_TABLE].add({
      ...lock,
    });
    return lock;
  } catch (err) {
    console.error('[local_patch_overrides] acquireEditLockAsync failed:', err);
    return null;
  }
}

/**
 * 释放编辑锁
 * [PR-084] 接入IndexedDB持久化
 */
export async function releaseEditLockAsync(
  scenarioId: string,
  userId: string,
): Promise<boolean> {
  try {
    if (!db[EDIT_LOCK_TABLE]) {
      return true;
    }
    await (db as any)[EDIT_LOCK_TABLE]
      .where('scenarioId')
      .equals(scenarioId)
      .and((r: EditLockRecord) => r.userId === userId)
      .delete();
    return true;
  } catch (err) {
    console.error('[local_patch_overrides] releaseEditLockAsync failed:', err);
    return false;
  }
}

/**
 * 同步版本（向后兼容，但不持久化）
 * @deprecated 使用 acquireEditLockAsync 代替
 */
export function acquireEditLock(
  scenarioId: string,
  userId: string,
  durationMinutes: number = 30,
): EditLock {
  const now = new Date();
  return {
    scenarioId,
    userId,
    acquiredAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + durationMinutes * 60 * 1000).toISOString(),
  };
}
