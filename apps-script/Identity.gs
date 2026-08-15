function normalizeName_(value) {
  let text = String(value || '').normalize('NFKC');
  const replacements = { '髙': '高', '﨑': '崎', '濵': '浜', '邉': '辺', '邊': '辺', '國': '国' };
  text = Array.from(text).map(function (character) { return replacements[character] || character; }).join('');
  return text.replace(/[\s\u3000()（）・･.．]/g, '').toLowerCase();
}

function canonicalDisplayName_(value) {
  const normalized = String(value || '').normalize('NFKC').trim();
  return normalized.replace(/[\s\u3000]+/g, '');
}

function personSearchKeys_(person) {
  const values = [person.canonical_name, person.name_kana].concat(parseJsonArray_(person.aliases_json));
  return values.map(normalizeName_).filter(Boolean).filter(function (value, index, all) { return all.indexOf(value) === index; });
}

function findPersonCandidates_(printedName, people) {
  const key = normalizeName_(printedName);
  if (!key) return [];
  return people.filter(function (person) { return personSearchKeys_(person).indexOf(key) !== -1; });
}

function classifyNameMatch_(printedName, people) {
  const candidates = findPersonCandidates_(printedName, people);
  if (candidates.length === 1) return { matchType: 'exact_unique', candidatePersonId: String(candidates[0].person_id), candidates: candidates };
  if (candidates.length > 1) return { matchType: 'ambiguous', candidatePersonId: '', candidates: candidates };
  return { matchType: 'new_candidate', candidatePersonId: '', candidates: [] };
}
