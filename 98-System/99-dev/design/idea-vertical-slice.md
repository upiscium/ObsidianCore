# Idea v1 vertical slice

Refs #194.

## Purpose

Idea is a first-class incubation object for thoughts that are worth retaining but
are not yet suitable as long-lived Knowledge.

It replaces the current practice of scattering ideas inside Workspace/Project
notes without reintroducing the retired generic Memo domain.

## Canonical storage

All Idea files live below:

```text
05-Idea/
```

Physical storage is intentionally independent from ownership context. Workspace
and Project relations provide context; folder placement does not.

## Canonical schema

```yaml
---
type: idea
title: "..."
created: YYYY-MM-DD
workspace: "[[03-Workspace/...]]"
project:
status: active
aliases: []
tags: []
---
```

Rules:

- `workspace` is required;
- `project` is optional;
- when Project is present, its owning Workspace must equal `workspace`;
- status is exactly `active | adopted | archived`;
- `created` is a valid date;
- aliases and tags are string arrays.

There is deliberately no unscoped Idea inbox. Creation cannot omit Workspace.

## Meaning

- Task = an action to perform.
- Idea = an uncommitted thought, hypothesis, design option or direction worth
  retaining.
- Project/Workspace Note = working documentation for an existing activity.
- Knowledge = reusable long-lived information that has passed the stronger
  Knowledge acceptance boundary.

Idea is not a replacement for Memo. The required context relation and narrow
status model are intended to prevent an unconstrained miscellaneous bucket.

## Visibility

System-owned UI lives under `98-System`.

- Idea HUB owns global visibility across `05-Idea`;
- Dashboard surfaces recent Active Ideas;
- Workspace Entry surfaces Active Ideas bound to that Workspace;
- Project Entry surfaces Active Ideas bound to that Project.

All views read the same centralized Idea files.

## Creation and context editing

Create Idea asks for an active Workspace and then optionally an active Project
owned by that Workspace. Context editing uses the same relation rule.

System Doctor independently verifies the persisted relation so UI selection is
not the only integrity boundary.

## Lifecycle

`active`
: still under consideration.

`adopted`
: accepted into ongoing work but retained as Idea history.

`archived`
: no longer active, retained for reference.

These states do not imply factual truth.

## Knowledge promotion

Idea reuses the existing explicit Human-triggered Knowledge promotion path.

Promotion:

- moves the file to `11-Knowledge`;
- changes type to `knowledge-note`;
- replaces the repository-managed Idea metadata embed with `knowledge-meta`;
- drops Idea-owned title/created/workspace/project/status fields;
- preserves aliases, tags, unknown user metadata and body;
- applies canonical Knowledge defaults.

AI pipeline disposition is intentionally outside this Core vertical slice. The
Core contract exists first so Automation can later offer `Keep as Idea`
without inventing a second Idea schema.
