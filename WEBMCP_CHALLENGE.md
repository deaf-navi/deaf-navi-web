# Deaf Navi Web — WebMCP Challenge

Deaf Navi Web を、[OpenAI WebMCP Challenge](https://openai.com/webmcp-challenge/) に向けて「人とAgentが同じページ・同じ状態を見ながら操作できる」Web体験へ拡張した記録です。

> **公開状況:** Challenge実装は公開済みです。WebMCP公開物を生成したcommitは `88dc244` で、ChatGPT内蔵ブラウザが公開URLから7 Toolを検出・実行できることを確認しました。後続の検証記録commitは公開資産を変更しません。確認済み範囲は「動作確認状況」を参照してください。

> **2026年9月3日 方針変更:** 音声付きデモ動画の作成を一旦見送り、通常のフロントはChallenge実装前の見た目へ戻しました。7 ToolとAgent Activity / Undoの内部実装は削除せず、Agent Activityパネルを公開UIで非表示にしています。WebMCP専用の情報源選択肢は通常HTMLへ出さず、Toolが要求した時だけ動的に追加します。以下は実装・公開検証時点の記録です。

- **Live Demo:** https://deaf-navi.github.io/deaf-navi-web/
- **Source:** https://github.com/deaf-navi/deaf-navi-web
- **Challenge:** https://openai.com/webmcp-challenge/
- **WebMCP / site tools:** https://learn.chatgpt.com/docs/webmcp

## Deaf Naviとは

Deaf Naviは、聴覚障害・難聴・ろう・中途失聴等の当事者と周囲の人が、ニュース、制度、緊急通報、防災、医療、教育、就労、情報保障ツールへたどり着きやすくする情報ポータルです。公的機関や専門団体等の情報を分類して入口をつくり、Web、PWA、iOSアプリ向け同期JSONを提供しています。

## WebMCP導入前から存在した機能

次の機能はChallenge期間中に新規開発したものではありません。2026年8月25日より前から存在していたDeaf Navi Webの通常機能です。

- フリーワード、カテゴリ、情報源、期間、地域によるニュース検索・絞り込み
- 検索条件のURL同期と共有
- 緊急通報、防災、医療、教育、就労、電話サービス等をまとめた「暮らしのガイド」
- テーマ切替と3段階の文字サイズ
- 情報保障PWA「おとまど」の音の可視化、リアルタイム字幕、筆談ボード
- PWA、オフライン閲覧、キーボード操作、スクリーンリーダー向け状態通知
- GitHub Pagesによる静的配信とiOSアプリ向け同期JSON

区別のための基準点は、2026年8月25日（JST）より前の最終コミット `4292e91` です。2026年8月27日のCloudflare Web Analytics対応 `c0d0632` はChallenge期間中の変更ですが、WebMCP機能ではないためChallenge実装として数えていません。

## 2026年8月25日以降に追加したWebMCP機能

Challenge対応として追加したのは、既存機能を置き換える新しいバックエンドではなく、現在開いているページの機能をAgentへ安全に公開する薄い連携層です。

- `document.modelContext.registerTool()` を使うImperative APIのTool登録
- 既存の検索、フィルタ、表示設定、ガイド、おとまどへの導線を再利用する7 Tool
- Agentが変更した検索条件・表示設定を同じ画面で確認できる「Agent Activity」
- Agentによる直近の状態変更を戻す「Undo agent changes」
- Agentが重要と判断した記事を現在の一覧内で強調し、利用者が結果を目視確認できる表示
- `document.modelContext` がない通常ブラウザではTool登録だけを省略し、既存サイトをそのまま使えるprogressive enhancement

## WebMCPを採用する理由

Deaf Naviでは、検索結果だけを会話へ返すより、利用者が見ている画面上で検索条件、情報源、文字サイズ、選ばれた記事を確認できることが重要です。WebMCPなら、AgentはDOMを推測して何度もクリックする代わりに、JSON Schemaで定義された操作を呼び出し、既存UIの状態をその場で更新できます。

この構成には次の利点があります。

- 人とAgentが同じページの現在状態を共有できる
- Agentの操作結果が画面、URL、Agent Activityに残り、人が確認・修正・Undoできる
- 既存のアクセシブルなUIとクライアント処理が唯一の操作対象として保たれる
- GitHub Pagesの静的構成を維持でき、APIキーや新しいサーバーを必要としない
- WebMCP非対応環境を壊さない

## 人間とAgentが共同で可能になったこと

想定する代表シナリオは次のとおりです。

1. 利用者: 「奈良県に関係する最近の手話・制度情報を見せて」
2. Agent: 地域・カテゴリ・期間を検索条件へ反映し、結果を同じ一覧へ表示する
3. 利用者: 「公式情報だけに絞って」
4. Agent: 情報源を一次情報へ変更する
5. 利用者: 「重要なものを画面上で分かりやすく表示して」
6. Agent: 選んだ記事を現在の画面で強調する
7. 利用者: 「文字を大きくして」
8. Agent: 既存の文字サイズ設定を変更する
9. 利用者: 「筆談ボードを開いて」
10. Agent: おとまどの筆談ボードへ移動する

各操作はAgent Activityへ記録されます。利用者は検索条件や表示結果をその場で変更でき、Agentによる直近の同一ページ内の状態変更はUndoできます。ガイドやおとまどを開く操作はページ遷移になるため、遷移元ページのUndo対象にはしません。記事件数は日々の収集内容で変わり、条件によって0件になることも正常な結果です。

## 登録したTool一覧

| Tool | 役割 | 主なUIへの効果 |
|---|---|---|
| `search_deaf_info` | ニュースを検索・絞り込み | 検索欄、カテゴリ、地域、情報源、期間、URL、一覧を同期 |
| `show_results` | 指定した記事を表示・強調 | 現在の一覧内で記事カードを強調し、先頭結果へ移動 |
| `get_emergency_resources` | 地域に関連する緊急通報・防災情報を表示 | 現在の一覧を防災・安全で絞り、緊急通報ガイドのURLを返す |
| `open_life_guide` | 制度・生活情報等のガイドを開く | 指定トピックのガイドセクションへ移動 |
| `set_accessibility_preferences` | 文字サイズ・テーマを変更 | 既存の表示設定を即時反映し保存 |
| `open_accessibility_tool` | 情報保障ツールを開く | 字幕、筆談、音の可視化の該当画面へ移動 |
| `get_current_view_state` | 現在の検索・表示状態を読む | UIを変更せず、Agentへ現在状態を返す |

Tool引数の `sourceType` は、利用者に見える「情報源の品質区分」を指し、記事データの `sourceTier`（`official` / `specialist` / `news` / `broad`）に対応します。RSS、social、video等の取得方式を表す同名データ項目とは別です。`official` は一次情報のみ、`primary` は一次情報と専門情報を合わせた条件です。

## 各ToolのinputSchema

以下は実装の `inputSchema` と同じ内容を記載します。すべてのSchemaは未定義プロパティを受け付けません。

<!-- WEBMCP_SCHEMA_SYNC_START -->

### `search_deaf_info`

```json
{
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "maxLength": 200,
      "description": "Literal search words. Omit to keep the current query; use an empty string to clear it."
    },
    "category": {
      "type": "string",
      "enum": [
        "all",
        "policy",
        "accessibility",
        "relay",
        "medical",
        "education",
        "technology",
        "culture",
        "sports",
        "safety",
        "event",
        "local",
        "general"
      ],
      "description": "Use accessibility for sign-language and information-access topics."
    },
    "region": {
      "type": "string",
      "enum": [
        "all",
        "hokkaido_tohoku",
        "kanto",
        "chubu",
        "kinki",
        "nara",
        "chugoku_shikoku",
        "kyushu_okinawa"
      ],
      "description": "Existing regional block. nara visibly combines the Kinki control with a Nara search term."
    },
    "sourceType": {
      "type": "string",
      "enum": ["all", "official", "specialist", "primary", "news", "other"],
      "description": "Visible source-quality tier. official means first-party/public-body information; primary means official plus specialist."
    },
    "period": {
      "type": "string",
      "enum": ["all", "24h", "7d", "30d"],
      "description": "Publication period. Omit to keep the current period."
    }
  },
  "additionalProperties": false
}
```

### `show_results`

```json
{
  "type": "object",
  "properties": {
    "articleIds": {
      "type": "array",
      "maxItems": 5,
      "items": { "type": "string", "maxLength": 2048 }
    },
    "count": {
      "type": "integer",
      "minimum": 1,
      "maximum": 5,
      "default": 3
    }
  },
  "additionalProperties": false
}
```

`articleIds` を省略した場合は、現在表示中の先頭から `count` 件を強調します。

### `get_emergency_resources`

```json
{
  "type": "object",
  "properties": {
    "region": {
      "type": "string",
      "enum": [
        "all",
        "hokkaido_tohoku",
        "kanto",
        "chubu",
        "kinki",
        "nara",
        "chugoku_shikoku",
        "kyushu_okinawa"
      ],
      "description": "Existing regional block. nara visibly combines the Kinki control with a Nara search term."
    },
    "period": {
      "type": "string",
      "enum": ["all", "24h", "7d", "30d"],
      "description": "Publication period. Omit to use the emergency view default of 30 days."
    }
  },
  "additionalProperties": false
}
```

### `open_life_guide`

```json
{
  "type": "object",
  "properties": {
    "topic": {
      "type": "string",
      "enum": ["all", "emergency", "medical", "education", "employment", "phone", "life"],
      "default": "all"
    }
  },
  "additionalProperties": false
}
```

### `set_accessibility_preferences`

```json
{
  "type": "object",
  "properties": {
    "textSize": {
      "type": "string",
      "enum": ["standard", "large", "xlarge"]
    },
    "theme": {
      "type": "string",
      "enum": ["light", "dark"]
    }
  },
  "minProperties": 1,
  "additionalProperties": false
}
```

### `open_accessibility_tool`

```json
{
  "type": "object",
  "properties": {
    "tool": {
      "type": "string",
      "enum": ["captions", "writing_board", "sound_visualizer"]
    }
  },
  "required": ["tool"],
  "additionalProperties": false
}
```

### `get_current_view_state`

```json
{
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

<!-- WEBMCP_SCHEMA_SYNC_END -->

## 実装ファイル

Challenge対応で変更または追加するソースは次のとおりです。`docs/` はビルド生成物であり、直接編集しません。

- `src/webmcp.js` — Tool登録、実行、Agent Activity、Undo、非対応ブラウザのfallback
- `src/app.js` — 既存検索・絞り込み処理を再利用するページ内APIと結果状態
- `src/ui-controls.js` — 既存のテーマ・文字サイズ処理を再利用するページ内API
- `src/templates/home.mjs` — Agent Activity UIとWebMCPスクリプト読込
- `src/styles.css` — Agent Activityと記事強調表示
- `src/build.mjs` / `src/assets/sw.js` — `webmcp.js` の生成・PWA配信。同一内容hashをCSSと3本のJSへ付け、更新直後の新旧資産混在を防止
- `package.json` — WebMCP回帰テストを既存テストコマンドへ追加
- `scripts/verify-site.mjs` — 生成物、7 Tool、feature guardの公開前検証
- `test/templates.test.mjs` — Agent Activity、情報源select、スクリプト読込順の回帰テスト
- `test/webmcp.test.mjs` — Tool定義、Schema、fallback等の最小回帰テスト
- `README.md` / `WEBMCP_CHALLENGE.md` — Challenge説明と再現手順
- `LICENSE` — リポジトリ直下のMIT License（公開後にGitHubのライセンス認識を確認）
- `docs/webmcp.js` / `docs/index.html` / `docs/styles.css` / `docs/sw.js` — `npm run build` で生成される公開物

## ライセンス

Challenge対応開始時、`package.json` とREADMEはコードをMITとしていましたが、リポジトリ直下に `LICENSE` はなく、GitHubのライセンス表示も未認識でした。commit `7cb295c` で標準MIT Licenseを追加し、公開後にGitHubが **MIT License** として認識することを確認しました。

MITの対象はサイトのコードです。記事タイトル・要約等の権利は各発信元に帰属し、リンク先の外部コンテンツを再許諾しません。Deaf Naviのブランド、iOSアプリアイコン、PWAアイコン、OG画像等は制作・権利由来の文書化が未完了のため、Devpost提出前に所有者確認を行います。

## Architecture

```text
利用者の自然言語
        │
        ▼
ChatGPT built-in browser / WebMCP対応Agent
        │  discover + call
        ▼
document.modelContext.registerTool()
        │
        ▼
src/webmcp.js  ──────► Agent Activity / Undo
        │
        ├──► DeafNaviApp ─────► 既存の検索・フィルタ・記事一覧・URL
        ├──► DeafNaviDisplay ─► 既存のテーマ・文字サイズ・localStorage
        └──► 通常のURL遷移 ───► 暮らしのガイド / おとまど
```

Toolはクライアント側だけで動作し、収集データやサーバーを直接書き換えません。人が使う既存UIとAgent用Toolは同じ処理を通り、結果は画面で検証できます。

## ローカルでの動作確認方法

```bash
npm run build
npm run serve
```

`http://localhost:5173/` を開き、次を確認します。

1. 通常の検索、カテゴリ、情報源、期間、地域フィルタが動く
2. テーマと文字サイズが切り替わる
3. 暮らしのガイドとおとまどへ移動できる
4. 通常画面にAgent ActivityパネルやWebMCP専用の情報源選択肢が出ず、Challenge実装前と同じ見た目で利用できる
5. WebMCP対応環境では7 Toolが登録される
6. Tool実行後に一覧、URL、表示設定が更新される
7. `official` / `specialist` はTool実行時だけ情報源selectへ追加される

Agent Activity / Undoの内部実装は保持していますが、2026年9月3日以降の通常画面では非表示です。再度Challengeデモを行う場合は、表示を戻してからActivityとUndoを確認します。

最小自動検証は次を実行します。

```bash
npm test
npm run build
npm run verify
```

## ChatGPT in-app browserでのテスト方法

OpenAIの[サイトツール公式ガイド](https://learn.chatgpt.com/docs/webmcp)に沿って確認します。

1. ChatGPTデスクトップアプリを最新版へ更新する
2. サイトツールに対応するGPT-5.6 SolまたはGPT-5.6 Terraを選ぶ（GPT-5.6 Lunaでは現在無効）
3. **設定 > ブラウザ > 権限** でサイトツールを有効にする
4. ChatGPTの内蔵ブラウザでLive Demoまたは `http://localhost:5173/` を開く
5. アドレスバーの「サイトツール」から、利用可能な7 ToolとSchemaを確認する
6. 下記のDemo Promptsを順に送り、ページの検索条件、一覧、強調、文字サイズを確認する
7. 通常画面にはAgent Activity / Undoが表示されないことを確認する

サイトツールの利用可否はアプリのrollout、アカウント、workspaceによって異なります。OpenAI公式ガイドでは、現時点でEnterprise / Edu workspaceは対象外と案内されています。

## Chrome WebMCP testing flagでのテスト方法

Chrome公式の[WebMCPガイド](https://developer.chrome.com/docs/ai/webmcp)に沿って確認します。

1. Chromeで `chrome://flags/#enable-webmcp-testing` を開く
2. **Enabled** に変更する
3. Chromeを再起動する
4. Live Demoまたは `http://localhost:5173/` を開く
5. 対応するWebMCP inspector / Agentから7 Tool、Schema、戻り値、画面更新を確認する

Chrome 149以降のDevToolsでToolを手動確認する場合は、必要に応じて `chrome://flags/#devtools-webmcp-support` も有効にし、DevToolsの **Application > WebMCP** でToolのSchemaと実行履歴を確認します。experimental flagは開発用であり、通常利用プロファイルとは分けることを推奨します。

## Demo Prompts

次を一つの会話で順に実行します。

```text
奈良県に関係する最近の手話・制度情報を見せて
公式情報だけに絞って
重要なものを画面上で分かりやすく表示して
文字を大きくして
筆談ボードを開いて
```

`region: "nara"` は、既存UIに県単位の地域selectがないため、画面上の「近畿」フィルターと検索欄の「奈良」を併用します。Agentが地域だけを指定した場合も検索語を画面に明示するため、近畿の別府県の記事を奈良関連として扱いません。2026年9月3日時点の収集データでは、奈良条件と `official` の組み合わせが0件になることを確認しています。0件を別区分の記事で埋めたり、専門情報を公式情報と表示したりはしません。デモ時に0件なら空状態をそのまま示し、利用者の同意を得て `primary`（一次・専門）または `all` へ広げてから `show_results` を実行します。

補助確認用:

```text
いまの検索条件と表示設定を教えて
地域を近畿、期間を30日にして、防災・安全の情報を探して
緊急通報のガイドを開いて
音の可視化ツールを開いて
```

## 動作確認状況

| 確認項目 | 状況 | 備考 |
|---|---|---|
| WebMCP定義・Schema・実行・rollback・人優先・アセット世代 | 確認済み | `node --test test/webmcp.test.mjs test/templates.test.mjs test/client-labels.test.mjs` — 15件成功。`npm test` — 56件成功 |
| 国内版 / World版のbuild・静的verify | 確認済み | `npm run build`、`npm run build:world`、`npm run verify`、`npm run verify:world` 成功 |
| 通常ブラウザで既存機能 | ローカル確認済み | Chromeで検索、情報源・期間filter、条件clear、テーマ、文字サイズを確認 |
| WebMCP非対応ブラウザの通常利用 | ローカル確認済み | Chromeで `document.modelContext` がない状態でも通常検索と表示設定が動作 |
| ChatGPT内蔵ブラウザでTool認識 | 公開URLで確認済み | in-app browserが7 ToolとSchemaを検出 |
| Tool実行で実UIが更新 | 公開URLで確認済み | 奈良検索、公式0件、強調、表示設定、緊急情報、共有状態、ガイド・筆談ボード遷移を確認 |
| Agent Activity | 内部実装・過去の公開確認済み / 現在非表示 | Tool操作の記録処理は保持。2026年9月3日以降の通常画面には表示しない |
| Undo / 人の操作優先 | 内部実装・過去の公開確認済み / 現在非表示 | 復元処理と人の操作による履歴無効化は保持。通常画面にはボタンを表示しない |
| Service Worker更新遷移 | ローカル確認済み | 旧キャッシュがあるin-app browserで1回の遷移後、再読み込みなしで同一hashのCSS/JSと7 Toolを確認 |
| 公開GitHub Pages | 確認済み | WebMCP生成head `88dc244`、Pages run [`33693602875`](https://github.com/deaf-navi/deaf-navi-web/actions/runs/33693602875) 成功。公開HTMLも同一hashのCSS/JSと7 Toolを確認 |
| 公開URLの通常Chrome / 375px | 確認済み | WebMCPなしの検索46件・条件clear・表示設定と、CSS幅375pxで横overflowなしを確認 |

## WebMCP関連コミット一覧

| Commit | 日付 | 内容 |
|---|---|---|
| [`7cb295c`](https://github.com/deaf-navi/deaf-navi-web/commit/7cb295c97b4b40322277811376bcbaf44159c779) | 2026-09-03 | 7 WebMCP Tool、Agent Activity、Undo、テスト、MIT License |
| [`feae753`](https://github.com/deaf-navi/deaf-navi-web/commit/feae753c456c55f48dcf28e21d72af0b0fb6806e) | 2026-09-03 | READMEのChallenge入口と本Challenge実装・検証文書 |

最終公開head `88dc244` は、Challenge実装を含む最新ソースで生成物を再構築した自動 `chore(publish)` です。自動収集commitやWeb Analyticsの `c0d0632` はWebMCP実装commit一覧には含めません。また、この一覧更新自身の検証メタデータcommitは列挙対象外です。

## Challenge要件との対応

- **Usefulness:** 情報探索から情報保障ツール起動までを自然言語でつなぐ
- **Originality:** 聴覚障害・難聴・ろう者等の情報アクセスを、人とAgentの共有UIとして設計
- **Execution:** 既存の実用サイトを壊さないprogressive enhancement
- **Thoughtful use of WebMCP:** 構造化Toolで既存処理を再利用し、UI、URL、Activity、Undoで結果を検証可能にする
- **Human-agent experience:** Agentが画面を支配するのではなく、人が状態を見て修正・Undoできる

## 提出前に残る確認

- Chrome testing flag / DevToolsでもTool、Schema、戻り値を確認する（通常利用プロファイルのflagは変更していない）
- ブランド、iOS / PWAアイコン、OG画像等の所有・利用権を確認する
- Devpostの説明、3分以内のデモ動画、リポジトリURL、Live Demo URLを揃える
