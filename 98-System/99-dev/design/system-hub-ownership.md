# System-owned Hub UI

Refs #160 / #158 / #103.

## Ownership rule

User data stays in its domain roots:

- `02-Task`;
- `03-Workspace`;
- `05-Idea`;
- `10-Project`;
- `11-Knowledge`;
- `04-AI` for private human-facing AI projections.

System-owned UI composition lives under:

```text
98-System/02-embed/hub/
```

This keeps Hub implementation inside the ObsidianCore publication, validation and
promotion boundary. `Dashboard.md` remains the intentional root-level stable exception.

## Canonical Hubs

### Task HUB

`98-System/02-embed/hub/task-hub.md` owns Inbox, Backlog, future planning,
Weekly Review, Recurring Tasks, and recurring create/generate actions.

All child embeds use exact `98-System` paths so legacy data-directory files cannot
change resolution.

### Project HUB

`98-System/02-embed/hub/project-hub.md` owns Workspace overview, operational
Projects across active Workspaces, completed/archived Projects, and Create Workspace.

Operational Projects are `planning | running | stopped`. Global Project creation
remains on Workspace Entry because creation requires Workspace context.

### Idea HUB

`98-System/02-embed/hub/idea-hub.md` owns the global Idea inventory. Idea
files live centrally under `05-Idea` and carry a required Workspace relation
plus an optional Project relation, so visibility is global while context remains
explicit.

### Knowledge HUB

`98-System/02-embed/hub/knowledge-hub.md` owns Create Knowledge, the canonical
Knowledge inventory, and Recent Knowledge. The inventory requires
`type: knowledge-note` and omits archived/deleted entries.

### AI HUB

`98-System/02-embed/hub/ai-hub.md` owns the Human-facing view of
private `04-AI/**` pipeline projections. `04-AI` contains data only; it does not
own a Hub page or reusable UI implementation.

The Hub separates deterministic `Validation rejected` from operational
`Failed`. Rejection is a normal possible validation result, not evidence of a
failed pipeline or `CRITICAL` scheduler health. The Rejected table offers
an explicit `Acknowledge` action for verified
`04-AI/30-Validation/<ai_case_id>.md` notes. It changes only
`acknowledge_request: acknowledge` in that single projection's frontmatter,
including historical notes lacking that field. The client shows the request
as pending until Automation Intake and Sync-only cleanup have finished.

The action does not retry inference, authorize Knowledge writes, modify
canonical generation state, create a private acknowledgement by itself,
or delete a projection. Automation owns exact-source verification, the
immutable acknowledgement record and narrow `04-AI` cleanup; absent
a verified backend outcome the request must never be presented as completed.
`blocked` and `retry_exhausted` are deliberately ineligible for this action.
The Hub remains non-authoritative for systemd and private scheduler health.
See ObsidianAutomation #287 and ObsidianCore #205.

## AI projection root

`04-AI/**` is the sole Human-facing AI projection root. It is data-only and
does not own Hub UI. The temporary `03-AI/**` read fallback was retired after
the production migration, Approve backfill, Completed projection publication,
and terminal cleanup were accepted.

## Stable navigation IDs

Existing IDs remain stable:

```text
open-task-backlog
open-project-hub
open-idea-hub
open-knowledge-hub
open-ai-hub
```

Only the Task label changed from Task Backlog to Task HUB. These IDs target the
canonical `98-System/02-embed/hub/*` pages.

## Phase B Live Vault audit

After #161 promotion, Live Vault snapshot
`dffbc1a8fd196f5b95c7b28e7e594fa25ea656b6` captured the canonical Hub rollout.
A subsequent snapshot was a no-op, proving the mirror was stable.

The user completed real-Vault smoke tests for Dashboard plus Task / Project /
Knowledge Hubs.

Caller audit found no runtime caller outside Core tests/design for:

```text
02-Task/backlog
10-Project/hub
11-Knowledge/hub
02-Memo/hub
```

Legacy file inspection found:

- `02-Task/backlog.md`: system-only thin wrapper around the canonical Backlog embed;
- `10-Project/hub.md`: stale inline Dataview using pre-v2 emoji Project statuses;
- `11-Knowledge/hub.md`: stale queries using pre-v2 Knowledge statuses and an
  obsolete `maturity = outdated` convention;
- `02-Memo/hub.md`: absent.

Therefore the first three files are retirement-ready and the fourth requires only
selector cleanup.

## Retirement completion

The reviewed one-time migration was promoted and executed in the Live Vault.
The operator confirmed all three retirement targets are absent:

```text
02-Task/backlog.md
10-Project/hub.md
11-Knowledge/hub.md
```

Because the migration has completed its single-use responsibility, its command,
script and dedicated test are removed from the runtime tree. No compatibility
wrapper remains for the retired data-directory Hub paths.

## Mobile Home selectors

The old selectors for:

```text
11-Knowledge/hub
02-Memo/hub
10-Project/hub
```

are retired. Mobile Home styling now targets only:

```text
98-System/02-embed/hub/task-hub
98-System/02-embed/hub/project-hub
98-System/02-embed/hub/knowledge-hub
98-System/02-embed/hub/ai-hub
```

## Change policy

- Data roots own data, not system UI.
- Reusable Hub composition belongs under `98-System/02-embed/hub`.
- Hub paths are exact public interfaces.
- Hub children should use exact system-owned paths.
- Reusable view/table implementations stay in their feature directories.
- Data-root system UI retirement requires a Live Vault caller/content audit.
