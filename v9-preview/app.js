import { encryptBackup, validateBackupPayload } from "./backup-crypto.js?v=9-20261107-export-avatar-topics";
import { normalizeCardImage, resolveCardArtwork, PhotoStore, preparePhoto, persistCardImage, collectPhotoMedia } from "./card-images.js?v=9-20261107-export-avatar-topics";
import {isChildrenTag, childrenInfo, childrenProfileTags, childrenPresenceAfterTagEdit, currentChildAge} from './family.js?v=9-20261107-export-avatar-topics';
import {isFamilyTag, tagChoices, tagCategories} from './tag-library.js?v=9-20261107-export-avatar-topics';
import {personAgeValues, personAgeSummary, personAgeInputs} from './person-age.js?v=9-20261107-export-avatar-topics';
import {ConversationDrafts} from './conversation-drafts.js?v=9-20261107-export-avatar-topics';
import {createConversationJob,saveConversationJob,followUpQuote} from './conversation-flow.js?v=9-20261107-export-avatar-topics';
import {SupabaseConversationStore} from './conversation-store.js?v=9-20261107-export-avatar-topics';
import {personInitial} from './person-presentation.js?v=9-20261107-export-avatar-topics';
import {filterInterestIcons,interestIcons,interestIconForTag,interestsForTags} from './interest-icons.js?v=9-20261107-export-avatar-topics';

const config = window.PEOPLE_NOTEBOOK_CONFIG || {};
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
function newTopicControls() {
  return {tab:"recommended", relationship:"work", category:"all", query:"", limit:topicPageSize, expanded:new Set()};
}
const cardStyles = [
  { id: "mist", label: "朝もや", category: "soft", recommended: true },
  { id: "watercolor", label: "にじみ水彩", category: "soft", recommended: true },
  { id: "sunset", label: "夕暮れシティ", category: "scenery", recommended: true },
  { id: "orb", label: "くすみオーブ", category: "soft", recommended: true },
  { id: "spring", label: "春霞", category: "season" },
  { id: "summer", label: "夏空", category: "season" },
  { id: "autumn", label: "秋の余白", category: "season" },
  { id: "winter", label: "冬明かり", category: "season" },
  { id: "dots", label: "パステルドット", category: "soft" },
  { id: "linen", label: "淡色リネン", category: "simple", recommended: true },
  { id: "seaglass", label: "シーグラス", category: "legacy" },
  { id: "twilight", label: "薄明", category: "scenery" },
  { id: "soft-stripe", label: "やわらか縞", category: "simple" },
  { id: "moonlight", label: "月明かり", category: "scenery" },
  { id: "plain", label: "無地", category: "simple" },
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
let photoStore = null;
let photoObserver = null;
const conversationDrafts = new ConversationDrafts(() => window.sessionStorage);
const state = {
  client: null,
  session: null,
  role: null,
  people: [],
  assignments: [],
  conversations: [],
  followUps: [],
  familyMembers: [],
  directory: [],
  person: null,
  detailRequest: 0,
  memoExportIds: new Set(),
  selectedTags: new Set(),
  selectedFollowUpIds: new Set(),
  followUpSelectionMode: false,
  selectedTopicIds: new Set(),
  topicPreferences: new Map(),
  topicHistoryAvailable: true,
  browseTopicControls: newTopicControls(),
  addTopicControls: newTopicControls(),
  topicPickerMode: "browse",
  topicOpener: null,
  topicAddRequest: null,
  view: "people",
  topicBrowseScroll: 0,
  peopleLimit: 50,
  expandedFollowUps: false,
  expandedConversations: false,
  followUpAddOpen: false,
  profileDetailsOpen: false,
  linksAvailable: false,
  replyingFollowUp: null,
  composerMode: 'note',
  cardFieldsAvailable: true,
  cardImageAvailable: true,
  personAgeAvailable: true,
  childrenPresenceAvailable: true,
  editorOriginalChildren: null,
  editorOriginalTags: null,
  editorOriginalAge: null,
  avatarEditor: null,
  cardTintAvailable: true,
  cardToneAvailable: true,
  recapAvailable: true,
  editingConversationId: null,
  conversationJob: null,
  conversationSaving: false,
  conversationEpoch: 0,
  editorMode: "create",
  editorPersonId: null,
  editorTags: [],
  editorTagCategory: 'all',
  conversationTagCategory: 'all',
  handlingSession: false,
};

function topicControls() {
  return state.topicPickerMode === "browse" ? state.browseTopicControls : state.addTopicControls;
}

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
  if(screenId!=="app-screen")closeSessionOverlays();
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

function conversationRecap(conversation) {
  const recap = String(conversation?.recap || "").trim();
  if (recap) return recap;
  const note = String(conversation?.note || "").trim();
  return (note.split(/[。\n]/, 1)[0] || note).slice(0, 100);
}

function conversationNoteForSave(recap, detail, hasRecapColumn = true) {
  const short = String(recap || "").trim();
  const long = String(detail || "").trim();
  if (!hasRecapColumn && short && long) return `${short}\n${long}`;
  return long || short;
}

function exportableConversations(detail) {
  return (detail.conversations || []).filter(item => String(item.note || "").trim() || String(item.recap || "").trim());
}

function buildMemoExport(detail, selectedIds, options = {}) {
  const { includeName, includeProfile, includeQuestions, includePersonal, includePrompt } = options;
  const profileTags = Array.isArray(detail.person.profile_tags) ? detail.person.profile_tags.filter(Boolean) : [];
  const lines = [];
  if (includeName) lines.push(`相手の名前：${detail.person.canonical_name}`);
  if (includeProfile) {
    const age=personAgeSummary(detail.person.age_info);
    if (age.ageLabel || age.birthdayLabel) lines.push(`本人の年齢・誕生日：${[age.ageLabel,age.birthdayLabel].filter(Boolean).join('、')}`);
    const tags = profileTags.filter(tag => !isFamilyTag(tag));
    if (tags.length) lines.push(`特徴・関心：${tags.join("、")}`);
    const assignment = currentAssignment(detail.assignments || []);
    const affiliation = [assignment?.organization, assignment?.department, assignment?.role].filter(Boolean).join(" / ");
    if (affiliation) lines.push(`現在の所属：${affiliation}`);
  }
  const selected = exportableConversations(detail).filter(item => selectedIds.has(item.conversation_id));
  if (selected.length) {
    lines.push("", "会話メモ");
    selected.reverse().forEach((item) => {
      const recap = String(item.recap || "").trim();
      const note = String(item.note || "").trim();
      lines.push("", dateText(item.occurred_at) || "日付未登録");
      if (recap && recap !== note) lines.push(recap);
      if (note) lines.push(note);
    });
  }
  if (includeQuestions) {
    lines.push("", "まだ聞いていないこと：");
    const questions = (detail.followUps || []).filter(item => item.status === "open" &&
      ((!item.source_quote && !item.source_conversation_id) || selectedIds.has(item.source_conversation_id)));
    if (!questions.length) lines.push("なし");
    questions.forEach(item => lines.push(`・${item.body}`));
  }
  if (includePersonal) {
    lines.push("", "家族・個人的な出来事：");
    const tags = profileTags.filter(tag => isFamilyTag(tag) && (detail.person.children_present !== false || !isChildrenTag(tag)));
    const family = (detail.familyMembers || []).filter(item=>item.relationship !== 'child' || detail.person.children_present !== false);
    const events = detail.events || [];
    if (!tags.length && !family.length && !events.length) lines.push("記録なし");
    if (tags.length) lines.push(`・家族のタグ：${tags.join("、")}`);
    family.forEach((item) => lines.push(`・家族：${[item.relationship, item.display_name, item.observed_age == null ? "" : `${item.observed_age}歳`, item.note].filter(Boolean).join(" / ")}`));
    events.forEach((item) => lines.push(`・出来事：${[item.event_type, item.event_date, item.note].filter(Boolean).join(" / ")}`));
  }
  if (includePrompt && lines.length) lines.push("", "上のメモをもとに、次に会ったときに自然に聞ける質問を3つ提案してください。未確認のことは推測せず、個人的な話題には配慮してください。");
  return lines.join("\n").trim();
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
  if (state.topicPickerMode === "browse") return true;
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

function topicPreference(topicId) {
  return state.topicPreferences.get(topicId) || null;
}

function isFavoriteTopic(topicId) {
  return topicPreference(topicId)?.is_favorite === true;
}

async function loadTopicPreferences() {
  const { data, error } = await state.client
    .from("topic_preferences")
    .select("topic_id,is_favorite,last_used_at,use_count");
  if (error) {
    state.topicHistoryAvailable = false;
    state.topicPreferences.clear();
    return;
  }
  state.topicHistoryAvailable = true;
  state.topicPreferences = new Map(data.map((row) => [row.topic_id, row]));
}

function cardStyleId(person) {
  const value = String(person?.card_style || "mist");
  return cardStyles.some((style) => style.id === value) ? value : "mist";
}

function cardTintValue(person) {
  const value = String(person?.card_tint || "").trim();
  return /^#[0-9a-f]{6}$/i.test(value) ? value.toUpperCase() : "";
}

function cardLuminance(tint) {
  const channels = [1, 3, 5].map((start) => {
    const channel = parseInt(tint.slice(start, start + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function cardToneValue(person) {
  const tint = cardTintValue(person);
  if (!tint) return "light";
  const luminance = cardLuminance(tint);
  return luminance < 0.16 ? "dark" : luminance < 0.55 ? "medium" : "light";
}

function cardTopInk(tint) {
  const luminance = cardLuminance(tint);
  return 1.05 / (luminance + 0.05) >= (luminance + 0.05) / 0.07 ? "light" : "dark";
}

function applyCardTint(node, person) {
  const tint = cardTintValue(person);
  const tone = cardToneValue(person);
  node.classList.toggle("has-card-tint", Boolean(tint));
  node.classList.toggle("card-tone-medium", tone === "medium");
  node.classList.toggle("card-tone-dark", tone === "dark");
  if (tint) {
    node.style.setProperty("--card-tint", tint);
    node.style.setProperty("--card-accent", tint);
  } else {
    node.style.removeProperty("--card-tint");
    node.style.removeProperty("--card-accent");
  }
  if (tone !== "light") {
    const ink = cardTopInk(tint);
    node.style.setProperty("--card-top-ink", ink === "light" ? "#fff" : "#142b3e");
    node.style.setProperty("--card-top-shadow", ink === "light"
      ? "rgba(0, 0, 0, 0.55)" : "rgba(255, 255, 255, 0.55)");
  } else {
    node.style.removeProperty("--card-top-ink");
    node.style.removeProperty("--card-top-shadow");
  }
  return node;
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
      childrenInfo(person).hasChildren ? `子どもあり 子供あり 子どもがいる ${childrenInfo(person).label}` : '',
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

const conversationColumns = "conversation_id,person_id,occurred_at,note,next_topic,follow_up_at,tags";
const conversationLinkColumns = () => state.linksAvailable ? ',reply_to_conversation_id,reply_to_follow_up_id,reply_quote' : '';
const followUpColumns = () => 'follow_up_id,person_id,body,due_at,status,completed_at,created_at' +
  (state.linksAvailable ? ',source_conversation_id,source_quote' : '');

async function checkConversationLinks() {
  const checks=await Promise.all([
    state.client.from('conversations').select('reply_to_conversation_id,reply_to_follow_up_id,reply_quote').limit(1),
    state.client.from('follow_up_items').select('source_conversation_id,source_quote').limit(1),
  ]);
  for(const result of checks)if(result.error && !['42703','PGRST204'].includes(result.error.code))throw result.error;
  state.linksAvailable=checks.every(result=>!result.error);
}

async function selectAllConversations() {
  try {
    const rows = await selectAll("conversations", `${conversationColumns},recap${conversationLinkColumns()}`, { order: "occurred_at", ascending: false });
    state.recapAvailable = true;
    return rows;
  } catch (error) {
    if (!String(error.message || "").includes("recap")) throw error;
    state.recapAvailable = false;
    return selectAll("conversations", conversationColumns+conversationLinkColumns(), { order: "occurred_at", ascending: false });
  }
}

async function selectPersonConversations(personId) {
  const client = state.client;
  const links = conversationLinkColumns();
  async function fetchHistory(columns) {
    const rows = [];
    const ids = new Set();
    let expected = null;
    for (;;) {
      const { data, error, count } = await client.from("conversations").select(columns, {count:"exact"})
        .eq("person_id", personId)
        .order("occurred_at", { ascending: false })
        .order("conversation_id", { ascending: false })
        .range(rows.length, rows.length + pageSize - 1);
      if (error) return { error };
      if (!Array.isArray(data) || !Number.isInteger(count)) {
        return {error:new Error("会話履歴の取得件数を確認できませんでした。")};
      }
      if (expected === null) expected = count;
      if (count !== expected) return {error:new Error("会話履歴の取得中に件数が変わりました。人物を開き直してください。")};
      for (const row of data) {
        if (ids.has(row.conversation_id)) return {error:new Error("会話履歴が更新されました。人物を開き直してください。")};
        ids.add(row.conversation_id);
        rows.push(row);
      }
      if (rows.length === expected) return { data: rows };
      if (!data.length || rows.length > expected) return {error:new Error("会話履歴をすべて取得できませんでした。")};
    }
  }
  let result = await fetchHistory(`${conversationColumns},recap${links}`);
  let recapAvailable = true;
  if (result.error && String(result.error.message || "").includes("recap")) {
    recapAvailable = false;
    result = await fetchHistory(conversationColumns + links);
  }
  return { ...result, recapAvailable };
}

async function fetchBackupTable(table, key, userId = null) {
  const rows = [];
  let expected = null;
  for (let start = 0; ; start += pageSize) {
    let query = state.client
      .from(table)
      .select("*", { count: "exact" });
    if (userId) query = query.eq("user_id", userId);
    query = query.order(key, { ascending: true }).range(start, start + pageSize - 1);
    const { data, error, count } = await query;
    if (error) throw error;
    if (!Array.isArray(data) || !Number.isInteger(count)) {
      throw new Error(`${table} の取得件数を確認できませんでした。`);
    }
    if (expected === null) expected = count;
    if (count !== expected) throw new Error(`${table} の取得中に件数が変わりました。再実行してください。`);
    rows.push(...data);
    if (rows.length >= expected || data.length < pageSize) break;
  }
  if (rows.length !== expected) throw new Error(`${table} の取得が途中で止まりました。`);
  return rows;
}

async function downloadEncryptedBackup(event) {
  event.preventDefault();
  if (state.role !== "owner" || !state.session) return;
  const passwordInput = byId("backup-password");
  const confirmationInput = byId("backup-password-confirm");
  const password = passwordInput.value;
  if (password !== confirmationInput.value) {
    byId("backup-status").textContent = "確認用パスワードが一致しません。";
    return;
  }
  const button = byId("backup-download");
  button.disabled = true;
  let url = null;
  try {
    const definitions = [
      ["people", "person_id"],
      ["assignments", "assignment_id"],
      ["conversations", "conversation_id"],
      ["family_members", "family_member_id"],
      ["events", "event_id"],
      ["follow_up_items", "follow_up_id"],
      ["topic_preferences", "topic_id"],
    ];
    const tables = {};
    for (const [table, key] of definitions) {
      byId("backup-status").textContent = `${table} を取得中…`;
      tables[table] = await fetchBackupTable(
        table, key, table === "topic_preferences" ? state.session.user.id : null,
      );
    }
    const counts = Object.fromEntries(definitions.map(([table]) => [table, tables[table].length]));
    const payload = {
      format: "people-notebook-data",
      version: 2,
      exported_at: new Date().toISOString(),
      source_project: new URL(config.supabaseUrl).hostname.split(".")[0],
      user_id: state.session.user.id,
      counts,
      tables,
    };
    payload.media = await collectPhotoMedia(tables.people, path => photoStore.download(path), person => {
      byId("backup-status").textContent = `${person.canonical_name}の写真を取得中…`;
    });
    validateBackupPayload(payload);
    byId("backup-status").textContent = "暗号化中…";
    const envelope = await encryptBackup(payload, password);
    const file = new Blob([JSON.stringify(envelope)], { type: "application/json" });
    if (file.size > 100 * 1024 * 1024) throw new Error("バックアップが100MBを超えています。写真の容量を小さくしてから再試行してください。");
    url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = `人物ネタ帳-${new Date().toISOString().slice(0, 10)}.pnb`;
    document.body.append(link);
    link.click();
    link.remove();
    byId("backup-status").textContent = `写真${payload.media.length}枚を含めて保存しました。`;
  } catch (error) {
    byId("backup-status").textContent = `保存できませんでした：${message(error)}`;
  } finally {
    passwordInput.value = "";
    confirmationInput.value = "";
    button.disabled = false;
    if (url) setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
}

function missingCardFields(error) {
  const text = `${error?.code || ""} ${error?.message || ""}`;
  return (
    /42703|PGRST204/.test(text) ||
    /card_style|card_tint|card_tone|icon_style|icon_frame/i.test(text)
  );
}

async function selectWithCardFields(fetchRows) {
  const base="person_id,canonical_name,name_kana,aliases,profile_tags,active_status";
  let optional=["card_style","card_tint","card_tone","icon_style","icon_frame","card_image","age_info","children_present"];
  for (;;) {
    const result=await fetchRows([base,...optional].join(","));
    if (!result.error) {
      state.personAgeAvailable=optional.includes('age_info');
      state.childrenPresenceAvailable=optional.includes('children_present');
      state.cardImageAvailable=optional.includes("card_image");
      state.cardFieldsAvailable=["card_style","icon_style","icon_frame"].every(field=>optional.includes(field));
      state.cardTintAvailable=optional.includes("card_tint");
      state.cardToneAvailable=optional.includes("card_tone");
      return result;
    }
    const text=String(result.error.message||"");
    const missing=optional.find(field=>new RegExp(`\\b${field}\\b`).test(text));
    if (!missing || !/42703|PGRST204/.test(String(result.error.code))) return result;
    optional=optional.filter(field=>field!==missing);
  }
}

async function selectPeople() {
  const result=await selectWithCardFields(async columns=>{
    try {return {data:await selectAll("people",columns),error:null};}
    catch(error) {return {data:null,error};}
  });
  if (result.error) throw result.error;
  return result.data;
}

async function selectPerson(personId) {
  return selectWithCardFields(columns=>state.client.from("people").select(columns).eq("person_id",personId).single());
}

async function loadDirectory() {
  byId("sync-state").textContent = "読み込み中…";
  const [people, assignments, conversations, followUps, familyMembers] = await Promise.all([
    selectPeople(),
    selectAll(
      "assignments",
      "assignment_id,person_id,fiscal_year,organization,department,role,verified_status",
    ),
    selectAllConversations(),
    selectAll(
      "follow_up_items",
      followUpColumns(),
      { order: "created_at", ascending: false },
    ),
    selectAll('family_members','family_member_id,person_id,relationship'),
  ]);
  state.people = people.filter((person) => person.active_status === "active");
  state.assignments = assignments;
  state.conversations = conversations;
  state.followUps = followUps;
  state.familyMembers = familyMembers;
  const childPeople = new Set(familyMembers.filter(member=>member.relationship === 'child').map(member=>member.person_id));
  conversations.forEach(conversation=>{if ((conversation.tags || []).some(isChildrenTag)) childPeople.add(conversation.person_id);});
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
        hasKnownChildren: childPeople.has(person.person_id),
      });
    })
    .sort((a, b) => a.canonical_name.localeCompare(b.canonical_name, "ja"));
  populateRosterFilters();
  renderAll();
  byId("sync-state").textContent =
    `更新 ${new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}`;
}

function createCardArtwork(person, {thumbnail=false,draftUrl=null,interactive=false} = {}) {
  const artwork=resolveCardArtwork(person);
  const art=el("div", `card-art${thumbnail ? " card-art-thumbnail" : ""}`);
  art.dataset.artKind=artwork.kind;
  if (artwork.kind === "theme") {
    art.classList.add(`card-style-${artwork.id}`);
    applyCardTint(art, person);
    if (artwork.id !== "sunset") return art;
  }
  const image=el("img", "art-image");
  image.alt="";image.decoding="async";image.loading=thumbnail ? "lazy" : "eager";
  if (artwork.kind === "photo") {
    image.style.objectPosition=`${artwork.x*100}% ${artwork.y*100}%`;
    image.style.transformOrigin=`${artwork.x*100}% ${artwork.y*100}%`;
    image.style.transform=`scale(${artwork.zoom})`;
  }
  art.append(image);
  const failed=()=>{
    if (art.className.includes("art-unavailable")) return;
    art.classList.add("art-unavailable");
    image.hidden=true;
    const status=el("span", "art-status", thumbnail ? "画像" : "画像を読み込めませんでした");
    art.append(status);
    if (interactive && artwork.kind === "photo") {
      const retry=el("button", "quiet-button art-retry", "再読込");retry.type="button";
      retry.addEventListener("click",()=>{
        status.remove();retry.remove();art.classList.remove("art-unavailable");
        photoStore.invalidate(artwork.path);
        image.hidden=false;load();
      });art.append(retry);
    }
  };
  image.addEventListener("error", failed);
  const load=()=>{
    if (draftUrl && artwork.kind === "photo") {image.src=draftUrl;return;}
    if (artwork.kind !== "photo") {
      image.src=`./assets/${artwork.kind === "theme" ? "sunset-city" : artwork.id}.webp?v=20261005-simple-a`;return;
    }
    photoStore.source(artwork.path).then(url=>{image.src=url;}).catch(failed);
  };
  if (artwork.kind === "photo" && thumbnail && !draftUrl && typeof IntersectionObserver !== "undefined") {
    if (!photoObserver) photoObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{
      if (entry.isIntersecting) {photoObserver.unobserve(entry.target);entry.target.loadArtwork();}
    }), {rootMargin:"200px"});
    art.loadArtwork=load;photoObserver.observe(art);
  } else load();
  return art;
}

function interestImage(icon,className) {
  const image=el('img',className);image.src=icon.src.split('?')[0]+'?v=9-20261107-export-avatar-topics';
  image.alt=icon.label;image.width=40;image.height=40;image.loading='lazy';image.decoding='async';
  image.addEventListener('error',()=>{const fallback=el('span','interest-icon-fallback',icon.label);fallback.title=icon.label;image.replaceWith(fallback);});
  return image;
}

function createPersonAvatar(person,{draftUrl=null}={}) {
  const avatar=el('span','person-avatar'),initial=personInitial(person.canonical_name);
  avatar.append(el('span','person-avatar-letter',initial||'人'));
  const selection = normalizeCardImage(person.card_image);
  const icon = interestIcons.find(item => item.id === selection.avatarInterestId);
  if (selection.mode === "photo") avatar.append(createCardArtwork(person,{thumbnail:true,draftUrl}));
  if (icon) {
    const image = el("img", "person-avatar-interest");
    image.alt = icon.label;
    image.decoding = "async";
    image.addEventListener("error", () => image.remove());
    image.src = icon.src;
    avatar.append(image);
  }
  return avatar;
}

function personCard(person, context = null) {
  const button = el(
    "button",
    "person-card",
  );
  button.type = "button";
  const left = el("div", "person-card-copy");
  const nameRow=el('div','person-name-row');nameRow.append(el('div','person-name',person.canonical_name));
  const hobbies=interestsForTags(person.profile_tags);
  if(hobbies.length){const cues=el('span','person-interests');hobbies.slice(0,3).forEach(icon=>cues.append(interestImage(icon,'person-interest-icon')));
    if(hobbies.length>3)cues.append(el('span','interest-more',`＋${hobbies.length-3}`));nameRow.append(cues);}
  left.append(nameRow);
  left.append(el("div", "assignment", assignmentText(person.assignment)));
  const profileTags = Array.isArray(person.profile_tags) ? person.profile_tags.filter(tag=>tag && !isChildrenTag(tag) && !interestIconForTag(tag)) : [];
  const childLabel = childrenInfo(person).label;
  if (childLabel) left.append(el('div','children-badge',childLabel));
  if (profileTags.length) {
    const tagRow = el("div", "person-card-tags");
    profileTags.slice(0,2).forEach(tag => tagRow.append(el("span", "identity-tag", tag)));
    if (profileTags.length > 2) tagRow.append(el("span", "identity-tag more-tag", `＋${profileTags.length-2}`));
    left.append(tagRow);
  }
  const recap = context ? conversationRecap(context) : "";
  if (recap) left.append(el("div", "person-last-conversation", `前回：${recap}`));
  button.append(createPersonAvatar(person), left, el("div", "chevron", "›"));
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

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function followUpBucket(item, today, weekEnd) {
  const due = String(item.due_at || "").slice(0, 10);
  if (!due) return "undated";
  if (due < today) return "overdue";
  if (due === today) return "today";
  return due <= weekEnd ? "week" : "later";
}

function followUpChanges(body, dueAt) {
  const trimmed = String(body || "").trim();
  return trimmed ? { body: trimmed, due_at: String(dueAt || "").trim() || null } : null;
}

function openFollowUpEditor(card, item) {
  const form = el("form", "follow-up-edit-form");
  const linked = Boolean(item.source_quote);
  const body = document.createElement(linked ? "textarea" : "input");
  if (linked) { body.readOnly = true; body.rows = 3; }
  else body.type = "text";
  body.maxLength = 5000;
  body.required = true;
  body.value = followUpQuote(item).text;
  body.setAttribute("aria-label", linked ? "元の会話の引用" : "次に聞くことを編集");
  const due = document.createElement("input");
  due.type = "date";
  due.value = String(item.due_at || "").slice(0, 10);
  due.setAttribute("aria-label", "次回目安を編集");
  const save = el("button", "primary", "変更を保存");
  save.type = "submit";
  const cancel = el("button", "quiet-button", "キャンセル");
  cancel.type = "button";
  cancel.addEventListener("click", () => { renderAll(); if (state.person) renderDetail(); });
  form.append(body);
  if (linked) form.append(el("p", "hint", "元の話は引用として残します。ここでは次回目安を変更できます。"));
  form.append(due, save, cancel);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const changes = linked ? {due_at: due.value || null} : followUpChanges(body.value, due.value);
    if (!changes) return toast("次に聞くことを入力してください。", true);
    if(!linked && changes.body.length>1000)return toast('次に聞くことは1000文字以内にしてください。',true);
    save.disabled = true;
    try {
      const { error } = await state.client.from("follow_up_items").update(changes)
        .eq("follow_up_id", item.follow_up_id);
      if (error) throw error;
      [state.followUps, state.person?.followUps || []].forEach((rows) => rows.forEach((row) => {
        if (row.follow_up_id === item.follow_up_id) Object.assign(row, changes);
      }));
      renderAll();
      if (state.person) renderDetail();
      toast("次に聞くことを更新しました");
    } catch (error) {
      toast(message(error), true);
    } finally { save.disabled = false; }
  });
  card.replaceChildren(form);
  body.focus();
}

function followUpMoreActions(item, card) {
  const more = el("details", "follow-up-more");
  const trigger = el("summary", "follow-up-more-trigger", "…");
  trigger.setAttribute("aria-label", `「${item.body}」の編集・削除`);
  const menu = el("div", "follow-up-menu");
  const edit = el("button", "quiet-button follow-up-edit", "編集");
  edit.type = "button";
  edit.addEventListener("click", () => {
    more.open = false;
    openFollowUpEditor(card, item);
  });
  const remove = el("button", "delete-button", "削除");
  remove.type = "button";
  remove.addEventListener("click", () => {
    more.open = false;
    trigger.focus();
    deleteFollowUp(item);
  });
  more.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    more.open = false;
    trigger.focus();
  });
  more.addEventListener("toggle", () => {
    if (!more.open) return;
    document.querySelectorAll(".follow-up-more[open]").forEach((other) => {
      if (other !== more) other.open = false;
    });
  });
  menu.append(edit, remove);
  more.append(trigger, menu);
  return more;
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
  const quote=followUpQuote(item);
  const body=el(state.linksAvailable && canEditPeople()?'button':'div','follow-up-body',quote.text);
  if(state.linksAvailable && canEditPeople()){body.type='button';body.addEventListener('click',()=>openFollowUp(item));}
  copy.append(body);
  if(item.source_quote)copy.append(el('div','follow-up-date',`${dateText(quote.occurred_at)}の会話メモ`));
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
  done.addEventListener("click", () => state.linksAvailable ? openFollowUp(item) : completeFollowUp(item));
  actions.append(done, followUpMoreActions(item, card));
  card.append(copy, actions);
  return card;
}

function renderFollowUps() {
  const target = byId("follow-up-list");
  clear(target);
  const todayDate = new Date();
  const today = localDateKey(todayDate);
  const weekEndDate = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate());
  weekEndDate.setDate(weekEndDate.getDate() + 6 - ((weekEndDate.getDay() + 6) % 7));
  const weekEnd = localDateKey(weekEndDate);
  const openItems = state.followUps.filter((item) => item.status === "open");
  const groups = [
    ["overdue", "期限切れ"],
    ["today", "今日"],
    ["week", "今週"],
    ["later", "来週以降"],
    ["undated", "日付未設定"],
  ];
  const counts = {};
  groups.forEach(([bucket, label]) => {
    const rows = openItems.filter((item) => followUpBucket(item, today, weekEnd) === bucket).sort(followUpSort);
    counts[bucket] = rows.length;
    if (!rows.length) return;
    const section = el("section", "follow-up-group");
    section.append(el("h3", "follow-up-group-title", `${label}　${rows.length}件`));
    rows.forEach((item) => section.append(followUpCard(item, true)));
    target.append(section);
  });
  byId("follow-up-summary").textContent = `期限切れ ${counts.overdue}件 · 今日 ${counts.today}件 · 今週 ${counts.week}件`;
  if (!openItems.length)
    target.append(el("div", "empty", "次に聞くことはありません"));
}

function renderRecent() {
  renderRows(
    byId("recent-list"),
    state.conversations.slice(0, 50),
    "会話メモはまだありません",
    (row) => row,
  );
  renderMemoSearch();
}

function renderMemoSearch() {
  const query = normalize(byId("memo-search").value);
  const target = byId("memo-search-results");
  clear(target);
  byId("recent-section").hidden = Boolean(query);
  if (!query) {
    byId("memo-search-count").textContent = "";
    return;
  }
  const matches = state.conversations.filter((row) =>
    personById(row.person_id) && normalize(`${row.recap || ""} ${row.note || ""}`).includes(query),
  );
  byId("memo-search-count").textContent = `${matches.length}件見つかりました${matches.length > 100 ? "（最初の100件を表示）" : ""}`;
  matches.slice(0, 100).forEach((row) => {
    const person = personById(row.person_id);
    const button = el("button", "memo-result");
    button.type = "button";
    button.append(
      el("strong", "", person.canonical_name),
      el("time", "", dateText(row.occurred_at)),
      el("span", "memo-result-note", conversationRecap(row)),
    );
    button.addEventListener("click", async () => {
      await openPerson(row.person_id);
      if (!state.person) return;
      state.expandedConversations = true;
      renderDetail();
      const conversation = [...byId("detail-body").querySelectorAll("[data-conversation-id]")]
        .find((node) => node.dataset.conversationId === row.conversation_id);
      conversation?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    target.append(button);
  });
  if (!matches.length) target.append(el("div", "empty", "一致する会話メモはありません"));
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
  photoObserver?.disconnect();photoObserver=null;
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

function familyMemberChanges(values, previous = null) {
  const displayName = String(values.name || "").trim();
  const birthDate = String(values.birth || "").trim();
  const ageValue = String(values.age ?? "").trim();
  const observedOn = String(values.observed || localDateKey()).trim();
  if (!birthDate && (!ageValue || !observedOn)) return null;
  const age = Number(ageValue);
  if (!birthDate && (!Number.isInteger(age) || age < 0 || age > 130)) return null;
  if (birthDate && (Number.isNaN(new Date(`${birthDate}T00:00:00`).getTime()) || birthDate > localDateKey())) return null;
  const keepAnchor = previous && !previous.birth_date && !birthDate && age === currentChildAge(previous);
  return {
    display_name: displayName,
    birth_date: birthDate || null,
    observed_age: birthDate ? null : keepAnchor ? previous.observed_age : age,
    observed_on: birthDate ? null : keepAnchor ? previous.observed_on : observedOn,
  };
}

async function persistChildrenInfo(detail, values) {
  const id = detail.person.person_id;
  const columns = state.childrenPresenceAvailable ? 'person_id,profile_tags,children_present' : 'person_id,profile_tags';
  if (!state.childrenPresenceAvailable && !values.hasChildren && (detail.person.hasKnownChildren || detail.familyMembers?.some(member=>member.relationship === 'child')))
    throw new Error('子ども情報の解除に必要な保存設定がまだ反映されていません。画面を再読み込みしてください。');
  const {data: latest, error: readError} = await state.client.from('people').select(columns).eq('person_id',id).single();
  if (readError) throw readError;
  const profile_tags = childrenProfileTags(latest.profile_tags,values);
  const changes = {profile_tags};
  if (state.childrenPresenceAvailable) changes.children_present=Boolean(values.hasChildren);
  let query = state.client.from('people').update(changes).eq('person_id',id).eq('profile_tags',JSON.stringify(latest.profile_tags));
  if (state.childrenPresenceAvailable) query = latest.children_present == null ? query.is('children_present',null) : query.eq('children_present',latest.children_present);
  const {data, error} = await query.select(columns).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('別の画面でタグが更新されました。画面を開き直してから保存してください。');
  detail.person.profile_tags = data.profile_tags;
  if (state.childrenPresenceAvailable) detail.person.children_present = data.children_present;
}

function childrenSummaryForm(detail) {
  const form = el('form','children-summary-form');
  const known = detail.familyMembers.some(member=>member.relationship === 'child');
  const info = childrenInfo({...detail.person,hasKnownChildren:known || detail.person.hasKnownChildren});
  const presence = makeField('子どもがいる','children-present','checkbox');
  presence.input.checked = info.hasChildren;
  const count = makeField('人数（わかる場合）','children-count','number',info.count ?? '');
  count.input.min='1';count.input.max='30';count.input.inputMode='numeric';
  const sync = ()=>{count.input.disabled=!presence.input.checked;if(!presence.input.checked) count.input.value='';};
  presence.input.addEventListener('change',sync);sync();
  const save = el('button','secondary','有無・人数を保存');save.type='submit';
  form.append(presence.label,count.label,el('p','field-hint','チェックを外して保存すると一覧の表示を解除できます。登録済みの年齢は削除されません。'),save);
  form.addEventListener('submit',async event=>{
    event.preventDefault();save.disabled=true;
    try {
      await persistChildrenInfo(detail,{hasChildren:presence.input.checked,count:count.input.value});
      state.profileDetailsOpen=true;renderDetail();toast('子ども情報を保存しました');
      try {await loadDirectory();} catch {toast('子ども情報は保存済みです。一覧の更新に失敗したため、後で画面を再読み込みしてください。',true);}
    } catch(error) {toast(message(error),true);} finally {save.disabled=false;}
  });
  return form;
}

function childAgeFields(prefix, member = {}) {
  const subject = member.relationship && member.relationship !== 'child' ? '家族' : '子ども';
  const age = makeField(`${subject}の年齢（わかる場合）`,`${prefix}-age`,'number',currentChildAge(member) ?? '');
  age.input.min='0';age.input.max='130';age.input.inputMode='numeric';
  const extra=el('details','family-extra');extra.append(el('summary','',`${subject}の呼び名・誕生日（任意）`));
  const name=makeField(`${subject}の呼び名`,`${prefix}-name`,'text',member.display_name || '');
  const birth=makeField(`${subject}の生年月日`,`${prefix}-birth`,'date',member.birth_date || '');birth.input.max=localDateKey();
  name.input.maxLength=100;
  const sync=()=>{age.input.disabled=Boolean(birth.input.value);};birth.input.addEventListener('input',sync);sync();
  extra.append(name.label,birth.label);
  return {age,name,birth,extra};
}

function identityCard(detail, options = {}) {
  const person = detail.person;
  const style = cardStyleId(person);
  const icon = iconStyleId(person);
  const frame = iconFrameId(person);
  const identity = el(
    "section",
    "card identity-card",
  );
  identity.append(createCardArtwork(person, {draftUrl:options.draftUrl, interactive:true}));

  const panel = el("div", `identity-panel frame-${frame}`);
  if (icon !== "none") {
    const iconFrame = el("div", `identity-icon frame-${frame}`);
    iconFrame.append(svgIcon(icon));
    panel.append(iconFrame);
  }
  const copy = el("div", "identity-copy");
  copy.append(el("h1", "", person.canonical_name));
  const age=personAgeSummary(person.age_info);
  if (age.ageLabel || age.birthdayLabel) copy.append(el('div','person-age-summary',[age.ageLabel,age.birthdayLabel].filter(Boolean).join(' · ')));
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
    ? person.profile_tags.filter(tag=>tag && !isChildrenTag(tag))
    : [];
  const childLabel = childrenInfo({...person,hasKnownChildren:person.hasKnownChildren || detail.familyMembers?.some(member=>member.relationship === 'child')}).label;
  if (childLabel) copy.append(el('div','children-badge',childLabel));
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

function familyMemberEditor(detail, member, onCancel) {
  const form = el("form", "family-edit-form");
  const prefix = `family-edit-${member.family_member_id}`;
  const {name,birth,age,extra} = childAgeFields(prefix,member);
  const hint = el("p", "field-hint wide", "誕生日が不明でも年齢だけで保存できます。推定年齢は毎年進みます。");
  const save = el("button", "primary", "変更を保存");
  save.type = "submit";
  const cancel = el("button", "quiet-button", "キャンセル");
  cancel.type = "button";
  cancel.addEventListener("click", onCancel);
  form.append(age.label,extra,hint,save,cancel);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const changes = familyMemberChanges({
      name: name.input.value, birth: birth.input.value,
      age: age.input.value,
    },member);
    if (!changes) return toast("年齢または生年月日を入力してください。", true);
    save.disabled = true;
    try {
      const { data, error } = await state.client.from("family_members")
        .update(changes).eq("family_member_id", member.family_member_id)
        .select().single();
      if (error) throw error;
      const index = detail.familyMembers.findIndex((item) => item.family_member_id === member.family_member_id);
      if (index >= 0) detail.familyMembers[index] = data;
      state.profileDetailsOpen = true;
      renderDetail();
      toast("家族情報を更新しました");
    } catch (error) {
      toast(message(error), true);
    } finally {
      save.disabled = false;
    }
  });
  return form;
}

function renderProfileDetails(detail) {
  const details = el("details", "card profile-details");
  details.open = state.profileDetailsOpen;
  details.addEventListener("toggle", () => { state.profileDetailsOpen = details.open; });
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
  family.append(el("h3", "", "子どもの情報"),el('p','field-hint','この枠は子どもについての入力欄です。本人の年齢は上部の「編集」へ。'));
  if (canEditPeople()) {
    const overview=el('fieldset','children-block');
    overview.append(el('legend','','子どもの有無・人数'),childrenSummaryForm(detail));family.append(overview);
  }
  const paused = detail.person.children_present === false;
  const registered = el(paused ? 'details' : 'section','children-block children-records');
  registered.append(el(paused ? 'summary' : 'h4','',paused ? '表示を解除した子どもの記録' : '登録済みの子ども'));
  if (paused) registered.append(el('p','field-hint','記録は削除していません。「子どもがいる」にチェックを戻して保存すると、一覧でも再表示します。'));
  const otherFamily = el('section','other-family');
  otherFamily.append(el('h4','','その他の家族'));
  detail.familyMembers.forEach((member) => {
    const row = el("div", "family-row");
    const summary = el("div", "family-row-summary");
    summary.append(el("strong", "", member.display_name || (member.relationship === 'child' ? '子ども' : '家族')),
      el("span", "pill", ageText(member)));
    row.append(summary);
    if (canEditPeople()) {
      const edit = el("button", "quiet-button compact-button family-edit-button", "編集");
      edit.type = "button";
      edit.setAttribute("aria-label", `${member.display_name || "家族情報"}を編集`);
      edit.addEventListener("click", () => {
        state.profileDetailsOpen = true;
        row.replaceChildren(familyMemberEditor(detail, member, () => renderDetail()));
      });
      row.append(edit);
    }
    (member.relationship === 'child' ? registered : otherFamily).append(row);
  });
  if (!detail.familyMembers.some(member=>member.relationship === 'child')) {
    registered.append(el("div", "empty compact-empty", "子どもの年齢は未登録です"));
  }
  family.append(registered);
  if (canEditPeople()) {
    const addBlock=el('fieldset','children-block children-add');
    addBlock.append(el('legend','','子どもを1人追加'));
    const form = el("form", "family-form");
    if (paused) {
      addBlock.append(el('p','field-hint','追加するときは「子どもがいる」にチェックを戻し、「有無・人数を保存」を押してください。'));
    }
    form.hidden=paused;
    const {name,birth,age,extra} = childAgeFields('family');
    const save = el("button", "secondary wide", "この子どもの情報を追加");
    save.type = "submit";
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const changes = familyMemberChanges({
        name: name.input.value, birth: birth.input.value,
        age: age.input.value,
      });
      if (!changes) {
        toast("年齢または生年月日を入力してください。人数だけなら上の欄で保存できます。", true);
        return;
      }
      save.disabled = true;
      try {
        const { data, error } = await state.client
          .from("family_members")
          .insert({
            person_id: detail.person.person_id,
            relationship: "child",
            ...changes,
          })
          .select()
          .single();
        if (error) throw error;
        detail.familyMembers.push(data);
        detail.person.hasKnownChildren = true;
        state.profileDetailsOpen = true;
        renderDetail();
        toast("子ども情報を保存しました");
        try {await loadDirectory();} catch {toast('子ども情報は保存済みです。一覧の更新に失敗したため、後で画面を再読み込みしてください。',true);}
      } catch (error) {
        toast(message(error), true);
      } finally {
        save.disabled = false;
      }
    });
    form.append(age.label,extra,el('p','field-hint wide','確認日は自動で記録します。年齢は誕生日が分からない場合の目安です。'),save);
    addBlock.append(form);family.append(addBlock);
  }
  content.append(family);
  if (otherFamily.childNodes.length > 1) content.append(otherFamily);
  details.append(content);
  return details;
}

function renderPrepCard(detail) {
  const card = el("section", "card prep-card");
  card.append(el("h2", "", "会う前に確認"));
  const latest = detail.conversations.find((item) => conversationRecap(item));
  card.append(el("strong", "prep-label", "前回の話"));
  card.append(el("p", "prep-date", latest ? dateText(latest.occurred_at) : "会話記録はまだありません"));
  if (latest) card.append(el("p", "prep-recap", conversationRecap(latest)));
  return card;
}

function compactPersonIdentity(detail) {
  const person=detail.person,section=el('section','compact-person-identity');
  const avatar=createPersonAvatar(person);
  const copy=el('div','compact-person-copy');
  copy.append(el('h1','',person.canonical_name));
  if(person.name_kana)copy.append(el('p','person-reading',person.name_kana));
  const assignment=currentAssignment(detail.assignments);
  copy.append(el('p','compact-person-assignment',assignment?[assignment.organization,assignment.department,assignment.role].filter(Boolean).join(' / '):'所属未登録'));
  const age=personAgeSummary(person.age_info),family=childrenInfo({...person,hasKnownChildren:person.hasKnownChildren || detail.familyMembers?.some(member=>member.relationship==='child')}).label;
  if(age.ageLabel || age.birthdayLabel || family)copy.append(el('p','compact-person-attributes',[age.ageLabel,age.birthdayLabel,family].filter(Boolean).join(' · ')));
  if (canEditPeople() && state.cardImageAvailable) {
    const edit = el("button", "person-avatar-edit");
    edit.type = "button";
    edit.setAttribute("aria-label", "アイコンを編集");
    edit.append(avatar, el("span", "", "編集"));
    edit.addEventListener("click", openAvatarEditor);
    section.append(edit, copy);
  } else section.append(avatar,copy);
  const hobbies=interestsForTags(person.profile_tags);
  if(hobbies.length){
    const cues=el('div','detail-interests');cues.setAttribute('aria-label','趣味・関心');
    hobbies.forEach(icon=>{const item=el('span','detail-interest');item.append(interestImage(icon,'detail-interest-icon'),el('span','',icon.label));cues.append(item);});
    section.append(cues);
  }
  return section;
}

function renderDetail() {
  const detail = state.person;
  if (!detail) return;
  const target = byId("detail-body");
  clear(target);
  byId("detail-title").textContent = detail.person.canonical_name;
  byId("person-edit").hidden = !canEditPeople();
  target.append(compactPersonIdentity(detail), renderPrepCard(detail));

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
  const notedConversations = exportableConversations(detail);
  const conversationHead = el("div", "section-heading");
  const conversationTitle = el("div", "section-title-with-count");
  conversationTitle.append(
    el("h2", "", "最近の会話履歴"),
    el("span", "count-pill neutral", `${notedConversations.length}件`),
  );
  const exportButton = el("button", "quiet-button compact-button", "メモを書き出す");
  exportButton.type = "button";
  exportButton.addEventListener("click", openMemoExport);
  conversationHead.append(conversationTitle, exportButton);
  conversations.append(conversationHead);
  const shownConversations = state.expandedConversations
    ? notedConversations
    : notedConversations.slice(0, 3);
  shownConversations.forEach((conversation) => {
    const card = el("article", "conversation");
    card.dataset.conversationId = conversation.conversation_id;
    const head = el("div", "conversation-head");
    head.append(el("time", "", dateText(conversation.occurred_at)));
    if (canEditPeople()) {
      const edit = el("button", "quiet-button compact-button", "編集");
      edit.type = "button";
      edit.addEventListener("click", () => openConversationEditor(conversation));
      head.append(edit);
      const remove = el("button", "delete-button compact-button", "削除");
      remove.type = "button";
      remove.addEventListener("click", () => deleteConversation(conversation));
      head.append(remove);
    }
    const text=conversation.note || conversation.recap || '';
    card.append(head,el('p','conversation-history-text',text.length>180?text.slice(0,180)+'…':text));
    if(text.length>180){const full=el('details','conversation-full');full.append(el('summary','','全文を読む'),el('p','conversation-history-text',text));card.append(full);}
    if(conversation.reply_quote){
      const previous=el('details','conversation-previous');
      previous.append(el('summary','','前の話を見る'),quoteBlock(conversation.reply_quote));
      if(conversation.reply_to_conversation_id){
        const original=detail.conversations.find(row=>row.conversation_id===conversation.reply_to_conversation_id);
        if(original){const link=detailSectionButton('元の会話を開く',()=>{state.expandedConversations=true;renderDetail();
          const source=[...byId('detail-body').querySelectorAll('[data-conversation-id]')].find(node=>node.dataset.conversationId===original.conversation_id);source?.scrollIntoView({block:'center',behavior:'smooth'});});previous.append(link);}
      }
      card.append(previous);
    }
    if(detail.followUps.some(item=>item.status==='open' && item.source_conversation_id===conversation.conversation_id))card.append(el('span','history-next-badge','次回聞く'));
    conversations.append(card);
  });
  if (!notedConversations.length) {
    conversations.append(el("div", "empty", "最初の会話メモを残しましょう"));
  } else if (notedConversations.length > 3) {
    conversations.append(
      detailSectionButton(
        state.expandedConversations
          ? "最新3件に戻す"
          : `すべての履歴を見る（残り${notedConversations.length - 3}件）`,
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
  if (!byId('composer').hidden) closeComposer();
  closeMemoExport();
  closeAvatarEditor({restoreFocus:false, force:true});
  if (!byId("topic-picker").hidden) closeTopicPicker({restoreFocus:false, force:true});
  const request = ++state.detailRequest;
  const userId = state.session?.user?.id;
  const current = () => request === state.detailRequest && userId === state.session?.user?.id;
  state.person = null;
  state.profileDetailsOpen = false;
  state.followUpSelectionMode = false;
  state.selectedFollowUpIds.clear();
  state.expandedFollowUps = false;
  state.expandedConversations = false;
  state.followUpAddOpen = false;
  byId("person-detail").hidden = false;
  byId("person-edit").hidden = true;
  byId("composer-open").hidden = true;
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
      selectPersonConversations(personId),
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
          followUpColumns(),
        )
        .eq("person_id", personId)
        .order("created_at", { ascending: false }),
    ]);
    if (!current()) return;
    const error = [
      personResult,
      assignmentsResult,
      conversationsResult,
      eventsResult,
      familyResult,
      followUpsResult,
    ].find((result) => result.error)?.error;
    if (error) throw error;
    if (!personResult.data) throw new Error("人物を読み込めませんでした。");
    state.recapAvailable = conversationsResult.recapAvailable;
    state.person = {
      person: {...personResult.data,hasKnownChildren:state.directory.find(person=>person.person_id === personId)?.hasKnownChildren || false},
      assignments: assignmentsResult.data.sort(compareFiscalYear),
      conversations: conversationsResult.data,
      events: eventsResult.data,
      familyMembers: familyResult.data,
      followUps: followUpsResult.data,
    };
    byId("person-edit").hidden = !canEditPeople();
    byId("composer-open").hidden = !canEditPeople();
    renderDetail();
  } catch (error) {
    if (!current()) return;
    toast(message(error), true);
    closeDetail();
  }
}

function closeDetail() {
  captureConversationDraft();
  state.detailRequest++;
  byId("person-detail").hidden = true;
  closeMemoExport();
  closeAvatarEditor({restoreFocus:false, force:true});
  byId("composer").hidden = true;
  closeTopicPicker({restoreFocus:false, force:true});
  byId("person-editor").hidden = true;
  syncPersonEditorLayers();
  document.body.style.overflow = "";
  state.person = null;
  state.followUpSelectionMode = false;
  state.selectedFollowUpIds.clear();
  state.selectedTopicIds.clear();
  state.expandedFollowUps = false;
  state.expandedConversations = false;
  state.followUpAddOpen = false;
  state.profileDetailsOpen = false;
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

function mergePersonTags(existing, raw) {
  return [...new Set([...existing, ...splitTags(raw)])].slice(0, 30);
}

function suggestPersonTags(directory, selected, query) {
  const needle = normalize(query);
  if (!needle) return [];
  const counts = new Map();
  directory.forEach((person) => {
    new Set(Array.isArray(person.profile_tags) ? person.profile_tags : []).forEach((tag) => {
      if (tag && !tag.startsWith("#") && !tag.includes("@@") && !selected.includes(tag)) {
        counts.set(tag, (counts.get(tag) || 0) + 1);
      }
    });
  });
  return [...counts]
    .filter(([tag]) => normalize(tag).includes(needle))
    .sort(([left, leftCount], [right, rightCount]) => rightCount - leftCount || left.localeCompare(right, "ja"))
    .slice(0, 8)
    .map(([tag]) => tag);
}

function renderPersonTagEditor() {
  const list = byId("person-tag-list");
  clear(list);
  state.editorTags.forEach((tag) => {
    const chip = el("span", "person-tag-chip");
    const icon=interestIconForTag(tag);if(icon){const image=interestImage(icon,'tag-interest-icon');image.alt='';chip.append(image);}
    chip.append(el("span", "", tag));
    const remove = el("button", "person-tag-remove", "×");
    remove.type = "button";
    remove.setAttribute("aria-label", `${tag}を削除`);
    remove.addEventListener("click", () => {
      state.editorTags = state.editorTags.filter((item) => item !== tag);
      renderPersonTagEditor();
        });
    chip.append(remove);
    list.append(chip);
  });

  const atLimit = state.editorTags.length >= 30;
  byId("person-tag-input").disabled = atLimit;
  byId("person-tag-add").disabled = atLimit;
  renderTagCategories('person-tag-categories',state.editorTagCategory,category=>{state.editorTagCategory=category;renderPersonTagEditor();});
  if (byId('person-tag-input').value.trim()) byId('person-tag-picker').open=true;
  const suggestions = byId("person-tag-suggestions");
  clear(suggestions);
  const options = atLimit
    ? []
    : tagChoices(state.directory,state.conversations,state.editorTags,byId("person-tag-input").value,state.editorTagCategory).map(item=>item.label);
  if (options.length) {
    suggestions.append(el("span", "person-tag-suggestions-label", "タグを選ぶ"));
    options.forEach((tag) => {
      const button = el("button", "person-tag-suggestion");
      const icon=interestIconForTag(tag);if(icon){const image=interestImage(icon,'tag-interest-icon');image.alt='';button.append(image);}
      button.append(el('span','',tag));
      button.type = "button";
      button.addEventListener("click", () => {
        state.editorTags = mergePersonTags(state.editorTags, tag);
        byId("person-tag-input").value = "";
        renderPersonTagEditor();
            });
      suggestions.append(button);
    });
  }
  suggestions.hidden = !options.length;
}

function commitPersonTagInput() {
  const input = byId("person-tag-input");
  const candidates = splitTags(input.value);
  if (!candidates.length) return true;
  const next = mergePersonTags(state.editorTags, input.value);
  if (candidates.some((tag) => !next.includes(tag))) {
    toast("タグは30件まで追加できます。", true);
    input.focus();
    return false;
  }
  state.editorTags = next;
  input.value = "";
  renderPersonTagEditor();
  return true;
}

function avatarSelection(editor) {
  if (editor.mode === "photo") return editor.photo;
  if (editor.mode === "illustration" && editor.interestId) {
    return {mode:"theme", avatarInterestId:editor.interestId};
  }
  return {mode:"theme"};
}

function renderAvatarPreview() {
  const editor = state.avatarEditor;
  if (!editor) return;
  const draftUrl = editor.mode === "photo" ? editor.photoUrl : null;
  const person = {...editor.detail.person, card_image:avatarSelection(editor)};
  byId("avatar-preview").replaceChildren(createPersonAvatar(person, {draftUrl}));
  byId("photo-file").disabled = Boolean(editor.preparing || editor.saving);
  byId("avatar-save").disabled = editor.saving || editor.preparing ||
    (editor.mode === "photo" && !editor.photo.path) ||
    (editor.mode === "illustration" && !editor.interestId);
}

function renderAvatarIllustrations() {
  const editor = state.avatarEditor;
  if (!editor || editor.mode !== "illustration") return;
  const grid = byId("illustration-options");
  const items = filterInterestIcons(byId("illustration-search").value);
  grid.replaceChildren();
  byId("illustration-empty").hidden = items.length > 0;
  items.forEach(item => {
    const button = el("button", "illustration-option");
    const label = el("span", "", item.label);
    const image = el("img");
    image.alt = "";
    image.loading = "lazy";
    image.src = item.src;
    button.type = "button";
    const selected = item.id === editor.interestId;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
    button.append(image, label);
    button.addEventListener("click", () => {
      editor.interestId = item.id;
      const previous = grid.querySelector('[aria-pressed="true"]');
      previous?.classList.remove("selected");
      previous?.setAttribute("aria-pressed", "false");
      button.classList.add("selected");
      button.setAttribute("aria-pressed", "true");
      renderAvatarPreview();
    });
    grid.append(button);
  });
}

function renderAvatarEditor() {
  const editor = state.avatarEditor;
  const methods = byId("image-method-options");
  methods.querySelectorAll("button").forEach(button => {
    const selected = editor.mode === button.dataset.avatarMode;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  byId("illustration-panel").hidden = editor.mode !== "illustration";
  byId("photo-panel").hidden = editor.mode !== "photo";
  byId("photo-controls").disabled = !editor.photo.path;
  byId("photo-x").value = editor.photo.x;
  byId("photo-y").value = editor.photo.y;
  byId("photo-zoom").value = editor.photo.zoom;
  renderAvatarIllustrations();
  renderAvatarPreview();
}

function openAvatarEditor(event) {
  if (!canEditPeople() || !state.cardImageAvailable || !state.person) return;
  const original = state.person.person.card_image ?? null;
  const image = normalizeCardImage(original);
  const interestId = interestIcons.find(icon => icon.id === image.avatarInterestId)?.id;
  state.avatarEditor = {
    detail:state.person, original, opener:event?.currentTarget,
    mode:image.mode === "photo" ? "photo" : interestId ? "illustration" : "theme",
    interestId,
    photo:image.mode === "photo" ? image : {mode:"photo", x:.5, y:.5, zoom:1},
  };
  byId("illustration-search").value = "";
  byId("photo-status").textContent = "";
  byId("avatar-editor").hidden = false;
  byId("avatar-editor-content").scrollTop = 0;
  renderAvatarEditor();
  syncPersonEditorLayers();
  byId("avatar-editor-close").focus({preventScroll:true});
}

function closeAvatarEditor({restoreFocus = true, force = false} = {}) {
  const editor = state.avatarEditor;
  if (!editor || (editor.saving && !force)) return;
  state.avatarEditor = null;
  if (editor.photoUrl) URL.revokeObjectURL(editor.photoUrl);
  byId("photo-file").value = "";
  byId("photo-file").disabled = false;
  byId("avatar-preview").replaceChildren();
  byId("avatar-editor").hidden = true;
  byId("avatar-editor-content").inert = false;
  byId("avatar-editor-close").disabled = false;
  byId("avatar-save").textContent = "保存する";
  syncPersonEditorLayers();
  if (restoreFocus) editor.opener?.focus({preventScroll:true});
}

async function choosePhoto() {
  const editor = state.avatarEditor;
  const input = byId("photo-file");
  const file = input.files[0];
  if (!editor || editor.saving || editor.preparing || !file) return;
  editor.preparing = true;
  renderAvatarPreview();
  byId("photo-status").textContent = "写真を準備しています…";
  try {
    const blob = await preparePhoto(file);
    if (editor !== state.avatarEditor) return;
    if (editor.photoUrl) URL.revokeObjectURL(editor.photoUrl);
    editor.photoBlob = blob;
    editor.photoUrl = URL.createObjectURL(blob);
    editor.photo = {mode:"photo", path:"draft/00000000-0000-0000-0000-000000000000.jpg", x:.5, y:.5, zoom:1};
    byId("photo-status").textContent = "写真を準備できました。位置を調整して保存してください。";
  } catch (error) {
    if (editor === state.avatarEditor) byId("photo-status").textContent = message(error);
  } finally {
    if (editor === state.avatarEditor) {
      editor.preparing = false;
      input.value = "";
      renderAvatarEditor();
    }
  }
}

async function saveAvatar() {
  const editor = state.avatarEditor;
  if (!editor || editor.saving || editor.preparing || !canEditPeople() || !state.cardImageAvailable || !state.session) return;
  if (editor.mode === "illustration" && !interestIcons.some(icon => icon.id === editor.interestId)) return;
  const personId = editor.detail.person.person_id;
  const epoch = state.conversationEpoch;
  const userId = state.session.user.id;
  const client = state.client;
  const current = () => state.avatarEditor === editor && state.person === editor.detail &&
    state.conversationEpoch === epoch && state.session?.user?.id === userId && canEditPeople();
  if (!current()) return;
  editor.saving = true;
  const save = byId("avatar-save");
  save.textContent = "保存中…";
  byId("avatar-editor-content").inert = true;
  byId("avatar-editor-close").disabled = true;
  renderAvatarPreview();
  try {
    const image = await persistCardImage({
      personId, image:avatarSelection(editor), photoBlob:editor.photoBlob, oldImage:editor.original, store:photoStore,
      onCleanupError:() => console.warn("未使用写真の整理を完了できませんでした。"),
      save:async (cardImage, markWriteRejected) => {
        if (!current()) {
          markWriteRejected();
          throw new Error("編集を終了したため保存を中止しました。");
        }
        let query = client.from("people").update({card_image:cardImage}).eq("person_id", personId);
        query = editor.original === null ? query.is("card_image", null) : query.eq("card_image", JSON.stringify(editor.original));
        let data;
        try {
          const result = await query.select("person_id").maybeSingle();
          if (result.error) throw result.error;
          data = result.data;
        } catch (writeError) {
          // An exact read-back confirms the save even after a lost response.
          if (current()) {
            try {
              const saved = await client.from("people").select("card_image").eq("person_id", personId).maybeSingle();
              const image = saved.data?.card_image;
              if (current() && !saved.error && image?.mode === cardImage.mode &&
                  JSON.stringify(normalizeCardImage(image)) === JSON.stringify(cardImage)) return;
            } catch {
              // Keep the original error when the confirmation request also fails.
            }
          }
          throw writeError;
        }
        if (!data) {
          markWriteRejected();
          throw new Error("別の画面でアイコンが変更されました。人物を開き直してから編集してください。");
        }
      },
    });
    if (!current()) return;
    editor.detail.person.card_image = image;
    for (const person of [...state.people, ...state.directory]) {
      if (person.person_id === personId) person.card_image = image;
    }
    closeAvatarEditor({restoreFocus:false, force:true});
    renderAll();
    renderDetail();
    byId("detail-body").querySelector(".person-avatar-edit")?.focus({preventScroll:true});
    toast("アイコンを保存しました。");
  } catch (error) {
    if (current()) toast(message(error), true);
  } finally {
    if (state.avatarEditor === editor) {
      editor.saving = false;
      save.textContent = "保存する";
      byId("avatar-editor-content").inert = false;
      byId("avatar-editor-close").disabled = false;
      renderAvatarPreview();
    }
  }
}

function fillPersonAgeEditor(info) {
  state.editorOriginalAge=info || null;
  const values=personAgeInputs(info);
  byId('person-birthday').value=values.birthday;
  byId('person-age').value=values.age;
  byId('person-age-options').open=false;
  renderPersonAgeEditor();
}

function renderPersonAgeEditor() {
  const ageInput=byId('person-age');
  byId('person-birthday').disabled=!state.personAgeAvailable;
  ageInput.disabled=!state.personAgeAvailable;
  if (!state.personAgeAvailable) {
    byId('person-age-status').textContent='誕生日・年齢の保存設定は準備中です。現在の人物情報はそのまま保存できます。';
    return;
  }
  try {
    const birthday=personAgeValues({birthday:byId('person-birthday').value});
    ageInput.readOnly=Boolean(birthday?.birth_date);
    if (ageInput.readOnly) ageInput.value=String(personAgeSummary(birthday).age);
    const info=personAgeValues({birthday:byId('person-birthday').value,age:ageInput.value},state.editorOriginalAge);
    const summary=personAgeSummary(info);
    byId('person-age-status').textContent=info ? [summary.ageLabel,summary.birthdayLabel,
      summary.estimated ? `${info.observed_on.replaceAll('-','/')}に${info.observed_age}歳と確認` : ''].filter(Boolean).join(' · ') : '分かる方だけ入力できます。どちらも空欄で大丈夫です。';
  } catch (error) {
    ageInput.readOnly=false;
    byId('person-age-status').textContent=message(error);
  }
}

function fillPersonForm(person = null, assignments = []) {
  const assignment = currentAssignment(assignments);
  byId("person-name").value = person?.canonical_name || "";
  byId("person-kana").value = person?.name_kana || "";
  fillPersonAgeEditor(person?.age_info);
  state.editorTags = Array.isArray(person?.profile_tags)
    ? person.profile_tags.filter(Boolean)
    : [];
  state.editorOriginalTags = person?.profile_tags ?? null;
  state.editorOriginalChildren = person?.children_present ?? null;
  byId("person-tag-input").value = "";
  state.editorTagCategory='all';
  byId('person-tag-picker').open=false;
  renderPersonTagEditor();
  byId("person-fiscal-year").value =
    assignment?.fiscal_year || String(config.currentFiscalYear || "");
  byId("person-organization").value = assignment?.organization || "";
  byId("person-department").value = assignment?.department || "";
  byId("person-role").value = assignment?.role || "";
}

function syncPersonEditorLayers() {
  const editing = !byId("person-editor").hidden || !byId("avatar-editor").hidden;
  const covered = editing || !byId("memo-export").hidden || !byId("topic-picker").hidden;
  document.body.classList[editing ? "add" : "remove"]("person-editing");
  byId("person-detail").inert = covered;
  byId("app-screen").inert = covered;
}

function closeSessionOverlays() {
  // Session loss must bypass the normal close guard, including during a save.
  state.conversationEpoch++;
  state.detailRequest++;
  document.activeElement?.blur?.();
  ['person-editor','person-detail','composer','backup-dialog'].forEach(id=>{byId(id).hidden=true;});
  closeAvatarEditor({restoreFocus:false, force:true});
  closeMemoExport();
  closeTopicPicker({restoreFocus:false, force:true});
  state.browseTopicControls = newTopicControls();
  state.topicBrowseScroll = 0;
  state.topicPreferences.clear();
  switchView("people");
  syncPersonEditorLayers();
  byId('person-form').reset();
  byId('person-form').inert=false;
  byId('person-save').disabled=false;
  byId('person-save').textContent='保存する';
  byId('backup-form').reset();
  state.editorTags=[];
  state.editorPersonId=null;
  state.person=null;
  document.body.style.overflow='';
}

function preventPersonImplicitSubmit(event) {
  if(event.key!=='Enter' || event.isComposing || event.keyCode===229 || event.defaultPrevented) return;
  const input=event.target;
  if(input?.tagName!=='INPUT' || ['submit','button','checkbox','radio','file','range','color'].includes(input.type)) return;
  event.preventDefault();
  input.blur();
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
  syncPersonEditorLayers();
  document.body.style.overflow = "hidden";
  setTimeout(() => byId("person-name").focus(), 0);
}

function closePersonEditor() {
  if (byId("person-save").disabled) return;
  document.activeElement?.blur?.();
  byId("person-editor").hidden = true;
  syncPersonEditorLayers();
  byId("person-form").reset();
  state.editorTags = [];
  state.editorPersonId = null;
  document.body.style.overflow = byId("person-detail").hidden ? "" : "hidden";
}

async function savePerson(event) {
  event.preventDefault();
  if (!canEditPeople()) return;
  if (!commitPersonTagInput()) return;
  const name = byId("person-name").value.trim();
  if (!name) {
    toast("氏名を入力してください。", true);
    byId("person-name").focus();
    return;
  }
  const saveEpoch=state.conversationEpoch,saveUser=state.session?.user?.id;
  const sameLogin=()=>saveEpoch===state.conversationEpoch && saveUser===state.session?.user?.id;
  const personId =
    state.editorMode === "edit" && state.editorPersonId
      ? state.editorPersonId
      : generateId("per");
  const personValues = {
    canonical_name: name,
    name_kana: byId("person-kana").value.trim(),
    profile_tags: state.editorTags,
    active_status: "active",
  };
  if (state.editorMode === "create") personValues.aliases = [];
  if (state.personAgeAvailable) {
    try {personValues.age_info=personAgeValues({birthday:byId('person-birthday').value,age:byId('person-age').value},state.editorOriginalAge);}
    catch(error) {toast(message(error),true);byId('person-age-options').open=true;return;}
  }
  if (state.childrenPresenceAvailable) personValues.children_present=childrenPresenceAfterTagEdit(state.editorOriginalTags,state.editorTags,state.editorOriginalChildren);
  const fiscalYear = byId("person-fiscal-year").value.trim();
  const assignmentValues = {
    fiscal_year: fiscalYear,
    organization: byId("person-organization").value.trim(),
    department: byId("person-department").value.trim(),
    role: byId("person-role").value.trim(),
  };
  const existingAssignment =
    state.editorMode === "edit"
      ? state.person?.assignments.find((item) => item.person_id === personId && item.fiscal_year === fiscalYear)
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
  byId("person-form").inert = true;
  let personSaved=false;
  try {
    const writePerson = async () => {
      if(!sameLogin())throw new Error('ログイン状態が変わったため保存を中止しました。');
      let result;
      if (state.editorMode === "edit") {
        let query=state.client.from("people").update(personValues).eq("person_id",personId);
        if (state.childrenPresenceAvailable) {
          query=state.editorOriginalChildren==null ? query.is('children_present',null) : query.eq('children_present',state.editorOriginalChildren);
          query=state.editorOriginalTags==null ? query.is('profile_tags',null) : query.eq('profile_tags',JSON.stringify(state.editorOriginalTags));
        }
        if (state.personAgeAvailable) query=state.editorOriginalAge===null
          ? query.is('age_info',null) : query.eq('age_info',JSON.stringify(state.editorOriginalAge));
        result=await query.select("person_id").maybeSingle();
        if (!result.error && !result.data) throw new Error("別の画面で人物情報が変更されました。この画面を閉じて人物を開き直し、もう一度編集してください。");
      } else result = await state.client.from("people").insert({person_id:personId,...personValues,revision:1}).select("person_id").single();
      if (result.error) throw result.error;
    };
    await writePerson();
    if(!sameLogin())return;
    personSaved=true;
    if (state.personAgeAvailable) state.editorOriginalAge=personValues.age_info;
    state.editorOriginalChildren=personValues.children_present ?? null;
    state.editorOriginalTags=[...state.editorTags];
    const previousEditorMode=state.editorMode;
    state.editorPersonId=personId;
    state.editorMode="edit";

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
    if(!sameLogin())return;
    save.disabled = false;
    closePersonEditor();
    await loadDirectory();
    if(!sameLogin())return;
    await openPerson(personId);
    if(sameLogin())toast(previousEditorMode === "edit" ? "人物情報を更新しました" : "人物を追加しました");
  } catch (error) {
    if(!sameLogin())return;
    if (personSaved) {
      toast(`名前・タグなどの基本情報は保存しました。所属の保存を完了できませんでした。再試行してください：${message(error)}`,true);
    } else toast(message(error), true);
  } finally {
    if(sameLogin()){
      byId("person-form").inert = false;
      save.disabled = false;
      save.textContent = "保存する";
    }
  }
}

function renderTagCategories(id,selected,onSelect) {
  const target=byId(id);clear(target);
  for (const [key,label] of tagCategories) {
    const button=el('button',`tag-category${key === selected ? ' selected' : ''}`,label);button.type='button';
    button.setAttribute('aria-pressed',String(key === selected));
    button.addEventListener('click',()=>onSelect(key));target.append(button);
  }
}

function renderTags() {
  const target = byId("tag-list");
  clear(target);
  state.selectedTags.forEach((tag) => {
    const button = el('button','tag selected',`${tag} ×`);
    button.type = "button";
    button.setAttribute('aria-label',`${tag}を外す`);
    button.addEventListener("click", () => {
      state.selectedTags.delete(tag);
      renderTags();
      captureConversationDraft();
    });
    target.append(button);
  });
  renderTagCategories('conversation-tag-categories',state.conversationTagCategory,category=>{state.conversationTagCategory=category;renderTags();});
  const choices=byId('conversation-tag-options');clear(choices);
  const query=byId('conversation-tag-search').value;
  const add=tag=>{
    if (state.selectedTags.size >= 30) return toast('会話タグは30件まで選べます。',true);
    state.selectedTags.add(tag);byId('conversation-tag-search').value='';renderTags();
    captureConversationDraft();
  };
  for(const item of tagChoices(state.directory,state.conversations,state.selectedTags,query,state.conversationTagCategory)) {
    const button=el('button','person-tag-suggestion');button.type='button';
    const icon=interestIconForTag(item.label);if(icon){const image=interestImage(icon,'tag-interest-icon');image.alt='';button.append(image);}
    button.append(el('span','',item.label));
    button.addEventListener('click',()=>add(item.label));choices.append(button);
  }
  const custom=query.trim();
  const all=tagChoices(state.directory,state.conversations,[], '', 'all');
  if(custom && !all.some(item=>item.label.normalize('NFKC').toLowerCase() === custom.normalize('NFKC').toLowerCase()) && !state.selectedTags.has(custom)) {
    const button=el('button','quiet-button tag-custom-add',`「${custom}」を追加`);button.type='button';
    button.addEventListener('click',()=>add(custom));choices.append(button);
  }
}

function resetComposer() {
  byId("conversation-form").reset();
  state.editingConversationId = null;
  state.conversationJob = null;
  state.replyingFollowUp = null;
  state.composerMode = 'note';
  byId('conversation-ask-next').checked=false;
  byId('composer-options').open=false;
  byId('conversation-fields').disabled = false;
  byId('conversation-save-status').textContent = '';
  byId('discard-conversation-draft').hidden = true;
  byId("composer-title").textContent = "会話メモを追加";
  byId("save-conversation").textContent = "保存して履歴に戻る";
  byId("next-topics-section").hidden = true;
  byId("follow-up-date-section").hidden = false;
  state.selectedTags.clear();
  state.conversationTagCategory='all';
  byId('conversation-tag-search').value='';
  byId('conversation-tag-picker').open=false;
  byId('recap-options').open=false;
  renderTags();
}

function conversationScope() {
  const user = state.session?.user?.id, person = state.person?.person.person_id;
  return user && person ? [config.supabaseUrl || '', user, person,
    state.editingConversationId || (state.replyingFollowUp ? `reply:${state.replyingFollowUp.follow_up_id}` : state.composerMode==='questions'?'questions':'new')] : null;
}

function conversationDraftValue() {
  return {
    note: byId('conversation-note').value,
    recap: byId('conversation-recap').value,
    questions: byId('next-topics').value,
    due: byId('follow-up-at').value,
    tags: [...state.selectedTags],
    askNext: Boolean(byId('conversation-ask-next').checked),
    composerMode: state.composerMode,
    job: state.conversationJob,
  };
}

function captureConversationDraft() {
  const scope = conversationScope();
  if (!scope || byId('composer').hidden) return;
  const draft = conversationDraftValue();
  const hasContent = draft.job || draft.note || draft.recap || draft.questions || draft.due || draft.tags.length || draft.askNext;
  const durable = hasContent ? conversationDrafts.write(scope, draft) : conversationDrafts.remove(scope);
  byId('discard-conversation-draft').hidden = !hasContent;
  byId('conversation-fields').disabled = Boolean(draft.job);
  byId('save-conversation').disabled = state.conversationSaving;
  if (draft.job) {
    byId('save-conversation').textContent = state.conversationSaving ? '保存中…' : '保存を再試行';
    const progress = state.conversationSaving ? '保存中です。' : draft.job.conversationConfirmed
      ? '会話メモは保存済みです。次回の項目と完了状態の保存を再試行してください。'
      : '前回の保存完了を確認できていません。「保存を再試行」を押してください。';
    byId('conversation-save-status').textContent = progress + (durable
      ? '内容を保持しているので、閉じてもこのタブから続けられます。'
      : 'ブラウザに下書きを保持できないため、再読み込みやタブを閉じる操作は控えてください。');
  } else {
    byId('conversation-save-status').textContent = durable
      ? '下書きはこのタブに保持します。再読み込み後も同じ人物から開けます。ログアウトすると削除します。'
      : '下書きはこの画面を開いている間のみ保持します。再読み込みやタブを閉じると失われます。';
  }
  updateComposerControls();
}

function restoreConversationDraft() {
  const scope = conversationScope(), draft = scope && conversationDrafts.read(scope);
  if (draft) {
    byId('conversation-note').value = draft.note;
    byId('conversation-recap').value = draft.recap || '';
    byId('next-topics').value = draft.questions || '';
    byId('follow-up-at').value = draft.due || '';
    state.selectedTags = new Set(Array.isArray(draft.tags) ? draft.tags : []);
    state.conversationJob = draft.job || null;
    byId('conversation-ask-next').checked=Boolean(draft.askNext);
    if(!state.replyingFollowUp && !state.editingConversationId && state.composerMode!=='questions')state.composerMode=draft.composerMode || (draft.questions?'legacy':'note');
    byId('recap-options').open = Boolean(draft.recap);
    renderTags();
  }
  captureConversationDraft();
}

function discardConversationDraft() {
  if (state.conversationSaving) return;
  const warning = state.conversationJob
    ? '保存済みの会話や質問がある可能性があります。下書きだけを破棄しますか？ 保存済みの記録は残ります。'
    : 'この会話メモの下書きを破棄しますか？';
  if (!window.confirm(warning)) return;
  const scope = conversationScope();
  if (scope) conversationDrafts.remove(scope);
  byId('composer').hidden = true;
  resetComposer();
}

function clearConversationAccount() {
  state.conversationEpoch++;
  const user = state.session?.user?.id;
  if (user) conversationDrafts.clearAccount(config.supabaseUrl || '', user);
  byId('composer').hidden = true;
  resetComposer();
  state.person = null;
}

function openComposer(focusId = "conversation-note") {
  if (!state.person) return;
  if(focusId==='next-topics')state.composerMode='questions';
  byId("composer").hidden = false;
  restoreConversationDraft();
  renderComposerContext();
  byId('composer').setAttribute('aria-label',byId('composer-title').textContent);
  setTimeout(() => {
    byId(focusId)?.focus();
  }, 0);
}

function updateComposerControls() {
  const replying=Boolean(state.replyingFollowUp),editing=Boolean(state.editingConversationId);
  byId('composer-quote').hidden=!replying;
  byId('conversation-ask-next-label').hidden=!state.linksAvailable || editing || state.composerMode==='questions';
  byId('next-topics-section').hidden=editing || !['questions','legacy'].includes(state.composerMode);
  byId('conversation-note-section').hidden=state.composerMode==='questions';
  byId('composer-options').hidden=false;
  byId('recap-options').hidden=state.composerMode==='questions';
  byId('conversation-tag-picker').hidden=state.composerMode==='questions';
  byId('tag-list').hidden=state.composerMode==='questions';
  if(state.composerMode==='questions')byId('next-topics-section').hidden=false;
  byId('complete-without-note').hidden=!replying;
  byId('complete-without-note').disabled=state.conversationSaving || Boolean(state.conversationJob) ||
    Boolean(byId('conversation-note').value.trim() || byId('conversation-recap').value.trim() || byId('conversation-ask-next').checked);
  byId('conversation-note-label').textContent=replying?'今回わかったこと':'話したこと';
  byId('conversation-ask-next-text').textContent=replying?'この続きも次回聞く':'次回聞く';
  byId('composer-title').textContent=editing?'会話メモを編集':replying?'聞いたことを記録':state.composerMode==='questions'?'次に聞くことを追加':'会話メモを追加';
  if(!state.conversationJob)byId('save-conversation').textContent=editing?'変更を保存':replying?'保存して完了':'保存する';
}

function quoteBlock(quote,label='前の話') {
  const block=el('blockquote','conversation-quote');
  block.append(el('strong','',label));
  if(quote.occurred_at)block.append(el('time','prep-date',dateText(quote.occurred_at)));
  block.append(el('p','',quote.text));return block;
}

function renderComposerContext() {
  byId('composer-person').textContent=state.person?.person.canonical_name || '';
  byId('composer-quote').replaceChildren();
  if(state.replyingFollowUp)byId('composer-quote').append(quoteBlock(followUpQuote(state.replyingFollowUp)));
  updateComposerControls();
}

async function openFollowUp(item) {
  if(!canEditPeople())return;
  if(state.person?.person.person_id!==item.person_id)await openPerson(item.person_id);
  if(state.person?.person.person_id!==item.person_id)return;
  if(!byId('composer').hidden)closeComposer();
  state.replyingFollowUp={...item,source_quote:item.source_quote ? {...item.source_quote} : null};
  openComposer();
}

function openConversationEditor(conversation) {
  if (!canEditPeople()) return;
  if (!byId('composer').hidden) closeComposer();
  state.editingConversationId = conversation.conversation_id;
  byId("composer-title").textContent = "会話メモを編集";
  byId("save-conversation").textContent = "変更を保存";
  byId("conversation-note").value = conversation.note || conversation.recap || '';
  byId("conversation-recap").value = conversation.recap || '';
  byId('recap-options').open=Boolean(byId('conversation-recap').value);
  state.selectedTags=new Set(conversation.tags || []);
  renderTags();
  byId("next-topics-section").hidden = true;
  byId("follow-up-date-section").hidden = true;
  openComposer();
}

function closeComposer() {
  captureConversationDraft();
  byId("composer").hidden = true;
  resetComposer();
}

function syncMemoExportActions() {
  const value = byId("memo-export-preview").value;
  byId("memo-export-status").textContent = value.trim() ? `${value.length}文字` : "書き出す内容を選んでください。";
  byId("memo-export-copy").disabled = byId("memo-export-download").disabled = !value.trim();
}

function updateMemoExport() {
  if (!state.person) return;
  const options = {};
  byId("memo-export-options").querySelectorAll("input").forEach(input => {
    options[input.name] = input.checked;
  });
  byId("memo-export-count").textContent = `${state.memoExportIds.size}件を選択中`;
  byId("memo-export-preview").value = buildMemoExport(state.person, state.memoExportIds, options);
  syncMemoExportActions();
}

function selectMemoExport(limit) {
  const inputs = [...byId("memo-export-list").querySelectorAll("input")];
  state.memoExportIds.clear();
  inputs.forEach((input, index) => {
    input.checked = index < limit;
    if (input.checked) state.memoExportIds.add(input.value);
  });
  updateMemoExport();
}

function openMemoExport(event) {
  if (!state.person) return;
  const overlay = byId("memo-export");
  const notes = exportableConversations(state.person);
  const list = byId("memo-export-list");
  list.replaceChildren();
  notes.forEach(item => {
    const label = el("label", "memo-export-note");
    const input = el("input");
    input.type = "checkbox";
    input.value = item.conversation_id;
    const text = (String(item.note || "").trim() || String(item.recap || "").trim()).replace(/\s+/g, " ");
    const excerpt = text.length > 72 ? text.slice(0, 72) + "…" : text;
    label.append(input, el("span", "", `${dateText(item.occurred_at) || "日付未登録"}　${excerpt}`));
    list.append(label);
  });
  if (!notes.length) list.append(el("p", "empty", "書き出せる会話メモはありません。"));
  byId("memo-export-presets").hidden = !notes.length;
  byId("memo-export-options").querySelectorAll("input").forEach(input => { input.checked = false; });
  selectMemoExport(5);
  overlay.opener = event?.currentTarget;
  overlay.hidden = false;
  overlay.scrollTop = 0;
  syncPersonEditorLayers();
  byId("memo-export-close").focus({preventScroll:true});
}

function closeMemoExport(restoreFocus = false) {
  const overlay = byId("memo-export");
  if (overlay.hidden) return;
  overlay.hidden = true;
  state.memoExportIds.clear();
  byId("memo-export-list").replaceChildren();
  byId("memo-export-preview").value = "";
  syncPersonEditorLayers();
  if (restoreFocus) overlay.opener?.focus({preventScroll:true});
  overlay.opener = null;
}

async function copyMemoExport() {
  const input = byId("memo-export-preview");
  if (!input.value.trim()) return;
  const request = state.detailRequest;
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(input.value);
    else {
      input.focus();
      input.select();
      if (!document.execCommand("copy")) throw new Error("copy failed");
    }
    if (request === state.detailRequest && !byId("memo-export").hidden) toast("文章をコピーしました。");
  } catch (_error) {
    if (request !== state.detailRequest || byId("memo-export").hidden) return;
    input.focus();
    input.select();
    toast("自動でコピーできませんでした。選択した文章を手動でコピーしてください。", true);
  }
}

function downloadMemoExport() {
  const value = byId("memo-export-preview").value;
  if (!value.trim()) return;
  const url = URL.createObjectURL(new Blob([value], {type:"text/plain;charset=utf-8"}));
  const link = el("a");
  link.href = url;
  link.download = `conversation-notes-${new Date().toISOString().slice(0, 10)}.txt`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
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
  const query = normalize(topicControls().query);
  const currentMonth = `${new Date().getMonth() + 1}月`;
  return topicLibrary()
    .filter(topicMatchesProfile)
    .filter((topic) => !query || topicSearchText(topic).includes(query))
    .filter((topic) => {
      if (topicControls().tab === "initial") {
        return (
          topic.sensitivity === "low" &&
          topic.relationships.includes(topicControls().relationship)
        );
      }
      if (topicControls().tab === "category") {
        return (
          topicControls().category === "all" ||
          topic.category === topicControls().category
        );
      }
      if (topicControls().tab === "favorites") {
        return isFavoriteTopic(topic.id);
      }
      if (topicControls().tab === "recent-used") {
        return Boolean(topicPreference(topic.id)?.last_used_at);
      }
      return topic.recommended;
    })
    .sort((left, right) => {
      if (topicControls().tab === "recent-used") {
        return String(topicPreference(right.id)?.last_used_at || "").localeCompare(
          String(topicPreference(left.id)?.last_used_at || ""),
        );
      }
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
  relationshipFilters.hidden = topicControls().tab !== "initial";
  categoryFilters.hidden = topicControls().tab !== "category";
  clear(relationshipFilters);
  clear(categoryFilters);

  if (!relationshipFilters.hidden) {
    ["work", "friend", "community", "other"].forEach((relationship) => {
      const button = el(
        "button",
        `filter-chip${topicControls().relationship === relationship ? " active" : ""}`,
        relationshipLabel(relationship),
      );
      button.type = "button";
      button.addEventListener("click", () => {
        topicControls().relationship = relationship;
        state.selectedTopicIds.clear();
        topicControls().limit = topicPageSize;
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
        `filter-chip${topicControls().category === category ? " active" : ""}`,
        category === "all" ? "すべて" : category,
      );
      button.type = "button";
      button.addEventListener("click", () => {
        topicControls().category = category;
        topicControls().limit = topicPageSize;
        renderTopicPicker();
      });
      categoryFilters.append(button);
    });
  }
}

async function toggleTopicFavorite(topic) {
  if (!state.session) return;
  if (!state.topicHistoryAvailable) {
    toast("先に今回のSupabase SQLを実行してください。", true);
    return;
  }
  const current = topicPreference(topic.id);
  const next = !current?.is_favorite;
  const row = {
    user_id: state.session.user.id,
    topic_id: topic.id,
    is_favorite: next,
    last_used_at: current?.last_used_at || null,
    use_count: current?.use_count || 0,
  };
  const epoch = state.conversationEpoch;
  const { error } = await state.client
    .from("topic_preferences")
    .upsert(row, { onConflict: "user_id,topic_id" });
  if (epoch !== state.conversationEpoch || row.user_id !== state.session?.user?.id) return;
  if (error) {
    toast(message(error), true);
    return;
  }
  state.topicPreferences.set(topic.id, row);
  renderTopicPicker();
  toast(next ? "お気に入りに追加しました" : "お気に入りから外しました");
}

async function recordTopicUse(topics) {
  if (!state.topicHistoryAvailable || !state.session || !topics.length) return;
  const usedAt = new Date().toISOString();
  const epoch = state.conversationEpoch;
  const rows = topics.map((topic) => {
    const current = topicPreference(topic.id);
    return {
      user_id: state.session.user.id,
      topic_id: topic.id,
      is_favorite: current?.is_favorite === true,
      last_used_at: usedAt,
      use_count: Number(current?.use_count || 0) + 1,
    };
  });
  const { error } = await state.client
    .from("topic_preferences")
    .upsert(rows, { onConflict: "user_id,topic_id" });
  if (error || epoch !== state.conversationEpoch || rows[0].user_id !== state.session?.user?.id) return;
  rows.forEach((row) => state.topicPreferences.set(row.topic_id, row));
}

function topicOptionCard(topic) {
  const browseMode = state.topicPickerMode === "browse";
  const selected = !browseMode && state.selectedTopicIds.has(topic.id);
  const expanded = topicControls().expanded.has(topic.id);
  const card = el(
    "article",
    `topic-option${selected ? " selected" : ""}${expanded ? " expanded" : ""}`,
  );
  card.dataset.topicId = topic.id;
  const copy = el("div", "topic-option-copy");
  const meta = el("div", "topic-meta");
  meta.append(el("span", "topic-category", topic.category));
  if (!topic.builtIn && topic.month !== "日常") {
    meta.append(el("span", "topic-month", topic.month));
  }
  if (topic.sensitivity === "personal") {
    meta.append(el("span", "topic-sensitivity", "少し個人的"));
  }
  const favorite = el(
    "button",
    `topic-favorite${isFavoriteTopic(topic.id) ? " selected" : ""}`,
    isFavoriteTopic(topic.id) ? "★" : "☆",
  );
  favorite.type = "button";
  favorite.dataset.topicControl = "favorite";
  favorite.setAttribute(
    "aria-label",
    isFavoriteTopic(topic.id) ? "お気に入りから外す" : "お気に入りに追加",
  );
  favorite.addEventListener("click", () => toggleTopicFavorite(topic));
  meta.append(favorite);
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
    details.dataset.topicControl = "details";
    details.setAttribute("aria-expanded", String(expanded));
    details.addEventListener("click", () => {
      if (expanded) topicControls().expanded.delete(topic.id);
      else topicControls().expanded.add(topic.id);
      renderTopicPicker();
    });
    copy.append(details);
  }
  if (browseMode) {
    const copyButton = el("button", "topic-copy-button", "コピー");
    copyButton.type = "button";
    copyButton.dataset.topicControl = "copy";
    copyButton.setAttribute("aria-label", `「${topic.question}」をコピー`);
    copyButton.addEventListener("click", () => copyTopicQuestion(topic));
    card.append(copy, copyButton);
  } else {
    const toggle = el(
      "button",
      `topic-toggle${selected ? " selected" : ""}`,
      selected ? "✓" : "＋",
    );
    toggle.type = "button";
    toggle.dataset.topicControl = "select";
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
  }
  return card;
}

function renderTopicPicker() {
  const browseMode = state.topicPickerMode === "browse";
  if (browseMode && state.view !== "topics") return;
  if (!browseMode && !state.person) return;
  byId("topic-list-help").textContent = browseMode
    ? "気になった質問をコピーできます"
    : "必要なものだけ選べます";
  if (byId("topic-search").value !== topicControls().query) byId("topic-search").value = topicControls().query;
  document.querySelectorAll("#topic-tabs [data-topic-tab]").forEach((button) => {
    const historyTab = ["favorites", "recent-used"].includes(button.dataset.topicTab);
    button.hidden = historyTab && !state.topicHistoryAvailable;
    const active = button.dataset.topicTab === topicControls().tab;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  renderTopicFilters();
  const topics = visibleTopics();
  byId("topic-result-summary").textContent =
    topicControls().tab === "initial"
      ? `${relationshipLabel(topicControls().relationship)}向け・${topics.length}件`
      : topicControls().tab === "favorites"
        ? `お気に入り・${topics.length}件`
        : topicControls().tab === "recent-used"
          ? `最近使った話題・${topics.length}件`
      : `${topics.length}件の話題`;
  const list = byId("topic-list");
  const active = document.activeElement;
  const focusedId = active?.closest("[data-topic-id]")?.dataset.topicId;
  const focusedControl = active?.dataset.topicControl;
  clear(list);
  topics
    .slice(0, topicControls().limit)
    .forEach((topic) => list.append(topicOptionCard(topic)));
  if (!topics.length) {
    list.append(el("div", "empty", "条件に合う話題がありません"));
  }
  byId("topic-load-more").hidden = topics.length <= topicControls().limit;
  if (!browseMode) {
    const count = state.selectedTopicIds.size;
    byId("topic-selected-count").textContent = `${count}件を選択中`;
    byId("topic-add-selected").disabled = !count || Boolean(state.topicAddRequest);
  }
  if (focusedId && focusedControl) {
    const item = [...list.children].find(card => card.dataset.topicId === focusedId);
    const control = item?.querySelector(`[data-topic-control="${focusedControl}"]`);
    (control || byId("topic-search")).focus({preventScroll:true});
  }
}

function openTopicPicker(event) {
  if (!state.person || !canEditPeople()) return;
  state.topicPickerMode = "add";
  state.addTopicControls = newTopicControls();
  state.topicOpener = event?.currentTarget;
  state.selectedTopicIds.clear();
  const picker = byId("topic-picker");
  picker.insertBefore(byId("topic-picker-body"), byId("topic-picker-actions"));
  byId("topic-person-name").textContent = `${state.person.person.canonical_name}さんに聞く話題`;
  picker.hidden = false;
  byId("topic-picker-body").scrollTop = 0;
  renderTopicPicker();
  syncPersonEditorLayers();
  byId("topic-picker-close").focus({preventScroll:true});
}

function closeTopicPicker({restoreFocus = true, force = false} = {}) {
  const picker = byId("topic-picker");
  if (picker.hidden || (state.topicAddRequest && !force)) return;
  picker.hidden = true;
  state.topicAddRequest = null;
  state.topicPickerMode = "browse";
  byId("topic-picker-body").inert = false;
  state.selectedTopicIds.clear();
  byId("topic-picker-close").disabled = false;
  byId("topic-add-selected").textContent = "次に聞くことへ追加";
  syncPersonEditorLayers();
  if (restoreFocus) state.topicOpener?.focus({preventScroll:true});
  state.topicOpener = null;
}

async function copyTopicQuestion(topic) {
  const epoch = state.conversationEpoch;
  const userId = state.session?.user?.id;
  const current = () => epoch === state.conversationEpoch && userId === state.session?.user?.id;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(topic.question);
    } else {
      const input = document.createElement("textarea");
      input.value = topic.question;
      input.setAttribute("readonly", "");
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.append(input);
      input.select();
      try {
        if (!document.execCommand("copy")) throw new Error("copy failed");
      } finally {
        input.remove();
      }
    }
    if (!current()) return;
    await recordTopicUse([topic]);
    if (current()) toast("話題をコピーしました");
  } catch (_error) {
    if (current()) toast("コピーできませんでした。長押しして選択してください。", true);
  }
}

async function addSelectedTopics() {
  if (!state.person || !state.session || !canEditPeople() || !state.selectedTopicIds.size ||
      state.topicPickerMode !== "add" || state.topicAddRequest) return;
  const detail = state.person;
  const request = {};
  const epoch = state.conversationEpoch;
  const userId = state.session.user.id;
  const current = () => state.person === detail && request === state.topicAddRequest &&
    epoch === state.conversationEpoch && userId === state.session?.user?.id;
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
  state.topicAddRequest = request;
  byId("topic-picker-close").disabled = true;
  byId("topic-picker-body").inert = true;
  button.disabled = true;
  button.textContent = "追加中…";
  try {
    const { data, error } = await state.client
      .from("follow_up_items")
      .insert(
        selected.map((topic) => ({
          person_id: detail.person.person_id,
          body: topic.question,
          due_at: null,
        })),
      )
      .select();
    if (error) throw error;
    if (!current()) return;
    detail.followUps.unshift(...data);
    state.followUps.unshift(...data);
    await recordTopicUse(selected);
    if (!current()) return;
    closeTopicPicker({restoreFocus:false, force:true});
    renderAll();
    renderDetail();
    byId("detail-body").querySelector(".topic-library-button")?.focus({preventScroll:true});
    toast(
      skipped
        ? `${data.length}件を追加しました（重複${skipped}件は除外）`
        : `${data.length}件を「次に聞くこと」へ追加しました`,
    );
  } catch (error) {
    if (current()) toast(message(error), true);
  } finally {
    if (current()) {
      state.topicAddRequest = null;
      byId("topic-picker-body").inert = false;
      byId("topic-picker-close").disabled = false;
      button.disabled = !state.selectedTopicIds.size;
      button.textContent = "次に聞くことへ追加";
    }
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

function conversationStore() { return new SupabaseConversationStore(state.client); }

async function saveConversation(event, {completeOnly=false}={}) {
  event.preventDefault();
  if(!state.person || !canEditPeople() || state.conversationSaving)return;
  const scope=conversationScope();if(!scope)return;
  if(!state.conversationJob) {
    try {
      state.conversationJob=createConversationJob({
        personId:state.person.person.person_id,note:byId('conversation-note').value,
        recap:byId('conversation-recap').value,tags:[...state.selectedTags],
        questions:state.editingConversationId?[]:byId('next-topics').value.split(/\r?\n/),
        due:byId('follow-up-at').value,editId:state.editingConversationId,
        reply:state.replyingFollowUp,askNext:Boolean(byId('conversation-ask-next').checked),
        completeOnly,linksAvailable:state.linksAvailable,hasRecap:state.recapAvailable,
      });
    } catch(error) {toast(message(error),true);return;}
  }
  const job=state.conversationJob,client=state.client,epoch=state.conversationEpoch;
  const sameLogin=()=>state.conversationEpoch===epoch && state.session?.user?.id===scope[1] && state.client===client;
  const isCurrent=()=>sameLogin() && state.person?.person.person_id===scope[2];
  const isCurrentComposer=()=>isCurrent() && conversationScope()?.[3]===scope[3] && state.conversationJob?.id===job.id;
  const persistProgress=()=>{
    if(isCurrentComposer())state.conversationJob=job;
    const draft=conversationDrafts.read(scope);
    if(sameLogin() && draft?.job?.id===job.id)conversationDrafts.write(scope,{...draft,job});
  };
  state.conversationSaving=true;
  byId('discard-conversation-draft').disabled=true;
  captureConversationDraft();
  try {
    const result=await saveConversationJob(job,conversationStore(),{isActive:sameLogin,onProgress:persistProgress});
    if(!sameLogin())return;
    if(conversationDrafts.read(scope)?.job?.id===job.id)conversationDrafts.remove(scope);
    if(isCurrent()) {
      if(result.conversation)state.person.conversations=[result.conversation,...state.person.conversations.filter(row=>row.conversation_id!==result.conversation.conversation_id)];
      const ids=new Set(result.questions.map(row=>row.follow_up_id));
      state.person.followUps=[...result.questions,...state.person.followUps.filter(row=>!ids.has(row.follow_up_id) && row.follow_up_id!==result.completedId)];
      if(result.completedId)state.followUps=state.followUps.filter(row=>row.follow_up_id!==result.completedId);
      if(isCurrentComposer()){byId('composer').hidden=true;resetComposer();}
      renderDetail();
    }
    toast(job.editId?'会話メモを更新しました':job.completeId
      ?job.conversation?'前の話と紐づけて保存しました':'聞いたことにしました'
      :job.conversation && job.questions.length?'会話メモと次に聞くことを保存しました':job.conversation?'会話メモを保存しました':'次に聞くことを追加しました');
    try {await loadDirectory();}
    catch(error){toast(`保存は完了しました。一覧の更新に失敗しました。画面を再読み込みしてください：${message(error)}`,true);}
  } catch(error) {
    persistProgress();
    if(sameLogin())toast(`${job.conversationConfirmed?'会話メモは保存済みです。残りの処理を完了できませんでした。':'保存の完了を確認できませんでした。'}内容を保持しています。「保存を再試行」を押してください：${message(error)}`,true);
  } finally {
    state.conversationSaving=false;
    byId('save-conversation').disabled=false;
    byId('discard-conversation-draft').disabled=false;
    if(isCurrentComposer() && !byId('composer').hidden)captureConversationDraft();
  }
}


function switchView(view) {
  const previous = state.view;
  if (previous === "topics" && view !== "topics") {
    state.topicBrowseScroll = window.scrollY;
  }
  state.view = view;
  document.querySelectorAll(".view").forEach((node) => {
    node.hidden = node.id !== `view-${view}`;
  });
  document.querySelectorAll("#navigation button").forEach((node) => {
    const active = node.dataset.view === view;
    node.classList.toggle("active", active);
    if (active) node.setAttribute("aria-current", "page");
    else node.removeAttribute("aria-current");
  });
  if (view === "topics") {
    state.topicPickerMode = "browse";
    const body = byId("topic-picker-body");
    const browser = byId("topic-browser");
    if (body.parentElement !== browser) browser.append(body);
    renderTopicPicker();
    if (previous !== view) window.scrollTo(0, state.topicBrowseScroll);
  } else if (previous === "topics") window.scrollTo(0, 0);
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
  if (error) { toast(message(error), true); return; }
  clearConversationAccount();
  photoStore?.clear();photoObserver?.disconnect();photoObserver=null;
  state.session = null;
  state.role = null;
  showOnly("auth-screen");
}

async function handleSession(session) {
  if (state.handlingSession) return;
  state.handlingSession = true;
  try {
    if (!session) {
      clearConversationAccount();
      photoStore?.clear();photoObserver?.disconnect();photoObserver=null;
      state.session = null;
      state.role = null;
      showOnly("auth-screen");
      return;
    }
    if (state.session?.user?.id && state.session.user.id !== session.user.id) {
      clearConversationAccount();
      closeSessionOverlays();
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
    byId("backup-open").hidden = state.role !== "owner";
    byId("person-add").hidden = !canEditPeople();
    byId("person-edit").hidden = !canEditPeople();
    byId("composer-open").hidden = !canEditPeople();
    showOnly("app-screen");
    await checkConversationLinks();
    await loadTopicPreferences();
    await loadDirectory();
  } catch (error) {
    showOnly("auth-screen");
    byId("auth-message").textContent = message(error);
  } finally {
    state.handlingSession = false;
  }
}

function bindEvents() {
  document.addEventListener("click", (event) => {
    document.querySelectorAll(".follow-up-more[open]").forEach((menu) => {
      if (!menu.contains(event.target)) menu.open = false;
    });
  });
  byId("photo-file").addEventListener("change", choosePhoto);
  ["x", "y", "zoom"].forEach(key => byId(`photo-${key}`).addEventListener("input", event => {
    if (!state.avatarEditor) return;
    state.avatarEditor.photo[key] = Number(event.target.value);
    renderAvatarPreview();
  }));
  byId("photo-center").addEventListener("click",()=>{
    if (!state.avatarEditor) return;
    Object.assign(state.avatarEditor.photo, {x:.5, y:.5, zoom:1});
    renderAvatarEditor();
  });
  for (const [mode, label] of [["theme", "頭文字"], ["illustration", "趣味の絵"], ["photo", "写真"]]) {
    const button = el("button", "image-method", label);
    button.type = "button";
    button.dataset.avatarMode = mode;
    button.addEventListener("click", () => {
      if (!state.avatarEditor) return;
      state.avatarEditor.mode = mode;
      renderAvatarEditor();
    });
    byId("image-method-options").append(button);
  }
  byId("illustration-search").addEventListener("input", renderAvatarIllustrations);
  byId("avatar-editor-close").addEventListener("click", () => closeAvatarEditor());
  byId("avatar-save").addEventListener("click", saveAvatar);
  byId("sign-in").addEventListener("click", signIn);
  byId("sign-out").addEventListener("click", signOut);
  byId("backup-open").addEventListener("click", () => {
    byId("backup-dialog").hidden = false;
    document.body.style.overflow = "hidden";
  });
  byId("backup-close").addEventListener("click", () => {
    byId("backup-dialog").hidden = true;
    document.body.style.overflow = "";
  });
  byId("backup-form").addEventListener("submit", downloadEncryptedBackup);
  byId("denied-sign-out").addEventListener("click", signOut);
  byId("search").addEventListener("input", () => {
    state.peopleLimit = 50;
    renderPeople();
  });
  byId("memo-search").addEventListener("input", renderMemoSearch);
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
  byId("person-form").addEventListener("keydown", preventPersonImplicitSubmit);
  byId('person-birthday').addEventListener('input',renderPersonAgeEditor);
  byId('person-age').addEventListener('input',renderPersonAgeEditor);
  byId("person-tag-add").addEventListener("click", commitPersonTagInput);
  byId("person-tag-input").addEventListener("input", renderPersonTagEditor);
  byId("person-tag-input").addEventListener("focus", () => {
    byId('person-tag-picker').open=true;
    requestAnimationFrame(()=>byId('person-tag-input').scrollIntoView({block:'start',behavior:'auto'}));
  });
  byId("person-tag-input").addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    commitPersonTagInput();
  });
  byId("composer-open").addEventListener("click", () => openComposer());
  byId("composer-close").addEventListener("click", closeComposer);
  byId("conversation-form").addEventListener("submit", saveConversation);
  byId('complete-without-note').addEventListener('click',event=>saveConversation(event,{completeOnly:true}));
  byId('conversation-form').addEventListener('input', captureConversationDraft);
  byId('conversation-form').addEventListener('change', captureConversationDraft);
  byId('discard-conversation-draft').addEventListener('click', discardConversationDraft);
  window.addEventListener('pagehide', captureConversationDraft);
  byId('conversation-tag-search').addEventListener('input',renderTags);
  byId('conversation-tag-search').addEventListener('keydown',event=>{if(event.key === 'Enter' && !event.isComposing) {event.preventDefault();}});
  byId("memo-export-close").addEventListener("click", () => closeMemoExport(true));
  byId("memo-export-copy").addEventListener("click", copyMemoExport);
  byId("memo-export-download").addEventListener("click", downloadMemoExport);
  byId("memo-export-preview").addEventListener("input", syncMemoExportActions);
  byId("memo-export-options").addEventListener("change", updateMemoExport);
  byId("memo-export-presets").addEventListener("click", event => {
    const preset = event.target.closest("[data-memo-selection]")?.dataset.memoSelection;
    if (preset) selectMemoExport(preset === "all" ? Infinity : Number(preset));
  });
  byId("memo-export-list").addEventListener("change", event => {
    const input = event.target;
    if (input.checked) state.memoExportIds.add(input.value);
    else state.memoExportIds.delete(input.value);
    updateMemoExport();
  });
  byId("topic-picker-close").addEventListener("click", () => closeTopicPicker());
  byId("topic-tabs").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-topic-tab]");
    if (!button) return;
    topicControls().tab = button.dataset.topicTab;
    state.selectedTopicIds.clear();
    topicControls().expanded.clear();
    topicControls().limit = topicPageSize;
    renderTopicPicker();
  });
  byId("topic-search").addEventListener("input", (event) => {
    topicControls().query = event.target.value;
    topicControls().limit = topicPageSize;
    renderTopicPicker();
  });
  byId("topic-load-more").addEventListener("click", () => {
    topicControls().limit += topicPageSize;
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
  photoStore = new PhotoStore(state.client);
  const updateViewport = () => {
    document.documentElement.style.setProperty('--visible-height',`${window.visualViewport?.height || window.innerHeight}px`);
    document.documentElement.style.setProperty('--visible-top',`${window.visualViewport?.offsetTop || 0}px`);
  };
  window.visualViewport?.addEventListener("resize", updateViewport);
  window.visualViewport?.addEventListener('scroll',updateViewport);
  window.addEventListener("resize", updateViewport);
  updateViewport();
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
