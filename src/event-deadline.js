// Shared by static rendering, browser refresh and the app snapshot. No network,
// no date inferred from publication time, and no alteration of event status.
export function validDeadlineDate(date) {
  return typeof date==='string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
    && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0,10)===date;
}
const supportTitles = {
  captions:'字幕利用申込締切日',
  interpretation:'通訳利用申込締切日',
  accessibility:'配慮を希望する方の連絡期限',
  'captioned-audio-ticket':'字幕・音声ガイド付きチケットの申込締切日',
};
export const isSupportDeadlineScope = scope => Object.hasOwn(supportTitles, scope);
export const deadlineTitle = scope => scope === 'participation' ? '申込締切日' : isSupportDeadlineScope(scope) ? supportTitles[scope] : '';

function inferredParticipationDate(target) {
  // Prefer explicit fields. A legacy text fallback requires one full date and a
  // general registration label at a sentence boundary.
  const text=String(target||'').normalize('NFKC');
  const matches=[...text.matchAll(/(?:^|[。！？\n])\s*(?:(一般(?:参加)?|参加)(?:の)?|事前)?申込(?:み)?締切(?:日)?(?:は|:)\s*(20\d{2})年(\d{1,2})月(\d{1,2})日/gu)];
  const fullDates=[...text.matchAll(/20\d{2}年\d{1,2}月\d{1,2}日/gu)];
  if(matches.length!==1 || fullDates.length!==1) return null;
  const [, participation, year, month, day]=matches[0];
  // An unqualified label following an accommodation notice belongs to an
  // unknown scope. Keep the original wording visible for readers.
  if(!participation && /(?:配慮|鑑賞サポート|手話通訳|要約筆記|字幕|音声ガイド|筆談|情報保障|ヒアリングループ|車[い椅]す|託児)[^。！？\n]{0,30}(?:希望|利用|申込|連絡|相談)/u.test(text)) return null;
  return `${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`;
}

export function deadlineFields(event, { inferParticipation=true } = {}) {
  const fields={};
  const legacyScope=event.deadlineScope || 'participation';
  const applicationDate=legacyScope==='participation'
    ? event.applicationDeadline || (inferParticipation ? inferredParticipationDate(event.target) : null)
    : null;
  if(validDeadlineDate(applicationDate)) {
    fields.applicationDeadline=applicationDate;
    fields.deadlineScope='participation';
  }
  const supportDate=event.supportDeadline || event.applicationDeadline;
  const supportScope=event.supportDeadline ? event.supportDeadlineScope : legacyScope;
  if(validDeadlineDate(supportDate) && isSupportDeadlineScope(supportScope)) {
    fields.supportDeadline=supportDate;
    fields.supportDeadlineScope=supportScope;
  }
  return fields;
}

export function eventDeadlines(event, now=Date.now()) {
  const {applicationDeadline,deadlineScope,supportDeadline,supportDeadlineScope}=deadlineFields(event);
  const today=new Date(now+9*3600000).toISOString().slice(0,10);
  return [[applicationDeadline,deadlineScope],[supportDeadline,supportDeadlineScope]]
    .filter(([date])=>date).map(([date,scope])=>({date,scope,passed:date<today}));
}
export const eventDeadline = (event, now) => eventDeadlines(event, now)[0] ?? null;
export function deadlineLabel(deadline) {
  if(!deadline)return '';
  const title=deadlineTitle(deadline.scope);
  if(!title)return '';
  const followup=deadline.scope==='participation'?'追加受付は公式案内へ。':'対応の可否は公式案内へ。';
  return deadline.passed?`${title}を過ぎています（${deadline.date}）。${followup}`:`${title}：${deadline.date}。締切時刻・受付状況は公式案内へ。`;
}
