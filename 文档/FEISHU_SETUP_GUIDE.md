# 飞书集成配置指南

## 概述

本文档指导你在飞书开放平台创建企业自建应用，并配置与成本核算工作台的集成。

集成后支持：
- 飞书免登（在飞书客户端内自动登录）
- 浏览器端飞书 OAuth 授权登录
- 飞书多维表格数据存储（替代本地 SQLite）
- 消息卡片通知（金属价格预警、核算完成通知）

## 步骤一：创建飞书应用

1. 登录 [飞书开放平台](https://open.feishu.cn)
2. 点击「创建应用」→「企业自建应用」
3. 填写应用信息：
   - 应用名称：`成本核算工作台`（或自定义名称）
   - 应用描述：`汽车高压线束成本核算动态模型`
   - 应用图标：自选
4. 创建完成后记录 **App ID** 和 **App Secret**

## 步骤二：配置应用能力

### 2.1 网页应用
1. 在应用详情 → 「应用能力」→「网页应用」
2. 点击「添加」
3. 配置：
   - **桌面端主页**：`http://localhost:5173`（开发环境）或你的生产域名
   - **移动端主页**：同上
   - **PC 端免登链接**：`http://localhost:5173`

### 2.2 安全设置
1. 「安全设置」→「重定向 URL」
2. 添加：
   - `http://localhost:5173/auth/callback`（开发）
   - `https://你的域名/auth/callback`（生产）

## 步骤三：申请权限

在「权限管理」中申请以下权限：

| 权限名称 | 权限标识 | 用途 |
|:--|:--|:--|
| 获取用户基本信息 | contact:user.base:readonly | 免登获取用户姓名/头像 |
| 获取用户邮箱 | contact:user.email:readonly | 获取用户邮箱 |
| 查看、评论和导出多维表格 | bitable:app:readonly | 读取多维表格数据 |
| 管理多维表格 | bitable:app | 写入多维表格数据 |
| 发送消息 | im:message:send_as_bot | 发送通知卡片 |

## 步骤四：创建多维表格

1. 在飞书中创建一个新的多维表格
2. 在多维表格中创建以下数据表：

### 4.1 Projects 表（项目表）
| 字段名 | 类型 | 说明 |
|:--|:--|:--|
| 记录ID | 文本 | 应用内部 ID |
| 项目编号 | 文本 | 如 E281 |
| 项目名称 | 文本 | 如 吉利E281高压线束 |
| 客户 | 文本 | 如 吉利 |
| 平台 | 文本 | 如 SPA |
| 状态 | 单选 | draft / active / archived |
| 成本费率 | 文本 | JSON 格式 |
| 内部成本费率 | 文本 | JSON 格式 |
| 金属价格 | 文本 | JSON 格式 |
| 产量计划 | 文本 | JSON 格式 |
| 项目配置 | 文本 | JSON 格式（完整 ProjectConfig）|
| 创建人 | 文本 | |
| 创建时间 | 日期 | |
| 更新时间 | 日期 | |

### 4.2 Harnesses 表（线束表）
| 字段名 | 类型 | 说明 |
|:--|:--|:--|
| 记录ID | 文本 | 应用内部 ID |
| 项目ID | 文本 | 关联 Projects 表 |
| 线束编号 | 文本 | 如 6938504 |
| 线束名称 | 文本 | 如 蓄电池正极线束 |
| 输入数据 | 文本 | JSON 格式（HarnessInput）|
| 计算结果 | 文本 | JSON 格式（HarnessResult）|
| 更新时间 | 日期 | |

### 4.3 Quotes 表（报价表）
| 字段名 | 类型 | 说明 |
|:--|:--|:--|
| 记录ID | 文本 | 应用内部 ID |
| 项目ID | 文本 | |
| 版本 | 文本 | 如 v1.0 |
| 状态 | 单选 | draft / submitted / approved |
| 模板 | 文本 | geely / byd / generic |
| 报价数据 | 文本 | JSON 格式 |
| 创建时间 | 日期 | |
| 更新时间 | 日期 | |

### 4.4 Versions 表（版本表）
| 字段名 | 类型 | 说明 |
|:--|:--|:--|
| 记录ID | 文本 | 应用内部 ID |
| 项目ID | 文本 | |
| 版本号 | 数字 | |
| 标签 | 文本 | |
| 状态 | 文本 | |
| 快照数据 | 文本 | JSON 格式 |
| 备注 | 文本 | |
| 创建人 | 文本 | |
| 创建时间 | 日期 | |

### 4.5 AuditLogs 表（审计日志表）
| 字段名 | 类型 | 说明 |
|:--|:--|:--|
| 记录ID | 文本 | |
| 用户ID | 文本 | |
| 用户名 | 文本 | |
| 项目ID | 文本 | |
| 操作 | 文本 | |
| 实体类型 | 文本 | |
| 实体ID | 文本 | |
| 详情 | 文本 | JSON 格式 |
| 操作时间 | 日期 | |

5. 创建完成后，获取：
   - **App Token**: 多维表格 URL 中 `/base/` 后面的部分，如 `bascnXXXXXX`
   - **各表 Table ID**: 点击每个表的「...」→「复制链接」，URL 中 `table=` 后面的部分，如 `tblXXXXXX`

## 步骤五：配置环境变量

在 `app/` 目录下创建 `.env.local` 文件（不要提交到 Git）：

```env
# 飞书应用配置
VITE_FEISHU_APP_ID=cli_xxxxxxxxxx
VITE_FEISHU_APP_SECRET=xxxxxxxxxxxxxxxxxx

# 飞书多维表格配置
VITE_BITABLE_APP_TOKEN=bascnXXXXXX
VITE_BITABLE_TABLE_PROJECTS=tblXXXXXX
VITE_BITABLE_TABLE_HARNESSES=tblXXXXXX
VITE_BITABLE_TABLE_QUOTES=tblXXXXXX
VITE_BITABLE_TABLE_VERSIONS=tblXXXXXX
VITE_BITABLE_TABLE_AUDIT_LOGS=tblXXXXXX
```

## 步骤六：发布应用

1. 「应用发布」→「版本管理」→「创建版本」
2. 发布范围：选择「全部成员」（全组织可见）
3. 提交审核
4. 管理员审批通过后，应用将出现在飞书工作台

## 本地开发

```bash
cd app
cp .env.local.example .env.local
# 编辑 .env.local 填入你的飞书配置
npm run dev
```

在飞书开发者后台的「调试」页面，可以用手机扫码在飞书客户端中测试免登流程。

## 故障排查

| 问题 | 解决方案 |
|:--|:--|
| 飞书登录按钮灰色/不可用 | 检查 `VITE_FEISHU_APP_ID` 是否已配置 |
| 免登报错 `H5SDK 加载超时` | 检查 index.html 中的 SDK 脚本标签是否正确 |
| Bitable 读写报 403 | 检查应用权限是否已申请并审批 |
| OAuth 重定向失败 | 检查「安全设置」中的重定向 URL 是否匹配 |
| `tenant_access_token` 获取失败 | 检查 App Secret 是否正确 |
