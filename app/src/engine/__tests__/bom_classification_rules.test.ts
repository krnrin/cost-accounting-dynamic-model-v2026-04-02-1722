import { describe, it, expect } from 'vitest';
import { classifyBomItem, DEFAULT_CLASSIFICATION_RULES } from '../harness_costing';
import { BomItem } from '@/types/harness';
import { BomClassificationRule } from '@/types/project';

describe('BOM Classification Rules', () => {
  // 1. Test default rules produce same results as current hardcoded logic for known items
  it('should classify items correctly with default rules', () => {
    const wire: Partial<BomItem> = { partName: 'FLRY-A 0.35', itemCategory: 'wire' };
    const connector: Partial<BomItem> = { partName: '1-967616-1', itemCategory: 'connector' };
    const terminal: Partial<BomItem> = { partName: 'Terminal 0.5', itemCategory: 'terminal' };
    const bracket: Partial<BomItem> = { partName: '支架', itemCategory: 'other' as any };
    
    expect(classifyBomItem(wire, DEFAULT_CLASSIFICATION_RULES)).toBe('wire');
    expect(classifyBomItem(connector, DEFAULT_CLASSIFICATION_RULES)).toBe('connector');
    expect(classifyBomItem(terminal, DEFAULT_CLASSIFICATION_RULES)).toBe('terminal');
    expect(classifyBomItem(bracket, DEFAULT_CLASSIFICATION_RULES)).toBe('bracket_rubber');
  });

  // 2. Test custom rule overrides default (e.g. add rule for '外壳' → connector)
  it('should override default with custom rules', () => {
    const item: Partial<BomItem> = { partName: '塑料外壳', itemCategory: 'other' as any };
    const customRules: BomClassificationRule[] = [
      { category: 'connector', patterns: ['外壳'], priority: 20 }
    ];
    
    // Without custom rule, it's 'other'
    expect(classifyBomItem(item)).toBe('other');
    // With custom rule, it's 'connector'
    expect(classifyBomItem(item, customRules)).toBe('connector');
  });

  // 3. Test excludePatterns works (e.g. '端子排除' pattern skips certain items)
  it('should respect excludePatterns', () => {
    const item: Partial<BomItem> = { partName: 'Unknown排除', itemCategory: 'other' as any };
    const rules: BomClassificationRule[] = [
      { 
        category: 'terminal', 
        patterns: ['Unknown'], 
        excludePatterns: ['排除'],
        priority: 10 
      }
    ];
    
    // Matches patterns but also excludePatterns, so it should fall back to 'other'
    expect(classifyBomItem(item, rules)).toBe('other');
  });

  // 4. Test priority ordering (higher priority rule wins)
  it('should respect priority', () => {
    const item: Partial<BomItem> = { partName: '特殊端子', itemCategory: 'other' as any };
    const rules: BomClassificationRule[] = [
      { category: 'terminal', patterns: ['端子'], priority: 10 },
      { category: 'connector', patterns: ['特殊'], priority: 20 }
    ];
    
    // '特殊' matches connector rule with higher priority
    expect(classifyBomItem(item, rules)).toBe('connector');
    
    const rules2: BomClassificationRule[] = [
      { category: 'terminal', patterns: ['端子'], priority: 30 },
      { category: 'connector', patterns: ['特殊'], priority: 20 }
    ];
    expect(classifyBomItem(item, rules2)).toBe('terminal');
  });

  // 5. Test matchFields on different fields (partNo, spec)
  it('should match on different fields', () => {
    const rules: BomClassificationRule[] = [
      { category: 'wire', patterns: ['P123'], matchFields: ['partNo'], priority: 10 },
      { category: 'connector', patterns: ['SpecialSpec'], matchFields: ['spec'], priority: 10 }
    ];
    
    expect(classifyBomItem({ partNo: 'P123' }, rules)).toBe('wire');
    expect(classifyBomItem({ spec: 'SpecialSpec' }, rules)).toBe('connector');
  });

  // 6. Test empty rules array falls back to default
  it('should fall back to default when rules are empty or not provided', () => {
    const wire: Partial<BomItem> = { partName: '导线' };
    expect(classifyBomItem(wire, [])).toBe('wire');
    expect(classifyBomItem(wire)).toBe('wire');
  });

  // 7. Test backward compatibility — classifyBomItem(item) without rules still works
  it('should be backward compatible', () => {
    const item: Partial<BomItem> = { itemCategory: 'connector' };
    expect(classifyBomItem(item)).toBe('connector');
  });
});
