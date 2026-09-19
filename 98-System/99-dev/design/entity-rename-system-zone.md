# Entity rename System Zone

Refs #170.

## Goal

Project / Workspace names are mutable user-facing labels. Their stable identity is
the Entry `uid`, not the folder or file name.

Rename is therefore implemented as a controlled structural mutation from the
Entry's System Zone rather than by manually editing paths in the file explorer.

## Canonical paths

```text
Project:
10-Project/<name>/<name>.md

Workspace:
03-Workspace/<name>/<name>.md
```

Only Entries already matching these canonical layouts are renameable. A
noncanonical Entry fails closed.

## System Zone

The final section of Project and Workspace Entry composition is a collapsed
warning callout named System Zone.

- Project: `Rename Project`
- Workspace: `Rename Workspace`

Both buttons call:

```text
98-System/00-command/rename_entity.md
  -> tp.user.rename_entity(tp)
  -> 98-System/01-script/rename_entity.js
```

## Identity and metadata

Rename preserves:

- `uid`;
- lifecycle/status/priority and all unrelated metadata;
- child Project Note / Workspace Note filenames.

Rename changes:

- parent Entity folder name;
- Entry filename;
- Entry `title`.

The previous title/name is appended to `aliases` when not already present.

## Relation updates

The runtime inventories relation callers before mutation.

Project rename rewrites matching `project` fields.

Workspace rename rewrites matching `workspace` fields.

This covers Task, Project Note, Workspace Note, Project, Recurring Task and other
current/future note types using the canonical relation field names without
hard-coding their type list.

References are matched only as:

- the exact canonical old Entry path; or
- the exact old basename.

No fuzzy substring matching is permitted.

After the Entity reaches its final path, every inventoried relation is rewritten
with `FileManager.generateMarkdownLink`.

## Ordinary body links

The repository-managed Obsidian configuration has
`.obsidian/app.json -> alwaysUpdateLinks: true`.

The rename uses the Vault rename API so normal internal links follow Obsidian's
rename events. System-owned relation fields are still rewritten explicitly
rather than relying solely on automatic link maintenance.

## Transaction

Preflight rejects:

- unsupported Entry type;
- noncanonical path;
- missing `uid`;
- invalid or unchanged name;
- case-only rename;
- destination folder/file collision.

After explicit confirmation:

1. rename Entry file inside the old folder;
2. rename the Entity folder;
3. set new `title` and append old names to `aliases`;
4. regenerate every inventoried relation field;
5. reopen the final Entry.

If any step fails, rollback restores:

- Entity metadata;
- relation field values;
- Entry filename;
- parent folder path.

Rollback errors are surfaced explicitly instead of reporting a false success.

## Cross-device note

Case-only rename is intentionally rejected. Case sensitivity differs across
filesystems and synchronized clients, so a two-step case-only rename would need
a separately reviewed temporary-path protocol.
