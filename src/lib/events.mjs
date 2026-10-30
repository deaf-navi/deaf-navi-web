import { createHash } from 'node:crypto';
import { cleanHtml } from './text.mjs';
import { tagAttributes, publicUrl } from './thumbnail-metadata.mjs';
import { EVENT_RECHECK_MS, EVENT_KINDS, EVENT_COMMUNICATION } from '../../config/events.mjs';
import { PREFECTURES } from '../../config/regions.mjs';
import {validDeadlineDate} from '../event-deadline.js';

export const eventDay = (now = Date.now()) => new Date(now + 9 * 3600000).toISOString().slice(0, 10);
export const eventHash = value => createHash('sha256').update(value).digest('hex');
export function validEventDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function eventDateLabel(value) {
  if (!validEventDate(value)) return '';
  return `${value.replaceAll('-', '.')}（${'日月火水木金土'[new Date(value+'T00:00:00Z').getUTCDay()]}）`;
}
export function eventSourceText(html) {
  const body = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] || html;
  return cleanHtml(body.replace(/<!--[^]*?-->|<(script|style|noscript|nav|header|footer)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '').replace(/<[^>]+>/g, ' ')).normalize('NFKC');
}
// Optional facts are entered only after an official-source review. Never infer
// a ticket price, organizer identity or availability from missing/free-form copy.
function validEventTerms(event) {
  const https = value => publicUrl(value)?.startsWith('https:');
  const name = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 300;
  return (event.organizers == null || (Array.isArray(event.organizers) && event.organizers.length > 0 && event.organizers.length <= 12
    && event.organizers.every(item => item && name(item.name)
      && (item.type == null || ['Organization','Person'].includes(item.type))
      && (item.url == null || https(item.url)))))
    && (event.offers == null || (Array.isArray(event.offers) && event.offers.length > 0 && event.offers.length <= 12
      && event.offers.every(item => item && typeof item.price === 'number' && Number.isFinite(item.price) && item.price >= 0
        && typeof item.priceCurrency === 'string' && /^[A-Z]{3}$/.test(item.priceCurrency)
        && https(item.url) && (item.name == null || name(item.name)))));
}
export function validEvent(event) {
  return event && /^[a-z0-9][a-z0-9-]{1,120}$/.test(event.id || '')
    && typeof event.title === 'string' && event.title.length > 1 && event.title.length <= 300
    && validEventDate(event.startDate) && validEventDate(event.endDate || event.startDate)
    && (event.endDate || event.startDate) >= event.startDate
    && (PREFECTURES.some(p=>p.name===event.prefecture) || event.prefecture==='オンライン')
    && typeof event.venue === 'string' && event.venue.length > 0 && event.venue.length <= 300
    && EVENT_KINDS[event.kind] && ['announced','closed','cancelled'].includes(event.status)
    && ['verified','needs_review'].includes(event.verification) && publicUrl(event.sourceUrl)?.startsWith('https:')
    && (!event.detailUrl || publicUrl(event.detailUrl)?.startsWith('https:'))
    && typeof event.sourceName === 'string' && event.sourceName.length > 0 && validEventTerms(event)
    && Number.isFinite(Date.parse(event.verifiedAt)) && /^[a-f0-9]{64}$/.test(event.evidenceHash || '')
    && (event.applicationDeadline == null || validDeadlineDate(event.applicationDeadline))
    && (event.deadlineScope == null || ['participation','captions','interpretation','other'].includes(event.deadlineScope))
    && (event.communicationAvailability == null || (['available','unavailable','unknown'].includes(event.communicationAvailability)
      && (event.communicationAvailability!=='unavailable' || (typeof event.informationNotes?.communication==='string' && event.informationNotes.communication.trim().length>0 && event.informationNotes.communication.length<=300 && !(event.communication||[]).length))))
    && (event.informationStatus == null || (typeof event.informationStatus==='object' && !Array.isArray(event.informationStatus)
      && Object.entries(event.informationStatus).every(([key,value])=>['time','fee','signup','deadline','communication'].includes(key)
        && ['confirmed','not_applicable','unknown'].includes(value)
        && (value!=='not_applicable' || (typeof event.informationNotes?.[key]==='string' && event.informationNotes[key].trim().length>0 && event.informationNotes[key].length<=300)))))
    && (event.communication == null || (Array.isArray(event.communication) && event.communication.length <= Object.keys(EVENT_COMMUNICATION).length
      && new Set(event.communication.map(item=>item?.method)).size === event.communication.length
      && event.communication.every(item=>Object.hasOwn(EVENT_COMMUNICATION,item?.method)
        && typeof item.detail === 'string' && item.detail.trim().length > 0 && item.detail.length <= 300)));
}

export function eventSearchText(event) {
  return [event.title,event.prefecture,event.venue,event.organizer,event.description,
    event.fee,event.target,event.time,EVENT_KINDS[event.kind],
    ...(event.communication||[]).map(item=>EVENT_COMMUNICATION[item.method]+' '+item.detail)].filter(Boolean).join(' ');
}
export function eventPeriod(event, now = Date.now()) {
  if (!validEvent(event)) return 'invalid';
  if ((event.endDate || event.startDate) < eventDay(now)) return 'past';
  if (event.status === 'cancelled') return 'cancelled';
  if (event.verification !== 'verified' || Date.parse(event.verifiedAt) > now || now - Date.parse(event.verifiedAt) >= EVENT_RECHECK_MS) return 'review';
  return 'upcoming';
}

// Publisher-specific contract: year heading + event-date + prefecture + venue.
// Publication <time>, URL digits and prior occurrences never supply missing dates.
export function parseOioiSchedule(html, source, now = Date.now()) {
  const events = [], held = [];
  for (const section of html.matchAll(/<h3\b[^>]*>\s*(\d{4})年\s*<\/h3>([\s\S]*?)(?=<h3\b|$)/gi)) {
    const year = section[1];
    for (const item of section[2].matchAll(/<li\b[^>]*class=["'][^"']*p-postList__item[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi)) {
      const block = item[1], a = block.match(/<a\b[^>]*>/i);
      const url = a && publicUrl(tagAttributes(a[0]).href, source.url);
      if (!url || new URL(url).hostname !== new URL(source.url).hostname) continue;
      const dateText = cleanHtml(block.match(/<h4\b[^>]*class=["'][^"']*event-date[^"']*["'][^>]*>([\s\S]*?)<\/h4>/i)?.[1] || '');
      const date = dateText.match(/^(\d{1,2})月(\d{1,2})日(?:\([^)]*\))?$/);
      const title = cleanHtml(block.match(/<h5\b[^>]*>([\s\S]*?)<\/h5>/i)?.[1] || '');
      const area = cleanHtml(block.match(/<span\b[^>]*class=["'][^"']*c-postThumb__cat[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] || '');
      const prefecture = { 東京:'東京都', 大阪:'大阪府', 京都:'京都府' }[area] || (/[都道府県]$/.test(area) ? area : (area ? area + '県' : ''));
      const venue = cleanHtml(block.match(/<div\b[^>]*class=["'][^"']*p-postList__times[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] || '');
      const startDate = date ? `${year}-${date[1].padStart(2,'0')}-${date[2].padStart(2,'0')}` : '';
      const evidenceHash = eventHash([title, startDate, prefecture, venue].join('\n'));
      const event = { id: 'oioi-' + eventHash(url).slice(0,20), title, startDate, endDate:startDate, prefecture, venue,
        kind:/手話(?:劇|演劇|狂言|新喜劇)|ろう(?:者)?演劇/.test(title)?'theater':/講座|学習|講演/.test(title)?'course':/交流|トーク|トーーク/.test(title)?'exchange':'culture',
        sourceId:source.id, sourceName:source.name, sourceUrl:source.url, detailUrl:url,
        organizer:null, time:null, fee:null, target:null,
        status:/中止/.test(title)?'cancelled':/満員|受付終了|募集終了/.test(title)?'closed':'announced',
        description:'oioiの公開スケジュールに掲載された催しです。出演時間・参加条件は詳細の告知をご確認ください。',
        verification:'verified', verifiedAt:new Date(now).toISOString(), evidenceHash };
      if (!validEvent(event)) { held.push({sourceUrl:url,reason:'schedule-fields-missing-or-invalid'}); continue; }
      events.push(event);
    }
  }
  if (!events.length) throw new Error('Publisher schedule layout changed or contains no verifiable rows');
  return { events, held };
}

export function verifyReviewedEvent(entry, html, now = Date.now()) {
  const text=eventSourceText(html), hash=eventHash(text);
  const event={...entry, verifiedAt:entry.reviewedAt, evidenceHash:entry.sourceHash};
  delete event.evidence; delete event.sourceHash; delete event.reviewedAt;
  const matches=entry.sourceHash===hash && Array.isArray(entry.evidence) && entry.evidence.length>=3
    && entry.evidence.every(phrase=>text.includes(String(phrase).normalize('NFKC')));
  return {...event, verification:matches?'verified':'needs_review', ...(matches?{verifiedAt:new Date(now).toISOString(),evidenceHash:hash}:{})};
}

// A browser/vision review never becomes a permanent fetch exemption.
export function reviewedVisualEvent(entry, now=Date.now()) {
  const {sourceHash,reviewedAt,evidence,...event}=entry;
  const fresh=entry.verificationMode==='visual' && Array.isArray(evidence) && evidence.length>=3
    && Date.parse(reviewedAt)<=now && now-Date.parse(reviewedAt)<EVENT_RECHECK_MS;
  return {...event,verifiedAt:reviewedAt,evidenceHash:sourceHash,verification:fresh?'verified':'needs_review'};
}

export function mergeEventSnapshot(previous, incoming, checkedSources, now = Date.now()) {
  const map=new Map();
  // Detail reviews own their occurrence: a schedule cannot clear a failed detail check.
  const unavailableIds=new Set(checkedSources.filter(check=>check.id && ['unavailable','not_checked'].includes(check.result)).map(check=>check.id));
  for(const event of previous || []) if(validEvent(event)) {
    const check=checkedSources.find(c=>c.id===event.id)||checkedSources.find(c=>!c.id&&c.sourceUrl===event.sourceUrl);
    const fresh=eventPeriod(event,now)==='upcoming';
    const temporary=check?.result==='unavailable'&&check.retryable===true&&check.allowRetain!==false&&event.verificationMode!=='visual';
    const retained=fresh&&(temporary||check?.result==='not_checked');
    const value={...event,verification:retained?'verified':'needs_review'};
    if(temporary)value.sourceStatus='retrying';
    else if(check?.result!=='not_checked')delete value.sourceStatus;
    map.set(event.id,value);
  }
  for(const event of incoming) if(validEvent(event) && !unavailableIds.has(event.id)) map.set(event.id,event);
  // A missing notice is not proof of cancellation. Retain it for review/history.
  const unique=new Map();
  const normalize=s=>String(s).normalize('NFKC').toLowerCase().replace(/[\s\p{P}]/gu,'');
  for(const event of map.values()){
    const identity=[normalize(event.title),event.startDate,event.prefecture,normalize(event.venue)].join('|');
    const prior=unique.get(identity);
    if(!prior || (prior.verification!=='verified'&&event.verification==='verified') || (prior.verification===event.verification&&prior.sourceId&&!event.sourceId))unique.set(identity,event);
  }
  return [...unique.values()].filter(e=>(e.endDate||e.startDate)>=eventDay(now-366*86400000))
    .sort((a,b)=>a.startDate.localeCompare(b.startDate)||a.id.localeCompare(b.id));
}
