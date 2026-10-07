import { Module, Controller, Get, ServiceUnavailableException, Inject } from '@nestjs/common';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { Database } from './database/database.service';
import { AccessGuard, Public } from './auth/access.guard';
import { AuthService } from './auth/auth.service';
import { AuthController } from './auth/auth.controller';
import { SchedulesService } from './schedules/schedules.service';
import { SchedulesController } from './schedules/schedules.controller';
import { ValidationService } from './validation/validation.service';
import { RequestsService } from './requests/requests.service';
import { RequestsController } from './requests/requests.controller';
import { AuditController } from './audit/audit.controller';
import { NotificationsController } from './notifications/notifications.controller';
import { EmployeesController } from './employees/employees.controller';
import { ErrorsFilter } from './shared/errors.filter';
@Controller('api/health')
class HealthController {
 constructor(@Inject(Database) private readonly db:Database) {}
 @Public() @Get() async health() {
  try {
   const result=await this.db.query("SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE name='002_demo_profiles.sql') AS ready");
   if(!result.rows[0].ready) throw new Error('Missing migration');
   return {status:'ok',database:'PostgreSQL',mode:'DEMO'};
  } catch { throw new ServiceUnavailableException({code:'DATABASE_UNAVAILABLE',message:'ฐานข้อมูลยังไม่พร้อม กรุณาตรวจการเริ่ม PostgreSQL และ migration'}); }
 }
}
@Module({
 controllers:[HealthController,AuthController,SchedulesController,RequestsController,AuditController,NotificationsController,EmployeesController],
 providers:[Database,AuthService,SchedulesService,RequestsService,ValidationService,{provide:APP_GUARD,useClass:AccessGuard},{provide:APP_FILTER,useClass:ErrorsFilter}]
})
export class AppModule {}
