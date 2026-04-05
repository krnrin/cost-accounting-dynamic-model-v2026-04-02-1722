# utils/

Pure utility functions extracted from `g281_profit_dashboard.js` (448KB).

This is the first step of the modular extraction plan ([Issue #6](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/issues/6)).

## Modules

| File | Namespace | Description | Dependencies |
|------|-----------|-------------|-------------|
| `core.js` | `G281Core` | Generic pure functions: `toText`, `coerceNumber`, `clonePlain`, `clamp`, etc. | None |
| `format.js` | `G281Format` | Number formatting: `fmtMoney`, `fmtPct`, `fmtInt`, `fmtSigned`, etc. | None |
| `parse.js` | `G281Parse` | Value parsing: `parseLifecycleRate`, `parseLifecycleMoney`, `normalizeTemplateYear` | Lazy ref to `g281_bom_parser.js` |
| `dom.js` | `G281Dom` | DOM helpers: `escapeHtml`, `templateColumnLabel` | None |

## Design Decisions

1. **IIFE + global namespace**: Matches the existing codebase pattern (no bundler). Each module attaches to `window.G281*`.
2. **CommonJS fallback**: `module.exports` for future Node.js testing.
3. **Zero behavioral changes**: All functions are copy-pasted from dashboard.js. No refactoring of logic.
4. **Lazy dependencies**: `parse.js` lazily resolves `parseNumericCellValue` from `G281BomParser` to avoid script load-order issues.

## Migration Path

After this PR merges:

1. Add `<script>` tags for `utils/*.js` **before** `g281_profit_dashboard.js` in the HTML.
2. Replace inline definitions in `g281_profit_dashboard.js` with references to `G281Format.*`, `G281Core.*`, etc.
3. Eventually convert to ES modules when a bundler is introduced.

## Extracted Functions (25)

### G281Core (6)
- `coerceNumber(value, fallback)` — safe Number() with fallback
- `toText(value, fallback)` — safe String().trim() with fallback
- `clonePlain(value, fallback)` — JSON deep clone
- `shallowObjectEqual(left, right)` — shallow key/value equality
- `clamp(v, min, max)` — numeric clamp
- `normalizeStoredBoolean(value, fallback)` — parse stored booleans

### G281Format (10)
- `fmtMoney(v, d)` — locale money string
- `fmtNumber(v, d)` — locale number string
- `fmtMaybeMoney(v, d)` — money or '-'
- `fmtMaybeNumber(v, d)` — number or '-'
- `fmtMetric(v, d)` — number or '-' (excludes zero)
- `fmtInt(v)` — integer with locale grouping
- `fmtPct(v, d)` — percentage
- `fmtSigned(v, d)` — signed number
- `fmtSignedMoney(v)` — signed money
- `fmtMaybeInt(v)` — integer, '—', or '∞'

### G281Parse (5)
- `parseLifecycleRate(value)` — rate parser with % detection
- `parseLifecycleMoney(value)` — money amount parser
- `normalizeTemplateYear(value, fallback)` — year normalizer
- `normalizeTargetMarginPercent(value)` — margin % normalizer
- `fallbackParseNumericCellValue(text)` — minimal numeric parser

### G281Dom (2)
- `escapeHtml(value)` — XSS-safe HTML escaping
- `templateColumnLabel(index)` — Excel column label (0→A, 26→AA)
