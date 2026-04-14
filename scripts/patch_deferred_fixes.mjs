#!/usr/bin/env node
/**
 * patch_deferred_fixes.mjs — 延迟修复补丁脚本
 *
 * 处理:
 *   1. engine/compute_model.js — DI Context 注入 (P1-#8)
 *   2. app/src/engine/metal_escalation.ts — 注释修正 (P2-#19)
 *   3. app/src/engine/excel_export.ts — 废弃 exportMetalEscalationExcel (P2-#15)
 *
 * 用法: node scripts/patch_deferred_fixes.mjs
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(process.cwd());
const results = [];

function patchFile(relPath, patches) {
  const fullPath = path.join(ROOT, relPath);
  if (!fs.existsSync(fullPath)) {
    results.push({ file: relPath, status: 'SKIP', reason: 'file not found' });
    return;
  }
  let content = fs.readFileSync(fullPath, 'utf-8');
  let applied = 0;
  for (const p of patches) {
    if (content.includes(p.find)) {
      content = content.replace(p.find, p.replace);
      applied++;
    }
  }
  if (applied > 0) {
    fs.writeFileSync(fullPath, content, 'utf-8');
    results.push({ file: relPath, status: 'OK', patches: applied });
  } else {
    results.push({ file: relPath, status: 'SKIP', reason: 'no matches' });
  }
}

// ── 1. compute_model.js: DI Context 注入 ──

const CTX_HELPER = `
  // ── DI Context (replaces global.* coupling) ──
  // See engine/engine_context.js for the full DI container.
  // resolveCtx() auto-falls-back to global.* for backward compatibility.
  function resolveCtx() {
    if (global.G281EngineContext) return global.G281EngineContext.create();
    return {
      progressTracker: global.G281ProgressPriceTracker || null,
      configBridge:    global.ConfigBridge || null,
      harnessCosting:  global.G281HarnessCosting || null,
      harnessProfit:   global.G281HarnessProfit || null,
      computationPath: global.ComputationPath || null,
    };
  }
`;

patchFile('engine/compute_model.js', [
  // Insert resolveCtx after 'use strict'
  {
    find: "  'use strict';\n\n  const clamp",
    replace: "  'use strict';\n" + CTX_HELPER + "\n  const clamp",
  },
  // buildConnectorScenario: replace global.G281ProgressPriceTracker
  {
    find: 'const progressTracker = global.G281ProgressPriceTracker;',
    replace: 'const progressTracker = resolveCtx().progressTracker;',
  },
  // computeModel: replace global.ConfigBridge for stateDefaults
  {
    find: 'const sd = (global.ConfigBridge && global.ConfigBridge.stateDefaults)\n      ? global.ConfigBridge.stateDefaults()',
    replace: 'var _ctx = resolveCtx();\n    const sd = (_ctx.configBridge && _ctx.configBridge.stateDefaults)\n      ? _ctx.configBridge.stateDefaults()',
  },
  // computeModel: replace global.ConfigBridge for metalSensitivity
  {
    find: 'const ms = (global.ConfigBridge && global.ConfigBridge.metalSensitivity)\n      ? global.ConfigBridge.metalSensitivity()',
    replace: 'const ms = (_ctx.configBridge && _ctx.configBridge.metalSensitivity)\n      ? _ctx.configBridge.metalSensitivity()',
  },
  // computeModel: replace global.ConfigBridge for materialComposition
  {
    find: 'const mc = (global.ConfigBridge && global.ConfigBridge.materialComposition)\n      ? global.ConfigBridge.materialComposition()',
    replace: 'const mc = (_ctx.configBridge && _ctx.configBridge.materialComposition)\n      ? _ctx.configBridge.materialComposition()',
  },
  // computeModelV2: replace global.G281HarnessCosting
  {
    find: 'var HarnessCosting = global.G281HarnessCosting;',
    replace: 'var _ctx2 = resolveCtx();\n      var HarnessCosting = _ctx2.harnessCosting;',
  },
  // computeModelV2: replace global.ConfigBridge.raw
  {
    find: 'var costRates = (global.ConfigBridge && typeof global.ConfigBridge.raw === \'function\'\n          ? global.ConfigBridge.raw()',
    replace: 'var costRates = (_ctx2.configBridge && typeof _ctx2.configBridge.raw === \'function\'\n          ? _ctx2.configBridge.raw()',
  },
  // attachHarnessProfit: replace global.G281HarnessProfit
  {
    find: 'if (!global.G281HarnessProfit || typeof global.G281HarnessProfit.buildHarnessProfitBreakdown !== \'function\')',
    replace: 'var _ctxHP = resolveCtx();\n    if (!_ctxHP.harnessProfit || typeof _ctxHP.harnessProfit.buildHarnessProfitBreakdown !== \'function\')',
  },
  {
    find: 'return global.G281HarnessProfit.buildHarnessProfitBreakdown(',
    replace: 'return _ctxHP.harnessProfit.buildHarnessProfitBreakdown(',
  },
  // computeModelV2: replace global.ComputationPath
  {
    find: 'result.computationPath = global.ComputationPath\n      ? global.ComputationPath.detect(result)',
    replace: 'result.computationPath = _ctx2.computationPath\n      ? _ctx2.computationPath.detect(result)',
  },
]);

// ── 2. metal_escalation.ts: 注释修正 ──

patchFile('app/src/engine/metal_escalation.ts', [
  {
    find: '// \u8054\u52a8: \u5229\u6da6\u7387 \u2014 \u5229\u6da6\u57fa\u6570\u542b\u5e9f\u54c1',
    replace: '// \u8054\u52a8: \u5229\u6da6\u7387 \u2014 \u5229\u6da6\u57fa\u6570 = \u6750\u6599\u53d8\u5316 + \u5e9f\u54c1 + \u7ba1\u7406\u8d39',
  },
]);

// ── 3. excel_export.ts: 废弃 exportMetalEscalationExcel ──

patchFile('app/src/engine/excel_export.ts', [
  {
    find: `/**\n * \u5bfc\u51fa\u91d1\u5c5e\u8054\u52a8\u5206\u6790 Excel\n */\nexport function exportMetalEscalationExcel(\n  _result: MetalEscalationResultType,\n  _projectName: string,\n  _customer: string,\n) {\n  // Placeholder for metal escalation export logic\n  console.log("Metal escalation export not yet implemented.");\n}`,
    replace: `/**\n * @deprecated \u529f\u80fd\u5df2\u5e9f\u5f03 \u2014 \u91d1\u5c5e\u6da8\u4ef7\u5bfc\u51fa\u4e0d\u518d\u9700\u8981\n */\nexport function exportMetalEscalationExcel(\n  _result: MetalEscalationResultType,\n  _projectName: string,\n  _customer: string,\n) {\n  // \u529f\u80fd\u5df2\u5e9f\u5f03\n  throw new Error('exportMetalEscalationExcel \u5df2\u5e9f\u5f03\uff0c\u529f\u80fd\u4e0d\u518d\u9700\u8981');\n}`,
  },
]);

// ── 输出结果 ──
console.log('\n\u2550\u2550\u2550 patch_deferred_fixes.mjs \u7ed3\u679c \u2550\u2550\u2550');
for (const r of results) {
  const icon = r.status === 'OK' ? '\u2705' : '\u26a0\ufe0f';
  console.log(`${icon} ${r.file}: ${r.status}${r.patches ? ` (${r.patches} patches)` : ''}${r.reason ? ` (${r.reason})` : ''}`);
}
console.log('\n\u5b8c\u6210\u3002\u8bf7 git add -A && git commit -m "fix: deferred patches applied" && git push');
