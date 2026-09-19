# Finance / Subscription vertical slice

Refs #142 / #129 / #103.

This slice separates the stable Finance/Subscription display entrypoints from
their internal Dataview implementations without changing persisted finance data,
Subscription commands, storage roots, or Dashboard/Daily/Monthly composition.

## Stable public display entrypoints

The following existing basename interfaces remain at their current paths:

- `98-System/02-embed/04-viz/budget-visualiser.md`
- `98-System/02-embed/04-viz/daily-budget.md`
- `98-System/02-embed/04-viz/per-day-budget.md`
- `98-System/02-embed/04-viz/categorized-expense-visualiser.md`
- `98-System/02-embed/04-viz/categorized-income-visualiser.md`
- `98-System/02-embed/03-table/subscription-table.md`

They are now thin `dv.view` compatibility wrappers and are explicitly recorded
as basename interfaces in `system-interfaces.json`.

Dashboard, Daily Note and Monthly Note continue to use the same short basenames.
No caller migration is required for this slice.

## Internal presentation

Rendering is owned by:

- `98-System/04-view/finance/budget_visualiser.js`
- `98-System/04-view/finance/daily_budget.js`
- `98-System/04-view/finance/per_day_budget.js`
- `98-System/04-view/finance/categorized_expense_visualiser.js`
- `98-System/04-view/finance/categorized_income_visualiser.js`
- `98-System/04-view/finance/subscription_table.js`

Budget, Daily Budget and Per-day Budget share their equivalent value/category
presentation helpers through:

- `98-System/05-lib/finance/finance_view_utils.js`

That Finance-local helper delegates generic date normalization to
`98-System/05-lib/shared/view_utils.js`. Categorized expense/income rendering
remains separate. Canonical Subscription creation/synchronization validation is
now owned by `98-System/05-lib/finance/subscription_runtime_utils.js`.

The Subscription table's pure display semantics live in:

- `98-System/05-lib/finance/subscription_view_utils.js`

It preserves the existing source, filter and display contract:

- source: `96-Global/00-subscription`;
- only `type: subscription`;
- enabled subscriptions sort before disabled subscriptions;
- names sort ascending inside the same enabled state;
- cycle labels remain monthly / yearly / interval compatible;
- table columns remain サブスク / 状態 / 金額 / 周期 / 開始 / カテゴリ.

## Persisted Finance data

No record schema or storage root changes are part of this slice.

Finance views continue to read inline fields such as:

- `date`
- `expense`
- `income`
- `cat`
- `memo`
- `subscription_key`

Monthly data remains under `01-MonthlyNote`. The existing budget constants,
initial balance, navigation behavior, CSS class names, category aggregation and
Daily/Monthly target resolution are preserved.

## Stable Subscription actions

The following stay at their existing public paths and are not reimplemented by
the Finance views:

- `98-System/00-command/sync_subscriptions.md`
- `98-System/00-command/create_subscription.md`
- `98-System/02-embed/01-button/dashboard-subscription-buttons.md`
- `98-System/02-embed/00-meta/subscription-meta.md`

The `sync-subscriptions` and `create-subscription` button IDs and command
targets remain unchanged.

`sync_subscriptions.md` and `create_subscription.md` are thin Templater
entrypoints. Their canonical user functions are:

- `98-System/01-script/sync_subscriptions.js`
- `98-System/01-script/create_subscription.js`

Both share the pure runtime/schema contract in:

- `98-System/05-lib/finance/subscription_runtime_utils.js`

The canonical registry remains `96-Global/00-subscription`.

## Remaining legacy Subscription debt

`98-System/01-script/sync_subscription.js` (singular) remains a legacy,
unregistered implementation that references the older
`98-System/05-data/subscriptions.md` registry path.

Repository and organization-wide callsite search found no caller, but private
Vault/plugin caller inspection is still required before deletion. The canonical
plural implementation does not depend on this legacy file.

## Preserved composition

- Dashboard Work & Finance remains Work summary -> Budget -> Subscription actions
  -> Subscription table.
- Daily Note continues to embed `[[daily-budget]]`.
- Monthly Note continues to embed the budget summary, per-day expense view,
  categorized expense view and categorized income view.
- Existing Finance CSS classes remain unchanged.

## Phase 2 shared cleanup

Issue #144 performs the intentionally separate shared-utility cleanup after the
public-entrypoint move. It preserves this slice's external interfaces while
deduplicating only equivalent pure helpers.
