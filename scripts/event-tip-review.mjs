import {publicCopyIssues} from '../src/lib/public-copy.mjs';
import {createHash} from 'node:crypto';
import {fetchThumbnailResource} from '../src/lib/thumbnail-fetch.mjs';
import {prepareCurationReview} from './prepare-curation-review.mjs';
import {reviewCurationTasks} from './curation-review.mjs';
import {cleanHtml} from '../src/lib/text.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
const compact=s=>String(s??'').normalize('NFKC').replace(/\s/g,'');
const reasonText={
 'public-copy-review-required':'公開文に内部向けの調査メモがあります。Codexで文面を整理して再確認してください。',
 'source-changed':'公式告知または会場案内が変わりました。再確認してください。',
 'source-unavailable':'公式HTMLを取得できません。画像・SNS・転送先は個別に確認してください。',
 'review-expired':'根拠の確認から48時間が経過しました。再確認してください。',
 'account-check-required':'無料枠の当日確認が必要です。APIへ送信せず保留しています。',
 'details-differ':'日程・会場・申込・交流方法・受付状態が一致しません。',
 'unsafe-or-private-text':'個人情報・不審な勧誘・中止や満席などの記載を個別に確認してください。',
 'api-unavailable':'APIの処理が完了していません。利用台帳と保存結果の確認が必要です。',
 'publication-conflict':'掲載時に重複・更新競合などが見つかりました。管理画面で確認してください。'
};
export function tipPrivacyRisk(text){
 // Supplement actual sharing review; these rules alone NEVER authorize sharing.
 return /[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:0\d{1,4}[-ー ]?){2}\d{3,4}|個人名義|暗号資産|ギフトカード|必ず儲|投資勧誘|本人確認書類|口座番号|病歴|診断書|ignore (?:all|previous)|system prompt|中止|延期|満席|受付終了/i.test(text);
}
export async function reviewEventTips({queue,stateDir,now=Date.now(),gateReady,prepareSharing,generate,publish,fetchResource=fetchThumbnailResource,stopAfterError=false}){
 const result={version:1,generatedAt:new Date(now).toISOString(),selected:0,cached:0,submittedThisRun:0,published:0,exceptions:0,unreviewed:0,deferred:0,entries:[]};
 const sourceCache=new Map();
 for(const row of queue.items??[]){
  if(!row.review){result.unreviewed++;continue;}
  if(result.selected>=4||stopAfterError){result.deferred++;continue;}
  result.selected++;
  const r=row.review,base={id:row.id,revision:row.revision,payloadHash:row.payloadHash};let decision;
  const exception=code=>({...base,status:'exception',reason:reasonText[code]??reasonText['details-differ']});
  try{
   if(publicCopyIssues(r.record,'cafe').length)throw Error('public-copy-review-required');
   const age=now-Date.parse(r.reviewedAt);
   if(!Number.isFinite(age)||age<0||age>=48*3600000)throw Error('review-expired');
   if(JSON.stringify(row.photoHashes)!==JSON.stringify((r.photos??[]).map(p=>p.sha256)))throw Error('details-differ');
   if(!gateReady)throw Error('account-check-required');
   if(tipPrivacyRisk(r.excerpt+' '+r.record.name))throw Error('unsafe-or-private-text');
   const fetchExact=async url=>{
    if(!sourceCache.has(url))sourceCache.set(url,fetchResource(url,{userAgent:'Codex-DeafNavi-Verification',maxBytes:800000,timeoutMs:15000,allowUrl:u=>u===url}));
    const response=await sourceCache.get(url);
    if(response.status!==200||!/text\/html|application\/xhtml\+xml/i.test(response.headers?.['content-type']??''))throw Error('source-unavailable');
    return response;
   };
   const source=await fetchExact(r.sourceUrl),venue=await fetchExact(r.record.venue_url);
   if(sha(source.text)!==r.sourceRawHash||sha(venue.text)!==r.venueRawHash)throw Error('source-changed');
   const visible=cleanHtml(venue.text.replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi,' ').replace(/<!--[\s\S]*?(?:-->|$)/g,' ').replace(/<[^>]*>/g,' '));
   if([r.venueQuote,r.record.venue_name,r.record.address].some(x=>!x||!compact(visible).includes(compact(x))))throw Error('details-differ');
   const communication=r.communication==='both'?['sign','writing']:[r.communication];
   const target={kind:'cafe',recordId:row.id,title:r.record.name,sourceUrl:r.sourceUrl,sourceMode:'html',officialVerified:true,fragments:[r.excerpt],sharingReviewedAt:r.reviewedAt,
    baseline:{startDate:r.record.activity_date,venue:r.record.venue_name,application:r.application,status:'scheduled',communication}};
   const prepared=await prepareCurationReview([target],{now,fetchResource:fetchExact});
   if(prepared.tasks.length!==1)throw Error('details-differ');
   const task=prepared.tasks[0];target.approvedDocumentHash=task.sourceDocumentHash;
   const allowed=await prepareSharing([task],[target]);
   // prepareSharing enforces the same exact-text approval and allowance lock as
   // server curation. New photo bytes and original submission text never leave PHP.
   const report=await reviewCurationTasks([task],{generate,stateDir,now,canSubmit:allowed});
   result.cached+=report.cached;result.submittedThisRun+=report.submitted;
   const e=report.entries[0],facts=e.decision?.facts??[];
   const exact=(field,value)=>facts.filter(f=>f.field===field).length===1&&facts.find(f=>f.field===field)?.value===value;
   if(e.status!=='corroborated'||!exact('startDate',r.record.activity_date)||!exact('venue',r.record.venue_name)||!exact('application',r.application)||!exact('status','scheduled')
    ||JSON.stringify(facts.filter(f=>f.field==='communication').map(f=>f.value).sort())!==JSON.stringify([...communication].sort()))throw Error('details-differ');
   decision={...base,status:'ready',sourceRawHash:r.sourceRawHash,venueRawHash:r.venueRawHash,checkedAt:new Date(now).toISOString(),engine:'openai_complimentary',model:e.model,decision:e.decision};
  }catch(error){
   const known=Object.hasOwn(reasonText,error.message);
   decision=exception(known?error.message:'api-unavailable');
   if(!known){result.submittedThisRun=null;stopAfterError=true;}
  }
  let applied;
  try{applied=await publish(decision);}catch{
   // Publication may have committed before transport failed. Readback belongs to
   // the PHP publisher on the next run; never resend a successful API request.
   applied={status:'publication-unknown',id:row.id};stopAfterError=true;
  }
  if(applied.status==='published'||applied.status==='already-published')result.published++;else result.exceptions++;
  result.entries.push({id:row.id,status:applied.status,reason:decision.reason??(applied.status==='published'?null:reasonText['publication-conflict']),recordId:applied.recordId??null});
 }
 return result;
}
