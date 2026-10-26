import { test } from 'node:test';
import assert from 'node:assert/strict';
import { disasterNews, renderHearingDisasterPage } from '../src/templates/hearing-disaster.mjs';
import { DISASTER_RESOURCES } from '../src/hearing-disaster-data.mjs';
import { renderSitemapXml } from '../src/templates/feeds.mjs';
import { cleanDisasterSummary, normalizeDisasterTitle, disasterNewsFingerprint, disasterNewsReview, disasterNewsDisplay } from '../src/lib/disaster-news.mjs';
const now=Date.parse('2026-10-26T06:00:00Z');
const a=(id,title,category='safety',publishedAt='2026-10-25T00:00:00Z')=>({id:`https://example.org/${id}`,title,category,publishedAt,summary:'',sourceName:'資料発行元'});

test('disaster collection requires topic evidence, safe URLs and valid nonfuture publication dates',()=>{
 const records=[a('crime','聴覚障害者を狙った詐欺'),a('rescue','救急法教室'),a('news','聴覚障害者の防災訓練'),a('relay','災害時の手話通訳協定','relay'),a('general','台風での交通規制','general'),a('bad','防災の話','safety','not-a-date'),a('future','防災の話','safety','2026-10-27T00:00:00Z'),{...a('script','防災の話'),id:'javascript:alert(1)'}];
 const before=JSON.stringify(records);
 assert.deepEqual(disasterNews(records,{now}).map(g=>g.lead.id),['https://example.org/news','https://example.org/relay']);
 assert.equal(JSON.stringify(records),before);
});
test('news retains its original dates and URLs, deduplicates and limits newest topics',()=>{
 const old=a('old','難聴者の震災支援','safety','2024-01-06T00:00:00Z'), recent=a('recent','手話による防災教育');
 const groups=disasterNews([old,recent,{...recent}],{now,limit:1});
 assert.equal(groups.length,1);assert.equal(groups[0].articles.length,1);assert.equal(groups[0].lead,recent);
 const html=renderHearingDisasterPage({articles:[old],now}).html;
 assert.ok(html.includes(old.publishedAt));assert.ok(html.includes(`href="${old.id}"`));
 assert.match(html,/過去の災害や開催済みの催し/);
});
test('feature exposes dated primary resources without claiming live disaster coverage or publishing drafts',()=>{
 const {html,file}=renderHearingDisasterPage({now});
 assert.equal(file,'guide/hearing-disaster/index.html');
 assert.match(html,/現在の警報・避難情報は、<a href="https:\/\/www.jma.go.jp\/"/);
 assert.match(html,/現在、掲載中の国内ニュースに該当する記事はありません/);
 assert.match(html,/canonical" href="https:\/\/deafnavi.com\/guide\/hearing-disaster\//);
 assert.doesNotMatch(html,/<form|role="alert"|情報を再確認中|準備中|draft|shelter-information-access|disaster-information-gaps/);
 for(const resource of DISASTER_RESOURCES){assert.ok(html.includes(resource.url));assert.ok(html.includes(resource.publisher));assert.ok(resource.dateLabel&&resource.note);}
 const xml=renderSitemapXml({generatedAt:new Date(now).toISOString(),isDev:false,files:{},events:[],now});
 assert.match(xml,/<loc>https:\/\/deafnavi.com\/guide\/hearing-disaster\/<\/loc>/);
 const entry=xml.split('<url>').find(x=>x.includes('/guide/hearing-disaster/'));
 assert.doesNotMatch(entry,/<lastmod>/); // A news build must not fabricate a new resource-review date.
});

test('category and publisher alone do not establish disaster accessibility relevance',()=>{
 const general=a('general-safety','地域の総合防災訓練');
 const placeholder={...a('placeholder','防災グッズの紹介'),summary:'聴覚・手話に関わる取り組みについてのお知らせです。内容は公式記事をご確認ください。'};
 const political={...a('blog','災害時の手話通訳'),sourceUrl:'https://go2senkyo.com'};
 const relevant=a('battery','被災者の補聴器の修理支援');
 assert.deepEqual(disasterNews([general,placeholder,political,relevant],{now}).map(g=>g.lead.id),[relevant.id]);
});

test('feed display normalizes digits and removes repetition and incomplete tails without guessing words',()=>{
 assert.equal(normalizeDisasterTitle('【2026年1２月】講演①'),'【2026年12月】講演①');
 assert.equal(cleanDisasterSummary('講演会 内容の紹介です。 詳細はチラシ… 続きを読む ›','講演会'),'内容の紹介です。');
 assert.equal(cleanDisasterSummary('講演会 講師は団体名の途 […]','講演会'),'');
 assert.equal(cleanDisasterSummary('◆熊本訪問 令和8年熊...','◆熊本訪問'),'');
 assert.equal(cleanDisasterSummary('完成した概要です。 続きを読む ›','別の題名'),'完成した概要です。');
 assert.equal(cleanDisasterSummary('すべての内容です。','題名'),'すべての内容です。');
});

test('reviewed edits apply only to the exact feed record and never alter the source snapshot',()=>{
 const original={...a('review','防災教室'),summary:'途中 […]',sourceUrl:'https://example.org/'};
 const review={id:original.id,inputHash:disasterNewsFingerprint(original),hearingRelevant:true,summary:'手話のある教室の紹介。',articleUrl:'https://example.org/original',reason:'INTERNAL-REVIEW'};
 const reviews=[review],before=JSON.stringify(original);
 assert.equal(disasterNewsReview(original,reviews),review);
 assert.equal(disasterNews([original],{now,reviews}).length,1);
 assert.equal(disasterNewsDisplay(original,reviews).summary,review.summary);
 assert.equal(disasterNewsDisplay(original,reviews).id,review.articleUrl);
 assert.equal(JSON.stringify(original),before);
 for(const changed of [{title:'変更された防災教室'},{summary:'変更された本文'},{publishedAt:'2026-10-24T00:00:00Z'},{sourceName:'別媒体'},{sourceUrl:'https://other.example/'},{category:'general'}]){
  const next={...original,...changed};
  assert.equal(disasterNewsReview(next,reviews),undefined);
  assert.equal(disasterNewsDisplay(next,reviews).id,original.id);
  assert.equal(disasterNews([next],{now,reviews}).length,0);
 }
 assert.equal(disasterNewsDisplay(original,[{...review,articleUrl:'javascript:alert(1)'}]).id,original.id);
});

test('reviewed same-incident sources group before the limit while distinct locations and dates remain separate',()=>{
 const one=a('one','A市の聴覚障害者向け防災情報配信に不正アクセス');
 const two=a('two','聴覚障害者の防災配信で64人の情報漏えいの可能性 A市','safety','2026-10-24T20:00:00Z');
 const elsewhere=a('elsewhere','B市の聴覚障害者向け防災情報配信に不正アクセス');
 const reviews=[one,two].map((record,i)=>({id:record.id,inputHash:disasterNewsFingerprint(record),topic:'reviewed-incident-A',priority:i}));
 const groups=disasterNews([one,two,elsewhere],{now,reviews});
 assert.equal(groups.length,2);
 assert.equal(groups[0].lead,two);
 assert.deepEqual(groups[0].articles,[two,one]);
 assert.equal(groups[1].lead,elsewhere);
 const limit=disasterNews([one,two,elsewhere],{now,reviews,limit:1});
 assert.equal(limit[0].articles.length,2);
 assert.equal(disasterNews([{...two,publishedAt:'2026-10-20T00:00:00Z'},one],{now,reviews}).length,2);
});

test('resources distinguish personal preparation, current regional support and historical records',()=>{
 const {html}=renderHearingDisasterPage({now});
 assert.equal(DISASTER_RESOURCES.length,8);
 assert.match(html,/人工内耳は「修理に限る」/);
 assert.match(html,/全国一律の給付案内ではありません/);
 assert.match(html,/全日本ろうあ連盟・全国手話通訳問題研究会・日本手話通訳士協会/);
 assert.match(html,/本人・家族の備えを知る/);
 assert.ok(html.indexOf('暮らしのガイド「災害・緊急時」')<html.indexOf('<h2 id="resources">'));
 assert.match(html,/href="#disaster-news">防災・災害に関するニュース<\/a>/);
 assert.doesNotMatch(html.split('<main')[1].split('</main>')[0],/おとまど|防災庁|hearingRelevant|inputHash|INTERNAL-REVIEW/);
 for(const r of DISASTER_RESOURCES)for(const link of r.links||[])assert.ok(html.includes(link.url));
});
test('news headings and summaries are escaped in the shared renderer',()=>{
 const html=renderHearingDisasterPage({articles:[{...a('escape','防災 <img src=x onerror=alert(1)>'),summary:'手話 & <script>alert(1)</script>'}],now}).html;
 assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img src=x|<script>alert/);
});
