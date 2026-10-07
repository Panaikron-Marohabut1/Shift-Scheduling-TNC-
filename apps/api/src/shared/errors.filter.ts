import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Injectable, Inject, Logger } from '@nestjs/common';
import { Response } from 'express';
import { Database } from '../database/database.service';
import { ActorRequest } from '../auth/access.guard';
@Catch()
@Injectable()
export class ErrorsFilter implements ExceptionFilter {
 private readonly logger=new Logger('RequestErrors');
 constructor(@Inject(Database) private readonly db:Database) {}
 async catch(error:unknown,host:ArgumentsHost) {
  const req=host.switchToHttp().getRequest<ActorRequest>(),res=host.switchToHttp().getResponse<Response>();
  const status=error instanceof HttpException?error.getStatus():500;
  const payload=error instanceof HttpException?error.getResponse():{code:'SAVE_FAILED',message:'บันทึกไม่สำเร็จ ข้อมูลยังไม่เปลี่ยน กรุณาลองอีกครั้ง'};
  if(status===403&&req.actor) {
   try {await this.db.query("INSERT INTO audit_logs(user_id,action,entity_type,entity_id,new_value) VALUES($1,'ACCESS_DENIED','USER',$1,$2)",[req.actor.userId,JSON.stringify({method:req.method,path:req.path})]);}
   catch {this.logger.error('Could not persist authorization denial.');}
  }
  if(status>=500)this.logger.error('Operation failed; transaction rolled back.');
  res.status(status).json(typeof payload==='object'?{statusCode:status,...payload}:{statusCode:status,message:payload});
 }
}
