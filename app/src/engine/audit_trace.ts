/**
 * 审计追踪引擎 (Issue #74)
 *
 * 为所有成本操作生成可追溯的审计ID，
 * 记录操作链路，支持全链路回溯。
 *
 * 审计ID格式: AUD-{scope}-{timestamp}-{random}
 * 例如: AUD-FREEZE-20260413-a3f2k
 */

/** 审计事件范围 */
export type AuditScope =
  | 'FREEZE'      // 场景冻结
  | 'PUBLISH'     // 场景发布
  | 'UNFREEZE'    // 场景解冻
  | 'ARCHIVE'     // 场景归档
  | 'ECN'         // 设变
  | 'METAL'       // 金属联动
  | 'ANNUAL_DROP' // 年降
  | 'IMPORT'      // BOM导入
  | 'QUOTE'       // 报价生成
  | 'SNAPSHOT'    // 快照创建
  | 'RESTORE'     // 快照恢复
  | 'RATE_CHANGE' // 费率变更
  | 'CONFIG'      // 配置变更
  | 'ALLOC'       // 分摆调整
  | 'MANUAL';     // 手动操作

/** 审计记录 */
export interface AuditRecord {
  /** 审计ID */
  id: string;
  /** 范围 */
  scope: AuditScope;
  /** 操作描述 */
  action: string;
  /** 项目ID */
  projectId?: string;
  /** 场景ID */
  scenarioId?: string;
  /** 线束ID */
  harnessId?: string;
  /** 操作人 */
  userId?: string;
  /** 时间戳 */
  timestamp: string;
  /** 变更前状态摘要 */
  before?: Record<string, unknown>;
  /** 变更后状态摘要 */
  after?: Record<string, unknown>;
  /** 关联的其他审计ID (因果链) */
  relatedAuditIds?: string[];
  /** 关联快照ID */
  snapshotId?: string;
  /** 备注 */
  note?: string;
}

/** 审计链 (trace chain) */
export interface AuditChain {
  /** 根事件ID */
  rootId: string;
  /** 所有相关记录，按时间顺序 */
  records: AuditRecord[];
  /** 链路摘要 */
  summary: string;
}

// 内存审计日志 (TODO: 迁移到 IndexedDB)
const auditLog: AuditRecord[] = [];
const MAX_LOG_SIZE = 5000;

/**
 * 生成审计ID
 */
export function generateAuditId(scope: AuditScope): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 7);
  return `AUD-${scope}-${dateStr}-${random}`;
}

/**
 * 创建审计记录
 */
export function createAuditRecord(
  scope: AuditScope,
  action: string,
  context?: {
    projectId?: string;
    scenarioId?: string;
    harnessId?: string;
    userId?: string;
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
    relatedAuditIds?: string[];
    snapshotId?: string;
    note?: string;
  }
): AuditRecord {
  const record: AuditRecord = {
    id: generateAuditId(scope),
    scope,
    action,
    timestamp: new Date().toISOString(),
    ...context,
  };

  // 追加到内存日志
  auditLog.push(record);
  if (auditLog.length > MAX_LOG_SIZE) {
    auditLog.splice(0, auditLog.length - MAX_LOG_SIZE);
  }

  return record;
}

/**
 * 获取审计日志
 */
export function getAuditLog(filter?: {
  scope?: AuditScope;
  projectId?: string;
  scenarioId?: string;
  since?: string;
  limit?: number;
}): AuditRecord[] {
  let result = [...auditLog];

  if (filter?.scope) {
    result = result.filter((r) => r.scope === filter.scope);
  }
  if (filter?.projectId) {
    result = result.filter((r) => r.projectId === filter.projectId);
  }
  if (filter?.scenarioId) {
    result = result.filter((r) => r.scenarioId === filter.scenarioId);
  }
  if (filter?.since) {
    result = result.filter((r) => r.timestamp >= filter.since!);
  }

  // 最新的在前
  result.reverse();

  if (filter?.limit) {
    result = result.slice(0, filter.limit);
  }

  return result;
}

/**
 * 構建审计链：从一个根事件出发，找到所有相关记录
 */
export function buildAuditChain(rootId: string): AuditChain | null {
  const root = auditLog.find((r) => r.id === rootId);
  if (!root) return null;

  const visited = new Set<string>();
  const chain: AuditRecord[] = [];
  const queue: string[] = [rootId];

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);

    const record = auditLog.find((r) => r.id === id);
    if (record) {
      chain.push(record);
      if (record.relatedAuditIds) {
        queue.push(...record.relatedAuditIds);
      }
    }

    // 也查找引用了此ID的记录
    const referencing = auditLog.filter(
      (r) => r.relatedAuditIds?.includes(id) && !visited.has(r.id)
    );
    for (const ref of referencing) {
      queue.push(ref.id);
    }
  }

  // 按时间排序
  chain.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const scopes = [...new Set(chain.map((r) => r.scope))];
  const summary = `审计链 [${root.scope}]: ${chain.length}条记录, 涉及 ${scopes.join(', ')}`;

  return { rootId, records: chain, summary };
}

/**
 * 清除审计日志 (用于测试)
 */
export function clearAuditLog(): void {
  auditLog.length = 0;
}
