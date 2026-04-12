const CP = require('../../engine/computation_path.js')

describe('detect', () => {
  it('returns unknown for null model', () => {
    const r = CP.detect(null)
    expect(r.path).toBe('unknown')
    expect(r.label).toBe('未知')
  })

  it('returns exact when exactFinancialVersionKey present', () => {
    const r = CP.detect({ exactFinancialVersionKey: 'quote_v1' })
    expect(r.path).toBe('exact')
    expect(r.label).toBe('精确路径')
    expect(r.description).toContain('quote_v1')
    expect(r.warning).toBeNull()
  })

  it('returns exact when financialContext.exactApplied', () => {
    const r = CP.detect({ financialContext: { exactApplied: true, exactKey: 'fixed_v2' } })
    expect(r.path).toBe('exact')
    expect(r.description).toContain('fixed_v2')
  })

  it('returns estimated for plain model', () => {
    const r = CP.detect({ someData: 123 })
    expect(r.path).toBe('estimated')
    expect(r.label).toBe('估算路径')
    expect(r.warning).toBeTruthy()
  })
})

describe('badge', () => {
  it('green badge for exact path', () => {
    const b = CP.badge({ exactFinancialVersionKey: 'v1' })
    expect(b.badge).toContain('精确')
    expect(b.color).toBe('green')
  })

  it('orange badge for estimated path', () => {
    const b = CP.badge({ someData: 1 })
    expect(b.badge).toContain('估算')
    expect(b.color).toBe('orange')
  })

  it('orange badge for null model', () => {
    const b = CP.badge(null)
    expect(b.color).toBe('orange')
  })
})
