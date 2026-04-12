# CLAUDE.md — 高压线束精算与决策引擎

> 本文件是 Claude Code 的项目级约定，每次会话自动注入。

## 项目概要

这是一个面向汽车高压线束供应商的**成本精算与决策引擎**，支持 BOM → 报价 → 分摊回收 → 设变跟踪 → 预警 的全生命周期经营闭环。

技术栈：React 18 + Vite + TypeScript（前端）/ FastAPI + Python 3.11+（后端）/ SQLite（开发期数据库）

---

## MANDATORY: 自动化 Agent 工作流

每个新 Session 必须严格执行以下流程：

### Step 1: 初始化环境

```powershell
.\init.ps1
```

这会：
- 安装前后端依赖
- 启动 FastAPI 后端 (http://localhost:8000)
- 启动 Vite 前端 (http://localhost:5173)

**不要跳过这一步。** 确保前后端都在运行后再继续。

### Step 2: 选择下一个任务

读取 `task.json`，选择 **一个** 任务执行。

选择标准（按优先级）：
1. 选择 `status: "pending"` 的任务
2. 考虑 `depends_on` — 依赖的任务必须全部 `done`
3. 在满足依赖的前提下，选 id 最小的

### Step 3: 实现任务

- 仔细阅读任务的 scope（backend / frontend / models / business_rules）
- 按 scope 实现功能
- 遵循本文件的代码约定和业务规则

### Step 4: 强制测试（MANDATORY）

**4a. 后端修改：**
```bash
cd backend && python -m pytest tests/ -v
```

**4b. 前端修改 — 必须用 Playwright MCP 浏览器测试：**
- 用 `mcp__playwright__navigate` 打开 http://localhost:5173
- 用 `mcp__playwright__screenshot` 截图验证页面渲染
- 用 `mcp__playwright__click` / `mcp__playwright__fill` 测试交互
- 截图保存到 `./test-screenshots/` 目录

**4c. 大幅度页面修改**（新建页面、重写组件、修改核心交互）：
- **必须在浏览器中测试！** 使用 Playwright MCP 工具
- 验证页面能正确加载和渲染
- 验证表单提交、按钮点击等交互功能
- 截图确认 UI 正确显示

**4d. 小幅度代码修改**（修复 bug、调整样式、添加辅助函数）：
- 可以使用 pytest 或 lint/build 验证
- 如有疑虑，仍建议浏览器测试

**测试清单：**
- [ ] 后端 pytest 通过
- [ ] 前端无 TypeScript 错误
- [ ] 前端 build 成功
- [ ] UI 在浏览器中正常工作（对于前端修改，使用 Playwright MCP）

### Step 5: 更新进度

写入 `progress.txt`：

```
## [YYYY-MM-DD HH:mm] - Task: [T编号] [任务标题]

### 完成的工作:
- [具体改动]

### 测试:
- [如何测试的]

### 备注:
- [下个 session 需要知道的信息]
```

### Step 6: 提交变更（所有改动必须在同一个 commit）

**重要：所有更改必须在同一个 commit 中提交，包括 task.json 的状态更新！**

流程：
1. 更新 `task.json`，将任务的 `status` 从 `"pending"` 改为 `"done"`
2. 更新 `progress.txt` 记录工作内容
3. 一次性提交所有更改：

```bash
git add .
git commit -m "feat(模块): 任务标题 [T编号]"
```

**规则:**
- 只有在所有测试通过后才标记 `status: "done"`
- 永远不要删除或修改任务描述
- 永远不要从列表中移除任务
- 一个 task 的所有内容（代码、progress.txt、task.json）必须在同一个 commit 中提交
- **完成后直接退出，不要问"是否继续"**

---

## ⚠️ 阻塞处理协议

### 需要停止并请求人工帮助的情况：

1. **业务规则不明确**（如：某种费用是否需要按根分摊）
2. **数据模型冲突**（如：发现关系图需要重构）
3. **依赖缺失**（如：需要但未安装的库）
4. **测试持续失败超过 3 次**
5. **任何可能破坏已有数据的操作**

### 阻塞时的正确操作：

**禁止：**
- ❌ 提交 git commit
- ❌ 将 task.json 的 status 设为 done
- ❌ 假装任务已完成

**必须：**
- ✅ 在 progress.txt 中记录当前进度和阻塞原因
- ✅ 输出清晰的阻塞信息
- ✅ 停止任务，等待人工介入

### 阻塞信息格式：

```
🚫 任务阻塞 - 需要人工介入

当前任务: [T编号] [任务名称]

已完成的工作:
- [已完成的代码/配置]

阻塞原因:
- [具体说明]

需要人工帮助:
1. [步骤 1]
2. [步骤 2]
```

---

## 绝对不可违反的业务规则

1. **颗粒度到线束号/BOM 行** — 所有成本、报价、分摊必须精确到线束号和 BOM 行级别，绝不允许回退为项目平均值
2. **双引擎并行** — 内部实绩成本 与 客户报价 是两个独立口径，必须分层实现、并行展示，不得混为一谈
3. **三层价格模型** — 系统存在三层价格，禁止混合计算：
   - **L1 内部核算价**：BOM 成本 + 分摊 + 费率 = 系统自动计算的实绩成本，随 BOM/费率变化实时更新
   - **L2 客户确认快照价**：定点/报价确认时客户承认的价格快照，customer_accepted=true 后锁定不可改
   - **L3 当前有效执行价**：基于回收状态动态决定的实际执行价格，随回收进度自动切换
   - **禁止混合计算**：同一计算/对比中不得将不同层次价格交叉使用。利润差异只能用 L3 vs L1
4. **分摊 ≠ 回收** — 分摊是成本口径（单根分摊金额），回收是执行进度（装车比×累计产量）。分层实现
5. **按根分摊，基数独立** — `unit_allocation = total_amount / baseline_volume`，baseline_volume 为独立业务输入，≠ volume × install_ratio
6. **进度价 ≠ 加权混合价** — 进度价 = 协议价 vs 当前批量价差距追踪，不是历史价格的加权平均
7. **残余材料不计入当前产品成本** — 设变产生的残余材料进入残余材料池 → 呆滞提报流程
8. **场景 ≠ 版本** — 场景是经营语义，版本是时间线追溯。二者独立实现
9. **参数快照化** — 关键节点必须保留费率、参数、BOM 快照，后续修改不覆盖历史结果
10. **字段级权限** — QuoteSnapshot 的 locked_fields（disabled+🔒）、editable_fields（正常可编辑）、approval_fields（可编辑+⚠️待审批）必须在前端体现
11. **回收完成行为** — 回收完成后按 recovery_completion_behavior 执行：trigger_price_adjust / notify_only / archive
12. **承担方分层** — AllocationItem 的 burden_side（supplier/customer/shared）和 pricing_effect（included_in_price/separate_invoice/internal_only）必须独立展示

## 核心计算公式速查

```python
# BOM 行成本
unit_cost = quantity * unit_price

# 线束号成本
harness_cost = sum(bom_row.unit_cost for bom_row in harness.bom_rows)

# 单根分摊（规则 10.3）
unit_allocation = total_amount / baseline_volume  # baseline_volume 为独立输入

# 回收进度（规则 10.4）
recovery_progress = actual_recovered / planned_recovery * 100
actual_recovered = cumulative_volume * install_ratio * unit_allocation

# 利润差异（规则 10.5）— 使用有效执行价
profit_gap = effective_customer_price - internal_cost_baseline

# 当前有效执行价（规则 10.6）
if all(allocation_items.status == 'completed'):
    effective_price = ex_works_price  # 分摊已回收完，不再含分摊
elif any(allocation_items.status in ['recovering', 'allocated']):
    effective_price = arrival_price   # 仍含分摊回收部分
else:
    effective_price = ex_works_price  # 无分摊项

# 金属价格联动
metal_cost_impact = metal_weight * (current_metal_price - base_metal_price)

# 设变成本影响
cost_impact = sum(after.unit_cost) - sum(before.unit_cost)
residual_impact = sum(cancelled.unit_cost * remaining_quantity)

# 年降影响
cost_after = cost_before * (1 - drop_rate)
```

---

## 12 个功能模块

| 编号 | 模块 | 优先级 |
|------|------|--------|
| F01 | 项目管理与 Dashboard | P0 |
| F02 | 场景管理 | P0 |
| F03 | BOM 工作簿 | P0 |
| F04 | 客户报价工作台 | P0 |
| F05 | Simulation 与年降管理 | P1 |
| F06 | 分摊回收跟踪 | P0 |
| F07 | 设变与跟踪 | P1 |
| F08 | 预警系统与 Alerts | P1 |
| F09 | 管理决策舱 | P2 |
| F10 | 版本与发布治理 | P2 |
| F11 | 系统设置与参数治理 | P0 |
| F12 | Profile 与个人中心 | P2 |

建议开发顺序：F01 → F02 → F03 → F04 → F11 → F06 → F07 → F08 → F05 → F10 → F09 → F12

## 开发约定

### 目录结构

```
/
├── CLAUDE.md              # 本文件 — Agent 工作流指令
├── app_spec.md            # 完整功能规格
├── task.json              # 任务定义（唯一事实源）
├── progress.txt           # 跨 session 进度日志
├── init.ps1               # 环境初始化脚本
├── run-automation.ps1     # 自动化循环脚本
├── test-screenshots/      # Playwright 截图目录
├── automation-logs/       # 自动化运行日志
├── frontend/              # React + Vite + TypeScript
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── services/      # API 调用
│   │   ├── types/
│   │   └── utils/
│   └── package.json
├── backend/               # FastAPI
│   ├── app/
│   │   ├── api/           # 路由
│   │   ├── models/        # SQLAlchemy 模型
│   │   ├── schemas/       # Pydantic 模型
│   │   ├── services/      # 业务逻辑
│   │   ├── core/          # 配置/安全
│   │   └── db/            # 数据库初始化
│   ├── tests/
│   └── requirements.txt
└── e2e/                   # Playwright E2E 测试
    ├── tests/
    └── playwright.config.ts
```

### 代码风格

- **前端**：TypeScript strict mode，组件用函数式 + hooks，shadcn/ui 组件库
- **后端**：FastAPI + SQLAlchemy + Pydantic v2，async 优先
- **命名**：前端 camelCase，后端 snake_case，API 路由 kebab-case
- **错误处理**：所有 API 返回统一错误格式 `{"detail": string, "code": string}`
- **数据库**：SQLite 开发期，所有查询通过 SQLAlchemy ORM

### UI 设计

- **主题**：工业蓝图深色风格（深蓝/深灰底，白色文字，蓝色/绿色强调）
- **信息密度优先**：表格为主，卡片为辅
- **桌面优先**：最小宽度 1280px
- **组件库**：shadcn/ui + Tailwind CSS

---

## Key Rules（速查）

1. **一个 session 只做一个任务** — 做完就退出
2. **测试通过才能标记完成** — 所有测试步骤必须通过
3. **UI 修改必须浏览器测试** — 使用 Playwright MCP 截图验证
4. **记录到 progress.txt** — 帮助下一个 session 了解上下文
5. **一个 commit 一个任务** — 代码 + progress.txt + task.json 同一个 commit
6. **永远不要删除任务** — 只能把 status 从 pending 改为 done
7. **阻塞就停** — 需要人工介入时不要提交，输出阻塞信息并停止
8. **完成后直接退出** — 不要问"是否继续"，不要等待确认

## 参考资料

- 完整 PRD：统一PRD资料包_落地版_完整版（Notion 工作区）
- 完整 Spec：`app_spec.md`（同目录）
- 任务清单：`task.json`（同目录）
