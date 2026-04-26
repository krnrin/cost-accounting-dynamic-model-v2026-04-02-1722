/**
 * 增量计算引擎 — DAG 依赖图 + 局部重算
 * 
 * 当用户在模拟页面调整某个参数时，只重算受影响的成本节点，
 * 跳过未受影响的节点，提升响应速度。
 */

/** Cost node identifiers */
export type CostNodeId =
  | 'material'
  | 'waste'
  | 'labor'
  | 'manufacturing'
  | 'mgmtFee'
  | 'profit'
  | 'exFactoryPrice'
  | 'packSubtotal'
  | 'freightSubtotal'
  | 'deliveredPrice';

/** A single node in the cost DAG */
export interface CostNode {
  id: CostNodeId;
  /** IDs of nodes this node depends on */
  dependencies: CostNodeId[];
  /** Compute this node's value from the values of its dependencies + params */
  compute: (deps: Record<CostNodeId, number>, params: CostParams) => number;
}

/** Parameters needed for computation */
export interface CostParams {
  /** Total BOM material cost (from items + metal prices) */
  rawMaterialCost: number;
  /** Process hours (frontHours + backHours) */
  processHours: number;
  /** Labor rate (元/h) */
  laborRate: number;
  /** Manufacturing rate (元/h) */
  mfgRate: number;
  /** Waste rate (fraction, e.g. 0.01) */
  wasteRate: number;
  /** Management fee rate (fraction) */
  mgmtRate: number;
  /** Profit rate (fraction) */
  profitRate: number;
  /** Packaging subtotal (元) */
  packTotal: number;
  /** Freight subtotal (元) */
  freightTotal: number;
  // [PR-097] 扩展制造分项费率，与主引擎 harness_costing.ts 对齐
  /** 设备折旧费率 (元/h) */
  equipmentDepreciationRate?: number;
  /** 厂房租金费率 (元/h) */
  facilityRentRate?: number;
  /** 能源费率 (元/h) */
  energyRate?: number;
  /** 维保费率 (元/h) */
  maintenanceRate?: number;
  /** 质量费率 (元/h) */
  qualityRate?: number;
  /** 其他制造费率 (元/h) */
  otherMfgRate?: number;
  /** 间接人工费率 (元/h) */
  indirectLaborRate?: number;
}

/** Build the standard cost DAG */
export function buildCostDAG(): Map<CostNodeId, CostNode> {
  const nodes: CostNode[] = [
    {
      id: 'material',
      dependencies: [],
      compute: (_deps, params) => params.rawMaterialCost,
    },
    {
      id: 'waste',
      dependencies: ['material'],
      compute: (deps, params) => deps.material * params.wasteRate,
    },
    {
      id: 'labor',
      dependencies: [],
      compute: (_deps, params) => params.processHours * params.laborRate,
    },
    {
      id: 'manufacturing',
      dependencies: [],
      // [PR-097] 支持分项费率：若分项费率存在则求和，否则使用简化版 mfgRate
      compute: (_deps, params) => {
        const hours = params.processHours;
        const detailed = (params.equipmentDepreciationRate ?? 0) +
          (params.facilityRentRate ?? 0) +
          (params.energyRate ?? 0) +
          (params.maintenanceRate ?? 0) +
          (params.qualityRate ?? 0) +
          (params.otherMfgRate ?? 0) +
          (params.indirectLaborRate ?? 0);
        // 若有分项费率则使用分项，否则使用简化版
        return detailed > 0 ? hours * detailed : hours * params.mfgRate;
      },
    },
    {
      id: 'mgmtFee',
      dependencies: ['material', 'labor', 'manufacturing'],
      compute: (deps, params) =>
        (deps.material + deps.labor + deps.manufacturing) * params.mgmtRate,
    },
    {
      id: 'profit',
      dependencies: ['material', 'waste', 'labor', 'manufacturing', 'mgmtFee'],
      compute: (deps, params) =>
        (deps.material + deps.waste + deps.labor + deps.manufacturing + deps.mgmtFee) * params.profitRate,
    },
    {
      id: 'exFactoryPrice',
      dependencies: ['material', 'waste', 'labor', 'manufacturing', 'mgmtFee', 'profit'],
      compute: (deps, _params) =>
        deps.material + deps.waste + deps.labor + deps.manufacturing + deps.mgmtFee + deps.profit,
    },
    {
      id: 'packSubtotal',
      dependencies: [],
      compute: (_deps, params) => params.packTotal,
    },
    {
      id: 'freightSubtotal',
      dependencies: [],
      compute: (_deps, params) => params.freightTotal,
    },
    {
      id: 'deliveredPrice',
      dependencies: ['exFactoryPrice', 'packSubtotal', 'freightSubtotal'],
      compute: (deps, _params) =>
        deps.exFactoryPrice + deps.packSubtotal + deps.freightSubtotal,
    },
  ];

  const dag = new Map<CostNodeId, CostNode>();
  nodes.forEach(n => dag.set(n.id, n));
  return dag;
}

/** Compute ALL nodes in topological order */
export function computeAll(params: CostParams): Record<CostNodeId, number> & { dagVersion: number } {
  const dag = buildCostDAG();
  const values: Record<string, number> = {} as any;
  const order = topoSort(dag);
  for (const nodeId of order) {
    const node = dag.get(nodeId)!;
    values[nodeId] = node.compute(values as Record<CostNodeId, number>, params);
  }
  // [PR-098] 返回dagVersion用于校验计算结果版本一致性
  return { ...values as Record<CostNodeId, number>, dagVersion: 1 };
}

/**
 * Incremental recompute — only recalculate nodes affected by `changedNodes`.
 * 
 * @param prevValues - Previous computed values for all nodes
 * @param changedNodes - Set of node IDs whose inputs have changed
 * @param newParams - Updated parameters
 * @returns Updated values (only touched nodes are recomputed)
 */
export function recomputeFrom(
  prevValues: Record<CostNodeId, number>,
  changedNodes: Set<CostNodeId>,
  newParams: CostParams
): { values: Record<CostNodeId, number>; recomputed: CostNodeId[] } {
  const dag = buildCostDAG();
  
  // 1. Find all affected nodes (changed + their downstream dependents)
  const affected = findAffected(dag, changedNodes);
  
  // 2. Topological sort only affected nodes
  const order = topoSort(dag).filter(id => affected.has(id));
  
  // 3. Recompute only affected nodes
  const values = { ...prevValues };
  const recomputed: CostNodeId[] = [];
  
  for (const nodeId of order) {
    const node = dag.get(nodeId)!;
    values[nodeId] = node.compute(values as Record<CostNodeId, number>, newParams);
    recomputed.push(nodeId);
  }
  
  return { values: values as Record<CostNodeId, number>, recomputed };
}

/**
 * Find all downstream dependents of the given changed nodes.
 * Uses reverse BFS on the DAG.
 */
function findAffected(dag: Map<CostNodeId, CostNode>, changed: Set<CostNodeId>): Set<CostNodeId> {
  // Build reverse adjacency: child → parents that depend on it
  const reverseDeps = new Map<CostNodeId, Set<CostNodeId>>();
  for (const [id, node] of dag) {
    for (const dep of node.dependencies) {
      if (!reverseDeps.has(dep)) reverseDeps.set(dep, new Set());
      reverseDeps.get(dep)!.add(id);
    }
  }
  
  const affected = new Set<CostNodeId>(changed);
  const queue = [...changed];
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    const dependents = reverseDeps.get(current);
    if (dependents) {
      for (const dep of dependents) {
        if (!affected.has(dep)) {
          affected.add(dep);
          queue.push(dep);
        }
      }
    }
  }
  
  return affected;
}

/** Topological sort using Kahn's algorithm */
function topoSort(dag: Map<CostNodeId, CostNode>): CostNodeId[] {
  const inDegree = new Map<CostNodeId, number>();
  const adjList = new Map<CostNodeId, CostNodeId[]>();

  for (const [id, node] of dag) {
    inDegree.set(id, node.dependencies.length);
    for (const dep of node.dependencies) {
      if (!adjList.has(dep)) adjList.set(dep, []);
      adjList.get(dep)!.push(id);
    }
  }

  // [PR-113] 使用稳定排序：按节点ID排序确保跨平台一致性
  const queue: CostNodeId[] = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id);
  }
  queue.sort(); // 稳定排序

  const sorted: CostNodeId[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    sorted.push(node);
    const children = adjList.get(node) || [];
    // 收集新入度为0的节点并排序
    const newReady: CostNodeId[] = [];
    for (const child of children) {
      const newDeg = (inDegree.get(child) || 1) - 1;
      inDegree.set(child, newDeg);
      if (newDeg === 0) newReady.push(child);
    }
    // [PR-113] 稳定排序后插入队列
    newReady.sort();
    queue.push(...newReady);
  }

  return sorted;
}

/**
 * Map parameter changes to affected root nodes.
 * Helper for SimulationPage slider usage.
 */
export function paramChangeToNodes(paramName: string): CostNodeId[] {
  const mapping: Record<string, CostNodeId[]> = {
    copperPrice: ['material'],
    aluminumPrice: ['material'],
    rawMaterialCost: ['material'],
    laborRate: ['labor'],
    mfgRate: ['manufacturing'],
    processHours: ['labor', 'manufacturing'],
    wasteRate: ['waste'],
    mgmtRate: ['mgmtFee'],
    profitRate: ['profit'],
    packTotal: ['packSubtotal'],
    freightTotal: ['freightSubtotal'],
  };
  return mapping[paramName] || [];
}
