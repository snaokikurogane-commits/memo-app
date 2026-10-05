const clean = value => String(value ?? '').normalize('NFKC').trim();
const presenceTags = new Set(['子どもあり','子供あり','こどもあり','子どもがいる','子供がいる','子ども有り','子供有り']);
const countPattern = /^(?:子ども|子供|こども)(\d+)人$/;

export function isChildrenTag(value) {
  const tag = clean(value);
  return presenceTags.has(tag) || countPattern.test(tag);
}

export function childrenInfo(person = {}) {
  const tags = Array.isArray(person.profile_tags) ? person.profile_tags : [];
  const counts = tags.map(tag => clean(tag).match(countPattern)).filter(Boolean)
    .map(match => Number(match[1])).filter(count => Number.isInteger(count) && count > 0 && count <= 30);
  const count = counts.length === 1 ? counts[0] : null;
  const hasChildren = counts.length > 0 || tags.some(tag => presenceTags.has(clean(tag))) || Boolean(person.hasKnownChildren);
  return {hasChildren,count,label:hasChildren ? count ? `子ども${count}人` : '子どもあり' : ''};
}

export function childrenProfileTags(tags, {hasChildren,count = ''}) {
  const numberText = clean(count);
  if (numberText && (!/^\d+$/.test(numberText) || Number(numberText) < 1 || Number(numberText) > 30))
    throw new Error('子どもの人数は1〜30人で入力してください。分からない場合は空欄で保存できます。');
  const next = (Array.isArray(tags) ? tags : []).filter(tag => !isChildrenTag(tag));
  if (hasChildren || numberText) next.push(numberText ? `子ども${Number(numberText)}人` : '子どもあり');
  if (next.length > 30) throw new Error('人物タグは30件までです。不要なタグを1件整理してから保存してください。');
  return [...new Set(next)];
}

export function currentChildAge(member, now = new Date()) {
  const dateValue = member.birth_date || member.observed_on;
  if (!dateValue) return null;
  const reference = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(reference.getTime()) || reference > now) return null;
  if (!member.birth_date && !Number.isInteger(member.observed_age)) return null;
  let years = now.getFullYear() - reference.getFullYear();
  if (now.getMonth() < reference.getMonth() || (now.getMonth() === reference.getMonth() && now.getDate() < reference.getDate())) years--;
  return Math.max(0, years + (member.birth_date ? 0 : member.observed_age));
}
