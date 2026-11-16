# ObsidianCore feature consolidation (2026-11-16)

Related issues: #242 (plugin-series epic), #243 (inventory and ADR), #244 (Doctor PoC).
Source baseline: public `main` at `b447e0cdedaf44333a2655eff312f4785edd1efa` (2026-11-03).
This review covers tracked public Core assets; it does **not** establish the
contents of private Vault notes, device-local QuickAdd/Meta Bind registrations,
or the running ObsidianAutomation service.

## Capability inventory and ownership

| Capability | Current entrypoint / authority | Decision | Reason |
| --- | --- | --- | --- |
| QuickTask capture | `quick_task.js` + QuickAdd `Task: Quick` | **Retire now** | User explicitly requested removal; canonical Task notes persist |
| Task creation | QuickAdd `Task: Create` and `Task: Backlog`, shared `task_creation_utils.js` | **Keep separate pending UX decision** | Create requires due date and creates an actionable Task; Backlog has no due requirement and sets a distinct backlog flag |
| Task views and lifecycle | Task metadata, Task HUB, Daily/Dashboard, `task_*` scripts | **Keep** | Inbox, attention, scheduling, completed, dependency and delete actions serve different states, not separate databases |
| Recurring Task | definition editor, generator, startup | **Keep separate** | Editing a definition is human-driven; generator is a deterministic writer with cross-device conflict risk |
| Workspace, Project, per-entity Notes | `create_workspace*`, `create_project_note`, Entry/HUB views | **Keep** | Entity lifecycle and contextual documentation are different operations |
| Idea, Knowledge, AI candidate review | `05-Idea`, `11-Knowledge`, review/keep/promote commands | **Keep distinct** | Incubation, accepted Knowledge and explicit human approval have different provenance rules |
| Work and Workplace registry | `add_work.js`, `manage_workplaces.js`, `05-lib/work/*` | **Keep** | Logging and configuring the set of workplaces are different actions; registry is user-owned |
| Income/expense, Subscription, FX | `add_income.js`, `add_expense.js`, `sync_subscriptions.js`, finance views | **Keep** | Transactions, repeating obligations, snapshots and summaries are different; Subscription writer has a single-writer rule |
| Dashboard and feature HUBs | `Dashboard.md`, `02-embed/dashboard/*`, `02-embed/hub/*` | **Keep** | Dashboard summarizes and navigates; HUBs provide detailed inventory and triage |
| Vault Doctor | `validate_vault.js`, safe-fix command, QuickAdd and Templater command | **Review duplicate UI entrypoints** | Some shortcuts invoke the same validator; deleting an entrypoint needs device configuration audit |
| AI operational status in AI HUB | `04-view/ai/*`, `hub/ai-hub.md` | **Candidate for Review-only consolidation** | Operational status belongs to ObsidianAutomation WebUI; already tracked by #220 and open Draft PR #221 |
| Daily/Monthly note creation and Startup | `create_periodic_note.js`, startup profiles | **Ownership audit first** | Must distinguish local note creation from server-side Daily v2 and avoid dual writers |
| Native plugin series | #242 / #243 / #244 | **Staged migration, not parallel runtime** | Markdown/frontmatter authority, mobile parity and rollback gates must be maintained |

A file count is not a feature count. Markdown embeds are often stable public
interfaces over shared sources. A Dashboard section not using an embed does not
establish the embed is dead: private notes and device-local registrations can
still call it.

## QuickTask retirement in this change

- Delete `98-System/01-script/quick_task.js`.
- Remove only the `Task: Quick` QuickAdd required choice and script from the
  registered public interface manifest.
- Keep `Task: Create`, `Task: Backlog`, and all existing Task metadata/data paths.
- Adjust the dependency test and add a retirement regression guard.
- Keep all existing user Task notes and their `source` / `status` / `due` values.
  No migration or rewrite is necessary.
- Do **not** automatically rewrite `.obsidian/hotkeys.json` or plugin-local
  QuickAdd configuration: UUIDs cannot be mapped confidently without the
  actual plugin choice list.

**Before deploying to each PC or mobile device:** remove the old `Task: Quick`
choice from QuickAdd settings; reassign its hotkey or Advanced URI if present.
Do this before distributing the source deletion to avoid a dangling QuickAdd
command. Task Backlog is *not* a semantic replacement for QuickTask.

## Human decision queue — do not silently switch

1. **Task Create and Backlog:** Would a single Task creation action with
   Actionable vs Backlog mode simplify daily use? A merged UI must preserve the
   no-due Backlog path, explicit due-date Actionable path, existing `triaged`
   and `backlog` fields and dependency choices. No auto-migration.
2. **Doctor shortcut:** Is the separate `System: Validate Vault` QuickAdd choice
   used, or can the Templater/Meta Bind action be the sole UI? Verify assigned
   hotkeys and mobile support before retiring either.
3. **AI HUB:** Complete and accept #220/#221 before consolidating Processing,
   Delivery, Completed and Failed operational views into server-side WebUI.
   Avoid editing the pending Draft PR in this QuickTask change.
4. **Periodic/Startup authority:** Inspect actual Desktop/Mobile Templater
   registration and the server-side Daily v2 schedule. #243 records that the
   Desktop Startup source comments out Periodic/Recurring while Mobile invokes
   them. A dual-write race would be worse than the current UI redundancy.

## Validation and safe rollout

Run on an isolated source checkout:

- `node --test 98-System/99-dev/test/*.test.mjs`
- `node 98-System/99-dev/validate-repo.mjs`
- `node 98-System/99-dev/tools/system-reference-audit.mjs --json`

The static audit can only show candidate tracked references. It cannot prove
absence of QuickTask callers in private notes, Obsidian plugin settings, phone
configurations or other repositories. Check these separately before deployment.

After a reviewed source merge and **separate** deployment approval, smoke-test
Desktop and Android: create a Task, create a Backlog Task, verify Daily source
links and Task HUB lists, and open a historical QuickTask-created note. Verify
that no disabled QuickAdd choice/shortcut remains. Do not touch production Vault,
Nextcloud/Gitea, recurring writer, other automation or native plugin cutover
as part of this source-only change.
