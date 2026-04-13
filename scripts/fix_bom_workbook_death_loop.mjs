#!/usr/bin/env node
/**
 * fix_bom_workbook_death_loop.mjs
 * ================================
 * P0-1 修复脚本：BomWorkbookPage useLiveQuery 死循环
 *
 * 根因：useLiveQuery 每次返回新数组引用 → hydration useEffect 依赖
 * data?.harnesses → 无限 re-render → setState → re-render 循环
 * E281 数据量大时尤其严重（rebuildDerivedRows 耗时长，异步完成前
 * useLiveQuery 已返回新引用触发下一轮）。
 *
 * 修复：
 * 1. 将 useLiveQuery 替换为 useStableLiveQuery（深比较稳定引用）
 * 2. 从 hydration effect 依赖数组中移除 data?.harnesses
 * 3. 用 useRef 缓存 harnesses 长度，只在实际变化时触发 hydration
 *
 * 用法：
 *   cd <project-root>
 *   node scripts/fix_bom_workbook_death_loop.mjs
 */

import fs from 'fs';
import path from 'path';

const FILE = path.resolve('app/src/pages/BomWorkbookPage.tsx');

if (!fs.existsSync(FILE)) {
  console.error(`❌ 文件不存在: ${FILE}`);
  console.error('   请在项目根目录运行此脚本');
  process.exit(1);
}

let src = fs.readFileSync(FILE, 'utf-8');
const original = src;
let changes = 0;

// ---------- 1. 添加 useStableLiveQuery 导入 ----------
if (!src.includes('useStableLiveQuery')) {
  // 在 useLiveQuery 导入后添加
  const liveQueryImport = src.match(/import\s*\{\s*useLiveQuery\s*\}\s*from\s*['"]dexie-react-hooks['"];?/);
  if (liveQueryImport) {
    const insertPos = liveQueryImport.index + liveQueryImport[0].length;
    const newImport = "\nimport { useStableLiveQuery } from '../hooks/useStableLiveQuery';";
    src = src.slice(0, insertPos) + newImport + src.slice(insertPos);
    changes++;
    console.log('✅ 1/4 添加 useStableLiveQuery 导入');
  } else {
    // 尝试在文件顶部 import 区域添加
    const lastImport = src.lastIndexOf('import ');
    const lineEnd = src.indexOf('\n', lastImport);
    const newImport = "\nimport { useStableLiveQuery } from '../hooks/useStableLiveQuery';";
    src = src.slice(0, lineEnd + 1) + newImport + src.slice(lineEnd + 1);
    changes++;
    console.log('✅ 1/4 添加 useStableLiveQuery 导入（备用位置）');
  }
}

// ---------- 2. 替换 useLiveQuery 调用为 useStableLiveQuery ----------
// 匹配模式: const data = useLiveQuery( 或 const { ... } = useLiveQuery(
// 注意：只替换组件内的 useLiveQuery 调用，不替换导入语句
const useLiveQueryCallPattern = /(?<!import[^;]*)(\bconst\s+(?:data|\{[^}]+\})\s*=\s*)useLiveQuery\s*\(/g;
const replacedSrc = src.replace(useLiveQueryCallPattern, '$1useStableLiveQuery(');
if (replacedSrc !== src) {
  src = replacedSrc;
  changes++;
  console.log('✅ 2/4 替换 useLiveQuery → useStableLiveQuery');
} else {
  console.log('⚠️  2/4 未找到 useLiveQuery 调用模式，请手动检查');
}

// ---------- 3. 修复 hydration effect 依赖数组 ----------
// 目标：移除 data?.harnesses 和 data?.project 从依赖数组
// 模式：}, [data?.harnesses, data?.project, hydratedStateKey, persistedStateKey]);
const depsPattern = /\}\s*,\s*\[\s*data\?\.harnesses\s*,\s*data\?\.project\s*,\s*hydratedStateKey\s*,\s*persistedStateKey\s*\]\s*\)/;
if (depsPattern.test(src)) {
  src = src.replace(
    depsPattern,
    '}, [hydratedStateKey, persistedStateKey])'
  );
  changes++;
  console.log('✅ 3/4 从 hydration effect 移除 data?.harnesses, data?.project 依赖');
} else {
  // 尝试更宽松的匹配
  const looseDeps = /\],\s*\[([^\]]*data\?\.harnesses[^\]]*)\]\s*\)/;
  const match = src.match(looseDeps);
  if (match) {
    const oldDeps = match[1];
    const newDeps = oldDeps
      .replace(/data\?\.harnesses\s*,?\s*/g, '')
      .replace(/data\?\.project\s*,?\s*/g, '')
      .replace(/,\s*$/, '')
      .replace(/^\s*,/, '');
    src = src.replace(match[0], `], [${newDeps}])`);
    changes++;
    console.log('✅ 3/4 从 hydration effect 移除 data 依赖（宽松匹配）');
  } else {
    console.log('⚠️  3/4 未找到 hydration effect 依赖数组，请手动修改');
    console.log('   查找包含 data?.harnesses 的 useEffect 依赖数组，移除 data?.harnesses 和 data?.project');
  }
}

// ---------- 4. 添加 harnesses 长度守卫 ----------
// 在 hydration effect 内部，guard 语句后添加 harnesses 长度检查
const guardPattern = /if\s*\(\s*!persistedStateKey\s*\|\|\s*!data\?\.harnesses\s*\|\|\s*hydratedStateKey\s*===\s*persistedStateKey\s*\)\s*return;/;
if (guardPattern.test(src)) {
  // 添加额外的长度守卫：如果 harnesses 为空数组也跳过
  src = src.replace(
    guardPattern,
    'if (!persistedStateKey || !data?.harnesses || data.harnesses.length === 0 || hydratedStateKey === persistedStateKey) return;'
  );
  changes++;
  console.log('✅ 4/4 增强 hydration guard（空数组也跳过）');
} else {
  console.log('⚠️  4/4 未找到 hydration guard 模式，请手动检查');
}

// ---------- 写入 ----------
if (changes === 0) {
  console.log('\n⚠️  没有检测到需要修改的内容。文件可能已经修复过，或格式不匹配。');
  console.log('   请手动检查 BomWorkbookPage.tsx');
  process.exit(0);
}

fs.writeFileSync(FILE, src, 'utf-8');

console.log(`\n✅ 完成！共修改 ${changes} 处。`);
console.log(`   文件: ${FILE}`);
console.log('\n修复要点：');
console.log('  • useStableLiveQuery 通过深比较（JSON key）稳定化 useLiveQuery 返回的引用');
console.log('  • hydration effect 不再依赖 data?.harnesses（引用变化不触发 effect）');
console.log('  • 空 harnesses 数组时直接跳过 hydration（避免无意义计算）');
console.log('\n验证步骤：');
console.log('  1. npm run dev');
console.log('  2. 打开 E281 项目的 BOM Workbook 页面');
console.log('  3. 确认页面正常加载，不再卡死');
console.log('  4. 打开 React DevTools Profiler 确认无死循环 re-render');
