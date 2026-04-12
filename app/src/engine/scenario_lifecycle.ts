/**
 * B1: 场景冻结/发布状态流 (freeze → publish lifecycle)
 * 
 * 场景状态机:
 *   draft → frozen → published → archived
 *                ↘ draft (解冻)
 * 
 * - draft: 可编辑BOM/配置/参数
 * - frozen: 锁定所有数据，仅允许查看和对比
 * - published: 正式发布，作为报价/设变的基准
 * - archived: 归档，不再使用
 */
import { db } from '@/data/db';
import type { ScenarioRecord } from '@/data/db';

export type ScenarioStatus = 'draft' | 'frozen' | 'published' | 'archived';

export interface ScenarioStatusTransition {
  from: ScenarioStatus;
  to: ScenarioStatus;
  action: string;
  label: string;
  requiresConfirmation: boolean;
  confirmMessage?: string;
}

/** 允许的状态转换 */
export const ALLOWED_TRANSITIONS: ScenarioStatusTransition[] = [
  {
    from: 'draft', to: 'frozen',
    action: 'freeze', label: '冻结场景',
    requiresConfirmation: true,
    confirmMessage: '冻结后将锁定所有BOM数据和配置参数，确认冻结？',
  },
  {
    from: 'frozen', to: 'published',
    action: 'publish', label: '发布场景',
    requiresConfirmation: true,
    confirmMessage: '发布后此场景将成为正式报价基准，确认发布？',
  },
  {
    from: 'frozen', to: 'draft',
    action: 'unfreeze', label: '解冻(回退到草稿)',
    requiresConfirmation: true,
    confirmMessage: '解冻后可再次编辑数据，确认解冻？',
  },
  {
    from: 'published', to: 'archived',
    action: 'archive', label: '归档场景',
    requiresConfirmation: true,
    confirmMessage: '归档后此场景将不再作为活跃基准，确认归档？',
  },
];

/** 检查是否允许编辑 */
export function isEditable(status: ScenarioStatus): boolean {
  return status === 'draft';
}

/** 获取允许的下一步操作 */
export function getAvailableTransitions(currentStatus: ScenarioStatus): ScenarioStatusTransition[] {
  return ALLOWED_TRANSITIONS.filter((t) => t.from === currentStatus);
}

/** 检查状态转换是否合法 */
export function canTransition(from: ScenarioStatus, to: ScenarioStatus): boolean {
  return ALLOWED_TRANSITIONS.some((t) => t.from === from && t.to === to);
}

/** 执行状态转换 */
export async function transitionScenario(
  scenarioId: string,
  targetStatus: ScenarioStatus,
  options?: { userId?: string; note?: string }
): Promise<ScenarioRecord> {
  const scenario = await db.scenarios.get(scenarioId);
  if (!scenario) {
    throw new Error(`场景 ${scenarioId} 不存在`);
  }

  const currentStatus = (scenario as any).status as ScenarioStatus || 'draft';
  if (!canTransition(currentStatus, targetStatus)) {
    throw new Error(`不允许从 ${currentStatus} 转换到 ${targetStatus}`);
  }

  const now = new Date().toISOString();
  const updates: Record<string, unknown> = {
    status: targetStatus,
    updatedAt: now,
  };

  // 记录关键时间点
  switch (targetStatus) {
    case 'frozen':
      updates.frozenAt = now;
      updates.frozenBy = options?.userId;
      break;
    case 'published':
      updates.publishedAt = now;
      updates.publishedBy = options?.userId;
      break;
    case 'archived':
      updates.archivedAt = now;
      break;
  }

  if (options?.note) {
    updates.statusNote = options.note;
  }

  await db.scenarios.update(scenarioId, updates);

  // 冻结时自动锁定所有线束
  if (targetStatus === 'frozen') {
    await db.harnesses
      .where('scenarioId').equals(scenarioId)
      .modify({ locked: true, lockedAt: now });
  }

  // 解冻时解锁所有线束
  if (targetStatus === 'draft' && currentStatus === 'frozen') {
    await db.harnesses
      .where('scenarioId').equals(scenarioId)
      .modify({ locked: false, lockedAt: null });
  }

  const updated = await db.scenarios.get(scenarioId);
  return updated!;
}

/** 获取场景状态标签颜色 */
export function getStatusColor(status: ScenarioStatus): string {
  switch (status) {
    case 'draft': return 'blue';
    case 'frozen': return 'orange';
    case 'published': return 'green';
    case 'archived': return 'grey';
    default: return 'default';
  }
}

/** 获取场景状态图标 */
export function getStatusIcon(status: ScenarioStatus): string {
  switch (status) {
    case 'draft': return '📝';
    case 'frozen': return '🔒';
    case 'published': return '✅';
    case 'archived': return '📦';
    default: return '❓';
  }
}
