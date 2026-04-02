# Quality Guidelines

> Code quality standards for frontend development in this project.

---

## Overview

This repo is an **offline browser application with generated data and browser-side persistence**.

Quality here means:

- no accidental network dependency
- stable browser behavior after refresh
- safe persistence behavior
- explicit asset wiring
- targeted validation for the surface you changed

There is no broad lint/test suite today, so review discipline and targeted validation matter more than generic "it builds" claims.

---

## Forbidden Patterns

### 1. New Network Calls Or Telemetry

Do not add analytics, background fetches, or hidden network dependencies.

This dashboard is designed to run offline from local files or a simple local server.

### 2. Unguarded Global Dependencies

Do not assume `window.G281*`, `window.XLSX`, or DOM nodes always exist without checking.

### 3. Ad Hoc Persistence Contracts

Do not invent raw storage access patterns in random modules if a repo/db wrapper already exists.

### 4. Missing Cache-Bust Updates

When HTML wires CSS or JS files with `?v=...`, update the version query when the asset changes and the deployment path depends on cache invalidation.

Examples:

- `g281_profit_dashboard.html` loads `g281_profit_dashboard.css?v=...`
- `g281_profit_dashboard.html` loads `g281_profit_dashboard.js?v=...`

### 5. Large Behavior Changes Without Browser Validation

Do not mark a UI change done without opening the page and checking the exact affected flow.

---

## Required Patterns

### 1. Guard + Fallback

Required for:

- browser storage
- optional globals
- generated data availability
- modal/editor integration

Use:

- early `return`
- `console.warn(...)`
- `return null` / `return false`
- clear `throw new Error(...)` for hard requirements

### 2. Feature-Owned CSS

If a feature owns a major surface, give it a dedicated CSS file and wire it explicitly from HTML.

### 3. Namespaced Browser Exports

Expose browser-facing APIs as `window.G281*` or `global.G281*`.

### 4. Offline-Safe Validation

Every significant UI change should be validated in the browser with the real page assets.

### 5. Keep Release Hygiene

If the change is intended for a released copy:

- update the loaded asset versions
- regenerate bundles if source data changed
- publish a versioned release copy when that is the current project workflow

---

## Testing Requirements

### If You Edit `src/g281_univer_template_editor.entry.js`

Run:

```bash
npm run build:univer-editor
```

and verify the generated vendor bundle still works in the dashboard.

### If You Edit Generated Data Or Parsers

Run the relevant `g281_generate_*.py` or bundle-generation scripts, then validate the consuming UI flow.

### If You Edit JS / HTML / CSS Runtime Wiring

Validate in the browser:

- open `g281_profit_dashboard.html`
- use a fresh query param when helpful
- check the exact changed panel, modal, or workflow
- confirm no new blocking console errors

### If You Edit Persistence Logic

Validate both:

- save path
- reload / restore path

---

## Code Review Checklist

- Did the change preserve offline behavior?
- Are required globals and DOM nodes guarded?
- Is persistence routed through the right wrapper?
- If HTML wiring changed, were asset versions updated?
- Was the exact user flow validated in the browser?
- Does the spec need an update because a new pattern or gotcha was discovered?
