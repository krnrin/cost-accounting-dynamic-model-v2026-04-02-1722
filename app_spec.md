# 高压线束精算与决策引擎 — App Spec (完整版)

## 1. 产品概述

**一句话定义**: 面向汽车高压线束供应商内部团队的成本精算与决策引擎，支持从 BOM 到报价、分摊回收、设变跟踪、预警管理的全生命周期经营闭环。

**目标用户**: 成本工程师、销售报价人员、财务管理层

**核心价值**:
- 双引擎：内部实绩成本 + 客户报价口径并行，差异可视
- 颗粒度：精算到线束号 / BOM 行，杜绝套级笼统核算
- 闭环：一次性费用从分摊→回收→调价全链路可追踪
- 场景化：初始报价 / 定点 / 设变 / 年降多场景并行管理
- 决策：Simulation 预演 + 预警系统 + 管理决策舱

**系统定位**: 内部核算结果是系统主对象。客户最终报价单（如吉利模板）仅作为参考对照，不改变系统以内部核算为主的定位。

**三层价格模型**（系统核心概念）:

| 层次 | 名称 | 含义 | 生命周期 |
|------|------|------|----------|
| L1 | 内部核算价 | BOM 成本 + 分摊 + 费率 = 系统自动计算的实绩成本 | 随 BOM/费率变化实时更新 |
| L2 | 客户确认快照价 | 定点/报价确认时客户承认的价格快照 | 客户确认后锁定，不可修改 |
| L3 | 当前有效执行价 | 基于回收状态动态决定的实际执行价格 | 随回收进度自动切换 |

> **禁止混合计算**：同一计算/对比中，不得将不同层次的价格交叉使用。利润差异只能用 L3 vs L1，不得用 L2 vs L1 或 L3 vs L2 混合。

---

## 2. 技术栈

| 层 | 技术 |
|---|---|
| Frontend | React 18 + Vite + TypeScript |
| UI | Tailwind CSS + shadcn/ui（工业蓝图深色风格） |
| Backend | FastAPI (Python 3.11+) |
| Database | SQLite (开发期) → PostgreSQL (生产) |
| Testing | Playwright (E2E) + pytest (API) |
| MCP | Playwright MCP (浏览器自动化测试) |

---

## 3. 功能模块总览 (12 个模块)

| 编号 | 模块 | 阶段 | 优先级 |
|------|------|------|--------|
| F01 | 项目管理与 Dashboard | P0 主链路 | 最高 |
| F02 | 场景管理 | P0 主链路 | 最高 |
| F03 | BOM 工作簿 | P0 主链路 | 最高 |
| F04 | 客户报价工作台 | P0 主链路 | 最高 |
| F05 | Simulation 与年降管理 | P1 执行闭环 | 中 |
| F06 | 分摊回收跟踪 | P0 主链路 | 最高 |
| F07 | 设变与跟踪 | P1 执行闭环 | 高 |
| F08 | 预警系统与 Alerts | P1 执行闭环 | 中高 |
| F09 | 管理决策舱 | P2 治理与增强 | 中 |
| F10 | 版本与发布治理 | P2 治理与增强 | 中 |
| F11 | 系统设置与参数治理 | P0 主链路 | 高 |
| F12 | Profile 与个人中心 | P2 治理与增强 | 低 |

建议研发顺序：F01 → F02 → F03 → F04 → F11 → F06 → F07 → F08 → F05 → F10 → F09 → F12

---

## 4. 页面结构与路由

```
/                                   → 项目列表（入口）
/project/:id                        → 项目 Dashboard（经营总览 + 模块导航）
/project/:id/scenarios              → 场景列表
/project/:id/scenario/:sid          → 场景详情（关联 BOM/报价/分摊）
/project/:id/scenario/:sid/compare  → 场景对比
/project/:id/bom                    → BOM 工作簿
/project/:id/bom/diff               → BOM 版本差异
/project/:id/quote                  → 客户报价工作台
/project/:id/quote/:qid/compare     → 报价 vs 内部成本对比
/project/:id/allocation             → 分摊回收跟踪
/project/:id/allocation/:aid        → 分摊项详情 + 回收轨迹
/project/:id/changes                → 设变管理
/project/:id/changes/:cid           → 设变详情（前后对比 + 影响分析）
/project/:id/tracking               → 跟踪管理
/project/:id/simulation             → Simulation 决策仿真
/project/:id/annual-drop            → 年降管理
/project/:id/alerts                 → 预警中心
/project/:id/versions               → 版本历史
/manager-dashboard                  → 管理决策舱（跨项目）
/settings                           → 系统设置
/settings/cost-structure            → 成本结构配置
/settings/metal-prices              → 金属价格管理
/settings/rates                     → 费率基准
/settings/alert-rules               → 预警规则配置
/settings/factories                 → 多工厂管理
/settings/bom-categories            → BOM 分类规则
/profile                            → 个人中心
```

---

## 5. 数据模型

### 5.1 项目 (Project)

```
Project {
  id: UUID (PK)
  code: string (unique)         -- 项目编号
  name: string
  customer_name: string         -- 客户名称
  vehicle_model: string         -- 车型
  status: enum [draft, active, frozen, archived]
  harness_count: int
  created_at: datetime
  updated_at: datetime
}
```

### 5.2 场景 (Scenario)

```
Scenario {
  id: UUID (PK)
  project_id: UUID (FK → Project)
  type: enum [initial_quote, fixed_point, change, annual_drop]
  name: string
  status: enum [draft, calculating, frozen, released, archived]
  lifecycle_years: int           -- 生命周期年限
  volume: int                    -- 生命周期总产量
  install_ratio: decimal         -- 装车比
  rate_snapshot: JSON            -- 费率快照（冻结时从全局设置拍照）
  bom_version_ref: string        -- BOM 版本引用
  quote_param_snapshot: JSON     -- 报价参数快照
  source_scenario_id: UUID       -- 来源场景（继承用）
  compare_baseline_id: UUID      -- 默认比较基线
  frozen_at: datetime
  released_at: datetime
  notes: text
  created_at: datetime
  updated_at: datetime
  created_by: string
}
```

### 5.3 线束号 (Harness)

```
Harness {
  id: UUID (PK)
  project_id: UUID (FK → Project)
  scenario_id: UUID (FK → Scenario)
  part_number: string            -- 线束号
  name: string
  status: enum [active, changed, cancelled]
  created_at: datetime
}
```

### 5.4 BOM 行 (BomRow)

```
BomRow {
  id: UUID (PK)
  project_id: UUID (FK → Project)
  scenario_id: UUID (FK → Scenario)
  harness_id: UUID (FK → Harness)
  part_number: string            -- 料号
  part_name: string
  category: string               -- 分类（导体/端子/护套/辅材等）
  quantity: decimal
  unit_price: decimal
  price_source: string           -- 价格来源
  material_type: string          -- 材料属性
  metal_type: enum [copper, aluminum, none]
  metal_weight: decimal          -- 金属重量（kg）
  unit_cost: decimal             -- quantity × unit_price
  change_status: enum [unchanged, added, replaced, cancelled]
  version_ref: string
  created_at: datetime
  updated_at: datetime
}
```

### 5.5 报价快照 (QuoteSnapshot)

```
QuoteSnapshot {
  id: UUID (PK)
  project_id: UUID (FK → Project)
  scenario_id: UUID (FK → Scenario)
  harness_id: UUID (FK → Harness)
  quote_params: JSON             -- 客户口径参数快照
  quote_result: JSON             -- 客户口径结果
  internal_cost_baseline: decimal
  profit_gap: decimal            -- effective_customer_price - internal_cost_baseline
  ex_works_price: decimal        -- 出厂价（不含分摊回收部分）
  arrival_price: decimal         -- 到厂价（含运输/包装/分摊回收）
  effective_price: decimal       -- 当前有效执行价（L3，基于回收状态动态决定）
  effective_price_mode: enum [ex_works, arrival, custom]
                                 -- 有效价格模式：出厂价模式 / 到厂价模式 / 自定义
  customer_burden_mode: enum [supplier_full, customer_full, shared, per_item]
                                 -- 客户承担模式：供应商全担 / 客户全担 / 双方分担 / 按项分别约定
  recovery_completion_behavior: enum [auto_switch_price, notify_only, manual_confirm]
                                 -- 回收完成后行为：自动切换价格 / 仅通知 / 人工确认后切换
  allocation_expression: text    -- 分摊费用表达参考
  recovery_expression: text      -- 回收方式表达参考
  customer_accepted: boolean     -- 是否已定点/客户已承认（true 后进入 L2 锁定）
  locked_fields: JSON            -- 财务锁定字段（customer_accepted=true 后不可改）
  editable_fields: JSON          -- 销售可调字段（即使锁定后仍可调整的字段列表）
  approval_fields: JSON          -- 需审批字段（修改后需审批才生效的字段列表）
  status: enum [draft, confirmed, released]
  created_at: datetime
  updated_at: datetime
  created_by: string
}
```

### 5.6 分摊项 (AllocationItem)

```
AllocationItem {
  id: UUID (PK)
  project_id: UUID (FK → Project)
  scenario_id: UUID (FK → Scenario)
  harness_id: UUID (FK → Harness)
  expense_type: enum [tooling, mold, testing, rnd, other]
  expense_name: string
  total_amount: decimal          -- 总金额
  allocation_basis: string       -- 分摊依据说明
  baseline_volume: int           -- 分摊基数（独立业务输入，≠ volume × install_ratio）
  unit_allocation: decimal       -- 单根分摊金额 = total_amount / baseline_volume
  planned_recovery: decimal      -- 计划回收金额
  actual_recovered: decimal      -- 已回收金额
  remaining_recovery: decimal    -- 未回收金额
  recovery_progress: decimal     -- 百分比
  burden_side: enum [supplier, customer, shared]
                                 -- 承担方：供应商承担 / 客户承担 / 双方分担
  pricing_effect: enum [included_in_price, separate_invoice, internal_only]
                                 -- 定价影响：含入单价 / 单独开票 / 仅内部核算
  recovery_completion_behavior: enum [trigger_price_adjust, notify_only, archive]
                                 -- 回收完成行为：触发调价 / 仅通知 / 直接归档
  price_adjust_reminder: boolean -- 调价提醒状态（回收完成时是否已提醒）
  target_recovery_date: date
  completed_at: datetime
  status: enum [pending, allocated, recovering, completed, closed]
  source_version_id: string
  created_at: datetime
  updated_at: datetime
}
```

### 5.7 回收记录 (RecoveryRecord)

```
RecoveryRecord {
  id: UUID (PK)
  allocation_item_id: UUID (FK → AllocationItem)
  project_id: UUID (FK → Project)
  scenario_id: UUID (FK → Scenario)
  period: string                 -- 时间周期
  cumulative_volume: int         -- 累计产量
  install_ratio_snapshot: decimal
  recovered_amount: decimal
  remaining_amount: decimal
  status: enum [normal, lagging, excess, anomaly]
  remark: text
  created_at: datetime
}
```

### 5.8 设变事件 (ChangeEvent)

```
ChangeEvent {
  id: UUID (PK)
  project_id: UUID (FK → Project)
  scenario_id: UUID (FK → Scenario)
  change_type: enum [add, replace, cancel, adjust]
  reason: text
  affected_harness_ids: JSON     -- [harness_id, ...]
  affected_bom_rows: JSON        -- [{row_id, before, after}, ...]
  cost_impact: decimal           -- 成本影响
  quote_impact: decimal          -- 报价影响
  residual_impact: decimal       -- 残余材料池影响
  baseline_version_id: string
  compare_version_id: string
  status: enum [draft, identified, calculated, confirmed, closed]
  created_at: datetime
  updated_at: datetime
  created_by: string
}
```

### 5.9 跟踪项 (TrackingItem)

```
TrackingItem {
  id: UUID (PK)
  project_id: UUID (FK → Project)
  scenario_id: UUID (FK → Scenario)
  tracking_type: enum [agreed_price, progress_price, allocation_recovery, residual, exception]
  title: string
  source_ref: string             -- 来源对象引用
  current_status: enum [pending, in_progress, to_confirm, completed, closed]
  severity: enum [low, medium, high, critical]
  owner: string                  -- 责任人
  planned_action: text
  actual_result: text
  close_reason: text
  warning_ref: string            -- 关联预警
  closed_at: datetime
  created_at: datetime
  updated_at: datetime
}
```

### 5.10 仿真任务 (SimulationTask)

```
SimulationTask {
  id: UUID (PK)
  project_id: UUID (FK → Project)
  scenario_id: UUID (FK → Scenario)
  name: string
  input_snapshot: JSON           -- 输入参数快照
  adjusted_parameters: JSON      -- 调整的变量
  result_summary: JSON           -- 结果摘要
  is_saved: boolean              -- 是否保存
  convert_to_scenario: boolean   -- 是否已转为正式场景
  created_at: datetime
  created_by: string
}
```

### 5.11 年降记录 (AnnualDropRecord)

```
AnnualDropRecord {
  id: UUID (PK)
  project_id: UUID (FK → Project)
  scenario_id: UUID (FK → Scenario)
  period: string                 -- 年度/周期
  drop_rate: decimal             -- 年降率
  affected_scope: JSON           -- 影响范围
  cost_before: decimal
  cost_after: decimal
  quote_before: decimal
  quote_after: decimal
  profit_impact: decimal
  status: enum [draft, applied, tracked]
  created_at: datetime
  updated_at: datetime
}
```

### 5.12 预警规则 (AlertRule)

```
AlertRule {
  id: UUID (PK)
  name: string
  category: enum [metal_price, allocation_recovery, cost_anomaly, execution, deadline]
  trigger_condition: JSON        -- 触发条件
  severity: enum [info, warning, critical]
  enabled: boolean
  created_at: datetime
  updated_at: datetime
}
```

### 5.13 预警事件 (AlertEvent)

```
AlertEvent {
  id: UUID (PK)
  rule_id: UUID (FK → AlertRule)
  project_id: UUID (FK → Project)
  scenario_id: UUID (FK → Scenario, nullable)
  title: string
  description: text
  severity: enum [info, warning, critical]
  source_object_type: string     -- 来源对象类型
  source_object_id: string       -- 来源对象 ID
  status: enum [active, acknowledged, resolved, dismissed]
  resolved_at: datetime
  resolved_by: string
  created_at: datetime
}
```

### 5.14 版本记录 (VersionRecord)

```
VersionRecord {
  id: UUID (PK)
  project_id: UUID (FK → Project)
  scenario_id: UUID (FK → Scenario, nullable)
  object_type: string            -- 版本化对象类型 (bom/quote/scenario/settings)
  object_id: string
  version_number: string         -- v1.0, v1.1...
  snapshot_data: JSON            -- 版本快照
  change_summary: text           -- 变更摘要
  status: enum [draft, published, superseded]
  published_at: datetime
  published_by: string
  audit_trace_id: string
  created_at: datetime
}
```

### 5.15 系统设置 (Settings)

```
Settings {
  id: UUID (PK)
  category: string               -- cost_structure / metal_price / rates / alert_threshold / factory / bom_category
  key: string
  value: JSON
  is_global: boolean             -- 全局基准 vs 项目/场景快照
  version_ref: string
  updated_at: datetime
  updated_by: string
}
```

### 5.16 用户 (User)

```
User {
  id: UUID (PK)
  username: string (unique)
  display_name: string
  role: enum [admin, finance, sales, engineer, viewer]
  email: string
  theme_preference: string
  notification_settings: JSON
  created_at: datetime
  last_login_at: datetime
}
```

### 关系图

```
Project 1──N Scenario
Project 1──N Harness
Scenario 1──N Harness
Harness 1──N BomRow
Scenario 1──N QuoteSnapshot
Scenario 1──N AllocationItem
Scenario 1──N ChangeEvent
Scenario 1──N TrackingItem
Scenario 1──N SimulationTask
Scenario 1──N AnnualDropRecord
Harness 1──N QuoteSnapshot
Harness 1──N AllocationItem
AllocationItem 1──N RecoveryRecord
AlertRule 1──N AlertEvent
Project 1──N AlertEvent
Project 1──N VersionRecord
```

---

## 6. API 设计

### 6.1 项目管理 (F01)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | 项目列表（?search=&status= 筛选） |
| POST | `/api/projects` | 新建项目 |
| GET | `/api/projects/:id` | 项目详情 + Dashboard 汇总 |
| PUT | `/api/projects/:id` | 更新项目 |
| DELETE | `/api/projects/:id` | 删除项目 |
| GET | `/api/projects/:id/dashboard` | 项目级经营汇总指标 |
| POST | `/api/projects/import` | 导入项目 |

### 6.2 场景管理 (F02)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects/:id/scenarios` | 场景列表 |
| POST | `/api/projects/:id/scenarios` | 新建场景（选类型） |
| GET | `/api/scenarios/:sid` | 场景详情 |
| PUT | `/api/scenarios/:sid` | 更新场景 |
| POST | `/api/scenarios/:sid/freeze` | 冻结场景 |
| POST | `/api/scenarios/:sid/release` | 发布场景 |
| POST | `/api/scenarios/:sid/clone` | 复制/继承场景 |
| GET | `/api/scenarios/:sid/summary` | 场景汇总指标 |
| GET | `/api/scenarios/compare?ids=a,b` | 场景对比（成本/报价/利润/回收） |

### 6.3 BOM 工作簿 (F03)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/scenarios/:sid/bom` | BOM 行列表（?harness=&category= 筛选） |
| POST | `/api/scenarios/:sid/bom` | 新增 BOM 行 |
| PUT | `/api/bom/:rowId` | 编辑 BOM 行 |
| DELETE | `/api/bom/:rowId` | 删除 BOM 行 |
| POST | `/api/scenarios/:sid/bom/import` | 批量导入 BOM（CSV/Excel） |
| GET | `/api/scenarios/:sid/bom/summary` | BOM 汇总（按线束号/分类） |
| GET | `/api/scenarios/:sid/bom/diff?base=:sid2` | BOM 版本/场景差异比较 |

### 6.4 客户报价工作台 (F04)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/scenarios/:sid/quotes` | 报价列表 |
| POST | `/api/scenarios/:sid/quotes` | 创建报价快照 |
| GET | `/api/quotes/:qid` | 报价详情 |
| PUT | `/api/quotes/:qid` | 更新报价参数（受 locked/editable/approval 字段控制） |
| GET | `/api/quotes/:qid/compare` | 报价 vs 内部成本对比（使用 L3 有效执行价） |
| GET | `/api/quotes/compare?ids=a,b` | 不同版本/场景报价对比 |
| POST | `/api/quotes/:qid/confirm` | 确认报价（锁定为 L2 客户确认快照价） |
| GET | `/api/quotes/:qid/effective-price` | 查询当前有效执行价（L3）及其计算来源 |

### 6.5 Simulation 与年降管理 (F05)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/scenarios/:sid/simulations` | 仿真任务列表 |
| POST | `/api/scenarios/:sid/simulations` | 创建仿真任务 |
| GET | `/api/simulations/:simId` | 仿真详情 + 结果 |
| PUT | `/api/simulations/:simId` | 更新仿真参数 |
| POST | `/api/simulations/:simId/run` | 执行仿真计算 |
| POST | `/api/simulations/:simId/convert-to-scenario` | 仿真结果转正式场景 |
| GET | `/api/scenarios/:sid/annual-drops` | 年降记录列表 |
| POST | `/api/scenarios/:sid/annual-drops` | 新增年降记录 |
| GET | `/api/annual-drops/:adId` | 年降详情 |
| PUT | `/api/annual-drops/:adId` | 更新年降 |
| GET | `/api/annual-drops/:adId/impact` | 年降影响分析 |

### 6.6 分摊回收跟踪 (F06)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/scenarios/:sid/allocations` | 分摊项列表（支持 ?burden_side= 筛选） |
| POST | `/api/scenarios/:sid/allocations` | 新增分摊项（需指定 burden_side + pricing_effect） |
| GET | `/api/allocations/:aid` | 分摊详情 + 回收进度 + 承担方信息 |
| PUT | `/api/allocations/:aid` | 更新分摊/回收状态 |
| GET | `/api/allocations/:aid/recovery-history` | 回收记录明细 |
| POST | `/api/allocations/:aid/recovery-records` | 新增回收记录 |
| GET | `/api/allocations/:aid/recovery-forecast` | 回收预测 |
| POST | `/api/allocations/:aid/complete` | 标记回收完成（触发 recovery_completion_behavior） |

### 6.7 设变与跟踪 (F07)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/scenarios/:sid/changes` | 设变事件列表 |
| POST | `/api/scenarios/:sid/changes` | 新建设变事件 |
| GET | `/api/changes/:cid` | 设变详情（含前后对比） |
| PUT | `/api/changes/:cid` | 更新设变状态 |
| GET | `/api/changes/:cid/impact` | 影响分析结果 |
| POST | `/api/changes/:cid/calculate-impact` | 触发影响计算 |
| GET | `/api/scenarios/:sid/tracking` | 跟踪项列表 |
| POST | `/api/scenarios/:sid/tracking` | 新建跟踪项 |
| GET | `/api/tracking/:tid` | 跟踪详情 |
| PUT | `/api/tracking/:tid` | 更新跟踪状态 |
| POST | `/api/tracking/:tid/close` | 关闭跟踪项 |

### 6.8 预警系统与 Alerts (F08)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/alert-rules` | 预警规则列表 |
| POST | `/api/alert-rules` | 新建预警规则 |
| PUT | `/api/alert-rules/:rid` | 更新预警规则 |
| DELETE | `/api/alert-rules/:rid` | 删除预警规则 |
| GET | `/api/projects/:id/alerts` | 项目预警事件列表 |
| GET | `/api/alerts` | 全局预警事件列表 |
| GET | `/api/alerts/:eid` | 预警事件详情 |
| PUT | `/api/alerts/:eid` | 更新预警状态（确认/解决/忽略） |
| GET | `/api/alerts/summary` | 预警汇总统计 |

### 6.9 管理决策舱 (F09)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/manager-dashboard` | 跨项目经营总览 |
| GET | `/api/manager-dashboard/profit-summary` | 利润汇总 |
| GET | `/api/manager-dashboard/recovery-summary` | 回收进度汇总 |
| GET | `/api/manager-dashboard/alert-summary` | 预警汇总 |
| GET | `/api/manager-dashboard/scenario-comparison` | 跨项目场景比较 |
| GET | `/api/manager-dashboard/anomaly-summary` | 经营异常聚合 |

### 6.10 版本与发布治理 (F10)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects/:id/versions` | 版本历史列表 |
| POST | `/api/versions` | 创建版本记录 |
| GET | `/api/versions/:vid` | 版本详情 + 快照 |
| GET | `/api/versions/compare?a=:vid1&b=:vid2` | 版本差异对比 |
| POST | `/api/versions/:vid/publish` | 发布版本 |
| POST | `/api/versions/:vid/rollback` | 回滚到版本 |

### 6.11 系统设置与参数治理 (F11)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/settings` | 所有设置 |
| GET | `/api/settings/:category` | 分类设置 |
| PUT | `/api/settings/:category/:key` | 更新设置 |
| POST | `/api/settings/publish` | 发布费率基准 |
| GET | `/api/settings/history` | 设置变更历史 |
| GET | `/api/settings/snapshot/:version` | 参数快照 |

### 6.12 Profile 与个人中心 (F12)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/profile` | 个人信息 |
| PUT | `/api/profile` | 更新个人信息 |
| GET | `/api/profile/permissions` | 权限概览 |
| PUT | `/api/profile/preferences` | 主题/通知偏好 |

### 6.13 通用

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | 登录 |
| POST | `/api/auth/logout` | 登出 |
| GET | `/api/users` | 用户列表 |
| POST | `/api/export/:type` | 导出（PDF/Excel） |

---

## 7. 业务流程

### 7.1 主链路（P0 — 系统成立的最小闭环）

```
新建项目
  → 创建场景（初始报价）
    → 导入/录入 BOM
      → 系统自动计算内部成本（L1 内部核算价）
        → 创建客户报价快照
          → 对比 L1 内部核算价 vs L3 有效执行价
            → 识别利润空间
              → 确认报价（锁定为 L2 客户确认快照价）
```

### 7.2 分摊回收链路

```
录入一次性费用（工装/模具/试验/研发）
  → 指定承担方（burden_side）和定价影响（pricing_effect）
    → 绑定线束号 + 场景
      → 系统按 baseline_volume 计算单根分摊
        → 按 装车比 × 累计产量 跟踪回收
          → 回收完成 → 按 recovery_completion_behavior 执行：
             - trigger_price_adjust: 自动触发调价提醒 + 切换有效执行价
             - notify_only: 仅发送通知
             - archive: 直接归档
          → 回收滞后 → 触发预警
```

### 7.3 设变链路

```
BOM 发生变化（新增/替换/取消）
  → 创建设变事件
    → 系统计算成本影响 + 报价影响
      → 识别残余材料池
        → 残余材料 → 呆滞提报（不继续计入当前产品成本）
        → 生成跟踪项
          → 持续跟踪执行状态
```

### 7.4 场景比较链路

```
同一项目下创建多个场景
  → 各场景独立计算
    → 场景对比（成本/报价/利润/回收）
      → 支撑经营决策
```

### 7.5 Simulation 链路

```
选择基线场景
  → 调整关键变量（金属价格/产量/费率等）
    → 查看结果变化（敏感度分析）
      → 保存仿真结果
        → 可选：转为正式场景
```

### 7.6 年降链路

```
设定年降率和周期
  → 系统计算周期影响
    → 成本/报价/利润变化
      → 关联场景和版本
        → 生成跟踪项
```

### 7.7 预警链路

```
配置预警规则（金属价格/回收进度/成本异常/执行节点）
  → 系统持续检测
    → 触发预警事件
      → 分级展示（info/warning/critical）
        → 处理状态流转（确认/解决/忽略）
```

### 7.8 版本治理链路

```
关键节点（BOM冻结/报价发布/场景发布）
  → 自动创建版本快照
    → 版本历史可追溯
      → 版本间差异可比较
        → 需要时可回滚
```

---

## 8. 各模块详细规格

### F01 项目管理与 Dashboard

**功能定位**: 系统一级入口层，项目管理 + 项目级经营总览

**项目列表页**:
- 项目列表展示（编号、名称、客户、车型、状态、线束数、更新时间）
- 搜索（项目名/编号/客户）
- 状态筛选
- 新建 / 导入 / 删除
- 点击进入项目详情

**Dashboard 页**:
- 关键经营指标卡片（成本汇总、报价汇总、利润差异、回收进度）
- 模块导航入口（BOM / 报价 / 场景 / 分摊 / 设变 / 跟踪）
- 当前场景概况
- 预警摘要（预留）
- 版本状态摘要（预留）

---

### F02 场景管理

**功能定位**: 承载项目生命周期差异的核心业务容器

**场景列表**:
- 场景名称、类型、状态、产量/生命周期摘要、版本信息、更新时间
- 标记当前主要经营基线

**场景详情**:
- 基础信息（类型、生命周期、产量、装车比、费率快照）
- 与 BOM / 报价 / 分摊 / 跟踪的联动入口
- 关键指标摘要
- 当前版本状态

**场景新建**:
- 必选：场景类型、名称
- 可选：继承来源场景（待确认：继承哪些字段）

**场景比较**:
- 成本比较 / 报价比较 / 利润比较 / 分摊回收状态比较
- 双列对比视图

**场景类型**:
- 初始报价：项目早期报价测算
- 定点：定点后的稳定经营基线
- 设变：BOM 变更后的独立经营事实
- 年降：周期性降价/成本改善后的经营事实

**核心规则**:
- 场景之间互相独立，不可覆盖
- 场景必须保留关键事实快照
- 场景 ≠ 版本（场景=经营语义，版本=时间线追溯）

---

### F03 BOM 工作簿

**功能定位**: 核心主数据，内部成本/报价/设变/分摊的共同上游

**主表格区**:
- 逐行 BOM 展示（料号、名称、分类、数量、单价、金额、材料属性、金属属性、所属线束号）
- 线束号维度筛选
- 分类筛选
- 内联编辑
- 批量导入（CSV/Excel）

**汇总区**:
- 行数统计、线束号维度汇总、成本摘要、分类摘要

**差异查看**:
- 版本差异、设变前后差异、场景间 BOM 差异

**核心规则**:
- 颗粒度必须到线束号/BOM 行，不得回退为项目平均值
- BOM 变化应传导到报价、设变、分摊、跟踪、预警
- 关键节点保留快照

---

### F04 客户报价工作台

**功能定位**: 双引擎中的客户侧，内部核算→客户报价输出与商务判断

**报价主页面**:
- 场景/线束号 + 客户报价结果 + 内部成本基线 + 差异值 + 利润空间 + 状态
- 价格展示必须标注所属层次（L1/L2/L3）

**参数区**:
- 当前报价参数、可调/锁定/待审批字段区分、参数来源
- `locked_fields` 对应的字段 → 前端 disabled + 🔒 图标
- `editable_fields` 对应的字段 → 正常可编辑
- `approval_fields` 对应的字段 → 可编辑但修改后显示 ⚠️ 待审批标记

**对照区（吉利客户）**:
- 出厂价对照（L1 vs ex_works_price）
- 到厂价对照（含分摊回收部分）
- 当前有效执行价（L3）及其计算来源说明
- 分摊费用及回收方式说明
- 承担方（burden_side）展示
- 是否已定点/客户已承认

**有效价格生命周期**:
1. 报价创建 → `effective_price_mode = ex_works`（默认出厂价模式）
2. 包含分摊项且分摊计入价格 → `effective_price_mode = arrival`（切换到到厂价模式）
3. 分摊回收完成 → 根据 `recovery_completion_behavior` 自动/手动切换回 `ex_works`
4. 客户确认 → `customer_accepted = true` → L2 锁定

**核心规则**:
- 客户报价 ≠ 内部实绩成本，必须分层
- 三层价格不得混合计算（同一公式/对比中只能使用同层价格）
- 报价必须保留参数快照，可追溯
- 模板输出不应主导内核结构
- 承担方（burden_side）必须显式标注，不得隐含假设
- `profit_gap` 只能用 L3 (effective_price) - L1 (internal_cost)，禁止其他组合

---

### F05 Simulation 与年降管理

**功能定位**: 面向未来变化的经营判断

**Simulation 页面**:
- 选择基线场景
- 调整关键变量（金属价格、产量、费率、装车比等）
- 查看结果变化（成本、报价、利润响应曲线）
- 保存仿真结果
- 可选：转为正式场景（待确认）

**年降页面**:
- 年降参数设定（周期、降幅、影响范围）
- 周期影响结果
- 成本/报价/利润变化
- 与场景/版本对照

**核心规则**:
- Simulation = 假设测算，≠ 正式版本
- 年降 = 有周期和影响链路的业务对象，≠ 简单数字减值
- 仿真与正式结果必须分层

---

### F06 分摊回收跟踪

**功能定位**: 一次性费用的完整经营闭环

**分摊管理页面**:
- 费用类型、线束号、总金额、单根分摊、承担方、定价影响、计划回收、已回收、未回收、状态
- 回收进度条可视化
- 按承担方（供应商/客户/分担）分组展示

**分摊详情**:
- 分摊依据、baseline_volume（独立业务输入）、当前场景、关键参数快照
- 承担方（burden_side）+ 定价影响（pricing_effect）
- 回收完成行为（recovery_completion_behavior）配置
- 回收进度轨迹、调价提醒状态

**回收记录**:
- 时间周期、累计产量、装车比快照、回收金额、剩余金额、状态

**回收完成→调价生命周期**:
1. `recovery_progress >= 100%` → 触发 `recovery_completion_behavior`
2. 若 `trigger_price_adjust` → 自动创建调价跟踪项 + 设置 `price_adjust_reminder = true` + 通知相关人员
3. 调价确认后 → 更新 QuoteSnapshot 的 `effective_price` + 切换 `effective_price_mode`
4. 归档分摊项 → `status = closed`

**核心规则**:
- 按线束号独立、按根分摊，不得笼统平均
- `baseline_volume` 是独立业务输入，不应简单等同于 `volume × install_ratio`
- 回收按 装车比 × 累计产量 判断
- **分摊 ≠ 回收**（分摊=成本口径的费用分配方式，回收=执行层面的资金回收进度），必须分层实现
- **承担方必须显式**：每个分摊项必须标注 `burden_side`，不得默认全部为供应商承担
- 回收完成触发调价提醒（按 `recovery_completion_behavior` 配置执行）
- 残余材料不继续计入当前产品成本

---

### F07 设变与跟踪

**功能定位**: 将"变化"转成可持续执行与可追溯的经营事件链

**设变管理页面**:
- 设变事件列表（类型、原因、影响线束号、成本影响、报价影响、状态）

**设变详情**:
- 变更前后 BOM 对比
- 成本影响计算结果
- 报价影响
- 残余材料池识别
- 关联跟踪项

**跟踪管理页面**:
- 跟踪项列表（类型、标题、状态、责任人、严重度）
- 协议价落实 / 进度价差距 / 分摊回收差异 / 残余材料 / 异常

**核心规则**:
- 设变必须结构化（独立事件对象），不是"改了 BOM 数据"这一结果
- 进度价 = 协议价 vs 当前批量价的差距追踪，≠ 加权混合价
- 残余材料池 → 呆滞提报，不继续计入当前产品成本
- 跟踪项必须有状态 + 关闭机制

---

### F08 预警系统与 Alerts

**功能定位**: 从"配置项"升级为"规则系统"

**预警规则页面** (Settings 中):
- 规则列表（名称、类别、触发条件、严重度、启用状态）
- 支持金属价格 / 分摊回收 / 成本异常 / 执行节点 / 截止日期等类别

**Alerts 预警中心**:
- 预警事件列表（标题、严重度、来源对象、状态、创建时间）
- 分类筛选、严重度筛选
- 预警详情 + 关联对象跳转
- 状态流转（active → acknowledged → resolved/dismissed）

**核心规则**:
- 预警触发来源：金属价格变动、回收滞后、成本异常、关键执行节点
- 预警分级：info / warning / critical
- 预警必须可关闭/确认/解决

---

### F09 管理决策舱

**功能定位**: 跨项目管理层视图

**管理决策舱页面**:
- 跨项目利润汇总
- 跨项目回收进度汇总
- 经营异常聚合
- 预警汇总
- 跨项目/跨场景比较

**核心规则**:
- 只做汇总与导航，不替代执行页面
- 数据来源必须统一，不在页面内各自计算
- 利润归因保留 Shapley 方向 + 因果链瀑布图表达

---

### F10 版本与发布治理

**功能定位**: 追溯与发布维度

**版本历史页面**:
- 版本列表（对象类型、版本号、变更摘要、发布状态、发布人、时间）
- 版本详情 + 快照查看
- 版本间差异对比

**核心规则**:
- 版本 ≠ 场景（版本=时间线追溯，场景=经营语义）
- 关键节点自动创建版本快照
- 支持 Audit Trace ID

---

### F11 系统设置与参数治理

**功能定位**: 全局参数基准与治理

**设置页面**:
- 成本结构配置
- 金属价格管理（铜/铝基准价，历史价格）
- 费率基准
- 预警阈值配置
- 多工厂管理
- BOM 分类规则
- 系数近似配置

**核心规则**:
- 区分全局基准 vs 项目/场景快照
- 费率发布流（全局 → 快照 → 项目/场景引用）
- 参数快照化，避免后续修改覆盖历史结果

---

### F12 Profile 与个人中心

**功能定位**: 个人维度能力

**Profile 页面**:
- 个人信息查看/编辑
- 角色与权限概览
- 主题偏好（深色/浅色）
- 通知设置

---

## 9. 设计要求

### 9.1 整体风格
- **工业蓝图深色主题**: 深蓝/深灰底，白色文字，蓝色/绿色强调
- **信息密度优先**: 表格为主，卡片为辅
- **侧边栏导航**: 左侧项目导航 + 模块入口

### 9.2 关键 UI 组件
- **Dashboard 卡片**: 成本汇总、报价汇总、利润差异、回收进度
- **数据表格**: 可排序、可筛选、可内联编辑的专业表格
- **对比视图**: 双列对比（内部成本 vs 客户报价），价格层次标注（L1/L2/L3）
- **状态标签**: 彩色状态 badge（草稿/进行中/已完成/已关闭）
- **进度条**: 回收进度可视化
- **瀑布图**: 利润归因可视化
- **预警徽章**: 右上角预警计数
- **面包屑**: 项目 > 场景 > 模块的层级导航
- **字段权限标记**: 🔒 锁定 / ✏️ 可编辑 / ⚠️ 待审批

### 9.3 响应式
- 桌面优先（主要使用场景）
- 最小宽度 1280px

---

## 10. 核心计算规则

### 10.1 BOM 行成本
```
unit_cost = quantity × unit_price
```

### 10.2 线束号成本
```
harness_cost = SUM(bom_rows.unit_cost) WHERE harness_id = ?
```

### 10.3 单根分摊
```
unit_allocation = total_amount / baseline_volume
```
> ⚠️ `baseline_volume` 应作为独立业务输入（由用户根据实际情况填写），不应简单等同于 `volume × install_ratio`。默认可预填为 `volume × install_ratio`，但用户可修改。

### 10.4 回收进度
```
recovery_progress = actual_recovered / planned_recovery × 100%
actual_recovered = cumulative_volume × install_ratio × unit_allocation
```

### 10.5 利润差异
```
profit_gap = effective_customer_price - internal_cost_baseline
```
> 其中 `effective_customer_price` = QuoteSnapshot.effective_price（L3 当前有效执行价），不得使用 L2 客户确认快照价或其他层次价格替代。

### 10.6 当前有效执行价（L3）
```
IF all related allocation_items.status IN [completed, closed]:
    effective_price = ex_works_price          -- 分摊已全部回收，使用出厂价
    effective_price_mode = 'ex_works'
ELIF any related allocation_items.pricing_effect = 'included_in_price':
    effective_price = arrival_price           -- 分摊含入价格且尚在回收中，使用到厂价
    effective_price_mode = 'arrival'
ELSE:
    effective_price = ex_works_price          -- 分摊不含入价格（单独开票/仅内部），使用出厂价
    effective_price_mode = 'ex_works'
```
> 有效执行价在每次回收记录更新、分摊项状态变更时自动重新计算。

### 10.7 金属价格联动
```
metal_cost_impact = metal_weight × (current_metal_price - base_metal_price)
```

### 10.8 设变成本影响
```
cost_impact = SUM(after_bom_rows.unit_cost) - SUM(before_bom_rows.unit_cost)
residual_impact = SUM(cancelled_rows.unit_cost × remaining_quantity)
```

### 10.9 年降影响
```
cost_after = cost_before × (1 - drop_rate)
profit_impact = (quote_before - cost_after) - (quote_before - cost_before)
```

---

## 11. 边界约束

### 做
- ✅ 内部核算为主对象
- ✅ 三层价格模型（内部核算价 / 客户确认快照价 / 当前有效执行价）
- ✅ 线束号/BOM 行颗粒度
- ✅ 按根分摊、baseline_volume 作为独立业务输入
- ✅ 装车比×累计产量回收
- ✅ 双引擎并行（内部成本 + 客户报价）
- ✅ 多场景并行管理
- ✅ 关键节点参数快照化
- ✅ 承担方（burden_side）显式标注
- ✅ 分摊≠回收分层实现
- ✅ 字段级权限控制（locked/editable/approval）
- ✅ 预警规则系统
- ✅ 版本追溯

### 不做（或待确认后再做）
- ⏳ 场景继承机制的完整实现（先预留结构）
- ⏳ 场景冻结/发布审批流（先预留状态字段）
- ⏳ 仿真结果一键转场景（待确认）
- ⏳ 客户模板完整适配与导出
- ⏳ 多账套财务映射
- ⏳ 复杂审批流
- ⏳ Profile 深度权限矩阵

---

## 12. 验收标准

### P0 — 系统成立（主链路）
1. 能新建项目、搜索项目、进入项目
2. 能在项目下创建多个场景（区分类型）
3. 能录入/导入 BOM，按线束号和分类查看
4. 能创建报价快照，查看内部成本 vs 客户报价差异（使用三层价格模型）
5. 能录入一次性费用，指定承担方，查看单根分摊和回收进度
6. 能创建设变事件，查看成本/报价影响
7. 能创建跟踪项，管理执行状态
8. 场景之间能做基础指标对比
9. 系统设置页面能配置基础费率和金属价格

### P1 — 执行闭环
10. Simulation 能调整关键变量并查看结果变化
11. 年降能设定周期和降幅，查看影响
12. 预警规则能配置、能触发、能查看
13. Alerts 页面能分类筛选和处理状态
14. 回收记录能逐期追踪，回收完成自动触发 recovery_completion_behavior
15. 设变能自动计算影响和残余材料池

### P2 — 治理与增强
16. 管理决策舱跨项目汇总
17. 版本历史可追溯、可比较、可回滚
18. 费率基准发布流
19. 参数快照化完整实现
20. Profile 与个人偏好
21. 利润归因瀑布图

### 质量要求
- 所有页面 Lighthouse Performance ≥ 70
- API 响应时间 < 500ms (p95)
- 表格支持 1000+ 行 BOM 数据
- SQLite 数据持久化，刷新不丢失
- 深色主题视觉一致性
- 价格层次标注清晰（L1/L2/L3 不得遗漏）
