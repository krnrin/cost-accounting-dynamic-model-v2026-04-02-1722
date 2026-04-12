# Engine 拆分迁移指南 (Issue #9)

## 新增子模块

| 文件 | 全局命名空间 | 职责 |
|---|---|---|
| `engine/shared_utils.js` | `G281SharedUtils` | 共享工具函数（numberOr, safeArray 等）+ 常量 |
| `engine/state_normalizer.js` | `G281StateNormalizer` | 状态归一化、年降/一次性/返利版本模板、连接器场景 |
| `engine/snapshot_resolver.js` | `G281SnapshotResolver` | BOM/资本版本快照、financial exact 匹配 |
| `engine/annual_calc.js` | `G281AnnualCalc` | 年度行计算、对比行、组合摘要、精确财务模型 |

## 加载顺序（HTML script 标签）

```html
<!-- engine 子模块（必须按依赖顺序加载） -->
<script src="engine/shared_utils.js"></script>
<script src="engine/state_normalizer.js"></script>
<script src="engine/snapshot_resolver.js"></script>
<script src="engine/annual_calc.js"></script>

<!-- 其他 engine 模块 -->
<script src="engine/config_bridge.js"></script>
<script src="engine/computation_path.js"></script>
<script src="engine/profit_shapley.js"></script>
<script src="engine/progress_price_tracker.js"></script>
<script src="engine/residual_pool_handler.js"></script>

<!-- compute_model 最后加载（组装层） -->
<script src="engine/compute_model.js"></script>
<script src="engine/harness_profit.js"></script>
<script src="engine/target_price_solver.js"></script>
```

## 迁移步骤

### Step 1: 在 HTML 中添加 script 标签
在 `dashboard.html`（以及未来的预演/核算/跟踪/归档页面）中，按上述顺序添加 4 个新的 `<script>` 标签。

### Step 2: 瘦身 compute_model.js
从 `compute_model.js` 中**删除**以下已提取到子模块的函数：

**→ shared_utils.js 已提取：**
- `clamp`, `weighted`, `normalizeMix`
- `FINANCIAL_VERSION_KEYS`, `STATE_FINANCIAL_VERSION_MAP`
- `numberOr`, `safeArray`, `clonePlain`, `approxEqual`, `arraysClose`

**→ state_normalizer.js 已提取：**
- `stateFinancialVersionKey`, `resolvePureFinancialVersionKey`, `resolveReferenceFinancialVersionKey`
- `normalizeLifecycleYear`, `lifecycleYears`, `legacyAnnualDropRows`
- `normalizeAnnualDropVersion`, `normalizeOneTimeCustomerEntries`, `normalizeOneTimeCustomerVersion`
- `normalizeRebateVersion`, `hasLifecycleBusinessEffect`
- `connectorBaseCostDefault`, `connectorVersionKey`, `specialConnectorStages`
- `connectorStageSet`, `connectorProtocolRows`, `connectorProtocolWeight`
- `buildConnectorProgressMeta`, `connectorStageMeta`, `normalizeConnectorPricing`
- `buildConnectorScenario`, `summarizeBomChanges`

**→ snapshot_resolver.js 已提取：**
- `financialVersionEntries`, `financialVersion`, `financialVersionData`
- `validationCapitalAmount`, `bomVersionSnapshot`, `capitalVersionSnapshot`
- `lifecycleVersionKey`, `lifecycleMetalBaseline`, `lifecycleMixBaseline`
- `lifecycleLaborSnapshot`, `lifecyclePackagingSnapshot`
- `bomDraftMatches`, `resolveExactFinancialVersion`
- `detectFinancialDriftWarnings`, `effectiveDraftForFinancial`

**→ annual_calc.js 已提取：**
- `annualValueAt`, `buildAnnualRowsFromFinancial`, `buildAnnualRowsFromComputed`
- `enrichComputedAnnualRows`, `quoteCompareBase`, `buildCompareRows`
- `buildPortfolioSummary`, `buildExactFinancialModel`

### Step 3: 在 compute_model.js 中通过全局命名空间调用

瘦身后的 `compute_model.js` 开头添加：

```js
(function (global) {
  'use strict';

  const U  = global.G281SharedUtils;
  const SN = global.G281StateNormalizer;
  const SR = global.G281SnapshotResolver;
  const AC = global.G281AnnualCalc;

  const { numberOr, safeArray, clonePlain, clamp, weighted, normalizeMix } = U;
  // ... 然后在 computeModel / computeModelV2 中用 SN.xxx / SR.xxx / AC.xxx 调用
```

### Step 4: 修复已知 Bug

当前 `compute_model.js` 中有 `root.ConfigBridge` / `root.ComputationPath` 引用，
应改为 `global.ConfigBridge` / `global.ComputationPath`（IIFE 参数是 `global` 不是 `root`）。

### Step 5: 验证

1. 打开 dashboard.html，确认控制台无报错
2. 切换状态组合，检查 KPI 数字一致
3. 检查 financial exact 路径能否正常触发
4. 检查连接器场景、年降、一次性、返利计算

## 文件大小对比

| 变更前 | 变更后 |
|---|---|
| `compute_model.js` 71KB (1700行) | `compute_model.js` ~12KB (~280行，仅组装层) |
| - | `shared_utils.js` ~3KB |
| - | `state_normalizer.js` ~13KB |
| - | `snapshot_resolver.js` ~11KB |
| - | `annual_calc.js` ~10KB |

## 兼容性

- 子模块使用与原代码相同的 IIFE + window 全局模式
- 对外 API 不变：`window.G281Engine.computeModel(...)` 签名完全兼容
- `target_price_solver.js` 和 `harness_profit.js` 无需修改
