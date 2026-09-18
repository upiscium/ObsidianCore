# Knowledge vertical slice

Refs #140 / #129 / #103.

This slice organizes Knowledge metadata composition and Recent Knowledge
presentation without changing Knowledge v2 metadata, promotion runtime paths, or
the externally emitted `[[knowledge-meta]]` contract.

## Stable Knowledge metadata contract

The following public embed remains stable:

```text
98-System/02-embed/00-meta/knowledge-meta.md
```

Its basename `knowledge-meta` is emitted by ObsidianAutomation and by the
repository-managed Project/Workspace Note promotion utility. The stable file is
therefore retained as a thin Meta Bind wrapper.

The implementation body lives under:

```text
98-System/02-embed/knowledge/knowledge-meta-content.md
```

The internal filename deliberately uses `-content` so it cannot collide with
the public basename.

## Recent Knowledge presentation

The public embed remains:

```text
98-System/02-embed/03-table/updated-knowledge-table.md
```

It delegates to:

```text
98-System/04-view/knowledge/recent_knowledge_table.js
```

Presentation-only filtering and ordering helpers live in:

```text
98-System/05-lib/knowledge/knowledge_view_utils.js
```

The previous Dataview query semantics are preserved:

- source is `11-Knowledge`;
- file basename `hub` is excluded;
- `archived` and `deleted` are excluded;
- missing/null status remains visible for compatibility;
- unknown legacy status values remain visible, matching the previous
  `status != archived && status != deleted` query;
- the seven-day cutoff is inclusive;
- results are sorted by modification time descending;
- at most five rows are rendered.

This compatibility behavior is intentionally distinct from strict Knowledge v2
metadata validation.

## Stable runtime APIs

The following remain at their existing paths:

- `98-System/01-script/knowledge_meta_utils.js`
- `98-System/01-script/knowledge_promotion_utils.js`
- `98-System/01-script/promote_to_knowledge.js`
- `98-System/00-command/create_knowledge.md`
- `98-System/00-command/promote_to_knowledge.md`
- `98-System/03-template/01-note/knowledge-note-template.md`

They are shared runtime/command contracts rather than presentation-only
implementation details.

## Preserved behavior

- Knowledge status remains `active | outdated | archived | deleted`.
- Knowledge category, maturity and source type values are unchanged.
- Metadata button IDs, labels, styles and written values are unchanged.
- Project/Workspace Note promotion still moves to `11-Knowledge`, rewrites only
  the repository-managed metadata embed to `[[knowledge-meta]]`, preserves
  unknown frontmatter, and retains rollback behavior.
- Dashboard Recent knowledges keeps the same public basename and display scope.

Any future migration of the stable `01-script` Knowledge utilities requires a
separate caller inventory and compatibility plan.
