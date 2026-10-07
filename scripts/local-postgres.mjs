import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const local = resolve(root, '.local');
const bin = resolve(local, 'pgsql/bin');
const data = resolve(local, 'pg-data');
const envFile = resolve(root, '.env');
const action = process.argv[2] ?? 'start';
if(process.platform !== 'win32') throw new Error('Portable setup is Windows only; configure an existing PostgreSQL instance with .env on other platforms.');
function run(command, args) {
 const result = spawnSync(command, args, { cwd: root, encoding:'utf8', windowsHide:true });
 if(result.status !== 0) throw new Error(`${command.split(/[\\/]/).pop()} failed: ${result.stderr || result.stdout}`);
 return result.stdout;
}
mkdirSync(local,{recursive:true});
if(action==='setup') {
 if(!existsSync(resolve(bin,'postgres.exe'))) {
  console.log('Preparing official portable PostgreSQL binaries…');
  run('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',resolve(root,'scripts/postgres-download.ps1')]);
 }
 if(!existsSync(envFile)) {
  const admin = randomBytes(24).toString('hex'), app = randomBytes(24).toString('hex');
  writeFileSync(envFile,`DATABASE_URL=postgresql://shiftflow_app:${app}@127.0.0.1:54329/shiftflow_demo\nDATABASE_ADMIN_URL=postgresql://shiftflow_owner:${admin}@127.0.0.1:54329/shiftflow_demo\nAPP_MODE=DEMO\nHOST=127.0.0.1\nPORT=3000\nAPP_ORIGIN=http://localhost:3000\nSESSION_HOURS=12\nAUDIT_RETENTION_DAYS=90\n`);
 }
 const env=Object.fromEntries(readFileSync(envFile,'utf8').split(/\r?\n/).filter(l=>l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1)]));
 const adminUrl=new URL(env.DATABASE_ADMIN_URL), appUrl=new URL(env.DATABASE_URL);
 if(!existsSync(resolve(data,'PG_VERSION'))) {
  const pwfile=resolve(local,'init-password');
  writeFileSync(pwfile,decodeURIComponent(adminUrl.password));
  run(resolve(bin,'initdb.exe'),['-D',data,'-U','shiftflow_owner','--pwfile',pwfile,'--auth=scram-sha-256','--encoding=UTF8','--locale=C']);
  // Credential stays only in ignored local data, never printed or committed.
  writeFileSync(pwfile,'');
 }
 start();
 const oldPassword=process.env.PGPASSWORD;
 process.env.PGPASSWORD=decodeURIComponent(adminUrl.password);
 try {
  const args=['-h','127.0.0.1','-p','54329','-U','shiftflow_owner','-d','postgres','-v','ON_ERROR_STOP=1','-At'];
  if(!run(resolve(bin,'psql.exe'),[...args,'-c',"SELECT 1 FROM pg_roles WHERE rolname='shiftflow_app'"]).trim())
   run(resolve(bin,'psql.exe'),[...args,'-c',`CREATE ROLE shiftflow_app LOGIN PASSWORD '${decodeURIComponent(appUrl.password)}'`]);
  if(!run(resolve(bin,'psql.exe'),[...args,'-c',"SELECT 1 FROM pg_database WHERE datname='shiftflow_demo'"]).trim())
   run(resolve(bin,'createdb.exe'),['-h','127.0.0.1','-p','54329','-U','shiftflow_owner','shiftflow_demo']);
 } finally { if(oldPassword===undefined) delete process.env.PGPASSWORD; else process.env.PGPASSWORD=oldPassword; }
 console.log('PostgreSQL ready on 127.0.0.1:54329. Next: db:migrate, db:seed, dev.');
} else if(action==='start') start();
else if(action==='stop') { if(existsSync(resolve(data,'postmaster.pid'))) run(resolve(bin,'pg_ctl.exe'),['-D',data,'stop','-m','fast']); console.log('PostgreSQL stopped.'); }
else throw new Error('Use setup, start or stop.');
function start() {
 if(!existsSync(resolve(data,'PG_VERSION'))) throw new Error('Run setup first.');
 const status=spawnSync(resolve(bin,'pg_ctl.exe'),['-D',data,'status'],{windowsHide:true});
 if(status.status!==0) {
  // PostgreSQL children must not inherit Node's captured pipes on Windows.
  const started=spawnSync(resolve(bin,'pg_ctl.exe'),['-D',data,'-l',resolve(local,'postgres.log'),'-o',"-p 54329 -h 127.0.0.1",'-w','start'],{windowsHide:true,stdio:'ignore'});
  if(started.status!==0) throw new Error('PostgreSQL did not start; see .local/postgres.log.');
 }
 console.log('Local PostgreSQL is running.');
}
