# HANDOFF.md — AI 接力开发交接文档

> 最后更新: 2026-04-12 22:55 (Asia/Shanghai)
> 更新者: Notion AI Agent (leeyou · 第二大脑)
> Main HEAD: `83cbfb5801bf5d59fba6562796a24802e9e8dab0`
> Fix branch HEAD: `3568490efb8349ac9bb532591217000a9c6271eb`
> Tag: **v0.9.0** | 下一目标: **v1.0.0**

---

## 1. 项目概要

**项目名称**: harness-cost-workbench (高压线束成本精算与决策工作台)
**仓库**: https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722 (PUBLIC)
**定位**: 面向汽车高压线束供应商的成本精算与决策引擎，支持 BOM → 报价 → 分摊回收 → 设变跟踪 → 预警 的全生命周期经营闭环。
**成熟度**: ~85% (核心功能完成，三轮代码复盘完成，待本地补丁+集成验证)

## 2. 技术栈

| 层 | 技术 | 版本 |
|---|---|---|
| 前端框架 | React + TypeScript | React 18.3, TS ~5.7 |
| 构建工具 | Vite | 6.2 |
| UI 组件库 | @douyinfe/semi-ui | ^2.73.0 |
| 电子表格 | @univerjs/presets (Univer) | ^0.20.0 |
| 图表 | ECharts + echarts-for-react | ^5.6.0 |
| 状态管理 | Zustand | 5.0 |
| 本地数据库 | Dexie (IndexedDB) | ^4.0.11 |
| 后端框架 | Express + TypeScript | ^4.x |
| ORM | Prisma | latest |
| 后端数据库 | SQLite (via Prisma) | — |
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
│   │   ├── RouteErrorBoundary.tsx  # 路由级错误边界 (PR #56)
│   │   ├── QuoteEmptyState.tsx     # 报价空状态组件 (PR #55)
│   │   └── ...
│   ├── pages/               # 28 个页面组件
│   ├── engine/              # 核心计算引擎 (35+ 模块)
│   │   ├── harness_costing.ts       # 47KB 线束成本核算主引擎
│   │   └── ...
│   ├── hooks/               # 自定义 hooks
│   │   ├── useHarnessSync.ts        # 自动重算 hook (PR #54)
│   │   ├── useScenarioData.ts       # 统一场景数据加载 (Review fix)
│   │   ├── useDashboardData.ts      # Dashboard 数据 (PR #52 + Review fix)
│   │   └── ...
│   ├── utils/               # 工具函数
│   │   ├── safeMath.ts              # 安全数学运算 (Review fix)
│   │   ├── safeCompute.ts           # 安全计算包装 (PR #57 + Review fix)
│   │   └── ...
│   ├── store/               # Zustand 状态管理
│   ├── types/               # TypeScript 类型定义
│   ├── data/                # Dexie 数据库定义
│   └── lib/                 # API 客户端
├── package.json
├── tsconfig.json
├── vite.config.ts
└── vitest.config.ts
```

## 4. CI/CD 状态: ✅ 全部通过

- 测试: **364 passed, 0 failed** (48 个测试文件)
- 构建: ✅ Production build 成功
- 触发: push to main + PR

## 5. PR 记录

| PR | 标题 | 状态 |
|---|---|---|
| **#58** | fix: review findings Round 1+2+3 — 28 issues, 12 remote fixes + 2 patch guides | 🟡 OPEN |
| #57 | fix: global error handling + safe compute + API error interceptor | ✅ merged |
| #56 | feat: EngineerWorkbench real data + RouteErrorBoundary | ✅ merged |
| #55 | fix: QuotePage empty state + BomWorkbook save-with-result | ✅ merged |
| #54 | fix: BOM→Engine→Quote sync hardening | ✅ merged |
| #53 | feat: NewProjectWizard rewrite + ProjectListPage alignment | ✅ merged |
| #52 | refactor: DashboardPage 57KB split into 10 modules | ✅ merged |
| #44–#51 | 基础设施 + 清理 + CI + 代码合并 | ✅ merged |

## 6. 代码复盘状态 (PR #58)

三轮深度复盘，共发现 28 个问题。

| 分类 | 数量 | 状态 |
|---|---|---|
| ✅ 远程已修复 | 12 | 在 `fix/review-findings-batch` 分支 |
| 📋 本地补丁 | 14 | 见 REVIEW-FIXES-BATCH2.md (11项) + BATCH3.md (3项) |
| NA/reserved | 2 | — |

严重度分布：
- 🔴 严重: 5 (4已修 / 1待本地修)
- 🟠 中等: 6 (1已修 / 5待本地修)
- 🟡 轻微: 8 (3已修 / 5待本地修)

详见 **LOCAL-AI-HANDOFF.md** 第 2 节。

## 7. 待办任务 (task.json)

38 个任务中 **29 done / 9 pending**。

| ID | 任务 | 优先级 | 状态 |
|---|---|---|---|
| T30 | 深色主题 + 工业蓝图风格 | P0 | pending |
| T31 | 金属价格联动计算 | P1 | pending |
| T32 | SQLite 数据库初始化 + Migration | P0 | pending |
| T33 | E2E 测试 — P0 主链路 | P0 | pending |
| T34 | API 测试 — 核心计算规则 | P0 | pending |
| T35 | Lighthouse 性能基线 | P1 | pending |
| T36 | 大数据量表格性能 | P1 | pending |
| T37 | API 响应时间基线 | P1 | pending |
| T38 | 参数快照化完整实现 | P2 | pending |

详见 **LOCAL-AI-HANDOFF.md** 第 1 节。

## 8. 12 个功能模块

| 编号 | 模块 | 优先级 | 状态 |
|------|------|--------|------|
| F01 | 项目管理与 Dashboard | P0 | ✅ 完成 |
| F02 | 场景管理 | P0 | ✅ 完成 |
| F03 | BOM 工作簿 | P0 | ✅ 完成 |
| F04 | 客户报价工作台 | P0 | ✅ 完成 |
| F05 | Simulation 与年降管理 | P1 | ✅ 完成 |
| F06 | 分摊回收跟踪 | P0 | ✅ 完成 |
| F07 | 设变与跟踪 | P1 | ✅ 完成 |
| F08 | 预警系统与 Alerts | P1 | ✅ 完成 |
| F09 | 管理决策舱 | P2 | ✅ 完成 |
| F10 | 版本与发布治理 | P2 | ✅ 完成 |
| F11 | 系统设置与参数治理 | P0 | ✅ 完成 |
| F12 | Profile 与个人中心 | P2 | ✅ 完成 |

## 9. 关键业务概念 (开发必读)

详见 `CLAUDE.md`，核心规则:
1. **粒度到线束号/BOM 行** — 所有成本必须精确到线束号
2. **双引擎并行** — 内部实绩 vs 客户报价 独立口径
3. **三层价格**: L1 内部核算价 / L2 客户确认快照价 / L3 当前有效执行价
4. **分摊 ≠ 回收** — 分层实现
5. **总成的单位是 SET (套)** — 不是「根」
6. **铜重/铝重不属于开发 BOM** — 仅存在于核算引擎
7. **BOM 数据通过 Univer 直接编辑** — 不是 Excel 粘贴导入

## 10. 开发环境启动

```bash
# 前端
cd app
npm ci
npm run dev          # Vite dev server → http://localhost:5173
npm run build        # tsc -b && vite build
npm run test:run     # vitest run (364 tests)

# 后端
cd server
npm ci
npm run build
npm start            # http://localhost:3001
```

## 11. 待办事项汇总

### 立即执行
1. **合并 PR #58** — `git merge origin/fix/review-findings-batch`
2. **应用 14 个本地补丁** — 见 REVIEW-FIXES-BATCH2.md + BATCH3.md
3. **本地集成验证** — `npm run dev` + 人工走查主链路

### 开发任务 (9 个 pending)
- 见 task.json，建议顺序: T30 → T32 → T33 → T34 → T31 → T35–T38

### 清理
- 30+ 过期分支清理 (`git push origin --delete <branches>`)
- `src/__backup_v1/` 备份目录删除
- progress.txt 去重

### 技术债务
- `ChangeEnginePage.tsx` (56KB) 拆分
- `harness_costing.ts` (47KB) 可拆子模块
- CLAUDE.md 架构部分更新 (见 LOCAL-AI-HANDOFF.md 第 7 节)

## 12. 给接力 AI 的建议

1. **先读 LOCAL-AI-HANDOFF.md** — 全量交接文档，包含所有剩余任务、未修问题、架构说明
2. **读 CLAUDE.md** — 业务规则是硬约束 (架构部分参考 LOCAL-AI-HANDOFF.md)
3. **读 app_spec.md** — 完整功能需求
4. **先合并 PR #58 + 应用补丁** — 在做新任务之前
5. **注意 noUncheckedIndexedAccess** — tsc 最常见报错来源
6. **JSX 样式写法** — 用 `style={S.xxx}` 不要用 `style=...`
7. **场景配置** — 始终从 `scenario.config` 读取，不要读 `project.config`
