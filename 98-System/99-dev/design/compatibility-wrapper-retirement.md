# Compatibility wrapper retirement

Refs #150 / #147 / #149 / #103.

Phase 2 deliberately retained compatibility wrappers until public and private
callers could be audited. This retirement removes only wrappers that completed
that gate.

## Retired paths

```text
98-System/02-embed/05-task/dashboard-tasks.md

98-System/04-view/entity_task_health.js
98-System/04-view/high_priority_project_table.js
98-System/04-view/note_table.js
98-System/04-view/project_github_status.js
98-System/04-view/project_table.js
98-System/04-view/recurring_tasks.js
98-System/04-view/task_table.js
98-System/04-view/weekly_review.js
98-System/04-view/workspace_table.js
```

## Audit evidence

Before deletion:

- Core-managed runtime callers were migrated to organized paths by #149;
- Live Vault search for extensionless old paths returned zero callers outside
  `98-System/**`;
- Live Vault/plugin-config search for explicit `.js` / `.md` old paths
  returned zero callers outside `98-System/**`;
- upiscium GitHub repository search found no external runtime caller;
- organized replacements existed and passed the existing semantic/compile CI.

The audit classified all ten paths as `RETIRE_READY`.

## Remaining public API

Retirement does not remove user-facing basename interfaces. Existing notes keep
using the same embeds such as:

- `[[recurring-tasks]]`
- `[[workspace-table]]`
- `[[high-priority-project-table]]`
- `[[entity-task-health]]`
- `[[project-github-status]]`

Those public embeds now call organized feature views directly.

Commands, registered Templater/QuickAdd functions, templates, metadata schemas,
storage roots, and the Promotion/public-projection contract are unchanged.

## Organized implementations

```text
98-System/04-view/tasks/
  task_table.js
  recurring_tasks.js

98-System/04-view/projects/
  project_table.js
  workspace_table.js
  high_priority_project_table.js
  note_table.js
  entity_task_health.js
  project_github_status.js
```

## Regression boundary

CI asserts that:

- all retired files stay absent;
- retired exact paths stay absent from `system-interfaces.json`;
- public embeds continue to call organized paths;
- organized implementations still exist and compile;
- existing feature semantic contracts remain Green.


The organized Weekly Review implementation listed in the original #150
migration was later retired by #168. It is not a current compatibility surface;
Task HUB now uses the internal Task Attention view.
