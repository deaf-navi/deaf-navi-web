# おとまど（OtoMado）

**音を、見える窓へ。** — ろう者・難聴者のための、無料の情報保障ツールボックス。

インストール不要・サーバーレス・完全無料。ブラウザだけで動くPWAです。

## 3つのツール

| ツール | 何ができるか | 技術 |
|---|---|---|
| **おとセンサー** | マイクで周囲の音を見張り、インターホン・警報・赤ちゃんの泣き声など10カテゴリを画面の光と振動で通知。検知履歴つき | Web Audio API + TensorFlow.js **YAMNet**（521クラス音分類・全処理オンデバイス） |
| **じまく** | 相手の話し声をリアルタイムで巨大字幕に変換。日英切替・文字サイズ6段階・全文コピー | Web Speech API |
| **ひつだん** | 文字を巨大表示して相手に見せる筆談ボード。180°反転・定型文・履歴 | 純クライアント |

## プライバシー

- **おとセンサーの音声はこの端末の外に出ません**。AI分類はブラウザ内（WebGL）で完結します
- じまくはブラウザの音声認識機能を使うため、ブラウザによっては音声が認識サービス（Google等）へ送られます。UI上に明示しています

## アクセシビリティ

- WCAG 2.2 AA 準拠を設計基準（主要テキストは 7:1 コントラスト目標）
- 全機能キーボード操作可・スキップリンク・フォーカス可視
- アラートの明滅は 1Hz（WCAG 2.3.1 の3回/秒制限内）、`prefers-reduced-motion` で停止
- 色だけに依存しない通知（アイコン＋テキスト＋振動＋位置）
- スクリーンリーダーへの検知通知（設定でON/OFF・盲ろうの方の点字ディスプレイ利用を想定）
- Deaf Navi Web と共通の日本語書体設計・タッチターゲット44px以上・日英2言語
- Aurora・ダーク・ライト・グリーンの4テーマ（Auroraのみグラスモーフィング）

## 開発

```bash
npm ci
npm run dev      # 開発サーバー
npm test         # vitest（80テスト）
npm run build    # 型チェック + 本番ビルド → ../../docs/otomado/
npm run icons    # PWAアイコン再生成（依存ゼロの自前PNGエンコーダ）
```

スタック: Vite + React 19 + TypeScript strict。ランタイム依存は react / react-dom / @tensorflow/tfjs（動的import・おとセンサー使用時のみロード）のみ。

## デプロイ

`base: './'` の相対パス構成で、Deaf Navi Web の `docs/otomado/` へビルドします。

公開URL: `https://tamas-hub.github.io/deaf-navi-web/otomado/`

## YAMNetモデルの取得戦略

1. まず同梱パス `public/model/yamnet/` を試す（同梱すれば外部依存ゼロ化できる）
2. 無ければ TFHub 公式配信 `https://tfhub.dev/google/tfjs-model/yamnet/tfjs/1` から取得（CORS可・Service Workerがキャッシュ）
3. どちらも失敗した場合、エネルギー検知（「大きな音」）のみで動作継続

クラスマップは `raw.githubusercontent.com`（tensorflow/models）から取得し、同様にローカル優先・SWキャッシュです。

## ライセンス

- 本体: MIT License
- 音分類モデル: [YAMNet](https://tfhub.dev/google/yamnet/1)（Google, Apache License 2.0）
