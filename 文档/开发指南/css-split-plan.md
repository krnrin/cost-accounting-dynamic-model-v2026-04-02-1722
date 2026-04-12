# P3#10: dashboard.css 92KB 拆分计划

> 状态: **待本地执行** — 文件过大无法通过 GitHub API 远程修改

## 目标

将 `ui/dashboard.css` (92KB) 拆分为按组件/模块划分的小文件，每个文件 < 10KB。

## 前置依赖

- `ui/tokens.css` — CSS 变量已创建 ✅
- `ui/responsive.css` — 响应式已创建 ✅
- `ui/loading.css` — 加载状态已创建 ✅

## 拆分策略

建议按以下结构拆分 `dashboard.css`：

```
ui/
├─ tokens.css              # ✅ 已存在 (CSS 变量)
├─ responsive.css          # ✅ 已存在 (响应式)
├─ loading.css             # ✅ 已存在 (加载状态)
├─ base.css                # ~5KB  - reset/body/typography/scrollbar
├─ layout.css              # ~8KB  - sidebar/main-content/page-header/grid
├─ components/
│  ├─ buttons.css           # ~4KB  - .button/.ghost/.primary/.danger
│  ├─ forms.css             # ~4KB  - input/select/checkbox/radio/range
│  ├─ cards.css             # ~5KB  - .kpi-card/.stat-card/.info-card
│  ├─ tables.css            # ~6KB  - .data-table/.annual-table/年度利润表
│  ├─ modals.css            # ~8KB  - .bom-modal/.modal-panel/.modal-backdrop
│  ├─ tabs.css              # ~3KB  - .tab-bar/.tab-item/.tab-content
│  ├─ tooltips.css          # ~2KB  - .tooltip/.popover
│  ├─ badges.css            # ~2KB  - .badge/.tag/.status-pill
│  ├─ charts.css            # ~5KB  - canvas wrappers/chart legends/chart grid
│  └─ compare.css           # ~4KB  - .compare-panel/.compare-card
├─ sections/
│  ├─ bom-validation.css    # ~8KB  - BOM 校验弹窗/表格/状态
│  ├─ version-template.css  # ~8KB  - 版本模板/workbook editor
│  ├─ factor-version.css    # ~5KB  - 因子版本管理
│  └─ scenario.css          # ~4KB  - 情景对比/参数面板
└─ dashboard.css            # 保留为聚合入口 (@import 所有子文件)
```

## 执行步骤

### Step 1: 提取 CSS 变量替换 (~1h)

1. 在 VS Code 中打开 `dashboard.css`
2. 全局搜索硬编码颜色值 (e.g. `#0f0f1a`, `#1a1a2e`, `#e0e0e0`)
3. 替换为 `var(--g281-xxx)` 引用 `tokens.css` 中对应变量
4. 验证页面视觉无变化

### Step 2: 拆分文件 (~2h)

1. 按上述结构创建空文件
2. 从 `dashboard.css` 中剪切对应样式块到对应文件
3. 在 `dashboard.css` 中改为 `@import` 语句

### Step 3: 更新 HTML 引用 (~30min)

4个 HTML 页面的 `<link>` 标签更新：

```html
<!-- 按顺序加载 -->
<link rel="stylesheet" href="../ui/tokens.css">
<link rel="stylesheet" href="../ui/base.css">
<link rel="stylesheet" href="../ui/layout.css">
<link rel="stylesheet" href="../ui/loading.css">
<!-- 按页面需要加载组件 CSS -->
<link rel="stylesheet" href="../ui/components/cards.css">
<link rel="stylesheet" href="../ui/components/tables.css">
<!-- ... -->
<link rel="stylesheet" href="../ui/responsive.css"> <!-- 最后加载 -->
```

### Step 4: 测试验证 (~30min)

- 每拆分一个文件就刷新验证视觉无回归
- 特别注意 BOM 校验弹窗、版本模板编辑器、因子版本管理、情景对比面板

## 预估工时

| 步骤 | 时间 |
|------|------|
| CSS 变量替换 | 1h |
| 拆分文件 | 2h |
| HTML 引用更新 | 30min |
| 测试验证 | 30min |
| **总计** | **~4h** |

## 注意事项

- 与 #30 (dashboard.js 拆分) 同步执行效果最佳
- `@import` 在生产环境可用构建工具合并，开发阶段直接用多个 `<link>` 即可
- 硬编码颜色替换时注意保留 `rgba()` 透明度值
