import { SITE_URL } from '../../config/site.mjs';
import { escapeHtml as e } from '../lib/text.mjs';
import { renderHead, renderGlobalHeader, renderSkipLink, renderFooter, jsonLdScript } from './partials.mjs';
const nav={newsHref:'/',worldHref:'/deaf-navi-world-jp.html',eventsHref:'/events.html',connectHref:'/connect/sign-cafe/',guideHref:'/guide.html',toolHref:'/otomado/',aboutHref:'/about.html'};
export function renderReaderPage({path,title,description,current='guide',section='暮らしのガイド',sectionPath='/guide.html',body,schemas=[],robots='index,follow,max-image-preview:large',scripts=''}) {
 const url=new URL(path,SITE_URL).href;
 const crumbs={'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:[['ホーム','/'],[section,sectionPath],[title,path]].map(([name,p],i)=>({'@type':'ListItem',position:i+1,name,item:new URL(p,SITE_URL).href}))};
 return `<!doctype html><html lang="ja"><head>${renderHead({title:title+' | Deaf Navi',description,canonical:url,basePath:'/',robots,jsonLd:jsonLdScript([crumbs,...schemas])})}<link rel="stylesheet" href="/reader.css?v=20261017seo">${current==='events'?'<link rel="stylesheet" href="/events.css?v=20261017edition">':''}</head><body class="reader-page ${current==='events'?'events-page':''}">${renderSkipLink()}${renderGlobalHeader({current,homeHref:'/',nav})}<main id="main" class="container reader"><nav class="site-breadcrumb" aria-label="パンくず"><a href="/">ホーム</a> / <a href="${e(sectionPath)}">${e(section)}</a></nav><h1>${e(title)}</h1><p class="reader-lead">${e(description)}</p>${body}</main>${renderFooter({year:new Date().getFullYear(),links:[{href:sectionPath,label:section+'へ戻る'},{href:'/about.html',label:'掲載方針・運営者'}]})}<script src="/ui-controls.js" defer></script>${scripts}</body></html>`;
}
