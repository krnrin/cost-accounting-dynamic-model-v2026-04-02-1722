# 高压线束成本核算动态模型 — 完整分析与优化报告

> **项目**: cost-accounting-dynamic-model-v2026-04-02-1722  
> **版本**: v2026.04.02-1722  
> **分析日期**: 2026-04-03  

---

## 一、项目架构概述

本项目是一个**高压线束利润引擎**（E281/G281项目），将传统 Excel 利润模型转化为动态、版本化的 Web 应用。

### 五层架构

| 层级 | 组件 | 功能 |
|:---|:---|:---|
| **数据源** | 9个 Excel 工作簿 | BOM、报价、定点、TT、协议价等原始数据 |
| **提取层** | 9个 Python 脚本 (`g281_generate_*.py`) | 解析 Excel → JSON |
| **数据层** | 14个 JSON 文件 (`g281_data_*.json`) | 结构化中间存储 |
| **计算引擎** | `engine/` 目录 (JS) | 年度计算、Shapley利润归因、目标价求解 |
| **展示层** | `pages/` + `ui/` + `charts/` | 仪表板、BOM对比、工厂效率、包装验证 |

### 关键技术栈
- **前端**: 原生 JS + Univer 电子表格引擎 + IndexedDB 离线存储
- **数据管道**: Python 3 + openpyxl + xlrd
- **构建**: esbuild + PowerShell 脚本
- **运行模式**: 离线优先（`file://` 或 `python -m http.server`）

---

## 二、Excel 文件分析

### 2.1 错误汇总

| 文件 | 大小 | 公式数 | 错误总数 | 错误类型 |
|:---|:---|:---|:---|:---|
| **吉利E281报价核算.xlsx** | 472 KB | 5,182 | **191** | `#REF!` (29), `#VALUE!` (159), `#REF!` (3) |
| **吉利E281定点核算.xlsx** | 514 KB | 8,074 | **7** | `#REF!` (4), `#DIV/0!` (3) |
| **source.xlsx** | 514 KB | 8,074 | **7** | `#REF!` (4), `#DIV/0!` (3) |
| **G281高压协议价.xlsx** | 147 KB | 159 | **70** | `#N/A` (70) |
| **G281 TT.xlsx** | 2,374 KB | 1,623 | **72** | `#REF!` (72) |
| **G281 TT_实际开线长度已回填.xlsx** | 2,349 KB | 1,624 | **72** | `#REF!` (72) |
| **G281 定点BOM V06.xlsx** | 8,604 KB | 1,186 | **5** | `#N/A` (5) |
| **G281 报价BOM V03.xlsx** | 4,305 KB | 569 | **0** | 无错误 ✅ |

### 2.2 严重问题详解

#### 🔴 吉利E281报价核算.xlsx — 191个错误（严重）

**问题1: 项目汇总表 `#REF!` 错误 (29处)**
- 位置: B2, C9, E9, C13, E13, C19-C35 等
- 原因: 公式引用了已被删除的工作表或行/列
- 影响: 项目汇总表几乎完全失效，无法正确计算利润率和成本占比

**问题2: 项目评估汇总表 `#VALUE!` 错误 (131处)**
- 位置: E10-K10, E11-K11 (跨年份) 等
- 原因: 公式中存在类型不匹配（文本被当作数字计算）
- 影响: 6个年度的收入、成本等核心财务数据全部失效

**问题3: 配置明细表 `#VALUE!` + `#REF!` (16处)**
- 位置: G3, H3-H29, K3
- 原因: 跨表引用断裂
- 影响: 配置明细的核心计算列完全失效

#### 🟡 G281高压协议价.xlsx — 70个 `#N/A` 错误

- 位置: 总成散件清单 N/O列（VLOOKUP 查找列）
- 原因: VLOOKUP 查找范围中缺少对应的零件编号
- 影响: 约35个零件的协议价无法自动关联

#### 🟡 G281 TT.xlsx — 72个 `#REF!` 错误

- 位置: 工作表 `6608442966` 的 N/P 列
- 原因: 公式引用了被删除的列
- 影响: 该总成的导线长度和成本计算异常

---

## 三、计算引擎代码分析

### 3.1 严重 Bug

| # | 文件 | 严重度 | 问题描述 |
|:---|:---|:---|:---|
| 1 | `engine/compute_model.js:1124` | 🔴 高 | **除零风险**: 金属价格因子计算 `(d.copperPrice - BASE.copperPrice) / BASE.copperPrice`，当 BASE 价格为0时产生 `Infinity/NaN`，导致整个财务模型崩溃 |
| 2 | `engine/bom_db.js:429` | 🔴 高 | **O(N) 性能退化**: `listVersions` 从 IndexedDB 加载全表数据后在 JS 中过滤，随 BOM 版本增长导致内存溢出和严重卡顿 |
| 3 | `engine/bom_db.js:467` | 🟡 中 | **竞态条件**: 多次快速调用 `init()` 可能创建重复 DB 连接 |
| 4 | `engine/compute_model.js:1078` | 🟡 中 | **属性访问脆弱**: 直接索引 `BASE.versions.bom[key]` 无容错，配置异常时硬崩溃 |
| 5 | `engine/profit_shapley.js:179` | 🟡 中 | **UI线程阻塞**: Shapley O(2^n) 算法在主线程运行，12因子需4,096次完整引擎评估，界面冻结 |
| 6 | `engine/computation_cache.js:62` | 🟡 中 | **缓存开销过大**: 每次滑块移动都触发 `JSON.stringify` 生成 cache key，大对象序列化比直接计算还慢 |

### 3.2 修复建议

```javascript
// Bug #1 修复: compute_model.js:1124
const copperFactor = BASE.copperPrice > 0
  ? 1 + ((d.copperPrice - BASE.copperPrice) / BASE.copperPrice) * ms.copper
  : 1;

// Bug #2 修复: bom_db.js:429 - 使用 IndexedDB 索引
const records = projectId
  ? await store.index('projectId').getAll(projectId)
  : await getAllRecords(config.storeName);

// Bug #4 修复: compute_model.js:1078
const bomOption = BASE.versions?.bom?.[currentState.bom] || defaultBom;
const metal = BASE.versions?.metal?.[currentState.metal] || defaultMetal;

// Bug #6 修复: computation_cache.js - 使用版本号代替全量序列化
const cacheKey = `${draft._version}||${state._version}`;
```

---

## 四、Python 数据提取脚本分析

### 4.1 严重 Bug

| # | 文件 | 严重度 | 问题描述 |
|:---|:---|:---|:---|
| 1 | `g281_generate_bom_validation.py:246` | 🔴 高 | `next(name for name in sheetnames if "KSK" in name)` 无默认值，表名不含 "KSK" 时抛 `StopIteration` 崩溃 |
| 2 | `g281_generate_bom_versions.py:150` | 🔴 高 | `tape_factor / wire_factor` 除零风险，`quote_wire=0` 时崩溃 |
| 3 | `g281_generate_financial_versions.py:217` | 🔴 高 | `annual_profit / annual["revenue"]` 除零风险，某年度收入为0时崩溃 |
| 4 | `g281_generate_capital_validation.py:130` | 🔴 高 | 使用工作表**索引**(`sheetIndex: 6,7,8`)而非**名称**访问，工作簿结构变化时读取错误数据 |
| 5 | `g281_generate_wire_catalog.py:396` | 🔴 高 | `float(section) / source_section`，`section` 可能为 `None` |
| 6 | `g281_generate_config_sheet_copies.py:394` | 🟡 中 | 两次 `load_workbook(read_only=False)` 加载同一文件，2倍内存消耗 |
| 7 | `g281_apply_version_seed_data.py:132` | 🔴 高 | 使用 `xlrd` 读取文件，`xlrd` 不再支持 `.xlsx`，仅支持 `.xls` |
| 8 | `g281_generate_labor_validation.py:264` | 🟡 中 | 物料损耗率 `0.005` 硬编码，应从配置读取 |
| 9 | `e281_sync_wire_prices.py:436` | 🟡 中 | `excel.Quit()` 无 `try/finally` 保护，异常时遗留 Excel 进程 |

### 4.2 通用问题

| 问题类别 | 影响范围 | 描述 |
|:---|:---|:---|
| **硬编码单元格地址** | 所有 `generate_*` 脚本 | 使用 `E5`, `E14` 等固定地址，Excel 模板插入行/列后提取数据错位 |
| **硬编码中文工作表名** | 全部脚本 | `配置清单`, `项目评估汇总` 等中文名硬编码，不同编码环境下可能匹配失败 |
| **硬编码文件名版本号** | 多个脚本 | `V03-12.4`, `V06-2026.01.20` 等，文件命名变更时自动化失败 |
| **缺少跨工作簿校验** | 全局 | BOM 中出现的零件号未校验是否存在于协议价/成本主数据中 |

### 4.3 修复建议

```python
# Bug #1 修复: g281_generate_bom_validation.py:246
ksk_sheet = next((name for name in workbook.sheetnames if "KSK" in name), None)
if ksk_sheet is None:
    raise ValueError(f"未找到包含 'KSK' 的工作表: {workbook.sheetnames}")

# Bug #2 修复: g281_generate_bom_versions.py:150
wire_factor = (current_wire / quote_wire) if quote_wire > 0 else 1.0

# Bug #4 修复: g281_generate_capital_validation.py:130
SHEET_NAMES = {"equipment": "设备投资明细", "mold": "项目专用模具", "tooling": "项目工装投入"}
sheet_name = next((s for s in workbook.sheetnames if SHEET_NAMES[key] in s), None)

# Bug #7 修复: g281_apply_version_seed_data.py - 迁移到 openpyxl
# 将 xlrd 替换为 openpyxl，支持 .xlsx 格式
from openpyxl import load_workbook
wb = load_workbook(filepath, data_only=True, read_only=True)
```

---

## 五、UI/前端代码分析

### 5.1 Bug 与逻辑错误

| # | 文件 | 严重度 | 问题描述 |
|:---|:---|:---|:---|
| 1 | `g281_bom_alignment_engine.js:142` | 🔴 高 | **O(N²) 过滤**: `pairByKey` 中使用 `.some()` 遍历匹配，大 BOM 数据严重卡顿 |
| 2 | `g281_bom_semantic_repo.js:122` | 🟡 中 | **非原子操作**: 删除+新增未包裹在同一事务中，中途失败导致数据不一致 |
| 3 | `g281_bom_io.js:36` | 🟡 中 | **格式检测盲区**: `ArrayBuffer` 直接假定为 xlsx，未检查文件头魔数 |
| 4 | `ui/workbook_viewer.js:95` | 🟡 中 | **低效克隆**: `moveSheetToFront` 深拷贝整个工作簿快照（可达数MB）仅为重排sheet |
| 5 | `g281_data_bundle.js` | 🔴 高 | **巨型 JS 文件**: 数十万行硬编码数据嵌入 JS，严重拖慢页面加载 |
| 6 | `accounting.html:143` | 🟡 中 | **BOM导入桩代码**: 使用 `alert` 代替实际导入逻辑 |
| 7 | `ui/state/scenario_state.js` | 🟡 中 | **未完成实现**: 多处 `TODO` 标记，状态初始化和面板渲染未实现 |

### 5.2 代码重复问题

| 重复模式 | 涉及文件 | 影响 |
|:---|:---|:---|
| `clonePlain`, `toText`, `escapeHtml`, `fmtNumber` | 几乎每个 JS 文件 | 同一工具函数被复制10+次 |
| Labor/Packaging 验证视图结构 | `g281_labor_validation_view.js`, `g281_packaging_validation_view.js` | 70% 代码相同，维护成本翻倍 |
| 深拷贝 `JSON.parse(JSON.stringify())` | 多个视图和引擎文件 | 性能差，应使用 `structuredClone()` |

### 5.3 UI/UX 问题

- **表格溢出**: BOM 验证表格8列布局在 1080p 屏幕上严重水平溢出
- **无虚拟滚动**: 数百个 DOM 节点一次性渲染，大 BOM 打开/滚动时卡顿
- **脚本加载依赖链**: 纯顺序加载，任一中间脚本加载失败导致整个应用崩溃
- **无障碍缺失**: 自定义控件缺少 `tabindex`、`keydown`、`aria-*` 属性

---

## 六、数据管道与 JSON 分析

### 6.1 架构问题

| 问题 | 描述 | 影响 |
|:---|:---|:---|
| **单向管道，无回写** | Python → JSON → JS 单向流动，无法将 Web 端修改同步回 Excel | 数据不一致风险 |
| **遗留文件堆积** | `BOM核对/` 中含 v1/v2/v3 多个废弃提取脚本 | 维护混淆 |
| **版本管理密集** | `release_timeline.json` 显示同日多次发布 | 部署风险增加 |
| **PowerShell 构建脚本** | `g281_build_runtime_bundle.ps1` 将所有 JSON 合并为单一 JS | 平台依赖，非跨平台 |

### 6.2 数据完整性风险

- `g281_data_master.json` 中的金属价格（铜价、铝价）与 Excel 源可能不同步
- `g281_data_wire_catalog.json` 中的线材单价依赖金属价格基准，基准变化后需手动重新生成
- `g281_data_bom_validation.json` 的零件匹配结果是静态快照，BOM 更新后需重新运行

---

## 七、优化建议优先级矩阵

### P0 — 立即修复（影响数据正确性）

| 编号 | 行动 | 预计工时 |
|:---|:---|:---|
| P0-1 | 修复 `吉利E281报价核算.xlsx` 中 191 个公式错误，重建 `项目汇总` 表引用链 | 4h |
| P0-2 | 修复 `compute_model.js` 除零风险（金属价格因子） | 0.5h |
| P0-3 | 修复 `bom_db.js` O(N) 全表加载 → 使用 IndexedDB 索引查询 | 1h |
| P0-4 | 修复 Python 脚本除零风险（`bom_versions`, `financial_versions`, `wire_catalog`） | 2h |
| P0-5 | 将 `g281_apply_version_seed_data.py` 从 xlrd 迁移到 openpyxl | 1h |

### P1 — 短期优化（影响稳定性和性能）

| 编号 | 行动 | 预计工时 |
|:---|:---|:---|
| P1-1 | `capital_validation.py` 使用工作表名称替代索引号 | 1h |
| P1-2 | 修复 `bom_alignment_engine.js` O(N²) → Set O(1) 查找 | 1h |
| P1-3 | 将 Shapley 计算移至 Web Worker | 4h |
| P1-4 | 替换 `computation_cache.js` 的 `JSON.stringify` 为版本号哈希 | 1h |
| P1-5 | 修复 `bom_semantic_repo.js` 非原子 IndexedDB 操作 | 2h |
| P1-6 | 修复 G281 TT.xlsx 中 72 个 `#REF!` 错误 | 2h |
| P1-7 | 修复 G281高压协议价.xlsx 中 70 个 `#N/A` VLOOKUP 匹配失败 | 2h |

### P2 — 中期重构（影响可维护性）

| 编号 | 行动 | 预计工时 |
|:---|:---|:---|
| P2-1 | 提取公共工具函数 (`clonePlain`, `fmtNumber` 等) 到统一模块 | 4h |
| P2-2 | 合并 Labor/Packaging 验证视图为参数化组件 | 8h |
| P2-3 | `g281_data_bundle.js` 拆分为异步 JSON 加载 | 4h |
| P2-4 | Python 脚本统一使用 `read_only=True` + 按名称匹配工作表 | 4h |
| P2-5 | 添加虚拟滚动支持 | 8h |
| P2-6 | 实现脚本加载错误边界和用户提示 | 4h |
| P2-7 | 清理 `BOM核对/` 中的遗留脚本 | 1h |

### P3 — 长期演进

| 编号 | 行动 | 预计工时 |
|:---|:---|:---|
| P3-1 | 跨工作簿零件号一致性校验机制 | 8h |
| P3-2 | 双向数据同步（Web → Excel） | 16h |
| P3-3 | 跨平台构建（PowerShell → Node.js 构建脚本） | 4h |
| P3-4 | 完善无障碍访问（ARIA 标签、键盘导航） | 8h |

---

## 八、总结

### 问题统计

| 类别 | 🔴 严重 | 🟡 中等 | 🟢 低 |
|:---|:---|:---|:---|
| Excel 公式错误 | 3 文件 (333处) | 2 文件 (77处) | 1 文件 (5处) |
| JS 引擎 Bug | 3 | 5 | 3 |
| Python 脚本 Bug | 5 | 4 | 3 |
| UI/前端问题 | 2 | 5 | 4 |
| 架构/数据管道 | 1 | 3 | 3 |

### 核心结论

1. **Excel 层**: `吉利E281报价核算.xlsx` 有 191 个公式错误，是最紧迫的问题。项目汇总表和评估汇总表基本瘫痪。
2. **计算引擎**: 设计精良但缺乏防御性编程，除零风险和性能退化是主要隐患。
3. **Python 管道**: 高度依赖 Excel 模板结构，硬编码严重，任何模板变更都可能导致数据提取失败。
4. **前端**: 功能完整但代码重复率高、缺乏虚拟滚动和错误边界，大数据集下性能堪忧。
5. **整体**: 项目从 Excel 向 Web 转型的核心架构是合理的，但需要在防御性编程、性能优化、和代码复用三个维度进行系统性加固。
