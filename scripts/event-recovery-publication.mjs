import {execFileSync} from 'node:child_process';
import {appendFile} from 'node:fs/promises';

// A successful no-op recovery must not redeploy the site every half hour.
const id=process.env.RECOVERY_RUN_ID;
if(!/^\d+$/.test(id||''))throw new Error('Invalid recovery run id');
const commits=execFileSync('git',['log','-50','--format=%s'],{encoding:'utf8'}).split(/\r?\n/);
const publish=commits.includes('chore(events): recover '+id);
await appendFile(process.env.GITHUB_OUTPUT,`publish=${publish}\n`);
console.log(publish?'Recovery published a new snapshot.':'No recovery publication; deployment skipped.');
