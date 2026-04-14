import prisma from '../lib/prisma.js';
import { hydrateJsonFields, dehydrateJsonFields } from '../lib/json.js';
const JSON_FIELDS = ['costRates', 'metalPrices', 'volumes'];
function buildImportedProjectCode(projectCode) {
    return `${projectCode}-IMP-${Math.random().toString(36).slice(2, 6).toUpperCase()}`.slice(0, 32);
}
function normalizeImportedProject(pkg) {
    const projectMeta = pkg?.project?.meta ?? {};
    const projectConfig = pkg?.project?.config ?? {};
    return {
        projectCode: buildImportedProjectCode(String(projectMeta.projectCode || 'IMPORTED')),
        projectName: `${String(projectMeta.projectName || '\u5bfc\u5165\u9879\u76ee')} (\u5bfc\u5165)`,
        customer: String(projectMeta.customer || '\u672a\u77e5\u5ba2\u6237'),
        platform: projectMeta.platform ? String(projectMeta.platform) : undefined,
        status: String(projectMeta.status || 'draft'),
        costRates: projectConfig.costRates ?? {},
        metalPrices: projectConfig.metalPrices ?? {},
        volumes: projectConfig.volumes ?? [],
    };
}
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
    static async importProjectPackage(pkg, userId) {
        const normalizedProject = normalizeImportedProject(pkg);
        const harnesses = Array.isArray(pkg?.harnesses) ? pkg.harnesses : [];
        const quotes = Array.isArray(pkg?.quotes) ? pkg.quotes : [];
        const importedProject = await prisma.$transaction(async (tx) => {
            const project = await tx.project.create({
                data: dehydrateJsonFields({ ...normalizedProject, createdBy: userId }, [...JSON_FIELDS]),
            });
            const scenarioIdMap = new Map();
            const harnessIdMap = new Map();
            const scenarioIds = new Set();
            for (const harness of harnesses) {
                if (typeof harness?.scenarioId === 'string' && harness.scenarioId) {
                    scenarioIds.add(harness.scenarioId);
                }
            }
            for (const quote of quotes) {
                if (typeof quote?.scenarioId === 'string' && quote.scenarioId) {
                    scenarioIds.add(quote.scenarioId);
                }
            }
            let scenarioIndex = 1;
            for (const sourceScenarioId of scenarioIds) {
                const importedScenario = await tx.scenario.create({
                    data: {
                        projectId: project.id,
                        type: 'initial_quote',
                        name: `\u5bfc\u5165\u573a\u666f ${String(scenarioIndex).padStart(3, '0')}`,
                        status: 'draft',
                        lifecycleYears: 5,
                        volume: 0,
                        installRatio: 1,
                        rateSnapshot: '{}',
                        quoteParamSnapshot: '{}',
                        createdBy: userId,
                    },
                });
                scenarioIdMap.set(sourceScenarioId, importedScenario.id);
                scenarioIndex += 1;
            }
            for (const harness of harnesses) {
                const importedHarness = await tx.harness.create({
                    data: dehydrateJsonFields({
                        projectId: project.id,
                        scenarioId: typeof harness?.scenarioId === 'string' ? (scenarioIdMap.get(harness.scenarioId) ?? null) : null,
                        harnessId: String(harness?.harnessId || harness?.id || crypto.randomUUID()),
                        harnessName: String(harness?.harnessName || '\u5bfc\u5165\u7ebf\u675f'),
                        input: harness?.input ?? {},
                        result: harness?.result ?? undefined,
                    }, ['input', 'result']),
                });
                if (typeof harness?.harnessId === 'string' && harness.harnessId) {
                    harnessIdMap.set(harness.harnessId, importedHarness.harnessId);
                }
            }
            for (const quote of quotes) {
                await tx.quote.create({
                    data: dehydrateJsonFields({
                        projectId: project.id,
                        scenarioId: typeof quote?.scenarioId === 'string' ? (scenarioIdMap.get(quote.scenarioId) ?? null) : null,
                        harnessId: typeof quote?.harnessId === 'string' ? (harnessIdMap.get(quote.harnessId) ?? quote.harnessId) : null,
                        version: String(quote?.version || 'imported'),
                        status: String(quote?.status || 'draft'),
                        template: String(quote?.template || 'geely'),
                        data: quote?.data ?? {},
                        quoteParams: quote?.quoteParams ?? {},
                        quoteResult: quote?.quoteResult ?? {},
                        internalCostBaseline: Number(quote?.internalCostBaseline || 0),
                        profitGap: Number(quote?.profitGap || 0),
                        exWorksPrice: Number(quote?.exWorksPrice || 0),
                        arrivalPrice: Number(quote?.arrivalPrice || 0),
                        effectivePrice: Number(quote?.effectivePrice ?? quote?.arrivalPrice ?? 0),
                        effectivePriceMode: String(quote?.effectivePriceMode || 'arrival'),
                        customerBurdenMode: String(quote?.customerBurdenMode || 'supplier_full'),
                        recoveryCompletionBehavior: String(quote?.recoveryCompletionBehavior || 'notify_only'),
                        customerAccepted: Boolean(quote?.customerAccepted),
                        lockedFields: quote?.lockedFields ?? [],
                        editableFields: quote?.editableFields ?? [],
                        approvalFields: quote?.approvalFields ?? [],
                    }, ['data', 'quoteParams', 'quoteResult', 'lockedFields', 'editableFields', 'approvalFields']),
                });
            }
            return project;
        });
        return this.getProjectById(importedProject.id);
    }
    static async deleteProject(id) {
        return prisma.project.delete({ where: { id } });
    }
}
