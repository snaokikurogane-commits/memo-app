const test=require('node:test'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url'),{join}=require('node:path');
const load=()=>import(pathToFileURL(join(__dirname,'../v9-preview/conversation-flow.js')).href);
const clock='2026-10-28T10:00:00.000Z';
const ids=()=>{let i=0;return ()=>`id-${++i}`;};

test('one note creates a linked next topic with the whole original quote',async()=>{
  const {createConversationJob}=await load();
  const note='旅'.repeat(5000),job=createConversationJob({personId:'p1',note,askNext:true,now:clock},ids());
  assert.equal(job.conversation.note,note);
  assert.equal(job.questions.length,1);
  assert.equal(job.questions[0].source_conversation_id,job.conversation.conversation_id);
  assert.deepEqual(job.questions[0].source_quote,{text:note,occurred_at:clock});
  assert.equal(job.questions[0].body.length,1000);
});
test('a reply quotes the previous topic without overwriting the original and can continue',async()=>{
  const {createConversationJob}=await load();
  const reply={follow_up_id:'f1',person_id:'p1',source_conversation_id:'old',body:'北海道へ旅行',source_quote:{text:'来月、北海道へ旅行するそう。',occurred_at:'2026-10-01T00:00:00Z'}};
  const job=createConversationJob({personId:'p1',note:'大阪に変更。',reply,askNext:true,now:clock},ids());
  assert.equal(job.conversation.reply_to_conversation_id,'old');
  assert.equal(job.conversation.reply_to_follow_up_id,'f1');
  assert.deepEqual(job.conversation.reply_quote,reply.source_quote);
  assert.equal(job.completeId,'f1');
  assert.equal(job.questions[0].source_quote.text,'大阪に変更。');
  assert.equal(reply.body,'北海道へ旅行');
});
test('manual questions remain replyable and unrelated people cannot be linked',async()=>{
  const {createConversationJob}=await load();
  const reply={follow_up_id:'f2',person_id:'p1',body:'旅行どうだった？',created_at:clock};
  const job=createConversationJob({personId:'p1',reply,note:'楽しかったそう。',now:clock},ids());
  assert.deepEqual(job.conversation.reply_quote,{text:'旅行どうだった？',occurred_at:clock});
  assert.equal(job.conversation.reply_to_conversation_id,null);
  assert.throws(()=>createConversationJob({personId:'p2',reply,note:'誤った人物'},ids()),/人物/);
});
test('empty replies only complete explicitly and cannot discard written content',async()=>{
  const {createConversationJob}=await load(),reply={follow_up_id:'f1',person_id:'p1',body:'質問'};
  assert.throws(()=>createConversationJob({personId:'p1',reply,note:''},ids()),/入力/);
  const job=createConversationJob({personId:'p1',reply,completeOnly:true,now:clock},ids());
  assert.equal(job.conversation,null);assert.equal(job.completeId,'f1');
  assert.throws(()=>createConversationJob({personId:'p1',reply,note:'消したくない',completeOnly:true},ids()),/記録/);
});
test('retry after a completion failure reuses the same records and completes only after saves',async()=>{
  const {createConversationJob,saveConversationJob}=await load();
  const job=createConversationJob({personId:'p1',note:'大阪に変更',reply:{follow_up_id:'f1',person_id:'p1',body:'北海道へ'},askNext:true,now:clock},ids());
  const conversations=new Map(),questions=new Map(),events=[];let fail=true;
  const store={async saveConversation(row){events.push('note');conversations.set(row.conversation_id,row);return row;},async saveQuestions(rows){events.push('questions');rows.forEach(r=>questions.set(r.follow_up_id,r));return rows;},async completeQuestion(id){events.push('complete');if(fail){fail=false;throw Error('offline');}return {follow_up_id:id,status:'completed'};}};
  await assert.rejects(saveConversationJob(job,store),/offline/);
  assert.equal(job.conversationConfirmed,true);assert.equal(job.completeConfirmed,false);
  await saveConversationJob(job,store);
  assert.equal(conversations.size,1);assert.equal(questions.size,1);assert.equal(job.completeConfirmed,true);
  assert.deepEqual(events,['note','questions','complete','complete']);
});
test('a session change stops later writes and a failed note never completes a question',async()=>{
  const {createConversationJob,saveConversationJob}=await load();
  const make=()=>createConversationJob({personId:'p1',note:'続き',reply:{follow_up_id:'f1',person_id:'p1',body:'元'},askNext:true,now:clock},ids());
  let active=true,called=false;
  const store={async saveConversation(row){active=false;return row;},async saveQuestions(){called=true;},async completeQuestion(){called=true;}};
  await assert.rejects(saveConversationJob(make(),store,{isActive:()=>active}),/ログイン/);assert.equal(called,false);
  store.saveConversation=async()=>{throw Error('offline');};
  await assert.rejects(saveConversationJob(make(),store),/offline/);assert.equal(called,false);
});
test('a confirmed draft from the previous release is read back without rewriting its note',async()=>{
  const {createConversationJob,saveConversationJob}=await load();
  const job=createConversationJob({personId:'p',note:'旧版で保存済み',now:clock},ids());job.conversationConfirmed=true;
  const store={async saveConversation(){throw Error('must not write');},async readConversation(row){return {...row};}};
  const result=await saveConversationJob(job,store);
  assert.equal(result.conversation.note,'旧版で保存済み');
});
