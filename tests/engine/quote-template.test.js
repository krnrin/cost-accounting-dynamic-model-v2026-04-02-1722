const QT = require('../../engine/quote_template.js')
const HC = require('../../engine/harness_costing.js')

describe('GEELY_RATES', () => {
  it('all rates are 4% except waste 1%', () => {
    expect(QT.GEELY_RATES.mgmtRate).toBe(0.04)
    expect(QT.GEELY_RATES.financeRate).toBe(0.04)
    expect(QT.GEELY_RATES.salesRate).toBe(0.04)
    expect(QT.GEELY_RATES.profitRate).toBe(0.04)
    expect(QT.GEELY_RATES.wasteRate).toBe(0.01)
  })
})

describe('mapToGeelyTemplate', () => {
  const harness = HC.computeHarnessCost({
    harnessId: 'H001',
    harnessName: '测试线束',
    vehicleRatio: 1.0,
    processHours: 2,
    bomItems: [
      { type: '导线', copperWeight: 0.5, qty: 1 },
      { type: '连接器', unitPrice: 30, qty: 2 },
    ],
    packaging: {},
  }, {})

  it('maps to geely template structure', () => {
    const t = QT.mapToGeelyTemplate(harness, {})
    expect(t.templateName).toBe('吉利高压线束报价')
    expect(t.harnessId).toBe('H001')
    expect(t.A1_rawMaterial).toBeGreaterThanOrEqual(0)
    expect(t.A2_purchasedParts).toBeGreaterThanOrEqual(0)
    expect(t.directMaterial).toBeCloseTo(t.A1_rawMaterial + t.A2_purchasedParts)
  })

  it('computes period expenses at 4% each', () => {
    const t = QT.mapToGeelyTemplate(harness, {})
    const base = t.A1_rawMaterial + t.A2_purchasedParts + t.B1_processingFee + t.B2_wasteLoss
    expect(t.C1_managementFee).toBeCloseTo(base * 0.04)
    expect(t.C2_financeFee).toBeCloseTo(base * 0.04)
    expect(t.C3_salesFee).toBeCloseTo(base * 0.04)
    expect(t.D_profit).toBeCloseTo(base * 0.04)
  })

  it('computes NRE amortization', () => {
    const t = QT.mapToGeelyTemplate(harness, {
      newTooling: 100000,
      amortizationVolume: 10000,
    })
    expect(t.E2_newTooling).toBeCloseTo(10)
    expect(t.deliveredPrice).toBeCloseTo(t.exFactoryPrice + t.amortization)
  })

  it('handles empty harness result', () => {
    const t = QT.mapToGeelyTemplate({}, {})
    expect(t.exFactoryPrice).toBe(0)
    expect(t.deliveredPrice).toBe(0)
  })
})

describe('mapToInternalTemplate', () => {
  it('passes through internal fields', () => {
    const harness = HC.computeHarnessCost({
      harnessId: 'H002',
      processHours: 1,
      materialCost: 50,
      packaging: {},
    }, {})
    const t = QT.mapToInternalTemplate(harness)
    expect(t.templateName).toBe('内部核算')
    expect(t.materialCost).toBe(harness.materialCost)
    expect(t.deliveredPrice).toBe(harness.deliveredPrice)
  })
})

describe('mapToTemplate', () => {
  it('routes to geely template', () => {
    const t = QT.mapToTemplate({}, 'geely', null, {})
    expect(t.templateName).toBe('吉利高压线束报价')
  })

  it('routes to internal by default', () => {
    const t = QT.mapToTemplate({})
    expect(t.templateName).toBe('内部核算')
  })

  it('accepts Chinese name 吉利', () => {
    const t = QT.mapToTemplate({}, '吉利', null, {})
    expect(t.templateName).toBe('吉利高压线束报价')
  })
})

describe('buildQuoteSheet', () => {
  it('builds quote sheet with meta', () => {
    const harnesses = [
      HC.computeHarnessCost({ harnessId: 'A', materialCost: 100, processHours: 1, packaging: {} }, {}),
      HC.computeHarnessCost({ harnessId: 'B', materialCost: 200, processHours: 2, packaging: {} }, {}),
    ]
    const sheet = QT.buildQuoteSheet(harnesses, 'internal', { projectName: 'G281' })
    expect(sheet.meta.projectName).toBe('G281')
    expect(sheet.harnessCount).toBe(2)
    expect(sheet.totals.materialCost).toBeCloseTo(300)
  })
})
