# Shared view utilities

Refs #144 / #129 / #103.

Phase 2 ends with a deliberately small shared-utility boundary. Shared code is
only introduced where multiple feature slices already implement the same pure
presentation semantics.

## Cross-feature shared boundary

```text
98-System/05-lib/shared/view_utils.js
```

It owns exactly two generic operations:

- normalize an existing Dataview/date-like value to the historical
  `yyyy-MM-dd` string shape used by Work and Finance;
- compare pages by `file.mtime` descending using the caller-supplied Dataview
  comparator.

Consumers are:

- Work `work_time_utils.js`;
- Project / Workspace `entity_view_utils.js` and Note table ordering;
- Knowledge recent ordering;
- Finance view helpers.

The shared library does not read `dv`, `app`, `moment`, Vault paths,
metadata fields, lifecycle/status values, or feature-specific schemas.

## Finance-local shared boundary

```text
98-System/05-lib/finance/finance_view_utils.js
```

The repeated Finance helpers remain Finance-owned rather than being promoted to
the cross-feature shared layer. They cover:

- yen formatting used by Budget / Daily Budget / Per-day Budget;
- loose amount parsing used by those presentation views;
- date normalization delegated to `shared/view_utils.js`;
- category total accumulation;
- category rows and ratio calculation.

This deliberately does not replace Subscription amount validation. The
Subscription command/runtime accepts a different contract and remains separate.

## Explicit non-goals

The following similar-looking helpers are not unified in this slice:

- Task scheduling/date validation and leap-day checks;
- Task/Entity/Knowledge metadata date formatters that have different null and
  `toISODate` behavior;
- Subscription sync validation;
- feature lifecycle/status/reference utilities;
- the repeated Dataview `loadExpression` bootstrap.

The loader is intentionally local: a loader stored behind the same dynamic
loader would introduce a bootstrap/circular dependency without meaningful
semantic ownership.

## Dependency direction

```text
04-view/<feature>
      |
      +--> 05-lib/<feature>
      |          |
      |          +--> 05-lib/shared
      |
      +----------------> 05-lib/shared
```

Shared code never imports feature libraries. Feature libraries may delegate
generic behavior to shared code while preserving their existing public methods.

## Compatibility

No public basename, exact path, command target, frontmatter schema, storage root,
or Templater/QuickAdd function name changes in this cleanup.

The goal is not maximum deduplication. It is a small dependency boundary with
equivalent behavior and fewer copies of genuinely identical pure logic.
