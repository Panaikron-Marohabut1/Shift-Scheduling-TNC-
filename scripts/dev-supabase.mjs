import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const file = resolve(root, '.env.supabase.local');
try {
  if (!existsSync(file)) throw new Error('Prepare .env.supabase.local using the Supabase database guide first.');
  const cloud = parseEnv(readFileSync(file, 'utf8'));
  if (cloud.SUPABASE_CONNECTION_READY !== 'true') {
    throw new Error('Supabase connection is not ready yet. Complete database account setup and verification first.');
  }
  const url = new URL(cloud.DATABASE_URL || '');
  const project = 'mmesiubkvxmsklmgsepd';
  const user = decodeURIComponent(url.username);
  const direct = url.hostname === `db.${project}.supabase.co` && user === 'tnc_backend_dev';
  const pooler = url.hostname.endsWith('.pooler.supabase.com') && user === `tnc_backend_dev.${project}`;
  if ((!direct && !pooler) || url.pathname !== '/postgres' || (url.port && url.port !== '5432')) {
    throw new Error('Use the restricted backend connection for the existing shared Supabase demo.');
  }
  const authFile = resolve(root, 'apps/auth/.env.local');
  const auth = existsSync(authFile) ? parseEnv(readFileSync(authFile, 'utf8')) : {};
  const authUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? auth.NEXT_PUBLIC_SUPABASE_URL;
  if (authUrl?.replace(/\/$/, '') !== `https://${project}.supabase.co`) {
    throw new Error('Set NEXT_PUBLIC_SUPABASE_URL to the existing shared project in apps/auth/.env.local.');
  }
  if (!cloud.DATABASE_CA_CERT || !existsSync(resolve(root, cloud.DATABASE_CA_CERT))) {
    throw new Error('Set DATABASE_CA_CERT to the trusted Supabase certificate.');
  }
  process.env.DATABASE_URL = cloud.DATABASE_URL;
  process.env.APP_MODE = 'SHARED_DEMO';
  process.env.DATABASE_CA_CERT = cloud.DATABASE_CA_CERT;
  // Never pass owner credentials to the cloud runtime. Local migrate/seed/test commands
  // continue to use the original .env when run separately from the repository root.
  process.env.DATABASE_ADMIN_URL = '';
  console.log('Database target: Supabase. The local database is unchanged.');
  await import('./dev.mjs');
} catch (error) {
  // Do not echo a connection URI or credentials from a malformed config.
  console.error(error instanceof TypeError ? 'Invalid Supabase connection configuration.' : error.message);
  process.exitCode = 1;
}
