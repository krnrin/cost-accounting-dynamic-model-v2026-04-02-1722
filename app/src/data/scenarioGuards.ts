import type { ProjectConfig } from '@/types/project';
import type { OnetimeCostRecord, ScenarioRecord } from './db';

function hasRequiredConfig(config: ProjectConfig | undefined): config is ProjectConfig {
  return Boolean(
    config &&
      config.costRates &&
      config.metalPrices &&
      Array.isArray(config.volumes),
  );
}

export function requireScenarioRecord<
  T extends Pick<ScenarioRecord, 'id' | 'scenarioCode' | 'scenarioName'> | null | undefined,
>(
  scenario: T,
  context: string,
): NonNullable<T> {
  if (!scenario) {
    throw new Error(`${context}: scenario not found`);
  }

  return scenario as NonNullable<T>;
}

export function requireScenarioConfig(
  scenario: Pick<ScenarioRecord, 'id' | 'scenarioCode' | 'scenarioName' | 'config'> | null | undefined,
  context: string,
): ProjectConfig {
  const current = requireScenarioRecord(scenario, context);

  if (!hasRequiredConfig(current.config)) {
    throw new Error(
      `${context}: scenario ${current.scenarioCode || current.id} is missing required config; run migration or reseed data first`,
    );
  }

  return current.config;
}

export function hasScenarioVehicleConfigModel(
  scenario: Pick<ScenarioRecord, 'vehicleConfigs' | 'configSkus'> | null | undefined,
): boolean {
  return Boolean(
    (scenario?.vehicleConfigs?.length ?? 0) > 0
      || (scenario?.configSkus?.length ?? 0) > 0,
  );
}

export function requireScenarioOnetimeCosts(
  costs: OnetimeCostRecord[],
  scenarioId: string,
): OnetimeCostRecord[] {
  if (costs.length === 0) {
    throw new Error(`scenario ${scenarioId} has no persisted one-time cost data`);
  }

  return costs;
}
