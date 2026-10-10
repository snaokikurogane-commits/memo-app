const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {readFileSync}=require('node:fs'),{join}=require('node:path'),{pathToFileURL}=require('node:url');
async function loadApp(sessionStorage) {
  const images=await import(pathToFileURL(join(__dirname,'../v9-preview/card-images.js')).href);
  const family=await import(pathToFileURL(join(__dirname,'../v9-preview/family.js')).href);
  const personAge=await import(pathToFileURL(join(__dirname,'../v9-preview/person-age.js')).href);
  const tagLibrary=await import(pathToFileURL(join(__dirname,'../v9-preview/tag-library.js')).href);
  const drafts=await import(pathToFileURL(join(__dirname,'../v9-preview/conversation-drafts.js')).href);
  class Node {
    constructor(tag='div') {this.tagName=tag;this.children=[];this.listeners={};this.dataset={};this.style={};this.hidden=false;this.className='';this.value='';this.classList={add:(...names)=>{this.className+=' '+names.join(' ');},remove:(name)=>{this.className=this.className.split(' ').filter(item=>item!==name).join(' ');}};}
    get childNodes() {return this.children;}
    append(...nodes) {nodes.forEach(node=>{node.parent=this;this.children.push(node);});}
    replaceChildren(...nodes) {this.children=[];this.append(...nodes);}
    remove() {if (this.parent) this.parent.children=this.parent.children.filter(item=>item!==this);}
    addEventListener(name,handler) {this.listeners[name]=handler;}
    setAttribute(name,value) {this[name]=value;}
    focus() {}
    reset() {for (const id of ['conversation-note','conversation-recap','next-topics','follow-up-at']) if(elements.has(id)) elements.get(id).value='';}
  }
  const elements=new Map();
  const context={...images,...family,...personAge,...tagLibrary,...drafts,window:{sessionStorage},document:{createElement:tag=>new Node(tag),getElementById:id=>{if (!elements.has(id)) elements.set(id,new Node());return elements.get(id);}},console,Set,Map,Intl,Date,URL,crypto:globalThis.crypto};
  vm.createContext(context);
  const source=readFileSync(join(__dirname,'../v9-preview/app.js'),'utf8').replace(/^import[^\r\n]*\r?\n/gm,'').replace(/\r?\nboot\(\);\s*$/,'');
  vm.runInContext(source,context);
  return {call:expression=>vm.runInContext(expression,context),context,elements};
}

test('retrying after question failure or a lost save response never duplicates the conversation',async()=>{
  for (const lostResponse of [false,'conversation','question']) {
    const {call,context}=await loadApp();
    const tables={conversations:[],follow_up_items:[]};let fail=true;
    context.clientFixture={from:table=>({operation:'read',filters:[],insert(values){this.operation='insert';this.values=values;return this;},upsert(values,options){this.operation='upsert';this.values=values;this.options=options;return this;},select(){return this;},eq(key,value){this.filters.push(row=>row[key]===value);return this;},in(key,values){this.filters.push(row=>values.includes(row[key]));return this;},single(){this.one=true;return this;},async then(resolve,reject){try {
      const key=table==='conversations'?'conversation_id':'follow_up_id';
      if(fail && table==='follow_up_items' && !lostResponse) {fail=false;return resolve({data:null,error:new Error('質問の保存失敗')});}
      let rows=tables[table].filter(row=>this.filters.every(f=>f(row)));
      if(this.operation!=='read') {rows=[];for(const value of (Array.isArray(this.values)?this.values:[this.values])) {const row={...value,[key]:value[key]||crypto.randomUUID()};const old=tables[table].find(item=>item[key]===row[key]);if(!old){tables[table].push(row);rows.push(row);}else if(!this.options?.ignoreDuplicates) Object.assign(old,row);}}
      if(fail && table===(lostResponse==='conversation'?'conversations':'follow_up_items') && lostResponse && this.operation!=='read') {fail=false;return resolve({data:null,error:new Error('応答だけ失われた')});}
      resolve({data:this.one?rows[0]:rows,error:null});
    }catch(error){reject(error);}}})};
    context.notices=[];context.setTimeout=()=>{};
    call('state.role="owner";state.session={user:{id:"test-user"}};state.client=clientFixture;state.person={person:{person_id:"test-person"},conversations:[],followUps:[]};byId("conversation-note").value="週末はゴルフ";byId("conversation-recap").value="";byId("next-topics").value="次の大会は？";byId("follow-up-at").value="";renderDetail=()=>{};loadDirectory=async()=>{};toast=text=>notices.push(text)');
    await call('saveConversation({preventDefault(){}})');
    await call('saveConversation({preventDefault(){}})');
    assert.equal(tables.conversations.length,1,lostResponse?'an uncertain response must reuse the same record ID':'a saved memo must not be inserted again');
    assert.equal(tables.follow_up_items.length,1);
    assert.equal(tables.conversations[0].note,'週末はゴルフ');
  }
});

test('closing and reopening a draft restores its person-specific note and questions',async()=>{
  const {call,context}=await loadApp();context.setTimeout=()=>{};
  call('state.session={user:{id:"test-user"}};state.person={person:{person_id:"person-a"}};byId("composer").hidden=false;byId("conversation-note").value="まだ保存していない話";byId("next-topics").value="旅行はどうだった？";byId("conversation-recap").value="";byId("follow-up-at").value="";closeComposer();state.person={person:{person_id:"person-b"}};openComposer()');
  assert.equal(call('byId("conversation-note").value'),'');
  call('closeComposer();state.person={person:{person_id:"person-a"}};openComposer()');
  assert.equal(call('byId("conversation-note").value'),'まだ保存していない話');
  assert.equal(call('byId("next-topics").value'),'旅行はどうだった？');
});

test('an in-flight save survives closing and reopening, clears its draft, and cannot double-submit',async()=>{
  const {call,context}=await loadApp();let release,writes=0;const committed=new Promise(resolve=>release=resolve);
  const row={conversation_id:'result',person_id:'person-a',note:'保存中の話'};
  context.clientFixture={from:()=>({select(){return this;},eq(){return this;},single(){return this;},upsert(value){writes++;row.conversation_id=value.conversation_id;this.writing=true;return this;},then(resolve,reject){return (this.writing?committed:Promise.resolve()).then(()=>({data:this.writing?null:row,error:null})).then(resolve,reject);}})};
  context.setTimeout=()=>{};context.notices=[];
  call('state.role="owner";state.session={user:{id:"test-user"}};state.client=clientFixture;state.person={person:{person_id:"person-a"},conversations:[],followUps:[]};byId("composer").hidden=false;byId("conversation-note").value="保存中の話";toast=text=>notices.push(text);renderDetail=()=>{};loadDirectory=async()=>{throw new Error("一覧だけ失敗")}');
  const first=call('saveConversation({preventDefault(){}})');
  await call('saveConversation({preventDefault(){}})');
  call('closeComposer();openComposer()');
  release();await first;
  assert.equal(writes,1);assert.equal(call('byId("composer").hidden'),true);
  call('openComposer()');assert.equal(call('byId("conversation-note").value'),'');
  assert.ok(context.notices.some(text=>text.includes('保存は完了しました')));
});

test('editing drafts survive reload without mixing with new notes and logout clears both',async()=>{
  const values=new Map(),disk={get length(){return values.size;},key:i=>[...values.keys()][i],getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
  const first=await loadApp(disk);first.context.setTimeout=()=>{};
  first.call('state.role="owner";state.session={user:{id:"user-a"}};state.person={person:{person_id:"person-a"}};byId("composer").hidden=true;openComposer();byId("conversation-note").value="新規の下書き";closeComposer();openConversationEditor({conversation_id:"edit-a",note:"元の会話",tags:["読書"]});byId("conversation-note").value="編集途中";closeComposer()');
  const reload=await loadApp(disk);reload.context.setTimeout=()=>{};
  reload.call('state.role="owner";state.session={user:{id:"user-a"}};state.person={person:{person_id:"person-a"}};byId("composer").hidden=true;openComposer()');
  assert.equal(reload.call('byId("conversation-note").value'),'新規の下書き');
  reload.call('openConversationEditor({conversation_id:"edit-a",note:"元の会話",tags:["読書"]})');
  assert.equal(reload.call('byId("conversation-note").value'),'編集途中');
  reload.call('clearConversationAccount()');assert.equal(values.size,0);
  assert.equal(reload.call('byId("conversation-note").value'),'');
});

test('a delayed save from a previous login cannot erase a fresh draft after logging back in',async()=>{
  const {call,context}=await loadApp();let release;const pending=new Promise(resolve=>release=resolve);let row;
  context.clientFixture={from:()=>({select(){return this;},eq(){return this;},single(){return this;},upsert(value){row={...value};this.writing=true;return this;},then(resolve,reject){return (this.writing?pending:Promise.resolve()).then(()=>({data:this.writing?null:row,error:null})).then(resolve,reject);}})};
  context.setTimeout=()=>{};
  call('state.role="owner";state.session={user:{id:"user-a"}};state.client=clientFixture;state.person={person:{person_id:"person-a"},conversations:[],followUps:[]};byId("composer").hidden=false;byId("conversation-note").value="以前のログインで保存";renderDetail=()=>{};loadDirectory=async()=>{};toast=()=>{}');
  const saving=call('saveConversation({preventDefault(){}})');
  call('clearConversationAccount();state.session={user:{id:"user-a"}};state.person={person:{person_id:"person-a"},conversations:[],followUps:[]};openComposer();byId("conversation-note").value="再ログイン後の別の下書き";captureConversationDraft()');
  release();await saving;
  assert.equal(call('conversationDrafts.read(conversationScope())?.note'),'再ログイン後の別の下書き');
  call('closeComposer();openComposer()');
  assert.equal(call('byId("conversation-note").value'),'再ログイン後の別の下書き');
});

test('an oversized question is rejected before freezing a save job so it can be corrected',async()=>{
  const {call,context}=await loadApp();context.notices=[];
  call('state.role="owner";state.session={user:{id:"user-a"}};state.person={person:{person_id:"person-a"}};byId("composer").hidden=false;byId("next-topics").value="長".repeat(1001);toast=text=>notices.push(text)');
  await call('saveConversation({preventDefault(){}})');
  assert.equal(call('state.conversationJob'),null);
  assert.ok(context.notices.some(text=>text.includes('1000文字')));
});

test('question-only saves create no empty conversation and edits update the selected record',async()=>{
  for(const edit of [false,true]) {
    const {call,context}=await loadApp();const rows={conversations:[{conversation_id:'existing',person_id:'person-a',note:'元の内容'}],follow_up_items:[]};
    context.clientFixture={from:table=>({filters:[],select(){return this;},eq(key,value){this.filters.push(row=>row[key]===value);return this;},in(key,values){this.filters.push(row=>values.includes(row[key]));return this;},single(){this.one=true;return this;},update(value){this.changes=value;return this;},upsert(value){this.values=value;return this;},then(resolve){if(this.values) for(const row of Array.isArray(this.values)?this.values:[this.values]) rows[table].push({...row});const found=rows[table].filter(row=>this.filters.every(f=>f(row)));if(this.changes)found.forEach(row=>Object.assign(row,this.changes));return Promise.resolve({data:this.one?found[0]:found,error:null}).then(resolve);}})};
    context.setTimeout=()=>{};
    call('state.role="owner";state.session={user:{id:"user-a"}};state.client=clientFixture;state.person={person:{person_id:"person-a"},conversations:[],followUps:[]};byId("composer").hidden=false;renderDetail=()=>{};loadDirectory=async()=>{};toast=()=>{}');
    if(edit) call('state.editingConversationId="existing";byId("conversation-note").value="編集した内容"');
    else call('byId("next-topics").value="おすすめは？"');
    await call('saveConversation({preventDefault(){}})');
    assert.equal(rows.conversations.length,1);assert.equal(rows.follow_up_items.length,edit?0:1);
    assert.equal(rows.conversations[0].note,edit?'編集した内容':'元の内容');
    assert.equal(call('byId("composer").hidden'),true);
  }
});
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

test('follow-up editing is available from the overflow menu and preserves the selected question and date',async()=>{
  const {call}=await loadApp();
  call('state.role="owner"');
  const card=call('followUpCard({follow_up_id:"question-1",body:"旅行はどうでしたか？",due_at:"2026-10-12",status:"open"})');
  const all=node=>[node,...node.children.flatMap(all)];
  const menu=all(card).find(node=>node.tagName==='details');
  assert.ok(menu,'question actions are grouped in an overflow menu');
  const edit=all(menu).find(node=>node.tagName==='button' && node.textContent==='編集');
  edit.listeners.click();
  const inputs=all(card).filter(node=>node.tagName==='input');
  assert.equal(inputs[0].value,'旅行はどうでしたか？');
  assert.equal(inputs[1].value,'2026-10-12');
});

test('escape closes the follow-up action menu and returns focus to its trigger',async()=>{
  const {call}=await loadApp();
  call('state.role="owner"');
  const card=call('followUpCard({follow_up_id:"question-1",body:"おすすめの本は？",status:"open"})');
  const all=node=>[node,...node.children.flatMap(all)];
  const menu=all(card).find(node=>node.tagName==='details');
  assert.ok(menu,'question actions are grouped in an overflow menu');
  const summary=menu.children.find(node=>node.tagName==='summary');
  let focused=0,prevented=0;summary.focus=()=>focused++;menu.open=true;
  menu.listeners.keydown({key:'Escape',preventDefault(){prevented++;}});
  assert.equal(menu.open,false);assert.equal(focused,1);assert.equal(prevented,1);
});

test('canceling question deletion keeps focus on the visible action trigger',async()=>{
  const {call,context}=await loadApp();
  call('state.role="owner"');
  context.window.confirm=()=>false;
  const card=call('followUpCard({follow_up_id:"question-1",body:"おすすめの本は？",status:"open"})');
  const all=node=>[node,...node.children.flatMap(all)];
  const menu=all(card).find(node=>node.tagName==='details');
  const summary=menu.children.find(node=>node.tagName==='summary');
  let focused=0;summary.focus=()=>focused++;menu.open=true;
  all(menu).find(node=>node.tagName==='button' && node.textContent==='削除').listeners.click();
  assert.equal(menu.open,false);assert.equal(focused,1);
  assert.ok(all(card).some(node=>node.textContent==='おすすめの本は？'));
});

test('choosing a fixed illustration after a photo previews the illustration instead of the retained draft',async()=>{
  const {call}=await loadApp();
  const art=call('createCardArtwork({card_image:{mode:"illustration",illustrationId:"reading"}},{draftUrl:"blob:draft-photo"})');
  assert.equal(art.children[0].src,'./assets/reading.webp?v=20261005-simple-a');
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
  context.clientFixture={from:()=>({filters:[],update(value){this.value=value;return this;},eq(key,value){this.filters.push(current=>key==='card_image'?JSON.stringify(current[key])===value:current[key]===value);return this;},is(key,value){this.filters.push(current=>(current[key]??null)===value);return this;},select(){return this;},async maybeSingle(){if(!this.filters.every(filter=>filter(row)))return {data:null,error:null};row={...row,...this.value};return {data:{person_id:'per_test'},error:null};}})};
  context.storeFixture={remove:async()=>assert.fail('must not remove a saved image'),removeIfUnused:async()=>assert.fail('must not clean up after rejected edit')};
  call(`state.role='owner';state.editorMode='edit';state.editorPersonId='per_test';state.client=clientFixture;photoStore=storeFixture;state.editorOriginalImage={mode:'photo',path:'${oldPath}',x:.5,y:.5,zoom:1};state.editorCardImage=state.editorOriginalImage;commitPersonTagInput=()=>true;toast=text=>noticeFixture.push(text)`);
  call('byId("person-name").value="架空の人物";byId("person-fiscal-year").value=""');
  await call('savePerson({preventDefault(){}})');
  assert.equal(row.card_image.path,freshPath);assert.match(notices[0],/別の画面で人物情報/);
  assert.equal(elements.get('person-save').disabled,false);
});

test('a newborn age can be saved without a nickname or manually entering the confirmation date',async()=>{
  const {call}=await loadApp();
  const value=call('familyMemberChanges({age:"0"})');
  assert.ok(value,'age alone is enough to record a child');
  assert.equal(value.observed_age,0);
  assert.equal(value.display_name,'');
  assert.equal(value.observed_on,call('localDateKey()'));
});

test('editing an adult family member does not label their birthday as a child birthday',async()=>{
  const {call}=await loadApp();
  const form=call('familyMemberEditor({familyMembers:[]},{family_member_id:"spouse",relationship:"spouse",display_name:"配偶者",observed_age:35},()=>{})');
  const all=node=>[node,...node.children.flatMap(all)];
  const labels=all(form).filter(node=>node.tagName==='label').map(node=>node.textContent);
  assert.ok(!labels.some(label=>label.includes('子ども')));
  assert.ok(labels.some(label=>label.includes('家族の年齢')));
});

test('children presence can be unchecked even with saved ages, and clears its count draft',async()=>{
  const {call}=await loadApp();
  const form=call('childrenSummaryForm({person:{profile_tags:["子ども2人"]},familyMembers:[{relationship:"child",observed_age:5}]})');
  const all=node=>[node,...node.children.flatMap(all)];
  const presence=all(form).find(node=>node.id==='children-present');
  const count=all(form).find(node=>node.id==='children-count');
  assert.ok(!presence.disabled,'saved child ages must not lock the presence checkbox');
  presence.checked=false;
  presence.listeners.change();
  assert.equal(count.value,'');
  assert.equal(count.disabled,true);
  presence.checked=true;presence.listeners.change();
  assert.equal(count.disabled,false);
});

test('saving cleared children keeps age records but removes the list badge and AI family entry',async()=>{
  const {call,context}=await loadApp();
  let row={person_id:'test',profile_tags:['読書','子ども2人'],children_present:null};
  context.clientFixture={from:()=>({filters:[],select(){return this;},eq(key,value){this.filters.push(current=>key==='profile_tags'?JSON.stringify(current[key])===value:current[key]===value);return this;},is(key,value){this.filters.push(current=>(current[key]??null)===value);return this;},update(value){this.value=value;return this;},async single(){return {data:structuredClone(row),error:null};},async maybeSingle(){if(!this.filters.every(f=>f(row)))return {data:null,error:null};Object.assign(row,this.value);return {data:structuredClone(row),error:null};}})};
  context.detailFixture={person:{...row,hasKnownChildren:true},familyMembers:[{relationship:'child',observed_age:5,display_name:'保留する子ども'}],assignments:[]};
  call('state.client=clientFixture');
  await call('persistChildrenInfo(detailFixture,{hasChildren:false,count:"2"})');
  assert.equal(row.children_present,false);
  assert.deepEqual(row.profile_tags,['読書']);
  assert.equal(context.detailFixture.familyMembers.length,1,'clearing must be reversible without deleting saved ages');
  const card=call('personCard({...detailFixture.person,canonical_name:"架空の人物",card_image:{mode:"illustration",illustrationId:"reading"}})');
  const all=node=>[node,...node.children.flatMap(all)];
  assert.ok(!all(card).some(node=>node.className==='children-badge'));
  assert.ok(!call('buildAiConsultation(detailFixture,{includePersonal:true})').includes('保留する子ども'));
  await call('persistChildrenInfo(detailFixture,{hasChildren:true,count:"2"})');
  assert.equal(row.children_present,true);
  assert.deepEqual(row.profile_tags,['読書','子ども2人']);
});

test('person editor can re-add a child tag after clearing presence, and rejects concurrent presence changes',async()=>{
  const {call,context}=await loadApp();
  let row={person_id:'test',profile_tags:['読書'],children_present:false};
  const notices=[];context.notices=notices;
  context.clientFixture={from:()=>({filters:[],update(value){this.value=value;return this;},eq(key,value){this.filters.push(current=>key==='profile_tags'?JSON.stringify(current[key])===value:current[key]===value);return this;},is(key,value){this.filters.push(current=>(current[key]??null)===value);return this;},select(){return this;},async maybeSingle(){if(!this.filters.every(f=>f(row)))return {data:null,error:null};Object.assign(row,this.value);return {data:{person_id:'test'},error:null};}})};
  call('state.client=clientFixture;state.role="owner";state.editorMode="edit";state.editorPersonId="test";state.cardImageAvailable=false;state.personAgeAvailable=false;state.editorTags=["読書","子どもあり"];state.editorOriginalTags=["読書"];state.editorOriginalChildren=false;byId("person-name").value="架空の人物";byId("person-fiscal-year").value="";commitPersonTagInput=()=>true;closePersonEditor=()=>{};loadDirectory=async()=>{};openPerson=async()=>{};toast=text=>notices.push(text)');
  await call('savePerson({preventDefault(){}})');
  assert.equal(row.children_present,true);
  assert.deepEqual(Array.from(row.profile_tags),['読書','子どもあり']);
  row.children_present=false;
  await call('savePerson({preventDefault(){}})');
  assert.equal(row.children_present,false,'a newer cleared presence must not be overwritten');
  assert.ok(notices.some(text=>text.includes('別の画面')));
});

test('children remain visible in the list when their tag follows more than two hobby tags',async()=>{
  const {call}=await loadApp();
  const card=call('personCard({person_id:"person-test",canonical_name:"架空の人物",profile_tags:["読書","ゴルフ","子ども2人"],card_image:{mode:"illustration",illustrationId:"reading"},assignment:null})');
  const all=node=>[node,...node.children.flatMap(all)];
  assert.ok(all(card).some(node=>node.textContent==='子ども2人'),'family information must not be hidden behind +N');
});

test('existing child records make children visible even without a manually added profile tag',async()=>{
  const {call}=await loadApp();
  const card=call('personCard({person_id:"person-test",canonical_name:"架空の人物",profile_tags:["読書"],hasKnownChildren:true,card_image:{mode:"illustration",illustrationId:"reading"},assignment:null})');
  const all=node=>[node,...node.children.flatMap(all)];
  assert.ok(all(card).some(node=>node.textContent==='子どもあり'));
});

test('tag selection finds a preset and an existing custom tag instead of offering only eight hard-coded labels',async()=>{
  const {call}=await loadApp();
  call('state.role="owner";state.editorTags=[];state.directory=[{profile_tags:["地元の合唱団"]}];byId("person-tag-input").value="子ども";renderPersonTagEditor()');
  const names=call('byId("person-tag-suggestions").children.filter(node=>node.tagName==="button").map(node=>node.textContent)');
  assert.ok(Array.from(names).includes('子どもあり'));
  call('byId("person-tag-input").value="合唱";renderPersonTagEditor()');
  const custom=call('byId("person-tag-suggestions").children.filter(node=>node.tagName==="button").map(node=>node.textContent)');
  assert.ok(Array.from(custom).includes('地元の合唱団'));
});

test('editing only the nickname preserves the original age confirmation anchor',async()=>{
  const {call}=await loadApp();
  const member={observed_age:5,observed_on:'2023-01-10',birth_date:null};
  const result=call(`familyMemberChanges({name:'新しい呼び名',age:String(currentChildAge(${JSON.stringify(member)}))},${JSON.stringify(member)})`);
  assert.equal(result.observed_age,5);
  assert.equal(result.observed_on,'2023-01-10');
});

test('saving just a child count preserves freshly added unrelated tags and rejects a concurrent change',async()=>{
  const {call,context}=await loadApp();
  let row={person_id:'test',profile_tags:['読書','新しく追加されたタグ','子どもあり']};
  let conflict=false;
  context.clientFixture={from:()=>({filters:[],select(){return this;},eq(key,value){this.filters.push(current=>key==='profile_tags'?JSON.stringify(current[key])===value:current[key]===value);return this;},is(key,value){this.filters.push(current=>(current[key]??null)===value);return this;},update(value){this.value=value;return this;},async single(){return {data:structuredClone(row),error:null};},async maybeSingle(){if(conflict || !this.filters.every(f=>f(row)))return {data:null,error:null};Object.assign(row,this.value);return {data:structuredClone(row),error:null};}})};
  call('state.client=clientFixture');
  const detail={person:{person_id:'test',profile_tags:['読書']}};context.detailFixture=detail;
  await call('persistChildrenInfo(detailFixture,{hasChildren:true,count:"2"})');
  assert.deepEqual(row.profile_tags,['読書','新しく追加されたタグ','子ども2人']);
  conflict=true;
  await assert.rejects(call('persistChildrenInfo(detailFixture,{hasChildren:true,count:"3"})'),/別の画面/);
  assert.equal(detail.person.profile_tags.at(-1),'子ども2人');
});

test('conversation editing keeps saved tags and puts its existing content in the main memo',async()=>{
  const {call,context}=await loadApp();context.setTimeout=()=>{};
  call('state.role="owner";state.person={person:{person_id:"test"}};openConversationEditor({conversation_id:"c",note:"本文",recap:"短いまとめ",tags:["子どもあり","読書"]})');
  assert.deepEqual(Array.from(call('[...state.selectedTags]')),['子どもあり','読書']);
  assert.equal(call('byId("conversation-note").value'),'本文');
  assert.equal(call('byId("recap-options").open'),true);
});

test('editing an older short-only conversation does not erase its historical summary',async()=>{
  const {call,context}=await loadApp();context.setTimeout=()=>{};
  call('state.role="owner";state.person={person:{person_id:"test"}};openConversationEditor({conversation_id:"c",note:"以前のまとめ",recap:"以前のまとめ",tags:[]})');
  assert.equal(call('byId("conversation-recap").value'),'以前のまとめ');
  assert.equal(call('byId("recap-options").open'),true);
});

test('a directory refresh failure after inserting a child clears the saved draft and does not invite a duplicate',async()=>{
  const {call,context}=await loadApp();let inserts=0;const notices=[];
  context.noticeFixture=notices;
  context.detailFixture={person:{person_id:'test'},assignments:[],familyMembers:[]};
  context.clientFixture={from:()=>({insert(values){this.values=values;return this;},select(){return this;},async single(){inserts++;return {data:{...this.values,family_member_id:'child-test'},error:null};}})};
  call('state.role="owner";state.client=clientFixture;toast=text=>noticeFixture.push(text);loadDirectory=async()=>{throw new Error("refresh failed")};renderDetail=()=>{testProfile=renderProfileDetails(detailFixture)};testProfile=renderProfileDetails(detailFixture)');
  const all=node=>[node,...node.children.flatMap(all)];
  let form=all(call('testProfile')).find(node=>node.className==='family-form');
  all(form).find(node=>node.id==='family-age').value='5';
  await form.listeners.submit({preventDefault(){}});
  form=all(call('testProfile')).find(node=>node.className==='family-form');
  assert.equal(all(form).find(node=>node.id==='family-age').value,'');
  await form.listeners.submit({preventDefault(){}});
  assert.equal(inserts,1);
  assert.ok(notices.some(text=>/保存済み/.test(text)));
});

test('person identity displays own age separately from children and keeps legacy people unchanged',async()=>{
  const {call}=await loadApp();
  const card=call('identityCard({person:{canonical_name:"架空の人物",card_image:{mode:"illustration",illustrationId:"reading"},age_info:{birth_date:"1991-01-01"}},assignments:[],familyMembers:[]})');
  const all=node=>[node,...node.children.flatMap(all)];
  assert.ok(all(card).some(node=>node.textContent==='35歳 · 誕生日 1月1日'));
  const old=call('identityCard({person:{canonical_name:"旧データ",card_image:{mode:"illustration",illustrationId:"reading"}},assignments:[],familyMembers:[]})');
  assert.ok(!all(old).some(node=>String(node.textContent||'').includes('歳')));
});

test('editing another person does not retain the previous birthday draft',async()=>{
  const {call,elements}=await loadApp();
  call('fillPersonAgeEditor({birth_date:"1991-01-01"})');
  assert.equal(elements.get('person-birthday').value,'1991/01/01');
  assert.equal(elements.get('person-age').value,'35');
  assert.equal(elements.get('person-age').readOnly,true);
  call('fillPersonAgeEditor(null)');
  assert.equal(elements.get('person-birthday').value,'');
  assert.equal(elements.get('person-age').value,'');
  assert.equal(elements.get('person-age').readOnly,false);
});

test('person selection retains age data and falls back safely on a database without the optional column',async()=>{
  const {call,context}=await loadApp();let attempts=0;
  context.fetchFixture=async columns=>{attempts++;return columns.includes('age_info')?{data:null,error:{code:'42703',message:'column people.age_info does not exist'}}:{data:[{person_id:'old'}],error:null};};
  const result=await call('selectWithCardFields(fetchFixture)');
  assert.equal(attempts,2);assert.equal(result.data[0].person_id,'old');
  assert.equal(call('state.personAgeAvailable'),false);
});
