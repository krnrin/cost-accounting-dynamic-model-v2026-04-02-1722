# 高压线束成本核算动态模型 — 深度优化报告 v2

> **定位**: 汽车高压线束**通用**成本分析工具（E281/G281 仅为首个参考项目）  
> **基于**: Notion 开发日志 Session 1-14 + 仓库代码全量审查 + Excel 财务核算逻辑对标  
> **分析日期**: 2026-04-03

---

## 〇、已完成工作回顾

根据 Notion 记录，截至 Session 14 已完成：

| 类别 | 已完成项 |
|:---|:---|
| **核心引擎** | Issue #1-#5 修复（进度价/残余池/瀑布图+Shapley/计算路径系数/unit=set）、#9 engine.js 拆分为 4 子模块、#29 root→global Bug、ConfigBridge 配置注入 |
| **架构** | #13 四页骨架（预演/核算/跟踪/归档）、#14 多项目配置驱动、#15 projectConfig 提取、PR #21-#28 模块集成 |
| **UI** | #6 UI架构分析、#36 IIFE globalThis、#37 死代码清理、#39 XSS/error-boundary/焦点陷阱、#40 Design tokens/响应式/骨架屏 |
| **待办** | **#30 dashboard.js 448KB 拆分**（~9h）、**#31 新建项目 UI 向导**（~10.5h）、Phase A 基础设施串联（~1h）、Phase B CSS 拆分（~4h） |

**本报告聚焦**: 在现有架构基础上，从**通用化能力**和**核算精度**两个维度提出深度优化意见，不重复已完成/已计划的工作。

---

## 一、通用化架构层面的优化

### 1.1 ⚠️ 成本结构模型需要从 G281 特例泛化为可配置 Schema

**现状**: `compute_model.js` 的成本分解硬编码为：`material + directLabor + manufacturing + equipment + packaging + rd + vave`，这恰好是 G281 项目的成本结构。

**问题**: 不同客户/不同线束包的成本结构不同：
- 有的项目没有 VAVE 项
- 有的项目有「认证费」「样品费」等一次性费用需要单独摊销
- 低压线束的成本结构中「自动化设备摊销」占比远高于高压
- 有的项目区分「国产件」和「进口件」的材料成本

**建议**: 将成本结构定义为 projectConfig 中的可配置 schema：

```json
{
  "costStructure": {
    "categories": [
      {
        "key": "material",
        "label": "材料成本",
        "driver": "bom",
        "subcategories": [
          { "key": "connector", "label": "连接器", "driver": "bom_category" },
          { "key": "terminal", "label": "端子", "driver": "bom_category" },
          { "key": "wire", "label": "导线", "driver": "wire_catalog", "metalLinked": true },
          { "key": "other", "label": "其他物料", "driver": "bom_category" }
        ]
      },
      {
        "key": "directLabor",
        "label": "直接人工",
        "driver": "hours",
        "stages": [
          { "key": "wireCut", "label": "开线", "rateKey": "wireCutRate" },
          { "key": "frontProcess", "label": "公共制程", "rateKey": "frontProcessRate" },
          { "key": "assembly", "label": "总装", "rateKey": "assemblyRate" }
        ]
      },
      {
        "key": "manufacturing",
        "label": "制造费用",
        "driver": "hours",
        "items": [
          { "key": "indirectLabor", "label": "间接人工", "rateKey": "indirectLaborRate" },
          { "key": "consumables", "label": "低值易耗品", "rateKey": "consumablesRate" },
          { "key": "machineMaterial", "label": "机物料消耗", "rateKey": "machineMaterialRate" },
          { "key": "plantShare", "label": "厂房分摊", "rateKey": "plantShareRate" },
          { "key": "warehouseShare", "label": "仓库分摊", "rateKey": "warehouseShareRate" },
          { "key": "otherMfg", "label": "其他制费", "rateKey": "otherMfgRate" },
          { "key": "materialWaste", "label": "材料损耗", "driver": "material_pct", "rate": 0.005 }
        ]
      },
      {
        "key": "equipment",
        "label": "设备成本",
        "subcategories": [
          { "key": "shared", "label": "共用设备", "amortization": "annual_depreciation" },
          { "key": "dedicated", "label": "专用设备", "amortization": "lifecycle_total" }
        ]
      }
    ]
  }
}
```

**影响**: 引擎的 `computeModel` 函数需要改为遍历 `costStructure.categories` 而非硬编码字段名。新项目只需定义自己的成本结构 JSON，无需改代码。

### 1.2 ⚠️ BOM 分类规则需要从关键词硬编码泛化为可配置

**现状**: `g281.project.json` 中 BOM 分类用固定关键词列表：

```json
"classificationKeywords": {
  "connector": ["连接器", "插头", "护套"],
  "terminal": ["端子", "压接"],
  "wire": ["导线", "电线", "屏蔽线"]
}
```

**问题**: 
- 不同客户的 BOM 物料描述用语不同（如吉利用「护套」，比亚迪可能用「外壳」）
- 进口件可能用英文描述（"connector", "terminal"）
- 同一个词在不同上下文含义不同（「端子」可以是连接器端子也可以是线束端子）

**建议**: 分类规则支持正则 + 排除词 + 优先级：

```json
"classificationRules": [
  {
    "category": "connector",
    "match": ["连接器", "插头", "护套", "外壳", "connector", "housing"],
    "exclude": ["端子"],
    "priority": 1
  },
  {
    "category": "wire",
    "match": ["导线", "电线", "屏蔽线", "cable", "wire"],
    "matchPartNo": "^6608[0-9]{6}$",
    "priority": 2
  }
]
```

### 1.3 ⚠️ 工厂费率体系需要支持多工厂横向对比

**现状**: 引擎只使用一组费率（当前工厂），无法支持「如果转到另一个工厂，成本会怎样」的分析。

**Excel 现实**: 「运营工时费报价基准」表定义了 7 个工厂的独立费率体系，且每个工厂的工时拆分粒度不同（K1K2 有开线/公共制程/总装 3 级，K3 只有一个总装费率）。

**建议**: projectConfig 中增加工厂维度：

```json
"factories": {
  "K1K2": {
    "label": "昆山",
    "laborRates": {
      "wireCut": 30.1984,
      "frontProcess": 28.1883,
      "assembly": 28.5801
    },
    "mfgRates": {
      "indirectLabor": 8.4991,
      "consumables": 0.8764,
      "machineMaterial": 1.8563,
      "plantShare": 1.45,
      "warehouseShare": 2.03,
      "otherMfg": 1.4234
    },
    "efficiency": { "highVoltage": 0.90, "lowVoltage": 0.85 }
  },
  "CQ_HV": {
    "label": "重庆高压",
    "laborRates": { "assembly": 32.0344 },
    "mfgRates": { ... }
  }
}
```

引擎可以接受 `factoryKey` 参数来切换费率组，实现多工厂比价模拟。

### 1.4 ⚠️ 「新建项目向导」(Issue #31) 的数据采集清单不完整

**Notion 计划**: 3 步向导（基本信息 → 线束配置 → 确认生成）。

**建议补充**: 向导应采集的完整数据清单：

| 步骤 | 数据项 | 说明 |
|:---|:---|:---|
| 1. 基本信息 | 项目代码、客户名称、车型平台 | 已计划 |
| 1. 基本信息 | 生命周期年限 + 年度产量 | 已计划 |
| 1. 基本信息 | **所属工厂 + 备选工厂** | 新增：决定费率体系 |
| 1. 基本信息 | **成本核算币种** | 新增：出口项目需要 |
| 2. 线束配置 | 配置名称 + 装车比 | 已计划 |
| 2. 线束配置 | **BOM 模板上传**（Excel） | 已计划 |
| 2. 线束配置 | **列映射确认**（零件号/描述/用量/单价 各在哪列） | 关键：不同客户 BOM 格式不同 |
| 2. 线束配置 | **金属基准价（铜/铝）** | 新增：不同时间点的基准价不同 |
| 2. 线束配置 | **工时数据（前工程/后工程）** | 新增：可后续补录 |
| 3. 确认生成 | 成本结构预览 + 修正 | 新增：让用户确认哪些成本项适用于该项目 |

---

## 二、核算精度层面的优化

### 2.1 🔴 材料成本的「系数近似」应升级为「BOM 行级精算」

**当前逻辑** (`compute_model.js:1204-1214`):

```javascript
const mc = ConfigBridge.materialComposition();  // {connector:0.24, copper:0.38, aluminum:0.18, other:0.20}
const matBase = quoteBase.materialPerSet * (
  mc.connector * connectorFactor + mc.copper * copperFactor + mc.aluminum * aluminumFactor + mc.other
);
```

这意味着：当铜价变化 10% 时，材料成本变化 = `345.34 × 0.38 × 10% × 0.65 = 8.53 元`。

**实际逻辑**（从 Excel 导线目录倒推）：

- 实际铜占材料成本的比例因零件号不同而差异巨大
- 6608442966（组合式充电插座）铜重 0.9517kg → 铜价变 10% 影响 6.61 元
- 6608442964（压缩机线束）铜重 0.0265kg → 铜价变 10% 影响 0.18 元
- 加权平均后的「真实铜占比」和 0.38 系数之间可能存在 ±20% 的偏差

**建议**: 程序已经有 `wireCatalog` 和 BOM 数据，`harness_profit.js` 中的 `buildMatchedWireCost` 也已经实现了逐线精算。问题在于 `computeModel` 的「估算路径」没有利用这个能力。

```javascript
// 优化方案：估算路径也使用 BOM 行级计算
function computeMaterialWithBomDetail(bomItems, wireCatalog, metalPrices, basePrices) {
  let totalMaterial = 0;
  let metalSensitive = 0;  // 受金属价格影响的部分
  let metalInsensitive = 0;  // 不受金属价格影响的部分
  
  for (const item of bomItems) {
    const wire = wireCatalog.get(item.partNo);
    if (wire && wire.copperWeightPerKm > 0) {
      // 导线类：拆分金属成本和非金属成本
      const cuCost = wire.copperWeightPerKm * item.lengthKm * metalPrices.copper / 1000;
      const alCost = wire.aluminumWeightPerKm * item.lengthKm * metalPrices.aluminum / 1000;
      const nonMetalCost = wire.baseNonMetalCost * item.lengthKm;
      metalSensitive += cuCost + alCost;
      metalInsensitive += nonMetalCost;
    } else {
      // 连接器/端子/其他：直接用 BOM 单价
      metalInsensitive += item.unitPrice * item.qty;
    }
    totalMaterial += item.totalCost;
  }
  
  return { totalMaterial, metalSensitive, metalInsensitive,
           actualCopperShare: metalSensitive / totalMaterial };
}
```

**关键收益**: 不再需要 `materialComposition` 系数，直接从 BOM 计算出**真实的金属占比**，金属价格变动时精度从 ±3-5% 提升到 <±0.5%。

### 2.2 🔴 年度成本不应是常数 — 需要年度差异化计算

**当前逻辑**: `computeModel` 计算出的 `costPerSet` 是一个常数，6 年都一样。但 `buildExactFinancialModel`（精确路径）从 `financialVersions` 读取每年不同的值。

**Excel 现实**:

| 年度 | 产量 | 单套设备成本 | 单套制造费 | 差异原因 |
|:---|:---|:---|:---|:---|
| 2026 (第1年) | 85,000 | 30.65 | 24.07 | 产量低，固定成本分摊高 |
| 2027 (第2年) | 128,000 | 26.62 | 21.52 | 产量上升 |
| 2028 (第3年) | 128,000 | 26.62 | 21.52 | 稳态 |
| 2029 (第4年) | 128,000 | 26.62 | 21.52 | 稳态 |
| 2030 (第5年) | 90,000 | 28.90 | 23.36 | 产量下降 |
| 2031 (第6年) | 41,000 | 35.48 | 28.67 | 产量骤降 |

**关键差距**: 估算路径用 `lifecycleVolume` 均摊设备成本，得到 27.19 元/PCS。但第 1 年实际是 30.65、第 6 年是 35.48 — 与均值偏差分别为 +12.7% 和 +30.5%。

**建议**: 估算路径也按年度计算：

```javascript
function computeAnnualCosts(params, annualVolumes) {
  return annualVolumes.map((vol, i) => {
    const year = params.startYear + i;
    // 材料：不受产量影响（单套不变）
    const material = params.materialPerSet;
    // 直接人工：不受产量影响（单套不变）
    const labor = params.laborPerSet;
    // 设备：受产量影响
    const sharedEquip = vol > 0 ? params.sharedAnnualDepreciation / vol : 0;
    const dedicatedEquip = params.lifecycleVolume > 0 
      ? params.dedicatedTotal / params.lifecycleVolume : 0;
    // 制造费用中的固定部分（厂房/仓库）受产量影响
    const fixedMfg = vol > 0 ? params.fixedMfgAnnual / vol : 0;
    const variableMfg = params.variableMfgPerSet;
    
    return {
      year, volume: vol,
      costPerSet: material + labor + sharedEquip + dedicatedEquip + fixedMfg + variableMfg,
      breakdown: { material, labor, sharedEquip, dedicatedEquip, fixedMfg, variableMfg }
    };
  });
}
```

### 2.3 🟡 制造费用的「材料损耗」应跟随材料价格联动

**当前逻辑**: 材料损耗被包含在 `manufacturingRate`（46.69 元/h）中，是工时驱动的。

**Excel 现实**: 材料损耗 = 材料成本 × 0.5% = 345.34 × 0.005 = 1.7267 元/PCS。这是**材料价格驱动**的，不是工时驱动的。

**影响**: 当铜价上涨 20% 时：
- 程序计算的材料损耗不变（因为是工时驱动的）
- 实际材料损耗应增加 ≈ 0.345 × 0.38 × 0.20 × 0.005 = 0.13 元
- 虽然金额不大，但这反映了模型的**逻辑错误**

**建议**: 将材料损耗从制造费用中独立出来：

```javascript
const materialWaste = totalMaterial * wasteRate;  // 材料价格驱动
const mfgCostExWaste = totalHours * (mfgRate - wasteRateInMfg);  // 工时驱动部分
```

### 2.4 🟡 客户报价验证层缺失

**Excel「客户报价逻辑」表**有一套独立的报价计算：

```
客户到厂价 = 出厂价 + 包装费 + 运输费
出厂价 = (材料 + 废品 + 人工 + 制造 + 管理费) × (1 + 利润率)
废品 = 材料 × 0.9%
管理费 = (材料 + 废品 + 人工 + 制造) × 6%
```

**现状**: 程序没有「客户报价」计算层。只有内部成本分析和毛利率计算。

**建议**: 添加「客户报价模拟」模块，特别是对「② 核算」页面：

```javascript
function computeCustomerQuote(internalCost, quoteParams) {
  const { wasteRate = 0.009, mgmtRate = 0.06, profitRate } = quoteParams;
  
  const waste = internalCost.material * wasteRate;
  const subtotal = internalCost.material + waste + internalCost.labor + internalCost.manufacturing;
  const mgmtFee = subtotal * mgmtRate;
  const profit = (subtotal + mgmtFee) * profitRate;
  const exFactoryPrice = subtotal + mgmtFee + profit;
  const deliveredPrice = exFactoryPrice + internalCost.packaging + internalCost.freight;
  
  return { waste, mgmtFee, profit, exFactoryPrice, deliveredPrice };
}
```

**配置化**: 废品率、管理费率应可在 projectConfig 中配置（不同客户不同）。

### 2.5 🟡 间接费用分摊方式应可配置

**现状** (`harness_profit.js:146-151`): 所有间接费用按 `revenueShare` 分摊。

**建议**: 不同费用项应有不同的分摊驱动因子，且可在 projectConfig 中配置：

```json
"allocationDrivers": {
  "labor": "hours",
  "manufacturing": "hours",
  "equipment": "revenue",
  "packaging": "direct",
  "rd": "volume",
  "materialWaste": "material_cost"
}
```

引擎代码：

```javascript
function allocateByDriver(driver, harness, totals) {
  switch (driver) {
    case 'hours': return harness.processHours / totals.totalHours;
    case 'revenue': return harness.revenue / totals.totalRevenue;
    case 'direct': return 1;  // 已直接归属到零件号
    case 'volume': return harness.volume / totals.totalVolume;
    case 'material_cost': return harness.materialCost / totals.totalMaterial;
    default: return harness.revenue / totals.totalRevenue;
  }
}
```

### 2.6 🟡 工厂效率矩阵需要建模

**Excel 现实**: 工厂效率不是一个简单的数字（如 90%），而是一个由「总工时」和「节拍」决定的矩阵：

| 条件 | 效率 |
|:---|:---|
| 昆山高压, 节拍 ≤ 5 PCS/h | 0.85 |
| 昆山高压, 5 < 节拍 ≤ 10 | 0.90 |
| 昆山高压, 节拍 > 10 | 0.95 |
| 其他工厂, 工时 ≤ 42s, 低节拍 | 0.75 |
| 其他工厂, 工时 > 42s, 高节拍 | 1.05 |

**现状**: 程序将效率固定为一个值。

**建议**: 建模为查表函数：

```javascript
function lookupEfficiency(factoryKey, totalTimeSeconds, taktPcsPerHour, projectConfig) {
  const rules = projectConfig.factories[factoryKey].efficiencyMatrix;
  for (const rule of rules) {
    if (totalTimeSeconds >= rule.minTime && totalTimeSeconds < rule.maxTime
        && taktPcsPerHour >= rule.minTakt && taktPcsPerHour < rule.maxTakt) {
      return rule.efficiency;
    }
  }
  return rules[rules.length - 1].efficiency;  // 默认值
}
```

---

## 三、引擎架构层面的优化

### 3.1 🔴 computeModel 双路径合并为统一流程

**现状**: 精确路径和估算路径是两套完全不同的代码分支。精确路径从 `financialVersions` 读预存数据，估算路径用系数计算。

**问题**:
- 两条路径的成本分解粒度不一致（精确路径有年度数据，估算路径是常数）
- 新项目可能没有 `financialVersions`（第一次报价），只能走估算路径
- 估算路径永远只是「近似值」，不够精确

**建议**: 统一为三级精度递进：

```
Level 3 (最高精度): BOM 行级 + 导线目录 + 工时明细 → 逐行逐年计算
Level 2 (中等精度): BOM 总价 + 金属占比 + 工时汇总 → 分类汇总计算
Level 1 (最低精度): 系数近似（当前估算路径）
```

引擎自动根据可用数据选择最高可用精度：

```javascript
function selectPrecisionLevel(runtime) {
  if (runtime.bomItems?.length > 0 && runtime.wireCatalog?.size > 0 
      && runtime.laborDetail) {
    return 3;  // 有完整 BOM + 导线目录 + 工时明细
  }
  if (runtime.bomSummary && runtime.metalBasePrices) {
    return 2;  // 有 BOM 汇总数据
  }
  return 1;  // 只有系数
}
```

### 3.2 🟡 Shapley 因子定义应可配置

**现状** (`profit_shapley.js:4-45`): 12 个因子硬编码：

```javascript
const FACTOR_DEFS = [
  { key: 'bom', label: 'BOM版本', draftKeys: ['bomWireDraft', 'bomConnectorDraft'] },
  { key: 'copper', label: '铜价', draftKeys: ['copperPrice'] },
  // ... 12 个
];
```

**问题**: 新项目可能有不同的因子组合（如增加「汇率」因子用于出口项目，或「碳排放成本」因子）。

**建议**: 因子定义从 projectConfig 读取：

```json
"shapleyFactors": [
  { "key": "bom", "label": "BOM版本", "draftKeys": ["bomWireDraft", "bomConnectorDraft"] },
  { "key": "copper", "label": "铜价", "draftKeys": ["copperPrice"] },
  { "key": "aluminum", "label": "铝价", "draftKeys": ["aluminumPrice"] },
  { "key": "exchangeRate", "label": "汇率", "draftKeys": ["exchangeRate"] }
]
```

### 3.3 🟡 目标价求解器的默认值需要从 projectConfig 读取

**现状** (`target_price_solver.js:5`):

```javascript
const PACK_DEFAULTS = { packInner: 3.2, packFreight: 4.1, packOuter: 0.85, ... };
```

这些是 G281 的包装成本数据，硬编码在求解器中。

**建议**: 从 `projectConfig.defaults.packaging` 读取，或从当前场景的实际包装数据读取。

### 3.4 🟡 增量计算引擎

**现状**: 每次参数变动（如拖动铜价滑块）都触发完整的 `computeModel` 重算。

**建议**: 建立成本项之间的依赖图，只重算受影响的分支：

```
copperPrice 变化 → 只影响: 材料成本(导线部分) → 材料损耗 → 毛利
directHours 变化 → 只影响: 直接人工 → 制造费用 → 毛利
efficiency 变化 → 只影响: 工时换算 → 直接人工 → 制造费用 → 毛利
annualVolume 变化 → 影响: 设备摊销 → 固定制造费 → 毛利 (年度差异化)
```

---

## 四、数据管道优化

### 4.1 🔴 Python 提取脚本的通用化

**现状**: 9 个 `g281_generate_*.py` 脚本完全为 G281 定制，硬编码了文件名、工作表名、单元格地址。

**问题**: 新项目不能复用这些脚本。每个新客户的 Excel 格式不同。

**建议**: 构建一个**配置驱动的通用提取框架**：

```python
# extract_config.yaml
bom_validation:
  source_file: "{project_code}_定点核算.xlsx"
  sheets:
    ksk_bom:
      name_pattern: "KSK.*BOM"
      columns:
        part_no: { header: "物料编码", fallback_col: "B" }
        description: { header: "物料描述", fallback_col: "C" }
        quantity: { header: "数量", fallback_col: "E" }
        unit_price: { header: "单价", fallback_col: "F" }
    config_list:
      name_pattern: "配置"
      columns:
        harness_no: { header: "零件号" }
        vehicle_ratio: { header: "装车比" }

financial_versions:
  source_file: "{project_code}_定点核算.xlsx"
  sheets:
    evaluation_summary:
      name_pattern: "项目评估汇总"
      cells:
        lifecycle_start_year: "F3"
        annual_revenue: "F8:K8"
        annual_cost: "F18:K18"
        annual_volume: "F5:K5"
```

用一个通用的 `universal_extractor.py` 驱动，配置文件按项目提供。

### 4.2 🟡 g281_data_bundle.js 拆分已计划但需要重新设计

**Notion 中提到需要拆分**，建议拆分策略：

| 数据类型 | 加载时机 | 原因 |
|:---|:---|:---|
| master + financial_versions | 页面初始化时 | 引擎核心依赖 |
| wire_catalog | 用户打开导线 Tab 时 | 数据量大但不是首屏必须 |
| bom_versions + bom_validation | 用户打开 BOM Tab 时 | 同上 |
| labor + capital + packaging validation | 用户打开对应校验弹窗时 | 低频使用 |
| history + approvals | 用户打开归档页时 | 仅归档页需要 |

### 4.3 🟡 跨工作簿数据一致性校验

**现状**: BOM 中的零件号、协议价表中的零件号、TT 中的零件号之间没有交叉校验。G281 协议价表中有 70 个 `#N/A` 错误，正是因为 VLOOKUP 找不到对应零件号。

**建议**: 在 Python 提取阶段自动生成一致性报告：

```python
def cross_validate(bom_parts, protocol_parts, tt_parts):
    report = {
        'in_bom_not_in_protocol': bom_parts - protocol_parts,
        'in_protocol_not_in_bom': protocol_parts - bom_parts,
        'in_bom_not_in_tt': bom_parts - tt_parts,
    }
    # 写入 data/validation_report.json，程序启动时提醒用户
```

---

## 五、未来能力路线图

基于「通用高压线束成本分析工具」的定位：

| 阶段 | 能力 | 收益 |
|:---|:---|:---|
| **近期** | 成本结构可配置 + BOM 行级材料精算 + 年度差异化 | 精度从 ±3-5% → ±0.5% |
| **近期** | 多工厂费率体系 + 效率矩阵 | 支持转厂比价分析 |
| **中期** | 客户报价模拟层（废品率/管理费/利润率） | 从内部核算扩展到客户报价 |
| **中期** | 通用 BOM 提取框架 + 新项目向导 | 5 分钟内接入新项目 |
| **远期** | 金属价格实时接入 + 联动预警 | 实时成本监控 |
| **远期** | 多项目组合分析 + 产品线损益 | 从单项目到产品线级别 |

---

## 六、与 Notion 待办的关系

| Notion 待办 | 本报告建议 | 关系 |
|:---|:---|:---|
| Phase A: 基础设施串联 (~1h) | — | 前置条件，应先完成 |
| Phase B: CSS 拆分 (~4h) | — | 独立，可并行 |
| Phase C: #30 dashboard.js 拆分 (~9h) | §3.1 双路径合并可在此期间顺带做 | 协同 |
| Phase D: #31 新建项目向导 (~10.5h) | §1.4 向导数据采集清单补充 | 应纳入 |
| — | §1.1 成本结构 Schema 可配置 | **新增：核心通用化工作** |
| — | §2.1 BOM 行级材料精算 | **新增：最大精度提升项** |
| — | §2.2 年度差异化设备摊销 | **新增：消除 ±15% 年度偏差** |
| — | §2.4 客户报价验证层 | **新增：对应 ② 核算页功能** |

---

## 七、建议优先级

| 优先级 | 编号 | 优化项 | 预估工时 | 理由 |
|:---|:---|:---|:---|:---|
| **P0** | §2.1 | BOM 行级材料精算替代系数近似 | 12h | 最大精度提升，底层逻辑变更 |
| **P0** | §2.2 | 年度差异化成本计算 | 6h | 消除年度 ±15-30% 偏差 |
| **P0** | §1.1 | 成本结构 Schema 可配置 | 16h | 通用化核心，阻塞新项目接入 |
| **P1** | §2.4 | 客户报价模拟层 | 6h | ② 核算页功能完整性 |
| **P1** | §1.3 | 多工厂费率体系 | 8h | 工厂决策支持 |
| **P1** | §2.3 | 材料损耗从工时驱动改为材料驱动 | 2h | 逻辑正确性 |
| **P1** | §2.5 | 间接费用分摊方式可配置 | 4h | 线束利润拆分精度 |
| **P2** | §1.2 | BOM 分类规则正则+排除词 | 4h | 新客户 BOM 适配 |
| **P2** | §2.6 | 工厂效率矩阵建模 | 4h | 效率敏感性分析 |
| **P2** | §3.1 | computeModel 三级精度递进 | 12h | 可与 #30 协同 |
| **P2** | §3.2 | Shapley 因子可配置 | 4h | 新项目灵活性 |
| **P3** | §4.1 | Python 通用提取框架 | 16h | 新项目自动化接入 |
| **P3** | §3.4 | 增量计算引擎 | 12h | 性能优化 |
