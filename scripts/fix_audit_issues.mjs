#!/usr/bin/env node
/**
 * fix_audit_issues.mjs — Batch fix for all audit issues (P0/P1/P2)
 *
 * Run from repo root:
 *   node scripts/fix_audit_issues.mjs
 *
 * Already fixed by direct push (config.ts, prisma.ts):
 *   P1-#1   JWT_SECRET production guard
 *   P2-#3   prisma.ts $disconnect
 *
 * Fixed by this script:
 *   P0-#17  change_propagation.ts   result.processCost → result.manufacturing
 *   P0-#21  bom_snapshot_manager.ts  quantity → qty
 *   P0-#22  ProjectScenariosPage.tsx mojibake label
 *   P0-#23  SimulationPage.tsx       annualDropRate double-division
 *   P1-#14  bom_normalizer.ts        textSimilarity length cap
 *   P1-#16  authStore.ts             DEV bypass explicit warning
 *   P1-#24  LoginPage.tsx            remove hardcoded default credentials
 *   P2-#6   bomService.ts            splice → filter (stable row IDs)
 *   P2-#7   simulationService.ts     extract sensitivity factors to constants
 *   P2-#9   bom_db.js                add close() method
 *   P2-#10  harness_profit.js        runtime deprecation warning
 *   P2-#11  bom_db.js                onblocked → memory fallback
 *   P2-#12  schema_migrator.js       migration failure recovery note
 *   P2-#25  AllocManagerPage.tsx      dead lifecycleYears removal
 *
 * FALSE POSITIVE (no fix needed):
 *   P0-#20  incremental_calc.ts      mgmtFee base is correct (consistent with harness_costing.ts)
 *
 * Deferred (needs manual / architectural work):
 *   P1-#8   compute_model.js         global.* coupling → major refactor
 *   P1-#13  quote_template.ts        A1/A2 hardcoded split → needs biz review
 *   P2-#4   managerDashboardService  N+1 → needs pagination design
 *   P2-#5   allocationService.ts     sequential tx ops → correct for consistency
 *   P2-#15  excel_export.ts          metal escalation template → needs spec
 *   P2-#18  metal_api.ts             URL artifact → Notion rendering, not real
 *   P2-#19  metal_escalation.ts      comment precision → cosmetic
 */
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
let totalFixed = 0;
let totalSkipped = 0;
let totalNotFound = 0;

function patch(relPath, patches) {
  const abs = path.join(ROOT, relPath);
  if (!fs.existsSync(abs)) {
    console.warn(`  ⚠️  FILE NOT FOUND: ${relPath}`);
    totalNotFound += patches.length;
    return;
  }
  let content = fs.readFileSync(abs, 'utf-8');
  let changed = false;
  for (const { search, replace, label } of patches) {
    if (typeof search === 'string') {
      if (content.includes(search)) {
        content = content.replace(search, replace);
        console.log(`  ✅ ${label}`);
        totalFixed++;
        changed = true;
      } else {
        console.warn(`  ⚠️  Pattern not found: ${label}`);
        totalSkipped++;
      }
    } else {
      // RegExp
      if (search.test(content)) {
        content = content.replace(search, replace);
        console.log(`  ✅ ${label}`);
        totalFixed++;
        changed = true;
      } else {
        console.warn(`  ⚠️  Regex not matched: ${label}`);
        totalSkipped++;
      }
    }
  }
  if (changed) {
    fs.writeFileSync(abs, content, 'utf-8');
    console.log(`  📝 Saved: ${relPath}`);
  }
}

console.log('\n🔧 Applying audit issue fixes...\n');

// ═══════════════════════════════════════════════════════════════════
// P0-#17: change_propagation.ts — result.processCost → result.manufacturing
// ═══════════════════════════════════════════════════════════════════
console.log('[P0-#17] change_propagation.ts');
patch('app/src/engine/change_propagation.ts', [
  {
    search: 'const processCost = numberOr(result.processCost, 0);',
    replace: 'const processCost = numberOr(result.manufacturing, 0); // P0-#17 fix: was result.processCost',
    label: 'result.processCost → result.manufacturing',
  },
]);

// ═══════════════════════════════════════════════════════════════════
// P0-#21: bom_snapshot_manager.ts — quantity → qty
// ═══════════════════════════════════════════════════════════════════
console.log('[P0-#21] bom_snapshot_manager.ts');
patch('app/src/engine/bom_snapshot_manager.ts', [
  {
    search: '${i.partNo || \'\'}:${i.quantity || 0}:${i.unitPrice || 0}',
    replace: '${i.partNo || \'\'}:${i.qty || 0}:${i.unitPrice || 0}',
    label: 'computeChecksum: i.quantity → i.qty',
  },
  {
    search: "const fields = ['quantity', 'unitPrice', 'supplier', 'unit', 'partName'] as const;",
    replace: "const fields = ['qty', 'unitPrice', 'supplier', 'unit', 'partName'] as const; // P0-#21 fix: was 'quantity'",
    label: 'diffBomSnapshots: quantity → qty in fields array',
  },
]);

// ═══════════════════════════════════════════════════════════════════
// P0-#22: ProjectScenariosPage.tsx — mojibake label
// ═══════════════════════════════════════════════════════════════════
console.log('[P0-#22] ProjectScenariosPage.tsx');
patch('app/src/pages/ProjectScenariosPage.tsx', [
  {
    // Common mojibake pattern: garbled UTF-8 for Chinese text
    // Try multiple patterns for the garbled string
    search: /[\ufffd\u00e8\u00e4\u00b8][^'"]{3,30}(?=['"])/,
    replace: '费率快照版本',
    label: 'Fix mojibake label → 费率快照版本',
  },
]);

// ═══════════════════════════════════════════════════════════════════
// P0-#23: SimulationPage.tsx — annualDropRate double-division
// ═══════════════════════════════════════════════════════════════════
console.log('[P0-#23] SimulationPage.tsx');
patch('app/src/pages/SimulationPage.tsx', [
  {
    search: / \/ 100 \/ 100/g,
    replace: ' / 100',
    label: 'Remove double /100 division on annualDropRate',
  },
  {
    // Alternative pattern: without spaces
    search: /\/100\/100/g,
    replace: '/100',
    label: 'Remove double /100 (no-space variant)',
  },
]);

// ═══════════════════════════════════════════════════════════════════
// P1-#14: bom_normalizer.ts — textSimilarity performance guard
// ═══════════════════════════════════════════════════════════════════
console.log('[P1-#14] bom_normalizer.ts');
patch('app/src/engine/bom_normalizer.ts', [
  {
    search: '// ── 文本相似度 ───────────────────────────────────────────────────────────────',
    replace: `// ── 文本相似度 ───────────────────────────────────────────────────────────────

/** P1-#14: Fast token-based Jaccard similarity (O(n) fallback for long strings) */
function tokenJaccard(a: string, b: string): number {
  const tokensA = new Set(a.toUpperCase().split(/\\s+/).filter(Boolean));
  const tokensB = new Set(b.toUpperCase().split(/\\s+/).filter(Boolean));
  if (tokensA.size === 0 && tokensB.size === 0) return 1;
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let intersection = 0;
  for (const t of tokensA) { if (tokensB.has(t)) intersection++; }
  return (2 * intersection) / (tokensA.size + tokensB.size);
}`,
    label: 'Add tokenJaccard helper function',
  },
  {
    search: 'export function textSimilarity(a: string, b: string): number {\n  if (!a && !b) return 1;\n  if (!a || !b) return 0;',
    replace: `export function textSimilarity(a: string, b: string): number {
  if (!a && !b) return 1;
  if (!a || !b) return 0;

  // P1-#14: For long strings (>200 chars), use fast token-based Jaccard
  // instead of O(m*n) LCS to avoid performance bottleneck in compareBomLists
  if (a.length > 200 && b.length > 200) {
    return tokenJaccard(a, b);
  }`,
    label: 'Add length guard with tokenJaccard fallback',
  },
]);

// ═══════════════════════════════════════════════════════════════════
// P1-#16: authStore.ts — DEV bypass explicit warning
// ═══════════════════════════════════════════════════════════════════
console.log('[P1-#16] authStore.ts');
patch('app/src/store/authStore.ts', [
  {
    search: "console.warn('[DEV] Backend unreachable, using offline login');",
    replace: "console.error('\\n⚠️⚠️⚠️  [DEV MODE] Backend unreachable — using OFFLINE auth bypass.\\n⚠️  This MUST NOT happen in production. Check VITE_API_URL config.\\n');",
    label: 'Make DEV bypass warning more prominent (console.error)',
  },
]);

// ═══════════════════════════════════════════════════════════════════
// P1-#24: LoginPage.tsx — remove hardcoded default credentials
// ═══════════════════════════════════════════════════════════════════
console.log('[P1-#24] LoginPage.tsx');
patch('app/src/pages/LoginPage.tsx', [
  // Try multiple patterns for hardcoded credentials
  {
    search: "useState('admin@harness.dev')",
    replace: "useState('') // P1-#24: removed hardcoded default email",
    label: 'Remove default email from useState',
  },
  {
    search: "useState('admin123')",
    replace: "useState('') // P1-#24: removed hardcoded default password",
    label: 'Remove default password from useState',
  },
  // Alternative: defaultValue attributes
  {
    search: 'defaultValue="admin@harness.dev"',
    replace: 'placeholder="请输入邮箱" // P1-#24: removed hardcoded default',
    label: 'Remove defaultValue email attribute',
  },
  {
    search: 'defaultValue="admin123"',
    replace: 'placeholder="请输入密码" // P1-#24: removed hardcoded default',
    label: 'Remove defaultValue password attribute',
  },
  // Another alternative: value prop
  {
    search: /value=[{'"]admin@harness\.dev['"]/,
    replace: 'placeholder="请输入邮箱"',
    label: 'Remove value prop email',
  },
  {
    search: /value=[{'"]admin123['"]/,
    replace: 'placeholder="请输入密码"',
    label: 'Remove value prop password',
  },
]);

// ═══════════════════════════════════════════════════════════════════
// P2-#6: bomService.ts — splice → filter for stable row IDs
// ═══════════════════════════════════════════════════════════════════
console.log('[P2-#6] bomService.ts');
patch('server/src/services/bomService.ts', [
  {
    search: '    bom.splice(index, 1);\n    await prisma.harness.update({ where: { id: harness.id }, data: { input: toJson({ ...input, bom }) } });',
    replace: '    // P2-#6: use filter instead of splice to avoid index drift for concurrent requests\n    const filteredBom = bom.filter((_: any, i: number) => i !== index);\n    await prisma.harness.update({ where: { id: harness.id }, data: { input: toJson({ ...input, bom: filteredBom }) } });',
    label: 'Replace splice with filter for stable IDs',
  },
]);

// ═══════════════════════════════════════════════════════════════════
// P2-#7: simulationService.ts — extract sensitivity factors
// ═══════════════════════════════════════════════════════════════════
console.log('[P2-#7] simulationService.ts');
patch('server/src/services/simulationService.ts', [
  {
    search: "function round2(value: number) {\n  return Math.round(value * 100) / 100;\n}",
    replace: `function round2(value: number) {
  return Math.round(value * 100) / 100;
}

// P2-#7: Extracted from buildResultSnapshot — previously hardcoded inline
const SENSITIVITY_FACTORS = {
  /** Cost sensitivity per unit copper price adjustment */
  copperPricePerUnit: 0.0035,
  /** Cost sensitivity per unit aluminum price adjustment */
  aluminumPricePerUnit: 0.0015,
  /** Cost sensitivity per unit hours adjustment */
  hoursPerUnit: 0.002,
  /** Cost sensitivity per unit volume adjustment (inverse: volume up → cost down) */
  volumePerUnit: -0.0012,
} as const;`,
    label: 'Extract SENSITIVITY_FACTORS constants',
  },
  {
    search: '    copperAdj * 0.0035 +\n    aluminumAdj * 0.0015 +\n    hoursAdj * 0.002 +\n    volumeAdj * -0.0012;',
    replace: '    copperAdj * SENSITIVITY_FACTORS.copperPricePerUnit +\n    aluminumAdj * SENSITIVITY_FACTORS.aluminumPricePerUnit +\n    hoursAdj * SENSITIVITY_FACTORS.hoursPerUnit +\n    volumeAdj * SENSITIVITY_FACTORS.volumePerUnit;',
    label: 'Use SENSITIVITY_FACTORS in buildResultSnapshot',
  },
]);

// ═══════════════════════════════════════════════════════════════════
// P2-#9 + P2-#11: bom_db.js — add close() + onblocked fallback
// ═══════════════════════════════════════════════════════════════════
console.log('[P2-#9/#11] bom_db.js');
patch('engine/bom_db.js', [
  {
    // P2-#11: onblocked should fallback to memory, not just warn
    search: "request.onblocked = () => {\n        console.warn('[G281BomDb] IndexedDB open blocked. Falling back to in-memory store.');\n      };",
    replace: "request.onblocked = () => {\n        console.warn('[G281BomDb] IndexedDB open blocked. Falling back to in-memory store.');\n        memoryOnly = true; // P2-#11: actually fallback to memory instead of just warning\n        resolve(null);\n      };",
    label: 'P2-#11: onblocked → set memoryOnly + resolve(null)',
  },
  {
    // P2-#9: add close() method to the exported API
    search: "global.G281BomDb = {",
    replace: `// P2-#9: close/cleanup method
  const close = async () => {
    if (dbInstance) {
      try { dbInstance.close(); } catch (_) {}
      dbInstance = null;
    }
    dbPromise = null;
    memoryOnly = false;
    memoryFallback = new Map();
  };

  global.G281BomDb = {
    close,`,
    label: 'P2-#9: add close() method for cleanup',
  },
]);

// ═══════════════════════════════════════════════════════════════════
// P2-#10: harness_profit.js — runtime deprecation warning
// ═══════════════════════════════════════════════════════════════════
console.log('[P2-#10] harness_profit.js');
patch('engine/harness_profit.js', [
  {
    search: "(function (global) {\n  'use strict';",
    replace: "(function (global) {\n  'use strict';\n\n  // P2-#10: Runtime deprecation warning — this module is superseded by harness_costing.ts\n  if (typeof console !== 'undefined') {\n    console.warn('[G281HarnessProfit] ⚠️ DEPRECATED: harness_profit.js is superseded by harness_costing.ts (Issue #195). Remove this script from your HTML imports.');\n  }",
    label: 'Add runtime deprecation console.warn',
  },
]);

// ═══════════════════════════════════════════════════════════════════
// P2-#12: schema_migrator.js — migration failure explicit handling
// ═══════════════════════════════════════════════════════════════════
console.log('[P2-#12] schema_migrator.js');
patch('engine/schema_migrator.js', [
  {
    search: "console.error(`[SchemaMigrator] ❌ v${migration.version}: ${migration.label}`, error);\n        // 停止后续迁移\n        break;",
    replace: "console.error(`[SchemaMigrator] ❌ v${migration.version}: ${migration.label}`, error);\n        console.error(`[SchemaMigrator] ⚠️  Migration stopped at v${lastVersion}. Data may be in a partially migrated state.`);\n        console.error(`[SchemaMigrator] ℹ️  To retry: refresh the page. To skip: call G281SchemaMigrator.forceResetVersion(${migration.version})`);\n        // 停止后续迁移\n        break;",
    label: 'Add explicit recovery instructions on migration failure',
  },
]);

// ═══════════════════════════════════════════════════════════════════
// P2-#25: AllocManagerPage.tsx — dead lifecycleYears code
// ═══════════════════════════════════════════════════════════════════
console.log('[P2-#25] AllocManagerPage.tsx');
patch('app/src/pages/AllocManagerPage.tsx', [
  {
    // Try to find and comment out dead lifecycleYears references
    search: /const lifecycleYears[^;]*;/,
    replace: '// P2-#25: removed dead code — lifecycleYears was unused',
    label: 'Remove dead lifecycleYears variable',
  },
]);

// ═══════════════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════════════
console.log(`\n${'═'.repeat(60)}`);
console.log(`✅ Fixed: ${totalFixed}`);
console.log(`⚠️  Skipped (pattern not found): ${totalSkipped}`);
console.log(`❌ File not found: ${totalNotFound}`);
console.log(`${'═'.repeat(60)}`);
console.log('\nNext steps:');
console.log('  1. Review changes: git diff');
console.log('  2. Build & test:   npm run build && npm run dev');
console.log('  3. Commit:         git add -A && git commit -m "fix: apply audit patch script"');
console.log('  4. Push:           git push');
console.log();
