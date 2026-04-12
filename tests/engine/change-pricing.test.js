const CP = require('../../engine/change_pricing.js')

describe('buildDelta', () => {
  it('computes difference between two cost objects', () => {
    const before = { materialCost: 100, deliveredPrice: 200, processHours: 2 }
    const after = { materialCost: 120, deliveredPrice: 230, processHours: 2.5 }
    const d = CP.buildDelta(before, after)
    expect(d.materialCost).toBe(20)
    expect(d.deliveredPrice).toBe(30)
    expect(d.processHours).toBeCloseTo(0.5)
  })

  it('treats null before as zero', () => {
    const d = CP.buildDelta(null, { materialCost: 50, deliveredPrice: 100 })
    expect(d.materialCost).toBe(50)
    expect(d.deliveredPrice).toBe(100)
  })

  it('treats null after as zero', () => {
    const d = CP.buildDelta({ materialCost: 50, deliveredPrice: 100 }, null)
    expect(d.materialCost).toBe(-50)
    expect(d.deliveredPrice).toBe(-100)
  })

  it('both null → all zeros', () => {
    const d = CP.buildDelta(null, null)
    expect(d.materialCost).toBe(0)
    expect(d.deliveredPrice).toBe(0)
  })
})

describe('computeAnnualDrop', () => {
  it('year 1 has no drop', () => {
    const result = CP.computeAnnualDrop(100, 0.03, 3)
    expect(result[0].deliveredPrice).toBe(100)
    expect(result[0].dropPercent).toBe(0)
  })

  it('year 2 drops by rate', () => {
    const result = CP.computeAnnualDrop(100, 0.03, 3)
    expect(result[1].deliveredPrice).toBeCloseTo(97)
    expect(result[1].dropPercent).toBeCloseTo(3)
  })

  it('year 3 compounds', () => {
    const result = CP.computeAnnualDrop(100, 0.03, 3)
    // (1-0.03)^2 = 0.9409 → price = 94.09
    expect(result[2].deliveredPrice).toBeCloseTo(94.09)
  })

  it('zero rate means no drop', () => {
    const result = CP.computeAnnualDrop(100, 0, 3)
    expect(result[2].deliveredPrice).toBe(100)
  })

  it('defaults to at least 1 year', () => {
    const result = CP.computeAnnualDrop(100, 0.05, 0)
    expect(result.length).toBeGreaterThanOrEqual(1)
  })
})

describe('computeAnnualImpact', () => {
  it('computes cumulative impact', () => {
    const result = CP.computeAnnualImpact(10, [1000, 2000, 3000])
    expect(result.years).toHaveLength(3)
    expect(result.years[0].annualImpact).toBe(10000)
    expect(result.years[1].annualImpact).toBe(20000)
    expect(result.years[2].annualImpact).toBe(30000)
    expect(result.totalLifecycleImpact).toBe(60000)
    expect(result.totalLifecycleVolume).toBe(6000)
  })

  it('handles empty volumes', () => {
    const result = CP.computeAnnualImpact(10, [])
    expect(result.years).toHaveLength(0)
    expect(result.totalLifecycleImpact).toBe(0)
  })

  it('cumulative is running sum', () => {
    const result = CP.computeAnnualImpact(5, [100, 200])
    expect(result.years[0].cumulativeImpact).toBe(500)
    expect(result.years[1].cumulativeImpact).toBe(1500)
  })
})
