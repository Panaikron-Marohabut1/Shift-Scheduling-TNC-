import { Pool, PoolClient } from 'pg';
import '../src/config';
async function profiles(c:PoolClient) {
 const roleIds:Record<string,number>={};
 for(const role of ['MANAGER','EXTERNAL']) roleIds[role]=(await c.query('INSERT INTO roles(role_name) VALUES($1) ON CONFLICT(role_name) DO UPDATE SET role_name=EXCLUDED.role_name RETURNING role_id',[role])).rows[0].role_id;
 await c.query("UPDATE users SET demo_order=NULL WHERE identity_source='DEMO'");
 for(const [role,profile,name,order] of [['MANAGER','manager','ผู้จัดการทดสอบ',1],['EXTERNAL','external','ผู้ใช้ภายนอกทดสอบ',7]]) {
  await c.query(`INSERT INTO users(role_id,identity_source,demo_display_name,demo_profile,demo_order) VALUES($1,'DEMO',$2,$3,$4)
   ON CONFLICT(demo_profile) DO UPDATE SET demo_order=EXCLUDED.demo_order`,[roleIds[String(role)],name,profile,order]);
 }
 for(const [code,profile,order] of [['DEMO-A0','supervisor-a',2],['DEMO-B0','supervisor-b',3],['DEMO-A1','employee-a',4],['DEMO-B1','employee-b',5],['DEMO-HR','hr',6],['DEMO-C0','supervisor-c',8],['DEMO-D0','supervisor-d',9]]) {
  const result=await c.query(`UPDATE users u SET demo_profile=$2,demo_order=$3 FROM employees e WHERE u.employee_id=e.employee_id AND e.employee_code=$1 AND u.identity_source='DEMO'`,[code,profile,order]);
  if(result.rowCount!==1)throw new Error(`Missing existing synthetic account ${code}. No fixture data was reset.`);
 }
}
export async function seed() {
 if(process.env.APP_MODE!=='DEMO') throw new Error('Seeding is available only in DEMO mode.');
 const pool=new Pool({connectionString:process.env.DATABASE_ADMIN_URL});
 const c=await pool.connect();
 try {
  await c.query('BEGIN');
  await c.query('SELECT pg_advisory_xact_lock(900702)');
  if((await c.query('SELECT 1 FROM users LIMIT 1')).rowCount) { await profiles(c); await c.query('COMMIT');console.log('Nine demo profiles ready. Existing IDs, requests, schedules and audit preserved.'); return; }
  const roles:Record<string,number>={};
  for(const role of ['EMPLOYEE','SUPERVISOR','HR']) roles[role]=(await c.query('INSERT INTO roles(role_name) VALUES($1) RETURNING role_id',[role])).rows[0].role_id;
  const employees:{id:number;team:number;slot:number;supervisor:boolean}[]=[];
  const supervisorIds:number[]=[];
  for(let team=0;team<4;team++) {
   const letter='ABCD'[team];
   const teamId=(await c.query('INSERT INTO teams(team_code,team_name,description) VALUES($1,$2,$3) RETURNING team_id',[letter,`ทีม ${letter}`,'ข้อมูลสมมติสำหรับทดสอบ ไม่ใช่กำลังคนบริษัท'])).rows[0].team_id;
   for(let slot=0;slot<3;slot++) {
    const supervisor=slot===0;
    const employeeId=(await c.query(`INSERT INTO employees(employee_code,first_name,last_name,department,position,team_id,employment_status)
     VALUES($1,$2,$3,'DEMO',$4,$5,'ACTIVE') RETURNING employee_id`,[`DEMO-${letter}${slot}`,supervisor?'หัวหน้าทดสอบ':'พนักงานทดสอบ',`${letter}${slot}`,supervisor?'SUPERVISOR':'FIELD_OPERATOR',teamId])).rows[0].employee_id;
    employees.push({id:employeeId,team,slot,supervisor});
    if(supervisor||slot===1) {
     const userId=(await c.query("INSERT INTO users(employee_id,role_id,identity_source) VALUES($1,$2,'DEMO') RETURNING user_id",[employeeId,roles[supervisor?'SUPERVISOR':'EMPLOYEE']])).rows[0].user_id;
     if(supervisor) supervisorIds.push(userId);
    }
   }
  }
  const hrEmployee=(await c.query("INSERT INTO employees(employee_code,first_name,last_name,position,team_id,employment_status) VALUES('DEMO-HR','ผู้ตรวจทดสอบ','HR','HR',1,'ACTIVE') RETURNING employee_id")).rows[0].employee_id;
  await c.query("INSERT INTO users(employee_id,role_id,identity_source) VALUES($1,$2,'DEMO')",[hrEmployee,roles.HR]);
  const codes:Record<string,number>={};
  for(const [code,name,start,end,working] of [['M','กะเช้า','07:30','19:30',true],['N','กะกลางคืน','19:30','07:30',true],['O','วันหยุด',null,null,false]] as const)
   codes[code]=(await c.query('INSERT INTO shift_types(shift_code,shift_name,start_time,end_time,is_working) VALUES($1,$2,$3,$4,$5) RETURNING shift_type_id',[code,name,start,end,working])).rows[0].shift_type_id;
  const schedules:Record<number,number>={};
  for(const month of [9,10,11]) schedules[month]=(await c.query("INSERT INTO schedules(month,year,status,created_by) VALUES($1,2026,'PUBLISHED',$2) RETURNING schedule_id",[month,supervisorIds[0]])).rows[0].schedule_id;
  const rotation=['M','M','O','O','N','N','O','O'];
  const start=Date.parse('2026-09-01T00:00:00Z'),end=Date.parse('2026-11-30T00:00:00Z');
  for(const employee of employees) {
   for(let current=start;current<=end;current+=86400000) {
    const date=new Date(current).toISOString().slice(0,10),month=Number(date.slice(5,7));
    const index=Math.floor((current-start)/86400000);
    const offset=employee.team%2===0?0:4;
    const code=rotation[(index+offset)%8];
    await c.query("INSERT INTO shift_assignments(schedule_id,employee_id,shift_type_id,work_date,status,assigned_by) VALUES($1,$2,$3,$4,'ACTIVE',$5)",[schedules[month],employee.id,codes[code],date,supervisorIds[employee.team]]);
   }
  }
  await profiles(c);await c.query('COMMIT');
  console.log('Synthetic demo ready: nine accounts, A–D schedules and cross-team swaps, Sep–Nov 2026.');
 } catch(e) { await c.query('ROLLBACK'); throw e; }
 finally {c.release();await pool.end();}
}
if(require.main===module) seed().catch(e=>{console.error(e.message);process.exitCode=1;});
