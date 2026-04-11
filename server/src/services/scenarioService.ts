import prisma from '../lib/prisma.js';
import { hydrateJsonFields, dehydrateJsonFields } from '../lib/json.js';
import { BomService } from './bomService.js';
import { VersionService } from './extraServices.js';

const JSON_FIELDS = ['rateSnapshot', 'quoteParamSnapshot'] as const;

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

export class ScenarioService {
  static async listByProject(projectId: string) {
    const scenarios = await prisma.scenario.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    });
    return scenarios.map((item) => hydrateJsonFields(item, [...JSON_FIELDS]));
  }

  static async getById(id: string) {
    const scenario = await prisma.scenario.findUnique({ where: { id } });
    if (!scenario) {
      const err: any = new Error('Scenario not found');
      err.status = 404;
      throw err;
    }
    return hydrateJsonFields(scenario, [...JSON_FIELDS]);
  }

  static async create(projectId: string, data: any) {
    const dbData = dehydrateJsonFields({ ...data, projectId }, [...JSON_FIELDS]);
    const scenario = await prisma.scenario.create({ data: dbData });
    return hydrateJsonFields(scenario, [...JSON_FIELDS]);
  }

  static async update(id: string, data: any) {
    const dbData = dehydrateJsonFields(data, [...JSON_FIELDS]);
    const scenario = await prisma.scenario.update({ where: { id }, data: dbData });
    return hydrateJsonFields(scenario, [...JSON_FIELDS]);
  }

  static async freeze(id: string, createdBy?: string) {
    const scenario = await prisma.scenario.update({
      where: { id },
      data: {
        status: 'frozen',
        frozenAt: new Date(),
      },
    });
    const hydrated = hydrateJsonFields(scenario, [...JSON_FIELDS]);
    const snapshot = await buildScenarioVersionSnapshot(id);
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
    const hydrated = hydrateJsonFields(scenario, [...JSON_FIELDS]);
    const snapshot = await buildScenarioVersionSnapshot(id);
    await VersionService.createAutoVersion(hydrated.projectId, {
      label: `场景发布 - ${hydrated.name}`,
      notes: `Auto snapshot created when scenario ${hydrated.id} was released.`,
      snapshot,
      createdBy,
    });
    return hydrated;
  }

  static async clone(id: string) {
    const source = await this.getById(id);
    const dbData = dehydrateJsonFields({
      projectId: source.projectId,
      type: source.type,
      name: `${source.name}-复制`,
      status: 'draft',
      lifecycleYears: source.lifecycleYears,
      volume: source.volume,
      installRatio: source.installRatio,
      rateSnapshot: source.rateSnapshot,
      bomVersionRef: source.bomVersionRef,
      quoteParamSnapshot: source.quoteParamSnapshot,
      sourceScenarioId: source.id,
      compareBaselineId: source.compareBaselineId ?? source.id,
      notes: source.notes,
      createdBy: source.createdBy,
    }, [...JSON_FIELDS]);
    const cloned = await prisma.scenario.create({ data: dbData });
    return hydrateJsonFields(cloned, [...JSON_FIELDS]);
  }

  static async getSummary(id: string) {
    const scenario = await this.getById(id);
    return {
      id: scenario.id,
      name: scenario.name,
      type: scenario.type,
      status: scenario.status,
      lifecycleYears: scenario.lifecycleYears,
      volume: scenario.volume,
      installRatio: scenario.installRatio,
      rateSnapshot: scenario.rateSnapshot,
      bomVersionRef: scenario.bomVersionRef,
      compareBaselineId: scenario.compareBaselineId,
      sourceScenarioId: scenario.sourceScenarioId,
      updatedAt: scenario.updatedAt,
    };
  }

  static async compare(ids: string[]) {
    const scenarios = await prisma.scenario.findMany({
      where: { id: { in: ids } },
      orderBy: { createdAt: 'asc' },
    });
    return scenarios.map((scenario) => {
      const hydrated = hydrateJsonFields(scenario, [...JSON_FIELDS]);
      return {
        id: hydrated.id,
        name: hydrated.name,
        type: hydrated.type,
        status: hydrated.status,
        lifecycleYears: hydrated.lifecycleYears,
        volume: hydrated.volume,
        installRatio: hydrated.installRatio,
        rateSnapshot: hydrated.rateSnapshot,
        bomVersionRef: hydrated.bomVersionRef,
        sourceScenarioId: hydrated.sourceScenarioId,
        compareBaselineId: hydrated.compareBaselineId,
      };
    });
  }
}
