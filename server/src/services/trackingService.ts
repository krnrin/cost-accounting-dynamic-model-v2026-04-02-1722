import prisma from '../lib/prisma.js';

export class TrackingService {
  static async listByScenario(scenarioId: string) {
    return prisma.trackingItem.findMany({ where: { scenarioId }, orderBy: { createdAt: 'desc' } });
  }

  static async getById(id: string) {
    const item = await prisma.trackingItem.findUnique({ where: { id } });
    if (!item) {
      const err: any = new Error('Tracking item not found');
      err.status = 404;
      throw err;
    }
    return item;
  }

  static async create(projectId: string, scenarioId: string, data: any) {
    return prisma.trackingItem.create({ data: { ...data, projectId, scenarioId } });
  }

  static async update(id: string, data: any) {
    return prisma.trackingItem.update({ where: { id }, data });
  }

  static async close(id: string, closeReason?: string) {
    return prisma.trackingItem.update({
      where: { id },
      data: {
        currentStatus: 'closed',
        closeReason,
        closedAt: new Date(),
      },
    });
  }
}
