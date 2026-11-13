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

export function isRemotePilotDatabase(url: URL): boolean {
  const project = process.env.PILOT_SUPABASE_PROJECT_REF;
  if (process.env.APP_MODE !== 'PILOT' || !project || !/^[a-z0-9]{20}$/.test(project)
      || project === 'mmesiubkvxmsklmgsepd' || !['postgres:', 'postgresql:'].includes(url.protocol)
      || url.pathname !== '/postgres' || (url.port && url.port !== '5432') || url.hash) return false;
  const user = decodeURIComponent(url.username);
  return (url.hostname === `db.${project}.supabase.co` && user === 'tnc_pilot_backend')
    || (url.hostname.endsWith('.pooler.supabase.com') && user === `tnc_pilot_backend.${project}`);
}

export const sharedDemoProject = 'mmesiubkvxmsklmgsepd';

export function isSharedDemoDatabase(url: URL): boolean {
  if (process.env.APP_MODE !== 'SHARED_DEMO' || !['postgres:', 'postgresql:'].includes(url.protocol)
      || url.pathname !== '/postgres' || (url.port && url.port !== '5432') || url.hash) return false;
  const user = decodeURIComponent(url.username);
  return (url.hostname === `db.${sharedDemoProject}.supabase.co` && user === 'tnc_backend_dev')
    || (url.hostname.endsWith('.pooler.supabase.com') && user === `tnc_backend_dev.${sharedDemoProject}`);
}

export const pilotMigrations = [
  '005_swap_quota_policy.sql', '006_swap_quota_usage.sql', '007_swap_policy_cutover.sql',
  '008_admin_demo_access.sql', '009_effective_demo_teams.sql',
];

export function centralSchedulingEnabled(url: URL): boolean {
  return isLocalSchedulingDatabase(url) || isRemotePilotDatabase(url) || isSharedDemoDatabase(url);
}
// Database credentials stay on the server. Cloud connections verify the server certificate;
// local test databases retain their existing non-TLS connection and startup settings.
export function databaseOptions(): PoolConfig {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error('Run setup to configure DATABASE_URL.');
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('Invalid DATABASE_URL.'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('DATABASE_URL must use PostgreSQL.');
  if (process.env.APP_MODE === 'PILOT' && !isRemotePilotDatabase(url)) {
    throw new Error('Pilot requires its own Supabase project and tnc_pilot_backend account.');
  }
  if (process.env.APP_MODE === 'SHARED_DEMO' && !isSharedDemoDatabase(url)) {
    throw new Error('Shared demo requires the existing Supabase project and its restricted backend account.');
  }
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
  const remotePilot = mode === 'PILOT';
  const sharedDemo = mode === 'SHARED_DEMO';
  const publicUrl = new URL(origin);
  if (!['DEMO', 'PILOT', 'SHARED_DEMO'].includes(mode) || !['127.0.0.1', 'localhost'].includes(host)) throw new Error('Use a supported demo mode on a loopback listener.');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid API port.');
  if (remotePilot) {
    if (publicUrl.protocol !== 'https:' || origin !== publicUrl.origin || publicUrl.port || ['localhost', '127.0.0.1', '[::1]'].includes(publicUrl.hostname)) {
      throw new Error('Pilot APP_ORIGIN must be its public HTTPS origin.');
    }
    if (!process.env.DATABASE_URL || !isRemotePilotDatabase(new URL(process.env.DATABASE_URL))) {
      throw new Error('Pilot requires its own Supabase project and tnc_pilot_backend account.');
    }
  } else if (publicUrl.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(publicUrl.hostname)) throw new Error('Invalid local origin/port.');
  if (sharedDemo && (!process.env.DATABASE_URL || !isSharedDemoDatabase(new URL(process.env.DATABASE_URL)))) {
    throw new Error('Shared demo requires the existing Supabase project and its restricted backend account.');
  }
  if ((remotePilot || sharedDemo) && (process.env.ENABLE_LOCAL_SWAP_POLICY === 'false' || process.env.ENABLE_LOCAL_MONTH_CLOSE === 'false')) {
    throw new Error('Shared testing requires central swap and month-close policies.');
  }
  if (!Number.isFinite(retention) || retention < 90) throw new Error('AUDIT_RETENTION_DAYS must be at least 90.');
  if (!Number.isFinite(hours) || hours <= 0 || hours > 24) throw new Error('Invalid session duration.');
  const internalAuth = new URL(authUrl);
  if (internalAuth.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(internalAuth.hostname) || authUrl !== internalAuth.origin) throw new Error('AUTH_URL must be a local HTTP login service origin.');
  if (!/^[A-Za-z0-9_-]+$/.test(authCookie)) throw new Error('Invalid AUTH_COOKIE_NAME.');
  if (!process.env.DATABASE_URL) throw new Error('Run setup to configure DATABASE_URL.');
  return { mode, remotePilot, sharedDemo, host, port, origin, retention, hours, authUrl, authCookie };
}
