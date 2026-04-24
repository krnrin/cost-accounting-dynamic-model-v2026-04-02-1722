import type { HarnessRecord, ProjectRecord, ScenarioRecord } from '../db';
import type { HarnessConfigMapping, ConfigSku, VehicleConfig } from '@/types/harness';
import type { ProjectConfig } from '@/types/project';
import { buildVehicleConfigsFromSkus } from '@/engine/configuration_model';
import {
  E281_BOM_DATA,
} from './e281_bom';
import {
  E281_CONFIG_SKUS,
  E281_CUSTOMER_QUOTE_SNAPSHOTS,
  E281_FINAL_QUOTE_ONETIME_COSTS,
  E281_HARNESS_CONFIG_MAPPINGS,
  E281_HARNESS_SEED_DATA,
  type E281BaselineImportPayload,
} from './e281';

export type E281ScenarioMode = 'quote_raw' | 'award_corrected';

export interface E281HarnessExpectation {
  harnessId: string;
  harnessName: string;
  vehicleRatio: number;
  materialCost: number;
  exFactoryPrice: number;
  deliveredPrice: number;
}

export interface E281ProjectExpectation {
  vehicleCost: number;
  weightedMaterial: number;
  weightedExFactory: number;
  weightedDelivered: number;
  harnessCount: number;
}

export interface ScenarioMutationRecipeStep {
  kind: 'config_fix' | 'harness_ratio' | 'allocation_scope' | 'annual_drop' | 'rebate';
  target: string;
  before: string | number;
  after: string | number;
  reason: string;
}

export interface ScenarioMutationRecipe {
  id: string;
  fromMode: E281ScenarioMode;
  toMode: E281ScenarioMode;
  label: string;
  description: string;
  steps: ScenarioMutationRecipeStep[];
}

export interface ScenarioVerificationReportCheck {
  key: string;
  label: string;
  status: 'pass' | 'warn' | 'fail';
  expected?: number | string;
  actual?: number | string;
  delta?: number;
  deltaPercent?: number;
  message?: string;
}

export interface ScenarioVerificationReport {
  mode: E281ScenarioMode;
  generatedAt: string;
  status: 'pass' | 'warn' | 'fail';
  inputChecks: ScenarioVerificationReportCheck[];
  harnessChecks: ScenarioVerificationReportCheck[];
  projectChecks: ScenarioVerificationReportCheck[];
  reasonAnalysis: string[];
}

export interface E281ScenarioPayload {
  mode: E281ScenarioMode;
  project: {
    meta: Pick<ProjectRecord['meta'], 'projectCode' | 'projectName' | 'customer' | 'platform' | 'lifecycleYears' | 'status'>;
    config: ProjectConfig;
  };
  scenario: {
    scenarioName: string;
    scenarioType: ScenarioRecord['scenarioType'];
    lifecycleYears: number;
    config: ProjectConfig;
    note: string;
    configSkus: ConfigSku[];
    harnessConfigMappings: HarnessConfigMapping[];
    vehicleConfigs: VehicleConfig[];
    vehicleConfigMeta: NonNullable<ScenarioRecord['vehicleConfigMeta']>;
  };
  harnesses: Array<{
    harnessId: string;
    harnessName: string;
    input: HarnessRecord['input'];
    result?: HarnessRecord['result'];
    eopYear: number | null;
  }>;
  allocationRows: E281BaselineImportPayload['allocationRows'];
  expectedHarnessResults: E281HarnessExpectation[];
  expectedProjectResults?: E281ProjectExpectation;
  mutationRecipe?: ScenarioMutationRecipe;
  verificationNotes: string[];
}

type HarnessSeed = (typeof E281_HARNESS_SEED_DATA)[number];
type OnetimeCostSeed = {
  toolingCost?: number;
  testingCost?: number;
  rndCost?: number;
  allocBase?: number;
};

const QUOTE_RAW_BOM_ROW_EXCLUSIONS: Record<string, string[]> = {
  '6608516992': ['1-2509498-1'],
};

const QUOTE_RAW_RATIO_OVERRIDES: Record<string, number> = {
  '6608491524': 0.105,
  '6608519100': 0.105,
  '6608442965': 0.105,
  '6608544875': 0.105,
};

const QUOTE_RAW_EXPECTATIONS: E281HarnessExpectation[] = [
  { harnessId: '6608491523', harnessName: 'Direct busbar', vehicleRatio: 0.525, materialCost: 88.065204722, exFactoryPrice: 133.787486959714, deliveredPrice: 138.263270293048 },
  { harnessId: '6608491524', harnessName: 'Direct busbar', vehicleRatio: 0.105, materialCost: 87.782613941, exFactoryPrice: 133.406994622716, deliveredPrice: 137.882777956049 },
  { harnessId: '6608442962', harnessName: 'Direct busbar', vehicleRatio: 0.07, materialCost: 97.51096167, exFactoryPrice: 146.203234521603, deliveredPrice: 150.679017854936 },
  { harnessId: '6608442964', harnessName: 'Electric compressor harness', vehicleRatio: 0.595, materialCost: 42.23497185, exFactoryPrice: 70.3595443694296, deliveredPrice: 72.5335511694296 },
  { harnessId: '6608442963', harnessName: 'Electric compressor harness', vehicleRatio: 0.03, materialCost: 84.97742538, exFactoryPrice: 144.093682258018, deliveredPrice: 146.466190758018 },
  { harnessId: '6608516992', harnessName: 'Electric compressor harness', vehicleRatio: 0.225, materialCost: 64.256076649, exFactoryPrice: 120.646556089416, deliveredPrice: 123.019064589416 },
  { harnessId: '6608519100', harnessName: 'Electric compressor harness', vehicleRatio: 0.105, materialCost: 49.324522842, exFactoryPrice: 79.1033359290648, deliveredPrice: 81.2773427290648 },
  { harnessId: '6608442966', harnessName: 'Charge socket harness', vehicleRatio: 0.525, materialCost: 314.222782203, exFactoryPrice: 451.465214044837, deliveredPrice: 461.343072378171 },
  { harnessId: '6608442965', harnessName: 'Charge socket harness', vehicleRatio: 0.105, materialCost: 307.894149753, exFactoryPrice: 444.167740063534, deliveredPrice: 454.045598396867 },
  { harnessId: '6608507680', harnessName: 'Charge socket harness', vehicleRatio: 0.07, materialCost: 328.920957983, exFactoryPrice: 470.089304186576, deliveredPrice: 479.967162519909 },
  { harnessId: '6608544875', harnessName: 'Front-drive direct busbar', vehicleRatio: 0.105, materialCost: 110.50729632, exFactoryPrice: 161.724086703714, deliveredPrice: 166.199870037048 },
];

export const E281_AWARD_CORRECTED_MUTATION_RECIPE: ScenarioMutationRecipe = {
  id: 'e281-award-corrected',
  fromMode: 'quote_raw',
  toMode: 'award_corrected',
  label: 'E281 award corrected',
  description: 'Apply the audited CM030 correction, keep only valid harness coverage, use 3% annual drop, and retain the 10M rebate for the award scenario.',
  steps: [
    {
      kind: 'config_fix',
      target: 'CM030 optional PTC',
      before: '30%',
      after: '0%',
      reason: 'Audit confirmed CM030 has no optional PTC slice.',
    },
    {
      kind: 'harness_ratio',
      target: '6608491524 / 6608519100 / 6608442965',
      before: '10.5%',
      after: '15%',
      reason: 'CM030 standard volume returns from 63k to 90k after removing the ghost optional slice.',
    },
    {
      kind: 'harness_ratio',
      target: '6608544875',
      before: '10.5%',
      after: '0%',
      reason: 'Front-drive direct busbar is removed from the RWD-only CM030 award scenario.',
    },
    {
      kind: 'allocation_scope',
      target: 'one-time allocation',
      before: 'quote workbook legacy spread',
      after: 'targeted harness participation',
      reason: 'Award scenario follows harness-level participation and recovery pricing adjustments.',
    },
    {
      kind: 'annual_drop',
      target: 'annualDropRate',
      before: 0.02,
      after: 0.03,
      reason: 'Award scenario uses the confirmed 3% annual drop rule.',
    },
    {
      kind: 'rebate',
      target: 'QS rebate',
      before: 0,
      after: 10000000,
      reason: 'Award scenario applies the confirmed 10M rebate.',
    },
  ],
};

function cloneProjectConfig(config: ProjectConfig): ProjectConfig {
  return structuredClone(config);
}

function cloneHarnessSeed(seed: HarnessSeed): HarnessSeed {
  return structuredClone(seed);
}

function buildProjectExpectation(expectations: E281HarnessExpectation[]): E281ProjectExpectation {
  const vehicleCost = expectations.reduce((sum, item) => sum + item.deliveredPrice * item.vehicleRatio, 0);
  const weightedMaterial = expectations.reduce((sum, item) => sum + item.materialCost * item.vehicleRatio, 0);
  const weightedExFactory = expectations.reduce((sum, item) => sum + item.exFactoryPrice * item.vehicleRatio, 0);

  return {
    vehicleCost,
    weightedMaterial,
    weightedExFactory,
    weightedDelivered: vehicleCost,
    harnessCount: expectations.length,
  };
}

function createBaseProjectConfig(): ProjectConfig {
  return {
    costRates: {
      laborRate: 35,
      mfgRate: 46.69,
      wasteRate: 0.01,
      mgmtRate: 0.06,
      profitRate: 0.056627,
    },
    internalRates: {
      laborRate: 28.6068525767252,
      indirectLaborRate: 8.49907877266438,
      lowValueConsumablesRate: 0.876354067804185,
      materialConsumptionRate: 1.85629758914502,
      factoryAmortizationRate: 1.45,
      automationAmortizationRate: 2.03,
      otherOverheadRate: 1.42337495669072,
      materialWasteRate: 0.005,
    },
    metalPrices: {
      copper: 76450,
      aluminum: 18910,
    },
    volumes: [
      { year: 1, volume: 85000 },
      { year: 2, volume: 135000 },
      { year: 3, volume: 125000 },
      { year: 4, volume: 114000 },
      { year: 5, volume: 94000 },
      { year: 6, volume: 47000 },
    ],
    annualDropRate: 0.02,
    customerQuoteSnapshots: structuredClone(E281_CUSTOMER_QUOTE_SNAPSHOTS),
    factories: [
      {
        factoryId: 'KS',
        factoryName: 'Kunshan',
        costRates: {
          laborRate: 35,
          mfgRate: 52.2753446503895,
          wasteRate: 0.01,
          mgmtRate: 0.06,
          profitRate: 0.056627,
        },
        efficiencyFactor: 1,
        isBase: true,
        remark: 'Derived from the operating labor-hour quotation baseline.',
      },
    ],
  };
}

function buildQuoteRawHarnessSeeds(): HarnessSeed[] {
  return E281_HARNESS_SEED_DATA.map((seed) => ({
    ...cloneHarnessSeed(seed),
    ratio: QUOTE_RAW_RATIO_OVERRIDES[seed.harnessId] ?? seed.ratio,
  }));
}

function buildQuoteRawConfigSkus(): ConfigSku[] {
  return E281_CONFIG_SKUS.map((sku) => (
    sku.skuId === 'cm030'
      ? {
        ...structuredClone(sku),
        ptcAvailable: true,
        ptcOptionalRatio: 0.3,
        note: 'Raw quote workbook template still shows a 30% optional PTC slice for CM030.',
      }
      : structuredClone(sku)
  ));
}

function buildQuoteRawHarnessMappings(): HarnessConfigMapping[] {
  return [
    ...E281_HARNESS_CONFIG_MAPPINGS.map((mapping) => structuredClone(mapping)),
    {
      harnessId: '6608544875',
      skuId: 'cm030',
      sliceType: 'standard',
      installationRatio: 1,
    },
  ];
}

function buildHarnessEntriesForMode(
  mode: E281ScenarioMode,
  seeds: HarnessSeed[],
): E281ScenarioPayload['harnesses'] {
  return seeds.map((seed) => {
    const bom = structuredClone(E281_BOM_DATA[seed.harnessId] || []);
    const excludedPartNos = mode === 'quote_raw' ? QUOTE_RAW_BOM_ROW_EXCLUSIONS[seed.harnessId] ?? [] : [];
    const filteredBom = excludedPartNos.length === 0
      ? bom
      : bom.filter((item) => !excludedPartNos.includes(item.partNo));

    return {
      harnessId: seed.harnessId,
      harnessName: seed.name,
      input: {
        harnessId: seed.harnessId,
        harnessName: seed.name,
        vehicleRatio: seed.ratio,
        configType: seed.configType,
        functionalSlot: seed.functionalSlot,
        bom: filteredBom,
        frontHours: seed.frontHours,
        backHours: seed.backHours,
        packaging: {
          innerBoxCost: seed.innerPack,
          outerBoxCost: seed.outerPack,
          palletCost: 0,
          trayDividerCost: 0,
          bubbleWrapCost: 0,
          labelCost: 0,
          subtotal: seed.innerPack + seed.outerPack,
        },
        freight: {
          freight: seed.freight,
          excessFreight: seed.exFreight,
          shortHaul: seed.shortHaul,
          thirdPartyWarehouse: seed.thirdParty,
          storage: seed.storage,
          subtotal: seed.freight + seed.exFreight + seed.shortHaul + seed.thirdParty + seed.storage,
        },
      } as HarnessRecord['input'],
      result: undefined,
      eopYear: null,
    };
  });
}

function getOnetimeCostSeed(harnessId: string): OnetimeCostSeed {
  const value = E281_FINAL_QUOTE_ONETIME_COSTS[
    harnessId as keyof typeof E281_FINAL_QUOTE_ONETIME_COSTS
  ];
  return (value ?? {}) as OnetimeCostSeed;
}

function buildAllocationRows(seeds: HarnessSeed[]): E281ScenarioPayload['allocationRows'] {
  return seeds.map((seed) => {
    const costs = getOnetimeCostSeed(seed.harnessId);
    return {
      harnessId: seed.harnessId,
      harnessName: seed.name,
      vehicleRatio: seed.ratio,
      toolingCost: Number(costs.toolingCost || 0),
      testingCost: Number(costs.testingCost || 0),
      rndCost: Number(costs.rndCost || 0),
      allocBase: Math.max(1, Number(costs.allocBase || 1)),
      paymentMode: 'amortized',
      cumProduced: 0,
    };
  });
}

function buildPayload(mode: E281ScenarioMode): E281ScenarioPayload {
  const baseConfig = createBaseProjectConfig();

  if (mode === 'quote_raw') {
    const configSkus = buildQuoteRawConfigSkus();
    const harnessConfigMappings = buildQuoteRawHarnessMappings();
    const vehicleConfigs = buildVehicleConfigsFromSkus(configSkus, harnessConfigMappings);
    const harnessSeeds = buildQuoteRawHarnessSeeds();

    return {
      mode,
      project: {
        meta: {
          projectCode: 'E281',
          projectName: 'Geely E281 high-voltage harness',
          customer: 'Geely',
          platform: 'E281',
          lifecycleYears: 6,
          status: 'quoted',
        },
        config: cloneProjectConfig(baseConfig),
      },
      scenario: {
        scenarioName: 'Quote raw workbook',
        scenarioType: 'final_quote',
        lifecycleYears: 6,
        config: cloneProjectConfig(baseConfig),
        note: 'Raw quote workbook import. Keeps the CM030 ghost optional slice and the front-drive direct busbar inconsistency for verification.',
        configSkus,
        harnessConfigMappings,
        vehicleConfigs,
        vehicleConfigMeta: {
          publishState: 'sales_published',
        },
      },
      harnesses: buildHarnessEntriesForMode(mode, harnessSeeds),
      allocationRows: buildAllocationRows(harnessSeeds),
      expectedHarnessResults: structuredClone(QUOTE_RAW_EXPECTATIONS),
      expectedProjectResults: buildProjectExpectation(QUOTE_RAW_EXPECTATIONS),
      verificationNotes: [
        'CM030 still exposes a 30% optional slice in the raw quote workbook.',
        'Harness 6608544875 remains present as a front-drive direct busbar even though the vehicle family is RWD-only.',
        'Harness 6608516992 intentionally excludes connector 1-2509498-1 in quote_raw so the program matches the current quote workbook instead of the engineering BOM.',
        'This payload is expected to highlight configuration-model inconsistencies when compared against the corrected award scenario.',
      ],
    };
  }

  const correctedConfig = cloneProjectConfig(baseConfig);
  correctedConfig.annualDropRate = 0.03;
  correctedConfig.rebate = {
    totalAmount: 10000000,
    label: 'QS rebate',
    yearDistribution: [10000000, 0, 0, 0, 0, 0],
  };

  return {
    mode,
    project: {
      meta: {
        projectCode: 'E281',
        projectName: 'Geely E281 high-voltage harness',
        customer: 'Geely',
        platform: 'E281',
        lifecycleYears: 6,
        status: 'awarded',
      },
      config: correctedConfig,
    },
    scenario: {
      scenarioName: 'Award corrected',
      scenarioType: 'customer_award',
      lifecycleYears: 6,
      config: correctedConfig,
      note: 'Award scenario corrected from the quote workbook audit result.',
      configSkus: structuredClone(E281_CONFIG_SKUS),
      harnessConfigMappings: structuredClone(E281_HARNESS_CONFIG_MAPPINGS),
      vehicleConfigs: buildVehicleConfigsFromSkus(E281_CONFIG_SKUS, E281_HARNESS_CONFIG_MAPPINGS),
      vehicleConfigMeta: {
        publishState: 'sales_published',
      },
    },
    harnesses: buildHarnessEntriesForMode(mode, E281_HARNESS_SEED_DATA.map((seed) => cloneHarnessSeed(seed))),
    allocationRows: buildAllocationRows(E281_HARNESS_SEED_DATA),
    expectedHarnessResults: [],
    mutationRecipe: structuredClone(E281_AWARD_CORRECTED_MUTATION_RECIPE),
    verificationNotes: [
      'CM030 optional PTC is removed and its standard slice returns to the full 15% mix.',
      'Annual drop is fixed at 3% and the 10M rebate is enabled for the award scenario.',
      'Allocation scope is interpreted as harness-level participation with recovery-driven repricing.',
    ],
  };
}

export function buildE281ScenarioPayload(mode: E281ScenarioMode): E281ScenarioPayload {
  return buildPayload(mode);
}

export function buildE281ScenarioImportPayload(
  mode: E281ScenarioMode,
  overwriteProjectMeta = true,
): E281BaselineImportPayload {
  const payload = buildPayload(mode);

  return {
    overwriteProjectMeta,
    project: payload.project,
    scenario: {
      lifecycleYears: payload.scenario.lifecycleYears,
      config: payload.scenario.config,
      note: payload.scenario.note,
      vehicleConfigMeta: payload.scenario.vehicleConfigMeta,
      configSkus: payload.scenario.configSkus,
      harnessConfigMappings: payload.scenario.harnessConfigMappings,
      vehicleConfigs: payload.scenario.vehicleConfigs,
    },
    harnesses: payload.harnesses,
    allocationRows: payload.allocationRows,
    trackingItems: [],
  };
}
