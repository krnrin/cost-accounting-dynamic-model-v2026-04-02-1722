# Issue #12: Phase 3 性能与健壮性优化指南

## 新增模块

### 1. `engine/error_boundary.js` — 错误边界

防止单个模块异常导致整体崩溃：

```javascript
// 包装计算函数
const safeCompute = G281ErrorBoundary.wrapSync(
  'computeModel',
  engine.computeModel,
  { margin: 0, revenue: 0, cost: 0 }  // fallback
);

// 带超时的异步操作
const result = await G281ErrorBoundary.withTimeout(
  'loadBOM',
  () => loadBOMData(),
  5000,  // 5秒超时
  []     // fallback
);

// 查看错误日志
console.table(G281ErrorBoundary.getErrorLog());
```

### 2. `engine/computation_cache.js` — 计算缓存

#### 模型计算 LRU 缓存

```javascript
// 替代直接调用 engine.computeModel
const model = G281ComputationCache.cachedCompute(
  engine.computeModel, runtime, draft, state
);
// 相同 draft+state 组合直接返回缓存结果
```

#### Wire Catalog 索引缓存

```javascript
// O(1) 按料号查找（替代每次 O(n) 遍历）
const index = G281ComputationCache.getWireCatalogIndex(runtime.wireCatalog);
const wire = index.get('SWA-001');
```

#### 缓存失效

```javascript
// 当用户修改参数后
G281ComputationCache.invalidateAll();
```

## 已有防护

- Shapley 因子数 > 15 时抛出异常（`profit_shapley.js` 已实现）
- solver 二分法有 `maxIter` 上限（`target_price_solver.js` 已实现）

## 本地集成步骤

1. 在 HTML 中加载两个新模块：
   ```html
   <script src="./engine/error_boundary.js"></script>
   <script src="./engine/computation_cache.js"></script>
   ```

2. 在 dashboard.js 的 `recalculate()` 中替换直接调用：
   ```diff
   - const model = engine.computeModel(runtime, draft, state);
   + const model = G281ComputationCache.cachedCompute(
   +   engine.computeModel, runtime, draft, state
   + );
   ```

3. 在 UI 参数变更的回调中添加缓存失效：
   ```javascript
   G281ComputationCache.invalidateAll();
   ```

4. 用错误边界包装高风险函数：
   ```javascript
   const safeSolve = G281ErrorBoundary.wrapSync(
     'targetPriceSolve', solver.solve, { price: 0, converged: false }
   );
   ```
