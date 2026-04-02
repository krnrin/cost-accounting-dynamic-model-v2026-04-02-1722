/**
 * computation_path.js — 计算路径指示器
 *
 * 职责：
 * 1. 判断当前模型使用的是 estimatedPath 还是 exactPath
 * 2. 生成 UI 可用的路径提示信息
 *
 * 业务规则：
 * - exactPath（精确路径）：所有输入参数与 financialVersions 中的快照完全匹配
 *   → 直接使用 Excel 报价表中的精确数据
 *   → 结果与客户提交的报价完全一致
 *
 * - estimatedPath（估算路径）：用户修改了某些参数，或使用了混合状态
 *   → 使用二分法公式计算（matBase = Σ 成分系数 × 因子）
 *   → 结果是估算值，用于变更评估和 what-if 模拟
 *   → ⚠️ 系数来源于历史拟合，非精确分解
 *
 * Issue #4 — 计算路径系数
 */
;(function (global) {
  'use strict';

  var ComputationPath = {
    /**
     * 从模型结果判断计算路径
     * @param {Object} model - computeModel 的输出
     * @returns  path: string, label: string, description: string, warning: string|null
     */
    detect: function (model) {
      if (!model) {
        return {
          path: 'unknown',
          label: '未知',
          description: '模型未加载',
          warning: null,
        };
      }

      // exactFinancialVersionKey 存在 → exactPath
      if (model.exactFinancialVersionKey || (model.financialContext && model.financialContext.exactApplied)) {
        var exactKey = model.exactFinancialVersionKey || model.financialContext.exactKey || '';
        return {
          path: 'exact',
          label: '精确路径',
          description: '所有参数与 ' + exactKey + ' 版本完全匹配，使用报价表精确数据。',
          warning: null,
        };
      }

      // 否则 → estimatedPath
      var mc = global.ConfigBridge ? global.ConfigBridge.materialComposition() : null;
      var coeffDesc = mc
        ? '连接器 ' + mc.connector + ' + 铜 ' + mc.copper + ' + 铝 ' + mc.aluminum + ' + 其他 ' + mc.other
        : '0.24 + 0.38 + 0.18 + 0.20';

      return {
        path: 'estimated',
        label: '估算路径',
        description: '参数已修改或为混合状态，使用二分法公式计算。材料成本系数：' + coeffDesc + '。',
        warning: '⚠️ 估算路径的系数基于历史拟合，结果仅供变更评估参考，不等于精确报价。',
      };
    },

    /**
     * 生成路径对比摘要（用于 UI 卡片）
     * @param {Object} model
     * @returns  badge: string, color: string, tooltip: string
     */
    badge: function (model) {
      var info = ComputationPath.detect(model);
      if (info.path === 'exact') {
        return {
          badge: '✓ 精确',
          color: 'green',
          tooltip: info.description,
        };
      }
      return {
        badge: '≈ 估算',
        color: 'orange',
        tooltip: info.description + (info.warning ? '\n' + info.warning : ''),
      };
    },
  };

  global.ComputationPath = ComputationPath;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
