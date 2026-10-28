const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const methods = {sign:'手話による案内・表現',writing:'筆談'};
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;

// Accept only the public feed and existing cafe detail routes. Never infer
// verification, a date or communication support from a title/description.
export function cafeFeedEvents(feed) {
 if(feed?.schemaVersion !== 'deaf-navi-cafe-events.v1' || !Array.isArray(feed.events))throw new Error('Invalid cafe event feed');
 const seen = new Set();
 return feed.events.filter(event => {
  if(!event || event.origin !== 'cafe' || !/^[a-z0-9][a-z0-9-]*$/.test(event.id) || !validDate(event.startDate) || event.endDate !== event.startDate || typeof event.title !== 'string' || !event.title || !['upcoming','past','unconfirmed'].includes(event.period))throw new Error('Invalid cafe event');
  const url = new URL(event.webUrl);
  if(url.origin !== 'https://deafnavi.com' || !/^\/connect\/sign-cafe\/(?:starbucks\/)?[a-z0-9-]+\/$/.test(url.pathname) || url.search || url.hash)throw new Error('Invalid cafe detail URL');
  if(seen.has(event.id))return false;
  seen.add(event.id);return true;
 });
}

export function eventRowPeriod(data, now = Date.now(), stale = 48*3600000) {
 const today = new Date(now+9*3600000).toISOString().slice(0,10), checked = Date.parse(data.verified);
 if(data.end < today)return 'past';
 if(data.status === 'cancelled')return 'cancelled';
 if(data.cafePeriod === 'past' || data.status === 'ended')return 'past';
 if(data.cafePeriod === 'unconfirmed' || data.verification !== 'verified' || !Number.isFinite(checked) || checked > now || now-checked >= stale)return 'review';
 return 'upcoming';
}

export function renderCafeEvent(event) {
 const e = escape, path = new URL(event.webUrl).pathname;
 const communication = (event.communication || []).filter(item => methods[item.method] && typeof item.detail === 'string' && item.detail);
 const search = [event.title,event.prefecture,event.venue,event.time,event.description,event.target,event.organizer,'手話カフェ',...communication.map(item=>methods[item.method]+' '+item.detail)].filter(Boolean).join(' ');
 const dateParts = Object.fromEntries(new Intl.DateTimeFormat('ja-JP',{year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',timeZone:'Asia/Tokyo'}).formatToParts(new Date(event.startDate)).map(part=>[part.type,part.value]));
 const date = `${dateParts.year}.${dateParts.month}.${dateParts.day}（${dateParts.weekday}）`;
 return `<article class="event-row" id="cafe-${e(event.id)}" data-event data-cafe-event data-start="${e(event.startDate)}" data-end="${e(event.endDate)}" data-verified="${e(event.verifiedAt)}" data-verification="${e(event.verification)}" data-status="${e(event.status)}" data-cafe-period="${e(event.period)}" data-prefecture="${e(event.prefecture)}" data-kind="cafe" data-search="${e(search)}" hidden>
 <div class="event-when"><div class="event-dates"><time datetime="${e(event.startDate)}">${e(date)}</time></div><span data-event-state></span></div>
 <div class="event-content"><div class="event-heading"><p class="event-meta">${e(event.prefecture)} · 手話カフェ</p><h2><a href="${e(path)}">${e(event.title)}</a></h2></div>
 <p class="event-venue">${e(event.venue || '会場は告知をご確認ください')}${event.time?' · '+e(event.time):' · 時間は告知をご確認ください'}</p>
 ${event.description?`<p>${e(event.description)}</p>`:''}
 <div class="event-communication" data-communication="${communication.map(item=>item.method).join(' ')}"><p class="event-communication-label">情報の受け取り方</p>${communication.length?`<ul>${communication.map(item=>`<li><strong>${methods[item.method]}</strong>：${e(item.detail)}</li>`).join('')}</ul>`:'<p class="event-communication-unknown">通訳・字幕・筆談など、利用できる方法は主催者へお問い合わせください。</p>'}</div>
 ${event.target?`<dl class="event-participation"><div><dt>対象・申込</dt><dd>${e(event.target)}</dd></div></dl>`:''}
 <p class="event-action"><a href="${e(path)}" aria-label="${e(event.title)}の詳細・参加方法を見る">詳細・参加方法を見る</a></p></div></article>`;
}
