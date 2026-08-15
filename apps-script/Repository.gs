function nowIso_() { return new Date().toISOString(); }
function newId_(prefix) { return prefix + '_' + Utilities.getUuid().replace(/-/g, ''); }

function getSheetRequired_(name) {
  const sheet = getDatabase_().getSheetByName(name);
  if (!sheet) throw new Error(name + ' シートがありません。setupV2Schema() を先に実行してください。');
  return sheet;
}

function readTable_(name) {
  const sheet = getSheetRequired_(name);
  if (sheet.getLastRow() < 2) return [];
  const values = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
  const headers = values.shift().map(String);
  return values.map(function (row, rowIndex) {
    const record = { _row: rowIndex + 2 };
    headers.forEach(function (header, index) { record[header] = row[index]; });
    return record;
  });
}

function appendRecords_(name, records) {
  if (!records.length) return;
  const sheet = getSheetRequired_(name);
  const headers = tableSchemas_()[name];
  const values = records.map(function (record) {
    return headers.map(function (header) {
      const value = record[header];
      if (value === null || value === undefined) return '';
      return value instanceof Date ? value : String(value);
    });
  });
  sheet.getRange(sheet.getLastRow() + 1, 1, values.length, headers.length).setValues(values);
}

function updateRecordRow_(name, rowNumber, patch) {
  const sheet = getSheetRequired_(name);
  const headers = tableSchemas_()[name];
  const range = sheet.getRange(rowNumber, 1, 1, headers.length);
  const values = range.getValues()[0];
  headers.forEach(function (header, index) {
    if (Object.prototype.hasOwnProperty.call(patch, header)) values[index] = patch[header];
  });
  range.setValues([values]);
}

function upsertSetting_(key, value) {
  const existing = readTable_('Settings').find(function (row) { return String(row.key) === String(key); });
  if (existing) updateRecordRow_('Settings', existing._row, { value: value, updated_at: nowIso_() });
  else appendRecords_('Settings', [{ key: key, value: value, updated_at: nowIso_() }]);
}

function getSetting_(key) {
  const existing = readTable_('Settings').find(function (row) { return String(row.key) === String(key); });
  return existing ? String(existing.value || '') : '';
}

function getDataVersion_() { return getSetting_('data_version'); }
function bumpDataVersion_() {
  const version = nowIso_();
  upsertSetting_('data_version', version);
  return version;
}

function appendAudit_(action, entityType, entityId, details) {
  appendRecords_('AuditLog', [{
    audit_id: newId_('aud'),
    actor_email: Session.getActiveUser().getEmail() || '',
    action: action,
    entity_type: entityType,
    entity_id: entityId,
    details_json: JSON.stringify(details || {}),
    created_at: nowIso_()
  }]);
}

function parseJsonArray_(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function serializeForClient_(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serializeForClient_);
  if (value && typeof value === 'object') {
    const result = {};
    Object.keys(value).forEach(function (key) {
      if (key !== '_row') result[key] = serializeForClient_(value[key]);
    });
    return result;
  }
  return value === null || value === undefined ? '' : value;
}
