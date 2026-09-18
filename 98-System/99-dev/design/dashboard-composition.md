# Dashboard composition

Refs #132 / #129 / #103.

`Dashboard.md` is the stable public root. Phase 2 moves Dashboard-only Markdown
composition below `98-System/02-embed/dashboard/` while keeping existing button,
view and basename embed contracts unchanged.

## Root

`Dashboard.md` contains only ordered `meta-bind-embed` references to:

1. `dashboard/today.md`
2. `dashboard/tasks.md`
3. `dashboard/work-finance.md`
4. `dashboard/high-priority-projects.md`
5. `dashboard/workspaces.md`
6. `dashboard/recent-knowledge.md`
7. `dashboard/system.md`

This preserves the reviewed IA while keeping the public root small.

## Nested Meta Bind composition

Dashboard fragments intentionally use nested `meta-bind-embed` blocks. This is
the same composition pattern already used by Project and Workspace Entry
templates, which embed `project-entry` / `workspace-entry` and those files in
turn embed their child tables and controls.

Ordinary Obsidian embeds are not substituted for Meta Bind embeds in this
refactor, so Meta Bind binding context and action semantics are not changed.

## Stable child interfaces

The following existing entrypoints remain in place:

- `dashboard-*-buttons.md`
- `work-buttons.md`
- `work-summary.md`
- Task/Project/Workspace/Knowledge/Finance basename embeds
- their command/action targets

Dashboard fragments compose these existing interfaces rather than copying their
implementation.

## Task compatibility

The former Dashboard-specific Focus/Planning body is now:

- `98-System/02-embed/dashboard/task-focus-planning.md`

The old exact path:

- `98-System/02-embed/05-task/dashboard-tasks.md`

remains as a thin Meta Bind wrapper and is registered as a compatibility
interface. Existing/private callers therefore continue to render Focus and
Planning without knowing the new internal path.

## Change policy

- Do not add business logic to `Dashboard.md`.
- Keep section-specific composition in `02-embed/dashboard/`.
- Keep reusable feature views/embeds in their feature boundaries.
- Do not move a basename/public child interface merely because Dashboard is its
  most visible caller.
- Any future removal of a compatibility wrapper requires a private-caller gate.
