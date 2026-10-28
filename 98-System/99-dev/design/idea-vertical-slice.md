# Idea contract (v1 vertical slice / v2 adoption metadata)

Refs #194, #232 (IDEA-V2-2026-10-28-r1 / DES-01).

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
adopted_project:
adopted_at:
aliases: []
tags: []
---
```

Rules:

- `workspace` is required and must resolve to exactly one Workspace note;
- `project` is optional;
- when Project is present, its owning Workspace must equal `workspace`;
- `adopted_project` is the official adoption target, distinct from the optional
  related `project`; they may refer to different Projects in the same Workspace;
- both Project references must resolve to Project notes owned by the Idea's
  Workspace (a Workspace itself cannot be an adoption target);
- status is exactly `active | adopted | archived`;
- canonical `adopted` requires both `adopted_project` and `adopted_at`;
- `active` must not contain adoption metadata; missing, null or empty YAML scalars
  are treated as absent optional fields;
- `archived` may retain a complete adoption pair or no pair, never a partial pair;
- `adopted_at`, when supplied, is a string containing a real calendar date in
  strict `YYYY-MM-DD` form, not a timestamp or a loosely parsed date;
- `created` is a valid date;
- aliases and tags are string arrays.

There is deliberately no unscoped Idea inbox. Creation cannot omit Workspace.
Relations are single scalar note links, not arrays or concatenated links. The
Doctor distinguishes missing, malformed, ambiguous, unresolved and cross-Workspace
references. Qualified paths must match exactly (case-insensitive, optional `.md`);
stale paths must not resolve to a different note with the same basename. Unique
short links and link aliases remain supported. Resolvable legacy bare-string
references receive a warning rather than being silently rewritten.

## Legacy compatibility and diagnostic boundary

An existing `adopted` Idea with neither adoption field is readable legacy history,
not a canonical v2 adoption. Doctor reports an actionable **warning** requesting
manual reconciliation of the official target and date. It never infers the
adoption target from `project` or writes inferred dates. A partial pair, invalid
date, adoption metadata on `active`, or invalid relation is an **error**. Without a
schema version marker, an adopted record with neither field cannot be reliably
distinguished from old history; it always receives this legacy warning. Future
adoption operations must enforce the complete pair before writing.

Doctor is read-only: it does not change status, delete fields, hide records or
migrate notes. Title, created, aliases, tags, optional related Project, unknown
user metadata and AI provenance remain untouched. Stopped/terminal Projects and
inactive/archived Workspaces do not invalidate otherwise valid adoption history.
This schema change does not expand any selector eligibility or change the current
`idea-meta` status control; adoption/revoke UI is a separate DES-02 change (#233).

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
: officially adopted by a Project, with target and date retained as Idea history
  (except legacy adopted records awaiting manual reconciliation).

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
