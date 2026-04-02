import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { build } from 'esbuild';

const root = resolve('.');
const outdir = resolve(root, 'vendor', 'univer-editor');

mkdirSync(outdir, { recursive: true });

await build({
  entryPoints: [resolve(root, 'src', 'g281_univer_template_editor.entry.js')],
  outfile: resolve(outdir, 'g281_univer_template_editor.js'),
  bundle: true,
  format: 'iife',
  globalName: 'G281UniverTemplateEditorBundle',
  platform: 'browser',
  target: ['chrome114'],
  logLevel: 'info',
  legalComments: 'none',
});
