# ObsidianCore automation setup

Repository-managed automation requirements live in `automation-manifest.json`.

## Templater

- Template folder: `98-System/03-template`
- User scripts folder: `98-System/01-script`

### Startup templates — PC / mobile profiles (one-time local registration)

The **template source files** live in the shared Vault, but the *registration
settings* must be isolated between desktop and mobile. Do not register
both startup profiles against the same active Templater configuration.

Obsidian officially supports separate configuration folders:
[Obsidian configuration folder](https://obsidian.md/help/configuration-folder).
Use **Settings → Files and Links → Override config folder** on the mobile
device, set `.obsidian-mobile`, then relaunch. The desktop keeps `.obsidian`.
If mobile already has a working plugin setup, copy its existing config into
the new profile before switching and verify enabled plugins. Do not blindly
overwrite either profile's private plugin settings.

After the config folders are separate, perform this **one-time local registration**
independently for each device:

1. Open Obsidian Settings → Templater → **Enable startup templates** on each
   device (newer Templater versions keep the enable switch device-locally).
2. Remove old registered startup entries
   `98-System/03-template/99-startup/generate-recurring-tasks.md` and
   `98-System/03-template/99-startup/create_periodic_note.md`.
   The files remain available as compatibility wrappers; do not register them
   alongside the new profile templates.
3. On the **PC only**, register exactly:
   `98-System/03-template/99-startup/startup-desktop.md`
   - Synchronize Core CSS and appearance.
   - Create missing Daily/Monthly Notes.
   - Generate due Recurring Tasks.
   - **Never** automatically post Subscription charges.
4. On the **phone only**, register exactly:
   `98-System/03-template/99-startup/startup-mobile.md`
   - Synchronize Core CSS and appearance.
   - Create missing Daily/Monthly Notes.
   - Generate due Recurring Task occurrences, using the same idempotent
     canonical generator as desktop.
   - **Automatically post only due, unposted current-month Subscriptions**.
5. Restart/reload Obsidian separately on both devices; confirm no error Notice.
   The templates are guarded by `tp.obsidian.Platform.isMobile`: a phone must
   not run desktop startup logic, and a PC must not run mobile startup logic.

**Single-writer policy:** By default, mobile is the only automatic Subscription
writer. This is important: `vault.process` prevents duplicates within one
local file, but it cannot provide a distributed lock across a synchronizing
desktop and phone. Never enable the Subscription auto-writer on both profiles
simultaneously. If you want to use desktop as the writer instead, first disable
the mobile Startup registration, then explicitly configure and review a
desktop-only Subscription trigger; do not just copy the mobile template to PC.

The Dashboard Sync button is the **manual fallback**. Startup is *not* a
background timer: the phone must open Obsidian during the due month for charges
to be posted. If not opened until a later month, previous-month charges need
explicit manual review/sync; there is no automatic historical backfill.

The legacy `create_periodic_note.md` wrapper now delegates to
`98-System/01-script/create_periodic_note.js`, preserving its public path.
The old `generate-recurring-tasks.md` wrapper is also retained.

**Important mobile limitation:** Templater officially does **not** support
`tp.user.*` User Functions on Obsidian Mobile. The desktop Startup continues
calling `tp.user`, while `startup-mobile.md` executes the four reviewed
Core CommonJS scripts through **fixed Vault file paths** and `new Function`
with injected Obsidian `app` / `window` / `Notice` dependencies. It uses
the Vault API only, without Node's filesystem, `require`, a remote code fetch,
or additional plugins. This applies to mobile Core CSS, Periodic Notes,
Recurring Tasks **and** automatic Subscription posting.

Both profiles reuse the same underlying implementation, but not the same
unsupported Templater loading mechanism. Live Android/iOS execution still needs
device-specific smoke acceptance. Other existing `00-command/*.md` wrappers
which directly invoke `tp.user` (including Dashboard manual Generate and
manual Subscription actions) are **not claimed to be mobile-compatible** by
this Startup fix; desktop/manual recovery remains available.

The startup workflows remain independently fail-safe. A CSS or Periodic Note
failure does not prevent either platform from attempting Recurring Task
generation. A Recurring Task error on mobile does not block its independent
Subscription posting. An FX lookup failure never posts a partial
Subscription batch. Live UI and network acceptance require a separately
authorized check; repository merge does not edit local plugin registration.

### Core CSS distribution and shared config

The canonical Vault may intentionally synchronize parts of its Obsidian config directory between devices. ObsidianCore tracks shared settings such as appearance and CSS, but **active startup registrations are device-specific**. Retain config directory synchronization if your setup needs it, while making sure PC and phone select different active config folders (`.obsidian` and `.obsidian-mobile`) so Templater's startup registration lists cannot overwrite each other. Config syncing is optional for style delivery because normal-Vault CSS copies remain available.

Plugin-local credentials, generated identifiers and device-specific workspace state still require separate care. The exact Remotely Save include/exclude policy remains a local deployment decision; repository tracking does not mean every plugin-local file should be synchronized.

The Tokyo Night-compatible base bundle has two byte-identical repository outputs:

- Live/config mirror: `.obsidian/snippets/obsidian-core.css`
- normal Vault-sync fallback: `98-System/90-config/styles/obsidian-core.css`

A small mobile layout override is also mirrored in both places:

- Live/config mirror: `.obsidian/snippets/obsidian-core-mobile.css`
- normal Vault-sync fallback: `98-System/90-config/styles/obsidian-core-mobile.css`

The normal Vault paths are a redundant delivery route, not a replacement for config directory synchronization. A client that already receives the config mirror can use it directly. A client that does not synchronize the config directory can still receive the same managed styles through ordinary Vault synchronization.

At startup, `98-System/01-script/sync_core_style.js` reads both normal-sync copies and writes the exact bytes to:

```text
<vault.configDir>/snippets/obsidian-core.css
<vault.configDir>/snippets/obsidian-core-mobile.css
```

The installer uses `app.vault.configDir` and the Vault Adapter API rather than hard-coding `.obsidian` or using desktop-only Node filesystem APIs. This keeps the same path logic usable on desktop and mobile. It creates only the local `snippets` directory when missing, validates both targets before writing, verifies written bytes, and leaves current files untouched when they already match. A different local file using either managed name without the expected ObsidianCore header is not overwritten.

The installer also reconciles only the managed `enabledCssSnippets` portion of `<vault.configDir>/appearance.json`. It removes the eight managed legacy snippet activations and inserts exactly `obsidian-core` followed by `obsidian-core-mobile`. Unrelated private/local snippets remain in their existing order, and unrelated appearance keys such as theme, font, accent, or plugin-specific values are preserved. Invalid JSON, non-string snippet entries, duplicate snippet names, a missing appearance file, or a concurrent appearance rewrite causes the startup repair to fail closed instead of overwriting uncertain state.

The persisted `appearance.json` repair is the cross-platform authority and uses only `Vault.configDir` plus the Vault Adapter. The optional private runtime CSS API is feature-detected only as a best-effort fast path so the current session can reflect the repaired activation without a reload; persistence never depends on that private API. If the runtime fast path is unavailable or does not converge, the startup template shows a Notice asking for an Obsidian reload. On the next load, the repaired `appearance.json` is already canonical.

The canonical managed activation is therefore self-healing on every startup:

1. keep unrelated private/local snippets;
2. disable managed legacy snippets: `callout-colors`, `expense-dashboard-lite`, `mobile-home-buttons`, `monthly-expanse`, `task-button`, `task-controls`, `task-status`, and `work-time`;
3. enable `obsidian-core` and then `obsidian-core-mobile` exactly once.

The base builder still verifies the byte-identical generated base outputs. The small mobile override has its own exact-mirror regression test and is intentionally kept separate until the next CSS consolidation. Client devices do not need Node.js or a CSS build step.

### Recurring Task behavior

The recurring generator runs on **both desktop and mobile startup** and is
idempotent within a synchronized local Vault. Re-running it for an occurrence
whose canonical Task already exists skips that occurrence, using its stable
`YYYYMMDD-R-<definition UID>.md` path. The Dashboard `Recurring Task生成` button is a **desktop manual fallback**
until its separate Templater `tp.user` command wrapper is made portable.
For long-running mobile sessions, reopening the mobile Startup profile
will run generation again; startup does not run as a background timer.

Cross-device note: PC and phone are independent Vault copies. An offline or
near-simultaneous creation of the same occurrence before Vault synchronization
may still create a synchronization conflict; a stable name plus a local
existence check is **not** a cross-device lock. Check for pending sync/conflict
notes before starting both devices after a long offline period. This Recurring
Task policy is independent of the **single-writer** Subscription posting rule.

## QuickAdd

Required choices:

- `Task: Create` -> `create_task.js`
- `Task: Quick` -> `quick_task.js`
- `Task: Backlog` -> `backlog_task.js`
- `Work: Add` -> `add_work.js`
- `System: Validate Vault` -> `validate_vault.js`

Use QuickAdd's package export/import for cross-device recreation. Do not commit plugin-local `data.json` as the canonical configuration.

Hotkeys in `.obsidian/hotkeys.json` reference generated QuickAdd Choice UUIDs, so they are local-instance identifiers rather than portable names. Reassign by Choice name after import when necessary.

### Work: Add via Advanced URI

`add_work.js` accepts both Templater and QuickAdd prompt providers. On mobile, register a QuickAdd Macro/Choice named `Work: Add` whose User Script is:

- `98-System/01-script/add_work.js`

Then generate the URI on that device instead of guessing the command ID:

1. Enable the Advanced URI community plugin.
2. Open Obsidian's command palette.
3. Run `Advanced URI: Copy URI for command`.
4. Select the QuickAdd command for `Work: Add`.
5. Use the copied `obsidian://adv-uri?...&commandid=...` URI in the Android home-screen shortcut / automation app as an Open URL action.

The QuickAdd command ID contains local Choice identity and should be treated as device-local configuration. Regenerate the Advanced URI if the QuickAdd Choice is recreated or its generated ID changes.

The same `add_work.js` remains callable from the existing Templater wrapper `98-System/00-command/add_work.md`, so the Meta Bind `Add work` button and the Advanced URI / QuickAdd path share the same write logic.

## Completed maintenance migrations

There are currently no registered one-time maintenance migrations.

Completed migrations are intentionally removed from the runtime tree after Live
Vault acceptance. Git history and regression contracts retain the implementation
history; normal clients do not carry obsolete migration commands/scripts.

Completed maintenance includes:

- legacy Task/entity/relation metadata recovery migrations;
- Task dependency control migration;
- Daily Note current-layout migration (mood + Work embeds);
- legacy data-directory Hub retirement;
- legacy Task metadata UI convergence to the canonical `task-note-meta` embed.

The retired legacy Task metadata embeds are:

```text
status-dropdown
priority-dropdown
task-status-dropdown
knowledge-maturity-dropdown
task-priority-dropdown
```

Canonical Task metadata UI is owned by:

```text
98-System/02-embed/00-meta/task-note-meta.md
```

The retired data-directory Hub UI files were:

```text
02-Task/backlog.md
10-Project/hub.md
11-Knowledge/hub.md
```

Canonical Hub UI ownership is under:

```text
98-System/02-embed/hub/
```

Device-local QuickAdd configuration still references `add_expense.js` and
`add_income.js`; those scripts remain runtime assets despite having no public
Core caller.

## Validation

Run from the Vault root:

```bash
node 98-System/99-dev/validate-repo.mjs
```

The GitHub Actions workflow runs the same validation on pull requests and pushes to `main`. It rejects unresolved Git conflict markers, verifies required Startup Templates, verifies enabled CSS snippets, verifies the generated Core CSS delivery outputs, and rejects stale public-interface or maintenance registrations. Mobile override mirror/layout contracts are covered by the Node test suite.

Runtime Vault data integrity remains covered by `Validate Vault` inside Obsidian.
