# Project / Workspace vertical slice

Refs #138 / #129 / #103.

This slice organizes Project and Workspace presentation without changing their
metadata, storage roots, command APIs, or existing note/embed entrypoints.

## Stable public composition entrypoints

These existing basename surfaces remain in place:

- `98-System/02-embed/02-entry/project-entry.md`
- `98-System/02-embed/02-entry/workspace-entry.md`
- Project / Workspace table embeds under `02-embed/03-table/`
- `98-System/02-embed/05-task/entity-task-health.md`

The two Entry files are thin Meta Bind wrappers. Their composition bodies live
under:

```text
98-System/02-embed/projects/
  project-entry-content.md
  workspace-entry-content.md
```

The public basenames remain unique; the internal files intentionally use
`-content` names to avoid Obsidian basename ambiguity.

## Stable Dataview entrypoints

Existing callers continue to use:

```text
98-System/04-view/project_table.js
98-System/04-view/workspace_table.js
98-System/04-view/high_priority_project_table.js
98-System/04-view/note_table.js
98-System/04-view/entity_task_health.js
```

Each delegates exactly once to the organized implementation:

```text
98-System/04-view/projects/
  project_table.js
  workspace_table.js
  high_priority_project_table.js
  note_table.js
  entity_task_health.js
```

The old paths are explicit interfaces in `system-interfaces.json`.

## Project / Workspace view-model library

Presentation-specific relation and ordering helpers live in:

```text
98-System/05-lib/projects/entity_view_utils.js
```

It owns:

- Project to Workspace relation matching;
- Project active-Workspace eligibility;
- Project counts per Workspace;
- recent-modification ordering;
- Project status + modification ordering for High Priority Projects;
- Workspace lifecycle + modification ordering.

Canonical metadata and reference semantics remain in the existing stable APIs:

- `98-System/01-script/entity_meta_utils.js`
- `98-System/01-script/reference_utils.js`
- `98-System/01-script/note_meta_utils.js`

Those utilities are shared by commands, validators, Task views and other
consumers, so moving them is outside this structural slice.

## Preserved behavior

- Workspace lifecycle remains `active | inactive | archived`.
- Project status and priority semantics are unchanged.
- Normal Project surfaces remain hidden when their parent Workspace is not
  active.
- Workspace tables keep inactive Workspaces visible and count actual Project
  Entries.
- High Priority Projects still require high priority, list-visible Project
  status and an active parent Workspace.
- Project / Workspace Note tables retain Note v2 lifecycle/category semantics.
- Entity Task Health retains its Task and Project health calculations.
- Meta Bind composition remains Meta Bind composition; ordinary embeds are not
  substituted.

Knowledge metadata/promotion/table organization is deliberately deferred to the
next Phase 2 slice so Entity organization and Knowledge lifecycle changes do not
share one rollback surface.
