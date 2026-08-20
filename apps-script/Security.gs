function getSecurityStatus() {
  authorize_();
  const file = DriveApp.getFileById(getConfig_().spreadsheetId);
  return {
    spreadsheetSharingAccess: String(file.getSharingAccess()),
    spreadsheetSharingPermission: String(file.getSharingPermission()),
    activeUser: Session.getActiveUser().getEmail() || ''
  };
}

function hardenSpreadsheetSharing() {
  authorize_();
  return withScriptLock_(function () {
    const file = DriveApp.getFileById(getConfig_().spreadsheetId);
    const before = { access: String(file.getSharingAccess()), permission: String(file.getSharingPermission()) };
    file.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
    const after = { access: String(file.getSharingAccess()), permission: String(file.getSharingPermission()) };
    appendAudit_('harden_sharing', 'Spreadsheet', getConfig_().spreadsheetId, { before: before, after: after });
    return { ok: true, before: before, after: after, deploymentReminder: 'ウェブアプリのアクセス権も「自分のみ」に設定してください。' };
  });
}
