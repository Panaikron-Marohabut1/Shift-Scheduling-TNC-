import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import { projectRoot } from '../config';
export async function migrate() {
  if (!process.env.DATABASE_ADMIN_URL) throw new Error('Run setup first.');
  const pool = new Pool({ connectionString: process.env.DATABASE_ADMIN_URL });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(900701)');
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    const dir = resolve(projectRoot, 'apps/api/migrations');
    for (const name of readdirSync(dir).filter(n => n.endsWith('.sql')).sort()) {
      if ((await client.query('SELECT 1 FROM schema_migrations WHERE name=$1', [name])).rowCount) continue;
      await client.query(readFileSync(resolve(dir, name), 'utf8'));
      await client.query('INSERT INTO schema_migrations(name) VALUES($1)', [name]);
      console.log(`Applied ${name}`);
    }
    await client.query('GRANT SELECT ON schema_migrations TO shiftflow_app');
    await client.query('COMMIT');
  } catch(e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); await pool.end(); }
}
if(require.main===module)migrate().catch(e => { console.error(e.message); process.exitCode=1; });
