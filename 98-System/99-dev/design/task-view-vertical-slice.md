# Task view/lib vertical slice

Refs #134 / #129 / #103.

This slice organizes Task rendering without changing Task data, command APIs, or
existing Dataview caller paths.

## Organized Dataview entrypoints

Rendering is owned by:

- `98-System/04-view/tasks/task_table.js`
- `98-System/04-view/tasks/weekly_review.js`
- `98-System/04-view/tasks/recurring_tasks.js`

Phase 2 temporarily retained the corresponding top-level `04-view/*.js`
wrappers. #149 migrated Core callers to these organized paths, and #147 found no
remaining public/private/plugin callers. #150 therefore retires the three
legacy exact-path wrappers and removes them from `system-interfaces.json`.

## Organized Task views

Internal rendering lives under:

```text
98-System/04-view/tasks/
  task_table.js
  weekly_review.js
  recurring_tasks.js
```

Existing note/embed callers do not need to know these paths.

## Task table view-model library

Task-table-only presentation logic lives in:

```text
98-System/05-lib/tasks/task_table_view_utils.js
```

It owns:

- Task title fallback used by the table
- date sort keys
- Project lookup and Project-priority sort contribution
- Primary membership
- Task table sort-key assembly

Canonical Task metadata, scheduling, sorting and reference semantics remain
provided by the existing `98-System/01-script/*_utils.js` APIs.

## Why the existing 01-script utilities remain in place

Those utilities are shared by Templater commands, dependency tools, Recurring
generation, Entity health, System validation and existing/private consumers.
Moving them as part of this view refactor would mix API migration with directory
organization and widen the rollback surface.

A later Phase 2 slice may migrate those utilities only after caller inventory and
a compatibility strategy are explicit.

## Preserved behavior

- Task modes and source folders are unchanged.
- Inbox triage and Backlog promotion still mutate the same fields.
- Primary still includes actionable high-priority Tasks even when Due is farther
  than two weeks away, while excluding overdue/today Tasks and future Start.
- Task priority remains ahead of Project priority in ordering.
- Weekly Review thresholds and Entity eligibility are unchanged.
- Recurring Definition toggles and schedule calculations are unchanged.
- No Task frontmatter field or lifecycle value changes.
