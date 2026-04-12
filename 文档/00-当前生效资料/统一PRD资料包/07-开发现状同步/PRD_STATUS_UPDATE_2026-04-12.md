# PRD 资料包 · 开发现状全面同步

> **更新日期**: 2026-04-12  
> **基准 commit**: `e5f98d04eba577ba38ca6608f7a8e968d857daa2` (main)  
> **CI 状态**: ✅ 全绿（tsc + vitest 364/364 + vite build）  
> **仓库可见性**: PUBLIC  
> **更新人**: Notion AI Agent（基于实际代码审查与 CI 验证）

---

## 1. 仓库与 CI 状态

| 项目 | 状态 |
|---|---|
| 仓库地址 | `github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722` |
| 可见性 | **PUBLIC（已公开）** |
| 主分支 HEAD | `e5f98d04eba577ba38ca6608f7a8e968d857daa2` |
| TypeScript 编译 | ✅ tsc -b 通过（0 errors） |
| 单元测试 | ✅ vitest 364/364 全部通过 |
| 构建 | ✅ vite build 通过 |
| CI 整体 | ✅ **全绿** |

---

## 2. 确认技术栈

| 层级 | 技术选型 |
|---|---|
| 框架 | React 18 + TypeScript 5.7 |
| 构建 | Vite 6.2 |
| UI 组件库 | @douyinfe/semi-ui (Semi Design) |
| 电子表格引擎 | @univerjs/presets (Univer) |
| 图表 | ECharts 5 |
| 状态管理 | Zustand 5 |
| 本地持久化 | Dexie (IndexedDB) |
| 路由 | react-router-dom 7 |
| 测试 | Vitest 3.1 |
| 包管理 | npm (Node 20) |

### tsconfig 关键配置

```json
{
  "strict": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true,
  "noUncheckedIndexedAccess": true
}
```

> ⚠️ `noUncheckedIndexedAccess: true` 意味着所有索引访问结果类型为 `T | undefined`，需要显式检查。

---

## 3. 代码库规模概览

| 目录 | 文件数 | 代表性大文件 |
|---|---|---|
| `app/src/engine/` | 37 | harness_costing.ts (47KB), bom_parser.ts (27KB), excel_export.ts (25KB) |
| `app/src/pages/` | 28 | DashboardPage.tsx (57KB), ChangeEnginePage.tsx (56KB), BomWorkbookPage.tsx (41KB) |
| `app/src/components/` | 29+ | UniverSheet/, ConfigSetDiagram.tsx (16KB), MultiImportDialog.tsx (14KB) |
| `app/src/store/` | 15 | pricingStore, allocStore, authStore, settingsStore, scenarioStore, versionStore |
| `app/src/types/` | 9 | harness.ts, project.ts, quote.ts, pricing.ts |

---

## 4. 12 功能模块实测状态一览

| 编号 | 模块 | PRD 原判断 | 当前实测状态 | 关键代码证据 |
|---|---|---|---|---|
| F01 | 项目管理与 Dashboard | 已实现 | ✅ **页面+路由+功能可用** | DashboardPage.tsx 57KB（需拆分，Issue #30） |
| F02 | 场景管理 | 待补闭环 | 🟡 **Store 存在，页面骨架有** | scenarioStore 已建，场景类型/状态流待补完 |
| F03 | BOM 工作簿 | 已实现(入口) | ✅ **Univer 引擎已集成** | BomWorkbookPage 41KB, bom_parser 27KB |
| F04 | 客户报价工作台 | 已实现(入口) | ✅ **页面+双引擎骨架可用** | QuotePage 32KB, pricingStore 存在 |
| F05 | Simulation 与年降 | 已实现(入口) | 🟡 **页面入口存在** | metal_escalation.ts 已稳定（364测试全过） |
| F06 | 分摊回收跟踪 | 待补闭环 | 🟡 **allocStore 存在** | 分摊对象有，回收跟踪链路待补 |
| F07 | 设变与跟踪 | 待补闭环 | 🟡 **ChangeEnginePage 56KB** | 页面重量级已有，规则闭环待补 |
| F08 | 预警系统与 Alerts | 待补闭环 | 🔴 **骨架级** | 阈值配置入口有，触发/分级/展示待建 |
| F09 | 管理决策舱 | 已实现(入口) | 🟡 **入口存在** | 汇总数据源待统一 |
| F10 | 版本与发布治理 | 待补闭环 | 🟡 **versionStore 存在** | 版本对象有，发布流/审计待建 |
| F11 | 系统设置 | 已实现(入口) | ✅ **SettingsPage 34KB** | settingsStore 存在，参数快照化待补 |
| F12 | Profile 与个人中心 | 待补闭环 | 🔴 **占位级** | authStore 存在，页面待实质化 |

**图例**: ✅ 可用 | 🟡 骨架/部分可用 | 🔴 待建

---

## 5. 业务规则修正清单

以下业务规则在本轮开发中由产品方明确纠正，**优先级高于 PRD 原文**：

| # | 规则修正 | 影响范围 |
|---|---|---|
| 1 | **铜重/铝重不属于开发 BOM** — 金属重量数据不在 BOM 表中维护，属于核算引擎计算范畴 | F03 BOM 工作簿, DS03 |
| 2 | **不使用 Excel 粘贴导入** — BOM 数据编辑直接使用 Univer 电子表格引擎，不做 Excel 文件粘贴式导入 | F03, T03 |
| 3 | **总成单位是 SET（套）** — 线束总成的计量单位统一为 SET，而非根或件 | 全局 |
| 4 | **总成拆散件时供应商不变** — 从总成拆为散件时，各散件继承原总成供应商，不重新分配 | F03, F07 |
| 5 | **分摊 ≠ 回收** — 分摊是成本口径动作，回收是执行跟踪动作，二者必须分层实现 | F06, T06 |
| 6 | **进度价 = 协议价 vs 批量价差距追踪** — 不得实现为加权混合价 | F07, T07 |
| 7 | **残余材料池不计入当前产品成本** — 必须进入呆滞提报流程 | F07, T07 |

---

## 6. 已合并 PR 记录

| PR | 内容摘要 | SHA |
|---|---|---|
| #44 | 核心引擎 + 类型系统（harness_costing, bom_parser, types/） | — |
| #45 | Store 层 + 数据持久化（15 个 zustand store + Dexie schema） | — |
| #46 | 页面组件 + 路由 + 样式（28 pages + 29 components） | — |
| #47 | CI/CD 修复 + 依赖清理 | — |
| #48 | tsconfig 严格模式修复 | — |
| #49 | GitHub Actions CI 工作流 | `a3e58f96` |
| #50 | 20 个 tsc 类型错误修复（12 文件） | `b7bef419` |
| #51 | metal_escalation 测试修复（9 failures → 0） | `e5f98d04` |

---

## 7. Open Issues

| Issue | 标题 | 优先级 |
|---|---|---|
| #30 | DashboardPage.tsx 57KB 巨石文件拆分 | 高 |
| #31 | 新建项目 UI 流程（多项目复用） | 中 |

---

## 8. 技术债清单

### 8.1 大文件需拆分

| 文件 | 大小 | 建议 |
|---|---|---|
| DashboardPage.tsx | 57KB | 拆为子组件：指标卡片、导航栏、图表区 |
| ChangeEnginePage.tsx | 56KB | 拆为设变表单、差异对比、影响分析 |
| BomWorkbookPage.tsx | 41KB | 拆为 Univer 容器、工具栏、汇总区 |
| SettingsPage.tsx | 34KB | 拆为各配置 Tab 独立组件 |
| QuotePage.tsx | 32KB | 拆为参数区、结果区、对比区 |

### 8.2 过期分支

共 30 个过期分支待清理（含大量 `fix/*` 分支），建议本地执行批量删除。

### 8.3 tsconfig 注意事项

- `noUncheckedIndexedAccess: true` — 所有 `obj[key]` 返回 `T | undefined`
- `exclude` 排除了 `src/__backup_v1`, `**/__tests__/*`, `**/*.test.ts`, `**/*.test.tsx`
- `paths`: `@/*` → `src/*`

---

## 9. 关键参考文档索引

| 文档 | 位置 | 大小 | 用途 |
|---|---|---|---|
| HANDOFF.md | 仓库根目录 | 11KB | 技术全景 + 接力开发指南 |
| CLAUDE.md | 仓库根目录 | 11KB | 业务规则硬约束 + Agent 工作流 |
| app_spec.md | 仓库根目录 | 40KB | 完整功能规格说明书 |
| task.json | 仓库根目录 | 30KB | 37 项任务定义与状态 |
| progress.txt | 仓库根目录 | 23KB | 跨会话进度日志 |
| 本文件 | 文档/00-当前生效资料/统一PRD资料包/07-开发现状同步/ | — | PRD 与代码对齐 |

---

## 10. 接力开发建议

### 必读文档顺序

1. **HANDOFF.md** — 技术全景 + 当前状态
2. **CLAUDE.md** — 业务规则硬约束
3. **app_spec.md** — 完整功能规格
4. **本文件** — PRD 与代码对齐状态

### 启动步骤

```bash
git clone https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722.git
cd cost-accounting-dynamic-model-v2026-04-02-1722/app
npm ci
npx tsc -b          # 应 0 errors
npx vitest run      # 应 364 passed
npx vite build      # 应成功
npm run dev         # 启动开发服务器
```

### 下一步开发优先级

1. **Issue #30**: DashboardPage.tsx 拆分（技术债最高优先）
2. **F02 场景管理**: 补完场景类型/状态流/BOM 挂载关系
3. **F06 分摊回收**: 补完回收跟踪链路
4. **F07 设变管理**: 补完规则闭环
5. **F08 预警系统**: 从骨架升级为规则系统
6. **Issue #31**: 新建项目 UI 流程

### 注意事项

- 推送代码时不要并行 `create_or_update_file`，会出 409 SHA 冲突
- 代码中不能出现 `style=...` 双花括号（Notion 系统会拦截），如遇到需提取为变量
- tsconfig 严格模式下所有索引访问需要 `undefined` 检查
