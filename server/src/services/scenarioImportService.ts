import prisma from '../lib/prisma.js';
import { dehydrateJsonFields, hydrateJsonFields } from '../lib/json.js';
import { AllocationService } from './allocationService.js';
import { syncDerivedProjectPricingFromHarnesses } from './projectPricingSeedService.js';

const PROJECT_JSON_FIELDS = ['costRates', 'metalPrices', 'volumes'] as const;
const SCENARIO_JSON_FIELDS = [
  'config',
  'vehicleConfigs',
  'configSkus',
  'harnessConfigMappings',
  'vehicleConfigMeta',
  'rateSnapshot',
  'quoteParamSnapshot',
] as const;
const SCENARIO_IMPORT_JSON_FIELDS = [
  'config',
  'vehicleConfigs',
  'configSkus',
  'harnessConfigMappings',
  'vehicleConfigMeta',
] as const;
const HARNESS_JSON_FIELDS = ['input', 'result'] as const;

function notFound(message: string) {
  const err: any = new Error(message);
  err.status = 404;
  return err;
}

function badRequest(message: string) {
  const err: any = new Error(message);
  err.status = 400;
  return err;
}

function buildProjectUpdateData(currentProject: any, payload: any, overwriteProjectMeta: boolean) {
  const nextMeta = payload.project.meta;
  const nextConfig = payload.project.config ?? {};

  return dehydrateJsonFields({
    projectCode: overwriteProjectMeta ? nextMeta.projectCode : currentProject.projectCode,
    projectName: overwriteProjectMeta ? nextMeta.projectName : currentProject.projectName,
    customer: overwriteProjectMeta ? nextMeta.customer : currentProject.customer,
    platform: overwriteProjectMeta ? (nextMeta.platform ?? null) : currentProject.platform,
    status: nextMeta.status ?? currentProject.status,
    costRates: nextConfig.costRates ?? {},
    metalPrices: nextConfig.metalPrices ?? {},
    volumes: nextConfig.volumes ?? [],
  }, [...PROJECT_JSON_FIELDS]);
}

function buildScenarioUpdateData(payload: any) {
  return dehydrateJsonFields({
    lifecycleYears: payload.scenario.lifecycleYears,
    config: payload.scenario.config,
    vehicleConfigs: payload.scenario.vehicleConfigs,
    configSkus: payload.scenario.configSkus,
    harnessConfigMappings: payload.scenario.harnessConfigMappings,
    vehicleConfigMeta: payload.scenario.vehicleConfigMeta,
    notes: payload.scenario.note,
  }, [...SCENARIO_IMPORT_JSON_FIELDS]);
}

function sumLifecycleVolumes(volumes: unknown): number {
  if (!Array.isArray(volumes)) {
    return 0;
  }
  return volumes.reduce((sum, row) => {
    const volume = Number((row as { volume?: unknown })?.volume || 0);
    return sum + (Number.isFinite(volume) ? volume : 0);
  }, 0);
}

function buildHarnessCreateManyData(projectId: string, scenarioId: string, harnesses: any[]) {
  return harnesses.map((harness) => dehydrateJsonFields({
    projectId,
    scenarioId,
    harnessId: harness.harnessId,
    harnessName: harness.harnessName,
    input: harness.input,
    result: harness.result,
  }, [...HARNESS_JSON_FIELDS]));
}

function buildTrackingCreateManyData(projectId: string, scenarioId: string, trackingItems: any[]) {
  return trackingItems.map((item) => ({
    projectId,
    scenarioId,
    trackingType: item.trackingType,
    title: item.title,
    sourceRef: item.sourceRef ?? null,
    currentStatus: item.currentStatus ?? 'pending',
    severity: item.severity ?? 'medium',
    owner: item.owner ?? null,
    plannedAction: item.plannedAction ?? null,
    actualResult: item.actualResult ?? null,
    closeReason: item.closeReason ?? null,
    warningRef: item.warningRef ?? null,
    closedAt: item.currentStatus === 'closed' ? new Date() : null,
  }));
}

function assertNoDuplicateHarnessIdsInPayload(harnesses: any[]) {
  const seen = new Set<string>();
  for (const harness of harnesses) {
    const harnessId = String(harness?.harnessId || '').trim();
    if (!harnessId) {
      throw badRequest('Harness import payload contains an empty harnessId');
    }
    if (seen.has(harnessId)) {
      throw badRequest(`Harness ${harnessId} appears multiple times in the same scenario import payload.`);
    }
    seen.add(harnessId);
  }
}

export class ScenarioImportService {
  static async importBaseline(projectId: string, scenarioId: string, payload: any) {
    return prisma.$transaction(async (tx) => {
      const [project, scenario] = await Promise.all([
        tx.project.findUnique({ where: { id: projectId } }),
        tx.scenario.findUnique({ where: { id: scenarioId } }),
      ]);

      if (!project) {
        throw notFound('Project not found');
      }
      if (!scenario || scenario.projectId !== projectId) {
        throw notFound('Scenario not found');
      }

      assertNoDuplicateHarnessIdsInPayload(payload.harnesses);

      const overwriteProjectMeta = payload.overwriteProjectMeta !== false;

      await tx.project.update({
        where: { id: projectId },
        data: buildProjectUpdateData(project, payload, overwriteProjectMeta),
      });

      await tx.scenario.update({
        where: { id: scenarioId },
        data: buildScenarioUpdateData(payload),
      });

      await tx.changeEvent.deleteMany({ where: { scenarioId } });
      await tx.trackingItem.deleteMany({ where: { scenarioId } });
      await tx.harness.deleteMany({ where: { scenarioId } });
      await AllocationService.deleteScenarioAllocationsWithClient(tx, scenarioId);

      if (payload.harnesses.length > 0) {
        await tx.harness.createMany({
          data: buildHarnessCreateManyData(projectId, scenarioId, payload.harnesses),
        });
      }

      const allocationItems = await AllocationService.bulkSyncHarnessRowsWithClient(
        tx,
        projectId,
        scenarioId,
        payload.allocationRows,
      );

      if (payload.trackingItems.length > 0) {
        await tx.trackingItem.createMany({
          data: buildTrackingCreateManyData(projectId, scenarioId, payload.trackingItems),
        });
      }

      const projectHarnesses = await tx.harness.findMany({
        where: { projectId },
        select: { input: true },
      });
      const pricingSeedSummary = await syncDerivedProjectPricingFromHarnesses(tx, {
        projectId,
        harnessInputs: projectHarnesses.map((item) => item.input),
        metalPrices: payload.project?.config?.metalPrices ?? {},
        lifecycleTotalQty: sumLifecycleVolumes(payload.project?.config?.volumes),
      });

      const [nextProject, nextScenario, nextHarnesses, nextTrackingItems] = await Promise.all([
        tx.project.findUnique({ where: { id: projectId } }),
        tx.scenario.findUnique({ where: { id: scenarioId } }),
        tx.harness.findMany({
          where: { scenarioId },
          orderBy: { harnessId: 'asc' },
        }),
        tx.trackingItem.findMany({
          where: { scenarioId },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      if (!nextProject || !nextScenario) {
        throw badRequest('Baseline import failed to persist project or scenario');
      }

      return {
        project: hydrateJsonFields(nextProject, [...PROJECT_JSON_FIELDS]),
        scenario: hydrateJsonFields(nextScenario, [...SCENARIO_JSON_FIELDS]),
        harnesses: nextHarnesses.map((item: any) => hydrateJsonFields(item, [...HARNESS_JSON_FIELDS])),
        allocationItems,
        trackingItems: nextTrackingItems,
        allocationCount: allocationItems.length,
        trackingCount: nextTrackingItems.length,
        pricingSeedSummary,
      };
    });
  }
}
