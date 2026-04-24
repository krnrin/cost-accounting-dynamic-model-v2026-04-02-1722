import { db, type HarnessRecord, type OnetimeCostRecord, type ProjectRecord, type ScenarioRecord } from './db';
import { apiClient } from '@/lib/apiClient';
import { fetchScenarioAllocations, type ScenarioAllocationItem } from '@/lib/allocationApi';
import type { ProjectConfig } from '@/types/project';
import type { ScenarioType } from './db';

type RemoteScenarioType = 'initial_quote' | 'fixed_point' | 'change' | 'annual_drop' | 'final_quote';

export interface RemoteProjectRecord {
  id: string;
  projectCode: string;
  projectName: string;
  customer: string;
  platform?: string | null;
  status: ProjectRecord['meta']['status'];
  costRates?: ProjectConfig['costRates'];
  metalPrices?: ProjectConfig['metalPrices'];
  volumes?: ProjectConfig['volumes'];
  createdAt: string;
  updatedAt: string;
}

export interface RemoteScenarioRecord {
  id: string;
  projectId: string;
  type: RemoteScenarioType;
  name: string;
  status: string;
  lifecycleYears: number;
  volume: number;
  installRatio: number;
  config?: ProjectConfig;
  vehicleConfigs?: ScenarioRecord['vehicleConfigs'];
  configSkus?: ScenarioRecord['configSkus'];
  harnessConfigMappings?: ScenarioRecord['harnessConfigMappings'];
  vehicleConfigMeta?: ScenarioRecord['vehicleConfigMeta'];
  rateSnapshot?: Record<string, unknown>;
  rateSnapshotVersion?: string | null;
  bomVersionRef?: string | null;
  quoteParamSnapshot?: Record<string, unknown>;
  sourceScenarioId?: string | null;
  compareBaselineId?: string | null;
  notes?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RemoteHarnessRecord {
  id: string;
  projectId: string;
  scenarioId?: string | null;
  harnessId: string;
  harnessName: string;
  input: HarnessRecord['input'];
  result?: HarnessRecord['result'];
  createdAt?: string;
  updatedAt: string;
}

export interface ScenarioWorkspaceBundle {
  project: RemoteProjectRecord;
  scenario: RemoteScenarioRecord;
  harnesses: RemoteHarnessRecord[];
  allocationItems?: ScenarioAllocationItem[];
}

function mapScenarioTypeToLocal(type: RemoteScenarioType): ScenarioRecord['scenarioType'] {
  switch (type) {
    case 'fixed_point':
      return 'customer_award';
    case 'change':
      return 'ecn';
    default:
      return type;
  }
}

function mapScenarioTypeToRemote(type: ScenarioType): RemoteScenarioType {
  switch (type) {
    case 'customer_award':
      return 'fixed_point';
    case 'ecn':
      return 'change';
    case 'annual_drop':
      return 'annual_drop';
    case 'final_quote':
      return 'final_quote';
    default:
      return 'initial_quote';
  }
}

function buildProjectConfig(project: RemoteProjectRecord): ProjectConfig {
  return {
    costRates: project.costRates ?? {
      laborRate: 35,
      mfgRate: 46.69,
      wasteRate: 0.01,
      mgmtRate: 0.06,
      profitRate: 0.056627,
    },
    metalPrices: project.metalPrices ?? {
      copper: 0,
      aluminum: 0,
    },
    volumes: project.volumes ?? [],
    annualDropRate: 0,
  };
}

function buildEmptyProjectConfig(): ProjectConfig {
  return {
    costRates: {
      laborRate: 35,
      mfgRate: 46.69,
      wasteRate: 0.01,
      mgmtRate: 0.06,
      profitRate: 0.056627,
    },
    metalPrices: {
      copper: 0,
      aluminum: 0,
    },
    volumes: [],
    annualDropRate: 0,
  };
}

export function toLocalProjectRecord(
  project: RemoteProjectRecord,
  lifecycleYears?: number,
): ProjectRecord {
  return {
    id: project.id,
    meta: {
      id: project.id,
      projectCode: project.projectCode,
      projectName: project.projectName,
      customer: project.customer,
      platform: project.platform ?? undefined,
      lifecycleYears,
      status: project.status,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    },
    config: buildProjectConfig(project),
  };
}

export function toLocalScenarioRecord(
  scenario: RemoteScenarioRecord,
  project?: RemoteProjectRecord,
): ScenarioRecord {
  return {
    id: scenario.id,
    projectId: scenario.projectId,
    scenarioCode: scenario.id,
    scenarioName: scenario.name,
    scenarioType: mapScenarioTypeToLocal(scenario.type),
    parentScenarioId: scenario.sourceScenarioId ?? null,
    isBaseline: !scenario.sourceScenarioId,
    lifecycleYears: scenario.lifecycleYears,
    config: scenario.config ?? (project ? buildProjectConfig(project) : buildEmptyProjectConfig()),
    note: scenario.notes ?? '',
    vehicleConfigs: scenario.vehicleConfigs,
    configSkus: scenario.configSkus,
    harnessConfigMappings: scenario.harnessConfigMappings,
    vehicleConfigMeta: scenario.vehicleConfigMeta,
    status: scenario.status as ScenarioRecord['status'],
    createdAt: scenario.createdAt,
    updatedAt: scenario.updatedAt,
  };
}

export function toLocalHarnessRecord(item: RemoteHarnessRecord): HarnessRecord {
  return {
    id: item.id,
    projectId: item.projectId,
    scenarioId: item.scenarioId ?? '',
    harnessId: item.harnessId,
    harnessName: item.harnessName,
    input: item.input,
    result: item.result,
    eopYear: null,
    updatedAt: item.updatedAt,
  };
}

export function buildRemoteScenarioUpdatePayload(scenario: ScenarioRecord) {
  const totalVolume = (scenario.config?.volumes ?? []).reduce(
    (sum, row) => sum + Number(row.volume || 0),
    0,
  );

  return {
    type: mapScenarioTypeToRemote(scenario.scenarioType),
    name: scenario.scenarioName,
    status: scenario.status ?? 'draft',
    lifecycleYears: scenario.lifecycleYears,
    volume: totalVolume,
    installRatio: 1,
    config: scenario.config,
    vehicleConfigs: scenario.vehicleConfigs ?? [],
    configSkus: scenario.configSkus ?? [],
    harnessConfigMappings: scenario.harnessConfigMappings ?? [],
    vehicleConfigMeta: scenario.vehicleConfigMeta ?? { publishState: 'draft' },
    notes: scenario.note,
  };
}

export function buildRemoteHarnessPayload(harness: HarnessRecord) {
  return {
    harnessId: harness.harnessId,
    harnessName: harness.harnessName,
    scenarioId: harness.scenarioId,
    input: harness.input,
    result: harness.result,
  };
}

function normalizePaymentMode(value?: string | null): OnetimeCostRecord['input']['paymentMode'] {
  if (value === 'lumpsum' || value === 'mixed') {
    return value;
  }
  return 'amortized';
}

export function buildOnetimeCostRecordsFromAllocationItems(
  projectId: string,
  scenarioId: string,
  harnesses: RemoteHarnessRecord[],
  allocationItems: ScenarioAllocationItem[],
): OnetimeCostRecord[] {
  const harnessMap = new Map(
    harnesses.map((harness) => [harness.harnessId, harness]),
  );
  const rows = new Map<string, OnetimeCostRecord>();

  for (const item of allocationItems) {
    const existing = rows.get(item.harnessId);
    const harness = harnessMap.get(item.harnessId);
    const baseRecord = existing ?? {
      id: `${scenarioId}::${item.harnessId}`,
      projectId,
      scenarioId,
      harnessId: item.harnessId,
      harnessName: harness?.harnessName ?? item.harnessId,
      vehicleRatio: Number(item.latestInstallRatioSnapshot ?? harness?.input?.vehicleRatio ?? 0),
      installationRatio: Number(item.latestInstallRatioSnapshot ?? harness?.input?.vehicleRatio ?? 0),
      input: {
        harnessId: item.harnessId,
        harnessName: harness?.harnessName ?? item.harnessId,
        vehicleRatio: Number(item.latestInstallRatioSnapshot ?? harness?.input?.vehicleRatio ?? 0),
        installationRatio: Number(item.latestInstallRatioSnapshot ?? harness?.input?.vehicleRatio ?? 0),
        toolingCost: 0,
        testingCost: 0,
        rndCost: 0,
        allocBase: Math.max(1, Number(item.baselineVolume || 1)),
        paymentMode: normalizePaymentMode(item.allocationBasis),
      },
      updatedAt: item.updatedAt,
    } satisfies OnetimeCostRecord;

    baseRecord.vehicleRatio = Number(item.latestInstallRatioSnapshot ?? baseRecord.vehicleRatio ?? 0);
    baseRecord.installationRatio = Number(item.latestInstallRatioSnapshot ?? baseRecord.installationRatio ?? 0);
    baseRecord.input.vehicleRatio = baseRecord.vehicleRatio;
    baseRecord.input.installationRatio = baseRecord.installationRatio;
    baseRecord.input.allocBase = Math.max(baseRecord.input.allocBase, Number(item.baselineVolume || 1));
    baseRecord.input.paymentMode = normalizePaymentMode(item.allocationBasis);
    baseRecord.updatedAt = item.updatedAt;

    if (item.expenseType === 'tooling') {
      baseRecord.input.toolingCost += Number(item.totalAmount || 0);
    } else if (item.expenseType === 'testing') {
      baseRecord.input.testingCost += Number(item.totalAmount || 0);
    } else if (item.expenseType === 'rnd') {
      baseRecord.input.rndCost = Number(baseRecord.input.rndCost || 0) + Number(item.totalAmount || 0);
    }

    rows.set(item.harnessId, baseRecord);
  }

  return Array.from(rows.values()).sort((a, b) => a.harnessId.localeCompare(b.harnessId));
}

export async function syncScenarioWorkspaceToDexie(bundle: ScenarioWorkspaceBundle) {
  const localProject = toLocalProjectRecord(bundle.project, bundle.scenario.lifecycleYears);
  const localScenario = toLocalScenarioRecord(bundle.scenario, bundle.project);
  const localHarnesses = bundle.harnesses.map(toLocalHarnessRecord);
  const localOnetimeCosts = buildOnetimeCostRecordsFromAllocationItems(
    bundle.project.id,
    bundle.scenario.id,
    bundle.harnesses,
    bundle.allocationItems ?? [],
  );

  await db.transaction(
    'rw',
    [db.projects, db.scenarios, db.harnesses, db.onetimeCosts],
    async () => {
      await db.projects.put(localProject);
      await db.scenarios.put(localScenario);
      await db.harnesses.where('scenarioId').equals(bundle.scenario.id).delete();
      await db.onetimeCosts.where('scenarioId').equals(bundle.scenario.id).delete();
      if (localHarnesses.length > 0) {
        await db.harnesses.bulkPut(localHarnesses);
      }
      if (localOnetimeCosts.length > 0) {
        await db.onetimeCosts.bulkPut(localOnetimeCosts);
      }
    },
  );

  return {
    project: localProject,
    scenario: localScenario,
    harnesses: localHarnesses,
    onetimeCosts: localOnetimeCosts,
  };
}

export async function hydrateScenarioWorkspaceFromServer(projectId: string, scenarioId: string) {
  const [project, scenario, harnesses, allocationItems] = await Promise.all([
    apiClient<RemoteProjectRecord>(`/projects/${projectId}`),
    apiClient<RemoteScenarioRecord>(`/projects/${projectId}/scenarios/${scenarioId}`),
    apiClient<RemoteHarnessRecord[]>(`/projects/${projectId}/harnesses`),
    fetchScenarioAllocations(scenarioId).catch(() => []),
  ]);

  const scenarioHarnesses = harnesses.filter((item) => item.scenarioId === scenarioId);
  return syncScenarioWorkspaceToDexie({
    project,
    scenario,
    harnesses: scenarioHarnesses,
    allocationItems,
  });
}

export async function pushLocalScenarioWorkspaceToServer(projectId: string, scenarioId: string) {
  const [scenario, harnesses] = await Promise.all([
    db.scenarios.get(scenarioId),
    db.harnesses.where('scenarioId').equals(scenarioId).sortBy('harnessId'),
  ]);

  if (!scenario) {
    throw new Error(`Scenario ${scenarioId} not found in local workspace`);
  }

  await apiClient(`/projects/${projectId}/scenarios/${scenarioId}`, {
    method: 'PUT',
    body: buildRemoteScenarioUpdatePayload(scenario),
  });

  const remoteHarnesses = await apiClient<RemoteHarnessRecord[]>(`/projects/${projectId}/harnesses`);
  const remoteScenarioHarnesses = remoteHarnesses.filter((item) => item.scenarioId === scenarioId);
  const remoteByHarnessId = new Map(remoteScenarioHarnesses.map((item) => [item.harnessId, item]));
  const localHarnessIds = new Set(harnesses.map((item) => item.harnessId));

  for (const harness of harnesses) {
    const remote = remoteByHarnessId.get(harness.harnessId);
    const payload = buildRemoteHarnessPayload(harness);
    if (remote) {
      await apiClient(`/projects/${projectId}/harnesses/${remote.id}`, {
        method: 'PUT',
        body: payload,
      });
    } else {
      await apiClient(`/projects/${projectId}/harnesses`, {
        method: 'POST',
        body: payload,
      });
    }
  }

  for (const remote of remoteScenarioHarnesses) {
    if (localHarnessIds.has(remote.harnessId)) continue;
    await apiClient(`/projects/${projectId}/harnesses/${remote.id}`, {
      method: 'DELETE',
    });
  }

  return hydrateScenarioWorkspaceFromServer(projectId, scenarioId);
}

export async function ensureScenarioWorkspaceHydrated(projectId: string, scenarioId: string) {
  const [project, scenario, harnessCount] = await Promise.all([
    db.projects.get(projectId),
    db.scenarios.get(scenarioId),
    db.harnesses.where('scenarioId').equals(scenarioId).count(),
  ]);

  if (project && scenario && harnessCount > 0) {
    return {
      project,
      scenario,
      hydrated: false,
    };
  }

  await hydrateScenarioWorkspaceFromServer(projectId, scenarioId);
  return {
    project: await db.projects.get(projectId),
    scenario: await db.scenarios.get(scenarioId),
    hydrated: true,
  };
}
