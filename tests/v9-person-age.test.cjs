const test=require('node:test'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url'),{join}=require('node:path');
const mod=()=>import(pathToFileURL(join(__dirname,'../v9-preview/person-age.js')).href);
test('full birthday gives exact age before and on the birthday',async()=>{
  const {personAgeValues,personAgeSummary}=await mod();
  const info=personAgeValues({birthday:'1991/10/7',age:''},null,new Date('2026-10-06T12:00:00'));
  assert.equal(info.birth_date,'1991-10-07');
  assert.equal(personAgeSummary(info,new Date('2026-10-06T12:00:00')).ageLabel,'34歳');
  assert.equal(personAgeSummary(info,new Date('2026-10-07T12:00:00')).ageLabel,'35歳');
});
test('a month and day without a year does not invent an age',async()=>{
  const {personAgeValues,personAgeSummary}=await mod();
  const info=personAgeValues({birthday:'５月１２日',age:''});
  assert.equal(info.birthday,'05-12');
  assert.equal(personAgeSummary(info).birthdayLabel,'誕生日 5月12日');
  assert.equal(personAgeSummary(info).ageLabel,'');
});
test('age-only confirmation is retained until changed and advances as an estimate',async()=>{
  const {personAgeValues,personAgeSummary}=await mod();
  const info=personAgeValues({birthday:'',age:'35'},null,new Date('2026-10-06T12:00:00'));
  assert.equal(info.observed_on,'2026-10-06');
  assert.equal(personAgeSummary(info,new Date('2027-10-06T12:00:00')).ageLabel,'推定36歳');
  const kept=personAgeValues({birthday:'',age:'36'},info,new Date('2027-10-06T12:00:00'));
  assert.deepEqual(kept,info);
});
test('known month and day makes estimated age advance at the next birthday',async()=>{
  const {personAgeValues,personAgeSummary}=await mod();
  const info=personAgeValues({birthday:'10/7',age:'35'},null,new Date('2026-10-06T12:00:00'));
  assert.equal(personAgeSummary(info,new Date('2026-10-06T12:00:00')).ageLabel,'推定35歳');
  assert.equal(personAgeSummary(info,new Date('2026-10-07T12:00:00')).ageLabel,'推定36歳');
});
test('invalid dates, future birth dates, and fractional ages are not saved',async()=>{
  const {personAgeValues}=await mod();const now=new Date('2026-10-06T12:00:00');
  for(const birthday of ['2025/2/29','2/30','13/1','2027/1/1']) assert.throws(()=>personAgeValues({birthday,age:''},null,now),/誕生日/);
  for(const age of ['-1','35.5','131','abc']) assert.throws(()=>personAgeValues({birthday:'',age},null,now),/年齢/);
});
test('clearing all optional inputs clears age information; unknown legacy data stays blank',async()=>{
  const {personAgeValues,personAgeSummary}=await mod();
  assert.equal(personAgeValues({birthday:'',age:''},{birth_date:'1991-10-07'}),null);
  assert.equal(personAgeSummary(null).ageLabel,'');
  assert.equal(personAgeSummary({observed_age:35}).ageLabel,'');
});
test('leap birthdays use March 1 in a non-leap year',async()=>{
  const {personAgeSummary}=await mod();
  assert.equal(personAgeSummary({birth_date:'2000-02-29'},new Date('2026-02-28T12:00:00')).ageLabel,'25歳');
  assert.equal(personAgeSummary({birth_date:'2000-02-29'},new Date('2026-03-01T12:00:00')).ageLabel,'26歳');
});
