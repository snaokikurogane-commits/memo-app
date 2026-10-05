import {verifyPhotoBlob} from './jpeg.js';
// Shared image selection for the list, cover and encrypted backup.
export const hobbyIllustrations = [
  {id:'soccer',label:'サッカー',tags:['サッカー','フットサル']},
  {id:'reading',label:'読書',tags:['読書','本','読書好き']},
  {id:'hiking',label:'登山・ハイキング',tags:['登山','ハイキング','山登り']},
  {id:'golf',label:'ゴルフ',tags:['ゴルフ']},
  {id:'travel',label:'旅行',tags:['旅行','旅','温泉']},
  {id:'car',label:'車',tags:['車','クルマ','自動車','ドライブ']},
  {id:'running',label:'ランニング',tags:['ランニング','ジョギング','マラソン']},
  {id:'music',label:'音楽',tags:['音楽','ギター','楽器']},
  {id:'coffee',label:'コーヒー',tags:['コーヒー','珈琲','カフェ']},
  {id:'fishing',label:'釣り',tags:['釣り','つり','フィッシング']},
  {id:'cooking',label:'料理',tags:['料理','料理好き','お菓子作り']},
  {id:'gardening',label:'園芸',tags:['園芸','ガーデニング','家庭菜園']},
  {"id":"baseball","label":"野球","tags":["野球","野球観戦","ベースボール"]},
  {"id":"gym","label":"ジム・筋トレ","tags":["ジム","筋トレ","フィットネス","ウエイトトレーニング"]},
  {"id":"alcohol","label":"お酒","tags":["お酒","酒","ビール","日本酒","ワイン","晩酌"]},
  {"id":"movie","label":"映画","tags":["映画","映画鑑賞","シネマ"]},
  {"id":"dog","label":"犬","tags":["犬","いぬ","イヌ","愛犬","わんこ"],"keywords":["ペット"]},
  {"id":"cat","label":"猫","tags":["猫","ねこ","ネコ","愛猫"],"keywords":["ペット"]},
  {"id":"pet","label":"ペット","tags":["ペット","動物"]},
  {"id":"idol","label":"アイドル・推し活","tags":["アイドル","アイドル好き","推し活"]},
  {"id":"gacha","label":"ガチャガチャ","tags":["ガチャガチャ","ガチャ","カプセルトイ","ガシャポン"]},
  {"id":"tennis","label":"テニス","tags":["テニス","硬式テニス","ソフトテニス"]},
  {"id":"basketball","label":"バスケットボール","tags":["バスケットボール","バスケ"]},
  {"id":"cycling","label":"自転車・サイクリング","tags":["自転車","サイクリング","ロードバイク","ポタリング"]},
  {"id":"swimming","label":"水泳","tags":["水泳","スイミング","泳ぐこと"]},
  {"id":"yoga","label":"ヨガ","tags":["ヨガ","ピラティス"]},
  {"id":"camping","label":"キャンプ","tags":["キャンプ","アウトドア","ソロキャンプ"]},
  {"id":"sauna","label":"サウナ","tags":["サウナ","サ活"]},
  {"id":"camera","label":"カメラ・写真","tags":["カメラ","写真","写真撮影","フォト"]},
  {"id":"gaming","label":"ゲーム","tags":["ゲーム","ゲーム好き","テレビゲーム","ゲーム実況"]},
  {"id":"anime","label":"アニメ","tags":["アニメ","アニメ鑑賞"]},
  {"id":"manga","label":"漫画","tags":["漫画","マンガ","まんが"]},
  {"id":"live","label":"ライブ・フェス","tags":["ライブ","コンサート","フェス","音楽フェス"]},
  {"id":"karaoke","label":"カラオケ","tags":["カラオケ","歌","歌うこと"]},
  {"id":"sweets","label":"スイーツ","tags":["スイーツ","甘いもの","お菓子"]},
  {"id":"food","label":"食べ歩き・グルメ","tags":["食べ歩き","グルメ","外食"]},
  {"id":"craft","label":"手芸・ハンドメイド","tags":["手芸","ハンドメイド","編み物","裁縫"]},
  {"id":"shopping","label":"買い物・ショッピング","tags":["買い物","ショッピング"]},
  {"id":"art","label":"美術・アート","tags":["美術","アート","美術館","絵画"]},
  {"id":"boardgame","label":"ボードゲーム","tags":["ボードゲーム","ボドゲ","カードゲーム"]},
  {id:'parenting',label:'子育て',tags:['子どもあり','子供あり','こどもあり','子どもがいる','子供がいる','子ども有り','子供有り','子育て','育児'],keywords:['親子','家族','子ども','子供']},
];
const normalizedSearchText = value => String(value ?? '').normalize('NFKC').trim().toLowerCase();
export function filterHobbyIllustrations(query = '') {
  const terms = normalizedSearchText(query).split(/\s+/).filter(Boolean);
  return hobbyIllustrations.filter(item => {
    const searchable = normalizedSearchText([item.id,item.label,...item.tags,...(item.keywords || [])].join(' '));
    return terms.every(term => searchable.includes(term));
  });
}
const themes = new Set(['mist','watercolor','sunset','orb','spring','summer','autumn','winter','dots','linen','seaglass','twilight','soft-stripe','moonlight','plain']);
const photoPathPattern = /^[A-Za-z0-9_-]{1,180}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$/i;
const clamp = (value, fallback, min, max) => Number.isFinite(Number(value)) && value !== null
  ? Math.max(min,Math.min(max,Number(value))) : fallback;
export const isPhotoPath = path => typeof path === 'string' && photoPathPattern.test(path);

export function normalizeCardImage(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {mode:'theme'};
  if (value.mode === 'auto') return {mode:'auto'};
  if (value.mode === 'illustration' && hobbyIllustrations.some(item=>item.id === value.illustrationId))
    return {mode:'illustration',illustrationId:value.illustrationId};
  if (value.mode === 'photo' && isPhotoPath(value.path)) return {
    mode:'photo',path:value.path,
    x:clamp(value.x,.5,0,1),y:clamp(value.y,.5,0,1),zoom:clamp(value.zoom,1,1,3),
  };
  return {mode:'theme'};
}

export function resolveCardArtwork(person) {
  const selection=normalizeCardImage(person?.card_image);
  if (selection.mode === 'photo') {
    const {path,x,y,zoom}=selection; return {kind:'photo',path,x,y,zoom};
  }
  if (selection.mode === 'illustration') return {kind:'illustration',id:selection.illustrationId};
  if (selection.mode === 'auto') {
    for (const tag of Array.isArray(person?.profile_tags)?person.profile_tags:[]) {
      const cleaned=String(tag).normalize('NFKC').trim().toLowerCase();
      const item=hobbyIllustrations.find(item=>item.tags.some(alias=>alias.toLowerCase() === cleaned)
        || (item.id === 'parenting' && /^(?:子ども|子供|こども)[1-9]\d?人$/.test(cleaned)));
      if (item) return {kind:'illustration',id:item.id};
    }
  }
  return {kind:'theme',id:themes.has(person?.card_style)?person.card_style:'mist'};
}

export class PhotoStore {
  constructor(client) { this.client=client; this.cache=new Map(); this.urls=new Set(); this.generation=0; }
  bucket() { return this.client.storage.from('person-card-photos'); }
  async download(path) {
    if (!isPhotoPath(path)) throw new Error('写真の保存先が正しくありません。');
    const {data,error}=await this.bucket().download(path);
    if (error) throw error;
    if (!(data instanceof Blob)) throw new Error('写真を取得できませんでした。');
    return data;
  }
  source(path) {
    if (!this.cache.has(path)) {
      const generation=this.generation;
      const pending=this.download(path).then(blob=>{
        if (generation !== this.generation) throw new Error('写真の読込を終了しました。');
        const url=URL.createObjectURL(blob); this.urls.add(url); return url;
      }).catch(error=>{if (this.cache.get(path)===pending) this.cache.delete(path);throw error;});
      this.cache.set(path,pending);
    }
    return this.cache.get(path);
  }
  async upload(personId,blob) {
    if (!/^[A-Za-z0-9_-]{1,180}$/.test(personId)) throw new Error('人物の識別情報が正しくありません。');
    if (!(blob instanceof Blob) || blob.type !== 'image/jpeg' || blob.size > 1024*1024)
      throw new Error('保存できる写真は1MB以下のJPEGです。');
    const path=`${personId}/${crypto.randomUUID()}.jpg`;
    const {error}=await this.bucket().upload(path,blob,{contentType:'image/jpeg',upsert:false,cacheControl:'3600'});
    if (error) throw error;
    return path;
  }
  async remove(path) {
    if (!isPhotoPath(path)) return;
    const {error}=await this.bucket().remove([path]);
    if (error) throw error;
    this.invalidate(path);
  }
  invalidate(path) {
    const source=this.cache.get(path);this.cache.delete(path);
    if (source) source.then(url=>{URL.revokeObjectURL(url);this.urls.delete(url);}).catch(()=>{});
  }
  async removeIfUnused(path) {
    const {data,error}=await this.client.from('people').select('person_id').contains('card_image',{mode:'photo',path}).limit(1);
    if (error) throw error;
    if (!data || data.length) return false;
    await this.remove(path);return true;
  }
  clear() { this.generation++;for (const url of this.urls) URL.revokeObjectURL(url);this.urls.clear();this.cache.clear(); }
}

export async function persistCardImage({personId,image,photoBlob,oldImage,store,save,onCleanupError=()=>{}}) {
  let uploaded=null;
  let selection=normalizeCardImage(image);
  if (image?.mode === 'photo' && photoBlob) {
    uploaded=await store.upload(personId,photoBlob);
    selection=normalizeCardImage({...image,path:uploaded});
    if (selection.mode !== 'photo') throw new Error('写真の保存先が正しくありません。');
  } else if (image?.mode === 'photo' && selection.mode !== 'photo') {
    throw new Error('写真を選んでください。');
  }
  try { await save(selection); }
  catch (error) {
    if (uploaded) {try {await store.remove(uploaded);} catch (cleanupError) {onCleanupError(cleanupError);}}
    throw error;
  }
  const previous=normalizeCardImage(oldImage);
  if (previous.mode === 'photo' && previous.path !== selection.path) {
    try {await store.removeIfUnused(previous.path);} catch (error) {onCleanupError(error);}
  }
  return selection;
}

export async function preparePhoto(file) {
  if (!file || file.size > 20*1024*1024) throw new Error('20MB以下の写真を選んでください。');
  const type=String(file.type || '').toLowerCase();
  const accepted=/^image\/(jpeg|png|webp|heic|heif)$/.test(type) || (!type && /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name||''));
  if (!accepted) throw new Error('JPEG・PNG・WebPの写真を選んでください。HEICは対応端末で使えます。');
  const url=URL.createObjectURL(file);
  try {
    const image=new Image();image.src=url;
    try {await image.decode();} catch {throw new Error('この端末では写真を読めません。JPEGまたはPNGの写真を選んでください。');}
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('写真の大きさを確認できませんでした。');
    let scale=Math.min(1,1600/Math.max(image.naturalWidth,image.naturalHeight));
    const canvas=document.createElement('canvas');
    const context=canvas.getContext('2d');
    if (!context) throw new Error('写真の変換を開始できませんでした。');
    for (let attempt=0;attempt<8;attempt++) {
      canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));
      canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
      context.fillStyle='#fffefa';context.fillRect(0,0,canvas.width,canvas.height);
      context.drawImage(image,0,0,canvas.width,canvas.height);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',Math.max(.6,.9-attempt*.05)));
      if (!blob) throw new Error('写真を変換できませんでした。');
      if (blob.size<=1024*1024) return blob;
      scale*=.85;
    }
    throw new Error('写真を縮小できませんでした。別の写真を選んでください。');
  } finally {URL.revokeObjectURL(url);}
}

export async function collectPhotoMedia(people,download,onProgress=()=>{}) {
  const media=[];const seen=new Set();
  for (const person of people) {
    if (person.card_image?.mode !== 'photo') continue;
    const path=person.card_image.path;
    if (seen.has(path)) continue;
    onProgress(person);
    try {
      if (!isPhotoPath(path)) throw new Error('写真の保存先が正しくありません。');
      const blob=await download(path);
      const bytes=await verifyPhotoBlob(blob);
      let binary='';for (let i=0;i<bytes.length;i+=8192) binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
      media.push({path,mime:'image/jpeg',base64:btoa(binary)});seen.add(path);
    } catch (error) {throw new Error(`${person.canonical_name||'人物'}の写真を取得できませんでした。再試行してください。${error.message||''}`);}
  }
  return media;
}
