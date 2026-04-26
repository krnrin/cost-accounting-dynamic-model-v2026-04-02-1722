import Dexie, { type Table } from 'dexie';
import type { Project, ProjectConfig } from '../types/project';
import type {
  HarnessConfigMapping,
  HarnessInput,
  HarnessRelation,
  HarnessResult,
  VehicleConfig,
  VehicleConfigMeta,
  ConfigSku,
} from '../types/harness';
import type { VersionRecord } from '../types/version';
import type { OnetimeCostInput } from '../engine/onetime_alloc';
import type { ChangeOrder } from '../engine/change_verification';
// [PR-034] 删除 simulation_layers.ts，内联 SimulationLayer 类型
/** 仿真分层类型 */
export interface SimulationLayer {
  id: string;
  name: string;
  type: 'metal_price' | 'cost_rate' | 'bom_qty' | 'volume' | 'custom';
  overrides: Record<string, number>;
  enabled: boolean;
  order: number;
}
import type { PackagingScheme, PackagingLogisticsCost } from '../types/packaging';

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
  configSkus?: ConfigSku[];
  harnessConfigMappings?: HarnessConfigMapping[];
  simulationLayers?: SimulationLayer[];
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
  /** [PR-101] 快照引用 — 冻结时自动创建的快照ID */
  settingsSnapshotId?: string;
  quoteSnapshotId?: string;
  snapshotChainId?: string;
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

/** 报价记录 (legacy — customer quote template removed) */
export interface QuoteRecord {
  id: string;
  projectId: string;
  scenarioId?: string;
  version: string;
  status: string;
  updatedAt: string;
  /** 保留通用字段供未来扩展 */
  [key: string]: unknown;
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
  installationRatio?: number;
  /** 一次性费用输入 */
  input: OnetimeCostInput;
  updatedAt: string;
}

/** 跟踪项记录（异常问题 / 费用追回） */
export interface TrackingItemRecord {
  id: string;
  projectId: string;
  scenarioId?: string;
  changeEventId?: string;
  baselineVersionId?: string;
  compareVersionId?: string;
  source?: 'alert' | 'change_event' | 'stagnant_material' | 'manual';
  sourceAlertId?: string;
  severity?: 'critical' | 'warning' | 'info';
  category: 'anomaly' | 'recovery' | 'config_change' | 'sales_input';
  title: string;
  description: string;
  harnessId?: string;
  harnessName?: string;
  partNo?: string;
  partName?: string;
  costImpact: number;
  recoveredAmount?: number;
  remainingAmount?: number;
  needsPriceAdjustment?: boolean;
  status: 'open' | 'investigating' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  note?: string;
}

export interface ChangeEventBomRowRecord {
  harnessId: string;
  harnessName: string;
  partNo: string;
  partName: string;
  changeType: 'added' | 'removed' | 'qty_changed' | 'price_changed' | 'assembly_replace';
  beforeQty: number;
  afterQty: number;
  beforePrice: number;
  afterPrice: number;
  deltaAmount: number;
  replacedAssembly?: string;
  remainingQuantity?: number;
  rowKey?: string;
  rowIndex?: number;
  itemCategory?: string;
  supplier?: string;
  fieldChanges?: Array<{
    field: string;
    label?: string;
    before: unknown;
    after: unknown;
  }>;
}

export interface ChangeEventRecord {
  id: string;
  projectId: string;
  scenarioId: string;
  changeType: 'add' | 'replace' | 'cancel' | 'adjust';
  reason?: string;
  affectedHarnessIds: string[];
  affectedBomRows: ChangeEventBomRowRecord[];
  costImpact: number;
  quoteImpact: number;
  residualImpact: number;
  baselineVersionId?: string;
  compareVersionId?: string;
  status: 'draft' | 'calculated' | 'tracked' | 'closed';
  createdBy?: string;
  createdAt: string;
  updatedAt?: string;
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

export interface ChangeOrderRecord extends ChangeOrder {
  projectId: string;
  scenarioId: string;
  updatedAt: string;
}

/** C7: Gap 分析快照记录 */
export interface GapSnapshotRecord {
  /** 主键 (uuid) */
  id: string;
  /** 所属项目 */
  projectId: string;
  /** 所属场景 */
  scenarioId: string;
  /** 线束 ID（空表示整车级） */
  harnessId: string;
  /** 快照类型: quote=客户报价侧, internal=内部实绩侧 */
  snapshotType: 'quote' | 'internal';
  /** 金属价格来源 */
  metalSource: 'benchmark' | 'shfe_spot' | 'smm_spot' | 'customer_agreed';
  /** 快照时金属价格 */
  metalPrices: { copper: number; aluminum: number };
  /** Gap 分析结果数据 */
  gapResult: Record<string, unknown>;
  /** 可选标签 */
  label?: string;
  /** 创建时间 */
  createdAt: string;
}

/** C7: 金属价格历史记录 */
export interface MetalPriceHistoryRecord {
  /** 主键 (uuid) */
  id: string;
  /** 价格来源 */
  source: 'benchmark' | 'shfe_spot' | 'smm_spot' | 'manual';
  /** 铜价 (元/吨) */
  copper: number;
  /** 铝价 (元/吨) */
  aluminum: number;
  /** 记录时间 */
  recordedAt: string;
  /** 备注 */
  note?: string;
}

/** F09: 包装方案记录 */
export interface PackagingSchemeRecord {
  /** 主键: `${projectId}::${harnessId}` */
  id: string;
  /** 所属项目 */
  projectId: string;
  /** 线束零件号 */
  harnessId: string;
  /** 包装方案数据 */
  scheme: PackagingScheme;
  /** 更新时间 */
  updatedAt: string;
}

/** F10: 包装物流费用记录 */
export interface PackagingLogisticsRecord {
  /** 主键: `${projectId}::${harnessId}` 或 `${projectId}::${scenarioId}::${harnessId}` */
  id: string;
  /** 所属项目 */
  projectId: string;
  /** 所属场景 (可选，用于多场景区分) */
  scenarioId?: string;
  /** 线束零件号 */
  harnessId: string;
  /** 包装物流费用数据 */
  cost: PackagingLogisticsCost;
  /** 更新时间 */
  updatedAt: string;
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
  changeEvents!: Table<ChangeEventRecord, string>;
  settingsSnapshots!: Table<SettingsSnapshotRecord, string>;
  quoteSnapshots!: Table<QuoteSnapshotRecord, string>;
  changeOrders!: Table<ChangeOrderRecord, string>;
  gapSnapshots!: Table<GapSnapshotRecord, string>;
  metalPriceHistory!: Table<MetalPriceHistoryRecord, string>;
  packagingSchemes!: Table<PackagingSchemeRecord, string>;
  packagingLogistics!: Table<PackagingLogisticsRecord, string>;
  // [PR-084] 编辑锁表，用于并发控制
  editLocks!: Table<import('../engine/local_patch_overrides').EditLockRecord, number>;

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
    // v9: C7 Gap 分析快照 + 金属价格历史追踪
    this.version(9).stores({
      gapSnapshots: 'id, projectId, scenarioId, harnessId, snapshotType, metalSource, createdAt',
      metalPriceHistory: 'id, source, recordedAt',
    });
    // [FIX P1-2] v10: 回填 quotes/versions 的 scenarioId (v7 migration 遗漏)
    // v7 只迁移了 harnesses/onetimeCosts/allocTrackers 的 scenarioId，
    // 但 quotes 和 versions 表也在 v7 新增了 scenarioId 索引，
    // 已存在的记录未被回填，导致按场景查询时丢失数据
    this.version(10).stores({}).upgrade(async (tx) => {
      // 构建 projectId → baselineScenarioId 映射
      const scenarios = await tx.table('scenarios').toArray();
      const baselineMap = new Map<string, string>();
      for (const s of scenarios) {
        if (s.isBaseline && !baselineMap.has(s.projectId)) {
          baselineMap.set(s.projectId, s.id);
        }
      }

      // 回填 quotes
      const quotes = await tx.table('quotes').toArray();
      for (const q of quotes) {
        if (!q.scenarioId && q.projectId) {
          const sid = baselineMap.get(q.projectId);
          if (sid) {
            await tx.table('quotes').update(q.id, { scenarioId: sid });
          }
        }
      }

      // 回填 versions
      const versions = await tx.table('versions').toArray();
      for (const v of versions) {
        if (!v.scenarioId && v.projectId) {
          const sid = baselineMap.get(v.projectId);
          if (sid) {
            await tx.table('versions').update(v.id, { scenarioId: sid });
          }
        }
      }
    });
    this.version(11).stores({
      changeOrders: 'id, projectId, scenarioId, changeNo, status, createdAt, [projectId+scenarioId], [scenarioId+status]',
    });
    this.version(12).stores({
      trackingItems: 'id, projectId, scenarioId, category, status, harnessId, changeEventId, createdAt, [projectId+scenarioId], [scenarioId+status]',
      changeEvents: 'id, projectId, scenarioId, status, createdAt, baselineVersionId, compareVersionId, [projectId+scenarioId], [scenarioId+status]',
    });
    // v13: F09 包装方案 + F10 包装物流费用
    this.version(13).stores({
      packagingSchemes: 'id, projectId, harnessId, [projectId+harnessId]',
      packagingLogistics: 'id, projectId, harnessId, [projectId+harnessId]',
    });
    // [PR-084] v14: 编辑锁表，用于并发控制
    this.version(14).stores({
      editLocks: '++id, scenarioId, userId, expiresAt, [scenarioId+userId]',
    });
  }
}

export const db = new CostWorkbenchDB();
