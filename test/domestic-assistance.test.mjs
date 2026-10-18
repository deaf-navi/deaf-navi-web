import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDomesticPage,collectDomesticPages} from '../src/lib/domestic-pages.mjs';
import {buildArticle,curateArticles,stripInternal,publicationExclusionReason} from '../src/lib/curation.mjs';
import {applyNewsAssistance,newsArticleHash,missingNewsFallbacks} from '../src/lib/news-assistance.mjs';
import {prepareDomesticPublication} from '../src/lib/publication-quality.mjs';
import {prepareCurationReview} from '../scripts/prepare-curation-review.mjs';
import {buildNewsReviewQueue} from '../src/lib/news-review-queue.mjs';
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
 assert.equal(applyNewsAssistance([article],[{...review,publicSummary:'字幕対応の開始案内です。'}],{now}).articles[0].summary,'字幕対応の開始案内です。');
 assert.equal(applyNewsAssistance([article],[{...review,articleHash:'changed',publicSummary:'古い確認からの要約'}],{now}).articles[0].summary,article.summary);
 assert.equal(applyNewsAssistance([article],[{...review,publicSummary:'長'.repeat(181)}],{now}).articles[0].summary,article.summary);
});
test('source preparation verifies literal fragments and does not approve sharing or visual checks',async()=>{
 const target={kind:'event',title:'手話交流',sourceUrl:'https://example.org/event',officialVerified:true,sourceMode:'html',fragments:['開催日 2026年11月14日','会場 市民会館']};
 const fetchResource=async()=>({status:200,headers:{'content-type':'text/html'},text:'<p>開催日 <b>2026年11月14日</b></p><p>会場 市民会館</p>'});
 const result=await prepareCurationReview([target],{fetchResource,now});assert.equal(result.tasks.length,1);assert.equal(result.publicDataReviewed,false);assert.equal(result.tasks[0].reviewedAt,undefined);
 for(const change of [{sourceMode:'visual'},{fragments:['存在しない文面']},{approvedDocumentHash:'changed'}])assert.equal((await prepareCurationReview([{...target,...change}],{fetchResource,now})).exceptions.length,1);
});

test('recall queue skips hard exclusions and published duplicates, retaining uncertain relevance',()=>{
 const base={id:'https://example.org/story',title:'手話交流会の開催について',summary:'手話で交流します。',publishedAt:'2026-10-17T00:00:00Z',_sourceTier:'google'};
 const soft={...base,id:'https://example.org/uncertain',title:'地域の市民セミナー',summary:'対象は公式案内へ。'};
 const hard=['画像20 / 32＞手話の紹介','テスト投稿','補聴器の市場規模・予測レポート'].map((title,i)=>({...base,id:'https://example.org/excluded/'+i,title}));
 const duplicate={...base,id:'https://other.org/story'};
 const result=buildNewsReviewQueue([base,duplicate,soft,...hard],[base],{now});
 assert.equal(result.counts.hardExcluded,3);assert.equal(result.counts.duplicateOfPublished,1);
 assert.deepEqual(result.candidates.map(x=>x.sourceUrl),[soft.id]);assert.equal(result.candidates[0].reason,'unrelated');
 const serialized=JSON.stringify(result);assert.ok(!serialized.includes(soft.title));assert.ok(!serialized.includes(soft.summary));
 assert.equal(result.candidates[0].approved,undefined);assert.equal(result.candidates[0].reviewedAt,undefined);
});

test('official pages are fetched once across preparation batches, including failed fetches',async()=>{
 const sourceCache=new Map();let calls=0;
 const target={kind:'event',recordId:'fixture',title:'手話交流会',sourceUrl:'https://example.org/notice',sourceMode:'html',officialVerified:true,fragments:['手話交流会']};
 const fetchResource=async()=>{calls++;return {status:200,headers:{'content-type':'text/html'},text:'<p>手話交流会</p>'};};
 for(let i=0;i<2;i++)assert.equal((await prepareCurationReview([{...target,recordId:'fixture-'+i}],{now,fetchResource,sourceCache})).tasks.length,1);
 assert.equal(calls,1);
 const failedCache=new Map(),failed=async()=>{calls++;throw new Error('temporary');};
 for(let i=0;i<2;i++)assert.equal((await prepareCurationReview([target],{now,fetchResource:failed,sourceCache:failedCache})).exceptions.length,1);
 assert.equal(calls,2);
});

test('bounded queue prioritizes direct sources and rotates publishers without merging distinct dates',()=>{
 const base={summary:'詳細は公式案内へ。',publishedAt:'2026-10-17T00:00:00Z',_sourceTier:'google'};
 const noisy=Array.from({length:45},(_,i)=>({...base,id:'https://busy.org/'+i,sourceUrl:'https://busy.org',title:`地域からのお知らせ 第${i+1}回`}));
 const other={...base,id:'https://other.org/notice',sourceUrl:'https://other.org',title:'市民センターのお知らせ'};
 const official={...base,id:'https://official.org/notice',sourceUrl:'https://official.org',title:'参加者募集のお知らせ',_sourceTier:'official',_feedUrl:'https://official.org/feed'};
 const mixed={...base,id:'https://culture.org/notice',sourceUrl:'https://culture.org',title:'作品情報',_sourceTier:'broad',_feedUrl:'https://culture.org/feed'};
 const result=buildNewsReviewQueue([...noisy,other,official,mixed],[],{now});
 assert.equal(result.candidates.length,40);assert.equal(result.counts.deferred,8);
 assert.deepEqual(result.candidates.slice(0,2).map(x=>x.sourceUrl),[official.id,mixed.id]);
 assert.ok(result.candidates.slice(0,4).some(x=>x.sourceUrl===other.id));
 assert.throws(()=>buildNewsReviewQueue([],[],{limit:41}));
});

test('queue comparisons retain fresh hashes and never interpret unchanged feeds as source approval',()=>{
 const fresh={id:'https://example.org/notice',title:'地域の活動',summary:'公開のお知らせ',publishedAt:'2026-10-17T00:00:00Z',_sourceTier:'broad'};
 const previous=buildNewsReviewQueue([fresh],[],{now});
 const again=buildNewsReviewQueue([fresh,{...fresh,summary:'古い保存本文'}],[],{now,previous});
 assert.equal(again.comparison.unchanged,1);assert.equal(again.candidates[0].articleHash,newsArticleHash(fresh));
 const changed=buildNewsReviewQueue([{...fresh,summary:'新しい告知'}],[],{now,previous});assert.equal(changed.comparison.changed,1);
 const stale=buildNewsReviewQueue([{...fresh,publishedAt:'2025-01-01T00:00:00Z'}],[],{now});assert.equal(stale.counts.outsideWindow,1);
 assert.equal(again.candidates[0].publicationApproved,undefined);
});

test('reviewed classification and summary survive rebuilds only while the exact saved content is current',()=>{
 const article={id:'https://example.org/film',title:'作品名だけの案内',summary:'',publishedAt:'2026-10-17T00:00:00Z',_sourceTier:'broad'};
 const review={id:article.id,articleHash:newsArticleHash(article),reviewedAt:new Date(now).toISOString(),sourceUrl:article.id,approved:true,relevance:'yes',contentType:'announcement',evidence:'字幕対応のお知らせです。',model:'gpt-6.1-sol',publicSummary:'日本語字幕の鑑賞サポートを開始します。'};
 const saved=stripInternal(applyNewsAssistance([article],[review],{now}).articles[0]);
 const data={generatedAt:new Date(now).toISOString(),count:1,articles:[saved]};
 const rebuilt=prepareDomesticPublication(data,{now});
 assert.equal(rebuilt.articles.length,1);assert.equal(rebuilt.articles[0].newsContext,'announcement');
 assert.equal(rebuilt.articles[0].summary,review.publicSummary);
 assert.equal(rebuilt.articles[0].newsAssistance.reviewedAt,review.reviewedAt);
 assert.deepEqual(prepareDomesticPublication(rebuilt,{now}),rebuilt);
 assert.equal(prepareDomesticPublication(data,{now:now+7*86400000}).articles.length,0);
 assert.equal(prepareDomesticPublication({...data,articles:[{...saved,summary:'字幕という単語を含むが改変された説明'}]},{now}).articles.length,0);
 assert.equal(applyNewsAssistance([saved],[],{now}).articles[0]._assistanceInvalid,true);
 const fallback=applyNewsAssistance([saved],[review],{now});assert.equal(fallback.applied,1);assert.equal(fallback.articles[0]._assistedReview.reviewedAt,review.reviewedAt);
 const changed={...article,summary:'別のお知らせへ変更'};
 assert.deepEqual(missingNewsFallbacks([changed],[saved]),[]);
 assert.equal(applyNewsAssistance([changed],[review],{now}).applied,0);
 assert.deepEqual(missingNewsFallbacks([],[saved]),[saved]);
 const legacy={...saved};delete legacy.newsAssistance;
 assert.equal(applyNewsAssistance([legacy],[review],{now}).articles[0]._assistanceInvalid,true);
});
