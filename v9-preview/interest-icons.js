import {hobbyIllustrations} from './card-images.js?v=9-20261029-usability';

// Supplied 50 square icons. Cover artwork remains a separate saved setting.
const primary=[
  ['cooking','料理',['料理好き']],['travel','旅行',['旅','海外旅行']],['movie','映画',['映画鑑賞','シネマ']],
  ['coffee','カフェ',['コーヒー','珈琲','カフェ巡り']],['gardening','ガーデニング',['園芸','家庭菜園']],
  ['sauna','サウナ',['サ活']],['tennis','テニス',['硬式テニス','ソフトテニス']],['camera','写真',['カメラ','写真撮影','フォト']],
  ['reading','読書',['本','読書好き']],['music','音楽',['音楽鑑賞']],['gym','筋トレ',['ジム','フィットネス','ウエイトトレーニング']],
  ['running','ランニング',['ジョギング','マラソン']],['soccer','サッカー',['フットサル']],['baseball','野球',['野球観戦','ベースボール']],
  ['basketball','バスケ',['バスケットボール']],['golf','ゴルフ',[]],['cycling','自転車',['サイクリング','ロードバイク','ポタリング']],
  ['hiking','登山',['ハイキング','山登り']],['camping','キャンプ',['アウトドア','ソロキャンプ']],['fishing','釣り',['つり','フィッシング']],
  ['gaming','ゲーム',['ゲーム好き','テレビゲーム','ゲーム実況']],['gadget','スマホ・ガジェット',['スマホ','ガジェット','スマートフォン']],
  ['computer','パソコン',['PC','IT','プログラミング']],['anime','アニメ',['アニメ鑑賞']],['fashion','ファッション',['服','洋服']],
  ['watch','腕時計',['時計']],['car','車',['クルマ','自動車','ドライブ']],['motorbike','バイク',['オートバイ','ツーリング']],
  ['railway','鉄道',['電車','鉄道旅行']],['airplane','航空・飛行機',['飛行機','航空']],['dog','犬',['いぬ','イヌ','愛犬','わんこ']],
  ['cat','猫',['ねこ','ネコ','愛猫']],['rabbit','うさぎ',['ウサギ','兎']],['bird','鳥',['小鳥','インコ']],
  ['aquarium','水槽・アクアリウム',['アクアリウム','水槽','熱帯魚']],['baking','お菓子作り',['製菓']],['bread','パン作り',['製パン']],
  ['art','絵・イラスト',['美術','アート','美術館','絵画','イラスト','絵']],['stationery','文房具',['文具','手帳']],['diy','DIY',['日曜大工']],
  ['instrument','楽器演奏',['楽器','ギター','ピアノ','演奏']],['karaoke','カラオケ',['歌','歌うこと']],
  ['wellness','健康・美容',['健康','美容','スキンケア']],['yoga','ヨガ・瞑想',['ヨガ','ピラティス','瞑想']],
  ['investment','投資・資産運用',['投資','資産運用','株']],['study','仕事・資格勉強',['資格勉強','資格','勉強']],
  ['food','グルメ・食べ歩き',['食べ歩き','グルメ','外食']],['onsen','温泉',['温泉巡り']],['shopping','ショッピング',['買い物']],['other','その他',[]],
].map(([id,label,aliases])=>({id,label,tags:[label,...aliases],src:`./assets/interests/${id}.webp`}));
export const interestIcons=[...primary,...hobbyIllustrations.filter(item=>!primary.some(icon=>icon.id===item.id))
  .map(item=>({...item,src:`./assets/${item.id}.webp?v=20261005-simple-a`}))];
const clean=value=>String(value??'').normalize('NFKC').trim().toLowerCase();
export function interestIconForTag(tag) {
  const value=clean(tag);if(!value)return null;
  return interestIcons.find(icon=>[icon.id,...icon.tags].some(alias=>clean(alias)===value))||null;
}
export function interestsForTags(tags) {
  const result=[],seen=new Set();
  for(const tag of Array.isArray(tags)?tags:[]){const icon=interestIconForTag(tag);if(icon && !seen.has(icon.id)){seen.add(icon.id);result.push(icon);}}
  return result;
}
