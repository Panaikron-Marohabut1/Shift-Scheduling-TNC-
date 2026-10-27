import { Pool } from 'pg';
import '../src/config';
// Links a Supabase Auth account (shift/Backend) to a user row, which carries the employee and role.
//   pnpm --filter @tnc/api link-user                          list users and their links
//   pnpm --filter @tnc/api link-user <userId> <supabaseId>    link (Supabase → Authentication → Users → UID)
//   pnpm --filter @tnc/api link-user <userId> --unlink        remove the link
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function linkUser(args:string[]) {
 const pool=new Pool({connectionString:process.env.DATABASE_ADMIN_URL});
 try {
  if(!args.length) {
   const rows=(await pool.query(`SELECT u.user_id, r.role_name AS role, t.team_code AS team,
    COALESCE(e.first_name || ' ' || e.last_name,u.demo_display_name) AS name, u.azure_object_id AS supabase_id, u.is_active AS active
    FROM users u JOIN roles r USING(role_id) LEFT JOIN employees e USING(employee_id) LEFT JOIN teams t USING(team_id) ORDER BY u.user_id`)).rows;
   console.table(rows);
   return;
  }
  const [userText,target]=args,userId=Number(userText);
  if(!Number.isInteger(userId)||userId<1||!target||(target!=='--unlink'&&!UUID.test(target))) throw new Error('Usage: link-user <userId> <supabaseUserId|--unlink>');
  const supabaseId=target==='--unlink'?null:target.toLowerCase();
  const c=await pool.connect();
  try {
   await c.query('BEGIN');
   const updated=await c.query('UPDATE users SET azure_object_id=$2,updated_at=now() WHERE user_id=$1 RETURNING user_id',[userId,supabaseId]);
   if(!updated.rowCount) throw new Error(`No user ${userId}.`);
   await c.query("INSERT INTO audit_logs(user_id,action,entity_type,entity_id,new_value) VALUES($1,$2,'USER',$1,$3)",
    [userId,supabaseId?'IDENTITY_LINKED':'IDENTITY_UNLINKED',JSON.stringify({identitySource:'SUPABASE',supabaseUserId:supabaseId,by:'link-user script'})]);
   await c.query('COMMIT');
  } catch(e:any) {
   await c.query('ROLLBACK');
   if(e.code==='23505') throw new Error('That Supabase account is already linked to another user. Unlink it first.');
   throw e;
  } finally { c.release(); }
  console.log(supabaseId?`User ${userId} now signs in with Supabase account ${supabaseId}.`:`User ${userId} is no longer linked.`);
 } finally { await pool.end(); }
}
if(require.main===module) linkUser(process.argv.slice(2)).catch(e=>{console.error(e.message);process.exitCode=1;});
