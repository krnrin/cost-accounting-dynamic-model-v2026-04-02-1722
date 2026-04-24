import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildE281ScenarioPayload,
} from '@/data/seeds/e281ScenarioPayload';
import {
  compareE281ScenarioPayloads,
  verifyE281ScenarioPayload,
} from '../e281_verification';

function buildOutputDir() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.resolve(process.cwd(), '..', 'output', 'e281-verification', stamp);
}

function renderMarkdownSummary(params: {
  quoteStatus: string;
  awardStatus: string;
  quoteMismatchCount: number;
  affectedHarnessCount: number;
  totalDelta: number;
  topReasons: string[];
}) {
  return [
    '# E281 Release Readiness',
    '',
    `- Quote raw status: ${params.quoteStatus}`,
    `- Award corrected status: ${params.awardStatus}`,
    `- Quote raw mismatch checkpoints: ${params.quoteMismatchCount}`,
    `- Award-vs-quote affected harnesses: ${params.affectedHarnessCount}`,
    `- Award-vs-quote vehicle cost delta: ${params.totalDelta.toFixed(4)}`,
    '',
    '## Top Reasons',
    ...params.topReasons.map((item) => `- ${item}`),
    '',
  ].join('\n');
}

describe('E281 verification artifacts', () => {
  it('generates quote and award verification reports plus a release readiness summary', async () => {
    const quotePayload = buildE281ScenarioPayload('quote_raw');
    const awardPayload = buildE281ScenarioPayload('award_corrected');

    const quoteReport = verifyE281ScenarioPayload(quotePayload);
    const awardReport = verifyE281ScenarioPayload(awardPayload);
    const comparison = compareE281ScenarioPayloads(quotePayload, awardPayload);

    const outputDir = buildOutputDir();
    await mkdir(outputDir, { recursive: true });

    const quoteArtifact = {
      report: quoteReport,
      summary: comparison.base.projectResult,
      scenario: quotePayload.scenario,
    };
    const awardArtifact = {
      report: awardReport,
      summary: comparison.compare.projectResult,
      scenario: awardPayload.scenario,
      mutationRecipe: awardPayload.mutationRecipe,
      comparison: {
        totalDelta: comparison.changePricing.summary.totalDelta,
        deltaPercent: comparison.changePricing.summary.deltaPercent,
        affectedCount: comparison.changePricing.summary.affectedCount,
        reasonSummary: comparison.reasonSummary,
      },
    };

    await writeFile(
      path.join(outputDir, 'quote-raw-report.json'),
      `${JSON.stringify(quoteArtifact, null, 2)}\n`,
      'utf8',
    );
    await writeFile(
      path.join(outputDir, 'award-corrected-report.json'),
      `${JSON.stringify(awardArtifact, null, 2)}\n`,
      'utf8',
    );
    await writeFile(
      path.join(outputDir, 'release-readiness-report.md'),
      renderMarkdownSummary({
        quoteStatus: quoteReport.status,
        awardStatus: awardReport.status,
        quoteMismatchCount: quoteReport.harnessChecks.filter((item) => item.status !== 'pass').length,
        affectedHarnessCount: comparison.changePricing.summary.affectedCount,
        totalDelta: comparison.changePricing.summary.totalDelta,
        topReasons: comparison.reasonSummary,
      }),
      'utf8',
    );

    expect(quoteReport.inputChecks.every((item) => item.status === 'pass')).toBe(true);
    expect(awardReport.inputChecks.every((item) => item.status === 'pass')).toBe(true);
    expect(comparison.deepCompare.summary.totalDimensions).toBeGreaterThan(0);
    expect(comparison.changePricing.summary.affectedCount).toBeGreaterThan(0);
    expect(comparison.decisionSummary.shapleyResults.length).toBeGreaterThan(0);
  });
});
