(()=>{
 const form=document.querySelector('#event-filters');if(!form)return;
 const rows=[...document.querySelectorAll('[data-event]')], buttons=[...document.querySelectorAll('[data-period]')];
 const controls={q:document.querySelector('#event-query'),prefecture:document.querySelector('#event-prefecture'),kind:document.querySelector('#event-kind'),month:document.querySelector('#event-month')};
 const labels={upcoming:'開催予定',past:'過去の告知',review:'再確認中',cancelled:'中止の告知'};let period='upcoming', sortedPeriod;
 const normalize=s=>s.normalize('NFKC').toLowerCase().trim();
 function apply(sync=true){
  const now=Date.now(), today=new Date(now+9*3600000).toISOString().slice(0,10), stale=Number(document.querySelector('[data-recheck-ms]').dataset.recheckMs);let count=0;
  const tokens=normalize(controls.q.value).split(/\s+/).filter(Boolean);
  for(const row of rows){
   const d=row.dataset, checked=Date.parse(d.verified);const state=d.end<today?'past':d.status==='cancelled'?'cancelled':d.verification!=='verified'||!Number.isFinite(checked)||checked>now||now-checked>=stale?'review':'upcoming';
   row.querySelector('[data-event-state]').textContent=d.status==='cancelled'?'中止の告知':state==='upcoming'&&d.status==='closed'?'受付終了の告知':labels[state];
   row.hidden=state!==period||!tokens.every(t=>normalize(d.search).includes(t))||(controls.prefecture.value&&d.prefecture!==controls.prefecture.value)||(controls.kind.value&&d.kind!==controls.kind.value)||(controls.month.value&&!(d.start.slice(0,7)<=controls.month.value&&d.end.slice(0,7)>=controls.month.value));if(!row.hidden)count++;
  }
  // Past announcements read newest first; upcoming events read nearest first.
  // Moving a row while an input blurs can cancel its native summary click.
  if(sortedPeriod!==period){rows.sort((a,b)=>(period==='past'?-1:1)*a.dataset.start.localeCompare(b.dataset.start)).forEach(row=>row.parentElement.appendChild(row));sortedPeriod=period;}
  document.querySelector('#event-count').textContent=`${labels[period]} ${count}件`;document.querySelector('#event-empty').hidden=count>0;
  for(const button of buttons)button.setAttribute('aria-pressed',String(button.dataset.period===period));
  if(sync){const url=new URL(location.href);for(const[key,input]of Object.entries(controls)){input.value?url.searchParams.set(key,input.value):url.searchParams.delete(key)}period==='upcoming'?url.searchParams.delete('period'):url.searchParams.set('period',period);history.replaceState(null,'',url);}
 }
 function restore(){const params=new URLSearchParams(location.search);period=labels[params.get('period')]?params.get('period'):'upcoming';for(const[key,input]of Object.entries(controls))input.value=(params.get(key)||'').slice(0,200);if(controls.prefecture.value||controls.kind.value||controls.month.value)document.querySelector('.event-more-filters').open=true;apply(false)}
 form.hidden=false;document.querySelector('.event-periods').hidden=false;document.querySelector('[data-event-empty-reset]').hidden=false;
 form.addEventListener('submit',e=>{e.preventDefault();apply()});form.addEventListener('input',()=>apply());form.addEventListener('change',()=>apply());form.addEventListener('reset',()=>{setTimeout(()=>{period='upcoming';apply();controls.q.focus()},0)});
 buttons.forEach(button=>button.addEventListener('click',()=>{period=button.dataset.period;apply()}));window.addEventListener('popstate',restore);document.addEventListener('visibilitychange',()=>{if(!document.hidden)apply(false)});setInterval(()=>{if(!document.hidden)apply(false)},60000);restore();
})();
