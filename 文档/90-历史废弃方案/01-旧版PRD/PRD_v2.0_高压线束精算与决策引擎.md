# [已废弃方案] 产品需求文档 (PRD) v2.1：高压线束精算与决策引擎

| 项目名称 | 高压线束精算与决策引擎 (HV-Harness Cost Accounting & Decision Engine) |
| :--- | :--- |
| **版本** | v2.1 |
| **日期** | 2026-04-08 |
| **状态** | 草稿 (Draft) |
| **产品经理** | 钱佳玲 |
| **变更说明** | 新增场景管理架构（一个项目多场景）、UI 工业蓝图风改造、预警系统、个人中心。 |

---

## 修订历史

| 版本 | 日期 | 变更内容 |
|------|------|---------|
| v1.0 | 2026-04-03 | 初版 PRD（`__LANDING_PLAN.md`）：离线单机 + 飞书协作双模方案 |
| v1.3 | 2026-04-06 | Banknote UI 方向、异常熔断、Logic Drill-down |
| **v2.0** | **2026-04-07** | **全面重构**：定位从"报价工具"转为"实绩成本管理平台"；新增一次性费用按根分摊算法、分摊回收跟踪、内部/客户双线核算引擎；基于 Excel 逐 cell 公式链验证的完整计算规格 |
| **v2.1** | **2026-04-08** | **场景管理架构**：一个项目多场景模型（初始报价→定点→设变→年降），每场景独立持有生命周期/产量/费率/BOM/分摊状态；单线束 EOP 管理；UI 工业蓝图风改造；预警系统；个人中心 |

---

## 目录

1. [产品定位与核心目标](#1-产品定位与核心目标)
2. [行业背景与问题定义](#2-行业背景与问题定义)
3. [用户角色与职责矩阵](#3-用户角色与职责矩阵)
4. [信息输入输出矩阵](#4-信息输入输出矩阵)
5. [核心功能模块](#5-核心功能模块)
6. [计算引擎规格](#6-计算引擎规格)
7. [一次性费用分摊模块（关键）](#7-一次性费用分摊模块关键)
8. [场景管理架构（v2.1 新增）](#8-场景管理架构v21-新增)
9. [数据模型](#9-数据模型)
10. [UI/UX 设计方案](#10-uiux-设计方案)
11. [技术架构](#11-技术架构)
12. [客户报价模板适配](#12-客户报价模板适配)
13. [实施路径与里程碑](#13-实施路径与里程碑)
14. [优先级（MoSCoW）](#14-优先级moscow)
15. [附录](#15-附录)

---

## 1. 产品定位与核心目标

### 1.1 产品定位

**一句话定位**：面向汽车高压线束 Tier1 供应商的「工厂实绩成本内部管理 + 客户报价决策」双引擎平台。

**核心转变**（v1.x → v2.0）：

| 维度 | v1.x（报价工具） | v2.0（精算与决策引擎） |
|------|-----------------|----------------------|
| 核心关注 | 客户报价单生成 | 工厂内部实绩成本穿透 + 客户报价 |
| 费率来源 | 统一的客户报价费率 | 双线：内部运营工时费基准 + 客户模板费率 |
| 分摊算法 | 项目级笼统分摊 | **按根/线束号独立分摊**（与客户确认版一致） |
| 关注输出 | 中间费率拆分 | **出厂价、到厂价、分摊费用**（中间费率属于销售策略） |
| 跟踪能力 | 无 | 分摊回收进度跟踪 + 销售调价提醒 |

### 1.2 核心目标

1. **实绩穿透**：基于财务发布的"运营工时费报价基准"（7工厂 × 6维制造费），穿透工厂 0.1% 级损耗偏差
2. **精确分摊**：一次性费用（工装/试验/研发）按线束号独立、按根分摊，与客户确认版完全一致
3. **回收跟踪**：跟踪每条线束的分摊回收进度（基于装车比 × 累计产量），分摊完毕自动提醒销售调价
4. **双线核算**：同一条线束同时展示内部实绩成本和客户报价，一眼看到利润空间
5. **离线优先**：PWA 架构，IndexedDB 本地存储，无网络环境完整可用

### 1.3 与行业工具的差异

| 维度 | Excel 手工 | ERP 成本模块 | 本产品 |
|:---|:---|:---|:---|
| 核算颗粒度 | 单线束号（手工维护） | 通常到总成级 | 单线束号（自动化） |
| 分摊方式 | 按套笼统（财务习惯） | 不支持或需定制 | **按根/线束号独立分摊** |
| 分摊跟踪 | 无 | 无 | ✅ 累计产量 → 调价提醒 |
| 内部/客户双视角 | 两张表手工对比 | 通常只有一套 | 同屏双线对比 |
| 变更响应 | 半天~1天 | 跨模块操作 | 实时联动 |
| 离线能力 | ✅ (Excel) | ❌ | ✅ (PWA) |

---

## 2. 行业背景与问题定义

### 2.1 高压线束成本核算特点

| 特征 | 对核算工具的要求 |
|:---|:---|
| **铜/铝用量大** — 单根高压线缆截面积可达 70mm²，铜重占材料成本 40-60% | 金属价格联动，铜价每波动 1000 元/吨，单车成本变化 2-5 元 |
| **连接器价值高** — 高压连接器单价 30-200 元/个，占材料成本 20-35% | 必须逐件核算，不能用系数近似 |
| **BOM 层级深** — 一条线束 10-50 种散件 | BOM 逐行解析，支持导线/连接器/端子/辅料分类 |
| **装车比差异大** — 同一总成族 3-5 个衍生型号，装车比 3%~60% | 加权汇总 + 分摊回收进度差异 |
| **一次性费用分摊复杂** — 工装/试验/研发各有不同分摊基数和参与范围 | 按线束号独立分摊，不能笼统打包 |
| **客户模板各异** — 吉利/比亚迪/蔚来各有不同的成本分解格式 | 报价输出适配多客户模板 |
| **设变频繁** — 6年生命周期，20-50次设变 | 变更报价引擎是核心功能 |

### 2.2 当前痛点（从 Excel 核算表分析得出）

1. **分摊算法不一致**：财务核算表按"套"笼统分摊 ¥8.36/套，客户确认的吉利模板按"根"独立分摊（¥0~¥6.46/件不等），两者有结构性差异
2. **无法跟踪分摊回收**：装车比 0.525 的线束不到1年分摊完5万根，但装车比 0.03 的线束需16.7年，远超项目周期。没有工具跟踪哪条线束该降价了
3. **内部/客户两套表**：内部实绩成本和客户报价分散在不同 Excel，无法同屏对比
4. **费率调整无法溯源**：销售调整中间费率（废品率/管理费率/利润率）后，无法追踪变更历史
5. **金属价格联动全手工**：铜铝价格硬编码在 BOM 公式中，价格变动需逐个修改

---

## 3. 用户角色与职责矩阵

### 3.1 角色定义

| 角色 | 代表人物 | 核心职责 |
|:---|:---|:---|
| **助理/协调** | 刘婧 | 需求对齐、进度跟踪、逻辑纠偏 |
| **产品经理** | 钱佳玲 | PRD 管理、需求优先级、路线图 |
| **财务专家** | 王强 | 费率基准发布、成本利润模型、审核 |
| **客户经理/销售** | 翁骏 | 客户报价编制、价格谈判、模板填写 |
| **工艺专家** | 张滔滔 | 工时数据、审批流程、合规审计 |
| **开发** | 肖锐娟 | 算法实现、UI/UX、测试 |

### 3.2 跨部门协作矩阵

| 流程环节 | 线束开发 | 采购 | 工艺/IE | 财务 | 销售 | 管理层 |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|
| BOM 录入/维护 | ●主责 | | | | | |
| 材料询价/协议价 | | ●主责 | | | | |
| 工时测算/填写 | | | ●主责 | ○ | | |
| 制造费率核定 | | | ○ | ●主责 | | |
| 包装方案/费用 | | | ○ | | | |
| 包装物流短驳仓储费 | | | | | | |
| 成本核算/审核 | ○ | | | ●主责 | | |
| 一次性费用填写 | | | | | ●主责 | |
| 客户报价编制 | | | | ○ | ●主责 | |
| 价格审批 | | | | ○ | ○ | ●主责 |
| 分摊回收跟踪 | | | | ●主责 | ○ | |

> **说明**：
> - 包装方案由工艺工程师根据 BOM 提供给包装物流工程师
> - 包装物流短驳三方仓等费用由包装物流工程师提供
> - 一次性费用（工装/试验分摊）由销售填入客户模板的黄色单元格

---

## 4. 信息输入输出矩阵

### 4.1 核算数据来源

| 数据类型 | 来源部门 | 来源形式 | 录入方式 | 示例 |
|:---|:---|:---|:---|:---|
| **BOM 明细** | 线束开发 | Excel（如 E281报价BOM V01-11.3） | Excel 上传 → SheetJS 解析 | 280行 × 35列 |
| **BOM 单价** | 采购 | 采购系统 / 手工录入 | 系统对接或手工 | 定点版通过 VLOOKUP 外部成本分析 |
| **工时数据** | 工艺/IE | 工序工时表 | 手工录入（合计工时） | 精确到 0.374H |
| **制造费率** | 财务 | 运营工时费报价基准 JSON | 财务发布 → 系统导入 | 7工厂 × 6维 |
| **包装方案** | 包装物流工程师 | 包装方案 Excel | Excel 上传 | 内包装 + 外包装 |
| **运输费用** | 包装物流工程师 | 费用明细 | 手工录入 | 短驳 + 三方仓 + 仓储 |
| **一次性费用** | 销售 | 客户模板黄色单元格 | 手工录入 | 工装/试验/研发各线束独立 |
| **装车比** | 线束开发/客户 | 配置明细表 | Excel 上传或手工 | 3%~60% |
| **金属价格** | 财务/市场 | 实时行情 | 手工或 API | 铜 76,450 元/吨 |

### 4.2 核算输出

| 输出类型 | 消费方 | 格式 | 关键数据点 |
|:---|:---|:---|:---|
| **单线束成本明细** | 财务/销售 | 屏幕 + Excel | 材料/人工/制造/管理/利润/出厂价/到厂价 |
| **一次性费用分摊明细** | 销售/财务 | 屏幕 + Excel | 每条线束的工装/试验/研发摊入件价 |
| **单车成本（含/不含分摊）** | 管理层 | 看板 KPI | ¥526.63 (含分摊) / ¥479.25 (不含分摊) |
| **内部实绩成本** | 财务/管理层 | 屏幕 + Excel | 内部费率下的真实成本 |
| **客户报价单** | 销售 → 客户 | 客户模板 Excel | 适配吉利/比亚迪等模板 |
| **分摊回收进度** | 销售/财务 | 跟踪看板 | 各线束累计产量 vs 分摊基数 |
| **利润穿透分析** | 管理层 | 看板图表 | 客户报价 vs 内部实绩 差异分析 |

---

## 5. 核心功能模块

### 5.1 模块总览

```
┌─────────────────────────────────────────────────────────────────┐
│                     高压线束精算与决策引擎                         │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ M1       │  │ M2       │  │ M3       │  │ M4       │       │
│  │ 项目管理  │  │ BOM核算  │  │ 报价引擎  │  │ 分摊管理  │       │
│  │          │  │          │  │          │  │ (新增)    │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ M5       │  │ M6       │  │ M7       │  │ M8       │       │
│  │ 决策舱   │  │ 内部实绩  │  │ 变更引擎  │  │ 导出适配  │       │
│  │          │  │ (新增)    │  │          │  │          │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 M1: 项目管理

- 项目创建向导（项目名称、客户、工厂、生命周期产量、年产能）
- 多项目切换（IndexedDB 持久化）
- 项目元数据（OEM、车型、SOP日期、金属基价）
- 费率配置入口（链接到财务基准管理）

### 5.3 M2: BOM 核算工作台

**输入**：
- Excel 上传（SheetJS 解析 .xlsx/.xls）
- Univer 表格手工编辑
- 支持两套价格体系：报价版（VLOOKUP 二次物料明细）+ 定点版（VLOOKUP 外部成本分析）

**核算逻辑**（已验证，与 Excel 公式链精确匹配）：
```
每行材料成本:
  if 非导线物料:
    lineCost = unitPrice × quantity
  if 导线物料:
    metalCost = Al(g)/1000 × alPrice + Cu(g)/1000 × cuPrice
    nonMetalCost = unitPrice - metalCost  (unitPrice优先策略)
    lineCost = unitPrice × quantity

线束总材料成本 = Σ(BOM行 lineCost)
```

**关键规则**：
- **unitPrice 优先**：当 `unitPrice > 0` 时，以 `unitPrice × qty` 作为权威 `lineCost`，金属重量仅用于敏感度分析
- BOM 分 11 条线束，每条 10-50 行散件
- 支持分类统计（导线/连接器/端子/辅料/其他）

### 5.4 M3: 报价引擎（客户报价逻辑）

**客户报价公式链**（已验证 ¥526.63/车）：

```
wasteCost     = materialCost × wasteRate        // 默认 1%
directLabor   = processHours × laborRate        // 默认 35 元/H
manufacturing = processHours × mfgRate          // 默认 46.69 元/H
mgmtFee       = (materialCost + directLabor + manufacturing) × mgmtRate  // 默认 6%，基数不含废品
profit        = (materialCost + wasteCost + directLabor + manufacturing + mgmtFee) × profitRate  // 默认 5.6627%
exFactoryPrice = materialCost + wasteCost + directLabor + manufacturing + mgmtFee + profit
deliveredPrice = exFactoryPrice + packSubtotal + freightSubtotal
vehicleCost    = Σ(deliveredPrice × vehicleRatio)
```

**重要说明**：
- 中间费率（废品率/管理费率/利润率等）**属于销售策略范畴**，销售可根据谈判策略自行调整
- 程序真正关注的输出是 **出厂价、到厂价、分摊费用**
- 费率拆分只是报价呈现格式，不代表真实内部成本结构

### 5.5 M4: 一次性费用分摊管理（关键新增模块）

详见 [第7章](#7-一次性费用分摊模块关键)。

### 5.6 M5: 决策舱（Dashboard）

**KPI 卡片**：
- 单车成本（含分摊 / 不含分摊）
- 客户目标价 vs 我方报价差距
- 内部实绩毛利率
- 分摊回收完成度

**图表**：
- 成本桥（单线束成本瀑布图）
- 11条线束利润对比（柱状图）
- 分摊回收进度（甘特图/进度条）
- 金属价格敏感度（曲线图）

### 5.7 M6: 内部实绩核算（新增模块）

**与客户报价的区别**：

| 维度 | 客户报价（M3） | 内部实绩（M6） |
|------|--------------|--------------|
| 人工费率 | 35 元/H（对外报价） | 29.19 元/H（实际） |
| 制造费率 | 46.69 元/H（对外） | 19.74 元/H（6维实际） |
| 材料损耗 | 1%（客户模板要求） | 0.5%（内部基线） |
| 管理费 | 6%（含利润） | 按实际管理费率 |
| 利润 | 5.6627% | 不含（内部成本视角） |

**内部实绩核算公式**：
```
internalMaterialCost = materialCost × (1 + 0.5%)  // 内部 0.5% 损耗
internalLabor = processHours × internalLaborRate   // 29.19
internalMfg = processHours × internalMfgRate       // 19.74 (6维制造费合计)
internalCost = internalMaterialCost + internalLabor + internalMfg
```

**内部费率来源**：`Internal_Actual_Rate_Master.json`，财务专家管理和发布，支持 7 个工厂各自独立的费率体系。

### 5.8 M7: 变更报价引擎

- 设变影响评估（BOM 行级 diff）
- 金属联动计算（铜/铝价格变动 → 自动重算）
- 年降管理
- 变更前后对比（快照 diff）

### 5.9 M8: 报价导出与客户模板适配

- 吉利模板（A1/A2/B1/B2/C/D/E/F/G 结构）
- 比亚迪模板（待定）
- 蔚来模板（待定）
- SheetJS 生成 .xlsx 文件
- 模板规则：黄色单元格 = 我方填写，绿色单元格 = 客户公式不可改

---

## 6. 计算引擎规格

### 6.1 引擎架构

```
┌──────────────────────────────────────────────────────────┐
│                    计算引擎 (Engine.ts)                    │
│                                                          │
│  输入层                                                   │
│  ├─ HarnessInput (BOM + 工时 + 包装)                      │
│  ├─ RateConfig (费率参数)                                  │
│  ├─ MetalPrices (铜/铝实时价格)                            │
│  └─ OnetimeCostInput (一次性费用)                          │
│                                                          │
│  计算层                                                   │
│  ├─ computeBomLineCost()     — BOM 行级材料成本             │
│  ├─ computeHarnessCost()     — 单线束客户报价               │
│  ├─ computeInternalCost()    — 单线束内部实绩               │
│  ├─ computeOnetimeAlloc()    — 一次性费用分摊 (NEW)         │
│  └─ computeProjectSummary()  — 项目级汇总                  │
│                                                          │
│  输出层                                                   │
│  ├─ HarnessResult (单线束完整成本明细)                      │
│  ├─ InternalHarnessResult (内部实绩)                       │
│  ├─ AllocResult (分摊明细)                                 │
│  └─ ProjectResult (项目汇总 + 单车成本)                    │
└──────────────────────────────────────────────────────────┘
```

### 6.2 函数签名

```typescript
// BOM 行级
computeBomLineCost(line: BomLine, metalPrices: MetalPrices): BomLineCost

// 客户报价 — 单线束
computeHarnessCost(input: HarnessInput, rates: RateConfig, metalPrices: MetalPrices): HarnessResult

// 内部实绩 — 单线束
computeInternalHarnessCost(input: HarnessInput, internalRates: InternalRateConfig, metalPrices: MetalPrices): InternalHarnessResult

// 一次性费用分摊 — 单线束 (NEW)
computeOnetimeAlloc(input: OnetimeCostInput): AllocResult

// 项目级汇总 — 只接收一个参数
computeProjectFromHarnesses(results: HarnessResult[]): ProjectResult
computeInternalProjectFromHarnesses(results: InternalHarnessResult[]): InternalProjectResult
```

### 6.3 精度要求

- 金额精度：小数点后 2 位（四舍五入）
- 费率精度：小数点后 4 位
- 工时精度：小数点后 15 位（工艺部门原始精度）
- 装车比精度：小数点后 3 位
- 验证基准：客户报价单车成本 = ¥526.63（E281 参考数据），偏差 < 0.01%

### 6.4 unitPrice 优先策略

**背景**：BOM 行中，导线物料同时有 `unitPrice`（含金属+非金属的综合单价）和 `copperWeight/alWeight`（金属重量）。

**规则**：
1. 当 `unitPrice > 0` 时，以 `unitPrice × qty` 作为权威 `lineCost`
2. 金属成本 `metalCost = cuWeight/1000 × cuPrice + alWeight/1000 × alPrice` 仅用于敏感度分析
3. 非金属成本 `nonMetalCost = unitPrice - metalCost/qty`（反推）
4. 当 `unitPrice = 0` 时，fallback 到纯金属重量计算

---

## 7. 一次性费用分摊模块（关键）

> **这是 v2.0 最重要的新增模块**。程序必须按客户确认的吉利模板算法（按根/线束号独立分摊）实现，不使用财务核算表的"按套笼统分摊"。

### 7.1 两套算法的差异（程序选择吉利模板算法）

| 维度 | 吉利模板（程序采用✅） | 财务核算表（不采用❌） |
|------|----------------------|----------------------|
| **分摊单位** | 根（每条线束号独立） | 套（全项目打包） |
| **分摊基数** | 50,000 根/线束号 | 50,000 套/项目 |
| **参与分摊** | 仅有一次性费用的线束参与 | 全部线束统一分摊 |
| **分摊单价** | 各不相同（¥0 ~ ¥6.46） | 统一 ¥8.36/套 |
| **研发费** | 不体现（= 0） | ¥131.32万参与计算 |
| **精确度** | 线束号级 | 项目级粗算 |

### 7.2 分摊计算公式

```typescript
// 每条线束独立计算
toolingPerUnit = toolingTotal / allocBase    // 例：88,000 / 50,000 = 1.76
testingPerUnit = testingTotal / allocBase    // 例：222,000 / 50,000 = 4.44
rdPerUnit      = rdTotal / allocBase         // 通常 = 0（不向客户回收）
totalAllocPerUnit = toolingPerUnit + testingPerUnit + rdPerUnit

// 含分摊的到厂价
deliveredPriceWithAlloc = deliveredPrice + totalAllocPerUnit

// 单车成本
vehicleCostWithAlloc    = Σ(deliveredPriceWithAlloc × vehicleRatio)
vehicleCostWithoutAlloc = Σ(deliveredPrice × vehicleRatio)
```

### 7.3 分摊数据录入

| 字段 | 类型 | 说明 | 来源 |
|------|------|------|------|
| harnessId | string | 线束号 | 自动关联 |
| toolingTotal | number | 总工装费（¥） | 销售填入客户模板 |
| testingTotal | number | 总试验费（¥） | 销售填入客户模板 |
| rdTotal | number | 总研发费（¥） | 通常 = 0 |
| allocBase | number | 分摊基数（根） | 默认 50,000，可配置 |
| paymentMode | enum | 摊入件价 / 单独支付 / 混合 | 销售选择 |

### 7.4 分摊回收跟踪

**核心需求**：因为装车比不同，各线束的年产量差异巨大，达到分摊基数的时间完全不同。

```
年产量 = 装车比 × 年产能
达到分摊基数所需年数 = 分摊基数 ÷ 年产量
```

**E281 示例**（年产能 10万台）：

| 线束ID | 装车比 | 年产量(根) | 分摊回收年数 | 是否超5年周期 |
|--------|-------|----------|------------|-------------|
| 6608442962 | 0.525 | 52,500 | 0.95 | ✅ 1年内 |
| 6608442963 | 0.525 | 52,500 | 0.95 | ✅ 1年内 |
| 6608442964 | 0.595 | 59,500 | 0.84 | ✅ 1年内 |
| 6608442966 | 0.525 | 52,500 | 0.95 | ✅ 1年内 |
| 6608491523 | 0.525 | 52,500 | 0.95 | ✅ 1年内 |
| 6608491524 | 0.525 | 52,500 | 0.95 | ✅ 1年内 |
| 6608544875 | 0.07 | 7,000 | 7.14 | ❌ 超出 |

**跟踪功能**：
1. 显示每条线束的分摊回收进度条（累计产量 / 分摊基数）
2. 当某线束累计产量 ≥ 分摊基数时，自动标记"已回收完毕"
3. 生成**调价提醒**：该线束的到厂价应降低 `totalAllocPerUnit` 元
4. 仪表盘显示项目整体分摊回收完成度

### 7.5 分摊数据模型

```typescript
interface OnetimeCostAllocation {
  harnessId: string;
  toolingTotal: number;
  testingTotal: number;
  rdTotal: number;
  allocBase: number;             // 分摊基数（根），默认 50000
  toolingPerUnit: number;        // = toolingTotal / allocBase
  testingPerUnit: number;
  rdPerUnit: number;
  totalPerUnit: number;          // 合计分摊单价
  participates: boolean;         // 是否参与分摊
  paymentMode: 'amortized' | 'lumpsum' | 'mixed';
}

interface AllocRecoveryTracker {
  harnessId: string;
  allocBase: number;
  vehicleRatio: number;
  annualCapacity: number;        // 项目年产能（台）
  annualVolume: number;          // 年产量 = vehicleRatio × annualCapacity
  yearsToRecover: number;        // allocBase / annualVolume
  cumProduced: number;           // 累计已生产（手工或系统更新）
  isRecovered: boolean;
  recoveredDate?: string;
  priceAdjustmentAmount: number; // 回收完后应降价金额 = totalPerUnit
  status: 'recovering' | 'recovered' | 'overdue'; // overdue = 超项目周期未回收完
}
```

---

## 8. 场景管理架构（v2.1 新增）

### 8.1 痛点

在实际业务中，一个项目从初始报价到量产，会经历多次成本因素变动：

| 阶段 | 典型变动 | 影响范围 |
|:---|:---|:---|
| 初始报价 → 最终报价 | 多轮谈判调整费率/利润 | 费率配置 |
| 报价 → 客户定点 | 客户确认产量/生命周期 | 产量计划、生命周期 |
| 定点后设变 (ECN) | BOM 变更、新增/删除线束 | BOM、材料成本 |
| 金属联动 | 铜/铝价格波动 | 金属价格 |
| 年降 | 客户要求年度降价 | 费率/利润 |
| 产量变更 | 客户调整年度产量 | 产量计划、分摊回收进度 |
| 提前 EOP | 某线束提前停产 | 单线束生命周期、分摊回收 |

v2.0 的做法是复制整个项目来应对变动，导致项目列表出现大量重复项目，无法追溯变更链路，也无法对比不同阶段的成本差异。

### 8.2 方案：一个项目，多个场景

每个项目下可创建多个「场景」(Scenario)，每个场景独立持有完整的核算上下文：

```
Project (E281 高压线束)
  └── Scenario[] (场景列表)
        ├── "最后一轮报价" (基准场景, final_quote)
        │     ├── lifecycleYears: 6
        │     ├── config: { costRates, metalPrices, volumes }
        │     ├── HarnessRecord[] (11条线束 + BOM)
        │     ├── OnetimeCostRecord[] (一次性费用)
        │     └── AllocTrackerRecord[] (分摊回收进度)
        │
        ├── "客户定点" (customer_award, 从基准派生)
        │     ├── lifecycleYears: 7 (客户延长)
        │     ├── volumes: 调整后的产量计划
        │     ├── H003.eopYear = 3 (某线束提前EOP)
        │     └── AllocTracker: 继承或重置回收进度
        │
        └── "ECN-001 设变后" (ecn, 从定点派生)
              ├── BOM 变更后的线束数据
              └── ...
```

### 8.3 场景类型

| 类型代码 | 中文名 | 典型触发 |
|:---|:---|:---|
| `initial_quote` | 初始报价 | 项目启动 |
| `final_quote` | 最终报价 | 多轮谈判后的最终版本 |
| `customer_award` | 客户定点 | 客户确认中标 |
| `ecn` | 设变 | 工程变更通知 |
| `metal_escalation` | 金属联动 | 铜/铝价格波动触发调价 |
| `annual_drop` | 年降 | 客户要求年度降价 |
| `volume_change` | 销量变更 | 客户调整年度产量 |
| `eop_change` | EOP 变更 | 线束/项目提前或延后停产 |
| `custom` | 自定义 | 其他场景 |

### 8.4 场景独立持有的数据

每个场景是一个完整的核算快照，场景之间数据完全隔离：

| 数据 | 说明 | 场景间差异示例 |
|:---|:---|:---|
| `lifecycleYears` | 项目生命周期 | 基准 6 年 → 定点后 7 年 |
| `config.costRates` | 费率配置 | 年降后利润率下调 |
| `config.metalPrices` | 金属价格 | 铜价从 76,450 涨到 82,000 |
| `config.volumes` | 年度产量计划 | 客户调量 |
| `HarnessRecord[]` | 线束 + BOM | 设变后 BOM 变更 |
| `OnetimeCostRecord[]` | 一次性费用 | 设变新增工装费 |
| `AllocTrackerRecord[]` | 分摊回收进度 | 可选继承或重置 |

### 8.5 单线束 EOP 管理

同一场景内，不同线束可能有不同的停产时间。`HarnessRecord` 新增 `eopYear` 字段：

- `eopYear = null`：跟随场景 `lifecycleYears`
- `eopYear = 3`：该线束在第 3 年后停产，Year 4+ 产量归零

引擎通过 `clampVolumesToEop(volumes, eopYear)` 在计算前裁剪产量计划，不改变引擎函数签名。

### 8.6 场景派生 (Fork)

新建场景时从父场景深拷贝所有数据，然后在副本上修改：

1. 深拷贝父场景的 `config`（费率、金属价、产量）
2. 深拷贝所有 `HarnessRecord`（新 scenarioId）
3. 深拷贝 `OnetimeCostRecord`
4. `AllocTrackerRecord`：用户可选择继承回收进度或归零重置
5. 应用 `overrides`（如修改 lifecycleYears、调整 metalPrices）

### 8.7 场景对比

支持并排对比 2~4 个场景的 KPI：

- 生命周期、总销量、铜价、铝价
- 单车材料成本、单车到厂价
- 线束数量
- Delta 列（vs 基准场景），红涨绿降

### 8.8 路由结构

```
/project/:id              → 场景列表页（项目入口）
/project/:id/s/:sid       → 场景仪表盘
/project/:id/s/:sid/quote → 报价页
/project/:id/s/:sid/...   → 其他场景级页面
/project/:id/compare?ids= → 场景对比页
```

所有场景级页面顶部有 ScenarioSelector 下拉，支持快速切换场景。

---

## 9. 数据模型

### 9.1 实体关系概览（v2.1 更新）

> v2.1 变更：Project 瘦身为身份信息容器，`config` 和 `lifecycleYears` 下沉到 Scenario。新增 `scenarios` 表，`harnesses`/`onetimeCosts`/`allocTrackers` 均增加 `scenarioId` 外键。

```
┌────────────────────────────────────────────────────────────┐
│                    数据模型 (v2.1)                           │
│                                                            │
│  projects ──────── 项目 (身份信息容器)                       │
│  │  project_id, project_name, customer, platform           │
│  │  status, created_at, updated_at                         │
│  │                                                         │
│  ├── scenarios ──── 场景 (核算上下文, v2.1 新增)             │
│  │   │  scenario_id, project_id, scenario_code(SCN-001)    │
│  │   │  scenario_name, scenario_type, parent_scenario_id   │
│  │   │  is_baseline, lifecycle_years                       │
│  │   │  config: { costRates, metalPrices, volumes }        │
│  │   │  note, created_at, updated_at                       │
│  │   │                                                     │
│  │   ├── harnesses ────── 线束号 (belongs_to scenario)      │
│  │   │   │  harness_id(零件号), scenario_id, eop_year      │
│  │   │   │  harness_name, vehicle_ratio                    │
│  │   │   │                                                 │
│  │   │   ├── bom_items ── BOM明细                           │
│  │   │   │   part_number, part_name, category              │
│  │   │   │   unit, quantity, unit_price                    │
│  │   │   │   cu_weight_g, al_weight_g                      │
│  │   │   │                                                 │
│  │   │   ├── process_hours ── 工时                          │
│  │   │   ├── packaging ── 包装                              │
│  │   │   └── cost_snapshots ── 核算快照                     │
│  │   │                                                     │
│  │   ├── onetime_costs ── 一次性费用 (belongs_to scenario)  │
│  │   │   tooling_total, testing_total, rd_total            │
│  │   │   alloc_base(根), payment_mode                      │
│  │   │                                                     │
│  │   └── alloc_trackers ── 分摊回收跟踪 (belongs_to scenario)│
│  │       cum_produced, inherited_from_scenario_id          │
│  │                                                         │
│  ├── quote_versions ── 报价版本 (加 scenario_id)            │
│  └── tracking_items ── 跟踪项 (项目级, 跨场景共享)          │
│                                                            │
│  ── 系统级（跨项目） ──                                      │
│  rate_benchmarks ──── 运营工时费报价基准                     │
│  customer_templates ── 客户模板配置                          │
│  wire_catalog ─────── 导线目录                              │
│  audit_log ────────── 操作审计日志                           │
└────────────────────────────────────────────────────────────┘
```

### 9.2 核心 TypeScript 接口（v2.1 更新）

```typescript
// 项目 — v2.1 瘦身为身份信息
interface Project {
  id: string;
  meta: ProjectMeta;
  config?: ProjectConfig;  // @deprecated — 已下沉到 Scenario
}

interface ProjectMeta {
  projectCode: string;
  projectName: string;
  customer: string;
  platform?: string;
  // lifecycleYears — 已下沉到 Scenario
  createdAt: string;
  updatedAt: string;
  status: 'draft' | 'quoted' | 'awarded' | 'production' | 'eol';
}

// 场景 — v2.1 新增，核算上下文的载体
interface ScenarioRecord {
  id: string;
  projectId: string;
  scenarioCode: string;       // SCN-001, SCN-002, ...
  scenarioName: string;       // 用户可编辑
  scenarioType: ScenarioType; // initial_quote | final_quote | customer_award | ecn | ...
  parentScenarioId: string | null;
  isBaseline: boolean;
  lifecycleYears: number;
  config: ProjectConfig;      // 完整的费率/金属价/产量配置
  note: string;
  createdAt: string;
  updatedAt: string;
}

// 线束 — v2.1: 新增 scenarioId + eopYear
interface Harness {
  id: string;
  projectId: string;
  scenarioId: string;    // v2.1 新增
  harnessId: string;     // 零件号，如 "6608491523"
  harnessName: string;
  vehicleRatio: number;
  eopYear: number | null; // v2.1 新增，null = 跟随场景 lifecycleYears
  bomItems: BomItem[];
  processHours: number;
  packaging: PackagingCost;
  onetimeCost: OnetimeCostAllocation;
}

// 费率
interface RateConfig {
  laborRate: number;      // 客户报价人工费率 (35)
  mfgRate: number;        // 客户报价制造费率 (46.69)
  wasteRate: number;      // 废品率 (0.01)
  mgmtRate: number;       // 管理费率 (0.06)
  profitRate: number;     // 利润率 (0.056627)
}

interface InternalRateConfig {
  factory: string;
  laborRate: number;      // 内部人工费率 (29.19)
  mfg6d: number[];        // 6维制造费 [间接人工, 低值易耗, 材料消耗, 厂房摊销, 自动化摊销, 其他]
  mfgTotal: number;       // 6维合计 (19.74)
  lossRate: number;       // 材料损耗率 (0.005)
  efficiency: number;     // 产能利用率 (0.90)
}

// 金属价格
interface MetalPrices {
  cu: number;  // 铜价 元/吨
  al: number;  // 铝价 元/吨
}
```

### 9.3 存储策略

| 存储方式 | 用途 | 技术 |
|:---|:---|:---|
| **IndexedDB** | 主存储（离线优先） | Dexie.js |
| **JSON 文件** | 费率基准导入/导出 | 文件系统 |
| **PostgreSQL** | 在线协作版数据同步 | Phase 2 |
| **飞书 Bitable** | 可选的管理层看板数据源 | Phase 3 |

---

## 10. UI/UX 设计方案

### 10.1 设计方向（v2.1 更新）：工业蓝图风 + 玻璃面板

> v2.1 变更：从 v2.0 的"Clean White Factory"调整为「工业蓝图风」(Industrial Blueprint)，深色底图 + 半透明玻璃卡片，传达精密制造的专业感。

| 属性 | 规格 |
|:---|:---|
| **背景图** | 深色工业蓝图底图，`opacity` 不提亮，保持沉稳 |
| **布局** | 浮动胶囊岛：侧边栏和顶栏脱离边缘，`border-radius: 28px` |
| **玻璃卡片** | `rgba(255,255,255,0.08)`，`backdrop-filter: blur(40px)`，柔和阴影 |
| **主色** | 蓝色系，状态色：绿/橙/红 |
| **文字** | 浅色文字，数字用等宽字体，`font-weight: 700-800` |
| **图标** | 不使用黑色图标，不使用彩色渐变 |
| **图表** | ECharts，配色与蓝图风协调 |
| **主题** | 强制深色模式 (`theme-mode: dark`) |
| **导航** | 侧边胶囊栏（项目/报表/预警/我的）+ 顶部导航条（总览/分析/报价/价格/模拟/分摊/设变/跟踪/设置） |

### 10.2 页面结构（v2.1 更新）

```
┌─────────────────────────────────────────────────────────────────┐
│ ┌─ 侧边胶囊栏 ─┐  ┌─ 主内容区 ──────────────────────────────┐ │
│ │ [项目]       │  │  ┌─ 顶部导航条 ─────────────────────┐   │ │
│ │ [报表]       │  │  │ 总览 分析 报价 价格 模拟 分摊     │   │ │
│ │ [预警]       │  │  │ 设变 跟踪 设置                    │   │ │
│ │ [我的]       │  │  └──────────────────────────────────┘   │ │
│ │              │  │                                         │ │
│ │              │  │  ┌─ ScenarioSelector (场景切换) ────┐   │ │
│ │              │  │  │ [▼ 最后一轮报价 (基准)]          │   │ │
│ │              │  │  └──────────────────────────────────┘   │ │
│ │              │  │                                         │ │
│ │              │  │  ┌─ 内容区 ─────────────────────────┐   │ │
│ │              │  │  │  (各页面内容：看板/表格/图表)      │   │ │
│ │              │  │  └──────────────────────────────────┘   │ │
│ └──────────────┘  └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 10.3 关键页面（v2.1 更新）

| 页面 | 核心内容 | 交互 |
|:---|:---|:---|
| **项目列表** | 项目卡片网格（线束数、场景数、报价金额、状态） | 点击进入场景列表 |
| **场景列表** | 场景表格 + 谱系链 + 新建/派生/删除/对比 | 场景名称/备注可点击编辑 |
| **场景对比** | 并排 KPI 对比表 + Delta 列（红涨绿降） | 选择 2~4 个场景对比 |
| **决策舱** | KPI卡片 + 成本桥 + 利润对比 + 分摊进度 | 点击KPI下钻到线束明细 |
| **BOM核算** | Univer表格（BOM编辑） + 材料成本汇总 | Excel上传 / 手工编辑 |
| **报价引擎** | 线束报价明细 + 费率调节滑块 | 调节费率实时重算 |
| **分摊管理** | 一次性费用录入 + 回收进度甘特图 | 录入费用 → 自动计算分摊单价 |
| **内部实绩** | 内部 vs 客户双线对比表 | 切换工厂查看不同费率 |
| **变更引擎** | BOM diff + 价格影响分析 | 选择两个版本对比 |
| **预警中心** | 金属价格预警 + 分摊回收预警 + 利润预警 | 预警规则配置 |
| **个人中心** | 角色/权限/偏好设置 | 角色切换影响可见字段 |

---

## 11. 技术架构

### 11.1 技术栈

| 层级 | 技术 | 说明 |
|:---|:---|:---|
| **框架** | React 18 + TypeScript | 组件化 UI |
| **构建** | Vite | 快速 HMR |
| **UI 库** | Semi Design | 企业级组件 |
| **表格引擎** | Univer (@univerjs/presets ^0.20.0) | 类 Excel 交互 |
| **图表** | ECharts 5.0 | 决策舱可视化 |
| **状态管理** | Zustand | 轻量级状态 |
| **本地存储** | Dexie.js (IndexedDB) | 离线优先 |
| **PWA** | Workbox | 离线缓存 |
| **Excel I/O** | SheetJS | .xlsx 解析和导出 |

### 11.2 架构原则

1. **No Hardcoding（严格）**：所有费率必须从财务发布的基准动态加载，代码中禁止魔法数字
2. **Finance-Driven**：计算引擎 (`Engine.ts`) 是 `Active_Benchmark` (JSON) 的纯执行器
3. **Offline-First**：所有核心功能离线完整可用，联网时增量同步
4. **DAG 增量计算**：参数变更时只重算受影响的下游节点

### 11.3 项目结构

```
app/
├── src/
│   ├── engine/               # 计算引擎（纯函数，无 UI 依赖）
│   │   ├── harness_costing.ts  # 单线束核算
│   │   ├── internal_costing.ts # 内部实绩核算
│   │   ├── onetime_alloc.ts    # 一次性费用分摊 (NEW)
│   │   ├── project_summary.ts  # 项目级汇总
│   │   └── metal_linkage.ts    # 金属联动
│   ├── store/                # Zustand 状态管理
│   │   ├── useProjectStore.ts
│   │   ├── useHarnessStore.ts
│   │   └── useAllocStore.ts    # 分摊状态 (NEW)
│   ├── db/                   # Dexie IndexedDB
│   │   ├── schema.ts
│   │   └── sync.ts
│   ├── pages/                # 页面组件
│   │   ├── DashboardPage.tsx   # 决策舱
│   │   ├── BomWorkbench.tsx    # BOM核算工作台
│   │   ├── QuoteEngine.tsx     # 报价引擎
│   │   ├── AllocManager.tsx    # 分摊管理 (NEW)
│   │   ├── InternalCost.tsx    # 内部实绩 (NEW)
│   │   ├── ChangeEngine.tsx    # 变更引擎
│   │   └── ExportPage.tsx      # 导出
│   ├── components/           # 共享组件
│   └── utils/                # 工具函数
├── release/
│   └── Internal_Actual_Rate_Master.json  # 财务基准
└── public/
```

---

## 12. 客户报价模板适配

### 12.1 吉利模板结构

吉利客户报价模板（`高压线束包1-总报价模板(新)-定点.xls`）的标准结构：

```
价格构成:
  P1 出厂价 = A1(原材料) + A2(外购件) + B1(加工费) + B2(废品)
             + C1(管理费) + C2(财务费) + C3(销售费) + D(利润)

  P2 总到厂价 = P1
             + E1+E2(工装摊销，摊入件价/单独支付)
             + F1+F2(试验摊销，摊入件价/单独支付)
             + G1+G2(研发摊销，摊入件价/单独支付)
             + J1+J2(包装)
             + K(运输)
             + L(仓储)
```

### 12.2 模板填写规则

- **黄色单元格**：我方销售填写（材料成本、加工费、管理费、利润、一次性费用等）
- **绿色单元格**：客户公式自动计算，不可修改
- 一次性费用部分：`总投资额`（黄色）÷ 分摊量 = `摊入件价`（绿色公式）

### 12.3 程序到模板的字段映射

```
A1 原材料      ← Σ(BOM中导线类行的材料成本)
A2 外购件      ← Σ(BOM中连接器/端子/辅料的材料成本)
B1 加工费      ← processHours × mfgRate
B2 废品损失    ← (A1+A2) × wasteRate
C1 管理费      ← (A1+A2+B1+B2) × mgmtRate
C2 财务费      ← 根据销售策略
C3 销售费      ← 根据销售策略
D  利润        ← 根据销售策略
E  工装(摊入)  ← onetimeCost.toolingTotal（总投资，分摊由模板公式计算）
F  试验(摊入)  ← onetimeCost.testingTotal
G  研发(摊入)  ← onetimeCost.rdTotal（通常 = 0）
J  包装        ← packaging.innerPack + packaging.outerPack
K  运输        ← packaging.shortHaul + packaging.thirdParty + packaging.storage
```

---

## 13. 实施路径与里程碑

### 13.1 阶段规划

```
Phase 0: 脚手架 (1周) — 已完成 ✅
  ├── React 18 + Vite + TypeScript + Semi Design 基础架构
  ├── Dexie IndexedDB schema
  ├── Zustand store 框架
  ├── PWA 基础配置
  └── E281 种子数据注入

Phase 1: 核心引擎 + BOM核算 (3周) — 已完成 ✅
  ├── computeHarnessCost() — 客户报价引擎
  ├── computeInternalHarnessCost() — 内部实绩引擎
  ├── computeProjectFromHarnesses() — 项目汇总
  ├── unitPrice 优先策略
  ├── E281 数据验证（¥526.63 ± 0.01%）
  └── BOM 工作台（Univer 表格）

Phase 2: 分摊 + 报价 + 决策舱 (4周) — 已完成 ✅
  ├── ⭐ 一次性费用分摊引擎 (onetime_alloc.ts)
  ├── ⭐ 分摊回收跟踪 (AllocRecoveryTracker)
  ├── ⭐ 分摊管理页面 (AllocManager.tsx)
  ├── 报价引擎页面 (QuotePage.tsx)
  ├── 决策舱看板 (DashboardPage.tsx)
  ├── 内部实绩对比 (双线核算集成在决策舱)
  └── 客户模板导出 (吉利模板适配)

Phase 2.5: 场景管理 + UI改造 — 已完成 ✅ (v2.1)
  ├── ⭐ 场景数据模型 (ScenarioRecord + Dexie v7 迁移)
  ├── ⭐ 场景派生/删除 (scenarioFork.ts, 深拷贝 harnesses/costs/trackers)
  ├── ⭐ 单线束 EOP 管理 (eopYear + clampVolumesToEop)
  ├── ⭐ 场景对比页 (ScenarioComparePage, 并排 KPI + Delta)
  ├── 场景列表页 (ProjectScenariosPage, 内联编辑名称/备注)
  ├── 场景切换器 (ScenarioSelector, 所有场景级页面顶部)
  ├── 8 个页面从 project.config 切换到 scenario.config
  ├── 路由重构 (/project/:id/s/:sid/...)
  ├── UI 工业蓝图风改造 (深色主题 + 玻璃卡片)
  ├── 预警中心 (AlertsPage)
  ├── 个人中心 (ProfilePage)
  └── 306 测试全部通过

Phase 3: 变更引擎 + 高级功能 (3周)
  ├── 变更报价引擎 (BOM diff + 价格影响)
  ├── 金属联动模块 + 预警
  ├── 年降管理
  ├── 敏感度分析 / What-if 模拟
  └── 管理层仪表盘 (ECharts)

Phase 4: 在线协作 + 打磨 (3周)
  ├── 飞书 SSO 免登
  ├── 数据同步 (增量上行/下行)
  ├── 飞书审批流对接
  ├── 角色权限控制
  └── 性能优化 + 端到端测试
```

### 13.2 工时估算

| 阶段 | 前端 | 后端 | 合计 |
|:---|:---:|:---:|:---:|
| Phase 0 脚手架 | 6d | 0d | 6d ✅ |
| Phase 1 核心引擎 | 16d | 0d | 16d ✅ |
| Phase 2 分摊+报价+决策舱 | 20d | 0d | 20d ✅ |
| Phase 2.5 场景管理+UI改造 | 8d | 0d | 8d ✅ |
| Phase 3 变更引擎+高级 | 10d | 6d | 16d |
| Phase 4 在线协作 | 6d | 12d | 18d |
| **合计** | **66d** | **18d** | **84d** |

### 13.3 发布节点

```
发布节点 1: 离线单机版 (Phase 0+1+2+2.5) — 已完成 ✅
  ├── 完整的核算功能（客户报价 + 内部实绩）
  ├── ⭐ 一次性费用按根独立分摊
  ├── ⭐ 分摊回收跟踪 + 调价提醒
  ├── ⭐ 场景管理（派生/对比/单线束EOP）
  ├── 决策舱看板
  ├── 客户模板导出
  ├── 工业蓝图风 UI
  ├── 预警中心 + 个人中心
  ├── 306 测试通过
  ├── 无需服务器，双击即用
  └── 适合: 财务/销售单人快速核算

发布节点 2: 飞书协作版 (Phase 3+4, 额外 ~6周)
  ├── 离线版全部功能 +
  ├── 变更报价引擎
  ├── 金属联动 + 年降
  ├── 飞书SSO + 审批 + 消息
  ├── 跨部门数据同步
  └── 适合: 团队协作、正式报价流程
```

---

## 14. 优先级（MoSCoW）

### Must Have (P0) — 已全部完成 ✅
- 单线束号 BOM 核算引擎（unitPrice 优先策略）
- 客户报价公式链（出厂价 + 到厂价 + 单车成本）
- **一次性费用按根/线束号独立分摊**
- **分摊回收进度跟踪**
- 内部实绩核算（双线对比）
- 决策舱 KPI 看板
- 吉利报价模板导出
- **场景管理架构（一个项目多场景）** ← v2.1 新增
- **场景派生/对比/单线束EOP** ← v2.1 新增

### Should Have (P1)
- 分摊回收自动调价提醒
- 变更报价引擎（BOM diff）
- 金属联动计算
- 敏感度分析 / What-if 模拟
- Excel 上传解析（SheetJS）
- **场景间成本差异分析图表** ← v2.1 新增

### Could Have (P2)
- 飞书 SSO + 在线协作
- 多客户模板适配（比亚迪/蔚来）
- 年降管理
- 审批流
- 操作审计日志

### Won't Have (本版本)
- 多维表格集成
- 移动端独立 App
- ERP 对接

---

## 15. 附录

### 附录 A：E281 参考数据验证结果

- 11条线束 × 17个字段 = 187个数据点
- 种子数据 vs Excel 定点核算：**100% 精确匹配，0处差异**
- 客户报价单车成本 = **¥526.63**（偏差 < 0.01%）
- 内部实绩单车成本 = **¥425.78**
- 验证脚本：`BOM核对/_verify_seed_vs_excel.py`

### 附录 B：运营工时费报价基准（7工厂）

财务发布的内部费率基准存储在 `release/Internal_Actual_Rate_Master.json`，包含：

| 工厂 | 人工费率 | 6维制造费合计 | 材料损耗 |
|:---|:---|:---|:---|
| K1K2（昆山） | 29.19 | 19.74 | 0.5% |
| K3 | (待填) | (待填) | 0.5% |
| 宁波 | (待填) | (待填) | 0.5% |
| 保定 | (待填) | (待填) | 0.5% |
| 重庆(低压) | (待填) | (待填) | 0.5% |
| 重庆(高压) | (待填) | (待填) | 0.5% |
| 天津 | (待填) | (待填) | 0.5% |

6维制造费明细：间接人工、低值易耗品、材料消耗、厂房摊销、自动化摊销、其他间接费。

### 附录 C：关键业务规则备忘

1. **废品率**：客户模板要求的格式字段，具体填多少由销售策略决定，程序不深究
2. **材料损耗**：内部 0.5% 已计入6维制造费，与客户废品率是两套独立体系
3. **中间费率**：废品率/管理费率/利润率等属于销售策略范畴，程序只关注出厂价和到厂价
4. **分摊基数**：默认 50,000 根/线束号，可按项目配置
5. **研发费**：通常不向客户回收（吉利模板中 = 0），但内部核算会记录
6. **制造费率表头 vs 实际**：Excel 表头写 47 元/H，但公式实际用 46.69 元/H
7. **工时来源**：工艺部门提供合计工时，不是从 BOM 计算

### 附录 D：核算逻辑详细说明

完整的 Excel 公式链逆向分析见 [核算表数据结构与计算逻辑说明书.md](核算表数据结构与计算逻辑说明书.md)。

### 附录 E：相关文件索引

| 文件 | 路径 | 用途 |
|:---|:---|:---|
| 核算逻辑说明书 | `核算表数据结构与计算逻辑说明书.md` | Excel 公式链完整分析 |
| 落地方案 v1 | `__LANDING_PLAN.md` | 初版方案（含协作矩阵等） |
| 旧版 PRD | `PRD_Automotive_HV_Harness_Cost_Model.md` | v1.3 PRD（已废弃） |
| E281 种子数据 | `_e281_harness_seed_data.json` | 11条线束完整数据 |
| 注入脚本 | `app/inject_e281_data.js` | 浏览器控制台注入测试数据 |
| 财务基准 | `release/Internal_Actual_Rate_Master.json` | 7工厂内部费率 |
| BOM分析报告 | `BOM核对/BOM数据结构分析报告.md` | 8个 Excel 文件结构分析 |
| 工艺标准 | `g281_process_standard.md` | 工序定义 |

| 场景管理架构 | `app/src/data/scenarioFork.ts` | 场景派生/删除逻辑 |
| 场景数据模型 | `app/src/data/db.ts` | ScenarioRecord + Dexie v7 迁移 |
| 线束EOP工具 | `app/src/engine/harness_lifecycle.ts` | clampVolumesToEop + effectiveLifecycleYears |

---

> **下一步**：Phase 0~2.5 已全部完成（306 测试通过）。下一阶段优先实现 Phase 3 中的变更报价引擎（BOM diff + 价格影响分析）和金属联动预警。
