# System-owned Hub UI

Refs #160 / #158 / #103.

## Ownership rule

User data stays in its domain roots:

- `02-Task`;
- `03-Workspace`;
- `10-Project`;
- `11-Knowledge`.

System-owned UI composition does not live beside that data. Canonical management
pages live under:

```text
98-System/02-embed/hub/
```

This keeps Hub implementation inside the ObsidianCore publication, validation
and promotion boundary.

`Dashboard.md` remains the intentional root-level stable exception.

## Canonical Hubs

### Task HUB

`98-System/02-embed/hub/task-hub.md` contains Inbox, Backlog, future planning,
Weekly Review, Recurring Tasks, and recurring create/generate actions.

### Project HUB

`98-System/02-embed/hub/project-hub.md` contains Workspace overview,
operational Projects across active Workspaces, completed/archived Projects, and
Create Workspace. Operational Projects are `planning | running | stopped`.

### Knowledge HUB

`98-System/02-embed/hub/knowledge-hub.md` contains Create Knowledge, the full
canonical Knowledge inventory, and Recent Knowledge. The inventory requires
`type: knowledge-note` and omits archived/deleted entries.

## Stable navigation IDs

Existing button IDs are preserved:

```text
open-task-backlog
open-project-hub
open-knowledge-hub
```

Only labels/targets change where necessary. `open-task-backlog` now displays
`Task HUB`.

## Legacy Live Vault pages

The following legacy targets are no longer canonical Core navigation targets:

```text
02-Task/backlog
10-Project/hub
11-Knowledge/hub
```

They remain in Phase A until Live Vault content/caller audit is completed.

## Memo / Mobile Home exception

`02-Memo/hub` remains unresolved in Phase A. Legacy Mobile Home selectors for
`11-Knowledge/hub`, `02-Memo/hub`, and `10-Project/hub` remain temporarily.

## Change policy

- Data roots own data, not system UI.
- New reusable Hub composition belongs under `98-System/02-embed/hub`.
- Hub paths are exact public interfaces.
- Reusable view/table implementations stay in their feature directories.
- Do not delete legacy data-root UI files without a Live Vault caller/content audit.
