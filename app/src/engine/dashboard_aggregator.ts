/**
 * Dashboard Aggregator (C18 — Issue #66)
 * 
 * Dashboard预警/版本摘要聚合 + 项目导入校验
 * - 从AlertsPage拉取预警聚合数据
 * - 从VersionManager获取版本状态
 * - 项目导入Excel/CSV基础校验
 */

// ─── Types ───

export interface AlertAggregate {
  totalActive: number;
  bySeverity: { critical: number; warning: number; info: number };
  byCategory: Record<string, number>;
  recentEvents: AlertEvent[];
  oldestUnresolved: AlertEvent | null;
}

export interface AlertEvent {
  id: string;
  title: string;
  severity: 'critical' | 'warning' | 'info';
  category: string;
  createdAt: string;
  status: 'active' | 'acknowledged' | 'resolved';
}

export interface VersionSummary {
  currentVersion: string;
  lastPublishedAt: string | null;
  totalSnapshots: number;
  recentChanges: VersionChange[];
  pendingApprovals: number;
}

export interface VersionChange {
  versionId: string;
  label: string;
  changedAt: string;
  changedBy: string;
  type: 'rate' | 'bom' | 'quote' | 'settings';
}

export interface ProjectImportResult {
  valid: boolean;
  rows: number;
  errors: ImportError[];
  warnings: ImportWarning[];
  preview: ProjectImportRow[];
}

export interface ProjectImportRow {
  projectCode: string;
  projectName: string;
  customer: string;
  lifecycleYears: number;
  harnessCount: number;
}

export interface ImportError {
  row: number;
  field: string;
  message: string;
}

export interface ImportWarning {
  row: number;
  field: string;
  message: string;
}

// ─── Alert Aggregation ───

/** Aggregate alert events into dashboard summary */
export function aggregateAlerts(events: AlertEvent[]): AlertAggregate {
  const active = events.filter(e => e.status !== 'resolved');
  const bySeverity = { critical: 0, warning: 0, info: 0 };
  const byCategory: Record<string, number> = {};

  for (const e of active) {
    bySeverity[e.severity] = (bySeverity[e.severity] || 0) + 1;
    byCategory[e.category] = (byCategory[e.category] || 0) + 1;
  }

  const sorted = [...active].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const oldest = [...active].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return {
    totalActive: active.length,
    bySeverity,
    byCategory,
    recentEvents: sorted.slice(0, 5),
    oldestUnresolved: oldest[0] || null,
  };
}

// ─── Version Summary ───

/** Build version summary for dashboard display */
export function buildVersionSummary(
  currentVersion: string,
  changes: VersionChange[],
  totalSnapshots: number,
  pendingApprovals: number = 0,
): VersionSummary {
  const sorted = [...changes].sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime());
  return {
    currentVersion,
    lastPublishedAt: sorted[0]?.changedAt || null,
    totalSnapshots,
    recentChanges: sorted.slice(0, 5),
    pendingApprovals,
  };
}

// ─── Project Import Validation ───

/** Validate project import data (CSV/Excel parsed rows) */
export function validateProjectImport(
  rows: Array<Record<string, unknown>>,
): ProjectImportResult {
  const errors: ImportError[] = [];
  const warnings: ImportWarning[] = [];
  const preview: ProjectImportRow[] = [];
  const seenCodes = new Set<string>();

  rows.forEach((row, index) => {
    const rowNum = index + 1;
    const code = String(row.projectCode || row['项目代码'] || '').trim();
    const name = String(row.projectName || row['项目名称'] || '').trim();
    const customer = String(row.customer || row['客户'] || '').trim();
    const years = Number(row.lifecycleYears || row['生命周期'] || 0);
    const harnesses = Number(row.harnessCount || row['线束数量'] || 0);

    if (!code) {
      errors.push({ row: rowNum, field: 'projectCode', message: `第${rowNum}行: 项目代码为空` });
    } else if (seenCodes.has(code)) {
      errors.push({ row: rowNum, field: 'projectCode', message: `第${rowNum}行: 项目代码 ${code} 重复` });
    } else {
      seenCodes.add(code);
    }

    if (!name) {
      errors.push({ row: rowNum, field: 'projectName', message: `第${rowNum}行: 项目名称为空` });
    }

    if (years <= 0 || years > 20) {
      warnings.push({ row: rowNum, field: 'lifecycleYears', message: `第${rowNum}行: 生命周期 ${years} 年，请确认` });
    }

    if (harnesses <= 0) {
      warnings.push({ row: rowNum, field: 'harnessCount', message: `第${rowNum}行: 线束数量为 0` });
    }

    preview.push({ projectCode: code, projectName: name, customer, lifecycleYears: years, harnessCount: harnesses });
  });

  return {
    valid: errors.length === 0,
    rows: rows.length,
    errors,
    warnings,
    preview,
  };
}
