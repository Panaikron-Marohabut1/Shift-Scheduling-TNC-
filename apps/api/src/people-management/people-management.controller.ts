import { Body, Controller, Get, Inject, Param, Patch, Req } from '@nestjs/common';
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
}
