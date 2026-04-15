import JSZip from 'jszip';
import { exportProjectPackage } from './project_io';
import { db, type QuoteSnapshotRecord } from '@/data/db';
import { computeHarnessCost } from './harness_costing';
import type { HarnessResult } from '@/types/harness';

function formatFactoryRateSource(snapshot: QuoteSnapshotRecord): string[] {
  const source = (snapshot.params as { factoryRateSource?: Record<string, unknown> | null })?.factoryRateSource;
  if (!source) {
    return ['- 工厂费率来源: 未记录'];
  }

  const baseFactoryName = String(source.baseFactoryName ?? source.baseFactoryId ?? '未命名工厂');
  const laborRate = Number(source.laborRate ?? 0);
  const mfgRate = Number(source.mfgRate ?? 0);
  const note = String(source.note ?? source.sourceNote ?? '');

  return [
    `- 工厂费率来源: ${baseFactoryName}`,
    `- 人工费率: ${laborRate.toFixed(4)}`,
    `- 制造费率: ${mfgRate.toFixed(4)}`,
    note ? `- 来源说明: ${note}` : '- 来源说明: 未提供',
  ];
}

function buildUsageGuide(
  projectId: string,
  projectName: string,
  harnessCount: number,
  quoteCount: number,
  quoteSnapshots: QuoteSnapshotRecord[],
): string {
  const latestSnapshot = quoteSnapshots.length > 0 ? [...quoteSnapshots].sort((a, b) => b.version - a.version)[0] : null;

  return [
    '# 使用说明',
    '',
    '## 数据包内容',
    '- `project.json`：项目主数据、配置、线束与报价打包结果',
    '- `bom_data.json`：按线束号展开的 BOM 明细',
    '- `harness_results.json`：基于当前费率/金属价即时重算的线束成本结果（存在配置时导出）',
    '- `quotes.json`：报价记录快照',
    '- `quote_snapshots.json`：报价版本与参数/结果快照',
    '- `verification/quote_snapshot_diff_*.md`：最近两版报价的验证报告（至少两版快照时导出）',
    '- `usage/README.md`：当前这份使用说明',
    '',
    '## 当前包摘要',
    `- Project ID: ${projectId}`,
    `- Project Name: ${projectName}`,
    `- Harness Count: ${harnessCount}`,
    `- Quote Count: ${quoteCount}`,
    `- Quote Snapshot Count: ${quoteSnapshots.length}`,
    '',
    '## 建议使用方式',
    '1. 先看 `project.json` 获取项目总体配置与主键关系。',
    '2. 再看 `bom_data.json` 和 `harness_results.json`，核对 BOM 到线束级成本结果。',
    '3. 若需追溯报价变化，查看 `quote_snapshots.json` 与 `verification/` 下的版本差异报告。',
    '4. 若需核对 Sprint 2 工厂费率参数化来源，优先查看最新报价快照中的 `factoryRateSource`。',
    '',
    '## 最新报价快照中的工厂费率来源',
    ...(latestSnapshot ? formatFactoryRateSource(latestSnapshot) : ['- 暂无报价快照，无法提供工厂费率追溯信息']),
  ].join('\n');
}

function buildQuoteVerificationReport(base: QuoteSnapshotRecord, compare: QuoteSnapshotRecord): string {
  const baseParams = JSON.stringify(base.params, null, 2);
  const compareParams = JSON.stringify(compare.params, null, 2);
  const paramChanged = baseParams !== compareParams;
  const baseDelivered = Number((base.results as { totalDeliveredPrice?: unknown })?.totalDeliveredPrice ?? 0);
  const compareDelivered = Number((compare.results as { totalDeliveredPrice?: unknown })?.totalDeliveredPrice ?? 0);
  const deliveredDelta = compareDelivered - baseDelivered;
  const sign = deliveredDelta > 0 ? '+' : '';

  return [
    '# Quote Snapshot Verification Report',
    '',
    `- Project ID: ${compare.projectId}`,
    `- Scenario ID: ${compare.scenarioId}`,
    `- Base Snapshot: v${base.version} ${base.label || ''}`.trimEnd(),
    `- Compare Snapshot: v${compare.version} ${compare.label || ''}`.trimEnd(),
    `- Generated At: ${new Date().toISOString()}`,
    '',
    '## Parameter Diffs',
    paramChanged ? '- 快照参数已变化，请查看 quote_snapshots.json 详情' : '- 无参数变化',
    '',
    '## Result Diffs',
    `- 总到厂价: ${baseDelivered.toFixed(4)} -> ${compareDelivered.toFixed(4)} | Δ ${sign}${deliveredDelta.toFixed(4)}`,
    '',
    '## Summary',
    `- Param Changes: ${paramChanged ? 1 : 0}`,
    `- Result Changes: ${Math.abs(deliveredDelta) > 0.0001 ? 1 : 0}`,
  ].join('\n');
}

/**
 * 导出项目完整 ZIP 包
 * 包含: project.json + bom_data.json + harness_results.json + import_logs.json + versions.json + quotes.json + quote_snapshots.json
 */
export async function exportProjectZip(projectId: string): Promise<void> {
  const zip = new JSZip();

  const pkg = await exportProjectPackage(projectId);
  zip.file('project.json', JSON.stringify(pkg, null, 2));

  const harnessRecords = pkg.harnesses;
  const bomData = harnessRecords.map(h => ({
    harnessId: h.harnessId,
    harnessName: h.harnessName,
    bom: h.input.bom || [],
  }));
  zip.file('bom_data.json', JSON.stringify(bomData, null, 2));

  const project = pkg.project;
  if (project && harnessRecords.length > 0) {
    const costRates = project.config?.costRates;
    const metalPrices = project.config?.metalPrices;

    if (costRates && metalPrices) {
      const results: HarnessResult[] = harnessRecords.map(h => computeHarnessCost(h.input, costRates, metalPrices));
      zip.file('harness_results.json', JSON.stringify(results, null, 2));
    }
  }

  const importLogs = await db.importLogs.where('projectId').equals(projectId).toArray();
  if (importLogs.length > 0) {
    zip.file('import_logs.json', JSON.stringify(importLogs, null, 2));
  }

  const versions = await db.versions.where('projectId').equals(projectId).toArray();
  if (versions.length > 0) {
    zip.file('versions.json', JSON.stringify(versions, null, 2));
  }

  if (pkg.quotes.length > 0) {
    zip.file('quotes.json', JSON.stringify(pkg.quotes, null, 2));
  }

  const quoteSnapshots = await db.quoteSnapshots.where('projectId').equals(projectId).toArray();
  const sortedSnapshots = [...quoteSnapshots].sort((a, b) => a.version - b.version);
  if (sortedSnapshots.length > 0) {
    zip.file('quote_snapshots.json', JSON.stringify(sortedSnapshots, null, 2));

    if (sortedSnapshots.length >= 2) {
      const base = sortedSnapshots[sortedSnapshots.length - 2]!;
      const compare = sortedSnapshots[sortedSnapshots.length - 1]!;
      zip.file(
        `verification/quote_snapshot_diff_v${base.version}_to_v${compare.version}.md`,
        buildQuoteVerificationReport(base, compare),
      );
    }
  }

  const projectName = project?.meta?.projectName || projectId;
  zip.file('usage/README.md', buildUsageGuide(projectId, projectName, harnessRecords.length, pkg.quotes.length, sortedSnapshots));

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${projectName}_完整数据包_${new Date().toISOString().slice(0, 10)}.zip`;
  document.body.appendChild(a);
  a.click();

  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 200);
}
