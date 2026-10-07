import 'reflect-metadata';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { seed } from '../seeds/demo';
import { start } from '../src/main';
import { migrate } from '../src/database/migrate';
let app:any,admin:Pool,serverAdmin:Pool;
const testName=`tnc_test_${Date.now()}`;
const port=3019,base=`http://localhost:${port}`;
const accounts:Record<string,any>={},cookies:Record<string,string>={};
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
 process.env.PORT=String(port);process.env.APP_ORIGIN=base;
 admin=new Pool({connectionString:owner.toString()});
 await migrate();
 await seed();app=await start();
 const result=await request(undefined,'/demo/accounts');assert.equal(result.status,200);
 assert.equal(result.body.length,9);
 for(const [label,role,team] of [['worker','EMPLOYEE','A'],['target','EMPLOYEE','B'],['a','SUPERVISOR','A'],['b','SUPERVISOR','B'],['c','SUPERVISOR','C'],['d','SUPERVISOR','D'],['hr','HR','A'],['manager','MANAGER',null],['external','EXTERNAL',null]]) {
  const actor=result.body.find((x:any)=>x.role===role&&x.teamCode===team);assert.ok(actor);accounts[label]=actor;
  const session=await request(undefined,'/demo/session','POST',{userId:actor.userId});assert.equal(session.status,201);
  const cookie=session.headers.get('set-cookie')!;assert.match(cookie,/HttpOnly/i);assert.match(cookie,/SameSite=Strict/i);cookies[label]=cookie.split(';')[0];
 }
});
after(async()=>{
 if(app)await app.close();if(admin)await admin.end();
 if(serverAdmin) {await serverAdmin.query(`DROP DATABASE IF EXISTS "${testName}" WITH (FORCE)`);await serverAdmin.end();}
});
test('unauthenticated reads and cross-origin commands are blocked',async()=>{
 assert.equal((await request(undefined,'/schedules?month=2026-10')).status,401);
 const cross=await fetch(`${base}/api/demo/session`,{method:'POST',headers:{Origin:'https://other.example','Content-Type':'application/json'},body:JSON.stringify({userId:accounts.worker.userId})});
 assert.equal(cross.status,403);
 const forged=await request('worker','/requests','POST',{...await swapInput('2026-10-08'),assignmentId:1},randomUUID());assert.ok([403,404].includes(forged.status));
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
 const available=await request(undefined,'/demo/accounts');assert.equal(available.body.length,9);
 assert.deepEqual(available.body.map((x:any)=>x.demoOrder),[1,2,3,4,5,6,7,8,9]);
 assert.deepEqual(available.body.filter((x:any)=>x.role==='EMPLOYEE').map((x:any)=>x.teamCode),['A','B']);
 assert.deepEqual(available.body.filter((x:any)=>x.role==='SUPERVISOR').map((x:any)=>x.teamCode),['A','B','C','D']);
 for(const role of ['manager','external']){const me=await request(role,'/me');assert.equal(me.status,200);assert.equal(me.body.actor.employeeId,null);assert.equal(me.body.actor.teamId,null);}
 for(const team of ['C','D']){
  const hidden=(await admin.query('SELECT user_id FROM users JOIN employees USING(employee_id) WHERE employee_code=$1',[`DEMO-${team}1`])).rows[0];
  assert.equal((await request(undefined,'/demo/session','POST',{userId:hidden.user_id})).status,404,'C/D employee logins remain hidden');
  assert.equal((await request(team.toLowerCase(),'/me')).status,200,'Existing C/D supervisor identities are now selectable');
 }
 assert.ok((await request('manager','/audit')).body.some((x:any)=>x.action==='DEMO_SESSION_STARTED'&&x.actor_name==='ผู้จัดการทดสอบ'));
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
