import {interestIcons,interestIconForTag} from './interest-icons.js?v=9-20261107-tag-icons';
import {isChildrenTag} from './family.js?v=9-20261006-family';
const clean = value => String(value ?? '').normalize('NFKC').trim().toLowerCase();
export const tagCategories = [['all','すべて'],['hobby','趣味'],['relationship','関係'],['family','家族'],['work','仕事'],['custom','自分のタグ']];
const groups = {
  relationship:[['同期','cohort'],['特に仲良し','close'],['友人','friend'],['同僚','colleague'],['先輩','senior'],['後輩','junior'],['地元','hometown'],['LINE','line']],
  family:[['子どもあり','children'],['未就学児','preschool'],['小学生','elementary-school'],['中学生','middle-school'],['高校生','high-school'],['大学生','college'],['子育て','parenting'],['育児','childcare']],
  work:[['雇用保険','employment-insurance'],['給付経験あり','benefit-experience'],['仕事','work'],['異動','reassignment'],['転勤','relocation'],['新しい担当','new-assignment']],
};
const familyTags = new Set(groups.family.map(([label]) => clean(label)));
export const isFamilyTag = value => familyTags.has(clean(value)) || isChildrenTag(value);
const tagIcons = new Map(Object.values(groups).flat().map(([label,id]) =>
  [clean(label), {id, label, src:`./assets/${id === 'parenting' ? 'interests' : 'tags'}/${id}.webp`}]));
export function tagIconForTag(value) {
  return tagIcons.get(clean(value)) ||
    (isChildrenTag(value) ? tagIcons.get('子どもあり') : interestIconForTag(value));
}

export function tagChoices(directory = [], conversations = [], selected = [], query = '', category = 'all') {
  const items = new Map();
  for (const item of interestIcons) if (item.id !== 'parenting') {
    const label = item.tags[0];
    items.set(clean(label),{label,category:'hobby',keywords:[item.label,...item.tags,...(item.keywords || [])]});
  }
  for (const [group, labels] of Object.entries(groups)) for (const [label] of labels)
    items.set(clean(label),{label,category:group,keywords:label === '子どもあり' ? [label,'子供','こども','親子'] : [label]});
  for (const row of [...directory,...conversations]) for (const label of (row.profile_tags || row.tags || [])) {
    if (typeof label !== 'string' || !label.trim() || label.startsWith('#') || label.includes('@@')) continue;
    const key = clean(label);
    if (!items.has(key) && !interestIconForTag(label)) items.set(key,{label,category:isFamilyTag(label) ? 'family' : 'custom',keywords:[label]});
  }
  const selectedKeys = new Set(Array.from(selected,clean));
  const selectedIcons=new Set(Array.from(selected,tag=>interestIconForTag(tag)?.id).filter(Boolean));
  const terms = clean(query).split(/\s+/).filter(Boolean);
  return [...items.values()].filter(item => !selectedKeys.has(clean(item.label)) && !(item.category==='hobby' && selectedIcons.has(interestIconForTag(item.label)?.id)) && (category === 'all' || category === item.category)
    && terms.every(term => clean(item.keywords.join(' ')).includes(term)));
}
