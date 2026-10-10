---
enabled: false
---
> [!info] サブスク設定
> | 項目 | 入力 |
> | --- | --- |
> | **有効** | `INPUT[toggle:enabled]` |
> | **表示名** | `INPUT[text(placeholder(サービス名)):name]` |
> | **金額** | `INPUT[number(placeholder(0)):amount]`（下記の請求通貨で入力） |
> | **請求通貨** | `INPUT[inlineSelect(option(JPY, 円 JPY), option(USD, 米ドル USD)):currency]` |
> | **円換算レート** | `INPUT[number(placeholder(例：150)):exchange_rate_jpy_per_usd]` 円/USD（USDの場合必須） |
> | **カテゴリ** | `INPUT[text(placeholder(サブスク)):category]` |
> | **支払い周期** | `INPUT[inlineSelect(option(monthly, 毎月), option(yearly, 年1回), option(interval, Nか月ごと)):cycle]` |
> | **課金開始月** | `INPUT[text(placeholder(YYYY-MM)):start]` |
> | **年払い月** | `INPUT[inlineSelect(option(null, 未設定), option(1, 1月), option(2, 2月), option(3, 3月), option(4, 4月), option(5, 5月), option(6, 6月), option(7, 7月), option(8, 8月), option(9, 9月), option(10, 10月), option(11, 11月), option(12, 12月)):payment_month]` |
> | **支払い間隔** | `INPUT[number(placeholder(例：3)):interval_months]` か月 |

> [!tip]- 周期別の入力ルール
> - **毎月**：年払い月・支払い間隔は未設定でOK
> - **年1回**：年払い月を設定
> - **Nか月ごと**：支払い間隔を1以上で設定
> - 支出日は、どの周期でも対象月の**1日**として記録
> - **旧サブスクでcurrency未指定ならJPY**として扱います
> - USDはドル額と円/ドルの**概算換算レート**を設定。Monthly Noteの`expense`は円換算で記録し、元のUSD額・レートも同じ行に保持します
> - レートを後から変更しても過去月の記録は再計算・上書きしません。実際のカード請求額とは異なる場合があります