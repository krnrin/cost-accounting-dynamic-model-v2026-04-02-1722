# Issue #5 补丁指南：endGroup 对端识别 + unit=set 总成识别

## 需要修改的文件

### 1. `g281_bom_alignment_engine.js`

#### 补丁 1：引入 AlignKeyEnhancer（文件顶部 IIFE 内）

在 `const CONNECTOR_LIKE = ...` 之后添加：

```javascript
// --- Issue #5: 引入增强 alignKey ---
const AlignKeyEnhancer = global.G281AlignKeyEnhancer || {};
const enhanceAlignKeys = AlignKeyEnhancer.enhanceAlignKeys || ((items) => items);
const buildSetAwareUsageDelta = AlignKeyEnhancer.buildSetAwareUsageDelta || (() => null);
```

#### 补丁 2：alignGroupItems 中预处理 items

在 `alignGroupItems` 函数开头，替换：
```javascript
const exactAligned = pairByKey(leftItems, rightItems, ...);
```

为：
```javascript
const enhancedLeft = enhanceAlignKeys(leftItems);
const enhancedRight = enhanceAlignKeys(rightItems);
const exactAligned = pairByKey(enhancedLeft, enhancedRight, (item) => normalizeKey(item.alignKey));
```

#### 补丁 3：buildUsageDelta 中优先使用 set-aware 逻辑

在 `buildUsageDelta` 函数开头添加：
```javascript
const setDelta = buildSetAwareUsageDelta(leftItem, rightItem);
if (setDelta) return setDelta;
```

#### 补丁 4：compareHarness 中添加变更分类

在 `compareHarness` 函数的 `return` 语句中，添加：
```javascript
endGroupChanges: AlignKeyEnhancer.classifyEndGroupChanges
  ? AlignKeyEnhancer.classifyEndGroupChanges(leftItems, rightItems)
  : null,
```

### 2. `g281_profit_dashboard.html`

确保在 `<script>` 加载顺序中，`engine/align_key_enhancer.js` 在 `g281_bom_alignment_engine.js` 之前加载。

## 测试清单

- [ ] 同 endGroup 不同 partNo 的连接器变更被识别为 replaced
- [ ] 旧版有新版无的料号被识别为 cancelled
- [ ] unit=set 的线束总成在 usageDelta 中显示 set 口径
- [ ] 非 set 物料行为不变（回归测试）
