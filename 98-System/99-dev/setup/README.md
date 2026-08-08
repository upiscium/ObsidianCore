# ObsidianCore automation setup

Repository-managed automation requirements live in `automation-manifest.json`.

## Templater

- Template folder: `98-System/03-template`
- User scripts folder: `98-System/01-script`

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

## Validation

Run from the Vault root:

```bash
node 98-System/99-dev/validate-repo.mjs
```

The GitHub Actions workflow runs the same validation on pull requests and pushes to `main`. It also rejects unresolved Git conflict markers and verifies that every recovery migration declared by the manifest exists.

Runtime Vault data integrity remains covered by `Validate Vault` inside Obsidian.
