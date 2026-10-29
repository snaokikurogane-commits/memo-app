const test=require('node:test'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url'),{join}=require('node:path'),{existsSync}=require('node:fs');
const load=name=>import(pathToFileURL(join(__dirname,'../v9-preview/'+name+'.js')).href);
test('initials skip brackets and punctuation, normalize full-width Latin, and keep unnamed people neutral',async()=>{
  const {personInitial}=await load('person-presentation');
  for(const [name,want] of [['（丸山みゆき）','丸'],['( 高橋 葵 )','高'],[' みゆき','み'],['「ａｌｅｘ」','A'],['…佐藤','佐'],['（） ',null],[null,null]])assert.equal(personInitial(name),want);
});
test('interest icons follow tag order, recognize aliases and deduplicate the same interest',async()=>{
  const {interestsForTags,interestIconForTag}=await load('interest-icons');
  assert.deepEqual(interestsForTags(['同期',' 読書 ','本','ハイキング','旅行','ｇｏｌｆ']).map(i=>i.id),['reading','hiking','travel','golf']);
  assert.equal(interestIconForTag('筋トレ').id,'gym');assert.equal(interestIconForTag('ジム').id,'gym');
  assert.equal(interestIconForTag('ハローワーク'),null);assert.deepEqual(interestsForTags(null),[]);
  for(const icon of interestsForTags(['カラオケ','うさぎ','温泉','文房具','猫']))assert.ok(existsSync(join(__dirname,'../v9-preview',icon.src)),icon.src);
});
test('tag search adds the supplied interests while keeping family presence distinct from a parenting interest',async()=>{
  const {tagChoices}=await load('tag-library');
  assert.ok(tagChoices([],[],[],'文房具','hobby').some(i=>i.label==='文房具'));
  assert.equal(tagChoices([],[],['ジム'],'筋トレ','hobby').length,0);
  assert.ok(tagChoices([],[],['子育て'],'','family').some(i=>i.label==='子どもあり'));
});
