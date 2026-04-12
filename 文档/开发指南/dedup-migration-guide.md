# Issue #10: 跨模块工具函数去重 — 迁移指南

## 1. 问题

以下函数在 5+ 个文件中各自定义了一份副本：

| 函数 | 重复文件 |
|---|---|
| `clonePlain` | `utils/core.js`, `engine/shared_utils.js`, `engine/profit_shapley.js`, `engine/bom_db.js`, `g281_factor_version_repo.js` |
| `numberOr` / `coerceNumber` | `engine/shared_utils.js`, `utils/core.js` |
| `safeArray` / `ensureArray` | `engine/shared_utils.js`, `g281_factor_version_repo.js` |
| `clamp` | `engine/shared_utils.js`, `utils/core.js` |
| `toText` | `utils/core.js`, `g281_factor_version_repo.js` |

## 2. 解决方案

创建 `utils/shared.js` 作为**唯一权威来源 (Single Source of Truth)**。

所有模块通过 `G281Shared.xxx` 或 `window.G281Shared.xxx` 引用。

## 3. 迁移步骤（本地执行）

### Step 1: 在 HTML 中加载 shared.js（最先加载）

```html
<!-- 在所有 engine/utils 脚本之前 -->
<script src="./utils/shared.js"></script>
```

### Step 2: 替换各模块中的本地定义

#### engine/shared_utils.js
```diff
- const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
+ const clamp = G281Shared.clamp;

- function numberOr(value, fallback) { ... }
+ const numberOr = G281Shared.numberOr;

- function safeArray(value) { ... }
+ const safeArray = G281Shared.safeArray;

- function clonePlain(value, fallback) { ... }
+ const clonePlain = G281Shared.clonePlain;
```

#### engine/profit_shapley.js
```diff
- function clonePlain(value, fallback) { ... }
+ const clonePlain = G281Shared.clonePlain;
```

#### engine/bom_db.js
```diff
- const clonePlain = (value, fallback = null) => { ... };
+ const clonePlain = G281Shared.clonePlain;
```

#### g281_factor_version_repo.js
```diff
- const clonePlain = (value, fallback = null) => { ... };
+ const clonePlain = G281Shared.clonePlain;

- const toText = (value, fallback = '') => { ... };
+ const toText = G281Shared.toText;

- const ensureArray = (value) => (Array.isArray(value) ? value : []);
+ const ensureArray = G281Shared.safeArray;
```

#### utils/core.js
```diff
- function coerceNumber(value, fallback) { ... }
+ const coerceNumber = G281Shared.coerceNumber;

- function clonePlain(value, fallback) { ... }
+ const clonePlain = G281Shared.clonePlain;

- function clamp(v, min, max) { ... }
+ const clamp = G281Shared.clamp;
```

### Step 3: 验证

1. 在浏览器控制台运行 `typeof G281Shared.clonePlain === 'function'` → `true`
2. 确认 `G281Core.clonePlain === G281Shared.clonePlain` → `true`（向后兼容）
3. 搜索全文确认不再有独立的 `clonePlain` 函数定义

## 4. 向后兼容

- `G281Core` 命名空间自动指向 `G281Shared`（如果尚未被定义）
- `engine/shared_utils.js` 中的 `G281SharedUtils` 仍可用，但建议迁移到 `G281Shared`
