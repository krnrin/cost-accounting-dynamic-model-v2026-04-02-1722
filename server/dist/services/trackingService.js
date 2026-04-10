import prisma from '../lib/prisma.js';
export class TrackingService {
    static async listByScenario(scenarioId) {
        return prisma.trackingItem.findMany({ where: { scenarioId }, orderBy: { createdAt: 'desc' } });
    }
    static async getById(id) {
        const item = await prisma.trackingItem.findUnique({ where: { id } });
        if (!item) {
            const err = new Error('Tracking item not found');
            err.status = 404;
            throw err;
        }
        return item;
    }
    static async create(projectId, scenarioId, data) {
        return prisma.trackingItem.create({ data: { ...data, projectId, scenarioId } });
    }
    static async update(id, data) {
        return prisma.trackingItem.update({ where: { id }, data });
    }
    static async close(id, closeReason) {
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
