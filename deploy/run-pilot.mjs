import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPilotGateway } from './pilot-gateway.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const origin = process.env.APP_ORIGIN;
if (process.env.APP_MODE !== 'PILOT') throw new Error('Set APP_MODE=PILOT to run the pilot deployment.');
const publicPort = Number(process.env.PORT || 8080);
if (!Number.isInteger(publicPort) || publicPort < 1024 || publicPort > 65535 || [3000, 3001].includes(publicPort)) {
  throw new Error('Set PORT to an unprivileged ingress port other than 3000 or 3001.');
}
const gateway = createPilotGateway({ origin });
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

process.on('SIGTERM', () => stop(0));
process.on('SIGINT', () => stop(0));
gateway.on('error', () => { console.error('Pilot ingress failed.'); stop(1); });
launch('API', ['apps/api/dist/main.js'], root, {
  ...process.env, HOST: '127.0.0.1', PORT: '3000', AUTH_URL: 'http://127.0.0.1:3001',
  DATABASE_ADMIN_URL: '', ENABLE_MICROSOFT_AUTO_LINK: 'false',
});
launch('Auth', ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', '3001'], resolve(root, 'apps/auth'), {
  ...process.env, PORT: '3001', AUTH_HOST: origin, TRUSTED_APP_ORIGINS: origin, SHARE_AUTH_COOKIE: 'false',
  DATABASE_URL: '', DATABASE_ADMIN_URL: '', DATABASE_CA_CERT: '',
});
gateway.listen(publicPort, '0.0.0.0');
