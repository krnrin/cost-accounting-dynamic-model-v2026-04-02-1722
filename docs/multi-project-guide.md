# Issue #14: 多项目可复用架构指南

## 架构总览

```
┌─────────────────────────────────────────┐
│              项目切换器 UI               │
│         shared/project_switcher.js       │
└────────────────┬────────────────────────┘
                 │ switchProject(code)
┌────────────────▼────────────────────────┐
│           项目注册表                     │
│       config/project_registry.js         │
│  ┌──────────┬──────────┬──────────┐     │
│  │   G281   │   E281   │  新项目  │     │
│  │ config   │ config   │ config   │     │
│  └────┬─────┴────┬─────┴────┬─────┘     │
└───────┼──────────┼──────────┼───────────┘
        │          │          │
   g281-bom-   e281-bom-   xxx-bom-
   store-g281  store-e281  store-xxx
   (独立 IDB)  (独立 IDB)  (独立 IDB)
```

## 用户决策回顾

| 决策项 | 选择 | 说明 |
|---|---|---|
| 配置存储 | JSON 文件（方案 B） | 每个项目一个 `config/{code}.project.json` |
| 数据隔离 | 完全隔离 | 每个项目独立 IndexedDB 数据库 |
| 变更管控 | 锁定+变更流程 | 生命周期年限、车型配置比例设定后锁定 |

## 使用方式

### 注册新项目

```javascript
// 1. 创建配置文件 config/e281.project.json（参照 g281.project.json）
// 2. 在代码中注册
G281ProjectRegistry.registerProject('E281', e281Config);
// 3. 锁定关键参数
G281ProjectRegistry.lockProject('E281');
```

### 切换项目

```javascript
// 通过 UI 下拉选择，或代码调用
G281ProjectRegistry.switchProject('E281');
// ConfigLoader 自动加载新配置
// BomDb 自动切换到 e281 专属数据库
```

### 变更管控

```javascript
// 锁定后修改需通过变更流程
G281ProjectRegistry.requestChange('E281', {
  reason: 'ECN-2026-045: 新增车型配置 HEV-Pro',
  fields: ['vehicleConfigs'],
  newValues: {
    vehicleConfigs: [
      { code: 'BEV', label: '纯电', share: 0.50 },
      { code: 'PHEV', label: '插混', share: 0.30 },
      { code: 'HEV-Pro', label: '混动Pro', share: 0.20 },
    ],
  },
  requestedBy: 'Veer',
});

// 查看变更历史
G281ProjectRegistry.getChangeLog('E281');
```

## 本地集成步骤

1. 在 HTML 中加载（在 config_bridge.js 之后）：
   ```html
   <script src="./config/project_registry.js"></script>
   <script src="./shared/project_switcher.js"></script>
   <link rel="stylesheet" href="./shared/project_switcher.css">
   ```

2. 在导航栏中挂载切换器：
   ```javascript
   G281ProjectSwitcher.render(
     document.getElementById('project-switcher-mount'),
     {
       onSwitch: (code) => console.log('切换到:', code),
       onReInit: (code) => recalculate(),  // 重新计算
     }
   );
   ```

3. 注册已有项目：
   ```javascript
   // 加载 G281 配置并注册
   fetch('./config/g281.project.json')
     .then(r => r.json())
     .then(config => {
       G281ProjectRegistry.registerProject('G281', config);
       G281ProjectRegistry.switchProject('G281');
       G281ProjectRegistry.lockProject('G281');
     });
   ```

4. 新项目复用：复制 `g281.project.json`，修改项目特有参数（线束号、车型配置、量纲），注册即可
