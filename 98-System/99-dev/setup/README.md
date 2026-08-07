# ObsidianCore automation setup

This directory describes the reproducible parts of the ObsidianCore automation layer without committing plugin-local state or secrets.

## Required plugins

The canonical plugin list is `.obsidian/community-plugins.json`. At minimum, the Task workflow requires:

- Templater (`templater-obsidian`)
- QuickAdd (`quickadd`)

## Templater

Configure Templater with:

- Template folder: `98-System/03-template`
- User scripts folder: `98-System/01-script`

The repository intentionally does not track `.obsidian/plugins/templater-obsidian/data.json` because plugin-local settings may contain machine-specific state.

## QuickAdd

Required user-facing choices are declared in `automation-manifest.json`:

- `Task: Create` -> `98-System/01-script/create_task.js`
- `Task: Quick` -> `98-System/01-script/quick_task.js`
- `System: Validate Vault` -> `98-System/01-script/validate_vault.js`

Use QuickAdd's official package exporter/importer to move these choices between vaults/devices:

1. On the canonical vault, open Settings -> QuickAdd.
2. Export only the required choices above as a `.quickadd.json` package.
3. Review the package before committing it; do not include secrets or unrelated choices.
4. On a fresh clone/device, install QuickAdd and import that package.
5. Reassign hotkeys by choice name after import. QuickAdd hotkey command IDs contain generated choice UUIDs and are therefore not a stable cross-vault interface.

Do **not** commit `.obsidian/plugins/quickadd/data.json` as the reproducibility mechanism. It is plugin-local state and can include unrelated configuration.

## Migration commands

`migrate_tasks_v3.js` and `migrate_entity_relations.js` are retained as recovery/history tools. They are not part of normal operation after Task v3 migration. Remove migration choices from the normal QuickAdd menu after a vault has passed System Doctor.

## Validation

Run the repository validator locally from the Vault root:

```bash
node 98-System/99-dev/validate-repo.mjs
```

This checks repository-level invariants that can be validated without launching Obsidian. Runtime/data integrity remains the responsibility of `System: Validate Vault` inside Obsidian.
