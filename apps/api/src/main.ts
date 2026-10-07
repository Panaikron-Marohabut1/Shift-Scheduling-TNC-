import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { projectRoot, settings } from './config';
import { resolve } from 'node:path';
import express from 'express';
import { Database } from './database/database.service';
export async function start() {
 const config=settings();
 const app=await NestFactory.create(AppModule,{logger:['error','warn','log']});
 app.use((req:express.Request,res:express.Response,next:express.NextFunction)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','same-origin');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  res.setHeader('Cache-Control','no-store'); next();
 });
 app.use(express.static(resolve(projectRoot,'apps/web'),{index:'index.html',dotfiles:'deny'}));
 app.enableShutdownHooks();
 const db=app.get(Database);
 try {
  const schema=await db.query("SELECT name FROM schema_migrations WHERE name='004_request_cancellation.sql'");
  if(!schema.rowCount)throw new Error('Run db:migrate first.');
  await app.listen(config.port,config.host);
 } catch(error) {await app.close();throw error;}
 console.log(`Shift schedule TNC: ${config.origin} (synthetic data only)`);
 return app;
}
if(require.main===module) start().catch(e=>{console.error('Cannot start demo:',e.message);process.exitCode=1;});
