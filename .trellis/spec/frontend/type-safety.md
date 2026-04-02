# Type Safety

> Runtime safety patterns for a JavaScript-first frontend.

---

## Overview

This project's shipping frontend is plain JavaScript, not TypeScript.

Type safety is achieved through:

- explicit normalization helpers
- guard clauses for required globals and DOM nodes
- safe parsing wrappers
- null/false returns for recoverable failures
- targeted `throw new Error(...)` for required contracts

Examples are spread across:

- `g281_engine.js`
- `g281_harness_profit.js`
- `g281_repo.js`
- `g281_bom_db.js`
- `g281_profit_dashboard.js`
- `g281_workbook_viewer.js`

---

## Type Organization

There is no central type declaration layer today. Keep runtime contracts close to the code that owns them.

Typical patterns:

- normalization helpers near the top of a module
- constants for known keys and enums
- explicit maps such as `STATE_FINANCIAL_VERSION_MAP`
- helper guards such as `safeArray`, `safeObject`, `toText`, `numberOr`, `clonePlain`

If you need a new runtime contract, add the helper or constant next to the owning module unless it is clearly shared across multiple modules.

---

## Validation Patterns

### Dependency Guards First

Fail early when a hard dependency is missing.

Examples:

- `g281_profit_dashboard.js` throws if `window.G281Engine` or `window.G281Repo` is missing
- repo factories throw when `window.G281BomDb` is not ready

### Safe Parsing For Browser Storage

Wrap `JSON.parse` in fallback helpers.

Example:

- `g281_repo.js` uses `safeParse(...)`

### Normalize Before Compute

Convert browser strings and unknown inputs before business logic.

Examples:

- `numberOr(...)` in `g281_engine.js`
- `normalizeMix(...)` in `g281_engine.js`
- `toText(...)` in `g281_workbook_viewer.js`

### Clone Before Mutating Shared Structures

Use `clonePlain(...)` when a module needs a defensive copy of a workbook snapshot or nested plain object.

Examples:

- `g281_workbook_viewer.js`
- `src/g281_univer_template_editor.entry.js`

---

## Error Behavior

Use these rules consistently:

- `throw new Error(...)` for required contracts that must exist
- `console.warn(...)` plus fallback for recoverable persistence or integration problems
- `return null` or `return false` when the caller can reasonably skip the feature

Good examples:

- IndexedDB fallback in `g281_bom_db.js`
- scenario save/load warnings in `g281_profit_dashboard.js`
- workbook snapshot guards in `g281_workbook_viewer.js`

---

## Forbidden Patterns

### Forbidden: Raw Browser Values In Compute Paths

Do not pass raw DOM string values directly into engine math. Normalize first.

### Forbidden: Unchecked Deep Property Access

Use optional chaining or safe helpers when a runtime payload may be absent.

### Forbidden: Storage Reads Without Guards

Do not assume `localStorage`, IndexedDB, or a parsed payload is always available.

### Forbidden: Generic Globals As Contracts

Avoid broad globals such as `window.state` or `window.data`. Use namespaced globals with explicit shapes.

---

## Common Patterns To Reuse

```js
function numberOr(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}
```

```js
function safeParse(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}
```

```js
if (!requiredNode || !requiredDependency) {
  return;
}
```

These small helpers are the project's practical type-safety layer. Prefer them over optimistic assumptions.
