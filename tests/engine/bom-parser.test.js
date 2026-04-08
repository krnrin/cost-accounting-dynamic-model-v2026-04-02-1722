const BP = require('../../engine/bom_parser.js')

describe('resolveSheetRole', () => {
  it('detects change_history', () => {
    expect(BP.resolveSheetRole('变更履历')).toBe('change_history')
  })

  it('detects assembly_parts', () => {
    expect(BP.resolveSheetRole('总成散件清单')).toBe('assembly_parts')
  })

  it('detects secondary_materials', () => {
    expect(BP.resolveSheetRole('二次物料明细')).toBe('secondary_materials')
  })

  it('detects ksk_bom_detail', () => {
    expect(BP.resolveSheetRole('KSK线束BOM明细')).toBe('ksk_bom_detail')
  })

  it('detects harness by numeric prefix', () => {
    expect(BP.resolveSheetRole('123456-高压线束')).toBe('harness')
  })

  it('returns other for unknown', () => {
    expect(BP.resolveSheetRole('随便什么')).toBe('other')
  })
})

describe('classifyBomItem', () => {
  it('classifies connector by partName', () => {
    expect(BP.classifyBomItem({ partName: '高压连接器 A型' })).toBe('connector')
  })

  it('classifies terminal (non-ipt)', () => {
    expect(BP.classifyBomItem({ partName: '端子 M6' })).toBe('terminal')
  })

  it('classifies ipt_terminal', () => {
    expect(BP.classifyBomItem({ partName: 'IPT压接端子' })).toBe('ipt_terminal')
  })

  it('classifies wire', () => {
    expect(BP.classifyBomItem({ partName: '高压导线 35mm²' })).toBe('wire')
  })

  it('classifies tape_tube', () => {
    expect(BP.classifyBomItem({ partName: '热缩管 Φ10' })).toBe('tape_tube')
  })

  it('classifies bracket_rubber', () => {
    expect(BP.classifyBomItem({ partName: '固定支架' })).toBe('bracket_rubber')
  })

  it('returns other for unknown', () => {
    expect(BP.classifyBomItem({ partName: '特殊零件' })).toBe('other')
  })

  it('checks secondary fields for ipt', () => {
    expect(BP.classifyBomItem({ partName: '端子', functionText: 'ipt连接' })).toBe('ipt_terminal')
  })
})

describe('buildAlignKey', () => {
  it('builds key from item fields', () => {
    const key = BP.buildAlignKey({
      itemCategory: 'connector',
      endGroup: '接电池端',
      partNo: 'P-001',
      sapNo: 'SAP-001',
    })
    expect(key).toBe('connector|接电池端|p-001|sap-001')
  })

  it('handles missing fields', () => {
    const key = BP.buildAlignKey({})
    expect(key).toBe('other|||')
  })
})

describe('PARSER_VERSION', () => {
  it('is a string', () => {
    expect(typeof BP.PARSER_VERSION).toBe('string')
    expect(BP.PARSER_VERSION.length).toBeGreaterThan(0)
  })
})
