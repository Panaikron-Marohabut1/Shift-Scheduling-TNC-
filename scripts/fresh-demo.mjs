import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(resolve(root,'apps/api/package.json'));
const { Pool }=require('pg');
const file=resolve(root,'.env'),contents=readFileSync(file,'utf8');
const config=Object.fromEntries(contents.split(/\r?\n/).filter(l=>l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1)]));
if(config.APP_MODE!=='DEMO') throw new Error('Fresh fixtures are restricted to synthetic DEMO.');
const owner=new URL(config.DATABASE_ADMIN_URL),runtime=new URL(config.DATABASE_URL);
if(![owner,runtime].every(u=>['127.0.0.1','localhost'].includes(u.hostname))||owner.pathname!==runtime.pathname) throw new Error('Expected one local demo database.');
try {
 await fetch(`${config.APP_ORIGIN}/api/health`,{signal:AbortSignal.timeout(1500)});
 throw new Error('Stop the application before preparing a fresh demo. Existing evidence will be retained.');
} catch(error) {if(error.message.startsWith('Stop the application'))throw error;}
const name=`tnc_demo_${Date.now()}`;
if(!/^tnc_demo_\d+$/.test(name))throw new Error('Invalid generated database name.');
const pool=new Pool({connectionString:owner.toString()});
try {await pool.query(`CREATE DATABASE "${name}"`);} finally {await pool.end();}
owner.pathname=`/${name}`;runtime.pathname=`/${name}`;
const env={...process.env,...config,DATABASE_ADMIN_URL:owner.toString(),DATABASE_URL:runtime.toString()};
for(const path of ['src/database/migrate.ts','seeds/demo.ts']) {
 const result=spawnSync(process.execPath,[resolve(root,'apps/api/node_modules/tsx/dist/cli.mjs'),resolve(root,'apps/api',path)],{cwd:root,env,stdio:'inherit',windowsHide:true});
 if(result.status!==0)throw new Error('Fixture preparation failed. Original database and configuration remain intact.');
}
const backup=resolve(root,'.local/env-backups');mkdirSync(backup,{recursive:true});
writeFileSync(resolve(backup,`${name}.env`),contents);
writeFileSync(file,contents.replace(/^DATABASE_ADMIN_URL=.*$/m,`DATABASE_ADMIN_URL=${owner}`).replace(/^DATABASE_URL=.*$/m,`DATABASE_URL=${runtime}`));
console.log(`Fresh synthetic fixture ready: ${name}. Previous databases and audit evidence were preserved. Start the application again.`);
