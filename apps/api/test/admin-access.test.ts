import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { AdminAccessController } from '../src/admin-access/admin-access.controller';
import { ActorRequest } from '../src/auth/access.guard';
import { Database } from '../src/database/database.service';

const local='postgresql://localhost/shiftflow_demo';
const cloud='postgresql://db.example.supabase.co/postgres';
const actor=(role:string,demoProfile='admin-demo')=>({actor:{userId:25,role,demoProfile}} as ActorRequest);
function controller(connectionString:string) {
 return new AdminAccessController({pool:{options:{connectionString}},
  query:async()=>{throw new Error('Access check must run before querying the database');},
  transaction:async()=>{throw new Error('Input check must run before starting a transaction');},
 } as unknown as Database);
}

test('initial access rejects other profiles and arbitrary cloud databases',async()=>{
 await assert.rejects(()=>controller(local).pending(actor('MANAGER')),ForbiddenException);
 await assert.rejects(()=>controller(local).pending(actor('ADMIN','other-admin')),ForbiddenException);
 await assert.rejects(()=>controller(cloud).pending(actor('ADMIN')),ForbiddenException);
});

test('shared demo accepts only the reserved Admin on its configured database',async t=>{
 const previous=process.env.APP_MODE;
 process.env.APP_MODE='SHARED_DEMO';
 t.after(()=>{if(previous===undefined)delete process.env.APP_MODE;else process.env.APP_MODE=previous;});
 const shared='postgresql://tnc_backend_dev.mmesiubkvxmsklmgsepd:fixture@aws-0-ap-south-1.pooler.supabase.com:5432/postgres';
 const service=new AdminAccessController({pool:{options:{connectionString:shared}},query:async()=>({rows:[]})} as unknown as Database);
 assert.deepEqual(await service.pending(actor('ADMIN')),{users:[]});
 await assert.rejects(()=>service.pending(actor('MANAGER')),ForbiddenException);
 await assert.rejects(()=>service.pending(actor('ADMIN','other-admin')),ForbiddenException);
 await assert.rejects(()=>controller(local).pending(actor('ADMIN')),ForbiddenException);
 await assert.rejects(()=>controller(cloud).pending(actor('ADMIN')),ForbiddenException);
});

test('initial role assignment refuses Admin and validates the target before writes',async()=>{
 await assert.rejects(()=>controller(local).assign(actor('ADMIN'),'7',{role:'ADMIN'}),BadRequestException);
 await assert.rejects(()=>controller(local).assign(actor('ADMIN'),'bad',{role:'EMPLOYEE'}),BadRequestException);
});
