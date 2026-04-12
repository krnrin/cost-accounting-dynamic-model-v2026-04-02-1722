# Round 3 复盘 — 剩余本地修复项

> Round 3 共发现 7 个问题 (#22–#28)。
> 其中 **#22、#24、#25、#26 已远程推送修复**。
> 以下 3 个需要本地修复。

---

## #23 — pricingStore.ts: Map + Zustand persist 数据丢失风险 🟠

**问题：** `connectorPricing`、`wirePricing`、`devPartPricing`、`auxiliaryPricing` 使用 `Map<string, T>`，但 Zustand `persist` 用 `JSON.stringify` 序列化 Map 得到 `{}`。虽然 `partialize` 排除了这些字段，但刷新后 Map 为空，若消费页面未重新调用 `loadPricingData` 会拿到空数据。

**修复方案（任选一）：**

### 方案 A：改 Map 为 Record（推荐，最简单）
```diff
// pricingStore.ts
- connectorPricing: Map<string, ConnectorPricingRecord>,
+ connectorPricing: Record<string, ConnectorPricingRecord>,
```
所有 `.get(partNo)` → `[partNo]`，`.set(partNo, x)` → `{ ...state, [partNo]: x }`，`.has()` → `partNo in xxx`。
涉及约 20 处改动，需同步修改所有消费方。

### 方案 B：确保消费方总是先 load
在每个使用 pricing Map 的页面（HarnessEditPage、QuotePage、BomWorkbookPage 等）的 `useEffect` 中确保调用 `loadPricingData(projectId, scenarioId)`。

### 方案 C：自定义 persist storage 支持 Map
```ts
import superjson from 'superjson';
persist(..., {
  storage: {
    getItem: (name) => {
      const str = localStorage.getItem(name);
      return str ? superjson.parse(str) : null;
    },
    setItem: (name, value) => localStorage.setItem(name, superjson.stringify(value)),
    removeItem: (name) => localStorage.removeItem(name),
  },
})
```

---

## #27 — ProjectListPage.tsx: 废弃 Project.config 仍被写入 🟡

**问题：** `types/project.ts` 中 `Project.config` 标注 `@deprecated 已移至 ScenarioRecord.config`，但 `mapApiProjectToRecord` 仍给新项目填充完整 `config`。不是 bug（向后兼容），但与类型声明矛盾。

**修复方案：**
```diff
// ProjectListPage.tsx — mapApiProjectToRecord
function mapApiProjectToRecord(project: ApiProject): ProjectRecord {
  return {
    id: project.id,
    meta: { ... },
-   config: {
-     costRates: project.costRates ?? { ... },
-     metalPrices: project.metalPrices ?? { ... },
-     volumes: project.volumes ?? [],
-     annualDropRate: 0,
-   },
+   // config is deprecated — lives on ScenarioRecord since v7
+   // Only kept as minimal fallback for legacy code paths
+   config: undefined,
  };
}
```

⚠️ 注意：如果其他代码还直接读 `project.config`，删除会导致 crash。先全局搜索 `project.config` 确认安全再改。

---

## #28 — ScenarioSelector.tsx: as any 类型断言 🟡

**问题：** `onChange={handleChange as any}` 绕过了 Semi UI Select 的类型检查。

**修复方案：**
```diff
- const handleChange = (newSid: string) => {
+ const handleChange = (newSid: string | number | Record<string, any> | (string | number)[]) => {
+   if (typeof newSid !== 'string') return;
    if (newSid === sid) return;
    ...
  };

- onChange={handleChange as any}
+ onChange={handleChange}
```

⚠️ 此文件含 `style=...` 内联样式（被 Notion 压缩），无法远程推送。

---

## 三轮复盘完整状态总览

| # | 严重度 | 文件 | 问题 | 状态 |
|---|---|---|---|---|
| 1-9 | 混合 | 5 files | Round 1 | ✅ PR #58 Batch 1 |
| 10-21 | 混合 | 4 page files | Round 2 | 📋 REVIEW-FIXES-BATCH2.md |
| **22** | 🔴 | useDashboardData.ts | sc! crash | ✅ commit `8b976307` |
| **23** | 🟠 | pricingStore.ts | Map+persist | 📋 本文件 |
| **24** | 🟠 | data/e281Fallback.ts | 双份模块 | ✅ commit `4cd5a171` |
| **25** | 🟡 | apiClient.ts | 重试不区分4xx | ✅ commit `e3dc7fa5` |
| **26** | 🟡 | useDashboardData.ts | useMemo deps | ✅ commit `8b976307` |
| **27** | 🟡 | ProjectListPage.tsx | 废弃config写入 | 📋 本文件 |
| **28** | 🟡 | ScenarioSelector.tsx | as any | 📋 本文件 |
