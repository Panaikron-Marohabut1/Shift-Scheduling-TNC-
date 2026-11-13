import { readFileSync, readdirSync } from 'node:fs';
import { createHash, createHmac, pbkdf2Sync, randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import { projectRoot } from '../src/config';
import { seedDemoData } from './demo';

const profiles = ['employee-a', 'employee-b', 'supervisor-a', 'supervisor-b', 'manager'];
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

function scramVerifier(password: string) {
 const salt = randomBytes(16);
 const iterations = 4096;
 const salted = pbkdf2Sync(password, salt, iterations, 32, 'sha256');
 const clientKey = createHmac('sha256', salted).update('Client Key').digest();
 const storedKey = createHash('sha256').update(clientKey).digest('base64');
 const serverKey = createHmac('sha256', salted).update('Server Key').digest('base64');
 return `SCRAM-SHA-256$${iterations}:${salt.toString('base64')}$${storedKey}:${serverKey}`;
}

async function prepare() {
 const project = process.env.PILOT_SUPABASE_PROJECT_REF;
 if (!project || !/^[a-z0-9]{20}$/.test(project) || project === 'mmesiubkvxmsklmgsepd') {
  throw new Error('Choose a separate Supabase project for the synthetic Pilot.');
 }
 const owner = new URL(process.env.PILOT_DATABASE_OWNER_URL || '');
 const ownerName = decodeURIComponent(owner.username);
 const direct = owner.hostname === `db.${project}.supabase.co` && ownerName === 'postgres';
 const pooler = owner.hostname.endsWith('.pooler.supabase.com') && ownerName === `postgres.${project}`;
 if ((!direct && !pooler) || !['postgres:', 'postgresql:'].includes(owner.protocol) || owner.pathname !== '/postgres'
     || (owner.port && owner.port !== '5432') || owner.search || owner.hash || !owner.password) {
  throw new Error('Use the Pilot owner connection on port 5432 without URI options.');
 }
 const password = process.env.PILOT_DATABASE_ROLE_PASSWORD;
 if (!password || !/^[a-zA-Z0-9_-]{32,}$/.test(password)) throw new Error('Set a random Pilot database role password of 32 or more URL-safe characters.');
 const values: Record<string, unknown> = JSON.parse(process.env.PILOT_AUTH_UIDS || '{}');
 const bindings = profiles.map(profile => {
  const id = values[profile];
  if (typeof id !== 'string' || !uuid.test(id)) throw new Error(`Provide a confirmed Auth UID for ${profile}.`);
  return { profile, id: id.toLowerCase() };
 });
 if (new Set(bindings.map(({id})=>id)).size !== profiles.length) throw new Error('Use a different Auth account for each Pilot role.');
 const certificate = process.env.DATABASE_CA_CERT;
 if (!certificate) throw new Error('Set DATABASE_CA_CERT for Supabase TLS verification.');
 const pool = new Pool({ connectionString: owner.toString(), connectionTimeoutMillis: 15000,
  ssl: { ca: readFileSync(resolve(projectRoot, certificate), 'utf8'), rejectUnauthorized: true } });
 try {
  const client = await pool.connect();
  try {
   await client.query('BEGIN');
   await client.query('SELECT pg_advisory_xact_lock(900701)');
   const { rows: [existing] } = await client.query(`SELECT
    EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','f')) AS objects,
    EXISTS (SELECT 1 FROM pg_roles WHERE rolname IN ('shiftflow_app','tnc_pilot_backend')) AS roles,
    to_regnamespace('shiftflow_policy') IS NOT NULL AS policy`);
   if (existing.objects || existing.roles || existing.policy) throw new Error('The Pilot project already contains application objects. No changes were made.');
   const confirmed = await client.query(`SELECT id FROM auth.users WHERE id=ANY($1::uuid[]) AND email_confirmed_at IS NOT NULL`, [bindings.map(({id})=>id)]);
   if (confirmed.rowCount !== profiles.length) throw new Error('Confirm all five Pilot accounts in this Supabase project first.');
   await client.query('CREATE ROLE shiftflow_app NOLOGIN');
   // PostgreSQL role DDL cannot take bind parameters. Quote the literal on the server first.
   const { rows: [{ ddl }] } = await client.query("SELECT format('CREATE ROLE tnc_pilot_backend LOGIN CONNECTION LIMIT 8 PASSWORD %L', $1::text) AS ddl", [scramVerifier(password)]);
   await client.query(ddl);
   await client.query('GRANT shiftflow_app TO tnc_pilot_backend');
   await client.query('CREATE TABLE public.schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
   const directory = resolve(projectRoot, 'apps/api/migrations');
   for (const name of readdirSync(directory).filter(file=>file.endsWith('.sql')).sort()) {
    await client.query(readFileSync(resolve(directory, name), 'utf8'));
    await client.query('INSERT INTO public.schema_migrations(name) VALUES($1)', [name]);
   }
   await client.query(`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated, service_role;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated, service_role;
    REVOKE ALL ON FUNCTION public.protect_evidence(), public.protect_decision(), public.enforce_demo_identity() FROM PUBLIC, anon, authenticated, service_role;
    GRANT SELECT ON public.schema_migrations TO shiftflow_app`);
   const result = await seedDemoData(client, true, false);
   for (const {profile,id} of bindings) {
    const { rows: [account] } = await client.query(`UPDATE users SET azure_object_id=$2,updated_at=now()
      WHERE demo_profile=$1 AND identity_source='DEMO' AND azure_object_id IS NULL RETURNING user_id`, [profile,id]);
    if (!account) throw new Error(`Missing synthetic profile ${profile}.`);
    await client.query(`INSERT INTO audit_logs(user_id,action,entity_type,entity_id,new_value)
      VALUES($1,'IDENTITY_LINKED','USER',$1,$2)`,[account.user_id,JSON.stringify({identitySource:'SUPABASE',by:'Pilot provisioning'})]);
   }
   await client.query(`INSERT INTO shiftflow_policy.swap_policy_activation(effective_month,activated_at)
    VALUES(date_trunc('month',timezone('Asia/Bangkok',now()))::date,now())`);
   await client.query('COMMIT');
   console.log(result);
   console.log('Five confirmed accounts are linked. No existing project was modified.');
  } catch (error) {
   await client.query('ROLLBACK');
   throw error;
  } finally { client.release(); }
 } finally { await pool.end(); }
}

prepare().catch(error => {
 // Driver details can include SQL text or connection credentials.
 console.error(error instanceof Error && !('code' in error) && !(error instanceof TypeError) && !(error instanceof SyntaxError)
  ? error.message : 'Pilot setup failed. Check project settings, TLS, Auth UIDs and the database server logs.');
 process.exitCode = 1;
});
