import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url));
const bin=path.join(process.env.XDG_DATA_HOME||path.join(os.homedir(),'.local/share'),'mealbook-tools/node_modules/.bin/claude');
const result=spawnSync(bin,process.argv.slice(2),{cwd:root,stdio:'inherit',env:{...process.env,DO_NOT_TRACK:'1',CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC:'1'}});
if(result.error)console.error('Native tooling is not available. Run node scripts/setup-agent-tools.mjs first.');
process.exit(result.status??1);
