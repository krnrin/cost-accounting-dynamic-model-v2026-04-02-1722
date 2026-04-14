#!/usr/bin/env node
/**
 * scripts/audit2_final_fixes.mjs
 * Applies remaining Audit #2 fixes that the previous patch script missed.
 * Targets: A2-1/A2-15 (db.ts), A2-7 (authStore.ts), A2-3 (pricingStore.ts)
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
let applied = 0;
let skipped = 0;

function readFile(rel) {
  const abs = join(ROOT, rel);
  if (!existsSync(abs)) return null;
  return { abs, content: readFileSync(abs, 'utf8') };
}

function writeFile(abs, content) {
  writeFileSync(abs, content, 'utf8');
}

console.log('\n\u{1F527} Audit #2 Final Fixes\n');

// ═══════════════════════════════════════════════════════
// A2-1/A2-15: db.ts — v11 migration for settingsSnapshots indexes
// ═══════════════════════════════════════════════════════
console.log('[A2-1/A2-15] app/src/data/db.ts \u2014 settingsSnapshots indexes');
{
  const file = readFile('app/src/data/db.ts');
  if (!file) {
    console.log('  \u26A0\uFE0F  SKIP (file not found)');
    skipped++;
  } else if (file.content.includes('version(11)')) {
    console.log('  \u23ED\uFE0F  Already applied');
  } else {
    let c = file.content;
    let changed = false;

    // 1) Add projectId/scenarioId to SettingsSnapshotRecord interface
    const dataField = '  data: Record<string, unknown>;\n}';
    if (c.includes(dataField) && !c.includes('projectId?: string;\n  scenarioId?: string;')) {
      c = c.replace(
        dataField,
        '  data: Record<string, unknown>;\n' +
        '  /** [A2-1] Project scope */\n' +
        '  projectId?: string;\n' +
        '  /** [A2-15] Scenario scope */\n' +
        '  scenarioId?: string;\n' +
        '}'
      );
      changed = true;
      console.log('  \u2705 Added projectId + scenarioId to SettingsSnapshotRecord');
    }

    // 2) Add v11 migration — find end of constructor + class
    const v10End = '    });\n  }\n}\n\nexport const db';
    if (c.includes(v10End)) {
      c = c.replace(
        v10End,
        '    });\n' +
        '    // [FIX A2-1/A2-15] v11: settingsSnapshots add projectId + scenarioId indexes\n' +
        '    this.version(11).stores({\n' +
        "      settingsSnapshots: 'id, timestamp, reason, projectId, scenarioId',\n" +
        '    });\n' +
        '  }\n}\n\nexport const db'
      );
      changed = true;
      console.log('  \u2705 Added v11 migration');
    } else {
      console.log('  \u26A0\uFE0F  Could not find v10 end pattern for v11 insertion');
    }

    if (changed) { writeFile(file.abs, c); applied++; }
    else { skipped++; }
  }
}

// ═══════════════════════════════════════════════════════
// A2-7: authStore.ts — async token validation in restoreToken
// ═══════════════════════════════════════════════════════
console.log('\n[A2-7] app/src/store/authStore.ts \u2014 async token validation');
{
  const file = readFile('app/src/store/authStore.ts');
  if (!file) {
    console.log('  \u26A0\uFE0F  SKIP (file not found)');
    skipped++;
  } else if (file.content.includes('Stale token detected')) {
    console.log('  \u23ED\uFE0F  Already applied');
  } else {
    // Match the simple restoreToken implementation
    const find =
      '        restoreToken: () => {\n' +
      '          const { token } = get();\n' +
      '          if (token) {\n' +
      '            syncService.setToken(token);\n' +
      '          }\n' +
      '        },';

    if (file.content.includes(find)) {
      const replace =
        '        restoreToken: () => {\n' +
        '          const { token } = get();\n' +
        '          if (token) {\n' +
        '            syncService.setToken(token);\n' +
        '            // [FIX A2-7] Async token validation \u2014 stale token \u2192 auto-logout\n' +
        "            if (token !== 'dev-offline-token') {\n" +
        '              void (async () => {\n' +
        '                try {\n' +
        '                  const controller = new AbortController();\n' +
        '                  const timer = setTimeout(() => controller.abort(), 3000);\n' +
        '                  const res = await fetch(`${API_BASE}/auth/me`, {\n' +
        '                    headers: { Authorization: `Bearer ${token}` },\n' +
        '                    signal: controller.signal,\n' +
        '                  });\n' +
        '                  clearTimeout(timer);\n' +
        '                  if (!res.ok) {\n' +
        "                    console.warn('[auth] Stale token detected, logging out');\n" +
        '                    get().logout();\n' +
        '                  }\n' +
        '                } catch {\n' +
        '                  // Network error \u2014 keep token, user might be offline\n' +
        '                }\n' +
        '              })();\n' +
        '            }\n' +
        '          }\n' +
        '        },';

      writeFile(file.abs, file.content.replace(find, replace));
      console.log('  \u2705 Added async token validation in restoreToken');
      applied++;
    } else {
      console.log('  \u26A0\uFE0F  SKIP (pattern not found \u2014 restoreToken may have been modified during merge)');
      console.log('  Manual fix: In restoreToken(), after syncService.setToken(token), add async /auth/me validation');
      skipped++;
    }
  }
}

// ═══════════════════════════════════════════════════════
// A2-3: pricingStore.ts — extend partialize for offline persistence
// ═══════════════════════════════════════════════════════
console.log('\n[A2-3] app/src/store/pricingStore.ts \u2014 extend partialize');
{
  const file = readFile('app/src/store/pricingStore.ts');
  if (!file) {
    console.log('  \u26A0\uFE0F  SKIP (file not found)');
    skipped++;
  } else if (file.content.includes('connectorPricing: state.connectorPricing')) {
    console.log('  \u23ED\uFE0F  Already applied');
  } else {
    const find = '          currentScenarioId: state.currentScenarioId,\n        }),';
    if (file.content.includes(find)) {
      const replace =
        '          currentScenarioId: state.currentScenarioId,\n' +
        '          // [FIX A2-3] Persist pricing Records for offline support\n' +
        '          connectorPricing: state.connectorPricing,\n' +
        '          wirePricing: state.wirePricing,\n' +
        '          devPartPricing: state.devPartPricing,\n' +
        '          auxiliaryPricing: state.auxiliaryPricing,\n' +
        '        }),';
      writeFile(file.abs, file.content.replace(find, replace));
      console.log('  \u2705 Extended partialize with pricing Records');
      applied++;
    } else {
      console.log('  \u26A0\uFE0F  SKIP (pattern not found)');
      skipped++;
    }
  }
}

// ═══════════════════════════════════════════════════════
// Safety check: BomWorkbookPage useLiveQuery → useStableLiveQuery
// ═══════════════════════════════════════════════════════
console.log('\n[Check] BomWorkbookPage.tsx \u2014 useLiveQuery vs useStableLiveQuery');
{
  const file = readFile('app/src/pages/BomWorkbookPage.tsx');
  if (!file) {
    console.log('  \u26A0\uFE0F  File not found');
  } else {
    const usesOldHook = file.content.includes('const data = useLiveQuery(') &&
                        !file.content.includes('useStableLiveQuery');
    if (usesOldHook) {
      console.log('  \u26A0\uFE0F  WARNING: Still using useLiveQuery \u2014 may cause death loop!');
      console.log('  Attempting auto-fix...');
      let c = file.content;
      // Replace import
      if (c.includes("import { useLiveQuery } from 'dexie-react-hooks';")) {
        c = c.replace(
          "import { useLiveQuery } from 'dexie-react-hooks';",
          "// useLiveQuery replaced by useStableLiveQuery to prevent death loop\nimport { useStableLiveQuery } from '../hooks/useStableLiveQuery';"
        );
      }
      // Replace usage
      c = c.replace('const data = useLiveQuery(', 'const data = useStableLiveQuery(');
      // Fix hydration effect deps (remove data?.harnesses, data?.project)
      c = c.replace(
        '[data?.harnesses, data?.project, hydratedStateKey, persistedStateKey]',
        '[hydratedStateKey, persistedStateKey]'
      );
      // Add length guard
      if (c.includes('if (!persistedStateKey || !data?.harnesses || hydratedStateKey === persistedStateKey)')) {
        c = c.replace(
          'if (!persistedStateKey || !data?.harnesses || hydratedStateKey === persistedStateKey)',
          'if (!persistedStateKey || !data?.harnesses || data.harnesses.length === 0 || hydratedStateKey === persistedStateKey)'
        );
      }
      writeFile(file.abs, c);
      console.log('  \u2705 Replaced useLiveQuery with useStableLiveQuery + fixed deps');
      applied++;
    } else if (file.content.includes('useStableLiveQuery')) {
      console.log('  \u2705 OK (already using useStableLiveQuery)');
    } else {
      console.log('  \u2705 OK (no useLiveQuery pattern found)');
    }
  }
}

console.log('\n' + '\u2550'.repeat(60));
console.log(`\u2705 Done \u2014 ${applied} patches applied, ${skipped} skipped.`);
console.log('\u2550'.repeat(60));
console.log('\nNext steps:');
console.log('1. cd app && npm install && npm run dev');
console.log('2. Verify login flow (stale token \u2192 auto-logout)');
console.log('3. Verify pricing data persists after page refresh');
console.log('4. git add -A && git commit -m "fix: A2 final patches" && git push');
console.log('');
