# Recurring Task v2 — 曜日指定・第n曜日指定

既存の ObsidianCore Task HUB と Recurring Definition に、曜日選択・月内週番号・次回候補プレビュー用の専用UIを追加します。UIは 98-System/01-script/recurring_schedule_ui.js、CSSは 98-System/99-dev/styles/recurring.css です。CSSは既存の Core 共通バンドルに統合され、Startup のスタイル同期で配布されます。新たな CSS Snippet の手動有効化は不要です。

## Frontmatter

既存の type, uid, title, enabled, frequency, interval, anchor, lookahead_days, start_offset_days, due_offset_days, priority, workspace, project は維持します。

- weekly + weekdays: [1, 3, 5] は月・水・金の毎週。ISOの曜日番号を使用（1=月曜、7=日曜）。複数指定が可能で、リストの重複と範囲外は拒否されます。
- monthly + month_week: 2 + month_weekday: 2 は毎月第2火曜日。month_week は 1〜5 または last、month_weekday は1〜7。lastはその月の最後の指定曜日。第5曜日がない月は生成しません。
- interval: 2 の週次は Anchor が属する月曜始まりの週を起点とした隔週。月次は Anchor が属する月を起点とした隔月。Anchor以前は生成しません。
- 旧定義で weekdays / month_week / month_weekday が未指定なら、従来どおり週次はAnchor曜日、月次はAnchor日付（存在しない月はスキップ）です。
- weekly 以外で weekdays を設定した場合、monthly 以外で month_week を設定した場合、month_week と month_weekday の片方だけを設定した場合は拒否します。

## 編集UI

Task HUB の Recurring セクションに、各定義の個別カードを表示します。新しく作成したRecurring Definitionノート内にも同じフォームが表示されます。既存ノートもTask HUBから編集可能です。

有効/無効、繰り返し単位、間隔、Anchor日、先読み日数を変更できます。週次は月〜日のトグルボタン（複数選択）。月次は「Anchor日と同じ日付」と「第n週の曜日」を切り替え、1〜5または最終の週番号と曜日を選択できます。

設定のプレビューは先400日を上限に次回最大3件を表示するだけで、Taskの生成やlookahead_daysの書換えを行いません。変更は「設定を保存」時のみ Obsidian 標準の processFrontMatter で保存します。保存直前に元の繰り返し設定が別画面で変更されていれば拒否し、上書きしません。UIDやWorkspace/Project等の無関係なプロパティは変更しません。

## 互換性・運用境界

従来の Recurring generator をそのまま使用し、ファイル名 02-Task/YYYY/MM/YYYYMMDD-R-<uid>.md と既存ファイル非上書きの方針を維持します。条件変更により以前の生成予定日がなくなっても、既生成タスクを勝手に削除しません。

Desktop/モバイルとも編集UIは DataviewJS + Vault API を利用し、非対応の tp.user User Functions を要求しません。ただし「Create recurring」自体の既存Templater起動経路はこの変更で置き換えません。

CSSは既存 Tokyo Night のトークンとダーク/ライトのテーマ変数を使用し、スマートフォン表示・タッチ操作・キーボードのfocus-visibleに対応します。選択状態は aria-pressed で示します。

Nodeテストでは従来動作、複数曜日、隔週、第二火曜日、最終金曜日、第5曜日の欠損、異常値、UI編集保存・競合保護、共通CSS配布の整合性を確認します。実際のObsidianアプリ画面での受入と本番Vaultへの反映は別途実施します。
