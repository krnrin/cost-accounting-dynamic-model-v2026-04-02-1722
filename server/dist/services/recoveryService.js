import prisma from '../lib/prisma.js';
function buildProgress(allocation, actualRecovered) {
    const planned = Number(allocation.plannedRecovery || allocation.totalAmount || 0);
    return planned > 0 ? actualRecovered / planned : 0;
}
export class RecoveryService {
    static async listByAllocation(allocationItemId) {
        return prisma.recoveryRecord.findMany({
            where: { allocationItemId },
            orderBy: { createdAt: 'asc' },
        });
    }
    static async create(allocationItemId, input) {
        const allocation = await prisma.allocationItem.findUnique({ where: { id: allocationItemId } });
        if (!allocation) {
            const err = new Error('Allocation not found');
            err.status = 404;
            throw err;
        }
        const record = await prisma.recoveryRecord.create({
            data: {
                allocationItemId,
                projectId: allocation.projectId,
                scenarioId: allocation.scenarioId,
                period: input.period,
                cumulativeVolume: input.cumulativeVolume,
                installRatioSnapshot: input.installRatioSnapshot,
                recoveredAmount: input.recoveredAmount,
                remainingAmount: Math.max(0, allocation.totalAmount - input.recoveredAmount),
                status: input.status || 'normal',
                remark: input.remark,
            },
        });
        const recoveryProgress = buildProgress(allocation, input.recoveredAmount);
        await prisma.allocationItem.update({
            where: { id: allocationItemId },
            data: {
                actualRecovered: input.recoveredAmount,
                remainingRecovery: Math.max(0, allocation.totalAmount - input.recoveredAmount),
                recoveryProgress,
                status: recoveryProgress >= 1 ? 'completed' : 'recovering',
            },
        });
        return record;
    }
    static async forecast(allocationItemId) {
        const allocation = await prisma.allocationItem.findUnique({ where: { id: allocationItemId } });
        if (!allocation) {
            const err = new Error('Allocation not found');
            err.status = 404;
            throw err;
        }
        const annualVolume = allocation.baselineVolume || 1;
        const remaining = Math.max(0, allocation.totalAmount - allocation.actualRecovered);
        const estimatedYears = allocation.unitAllocation > 0 ? remaining / (allocation.unitAllocation * annualVolume) : null;
        return {
            allocationItemId,
            totalAmount: allocation.totalAmount,
            actualRecovered: allocation.actualRecovered,
            remainingRecovery: allocation.remainingRecovery,
            recoveryProgress: allocation.recoveryProgress,
            estimatedYears,
        };
    }
    static async complete(allocationItemId) {
        const allocation = await prisma.allocationItem.findUnique({ where: { id: allocationItemId } });
        if (!allocation) {
            const err = new Error('Allocation not found');
            err.status = 404;
            throw err;
        }
        const completed = await prisma.allocationItem.update({
            where: { id: allocationItemId },
            data: {
                actualRecovered: allocation.totalAmount,
                remainingRecovery: 0,
                recoveryProgress: 1,
                status: 'completed',
                completedAt: new Date(),
                priceAdjustReminder: allocation.recoveryCompletionBehavior === 'trigger_price_adjust',
            },
        });
        return {
            id: completed.id,
            projectId: completed.projectId, // [PR-040] 添加 projectId 用于审计日志
            status: completed.status,
            recoveryCompletionBehavior: completed.recoveryCompletionBehavior,
            priceAdjustReminder: completed.priceAdjustReminder,
        };
    }
}
