import { Controller, Get, Req, Inject } from '@nestjs/common';
import { Database } from '../database/database.service';
import { ActorRequest } from '../auth/access.guard';
@Controller('api/notifications')
export class NotificationsController {
 constructor(@Inject(Database) private readonly db:Database) {}
 @Get() async list(@Req() req:ActorRequest) { return (await this.db.query('SELECT notification_id,request_id,title,message,is_read,created_at FROM notifications WHERE user_id=$1 ORDER BY notification_id DESC LIMIT 30',[req.actor.userId])).rows; }
}
