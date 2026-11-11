import 'reflect-metadata';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { createServer, Server } from 'node:http';
import { seed } from '../seeds/demo';
import { start } from '../src/main';
import { migrate } from '../src/database/migrate';
import { projectRoot } from '../src/config';
import * as cutoverModule from '../src/requests/swap-policy-cutover';
let app:any,admin:Pool,serverAdmin:Pool;
const testName=`tnc_test_${Date.now()}`;
const port=3019,base=`http://localhost:${port}`;
const accounts:Record<string,any>={},cookies:Record<string,string>={};
// Stand-in for the central login service (apps/auth): a session cookie names a Supabase user id.
const authPort=3029,sessions=new Map<string,{email?:string;provider?:string}>();let authServer:Server;
const loginUrl=()=>`http://localhost:${authPort}/login?redirect_to=${encodeURIComponent(`${base}/`)}`;
function startAuthStub() {
 return new Promise<Server>(ready=>{
  const server=createServer((req,res)=>{
   const id=/(?:^|;\s*)sb-session=([0-9a-f-]{36})/.exec(req.headers.cookie??'')?.[1];
   if(req.url==='/api/auth/session'){const ok=!!id&&sessions.has(id),who=ok?sessions.get(id!)!:{};res.writeHead(ok?200:401,{'Content-Type':'application/json'});
    res.end(JSON.stringify({user:ok?{id,email:who.email,app_metadata:{provider:who.provider??'email',providers:[who.provider??'email']}}:null}));return;}
   if(req.url==='/auth/logout'&&req.method==='POST'){if(id)sessions.delete(id);res.writeHead(303,{Location:'/login','Set-Cookie':'sb-session=; Path=/; Max-Age=0'});res.end();return;}
   res.writeHead(404);res.end();
  });
  server.listen(authPort,()=>ready(server));
 });
}
function signIn(label:string,who:{email?:string;provider?:string}={}) {const identity=randomUUID();sessions.set(identity,who);cookies[label]=`sb-session=${identity}`;return identity;}
async function request(role:string|undefined,path:string,method='GET',body?:unknown,key?:string) {
 const response=await fetch(`${base}/api${path}`,{method,headers:{Origin:base,...(role?{Cookie:cookies[role]}:{}),...(body?{'Content-Type':'application/json'}:{}),...(key?{'Idempotency-Key':key}:{})},...(body?{body:JSON.stringify(body)}:{})});
 return {status:response.status,body:await response.json(),headers:response.headers};
}
async function assignments(role='worker',month='2026-10') {const r=await request(role,`/schedules?month=${month}`);assert.equal(r.status,200);return r.body.assignments;}
async function swapInput(date:string,source='worker',target='target') {
 const a=(await assignments(source,date.slice(0,7))).find((x:any)=>x.employee_id===accounts[source].employeeId&&x.work_date===date);
 const b=(await assignments(target,date.slice(0,7))).find((x:any)=>x.employee_id===accounts[target].employeeId&&x.work_date===date);
 return {assignmentId:a.assignment_id,targetAssignmentId:b.assignment_id,assignmentVersion:a.version,targetVersion:b.version};
}
async function teamSwapInput(date:string,source:string,targetTeam:string) {
 const all=await assignments(source,date.slice(0,7));
 const a=all.find((x:any)=>x.employee_id===accounts[source].employeeId&&x.work_date===date);
 const b=all.find((x:any)=>x.employee_code===`DEMO-${targetTeam}1`&&x.work_date===date);
 assert.ok(a&&b);
 return {input:{assignmentId:a.assignment_id,targetAssignmentId:b.assignment_id,assignmentVersion:a.version,targetVersion:b.version},a,b};
}
async function create(date:string) {const input=await swapInput(date);const r=await request('worker','/requests','POST',input,randomUUID());assert.equal(r.status,201,JSON.stringify(r.body));return r.body;}
async function approve(role:string,record:any,key=randomUUID()) {return request(role,`/requests/${record.requestId}/decisions`,'POST',{decision:'APPROVE',expectedVersion:record.version,reason:''},key);}
async function cancel(role:string,record:any,key=randomUUID()) {return request(role,`/requests/${record.requestId}/cancel`,'POST',{expectedVersion:record.version},key);}
before(async()=>{
 if(!process.env.DATABASE_ADMIN_URL)throw new Error('Run setup, migrate and seed before tests.');
 const owner=new URL(process.env.DATABASE_ADMIN_URL);
 serverAdmin=new Pool({connectionString:owner.toString()});
 // Name is generated here, validated, and used only for the database this suite owns.
 assert.match(testName,/^tnc_test_\d+$/);
 await serverAdmin.query(`CREATE DATABASE "${testName}"`);
 owner.pathname=`/${testName}`;process.env.DATABASE_ADMIN_URL=owner.toString();
 const runtime=new URL(process.env.DATABASE_URL!);runtime.pathname=`/${testName}`;process.env.DATABASE_URL=runtime.toString();
 process.env.PORT=String(port);process.env.APP_ORIGIN=base;process.env.AUTH_URL=`http://localhost:${authPort}`;
 // Legacy fixtures exercise the transition as well as the current default.
 process.env.ENABLE_LOCAL_SWAP_POLICY='false';
 process.env.ENABLE_LOCAL_MONTH_CLOSE='false';
 authServer=await startAuthStub();
 admin=new Pool({connectionString:owner.toString()});
 await migrate();
 await seed(false);app=await start();
 const users=(await admin.query(`SELECT u.user_id,r.role_name AS role,t.team_code AS team FROM users u JOIN roles r USING(role_id)
  LEFT JOIN employees e USING(employee_id) LEFT JOIN teams t USING(team_id) WHERE u.demo_order IS NOT NULL ORDER BY u.demo_order`)).rows;
 assert.equal(users.length,9);
 for(const [label,role,team] of [['worker','EMPLOYEE','A'],['target','EMPLOYEE','B'],['a','SUPERVISOR','A'],['b','SUPERVISOR','B'],['c','SUPERVISOR','C'],['d','SUPERVISOR','D'],['hr','HR','A'],['manager','MANAGER',null],['external','EXTERNAL',null]] as [string,string,string|null][]) {
  const user=users.find((x:any)=>x.role===role&&x.team===team);assert.ok(user);
  await admin.query('UPDATE users SET azure_object_id=$2 WHERE user_id=$1',[user.user_id,signIn(label)]);
  const me=await request(label,'/me');assert.equal(me.status,200,JSON.stringify(me.body));accounts[label]=me.body.actor;
 }
});
after(async()=>{
 if(app)await app.close();if(admin)await admin.end();if(authServer)authServer.close();
 if(serverAdmin) {await serverAdmin.query(`DROP DATABASE IF EXISTS "${testName}" WITH (FORCE)`);await serverAdmin.end();}
});
test('unauthenticated reads and cross-origin commands are blocked',async()=>{
 const anonymous=await request(undefined,'/schedules?month=2026-10');assert.equal(anonymous.status,401);
 assert.equal(anonymous.body.code,'SESSION_REQUIRED');assert.equal(anonymous.body.loginUrl,loginUrl());
 const cross=await fetch(`${base}/api/requests`,{method:'POST',headers:{Origin:'https://other.example',Cookie:cookies.worker,'Content-Type':'application/json'},body:'{}'});
 assert.equal(cross.status,403);
 const forged=await request('worker','/requests','POST',{...await swapInput('2026-10-08'),assignmentId:1},randomUUID());assert.ok([403,404].includes(forged.status));
});
test('only a Manager can schedule a company-wide swap quota for the next Bangkok month',async()=>{
 const path='/settings/swap-quota';
 assert.equal((await request(undefined,path)).status,401);
 const original=await request('manager',path);
 assert.equal(original.status,200);
 const {currentMonth,nextMonth}=original.body;
 assert.equal(original.body.currentLimit,2);
 assert.equal(original.body.nextLimit,2);
 const expected=(await admin.query(`
  SELECT date_trunc('month',timezone('Asia/Bangkok',now()))::date::text AS current,
    (date_trunc('month',timezone('Asia/Bangkok',now()))+interval '1 month')::date::text AS next
 `)).rows[0];
 assert.deepEqual([currentMonth,nextMonth],[expected.current,expected.next]);
 assert.equal((await request('worker',path,'PUT',{monthlyLimit:9,expectedEffectiveMonth:nextMonth,expectedRevision:0})).status,403);
 const schedule=(monthlyLimit:number,expectedEffectiveMonth=nextMonth,expectedRevision=0)=>request('manager',path,'PUT',{monthlyLimit,expectedEffectiveMonth,expectedRevision});
 assert.equal((await schedule(2.5)).status,400);
 assert.equal((await schedule(0)).status,400);
 const stale=await schedule(3,currentMonth);
 assert.equal(stale.status,409);
 assert.equal(stale.body.code,'QUOTA_EFFECTIVE_MONTH_CHANGED');
 assert.deepEqual((await request('manager',path)).body,original.body);
 const saved=await schedule(3);
 assert.equal(saved.status,200,JSON.stringify(saved.body));
 assert.deepEqual(saved.body,{currentMonth,currentLimit:2,nextMonth,nextLimit:3,nextRevision:1});
 assert.deepEqual((await request('manager',path)).body,saved.body);
 assert.deepEqual((await schedule(3,nextMonth,1)).body,saved.body);
 const edits=await Promise.all([4,5].map(monthlyLimit=>schedule(monthlyLimit,nextMonth,1)));
 assert.deepEqual(edits.map(result=>result.status).sort(),[200,409]);
 const winner=edits.find(result=>result.status===200)!;
 const replay=await schedule(3);
 assert.equal(replay.status,409);
 assert.equal(replay.body.code,'QUOTA_SETTINGS_CHANGED');
 assert.deepEqual((await request('manager',path)).body,winner.body);
 const audit=(await admin.query(`
  SELECT user_id,old_value,new_value FROM audit_logs WHERE action='SWAP_QUOTA_CHANGED' ORDER BY audit_id
 `)).rows;
 assert.equal(audit.length,2);
 assert.deepEqual(audit[0],{user_id:accounts.manager.userId,old_value:{effectiveMonth:nextMonth,monthlyLimit:2},new_value:{effectiveMonth:nextMonth,monthlyLimit:3}});
 assert.deepEqual(audit[1].old_value,audit[0].new_value);
 assert.equal((await request('manager',path)).body.nextLimit,audit[1].new_value.monthlyLimit);
 assert.equal((await request('manager',path)).body.currentLimit,2);
});
test('Supabase sessions must be valid and linked to an active user',async()=>{
 const stranger=signIn('stranger'),unlinked=await request('stranger','/me');
 assert.equal(unlinked.status,403);assert.equal(unlinked.body.code,'ACCOUNT_NOT_LINKED');
 sessions.delete(stranger);cookies.stranger=`sb-session=${randomUUID()}`; // a session the login service does not know
 const expired=await request('stranger','/schedules?month=2026-10');assert.equal(expired.status,401);assert.equal(expired.body.code,'SESSION_EXPIRED');
 const count=async(action:string,userId:number)=>(await admin.query('SELECT count(*)::int n FROM audit_logs WHERE action=$1 AND user_id=$2',[action,userId])).rows[0].n;
 const opened=await count('APP_SESSION_OPENED',accounts.worker.userId);
 await request('worker','/me');
 assert.equal(await count('APP_SESSION_OPENED',accounts.worker.userId),opened+1,'Opening the app is recorded for the signed-in user');
 // Signing out ends the Supabase session and the cleared cookie is passed back to the browser.
 const own=(await admin.query('SELECT azure_object_id FROM users WHERE user_id=$1',[accounts.external.userId])).rows[0].azure_object_id;
 await admin.query('UPDATE users SET azure_object_id=$2 WHERE user_id=$1',[accounts.external.userId,signIn('leaving')]);
 assert.equal((await request('leaving','/me')).status,200);
 const ended=await count('APP_SESSION_ENDED',accounts.external.userId);
 const out=await request('leaving','/auth/logout','POST');assert.equal(out.status,201);
 assert.match(out.headers.get('set-cookie')??'',/sb-session=;/);assert.equal(out.body.loginUrl,loginUrl());
 assert.equal((await request('leaving','/me')).status,401,'A signed-out session is not reused from the verification cache');
 assert.equal(await count('APP_SESSION_ENDED',accounts.external.userId),ended+1);
 await admin.query('UPDATE users SET azure_object_id=$2 WHERE user_id=$1',[accounts.external.userId,own]);
 // A signed-in account that is not linked can still sign out.
 signIn('stranger');assert.equal((await request('stranger','/auth/logout','POST')).status,201);
});
test('Microsoft linking is opt-in and links only one matching, unlinked employee email',async(t)=>{
 const previous=process.env.ENABLE_MICROSOFT_AUTO_LINK;
 t.after(()=>{if(previous===undefined)delete process.env.ENABLE_MICROSOFT_AUTO_LINK;else process.env.ENABLE_MICROSOFT_AUTO_LINK=previous;});
 delete process.env.ENABLE_MICROSOFT_AUTO_LINK;
 const [c1,d1]=(await admin.query(`SELECT u.user_id,u.employee_id FROM users u JOIN employees e USING(employee_id) JOIN teams t USING(team_id)
  WHERE u.azure_object_id IS NULL AND u.is_active AND t.team_code IN ('C','D') ORDER BY u.user_id`)).rows;
 assert.ok(d1,'Two unlinked C/D users exist');
 const setEmail=(user:any,email:string|null)=>admin.query('UPDATE employees SET email=$2 WHERE employee_id=$1',[user.employee_id,email]);
 const linkOf=async(user:any)=>(await admin.query('SELECT azure_object_id FROM users WHERE user_id=$1',[user.user_id])).rows[0].azure_object_id;
 await setEmail(c1,'shared@thainitrate.com');await setEmail(d1,'shared@thainitrate.com');
 signIn('shared',{email:'shared@thainitrate.com',provider:'azure'});
 assert.equal((await request('shared','/me')).status,403,'An email shared by two employees links nobody');
 assert.equal(await linkOf(c1),null);assert.equal(await linkOf(d1),null);
 await setEmail(c1,'c1@thainitrate.com');
 signIn('c1password',{email:'c1@thainitrate.com',provider:'email'});
 assert.equal((await request('c1password','/me')).status,403,'Only Microsoft 365 sign-ins link automatically');
 const id=signIn('c1',{email:'C1@ThaiNitrate.com',provider:'azure'});
 assert.equal((await request('c1','/me')).status,403,'Automatic linking is disabled by default');
 assert.equal(await linkOf(c1),null);
 process.env.ENABLE_MICROSOFT_AUTO_LINK='true';
 const me=await request('c1','/me');assert.equal(me.status,200,JSON.stringify(me.body));assert.equal(me.body.actor.userId,c1.user_id);
 assert.equal(await linkOf(c1),id);
 assert.equal((await admin.query("SELECT count(*)::int n FROM audit_logs WHERE action='IDENTITY_LINKED' AND user_id=$1",[c1.user_id])).rows[0].n,1);
 signIn('c1again',{email:'c1@thainitrate.com',provider:'azure'});
 assert.equal((await request('c1again','/me')).status,403,'An already-linked user is never taken over by another account');
 await admin.query('UPDATE users SET azure_object_id=NULL WHERE user_id=$1',[c1.user_id]);
 for(const user of [c1,d1]) await setEmail(user,null);
});
test('fresh request, first approval, month navigation and server restart preserve state',async()=>{
 const input=await swapInput('2026-10-08'),before=[...await assignments(),...await assignments('target')];
 const key=randomUUID(),r=await request('worker','/requests','POST',input,key);assert.equal(r.status,201);
 const replay=await request('worker','/requests','POST',input,key);assert.deepEqual(replay.body,r.body);
 const initial=r.body;const first=await approve('a',initial);assert.equal(first.status,201);assert.equal(first.body.status,'PENDING');
 const afterFirst=[...await assignments(),...await assignments('target')];
 for(const id of [input.assignmentId,input.targetAssignmentId]) {
  const old=before.find((x:any)=>x.assignment_id===id);
  const row=afterFirst.find((x:any)=>x.assignment_id===id);assert.ok(row);assert.equal(row.shift_type_id,old.shift_type_id);assert.equal(row.version,old.version);
 }
 await request('b','/schedules?month=2026-11');
 await app.close();app=await start();
 const refreshed=await request('b','/requests');assert.equal(refreshed.body.find((x:any)=>x.request_id===initial.requestId).version,2);
 const done=await approve('b',{...initial,version:2});assert.equal(done.status,201);assert.equal(done.body.status,'APPROVED');
 const a=(await assignments()).find((x:any)=>x.assignment_id===input.assignmentId),b=(await assignments('target')).find((x:any)=>x.assignment_id===input.targetAssignmentId);
 assert.equal(a.shift_code,'M');assert.equal(b.shift_code,'N');assert.equal(a.work_date,'2026-10-08');assert.equal(a.version,2);
 const shared=(await request('hr','/schedules?month=2026-10')).body;assert.equal(shared.assignments.find((x:any)=>x.assignment_id===a.assignment_id).shift_code,a.shift_code);
 const audit=await request('worker','/audit');const applied=audit.body.find((x:any)=>x.action==='SCHEDULE_SWAP_APPLIED');assert.ok(applied.user_id);assert.match(applied.created_at,/Z$/);assert.equal(applied.old_value.source.work_date,'2026-10-08');assert.equal(applied.new_value.source.version,2);
 assert.equal((await approve('b',{...initial,version:3})).status,409);
});
test('employee, HR, Manager, External and out-of-order approver cannot decide',async()=>{
 const r=await create('2026-10-11');
 for(const role of ['worker','hr','manager','external','b','c','d'])assert.equal((await approve(role,r)).status,403);
 const manager=await request('manager','/requests');assert.equal(manager.status,200);assert.equal(manager.body.find((x:any)=>x.request_id===r.requestId).canDecide,false);
 assert.equal((await request('target','/audit')).body.some((x:any)=>x.entity_id===r.requestId&&x.entity_type==='REQUEST'),false);
});
test('rejection requires reason and changes neither assignment',async()=>{
 const r=await create('2026-10-12'),input=await swapInput('2026-10-12');
 assert.equal((await request('a',`/requests/${r.requestId}/decisions`,'POST',{decision:'REJECT',expectedVersion:1,reason:''},randomUUID())).status,400);
 const denied=await request('a',`/requests/${r.requestId}/decisions`,'POST',{decision:'REJECT',expectedVersion:1,reason:'ไม่พร้อมในวันทดสอบ'},randomUUID());assert.equal(denied.body.status,'REJECTED');
 assert.equal((await swapInput('2026-10-12')).assignmentVersion,input.assignmentVersion);
 assert.equal((await approve('a',{...r,version:2})).status,409);
});
test('double submission and concurrent identical approvals apply one logical operation',async()=>{
 const input=await swapInput('2026-10-15'),key=randomUUID();
 const creates=await Promise.all([request('worker','/requests','POST',input,key),request('worker','/requests','POST',input,key)]);
 assert.deepEqual(creates[0].body,creates[1].body);assert.equal(creates[0].status,201);
 assert.equal((await request('worker','/requests','POST',input,randomUUID())).status,409);
 const record=creates[0].body,decisionKey=randomUUID();const decisions=await Promise.all([approve('a',record,decisionKey),approve('a',record,decisionKey)]);
 assert.deepEqual(decisions[0].body,decisions[1].body);
 const count=(await admin.query("SELECT count(*)::int n FROM audit_logs WHERE action='REQUEST_APPROVED' AND entity_id=$1",[record.requestId])).rows[0].n;assert.equal(count,1);
 assert.equal((await approve('a',record)).status,409);
 const finals=await Promise.all([approve('b',{...record,version:2}),approve('b',{...record,version:2})]);
 assert.deepEqual(finals.map(r=>r.status).sort(),[201,409]);
 assert.equal((await swapInput('2026-10-15')).assignmentVersion,2);
 assert.equal((await admin.query("SELECT count(*)::int n FROM audit_logs WHERE action='SCHEDULE_SWAP_APPLIED' AND entity_id=$1",[record.requestId])).rows[0].n,1);
});
test('changed assignment or stale request version cannot overwrite a newer schedule',async()=>{
 const r=await create('2026-10-16'),input=await swapInput('2026-10-16');
 assert.equal((await approve('a',{...r,version:99})).status,409);
 await admin.query('UPDATE shift_assignments SET version=version+1 WHERE assignment_id=$1',[input.assignmentId]);
 assert.equal((await approve('a',r)).status,409);
 const list=await request('worker','/requests');assert.equal(list.body.find((x:any)=>x.request_id===r.requestId).hasConflict,true);
 const fresh=await create('2026-10-16');assert.notEqual(fresh.requestId,r.requestId);
});
test('failure halfway through final application rolls back both assignments, approval and audit',async()=>{
 const r=await create('2026-10-19'),input=await swapInput('2026-10-19');const first=await approve('a',r);assert.equal(first.status,201);
 await admin.query(`CREATE FUNCTION fail_test_assignment() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.assignment_id=${input.targetAssignmentId} THEN RAISE EXCEPTION 'injected failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER test_failure BEFORE UPDATE ON shift_assignments FOR EACH ROW EXECUTE FUNCTION fail_test_assignment();`);
 try {
  const done=await approve('b',{...r,version:2});assert.equal(done.status,500);
  const rolledBack=await swapInput('2026-10-19');assert.equal(rolledBack.assignmentVersion,1);assert.equal(rolledBack.targetVersion,1);
  assert.equal((await admin.query('SELECT status FROM approvals WHERE request_id=$1 AND approver_level=2',[r.requestId])).rows[0].status,'PENDING');
  assert.equal((await admin.query("SELECT count(*)::int n FROM audit_logs WHERE entity_id=$1 AND action='SCHEDULE_SWAP_APPLIED'",[r.requestId])).rows[0].n,0);
 } finally {await admin.query('DROP TRIGGER test_failure ON shift_assignments; DROP FUNCTION fail_test_assignment()');}
 assert.equal((await approve('b',{...r,version:2})).body.status,'APPROVED');
});
test('cross-month seventh working day is rejected by server validation',async()=>{
 await admin.query("UPDATE shift_assignments SET shift_type_id=(SELECT shift_type_id FROM shift_types WHERE shift_code='M') WHERE employee_id=$1 AND work_date BETWEEN '2026-09-25' AND '2026-09-30'",[accounts.worker.employeeId]);
 const own=(await assignments('worker','2026-10')).find((x:any)=>x.employee_id===accounts.worker.employeeId&&x.work_date==='2026-10-01');
 const target=(await assignments('target','2026-10')).find((x:any)=>x.employee_id===accounts.target.employeeId&&x.work_date==='2026-10-01');
 await admin.query("UPDATE shift_assignments SET shift_type_id=(SELECT shift_type_id FROM shift_types WHERE shift_code='M') WHERE assignment_id=$1",[target.assignment_id]);
 const check=await request('worker','/swap/validate','POST',{assignmentId:own.assignment_id,targetAssignmentId:target.assignment_id,assignmentVersion:own.version,targetVersion:target.version});
 assert.equal(check.status,201);assert.equal(check.body.valid,false);assert.ok(check.body.checks.some((x:any)=>x.rule.startsWith('MAX_SIX_DAYS')&&x.status==='FAIL'));
});
test('runtime role and triggers protect evidence; retention below baseline blocks startup',async()=>{
 const runtime=new Pool({connectionString:process.env.DATABASE_URL});
 try {await assert.rejects(runtime.query('UPDATE audit_logs SET action=action'));await assert.rejects(runtime.query('DELETE FROM audit_logs'));await assert.rejects(admin.query('UPDATE audit_logs SET action=action'));}
 finally {await runtime.end();}
 const previous=process.env.AUDIT_RETENTION_DAYS;process.env.AUDIT_RETENTION_DAYS='89';
 try {await assert.rejects(start(),/at least 90/);}finally {process.env.AUDIT_RETENTION_DAYS=previous;}
});

test('seven-account database upgrades to nine profiles without losing data; migration and seed repeat safely',async()=>{
 const snapshot=async()=>({
  users:(await admin.query('SELECT user_id,employee_id,role_id FROM users ORDER BY user_id')).rows,
  schedules:(await admin.query('SELECT schedule_id,version FROM schedules ORDER BY schedule_id')).rows,
  assignments:(await admin.query('SELECT assignment_id,shift_type_id,version FROM shift_assignments ORDER BY assignment_id')).rows,
  requests:(await admin.query('SELECT * FROM requests ORDER BY request_id')).rows,
  audit:(await admin.query('SELECT * FROM audit_logs ORDER BY audit_id')).rows
 });
 // Recreate the previous profile constraint to exercise an actual in-place upgrade.
 await admin.query("UPDATE users SET demo_profile=NULL,demo_order=NULL WHERE demo_profile IN ('supervisor-c','supervisor-d')");
 await admin.query('ALTER TABLE users DROP CONSTRAINT users_demo_order_check; ALTER TABLE users ADD CONSTRAINT users_demo_order_check CHECK (demo_order BETWEEN 1 AND 7)');
 await admin.query("DELETE FROM schema_migrations WHERE name='003_four_team_demo.sql'");
 const before=await snapshot();await migrate();await seed();await seed();await migrate();assert.deepEqual(await snapshot(),before);
 const available=(await admin.query(`SELECT u.demo_order,r.role_name AS role,t.team_code AS team FROM users u JOIN roles r USING(role_id)
  LEFT JOIN employees e USING(employee_id) LEFT JOIN teams t USING(team_id) WHERE u.demo_order IS NOT NULL ORDER BY u.demo_order`)).rows;
 assert.deepEqual(available.map((x:any)=>x.demo_order),[1,2,3,4,5,6,7,8,9]);
 assert.deepEqual(available.filter((x:any)=>x.role==='EMPLOYEE').map((x:any)=>x.team),['A','B']);
 assert.deepEqual(available.filter((x:any)=>x.role==='SUPERVISOR').map((x:any)=>x.team),['A','B','C','D']);
 assert.equal((await admin.query('SELECT count(*)::int n FROM users WHERE azure_object_id IS NOT NULL')).rows[0].n,9,'Migrate and seed keep Supabase links');
 for(const role of ['manager','external']){const me=await request(role,'/me');assert.equal(me.status,200);assert.equal(me.body.actor.employeeId,null);assert.equal(me.body.actor.teamId,null);}
 for(const team of ['C','D']){
  const hidden=(await admin.query('SELECT azure_object_id FROM users JOIN employees USING(employee_id) WHERE employee_code=$1',[`DEMO-${team}1`])).rows[0];
  assert.equal(hidden.azure_object_id,null,'C/D employees have no linked login');
  assert.equal((await request(team.toLowerCase(),'/me')).status,200,'Existing C/D supervisor identities are now selectable');
 }
 assert.ok((await request('manager','/audit')).body.some((x:any)=>x.action==='APP_SESSION_OPENED'&&x.actor_name==='ผู้จัดการทดสอบ'));
});

test('all scheduling readers see A-D; External APIs are denied; HR hides unpublished schedules',async()=>{
 for(const role of ['worker','target','a','b','c','d','manager','hr']){
  const result=await request(role,'/schedules?month=2026-10');assert.equal(result.status,200);
  assert.equal(result.body.scope,'ORGANIZATION');assert.deepEqual([...new Set(result.body.assignments.map((x:any)=>x.team_code))],['A','B','C','D']);
  assert.equal(result.body.assignments.some((x:any)=>'phone' in x||'email' in x),false);
 }
 for(const path of ['/schedules?month=2026-10','/employees','/requests','/audit','/swap/candidates?assignmentId=1'])assert.equal((await request('external',path)).status,403);
 await admin.query("UPDATE schedules SET status='DRAFT' WHERE month=11 AND year=2026");
 try {const hr=await request('hr','/schedules?month=2026-11');assert.equal(hr.body.schedule,null);assert.deepEqual(hr.body.assignments,[]);}
 finally {await admin.query("UPDATE schedules SET status='PUBLISHED' WHERE month=11 AND year=2026");}
});

test('candidates cover every other team while identical shifts, positions and assignment ownership remain enforced',async()=>{
 for(const [source,expected] of [['worker',['B','C','D']],['target',['A','C','D']]] as const){
  const {input}=await teamSwapInput('2026-11-20',source,'D');
  const result=await request(source,`/swap/candidates?assignmentId=${input.assignmentId}`);assert.equal(result.status,200);
  assert.deepEqual([...new Set(result.body.candidates.map((x:any)=>x.team_code))],expected);
  assert.ok(result.body.candidates.every((x:any)=>x.position==='FIELD_OPERATOR'));
 }
 const {input,a}=await teamSwapInput('2026-11-20','worker','C');
 const validation=await request('worker','/swap/validate','POST',input);assert.equal(validation.status,201);assert.equal(validation.body.valid,false);
 assert.ok(validation.body.checks.some((x:any)=>x.rule==='DIFFERENT_SHIFT'&&x.status==='FAIL'));
 assert.equal((await request('worker','/requests','POST',input,randomUUID())).status,400,'Equal shifts are not accepted');
 const supervisor=(await assignments('worker','2026-11')).find((x:any)=>x.employee_id===accounts.d.employeeId&&x.work_date===a.work_date);
 const wrongPosition={...input,targetAssignmentId:supervisor.assignment_id,targetVersion:supervisor.version};
 const position=await request('worker','/swap/validate','POST',wrongPosition);assert.ok(position.body.checks.some((x:any)=>x.rule==='POSITION'&&x.status==='FAIL'));
 assert.equal((await request('worker','/requests','POST',wrongPosition,randomUUID())).status,400);
 assert.equal((await request('target','/requests','POST',input,randomUUID())).status,403,'Another account cannot submit the source assignment');
});

test('reverse B-to-A request requires B first and A second',async()=>{
 const input=await swapInput('2026-11-04','target','worker');
 const created=await request('target','/requests','POST',input,randomUUID());assert.equal(created.status,201);
 assert.equal((await approve('a',created.body)).status,403);
 assert.equal((await approve('b',created.body)).body.status,'PENDING');
 assert.equal((await approve('a',{...created.body,version:2})).body.status,'APPROVED');
 const list=(await request('target','/requests')).body.find((x:any)=>x.request_id===created.body.requestId);
 assert.deepEqual(list.approvals.map((x:any)=>x.approver_id),[accounts.b.userId,accounts.a.userId]);
});

test('legacy A/B snapshots without team codes retain payload and can finish approval',async()=>{
 const created=await create('2026-11-17');
 await admin.query("UPDATE change_requests SET snapshot=snapshot #- '{source,team_code}' #- '{target,team_code}' WHERE request_id=$1",[created.requestId]);
 const snapshot=(await admin.query('SELECT snapshot FROM change_requests WHERE request_id=$1',[created.requestId])).rows[0].snapshot;
 const listed=(await request('a','/requests')).body.find((r:any)=>r.request_id===created.requestId);
 assert.equal(listed.demoSupported,true);assert.equal(listed.canDecide,true);assert.deepEqual(listed.snapshot,snapshot);
 const first=await approve('a',created);assert.equal(first.status,201);
 const second=await approve('b',first.body);assert.equal(second.status,201);assert.equal(second.body.status,'APPROVED');
 assert.deepEqual((await admin.query('SELECT snapshot FROM change_requests WHERE request_id=$1',[created.requestId])).rows[0].snapshot,snapshot);
});

test('A-to-D and B-to-C swaps require the two assigned supervisors and apply once atomically',async()=>{
 for(const [source,team,date,first,last] of [['worker','D','2026-11-20','a','d'],['target','C','2026-11-24','b','c']]) {
  const {input,a,b}=await teamSwapInput(date,source,team);
  const created=await request(source,'/requests','POST',input,randomUUID());assert.equal(created.status,201,JSON.stringify(created.body));
  const record=created.body;
  const listed=(await request(first,'/requests')).body.find((r:any)=>r.request_id===record.requestId);
  assert.equal(listed.demoSupported,true);assert.deepEqual(listed.approvals.map((step:any)=>step.approver_id),[accounts[first].userId,accounts[last].userId]);
  assert.equal((await approve(last,record)).status,403,'Target supervisor cannot approve first');
  for(const role of ['worker','target','manager','hr','external',...['a','b','c','d'].filter(role=>![first,last].includes(role))])assert.equal((await approve(role,record)).status,403);
  for(const role of ['a','b','c','d'].filter(role=>![first,last].includes(role)))assert.equal((await request(role,'/requests')).body.some((r:any)=>r.request_id===record.requestId),false,'Unrelated supervisor cannot read the request');
  const initial=await approve(first,record);assert.equal(initial.status,201);assert.equal(initial.body.status,'PENDING');
  for(const old of [a,b])assert.deepEqual((await assignments(source,'2026-11')).find((r:any)=>r.assignment_id===old.assignment_id),old,'First approval does not change an assignment');
  const key=randomUUID();const done=await approve(last,initial.body,key);assert.equal(done.status,201);assert.equal(done.body.status,'APPROVED');
  assert.deepEqual((await approve(last,initial.body,key)).body,done.body,'Repeated final approval returns its receipt');
  assert.equal((await approve(last,initial.body)).status,409,'Stale decision has no extra effect');
  const after=await assignments(source,'2026-11'),second=await assignments(last,'2026-11');
  for(const [own,incoming] of [[a,b],[b,a]]){
   const next=after.find((r:any)=>r.assignment_id===own.assignment_id);
   assert.equal(next.shift_type_id,incoming.shift_type_id);assert.equal(next.work_date,date);assert.equal(next.version,own.version+1);
   assert.deepEqual(second.find((r:any)=>r.assignment_id===own.assignment_id),next);
  }
  const audits=(await request(source,'/audit?view=activity')).body.filter((event:any)=>event.entity_id===record.requestId);
  assert.equal(audits.filter((event:any)=>event.action==='REQUEST_APPROVED').length,2);
  const applied=audits.filter((event:any)=>event.action==='SCHEDULE_SWAP_APPLIED');assert.equal(applied.length,1);assert.equal(applied[0].user_id,accounts[last].userId);
  assert.deepEqual(applied[0].old_value.source,a);assert.deepEqual(applied[0].old_value.target,b);
  assert.equal(applied[0].new_value.target.version,b.version+1);
  assert.ok((await request(last,'/notifications')).body.some((n:any)=>n.request_id===record.requestId),'Target supervisor gets the approval notification');
 }
});

test('legacy C/D snapshots with both approval steps remain valid without rewriting their payload',async()=>{
 const {input}=await teamSwapInput('2026-11-12','target','C');
 const created=await request('target','/requests','POST',input,randomUUID());assert.equal(created.status,201);
 await admin.query("UPDATE change_requests SET snapshot=snapshot #- '{source,team_code}' #- '{target,team_code}' WHERE request_id=$1",[created.body.requestId]);
 const snapshot=(await admin.query('SELECT snapshot FROM change_requests WHERE request_id=$1',[created.body.requestId])).rows[0].snapshot;
 const listed=(await request('c','/requests')).body.find((r:any)=>r.request_id===created.body.requestId);
 assert.equal(listed.demoSupported,true);assert.equal(listed.canDecide,false);
 const first=await approve('b',created.body);assert.equal(first.status,201);
 const last=await approve('c',first.body);assert.equal(last.status,201);assert.equal(last.body.status,'APPROVED');
 assert.deepEqual((await admin.query('SELECT snapshot FROM change_requests WHERE request_id=$1',[created.body.requestId])).rows[0].snapshot,snapshot);
});

test('incomplete legacy approval routes cannot apply a C/D swap with a single decision',async()=>{
 const {input,a,b}=await teamSwapInput('2026-11-13','target','C');
 const record={requestId:(await admin.query("INSERT INTO requests(requester_id,request_type,status) VALUES($1,'SWAP','PENDING') RETURNING request_id",[accounts.target.employeeId])).rows[0].request_id,version:1};
 await admin.query('INSERT INTO change_requests(request_id,assignment_id,target_employee_id,target_assignment_id,snapshot) VALUES($1,$2,$3,$4,$5)',[record.requestId,input.assignmentId,b.employee_id,input.targetAssignmentId,JSON.stringify({source:a,target:b,requestVersion:1})]);
 await admin.query("INSERT INTO approvals(request_id,approver_id,approver_level,status) VALUES($1,$2,1,'PENDING')",[record.requestId,accounts.b.userId]);
 const listed=(await request('b','/requests')).body.find((r:any)=>r.request_id===record.requestId);
 assert.equal(listed.approvalRouteConfirmed,false);assert.equal(listed.canDecide,false);
 const rejected=await approve('b',record);assert.equal(rejected.status,409);assert.equal(rejected.body.code,'APPROVER_UNRESOLVED');
 assert.equal((await teamSwapInput('2026-11-13','target','C')).input.assignmentVersion,input.assignmentVersion);
 assert.equal((await teamSwapInput('2026-11-13','target','C')).input.targetVersion,input.targetVersion);
 assert.equal((await admin.query("SELECT count(*)::int n FROM audit_logs WHERE entity_id=$1 AND action IN ('REQUEST_APPROVED','SCHEDULE_SWAP_APPLIED')",[record.requestId])).rows[0].n,0);
});

test('a swap into C still blocks a seventh consecutive working day across the month boundary',async()=>{
 const {input,b}=await teamSwapInput('2026-10-01','target','C');
 const before=(await admin.query("SELECT assignment_id,shift_type_id FROM shift_assignments WHERE employee_id=$1 AND work_date BETWEEN '2026-09-25' AND '2026-09-30'",[b.employee_id])).rows;
 try {
  await admin.query("UPDATE shift_assignments SET shift_type_id=(SELECT shift_type_id FROM shift_types WHERE shift_code='M') WHERE employee_id=$1 AND work_date BETWEEN '2026-09-25' AND '2026-09-30'",[b.employee_id]);
  const validation=await request('target','/swap/validate','POST',input);assert.equal(validation.status,201);assert.equal(validation.body.valid,false);
  assert.ok(validation.body.checks.some((check:any)=>check.rule===`MAX_SIX_DAYS_${b.employee_id}`&&check.status==='FAIL'));
  const created=await request('target','/requests','POST',input,randomUUID());assert.equal(created.status,400);assert.equal(created.body.code,'VALIDATION_FAILED');
 }finally {for(const row of before)await admin.query('UPDATE shift_assignments SET shift_type_id=$1 WHERE assignment_id=$2',[row.shift_type_id,row.assignment_id]);}
});

test('all table readers get minimal applied-swap provenance, but pending, first-approved, rejected and unpublished cells do not',async()=>{
 const record=(await request('worker','/requests')).body.find((r:any)=>r.snapshot.source.work_date==='2026-10-08');
 for(const role of ['worker','target','a','b','c','d','manager','hr']) {
  const rows=await assignments(role);
  for(const [side,other] of [['source','target'],['target','source']]) {
   const own=record.snapshot[side],partner=record.snapshot[other],row=rows.find((r:any)=>r.assignment_id===own.assignment_id);
   assert.ok(row.swap);assert.equal(row.swap.requestId,record.request_id);assert.match(row.swap.appliedAt,/Z$/);
   assert.equal(row.swap.originalShiftCode,own.shift_code);assert.equal(row.swap.receivedShiftCode,partner.shift_code);
   assert.deepEqual(row.swap.partner,{employeeId:partner.employee_id,name:partner.name,teamCode:partner.team_code,teamName:partner.team_name});
   assert.deepEqual(Object.keys(row.swap).sort(),['appliedAt','originalShiftCode','partner','receivedShiftCode','requestId']);
  }
  for(const date of ['2026-10-11','2026-10-12'])assert.equal(rows.find((r:any)=>r.employee_id===accounts.worker.employeeId&&r.work_date===date).swap,undefined);
 }
 assert.equal((await request('c','/requests')).body.some((r:any)=>r.request_id===record.request_id),false,'Showing minimal table provenance does not grant request access');
 assert.equal((await request('c','/audit')).body.some((r:any)=>r.entity_type==='REQUEST'&&r.entity_id===record.request_id),false,'Raw audit access is unchanged');
 const {input,a,b}=await teamSwapInput('2026-11-28','worker','D');
 const created=await request('worker','/requests','POST',input,randomUUID());assert.equal(created.status,201);
 const initial=await approve('a',created.body);assert.equal(initial.status,201);
 for(const old of [a,b])assert.equal((await assignments('manager','2026-11')).find((r:any)=>r.assignment_id===old.assignment_id).swap,undefined);
 const denied=await request('d',`/requests/${created.body.requestId}/decisions`,'POST',{decision:'REJECT',expectedVersion:2,reason:'ทดสอบปฏิเสธหลังอนุมัติฝ่ายแรก'},randomUUID());assert.equal(denied.body.status,'REJECTED');
 for(const old of [a,b])assert.equal((await assignments('manager','2026-11')).find((r:any)=>r.assignment_id===old.assignment_id).swap,undefined);
 await admin.query("UPDATE schedules SET status='DRAFT' WHERE month=11 AND year=2026");
 try {const hidden=await request('hr','/schedules?month=2026-11');assert.equal(hidden.body.schedule,null);assert.deepEqual(hidden.body.assignments,[]);}
 finally {await admin.query("UPDATE schedules SET status='PUBLISHED' WHERE month=11 AND year=2026");}
 assert.equal((await request('external','/schedules?month=2026-10')).status,403);
});

test('repeat swaps show the latest applied partner; unchanged counterpart and protected evidence remain accurate',async()=>{
 const {input,a}=await teamSwapInput('2026-11-20','worker','C');
 assert.equal(a.swap.partner.teamCode,'D');
 const oldD=(await assignments('manager','2026-11')).find((r:any)=>r.employee_code==='DEMO-D1'&&r.work_date==='2026-11-20');
 const created=await request('worker','/requests','POST',input,randomUUID());assert.equal(created.status,201);
 const first=await approve('a',created.body);assert.equal(first.status,201);
 assert.equal((await assignments('manager','2026-11')).find((r:any)=>r.assignment_id===a.assignment_id).swap.requestId,a.swap.requestId,'A pending repeat still shows the currently applied swap');
 const last=await approve('c',first.body);assert.equal(last.body.status,'APPROVED');
 const rows=await assignments('hr','2026-11'),current=rows.find((r:any)=>r.assignment_id===a.assignment_id);
 assert.equal(current.swap.requestId,created.body.requestId);assert.equal(current.swap.partner.teamCode,'C');assert.equal(current.swap.originalShiftCode,a.shift_code);assert.equal(current.swap.receivedShiftCode,current.shift_code);
 assert.deepEqual(rows.find((r:any)=>r.assignment_id===oldD.assignment_id).swap,oldD.swap,'D still retains the origin of its own current shift');
 await app.close();app=await start();
 assert.deepEqual((await assignments('c','2026-11')).find((r:any)=>r.assignment_id===a.assignment_id).swap,current.swap,'Restart preserves the derived provenance');
 await admin.query('UPDATE shift_assignments SET version=version+1 WHERE assignment_id=$1',[a.assignment_id]);
 assert.equal((await assignments('manager','2026-11')).find((r:any)=>r.assignment_id===a.assignment_id).swap,undefined,'A later version cannot inherit an old swap marker');
 await admin.query('UPDATE shift_assignments SET version=$1,shift_type_id=$2 WHERE assignment_id=$3',[current.version,a.shift_type_id,a.assignment_id]);
 assert.equal((await assignments('manager','2026-11')).find((r:any)=>r.assignment_id===a.assignment_id).swap,undefined,'A different shift cannot inherit an old swap marker even with the same version');
 await admin.query('UPDATE shift_assignments SET shift_type_id=$1 WHERE assignment_id=$2',[current.shift_type_id,a.assignment_id]);
 assert.deepEqual((await assignments('manager','2026-11')).find((r:any)=>r.assignment_id===a.assignment_id).swap,current.swap);
 assert.equal((await admin.query("SELECT count(*)::int n FROM audit_logs WHERE action='SCHEDULE_SWAP_APPLIED' AND entity_id=ANY($1::int[])",[[a.swap.requestId,created.body.requestId]])).rows[0].n,2,'Neither provenance read nor version matching rewrites audit');
});

test('activity history filters before pagination, keeps technical audit and preserves request scope',async()=>{
 const count=(await admin.query('SELECT count(*)::int AS n FROM audit_logs')).rows[0].n;
 await admin.query("INSERT INTO audit_logs(user_id,action,entity_type,entity_id) SELECT $1,'SCHEDULE_VIEWED','USER',$1 FROM generate_series(1,110)",[accounts.worker.userId]);
 const history=await request('worker','/audit?view=activity');assert.equal(history.status,200);assert.ok(history.body.length>0);
 const ownIds=new Set((await request('worker','/requests')).body.map((r:any)=>r.request_id));
 for(const event of history.body){assert.equal(event.entity_type,'REQUEST');assert.ok(ownIds.has(event.entity_id));assert.ok(['REQUEST_SUBMITTED','REQUEST_APPROVED','REQUEST_REJECTED','SCHEDULE_SWAP_APPLIED'].includes(event.action));}
 const raw=await request('worker','/audit');assert.equal(raw.body.length,100);assert.ok(raw.body.every((r:any)=>r.action==='SCHEDULE_VIEWED'));
 assert.equal((await admin.query('SELECT count(*)::int AS n FROM audit_logs')).rows[0].n,count+110,'Reading activity must not delete or rewrite audit');
 assert.equal((await request('external','/audit?view=activity')).status,403);
});

test('personal history contains only the signed-in actor business actions before pagination',async()=>{
 const before=(await admin.query('SELECT * FROM audit_logs ORDER BY audit_id')).rows;
 for(const role of ['worker','target','a','b']) {
  const result=await request(role,'/audit?view=personal');assert.equal(result.status,200);assert.ok(result.body.length>0);
  for(const event of result.body){assert.equal(event.user_id,accounts[role].userId);assert.equal(event.entity_type,'REQUEST');assert.ok(['REQUEST_SUBMITTED','REQUEST_APPROVED','REQUEST_REJECTED'].includes(event.action));}
  if(['worker','target'].includes(role))assert.ok(result.body.every((event:any)=>event.action==='REQUEST_SUBMITTED'));
 }
 const forged=await request('worker',`/audit?view=personal&userId=${accounts.target.userId}`);
 assert.ok(forged.body.every((event:any)=>event.user_id===accounts.worker.userId),'Query parameters cannot choose another account history');
 assert.equal((await request('external','/audit?view=personal')).status,403);
 const after=(await admin.query('SELECT * FROM audit_logs WHERE audit_id=ANY($1::int[]) ORDER BY audit_id',[before.map(event=>event.audit_id)])).rows;
 assert.deepEqual(after,before,'Personal history never removes or rewrites the underlying audit evidence; renewed sessions may add new access events');
});

test('requester cancellation is persistent, idempotent, audited and leaves both schedules and approval evidence intact',async()=>{
 const record=await create('2026-09-01'),input=await swapInput('2026-09-01');
 const original=(await admin.query('SELECT * FROM change_requests WHERE request_id=$1',[record.requestId])).rows[0];
 const steps=(await admin.query('SELECT * FROM approvals WHERE request_id=$1 ORDER BY approver_level',[record.requestId])).rows;
 const before=await request('worker','/schedules?month=2026-09');
 assert.equal((await request('worker','/requests')).body.find((r:any)=>r.request_id===record.requestId).canCancel,true);
 assert.equal((await request('a','/requests')).body.find((r:any)=>r.request_id===record.requestId).canCancel,false);
 const key=randomUUID(),results=await Promise.all([cancel('worker',record,key),cancel('worker',record,key)]);
 assert.deepEqual(results.map(r=>r.status),[201,201]);assert.deepEqual(results[0].body,results[1].body);
 assert.deepEqual(results[0].body,{requestId:record.requestId,status:'CANCELLED',version:2});
 const after=await request('worker','/schedules?month=2026-09');assert.deepEqual(after.body,before.body);
 assert.deepEqual((await admin.query('SELECT * FROM change_requests WHERE request_id=$1',[record.requestId])).rows[0],original);
 assert.deepEqual((await admin.query('SELECT * FROM approvals WHERE request_id=$1 ORDER BY approver_level',[record.requestId])).rows,steps);
 const events=(await admin.query("SELECT * FROM audit_logs WHERE entity_id=$1 AND action='REQUEST_CANCELLED'",[record.requestId])).rows;
 assert.equal(events.length,1);assert.equal(events[0].user_id,accounts.worker.userId);assert.ok(events[0].created_at instanceof Date);
 assert.deepEqual(events[0].old_value,{status:'PENDING',requestVersion:1});
 assert.deepEqual(events[0].new_value,{status:'CANCELLED',requestVersion:2,workDate:'2026-09-01',assignmentId:input.assignmentId,targetAssignmentId:input.targetAssignmentId});
 assert.equal((await admin.query("SELECT count(*)::int n FROM notifications WHERE request_id=$1 AND title='คำขอถูกยกเลิก' AND user_id=$2",[record.requestId,accounts.a.userId])).rows[0].n,1);
 const personal=await request('worker','/audit?view=personal');assert.ok(personal.body.some((e:any)=>e.audit_id===events[0].audit_id));
 assert.ok((await request('a','/audit?view=activity')).body.some((e:any)=>e.audit_id===events[0].audit_id));
 for(const role of ['target','c','d','manager','hr'])assert.equal((await request(role,'/audit?view=activity')).body.some((e:any)=>e.audit_id===events[0].audit_id),false);
 await migrate();await seed();await migrate();await app.close();app=await start();
 const persisted=(await request('worker','/requests')).body.find((r:any)=>r.request_id===record.requestId);
 assert.equal(persisted.status,'CANCELLED');assert.equal(persisted.canCancel,false);assert.equal(persisted.canDecide,false);
 assert.deepEqual((await cancel('worker',record,key)).body,results[0].body,'Receipt survives backend restart');
 assert.deepEqual((await admin.query("SELECT * FROM audit_logs WHERE entity_id=$1 AND action='REQUEST_CANCELLED'",[record.requestId])).rows,events);
 const fresh=await create('2026-09-01');assert.notEqual(fresh.requestId,record.requestId,'Cancelled requests do not block a corrected new request');
});

test('only the employee requester can cancel; origin, input, idempotency and expected version are enforced',async()=>{
 const record=await create('2026-09-05'),path=`/requests/${record.requestId}/cancel`;
 assert.equal((await request(undefined,path,'POST',{expectedVersion:1},randomUUID())).status,401);
 for(const role of ['target','a','b','c','d','manager','hr','external'])assert.equal((await cancel(role,record)).status,403);
 assert.equal((await request('worker',path,'POST',{expectedVersion:1})).status,400);
 for(const expectedVersion of [0,'1',null])assert.equal((await request('worker',path,'POST',{expectedVersion},randomUUID())).status,400);
 const stale=await cancel('worker',{...record,version:99});assert.equal(stale.status,409);assert.equal(stale.body.code,'VERSION_CONFLICT');
 assert.equal((await cancel('worker',{requestId:999999,version:1})).status,404);
 const cross=await fetch(`${base}/api${path}`,{method:'POST',headers:{Origin:'https://other.example',Cookie:cookies.worker,'Content-Type':'application/json','Idempotency-Key':randomUUID()},body:JSON.stringify({expectedVersion:1})});assert.equal(cross.status,403);
 const listed=(await request('worker','/requests')).body.find((r:any)=>r.request_id===record.requestId);assert.equal(listed.status,'PENDING');assert.equal(listed.version,1);assert.equal(listed.canCancel,true);
 assert.equal((await admin.query("SELECT count(*)::int n FROM audit_logs WHERE entity_id=$1 AND action='REQUEST_CANCELLED'",[record.requestId])).rows[0].n,0);
});

test('any confirmed first decision closes cancellation, including a pending second approval and rejected/approved requests',async()=>{
 const firstRecord=await create('2026-09-02');await request('a','/requests');
 assert.equal((await request('worker','/requests')).body.find((r:any)=>r.request_id===firstRecord.requestId).canCancel,true,'Reading the review queue does not close cancellation');
 const first=await approve('a',firstRecord);assert.equal(first.body.status,'PENDING');
 const blocked=await cancel('worker',first.body);assert.equal(blocked.status,409);assert.equal(blocked.body.code,'CANCELLATION_CLOSED');
 assert.equal((await cancel('worker',firstRecord)).status,409,'A stale employee screen cannot cancel a newly approved request');
 assert.equal((await request('worker','/requests')).body.find((r:any)=>r.request_id===firstRecord.requestId).canCancel,false);
 const final=await approve('b',first.body);assert.equal(final.body.status,'APPROVED');assert.equal((await cancel('worker',final.body)).status,409);
 const rejected=(await request('worker','/requests')).body.find((r:any)=>r.snapshot.source.work_date==='2026-10-12');
 assert.equal((await cancel('worker',{requestId:rejected.request_id,version:rejected.version})).status,409);
 assert.equal((await admin.query("SELECT count(*)::int n FROM audit_logs WHERE entity_id=ANY($1::int[]) AND action='REQUEST_CANCELLED'",[[firstRecord.requestId,rejected.request_id]])).rows[0].n,0);
});

test('cancelled requests cannot be approved from an already-open supervisor screen or cancelled twice',async()=>{
 const record=await create('2026-09-09'),key=randomUUID();
 const review=(await request('a','/requests')).body.find((r:any)=>r.request_id===record.requestId);assert.equal(review.canDecide,true);
 const done=await cancel('worker',record,key);assert.equal(done.status,201);
 assert.equal((await approve('a',record)).status,409);assert.equal((await approve('a',done.body)).status,409);
 assert.equal((await cancel('worker',done.body)).status,409);
 const reused=await cancel('worker',done.body,key);assert.equal(reused.status,409);assert.equal(reused.body.code,'KEY_REUSED');
 for(const role of ['worker','a','b','manager']) {
  const row=(await request(role,'/requests')).body.find((r:any)=>r.request_id===record.requestId);
  assert.equal(row.status,'CANCELLED');assert.equal(row.canDecide,false);assert.equal(row.canCancel,false);
 }
 assert.equal((await admin.query("SELECT count(*)::int n FROM audit_logs WHERE entity_id=$1 AND action IN ('REQUEST_APPROVED','SCHEDULE_SWAP_APPLIED')",[record.requestId])).rows[0].n,0);
});

test('concurrent cancellation and first approval have exactly one winner across A-to-D and B-to-C routes',async()=>{
 for(const [date,source,other,supervisor] of [['2026-09-13','worker','D','a'],['2026-09-14','target','C','b']]) {
  const {input}=await teamSwapInput(date,source,other);
  const created=await request(source,'/requests','POST',input,randomUUID());assert.equal(created.status,201);const record=created.body;
  const before=await request(source,'/schedules?month=2026-09');
  const results=await Promise.all([cancel(source,record),approve(supervisor,record)]);
  assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);
  const row=(await request(source,'/requests')).body.find((r:any)=>r.request_id===record.requestId);
  assert.equal(row.version,2);assert.equal(row.canCancel,false);
  if(row.status==='CANCELLED')assert.ok(row.approvals.every((s:any)=>s.status==='PENDING'));
  else {assert.equal(row.status,'PENDING');assert.deepEqual(row.approvals.map((s:any)=>s.status),['APPROVED','PENDING']);}
  assert.deepEqual((await request(source,'/schedules?month=2026-09')).body,before.body);
  assert.equal((await admin.query("SELECT count(*)::int n FROM audit_logs WHERE entity_id=$1 AND action IN ('REQUEST_CANCELLED','REQUEST_APPROVED')",[record.requestId])).rows[0].n,1);
 }
});

test('notification failure rolls back cancellation, audit and receipt, so the same operation can be retried safely',async()=>{
 const record=await create('2026-09-17'),key=randomUUID();
 await admin.query(`CREATE FUNCTION fail_test_cancel_notice() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.request_id=${record.requestId} AND NEW.title='คำขอถูกยกเลิก' THEN RAISE EXCEPTION 'injected cancellation failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER test_cancel_failure BEFORE INSERT ON notifications FOR EACH ROW EXECUTE FUNCTION fail_test_cancel_notice();`);
 try {
  assert.equal((await cancel('worker',record,key)).status,500);
  const row=(await request('worker','/requests')).body.find((r:any)=>r.request_id===record.requestId);assert.equal(row.status,'PENDING');assert.equal(row.version,1);assert.equal(row.canCancel,true);
  assert.equal((await admin.query("SELECT count(*)::int n FROM audit_logs WHERE entity_id=$1 AND action='REQUEST_CANCELLED'",[record.requestId])).rows[0].n,0);
  assert.equal((await admin.query('SELECT count(*)::int n FROM operation_receipts WHERE user_id=$1 AND operation_key=$2',[accounts.worker.userId,key])).rows[0].n,0);
 }finally{await admin.query('DROP TRIGGER test_cancel_failure ON notifications; DROP FUNCTION fail_test_cancel_notice()');}
 assert.equal((await cancel('worker',record,key)).body.status,'CANCELLED');
});

test('the local scheduling default enables central swap and HR month close without environment flags',async(t)=>{
 const date='2026-11-20';
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-10T12:00:00Z')});
 const legacy=await create(date);
 delete process.env.ENABLE_LOCAL_SWAP_POLICY;
 delete process.env.ENABLE_LOCAL_MONTH_CLOSE;
 t.after(()=>{
  process.env.ENABLE_LOCAL_SWAP_POLICY='false';
  process.env.ENABLE_LOCAL_MONTH_CLOSE='false';
 });
 assert.deepEqual((await request('worker','/me')).body.capabilities,
  {centralSwap:true,swapPolicy:true,hrClosedRoster:false,monthClose:true});
 assert.equal((await request('hr','/me')).body.capabilities.hrClosedRoster,true);
 assert.equal((await request('hr','/hr/closed-roster?month=2026-10')).status,200);
 assert.match((await request('a','/requests')).body.find((row:any)=>row.request_id===legacy.requestId).approvalBlockReason,/ยื่นคำขอใหม่/);
 assert.equal((await approve('a',legacy)).body.code,'SWAP_POLICY_RESUBMISSION_REQUIRED');
 assert.equal((await cancel('worker',legacy)).body.status,'CANCELLED');
 const current=await create(date);
 const row=(await request('b','/requests')).body.find((item:any)=>item.request_id===current.requestId);
 assert.equal(row.snapshot.approvalRoute,'TWO_SUPERVISORS');
 assert.equal(row.quota_month,'2026-11-01');
 assert.equal((await cancel('worker',current)).body.status,'CANCELLED');
});

test('final approval consumes one requester quota atomically and only one request can take the last slot',async(t)=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2090-12-01T12:00:00Z')});
 const previous=process.env.ENABLE_LOCAL_SWAP_POLICY;
 process.env.ENABLE_LOCAL_SWAP_POLICY='true';
 t.after(()=>{if(previous===undefined)delete process.env.ENABLE_LOCAL_SWAP_POLICY;else process.env.ENABLE_LOCAL_SWAP_POLICY=previous;});
 await admin.query(`INSERT INTO shiftflow_policy.swap_quota_limits(effective_month,monthly_limit)
  VALUES ('2090-11-01',3),('2090-12-01',2),('2091-01-01',4)`);
 const {rows:[schedule]}=await admin.query(
  "INSERT INTO schedules(month,year,status,created_by) VALUES(12,2090,'PUBLISHED',$1) RETURNING schedule_id",[accounts.a.userId]);
 const dates=['2090-12-04','2090-12-12','2090-12-20'];
 const extraDate='2090-12-27';
 await admin.query(`INSERT INTO shift_assignments(schedule_id,employee_id,shift_type_id,work_date,status,assigned_by)
  SELECT $1,side.employee_id,st.shift_type_id,dates.day,'ACTIVE',$2
  FROM unnest($3::date[]) AS dates(day)
  CROSS JOIN (VALUES ($4::int,'M'),($5::int,'N')) AS side(employee_id,code)
  JOIN shift_types st ON st.shift_code=side.code`,
  [schedule.schedule_id,accounts.a.userId,[...dates,extraDate],accounts.worker.employeeId,accounts.target.employeeId]);
 const preview=await request('worker','/swap/validate','POST',await swapInput(extraDate));
 assert.deepEqual(preview.body.quota,{month:'2090-12-01',limit:2,used:0,remaining:2});
 assert.ok(preview.body.checks.some((check:any)=>check.rule==='REQUEST_WINDOW'&&check.status==='PASS'&&check.label));
 assert.ok(preview.body.checks.some((check:any)=>check.rule==='REST_AFTER_NIGHT'&&check.status==='UNCONFIRMED'));
 assert.ok(preview.body.checks.some((check:any)=>check.rule==='ROTATION_PATTERN'&&check.status==='UNCONFIRMED'));
 const submitted=[];
 for(const date of dates) submitted.push(await create(date));
 const firstSteps=[];
 for(const item of submitted) {
  const first=await approve('a',item);
  assert.equal(first.status,201,JSON.stringify(first.body));
  assert.equal(first.body.status,'PENDING');
  firstSteps.push(first.body);
 }
 const finalKey=randomUUID();
 const usage=()=>admin.query(`
  SELECT requester_id,count(*)::int AS used FROM requests
  WHERE status='APPROVED' AND quota_month='2090-12-01' GROUP BY requester_id`);
 assert.deepEqual((await usage()).rows,[]);
 const beforeFailure=await assignments('worker','2090-12');
 await admin.query(`CREATE FUNCTION fail_test_quota_audit() RETURNS trigger LANGUAGE plpgsql AS $$
  BEGIN IF NEW.entity_type='REQUEST' AND NEW.entity_id=${submitted[0].requestId} AND NEW.action='REQUEST_APPROVED'
   THEN RAISE EXCEPTION 'injected quota approval failure'; END IF; RETURN NEW; END $$;
  CREATE TRIGGER test_quota_failure BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION fail_test_quota_audit();`);
 try {
  assert.equal((await approve('b',firstSteps[0],finalKey)).status,500);
  assert.deepEqual((await usage()).rows,[]);
  assert.deepEqual(await assignments('worker','2090-12'),beforeFailure);
 } finally {
  await admin.query('DROP TRIGGER test_quota_failure ON audit_logs; DROP FUNCTION fail_test_quota_audit()');
 }
 const firstFinal=await approve('b',firstSteps[0],finalKey);
 assert.equal(firstFinal.status,201,JSON.stringify(firstFinal.body));
 assert.equal(firstFinal.body.status,'APPROVED');
 assert.deepEqual((await approve('b',firstSteps[0],finalKey)).body,firstFinal.body);
 const before=await assignments('worker','2090-12');
 const race=await Promise.all(firstSteps.slice(1).map(item=>approve('b',item)));
 assert.deepEqual(race.map(result=>result.status).sort(),[201,409]);
 const loserIndex=race.findIndex(result=>result.status===409);
 const winnerIndex=1-loserIndex;
 assert.equal(race[loserIndex].body.code,'SWAP_QUOTA_EXHAUSTED');
 const [loser,winner]=[submitted[loserIndex+1],submitted[winnerIndex+1]];
 const rows=(await request('worker','/requests')).body;
 assert.equal(rows.find((row:any)=>row.request_id===loser.requestId).status,'PENDING');
 assert.equal(rows.find((row:any)=>row.request_id===winner.requestId).status,'APPROVED');
 const after=await assignments('worker','2090-12');
 const dayRows=(entries:any[],date:string)=>entries.filter(row=>row.work_date===date);
 assert.deepEqual(dayRows(after,dates[loserIndex+1]),dayRows(before,dates[loserIndex+1]));
 assert.deepEqual(dayRows(after,dates[winnerIndex+1]).map(row=>row.shift_code),['N','M']);
 assert.deepEqual((await usage()).rows,[{requester_id:accounts.worker.employeeId,used:2}]);
 const zero=await request('worker','/swap/validate','POST',await swapInput(extraDate));
 assert.equal(zero.body.valid,true);
 assert.deepEqual(zero.body.quota,{month:'2090-12-01',limit:2,used:2,remaining:0});
 const partnerQuota=await request('target','/swap/validate','POST',await swapInput(extraDate,'target','worker'));
 assert.equal(partnerQuota.body.quota.used,0);
 assert.equal((await create(extraDate)).status,'PENDING');
});

test('local swap policy uses submission time for expiry and closes pending swaps at Bangkok month end',async(t)=>{
 const previous=process.env.ENABLE_LOCAL_SWAP_POLICY;
 process.env.ENABLE_LOCAL_SWAP_POLICY='true';
 t.after(()=>{if(previous===undefined)delete process.env.ENABLE_LOCAL_SWAP_POLICY;else process.env.ENABLE_LOCAL_SWAP_POLICY=previous;});
 t.mock.timers.enable({apis:['Date'],now:new Date('2092-12-10T13:00:00Z')});
 const {rows:[schedule]}=await admin.query(
  "INSERT INTO schedules(month,year,status,created_by) VALUES(12,2092,'PUBLISHED',$1) RETURNING schedule_id",[accounts.a.userId]);
 const dates=['2092-12-10','2092-12-20','2092-12-31'];
 await admin.query(`INSERT INTO shift_assignments(schedule_id,employee_id,shift_type_id,work_date,status,assigned_by)
  SELECT $1,side.employee_id,st.shift_type_id,dates.day,'ACTIVE',$2
  FROM unnest($3::date[]) AS dates(day)
  CROSS JOIN (VALUES ($4::int,'N'),($5::int,'M')) AS side(employee_id,code)
  JOIN shift_types st ON st.shift_code=side.code`,
  [schedule.schedule_id,accounts.a.userId,dates,accounts.worker.employeeId,accounts.target.employeeId]);
 const tonight=await create(dates[0]);
 const later=await create(dates[1]);
 const tonightFirst=await approve('a',tonight);
 assert.equal(tonightFirst.status,201);
 const laterFirst=await approve('a',later);
 assert.equal(laterFirst.status,201);
 t.mock.timers.setTime(Date.parse('2092-12-10T17:30:00Z')); // 00:30 the next day in Bangkok
 const late=await request('worker','/requests','POST',await swapInput(dates[0]),randomUUID());
 assert.equal(late.status,409);
 assert.equal(late.body.code,'SWAP_SUBMISSION_LATE');
 const latePreview=await request('worker','/swap/validate','POST',await swapInput(dates[0]));
 assert.equal(latePreview.body.code,'SWAP_SUBMISSION_LATE');
 const afterMidnight=await approve('b',tonightFirst.body);
 assert.equal(afterMidnight.status,201,JSON.stringify(afterMidnight.body));
 assert.equal(afterMidnight.body.status,'APPROVED');
 t.mock.timers.setTime(Date.parse('2092-12-11T13:00:00Z')); // exactly 24 hours
 const expired=await approve('b',laterFirst.body);
 assert.equal(expired.status,409);
 assert.equal(expired.body.code,'REQUEST_EXPIRED');
 const expiredRow=(await request('b','/requests')).body.find((row:any)=>row.request_id===later.requestId);
 assert.equal(expiredRow.status,'EXPIRED');
 assert.equal(expiredRow.canDecide,false);
 assert.deepEqual(expiredRow.approvals.map((row:any)=>row.status),['APPROVED','PENDING']);
 const cancellable=await create(dates[1]); // The expired record cannot block a fresh eligible submission.
 const cancelKey=randomUUID();
 t.mock.timers.setTime(Date.parse('2092-12-12T12:59:59Z'));
 const blocker=await admin.connect();
 let cancellation:ReturnType<typeof request>|undefined;
 try {
  await blocker.query('BEGIN');
  await blocker.query('LOCK TABLE operation_receipts IN SHARE MODE');
  cancellation=request('worker',`/requests/${cancellable.requestId}/cancel`,'POST',
   {expectedVersion:cancellable.version},cancelKey);
  let waiting=false;
  for(let i=0;i<100&&!waiting;i++) {
   waiting=(await admin.query(`SELECT EXISTS (SELECT 1 FROM pg_stat_activity
    WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE 'INSERT INTO operation_receipts%') AS waiting`)).rows[0].waiting;
   if(!waiting) await new Promise(resolveDelay=>setTimeout(resolveDelay,25));
  }
  assert.equal(waiting,true,'Cancellation reached the final receipt write before expiry');
  t.mock.timers.setTime(Date.parse('2092-12-12T13:00:00Z'));
 } finally {
  await blocker.query('ROLLBACK');
  blocker.release();
 }
 const afterExpiry=await cancellation!;
 assert.equal(afterExpiry.status,409);
 assert.equal(afterExpiry.body.code,'REQUEST_EXPIRED');
 assert.equal((await request('worker','/requests')).body.find((row:any)=>row.request_id===cancellable.requestId).status,'EXPIRED');
 assert.equal((await admin.query('SELECT 1 FROM operation_receipts WHERE operation_key=$1',[cancelKey])).rowCount,0);
 t.mock.timers.setTime(Date.parse('2092-12-31T13:00:00Z'));
 const monthEnd=await create(dates[2]);
 const beforeClose=await assignments('worker','2092-12');
 t.mock.timers.setTime(Date.parse('2092-12-31T17:00:00Z')); // 00:00 Bangkok on January 1
 const closed=await approve('a',monthEnd);
 assert.equal(closed.status,409);
 assert.equal(closed.body.code,'SWAP_MONTH_CLOSED');
 const closedRow=(await request('worker','/requests')).body.find((row:any)=>row.request_id===monthEnd.requestId);
 assert.equal(closedRow.status,'MONTH_CLOSED');
 assert.equal(closedRow.canCancel,false);
 assert.deepEqual(await assignments('worker','2092-12'),beforeClose);
});

test('Bangkok month close blocks a legacy approval and HR exports exactly the closed published roster',async(t)=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2098-11-30T16:59:59Z')});
 const previous=process.env.ENABLE_LOCAL_MONTH_CLOSE;
 process.env.ENABLE_LOCAL_MONTH_CLOSE='true';
 t.after(()=>{if(previous===undefined)delete process.env.ENABLE_LOCAL_MONTH_CLOSE;else process.env.ENABLE_LOCAL_MONTH_CLOSE=previous;});
 const {rows:schedules}=await admin.query(`INSERT INTO schedules(month,year,status,created_by)
  VALUES (10,2098,'DRAFT',$1),(11,2098,'PUBLISHED',$1),(12,2098,'PUBLISHED',$1) RETURNING schedule_id,month`,[accounts.a.userId]);
 const closedDate='2098-11-28', receiptDate='2098-11-21', approvedDate='2098-11-15', openDate='2098-12-10';
 for(const date of [closedDate,receiptDate,approvedDate,openDate]) {
  const schedule=schedules.find(row=>row.month===Number(date.slice(5,7)));
  await admin.query(`INSERT INTO shift_assignments(schedule_id,employee_id,shift_type_id,work_date,status,assigned_by)
   SELECT $1,side.employee_id,st.shift_type_id,$2,'ACTIVE',$3
   FROM (VALUES ($4::int,'M'),($5::int,'N'),($6::int,'O')) AS side(employee_id,code)
   JOIN shift_types st ON st.shift_code=side.code`,
   [schedule.schedule_id,date,accounts.a.userId,accounts.worker.employeeId,accounts.target.employeeId,accounts.c.employeeId]);
 }
 const approved=await create(approvedDate);
 const firstApproved=await approve('a',approved);
 assert.equal((await approve('b',firstApproved.body)).body.status,'APPROVED');
 const closes=await create(closedDate);
 const firstCloses=await approve('a',closes);
 assert.equal(firstCloses.status,201);
 const beforeReceipt=await create(receiptDate);
 const firstReceipt=await approve('a',beforeReceipt);
 assert.equal(firstReceipt.status,201);
 const staysOpen=await create(openDate);
 const firstStaysOpen=await approve('a',staysOpen);
 assert.equal(firstStaysOpen.status,201);
 const before=await assignments('worker','2098-11');
 const path='/hr/closed-roster';
 assert.equal((await request('hr',`${path}?month=2098-11`)).body.code,'ROSTER_MONTH_OPEN');
 const csv=async(role:string,month:string,origin=base)=>fetch(`${base}/api${path}.csv?month=${month}`,
  {method:'POST',headers:{Cookie:cookies[role],Origin:origin}});
 assert.equal((await csv('hr','2098-11')).status,409);
 const blocker=await admin.connect();
 let approval:ReturnType<typeof approve>|undefined;
 try {
  await blocker.query('BEGIN');
  await blocker.query('SELECT schedule_id FROM schedules WHERE year=2098 AND month=11 FOR UPDATE');
  approval=approve('b',firstCloses.body);
  let waiting=false;
  for(let i=0;i<100&&!waiting;i++) {
   waiting=(await admin.query(`SELECT EXISTS (SELECT 1 FROM pg_stat_activity
    WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE 'SELECT year,month FROM schedules%') AS waiting`)).rows[0].waiting;
   if(!waiting) await new Promise(resolveDelay=>setTimeout(resolveDelay,25));
  }
  assert.equal(waiting,true,'Approval began before midnight and is waiting on the schedule');
  t.mock.timers.setTime(Date.parse('2098-11-30T17:00:00Z'));
 } finally {
  await blocker.query('ROLLBACK');
  blocker.release();
 }
 const locked=await approval!;
 assert.equal(locked.status,409);
 assert.equal(locked.body.code,'SCHEDULE_MONTH_CLOSED');
 t.mock.timers.setTime(Date.parse('2098-11-30T16:59:59Z'));
 const receiptBlocker=await admin.connect();
 let receiptApproval:ReturnType<typeof approve>|undefined;
 try {
  await receiptBlocker.query('BEGIN');
  await receiptBlocker.query('LOCK TABLE operation_receipts IN SHARE MODE');
  receiptApproval=approve('b',firstReceipt.body);
  let waiting=false;
  for(let i=0;i<100&&!waiting;i++) {
   waiting=(await admin.query(`SELECT EXISTS (SELECT 1 FROM pg_stat_activity
    WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE 'INSERT INTO operation_receipts%') AS waiting`)).rows[0].waiting;
   if(!waiting) await new Promise(resolveDelay=>setTimeout(resolveDelay,25));
  }
  assert.equal(waiting,true,'The final approval is waiting to save its receipt before commit');
  t.mock.timers.setTime(Date.parse('2098-11-30T17:00:00Z'));
 } finally {
  await receiptBlocker.query('ROLLBACK');
  receiptBlocker.release();
 }
 const rolledBack=await receiptApproval!;
 assert.equal(rolledBack.status,409);
 assert.equal(rolledBack.body.code,'SCHEDULE_MONTH_CLOSED');
 assert.deepEqual(await assignments('worker','2098-11'),before);
 const oldQueue=(await request('b','/requests')).body.find((row:any)=>row.request_id===closes.requestId);
 assert.equal(oldQueue.status,'MONTH_CLOSED');
 assert.equal(oldQueue.canDecide,false);
 const lateNew=await request('worker','/requests','POST',await swapInput(closedDate),randomUUID());
 assert.equal(lateNew.body.code,'SCHEDULE_MONTH_CLOSED');
 assert.equal((await approve('b',firstStaysOpen.body)).body.status,'APPROVED');
 assert.equal((await request(undefined,path)).status,401);
 for(const role of ['worker','manager','a','external']) {
  assert.equal((await request(role,path)).status,403);
  assert.equal((await csv(role,'2098-11')).status,403);
 }
 assert.equal((await csv('hr','2098-10')).status,404);
 assert.equal((await csv('hr','2098-12')).status,409);
 assert.equal((await csv('hr','2098-11','https://example.com')).status,403);
 const view=await request('hr',path);
 assert.equal(view.status,200,JSON.stringify(view.body));
 assert.equal(view.body.month,'2098-11');
 assert.equal(view.body.scheduleVersion,2);
 assert.deepEqual([...new Set(view.body.rows.map((row:any)=>row.team))],['A','B','C']);
 assert.ok(view.body.rows.some((row:any)=>row.employeeCode==='DEMO-A1'&&row.workDate===approvedDate&&row.shiftCode==='N'));
 assert.ok(view.body.rows.some((row:any)=>row.team==='C'&&row.shiftCode==='O'));
 const file=await csv('hr','2098-11');
 assert.equal(file.status,200);
 assert.match(file.headers.get('content-type')||'',/^text\/csv/);
 assert.match(file.headers.get('content-disposition')||'',/2098-11\.csv/);
 const bytes=Buffer.from(await file.arrayBuffer());
 assert.deepEqual([...bytes.subarray(0,3)],[239,187,191]);
 const lines=bytes.toString('utf8').slice(1).split('\r\n').filter(Boolean);
 assert.equal(lines.shift(),'"รหัสพนักงาน","ทีม","วันที่","รหัสกะ"');
 assert.deepEqual(lines,view.body.rows.map((row:any)=>[row.employeeCode,row.team,row.workDate,row.shiftCode].map(value=>`"${value}"`).join(',')));
 const evidence=(await admin.query(`SELECT user_id,new_value FROM audit_logs
  WHERE action='HR_CLOSED_ROSTER_EXPORTED' AND new_value->>'month'='2098-11'`)).rows;
 assert.deepEqual(evidence,[{user_id:accounts.hr.userId,new_value:{month:'2098-11',scheduleVersion:2}}]);
 if(process.env.HR_CLOSED_ROSTER_BROWSER_CHECK==='true') {
  const script=resolve(projectRoot,'scripts/hr-closed-roster-browser-check.mjs');
  await new Promise<void>((done,reject)=>{
   const child=spawn(process.execPath,[script],{cwd:projectRoot,windowsHide:true,stdio:'inherit',
    env:{...process.env,APP_TEST_ORIGIN:base,TNC_HR_BROWSER_SESSION:cookies.hr}});
   child.once('error',reject);
   child.once('exit',code=>code===0?done():reject(new Error(`HR closed roster browser check exited with ${code}`)));
  });
 }
});

test('first-of-month cutover preserves approved swaps, closes old pending requests, and allows resubmission',async(t)=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2094-11-30T16:59:59Z')});
 const options={month:'2094-12',operatorId:accounts.manager.userId};
 const connection=process.env.DATABASE_ADMIN_URL!;
 const sharedDatabase=new URL(connection);
 sharedDatabase.pathname='/shiftflow_demo';
 await assert.rejects(cutoverModule.runLocalSwapCutover(sharedDatabase.toString(),options),/disposable local/);
 const urlOverride=new URL(connection);
 urlOverride.searchParams.set('host','example.com');
 await assert.rejects(cutoverModule.runLocalSwapCutover(urlOverride.toString(),options),/disposable local/);
 const approvedDate='2094-11-12', closingDate='2094-11-25', newDate='2094-12-05';
 await admin.query(`INSERT INTO schedules(month,year,status,created_by)
  VALUES (11,2094,'PUBLISHED',$1),(12,2094,'PUBLISHED',$1)`,[accounts.a.userId]);
 await admin.query(`INSERT INTO shift_assignments(schedule_id,employee_id,shift_type_id,work_date,status,assigned_by)
  SELECT s.schedule_id,side.employee_id,st.shift_type_id,dates.day,'ACTIVE',$1
  FROM unnest($2::date[]) AS dates(day)
  JOIN schedules s ON s.year=extract(year from dates.day) AND s.month=extract(month from dates.day)
  CROSS JOIN (VALUES ($3::int,'M'),($4::int,'N')) AS side(employee_id,code)
  JOIN shift_types st ON st.shift_code=side.code`,
  [accounts.a.userId,[approvedDate,closingDate,newDate],accounts.worker.employeeId,accounts.target.employeeId]);
 const approved=await create(approvedDate);
 const first=await approve('a',approved);
 assert.equal((await approve('b',first.body)).body.status,'APPROVED');
 const closing=await create(closingDate);
 const partial=await approve('a',closing);
 assert.equal(partial.status,201);
 const resubmit=await create(newDate);
 const before=await assignments('worker','2094-11');

 const preview=await cutoverModule.runLocalSwapCutover(connection,options);
 assert.deepEqual(preview.candidates.filter(item=>item.requestId>=approved.requestId).map(item=>[item.requestId,item.status]),[
  [closing.requestId,'MONTH_CLOSED'],[resubmit.requestId,'POLICY_REPLACED']
 ]);
 await assert.rejects(cutoverModule.runLocalSwapCutover(connection,{...options,apply:true}),/not reached/);
 assert.equal((await request('worker','/requests')).body.find((row:any)=>row.request_id===closing.requestId).status,'PENDING');
 t.mock.timers.setTime(Date.parse('2094-11-30T17:00:00Z'));
 await admin.query(`CREATE FUNCTION fail_test_cutover_notice() RETURNS trigger LANGUAGE plpgsql AS $$
  BEGIN IF NEW.request_id=${resubmit.requestId} THEN RAISE EXCEPTION 'injected cutover notice failure'; END IF;
   RETURN NEW; END $$;
  CREATE TRIGGER test_cutover_failure BEFORE INSERT ON notifications FOR EACH ROW EXECUTE FUNCTION fail_test_cutover_notice();`);
 try {
  await assert.rejects(cutoverModule.runLocalSwapCutover(connection,{...options,apply:true}),/injected cutover notice failure/);
  assert.deepEqual(await cutoverModule.runLocalSwapCutover(connection,options),preview);
 } finally {
  await admin.query('DROP TRIGGER test_cutover_failure ON notifications; DROP FUNCTION fail_test_cutover_notice()');
 }
 assert.deepEqual(await cutoverModule.runLocalSwapCutover(connection,{...options,apply:true}),{...preview,applied:true});
 assert.deepEqual((await cutoverModule.runLocalSwapCutover(connection,{...options,apply:true})).candidates,[]);
 await assert.rejects(admin.query("INSERT INTO requests(requester_id,request_type,status) VALUES ($1,'SWAP','PENDING')",
  [accounts.worker.employeeId]),/Legacy swap requests cannot be created after cutover/);
 const legacyRetry=await request('worker','/requests','POST',await swapInput(newDate),randomUUID());
 assert.equal(legacyRetry.status,500,'The regular backend database role also cannot insert a legacy request');
 const rows=(await request('worker','/requests')).body;
 const rowFor=(record:any)=>rows.find((row:any)=>row.request_id===record.requestId);
 assert.equal(rowFor(approved).status,'APPROVED');
 assert.equal(rowFor(approved).version,3);
 assert.equal(rowFor(closing).status,'MONTH_CLOSED');
 assert.deepEqual(rowFor(closing).approvals.map((row:any)=>row.status),['APPROVED','PENDING']);
 assert.equal(rowFor(resubmit).status,'POLICY_REPLACED');
 assert.equal(rowFor(resubmit).canCancel,false);
 assert.equal((await approve('b',partial.body)).status,409);
 assert.equal((await approve('a',resubmit)).status,409);
 assert.deepEqual(await assignments('worker','2094-11'),before);
 assert.equal((await admin.query(`SELECT count(*)::int AS n FROM audit_logs WHERE action='SWAP_CUTOVER_CLOSED'
  AND user_id=$1 AND entity_id=ANY($2::int[])`,[accounts.manager.userId,[closing.requestId,resubmit.requestId]])).rows[0].n,2);
 const activity=(await request('manager','/audit?view=activity')).body;
 assert.ok(activity.some((row:any)=>row.entity_id===resubmit.requestId&&row.action==='SWAP_CUTOVER_CLOSED'));
 assert.equal((await admin.query(`SELECT count(*)::int AS n FROM notifications WHERE request_id=$1 AND user_id=$2
  AND title='เริ่มใช้กฎสลับกะใหม่'`,[resubmit.requestId,accounts.worker.userId])).rows[0].n,1);
 assert.equal((await admin.query(`SELECT count(*)::int AS n FROM requests WHERE request_id=ANY($1::int[])
  AND quota_month IS NOT NULL`,[[approved.requestId,closing.requestId,resubmit.requestId]])).rows[0].n,0);
 const previous=process.env.ENABLE_LOCAL_SWAP_POLICY;
 process.env.ENABLE_LOCAL_SWAP_POLICY='true';
 t.after(()=>{if(previous===undefined)delete process.env.ENABLE_LOCAL_SWAP_POLICY;else process.env.ENABLE_LOCAL_SWAP_POLICY=previous;});
 const fresh=await create(newDate);
 assert.notEqual(fresh.requestId,resubmit.requestId);
 assert.equal((await admin.query('SELECT quota_month FROM requests WHERE request_id=$1',[fresh.requestId])).rows[0].quota_month,'2094-12-01');
});

test('a supervisor swap goes directly to one assigned Manager and charges only the requester',async(t)=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2096-06-01T12:00:00Z')});
 const previous=process.env.ENABLE_LOCAL_SWAP_POLICY;
 process.env.ENABLE_LOCAL_SWAP_POLICY='true';
 t.after(()=>{if(previous===undefined)delete process.env.ENABLE_LOCAL_SWAP_POLICY;else process.env.ENABLE_LOCAL_SWAP_POLICY=previous;});
 const {rows:[schedule]}=await admin.query(
  "INSERT INTO schedules(month,year,status,created_by) VALUES(6,2096,'PUBLISHED',$1) RETURNING schedule_id",[accounts.a.userId]);
 const date='2096-06-10';
 await admin.query(`INSERT INTO shift_assignments(schedule_id,employee_id,shift_type_id,work_date,status,assigned_by)
  SELECT $1,side.employee_id,st.shift_type_id,$2,'ACTIVE',$3
  FROM (VALUES ($4::int,'M'),($5::int,'N'),($6::int,'N')) AS side(employee_id,code)
  JOIN shift_types st ON st.shift_code=side.code`,
  [schedule.schedule_id,date,accounts.a.userId,accounts.a.employeeId,accounts.b.employeeId,accounts.target.employeeId]);
 const input=await swapInput(date,'a','b');
 const available=await request('a',`/swap/candidates?assignmentId=${input.assignmentId}`);
 assert.equal(available.status,200);
 assert.deepEqual(available.body.candidates.map((item:any)=>item.employee_id),[accounts.b.employeeId]);
 const forged=await request('a','/requests','POST',await swapInput(date,'a','target'),randomUUID());
 assert.equal(forged.status,400);
 await admin.query('UPDATE users SET is_active=false WHERE user_id=$1',[accounts.manager.userId]);
 try {
  const unassigned=await request('a','/requests','POST',input,randomUUID());
  assert.equal(unassigned.status,409);
  assert.equal(unassigned.body.code,'APPROVER_UNRESOLVED');
 } finally {
  await admin.query('UPDATE users SET is_active=true WHERE user_id=$1',[accounts.manager.userId]);
 }
 const created=await request('a','/requests','POST',input,randomUUID());
 assert.equal(created.status,201,JSON.stringify(created.body));
 const getRow=async(role:string)=>(await request(role,'/requests')).body.find((row:any)=>row.request_id===created.body.requestId);
 const review=await getRow('manager');
 assert.equal(review.canDecide,true,JSON.stringify({route:review.snapshot.approvalRoute,approvals:review.approvals,expectedManager:accounts.manager.userId,
  status:review.status,routeConfirmed:review.approvalRouteConfirmed,demoSupported:review.demoSupported,hasConflict:review.hasConflict}));
 assert.deepEqual(review.approvals.map((step:any)=>step.approver_id),[accounts.manager.userId]);
 assert.equal((await getRow('a')).canDecide,false);
 assert.equal((await approve('a',created.body)).status,403);
 assert.equal((await approve('b',created.body)).status,403);
 const approved=await approve('manager',created.body);
 assert.equal(approved.status,201,JSON.stringify(approved.body));
 assert.equal(approved.body.status,'APPROVED');
 const result=(await assignments('a','2096-06')).find((row:any)=>row.employee_id===accounts.a.employeeId);
 assert.equal(result.shift_code,'N');
 assert.equal(result.swap.partner.employeeId,accounts.b.employeeId);
 const usage=await admin.query("SELECT requester_id FROM requests WHERE quota_month='2096-06-01' AND status='APPROVED'");
 assert.deepEqual(usage.rows,[{requester_id:accounts.a.employeeId}]);
});

test('both teams can decide an employee swap in either order, including concurrent approvals',async(t)=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2096-07-01T12:00:00Z')});
 const previous=process.env.ENABLE_LOCAL_SWAP_POLICY;
 process.env.ENABLE_LOCAL_SWAP_POLICY='true';
 t.after(()=>{if(previous===undefined)delete process.env.ENABLE_LOCAL_SWAP_POLICY;else process.env.ENABLE_LOCAL_SWAP_POLICY=previous;});
 const {rows:[schedule]}=await admin.query(
  "INSERT INTO schedules(month,year,status,created_by) VALUES(7,2096,'PUBLISHED',$1) RETURNING schedule_id",[accounts.a.userId]);
 const dates=['2096-07-06','2096-07-15'];
 await admin.query(`INSERT INTO shift_assignments(schedule_id,employee_id,shift_type_id,work_date,status,assigned_by)
  SELECT $1,side.employee_id,st.shift_type_id,dates.day,'ACTIVE',$2
  FROM unnest($3::date[]) AS dates(day)
  CROSS JOIN (VALUES ($4::int,'M'),($5::int,'N')) AS side(employee_id,code)
  JOIN shift_types st ON st.shift_code=side.code`,
  [schedule.schedule_id,accounts.a.userId,dates,accounts.worker.employeeId,accounts.target.employeeId]);
 const record=await create(dates[0]);
 const before=await assignments('worker','2096-07');
 for(const role of ['a','b']) {
  const row=(await request(role,'/requests')).body.find((r:any)=>r.request_id===record.requestId);
  assert.equal(row.canDecide,true);
  const notices=(await request(role,'/notifications')).body;
  assert.ok(notices.some((notice:any)=>notice.request_id===record.requestId));
 }
 const fromB=await approve('b',record);
 assert.equal(fromB.status,201);
 assert.equal(fromB.body.status,'PENDING');
 assert.deepEqual(await assignments('worker','2096-07'),before);
 assert.equal((await approve('a',record)).body.status,'APPROVED');
 const parallel=await create(dates[1]);
 const results=await Promise.all([approve('a',parallel),approve('b',parallel)]);
 assert.deepEqual(results.map(item=>item.status),[201,201]);
 assert.deepEqual(results.map(item=>item.body.status).sort(),['APPROVED','PENDING']);
 const evidence=await admin.query(`SELECT count(*)::int AS n FROM audit_logs
  WHERE entity_type='REQUEST' AND entity_id=$1 AND action='SCHEDULE_SWAP_APPLIED'`,[parallel.requestId]);
 assert.equal(evidence.rows[0].n,1);
 const reviewed=await admin.query(`SELECT request_version FROM approvals WHERE request_id=$1 ORDER BY approver_level`,[parallel.requestId]);
 assert.deepEqual(reviewed.rows.map(row=>row.request_version),[1,1]);
});

test('a two-date swap validates the combined roster and applies four cells as one approved request',async(t)=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2096-08-01T12:00:00Z')});
 const previous=process.env.ENABLE_LOCAL_SWAP_POLICY;
 process.env.ENABLE_LOCAL_SWAP_POLICY='true';
 t.after(()=>{if(previous===undefined)delete process.env.ENABLE_LOCAL_SWAP_POLICY;else process.env.ENABLE_LOCAL_SWAP_POLICY=previous;});
 const {rows:[schedule]}=await admin.query(
  "INSERT INTO schedules(month,year,status,created_by) VALUES(8,2096,'PUBLISHED',$1) RETURNING schedule_id",[accounts.a.userId]);
 const fixture=[
  ...[1,2,3,4,5].map(day=>[day,'M','O']),
  [6,'N','O'],[7,'O','M'],[12,'M','N'],[17,'M','O'],[19,'M','O'],
  [20,'M','N'],[25,'O','N'],[29,'O','N'],
 ];
 for(const [day,source,target] of fixture) {
  await admin.query(`INSERT INTO shift_assignments(schedule_id,employee_id,shift_type_id,work_date,status,assigned_by)
   SELECT $1,side.employee_id,st.shift_type_id,make_date(2096,8,$2),'ACTIVE',$3
   FROM (VALUES ($4::int,$5::text),($6::int,$7::text)) AS side(employee_id,code)
   JOIN shift_types st ON st.shift_code=side.code`,
   [schedule.schedule_id,day,accounts.a.userId,accounts.worker.employeeId,source,accounts.target.employeeId,target]);
 }
 const wrongFirst=await swapInput('2096-08-12'),wrongSecond=await swapInput('2096-08-20');
 const wrongInput={...wrongFirst,secondSwap:wrongSecond};
 const wrongPreview=await request('worker','/swap/validate','POST',wrongInput);
 assert.equal(wrongPreview.body.valid,false,'Two days with both employees already working are not a cross-date swap');
 assert.ok(wrongPreview.body.checks.some((check:any)=>check.rule==='CROSS_DATE_FIRST_COVER'&&check.status==='FAIL'));
 assert.ok(wrongPreview.body.checks.some((check:any)=>check.rule==='CROSS_DATE_SECOND_COVER'&&check.status==='FAIL'));
 assert.equal((await request('worker','/requests','POST',wrongInput,randomUUID())).status,400);
 assert.equal((await request('worker','/swap/validate','POST',wrongFirst)).body.valid,true,'The same date is eligible for a same-day swap');
 const legacyRoster=await assignments('worker','2096-08');
 const legacySlots=new Map(legacyRoster.map((row:any)=>[row.assignment_id,row]));
 const {rows:[legacy]}=await admin.query(`INSERT INTO requests(requester_id,request_type,status,quota_month,submitted_at)
  VALUES($1,'SWAP','PENDING','2096-08-01',$2) RETURNING request_id,version`,[accounts.worker.employeeId,new Date()]);
 const legacySnapshot={source:legacySlots.get(wrongFirst.assignmentId),target:legacySlots.get(wrongFirst.targetAssignmentId),
  secondSwap:{source:legacySlots.get(wrongSecond.assignmentId),target:legacySlots.get(wrongSecond.targetAssignmentId)},
  approvalRoute:'TWO_SUPERVISORS',requestVersion:1};
 await admin.query(`INSERT INTO change_requests(request_id,assignment_id,target_employee_id,target_assignment_id,snapshot)
  VALUES($1,$2,$3,$4,$5)`,[legacy.request_id,wrongFirst.assignmentId,accounts.target.employeeId,wrongFirst.targetAssignmentId,JSON.stringify(legacySnapshot)]);
 await admin.query(`INSERT INTO approvals(request_id,approver_id,approver_level,status)
  VALUES($1,$2,1,'PENDING'),($1,$3,2,'PENDING')`,[legacy.request_id,accounts.a.userId,accounts.b.userId]);
 const legacyRow=(await request('worker','/requests')).body.find((row:any)=>row.request_id===legacy.request_id);
 assert.match(legacyRow.approvalBlockReason,/เลือกวันที่/);
 assert.equal((await approve('b',{requestId:legacy.request_id,version:legacy.version})).body.code,'CROSS_DATE_RESUBMISSION_REQUIRED');
 const rejection=await request('b',`/requests/${legacy.request_id}/decisions`,'POST',
  {decision:'REJECT',expectedVersion:legacy.version,reason:'ต้องเลือกวันที่คนมาทำแทนหยุดอยู่'},randomUUID());
 assert.equal(rejection.body.status,'REJECTED');
 assert.deepEqual(await assignments('worker','2096-08'),legacyRoster);

 const early=await swapInput('2096-08-06'),next=await swapInput('2096-08-07');
 const isolatedSecond=await request('worker','/swap/validate','POST',next);
 assert.equal(isolatedSecond.body.valid,false);
 assert.ok(isolatedSecond.body.checks.some((check:any)=>check.rule.startsWith('MAX_SIX_DAYS')&&check.status==='FAIL'));
 const joint=await request('worker','/swap/validate','POST',{...early,secondSwap:next});
 assert.equal(joint.status,201,JSON.stringify(joint.body));
 assert.equal(joint.body.valid,true,'Giving away the night shift makes the next-day shift possible in the same request');
 const reversed=await request('worker','/swap/validate','POST',{...next,secondSwap:early});
 assert.equal(reversed.body.valid,false,'The first selection must be the requester’s working shift');

 const first=await swapInput('2096-08-17'),second=await swapInput('2096-08-25');
 const submitted=await request('worker','/requests','POST',{...first,secondSwap:second},randomUUID());
 assert.equal(submitted.status,201,JSON.stringify(submitted.body));
 const duplicate=await request('worker','/requests','POST',second,randomUUID());
 assert.equal(duplicate.body.code,'PENDING_REQUEST');
 await admin.query('UPDATE shift_assignments SET version=version+1 WHERE assignment_id=$1',[second.targetAssignmentId]);
 const before=await assignments('worker','2096-08');
 const conflict=await approve('b',submitted.body);
 assert.equal(conflict.body.code,'SCHEDULE_CHANGED');
 assert.deepEqual(await assignments('worker','2096-08'),before);
 const refreshed=await swapInput('2096-08-25');
 const fresh=await request('worker','/requests','POST',{...first,secondSwap:refreshed},randomUUID());
 assert.equal(fresh.status,201,JSON.stringify(fresh.body));
 const beforeFinal=await approve('b',fresh.body);
 assert.equal(beforeFinal.body.status,'PENDING');
 assert.deepEqual(await assignments('worker','2096-08'),before);
 await admin.query('UPDATE employees SET team_id=$2 WHERE employee_id=$1',[accounts.target.employeeId,accounts.c.teamId]);
 try {
  const changedTeam=await approve('a',fresh.body);
  assert.equal(changedTeam.status,409);
  assert.equal(changedTeam.body.code,'SWAP_PARTICIPANTS_CHANGED');
 } finally {
  await admin.query('UPDATE employees SET team_id=$2 WHERE employee_id=$1',[accounts.target.employeeId,accounts.b.teamId]);
 }
 assert.deepEqual(await assignments('worker','2096-08'),before);
 assert.equal((await approve('a',fresh.body)).body.status,'APPROVED');
 const affected=(await assignments('worker','2096-08')).filter((row:any)=>['2096-08-17','2096-08-25'].includes(row.work_date));
 assert.equal(affected.length,4);
 assert.deepEqual(affected.map((row:any)=>[row.employee_code,row.work_date,row.shift_code]),[
  ['DEMO-A1','2096-08-17','O'],['DEMO-A1','2096-08-25','N'],
  ['DEMO-B1','2096-08-17','M'],['DEMO-B1','2096-08-25','O'],
 ]);
 assert.ok(affected.every((row:any)=>row.swap?.requestId===fresh.body.requestId));
 assert.equal((await admin.query(`SELECT count(*)::int AS n FROM requests
  WHERE quota_month='2096-08-01' AND requester_id=$1 AND status='APPROVED'`,[accounts.worker.employeeId])).rows[0].n,1);
 if(process.env.CENTRAL_SWAP_BROWSER_CHECK==='true') {
  await admin.query(`INSERT INTO shift_assignments(schedule_id,employee_id,shift_type_id,work_date,status,assigned_by)
   SELECT $1,side.employee_id,st.shift_type_id,'2096-08-26','ACTIVE',$2
   FROM (VALUES ($3::int,'M'),($4::int,'N')) AS side(employee_id,code)
   JOIN shift_types st ON st.shift_code=side.code`,
   [schedule.schedule_id,accounts.a.userId,accounts.a.employeeId,accounts.b.employeeId]);
  const script=resolve(projectRoot,'scripts/central-swap-browser-check.mjs');
  await new Promise<void>((done,reject)=>{
   const child=spawn(process.execPath,[script],{cwd:projectRoot,windowsHide:true,stdio:'inherit',
    env:{...process.env,APP_TEST_ORIGIN:base,TNC_SWAP_BROWSER_SESSIONS:JSON.stringify({worker:cookies.worker,a:cookies.a,b:cookies.b,manager:cookies.manager})}});
   child.once('error',reject);
   child.once('exit',code=>code===0?done():reject(new Error(`Central swap browser check exited with ${code}`)));
  });
 }
});
