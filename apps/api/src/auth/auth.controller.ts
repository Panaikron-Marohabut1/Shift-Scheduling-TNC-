import { Body, Controller, Get, Post, Req, Res, Inject } from '@nestjs/common';
import { Response } from 'express';
import { ActorRequest, Public } from './access.guard';
import { AuthService, COOKIE } from './auth.service';
import { id } from '../shared/input';
import { settings } from '../config';
import { integrationReadiness } from '../integrations/contracts';
@Controller('api')
export class AuthController {
 constructor(@Inject(AuthService) private readonly auth:AuthService) {}
 @Public() @Get('demo/accounts') accounts() { return this.auth.accounts(); }
 @Public() @Post('demo/session') async login(@Body() body:Record<string,unknown>,@Res({passthrough:true}) res:Response) {
  const {token,actor}=await this.auth.create(id(body?.userId));
  res.cookie(COOKIE,token,{httpOnly:true,sameSite:'strict',secure:false,path:'/',maxAge:settings().hours*3600000});
  return {actor,mode:'DEMO',integrations:integrationReadiness};
 }
 @Get('me') me(@Req() req:ActorRequest) { return {actor:req.actor,mode:'DEMO',integrations:integrationReadiness}; }
 @Post('auth/logout') async logout(@Req() req:ActorRequest,@Res({passthrough:true}) res:Response) {
  await this.auth.logout(req.headers.cookie,req.actor); res.clearCookie(COOKIE,{path:'/'}); return {ok:true};
 }
}
