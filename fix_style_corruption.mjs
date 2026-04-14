#!/usr/bin/env node
/**
 * fix_style_corruption.mjs
 *
 * Repairs style= / scroll= double-brace corruption in TSX files
 * caused by Notion's URL compression stripping  and  during push.
 *
 * Original:  style= marginBottom: 16 >
 * Corrupted: style= marginBottom: 16 >
 *
 * Run from repo root:
 *   node fix_style_corruption.mjs
 *   git diff            # review changes
 *   cd app && npm run dev   # verify compilation
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';

// Build  and  dynamically so Notion cannot strip them
const L = String.fromCharCode(123);
const R = String.fromCharCode(125);
const OO = L + L;
const CC = R + R;

const FILES = [
  'app/src/components/BomDiffIntegration.tsx',
  'app/src/components/SmartPasteIntegration.tsx',
  'app/src/components/CascadeImpactIntegration.tsx',
  'app/src/components/GapSnapshotManager.tsx',
  'app/src/components/InternalMetalSourceSwitch.tsx',
  'app/src/components/SnapshotComparePanel.tsx',
  'app/src/components/SnapshotRestoreDialog.tsx',
  'app/src/components/StagnantReportPanel.tsx',
  'app/src/components/BomDiffPanel.tsx',
  'app/src/components/CascadeImpactPreview.tsx',
  'app/src/components/MetalImpactSummary.tsx',
  'app/src/pages/GapAnalysisPage.tsx',
];

const ATTR_NAMES = ['style', 'scroll'];

/**
 * Check if '>' at pos is a comparison operator (not JSX tag close).
 * Handles: >=, > 0, > -1
 */
function isGtComparison(src, pos) {
  if (pos + 1 < src.length && src[pos + 1] === '=') return true;
  let j = pos + 1;
  while (j < src.length && src[j] === ' ') j++;
  const c = src[j];
  if (c >= '0' && c <= '9') return true;
  if (c === '-') {
    let k = j + 1;
    while (k < src.length && src[k] === ' ') k++;
    if (src[k] >= '0' && src[k] <= '9') return true;
  }
  // Check context: if preceded by , : ? ( it's inside an expression
  let b = pos - 1;
  while (b >= 0 && src[b] === ' ') b--;
  if (src[b] === ',' || src[b] === ':' || src[b] === '?' || src[b] === '(') return true;
  return false;
}

/**
 * Check if position starts a JSX attribute: identifier= (not ==)
 */
function isJsxAttrStart(src, pos) {
  let i = pos;
  if (!/[a-zA-Z_$]/.test(src[i])) return false;
  while (i < src.length && /[a-zA-Z0-9_$]/.test(src[i])) i++;
  return src[i] === '=' && src[i + 1] !== '=';
}

function fixContent(src) {
  let out = '';
  let i = 0;
  let fixes = 0;

  while (i < src.length) {
    let matched = false;

    for (const attr of ATTR_NAMES) {
      const pat = attr + '=';
      if (!src.startsWith(pat, i)) continue;
      if (i > 0 && !/[\s\n\r]/.test(src[i - 1])) continue;

      const afterEq = i + pat.length;
      const nc = src[afterEq];
      if (nc === L || nc === '"' || nc === '`' || nc === '(') continue;

      // --- Corrupted attribute found ---
      out += pat + OO;
      i = afterEq;

      let strCh = null;
      let pD = 0, bkD = 0, brD = 0;
      let buf = '';
      let done = false;

      while (i < src.length && !done) {
        const c = src[i];
        const prev = i > 0 ? src[i - 1] : '';

        // String tracking
        if (!strCh) {
          if ((c === "'" || c === '"' || c === '`') && prev !== '\\') {
            strCh = c; buf += c; i++; continue;
          }
        } else {
          if (c === strCh && prev !== '\\') strCh = null;
          buf += c; i++; continue;
        }

        // Depth tracking
        if (c === '(') pD++;
        if (c === ')') pD--;
        if (c === '[') bkD++;
        if (c === ']') bkD--;
        if (c === L) brD++;
        if (c === R) brD--;

        const atZero = pD === 0 && bkD === 0 && brD === 0;

        // End marker 1: JSX tag close >
        if (atZero && c === '>' && !isGtComparison(src, i)) {
          let trimmed = buf.trimEnd();
          let selfClose = '';
          if (trimmed.endsWith('/')) {
            selfClose = '/';
            trimmed = trimmed.slice(0, -1).trimEnd();
          }
          out += trimmed + CC + selfClose + '>';
          i++;
          fixes++;
          done = true;
        }

        // End marker 2: next JSX attribute boundary
        if (!done && atZero && /[\s\n\r\t]/.test(c)) {
          let la = i;
          while (la < src.length && /[\s\n\r\t]/.test(src[la])) la++;
          if (isJsxAttrStart(src, la)) {
            out += buf.trimEnd() + CC;
            out += src.substring(i, la);
            i = la;
            fixes++;
            done = true;
          }
        }

        if (!done) {
          buf += c;
          i++;
        }
      }

      if (!done) {
        out += buf;
        console.warn(`  WARN: no end found for corrupted ${attr}= at ~char ${i} - needs manual fix`);
      }

      matched = true;
      break;
    }

    if (!matched) {
      out += src[i];
      i++;
    }
  }

  return { content: out, fixes };
}

// ── Main ──────────────────────────────────────────────────
console.log('=== TSX Style Corruption Fixer ===');
console.log('Scanning ' + FILES.length + ' files...\n');
let total = 0;

for (const f of FILES) {
  if (!existsSync(f)) {
    console.log('SKIP  ' + f + ' (not found)');
    continue;
  }
  const src = readFileSync(f, 'utf-8');
  const { content, fixes } = fixContent(src);
  if (fixes > 0) {
    writeFileSync(f, content, 'utf-8');
    console.log('FIXED ' + f + '  (' + fixes + ' repairs)');
    total += fixes;
  } else {
    console.log('OK    ' + f);
  }
}

console.log('\n' + total + ' total repairs.');
if (total > 0) {
  console.log('\nNext steps:');
  console.log('  1. git diff                    # review all changes');
  console.log('  2. cd app && npm run dev       # verify compilation');
  console.log('  3. git add -A && git commit -m "fix: repair style double-brace corruption"');
}
