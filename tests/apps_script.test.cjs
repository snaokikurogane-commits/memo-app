const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const appDir = path.join(root, 'apps-script');

test('Apps Script source files parse as JavaScript', () => {
  for (const filename of fs.readdirSync(appDir).filter(name => name.endsWith('.gs'))) {
    assert.doesNotThrow(() => new vm.Script(fs.readFileSync(path.join(appDir, filename), 'utf8'), { filename }));
  }
});

test('inline application script parses as JavaScript', () => {
  const html = fs.readFileSync(path.join(appDir, 'Index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);
  assert.equal(scripts.length, 1);
  assert.doesNotThrow(() => new vm.Script(scripts[0], { filename: 'Index.inline.js' }));
});

test('name identity rules normalize variants but keep ambiguity visible', () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(appDir, 'Repository.gs'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(appDir, 'Identity.gs'), 'utf8'), context);
  assert.equal(context.normalizeName_('髙 﨑　彦'), '高崎彦');
  const people = [
    { person_id: 'per_1', canonical_name: '高崎彦', name_kana: '', aliases_json: '[]' },
    { person_id: 'per_2', canonical_name: '別人', name_kana: '', aliases_json: '["髙﨑 彦"]' }
  ];
  assert.equal(context.classifyNameMatch_('髙崎彦', people).matchType, 'ambiguous');
  assert.equal(context.classifyNameMatch_('未登録太郎', people).matchType, 'new_candidate');
});

test('legacy migration recognizes the actual workbook headers', () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(appDir, 'Migration.gs'), 'utf8'), context);
  const headers = ['登録日時', '名前', 'メモ内容（話題・キーワード）', '年度'];
  assert.equal(context.findHeaderIndex_(headers, ['登録日時']), 0);
  assert.equal(context.findHeaderIndex_(headers, ['氏名', '名前']), 1);
  assert.equal(context.findHeaderIndex_(headers, ['メモ内容（話題・キーワード）']), 2);
  assert.equal(context.findHeaderIndex_(headers, ['年度']), 3);
});
