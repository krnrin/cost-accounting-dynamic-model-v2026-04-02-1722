const S = require('../../utils/shared.js')

describe('numberOr', () => {
  it('returns number for valid input', () => expect(S.numberOr(42)).toBe(42))
  it('coerces string to number', () => expect(S.numberOr('3.14')).toBe(3.14))
  it('returns fallback for NaN', () => expect(S.numberOr('abc', 5)).toBe(5))
  it('coerces null to 0 (Number(null)=0 is finite)', () => expect(S.numberOr(null, -1)).toBe(0))
  it('returns fallback for undefined', () => expect(S.numberOr(undefined)).toBe(0))
  it('returns 0 for Infinity', () => expect(S.numberOr(Infinity)).toBe(0))
})

describe('safeArray', () => {
  it('returns array as-is', () => expect(S.safeArray([1, 2])).toEqual([1, 2]))
  it('returns [] for null', () => expect(S.safeArray(null)).toEqual([]))
  it('returns [] for string', () => expect(S.safeArray('abc')).toEqual([]))
  it('returns [] for number', () => expect(S.safeArray(42)).toEqual([]))
})

describe('ensureObject', () => {
  it('returns object as-is', () => expect(S.ensureObject({ a: 1 })).toEqual({ a: 1 }))
  it('returns {} for null', () => expect(S.ensureObject(null)).toEqual({}))
  it('returns {} for array', () => expect(S.ensureObject([1])).toEqual({}))
  it('returns {} for string', () => expect(S.ensureObject('x')).toEqual({}))
})

describe('toText', () => {
  it('trims string', () => expect(S.toText('  hi  ')).toBe('hi'))
  it('returns fallback for empty', () => expect(S.toText('', 'n/a')).toBe('n/a'))
  it('converts number to string', () => expect(S.toText(42)).toBe('42'))
  it('returns fallback for null', () => expect(S.toText(null, 'x')).toBe('x'))
})

describe('clonePlain', () => {
  it('deep clones object', () => {
    const obj = { a: { b: 1 } }
    const clone = S.clonePlain(obj)
    expect(clone).toEqual(obj)
    expect(clone).not.toBe(obj)
    expect(clone.a).not.toBe(obj.a)
  })
  it('returns fallback for circular ref', () => {
    const obj = {}
    obj.self = obj
    expect(S.clonePlain(obj, 'fail')).toBe('fail')
  })
})

describe('clamp', () => {
  it('clamps below min', () => expect(S.clamp(-5, 0, 10)).toBe(0))
  it('clamps above max', () => expect(S.clamp(15, 0, 10)).toBe(10))
  it('returns value in range', () => expect(S.clamp(5, 0, 10)).toBe(5))
})

describe('shallowObjectEqual', () => {
  it('equal objects', () => expect(S.shallowObjectEqual({ a: 1 }, { a: 1 })).toBe(true))
  it('different values', () => expect(S.shallowObjectEqual({ a: 1 }, { a: 2 })).toBe(false))
  it('different keys', () => expect(S.shallowObjectEqual({ a: 1 }, { b: 1 })).toBe(false))
  it('handles null', () => expect(S.shallowObjectEqual(null, null)).toBe(true))
})

describe('normalizeStoredBoolean', () => {
  it('returns true for "yes"', () => expect(S.normalizeStoredBoolean('yes')).toBe(true))
  it('returns true for "1"', () => expect(S.normalizeStoredBoolean('1')).toBe(true))
  it('returns true for "on"', () => expect(S.normalizeStoredBoolean('on')).toBe(true))
  it('returns false for "no"', () => expect(S.normalizeStoredBoolean('no')).toBe(false))
  it('returns false for "0"', () => expect(S.normalizeStoredBoolean('0')).toBe(false))
  it('returns false for "off"', () => expect(S.normalizeStoredBoolean('off')).toBe(false))
  it('returns boolean as-is', () => expect(S.normalizeStoredBoolean(true)).toBe(true))
  it('returns fallback for empty', () => expect(S.normalizeStoredBoolean('', true)).toBe(true))
  it('number 0 → false', () => expect(S.normalizeStoredBoolean(0)).toBe(false))
  it('number 1 → true', () => expect(S.normalizeStoredBoolean(1)).toBe(true))
})

describe('approxEqual', () => {
  it('equal values', () => expect(S.approxEqual(1.0, 1.0)).toBe(true))
  it('within epsilon', () => expect(S.approxEqual(1.0, 1.0000001)).toBe(true))
  it('outside epsilon', () => expect(S.approxEqual(1.0, 1.1)).toBe(false))
  it('custom epsilon', () => expect(S.approxEqual(1.0, 1.05, 0.1)).toBe(true))
})

describe('arraysClose', () => {
  it('equal arrays', () => expect(S.arraysClose([1, 2], [1, 2])).toBe(true))
  it('close arrays', () => expect(S.arraysClose([1.0], [1.0000001])).toBe(true))
  it('different length', () => expect(S.arraysClose([1], [1, 2])).toBe(false))
  it('non-array returns false', () => expect(S.arraysClose(null, [1])).toBe(false))
})

describe('weighted', () => {
  it('computes weighted sum', () => {
    expect(S.weighted([50, 50], [100, 200])).toBe(150)
  })
  it('single element', () => {
    expect(S.weighted([100], [42])).toBe(42)
  })
})

describe('normalizeMix', () => {
  it('normalizes to 100%', () => {
    const result = S.normalizeMix([1, 1, 1])
    expect(result.reduce((a, b) => a + b, 0)).toBeCloseTo(100)
  })
  it('handles all zeros', () => {
    const result = S.normalizeMix([0, 0])
    expect(result).toEqual([0, 0])
  })
  it('preserves proportions', () => {
    const result = S.normalizeMix([25, 75])
    expect(result[0]).toBeCloseTo(25)
    expect(result[1]).toBeCloseTo(75)
  })
})

describe('createId', () => {
  it('starts with prefix', () => {
    expect(S.createId('test').startsWith('test-')).toBe(true)
  })
  it('includes suffix', () => {
    expect(S.createId('a', 'b')).toMatch(/^a-b-/)
  })
})
