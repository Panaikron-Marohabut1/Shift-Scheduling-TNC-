import { Controller, Get, Post, Req, Res, Inject } from '@nestjs/common';
import { Response } from 'express';
import { ActorRequest, Public } from './access.guard';
import { AuthService } from './auth.service';
import { integrationReadiness } from '../integrations/contracts';
// Sign-in happens at the central login service (shift/Backend, Supabase Auth); see AuthService.
@Controller('api')
export class AuthController {
 constructor(@Inject(AuthService) private readonly auth:AuthService) {}
 @Get('me') async me(@Req() req:ActorRequest) {
  await this.auth.opened(req.actor);
  return {actor:req.actor,mode:'DEMO',integrations:integrationReadiness};
 }
 // Public so a signed-in but not yet linked account can still sign out (host and origin checks still apply).
 @Public() @Post('auth/logout') async logout(@Req() req:ActorRequest,@Res({passthrough:true}) res:Response) {
  const actor=await this.auth.resolve(req.headers.cookie).catch(()=>null);
  await this.auth.logout(req.headers.cookie,actor,res);
  return {ok:true,loginUrl:this.auth.loginUrl()};
 }
}
