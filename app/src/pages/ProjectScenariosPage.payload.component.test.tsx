import { describe, expect, it } from 'vitest';
import { canDeleteScenario, normalizeScenarioPayload } from './ProjectScenariosPage';

function makeForm(overrides: Partial<Parameters<typeof normalizeScenarioPayload>[0]> = {}) {
  return {
    type: 'initial_quote' as const,
    name: '  场景A  ',
    lifecycleYears: 5,
    volume: 1000,
    installRatio: 1,
    rateSnapshotVersion: 'latest',
    bomVersionRef: ' BOM-V1 ',
    notes: '  备注  ',
    sourceScenarioId: undefined,
    compareBaselineId: undefined,
    ...overrides,
  };
}

describe('normalizeScenarioPayload', () => {
  it('保留 latest 费率快照绑定', () => {
    const payload = normalizeScenarioPayload(makeForm());

    expect(payload.rateSnapshotVersion).toBe('latest');
    expect(payload.name).toBe('场景A');
    expect(payload.bomVersionRef).toBe('BOM-V1');
  });

  it('保留显式指定的已发布版本号', () => {
    const payload = normalizeScenarioPayload(makeForm({
      rateSnapshotVersion: 'settings-2026-04-12_09-00-00-000',
    }));

    expect(payload.rateSnapshotVersion).toBe('settings-2026-04-12_09-00-00-000');
  });

  it('空字符串时不提交 rateSnapshotVersion', () => {
    const payload = normalizeScenarioPayload(makeForm({
      rateSnapshotVersion: '',
    }));

    expect(payload.rateSnapshotVersion).toBeUndefined();
  });
});

describe('canDeleteScenario', () => {
  it('only allows deleting draft child scenarios', () => {
    expect(canDeleteScenario({
      sourceScenarioId: 'parent-scenario',
      status: 'draft',
    })).toBe(true);
  });

  it('rejects root scenarios and non-draft scenarios', () => {
    expect(canDeleteScenario({
      sourceScenarioId: null,
      status: 'draft',
    })).toBe(false);
    expect(canDeleteScenario({
      sourceScenarioId: 'parent-scenario',
      status: 'released',
    })).toBe(false);
  });
});
