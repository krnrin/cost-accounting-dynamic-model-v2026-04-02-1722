# LOCAL-AI-HANDOFF.md — 本地 AI 接力开发全量交接

> 生成时间: 2026-04-12 22:52 (Asia/Shanghai)
> 生成者: Notion AI Agent (leeyou · 第二大脑)
> 仓库: https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722 (PUBLIC)
> Main HEAD: `83cbfb5801bf5d59fba6562796a24802e9e8dab0`
> Fix branch HEAD: `4fdff090a4f4093ef639206a814ef5e18af804c7` (fix/review-findings-batch)
> PR #58: OPEN — 待合并

---

## 0. 快速开始

```bash
# 1. 合并 PR #58 的远程修复
git fetch origin fix/review-findings-batch
git merge origin/fix/review-findings-batch

# 2. 应用本地补丁（见第 2 节）
# 按 REVIEW-FIXES-BATCH2.md 应用 11 个补丁
# 按 REVIEW-FIXES-BATCH3.md 应用 3 个补丁

# 3. 验证
cd app
npm ci
npx tsc --noEmit
npx vitest run          # 期望 364 passed
npm run dev             # http://localhost:5173

# 4. 提交并继续 task.json 中的待办任务
```

---

## 1. 待办开发任务 (task.json pending)

共 9 个任务未完成，按优先级和依赖分三波。

### Wave A: 基础设施 + 主题 (P0)

| ID | 任务 | 优先级 | 依赖 | 备注 |
|---|---|---|---|---|
| **T30** | 深色主题 + 工业蓝图风格 | P0 | 无 | Semi UI 主题覆写，深蓝/深灰底 + 蓝/绿强调 |
| **T32** | SQLite 数据库初始化 + Migration | P0 | 无 | server/ 已有 Prisma + SQLite，需补全 16 张表的 migration + seed |

### Wave B: 测试 (P0 + P1)

| ID | 任务 | 优先级 | 依赖 | 备注 |
|---|---|---|---|---|
| **T33** | E2E 测试 — P0 主链路 | P0 | T01-T10 (done) | Playwright E2E: 新建项目→BOM→报价→分摊 |
| **T34** | API 测试 — 核心计算规则 | P0 | T32 | pytest: 所有核心公式验证 |
| **T35** | Lighthouse 性能基线 | P1 | T30 | 所有页面 Lighthouse Performance >= 70 |
| **T36** | 大数据量表格性能 | P1 | T05 (done) | BOM 1000+ 行渲染性能 |
| **T37** | API 响应时间基线 | P1 | T32 | 关键 API p95 < 500ms |

### Wave C: 业务补全 (P1 + P2)

| ID | 任务 | 优先级 | 依赖 | 备注 |
|---|---|---|---|---|
| **T31** | 金属价格联动计算 | P1 | T05,T14,T17 (all done) | metal_cost_impact 公式 + 预警触发 |
| **T38** | 参数快照化完整实现 | P2 | T14,T04 (done) | rate/bom/quote 三个快照字段完整工作 |

### 建议执行顺序

```
T30 (主题) → T32 (DB) → T33 (E2E) → T34 (API测试) → T31 (金属联动)
                                                          → T35 (Lighthouse)
                                                          → T36 (表格性能)
                                                          → T37 (API性能)
                                                          → T38 (快照化)
```

---

## 2. 未修复的代码问题 (Code Review Findings)

三轮复盘共发现 28 个问题。**12 个已远程修复**（在 `fix/review-findings-batch` 分支），**14 个需要本地补丁**，2 个 reserved/NA。

### 2.1 需要立即处理的本地补丁 (🔴 严重)

| # | 文件 | 问题 | 补丁文件 |
|---|---|---|---|
| **#10** | `HarnessEditPage.tsx` | `project.config!` crash — config 已移至 ScenarioRecord | REVIEW-FIXES-BATCH2.md |
| **#11** | `HarnessEditPage.tsx` | 新建线束 scenarioId 写空字符串 | REVIEW-FIXES-BATCH2.md |
| **#12** | `QuotePage.tsx` | 设变模拟 Tab 完全失效（读不存在的 HarnessInput 字段） | REVIEW-FIXES-BATCH2.md |

### 2.2 需要处理的本地补丁 (🟠 中等)

| # | 文件 | 问题 | 补丁文件 |
|---|---|---|---|
| **#13** | `QuotePage.tsx` | 缺少 QuoteEmptyState 组件渲染 | BATCH2 |
| **#14** | `BomWorkbookPage.tsx` | 保存时不写回计算 result | BATCH2 |
| **#15** | `BomWorkbookPage.tsx` | 场景过滤遗漏空 scenarioId 遗留数据 | BATCH2 |
| **#16** | `HarnessEditPage.tsx` | 无场景过滤，多场景同零件号冲突 | BATCH2 |
| **#23** | `pricingStore.ts` | Map + Zustand persist → 刷新丢数据 | BATCH3 |

### 2.3 需要处理的本地补丁 (🟡 轻微)

| # | 文件 | 问题 | 补丁文件 |
|---|---|---|---|
| **#17** | `QuotePage.tsx` | 重复加载竞态 (useEffect 重复) | BATCH2 |
| **#18** | `HarnessDetailPage.tsx` | 除零 NaN (materialCost=0 时) | BATCH2 |
| **#19** | `HarnessDetailPage.tsx` + `HarnessEditPage.tsx` | 复制线束用 UUID 作零件号 | BATCH2 |
| **#20** | `QuotePage.tsx` | 双重 fallback (手动 + hook 自动) | BATCH2 |
| **#27** | `ProjectListPage.tsx` | 废弃 Project.config 仍被写入 | BATCH3 |
| **#28** | `ScenarioSelector.tsx` | `onChange={handleChange as any}` 类型断言 | BATCH3 |

### 2.4 已远程修复 (✅ 在 fix/review-findings-batch 分支)

| # | 文件 | 修复内容 |
|---|---|---|
| 1-9 | safeCompute / EngineerWorkbench / QuoteEmptyState / useHarnessSync / App.tsx | Round 1: 导入路径 / 双引擎联动 / KPI / 错误边界 |
| #22 | `useDashboardData.ts` | `sc!` crash → `sc?.config?.costRates ?? DEFAULTS` |
| #24 | `data/e281Fallback.ts` | 双份模块合并 → re-export |
| #25 | `apiClient.ts` | 重试逻辑区分4xx/5xx |
| #26 | `useDashboardData.ts` | useMemo 依赖补全 |
| — | `safeMath.ts` | 新工具: safeDivide/safePercent/formatCurrency |
| — | `useScenarioData.ts` | 新 hook: 统一 project+scenario+harness 加载 |

### 2.5 补丁应用顺序

```bash
# Step 1: 合并远程修复
git merge origin/fix/review-findings-batch

# Step 2: 按文件分组应用本地补丁（每个文件的补丁集中应用）
#   HarnessEditPage.tsx   → #10, #11, #16, #19的EditPage部分
#   QuotePage.tsx          → #12, #13, #17, #20
#   BomWorkbookPage.tsx    → #14, #15
#   HarnessDetailPage.tsx  → #18, #19的DetailPage部分
#   pricingStore.ts        → #23
#   ProjectListPage.tsx    → #27
#   ScenarioSelector.tsx   → #28

# Step 3: 验证
npx tsc --noEmit && npx vitest run && npm run dev
```

### 2.6 为什么这些不能远程修复？

4 个页面文件 (`HarnessEditPage`、`QuotePage`、`BomWorkbookPage`、`HarnessDetailPage`) 含有 JSX `style=...` 内联样式。通过 Notion Agent 读取这些文件时，双花括号会被 Notion 压缩成数字占位符（如 `style=...`），推回会破坏代码。本地 AI 直接操作文件系统无此限制。

---

## 3. 技术债务

| 优先级 | 项目 | 说明 |
|---|---|---|
| 🔴 高 | `ChangeEnginePage.tsx` (56KB) | 应拆分，参考 DashboardPage 拆分模式 (PR #52) |
| 🟠 中 | `harness_costing.ts` (47KB) | 引擎文件较大，可拆分子模块 |
| 🟠 中 | `src/__backup_v1/` | 备份目录仍存在，应清理或归档 |
| 🟡 低 | CLAUDE.md 与实际架构不一致 | 见第 7 节架构说明 |
| 🟡 低 | 30+ 过期分支 | 见第 4 节清理列表 |
| 🟡 低 | progress.txt 重复条目 | 每个任务记录了两遍，可去重 |

---

## 4. 过期分支清理

以下 30 个分支已合并到 main，可安全删除：

```bash
# 批量删除过期分支
git push origin --delete \
  ci/github-actions \
  cleanup/repo-hygiene-and-file-migration \
  codex/landing-workbench-20260404 \
  codex/phase12-mainline-delivery \
  feat/batch-37-tasks \
  feat/landing-workbench-infra \
  feat/new-project-wizard-v2 \
  feat/project-config-schema \
  feat/remaining-tasks-batch \
  feat/workbench-fill-and-error-hardening \
  fix/bom-engine-quote-sync \
  fix/close-remaining-issues \
  fix/code-review-v3-xss-bom-compat \
  fix/comprehensive-code-review \
  fix/global-error-handling \
  fix/issue1-progress-price-gap \
  fix/issue2-residual-pool-stagnant \
  fix/issue3-waterfall-shapley \
  fix/issue4-config-driven-coefficients \
  fix/issue5-unit-set-alignkey \
  fix/metal-escalation-tests \
  fix/missing-barrel-exports \
  fix/phase1-encoding-duplicate-cleanup \
  fix/quote-empty-state-and-save-result \
  fix/session9-deep-cleanup \
  fix/style-placeholders-and-integration \
  fix/tsc-type-errors \
  fix/ui-p1-p2-security-architecture \
  fix/ui-p3-p4-polish

# 合并后再删除:
# fix/review-findings-batch  ← 合并 PR #58 后再删
```

---

## 5. CI 状态

- GitHub Actions: **全绿** (tsc + vitest 364/364 + vite build)
- 触发条件: push to main + PR
- 配置文件: `.github/workflows/ci.yml`

---

## 6. PR 状态

| PR | 状态 | 说明 |
|---|---|---|
| **#58** | 🟡 OPEN | 三轮复盘修复，12 个远程 fix + 2 个补丁指南。合并后应用本地补丁 |
| #44–#57 | ✅ MERGED | 全部已合并到 main |

---

## 7. 架构说明 (重要！CLAUDE.md 与实际有差异)

CLAUDE.md 是项目早期编写的，部分内容已过时。以下是实际架构：

### 前端实际架构 (app/)

| 层 | 实际技术 | CLAUDE.md 写的 | 差异 |
|---|---|---|---|
| UI 组件库 | **@douyinfe/semi-ui** | shadcn/ui + Tailwind | ❗ 完全不同 |
| 状态管理 | **Zustand 5** | 未提及 | — |
| 本地数据库 | **Dexie (IndexedDB)** | 未提及 | — |
| 电子表格 | **@univerjs/presets (Univer)** | 未提及 | — |
| 图表 | **ECharts + echarts-for-react** | 未提及 | — |
| 样式方案 | **CSS Modules + 内联 style** | Tailwind CSS | ❗ 不同 |
| 路由 | **react-router-dom v7** | 同 | — |
| 构建 | **Vite 6.2** | 同 | — |

### 后端实际架构 (server/)

| 层 | 实际技术 | CLAUDE.md 写的 | 差异 |
|---|---|---|---|
| 框架 | **Express + TypeScript** | FastAPI + Python | ❗ 完全不同 |
| ORM | **Prisma** | SQLAlchemy | ❗ 不同 |
| 数据库 | **SQLite (via Prisma)** | SQLite (via SQLAlchemy) | DB同，ORM不同 |
| 测试 | **自定义 test_api.js** | pytest | ❗ 不同 |

### 关键架构决策

1. **离线优先**: 前端用 Dexie (IndexedDB) 作主数据源，服务端可选
2. **双引擎**: 内部实绩成本 (internalCost) vs 客户报价 (customerQuote) 独立计算
3. **场景配置**: v7+ config 在 ScenarioRecord 上，不在 ProjectRecord 上 (重要!)
4. **E281 Fallback**: 演示项目 E281 有硬编码的 fallback 数据

### 核心数据流

```
HarnessInput (BOM编辑)      ScenarioRecord.config (费率/金属价)
       \                         /
        \                       /
         v                     v
    computeHarnessCost() / computeInternalHarnessCost()
              |
              v
    HarnessResult / InternalHarnessResult
              |
              v
    computeProjectFromHarnesses()
              |
              v
    ProjectHarnessResult (vehicleCost / 利润 / KPI)
              |
              v
    DashboardPage / QuotePage / 导出
```

---

## 8. 关键业务规则 (不可违反)

1. **粒度到线束号/BOM 行** — 所有成本必须精确到线束号
2. **双引擎并行** — 内部实绩 vs 客户报价 独立口径
3. **三层价格**: L1 内部核算价 / L2 客户确认快照价 / L3 当前有效执行价
4. **分摊 ≠ 回收** — 分层实现
5. **总成的单位是 SET (套)** — 不是「根」
6. **铜重/铝重不属于开发 BOM** — 仅存在于核算引擎
7. **BOM 数据通过 Univer 直接编辑** — 不是 Excel 粘贴导入
8. **参数快照化** — 关键节点必须保留费率/参数/BOM 快照

详见 CLAUDE.md 第「绝对不可违反的业务规则」节（规则部分仍然有效）。

---

## 9. 核心类型位置速查

| 类型 | 文件 |
|---|---|
| `CostRates`, `MetalPrices`, `InternalCostRates` | `@/types/project` |
| `InternalHarnessResult`, `InternalProjectResult` | `@/types/harness` |
| `ProjectHarnessResult` | `@/types/harness` — 含 vehicleCost/weightedMaterial/weightedLabor |
| `HarnessInput` | `@/types/harness` — **没有** materialCost/processHours (这些是计算输出) |
| `DEFAULTS` (CostRates) | `@/engine/harness_costing` export |
| `INTERNAL_DEFAULTS` (InternalCostRates) | `@/engine/harness_costing` export |
| `ProjectRecord`, `ScenarioRecord`, `HarnessRecord` | `@/data/db` |
| Zustand stores | `@/store/pricingStore`, `@/store/projectStore`, `@/store/allocStore` |

---

## 10. 工作流约定

本地 AI 应遵循 CLAUDE.md 中的 6 步工作流：
1. 初始化环境
2. 选择下一个任务 (task.json 中 status: pending)
3. 实现任务
4. 强制测试 (tsc + vitest + Playwright)
5. 更新 progress.txt
6. 提交变更 (一个 task 一个 commit)

### 特别注意

- **noUncheckedIndexedAccess**: tsc 最常见报错来源
- **JSX 样式写法**: 推荐 `const S: Record<string, CSSProperties> = {...}` + `style={S.xxx}`，避免内联 `style=...`
- **场景配置**: 始终从 `scenario.config` 读取，不要读 `project.config`
- **空 scenarioId 兼容**: 查询线束时兼容空/缺失的 scenarioId (迁移遗留数据)

---

## 11. 目录结构速查

```
/
├── CLAUDE.md              # Agent 工作流指令 (业务规则有效，架构部分过时)
├── HANDOFF.md             # AI 接力交接文档
├── LOCAL-AI-HANDOFF.md    # 本文件 — 全量交接
├── REVIEW-FIXES-BATCH2.md # Round 2 本地补丁指南 (11项)
├── REVIEW-FIXES-BATCH3.md # Round 3 本地补丁指南 (3项)
├── app_spec.md            # 完整功能规格
├── task.json              # 任务定义 (38个，29 done / 9 pending)
├── progress.txt           # 跨 session 进度日志
├── app/                   # 前端 (React + Vite + TS)
│   ├── src/
│   │   ├── components/    # 30+ 共享组件
│   │   ├── pages/         # 28 个页面组件
│   │   ├── engine/        # 核心计算引擎 (35+ 模块)
│   │   ├── hooks/         # 自定义 hooks
│   │   ├── utils/         # 工具函数
│   │   ├── store/         # Zustand 状态管理
│   │   ├── types/         # TypeScript 类型定义
│   │   ├── data/          # Dexie 数据库定义
│   │   └── lib/           # API 客户端
│   ├── package.json
│   └── vite.config.ts
├── server/                # 后端 (Express + Prisma + SQLite)
│   ├── src/
│   │   ├── routes/        # API 路由
│   │   ├── services/      # 业务逻辑
│   │   └── index.ts       # 入口
│   ├── prisma/            # Prisma schema + migration
│   └── test_api.js        # API 集成测试
└── .github/workflows/     # CI 配置
```

---

## 12. 开发环境

```bash
# 前端
cd app
npm ci
npm run dev          # http://localhost:5173
npm run build        # tsc -b && vite build
npm run test:run     # vitest run (364 tests)

# 后端
cd server
npm ci
npm run build        # tsc
npm start            # http://localhost:3001
node test_api.js     # API 集成测试
```

---

## 13. 版本记录

| 版本 | 日期 | 内容 |
|---|---|---|
| v0.9.0 | 2026-04-12 | 12 模块基本功能完成，CI 全绿，三轮代码复盘 |
| 下一个目标: v1.0.0 | TBD | 完成 T30-T38 + 所有补丁 + E2E 测试通过 |
