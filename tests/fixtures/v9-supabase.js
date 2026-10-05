// Fictional data for local UI verification. Never imported by the published app.
const data = {
  app_members:[{user_id:'demo-user',role:'owner',active:true}],
  people:[
    {person_id:'demo-sato',canonical_name:'佐藤 健太',name_kana:'さとう けんた',profile_tags:['サッカー','同期','コーヒー'],active_status:'active',card_style:'mist',card_image:{mode:'auto'},icon_style:'none'},
    {person_id:'demo-tanaka',canonical_name:'田中 美咲',name_kana:'たなか みさき',profile_tags:['読書','旅行'],active_status:'active',card_style:'watercolor',card_image:{mode:'auto'},icon_style:'none'},
    {person_id:'demo-mori',canonical_name:'森 悠介',name_kana:'もり ゆうすけ',profile_tags:['ハイキング','ゴルフ'],active_status:'active',card_style:'summer',card_image:{mode:'auto'},icon_style:'none'},
    {person_id:'demo-long',canonical_name:'アレクサンドラ・とても長い名前の人物',name_kana:'あれくさんどら',profile_tags:['仕事','地域活動','旧友','同期'],active_status:'active',card_style:'sunset',card_image:null,icon_style:'none'},
  ],
  assignments:[
    {assignment_id:'a1',person_id:'demo-sato',fiscal_year:'令和8年度',organization:'市役所',department:'企画課',role:'主事',verified_status:'verified'},
    {assignment_id:'a2',person_id:'demo-tanaka',fiscal_year:'令和8年度',organization:'図書館',department:'地域連携室',role:'',verified_status:'verified'},
    {assignment_id:'a3',person_id:'demo-long',fiscal_year:'令和8年度',organization:'とても長い組織名が続く地域まちづくり協議会',department:'地域連携と新しい取り組みを考える部門',role:'運営担当',verified_status:'verified'},
  ],
  conversations:[
    {conversation_id:'c1',person_id:'demo-sato',occurred_at:'2026-10-02T09:00:00+09:00',recap:'週末に息子さんとサッカー観戦。',note:'新しいスタジアムに行った話。来月も家族で観戦予定。',tags:['サッカー']},
    {conversation_id:'c2',person_id:'demo-sato',occurred_at:'2026-09-15T09:00:00+09:00',recap:'駅前のコーヒー店がお気に入り。',note:'浅煎りがおすすめとのこと。',tags:['コーヒー']},
    {conversation_id:'c3',person_id:'demo-tanaka',occurred_at:'2026-09-30T09:00:00+09:00',recap:'最近は短編小説を読んでいる。',note:'次におすすめを聞いてみたい。',tags:['読書']},
  ],
  follow_up_items:[
    {follow_up_id:'f1',person_id:'demo-sato',body:'サッカー観戦はどうでしたか？',due_at:'2026-10-10',status:'open',created_at:'2026-10-02T09:00:00Z'},
    {follow_up_id:'f2',person_id:'demo-sato',body:'おすすめのコーヒー豆は？',due_at:null,status:'open',created_at:'2026-10-01T09:00:00Z'},
    {follow_up_id:'f3',person_id:'demo-tanaka',body:'最近読んでよかった本は？',due_at:null,status:'open',created_at:'2026-10-01T09:00:00Z'},
  ],
  family_members:[{family_member_id:'k1',person_id:'demo-sato',relationship:'child',display_name:'はる',birth_date:'2018-05-12',note:'サッカーが好き'}],
  events:[],topic_preferences:[],
};
const photos=new Map();
const keys={people:'person_id',assignments:'assignment_id',conversations:'conversation_id',follow_up_items:'follow_up_id',family_members:'family_member_id',events:'event_id'};
class Query {
  constructor(table) {this.table=table;this.filters=[];this.operation='select';this.bounds=null;this.one=false;this.orders=[];}
  select(columns='*',options={}) {this.count=options.count;return this;}
  range(a,b) {this.bounds=[a,b];return this;}
  order(key,options={}) {this.orders.push([key,options.ascending!==false]);return this;}
  eq(key,value) {this.filters.push(row=>['card_image','profile_tags'].includes(key)?JSON.stringify(row[key])===value:row[key]===value);return this;}
  is(key,value) {this.filters.push(row=>(row[key]??null)===value);return this;}
  in(key,values) {this.filters.push(row=>values.includes(row[key]));return this;}
  contains(key,values) {this.filters.push(row=>Object.entries(values).every(([k,v])=>row[key]?.[k]===v));return this;}
  limit(count) {this.bounds=[0,count-1];return this;}
  single() {this.one=true;return this;}
  maybeSingle() {this.one=true;return this;}
  insert(values) {this.operation='insert';this.values=values;return this;}
  upsert(values) {return this.insert(values);}
  update(values) {this.operation='update';this.values=values;return this;}
  delete() {this.operation='delete';return this;}
  async result() {
    const mode=await fetch('/fixture-mode.json',{cache:'no-store'}).then(r=>r.json()).catch(()=>({}));
    if (mode.failPeople && this.table==='people' && this.operation!=='select') return {data:null,error:{message:'確認用：人物の保存に失敗しました'}};
    let rows=data[this.table]||[];let selected=rows.filter(row=>this.filters.every(filter=>filter(row)));
    if (this.operation==='insert') {
      selected=(Array.isArray(this.values)?this.values:[this.values]).map(values=>({...values,[keys[this.table]]:values[keys[this.table]]||crypto.randomUUID(),created_at:new Date().toISOString(),status:values.status||'open'}));
      rows.push(...selected);
    } else if (this.operation==='update') selected.forEach(row=>Object.assign(row,this.values));
    else if (this.operation==='delete') data[this.table]=rows.filter(row=>!selected.includes(row));
    for (const [key,asc] of this.orders) selected.sort((a,b)=>String(a[key]||'').localeCompare(String(b[key]||''))*(asc?1:-1));
    const count=selected.length;
    if (this.bounds) selected=selected.slice(this.bounds[0],this.bounds[1]+1);
    return {data:structuredClone(this.one?selected[0]||null:selected),error:null,count};
  }
  then(resolve,reject) {return this.result().then(resolve,reject);}
}
export function createClient() {
  return {
    from:table=>new Query(table),
    auth:{getSession:async()=>({data:{session:{user:{id:'demo-user'}}},error:null}),onAuthStateChange:()=>{},signOut:async()=>({error:null})},
    storage:{from:()=>({
      upload:async(path,blob)=>{photos.set(path,blob);return {error:null};},
      download:async path=>{
        const mode=await fetch('/fixture-mode.json',{cache:'no-store'}).then(r=>r.json());
        return mode.failPhoto?{error:new Error('確認用：写真の取得失敗')}:{data:photos.get(path),error:photos.has(path)?null:new Error('写真なし')};
      },
      remove:async paths=>{paths.forEach(path=>photos.delete(path));return {error:null};},
    })},
  };
}
