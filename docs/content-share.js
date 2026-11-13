// Public, allowlisted presentation only. No fetching, tracking, AI or posting.
const clean = value => typeof value === 'string' ? value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim() : '';
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value ? value : '';
export function shareUrl(value) {
  try {
    const u = new URL(value);
    if (!['https:','http:'].includes(u.protocol) || u.username || u.password) return '';
    for (const key of [...u.searchParams.keys()]) if (/^(?:utm_|dn_client$|fbclid$|gclid$)/i.test(key)) u.searchParams.delete(key);
    if (u.hostname === 'deafnavi.com') { u.search = ''; u.hash = ''; }
    return u.href;
  } catch { return ''; }
}
export function newsShare(article) {
  return {kind:'news',title:clean(article.title),url:shareUrl(article.id),source:clean(article.sourceName),publishedAt:clean(article.publishedAt)};
}
export function eventShare(event, url, kind='event') {
  const result = {kind, title:clean(event.title), url:shareUrl(url)};
  for (const key of ['startDate','endDate','time','venue','prefecture','fee','target','status','period','verification','verifiedAt','validUntil','timezone','applicationDeadline','deadlineScope']) result[key] = clean(event[key]);
  return result;
}
export function shareControl(data) {
  if (!clean(data.title) || !shareUrl(data.url)) return '';
  return `<div class="dn-share" data-content-share="${escape(JSON.stringify(data))}">${shareIcons(sharePresentation(data).xUrl)}<div class="dn-share-panel" hidden></div><p class="dn-share-status" role="status"></p><noscript><a href="${escape(shareUrl(data.url))}">リンクを開いて共有</a></noscript></div>`;
}
export function shareIcons(xUrl='') {
  const svg=body=>`<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">${body}</svg>`;
  return `<div class="dn-share-icons" role="group" aria-label="SNSで共有">
<a class="dn-share-icon" data-share-x href="${escape(xUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Xで共有（新しいタブ）" title="Xで共有">${svg('<path fill="currentColor" d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3L12 14.6 5.5 22H2.4l8.2-9.4L.8 2h6.5l4.5 6.8L18.9 2ZM17.8 20h1.7L6.3 3.9H4.5L17.8 20Z"/>')}</a>
<button class="dn-share-icon" data-share-instagram type="button" aria-label="Instagramで紹介する" title="Instagramで紹介する" aria-expanded="false">${svg('<g fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/></g><circle cx="17.5" cy="6.5" r="1.1" fill="currentColor"/>')}</button>
<button class="dn-share-icon" data-share-copy type="button" aria-label="リンクをコピー" title="リンクをコピー">${svg('<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="m10 14 4-4M9 16l-2 2a4.2 4.2 0 0 1-6-6l4-4a4.2 4.2 0 0 1 6 0M15 8l2-2a4.2 4.2 0 0 1 6 6l-4 4a4.2 4.2 0 0 1-6 0" transform="translate(1 0) scale(.92)"/></g>')}</button></div>`;
}
export function shareState(data, now=Date.now()) {
  if (data.kind === 'news') return '';
  let today;
  try { today = new Intl.DateTimeFormat('en-CA',{timeZone:data.timezone || 'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now)); }
  catch { today = new Date(now+9*3600000).toISOString().slice(0,10); }
  if (data.status === 'cancelled') return '中止の告知';
  if (date(data.endDate || data.startDate) && (data.endDate || data.startDate) < today) return '過去の開催告知';
  if (data.status === 'ended' || data.period === 'past') return '過去の開催告知';
  const checked = Date.parse(data.verifiedAt), until = Math.min(checked+48*3600000, data.validUntil ? Date.parse(data.validUntil) : Infinity);
  if (!date(data.startDate) || data.period === 'unconfirmed' || data.verification !== 'verified' || !Number.isFinite(checked) || !Number.isFinite(until) || checked > now || now >= until) return '最新状況は公式案内へ';
  return data.status === 'closed' ? '受付終了の告知' : '開催予定';
}
export function sharePresentation(data, now=Date.now()) {
  if (!data || !['news','event','cafe'].includes(data.kind) || !clean(data.title) || !shareUrl(data.url)) throw new Error('共有する情報を読み込めませんでした。');
  const url = shareUrl(data.url), state = shareState(data,now), facts = [];
  if (data.kind === 'news') {
    if (data.source) facts.push(['出典',clean(data.source)]);
    const t = Date.parse(data.publishedAt);
    if (Number.isFinite(t)) facts.push(['記事の日付',new Date(t+9*3600000).toISOString().slice(0,10)]);
  } else {
    if (date(data.startDate)) facts.push(['開催日',data.startDate+(date(data.endDate) && data.endDate!==data.startDate ? '〜'+data.endDate : '')]);
    // An expired confirmation must never turn into a fresh invitation in a saved image.
    if (state !== '最新状況は公式案内へ') {
      if (data.time) facts.push(['時間',clean(data.time)]);
      if (data.venue) facts.push(['会場',[data.prefecture,data.venue].filter(Boolean).join(' / ')]);
    }
  }
  const note = data.kind === 'news' ? '元記事の見出しと出典を紹介しています。' : state === '過去の開催告知' ? '過去の告知です。実施済み・次回開催を示すものではありません。' : state === '最新状況は公式案内へ' ? '以前の告知です。開催・受付状況は主催者の最新案内をご確認ください。' : '参加条件・最新の受付状況はリンク先の公式案内をご確認ください。';
  const lines = [state ? `【${state}】` : '【ニュース】',clean(data.title),...facts.map(([k,v])=>`${k}：${v}`)];
  if (data.kind !== 'news' && state !== '最新状況は公式案内へ') {
    if (data.fee) lines.push('参加費：'+clean(data.fee));
    if (data.target) lines.push('対象・申込：'+clean(data.target));
    if (date(data.applicationDeadline)) lines.push('申込期限：'+data.applicationDeadline);
  }
  if (data.kind !== 'news' && Number.isFinite(Date.parse(data.verifiedAt))) lines.push('情報確認：'+new Date(Date.parse(data.verifiedAt)+9*3600000).toISOString().slice(0,16).replace('T',' ')+' JST');
  lines.push(note,url,'Deaf Naviで見つけた情報');
  const prefix = state ? `【${state}】\n` : '';
  // Conservatively count non-ASCII as two. Reserve 23 for X's t.co link.
  const budget = 280-23-1-[...prefix].reduce((n,c)=>n+(c.codePointAt(0)>127?2:1),0);
  let short='', weight=0;
  for (const c of clean(data.title)) { const w=c.codePointAt(0)>127?2:1; if(weight+w>budget-2){short+='…';break;} short+=c;weight+=w; }
  return {title:clean(data.title),url,state,facts,note,text:lines.join('\n'),xUrl:'https://x.com/intent/tweet?'+new URLSearchParams({text:prefix+short,url}).toString()};
}
