import { db } from '@/data/db';
import type {
  HarnessRecord,
  ProjectRecord,
  QuoteRecord,
  QuoteSnapshotRecord,
  ScenarioRecord,
} from '@/data/db';
import type { VersionRecord } from '@/types/version';

export interface ProjectPackage {
  schemaVersion: 1 | 2;
  exportedAt: string;
  appVersion: string;
  project: ProjectRecord;
  harnesses: HarnessRecord[];
  quotes: QuoteRecord[];
  scenarios?: ScenarioRecord[];
  versions?: VersionRecord[];
  quoteSnapshots?: QuoteSnapshotRecord[];
}

// [PR-105] v1→v2 迁移函数
/** 将 v1 格式包迁移到 v2 格式 */
export function migrateV1ToV2(pkg: ProjectPackage): ProjectPackage {
  if (pkg.schemaVersion !== 1) {
    // 已经是 v2 或更高，直接返回
    return pkg;
  }

  // v1 → v2 迁移：
  // - v1 没有 scenarios/versions/quoteSnapshots
  // - v1 的 harnesses 没有 scenarioId
  // - 创建默认 baseline scenario 并关联所有 harnesses

  const now = new Date().toISOString();
  const defaultScenarioId = crypto.randomUUID();

  const migratedScenario: ScenarioRecord = {
    id: defaultScenarioId,
    projectId: pkg.project.id,
    scenarioCode: 'SCN-001',
    scenarioName: '初始报价',
    scenarioType: 'initial_quote',
    parentScenarioId: null,
    isBaseline: true,
    lifecycleYears: pkg.project.meta?.lifecycleYears ?? 6,
    config: pkg.project.config ?? {
      costRates: { mgmtRate: 0, profitRate: 0, wasteRate: 0, laborRate: 0, mfgRate: 0 },
      metalPrices: { copper: 0, aluminum: 0 },
      volumes: [],
      annualDropRate: 0,
    },
    note: '从 v1 格式自动迁移',
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  };

  const migratedHarnesses: HarnessRecord[] = pkg.harnesses.map(h => ({
    ...h,
    scenarioId: defaultScenarioId,
    eopYear: null,
  }));

  const migratedQuotes: QuoteRecord[] = pkg.quotes.map(q => ({
    ...q,
    scenarioId: defaultScenarioId,
  }));

  return {
    schemaVersion: 2,
    exportedAt: pkg.exportedAt,
    appVersion: pkg.appVersion,
    project: pkg.project,
    harnesses: migratedHarnesses,
    quotes: migratedQuotes,
    scenarios: [migratedScenario],
    versions: [],
    quoteSnapshots: [],
  };
}

export async function exportProjectPackage(projectId: string): Promise<ProjectPackage> {
  const project = await db.projects.get(projectId);
  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  const [harnesses, quotes, scenarios, versions, quoteSnapshots] = await Promise.all([
    db.harnesses.where('projectId').equals(projectId).toArray(),
    db.quotes.where('projectId').equals(projectId).toArray(),
    db.scenarios.where('projectId').equals(projectId).toArray(),
    db.versions.where('projectId').equals(projectId).toArray(),
    db.quoteSnapshots.where('projectId').equals(projectId).toArray(),
  ]);

  return {
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    appVersion: '0.2.0',
    project,
    harnesses,
    quotes,
    scenarios,
    versions,
    quoteSnapshots,
  };
}

export async function downloadProjectPackage(projectId: string): Promise<void> {
  const pkg = await exportProjectPackage(projectId);
  const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${pkg.project.meta.projectName}_backup_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  setTimeout(() => {
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, 200);
}

export function validateProjectPackage(data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    errors.push('无效的数据格式');
    return { valid: false, errors };
  }

  const candidate = data as Partial<ProjectPackage>;
  if (candidate.schemaVersion !== 1 && candidate.schemaVersion !== 2) {
    errors.push('不支持的版本');
  }
  if (!candidate.project?.id) {
    errors.push('缺少项目数据');
  }
  if (!Array.isArray(candidate.harnesses)) {
    errors.push('缺少线束数据');
  }

  return { valid: errors.length === 0, errors };
}

export async function importProjectPackage(pkg: ProjectPackage): Promise<string> {
  // [PR-105] 自动迁移 v1 格式
  const migratedPkg = pkg.schemaVersion === 1 ? migrateV1ToV2(pkg) : pkg;

  const newProjectId = crypto.randomUUID();
  const now = new Date().toISOString();

  const newProject: ProjectRecord = {
    ...migratedPkg.project,
    id: newProjectId,
    meta: {
      ...migratedPkg.project.meta,
      projectName: `${migratedPkg.project.meta.projectName} (导入)`,
      createdAt: now,
      updatedAt: now,
    },
  };

  const scenarioIdMap = new Map<string, string>();
  const parentScenarioByNewId = new Map<string, string | null>();
  const newScenarios: ScenarioRecord[] = (migratedPkg.scenarios ?? []).map((scenario) => {
    const newScenarioId = crypto.randomUUID();
    scenarioIdMap.set(scenario.id, newScenarioId);
    parentScenarioByNewId.set(newScenarioId, scenario.parentScenarioId ?? null);

    return {
      ...scenario,
      id: newScenarioId,
      projectId: newProjectId,
      parentScenarioId: null,
      createdAt: now,
      updatedAt: now,
    };
  });

  for (const scenario of newScenarios) {
    const oldParent = parentScenarioByNewId.get(scenario.id);
    scenario.parentScenarioId = oldParent ? scenarioIdMap.get(oldParent) ?? null : null;
  }

  // [PR-106] 循环引用检测与修复
  function detectCycle(
    startId: string,
    visited: Set<string> = new Set(),
    path: string[] = []
  ): string[] | null {
    if (visited.has(startId)) {
      return path.includes(startId) ? [...path, startId] : null;
    }
    visited.add(startId);
    const parentId = newScenarios.find(s => s.id === startId)?.parentScenarioId;
    if (!parentId) return null;
    return detectCycle(parentId, visited, [...path, startId]);
  }

  for (const scenario of newScenarios) {
    const cycle = detectCycle(scenario.id);
    if (cycle) {
      console.warn(`[PR-106] 检测到循环引用: ${cycle.join(' → ')}，已断开`);
      scenario.parentScenarioId = null;
    }
  }

  const fallbackScenarioId = newScenarios.find((scenario) => scenario.isBaseline)?.id ?? null;

  const newHarnesses: HarnessRecord[] = migratedPkg.harnesses.map((harness) => ({
    ...harness,
    id: crypto.randomUUID(),
    projectId: newProjectId,
    scenarioId: harness.scenarioId
      ? scenarioIdMap.get(harness.scenarioId) ?? fallbackScenarioId ?? harness.scenarioId
      : harness.scenarioId,
    updatedAt: now,
  }));

  const newQuotes: QuoteRecord[] = migratedPkg.quotes.map((quote) => ({
    ...quote,
    id: crypto.randomUUID(),
    projectId: newProjectId,
    scenarioId: quote.scenarioId
      ? scenarioIdMap.get(quote.scenarioId) ?? fallbackScenarioId ?? quote.scenarioId
      : quote.scenarioId,
  }));

  const newVersions: VersionRecord[] = (migratedPkg.versions ?? []).map((version) => ({
    ...version,
    id: crypto.randomUUID(),
    projectId: newProjectId,
    scenarioId: version.scenarioId
      ? scenarioIdMap.get(version.scenarioId) ?? fallbackScenarioId ?? version.scenarioId
      : version.scenarioId,
    createdAt: now,
  }));

  const newQuoteSnapshots: QuoteSnapshotRecord[] = (migratedPkg.quoteSnapshots ?? []).map((snapshot) => ({
    ...snapshot,
    id: crypto.randomUUID(),
    projectId: newProjectId,
    scenarioId: scenarioIdMap.get(snapshot.scenarioId) ?? fallbackScenarioId ?? snapshot.scenarioId,
    createdAt: now,
  }));

  await db.transaction(
    'rw',
    [db.projects, db.scenarios, db.harnesses, db.quotes, db.versions, db.quoteSnapshots],
    async () => {
      await db.projects.put(newProject);
      if (newScenarios.length > 0) {
        await db.scenarios.bulkPut(newScenarios);
      }
      await db.harnesses.bulkPut(newHarnesses);
      if (newQuotes.length > 0) {
        await db.quotes.bulkPut(newQuotes);
      }
      if (newVersions.length > 0) {
        await db.versions.bulkPut(newVersions);
      }
      if (newQuoteSnapshots.length > 0) {
        await db.quoteSnapshots.bulkPut(newQuoteSnapshots);
      }
    },
  ).catch((err: Error) => {
    // [PR-107] 事务失败时提供友好错误信息
    throw new Error(
      `导入项目「${migratedPkg.project.meta.projectName}」失败：${err.message}\n` +
      `已写入数据：项目ID=${newProjectId}\n` +
      `请检查数据库状态或联系管理员。`
    );
  });

  return newProjectId;
}

export async function copyHarnessesToProject(
  sourceProjectId: string,
  targetProjectId: string,
  harnessIds?: string[],
): Promise<number> {
  const sourceHarnesses = await db.harnesses.where('projectId').equals(sourceProjectId).toArray();
  const toCopy = harnessIds
    ? sourceHarnesses.filter((harness) => harnessIds.includes(harness.harnessId))
    : sourceHarnesses;

  const newHarnesses = toCopy.map((harness) => ({
    ...harness,
    id: crypto.randomUUID(),
    projectId: targetProjectId,
    updatedAt: new Date().toISOString(),
  }));

  await db.harnesses.bulkPut(newHarnesses);
  return newHarnesses.length;
}
