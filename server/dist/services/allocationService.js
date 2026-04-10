import prisma from '../lib/prisma.js';
function normalizeAllocation(data) {
    const totalAmount = Number(data.totalAmount || 0);
    const baselineVolume = Number(data.baselineVolume || 0);
    const unitAllocation = baselineVolume > 0 ? totalAmount / baselineVolume : 0;
    const actualRecovered = Number(data.actualRecovered || 0);
    const plannedRecovery = Number(data.plannedRecovery || totalAmount);
    const remainingRecovery = Math.max(0, totalAmount - actualRecovered);
    const recoveryProgress = plannedRecovery > 0 ? actualRecovered / plannedRecovery : 0;
    return {
        ...data,
        totalAmount,
        baselineVolume,
        unitAllocation,
        plannedRecovery,
        actualRecovered,
        remainingRecovery,
        recoveryProgress,
    };
}
export class AllocationService {
    static async listByScenario(scenarioId, burdenSide) {
        return prisma.allocationItem.findMany({
            where: {
                scenarioId,
                ...(burdenSide ? { burdenSide } : {}),
            },
            orderBy: { createdAt: 'asc' },
        });
    }
    static async getById(id) {
        const item = await prisma.allocationItem.findUnique({ where: { id } });
        if (!item) {
            const err = new Error('Allocation not found');
            err.status = 404;
            throw err;
        }
        return item;
    }
    static async create(projectId, scenarioId, data) {
        const normalized = normalizeAllocation({ ...data, projectId, scenarioId });
        return prisma.allocationItem.create({ data: normalized });
    }
    static async update(id, data) {
        const current = await this.getById(id);
        const normalized = normalizeAllocation({ ...current, ...data });
        return prisma.allocationItem.update({ where: { id }, data: normalized });
    }
}
