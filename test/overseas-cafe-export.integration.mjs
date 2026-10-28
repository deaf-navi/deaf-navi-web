import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const dir=mkdtempSync(join(tmpdir(),'dn-overseas-export-'));
const env={...process.env,DEAFNAVI_DATA_DIR:dir};
try{
 const setup=spawnSync('php',['-r',`$db=new PDO('sqlite:'.getenv('DEAFNAVI_DATA_DIR').'/directory.sqlite');
 $db->exec('CREATE TABLE records (id TEXT,kind TEXT,publication TEXT,country_code TEXT,revision INTEGER,payload TEXT)');
 $q=$db->prepare('INSERT INTO records VALUES(?,?,?,?,?,?)');
 foreach([['public','cafe','public','AT'],['private','cafe','private','AT'],['pending','cafe','pending','AT'],['deleted','store','deleted','AT'],['domestic','cafe','public','JP'],['event','event','public','AT']] as $r)
 $q->execute([...$r,1,json_encode(['official_url'=>'https://example.org/cafe','verification_sources'=>['https://example.org/about'],'review_notes'=>'private-sentinel','submitter_email'=>'secret@example.invalid'])]);`],{env,encoding:'utf8'});
 assert.equal(setup.status,0,setup.stderr);
 const before=readFileSync(join(dir,'directory.sqlite'));
 const result=spawnSync('php',['server/overseas-cafe-review-export.php'],{env,encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);
 const out=JSON.parse(result.stdout);assert.equal(out.records.length,1);assert.equal(out.records[0].id,'public');
 assert.deepEqual(Object.keys(out.records[0]),['id','countryCode','revision','publicationHash','sourceUrls']);
 assert.match(out.records[0].publicationHash,/^[a-f0-9]{64}$/);assert.doesNotMatch(result.stdout,/private-sentinel|submitter|secret@/);
 assert.deepEqual(readFileSync(join(dir,'directory.sqlite')),before);
 assert.notEqual(spawnSync('php',['server/overseas-cafe-review-export.php','unexpected'],{env}).status,0);
 console.log('Overseas export: public overseas identity only; private fields excluded; SQLite unchanged');
}finally{rmSync(dir,{recursive:true,force:true});}
