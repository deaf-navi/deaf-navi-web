import {readFile} from 'node:fs/promises';
import {createComplimentaryClient} from './complimentary-text-client.mjs';

// Operator aid only: this command does not approve, publish, or change source evidence.
try {
  const chunks=[];for await(const chunk of process.stdin)chunks.push(chunk);
  const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if(input.publicDataReviewed!==true)throw new Error('Public-data review is required');
  const research=process.argv.includes('--research');
  const generate=createComplimentaryClient({key:(await readFile(process.env.DEAFNAVI_OPENAI_KEY_FILE,'utf8')).trim(),project:process.env.DEAFNAVI_OPENAI_PROJECT_ID,stateDir:process.env.DEAFNAVI_AI_STATE_DIR,allowResearch:research});
  const result=await generate(input.items,{purpose:input.purpose,runMode:research?'research':'routine',modelOverride:input.modelOverride});
  process.stdout.write(JSON.stringify(result)+'\n');
}catch(error){process.stderr.write('PUBLIC_TEXT_REVIEW_UNAVAILABLE: '+(error.code==='complimentary_unavailable'?error.message:'Configuration or input requires review')+'\n');process.exitCode=1;}
