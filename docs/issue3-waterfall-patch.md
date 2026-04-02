# Issue #3 补丁指南：因果链瀑布图 + Shapley 双视图

## 架构

```
[Shapley 归因 (已有)]  ←→  [因果链瀑布图 (新增)]
       ↑ tab 切换                    ↑ tab 切换
       └──── 利润归因面板 ────────────┘
```

**保留 Shapley**，新增瀑布图作为**主视图**（默认展示）。

## 需要修改的文件

### 1. `g281_profit_dashboard.html`

#### 补丁 1：引入新文件

在 `<script src="g281_profit_shapley.js">` 之后添加：
```html
<script src="charts/waterfall_causal.js"></script>
<link rel="stylesheet" href="charts/waterfall_causal.css">
```

### 2. `g281_profit_dashboard.js`

#### 补丁 2：在归因面板中添加 tab 切换

找到渲染 Shapley 结果的区域（搜索 `shapley` 或 `contributions`），在其外层容器中添加：

```javascript
// --- Issue #3: 双视图 tab ---
const tabsHTML = `
  <div class="attribution-tabs">
    <div class="attribution-tab active" data-view="waterfall">因果链瀑布图</div>
    <div class="attribution-tab" data-view="shapley">Shapley 归因</div>
  </div>
`;
```

#### 补丁 3：计算瀑布图数据并渲染

在 Shapley 计算之后（`G281ProfitShapley.compute(...)` 调用位置），添加：

```javascript
// --- Issue #3: 计算因果链瀑布图 ---
const waterfallData = G281WaterfallCausal.computeCausalWaterfall({
  engine: engine,
  runtime: runtime,
  baselineState: shapleyResult.baseline.state,
  baselineDraft: shapleyResult.baseline.draft,
  scenarioState: shapleyResult.scenario.state,
  scenarioDraft: shapleyResult.scenario.draft,
  factors: G281WaterfallCausal.CAUSAL_ORDER.map(f => {
    const shapleyFactor = G281ProfitShapley.defaultFactors.find(sf => sf.key === f.key);
    return { ...f, draftKeys: shapleyFactor?.draftKeys || [] };
  }),
});
const waterfallHTML = G281WaterfallCausal.renderWaterfallHTML(waterfallData);
```

#### 补丁 4：tab 切换事件

```javascript
container.querySelectorAll('.attribution-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    container.querySelectorAll('.attribution-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const view = tab.dataset.view;
    container.querySelector('.waterfall-view').style.display = view === 'waterfall' ? '' : 'none';
    container.querySelector('.shapley-view').style.display = view === 'shapley' ? '' : 'none';
  });
});
```

## 关键设计决策

| 维度 | Shapley | 瀑布图 |
|------|---------|--------|
| 归因方式 | 对称博弈，与顺序无关 | 固定因果链顺序 |
| 优势 | 数学上公平 | 业务上直观 |
| 缺陷 | 忽略因果顺序 | 顺序依赖性 |
| 定位 | 辅助归因 | 主要展示 |

## 测试清单

- [ ] 瀑布图默认展示，Shapley 点击 tab 切换
- [ ] 瀑布图步骤总 delta = Shapley 总 delta（浮点误差 < 0.01%）
- [ ] 正向因素绿色、负向因素红色
- [ ] 鼠标 hover 显示该步详细数值
