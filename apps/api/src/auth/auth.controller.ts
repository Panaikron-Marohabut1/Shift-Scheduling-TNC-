import { Controller, Get, Post, Req, Res, Inject } from '@nestjs/common';
import { Response } from 'express';
import { ActorRequest, DemoAdminAllowed, Public } from './access.guard';
import { AuthService } from './auth.service';
import { integrationReadiness } from '../integrations/contracts';
import { SwapQuotaService } from '../requests/swap-quota.service';
import { SchedulesService } from '../schedules/schedules.service';
import { settings } from '../config';
import { MAX_CONSECUTIVE_DAYS } from '../validation/validation.service';
// Sign-in happens at the central login service (apps/auth, Supabase Auth); see AuthService.
@Controller('api')
export class AuthController {
 constructor(@Inject(AuthService) private readonly auth:AuthService,@Inject(SwapQuotaService) private readonly quota:SwapQuotaService,@Inject(SchedulesService) private readonly schedules:SchedulesService) {}
 @DemoAdminAllowed() @Get('me') async me(@Req() req:ActorRequest) {
  await this.auth.opened(req.actor);
  const swapPolicy=this.quota.localPilotEnabled();
  const centralSwap=['EMPLOYEE','SUPERVISOR'].includes(req.actor.role)&&swapPolicy;
  const centralLeave=['EMPLOYEE','SUPERVISOR'].includes(req.actor.role)&&await this.schedules.leaveEnabled();
  const centralOT=['EMPLOYEE','SUPERVISOR'].includes(req.actor.role)&&await this.schedules.otEnabled();
  const centralHoliday=centralLeave&&await this.schedules.holidayEnabled();
  const absenceTracking=['EMPLOYEE','SUPERVISOR','MANAGER'].includes(req.actor.role)&&await this.schedules.absenceEnabled();
  const monthClose=this.schedules.localMonthCloseEnabled();
  const hrClosedRoster=req.actor.role==='HR'&&monthClose;
  const peopleManagement=this.auth.allowsDemoPeople(req.actor);
  const {mode,remotePilot,sharedDemo}=settings();
  return {actor:req.actor,mode,integrations:integrationReadiness,
   capabilities:{centralSwap,centralLeave,centralOT,centralHoliday,absenceTracking,swapPolicy,hrClosedRoster,monthClose,
    ...(centralSwap||centralLeave||centralOT?{maxConsecutiveWorkDays:MAX_CONSECUTIVE_DAYS}:{}),
    ...(peopleManagement?{peopleManagement}: {}),...(remotePilot||sharedDemo?{remotePilot:true}: {})}};
 }
 // Public so a signed-in but not yet linked account can still sign out (host and origin checks still apply).
 @Public() @Post('auth/logout') async logout(@Req() req:ActorRequest,@Res({passthrough:true}) res:Response) {
  const actor=await this.auth.resolve(req.headers.cookie).catch(()=>null);
  await this.auth.logout(req.headers.cookie,actor,res);
  return {ok:true,loginUrl:this.auth.loginUrl()};
 }
}
