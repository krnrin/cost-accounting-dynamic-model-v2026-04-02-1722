const CC = require('../../engine/computation_cache.js')

describe('createLRU', () => {
  it('stores and retrieves values', () => {
    const lru = CC.createLRU(5)
    lru.set('a', 1)
    expect(lru.get('a')).toBe(1)
  })

  it('returns undefined for missing key', () => {
    const lru = CC.createLRU(5)
    expect(lru.get('missing')).toBeUndefined()
  })

  it('evicts oldest when full', () => {
    const lru = CC.createLRU(3)
    lru.set('a', 1)
    lru.set('b', 2)
    lru.set('c', 3)
    lru.set('d', 4) // evicts 'a'
    expect(lru.get('a')).toBeUndefined()
    expect(lru.get('d')).toBe(4)
    expect(lru.size).toBe(3)
  })

  it('access refreshes entry (not evicted)', () => {
    const lru = CC.createLRU(3)
    lru.set('a', 1)
    lru.set('b', 2)
    lru.set('c', 3)
    lru.get('a') // refresh 'a'
    lru.set('d', 4) // evicts 'b' (oldest after refresh)
    expect(lru.get('a')).toBe(1)
    expect(lru.get('b')).toBeUndefined()
  })

  it('overwrite updates value without growing', () => {
    const lru = CC.createLRU(3)
    lru.set('a', 1)
    lru.set('a', 99)
    expect(lru.get('a')).toBe(99)
    expect(lru.size).toBe(1)
  })

  it('clear empties cache', () => {
    const lru = CC.createLRU(5)
    lru.set('a', 1)
    lru.set('b', 2)
    lru.clear()
    expect(lru.size).toBe(0)
    expect(lru.get('a')).toBeUndefined()
  })

  it('has returns correct boolean', () => {
    const lru = CC.createLRU(5)
    lru.set('x', 42)
    expect(lru.has('x')).toBe(true)
    expect(lru.has('y')).toBe(false)
  })
})

describe('buildCacheKey', () => {
  it('produces stable key for same input', () => {
    const k1 = CC.buildCacheKey({ b: 2, a: 1 }, { d: 4, c: 3 })
    const k2 = CC.buildCacheKey({ a: 1, b: 2 }, { c: 3, d: 4 })
    expect(k1).toBe(k2)
  })

  it('different inputs produce different keys', () => {
    const k1 = CC.buildCacheKey({ a: 1 }, {})
    const k2 = CC.buildCacheKey({ a: 2 }, {})
    expect(k1).not.toBe(k2)
  })

  it('returns null for circular ref', () => {
    const obj = {}
    obj.self = obj
    expect(CC.buildCacheKey(obj, {})).toBe(null)
  })

  it('contains separator', () => {
    const key = CC.buildCacheKey({ a: 1 }, { b: 2 })
    expect(key).toContain('||')
  })
})

describe('getWireCatalogIndex', () => {
  it('builds index from catalog array', () => {
    const catalog = [
      { partNo: 'W001', copperWeightPerKm: 100 },
      { partNo: 'W002', copperWeightPerKm: 200 },
    ]
    const idx = CC.getWireCatalogIndex(catalog)
    expect(idx.get('W001').copperWeightPerKm).toBe(100)
    expect(idx.get('W002').copperWeightPerKm).toBe(200)
    expect(idx.size).toBe(2)
  })

  it('returns cached index for same array ref', () => {
    const catalog = [{ partNo: 'W001' }]
    const idx1 = CC.getWireCatalogIndex(catalog)
    const idx2 = CC.getWireCatalogIndex(catalog)
    expect(idx1).toBe(idx2)
  })

  it('returns empty Map for non-array', () => {
    expect(CC.getWireCatalogIndex(null).size).toBe(0)
    expect(CC.getWireCatalogIndex('bad').size).toBe(0)
  })

  it('indexes by materialNo as fallback', () => {
    const catalog = [{ materialNo: 'M001', name: 'wire' }]
    const idx = CC.getWireCatalogIndex(catalog)
    expect(idx.has('M001')).toBe(true)
  })
})
