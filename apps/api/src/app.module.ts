import { Module, Controller, Get, ServiceUnavailableException, Inject } from '@nestjs/common';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { Database } from './database/database.service';
import { AccessGuard, Public } from './auth/access.guard';
import { AuthService } from './auth/auth.service';
import { AuthController } from './auth/auth.controller';
import { SchedulesService } from './schedules/schedules.service';
import { ClosedRosterController, SchedulesController } from './schedules/schedules.controller';
import { ValidationService } from './validation/validation.service';
import { RequestsService } from './requests/requests.service';
import { RequestsController } from './requests/requests.controller';
import { SwapQuotaController } from './requests/swap-quota.controller';
import { SwapQuotaService } from './requests/swap-quota.service';
import { AuditController } from './audit/audit.controller';
import { NotificationsController } from './notifications/notifications.controller';
import { EmployeesController } from './employees/employees.controller';
import { AdminAccessController } from './admin-access/admin-access.controller';
import { PeopleManagementController } from './people-management/people-management.controller';
import { PeopleManagementService } from './people-management/people-management.service';
import { ErrorsFilter } from './shared/errors.filter';
import { isLocalSchedulingDatabase, pilotMigrations, settings } from './config';
@Controller('api/health')
class HealthController {
 constructor(@Inject(Database) private readonly db:Database) {}
 @Public() @Get() async health() {
  try {
   const local=isLocalSchedulingDatabase(new URL(this.db.pool.options.connectionString!));
   const {mode,remotePilot,sharedDemo}=settings();
   const required=remotePilot||sharedDemo?pilotMigrations:local?['002_demo_profiles.sql','008_admin_demo_access.sql','009_effective_demo_teams.sql']:['002_demo_profiles.sql'];
   const result=await this.db.query('SELECT count(*)::int AS installed FROM schema_migrations WHERE name=ANY($1::text[])',[required]);
   if(result.rows[0].installed!==required.length) throw new Error('Missing migration');
   return {status:'ok',database:'PostgreSQL',mode};
  } catch { throw new ServiceUnavailableException({code:'DATABASE_UNAVAILABLE',message:'ฐานข้อมูลยังไม่พร้อม กรุณาตรวจการเริ่ม PostgreSQL และ migration'}); }
 }
}
@Module({
 controllers:[HealthController,AuthController,SchedulesController,ClosedRosterController,RequestsController,SwapQuotaController,AuditController,NotificationsController,EmployeesController,AdminAccessController,PeopleManagementController],
 providers:[Database,AuthService,SchedulesService,RequestsService,SwapQuotaService,ValidationService,PeopleManagementService,{provide:APP_GUARD,useClass:AccessGuard},{provide:APP_FILTER,useClass:ErrorsFilter}]
})
export class AppModule {}
