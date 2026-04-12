# projectConfig Schema 文档

## 概述

`projectConfig` 是多项目可复用架构的核心配置文件。每个项目一个 JSON 文件，驱动整个程序的行为。

## 字段说明

### 项目元数据

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `projectId` | string | ✅ | 唯一标识，用于 localStorage key、文件命名 |
| `projectName` | string | ✅ | 项目显示名称 |
| `customer` | string | | 客户名称 |
| `createdAt` | ISO 8601 | ✅ | 项目创建时间 |

### 受控基线 (`baseline`)

**⚠️ 变更管控对象：修改必须通过正式项目变更流程**

| 字段 | 类型 | 说明 |
|---|---|---|
| `baseline.version` | number | 基线版本号，每次变更 +1 |
| `baseline.lockedAt` | ISO 8601 | 基线锁定时间 |
| `baseline.lifecycle.startYear` | number | 生命周期起始年 |
| `baseline.lifecycle.years` | number | 生命周期年数 |
| `baseline.vehicleConfigs[]` | array | 车型配置列表 |
| `baseline.vehicleConfigs[].name` | string | 配置名称（如"高配"） |
| `baseline.vehicleConfigs[].ratio` | number | 配置占比（0-1，所有配置之和=1） |
| `baseline.vehicleConfigs[].harnesses` | string[] | 该配置包含的线束 ID 列表 |
| `baseline.annualVolumes[]` | array | 年产量阶梯 |
| `baseline.annualVolumes[].year` | number | 年份 |
| `baseline.annualVolumes[].volume` | number | 产量 |

### 线束定义 (`harnesses`)

| 字段 | 类型 | 说明 |
|---|---|---|
| `harnesses[].id` | string | 线束唯一 ID |
| `harnesses[].name` | string | 线束名称 |
| `harnesses[].partNumber` | string | 零件号 |
| `harnesses[].unit` | string | 单位（如 set、pcs） |

### 量纲定义 (`dimensions`)

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `currency` | string | CNY | 币种 |
| `currencySymbol` | string | ¥ | 币种符号 |
| `lengthUnit` | string | mm | 长度单位 |
| `weightUnit` | string | g | 重量单位 |
| `volumeUnit` | string | 套 | 产量单位 |
| `priceDecimalPlaces` | number | 4 | 单价精度 |
| `ratioDecimalPlaces` | number | 2 | 比率精度 |

### 材料成本组成 (`materialComposition`)

| 字段 | 类型 | 说明 |
|---|---|---|
| `connector` | number | 连接器占材料成本比例 |
| `copper` | number | 铜材占材料成本比例 |
| `aluminum` | number | 铝材占材料成本比例 |
| `other` | number | 其他材料占比 |

> 四项之和必须 = 1.00

### 金属价格敏感度 (`metalSensitivity`)

| 字段 | 类型 | 说明 |
|---|---|---|
| `copper` | number | 铜价变动对铜材成本的传导系数 |
| `aluminum` | number | 铝价变动对铝材成本的传导系数 |

> 系数 < 1，因为导线中金属只是原材料的一部分

### BOM 解析规则 (`bom`)

| 字段 | 类型 | 说明 |
|---|---|---|
| `sheetRoleMap[]` | array | Sheet 角色识别规则 |
| `endGroupAliases` | object | 端组别名映射（标准名 → 别名列表） |
| `itemClassificationKeywords` | object | 零件分类关键词 |
| `assemblyUnitKeyword` | string | 总成识别关键字（默认 set） |
| `headerMetaLayout` | object | BOM header 元数据在 sheet 中的位置 |
| `dataStartRow` | number | 数据起始行号 |
| `maxColumns` | number | 最大列数 |
| `fallbackRowCount` | number | 无 rowCount 时的回退扫描行数 |

### 成本要素 (`costElements`)

| 字段 | 类型 | 说明 |
|---|---|---|
| `costElements[].id` | string | 要素 ID |
| `costElements[].name` | string | 要素名称 |
| `costElements[].hasProtocolPrice` | boolean | 是否有协议价追踪 |
| `costElements[].hasMaterialCalc` | boolean | 是否有材料成本计算 |

### 其他

| 字段 | 类型 | 说明 |
|---|---|---|
| `nreCostTypes` | string[] | 一次性费用类别 |
| `stateDefaults` | object | 状态选择器默认值 |
| `storageKeyPrefix` | string | localStorage key 前缀 |
| `globalNamespacePrefix` | string | 全局命名空间前缀（如 G281） |
| `changeHistory[]` | array | 变更历史记录 |

## 变更管控

### 变更类型

| 类型 | 触发场景 | 影响 |
|---|---|---|
| `design` | BOM 结构调整、线束增减 | 材料成本 |
| `process` | 工时、包装、产线变化 | 加工成本 |
| `commercial` | 配置比例、年产量、生命周期 | 售价/利润 |

### 变更记录结构

```json
{
  "changeId": "CHG-001",
  "type": "design",
  "description": "新增出口配置",
  "baselineVersionBefore": 1,
  "baselineVersionAfter": 2,
  "changedFields": ["baseline.vehicleConfigs"],
  "changedBy": "张三",
  "changedAt": "2026-06-15T09:00:00Z",
  "approvedBy": "李四",
  "approvedAt": "2026-06-15T14:00:00Z"
}
```

## 使用方式

1. 新建项目时创建配置文件
2. 程序启动时加载配置
3. 所有模块通过 `projectConfig.xxx` 读取配置值
4. 修改 baseline 必须通过变更管控流程
