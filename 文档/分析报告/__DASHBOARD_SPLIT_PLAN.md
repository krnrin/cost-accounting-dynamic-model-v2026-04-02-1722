# dashboard.js 拆分方案

## 现状
- **文件**: `ui/dashboard.js` — 9888行 / 449KB
- **问题**: 单文件过大，难以维护、调试、协作

## 拆分原则
1. **按功能域拆分**，每个文件是一个自包含的功能模块
2. **共享状态集中管理**：`state`, `el`, `controls`, `BASE`, `RUNTIME` 留在主文件，通过全局或参数传递
3. **不引入构建工具**：保持 vanilla JS + script 标签加载
4. **模式统一**：每个子模块用 IIFE 包裹，将自己挂到 `window.G281Dashboard` 命名空间
5. **加载顺序**：子模块先加载（只注册函数），主文件最后加载（调用初始化）

## 拆分为 8 个文件

### 1. `ui/dash_format.js` (~120行)
**来源**: L864-884 格式化工具函数
- `fmtMoney`, `fmtPct`, `fmtNumber`, `fmtInt`, `fmtSignedPct`, `escapeHtml`
- 纯函数，无状态依赖
- 其他所有模块共享

### 2. `ui/dash_version_template.js` (~3200行)
**来源**: L2100-5603 版本模板系统 (最大的功能块)
- Template Editor 集成 (Univer spreadsheet)
- 版本模板 Context 构建 (`buildVersionTemplateContext`)
- 模板 Sheet Spec 构建 (BOM/Labor/Packaging/Connector/Generic)
- 模板渲染 (`renderVersionTemplateFields`, `renderVersionTemplateEditor`)
- 模板数据读写 (`readVersionTemplateFieldState`, `syncVersionTemplateDraftValuesFromDom`)
- 模板保存 (`saveVersionTemplate`, `buildVersionTemplatePayload`)
- Chrome/Debug面板 (`syncVersionTemplateChromeLabels`, `updateVersionTemplateDebugPanel`)
- **依赖**: `el`, `BASE`, `state`, `controls`, `fmtMoney`, `repo`

### 3. `ui/dash_version_manager.js` (~900行)
**来源**: L5632-6627 版本管理 + 连接器协议
- 用户版本CRUD (`buildUserVersionOption`, `deleteUserVersion`)
- 版本应用 (`applyBomVersion`, `applyLaborVersion`, `applyMetalVersion`)
- 版本快照 (`bomVersionSnapshot`, `metalVersionSnapshot`, `laborVersionSnapshot`)
- 连接器协议推荐 (`recommendedConnectorStage`, `protocolSummary`)
- `readDraft` / `applyDraft` (UI↔数据同步)
- **依赖**: `BASE`, `state`, `controls`, `connectorPricingState`, `repo`

### 4. `ui/dash_kanban.js` (~400行)
**来源**: L7056-7460 看板管理卡片 + KPI
- `renderKanbanScenario`, `renderKanbanPrice`, `renderKanbanData`, `renderKanbanChange`
- KPI/Profit Driver 渲染
- 场景标签渲染
- **依赖**: `el`, `state`, `BASE`, `fmtMoney`

### 5. `ui/dash_harness.js` (~400行)
**来源**: L7462-7844 线束利润/成本模块
- `buildHarnessProfitRows` (legacy)
- `renderHarnessProfitV2` → `renderHarnessPrecision` / `renderHarnessLegacy`
- Wire profit table
- **依赖**: `el`, `RUNTIME`, `fmtMoney`, `G281HarnessProfit`, `G281HarnessCosting`

### 6. `ui/dash_charts.js` (~1300行)
**来源**: L7846-9068 + L9069-9253 图表与变动归因
- Cost Bridge SVG (`renderCostBridge`)
- Annual Chart SVG (`renderAnnualChart`)
- Config Bars CSS (`renderConfigBars`)
- BOM变更可视化
- Shapley 归因分析 (`computeProfitInsightsPayload`, change visualization)
- **依赖**: `el`, `BASE`, `fmtMoney`, `fmtPct`

### 7. `ui/dash_lifecycle.js` (~600行)
**来源**: L1467-2099 生命周期数据 + 时间线
- 年降逻辑 (`normalizeAnnualDropEntries`)
- 一次性费用 (`normalizeOneTimeFees`)
- Workbook 解析/种子 (`parseAnnualDropWorkbookRows`, `buildLifecycleWorkbookSnapshotFromSeed`)
- 版本时间线渲染 (`renderVersionTimeline`, `collectVersionTimelineEvents`)
- **依赖**: `BASE`, `state`, `el`

### 8. `ui/dashboard.js` (主文件, 缩至 ~2800行)
**保留**:
- L1-60 Runtime 初始化 + 全局常量
- L67-211 Config/State 初始化
- L213-863 DOM 脚手架 + `el` 缓存 + 模态管理
- L1030-1417 场景持久化 + Draft 快照
- L6628-6701 `readDraft` / `applyDraft` (与版本管理强耦合，可能留此)
- L9256-9310 DashboardBridge
- L9312-9441 核心渲染循环 (`render`, `calcModel`, `generate`, `reset`, `queueRender`)
- L9443-9530 Workspace Page
- L9552-9888 `bind()` + `renderVersions` + 初始化

## 共享机制

```javascript
// 每个子模块的模式:
(function(G) {
  'use strict';
  var ns = G.G281Dashboard = G.G281Dashboard || {};

  // 注册函数
  ns.fmtMoney = function(...) { ... };
  ns.renderHarnessProfitV2 = function(m, el, RUNTIME) { ... };
})(window);

// dashboard.js 主文件中:
var D = window.G281Dashboard;
var fmtMoney = D.fmtMoney;  // 本地别名
```

## 加载顺序 (dashboard.html)
```
dash_format.js          ← 格式化纯函数
dash_lifecycle.js       ← 生命周期数据
dash_version_template.js ← 版本模板系统
dash_version_manager.js  ← 版本管理
dash_kanban.js          ← 看板卡片
dash_harness.js         ← 线束成本
dash_charts.js          ← 图表/归因
dashboard.js            ← 主文件 (初始化 + 编排)
```

## 预估大小

| 文件 | 估算行数 | 估算KB |
|------|----------|--------|
| dash_format.js | ~120 | ~5 |
| dash_lifecycle.js | ~600 | ~25 |
| dash_version_template.js | ~3200 | ~135 |
| dash_version_manager.js | ~900 | ~38 |
| dash_kanban.js | ~400 | ~17 |
| dash_harness.js | ~400 | ~17 |
| dash_charts.js | ~1300 | ~55 |
| dashboard.js (主) | ~2800 | ~120 |
| **合计** | **~9720** | **~412** |

减少的170行是冗余空行和重复注释的清理。总体积相近，但每个文件职责单一、可独立维护。
