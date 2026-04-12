import JSZip from 'jszip';
import { exportProjectPackage } from './project_io';
import { db } from '@/data/db';
import { computeHarnessCost } from './harness_costing';
import type { HarnessResult } from '@/types/harness';

/**
 * 导出项目完整 ZIP 包
 * 包含: project.json + BOM数据.json + harness_results.json + import_logs.json + versions.json + quotes.json
 */
export async function exportProjectZip(projectId: string): Promise<void> {
  const zip = new JSZip();

  // 1. 项目 JSON 数据 (包含 project, harnesses, quotes)
  const pkg = await exportProjectPackage(projectId);
  zip.file('project.json', JSON.stringify(pkg, null, 2));

  // 2. 线束数据
  const harnessRecords = pkg.harnesses;
  
  // 3. BOM 数据单独导出
  const bomData = harnessRecords.map(h => ({
    harnessId: h.harnessId,
    harnessName: h.harnessName,
    bom: h.input.bom || [],
  }));
  zip.file('bom_data.json', JSON.stringify(bomData, null, 2));

  // 4. 获取项目配置来计算成本
  const project = pkg.project;
  if (project && harnessRecords.length > 0) {
    const costRates = project.config?.costRates;
    const metalPrices = project.config?.metalPrices;
    
    if (costRates && metalPrices) {
      // 计算各线束的 HarnessResult
      const results: HarnessResult[] = harnessRecords.map(h => {
        return computeHarnessCost(
          h.input,
          costRates,
          metalPrices
        );
      });

      zip.file('harness_results.json', JSON.stringify(results, null, 2));
    }
  }

  // 5. 导入日志
  const importLogs = await db.importLogs.where('projectId').equals(projectId).toArray();
  if (importLogs.length > 0) {
    zip.file('import_logs.json', JSON.stringify(importLogs, null, 2));
  }

  // 6. 版本快照
  const versions = await db.versions.where('projectId').equals(projectId).toArray();
  if (versions.length > 0) {
    zip.file('versions.json', JSON.stringify(versions, null, 2));
  }

  // 7. 报价记录
  if (pkg.quotes.length > 0) {
    zip.file('quotes.json', JSON.stringify(pkg.quotes, null, 2));
  }

  // 生成 ZIP 并下载
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const projectName = project?.meta?.projectName || projectId;
  a.download = `${projectName}_完整数据包_${new Date().toISOString().slice(0, 10)}.zip`;
  document.body.appendChild(a);
  a.click();
  
  // 延迟清理
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 200);
}
