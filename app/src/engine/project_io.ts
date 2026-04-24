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
  const newProjectId = crypto.randomUUID();
  const now = new Date().toISOString();

  const newProject: ProjectRecord = {
    ...pkg.project,
    id: newProjectId,
    meta: {
      ...pkg.project.meta,
      projectName: `${pkg.project.meta.projectName} (导入)`,
      createdAt: now,
      updatedAt: now,
    },
  };

  const scenarioIdMap = new Map<string, string>();
  const parentScenarioByNewId = new Map<string, string | null>();
  const newScenarios: ScenarioRecord[] = (pkg.scenarios ?? []).map((scenario) => {
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

  const fallbackScenarioId = newScenarios.find((scenario) => scenario.isBaseline)?.id ?? null;

  const newHarnesses: HarnessRecord[] = pkg.harnesses.map((harness) => ({
    ...harness,
    id: crypto.randomUUID(),
    projectId: newProjectId,
    scenarioId: harness.scenarioId
      ? scenarioIdMap.get(harness.scenarioId) ?? fallbackScenarioId ?? harness.scenarioId
      : harness.scenarioId,
    updatedAt: now,
  }));

  const newQuotes: QuoteRecord[] = pkg.quotes.map((quote) => ({
    ...quote,
    id: crypto.randomUUID(),
    projectId: newProjectId,
    scenarioId: quote.scenarioId
      ? scenarioIdMap.get(quote.scenarioId) ?? fallbackScenarioId ?? quote.scenarioId
      : quote.scenarioId,
  }));

  const newVersions: VersionRecord[] = (pkg.versions ?? []).map((version) => ({
    ...version,
    id: crypto.randomUUID(),
    projectId: newProjectId,
    scenarioId: version.scenarioId
      ? scenarioIdMap.get(version.scenarioId) ?? fallbackScenarioId ?? version.scenarioId
      : version.scenarioId,
    createdAt: now,
  }));

  const newQuoteSnapshots: QuoteSnapshotRecord[] = (pkg.quoteSnapshots ?? []).map((snapshot) => ({
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
  );

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
