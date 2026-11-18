import { Body, Controller, Get, HttpCode, Inject, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ActorRequest } from '../auth/access.guard';
import { pathId } from '../shared/input';
import { PeopleManagementService } from './people-management.service';

@Controller('api/manager/people')
export class PeopleManagementController {
 constructor(@Inject(PeopleManagementService) private readonly people:PeopleManagementService) {}

 @Get() list(@Req() req:ActorRequest) {
  return this.people.list(req.actor);
 }

 @Patch(':employeeId') update(@Req() req:ActorRequest,@Param('employeeId') employeeId:string,@Body() body:Record<string,unknown>) {
  return this.people.update(req.actor,pathId(employeeId),body);
 }

 @Get(':employeeId/production-exit') previewExit(@Req() req:ActorRequest,@Param('employeeId') employeeId:string,@Query('effectiveOn') date:string) {
  return this.people.previewExit(req.actor,pathId(employeeId),date);
 }

 @Post(':employeeId/production-exit') @HttpCode(200)
 confirmExit(@Req() req:ActorRequest,@Param('employeeId') employeeId:string,@Body() body:Record<string,unknown>) {
  return this.people.confirmExit(req.actor,pathId(employeeId),body);
 }
}
