/**
 * 配置风险检测引擎 — 测试
 */
import { describe, it, expect } from 'vitest';
import { detectConfigRisks, inferHarnessRelations, validateRelations, generateConfigTrackingItems, detectVehicleConfigRisks } from '../config_risk';
import type { HarnessInput, VehicleConfig } from '@/types/harness';

/** E281 报价阶段 11 条线束 (简化, 只保留检测需要的字段) */
function makeInput(id: string, name: string, ratio: number, configType?: 'S' | 'O', slot?: string): HarnessInput {
  return {
    harnessId: id,
    harnessName: name,
    vehicleRatio: ratio,
    bom: [],
    frontHours: 0,
    backHours: 0,
    packaging: { innerBoxCost: 0, outerBoxCost: 0, palletCost: 0, trayDividerCost: 0, bubbleWrapCost: 0, labelCost: 0, subtotal: 0 },
    freight: { freight: 0, excessFreight: 0, shortHaul: 0, thirdPartyWarehouse: 0, storage: 0, subtotal: 0 },
    configType,
    functionalSlot: slot,
  };
}

const E281_HARNESSES: HarnessInput[] = [
  makeInput('6608491523', '直流母线总成', 0.525, 'S', '直流母线'),
  makeInput('6608491524', '直流母线总成', 0.105, 'S', '直流母线'),
  makeInput('6608442962', '直流母线总成', 0.07, 'S', '直流母线'),
  makeInput('6608442964', '电动压缩机线束总成', 0.595, 'S', '电动压缩机线束'),
  makeInput('6608442963', '电动压缩机线束总成', 0.03, 'O', '电动压缩机线束'),
  makeInput('6608516992', '电动压缩机线束总成', 0.225, 'O', '电动压缩机线束'),
  makeInput('6608519100', '电动压缩机线束总成', 0.105, 'S', '电动压缩机线束'),
  makeInput('6608442966', '组合式充电插座线束总成', 0.525, 'S', '充电插座线束'),
  makeInput('6608442965', '组合式充电插座线束总成', 0.105, 'S', '充电插座线束'),
  makeInput('6608507680', '组合式充电插座线束总成', 0.07, 'S', '充电插座线束'),
  makeInput('6608544875', '前驱直流母线总成', 0.105, 'S', '前驱直流母线'),
];

describe('detectConfigRisks', () => {
  it('should detect CFG-002 for 电动压缩机线束 (has optional parts)', () => {
    const risks = detectConfigRisks(E281_HARNESSES);
    const cfg002 = risks.filter(r => r.code === 'CFG-002');
    expect(cfg002.length).toBe(1);
    expect(cfg002[0]!.family).toBe('电动压缩机线束');
    expect(cfg002[0]!.harnessIds).toContain('6608442963');
    expect(cfg002[0]!.harnessIds).toContain('6608516992');
  });

  it('should not trigger CFG-002 for families without optional parts', () => {
    const risks = detectConfigRisks(E281_HARNESSES);
    const cfg002Families = risks.filter(r => r.code === 'CFG-002').map(r => r.family);
    expect(cfg002Families).not.toContain('直流母线');
    expect(cfg002Families).not.toContain('充电插座线束');
  });

  it('should detect CFG-003 when ratio sum > 1.0', () => {
    const bad = [
      makeInput('A', '测试族', 0.6, 'S', '测试'),
      makeInput('B', '测试族', 0.5, 'S', '测试'),
    ];
    const risks = detectConfigRisks(bad);
    expect(risks.some(r => r.code === 'CFG-003')).toBe(true);
  });

  it('should detect CFG-004 when ratio sum < 0.95', () => {
    const risks = detectConfigRisks(E281_HARNESSES);
    const cfg004 = risks.filter(r => r.code === 'CFG-004');
    expect(cfg004.some(r => r.family === '直流母线')).toBe(true);
  });

  it('should detect CFG-005 when configType is missing', () => {
    const noType = [
      makeInput('A', '测试族', 0.5, undefined, '测试'),
      makeInput('B', '测试族', 0.5, undefined, '测试'),
    ];
    const risks = detectConfigRisks(noType);
    expect(risks.some(r => r.code === 'CFG-005')).toBe(true);
  });

  it('should not flag single-member families', () => {
    const single = [makeInput('6608544875', '前驱直流母线总成', 0.105, 'S', '前驱直流母线')];
    const risks = detectConfigRisks(single);
    expect(risks.length).toBe(0);
  });
});

describe('inferHarnessRelations', () => {
  const pid = 'parent-001';

  it('should detect added harness', () => {
    const parent = [makeInput('A', '族1', 0.5, 'S', '族1')];
    const child = [makeInput('A', '族1', 0.5, 'S', '族1'), makeInput('B', '族2', 0.3, 'S', '族2')];
    const rels = inferHarnessRelations(parent, child, pid);
    expect(rels.some(r => r.harnessId === 'B' && r.relationType === 'added')).toBe(true);
  });

  it('should detect cancelled harness', () => {
    const parent = [makeInput('A', '族1', 0.5, 'S', '族1'), makeInput('B', '族2', 0.3, 'S', '族2')];
    const child = [makeInput('A', '族1', 0.5, 'S', '族1')];
    const rels = inferHarnessRelations(parent, child, pid);
    expect(rels.some(r => r.harnessId === 'B' && r.relationType === 'cancelled')).toBe(true);
  });

  it('should detect replaces/replaced_by in same slot', () => {
    const parent = [makeInput('OLD', '压缩机', 0.5, 'S', '压缩机')];
    const child = [makeInput('NEW', '压缩机', 0.5, 'S', '压缩机')];
    const rels = inferHarnessRelations(parent, child, pid);
    expect(rels.some(r => r.harnessId === 'NEW' && r.relationType === 'replaces')).toBe(true);
    expect(rels.some(r => r.harnessId === 'OLD' && r.relationType === 'replaced_by')).toBe(true);
  });

  it('should detect config_changed (S→O)', () => {
    const parent = [makeInput('A', '族1', 0.5, 'S', '族1')];
    const child = [makeInput('A', '族1', 0.5, 'O', '族1')];
    const rels = inferHarnessRelations(parent, child, pid);
    expect(rels.some(r => r.harnessId === 'A' && r.relationType === 'config_changed')).toBe(true);
  });

  it('should detect split_from when slot grows', () => {
    const parent = [makeInput('A', '母线', 0.7, 'S', '母线')];
    const child = [makeInput('A', '母线', 0.4, 'S', '母线'), makeInput('B', '母线', 0.3, 'S', '母线')];
    const rels = inferHarnessRelations(parent, child, pid);
    expect(rels.some(r => r.harnessId === 'B' && r.relationType === 'split_from')).toBe(true);
  });
});

describe('validateRelations', () => {
  const pid = 'parent-001';

  it('should warn REL-001 when replacement ratio differs', () => {
    const parent = [makeInput('OLD', '族1', 0.5, 'S', '族1')];
    const child = [makeInput('NEW', '族1', 0.3, 'S', '族1')];
    const rels = inferHarnessRelations(parent, child, pid);
    const risks = validateRelations(rels, parent, child);
    expect(risks.some(r => r.code === 'REL-001')).toBe(true);
  });

  it('should warn REL-003 for cancelled harness', () => {
    const parent = [makeInput('A', '族1', 0.5, 'S', '族1')];
    const rels = inferHarnessRelations(parent, [], pid);
    const risks = validateRelations(rels, parent, []);
    expect(risks.some(r => r.code === 'REL-003')).toBe(true);
  });

  it('should warn REL-005 when S→O without ratio decrease', () => {
    const parent = [makeInput('A', '族1', 0.5, 'S', '族1')];
    const child = [makeInput('A', '族1', 0.5, 'O', '族1')];
    const rels = inferHarnessRelations(parent, child, pid);
    const risks = validateRelations(rels, parent, child);
    expect(risks.some(r => r.code === 'REL-005')).toBe(true);
  });

  it('should warn REL-002 when split ratios do not sum to parent', () => {
    const parent = [makeInput('A', '母线', 0.7, 'S', '母线')];
    const child = [makeInput('A', '母线', 0.3, 'S', '母线'), makeInput('B', '母线', 0.2, 'S', '母线')];
    const rels = inferHarnessRelations(parent, child, pid);
    const risks = validateRelations(rels, parent, child);
    expect(risks.some(r => r.code === 'REL-002')).toBe(true);
  });
});

describe('generateConfigTrackingItems', () => {
  it('should generate tracking items for warning/error risks', () => {
    const risks = detectConfigRisks(E281_HARNESSES);
    const items = generateConfigTrackingItems('e281', risks, []);
    expect(items.length).toBeGreaterThan(0);
    expect(items.every(i => i.category === 'config_change')).toBe(true);
    expect(items.every(i => i.status === 'open')).toBe(true);
  });

  it('should generate tracking item for added harness', () => {
    const rels = [{ harnessId: 'NEW', relationType: 'added' as const, targetHarnessId: null, targetScenarioId: 'p1' }];
    const items = generateConfigTrackingItems('e281', [], rels);
    expect(items.length).toBe(1);
    expect(items[0]!.harnessId).toBe('NEW');
  });

  it('should not generate tracking items for info-only risks', () => {
    const infoOnly = [makeInput('A', '族1', 0.5, undefined, '测试'), makeInput('B', '族1', 0.5, undefined, '测试')];
    const risks = detectConfigRisks(infoOnly);
    const items = generateConfigTrackingItems('test', risks, []);
    expect(items.length).toBe(0);
  });
});

describe('detectVehicleConfigRisks', () => {
  const configs: VehicleConfig[] = [
    { configId: 'c1', configName: '520启航版', salesRatio: 0.525, harnessIds: ['6608491523', '6608442964', '6608442966'] },
    { configId: 'c2', configName: '520Pro', salesRatio: 0.105, harnessIds: ['6608491524', '6608519100', '6608442965'] },
    { configId: 'c3', configName: '52.4(无PTC)', salesRatio: 0.225, harnessIds: ['6608442962', '6608516992', '6608507680'] },
    { configId: 'c4', configName: '52.4(带PTC)', salesRatio: 0.04, harnessIds: ['6608442962', '6608442963', '6608507680'] },
    { configId: 'c5', configName: '前驱版', salesRatio: 0.105, harnessIds: ['6608544875', '6608519100', '6608442965'] },
  ];

  it('should detect CFG-006 when salesRatio sum != 1.0', () => {
    const bad: VehicleConfig[] = [
      { configId: 'c1', configName: 'A', salesRatio: 0.5, harnessIds: ['X'] },
      { configId: 'c2', configName: 'B', salesRatio: 0.3, harnessIds: ['Y'] },
    ];
    const risks = detectVehicleConfigRisks(bad, [makeInput('X', '族1', 0.5, 'S', '族1'), makeInput('Y', '族2', 0.3, 'S', '族2')]);
    expect(risks.some(r => r.code === 'CFG-006')).toBe(true);
  });

  it('should not trigger CFG-006 when salesRatio sum = 1.0', () => {
    const risks = detectVehicleConfigRisks(configs, E281_HARNESSES);
    expect(risks.some(r => r.code === 'CFG-006')).toBe(false);
  });

  it('should detect CFG-007 when inferred ratio differs from manual', () => {
    const cfgs: VehicleConfig[] = [
      { configId: 'c1', configName: 'A', salesRatio: 0.6, harnessIds: ['6608491523'] },
      { configId: 'c2', configName: 'B', salesRatio: 0.4, harnessIds: ['6608491524'] },
    ];
    // 6608491523 manual ratio=0.525, inferred=0.6
    const risks = detectVehicleConfigRisks(cfgs, E281_HARNESSES);
    expect(risks.some(r => r.code === 'CFG-007' && r.harnessIds.includes('6608491523'))).toBe(true);
  });

  it('should detect CFG-008 for unreferenced harness', () => {
    const cfgs: VehicleConfig[] = [
      { configId: 'c1', configName: 'A', salesRatio: 1.0, harnessIds: ['6608491523'] },
    ];
    const risks = detectVehicleConfigRisks(cfgs, E281_HARNESSES);
    const cfg008 = risks.filter(r => r.code === 'CFG-008');
    expect(cfg008.length).toBe(10); // 11 harnesses - 1 referenced = 10
  });

  it('should return empty for empty vehicleConfigs', () => {
    const risks = detectVehicleConfigRisks([], E281_HARNESSES);
    expect(risks.length).toBe(0);
  });
});
