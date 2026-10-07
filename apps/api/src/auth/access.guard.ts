import { CanActivate, ExecutionContext, Injectable, SetMetadata, ForbiddenException, Inject } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { settings } from '../config';
import { Actor } from '../shared/types';
export const Public=()=>SetMetadata('public',true);
export type ActorRequest=Request & { actor:Actor };
@Injectable()
export class AccessGuard implements CanActivate {
 constructor(@Inject(Reflector) private readonly reflector:Reflector,@Inject(AuthService) private readonly auth:AuthService) {}
 async canActivate(context:ExecutionContext) {
  const req=context.switchToHttp().getRequest<ActorRequest>();
  const config=settings();
  const allowedHosts=new Set([`localhost:${config.port}`,`127.0.0.1:${config.port}`]);
  if(!allowedHosts.has(req.headers.host??'')) throw new ForbiddenException({code:'LOCAL_DEMO_ONLY',message:'เดโมเปิดใช้งานเฉพาะ localhost'});
  if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.headers.origin!==config.origin) throw new ForbiddenException({code:'ORIGIN_DENIED',message:'กรุณาเปิดแอปผ่าน URL localhost ที่กำหนด'});
  if(this.reflector.getAllAndOverride('public',[context.getHandler(),context.getClass()])) return true;
  req.actor=await this.auth.resolve(req.headers.cookie);
  return true;
 }
}
