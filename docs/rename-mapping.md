# 文件重命名映射表 (Issue #14 ① 层)

## 目标

去掉所有 `g281_` 前缀，使程序可用于任意项目。

## 重命名规则

1. `g281_` 前缀 → 去掉
2. 功能语义不变
3. 目录结构调整：业务逻辑进 `engine/`，UI 进 `ui/`，工具进 `core/`

## 映射表

| 原文件名 | 新路径 | 说明 |
|---|---|---|
| `g281_engine.js` | `engine/compute_model.js` | 计算引擎主模块 |
| `g281_target_price_solver.js` | `engine/target_price_solver.js` | 目标价二分求解 |
| `g281_profit_shapley.js` | `engine/profit_shapley.js` | Shapley 归因 |
| `g281_harness_profit.js` | `engine/harness_profit.js` | 线束利润拆解 |
| `g281_bom_parser.js` | `engine/bom_parser.js` | BOM 解析器 |
| `g281_bom_schema.js` | `engine/bom_schema.js` | BOM 数据模型 |
| `g281_bom_db.js` | `engine/bom_db.js` | BOM 存储 |
| `g281_repo.js` | `core/repo.js` | 数据仓库（已迁移到 StorageAdapter） |
| `g281_profit_dashboard.html` | `ui/dashboard.html` | 主页面 |
| `g281_profit_dashboard.css` | `ui/dashboard.css` | 主样式 |
| `g281_profit_dashboard.js` | `ui/dashboard.js` | 主控制器 |
| `g281_profit_insights.js` | `ui/insights.js` | 利润洞察卡片 |
| `g281_profit_logic_drawer.js` | `ui/logic_drawer.js` | 逻辑抽屉 |
| `g281_version_timeline.js` | `ui/version_timeline.js` | 版本时间线 |
| `g281_workbook_viewer.js` | `ui/workbook_viewer.js` | 工作簿查看器 |
| *(新增)* | `core/config_loader.js` | 配置加载器 |
| *(新增)* | `core/storage_adapter.js` | 项目隔离存储 |
| *(新增)* | `config/g281.project.json` | G281 项目配置 |

## 全局命名空间映射

| 原全局对象 | 新全局对象 | 说明 |
|---|---|---|
| `G281Engine` | `ComputeModel` | 去项目前缀 |
| `G281BomParser` | `BomParser` | 去项目前缀 |
| `G281BomSchema` | `BomSchema` | 去项目前缀 |
| `G281BomDb` | `BomDb` | 去项目前缀 |
| `G281Repo` | `Repo` | 去项目前缀（后续迁移到 StorageAdapter） |
| `G281HarnessProfit` | `HarnessProfit` | 去项目前缀 |
| *(新增)* | `ConfigLoader` | 配置加载器 |
| *(新增)* | `StorageAdapter` | 存储适配器 |

## 执行步骤

### 第 1 步：创建目录结构

```
project-root/
├── config/          # 项目配置
│   └── g281.project.json
├── core/            # 基础设施
│   ├── config_loader.js
│   ├── storage_adapter.js
│   └── repo.js
├── engine/          # 业务逻辑
│   ├── compute_model.js
│   ├── target_price_solver.js
│   ├── profit_shapley.js
│   ├── harness_profit.js
│   ├── bom_parser.js
│   ├── bom_schema.js
│   └── bom_db.js
├── ui/              # 前端 UI
│   ├── dashboard.html
│   ├── dashboard.css
│   ├── dashboard.js
│   ├── insights.js
│   ├── logic_drawer.js
│   ├── version_timeline.js
│   └── workbook_viewer.js
├── utils/           # 工具函数 (Issue #10)
│   ├── format.js
│   └── parse.js
└── docs/            # 文档
    ├── rename-mapping.md
    ├── phase1-cleanup-checklist.md
    └── session-context-*.md
```

### 第 2 步：批量重命名

建议使用 `git mv` 保留历史：

```bash
# 创建目录
mkdir -p core engine ui utils

# 业务逻辑
git mv g281_engine.js engine/compute_model.js
git mv g281_target_price_solver.js engine/target_price_solver.js
git mv g281_profit_shapley.js engine/profit_shapley.js
git mv g281_harness_profit.js engine/harness_profit.js
git mv g281_bom_parser.js engine/bom_parser.js
git mv g281_bom_schema.js engine/bom_schema.js
git mv g281_bom_db.js engine/bom_db.js

# 基础设施
git mv g281_repo.js core/repo.js

# UI
git mv g281_profit_dashboard.html ui/dashboard.html
git mv g281_profit_dashboard.css ui/dashboard.css
git mv g281_profit_dashboard.js ui/dashboard.js
git mv g281_profit_insights.js ui/insights.js
git mv g281_profit_logic_drawer.js ui/logic_drawer.js
git mv g281_version_timeline.js ui/version_timeline.js
git mv g281_workbook_viewer.js ui/workbook_viewer.js
```

### 第 3 步：更新引用

1. `dashboard.html` 中的 `<script>` 路径
2. 各文件中的 `G281*` 全局对象引用
3. `docs/session-context-*.md` 中的文件路径引用

### 第 4 步：兼容层（可选）

```javascript
// 临时兼容：旧全局名指向新对象
window.G281Engine = window.ComputeModel;
window.G281BomParser = window.BomParser;
// ... etc
// TODO: 1-2 个版本后移除兼容层
```

## 注意事项

- HTML 文件极大（~40KB），建议本地执行而非通过 API 推送
- 文件重命名应在一个 commit 内完成，避免中间状态破坏引用
- 全局对象重命名可以分步做（先加兼容层，后逐步迁移）
