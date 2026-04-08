# Issue #11: IndexedDB Schema 版本迁移指南

## 架构

```
┌──────────────┐     ┌──────────────────────┐
│  bom_db.js   │     │ schema_migrator.js   │
│ (物理 store) │     │ (数据格式迁移)       │
├──────────────┤     ├──────────────────────┤
│ IDB version  │     │ localStorage version │
│ = 3 (固定)   │     │ = N (递增)           │
│ store 结构   │     │ 字段级数据转换       │
└──────────────┘     └──────────────────────┘
```

### 为什么分两层？

- **IDB version** 变更会触发 `onupgradeneeded`，阻塞所有打开的连接，代价大
- **应用层 version** 用 localStorage 跟踪，迁移在普通 readwrite 事务中完成，无阻塞

## 使用方式

### 初始化时自动迁移

```javascript
// 在 app 启动时（dashboard 加载后）
await G281BomDb.init();
await G281SchemaMigrator.runPending(G281BomDb);
```

### 添加新迁移

```javascript
// 在 schema_migrator.js 底部添加
register(4, '新迁移描述', async function (db) {
  const records = await db.getAllRecords('targetStore');
  // ... 转换逻辑
  await db.putMany('targetStore', transformed);
});
```

### 规则

1. **版本号必须递增**：每个新迁移的 version 必须 > 上一个
2. **幂等性**：迁移函数应检查是否已迁移（如字段已存在则跳过）
3. **向前兼容**：旧版代码遇到新字段应忽略而不是报错
4. **失败中断**：任何迁移失败都会停止后续迁移，版本号停在最后成功的版本

### 调试

```javascript
// 查看当前版本
G281SchemaMigrator.getCurrentVersion()  // => 3

// 查看迁移日志
G281SchemaMigrator.getMigrationLog()

// 强制重置（开发用）
G281SchemaMigrator.forceResetVersion(0)
await G281SchemaMigrator.runPending(G281BomDb)
```

## 本地集成步骤

1. 在 HTML 中加载 `engine/schema_migrator.js`（在 `engine/bom_db.js` 之后）
2. 在应用初始化代码中添加 `await G281SchemaMigrator.runPending(G281BomDb)`
3. 后续新增字段/格式变更只需调用 `register()` 添加新迁移
