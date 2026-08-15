function getConfig_() {
  const properties = PropertiesService.getScriptProperties();
  const spreadsheetId = properties.getProperty('SPREADSHEET_ID');
  if (!spreadsheetId) throw new Error('Script Property SPREADSHEET_ID が未設定です。');
  return {
    spreadsheetId: spreadsheetId,
    allowedEmails: String(properties.getProperty('ALLOWED_EMAILS') || '')
      .split(',')
      .map(function (value) { return value.trim().toLowerCase(); })
      .filter(Boolean),
    currentFiscalYear: properties.getProperty('CURRENT_FISCAL_YEAR') || '令和8年度'
  };
}

function authorize_() {
  const config = getConfig_();
  const email = String(Session.getActiveUser().getEmail() || '').toLowerCase();
  if (config.allowedEmails.length && (!email || config.allowedEmails.indexOf(email) === -1)) {
    throw new Error('このアプリを使用する権限がありません。');
  }
  return email;
}

function getDatabase_() {
  return SpreadsheetApp.openById(getConfig_().spreadsheetId);
}

function withScriptLock_(callback) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    return callback();
  } finally {
    lock.releaseLock();
  }
}
