import prisma from '../lib/prisma.js';
import { hydrateJsonFields, dehydrateJsonFields } from '../lib/json.js';
import { BomService } from './bomService.js';
import { VersionService } from './extraServices.js';
import { SettingsService } from './settingsService.js';
import { AllocationService } from './allocationService.js';

const JSON_FIELDS = ['rateSnapshot', 'quoteParamSnapshot'] as const;

async function buildRateSnapshotFromVersion(version: string, fallbackRateSnapshot: Record<string, unknown> = {}) {
  const snapshotRows = await SettingsService.snapshot(version);
  const costStructure = snapshotRows.filter((row) => row.sourceCategory === 'cost_structure');
  if (costStructure.length === 0) {
    return {
      rateSnapshot: fallbackRateSnapshot,
      rateSnapshotVersion: version,
    };
  }

  return {
    rateSnapshot: Object.fromEntries(costStructure.map((row) => [row.key, row.value])),
    rateSnapshotVersion: version,
  };
}

async function resolveScenarioRateSnapshot(data: any) {
  if (data.rateSnapshot && Object.keys(data.rateSnapshot).length > 0) {
    return {
      rateSnapshot: data.rateSnapshot,
      rateSnapshotVersion: data.rateSnapshotVersion ?? null,
    };
  }

  const requestedVersion = typeof data.rateSnapshotVersion === 'string' && data.rateSnapshotVersion !== 'latest'
    ? data.rateSnapshotVersion.trim()
    : '';
  if (requestedVersion) {
    await SettingsService.assertPublishedVersion(requestedVersion);
    return buildRateSnapshotFromVersion(requestedVersion, data.rateSnapshot ?? {});
  }

  const latestVersion = await SettingsService.getLatestPublishedVersion();
  if (!latestVersion) {
    return {
      rateSnapshot: data.rateSnapshot ?? {},
      rateSnapshotVersion: data.rateSnapshotVersion ?? null,
    };
  }

  return buildRateSnapshotFromVersion(latestVersion, data.rateSnapshot ?? {});
}

async function enrichScenario(item: any) {
  const hydrated = hydrateJsonFields(item, [...JSON_FIELDS]);
  return {
    ...hydrated,
    rateSnapshotVersion: item.rateSnapshotVersion ?? null,
  };
}

async function enrichScenarios(items: any[]) {
  return Promise.all(items.map((item) => enrichScenario(item)));
}

async function buildCreatePayload(projectId: string, data: any) {
  const snapshotBinding = await resolveScenarioRateSnapshot(data);
  return dehydrateJsonFields({ ...data, ...snapshotBinding, projectId }, [...JSON_FIELDS]);
}

async function buildUpdatePayload(current: any, data: any) {
  const wantsSpecificVersion = typeof data.rateSnapshotVersion === 'string' && data.rateSnapshotVersion !== 'latest';
  const wantsRateRefresh = data.rateSnapshotVersion === 'latest';
  const needsAutoBind = wantsRateRefresh || wantsSpecificVersion;
  const snapshotBinding = needsAutoBind
    ? await resolveScenarioRateSnapshot({ ...current, ...data, rateSnapshot: undefined })
    : {
        rateSnapshot: data.rateSnapshot ?? current.rateSnapshot,
        rateSnapshotVersion: data.rateSnapshotVersion ?? current.rateSnapshotVersion ?? null,
      };

  return dehydrateJsonFields({ ...data, ...snapshotBinding }, [...JSON_FIELDS]);
}

async function attachRateSnapshotToSummary(item: any) {
  const scenario = await enrichScenario(item);
  return {
    ...scenario,
    rateSnapshotVersion: scenario.rateSnapshotVersion,
  };
}

async function buildClonePayload(source: any) {
  const scenario = await enrichScenario(source);
  return dehydrateJsonFields({
    projectId: scenario.projectId,
    type: scenario.type,
    name: `${scenario.name}-复制`,
    status: 'draft',
    lifecycleYears: scenario.lifecycleYears,
    volume: scenario.volume,
    installRatio: scenario.installRatio,
    rateSnapshot: scenario.rateSnapshot,
    rateSnapshotVersion: scenario.rateSnapshotVersion,
    bomVersionRef: scenario.bomVersionRef,
    quoteParamSnapshot: scenario.quoteParamSnapshot,
    sourceScenarioId: scenario.id,
    compareBaselineId: scenario.compareBaselineId ?? scenario.id,
    notes: scenario.notes,
    createdBy: scenario.createdBy,
  }, [...JSON_FIELDS]);
}

async function buildComparisonItem(item: any) {
  const hydrated = await enrichScenario(item);
  return {
    id: hydrated.id,
    name: hydrated.name,
    type: hydrated.type,
    status: hydrated.status,
    lifecycleYears: hydrated.lifecycleYears,
    volume: hydrated.volume,
    installRatio: hydrated.installRatio,
    rateSnapshot: hydrated.rateSnapshot,
    rateSnapshotVersion: hydrated.rateSnapshotVersion,
    bomVersionRef: hydrated.bomVersionRef,
    sourceScenarioId: hydrated.sourceScenarioId,
    compareBaselineId: hydrated.compareBaselineId,
  };
}

async function buildScenarioSummary(item: any) {
  const scenario = await attachRateSnapshotToSummary(item);
  return {
    id: scenario.id,
    name: scenario.name,
    type: scenario.type,
    status: scenario.status,
    lifecycleYears: scenario.lifecycleYears,
    volume: scenario.volume,
    installRatio: scenario.installRatio,
    rateSnapshot: scenario.rateSnapshot,
    rateSnapshotVersion: scenario.rateSnapshotVersion,
    bomVersionRef: scenario.bomVersionRef,
    compareBaselineId: scenario.compareBaselineId,
    sourceScenarioId: scenario.sourceScenarioId,
    updatedAt: scenario.updatedAt,
  };
}

async function buildVersionSnapshot(id: string) {
  const snapshot = await buildScenarioVersionSnapshot(id);
  const scenario = snapshot.scenario;
  return {
    ...snapshot,
    scenario: {
      ...scenario,
      rateSnapshotVersion: (await ScenarioService.getById(id)).rateSnapshotVersion,
    },
  };
}

async function buildScenarioVersionSnapshot(id: string) {
  const scenario = await prisma.scenario.findUnique({ where: { id } });
  if (!scenario) {
    const err: any = new Error('Scenario not found');
    err.status = 404;
    throw err;
  }

  const hydratedScenario = hydrateJsonFields(scenario, [...JSON_FIELDS]);
  const bomRows = await BomService.listScenarioBomRows(id);

  return {
    triggerSource: 'scenario',
    scenario: {
      id: hydratedScenario.id,
      name: hydratedScenario.name,
      type: hydratedScenario.type,
      status: hydratedScenario.status,
      lifecycleYears: hydratedScenario.lifecycleYears,
      volume: hydratedScenario.volume,
      installRatio: hydratedScenario.installRatio,
      rateSnapshot: hydratedScenario.rateSnapshot,
      bomVersionRef: hydratedScenario.bomVersionRef,
      quoteParamSnapshot: hydratedScenario.quoteParamSnapshot,
      sourceScenarioId: hydratedScenario.sourceScenarioId,
      compareBaselineId: hydratedScenario.compareBaselineId,
      frozenAt: hydratedScenario.frozenAt,
      releasedAt: hydratedScenario.releasedAt,
      updatedAt: hydratedScenario.updatedAt,
    },
    bom: {
      rowCount: bomRows.length,
      rows: bomRows,
    },
  };
}

function badRequest(message: string) {
  const err: any = new Error(message);
  err.status = 400;
  return err;
}

async function assertScenarioDeleteAllowed(client: any, scenario: any) {
  if (!scenario.sourceScenarioId) {
    throw badRequest('Root scenarios cannot be deleted');
  }

  if (scenario.status !== 'draft') {
    throw badRequest('Only draft scenarios can be deleted');
  }

  const referenced = await client.scenario.findFirst({
    where: {
      OR: [
        { sourceScenarioId: scenario.id },
        { compareBaselineId: scenario.id },
      ],
    },
    select: { id: true, name: true },
  });

  if (referenced) {
    throw badRequest(`Scenario is still referenced by ${referenced.name || referenced.id}`);
  }
}

async function deleteScenarioFacts(client: any, scenarioId: string) {
  await AllocationService.deleteScenarioAllocationsWithClient(client, scenarioId);
  await client.quote.deleteMany({ where: { scenarioId } });
  await client.changeEvent.deleteMany({ where: { scenarioId } });
  await client.trackingItem.deleteMany({ where: { scenarioId } });
  await client.priceDiscrepancy.deleteMany({ where: { scenarioId } });
  await client.alertEvent.deleteMany({ where: { scenarioId } });
  await client.harness.deleteMany({ where: { scenarioId } });
  await client.simulationTask.deleteMany({
    where: {
      OR: [
        { scenarioId },
        { baselineScenarioId: scenarioId },
        { convertedScenarioId: scenarioId },
      ],
    },
  });
  await client.annualDropRecord.deleteMany({ where: { scenarioId } });
}

export class ScenarioService {
  static async listByProject(projectId: string) {
    const scenarios = await prisma.scenario.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    });
    return enrichScenarios(scenarios);
  }

  static async getById(id: string) {
    const scenario = await prisma.scenario.findUnique({ where: { id } });
    if (!scenario) {
      const err: any = new Error('Scenario not found');
      err.status = 404;
      throw err;
    }
    return enrichScenario(scenario);
  }

  static async create(projectId: string, data: any) {
    const dbData = await buildCreatePayload(projectId, data);
    const scenario = await prisma.scenario.create({ data: dbData });
    return enrichScenario(scenario);
  }

  static async update(id: string, data: any) {
    const current = await this.getById(id);
    const dbData = await buildUpdatePayload(current, data);
    const scenario = await prisma.scenario.update({ where: { id }, data: dbData });
    return enrichScenario(scenario);
  }

  static async freeze(id: string, createdBy?: string) {
    const scenario = await prisma.scenario.update({
      where: { id },
      data: {
        status: 'frozen',
        frozenAt: new Date(),
      },
    });
    const hydrated = await enrichScenario(scenario);
    const snapshot = await buildVersionSnapshot(id);
    await VersionService.createAutoVersion(hydrated.projectId, {
      label: `BOM冻结 - ${hydrated.name}`,
      notes: `Auto snapshot created when scenario ${hydrated.id} was frozen.`,
      snapshot,
      createdBy,
    });
    return hydrated;
  }

  static async release(id: string, createdBy?: string) {
    const scenario = await prisma.scenario.update({
      where: { id },
      data: {
        status: 'released',
        releasedAt: new Date(),
      },
    });
    const hydrated = await enrichScenario(scenario);
    const snapshot = await buildVersionSnapshot(id);
    await VersionService.createAutoVersion(hydrated.projectId, {
      label: `场景发布 - ${hydrated.name}`,
      notes: `Auto snapshot created when scenario ${hydrated.id} was released.`,
      snapshot,
      createdBy,
    });
    return hydrated;
  }

  static async clone(id: string) {
    return prisma.$transaction(async (tx) => {
      const source = await tx.scenario.findUnique({ where: { id } });
      if (!source) {
        const err: any = new Error('Scenario not found');
        err.status = 404;
        throw err;
      }

      const dbData = await buildClonePayload(source);
      const cloned = await tx.scenario.create({ data: dbData });
      await AllocationService.cloneScenarioAllocationsWithClient(tx, id, cloned.id);
      return enrichScenario(cloned);
    });
  }

  static async delete(id: string) {
    return prisma.$transaction(async (tx) => {
      const scenario = await tx.scenario.findUnique({ where: { id } });
      if (!scenario) {
        const err: any = new Error('Scenario not found');
        err.status = 404;
        throw err;
      }

      const hydrated = await enrichScenario(scenario);
      await assertScenarioDeleteAllowed(tx, hydrated);
      await deleteScenarioFacts(tx, id);
      await tx.scenario.delete({ where: { id } });
      return hydrated;
    });
  }

  static async getSummary(id: string) {
    const scenario = await this.getById(id);
    return buildScenarioSummary(scenario);
  }

  static async compare(ids: string[]) {
    const scenarios = await prisma.scenario.findMany({
      where: { id: { in: ids } },
      orderBy: { createdAt: 'asc' },
    });
    return Promise.all(scenarios.map((scenario) => buildComparisonItem(scenario)));
  }
}
