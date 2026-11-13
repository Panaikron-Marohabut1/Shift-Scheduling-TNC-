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

test('initial access demo only accepts the reserved admin profile on a local synthetic database',async()=>{
 await assert.rejects(()=>controller(local).pending(actor('MANAGER')),ForbiddenException);
 await assert.rejects(()=>controller(local).pending(actor('ADMIN','other-admin')),ForbiddenException);
 await assert.rejects(()=>controller(cloud).pending(actor('ADMIN')),ForbiddenException);
});

test('initial role assignment refuses Admin and validates the target before writes',async()=>{
 await assert.rejects(()=>controller(local).assign(actor('ADMIN'),'7',{role:'ADMIN'}),BadRequestException);
 await assert.rejects(()=>controller(local).assign(actor('ADMIN'),'bad',{role:'EMPLOYEE'}),BadRequestException);
});
