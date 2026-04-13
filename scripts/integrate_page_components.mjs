#!/usr/bin/env node
/**
 * integrate_page_components.mjs
 *
 * 将独立集成组件嵌入到三个大型页面文件中。
 * 每个文件修改前自动创建 .bak 备份。
 *
 * 使用方法:
 *   node scripts/integrate_page_components.mjs
 *
 * 回退方法:
 *   mv app/src/pages/QuotePage.tsx.bak app/src/pages/QuotePage.tsx
 *   mv app/src/pages/BomWorkbookPage.tsx.bak app/src/pages/BomWorkbookPage.tsx
 *   mv app/src/pages/ChangeEnginePage.tsx.bak app/src/pages/ChangeEnginePage.tsx
 *
 * 修改清单:
 *   1. QuotePage.tsx        → + QuoteGapEntry（报价 vs 实绩 Gap 入口）
 *   2. BomWorkbookPage.tsx  → + SmartPasteIntegration（智能粘贴按钮）
 *                             + BomDiffIntegration（BOM差异对比面板）
 *   3. ChangeEnginePage.tsx → + CascadeImpactIntegration（级联影响面板）
 */
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, '..', 'app', 'src');

let successCount = 0;
let failCount = 0;

/**
 * Apply a series of string-level patches to a source file.
 * Each patch: { anchor: string, insert: string, position?: 'after'|'before' }
 */
function patchFile(relPath, patches) {
  const fullPath = join(SRC, relPath);
  if (!existsSync(fullPath)) {
    console.error(`\u274c \u6587\u4ef6\u4e0d\u5b58\u5728: ${relPath}`);
    failCount++;
    return;
  }

  let content = readFileSync(fullPath, 'utf-8');

  // Backup
  const backupPath = fullPath + '.bak';
  if (!existsSync(backupPath)) {
    copyFileSync(fullPath, backupPath);
  }

  let patchesApplied = 0;

  for (const { anchor, insert, position = 'after', description } of patches) {
    const idx = content.indexOf(anchor);
    if (idx === -1) {
      console.warn(`  \u26a0\ufe0f  \u8df3\u8fc7: \u672a\u627e\u5230\u951a\u70b9 \u2014 ${description || anchor.substring(0, 50)}`);
      continue;
    }

    // Check for duplicate (already patched)
    if (content.includes(insert.trim())) {
      console.warn(`  \u23ed\ufe0f  \u5df2\u5b58\u5728: ${description || '(patch)'}`);
      continue;
    }

    if (position === 'after') {
      content = content.slice(0, idx + anchor.length) + insert + content.slice(idx + anchor.length);
    } else {
      content = content.slice(0, idx) + insert + content.slice(idx);
    }
    patchesApplied++;
  }

  if (patchesApplied > 0) {
    writeFileSync(fullPath, content, 'utf-8');
    console.log(`\u2705 ${relPath} \u2014 ${patchesApplied} \u5904\u4fee\u6539\u5df2\u5e94\u7528 (\u5907\u4efd: .bak)`);
    successCount++;
  } else {
    console.log(`\u23ed\ufe0f  ${relPath} \u2014 \u65e0\u9700\u4fee\u6539\uff08\u5df2\u662f\u6700\u65b0\u6216\u951a\u70b9\u7f3a\u5931\uff09`);
  }
}

// \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
// 1. QuotePage.tsx \u2014 \u5d4c\u5165 QuoteGapEntry
// \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
console.log('\n\ud83d\udcc4 \u6b63\u5728\u5904\u7406 QuotePage.tsx ...');
patchFile('pages/QuotePage.tsx', [
  {
    description: '\u6dfb\u52a0 QuoteGapEntry import',
    anchor: "import ScenarioSelector from '@/components/ScenarioSelector';",
    insert: "\nimport QuoteGapEntry from '@/components/QuoteGapEntry';",
    position: 'after',
  },
  {
    description: '\u5728 Tabs \u540e\u5d4c\u5165 QuoteGapEntry \u7ec4\u4ef6',
    anchor: '      </Tabs>',
    insert: "\n\n      {/* Gap \u5206\u6790\u5165\u53e3 */}\n      {id && sid && <QuoteGapEntry projectId={id} scenarioId={sid} />}",
    position: 'after',
  },
]);

// \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
// 2. BomWorkbookPage.tsx \u2014 \u5d4c\u5165 SmartPasteIntegration + BomDiffIntegration
// \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
console.log('\n\ud83d\udcc4 \u6b63\u5728\u5904\u7406 BomWorkbookPage.tsx ...');
patchFile('pages/BomWorkbookPage.tsx', [
  // --- SmartPasteIntegration ---
  {
    description: '\u6dfb\u52a0 SmartPasteIntegration import',
    anchor: "import { useSmartPaste, BOM_TARGET_COLUMNS } from '@/hooks/useSmartPaste';",
    insert: "\nimport SmartPasteIntegration from '@/components/SmartPasteIntegration';\nimport BomDiffIntegration from '@/components/BomDiffIntegration';",
    position: 'after',
  },
  {
    description: '\u5728\u5de5\u5177\u680f\u6dfb\u52a0\u667a\u80fd\u7c98\u8d34\u6309\u94ae\uff08\u5bfc\u5165BOM\u65c1\u8fb9\uff09',
    anchor: '\u5bfc\u5165 BOM\n            </Button>\n          </Dropdown>\n          </RoleGuard>',
    insert: `\n\n          {/* \u667a\u80fd\u7c98\u8d34\u96c6\u6210 */}\n          <RoleGuard field="bomEdit">\n            <SmartPasteIntegration\n              onApply={(rows, _mappings) => {\n                console.log('[SmartPaste] \u89e3\u6790\u7ed3\u679c:', rows.length, '\u884c');\n                Toast.success(\`\u667a\u80fd\u7c98\u8d34\u5df2\u89e3\u6790 \${rows.length} \u884c\u6570\u636e\uff0c\u8bf7\u68c0\u67e5\u63a7\u5236\u53f0\u8f93\u51fa\`);\n              }}\n            />\n          </RoleGuard>`,
    position: 'after',
  },
  // --- BomDiffIntegration ---
  {
    description: '\u5728\u9875\u9762\u5e95\u90e8\u6dfb\u52a0 BomDiffIntegration \u9762\u677f',
    anchor: '{/* \u2500\u2500 BOM \u5de5\u4f5c\u8868\u4e3b\u4f53 \u2500\u2500 */}',
    insert: `{/* \u2500\u2500 BOM \u5dee\u5f02\u5bf9\u6bd4\u96c6\u6210 \u2500\u2500 */}\n        {data?.project && data?.harnesses && (\n          <BomDiffIntegration\n            projectId={data.project.id}\n            scenarioId={data.project.currentScenarioId || ''}\n          />\n        )}\n\n        `,
    position: 'before',
  },
]);

// \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
// 3. ChangeEnginePage.tsx \u2014 \u5d4c\u5165 CascadeImpactIntegration
// \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
console.log('\n\ud83d\udcc4 \u6b63\u5728\u5904\u7406 ChangeEnginePage.tsx ...');
patchFile('pages/ChangeEnginePage.tsx', [
  {
    description: '\u6dfb\u52a0 CascadeImpactIntegration import',
    anchor: "import { useCascadeImpact } from '@/hooks/useCascadeImpact';",
    insert: "\nimport CascadeImpactIntegration from '@/components/CascadeImpactIntegration';",
    position: 'after',
  },
  {
    description: '\u5728\u7ea7\u8054\u5f71\u54cd\u9884\u89c8\u6a21\u6001\u6846\u524d\u5d4c\u5165\u96c6\u6210\u9762\u677f',
    anchor: '{/* \u2500\u2500\u2500\u2500 \u7ea7\u8054\u5f71\u54cd\u9884\u89c8\u6a21\u6001\u6846 \u2500\u2500\u2500\u2500 */}',
    insert: `{/* \u2500\u2500\u2500\u2500 \u7ea7\u8054\u5f71\u54cd\u96c6\u6210\u9762\u677f (CascadeImpactIntegration) \u2500\u2500\u2500\u2500 */}\n        {bomDiffRows.length > 0 && (\n          <Col span={24}>\n            <CascadeImpactIntegration\n              bomChanges={bomDiffRows}\n              semanticChanges={[]}\n              sheetData={{}}\n              autoCompute={false}\n            />\n          </Col>\n        )}\n\n        `,
    position: 'before',
  },
]);

// \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
// Summary
// \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
console.log('\n' + '\u2550'.repeat(50));
if (failCount === 0) {
  console.log(`\ud83c\udf89 \u5168\u90e8\u5b8c\u6210\uff01${successCount} \u4e2a\u6587\u4ef6\u5df2\u4fee\u6539\u3002`);
  console.log('\u8fd0\u884c npm run dev \u9a8c\u8bc1\u6548\u679c\u3002');
  console.log('\u5982\u9700\u56de\u9000: \u5c06 .bak \u6587\u4ef6\u91cd\u547d\u540d\u56de\u539f\u6587\u4ef6\u540d\u5373\u53ef\u3002');
} else {
  console.log(`\u26a0\ufe0f  \u5b8c\u6210\uff0c\u4f46\u6709 ${failCount} \u4e2a\u6587\u4ef6\u5904\u7406\u5931\u8d25\u3002`);
}
