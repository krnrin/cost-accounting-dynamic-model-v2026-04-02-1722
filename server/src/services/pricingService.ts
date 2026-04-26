import type { Prisma } from '@prisma/client';
import prisma from '../lib/prisma.js';
import { calculateDevPartAmortizedPrice, calculateMoldTotalCost, calculateWirePrice, roundMoney } from '../lib/pricingMath.js';

export type ConnectorPricingInput = {
  partNo: string;
  partName: string;
  supplier: string;
  customerAgreedPrice: number;
  supplierQuotedPrice: number;
  finalNegotiatedPrice: number;
  status: 'pending' | 'agreed' | 'dispute' | 'approved';
  disputeReason?: string;
  approvedBy?: string;
};

export type WirePricingInput = {
  partNo: string;
  partName: string;
  supplier: string;
  wireSize: string;
  copperWeightG: number;
  aluminumWeightG: number;
  nonMetalCost: number;
  copperBasePrice: number;
  aluminumBasePrice: number;
  processingFee: number;
  validFrom?: Date;
  validTo?: Date | null;
};

export type DevPartPricingInput = {
  partNo: string;
  partName: string;
  category: 'plastic' | 'metal' | 'rubber' | 'other';
  amortizationQty: number;
  unitPriceAfterAmortization: number;
  lifecycleTotalQty: number;
};

export type DevPartMoldInput = {
  moldType: 'sample' | 'mass';
  moldName: string;
  moldCost: number;
  isAmortized?: boolean;
};

export type AuxiliaryPricingInput = {
  partNo: string;
  partName: string;
  supplier: string;
  unitPrice: number;
};

export type PriceDiscrepancyInput = {
  harnessId?: string;
  partNo: string;
  partName: string;
  partCategory: 'connector' | 'wire' | 'dev_part' | 'auxiliary' | 'other';
  referencePrice: number;
  actualPrice: number;
  status?: 'open' | 'escalated' | 'resolved' | 'accepted';
  resolutionType?: 'harness_price_up' | 'supplier_price_down' | 'accepted_loss';
  resolutionNote?: string;
  assignedTo?: string;
};

const ACTIVE_DISCREPANCY_STATUSES = ['open', 'escalated'] as const;

type DiscrepancyStore = Pick<Prisma.TransactionClient, 'priceDiscrepancy'>;

function notFound(message: string): never {
  const err = new Error(message) as Error & { status?: number };
  err.status = 404;
  throw err;
}

function assertProject(recordProjectId: string, expectedProjectId: string, message: string) {
  if (recordProjectId !== expectedProjectId) {
    notFound(message);
  }
}

function normalizeOptionalString(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function buildDiscrepancyMetrics(referencePrice: number, actualPrice: number) {
  const discrepancy = roundMoney(actualPrice - referencePrice);
  const discrepancyRate = referencePrice === 0 ? 0 : roundMoney(discrepancy / referencePrice);
  return { discrepancy, discrepancyRate };
}

async function findActiveDiscrepancyForUpsert(
  store: DiscrepancyStore,
  params: {
    projectId: string;
    scenarioId: string;
    harnessId: string | null;
    partNo: string;
    partCategory: PriceDiscrepancyInput['partCategory'];
  }
) {
  const baseWhere = {
    projectId: params.projectId,
    scenarioId: params.scenarioId,
    partNo: params.partNo,
    partCategory: params.partCategory,
    status: { in: [...ACTIVE_DISCREPANCY_STATUSES] },
  };

  const exact = await store.priceDiscrepancy.findFirst({
    where: {
      ...baseWhere,
      harnessId: params.harnessId,
    },
    orderBy: { updatedAt: 'desc' },
  });

  if (exact || !params.harnessId) {
    return exact;
  }

  return store.priceDiscrepancy.findFirst({
    where: {
      ...baseWhere,
      harnessId: null,
    },
    orderBy: { updatedAt: 'desc' },
  });
}

export class PricingService {
  static async listConnectors(projectId: string) {
    return prisma.connectorPricing.findMany({
      where: { projectId },
      orderBy: [{ updatedAt: 'desc' }, { partNo: 'asc' }],
    });
  }

  static async createConnector(projectId: string, input: ConnectorPricingInput, createdBy?: string) {
    return prisma.connectorPricing.create({
      data: {
        projectId,
        ...input,
        createdBy: createdBy ?? 'system',
      },
    });
  }

  static async updateConnector(projectId: string, recordId: string, input: Partial<ConnectorPricingInput>) {
    const record = await prisma.connectorPricing.findUnique({ where: { id: recordId } });
    if (!record) notFound('Connector pricing record not found');
    assertProject(record.projectId, projectId, 'Connector pricing record not found in project');

    return prisma.connectorPricing.update({
      where: { id: recordId },
      data: {
        ...input,
      },
    });
  }

  static async listWires(projectId: string) {
    return prisma.wirePricing.findMany({
      where: { projectId },
      orderBy: [{ updatedAt: 'desc' }, { partNo: 'asc' }],
    });
  }

  static async createWire(projectId: string, input: WirePricingInput) {
    return prisma.wirePricing.create({
      data: {
        projectId,
        ...input,
        calculatedPrice: calculateWirePrice(input),
        validFrom: input.validFrom ?? new Date(),
      },
    });
  }

  static async updateWire(projectId: string, recordId: string, input: Partial<WirePricingInput>) {
    const record = await prisma.wirePricing.findUnique({ where: { id: recordId } });
    if (!record) notFound('Wire pricing record not found');
    assertProject(record.projectId, projectId, 'Wire pricing record not found in project');

    const merged = {
      copperWeightG: input.copperWeightG ?? record.copperWeightG,
      aluminumWeightG: input.aluminumWeightG ?? record.aluminumWeightG,
      nonMetalCost: input.nonMetalCost ?? record.nonMetalCost,
      copperBasePrice: input.copperBasePrice ?? record.copperBasePrice,
      aluminumBasePrice: input.aluminumBasePrice ?? record.aluminumBasePrice,
      processingFee: input.processingFee ?? record.processingFee,
    };

    return prisma.wirePricing.update({
      where: { id: recordId },
      data: {
        ...input,
        calculatedPrice: calculateWirePrice(merged),
      },
    });
  }

  static async recalculateWiresByMetalBasePrice(projectId: string, copperBasePrice: number, aluminumBasePrice: number) {
    const records = await prisma.wirePricing.findMany({ where: { projectId } });
    if (records.length === 0) return [];

    const updates = await prisma.$transaction(records.map((record) => prisma.wirePricing.update({
      where: { id: record.id },
      data: {
        copperBasePrice,
        aluminumBasePrice,
        calculatedPrice: calculateWirePrice({
          copperWeightG: record.copperWeightG,
          aluminumWeightG: record.aluminumWeightG,
          nonMetalCost: record.nonMetalCost,
          processingFee: record.processingFee,
          copperBasePrice,
          aluminumBasePrice,
        }),
      },
    })));

    return updates;
  }

  static async listDevParts(projectId: string) {
    return prisma.devPartPricing.findMany({
      where: { projectId },
      include: { molds: true },
      orderBy: [{ updatedAt: 'desc' }, { partNo: 'asc' }],
    });
  }

  static async createDevPart(projectId: string, input: DevPartPricingInput) {
    return prisma.devPartPricing.create({
      data: {
        projectId,
        ...input,
        unitPriceWithAmortization: calculateDevPartAmortizedPrice(
          input.unitPriceAfterAmortization,
          0,
          input.amortizationQty
        ),
      },
      include: { molds: true },
    });
  }

  static async updateDevPart(projectId: string, recordId: string, input: Partial<DevPartPricingInput>) {
    const record = await prisma.devPartPricing.findUnique({
      where: { id: recordId },
      include: { molds: true },
    });
    if (!record) notFound('Dev part pricing record not found');
    assertProject(record.projectId, projectId, 'Dev part pricing record not found in project');

    const nextAmortizationQty = input.amortizationQty ?? record.amortizationQty;
    const nextUnitPriceAfter = input.unitPriceAfterAmortization ?? record.unitPriceAfterAmortization;
    const moldTotal = calculateMoldTotalCost(record.molds);

    return prisma.devPartPricing.update({
      where: { id: recordId },
      data: {
        ...input,
        unitPriceWithAmortization: calculateDevPartAmortizedPrice(nextUnitPriceAfter, moldTotal, nextAmortizationQty),
      },
      include: { molds: true },
    });
  }

  static async addDevPartMold(projectId: string, recordId: string, input: DevPartMoldInput) {
    const record = await prisma.devPartPricing.findUnique({
      where: { id: recordId },
      include: { molds: true },
    });
    if (!record) notFound('Dev part pricing record not found');
    assertProject(record.projectId, projectId, 'Dev part pricing record not found in project');

    await prisma.devPartMold.create({
      data: {
        devPartPricingId: recordId,
        ...input,
        isAmortized: input.isAmortized ?? false,
      },
    });

    const latest = await prisma.devPartPricing.findUnique({
      where: { id: recordId },
      include: { molds: true },
    });
    if (!latest) notFound('Dev part pricing record not found');

    const moldTotal = calculateMoldTotalCost(latest.molds);
    await prisma.devPartPricing.update({
      where: { id: recordId },
      data: {
        unitPriceWithAmortization: calculateDevPartAmortizedPrice(
          latest.unitPriceAfterAmortization,
          moldTotal,
          latest.amortizationQty
        ),
      },
    });

    return prisma.devPartPricing.findUnique({
      where: { id: recordId },
      include: { molds: true },
    });
  }

  static async listAuxiliary(projectId: string) {
    return prisma.auxiliaryPricing.findMany({
      where: { projectId },
      orderBy: [{ updatedAt: 'desc' }, { partNo: 'asc' }],
    });
  }

  static async createAuxiliary(projectId: string, input: AuxiliaryPricingInput) {
    return prisma.auxiliaryPricing.create({
      data: {
        projectId,
        ...input,
      },
    });
  }

  static async updateAuxiliary(projectId: string, recordId: string, input: Partial<AuxiliaryPricingInput>) {
    const record = await prisma.auxiliaryPricing.findUnique({ where: { id: recordId } });
    if (!record) notFound('Auxiliary pricing record not found');
    assertProject(record.projectId, projectId, 'Auxiliary pricing record not found in project');

    return prisma.auxiliaryPricing.update({
      where: { id: recordId },
      data: input,
    });
  }

  static async listDiscrepancies(projectId: string, scenarioId: string) {
    return prisma.priceDiscrepancy.findMany({
      where: { projectId, scenarioId },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    });
  }

  static async createDiscrepancy(projectId: string, scenarioId: string, input: PriceDiscrepancyInput) {
    const harnessId = normalizeOptionalString(input.harnessId);
    const { discrepancy, discrepancyRate } = buildDiscrepancyMetrics(input.referencePrice, input.actualPrice);

    return prisma.$transaction(async (tx) => {
      const existing = await findActiveDiscrepancyForUpsert(tx, {
        projectId,
        scenarioId,
        harnessId,
        partNo: input.partNo,
        partCategory: input.partCategory,
      });

      if (existing) {
        return tx.priceDiscrepancy.update({
          where: { id: existing.id },
          data: {
            harnessId: harnessId ?? existing.harnessId ?? null,
            partNo: input.partNo,
            partName: input.partName,
            partCategory: input.partCategory,
            referencePrice: input.referencePrice,
            actualPrice: input.actualPrice,
            discrepancy,
            discrepancyRate,
            status: input.status ?? existing.status,
            resolutionType: input.resolutionType ?? existing.resolutionType,
            resolutionNote: input.resolutionNote ?? existing.resolutionNote,
            assignedTo: input.assignedTo ?? existing.assignedTo,
          },
        });
      }

      return tx.priceDiscrepancy.create({
        data: {
          projectId,
          scenarioId,
          harnessId,
          partNo: input.partNo,
          partName: input.partName,
          partCategory: input.partCategory,
          referencePrice: input.referencePrice,
          actualPrice: input.actualPrice,
          discrepancy,
          discrepancyRate,
          status: input.status ?? 'open',
          resolutionType: input.resolutionType,
          resolutionNote: input.resolutionNote,
          assignedTo: input.assignedTo,
        },
      });
    });
  }

  static async updateDiscrepancy(projectId: string, scenarioId: string, recordId: string, input: Partial<PriceDiscrepancyInput>) {
    const record = await prisma.priceDiscrepancy.findUnique({ where: { id: recordId } });
    if (!record) notFound('Price discrepancy record not found');
    assertProject(record.projectId, projectId, 'Price discrepancy record not found in project');
    if (record.scenarioId !== scenarioId) notFound('Price discrepancy record not found in scenario');

    const nextReferencePrice = input.referencePrice ?? record.referencePrice;
    const nextActualPrice = input.actualPrice ?? record.actualPrice;
    const discrepancy = roundMoney(nextActualPrice - nextReferencePrice);
    const discrepancyRate = nextReferencePrice === 0 ? 0 : roundMoney(discrepancy / nextReferencePrice);

    return prisma.priceDiscrepancy.update({
      where: { id: recordId },
      data: {
        ...input,
        discrepancy,
        discrepancyRate,
      },
    });
  }

  // [PR-040] DELETE methods for pricing resources
  static async deleteConnector(projectId: string, recordId: string) {
    const record = await prisma.connectorPricing.findUnique({ where: { id: recordId } });
    if (!record) notFound('Connector pricing record not found');
    assertProject(record.projectId, projectId, 'Connector pricing record not found in project');
    await prisma.connectorPricing.delete({ where: { id: recordId } });
  }

  static async deleteWire(projectId: string, recordId: string) {
    const record = await prisma.wirePricing.findUnique({ where: { id: recordId } });
    if (!record) notFound('Wire pricing record not found');
    assertProject(record.projectId, projectId, 'Wire pricing record not found in project');
    await prisma.wirePricing.delete({ where: { id: recordId } });
  }

  static async deleteDevPart(projectId: string, recordId: string) {
    const record = await prisma.devPartPricing.findUnique({ where: { id: recordId } });
    if (!record) notFound('Dev part pricing record not found');
    assertProject(record.projectId, projectId, 'Dev part pricing record not found in project');
    await prisma.devPartPricing.delete({ where: { id: recordId } });
  }

  static async deleteAuxiliary(projectId: string, recordId: string) {
    const record = await prisma.auxiliaryPricing.findUnique({ where: { id: recordId } });
    if (!record) notFound('Auxiliary pricing record not found');
    assertProject(record.projectId, projectId, 'Auxiliary pricing record not found in project');
    await prisma.auxiliaryPricing.delete({ where: { id: recordId } });
  }
}
