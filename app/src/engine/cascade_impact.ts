import type { AssemblyPartRow, KskBomRow, SecondaryMaterialRow } from '@/types/bomWorkbook';
import type { BomRowChange } from '@/engine/change_detector';
import type { SemanticChange } from '@/engine/change_pattern_classifier';

export interface CascadeAction {
  targetSheet: 'assembly_parts' | 'secondary_material' | 'ksk_bom' | 'change_history';
  actionType: 'update' | 'add' | 'remove';
  rowKey?: string;
  data: Record<string, unknown>;
}

export interface ImpactPreviewRow {
  rowKey?: string;
  cells: Array<string | number>;
  changeType: 'added' | 'removed' | 'modified' | 'unchanged';
}

export interface ImpactResult {
  actions: CascadeAction[];
  preview: ImpactPreviewRow[];
}

// Track which changes have been handled by semantic patterns
interface SemanticContext {
  handledChanges: Set<string>;
  replaceMap: Map<string, { oldPartNo: string; newPartNo: string; newPartName: string }>;
  mergeMap: Map<string, { assemblyPartNo: string; assemblyPartName: string; componentPartNos: string[] }>;
  splitComponents: Set<string>;
}

function createSemanticContext(semanticChanges: SemanticChange[]): SemanticContext {
  const context: SemanticContext = {
    handledChanges: new Set(),
    replaceMap: new Map(),
    mergeMap: new Map(),
    splitComponents: new Set(),
  };

  for (const semantic of semanticChanges) {
    const changeIds = semantic.relatedChanges.map(c => `${c.changeType}::${c.partNo}`);

    switch (semantic.pattern) {
      case 'replace':
      case 'wire_spec_replace': {
        const removed = semantic.relatedChanges.find(c => c.changeType === 'removed');
        const added = semantic.relatedChanges.find(c => c.changeType === 'added');
        if (removed && added) {
          context.replaceMap.set(removed.partNo, {
            oldPartNo: removed.partNo,
            newPartNo: added.partNo,
            newPartName: added.partName,
          });
          changeIds.forEach(id => context.handledChanges.add(id));
        }
        break;
      }

      case 'merge': {
        const assembly = semantic.relatedChanges.find(c => c.changeType === 'added');
        const components = semantic.relatedChanges.filter(c => c.changeType === 'removed');
        if (assembly && components.length >= 2) {
          context.mergeMap.set(assembly.partNo, {
            assemblyPartNo: assembly.partNo,
            assemblyPartName: assembly.partName,
            componentPartNos: components.map(c => c.partNo),
          });
          changeIds.forEach(id => context.handledChanges.add(id));
        }
        break;
      }

      case 'split': {
        const components = semantic.relatedChanges.filter(c => c.changeType === 'added');
        components.forEach(c => context.splitComponents.add(c.partNo));
        changeIds.forEach(id => context.handledChanges.add(id));
        break;
      }
    }
  }

  return context;
}

export function computeAssemblyPartsImpact(
  changes: BomRowChange[],
  semanticChanges: SemanticChange[],
  rows: AssemblyPartRow[]
): ImpactResult {
  const actions: CascadeAction[] = [];
  const preview: ImpactPreviewRow[] = [];
  const context = createSemanticContext(semanticChanges);

  // Handle semantic patterns first
  handleSemanticPatterns(changes, semanticChanges, rows, actions, preview, context, 'assembly_parts');

  // Handle remaining changes with standard logic
  for (const change of changes) {
    const changeId = `${change.changeType}::${change.partNo}`;
    if (context.handledChanges.has(changeId)) continue;

    const matched = rows.find(row => row.partNo === change.partNo || row.sourceBomRowKey === change.rowKey);

    if (change.changeType === 'added') {
      // Check if this is part of a split - skip if already handled
      if (context.splitComponents.has(change.partNo)) continue;

      actions.push({
        targetSheet: 'assembly_parts',
        actionType: 'add',
        data: {
          partNo: change.partNo,
          partName: change.partName,
          qty: change.fieldChanges.find(f => f.field === 'qty')?.after ?? 1,
          supplier: change.fieldChanges.find(f => f.field === 'supplier')?.after ?? '',
          spec: change.fieldChanges.find(f => f.field === 'spec')?.after ?? '',
        },
      });
      preview.push({ cells: [change.partNo, change.partName, '-', '新增', '新增物料'], changeType: 'added' });
    } else if (change.changeType === 'removed' && matched) {
      actions.push({
        targetSheet: 'assembly_parts',
        actionType: 'remove',
        rowKey: matched.rowKey,
        data: { partNo: change.partNo },
      });
      preview.push({
        rowKey: matched.rowKey,
        cells: [change.partNo, change.partName, matched.qty, '删除', '删除物料'],
        changeType: 'removed',
      });
    } else if (change.changeType === 'modified' && matched) {
      const qtyField = change.fieldChanges.find(field => field.field === 'qty');
      const supplierField = change.fieldChanges.find(field => field.field === 'supplier');
      const specField = change.fieldChanges.find(field => field.field === 'spec');
      const unitPriceField = change.fieldChanges.find(field => field.field === 'unitPrice');

      // Check if this is a replace target - update part info instead of field update
      const replaceInfo = context.replaceMap.get(change.partNo);
      if (replaceInfo) {
        actions.push({
          targetSheet: 'assembly_parts',
          actionType: 'update',
          rowKey: matched.rowKey,
          data: {
            partNo: replaceInfo.newPartNo,
            partName: replaceInfo.newPartName,
            qty: qtyField?.after ?? matched.qty,
            supplier: supplierField?.after ?? matched.supplier,
            spec: specField?.after ?? matched.spec,
          },
        });
        preview.push({
          rowKey: matched.rowKey,
          cells: [`${change.partNo}→${replaceInfo.newPartNo}`, replaceInfo.newPartName, matched.qty, '物料替换', '物料替换'],
          changeType: 'modified',
        });
      } else {
        actions.push({
          targetSheet: 'assembly_parts',
          actionType: 'update',
          rowKey: matched.rowKey,
          data: {
            qty: qtyField?.after ?? matched.qty,
            supplier: supplierField?.after ?? matched.supplier,
            spec: specField?.after ?? matched.spec,
            unitPrice: unitPriceField?.after ?? matched.unitPrice,
          },
        });
        const changeDesc = qtyField ? `数量 ${qtyField.before}→${qtyField.after}` :
                          supplierField ? `供应商 ${supplierField.before}→${supplierField.after}` :
                          unitPriceField ? `单价 ${unitPriceField.before}→${unitPriceField.after}` : '字段修改';
        preview.push({
          rowKey: matched.rowKey,
          cells: [change.partNo, change.partName, matched.qty, changeDesc, '修改'],
          changeType: 'modified',
        });
      }
    }
  }

  // Apply split supplier inheritance
  applySplitSupplierInheritance(semanticChanges, rows, actions);

  return { actions, preview };
}

export function computeSecondaryMaterialImpact(
  changes: BomRowChange[],
  semanticChanges: SemanticChange[],
  rows: SecondaryMaterialRow[]
): ImpactResult {
  const actions: CascadeAction[] = [];
  const preview: ImpactPreviewRow[] = [];
  const context = createSemanticContext(semanticChanges);

  // Handle wire spec changes specially - may affect secondary materials
  const wireChanges = semanticChanges.filter(s => s.pattern === 'wire_spec_replace');
  for (const wireChange of wireChanges) {
    const modified = wireChange.relatedChanges.find(c => c.changeType === 'modified');
    if (modified) {
      // Wire spec change may trigger secondary material recalculation
      // Find related secondary materials (tape, tube, etc.)
      const relatedRows = rows.filter(row =>
        row.partName?.includes('胶带') ||
        row.partName?.includes('波纹管') ||
        row.partName?.includes('热缩管') ||
        row.sourceBomRowKey === (modified as any).rowKey
      );

      for (const relatedRow of relatedRows) {
        // Mark for review - wire spec change affects secondary materials
        preview.push({
          rowKey: relatedRow.rowKey,
          cells: [relatedRow.partNo, relatedRow.partName, relatedRow.qty, '需重新核算', '导线规格变化'],
          changeType: 'modified',
        });
      }
    }
  }

  // Handle semantic patterns
  handleSemanticPatterns(changes, semanticChanges, rows, actions, preview, context, 'secondary_material');

  // Handle remaining changes
  for (const change of changes) {
    const changeId = `${change.changeType}::${change.partNo}`;
    if (context.handledChanges.has(changeId)) continue;

    const matched = rows.find(row => row.partNo === change.partNo || row.sourceBomRowKey === change.rowKey);

    if (change.changeType === 'added') {
      if (context.splitComponents.has(change.partNo)) continue;

      actions.push({
        targetSheet: 'secondary_material',
        actionType: 'add',
        data: {
          partNo: change.partNo,
          partName: change.partName,
          qty: change.fieldChanges.find(f => f.field === 'qty')?.after ?? 1,
          supplier: change.fieldChanges.find(f => f.field === 'supplier')?.after ?? '',
        },
      });
      preview.push({ cells: [change.partNo, change.partName, '-', '新增', '新增物料'], changeType: 'added' });
    } else if (change.changeType === 'removed' && matched) {
      actions.push({
        targetSheet: 'secondary_material',
        actionType: 'remove',
        rowKey: matched.rowKey,
        data: { partNo: change.partNo },
      });
      preview.push({
        rowKey: matched.rowKey,
        cells: [change.partNo, change.partName, matched.qty, '删除', '删除物料'],
        changeType: 'removed',
      });
    } else if (change.changeType === 'modified' && matched) {
      const qtyField = change.fieldChanges.find(field => field.field === 'qty');
      const supplierField = change.fieldChanges.find(field => field.field === 'supplier');

      const replaceInfo = context.replaceMap.get(change.partNo);
      if (replaceInfo) {
        actions.push({
          targetSheet: 'secondary_material',
          actionType: 'update',
          rowKey: matched.rowKey,
          data: {
            partNo: replaceInfo.newPartNo,
            partName: replaceInfo.newPartName,
            qty: qtyField?.after ?? matched.qty,
            supplier: supplierField?.after ?? matched.supplier,
          },
        });
        preview.push({
          rowKey: matched.rowKey,
          cells: [`${change.partNo}→${replaceInfo.newPartNo}`, replaceInfo.newPartName, matched.qty, '物料替换', '物料替换'],
          changeType: 'modified',
        });
      } else {
        actions.push({
          targetSheet: 'secondary_material',
          actionType: 'update',
          rowKey: matched.rowKey,
          data: {
            qty: qtyField?.after ?? matched.qty,
            supplier: supplierField?.after ?? matched.supplier,
          },
        });
        const changeDesc = qtyField ? `数量 ${qtyField.before}→${qtyField.after}` : '字段修改';
        preview.push({
          rowKey: matched.rowKey,
          cells: [change.partNo, change.partName, matched.qty, changeDesc, '修改'],
          changeType: 'modified',
        });
      }
    }
  }

  applySplitSupplierInheritance(semanticChanges, rows, actions);
  return { actions, preview };
}

export function computeKskImpact(
  changes: BomRowChange[],
  semanticChanges: SemanticChange[],
  rows: KskBomRow[]
): ImpactResult {
  const actions: CascadeAction[] = [];
  const preview: ImpactPreviewRow[] = [];
  const context = createSemanticContext(semanticChanges);

  // Handle semantic patterns
  handleSemanticPatterns(changes, semanticChanges, rows, actions, preview, context, 'ksk_bom');

  // Handle remaining changes
  for (const change of changes) {
    const changeId = `${change.changeType}::${change.partNo}`;
    if (context.handledChanges.has(changeId)) continue;

    const matched = rows.find(row => row.partNo === change.partNo || row.sourceBomRowKey === change.rowKey);

    if (change.changeType === 'added') {
      if (context.splitComponents.has(change.partNo)) continue;

      actions.push({
        targetSheet: 'ksk_bom',
        actionType: 'add',
        data: {
          partNo: change.partNo,
          partName: change.partName,
          qty: change.fieldChanges.find(f => f.field === 'qty')?.after ?? 1,
          supplier: change.fieldChanges.find(f => f.field === 'supplier')?.after ?? '',
          spec: change.fieldChanges.find(f => f.field === 'spec')?.after ?? '',
        },
      });
      preview.push({ cells: [change.partNo, change.partName, '-', '新增', '新增物料'], changeType: 'added' });
    } else if (change.changeType === 'removed' && matched) {
      actions.push({
        targetSheet: 'ksk_bom',
        actionType: 'remove',
        rowKey: matched.rowKey,
        data: { partNo: change.partNo },
      });
      preview.push({
        rowKey: matched.rowKey,
        cells: [change.partNo, change.partName, matched.qty, '删除', '删除物料'],
        changeType: 'removed',
      });
    } else if (change.changeType === 'modified' && matched) {
      const qtyField = change.fieldChanges.find(field => field.field === 'qty');
      const supplierField = change.fieldChanges.find(field => field.field === 'supplier');
      const specField = change.fieldChanges.find(field => field.field === 'spec');

      const replaceInfo = context.replaceMap.get(change.partNo);
      if (replaceInfo) {
        actions.push({
          targetSheet: 'ksk_bom',
          actionType: 'update',
          rowKey: matched.rowKey,
          data: {
            partNo: replaceInfo.newPartNo,
            partName: replaceInfo.newPartName,
            qty: qtyField?.after ?? matched.qty,
            supplier: supplierField?.after ?? matched.supplier,
            remark: `物料替换: ${change.partNo} → ${replaceInfo.newPartNo}`,
          },
        });
        preview.push({
          rowKey: matched.rowKey,
          cells: [`${change.partNo}→${replaceInfo.newPartNo}`, replaceInfo.newPartName, matched.qty, '物料替换', '物料替换'],
          changeType: 'modified',
        });
      } else {
        actions.push({
          targetSheet: 'ksk_bom',
          actionType: 'update',
          rowKey: matched.rowKey,
          data: {
            qty: qtyField?.after ?? matched.qty,
            supplier: supplierField?.after ?? matched.supplier,
            remark: specField ? `规格更新: ${specField.before ?? '-'} -> ${specField.after ?? '-'}` : matched.remark,
          },
        });
        const changeDesc = qtyField ? `数量 ${qtyField.before}→${qtyField.after}` :
                          specField ? `规格 ${specField.before}→${specField.after}` : '字段修改';
        preview.push({
          rowKey: matched.rowKey,
          cells: [change.partNo, change.partName, matched.qty, changeDesc, '修改'],
          changeType: 'modified',
        });
      }
    }
  }

  applySplitSupplierInheritance(semanticChanges, rows, actions);
  return { actions, preview };
}

function handleSemanticPatterns<T extends { rowKey: string; partNo: string; partName?: string; qty?: number; supplier?: string; spec?: string; unit?: string }>(
  _changes: BomRowChange[],
  semanticChanges: SemanticChange[],
  rows: T[],
  actions: CascadeAction[],
  preview: ImpactPreviewRow[],
  context: SemanticContext,
  targetSheet: 'assembly_parts' | 'secondary_material' | 'ksk_bom',
): void {
  for (const semantic of semanticChanges) {
    switch (semantic.pattern) {
      case 'fixed_length': {
        // 定长化：散裁(M)→定长件(PCS)
        // 联动策略：删除原散裁行，新增定长件行（带定长标记）
        const removed = semantic.relatedChanges.find(c => c.changeType === 'removed');
        const added = semantic.relatedChanges.find(c => c.changeType === 'added');
        if (removed && added) {
          // 删除原散裁物料
          const matchedOld = rows.find(row => row.partNo === removed.partNo);
          if (matchedOld) {
            actions.push({
              targetSheet,
              actionType: 'remove',
              rowKey: matchedOld.rowKey,
              data: { partNo: removed.partNo },
            });
          }
          // 新增定长件
          const qtyField = added.fieldChanges.find(f => f.field === 'qty');
          actions.push({
            targetSheet,
            actionType: 'add',
            data: {
              partNo: added.partNo,
              partName: added.partName,
              qty: qtyField?.after ?? 1,
              spec: `定长件(${semantic.metadata?.afterLength || '定制'})`,
              unit: 'PCS',
              remark: `定长化变更: ${removed.partNo}→${added.partNo}`,
            },
          });
          preview.push({
            cells: [`${removed.partNo}→${added.partNo}`, added.partName, '散裁→定长', `定长${semantic.metadata?.afterLength || ''}`, '定长化'],
            changeType: 'modified',
          });
          context.handledChanges.add(`${removed.changeType}::${removed.partNo}`);
          context.handledChanges.add(`${added.changeType}::${added.partNo}`);
        }
        break;
      }

      case 'segmented_length': {
        // 分段定长：1根整长→多根定长段
        // 联动策略：删除原整长行，新增多行定长段
        const removed = semantic.relatedChanges.find(c => c.changeType === 'removed');
        const addedList = semantic.relatedChanges.filter(c => c.changeType === 'added');
        if (removed && addedList.length > 0) {
          // 删除原整长物料
          const matchedOld = rows.find(row => row.partNo === removed.partNo);
          if (matchedOld) {
            actions.push({
              targetSheet,
              actionType: 'remove',
              rowKey: matchedOld.rowKey,
              data: { partNo: removed.partNo },
            });
          }
          // 新增各定长段
          addedList.forEach((add, idx) => {
            const qtyField = add.fieldChanges.find(f => f.field === 'qty');
            actions.push({
              targetSheet,
              actionType: 'add',
              data: {
                partNo: add.partNo,
                partName: add.partName,
                qty: qtyField?.after ?? 1,
                spec: `定长段${idx + 1}/${addedList.length}(${semantic.metadata?.segmentLength || ''})`,
                unit: 'PCS',
                remark: `分段定长: ${semantic.metadata?.originalLength}m→${addedList.length}段`,
              },
            });
          });
          preview.push({
            cells: [removed.partNo, removed.partName, `${semantic.metadata?.originalLength}m×1`, `${addedList.length}段×${semantic.metadata?.segmentLength || '定长'}`, '分段定长'],
            changeType: 'modified',
          });
          context.handledChanges.add(`${removed.changeType}::${removed.partNo}`);
          addedList.forEach(a => context.handledChanges.add(`${a.changeType}::${a.partNo}`));
        }
        break;
      }

      case 'merge': {
        // 散件合总成：删除多个散件，新增一个总成
        const assembly = semantic.relatedChanges.find(c => c.changeType === 'added');
        const components = semantic.relatedChanges.filter(c => c.changeType === 'removed');
        if (assembly && components.length >= 2) {
          // Remove component rows
          for (const comp of components) {
            const matched = rows.find(row => row.partNo === comp.partNo);
            if (matched) {
              actions.push({
                targetSheet,
                actionType: 'remove',
                rowKey: matched.rowKey,
                data: { partNo: comp.partNo },
              });
            }
          }
          // Add assembly row
          actions.push({
            targetSheet,
            actionType: 'add',
            data: {
              partNo: assembly.partNo,
              partName: assembly.partName,
              qty: assembly.fieldChanges.find(f => f.field === 'qty')?.after ?? 1,
              supplier: assembly.fieldChanges.find(f => f.field === 'supplier')?.after ?? '',
            },
          });
          preview.push({
            cells: [assembly.partNo, assembly.partName, `${components.length}个散件→1个总成`, '散件合总成', '散件合总成'],
            changeType: 'modified',
          });
        }
        break;
      }

      case 'qty_explode': {
        // 数量炸开：特殊标记
        const modified = semantic.relatedChanges.find(c => c.changeType === 'modified');
        if (modified) {
          const qtyField = modified.fieldChanges.find(f => f.field === 'qty');
          if (qtyField) {
            const matched = rows.find(row => row.partNo === modified.partNo);
            if (matched) {
              actions.push({
                targetSheet,
                actionType: 'update',
                rowKey: matched.rowKey,
                data: {
                  qty: qtyField.after,
                  remark: `数量炸开: ${qtyField.before} → ${qtyField.after}`,
                },
              });
              preview.push({
                rowKey: matched.rowKey,
                cells: [modified.partNo, modified.partName, `${qtyField.before}→${qtyField.after}`, '数量炸开(需确认包装)', '数量炸开'],
                changeType: 'modified',
              });
            }
          }
        }
        break;
      }

      case 'replace':
      case 'wire_spec_replace': {
        const removed = semantic.relatedChanges.find(c => c.changeType === 'removed');
        const added = semantic.relatedChanges.find(c => c.changeType === 'added');
        if (removed && added) {
          const matched = rows.find(row => row.partNo === removed.partNo);
          if (matched) {
            actions.push({
              targetSheet,
              actionType: 'update',
              rowKey: matched.rowKey,
              data: {
                partNo: added.partNo,
                partName: added.partName,
              },
            });
            preview.push({
              rowKey: matched.rowKey,
              cells: [`${removed.partNo} -> ${added.partNo}`, added.partName, matched.qty ?? '', '物料替换', '物料替换'],
              changeType: 'modified',
            });
          }
        }
        break;
      }
    }
  }
}

function applySplitSupplierInheritance<T extends { rowKey: string; partNo: string; supplier?: string }>(
  semanticChanges: SemanticChange[],
  rows: T[],
  actions: CascadeAction[],
): void {
  for (const semantic of semanticChanges) {
    if (semantic.pattern !== 'split') continue;
    const removed = semantic.relatedChanges.find(change => change.changeType === 'removed');
    if (!removed) continue;
    const supplierField = removed.fieldChanges.find(field => field.field === 'supplier');
    const assemblySupplier = String(supplierField?.before ?? '');
    if (!assemblySupplier) continue;
    semantic.relatedChanges
      .filter(change => change.changeType === 'added')
      .forEach(change => {
        const matched = rows.find(row => row.partNo === change.partNo);
        if (matched && !matched.supplier) {
          actions.push({ targetSheet: inferTargetSheet(rows), actionType: 'update', rowKey: matched.rowKey, data: { supplier: assemblySupplier } });
        }
      });
  }
}

function inferTargetSheet(rows: Array<{ rowKey: string }>): 'assembly_parts' | 'secondary_material' | 'ksk_bom' {
  const sample = rows[0]?.rowKey || '';
  if (sample.includes('assembly')) return 'assembly_parts';
  if (sample.includes('secondary')) return 'secondary_material';
  return 'ksk_bom';
}
