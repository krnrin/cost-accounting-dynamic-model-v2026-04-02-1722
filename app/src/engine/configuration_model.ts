import type {
  ConfigSku,
  ConfigSliceType,
  HarnessInput,
  HarnessConfigMapping,
  VehicleConfig,
} from '@/types/harness';

function roundRatio(value: number): number {
  return Number(value.toFixed(6));
}

function buildConfigName(sku: ConfigSku, sliceType: ConfigSliceType): string {
  const suffix = sliceType === 'optional' ? 'O' : 'S';
  return `${sku.cmCode} ${sku.skuName} ${suffix}`;
}

export function expandConfigSkus(configSkus: ConfigSku[]): VehicleConfig[] {
  return configSkus.flatMap((sku) => {
    const standardRatio = roundRatio(
      sku.mixRatio * (sku.ptcAvailable ? 1 - sku.ptcOptionalRatio : 1),
    );
    const optionalRatio = sku.ptcAvailable
      ? roundRatio(sku.mixRatio * sku.ptcOptionalRatio)
      : 0;

    const slices: VehicleConfig[] = [];
    if (standardRatio > 0) {
      slices.push({
        configId: `${sku.skuId}-standard`,
        configName: buildConfigName(sku, 'standard'),
        salesRatio: standardRatio,
        harnessIds: [],
        skuId: sku.skuId,
        cmCode: sku.cmCode,
        sliceType: 'standard',
        ptcInstalled: false,
        ptcAvailable: sku.ptcAvailable,
        mixRatio: sku.mixRatio,
        ptcOptionalRatio: sku.ptcOptionalRatio,
        drivetrain: sku.drivetrain,
        note: sku.note,
      });
    }

    if (optionalRatio > 0) {
      slices.push({
        configId: `${sku.skuId}-optional`,
        configName: buildConfigName(sku, 'optional'),
        salesRatio: optionalRatio,
        harnessIds: [],
        skuId: sku.skuId,
        cmCode: sku.cmCode,
        sliceType: 'optional',
        ptcInstalled: true,
        ptcAvailable: sku.ptcAvailable,
        mixRatio: sku.mixRatio,
        ptcOptionalRatio: sku.ptcOptionalRatio,
        drivetrain: sku.drivetrain,
        note: sku.note,
      });
    }

    return slices;
  });
}

export function applyHarnessConfigMappings(
  vehicleConfigs: VehicleConfig[],
  harnessConfigMappings: HarnessConfigMapping[],
): VehicleConfig[] {
  return vehicleConfigs.map((config) => {
    if (!config.skuId || !config.sliceType) {
      return config;
    }

    const harnessIds = harnessConfigMappings
      .filter((mapping) => {
        if (mapping.skuId !== config.skuId) return false;
        if (mapping.sliceType === 'all') return true;
        return mapping.sliceType === config.sliceType;
      })
      .filter((mapping) => mapping.installationRatio > 0)
      .map((mapping) => mapping.harnessId);

    return {
      ...config,
      harnessIds: [...new Set(harnessIds)],
    };
  });
}

export function buildVehicleConfigsFromSkus(
  configSkus: ConfigSku[],
  harnessConfigMappings: HarnessConfigMapping[],
): VehicleConfig[] {
  return applyHarnessConfigMappings(expandConfigSkus(configSkus), harnessConfigMappings);
}

export function resolveScenarioVehicleConfigs(params: {
  vehicleConfigs?: VehicleConfig[];
  configSkus?: ConfigSku[];
  harnessConfigMappings?: HarnessConfigMapping[];
}): VehicleConfig[] {
  if (params.vehicleConfigs?.length) {
    return params.vehicleConfigs;
  }
  if (params.configSkus?.length) {
    return buildVehicleConfigsFromSkus(params.configSkus, params.harnessConfigMappings ?? []);
  }
  return [];
}

export function computeHarnessInstallationRatios(
  vehicleConfigs: VehicleConfig[],
  harnessConfigMappings: HarnessConfigMapping[] = [],
): Map<string, number> {
  if (harnessConfigMappings.length === 0) {
    const ratioMap = new Map<string, number>();
    for (const config of vehicleConfigs) {
      for (const harnessId of config.harnessIds) {
        ratioMap.set(harnessId, roundRatio((ratioMap.get(harnessId) || 0) + config.salesRatio));
      }
    }
    return ratioMap;
  }

  const ratioMap = new Map<string, number>();
  for (const config of vehicleConfigs) {
    if (!config.skuId || !config.sliceType) {
      for (const harnessId of config.harnessIds) {
        ratioMap.set(harnessId, roundRatio((ratioMap.get(harnessId) || 0) + config.salesRatio));
      }
      continue;
    }

    const mappings = harnessConfigMappings.filter((mapping) => {
      if (mapping.skuId !== config.skuId) return false;
      if (mapping.sliceType === 'all') return true;
      return mapping.sliceType === config.sliceType;
    });

    for (const mapping of mappings) {
      const contribution = config.salesRatio * mapping.installationRatio;
      ratioMap.set(
        mapping.harnessId,
        roundRatio((ratioMap.get(mapping.harnessId) || 0) + contribution),
      );
    }
  }

  return ratioMap;
}

export function applyInstallationRatiosToHarnessInputs(
  inputs: HarnessInput[],
  vehicleConfigs: VehicleConfig[],
  harnessConfigMappings: HarnessConfigMapping[] = [],
): HarnessInput[] {
  if (inputs.length === 0) return inputs;
  const ratioMap = computeHarnessInstallationRatios(vehicleConfigs, harnessConfigMappings);
  if (ratioMap.size === 0) {
    return inputs.map((input) => ({
      ...input,
      installationRatio: input.installationRatio ?? input.vehicleRatio,
    }));
  }

  return inputs.map((input) => ({
    ...input,
    installationRatio: ratioMap.get(input.harnessId) ?? input.installationRatio ?? input.vehicleRatio,
  }));
}

export function applyInstallationRatiosToHarnessRecords<T extends { harnessId: string; input: HarnessInput }>(
  records: T[],
  vehicleConfigs: VehicleConfig[],
  harnessConfigMappings: HarnessConfigMapping[] = [],
): T[] {
  if (records.length === 0) return records;
  const enrichedInputs = applyInstallationRatiosToHarnessInputs(
    records.map((record) => record.input),
    vehicleConfigs,
    harnessConfigMappings,
  );
  return records.map((record, index) => ({
    ...record,
    input: enrichedInputs[index] ?? record.input,
  }));
}
