const test=require('node:test'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url'),{join}=require('node:path');
const load=()=>import(pathToFileURL(join(__dirname,'../v9-preview/conversation-store.js')).href);
function database(seed={}) {
  const data={conversations:[],follow_up_items:[],...structuredClone(seed)};
  let loseNextInsert=false;
  class Query {
    constructor(table){this.table=table;this.filters=[];this.op='read';}
    eq(k,v){this.filters.push(r=>r[k]===v);return this;}
    in(k,vs){this.filters.push(r=>vs.includes(r[k]));return this;}
    select(){return this;}
    single(){this.one=true;return this;}
    maybeSingle(){this.one=true;return this;}
    upsert(rows){this.op='insert';this.rows=rows;return this;}
    update(row){this.op='update';this.row=row;return this;}
    then(resolve,reject){return this.run().then(resolve,reject);}
    async run(){
      const rows=data[this.table],key=this.table==='conversations'?'conversation_id':'follow_up_id';
      if(this.op==='insert'){
        for(const r of Array.isArray(this.rows)?this.rows:[this.rows])if(!rows.some(x=>x[key]===r[key]))rows.push({...r,status:r.status||'open'});
        if(loseNextInsert){loseNextInsert=false;throw Error('response lost');}
      }
      const selected=rows.filter(r=>this.filters.every(f=>f(r)));
      if(this.op==='update')selected.forEach(r=>Object.assign(r,this.row));
      return {data:structuredClone(this.one?selected[0]||null:selected),error:null};
    }
  }
  return {data,from:t=>new Query(t),loseNextInsert:()=>{loseNextInsert=true;}};
}
test('an uncertain insert is verified on retry without duplicating the conversation',async()=>{
  const {SupabaseConversationStore}=await load(),db=database(),store=new SupabaseConversationStore(db);
  const row={conversation_id:'c1',person_id:'p1',note:'大阪に変更',tags:[]};
  db.loseNextInsert();await assert.rejects(store.saveConversation(row),/response lost/);
  const saved=await store.saveConversation(row);assert.equal(saved.note,'大阪に変更');assert.equal(db.data.conversations.length,1);
});
test('an ID collision or unreadable write cannot be mistaken for a successful save',async()=>{
  const {SupabaseConversationStore}=await load(),db=database({conversations:[{conversation_id:'c1',person_id:'other',note:'別人'}]}),store=new SupabaseConversationStore(db);
  await assert.rejects(store.saveConversation({conversation_id:'c1',person_id:'p1',note:'新しい記録'}),/確認/);
});
test('only the requested person and topic can be completed; repeated completion is safe',async()=>{
  const {SupabaseConversationStore}=await load(),db=database({follow_up_items:[{follow_up_id:'f1',person_id:'p1',body:'質問',status:'open'}]}),store=new SupabaseConversationStore(db);
  await assert.rejects(store.completeQuestion('f1','other','2026-10-28T00:00:00Z'),/確認/);
  assert.equal(db.data.follow_up_items[0].status,'open');
  await store.completeQuestion('f1','p1','2026-10-28T00:00:00Z');
  await store.completeQuestion('f1','p1','2026-10-29T00:00:00Z');
  assert.equal(db.data.follow_up_items[0].completed_at,'2026-10-28T00:00:00Z');
});
