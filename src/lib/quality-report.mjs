import {eventDay,eventPeriod,validEvent} from './events.mjs';
import {eventDeadline} from '../event-deadline.js';
import {sourceDispositionDigest} from './source-review.mjs';
export const INFORMATION_FIELDS={time:'時刻',fee:'料金',signup:'申込方法',deadline:'申込締切',communication:'情報の受け取り方'};
export function eventInformation(event) {
  const text=value=>String(value||'').normalize('NFKC');
  const target=text(event.target),noSignup=/(?:^|[。\n])(?:事前)?(?:申込|申し込み|予約)(?:は)?不要(?:[。\n]|$)/u.test(target);
  const values={time:/\d{1,2}\s*[:：時]|終日/.test(text(event.time)),fee:/無料|\d[\d,]*\s*円/.test(text(event.fee)),
    signup:/(?:フォーム|FAX|メール|電話|郵送|窓口)[^。\n]{0,35}(?:申込|申し込|予約)|(?:申込|申し込|予約)[^。\n]{0,35}(?:フォーム|FAX|メール|電話|郵送|窓口)|当日受付/iu.test(target),
    deadline:Boolean(eventDeadline(event)),communication:(event.communication||[]).length>0 || (event.communicationAvailability==='unavailable'&&Boolean(event.informationNotes?.communication?.trim()))};
  return Object.fromEntries(Object.keys(INFORMATION_FIELDS).map(key=>[key,
    event.informationStatus?.[key]==='not_applicable' && event.informationNotes?.[key]?.trim()?'not_applicable':
    event.informationStatus?.[key]==='unknown'?'unknown':noSignup&&['signup','deadline'].includes(key)?'not_applicable':values[key]?'confirmed':'unknown']));
}
export function qualityReport(snapshot, ledgers, {now=Date.now(),worldArticles=[]}={}) {
  const today=eventDay(now),through=eventDay(now+29*86400000);
  const events=(snapshot.events||[]).filter(validEvent).filter(e=>e.startDate<=through && (e.endDate||e.startDate)>=today).map(e=>({
    id:e.id,title:e.title,startDate:e.startDate,prefecture:e.prefecture,sourceUrl:e.sourceUrl,
    verifiedAt:e.verifiedAt,period:eventPeriod(e,now),information:eventInformation(e),
    notes:e.informationNotes||{},deadline:eventDeadline(e,now),
  }));
  const coverage=Object.fromEntries(Object.keys(INFORMATION_FIELDS).map(key=>[key,{
    confirmed:events.filter(e=>e.information[key]==='confirmed').length,
    notApplicable:events.filter(e=>e.information[key]==='not_applicable').length,
    unknown:events.filter(e=>e.information[key]==='unknown').length,total:events.length,
  }]));
  const holds=Object.entries(ledgers).flatMap(([scope,ledger])=>(ledger.entries||[]).filter(x=>x.status==='held').map(x=>({scope,id:x.id,title:x.article?.originalTitle||x.article?.title||'',translatedTitle:x.article?.title||'',articleUrl:x.sourceArticleUrl||x.article?.id||x.id,sourceUrl:x.article?.sourceUrl||'',reason:x.reason,firstSeenAt:x.firstSeenAt,
    ...(x.sourcePublishedDate?{sourcePublishedDate:x.sourcePublishedDate,sourceUpdatedDate:x.sourceUpdatedDate??null,feedPublishedAt:x.article?.publishedAt??null}:{}),
    ...(x.reopenedFrom?{reopenedFrom:x.reopenedFrom,previousSourcePublication:x.previousSourcePublication??null}:{}),
    ...(x.relatedClosedId?{relatedClosedId:x.relatedClosedId}:{})})));
  const resolvedReviews=Object.entries(ledgers).flatMap(([scope,ledger])=>(ledger.entries||[]).filter(x=>['archived','excluded'].includes(x.status)).map(x=>({
    scope,id:x.id,status:x.status,reason:x.reason,title:x.article?.originalTitle||x.article?.title||'',articleUrl:x.sourceArticleUrl||x.article?.id||x.id,sourceUrl:x.article?.sourceUrl||'',
    reviewedAt:x.reviewedAt??null,reviewNote:x.reviewNote??'',sourcePublishedDate:x.sourcePublishedDate??null,sourceUpdatedDate:x.sourceUpdatedDate??null,feedPublishedAt:x.article?.publishedAt??null,sourcePublication:x.sourcePublication??null,
  })));
  const integrityWarnings=Object.entries(ledgers).flatMap(([scope,ledger])=>(ledger.entries||[]).filter(x=>['archived','excluded'].includes(x.status)&&x.dispositionDigest&&x.dispositionDigest!==sourceDispositionDigest(x)).map(x=>({scope,id:x.id,reason:'disposition-checksum-mismatch'})));
  return {schemaVersion:'deafnavi-quality-report.v1',generatedAt:new Date(now).toISOString(),sourceCheckedAt:snapshot.checkedAt??null,integrityWarnings,
    range:{from:today,through},events,coverage,holds,resolvedReviews,
    sourceReview:{verified:Object.values(ledgers).flatMap(x=>x.entries||[]).filter(x=>x.status==='source-verified').length,excluded:resolvedReviews.filter(x=>x.status==='excluded').length,archived:resolvedReviews.filter(x=>x.status==='archived').length},
    classificationReview:worldArticles.filter(a=>a.region==='unknown').map(a=>({id:a.id,title:a.originalTitle||a.title,status:a.regionEvidence?.status||'unconfirmed'})),
    recheckDue:events.filter(e=>e.period==='review').length,
    metrics:{taskCompletion:null,confirmedAttendance:null,confirmedVisits:null,eventOfficialClicks:null},
    note:'情報の記載状況です。利用可能な支援や参加可能性の保証ではありません。空欄は未確認、外部クリックは来店・申込完了ではありません。'};
}
