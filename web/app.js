const config = window.PEOPLE_NOTEBOOK_CONFIG || {};
const tags = [
  "同期",
  "特に仲良し",
  "ゴルフ",
  "車",
  "マラソン",
  "LINE",
  "雇用保険",
  "給付経験あり",
];
const standardTopics = [
  {
    id: "standard-work-start",
    category: "仕事",
    question: "今の仕事を始めたきっかけは何ですか？",
    opening: "そういえば、今のお仕事を始めたきっかけって…",
    recommended: true,
    relationships: ["work", "friend", "community", "other"],
  },
  {
    id: "standard-work-fun",
    category: "仕事",
    question: "今の仕事で、面白いと感じるのはどんな時ですか？",
    opening: "最近、お仕事はどうですか？",
    recommended: true,
    relationships: ["work", "friend"],
  },
  {
    id: "standard-work-change",
    category: "仕事",
    question: "仕事で今、変えたいと思っていることはありますか？",
    opening: "今の仕事で、もう少しこうなったらいいなと思うことって…",
    relationships: ["work"],
    sensitivity: "personal",
  },
  {
    id: "standard-weekend",
    category: "休日",
    question: "休日はどう過ごすことが多いですか？",
    opening: "最近、少しゆっくりできていますか？",
    recommended: true,
    relationships: ["work", "friend", "community", "other"],
  },
  {
    id: "standard-looking-forward",
    category: "近況",
    question: "最近、楽しみにしていることはありますか？",
    opening: "最近、何か楽しみにしていることってありますか？",
    recommended: true,
    relationships: ["work", "friend", "community", "other"],
  },
  {
    id: "standard-local-reason",
    category: "地元",
    question: "この地域に来たきっかけは何ですか？",
    opening: "こちらには長いんですか？",
    relationships: ["work", "friend", "community", "other"],
  },
  {
    id: "standard-local-food",
    category: "地元",
    question: "地元に帰ると、つい食べたくなるものはありますか？",
    opening: "ご出身の地域では、どんな食べ物が有名ですか？",
    recommended: true,
    relationships: ["work", "friend", "community"],
  },
  {
    id: "standard-hobby",
    category: "趣味",
    question: "最近、時間を忘れて楽しめることはありますか？",
    opening: "お休みの日は、何をしている時が一番楽しいですか？",
    recommended: true,
    relationships: ["work", "friend", "community", "other"],
  },
  {
    id: "standard-golf",
    category: "趣味",
    question: "最近もゴルフに行っていますか？",
    opening: "前にゴルフのお話をしていましたよね。",
    recommended: true,
    relationships: ["work", "friend"],
    requiredTags: ["ゴルフ"],
  },
  {
    id: "standard-food",
    category: "食べ物",
    question: "最近、また行きたいと思ったお店はありますか？",
    opening: "最近どこかで、おいしいものを食べましたか？",
    relationships: ["work", "friend", "community", "other"],
  },
  {
    id: "standard-travel",
    category: "旅行",
    question: "最近行ってよかった場所はありますか？",
    opening: "最近どこかへ出かけましたか？",
    recommended: true,
    relationships: ["work", "friend", "community", "other"],
  },
  {
    id: "standard-future",
    category: "これから",
    question: "これからやってみたいことはありますか？",
    opening: "今後、やってみたいと思っていることってありますか？",
    relationships: ["friend", "community", "other"],
  },
];
const pageSize = 1000;
const topicPageSize = 24;
const cardStyles = [
  { id: "mist", label: "朝もや" },
  { id: "watercolor", label: "にじみ水彩" },
  { id: "sunset", label: "夕暮れシティ" },
  { id: "orb", label: "くすみオーブ" },
  { id: "spring", label: "春霞" },
  { id: "summer", label: "夏空" },
  { id: "autumn", label: "秋の余白" },
  { id: "winter", label: "冬明かり" },
  { id: "plain", label: "無地" },
];
const iconStyles = [
  { id: "none", label: "なし" },
  { id: "person", label: "人物" },
  { id: "coffee", label: "コーヒー" },
  { id: "book", label: "本" },
  { id: "music", label: "音楽" },
  { id: "walk", label: "散歩" },
  { id: "work", label: "仕事" },
  { id: "home", label: "家族" },
  { id: "car", label: "車" },
];
const iconFrames = [
  { id: "paper", label: "紙ラベル" },
  { id: "glass", label: "すりガラス" },
];
let topicLibraryCache = null;
const state = {
  client: null,
  session: null,
  role: null,
  people: [],
  assignments: [],
  conversations: [],
  followUps: [],
  directory: [],
  person: null,
  selectedTags: new Set(),
  selectedFollowUpIds: new Set(),
  followUpSelectionMode: false,
  selectedTopicIds: new Set(),
  expandedTopicIds: new Set(),
  topicPickerTab: "recommended",
  topicRelationship: "work",
  topicCategory: "all",
  topicQuery: "",
  topicLimit: topicPageSize,
  peopleLimit: 50,
  expandedFollowUps: false,
  expandedConversations: false,
  followUpAddOpen: false,
  cardFieldsAvailable: true,
  editorMode: "create",
  editorPersonId: null,
  selectedCardStyle: "mist",
  selectedIconStyle: "none",
  selectedIconFrame: "paper",
  handlingSession: false,
};

const byId = (id) => document.getElementById(id);

function configured() {
  return (
    /^https:\/\/.+\.supabase\.co\/?$/.test(String(config.supabaseUrl || "")) &&
    String(config.supabaseAnonKey || "").length > 20
  );
}

function el(tagName, className, text) {
  const node = document.createElement(tagName);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function canEditPeople() {
  return state.role === "owner" || state.role === "editor";
}

function svgIcon(name, className = "") {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  if (className) svg.setAttribute("class", className);
  const definitions = {
    person: ["circle:12,8,3", "path:M6 20c.7-4 3-6 6-6s5.3 2 6 6"],
    coffee: ["path:M5 8h11v6a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5z", "path:M16 10h2a2 2 0 0 1 0 4h-2", "path:M8 5c0-1 1-1 1-2", "path:M12 5c0-1 1-1 1-2"],
    book: ["path:M4 5.5A3.5 3.5 0 0 1 7.5 2H11v17H7.5A3.5 3.5 0 0 0 4 22z", "path:M20 5.5A3.5 3.5 0 0 0 16.5 2H13v17h3.5A3.5 3.5 0 0 1 20 22z"],
    music: ["path:M9 18V5l10-2v13", "circle:6,18,3", "circle:16,16,3"],
    walk: ["circle:13,4,2", "path:M11 8l-2 5 4 2 2 6", "path:M11 9l4 3 3-1", "path:M9 13l-4 6"],
    work: ["rect:4,7,16,13,2", "path:M9 7V4h6v3", "path:M4 12h16", "path:M10 12v2h4v-2"],
    home: ["path:M3 11l9-8 9 8", "path:M5 10v11h14V10", "path:M9 21v-7h6v7"],
    car: ["path:M4 16l1-6 3-4h8l3 4 1 6v3h-2v-2H6v2H4z", "path:M6 10h12", "circle:8,15,1", "circle:16,15,1"],
  };
  (definitions[name] || definitions.person).forEach((item) => {
    const [kind, value] = item.split(":");
    let node;
    if (kind === "circle") {
      const [cx, cy, r] = value.split(",");
      node = document.createElementNS(svg.namespaceURI, "circle");
      node.setAttribute("cx", cx);
      node.setAttribute("cy", cy);
      node.setAttribute("r", r);
    } else if (kind === "rect") {
      const [x, y, width, height, rx] = value.split(",");
      node = document.createElementNS(svg.namespaceURI, "rect");
      node.setAttribute("x", x);
      node.setAttribute("y", y);
      node.setAttribute("width", width);
      node.setAttribute("height", height);
      node.setAttribute("rx", rx);
    } else {
      node = document.createElementNS(svg.namespaceURI, "path");
      node.setAttribute("d", value);
    }
    node.setAttribute("fill", "none");
    node.setAttribute("stroke", "currentColor");
    node.setAttribute("stroke-width", "1.8");
    node.setAttribute("stroke-linecap", "round");
    node.setAttribute("stroke-linejoin", "round");
    svg.append(node);
  });
  return svg;
}

function clear(node) {
  node.replaceChildren();
}

function showOnly(screenId) {
  ["setup-screen", "auth-screen", "denied-screen", "app-screen"].forEach(
    (id) => {
      byId(id).hidden = id !== screenId;
    },
  );
}

function message(error) {
  if (!error) return "処理に失敗しました。";
  if (error.code === "42501") return "データへのアクセス権がありません。";
  return error.message || String(error);
}

function toast(text, error = false, action = null) {
  const node = byId("toast");
  node.replaceChildren(el("span", "toast-message", text));
  node.classList.toggle("error", error);
  node.classList.toggle("has-action", Boolean(action));
  if (action) {
    const button = el("button", "toast-action", action.label || "元に戻す");
    button.type = "button";
    button.addEventListener("click", async () => {
      clearTimeout(toast.timer);
      button.disabled = true;
      node.hidden = true;
      await action.onClick();
    });
    node.append(button);
  }
  node.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => {
    node.hidden = true;
  }, action ? 6500 : 3600);
}

function normalize(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[\s\u3000()（）・･.．]/g, "")
    .toLowerCase();
}

function fiscalNumber(value) {
  const result = String(value || "").match(/(\d+)/);
  return result ? Number(result[1]) : -1;
}

function compareFiscalYear(left, right) {
  return (
    fiscalNumber(right.fiscal_year) - fiscalNumber(left.fiscal_year) ||
    String(right.fiscal_year).localeCompare(String(left.fiscal_year), "ja")
  );
}

function dateText(value) {
  if (!value) return "";
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function topicText(value) {
  return String(value || "").trim();
}

function normalizeTopic(topic, index) {
  const builtIn = String(topic.id || "").startsWith("standard-");
  const question = topicText(
    topic.question ?? topic.firstPhrase ?? topic.first ?? topic.title,
  );
  if (!question) return null;
  const sourceTag = topicText(topic.category ?? topic.tag) || "その他";
  const context = topicText(topic.context);
  return {
    id: topicText(topic.id) || `external-topic-${index}`,
    category: topicGroup(sourceTag),
    sourceTag,
    month: topicText(topic.month) || "日常",
    title: topicText(topic.title) || question,
    question,
    opening: topicText(
      topic.opening ?? topic.secondPhrase ?? topic.second ?? topic.origin,
    ),
    exitPhrase: topicText(topic.exitPhrase),
    keywords: Array.isArray(topic.keywords) ? topic.keywords : [],
    recommended: builtIn || topic.recommended === true,
    builtIn,
    relationships: Array.isArray(topic.relationships)
      ? topic.relationships
      : context === "work"
        ? ["work"]
        : context === "social"
          ? ["friend", "community", "other"]
          : context === "close"
            ? ["friend", "other"]
            : ["work", "friend", "community", "other"],
    sensitivity: topicText(topic.sensitivity) || "low",
    requiredTags: Array.isArray(topic.requiredTags) ? topic.requiredTags : [],
  };
}

function topicGroup(value) {
  const tag = topicText(value);
  if (/職場|仕事|キャリア/.test(tag)) return "仕事";
  if (/食|グルメ|料理/.test(tag)) return "食べ物";
  if (/ノスタルジ|学生|青春|思い出|世代|あの頃|\d+代/.test(tag))
    return "思い出";
  if (/恋愛|友人|知人|ママ友|地域|地元|家族/.test(tag))
    return "人間関係";
  if (/究極|二択|If|ゲーム/.test(tag)) return "遊び";
  if (/旅行|おでかけ|自然|季節/.test(tag)) return "おでかけ";
  if (/趣味|音楽|映画|本|スポーツ/.test(tag)) return "趣味";
  if (/共通|日常|ライフ|近況|休日|これから/.test(tag)) return "日常";
  return tag || "その他";
}

function topicLibrary() {
  if (topicLibraryCache) return topicLibraryCache;
  const supplied = Array.isArray(window.PEOPLE_NOTEBOOK_TOPICS)
    ? window.PEOPLE_NOTEBOOK_TOPICS
    : [];
  const topics = [...standardTopics, ...supplied]
    .map(normalizeTopic)
    .filter(Boolean)
    .filter((topic) => topic.sensitivity !== "high");
  const unique = new Map();
  topics.forEach((topic) => {
    const key = normalize(topic.question);
    if (key && !unique.has(key)) unique.set(key, topic);
  });
  topicLibraryCache = [...unique.values()];
  return topicLibraryCache;
}

function profileTagSet() {
  return new Set(
    Array.isArray(state.person?.person?.profile_tags)
      ? state.person.person.profile_tags
      : [],
  );
}

function topicMatchesProfile(topic) {
  if (!topic.requiredTags.length) return true;
  const profileTags = profileTagSet();
  return topic.requiredTags.some((tag) => profileTags.has(tag));
}

function topicSearchText(topic) {
  return normalize(
    [
      topic.category,
      topic.sourceTag,
      topic.month,
      topic.title,
      topic.question,
      topic.opening,
      topic.exitPhrase,
      ...topic.keywords,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function cardStyleId(person) {
  const value = String(person?.card_style || "mist");
  return cardStyles.some((style) => style.id === value) ? value : "mist";
}

function iconStyleId(person) {
  const value = String(person?.icon_style || "none");
  return iconStyles.some((style) => style.id === value) ? value : "none";
}

function iconFrameId(person) {
  const value = String(person?.icon_frame || "paper");
  return iconFrames.some((frame) => frame.id === value) ? value : "paper";
}

function assignmentText(assignment) {
  return assignment
    ? [assignment.organization, assignment.department, assignment.role]
        .filter(Boolean)
        .join(" / ")
    : "所属未登録";
}

function currentAssignment(assignments) {
  const active = assignments.filter(
    (row) => row.verified_status !== "superseded",
  );
  const target = String(config.currentFiscalYear || "");
  return (
    active.find((row) => row.fiscal_year === target) ||
    active.sort(compareFiscalYear)[0] ||
    null
  );
}

function personSearchText(person) {
  return normalize(
    [
      person.canonical_name,
      person.name_kana,
      ...(Array.isArray(person.aliases) ? person.aliases : []),
      ...(Array.isArray(person.profile_tags) ? person.profile_tags : []),
      assignmentText(person.assignment),
    ].join(" "),
  );
}

function personById(personId) {
  return (
    state.directory.find((person) => person.person_id === personId) || null
  );
}

async function selectAll(table, columns, options = {}) {
  const rows = [];
  for (let start = 0; ; start += pageSize) {
    let query = state.client
      .from(table)
      .select(columns)
      .range(start, start + pageSize - 1);
    if (options.order)
      query = query.order(options.order, {
        ascending: options.ascending !== false,
      });
    const { data, error } = await query;
    if (error) throw error;
    rows.push(...data);
    if (data.length < pageSize) return rows;
  }
}

function missingCardFields(error) {
  const text = `${error?.code || ""} ${error?.message || ""}`;
  return (
    /42703|PGRST204/.test(text) ||
    /card_style|icon_style|icon_frame/i.test(text)
  );
}

async function selectPeople() {
  const base =
    "person_id,canonical_name,name_kana,aliases,profile_tags,active_status";
  try {
    const rows = await selectAll(
      "people",
      `${base},card_style,icon_style,icon_frame`,
    );
    state.cardFieldsAvailable = true;
    return rows;
  } catch (error) {
    if (!missingCardFields(error)) throw error;
    state.cardFieldsAvailable = false;
    return selectAll("people", base);
  }
}

async function selectPerson(personId) {
  const base =
    "person_id,canonical_name,name_kana,aliases,profile_tags,active_status";
  let result = await state.client
    .from("people")
    .select(`${base},card_style,icon_style,icon_frame`)
    .eq("person_id", personId)
    .single();
  if (result.error && missingCardFields(result.error)) {
    state.cardFieldsAvailable = false;
    result = await state.client
      .from("people")
      .select(base)
      .eq("person_id", personId)
      .single();
  }
  return result;
}

async function loadDirectory() {
  byId("sync-state").textContent = "読み込み中…";
  const [people, assignments, conversations, followUps] = await Promise.all([
    selectPeople(),
    selectAll(
      "assignments",
      "assignment_id,person_id,fiscal_year,organization,department,role,verified_status",
    ),
    selectAll(
      "conversations",
      "conversation_id,person_id,occurred_at,note,next_topic,follow_up_at,tags",
      { order: "occurred_at", ascending: false },
    ),
    selectAll(
      "follow_up_items",
      "follow_up_id,person_id,body,due_at,status,completed_at,created_at",
      { order: "created_at", ascending: false },
    ),
  ]);
  state.people = people.filter((person) => person.active_status === "active");
  state.assignments = assignments;
  state.conversations = conversations;
  state.followUps = followUps;
  const assignmentsByPerson = new Map();
  assignments.forEach((assignment) => {
    if (!assignmentsByPerson.has(assignment.person_id))
      assignmentsByPerson.set(assignment.person_id, []);
    assignmentsByPerson.get(assignment.person_id).push(assignment);
  });
  const latestByPerson = new Map();
  conversations.forEach((conversation) => {
    if (!latestByPerson.has(conversation.person_id))
      latestByPerson.set(conversation.person_id, conversation);
  });
  state.directory = state.people
    .map((person) => {
      const personAssignments = assignmentsByPerson.get(person.person_id) || [];
      return Object.assign({}, person, {
        assignments: personAssignments,
        assignment: currentAssignment(personAssignments),
        latestConversation: latestByPerson.get(person.person_id) || null,
      });
    })
    .sort((a, b) => a.canonical_name.localeCompare(b.canonical_name, "ja"));
  populateRosterFilters();
  renderAll();
  byId("sync-state").textContent =
    `更新 ${new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}`;
}

function personCard(person, context = null) {
  const button = el(
    "button",
    `person-card card-style-${cardStyleId(person)}`,
  );
  button.type = "button";
  const left = el("div");
  left.append(el("div", "person-name", person.canonical_name));
  left.append(el("div", "assignment", assignmentText(person.assignment)));
  const nextTopic = context && context.next_topic;
  if (nextTopic) left.append(el("div", "next", `次に：${nextTopic}`));
  button.append(left, el("div", "chevron", "›"));
  button.addEventListener("click", () => {
    openPerson(person.person_id);
  });
  return button;
}

function renderRows(target, rows, emptyText, contextFor = () => null) {
  clear(target);
  rows.forEach((row) => {
    const person = personById(row.person_id);
    if (person) target.append(personCard(person, contextFor(row)));
  });
  if (!target.childNodes.length) target.append(el("div", "empty", emptyText));
}

function renderPeople() {
  const target = byId("people-list");
  const query = normalize(byId("search").value);
  const people = state.directory.filter((person) =>
    personSearchText(person).includes(query),
  );
  byId("people-count").textContent = `${people.length}人`;
  clear(target);
  people
    .slice(0, state.peopleLimit)
    .forEach((person) =>
      target.append(personCard(person, person.latestConversation)),
    );
  if (!people.length)
    target.append(el("div", "empty", "該当する人物がいません"));
  byId("load-more").hidden = people.length <= state.peopleLimit;
}

function followUpSort(left, right) {
  return (
    String(left.due_at || "9999-12-31").localeCompare(
      String(right.due_at || "9999-12-31"),
    ) || String(right.created_at).localeCompare(String(left.created_at))
  );
}

function followUpCard(item, showPerson = false, selectable = false) {
  const card = el(
    "article",
    `follow-up-item${selectable ? " selectable" : ""}`,
  );
  const copy = el("div", "follow-up-copy");
  if (showPerson) {
    const person = personById(item.person_id);
    const personButton = el(
      "button",
      "follow-up-person",
      person ? person.canonical_name : "人物不明",
    );
    personButton.type = "button";
    personButton.addEventListener("click", () => {
      if (person) openPerson(person.person_id);
    });
    copy.append(personButton);
  }
  copy.append(el("div", "follow-up-body", item.body));
  if (item.due_at) {
    copy.append(
      el("div", "follow-up-date", `次回目安：${dateText(item.due_at)}`),
    );
  }

  if (selectable) {
    const select = document.createElement("input");
    select.type = "checkbox";
    select.className = "follow-up-select";
    select.checked = state.selectedFollowUpIds.has(item.follow_up_id);
    select.setAttribute("aria-label", `「${item.body}」を選択`);
    select.addEventListener("change", () => {
      if (select.checked) state.selectedFollowUpIds.add(item.follow_up_id);
      else state.selectedFollowUpIds.delete(item.follow_up_id);
      renderDetail();
    });
    card.append(select, copy);
    return card;
  }

  if (!canEditPeople()) {
    card.append(copy);
    return card;
  }

  const actions = el("div", "item-actions");
  const done = el("button", "complete-button", "聞いた");
  done.type = "button";
  done.addEventListener("click", () => completeFollowUp(item));
  const remove = el("button", "delete-button", "削除");
  remove.type = "button";
  remove.addEventListener("click", () => deleteFollowUp(item));
  actions.append(done, remove);
  card.append(copy, actions);
  return card;
}

function renderFollowUps() {
  const target = byId("follow-up-list");
  clear(target);
  state.followUps
    .filter((item) => item.status === "open")
    .sort(followUpSort)
    .forEach((item) => target.append(followUpCard(item, true)));
  if (!target.childNodes.length)
    target.append(el("div", "empty", "次に聞くことはありません"));
}

function renderRecent() {
  renderRows(
    byId("recent-list"),
    state.conversations.slice(0, 50),
    "会話メモはまだありません",
    (row) => row,
  );
}

function optionValues(rows, key) {
  return [
    ...new Set(
      rows.map((row) => String(row[key] || "").trim()).filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b, "ja"));
}

function replaceOptions(select, values, initialLabel, preferred = "") {
  const previous = select.value || preferred;
  clear(select);
  select.append(new Option(initialLabel, ""));
  values.forEach((value) => select.append(new Option(value, value)));
  select.value = values.includes(previous) ? previous : "";
}

function populateRosterFilters() {
  const active = state.assignments.filter(
    (row) => row.verified_status !== "superseded",
  );
  const years = optionValues(active, "fiscal_year").sort(
    (a, b) => fiscalNumber(b) - fiscalNumber(a),
  );
  replaceOptions(
    byId("roster-year"),
    years,
    "全年度",
    String(config.currentFiscalYear || ""),
  );
  replaceOptions(
    byId("roster-organization"),
    optionValues(active, "organization"),
    "全所属",
  );
  replaceOptions(
    byId("roster-department"),
    optionValues(active, "department"),
    "全部門",
  );
  replaceOptions(byId("roster-role"), optionValues(active, "role"), "全役職");
}

function renderRoster() {
  const filters = {
    fiscal_year: byId("roster-year").value,
    organization: byId("roster-organization").value,
    department: byId("roster-department").value,
    role: byId("roster-role").value,
  };
  const query = normalize(byId("roster-query").value);
  const rows = state.assignments
    .filter((assignment) => {
      if (assignment.verified_status === "superseded") return false;
      if (
        Object.entries(filters).some(
          ([key, value]) => value && assignment[key] !== value,
        )
      )
        return false;
      const person = personById(assignment.person_id);
      return (
        person &&
        normalize(
          [
            person.canonical_name,
            person.name_kana,
            assignmentText(assignment),
          ].join(" "),
        ).includes(query)
      );
    })
    .sort(compareFiscalYear);
  const target = byId("roster-list");
  clear(target);
  rows.forEach((assignment) => {
    const person = personById(assignment.person_id);
    const card = personCard(Object.assign({}, person, { assignment }), null);
    target.append(card);
  });
  if (!rows.length)
    target.append(el("div", "empty", "該当する所属はありません"));
  byId("roster-count").textContent = `${rows.length}件`;
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
    if (
      today.getMonth() < birth.getMonth() ||
      (today.getMonth() === birth.getMonth() &&
        today.getDate() < birth.getDate())
    )
      age -= 1;
    return `${Math.max(0, age)}歳`;
  }
  if (Number.isInteger(member.observed_age) && member.observed_on) {
    const observed = new Date(`${member.observed_on}T00:00:00`);
    const today = new Date();
    let age =
      member.observed_age + today.getFullYear() - observed.getFullYear();
    if (
      today.getMonth() < observed.getMonth() ||
      (today.getMonth() === observed.getMonth() &&
        today.getDate() < observed.getDate())
    )
      age -= 1;
    return `推定 ${Math.max(0, age)}歳`;
  }
  return "年齢未登録";
}

function makeField(labelText, id, type, value = "") {
  const label = el("label");
  label.textContent = labelText;
  const input = document.createElement("input");
  input.id = id;
  input.type = type;
  input.value = value;
  label.append(input);
  return { label, input };
}

function identityCard(detail) {
  const person = detail.person;
  const style = cardStyleId(person);
  const icon = iconStyleId(person);
  const frame = iconFrameId(person);
  const identity = el(
    "section",
    `card identity-card card-style-${style}`,
  );
  const top = el("div", "identity-topline");
  top.append(
    el("span", "identity-label", "人物カード"),
    el(
      "span",
      "identity-style-name",
      cardStyles.find((item) => item.id === style)?.label || "朝もや",
    ),
  );
  identity.append(top, el("div", "card-skyline"));

  const panel = el("div", `identity-panel frame-${frame}`);
  if (icon !== "none") {
    const iconFrame = el("div", `identity-icon frame-${frame}`);
    iconFrame.append(svgIcon(icon));
    panel.append(iconFrame);
  }
  const copy = el("div", "identity-copy");
  copy.append(el("h1", "", person.canonical_name));
  const latestAssignment = currentAssignment(detail.assignments);
  copy.append(
    el(
      "div",
      "identity-assignment",
      latestAssignment
        ? [
            latestAssignment.organization,
            latestAssignment.department,
            latestAssignment.role,
          ]
            .filter(Boolean)
            .join(" / ")
        : "所属未登録",
    ),
  );
  const profileTags = Array.isArray(person.profile_tags)
    ? person.profile_tags.filter(Boolean)
    : [];
  if (profileTags.length) {
    const tagRow = el("div", "identity-tags");
    profileTags
      .slice(0, 2)
      .forEach((tag) => tagRow.append(el("span", "identity-tag", tag)));
    if (profileTags.length > 2) {
      tagRow.append(el("span", "identity-tag more-tag", `＋${profileTags.length - 2}`));
    }
    copy.append(tagRow);
  }
  panel.append(copy);
  identity.append(panel);
  return identity;
}

function detailSectionButton(text, onClick) {
  const button = el("button", "quiet-button compact-button", text);
  button.type = "button";
  button.addEventListener("click", onClick);
  return button;
}

function renderProfileDetails(detail) {
  const details = el("details", "card profile-details");
  const summary = el("summary");
  const summaryCopy = el("span");
  summaryCopy.append(
    el("strong", "", "プロフィール詳細"),
    el("small", "", "所属履歴・家族情報"),
  );
  summary.append(summaryCopy, el("span", "summary-chevron", "⌄"));
  details.append(summary);

  const content = el("div", "profile-details-content");
  const assignmentSection = el("section", "profile-subsection");
  assignmentSection.append(el("h3", "", "所属履歴"));
  const timeline = el("div", "timeline");
  detail.assignments.forEach((assignment) => {
    const item = el("div", "timeline-item");
    item.append(
      el(
        "strong",
        "",
        `${assignment.fiscal_year} · ${assignment.organization || "所属未登録"}`,
      ),
      el(
        "div",
        "muted",
        [assignment.department, assignment.role].filter(Boolean).join(" / ") ||
          "役職未登録",
      ),
    );
    timeline.append(item);
  });
  if (!timeline.childNodes.length) {
    timeline.append(el("div", "empty", "所属履歴がありません"));
  }
  assignmentSection.append(timeline);
  content.append(assignmentSection);

  const family = el("section", "profile-subsection family-section");
  family.append(el("h3", "", "家族・子ども"));
  detail.familyMembers.forEach((member) => {
    const row = el("div", "family-row");
    row.append(
      el("strong", "", member.display_name || member.relationship),
      el("span", "pill", ageText(member)),
    );
    family.append(row);
  });
  if (!detail.familyMembers.length) {
    family.append(el("div", "empty compact-empty", "家族情報は未登録です"));
  }
  if (canEditPeople()) {
    const form = el("div", "family-form");
    const name = makeField("呼び名", "family-name", "text");
    const birth = makeField("生年月日", "family-birth", "date");
    const age = makeField("年齢（誕生日不明時）", "family-age", "number");
    const observed = makeField(
      "確認日",
      "family-observed",
      "date",
      new Date().toISOString().slice(0, 10),
    );
    const save = el("button", "secondary wide", "子ども情報を追加");
    save.type = "button";
    save.addEventListener("click", async () => {
      if (!birth.input.value && !(age.input.value && observed.input.value)) {
        toast("生年月日、または年齢と確認日を入力してください。", true);
        return;
      }
      save.disabled = true;
      try {
        const { data, error } = await state.client
          .from("family_members")
          .insert({
            person_id: detail.person.person_id,
            relationship: "child",
            display_name: name.input.value.trim(),
            birth_date: birth.input.value || null,
            observed_age: age.input.value ? Number(age.input.value) : null,
            observed_on: observed.input.value || null,
          })
          .select()
          .single();
        if (error) throw error;
        detail.familyMembers.push(data);
        renderDetail();
        toast("子ども情報を保存しました");
      } catch (error) {
        toast(message(error), true);
      } finally {
        save.disabled = false;
      }
    });
    form.append(name.label, birth.label, age.label, observed.label, save);
    family.append(form);
  }
  content.append(family);
  details.append(content);
  return details;
}

function renderDetail() {
  const detail = state.person;
  if (!detail) return;
  const target = byId("detail-body");
  clear(target);
  byId("detail-title").textContent = detail.person.canonical_name;
  byId("person-edit").hidden = !canEditPeople();
  target.append(identityCard(detail));

  const followUps = el("section", "card follow-up-section");
  const openFollowUps = detail.followUps
    .filter((item) => item.status === "open")
    .sort(followUpSort);
  const followUpHead = el("div", "section-heading");
  const followUpTitle = el("div", "section-title-with-count");
  followUpTitle.append(
    el("h2", "", "次に聞くこと"),
    el("span", "count-pill", `${openFollowUps.length}件`),
  );
  followUpHead.append(followUpTitle);
  if (canEditPeople() && !state.followUpSelectionMode) {
    const controls = el("div", "section-controls");
    controls.append(
      detailSectionButton(state.followUpAddOpen ? "閉じる" : "＋ 追加", () => {
        state.followUpAddOpen = !state.followUpAddOpen;
        renderDetail();
      }),
    );
    if (openFollowUps.length) {
      controls.append(
        detailSectionButton("整理", () => {
          state.followUpSelectionMode = true;
          state.selectedFollowUpIds.clear();
          state.expandedFollowUps = true;
          renderDetail();
        }),
      );
    }
    followUpHead.append(controls);
  }
  followUps.append(followUpHead);
  followUps.append(
    el("p", "section-help", "会う前に見るものだけ。最初の3件を表示します。"),
  );

  if (state.followUpAddOpen && !state.followUpSelectionMode) {
    const addActions = el("div", "follow-up-add-actions");
    const chooseTopic = el(
      "button",
      "secondary topic-library-button",
      "話題ボックスから選ぶ",
    );
    chooseTopic.type = "button";
    chooseTopic.addEventListener("click", openTopicPicker);
    const addDirectly = el("button", "secondary", "自分で入力");
    addDirectly.type = "button";
    addDirectly.addEventListener("click", () => openComposer("next-topics"));
    addActions.append(chooseTopic, addDirectly);
    followUps.append(addActions);
  }
  if (state.followUpSelectionMode && openFollowUps.length) {
    followUps.append(renderFollowUpBulkToolbar(openFollowUps));
  }
  const shownFollowUps =
    state.expandedFollowUps || state.followUpSelectionMode
      ? openFollowUps
      : openFollowUps.slice(0, 3);
  shownFollowUps.forEach((item) =>
    followUps.append(followUpCard(item, false, state.followUpSelectionMode)),
  );
  if (!openFollowUps.length) {
    followUps.append(el("div", "empty", "次に聞くことはありません"));
  } else if (openFollowUps.length > 3 && !state.followUpSelectionMode) {
    followUps.append(
      detailSectionButton(
        state.expandedFollowUps
          ? "表示を戻す"
          : `残り${openFollowUps.length - 3}件を見る`,
        () => {
          state.expandedFollowUps = !state.expandedFollowUps;
          renderDetail();
        },
      ),
    );
  }
  target.append(followUps);

  const conversations = el("section", "card conversation-section");
  const notedConversations = detail.conversations.filter((conversation) =>
    String(conversation.note || "").trim(),
  );
  const conversationHead = el("div", "section-heading");
  const conversationTitle = el("div", "section-title-with-count");
  conversationTitle.append(
    el("h2", "", "会話履歴"),
    el("span", "count-pill neutral", `${notedConversations.length}件`),
  );
  conversationHead.append(conversationTitle);
  conversations.append(conversationHead);
  const shownConversations = state.expandedConversations
    ? notedConversations
    : notedConversations.slice(0, 2);
  shownConversations.forEach((conversation) => {
    const card = el("article", "conversation");
    const head = el("div", "conversation-head");
    head.append(el("time", "", dateText(conversation.occurred_at)));
    if (canEditPeople()) {
      const remove = el("button", "delete-button compact-button", "削除");
      remove.type = "button";
      remove.addEventListener("click", () => deleteConversation(conversation));
      head.append(remove);
    }
    card.append(head, el("p", "", conversation.note));
    conversations.append(card);
  });
  if (!notedConversations.length) {
    conversations.append(el("div", "empty", "最初の会話メモを残しましょう"));
  } else if (notedConversations.length > 2) {
    conversations.append(
      detailSectionButton(
        state.expandedConversations
          ? "最新2件に戻す"
          : `過去の${notedConversations.length - 2}件も見る`,
        () => {
          state.expandedConversations = !state.expandedConversations;
          renderDetail();
        },
      ),
    );
  }
  target.append(conversations, renderProfileDetails(detail));
}

async function openPerson(personId) {
  state.followUpSelectionMode = false;
  state.selectedFollowUpIds.clear();
  state.expandedFollowUps = false;
  state.expandedConversations = false;
  state.followUpAddOpen = false;
  byId("person-detail").hidden = false;
  document.body.style.overflow = "hidden";
  byId("detail-body").replaceChildren(el("div", "empty", "読み込み中…"));
  try {
    const [
      personResult,
      assignmentsResult,
      conversationsResult,
      eventsResult,
      familyResult,
      followUpsResult,
    ] = await Promise.all([
      selectPerson(personId),
      state.client
        .from("assignments")
        .select(
          "assignment_id,person_id,fiscal_year,organization,department,role,verified_status",
        )
        .eq("person_id", personId)
        .order("fiscal_year", { ascending: false }),
      state.client
        .from("conversations")
        .select(
          "conversation_id,person_id,occurred_at,note,next_topic,follow_up_at,tags",
        )
        .eq("person_id", personId)
        .order("occurred_at", { ascending: false }),
      state.client
        .from("events")
        .select("event_id,person_id,event_type,event_date,note,repeat_yearly")
        .eq("person_id", personId)
        .order("event_date", { ascending: false }),
      state.client
        .from("family_members")
        .select(
          "family_member_id,person_id,relationship,display_name,birth_date,observed_age,observed_on,note",
        )
        .eq("person_id", personId)
        .order("created_at", { ascending: false }),
      state.client
        .from("follow_up_items")
        .select(
          "follow_up_id,person_id,body,due_at,status,completed_at,created_at",
        )
        .eq("person_id", personId)
        .order("created_at", { ascending: false }),
    ]);
    const error = [
      personResult,
      assignmentsResult,
      conversationsResult,
      eventsResult,
      familyResult,
      followUpsResult,
    ].find((result) => result.error)?.error;
    if (error) throw error;
    state.person = {
      person: personResult.data,
      assignments: assignmentsResult.data.sort(compareFiscalYear),
      conversations: conversationsResult.data,
      events: eventsResult.data,
      familyMembers: familyResult.data,
      followUps: followUpsResult.data,
    };
    byId("composer-open").hidden = !canEditPeople();
    renderDetail();
  } catch (error) {
    toast(message(error), true);
    closeDetail();
  }
}

function closeDetail() {
  byId("person-detail").hidden = true;
  byId("composer").hidden = true;
  byId("topic-picker").hidden = true;
  byId("person-editor").hidden = true;
  document.body.style.overflow = "";
  state.person = null;
  state.followUpSelectionMode = false;
  state.selectedFollowUpIds.clear();
  state.selectedTopicIds.clear();
  state.expandedTopicIds.clear();
  state.expandedFollowUps = false;
  state.expandedConversations = false;
  state.followUpAddOpen = false;
  resetComposer();
}

function generateId(prefix) {
  const raw =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().replaceAll("-", "")
      : `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`.padEnd(
          32,
          "0",
        );
  return `${prefix}_${raw.slice(0, 32)}`;
}

function splitTags(value) {
  return [
    ...new Set(
      String(value || "")
        .split(/[、,，\n]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ].slice(0, 30);
}

function renderCardStyleOptions() {
  const target = byId("card-style-options");
  clear(target);
  cardStyles.forEach((style) => {
    const button = el(
      "button",
      `style-option${state.selectedCardStyle === style.id ? " selected" : ""}`,
    );
    button.type = "button";
    button.setAttribute("aria-pressed", String(state.selectedCardStyle === style.id));
    const swatch = el("span", `style-swatch card-style-${style.id}`);
    swatch.append(el("span", "mini-info-strip"));
    button.append(swatch, el("span", "style-option-label", style.label));
    button.addEventListener("click", () => {
      state.selectedCardStyle = style.id;
      renderCardStyleOptions();
      renderEditorCardPreview();
    });
    target.append(button);
  });
}

function renderIconStyleOptions() {
  const target = byId("icon-style-options");
  clear(target);
  iconStyles.forEach((icon) => {
    const button = el(
      "button",
      `icon-option${state.selectedIconStyle === icon.id ? " selected" : ""}`,
    );
    button.type = "button";
    button.setAttribute("aria-pressed", String(state.selectedIconStyle === icon.id));
    const preview = el("span", "icon-option-preview");
    if (icon.id === "none") preview.append(el("span", "none-mark", "—"));
    else preview.append(svgIcon(icon.id));
    button.append(preview, el("span", "", icon.label));
    button.addEventListener("click", () => {
      state.selectedIconStyle = icon.id;
      renderIconStyleOptions();
      renderEditorCardPreview();
    });
    target.append(button);
  });
}

function renderIconFrameOptions() {
  const target = byId("icon-frame-options");
  clear(target);
  iconFrames.forEach((frame) => {
    const button = el(
      "button",
      `frame-option frame-${frame.id}${state.selectedIconFrame === frame.id ? " selected" : ""}`,
      frame.label,
    );
    button.type = "button";
    button.setAttribute("aria-pressed", String(state.selectedIconFrame === frame.id));
    button.addEventListener("click", () => {
      state.selectedIconFrame = frame.id;
      renderIconFrameOptions();
      renderEditorCardPreview();
    });
    target.append(button);
  });
}

function fillPersonForm(person = null, assignments = []) {
  const assignment = currentAssignment(assignments);
  byId("person-name").value = person?.canonical_name || "";
  byId("person-kana").value = person?.name_kana || "";
  byId("person-tags").value = Array.isArray(person?.profile_tags)
    ? person.profile_tags.join("、")
    : "";
  byId("person-fiscal-year").value =
    assignment?.fiscal_year || String(config.currentFiscalYear || "");
  byId("person-organization").value = assignment?.organization || "";
  byId("person-department").value = assignment?.department || "";
  byId("person-role").value = assignment?.role || "";
  state.selectedCardStyle = cardStyleId(person);
  state.selectedIconStyle = iconStyleId(person);
  state.selectedIconFrame = iconFrameId(person);
  renderCardStyleOptions();
  renderIconStyleOptions();
  renderIconFrameOptions();
  renderEditorCardPreview();
  document.querySelector(".card-customize").hidden = !state.cardFieldsAvailable;
}

function renderEditorCardPreview() {
  const target = byId("card-live-preview");
  if (!target) return;
  const assignment = {
    fiscal_year: byId("person-fiscal-year").value.trim(),
    organization: byId("person-organization").value.trim(),
    department: byId("person-department").value.trim(),
    role: byId("person-role").value.trim(),
    verified_status: "verified",
  };
  const preview = identityCard({
    person: {
      canonical_name: byId("person-name").value.trim() || "人物名",
      profile_tags: splitTags(byId("person-tags").value),
      card_style: state.selectedCardStyle,
      icon_style: state.selectedIconStyle,
      icon_frame: state.selectedIconFrame,
    },
    assignments:
      assignment.organization || assignment.department || assignment.role
        ? [assignment]
        : [],
  });
  preview.classList.add("editor-preview-card");
  target.replaceChildren(preview);
}

function openPersonEditor(mode) {
  if (!canEditPeople()) {
    toast("人物情報を編集する権限がありません。", true);
    return;
  }
  const editing = mode === "edit" && state.person;
  state.editorMode = editing ? "edit" : "create";
  state.editorPersonId = editing ? state.person.person.person_id : null;
  byId("person-editor-title").textContent = editing
    ? "人物情報を編集"
    : "人物を追加";
  fillPersonForm(
    editing ? state.person.person : null,
    editing ? state.person.assignments : [],
  );
  byId("person-editor").hidden = false;
  document.body.style.overflow = "hidden";
  setTimeout(() => byId("person-name").focus(), 0);
}

function closePersonEditor() {
  byId("person-editor").hidden = true;
  byId("person-form").reset();
  state.editorPersonId = null;
  document.body.style.overflow = byId("person-detail").hidden ? "" : "hidden";
}

async function savePerson(event) {
  event.preventDefault();
  if (!canEditPeople()) return;
  const name = byId("person-name").value.trim();
  if (!name) {
    toast("氏名を入力してください。", true);
    byId("person-name").focus();
    return;
  }
  const personId =
    state.editorMode === "edit" && state.editorPersonId
      ? state.editorPersonId
      : generateId("per");
  const personValues = {
    canonical_name: name,
    name_kana: byId("person-kana").value.trim(),
    profile_tags: splitTags(byId("person-tags").value),
    active_status: "active",
  };
  if (state.editorMode === "create") personValues.aliases = [];
  if (state.cardFieldsAvailable) {
    personValues.card_style = state.selectedCardStyle;
    personValues.icon_style = state.selectedIconStyle;
    personValues.icon_frame = state.selectedIconFrame;
  }
  const fiscalYear = byId("person-fiscal-year").value.trim();
  const assignmentValues = {
    fiscal_year: fiscalYear,
    organization: byId("person-organization").value.trim(),
    department: byId("person-department").value.trim(),
    role: byId("person-role").value.trim(),
  };
  const existingAssignment =
    state.editorMode === "edit"
      ? state.person?.assignments.find((item) => item.fiscal_year === fiscalYear)
      : null;
  const hasAssignment = Boolean(
    fiscalYear &&
      (existingAssignment ||
        assignmentValues.organization ||
        assignmentValues.department ||
        assignmentValues.role),
  );
  const save = byId("person-save");
  save.disabled = true;
  save.textContent = "保存中…";
  try {
    if (state.editorMode === "edit") {
      const { error } = await state.client
        .from("people")
        .update(personValues)
        .eq("person_id", personId);
      if (error) throw error;
    } else {
      const { error } = await state.client.from("people").insert({
        person_id: personId,
        ...personValues,
        revision: 1,
      });
      if (error) throw error;
    }

    if (hasAssignment) {
      if (existingAssignment) {
        const { error } = await state.client
          .from("assignments")
          .update(assignmentValues)
          .eq("assignment_id", existingAssignment.assignment_id);
        if (error) throw error;
      } else {
        const { error } = await state.client.from("assignments").insert({
          assignment_id: generateId("asg"),
          person_id: personId,
          ...assignmentValues,
          verified_status: "verified",
        });
        if (error) throw error;
      }
    }
    closePersonEditor();
    await loadDirectory();
    await openPerson(personId);
    toast(state.editorMode === "edit" ? "人物情報を更新しました" : "人物を追加しました");
  } catch (error) {
    toast(message(error), true);
  } finally {
    save.disabled = false;
    save.textContent = "保存する";
  }
}

function renderTags() {
  const target = byId("tag-list");
  clear(target);
  tags.forEach((tag) => {
    const button = el(
      "button",
      `tag${state.selectedTags.has(tag) ? " selected" : ""}`,
      tag,
    );
    button.type = "button";
    button.addEventListener("click", () => {
      state.selectedTags.has(tag)
        ? state.selectedTags.delete(tag)
        : state.selectedTags.add(tag);
      renderTags();
    });
    target.append(button);
  });
}

function resetComposer() {
  byId("conversation-form").reset();
  state.selectedTags.clear();
  renderTags();
}

function openComposer(focusId = "conversation-note") {
  if (!state.person) return;
  byId("composer").hidden = false;
  setTimeout(() => {
    byId(focusId)?.focus();
  }, 0);
}

function closeComposer() {
  byId("composer").hidden = true;
  resetComposer();
}

function relationshipLabel(value) {
  return (
    {
      work: "仕事で会う",
      friend: "知人・友人",
      community: "地域の集まり",
      other: "その他",
    }[value] || value
  );
}

function visibleTopics() {
  const query = normalize(state.topicQuery);
  const currentMonth = `${new Date().getMonth() + 1}月`;
  return topicLibrary()
    .filter(topicMatchesProfile)
    .filter((topic) => !query || topicSearchText(topic).includes(query))
    .filter((topic) => {
      if (state.topicPickerTab === "initial") {
        return (
          topic.sensitivity === "low" &&
          topic.relationships.includes(state.topicRelationship)
        );
      }
      if (state.topicPickerTab === "category") {
        return (
          state.topicCategory === "all" ||
          topic.category === state.topicCategory
        );
      }
      return topic.recommended;
    })
    .sort((left, right) => {
      const score = (topic) =>
        (topic.builtIn ? 100 : 0) +
        (topic.month === currentMonth ? 20 : 0) +
        (topic.month === "日常" ? 8 : 0) +
        (topic.sensitivity === "low" ? 2 : 0);
      return (
        score(right) - score(left) ||
        left.title.localeCompare(right.title, "ja")
      );
    });
}

function renderTopicFilters() {
  const relationshipFilters = byId("topic-relationship-filters");
  const categoryFilters = byId("topic-category-filters");
  relationshipFilters.hidden = state.topicPickerTab !== "initial";
  categoryFilters.hidden = state.topicPickerTab !== "category";
  clear(relationshipFilters);
  clear(categoryFilters);

  if (!relationshipFilters.hidden) {
    ["work", "friend", "community", "other"].forEach((relationship) => {
      const button = el(
        "button",
        `filter-chip${state.topicRelationship === relationship ? " active" : ""}`,
        relationshipLabel(relationship),
      );
      button.type = "button";
      button.addEventListener("click", () => {
        state.topicRelationship = relationship;
        state.selectedTopicIds.clear();
        state.topicLimit = topicPageSize;
        renderTopicPicker();
      });
      relationshipFilters.append(button);
    });
  }

  if (!categoryFilters.hidden) {
    const categories = [
      "all",
      ...new Set(topicLibrary().map((topic) => topic.category)),
    ];
    categories.forEach((category) => {
      const button = el(
        "button",
        `filter-chip${state.topicCategory === category ? " active" : ""}`,
        category === "all" ? "すべて" : category,
      );
      button.type = "button";
      button.addEventListener("click", () => {
        state.topicCategory = category;
        state.topicLimit = topicPageSize;
        renderTopicPicker();
      });
      categoryFilters.append(button);
    });
  }
}

function topicOptionCard(topic) {
  const selected = state.selectedTopicIds.has(topic.id);
  const expanded = state.expandedTopicIds.has(topic.id);
  const card = el(
    "article",
    `topic-option${selected ? " selected" : ""}${expanded ? " expanded" : ""}`,
  );
  const copy = el("div", "topic-option-copy");
  const meta = el("div", "topic-meta");
  meta.append(el("span", "topic-category", topic.category));
  if (!topic.builtIn && topic.month !== "日常") {
    meta.append(el("span", "topic-month", topic.month));
  }
  if (topic.sensitivity === "personal") {
    meta.append(el("span", "topic-sensitivity", "少し個人的"));
  }
  copy.append(meta);
  if (!topic.builtIn && topic.title !== topic.question) {
    copy.append(el("div", "topic-title", topic.title));
  }
  copy.append(el("div", "topic-question", topic.question));
  if (topic.opening) {
    const flow = el("div", "topic-flow");
    flow.append(el("div", "topic-opening", `もう一歩：${topic.opening}`));
    if (topic.exitPhrase) {
      flow.append(el("div", "topic-exit", `締め方：${topic.exitPhrase}`));
    }
    flow.hidden = !expanded;
    copy.append(flow);
    const details = el(
      "button",
      "topic-details-button",
      expanded ? "会話の流れを閉じる" : "会話の流れを見る",
    );
    details.type = "button";
    details.setAttribute("aria-expanded", String(expanded));
    details.addEventListener("click", () => {
      if (expanded) state.expandedTopicIds.delete(topic.id);
      else state.expandedTopicIds.add(topic.id);
      renderTopicPicker();
    });
    copy.append(details);
  }
  const toggle = el(
    "button",
    `topic-toggle${selected ? " selected" : ""}`,
    selected ? "✓" : "＋",
  );
  toggle.type = "button";
  toggle.setAttribute(
    "aria-label",
    selected ? `「${topic.question}」の選択を解除` : `「${topic.question}」を選択`,
  );
  toggle.addEventListener("click", () => {
    if (selected) state.selectedTopicIds.delete(topic.id);
    else state.selectedTopicIds.add(topic.id);
    renderTopicPicker();
  });
  card.append(copy, toggle);
  return card;
}

function renderTopicPicker() {
  if (!state.person) return;
  byId("topic-person-name").textContent =
    `${state.person.person.canonical_name}さんに聞く話題`;
  byId("topic-search").value = state.topicQuery;
  document.querySelectorAll("#topic-tabs [data-topic-tab]").forEach((button) => {
    const active = button.dataset.topicTab === state.topicPickerTab;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  renderTopicFilters();
  const topics = visibleTopics();
  byId("topic-result-summary").textContent =
    state.topicPickerTab === "initial"
      ? `${relationshipLabel(state.topicRelationship)}向け・${topics.length}件`
      : `${topics.length}件の話題`;
  const list = byId("topic-list");
  clear(list);
  topics
    .slice(0, state.topicLimit)
    .forEach((topic) => list.append(topicOptionCard(topic)));
  if (!topics.length) {
    list.append(el("div", "empty", "条件に合う話題がありません"));
  }
  byId("topic-load-more").hidden = topics.length <= state.topicLimit;
  const count = state.selectedTopicIds.size;
  byId("topic-selected-count").textContent = `${count}件を選択中`;
  byId("topic-add-selected").disabled = !count;
}

function openTopicPicker() {
  if (!state.person) return;
  state.selectedTopicIds.clear();
  state.expandedTopicIds.clear();
  state.topicPickerTab = "recommended";
  state.topicRelationship = "work";
  state.topicCategory = "all";
  state.topicQuery = "";
  state.topicLimit = topicPageSize;
  byId("topic-picker").hidden = false;
  renderTopicPicker();
}

function closeTopicPicker() {
  byId("topic-picker").hidden = true;
  state.selectedTopicIds.clear();
  state.expandedTopicIds.clear();
}

async function addSelectedTopics() {
  if (!state.person || !state.selectedTopicIds.size) return;
  const existing = new Set(
    state.person.followUps
      .filter((item) => item.status === "open")
      .map((item) => normalize(item.body)),
  );
  const selected = topicLibrary().filter(
    (topic) =>
      state.selectedTopicIds.has(topic.id) &&
      !existing.has(normalize(topic.question)),
  );
  const skipped = state.selectedTopicIds.size - selected.length;
  if (!selected.length) {
    toast("選んだ話題はすでに追加されています。", true);
    return;
  }
  const button = byId("topic-add-selected");
  button.disabled = true;
  button.textContent = "追加中…";
  try {
    const { data, error } = await state.client
      .from("follow_up_items")
      .insert(
        selected.map((topic) => ({
          person_id: state.person.person.person_id,
          body: topic.question,
          due_at: null,
        })),
      )
      .select();
    if (error) throw error;
    state.person.followUps.unshift(...data);
    state.followUps.unshift(...data);
    closeTopicPicker();
    renderAll();
    renderDetail();
    toast(
      skipped
        ? `${data.length}件を追加しました（重複${skipped}件は除外）`
        : `${data.length}件を「次に聞くこと」へ追加しました`,
    );
  } catch (error) {
    toast(message(error), true);
  } finally {
    button.disabled = false;
    button.textContent = "次に聞くことへ追加";
  }
}

async function completeFollowUp(item) {
  try {
    const { error } = await state.client
      .from("follow_up_items")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("follow_up_id", item.follow_up_id);
    if (error) throw error;
    state.followUps = state.followUps.filter(
      (row) => row.follow_up_id !== item.follow_up_id,
    );
    if (state.person)
      state.person.followUps = state.person.followUps.filter(
        (row) => row.follow_up_id !== item.follow_up_id,
    );
    renderAll();
    if (state.person) renderDetail();
    toast(`「${item.body}」を聞いたことにしました`, false, {
      label: "元に戻す",
      onClick: () => undoCompletedFollowUps([item]),
    });
  } catch (error) {
    toast(message(error), true);
  }
}

async function undoCompletedFollowUps(items) {
  const ids = items.map((item) => item.follow_up_id);
  try {
    const { error } = await state.client
      .from("follow_up_items")
      .update({ status: "open", completed_at: null })
      .in("follow_up_id", ids);
    if (error) throw error;
    const knownIds = new Set(state.followUps.map((item) => item.follow_up_id));
    items.forEach((item) => {
      item.status = "open";
      item.completed_at = null;
      if (!knownIds.has(item.follow_up_id)) state.followUps.unshift(item);
    });
    if (state.person) {
      const personIds = new Set(
        state.person.followUps.map((item) => item.follow_up_id),
      );
      items
        .filter((item) => item.person_id === state.person.person.person_id)
        .forEach((item) => {
          if (!personIds.has(item.follow_up_id)) {
            state.person.followUps.unshift(item);
          }
        });
    }
    renderAll();
    if (state.person) renderDetail();
    toast(items.length === 1 ? "元に戻しました" : `${items.length}件を元に戻しました`);
  } catch (error) {
    toast(`元に戻せませんでした。${message(error)}`, true);
  }
}

function renderFollowUpBulkToolbar(openFollowUps) {
  const selectedIds = openFollowUps
    .filter((item) => state.selectedFollowUpIds.has(item.follow_up_id))
    .map((item) => item.follow_up_id);
  const toolbar = el("div", "bulk-toolbar");
  toolbar.append(el("div", "bulk-summary", `選択中 ${selectedIds.length}件`));

  const selectAll = el(
    "button",
    "secondary compact-button",
    selectedIds.length === openFollowUps.length ? "選択解除" : "すべて選択",
  );
  selectAll.type = "button";
  selectAll.addEventListener("click", () => {
    if (selectedIds.length === openFollowUps.length) {
      state.selectedFollowUpIds.clear();
    } else {
      state.selectedFollowUpIds = new Set(
        openFollowUps.map((item) => item.follow_up_id),
      );
    }
    renderDetail();
  });

  const complete = el("button", "complete-button", "選択分を聞いた");
  complete.type = "button";
  complete.disabled = !selectedIds.length;
  complete.addEventListener("click", () =>
    completeSelectedFollowUps(selectedIds),
  );

  const remove = el("button", "delete-button", "選択分を削除");
  remove.type = "button";
  remove.disabled = !selectedIds.length;
  remove.addEventListener("click", () => deleteSelectedFollowUps(selectedIds));

  const cancel = el("button", "text-button compact-button", "戻る");
  cancel.type = "button";
  cancel.addEventListener("click", () => {
    state.followUpSelectionMode = false;
    state.selectedFollowUpIds.clear();
    renderDetail();
  });
  toolbar.append(selectAll, complete, remove, cancel);
  return toolbar;
}

function removeFollowUpsFromState(ids) {
  const idSet = new Set(ids);
  state.followUps = state.followUps.filter(
    (row) => !idSet.has(row.follow_up_id),
  );
  if (state.person) {
    state.person.followUps = state.person.followUps.filter(
      (row) => !idSet.has(row.follow_up_id),
    );
  }
  ids.forEach((id) => state.selectedFollowUpIds.delete(id));
}

async function completeSelectedFollowUps(ids) {
  if (!ids.length) return;
  const completedItems = (state.person?.followUps || state.followUps).filter(
    (item) => ids.includes(item.follow_up_id),
  );
  try {
    const { error } = await state.client
      .from("follow_up_items")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .in("follow_up_id", ids);
    if (error) throw error;
    removeFollowUpsFromState(ids);
    state.followUpSelectionMode = false;
    renderAll();
    if (state.person) renderDetail();
    toast(`${ids.length}件を「聞いた」にしました`, false, {
      label: "元に戻す",
      onClick: () => undoCompletedFollowUps(completedItems),
    });
  } catch (error) {
    toast(message(error), true);
  }
}

async function deleteSelectedFollowUps(ids) {
  if (!ids.length) return;
  if (
    !window.confirm(
      `選んだ${ids.length}件を削除しますか？削除後は元に戻せません。`,
    )
  )
    return;
  try {
    const { error } = await state.client
      .from("follow_up_items")
      .delete()
      .in("follow_up_id", ids);
    if (error) throw error;
    removeFollowUpsFromState(ids);
    state.followUpSelectionMode = false;
    renderAll();
    if (state.person) renderDetail();
    toast(`${ids.length}件を削除しました`);
  } catch (error) {
    toast(message(error), true);
  }
}

async function deleteFollowUp(item) {
  if (!window.confirm("この「次に聞くこと」を削除しますか？")) return;
  try {
    const { error } = await state.client
      .from("follow_up_items")
      .delete()
      .eq("follow_up_id", item.follow_up_id);
    if (error) throw error;
    state.followUps = state.followUps.filter(
      (row) => row.follow_up_id !== item.follow_up_id,
    );
    if (state.person)
      state.person.followUps = state.person.followUps.filter(
        (row) => row.follow_up_id !== item.follow_up_id,
      );
    renderAll();
    if (state.person) renderDetail();
    toast("「次に聞くこと」を削除しました");
  } catch (error) {
    toast(message(error), true);
  }
}

async function deleteConversation(conversation) {
  if (!window.confirm("この会話メモを削除しますか？削除後は元に戻せません。"))
    return;
  try {
    const { error } = await state.client
      .from("conversations")
      .delete()
      .eq("conversation_id", conversation.conversation_id);
    if (error) throw error;
    state.conversations = state.conversations.filter(
      (row) => row.conversation_id !== conversation.conversation_id,
    );
    if (state.person)
      state.person.conversations = state.person.conversations.filter(
        (row) => row.conversation_id !== conversation.conversation_id,
      );
    await loadDirectory();
    if (state.person) renderDetail();
    toast("会話メモを削除しました");
  } catch (error) {
    toast(message(error), true);
  }
}

async function saveConversation(event) {
  event.preventDefault();
  if (!state.person) return;
  const note = byId("conversation-note").value.trim();
  const followUpItems = byId("next-topics")
    .value.split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);
  if (!note && !followUpItems.length) {
    toast("今日のメモまたは次に聞くことを入力してください。", true);
    return;
  }
  const button = byId("save-conversation");
  button.disabled = true;
  button.textContent = "保存中…";
  try {
    if (note) {
      const { data, error } = await state.client
        .from("conversations")
        .insert({
          person_id: state.person.person.person_id,
          occurred_at: new Date().toISOString(),
          note,
          next_topic: "",
          follow_up_at: null,
          tags: [...state.selectedTags],
        })
        .select()
        .single();
      if (error) throw error;
      state.person.conversations.unshift(data);
    }
    if (followUpItems.length) {
      const { data, error } = await state.client
        .from("follow_up_items")
        .insert(
          followUpItems.map((body) => ({
            person_id: state.person.person.person_id,
            body,
            due_at: byId("follow-up-at").value || null,
          })),
        )
        .select();
      if (error) throw error;
      state.person.followUps.unshift(...data);
    }
    closeComposer();
    renderDetail();
    toast(
      note && followUpItems.length
        ? "会話メモと次に聞くことを保存しました"
        : note
          ? "会話メモを保存しました"
          : "次に聞くことを追加しました",
    );
    await loadDirectory();
  } catch (error) {
    toast(message(error), true);
  } finally {
    button.disabled = false;
    button.textContent = "保存して履歴に戻る";
  }
}

function switchView(view) {
  document.querySelectorAll(".view").forEach((node) => {
    node.hidden = node.id !== `view-${view}`;
  });
  document.querySelectorAll("#navigation button").forEach((node) => {
    node.classList.toggle("active", node.dataset.view === view);
  });
}

async function signIn() {
  byId("auth-message").textContent = "Googleログインへ移動します…";
  const { error } = await state.client.auth.signInWithOAuth({
    provider: "google",
    options: {
      // OAuth callback must never include a previous access-token fragment.
      redirectTo: `${window.location.origin}${window.location.pathname}`,
    },
  });
  if (error) byId("auth-message").textContent = message(error);
}

async function signOut() {
  const { error } = await state.client.auth.signOut();
  if (error) toast(message(error), true);
  state.session = null;
  state.role = null;
  showOnly("auth-screen");
}

async function handleSession(session) {
  if (state.handlingSession) return;
  state.handlingSession = true;
  try {
    if (!session) {
      state.session = null;
      state.role = null;
      showOnly("auth-screen");
      return;
    }
    state.session = session;
    const { data, error } = await state.client
      .from("app_members")
      .select("role,active")
      .eq("user_id", session.user.id)
      .maybeSingle();
    if (error) throw error;
    if (!data || !data.active) {
      showOnly("denied-screen");
      return;
    }
    state.role = data.role;
    byId("person-add").hidden = !canEditPeople();
    byId("person-edit").hidden = !canEditPeople();
    byId("composer-open").hidden = !canEditPeople();
    showOnly("app-screen");
    await loadDirectory();
  } catch (error) {
    showOnly("auth-screen");
    byId("auth-message").textContent = message(error);
  } finally {
    state.handlingSession = false;
  }
}

function bindEvents() {
  byId("sign-in").addEventListener("click", signIn);
  byId("sign-out").addEventListener("click", signOut);
  byId("denied-sign-out").addEventListener("click", signOut);
  byId("search").addEventListener("input", () => {
    state.peopleLimit = 50;
    renderPeople();
  });
  byId("load-more").addEventListener("click", () => {
    state.peopleLimit += 50;
    renderPeople();
  });
  byId("navigation").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-view]");
    if (button) switchView(button.dataset.view);
  });
  [
    "roster-year",
    "roster-organization",
    "roster-department",
    "roster-role",
    "roster-query",
  ].forEach((id) => {
    byId(id).addEventListener(
      id === "roster-query" ? "input" : "change",
      renderRoster,
    );
  });
  byId("detail-close").addEventListener("click", closeDetail);
  byId("person-add").addEventListener("click", () => openPersonEditor("create"));
  byId("person-edit").addEventListener("click", () => openPersonEditor("edit"));
  byId("person-editor-close").addEventListener("click", closePersonEditor);
  byId("person-form").addEventListener("submit", savePerson);
  [
    "person-name",
    "person-tags",
    "person-fiscal-year",
    "person-organization",
    "person-department",
    "person-role",
  ].forEach((id) => byId(id).addEventListener("input", renderEditorCardPreview));
  byId("composer-open").addEventListener("click", () => openComposer());
  byId("composer-close").addEventListener("click", closeComposer);
  byId("conversation-form").addEventListener("submit", saveConversation);
  byId("topic-picker-close").addEventListener("click", closeTopicPicker);
  byId("topic-tabs").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-topic-tab]");
    if (!button) return;
    state.topicPickerTab = button.dataset.topicTab;
    state.selectedTopicIds.clear();
    state.expandedTopicIds.clear();
    state.topicLimit = topicPageSize;
    renderTopicPicker();
  });
  byId("topic-search").addEventListener("input", (event) => {
    state.topicQuery = event.target.value;
    state.topicLimit = topicPageSize;
    renderTopicPicker();
  });
  byId("topic-load-more").addEventListener("click", () => {
    state.topicLimit += topicPageSize;
    renderTopicPicker();
  });
  byId("topic-add-selected").addEventListener("click", addSelectedTopics);
}

async function boot() {
  if (!configured()) {
    showOnly("setup-screen");
    return;
  }
  let createClient;
  try {
    ({ createClient } = await import("https://esm.sh/@supabase/supabase-js@2"));
  } catch (error) {
    showOnly("auth-screen");
    byId("auth-message").textContent =
      `Supabase接続用ライブラリを読み込めませんでした。${message(error)}`;
    return;
  }
  state.client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { persistSession: true, detectSessionInUrl: true },
  });
  bindEvents();
  renderTags();
  const { data, error } = await state.client.auth.getSession();
  if (error) {
    showOnly("auth-screen");
    byId("auth-message").textContent = message(error);
    return;
  }
  await handleSession(data.session);
  // Do not leave access_token/refresh_token in the address bar. Leaving the
  // fragment there causes a later sign-in attempt to append another fragment.
  if (
    window.location.hash ||
    new URL(window.location.href).searchParams.has("code")
  ) {
    window.history.replaceState(
      {},
      document.title,
      `${window.location.origin}${window.location.pathname}`,
    );
  }
  state.client.auth.onAuthStateChange((_event, session) => {
    handleSession(session);
  });
}

boot();
