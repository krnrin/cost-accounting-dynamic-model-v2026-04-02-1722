const P = require('../../utils/parse.js')

describe('fallbackParseNumericCellValue', () => {
  it('parses plain number', () => expect(P.fallbackParseNumericCellValue('123')).toBe(123))
  it('strips commas', () => expect(P.fallbackParseNumericCellValue('1,234')).toBe(1234))
  it('strips currency ¥', () => expect(P.fallbackParseNumericCellValue('¥100')).toBe(100))
  it('strips currency $', () => expect(P.fallbackParseNumericCellValue('$50')).toBe(50))
  it('returns null for empty', () => expect(P.fallbackParseNumericCellValue('')).toBe(null))
  it('returns null for null', () => expect(P.fallbackParseNumericCellValue(null)).toBe(null))
  it('returns null for non-numeric', () => expect(P.fallbackParseNumericCellValue('abc')).toBe(null))
  it('strips % for numeric part', () => expect(P.fallbackParseNumericCellValue('15%')).toBe(15))
})

describe('parseLifecycleRate', () => {
  it('parses percentage string', () => expect(P.parseLifecycleRate('3.5%')).toBeCloseTo(0.035))
  it('parses plain decimal', () => expect(P.parseLifecycleRate(0.05)).toBeCloseTo(0.05))
  it('treats >1 <=100 as percent', () => expect(P.parseLifecycleRate(50)).toBeCloseTo(0.5))
  it('returns 0 for null', () => expect(P.parseLifecycleRate(null)).toBe(0))
  it('returns 0 for empty', () => expect(P.parseLifecycleRate('')).toBe(0))
  it('never returns negative', () => expect(P.parseLifecycleRate(-5)).toBe(0))
  it('passes through value <=1', () => expect(P.parseLifecycleRate(0.8)).toBeCloseTo(0.8))
  it('passes through value >100', () => expect(P.parseLifecycleRate(150)).toBe(150))
})

describe('parseLifecycleMoney', () => {
  it('returns number as-is', () => expect(P.parseLifecycleMoney(42.5)).toBe(42.5))
  it('parses string', () => expect(P.parseLifecycleMoney('100')).toBe(100))
  it('returns 0 for null', () => expect(P.parseLifecycleMoney(null)).toBe(0))
  it('returns 0 for non-numeric', () => expect(P.parseLifecycleMoney('abc')).toBe(0))
})

describe('normalizeTemplateYear', () => {
  it('returns valid year number', () => expect(P.normalizeTemplateYear(2026)).toBe(2026))
  it('FY prefix without separator fails (no word boundary)', () => expect(P.normalizeTemplateYear('FY2026')).toBe(null))
  it('extracts year from 年 string', () => expect(P.normalizeTemplateYear('2026年')).toBe(2026))
  it('returns fallback for invalid', () => expect(P.normalizeTemplateYear('abc', 2025)).toBe(2025))
  it('returns null fallback by default', () => expect(P.normalizeTemplateYear('abc')).toBe(null))
  it('rejects year < 1900', () => expect(P.normalizeTemplateYear(1800, null)).toBe(null))
})

describe('normalizeTargetMarginPercent', () => {
  it('returns clamped value', () => expect(P.normalizeTargetMarginPercent(50)).toBe(50))
  it('clamps above 99.99', () => expect(P.normalizeTargetMarginPercent(200)).toBe(99.99))
  it('clamps below -99.99', () => expect(P.normalizeTargetMarginPercent(-200)).toBe(-99.99))
  it('rounds to 2 decimals', () => expect(P.normalizeTargetMarginPercent(3.456)).toBe(3.46))
  it('returns null for empty', () => expect(P.normalizeTargetMarginPercent('')).toBe(null))
  it('returns null for NaN', () => expect(P.normalizeTargetMarginPercent('abc')).toBe(null))
})
