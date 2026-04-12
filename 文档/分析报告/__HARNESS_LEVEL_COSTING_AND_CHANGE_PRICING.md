# 单线束号级成本核算 & 变更报价逻辑 — 完整梳理与优化方案

> **分析日期**: 2026-04-03  
> **数据源**: 吉利E281定点核算.xlsx + 吉利E281报价核算.xlsx + 高压线束包总报价模板(定点).xls

---

## 第一部分：Excel 中的单线束号级核算逻辑

### 一、核算主体与装车比

Excel「客户报价逻辑」表以**单个零件号（线束号）**为核算主体，共11个零件号，分3个总成族：

| # | 零件号 | 名称 | 装车比 | 性质 |
|:--|:---|:---|:---|:---|
| 1 | 6608491523 | 直流母线总成 | 0.525 | 标配主力 |
| 2 | 6608491524 | 直流母线总成 | 0.105 | 选配 |
| 3 | 6608442962 | 直流母线总成 | 0.07 | 选配 |
| 4 | 6608544875 | 前驱直流母线总成 | 0.105 | 选配 |
| 5 | 6608442964 | 电动压缩机线束总成 | 0.595 | 标配主力 |
| 6 | 6608519100 | 电动压缩机线束总成 | 0.105 | 选配 |
| 7 | 6608442963 | 电动压缩机线束总成 | 0.03 | 选配 |
| 8 | 6608516992 | 电动压缩机线束总成 | 0.225 | 选配 |
| 9 | 6608442966 | 组合式充电插座线束总成 | 0.525 | 标配主力 |
| 10 | 6608442965 | 组合式充电插座线束总成 | 0.105 | 选配 |
| 11 | 6608507680 | 组合式充电插座线束总成 | 0.07 | 选配 |

**装车比含义**: 每台车中该零件号的搭载概率。同一总成族的多个零件号装车比之和 = 0.7（即该总成族在70%的车型配置上出现）。

### 二、每个线束号的成本核算公式链

Excel 对每个零件号**独立**计算以下全部项目：

```
┌─────────────────────────────────────────────────────────────┐
│  单线束号到厂价 = 出厂价 + 包装费 + 运输费                      │
│                                                              │
│  出厂价 = (材料 + 废品 + 人工 + 制造 + 管理费) × (1 + 利润率)    │
│         ↓        ↓       ↓       ↓        ↓          ↓       │
│         │        │       │       │        │          │       │
│         ▼        ▼       ▼       ▼        ▼          ▼       │
│   BOM逐行  材料×0.9%  工时×35  工时×47  前4项×6%   前5项×利润率  │
└─────────────────────────────────────────────────────────────┘
```

#### 2.1 材料成本 G列 — BOM 逐行累加

每个零件号有自己的**独立 BOM 子表**（在 KSK线束BOM明细 中按零件号A列分组）：

```python
# 伪代码
material_cost[harness_id] = 0
for bom_row in bom_items_for(harness_id):
    if bom_row.type == '导线':
        # 导线：铜重×铜价 + 铝重×铝价 + 非金属成本
        cu_cost = bom_row.copper_weight_per_km * bom_row.length_m / 1000 * copper_price_per_ton / 1000
        al_cost = bom_row.aluminum_weight_per_km * bom_row.length_m / 1000 * aluminum_price_per_ton / 1000
        non_metal = bom_row.non_metal_price_per_m * bom_row.length_m
        material_cost[harness_id] += cu_cost + al_cost + non_metal
    else:
        # 连接器/端子/辅料：单价×用量
        material_cost[harness_id] += bom_row.unit_price * bom_row.quantity
```

**实际数据举例** — 6608442966（组合式充电插座）:
- 铜重 = 69.361g → 0.069361kg → 材料成本 314.22元
- 铝重 = 951.74g → 0.95174kg
- 总材料 = 314.22元（最大的一个零件号）

对比 6608442964（电动压缩机）:
- 铜重 = 7.185g → 0.007185kg → 材料成本 42.23元

**关键**: 材料成本差异达 **7.4 倍**，不可能用统一系数近似。

#### 2.2 废品率 H列

```
废品 = 材料成本 × 0.9%
```

每个零件号独立计算，因为材料成本不同，废品金额也不同。

#### 2.3 直接人工 J列

```
直接人工 = 实际工时(h) × 35 元/h
```

- 工时来自 TT 表，每个零件号有独立的实际工时
- 35 元/h 是**对客户的报价费率**（≠内部运营费率29.19）

#### 2.4 制造费 K列

```
制造费 = 实际工时(h) × 47 元/h（实际 46.69 四舍五入）
```

同样以每个零件号的独立工时为基础。

#### 2.5 管理费 M列

```
管理费 = (材料 + 废品 + 直接人工 + 制造费) × 6%
```

#### 2.6 利润 N列

```
利润 = (材料 + 废品 + 直接人工 + 制造费 + 管理费) × 利润率
```

**关键**: 利润率在 `K20=46.69` 下方应该有定义，从数据推算：

```python
# 以 6608442966 为例
subtotal = 314.22 + 3.14 + 36.80 + 49.09 + 24.01 = 427.27
profit = 24.20
profit_rate = 24.20 / 427.27 = 5.66%
```

但这个利润率看起来不是固定值（各零件号的利润/前项合计比例略有差异），可能是倒推的。

#### 2.7 包装费/运输费 P/Q列

每个零件号有独立的包装费和运输费（来自「包装物流费用」表的逐零件号核算）。

#### 2.8 到厂价 R列

```
到厂价 = 出厂价 + 包装费 + 运输费
```

### 三、从单线束号汇总到项目级

**第17行**是项目级汇总：

```
项目单车成本 = Σ (每个零件号的到厂价 × 装车比)
```

实际数据验证：
```
= 138.26 × 0.525 + 137.88 × 0.105 + 150.68 × 0.07 + 166.20 × 0.105
  + 72.53 × 0.595 + 81.28 × 0.105 + 146.47 × 0.03 + 142.24 × 0.225
  + 461.34 × 0.525 + 454.05 × 0.105 + 479.97 × 0.07
= 526.63 元/车  ← 与 R17=526.631433 一致 ✓
```

### 四、两套报价体系的对照

Excel 中存在**两套平行的核算**：

| 维度 | 客户报价逻辑表（对外） | 运营工时费报价基准（对内） |
|:---|:---|:---|
| 人工费率 | 35 元/h | 28.19~32.03 元/h（按工厂/工序） |
| 制造费率 | 47 元/h（含全部制造费） | 拆分为 6 子项，合计 16.10~20.74 元/h |
| 管理费 | (材料+废品+人工+制造)×6% | 不单独列示 |
| 利润率 | 约 5.6% | 不含利润（纯成本） |
| 作用 | 报给客户的到厂价 | 内部利润分析 |

**项目评估汇总表**用的是**内部费率**（29.19 元/h），与客户报价逻辑表（35 元/h）的口径不同。这两套是并行的：
- 内部核算：判断项目实际盈利能力
- 客户报价：决定报给客户的价格

---

## 第二部分：变更报价逻辑

### 一、吉利的标准变更报价框架

从「高压线束包总报价模板(定点).xls」的「价格汇总」表提取的报价结构：

```
总到厂价 = 出厂价(不含分摊) + 分摊费用
          = [A1+A2+B1+B2+C1+C2+C3+D] + [E1+E2+F1+F2+G1+G2]

其中：
A1 = 原材料成本       ← BOM 变更时调整
A2 = 外购件成本       ← 供应商变价/替代时调整
B1 = 加工费用(制造费) ← 工时变更时调整
B2 = 废品损失         ← 跟随 A1+A2 联动
C1 = 管理费用         ← 按 (A1+A2+B1+B2) × 比率%
C2 = 财务费用         ← 按 (A1+A2+B1+B2) × 比率%
C3 = 销售费用         ← 按 (A1+A2+B1+B2) × 比率%
D  = 利润             ← 按 (A1+A2+B1+B2) × 利润比率%
E1 = 借用工装费用(分摊)
E2 = 新开工装费用(分摊)
F1 = 借用试验费用(分摊)
F2 = 新开试验费用(分摊)
G1 = 借用研发费用(分摊)
G2 = 新开研发费用(分摊)  ← 一次性费用按量分摊到零件单价
```

**关键细节**：
- 管理/财务/销售费率都是 4%（统一比率）
- 利润率也是 4%
- 一次性费用（工装/试验/研发）按「分摊量」摊到单件

### 二、变更触发场景与报价调整规则

从两份核算表（报价版 vs 定点版）的差异中推导出变更逻辑：

#### 场景 1: BOM 变更（设计变更导致材料变化）

```
变更影响链:
  材料成本变化 → 废品率联动(×0.9%) → 管理费联动(×6%) → 利润联动 → 出厂价变化

锁定项:
  工时不变（除非设计变更影响了装配难度）
  包装/运输不变（除非零件尺寸变化）
  工装/试验/研发分摊不变（除非需要新开模具）

报价要求:
  ① 逐BOM行列出变更前/后的物料及单价
  ② 计算材料差异金额
  ③ 管理费/利润按比率联动（不重新谈判比率）
```

**实际案例** — 6608516992 报价版 vs 定点版:
```
报价版材料: 64.256 元 → 定点版材料: 81.256 元 (差异 +17.0 元)
原因: 某个连接器从询价变为批量价，或 BOM 增加了物料
到厂价: 123.02 → 142.24 (差异 +19.22 元 — 含管理费/利润联动)
```

#### 场景 2: 金属价格联动（铜价/铝价变化）

```
变更影响链:
  铜价变化 → 导线中的铜成本变化 → 材料总成本变化 → 废品联动 → 管理费联动 → 利润联动

关键机制:
  ① 只有导线中的金属部分跟随联动，非金属部分不变
  ② 连接器/端子/辅料不受金属联动影响
  ③ 每个零件号的金属占比不同，联动金额不同

计算方式（每个零件号独立）:
  Δ材料 = Σ(导线行: Δ铜价 × 铜重 + Δ铝价 × 铝重)
  Δ废品 = Δ材料 × 0.9%
  Δ管理费 = (Δ材料 + Δ废品) × 6%
  Δ利润 = (Δ材料 + Δ废品 + Δ管理费) × 利润率
  Δ到厂价 = Δ材料 + Δ废品 + Δ管理费 + Δ利润
```

#### 场景 3: 工时变更（工艺改进/自动化升级）

```
变更影响链:
  工时变化 → 直接人工变化 → 制造费变化 → 管理费联动 → 利润联动

锁定项:
  材料成本不变
  包装/运输不变

计算方式:
  Δ人工 = Δ工时 × 35 元/h
  Δ制造 = Δ工时 × 47 元/h
  Δ管理费 = (Δ人工 + Δ制造) × 6%
  Δ利润 = (Δ人工 + Δ制造 + Δ管理费) × 利润率
```

#### 场景 4: 配置变更（装车比调整）

```
变更影响链:
  装车比变化 → 单车加权成本变化 → 年度收入/成本变化 → 项目利润率变化

无需重报单件价格:
  每个零件号的到厂价不变
  只是加权汇总后的单车成本变化

但影响:
  年度产量分配变化（某些零件号量增/量减）
  设备/工装分摊量变化 → 可能触发分摊单价重算
```

#### 场景 5: 年降（Annual Price Reduction）

```
客户要求每年降价:
  第N年到厂价 = 基准到厂价 × (1 - 年降率)^(N-1)

内部影响:
  收入减少但成本不变 → 利润率逐年下降
  需要用 VAVE（价值工程）来对冲年降压力
```

### 三、变更报价的完整流程

```
1. 触发
   └─ 客户发起设变通知 / 金属价格触发联动条款 / 年度价格审查

2. 影响评估（逐零件号）
   ├─ 哪些零件号受影响？
   ├─ 每个受影响零件号的成本变化多少？
   └─ 是否触发工装/试验/研发新增投入？

3. 报价计算（逐零件号独立）
   ├─ 变更前: 使用「定点版」数据作为基准
   ├─ 变更后: 替换变化项，联动计算管理费/利润
   └─ 差异: 逐项列示变更前后差异

4. 汇总
   ├─ 项目级: Σ(变更后到厂价 × 装车比)
   ├─ 年度影响: 产量 × 单车差异
   └─ 生命周期影响: 各年度加总

5. 审批
   └─ 内部审批 → 客户确认 → 生效
```

---

## 第三部分：程序的实现差距分析

### 差距 1: 核算颗粒度 — 项目级 vs 线束号级

| 维度 | Excel 逻辑 | 程序现状 (`compute_model.js`) | 差距 |
|:---|:---|:---|:---|
| **材料成本** | 11个零件号各自BOM逐行算 | 项目级系数近似 `materialPerSet × coefficients` | 🔴 完全缺失零件号级 |
| **直接人工** | 11个零件号各自工时×费率 | 项目级 `directHours × directRate` | 🔴 缺失零件号级 |
| **制造费** | 11个零件号各自工时×47 | 项目级 `mfgHours × mfgRate` | 🔴 缺失零件号级 |
| **废品率** | 每个零件号: 材料×0.9% | 不存在 | 🔴 完全缺失 |
| **管理费** | 每个零件号: 前4项×6% | 不存在 | 🔴 完全缺失 |
| **利润** | 每个零件号: 前5项×利润率 | 不存在（只算内部毛利） | 🔴 完全缺失 |
| **包装** | 11个零件号独立6项 | 项目级 `packInner+packFreight+...` | 🔴 缺失零件号级 |
| **到厂价** | 出厂价+包装+运输 | 不存在 | 🔴 完全缺失 |
| **汇总** | Σ(到厂价×装车比) | 项目级直接计算 | 方向相反 |

### 差距 2: harness_profit.js 的定位偏差

`harness_profit.js` 试图做线束级拆分，但逻辑是**反向的**：

```
现状:  项目总成本 → 按 revenueShare 切割 → 每条线束的"分摊成本"
应该:  每条线束独立核算 → 汇总得到项目总成本
```

具体问题：
1. **材料成本**: 只匹配了导线部分 (`buildMatchedWireCost`)，**连接器/端子/辅料完全遗漏**
2. **间接成本**: 人工/设备/包装/R&D 全部按 `revenueShare` 分摊 — 但每个零件号有自己的工时和包装数据
3. **没有客户报价层**: 缺少废品率、管理费、利润率的计算

### 差距 3: 变更报价 — 完全缺失

程序有 `financialVersions`（报价版/定点版）和 `bomChanges` 概念，但：
- 只做了**整体版本切换**（估算路径 vs 精确路径）
- **没有逐零件号的变更前/后对比**
- **没有变更金额的自动计算和联动**
- **没有生成客户报价单的能力**

---

## 第四部分：优化方案

### 方案概述

```
当前架构:
  computeModel() → 项目级成本 → harness_profit.js 反向拆分

目标架构:
  harnessEngine() → 逐零件号独立核算 → 汇总到项目级
                  → 变更对比引擎 → 生成客户报价
```

### 优化 1: 构建线束号级核算引擎

新增 `engine/harness_costing.js`，每个零件号独立核算全部成本项：

```javascript
/**
 * engine/harness_costing.js
 * 单线束号级成本核算引擎
 * 
 * 核算粒度: 零件号（线束号）
 * 输入: BOM明细 + 工时 + 费率 + 装车比
 * 输出: 每个零件号的完整成本分解 + 客户报价 + 项目汇总
 */
function computeHarnessCost(harnessConfig, params) {
  const { harnessId, bomItems, processHours, vehicleRatio } = harnessConfig;
  const { metalPrices, laborRate, mfgRate, wasteRate, mgmtRate, profitRate,
          wireCatalog, packagingData } = params;
  
  // ── 1. 材料成本: BOM逐行计算 ──
  let materialCost = 0;
  let copperCost = 0, aluminumCost = 0, nonMetalCost = 0, componentCost = 0;
  const bomDetails = [];
  
  for (const item of bomItems) {
    const wireEntry = wireCatalog?.get(item.partNo);
    
    if (wireEntry) {
      // 导线类: 金属重量 × 金属价
      const cuWeight = (wireEntry.copperWeightPerKm || 0) * (item.lengthM || 0) / 1000; // kg
      const alWeight = (wireEntry.aluminumWeightPerKm || 0) * (item.lengthM || 0) / 1000;
      const cuCostLine = cuWeight * metalPrices.copper;
      const alCostLine = alWeight * metalPrices.aluminum;
      const nonMetalLine = (wireEntry.nonMetalPricePerM || 0) * (item.lengthM || 0);
      const lineCost = (cuCostLine + alCostLine + nonMetalLine) * (item.qty || 1);
      
      copperCost += cuCostLine * (item.qty || 1);
      aluminumCost += alCostLine * (item.qty || 1);
      nonMetalCost += nonMetalLine * (item.qty || 1);
      materialCost += lineCost;
      bomDetails.push({ ...item, type: 'wire', cuCost: cuCostLine, alCost: alCostLine, lineCost });
    } else {
      // 连接器/端子/辅料: 单价 × 用量
      const lineCost = (item.unitPrice || 0) * (item.qty || 1);
      componentCost += lineCost;
      materialCost += lineCost;
      bomDetails.push({ ...item, type: 'component', lineCost });
    }
  }
  
  // ── 2. 废品 ──
  const wasteCost = materialCost * wasteRate;
  
  // ── 3. 直接人工 ──
  const directLabor = processHours * laborRate;
  
  // ── 4. 制造费 ──
  const manufacturing = processHours * mfgRate;
  
  // ── 5. 管理费 ──
  const subtotal = materialCost + wasteCost + directLabor + manufacturing;
  const mgmtFee = subtotal * mgmtRate;
  
  // ── 6. 利润 ──
  const profit = (subtotal + mgmtFee) * profitRate;
  
  // ── 7. 出厂价 ──
  const exFactoryPrice = subtotal + mgmtFee + profit;
  
  // ── 8. 包装 + 运输 ──
  const pack = packagingData?.[harnessId] || { inner: 0, outer: 0, freight: 0,
    shortHaul: 0, thirdParty: 0, storage: 0 };
  const packTotal = pack.inner + pack.outer + pack.freight + pack.shortHaul
    + pack.thirdParty + pack.storage;
  
  // ── 9. 到厂价 ──
  const deliveredPrice = exFactoryPrice + packTotal;
  
  return {
    harnessId,
    vehicleRatio,
    // 成本明细
    materialCost,
    materialBreakdown: { copperCost, aluminumCost, nonMetalCost, componentCost },
    wasteCost,
    directLabor,
    manufacturing,
    mgmtFee,
    profit,
    exFactoryPrice,
    packTotal,
    packBreakdown: pack,
    deliveredPrice,
    // 金属敏感度（用于变更报价联动）
    copperWeight: copperCost / metalPrices.copper,  // kg
    aluminumWeight: aluminumCost / metalPrices.aluminum,
    // BOM明细
    bomDetails,
    processHours,
    // 加权贡献
    weightedDeliveredPrice: deliveredPrice * vehicleRatio,
  };
}

/**
 * 项目级汇总: 从线束号汇总到单车成本
 */
function computeProjectFromHarnesses(harnessResults) {
  const project = {
    harnesses: harnessResults,
    vehicleCost: 0,
    totalMaterial: 0,
    totalLabor: 0,
    totalMfg: 0,
    totalPack: 0,
    weightedCopperWeight: 0,
    weightedAluminumWeight: 0,
  };
  
  for (const h of harnessResults) {
    project.vehicleCost += h.deliveredPrice * h.vehicleRatio;
    project.totalMaterial += h.materialCost * h.vehicleRatio;
    project.totalLabor += h.directLabor * h.vehicleRatio;
    project.totalMfg += h.manufacturing * h.vehicleRatio;
    project.totalPack += h.packTotal * h.vehicleRatio;
    project.weightedCopperWeight += h.copperWeight * h.vehicleRatio;
    project.weightedAluminumWeight += h.aluminumWeight * h.vehicleRatio;
  }
  
  return project;
}
```

### 优化 2: 构建变更报价引擎

新增 `engine/change_pricing.js`，实现变更前/后自动对比和联动计算：

```javascript
/**
 * engine/change_pricing.js
 * 变更报价引擎
 * 
 * 支持场景:
 *   1. BOM变更 — 物料增减/替代/单价变化
 *   2. 金属联动 — 铜价/铝价变化
 *   3. 工时变更 — 工艺改进/自动化
 *   4. 配置变更 — 装车比调整
 *   5. 年降 — 年度降价
 */

/**
 * 对比两个版本，生成逐零件号的变更报价明细
 */
function computeChangePricing(baseVersion, newVersion, changeType) {
  const changes = [];
  
  // 找出所有涉及的零件号（合集）
  const allHarnessIds = new Set([
    ...baseVersion.harnesses.map(h => h.harnessId),
    ...newVersion.harnesses.map(h => h.harnessId),
  ]);
  
  for (const id of allHarnessIds) {
    const base = baseVersion.harnesses.find(h => h.harnessId === id);
    const curr = newVersion.harnesses.find(h => h.harnessId === id);
    
    if (!base && curr) {
      // 新增零件号
      changes.push({
        harnessId: id,
        changeType: 'add',
        before: null,
        after: curr,
        delta: buildDelta(null, curr),
      });
    } else if (base && !curr) {
      // 删除零件号
      changes.push({
        harnessId: id,
        changeType: 'remove',
        before: base,
        after: null,
        delta: buildDelta(base, null),
      });
    } else if (base && curr) {
      // 变更
      const delta = buildDelta(base, curr);
      if (delta.deliveredPrice !== 0) {
        changes.push({
          harnessId: id,
          changeType: detectChangeType(base, curr, changeType),
          before: base,
          after: curr,
          delta,
        });
      }
    }
  }
  
  return {
    changes,
    summary: {
      totalBefore: baseVersion.vehicleCost,
      totalAfter: newVersion.vehicleCost,
      totalDelta: newVersion.vehicleCost - baseVersion.vehicleCost,
      affectedCount: changes.length,
      changeType,
    },
    // 年度影响
    annualImpact: computeAnnualImpact(
      newVersion.vehicleCost - baseVersion.vehicleCost,
      newVersion.annualVolumes || baseVersion.annualVolumes
    ),
  };
}

function buildDelta(before, after) {
  const b = before || zeroCost();
  const a = after || zeroCost();
  return {
    materialCost: a.materialCost - b.materialCost,
    wasteCost: a.wasteCost - b.wasteCost,
    directLabor: a.directLabor - b.directLabor,
    manufacturing: a.manufacturing - b.manufacturing,
    mgmtFee: a.mgmtFee - b.mgmtFee,
    profit: a.profit - b.profit,
    exFactoryPrice: a.exFactoryPrice - b.exFactoryPrice,
    packTotal: a.packTotal - b.packTotal,
    deliveredPrice: a.deliveredPrice - b.deliveredPrice,
  };
}

/**
 * 金属联动专用: 只替换金属价格，其余不变
 */
function computeMetalEscalation(baseHarnesses, newMetalPrices, params) {
  // 用新金属价格重算每个零件号的材料成本
  const newResults = baseHarnesses.map(h => {
    return computeHarnessCost(
      { ...h, bomItems: h.bomDetails },  // 用原始BOM，替换金属价
      { ...params, metalPrices: newMetalPrices }
    );
  });
  return computeChangePricing(
    computeProjectFromHarnesses(baseHarnesses),
    computeProjectFromHarnesses(newResults),
    'metal_escalation'
  );
}
```

### 优化 3: 对内核算层（保留现有 compute_model.js 的增强）

`computeModel` 的对内核算仍然需要，但应改为从线束号级引擎汇总而非独立计算：

```javascript
// 增强 computeModel — 在精确路径中集成线束号级引擎
function computeModelV3(runtime, draft, state) {
  // 如果有完整 BOM + 工时数据，走线束号级精算
  if (runtime.harnessBomData && runtime.harnessProcessHours) {
    const harnessResults = runtime.harnessBomData.map(h =>
      computeHarnessCost(h, {
        metalPrices: { copper: d.copperPrice, aluminum: d.aluminumPrice },
        laborRate: d.directRate,
        mfgRate: d.manufacturingRate,
        wasteRate: 0.009,
        mgmtRate: 0.06,
        profitRate: projectConfig.profitRate || 0.04,
        wireCatalog: runtime.wireCatalog,
        packagingData: runtime.packagingByHarness,
      })
    );
    
    const project = computeProjectFromHarnesses(harnessResults);
    
    // 用线束级汇总替代系数近似
    result.material = project.totalMaterial;
    result.directLabor = project.totalLabor;
    result.manufacturing = project.totalMfg;
    result.packaging = project.totalPack;
    result.harnessDetail = harnessResults;  // 供 UI 展示
    
    // 内部核算层: 用内部费率重算（区别于客户报价费率）
    result.internalLabor = project.totalLabor * (internalRate / customerRate);
    // ...
  } else {
    // 回退到现有系数近似路径
    // ...（现有逻辑不变）
  }
}
```

### 优化 4: 数据结构扩展

`harnessDrafts` 需要从当前的"简单线束行"扩展为完整的核算单元：

```javascript
// 当前 harnessDrafts 结构
{
  harnessId: "6608442966",
  revenueShare: 0.35,
  wireItems: [{ partNo: "...", qty: 1 }]
}

// 目标结构
{
  harnessId: "6608442966",
  harnessName: "组合式充电插座线束总成",
  vehicleRatio: 0.525,           // 装车比
  processHours: 1.051503,         // 实际总工时(h)
  processBreakdown: {             // 工时拆分
    wireCut: 0.15,                // 开线
    frontProcess: 0.35,           // 公共制程
    assembly: 0.55,               // 总装
  },
  bomItems: [                     // 完整BOM（含连接器/端子/辅料）
    { partNo: "FHLALR2G...", type: "wire", lengthM: 7.21, qty: 1 },
    { partNo: "HVPC2P160...", type: "connector", unitPrice: 29, qty: 4 },
    { partNo: "HS-125...", type: "auxiliary", unitPrice: 0.0879, qty: 8 },
  ],
  packaging: {                    // 独立包装数据
    inner: 2.1725, outer: 0.875, freight: 0.8333,
    shortHaul: 0, thirdParty: 3.2, storage: 0.875,
  },
}
```

### 优化 5: UI 展示层变更

在「② 核算」页面增加：

```
1. 线束号级成本分解表
   ┌──────────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┐
   │ 零件号    │ 材料  │ 废品  │ 人工  │ 制造  │ 管理  │ 利润  │ 包装  │ 到厂价│
   ├──────────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┤
   │ 660849... │ 88.07│ 0.88 │13.09 │17.46 │ 7.12 │ 7.17 │ 4.48 │138.26│
   │ 660844... │314.22│ 3.14 │36.80 │49.09 │24.01 │24.20 │ 9.88 │461.34│
   │ ...       │ ...  │ ...  │ ...  │ ...  │ ...  │ ...  │ ...  │ ...  │
   ├──────────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┤
   │ 加权合计   │345.34│ 3.45 │47.26 │63.05 │27.34 │27.55 │12.64 │526.63│
   └──────────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┘

2. 变更对比面板
   ┌──────────┬──────────┬──────────┬──────────┐
   │ 零件号    │ 定点价    │ 变更后    │ 差异      │
   ├──────────┼──────────┼──────────┼──────────┤
   │ 660851...│ 142.24   │ 123.02   │ -19.22   │ ← BOM变更
   │ 其他      │ 不变     │ 不变     │  0       │
   ├──────────┼──────────┼──────────┼──────────┤
   │ 单车影响   │ 526.63  │ 522.31   │ -4.32    │
   └──────────┴──────────┴──────────┴──────────┘
```

---

## 第五部分：实施路径

| 阶段 | 工作内容 | 依赖 | 预估工时 |
|:---|:---|:---|:---|
| **Phase 1** | `engine/harness_costing.js` 基础框架 | 无 | 8h |
| **Phase 1** | 扩展 `harnessDrafts` 数据结构（含完整BOM+工时+包装） | 无 | 4h |
| **Phase 1** | Python 提取脚本增加逐零件号的工时/包装提取 | Phase 1 数据结构 | 6h |
| **Phase 2** | `engine/change_pricing.js` 变更报价引擎 | Phase 1 | 8h |
| **Phase 2** | 金属联动模块 (`computeMetalEscalation`) | Phase 1 | 4h |
| **Phase 2** | 集成到 `computeModelV3` — 线束级精算替代系数近似 | Phase 1 | 6h |
| **Phase 3** | UI: 线束号级成本分解表 | Phase 2 | 6h |
| **Phase 3** | UI: 变更对比面板 | Phase 2 | 6h |
| **Phase 3** | UI: 客户报价单导出（按吉利模板格式） | Phase 2 | 8h |
| **验证** | 用 E281 数据端到端验证，对齐 Excel 计算结果 | Phase 3 | 4h |
| **合计** | | | **60h** |
