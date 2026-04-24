import { db, type ProjectRecord, type HarnessRecord, type ScenarioRecord } from '../db';
import type { OnetimeCostRecord, TrackingItemRecord } from '../db';
import type { ConfigSku, HarnessConfigMapping, VehicleConfig } from '@/types/harness';
import type { CustomerQuoteSnapshot, ProjectConfig } from '@/types/project';
import { buildVehicleConfigsFromSkus } from '@/engine/configuration_model';
import { E281_BOM_DATA } from './e281_bom';

export const E281_CUSTOMER_QUOTE_SNAPSHOTS: Record<string, CustomerQuoteSnapshot> = {
  '6608442962': { deliveredPrice: 135.40559232771614, exFactoryPrice: 124.8998089943828 },
  '6608442963': { deliveredPrice: 125.7094325488182, exFactoryPrice: 119.6069240488182 },
  '6608442964': { deliveredPrice: 61.63430249131618, exFactoryPrice: 60.99629569131618 },
  '6608442965': { deliveredPrice: 424.569553714797, exFactoryPrice: 417.99169538146367 },
  '6608442966': { deliveredPrice: 440.7754565438982, exFactoryPrice: 427.7375982105649 },
  '6608491523': { deliveredPrice: 131.6729166456282, exFactoryPrice: 121.04713331229486 },
  '6608491524': { deliveredPrice: 130.3380380924197, exFactoryPrice: 119.63225475908636 },
  '6608507680': { deliveredPrice: 450.4701650890175, exFactoryPrice: 443.89230675568416 },
  '6608516992': { deliveredPrice: 101.26720536438722, exFactoryPrice: 100.66469686438722 },
  '6608519100': { deliveredPrice: 57.292345895918515, exFactoryPrice: 56.81833909591852 },
  '6608544875': { deliveredPrice: 177.17267494302374, exFactoryPrice: 168.8068916096904 },
};

export const E281_FINAL_QUOTE_ONETIME_COSTS = {
  '6608491523': { toolingCost: 88000, testingCost: 222000, allocBase: 50000 },
  '6608491524': { toolingCost: 39000, testingCost: 275000, allocBase: 50000 },
  '6608442962': { toolingCost: 29000, testingCost: 275000, allocBase: 50000 },
  '6608442964': { toolingCost: 0, testingCost: 8200, allocBase: 50000 },
  '6608442963': { toolingCost: 0, testingCost: 275000, allocBase: 50000 },
  '6608516992': { toolingCost: 0, testingCost: 0, allocBase: 50000 },
  '6608519100': { toolingCost: 0, testingCost: 0, allocBase: 50000 },
  '6608442966': { toolingCost: 65000, testingCost: 258000, allocBase: 50000 },
  '6608442965': { toolingCost: 0, testingCost: 0, allocBase: 50000 },
  '6608507680': { toolingCost: 0, testingCost: 0, allocBase: 50000 },
  '6608544875': { toolingCost: 197000, testingCost: 0, allocBase: 50000 },
} as const;

export const E281_HARNESS_SEED_DATA = [
  {
    harnessId: '6608491523',
    name: '鐩存祦姣嶇嚎鎬绘垚',
    ratio: 0.525,
    configType: 'S' as const,
    functionalSlot: '鐩存祦姣嶇嚎',
    frontHours: 0.236596919607843,
    backHours: 0.137432146078431,
    innerPack: 1.94245,
    outerPack: 0.35,
    freight: 0,
    exFreight: 0,
    shortHaul: 0.333333333333333,
    thirdParty: 1.5,
    storage: 0.35,
  },
  {
    harnessId: '6608491524',
    name: '鐩存祦姣嶇嚎鎬绘垚',
    ratio: 0.15,
    configType: 'S' as const,
    functionalSlot: '鐩存祦姣嶇嚎',
    frontHours: 0.236596919607843,
    backHours: 0.136765479411765,
    innerPack: 1.94245,
    outerPack: 0.35,
    freight: 0,
    exFreight: 0,
    shortHaul: 0.333333333333333,
    thirdParty: 1.5,
    storage: 0.35,
  },
  {
    harnessId: '6608442962',
    name: '鐩存祦姣嶇嚎鎬绘垚',
    ratio: 0.07,
    configType: 'S' as const,
    functionalSlot: '鐩存祦姣嶇嚎',
    frontHours: 0.250208947385621,
    backHours: 0.14279838496732,
    innerPack: 1.94245,
    outerPack: 0.35,
    freight: 0,
    exFreight: 0,
    shortHaul: 0.333333333333333,
    thirdParty: 1.5,
    storage: 0.35,
  },
  {
    harnessId: '6608442964',
    name: '鐢靛姩鍘嬬缉鏈虹嚎鏉熸€绘垚',
    ratio: 0.595,
    configType: 'S' as const,
    functionalSlot: 'electric-compressor-harness',
    frontHours: 0.140286274509804,
    backHours: 0.106822625816993,
    innerPack: 0.3940068,
    outerPack: 0.14,
    freight: 0,
    exFreight: 0,
    shortHaul: 0.0,
    thirdParty: 1.5,
    storage: 0.14,
  },
  {
    harnessId: '6608442963',
    name: '鐢靛姩鍘嬬缉鏈虹嚎鏉熸€绘垚',
    ratio: 0.03,
    configType: 'O' as const,
    functionalSlot: 'electric-compressor-harness',
    frontHours: 0.367048529411765,
    backHours: 0.157781895751634,
    innerPack: 0.5225085,
    outerPack: 0.175,
    freight: 0,
    exFreight: 0,
    shortHaul: 0.0,
    thirdParty: 1.5,
    storage: 0.175,
  },
  {
    harnessId: '6608516992',
    name: '鐢靛姩鍘嬬缉鏈虹嚎鏉熸€绘垚',
    ratio: 0.225,
    configType: 'O' as const,
    functionalSlot: 'electric-compressor-harness',
    frontHours: 0.367048529411765,
    backHours: 0.157568006862745,
    innerPack: 0.5225085,
    outerPack: 0.175,
    freight: 0,
    exFreight: 0,
    shortHaul: 0.0,
    thirdParty: 1.5,
    storage: 0.175,
  },
  {
    harnessId: '6608519100',
    name: '鐢靛姩鍘嬬缉鏈虹嚎鏉熸€绘垚',
    ratio: 0.15,
    configType: 'S' as const,
    functionalSlot: 'electric-compressor-harness',
    frontHours: 0.144339052287582,
    backHours: 0.110730531372549,
    innerPack: 0.3940068,
    outerPack: 0.14,
    freight: 0,
    exFreight: 0,
    shortHaul: 0.0,
    thirdParty: 1.5,
    storage: 0.14,
  },
  {
    harnessId: '6608442966',
    name: '缁勫悎寮忓厖鐢垫彃搴х嚎鏉熸€绘垚',
    ratio: 0.525,
    configType: 'S' as const,
    functionalSlot: '鍏呯數鎻掑骇绾挎潫',
    frontHours: 0.662618457679739,
    backHours: 0.388884354411765,
    innerPack: 4.094525,
    outerPack: 0.875,
    freight: 0,
    exFreight: 0,
    shortHaul: 0.833333333333333,
    thirdParty: 3.2,
    storage: 0.875,
  },
  {
    harnessId: '6608442965',
    name: '缁勫悎寮忓厖鐢垫彃搴х嚎鏉熸€绘垚',
    ratio: 0.15,
    configType: 'S' as const,
    functionalSlot: '鍏呯數鎻掑骇绾挎潫',
    frontHours: 0.662618457679739,
    backHours: 0.387328798856209,
    innerPack: 4.094525,
    outerPack: 0.875,
    freight: 0,
    exFreight: 0,
    shortHaul: 0.833333333333333,
    thirdParty: 3.2,
    storage: 0.875,
  },
  {
    harnessId: '6608507680',
    name: '缁勫悎寮忓厖鐢垫彃搴х嚎鏉熸€绘垚',
    ratio: 0.07,
    configType: 'S' as const,
    functionalSlot: '鍏呯數鎻掑骇绾挎潫',
    frontHours: 0.682147315522876,
    backHours: 0.391284354411765,
    innerPack: 4.094525,
    outerPack: 0.875,
    freight: 0,
    exFreight: 0,
    shortHaul: 0.833333333333333,
    thirdParty: 3.2,
    storage: 0.875,
  },
  {
    harnessId: '6608544875',
    name: '鍓嶉┍鐩存祦姣嶇嚎鎬绘垚',
    ratio: 0,
    configType: 'S' as const,
    functionalSlot: '鍓嶉┍鐩存祦姣嶇嚎',
    frontHours: 0.254106038071895,
    backHours: 0.147942401633987,
    innerPack: 1.94245,
    outerPack: 0.35,
    freight: 0,
    exFreight: 0,
    shortHaul: 0.333333333333333,
    thirdParty: 1.5,
    storage: 0.35,
  },
];

/**
 * Seed E281 project using data from:
 *   BOM: E281椤圭洰 鎶ヤ环BOM V01-11.3.xlsx
 *   鎶ヤ环: 鍚夊埄E281楂樺帇璐㈠姟鍙鎬у垎鏋?1125-瀹㈡埛鐩爣浠?- V001.xlsx
 */
export const E281_CONFIG_SKUS: ConfigSku[] = [
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
    skuId: 'cm015',
    cmCode: 'CM015',
    skuName: 'Tansuo',
    mixRatio: 0.4,
    drivetrain: 'rwd',
    ptcAvailable: true,
    ptcOptionalRatio: 0.3,
  },
  {
    skuId: 'cm020',
    cmCode: 'CM020',
    skuName: 'Yuanhang',
    mixRatio: 0.35,
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
    note: 'Audit confirmed no optional PTC slice for CM030.',
  },
];

export const E281_HARNESS_CONFIG_MAPPINGS: HarnessConfigMapping[] = [
  { harnessId: '6608442962', skuId: 'cm010', sliceType: 'standard', installationRatio: 1 },
  { harnessId: '6608442963', skuId: 'cm010', sliceType: 'optional', installationRatio: 1 },
  { harnessId: '6608442964', skuId: 'cm010', sliceType: 'standard', installationRatio: 1 },
  { harnessId: '6608507680', skuId: 'cm010', sliceType: 'standard', installationRatio: 1 },
  { harnessId: '6608491523', skuId: 'cm015', sliceType: 'standard', installationRatio: 1 },
  { harnessId: '6608442964', skuId: 'cm015', sliceType: 'standard', installationRatio: 1 },
  { harnessId: '6608442966', skuId: 'cm015', sliceType: 'standard', installationRatio: 1 },
  { harnessId: '6608516992', skuId: 'cm015', sliceType: 'optional', installationRatio: 1 },
  { harnessId: '6608491523', skuId: 'cm020', sliceType: 'standard', installationRatio: 1 },
  { harnessId: '6608442964', skuId: 'cm020', sliceType: 'standard', installationRatio: 1 },
  { harnessId: '6608442966', skuId: 'cm020', sliceType: 'standard', installationRatio: 1 },
  { harnessId: '6608516992', skuId: 'cm020', sliceType: 'optional', installationRatio: 1 },
  { harnessId: '6608491524', skuId: 'cm030', sliceType: 'standard', installationRatio: 1 },
  { harnessId: '6608519100', skuId: 'cm030', sliceType: 'standard', installationRatio: 1 },
  { harnessId: '6608442965', skuId: 'cm030', sliceType: 'standard', installationRatio: 1 },
];

export const E281_VEHICLE_CONFIGS: VehicleConfig[] = buildVehicleConfigsFromSkus(
  E281_CONFIG_SKUS,
  E281_HARNESS_CONFIG_MAPPINGS,
);

export interface ImportE281BaselineOptions {
  projectId: string;
  scenarioId: string;
  overwriteProjectMeta?: boolean;
}

export interface ImportE281BaselineResult {
  harnessCount: number;
  onetimeCostCount: number;
  configCount: number;
}

export interface E281BaselineImportPayload {
  overwriteProjectMeta: boolean;
  project: {
    meta: Pick<ProjectRecord['meta'], 'projectCode' | 'projectName' | 'customer' | 'platform' | 'lifecycleYears' | 'status'>;
    config: ProjectConfig;
  };
  scenario: {
    lifecycleYears: number;
    config: ProjectConfig;
    note: string;
    vehicleConfigMeta: NonNullable<ScenarioRecord['vehicleConfigMeta']>;
    configSkus: ConfigSku[];
    harnessConfigMappings: HarnessConfigMapping[];
    vehicleConfigs: VehicleConfig[];
  };
  harnesses: Array<{
    harnessId: string;
    harnessName: string;
    input: HarnessRecord['input'];
    result?: HarnessRecord['result'];
    eopYear: number | null;
  }>;
  allocationRows: Array<{
    harnessId: string;
    harnessName: string;
    vehicleRatio: number;
    toolingCost: number;
    testingCost: number;
    rndCost: number;
    allocBase: number;
    paymentMode: 'amortized' | 'lumpsum' | 'mixed';
    cumProduced: number;
  }>;
  trackingItems: Array<{
    trackingType: 'agreed_price' | 'progress_price' | 'allocation_recovery' | 'residual' | 'exception';
    title: string;
    sourceRef?: string;
    currentStatus?: 'pending' | 'in_progress' | 'to_confirm' | 'completed' | 'closed';
    severity?: 'low' | 'medium' | 'high' | 'critical';
    owner?: string;
    plannedAction?: string;
    actualResult?: string;
    closeReason?: string;
    warningRef?: string;
  }>;
}

function createE281ProjectConfig(): ProjectConfig {
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
    rebate: {
      totalAmount: 10000000,
      label: 'QS杩旂偣',
      yearDistribution: [10000000, 0, 0, 0, 0, 0],
    },
    customerQuoteSnapshots: E281_CUSTOMER_QUOTE_SNAPSHOTS,
    factories: [
      {
        factoryId: 'KS',
        factoryName: '鏄嗗北宸ュ巶',
        costRates: {
          laborRate: 35,
          mfgRate: 52.2753446503895,
          wasteRate: 0.01,
          mgmtRate: 0.06,
          profitRate: 0.056627,
        },
        efficiencyFactor: 1,
        isBase: true,
        remark: 'From operating labor-hour quotation baseline.',
      },
    ],
  };
}

function createE281ProjectRecord(projectId: string, now: string): ProjectRecord {
  return {
    id: projectId,
    meta: {
      projectCode: 'E281',
      projectName: '鍚夊埄E281楂樺帇绾挎潫',
      customer: '鍚夊埄姹借溅',
      platform: 'E281',
      lifecycleYears: 6,
      createdAt: now,
      updatedAt: now,
      status: 'quoted',
    },
    config: createE281ProjectConfig(),
  };
}

function createE281ScenarioRecord(projectId: string, scenarioId: string, now: string): ScenarioRecord {
  return {
    id: scenarioId,
    projectId,
    scenarioCode: 'SCN-001',
    scenarioName: 'Final quote baseline',
    scenarioType: 'final_quote',
    parentScenarioId: null,
    isBaseline: true,
    lifecycleYears: 6,
    config: createE281ProjectConfig(),
    note: 'E281 鍒濆鎶ヤ环鍩哄噯',
    vehicleConfigMeta: {
      publishState: 'sales_published',
      engineerPublishedAt: now,
      salesPublishedAt: now,
    },
    configSkus: E281_CONFIG_SKUS,
    harnessConfigMappings: E281_HARNESS_CONFIG_MAPPINGS,
    vehicleConfigs: E281_VEHICLE_CONFIGS,
    createdAt: now,
    updatedAt: now,
  };
}

function createE281HarnessRecords(projectId: string, scenarioId: string, now: string): HarnessRecord[] {
  return E281_HARNESS_SEED_DATA.map((seed) => ({
    id: `${scenarioId}-${seed.harnessId}`,
    projectId,
    scenarioId,
    harnessId: seed.harnessId,
    harnessName: seed.name,
    eopYear: null,
    updatedAt: now,
    input: {
      harnessId: seed.harnessId,
      harnessName: seed.name,
      vehicleRatio: seed.ratio,
      configType: seed.configType,
      functionalSlot: seed.functionalSlot,
      bom: E281_BOM_DATA[seed.harnessId] || [],
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
    } as any,
    result: undefined,
  }));
}

function createE281OnetimeCosts(projectId: string, scenarioId: string, now: string): OnetimeCostRecord[] {
  return E281_HARNESS_SEED_DATA.map((seed) => ({
    id: `${scenarioId}::${seed.harnessId}`,
    projectId,
    scenarioId,
    harnessId: seed.harnessId,
    harnessName: seed.name,
    vehicleRatio: seed.ratio,
    input: {
      harnessId: seed.harnessId,
      harnessName: seed.name,
      vehicleRatio: seed.ratio,
      ...E281_FINAL_QUOTE_ONETIME_COSTS[seed.harnessId as keyof typeof E281_FINAL_QUOTE_ONETIME_COSTS],
      paymentMode: 'amortized' as const,
    },
    updatedAt: now,
  }));
}

function createE281TrackingItems(projectId: string, scenarioId: string, now: string): TrackingItemRecord[] {
  return [
    {
      id: `${scenarioId}-track-001`,
      projectId,
      scenarioId,
      category: 'anomaly',
      source: 'manual',
      severity: 'warning',
      title: 'BOM gap: connector 1-2509498-1 missing from quote costing',
      description: 'Part 1-2509498-1 exists in development BOM for harness 6608516992 but is missing from the quote-costing KSK BOM.',
      harnessId: '6608516992',
      harnessName: '鐢靛姩鍘嬬缉鏈虹嚎鏉熸€绘垚',
      partNo: '1-2509498-1',
      partName: '杩炴帴鍣ㄦ€绘垚',
      costImpact: 17,
      status: 'open',
      priority: 'high',
      createdAt: now,
      updatedAt: now,
    },
  ];
}

export function buildE281BaselineImportPayload(
  overwriteProjectMeta = true,
): E281BaselineImportPayload {
  const now = new Date().toISOString();
  const project = createE281ProjectRecord('template-project', now);
  const scenario = createE281ScenarioRecord('template-project', 'template-scenario', now);
  const harnessRecords = createE281HarnessRecords('template-project', 'template-scenario', now);
  const onetimeCosts = createE281OnetimeCosts('template-project', 'template-scenario', now);

  return {
    overwriteProjectMeta,
    project: {
      meta: {
        projectCode: project.meta.projectCode,
        projectName: project.meta.projectName,
        customer: project.meta.customer,
        platform: project.meta.platform,
        lifecycleYears: project.meta.lifecycleYears,
        status: project.meta.status,
      },
      config: project.config ?? createE281ProjectConfig(),
    },
    scenario: {
      lifecycleYears: scenario.lifecycleYears,
      config: scenario.config,
      note: scenario.note,
      vehicleConfigMeta: scenario.vehicleConfigMeta ?? { publishState: 'draft' },
      configSkus: scenario.configSkus ?? [],
      harnessConfigMappings: scenario.harnessConfigMappings ?? [],
      vehicleConfigs: scenario.vehicleConfigs ?? [],
    },
    harnesses: harnessRecords.map((record) => ({
      harnessId: record.harnessId,
      harnessName: record.harnessName,
      input: record.input,
      result: record.result,
      eopYear: record.eopYear,
    })),
    allocationRows: onetimeCosts.map((record) => ({
      harnessId: record.harnessId,
      harnessName: record.harnessName,
      vehicleRatio: record.vehicleRatio,
      toolingCost: Number(record.input.toolingCost || 0),
      testingCost: Number(record.input.testingCost || 0),
      rndCost: Number(record.input.rndCost || 0),
      allocBase: Math.max(1, Number(record.input.allocBase || 1)),
      paymentMode: record.input.paymentMode ?? 'amortized',
      cumProduced: 0,
    })),
    trackingItems: [
      {
        trackingType: 'exception',
        title: 'BOM gap: connector 1-2509498-1 missing from quote costing',
        sourceRef: 'baseline:e281:6608516992',
        currentStatus: 'pending',
        severity: 'high',
        plannedAction: 'Verify missing connector 1-2509498-1 between development BOM and quote-costing KSK BOM.',
        actualResult: 'Part 1-2509498-1 exists in development BOM for harness 6608516992 but is missing from the quote-costing KSK BOM.',
        warningRef: 'e281-bom-gap-6608516992',
      },
    ],
  };
}

export async function importE281BaselineIntoScenario({
  projectId,
  scenarioId,
  overwriteProjectMeta = true,
}: ImportE281BaselineOptions): Promise<ImportE281BaselineResult> {
  const [project, scenario] = await Promise.all([
    db.projects.get(projectId),
    db.scenarios.get(scenarioId),
  ]);

  if (!project) {
    throw new Error(`project ${projectId} not found`);
  }
  if (!scenario) {
    throw new Error(`scenario ${scenarioId} not found`);
  }

  const now = new Date().toISOString();
  const seededProject = createE281ProjectRecord(projectId, now);
  const seededScenario = createE281ScenarioRecord(projectId, scenarioId, now);
  const harnessRecords = createE281HarnessRecords(projectId, scenarioId, now);
  const onetimeCosts = createE281OnetimeCosts(projectId, scenarioId, now);
  const trackingItems = createE281TrackingItems(projectId, scenarioId, now);

  await db.transaction(
    'rw',
    [
      db.projects,
      db.scenarios,
      db.harnesses,
      db.onetimeCosts,
      db.allocTrackers,
      db.trackingItems,
      db.changeEvents,
      db.changeOrders,
    ],
    async () => {
      await db.projects.put({
        ...project,
        meta: overwriteProjectMeta
          ? {
              ...project.meta,
              ...seededProject.meta,
              createdAt: project.meta.createdAt || seededProject.meta.createdAt,
              updatedAt: now,
            }
          : {
              ...project.meta,
              lifecycleYears: seededProject.meta.lifecycleYears,
              updatedAt: now,
            },
        config: seededProject.config,
      });

      await db.scenarios.put({
        ...scenario,
        lifecycleYears: seededScenario.lifecycleYears,
        config: seededScenario.config,
        note: seededScenario.note,
        vehicleConfigMeta: seededScenario.vehicleConfigMeta,
        configSkus: seededScenario.configSkus,
        harnessConfigMappings: seededScenario.harnessConfigMappings,
        vehicleConfigs: seededScenario.vehicleConfigs,
        updatedAt: now,
      });

      await db.harnesses.where('scenarioId').equals(scenarioId).delete();
      await db.onetimeCosts.where('scenarioId').equals(scenarioId).delete();
      await db.allocTrackers.where('scenarioId').equals(scenarioId).delete();
      await db.changeEvents.where('scenarioId').equals(scenarioId).delete();
      await db.changeOrders.where('scenarioId').equals(scenarioId).delete();

      const existingTrackingIds = (await db.trackingItems.toArray())
        .filter((item) => item.projectId === projectId && item.scenarioId === scenarioId)
        .map((item) => item.id);
      if (existingTrackingIds.length > 0) {
        await db.trackingItems.bulkDelete(existingTrackingIds);
      }

      await db.harnesses.bulkPut(harnessRecords);
      await db.onetimeCosts.bulkPut(onetimeCosts);
      await db.trackingItems.bulkPut(trackingItems);
    },
  );

  return {
    harnessCount: harnessRecords.length,
    onetimeCostCount: onetimeCosts.length,
    configCount: seededScenario.vehicleConfigs?.length ?? 0,
  };
}

export async function seedE281Project(): Promise<string> {
  const projectId = 'e281-quote';
  const scenarioId = 'e281-scn-001';
  const now = new Date().toISOString();

  const project = createE281ProjectRecord(projectId, now);
  const scenario = createE281ScenarioRecord(projectId, scenarioId, now);
  const harnessRecords = createE281HarnessRecords(projectId, scenarioId, now);
  const onetimeCosts = createE281OnetimeCosts(projectId, scenarioId, now);
  const trackingItems = createE281TrackingItems(projectId, scenarioId, now);

  await db.transaction(
    'rw',
    [db.projects, db.scenarios, db.harnesses, db.onetimeCosts, db.trackingItems],
    async () => {
      await db.projects.put(project);
      await db.scenarios.put(scenario);
      await db.harnesses.bulkPut(harnessRecords);
      await db.onetimeCosts.bulkPut(onetimeCosts);
      await db.trackingItems.bulkPut(trackingItems);
    },
  );

  return projectId;
}
