import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceReviewDigest,validSourceReview,reviewedTextFingerprint,sourceDispositionDigest} from '../src/lib/source-review.mjs';
import {sourceFingerprint,translationFingerprint,restoreSourceReviewedArticles,mergePublicationLedger,mergePublicationLedgers} from '../src/lib/publication-ledger.mjs';
import {prepareWorldPublication,publicPublicationSnapshot} from '../src/lib/publication-quality.mjs';
import {worldLocation} from '../src/lib/world-location.mjs';
import {qualityReport} from '../src/lib/quality-report.mjs';
import {settleTranslations} from '../src/lib/world-pending.mjs';

const time='2026-10-29T00:00:00Z';
test('resolved decisions supersede older unchanged holds while new or changed holds reopen safely',()=>{
 const {article,review}=fixture(),done={...review,status:'archived',reason:'archived-original-date'},old={id:article.id,status:'held',reason:'source-date-mismatch',sourceFingerprint:sourceFingerprint(article),article,firstSeenAt:'2026-10-28T00:00:00Z'};
 for(const [left,right] of [[done,old],[old,done]]){const first=mergePublicationLedgers({entries:[left]},{entries:[right]});assert.equal(first.entries[0].status,'archived');assert.deepEqual(mergePublicationLedgers(first,{entries:[right]}),first);}
 for(const hold of [{...old,lastSeenAt:'2026-10-29T01:00:00Z'},{...old,sourceFingerprint:'changed'}]){const merged=mergePublicationLedgers({entries:[done]},{entries:[hold]});assert.equal(merged.entries[0].status,'held');assert.ok(merged.entries[0].reviewHistory.some(x=>x.status==='archived'));}
});
test('exact new feed IDs become closure observations without creating unresolved holds',()=>{
 const {article,review}=fixture(),done={...review,status:'archived',reason:'archived-original-date'},data={articles:[{...article,id:'new-feed-id'}]},ledger={entries:[done]};
 const result=prepareWorldPublication(data,{ledger}),merged=mergePublicationLedger(ledger,data,result,{now:time});assert.equal(result.articles.length,0);assert.equal(merged.entries.length,1);assert.equal(merged.entries[0].status,'archived');assert.equal(merged.entries[0].observedIds[0].id,'new-feed-id');assert.deepEqual(mergePublicationLedger(merged,data,result,{now:time}),merged);
 const changed={articles:[{...data.articles[0],originalSummary:'changed source text'}]},reopened=mergePublicationLedger(merged,changed,prepareWorldPublication(changed,{ledger:merged}),{now:time});assert.equal(reopened.entries.find(x=>x.id==='new-feed-id').reason,'source-changed-after-closure');
});
test('changed ABC host and feed description create a possible repost hold, never an inherited approval',()=>{
 const {article,review}=fixture({originalTitle:'A child receives sign language support',sourceUrl:'https://abcnews.go.com'}),done={...review,status:'archived',reason:'archived-original-date'},data={articles:[{...article,id:'new-id',sourceUrl:'https://abcnews.com',originalSummary:'new RSS description'}]},ledger={entries:[done]};
 const result=prepareWorldPublication(data,{ledger});assert.equal(result.articles.length,0);assert.equal(result.publicationReview.removed[0].reason,'possible-repost-of-closed');const merged=mergePublicationLedger(ledger,data,result,{now:time});assert.equal(merged.entries[1].status,'held');assert.equal(merged.entries[1].relatedClosedId,article.id);
 assert.equal(prepareWorldPublication(data,{ledger:{entries:[review]}}).articles.length,1);
});
test('duplicate IDs are rejected before ledger consolidation can erase a closure',()=>{
 const {article,review}=fixture(),duplicate={entries:[{...review,status:'archived'},review]};assert.throws(()=>mergePublicationLedger(duplicate,{articles:[article]},{publicationReview:{removed:[]}}),/Duplicate/);assert.throws(()=>mergePublicationLedgers(duplicate,{entries:[]}),/Duplicate/);assert.throws(()=>mergePublicationLedgers({entries:[]},duplicate),/Duplicate/);
});
test('public snapshot omits removed titles and decisions after private recording',()=>{
 const {article,review}=fixture(),ledger={entries:[{...review,status:'excluded',reason:'advertisement'}]},data={articles:[article]},result=prepareWorldPublication(data,{ledger}),safe=publicPublicationSnapshot(result);
 assert.equal(result.publicationReview.removed.length,1);assert.deepEqual(safe.publicationReview.removed,[]);assert.equal(safe.publicationReview.removedCount,1);assert.ok(!JSON.stringify(safe).includes(article.id));assert.equal(publicPublicationSnapshot(safe),safe);assert.equal(mergePublicationLedger(ledger,data,result).entries[0].status,'excluded');
});
test('conflicting branch approvals cannot reopen archived or excluded source records',()=>{
  const {article,review}=fixture();
  const later={...review,reviewedAt:'2026-10-29T01:00:00Z'};later.reviewDigest=sourceReviewDigest(later);
  for(const status of ['archived','excluded']){
    const blocked={...review,status,reason:'closed-source-review'};
    for(const [left,right] of [[blocked,later],[later,blocked]]){
      const merged=mergePublicationLedgers({entries:[left]},{entries:[right]});
      assert.equal(merged.entries[0].status,status);
      assert.equal(prepareWorldPublication({articles:[article]},{ledger:merged}).articles.length,0);
      assert.ok(merged.entries[0].reviewHistory.length>=2);
    }
    const conflict={entries:[blocked,review]};
    assert.equal(restoreSourceReviewedArticles({generatedAt:time,articles:[]},conflict,{now:Date.parse(time)}).articles.length,0);
  }
});
function fixture(extra={}) {
  const article={id:'fixture',originalTitle:'청신경 연구',originalSummary:'청신경 연구',title:'聴神経の研究',summary:'聴神経の研究',sourceUrl:'https://example.org',publishedAt:'2026-10-28T00:00:00Z',region:'unknown',...extra};
  const review={id:article.id,status:'source-verified',reviewedBy:'codex-opus-source-review',reviewers:['Codex','claude-opus-5-5'],reviewedAt:time,
    sourceFingerprint:sourceFingerprint(article),sourcePublishedAt:article.publishedAt,translationFingerprint:translationFingerprint(article),reviewedTextFingerprint:reviewedTextFingerprint(article),article,
    sourceEvidence:[{url:'https://example.org/article/1',excerpt:'Research at a named hospital',method:'article-text',checkedAt:time}],
    restorationSnapshot:time,region:'asia_oceania',place:'Hospital in Korea',correctionTopic:'health',correctionTopicLabel:'医療・補聴'};
  review.reviewDigest=sourceReviewDigest(review);return {article,review,ledger:{entries:[review]}};
}
test('AI source review requires evidence and is never represented as human approval',()=>{
  const {article,review,ledger}=fixture();assert.equal(validSourceReview(review),true);
  const result=prepareWorldPublication({articles:[{...article,title:'青神経の研究'}]},{ledger});
  assert.equal(result.articles[0].title,'聴神経の研究');assert.equal(result.articles[0].japanesePostEditEngine,'codex-opus-source-review');
  assert.equal(worldLocation(article,{reviews:[review]}).regionEvidence.method,'codex-opus-source-review');
  const queryArticle={...review,sourceEvidence:[{...review.sourceEvidence[0],url:'https://example.org/?p=121'}]};
  queryArticle.reviewDigest=sourceReviewDigest(queryArticle);assert.equal(validSourceReview(queryArticle),true);
  for(const change of [{sourceEvidence:[]},{reviewers:['Codex']},{reviewedAt:'2099-01-01'},{sourceEvidence:[{url:'https://example.org/',excerpt:'country',method:'article-text',checkedAt:time}]}]){
    const bad={...review,...change};bad.reviewDigest=sourceReviewDigest(bad);assert.equal(validSourceReview(bad),false);
  }
});
test('source, evidence and corrected translation changes invalidate the reviewed record',()=>{
  const {article,review,ledger}=fixture();
  assert.equal(prepareWorldPublication({articles:[{...article,originalSummary:'Changed original'}]},{ledger}).articles.length,0);
  const changed={...review,article:{...article,summary:'Unreviewed promise of a cure'}};
  assert.equal(prepareWorldPublication({articles:[article]},{ledger:{entries:[changed]}}).articles.length,0);
  assert.equal(validSourceReview({...review,region:'americas'}),false);
  assert.equal(worldLocation({...article,originalTitle:'Changed original'},{reviews:[review]}).region,'unknown');
  assert.equal(prepareWorldPublication(prepareWorldPublication({articles:[article]},{ledger}),{ledger}).articles.length,1);
});
test('restoration is snapshot-bound, deduplicated, does not replace changed originals or revive expired news',()=>{
  const {article,ledger}=fixture();const now=Date.parse(time);
  const data={generatedAt:time,articles:[]};
  const restored=restoreSourceReviewedArticles(data,ledger,{now});assert.equal(restored.articles.length,1);
  assert.equal(restoreSourceReviewedArticles(restored,ledger,{now}).articles.length,1);
  assert.equal(restoreSourceReviewedArticles({...data,generatedAt:'2026-10-30T00:00:00Z'},ledger,{now}).articles.length,0);
  assert.equal(restoreSourceReviewedArticles(data,ledger,{now:now+91*86400000}).articles.length,0);
  const changed={...article,originalTitle:'Changed original'};
  assert.deepEqual(restoreSourceReviewedArticles({...data,articles:[changed]},ledger,{now}).articles,[changed]);
  assert.equal(prepareWorldPublication(data,{ledger}).articles.length,0,'ordinary filtering never reinserts omissions');
});
test('a checked programme context lifts only the ambiguity gate, not unrelated-news gates',()=>{
  const originalTitle='Hearing Loss, News Breakdown, Science Latest, Travel Ideas, Mighty Challenge';
  const {article,review}=fixture({originalTitle,originalSummary:originalTitle,title:'難聴を扱う番組',summary:'難聴のコーナーを含む音声番組'});
  assert.equal(prepareWorldPublication({articles:[article]},{ledger:{entries:[review]}}).articles.length,0);
  review.sourceContextConfirmed=true;review.reviewDigest=sourceReviewDigest(review);
  assert.equal(prepareWorldPublication({articles:[article]},{ledger:{entries:[review]}}).articles.length,1);
  const noise=fixture({originalTitle:'Mejores audífonos: los nominados en los Premios Xataka México 2026',originalSummary:'Mejores audífonos',title:'ヘッドホンの賞',summary:'音楽用ヘッドホン'});
  noise.review.sourceContextConfirmed=true;noise.review.reviewDigest=sourceReviewDigest(noise.review);
  assert.equal(prepareWorldPublication({articles:[noise.article]},{ledger:noise.ledger}).articles.length,0);
});
test('confirmed exclusions remain excluded after a refetch without turning into a new unresolved hold',()=>{
  const {article,review}=fixture();const excluded={...review,status:'excluded',reason:'unrelated'};
  const input={articles:[article]}, ledger={version:1,entries:[excluded]};
  const result=prepareWorldPublication(input,{ledger});assert.equal(result.articles.length,0);
  assert.deepEqual(mergePublicationLedger(ledger,input,result),ledger);
});

test('date-corrected historical records stay archived across refetch, new feed IDs and restoration',()=>{
  const {article,review}=fixture();const archived={...review,status:'archived',reason:'archived-original-date',sourcePublishedDate:'2001-02-13',sourceArticleUrl:'https://example.org/original',sourcePublication:{originalPublishedDate:'2001-02-13'}};
  const input={generatedAt:time,articles:[article]},ledger={version:1,entries:[archived]};
  const result=prepareWorldPublication(input,{ledger});assert.equal(result.articles.length,0);
  assert.deepEqual(mergePublicationLedger(ledger,input,result),ledger);
  assert.equal(prepareWorldPublication({articles:[{...article,id:'new-feed-id',publishedAt:time}]},{ledger}).articles.length,0);
  assert.equal(restoreSourceReviewedArticles({generatedAt:time,articles:[]},ledger,{now:Date.parse(time)}).articles.length,0);
  assert.equal(prepareWorldPublication(input,{ledger:{entries:[review,archived]}}).articles.length,0,'an approval cannot override an archive');
});

test('a changed archived original reopens review and preserves the old evidence',()=>{
  const {article,review}=fixture();const archived={...review,status:'archived',reason:'archived-original-date',sourcePublishedDate:'2001-02-13',sourceArticleUrl:'https://example.org/original',sourcePublication:{originalPublishedDate:'2001-02-13'}};
  const ledger={entries:[archived]},input={articles:[{...article,originalSummary:'A materially different report'}]};
  const result=prepareWorldPublication(input,{ledger});assert.equal(result.articles.length,0);
  const next=mergePublicationLedger(ledger,input,result).entries[0];assert.equal(next.status,'held');
  assert.equal(next.reviewHistory.at(-1).sourcePublishedDate,'2001-02-13');assert.equal(next.observations[0].originalSummary,article.originalSummary);
  assert.equal(next.reason,'source-changed-after-closure');assert.equal(next.sourceArticleUrl,archived.sourceArticleUrl);const report=qualityReport({events:[]},{world:{entries:[next]}},{now:Date.parse(time)});assert.equal(report.holds[0].previousSourcePublication.originalPublishedDate,'2001-02-13');assert.equal(report.holds[0].reopenedFrom.status,'archived');
});

test('changed disposition evidence is reported without making the closed item publishable',()=>{
 const {article,review}=fixture(),done={...review,status:'archived',reason:'archived-original-date',sourcePublication:{originalPublishedDate:'2001-02-13'}};done.dispositionDigest=sourceDispositionDigest(done);
 assert.equal(qualityReport({events:[]},{world:{entries:[done]}}).integrityWarnings.length,0);
 const changed={...done,sourcePublication:{originalPublishedDate:'2002-02-13'}},ledger={entries:[changed]};assert.equal(qualityReport({events:[]},{world:ledger}).integrityWarnings.length,1);assert.equal(prepareWorldPublication({articles:[article]},{ledger}).articles.length,0);
});

test('private quality report separates unresolved holds, dated archives and advertising exclusions',()=>{
  const {article}=fixture();const report=qualityReport({events:[]},{world:{entries:[
    {id:'hold',status:'held',article},
    {id:'old',status:'archived',article,reason:'archived-original-date',sourcePublishedDate:'2001-02-13',sourceArticleUrl:'https://example.org/original'},
    {id:'ad',status:'excluded',article,reason:'advertisement'},
  ]}},{now:Date.parse(time)});
  assert.equal(report.holds.length,1);assert.equal(report.resolvedReviews.length,2);
  assert.deepEqual(report.sourceReview,{verified:0,excluded:1,archived:1});
  assert.equal(report.resolvedReviews[0].sourcePublishedDate,'2001-02-13');assert.equal(report.resolvedReviews[0].feedPublishedAt,article.publishedAt);
});
test('changed originals preserve the previous source evidence in review history',()=>{
  const {article,ledger}=fixture();const changed={...article,originalSummary:'Changed original'};
  const data={articles:[changed]}, result=prepareWorldPublication(data,{ledger});
  const merged=mergePublicationLedger(ledger,data,result);
  assert.deepEqual(merged.entries[0].reviewHistory[0].sourceEvidence,ledger.entries[0].sourceEvidence);
});
test('published counts describe the corrected feed while collection metrics are retained',()=>{
  const {article,ledger}=fixture();const data={articles:[article],quality:{selectedCount:600,regionCounts:{europe_cis:600}}};
  const result=prepareWorldPublication(data,{ledger});
  assert.equal(result.quality.selectedCount,600);assert.equal(result.quality.publishedCounts.selectedCount,1);
  assert.equal(result.quality.publishedCounts.regionCounts.asia_oceania,1);
  assert.deepEqual(prepareWorldPublication(result,{ledger}),result);
});
test('source date discrepancies are held with original and feed dates kept separately',()=>{
  const {article}=fixture({publishedAt:'2026-02-11T20:46:09.000Z'});
  const hold={id:article.id,status:'held',reason:'source-date-mismatch',sourceFingerprint:sourceFingerprint(article),translationFingerprint:translationFingerprint(article),article,sourcePublishedDate:'2001-02-13',sourceArticleUrl:'https://example.org/original'};
  const ledger={version:1,entries:[hold]},data={articles:[article]};
  const result=prepareWorldPublication(data,{ledger});assert.equal(result.articles.length,0);
  assert.deepEqual(mergePublicationLedger(ledger,data,result),ledger);
  const report=qualityReport({events:[]},{world:ledger},{now:Date.parse(time)});
  assert.equal(report.holds[0].sourcePublishedDate,'2001-02-13');
  assert.equal(report.holds[0].feedPublishedAt,article.publishedAt);
  assert.equal(report.holds[0].sourceUpdatedDate,null);
  assert.equal(report.holds[0].articleUrl,'https://example.org/original');
});
test('same headline cannot transfer a correction to another ID or release its own hold',()=>{
  const {article,review,ledger}=fixture();const other={...article,id:'different-article',title:'青神経の研究'};
  assert.equal(prepareWorldPublication({articles:[other]},{ledger}).articles.length,0);
  const ownHold={...review,id:'different-article',status:'held',reason:'source-date-mismatch',article:other};
  assert.equal(prepareWorldPublication({articles:[other]},{ledger:{entries:[review,ownHold]}}).articles.length,0);
});
test('changed source date invalidates translation and location evidence',()=>{
  const {article,review,ledger}=fixture();const changed={...article,publishedAt:'2026-10-27T00:00:00Z'};
  assert.equal(prepareWorldPublication({articles:[changed]},{ledger}).articles.length,0);
  assert.equal(worldLocation(changed,{reviews:[review]}).region,'unknown');
});
test('human correction takes priority and has no stale AI model label',()=>{
  const {article,review}=fixture();const humanArticle={...article,title:'人が確認した聴神経の研究'};
  const human={...review,status:'approved',reviewedBy:'human',article:humanArticle,translationFingerprint:translationFingerprint(humanArticle)};
  const result=prepareWorldPublication({articles:[{...article,japanesePostEditModel:'claude-opus-5-5'}]},{ledger:{entries:[review,human]}}).articles[0];
  assert.equal(result.title,humanArticle.title);assert.equal(result.japanesePostEditEngine,'human-review');assert.equal(result.japanesePostEditModel,undefined);
});
test('restored snapshot is not carried over by the next curation without fresh collection',()=>{
  const {article,ledger}=fixture();const data={generatedAt:time,articles:[]};
  const restored=prepareWorldPublication(restoreSourceReviewedArticles(data,ledger,{now:Date.parse(time)}),{ledger});
  const carried=settleTranslations([],JSON.parse(JSON.stringify(restored)).articles,[]);
  assert.equal(carried.articles.length,0);
  const fresh=settleTranslations([article],restored.articles,[]);assert.equal(fresh.articles.length,1);assert.equal(fresh.articles[0].publicationRestoredSnapshot,undefined);
  const next={generatedAt:'2026-10-30T00:00:00Z',articles:carried.articles};assert.equal(restoreSourceReviewedArticles(next,ledger,{now:Date.parse(next.generatedAt)}).articles.length,0);
});
test('invalidated review history retains sufficient evidence to check its digest',()=>{
 const {article,review,ledger}=fixture();const data={articles:[{...article,originalTitle:'A changed source'}]};
 const merged=mergePublicationLedger(ledger,data,prepareWorldPublication(data,{ledger}));
 const previous=merged.entries[0].reviewHistory[0];assert.equal(previous.reviewDigest,sourceReviewDigest(previous));assert.ok(validSourceReview(previous));assert.deepEqual(previous.reviewers,review.reviewers);
});
test('ambiguous city names and sign-language names alone do not establish geography',()=>{
 for(const originalTitle of ['Deaf event in London','Deaf event in Paris','New Zealand Sign Language lesson','Taiwan Sign Language','Kenya Sign Language Bill'])assert.equal(worldLocation({originalTitle},{reviews:[]}).region,'unknown',originalTitle);
 const {article,ledger}=fixture();assert.equal(worldLocation(article,{reviews:[],ledger}).region,'asia_oceania');
 assert.equal(worldLocation({originalTitle:'Passing of Northern Ireland Sign Language Bill'},{reviews:[]}).region,'europe_cis');
});
