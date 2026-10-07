import { config } from 'dotenv';
import { resolve } from 'node:path';
export const projectRoot = resolve(__dirname, '../../..');
config({ path: resolve(projectRoot, '.env'), quiet: true });
export function settings() {
  const mode = process.env.APP_MODE ?? 'DEMO';
  const host = process.env.HOST ?? '127.0.0.1';
  const port = Number(process.env.PORT ?? 3000);
  const origin = process.env.APP_ORIGIN ?? `http://localhost:${port}`;
  const retention = Number(process.env.AUDIT_RETENTION_DAYS ?? 90);
  const hours = Number(process.env.SESSION_HOURS ?? 12);
  if (mode !== 'DEMO' || !['127.0.0.1', 'localhost'].includes(host)) throw new Error('Only localhost synthetic-data DEMO is supported. Company access is disabled.');
  if (!Number.isInteger(port) || port < 1 || port > 65535 || new URL(origin).protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(new URL(origin).hostname)) throw new Error('Invalid local origin/port.');
  if (!Number.isFinite(retention) || retention < 90) throw new Error('AUDIT_RETENTION_DAYS must be at least 90.');
  if (!Number.isFinite(hours) || hours <= 0 || hours > 24) throw new Error('Invalid session duration.');
  if (!process.env.DATABASE_URL) throw new Error('Run setup to configure DATABASE_URL.');
  return { mode, host, port, origin, retention, hours };
}
