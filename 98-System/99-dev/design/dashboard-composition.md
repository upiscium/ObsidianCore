# Dashboard composition

Refs #158 / #132 / #129 / #103.

`Dashboard.md` is the stable public root. Dashboard-only Markdown composition
lives below `98-System/02-embed/dashboard/`, while reusable buttons, views and
basename embeds remain in their feature boundaries.

## Dashboard role

The Dashboard is a quick operational surface, not a complete index of every
available view.

Its information architecture is intentionally limited to:

```text
Today / Focus / Summary / Navigation
```

Detail-heavy planning, review and inventory views stay available through their
dedicated surfaces instead of being expanded on every Dashboard visit.

## Root

`Dashboard.md` contains only ordered `meta-bind-embed` references to:

1. `dashboard/today.md`
2. `dashboard/tasks.md`
3. `dashboard/work-finance.md`
4. `dashboard/workspaces.md`
5. `dashboard/recent-knowledge.md`
6. `dashboard/ai.md`
7. `dashboard/system.md`

The former Dashboard-only `dashboard/high-priority-projects.md` fragment is
retired.

## Today

Today keeps only frequent actions and immediate context:

- current date;
- Daily Note;
- Monthly Note;
- Add Work.

## Tasks

The Dashboard Task body keeps actionable Focus plus the triage Inbox:

- overdue;
- today;
- primary;
- inbox.

Inbox remains directly visible because it is an operational queue that benefits
from being processed in-place. Longer-horizon planning and review remain outside
the Dashboard.

The Task action buttons remain visible, including Task Backlog and recurring
Task create/generate operations.

The following detail views are intentionally not expanded on Dashboard:

- next-7-days;
- next-30-days;
- later;
- Task Attention;
- recurring-tasks.

Task Attention is integrated into Task HUB rather than Dashboard. The former
Weekly Review surface is retired because its periodic review workflow was not
used in practice.

## Work & Finance

The Dashboard keeps:

- `work-summary`;
- a Dashboard-only Finance summary with current-month income, current-month
  expense, monthly balance, and month-end balance;
- Subscription Sync / Add controls.

The detailed `budget-visualiser`, category breakdowns, per-day view and full
`subscription-table` remain outside Dashboard. Monthly Note continues to own
the detailed Finance surfaces.

## Projects and Workspaces

The standalone High Priority Project table/view remains available for existing or
private callers, but Dashboard no longer has a High Priority Projects section.

Workspace remains the compact Project overview:

- Create Workspace;
- Project HUB;
- Workspace table.

The Workspace table can therefore carry the lightweight Project state summary
without duplicating a second Project list on Dashboard.

## Knowledge

Dashboard keeps the Knowledge actions and Recent Knowledge table. Full Knowledge
navigation remains available through Knowledge HUB.

## AI

Dashboard exposes a compact AI pipeline summary and an AI HUB navigation action. Detailed stage inventories remain in the system-owned AI HUB and private `04-AI/**` projections.

## System

System remains the final collapsed callout so maintenance actions do not compete
with day-to-day information.

## Nested Meta Bind composition

Dashboard fragments intentionally use nested `meta-bind-embed` blocks. This is
the same composition pattern used by Project and Workspace Entry templates.

Ordinary Obsidian embeds are not substituted for Meta Bind embeds, so binding
context and action semantics remain unchanged.

## Stable child interfaces

Removing a view from Dashboard does not imply retiring the reusable interface.
The following stay available unless separately audited and retired:

- `dashboard-*-buttons.md`;
- `work-buttons.md`;
- Task/Project/Workspace/Knowledge/Finance basename embeds;
- their command/action targets.

## Change policy

- Do not add business logic to `Dashboard.md`.
- Prefer summaries and navigation over long inventories.
- Keep section-specific composition in `02-embed/dashboard/`.
- Keep reusable feature views/embeds in their feature boundaries.
- Do not delete a reusable/public child merely because Dashboard no longer uses it.
- Compatibility/public interface retirement still requires its own caller gate.
