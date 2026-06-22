```dataview
TABLE WITHOUT ID
  link(
    file.path,
    default(name, file.name)
  ) AS "サブスク",
  choice(
    enabled,
    "🟢 有効",
    "⚪ 終了"
  ) AS "状態",
  amount AS "金額",
  choice(
    cycle = "monthly",
    "毎月",
    choice(
      cycle = "yearly",
      "年1回（" + payment_month + "月）",
      choice(
        cycle = "interval",
        interval_months + "か月ごと",
        cycle
      )
    )
  ) AS "周期",
  start AS "開始",
  category AS "カテゴリ"
FROM "96-Global/00-subscription"
WHERE type = "subscription"
SORT enabled DESC, name ASC
```
