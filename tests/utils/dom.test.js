const D = require('../../utils/dom.js')

describe('escapeHtml', () => {
  it('escapes &', () => expect(D.escapeHtml('a&b')).toBe('a&amp;b'))
  it('escapes <', () => expect(D.escapeHtml('<div>')).toBe('&lt;div&gt;'))
  it('escapes "', () => expect(D.escapeHtml('"hi"')).toBe('&quot;hi&quot;'))
  it("escapes '", () => expect(D.escapeHtml("it's")).toBe('it&#39;s'))
  it('handles null', () => expect(D.escapeHtml(null)).toBe(''))
  it('handles undefined', () => expect(D.escapeHtml(undefined)).toBe(''))
  it('no-op for safe string', () => expect(D.escapeHtml('hello')).toBe('hello'))
  it('escapes script tag', () => {
    expect(D.escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    )
  })
})

describe('templateColumnLabel', () => {
  it('0 → A', () => expect(D.templateColumnLabel(0)).toBe('A'))
  it('1 → B', () => expect(D.templateColumnLabel(1)).toBe('B'))
  it('25 → Z', () => expect(D.templateColumnLabel(25)).toBe('Z'))
  it('26 → AA', () => expect(D.templateColumnLabel(26)).toBe('AA'))
  it('27 → AB', () => expect(D.templateColumnLabel(27)).toBe('AB'))
  it('51 → AZ', () => expect(D.templateColumnLabel(51)).toBe('AZ'))
  it('52 → BA', () => expect(D.templateColumnLabel(52)).toBe('BA'))
  it('701 → ZZ', () => expect(D.templateColumnLabel(701)).toBe('ZZ'))
  it('702 → AAA', () => expect(D.templateColumnLabel(702)).toBe('AAA'))
})
