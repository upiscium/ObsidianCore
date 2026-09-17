# ObsidianCore automation setup

Repository-managed automation requirements live in `automation-manifest.json`.

## Templater

- Template folder: `98-System/03-template`
- User scripts folder: `98-System/01-script`

### Startup template

The existing Startup Template performs two independent, idempotent startup jobs:

1. copy the repository-managed Core CSS files into the device-local Obsidian config directory;
2. generate due Recurring Task occurrences.

Required Startup Template:

- `98-System/03-template/99-startup/generate-recurring-tasks.md`

For each fresh Vault / Templater installation, perform this one-time local registration:

1. Open Obsidian Settings -> Templater.
2. Enable `Enable startup templates`.
3. Add `98-System/03-template/99-startup/generate-recurring-tasks.md` to Startup Templates.
4. Restart/reload Obsidian once and verify that neither the Core CSS synchronization nor Recurring Task generation shows an error Notice.

Templater stores this registration in plugin-local configuration under the device's Obsidian config directory, which is intentionally not the repository configuration source of truth. The repository instead tracks the Startup Template, its requirement in `automation-manifest.json`, and CI contracts for the registration requirement.

The two startup jobs use separate `try` blocks. A CSS installation failure must not suppress Recurring Task generation, and a Recurring Task failure must not prevent the CSS installer from running on the next startup.

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

The installer deliberately does **not** edit local `appearance.json`, plugin settings, workspace state, or unrelated snippets. The canonical repository appearance enables `obsidian-core` followed by `obsidian-core-mobile`. On a device where appearance/config is not synchronized, perform this one-time local action after the files first appear:

1. Open Settings -> Appearance -> CSS snippets.
2. Refresh the snippets list if necessary.
3. Enable `obsidian-core` and `obsidian-core-mobile` once on that device.
4. Disable the managed legacy snippets if they are still enabled: `callout-colors`, `expense-dashboard-lite`, `mobile-home-buttons`, `monthly-expanse`, `task-button`, `task-controls`, `task-status`, and `work-time`.

Unrelated private/local snippets may remain enabled. The base builder still verifies the byte-identical generated base outputs. The small mobile override has its own exact-mirror regression test and is intentionally kept separate until the next CSS consolidation. Client devices do not need Node.js or a CSS build step.

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

## One-time maintenance migration: current Daily Note layout

Existing Daily Notes can be brought to the current layout with:

- command: `98-System/00-command/migrate_daily_notes_current.md`
- script: `98-System/01-script/migrate_daily_notes_current.js`

The migration targets canonical `type: daily-review` notes below `00-DailyNote/` whose filenames are `YYYY-MM-DD`. It is idempotent and:

- adds `mood:` when missing
- adds the `# Work` section before `# Note` when missing
- repairs a partial `# Work` section by adding missing `[[work-buttons]]` / `[[daily-work]]` embeds
- preserves surrounding Daily Note content and LF / CRLF style
- skips non-Daily notes and already-current notes

Run the command once after the updated System files are present in the live Vault. After the live Vault has been verified, this one-time migration can be removed in a later cleanup.

Previously completed recovery and one-time migrations are intentionally not retained in the runtime tree.

## Validation

Run from the Vault root:

```bash
node 98-System/99-dev/validate-repo.mjs
```

The GitHub Actions workflow runs the same validation on pull requests and pushes to `main`. It rejects unresolved Git conflict markers, verifies required Startup Templates, verifies enabled CSS snippets, verifies the generated Core CSS delivery outputs, and verifies the currently registered one-time maintenance migration assets. Mobile override mirror/layout contracts are covered by the Node test suite.

Runtime Vault data integrity remains covered by `Validate Vault` inside Obsidian.
