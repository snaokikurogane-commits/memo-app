const config = window.PEOPLE_NOTEBOOK_CONFIG || {};
const tags = ['同期', '特に仲良し', 'ゴルフ', '車', 'マラソン', 'LINE', '雇用保険', '給付経験あり'];
const pageSize = 1000;
const state = {
  client: null,
  session: null,
  role: null,
  people: [],
  assignments: [],
  conversations: [],
  directory: [],
  person: null,
  selectedTags: new Set(),
  peopleLimit: 50,
  handlingSession: false
};

const byId = (id) => document.getElementById(id);

function configured() {
  return /^https:\/\/.+\.supabase\.co\/?$/.test(String(config.supabaseUrl || '')) &&
    String(config.supabaseAnonKey || '').length > 20;
}

function el(tagName, className, text) {
  const node = document.createElement(tagName);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function clear(node) { node.replaceChildren(); }

function showOnly(screenId) {
  ['setup-screen', 'auth-screen', 'denied-screen', 'app-screen'].forEach((id) => {
    byId(id).hidden = id !== screenId;
  });
}

function message(error) {
  if (!error) return '処理に失敗しました。';
  if (error.code === '42501') return 'データへのアクセス権がありません。';
  return error.message || String(error);
}

function toast(text, error = false) {
  const node = byId('toast');
  node.textContent = text;
  node.classList.toggle('error', error);
  node.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { node.hidden = true; }, 3600);
}

function normalize(value) {
  return String(value || '').normalize('NFKC').replace(/[\s\u3000()（）・･.．]/g, '').toLowerCase();
}

function fiscalNumber(value) {
  const result = String(value || '').match(/(\d+)/);
  return result ? Number(result[1]) : -1;
}

function compareFiscalYear(left, right) {
  return fiscalNumber(right.fiscal_year) - fiscalNumber(left.fiscal_year) ||
    String(right.fiscal_year).localeCompare(String(left.fiscal_year), 'ja');
}

function dateText(value) {
  if (!value) return '';
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
}

function assignmentText(assignment) {
  return assignment ? [assignment.organization, assignment.department, assignment.role].filter(Boolean).join(' / ') : '所属未登録';
}

function currentAssignment(assignments) {
  const active = assignments.filter((row) => row.verified_status !== 'superseded');
  const target = String(config.currentFiscalYear || '');
  return active.find((row) => row.fiscal_year === target) || active.sort(compareFiscalYear)[0] || null;
}

function personSearchText(person) {
  return normalize([
    person.canonical_name,
    person.name_kana,
    ...(Array.isArray(person.aliases) ? person.aliases : []),
    ...(Array.isArray(person.profile_tags) ? person.profile_tags : []),
    assignmentText(person.assignment)
  ].join(' '));
}

function personById(personId) {
  return state.directory.find((person) => person.person_id === personId) || null;
}

async function selectAll(table, columns, options = {}) {
  const rows = [];
  for (let start = 0; ; start += pageSize) {
    let query = state.client.from(table).select(columns).range(start, start + pageSize - 1);
    if (options.order) query = query.order(options.order, { ascending: options.ascending !== false });
    const { data, error } = await query;
    if (error) throw error;
    rows.push(...data);
    if (data.length < pageSize) return rows;
  }
}

async function loadDirectory() {
  byId('sync-state').textContent = '読み込み中…';
  const [people, assignments, conversations] = await Promise.all([
    selectAll('people', 'person_id,canonical_name,name_kana,aliases,profile_tags,active_status'),
    selectAll('assignments', 'assignment_id,person_id,fiscal_year,organization,department,role,verified_status'),
    selectAll('conversations', 'conversation_id,person_id,occurred_at,note,next_topic,follow_up_at,tags', { order: 'occurred_at', ascending: false })
  ]);
  state.people = people.filter((person) => person.active_status === 'active');
  state.assignments = assignments;
  state.conversations = conversations;
  const assignmentsByPerson = new Map();
  assignments.forEach((assignment) => {
    if (!assignmentsByPerson.has(assignment.person_id)) assignmentsByPerson.set(assignment.person_id, []);
    assignmentsByPerson.get(assignment.person_id).push(assignment);
  });
  const latestByPerson = new Map();
  conversations.forEach((conversation) => {
    if (!latestByPerson.has(conversation.person_id)) latestByPerson.set(conversation.person_id, conversation);
  });
  state.directory = state.people.map((person) => {
    const personAssignments = assignmentsByPerson.get(person.person_id) || [];
    return Object.assign({}, person, {
      assignments: personAssignments,
      assignment: currentAssignment(personAssignments),
      latestConversation: latestByPerson.get(person.person_id) || null
    });
  }).sort((a, b) => a.canonical_name.localeCompare(b.canonical_name, 'ja'));
  populateRosterFilters();
  renderAll();
  byId('sync-state').textContent = `更新 ${new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}`;
}

function personCard(person, context = null) {
  const button = el('button', 'person-card');
  button.type = 'button';
  const left = el('div');
  left.append(el('div', 'person-name', person.canonical_name));
  left.append(el('div', 'assignment', assignmentText(person.assignment)));
  const nextTopic = context && context.next_topic;
  if (nextTopic) left.append(el('div', 'next', `次に：${nextTopic}`));
  button.append(left, el('div', 'chevron', '›'));
  button.addEventListener('click', () => { openPerson(person.person_id); });
  return button;
}

function renderRows(target, rows, emptyText, contextFor = () => null) {
  clear(target);
  rows.forEach((row) => {
    const person = personById(row.person_id);
    if (person) target.append(personCard(person, contextFor(row)));
  });
  if (!target.childNodes.length) target.append(el('div', 'empty', emptyText));
}

function renderPeople() {
  const target = byId('people-list');
  const query = normalize(byId('search').value);
  const people = state.directory.filter((person) => personSearchText(person).includes(query));
  byId('people-count').textContent = `${people.length}人`;
  clear(target);
  people.slice(0, state.peopleLimit).forEach((person) => target.append(personCard(person, person.latestConversation)));
  if (!people.length) target.append(el('div', 'empty', '該当する人物がいません'));
  byId('load-more').hidden = people.length <= state.peopleLimit;
}

function renderFollowUps() {
  const today = new Date().toISOString().slice(0, 10);
  const rows = state.conversations.filter((conversation) => conversation.follow_up_at && conversation.follow_up_at <= today && conversation.next_topic)
    .sort((a, b) => String(a.follow_up_at).localeCompare(String(b.follow_up_at)));
  renderRows(byId('follow-up-list'), rows, '予定はありません', (row) => row);
}

function renderRecent() {
  renderRows(byId('recent-list'), state.conversations.slice(0, 50), '会話メモはまだありません', (row) => row);
}

function optionValues(rows, key) {
  return [...new Set(rows.map((row) => String(row[key] || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ja'));
}

function replaceOptions(select, values, initialLabel, preferred = '') {
  const previous = select.value || preferred;
  clear(select);
  select.append(new Option(initialLabel, ''));
  values.forEach((value) => select.append(new Option(value, value)));
  select.value = values.includes(previous) ? previous : '';
}

function populateRosterFilters() {
  const active = state.assignments.filter((row) => row.verified_status !== 'superseded');
  const years = optionValues(active, 'fiscal_year').sort((a, b) => fiscalNumber(b) - fiscalNumber(a));
  replaceOptions(byId('roster-year'), years, '全年度', String(config.currentFiscalYear || ''));
  replaceOptions(byId('roster-organization'), optionValues(active, 'organization'), '全所属');
  replaceOptions(byId('roster-department'), optionValues(active, 'department'), '全部門');
  replaceOptions(byId('roster-role'), optionValues(active, 'role'), '全役職');
}

function renderRoster() {
  const filters = {
    fiscal_year: byId('roster-year').value,
    organization: byId('roster-organization').value,
    department: byId('roster-department').value,
    role: byId('roster-role').value
  };
  const query = normalize(byId('roster-query').value);
  const rows = state.assignments.filter((assignment) => {
    if (assignment.verified_status === 'superseded') return false;
    if (Object.entries(filters).some(([key, value]) => value && assignment[key] !== value)) return false;
    const person = personById(assignment.person_id);
    return person && normalize([person.canonical_name, person.name_kana, assignmentText(assignment)].join(' ')).includes(query);
  }).sort(compareFiscalYear);
  const target = byId('roster-list');
  clear(target);
  rows.forEach((assignment) => {
    const person = personById(assignment.person_id);
    const card = personCard(Object.assign({}, person, { assignment }), null);
    target.append(card);
  });
  if (!rows.length) target.append(el('div', 'empty', '該当する所属はありません'));
  byId('roster-count').textContent = `${rows.length}件`;
}

function renderAll() {
  renderPeople();
  renderFollowUps();
  renderRecent();
  renderRoster();
}

function ageText(member) {
  if (member.birth_date) {
    const birth = new Date(`${member.birth_date}T00:00:00`);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age -= 1;
    return `${Math.max(0, age)}歳`;
  }
  if (Number.isInteger(member.observed_age) && member.observed_on) {
    const observed = new Date(`${member.observed_on}T00:00:00`);
    const today = new Date();
    let age = member.observed_age + today.getFullYear() - observed.getFullYear();
    if (today.getMonth() < observed.getMonth() || (today.getMonth() === observed.getMonth() && today.getDate() < observed.getDate())) age -= 1;
    return `推定 ${Math.max(0, age)}歳`;
  }
  return '年齢未登録';
}

function makeField(labelText, id, type, value = '') {
  const label = el('label');
  label.textContent = labelText;
  const input = document.createElement('input');
  input.id = id;
  input.type = type;
  input.value = value;
  label.append(input);
  return { label, input };
}

function renderDetail() {
  const detail = state.person;
  const target = byId('detail-body');
  clear(target);
  byId('detail-title').textContent = detail.person.canonical_name;
  const identity = el('section', 'card');
  identity.append(el('h1', '', detail.person.canonical_name), el('p', 'muted', detail.person.name_kana || 'ふりがな未登録'));
  target.append(identity);

  const assignmentCard = el('section', 'card');
  assignmentCard.append(el('h2', '', '所属履歴'));
  const timeline = el('div', 'timeline');
  detail.assignments.forEach((assignment) => {
    const item = el('div', 'timeline-item');
    item.append(el('strong', '', `${assignment.fiscal_year} · ${assignment.organization || '所属未登録'}`));
    item.append(el('div', 'muted', [assignment.department, assignment.role].filter(Boolean).join(' / ') || '役職未登録'));
    timeline.append(item);
  });
  if (!timeline.childNodes.length) timeline.append(el('div', 'empty', '所属履歴がありません'));
  assignmentCard.append(timeline);
  target.append(assignmentCard);

  const conversations = el('section', 'card');
  conversations.append(el('h2', '', '会話履歴'));
  detail.conversations.forEach((conversation) => {
    const card = el('article', 'conversation');
    card.append(el('time', '', dateText(conversation.occurred_at)), el('p', '', conversation.note));
    if (conversation.next_topic) card.append(el('div', 'next', `次に：${conversation.next_topic}`));
    conversations.append(card);
  });
  if (!detail.conversations.length) conversations.append(el('div', 'empty', '最初の会話メモを残しましょう'));
  target.append(conversations);

  const family = el('section', 'card');
  family.append(el('h2', '', '家族・子ども'));
  detail.familyMembers.forEach((member) => {
    const row = el('div', 'family-row');
    row.append(el('strong', '', member.display_name || member.relationship), el('span', 'pill', ageText(member)));
    family.append(row);
  });
  const form = el('div', 'family-form');
  const name = makeField('呼び名', 'family-name', 'text');
  const birth = makeField('生年月日', 'family-birth', 'date');
  const age = makeField('年齢（誕生日不明時）', 'family-age', 'number');
  const observed = makeField('確認日', 'family-observed', 'date', new Date().toISOString().slice(0, 10));
  const save = el('button', 'secondary wide', '子ども情報を追加');
  save.type = 'button';
  save.addEventListener('click', async () => {
    if (!birth.input.value && !(age.input.value && observed.input.value)) {
      toast('生年月日、または年齢と確認日を入力してください。', true);
      return;
    }
    save.disabled = true;
    try {
      const { data, error } = await state.client.from('family_members').insert({
        person_id: detail.person.person_id,
        relationship: 'child',
        display_name: name.input.value.trim(),
        birth_date: birth.input.value || null,
        observed_age: age.input.value ? Number(age.input.value) : null,
        observed_on: observed.input.value || null
      }).select().single();
      if (error) throw error;
      detail.familyMembers.push(data);
      renderDetail();
      toast('子ども情報を保存しました');
    } catch (error) {
      toast(message(error), true);
    } finally {
      save.disabled = false;
    }
  });
  form.append(name.label, birth.label, age.label, observed.label, save);
  family.append(form);
  target.append(family);
}

async function openPerson(personId) {
  byId('person-detail').hidden = false;
  document.body.style.overflow = 'hidden';
  byId('detail-body').replaceChildren(el('div', 'empty', '読み込み中…'));
  try {
    const [personResult, assignmentsResult, conversationsResult, eventsResult, familyResult] = await Promise.all([
      state.client.from('people').select('person_id,canonical_name,name_kana,aliases,profile_tags').eq('person_id', personId).single(),
      state.client.from('assignments').select('assignment_id,person_id,fiscal_year,organization,department,role,verified_status').eq('person_id', personId).order('fiscal_year', { ascending: false }),
      state.client.from('conversations').select('conversation_id,person_id,occurred_at,note,next_topic,follow_up_at,tags').eq('person_id', personId).order('occurred_at', { ascending: false }),
      state.client.from('events').select('event_id,person_id,event_type,event_date,note,repeat_yearly').eq('person_id', personId).order('event_date', { ascending: false }),
      state.client.from('family_members').select('family_member_id,person_id,relationship,display_name,birth_date,observed_age,observed_on,note').eq('person_id', personId).order('created_at', { ascending: false })
    ]);
    const error = [personResult, assignmentsResult, conversationsResult, eventsResult, familyResult].find((result) => result.error)?.error;
    if (error) throw error;
    state.person = {
      person: personResult.data,
      assignments: assignmentsResult.data.sort(compareFiscalYear),
      conversations: conversationsResult.data,
      events: eventsResult.data,
      familyMembers: familyResult.data
    };
    renderDetail();
  } catch (error) {
    toast(message(error), true);
    closeDetail();
  }
}

function closeDetail() {
  byId('person-detail').hidden = true;
  byId('composer').hidden = true;
  document.body.style.overflow = '';
  state.person = null;
  resetComposer();
}

function renderTags() {
  const target = byId('tag-list');
  clear(target);
  tags.forEach((tag) => {
    const button = el('button', `tag${state.selectedTags.has(tag) ? ' selected' : ''}`, tag);
    button.type = 'button';
    button.addEventListener('click', () => {
      state.selectedTags.has(tag) ? state.selectedTags.delete(tag) : state.selectedTags.add(tag);
      renderTags();
    });
    target.append(button);
  });
}

function resetComposer() {
  byId('conversation-form').reset();
  state.selectedTags.clear();
  renderTags();
}

function openComposer() {
  if (!state.person) return;
  byId('composer').hidden = false;
  setTimeout(() => { byId('conversation-note').focus(); }, 0);
}

function closeComposer() {
  byId('composer').hidden = true;
  resetComposer();
}

async function saveConversation(event) {
  event.preventDefault();
  if (!state.person) return;
  const note = byId('conversation-note').value.trim();
  const nextTopic = byId('next-topic').value.trim();
  if (!note && !nextTopic) {
    toast('今日のメモまたは次に聞くことを入力してください。', true);
    return;
  }
  const button = byId('save-conversation');
  button.disabled = true;
  button.textContent = '保存中…';
  try {
    const { data, error } = await state.client.from('conversations').insert({
      person_id: state.person.person.person_id,
      occurred_at: new Date().toISOString(),
      note,
      next_topic: nextTopic,
      follow_up_at: byId('follow-up-at').value || null,
      tags: [...state.selectedTags]
    }).select().single();
    if (error) throw error;
    state.person.conversations.unshift(data);
    closeComposer();
    renderDetail();
    toast('会話メモを保存しました');
    await loadDirectory();
  } catch (error) {
    toast(message(error), true);
  } finally {
    button.disabled = false;
    button.textContent = '保存して履歴に戻る';
  }
}

function switchView(view) {
  document.querySelectorAll('.view').forEach((node) => { node.hidden = node.id !== `view-${view}`; });
  document.querySelectorAll('#navigation button').forEach((node) => { node.classList.toggle('active', node.dataset.view === view); });
}

async function signIn() {
  byId('auth-message').textContent = 'Googleログインへ移動します…';
  const { error } = await state.client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      // OAuth callback must never include a previous access-token fragment.
      redirectTo: `${window.location.origin}${window.location.pathname}`
    }
  });
  if (error) byId('auth-message').textContent = message(error);
}

async function signOut() {
  const { error } = await state.client.auth.signOut();
  if (error) toast(message(error), true);
  state.session = null;
  state.role = null;
  showOnly('auth-screen');
}

async function handleSession(session) {
  if (state.handlingSession) return;
  state.handlingSession = true;
  try {
    if (!session) {
      state.session = null;
      state.role = null;
      showOnly('auth-screen');
      return;
    }
    state.session = session;
    const { data, error } = await state.client.from('app_members').select('role,active').eq('user_id', session.user.id).maybeSingle();
    if (error) throw error;
    if (!data || !data.active) {
      showOnly('denied-screen');
      return;
    }
    state.role = data.role;
    showOnly('app-screen');
    await loadDirectory();
  } catch (error) {
    showOnly('auth-screen');
    byId('auth-message').textContent = message(error);
  } finally {
    state.handlingSession = false;
  }
}

function bindEvents() {
  byId('sign-in').addEventListener('click', signIn);
  byId('sign-out').addEventListener('click', signOut);
  byId('denied-sign-out').addEventListener('click', signOut);
  byId('search').addEventListener('input', () => { state.peopleLimit = 50; renderPeople(); });
  byId('load-more').addEventListener('click', () => { state.peopleLimit += 50; renderPeople(); });
  byId('navigation').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-view]');
    if (button) switchView(button.dataset.view);
  });
  ['roster-year', 'roster-organization', 'roster-department', 'roster-role', 'roster-query'].forEach((id) => {
    byId(id).addEventListener(id === 'roster-query' ? 'input' : 'change', renderRoster);
  });
  byId('detail-close').addEventListener('click', closeDetail);
  byId('composer-open').addEventListener('click', openComposer);
  byId('composer-close').addEventListener('click', closeComposer);
  byId('conversation-form').addEventListener('submit', saveConversation);
}

async function boot() {
  if (!configured()) {
    showOnly('setup-screen');
    return;
  }
  let createClient;
  try {
    ({ createClient } = await import('https://esm.sh/@supabase/supabase-js@2'));
  } catch (error) {
    showOnly('auth-screen');
    byId('auth-message').textContent = `Supabase接続用ライブラリを読み込めませんでした。${message(error)}`;
    return;
  }
  state.client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { persistSession: true, detectSessionInUrl: true }
  });
  bindEvents();
  renderTags();
  const { data, error } = await state.client.auth.getSession();
  if (error) {
    showOnly('auth-screen');
    byId('auth-message').textContent = message(error);
    return;
  }
  await handleSession(data.session);
  // Do not leave access_token/refresh_token in the address bar. Leaving the
  // fragment there causes a later sign-in attempt to append another fragment.
  if (window.location.hash || new URL(window.location.href).searchParams.has('code')) {
    window.history.replaceState({}, document.title, `${window.location.origin}${window.location.pathname}`);
  }
  state.client.auth.onAuthStateChange((_event, session) => { handleSession(session); });
}

boot();
