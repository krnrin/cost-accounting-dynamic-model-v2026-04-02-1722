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

---

## 5. 🔴 Engine JS: Duplicate Function Definitions (`g281_engine.js`)

### Problem

`numberOr` and `approxEqual` are defined **twice** within the same IIFE:

```js
// First definition (~line 30)
function numberOr(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function approxEqual(left, right, epsilon) {
  return Math.abs(numberOr(left, 0) - numberOr(right, 0)) <= (epsilon || 1e-6);
}

// Second definition (~line 330) — OVERWRITES the first
function numberOr(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function approxEqual(left, right, tolerance) {  // different param name!
  const nextTolerance = Number.isFinite(Number(tolerance)) ? Number(tolerance) : 1e-6;
  return Math.abs(numberOr(left, 0) - numberOr(right, 0)) <= nextTolerance;
}
```

The second `approxEqual` has a different parameter name (`tolerance` vs `epsilon`) and slightly different default handling. Due to JS hoisting, the second definition wins, but `arraysClose()` (defined near the first) works with either version only by coincidence.

### Fix

- Delete the first `numberOr` and `approxEqual` definitions (keep the second, more defensive versions)
- Also delete the duplicate `arrayApproxEqual` / `arraysClose` pair (they do the same thing with different names)
- Search for all call sites to verify parameter usage

## 6. 🔴 Engine JS: annualDrop.yearRows Potential Out-of-Bounds (`g281_engine.js`)

### Problem

In `computeModel`, the annual loop:

```js
const annualDropFactor = numberOr(annualDrop.yearRows[index] && annualDrop.yearRows[index].factor, 1);
```

If `annualDrop.yearRows.length < lifecycleYearSeries.length`, `yearRows[index]` is `undefined`, and `undefined.factor` throws `TypeError`.

### Fix

```js
const annualDropFactor = numberOr(annualDrop.yearRows?.[index]?.factor, 1);
```

Same pattern for `rebate.yearRows[index]` and `oneTimeCustomer.revenueByYear[index]`.

## 7. 🔴 Shapley: No Dimension Upper Bound (`g281_profit_shapley.js`)

### Problem

`computeShapley` iterates over all `2^n` subsets where `n = FACTOR_DEFS.length` (currently 12 → 4096 iterations). Each iteration calls `computeModel`. If factors grow to 16+ (65536 iterations), the browser will freeze.

### Fix

```js
const dimension = factors.length;
if (dimension > 15) {
  throw new Error(`Shapley: factor count ${dimension} exceeds maximum 15 (would require ${2**dimension} evaluations).`);
}
```

## 8. Engine JS: Garbled Strings in `buildExactFinancialModel` (`g281_engine.js`)

### Problem

Near the end of `buildExactFinancialModel`:

```js
dataLayer: 'JSON 鏁版嵁灞?+ financialVersions',   // garbled
engineLayer: '璁＄畻寮曟搸',                         // garbled
```

Compare with the non-exact path which correctly outputs:

```js
dataLayer: 'JSON 数据层',
engineLayer: '计算引擎',
```

### Fix

```js
dataLayer: 'JSON 数据层 + financialVersions',
engineLayer: '计算引擎 (financial exact)',
```

## 9. Engine JS: Placeholder Strings in `legacyAnnualDropRows` (`g281_engine.js`)

### Problem

```js
return { year, rate: 0, note: index === 0 ? '????' : '' };
// ...
return { year, rate: derivedRate, note: '????????' };
```

These `'????'` and `'????????'` are likely emoji or Chinese text that was corrupted during encoding. They appear in the `note` field which may surface in the UI.

### Fix

Replace with meaningful text or empty string:

```js
return { year, rate: 0, note: index === 0 ? '基准年' : '' };
// ...
return { year, rate: derivedRate, note: '由整体年降率换算' };
```

Or if original intent is unknown, use empty string:

```js
note: ''
```

## 10. Verification

After applying all fixes:
1. Open `g281_profit_dashboard.html` in browser
2. Verify BOM modal labels show correct Chinese text
3. Verify `document.querySelectorAll('#profitInsightsMount').length === 1`
4. Verify timeline strip renders correctly
5. Verify all buttons still have correct labels
6. **NEW**: Verify Shapley computation still produces correct contributions (no change in behavior for n=12)
7. **NEW**: Test with mismatched yearRows/lifecycleYears lengths — no crash
8. **NEW**: Check `model.dataLayer` and `model.engineLayer` output correct Chinese in both exact and computed paths
