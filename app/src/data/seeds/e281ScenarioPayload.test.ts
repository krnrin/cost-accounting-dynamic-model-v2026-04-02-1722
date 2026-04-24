import { describe, expect, it } from 'vitest';
import {
  E281_AWARD_CORRECTED_MUTATION_RECIPE,
  buildE281ScenarioImportPayload,
  buildE281ScenarioPayload,
} from './e281ScenarioPayload';

describe('buildE281ScenarioPayload', () => {
  it('builds the raw quote payload with the CM030 ghost optional slice preserved', () => {
    const payload = buildE281ScenarioPayload('quote_raw');

    expect(payload.project.meta.status).toBe('quoted');
    expect(payload.scenario.scenarioType).toBe('final_quote');
    expect(payload.scenario.config.annualDropRate).toBe(0.02);
    expect(payload.scenario.config.rebate).toBeUndefined();
    expect(payload.scenario.configSkus).toHaveLength(4);
    expect(payload.scenario.vehicleConfigs).toHaveLength(8);
    expect(payload.scenario.configSkus.find((item) => item.skuId === 'cm030')?.ptcOptionalRatio).toBe(0.3);
    expect(payload.scenario.harnessConfigMappings.some((item) => item.harnessId === '6608544875')).toBe(true);
    expect(payload.harnesses.find((item) => item.harnessId === '6608491524')?.input.vehicleRatio).toBe(0.105);
    expect(payload.harnesses.find((item) => item.harnessId === '6608544875')?.input.vehicleRatio).toBe(0.105);
    expect(
      payload.harnesses
        .find((item) => item.harnessId === '6608516992')
        ?.input.bom.some((row) => row.partNo === '1-2509498-1'),
    ).toBe(false);
    expect(payload.expectedHarnessResults).toHaveLength(11);
    expect(payload.expectedProjectResults?.harnessCount).toBe(11);
  });

  it('builds the corrected award payload with the audited CM030 fix, 3% annual drop, and rebate', () => {
    const payload = buildE281ScenarioPayload('award_corrected');

    expect(payload.project.meta.status).toBe('awarded');
    expect(payload.scenario.scenarioType).toBe('customer_award');
    expect(payload.scenario.config.annualDropRate).toBe(0.03);
    expect(payload.scenario.config.rebate?.totalAmount).toBe(10000000);
    expect(payload.scenario.vehicleConfigs).toHaveLength(7);
    expect(payload.scenario.configSkus.find((item) => item.skuId === 'cm030')?.ptcOptionalRatio).toBe(0);
    expect(payload.harnesses.find((item) => item.harnessId === '6608491524')?.input.vehicleRatio).toBe(0.15);
    expect(payload.harnesses.find((item) => item.harnessId === '6608544875')?.input.vehicleRatio).toBe(0);
    expect(
      payload.harnesses
        .find((item) => item.harnessId === '6608516992')
        ?.input.bom.some((row) => row.partNo === '1-2509498-1'),
    ).toBe(true);
    expect(payload.mutationRecipe).toEqual(E281_AWARD_CORRECTED_MUTATION_RECIPE);
  });

  it('builds import payloads that stay aligned with the scenario payload definitions', () => {
    const rawImport = buildE281ScenarioImportPayload('quote_raw');
    const correctedImport = buildE281ScenarioImportPayload('award_corrected', false);

    expect(rawImport.project.meta.projectCode).toBe('E281');
    expect(rawImport.scenario.vehicleConfigs).toHaveLength(8);
    expect(rawImport.harnesses).toHaveLength(11);
    expect(rawImport.allocationRows).toHaveLength(11);

    expect(correctedImport.overwriteProjectMeta).toBe(false);
    expect(correctedImport.scenario.config.annualDropRate).toBe(0.03);
    expect(correctedImport.scenario.vehicleConfigs).toHaveLength(7);
  });
});
