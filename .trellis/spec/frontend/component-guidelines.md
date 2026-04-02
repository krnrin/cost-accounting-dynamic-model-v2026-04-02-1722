# Component Guidelines

> How UI modules are built in this project.

---

## Overview

In this project, a "component" usually means a **DOM-driven feature module**, not a JSX component.

Typical units are:

- the main dashboard coordinator
- a modal or drawer
- a workbook/editor shell
- a feature-specific panel mounted into an existing DOM container

Examples:

- `g281_profit_dashboard.js`
- `g281_bom_validation_view.js`
- `g281_workbook_viewer.js`

---

## Standard Module Structure

Follow this pattern:

1. Wrap the module in an IIFE when it exports a browser global.
2. Read runtime dependencies early and fail fast if required globals are missing.
3. Cache DOM references once near the top.
4. Keep module state in a closure object.
5. Use small helper functions for normalization, escaping, cloning, and DOM refresh.
6. Keep rendering and event binding as named functions.
7. Export a minimal, namespaced bridge only if another module needs to call into it.

Examples:

- `g281_bom_validation_view.js` reads all required DOM nodes up front and returns early if they are missing.
- `g281_workbook_viewer.js` keeps `viewerState` as the single closure state container.
- `g281_profit_dashboard.js` uses `render()` and `bind()` as the top-level orchestration pair.

---

## UI Composition Rules

### Prefer Existing DOM Anchors

Prefer mounting into explicit IDs already defined in `g281_profit_dashboard.html`.

Examples:

- `versionTemplateFields`
- `versionTimelineMount`
- `bomValidationGroups`

### Use Dynamic DOM Injection Sparingly

Dynamic insertion is allowed when the UI is driven by runtime state or feature gating.

Good example:

- `g281_profit_dashboard.js` dynamically inserts version groups and timeline sections when needed.

When injecting markup:

- create a stable anchor first
- keep class names explicit
- bind listeners immediately after insertion, or use local event delegation on the owning container

### Keep Feature Ownership Clear

One module should own one surface area.

Examples:

- `g281_bom_validation_view.js` owns the BOM validation modal
- `g281_workbook_viewer.js` owns the workbook viewer modal
- `g281_profit_dashboard.js` owns page-level orchestration and cross-feature rendering

Do not spread one modal's open/close/render logic across multiple unrelated files.

---

## Styling Patterns

### Dedicated CSS Files

Use a dedicated CSS file for feature-sized UI surfaces.

Examples:

- `g281_profit_dashboard.css`
- `g281_bom_validation.css`
- `g281_workbook_viewer.css`

### Shared Design Tokens

Use the CSS variables defined in `g281_profit_dashboard.css` `:root` when possible.

Examples:

- `--bg`
- `--panel`
- `--text`
- `--accent`
- `--radius`

Do not hardcode unrelated color systems inside a new feature if the page already exposes tokens that fit.

### HTML Wiring

Load CSS explicitly from `g281_profit_dashboard.html`. Keep visual dependencies visible in HTML instead of relying on runtime CSS injection.

---

## Accessibility

This repo does not have a formal a11y framework, but these baseline rules apply:

- Use real `<button>` elements for clickable actions.
- Use `<label>` with form fields where input is editable.
- Support Escape and explicit close buttons for modal surfaces.
- Support backdrop click only when it matches the existing modal pattern.
- Restore or preserve focus when the module already does so.

Good examples:

- `g281_workbook_viewer.js` handles backdrop click, close buttons, and keyboard close behavior.
- `g281_profit_dashboard.js` marks the version timeline trigger with button-like semantics and `aria-haspopup`.

---

## Common Mistakes

### Mistake: Treating This Repo Like React

Do not add JSX-style component assumptions to root runtime modules. The dashboard runtime is plain browser JavaScript.

### Mistake: Replacing Large DOM Blocks Without Rebinding

If you replace `innerHTML` for a feature region, immediately rebind listeners or keep delegation on the owning container.

### Mistake: Exporting Broad Globals

Wrong:

```js
window.viewer = viewerState;
```

Correct:

```js
window.G281WorkbookViewer = {
  open,
  close,
};
```

### Mistake: Forgetting Companion CSS Wiring

If a new feature needs new classes and styles, add the CSS file and wire it in HTML. Do not hide styling in scattered inline rules.
