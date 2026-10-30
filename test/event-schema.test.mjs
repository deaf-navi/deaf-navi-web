import test from 'node:test';
import assert from 'node:assert/strict';
import { eventSchema, renderEventDetail } from '../src/templates/event-detail.mjs';
import { validEvent, reviewedVisualEvent } from '../src/lib/events.mjs';

const now=Date.parse('2026-10-30T00:00:00Z');
const event={id:'schema-image-fixture',title:'手話交流会',startDate:'2026-11-14',endDate:'2026-11-14',prefecture:'東京都',venue:'告知の会場',kind:'exchange',sourceUrl:'https://example.org/events/fixture/',sourceName:'公式告知',verifiedAt:new Date(now).toISOString(),verification:'verified',evidenceHash:'a'.repeat(64),status:'announced'};
const image='https://example.org/images/fixture-poster.png';

const reviewedTerms={...event,fee:'無料',organizer:'共催サークル・市',
 organizers:[{name:'共催サークル'},{name:'市',url:'https://city.example.org/'}],
 offers:[{price:0,priceCurrency:'JPY',url:event.sourceUrl}],
};

test('reviewed free registration and co-organizers reach rendered Event markup',()=>{
 const schema=eventSchema(reviewedTerms,now);
 assert.deepEqual(schema.offers,[{'@type':'Offer',price:0,priceCurrency:'JPY',url:event.sourceUrl}]);
 assert.deepEqual(schema.organizer,[{'@type':'Organization',name:'共催サークル'},{'@type':'Organization',name:'市',url:'https://city.example.org/'}]);
 const html=renderEventDetail(reviewedTerms,{now});
 assert.match(html,/href="https:\/\/city.example.org\/"[^>]*>市<\/a>/);
 assert.ok(html.includes('共催サークル'));
 assert.ok(html.includes('無料'));
 for(const key of ['availability','validFrom'])assert.ok(!(key in schema.offers[0]));
 assert.ok(!('performer' in schema));
 assert.ok(!('url' in schema.organizer[0]),'a co-host without a verified website keeps its name only');
});

test('free text and source publisher never imply offers, organizer URLs or performers',()=>{
 const schema=eventSchema({...event,fee:'無料',organizer:'主催者'},now);
 assert.deepEqual(schema.organizer,{'@type':'Organization',name:'主催者'});
 assert.ok(!('offers' in schema));assert.ok(!('performer' in schema));
});

test('a reviewed registration start date keeps day precision without invented opening hours',()=>{
 const input={...reviewedTerms,offers:[{...reviewedTerms.offers[0],validFrom:'2026-10-19'}]};
 assert.equal(eventSchema(input,now).offers[0].validFrom,'2026-10-19');
 assert.ok(!('availability' in eventSchema(input,now).offers[0]));
 for(const value of ['2026-02-30','10月19日','',123]){
  assert.ok(!validEvent({...input,offers:[{...input.offers[0],validFrom:value}]}));
 }
});

test('optional event terms reject invalid prices, URLs and entity names',()=>{
 for(const patch of [
  {offers:[{price:-1,priceCurrency:'JPY',url:event.sourceUrl}]},
  {offers:[{price:'0',priceCurrency:'JPY',url:event.sourceUrl}]},
  {offers:[{price:Infinity,priceCurrency:'JPY',url:event.sourceUrl}]},
  {offers:[{price:0,priceCurrency:'yen',url:event.sourceUrl}]},
  {offers:[{price:0,priceCurrency:'JPY',url:'javascript:alert(1)'}]},
  {offers:[{price:0,priceCurrency:'JPY',url:'https://user:secret@example.org/'}]},
  {organizers:[{name:'',url:'https://city.example.org/'}]},
  {organizers:[{name:'市',url:'http://city.example.org/'}]},
  {organizers:[{name:'市',url:'https://127.0.0.1/'}]},
  {organizers:'市'},
 ]){assert.ok(!validEvent({...reviewedTerms,...patch}),JSON.stringify(patch));assert.equal(eventSchema({...reviewedTerms,...patch},now),null);}
 assert.ok(validEvent(reviewedTerms));assert.ok(validEvent(event));
});

test('review metadata survives collection without extending visual review expiry',()=>{
 const entry={...reviewedTerms,verificationMode:'visual',reviewedAt:new Date(now).toISOString(),sourceHash:'a'.repeat(64),evidence:['date','place','free']};
 const fresh=reviewedVisualEvent(entry,now);
 assert.deepEqual(eventSchema(fresh,now).offers,eventSchema(reviewedTerms,now).offers);
 const expired=reviewedVisualEvent(entry,now+48*3600000);
 assert.equal(expired.verifiedAt,entry.reviewedAt);assert.equal(eventSchema(expired,now+48*3600000),null);
});

test('Event markup reuses the announcement image already shown on the detail page',()=>{
 const input={...event,thumbnail:{url:image,source:'og:image',pageUrl:event.sourceUrl}};
 const schema=eventSchema(input,now);
 assert.equal(schema.image,image);
 const html=renderEventDetail(input,{now});
 const nodes=[...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m=>JSON.parse(m[1])).flatMap(value=>Array.isArray(value)?value:value['@graph']||[value]);
 assert.equal(nodes.find(node=>node['@type']==='Event').image,image);
 assert.ok(html.includes('class="reader-poster" src="'+image+'"'));
 for(const key of ['offers','performer','organizer'])assert.ok(!(key in schema),'unknown '+key+' stays absent');
});

test('missing, omitted or unsafe images never create an Event image or a placeholder',()=>{
 for(const input of [event,{...event,thumbnail:{url:''}},{...event,thumbnailPolicy:'omit',thumbnail:{url:image}},{...event,thumbnail:{url:'javascript:alert(1)'}},{...event,thumbnail:{url:'data:image/png;base64,AA=='}},{...event,thumbnail:{url:'http://example.org/poster.png'}}]){
  assert.ok(!('image' in eventSchema(input,now)));
 }
 assert.deepEqual(eventSchema({...event,thumbnail:{url:image}},now),{...eventSchema(event,now),image});
});

test('an image never bypasses freshness, cancellation or physical-event eligibility',()=>{
 for(const input of [
  {...event,verifiedAt:new Date(now-48*3600000).toISOString()},
  {...event,verification:'needs_review'},
  {...event,status:'cancelled'},
  {...event,startDate:'2026-10-29',endDate:'2026-10-29'},
  {...event,prefecture:'オンライン'},
 ])assert.equal(eventSchema({...input,thumbnail:{url:image}},now),null);
});
