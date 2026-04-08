const PT = require('../../engine/progress_price_tracker.js')

describe('trackPartProgress', () => {
  it('achieved when batch = agreed', () => {
    const r = PT.trackPartProgress({ partNo: 'P001', agreedPrice: 20, batchPrice: 20 })
    expect(r.status).toBe('achieved')
    expect(r.gap).toBeCloseTo(0)
  })

  it('over when batch > agreed', () => {
    const r = PT.trackPartProgress({ partNo: 'P002', agreedPrice: 20, batchPrice: 22, quantity: 1000 })
    expect(r.status).toBe('over')
    expect(r.gap).toBe(2)
    expect(r.totalGap).toBe(2000)
    expect(r.gapPct).toBeCloseTo(0.1)
  })

  it('under when batch < agreed', () => {
    const r = PT.trackPartProgress({ partNo: 'P003', agreedPrice: 20, batchPrice: 18 })
    expect(r.status).toBe('under')
    expect(r.gap).toBe(-2)
  })

  it('includes quote comparison when quotePrice given', () => {
    const r = PT.trackPartProgress({
      partNo: 'P004', agreedPrice: 20, batchPrice: 22, quotePrice: 25,
    })
    expect(r.quotePrice).toBe(25)
    expect(r.quoteToAgreedGap).toBe(-5)  // 20 - 25
    expect(r.quoteToBatchGap).toBe(-3)   // 22 - 25
  })

  it('handles zero agreedPrice', () => {
    const r = PT.trackPartProgress({ agreedPrice: 0, batchPrice: 5 })
    expect(r.gapPct).toBe(Infinity)
  })
})

describe('trackBatch', () => {
  const items = [
    { partNo: 'A', agreedPrice: 10, batchPrice: 10, quantity: 100 },
    { partNo: 'B', agreedPrice: 10, batchPrice: 12, quantity: 100 },
    { partNo: 'C', agreedPrice: 10, batchPrice: 8, quantity: 100 },
  ]

  it('counts statuses correctly', () => {
    const { summary } = PT.trackBatch(items)
    expect(summary.totalParts).toBe(3)
    expect(summary.achievedCount).toBe(1)
    expect(summary.overCount).toBe(1)
    expect(summary.underCount).toBe(1)
  })

  it('computes net gap', () => {
    const { summary } = PT.trackBatch(items)
    // +200 (B over) + -200 (C under) = 0
    expect(summary.netGap).toBeCloseTo(0)
  })

  it('computes achieved rate', () => {
    const { summary } = PT.trackBatch(items)
    expect(summary.achievedRate).toBeCloseTo(1 / 3)
  })

  it('handles non-array input', () => {
    const { items: tracked, summary } = PT.trackBatch(null)
    expect(tracked).toEqual([])
    expect(summary.totalParts).toBe(0)
  })
})

describe('groupSummary', () => {
  it('groups by supplier', () => {
    const items = [
      { supplier: 'S1', status: 'over', totalGap: 100, gapPct: 0.1, gap: 1 },
      { supplier: 'S1', status: 'achieved', totalGap: 0, gapPct: 0, gap: 0 },
      { supplier: 'S2', status: 'under', totalGap: -50, gapPct: -0.05, gap: -1 },
    ]
    const groups = PT.groupSummary(items, 'supplier')
    expect(groups).toHaveLength(2)

    const s1 = groups.find(g => g.groupKey === 'S1')
    expect(s1.partCount).toBe(2)
    expect(s1.overCount).toBe(1)
    expect(s1.netGap).toBe(100)

    const s2 = groups.find(g => g.groupKey === 'S2')
    expect(s2.partCount).toBe(1)
    expect(s2.underCount).toBe(1)
  })

  it('uses (未分类) for missing key', () => {
    const items = [{ status: 'achieved', totalGap: 0, gapPct: 0, gap: 0 }]
    const groups = PT.groupSummary(items, 'supplier')
    expect(groups[0].groupKey).toBe('(未分类)')
  })

  it('handles null input', () => {
    expect(PT.groupSummary(null, 'supplier')).toEqual([])
  })
})

describe('STATUS_LABELS', () => {
  it('has all statuses', () => {
    expect(PT.STATUS_LABELS.achieved).toContain('已落实')
    expect(PT.STATUS_LABELS.over).toContain('超标')
    expect(PT.STATUS_LABELS.under).toContain('优于目标')
  })
})
