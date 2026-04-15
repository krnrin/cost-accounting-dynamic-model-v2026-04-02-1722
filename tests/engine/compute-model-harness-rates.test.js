const engine = require('../../engine/index.js')
const computeModelApi = engine.G281ComputeModel || globalThis.G281ComputeModel || globalThis.G281Engine

describe('computeModel harness rate priority', () => {
  function buildRuntime() {
    return {
      years: [2026],
      volumes: [100],
      asp: [10],
      baseRevenuePerSet: 10,
      baseCostPerSet: 8,
      baseMaterial: 5,
      baseDirectHours: 1,
      baseDirectRate: 35,
      baseMfgHours: 1,
      baseMfgRate: 46.69,
      baseLaborPerSet: 35,
      baseMfgPerSet: 46.69,
      baseEquipmentPerSet: 0,
      basePackagingPerSet: 0,
      baseRndPerSet: 0,
      copperPrice: 68400,
      aluminumPrice: 18200,
      baselineMix: [100],
      priceMixIndexes: [1],
      costMixIndexes: [1],
      configNames: ['base'],
      connectorPortfolio: { baseCostPerSet: 0, items: [] },
      versions: {
        bom: { freeze: { factor: 1 }, light: { factor: 1 } },
        metal: { quote: { copperPrice: 68400, aluminumPrice: 18200 }, fixed: { copperPrice: 68400, aluminumPrice: 18200 } },
        connector: { quote: { factor: 1 }, fixed: { factor: 1 } },
        sales: { quote: { factor: 1 }, fixed: { factor: 1 } },
        labor: { base: { factor: 1 }, optimize: { factor: 1 } },
        equipment: { base: { factor: 1 }, shared: { factor: 1 } },
        packaging: { base: { factor: 1 }, optimize: { factor: 1 } },
        mix: { quote: { shares: [100] }, fixed: { shares: [100] } },
        annualDrop: { quote: { annualRate: 0 } },
        oneTimeCustomer: { quote: { amountTotal: 0, entries: [] } },
        rebate: { quote: { amountTotal: 0, amountPerSet: 0 } },
      },
      projectConfig: {
        costRates: {
          customer: {
            laborRate: 35,
            mfgRate: 46.69,
            wasteRate: 0.01,
            mgmtRate: 0.06,
            profitRate: 0.056627,
          },
        },
      },
      harnessSeedData: [
        {
          harnessId: 'H1',
          harnessName: 'Test',
          vehicleRatio: 1,
          processHours: 1,
          materialCost: 100,
          packaging: {},
        },
      ],
      laborValidation: {
        versionSnapshots: {
          quote: {
            directRate: 99,
            manufacturingRate: 88,
          },
        },
      },
    }
  }

  it('prefers laborValidation snapshot rates over projectConfig customer rates', () => {
    const runtime = buildRuntime()
    const result = computeModelApi.computeModel(runtime, {
      copperPrice: 68400,
      aluminumPrice: 18200,
      directHours: 1,
      directRate: 1,
      manufacturingHours: 1,
      manufacturingRate: 1,
      packInner: 0,
      packFreight: 0,
      packWarehouse: 0,
      packOther: 0,
      volumes: [100],
      asp: [10],
    }, {}, undefined)

    expect(result.harnessDetail.params.laborRate).toBe(99)
    expect(result.harnessDetail.params.mfgRate).toBe(88)
  })

  it('falls back to projectConfig customer rates when laborValidation is missing', () => {
    const runtime = buildRuntime()
    delete runtime.laborValidation
    const result = computeModelApi.computeModel(runtime, {
      copperPrice: 68400,
      aluminumPrice: 18200,
      directHours: 1,
      directRate: 1,
      manufacturingHours: 1,
      manufacturingRate: 1,
      packInner: 0,
      packFreight: 0,
      packWarehouse: 0,
      packOther: 0,
      volumes: [100],
      asp: [10],
    }, {}, undefined)

    expect(result.harnessDetail.params.laborRate).toBe(35)
    expect(result.harnessDetail.params.mfgRate).toBe(46.69)
  })

  it('falls back to internal factory rates when customer rates are missing', () => {
    const runtime = buildRuntime()
    delete runtime.laborValidation
    runtime.projectConfig = {
      costRates: {
        wasteRate: 0.02,
      },
      internalRates: {
        laborRate: 28.6,
        factoryRate: 52.3,
        materialWasteRate: 0.005,
      },
    }
    const result = computeModelApi.computeModel(runtime, {
      copperPrice: 68400,
      aluminumPrice: 18200,
      directHours: 1,
      directRate: 1,
      manufacturingHours: 1,
      manufacturingRate: 1,
      packInner: 0,
      packFreight: 0,
      packWarehouse: 0,
      packOther: 0,
      volumes: [100],
      asp: [10],
    }, {}, undefined)

    expect(result.harnessDetail.params.laborRate).toBe(28.6)
    expect(result.harnessDetail.params.mfgRate).toBe(52.3)
    expect(result.harnessDetail.params.wasteRate).toBe(0.02)
  })

  it('falls back to base factory rates before projectConfig customer rates', () => {
    const runtime = buildRuntime()
    delete runtime.laborValidation
    runtime.projectConfig.factories = [
      {
        factoryId: 'KS',
        factoryName: '昆山工厂',
        costRates: {
          laborRate: 41,
          mfgRate: 52.275345,
          wasteRate: 0.012,
          mgmtRate: 0.05,
          profitRate: 0.04,
        },
        efficiencyFactor: 1,
        isBase: true,
        remark: '来自运营工时费报价基准报价版运营成本工时费（不包含折旧）基准',
      },
      {
        factoryId: 'WH',
        factoryName: '武汉工厂',
        costRates: {
          laborRate: 30,
          mfgRate: 40,
          wasteRate: 0.01,
          mgmtRate: 0.06,
          profitRate: 0.05,
        },
        efficiencyFactor: 1,
      },
    ]
    const result = computeModelApi.computeModel(runtime, {
      copperPrice: 68400,
      aluminumPrice: 18200,
      directHours: 1,
      directRate: 1,
      manufacturingHours: 1,
      manufacturingRate: 1,
      packInner: 0,
      packFreight: 0,
      packWarehouse: 0,
      packOther: 0,
      volumes: [100],
      asp: [10],
    }, {}, undefined)

    expect(result.harnessDetail.params.factoryId).toBe('KS')
    expect(result.harnessDetail.params.factoryName).toBe('昆山工厂')
    expect(result.harnessDetail.params.laborRate).toBe(41)
    expect(result.harnessDetail.params.mfgRate).toBe(52.275345)
    expect(result.harnessDetail.params.wasteRate).toBe(0.012)
    expect(result.harnessDetail.params.mgmtRate).toBe(0.05)
    expect(result.harnessDetail.params.profitRate).toBe(0.04)
  })

  it('uses base factory rates from seeded quote baseline when no explicit customer snapshot is present', () => {
    const runtime = buildRuntime()
    delete runtime.laborValidation
    runtime.projectConfig = {
      costRates: {
        laborRate: 35,
        mfgRate: 46.69,
        wasteRate: 0.01,
        mgmtRate: 0.06,
        profitRate: 0.056627,
      },
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
          isBase: true,
          remark: '来自《运营工时费报价基准》报价版运营成本工时费（不包含折旧）基准。',
        },
      ],
    }
    const result = computeModelApi.computeModel(runtime, {
      copperPrice: 68400,
      aluminumPrice: 18200,
      directHours: 1,
      directRate: 1,
      manufacturingHours: 1,
      manufacturingRate: 1,
      packInner: 0,
      packFreight: 0,
      packWarehouse: 0,
      packOther: 0,
      volumes: [100],
      asp: [10],
    }, {}, undefined)

    expect(result.harnessDetail.params.factoryId).toBe('KS')
    expect(result.harnessDetail.params.laborRate).toBe(35)
    expect(result.harnessDetail.params.mfgRate).toBe(52.2753446503895)
    expect(result.harnessDetail.params.wasteRate).toBe(0.01)
    expect(result.harnessDetail.params.mgmtRate).toBe(0.06)
    expect(result.harnessDetail.params.profitRate).toBe(0.056627)
  })
'}})
