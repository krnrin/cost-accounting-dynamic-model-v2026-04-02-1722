# PRD事实底稿-程序完成状态

## 主应用识别
- 当前应以 `D:/成本核算动态模型/app` 作为“程序完成状态”的主依据。
- 仓库根目录 `D:/成本核算动态模型/package.json` 仅包含 `build:univer-editor`，更像数据/脚本/Univer 相关运行时容器，不是主前端应用入口。
- `app/package.json` 具备完整前端应用脚本：`dev`、`build`、`preview`、`test`、`test:run`、`lint`。

## 页面与功能现状
### 认证与入口
- 存在独立登录页 `app/src/pages/LoginPage.tsx`。
- 支持邮箱密码登录。
- 支持注册申请流程。
- 支持飞书环境免登 / OAuth 登录入口。
- 登录页文案与默认账号已配置：`admin@harness.dev / admin123`。

### 路由与主应用结构
- `app/src/App.tsx` 中已存在完整路由骨架。
- 已接入页面包括：
  - ProjectListPage
  - WizardPage
  - DashboardPage
  - HarnessDetailPage
  - HarnessEditPage
  - BomWorkbookPage
  - QuotePage
  - SimulationPage
  - AnnualDropPage
  - SettingsPage
  - ManagerDashboardPage
  - NotFoundPage
- 已接入 `MainLayout`、`ErrorBoundary`、`SWUpdatePrompt`。

### 项目管理
- `ProjectListPage` 已支持：
  - 项目列表展示
  - 搜索（项目名/编号/客户）
  - 状态筛选（草稿、已报价、已定点、量产中、已归档）
  - 新建项目
  - 导入项目
  - 删除项目
- 已存在项目汇总指标的动态读取逻辑，如 harness 数量、报价结果、动态 vehicleCost 等。

### 系统设置
- `SettingsPage` 已支持多 Tab 配置：
  - 基础配置
  - 成本结构
  - 多工厂管理
  - 费用分摊
  - 系数近似
  - BOM分类规则
- 已暴露关键参数配置：
  - 人工费率、制造费率、废品率、管理费率、利润率
  - 默认年降率
  - 铜价、铝价
  - 预警阈值
  - 默认模板类型

## 已实现规则迹象
- 双主题/主题模式切换已实现基础能力。
- 金属基准价已进入系统设置，说明铜/铝联动已至少有参数入口。
- 预警阈值已进入系统设置，说明预警体系至少有配置入口。
- 多工厂、费用分摊、BOM 分类规则已进入系统设置，说明这些规则已开始产品化，而非仅停留在文档层。
- ProjectListPage 中已调用 `computeInternalProjectDynamic`，说明“内部实绩成本动态计算”已进入程序逻辑。

## 已验证内容
### 历史验证记录
- `app/VERIFICATION_REPORT.md` 记录的历史验证结果：
  - TypeScript Compilation：通过
  - Unit Tests：22 passed
  - Production Build：成功
- 该报告同时列出已存在的页面、引擎、组件、store、sync、types、layout 结构。

### 会话验证线索
- 历史 Claude resume 会话 `b821b0dc-4307-4c67-a28b-cd8ab928a987` 已确认：
  - 主应用应看 `app/`
  - `app` 目录曾成功执行 `npx vite build`
  - 构建虽出现 CSS `@import` 顺序警告与 chunk size warning，但最终构建成功
  - 后续 Playwright 验证未完成的原因是 dev server 未先启动，而不是页面已判定失败
- Accio 历史会话 `CID-89137727U1775400-49C1AD-3024-3041F7` 进一步给出若干“历史程序状态快照”：
  - 曾出现更完整的工程基线：`0 TS errors / 30 test files / 271 tests / vite build ✅`
  - 曾完成或验证过飞书相关链路：免登/OAuth、Bitable 读写、消息卡片/审批方向、dev server 启动与本地联调
  - 曾进行 E281 项目数据注入、线束数据落库、项目详情页/仪表盘联调
- Claude resume 会话 `1cd5d132-7ba7-43ec-a137-4234de450b90` 显示：
  - 曾基于 Playwright 对首页、Manager、Settings、E281 项目详情、BOM、Quote、Alloc、Change、Simulation、Tracking 等模块做过真实页面巡检
  - 当时的实现判断倾向于：Projects、Dashboard、ManagerDashboard、Settings、BOM Workbook、Quote、Alloc、Change、Simulation、Tracking 已具备可访问页面与基础流程
  - `AlertsPage.tsx`、`ProfilePage.tsx` 在该会话中出现明确创建与占位续写痕迹（如 `PLACEHOLDER_ALERTS_CONTINUE`、`PLACEHOLDER_PROFILE_CONTINUE`），说明其在历史上属于已推进但未必稳定收口的模块
- Claude resume 会话 `2e4bb45c-49f8-420b-8d0d-1a20dd0ba8c3` 显示：
  - 曾专门为 `app/` 编写 `e2e/modules.spec.ts`、`e2e/discover.spec.ts` 之类 Playwright 模块验证脚本
  - 巡检与测试设计涉及 `AllocManagerPage`、`AnnualDropPage`、`BomWorkbookPage`、`ChangeEnginePage`、`DashboardPage`、`HarnessDetailPage` 等页面文件
  - 当时测试还使用过 G281/E281 参考数据或 seed，说明页面级验证是围绕真实业务样例进行，而非纯静态空壳页面
- 上述内容说明：历史版本线索曾更完整，但这些仍属于“历史会话快照证据”，不能直接替代当前 `app/` 代码现实。

## 已确定但未完全实现
- 文档中的“一个项目多场景模型（初始报价→定点→设变→年降）”已进入 v2.1 PRD 主线，但当前是否形成完整场景页面与状态流，仍需继续核对。
- 预警系统已进入产品范围，当前程序至少已有阈值配置入口，但完整的预警分级、触发、展示链路仍需继续核对。
- 个人中心在 v2.1 PRD 中被明确纳入，但当前 worktree 的 `app/src/pages` 中未见独立 Profile/Personal Center 页面，说明该部分要么尚未落地，要么存在于别的分支/版本线。
- 工业蓝图风改造在另一条会话与记忆中已有明确进展，但当前 worktree 的 `app/src/index.css` 仍带有较强的 glassmorphism / green-future 风格，说明 UI 状态存在版本差异，不能直接按单一页面快照下结论。
- 历史开发指南里已经形成较完整的旧架构产品蓝图，包括四页架构（预演/核算/跟踪/归档）、项目切换与独立数据域、缓存与错误边界、瀑布图/Shapley 双视图、进度价差距追踪、呆滞物料处理等；但这些多数是设计/补丁/迁移指南证据，不能直接等同于当前 `app/` 已完整实现。

## 未见实现或仍不明确
- 场景继承机制
- 报价引擎权限边界
- 预警系统分级标准
- 个人中心职责边界与实际落地深度
- 客户模板覆盖范围与优先级
- AlertsPage / ProfilePage 是否存在于其他分支、其他目录或仅存在于另一条项目线

## 当前结论
- 新 PRD 中“程序完成状态”应明确区分：
  - **主程序现实**：以 `app/` 当前代码为准
  - **历史会话与记忆中的已做工作**：作为补充证据
  - **未在当前主应用代码中确认到的内容**：降级为“已确定未完全实现”或“待确认”，不能直接写成“已实现”
