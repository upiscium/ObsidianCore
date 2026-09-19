# Public Dataview caller migration

Refs #148 / #147 / #103.

Phase 2 retained nine exact-path Dataview wrappers because private callers could
not be inspected. The private Live Vault audit later found no extensionless
references outside `98-System`, but Core's own public embeds were still calling
the wrappers.

This migration switches only Core-managed runtime callers under
`98-System/02-embed/**` to the organized feature implementations.

## Old -> organized

```text
04-view/entity_task_health          -> 04-view/projects/entity_task_health
04-view/high_priority_project_table -> 04-view/projects/high_priority_project_table
04-view/note_table                  -> 04-view/projects/note_table
04-view/project_github_status       -> 04-view/projects/project_github_status
04-view/project_table               -> 04-view/projects/project_table
04-view/workspace_table             -> 04-view/projects/workspace_table

04-view/task_table                  -> 04-view/tasks/task_table
04-view/weekly_review               -> 04-view/tasks/weekly_review
04-view/recurring_tasks             -> 04-view/tasks/recurring_tasks
```

## Compatibility retirement

#149 intentionally kept the old wrappers while Core runtime callers migrated.
The subsequent #147 audit checked extensionless and explicit-extension paths in
the Live Vault/plugin configuration and searched the upiscium GitHub
repositories. No external runtime caller remained.

#150 therefore retires the nine old Dataview wrappers and removes their exact
interface-registry entries. The public basename embeds remain unchanged and
continue to call the organized paths introduced here.

## Public interfaces preserved

The user-facing basename embeds themselves do not move. For example,
`[[weekly-review]]`, `[[workspace-table]]`, `[[entity-task-health]]` and
`[[high-priority-project-table]]` keep the same filenames and external
references. Only their internal `dv.view` target changes.

No metadata schema, storage root, task/entity semantics, command target,
Templater/QuickAdd function or promotion contract changes here.
