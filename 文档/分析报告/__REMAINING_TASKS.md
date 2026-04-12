# 完整任务清单 — 高压线束成本核算动态模型

> **更新日期**: 2026-04-06 (第8次更新，session 9)  
> **基线指标**: 0 TS errors / 30 test files / 271 tests / vite build ✅  
> **参考文档**: `__LANDING_PLAN.md`, `__OPTIMIZATION_REPORT_v2.md`

---

## 一、已完成工作总览

| 阶段 | 完成度 |
|:---|:---:|
| Phase 0 脚手架 (React 18 + TS + Vite + Semi + Zustand + Dexie + PWA) | ✅ 100% |
| Phase 1 核心核算 (13页面 + 引擎 + BOM + 报价模板 + E2E ±0.01) | ✅ 100% |
| Phase 2 后端+同步 (syncEngine 双模 offline/bitable/server) | ✅ 100% |
| Phase 3 报价引擎 (设变 + 金属联动 + 年降 + What-if + 管理仪表盘) | ✅ 85% |
| Phase 4 打磨 (性能 + 主题 + PWA + 审计日志) | ✅ 75% |
| P0-权限 (usePermission + RoleGuard + 5页面字段级RBAC) | ✅ 100% |
| P1-精度/通用化 (Schema + 三级精度 + 多工厂 + 年度 + 分摊 + BOM分类) | ✅ 100% |
| P2-清理 (legacy + Python scripts) | ✅ 100% |
| #6 Shapley/Level1 可配置 (type + engine + store + UI) | ✅ 100% |
| #8 BOM 分类规则 UI (CRUD + 7 分类 Tag) | ✅ 100% |
| Univer Phase 1-3 (BOM编辑 + 成本只读 + 仪表盘切换) | ✅ 100% |
| E2E 全流程测试 (5 阶段管线) | ✅ 100% |
| #7 增量计算引擎 (DAG + recomputeFrom + 12 tests) | ✅ 100% |
| **SimulationPage DAG 接入** (dagBaseline + dagSimulation + 性能指示器) | **✅ 100%** |
| **数据一致性校验引擎** (H001-H011, P001-P005, X001 + 12 tests) | **✅ 100%** |
| **多项目组合分析引擎** (summary + contribution + risk exposure + 7 tests) | **✅ 100%** |
| **#25 一致性校验 UI** (DashboardPage ValidationPanel) | **✅ 100%** |
| **#26 组合分析 UI** (ManagerDashboardPage 组合分析 Tab) | **✅ 100%** |
| **#27 Python 数据提取框架** (BaseExtractor + 9 extractors + CLI) | **✅ 100%** |
| **#28 金属价格 API** (metal_api.ts + 19 tests + SimulationPage 实时按钮) | **✅ 100%** |
| **飞书集成 F1-F6** (OAuth + Bitable + syncEngine + 消息卡片 + 配置指南 + 验证) | **✅ 100%** |

### 飞书集成模块 (7 个文件)

| 模块 | 文件 | 功能 |
|:--|:--|:--|
| OAuth 免登 | `lib/feishuAuth.ts` | 环境检测 + JSSDK + requestAccess + OAuth 重定向 |
| API 客户端 | `lib/feishuApi.ts` | tenant_access_token + user_access_token + 用户信息 |
| 消息卡片 | `lib/feishuMessage.ts` | 金属价格预警 + 核算完成通知 + 通用消息 |
| Bitable Schema | `sync/bitableSchema.ts` | 5表映射 + 字段名 + JSON 字段 |
| Bitable 适配器 | `sync/bitableAdapter.ts` | CRUD + 批量 + 搜索 + upsert |
| Bitable 同步 | `sync/bitableSync.ts` | push + fullPull + ping |
| 双模引擎 | `sync/syncEngine.ts` | offline/bitable/server 自动检测 + 切换 |

### 核心引擎模块 (17 个)

| 模块 | 文件 | 功能 |
|:--|:--|:--|
| 核心核算 | `harness_costing.ts` | computeHarnessCost + Adaptive (三级) + Schema |
| 年度分摊 | `annualized_cost.ts` | 设备折旧 + 固定制造费 |
| 多工厂 | `factory_comparison.ts` | 7 工厂 + 效率系数 |
| 间接分摊 | `allocation.ts` | 6 驱动因子 × 4 费用 |
| 精度检测 | `precision.ts` | 三级 + Level 1 系数 |
| BOM 解析 | `bom_parser.ts` | Excel 导入 + 分类 |
| 设变定价 | `change_pricing.ts` | 工程变更定价 |
| 金属联动 | `metal_escalation.ts` | 铜/铝价格联动 |
| 报价模板 | `quote_template.ts` | 吉利/BYD/通用 |
| Excel 导出 | `excel_export.ts` | 报价单/成本表 |
| ZIP 导出 | `zip_export.ts` | 批量打包 |
| 版本对比 | `version_diff.ts` | 版本差异 |
| 项目 IO | `project_io.ts` | 导入/导出 |
| 增量计算 | `incremental_calc.ts` | DAG + computeAll + recomputeFrom |
| 一致性校验 | `consistency_check.ts` | 17 条规则 + validateAll |
| 组合分析 | `portfolio_analysis.ts` | 汇总 + 贡献度 + 风险敞口 |
| 金属价格 | `metal_api.ts` | 多数据源回退 + 缓存 + 历史 + SHFE |

### 测试覆盖 (30 files / 271 tests)

| 分类 | 文件数 | 测试数 |
|:--|:---:|:---:|
| E2E 验证 (±0.01 精度) | 1 | 31 |
| E2E 全流程管线 | 1 | 5 |
| 自适应引擎 | 1 | 17 |
| 增量计算 | 1 | 12 |
| 一致性校验 | 1 | 12 |
| 组合分析 | 1 | 7 |
| 金属价格 API | 1 | 19 |
| 其余模块 | 23 | 168 |

---

## 二、未完成任务

### P0 — 外部依赖 (用户操作)

#### 飞书应用激活
**状态**: 代码 100% 完成，等待用户配置  
**需要用户操作**:
1. 按照 `FEISHU_SETUP_GUIDE.md` 创建飞书企业自建应用
2. 配置网页应用 + API 权限
3. 创建多维表格 (5 张表)
4. 填写 `.env.local` 环境变量
5. 发布应用到组织

---

### P2 — 产品化 (可选)

#### #3. 移动端审批视图优化 (~3d)
**前置**: 飞书应用已激活

#### #4. Electron 离线桌面版打包 (~2d)
**前置**: 无 (用户暂缓 — "Electron 打包先不做")

---

## 三、工作量汇总

| 路径 | 工时 | 说明 |
|:--|:--|:--|
| 飞书激活 | 用户操作 | 创建应用 + 配置 Bitable |
| 移动端 | ~3d | 依赖飞书 |
| Electron | ~2d | 可选 |
| **合计** | **~5d** | 仅代码工作 |

> **对比上一版**: 飞书集成代码 15d → 0d (全部完成)。剩余仅外部配置 + 可选功能。

---

## 四、建议下一步

1. **立即**: 按照 `FEISHU_SETUP_GUIDE.md` 创建飞书应用 + 多维表格
2. **配置完成后**: 集成测试 (OAuth 登录 + Bitable 数据同步 + 消息卡片)
3. **后续**: Electron 打包 (可选)
