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
  if (!url.hostname.endsWith('.pooler.supabase.com') && !/^db\.[a-z0-9]+\.supabase\.co$/.test(url.hostname)) {
    throw new Error('The Supabase launcher requires a Supabase database endpoint.');
  }
  if (!cloud.DATABASE_CA_CERT || !existsSync(resolve(root, cloud.DATABASE_CA_CERT))) {
    throw new Error('Set DATABASE_CA_CERT to the trusted Supabase certificate.');
  }
  process.env.DATABASE_URL = cloud.DATABASE_URL;
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
