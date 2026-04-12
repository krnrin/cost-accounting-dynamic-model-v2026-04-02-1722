# State Management

> How state is managed in this project.

---

## Overview

State in this project is split across four layers:

1. **Runtime seed data** loaded into `window.G281_RUNTIME`
2. **Page-level mutable state** held in module closures such as `state`
3. **Browser persistence** via `localStorage` and IndexedDB wrappers
4. **Cross-module coordination** via namespaced bridge APIs and browser events

This split is visible in `g281_profit_dashboard.js`, `g281_repo.js`, `g281_bom_db.js`, `g281_factor_version_repo.js`, and `g281_scenario_repo.js`.

---

## State Categories

### 1. Runtime Seed

Read-only or mostly read-only data shipped with the page.

Examples:

- `window.G281_RUNTIME`
- `RUNTIME.master`
- generated bundle inputs from `g281_data_bundle.js`

Use runtime seed data as the source of truth for shipped defaults and generated datasets.

### 2. UI / Session State

Mutable state for the current page session.

Examples:

- `const state = { scenarioName: BASE.name, ...DEFAULT_STATE }` in `g281_profit_dashboard.js`
- `viewerState` in `g281_workbook_viewer.js`
- `scenarioVersionState` in `g281_profit_dashboard.js`

Keep this state in module closures and re-render from it.

### 3. Lightweight Persistence

Use `localStorage` for small browser flags or extra records.

Examples:

- `g281_repo.js` keeps history/approval extras in `localStorage`
- `g281_profit_dashboard.js` stores UI preferences such as target margin and wire-catalog visibility
- `g281_bom_validation_view.js` stores manual align state in a versioned key

Rules:

- define storage keys as constants
- version keys with a suffix like `.v1`, `.v6`
- wrap reads in safe parsing helpers

### 4. Durable Persistence

Use IndexedDB wrappers for larger or structured records.

Examples:

- `g281_bom_db.js`
- `g281_factor_version_repo.js`
- `g281_scenario_repo.js`

These modules already implement fallback logic when IndexedDB is unavailable. Reuse them instead of writing ad hoc storage code.

### 5. Cross-Module Coordination

Use an explicit bridge or browser event when multiple modules must react to shared state.

Examples:

- `window.G281DashboardBridge`
- `window.dispatchEvent(new CustomEvent(DASHBOARD_VERSION_CHANGE_EVENT, ...))`
- `g281_bom_validation_view.js` listening for the dashboard version-change event

### Bridge-First Helper Surfaces

If a helper surface needs to trigger page-owned actions, expose a narrow method on the owner bridge first and only fall back to DOM click when the owner module has no stable open function yet.

Examples:

- `window.G281DashboardBridge.setWorkspacePage('profit' | 'data')` for homepage tab switching
- `window.G281DashboardBridge.openVersionTimeline()` for the version drawer
- `window.G281LandingWorkbench.refresh()` being called from dashboard `render(...)` after derived profit data changes

This keeps helper modules such as `ui/landing_workbench.js` synchronized with page state without depending on `MutationObserver` or brittle selector-driven clicks as the primary path.

---

## Promotion Rules

### Keep State Local When

- only one module needs it
- it does not need to survive refresh
- it is purely derived from current inputs

### Promote To localStorage When

- the state is small
- it should survive refresh
- it is user preference or lightweight extra record data

### Promote To IndexedDB When

- the data is large, structured, or versioned
- multiple records must be listed/loaded/saved
- workbook snapshots or semantic BOM releases are involved

### Promote To Bridge/Event When

- two modules need to stay synchronized
- one module owns the state and another module must observe it

---

## Derived State Rule

Prefer recomputing from source state instead of storing duplicated computed output.

Examples:

- `readDraft()` in `g281_profit_dashboard.js` feeds engine recomputation
- pricing, KPI, and profit insights are derived, not stored as independent persistent truth

Do not persist rendered KPI tables or derived summaries unless the repo already has a dedicated persistence contract for them.

---

## Common Mistakes

### Mistake: Writing Directly To Storage From Too Many Places

If a durable data model already has a repo/db wrapper, use it.

Wrong:

- adding direct IndexedDB calls inside a random view module

Correct:

- extending `g281_bom_db.js` or a repo built on top of it

### Mistake: Forgetting Fallback Behavior

`g281_bom_db.js` explicitly falls back when IndexedDB is blocked or unavailable. New persistence code should preserve that browser-safe behavior.

### Mistake: Persisting Derived Values

Persist user inputs, selected versions, and workbook snapshots. Do not persist every computed output row.

### Mistake: Silent Cross-Module State Changes

If one module changes version state that another module cares about, emit or reuse an explicit event / bridge method.
