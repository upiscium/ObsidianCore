# ObsidianCore automation setup

Repository-managed automation requirements live in `automation-manifest.json`.

## Templater

- Template folder: `98-System/03-template`
- User scripts folder: `98-System/01-script`

### Startup templates

Recurring Task generation is designed to run automatically when Templater starts.

Required Startup Template:

- `98-System/03-template/99-startup/generate-recurring-tasks.md`

For each fresh Vault / Templater installation, perform this one-time local registration:

1. Open Obsidian Settings -> Templater.
2. Enable `Enable startup templates`.
3. Add `98-System/03-template/99-startup/generate-recurring-tasks.md` to Startup Templates.
4. Restart/reload Obsidian once and verify that Recurring Task generation completes without an error Notice.

Templater stores this registration in plugin-local configuration under `.obsidian/plugins/`, which is intentionally not the repository configuration source of truth. The repository instead tracks the Startup Template, its requirement in `automation-manifest.json`, and CI contracts for the registration requirement.

The startup generator is idempotent. Re-running it for an occurrence whose canonical Task already exists skips that occurrence. The Dashboard `Recurring Task生成` button remains available as a manual fallback and for long-running Obsidian sessions where Templater has not restarted since a new occurrence entered the lookahead window.

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

## Work-time CSS

The repository-managed CSS snippet `.obsidian/snippets/work-time.css` styles Daily, Monthly, and Dashboard work-time summaries. It is enabled in `.obsidian/appearance.json` and uses the existing `work-time-*` view classes, so work aggregation logic remains independent from presentation.

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

The GitHub Actions workflow runs the same validation on pull requests and pushes to `main`. It rejects unresolved Git conflict markers, verifies required Startup Templates, verifies enabled CSS snippets, and verifies the currently registered one-time maintenance migration assets.

Runtime Vault data integrity remains covered by `Validate Vault` inside Obsidian.
