import { spawn } from 'node:child_process';
import { createConnection } from 'node:net';
import { dirname, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { createPilotGateway } from './pilot-gateway.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const origin = process.env.APP_ORIGIN;
const sharedDemo = process.argv[2] === '--shared-demo';
if (sharedDemo) {
  process.env.APP_MODE = 'SHARED_DEMO';
  process.env.SHARED_DEMO_PUBLIC_HTTPS = 'true';
  process.env.DATABASE_CA_CERT ||= 'config/certs/supabase-prod-ca-2021.crt';
} else if (process.env.APP_MODE !== 'PILOT') {
  throw new Error('Set APP_MODE=PILOT to run the pilot deployment.');
}
const publicPort = Number(process.env.PORT || 8080);
if (!Number.isInteger(publicPort) || publicPort < 1024 || publicPort > 65535 || [3000, 3001].includes(publicPort)) {
  throw new Error('Set PORT to an unprivileged ingress port other than 3000 or 3001.');
}
const gateway = createPilotGateway({ origin, microsoft: sharedDemo });
const children = [];
let stopping = false;

function stop(code) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  gateway.close();
  for (const child of children) if (child.exitCode === null) child.kill('SIGTERM');
  setTimeout(() => {
    gateway.closeAllConnections();
    for (const child of children) if (child.exitCode === null) child.kill('SIGKILL');
  }, 5000).unref();
}

function launch(name, args, cwd, env) {
  const child = spawn(process.execPath, args, { cwd, env, stdio: 'inherit' });
  children.push(child);
  child.on('error', () => { console.error(`Failed to start ${name}.`); stop(1); });
  child.on('exit', () => { if (!stopping) { console.error(`${name} stopped.`); stop(1); } });
}

async function waitForService(port) {
  const deadline = Date.now() + 25_000;
  while (!stopping && Date.now() < deadline) {
    const listening = await new Promise(resolve => {
      const socket = createConnection(port, '127.0.0.1');
      socket.once('connect', () => { socket.destroy(); resolve(true); });
      socket.once('error', () => resolve(false));
    });
    if (listening) return;
    await delay(150);
  }
  if (!stopping) throw new Error(`Internal service on port ${port} did not start.`);
}

process.on('SIGTERM', () => stop(0));
process.on('SIGINT', () => stop(0));
gateway.on('error', () => { console.error('Hosted ingress failed.'); stop(1); });
launch('API', ['apps/api/dist/main.js'], root, {
  ...process.env, HOST: '127.0.0.1', PORT: '3000', AUTH_URL: 'http://127.0.0.1:3001',
  DATABASE_ADMIN_URL: '', ENABLE_MICROSOFT_AUTO_LINK: 'false',
});
launch('Auth', ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', '3001'], resolve(root, 'apps/auth'), {
  ...process.env, PORT: '3001', AUTH_HOST: origin, TRUSTED_APP_ORIGINS: origin, SHARE_AUTH_COOKIE: 'false',
  DATABASE_URL: '', DATABASE_ADMIN_URL: '', DATABASE_CA_CERT: '',
});
try {
  await Promise.all([waitForService(3000), waitForService(3001)]);
  if (!stopping) gateway.listen(publicPort, '0.0.0.0');
} catch (error) {
  console.error(error.message);
  stop(1);
}
