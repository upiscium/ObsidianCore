# System dead asset cleanup

Refs #164.

## Audit result

Public Core and Live Vault caller audits classify these assets as dead:

```text
98-System/01-script/quick_create_task.js
98-System/02-embed/06-dropdown/knowledge-maturity-dropdown.md
98-System/02-embed/06-dropdown/task-priority-dropdown.md
```

They have no public caller, manifest registration, interface registration, or
private Live Vault caller and are removed in Phase A.

## Retained device-local finance scripts

The Live Vault audit found active QuickAdd configuration references to:

```text
98-System/01-script/add_expense.js
98-System/01-script/add_income.js
```

These remain runtime assets even though public Core has no static caller.

## Pending Task legacy UI

Thirteen June 2026 Task notes still reference one or more of:

```text
[[status-dropdown]]
[[priority-dropdown]]
[[task-status-dropdown]]
```

History shows these are known generated metadata callouts from the pre-v3 and
early-v3 Task UI. The temporary
`migrate_task_metadata_ui_current` migration only accepts the two exact known
historical callout bodies, preflights every matching Task, and aborts all writes
if any unknown form or residual legacy reference is found.

After migration acceptance and a second no-op run, the three legacy dropdown
files become retirement candidates.

## Daily Note migration

`migrate_daily_notes_current` remains registered until the Live Vault reports a
second no-op run. It is not removed merely because it has no ordinary caller.

## Non-candidates

These remain intentionally:

- `updated-workspace-table.md`: Monthly Note caller exists;
- public basename interfaces such as `high-priority-project-table.md`;
- legacy CSS source snippets consumed by the current deterministic style builder;
- organized Dataview implementations and their retirement regression tests.
