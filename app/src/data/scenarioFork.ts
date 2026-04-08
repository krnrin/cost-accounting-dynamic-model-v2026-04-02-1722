/**
 * 场景 Fork / 删除 / 编号生成
 */
import { db, type ScenarioType } from './db';
import type { ProjectConfig } from '@/types/project';

/** 生成下一个场景编号 (SCN-001, SCN-002, ...) */
export async function generateNextScenarioCode(projectId: string): Promise<string> {
  const existing = await db.scenarios.where('projectId').equals(projectId).toArray();
  const maxNum = existing.reduce((max, s) => {
    const m = s.scenarioCode.match(/^SCN-(\d+)$/);
    return m ? Math.max(max, parseInt(m[1]!, 10)) : max;
  }, 0);
  return `SCN-${String(maxNum + 1).padStart(3, '0')}`;
}

export interface ForkOptions {
  name: string;
  type: ScenarioType;
  overrides?: {
    lifecycleYears?: number;
    config?: Partial<ProjectConfig>;
  };
  /** 是否继承父场景的一次性费用回收进度 */
  inheritAllocProgress: boolean;
}

/** 从父场景派生新场景，深拷贝 harnesses + onetimeCosts + allocTrackers */
export async function forkScenario(
  parentScenarioId: string,
  options: ForkOptions,
): Promise<string> {
  const parent = await db.scenarios.get(parentScenarioId);
  if (!parent) throw new Error('父场景不存在');

  const scenarioCode = await generateNextScenarioCode(parent.projectId!);
  const now = new Date().toISOString();
  const newId = crypto.randomUUID();

  const mergedConfig = options.overrides?.config
    ? { ...structuredClone(parent.config), ...options.overrides.config }
    : structuredClone(parent.config);

  // 1. 创建新场景
  await db.scenarios.add({
    id: newId,
    projectId: parent.projectId,
    scenarioCode,
    scenarioName: options.name,
    scenarioType: options.type,
    parentScenarioId,
    isBaseline: false,
    lifecycleYears: options.overrides?.lifecycleYears ?? parent.lifecycleYears,
    config: mergedConfig,
    note: '',
    createdAt: now,
    updatedAt: now,
  });

  // 2. 深拷贝 harnesses
  const parentHarnesses = await db.harnesses
    .where('scenarioId').equals(parentScenarioId).toArray();
  for (const h of parentHarnesses) {
    await db.harnesses.add({
      ...structuredClone(h),
      id: crypto.randomUUID(),
      scenarioId: newId,
      updatedAt: now,
    });
  }

  // 3. 深拷贝 onetimeCosts
  const parentCosts = await db.onetimeCosts
    .where('scenarioId').equals(parentScenarioId).toArray();
  for (const c of parentCosts) {
    await db.onetimeCosts.add({
      ...structuredClone(c),
      id: `${newId}::${c.harnessId}`,
      scenarioId: newId,
      updatedAt: now,
    });
  }

  // 4. allocTrackers — 继承或归零
  const parentTrackers = await db.allocTrackers
    .where('scenarioId').equals(parentScenarioId).toArray();
  for (const t of parentTrackers) {
    await db.allocTrackers.add({
      id: `${newId}::${t.harnessId}`,
      projectId: t.projectId,
      scenarioId: newId,
      harnessId: t.harnessId,
      cumProduced: options.inheritAllocProgress ? t.cumProduced : 0,
      inheritedFromScenarioId: options.inheritAllocProgress ? parentScenarioId : null,
      updatedAt: now,
    });
  }

  return newId;
}

/** 删除场景及其所有子记录 */
export async function deleteScenario(scenarioId: string): Promise<void> {
  const scenario = await db.scenarios.get(scenarioId);
  if (!scenario) return;
  if (scenario.isBaseline) throw new Error('不能删除基准场景');

  await db.harnesses.where('scenarioId').equals(scenarioId).delete();
  await db.onetimeCosts.where('scenarioId').equals(scenarioId).delete();
  await db.allocTrackers.where('scenarioId').equals(scenarioId).delete();
  await db.scenarios.delete(scenarioId);
}
