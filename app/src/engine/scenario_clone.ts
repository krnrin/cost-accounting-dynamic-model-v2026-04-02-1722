/**
 * C8: 场景复制/继承引擎
 *
 * 支持基于已有场景深度克隆：
 * - BOM 数据（bomItems + wireItems）
 * - 线束列表（harnesses）
 * - 费率配置快照
 * - 金属价格快照
 * - 一次性费用
 *
 * 新场景自动关联 sourceScenarioId + compareBaselineId
 * 对应 Issue #62 [F02] 场景复制/继承功能
 */

import { db } from '@/data/db';

// ─── Types ───────────────────────────────────────────────────

export interface CloneOptions {
  /** 目标项目 ID（默认同项目） */
  targetProjectId?: string;
  /** 新场景名称 */
  name: string;
  /** 新场景描述 */
  description?: string;
  /** 是否设为基线对比对象 */
  setAsBaseline?: boolean;
  /** 选择性克隆（默认全部） */
  include?: {
    bom?: boolean;       // 默认 true
    harnesses?: boolean; // 默认 true
    rates?: boolean;     // 默认 true
    onetimeFees?: boolean; // 默认 true
  };
  /** 操作人 */
  userId?: string;
}

export interface CloneResult {
  scenarioId: string;
  scenarioName: string;
  sourceScenarioId: string;
  stats: {
    harnessCount: number;
    bomItemCount: number;
    wireItemCount: number;
  };
  warnings: string[];
}

export interface CloneValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ─── Helpers ─────────────────────────────────────────────────

function generateId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function mergeIncludes(partial?: CloneOptions['include']): Required<NonNullable<CloneOptions['include']>> {
  return {
    bom: partial?.bom !== false,
    harnesses: partial?.harnesses !== false,
    rates: partial?.rates !== false,
    onetimeFees: partial?.onetimeFees !== false,
  };
}

// ─── Validation ──────────────────────────────────────────────

export async function validateClone(
  sourceScenarioId: string,
  options: CloneOptions
): Promise<CloneValidation> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. 源场景必须存在
  const source = await db.scenarios.get(sourceScenarioId);
  if (!source) {
    errors.push(`源场景 ${sourceScenarioId} 不存在`);
    return { valid: false, errors, warnings };
  }

  // 2. 名称不能为空
  if (!options.name || options.name.trim().length === 0) {
    errors.push('新场景名称不能为空');
  }

  // 3. 同项目下不能重名
  const targetProjectId = options.targetProjectId || source.projectId;
  const existing = await db.scenarios
    .where('projectId')
    .equals(targetProjectId)
    .toArray();
  if (existing.some(s => s.scenarioName === options.name.trim())) {
    errors.push(`项目中已存在名为「${options.name}」的场景`);
  }

  // 4. 检查源场景状态
  const status = (source as any).status || 'draft';
  if (status === 'archived') {
    warnings.push('源场景已归档，克隆数据可能不是最新版本');
  }

  // 5. 跨项目克隆提醒
  if (options.targetProjectId && options.targetProjectId !== source.projectId) {
    warnings.push('跨项目克隆：费率和金属价格将按源场景快照复制，可能与目标项目配置不一致');
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ─── Core Clone ──────────────────────────────────────────────

export async function cloneScenario(
  sourceScenarioId: string,
  options: CloneOptions
): Promise<CloneResult> {
  // Validate first
  const validation = await validateClone(sourceScenarioId, options);
  if (!validation.valid) {
    throw new Error(`克隆校验失败：${validation.errors.join('; ')}`);
  }

  const source = (await db.scenarios.get(sourceScenarioId))!;
  const includes = mergeIncludes(options.include);
  const targetProjectId = options.targetProjectId || source.projectId;
  const now = new Date().toISOString();
  const newScenarioId = generateId();
  const warnings = [...validation.warnings];

  let harnessCount = 0;
  let bomItemCount = 0;
  let wireItemCount = 0;

  await db.transaction('rw', [db.scenarios, db.harnesses, (db as any).bomItems, (db as any).wireItems], async () => {
    // 1. 创建新场景记录
    const newScenario: any = {
      ...source,
      id: newScenarioId,
      name: options.name.trim(),
      description: options.description || `从「${source.scenarioName}」复制`,
      projectId: targetProjectId,
      status: 'draft',
      sourceScenarioId: sourceScenarioId,
      compareBaselineId: options.setAsBaseline !== false ? sourceScenarioId : undefined,
      createdAt: now,
      updatedAt: now,
      frozenAt: undefined,
      frozenBy: undefined,
      publishedAt: undefined,
      publishedBy: undefined,
      archivedAt: undefined,
      createdBy: options.userId,
    };
    await db.scenarios.add(newScenario);

    // 2. 克隆线束
    if (includes.harnesses) {
      const sourceHarnesses = await db.harnesses
        .where('scenarioId')
        .equals(sourceScenarioId)
        .toArray();

      const harnessIdMap = new Map<string, string>(); // old → new

      for (const h of sourceHarnesses) {
        const newHarnessId = generateId();
        harnessIdMap.set(h.id!, newHarnessId);

        await db.harnesses.add({
          ...h,
          id: newHarnessId,
          scenarioId: newScenarioId,
          locked: false,
          lockedAt: undefined,
          createdAt: now,
          updatedAt: now,
        } as any);
        harnessCount++;
      }

      // 3. 克隆 BOM Items
      if (includes.bom) {
        for (const [oldHarnessId, newHarnessId] of harnessIdMap) {
          const items = await (db as any).bomItems
            .where('harnessId')
            .equals(oldHarnessId)
            .toArray();

          for (const item of items) {
            await (db as any).bomItems.add({
              ...item,
              id: generateId(),
              harnessId: newHarnessId,
              scenarioId: newScenarioId,
            } as any);
            bomItemCount++;
          }

          // 4. 克隆 Wire Items
          const wires = await (db as any).wireItems
            .where('harnessId')
            .equals(oldHarnessId)
            .toArray();

          for (const wire of wires) {
            await (db as any).wireItems.add({
              ...wire,
              id: generateId(),
              harnessId: newHarnessId,
              scenarioId: newScenarioId,
            } as any);
            wireItemCount++;
          }
        }
      }
    }
  });

  return {
    scenarioId: newScenarioId,
    scenarioName: options.name.trim(),
    sourceScenarioId,
    stats: { harnessCount, bomItemCount, wireItemCount },
    warnings,
  };
}

// ─── Quick Clone (便捷方法) ──────────────────────────────────

/**
 * 快速克隆场景（使用默认名称 + 全量复制）
 */
export async function quickClone(
  sourceScenarioId: string,
  userId?: string
): Promise<CloneResult> {
  const source = await db.scenarios.get(sourceScenarioId);
  if (!source) throw new Error(`场景 ${sourceScenarioId} 不存在`);

  const timestamp = new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  const name = `${source.scenarioName} (副本 ${timestamp})`;

  return cloneScenario(sourceScenarioId, { name, userId });
}

/**
 * 创建 what-if 场景（从已冻结/已发布的基线克隆）
 */
export async function createWhatIfScenario(
  baselineScenarioId: string,
  whatIfName: string,
  userId?: string
): Promise<CloneResult> {
  return cloneScenario(baselineScenarioId, {
    name: whatIfName,
    description: `What-If 分析：基于「${baselineScenarioId}」`,
    setAsBaseline: true,
    userId,
  });
}
