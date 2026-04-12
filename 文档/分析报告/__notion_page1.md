# 存档 · G281高压线束动态利润模型仓库解读 · 2026-04-02

## [2026-04-02 18:13] 用户提问
对 GitHub 仓库 [cost-accounting-dynamic-model-v2026-04-02-1722](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722) 进行解读。

---

## [2026-04-02 18:14] 初步解读
详见上一轮对话。

---

## [2026-04-02 18:16] 用户追加
提供 `docs/session-context-2026-04-02.md` 上下文，要求深入解读全部模块。

---

## [2026-04-02 18:20] 全模块深度解读
详见当前对话线程。

---

## [2026-04-02 19:20] UI 架构分析与优化意见

### 分析范围
- `g281_profit_dashboard.html` (40KB) — 主 HTML
- `g281_profit_dashboard.css` (92KB) — 全局样式
- `g281_profit_dashboard.js` (448KB) — 主控逻辑
- `g281_profit_insights.js` (11KB) — 利润洞察卡片
- `g281_profit_logic_drawer.js` (33KB) — 利润逻辑抽屉
- `g281_version_timeline.js` (8KB) — 版本时间线
- `g281_workbook_viewer.js` (48KB) — 工作簿查看器

### 已识别的 6 类核心问题
| 级别 | 问题 | 影响 |
| :--- | :--- | :--- |
| P0 | 巨石 Dashboard.js（448KB 单文件，状态/渲染/事件/工具全混） | 无法并行开发，合并冲突 |
| P0 | 新旧 UI 并存 + DOM 搬家（ensureDashboardUiScaffold ~300行搬节点） | HTML 与实际 DOM 不一致 |
| P1 | HTML 编码损坏（UTF-8/GBK 乱码：瀵规瘮宸︾増 等） | 用户可见乱码 |
| P1 | 7 个 Modal 各自实现打开/关闭/Escape/窗口控制 | 代码重复，行为不一致 |
| P2 | CSS 92KB 平铺，无 BEM/模块化/CSS 变量 | 样式冲突风险高 |
| P2 | 重复 ID（profitInsightsMount ×2）+ 重复赋值（同一元素赋值2-3次） | 潜在 Bug |

### 推荐重构路径
1. **低风险**：修复 HTML 乱码 + 删除重复 ID + 清理重复赋值
2. **低风险**：提取 `utils/format.js` + `utils/parse.js`（纯函数）
3. **中风险**：提取各 renderer 模块（KPI/成本桥/年度图等）
4. **中风险**：统一 Modal 基类，逐个迁移
5. **高风险**：HTML 直接写最终结构，删除 `ensureDashboardUiScaffold()`
6. **高风险**：CSS 拆分 + BEM 重命名

### GitHub Issue
- [Issue #6: UI 架构重构](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/issues/6)

---

## [2026-04-02 19:30] 页面信息层级线框图大纲

### 设计目标
把当前 ~15 个平铺 section 压缩为 3 层信息密度：“一眼看到”→“点开看细节”→“按需进入工作台”。

### 线框图结构
(见 Notion 原页面图示)

### Layer 1：一眼看到（常驻，不滚动即可获取）
- **场景切换条** [场景名称] [版本标签组] [工厂] [生成] [保存]
- **KPI 一行 (5 卡片)** [单套收入] [单套成本] [单套毛利] [毛利率] [回收期]

**设计要点**：
- 场景切换条替代当前看板区“场景管理”模块，压缩为一行
- KPI 保留现有 5 列布局，增加与基准场景的差异箭头
- 两行合计约 120px，不滚动即可获取核心数据

### Layer 2：点开看细节（主滚动区，按业务逻辑排序）
- **A. 变更影响分析 (并排两卡)**: 变更因果链瀑布图 (新增Issue#3) | Shapley 归因雷达图 (已有)
- **B. 成本结构 (并排两卡)**: 成本桥 (单套拆分) | 年度收益图 (6年)
- **C. 线束利润拆解 (可折叠)**: ▶ 整套线汇总 + 单线束拆解表
- **D. 单套对比 + 资本池 (并排)**

**与当前的关键变化**：
- “变更可视化”和“利润驱动拆解”合并为 A. 变更影响分析，左右并排瀑布图+Shapley
- “成本桥”和“年度收益图”保留并排，位置上移到第二屏
- “配置结构&价格类型画像”和“变更事件总览”移入 Layer 3 的 Tab
- “线束利润汇总”改为可折叠，默认只显示汇总行

### Layer 3：工作台（Tab 切换，按需进入）
- [BOM] [连接器] [导线] [工时] [包装] [历史] [审批] [配置]
- **Tab 内容区**:
  - BOM Tab: BOM 工程台 + 零件变更关系
  - 连接器 Tab: 价格执行表 + 协议达成跟踪
  - 导线 Tab: 导线原材料计算表
  - 工时/包装 Tab: 版本对比 + 应用按钮
  - 历史 Tab: 版本库 + 审批记录
  - 配置 Tab: 配置结构画像 + 价格类型分布 + 年度汇总表

**设计要点**：
- 当前看板区的 4 个“管理”按钮（BOM/资源/工时/包装）打开的是 Modal，重构后改为 Tab 内嵌
- 可显著减少 Modal 数量（4 个→仅保留版本模板编辑器 1 个）
- “四层结构总览”、“模型说明”段移除——开发者文档不应占据产品界面
- Tab URL hash 路由（#bom, #connector），支持直链和浏览器后退

### 当前→目标映射表
| 当前 Section | 目标位置 | 变化 |
| :--- | :--- | :--- |
| KPI Grid | Layer 1 | 保留，增加差异箭头 |
| 利润驱动拆解 | Layer 2-A 右侧 | 与变更可视化合并 |
| 线束利润汇总 | Layer 2-C | 改为可折叠 |
| BOM 工程台 + 零件变更 | Layer 3 BOM Tab | 从主滚动区移入 Tab |
| 导线原材料计算 | Layer 3 导线 Tab | 从主滚动区移入 Tab |
| 配置结构 + 价格类型 + 年度汇总 | Layer 3 配置 Tab | 合并为 1 个 Tab |
| 模型说明 | 删除 | 同上 |

### 已创建的 PR
- [PR #7: utils/ 工具函数拆分](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/pull/7)
- [PR #8: Phase 1 清理清单](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/pull/8)

---

## [2026-04-02 19:36] 全代码深度审查 — 新增优化点

### 审查范围
8 个业务逻辑文件：engine / solver / shapley / harness_profit / bom_parser / bom_schema / bom_db / repo

### 🔴 P0 — 正确性风险
| # | 问题 | 文件 | 影响 |
| :--- | :--- | :--- | :--- |
| 1 | `numberOr` 和 `approxEqual` 在 `engine.js` 同一 IIFE 内重复定义 2 次 | `engine.js` | 后定义覆盖前定义，参数签名不同 |
| 2 | `annualDrop.yearRows[index]` 可能越界 → `TypeError` | `engine.js` | 运行时崩溃 |
| 3 | Shapley 遍历 2^n 子集无上限保护（n=12→4096次） | `shapley.js` | 浏览器卡死风险 |

### 🟠 P1 — 可维护性
| # | 问题 | 影响 |
| :--- | :--- | :--- |
| 4 | 跨模块重复工具函数：`numberOr`×5, `clonePlain`×4, `safeArray`×3 | 维护成本高 |
| 5 | `engine.js` 900行单文件，`computeModel` 200行巨型函数 | 可读性差 |
| 6 | `repo.js` `localStorage` 无 schema version 迁移机制 | 数据丢失风险 |

### 🟡 P2 — 性能与健壮性
| # | 问题 | 影响 |
| :--- | :--- | :--- |
| 7 | `wireCatalog` 索引每次调用重建 | 性能浪费 |
| 8 | `solver` 二分法区间硬编码 `minFactor=0`, `maxFactor=64` | 极端场景失败 |
| 9 | `bom_parser` `rowCount` 回退 2000 行硬扫描 | 性能浪费 |
| 10 | 端组别名表硬编码在 parser 中 | 扩展性差 |

### 🟢 P3 — 代码质量
| # | 问题 | 影响 |
| :--- | :--- | :--- |
| 11 | `engine.js` `buildExactFinancialModel` 中 `dataLayer`/`engineLayer` 乱码 | 展示错误 |
| 12 | `legacyAnnualDropRows` 中 '????' 占位符残留 | 可读性 |
| 13 | engine/repo/parser 缺乏 IIFE 依赖声明 | 加载顺序脆弱 |

### 处理结果
- PR #8 清单已追加 P0 项（#1 #2 #3 #11 #12）→ [查看更新后的清单](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/blob/fix/phase1-encoding-duplicate-cleanup/docs/phase1-cleanup-checklist.md)
- 新建 GitHub Issues:
  - [#9: engine.js 按职责拆分为 4 个子模块](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/issues/9) (P1)
  - [#10: 跨模块工具函数去重统一迁移至 utils/](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/issues/10) (P1)
  - [#11: repo.js localStorage schema version 迁移](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/issues/11) (P1)
  - [#12: Phase 3 性能与健壮性优化合集](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/issues/12) (P2–P3)

---

## [2026-04-02 19:56] 四页架构方案 — 预演 / 核算 / 跟踪 / 归档

### 用户确认的业务决策
- ② 核算：内部报价工作台（非给客户的文档）
- ② 核算：变更 diff = 自动计算 + 人工校核标记
- ③ 跟踪：到连接器单料号级别，采购手工录入实际价
- ④ 归档：存报价全套资料及版本快照，导出格式 Excel

### 数据流
① 预演 ──冻结参数──→ ② 核算 ──报价基准──→ ③ 跟踪 ──状态变更──→ ④ 归档
  ↑                                                              │
  └──────────────────── 加载历史版本 ──────────────────────────────┘

### 各页职责定义
| 页面 | 核心问题 | 代码覆盖率 | 主要缺口 |
| :--- | :--- | :--- | :--- |
| ① 预演 | 如果 X 变了，利润会怎样？ | ~80% | 砍掉非预演功能 |
| ② 核算 | 这次报价的数字是多少？ | ~20% | 需新建：报价表结构、自动 diff+校核、一次性费用编辑、Excel 导出 |
| ③ 跟踪 | 报出去的价落实了多少？ | ~30% | 需新建：单料号追踪 UI、采购手工录入、一次性费用执行、呆滞物料管理 |
| ④ 归档 | 历史上发生了什么？ | ~50% | 需新建：版本 diff、报价包 Excel 导出、BOM 文件关联 |

### 实施顺序
1. **Phase A** — ① 预演：从当前 dashboard 砍掉非预演功能（依赖 Issue #6）
2. **Phase B** — ④ 归档：移出 repo + workbook_viewer
3. **Phase C** — ② 核算：新建报价核算工作台 + 自动 diff + Excel 导出
4. **Phase D** — ③ 跟踪：新建执行跟踪台 + 单料号追踪 + 手工录入

### GitHub Issue
- [Issue #13: 四页架构拆分](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/issues/13)

---

## [2026-04-02 20:03] 多项目可复用架构 — 配置驱动 + 变更管控

### 用户确认的业务决策
- **配置存储**：JSON 文件，可导入导出
- **项目隔离**：完全隔离（版本快照/审批/BOM 互不干扰）
- **配置变更**：生命周期年限、车型配置比例等为受控基线，修改必须通过正式项目变更流程（设计变更 / 过程变更 / 商务变更）

### 核心设计
- `projectConfig` 对象包含：项目元数据、受控基线（lifecycle + vehicleConfigs + annualVolumes）、线束定义、量纲、BOM 解析规则、成本要素结构、变更历史
- **变更类型**：design（设计）/ process（过程）/ commercial（商务）
- **变更流程**：发起申请 → 审批 → `baseline.version += 1` → 旧基线存入 `changeHistory` → 触发预演重算 → 生成变更报价

### 改造层级
| 层级 | 内容 | 估算 |
| :--- | :--- | :--- |
| ① 文件/命名 | 去掉 g281_ 前缀 → 通用名 | 0.5 天 |
| ② 存储 | `localStorage` key = `${projectId}-*`；JSON 导入导出 | 1 天 |
| ③ BOM 解析 | 别名/sheet匹配/总成识别 → 从 config 读 | 1 天 |
| ④ 计算引擎 | 线束/配置/年限/量纲 → config 注入 | 2 天 |
| ⑤ UI | 项目名/线束选择器/配置编辑 → 动态渲染 | 2 天 |
| ⑥ 项目管理 | 新增：项目列表页 + 新建/导入/切换 | 1.5 天 |
| ⑦ 变更管控 | 新增：变更申请 + 基线锁定 + 审批 + 历史 | 2 天 |
| **合计** | | **~10 天** |

### 实施顺序（与 Issue #13 四页架构交织）
1. 本 Issue ①②③ — 文件重命名 + 存储隔离 + BOM 配置化
2. Issue #13 Phase A — 预演页拆分
3. 本 Issue ④⑤ — 引擎配置注入 + UI 动态化
4. Issue #13 Phase B/C/D — 归档/核算/跟踪页
5. 本 Issue ⑥⑦ — 项目管理页 + 变更管控

### GitHub Issue
- [Issue #14: 多项目可复用架构](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/issues/14)

---

## [2026-04-02 20:10] G281 projectConfig 提取 + Issue #1–#5 修复方案

### G281 projectConfig JSON
从代码中提取所有硬编码值，生成 `config/g281.project.json`，覆盖：
- 材料成本组成系数（0.24/0.38/0.18/0.20）← `engine.js`
- 金属敏感度系数（Cu 0.65, Al 0.45）← `engine.js`
- BOM 解析规则（sheetRoleMap, endGroupAliases, 分类关键词）← `bom_parser.js`
- 成本要素结构 ← `bom_parser.js` 分类逻辑
- 状态默认值 ← `engine.js` `computeModel`
- 存储/命名空间前缀 ← `repo.js`
- [PR #15: G281 projectConfig JSON](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/pull/15)

### Issue #1–#5 修复方案摘要
| Issue | 修复方案核心 | 改动文件 |
| :--- | :--- | :--- |
| [#1 进度价](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/issues/1) | 从“加权混合因子”改为“协议价落地差距追踪”；新建 `tracker_protocol.js` 属于③跟踪页 | `engine.js`, 新建 `tracker_protocol.js` |
| [#2 残余材料池](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/issues/2) | 区分 unmatched 原因（变更取消 vs 目录未收录）；取消料不分摊，走呆滞提报流程；保留导线信息以备切换回来 | `harness_profit.js`, 新建 `tracker_stagnant.js` |
| [#3 瀑布图+Shapley](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/issues/3) | 新增 `profit_waterfall.js` 按因果顺序逐步叠加；Shapley 加 n 上限保护；两者并排展示 | 新建 `profit_waterfall.js`, `shapley.js`, `dashboard.js` |
| [#4 计算路径系数](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/issues/4) | 系数提取到 `projectConfig.materialComposition`；明确标注 `estimatedPath` vs `exactPath`；UI 提示当前计算路径 | `engine.js`, `config/g281.project.json` |
| [#5 unit=set 识别](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/issues/5) | `classifyBomItem` 增加 `unit=set` 总成识别；新增总成→散件展开 + 按端识别替换/取消/新增 | `bom_parser.js`, `harness_profit.js` |

---

## [2026-04-02 20:22] Issue #4 代码实施 + ② 核算页线框图

### Issue #4 — 计算路径系数配置化
- 已合并 PR #15（projectConfig + ConfigLoader + StorageAdapter + rename map）
- 已创建 [PR #16（计算路径系数配置化 + 路径指示器）](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/pull/16)
- **新增模块**：
  - `engine/config_bridge.js` — 从 ConfigLoader 读取系数，未加载时回退硬编码值
  - `engine/computation_path.js` — 判断精确路径 vs 估算路径，生成 UI badge
  - `docs/issue4-engine-patch.md` — `engine.js` 5 处逐行补丁指南
- **关键补丁**：
  1. `matBase = quoteBase.materialPerSet * (mc.connector * connFactor + mc.copper * cuFactor + mc.aluminum * alFactor + mc.other)`
  2. `copperFactor = 1 + (Δ / base) * ms.copper`（从 0.65 改为配置读取）
  3. 状态默认值 → `ConfigBridge.stateDefaults()`
  4. 返回对象追加 `computationPath` 标记
  5. 删除重复定义的 `numberOr` / `approxEqual`

### ② 核算页详细线框图
- **核心问题**：这次报价的数字是多少？
- **用户角色**：成本工程师（内部报价工作台，非客户文档）
- **数据来源**：① 预演页冻结的参数 + BOM 精确数据

**页面结构** (见 Notion 原页面图示)
- **区域 A — 报价汇总卡片**: 5 列 KPI，与预演页保持一致布局。每个卡片下方显示 vs 上一版报价 的 delta（↑红/↓绿）。计算路径 badge：绿色 ✓精确 / 橙色 ≈估算。
- **区域 B — 变更 Diff**: 自动计算：比较当前 BOM 版本与上一版报价版的差异。按成本要素维度汇总变动金额。人工校核标记：每条 diff 行可标 ✓已校核 / ○待校核。
- **区域 C — 成本明细表**:
  - **材料 Tab**: 料号、名称、分类、用量、单价、金额、vs 上版（变更行高亮）。
  - **一次性费用 Tab**: 模具/检具/研发/样品/认证 — 金额 + 分摊方式 + 单套摊销。
- **区域 D — 底部操作栏**: [← 返回预演] [冻结为报价版本] [导出 Excel 报价包] [提交审批 →]

---

## [2026-04-02 20:30] Issue #1–#5 代码实施 + ③ 跟踪页 / ④ 归档页线框图

### Issue #1–#5 全部代码已推送
| PR | Issue | 分支 | 新增文件 | 状态 |
| :--- | :--- | :--- | :--- | :--- |
| [#16](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/pull/16) | #4 计算路径系数 | `fix/issue4-config-driven-coefficients` | `engine/config_bridge.js`, `engine/computation_path.js`, `docs/issue4-engine-patch.md` | 待审 |
| [#17](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/pull/17) | #5 unit=set 识别 | `fix/issue5-unit-set-alignkey` | `engine/align_key_enhancer.js`, `docs/issue5-align-key-patch.md` | 待审 |
| [#18](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/pull/18) | #3 瀑布图+Shapley | `fix/issue3-waterfall-shapley` | `charts/waterfall_causal.js`, `charts/waterfall_causal.css`, `docs/issue3-waterfall-patch.md` | 待审 |
| [#19](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/pull/19) | #2 残余材料池 | `fix/issue2-residual-pool-stagnant` | `engine/residual_pool_handler.js`, `docs/issue2-residual-pool-patch.md` | 待审 |
| [#20](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/pull/20) | #1 进度价 | `fix/issue1-progress-price-gap` | `engine/progress_price_tracker.js`, `docs/issue1-progress-price-patch.md` | 待审 |

### ③ 跟踪页线框图
- **核心问题**：报出去的价落实了多少？
- **用户角色**：采购工程师 + 成本工程师（协作录入 + 审核）
- **数据来源**：② 核算页的报价基准 + 采购手工录入的实际价格
- **Tab 切换**: [协议价追踪] [一次性费用执行] [呆滞物料] [年降执行]

### ④ 归档页线框图
- **核心问题**：历史上发生了什么？
- **用户角色**：成本工程师 + 项目经理（查阅 + 审批）
- **Excel 报价包导出内容**: 封面、材料明细、加工明细、一次性费用、生命周期损益、变更履历。

---

## 本地修改总清单

### 一、需要合并的 PR
1. **PR #16**: Issue #4 计算路径系数配置化 (P0)
2. **PR #17**: Issue #5 endGroup对端识别 + unit=set (P0)
3. **PR #18**: Issue #3 因果链瀑布图 + Shapley双视图 (P0)
4. **PR #19**: Issue #2 残余材料池呆滞提报 (P0)
5. **PR #20**: Issue #1 进度价协议价差距追踪 (P0)
6. **PR #7**: utils/ 工具函数拆分 (P1)
7. **PR #8**: Phase 1 编码+重复清理 (P1)

### 二、合并 PR 后需要手动修改的现有文件
1. `g281_engine.js`: `docs/issue4-engine-patch.md` (5 处), `docs/issue1-progress-price-patch.md` (1 处)
2. `g281_bom_alignment_engine.js`: `docs/issue5-align-key-patch.md` (4 处)
3. `g281_harness_profit.js`: `docs/issue2-residual-pool-patch.md` (3 处)
4. `g281_profit_dashboard.js`: `docs/issue3-waterfall-patch.md` (3 处)
5. `g281_profit_dashboard.html`: `docs/issue3-waterfall-patch.md` • issue5 (2 处)

---

## [2026-04-02 20:41] 全部 PR 合并完成
所有 7 个 PR 已 squash 合并到 main。当前 main 分支包含 13 个新增文件 + 5 个补丁指南文档。

---

## [2026-04-02 23:00] 第二轮会话 — #9 / #13 / #6 三大重构任务推进

### PR #21 — Issue #9 engine/compute_model.js 拆分
新增 4 个子模块:
- `engine/shared_utils.js`: G281SharedUtils
- `engine/state_normalizer.js`: G281StateNormalizer
- `engine/snapshot_resolver.js`: G281SnapshotResolver
- `engine/annual_calc.js`: G281AnnualCalc

### PR #22 — Issue #13 四页架构骨架
新增文件: `shared/nav.js`, `shared/nav.css`, `shared/page_router.js`, `pages/preview.html`, `pages/accounting.html`, `pages/tracking.html`, `pages/archive.html`

### PR #23 — Issue #6 UI Dashboard 拆分
新增文件: `docs/dashboard-split-architecture.md`, `ui/state/scenario_state.js`, `ui/renderers/kpi_grid.js`, `ui/renderers/annual_table.js`, `ui/renderers/charts.js`, `ui/renderers/compare_panel.js`, `ui/modals/modal_base.js`

---

## [2026-04-02 23:39] 第四轮会话 — 新模块集成到现有文件

### PR #28 — 新模块集成到现有文件（已合并）
- **Issue #10 去重**: 委托 G281Shared。
- **Issues #11/#12/#14 HTML 页面集成**: 4 个页面引入新模块。
- **Batch 2 — 大文件去重**: `profit_shapley.js`, `bom_db.js`。

### Issue #29 — compute_model.js root → global Bug
修复命令: `sed -i 's/root\.ConfigBridge/global.ConfigBridge/g; s/root\.ComputationPath/global.ComputationPath/g' engine/compute_model.js`

### 全部 PR 汇总（截至 Session 4）
- PR #15 到 PR #28，全部已合并。

---

## 引用的 Notion 资源
存档页：本页
对话线程：https://www.notion.so

## 话题关键词
G281 高压线束、动态利润模型、成本核算、BOM 对齐、Shapley 归因、因果链瀑布图、四页架构（预演/核算/跟踪/归档）、多项目可复用配置
