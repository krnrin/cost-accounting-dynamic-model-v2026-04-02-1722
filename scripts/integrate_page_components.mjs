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
    console.error(`❌ 文件不存在: ${relPath}`);
    failCount++;
    return;
  }

  let content = readFileSync(fullPath, 'utf-8');

  // Backup
  const backupPath = fullPath + '.bak';
  copyFileSync(fullPath, backupPath);

  let patchesApplied = 0;

  for (const { anchor, insert, position = 'after', description } of patches) {
    const idx = content.indexOf(anchor);
    if (idx === -1) {
      console.warn(`  ⚠️  跳过: 未找到锚点 — ${description || anchor.substring(0, 50)}`);
      continue;
    }

    // Check for duplicate (already patched)
    if (content.includes(insert.trim())) {
      console.warn(`  ⏭️  已存在: ${description || '(patch)'}`);
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
    console.log(`✅ ${relPath} — ${patchesApplied} 处修改已应用 (备份: .bak)`);
    successCount++;
  } else {
    console.log(`⏭️  ${relPath} — 无需修改（已是最新或锚点缺失）`);
  }
}

// ═══════════════════════════════════════════════
// 1. QuotePage.tsx — 嵌入 QuoteGapEntry
// ═══════════════════════════════════════════════
console.log('\n📄 正在处理 QuotePage.tsx ...');
patchFile('pages/QuotePage.tsx', [
  {
    description: '添加 QuoteGapEntry import',
    anchor: "import ScenarioSelector from '@/components/ScenarioSelector';",
    insert: "\nimport QuoteGapEntry from '@/components/QuoteGapEntry';",
    position: 'after',
  },
  {
    description: '在 Tabs 后嵌入 QuoteGapEntry 组件',
    anchor: '      </Tabs>',
    insert: "\n\n      {/* Gap 分析入口 */}\n      {id && sid && <QuoteGapEntry projectId={id} scenarioId={sid} />}",
    position: 'after',
  },
]);

// ═══════════════════════════════════════════════
// 2. BomWorkbookPage.tsx — 嵌入 SmartPasteIntegration
// ═══════════════════════════════════════════════
console.log('\n📄 正在处理 BomWorkbookPage.tsx ...');
patchFile('pages/BomWorkbookPage.tsx', [
  {
    description: '添加 SmartPasteIntegration import',
    anchor: "import { useSmartPaste, BOM_TARGET_COLUMNS } from '@/hooks/useSmartPaste';",
    insert: "\nimport SmartPasteIntegration from '@/components/SmartPasteIntegration';",
    position: 'after',
  },
  {
    description: '在工具栏添加智能粘贴按钮（导入BOM旁边）',
    anchor: "导入 BOM\n            </Button>\n          </Dropdown>\n          </RoleGuard>",
    insert: `

          {/* 智能粘贴集成 */}
          <RoleGuard field="bomEdit">
            <SmartPasteIntegration
              onApply={(rows, _mappings) => {
                // 智能粘贴回调：将解析结果输出到控制台
                // 后续可扩展为直接写入 modifiedInputs
                console.log('[SmartPaste] 解析结果:', rows.length, '行');
                Toast.success(\`智能粘贴已解析 \${rows.length} 行数据，请检查控制台输出\`);
              }}
            />
          </RoleGuard>`,
    position: 'after',
  },
]);

// ═══════════════════════════════════════════════
// 3. ChangeEnginePage.tsx — 嵌入 CascadeImpactIntegration
// ═══════════════════════════════════════════════
console.log('\n📄 正在处理 ChangeEnginePage.tsx ...');
patchFile('pages/ChangeEnginePage.tsx', [
  {
    description: '添加 CascadeImpactIntegration import',
    anchor: "import { useCascadeImpact } from '@/hooks/useCascadeImpact';",
    insert: "\nimport CascadeImpactIntegration from '@/components/CascadeImpactIntegration';",
    position: 'after',
  },
  {
    description: '在级联影响预览模态框前嵌入集成面板',
    anchor: '{/* ──── 级联影响预览模态框 ──── */}',
    insert: `{/* ──── 级联影响集成面板 (CascadeImpactIntegration) ──── */}
        {bomDiffRows.length > 0 && (
          <Col span={24}>
            <CascadeImpactIntegration
              bomChanges={bomDiffRows}
              semanticChanges={[]}
              sheetData={{}}
              autoCompute={false}
            />
          </Col>
        )}

        `,
    position: 'before',
  },
]);

// ═══════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════
console.log('\n' + '═'.repeat(50));
if (failCount === 0) {
  console.log(`🎉 全部完成！${successCount} 个文件已修改。`);
  console.log('运行 npm run dev 验证效果。');
  console.log('如需回退: 将 .bak 文件重命名回原文件名即可。');
} else {
  console.log(`⚠️  完成，但有 ${failCount} 个文件处理失败。`);
}
