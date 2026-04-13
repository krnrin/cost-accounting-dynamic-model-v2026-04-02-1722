# \uD83D\uDDFA\uFE0F Cost Accounting Dynamic Model — 开发路线图

> 最后更新：2026-04-13  
> 基于 `app_spec.md` PRD 功能清单与当前代码库对比分析

## \uD83D\uDCCA 总体完成度

| 类别 | 完成 | 剩余 | 完成率 |
|------|------|------|--------|
| 引擎层 (engine/) | 37+ | ~5 | 88% |
| 数据层 (store/hooks) | 16+ | ~3 | 84% |
| 页面层 (pages/) | 29 | ~15 | 66% |
| 端到端联动 | ~8 | ~12 | 40% |
| **总体** | **~90** | **~35** | **72%** |

## \uD83D\uDD34 Critical — 必须修复

### C1: 设变→BOM→报价传导链
- **现状**: 设变创建后不自动触发 BOM 快照 + 报价重算
- **方案**: ChangeEnginePage 提交设变时调用 `bom_snapshot_manager` → `harness_costing` → 更新场景 result
- **涉及文件**: `ChangeEnginePage.tsx`, `bom_snapshot_manager.js`, `harness_costing.ts`

### C2: BomDiffPage 空壳 → 完整 Diff UI ✅
- **现状**: 仅 7 列静态表格，无基线选择器、无成本差异、无导出
- **修复**: 增强为完整 BOM 差异对比页面
- **分支**: `enhance/bom-diff-page`

### C3: QuotePage 设变 Tab Crash
- **现状**: `renderChangePricing` 读取不存在的 `processHours` 字段，`toFixed()` 对 undefined 调用导致崩溃
- **修复**: 添加 optional chaining + try-catch + 正确的字段映射
- **涉及文件**: `QuotePage.tsx` (31KB)

### C4: BomWorkbookPage 保存不写回 result
- **现状**: `handleSaveAll` 更新 `db.harnesses` 时只写 `input`，不写 `result`
- **修复**: 在 update 对象中加入 `result: resultsMap.get(harness.harnessId)`
- **涉及文件**: `BomWorkbookPage.tsx` (41KB)

### C5: 场景复制/继承
- **现状**: 无 UI 和逻辑支持场景复制
- **方案**: ScenarioListPage 加"复制场景"按钮 → 深拷贝 scenario + harnesses

### C6: 参数快照化
- **现状**: 参数变更不留历史快照
- **方案**: 在 config 变更时自动保存 snapshot 到 `config_snapshots` 表

### C7: 金属价格联动→预警触发
- **现状**: `metal_price_escalation.js` 引擎已实现，但预警未联动到 Dashboard
- **方案**: 在 DashboardPage 加载时调用引擎检查价格波动，生成预警 Card

### C8: 设变→报价影响自动传导
- **现状**: 设变完成后不自动重算报价
- **方案**: 同 C1，需要完整的事件传导管道

## \uD83D\uDFE0 Medium — 功能增强

### M1: ScenarioComparePage 维度不足 ✅
- 已增强：12 个 KPI 维度 + 全行 Delta + 线束级明细
- 分支: `enhance/scenario-compare`

### M2~M16 (详见 GitHub Issues #59-#78)
| ID | 功能 | 关联 Issue |
|----|------|------------|
| M2 | 场景版本关联 | #66 |
| M3 | BOM 快照管理 | #63 |
| M4 | BOM 变更链路可视化 | #64 |
| M5 | 报价参数快照 | #67 |
| M6 | 报价版本比较 | #68 |
| M7 | 仿真结果保存 | #69 |
| M8 | 年降挂接 | #70 |
| M9 | 回收明细 | #71 |
| M10 | 回收联动 | #72 |
| M11 | 进度价差距前端集成 | #73 |
| M12 | 残余材料池前端集成 | #74 |
| M13 | Dashboard 预警摘要 | #75 |
| M14 | 跨场景管理比较 | #76 |
| M15 | 项目导入 | #77 |
| M16 | simulation_layers 高级功能 | #78 |

## \uD83D\uDFE1 Low — 锦上添花

| ID | 功能 | 说明 |
|----|------|------|
| L1 | 场景冻结 | 冻结场景后禁止编辑 |
| L2 | 变更轨迹完整回放 | 变更链路时间轴视图 |
| L3 | BOM 校验规则 | 数量/单价合理性自动校验 |
| L4 | 权限边界隔离 | 按角色限制可见数据范围 |
| L5 | 客户报价模板 | 可定制报价输出格式 |
| L6 | 仿真→正式转化 | 仿真结果一键应用到正式场景 |
| L7 | 年降版本管理 | 多版本年降计划对比 |
| L8 | 预警→跟踪联动 | 预警触发后自动创建跟踪任务 |
| L9 | Shapley 瀑布图 | 成本分摊可视化 |
| L10 | 经营异常聚合 | 多维异常聚合分析面板 |
| L11 | 费率发布流 | 费率变更审批流程 |
| L12 | Audit Trace | 全操作审计日志 |
| L13 | 版本锁定 | 已发布版本不可修改 |
| L14 | 参数发布流 | 参数变更审批流程 |
| L15 | i18n 国际化 | 多语言支持 |

## \uD83C\uDFD7\uFE0F 推荐开发顺序

```
Sprint 1 (本周):  C3 C4        → 修复崩溃与数据丢失
Sprint 2:         C1 C8        → 打通设变→报价传导链
Sprint 3:         C5 C6 C7     → 场景管理 & 预警
Sprint 4:         M2 M3 M4 M5 M6 → 版本 & 快照体系
Sprint 5:         M7 M8 M9 M10 → 仿真 & 回收
Sprint 6:         M11~M16      → 剩余中优先级
Sprint 7+:        L1~L15       → 低优先级打磨
```

## \uD83D\uDD17 8 个待解决的合并冲突 PR

以下 PR 包含大量已实现功能代码，但因 main 分支变更导致冲突，需要本地 rebase 后合并：

| PR | 分支 | 包含功能 |
|----|------|----------|
| #79 | feat/batch-37-tasks | 批量任务处理（37项） |
| #80 | fix/quote-empty-state-and-save-result | 报价空状态 + 结果保存 |
| #81 | fix/bom-engine-quote-sync | BOM-引擎-报价同步 |
| #82 | fix/issue3-waterfall-shapley | 瀑布图 + Shapley |
| #84 | fix/issue4-config-driven-coefficients | 配置驱动系数 |
| #88 | fix/close-remaining-issues | 关闭剩余 Issues |
| #89 | fix/comprehensive-code-review | 综合代码审查修复 |
| #90 | feat/remaining-tasks-batch | 剩余任务批处理 |

> 如果这 8 个 PR 全部 rebase 并合并，预计可再解决约 12 个功能项，总剩余将降至约 27 项。

## \uD83D\uDCCE 参考

- PRD 规格: `/app_spec.md`
- GitHub Issues: #59 ~ #78
- 分析存档: Notion 工作区「存档 · G281仓库未实装功能深度分析 · 2026-04-13」
