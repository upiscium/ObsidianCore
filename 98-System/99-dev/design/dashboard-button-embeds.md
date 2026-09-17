# Dashboard button embeds

Dashboard section controls use the same pattern as `work-buttons.md`: hidden
Meta Bind button definitions followed by their visible inline `BUTTON` references
in one self-contained embed. The Dashboard embeds each group in its original
section instead of loading a shared definition library at the top.

The shared style bundle adds the opt-in `class: oc-action` without changing any
command, link, label, icon or identifier. Button emphasis is intentional rather
than globally uniform: creation/generation actions remain `primary`, while
navigation and maintenance controls that were deliberately softened in the Live
Vault remain `default`. In particular Task Backlog, Daily/Monthly navigation,
Knowledge HUB and System Doctor are secondary controls. See
`tokyo-night-style-bundle.md` for CSS rollout.

No additional plugin, frontmatter field, JavaScript action or command is added.
Tasks, Periodic notes, Workspaces, Knowledge, Subscriptions, and System each have
one `dashboard-*-buttons.md` file under `98-System/02-embed/01-button/`.
The Add work action and all non-button views remain unchanged.

## Compatibility

`dashboard-buttons.md` is retained for older/private notes that may still load
its hidden definitions. The new Dashboard does not load it. Tests compare the
11 migrated definitions against this compatibility library after removing only
presentation-owned `style` and `class` lines, so action targets and identifiers
cannot drift while the reviewed primary/default hierarchy evolves independently.
When changing an action later, update both copies until the legacy library has
been explicitly retired after checking private callers. Do not embed both
arrangements into the same Dashboard.

This change preserves the original command/link/template targets, even when an
existing command is incomplete: `create_subscription.md` is empty at the current
baseline. Its visible button is retained, but Subscription creation is not fixed
or accepted by this UI refactor. System Doctor still invokes its existing preview
and explicit Apply flow; styling never adds execution authority. Dynamic controls
inside Dataview tables are outside this change.

## Acceptance and rollout

Repository validation and Node tests check the embed structure, action identity,
render-once order, reviewed style hierarchy and unchanged sections/views. They do
not render Obsidian. After manual merge, promote the reviewed Core changes through
the existing Live Vault route. Do not edit the AI Writer's pull-only mirror to
deploy this UI.

In Obsidian, confirm all sections show their controls without an unknown-button
error, Add work remains unchanged, and navigation/command actions still reach the
same destinations. Confirm the secondary controls are visibly quieter than the
primary creation/generation actions. Cancel creation dialogs during a smoke test;
do not apply a System Doctor fix merely to test its button. Confirm Live Preview
and Reading View separately, and include a narrow/mobile layout when available.
Do not treat a successful CI run or a Core merge as Live Vault UI acceptance.
