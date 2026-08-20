function doGet() {
  authorize_();
  return HtmlService.createTemplateFromFile('Index').evaluate()
    .setTitle('人物ネタ帳')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
