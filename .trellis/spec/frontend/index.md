# Frontend Development Guidelines

> Project-specific frontend rules for the offline G281/E281 harness cost dashboard.

---

## Overview

This project is a **single-page offline dashboard** built with:

- one HTML entry: `g281_profit_dashboard.html`
- root-level JavaScript feature modules such as `g281_profit_dashboard.js`, `g281_bom_validation_view.js`, `g281_workbook_viewer.js`
- root-level CSS files such as `g281_profit_dashboard.css` and feature-specific companion CSS files
- browser persistence through `localStorage` and IndexedDB wrappers
- namespaced globals such as `window.G281DashboardBridge`, `window.G281Repo`, `window.G281BomDb`

This is **not** a React/Vue component tree. Treat the runtime as a DOM-driven modular dashboard with explicit browser APIs and global bridges.

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | Root-level module layout, generated assets, release files | Filled |
| [Component Guidelines](./component-guidelines.md) | DOM module and modal patterns | Filled |
| [Hook Guidelines](./hook-guidelines.md) | Guardrails for a project that currently has no runtime hooks | Filled |
| [State Management](./state-management.md) | Runtime seed, UI state, persistence, bridge events | Filled |
| [Quality Guidelines](./quality-guidelines.md) | Offline-safe patterns, validation, release hygiene | Filled |
| [Type Safety](./type-safety.md) | JavaScript guard patterns and runtime validation | Filled |

---

## Pre-Development Checklist

Read these before editing:

1. `directory-structure.md`
2. `component-guidelines.md`
3. `state-management.md`
4. `type-safety.md`
5. `quality-guidelines.md`

Also read these when relevant:

- For persistence or version storage: `state-management.md` + `type-safety.md`
- For modal/workbook/editor work: `component-guidelines.md` + `quality-guidelines.md`
- For generated bundles or vendor editor changes: `directory-structure.md` + `quality-guidelines.md`

---

## Key Project Examples

- Main coordinator: `g281_profit_dashboard.js`
- Browser persistence layer: `g281_repo.js`, `g281_bom_db.js`, `g281_factor_version_repo.js`, `g281_scenario_repo.js`
- Feature modals/views: `g281_bom_validation_view.js`, `g281_workbook_viewer.js`, `g281_factory_efficiency_view.js`
- Engine/compute layer: `g281_engine.js`, `g281_harness_profit.js`, `g281_target_price_solver.js`
- Build-source-only editor entry: `src/g281_univer_template_editor.entry.js`

---

## Important Reality Check

- There is **no general frontend test/lint pipeline** beyond `npm run build:univer-editor`.
- Most frontend validation in this repo is **targeted browser validation** plus data-generation scripts.
- If you introduce a new pattern, write it down here immediately so future agents do not fall back to generic SPA assumptions.
