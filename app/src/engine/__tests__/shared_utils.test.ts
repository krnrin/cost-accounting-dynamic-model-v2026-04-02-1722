import { describe, it, expect } from 'vitest';
import { clamp, numberOr, safeArray, clonePlain, weighted, normalizeMix, approxEqual, arraysClose } from '../shared_utils';

describe('shared_utils', () => {
  // clamp: 8 tests
  it('clamp returns value within bounds', () => expect(clamp(5, 0, 10)).toBe(5));
  it('clamp clips low', () => expect(clamp(-1, 0, 10)).toBe(0));
  it('clamp clips high', () => expect(clamp(15, 0, 10)).toBe(10));
  it('clamp handles equal bounds', () => expect(clamp(5, 3, 3)).toBe(3));
  
  // numberOr: 5 tests  
  it('numberOr returns number for valid input', () => expect(numberOr(42, 0)).toBe(42));
  it('numberOr returns number for string number', () => expect(numberOr('3.14', 0)).toBeCloseTo(3.14));
  it('numberOr returns fallback for NaN', () => expect(numberOr(NaN, -1)).toBe(-1));
  it('numberOr returns fallback for null', () => expect(numberOr(null, 0)).toBe(0));
  it('numberOr returns fallback for undefined', () => expect(numberOr(undefined, 99)).toBe(99));
  it('numberOr returns fallback for non-numeric string', () => expect(numberOr('abc', 5)).toBe(5));
  it('numberOr returns fallback for Infinity', () => expect(numberOr(Infinity, 0)).toBe(0));
  
  // safeArray: 3 tests
  it('safeArray passes through arrays', () => expect(safeArray([1,2])).toEqual([1,2]));
  it('safeArray returns [] for null', () => expect(safeArray(null)).toEqual([]));
  it('safeArray returns [] for string', () => expect(safeArray('hello')).toEqual([]));
  
  // clonePlain: 3 tests
  it('clonePlain deep clones', () => {
    const obj = { a: { b: 1 } };
    const c = clonePlain(obj, {} as any);
    c.a.b = 2;
    expect(obj.a.b).toBe(1); // original unchanged
  });
  it('clonePlain returns fallback on circular ref', () => {
    const a: any = {}; a.self = a;
    expect(clonePlain(a, { fallback: true } as any)).toEqual({ fallback: true });
  });
  
  // weighted: 3 tests
  it('weighted computes correct sum', () => {
    // shares=[50, 50], indexes=[100, 200] => 50/100*100 + 50/100*200 = 50+100=150
    expect(weighted([50, 50], [100, 200])).toBe(150);
  });
  it('weighted handles string shares', () => {
    expect(weighted(['100'], [500])).toBe(500);
  });
  it('weighted handles empty arrays', () => {
    expect(weighted([], [])).toBe(0);
  });
  
  // normalizeMix: 3 tests
  it('normalizeMix normalizes to 100', () => {
    const result = normalizeMix([25, 75]);
    expect(result[0]).toBe(25);
    expect(result[1]).toBe(75);
  });
  it('normalizeMix handles all zeros', () => {
    const result = normalizeMix([0, 0]);
    expect(result).toEqual([0, 0]);
  });
  it('normalizeMix handles negative values', () => {
    const result = normalizeMix([-5, 10]);
    expect(result[0]).toBe(0);
    expect(result[1]).toBe(100);
  });
  
  // approxEqual: 2 tests
  it('approxEqual returns true for close values', () => expect(approxEqual(1.0000001, 1.0)).toBe(true));
  it('approxEqual returns false for different values', () => expect(approxEqual(1, 2)).toBe(false));
  
  // arraysClose: 2 tests
  it('arraysClose returns true for matching', () => expect(arraysClose([1,2], [1,2])).toBe(true));
  it('arraysClose returns false for different lengths', () => expect(arraysClose([1], [1,2])).toBe(false));
});
