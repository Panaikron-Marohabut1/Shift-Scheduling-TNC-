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
// An administrator links each account with `pnpm --filter @tnc/api link-user`; unlinked logins get 403.
const linkedActor=`${actorSelect} WHERE u.azure_object_id=$1 AND u.is_active AND (e.team_id IS NULL OR t.is_active)`;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// A verified session is trusted for 30 seconds so the page's parallel API calls and its
// 30-second refresh do not each wait for the login service. Logout clears it immediately.
const VERIFIED_MS=30000;
export const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
@Injectable()
export class AuthService {
 private readonly verified=new Map<string,{identityId:string;expires:number}>();
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
 private async identity(cookie:string|undefined,res?:ExpressResponse) {
  const cookies=this.authCookies(cookie);
  if(!cookies) throw this.required('SESSION_REQUIRED','กรุณาเข้าสู่ระบบ');
  const key=hash(cookies),known=this.verified.get(key);
  if(known&&known.expires>Date.now()) return known.identityId;
  const response=await this.callAuth('/api/auth/session',cookies,res);
  if(response.status===401) { this.verified.delete(key); throw this.required('SESSION_EXPIRED','หมดเวลาเข้าสู่ระบบ กรุณาเข้าสู่ระบบอีกครั้ง'); }
  if(!response.ok) throw this.unavailable();
  const id=((await response.json().catch(()=>null)) as {user?:{id?:unknown}}|null)?.user?.id;
  if(typeof id!=='string'||!UUID.test(id)) throw this.unavailable();
  if(this.verified.size>1000) for(const [k,v] of this.verified) if(v.expires<=Date.now()) this.verified.delete(k);
  this.verified.set(key,{identityId:id,expires:Date.now()+VERIFIED_MS});
  return id;
 }
 async resolve(cookie:string|undefined,res?:ExpressResponse):Promise<Actor> {
  const id=await this.identity(cookie,res);
  const actor=(await this.db.query(linkedActor,[id])).rows[0];
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
