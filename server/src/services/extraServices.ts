import prisma from '../lib/prisma.js';
import { hydrateJsonFields, dehydrateJsonFields } from '../lib/json.js';

const QUOTE_JSON_FIELDS = ['data', 'quoteParams', 'quoteResult', 'lockedFields', 'editableFields', 'approvalFields'] as const;

function computeProfitGap(quote: any) {
  const effectivePrice = Number(quote.effectivePrice ?? quote.arrivalPrice ?? 0);
  const internalCostBaseline = Number(quote.internalCostBaseline ?? 0);
  return effectivePrice - internalCostBaseline;
}

async function computeEffectivePriceForQuote(quote: any) {
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
  static async getQuotesByProject(projectId: string) {
    const quotes = await prisma.quote.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
    return quotes.map((q) => hydrateJsonFields(q, [...QUOTE_JSON_FIELDS]));
  }

  static async getQuotesByScenario(scenarioId: string) {
    const quotes = await prisma.quote.findMany({
      where: { scenarioId },
      orderBy: { createdAt: 'desc' },
    });
    return quotes.map((q) => hydrateJsonFields(q, [...QUOTE_JSON_FIELDS]));
  }

  static async getQuoteById(id: string) {
    const quote = await prisma.quote.findUnique({ where: { id } });
    if (!quote) {
      const err: any = new Error('Quote not found');
      err.status = 404;
      throw err;
    }
    return hydrateJsonFields(quote, [...QUOTE_JSON_FIELDS]);
  }

  static async createQuote(projectId: string, data: any) {
    const normalized = {
      ...data,
      scenarioId: data.scenarioId ?? null,
      harnessId: data.harnessId ?? null,
      effectivePrice: data.effectivePrice ?? data.arrivalPrice ?? 0,
      profitGap: computeProfitGap(data),
    };
    const dbData = dehydrateJsonFields({ ...normalized, projectId }, [...QUOTE_JSON_FIELDS]);
    const quote = await prisma.quote.create({ data: dbData });
    return hydrateJsonFields(quote, [...QUOTE_JSON_FIELDS]);
  }

  static async updateQuote(id: string, data: any) {
    const current = await this.getQuoteById(id);
    const lockedFields = Array.isArray(current.lockedFields) ? current.lockedFields : [];
    const illegalField = Object.keys(data).find((field) => current.customerAccepted && lockedFields.includes(field));
    if (illegalField) {
      const err: any = new Error(`Field is locked after confirmation: ${illegalField}`);
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

  static async confirmQuote(id: string) {
    const current = await this.getQuoteById(id);
    const merged = {
      ...current,
      customerAccepted: true,
      status: 'confirmed',
    };
    const dbData = dehydrateJsonFields(merged, [...QUOTE_JSON_FIELDS]);
    const quote = await prisma.quote.update({ where: { id }, data: dbData });
    return hydrateJsonFields(quote, [...QUOTE_JSON_FIELDS]);
  }

  static async deleteQuote(id: string) {
    return prisma.quote.delete({ where: { id } });
  }

  static async compareQuotes(ids: string[]) {
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

  static async compareQuote(id: string) {
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

  static async getEffectivePrice(id: string) {
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
  static async getVersionsByProject(projectId: string) {
    const versions = await prisma.version.findMany({
      where: { projectId },
      orderBy: { versionNumber: 'desc' },
    });
    return versions.map((v) => hydrateJsonFields(v, ['snapshot']));
  }

  static async createVersion(projectId: string, data: any) {
    const dbData = dehydrateJsonFields({ ...data, projectId }, ['snapshot']);
    const version = await prisma.version.create({ data: dbData });
    return hydrateJsonFields(version, ['snapshot']);
  }

  static async updateVersion(id: string, data: any) {
    const dbData = dehydrateJsonFields(data, ['snapshot']);
    const version = await prisma.version.update({ where: { id }, data: dbData });
    return hydrateJsonFields(version, ['snapshot']);
  }

  static async updateStatus(id: string, status: string) {
    return prisma.version.update({
      where: { id },
      data: { status },
    });
  }

  static async deleteVersion(id: string) {
    return prisma.version.delete({ where: { id } });
  }
}
