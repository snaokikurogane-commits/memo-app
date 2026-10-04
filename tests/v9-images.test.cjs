const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { join } = require('node:path');
const mod = () => import(pathToFileURL(join(__dirname, '../v9-preview/card-images.js')).href);
const path = 'per_test/12345678-1234-1234-1234-123456789abc.jpg';

test('old people keep their cover even when they already have hobby tags', async () => {
  const { resolveCardArtwork } = await mod();
  assert.deepEqual(resolveCardArtwork({card_style:'sunset',profile_tags:['ゴルフ']}), {kind:'theme',id:'sunset'});
});
test('automatic artwork uses the first recognized tag and supports aliases without guessing from notes', async () => {
  const { resolveCardArtwork } = await mod();
  assert.deepEqual(resolveCardArtwork({card_image:{mode:'auto'},profile_tags:['同期','ハイキング','読書']}), {kind:'illustration',id:'hiking'});
  assert.deepEqual(resolveCardArtwork({card_image:{mode:'auto'},profile_tags:['サッカーは苦手'],card_style:'linen',note:'ゴルフが好き'}), {kind:'theme',id:'linen'});
});
test('manual illustrations and photos stay fixed when tags change', async () => {
  const { resolveCardArtwork } = await mod();
  assert.deepEqual(resolveCardArtwork({card_image:{mode:'illustration',illustrationId:'reading'},profile_tags:['ゴルフ']}), {kind:'illustration',id:'reading'});
  assert.deepEqual(resolveCardArtwork({card_image:{mode:'photo',path,x:.2,y:.8,zoom:2},profile_tags:['ゴルフ']}), {kind:'photo',path,x:.2,y:.8,zoom:2});
});
test('malformed photo paths never become download paths and crop values are bounded', async () => {
  const { normalizeCardImage } = await mod();
  assert.equal(normalizeCardImage({mode:'photo',path:'../other/private.jpg'}).mode, 'theme');
  assert.deepEqual(normalizeCardImage({mode:'photo',path,x:-1,y:10,zoom:100}), {mode:'photo',path,x:0,y:1,zoom:3});
});
test('failed person write rolls back only the newly uploaded photo', async () => {
  const { persistCardImage } = await mod();
  const removed=[];
  await assert.rejects(persistCardImage({personId:'per_test',image:{mode:'photo'},photoBlob:new Blob(['photo'],{type:'image/jpeg'}),oldImage:{mode:'photo',path},
    store:{upload:async()=> 'per_test/87654321-1234-1234-1234-123456789abc.jpg',remove:async p=>removed.push(p)},
    save:async()=>{throw new Error('write failed');}}), /write failed/);
  assert.deepEqual(removed, ['per_test/87654321-1234-1234-1234-123456789abc.jpg']);
});
test('successful photo replacement never deletes an image still referenced by another save', async () => {
  const { persistCardImage } = await mod();
  const removed=[]; let saved=null;
  const result=await persistCardImage({personId:'per_test',image:{mode:'photo',x:.3},photoBlob:new Blob(['photo'],{type:'image/jpeg'}),oldImage:{mode:'photo',path},
    store:{upload:async()=> 'per_test/87654321-1234-1234-1234-123456789abc.jpg',remove:async p=>removed.push(p),removeIfUnused:async()=>false},
    save:async image=>{saved=image;}});
  assert.equal(saved.path, 'per_test/87654321-1234-1234-1234-123456789abc.jpg');
  assert.equal(result.x,.3); assert.deepEqual(removed,[]);
});
test('a failed upload does not write person data or delete its old photo', async () => {
  const { persistCardImage } = await mod();
  let writes=0, removals=0;
  await assert.rejects(persistCardImage({personId:'per_test',image:{mode:'photo'},photoBlob:new Blob(['photo']),oldImage:{mode:'photo',path},
    store:{upload:async()=>{throw new Error('upload failed');},remove:async()=>removals++},save:async()=>writes++}), /upload failed/);
  assert.equal(writes,0); assert.equal(removals,0);
});
test('large and unsupported files are rejected before image decoding', async () => {
  const { preparePhoto } = await mod();
  await assert.rejects(preparePhoto({size:21*1024*1024,type:'image/jpeg',name:'large.jpg'}), /20MB/);
  await assert.rejects(preparePhoto({size:200,type:'image/svg+xml',name:'picture.svg'}), /JPEG/);
});

test('a rejected fetch from a cleared session cannot evict a newer photo cache entry',async()=>{
  const {PhotoStore}=await mod();let failFirst;let reads=0;
  const store=new PhotoStore({storage:{from:()=>({download:()=>++reads===1?new Promise(resolve=>{failFirst=()=>resolve({error:new Error('old session')});}):Promise.resolve({data:new Blob(['jpeg']),error:null})})}});
  const old=store.source(path);store.clear();const fresh=store.source(path);
  await fresh;failFirst();await assert.rejects(old,/old session/);
  assert.equal(store.source(path),fresh);assert.equal(reads,2);store.clear();
});

test('backup photos are fetched once, while a missing photo stops the complete backup with the person name',async()=>{
  const {collectPhotoMedia}=await mod();let reads=0;
  const people=[{canonical_name:'架空A',card_image:{mode:'photo',path}},{canonical_name:'架空B',card_image:{mode:'photo',path}}];
  const jpeg=Buffer.from(require('node:fs').readFileSync(join(__dirname,'fixtures/tiny-jpeg.txt'),'utf8').trim(),'base64');
  const media=await collectPhotoMedia(people,async()=>{reads++;return new Blob([jpeg],{type:'image/jpeg'});});
  assert.equal(reads,1);assert.equal(media.length,1);
  await assert.rejects(collectPhotoMedia(people,async()=>{throw new Error('offline');}),/架空A.*再試行/);
});
