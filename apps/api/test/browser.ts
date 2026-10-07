import 'reflect-metadata';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { Pool } from 'pg';
import { start } from '../src/main';
import { projectRoot } from '../src/config';
import { seed } from '../seeds/demo';
import { migrate } from '../src/database/migrate';

// The browser workflow writes only to this suite's temporary fixture database.
async function main() {
 const testName=`tnc_browser_${Date.now()}`;
 if(!/^tnc_browser_\d+$/.test(testName))throw new Error('Invalid test database name');
 const server=new Pool({connectionString:process.env.DATABASE_ADMIN_URL});
 let app:Awaited<ReturnType<typeof start>>|undefined,created=false;
 try {
  await server.query(`CREATE DATABASE "${testName}"`);created=true;
  for(const field of ['DATABASE_ADMIN_URL','DATABASE_URL']) {
   const url=new URL(process.env[field]!);url.pathname=`/${testName}`;process.env[field]=url.toString();
  }
  process.env.PORT='3021';process.env.APP_ORIGIN='http://localhost:3021';
  await migrate();await seed();app=await start();
  for(const script of ['browser-check.mjs','four-team-browser-check.mjs','swap-markers-browser-check.mjs','role-browser-check.mjs','schedule-browser-check.mjs','cancellation-browser-check.mjs']) {
   const code=await new Promise<number|null>((resolveDone,reject)=>{
    const child=spawn(process.execPath,[resolve(projectRoot,'scripts',script)],{cwd:projectRoot,stdio:'inherit',windowsHide:true,env:{...process.env,APP_TEST_ORIGIN:'http://localhost:3021'}});
    child.once('error',reject);child.once('exit',resolveDone);
   });
   if(code!==0)throw new Error(`Browser verification failed: ${script}`);
  }
 }finally {
  if(app)await app.close();
  if(created)await server.query(`DROP DATABASE "${testName}" WITH (FORCE)`);
  await server.end();
 }
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
