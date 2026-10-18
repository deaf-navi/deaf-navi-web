import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDomesticPage,collectDomesticPages} from '../src/lib/domestic-pages.mjs';
import {buildArticle,curateArticles,stripInternal,publicationExclusionReason} from '../src/lib/curation.mjs';
import {applyNewsAssistance,newsArticleHash} from '../src/lib/news-assistance.mjs';
import {prepareCurationReview} from '../scripts/prepare-curation-review.mjs';
const now=Date.parse('2026-10-18T04:00:00Z');
test('official HTML discovery requires the publication date and a real permalink',async()=>{
 const source={parser:'jdba-blog',id:'jdba',url:'https://www.jdba.or.jp/db/blog/',sourceName:'全国盲ろう者協会',sourceUrl:'https://www.jdba.or.jp/'};
 const html='<a href="resp74_202609.html">記事</a><div class="art"><div class="art-title"><a name="74"></a><strong>開催案内</strong></div><div class="art-date">2026/09/29(Tue) 17:31:13</div><div class="art-com">盲ろう者の交流について</div></div>';
 const parsed=parseDomesticPage(html,source);assert.equal(parsed[0].publishedAt,'2026-09-29T08:31:13.000Z');assert.equal(parsed[0].id,'https://www.jdba.or.jp/db/blog/resp74_202609.html');
 assert.throws(()=>parseDomesticPage(html.replace('href="resp74_202609.html"','href="unknown"'),source));
 assert.equal((await collectDomesticPages({sources:[source],fetchResource:async()=>({status:503,headers:{}})})).health.failed.length,1);
 assert.equal(stripInternal(parsed[0])._reviewExcerpt,undefined);
});
test('mixed official blogs do not admit unrelated personal posts or republish source paragraphs',()=>{
 const feed={requireTopicMatch:true,linkOnlySummary:true,sourceTier:'official',url:'https://example.org/rss'};
 const article=buildArticle({id:'https://example.org/news',title:'猫と遊ぶ',summary:'休日にペットと過ごしました。',publishedAt:'2026-10-17T00:00:00Z'},feed);
 assert.equal(publicationExclusionReason(article),'source-topic-unconfirmed');
 const relevant=buildArticle({...article,title:'市民セミナーを開催しました',summary:'手話講座と情報保障を体験しました。'},feed);
 assert.equal(publicationExclusionReason(relevant),null);assert.ok(!relevant.summary.includes('体験しました'));
 const clean=stripInternal(relevant);assert.ok(!Object.keys(clean).some(k=>k.startsWith('_')));
});
test('reviewed API assistance is content-bound, expires and cannot bypass hard exclusions',()=>{
 const article={id:'https://example.org/story',title:'市民向けセミナー',summary:'地域での取り組み。',publishedAt:'2026-10-17T00:00:00Z',sourceName:'公共施設',_sourceTier:'google'};
 const review={id:article.id,articleHash:newsArticleHash(article),reviewedAt:new Date(now).toISOString(),sourceUrl:article.id,approved:true,relevance:'yes',contentType:'report',evidence:'確認済みの短い根拠',model:'gpt-6.1-sol'};
 const assisted=applyNewsAssistance([article],[review],{now});assert.equal(assisted.applied,1);assert.equal(curateArticles(assisted.articles,{},now).articles.length,1);assert.equal(stripInternal(assisted.articles[0]).newsContext,'report');
 for(const changed of [{...article,summary:'変更後の内容'},{...article,_sourceContentHash:'changed'}])assert.equal(applyNewsAssistance([changed],[review],{now}).applied,0);
 assert.equal(applyNewsAssistance([article],[review],{now:now+7*86400000}).applied,0);
 assert.equal(publicationExclusionReason({...assisted.articles[0],title:'テスト投稿'}),'placeholder');
 assert.equal(applyNewsAssistance([article],[{...review,relevance:'no'}],{now}).applied,0);
});
test('source preparation verifies literal fragments and does not approve sharing or visual checks',async()=>{
 const target={kind:'event',title:'手話交流',sourceUrl:'https://example.org/event',officialVerified:true,sourceMode:'html',fragments:['開催日 2026年11月14日','会場 市民会館']};
 const fetchResource=async()=>({status:200,headers:{'content-type':'text/html'},text:'<p>開催日 <b>2026年11月14日</b></p><p>会場 市民会館</p>'});
 const result=await prepareCurationReview([target],{fetchResource,now});assert.equal(result.tasks.length,1);assert.equal(result.publicDataReviewed,false);assert.equal(result.tasks[0].reviewedAt,undefined);
 for(const change of [{sourceMode:'visual'},{fragments:['存在しない文面']},{approvedDocumentHash:'changed'}])assert.equal((await prepareCurationReview([{...target,...change}],{fetchResource,now})).exceptions.length,1);
});
