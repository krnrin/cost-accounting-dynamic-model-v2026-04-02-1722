import type { Prisma } from '@prisma/client';
import prisma from '../lib/prisma.js';
import { calculateWirePrice } from '../lib/pricingMath.js';

type PricingClient = Prisma.TransactionClient | typeof prisma;

type MetalPrices = {
  copper?: number;
  aluminum?: number;
};

type MinimalBomItem = {
  partNo?: unknown;
  partName?: unknown;
  itemCategory?: unknown;
  supplier?: unknown;
  unitPrice?: unknown;
  spec?: unknown;
  copperWeightPerUnit?: unknown;
  aluminumWeightPerUnit?: unknown;
  nonMetalCostPerUnit?: unknown;
};

type MinimalHarnessInput = {
  bom?: unknown;
};

export interface DerivedProjectPricingSeedSummary {
  connectorCreated: number;
  wireCreated: number;
  devPartCreated: number;
  auxiliaryCreated: number;
}

interface SyncDerivedProjectPricingInput {
  projectId: string;
  harnessInputs: Array<string | null | undefined>;
  metalPrices?: MetalPrices | null;
  lifecycleTotalQty?: number;
}

function asString(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim();
}

function asNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseHarnessInput(raw: string | null | undefined): MinimalHarnessInput {
  if (!raw) {
    return {};
  }
  try {
    return JSON.parse(raw) as MinimalHarnessInput;
  } catch {
    return {};
  }
}

function getSafeBom(input: MinimalHarnessInput): MinimalBomItem[] {
  return Array.isArray(input?.bom) ? (input.bom as MinimalBomItem[]) : [];
}

function resolveDevPartCategory(partNo: string): 'plastic' | 'metal' | 'rubber' | 'other' | null {
  const match = partNo.match(/-(HB|ZJ|XJ|OTHER)-/i);
  const code = match?.[1]?.toUpperCase();
  if (code === 'HB') return 'plastic';
  if (code === 'ZJ') return 'metal';
  if (code === 'XJ') return 'rubber';
  if (code === 'OTHER') return 'other';
  return null;
}

function isConnectorLike(itemCategory: string): boolean {
  return itemCategory === 'connector' || itemCategory === 'terminal' || itemCategory === 'ipt_terminal';
}

function buildSeedMaps(
  harnessInputs: Array<string | null | undefined>,
  metalPrices: MetalPrices,
  lifecycleTotalQty: number,
) {
  const connectorMap = new Map<string, {
    partNo: string;
    partName: string;
    supplier: string;
    customerAgreedPrice: number;
    supplierQuotedPrice: number;
    finalNegotiatedPrice: number;
    status: 'pending';
  }>();
  const wireMap = new Map<string, {
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
    calculatedPrice: number;
    validFrom: Date;
  }>();
  const devPartMap = new Map<string, {
    partNo: string;
    partName: string;
    category: 'plastic' | 'metal' | 'rubber' | 'other';
    amortizationQty: number;
    unitPriceWithAmortization: number;
    unitPriceAfterAmortization: number;
    lifecycleTotalQty: number;
  }>();
  const auxiliaryMap = new Map<string, {
    partNo: string;
    partName: string;
    supplier: string;
    unitPrice: number;
  }>();

  for (const rawInput of harnessInputs) {
    const harnessInput = parseHarnessInput(rawInput);
    for (const bomItem of getSafeBom(harnessInput)) {
      const partNo = asString(bomItem.partNo);
      if (!partNo) continue;

      const partName = asString(bomItem.partName) || partNo;
      const supplier = asString(bomItem.supplier);
      const itemCategory = asString(bomItem.itemCategory);
      const unitPrice = asNumber(bomItem.unitPrice);
      const devPartCategory = resolveDevPartCategory(partNo);

      if (devPartCategory) {
        if (!devPartMap.has(partNo)) {
          devPartMap.set(partNo, {
            partNo,
            partName,
            category: devPartCategory,
            amortizationQty: 0,
            unitPriceWithAmortization: unitPrice,
            unitPriceAfterAmortization: unitPrice,
            lifecycleTotalQty,
          });
        }
        continue;
      }

      if (itemCategory === 'wire') {
        if (!wireMap.has(partNo)) {
          const copperWeightG = asNumber(bomItem.copperWeightPerUnit) * 1000;
          const aluminumWeightG = asNumber(bomItem.aluminumWeightPerUnit) * 1000;
          const nonMetalCost = asNumber(bomItem.nonMetalCostPerUnit);
          const processingFee = 0;
          wireMap.set(partNo, {
            partNo,
            partName,
            supplier,
            wireSize: asString(bomItem.spec),
            copperWeightG,
            aluminumWeightG,
            nonMetalCost,
            copperBasePrice: asNumber(metalPrices.copper),
            aluminumBasePrice: asNumber(metalPrices.aluminum),
            processingFee,
            calculatedPrice: calculateWirePrice({
              copperWeightG,
              aluminumWeightG,
              nonMetalCost,
              processingFee,
              copperBasePrice: asNumber(metalPrices.copper),
              aluminumBasePrice: asNumber(metalPrices.aluminum),
            }),
            validFrom: new Date(),
          });
        }
        continue;
      }

      if (isConnectorLike(itemCategory)) {
        if (!connectorMap.has(partNo)) {
          connectorMap.set(partNo, {
            partNo,
            partName,
            supplier,
            customerAgreedPrice: unitPrice,
            supplierQuotedPrice: unitPrice,
            finalNegotiatedPrice: 0,
            status: 'pending',
          });
        }
        continue;
      }

      if (!auxiliaryMap.has(partNo)) {
        auxiliaryMap.set(partNo, {
          partNo,
          partName,
          supplier,
          unitPrice,
        });
      }
    }
  }

  return {
    connectorRows: Array.from(connectorMap.values()),
    wireRows: Array.from(wireMap.values()),
    devPartRows: Array.from(devPartMap.values()),
    auxiliaryRows: Array.from(auxiliaryMap.values()),
  };
}

export async function syncDerivedProjectPricingFromHarnesses(
  client: PricingClient,
  input: SyncDerivedProjectPricingInput,
): Promise<DerivedProjectPricingSeedSummary> {
  const {
    projectId,
    harnessInputs,
    metalPrices = {},
    lifecycleTotalQty = 0,
  } = input;
  const effectiveMetalPrices = metalPrices ?? {};

  const { connectorRows, wireRows, devPartRows, auxiliaryRows } = buildSeedMaps(
    harnessInputs,
    effectiveMetalPrices,
    lifecycleTotalQty,
  );

  const [existingConnectors, existingWires, existingDevParts, existingAuxiliary] = await Promise.all([
    client.connectorPricing.findMany({ where: { projectId }, select: { partNo: true } }),
    client.wirePricing.findMany({ where: { projectId }, select: { partNo: true } }),
    client.devPartPricing.findMany({ where: { projectId }, select: { partNo: true } }),
    client.auxiliaryPricing.findMany({ where: { projectId }, select: { partNo: true } }),
  ]);

  const existingConnectorSet = new Set(existingConnectors.map((row) => row.partNo));
  const existingWireSet = new Set(existingWires.map((row) => row.partNo));
  const existingDevPartSet = new Set(existingDevParts.map((row) => row.partNo));
  const existingAuxiliarySet = new Set(existingAuxiliary.map((row) => row.partNo));

  const connectorsToCreate = connectorRows.filter((row) => !existingConnectorSet.has(row.partNo));
  const wiresToCreate = wireRows.filter((row) => !existingWireSet.has(row.partNo));
  const devPartsToCreate = devPartRows.filter((row) => !existingDevPartSet.has(row.partNo));
  const auxiliaryToCreate = auxiliaryRows.filter((row) => !existingAuxiliarySet.has(row.partNo));

  if (connectorsToCreate.length > 0) {
    await client.connectorPricing.createMany({
      data: connectorsToCreate.map((row) => ({
        projectId,
        ...row,
      })),
    });
  }

  if (wiresToCreate.length > 0) {
    await client.wirePricing.createMany({
      data: wiresToCreate.map((row) => ({
        projectId,
        ...row,
      })),
    });
  }

  if (devPartsToCreate.length > 0) {
    await client.devPartPricing.createMany({
      data: devPartsToCreate.map((row) => ({
        projectId,
        ...row,
      })),
    });
  }

  if (auxiliaryToCreate.length > 0) {
    await client.auxiliaryPricing.createMany({
      data: auxiliaryToCreate.map((row) => ({
        projectId,
        ...row,
      })),
    });
  }

  return {
    connectorCreated: connectorsToCreate.length,
    wireCreated: wiresToCreate.length,
    devPartCreated: devPartsToCreate.length,
    auxiliaryCreated: auxiliaryToCreate.length,
  };
}
