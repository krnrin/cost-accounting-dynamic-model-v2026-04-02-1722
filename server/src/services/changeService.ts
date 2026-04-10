import prisma from '../lib/prisma.js';
import { fromJson, toJson } from '../lib/json.js';

function normalizeImpact(data: any) {
  return {
    ...data,
    affectedHarnessIds: Array.isArray(data.affectedHarnessIds) ? data.affectedHarnessIds : [],
    affectedBomRows: Array.isArray(data.affectedBomRows) ? data.affectedBomRows : [],
    costImpact: Number(data.costImpact || 0),
    quoteImpact: Number(data.quoteImpact || 0),
    residualImpact: Number(data.residualImpact || 0),
  };
}

function hydrate(event: any) {
  return {
    ...event,
    affectedHarnessIds: fromJson(event.affectedHarnessIds, []),
    affectedBomRows: fromJson(event.affectedBomRows, []),
  };
}

export class ChangeService {
  static async listByScenario(scenarioId: string) {
    const rows = await prisma.changeEvent.findMany({ where: { scenarioId }, orderBy: { createdAt: 'desc' } });
    return rows.map(hydrate);
  }

  static async getById(id: string) {
    const event = await prisma.changeEvent.findUnique({ where: { id } });
    if (!event) {
      const err: any = new Error('Change event not found');
      err.status = 404;
      throw err;
    }
    return hydrate(event);
  }

  static async create(projectId: string, scenarioId: string, data: any) {
    const normalized = normalizeImpact({ ...data, projectId, scenarioId });
    const created = await prisma.changeEvent.create({
      data: {
        ...normalized,
        affectedHarnessIds: toJson(normalized.affectedHarnessIds),
        affectedBomRows: toJson(normalized.affectedBomRows),
      },
    });
    return hydrate(created);
  }

  static async update(id: string, data: any) {
    const current = await this.getById(id);
    const normalized = normalizeImpact({ ...current, ...data });
    const updated = await prisma.changeEvent.update({
      where: { id },
      data: {
        ...normalized,
        affectedHarnessIds: toJson(normalized.affectedHarnessIds),
        affectedBomRows: toJson(normalized.affectedBomRows),
      },
    });
    return hydrate(updated);
  }

  static async calculateImpact(id: string) {
    const event = await this.getById(id);
    const costImpact = event.affectedBomRows.reduce((sum: number, row: any) => sum + Number(row.deltaAmount || 0), 0);
    const residualImpact = event.affectedBomRows
      .filter((row: any) => row.changeType === 'cancelled')
      .reduce((sum: number, row: any) => sum + Number(row.deltaAmount || 0), 0);
    const quoteImpact = costImpact;
    return this.update(id, {
      costImpact,
      quoteImpact,
      residualImpact,
      status: 'calculated',
    });
  }
}
