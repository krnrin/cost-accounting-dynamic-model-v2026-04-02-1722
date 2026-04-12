const ME = require('../../engine/metal_escalation.js')

describe('applyThreshold', () => {
  it('no threshold — full delta', () => {
    expect(ME.applyThreshold(68400, 70000, 0, 1.0)).toBe(1600)
  })

  it('within threshold — zero', () => {
    // threshold 5% of 68400 = 3420, delta = 1000 < 3420
    expect(ME.applyThreshold(68400, 69400, 0.05, 1.0)).toBe(0)
  })

  it('exceeds threshold — only excess', () => {
    // threshold 5% of 68400 = 3420, delta = 5000, excess = 5000 - 3420 = 1580
    expect(ME.applyThreshold(68400, 73400, 0.05, 1.0)).toBeCloseTo(1580)
  })

  it('negative delta exceeds threshold', () => {
    // delta = -5000, threshold = 3420, excess = 1580, sign = -1
    expect(ME.applyThreshold(68400, 63400, 0.05, 1.0)).toBeCloseTo(-1580)
  })

  it('partial escalation ratio', () => {
    // delta = 2000, no threshold, ratio 0.5 → 1000
    expect(ME.applyThreshold(68400, 70400, 0, 0.5)).toBe(1000)
  })
})

describe('computeMetalDelta', () => {
  const harness = {
    harnessId: 'H001',
    harnessName: '测试',
    vehicleRatio: 1.0,
    copperWeight: 2.0,   // kg
    aluminumWeight: 0.5,  // kg
    deliveredPrice: 500,
    _params: { wasteRate: 0.01, mgmtRate: 0.06, profitRate: 0.056627 },
  }

  it('computes delta with price increase', () => {
    const base = { copper: 68400, aluminum: 18200 }
    const next = { copper: 70400, aluminum: 18200 }
    const d = ME.computeMetalDelta(harness, base, next, null)

    // cuDelta = 2000 (no threshold), alDelta = 0
    // deltaCuCost = 2.0 * 2000 / 1000 = 4.0
    expect(d.deltaCopperCost).toBeCloseTo(4.0)
    expect(d.deltaAluminumCost).toBeCloseTo(0)
    expect(d.deltaMaterialCost).toBeCloseTo(4.0)
    // waste = 4.0 * 0.01 = 0.04
    expect(d.deltaWasteCost).toBeCloseTo(0.04)
    // mgmt = 4.0 * 0.06 = 0.24
    expect(d.deltaMgmtFee).toBeCloseTo(0.24)
    // delivered delta > 0
    expect(d.deltaDeliveredPrice).toBeGreaterThan(0)
    expect(d.newDeliveredPrice).toBeCloseTo(500 + d.deltaDeliveredPrice)
  })

  it('zero delta when prices unchanged', () => {
    const base = { copper: 68400, aluminum: 18200 }
    const d = ME.computeMetalDelta(harness, base, base, null)
    expect(d.deltaDeliveredPrice).toBe(0)
  })
})

describe('computeProjectMetalEscalation', () => {
  const harness = {
    harnessId: 'H001',
    vehicleRatio: 1.0,
    copperWeight: 1.0,
    aluminumWeight: 0,
    deliveredPrice: 300,
    _params: { wasteRate: 0.01, mgmtRate: 0.06, profitRate: 0.056627 },
  }

  it('computes project-level escalation', () => {
    const base = { copper: 68400, aluminum: 18200 }
    const next = { copper: 78400, aluminum: 18200 }
    const result = ME.computeProjectMetalEscalation([harness], base, next, null)
    expect(result.summary.totalWeightedDelta).not.toBe(0)
    expect(result.summary.affectedCount).toBe(1)
    expect(result.harnesses).toHaveLength(1)
  })

  it('computes annual impact when volumes provided', () => {
    const base = { copper: 68400, aluminum: 18200 }
    const next = { copper: 78400, aluminum: 18200 }
    const result = ME.computeProjectMetalEscalation(
      [harness], base, next, null,
      { annualVolumes: [10000, 20000, 30000] }
    )
    expect(result.annualImpact).not.toBeNull()
    expect(result.annualImpact.years).toHaveLength(3)
    expect(result.annualImpact.totalLifecycleImpact).not.toBe(0)
  })
})

describe('buildMetalSensitivityMatrix', () => {
  const harness = {
    harnessId: 'H001',
    vehicleRatio: 1.0,
    copperWeight: 1.0,
    aluminumWeight: 0,
    deliveredPrice: 300,
    _params: { wasteRate: 0.01, mgmtRate: 0.06, profitRate: 0.056627 },
  }

  it('builds matrix with copper range', () => {
    const base = { copper: 68400, aluminum: 18200 }
    const m = ME.buildMetalSensitivityMatrix([harness], base, [60000, 68400, 80000])
    expect(m.matrix).toHaveLength(3)
    // base price row should have ~0 delta
    expect(m.matrix[1][0].deltaPerVehicle).toBeCloseTo(0, 1)
    // lower price → negative delta
    expect(m.matrix[0][0].deltaPerVehicle).toBeLessThan(0)
    // higher price → positive delta
    expect(m.matrix[2][0].deltaPerVehicle).toBeGreaterThan(0)
  })
})

describe('DEFAULT_CONTRACT', () => {
  it('has expected defaults', () => {
    expect(ME.DEFAULT_CONTRACT.baseCopperPrice).toBe(68400)
    expect(ME.DEFAULT_CONTRACT.baseAluminumPrice).toBe(18200)
    expect(ME.DEFAULT_CONTRACT.escalationRatio).toBe(1.0)
  })
})
