function normalizeHeader_(value) {
  return String(value || '').normalize('NFKC').replace(/[\s\u3000・･_]/g, '').toLowerCase();
}

function findHeaderIndex_(headers, candidates) {
  const normalized = headers.map(normalizeHeader_);
  const keys = candidates.map(normalizeHeader_);
  return normalized.findIndex(function (header) { return keys.indexOf(header) !== -1; });
}

function readLegacyGrid_(sheet) {
  const values = sheet.getDataRange().getValues();
  const scanLimit = Math.min(values.length, 10);
  let headerIndex = -1;
  for (let index = 0; index < scanLimit; index += 1) {
    if (findHeaderIndex_(values[index], ['氏名', '名前', '人物名']) !== -1) {
      headerIndex = index;
      break;
    }
  }
  if (headerIndex === -1) return null;
  return { headers: values[headerIndex].map(String), rows: values.slice(headerIndex + 1), firstDataRow: headerIndex + 2 };
}

function fiscalYearFromSheetName_(name) {
  const match = String(name).match(/(?:R|令和)\s*([678])/i);
  return match ? '令和' + match[1] + '年度' : '';
}

function valueAt_(row, index) { return index >= 0 ? row[index] : ''; }

function migrateLegacyData() {
  authorize_();
  setupV2Schema();
  return withScriptLock_(function () {
    if (readTable_('People').length || readTable_('Assignments').length || readTable_('Conversations').length) {
      throw new Error('v2データが既に存在します。移行は空のv2シートに対して一度だけ実行できます。');
    }
    const spreadsheet = getDatabase_();
    const reserved = Object.keys(tableSchemas_());
    const masterEntries = [];
    const memoEntries = [];
    const archive = [];
    spreadsheet.getSheets().forEach(function (sheet) {
      if (reserved.indexOf(sheet.getName()) !== -1) return;
      const grid = readLegacyGrid_(sheet);
      if (!grid) return;
      const nameIndex = findHeaderIndex_(grid.headers, ['氏名', '名前', '人物名']);
      const kanaIndex = findHeaderIndex_(grid.headers, ['ふりがな', 'フリガナ', '読み', '氏名かな']);
      const organizationIndex = findHeaderIndex_(grid.headers, ['所属', '現部署', '部署', '所属部署', '機関']);
      const departmentIndex = findHeaderIndex_(grid.headers, ['部門', '課室', '課・室']);
      const roleIndex = findHeaderIndex_(grid.headers, ['役職', '役職名', '職名']);
      const fiscalYearIndex = findHeaderIndex_(grid.headers, ['年度']);
      const dateIndex = findHeaderIndex_(grid.headers, ['日付', '会話日', '日時', '記録日', '登録日時']);
      const memoIndex = findHeaderIndex_(grid.headers, ['メモ', '内容', '会話内容', '記録', 'メモ内容（話題・キーワード）']);
      const nextIndex = findHeaderIndex_(grid.headers, ['次に聞くこと', '次の話題', '次回話題']);
      const followIndex = findHeaderIndex_(grid.headers, ['フォロー日', '次回目安', '次回日']);
      const tagsIndex = findHeaderIndex_(grid.headers, ['タグ', 'tag', 'tags']);
      const eventDateIndex = findHeaderIndex_(grid.headers, ['イベント日']);
      const eventNameIndex = findHeaderIndex_(grid.headers, ['イベント名']);
      const updatedAtIndex = findHeaderIndex_(grid.headers, ['最終更新日時']);
      const fiscalYear = fiscalYearFromSheetName_(sheet.getName());
      grid.rows.forEach(function (row, index) {
        const name = String(valueAt_(row, nameIndex) || '').trim();
        const payload = {};
        grid.headers.forEach(function (header, column) { payload[header || 'column_' + (column + 1)] = serializeForClient_(row[column]); });
        const base = { sourceSheet: sheet.getName(), sourceRow: grid.firstDataRow + index, name: name, payload: payload };
        const rowFiscalYear = String(valueAt_(row, fiscalYearIndex) || fiscalYear || '').trim();
        const isMemoSheet = /メモ|会話|履歴/.test(sheet.getName()) || (!rowFiscalYear && memoIndex !== -1 && dateIndex !== -1);
        if (!name) {
          if (isMemoSheet && String(valueAt_(row, memoIndex) || '').trim()) {
            archive.push({ archive_id: newId_('arc'), source_sheet: sheet.getName(), source_row: grid.firstDataRow + index, kind: 'conversation',
              payload_json: JSON.stringify(payload), reason: 'blank_person_name', created_at: nowIso_() });
          }
          return;
        }
        if (isMemoSheet) {
          memoEntries.push(Object.assign(base, {
            occurredAt: valueAt_(row, dateIndex), note: String(valueAt_(row, memoIndex) || ''), nextTopic: String(valueAt_(row, nextIndex) || ''),
            followUpAt: valueAt_(row, followIndex), tags: String(valueAt_(row, tagsIndex) || '').split(/[,、\s]+/).filter(Boolean)
          }));
        } else if (rowFiscalYear) {
          masterEntries.push(Object.assign(base, {
            fiscalYear: rowFiscalYear, kana: String(valueAt_(row, kanaIndex) || ''), organization: String(valueAt_(row, organizationIndex) || ''),
            department: String(valueAt_(row, departmentIndex) || ''), role: String(valueAt_(row, roleIndex) || ''),
            eventDate: valueAt_(row, eventDateIndex), eventName: String(valueAt_(row, eventNameIndex) || ''),
            legacyMemo: String(valueAt_(row, memoIndex) || ''), tags: String(valueAt_(row, tagsIndex) || '').split(/[,、\s]+/).filter(Boolean),
            updatedAt: valueAt_(row, updatedAtIndex)
          }));
        }
      });
    });

    const byName = {};
    masterEntries.forEach(function (entry) {
      const key = normalizeName_(entry.name);
      if (!byName[key]) byName[key] = [];
      byName[key].push(entry);
    });
    const timestamp = nowIso_();
    const people = [];
    const assignments = [];
    const events = [];
    const safePersonByName = {};
    const staged = [];
    Object.keys(byName).forEach(function (key) {
      const entries = byName[key];
      const countsByYear = {};
      entries.forEach(function (entry) { countsByYear[entry.fiscalYear] = (countsByYear[entry.fiscalYear] || 0) + 1; });
      const duplicateWithinYear = Object.keys(countsByYear).some(function (year) { return countsByYear[year] > 1; });
      if (duplicateWithinYear) {
        entries.forEach(function (entry) {
          staged.push({ import_row_id: newId_('legacy'), batch_id: 'legacy-migration', fiscal_year: entry.fiscalYear, organization: entry.organization,
            department: entry.department, role: entry.role, printed_name: entry.name, normalized_name: key, source_pdf: '', source_page: '',
            source_raw: JSON.stringify(entry.payload), candidate_person_id: '', match_type: 'ambiguous_same_name', confidence: '', review_status: 'pending',
            resolution_note: '同一年度に同名が複数あるため自動移行していません。', created_at: timestamp });
          archive.push({ archive_id: newId_('arc'), source_sheet: entry.sourceSheet, source_row: entry.sourceRow, kind: 'master', payload_json: JSON.stringify(entry.payload), reason: 'ambiguous_same_name', created_at: timestamp });
        });
        return;
      }
      const personId = newId_('per');
      const aliases = entries.map(function (entry) { return entry.name; }).filter(function (value, index, all) { return all.indexOf(value) === index; });
      const profileTags = entries.reduce(function (all, entry) { return all.concat(entry.tags || []); }, []).filter(function (value, index, all) { return value && all.indexOf(value) === index; });
      const kana = entries.map(function (entry) { return entry.kana; }).find(Boolean) || '';
      people.push({ person_id: personId, canonical_name: canonicalDisplayName_(entries[entries.length - 1].name), name_kana: kana,
        aliases_json: JSON.stringify(aliases), profile_tags_json: JSON.stringify(profileTags), active_status: 'active', created_at: timestamp, updated_at: timestamp, revision: 1 });
      safePersonByName[key] = personId;
      entries.forEach(function (entry) {
        assignments.push({ assignment_id: newId_('asg'), person_id: personId, fiscal_year: entry.fiscalYear, organization: entry.organization,
          department: entry.department, role: entry.role, employment_type: '', source_pdf: '', source_page: '', source_raw_name: entry.name,
          verified_status: 'legacy_unverified', created_at: timestamp, updated_at: timestamp });
        if (entry.eventDate || entry.eventName) {
          const duplicateEvent = events.some(function (event) { return event.person_id === personId && String(event.event_date) === String(entry.eventDate || '') && event.label === entry.eventName; });
          if (!duplicateEvent) events.push({ event_id: newId_('evt'), person_id: personId, event_type: /誕生日/.test(entry.eventName) ? 'birthday' : 'other',
            event_date: entry.eventDate || '', label: entry.eventName, repeat_yearly: /誕生日/.test(entry.eventName) ? 'true' : 'false', created_at: timestamp, updated_at: timestamp });
        }
      });
    });

    const conversations = [];
    memoEntries.forEach(function (entry) {
      const personId = safePersonByName[normalizeName_(entry.name)];
      if (!personId) {
        archive.push({ archive_id: newId_('arc'), source_sheet: entry.sourceSheet, source_row: entry.sourceRow, kind: 'conversation',
          payload_json: JSON.stringify(entry.payload), reason: 'person_unmatched_or_ambiguous', created_at: timestamp });
        return;
      }
      conversations.push({ conversation_id: newId_('con'), person_id: personId, occurred_at: entry.occurredAt || timestamp,
        note: entry.note, next_topic: entry.nextTopic, follow_up_at: entry.followUpAt || '', tags_json: JSON.stringify(entry.tags), created_at: timestamp, updated_at: timestamp });
      archive.push({ archive_id: newId_('arc'), source_sheet: entry.sourceSheet, source_row: entry.sourceRow, kind: 'conversation',
        payload_json: JSON.stringify(entry.payload), reason: 'conversation_migrated_raw_preserved', created_at: timestamp });
    });
    masterEntries.forEach(function (entry) {
      const personId = safePersonByName[normalizeName_(entry.name)];
      if (personId && entry.legacyMemo) conversations.push({ conversation_id: newId_('con'), person_id: personId, occurred_at: entry.updatedAt || timestamp,
        note: entry.legacyMemo, next_topic: '', follow_up_at: '', tags_json: JSON.stringify(entry.tags), created_at: timestamp, updated_at: timestamp });
    });
    appendRecords_('People', people);
    appendRecords_('Assignments', assignments);
    appendRecords_('Conversations', conversations);
    appendRecords_('Events', events);
    appendRecords_('ImportStaging', staged);
    appendRecords_('LegacyArchive', archive);
    upsertSetting_('legacy_migrated_at', timestamp);
    bumpDataVersion_();
    const report = { people: people.length, assignments: assignments.length, conversations: conversations.length, events: events.length, reviewRows: staged.length, archivedRows: archive.length };
    appendAudit_('migrate', 'LegacyData', 'legacy-migration', report);
    return report;
  });
}
