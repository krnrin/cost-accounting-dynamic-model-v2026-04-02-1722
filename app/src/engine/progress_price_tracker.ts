/**
 * Progress Price Tracker (C16 — Issue #73)
 * 
 * 进度价差距追踪 + 残余材料呆滞提报
 * - 协议价 vs 批量价追踪（每料号级）
 * - 差距超阈值自动标记
 * - 残余材料超龄呆滞识别
 */

// ─── Types ───

export interface ProtocolTrackingItem {
  itemId: string;
  partNo: string;
  partName: string;
  harnessId: string;
  category: 'connector' | 'wire' | 'terminal' | 'other';
  targetProtocolPrice: number;   // 客户协议价
  samplePrice: number | null;    // 采购样品价
  batchPrice: number | null;     // 批量采购价
  gap: number;                   // batchPrice - targetProtocolPrice
  gapRate: number;               // gap / targetProtocolPrice
  quantity: number;              // 年用量
  annualGapAmount: number;       // gap * quantity
  status: ProtocolStatus;
  note: string;
  updatedAt: string;
}

export type ProtocolStatus =
  | 'pending'       // 未启动
  | 'negotiating'   // 谈判中
  | 'confirmed'     // 已达成
  | 'gap_exists'    // 有缺口
  | 'escalated';    // 已升级

export interface ProtocolTrackingSummary {
  totalTarget: number;
  totalActual: number;
  totalGap: number;
  confirmedCount: number;
  gapCount: number;
  pendingCount: number;
  negotiatingCount: number;
  weightedAchievementRate: number;  // 按金额加权达成率
  topGapItems: ProtocolTrackingItem[];  // Top 10 缺口
}

export interface StagnantCandidate {
  itemId: string;
  partNo: string;
  partName: string;
  harnessId: string;
  lastKnownQty: number;
  estimatedInventory: number | null;  // 库存量（需采购录入）
  estimatedValue: number | null;       // 呆滞金额（需采购录入）
  unmatchReason: 'change_cancelled' | 'version_missing' | 'obsolete';
  changeRef: string | null;
  daysSinceObsolete: number;
  status: StagnantStatus;
  reportedAt: string | null;
}

export type StagnantStatus =
  | 'pending_report'   // 待提报
  | 'reported'         // 已提报
  | 'resolved'         // 已核销
  | 'reactivated';     // 已重新启用

export interface StagnantSummary {
  totalCandidates: number;
  pendingReportCount: number;
  totalEstimatedValue: number;
  avgDaysObsolete: number;
  byReason: Record<string, number>;
}

// ─── Protocol Tracking ───

/** Compute tracking metrics for a single item */
export function computeItemGap(item: {
  targetProtocolPrice: number;
  batchPrice: number | null;
  quantity: number;
}): { gap: number; gapRate: number; annualGapAmount: number } {
  const batch = item.batchPrice ?? item.targetProtocolPrice;
  const gap = Math.round((batch - item.targetProtocolPrice) * 10000) / 10000;
  const gapRate = item.targetProtocolPrice !== 0
    ? Math.round((gap / Math.abs(item.targetProtocolPrice)) * 10000) / 10000
    : 0;
  const annualGapAmount = Math.round(gap * item.quantity * 100) / 100;
  return { gap, gapRate, annualGapAmount };
}

/** Determine protocol status based on item data */
export function deriveProtocolStatus(item: {
  batchPrice: number | null;
  samplePrice: number | null;
  targetProtocolPrice: number;
  gap?: number;
}): ProtocolStatus {
  if (item.batchPrice == null && item.samplePrice == null) return 'pending';
  if (item.batchPrice == null) return 'negotiating';
  const gap = item.gap ?? (item.batchPrice - item.targetProtocolPrice);
  if (Math.abs(gap) < 0.001) return 'confirmed';
  return 'gap_exists';
}

/** Build protocol tracking summary */
export function buildProtocolSummary(
  items: ProtocolTrackingItem[],
  topN: number = 10,
): ProtocolTrackingSummary {
  let totalTarget = 0;
  let totalActual = 0;
  let totalGap = 0;
  let confirmedCount = 0;
  let gapCount = 0;
  let pendingCount = 0;
  let negotiatingCount = 0;

  for (const item of items) {
    const targetAmount = item.targetProtocolPrice * item.quantity;
    const actualAmount = (item.batchPrice ?? item.targetProtocolPrice) * item.quantity;
    totalTarget += targetAmount;
    totalActual += actualAmount;
    totalGap += item.annualGapAmount;

    switch (item.status) {
      case 'confirmed': confirmedCount++; break;
      case 'gap_exists': case 'escalated': gapCount++; break;
      case 'pending': pendingCount++; break;
      case 'negotiating': negotiatingCount++; break;
    }
  }

  const weightedAchievementRate = totalTarget !== 0
    ? Math.round(((totalTarget - Math.abs(totalGap)) / totalTarget) * 10000) / 100
    : 100;

  const topGapItems = [...items]
    .sort((a, b) => Math.abs(b.annualGapAmount) - Math.abs(a.annualGapAmount))
    .slice(0, topN);

  return {
    totalTarget: Math.round(totalTarget * 100) / 100,
    totalActual: Math.round(totalActual * 100) / 100,
    totalGap: Math.round(totalGap * 100) / 100,
    confirmedCount,
    gapCount,
    pendingCount,
    negotiatingCount,
    weightedAchievementRate,
    topGapItems,
  };
}

// ─── Stagnant Material ───

/** Identify stagnant material candidates from BOM changes */
export function identifyStagnantCandidates(
  removedItems: Array<{
    partNo: string;
    partName?: string;
    harnessId?: string;
    quantity?: number;
    changeRef?: string;
  }>,
  removedAt: Date = new Date(),
): StagnantCandidate[] {
  return removedItems.map((item, i) => ({
    itemId: `stag-${item.partNo}-${i}`,
    partNo: item.partNo,
    partName: item.partName || '',
    harnessId: item.harnessId || '',
    lastKnownQty: item.quantity || 0,
    estimatedInventory: null,
    estimatedValue: null,
    unmatchReason: 'change_cancelled' as const,
    changeRef: item.changeRef || null,
    daysSinceObsolete: Math.floor((Date.now() - removedAt.getTime()) / (24 * 60 * 60 * 1000)),
    status: 'pending_report' as const,
    reportedAt: null,
  }));
}

/** Build stagnant material summary */
export function buildStagnantSummary(candidates: StagnantCandidate[]): StagnantSummary {
  const pendingReportCount = candidates.filter(c => c.status === 'pending_report').length;
  const totalEstimatedValue = candidates.reduce(
    (sum, c) => sum + (c.estimatedValue || 0), 0
  );
  const avgDaysObsolete = candidates.length > 0
    ? Math.round(candidates.reduce((sum, c) => sum + c.daysSinceObsolete, 0) / candidates.length)
    : 0;

  const byReason: Record<string, number> = {};
  candidates.forEach(c => {
    byReason[c.unmatchReason] = (byReason[c.unmatchReason] || 0) + 1;
  });

  return {
    totalCandidates: candidates.length,
    pendingReportCount,
    totalEstimatedValue: Math.round(totalEstimatedValue * 100) / 100,
    avgDaysObsolete,
    byReason,
  };
}

/** Check if stagnant item should trigger warning alert */
export function shouldTriggerStagnantAlert(
  candidate: StagnantCandidate,
  thresholdDays: number = 90,
  thresholdValue: number = 10000,
): boolean {
  if (candidate.status !== 'pending_report') return false;
  if (candidate.daysSinceObsolete >= thresholdDays) return true;
  if (candidate.estimatedValue != null && candidate.estimatedValue >= thresholdValue) return true;
  return false;
}
