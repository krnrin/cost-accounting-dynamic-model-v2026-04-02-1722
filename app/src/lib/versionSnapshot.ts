import { computeInternalHarnessCost, computeInternalProjectFromHarnesses, INTERNAL_DEFAULTS, mapInternalProjectToProjectHarnessResult } from '@/engine/harness_costing';
import type { HarnessInput, ProjectHarnessResult } from '@/types/harness';
import type { MetalPrices, ProjectConfig, VolumeSchedule } from '@/types/project';
import type { VersionSnapshot } from '@/types/version';

export interface ProjectVersionSource {
  id: string;
  projectCode?: string;
  projectName?: string;
  costRates?: ProjectConfig['costRates'];
  metalPrices?: MetalPrices;
  volumes?: VolumeSchedule[];
}

export interface HarnessVersionSource {
  id: string;
  harnessId: string;
  harnessName: string;
  input: HarnessInput;
}

const DEFAULT_METAL_PRICES: MetalPrices = {
  copper: 65000,
  aluminum: 18000,
};

export function normalizeProjectConfig(project: ProjectVersionSource | null): ProjectConfig {
  return {
    costRates: project?.costRates ?? ({} as ProjectConfig['costRates']),
    metalPrices: project?.metalPrices ?? DEFAULT_METAL_PRICES,
    volumes: Array.isArray(project?.volumes) ? project.volumes : [],
    annualDropRate: 0,
  };
}

export function buildVersionSnapshot(project: ProjectVersionSource | null, harnesses: HarnessVersionSource[]): VersionSnapshot {
  const config = normalizeProjectConfig(project);
  const results = harnesses.map((harness) => computeInternalHarnessCost(harness.input, INTERNAL_DEFAULTS, config.metalPrices));
  const summary = computeInternalProjectFromHarnesses(results);

  return {
    harnesses: harnesses.map((harness) => ({
      harnessId: harness.harnessId,
      harnessName: harness.harnessName,
      input: harness.input,
    })),
    config,
    summary: {
      vehicleCost: summary.vehicleCost,
      totalMaterial: summary.weightedMaterial,
      totalLabor: summary.weightedDirectLabor,
      harnessCount: harnesses.length,
    },
  };
}

export function computeProjectResultFromSnapshot(snapshot: VersionSnapshot): ProjectHarnessResult {
  const harnesses = snapshot.harnesses.map((harness) =>
    computeInternalHarnessCost(harness.input, INTERNAL_DEFAULTS, snapshot.config.metalPrices),
  );
  return mapInternalProjectToProjectHarnessResult(harnesses);
}
