import type { OnetimeCostRecord, ScenarioRecord } from '@/data/db';
import {
  E281_CUSTOMER_QUOTE_SNAPSHOTS,
  E281_FINAL_QUOTE_ONETIME_COSTS,
  E281_HARNESS_SEED_DATA,
  E281_VEHICLE_CONFIGS,
} from '@/data/seeds/e281';
import type { VehicleConfig, VehicleConfigMeta } from '@/types/harness';
import type { ProjectConfig } from '@/types/project';
import type { OnetimeCostInput } from '@/engine/onetime_alloc';

const E281_PROJECT_ID = 'e281-quote';

type ScenarioFallbackSource = Pick<
  ScenarioRecord,
  'projectId' | 'config' | 'vehicleConfigs' | 'vehicleConfigMeta'
>;

function isE281Scenario(scenario: Pick<ScenarioRecord, 'projectId'> | null | undefined): boolean {
  return scenario?.projectId === E281_PROJECT_ID;
}

export function getScenarioCustomerQuoteSnapshots(
  scenario: Pick<ScenarioRecord, 'projectId' | 'config'> | null | undefined,
): ProjectConfig['customerQuoteSnapshots'] {
  if (scenario?.config?.customerQuoteSnapshots) {
    return scenario.config.customerQuoteSnapshots;
  }
  return isE281Scenario(scenario) ? E281_CUSTOMER_QUOTE_SNAPSHOTS : undefined;
}

export function getScenarioVehicleConfigs(
  scenario: Pick<ScenarioRecord, 'projectId' | 'vehicleConfigs'> | null | undefined,
): VehicleConfig[] {
  if (scenario?.vehicleConfigs?.length) {
    return scenario.vehicleConfigs;
  }
  return isE281Scenario(scenario) ? structuredClone(E281_VEHICLE_CONFIGS) : [];
}

export function getScenarioVehicleConfigMeta(
  scenario: Pick<ScenarioRecord, 'projectId' | 'vehicleConfigs' | 'vehicleConfigMeta'> | null | undefined,
): VehicleConfigMeta {
  if (scenario?.vehicleConfigMeta) {
    return scenario.vehicleConfigMeta;
  }
  if (isE281Scenario(scenario) && !scenario?.vehicleConfigs?.length) {
    return { publishState: 'sales_published' };
  }
  return { publishState: 'draft' };
}

export function applyE281ScenarioFallback<T extends ScenarioFallbackSource>(scenario: T): T {
  return {
    ...scenario,
    config: {
      ...scenario.config,
      customerQuoteSnapshots: getScenarioCustomerQuoteSnapshots(scenario),
    },
    vehicleConfigs: getScenarioVehicleConfigs(scenario),
    vehicleConfigMeta: getScenarioVehicleConfigMeta(scenario),
  };
}

export function getE281ScenarioOnetimeCostInputs(): OnetimeCostInput[] {
  return E281_HARNESS_SEED_DATA.map((seed) => ({
    harnessId: seed.harnessId,
    harnessName: seed.name,
    vehicleRatio: seed.ratio,
    ...E281_FINAL_QUOTE_ONETIME_COSTS[seed.harnessId as keyof typeof E281_FINAL_QUOTE_ONETIME_COSTS],
    paymentMode: 'amortized',
  }));
}

export function getScenarioOnetimeCostFallback(
  scenario: Pick<ScenarioRecord, 'id' | 'projectId'> | null | undefined,
): OnetimeCostRecord[] {
  if (!scenario || !isE281Scenario(scenario)) {
    return [];
  }

  return getE281ScenarioOnetimeCostInputs().map((input) => ({
    id: `${scenario.id}::${input.harnessId}`,
    projectId: scenario.projectId,
    scenarioId: scenario.id,
    harnessId: input.harnessId,
    harnessName: input.harnessName,
    vehicleRatio: input.vehicleRatio,
    input,
    updatedAt: '',
  }));
}

export function isE281ProjectId(projectId: string | null | undefined): boolean {
  return projectId === E281_PROJECT_ID;
}
