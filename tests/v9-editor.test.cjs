const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {readFileSync}=require('node:fs'),{join}=require('node:path'),{pathToFileURL}=require('node:url');
async function loadApp() {
  const images=await import(pathToFileURL(join(__dirname,'../v9-preview/card-images.js')).href);
  class Node {
    constructor(tag='div') {this.tagName=tag;this.children=[];this.listeners={};this.dataset={};this.style={};this.hidden=false;this.className='';this.value='';this.classList={add:(...names)=>{this.className+=' '+names.join(' ');},remove:(name)=>{this.className=this.className.split(' ').filter(item=>item!==name).join(' ');}};}
    append(...nodes) {nodes.forEach(node=>{node.parent=this;this.children.push(node);});}
    replaceChildren(...nodes) {this.children=[];this.append(...nodes);}
    remove() {if (this.parent) this.parent.children=this.parent.children.filter(item=>item!==this);}
    addEventListener(name,handler) {this.listeners[name]=handler;}
    setAttribute(name,value) {this[name]=value;}
    focus() {}
  }
  const elements=new Map();
  const context={...images,window:{},document:{createElement:tag=>new Node(tag),getElementById:id=>{if (!elements.has(id)) elements.set(id,new Node());return elements.get(id);}},console,Set,Map,Intl,Date,URL,crypto:globalThis.crypto};
  vm.createContext(context);
  const source=readFileSync(join(__dirname,'../v9-preview/app.js'),'utf8').replace(/^import[^\r\n]*\r?\n/gm,'').replace(/\r?\nboot\(\);\s*$/,'');
  vm.runInContext(source,context);
  return {call:expression=>vm.runInContext(expression,context),context,elements};
}
test('enter in illustration search never implicitly submits the person form',async()=>{
  const {call,elements}=await loadApp();
  call('bindIllustrationSearch()');
  const search=elements.get('illustration-search');
  let prevented=0;
  search.listeners.keydown({key:'Enter',preventDefault(){prevented++;}});
  assert.equal(prevented,1);
  search.listeners.keydown({key:'a',preventDefault(){prevented++;}});
  search.listeners.keydown({key:'Enter',isComposing:true,preventDefault(){prevented++;}});
  assert.equal(prevented,1);
});

test('choosing a fixed illustration after a photo previews the illustration instead of the retained draft',async()=>{
  const {call}=await loadApp();
  const art=call('createCardArtwork({card_image:{mode:"illustration",illustrationId:"reading"}},{draftUrl:"blob:draft-photo"})');
  assert.equal(art.children[0].src,'./assets/reading.webp');
});
test('photo errors can be retried more than once, with a fresh fetch',async()=>{
  const {call,context}=await loadApp();
  let downloads=0,invalidations=0;
  context.storeFixture={source:async()=>{downloads++;throw new Error('offline');},invalidate:()=>invalidations++};
  call('photoStore=storeFixture');
  const art=call('createCardArtwork({card_image:{mode:"photo",path:"per_test/12345678-1234-1234-1234-123456789abc.jpg"}},{interactive:true})');
  await new Promise(resolve=>setImmediate(resolve));
  art.children.find(node=>node.tagName==='button').listeners.click();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(downloads,2);assert.equal(invalidations,1);
  assert.equal(art.children.filter(node=>node.tagName==='button').length,1);
});

test('image settings remain available when an older optional appearance field is absent',async()=>{
  const {call,context}=await loadApp();
  context.clientFixture={from:()=>({select(columns){this.columns=columns;return this;},range(){return this;},then(resolve){return Promise.resolve(this.columns.includes('card_tone')?{data:null,error:{code:'42703',message:'column people.card_tone does not exist'}}:{data:[{person_id:'test',card_image:{mode:'auto'}}],error:null}).then(resolve);}})};
  call('state.client=clientFixture');const people=await call('selectPeople()');
  assert.equal(call('state.cardImageAvailable'),true);assert.equal(people[0].card_image.mode,'auto');
});

test('a stale photo edit rejects the save and preserves the newer server image',async()=>{
  const {call,context,elements}=await loadApp();
  const oldPath='per_test/12345678-1234-1234-1234-123456789abc.jpg';
  const freshPath='per_test/87654321-1234-1234-1234-123456789abc.jpg';
  let row={person_id:'per_test',card_image:{mode:'photo',path:freshPath,x:.5,y:.5,zoom:1}};
  const notices=[];context.noticeFixture=notices;
  context.clientFixture={from:()=>({filters:[],update(value){this.value=value;return this;},eq(key,value){this.filters.push(current=>key==='card_image'?JSON.stringify(current[key])===value:current[key]===value);return this;},select(){return this;},async maybeSingle(){if(!this.filters.every(filter=>filter(row)))return {data:null,error:null};row={...row,...this.value};return {data:{person_id:'per_test'},error:null};}})};
  context.storeFixture={remove:async()=>assert.fail('must not remove a saved image'),removeIfUnused:async()=>assert.fail('must not clean up after rejected edit')};
  call(`state.role='owner';state.editorMode='edit';state.editorPersonId='per_test';state.client=clientFixture;photoStore=storeFixture;state.editorOriginalImage={mode:'photo',path:'${oldPath}',x:.5,y:.5,zoom:1};state.editorCardImage=state.editorOriginalImage;commitPersonTagInput=()=>true;toast=text=>noticeFixture.push(text)`);
  call('byId("person-name").value="架空の人物";byId("person-fiscal-year").value=""');
  await call('savePerson({preventDefault(){}})');
  assert.equal(row.card_image.path,freshPath);assert.match(notices[0],/別の画面で画像/);
  assert.equal(elements.get('person-save').disabled,false);
});
