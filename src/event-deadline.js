// Shared by static rendering, browser refresh and the app snapshot. No network,
// no date inferred from publication time, and no alteration of event status.
export function validDeadlineDate(date) {
  return typeof date==='string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
    && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0,10)===date;
}
export function eventDeadline(event, now=Date.now()) {
  let date=event.applicationDeadline || null;
  const scope=event.deadlineScope || 'participation';
  if(!date) {
    // Only a single, explicitly labelled full year/month/day in reviewed copy.
    // Month/day-only, relative dates and competing old/new dates remain unknown.
    const text=String(event.target||'').normalize('NFKC');
    const matches=[...text.matchAll(/申込(?:み)?締切(?:日)?(?:は|[:：])\s*(20\d{2})年(\d{1,2})月(\d{1,2})日/gu)];
    const fullDates=[...text.matchAll(/20\d{2}年\d{1,2}月\d{1,2}日/gu)];
    if(matches.length===1 && fullDates.length===1) date=`${matches[0][1]}-${matches[0][2].padStart(2,'0')}-${matches[0][3].padStart(2,'0')}`;
  }
  if(!validDeadlineDate(date)) return null;
  const today=new Date(now+9*3600000).toISOString().slice(0,10);
  return {date,scope,passed:date<today};
}
export function deadlineLabel(deadline) {
  if(!deadline)return '';
  const scope={participation:'申込',captions:'字幕利用申込',interpretation:'通訳利用申込',other:'事前申込'}[deadline.scope] || '申込';
  return deadline.passed?`${scope}締切日を過ぎています（${deadline.date}）。追加受付は公式案内へ。`:`${scope}締切日：${deadline.date}。締切時刻・受付状況は公式案内へ。`;
}
