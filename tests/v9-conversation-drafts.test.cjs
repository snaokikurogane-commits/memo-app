const test=require('node:test'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url'),{join}=require('node:path');
const moduleUrl=pathToFileURL(join(__dirname,'../v9-preview/conversation-drafts.js')).href;
const storage=()=>{const values=new Map();return {get length(){return values.size;},key:i=>[...values.keys()][i],getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};};
test('drafts survive a reload but are separated by project, account, person, and edit record',async()=>{
  const {ConversationDrafts}=await import(moduleUrl),disk=storage(),scope=['project-a','user-a','person-a','new'];
  const first=new ConversationDrafts(()=>disk);first.write(scope,{note:'未保存の話',job:{id:'fixed-id'}});
  const reloaded=new ConversationDrafts(()=>disk);
  assert.equal(reloaded.read(scope).note,'未保存の話');
  for(const other of [['project-b','user-a','person-a','new'],['project-a','user-b','person-a','new'],['project-a','user-a','person-b','new'],['project-a','user-a','person-a','edit-a']]) assert.equal(reloaded.read(other),null);
  const draft=reloaded.read(scope);draft.job.id='changed';assert.equal(reloaded.read(scope).job.id,'fixed-id');
  first.write(['project-a','user-b','person-a','new'],{note:'別アカウント'});
  first.clearAccount('project-a','user-a');
  assert.equal(reloaded.read(scope),null);assert.equal(reloaded.read(['project-a','user-b','person-a','new']).note,'別アカウント');
});
test('unavailable storage retains a memory draft and reports its limited durability',async()=>{
  const {ConversationDrafts}=await import(moduleUrl),drafts=new ConversationDrafts(()=>{throw new Error('blocked');}),scope=['project','user','person','new'];
  assert.equal(drafts.write(scope,{note:'残す'}),false);assert.equal(drafts.read(scope).note,'残す');
  drafts.remove(scope);assert.equal(drafts.read(scope),null);
});
test('corrupt stored drafts do not crash and removal works even when writes fail',async()=>{
  const {ConversationDrafts}=await import(moduleUrl),disk=storage(),scope=['project','user','person','new'],drafts=new ConversationDrafts(()=>disk);
  drafts.write(scope,{note:'下書き'});disk.setItem(disk.key(0),'not json');assert.equal(new ConversationDrafts(()=>disk).read(scope),null);
  disk.setItem=()=>{throw new Error('quota');};drafts.write(scope,{note:'メモリに残す'});assert.equal(drafts.read(scope).note,'メモリに残す');drafts.clearAccount('project','user');assert.equal(drafts.read(scope),null);
});
