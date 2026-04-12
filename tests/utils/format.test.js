const F = require('../../utils/format.js')

describe('fmtMoney', () => {
  it('formats with 2 decimals', () => expect(F.fmtMoney(12345.6)).toMatch(/12.*345\.60/))
  it('formats zero', () => expect(F.fmtMoney(0)).toMatch(/0\.00/))
  it('handles null', () => expect(F.fmtMoney(null)).toMatch(/0\.00/))
  it('custom decimals', () => expect(F.fmtMoney(1.5, 4)).toMatch(/1\.5000/))
})

describe('fmtMaybeMoney', () => {
  it('returns - for null', () => expect(F.fmtMaybeMoney(null)).toBe('-'))
  it('returns - for empty string', () => expect(F.fmtMaybeMoney('')).toBe('-'))
  it('returns - for NaN string', () => expect(F.fmtMaybeMoney('abc')).toBe('-'))
  it('formats valid number', () => expect(F.fmtMaybeMoney(42)).toMatch(/42\.00/))
})

describe('fmtMaybeNumber', () => {
  it('returns - for undefined', () => expect(F.fmtMaybeNumber(undefined)).toBe('-'))
  it('formats valid', () => expect(F.fmtMaybeNumber(3.14)).toMatch(/3\.14/))
})

describe('fmtMetric', () => {
  it('returns - for zero', () => expect(F.fmtMetric(0)).toBe('-'))
  it('returns - for near-zero', () => expect(F.fmtMetric(0.0000001)).toBe('-'))
  it('formats nonzero', () => expect(F.fmtMetric(5.5)).toMatch(/5\.50/))
})

describe('fmtInt', () => {
  it('rounds to integer', () => expect(F.fmtInt(3.7)).toMatch(/4/))
  it('handles null', () => expect(F.fmtInt(null)).toMatch(/0/))
})

describe('fmtPct', () => {
  it('converts ratio to percent', () => expect(F.fmtPct(0.156)).toBe('15.60%'))
  it('handles zero', () => expect(F.fmtPct(0)).toBe('0.00%'))
  it('custom decimals', () => expect(F.fmtPct(0.5, 0)).toBe('50%'))
})

describe('fmtSigned', () => {
  it('positive gets +', () => expect(F.fmtSigned(1.23)).toBe('+1.23'))
  it('negative omits sign (abs only)', () => expect(F.fmtSigned(-4.56)).toBe('4.56'))
  it('zero gets +', () => expect(F.fmtSigned(0)).toBe('+0.00'))
})

describe('fmtSignedMoney', () => {
  it('positive gets +', () => expect(F.fmtSignedMoney(100)).toMatch(/^\+/))
  it('negative omits sign (abs only)', () => expect(F.fmtSignedMoney(-100)).toMatch(/^\d/))
})

describe('fmtMaybeInt', () => {
  it('returns — for NaN', () => expect(F.fmtMaybeInt('abc')).toBe('—'))
  it('returns ∞ for Infinity', () => expect(F.fmtMaybeInt(Infinity)).toBe('∞'))
  it('formats valid', () => expect(F.fmtMaybeInt(42)).toMatch(/42/))
})
