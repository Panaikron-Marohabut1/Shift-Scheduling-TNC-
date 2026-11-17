import { Body, Controller, Get, Headers, Param, Post, Query, Req, Inject, StreamableFile, HttpCode } from '@nestjs/common';
import { ActorRequest } from '../auth/access.guard';
import { SchedulesService } from './schedules.service';
@Controller('api/schedules')
export class SchedulesController {
 constructor(@Inject(SchedulesService) private readonly service:SchedulesService) {}
 @Get() read(@Req() req:ActorRequest,@Query('month') month:string) { return this.service.month(req.actor,month); }
 @Post('assignments/:assignmentId/absence') @HttpCode(200)
 setAbsence(@Req() req:ActorRequest,@Param('assignmentId') id:string,@Headers('idempotency-key') key:string,@Body() body:unknown) {
  return this.service.setAbsence(req.actor,id,key,body);
 }
}

@Controller('api/hr')
export class ClosedRosterController {
 constructor(@Inject(SchedulesService) private readonly service:SchedulesService) {}
 @Get('closed-roster') async read(@Req() req:ActorRequest,@Query('month') month?:string) {
  return (await this.service.closedRoster(req.actor,month)).roster;
 }
 @Post('closed-roster.csv') @HttpCode(200) async download(@Req() req:ActorRequest,@Query('month') month?:string) {
  const {roster,csv}=await this.service.closedRosterCsv(req.actor,month);
  return new StreamableFile(csv!,{type:'text/csv; charset=utf-8',disposition:`attachment; filename="TNC-Closed-Roster-${roster.month}.csv"`});
 }
}
