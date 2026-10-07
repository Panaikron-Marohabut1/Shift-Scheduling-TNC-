import { Body, Controller, Get, Post, Query, Req, Param, Headers, BadRequestException, Inject } from '@nestjs/common';
import { ActorRequest } from '../auth/access.guard';
import { RequestsService, SwapInput } from './requests.service';
import { id, pathId, text } from '../shared/input';
const swap=(body:Record<string,unknown>):SwapInput=>({assignmentId:id(body?.assignmentId),targetAssignmentId:id(body?.targetAssignmentId),assignmentVersion:id(body?.assignmentVersion),targetVersion:id(body?.targetVersion)});
@Controller('api')
export class RequestsController {
 constructor(@Inject(RequestsService) private readonly service:RequestsService) {}
 @Get('swap/candidates') candidates(@Req() req:ActorRequest,@Query('assignmentId') value:string) { return this.service.candidates(req.actor,pathId(value)); }
 @Post('swap/validate') validate(@Req() req:ActorRequest,@Body() body:Record<string,unknown>) { return this.service.validate(req.actor,swap(body)); }
 @Post('requests') create(@Req() req:ActorRequest,@Body() body:Record<string,unknown>,@Headers('idempotency-key') key:string) { return this.service.create(req.actor,swap(body),key); }
 @Get('requests') list(@Req() req:ActorRequest) { return this.service.list(req.actor); }
 @Post('requests/:requestId/cancel') cancel(@Req() req:ActorRequest,@Param('requestId') value:string,@Body() body:Record<string,unknown>,@Headers('idempotency-key') key:string) {
  return this.service.cancel(req.actor,pathId(value),id(body?.expectedVersion),key);
 }
 @Post('requests/:requestId/decisions') decision(@Req() req:ActorRequest,@Param('requestId') value:string,@Body() body:Record<string,unknown>,@Headers('idempotency-key') key:string) {
  if(!body||!['APPROVE','REJECT'].includes(body.decision as string)) throw new BadRequestException({code:'INVALID_DECISION',message:'คำตัดสินไม่ถูกต้อง'});
  return this.service.decision(req.actor,pathId(value),{decision:body.decision as 'APPROVE'|'REJECT',expectedVersion:id(body.expectedVersion),reason:text(body.reason)},key);
 }
}
