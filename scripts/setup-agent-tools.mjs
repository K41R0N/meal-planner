import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';

const root=process.cwd();
const prefix=path.join(process.env.XDG_DATA_HOME||path.join(os.homedir(),'.local/share'),'mealbook-tools');
const lock=JSON.parse(await fs.readFile(path.join(root,'tooling/agent-tools/plugins.lock.json'),'utf8'));
await fs.mkdir(prefix,{recursive:true});
for(const name of ['package.json','pnpm-workspace.yaml','pnpm-lock.yaml'])await fs.copyFile(path.join(root,'tooling/agent-tools',name),path.join(prefix,name));
const env={...process.env,DO_NOT_TRACK:'1',CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC:'1',CLAUDE_CODE_PLUGIN_PREFER_HTTPS:'1'};
function run(bin,args,cwd=root){const result=spawnSync(bin,args,{cwd,env,stdio:'inherit'});if(result.status!==0)throw new Error(`${bin} failed (${result.status}). No subsequent setup steps ran.`);}
run('pnpm',['--dir',prefix,'install','--frozen-lockfile']);
const cli=path.join(prefix,'node_modules/.bin/claude');
for(const item of lock.sources.filter(item=>item.plugin)){
 const folder=path.join(prefix,'plugin-sources',item.plugin==='compound-engineering'?'compound':'impeccable');
 try{await fs.access(path.join(folder,'.git'));}catch{await fs.mkdir(path.dirname(folder),{recursive:true});run('git',['clone','--depth','1',`https://github.com/${item.repo}.git`,folder]);}
 run('git',['fetch','--depth','1','origin',item.revision],folder);
 run('git',['checkout','--detach',item.revision],folder);
 run(cli,['plugin','install',item.plugin,'--marketplace',folder,'--scope','project','--json']);
}
run(cli,['plugin','marketplace','add',root]);
for(const plugin of ['awwwards@mealbook-design','jury@mealbook-design'])run(cli,['plugin','install',plugin,'--scope','project','--json']);
run(cli,['plugin','list','--json']);
console.log('Pinned native plugins installed for this project. Hooks and skill-shell execution stay disabled. This command does not start an LLM session, publish, or push Git.');
