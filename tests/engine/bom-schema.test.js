const BS = require('../../engine/bom_schema.js')

describe('normalizeCell', () => {
  it('fills defaults for empty cell', () => {
    const cell = BS.normalizeCell({})
    expect(cell.row).toBe(1)
    expect(cell.column).toBe(1)
    expect(cell.value).toBe(null)
    expect(cell.address).toBe('A1')
  })

  it('preserves provided values', () => {
    const cell = BS.normalizeCell({ row: 3, column: 2, value: 'hello' })
    expect(cell.row).toBe(3)
    expect(cell.column).toBe(2)
    expect(cell.value).toBe('hello')
    expect(cell.address).toBe('B3')
  })

  it('uses rowIndex/columnIndex as fallback', () => {
    const cell = BS.normalizeCell({ rowIndex: 5, columnIndex: 3 })
    expect(cell.row).toBe(5)
    expect(cell.column).toBe(3)
  })

  it('normalizes formula type', () => {
    const cell = BS.normalizeCell({ formula: '=A1+B1' })
    expect(cell.dataType).toBe('formula')
  })
})

describe('normalizeRow', () => {
  it('fills defaults for empty row', () => {
    const row = BS.normalizeRow({})
    expect(row.rowIndex).toBe(0)
    expect(row.rowType).toBe('standard')
    expect(row.isHeader).toBe(false)
    expect(row.cells).toEqual([])
  })

  it('normalizes cells within row', () => {
    const row = BS.normalizeRow({
      rowIndex: 2,
      cells: [{ row: 2, column: 1, value: 'test' }],
    })
    expect(row.cells).toHaveLength(1)
    expect(row.cells[0].value).toBe('test')
  })
})

describe('normalizeSheet', () => {
  it('fills defaults for empty sheet', () => {
    const sheet = BS.normalizeSheet({})
    expect(sheet.sheetName).toBe('Sheet1')
    expect(sheet.sheetState).toBe('visible')
    expect(sheet.headerRows).toBe(1)
  })

  it('builds rows from cells', () => {
    const sheet = BS.normalizeSheet({
      cells: [
        { row: 1, column: 1, value: 'A' },
        { row: 1, column: 2, value: 'B' },
        { row: 2, column: 1, value: 'C' },
      ],
    })
    expect(sheet.rowCount).toBe(2)
    expect(sheet.rows[0].cells).toHaveLength(2)
    expect(sheet.rows[1].cells).toHaveLength(1)
  })
})

describe('normalizeWorkbook', () => {
  it('fills defaults for empty workbook', () => {
    const wb = BS.normalizeWorkbook({})
    expect(wb.sheetCount).toBe(1)
    expect(wb.sheets).toHaveLength(1)
    expect(wb.sheets[0].sheetName).toBe('Sheet1')
  })

  it('normalizes multiple sheets', () => {
    const wb = BS.normalizeWorkbook({
      sheets: [
        { sheetName: 'BOM', cells: [] },
        { sheetName: '变更', cells: [] },
      ],
    })
    expect(wb.sheetCount).toBe(2)
    expect(wb.sheetOrder).toEqual(['BOM', '变更'])
  })
})

describe('defaults', () => {
  it('has expected defaults', () => {
    expect(BS.defaults.projectId).toBe('default-bom')
    expect(BS.defaults.sourceType).toBe('bom')
  })
})
