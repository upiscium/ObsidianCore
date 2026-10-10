# SubscriptionのJPY / USD通貨対応

Refs #207。ObsidianCoreのSubscription Registry、Templater Add/Sync、Meta Bind、Dataview Tableに適用する。

## データ契約

- currency: JPY または USD。通貨フィールドを持たない既存ノートはJPYとして扱う。明示的な空値・不明な通貨は拒否。
- amount: 請求通貨での元金額。USDは小数第2位まで。
- billing_day: 1〜31。既存ノートで省略された場合は1日。対象月の最終日を超える場合は月末に繰り下げて確定（例: 31日指定なら2月は28/29日）。
- exchange_rate_mode: `manual | auto`。未指定の既存USDノートはmanualとして扱う。新規USDは登録画面から自動取得を選択可能。
- exchange_rate_jpy_per_usd: 1 USD当たりの円額。**manual**のUSD時のみ正の数値として必須。**auto**のUSD時は起動時の計上直前に日次参照レートを取得し、レジストリ内の手動レートには依存しない。JPY時は未使用。

USDレジストリ例（YAML frontmatter）:

    type: subscription
    subscription_id: "sub_example"
    name: "Example USD Service"
    enabled: true
    amount: 19.99
    currency: USD
    billing_day: 12
    exchange_rate_mode: auto
    exchange_rate_jpy_per_usd:
    category: "サブスク"
    cycle: monthly
    start: "2026-10"

## 月次記録

同期時には、JPYは従来の金額をexpenseに使用する。USDは手動概算または起動時に取得した日次参照レートでJPY換算・円単位に四捨五入し、expenseにはJPYの数値だけを記録する。元USD額、通貨、レート、概算の種別は同じ行に保持する。例えば:

    - [date:: 2026-10-01] [expense:: 3102] [cat:: サブスク] [memo:: Example USD Service] [subscription_key:: sub_example@2026-10] [original_amount:: 19.99] [original_currency:: USD] [exchange_rate_jpy_per_usd:: 155.2] [exchange_rate_basis:: manual_estimate]

これにより既存Finance集計のexpenseは円のままで、ドル額を二重加算しない。

## 再同期と安全性

- 旧JPYノートに通貨追加を強制しない。保存先・既存コマンドパス・ボタンID・monthly/yearly/interval支払周期を維持。
- 有効な手動USDノートに為替レートが未設定・不正なら月次ノートを一切変更せずFail-closed。自動USDはAPI通信不可、通貨ペア不一致、非数値/ゼロ/未来日付/7日超の古いレートで全件Fail-closed。
- 同じsubscription_id@年月キーの既存明細は再同期で上書きしない。レートを後から変更しても過去月は再計算しない。
- 換算は予算用の概算。カード会社の実請求円額、海外事務手数料、月ごとの実勢レートとは一致を保証しない。実際の請求額はMonthly Note側の円額を確認して修正する。
- 自動FXの出典: [Frankfurter v2](https://frankfurter.dev/) の固定USD/JPYペア。`Obsidian requestUrl`から、登録済みの自動モードかつ未計上のUSDが少なくとも1件ある場合だけ取得する。日次参照レートは実際のカード請求額と異なる。明細に `exchange_rate_source:: frankfurter-v2` / `exchange_rate_date:: YYYY-MM-DD` / `exchange_rate_basis:: frankfurter_daily_reference` を追記する。FX未取得・期限切れ時に手動レートへ暗黙フォールバックしない。
- Subscription Tableは従来の六列を維持し、USD額と概算円換算を併記。
- Repo MergeとLive Vault反映/Obsidian Meta Bindの手動操作確認は別ゲート。ObsidianAutomationのWriter・Nextcloud・既存Vaultは変更しない。

## テスト

旧JPY互換、USD検証、JPY換算・四捨五入、JPY+USD混在の家計簿記録、USD元額の保持、二重同期、欠落レートの非変更、作成・表示・コマンド互換をNodeで検証する。

## 課金日と自動適用 (#212)

- 月次・年次・Nか月ごとの対象月は従来と同じ。課金日 `billing_day` は対象月の日付を表す（31日を持たない月は月末）。
- 自動実行 `sync_subscriptions(tp, null, { automatic: true, silent: true })` は Asia/Tokyo で現在月を確定し、**今日までに到来した**未計上の項目のみ追記。課金日前には記録しない。
- アプリが課金日に起動しなかった場合、その月の後日の初回Startupで当該月の未計上分を記録する。**Obsidianが閉じている間に実行されるバックグラウンドジョブではない**。月を跨いだ自動バックフィルは行わない。
- レートは当該月の最初の計上時に確定し、`subscription_key` の既存行がある場合はレートを再取得せずに維持する。部分更新・後続実行による再換算をしない。
- 現行手動 Sync ボタンは従来どおり明示対象月の全予定分を処理できる。将来分の先行計上を望まない場合は起動時の自動処理を使用する。
- 重要: デスクトップとモバイルの Vault 並行編集を、ローカル `vault.process` だけでは全端末の分散ロックにできない。詳細は #213。自動登録は**一つの端末プロフィールのみ**が持つこと。
- StarterのCIはFXレスポンスをmockする。Obsidian画面上のHTTP接続とVaultの実書込の受入は別ゲート。
