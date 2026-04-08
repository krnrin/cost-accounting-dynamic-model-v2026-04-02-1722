// Simple start script that launches the server
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const child = spawn('node', ['--import', 'tsx', 'src/index.ts'], {
  cwd: __dirname,
  stdio: 'inherit',
  env: { ...process.env },
});
child.on('exit', (code) => process.exit(code || 0));
