# 技术栈与 CI/CD 配置说明

> **更新日期**: 2026-04-12

---

## 1. 技术栈详情

### 前端框架

| 包名 | 版本 | 用途 |
|---|---|---|
| react | 18.x | UI 框架 |
| react-dom | 18.x | DOM 渲染 |
| react-router-dom | 7.x | 路由管理 |
| typescript | 5.7.x | 类型系统 |

### UI 与可视化

| 包名 | 版本 | 用途 |
|---|---|---|
| @douyinfe/semi-ui | latest | UI 组件库（字节跳动 Semi Design） |
| @univerjs/presets | latest | 电子表格引擎（Univer） |
| echarts | 5.x | 图表可视化 |

### 状态与数据

| 包名 | 版本 | 用途 |
|---|---|---|
| zustand | 5.x | 状态管理（15 个独立 store） |
| dexie | latest | IndexedDB 封装（本地持久化） |

### 构建与测试

| 包名 | 版本 | 用途 |
|---|---|---|
| vite | 6.2.x | 构建工具 |
| vitest | 3.1.x | 单元测试框架 |

### 运行环境

| 项目 | 要求 |
|---|---|
| Node.js | 20.x |
| 包管理器 | npm |
| 工作目录 | `app/` |

---

## 2. CI/CD 配置

### GitHub Actions 工作流

文件: `.github/workflows/ci.yml`

```yaml
# 触发条件: push to main, PR to main
# 步骤:
#   1. npm ci (在 app/ 目录)
#   2. npx tsc -b
#   3. npx vitest run
#   4. npx vite build
```

### 当前 CI 状态

- **CI #6** (commit `e5f98d04`): ✅ 全部通过
  - tsc: 0 errors
  - vitest: 364/364 passed
  - vite build: 成功

---

## 3. 本地开发命令

```bash
# 安装依赖
cd app && npm ci

# 类型检查
npx tsc -b

# 运行测试
npx vitest run

# 开发服务器
npm run dev

# 生产构建
npx vite build
```

---

## 4. tsconfig 关键约束

| 选项 | 值 | 影响 |
|---|---|---|
| strict | true | 全面严格类型检查 |
| noUnusedLocals | true | 禁止未使用的局部变量 |
| noUnusedParameters | true | 禁止未使用的参数 |
| noUncheckedIndexedAccess | true | 索引访问返回 `T \| undefined` |
| paths | `@/*` → `src/*` | 路径别名 |
| exclude | `__backup_v1`, `__tests__`, `*.test.*` | 排除测试和备份 |

> ⚠️ `noUncheckedIndexedAccess` 是最容易被忽略的约束。任何 `array[i]` 或 `record[key]` 都需要处理 `undefined` 的情况，否则 tsc 报错。

---

## 5. 15 个 Zustand Store

| Store | 文件 | 职责 |
|---|---|---|
| pricingStore | pricingStore.ts | 报价参数与计算结果 |
| allocStore | allocStore.ts | 一次性费用分摊 |
| authStore | authStore.ts | 认证与用户状态 |
| settingsStore | settingsStore.ts | 系统配置参数 |
| scenarioStore | scenarioStore.ts | 场景管理 |
| versionStore | versionStore.ts | 版本与发布 |
| projectStore | projectStore.ts | 项目列表与选择 |
| bomStore | bomStore.ts | BOM 数据 |
| quoteStore | quoteStore.ts | 客户报价 |
| trackingStore | trackingStore.ts | 跟踪管理 |
| alertStore | alertStore.ts | 预警状态 |
| metalStore | metalStore.ts | 金属价格 |
| simulationStore | simulationStore.ts | 仿真参数 |
| changeStore | changeStore.ts | 设变事件 |
| uiStore | uiStore.ts | UI 状态（主题、布局等） |

> 注: 以上 Store 名称基于代码审查，实际文件名可能略有差异。
