import { Controller, Get, Post, Req, Res, Inject } from '@nestjs/common';
import { Response } from 'express';
import { ActorRequest, Public } from './access.guard';
import { AuthService } from './auth.service';
import { integrationReadiness } from '../integrations/contracts';
import { SwapQuotaService } from '../requests/swap-quota.service';
import { SchedulesService } from '../schedules/schedules.service';
// Sign-in happens at the central login service (apps/auth, Supabase Auth); see AuthService.
@Controller('api')
export class AuthController {
 constructor(@Inject(AuthService) private readonly auth:AuthService,@Inject(SwapQuotaService) private readonly quota:SwapQuotaService,@Inject(SchedulesService) private readonly schedules:SchedulesService) {}
 @Get('me') async me(@Req() req:ActorRequest) {
  await this.auth.opened(req.actor);
  const swapPolicy=this.quota.localPilotEnabled();
  const centralSwap=['EMPLOYEE','SUPERVISOR'].includes(req.actor.role)&&swapPolicy;
  const monthClose=this.schedules.localMonthCloseEnabled();
  const hrClosedRoster=req.actor.role==='HR'&&monthClose;
  return {actor:req.actor,mode:'DEMO',integrations:integrationReadiness,capabilities:{centralSwap,swapPolicy,hrClosedRoster,monthClose}};
 }
 // Public so a signed-in but not yet linked account can still sign out (host and origin checks still apply).
 @Public() @Post('auth/logout') async logout(@Req() req:ActorRequest,@Res({passthrough:true}) res:Response) {
  const actor=await this.auth.resolve(req.headers.cookie).catch(()=>null);
  await this.auth.logout(req.headers.cookie,actor,res);
  return {ok:true,loginUrl:this.auth.loginUrl()};
 }
}
