import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const children = [];
let startedDatabase = false;
let stopping;

function runDatabase(action) {
  const result = spawnSync(process.execPath, [resolve(root, 'scripts/local-postgres.mjs'), action], {
    cwd: root, stdio: 'inherit', windowsHide: true,
  });
  if (result.error || result.status !== 0) throw new Error(`Database ${action} failed.`);
}

async function stopChild(child) {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === 'win32') {
    await new Promise(done => {
      const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
        stdio: 'ignore', windowsHide: true,
      });
      killer.once('error', done);
      killer.once('exit', done);
    });
  } else {
    await new Promise(done => {
      const timer = setTimeout(() => {
        try { process.kill(-child.pid, 'SIGKILL'); } catch {}
        done();
      }, 5000);
      child.once('exit', () => { clearTimeout(timer); done(); });
      try { process.kill(-child.pid, 'SIGTERM'); } catch { clearTimeout(timer); done(); }
    });
  }
}

function shutdown(code = 0) {
  if (stopping) return stopping;
  // Set the guard before stopping children: their exit events also call shutdown.
  stopping = Promise.resolve().then(async () => {
    await Promise.all(children.map(stopChild));
    if (startedDatabase) {
      try { runDatabase('stop'); }
      catch (error) { console.error(error.message); code = 1; }
    }
    process.exitCode = code;
    console.log('Development services stopped.');
  });
  return stopping;
}

process.on('SIGINT', () => { void shutdown(); });
process.on('SIGTERM', () => { void shutdown(); });

function launch(name, args, cwd = root) {
  const child = spawn(process.execPath, args, {
    cwd, stdio: 'inherit', windowsHide: true, detached: process.platform !== 'win32',
  });
  children.push(child);
  child.once('error', error => {
    console.error(`${name}: ${error.message}`);
    void shutdown(1);
  });
  child.once('exit', (code, signal) => {
    if (!stopping) {
      console.error(`${name} stopped (${signal || code}). Stopping the other services.`);
      void shutdown(1);
    }
  });
}

function requireFile(file, instruction) {
  if (!existsSync(file)) throw new Error(instruction);
}

async function checkPort(port) {
  await new Promise((done, reject) => {
    const server = createServer();
    server.once('error', error => reject(new Error(`Port ${port}: ${error.code}. Stop the existing service or change the local port settings.`)));
    server.listen(port, '127.0.0.1', () => server.close(done));
  });
}

async function main() {
  const envFile = resolve(root, '.env');
  const authFile = resolve(root, 'apps/auth/.env.local');
  requireFile(envFile, 'Run pnpm setup once to prepare the local database and .env.');
  requireFile(authFile, 'Create apps/auth/.env.local using apps/auth/README.md before starting.');
  const env = { ...parseEnv(readFileSync(envFile, 'utf8')), ...process.env };
  const authEnv = { ...parseEnv(readFileSync(authFile, 'utf8')), ...process.env };
  for (const key of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY']) {
    if (!authEnv[key]) throw new Error(`Set ${key} in apps/auth/.env.local.`);
  }
  const api = resolve(root, 'apps/api/node_modules/tsx/dist/cli.mjs');
  requireFile(api, 'Run pnpm deps to install both API and Auth dependencies.');
  requireFile(resolve(root, 'apps/auth/node_modules/next/dist/bin/next'), 'Run pnpm deps to install both API and Auth dependencies.');
  const port = Number(env.PORT || 3000);
  const app = new URL(env.APP_ORIGIN || `http://localhost:${port}`);
  const auth = new URL(env.AUTH_URL || 'http://localhost:3001');
  for (const url of [app, auth]) {
    if (url.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(url.hostname) ||
        url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      throw new Error('APP_ORIGIN and AUTH_URL must be local HTTP origins.');
    }
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535 || Number(app.port || 80) !== port) {
    throw new Error('PORT must match the port in APP_ORIGIN.');
  }
  const authPort = Number(auth.port || 80);
  if (port === authPort) throw new Error('Web/API and Auth must use different ports.');
  const trusted = (authEnv.TRUSTED_APP_ORIGINS || '').split(',').map(value => value.trim());
  if (!trusted.includes(app.origin)) throw new Error(`Set TRUSTED_APP_ORIGINS to include ${app.origin} in apps/auth/.env.local.`);
  await checkPort(port);
  await checkPort(authPort);
  if (stopping) return;

  const database = new URL(env.DATABASE_URL || '');
  if (process.platform === 'win32' && ['127.0.0.1', 'localhost'].includes(database.hostname) && database.port === '54329') {
    const data = resolve(root, '.local/pg-data');
    const control = resolve(root, '.local/pgsql/bin/pg_ctl.exe');
    requireFile(resolve(data, 'PG_VERSION'), 'Run pnpm setup once to prepare the local database.');
    requireFile(control, 'Run pnpm setup once to prepare PostgreSQL.');
    const status = spawnSync(control, ['-D', data, 'status'], { stdio: 'ignore', windowsHide: true });
    if (status.status !== 0) {
      runDatabase('start');
      startedDatabase = true;
    } else console.log('Using the database that is already running; it will remain running when you stop.');
  } else console.log('Using the configured database; start and stop that database separately.');

  if (stopping) return;
  console.log(`Starting web/API: ${app.origin}`);
  console.log(`Starting Login: ${auth.origin}`);
  console.log('Press Ctrl+C to stop both services and the database started by this command.');
  launch('Web/API', [api, 'watch', 'src/main.ts'], resolve(root, 'apps/api'));
  launch('Login', [resolve(root, 'scripts/dev-auth.mjs')]);
}

main().catch(async error => {
  console.error(error.message);
  await shutdown(1);
});
