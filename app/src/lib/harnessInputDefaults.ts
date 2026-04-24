import type {
  BomItem,
  FreightCost,
  HarnessInput,
  PackagingCost,
  WireItem,
} from '@/types/harness';

export const EMPTY_PACKAGING_COST: PackagingCost = {
  innerBoxCost: 0,
  outerBoxCost: 0,
  palletCost: 0,
  trayDividerCost: 0,
  bubbleWrapCost: 0,
  labelCost: 0,
  subtotal: 0,
};

export const EMPTY_FREIGHT_COST: FreightCost = {
  freight: 0,
  excessFreight: 0,
  shortHaul: 0,
  thirdPartyWarehouse: 0,
  storage: 0,
  subtotal: 0,
};

export function getSafeBom(
  bom: Array<BomItem | WireItem> | null | undefined,
): Array<BomItem | WireItem> {
  return Array.isArray(bom) ? bom : [];
}

export function createMinimalHarnessInput(
  values: Pick<HarnessInput, 'harnessId' | 'harnessName'> &
    Partial<Omit<HarnessInput, 'harnessId' | 'harnessName'>>
): HarnessInput {
  return {
    harnessId: values.harnessId,
    harnessName: values.harnessName,
    vehicleRatio: Number(values.vehicleRatio || 0),
    installationRatio: values.installationRatio,
    bom: getSafeBom(values.bom),
    frontHours: Number(values.frontHours || 0),
    backHours: Number(values.backHours || 0),
    packaging: {
      ...EMPTY_PACKAGING_COST,
      ...(values.packaging || {}),
    },
    freight: {
      ...EMPTY_FREIGHT_COST,
      ...(values.freight || {}),
    },
    configType: values.configType,
    functionalSlot: values.functionalSlot,
  };
}

export function normalizeHarnessInput(input: HarnessInput): HarnessInput {
  return createMinimalHarnessInput(input);
}

export function normalizeHarnessRecordInput(
  input: Partial<HarnessInput> | null | undefined,
  fallback: Pick<HarnessInput, 'harnessId' | 'harnessName'> &
    Partial<Omit<HarnessInput, 'harnessId' | 'harnessName'>>
): HarnessInput {
  return createMinimalHarnessInput({
    ...fallback,
    ...(input || {}),
    harnessId: input?.harnessId || fallback.harnessId,
    harnessName: input?.harnessName || fallback.harnessName,
  });
}
