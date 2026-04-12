import type { OnetimeCostRecord, ProjectRecord, ScenarioRecord } from './db';
import type { VehicleConfigMeta } from '@/types/harness';
import {
  E281_CUSTOMER_QUOTE_SNAPSHOTS,
  E281_FINAL_QUOTE_ONETIME_COSTS,
  E281_HARNESS_SEED_DATA,
  E281_VEHICLE_CONFIGS,
} from './seeds/e281';
import type { OnetimeCostInput } from '@/engine/onetime_alloc';

const E281_PROJECT_ID = 'e281-quote';
const E281_PROJECT_CODE = 'E281';

function isE281Project(project?: Pick<ProjectRecord, 'id' | 'meta'> | null): boolean {
  if (!project) return false;
  return project.id === E281_PROJECT_ID || project.meta?.projectCode === E281_PROJECT_CODE;
}

function isE281Scenario(scenario?: Pick<ScenarioRecord, 'projectId'> | null): boolean {
  if (!scenario) return false;
  return scenario.projectId === E281_PROJECT_ID;
}

export function applyE281ScenarioFallback(scenario: ScenarioRecord): ScenarioRecord {
  if (!isE281Scenario(scenario)) {
    return scenario;
  }

  const customerQuoteSnapshots =
    scenario.config.customerQuoteSnapshots ?? E281_CUSTOMER_QUOTE_SNAPSHOTS;
  const vehicleConfigs = scenario.vehicleConfigs ?? structuredClone(E281_VEHICLE_CONFIGS);
  const vehicleConfigMeta =
    scenario.vehicleConfigMeta ?? { publishState: 'sales_published' as const };

  if (
    customerQuoteSnapshots === scenario.config.customerQuoteSnapshots &&
    vehicleConfigs === scenario.vehicleConfigs &&
    vehicleConfigMeta === scenario.vehicleConfigMeta
  ) {
    return scenario;
  }

  return {
    ...scenario,
    config: {
      ...scenario.config,
      customerQuoteSnapshots,
    },
    vehicleConfigs,
    vehicleConfigMeta,
  };
}

export function getScenarioCustomerQuoteSnapshots(
  project: Pick<ProjectRecord, 'id' | 'meta' | 'config'> | null | undefined,
  scenario: Pick<ScenarioRecord, 'projectId' | 'config'> | null | undefined,
) {
  return (
    scenario?.config?.customerQuoteSnapshots ??
    project?.config?.customerQuoteSnapshots ??
    ((isE281Scenario(scenario) || isE281Project(project))
      ? E281_CUSTOMER_QUOTE_SNAPSHOTS
      : undefined)
  );
}

export function getScenarioVehicleConfigs(
  scenario: Pick<ScenarioRecord, 'projectId' | 'vehicleConfigs'> | null | undefined,
  project?: Pick<ProjectRecord, 'id' | 'meta'> | null | undefined,
) {
  return (
    scenario?.vehicleConfigs ??
    ((isE281Scenario(scenario) || isE281Project(project))
      ? structuredClone(E281_VEHICLE_CONFIGS)
      : [])
  );
}

export function getScenarioVehicleConfigMeta(
  scenario: Pick<ScenarioRecord, 'projectId' | 'vehicleConfigMeta' | 'vehicleConfigs'> | null | undefined,
): VehicleConfigMeta {
  return (
    scenario?.vehicleConfigMeta ??
    (isE281Scenario(scenario)
      ? { publishState: 'sales_published' }
      : { publishState: 'draft' })
  );
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
