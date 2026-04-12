# Issue #1 补丁指南：进度价 = 协议价差距追踪

## 核心纠正

**错误理解**：进度价 = 加权平均/混合价格
**正确理解**：进度价 = 协议价（签约锁定）与 当前批量价（实际采购）之间的差距追踪

```
协议价 20元 ─────────────── 目标线
                              ↑ 缺口 = +2元
批量价 22元 ─────────────── 实际线
```

## 需要修改的文件

### 1. `g281_engine.js`

#### 补丁 1：移除或注释旧的进度价加权混合逻辑

搜索关键词：`progressPrice` / `进度价` / `weighted` / `blended`

找到进度价计算位置，替换为：
```javascript
// --- Issue #1: 进度价 = 协议价差距追踪 ---
// 不再做加权混合，直接读取协议价和批量价，交由 ProgressPriceTracker 计算缺口
const progressTracker = global.G281ProgressPriceTracker;
if (progressTracker) {
  const progressItems = connectorItems.map(item => ({
    partNo: item.partNo,
    agreedPrice: item.agreedPrice || item.protocolPrice || 0,
    batchPrice: item.batchPrice || item.currentPrice || 0,
    quotePrice: item.quotePrice || 0,
    quantity: item.lifecycleQty || item.qty || 0,
    supplier: item.supplier || '',
    harnessId: item.harnessId || '',
    category: item.category || 'connector',
  }));
  const progressResult = progressTracker.trackBatch(progressItems);
  // 将 netGap 计入成本模型
  result.progressPriceGap = progressResult.summary.netGap;
  result.progressPriceDetail = progressResult;
}
```

### 2. `g281_profit_dashboard.js` / 跟踪页

#### 补丁 2：进度价面板展示

替换原有进度价展示为新格式：

```javascript
// 按供应商汇总
const supplierSummary = G281ProgressPriceTracker.groupSummary(
  progressResult.items, 'supplier'
);

// 渲染：每个供应商一行
// | 供应商 | 料号数 | 已落实 | 超标 | 净缺口 |
```

### 3. 跟踪页中的手工录入区

采购人员手工录入最新批量价：
```
料号 | 协议价(只读) | 当前批量价(可编辑) | 缺口(自动计算) | 状态
```

## 数据流

```
协议价(g281_data_connector_protocol_status.json)
  ↓
批量价(采购手工录入 / Excel 导入)
  ↓
ProgressPriceTracker.trackBatch()
  ↓
{ gap, status, totalGap } → 跟踪页展示 + engine 成本修正
```

## 测试清单

- [ ] 协议价=20, 批量价=22 → gap=+2, status=over
- [ ] 协议价=20, 批量价=20 → gap=0, status=achieved
- [ ] 协议价=20, 批量价=18 → gap=-2, status=under
- [ ] 按供应商分组汇总 netGap 正确
- [ ] 生命周期总金额缺口 = 单件缺口 × 用量
