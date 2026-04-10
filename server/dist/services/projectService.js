import prisma from '../lib/prisma.js';
import { hydrateJsonFields, dehydrateJsonFields } from '../lib/json.js';
const JSON_FIELDS = ['costRates', 'metalPrices', 'volumes'];
export class ProjectService {
    static async getAllProjects(filters) {
        const search = filters?.search?.trim();
        const status = filters?.status?.trim();
        const projects = await prisma.project.findMany({
            where: {
                ...(status ? { status } : {}),
                ...(search
                    ? {
                        OR: [
                            { projectCode: { contains: search } },
                            { projectName: { contains: search } },
                            { customer: { contains: search } },
                        ],
                    }
                    : {}),
            },
            include: {
                creator: { select: { id: true, name: true, email: true } },
            },
            orderBy: { updatedAt: 'desc' },
        });
        return projects.map((p) => hydrateJsonFields(p, [...JSON_FIELDS]));
    }
    static async getProjectById(id) {
        const project = await prisma.project.findUnique({
            where: { id },
            include: {
                creator: { select: { id: true, name: true, email: true } },
                harnesses: true,
                quotes: true,
                versions: true,
            },
        });
        if (!project) {
            const err = new Error('Project not found');
            err.status = 404;
            throw err;
        }
        return hydrateJsonFields(project, [...JSON_FIELDS]);
    }
    static async createProject(data, userId) {
        const dbData = dehydrateJsonFields({ ...data, createdBy: userId }, [...JSON_FIELDS]);
        const project = await prisma.project.create({ data: dbData });
        return hydrateJsonFields(project, [...JSON_FIELDS]);
    }
    static async updateProject(id, data) {
        const dbData = dehydrateJsonFields(data, [...JSON_FIELDS]);
        const project = await prisma.project.update({ where: { id }, data: dbData });
        return hydrateJsonFields(project, [...JSON_FIELDS]);
    }
    static async getProjectDashboard(id) {
        const project = await prisma.project.findUnique({
            where: { id },
            include: {
                harnesses: true,
                quotes: { orderBy: { updatedAt: 'desc' } },
                versions: true,
                scenarios: { orderBy: { createdAt: 'asc' } },
                allocations: true,
            },
        });
        if (!project) {
            const err = new Error('Project not found');
            err.status = 404;
            throw err;
        }
        const hydrated = hydrateJsonFields(project, [...JSON_FIELDS]);
        const quoteRecords = hydrated.quotes ?? [];
        const latestQuote = quoteRecords[0] ? hydrateJsonFields(quoteRecords[0], ['data', 'quoteResult', 'quoteParams']) : null;
        const quoteTotal = latestQuote?.quoteResult?.arrivalPrice
            ?? latestQuote?.effectivePrice
            ?? latestQuote?.arrivalPrice
            ?? latestQuote?.data?.totals?.deliveredPrice
            ?? null;
        const internalCostBaseline = latestQuote?.internalCostBaseline ?? null;
        const effectivePrice = latestQuote?.effectivePrice ?? quoteTotal;
        const latestProfitGap = typeof effectivePrice === 'number' && typeof internalCostBaseline === 'number'
            ? effectivePrice - internalCostBaseline
            : latestQuote?.profitGap ?? null;
        const allocations = hydrated.allocations ?? [];
        const totalAllocationAmount = allocations.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0);
        const totalRecoveredAmount = allocations.reduce((sum, item) => sum + Number(item.actualRecovered || 0), 0);
        const recoveryRate = totalAllocationAmount > 0 ? totalRecoveredAmount / totalAllocationAmount : 0;
        return {
            id: hydrated.id,
            projectCode: hydrated.projectCode,
            projectName: hydrated.projectName,
            customer: hydrated.customer,
            platform: hydrated.platform,
            status: hydrated.status,
            harnessCount: hydrated.harnesses?.length ?? 0,
            scenarioCount: hydrated.scenarios?.length ?? 0,
            quoteCount: quoteRecords.length,
            versionCount: hydrated.versions?.length ?? 0,
            latestQuoteTotal: quoteTotal,
            internalCostBaseline,
            latestProfitGap,
            totalAllocationAmount,
            totalRecoveredAmount,
            recoveryRate,
            updatedAt: hydrated.updatedAt,
            scenarios: (hydrated.scenarios ?? []).map((scenario) => ({
                id: scenario.id,
                name: scenario.name,
                type: scenario.type,
                status: scenario.status,
                lifecycleYears: scenario.lifecycleYears,
                createdAt: scenario.createdAt,
            })),
            latestQuote: latestQuote ? {
                id: latestQuote.id,
                version: latestQuote.version,
                template: latestQuote.template,
                status: latestQuote.status,
                effectivePrice: latestQuote.effectivePrice,
                effectivePriceMode: latestQuote.effectivePriceMode,
                updatedAt: latestQuote.updatedAt,
            } : null,
        };
    }
    static async deleteProject(id) {
        return prisma.project.delete({ where: { id } });
    }
}
