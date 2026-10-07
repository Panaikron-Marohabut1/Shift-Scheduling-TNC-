import { Injectable, UnauthorizedException, NotFoundException, Inject } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { Database } from '../database/database.service';
import { Actor } from '../shared/types';
import { settings } from '../config';
export const COOKIE='tnc_demo_session';
const actorSelect=`SELECT u.user_id AS "userId", u.employee_id AS "employeeId", r.role_name AS role,
 e.team_id AS "teamId", COALESCE(e.first_name || ' ' || e.last_name,u.demo_display_name) AS name,
 t.team_name AS "teamName", t.team_code AS "teamCode", u.demo_profile AS "demoProfile", u.demo_order AS "demoOrder"
 FROM users u JOIN roles r USING(role_id) LEFT JOIN employees e USING(employee_id) LEFT JOIN teams t USING(team_id)`;
const selectable="u.is_active AND u.identity_source='DEMO' AND u.demo_order IS NOT NULL AND (e.team_id IS NULL OR t.is_active)";
export const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
@Injectable()
export class AuthService {
 constructor(@Inject(Database) private readonly db:Database) {}
 async accounts() { return (await this.db.query(`${actorSelect} WHERE ${selectable} ORDER BY u.demo_order`)).rows; }
 async create(userId:number) {
  const actor=(await this.db.query(`${actorSelect} WHERE u.user_id=$1 AND ${selectable}`,[userId])).rows[0] as Actor;
  if(!actor) throw new NotFoundException({code:'UNKNOWN_ACCOUNT',message:'ไม่พบบัญชีเดโมที่เลือก'});
  const token=randomBytes(32).toString('hex');
  await this.db.transaction(async c=>{
   await c.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+$3*interval '1 hour')",[hash(token),userId,settings().hours]);
   await c.query('UPDATE users SET last_login_at=now() WHERE user_id=$1',[userId]);
   await c.query("INSERT INTO audit_logs(user_id,action,entity_type,entity_id,new_value) VALUES($1,'DEMO_SESSION_STARTED','USER',$1,$2)",[userId,JSON.stringify({identitySource:'DEMO'})]);
  });
  return {token,actor};
 }
 async resolve(cookie:string|undefined):Promise<Actor> {
  const token=(cookie??'').split(';').map(s=>s.trim()).find(s=>s.startsWith(`${COOKIE}=`))?.slice(COOKIE.length+1);
  if(!token||! /^[a-f0-9]{64}$/.test(token)) throw new UnauthorizedException({code:'SESSION_REQUIRED',message:'กรุณาเลือกบัญชีเดโมเพื่อเข้าใช้งาน'});
  const actor=(await this.db.query(`${actorSelect} JOIN sessions s ON s.user_id=u.user_id
   WHERE s.token_hash=$1 AND s.expires_at>now() AND ${selectable}`,[hash(token)])).rows[0];
  if(!actor) throw new UnauthorizedException({code:'SESSION_EXPIRED',message:'บัญชีเดโมหมดเวลา กรุณาเข้าใช้งานอีกครั้ง'});
  return actor;
 }
 async logout(cookie:string|undefined,actor:Actor) {
  const token=(cookie??'').split(';').map(s=>s.trim()).find(s=>s.startsWith(`${COOKIE}=`))?.slice(COOKIE.length+1);
  await this.db.transaction(async c=>{
   if(token) await c.query('DELETE FROM sessions WHERE token_hash=$1',[hash(token)]);
   await c.query("INSERT INTO audit_logs(user_id,action,entity_type,entity_id) VALUES($1,'DEMO_SESSION_ENDED','USER',$1)",[actor.userId]);
  });
 }
}
