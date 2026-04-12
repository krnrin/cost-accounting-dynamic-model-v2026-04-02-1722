# HANDOFF.md — AI 接力开发交接文档

> 最后更新: 2026-04-12 19:50 (Asia/Shanghai)
> 更新者: Notion AI Agent (leeyou · 第二大脑)
> Main HEAD: `e5f98d04eba577ba38ca6608f7a8e968d857daa2`

---

## 1. 项目概要

**项目名称**: harness-cost-workbench (高压线束成本精算与决策工作台)
**仓库**: https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722 (PUBLIC)
**定位**: 面向汽车高压线束供应商的成本精算与决策引擎，支持 BOM → 报价 → 分摊回收 → 设变跟踪 → 预警 的全生命周期经营闭环。

## 2. 技术栈

| 层 | 技术 | 版本 |
|---|---|---|
| 前端框架 | React + TypeScript | React 18.3, TS ~5.7 |
| 构建工具 | Vite | 6.2 |
| UI 组件库 | @douyinfe/semi-ui | ^2.73.0 |
| 电子表格 | @univerjs/presets (Univer) | ^0.20.0 |
| 图表 | ECharts + echarts-for-react | ^5.6.0 |
| 状态管理 | Zustand | 5.0 |
| 数据库 | Dexie (IndexedDB) | ^4.0.11 |
| 路由 | react-router-dom | ^7.5.0 |
| 测试 | Vitest + Testing Library | vitest ^3.1 |
| CI | GitHub Actions | Node 20 |
| PWA | vite-plugin-pwa + workbox | ^1.2.0 |

## 3. 目录结构 (app/ 核心)

```
app/
├── src/
│   ├── App.tsx              # 路由入口 (react-router-dom v7)
│   ├── main.tsx             # React 挂载点
│   ├── index.css            # 全局样式 (32KB)
│   ├── components/          # 30+ 共享组件
│   │   ├── UniverSheet/     # Univer 电子表格封装
│   │   ├── ErrorBoundary.tsx
│   │   ├── Breadcrumb.tsx
│   │   ├── KpiCard.tsx
│   │   ├── RoleGuard.tsx
│   │   ├── BomImportDialog.tsx
│   │   ├── ConfigSetDiagram.tsx
│   │   └── ... (更多)
│   ├── pages/               # 28 个页面组件
│   │   ├── DashboardPage.tsx        # 57KB ⚠️ 巨石文件
│   │   ├── ChangeEnginePage.tsx     # 56KB ⚠️ 巨石文件
│   │   ├── BomWorkbookPage.tsx      # 41KB
│   │   ├── SettingsPage.tsx         # 34KB
│   │   ├── QuotePage.tsx            # 31KB
│   │   ├── ProjectListPage.tsx
│   │   ├── ProjectScenariosPage.tsx
│   │   ├── HarnessEditPage.tsx
│   │   ├── HarnessDetailPage.tsx
│   │   ├── SimulationPage.tsx
│   │   ├── AlertsPage.tsx
│   │   ├── AllocManagerPage.tsx
│   │   ├── WizardPage.tsx
│   │   ├── NewProjectWizard.tsx
│   │   └── ... (更多)
│   ├── engine/              # 核心计算引擎 (35+ 模块)
│   │   ├── harness_costing.ts       # 47KB 线束成本核算主引擎
│   │   ├── bom_parser.ts            # 27KB BOM 解析
│   │   ├── excel_export.ts          # 25KB Excel 导出
│   │   ├── metal_escalation.ts      # 金属联动计算
│   │   ├── change_pricing.ts        # 设变报价
│   │   ├── quote_template.ts        # 报价模板 (吉利/比亚迪/通用)
│   │   ├── allocation.ts            # 分摊计算
│   │   ├── pricing_engine.ts        # 定价引擎
│   │   ├── config_risk.ts           # 配置风险分析
│   │   ├── shared_utils.ts          # 工具函数
│   │   ├── __tests__/               # 引擎测试 (48 个测试文件)
│   │   └── ... (更多)
│   ├── store/               # Zustand 状态管理
│   │   ├── pricingStore.ts          # 19KB 定价状态
│   │   ├── allocStore.ts            # 13KB 分摊状态
│   │   ├── settingsStore.ts
│   │   ├── scenarioStore.ts
│   │   ├── projectStore.ts
│   │   ├── authStore.ts
│   │   ├── versionStore.ts
│   │   └── ... (更多)
│   ├── types/               # TypeScript 类型定义
│   │   ├── harness.ts               # 线束类型 (HarnessResult 等)
│   │   ├── project.ts               # 项目类型 (ProjectConfig, MetalPrices 等)
│   │   ├── quote.ts                 # 报价类型 (MetalContract, MetalDelta 等)
│   │   ├── pricing.ts               # 定价类型
│   │   ├── financial_schema.ts
│   │   ├── bomWorkbook.ts
│   │   └── index.ts                 # barrel exports
│   ├── data/                # Dexie 数据库定义
│   ├── hooks/               # 自定义 hooks
│   ├── layouts/             # 布局组件
│   ├── lib/                 # 第三方库封装
│   ├── sync/                # 数据同步
│   ├── utils/               # 工具函数
│   ├── styles/              # 样式文件
│   └── test/                # 测试配置/工具
├── package.json
├── tsconfig.json
├── vite.config.ts
└── vitest.config.ts (根目录)
```

## 4. CI/CD 状态

### CI 配置 (`.github/workflows/ci.yml`)

触发: push to main + PR

3 步流水线 (串行):
1. `tsc -b` — TypeScript 类型检查
2. `vitest run` — 单元测试
3. `vite build` — 生产构建

工作目录: `app/`
Node: 20

### 当前 CI 状态: ✅ 全部通过

- CI #5 (PR branch): ✅ PASSED
- CI #6 (main push): ✅ PASSED
- 测试结果: **364 passed, 0 failed** (48 个测试文件)
- 构建: ✅ Production build 成功

## 5. tsconfig 关键配置

```json
{
  "strict": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true,
  "noUncheckedIndexedAccess": true,
  "paths": { "@/*": ["src/*"] },
  "exclude": ["src/__backup_v1", "src/**/__tests__/*", "src/**/*.test.ts", "src/**/*.test.tsx"]
}
```

⚠️ **注意**: `noUncheckedIndexedAccess: true` 意味着所有 `obj[key]` 返回 `T | undefined`，必须显式处理。

## 6. 近期完成的工作 (PR 记录)

| PR | 标题 | 状态 |
|---|---|---|
| #51 | fix: 重写 metal_escalation 测试用例，匹配实际函数签名 | ✅ Merged |
| #50 | fix: 修复全部 20 个 tsc 类型错误 | ✅ Merged |
| #49 | ci: 添加 GitHub Actions CI 工作流 | ✅ Merged |
| #48 | feat: 合并 cleanup/repo-hygiene-and-file-migration | ✅ Merged |
| #47 | feat: 合并 codex/phase12-mainline-delivery | ✅ Merged |
| #46 | feat: 合并 ci/github-actions 分支 | ✅ Merged |
| #45 | docs: HANDOFF.md 交接文档 | ✅ Merged |
| #44 | fix: 修复 App.tsx 路由壳层路径 (30个冲突) | ✅ Merged |
| #43 | feat: landing workbench 基础设施 | Closed (已吸收进 main) |

### PR #50 修复的 20 个 tsc 错误 (涉及 12 个文件):

修复类型:
- `noUncheckedIndexedAccess` 造成的 `T | undefined` 问题 (最多)
- 未使用的导入/参数
- JSX 双花括号 `style=...` 被 Notion 平台拦截，已改为 `style={S.xxx}` 变量引用

涉及文件:
- `engine/harness_costing.ts`, `engine/bom_parser.ts`
- `engine/smart_paste.ts`, `engine/incremental_calc.ts`
- `engine/quote_template.ts`, `engine/scenario_lifecycle.ts`
- `pages/WizardPage.tsx`, `pages/ChangeEnginePage.tsx`
- `pages/ConnectorPricingPage.tsx`, `pages/WirePricingPage.tsx`
- `pages/DevPartPricingPage.tsx`
- `store/pricingStore.ts`

### PR #51 修复的 9 个 vitest 失败:

`metal_escalation.test.ts` 使用了旧版单对象参数 API，但实现已改为多参数签名。已按实际签名重写所有 9 个测试用例。

## 7. 已知问题与待办

### Open Issues

| # | 标题 | 优先级 |
|---|---|---|
| #30 | DashboardPage.tsx 真正拆分 (57KB 巨石文件) | P1 |
| #31 | 新建项目 UI 流程 (多项目可复用) | P1 |

### 需要本地操作的任务

1. **22+ 过期分支清理** — GitHub API 无 `delete_branch` 工具，需本地 `git push origin --delete <branch>`
   
   过期分支列表 (全部已合并或废弃):
   ```
   ci/github-actions
   cleanup/repo-hygiene-and-file-migration
   codex/landing-workbench-20260404
   codex/phase12-mainline-delivery
   feat/batch-37-tasks
   feat/landing-workbench-infra
   feat/project-config-schema
   feat/remaining-tasks-batch
   fix/close-remaining-issues
   fix/code-review-v3-xss-bom-compat
   fix/comprehensive-code-review
   fix/issue1-progress-price-gap
   fix/issue2-residual-pool-stagnant
   fix/issue3-waterfall-shapley
   fix/issue4-config-driven-coefficients
   fix/issue5-unit-set-alignkey
   fix/metal-escalation-tests
   fix/missing-barrel-exports
   fix/phase1-encoding-duplicate-cleanup
   fix/session9-deep-cleanup
   fix/style-placeholders-and-integration
   fix/tsc-type-errors
   fix/ui-p1-p2-security-architecture
   fix/ui-p3-p4-polish
   integrate-new-modules
   issue-6-ui-dashboard-split
   issue-9-engine-split
   issue-10-dedup-utils
   issue-11-schema-migration
   issue-12-perf-robustness
   ```

2. **DashboardPage.tsx 拆分 (Issue #30)** — 57KB 超过 GitHub API 操作限制，必须本地操作

3. **Tag v0.9.0** — CI 全绿后可打标签

### 潜在技术债

- `ChangeEnginePage.tsx` (56KB) 也应拆分
- `harness_costing.ts` (47KB) 引擎文件较大
- 部分大文件可能存在 JSX `style={{}}` 被 Notion 平台转义为占位符的残留问题 (已在 PR #50 中修复已知的，但 DashboardPage 等大文件未全面扫描)
- `src/__backup_v1/` 备份目录仍存在，已通过 tsconfig exclude 排除编译

## 8. 关键业务概念 (开发必读)

详见 `CLAUDE.md`，核心规则:

1. **颗粒度到线束号/BOM 行** — 所有成本必须精确到线束号
2. **双引擎并行** — 内部实绩 vs 客户报价 独立口径
3. **三层价格**: L1 内部核算价 / L2 客户确认快照价 / L3 当前有效执行价
4. **分摊 ≠ 回收** — 分层实现
5. **总成的单位是 SET (套)** — 不是「根」
6. **铜重/铝重不属于开发 BOM** — 仅存在于核算引擎
7. **BOM 数据通过 Univer 直接编辑** — 不是 Excel 粘贴导入

## 9. 12 个功能模块

| 编号 | 模块 | 优先级 | 状态 |
|------|------|--------|------|
| F01 | 项目管理与 Dashboard | P0 | 基本完成 |
| F02 | 场景管理 | P0 | 基本完成 |
| F03 | BOM 工作簿 | P0 | 基本完成 |
| F04 | 客户报价工作台 | P0 | 基本完成 |
| F05 | Simulation 与年降管理 | P1 | 基本完成 |
| F06 | 分摊回收跟踪 | P0 | 基本完成 |
| F07 | 设变与跟踪 | P1 | 基本完成 |
| F08 | 预警系统与 Alerts | P1 | 基本完成 |
| F09 | 管理决策舱 | P2 | 基本完成 |
| F10 | 版本与发布治理 | P2 | 基本完成 |
| F11 | 系统设置与参数治理 | P0 | 基本完成 |
| F12 | Profile 与个人中心 | P2 | 基本完成 |

## 10. 开发环境启动

```bash
cd app
npm ci
npm run dev          # Vite dev server → http://localhost:5173
npm run build        # tsc -b && vite build
npm run test:run     # vitest run (364 tests)
```

## 11. 重要参考文件

| 文件 | 内容 |
|------|------|
| `CLAUDE.md` | Claude Code 项目约定 + 业务规则 + 12 个功能模块 |
| `app_spec.md` | 完整功能规格 (40KB) |
| `task.json` | 任务定义 (Trellis 自动化任务清单) |
| `progress.txt` | 跨 session 进度日志 |
| `head_task.json` | HEAD 任务快照 |

## 12. 给接力 AI 的建议

1. **先跑一遍 CI** — `cd app && npm ci && npm run build && npm run test:run`，确认绿色
2. **读 CLAUDE.md** — 业务规则是硬约束，不能违反
3. **读 app_spec.md** — 完整功能需求
4. **优先处理 Issue #30** — DashboardPage 拆分是最大技术债
5. **注意 noUncheckedIndexedAccess** — 这是 tsc 最常见的报错来源
6. **JSX 样式写法** — 如果通过 Notion Agent 推代码，`style={{}}` 会被拦截，必须用变量引用 `style={S.xxx}`
