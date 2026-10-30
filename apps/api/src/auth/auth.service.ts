import { Injectable, UnauthorizedException, ForbiddenException, ServiceUnavailableException, Inject } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Response as ExpressResponse } from 'express';
import { Database } from '../database/database.service';
import { Actor } from '../shared/types';
import { settings } from '../config';
const actorSelect=`SELECT u.user_id AS "userId", u.employee_id AS "employeeId", r.role_name AS role,
 e.team_id AS "teamId", COALESCE(e.first_name || ' ' || e.last_name,u.demo_display_name) AS name,
 t.team_name AS "teamName", t.team_code AS "teamCode", u.demo_profile AS "demoProfile", u.demo_order AS "demoOrder"
 FROM users u JOIN roles r USING(role_id) LEFT JOIN employees e USING(employee_id) LEFT JOIN teams t USING(team_id)`;
// The Supabase user id is stored in users.azure_object_id (the column reserved for the company identity).
// The first Microsoft 365 sign-in links itself when its email matches exactly one active, unlinked
// employee (employees.email); otherwise an administrator links it with `link-user`. Unlinked logins get 403.
const linkedActor=`${actorSelect} WHERE u.azure_object_id=$1 AND u.is_active AND (e.team_id IS NULL OR t.is_active)`;
const emailMatch=`SELECT u.user_id AS "userId", u.azure_object_id AS linked FROM users u JOIN employees e USING(employee_id)
 WHERE lower(e.email)=lower($1) AND u.is_active`;
type Identity={id:string;email:string|null;microsoft:boolean};
type SessionUser={id?:unknown;email?:unknown;app_metadata?:{provider?:unknown;providers?:unknown}};
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
  const config=settings(),url=new URL('/login',config.authUrl);
  url.searchParams.set('redirect_to',`${config.origin}/`);
  return url.toString();
 }
 // Only the login service's own cookies (including Supabase's chunked ".0", ".1" parts) are forwarded.
 private authCookies(cookie:string|undefined) {
  const name=settings().authCookie;
  return (cookie??'').split(';').map(s=>s.trim()).filter(s=>s.startsWith(`${name}=`)||s.startsWith(`${name}.`)).join('; ');
 }
 private required(code:string,message:string) { return new UnauthorizedException({code,message,loginUrl:this.loginUrl()}); }
 private unavailable() { return new ServiceUnavailableException({code:'AUTH_UNAVAILABLE',message:'เชื่อมต่อระบบเข้าสู่ระบบไม่สำเร็จ ตรวจว่าระบบเข้าสู่ระบบ (shift/Backend) เปิดอยู่ แล้วลองอีกครั้ง'}); }
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
  if(!microsoft||!email) return false;
  const matches=(await this.db.query(emailMatch,[email])).rows;
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
 async resolve(cookie:string|undefined,res?:ExpressResponse):Promise<Actor> {
  const identity=await this.identity(cookie,res);
  let actor=(await this.db.query(linkedActor,[identity.id])).rows[0];
  if(!actor&&await this.autoLink(identity)) actor=(await this.db.query(linkedActor,[identity.id])).rows[0];
  if(!actor) throw new ForbiddenException({code:'ACCOUNT_NOT_LINKED',message:'บัญชีนี้ยังไม่ได้ผูกกับพนักงานในระบบ กรุณาติดต่อผู้ดูแลระบบ'});
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
