import { Controller, Get, Query, Req, Inject } from '@nestjs/common';
import { ActorRequest } from '../auth/access.guard';
import { SchedulesService } from './schedules.service';
@Controller('api/schedules')
export class SchedulesController {
 constructor(@Inject(SchedulesService) private readonly service:SchedulesService) {}
 @Get() read(@Req() req:ActorRequest,@Query('month') month:string) { return this.service.month(req.actor,month); }
}
