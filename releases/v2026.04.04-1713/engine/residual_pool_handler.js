/**
 * residual_pool_handler.js — Issue #2: 残余材料池 = 变更取消料号呆滞提报
 *
 * 业务逻辑纠正：
 * 原实现：未匹配 BOM 行 → 按数量分摊到残余材料池 → 加入成本
 * 正确逻辑：
 *   未匹配 = 变更取消的料号 → 走呆滞物料提报流程，**不**分摊到当前产品成本
 *   保留导线信息（型号、供应商等），以防后续切换回来
 *
 * 呆滞物料提报流程：
 *   1. 识别未匹配料号（旧版有、新版无）
 *   2. 标记为「呆滞候选」
 *   3. 检查是否有库存（需要人工确认）
 *   4. 有库存 → 提报呆滞，走报废/转售/退供应商流程
 *   5. 无库存 → 仅做台账记录，无实际损失
 *   6. 若后续变更又加回该料号 → 恢复，取消呆滞标记
 */
(function (global) {
  'use strict';

  const STAGNANT_STATUS = {
    CANDIDATE: 'candidate',      // 候选（刚检测到未匹配）
    CONFIRMED: 'confirmed',      // 已确认呆滞（人工确认有库存）
    NO_STOCK: 'no_stock',        // 无库存（仅台账记录）
    SCRAPPED: 'scrapped',        // 已报废
    RETURNED: 'returned',        // 已退供应商
    RESOLD: 'resold',            // 已转售
    RESTORED: 'restored',        // 已恢复（后续变更又加回）
  };

  /**
   * 从 BOM 对齐结果中提取未匹配料号（变更取消候选）
   * @param {Object} alignmentResult - G281BomAlignmentEngine.alignBomReleases() 的输出
   * @returns {Array} 呆滞候选列表
   */
  function extractStagnantCandidates(alignmentResult) {
    const candidates = [];
    const harnesses = alignmentResult?.harnesses || [];

    harnesses.forEach(harness => {
      const groups = harness?.groups || [];
      groups.forEach(group => {
        const rows = group?.rows || [];
        rows.forEach(row => {
          // left_only = 旧版有、新版无 = 变更取消
          if (row.rowType === 'left_only' && row.left) {
            candidates.push({
              id: `${harness.harnessNo}::${row.left.itemId || row.left.partNo}`,
              harnessNo: harness.harnessNo,
              partNo: row.left.partNo || '',
              sapNo: row.left.sapNo || '',
              partName: row.left.partName || '',
              itemCategory: group.itemCategory || '',
              endGroup: group.endGroup || '',
              qty: Number(row.left.qty) || 0,
              unit: row.left.unit || '',
              supplier: row.left.supplier || '',
              // 保留完整导线信息以防切换回来
              wireInfo: row.left.wireInfo || null,
              catalogCode: row.left.catalogCode || '',
              catalogName: row.left.catalogName || '',
              // 呆滞状态
              stagnantStatus: STAGNANT_STATUS.CANDIDATE,
              detectedAt: new Date().toISOString(),
              confirmedAt: null,
              disposedAt: null,
              disposalMethod: null,
              hasStock: null,     // null = 未确认, true/false = 人工确认后
              stockQty: null,
              stockValue: null,
              notes: '',
            });
          }
        });
      });
    });

    return candidates;
  }

  /**
   * 人工确认库存后更新呆滞状态
   * @param {Object} candidate - 呆滞候选
   * @param {Object} confirmation
   * @param {boolean} confirmation.hasStock
   * @param {number} [confirmation.stockQty]
   * @param {number} [confirmation.stockValue]
   * @param {string} [confirmation.notes]
   * @returns {Object} 更新后的候选
   */
  function confirmStagnant(candidate, confirmation) {
    const updated = { ...candidate };
    updated.hasStock = Boolean(confirmation?.hasStock);
    updated.confirmedAt = new Date().toISOString();

    if (updated.hasStock) {
      updated.stagnantStatus = STAGNANT_STATUS.CONFIRMED;
      updated.stockQty = Number(confirmation?.stockQty) || 0;
      updated.stockValue = Number(confirmation?.stockValue) || 0;
    } else {
      updated.stagnantStatus = STAGNANT_STATUS.NO_STOCK;
    }

    if (confirmation?.notes) {
      updated.notes = confirmation.notes;
    }

    return updated;
  }

  /**
   * 处置呆滞物料
   * @param {Object} candidate - 已确认的呆滞候选
   * @param {string} method - 'scrapped' | 'returned' | 'resold'
   * @returns {Object} 处置后的记录
   */
  function disposeStagnant(candidate, method) {
    if (!['scrapped', 'returned', 'resold'].includes(method)) {
      throw new Error(`Invalid disposal method: ${method}`);
    }
    return {
      ...candidate,
      stagnantStatus: STAGNANT_STATUS[method.toUpperCase()],
      disposedAt: new Date().toISOString(),
      disposalMethod: method,
    };
  }

  /**
   * 恢复料号（后续变更又加回）
   * @param {Object} candidate
   * @returns {Object}
   */
  function restoreStagnant(candidate) {
    return {
      ...candidate,
      stagnantStatus: STAGNANT_STATUS.RESTORED,
      restoredAt: new Date().toISOString(),
    };
  }

  /**
   * 检查新版 BOM 是否恢复了之前标记为呆滞的料号
   * @param {Array} stagnantList - 当前呆滞列表
   * @param {Object} newAlignmentResult - 最新 BOM 对齐结果
   * @returns {Object} { restored: [...], remaining: [...] }
   */
  function checkRestorations(stagnantList, newAlignmentResult) {
    const newPartNos = new Set();
    (newAlignmentResult?.harnesses || []).forEach(h => {
      (h?.groups || []).forEach(g => {
        (g?.rows || []).forEach(r => {
          if (r.right?.partNo) newPartNos.add(normalizePN(r.right.partNo));
        });
      });
    });

    const restored = [];
    const remaining = [];

    (stagnantList || []).forEach(item => {
      if (item.stagnantStatus === STAGNANT_STATUS.RESTORED ||
          item.stagnantStatus === STAGNANT_STATUS.SCRAPPED ||
          item.stagnantStatus === STAGNANT_STATUS.RETURNED ||
          item.stagnantStatus === STAGNANT_STATUS.RESOLD) {
        remaining.push(item);
        return;
      }

      if (newPartNos.has(normalizePN(item.partNo))) {
        restored.push(restoreStagnant(item));
      } else {
        remaining.push(item);
      }
    });

    return { restored, remaining };
  }

  /**
   * 汇总呆滞物料统计
   * @param {Array} stagnantList
   * @returns {Object}
   */
  function summarizeStagnant(stagnantList) {
    const items = stagnantList || [];
    return {
      total: items.length,
      candidateCount: items.filter(i => i.stagnantStatus === STAGNANT_STATUS.CANDIDATE).length,
      confirmedCount: items.filter(i => i.stagnantStatus === STAGNANT_STATUS.CONFIRMED).length,
      noStockCount: items.filter(i => i.stagnantStatus === STAGNANT_STATUS.NO_STOCK).length,
      disposedCount: items.filter(i => ['scrapped', 'returned', 'resold'].includes(i.stagnantStatus)).length,
      restoredCount: items.filter(i => i.stagnantStatus === STAGNANT_STATUS.RESTORED).length,
      totalStockValue: items
        .filter(i => i.stagnantStatus === STAGNANT_STATUS.CONFIRMED)
        .reduce((s, i) => s + (Number(i.stockValue) || 0), 0),
    };
  }

  function normalizePN(value) {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, '');
  }

  // --- 导出 ---
  const api = {
    extractStagnantCandidates,
    confirmStagnant,
    disposeStagnant,
    restoreStagnant,
    checkRestorations,
    summarizeStagnant,
    STAGNANT_STATUS,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  global.G281ResidualPoolHandler = api;
})(typeof window !== 'undefined' ? window : globalThis);
