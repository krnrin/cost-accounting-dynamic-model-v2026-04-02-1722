import prisma from '../lib/prisma.js';
import { toJson, hydrateJsonFields, dehydrateJsonFields } from '../lib/json.js';
import { AuditService } from './auditService.js';
const QUOTE_JSON_FIELDS = ['data', 'quoteParams', 'quoteResult', 'lockedFields', 'editableFields', 'approvalFields'];
function computeProfitGap(quote) {
    const effectivePrice = Number(quote.effectivePrice ?? quote.arrivalPrice ?? 0);
    const internalCostBaseline = Number(quote.internalCostBaseline ?? 0);
    return effectivePrice - internalCostBaseline;
}
async function computeEffectivePriceForQuote(quote) {
    if (!quote.scenarioId || !quote.harnessId) {
        return {
            effectivePrice: quote.effectivePrice ?? quote.arrivalPrice ?? 0,
            effectivePriceMode: quote.effectivePriceMode ?? 'arrival',
        };
    }
    const allocations = await prisma.allocationItem.findMany({
        where: { scenarioId: quote.scenarioId, harnessId: quote.harnessId },
    });
    if (allocations.length === 0) {
        return {
            effectivePrice: quote.exWorksPrice,
            effectivePriceMode: 'ex_works',
        };
    }
    const allCompleted = allocations.every((item) => item.status === 'completed' || item.status === 'closed');
    if (allCompleted) {
        return {
            effectivePrice: quote.exWorksPrice,
            effectivePriceMode: 'ex_works',
        };
    }
    const anyActive = allocations.some((item) => item.status === 'recovering' || item.status === 'allocated');
    if (anyActive) {
        return {
            effectivePrice: quote.arrivalPrice,
            effectivePriceMode: 'arrival',
        };
    }
    return {
        effectivePrice: quote.exWorksPrice,
        effectivePriceMode: 'ex_works',
    };
}
export class QuoteService {
    static async getQuotesByProject(projectId) {
        const quotes = await prisma.quote.findMany({
            where: { projectId },
            orderBy: { createdAt: 'desc' },
        });
        return quotes.map((q) => hydrateJsonFields(q, [...QUOTE_JSON_FIELDS]));
    }
    static async getQuotesByScenario(scenarioId) {
        const quotes = await prisma.quote.findMany({
            where: { scenarioId },
            orderBy: { createdAt: 'desc' },
        });
        return quotes.map((q) => hydrateJsonFields(q, [...QUOTE_JSON_FIELDS]));
    }
    static async getQuoteById(id) {
        const quote = await prisma.quote.findUnique({ where: { id } });
        if (!quote) {
            const err = new Error('Quote not found');
            err.status = 404;
            throw err;
        }
        return hydrateJsonFields(quote, [...QUOTE_JSON_FIELDS]);
    }
    static async createQuote(projectId, data) {
        const normalized = {
            ...data,
            status: data.status ?? 'draft',
            scenarioId: data.scenarioId ?? null,
            harnessId: data.harnessId ?? null,
            effectivePrice: data.effectivePrice ?? data.arrivalPrice ?? 0,
            profitGap: computeProfitGap(data),
        };
        const existingDraft = await prisma.quote.findFirst({
            where: {
                projectId,
                scenarioId: normalized.scenarioId,
                harnessId: normalized.harnessId,
                template: normalized.template ?? 'geely',
                status: 'draft',
            },
            orderBy: { updatedAt: 'desc' },
        });
        if (existingDraft) {
            return this.updateQuote(existingDraft.id, normalized);
        }
        const dbData = dehydrateJsonFields({ ...normalized, projectId }, [...QUOTE_JSON_FIELDS]);
        const quote = await prisma.quote.create({ data: dbData });
        return hydrateJsonFields(quote, [...QUOTE_JSON_FIELDS]);
    }
    static async updateQuote(id, data) {
        const current = await this.getQuoteById(id);
        if (current.status === 'published') {
            const err = new Error('Published quote cannot be edited');
            err.status = 400;
            throw err;
        }
        const lockedFields = Array.isArray(current.lockedFields) ? current.lockedFields : [];
        const illegalField = Object.keys(data).find((field) => current.customerAccepted && lockedFields.includes(field));
        if (illegalField) {
            const err = new Error(`Field is locked after confirmation: ${illegalField}`);
            err.status = 400;
            throw err;
        }
        const merged = {
            ...current,
            ...data,
            effectivePrice: data.effectivePrice ?? current.effectivePrice ?? data.arrivalPrice ?? current.arrivalPrice ?? 0,
        };
        merged.profitGap = computeProfitGap(merged);
        const dbData = dehydrateJsonFields(merged, [...QUOTE_JSON_FIELDS]);
        const quote = await prisma.quote.update({ where: { id }, data: dbData });
        return hydrateJsonFields(quote, [...QUOTE_JSON_FIELDS]);
    }
    static async confirmQuote(id, createdBy) {
        const current = await this.getQuoteById(id);
        if (current.status === 'published') {
            const err = new Error('Published quote cannot be reconfirmed');
            err.status = 400;
            throw err;
        }
        const merged = {
            ...current,
            customerAccepted: true,
            status: 'confirmed',
        };
        const dbData = dehydrateJsonFields(merged, [...QUOTE_JSON_FIELDS]);
        const quote = await prisma.quote.update({ where: { id }, data: dbData });
        const hydrated = hydrateJsonFields(quote, [...QUOTE_JSON_FIELDS]);
        await VersionService.createAutoVersion(hydrated.projectId, {
            label: `\u62a5\u4ef7\u786e\u8ba4 - ${hydrated.version}`,
            notes: `Auto snapshot created when quote ${hydrated.id} was confirmed.`,
            snapshot: {
                triggerSource: 'quote',
                stage: 'confirmed',
                quote: hydrated,
            },
            createdBy,
        });
        return hydrated;
    }
    static async publishQuote(id, createdBy) {
        const current = await this.getQuoteById(id);
        if (current.status !== 'confirmed') {
            const err = new Error('Only confirmed quotes can be published');
            err.status = 400;
            throw err;
        }
        const publishedAt = new Date().toISOString();
        const merged = {
            ...current,
            status: 'published',
            customerAccepted: true,
        };
        const dbData = dehydrateJsonFields(merged, [...QUOTE_JSON_FIELDS]);
        const quote = await prisma.quote.update({ where: { id }, data: dbData });
        const hydrated = hydrateJsonFields(quote, [...QUOTE_JSON_FIELDS]);
        if (hydrated.scenarioId) {
            await prisma.scenario.update({
                where: { id: hydrated.scenarioId },
                data: {
                    quoteParamSnapshot: toJson({
                        quoteId: hydrated.id,
                        version: hydrated.version,
                        template: hydrated.template,
                        effectivePrice: hydrated.effectivePrice,
                        effectivePriceMode: hydrated.effectivePriceMode,
                        publishedAt,
                        quoteParams: hydrated.quoteParams ?? {},
                        quoteResult: hydrated.quoteResult ?? {},
                    }),
                },
            });
        }
        await VersionService.createAutoVersion(hydrated.projectId, {
            label: `\u62a5\u4ef7\u53d1\u5e03 - ${hydrated.version}`,
            notes: `Auto snapshot created when quote ${hydrated.id} was published.`,
            snapshot: {
                triggerSource: 'quote',
                stage: 'published',
                quote: hydrated,
                publishedAt,
            },
            createdBy,
        });
        return hydrated;
    }
    static async deleteQuote(id) {
        return prisma.quote.delete({ where: { id } });
    }
    static async compareQuotes(ids) {
        const quotes = await prisma.quote.findMany({
            where: { id: { in: ids } },
            orderBy: { createdAt: 'asc' },
        });
        return quotes.map((quote) => {
            const hydrated = hydrateJsonFields(quote, [...QUOTE_JSON_FIELDS]);
            return {
                id: hydrated.id,
                scenarioId: hydrated.scenarioId,
                harnessId: hydrated.harnessId,
                status: hydrated.status,
                customerAccepted: hydrated.customerAccepted,
                effectivePrice: hydrated.effectivePrice,
                arrivalPrice: hydrated.arrivalPrice,
                exWorksPrice: hydrated.exWorksPrice,
                internalCostBaseline: hydrated.internalCostBaseline,
                profitGap: computeProfitGap(hydrated),
            };
        });
    }
    static async compareQuote(id) {
        const quote = await this.getQuoteById(id);
        const effective = await computeEffectivePriceForQuote(quote);
        const merged = { ...quote, ...effective };
        return {
            id: merged.id,
            projectId: merged.projectId,
            scenarioId: merged.scenarioId,
            harnessId: merged.harnessId,
            internalCostBaseline: merged.internalCostBaseline,
            effectivePrice: merged.effectivePrice,
            arrivalPrice: merged.arrivalPrice,
            exWorksPrice: merged.exWorksPrice,
            profitGap: computeProfitGap(merged),
            effectivePriceMode: merged.effectivePriceMode,
        };
    }
    static async getEffectivePrice(id) {
        const quote = await this.getQuoteById(id);
        const effective = await computeEffectivePriceForQuote(quote);
        return {
            id: quote.id,
            effectivePrice: effective.effectivePrice,
            effectivePriceMode: effective.effectivePriceMode,
            arrivalPrice: quote.arrivalPrice,
            exWorksPrice: quote.exWorksPrice,
            customerAccepted: quote.customerAccepted,
        };
    }
}
export class VersionService {
    static async getVersionsByProject(projectId) {
        const versions = await prisma.version.findMany({
            where: { projectId },
            orderBy: { versionNumber: 'desc' },
        });
        return versions.map((v) => hydrateJsonFields(v, ['snapshot']));
    }
    static async createVersion(projectId, data) {
        const dbData = dehydrateJsonFields({ ...data, projectId }, ['snapshot']);
        const version = await prisma.version.create({ data: dbData });
        return hydrateJsonFields(version, ['snapshot']);
    }
    static async createAutoVersion(projectId, params) {
        return prisma.$transaction(async (tx) => {
            const latest = await tx.version.findFirst({
                where: { projectId },
                orderBy: { versionNumber: 'desc' },
            });
            const versionNumber = (latest?.versionNumber ?? 0) + 1;
            const version = await tx.version.create({
                data: {
                    projectId,
                    versionNumber,
                    label: params.label,
                    status: params.status ?? 'published',
                    snapshot: toJson(params.snapshot),
                    notes: params.notes,
                    createdBy: params.createdBy,
                },
            });
            const hydrated = hydrateJsonFields(version, ['snapshot']);
            if (params.createdBy) {
                await AuditService.log({
                    userId: params.createdBy,
                    projectId,
                    action: 'CREATE',
                    entity: 'version',
                    entityId: hydrated.id,
                    details: {
                        label: hydrated.label,
                        status: hydrated.status,
                        triggerSource: params.snapshot?.triggerSource,
                    },
                });
            }
            return hydrated;
        });
    }
    static async updateVersion(id, data) {
        const dbData = dehydrateJsonFields(data, ['snapshot']);
        const version = await prisma.version.update({ where: { id }, data: dbData });
        return hydrateJsonFields(version, ['snapshot']);
    }
    static async updateStatus(id, status) {
        return prisma.version.update({
            where: { id },
            data: { status },
        });
    }
    static async deleteVersion(id) {
        return prisma.version.delete({ where: { id } });
    }
}
