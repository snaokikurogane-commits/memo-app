const clean = value => String(value ?? '').normalize('NFKC').trim();
const pad = value => String(value).padStart(2, '0');
const dateText = date => `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
function validDate(year,month,day) {
  const date = new Date(year,month-1,day);
  return date.getFullYear() === year && date.getMonth() === month-1 && date.getDate() === day;
}
function parseBirthday(value,now) {
  const input=clean(value).replace(/[年月]/g,'/').replace(/日$/,'').replace(/-/g,'/');
  if (!input) return {};
  const match=input.match(/^(?:(\d{4})\/)?(\d{1,2})\/(\d{1,2})$/);
  if (!match) throw new Error('誕生日は「5/12」または「1991/5/12」の形で入力してください。');
  const [,yearText,monthText,dayText]=match,year=Number(yearText),month=Number(monthText),day=Number(dayText);
  if (!validDate(yearText ? year : 2000,month,day)) throw new Error('誕生日の日付を確認してください。');
  if (yearText && (year < now.getFullYear()-131 || new Date(year,month-1,day)>now)) throw new Error('誕生日は過去の生年月日を入力してください。');
  return yearText ? {birth_date:`${year}-${pad(month)}-${pad(day)}`} : {birthday:`${pad(month)}-${pad(day)}`};
}
export function personAgeSummary(info,now=new Date()) {
  const blank={ageLabel:'',birthdayLabel:'',age:null,estimated:false};
  if (!info || typeof info!=='object') return blank;
  let birthday;
  try {birthday=parseBirthday(info.birth_date || info.birthday || '',now);} catch {return blank;}
  const md=(birthday.birth_date?.slice(5) || birthday.birthday || '').split('-').map(Number);
  const birthdayLabel=md.length===2 ? `誕生日 ${md[0]}月${md[1]}日` : '';
  if (birthday.birth_date) {
    const [year,month,day]=birthday.birth_date.split('-').map(Number);
    const age=now.getFullYear()-year-((now.getMonth()+1<month || (now.getMonth()+1===month && now.getDate()<day))?1:0);
    return {...blank,age,ageLabel:`${age}歳`,birthdayLabel};
  }
  const anchor=new Date(`${info.observed_on}T00:00:00`);
  if (!Number.isInteger(info.observed_age) || info.observed_age<0 || info.observed_age>130 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(info.observed_on || '') || Number.isNaN(anchor.getTime()) || dateText(anchor)!==info.observed_on || anchor>now)
    return {...blank,birthdayLabel};
  let elapsed=0;
  if (birthday.birthday) {
    for (let year=anchor.getFullYear();year<=now.getFullYear();year++) {
      const anniversary=new Date(year,md[0]-1,md[1]); // Feb 29 becomes March 1 in non-leap years.
      if (anniversary>anchor && anniversary<=now) elapsed++;
    }
  } else {
    elapsed=now.getFullYear()-anchor.getFullYear();
    if (now.getMonth()<anchor.getMonth() || (now.getMonth()===anchor.getMonth() && now.getDate()<anchor.getDate())) elapsed--;
  }
  const age=info.observed_age+elapsed;
  return {...blank,age,estimated:true,ageLabel:`推定${age}歳`,birthdayLabel};
}
export function personAgeValues({birthday='',age=''},previous=null,now=new Date()) {
  const info=parseBirthday(birthday,now);
  if (info.birth_date) return info;
  const input=clean(age);
  if (!input) return info.birthday ? info : null;
  if (!/^\d+$/.test(input) || Number(input)>130) throw new Error('年齢は0〜130歳の整数で入力してください。分からない場合は空欄で保存できます。');
  const old=personAgeSummary(previous,now);
  if (old.estimated && old.age===Number(input) && (previous.birthday || '')===(info.birthday || ''))
    return {...info,observed_age:previous.observed_age,observed_on:previous.observed_on};
  return {...info,observed_age:Number(input),observed_on:dateText(now)};
}
export function personAgeInputs(info,now=new Date()) {
  const summary=personAgeSummary(info,now);
  return {birthday:info?.birth_date?.replaceAll('-','/') || info?.birthday?.replace('-','/') || '',age:summary.age===null?'':String(summary.age)};
}
