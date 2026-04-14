#!/usr/bin/env node
/**
 * Audit #2 Patch Script
 *
 * Fixes issues found in the second full code audit.
 * Run from project root:
 *   node scripts/audit2_patches.mjs
 *
 * Issues addressed:
 *   A2-1  / A2-15 : db.ts — add projectId + scenarioId indexes to settingsSnapshots (v11)
 *   A2-3          : pricingStore.ts — extend partialize for offline persistence
 *   A2-7          : authStore.ts — add async token validation on restoreToken
 *   A2-13         : GapAnalysisPage.tsx — fix metal price field names
 *   A2-14         : ProjectScenariosPage.tsx — remove duplicate Typography destructuring
 *
 * Already pushed directly (not in this script):
 *   A2-2  / A2-5  : useSnapshotIntegration.ts — property/method name fixes
 *   A2-9          : store/index.ts — add internalMetalStore barrel export
 *   A2-10         : hooks/index.ts — add useStableLiveQuery barrel export
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

let patchCount = 0;
let skipCount = 0;

function patch(relPath, patches) {
  const fullPath = resolve(relPath);
  if (!existsSync(fullPath)) {
    console.warn(`  ❌ FILE NOT FOUND: ${relPath}`);
    skipCount += patches.length;
    return;
  }
  let content = readFileSync(fullPath, 'utf-8');
  for (const [search, replace, label] of patches) {
    if (content.includes(search)) {
      content = content.replace(search, replace);
      console.log(`  ✅ ${label}`);
      patchCount++;
    } else {
      console.warn(`  ⚠️  SKIP (pattern not found): ${label}`);
      skipCount++;
    }
  }
  writeFileSync(fullPath, content, 'utf-8');
}

console.log('\n🔧 Audit #2 Patch Script\n');

// ═══════════════════════════════════════════════════
// A2-1 / A2-15: db.ts — v11 migration
// settingsSnapshots 需要 projectId + scenarioId 索引
// ═══════════════════════════════════════════════════
console.log('[A2-1/A2-15] app/src/data/db.ts — settingsSnapshots indexes');
patch('app/src/data/db.ts', [
  [
    `  }\n}\n\nexport const db = new CostWorkbenchDB();`,
    `    // [FIX A2-1/A2-15] v11: Add projectId + scenarioId indexes to settingsSnapshots\n    // settingsSnapshotStore.loadSnapshots() queries by projectId\n    // snapshot_integration.getScenarioSnapshotHistory() queries by scenarioId\n    // Without these indexes Dexie .where() throws or returns empty\n    this.version(11).stores({\n      settingsSnapshots: 'id, timestamp, reason, projectId, scenarioId',\n    });\n  }\n}\n\nexport const db = new CostWorkbenchDB();`,
    'Add v11 migration with projectId + scenarioId indexes',
  ],
]);

// ═══════════════════════════════════════════════════
// A2-13: GapAnalysisPage.tsx — fix metal price field names
// computeHarnessCost 期望 copper/aluminum，不是 copperPrice/aluminumPrice
// ═══════════════════════════════════════════════════
console.log('[A2-13] app/src/pages/GapAnalysisPage.tsx — metal price field names');
patch('app/src/pages/GapAnalysisPage.tsx', [
  [
    'copperPrice: activePrice.copper',
    'copper: activePrice.copper',
    'Fix copper field name (copperPrice → copper)',
  ],
  [
    'aluminumPrice: activePrice.aluminum',
    'aluminum: activePrice.aluminum',
    'Fix aluminum field name (aluminumPrice → aluminum)',
  ],
]);

// ═══════════════════════════════════════════════════
// A2-14: ProjectScenariosPage.tsx — remove duplicate Typography
// ═══════════════════════════════════════════════════
console.log('[A2-14] app/src/pages/ProjectScenariosPage.tsx — duplicate Typography');
patch('app/src/pages/ProjectScenariosPage.tsx', [
  [
    `/**\n * 项目场景列表页 — 展示一个项目下的所有场景\n */\n\nconst { Title, Text } = Typography;\n\nexport default function ProjectScenariosPage`,
    `/**\n * 项目场景列表页 — 展示一个项目下的所有场景\n */\n// [FIX A2-14] Removed duplicate Typography destructuring (already at top of file)\n\nexport default function ProjectScenariosPage`,
    'Remove duplicate const { Title, Text } = Typography',
  ],
]);

// ═══════════════════════════════════════════════════
// A2-7: authStore.ts — add token validation on restoreToken
// Stale isAuthenticated:true + expired token → user sees 401 cascade
// ═══════════════════════════════════════════════════
console.log('[A2-7] app/src/store/authStore.ts — token validation');
patch('app/src/store/authStore.ts', [
  [
    `restoreToken: () => {\n          const { token } = get();\n          if (token) {\n            syncService.setToken(token);\n          }\n        },`,
    `restoreToken: () => {\n          const { token } = get();\n          if (token) {\n            syncService.setToken(token);\n            // [FIX A2-7] Validate token asynchronously on startup\n            // Stale isAuthenticated:true + expired JWT → user sees main UI\n            // with all API calls 401-ing before redirect. This check catches\n            // that case early and forces logout.\n            if (token !== 'dev-offline-token') {\n              fetch(\`\${API_BASE}/auth/me\`, {\n                headers: { Authorization: \`Bearer \${token}\` },\n              })\n                .then((res) => {\n                  if (!res.ok) {\n                    console.warn('[Auth] Token expired or invalid, logging out');\n                    get().logout();\n                  }\n                })\n                .catch(() => {\n                  // Network error — keep current offline state\n                });\n            }\n          }\n        },`,
    'Add async token validation in restoreToken',
  ],
]);

// ═══════════════════════════════════════════════════
// A2-3: pricingStore.ts — extend partialize for offline
// connectorPricing / wirePricing / devPartPricing / auxiliaryPricing
// are lost on refresh in offline mode
// ═══════════════════════════════════════════════════
console.log('[A2-3] app/src/store/pricingStore.ts — extend partialize');
patch('app/src/store/pricingStore.ts', [
  [
    `partialize: (state) => ({\n          benchmark: state.benchmark,\n          activeVersionId: state.activeVersionId,\n          metalPrices: state.metalPrices,\n          simulation: state.simulation,\n          currentProjectId: state.currentProjectId,\n          currentScenarioId: state.currentScenarioId,\n        }),`,
    `partialize: (state) => ({\n          benchmark: state.benchmark,\n          activeVersionId: state.activeVersionId,\n          metalPrices: state.metalPrices,\n          simulation: state.simulation,\n          currentProjectId: state.currentProjectId,\n          currentScenarioId: state.currentScenarioId,\n          // [FIX A2-3] Persist pricing data for offline mode\n          connectorPricing: state.connectorPricing,\n          wirePricing: state.wirePricing,\n          devPartPricing: state.devPartPricing,\n          auxiliaryPricing: state.auxiliaryPricing,\n        }),`,
    'Extend partialize with pricing Records for offline persistence',
  ],
]);

console.log(`\n✅ Done — ${patchCount} patches applied, ${skipCount} skipped.`);
console.log('\nNext steps:');
console.log('  1. npm run dev — verify no TypeScript errors');
console.log('  2. Test login flow (stale token → auto-logout)');
console.log('  3. Test GapAnalysis page (metal price diff should be non-zero)');
console.log('  4. git add -A && git commit -m "fix: audit2 patches (A2-1,3,7,13,14)" && git push');
console.log('');
