import {decryptBackup} from './backup-crypto.js';
import {personAgeSummary} from './person-age.js?v=9-20261006-age';
import {verifyPhotoBlob} from './jpeg.js';
let opened=null;
const photoUrls=new Map();
const byId=id=>document.getElementById(id);
const labels={people:'人物',assignments:'所属履歴',conversations:'会話メモ',family_members:'家族',events:'出来事',follow_up_items:'次に聞くこと',topic_preferences:'自分の話題設定'};
function node(tag,text,className='') {const element=document.createElement(tag);element.textContent=text;element.className=className;return element;}
function clearPhotos() {for (const url of photoUrls.values()) URL.revokeObjectURL(url);photoUrls.clear();byId('reader-people').replaceChildren();}
function photoSource(path) {
  if (photoUrls.has(path)) return photoUrls.get(path);
  const media=opened?.media?.find(item=>item.path===path);if (!media) return null;
  const bytes=Uint8Array.from(atob(media.base64),char=>char.charCodeAt(0));
  const url=URL.createObjectURL(new Blob([bytes],{type:media.mime}));photoUrls.set(path,url);return url;
}
function photo(person,className) {
  const source=photoSource(person.card_image?.path);if (!source) return null;
  const wrapper=node('span','',className);const image=document.createElement('img');image.src=source;image.alt=person.canonical_name+'の保存写真';
  const {x=.5,y=.5,zoom=1}=person.card_image;image.style.objectPosition=`${Number(x)*100}% ${Number(y)*100}%`;
  image.style.transformOrigin=image.style.objectPosition;image.style.transform=`scale(${Number(zoom)})`;
  image.addEventListener('error',()=>wrapper.replaceWith(node('p','写真を表示できません。ファイルを確認してください。','muted')),{once:true});wrapper.append(image);return wrapper;
}
function renderPeople() {
  if (!opened) return;
  const query=byId('reader-search').value.normalize('NFKC').toLowerCase().trim();
  const rows=opened.tables.people.filter(person=>[person.canonical_name,person.name_kana,...(person.profile_tags||[])].join(' ').normalize('NFKC').toLowerCase().includes(query));
  byId('reader-people-count').textContent=`${rows.length}人`;
  byId('reader-people').replaceChildren(...rows.map(person=>{
    const details=node('details','','reader-person');const summary=node('summary','');
    const thumb=photo(person,'reader-photo');if (thumb) summary.append(thumb);
    const title=node('div','','reader-person-copy');title.append(node('strong',person.canonical_name||'名前未登録'),node('p',(person.profile_tags||[]).join('・'),'muted'));
    const age=personAgeSummary(person.age_info);
    if (age.ageLabel || age.birthdayLabel) title.append(node('p',[age.ageLabel,age.birthdayLabel].filter(Boolean).join(' · '),'muted'));
    summary.append(title);details.append(summary);
    details.addEventListener('toggle',()=>{
      if (!details.open || details.dataset.loaded) return;details.dataset.loaded='true';
      const copy=node('div','','reader-person-copy');const cover=photo(person,'reader-photo-preview');if (cover) copy.append(cover);
      const assignments=opened.tables.assignments.filter(row=>row.person_id===person.person_id);
      copy.append(node('h3','所属履歴'));
      assignments.forEach(row=>copy.append(node('p',[row.fiscal_year,row.organization,row.department,row.role].filter(Boolean).join(' / '))));
      copy.append(node('h3','次に聞くこと'));
      opened.tables.follow_up_items.filter(row=>row.person_id===person.person_id && row.status==='open').forEach(row=>copy.append(node('p',row.body)));
      copy.append(node('h3','会話履歴'));
      opened.tables.conversations.filter(row=>row.person_id===person.person_id).forEach(row=>{
        copy.append(node('p',`${String(row.occurred_at||'').slice(0,10)}\n${[row.recap,row.note].filter(Boolean).filter((value,index,array)=>array.indexOf(value)===index).join('\n')}`));
      });
      copy.append(node('h3','家族・出来事'));
      const relations={child:'子ども',spouse:'配偶者',parent:'親',sibling:'きょうだい',other:'家族'};
      opened.tables.family_members.filter(row=>row.person_id===person.person_id).forEach(row=>copy.append(node('p',[
        [relations[row.relationship]||row.relationship||'家族',row.display_name].filter(Boolean).join('：'),
        row.birth_date?`生年月日：${row.birth_date}`:'',row.observed_age!=null?`確認した年齢：${row.observed_age}歳`:'',
        row.observed_on?`確認日：${row.observed_on}`:'',row.note,
      ].filter(Boolean).join('\n'))));
      const eventTypes={birthday:'誕生日',anniversary:'記念日',other:'出来事'};
      opened.tables.events.filter(row=>row.person_id===person.person_id).forEach(row=>copy.append(node('p',[
        [eventTypes[row.event_type]||'出来事',row.event_date].filter(Boolean).join('：'),row.note,row.repeat_yearly?'毎年の予定':'',
      ].filter(Boolean).join('\n'))));
      details.append(copy);
    });return details;
  }));
}
byId('reader-form').addEventListener('submit',async event=>{
  event.preventDefault();if (byId('reader-open').disabled) return;
  opened=null;clearPhotos();byId('reader-result').hidden=true;byId('reader-open').disabled=true;byId('reader-status').textContent='確認中…';
  try {
    const file=byId('reader-file').files[0];
    if (!file || file.size>100*1024*1024) throw new Error('100MB以下のファイルを選んでください。');
    opened=await decryptBackup(JSON.parse(await file.text()),byId('reader-password').value);
    for (const item of opened.media||[]) {
      const bytes=Uint8Array.from(atob(item.base64),char=>char.charCodeAt(0));
      await verifyPhotoBlob(new Blob([bytes],{type:item.mime}));
    }
    byId('reader-meta').textContent=`作成日時：${new Date(opened.exported_at).toLocaleString('ja-JP')}　形式：v${opened.version}`;
    byId('reader-counts').replaceChildren(...Object.entries(labels).map(([key,label])=>node('li',`${label}：${opened.counts[key]}件`)),node('li',`写真：${opened.media?.length||0}枚`));
    byId('reader-search').value='';renderPeople();byId('reader-result').hidden=false;byId('reader-status').textContent='ファイルを確認できました。人物を選ぶと保存した内容を確認できます。';
  } catch(error) {opened=null;clearPhotos();byId('reader-status').textContent=error.message||'確認できませんでした。';}
  finally {byId('reader-password').value='';byId('reader-open').disabled=false;}
});
byId('reader-search').addEventListener('input',renderPeople);
byId('reader-plain-download').addEventListener('click',()=>{
  if (!opened) return;
  const url=URL.createObjectURL(new Blob([JSON.stringify(opened,null,2)],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download=`人物ネタ帳-復元用-${new Date(opened.exported_at).toISOString().slice(0,10)}.json`;
  document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
});
window.addEventListener('pagehide',clearPhotos);
