# ObsidianCore automation setup

Repository-managed automation requirements live in `automation-manifest.json`.

## Templater

- Template folder: `98-System/03-template`
- User scripts folder: `98-System/01-script`

### Startup templates

ObsidianCore requires two Templater Startup Templates. They are independent and
idempotent:

1. `98-System/03-template/99-startup/generate-recurring-tasks.md`
   - copies the repository-managed Core CSS files into the device-local Obsidian config directory and reconciles managed CSS activation;
   - generates due Recurring Task occurrences.
2. `98-System/03-template/99-startup/create_periodic_note.md`
   - creates today's Daily Note when it is missing;
   - creates the current Monthly Note when it is missing;
   - leaves already-existing Daily / Monthly Notes untouched.

For each fresh Vault / Templater installation, perform this one-time local registration:

1. Open Obsidian Settings -> Templater.
2. Enable `Enable startup templates`.
3. Add both required Startup Templates:
   - `98-System/03-template/99-startup/generate-recurring-tasks.md`
   - `98-System/03-template/99-startup/create_periodic_note.md`
4. Restart/reload Obsidian once and verify that Core CSS synchronization,
   Recurring Task generation, and Daily / Monthly Note creation show no error
   Notice.

Templater stores these registrations in plugin-local configuration under the
device's Obsidian config directory, which is intentionally not the repository
configuration source of truth. The repository instead tracks both Startup
Templates, their requirements in `automation-manifest.json`, and CI contracts
for the registration requirement.

The jobs remain independently fail-safe. CSS installation / Recurring Task
generation is isolated inside `generate-recurring-tasks.md`, while periodic
note creation runs in its own Startup Template. A failure in one Startup
Template must not require moving the other back into `00-command`.

### Core CSS distribution and shared config

The canonical Vault may intentionally synchronize parts of its Obsidian config directory between devices. ObsidianCore itself tracks shared settings such as app/appearance/plugin enablement, Daily Notes configuration, graph settings, hotkeys, types and CSS snippets. Therefore **do not disable config directory synchronization merely because the normal-Vault CSS fallback exists**. If your current Remotely Save setup intentionally shares `.obsidian`/the configured Obsidian config directory, keep it enabled.

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

The recurring generator is idempotent. Re-running it for an occurrence whose canonical Task already exists skips that occurrence. The Dashboard `Recurring Task生成` button remains available as a manual fallback and for long-running Obsidian sessions where Templater has not restarted since a new occurrence entered the lookahead window.

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
