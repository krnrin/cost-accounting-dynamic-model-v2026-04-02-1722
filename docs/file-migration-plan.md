# 文件迁移计划 (Phase 4)

## 概述

当前根目录有 30+ 个 `g281_*` 前缀文件需要迁移到模块化目录。

## 迁移映射

### JS 业务逻辑 → engine/

| 原路径 | 新路径 | 大小 |
|--------|--------|------|
| `g281_bom_alignment_engine.js` | `engine/bom_alignment_engine.js` | 12KB |
| `g281_bom_diff_engine.js` | `engine/bom_diff_engine.js` | 17KB |
| `g281_bom_io.js` | `engine/bom_io.js` | 14KB |
| `g281_bom_semantic_repo.js` | `engine/bom_semantic_repo.js` | 8KB |
| `g281_bom_template_runtime.js` | `engine/bom_template_runtime.js` | 31KB |

### JS 数据仓库 → core/

| 原路径 | 新路径 | 大小 |
|--------|--------|------|
| `g281_factor_version_repo.js` | `core/factor_version_repo.js` | 7KB |
| `g281_scenario_repo.js` | `core/scenario_repo.js` | 4KB |

### JS UI 视图 → ui/

| 原路径 | 新路径 | 大小 |
|--------|--------|------|
| `g281_bom_validation_view.js` | `ui/bom_validation_view.js` | **218KB** ⚠️ |
| `g281_capital_validation_view.js` | `ui/capital_validation_view.js` | 26KB |
| `g281_labor_validation_view.js` | `ui/labor_validation_view.js` | 13KB |
| `g281_packaging_validation_view.js` | `ui/packaging_validation_view.js` | 22KB |
| `g281_factory_efficiency_view.js` | `ui/factory_efficiency_view.js` | 18KB |
| `g281_operating_labor_rate_data.js` | `ui/operating_labor_rate_data.js` | 3KB |

### CSS → ui/

| 原路径 | 新路径 | 大小 |
|--------|--------|------|
| `g281_bom_validation.css` | `ui/bom_validation.css` | 24KB |
| `g281_factory_efficiency_view.css` | `ui/factory_efficiency_view.css` | 6KB |

### JSON 数据 → data/

所有 `g281_data_*.json` 文件移到 `data/` 目录。

### Python 脚本 → scripts/

所有 `g281_generate_*.py` 及辅助脚本移到 `scripts/` 目录。

### 需删除的文件

| 文件 | 原因 |
|------|------|
| `MEMORY.md` | Claude Code 会话记忆 |
| `AGENTS.md` | Copilot Agent 配置 |
| `.agents/` | Copilot Agent 目录 |
| `.trellis/` | Trellis 配置目录 |
| `memory/` | 会话记忆目录 |
| `source.xlsx` | 与 `吉利E281定点核算.xlsx` 完全相同（SHA `941c778a`） |

## 执行步骤

### 方式 A: 使用迁移脚本（推荐）

```powershell
# PowerShell
.\scripts\migrate-root-files.ps1
```

```bash
# Bash
chmod +x scripts/migrate-root-files.sh
./scripts/migrate-root-files.sh
```

### 方式 B: 手动逐步执行

见 `docs/rename-mapping.md`

## 迁移后必须更新的引用

### 1. `ui/dashboard.html` 中的 `<script>` 标签

文件迁移后，以下引用必须更新：

```html
<!-- 旧 -->                                    <!-- 新 -->
../g281_factor_version_repo.js          →  ../core/factor_version_repo.js
../g281_scenario_repo.js                →  ../core/scenario_repo.js
../g281_bom_semantic_repo.js            →  ../engine/bom_semantic_repo.js
../g281_bom_alignment_engine.js         →  ../engine/bom_alignment_engine.js
../g281_bom_diff_engine.js              →  ../engine/bom_diff_engine.js
../g281_bom_io.js                       →  ../engine/bom_io.js
../g281_data_bundle.js                  →  ../data/g281_data_bundle.js
../g281_operating_labor_rate_data.js     →  ../ui/operating_labor_rate_data.js
../g281_factory_efficiency_view.js       →  ../ui/factory_efficiency_view.js
../g281_bom_template_runtime.js          →  ../engine/bom_template_runtime.js
../g281_bom_validation_view.js           →  ../ui/bom_validation_view.js
../g281_capital_validation_view.js       →  ../ui/capital_validation_view.js
../g281_labor_validation_view.js         →  ../ui/labor_validation_view.js
../g281_packaging_validation_view.js     →  ../ui/packaging_validation_view.js
```

### 2. `ui/dashboard.html` 中的 `<link>` 标签

```html
<!-- 旧 -->                                    <!-- 新 -->
../g281_bom_validation.css              →  ./bom_validation.css
../g281_factory_efficiency_view.css     →  ./factory_efficiency_view.css
```

## 遗留大文件处理

| 文件 | 大小 | 处理方案 |
|------|------|----------|
| `g281_data_bundle.js` | 20MB | 已加入 .gitignore；用 `make data` 本地生成 |
| `g281_data_bom_workbook_copies.json` | 15MB | 已加入 .gitignore |
| `ui/dashboard.js` | 448KB | 需单独 Issue 做真正拆分 |
| `ui/bom_validation_view.js` | 218KB | 需单独 Issue 做拆分 |

## 检查清单

- [ ] 执行迁移脚本
- [ ] 更新 `ui/dashboard.html` 所有引用路径
- [ ] 删除重复文件 `source.xlsx`
- [ ] 本地测试 `ui/dashboard.html` 正常加载
- [ ] 本地测试四个页面 (`pages/*.html`) 正常加载
- [ ] `git add -A && git commit`
- [ ] 推送并创建 PR
