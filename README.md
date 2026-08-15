# 人物ネタ帳 v2

氏名ではなく永続的な `person_id` で、人物・年度別所属・会話・イベントを結ぶ再構築版です。PDF名簿は確認用ステージングへ入り、確認前に人物マスタを上書きしません。

## 実装済み

- R8デジタルPDFの役職・氏名抽出
- R6・R7画像PDFのWindows日本語OCR（全件 `needs_review`）
- 旧字体、異体字、空白、括弧を除いた検索用氏名の生成
- OCR結果とR8／既存シート書出しデータの照合・監査
- `People`、`Assignments`、`Conversations`、`Events`、`ImportStaging` のv2スキーマ
- 旧シートを削除しない移行処理と、未照合・同姓同名の隔離
- `getBootstrap`、`getPerson`、`saveConversation`、`previewRosterImport`、`commitRosterImport`
- Googleログイン＋許可メールの二重確認、スプレッドシート共有の非公開化関数
- モバイル向けの人物検索、次に話す、最近話した、全画面詳細、30秒入力、年度名簿確認画面
- 動的データを `innerHTML` や `localStorage` へ入れない表示実装

## 現行データの監査結果

- `人物マスタ` は721行（R7: 323、R8: 398）、安全に一意化できる人物は528人
- `メモ履歴` は実メモ83件。76件は人物候補へ自動で結び付け可能、6件は氏名未照合、1件は人物名が空欄
- 同一年度・同一正規化氏名の曖昧候補が1組（2行）あり、自動結合せず確認対象とする
- R8原本からは324人を直接抽出。現行R8データとは259人が一致し、原本だけ65人、シートだけ139人
- R6・R7は画像OCR候補を生成済みだが、正式取込前に全件を原本画像で確認する

この集計は個人名を含まない監査値です。元の書出しデータとOCR生成物は `.private/` に置き、Git管理から除外しています。

## ディレクトリ

- `apps-script/` — Google Apps Scriptへ配置するアプリ本体
- `tools/roster_pipeline/` — PDF抽出・照合・監査ツール
- `tests/` — Apps Script構文、UIスクリプト、氏名正規化、OCRフィルタのテスト
- `.private/` — 実名入りの生成物。Git管理対象外

## 1. 名簿データを作る

```powershell
$rosterPython = 'C:\Users\puppl\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
& $rosterPython tools\roster_pipeline\extract_rosters.py `
  --source-root 'F:\人物マスタアプリ\名簿' `
  --output '.private\roster-audit'

& $rosterPython tools\roster_pipeline\reconcile_rosters.py `
  --staging '.private\roster-audit\import-staging.json' `
  --output '.private\roster-reconciliation'
```

現在のスプレッドシートを書き出したCSVまたはJSONがある場合は、照合コマンドへ `--existing <ファイル>` を追加できます。

生成物:

- `import-staging.json` — アプリの名簿取込画面へ渡すデータ
- `import-staging-r6.json` / `-r7.json` / `-r8.json` — 安全に年度単位で取り込むデータ
- `audit-report.json` — 年度・PDF別件数、重複、要確認件数
- `reconciled-staging.json` — R8や既存シートからの候補を付けたデータ
- `review.csv` — 原本を見ながら確認する一覧
- `reconciliation-audit.json` — 分類、所属別人数、年度間の同一人物候補

R8は抽出精度が高いため基準にできます。R6・R7は撮影画像なので、候補が一致しても原本画像を見て確定してください。電話、FAX、住所は人物データに取り込みません。

## 2. Apps Scriptを接続する

1. 対象のApps Scriptプロジェクトへ `apps-script/` のファイルを配置します。
2. Script Propertiesへ次を設定します。
   - `SPREADSHEET_ID`: 対象スプレッドシートID
   - `ALLOWED_EMAILS`: 使用する自分のGoogleメールアドレス。複数ならカンマ区切り
   - `CURRENT_FISCAL_YEAR`: 例 `令和8年度`
3. エディタから `setupV2Schema()` を一度実行します。
4. 旧データがある場合は `migrateLegacyData()` を一度実行し、戻り値と `ImportStaging`／`LegacyArchive` を確認します。
5. `hardenSpreadsheetSharing()` を実行して、リンク共有を非公開へ変更します。
6. ウェブアプリを新規デプロイし、実行ユーザーとアクセス権を自分のアカウントだけに限定します。

既存タブは削除・上書きされません。同一年度に同じ正規化氏名が複数ある行と、人物を一意に特定できない会話メモは自動結合されず、確認用シートへ残ります。

## 3. 初回取込の安全な順序

1. 旧シートの移行結果を確認
2. R8だけを抽出して取込・確定
3. R7を取込し、R8人物への候補を確認
4. R6を取込し、R7・R8人物への候補を確認
5. 年度別人数、所属別人数、同姓同名、未照合メモを監査

全年度を一括確定せず、年度単位で進めると誤結合を見つけやすくなります。

## テスト

```powershell
& 'C:\Users\puppl\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test tests\*.test.cjs
& 'C:\Users\puppl\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m unittest discover -s tests -p test_*.py -v
```

ローカルUI確認では `apps-script/Index.html` が架空データのモックで動きます。Google接続時は `google.script.run` へ自動で切り替わります。

## 未接続の外部作業

ローカル実装は完了していますが、Google側への配置・既存83件の実移行・公開URLの切替はまだ実行していません。続行にはApps ScriptのScript IDまたは `Code.gs` 一式と、GitHubリポジトリURLが必要です。パスワードや秘密鍵は不要です。
