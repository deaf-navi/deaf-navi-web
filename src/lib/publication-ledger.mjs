import {createHash} from 'node:crypto';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {polishJapaneseWithSource} from './world-translation.mjs';
import {validSourceReview,reviewedTextFingerprint} from './source-review.mjs';

export const sourceFingerprint = a => createHash('sha256').update(JSON.stringify([a.originalTitle ?? a.title, a.originalSummary ?? a.summary, a.sourceUrl ?? null])).digest('hex');
export const translationFingerprint = a => createHash('sha256').update(JSON.stringify([polishJapaneseWithSource(a.originalTitle,a.title),polishJapaneseWithSource(a.originalSummary,a.summary)])).digest('hex');
const historyEntry=record=>{const {reviewHistory,observations,...evidence}=record;return evidence;};
// 'archived' means private historical storage, not a public archive page.
const closed=record=>['archived','excluded'].includes(record?.status);
const observedId=(record,id)=>record?.observedIds?.some(x=>x.id===id);
const sourceHost=article=>{try{const host=new URL(article.sourceUrl).hostname.toLowerCase().replace(/^www\./,'');return host==='abcnews.go.com'?'abcnews.com':host;}catch{return '';}};
const sourceTitle=article=>String(article.originalTitle??article.title??'').normalize('NFKC').replace(/[’‘]/g,"'").replace(/[“”]/g,'"').replace(/\s+/g,' ').trim().toLowerCase();
const possibleClosedRepost=(article,entries)=>entries.find(x=>closed(x)&&x.article&&sourceHost(article)&&sourceHost(article)===sourceHost(x.article)&&sourceTitle(article)&&sourceTitle(article)===sourceTitle(x.article));
function assertUniqueIds(ledger){const ids=new Set();for(const row of ledger?.entries||[]){if(ids.has(row.id))throw new Error('Duplicate publication review ID');ids.add(row.id);}return ledger;}
export function sourceReviewedDecision(article,ledger,{now=Date.now()}={}) {
  const direct=(ledger?.entries||[]).filter(x=>x.id===article.id);
  if(direct.some(x=>['held','excluded','archived'].includes(x.status)))return undefined;
  return direct.find(x=>validSourceReview(x,{now}) && x.sourcePublishedAt===article.publishedAt && x.sourceFingerprint===sourceFingerprint(article)
    && x.article && x.sourceFingerprint===sourceFingerprint(x.article)
    && x.sourcePublishedAt===x.article.publishedAt
    && x.reviewedTextFingerprint===reviewedTextFingerprint(x.article)
    && x.translationFingerprint===translationFingerprint(x.article));
}
// The ledger is the source for an explicitly reviewed correction. A later
// machine translation cannot replace it while the original source is unchanged.
// Do not reinsert an absent/expired article into the feed.
export function applyApprovedWorldTranslation(article,ledger) {
  const approved=(ledger?.entries||[]).find(x=>x.id===article.id
    && x.status==='approved' && x.reviewedBy==='human' && Number.isFinite(Date.parse(x.reviewedAt)) && Date.parse(x.reviewedAt)<=Date.now()
    && x.sourceFingerprint===sourceFingerprint(article) && x.article && x.sourceFingerprint===sourceFingerprint(x.article)
    && x.article.publishedAt===article.publishedAt
    && x.translationFingerprint===translationFingerprint(x.article));
  if(approved){const {japanesePostEditModel,...clean}=article;return {...clean,title:approved.article.title,summary:approved.article.summary,japanesePostEditEngine:'human-review',japaneseReviewedAt:approved.reviewedAt};}
  const sourced=sourceReviewedDecision(article,ledger);
  if(!sourced)return article;
  return {...article,title:sourced.article.title,summary:sourced.article.summary,
    ...(sourced.correctionTopic?{topic:sourced.correctionTopic,topicLabel:sourced.correctionTopicLabel}:{}),
    japanesePostEditEngine:'codex-opus-source-review',japanesePostEditModel:'claude-opus-5-5',japaneseReviewedAt:sourced.reviewedAt};
}
export function heldPublicationReason(article, ledger) {
  const direct=(ledger?.entries||[]).filter(x=>x.id===article.id);
  // A changed feed ID must not evade an existing hold. Only blocking decisions
  // may use this fallback; approvals and corrections always require the exact ID.
  const blocking=direct.find(x=>['held','excluded','archived'].includes(x.status)&&x.reason!=='duplicate')
    || (!direct.length&&(ledger?.entries||[]).find(x=>['held','excluded','archived'].includes(x.status)&&x.reason!=='duplicate'&&x.sourceFingerprint===sourceFingerprint(article)));
  const alias=(ledger?.entries||[]).find(x=>closed(x)&&observedId(x,article.id));
  if(blocking||alias){const record=blocking||alias;return closed(record)&&record.sourceFingerprint!==sourceFingerprint(article)?'source-changed-after-closure':record.reason||'publication-review-required';}
  if(possibleClosedRepost(article,ledger?.entries||[]))return 'possible-repost-of-closed';
  const decision = direct.find(x=>x.status==='approved'&&x.reviewedBy==='human')||direct[0];
  if (!decision || decision.reason==='duplicate') return null;
  if (decision.status==='approved' && decision.reviewedBy==='human' && Number.isFinite(Date.parse(decision.reviewedAt)) && Date.parse(decision.reviewedAt)<=Date.now()
    && decision.sourceFingerprint===sourceFingerprint(article)
    && decision.article?.publishedAt===article.publishedAt
    && decision.translationFingerprint===translationFingerprint(article)) return null;
  if(sourceReviewedDecision(article,ledger)?.reviewedTextFingerprint===reviewedTextFingerprint(article))return null;
  return ['approved','source-verified'].includes(decision.status) ? 'review-expired-or-changed' : decision.reason;
}
// Restore a reviewed omission only to the snapshot it was reviewed against.
// A subsequent curation timestamp cannot resurrect old articles from this ledger.
export function restoreSourceReviewedArticles(data,ledger,{now=Date.now()}={}) {
  const articles=[...(data.articles||[])], snapshot=Date.parse(data.generatedAt);
  for(const entry of ledger?.entries||[]) {
    const a=entry.article, published=Date.parse(a?.publishedAt);
    if(!a || entry.restorationSnapshot!==data.generatedAt || !sourceReviewedDecision(a,{entries:[entry]},{now}) || !sourceReviewedDecision(a,ledger,{now})
      || !Number.isFinite(snapshot) || !Number.isFinite(published) || published>snapshot
      || published<Math.max(snapshot,now)-90*86400000
      || articles.some(x=>x.id===a.id||sourceFingerprint(x)===sourceFingerprint(a)))continue;
    const index=articles.findIndex(x=>Date.parse(x.publishedAt)<published);
    articles.splice(index<0?articles.length:index,0,{...a,publicationRestoredSnapshot:data.generatedAt});
  }
  return {...data,articles};
}
// Public source material only; this ledger stays outside docs/ and never enters
// app payloads. Rebuilds preserve a hold even after the bad item leaves the feed.
export function mergePublicationLedger(previous, input, result, {now=new Date().toISOString()}={}) {
  assertUniqueIds(previous);
  const entries = new Map((previous?.entries || []).map(x=>[x.id,x]));
  const articles = new Map((input.articles || []).map(a=>[a.id,a]));
  for (const item of result.publicationReview?.removed || []) {
    const article = articles.get(item.id);
    if (!article || item.reason==='duplicate') continue;
    const direct=entries.get(item.id);
    const fingerprint=sourceFingerprint(article);
    const exactClosed=!direct&&[...entries.values()].find(x=>closed(x)&&x.sourceFingerprint===fingerprint);
    if(exactClosed){
      const observedIds=[...(exactClosed.observedIds||[])];if(!observedIds.some(x=>x.id===article.id))observedIds.push({id:article.id,firstSeenAt:now,publishedAt:article.publishedAt??null});
      entries.set(exactClosed.id,{...exactClosed,observedIds});continue;
    }
    const related=!direct&&[...entries.values()].find(x=>closed(x)&&observedId(x,article.id));
    const prior=direct||related;
    if(['excluded','archived'].includes(prior?.status) && prior.sourceFingerprint===fingerprint)continue;
    if(prior?.status==='held' && prior.sourceFingerprint===fingerprint && prior.translationFingerprint===translationFingerprint(article) && prior.reason===item.reason) continue;
    const original={};
    for(const key of ['id','title','summary','originalTitle','originalSummary','sourceName','sourceUrl','publishedAt','region','regionLabel','topic','translationProvider','japanesePostEditEngine','japanesePostEditModel']) if(article[key]!=null) original[key]=article[key];
    const reviewHistory=[...(prior?.reviewHistory||[])];
    if(prior?.reviewedAt)reviewHistory.push(historyEntry(prior));
    entries.set(item.id,{id:item.id,status:'held',reason:closed(prior)?'source-changed-after-closure':item.reason,firstSeenAt:prior?.firstSeenAt??now,lastSeenAt:now,sourceFingerprint:fingerprint,translationFingerprint:translationFingerprint(article),article:original,
      ...(closed(prior)?{reopenedFrom:{id:prior.id,status:prior.status,reason:prior.reason,reviewedAt:prior.reviewedAt??null},sourceArticleUrl:prior.sourceArticleUrl??null,previousSourcePublication:prior.sourcePublication??null}:{}),
      ...(item.reason==='possible-repost-of-closed'?{relatedClosedId:possibleClosedRepost(article,[...entries.values()])?.id}:{}),
      ...(prior?{originalReason:prior.originalReason||prior.reason}:{}),...(reviewHistory.length?{reviewHistory}:{}),
      ...(prior?.article && (sourceFingerprint(prior.article)!==fingerprint||translationFingerprint(prior.article)!==translationFingerprint(article))?{observations:[...(prior.observations||[]),prior.article]}:prior?.observations?{observations:prior.observations}:{})});
  }
  return {version:1,entries:[...entries.values()]};
}
export async function readPublicationLedger(root, scope) {
  try { return assertUniqueIds(JSON.parse(await readFile(join(root,'.state',`publication-review-${scope}.json`),'utf8'))); }
  catch(error) { if(error.code==='ENOENT')return {version:1,entries:[]}; throw error; }
}
export async function savePublicationLedger(root, scope, previous, input, result) {
  const ledger=mergePublicationLedger(previous,input,result);
  if(JSON.stringify(ledger)!==JSON.stringify(previous)) {
    await mkdir(join(root,'.state'),{recursive:true});
    await writeFile(join(root,'.state',`publication-review-${scope}.json`),JSON.stringify(ledger,null,2)+'\n');
  }
  return ledger;
}

// Conflict recovery must union the fetched branch's holds with the run's saved
// holds. A conflicting approval never silently clears a hold; review it again.
export function mergePublicationLedgers(current, incoming) {
  assertUniqueIds(current);assertUniqueIds(incoming);
  const entries=new Map((current?.entries||[]).map(x=>[x.id,x]));
  for(const candidate of incoming?.entries||[]) {
    const prior=entries.get(candidate.id);
    if(!prior){entries.set(candidate.id,candidate);continue;}
    if(JSON.stringify(prior)===JSON.stringify(candidate))continue;
    const supersedesOldHold=(done,hold)=>closed(done)&&hold.status==='held'&&done.sourceFingerprint&&done.sourceFingerprint===hold.sourceFingerprint
      && Number.isFinite(Date.parse(done.reviewedAt))&&Date.parse(done.reviewedAt)<=Date.now()&&Number.isFinite(Date.parse(hold.lastSeenAt??hold.reviewedAt??hold.firstSeenAt))
      && Date.parse(done.reviewedAt)>Date.parse(hold.lastSeenAt??hold.reviewedAt??hold.firstSeenAt);
    const winner=supersedesOldHold(prior,candidate)?prior:supersedesOldHold(candidate,prior)?candidate:
      prior.status==='held'?prior:candidate.status==='held'?candidate:
      closed(prior)!==closed(candidate)?(closed(prior)?prior:candidate):
      Date.parse(prior.reviewedAt||0)>=Date.parse(candidate.reviewedAt||0)?prior:candidate;
    const observations=new Map();
    for(const item of [...(prior.observations||[]),prior.article,...(candidate.observations||[]),candidate.article].filter(Boolean)) {
      const key=sourceFingerprint(item)+translationFingerprint(item);
      if(!winner.article || key!==sourceFingerprint(winner.article)+translationFingerprint(winner.article))observations.set(key,item);
    }
    const history=new Map();
    for(const record of [prior,candidate]) {
      const records=[...(record.reviewHistory||[])];
      if(record.reviewedAt)records.push(historyEntry(record));
      for(const review of records)history.set(JSON.stringify(review),review);
    }
    const observedIds=new Map();for(const record of [prior,candidate])for(const alias of record.observedIds||[])if(!observedIds.has(alias.id))observedIds.set(alias.id,alias);
    entries.set(candidate.id,{...winner,...(observedIds.size?{observedIds:[...observedIds.values()]}:{}),...(observations.size?{observations:[...observations.values()]}:{}),...(history.size?{reviewHistory:[...history.values()]}:{})});
  }
  return {version:1,entries:[...entries.values()]};
}
