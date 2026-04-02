# Journal - lyvee (Part 1)

> AI development session journal
> Started: 2026-03-31

---

## Session 001 - 成本核算动态模型长会话接力记录

- Date: 2026-03-31
- Scope: 将本线程内关于高压线束通用成本核算平台的关键需求、实现进展、验证结果、后续接力点导入项目工作树，供后续 agent 继续开发

### 目标与产品方向

- 项目定位已经从 `G281/E281 单项目工具` 收敛为 `高压线束通用成本核算程序`
- 当前优先级是离线版，但后续希望可部署到飞书
- 核心体验方向固定为：
  - 用户日常以 Excel 方式维护 BOM 和成本要素
  - 程序负责版本管理、场景组合、利润重算、差异对比、导入导出
  - 录入界面必须尽量贴近原生 Excel，不能退回普通表单体验

### 用户已明确的长期要求

- 每次更新都要生成新的 `releases/vYYYY.MM.DD-HHmm/`
- 左侧为成本要素版本管理，右侧上部为场景管理和数据管理
- 数据管理需单独页面，页面切换风格参考 Edge 标签页
- BOM 工作台不放首页主视觉，采用按钮触发
- BOM、配置清单、铜铝基价、连接器价格、工时、资源投入、包装物流、年降、一次性费用、返点都要支持 Excel 式版本模板
- Excel 式模板需支持：
  - 公式
  - 合并单元格
  - 筛选
  - 条件格式
  - 增行
  - 增 Sheet
- BOM 管理与版本内数据必须实时同步
- 程序后续要支持导入新版本数据，不能只服务 E281/G281 单个项目

### 已确定的主要模块边界

- 首页只突出利润相关模块
- 数据管理页承载：
  - BOM 管理
  - 配置清单管理
  - 资源投入管理
  - 工时管理
  - 包装物流管理
  - 年降管理
  - 一次性费用管理
  - 返点管理
- 利润侧已要求支持：
  - 整套线利润汇总
  - 单根线束利润展示
  - 自定义毛利率反推售价
  - 场景对比
  - 变更管理
  - 变更可视化

### BOM 语义差异工作台方向

- BOM 管理已从简单对齐页升级为 5 视图工作台：
  - 原始 BOM
  - 标准化 BOM
  - 差异结果
  - 词典与规则
  - 人工复核
- 差异工作台当前采用 Notion 方法论推进：
  - 原始 BOM 层
  - 标准化 BOM 层
  - 词典/规则层
  - 差异结果层
  - 人工复核覆盖层
- 已落地的语义 diff 能力包括：
  - `DICT_NORMALIZE`
  - `DICT_SUPPLIER`
  - `DICT_SERIES`
  - `DICT_STOPWORDS`
  - `DICT_SUBSTITUTE`
  - `CONFIG_COLUMNS`
- 差异结果页已支持筛选与导出，导出包含：
  - `SUMMARY`
  - `DIFF_RESULT`
  - `CONNECTOR_DIFF`
  - `TERMINAL_DIFF`
  - `CABLE_DIFF`
  - `PROTECTION_DIFF`
  - `FASTENER_DIFF`
  - `OTHER_DIFF`
- 人工复核字段已本地持久化：
  - `Review_Result`
  - `Final_Judgement`
  - `Risk_Level`
  - `Owner`
  - `Due_Date`
  - `Comment`

### 本轮已完成且验证过的修复

- 修复了 `词典与规则` 页中“当前线束列映射”卡片不显示的问题
- 根因是 `g281_bom_validation_view.js` 的 `compareBomVersions` 语义 diff 分支提前返回，导致 `activeWorkbookMappingState` 没有传到页面
- 已在该分支中：
  - 解析当前活动 BOM 工作簿
  - 生成 `activeWorkbookMappingState`
  - 挂入语义 diff 的 view state
  - 删除不可达的重复 `return`
- 浏览器实测结果：
  - `词典与规则` 页面可显示“当前线束列映射”
  - 已显示 `表头行 4`
  - 已显示 `已按 CONFIG_COLUMNS 命中`
  - 当前映射样例为：
    - `Function = B`
    - `Child_PN = C`
    - `Child_Name = D`
    - `SAP = F`
    - `Spec = I`
    - `Qty = J`
    - `Unit = K`
    - `Supplier = L`
- 语法检查通过：
  - `node --check g281_bom_validation_view.js`
  - `node --check g281_profit_dashboard.js`
- 发布并验证过的版本：
  - 本轮直接验证过：`v2026.03.31-1814`
  - 当前 `releases/LATEST_RELEASE.json` 指向：`v2026.03.31-2057`

### 关键源码位置

- `g281_bom_validation_view.js`
  - `buildRuntimeBomValidationView()`
  - `parseSheetAccessor()`
  - `parseWorkbookHarnesses()`
  - `renderActiveColumnMappingCard()`
- `g281_profit_dashboard.html`
  - BOM 校验脚本资源版本号
- `g281_profit_dashboard.js`
  - 页面级标签、场景管理、数据管理联动

### 当前数据与交付状态

- 用户强调：版本管理内数据原则上由客户手工输入，但为了节省录入时间，可由 AI 先代填一版
- 用户提供过并要求接入/核对的关键 Excel 数据源包括：
  - `BOM核对\\E281项目 报价BOM V01-11.3.xlsx`
  - `BOM核对\\吉利E281 国内项目 定点BOM V05-2026.01.04.xlsx`
  - `BOM核对\\吉利E281报价核算.xlsx`
  - `BOM核对\\吉利E281定点核算.xlsx`
  - `高压线束包1-总报价模板(新)-20251117132314103 - 定点.xls`
- 用户还要求：
  - 导线价格与铜重、铝重、非铜、铜基、铝基联动
  - 年降按生命周期逐年设置，当前项目默认每年 3%
  - 一次性费用支持客户直付和按量分摊
  - 返点按生命周期逐年设置，当前例子包含 `2026 年返点 1000W`
  - 新增变更管理模块，输出变更一次性费用、变更后线束价格、保持基准毛利率所需售价

### 后续接力时的注意事项

- 该仓库当前工作区非常脏，继续开发前必须先精确定位目标文件，不要回滚无关改动
- `g281_bom_validation_view.js` 内存在历史编码乱码字符串，改附近逻辑时应先读取精确行文本再打补丁
- 文件里 `renderDictionaryWorkbenchView()` 目前仍有重复定义，后续可整理，但要小心不要误改当前生效版本
- 若以后继续沿 `LATEST_RELEASE.json` 验证，应优先验证最新 release，而不是只看源码页
- 如果继续做 BOM 语义 diff，建议优先检查：
  - `CONFIG_COLUMNS` 保存后不同线束/不同 BOM 来源是否都能正确命中
  - 最新 release 页是否仍能显示映射卡片且无 console error

### 当前建议的下一步

- 将“聊天记录导入工作树”后的会话接力基线固定为：
  - 先以 `releases/LATEST_RELEASE.json` 指向版本为准做页面验证
  - 再继续 BOM 语义差异、数据管理页和 Excel 模板链路开发
  - 如要继续发布，仍按“源码修改 -> 浏览器验证 -> 新 release 验证”执行

