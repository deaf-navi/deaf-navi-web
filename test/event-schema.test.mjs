import test from 'node:test';
import assert from 'node:assert/strict';
import { eventSchema, renderEventDetail } from '../src/templates/event-detail.mjs';

const now=Date.parse('2026-10-30T00:00:00Z');
const event={id:'schema-image-fixture',title:'手話交流会',startDate:'2026-11-14',endDate:'2026-11-14',prefecture:'東京都',venue:'告知の会場',kind:'exchange',sourceUrl:'https://example.org/events/fixture/',sourceName:'公式告知',verifiedAt:new Date(now).toISOString(),verification:'verified',evidenceHash:'a'.repeat(64),status:'announced'};
const image='https://example.org/images/fixture-poster.png';

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
