# [已废弃方案] 产品需求文档 (PRD): 汽车高压线束动态成本利润核算模型

| 项目名称 | 汽车高压线束动态成本利润核算模型 (HV-Harness Dynamic Cost Model) |
| :--- | :--- |
| **项目版本** | v1.3.0 (Banknote/Paper Ledger Release) |
| **生效日期** | 2026-04-06 |
| **状态** | 已定稿 (Approved) |
| **负责人** | 钱佳玲 (Product Manager) |

---

## 1. 项目愿景与核心目标 (Vision & Objectives)

构建一个具备**纸质账本质感**与**工业精算灵魂**的决策工具。系统通过极致的黑白高对比度视觉（Banknote Aesthetic），传达财务的严谨性与专业度，辅助管理者进行高频、敏捷的利润对冲模拟。

1.  **实绩穿透 (Truth-at-Source)**：基于财务发布的“运营工时费报价基准”，透视工厂 0.1% 级的损耗偏差。
2.  **动态模拟 (What-if Simulation)**：通过 150ms 丝滑动效，实时呈现产能利用率对制造费用的稀释效果。
3.  **精算逻辑溯源 (Logic Drill-down)**：实现“见数即见源”，点击单元格即可下钻查看原始 JSON 核算逻辑。
4.  **管理闭环 (Exception Sign-off)**：异常偏差强制关联 ECR/签核说明，锁定 V3.0 报价导出。
5.  **Banknote UI/UX (Monotone Aesthetic)**：采用极致黑白灰配色，胶囊式导航与侧边栏，呈现如“印钞机”般的精密感与“纸质账本”的经典美感。

---

## 2. 功能需求 (Functional Requirements)

### 2.1 决策舱核心看板 (Decision Cockpit)
*   **胶囊导航 (Capsule Navigation)**：顶部水平胶囊导航栏（Dashboard, Analytics, Production, Inventory, Settings）。
*   **侧边胶囊栏 (Vertical Sidebar)**：左侧垂直胶囊图标栏（Projects, Reports, Alerts, Profile）。
*   **卡片式布局 (Floating Cards)**：
    *   **项目身份卡**：占据左侧大面积，显示公司名称与当前项目。
    *   **KPI 实时卡**：右侧展示单车成本、材料损耗差异等关键指标，配有微型趋势图。
    *   **深度分析看板**：下方横跨全屏，展示周度生产效率与成本走势，结合数据表格。
*   **数值逻辑穿透**: 点击任一核算结果，弹出浮层显示对应的 `Internal_Actual_Rate_Master.json` 代码片段及行号。

### 2.2 异常管理与导出逻辑
*   **异常熔断**: 当损耗偏差 > 0.5% 且未签核时，物理锁定 V3.0 OEM 报价导出。
*   **签核弹窗**: 强制录入 ECR ID、原因分类及溯源说明。

---

## 3. UI/UX 规范 (UI/UX Specifications) - v1.3.0

### 3.1 视觉风格: 纸质账本/印钞机质感 (Banknote/Paper Ledger)
*   **设计基调**: **“财务严谨叙事”**。通过高对比度黑白灰、等宽字体与精密线条模拟高端金融凭证。
*   **色彩体系**:
    *   主色: `#18181B` (深邃黑)。
    *   背景: `#FFFFFF` (纯白) 或极浅灰 `#F4F4F5`。
    *   点缀: `#71717A` (沉稳灰)。
*   **背景层 (Backdrop)**:
    *   **黑白工业滤镜**: 嵌入 `grayscale(100%)` 的工业线束工厂照片，透明度 0.6。
    *   **深度模糊**: `backdrop-filter: blur(50px)`。
*   **组件特征**:
    *   **胶囊化**: 导航、侧边栏、激活状态（Pill）均采用大圆角胶囊形态。
    *   **玻璃拟态**: `border: 1px solid rgba(0,0,0,0.05)`，配合柔和阴影。

### 3.2 交互与动效 (Interactivity)
*   **150ms 丝滑过渡**: 所有滑块调节与状态切换使用 `cubic-bezier(0.4, 0, 0.2, 1)`。
*   **字体规范**:
    *   UI 标题: **Inter / SF Pro Display** (加粗)。
    *   数据/代码: **JetBrains Mono / Consolas** (极致对齐)。

---

## 4. 技术与合规约束 (Technical & Compliance)

*   **业务净值化**: 严禁所有 UI、导出文件及协同消息包含任何社交媒体化表达。
*   **数据一致性**: 动效层仅做视觉补间，计算结果必须严格校验。
*   **审计标识**: 所有导出文件页脚强制绑定 `Audit_Trace_ID`。

---

## 5. 优先级 (MoSCoW)

*   **Must Have**: Banknote UI 框架、150ms 平滑补间、胶囊导航、Logic Drill-down。
*   **Should Have**: 线束工厂黑白视差背景、吉利/比亚迪报价映射。
*   **Could Have**: 纸质纹理覆盖层（Texture Overlay）、打印预览模式。
