# BOM表的数据结构和计算逻辑说明书

> 分析对象：`参考表格/E281/吉利E281 国内项目 TT BOM V05-2026.01.04.xlsx`、`参考表格/E281/E281项目 报价BOM V01-11.3.xlsx`、相关单线束 sheet（如 `6608516992`）  
> 适用范围：高压线束精算与决策引擎中的 BOM 工作簿、材料成本上游、配置清单、报价核算上游基础  
> 编写时间：2026-04-08

---

## 交叉引用
- 主要关联功能规格：
  - `03-功能规格/F03-BOM工作簿.md`
- 主要用途：基于真实 BOM 工作簿，澄清线束 BOM 的对象层次、字段结构与向报价表传递的计算关系

## 1. 文档目标

本文档基于真实 E281 BOM 工作簿说明：
- BOM 表在实际业务里由哪些 sheet 组成
- 线束 BOM、配置清单、总成散件清单之间是什么关系
- BOM 行真实字段有哪些
- BOM 如何汇总成报价核算表中的材料成本、铜重、铝重、导线成本和工时基础

---

## 2. 真实 BOM 工作簿的结构定位

从 `吉利E281 国内项目 TT BOM V05-2026.01.04.xlsx` 与 `E281项目 报价BOM V01-11.3.xlsx` 看，真实 BOM 工作簿至少包含以下几层：

1. **配置清单**：线束号与车型/配置/适配关系
2. **变更履历**：线束级设计与材料变化记录
3. **总成散件清单**：跨线束的标准散件清单
4. **二次物料明细**：从 KSK 明细中反查并汇总出的二次物料层
5. **KSK线束BOM明细**：项目级、可汇总的线束 BOM 主表
6. **单线束 sheet（如 6608516992）**：某条线束的原始结构展开页

因此，真实 BOM 不是单个明细表，而是一个**从配置层到单线束展开层的多 sheet 结构体系**。

---

## 3. 真实对象层级

### 3.1 配置对象（Harness Configuration Row）
来源于 `配置清单`，定义：
- 线束零件号
- 线束名称
- 适配导线
- 配置/标配/选配关系
- 车型/版本适用矩阵

### 3.2 线束 BOM 主行（Harness Bom Main Row）
来源于 `KSK线束BOM明细`，是系统最接近“项目级 BOM 主事实表”的对象。

### 3.3 单线束原始明细行（Single Harness Detail Row）
来源于 `6608516992` 这类单线束 sheet，承载该线束最原始的物料结构。

### 3.4 二次物料汇总行（Secondary Material Row）
来源于 `二次物料明细`，是对 KSK 明细中的某些物料描述进行汇总后的结果层。

### 3.5 变更事件行（Bom Change Row）
来源于 `变更履历`，用于表达导线规格、用量、套管、支架等变化。

---

## 4. 基于真实表格的核心数据结构

## 4.1 线束配置行

对应 `配置清单`：

```ts
interface HarnessConfigurationRow {
  sequenceNo: string
  packageName: string
  harnessPartNumber: string
  harnessName: string
  adaptedWire?: string
  configurationLabel?: string
  fitmentType?: 'S' | 'O'
  vehicleApplicability?: string[]
}
```

## 4.2 KSK线束BOM明细行

对应 `KSK线束BOM明细` 当前真实可见主列：

```ts
interface KskBomRow {
  harnessPartNumber: string
  harnessName: string
  assemblyPartNumber?: string
  partNumber: string
  partName: string
  isSemiFinished: 'Y' | 'N'
  sapOrModel?: string
  circuitNo?: string
  quantity: number
  unit: string
  supplier?: string
  remark?: string
  otherRemark?: string
}
```

## 4.3 单线束原始展开行

对应 `6608516992` 这类单线束 sheet：

```ts
interface SingleHarnessDetailRow {
  rowNo: string
  functionDescription?: string
  partNumber: string
  partName: string
  isSemiFinished: 'Y' | 'N'
  wireNo?: string
  pin?: string
  option?: string
  spec?: string
  quantity: number
  unit: string
  remark?: string
  otherRemark?: string
  subPartNumber?: string
  subPartName?: string
  subPartQuantity?: number
  subPartUnit?: string
}
```

## 4.4 二次物料汇总行

对应 `二次物料明细`：

```ts
interface SecondaryMaterialRow {
  componentDescription: string
  materialName?: string
  quantity: number
  unit?: string
  unitPrice?: number
  unitCopperWeight?: number
  copperWeight?: number
  supplier?: string
  origin?: string
  sapNo?: string
  remark?: string
}
```

## 4.5 BOM变更事件行

对应 `变更履历`：

```ts
interface BomChangeHistoryRow {
  harnessPartNumber: string
  harnessName?: string
  changeDescription: string
  changeDate?: string
  remark?: string
}
```

## 4.6 线束汇总结果行

这是 BOM 向报价核算表传递时形成的汇总层，真实来源在报价核算表 `配置明细` 中由 `SUMIFS(KSK线束BOM明细!...)` 得到：

```ts
interface HarnessBomSummaryRow {
  harnessPartNumber: string
  harnessName: string
  materialCost: number
  copperWeightKg: number
  aluminumWeightKg: number
  wireCost: number
  cuttingHours?: number
  sharedManufacturingHours?: number
  postProcessHours?: number
  jph?: number
  circuitCount?: number
}
```

---

## 5. 真实字段语义

## 5.1 配置清单不是 BOM 明细本身

`配置清单` 负责回答：
- 哪些线束存在
- 对应什么零件号/名称
- 是标配还是选配
- 适用于哪些车型配置

它是**线束选择层**，不是材料明细层。

## 5.2 KSK线束BOM明细才是项目级 BOM 主表

从真实引用关系看：
- 报价核算表 `配置明细` 用 `SUMIFS(KSK线束BOM明细!...)`
- 二次物料明细用 `VLOOKUP/SUMIFS(KSK线束BOM明细!...)`

说明 `KSK线束BOM明细` 才是最关键的 BOM 事实来源。

## 5.3 单线束 sheet 是原始展开页，不等于系统主存储结构

如 `6608516992` sheet 中还保留：
- Function
- Wire NO.
- PIN
- OPTION
- SPEC
- Sub-Part Number/Name/Quantity

这些字段非常适合做原始解析与追溯，但在系统内核里不一定全部作为统一主对象字段暴露。

## 5.4 二次物料明细是派生层

其公式大量使用：
- `VLOOKUP(..., KSK线束BOM明细!D:N, ...)`
- `SUMIFS(KSK线束BOM明细!K:K, ...)`

说明它是从 KSK 明细中提取/聚合出的二次材料视图，而不是独立录入主表。

---

## 6. 真实计算链路

## 6.1 配置清单确定线束集合

```text
配置清单
→ 给出线束号、线束名称、标配/选配、车型适用关系
→ 形成当前项目/配置下应进入核算的线束集合
```

## 6.2 单线束展开页进入 KSK线束BOM明细

真实工作簿里，单线束页保留最原始结构，而系统做项目级汇总时应优先落在 `KSK线束BOM明细` 这一层。

```text
单线束原始结构页
→ 统一归并为 KSK线束BOM明细
→ 形成项目级可汇总 BOM 主表
```

## 6.3 KSK线束BOM明细向报价核算表汇总

在 `吉利E281报价核算_BOM核对版.xlsx / 配置明细` 中可见：

```text
材料成本 = SUMIFS(KSK线束BOM明细!S:S, KSK线束BOM明细!A:A, 线束号)
铜重 = SUMIFS(KSK线束BOM明细!U:U, KSK线束BOM明细!A:A, 线束号)
铝重 = SUMIFS(KSK线束BOM明细!T:T, KSK线束BOM明细!A:A, 线束号)
导线成本 = SUMIFS(KSK线束BOM明细!V:V, KSK线束BOM明细!A:A, 线束号)
```

这说明 KSK 主表中不仅有基础物料字段，还已经包含：
- 材料成本列
- 铝重列
- 铜重列
- 导线成本列

系统设计时，不能只看到前面可见的 A-N 列，就把 BOM 简化成“料号 + 数量 + 单位”。

## 6.4 二次物料明细从 KSK 主表派生

```text
二次物料描述
→ VLOOKUP 取 KSK线束BOM明细中的名称/单位/供应商/SAP
→ SUMIFS 汇总 KSK线束BOM明细中的数量
```

这表明二次物料更适合作为派生分析对象，而不是 BOM 主事实对象。

## 6.5 变更履历驱动 BOM 差异解释

`变更履历` 中明确记录：
- 导线规格变化（如 50mm² → 35mm²）
- 用量变化
- 套管型号变化
- 新增橡胶件、支架数据变化等

因此设变分析不能只比较两版 BOM 行差异，还要保留**业务解释文本**。

---

## 7. BOM 与系统模块的真实关系

### 7.1 与客户报价工作台
客户报价表中的材料成本、铜重、铝重、导线成本都直接来自 BOM 汇总结果。

### 7.2 与设变与跟踪
`变更履历` 和 KSK 明细共同构成设变识别基础：
- 一部分是结构化字段差异
- 一部分是人工归纳后的业务变更说明

### 7.3 与场景管理
不同 BOM 文件版本（报价 BOM、TT BOM、定点 BOM）本身就是不同场景/阶段的事实来源。

### 7.4 与数据结构建模
系统不能只建一个 `BomRow`，至少要区分：
- 配置层
- KSK 主明细层
- 单线束原始层
- 派生汇总层
- 变更层

---

## 8. 推荐实现约束

### 8.1 以 KSK线束BOM明细作为系统主 BOM 来源
因为真实报价核算表就是按这一层做汇总。

### 8.2 单线束页保留为可追溯原始结构
不要直接丢弃，但也不要把它直接等价成系统统一主表。

### 8.3 配置清单必须独立建模
标配/选配、车型适用关系、线束集合选择都在这里，不应混进 BOM 明细行。

### 8.4 变更履历需要同时保存结构差异与业务描述
否则无法还原真实业务对 BOM 变化的解释口径。

### 8.5 BOM 汇总层必须保留材料成本/铜重/铝重/导线成本等结果字段
因为下游报价核算直接按这些字段聚合，而不是再逐个原始散件重算。

---

## 9. 当前应补充到系统说明书中的结论

1. 真实 BOM 工作簿是“配置清单 + KSK主明细 + 单线束页 + 二次物料 + 变更履历”的组合结构。
2. `KSK线束BOM明细` 是当前最关键的项目级 BOM 主事实来源。
3. 单线束页适合做原始追溯，不应直接替代项目级 BOM 主表。
4. 报价核算表已经依赖 BOM 汇总结果字段（材料成本、铜重、铝重、导线成本）而不是只依赖原始散件字段。
5. BOM 模型必须同时支持配置选择、结构追溯、汇总核算和设变解释。

---

## 10. 结论

基于真实 E281 BOM 工作簿，BOM 表不能再被抽象成一个简单的 `BomRow` 列表，而应被理解为从配置选择、单线束展开、KSK 主明细、二次物料派生到变更履历解释的多层结构体系。系统只有按这个真实层次建模，后续报价、设变、跟踪和版本治理才能接上真实业务。