/**
 * engine/index.js
 * Issue #34: Node.js / 测试环境统一入口
 * 按依赖顺序加载所有 engine 模块，并通过 module.exports 导出
 *
 * 浏览器环境下无需引用此文件——各 HTML 页面已按正确顺序加载 <script> 标签。
 * Node.js 环境下使用: const engine = require('./engine');
 */
const g = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);

// ── 基础层（无依赖）──
require('../utils/shared');
require('./shared_utils');

// ── 状态层（依赖 shared_utils）──
require('./state_normalizer');
require('./snapshot_resolver');
require('./annual_calc');

// ── 桥接层 ──
require('./config_bridge');
require('./computation_path');
require('./error_boundary');
require('./computation_cache');

// ── 业务层 ──
require('./progress_price_tracker');
require('./residual_pool_handler');
require('./harness_profit'); // @deprecated legacy
require('./profit_shapley');
require('./target_price_solver');

// ── BOM 层 ──
require('./bom_parser');
require('./bom_schema');
require('./bom_db');
require('./align_key_enhancer');

// ── Schema 迁移 ──
require('./schema_migrator');

// ── 单线束号级核算层 (v2) ──
require('./harness_costing');
require('./change_pricing');
require('./metal_escalation');
require('./quote_template');

// ── 计算主入口 ──
require('./compute_model');

module.exports = {
  // 基础
  G281Shared:              g.G281Shared,
  G281SharedUtils:         g.G281SharedUtils,
  // 状态
  G281StateNormalizer:     g.G281StateNormalizer,
  G281SnapshotResolver:    g.G281SnapshotResolver,
  G281AnnualCalc:          g.G281AnnualCalc,
  // 桥接
  G281ConfigBridge:        g.G281ConfigBridge,
  G281ComputationPath:     g.G281ComputationPath,
  G281ErrorBoundary:       g.G281ErrorBoundary,
  G281ComputationCache:    g.G281ComputationCache,
  // 业务
  G281ProgressPriceTracker:g.G281ProgressPriceTracker,
  G281ResidualPoolHandler: g.G281ResidualPoolHandler,
  G281HarnessProfit:       g.G281HarnessProfit,
  G281ProfitShapley:       g.G281ProfitShapley,
  G281TargetPriceSolver:   g.G281TargetPriceSolver,
  // BOM
  G281BomParser:           g.G281BomParser,
  G281BomSchema:           g.G281BomSchema,
  G281BomDb:               g.G281BomDb,
  G281AlignKeyEnhancer:    g.G281AlignKeyEnhancer,
  // Schema
  G281SchemaMigrator:      g.G281SchemaMigrator,
  // 单线束号级核算 (v2)
  G281HarnessCosting:      g.G281HarnessCosting,
  G281ChangePricing:       g.G281ChangePricing,
  G281MetalEscalation:     g.G281MetalEscalation,
  G281QuoteTemplate:       g.G281QuoteTemplate,
  // 计算主入口
  G281ComputeModel:        g.G281ComputeModel,
};
