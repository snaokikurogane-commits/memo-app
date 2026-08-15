function schemaVersion_() { return 2; }

function tableSchemas_() {
  return {
    People: ['person_id', 'canonical_name', 'name_kana', 'aliases_json', 'profile_tags_json', 'active_status', 'created_at', 'updated_at', 'revision'],
    Assignments: ['assignment_id', 'person_id', 'fiscal_year', 'organization', 'department', 'role', 'employment_type', 'source_pdf', 'source_page', 'source_raw_name', 'verified_status', 'created_at', 'updated_at'],
    Conversations: ['conversation_id', 'person_id', 'occurred_at', 'note', 'next_topic', 'follow_up_at', 'tags_json', 'created_at', 'updated_at'],
    Events: ['event_id', 'person_id', 'event_type', 'event_date', 'label', 'repeat_yearly', 'created_at', 'updated_at'],
    ImportStaging: ['import_row_id', 'batch_id', 'fiscal_year', 'organization', 'department', 'role', 'printed_name', 'normalized_name', 'source_pdf', 'source_page', 'source_raw', 'candidate_person_id', 'match_type', 'confidence', 'review_status', 'resolution_note', 'created_at'],
    Settings: ['key', 'value', 'updated_at'],
    AuditLog: ['audit_id', 'actor_email', 'action', 'entity_type', 'entity_id', 'details_json', 'created_at'],
    LegacyArchive: ['archive_id', 'source_sheet', 'source_row', 'kind', 'payload_json', 'reason', 'created_at']
  };
}

function setupV2Schema() {
  authorize_();
  return withScriptLock_(function () {
    const spreadsheet = getDatabase_();
    const schemas = tableSchemas_();
    Object.keys(schemas).forEach(function (name) {
      let sheet = spreadsheet.getSheetByName(name);
      if (!sheet) sheet = spreadsheet.insertSheet(name);
      const headers = schemas[name];
      if (sheet.getLastRow() === 0) {
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      } else {
        const actual = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), headers.length)).getDisplayValues()[0].slice(0, headers.length);
        if (actual.join('\u001f') !== headers.join('\u001f')) {
          throw new Error(name + ' の列構成がv2スキーマと一致しません。既存シートを退避してから再実行してください。');
        }
      }
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#E8EEF9');
    });
    upsertSetting_('schema_version', String(schemaVersion_()));
    if (!getDataVersion_()) bumpDataVersion_();
    return { ok: true, schemaVersion: schemaVersion_(), tables: Object.keys(schemas) };
  });
}
