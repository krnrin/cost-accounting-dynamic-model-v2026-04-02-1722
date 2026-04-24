import { describe, expect, it } from 'vitest';
import {
  applyHarnessConfigMappings,
  buildVehicleConfigsFromSkus,
  computeHarnessInstallationRatios,
  expandConfigSkus,
} from '../configuration_model';
import {
  E281_CONFIG_SKUS,
  E281_HARNESS_CONFIG_MAPPINGS,
  E281_VEHICLE_CONFIGS,
} from '@/data/seeds/e281';
import type { ConfigSku, HarnessConfigMapping } from '@/types/harness';

const configSkus: ConfigSku[] = [
  {
    skuId: 'cm010',
    cmCode: 'CM010',
    skuName: 'Qihang',
    mixRatio: 0.1,
    drivetrain: 'rwd',
    ptcAvailable: true,
    ptcOptionalRatio: 0.3,
  },
  {
    skuId: 'cm030',
    cmCode: 'CM030',
    skuName: 'Starship',
    mixRatio: 0.15,
    drivetrain: 'rwd',
    ptcAvailable: false,
    ptcOptionalRatio: 0,
  },
];

const mappings: HarnessConfigMapping[] = [
  { harnessId: 'H-STD', skuId: 'cm010', sliceType: 'standard', installationRatio: 1 },
  { harnessId: 'H-OPT', skuId: 'cm010', sliceType: 'optional', installationRatio: 1 },
  { harnessId: 'H-CM030', skuId: 'cm030', sliceType: 'standard', installationRatio: 1 },
  { harnessId: 'H-UNUSED', skuId: 'cm030', sliceType: 'optional', installationRatio: 1 },
];

describe('configuration_model', () => {
  it('expands sku mix ratios into standard and optional slices', () => {
    const vehicleConfigs = expandConfigSkus(configSkus);

    expect(vehicleConfigs).toEqual([
      expect.objectContaining({ configId: 'cm010-standard', salesRatio: 0.07, sliceType: 'standard' }),
      expect.objectContaining({ configId: 'cm010-optional', salesRatio: 0.03, sliceType: 'optional' }),
      expect.objectContaining({ configId: 'cm030-standard', salesRatio: 0.15, sliceType: 'standard' }),
    ]);
  });

  it('applies harness mappings only to matching slices', () => {
    const mapped = applyHarnessConfigMappings(expandConfigSkus(configSkus), mappings);

    expect(mapped.find((config) => config.configId === 'cm010-standard')?.harnessIds).toEqual(['H-STD']);
    expect(mapped.find((config) => config.configId === 'cm010-optional')?.harnessIds).toEqual(['H-OPT']);
    expect(mapped.find((config) => config.configId === 'cm030-standard')?.harnessIds).toEqual(['H-CM030']);
  });

  it('computes installation ratios from config slices and mappings', () => {
    const vehicleConfigs = buildVehicleConfigsFromSkus(configSkus, mappings);
    const ratioMap = computeHarnessInstallationRatios(vehicleConfigs, mappings);

    expect(ratioMap.get('H-STD')).toBe(0.07);
    expect(ratioMap.get('H-OPT')).toBe(0.03);
    expect(ratioMap.get('H-CM030')).toBe(0.15);
    expect(ratioMap.has('H-UNUSED')).toBe(false);
  });

  it('encodes corrected E281 CM030 no-PTC business rule', () => {
    const cm030 = E281_CONFIG_SKUS.find((sku) => sku.skuId === 'cm030');
    const ratioMap = computeHarnessInstallationRatios(E281_VEHICLE_CONFIGS, E281_HARNESS_CONFIG_MAPPINGS);

    expect(cm030).toEqual(expect.objectContaining({ ptcAvailable: false, ptcOptionalRatio: 0 }));
    expect(E281_VEHICLE_CONFIGS.some((config) => config.skuId === 'cm030' && config.sliceType === 'optional')).toBe(false);
    expect(ratioMap.get('6608491524')).toBe(0.15);
    expect(ratioMap.get('6608519100')).toBe(0.15);
    expect(ratioMap.get('6608442965')).toBe(0.15);
    expect(ratioMap.has('6608544875')).toBe(false);
  });
});
