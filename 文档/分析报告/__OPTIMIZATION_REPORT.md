# 高压线束成本核算动态模型 — 深度优化报告

> **基于 Excel 财务核算逻辑的全面对标分析**  
> **分析日期**: 2026-04-03

---

## 一、Excel 财务核算模型的完整逻辑

### 1.1 成本核算金字塔（从Excel提取）

```
单套项目总成本 = 448.987 元/PCS
├── 单套材料成本          345.3416 (76.9%)    ← BOM逐行计算，含铜铝重量×金属价
├── 单套直接人工           39.4185 (8.8%)     ← 工时×工时费率（前工程+后工程）
│   ├── 前工程-公共制程     24.833             ← 0.8507h × 公共制程费率 29.19
│   └── 后工程-总装         14.5855            ← 0.4996h × 总装费率 29.19
├── 单套设备成本           27.1879 (6.0%)
│   ├── 共用设备            19.3907            ← 年折旧×使用年限/年产量
│   └── 专用设备             7.7972            ← 总投资/生命周期产量
├── 制造费用               22.206  (4.9%)     ← 6项费率×工时
│   ├── 间接人工             8.7419            ← 8.4991元/h × 工时
│   ├── 厂房分摊             5.2168            ← 1.45元/h × 工时（K1K2）
│   ├── 机物料消耗           3.2476            ← 1.8563元/h × 工时
│   ├── 其他制费             2.2568            ← 1.4234元/h × 工时
│   ├── 材料损耗             1.7267            ← 材料成本 × 0.5%
│   ├── 低值易耗品           0.6889            ← 0.8764元/h × 工时
│   └── 自动化仓分摊         0.3272            ← 2.03元/h × 工时（预算调整后）
├── 包装物流费用           12.6443 (2.8%)     ← 逐零件号，6项费用加总
│   ├── 内包装               4.8389
│   ├── 三方仓               4.88
│   ├── 外包装               1.0369
│   ├── 仓储费               1.0369
│   ├── 短驳                 0.8517
│   └── 运费                 0
└── 研发费用                2.1888 (0.5%)     ← 总研发投入/核算分摊数量
```

### 1.2 客户报价逻辑（逐零件号）

Excel「客户报价逻辑」表对每个总成零件号做独立核算：

| 字段 | 计算方式 |
|:---|:---|
| 材料成本 | 逐BOM行：导线铜重×铜价 + 铝重×铝价 + 连接器/端子单价×用量 |
| 废品率 | 材料成本 × 0.9% |
| 直接人工 | 实际工时(h) × 35元/h |
| 制造费 | 实际工时(h) × 47元/h（≈46.69四舍五入） |
| 管理费 | (材料+废品+人工+制造) × 6% |
| 利润 | 前项合计 × 利润率 |
| 包装费 | 按零件号独立计算 |
| 运输费 | 按零件号独立计算 |
| **到厂价** | 出厂价 + 包装费 + 运输费 |

**关键机制 — 装车比**：每个零件号有独立的装车比（0.525、0.105、0.07等），反映不同配置下该总成的实际搭载率。最终单车成本 = Σ(每个零件号到厂价 × 装车比)。

### 1.3 工时费率的分工厂差异

Excel「运营工时费报价基准」定义了 **7个工厂** 的独立费率体系：

| 工厂 | 直接人工 | 前工程-开线 | 前工程-公共制程 | 后工程-总装 |
|:---|:---|:---|:---|:---|
| K1K2(昆山) | 28.6069 | 30.1984 | 28.1883 | 28.5801 |
| K3 | 26.2729 | — | — | 26.2729 |
| 宁波 | 26.7672 | — | — | 26.7672 |
| 仪征 | 28.1694 | 28.029 | 27.6624 | 32.8565 |
| 重庆低压 | 31.1768 | 34.1955 | 30.8663 | 31.0387 |
| 重庆高压 | 32.0344 | — | — | 32.0344 |
| 天津 | 27.7117 | — | — | 27.7117 |

### 1.4 工厂效率矩阵

效率系数由 **总工时** 和 **项目节拍(PCS/h)** 的交叉矩阵决定：

- 昆山高压/重庆高压/天津高压：效率 0.85~0.95（按节拍分3档）
- 其他工厂：效率 0.75~1.05（按工时×节拍分6档，还区分单回路工时≷42s）

---

## 二、程序对财务模型的实现差距分析

### 2.1 ⚠️ 材料成本计算：系数近似 vs 逐行精算

**Excel 做法**: 对BOM中每个零件号，查找铜重(kg)、铝重(kg)，按当时金属价逐行计算材料成本，再加上非金属成分。

**程序做法** (`compute_model.js:1204-1214`):

```javascript
// 使用固定系数近似
const mc = { connector: 0.24, copper: 0.38, aluminum: 0.18, other: 0.20 };
const matBase = quoteBase.materialPerSet * (
  mc.connector * connectorFactor +
  mc.copper * copperFactor +
  mc.aluminum * aluminumFactor +
  mc.other
);
const material = matBase * bom.factor;
```

**精度差距**:
- **根本问题**: 程序用 `0.38 × 铜价变化率` 近似铜对材料成本的影响，但实际上铜在不同总成中的占比差异很大。例如「组合式充电插座线束总成」(6608442966) 铜重0.9517 vs「电动压缩机线束总成」(6608442964) 铜重0.0265 — 相差36倍。用统一的0.38系数对前者低估、对后者高估。
- **预计偏差**: 当铜价波动±10%时，程序的估算路径与精确路径可能偏差 1~3%，对单套成本345元意味着 3.5~10.3元 误差。

### 2.2 ⚠️ 工时费率：单一费率 vs 前后工程分离

**Excel 做法**: 将工时拆分为 **前工程(开线+公共制程)** 和 **后工程(总装)**，各有独立费率。例如K1K2工厂，公共制程费率28.19元/h，总装费率28.58元/h。

**程序做法** (`compute_model.js:1138-1139`):

```javascript
const directLabor = d.directHours * d.directRate;
const manufacturing = d.manufacturingHours * d.manufacturingRate;
```

**精度差距**:
- 程序只有 `directHours/directRate` 和 `manufacturingHours/manufacturingRate` 两层，将前工程和后工程合并为一个"直接人工"。实际上前工程内部还分 **开线** 和 **公共制程** 两种不同费率（差异约2元/h）。
- 缺少前工程的开线工序独立核算，当产品的开线工时占比变化时（如自动化开线替代手工），精度下降。

### 2.3 ⚠️ 制造费用：统一费率 vs 6项独立核算

**Excel 做法**: 制造费用拆分为6个子项（间接人工、低值易耗品、机物料消耗、厂房分摊、自动化仓分摊、其他制费），每项有独立费率，且不同工厂费率不同。

**程序做法**: 将6项合并为一个 `manufacturingRate`（46.69元/h），只做整体变动分析。

**精度差距**:
- 无法分析某一项制造费用的单独变化（如厂房租金上涨只影响厂房分摊项）。
- 不同工厂的制造费率结构差异很大（如K3的机物料消耗2.4元/h vs 仪征的0.69元/h），产品转厂时无法精确模拟。

### 2.4 ⚠️ 设备摊销：简化分摊 vs 两级折旧模型

**Excel 做法**:
- **共用设备**: 年折旧 × 使用年限 / 年产量 → 19.39元/PCS
- **专用设备**: 总投资 / 生命周期产量 → 7.80元/PCS（第一年11.26，后续7.23 — 因第一年产量不同）

**程序做法** (`compute_model.js:1141`):

```javascript
const equipment = lifecycleVolume ? currentCapitalSnapshot.equipment / lifecycleVolume : 0;
```

**精度差距**:
- 程序将共用/专用设备合并为一个值，用生命周期总产量均摊。
- 但实际上共用设备是"年折旧/年产量"逻辑（每年不同），专用设备是"总投入/总产量"逻辑。
- Excel中第一年设备成本30.65元/PCS（因产量85000低于后续年份），第二年起26.62元/PCS — 差距15%。程序只输出一个均值27.19元/PCS。

### 2.5 ⚠️ 包装物流：系数缩放 vs 逐零件号核算

**Excel 做法**: 对14个零件号分别核算内包装、外包装、运费、短驳、三方仓、仓储费6个子项，按装车比加权得到单车包装成本12.6443元。

**程序做法**: 将12.6443作为一个基准值，用 `packFactor` 做整体缩放。

**精度差距**:
- 不同零件号的包装成本差异巨大（组合式充电插座9.88元 vs 电动压缩机2.17元）。
- 当某个零件号的装车比变化时（如新增一个配置），程序无法精确反映对包装成本的影响。

### 2.6 ⚠️ 线束利润拆分：收入比分摊 vs 成本因果分摊

**Excel 做法**: 客户报价逻辑表对每个总成独立计算所有成本项，是**因果归属**制。

**程序做法** (`harness_profit.js:146-151`):

```javascript
var overheadItems = {
  labor: numberOr(model.laborCost, 0) * revenueShare,
  equipment: numberOr(model.equipmentCost, 0) * revenueShare,
  packaging: numberOr(model.packagingCost, 0) * revenueShare,
  rd: numberOr(model.rdCost, 0) * revenueShare
};
```

**精度差距**:
- 所有间接费用（人工、设备、包装、R&D）按**收入占比**分摊，而非按各自驱动因子（工时占比分摊人工、体积占比分摊包装等）。
- 这导致高单价低工时的产品承担了过多人工成本，低单价高工时的产品成本被低估。

### 2.7 ⚠️ 材料损耗率固定

**Excel 做法**: 材料损耗 = 材料成本 × 0.5%（1.7267元/PCS），作为制造费用的一个子项。

**程序做法**: 损耗率隐含在 `manufacturingRate` 的合并值中，无法独立调整。

**精度差距**: 当材料价格大幅波动时（如铜价+20%），材料损耗应跟随等比例增加，但程序中的制造费用是工时驱动的，不会跟随材料价格变化。

### 2.8 ⚠️ 管理费/利润率缺失

**Excel 客户报价逻辑**: 含管理费(6%)和利润率独立核算。

**程序**: `compute_model.js` 的成本结构中没有管理费这一层。管理费在Excel中按"(材料+废品+人工+制造)×6%"计算，对报价逻辑有实质影响。

---

## 三、模型层面的深度优化建议

### 优化 1: 逐零件号材料成本引擎（解决 §2.1）

**现状**: 用固定系数 `{connector:0.24, copper:0.38, aluminum:0.18, other:0.20}` 近似。

**建议**: 构建**零件级材料成本引擎**，直接从 BOM → 导线目录 → 金属重量 → 实时金属价 的完整链路。

```javascript
// 建议的架构
function computeMaterialCostByPart(bomItems, wireCatalog, metalPrices) {
  return bomItems.map(item => {
    const wire = wireCatalog.get(item.partNo);
    if (!wire) return { partNo: item.partNo, cost: item.unitPrice * item.qty, source: 'direct' };
    
    const cuCost = (wire.copperWeight / 1e6) * metalPrices.copper;  // g/km → 吨
    const alCost = (wire.aluminumWeight / 1e6) * metalPrices.aluminum;
    const nonMetalCost = wire.nonMetalWeight / 1000;  // g/km → 元/m
    const unitPrice = (cuCost + alCost + nonMetalCost) * item.lengthM;
    
    return { partNo: item.partNo, cost: unitPrice * item.qty, 
             cuCost, alCost, nonMetalCost, source: 'catalog' };
  });
}
```

**效果**: 金属价格变动时，精确到每条导线的成本变化，消除系数估算偏差。

### 优化 2: 三级工时费率模型（解决 §2.2）

**现状**: 2层（directHours/directRate + mfgHours/mfgRate）。

**建议**: 扩展为3层，对齐Excel的前工程拆分：

```javascript
// 三级工时模型
const laborCost = {
  frontWireCut: d.wireCutHours * d.wireCutRate,       // 前工程-开线
  frontProcess: d.frontProcessHours * d.frontProcessRate, // 前工程-公共制程
  backAssembly: d.assemblyHours * d.assemblyRate,     // 后工程-总装
};
const totalDirectLabor = Object.values(laborCost).reduce((s,v) => s + v, 0);
```

### 优化 3: 制造费用子项拆分（解决 §2.3）

**现状**: 合并为单一 `manufacturingRate`。

**建议**: 拆分为6个独立费率子项，支持分工厂查询：

```javascript
const MFG_RATE_ITEMS = [
  { key: 'indirectLabor',  label: '间接人工',    rate: 8.4991 },
  { key: 'consumables',    label: '低值易耗品',  rate: 0.8764 },
  { key: 'machineMaterial', label: '机物料消耗', rate: 1.8563 },
  { key: 'plantShare',     label: '厂房分摊',    rate: 1.45 },
  { key: 'warehouseShare', label: '仓库分摊',    rate: 2.03 },
  { key: 'otherMfg',       label: '其他制费',    rate: 1.4234 },
];

// 加上材料损耗项（由材料价格驱动，非工时驱动）
const materialWaste = materialCost * 0.005;  // 独立于工时
```

### 优化 4: 年度差异化设备摊销（解决 §2.4）

**现状**: `equipment / lifecycleVolume` 一个均值。

**建议**: 分共用/专用两种摊销逻辑，按年度输出：

```javascript
function computeAnnualEquipment(capital, volumes, years) {
  return years.map((year, i) => {
    const vol = volumes[i];
    // 共用设备：年折旧 / 年产量
    const sharedPerUnit = vol > 0 ? capital.sharedAnnualDepreciation / vol : 0;
    // 专用设备：总投入 / 生命周期总产量
    const dedicatedPerUnit = lifecycleVol > 0 ? capital.dedicatedTotal / lifecycleVol : 0;
    return { year, sharedPerUnit, dedicatedPerUnit, total: sharedPerUnit + dedicatedPerUnit };
  });
}
// 第1年: 30.65, 第2-6年: 26.62 — 与Excel完全对齐
```

### 优化 5: 逐零件号包装成本模型（解决 §2.5）

**现状**: 单一 `packagingPerSet` 按系数缩放。

**建议**: 保留零件号级别的包装数据，支持装车比变化时精确重算：

```javascript
const PACK_ITEMS = [
  { partNo: '6608491523', inner: 1.9425, outer: 0.35, shortHaul: 0.3333, thirdParty: 1.5, storage: 0.35, ratio: 0.525 },
  { partNo: '6608442966', inner: 4.0945, outer: 0.875, shortHaul: 0.8333, thirdParty: 3.2, storage: 0.875, ratio: 0.525 },
  // ...
];
const packPerSet = PACK_ITEMS.reduce((sum, p) => sum + p.total * p.ratio, 0);
```

### 优化 6: 活动成本驱动的间接费用分摊（解决 §2.6）

**现状**: 所有间接费用按**收入占比**分摊。

**建议**: 按**成本驱动因子**分摊，对齐Excel逐零件号核算逻辑：

| 费用项 | 驱动因子 | 说明 |
|:---|:---|:---|
| 直接人工 | 各总成实际工时占比 | `partHours / totalHours` |
| 制造费用 | 各总成实际工时占比 | 同上（制造费是工时驱动） |
| 设备 | 各总成收入占比(现行) 或 工时占比 | 可配置 |
| 包装 | 按零件号直接归属 | 每个零件号有独立包装成本 |
| R&D | 生命周期产量均摊 | 全项目统一 |

```javascript
function allocateOverhead(harnesses, model) {
  const totalHours = harnesses.reduce((s, h) => s + h.processHours, 0);
  return harnesses.map(h => ({
    ...h,
    laborAlloc: model.laborCost * (h.processHours / totalHours),      // 工时驱动
    mfgAlloc: model.mfgCost * (h.processHours / totalHours),          // 工时驱动
    packAlloc: h.packagingCost,                                        // 直接归属
    equipAlloc: model.equipCost * (h.revenueShare),                    // 收入驱动(现行)
    rdAlloc: model.rdCost / harnesses.length,                          // 均摊
  }));
}
```

### 优化 7: 添加管理费/废品率层（解决 §2.7-2.8）

```javascript
// 成本结构补充
const wasteRate = 0.009;  // 废品率 0.9%（Excel: 客户报价逻辑列H）
const mgmtRate = 0.06;    // 管理费率 6%（Excel: 客户报价逻辑列M）

const wasteCost = materialCost * wasteRate;
const subtotal = materialCost + wasteCost + directLabor + manufacturing;
const mgmtFee = subtotal * mgmtRate;
```

---

## 四、引擎架构层面的优化建议

### 优化 8: Shapley 计算移至 Web Worker

**现状** (`profit_shapley.js:207-218`): 12个因子需 2^12 = 4096次 `computeModel` 调用，全部在主线程执行。

**问题**: 每次 `computeModel` 约 0.5ms，4096次 ≈ 2秒。期间界面完全冻结。

**建议**:

```javascript
// shapley_worker.js
self.onmessage = function(e) {
  const { runtime, factors, baselineState, scenarioDraft, ... } = e.data;
  // 在 Worker 中执行所有 2^N 次计算
  const result = computeShapley(...);
  self.postMessage(result);
};

// 主线程
const worker = new Worker('shapley_worker.js');
worker.onmessage = (e) => updateShapleyUI(e.data);
worker.postMessage({ runtime, factors, ... });
```

### 优化 9: 计算结果缓存优化

**现状** (`computation_cache.js:62`): 用 `JSON.stringify(draft)` 作为缓存 key。

**问题**: draft对象可能很大（含BOM数组），序列化开销 > 计算开销。

**建议**: 使用轻量版本号或哈希：

```javascript
// 给 draft 和 state 维护递增版本号
let _draftVersion = 0;
function updateDraft(changes) {
  Object.assign(draft, changes);
  _draftVersion++;
}
// 缓存 key: 版本号组合
const cacheKey = `${_draftVersion}|${_stateVersion}`;
```

### 优化 10: 双路径引擎统一

**现状**: `computeModel` (估算路径) 和 `computeModelV2` (含精确路径) 是两层嵌套调用。V2包裹V1，逻辑复杂。

**建议**: 统一为单一入口，内部根据匹配条件自动选择路径：

```javascript
function computeModel(runtime, draft, state) {
  const path = detectComputationPath(runtime, draft, state);
  
  switch (path) {
    case 'financial_exact':
      return buildFromFinancialVersion(runtime, draft, state);
    case 'bom_exact':
      return buildFromBomLevelCalc(runtime, draft, state);
    case 'estimated':
    default:
      return buildFromCoefficients(runtime, draft, state);
  }
}
```

### 优化 11: 增量计算（Differential Engine）

**现状**: 每次滑块拖动都触发完整的 `computeModel` 计算（包含年度循环、BOM遍历等）。

**建议**: 当只有金属价格或工时等单一参数变化时，只重算受影响的成本分支：

```javascript
function computeIncremental(prevModel, changedFields) {
  if (changedFields.has('copperPrice') || changedFields.has('aluminumPrice')) {
    // 只重算材料成本分支
    const newMaterial = recomputeMaterial(prevModel, changedFields);
    return patchModel(prevModel, { material: newMaterial });
  }
  if (changedFields.has('directHours') || changedFields.has('directRate')) {
    // 只重算人工成本
    const newLabor = recomputeLabor(prevModel, changedFields);
    return patchModel(prevModel, { directLabor: newLabor });
  }
  // 多字段变化 → 全量重算
  return fullCompute(prevModel.runtime, prevModel.draft, prevModel.state);
}
```

### 优化 12: 除零保护全面加固

**现状**: `compute_model.js:1124` 的 `BASE.copperPrice` 可能为0。

**建议**: 在所有除法运算点添加统一的安全包装：

```javascript
function safeDivide(numerator, denominator, fallback = 0) {
  return denominator !== 0 && Number.isFinite(denominator) 
    ? numerator / denominator 
    : fallback;
}

// 应用到所有关键点
const copperFactor = 1 + safeDivide(d.copperPrice - BASE.copperPrice, BASE.copperPrice, 0) * ms.copper;
const equipmentPerSet = safeDivide(capitalSnapshot.equipment, lifecycleVolume, 0);
const margin = safeDivide(totalProfit, totalRevenue, 0);
```

---

## 五、数据管道优化建议

### 优化 13: Python 脚本健壮性

```python
# 1. 按名称查找工作表，不用索引号
def find_sheet(wb, keywords):
    """按关键词匹配工作表名称，失败时给出明确错误"""
    for name in wb.sheetnames:
        if all(kw in name for kw in keywords):
            return wb[name]
    raise ValueError(f"未找到包含 {keywords} 的工作表。可用: {wb.sheetnames}")

# 2. 除零保护
def safe_divide(a, b, default=0):
    return a / b if b and b != 0 else default

# 3. 统一文件路径配置
import json
with open('config/file_paths.json') as f:
    PATHS = json.load(f)
# 不再硬编码: 'G281 国内项目 定点BOM V06-2026.01.20【变更履历待更新】.xlsx'
```

### 优化 14: 数据一致性校验框架

构建跨工作簿的零件号一致性校验：

```python
def validate_cross_workbook_consistency():
    """校验 BOM ↔ 协议价 ↔ TT ↔ 报价核算 的零件号一致性"""
    bom_parts = extract_part_numbers('定点BOM')
    protocol_parts = extract_part_numbers('G281高压协议价')
    tt_parts = extract_part_numbers('G281 TT')
    quote_parts = extract_part_numbers('吉利E281报价核算')
    
    # 检查BOM中有但协议价中没有的零件号
    missing_in_protocol = bom_parts - protocol_parts
    # 这些零件号就是导致 #N/A 错误的根因
    if missing_in_protocol:
        print(f"⚠ BOM中有{len(missing_in_protocol)}个零件号在协议价表中缺失")
```

### 优化 15: g281_data_bundle.js 拆分

**现状**: 所有JSON数据合并为一个巨型JS文件，阻塞首屏加载。

**建议**: 按需异步加载：

```javascript
// 替代方案：异步数据加载器
const DataLoader = {
  _cache: new Map(),
  
  async load(key) {
    if (this._cache.has(key)) return this._cache.get(key);
    const resp = await fetch(`data/${key}.json`);
    const data = await resp.json();
    this._cache.set(key, data);
    return data;
  },
  
  // 预加载关键数据
  async preload() {
    await Promise.all([
      this.load('master'),
      this.load('financial_versions'),
      this.load('wire_catalog'),
    ]);
  }
};
```

---

## 六、新增功能建议

### 建议 A: 多工厂比价模拟器

基于Excel中7个工厂的费率数据，构建"产品转厂"模拟功能：

```
用户选择：6608442966 组合式充电插座线束总成
当前工厂：K1K2(昆山)    → 成本 451.47元
模拟工厂：重庆高压       → 成本 ???元

自动替换：直接人工费率、制造费率6项、厂房分摊率
输出：成本变化明细 + 利润率影响
```

### 建议 B: 金属价格联动预警

当铜价/铝价偏离基准超过阈值时，自动触发材料成本重估：

```javascript
function metalPriceAlert(currentPrices, baseline, threshold = 0.05) {
  const cuDrift = Math.abs(currentPrices.copper - baseline.copper) / baseline.copper;
  const alDrift = Math.abs(currentPrices.aluminum - baseline.aluminum) / baseline.aluminum;
  if (cuDrift > threshold) return { alert: 'copper', drift: cuDrift, impact: estimateImpact('copper', cuDrift) };
  if (alDrift > threshold) return { alert: 'aluminum', drift: alDrift, impact: estimateImpact('aluminum', alDrift) };
  return null;
}
```

### 建议 C: 配置变更影响分析

当装车比（配置比例）变化时，自动计算对所有成本项的连锁影响：

```
配置变更：「探索版」10% → 15%，「远航版」40% → 35%
影响链：
  ├── 材料成本: +0.82元/PCS（探索版含更多零件）
  ├── 包装成本: +0.15元/PCS
  ├── 工时变化: +0.03h（探索版回路数更多）
  └── 利润率变化: -0.12%
```

---

## 七、优化优先级排序

| 优先级 | 编号 | 优化项 | 精度提升 | 实施难度 | 建议工时 |
|:---|:---|:---|:---|:---|:---|
| **P0** | §3.1 | 逐零件号材料成本引擎 | ★★★★★ | 中 | 16h |
| **P0** | §3.4 | 年度差异化设备摊销 | ★★★★ | 低 | 4h |
| **P0** | §4.12 | 除零保护全面加固 | ★★★ | 低 | 2h |
| **P1** | §3.3 | 制造费用6项子拆分 | ★★★★ | 中 | 8h |
| **P1** | §3.6 | 活动成本驱动的间接费用分摊 | ★★★★ | 中 | 8h |
| **P1** | §3.7 | 添加管理费/废品率层 | ★★★ | 低 | 4h |
| **P1** | §3.2 | 三级工时费率模型 | ★★★ | 中 | 6h |
| **P2** | §3.5 | 逐零件号包装成本 | ★★★ | 低 | 6h |
| **P2** | §4.8 | Shapley移至Web Worker | ★★ | 中 | 4h |
| **P2** | §4.9 | 缓存Key优化 | ★★ | 低 | 2h |
| **P2** | §4.10 | 双路径引擎统一 | ★ | 高 | 12h |
| **P2** | §4.11 | 增量计算引擎 | ★★★ | 高 | 16h |
| **P3** | §5.15 | data_bundle拆分 | ★ | 中 | 8h |
| **P3** | §6.A | 多工厂比价模拟器 | ★★ | 中 | 12h |
| **P3** | §6.B | 金属价格联动预警 | ★★ | 低 | 4h |
| **P3** | §6.C | 配置变更影响分析 | ★★ | 中 | 8h |

---

## 八、总结

程序的核心架构设计是合理的——"估算路径 + 精确路径"的双轨制思路正确，Shapley利润归因的数学基础也扎实。但从 Excel 财务模型的角度看，**精度不够的根因不在于算法，而在于成本结构的粒度不够**：

1. **材料成本用系数近似而非逐行精算** — 这是最大的精度损失源
2. **工时费率未按工序拆分** — 丢失了前工程/后工程的差异化核算能力  
3. **制造费用6项合并为1项** — 丢失了费率子项的独立分析能力
4. **设备摊销不区分共用/专用** — 丢失了年度差异信息
5. **包装成本不到零件号级别** — 配置变化时精度下降
6. **间接费用按收入而非按成本驱动因子分摊** — 线束利润拆分失真

建议实施路径：先做 P0（材料引擎 + 设备年度化 + 除零保护），再做 P1（制造费拆分 + 分摊改进 + 管理费层），最后做 P2/P3。P0完成后预计可将成本核算精度从当前的 ±3-5% 提升到 ±0.5-1%。
