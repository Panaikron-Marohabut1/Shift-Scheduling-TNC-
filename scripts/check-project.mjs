import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
function files(dir) {return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(resolve(dir,e.name)):[resolve(dir,e.name)]);}
for(const file of [...files(resolve(root,'apps/web/src')),...files(resolve(root,'scripts'))].filter(p=>/\.(js|mjs)$/.test(p))) {
 const result=spawnSync(process.execPath,['--input-type=module','--check'],{input:readFileSync(file,'utf8'),encoding:'utf8',windowsHide:true});
 if(result.status!==0)throw new Error(`${file}: ${result.stderr}`);
}
const documents=['README.md','AGENTS.md','CLAUDE.md','.docs/02-design/prototype/alpha-demo.md','.docs/02-design/prototype/index.md','.docs/06-development/project-structure.md','prototypes/legacy-static/README.md'];
for(const file of documents) {
 const text=readFileSync(resolve(root,file),'utf8'),fences=text.split('\n').filter(l=>/^```/.test(l));
 if(fences.length%2!==0)throw new Error(`${file}: unclosed Markdown code fence.`);
 if(!text.startsWith('# '))throw new Error(`${file}: missing document title.`);
 for(const match of text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
  const target=match[1].split('#')[0];
  if(target&&!/^[a-z]+:/i.test(target)&&!existsSync(resolve(root,dirname(file),target)))throw new Error(`${file}: broken link ${target}`);
 }
}
const claudeSkill=resolve(root,'.claude/skills/audit-backlog/SKILL.md');
if(!existsSync(resolve(dirname(claudeSkill),'../../../.agents/skills/audit-backlog/SKILL.md')))throw new Error('Shared Claude audit skill reference is missing.');
if(!readFileSync(resolve(root,'CLAUDE.md'),'utf8').includes('\n@AGENTS.md\n'))throw new Error('Shared project guidance import is missing.');
console.log('JavaScript syntax and changed Markdown structure passed.');
const reviewFiles=[...files(resolve(root,'apps/api/src')),...files(resolve(root,'apps/api/migrations')),...files(resolve(root,'apps/api/seeds')),...files(resolve(root,'apps/api/test')),...files(resolve(root,'apps/web/src')),...files(resolve(root,'apps/web/styles')),...files(resolve(root,'scripts')),...[...documents,'.claude/skills/audit-backlog/SKILL.md','apps/web/index.html','apps/api/package.json','apps/api/tsconfig.json','.gitignore','.env.example','package.json','pnpm-lock.yaml','pnpm-workspace.yaml'].map(p=>resolve(root,p))];
for(const file of reviewFiles) {
 const result=spawnSync('git',['-c','core.autocrlf=false','diff','--no-index','--check','--','/dev/null',file],{cwd:root,encoding:'utf8',windowsHide:true});
 // --no-index may return 1 simply because a new file differs from /dev/null.
 if(![0,1].includes(result.status)||result.stdout.trim()||result.stderr.trim())throw new Error(`Diff whitespace check: ${result.stdout||result.stderr}`);
}
console.log('Diff whitespace checks passed for all implementation files.');
