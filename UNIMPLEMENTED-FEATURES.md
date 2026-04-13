# 未实装功能分析报告

> 生成时间: 2026-04-13  
> 基于: main 分支 (commit df5fd12)  
> 分析范围: 29个页面 + 46个引擎模块 + 16个Store + PRD对比

## 📊 总体状态

| 层级 | 数量 | 说明 |
|------|------|------|
| 🔴 Critical | 8项 | 影响核心业务闭环，必须修复 |
| 🟠 Medium | 16项 | 功能存在但闭环断裂 |
| 🟡 Low | 15项 | PRD要求但优先级较低 |
| **总计** | **39项** | 已完成72%，剩余28% |

## 🔴 Critical — 必须修复 (8项)

### C1: 设变→BOM→报价 自动传导链断裂
- **Issue**: [#60](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/issues/60)
- **现状**: 设变确认后不会自动更新BOM数据和报价结果
- **影响**: 核心经营闭环断裂，用户需手动重算
- **涉及文件**: `ChangeEnginePage.tsx` (1320行)
- **解决方案**: 在设变提交时调用 `cascade_impact.ts` → `harness_costing.ts` → 更新场景result

### C2: BomDiffPage 已升级为语义化版本 ✅
- **PR**: [#93](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/pull/93) (已合并)
- **状态**: ✅ 已解决
- **新功能**: 
  - 集成 `change_pattern_classifier.ts` 引擎
  - 13种语义变更模式识别 (split/merge/replace/wire_spec_replace等)
  - 置信度徽章 (高≥90%/中≥70%/低)
  - 供应商一致性检查
  - 按线束折叠分组展示
  - 增强CSV导出

### C3: QuotePage 设变Tab crash
- **Issue**: [#62](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/issues/62#issuecomment-4233058563)
- **现状**: `renderChangePricing()` 读取不存在的 `processHours` 字段，`toFixed()` 对 undefined 调用导致白屏
- **影响**: 设变模拟功能完全不可用
- **涉及文件**: `QuotePage.tsx` (714行)
- **修复代码**: 已在Issue评论中提供精确修复（2行改动，添加 `?? 0` null guard）

### C4: BomWorkbookPage 保存不写回 result
- **Issue**: [#62](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/issues/62#issuecomment-4233058563)
- **现状**: `handleSaveAll()` 更新 `db.harnesses` 时只写 `input`，不写 `result`
- **影响**: 计算结果丢失，数据完整性问题
- **涉及文件**: `BomWorkbookPage.tsx` (1118行)
- **修复代码**: 已在Issue评论中提供精确修复（3行改动）

### C5: 场景复制/继承功能缺失
- **Issue**: [#62](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/issues/62)
- **现状**: `sourceScenarioId` 字段存在但复制逻辑未实现
- **影响**: 无法基于现有场景快速创建变体
- **涉及文件**: `ProjectScenariosPage.tsx` (585行)
- **可能在PR**: #79 (feat/batch-37-tasks) 中有部分实现

### C6: 参数快照化完整实现
- **Issue**: [#59](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/issues/59)
- **Task**: T38
- **现状**: rate/bom/quote 三个快照字段未完整工作
- **影响**: 版本治理基础缺失，历史结果不可追溯
- **可能在PR**: #79 (feat/batch-37-tasks) 中有 settingsSnapshotStore 增强

### C7: 金属价格联动→预警触发
- **Issue**: [#61](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/issues/61)
- **Task**: T31
- **现状**: `metal_escalation.ts` 引擎已实现 + 测试通过(PR #86)，但alert系统未消费联动结果
- **影响**: 铜铝价变化无法自动触发成本预警
- **Hook**: `useAlertWorkflow.ts` 已就绪 (PR #94)
- **待接入**: AlertsPage (Issue #95)

### C8: 设变→报价影响自动传导
- **Issue**: [#60](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/issues/60)
- **现状**: 设变对客户报价的影响需手动重算
- **影响**: 与C1类似，核心闭环断裂
- **可能在PR**: #81 (fix/bom-engine-quote-sync) 中有部分实现

## 🟠 Medium — 功能增强 (16项)

### M1: ScenarioComparePage 已扩展多维度 ✅
- **PR**: [#92](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/pull/92) (已合并)
- **状态**: ✅ 已解决
- **新功能**: 12个KPI维度 + 全行Delta + 线束级明细 + 雷达图

### M2: 场景与版本关联
- **Issue**: [#65](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/issues/65)
- **现状**: `versionRef` 字段存在，VersionManager 未与场景打通

### M3: BOM 快照/版本化
- **Issue**: [#67](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/issues/67)
- **现状**: PRD 6.3 要求关键节点保留快照，当前未实现

### M4: BOM 变更影响链路可视化
- **Issue**: [#67](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/issues/67)
- **现状**: BOM→报价→分摊的影响链无可视化展示

### M5: 报价参数快照
- **Issue**: [#69](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/issues/69)
- **现状**: `quoteParamSnapshotRef` 无独立快照机制

### M6: 报价版本比较
- **Issue**: [#69](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/issues/69)
- **现状**: 不同版本/场景报价差异比较未实现

### M7: 仿真结果保存/引用
- **Issue**: [#72](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/issues/72)
- **现状**: 模拟结果无法保存快照供后续引用

### M8: 年降与场景/版本挂接
- **Issue**: [#72](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/issues/72)
- **现状**: 年降结果独立存在，未与场景系统打通

### M9: 回收记录明细台账
- **Issue**: [#70](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/issues/70)
- **现状**: 只有进度计算无明细台账

### M10: 回收→预警/跟踪联动
- **Issue**: [#70](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/issues/70)
- **现状**: 回收完成提醒仅本页Banner，未推送到AlertsPage/TrackingPage

### M11: 进度价差距 → 前端集成
- **Issue**: [#73](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/issues/73)
- **现状**: 引擎层OK (PR #83 已合并)，TrackingPage 未调用
- **引擎**: `progress_price_tracker.js` 已实现

### M12: 残余材料池 → 前端集成
- **Issue**: [#73](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/issues/73)
- **现状**: 引擎层OK (PR #85 已合并)，ChangeEnginePage 未调用
- **引擎**: `residual_pool_handler.js` 已实现

### M13: Dashboard 预警摘要
- **Issue**: [#66](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/issues/66)
- **现状**: 卡片位存在，未从AlertsPage拉取实时数据

### M14: 跨场景管理比较视图
- **Issue**: [#75](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/issues/75)
- **现状**: 管理层无跨场景统一比较

### M15: 项目导入 (Excel/CSV)
- **Issue**: [#66](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/issues/66)
- **现状**: 按钮存在，导入逻辑未对接后端

### M16: simulation_layers 高级功能
- **现状**: 仅基础层叠加(2.3KB)，缺Monte Carlo/历史回放/龙卷风图

## 🟡 Low — 锦上添花 (15项)

| ID | 功能 | Issue | 说明 |
|----|------|-------|------|
| L1 | 场景冻结/发布机制 | [#68](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/issues/68) | 冻结场景后禁止编辑 |
| L2 | 场景变更轨迹 | [#68](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/issues/68) | 变更链路时间轴视图 |
| L3 | BOM 导入校验规则 | [#67](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/issues/67) | 数量/单价合理性自动校验 |
| L4 | 参数权限边界 | [#71](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/issues/71) | 按角色限制可见数据范围 |
| L5 | 客户报价模板映射 | [#71](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/issues/71) | 可定制报价输出格式 |
| L6 | 仿真→正式场景转化 | [#72](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/issues/72) | 仿真结果一键应用 |
| L7 | 年降版本管理 | [#72](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/issues/72) | 多版本年降计划对比 |
| L8 | 预警→跟踪项自动创建 | [#76](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/issues/76) | 预警触发后自动创建跟踪任务 |
| L9 | Shapley 瀑布图 | [#75](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/issues/75) | 成本分摊可视化 |
| L10 | 经营异常聚合视图 | [#75](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/issues/75) | 多维异常聚合分析面板 |
| L11 | 费率基准发布流 | [#74](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/issues/74) | 费率变更审批流程 |
| L12 | Audit Trace ID | [#74](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/issues/74) | 全操作审计日志 |
| L13 | 版本锁定/回退 | [#74](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/issues/74) | 已发布版本不可修改 |
| L14 | 参数发布流 + 权限隔离 | [#78](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/issues/78) | 参数变更审批流程 |
| L15 | i18n 多语言 | - | 国际化支持 |

## 🔧 引擎层已就绪但未集成 (6个模块)

以下引擎模块代码完整、功能强大，但在页面层**完全没有被调用**：

| 引擎模块 | 代码量 | 功能 | Hook桥接 | 待接入页面 |
|---------|--------|------|----------|-----------|
| `cascade_impact.ts` | 587行 | 3个sheet级联+语义感知 | `useCascadeImpact.ts` ✅ | ChangeEnginePage ([#96](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/issues/96)) |
| `alert_workflow.ts` | 200行 | 7条规则+升级+建议操作 | `useAlertWorkflow.ts` ✅ | AlertsPage ([#95](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/issues/95)) |
| `scenario_lifecycle.ts` | 160行 | draft→frozen→published→archived | `useScenarioLifecycle.ts` ✅ | ProjectScenariosPage ([#97](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/issues/97)) |
| `bom_normalizer.ts` | 952行 | 标准化+特征提取+5级匹配 | `useBomNormalizer.ts` ✅ | BomDiffPage (可选增强) |
| `smart_paste.ts` | 130行 | TSV解析+列映射+预览 | `useSmartPaste.ts` ✅ | BomWorkbookPage ([#98](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/issues/98)) |
| `trace.ts` | 50行 | TraceID+性能监控 | - | 全局集成 |

**说明**: PR #94 已创建5个Hook桥接层，但页面尚未import使用。完成Issue #95-#98后可解决C1/C5/C7部分功能。

## 📋 待办任务 (task.json)

| ID | 任务 | 优先级 | 状态 |
|----|------|--------|------|
| T30 | 深色主题 + 工业蓝图风格 | P0 | Pending |
| T31 | 金属价格联动计算 | P1 | Pending (引擎已就绪，待前端集成) |
| T32 | SQLite 数据库初始化 + Migration | P0 | Pending |
| T33 | E2E 测试 — P0 主链路 | P0 | Pending |
| T34 | API 测试 — 核心计算规则 | P0 | Pending |
| T35 | Lighthouse 性能基线 | P1 | Pending |
| T36 | 大数据量表格性能 | P1 | Pending |
| T37 | API 响应时间基线 | P1 | Pending |
| T38 | 参数快照化完整实现 | P2 | Pending |

## 🚧 待合并的PR (8个有冲突)

以下PR包含大量已实现功能，但因main分支变更导致冲突，需本地rebase后合并：

| PR | 分支 | 预计解决功能 |
|----|------|-------------|
| [#79](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/pull/79) | feat/batch-37-tasks | C5部分, C6, C7部分, M3部分, M5, L1, L15 |
| [#80](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/pull/80) | fix/quote-empty-state | C3部分, C4 |
| [#81](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/pull/81) | fix/bom-engine-quote-sync | C1部分, C3, C4, C8部分 |
| [#82](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/pull/82) | fix/waterfall-shapley | L9 |
| [#84](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/pull/84) | fix/config-driven-coefficients | 引擎增强 |
| [#88](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/pull/88) | fix/close-remaining-issues | 代码质量 |
| [#89](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/pull/89) | fix/comprehensive-code-review | 安全增强 |
| [#90](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/pull/90) | feat/remaining-tasks-batch | 待确认内容 |

**乐观估计**: 8个PR全部rebase后合入，可额外解决约12项功能，将未实装总数从39降至**约27项**。

## 🐛 已知Bug (14个待修复)

详见 `LOCAL-AI-HANDOFF.md` 第2节，其中：
- 🔴 严重: 3个 (HarnessEditPage crash, 新建线束scenarioId空, QuotePage设变Tab失效)
- 🟠 中等: 5个
- 🟡 轻微: 6个

**C3和C4的精确修复代码已在Issue #62评论中提供，可直接copy-paste应用。**

## 📈 开发优先级建议

### Sprint 1 (本周)
- [ ] **C3**: 修复 QuotePage 设变Tab crash (2行改动)
- [ ] **C4**: 修复 BomWorkbookPage 保存不写回result (3行改动)
- [ ] **#95-#98**: 接入4个Hook到页面 (小工作量，高价值)

### Sprint 2
- [ ] **C1/C8**: 打通设变→BOM→报价传导链
- [ ] **C7**: 金属价格联动预警 (引擎已就绪)

### Sprint 3
- [ ] **C5**: 场景复制/继承
- [ ] **C6**: 参数快照化 (T38)
- [ ] **M11/M12**: 前端集成 progress_price_tracker 和 residual_pool_handler

### Sprint 4+
- [ ] M2-M10: 版本/快照/回收体系
- [ ] L1-L15: 低优先级打磨

## 🎯 关键判断

### 项目当前状态
- **引擎层**: 88% 完成度，代码质量高
- **数据层**: 84% 完成度，Store/Hook 较完善
- **页面层**: 66% 完成度，基础CRUD已实现
- **端到端联动**: 40% 完成度，**这是最大瓶颈**

### 核心问题
项目不是缺引擎，而是缺"胶水代码"。6个强大的引擎模块（cascade_impact/alert_workflow/scenario_lifecycle/bom_normalizer/smart_paste/trace）已实现但完全未被调用。

### 最快见效的行动
1. 应用C3/C4的2+3行修复（立即可用）
2. 接入4个Hook到页面（Issue #95-#98，小工作量）
3. Rebase并合并8个冲突PR（可解决约12项功能）

完成以上3步后，未实装功能可从39项降至**约15项**，项目完成度将达到**约88%**。

## 📚 参考文档

- PRD规格: `app_spec.md`
- 开发路线图: `ROADMAP.md`
- 本地交接文档: `LOCAL-AI-HANDOFF.md`
- GitHub Issues: [#59-#78](https://github.com/krnrin/cost-accounting-dynamic-model-v2026-04-02-1722/issues)
- 引擎集成指南: `app/src/hooks/ENGINE_INTEGRATION_GUIDE.md`
