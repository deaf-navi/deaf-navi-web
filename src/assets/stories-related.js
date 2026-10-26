(() => {
  // Only explicit editorial associations. Never infer relationships from keywords.
  const path=location.pathname.replace(/index\.html$/,'');if(path.startsWith('/admin')||path.startsWith('/stories'))return;
  const main=document.querySelector('main');if(!main)return;
  const css=document.createElement('link');css.rel='stylesheet';css.href='/stories.css?v=20261019c';document.head.append(css);
  const footer=document.querySelector('body > footer');if(footer&&!footer.querySelector('a[href="/stories/"]')){const p=document.createElement('p'),a=document.createElement('a');a.href='/stories/';a.textContent='読みもの';p.append(a);footer.append(p);}
  fetch('/stories/feed.json?page='+encodeURIComponent(path),{credentials:'omit',referrerPolicy:'no-referrer'}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{
    if(!Array.isArray(data.articles)||!data.articles.length)return;
    const section=document.createElement('section');section.className='stories-related';const h=document.createElement('h2');h.textContent=path==='/'?'おすすめの読みもの':'関連する読みもの';section.append(h);
    const list=document.createElement('ul');for(const item of data.articles.slice(0,3)){if(!/^\/stories\/[a-z0-9-]+\/$/.test(item.url))continue;const li=document.createElement('li'),a=document.createElement('a'),p=document.createElement('p');a.href=item.url+(new URLSearchParams(location.search).get('dn_client')==='codex'?'?dn_client=codex':'');a.textContent=item.title;p.textContent=item.summary;li.append(a,p);list.append(li);}section.append(list);main.append(section);
  }).catch(()=>{});
})();
