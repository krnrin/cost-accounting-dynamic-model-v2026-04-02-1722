/**
 * Recovery Ledger (C19 — Issue #70)
 *
 * 回收记录明细台账 + 模块联动
 * - 每批次回收的时间/金额/产量
 * - 回收进度超100%自动预警
 * - 超期自动生成严重预警
 * - 与TrackingPage联动创建调价建议
 *
 * [PR-112] 调价联动说明：
 * 本模块仅生成 alerts，不直接创建调价建议。
 * 调价建议由 TrackingPage 或 change_pricing 模块根据 alerts 创建。
 * 联动方式：调用方订阅 generateRecoveryAlerts() 返回的 alerts，
 * 并根据 type='adjustment_needed' 或 type='over_recovery' 创建跟踪项。
 */

// ─── Types ───

export interface RecoveryRecord {
  id: string;
  allocItemId: string;
  scenarioId: string;
  batchNo: number;
  recoveryDate: string;
  recoveryAmount: number;
  productionVolume: number;
  unitRecovery: number;  // recoveryAmount / productionVolume
  cumulativeAmount: number;
  cumulativeRate: number;  // cumulative / totalNre
  note: string;
}

export interface AllocItemSummary {
  allocItemId: string;
  scenarioId: string;
  costType: string;  // 模具/检具/研发/样品/认证
  totalNre: number;
  allocMethod: 'volume' | 'period' | 'milestone';
  allocPeriodMonths: number;
  startDate: string;
  records: RecoveryRecord[];
  // Computed
  totalRecovered: number;
  recoveryRate: number;
  remainingAmount: number;
  isComplete: boolean;
  isOverRecovered: boolean;
  monthsElapsed: number;
  isOverdue: boolean;
}

export interface RecoveryAlert {
  type: 'over_recovery' | 'overdue' | 'milestone_reached' | 'adjustment_needed';
  severity: 'critical' | 'warning' | 'info';
  allocItemId: string;
  message: string;
  suggestedAction: string;
}

export interface RecoveryLedgerSummary {
  totalItems: number;
  totalNre: number;
  totalRecovered: number;
  overallRecoveryRate: number;
  completedCount: number;
  overdueCount: number;
  overRecoveredCount: number;
  alerts: RecoveryAlert[];
}

// ─── Helpers ───

/**
 * [PR-111] 计算两个日期之间的自然月数
 * 替代 30.44 天估算，使用精确的自然月计算
 */
function differenceInMonths(dateLeft: Date, dateRight: Date): number {
  const yearDiff = dateLeft.getFullYear() - dateRight.getFullYear();
  const monthDiff = dateLeft.getMonth() - dateRight.getMonth();
  const dayDiff = dateLeft.getDate() - dateRight.getDate();

  // 如果左边的日期小于右边的日期，需要减一个月
  let months = yearDiff * 12 + monthDiff;
  if (dayDiff < 0) {
    months -= 1;
  }
  return Math.max(0, months);
}

// ─── Core Functions ───

/** Add a recovery record to an alloc item */
export function addRecoveryRecord(
  item: AllocItemSummary,
  amount: number,
  volume: number,
  date: string = new Date().toISOString(),
  note: string = '',
): RecoveryRecord {
  const batchNo = item.records.length + 1;
  const cumulativeAmount = item.totalRecovered + amount;
  const cumulativeRate = item.totalNre > 0 ? cumulativeAmount / item.totalNre : 0;

  return {
    id: `rec-${item.allocItemId}-${batchNo}`,
    allocItemId: item.allocItemId,
    scenarioId: item.scenarioId,
    batchNo,
    recoveryDate: date,
    recoveryAmount: Math.round(amount * 100) / 100,
    productionVolume: volume,
    unitRecovery: volume > 0 ? Math.round((amount / volume) * 10000) / 10000 : 0,
    cumulativeAmount: Math.round(cumulativeAmount * 100) / 100,
    cumulativeRate: Math.round(cumulativeRate * 10000) / 10000,
    note,
  };
}

/** Compute summary for a single alloc item */
export function computeAllocItemSummary(
  allocItemId: string,
  scenarioId: string,
  costType: string,
  totalNre: number,
  allocMethod: AllocItemSummary['allocMethod'],
  allocPeriodMonths: number,
  startDate: string,
  records: RecoveryRecord[],
): AllocItemSummary {
  const totalRecovered = records.reduce((sum, r) => sum + r.recoveryAmount, 0);
  const recoveryRate = totalNre > 0 ? totalRecovered / totalNre : 0;
  // [PR-111] 使用自然月计算替代 30.44 天估算
  const monthsElapsed = differenceInMonths(new Date(), new Date(startDate));

  return {
    allocItemId,
    scenarioId,
    costType,
    totalNre,
    allocMethod,
    allocPeriodMonths,
    startDate,
    records,
    totalRecovered: Math.round(totalRecovered * 100) / 100,
    recoveryRate: Math.round(recoveryRate * 10000) / 10000,
    remainingAmount: Math.round((totalNre - totalRecovered) * 100) / 100,
    isComplete: recoveryRate >= 1.0,
    isOverRecovered: recoveryRate > 1.0,
    monthsElapsed,
    isOverdue: monthsElapsed > allocPeriodMonths && recoveryRate < 1.0,
  };
}

/** Generate recovery alerts for all items */
export function generateRecoveryAlerts(items: AllocItemSummary[]): RecoveryAlert[] {
  const alerts: RecoveryAlert[] = [];

  for (const item of items) {
    if (item.isOverRecovered) {
      alerts.push({
        type: 'over_recovery',
        severity: 'warning',
        allocItemId: item.allocItemId,
        message: `${item.costType} 回收已超 ${Math.round((item.recoveryRate - 1) * 100)}%，累计回收 ¥${item.totalRecovered.toLocaleString()}`,
        suggestedAction: '建议创建调价建议跟踪项',
      });
    }

    if (item.isOverdue) {
      alerts.push({
        type: 'overdue',
        severity: 'critical',
        allocItemId: item.allocItemId,
        message: `${item.costType} 回收超期 ${item.monthsElapsed - item.allocPeriodMonths} 个月，回收率仅 ${Math.round(item.recoveryRate * 100)}%`,
        suggestedAction: '建议升级处理，联系客户沟通回收方案',
      });
    }

    // Milestone alerts
    const milestones = [0.5, 0.75, 0.9, 1.0];
    for (const milestone of milestones) {
      if (item.records.length > 0) {
        const lastRecord = item.records[item.records.length - 1]!;
        const prevRate = lastRecord.cumulativeRate - (lastRecord.recoveryAmount / item.totalNre);
        if (prevRate < milestone && lastRecord.cumulativeRate >= milestone) {
          alerts.push({
            type: 'milestone_reached',
            severity: 'info',
            allocItemId: item.allocItemId,
            message: `${item.costType} 回收达到 ${Math.round(milestone * 100)}% 里程碑`,
            suggestedAction: milestone >= 1.0 ? '回收完成，建议归档' : '继续追踪',
          });
        }
      }
    }
  }

  return alerts;
}

/** Build ledger summary across all items */
export function buildLedgerSummary(items: AllocItemSummary[]): RecoveryLedgerSummary {
  const totalNre = items.reduce((s, i) => s + i.totalNre, 0);
  const totalRecovered = items.reduce((s, i) => s + i.totalRecovered, 0);
  const alerts = generateRecoveryAlerts(items);

  return {
    totalItems: items.length,
    totalNre: Math.round(totalNre * 100) / 100,
    totalRecovered: Math.round(totalRecovered * 100) / 100,
    overallRecoveryRate: totalNre > 0 ? Math.round((totalRecovered / totalNre) * 10000) / 10000 : 0,
    completedCount: items.filter(i => i.isComplete).length,
    overdueCount: items.filter(i => i.isOverdue).length,
    overRecoveredCount: items.filter(i => i.isOverRecovered).length,
    alerts,
  };
}
