# Directory Structure

> How frontend code is organized in this project.

---

## Overview

The frontend is intentionally **flat and file-oriented**. Most runtime files live at the repository root instead of `src/feature/...`.

Use that flat structure unless there is a strong build-time reason not to.

---

## Directory Layout

```text
.
|- g281_profit_dashboard.html          # Main offline entry page
|- g281_profit_dashboard.js            # Main coordinator / render / bind / bridge
|- g281_profit_dashboard.css           # Main shell and design tokens
|- g281_*_view.js                      # Feature views and modals
|- g281_*_repo.js / g281_*_db.js       # Browser persistence wrappers
|- g281_engine.js                      # Core compute engine
|- g281_harness_profit.js              # Harness-level breakdown logic
|- g281_target_price_solver.js         # Solver logic
|- g281_profit_shapley.js              # Attribution logic
|- g281_data_*.json                    # Generated source data artifacts
|- g281_data_bundle.js                 # Runtime bundle consumed by HTML
|- g281_generate_*.py                  # Data generation scripts
|- build_univer_editor.mjs             # Build script for editor bundle
|- src/
|  +- g281_univer_template_editor.entry.js
|- vendor/
|  +- univer-editor/                   # Built editor asset loaded by HTML
|- output/                             # Validation outputs and screenshots
|- releases/                           # Versioned release copies
```

---

## Module Organization

### 1. Root-Level Runtime Modules

Put browser runtime modules at the repo root and namespace them with `g281_`.

Examples:

- `g281_profit_dashboard.js`
- `g281_bom_validation_view.js`
- `g281_workbook_viewer.js`
- `g281_repo.js`

Use this for:

- dashboard rendering
- modal/view logic
- persistence helpers
- compute helpers that must run directly in the browser

### 2. Build-Source Modules

Use `src/` only for code that must be bundled before the browser consumes it.

Current example:

- `src/g281_univer_template_editor.entry.js`

If you add another compiled entry, keep the source in `src/` and emit the built artifact into `vendor/` or another explicit generated location.

### 3. Generated Data Files

Keep generated data at the root with explicit `g281_data_*` names.

Examples:

- `g281_data_master.json`
- `g281_data_bom_validation.json`
- `g281_data_bundle.js`

If a change affects generated data, update the corresponding generator script instead of hand-editing the generated output only.

### 4. Release And Validation Artifacts

- `releases/` is for versioned deliverables
- `output/` is for validation artifacts such as screenshots or analysis outputs

Do not mix runtime source files into either directory.

---

## Naming Conventions

### File Names

- Runtime JS: `g281_<domain>.js`
- Runtime CSS: `g281_<domain>.css`
- Generator scripts: `g281_generate_<domain>.py`
- Repo/DB wrappers: `g281_<domain>_repo.js`, `g281_<domain>_db.js`
- Build entry source: `src/g281_<domain>.entry.js`

### Global Names

Use `window.G281*` or `global.G281*` for exported browser modules.

Examples:

- `window.G281DashboardBridge`
- `global.G281Repo`
- `global.G281BomDb`
- `window.G281UniverTemplateEditor`

Do not export anonymous or generic globals such as `window.repo`, `window.viewer`, or `window.state`.

---

## When Adding A New Feature

1. Add a root-level JS module if it is a runtime feature.
2. Add a same-domain CSS file only if the feature introduces a meaningful visual surface.
3. Load the file explicitly from `g281_profit_dashboard.html`.
4. If the HTML references the file with `?v=...`, update the version query when shipping the change.
5. If the feature needs persistence, add a dedicated repo/db wrapper instead of burying storage writes inside unrelated modules.

---

## Examples

### Main Page Shell

- `g281_profit_dashboard.html`
- `g281_profit_dashboard.js`
- `g281_profit_dashboard.css`

### Modal / Feature Module Pair

- `g281_workbook_viewer.js`
- `g281_workbook_viewer.css`

### Persistence Pair

- `g281_bom_db.js`
- `g281_factor_version_repo.js`

### Build-Only Entry

- `src/g281_univer_template_editor.entry.js`
- `vendor/univer-editor/g281_univer_template_editor.js`
