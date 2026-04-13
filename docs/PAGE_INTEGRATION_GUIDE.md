# 页面集成指南

本文档说明如何将新创建的引擎 hook 和独立集成组件接入现有的大文件页面。

## 架构设计

由于以下页面文件较大，采用**独立集成组件**模式：

| 页面 | 大小 | 集成组件 | Hook | Issue |
|------|------|----------|------|-------|
| BomWorkbookPage.tsx | 41KB | `SmartPasteIntegration` | `useSmartPaste` | #98 |
| ChangeEnginePage.tsx | 58KB | `CascadeImpactIntegration` | `useCascadeImpact` | #96 |
| QuotePage.tsx | 31KB | `QuoteGapEntry` | `useGapAnalysis` | #59 |
| BomWorkbookPage.tsx | 41KB | `BomDiffIntegration` | `useBomDiff` | #64 |

## 集成步骤

### 1. BomWorkbookPage → SmartPasteIntegration (#98)

```tsx
import SmartPasteIntegration from '@/components/SmartPasteIntegration';

// 在工具栏区域添加：
<SmartPasteIntegration
  targetColumns={BOM_TARGET_COLUMNS}
  onApply={(rows, mappings) => {
    // 将 rows 写入当前 BOM 表格
    applyRowsToGrid(rows, mappings);
  }}
/>
```

### 2. ChangeEnginePage → CascadeImpactIntegration (#96)

```tsx
import CascadeImpactIntegration from '@/components/CascadeImpactIntegration';

// 在设变提交区域下方添加：
<CascadeImpactIntegration
  bomChanges={currentBomChanges}
  semanticChanges={classifiedChanges}
  sheetData= assemblyRows, secondaryRows, kskRows 
  onImpactComputed={(result) => {
    if (result.hasImpact) {
      setShowCascadePreview(true);
    }
  }}
/>
```

### 3. QuotePage → QuoteGapEntry

```tsx
import QuoteGapEntry from '@/components/QuoteGapEntry';

// 在报价汇总卡片下方添加：
<QuoteGapEntry
  projectId={projectId}
  scenarioId={scenarioId}
/>
```

### 4. BomWorkbookPage → BomDiffIntegration (#64)

```tsx
import BomDiffIntegration from '@/components/BomDiffIntegration';

// 在 BOM 编辑器底部添加：
<BomDiffIntegration
  scenarioId={scenarioId}
  currentBom={bomRows}
  onDiffComputed={(diff) => setDiffResult(diff)}
/>
```

## 已完成的页面级集成

以下页面已在代码中直接集成了对应 hook：

| 页面 | Hook | Issue | 状态 |
|------|------|-------|------|
| ProjectScenariosPage.tsx | `useScenarioLifecycle` | #97 | ✅ 已集成 |
| AlertsPage.tsx | `useAlertWorkflow` | #95 | ✅ 已集成 |
| GapAnalysisPage.tsx | `useGapAnalysis` | #59 | ✅ 新建页面 |

## 路由注册

| 路由 | 页面 | 状态 |
|------|------|------|
| `/project/:id/s/:sid/gap` | GapAnalysisPage | ✅ 已注册 |

## 大文件修改注意事项

上述页面文件包含大量内联 JSX style 对象，远程编辑可能导致样式丢失。
建议在本地 IDE 中进行修改，按照上述集成步骤嵌入组件。
每个集成组件都是自包含的，只需 1-3 行代码即可嵌入。
