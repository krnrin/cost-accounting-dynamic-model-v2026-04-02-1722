# Univer 工作台版成本核算系统

离线优先的高压线束成本核算工作台，前端基于 React + Vite + Dexie + Univer，后端基于 Express + Prisma + SQLite。

## 仓库结构

- `app`：前端工作台，负责项目、场景、BOM Workbook、报价、仿真、版本中心、变更引擎。
- `server`：后端 API、认证、导出、SQLite/Prisma 持久化。
- `.github/workflows/ci.yml`：CI 门禁，包含前端 lint/test/build、后端 build、E2E smoke。

## 本地开发

### 1. 前置条件

- Node.js 20+
- npm 10+

### 2. 启动后端

```bash
cd server
npm ci
cp .env.example .env
npm run dev
```

默认健康检查：

```bash
curl http://127.0.0.1:3001/health
```

也可以使用：

```bash
cd server
npm run healthcheck
```

### 3. 启动前端

```bash
cd app
npm ci
cp .env.local.example .env.local
npm run dev
```

开发态默认通过 Vite 代理把 `/api` 转发到 `http://localhost:3001`。

## 生产部署

默认发布拓扑：

- 前端：静态构建产物 `app/dist`
- 后端：`node dist/index.js`
- 数据库：SQLite，物理文件位于 `server/prisma/data/harness_cost.db`

### 1. 构建

```bash
cd server
npm ci
npm run build

cd ../app
npm ci
npm run build
```

### 2. 初始化数据库

```bash
cd server
npm run db:init
```

### 3. 启动后端

```bash
cd server
npm start
```

### 4. 发布前端静态文件

把 `app/dist` 发布到静态文件服务或 Nginx。推荐同域部署，并把 `/api` 反向代理到 Express。

### 5. 生产环境变量

前端：

- `VITE_API_URL`
  - 同域反代推荐设为 `/api`
  - 分域部署示例：`https://api.example.com/api`
- `VITE_FEISHU_APP_ID`
- `VITE_FEISHU_APP_SECRET`

后端：

- `DATABASE_URL`
- `PORT`
- `NODE_ENV=production`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `CORS_ORIGIN`
- `FEISHU_APP_ID`
- `FEISHU_APP_SECRET`
- `FEISHU_ENCRYPT_KEY`
- `FEISHU_VERIFICATION_TOKEN`

## 质量门禁

前端：

```bash
cd app
npm run lint
npm run test:run
npm run build
```

后端：

```bash
cd server
npm run build
npm run db:init
npm run healthcheck
```

关键冒烟：

```bash
cd app
npx playwright test e2e/smoke.spec.ts
```

## 默认登录

如果使用初始化后的默认数据，可使用：

- 账号：`admin@harness.dev`
- 密码：`admin123`

## 备份与恢复

生产发布前先备份 SQLite 文件：

```bash
mkdir -p server/prisma/data/backups
cp server/prisma/data/harness_cost.db server/prisma/data/backups/harness_cost-$(date +%Y%m%d-%H%M%S).db
```

Windows PowerShell：

```powershell
New-Item -ItemType Directory -Force server\\prisma\\data\\backups
Copy-Item server\\prisma\\data\\harness_cost.db server\\prisma\\data\\backups\\harness_cost-$(Get-Date -Format yyyyMMdd-HHmmss).db
```

## 说明

- 前端未配置 `VITE_API_URL` 时默认请求 `/api`。
- 生产环境必须显式提供 `JWT_SECRET`，后端不会接受不安全的默认密钥。
