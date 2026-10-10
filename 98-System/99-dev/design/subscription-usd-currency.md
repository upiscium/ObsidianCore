# SubscriptionのJPY / USD通貨対応

Refs #207。ObsidianCoreのSubscription Registry、Templater Add/Sync、Meta Bind、Dataview Tableに適用する。

## データ契約

- currency: JPY または USD。通貨フィールドを持たない既存ノートはJPYとして扱う。明示的な空値・不明な通貨は拒否。
- amount: 請求通貨での元金額。USDは小数第2位まで。
- exchange_rate_jpy_per_usd: 1 USD当たりの円額。USD時は正の数値として必須。JPY時は未使用。

USDレジストリ例（YAML frontmatter）:

    type: subscription
    subscription_id: "sub_example"
    name: "Example USD Service"
    enabled: true
    amount: 19.99
    currency: USD
    exchange_rate_jpy_per_usd: 155.2
    category: "サブスク"
    cycle: monthly
    start: "2026-10"

## 月次記録

同期時には、JPYは従来の金額をexpenseに使用する。USDは登録済みの手動概算レートでJPY換算・円単位に四捨五入し、expenseにはJPYの数値だけを記録する。元USD額、通貨、レート、概算の種別は同じ行に保持する。例えば:

    - [date:: 2026-10-01] [expense:: 3102] [cat:: サブスク] [memo:: Example USD Service] [subscription_key:: sub_example@2026-10] [original_amount:: 19.99] [original_currency:: USD] [exchange_rate_jpy_per_usd:: 155.2] [exchange_rate_basis:: manual_estimate]

これにより既存Finance集計のexpenseは円のままで、ドル額を二重加算しない。

## 再同期と安全性

- 旧JPYノートに通貨追加を強制しない。保存先・既存コマンドパス・ボタンID・monthly/yearly/interval支払周期を維持。
- 有効なUSDノートに為替レートが未設定・不正なら月次ノートを一切変更せずFail-closed。
- 同じsubscription_id@年月キーの既存明細は再同期で上書きしない。レートを後から変更しても過去月は再計算しない。
- 換算は予算用の概算。カード会社の実請求円額、海外事務手数料、月ごとの実勢レートとは一致を保証しない。実際の請求額はMonthly Note側の円額を確認して修正する。
- 自動FX API・ネットワーク処理は追加しない。外部レートの提供元、基準日、取得エラー、過去月スナップショットの扱いは別Issueで決める。
- Subscription Tableは従来の六列を維持し、USD額と概算円換算を併記。
- Repo MergeとLive Vault反映/Obsidian Meta Bindの手動操作確認は別ゲート。ObsidianAutomationのWriter・Nextcloud・既存Vaultは変更しない。

## テスト

旧JPY互換、USD検証、JPY換算・四捨五入、JPY+USD混在の家計簿記録、USD元額の保持、二重同期、欠落レートの非変更、作成・表示・コマンド互換をNodeで検証する。
