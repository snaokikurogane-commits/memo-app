const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { join } = require('node:path');
const jpeg=require('node:fs').readFileSync(join(__dirname,'fixtures/tiny-jpeg.txt'),'utf8').trim();
const mod=()=>import(pathToFileURL(join(__dirname,'../v9-preview/backup-crypto.js')).href);
const path='per_test/12345678-1234-1234-1234-123456789abc.jpg';
function payload(version=1) {
  const tables=Object.fromEntries(['people','assignments','conversations','family_members','events','follow_up_items','topic_preferences'].map(t=>[t,[]]));
  if(version===2) tables.people=[{person_id:'per_test',canonical_name:'架空の人物',card_image:{mode:'photo',path,x:.5,y:.5,zoom:1}}];
  return {format:'people-notebook-data',version,tables,counts:Object.fromEntries(Object.entries(tables).map(([t,rows])=>[t,rows.length])),...(version===2?{media:[{path,mime:'image/jpeg',base64:jpeg}]}:{})};
}
test('the new reader still decrypts original v1 backups',async()=>{
  const {encryptBackup,decryptBackup}=await mod();
  const original=payload(); assert.deepEqual(await decryptBackup(await encryptBackup(original,'test-password-2026'),'test-password-2026'),original);
});
test('v2 encryption round trip retains photo bytes and crop settings',async()=>{
  const {encryptBackup,decryptBackup,validateBackupPayload}=await mod();
  const original=payload(2);
  original.tables.people[0].profile_tags=['読書','子ども2人'];
  original.tables.people[0].age_info={birthday:'05-12',observed_age:35,observed_on:'2026-10-06'};
  original.tables.family_members=[{family_member_id:'child_test',person_id:'per_test',relationship:'child',display_name:'',birth_date:null,observed_age:5,observed_on:'2026-10-06'}];
  original.counts.family_members=1;
  assert.equal(validateBackupPayload(original),true);
  const encrypted=await encryptBackup(original,'test-password-2026');
  assert.equal(JSON.stringify(encrypted).includes('架空'),false);
  assert.deepEqual(await decryptBackup(encrypted,'test-password-2026'),original);
});
test('photo references missing from the backup cannot be called a complete backup',async()=>{
  const {validateBackupPayload}=await mod(); const p=payload(2);p.media=[];
  assert.throws(()=>validateBackupPayload(p),/写真/);
});
test('invalid photo data and duplicate media paths are rejected',async()=>{
  const {validateBackupPayload}=await mod();
  const p=payload(2);p.media[0].base64='not base64!';assert.throws(()=>validateBackupPayload(p),/写真/);
  const q=payload(2);q.media.push(q.media[0]);assert.throws(()=>validateBackupPayload(q),/写真/);
  const r=payload(2);r.media[0].base64='/9j/2Q==';assert.throws(()=>validateBackupPayload(r),/写真/);
});
test('wrong passwords and tampered encrypted payloads fail without exposing any data',async()=>{
  const {encryptBackup,decryptBackup}=await mod(); const e=await encryptBackup(payload(),'test-password-2026');
  await assert.rejects(decryptBackup(e,'wrong-password-2026'),/パスワード/);
  e.ciphertext=(e.ciphertext[0]==='A'?'B':'A')+e.ciphertext.slice(1);
  await assert.rejects(decryptBackup(e,'test-password-2026'),/パスワード/);
});
