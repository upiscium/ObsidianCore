# Work vertical slice

Refs #130 / #129 / #103.

This slice separates stable Work entrypoints from internal rendering and pure
aggregation logic without changing the persisted Work record schema.

## Stable public entrypoints

The following paths/names remain stable because they are referenced by existing
notes, Templater, QuickAdd, or user configuration:

- `98-System/00-command/add_work.md`
- `98-System/01-script/add_work.js`
- `98-System/02-embed/01-button/work-buttons.md`
- basename `[[daily-work]]`
- basename `[[work-visualiser]]`
- basename `[[work-summary]]`

The three Work display embeds stay at their existing paths and now act as thin
`dv.view` wrappers. They are recorded as basename interfaces in
`system-interfaces.json`.

## Internal implementation

Rendering is owned by:

- `98-System/04-view/work/daily_work.js`
- `98-System/04-view/work/monthly_work.js`
- `98-System/04-view/work/work_summary.js`

Shared pure display/aggregation semantics are owned by:

- `98-System/05-lib/work/work_time_utils.js`

Its generic date normalization is delegated to `98-System/05-lib/shared/view_utils.js`; Work-specific workplace/minute semantics remain local.

The internal Work library fixes the canonical workplace to `composition`,
normalizes positive integer `work_min` values, formats durations, aggregates a
single day, and groups a month by date.

## Persisted schema

This refactor does not change the canonical record written by `add_work.js`:

```text
- [date:: YYYY-MM-DD] [workplace:: composition] [work_min:: MINUTES]
```

The QuickAdd choice `Work: Add`, the Templater `tp.user.add_work` filename
contract, Monthly Note path resolution, and Daily/Monthly/Dashboard embed names
remain unchanged.

## Why add_work.js remains in 01-script

`add_work.js` is a registered Templater/QuickAdd user-function entrypoint and
must remain usable on mobile. It is therefore intentionally not moved or made
dependent on Node filesystem/module resolution in this slice. Future extraction
of its pure write helpers requires a mobile-safe loader contract and a separate
compatibility review.

## Next Phase 2 slices

After this Work slice is accepted, continue with Dashboard-only composition,
then Task view/lib separation, then Project/Workspace/Knowledge and Finance.
Do not bulk-move public basename embeds without a private-caller gate.
