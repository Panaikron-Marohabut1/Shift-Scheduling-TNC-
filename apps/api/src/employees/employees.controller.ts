import { Controller, Get, Req, Inject, ForbiddenException } from '@nestjs/common';
import { Database } from '../database/database.service';
import { ActorRequest } from '../auth/access.guard';
import { localDemoAccess } from '../admin-access/demo-access';
import { bangkokWorkDate } from '../requests/swap-request-time';
@Controller('api/employees')
export class EmployeesController {
 constructor(@Inject(Database) private readonly db:Database) {}
 @Get() async read(@Req() req:ActorRequest) {
  if(!['EMPLOYEE','SUPERVISOR','HR'].includes(req.actor.role))throw new ForbiddenException({code:'ACTION_DENIED',message:'บัญชีนี้ไม่มีสิทธิ์อ่านรายชื่อพนักงานภายใน'});
  const {employeeId,teamId,role}=req.actor;
  const columns='e.employee_id,e.employee_code,e.first_name,e.last_name,e.position,t.team_id,t.team_code,t.team_name';
  if(localDemoAccess(this.db)) {
   const today=bangkokWorkDate(new Date());
   return (await this.db.query(`SELECT ${columns} FROM employees e
    JOIN teams t ON t.team_id=shiftflow_policy.employee_team_on(e.employee_id,e.team_id,$3::date)
    WHERE t.team_id=(SELECT shiftflow_policy.employee_team_on(employee_id,team_id,$3::date)
     FROM employees WHERE employee_id=$1) OR $2='HR' ORDER BY e.employee_id`,[employeeId,role,today])).rows;
  }
  return (await this.db.query(`SELECT ${columns} FROM employees e JOIN teams t USING(team_id)
   WHERE e.team_id=$1 OR $2='HR' ORDER BY employee_id`,[teamId,role])).rows;
 }
}
