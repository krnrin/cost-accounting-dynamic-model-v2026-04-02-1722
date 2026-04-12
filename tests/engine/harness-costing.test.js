const HC = require('../../engine/harness_costing.js')

describe('classifyBomItem', () => {
  it('classifies wire by type', () => expect(HC.classifyBomItem({ type: '导线' })).toBe('wire'))
  it('classifies connector by type', () => expect(HC.classifyBomItem({ type: '连接器' })).toBe('connector'))
  it('classifies terminal by type', () => expect(HC.classifyBomItem({ type: '端子' })).toBe('terminal'))
  it('classifies auxiliary by type', () => expect(HC.classifyBomItem({ type: '辅料' })).toBe('auxiliary'))
  it('falls back to name keyword for wire', () => expect(HC.classifyBomItem({ name: '高压导线 3mm' })).toBe('wire'))
  it('falls back to name keyword for connector', () => expect(HC.classifyBomItem({ name: '屏蔽环 A型' })).toBe('connector'))
  it('returns other for unknown', () => expect(HC.classifyBomItem({ type: 'unknown' })).toBe('other'))
  it('case insensitive type', () => expect(HC.classifyBomItem({ type: 'Wire' })).toBe('wire'))
})

describe('computeBomLineCost', () => {
  it('computes connector cost = unitPrice × qty', () => {
    const result = HC.computeBomLineCost(
      { type: '连接器', unitPrice: 10, qty: 5 },
      null, {}
    )
    expect(result.lineCost).toBe(50)
    expect(result.type).toBe('connector')
  })

  it('computes wire cost with copperWeight (mode A)', () => {
    const result = HC.computeBomLineCost(
      { type: '导线', copperWeight: 0.5, aluminumWeight: 0, qty: 1 },
      null,
      { copper: 68400, aluminum: 18200 }
    )
    // cuCost = 0.5 * 68400 / 1000 = 34.2
    expect(result.cuCost).toBeCloseTo(34.2)
    expect(result.lineCost).toBeCloseTo(34.2)
  })

  it('defaults qty to 1', () => {
    const result = HC.computeBomLineCost(
      { type: '连接器', unitPrice: 20 },
      null, {}
    )
    expect(result.lineCost).toBe(20)
  })
})

describe('computeHarnessCost', () => {
  const config = {
    harnessId: 'H001',
    harnessName: '测试线束',
    vehicleRatio: 1.0,
    processHours: 2,
    materialCost: 100,
    packaging: { innerPack: 5, outerPack: 3, freight: 10 },
  }

  it('computes full cost chain with defaults', () => {
    const r = HC.computeHarnessCost(config, {})
    // material = 100
    expect(r.materialCost).toBe(100)
    // waste = 100 * 0.01 = 1
    expect(r.wasteCost).toBeCloseTo(1)
    // labor = 2 * 35 = 70
    expect(r.directLabor).toBeCloseTo(70)
    // mfg = 2 * 46.69 = 93.38
    expect(r.manufacturing).toBeCloseTo(93.38)
    // mgmt = (100 + 70 + 93.38) * 0.06 = 15.8028
    expect(r.mgmtFee).toBeCloseTo(15.8028, 2)
    // subtotal = 100 + 1 + 70 + 93.38 + 15.8028 = 280.1828
    // profit = 280.1828 * 0.056627 ≈ 15.867
    expect(r.profit).toBeCloseTo(280.1828 * 0.056627, 1)
    // packaging
    expect(r.packSubtotal).toBe(8)
    expect(r.freightSubtotal).toBe(10)
    // delivered = exFactory + 18
    expect(r.deliveredPrice).toBeCloseTo(r.exFactoryPrice + 18)
  })

  it('returns correct harnessId', () => {
    const r = HC.computeHarnessCost(config, {})
    expect(r.harnessId).toBe('H001')
  })

  it('weighted = delivered × ratio', () => {
    const r = HC.computeHarnessCost({ ...config, vehicleRatio: 0.5 }, {})
    expect(r.weightedDeliveredPrice).toBeCloseTo(r.deliveredPrice * 0.5)
  })
})

describe('computeProjectFromHarnesses', () => {
  it('sums weighted costs', () => {
    const h1 = HC.computeHarnessCost(
      { harnessId: 'A', vehicleRatio: 1, processHours: 1, materialCost: 50, packaging: {} }, {}
    )
    const h2 = HC.computeHarnessCost(
      { harnessId: 'B', vehicleRatio: 0.5, processHours: 2, materialCost: 100, packaging: {} }, {}
    )
    const proj = HC.computeProjectFromHarnesses([h1, h2])
    expect(proj.vehicleCost).toBeCloseTo(
      h1.deliveredPrice * 1 + h2.deliveredPrice * 0.5
    )
    expect(proj.harnessCount).toBe(2)
  })

  it('handles empty array', () => {
    const proj = HC.computeProjectFromHarnesses([])
    expect(proj.vehicleCost).toBe(0)
    expect(proj.harnessCount).toBe(0)
  })
})

describe('DEFAULTS', () => {
  it('has expected default rates', () => {
    expect(HC.DEFAULTS.laborRate).toBe(35)
    expect(HC.DEFAULTS.mfgRate).toBe(46.69)
    expect(HC.DEFAULTS.wasteRate).toBe(0.01)
    expect(HC.DEFAULTS.mgmtRate).toBe(0.06)
  })
})
