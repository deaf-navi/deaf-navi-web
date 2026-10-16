import { SITE_URL } from '../../config/site.mjs';
import { GUIDE_TOPICS, GUIDE_TOPIC_REVIEWED } from '../guide-topics.mjs';
import { escapeHtml as e } from '../lib/text.mjs';
import { renderReaderPage } from './reader.mjs';
export function renderGuideTopics(){
 return GUIDE_TOPICS.map(topic=>{
  const path=`/guide/${topic.slug}/`;
  const body=`<p class="reader-note">Deaf Navi編集 · 内容・情報源の確認：<time datetime="${GUIDE_TOPIC_REVIEWED}">${GUIDE_TOPIC_REVIEWED}</time></p>${topic.sections.map(s=>`<section><h2>${e(s.title)}</h2>${s.example?`<p class="reader-example">${e(s.example)}</p>`:''}${s.text?`<p>${e(s.text)}</p>`:''}${s.items?`<ul>${s.items.map(t=>`<li>${e(t)}</li>`).join('')}</ul>`:''}</section>`).join('')}<section><h2>公式情報・相談先</h2><ul class="reader-resources">${topic.sources.map(s=>`<li><h3><a href="${e(s.url)}" target="_blank" rel="noopener noreferrer">${e(s.name)}（新しいタブ）</a></h3><p>${e(s.summary)}</p></li>`).join('')}</ul></section><section><h2>あわせて確認する</h2><nav class="reader-links" aria-label="関連ガイド">${GUIDE_TOPICS.filter(t=>t!==topic).map(t=>`<a href="/guide/${t.slug}/">${e(t.label)}</a>`).join('')}<a href="/events.html">国内の手話イベント</a><a href="/guide.html">すべてのガイド</a></nav></section>`;
  return {file:`guide/${topic.slug}/index.html`,html:renderReaderPage({path,title:topic.title,description:topic.description,body,schemas:[{'@context':'https://schema.org','@type':'Article',headline:topic.title,description:topic.description,url:new URL(path,SITE_URL).href,dateModified:GUIDE_TOPIC_REVIEWED,author:{'@type':'Organization',name:'Deaf Navi',url:SITE_URL+'about.html'},citation:topic.sources.map(s=>s.url)}]})};
 });
}
