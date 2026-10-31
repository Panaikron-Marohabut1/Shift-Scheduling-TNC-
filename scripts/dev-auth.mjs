import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { spawn } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envFile = resolve(root, '.env');
const local = existsSync(envFile) ? parseEnv(readFileSync(envFile, 'utf8')) : {};
const auth = new URL(process.env.AUTH_URL ?? local.AUTH_URL ?? 'http://localhost:3001');
if (auth.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(auth.hostname) || auth.username || auth.password || auth.pathname !== '/' || auth.search || auth.hash) {
  throw new Error('AUTH_URL must be a local HTTP origin, for example http://localhost:4001.');
}
const directory = resolve(root, 'apps/auth');
const next = resolve(directory, 'node_modules/next/dist/bin/next');
if (!existsSync(next)) throw new Error('Install Auth dependencies first: npm --prefix apps/auth ci');

// Keep the listening port and OAuth callback origin aligned with the API's AUTH_URL.
const child = spawn(process.execPath, [next, 'dev', '--hostname', '127.0.0.1', '--port', auth.port || '80'], {
  cwd: directory,
  env: { ...process.env, AUTH_HOST: auth.origin },
  stdio: 'inherit',
  windowsHide: true,
});
child.once('error', error => { console.error(error.message); process.exitCode = 1; });
child.once('exit', code => { process.exitCode = code ?? 1; });
