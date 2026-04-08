/**
 * 配置风险检测引擎 — 从线束标配/选配属性自动识别配置拆分不充分
 */
import type { HarnessInput, HarnessRelation, HarnessRelationType, VehicleConfig } from '@/types/harness';
import type { TrackingItemRecord } from '@/data/db';

/** 配置风险检测结果 */
export interface ConfigRiskItem {
  severity: 'error' | 'warning' | 'info';
  code: string;
  family: string;
  harnessIds: string[];
  message: string;
}

/** 按功能位置分组 (优先 functionalSlot, 回退 harnessName) */
function groupBySlot(harnesses: HarnessInput[]): Map<string, HarnessInput[]> {
  const map = new Map<string, HarnessInput[]>();
  for (const h of harnesses) {
    const slot = h.functionalSlot || h.harnessName;
    if (!map.has(slot)) map.set(slot, []);
    map.get(slot)!.push(h);
  }
  return map;
}

/**
 * 单场景内检测配置拆分风险
 */
export function detectConfigRisks(harnesses: HarnessInput[]): ConfigRiskItem[] {
  const risks: ConfigRiskItem[] = [];
  const groups = groupBySlot(harnesses);

  for (const [family, members] of groups) {
    if (members.length <= 1) continue;

    const ids = members.map(m => m.harnessId);
    const hasConfigType = members.some(m => m.configType);
    const standards = members.filter(m => m.configType === 'S');
    const optionals = members.filter(m => m.configType === 'O');
    const ratioSum = members.reduce((s, m) => s + m.vehicleRatio, 0);

    // CFG-003: 装车比之和 > 1.0
    if (ratioSum > 1.005) {
      risks.push({
        severity: 'error', code: 'CFG-003', family, harnessIds: ids,
        message: `「${family}」装车比之和 ${ratioSum.toFixed(3)} > 1.0，同功能位置线束互斥，不应超过 1`,
      });
    }

    // CFG-002: 有选配件 → 配置维度未拆分
    if (optionals.length > 0) {
      risks.push({
        severity: 'warning', code: 'CFG-002', family, harnessIds: ids,
        message: `「${family}」有 ${optionals.length} 条选配线束(${optionals.map(o => o.harnessId).join(', ')})，表明存在未拆分的配置维度（如带PTC/不带PTC），建议确认配置拆分并更新装车比`,
      });

      // CFG-001: 选配件装车比与标配件不自洽
      const stdSum = standards.reduce((s, m) => s + m.vehicleRatio, 0);
      const optSum = optionals.reduce((s, m) => s + m.vehicleRatio, 0);
      if (standards.length > 0 && optionals.length > 0 && Math.abs(stdSum - optSum) > 0.01) {
        // 标配和选配应互补：每个标配件都有对应的选配替代
        // 如果比例差异大，说明不自洽
        risks.push({
          severity: 'warning', code: 'CFG-001', family, harnessIds: ids,
          message: `「${family}」标配件装车比之和(${stdSum.toFixed(3)}) ≠ 选配件装车比之和(${optSum.toFixed(3)})，标配/选配应互补覆盖所有配置`,
        });
      }
    }

    // CFG-004: 装车比之和 < 0.95
    if (ratioSum < 0.95 && ratioSum > 0) {
      risks.push({
        severity: 'info', code: 'CFG-004', family, harnessIds: ids,
        message: `「${family}」装车比之和 ${ratioSum.toFixed(3)} < 0.95，可能有遗漏的配置`,
      });
    }

    // CFG-005: 多条同名线束但未标注 configType
    if (!hasConfigType && members.length > 1) {
      risks.push({
        severity: 'info', code: 'CFG-005', family, harnessIds: ids,
        message: `「${family}」有 ${members.length} 条线束但未标注标配/选配，建议补充以启用配置完整性检查`,
      });
    }
  }

  return risks;
}

/**
 * 车型配置级检测
 */
export function detectVehicleConfigRisks(
  vehicleConfigs: VehicleConfig[],
  harnesses: HarnessInput[],
): ConfigRiskItem[] {
  const risks: ConfigRiskItem[] = [];
  if (!vehicleConfigs.length) return risks;

  // CFG-006: salesRatio 之和 != 1.0
  const ratioSum = vehicleConfigs.reduce((s, c) => s + c.salesRatio, 0);
  if (Math.abs(ratioSum - 1.0) > 0.005) {
    risks.push({
      severity: 'error', code: 'CFG-006',
      family: '车型配置',
      harnessIds: [],
      message: `车型配置销售比例之和 ${ratioSum.toFixed(3)} ≠ 1.0，应覆盖全部销量`,
    });
  }

  // CFG-007: 推算装车比与手动 vehicleRatio 不一致
  const ratioMap = new Map<string, number>();
  for (const cfg of vehicleConfigs) {
    for (const hid of cfg.harnessIds) {
      ratioMap.set(hid, (ratioMap.get(hid) || 0) + cfg.salesRatio);
    }
  }
  for (const h of harnesses) {
    const inferred = ratioMap.get(h.harnessId) || 0;
    if (inferred > 0 && Math.abs(inferred - h.vehicleRatio) > 0.005) {
      risks.push({
        severity: 'warning', code: 'CFG-007',
        family: h.functionalSlot || h.harnessName,
        harnessIds: [h.harnessId],
        message: `「${h.harnessId}」推算装车比 ${inferred.toFixed(3)} ≠ 手动值 ${h.vehicleRatio.toFixed(3)}`,
      });
    }
  }

  // CFG-008: 有线束未被任何车型配置引用
  const referencedIds = new Set(vehicleConfigs.flatMap(c => c.harnessIds));
  for (const h of harnesses) {
    if (!referencedIds.has(h.harnessId)) {
      risks.push({
        severity: 'info', code: 'CFG-008',
        family: h.functionalSlot || h.harnessName,
        harnessIds: [h.harnessId],
        message: `「${h.harnessId}」未被任何车型配置引用`,
      });
    }
  }

  return risks;
}

/**
 * 跨场景对比: 自动推断线束变更关联关系
 */
export function inferHarnessRelations(
  parentHarnesses: HarnessInput[],
  childHarnesses: HarnessInput[],
  parentScenarioId: string,
): HarnessRelation[] {
  const relations: HarnessRelation[] = [];
  const parentMap = new Map(parentHarnesses.map(h => [h.harnessId, h]));
  const childMap = new Map(childHarnesses.map(h => [h.harnessId, h]));
  const parentSlots = groupBySlot(parentHarnesses);
  const childSlots = groupBySlot(childHarnesses);

  // 1. 子场景有、父场景没有 → added 或 replaces
  for (const [id, child] of childMap) {
    if (parentMap.has(id)) continue;
    const slot = child.functionalSlot || child.harnessName;
    const parentInSlot = parentSlots.get(slot) || [];
    const missingFromChild = parentInSlot.filter(p => !childMap.has(p.harnessId));

    if (missingFromChild.length > 0) {
      relations.push({
        harnessId: id, relationType: 'replaces',
        targetHarnessId: missingFromChild[0]!.harnessId,
        targetScenarioId: parentScenarioId,
        note: `替代 ${missingFromChild[0]!.harnessId}`,
      });
    } else {
      relations.push({
        harnessId: id, relationType: 'added',
        targetHarnessId: null, targetScenarioId: parentScenarioId,
      });
    }
  }

  // 2. 父场景有、子场景没有 → cancelled 或 replaced_by
  for (const [id, parent] of parentMap) {
    if (childMap.has(id)) continue;
    const slot = parent.functionalSlot || parent.harnessName;
    const childInSlot = childSlots.get(slot) || [];
    const newInChild = childInSlot.filter(c => !parentMap.has(c.harnessId));

    if (newInChild.length > 0) {
      relations.push({
        harnessId: id, relationType: 'replaced_by',
        targetHarnessId: newInChild[0]!.harnessId,
        targetScenarioId: parentScenarioId,
        note: `被 ${newInChild[0]!.harnessId} 替代`,
      });
    } else {
      relations.push({
        harnessId: id, relationType: 'cancelled',
        targetHarnessId: null, targetScenarioId: parentScenarioId,
      });
    }
  }

  // 3. 两边都有 → 检查 configType 变更 或 拆分/合并
  for (const [id, child] of childMap) {
    const parent = parentMap.get(id);
    if (!parent) continue;

    if (parent.configType && child.configType && parent.configType !== child.configType) {
      relations.push({
        harnessId: id, relationType: 'config_changed',
        targetHarnessId: id, targetScenarioId: parentScenarioId,
        note: `${parent.configType} → ${child.configType}`,
      });
    }
  }

  // 4. 检测拆分: 父场景某功能位置 N 条 → 子场景 M 条 (M > N)
  for (const [slot, childMembers] of childSlots) {
    const parentMembers = parentSlots.get(slot) || [];
    if (childMembers.length > parentMembers.length && parentMembers.length > 0) {
      const newIds = childMembers.filter(c => !parentMap.has(c.harnessId));
      for (const n of newIds) {
        // 升级已有的 added relation 为 split_from
        const existing = relations.find(r => r.harnessId === n.harnessId);
        if (existing && existing.relationType === 'added') {
          existing.relationType = 'split_from';
          existing.targetHarnessId = parentMembers[0]!.harnessId;
          existing.note = `从「${slot}」配置拆分`;
        } else if (!existing) {
          relations.push({
            harnessId: n.harnessId, relationType: 'split_from',
            targetHarnessId: parentMembers[0]!.harnessId,
            targetScenarioId: parentScenarioId,
            note: `从「${slot}」配置拆分`,
          });
        }
      }
    }
  }

  return relations;
}

/**
 * 验证关联关系的一致性
 */
export function validateRelations(
  relations: HarnessRelation[],
  parentHarnesses: HarnessInput[],
  childHarnesses: HarnessInput[],
): ConfigRiskItem[] {
  const risks: ConfigRiskItem[] = [];
  const parentMap = new Map(parentHarnesses.map(h => [h.harnessId, h]));
  const childMap = new Map(childHarnesses.map(h => [h.harnessId, h]));

  for (const rel of relations) {
    const child = childMap.get(rel.harnessId);
    const parent = rel.targetHarnessId ? parentMap.get(rel.targetHarnessId) : null;

    // REL-001: 替代关系 — 新件装车比应 ≈ 旧件装车比
    if (rel.relationType === 'replaces' && child && parent) {
      if (Math.abs(child.vehicleRatio - parent.vehicleRatio) > 0.01) {
        risks.push({
          severity: 'warning', code: 'REL-001',
          family: child.functionalSlot || child.harnessName,
          harnessIds: [rel.harnessId, rel.targetHarnessId!],
          message: `「${rel.harnessId}」替代「${rel.targetHarnessId}」，装车比从 ${parent.vehicleRatio} 变为 ${child.vehicleRatio}，请确认`,
        });
      }
    }

    // REL-003: 取消的线束 — 分摊是否已回收？
    if (rel.relationType === 'cancelled') {
      const cancelledHarness = parentMap.get(rel.harnessId);
      if (cancelledHarness) {
        risks.push({
          severity: 'warning', code: 'REL-003',
          family: cancelledHarness.functionalSlot || cancelledHarness.harnessName,
          harnessIds: [rel.harnessId],
          message: `「${rel.harnessId}」已取消，请确认一次性费用分摊是否已回收完毕`,
        });
      }
    }

    // REL-004: 新增线束 — 是否需要分摊？
    if (rel.relationType === 'added' && child) {
      risks.push({
        severity: 'info', code: 'REL-004',
        family: child.functionalSlot || child.harnessName,
        harnessIds: [rel.harnessId],
        message: `新增线束「${rel.harnessId}」，请设置装车比和一次性费用`,
      });
    }

    // REL-005: S→O 未调装车比
    if (rel.relationType === 'config_changed' && child && parent) {
      if (parent.configType === 'S' && child.configType === 'O' && child.vehicleRatio >= parent.vehicleRatio) {
        risks.push({
          severity: 'warning', code: 'REL-005',
          family: child.functionalSlot || child.harnessName,
          harnessIds: [rel.harnessId],
          message: `「${rel.harnessId}」从标配转选配，装车比仍为 ${child.vehicleRatio}，请下调`,
        });
      }
    }
  }

  // REL-002: 拆分关系 — 子件装车比之和应 ≈ 父件装车比
  const splitGroups = new Map<string, HarnessRelation[]>();
  for (const rel of relations) {
    if (rel.relationType === 'split_from' && rel.targetHarnessId) {
      if (!splitGroups.has(rel.targetHarnessId)) splitGroups.set(rel.targetHarnessId, []);
      splitGroups.get(rel.targetHarnessId)!.push(rel);
    }
  }
  for (const [parentId, splits] of splitGroups) {
    const parent = parentMap.get(parentId);
    if (!parent) continue;
    const childRatioSum = splits.reduce((s, r) => {
      const c = childMap.get(r.harnessId);
      return s + (c?.vehicleRatio || 0);
    }, 0);
    // 加上父件本身如果还在子场景中
    const parentInChild = childMap.get(parentId);
    const totalSum = childRatioSum + (parentInChild?.vehicleRatio || 0);
    if (Math.abs(totalSum - parent.vehicleRatio) > 0.01) {
      risks.push({
        severity: 'warning', code: 'REL-002',
        family: parent.functionalSlot || parent.harnessName,
        harnessIds: [parentId, ...splits.map(s => s.harnessId)],
        message: `「${parent.functionalSlot || parent.harnessName}」配置拆分后装车比之和(${totalSum.toFixed(3)}) ≠ 原值(${parent.vehicleRatio})，请核实`,
      });
    }
  }

  return risks;
}

/**
 * 根据配置风险自动生成跟踪项
 */
export function generateConfigTrackingItems(
  projectId: string,
  risks: ConfigRiskItem[],
  relations: HarnessRelation[],
): Omit<TrackingItemRecord, 'id' | 'createdAt' | 'updatedAt'>[] {
  const now = new Date().toISOString();
  const items: Omit<TrackingItemRecord, 'id' | 'createdAt' | 'updatedAt'>[] = [];

  for (const risk of risks) {
    if (risk.severity === 'info') continue; // 只为 warning/error 生成跟踪项

    items.push({
      projectId,
      category: 'config_change',
      title: risk.message.length > 80 ? risk.message.slice(0, 80) + '...' : risk.message,
      description: risk.message,
      harnessId: risk.harnessIds[0],
      harnessName: risk.family,
      costImpact: 0,
      status: 'open',
      priority: risk.severity === 'error' ? 'high' : 'medium',
    });
  }

  // 新增线束也生成跟踪项 (即使是 info 级别的 REL-004)
  for (const rel of relations) {
    if (rel.relationType === 'added') {
      items.push({
        projectId,
        category: 'config_change',
        title: `新增线束「${rel.harnessId}」，请设置装车比和一次性费用`,
        description: `新增线束「${rel.harnessId}」，请设置装车比和一次性费用`,
        harnessId: rel.harnessId,
        costImpact: 0,
        status: 'open',
        priority: 'medium',
      });
    }
  }

  return items;
}
