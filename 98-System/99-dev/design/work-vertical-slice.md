# Work vertical slice

Refs #130 / #129 / #103; later expanded by #239.

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

The original slice fixed Workplace to `composition`. Issue #239 removes this
restriction: the library normalizes positive integer `work_min`, preserves the
existing date grouping for all Workplaces, and additionally groups by Workplace
for monthly subtotals and daily details. Missing/blank Workplace metadata is
shown as `未指定` so that valid work minutes are not silently discarded.

## Persisted schema

The persisted inline-field schema remains unchanged; as of #239 the Workplace
is supplied by the user rather than fixed:

```text
- [date:: YYYY-MM-DD] [workplace:: WORKPLACE_NAME] [work_min:: MINUTES]
```

Existing records using `composition` remain valid, with no migration.

The QuickAdd choice `Work: Add`, the Templater `tp.user.add_work` filename
contract, Monthly Note path resolution, and Daily/Monthly/Dashboard embed names
remain unchanged. The script now prompts for a required, safely validated
Workplace name after date and duration. Dashboard shows the current month's
all-Workplace total and unique workday count. Monthly Note shows that month's
Workplace subtotals with workday counts and date/Workplace detail.

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
