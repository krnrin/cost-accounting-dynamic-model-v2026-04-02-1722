/**
 * Scenario fork / delete / code generation
 */
import { db, type ScenarioType } from './db';
import type { ProjectConfig } from '@/types/project';
import { requireScenarioConfig, requireScenarioOnetimeCosts } from './scenarioGuards';

/** Generate next scenario code (SCN-001, SCN-002, ...) */
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
  /** Whether to inherit allocation recovery progress from the parent scenario. */
  inheritAllocProgress: boolean;
}

/** Create a child scenario by deep-copying harnesses, one-time costs, and allocation trackers. */
export async function forkScenario(
  parentScenarioId: string,
  options: ForkOptions,
): Promise<string> {
  const parentRecord = await db.scenarios.get(parentScenarioId);
  if (!parentRecord) throw new Error('父场景不存在');
  requireScenarioConfig(parentRecord, '场景复制');
  const parent = parentRecord;

  const scenarioCode = await generateNextScenarioCode(parent.projectId);
  const now = new Date().toISOString();
  const newId = crypto.randomUUID();

  const mergedConfig = options.overrides?.config
    ? { ...structuredClone(parent.config), ...options.overrides.config }
    : structuredClone(parent.config);

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
    relations: parent.relations ? structuredClone(parent.relations) : undefined,
    vehicleConfigs: parent.vehicleConfigs ? structuredClone(parent.vehicleConfigs) : undefined,
    configSkus: parent.configSkus ? structuredClone(parent.configSkus) : undefined,
    harnessConfigMappings: parent.harnessConfigMappings ? structuredClone(parent.harnessConfigMappings) : undefined,
    vehicleConfigMeta: parent.vehicleConfigMeta ? structuredClone(parent.vehicleConfigMeta) : undefined,
    createdAt: now,
    updatedAt: now,
  });

  const parentHarnesses = await db.harnesses.where('scenarioId').equals(parentScenarioId).toArray();
  for (const harness of parentHarnesses) {
    await db.harnesses.add({
      ...structuredClone(harness),
      id: crypto.randomUUID(),
      scenarioId: newId,
      updatedAt: now,
    });
  }

  const storedParentCosts = await db.onetimeCosts.where('scenarioId').equals(parentScenarioId).toArray();
  const parentCosts = requireScenarioOnetimeCosts(storedParentCosts, parentScenarioId);
  for (const cost of parentCosts) {
    await db.onetimeCosts.add({
      ...structuredClone(cost),
      id: `${newId}::${cost.harnessId}`,
      scenarioId: newId,
      updatedAt: now,
    });
  }

  const parentTrackers = await db.allocTrackers.where('scenarioId').equals(parentScenarioId).toArray();
  for (const tracker of parentTrackers) {
    await db.allocTrackers.add({
      id: `${newId}::${tracker.harnessId}`,
      projectId: tracker.projectId,
      scenarioId: newId,
      harnessId: tracker.harnessId,
      cumProduced: options.inheritAllocProgress ? tracker.cumProduced : 0,
      inheritedFromScenarioId: options.inheritAllocProgress ? parentScenarioId : null,
      updatedAt: now,
    });
  }

  return newId;
}

/** Delete a scenario and all child records. */
export async function deleteScenario(scenarioId: string): Promise<void> {
  const scenario = await db.scenarios.get(scenarioId);
  if (!scenario) return;
  if (scenario.isBaseline) throw new Error('不能删除基准场景');

  await db.harnesses.where('scenarioId').equals(scenarioId).delete();
  await db.onetimeCosts.where('scenarioId').equals(scenarioId).delete();
  await db.allocTrackers.where('scenarioId').equals(scenarioId).delete();
  await db.scenarios.delete(scenarioId);
}
