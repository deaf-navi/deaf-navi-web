// Calendar windows use Japan time, including Sunday and month/year boundaries.
export function eventDateWindow(range, now = Date.now()) {
 const day=new Date(now+9*3600000), today=day.toISOString().slice(0,10);
 if(range==='month')return [today, new Date(Date.UTC(day.getUTCFullYear(),day.getUTCMonth()+1,0)).toISOString().slice(0,10)];
 if(range==='weekend'){
  const weekday=day.getUTCDay(), offset=weekday===0?0:6-weekday;
  const start=new Date(Date.parse(today)+offset*86400000).toISOString().slice(0,10);
  const end=new Date(Date.parse(start)+(weekday===0?0:1)*86400000).toISOString().slice(0,10);
  return [start,end];
 }
 return null;
}
(()=>{
 if(typeof document==='undefined')return;
 const form=document.querySelector('#event-filters');if(!form)return;
 const rows=[...document.querySelectorAll('[data-event]')], buttons=[...document.querySelectorAll('[data-period]')];
 const controls={q:document.querySelector('#event-query'),prefecture:document.querySelector('#event-prefecture'),kind:document.querySelector('#event-kind'),month:document.querySelector('#event-month')};
 const labels={upcoming:'開催予定',past:'過去の告知',review:'再確認中',cancelled:'中止の告知'};let period='upcoming', range='', sortedPeriod;
 const quick=[...document.querySelectorAll('[data-range]')], remember=document.querySelector('#event-remember-region');
 const storageKey='deafnavi.event-prefecture';
 function savedRegion(){try{return localStorage.getItem(storageKey)||''}catch{return ''}}
 function saveRegion(){try{remember.checked&&controls.prefecture.value?localStorage.setItem(storageKey,controls.prefecture.value):localStorage.removeItem(storageKey)}catch{/* Search remains usable without storage. */}}
 const normalize=s=>s.normalize('NFKC').toLowerCase().trim();
 function apply(sync=true){
  const now=Date.now(), today=new Date(now+9*3600000).toISOString().slice(0,10), stale=Number(document.querySelector('[data-recheck-ms]').dataset.recheckMs);let count=0;
  const tokens=normalize(controls.q.value).split(/\s+/).filter(Boolean);
  const window=eventDateWindow(range,now);
  for(const row of rows){
   const d=row.dataset, checked=Date.parse(d.verified);const state=d.end<today?'past':d.status==='cancelled'?'cancelled':d.verification!=='verified'||!Number.isFinite(checked)||checked>now||now-checked>=stale?'review':'upcoming';
   row.querySelector('[data-event-state]').textContent=d.status==='cancelled'?'中止の告知':state==='upcoming'&&d.status==='closed'?'受付終了の告知':labels[state];
   row.hidden=state!==period||!tokens.every(t=>normalize(d.search).includes(t))||(controls.prefecture.value&&d.prefecture!==controls.prefecture.value)||(controls.kind.value&&d.kind!==controls.kind.value)||(controls.month.value&&!(d.start.slice(0,7)<=controls.month.value&&d.end.slice(0,7)>=controls.month.value))||(window&&(d.end<window[0]||d.start>window[1]));if(!row.hidden)count++;
  }
  // Past announcements read newest first; upcoming events read nearest first.
  // Moving a row while an input blurs can cancel its native summary click.
  if(sortedPeriod!==period){rows.sort((a,b)=>(period==='past'?-1:1)*a.dataset.start.localeCompare(b.dataset.start)).forEach(row=>row.parentElement.appendChild(row));sortedPeriod=period;}
  document.querySelector('#event-count').textContent=`${range==='weekend'?'今週末':range==='month'?'今月':labels[period]}${controls.prefecture.value?' · '+controls.prefecture.value:''} ${count}件`;document.querySelector('#event-empty').hidden=count>0;
  for(const button of buttons)button.setAttribute('aria-pressed',String(button.dataset.period===period));
  for(const button of quick)button.setAttribute('aria-pressed',String(period==='upcoming'&&range===button.dataset.range));
  if(sync){const url=new URL(location.href);for(const[key,input]of Object.entries(controls)){input.value?url.searchParams.set(key,input.value):url.searchParams.delete(key)}period==='upcoming'?url.searchParams.delete('period'):url.searchParams.set('period',period);range?url.searchParams.set('range',range):url.searchParams.delete('range');history.replaceState(null,'',url);}
 }
 function restore(useSaved=false){const params=new URLSearchParams(location.search);period=labels[params.get('period')]?params.get('period'):'upcoming';for(const[key,input]of Object.entries(controls))input.value=(params.get(key)||'').slice(0,200);range=period==='upcoming'&&!controls.month.value&&['weekend','month'].includes(params.get('range'))?params.get('range'):'';
  const saved=savedRegion();remember.checked=Boolean(saved);
  if(useSaved&&!['q','prefecture','kind','month','period','range'].some(key=>params.has(key)))controls.prefecture.value=saved;
  document.querySelector('.event-more-filters').open=Boolean(controls.prefecture.value||controls.kind.value||controls.month.value);
  document.querySelector('.event-history').open=period!=='upcoming';apply(useSaved&&Boolean(controls.prefecture.value))}
 form.hidden=false;document.querySelector('.event-browse').hidden=false;document.querySelector('.event-periods').hidden=false;document.querySelector('[data-event-empty-reset]').hidden=false;
 form.addEventListener('submit',e=>{e.preventDefault();apply()});form.addEventListener('input',e=>{if(e.target===controls.month)range='';apply()});form.addEventListener('change',e=>{if(e.target===remember||e.target===controls.prefecture)saveRegion();apply()});form.addEventListener('reset',()=>{setTimeout(()=>{period='upcoming';range='';remember.checked=false;saveRegion();document.querySelector('.event-history').open=false;apply();controls.q.focus()},0)});
 quick.forEach(button=>button.addEventListener('click',()=>{period='upcoming';range=button.dataset.range;controls.month.value='';document.querySelector('.event-history').open=false;apply()}));
 buttons.forEach(button=>button.addEventListener('click',()=>{period=button.dataset.period;range='';apply()}));window.addEventListener('popstate',()=>restore());document.addEventListener('visibilitychange',()=>{if(!document.hidden)apply(false)});setInterval(()=>{if(!document.hidden)apply(false)},60000);restore(true);
})();
