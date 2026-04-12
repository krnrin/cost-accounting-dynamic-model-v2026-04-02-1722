# Review Fixes Batch 2 — 本地手动补丁指南

> **重要**: 以下文件含有 JSX `style= ... ` 内联样式，无法通过 MCP 远程推送（Notion 会把双花括号压缩成占位符）。
> 请在本地 IDE 中手动应用以下补丁。每个补丁都标注了精确的搜索/替换文本。

---

## 🔴 Issue #10 + #11 + #16: HarnessEditPage.tsx — crash + 空 scenarioId + 无场景过滤

**文件**: `app/src/pages/HarnessEditPage.tsx`

### 补丁 A: 添加 sid 到 useParams + 导入 ScenarioRecord

```diff
- const { id, harnessId } = useParams<{ id: string; harnessId: string }>();
+ const { id, sid, harnessId } = useParams<{ id: string; sid?: string; harnessId: string }>();
```

在 import 区添加:
```diff
  import { db } from '@/data/db';
+ import type { ScenarioRecord } from '@/data/db';
```

### 补丁 B: 加载 scenario 并用 scenario.config 替代 project.config

替换整个 `useLiveQuery`:
```diff
  const data = useLiveQuery(async () => {
    if (!id) return null;
    const project = await db.projects.get(id);
+   // 加载场景配置（v7+ config 在 scenario 上，不在 project 上）
+   const scenario = sid ? await db.scenarios.get(sid) : null;
-   if (isNew) return { project, harness: null };
+   if (isNew) return { project, scenario, harness: null };
    if (!harnessId) return null;
-   const harness = await db.harnesses.where({ projectId: id, harnessId: harnessId }).first();
-   return { project, harness: harness ?? null };
+   // 按 scenarioId 过滤，避免多场景同零件号冲突
+   let harness;
+   if (sid) {
+     harness = await db.harnesses
+       .where('[scenarioId+harnessId]')
+       .equals([sid, harnessId])
+       .first();
+     // 兜底：查空 scenarioId 的遗留数据
+     if (!harness) {
+       harness = await db.harnesses
+         .where({ projectId: id, harnessId })
+         .filter(h => !h.scenarioId || h.scenarioId === '')
+         .first();
+     }
+   } else {
+     harness = await db.harnesses.where({ projectId: id, harnessId }).first();
+   }
+   return { project, scenario, harness: harness ?? null };
- }, [id, harnessId]);
+ }, [id, sid, harnessId]);
```

### 补丁 C: 替换所有 `data.project.config!` 引用

在 result useMemo 中:
```diff
  const result: HarnessResult | null = useMemo(() => {
-   if (!data?.project || !formData) return null;
+   if (!data?.project || !data?.scenario || !formData) return null;
    if (!formData.harnessId) return null;
+   const cfg = data.scenario.config;

    if (pricingContext) {
-     return computeHarnessCostDynamic(formData, pricingContext, data.project.config!.factories?.[0]?.factoryId || 'K1K2_Factory');
+     return computeHarnessCostDynamic(formData, pricingContext, cfg.factories?.[0]?.factoryId || 'K1K2_Factory');
    }

    return computeHarnessCost(
      formData,
-     data.project.config!.costRates,
-     data.project.config!.metalPrices
+     cfg.costRates,
+     cfg.metalPrices
    );
- }, [data, formData, pricingContext]);
+ }, [data, formData, pricingContext, data?.scenario]);
```

在 internalResult useMemo 中:
```diff
  const internalResult = useMemo(() => {
-   if (!data?.project || !formData || !pricingContext) return null;
+   if (!data?.project || !data?.scenario || !formData || !pricingContext) return null;
    if (!formData.harnessId) return null;
+   const cfg = data.scenario.config;

-   const rates = getInternalFactoryRates(data.project.config!.factories?.[0]?.factoryId || 'K1K2_Factory', pricingContext.benchmark, pricingContext.simulation);
+   const rates = getInternalFactoryRates(cfg.factories?.[0]?.factoryId || 'K1K2_Factory', pricingContext.benchmark, pricingContext.simulation);
    return computeInternalHarnessCost(formData, rates, pricingContext.metalPrices, null, pricingContext.benchmark.audit_trace_id);
  }, [data, formData, pricingContext]);
```

### 补丁 D: 新建线束写入正确 scenarioId + 正确导航

```diff
      if (isNew) {
        const newId = crypto.randomUUID();
        await db.harnesses.put({
          id: newId,
          projectId: id,
-         scenarioId: '',
+         scenarioId: sid || '',
          eopYear: null,
          harnessId: formData.harnessId,
          harnessName: formData.harnessName || formData.harnessId,
          input: formData,
+         result: result ?? undefined,
          updatedAt: new Date().toISOString(),
        });
        Toast.success('线束创建成功');
-       navigate(`/project/${id}/harness/${formData.harnessId}`, { replace: true });
+       navigate(sid
+         ? `/project/${id}/s/${sid}/harness/${formData.harnessId}`
+         : `/project/${id}/harness/${formData.harnessId}`,
+         { replace: true }
+       );
```

### 补丁 E: 现有线束保存时写入 result

```diff
      } else {
        if (!data.harness) return;
        await db.harnesses.update(data.harness.id, {
          input: formData,
          harnessName: formData.harnessName,
+         result: result ?? undefined,
          updatedAt: new Date().toISOString(),
        });
```

### 补丁 F: loading guard

```diff
- if (!data?.project || !formData) {
+ if (!data?.project || !formData || (sid && !data?.scenario)) {
```

---

## 🔴 Issue #12: QuotePage.tsx — 设变模拟完全失效

**文件**: `app/src/pages/QuotePage.tsx`

### 补丁 A: 修复模拟 Tab 的变更逻辑

`HarnessInput` 没有 `materialCost` / `processHours` 字段，需要改为修改实际输入字段。

找到模拟 Tab 的 InputNumber onChange 部分（在 `renderChangePricing` 函数内）：

```diff
  { title: changeMode === 'bom' ? '新材料成本' : changeMode === 'hours' ? '新工时' : '新装车比',
    render: (_: any, h: any) => (
      <InputNumber
-       value={(modifiedHarnesses[h.harnessId] as any)?.[changeMode === 'bom' ? 'materialCost' : changeMode === 'hours' ? 'processHours' : 'vehicleRatio']}
+       value={(modifiedHarnesses[h.harnessId] as any)?.[changeMode === 'config' ? 'vehicleRatio' : undefined]
+         ?? (changeMode === 'hours'
+           ? (modifiedHarnesses[h.harnessId] as any)?.frontHours
+           : undefined)}
        onChange={(val) => {
-         const field = changeMode === 'bom' ? 'materialCost' : changeMode === 'hours' ? 'processHours' : 'vehicleRatio';
+         // BOM变更: 暂不支持通过数字直接修改 (需要改 bom 数组)
+         // 工时变更: 修改 frontHours (简化: 假设后道不变)
+         // 配置变更: 修改 vehicleRatio
+         let patch: Partial<HarnessInput> = {};
+         if (changeMode === 'hours') {
+           patch = { frontHours: Number(val) || 0 };
+         } else if (changeMode === 'config') {
+           patch = { vehicleRatio: Number(val) || 0 };
+         } else {
+           // BOM 模式: 不支持单数字修改, 需要用 BomWorkbook
+           return;
+         }
          setModifiedHarnesses({
            ...modifiedHarnesses,
-           [h.harnessId]: { ...modifiedHarnesses[h.harnessId], [field]: val }
+           [h.harnessId]: { ...modifiedHarnesses[h.harnessId], ...patch }
          });
        }}
```

在 "当前值" 列也需要修改：
```diff
  { title: '当前值', render: (_: any, h: any) => {
      const current = baselineResultsById.get(h.harnessId);
-     if (changeMode === 'bom') return formatCurrency(current?.materialCost);
-     if (changeMode === 'hours') return current ? `${current.processHours.toFixed(2)} h` : '-';
+     if (changeMode === 'bom') return formatCurrency(current?.materialCost) + ' (只读)';
+     if (changeMode === 'hours') return `${h.input.frontHours.toFixed(4)} + ${h.input.backHours.toFixed(4)} h`;
      return `${(h.input.vehicleRatio * 100).toFixed(1)}%`;
    }
  },
```

---

## 🟠 Issue #13: QuotePage.tsx — 缺少 QuoteEmptyState

### 补丁: 导入组件 + 在空数据时渲染

添加 import:
```diff
+ import { QuoteEmptyState } from '@/components/QuoteEmptyState';
```

在 `if (!project || !scenario)` 判断之后、`return (` 之前添加:
```diff
  if (!project || !scenario) return <div>项目不存在</div>;

+ // 无线束数据时显示空状态引导
+ if (harnesses.length === 0) {
+   return (
+     <div className="page-container">
+       <ScenarioSelector />
+       <QuoteEmptyState projectId={id!} scenarioId={sid!} projectName={project.meta.projectName} />
+     </div>
+   );
+ }
```

---

## 🟠 Issue #14: BomWorkbookPage.tsx — 保存不写回 result

**文件**: `app/src/pages/BomWorkbookPage.tsx`

在 `handleSaveAll` 的 Dexie update 部分:
```diff
  const updates = changedHarnesses.map((harness) => {
    const modified = modifiedInputs.get(harness.harnessId)!;
+   const computedResult = resultsMap.get(harness.harnessId);
    return (
      db.harnesses.update(harness.id, {
        input: modified,
        harnessName: modified.harnessName,
+       result: computedResult ?? harness.result,
        updatedAt: new Date().toISOString(),
      })
    );
  });
```

---

## 🟠 Issue #15: BomWorkbookPage.tsx — 场景过滤遗漏空 scenarioId

```diff
  const scopedHarnesses = sid
-   ? harnesses.filter((harness) => harness.scenarioId === sid)
+   ? harnesses.filter((harness) => harness.scenarioId === sid || !harness.scenarioId)
    : harnesses;
```

---

## 🟡 Issue #17: QuotePage.tsx — 重复加载竞态

删除第二个独立的 `useEffect` (搜索 `syncSelectedQuote`)，它与 `loadData` 的 useEffect 功能完全重复:

```diff
- useEffect(() => {
-   if (!sid) return;
-   let active = true;
-   async function syncSelectedQuote() {
-     try {
-       const quotes = await apiClient<ApiQuote[]>(`/quotes/scenario/${sid}`);
-       setQuoteRecords(quotes);
-       if (!active) return;
-       const preferredQuote = quotes.find((quote) => quote.template === templateType) || quotes[0] || null;
-       setSelectedQuoteId(preferredQuote?.id ?? null);
-     } catch {
-       setQuoteRecords([]);
-       if (active) setSelectedQuoteId(null);
-     }
-   }
-   void syncSelectedQuote();
-   return () => {
-     active = false;
-   };
- }, [sid, templateType]);
```

---

## 🟡 Issue #18: HarnessDetailPage.tsx — 除零 NaN

```diff
  const materialTableData = [
-   { type: '导线', value: res.materialBreakdown.byType.wire, percent: res.materialBreakdown.byType.wire / res.materialCost },
-   { type: '连接器', value: res.materialBreakdown.byType.connector, percent: res.materialBreakdown.byType.connector / res.materialCost },
+   { type: '导线', value: res.materialBreakdown.byType.wire, percent: res.materialCost ? res.materialBreakdown.byType.wire / res.materialCost : 0 },
+   { type: '连接器', value: res.materialBreakdown.byType.connector, percent: res.materialCost ? res.materialBreakdown.byType.connector / res.materialCost : 0 },
    // ... 对所有 7 行都加上 res.materialCost ? ... : 0 保护
```

简化方法：在 materialTableData 之前定义辅助函数:
```ts
const safePercent = (part: number, total: number) => total > 0 ? part / total : 0;
```
然后所有 `percent:` 改为 `percent: safePercent(res.materialBreakdown.byType.xxx, res.materialCost)`

---

## 🟡 Issue #19: HarnessDetailPage.tsx + HarnessEditPage.tsx — 复制线束用 UUID 作零件号

### HarnessDetailPage.tsx
```diff
  const handleCopy = async () => {
    if (!data?.harness) return;
    const original = data.harness;
    const newId = crypto.randomUUID();
+   const copiedHarnessId = original.harnessId + '-copy';
    const copied = {
      ...original,
      id: newId,
-     harnessId: newId,
+     harnessId: copiedHarnessId,
      harnessName: (original.harnessName || '') + ' (副本)',
      input: {
        ...original.input,
-       harnessId: newId,
+       harnessId: copiedHarnessId,
        harnessName: (original.input.harnessName || '') + ' (副本)',
      },
      updatedAt: new Date().toISOString()
    };
    await db.harnesses.add(copied);
    Toast.success('复制成功');
-   navigate(`/project/${id}/s/${sid}/harness/${newId}`);
+   navigate(`/project/${id}/s/${sid}/harness/${copiedHarnessId}`);
  };
```

### HarnessEditPage.tsx
（如果有 handleCopy，同上改法）

---

## 🟡 Issue #20: QuotePage.tsx — 双重 fallback

```diff
  const s = await db.scenarios.get(sid);
- if (!s) {
-   Toast.error('场景不存在');
-   return;
- }
- const scenarioWithFallback = applyE281ScenarioFallback(s);
+ if (!s) { Toast.error('场景不存在'); return; }
+ // db.scenarios.hook('reading') 已自动 apply fallback，无需手动调用
  ...
- setScenario(scenarioWithFallback);
+ setScenario(s);
```

同时可以删除 import:
```diff
- import { applyE281ScenarioFallback } from '@/data/e281Fallback';
```

---

## ✅ 已远程推送的修复 (PR #58 分支)

以下文件已推送到 `fix/review-findings-batch`，无需手动修改:

| 文件 | Commit | 修复内容 |
|---|---|---|
| `safeCompute.ts` | `d6bed3ee` | 导入路径 + 内部引擎包装器 |
| `EngineerWorkbench.tsx` | (in PR) | 双引擎联动 + KPI + bare style |
| `QuoteEmptyState.tsx` | `7588174a` | 路由 + bare style |
| `useHarnessSync.ts` | `eb33e11b` | 空 scenarioId 兜底 |
| `App.tsx` | `874fd97a` | useGlobalErrorHandler + RouteErrorBoundary |

---

## 执行顺序建议

1. `git pull origin fix/review-findings-batch` 合并已推送的 5 个文件
2. 按上述补丁顺序手动修改 4 个页面文件
3. `npx tsc --noEmit` 检查类型
4. `npx vitest run` 跑测试
5. `npm run dev` 本地验证 UI
6. 提交并合并到 main
