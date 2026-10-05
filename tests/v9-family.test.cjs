const test=require('node:test'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url'),{join}=require('node:path');
const mod=()=>import(pathToFileURL(join(__dirname,'../v9-preview/family.js')).href);

test('presence without a count, changing a count, and clearing it preserve unrelated profile tags',async()=>{
  const {childrenProfileTags,childrenInfo}=await mod();
  assert.deepEqual(childrenProfileTags(['ゴルフ'],{hasChildren:true}),['ゴルフ','子どもあり']);
  const changed=childrenProfileTags(['ゴルフ','子供あり','子ども3人'],{hasChildren:true,count:'２'});
  assert.deepEqual(changed,['ゴルフ','子ども2人']);
  assert.equal(childrenInfo({profile_tags:changed}).label,'子ども2人');
  assert.deepEqual(childrenProfileTags(changed,{hasChildren:false}),['ゴルフ']);
  assert.throws(()=>childrenProfileTags(Array.from({length:30},(_,i)=>`タグ${i}`),{hasChildren:true}),/30件/);
  assert.throws(()=>childrenProfileTags([],{hasChildren:true,count:'-1'}),/人数/);
});

test('known birthdays and age-only observations progress at their own anniversary',async()=>{
  const {currentChildAge}=await mod();
  const estimated={observed_age:5,observed_on:'2026-10-06'};
  assert.equal(currentChildAge(estimated,new Date('2027-10-05T12:00:00')),5);
  assert.equal(currentChildAge(estimated,new Date('2027-10-06T12:00:00')),6);
  assert.equal(currentChildAge({birth_date:'2018-05-12'},new Date('2026-10-06T12:00:00')),8);
});

test('the stored illustration choices are all supported by the latest database constraint',async()=>{
  const {hobbyIllustrations}=await import(pathToFileURL(join(__dirname,'../v9-preview/card-images.js')).href);
  const sql=require('node:fs').readFileSync(join(__dirname,'../v9-preview/20261006_010_parenting_illustration.sql'),'utf8');
  const allowed=new Set(Array.from(sql.match(/when 'illustration' then[\s\S]*?when 'photo'/)[0].matchAll(/'([a-z]+)'/g),match=>match[1]));
  for (const item of hobbyIllustrations) assert.ok(allowed.has(item.id),`${item.id} would fail a real database save`);
});
