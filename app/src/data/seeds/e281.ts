import { db, type ProjectRecord, type HarnessRecord, type ScenarioRecord } from '../db';
import type { VehicleConfig } from '@/types/harness';
import type { CustomerQuoteSnapshot } from '@/types/project';
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
    name: '直流母线总成',
    ratio: 0.525,
    configType: 'S' as const,
    functionalSlot: '直流母线',
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
    name: '直流母线总成',
    ratio: 0.105,
    configType: 'S' as const,
    functionalSlot: '直流母线',
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
    name: '直流母线总成',
    ratio: 0.07,
    configType: 'S' as const,
    functionalSlot: '直流母线',
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
    name: '电动压缩机线束总成',
    ratio: 0.595,
    configType: 'S' as const,
    functionalSlot: '电动压缩机线束',
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
    name: '电动压缩机线束总成',
    ratio: 0.03,
    configType: 'O' as const,
    functionalSlot: '电动压缩机线束',
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
    name: '电动压缩机线束总成',
    ratio: 0.225,
    configType: 'O' as const,
    functionalSlot: '电动压缩机线束',
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
    name: '电动压缩机线束总成',
    ratio: 0.105,
    configType: 'S' as const,
    functionalSlot: '电动压缩机线束',
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
    name: '组合式充电插座线束总成',
    ratio: 0.525,
    configType: 'S' as const,
    functionalSlot: '充电插座线束',
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
    name: '组合式充电插座线束总成',
    ratio: 0.105,
    configType: 'S' as const,
    functionalSlot: '充电插座线束',
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
    name: '组合式充电插座线束总成',
    ratio: 0.07,
    configType: 'S' as const,
    functionalSlot: '充电插座线束',
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
    name: '前驱直流母线总成',
    ratio: 0.105,
    configType: 'S' as const,
    functionalSlot: '前驱直流母线',
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
 *   BOM: E281项目 报价BOM V01-11.3.xlsx
 *   报价: 吉利E281高压财务可行性分析-1125-客户目标价 - V001.xlsx
 */
export const E281_VEHICLE_CONFIGS: VehicleConfig[] = [
  {
    configId: 'cfg-520-qihang',
    configName: '520启航版',
    salesRatio: 0.525,
    harnessIds: ['6608491523', '6608442964', '6608442966'],
  },
  {
    configId: 'cfg-520-pro',
    configName: '520Pro',
    salesRatio: 0.105,
    harnessIds: ['6608491524', '6608519100', '6608442965'],
  },
  {
    configId: 'cfg-524-no-ptc',
    configName: '52.4(无PTC)',
    salesRatio: 0.225,
    harnessIds: ['6608442962', '6608516992', '6608507680'],
  },
  {
    configId: 'cfg-524-ptc',
    configName: '52.4(带PTC)',
    salesRatio: 0.04,
    harnessIds: ['6608442962', '6608442963', '6608507680'],
  },
  {
    configId: 'cfg-front-drive',
    configName: '前驱版',
    salesRatio: 0.105,
    harnessIds: ['6608544875', '6608519100', '6608442965'],
  },
];

export async function seedE281Project(): Promise<string> {
  const projectId = 'e281-quote';
  const scenarioId = 'e281-scn-001';
  const now = new Date().toISOString();

  const projectConfig = {
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
      label: 'QS返点',
      yearDistribution: [10000000, 0, 0, 0, 0, 0],
    },
    customerQuoteSnapshots: E281_CUSTOMER_QUOTE_SNAPSHOTS,
    factories: [
      {
        factoryId: 'KS',
        factoryName: '昆山工厂',
        costRates: {
          laborRate: 35,
          mfgRate: 52.2753446503895,
          wasteRate: 0.01,
          mgmtRate: 0.06,
          profitRate: 0.056627,
        },
        efficiencyFactor: 1,
        isBase: true,
        remark: '来自《运营工时费报价基准》报价版运营成本工时费（不包含折旧）基准。',
      },
    ],
  };

  const project: ProjectRecord = {
    id: projectId,
    meta: {
      projectCode: 'E281',
      projectName: '吉利E281高压线束',
      customer: '吉利汽车',
      platform: 'E281',
      lifecycleYears: 6,
      createdAt: now,
      updatedAt: now,
      status: 'quoted',
    },
    config: projectConfig,
  };

  await db.projects.put(project);

  // 创建基准场景
  const scenario: ScenarioRecord = {
    id: scenarioId,
    projectId,
    scenarioCode: 'SCN-001',
    scenarioName: '最后一轮报价',
    scenarioType: 'final_quote',
    parentScenarioId: null,
    isBaseline: true,
    lifecycleYears: 6,
    config: projectConfig,
    note: 'E281 初始报价基准',
    vehicleConfigMeta: {
      publishState: 'sales_published',
      engineerPublishedAt: now,
      salesPublishedAt: now,
    },
    vehicleConfigs: E281_VEHICLE_CONFIGS,
    createdAt: now,
    updatedAt: now,
  };

  await db.scenarios.put(scenario);

  const harnessRecords: HarnessRecord[] = E281_HARNESS_SEED_DATA.map((seed) => ({
    id: `e281-${seed.harnessId}`,
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

  await db.harnesses.bulkPut(harnessRecords);

  await db.onetimeCosts.bulkPut(
    E281_HARNESS_SEED_DATA.map((seed) => ({
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
    })),
  );

  // Seed 已知 BOM 差异跟踪项
  await db.trackingItems.put({
    id: 'e281-track-001',
    projectId,
    category: 'anomaly',
    title: 'BOM差异：1-2509498-1 连接器总成未纳入报价核算',
    description: '零件 1-2509498-1（连接器总成，¥17.00/SET×1）存在于开发BOM（6608516992）中，但在报价核算 KSK BOM 明细中缺失。开发与财务 BOM 衔接问题。',
    harnessId: '6608516992',
    harnessName: '电动压缩机线束总成',
    partNo: '1-2509498-1',
    partName: '连接器总成',
    costImpact: 17.00,
    status: 'open',
    priority: 'high',
    createdAt: now,
    updatedAt: now,
  });

  return projectId;
}
