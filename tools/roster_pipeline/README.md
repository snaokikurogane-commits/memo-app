# 名簿PDF抽出パイプライン

R6・R7・R8のPDFを、直接確定データにせず `ImportStaging` 用JSONへ変換します。

```powershell
$python = 'C:\Users\puppl\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
& $python tools\roster_pipeline\extract_rosters.py `
  --source-root 'F:\人物マスタアプリ\名簿' `
  --output '.private\roster-audit'
```

生成物:

- `import-staging.json`: アプリの名簿取込画面へ渡す候補
- `audit-report.json`: 年度別件数、重複、OCR確認件数、ページ診断

R8はPDF文字座標と表罫線から役職・氏名を抽出します。R6・R7はWindows日本語OCRを表単位・役職列／氏名列単位に実行します。OCR行はすべて `needs_review` となり、原本確認なしに人物マスタへ確定されません。

住所・電話番号・FAXは抽出対象外です。`.private/` はGit管理対象外です。
