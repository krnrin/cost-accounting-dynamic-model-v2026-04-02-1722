import { describe, it, expect } from 'vitest';
import { parsePackagingFromRows, parseProcessHoursFromRows } from '../bom_parser';

describe('BOM Parser Enhanced Import', () => {
  describe('parsePackagingFromRows', () => {
    it('should parse packaging costs with Chinese headers', () => {
      const rows = [
        ['零件号', '内盒', '外箱', '托盘', '隔板', '气泡膜', '标签'],
        ['H01', 1.2, 2.3, 3.4, 0.5, 0.6, 0.1],
        ['H02', '10', '20', '30', '5', '6', '1'],
      ];
      const result = parsePackagingFromRows(rows);
      expect(result.successRows).toBe(2);
      expect(result.items['H01']).toEqual({
        innerBoxCost: 1.2,
        outerBoxCost: 2.3,
        palletCost: 3.4,
        trayDividerCost: 0.5,
        bubbleWrapCost: 0.6,
        labelCost: 0.1,
      });
      expect(result.items['H02']?.innerBoxCost).toBe(10);
    });

    it('should parse packaging costs with English headers', () => {
      const rows = [
        ['partNo', 'innerBox', 'outerBox', 'pallet', 'divider', 'wrap', 'label'],
        ['H01', 1, 2, 3, 4, 5, 6],
      ];
      const result = parsePackagingFromRows(rows);
      expect(result.successRows).toBe(1);
      expect(result.items['H01']).toEqual({
        innerBoxCost: 1,
        outerBoxCost: 2,
        palletCost: 3,
        trayDividerCost: 4,
        bubbleWrapCost: 5,
        labelCost: 6,
      });
    });

    it('should handle partial headers', () => {
      const rows = [
        ['零件号', '内盒', '外箱'],
        ['H01', 1.2, 2.3],
      ];
      const result = parsePackagingFromRows(rows);
      expect(result.items['H01']).toEqual({
        innerBoxCost: 1.2,
        outerBoxCost: 2.3,
        palletCost: 0,
        trayDividerCost: 0,
        bubbleWrapCost: 0,
        labelCost: 0,
      });
    });
  });

  describe('parseProcessHoursFromRows', () => {
    it('should parse process hours with Chinese headers', () => {
      const rows = [
        ['零件号', '前工序工时', '后工序工时'],
        ['H01', 0.5, 1.5],
      ];
      const result = parseProcessHoursFromRows(rows);
      expect(result.successRows).toBe(1);
      expect(result.items['H01']).toEqual({
        frontHours: 0.5,
        backHours: 1.5,
      });
    });

    it('should parse process hours with English headers', () => {
      const rows = [
        ['partNo', 'frontHours', 'backHours'],
        ['H01', 2, 3],
      ];
      const result = parseProcessHoursFromRows(rows);
      expect(result.successRows).toBe(1);
      expect(result.items['H01']).toEqual({
        frontHours: 2,
        backHours: 3,
      });
    });
  });
});
