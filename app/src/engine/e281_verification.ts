import { computeChangePricing } from './change_pricing';
import {
  applyInstallationRatiosToHarnessInputs,
} from './configuration_model';
import { computeHarnessCost, computeProjectFromHarnesses } from './harness_costing';
import {
  deepCompareScenarios,
  type ScenarioCompareInput,
  type DeepCompareResult,
} from './scenario_deep_compare';
import {
  buildDecisionSummary,
  type CostFactor,
  type DecisionSummary,
} from './shapley_attribution';
import type { HarnessInput, HarnessResult, ProjectHarnessResult } from '@/types/harness';
import type { ChangePricingResult } from '@/types/quote';
import type {
  E281HarnessExpectation,
  E281ScenarioPayload,
  ScenarioVerificationReport,
  ScenarioVerificationReportCheck,
} from '@/data/seeds/e281ScenarioPayload';

/** 验证阈值配置 */
export interface VerificationThresholds {
  /** 绝对差值失败阈值 (默认 0.1) */
  absDeltaFail: number;
  /** 绝对差值警告阈值 (默认 0.01) */
  absDeltaWarn: number;
  /** 百分比差值失败阈值 (默认 5%) */
  absDeltaPercentFail: number;
  /** 百分比差值警告阈值 (默认 0.5%) */
  absDeltaPercentWarn: number;
}

/** 默认验证阈值 */
export const DEFAULT_VERIFICATION_THRESHOLDS: VerificationThresholds = {
  absDeltaFail: 0.1,
  absDeltaWarn: 0.01,
  absDeltaPercentFail: 5,
  absDeltaPercentWarn: 0.5,
};

export interface E281ScenarioComputation {
  payload: E281ScenarioPayload;
  inputs: HarnessInput[];
  harnessResults: HarnessResult[];
  projectResult: ProjectHarnessResult;
  scenarioCompareInput: ScenarioCompareInput;
}

export interface E281ScenarioComparisonResult {
  base: E281ScenarioComputation;
  compare: E281ScenarioComputation;
  deepCompare: DeepCompareResult;
  changePricing: ChangePricingResult;
  factors: CostFactor[];
  decisionSummary: DecisionSummary;
  reasonSummary: string[];
}

const COST_FACTOR_CATEGORY_MAP: Record<string, CostFactor['category']> = {
  materialCost: 'material',
  laborCost: 'labor',
  overheadCost: 'overhead',
  packagingCost: 'packaging',
  managementFee: 'management',
  metalCost: 'metal',
  nreCostPerSet: 'nre',
  scrapCost: 'scrap',
};

function toDeltaPercent(actual: number, expected: number): number {
  if (expected === 0) return actual === 0 ? 0 : 100;
  return ((actual - expected) / Math.abs(expected)) * 100;
}

function classifyCheck(
  actual: number,
  expected: number,
  label: string,
  key: string,
  thresholds: VerificationThresholds = DEFAULT_VERIFICATION_THRESHOLDS,
): ScenarioVerificationReportCheck {
  const delta = actual - expected;
  const deltaPercent = toDeltaPercent(actual, expected);
  const absDelta = Math.abs(delta);
  const absDeltaPercent = Math.abs(deltaPercent);

  let status: ScenarioVerificationReportCheck['status'] = 'pass';
  if (absDelta > thresholds.absDeltaFail || absDeltaPercent > thresholds.absDeltaPercentFail) {
    status = 'fail';
  } else if (absDelta > thresholds.absDeltaWarn || absDeltaPercent > thresholds.absDeltaPercentWarn) {
    status = 'warn';
  }

  return {
    key,
    label,
    status,
    expected,
    actual,
    delta,
    deltaPercent,
  };
}

function buildCostBreakdown(project: ProjectHarnessResult) {
  return {
    materialCost: project.weightedMaterial,
    laborCost: project.weightedLabor,
    overheadCost: project.weightedMfg,
    packagingCost: project.weightedPack + project.weightedFreight,
    managementFee: project.weightedMgmtFee,
    scrapCost: project.weightedWaste,
    metalCost: project.weightedCopperWeight + project.weightedAluminumWeight,
    nreCostPerSet: 0,
  };
}

function buildScenarioCompareInput(payload: E281ScenarioPayload, project: ProjectHarnessResult): ScenarioCompareInput {
  const costBreakdown = buildCostBreakdown(project);

  // Calculate total annual volume for lifecycle calculations
  const totalVolume = payload.project.config.volumes.reduce((sum, v) => sum + v.volume, 0);
  // lifecycleYears used for future extension; currently not needed in baseline
  // const lifecycleYears = payload.project.meta.lifecycleYears || 6;

  // Get selling price from customerQuoteSnapshots if available
  // customerQuoteSnapshots is keyed by harnessId, we need weighted average
  const snapshots = payload.project.config.customerQuoteSnapshots || {};
  const snapshotEntries = Object.entries(snapshots);

  let sellingPricePerSet = project.vehicleCost; // fallback to cost

  if (snapshotEntries.length > 0) {
    // Calculate weighted average selling price from customer quote snapshots
    // Use deliveredPrice as the primary selling price reference
    let totalWeightedPrice = 0;
    let totalRatio = 0;

    for (const [harnessId, snapshot] of snapshotEntries) {
      const harness = payload.harnesses.find(h => h.harnessId === harnessId);
      const ratio = harness?.input?.vehicleRatio || 0;
      const price = snapshot.deliveredPrice || snapshot.exFactoryPrice || 0;
      if (price > 0 && ratio > 0) {
        totalWeightedPrice += price * ratio;
        totalRatio += ratio;
      }
    }

    if (totalRatio > 0 && totalWeightedPrice > 0) {
      sellingPricePerSet = totalWeightedPrice / totalRatio;
    }
  }

  // Calculate margin rate: (sellingPrice - cost) / sellingPrice
  const marginRate = sellingPricePerSet > 0
    ? (sellingPricePerSet - project.vehicleCost) / sellingPricePerSet
    : 0;

  // Calculate lifecycle profit: (sellingPrice - cost) * total volume
  const lifecycleProfit = (sellingPricePerSet - project.vehicleCost) * totalVolume;

  return {
    scenarioId: payload.mode,
    scenarioName: payload.scenario.scenarioName,
    status: payload.scenario.scenarioType,
    kpis: {
      totalCostPerSet: project.vehicleCost,
      sellingPricePerSet,
      marginRate,
      lifecycleProfit,
      vehicleCostPerSet: project.vehicleCost,
      totalHarnesses: project.harnessCount,
    },
    costBreakdown,
  };
}

function buildInputChecks(payload: E281ScenarioPayload): ScenarioVerificationReportCheck[] {
  const checks: ScenarioVerificationReportCheck[] = [
    {
      key: 'lifecycleYears',
      label: 'lifecycleYears',
      status: payload.project.meta.lifecycleYears === 6 ? 'pass' : 'fail',
      expected: 6,
      actual: payload.project.meta.lifecycleYears,
    },
    {
      key: 'volumeTotal',
      label: 'volume total',
      status: payload.project.config.volumes.reduce((sum, item) => sum + item.volume, 0) === 600000 ? 'pass' : 'fail',
      expected: 600000,
      actual: payload.project.config.volumes.reduce((sum, item) => sum + item.volume, 0),
    },
    {
      key: 'harnessCount',
      label: 'harness count',
      status: payload.harnesses.length === 11 ? 'pass' : 'fail',
      expected: 11,
      actual: payload.harnesses.length,
    },
  ];

  const cm030 = payload.scenario.configSkus.find((item) => item.skuId === 'cm030');
  if (payload.mode === 'quote_raw') {
    checks.push({
      key: 'cm030OptionalRatio',
      label: 'CM030 optional ratio',
      status: cm030?.ptcOptionalRatio === 0.3 ? 'pass' : 'fail',
      expected: 0.3,
      actual: cm030?.ptcOptionalRatio ?? 0,
    });
  } else {
    checks.push({
      key: 'cm030OptionalRatio',
      label: 'CM030 optional ratio',
      status: cm030?.ptcOptionalRatio === 0 ? 'pass' : 'fail',
      expected: 0,
      actual: cm030?.ptcOptionalRatio ?? 0,
    });
    checks.push({
      key: 'annualDropRate',
      label: 'annualDropRate',
      status: payload.project.config.annualDropRate === 0.03 ? 'pass' : 'fail',
      expected: 0.03,
      actual: payload.project.config.annualDropRate,
    });
  }

  return checks;
}

function buildHarnessChecks(
  payload: E281ScenarioPayload,
  actualResults: HarnessResult[],
  thresholds?: VerificationThresholds,
): ScenarioVerificationReportCheck[] {
  if (payload.expectedHarnessResults.length === 0) {
    return [];
  }

  const actualById = new Map(actualResults.map((item) => [item.harnessId, item]));
  const checks: ScenarioVerificationReportCheck[] = [];

  for (const expected of payload.expectedHarnessResults) {
    const actual = actualById.get(expected.harnessId);
    if (!actual) {
      checks.push({
        key: `${expected.harnessId}:missing`,
        label: `${expected.harnessId} missing result`,
        status: 'fail',
        message: 'Harness result was not generated.',
      });
      continue;
    }

    checks.push(classifyCheck(actual.materialCost, expected.materialCost, `${expected.harnessId} materialCost`, `${expected.harnessId}:materialCost`, thresholds));
    checks.push(classifyCheck(actual.exFactoryPrice, expected.exFactoryPrice, `${expected.harnessId} exFactoryPrice`, `${expected.harnessId}:exFactoryPrice`, thresholds));
    checks.push(classifyCheck(actual.deliveredPrice, expected.deliveredPrice, `${expected.harnessId} deliveredPrice`, `${expected.harnessId}:deliveredPrice`, thresholds));
  }

  return checks;
}

function buildProjectChecks(
  payload: E281ScenarioPayload,
  projectResult: ProjectHarnessResult,
  thresholds?: VerificationThresholds,
): ScenarioVerificationReportCheck[] {
  if (!payload.expectedProjectResults) {
    return [];
  }

  return [
    classifyCheck(projectResult.vehicleCost, payload.expectedProjectResults.vehicleCost, 'project vehicleCost', 'project:vehicleCost', thresholds),
    classifyCheck(projectResult.weightedMaterial, payload.expectedProjectResults.weightedMaterial, 'project weightedMaterial', 'project:weightedMaterial', thresholds),
    classifyCheck(projectResult.weightedExFactory, payload.expectedProjectResults.weightedExFactory, 'project weightedExFactory', 'project:weightedExFactory', thresholds),
  ];
}

function buildRawReasonAnalysis(
  payload: E281ScenarioPayload,
  harnessChecks: ScenarioVerificationReportCheck[],
): string[] {
  const reasons = [...payload.verificationNotes];
  const failedChecks = harnessChecks.filter((item) => item.status === 'fail');

  const cm030OptionalMappings = payload.scenario.harnessConfigMappings.filter(
    (item) => item.skuId === 'cm030' && item.sliceType === 'optional',
  );
  if (cm030OptionalMappings.length === 0) {
    reasons.push('CM030 still has an optional slice in the raw quote model, but no harness mapping consumes that optional slice. This is the direct signal of the ghost 4.5% allocation problem.');
  }

  const frontDriveHarness = payload.harnesses.find((item) => item.harnessId === '6608544875');
  if ((frontDriveHarness?.input.vehicleRatio || 0) > 0) {
    reasons.push('Harness 6608544875 still carries a non-zero ratio in the raw quote model. This keeps the front-drive direct busbar inside an RWD-only family and is expected to distort comparison output.');
  }

  if (failedChecks.length > 0) {
    reasons.push(`The engine diverges from the raw workbook on ${failedChecks.length} harness-level checkpoints. See the JSON report for exact deltas by harness and metric.`);
  }

  return reasons;
}

function buildCorrectedReasonAnalysis(payload: E281ScenarioPayload): string[] {
  const reasons = [...payload.verificationNotes];
  if (payload.mutationRecipe) {
    reasons.push(
      ...payload.mutationRecipe.steps.map((step) => (
        `${step.target}: ${step.before} -> ${step.after}. ${step.reason}`
      )),
    );
  }
  return reasons;
}

function summarizeStatus(checks: ScenarioVerificationReportCheck[]): ScenarioVerificationReport['status'] {
  if (checks.some((item) => item.status === 'fail')) return 'fail';
  if (checks.some((item) => item.status === 'warn')) return 'warn';
  return 'pass';
}

export function computeE281Scenario(payload: E281ScenarioPayload): E281ScenarioComputation {
  const inputs = applyInstallationRatiosToHarnessInputs(
    payload.harnesses.map((item) => structuredClone(item.input)),
    payload.scenario.vehicleConfigs,
    payload.scenario.harnessConfigMappings,
  );
  const harnessResults = inputs.map((input) => (
    computeHarnessCost(input, payload.scenario.config.costRates, payload.scenario.config.metalPrices)
  ));
  const projectResult = computeProjectFromHarnesses(harnessResults);

  return {
    payload,
    inputs,
    harnessResults,
    projectResult,
    scenarioCompareInput: buildScenarioCompareInput(payload, projectResult),
  };
}

export function verifyE281ScenarioPayload(payload: E281ScenarioPayload): ScenarioVerificationReport {
  const computation = computeE281Scenario(payload);
  const inputChecks = buildInputChecks(payload);
  const harnessChecks = buildHarnessChecks(payload, computation.harnessResults);
  const projectChecks = buildProjectChecks(payload, computation.projectResult);
  const allChecks = [...inputChecks, ...harnessChecks, ...projectChecks];

  return {
    mode: payload.mode,
    generatedAt: new Date().toISOString(),
    status: summarizeStatus(allChecks),
    inputChecks,
    harnessChecks,
    projectChecks,
    reasonAnalysis: payload.mode === 'quote_raw'
      ? buildRawReasonAnalysis(payload, harnessChecks)
      : buildCorrectedReasonAnalysis(payload),
  };
}

export function buildComparisonFactors(base: E281ScenarioComputation, compare: E281ScenarioComputation): CostFactor[] {
  const baseBreakdown = base.scenarioCompareInput.costBreakdown;
  const compareBreakdown = compare.scenarioCompareInput.costBreakdown;

  return Object.entries(baseBreakdown).map(([key, baseValue]) => {
    const currentValue = compareBreakdown[key as keyof typeof compareBreakdown] ?? 0;
    return {
      id: key,
      name: key,
      category: COST_FACTOR_CATEGORY_MAP[key] ?? 'overhead',
      baseValue,
      currentValue,
      delta: currentValue - baseValue,
      deltaPercent: baseValue === 0 ? 0 : ((currentValue - baseValue) / Math.abs(baseValue)) * 100,
    } as CostFactor;
  });
}

export function compareE281ScenarioPayloads(
  basePayload: E281ScenarioPayload,
  comparePayload: E281ScenarioPayload,
): E281ScenarioComparisonResult {
  const base = computeE281Scenario(basePayload);
  const compare = computeE281Scenario(comparePayload);
  const deepCompare = deepCompareScenarios([base.scenarioCompareInput, compare.scenarioCompareInput]);
  const annualVolumes = comparePayload.project.config.volumes.map((item) => item.volume);
  const changePricing = computeChangePricing(
    base.projectResult,
    compare.projectResult,
    `${basePayload.mode}->${comparePayload.mode}`,
    {
      annualVolumes,
      lifecycleYears: comparePayload.project.meta.lifecycleYears,
    },
  );
  const factors = buildComparisonFactors(base, compare);
  const decisionSummary = buildDecisionSummary(factors);
  const reasonSummary = [
    ...comparePayload.verificationNotes,
    ...decisionSummary.insights.slice(0, 3).map((item) => `${item.title}: ${item.description}`),
  ];

  return {
    base,
    compare,
    deepCompare,
    changePricing,
    factors,
    decisionSummary,
    reasonSummary,
  };
}

export function findExpectedHarness(
  expectations: E281HarnessExpectation[],
  harnessId: string,
): E281HarnessExpectation | undefined {
  return expectations.find((item) => item.harnessId === harnessId);
}
