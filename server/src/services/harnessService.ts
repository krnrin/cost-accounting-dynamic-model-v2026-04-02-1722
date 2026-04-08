import prisma from '../lib/prisma.js';
import { hydrateJsonFields, dehydrateJsonFields } from '../lib/json.js';

const JSON_FIELDS = ['input', 'result'] as const;

export class HarnessService {
  static async getHarnessesByProject(projectId: string) {
    const harnesses = await prisma.harness.findMany({
      where: { projectId },
      orderBy: { harnessId: 'asc' },
    });
    return harnesses.map((h) => hydrateJsonFields(h, [...JSON_FIELDS]));
  }

  static async createHarness(projectId: string, data: any) {
    const dbData = dehydrateJsonFields({ ...data, projectId }, [...JSON_FIELDS]);
    const harness = await prisma.harness.create({ data: dbData });
    return hydrateJsonFields(harness, [...JSON_FIELDS]);
  }

  static async updateHarness(id: string, data: any) {
    const dbData = dehydrateJsonFields(data, [...JSON_FIELDS]);
    const harness = await prisma.harness.update({ where: { id }, data: dbData });
    return hydrateJsonFields(harness, [...JSON_FIELDS]);
  }

  static async deleteHarness(id: string) {
    return prisma.harness.delete({ where: { id } });
  }
}
