function getBootstrap(syncToken) {
  authorize_();
  const dataVersion = getDataVersion_();
  if (syncToken && String(syncToken) === dataVersion) return { schemaVersion: schemaVersion_(), syncToken: dataVersion, unchanged: true };
  const config = getConfig_();
  const people = readTable_('People');
  const assignments = readTable_('Assignments');
  const conversations = readTable_('Conversations');
  const currentByPerson = {};
  assignments.forEach(function (row) {
    if (String(row.fiscal_year) !== config.currentFiscalYear) return;
    currentByPerson[String(row.person_id)] = row;
  });
  const conversationsByPerson = {};
  conversations.forEach(function (row) {
    const key = String(row.person_id);
    if (!conversationsByPerson[key]) conversationsByPerson[key] = [];
    conversationsByPerson[key].push(row);
  });
  const cards = people.map(function (person) {
    const history = conversationsByPerson[String(person.person_id)] || [];
    history.sort(function (a, b) { return String(b.occurred_at).localeCompare(String(a.occurred_at)); });
    const latest = history[0] || null;
    return {
      personId: String(person.person_id),
      name: String(person.canonical_name || ''),
      kana: String(person.name_kana || ''),
      aliases: parseJsonArray_(person.aliases_json),
      tags: parseJsonArray_(person.profile_tags_json),
      active: String(person.active_status || 'active'),
      assignment: currentByPerson[String(person.person_id)] ? serializeForClient_(currentByPerson[String(person.person_id)]) : null,
      latestConversation: latest ? serializeForClient_(latest) : null
    };
  });
  const now = nowIso_();
  const followUps = conversations
    .filter(function (row) { return row.follow_up_at && String(row.follow_up_at) <= now; })
    .sort(function (a, b) { return String(a.follow_up_at).localeCompare(String(b.follow_up_at)); })
    .slice(0, 30)
    .map(serializeForClient_);
  const recent = conversations.slice().sort(function (a, b) { return String(b.occurred_at).localeCompare(String(a.occurred_at)); }).slice(0, 30).map(serializeForClient_);
  return {
    schemaVersion: schemaVersion_(),
    syncToken: dataVersion || now,
    unchanged: false,
    currentFiscalYear: config.currentFiscalYear,
    people: cards,
    followUps: followUps,
    recent: recent
  };
}

function getPerson(personId) {
  authorize_();
  const id = String(personId || '');
  const person = readTable_('People').find(function (row) { return String(row.person_id) === id; });
  if (!person) throw new Error('人物が見つかりません。');
  const assignments = readTable_('Assignments').filter(function (row) { return String(row.person_id) === id; })
    .sort(function (a, b) { return String(b.fiscal_year).localeCompare(String(a.fiscal_year)); });
  const conversations = readTable_('Conversations').filter(function (row) { return String(row.person_id) === id; })
    .sort(function (a, b) { return String(b.occurred_at).localeCompare(String(a.occurred_at)); });
  const events = readTable_('Events').filter(function (row) { return String(row.person_id) === id; });
  return serializeForClient_({ person: person, assignments: assignments, conversations: conversations, events: events });
}

function saveConversation(input) {
  authorize_();
  const data = input || {};
  const personId = String(data.personId || '');
  const note = String(data.note || '').trim();
  const nextTopic = String(data.nextTopic || '').trim();
  if (!personId) throw new Error('person_id が必要です。');
  if (!note && !nextTopic) throw new Error('メモまたは「次に聞くこと」を入力してください。');
  if (note.length > 5000 || nextTopic.length > 1000) throw new Error('入力が長すぎます。');
  return withScriptLock_(function () {
    const exists = readTable_('People').some(function (row) { return String(row.person_id) === personId; });
    if (!exists) throw new Error('人物が見つかりません。');
    const createdAt = nowIso_();
    const record = {
      conversation_id: newId_('con'), person_id: personId,
      occurred_at: String(data.occurredAt || createdAt), note: note, next_topic: nextTopic,
      follow_up_at: String(data.followUpAt || ''), tags_json: JSON.stringify(Array.isArray(data.tags) ? data.tags.slice(0, 20) : []),
      created_at: createdAt, updated_at: createdAt
    };
    appendRecords_('Conversations', [record]);
    bumpDataVersion_();
    appendAudit_('create', 'Conversation', record.conversation_id, { personId: personId });
    return serializeForClient_(record);
  });
}

function updatePerson(input) {
  authorize_();
  const data = input || {};
  return withScriptLock_(function () {
    const person = readTable_('People').find(function (row) { return String(row.person_id) === String(data.personId || ''); });
    if (!person) throw new Error('人物が見つかりません。');
    if (Number(person.revision || 0) !== Number(data.revision || 0)) throw new Error('別の画面で更新されています。再読み込みしてください。');
    const name = canonicalDisplayName_(data.name);
    if (!name) throw new Error('氏名は必須です。');
    const patch = {
      canonical_name: name,
      name_kana: String(data.kana || '').trim(),
      aliases_json: JSON.stringify(Array.isArray(data.aliases) ? data.aliases.filter(Boolean) : []),
      profile_tags_json: JSON.stringify(Array.isArray(data.profileTags) ? data.profileTags.filter(Boolean) : parseJsonArray_(person.profile_tags_json)),
      active_status: String(data.activeStatus || 'active'),
      updated_at: nowIso_(),
      revision: Number(person.revision || 0) + 1
    };
    updateRecordRow_('People', person._row, patch);
    bumpDataVersion_();
    appendAudit_('update', 'Person', person.person_id, patch);
    return Object.assign(serializeForClient_(person), patch);
  });
}

function previewRosterImport(payload) {
  authorize_();
  const rows = payload && Array.isArray(payload.rows) ? payload.rows : [];
  if (!rows.length) throw new Error('取込データに行がありません。');
  if (rows.length > 2000) throw new Error('一度に取り込めるのは2000行までです。');
  return withScriptLock_(function () {
    const people = readTable_('People');
    const batchId = newId_('batch');
    const createdAt = nowIso_();
    const staged = rows.map(function (source, index) {
      const printedName = String(source.printed_name || source.printedName || '').trim();
      if (!printedName) throw new Error((index + 1) + '行目の氏名が空です。');
      const match = classifyNameMatch_(printedName, people);
      return {
        import_row_id: String(source.import_row_id || newId_('imp')),
        batch_id: batchId,
        fiscal_year: String(source.fiscal_year || ''), organization: String(source.organization || ''), department: String(source.department || ''),
        role: String(source.role || ''), printed_name: printedName, normalized_name: normalizeName_(printedName),
        source_pdf: String(source.source_pdf || ''), source_page: String(source.source_page || ''), source_raw: String(source.source_raw || ''),
        candidate_person_id: match.candidatePersonId, match_type: match.matchType,
        confidence: String(source.confidence === undefined ? '' : source.confidence), review_status: 'pending', resolution_note: '', created_at: createdAt
      };
    });
    const sameYearCounts = {};
    staged.forEach(function (row) {
      const key = String(row.fiscal_year) + '\u001f' + String(row.normalized_name);
      sameYearCounts[key] = (sameYearCounts[key] || 0) + 1;
    });
    staged.forEach(function (row) {
      const key = String(row.fiscal_year) + '\u001f' + String(row.normalized_name);
      if (sameYearCounts[key] > 1) {
        row.match_type = 'ambiguous_same_name';
        row.candidate_person_id = '';
      }
    });
    appendRecords_('ImportStaging', staged);
    appendAudit_('preview', 'RosterImport', batchId, { rows: staged.length });
    return { batchId: batchId, summary: summarizeImportRows_(staged), rows: staged.map(serializeForClient_) };
  });
}

function summarizeImportRows_(rows) {
  return rows.reduce(function (summary, row) {
    summary.total += 1;
    summary[row.match_type] = (summary[row.match_type] || 0) + 1;
    return summary;
  }, { total: 0, exact_unique: 0, ambiguous: 0, ambiguous_same_name: 0, new_candidate: 0 });
}

function getImportBatch(batchId) {
  authorize_();
  const rows = readTable_('ImportStaging').filter(function (row) { return String(row.batch_id) === String(batchId); });
  return { batchId: String(batchId), summary: summarizeImportRows_(rows), rows: rows.map(serializeForClient_) };
}

function commitRosterImport(input) {
  authorize_();
  const data = input || {};
  const batchId = String(data.batchId || '');
  const resolutions = Array.isArray(data.resolutions) ? data.resolutions : [];
  const resolutionByRow = {};
  resolutions.forEach(function (item) { resolutionByRow[String(item.importRowId)] = item; });
  return withScriptLock_(function () {
    const staged = readTable_('ImportStaging').filter(function (row) { return String(row.batch_id) === batchId && String(row.review_status) === 'pending'; });
    if (!staged.length) throw new Error('未確定の取込行がありません。');
    const people = readTable_('People');
    const assignments = readTable_('Assignments');
    const newPeople = [];
    const newAssignments = [];
    const updates = [];
    const createdPersonByNormalized = {};
    const sameYearDuplicateKeys = {};
    staged.forEach(function (row) {
      if (String(row.match_type) === 'ambiguous_same_name') sameYearDuplicateKeys[String(row.normalized_name)] = true;
    });
    staged.forEach(function (row) {
      const requested = resolutionByRow[String(row.import_row_id)] || {};
      let action = String(requested.action || '');
      let personId = String(requested.personId || '');
      if (!action && String(row.match_type) === 'exact_unique') {
        action = 'link';
        personId = String(row.candidate_person_id);
      }
      if (action === 'defer') {
        updates.push({ row: row, status: 'pending', note: String(requested.note || '') });
        return;
      }
      if (action === 'skip') {
        updates.push({ row: row, status: 'skipped', note: String(requested.note || '') });
        return;
      }
      if (action === 'create') {
        const normalized = String(row.normalized_name);
        if (createdPersonByNormalized[normalized] && !sameYearDuplicateKeys[normalized]) {
          personId = createdPersonByNormalized[normalized];
        } else {
          personId = newId_('per');
          const timestamp = nowIso_();
          newPeople.push({ person_id: personId, canonical_name: canonicalDisplayName_(row.printed_name), name_kana: '', aliases_json: JSON.stringify([String(row.printed_name)]), profile_tags_json: '[]', active_status: 'active', created_at: timestamp, updated_at: timestamp, revision: 1 });
          if (!sameYearDuplicateKeys[normalized]) createdPersonByNormalized[normalized] = personId;
        }
      } else if (action === 'link') {
        const exists = people.concat(newPeople).some(function (person) { return String(person.person_id) === personId; });
        if (!exists) throw new Error(row.printed_name + ' の紐付け先が見つかりません。');
      } else {
        throw new Error(row.printed_name + ' は手動確認が必要です。');
      }
      const duplicate = assignments.concat(newAssignments).some(function (assignment) {
        return String(assignment.person_id) === personId && String(assignment.fiscal_year) === String(row.fiscal_year) &&
          String(assignment.organization) === String(row.organization) && String(assignment.role) === String(row.role);
      });
      if (!duplicate) {
        const timestamp = nowIso_();
        newAssignments.push({ assignment_id: newId_('asg'), person_id: personId, fiscal_year: row.fiscal_year, organization: row.organization,
          department: row.department, role: row.role, employment_type: '', source_pdf: row.source_pdf, source_page: row.source_page,
          source_raw_name: row.printed_name, verified_status: 'verified', created_at: timestamp, updated_at: timestamp });
      }
      updates.push({ row: row, status: 'committed', note: String(requested.note || '') });
    });
    appendRecords_('People', newPeople);
    appendRecords_('Assignments', newAssignments);
    updates.forEach(function (item) { updateRecordRow_('ImportStaging', item.row._row, { review_status: item.status, resolution_note: item.note }); });
    bumpDataVersion_();
    const skipped = updates.filter(function (item) { return item.status === 'skipped'; }).length;
    const deferred = updates.filter(function (item) { return item.status === 'pending'; }).length;
    appendAudit_('commit', 'RosterImport', batchId, { peopleCreated: newPeople.length, assignmentsCreated: newAssignments.length, skipped: skipped, deferred: deferred });
    return { ok: true, batchId: batchId, peopleCreated: newPeople.length, assignmentsCreated: newAssignments.length, skipped: skipped, deferred: deferred };
  });
}
