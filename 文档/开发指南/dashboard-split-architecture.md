# UI Dashboard 拆分架构方案 (Issue #6)

## 现状分析

`ui/dashboard.js` 当前体量 **448KB / ~11,000 行**，是典型的“巨石模块”反模式。

### 职责混合问题

| 职责类型 | 估算行数 | 例子 |
|---|---|---|
| 状态管理 | ~1500 | 状态下拉框、场景切换、draft 读写 |
| KPI 渲染 | ~800 | 6 个指标卡片、动态色彩、微型图表 |
| 表格渲染 | ~1500 | 年度表、成本拆解表、线束利润表 |
| 图表渲染 | ~1200 | 成本桥、瀑布图、Shapley、散点图 |
| 弹窗/抽屉 | ~2000 | BOM 导入、Excel 查看、设置、变更详情 |
| 跨模块胶水 | ~1500 | 事件绑定、计算触发、DOM 操作 |
| 工具函数 | ~500 | 格式化、DOM helpers、动画 |

## 拆分方案

### 层级架构

```
ui/
├── state/                    # 状态管理层
│   ├── scenario_state.js      # 场景状态机（状态切换、draft 读写）
│   ├── ui_state.js            # UI 状态（展开/折叠、当前 Tab、排序）
│   └── event_bus.js           # 简单事件总线
├── renderers/                # 渲染器层（纯函数，数据→DOM）
│   ├── kpi_grid.js            # KPI 网格
│   ├── annual_table.js        # 年度利润表
│   ├── cost_breakdown.js      # 成本拆解表
│   ├── harness_table.js       # 线束级利润表
│   ├── charts.js              # 图表（成本桥、瀑布图、Shapley、散点图）
│   ├── compare_panel.js       # 报价 vs 当前 对比面板
│   ├── connector_panel.js     # 连接器场景面板
│   ├── progress_panel.js      # 进度价差距面板
│   └── residual_panel.js      # 残余材料池/呆滞面板
├── modals/                   # 弹窗/抽屉层
│   ├── modal_base.js          # 弹窗基类（打开/关闭/ESC/遮罩）
│   ├── bom_import_modal.js    # BOM 导入弹窗
│   ├── excel_viewer_modal.js  # Excel 查看弹窗
│   ├── settings_modal.js      # 设置弹窗
│   └── change_detail_modal.js # 变更详情弹窗
├── helpers/                  # UI 工具层
│   ├── format.js              # 数字格式化、百分比、货币
│   ├── dom.js                 # DOM 创建/操作 helper
│   └── animate.js             # 动画工具
├── insights.js               # 现有（保留）
├── logic_drawer.js           # 现有（保留）
├── workbook_viewer.js        # 现有（保留）
└── version_timeline.js       # 现有（保留）
```

### 拆分原则

1. **渲染器 = 纯函数**：接收数据，返回 DOM 或渲染到容器，不读全局状态
2. **状态 = 单向流**：状态变更 → 事件总线 → 重新渲染
3. **弹窗 = 懒加载**：首次打开时才初始化 DOM
4. **共享导出**：每个模块通过 `window.G281UI.xxx` 命名空间导出

### 事件总线设计

```js
// ui/state/event_bus.js
const bus = new EventTarget();

// 发布事件
bus.dispatchEvent(new CustomEvent('state:changed', { detail: { ... } }));

// 订阅事件
bus.addEventListener('state:changed', (e) => {
  kpiGrid.render(e.detail);
  annualTable.render(e.detail);
  charts.render(e.detail);
});
```

### 事件列表

| 事件 | 触发来源 | 订阅者 |
|---|---|---|
| `state:changed` | scenario_state | 所有渲染器 |
| `draft:updated` | 输入控件 | scenario_state |
| `bom:imported` | bom_import_modal | scenario_state → 重算 |
| `modal:open` | 任意 | modal_base |
| `modal:close` | modal_base | 任意 |
| `page:navigate` | nav | page_router |

## 迁移路径

### Phase 1: 提取工具层 (~500 行)
- `helpers/format.js` — 数字格式化
- `helpers/dom.js` — DOM 操作
- `helpers/animate.js` — 动画

### Phase 2: 提取事件总线 + 状态管理 (~1500 行)
- `state/event_bus.js`
- `state/scenario_state.js` — 状态机、状态下拉框、draft 读写
- `state/ui_state.js` — UI 状态

### Phase 3: 提取渲染器 (~3500 行)
- `renderers/kpi_grid.js`
- `renderers/annual_table.js`
- `renderers/cost_breakdown.js`
- `renderers/harness_table.js`
- `renderers/charts.js`
- `renderers/compare_panel.js`
- `renderers/connector_panel.js`
- `renderers/progress_panel.js`
- `renderers/residual_panel.js`

### Phase 4: 提取弹窗 (~2000 行)
- `modals/modal_base.js`
- `modals/bom_import_modal.js`
- `modals/excel_viewer_modal.js`
- `modals/settings_modal.js`
- `modals/change_detail_modal.js`

### Phase 5: 瘦身 dashboard.js (~1500 行 → 组装层)
- 只保留初始化、页面组装、事件绱定

## 各页面对应的渲染器

| 渲染器 | 预演 | 核算 | 跟踪 | 归档 |
|---|---|---|---|---|
| kpi_grid | ✅ | - | - | - |
| annual_table | ✅ | - | - | - |
| charts | ✅ | - | - | - |
| compare_panel | ✅ | ✅ | - | - |
| cost_breakdown | - | ✅ | - | - |
| harness_table | - | ✅ | - | - |
| connector_panel | - | ✅ | ✅ | - |
| progress_panel | - | - | ✅ | - |
| residual_panel | - | - | ✅ | - |

## 文件大小目标

拆分后每个文件目标 **≤ 50KB**（~1200 行），dashboard.js 瘦身至 **≤ 60KB**。
