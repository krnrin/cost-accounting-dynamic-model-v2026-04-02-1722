import Dexie, { type Table } from 'dexie';
import type { Project, ProjectConfig } from '../types/project';
import type { HarnessInput, HarnessResult, HarnessRelation, VehicleConfig, VehicleConfigMeta } from '../types/harness';
import type { QuoteSheet } from '../types/quote';
import type { VersionRecord } from '../types/version';
import type { OnetimeCostInput } from '../engine/onetime_alloc';
import { applyE281ScenarioFallback } from './e281Fallback';

/** 场景类型 */
export type ScenarioType =
  | 'initial_quote'    // 初始报价
  | 'final_quote'      // 最终报价
  | 'customer_award'   // 客户定点
  | 'ecn'              // 设变
  | 'metal_escalation' // 金属联动
  | 'annual_drop'      // 年降
  | 'volume_change'    // 销量变更
  | 'eop_change'       // EOP 变更
  | 'custom';          // 自定义

/** 场景状态 (B1 lifecycle) */
export type ScenarioStatus = 'draft' | 'frozen' | 'published' | 'archived';

/** 场景记录 */
export interface ScenarioRecord {
  /** 主键 (uuid) */
  id: string;
  /** 所属项目 */
  projectId: string;
  /** 场景编号 (SCN-001, SCN-002, ...) */
  scenarioCode: string;
  /** 场景名称 (用户可编辑) */
  scenarioName: string;
  /** 场景类型 */
  scenarioType: ScenarioType;
  /** 父场景 ID (null = 根/基准) */
  parentScenarioId: string | null;
  /** 是否为基准场景 (每个项目恰好一个) */
  isBaseline: boolean;
  /** 生命周期年数 (从 ProjectMeta 搬来) */
  lifecycleYears: number;
  /** 完整项目配置 (从 Project.config 搬来) */
  config: ProjectConfig;
  /** 备注 (描述本场景变更内容) */
  note: string;
  /** 线束变更关系 (相对于父场景) */
  relations?: HarnessRelation[];
  /** 车型配置列表 */
  vehicleConfigs?: VehicleConfig[];
  /** 车型配置发布状态 */
  vehicleConfigMeta?: VehicleConfigMeta;
  /** B1: 场景状态 */
  status?: ScenarioStatus;
  frozenAt?: string;
  frozenBy?: string;
  publishedAt?: string;
  publishedBy?: string;
  archivedAt?: string;
  statusNote?: string;
  createdAt: string;
  updatedAt: string;
}

// Define table record types
export interface ProjectRecord extends Project {
  id: string;
}

export interface HarnessRecord {
  id: string;
  projectId: string;
  scenarioId: string;
  harnessId: string;
  harnessName: string;
  input: HarnessInput;
  result?: HarnessResult;
  /** 该线束在本场景中的 EOP 年份, null = 跟随场景 lifecycleYears */
  eopYear: number | null;
  /** B1: 是否被冻结 */
  locked?: boolean;
  lockedAt?: string | null;
  updatedAt: string;
}

export interface QuoteRecord extends QuoteSheet {
  id: string;
  projectId: string;
  version: string;
  status: string;
  updatedAt: string;
}

export interface SettingRecord {
  key: string;
  value: any;
  updatedAt: string;
}

export interface ImportLogRecord {
  id: string;
  projectId: string;
  harnessId: string;
  fileName: string;
  importedAt: string;
  totalRows: number;
  successRows: number;
  skippedRows: number;
  errors: string[];
}

export interface SyncQueueRecord {
  id: string;
  entity: string;
  entityId: string;
  operation: string;
  changedAt: string;
  synced: boolean;
  payload?: any;
  attempts: number;
  lastError?: string;
}

/** 一次性费用记录 (每条线束一条) */
export interface OnetimeCostRecord {
  /** 主键: `${scenarioId}::${harnessId}` */
  id: string;
  projectId: string;
  scenarioId: string;
  harnessId: string;
  harnessName: string;
  vehicleRatio: number;
  /** 一次性费用输入 */
  input: OnetimeCostInput;
  updatedAt: string;
}

/** 跟踪项记录（异常问题 / 费用追回） */
export interface TrackingItemRecord {
  id: string;
  projectId: string;
  category: 'anomaly' | 'recovery' | 'config_change' | 'sales_input';
  title: string;
  description: string;
  harnessId?: string;
  harnessName?: string;
  partNo?: string;
  partName?: string;
  costImpact: number;
  recoveredAmount?: number;
  status: 'open' | 'investigating' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  note?: string;
}

/** 分摊回收跟踪记录 */
export interface AllocTrackerRecord {
  /** 主键: `${scenarioId}::${harnessId}` */
  id: string;
  projectId: string;
  scenarioId: string;
  harnessId: string;
  /** 累计已生产数量 (根) */
  cumProduced: number;
  /** 从父场景继承的场景 ID */
  inheritedFromScenarioId: string | null;
  /** 最后更新时间 */
  updatedAt: string;
}

/** B13: 参数快照记录 */
export interface SettingsSnapshotRecord {
  id: string;
  timestamp: string;
  reason: string;
  summary: string;
  data: Record<string, unknown>;
}

/** B4: 报价快照记录 */
export interface QuoteSnapshotRecord {
  id: string;
  quoteId: string;
  scenarioId: string;
  projectId: string;
  version: number;
  label?: string;
  params: Record<string, unknown>;
  results: Record<string, unknown>;
  notes?: string;
  createdAt: string;
}

class CostWorkbenchDB extends Dexie {
  projects!: Table<ProjectRecord, string>;
  scenarios!: Table<ScenarioRecord, string>;
  harnesses!: Table<HarnessRecord, string>;
  quotes!: Table<QuoteRecord, string>;
  settings!: Table<SettingRecord, string>;
  versions!: Table<VersionRecord, string>;
  importLogs!: Table<ImportLogRecord, string>;
  syncQueue!: Table<SyncQueueRecord, string>;
  onetimeCosts!: Table<OnetimeCostRecord, string>;
  allocTrackers!: Table<AllocTrackerRecord, string>;
  trackingItems!: Table<TrackingItemRecord, string>;
  settingsSnapshots!: Table<SettingsSnapshotRecord, string>;
  quoteSnapshots!: Table<QuoteSnapshotRecord, string>;

  constructor() {
    super('CostWorkbenchDB');
    this.version(1).stores({
      projects: 'id, meta.projectCode, meta.customer, meta.status, meta.updatedAt',
      harnesses: 'id, projectId, harnessId, harnessName',
      quotes: 'id, projectId, version, status, updatedAt',
      settings: 'key',
    });
    this.version(2).stores({
      versions: 'id, projectId, [projectId+versionNumber]',
    });
    this.version(3).stores({
      importLogs: 'id, projectId, harnessId, importedAt',
    });
    this.version(4).stores({
      syncQueue: 'id, entity, entityId, synced, changedAt, [entity+entityId+synced]'
    });
    this.version(5).stores({
      onetimeCosts: 'id, projectId, harnessId, [projectId+harnessId]',
      allocTrackers: 'id, projectId, harnessId, [projectId+harnessId]',
    });
    this.version(6).stores({
      trackingItems: 'id, projectId, category, status, harnessId, createdAt',
    });
    this.version(7).stores({
      scenarios: 'id, projectId, parentScenarioId, isBaseline, scenarioType',
      harnesses: 'id, projectId, scenarioId, harnessId, [scenarioId+harnessId]',
      onetimeCosts: 'id, projectId, scenarioId, harnessId, [scenarioId+harnessId]',
      allocTrackers: 'id, projectId, scenarioId, harnessId, [scenarioId+harnessId]',
      versions: 'id, projectId, scenarioId, [projectId+versionNumber]',
      quotes: 'id, projectId, scenarioId, version, status, updatedAt',
    }).upgrade(async (tx) => {
      const projects = await tx.table('projects').toArray();
      for (const p of projects) {
        const scenarioId = crypto.randomUUID();
        await tx.table('scenarios').add({
          id: scenarioId,
          projectId: p.id,
          scenarioCode: 'SCN-001',
          scenarioName: '初始报价',
          scenarioType: 'initial_quote',
          parentScenarioId: null,
          isBaseline: true,
          lifecycleYears: p.meta?.lifecycleYears ?? 6,
          config: p.config ?? {},
          note: '从旧版项目自动迁移',
          status: 'draft',
          createdAt: p.meta?.createdAt ?? new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        const harnesses = await tx.table('harnesses')
          .where('projectId').equals(p.id).toArray();
        for (const h of harnesses) {
          await tx.table('harnesses').update(h.id, {
            scenarioId, eopYear: null,
          });
        }
        const costs = await tx.table('onetimeCosts')
          .where('projectId').equals(p.id).toArray();
        for (const c of costs) {
          await tx.table('onetimeCosts').update(c.id, { scenarioId });
        }
        const trackers = await tx.table('allocTrackers')
          .where('projectId').equals(p.id).toArray();
        for (const t of trackers) {
          await tx.table('allocTrackers').update(t.id, {
            scenarioId, inheritedFromScenarioId: null,
          });
        }
      }
    });
    // v8: 添加参数快照和报价快照表
    this.version(8).stores({
      settingsSnapshots: 'id, timestamp, reason',
      quoteSnapshots: 'id, quoteId, scenarioId, projectId, version, createdAt',
    });
  }
}

export const db = new CostWorkbenchDB();

db.scenarios.hook('reading', (obj) => {
  if (!obj) {
    return obj;
  }
  return applyE281ScenarioFallback(obj as ScenarioRecord);
});
