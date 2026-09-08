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
- `System: Validate Vault` -> `validate_vault.js`

Use QuickAdd's package export/import for cross-device recreation. Do not commit plugin-local `data.json` as the canonical configuration.

Hotkeys in `.obsidian/hotkeys.json` reference generated QuickAdd Choice UUIDs, so they are local-instance identifiers rather than portable names. Reassign by Choice name after import when necessary.

## Recovery migrations

Recovery migration scripts are declared in `automation-manifest.json` under `recovery.migration_scripts`.

They are retained for legacy-vault import and recovery only. Normal Task/Workspace/Project runtime must not depend on them. The current recovery assets are:

- `migrate_tasks_v3.js`
- `migrate_entity_relations.js`
- `migrate_entity_metadata_v2.js`

If System Doctor reports legacy Task/Entity metadata, run the relevant migration deliberately and then rerun System Doctor. These scripts are repository recovery assets, not normal QuickAdd choices.

## One-time maintenance migration: Task dependency controls

Task dependency controls are rendered through the shared `98-System/02-embed/01-button/task-dependency-controls.md` embed. Existing Task notes created before that change can be migrated with:

- command: `98-System/00-command/migrate_task_dependency_controls.md`
- script: `98-System/01-script/migrate_task_dependency_controls.js`

Run the command through Templater after the updated System files are present in the Vault. The migration is idempotent and only replaces known legacy dependency `BUTTON[...]` rows in `type: task` / `task-pack` notes below `02-Task/`. Already-embedded notes, custom layouts, and non-Task notes are left untouched.

## Validation

Run from the Vault root:

```bash
node 98-System/99-dev/validate-repo.mjs
```

The GitHub Actions workflow runs the same validation on pull requests and pushes to `main`. It also rejects unresolved Git conflict markers, verifies required Startup Templates declared by the manifest, and verifies that every recovery migration declared by the manifest exists.

Runtime Vault data integrity remains covered by `Validate Vault` inside Obsidian.
