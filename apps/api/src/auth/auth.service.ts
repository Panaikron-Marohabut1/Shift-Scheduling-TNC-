import { Injectable, UnauthorizedException, ForbiddenException, ServiceUnavailableException, Inject } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Response as ExpressResponse } from 'express';
import { Database } from '../database/database.service';
import { Actor } from '../shared/types';
import { settings } from '../config';
import { adminDemoProfile, demoPeopleAccess, isDemoAdmin, localDemoAccess, onboardingDemoProfile, sharedDemoAccess } from '../admin-access/demo-access';
import { bangkokWorkDate } from '../requests/swap-request-time';
const actorSelect=`SELECT u.user_id AS "userId", u.employee_id AS "employeeId", r.role_name AS role,
 t.team_id AS "teamId", COALESCE(e.first_name || ' ' || e.last_name,u.demo_display_name) AS name,
 t.team_name AS "teamName", t.team_code AS "teamCode", u.demo_profile AS "demoProfile", u.demo_order AS "demoOrder"`;
const actorFrom=`FROM users u JOIN roles r USING(role_id) LEFT JOIN employees e USING(employee_id)`;
// The Supabase user id is stored in users.azure_object_id (the column reserved for the company identity).
// When explicitly enabled, Microsoft 365 sign-in links when its email matches one active, unlinked
// employee (employees.email); otherwise an administrator links it with `link-user`. Unlinked logins get 403.
const linkedActor=`${actorSelect}, NULL::text AS "initialAccess",u.identity_source AS "identitySource"
 ${actorFrom} LEFT JOIN teams t USING(team_id)
 WHERE u.azure_object_id=$1 AND u.is_active AND (e.team_id IS NULL OR t.is_active)
 AND u.demo_profile IS DISTINCT FROM $2`;
const linkedDemoActor=`${actorSelect}, u.initial_access_state AS "initialAccess",u.identity_source AS "identitySource"
 ${actorFrom} LEFT JOIN teams t ON t.team_id=shiftflow_policy.employee_team_on(e.employee_id,e.team_id,$2::date)
 WHERE u.azure_object_id=$1 AND u.is_active AND (e.team_id IS NULL OR t.is_active)`;
const linkedPilotActor=`${linkedDemoActor} AND u.identity_source='DEMO'
 AND r.role_name IN ('EMPLOYEE','SUPERVISOR','MANAGER')
 AND u.demo_profile IN ('employee-a','employee-b','supervisor-a','supervisor-b','manager')`;
const linkedSharedDemoActor=`${linkedDemoActor} AND u.identity_source='DEMO' AND (
 (r.role_name IN ('EMPLOYEE','SUPERVISOR','MANAGER') AND u.demo_profile IN
  ('employee-a','employee-b','supervisor-a','supervisor-b','manager',$3))
 OR (r.role_name='ADMIN' AND u.demo_profile=$4))`;
const emailMatch=`SELECT u.user_id AS "userId", u.azure_object_id AS linked FROM users u JOIN employees e USING(employee_id)
 WHERE lower(e.email)=lower($1) AND u.is_active AND u.demo_profile IS DISTINCT FROM $2`;
type Identity={id:string;email:string|null;microsoft:boolean};
type SessionUser={id?:unknown;email?:unknown;app_metadata?:{provider?:unknown;providers?:unknown}};
type LinkedActor=Actor & {initialAccess:'PENDING'|'ASSIGNED'|null;identitySource:string};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// A verified session is trusted for 30 seconds so the page's parallel API calls and its
// 30-second refresh do not each wait for the login service. Logout clears it immediately.
const VERIFIED_MS=30000;
export const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
@Injectable()
export class AuthService {
 private readonly verified=new Map<string,{identity:Identity;expires:number}>();
 constructor(@Inject(Database) private readonly db:Database) {}
 loginUrl() {
  const config=settings(),url=new URL('/login',config.remotePilot?config.origin:config.authUrl);
  url.searchParams.set('redirect_to',`${config.origin}/`);
  return url.toString();
 }
 // Only the login service's own cookies (including Supabase's chunked ".0", ".1" parts) are forwarded.
 private authCookies(cookie:string|undefined) {
  const name=settings().authCookie;
  return (cookie??'').split(';').map(s=>s.trim()).filter(s=>s.startsWith(`${name}=`)||s.startsWith(`${name}.`)).join('; ');
 }
 private required(code:string,message:string) { return new UnauthorizedException({code,message,loginUrl:this.loginUrl()}); }
 private unavailable() { return new ServiceUnavailableException({code:'AUTH_UNAVAILABLE',message:'เชื่อมต่อระบบเข้าสู่ระบบไม่สำเร็จ ตรวจว่าระบบเข้าสู่ระบบ (apps/auth) เปิดอยู่ แล้วลองอีกครั้ง'}); }
 private async callAuth(path:string,cookies:string,res:ExpressResponse|undefined,method='GET') {
  let response:Response;
  try { response=await fetch(`${settings().authUrl}${path}`,{method,headers:{Cookie:cookies,Accept:'application/json'},redirect:'manual',signal:AbortSignal.timeout(5000)}); }
  catch { throw this.unavailable(); }
  // Pass refreshed or cleared Supabase cookies back to the browser (same host, so the same cookies).
  if(res) for(const value of response.headers.getSetCookie()) res.append('Set-Cookie',value);
  return response;
 }
 private async identity(cookie:string|undefined,res?:ExpressResponse):Promise<Identity> {
  const cookies=this.authCookies(cookie);
  if(!cookies) throw this.required('SESSION_REQUIRED','กรุณาเข้าสู่ระบบ');
  const key=hash(cookies),known=this.verified.get(key);
  if(known&&known.expires>Date.now()) return known.identity;
  const response=await this.callAuth('/api/auth/session',cookies,res);
  if(response.status===401) { this.verified.delete(key); throw this.required('SESSION_EXPIRED','หมดเวลาเข้าสู่ระบบ กรุณาเข้าสู่ระบบอีกครั้ง'); }
  if(!response.ok) throw this.unavailable();
  const user=((await response.json().catch(()=>null)) as {user?:SessionUser}|null)?.user;
  if(typeof user?.id!=='string'||!UUID.test(user.id)) throw this.unavailable();
  const providers=Array.isArray(user.app_metadata?.providers)?user.app_metadata.providers:[user.app_metadata?.provider];
  const identity={id:user.id.toLowerCase(),email:typeof user.email==='string'?user.email:null,microsoft:providers.includes('azure')};
  if(this.verified.size>1000) for(const [k,v] of this.verified) if(v.expires<=Date.now()) this.verified.delete(k);
  this.verified.set(key,{identity,expires:Date.now()+VERIFIED_MS});
  return identity;
 }
 // Only Microsoft 365 (company-verified) emails link automatically, and only to a single unambiguous,
 // not-yet-linked user; a user already linked to another account is never taken over.
 private async autoLink({id,email,microsoft}:Identity) {
  // Keep existing administrator-managed identity links until automatic linking is approved.
  if(['PILOT','SHARED_DEMO'].includes(process.env.APP_MODE??'')||process.env.ENABLE_MICROSOFT_AUTO_LINK!=='true') return false;
  if(!microsoft||!email) return false;
  const matches=(await this.db.query(emailMatch,[email,onboardingDemoProfile])).rows;
  if(matches.length!==1||matches[0].linked) return false;
  const userId=matches[0].userId;
  try {
   return await this.db.transaction(async c=>{
    const updated=await c.query('UPDATE users SET azure_object_id=$2,updated_at=now() WHERE user_id=$1 AND azure_object_id IS NULL',[userId,id]);
    if(!updated.rowCount) return false;
    await c.query("INSERT INTO audit_logs(user_id,action,entity_type,entity_id,new_value) VALUES($1,'IDENTITY_LINKED','USER',$1,$2)",
     [userId,JSON.stringify({identitySource:'SUPABASE',supabaseUserId:id,by:'Microsoft 365 email match'})]);
    return true;
   });
  } catch(e:any) {
   if(e.code==='23505') return false; // this Supabase account is already linked to another (inactive) user
   throw e;
  }
 }
 private async findActor(identityId:string):Promise<LinkedActor|undefined> {
  const local=localDemoAccess(this.db);
  if(sharedDemoAccess(this.db)) {
   const {rows:[actor]}=await this.db.query(linkedSharedDemoActor,
    [identityId,bangkokWorkDate(new Date()),onboardingDemoProfile,adminDemoProfile]);
   return actor;
  }
  const pilot=['PILOT','SHARED_DEMO'].includes(process.env.APP_MODE??'');
  const {rows:[actor]}=await this.db.query(pilot?linkedPilotActor:local?linkedDemoActor:linkedActor,
   [identityId,local||pilot?bangkokWorkDate(new Date()):onboardingDemoProfile]);
  return actor;
 }
 private async registerPendingAccess(userId:number,identityId:string) {
  await this.db.transaction(async c=>{
   const updated=await c.query(`UPDATE users u SET initial_access_requested_at=now(),updated_at=now()
    WHERE u.user_id=$1 AND u.azure_object_id=$2 AND u.is_active AND u.identity_source='DEMO'
    AND u.demo_profile=$3 AND u.initial_access_state='PENDING' AND u.initial_access_requested_at IS NULL
    AND EXISTS(SELECT 1 FROM employees e WHERE e.employee_id=u.employee_id AND e.department='DEMO'
     AND e.employee_code='DEMO-B2' AND e.employment_status='ACTIVE')`,[userId,identityId,onboardingDemoProfile]);
   if(updated.rowCount) await c.query(`INSERT INTO audit_logs(user_id,action,entity_type,entity_id,new_value)
    VALUES($1,'INITIAL_ACCESS_REQUESTED','USER',$1,$2)`,[userId,JSON.stringify({initialAccess:'PENDING'})]);
  });
 }
 allowsDemoPeople(actor:Actor) {
  return actor.role==='MANAGER'&&!!actor.demoProfile&&demoPeopleAccess(this.db);
 }
 async resolve(cookie:string|undefined,res?:ExpressResponse):Promise<Actor> {
  const identity=await this.identity(cookie,res);
  let linked=await this.findActor(identity.id);
  if(!linked&&await this.autoLink(identity)) linked=await this.findActor(identity.id);
  if(!linked||(linked.role==='ADMIN'&&(!demoPeopleAccess(this.db)||linked.identitySource!=='DEMO'||!isDemoAdmin(linked)))) {
   throw new ForbiddenException({code:'ACCOUNT_NOT_LINKED',message:'บัญชีนี้ยังไม่ได้ผูกกับพนักงานในระบบ กรุณาติดต่อผู้ดูแลระบบ'});
  }
  const {initialAccess,identitySource,...actor}=linked;
  if(initialAccess==='PENDING') {
   await this.registerPendingAccess(actor.userId,identity.id);
   throw new ForbiddenException({code:'ACCESS_PENDING',message:'บัญชีนี้ยืนยันตัวตนแล้ว กำลังรอ Admin กำหนดบทบาท'});
  }
  return actor;
 }
 // Called when the web app opens: every access is attributable to a real login (audit evidence).
 async opened(actor:Actor) {
  await this.db.query("INSERT INTO audit_logs(user_id,action,entity_type,entity_id,new_value) VALUES($1,'APP_SESSION_OPENED','USER',$1,$2)",[actor.userId,JSON.stringify({identitySource:'SUPABASE'})]);
 }
 async logout(cookie:string|undefined,actor:Actor|null,res:ExpressResponse) {
  const cookies=this.authCookies(cookie);
  this.verified.delete(hash(cookies));
  const response=await this.callAuth('/auth/logout',cookies,res,'POST');
  if(response.status>=400) throw this.unavailable();
  if(actor) await this.db.query("INSERT INTO audit_logs(user_id,action,entity_type,entity_id) VALUES($1,'APP_SESSION_ENDED','USER',$1)",[actor.userId]);
 }
}
