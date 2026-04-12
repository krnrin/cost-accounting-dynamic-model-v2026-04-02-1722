# Issue #4 — engine.js 补丁指南

## 概述

将 `g281_engine.js` 中的硬编码材料系数和金属敏感度改为从 `ConfigBridge` 读取。

## 前置依赖

1. `core/config_loader.js` 已加载
2. `config/g281.project.json` 已加载到 ConfigLoader
3. `engine/config_bridge.js` 已加载
4. `engine/computation_path.js` 已加载

## HTML script 加载顺序

```html
<!-- 新增：在 g281_engine.js 之前加载 -->
<script src="core/config_loader.js"></script>
<script src="engine/config_bridge.js"></script>
<script src="engine/computation_path.js"></script>
<!-- 原有 -->
<script src="g281_engine.js"></script>
```

## 补丁 1：材料成本公式

### 原代码（computeModel 函数内，约第 780 行）

```javascript
const matBase = quoteBase.materialPerSet * (0.24 * connectorFactor + 0.38 * copperFactor + 0.18 * aluminumFactor + 0.20);
```

### 新代码

```javascript
// Issue #4: 从 projectConfig 读取材料成本组成系数
const mc = (root.ConfigBridge && root.ConfigBridge.materialComposition) 
  ? root.ConfigBridge.materialComposition() 
  : { connector: 0.24, copper: 0.38, aluminum: 0.18, other: 0.20 };
const matBase = quoteBase.materialPerSet * (
  mc.connector * connectorFactor + 
  mc.copper * copperFactor + 
  mc.aluminum * aluminumFactor + 
  mc.other
);
```

## 补丁 2：金属敏感度系数

### 原代码（computeModel 函数内，约第 770 行）

```javascript
const copperFactor = 1 + ((d.copperPrice - BASE.copperPrice) / BASE.copperPrice) * 0.65;
const aluminumFactor = 1 + ((d.aluminumPrice - BASE.aluminumPrice) / BASE.aluminumPrice) * 0.45;
```

### 新代码

```javascript
// Issue #4: 从 projectConfig 读取金属价格敏感度
const ms = (root.ConfigBridge && root.ConfigBridge.metalSensitivity)
  ? root.ConfigBridge.metalSensitivity()
  : { copper: 0.65, aluminum: 0.45 };
const copperFactor = 1 + ((d.copperPrice - BASE.copperPrice) / BASE.copperPrice) * ms.copper;
const aluminumFactor = 1 + ((d.aluminumPrice - BASE.aluminumPrice) / BASE.aluminumPrice) * ms.aluminum;
```

## 补丁 3：状态默认值

### 原代码（computeModel 函数开头）

```javascript
const currentState = {
  bom: state && state.bom ? state.bom : 'freeze',
  metal: state && state.metal ? state.metal : 'quote',
  // ... 其他硬编码默认值
};
```

### 新代码

```javascript
// Issue #4: 从 projectConfig 读取状态默认值
const sd = (root.ConfigBridge && root.ConfigBridge.stateDefaults)
  ? root.ConfigBridge.stateDefaults()
  : { bom: 'freeze', metal: 'quote', connector: 'quote', labor: 'base', 
      equipment: 'base', packaging: 'base', sales: 'quote', mix: 'quote',
      annualDrop: 'quote', oneTimeCustomer: 'quote', rebate: 'quote', vave: 'none' };
const currentState = {
  bom: state && state.bom ? state.bom : sd.bom,
  metal: state && state.metal ? state.metal : sd.metal,
  connector: state && state.connector && BASE.versions.connector[state.connector] ? state.connector : sd.connector,
  labor: state && state.labor ? state.labor : sd.labor,
  equipment: state && state.equipment ? state.equipment : sd.equipment,
  packaging: state && state.packaging ? state.packaging : sd.packaging,
  sales: state && state.sales ? state.sales : sd.sales,
  mix: state && state.mix ? state.mix : sd.mix,
  annualDrop: state && state.annualDrop ? state.annualDrop : sd.annualDrop,
  oneTimeCustomer: state && state.oneTimeCustomer ? state.oneTimeCustomer : sd.oneTimeCustomer,
  rebate: state && state.rebate ? state.rebate : sd.rebate,
  vave: state && state.vave ? state.vave : sd.vave,
};
```

## 补丁 4：计算路径标记

### 在 computeModel 返回对象中追加

```javascript
// 在 return { ... } 的末尾追加：
computationPath: (root.ComputationPath && root.ComputationPath.detect)
  ? root.ComputationPath.detect(/* this result */)
  : { path: 'estimated', label: '估算路径' },
```

> **注意**：由于 computeModel 返回时还没有最终 result 对象，
> 建议在 `computeModelV2` 末尾统一追加：

```javascript
// computeModelV2 末尾，return result 之前
result.computationPath = root.ComputationPath 
  ? root.ComputationPath.detect(result) 
  : { path: 'unknown', label: '未知' };
```

## 补丁 5：修复重复定义的 numberOr / approxEqual

### 问题

`numberOr` 和 `approxEqual` 在 IIFE 内各定义了 2 次，第二次覆盖第一次。
两个版本的 `approxEqual` 参数名不同（`epsilon` vs `tolerance`），行为一致但造成混淆。

### 修复

删除第二组定义（约第 500-520 行），保留第一组（约第 30-40 行）。
同时删除重复的 `arrayApproxEqual`（与 `arraysClose` 功能重复），统一使用 `arraysClose`。

## 验证清单

- [ ] 加载 `g281.project.json` 到 ConfigLoader
- [ ] 验证 `ConfigBridge.materialComposition()` 返回正确系数
- [ ] 验证 `ConfigBridge.metalSensitivity()` 返回正确系数
- [ ] 不加载 config 时，回退到硬编码值（兼容性）
- [ ] UI 显示计算路径标记（绿色 ✓精确 / 橙色 ≈估算）
- [ ] exactPath 和 estimatedPath 两种路径的计算结果与改造前一致
