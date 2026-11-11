import { config } from 'dotenv';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import type { PoolConfig } from 'pg';
export const projectRoot = resolve(__dirname, '../../..');
config({ path: resolve(projectRoot, '.env'), quiet: true });
export function isLocalSwapPilotDatabase(url: URL): boolean {
  return ['postgres:', 'postgresql:'].includes(url.protocol)
    && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    && !url.search && !url.hash
    && /^\/(tnc_test_\d+|tnc_swap_pilot_[a-z0-9_]+)$/.test(url.pathname);
}

export function isLocalSchedulingDatabase(url: URL): boolean {
  return isLocalSwapPilotDatabase(url) || (
    ['postgres:', 'postgresql:'].includes(url.protocol)
    && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    && !url.search && !url.hash
    && /^\/(shiftflow_demo|tnc_demo_\d+)$/.test(url.pathname)
  );
}
// Database credentials stay on the server. Cloud connections verify the server certificate;
// local test databases retain their existing non-TLS connection and startup settings.
export function databaseOptions(): PoolConfig {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error('Run setup to configure DATABASE_URL.');
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('Invalid DATABASE_URL.'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('DATABASE_URL must use PostgreSQL.');
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (local) return { connectionString: value, max: 8, connectionTimeoutMillis: 3000, options: '-c timezone=UTC -c statement_timeout=10000' };
  if (!url.hostname.endsWith('.pooler.supabase.com') && !/^db\.[a-z0-9]+\.supabase\.co$/.test(url.hostname)) {
    throw new Error('Remote database connections are restricted to Supabase.');
  }
  if (['postgres', 'supabase_admin'].includes(decodeURIComponent(url.username).split('.')[0])) {
    throw new Error('Use a restricted backend database account, not the database administrator.');
  }
  if (!url.username || !url.password) throw new Error('Set the backend database account credentials.');
  if ([...url.searchParams.keys()].some(key => key !== 'sslmode')) {
    throw new Error('Only sslmode=verify-full is supported in a cloud connection URI; configure the CA separately.');
  }
  if (url.searchParams.has('sslmode') && url.searchParams.get('sslmode') !== 'verify-full') {
    throw new Error('Cloud connections require full certificate verification.');
  }
  const certificate = process.env.DATABASE_CA_CERT;
  if (!certificate) throw new Error('Set DATABASE_CA_CERT before connecting to Supabase.');
  // pg connection-string SSL parameters replace the ssl object; use one explicit TLS config.
  url.searchParams.delete('sslmode');
  return {
    connectionString: url.toString(), max: 8, connectionTimeoutMillis: 15000,
    options: '-c timezone=UTC -c statement_timeout=10000',
    ssl: { ca: readFileSync(resolve(projectRoot, certificate), 'utf8'), rejectUnauthorized: true },
  };
}
export function settings() {
  const mode = process.env.APP_MODE ?? 'DEMO';
  const host = process.env.HOST ?? '127.0.0.1';
  const port = Number(process.env.PORT ?? 3000);
  const origin = process.env.APP_ORIGIN ?? `http://localhost:${port}`;
  const retention = Number(process.env.AUDIT_RETENTION_DAYS ?? 90);
  const hours = Number(process.env.SESSION_HOURS ?? 12);
  // Central login service (apps/auth, Supabase Auth). Its session cookie is host-only on
  // localhost, so the browser sends it to this app as well; ports do not separate cookies.
  const authUrl = (process.env.AUTH_URL ?? 'http://localhost:3001').replace(/\/+$/, '');
  const authCookie = process.env.AUTH_COOKIE_NAME ?? 'sb-session';
  if (mode !== 'DEMO' || !['127.0.0.1', 'localhost'].includes(host)) throw new Error('Only localhost synthetic-data DEMO is supported. Company access is disabled.');
  if (!Number.isInteger(port) || port < 1 || port > 65535 || new URL(origin).protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(new URL(origin).hostname)) throw new Error('Invalid local origin/port.');
  if (!Number.isFinite(retention) || retention < 90) throw new Error('AUDIT_RETENTION_DAYS must be at least 90.');
  if (!Number.isFinite(hours) || hours <= 0 || hours > 24) throw new Error('Invalid session duration.');
  if (new URL(authUrl).protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(new URL(authUrl).hostname)) throw new Error('AUTH_URL must be a local http://localhost login service.');
  if (!/^[A-Za-z0-9_-]+$/.test(authCookie)) throw new Error('Invalid AUTH_COOKIE_NAME.');
  if (!process.env.DATABASE_URL) throw new Error('Run setup to configure DATABASE_URL.');
  return { mode, host, port, origin, retention, hours, authUrl, authCookie };
}
