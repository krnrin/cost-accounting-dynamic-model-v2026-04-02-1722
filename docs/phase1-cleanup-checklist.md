# Phase 1 Cleanup Checklist

Low-risk fixes for [Issue #6](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/issues/6).

## 1. HTML Encoding Fixes (`g281_profit_dashboard.html`)

### Garbled Chinese labels (UTF-8/GBK encoding corruption)

| Line | Current (garbled) | Correct |
|------|-------------------|---------|
| BOM modal, left version label | `瀵规瘮宸︾増` | `对比差版` |
| BOM modal, right version label | `鍙冲啗鍩哄噯` | `右军基准` |

### Fix
```html
<!-- Before -->
<span>瀵规瘮宸︾増</span>
<span>鍙冲啗鍩哄噯</span>

<!-- After -->
<span>对比差版</span>
<span>右军基准</span>
```

## 2. Duplicate ID (`g281_profit_dashboard.html`)

`profitInsightsMount` appears twice in the HTML:

```html
<!-- Line ~approx 155-156 -->
<div id="profitInsightsMount" class="profit-insights-mount"></div>
<div id="profitInsightsMount"></div>  <!-- DELETE THIS LINE -->
```

**Fix**: Delete the second `<div id="profitInsightsMount"></div>`.

Note: `ensureDashboardUiScaffold()` in the JS already has a runtime fix that removes duplicates, but the HTML source should be corrected.

## 3. JS Garbled innerHTML (`g281_profit_dashboard.js`)

In `ensureDashboardUiScaffold()`, the timeline strip is created with garbled innerHTML:

```js
// Before (garbled)
timelineStrip.innerHTML = `
  <div class="hero-block-head timeline-strip-head">
    <div>
      <h3>鐗堟湰鍙戝竷鏃堕棿绾?</h3>
      <p class="section-note">灞曠ず鍚勬垚鏈绱犵増鏈殑鍙戝竷鏃堕棿銆佹渶杩戞洿鏂板拰褰撳墠鐢熸晥鐗堟湰銆?/p>
    </div>
    ...
```

```js
// After (correct)
timelineStrip.innerHTML = `
  <div class="hero-block-head timeline-strip-head">
    <div>
      <h3>版本发布时间线</h3>
      <p class="section-note">展示各成本要素版本的发布时间、最近更新和当前生效版本。</p>
    </div>
    ...
```

Note: The JS code immediately overwrites these with correct text via `textContent`, so this is cosmetic in the source. But fixing it eliminates confusion during debugging.

## 4. Redundant Assignments (`g281_profit_dashboard.js`)

The following patterns appear in `ensureDashboardUiScaffold()` and the initialization block below it. Each element gets the same text assigned 2-3 times via different methods:

### Pattern: `.textContent` then `.replaceChildren()`

```js
// BEFORE: assigned twice
versionTitle.textContent = '成本要素版本管理';
versionTitle.textContent = '成本要素版本管理';  // duplicate
// ...later...
versionPanel?.querySelector('h2')?.replaceChildren('成本要素版本管理');  // triple

// AFTER: assign once
if (versionTitle) versionTitle.textContent = '成本要素版本管理';
```

### Affected elements (keep only one assignment each):

| Element | Text | Redundant calls |
|---------|------|-----------------|
| `versionTitle` (h2) | `成本要素版本管理` | 3× |
| `timelineTitle` (h3) | `版本发布时间线` → then `时间线` | 3× |
| `timelineNote` (.section-note) | text → then hidden | 3× |
| `initialCapitalButton` | `资源投入管理` | 2× (.textContent + .replaceChildren) |
| `initialCapitalTitle` | `资源投入管理` | 2× |
| `initialFactoryButton` | `工厂效率 / 运营费率` | 2× |
| `initialExportBomButton` | `导出原生BOM` | 2× |
| `initialFactoryTitle` | `工厂效率与运营工时费率` | 2× |
| `initialFactoryNote` | section note text | 2× |
| `initialFactoryClose` | `关闭` | 2× |

### Recommended fix

Delete all `?.replaceChildren(...)` calls at lines ~450-460 (the block after `ensureDashboardUiScaffold()` call), since the `.textContent` assignments above already set the correct values.

## 5. Verification

After applying all fixes:
1. Open `g281_profit_dashboard.html` in browser
2. Verify BOM modal labels show correct Chinese text
3. Verify `document.querySelectorAll('#profitInsightsMount').length === 1`
4. Verify timeline strip renders correctly
5. Verify all buttons still have correct labels
