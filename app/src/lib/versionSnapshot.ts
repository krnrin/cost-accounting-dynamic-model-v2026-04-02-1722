/**
 * [成本核算数据原则] 必须传入 internalRates，禁止回退到硬编码默认值
 */
import { computeInternalHarnessCost, computeInternalProjectFromHarnesses, mapInternalProjectToProjectHarnessResult } from '@/engine/harness_costing';
import type { HarnessInput, ProjectHarnessResult } from '@/types/harness';
import type { MetalPrices, ProjectConfig, VolumeSchedule, InternalCostRates } from '@/types/project';
import type { VersionSnapshot } from '@/types/version';

export interface ProjectVersionSource {
  id: string;
  projectCode?: string;
  projectName?: string;
  costRates?: ProjectConfig['costRates'];
  metalPrices?: MetalPrices;
  volumes?: VolumeSchedule[];
  /** [成本核算数据原则] 必须传入真实费率配置 */
  internalRates?: InternalCostRates;
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
    internalRates: project?.internalRates,
  };
}

/**
 * [成本核算数据原则] 必须传入 internalRates，禁止回退到硬编码默认值
 */
export function buildVersionSnapshot(project: ProjectVersionSource | null, harnesses: HarnessVersionSource[]): VersionSnapshot {
  const config = normalizeProjectConfig(project);

  if (!project?.internalRates) {
    throw new Error(
      '[成本核算] buildVersionSnapshot 缺少 internalRates 配置。' +
      '必须传入真实费率配置，禁止使用硬编码默认值。'
    );
  }

  // 此时 internalRates 已确认存在
  const internalRates = project.internalRates;
  const results = harnesses.map((harness) => computeInternalHarnessCost(harness.input, internalRates, config.metalPrices));
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

/**
 * [成本核算数据原则] 必须传入 internalRates，禁止回退到硬编码默认值
 */
export function computeProjectResultFromSnapshot(snapshot: VersionSnapshot): ProjectHarnessResult {
  if (!snapshot.config?.internalRates) {
    throw new Error(
      '[成本核算] computeProjectResultFromSnapshot 缺少 internalRates 配置。' +
      '快照必须包含真实费率配置，禁止使用硬编码默认值。'
    );
  }

  // 此时 internalRates 已确认存在
  const internalRates = snapshot.config.internalRates;
  const harnesses = snapshot.harnesses.map((harness) =>
    computeInternalHarnessCost(harness.input, internalRates, snapshot.config.metalPrices),
  );
  return mapInternalProjectToProjectHarnessResult(harnesses);
}
