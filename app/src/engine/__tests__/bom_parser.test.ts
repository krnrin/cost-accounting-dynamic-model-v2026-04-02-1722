import { describe, it, expect } from 'vitest';
import { 
  detectBomFormat, 
  parseBomFromRows, 
  classifyItem,
  classifyBomItem
} from '../bom_parser';

describe('bom_parser', () => {
  it('detectBomFormat identifies Geely, BYD, and Generic formats', () => {
    const geelyHeaders = ['序号', '零件号', '零件名称', '用量', '单价'];
    const bydHeaders = ['ItemNo', 'PartNumber', 'Description', 'Qty', 'Category'];
    const genericHeaders = ['partNo', 'partName', 'qty', 'unitPrice'];
    
    expect(detectBomFormat(geelyHeaders)).toBe('geely');
    expect(detectBomFormat(bydHeaders)).toBe('byd');
    expect(detectBomFormat(genericHeaders)).toBe('generic');
    expect(detectBomFormat(['other', 'col'])).toBe('unknown');
  });

  it('classifyItem identifies categories from names', () => {
    expect(classifyItem({ partName: '屏蔽导线' })).toBe('wire');
    expect(classifyItem({ partName: '连接器' })).toBe('connector');
    expect(classifyItem({ partName: '端子' })).toBe('terminal');
    expect(classifyItem({ partName: '支架' })).toBe('bracket_rubber');
    expect(classifyItem({ partName: '胶带' })).toBe('tape_tube');
    expect(classifyItem({ partName: 'IPT连接器' })).toBe('ipt_terminal');
  });

  it('parseBomFromRows handles Geely format', () => {
    const rows = [
      ['序号', '零件号', '零件名称', '材料', '单位', '用量', '单价'],
      ['1', 'P001', 'High Voltage Cable', 'Copper', 'm', '2.5', '50'],
      ['2', 'P002', 'Connector A', 'Plastic', 'pcs', '1', '100']
    ];
    
    const result = parseBomFromRows(rows);
    
    expect(result.format).toBe('geely');
    expect(result.successRows).toBe(2);
    expect(result.items).toHaveLength(2);
    expect(result.items[0].partNo).toBe('P001');
    expect(result.items[0].qty).toBe(2.5);
    expect(result.items[0].unitPrice).toBe(50);
    expect(result.items[0].amount).toBe(125);
    expect(result.items[0].itemCategory).toBe('wire');
  });

  it('parseBomFromRows handles BYD format', () => {
    const rows = [
      ['ItemNo', 'PartNumber', 'Description', 'Material', 'UOM', 'Qty', 'UnitPrice', 'Category'],
      ['1', 'BYD-001', 'Cable', 'Cu', 'm', '3', '60', 'WIRE'],
      ['2', 'BYD-002', 'Shell', 'Pl', 'pcs', '2', '30', 'CONNECTOR']
    ];
    
    const result = parseBomFromRows(rows);
    
    expect(result.format).toBe('byd');
    expect(result.items[0].itemCategory).toBe('wire');
    expect(result.items[1].itemCategory).toBe('connector');
    expect(result.items[0].amount).toBe(180);
  });

  it('parseBomFromRows handles Generic format with extra columns', () => {
    const rows = [
      ['partNo', 'partName', 'qty', 'unitPrice', 'category', 'copperWeight'],
      ['G001', 'Super Wire', '1', '200', 'wire', '0.5']
    ];
    
    const result = parseBomFromRows(rows);
    
    expect(result.format).toBe('generic');
    expect(result.items[0].itemCategory).toBe('wire');
    expect((result.items[0] as any).copperWeightPerUnit).toBe(0.5);
  });

  it('handles empty rows and skipping correctly', () => {
    const rows = [
      ['partNo', 'partName', 'qty'],
      ['', '', '0'], // empty
      ['G001', 'Valid', '10']
    ];
    
    const result = parseBomFromRows(rows);
    
    expect(result.successRows).toBe(1);
    expect(result.skippedRows).toBe(1);
  });

  it('classifyItem handles IPT variants', () => {
    expect(classifyItem({ partName: 'IPT端子总成' })).toBe('ipt_terminal');
  });

  it('classifyItem handles heat shrink tube', () => {
    expect(classifyItem({ partName: '热缩套管' })).toBe('tape_tube');
  });

  it('classifyItem defaults to other for unknown', () => {
    expect(classifyItem({ partName: '未知零件ABC' })).toBe('other');
  });

  it('parseBomFromRows handles rows with missing price gracefully', () => {
    const rows = [
      ['partNo', 'partName', 'qty', 'unitPrice'],
      ['G001', 'Wire', '10', ''],  // empty price
    ];
    const result = parseBomFromRows(rows);
    expect(result.items[0].unitPrice).toBe(0);
    expect(result.items[0].amount).toBe(0);
  });
});
