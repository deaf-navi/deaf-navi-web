import { test } from 'node:test';
import assert from 'node:assert/strict';
import { disasterNews, renderHearingDisasterPage } from '../src/templates/hearing-disaster.mjs';
import { DISASTER_RESOURCES } from '../src/hearing-disaster-data.mjs';
import { renderSitemapXml } from '../src/templates/feeds.mjs';
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
 assert.match(html,/現在の警報・避難情報は、気象庁やお住まいの自治体/);
 assert.match(html,/現在、掲載中の国内ニュースに該当する記事はありません/);
 assert.match(html,/canonical" href="https:\/\/deafnavi.com\/guide\/hearing-disaster\//);
 assert.doesNotMatch(html,/<form|role="alert"|情報を再確認中|準備中|draft|shelter-information-access|disaster-information-gaps/);
 for(const resource of DISASTER_RESOURCES){assert.ok(html.includes(resource.url));assert.ok(html.includes(resource.publisher));assert.ok(resource.dateLabel&&resource.note);}
 const xml=renderSitemapXml({generatedAt:new Date(now).toISOString(),isDev:false,files:{},events:[],now});
 assert.match(xml,/<loc>https:\/\/deafnavi.com\/guide\/hearing-disaster\/<\/loc>/);
 const entry=xml.split('<url>').find(x=>x.includes('/guide/hearing-disaster/'));
 assert.doesNotMatch(entry,/<lastmod>/); // A news build must not fabricate a new resource-review date.
});
test('news headings and summaries are escaped in the shared renderer',()=>{
 const html=renderHearingDisasterPage({articles:[{...a('escape','防災 <img src=x onerror=alert(1)>'),summary:'手話 & <script>alert(1)</script>'}],now}).html;
 assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img src=x|<script>alert/);
});
