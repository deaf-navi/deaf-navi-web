import test from 'node:test';import assert from 'node:assert/strict';
import {eventInformation,qualityReport} from '../src/lib/quality-report.mjs';
import {validEvent} from '../src/lib/events.mjs';
import {mkdtemp,mkdir,writeFile,readFile,rm,stat} from 'node:fs/promises';
import {join} from 'node:path';import {tmpdir} from 'node:os';import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {buildQualityReport,writeQualityReport,verifyCommittedQualityInputs} from '../scripts/report-publication-quality.mjs';
const now=Date.parse('2026-10-29T00:00:00Z');
const event={id:'test-event',title:'検証用手話講座',startDate:'2026-11-01',prefecture:'東京都',venue:'検証会場',kind:'course',status:'announced',verification:'verified',sourceUrl:'https://www.oioi-sign.com/events/test-fixture/',sourceName:'検証主催者',verifiedAt:'2026-10-28T00:00:00Z',evidenceHash:'a'.repeat(64),time:null,fee:'無料',target:'申込フォームで事前申込',communication:[]};
test('unknown, free, and explicitly not applicable remain distinct',()=>{
 assert.equal(eventInformation(event).time,'unknown');assert.equal(eventInformation(event).fee,'confirmed');assert.equal(eventInformation(event).communication,'unknown');
 const explicit={...event,informationStatus:{deadline:'not_applicable'},informationNotes:{deadline:'主催者の告知で申込不要と確認'}};
 assert.ok(validEvent(explicit));assert.equal(eventInformation(explicit).deadline,'not_applicable');
 assert.equal(validEvent({...explicit,informationNotes:{}}),false);
 assert.equal(eventInformation({...event,time:'時間未確認'}).time,'unknown');
 assert.equal(eventInformation({...event,fee:'詳細は公式案内へ'}).fee,'unknown');
 assert.equal(eventInformation({...event,target:'メールで申込。締切は要確認'}).signup,'confirmed');
 assert.equal(eventInformation({...event,time:'１３時〜１５時',fee:'５００円',target:'ＦＡＸで申込'}).time,'confirmed');
 assert.equal(eventInformation({...event,fee:'有料・金額未定'}).fee,'unknown');
 assert.equal(eventInformation({...event,target:'問合せ：電話 000。申込方法は未確認'}).signup,'unknown');
 assert.equal(eventInformation({...event,target:'申込不要'}).deadline,'not_applicable');
 assert.equal(eventInformation({...event,communication:[],communicationAvailability:'unavailable',informationNotes:{communication:'主催者の案内で字幕・通訳の提供なしを確認'}}).communication,'confirmed');
});
test('30-day coverage includes stale candidates with honest state and no invented conversions',()=>{
 const report=qualityReport({checkedAt:'2026-10-28T00:00:00Z',events:[event,{...event,id:'stale-event',verifiedAt:'2026-10-20T00:00:00Z'},{...event,id:'later-event',startDate:'2026-12-01'}]}, {world:{entries:[]}}, {now});
 assert.equal(report.events.length,2);assert.equal(report.recheckDue,1);assert.deepEqual(report.coverage.fee,{confirmed:2,notApplicable:0,unknown:0,total:2});assert.equal(report.metrics.confirmedAttendance,null);
});

async function reportFixture(t) {
 const root=await mkdtemp(join(tmpdir(),'dn-quality-release-'));t.after(()=>rm(root,{recursive:true,force:true}));
 await mkdir(join(root,'.state'));await mkdir(join(root,'docs'));
 const snapshot={checkedAt:'2026-10-29T00:00:00Z',events:[event],unrelatedPrivateField:'PRIVATE-CANARY'};
 for(const [file,data] of Object.entries({'.state/events.json':snapshot,'.state/publication-review-world.json':{version:1,entries:[]},'.state/publication-review-domestic.json':{version:1,entries:[]},'docs/articles-world.json':{generatedAt:'2026-10-29T00:00:00Z',count:1,articles:[{id:'unknown-test',originalTitle:'Unconfirmed fixture',region:'unknown'}]}}))await writeFile(join(root,file),JSON.stringify(data));
 return root;
}
test('release report binds exact input bytes, keeps unknowns, and omits unrelated input fields',async t=>{
 const root=await reportFixture(t),sourceCommit='a'.repeat(40),releaseId=sourceCommit+'-123-1';
 const report=await writeQualityReport({root,now,releaseId,sourceCommit});
 assert.equal(report.deployment.releaseId,releaseId);assert.equal(report.deployment.sourceCommit,sourceCommit);
 assert.equal(report.deployment.inputSha256.events,createHash('sha256').update(await readFile(join(root,'.state/events.json'))).digest('hex'));
 assert.equal(report.classificationReview.length,1);assert.equal(report.classificationReview[0].status,'unconfirmed');assert.equal(report.metrics.confirmedVisits,null);
 assert.ok(!JSON.stringify(report).includes('PRIVATE-CANARY'));
 if(process.platform!=='win32')assert.equal((await stat(join(root,'.state/publication-quality-report.json'))).mode&0o777,0o600);
 await assert.rejects(buildQualityReport({root,releaseId,sourceCommit:'b'.repeat(40)}),/release binding/);
});
test('missing or corrupt ledger fails closed without replacing the last good report',async t=>{
 const root=await reportFixture(t),output=join(root,'.state/publication-quality-report.json');await writeQualityReport({root,now});const before=await readFile(output,'utf8');
 const ledger=join(root,'.state/publication-review-world.json');
 for(const corrupt of ['invalid json',JSON.stringify({version:1}),JSON.stringify({version:1,entries:[{id:'bad',status:'unexpected'}]})]){
  await writeFile(ledger,corrupt);await assert.rejects(writeQualityReport({root,now}));assert.equal(await readFile(output,'utf8'),before);
 }
 await rm(ledger);await assert.rejects(writeQualityReport({root,now}),/ENOENT/);assert.equal(await readFile(output,'utf8'),before);
});
test('report generation rejects inconsistent World counts and public output destinations',async t=>{
 const root=await reportFixture(t);
 for(const output of [join(root,'docs/report.json'),join(root,'docs/..hidden/report.json'),join(root,'server/report.json')])await assert.rejects(writeQualityReport({root,output,now}),/public document root/);
 await writeFile(join(root,'docs/articles-world.json'),JSON.stringify({generatedAt:'2026-10-29T00:00:00Z',count:5,articles:[]}));
 await assert.rejects(buildQualityReport({root,now}),/World snapshot/);
});
test('release generation rejects input changes before or after report generation against git blobs',async t=>{
 const root=await reportFixture(t),git=(...args)=>execFileSync('git',args,{cwd:root,stdio:'pipe'}).toString('utf8').trim();
 git('init','-q');git('add','.');git('-c','user.name=Test','-c','user.email=test@example.invalid','commit','-qm','Fixture');
 const sourceCommit=git('rev-parse','HEAD'),releaseId=sourceCommit+'-123-1';const report=await buildQualityReport({root,now,sourceCommit,releaseId});
 await verifyCommittedQualityInputs(root,sourceCommit,report);
 await writeFile(join(root,'.state/publication-review-world.json'),JSON.stringify({version:1,entries:[{id:'changed',status:'held',article:{title:'Changed fixture'}}]}));
 await assert.rejects(verifyCommittedQualityInputs(root,sourceCommit,report),/differs from committed snapshot/);
 const changedReport=await buildQualityReport({root,now,sourceCommit,releaseId});await assert.rejects(verifyCommittedQualityInputs(root,sourceCommit,changedReport),/differs from committed snapshot/);
});
test('committed input contracts remain readable by the production report builder',async()=>{
 const report=await buildQualityReport();assert.equal(report.schemaVersion,'deafnavi-quality-report.v1');assert.equal(report.integrityWarnings.length,0);assert.equal(report.metrics.confirmedVisits,null);
});
