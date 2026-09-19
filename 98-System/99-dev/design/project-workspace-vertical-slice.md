# Project / Workspace vertical slice

Refs #138 / #129 / #103.

This slice organizes Project and Workspace presentation without changing their
metadata, storage roots, command APIs, or existing note/embed entrypoints.

## Stable public composition entrypoints

These existing basename surfaces remain in place:

- `98-System/02-embed/02-entry/project-entry.md`
- `98-System/02-embed/02-entry/workspace-entry.md`
- Project / Workspace table embeds under `02-embed/03-table/`
- `98-System/02-embed/03-table/project-github-status.md`

The two Entry files are thin Meta Bind wrappers. Their composition bodies live
under:

```text
98-System/02-embed/projects/
  project-entry-content.md
  workspace-entry-content.md
```

The public basenames remain unique; the internal files intentionally use
`-content` names to avoid Obsidian basename ambiguity.

## Organized Dataview entrypoints

Rendering is owned by:

```text
98-System/04-view/projects/
  project_table.js
  workspace_table.js
  high_priority_project_table.js
  note_table.js
  project_github_status.js
```

Phase 2 temporarily retained matching top-level `04-view/*.js` compatibility
wrappers. #149 migrated Core callers to the organized paths; #147 then confirmed
zero public/private/plugin callers for the old exact paths. #150 retires those
six wrappers and removes their interface-registry protection.

## Project / Workspace view-model library

Presentation-specific relation and ordering helpers live in:

```text
98-System/05-lib/projects/entity_view_utils.js
```

Generic `file.mtime` descending comparison is delegated to `98-System/05-lib/shared/view_utils.js`; Entity relation/lifecycle ordering remains feature-owned.

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
- Project and Workspace Entries intentionally omit Task Health. Their Task lists and Task HUB Attention own operational Task visibility instead.
- The GitHub Status surface remains conditional on `github_watch: true` plus a non-empty `github_repo`, validates managed sibling `Status.md`, and renders Open Issue plus PR / PR Status / Bound Issue tables. Missing `github_issues` remains backward-compatible while Automation rollout catches up.
- Meta Bind composition remains Meta Bind composition; ordinary embeds are not
  substituted.

Knowledge metadata/promotion/table organization is deliberately deferred to the
next Phase 2 slice so Entity organization and Knowledge lifecycle changes do not
share one rollback surface.


## Entry System Zone

Project and Workspace Entry composition ends with a collapsed System Zone.
`Rename Project` / `Rename Workspace` delegate to the shared transactional
Entity rename runtime documented in `entity-rename-system-zone.md`.

Entity `uid` remains stable across rename. Folder name, Entry filename, title,
aliases and canonical relation links are updated as one reviewed operation.


## Task Health retirement

#172 removes the former Project-only Task Health surface after the Workspace
surface had already been removed by #168. The dedicated
`entity-task-health.md`, organized Dataview implementation and
`entity_task_health_utils.js` helper are no longer runtime assets.

Task HUB Attention remains the compact cross-Project operational signal surface.
