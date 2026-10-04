const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const root = join(__dirname, '..', 'v8-preview');
const source = readFileSync(join(root, 'app.js'), 'utf8');

function loadApp() {
  const elements = new Map();
  class Node {
    constructor(tagName = 'div') {
      this.tagName = tagName;
      this.childNodes = [];
      this.listeners = {};
      this.attributes = {};
      this.value = '';
      this.textContent = '';
    }
    append(...nodes) { this.childNodes.push(...nodes); }
    replaceChildren(...nodes) { this.childNodes = nodes; }
    addEventListener(name, handler) { this.listeners[name] = handler; }
    setAttribute(name, value) { this.attributes[name] = value; }
    focus() {}
  }
  const document = {
    createElement: (tag) => new Node(tag),
    getElementById: (id) => {
      if (!elements.has(id)) elements.set(id, new Node());
      return elements.get(id);
    },
  };
  const context = { window: {}, console, Intl, Date, Set, Map, URL, crypto: globalThis.crypto, document };
  vm.createContext(context);
  vm.runInContext(source.replace(/^import .*\n/gm, '').replace(/\nboot\(\);\s*$/, ''), context);
  return { context, elements, call: (expression) => vm.runInContext(expression, context) };
}

test('adding comma separated tags preserves existing values, removes duplicates, and caps the list', () => {
  const { call } = loadApp();
  assert.deepEqual(Array.from(call('mergePersonTags(["同期", "ゴルフ"], "ゴルフ、LINE, 旅行")')),
    ['同期', 'ゴルフ', 'LINE', '旅行']);
  assert.equal(call('mergePersonTags(Array.from({length: 30}, (_, i) => `タグ${i}`), "追加").length'), 30);
});

test('suggestions use existing tags, omit selected tags, and match typed text', () => {
  const { call, context } = loadApp();
  context.directoryFixture = [
    { profile_tags: ['旅行', 'ゴルフ'] },
    { profile_tags: ['旅行', '料理'] },
    { profile_tags: ['ゴルフ'] },
  ];
  assert.deepEqual(Array.from(call('suggestPersonTags(directoryFixture, ["料理"], "")')),
    ['ゴルフ', '旅行']);
  assert.deepEqual(Array.from(call('suggestPersonTags(directoryFixture, [], "旅")')),
    ['旅行']);
});

test('selected tags have individual remove controls without changing the other tags', () => {
  const { call, elements } = loadApp();
  call('state.editorTags = ["同期", "ゴルフ"]; state.directory = []; renderPersonTagEditor()');
  const list = elements.get('person-tag-list');
  assert.equal(list.childNodes.length, 2);
  const remove = list.childNodes[0].childNodes.find((node) => node.tagName === 'button');
  assert.equal(remove.attributes['aria-label'], '同期を削除');
  call('renderEditorCardPreview = () => {}');
  remove.listeners.click();
  assert.deepEqual(Array.from(call('state.editorTags')), ['ゴルフ']);
});

test('tag entry stops offering new tags at the 30 tag limit', () => {
  const { call, elements } = loadApp();
  call('state.editorTags = Array.from({length: 30}, (_, i) => `タグ${i}`); state.directory = [{profile_tags: ["追加候補"]}]; renderPersonTagEditor()');
  assert.equal(elements.get('person-tag-input').disabled, true);
  assert.equal(elements.get('person-tag-add').disabled, true);
  assert.equal(elements.get('person-tag-suggestions').hidden, true);
});

test('card appearance options start closed so the save action follows the everyday fields', () => {
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  assert.match(html, /<details class="form-section card-customize">/);
});
