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
The Add work action and all button contracts remain unchanged. Dashboard
composition may intentionally omit detail-heavy non-button views; those reusable
views remain available through their feature surfaces.

## Compatibility

The former `dashboard-buttons.md` shared compatibility library has been retired.
A Live Vault search confirmed that no non-development Markdown caller still
references it. Dashboard controls are now authoritative only in the six
section-scoped `dashboard-*-buttons.md` embeds. Tests pin each migrated button's
identifier, label, icon, action type and target directly, so action contracts
remain guarded without maintaining a duplicate hidden-definition library.

This change preserves the original command/link/template targets. Subscription
creation is now implemented behind the existing `create_subscription.md` target,
so the button contract remains unchanged while runtime ownership lives in the
Finance/Subscription feature. System Doctor still invokes its existing preview
and explicit Apply flow; styling never adds execution authority. Repository-owned dynamic controls now use the same opt-in primitives when they render
buttons: Task-table actions use `oc-button`, and Finance month navigation uses
`oc-button` / `oc-button--primary`. Ordinary Obsidian application chrome remains
outside this styling contract.

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
