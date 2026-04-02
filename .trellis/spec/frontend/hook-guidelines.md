# Hook Guidelines

> Guardrails for a project that currently does not use runtime frontend hooks.

---

## Overview

The shipping dashboard runtime does **not** use React hooks or a hook-based frontend framework.

There are currently:

- no `useState`
- no `useEffect`
- no custom `use*` hooks in root runtime modules

Stateful behavior is implemented through:

- module closure state objects
- helper functions such as `readDraft()`
- repo/db wrappers
- explicit render/bind cycles

---

## Current Pattern Instead Of Hooks

Use these patterns instead of hooks:

### 1. Module Closure State

Examples:

- `viewerState` in `g281_workbook_viewer.js`
- `scenarioVersionState` in `g281_profit_dashboard.js`

### 2. Named Read / Apply Helpers

Examples:

- `readDraft()` in `g281_profit_dashboard.js`
- `applyVersionPreset(...)`
- `renderVersions()`

### 3. Explicit Event Wiring

Examples:

- `bind()` in `g281_profit_dashboard.js`
- explicit `addEventListener(...)` blocks in `g281_bom_validation_view.js` and `g281_workbook_viewer.js`

---

## Data Fetching / Loading

This project is offline-first. "Data fetching" usually means:

- reading `window.G281_RUNTIME`
- reading generated bundle data from files already loaded by HTML
- reading persisted browser state from `localStorage`
- reading durable records from IndexedDB through repo/db wrappers

Use plain async functions for this flow. Do not introduce hook-based data loaders into root runtime modules.

---

## Naming Conventions

### For Existing Runtime Modules

Use verb-based helper names, not hook names.

Good:

- `readDraft`
- `renderProfitInsights`
- `setVersionTimelineDrawerOpen`
- `loadWorkbookVersion`

Avoid:

- `useDraft`
- `useVersionTimeline`
- `useWorkbook`

### If A Real Hook Is Ever Introduced

Only introduce a real hook if the repo adds a framework-owned subtree and a build/runtime boundary for it.

If that ever happens:

- keep hook code isolated from the plain-browser runtime
- use real hook naming rules (`useX`)
- document the new boundary in this file and in `directory-structure.md`

---

## Common Mistakes

### Mistake: Sneaking React Assumptions Into Root Files

Do not write frontend guidance that assumes a component render cycle or dependency array semantics in `g281_*.js`.

### Mistake: Splitting One State Flow Across Multiple Mini-Helpers

If a feature already has one closure state object, keep related state there instead of scattering mini state holders across the file.

### Mistake: Mixing Derived State And Persisted State

Computed dashboard outputs should stay derived from `readDraft()` + engine calls. Do not treat every computed value like a persisted hook cache.

---

## Bottom Line

This file exists mostly as an **anti-pattern guard**:

- use closure state
- use explicit render/bind functions
- use repo/db helpers for persistence
- do not invent hook-based architecture inside the current runtime
