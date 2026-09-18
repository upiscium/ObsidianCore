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

The first five views intentionally retain their existing local aggregation
helpers. Consolidating repeated amount/date/category helpers belongs to the
following shared-utility Phase 2 slice; doing it here would combine filesystem
organization with broader semantic refactoring.

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

`sync_subscriptions.md` remains the currently wired Dashboard command and keeps
using `96-Global/00-subscription` as its registry.

## Known Subscription debt kept separate

`create_subscription.md` is an explicitly registered known-empty public
entrypoint. This slice preserves that fact rather than making a behavior change
inside a structural refactor.

`98-System/01-script/sync_subscription.js` is a legacy, currently unregistered
implementation that references the older `98-System/05-data/subscriptions.md`
registry path. Repository callsite search does not establish that private/plugin
callers do not exist, so this slice neither deletes it nor promotes it to the
canonical implementation.

Repairing Subscription creation, reconciling the duplicate sync implementations,
or retiring the legacy script requires a separate behavior/caller review.

## Preserved composition

- Dashboard Work & Finance remains Work summary -> Budget -> Subscription actions
  -> Subscription table.
- Daily Note continues to embed `[[daily-budget]]`.
- Monthly Note continues to embed the budget summary, per-day expense view,
  categorized expense view and categorized income view.
- Existing Finance CSS classes remain unchanged.

## Next Phase 2 slice

After this slice is accepted, continue with the shared utility cleanup described
by #129. That later slice can evaluate whether repeated Finance amount/date/
category helpers should be consolidated without mixing that decision into the
public-entrypoint move.
