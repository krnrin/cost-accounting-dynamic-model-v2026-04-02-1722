# Issue #2 补丁指南：残余材料池 = 变更取消料号呆滞提报

## 核心纠正

**错误理解**：未匹配料号 → 按数量分摊到残余材料池 → 加入产品成本
**正确理解**：未匹配 = 变更取消料号 → 走呆滞物料提报流程 → **不分摊到当前产品成本**

```
旧版 BOM 有 → 新版 BOM 无 = 变更取消
  ↓
检查有无库存
  ├── 有库存 → 呆滞提报 → 报废/退供/转售
  └── 无库存 → 台账记录

关键：保留导线信息（型号、供应商），以防后续又切换回来
```

## 需要修改的文件

### 1. `g281_harness_profit.js`

#### 补丁 1：移除残余材料池分摊逻辑

找到以下区域（约 L200-L250）：
```javascript
let residualMaterialPool = portfolio.materialCost - matchedWireTotal;
// ... 后续按比例分摊 ...
const harnessResidualShare = totalResidualBasis > 0
  ? numberOr(draftRow.residualBasis, 0) / totalResidualBasis
  : ...
```

替换为：
```javascript
// --- Issue #2: 未匹配料号不分摊到产品成本，走呆滞提报 ---
let residualMaterialPool = portfolio.materialCost - matchedWireTotal;
const stagnantPool = Math.max(residualMaterialPool, 0); // 记录但不分摊
residualMaterialPool = 0; // 不再分摊到线束成本

warnings.push(
  `残余材料池 ¥${stagnantPool.toFixed(2)} 为变更取消料号，不计入当前产品成本，请走呆滞提报流程。`
);
```

#### 补丁 2：导线级别成本不再包含残余分摊

找到 `unmatchedMaterialCost` 的计算：
```javascript
const unmatchedMaterialCost = !line.catalogMatched && unmatchedWireBasis > 0
  ? unmatchedWireAllocatedMaterial * ...
  : 0;
```

替换为：
```javascript
// --- Issue #2: 未匹配导线不分摊，标记为呆滞候选 ---
const unmatchedMaterialCost = 0; // 不再分摊
// 保留导线信息以防后续切换回来
```

#### 补丁 3：在 wireLines 输出中添加呆滞标记

在 `finalizedWireLines` 的 map 中添加：
```javascript
stagnantCandidate: !line.catalogMatched, // 呆滞候选标记
preservedWireInfo: !line.catalogMatched ? {
  catalogCode: line.catalogCode,
  catalogName: line.catalogName,
  partNumber: line.partNumber,
  partName: line.partName,
} : null,
```

### 2. `g281_bom_alignment_engine.js`（可选增强）

在 `alignBomReleases` 的返回结果中添加呆滞候选提取：
```javascript
const ResidualHandler = global.G281ResidualPoolHandler;
stagnantCandidates: ResidualHandler
  ? ResidualHandler.extractStagnantCandidates(result)
  : [],
```

### 3. 跟踪页

新增「呆滞物料」tab，显示：
```
| 料号 | 品名 | 线束 | 数量 | 库存状态 | 呆滞状态 | 操作 |
```

## 测试清单

- [ ] 未匹配料号不再计入产品成本
- [ ] 线束级利润率因移除残余分摊而提升
- [ ] 呆滞候选列表正确提取 left_only 行
- [ ] 后续变更恢复料号时自动标记 restored
- [ ] 导线信息保留完整（catalogCode、catalogName、partNumber）
