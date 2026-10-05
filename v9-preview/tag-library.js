import {hobbyIllustrations} from './card-images.js?v=9-20261006-family';
import {isChildrenTag} from './family.js?v=9-20261006-family';
const clean = value => String(value ?? '').normalize('NFKC').trim().toLowerCase();
export const tagCategories = [['all','すべて'],['hobby','趣味'],['relationship','関係'],['family','家族'],['work','仕事'],['custom','自分のタグ']];
const groups = {
  relationship:['同期','特に仲良し','友人','同僚','先輩','後輩','地元','LINE'],
  family:['子どもあり','未就学児','小学生','中学生','高校生','大学生','子育て','育児'],
  work:['雇用保険','給付経験あり','仕事','異動','転勤','新しい担当'],
};

export function tagChoices(directory = [], conversations = [], selected = [], query = '', category = 'all') {
  const items = new Map();
  for (const item of hobbyIllustrations) if (item.id !== 'parenting') {
    const label = item.tags[0];
    items.set(clean(label),{label,category:'hobby',keywords:[item.label,...item.tags,...(item.keywords || [])]});
  }
  for (const [group, labels] of Object.entries(groups)) for (const label of labels)
    items.set(clean(label),{label,category:group,keywords:label === '子どもあり' ? [label,'子供','こども','親子'] : [label]});
  for (const row of [...directory,...conversations]) for (const label of (row.profile_tags || row.tags || [])) {
    if (typeof label !== 'string' || !label.trim() || label.startsWith('#') || label.includes('@@')) continue;
    const key = clean(label);
    if (!items.has(key)) items.set(key,{label,category:isChildrenTag(label) ? 'family' : 'custom',keywords:[label]});
  }
  const selectedKeys = new Set(Array.from(selected,clean));
  const terms = clean(query).split(/\s+/).filter(Boolean);
  return [...items.values()].filter(item => !selectedKeys.has(clean(item.label)) && (category === 'all' || category === item.category)
    && terms.every(term => clean(item.keywords.join(' ')).includes(term)));
}
