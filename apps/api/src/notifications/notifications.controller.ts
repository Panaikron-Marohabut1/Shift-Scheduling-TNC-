import { BadRequestException, Controller, Get, Inject, NotFoundException, Param, Patch, Req } from '@nestjs/common';
import { Database } from '../database/database.service';
import { ActorRequest } from '../auth/access.guard';
@Controller('api/notifications')
export class NotificationsController {
 constructor(@Inject(Database) private readonly db:Database) {}
 @Get() async list(@Req() req:ActorRequest) { return (await this.db.query('SELECT notification_id,request_id,title,message,is_read,created_at FROM notifications WHERE user_id=$1 ORDER BY notification_id DESC LIMIT 30',[req.actor.userId])).rows; }

 @Patch('read-all') async readAll(@Req() req:ActorRequest) {
  const {rows}=await this.db.query('UPDATE notifications SET is_read=true WHERE user_id=$1 AND NOT is_read RETURNING notification_id',[req.actor.userId]);
  return {notificationIds:rows.map(row=>row.notification_id)};
 }

 @Patch(':notificationId/read') async read(@Req() req:ActorRequest,@Param('notificationId') notificationId:string) {
  const id=Number(notificationId);
  if(!/^\d+$/.test(notificationId)||id<1||id>2147483647) {
   throw new BadRequestException({code:'INVALID_NOTIFICATION_ID',message:'รหัสแจ้งเตือนไม่ถูกต้อง'});
  }
  const result=await this.db.query('UPDATE notifications SET is_read=true WHERE user_id=$1 AND notification_id=$2 RETURNING notification_id',[req.actor.userId,id]);
  if(!result.rowCount) throw new NotFoundException({code:'NOTIFICATION_NOT_FOUND',message:'ไม่พบแจ้งเตือนนี้'});
  return {notificationIds:[id]};
 }
}
