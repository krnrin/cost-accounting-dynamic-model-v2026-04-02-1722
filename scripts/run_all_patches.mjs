#!/usr/bin/env node
/**
 * run_all_patches.mjs
 * ====================
 * 一键执行所有本地补丁脚本。
 *
 * 执行顺序：
 *   1. fix_bom_workbook_death_loop.mjs  — P0-1: useLiveQuery 死循环修复
 *   2. integrate_page_components.mjs     — 三个大文件页面组件嵌入
 *
 * 用法：
 *   cd <project-root>
 *   node scripts/run_all_patches.mjs
 *
 * 回退：
 *   每个脚本都会在修改前创建 .bak 备份。
 *   恢复方法：mv <file>.bak <file>
 */

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Validate we're in the right directory
const pkgPath = join(ROOT, 'app', 'src');
if (!existsSync(pkgPath)) {
  console.error('\u274c \u627e\u4e0d\u5230 app/src \u76ee\u5f55\u3002\u8bf7\u5728\u9879\u76ee\u6839\u76ee\u5f55\u8fd0\u884c\u6b64\u811a\u672c\u3002');
  process.exit(1);
}

const scripts = [
  {
    name: 'P0-1: BomWorkbookPage useLiveQuery \u6b7b\u5faa\u73af\u4fee\u590d',
    file: 'fix_bom_workbook_death_loop.mjs',
  },
  {
    name: '\u9875\u9762\u7ec4\u4ef6\u5d4c\u5165\uff08QuotePage + BomWorkbook + ChangeEngine\uff09',
    file: 'integrate_page_components.mjs',
  },
];

console.log('\u2550'.repeat(60));
console.log('\ud83d\ude80 G281 \u6210\u672c\u6838\u7b97\u52a8\u6001\u6a21\u578b \u2014 \u4e00\u952e\u672c\u5730\u8865\u4e01');
console.log('\u2550'.repeat(60));
console.log();

let passed = 0;
let failed = 0;

for (const script of scripts) {
  const scriptPath = join(__dirname, script.file);
  if (!existsSync(scriptPath)) {
    console.error(`\u274c \u811a\u672c\u4e0d\u5b58\u5728: scripts/${script.file}`);
    failed++;
    continue;
  }

  console.log(`\n${'\u2500'.repeat(50)}`);
  console.log(`\u25b6\ufe0f  ${script.name}`);
  console.log(`   scripts/${script.file}`);
  console.log('\u2500'.repeat(50));

  try {
    execSync(`node "${scriptPath}"`, {
      cwd: ROOT,
      stdio: 'inherit',
      env: { ...process.env, FORCE_COLOR: '1' },
    });
    passed++;
  } catch (err) {
    console.error(`\u274c ${script.name} \u6267\u884c\u5931\u8d25 (exit code: ${err.status})`);
    failed++;
  }
}

console.log();
console.log('\u2550'.repeat(60));
if (failed === 0) {
  console.log(`\u2705 \u5168\u90e8\u5b8c\u6210\uff01${passed} \u4e2a\u8865\u4e01\u5df2\u6210\u529f\u5e94\u7528\u3002`);
  console.log();
  console.log('\u4e0b\u4e00\u6b65\uff1a');
  console.log('  1. npm run dev');
  console.log('  2. \u6253\u5f00 E281 \u9879\u76ee\u9a8c\u8bc1 BOM Workbook \u9875\u9762\u4e0d\u518d\u5361\u6b7b');
  console.log('  3. \u68c0\u67e5 QuotePage \u7684 Gap \u5206\u6790\u5165\u53e3');
  console.log('  4. \u68c0\u67e5 ChangeEnginePage \u7684\u7ea7\u8054\u5f71\u54cd\u9762\u677f');
  console.log('  5. git add -A && git commit -m "chore: apply local patches"');
  console.log('  6. git push');
} else {
  console.log(`\u26a0\ufe0f  \u5b8c\u6210\uff0c\u4f46\u6709 ${failed} \u4e2a\u8865\u4e01\u5931\u8d25\u3002\u8bf7\u68c0\u67e5\u4e0a\u65b9\u9519\u8bef\u4fe1\u606f\u3002`);
}
console.log('\u2550'.repeat(60));
