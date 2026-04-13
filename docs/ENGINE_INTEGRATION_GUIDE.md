# 引擎集成指南 (Engine Integration Guide)

> 本文档描述如何将 `app/src/hooks/` 中的引擎集成 hook 接入到各页面组件。
> 所有引擎模块代码已在 `app/src/engine/` 中完备，均通过 hook 层桥接。

## 概览

| Hook | 引擎模块 | 目标页面 | 优先级 |
|------|---------|---------|--------|
| `useScenarioLifecycle` | `scenario_lifecycle.ts` | ProjectScenariosPage | P0 |
| `useAlertWorkflow` | `alert_workflow.ts` | AlertsPage | P0 |
| `useCascadeImpact` | `cascade_impact.ts` | ChangeEnginePage | P0 |
| `useSmartPaste` | `smart_paste.ts` | BomWorkbookPage | P1 |
| `useBomNormalizer` | `bom_normalizer.ts` | BomDiffPage | P1 |

---

## 1. ProjectScenariosPage ← useScenarioLifecycle

### 当前问题
- 状态转换硬编码，只有 draft/frozen/released，缺少 published/archived
- 编辑按钮不检查状态（冻结后仍可编辑）
- 操作按钮不动态（未使用 getAvailableTransitions）

### 集成步骤

**Step 1: 添加 import**
```typescript
import { useScenarioLifecycle, getTransitionLabel, getTransitionConfirmText, getStatusLabel } from '@/hooks/useScenarioLifecycle';
```

**Step 2: 替换状态常量**

删除现有的：
```typescript
// 删除这些硬编码
const SCENARIO_STATUS_LABELS = { draft: '草稿', frozen: '已冻结', released: '已发布' };
const STATUS_COLORS = { draft: 'grey', frozen: 'orange', released: 'green' };
```

替换为引擎驱动的状态映射（支持 draft/frozen/published/archived 四态）。

**Step 3: 修改操作列**

替换现有的硬编码按钮逻辑：
```typescript
// 原来：
{record.status === 'draft' && <Button onClick={() => handleFreeze(record)}>冻结</Button>}
{record.status !== 'released' && <Button onClick={() => handleRelease(record)}>发布</Button>}

// 替换为动态生成：
const lifecycle = useScenarioLifecycle(record.status);
{lifecycle.availableTransitions.map(target => (
  <Button key={target} size="small" onClick={() => handleTransition(record, target)}>
    {getTransitionLabel(target)}
  </Button>
))}
// 编辑按钮加 disabled:
<Button disabled={!lifecycle.editable} onClick={() => openEditModal(record)}>编辑</Button>
```

**Step 4: 统一转换处理函数**
```typescript
const handleTransition = (scenario: ScenarioItem, target: string) => {
  Modal.confirm({
    title: getTransitionLabel(target),
    content: getTransitionConfirmText(scenario.name, target),
    onOk: () => executeScenarioAction(scenario, target, getTransitionLabel(target) + '成功'),
  });
};
```

---

## 2. AlertsPage ← useAlertWorkflow

### 当前问题
- “刷新检测”按钮只调服务端 API，无客户端实时预检
- 规则创建表单无默认规则参考
- 无升级标记（超时未处理的预警应标红）

### 集成步骤

**Step 1: 添加 import**
```typescript
import { useAlertWorkflow, SEVERITY_DISPLAY } from '@/hooks/useAlertWorkflow';
```

**Step 2: 在 AlertCenterPage 组件内使用**
```typescript
const workflow = useAlertWorkflow();
```

**Step 3: 增强“刷新检测”流程**

在现有的 `handleDetect` 函数中增加客户端预检：
```typescript
const handleDetect = async () => {
  setDetecting(true);
  try {
    // 1. 客户端预检（实时）
    const localData = await loadLocalScenarioData(); // 从 IndexedDB 加载
    const clientCheck = workflow.runChecks(localData);
    if (clientCheck.alerts.length > 0) {
      Toast.info('客户端检测到 ' + clientCheck.alerts.length + ' 条潜在预警');
    }
    // 2. 服务端检测（原有逻辑）
    const result = await detectAlerts();
    Toast.success('预警检测完成，本次更新 ' + result.count + ' 条事件。');
    await reload();
  } catch (error) { ... }
};
```

**Step 4: 在事件列表中标记需升级的项**
```typescript
const needsEscalation = workflow.checkEscalation(event);
// 在渲染时: needsEscalation && <Tag color="red">待升级</Tag>
```

---

## 3. ChangeEnginePage ← useCascadeImpact

### 当前问题
- 设变提交时无级联影响预览
- 用户看不到“这个 BOM 变更会联动修改装配件表/辅材表/KSK表”

### 集成步骤

**Step 1: 添加 import**
```typescript
import { useCascadeImpact } from '@/hooks/useCascadeImpact';
```

**Step 2: 在设变提交流程中调用**
```typescript
const cascade = useCascadeImpact();

// 当用户提交设变时，先显示级联影响预览：
const handleSubmitChange = async () => {
  const impact = await cascade.computeAll(
    bomChanges,      // 来自 BomDiffPage / detectBomChanges
    semanticChanges, // 来自 change_pattern_classifier
    {
      assemblyRows: currentAssemblyData,
      secondaryRows: currentSecondaryData,
      kskRows: currentKskData,
    },
  );

  if (impact.hasImpact) {
    // 显示确认弹窗：
    Modal.confirm({
      title: '设变级联影响预览',
      content: '本次设变将联动修改 ' + impact.totalActions + ' 个关联表项，确认提交？',
      onOk: () => submitChangeToApi(),
    });
  } else {
    submitChangeToApi();
  }
};
```

> ℹ️ 此页面 56KB，建议本地编辑。cascade_impact 已完整实现三个 sheet 的联动计算，
> 并且已内置对所有语义模式 (replace/merge/split/fixed_length/segmented_length/qty_explode) 的处理。

---

## 4. BomWorkbookPage ← useSmartPaste

### 当前问题
- BOM 编辑页无智能粘贴功能，用户无法从 Excel 直接粘贴 BOM 数据

### 集成步骤

**Step 1: 添加 import**
```typescript
import { useSmartPaste, BOM_TARGET_COLUMNS } from '@/hooks/useSmartPaste';
```

**Step 2: 在组件中使用**
```typescript
const paste = useSmartPaste(BOM_TARGET_COLUMNS);

// 在表格容器上添加 onPaste:
<div onPaste={(e) => {
  const text = e.clipboardData.getData('text/plain');
  if (text && text.includes('\t')) {
    e.preventDefault();
    const result = paste.handlePaste(text);
    if (result.success) {
      // 显示预览弹窗
    }
  }
}}>
  <Table ... />
</div>

// 确认应用：
const handleConfirmPaste = () => {
  const data = paste.confirmPaste();
  if (data) {
    // 将 data.rows 写入 BOM 表格
    setBomItems(prev => [...prev, ...data.rows.map(mapToDbBomItem)]);
  }
};
```

> ℹ️ BomWorkbookPage 文件 41KB，建议本地编辑。

---

## 5. BomDiffPage ← useBomNormalizer

### 当前问题
- `detectBomChanges` 使用 partNo 精确匹配
- 当两个场景的 partNo 编码规则不一致时，会漏检实际匹配项

### 集成步骤

**Step 1: 添加 import**
```typescript
import { enhancedBomCompare } from '@/hooks/useBomNormalizer';
```

**Step 2: 替换或增强 `detectBomChanges`**

在现有的 `detectBomChanges` 函数中，用 `enhancedBomCompare` 的结果来建立匹配关系：
```typescript
// 原来: baseByPart.set(item.partNo, ...)
// 现在: 先用 bom_normalizer 做模糊匹配，再用匹配结果做 diff
const matchResult = enhancedBomCompare(baseBom, currentBom);
// matchResult 提供 5 级匹配: partNo 精确 → backup key → 特征核心 → 文本相似度 ≥ 0.78 → 替代规则
```

> ℹ️ BomDiffPage 已集成 change_pattern_classifier，添加 bom_normalizer 可进一步提升匹配精度。

---

## 注意事项

1. **引擎模块已全部完备**，无需修改 `engine/` 下的任何文件
2. **Hook 层是纯桥接层**，可以根据页面需求自由调整
3. **大文件** (ChangeEnginePage 56KB, BomWorkbookPage 41KB) 建议本地编辑
4. **中小文件** (ProjectScenariosPage 20KB, AlertsPage 24KB) 可试远程推送，但注意 JSX 双花括号压缩风险
