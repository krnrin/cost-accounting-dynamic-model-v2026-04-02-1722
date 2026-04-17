import { mkdir, readdir } from 'fs/promises';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { config } from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SERVER_ROOT = resolve(__dirname, '..', '..');
const PRISMA_DATA_DIR = resolve(SERVER_ROOT, 'prisma', 'data');
const PRISMA_MIGRATIONS_DIR = resolve(SERVER_ROOT, 'prisma', 'migrations');
const DEFAULT_DB_URL = 'file:./data/harness_cost.db';

function isDefaultSqliteDatabase() {
  return config.DATABASE_URL === DEFAULT_DB_URL;
}

function isPrismaCliProcess() {
  return process.argv.slice(1).some((arg) => arg.includes('prisma'));
}

function isDirectEntry() {
  return Boolean(process.argv[1]) && resolve(process.argv[1]) === __filename;
}

function shouldManageCurrentDatabase() {
  return !isPrismaCliProcess() && (isDefaultSqliteDatabase() || isDirectEntry());
}

function run(command: string, args: string[]) {
  return new Promise<void>((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: SERVER_ROOT,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: { ...process.env, DATABASE_URL: config.DATABASE_URL },
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      reject(new Error(`${command} ${args.join(' ')} exited with code ${code ?? 'unknown'}`));
    });

    child.on('error', reject);
  });
}

async function listMigrationNames() {
  const entries = await readdir(PRISMA_MIGRATIONS_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

async function baselineExistingDatabase() {
  const migrationNames = await listMigrationNames();
  for (const migrationName of migrationNames) {
    await run('npx', ['prisma', 'migrate', 'resolve', '--applied', migrationName]);
  }
}

async function deployMigrationsWithBaseline() {
  try {
    await run('npx', ['prisma', 'migrate', 'deploy']);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('P3005')) {
      throw error;
    }
    await baselineExistingDatabase();
    await run('npx', ['prisma', 'migrate', 'deploy']);
  }
}

export async function ensureDatabaseInitialized() {
  if (!shouldManageCurrentDatabase()) {
    return;
  }

  await mkdir(PRISMA_DATA_DIR, { recursive: true });
  await run('npx', ['prisma', 'generate']);
  await deployMigrationsWithBaseline();
}

export async function ensureDatabaseSeeded() {
  if (!shouldManageCurrentDatabase()) {
    return;
  }

  await run('npx', ['prisma', 'db', 'seed']);
}

export async function ensureDatabaseReady() {
  await ensureDatabaseInitialized();
  await ensureDatabaseSeeded();
}

export async function main() {
  await ensureDatabaseReady();
}

if (isDirectEntry()) {
  main().catch((error) => {
    console.error('[db:init] failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
