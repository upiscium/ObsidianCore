# System runtime retirement

Refs #164 / #165 / #166.

## Completed cleanup

The Live Vault and public Core audits converged the runtime tree to current
interfaces only.

Removed dead runtime assets include:

```text
98-System/01-script/quick_create_task.js
98-System/02-embed/06-dropdown/knowledge-maturity-dropdown.md
98-System/02-embed/06-dropdown/task-priority-dropdown.md
98-System/02-embed/06-dropdown/status-dropdown.md
98-System/02-embed/06-dropdown/priority-dropdown.md
98-System/02-embed/06-dropdown/task-status-dropdown.md
```

The last three dropdowns were initially retained because 13 June 2026 Task notes
still referenced them. A fail-closed migration was deployed, the actual Live
Vault transition shape was inspected without exposing Task content, and the
operator confirmed successful convergence to the canonical
`98-System/02-embed/00-meta/task-note-meta.md` UI.

The Daily Note current-layout migration also completed and is retired.

All completed one-time migration command/script/dedicated-test assets are removed,
and `automation-manifest.json` has no active maintenance migration registry.

## Retained device-local callers

The Live Vault audit found active QuickAdd configuration references to:

```text
98-System/01-script/add_expense.js
98-System/01-script/add_income.js
```

These remain runtime assets. Public static caller count alone is not sufficient
evidence to delete device-local entrypoints.

## Intentionally retained interfaces

The cleanup does not remove:

- `updated-workspace-table.md`, which has a Monthly Note caller;
- public basename interfaces such as `high-priority-project-table.md`;
- legacy-named CSS source snippets consumed by the deterministic style builder;
- organized Dataview implementations and retirement regression contracts.

## Retirement rule

A System runtime asset can be retired only after:

1. public caller/manifest/interface audit;
2. Live Vault/private-device caller audit where applicable;
3. data migration and no-residual-caller acceptance where required;
4. regression coverage for the final absence/presence boundary.
