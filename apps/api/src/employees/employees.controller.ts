import { Controller, Get, Req, Inject, ForbiddenException } from '@nestjs/common';
import { Database } from '../database/database.service';
import { ActorRequest } from '../auth/access.guard';
@Controller('api/employees')
export class EmployeesController {
 constructor(@Inject(Database) private readonly db:Database) {}
 @Get() async read(@Req() req:ActorRequest) {
  if(!['EMPLOYEE','SUPERVISOR','HR'].includes(req.actor.role))throw new ForbiddenException({code:'ACTION_DENIED',message:'บัญชีนี้ไม่มีสิทธิ์อ่านรายชื่อพนักงานภายใน'});
  return (await this.db.query(`SELECT e.employee_id,e.employee_code,e.first_name,e.last_name,e.position,t.team_id,t.team_code,t.team_name FROM employees e JOIN teams t USING(team_id) WHERE e.team_id=$1 OR $2='HR' ORDER BY employee_id`,[req.actor.teamId,req.actor.role])).rows;
 }
}
