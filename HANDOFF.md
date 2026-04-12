# HANDOFF.md — AI 接力开发交接文档

> 最后更新: 2026-04-12 21:49 (Asia/Shanghai)
> 更新者: Notion AI Agent (leeyou · 第二大脑)
> Main HEAD: `c8aeae5778472f96b286a095ce10571a0d9690dd`
> Tag: **v0.9.0**

---

## 1. 项目概要

**项目名称**: harness-cost-workbench (高压线束成本精算与决策工作台)
**仓库**: https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722 (PUBLIC)
**定位**: 面向汽车高压线束供应商的成本精算与决策引擎，支持 BOM → 报价 → 分摊回收 → 设变跟踪 → 预警 的全生命周期经营闭环。
**成熟度**: ~80% (核心功能完成，联动加固完成，待本地集成验证)

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
│   ├── components/          # 30+ 共享组件
│   │   ├── ErrorBoundary.tsx       # 全局错误边界
│   │   ├── RouteErrorBoundary.tsx  # 路由级错误边界 (NEW #56)
│   │   ├── QuoteEmptyState.tsx     # 报价空状态组件 (NEW #55)
│   │   └── ...
│   ├── pages/               # 28 个页面组件
│   │   ├── DashboardPage.tsx        # ~3KB 轻量编排器 (PR #52 拆分)
│   │   ├── EngineerWorkbench.tsx    # 已填充真实数据 (PR #56)
│   │   ├── NewProjectWizard.tsx     # 4步向导 (PR #53)
│   │   └── ...
│   ├── engine/              # 核心计算引擎 (35+ 模块)
│   │   ├── harness_costing.ts       # 47KB 线束成本核算主引擎
│   │   └── ...
│   ├── hooks/               # 自定义 hooks
│   │   ├── useHarnessSync.ts        # 自动重算 hook (NEW #54)
│   │   ├── useGlobalErrorHandler.ts # 全局错误捕获 (NEW #57)
│   │   ├── useDashboardData.ts      # Dashboard 数据 (PR #52)
│   │   └── ...
│   ├── utils/               # 工具函数
│   │   ├── saveHarnessWithResult.ts    # 原子保存 (NEW #54)
│   │   ├── saveBomWithResult.ts       # BOM批量保存 (NEW #55)
│   │   ├── scenarioConfigSync.ts      # 场景配置同步 (NEW #54)
│   │   ├── safeCompute.ts             # 安全计算包装 (NEW #57)
│   │   ├── apiErrorHandler.ts         # API错误处理 (NEW #57)
│   │   └── ...
│   ├── store/               # Zustand 状态管理
│   ├── types/               # TypeScript 类型定义
│   ├── data/                # Dexie 数据库定义
│   └── ...
├── package.json
├── tsconfig.json
├── vite.config.ts
└── vitest.config.ts
```

## 4. CI/CD 状态: ✅ 全部通过

- 测试: **364 passed, 0 failed** (48 个测试文件)
- 构建: ✅ Production build 成功
- 触发: push to main + PR

## 5. PR 记录 (全部已合并)

| PR | 标题 | Squash SHA |
|---|---|---|
| **#57** | fix: global error handling + safe compute + API error interceptor | `c8aeae5` |
| **#56** | feat: EngineerWorkbench real data + RouteErrorBoundary | `92492f1` |
| **#55** | fix: QuotePage empty state + BomWorkbook save-with-result | `ae16b4d` |
| **#54** | fix: BOM→Engine→Quote sync hardening | `9c7d794` |
| **#53** | feat: NewProjectWizard rewrite + ProjectListPage alignment | `49670e0` |
| **#52** | refactor: DashboardPage 57KB split into 10 modules | `342e5ff` |
| #51 | fix: 重写 metal_escalation 测试用例 | merged |
| #50 | fix: 修复全部 20 个 tsc 类型错误 | merged |
| #49 | ci: 添加 GitHub Actions CI 工作流 | merged |
| #48 | feat: 合并 cleanup/repo-hygiene | merged |
| #47 | feat: 合并 codex/phase12-mainline | merged |
| #46 | feat: 合并 ci/github-actions | merged |
| #45 | docs: HANDOFF.md 交接文档 | merged |
| #44 | fix: App.tsx 路由壳层路径 | merged |

## 6. v0.9.0 新增功能摘要

### BOM→引擎→报价 联动加固 (PR #54, #55)

```
BOM 编辑 → saveHarnessWithResult() → Dexie { input, result }
                                          ↓
场景配置变更 → batchResyncScenario() → 批量重算所有 result
                                          ↓
Dashboard / QuotePage / 导出 → 读取新鲜缓存结果
```

### 需要本地接入的地方
1. `HarnessEditPage.handleSave` → 用 `saveHarnessWithResult()` 替换 `db.harnesses.put/update`
2. `BomWorkbookPage.handleSaveAll` → 用 `saveBomHarnessWithResult()` 替换 `db.harnesses.update`
3. `QuotePage` → harnesses 为空时渲染 `<QuoteEmptyState />`
4. 配置/设置页 → 费率变更后调 `batchResyncScenario(scenarioId)`
5. `App.tsx` → 添加 `useGlobalErrorHandler()` + 用 `RouteErrorBoundary` 包装关键路由

### 错误处理加固 (PR #56, #57)
- `RouteErrorBoundary`: 路由级错误边界，重试不跳转
- `useGlobalErrorHandler`: 全局未处理 Promise rejection 捕获
- `safeComputeHarnessCost`: 引擎调用安全包装
- `apiErrorHandler + withRetry`: API 错误结构化 + 指数退避重试

## 7. 关键业务概念 (开发必读)

详见 `CLAUDE.md`，核心规则:
1. **颗粒度到线束号/BOM 行** — 所有成本必须精确到线束号
2. **双引擎并行** — 内部实绩 vs 客户报价 独立口径
3. **三层价格**: L1 内部核算价 / L2 客户确认快照价 / L3 当前有效执行价
4. **分摊 ≠ 回收** — 分层实现
5. **总成的单位是 SET (套)** — 不是「根」
6. **铜重/铝重不属于开发 BOM** — 仅存在于核算引擎
7. **BOM 数据通过 Univer 直接编辑** — 不是 Excel 粘贴导入

## 8. 12 个功能模块

| 编号 | 模块 | 优先级 | 状态 |
|------|------|--------|------|
| F01 | 项目管理与 Dashboard | P0 | ✅ 完成 (PR #52, #53) |
| F02 | 场景管理 | P0 | ✅ 基本完成 |
| F03 | BOM 工作簿 | P0 | ✅ 基本完成 |
| F04 | 客户报价工作台 | P0 | ✅ 基本完成 (PR #55 空状态) |
| F05 | Simulation 与年降管理 | P1 | ✅ 基本完成 |
| F06 | 分摊回收跟踪 | P0 | ✅ 基本完成 |
| F07 | 设变与跟踪 | P1 | ✅ 基本完成 |
| F08 | 预警系统与 Alerts | P1 | ✅ 基本完成 |
| F09 | 管理决策舱 | P2 | ✅ 基本完成 |
| F10 | 版本与发布治理 | P2 | ✅ 基本完成 |
| F11 | 系统设置与参数治理 | P0 | ✅ 基本完成 |
| F12 | Profile 与个人中心 | P2 | ✅ 基本完成 |

## 9. 开发环境启动

```bash
cd app
npm ci
npm run dev          # Vite dev server → http://localhost:5173
npm run build        # tsc -b && vite build
npm run test:run     # vitest run (364 tests)
```

## 10. 待办

### 需要本地操作
1. **30+ 过期分支清理** — `git push origin --delete <branches>`
2. **本地集成验证** — `npm run dev` 跑一遍确认 UI 渲染正常
3. **接入新工具函数** — 见第 6 节清单

### 潜在技术债
- `ChangeEnginePage.tsx` (56KB) 应拆分
- `harness_costing.ts` (47KB) 引擎文件较大
- `src/__backup_v1/` 备份目录仍存在

## 11. 给接力 AI 的建议

1. **先跑一遍 CI** — `cd app && npm ci && npm run build && npm run test:run`
2. **读 CLAUDE.md** — 业务规则是硬约束
3. **读 app_spec.md** — 完整功能需求
4. **注意 noUncheckedIndexedAccess** — tsc 最常见报错来源
5. **JSX 样式写法** — 通过 Notion Agent 推代码时 `style={{}}` 会被拦截，必须用 `style={S.xxx}`
