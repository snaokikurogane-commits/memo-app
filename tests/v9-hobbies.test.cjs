const test=require('node:test');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const {join}=require('node:path');
const mod=()=>import(pathToFileURL(join(__dirname,'../v9-preview/card-images.js')).href);

test('new hobby tags and everyday aliases choose their own artwork',async()=>{
  const {resolveCardArtwork}=await mod();
  for(const [tag,id] of [['野球','baseball'],['筋トレ','gym'],['映画鑑賞','movie'],['晩酌','alcohol'],['愛犬','dog'],['ねこ','cat'],['ペット','pet'],['推し活','idol'],['カプセルトイ','gacha'],['カラオケ','karaoke']]){
    assert.deepEqual(resolveCardArtwork({card_image:{mode:'auto'},profile_tags:[tag]}),{kind:'illustration',id},tag);
  }
});

test('multiple new hobbies still use saved tag order and a manual image stays fixed',async()=>{
  const {resolveCardArtwork}=await mod();
  assert.deepEqual(resolveCardArtwork({card_image:{mode:'auto'},profile_tags:['同期','ジム','猫','野球']}),{kind:'illustration',id:'gym'});
  assert.deepEqual(resolveCardArtwork({card_image:{mode:'auto'},profile_tags:['ペット','犬']}),{kind:'illustration',id:'pet'});
  assert.deepEqual(resolveCardArtwork({card_image:{mode:'illustration',illustrationId:'cat'},profile_tags:['犬']}),{kind:'illustration',id:'cat'});
  assert.deepEqual(resolveCardArtwork({card_style:'sunset',profile_tags:['野球']}),{kind:'theme',id:'sunset'});
});

test('illustration search finds aliases and pet choices without changing automatic tag matching',async()=>{
  const {filterHobbyIllustrations,resolveCardArtwork}=await mod();
  assert.deepEqual(filterHobbyIllustrations('  筋トレ  ').map(x=>x.id),['gym']);
  assert.deepEqual(filterHobbyIllustrations('ＧＹＭ').map(x=>x.id),['gym']);
  assert.deepEqual(filterHobbyIllustrations('ペット').map(x=>x.id).sort(),['cat','dog','pet']);
  assert.deepEqual(filterHobbyIllustrations('ペット 犬').map(x=>x.id),['dog']);
  assert.deepEqual(filterHobbyIllustrations('対応していない趣味').map(x=>x.id),[]);
  assert.deepEqual(resolveCardArtwork({card_image:{mode:'auto'},profile_tags:['ペット']}),{kind:'illustration',id:'pet'});
});
