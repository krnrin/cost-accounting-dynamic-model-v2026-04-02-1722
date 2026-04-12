const EB = require('../../engine/error_boundary.js')

describe('wrapSync', () => {
  beforeEach(() => EB.clearErrorLog())

  it('returns function result on success', () => {
    const fn = EB.wrapSync('test', () => 42, 0)
    expect(fn()).toBe(42)
  })

  it('returns fallback on throw', () => {
    const fn = EB.wrapSync('test', () => { throw new Error('boom') }, -1)
    expect(fn()).toBe(-1)
  })

  it('calls fallback function on throw', () => {
    const fn = EB.wrapSync('test', () => { throw new Error('boom') }, () => 'safe')
    expect(fn()).toBe('safe')
  })

  it('passes arguments through', () => {
    const fn = EB.wrapSync('test', (a, b) => a + b, 0)
    expect(fn(3, 4)).toBe(7)
  })

  it('logs error on throw', () => {
    const fn = EB.wrapSync('myModule', () => { throw new Error('fail') }, null)
    fn()
    const log = EB.getErrorLog()
    expect(log.length).toBe(1)
    expect(log[0].label).toBe('myModule')
    expect(log[0].message).toContain('fail')
  })
})

describe('wrapAsync', () => {
  beforeEach(() => EB.clearErrorLog())

  it('returns result on success', async () => {
    const fn = EB.wrapAsync('test', async () => 99, 0)
    expect(await fn()).toBe(99)
  })

  it('returns fallback on rejection', async () => {
    const fn = EB.wrapAsync('test', async () => { throw new Error('async boom') }, 'fallback')
    expect(await fn()).toBe('fallback')
  })
})

describe('withTimeout', () => {
  beforeEach(() => EB.clearErrorLog())

  it('returns result if fast enough', async () => {
    const result = await EB.withTimeout('test', () => 'fast', 1000, 'timeout')
    expect(result).toBe('fast')
  })

  it('returns fallback on timeout', async () => {
    const result = await EB.withTimeout(
      'test',
      () => new Promise(r => setTimeout(() => r('slow'), 500)),
      10,
      'timed_out'
    )
    expect(result).toBe('timed_out')
  })
})

describe('error log management', () => {
  beforeEach(() => EB.clearErrorLog())

  it('clearErrorLog empties the log', () => {
    const fn = EB.wrapSync('x', () => { throw new Error('e') }, null)
    fn()
    expect(EB.getErrorLog().length).toBe(1)
    EB.clearErrorLog()
    expect(EB.getErrorLog().length).toBe(0)
  })

  it('getErrorLog returns a copy', () => {
    const log1 = EB.getErrorLog()
    const log2 = EB.getErrorLog()
    expect(log1).not.toBe(log2)
  })
})
