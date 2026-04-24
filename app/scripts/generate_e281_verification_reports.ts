import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { buildE281ScenarioPayload } from '../src/data/seeds/e281ScenarioPayload';
import {
  compareE281ScenarioPayloads,
  verifyE281ScenarioPayload,
} from '../src/engine/e281_verification';

interface ManualVerificationArtifact {
  projectId: string;
  quoteScenarioId: string;
  awardScenarioId: string;
  verification: {
    harnessChecks: Array<{
      harnessId: string;
      expectedMaterialCost: number;
      actualMaterialCost: number | null;
      materialDelta: number | null;
      expectedDeliveredPrice: number;
      actualDeliveredPrice: number | null;
      deliveredDelta: number | null;
    }>;
    project: {
      vehicleCost: number;
      weightedMaterial: number;
      weightedExFactory: number;
      weightedDelivered?: number;
      harnessCount: number;
    };
    bomDebug?: Record<string, unknown>;
  };
}

function formatTimestamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function summarizeUiVerification(artifact: ManualVerificationArtifact, expectedVehicleCost: number) {
  const harnessFailures = artifact.verification.harnessChecks.filter((item) => (
    Math.abs(item.materialDelta ?? 0) >= 0.05 || Math.abs(item.deliveredDelta ?? 0) >= 0.05
  ));
  const projectVehicleDelta = artifact.verification.project.vehicleCost - expectedVehicleCost;

  return {
    status: harnessFailures.length === 0 && Math.abs(projectVehicleDelta) < 0.05 ? 'pass' : 'fail',
    harnessFailureCount: harnessFailures.length,
    projectVehicleDelta,
    harnessFailures,
  } as const;
}

function translateFactorName(id: string) {
  const map: Record<string, string> = {
    materialCost: '材料成本',
    laborCost: '人工成本',
    overheadCost: '制造费用',
    packagingCost: '包装物流',
    managementFee: '管理费',
    metalCost: '金属基价',
    scrapCost: '废品成本',
    nreCostPerSet: '一次性费用',
  };
  return map[id] ?? id;
}

function buildAwardReasonSummary(
  mutationSteps: NonNullable<ReturnType<typeof buildE281ScenarioPayload>['mutationRecipe']>['steps'],
  factors: ReturnType<typeof compareE281ScenarioPayloads>['factors'],
) {
  const businessReasons = mutationSteps.map((step) => (
    `${step.target}: ${step.before} -> ${step.after}；${step.reason}`
  ));
  const factorReasons = factors
    .slice()
    .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))
    .slice(0, 3)
    .map((factor) => (
      `${translateFactorName(factor.id)} 变化 ${factor.delta.toFixed(3)}，占比 ${factor.deltaPercent.toFixed(2)}%`
    ));
  return [...businessReasons, ...factorReasons];
}

async function main() {
  const quotePayload = buildE281ScenarioPayload('quote_raw');
  const awardPayload = buildE281ScenarioPayload('award_corrected');

  const quoteEngineReport = verifyE281ScenarioPayload(quotePayload);
  const awardEngineReport = verifyE281ScenarioPayload(awardPayload);
  const comparison = compareE281ScenarioPayloads(quotePayload, awardPayload);

  const manualVerificationPath = path.resolve(
    process.cwd(),
    '..',
    'output',
    'playwright',
    'e281-manual-flow',
    'manual-quote-ui-verification.json',
  );
  const manualVerification = JSON.parse(
    await readFile(manualVerificationPath, 'utf8'),
  ) as ManualVerificationArtifact;

  const uiSummary = summarizeUiVerification(
    manualVerification,
    quotePayload.expectedProjectResults?.vehicleCost ?? 0,
  );

  const outputDir = path.resolve(
    process.cwd(),
    '..',
    'output',
    'e281-verification',
    formatTimestamp(),
  );
  await mkdir(outputDir, { recursive: true });

  const quoteReport = {
    mode: 'quote_raw',
    generatedAt: new Date().toISOString(),
    engineVerification: quoteEngineReport,
    uiVerification: manualVerification.verification,
    uiSummary,
    expectedProjectResults: quotePayload.expectedProjectResults,
  };

  const awardReasonSummary = buildAwardReasonSummary(
    awardPayload.mutationRecipe?.steps ?? [],
    comparison.factors,
  );

  const awardReport = {
    mode: 'award_corrected',
    generatedAt: new Date().toISOString(),
    engineVerification: awardEngineReport,
    comparisonSummary: {
      reasonSummary: awardReasonSummary,
      topFactors: comparison.factors
        .slice()
        .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))
        .slice(0, 5),
      baseVehicleCost: comparison.base.projectResult.vehicleCost,
      compareVehicleCost: comparison.compare.projectResult.vehicleCost,
      deltaVehicleCost: comparison.compare.projectResult.vehicleCost - comparison.base.projectResult.vehicleCost,
    },
    mutationRecipe: awardPayload.mutationRecipe,
  };

  const releaseReadinessReport = `# E281 Release Readiness Report

- Generated at: ${new Date().toISOString()}
- Quote raw engine verification: ${quoteEngineReport.status}
- Quote raw UI verification: ${uiSummary.status}
- Award corrected engine verification: ${awardEngineReport.status}
- Quote scenario id: ${manualVerification.quoteScenarioId}
- Award scenario id: ${manualVerification.awardScenarioId}

## Quote Raw

- Expected vehicle cost: ${(quotePayload.expectedProjectResults?.vehicleCost ?? 0).toFixed(6)}
- Actual vehicle cost: ${manualVerification.verification.project.vehicleCost.toFixed(6)}
- Vehicle delta: ${uiSummary.projectVehicleDelta.toFixed(6)}
- Harness failures over tolerance: ${uiSummary.harnessFailureCount}

## Award Corrected

- Base vehicle cost: ${comparison.base.projectResult.vehicleCost.toFixed(6)}
- Award vehicle cost: ${comparison.compare.projectResult.vehicleCost.toFixed(6)}
- Vehicle delta: ${(comparison.compare.projectResult.vehicleCost - comparison.base.projectResult.vehicleCost).toFixed(6)}

## Top Reason Summary

${awardReasonSummary.map((item) => `- ${item}`).join('\n')}
`;

  await writeFile(
    path.join(outputDir, 'quote-raw-report.json'),
    `${JSON.stringify(quoteReport, null, 2)}\n`,
    'utf8',
  );
  await writeFile(
    path.join(outputDir, 'award-corrected-report.json'),
    `${JSON.stringify(awardReport, null, 2)}\n`,
    'utf8',
  );
  await writeFile(
    path.join(outputDir, 'release-readiness-report.md'),
    releaseReadinessReport,
    'utf8',
  );

  process.stdout.write(`${outputDir}\n`);
}

void main();
