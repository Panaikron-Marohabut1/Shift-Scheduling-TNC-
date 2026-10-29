import { Pool } from 'pg';
import '../src/config';
// Links a Supabase Auth account (shift/Backend) to a user row, which carries the employee and role.
//   pnpm --filter @tnc/api link-user                          list users and their links
//   pnpm --filter @tnc/api link-user <userId> <supabaseId>    link (Supabase → Authentication → Users → UID)
//   pnpm --filter @tnc/api link-user <userId> --unlink        remove the link
//   pnpm --filter @tnc/api link-user <userId> --email <email> set the work email; that person's first
//                                                             Microsoft 365 sign-in then links itself
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function linkUser(args:string[]) {
 const pool=new Pool({connectionString:process.env.DATABASE_ADMIN_URL});
 try {
  if(!args.length) {
   const rows=(await pool.query(`SELECT u.user_id, r.role_name AS role, t.team_code AS team,
    COALESCE(e.first_name || ' ' || e.last_name,u.demo_display_name) AS name, e.email, u.azure_object_id AS supabase_id, u.is_active AS active
    FROM users u JOIN roles r USING(role_id) LEFT JOIN employees e USING(employee_id) LEFT JOIN teams t USING(team_id) ORDER BY u.user_id`)).rows;
   console.table(rows);
   return;
  }
  const [userText,target,email]=args,userId=Number(userText);
  if(target==='--email') return await setEmail(pool,userId,email);
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
async function setEmail(pool:Pool,userId:number,email:string|undefined) {
 if(!Number.isInteger(userId)||userId<1||!email||!/^[^\s@]+@[^\s@]+$/.test(email)) throw new Error('Usage: link-user <userId> --email <name@thainitrate.com>');
 const value=email.trim().toLowerCase();
 const taken=(await pool.query('SELECT u.user_id FROM users u JOIN employees e USING(employee_id) WHERE lower(e.email)=$1 AND u.user_id<>$2',[value,userId])).rows;
 if(taken.length) throw new Error(`User ${taken[0].user_id} already has ${value}; each email must belong to one person.`);
 const c=await pool.connect();
 try {
  await c.query('BEGIN');
  const before=(await c.query('SELECT e.employee_id,e.email FROM users u JOIN employees e USING(employee_id) WHERE u.user_id=$1 FOR UPDATE OF e',[userId])).rows[0];
  if(!before) throw new Error(`No user ${userId}.`);
  await c.query('UPDATE employees SET email=$2,updated_at=now() WHERE employee_id=$1',[before.employee_id,value]);
  await c.query("INSERT INTO audit_logs(user_id,action,entity_type,entity_id,old_value,new_value) VALUES($1,'EMPLOYEE_EMAIL_SET','EMPLOYEE',$2,$3,$4)",
   [userId,before.employee_id,JSON.stringify({email:before.email}),JSON.stringify({email:value,by:'link-user script'})]);
  await c.query('COMMIT');
 } catch(e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
 console.log(`User ${userId} will be linked automatically the first time ${value} signs in with Microsoft 365.`);
}
if(require.main===module) linkUser(process.argv.slice(2)).catch(e=>{console.error(e.message);process.exitCode=1;});
