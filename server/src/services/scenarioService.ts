import prisma from '../lib/prisma.js';
import { hydrateJsonFields, dehydrateJsonFields } from '../lib/json.js';

const JSON_FIELDS = ['rateSnapshot', 'quoteParamSnapshot'] as const;

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
}
