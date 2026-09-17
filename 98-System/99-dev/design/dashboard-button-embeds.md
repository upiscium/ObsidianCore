# Dashboard button embeds

Dashboard section controls use the same pattern as `work-buttons.md`: hidden
Meta Bind button definitions followed by their visible inline `BUTTON` references
in one self-contained embed. The Dashboard embeds each group in its original
section instead of loading a shared definition library at the top.

All section controls use `style: primary`, the current theme's primary button
appearance, with their existing labels and icons. No CSS, additional plugin,
frontmatter field, JavaScript action, or command implementation is introduced.
Tasks, Periodic notes, Workspaces, Knowledge, Subscriptions, and System each have
one `dashboard-*-buttons.md` file under `98-System/02-embed/01-button/`.
`work-buttons.md` and all non-button views remain unchanged.

## Compatibility

`dashboard-buttons.md` is retained for older/private notes that may still load
its hidden definitions. The new Dashboard does not load it. Tests compare all
11 migrated definitions against this compatibility library, permitting only the
intentional `default` to `primary` style change. When changing an action later,
update both copies until the legacy library has been explicitly retired after
checking private callers. Do not embed both arrangements into the same Dashboard.

This change preserves the original command/link/template targets, even when an
existing command is incomplete: `create_subscription.md` is empty at the base
revision. Its visible button is retained, but Subscription creation is not fixed
or accepted by this UI refactor. System Doctor still invokes its existing preview
and explicit Apply flow; the primary style does not add execution authority.
Dynamic controls inside Dataview tables are outside this change.

## Acceptance and rollout

Repository validation and Node tests check the embed structure, action identity,
render-once order, and unchanged sections/views. They do not render Obsidian.
After manual merge, promote the reviewed Core changes through the existing Live
Vault route. Do not edit the AI Writer's pull-only mirror to deploy this UI.
Transfer `Dashboard.md` and the six new embed files as one reviewed change set.

In Obsidian, confirm all sections show their controls without an unknown-button
error, Add work remains unchanged, and navigation/command actions still reach the
same destinations. Cancel creation dialogs during a smoke test; do not apply a
System Doctor fix merely to test its button. Confirm Live Preview and Reading
View separately, and include a narrow/mobile layout when available.
Do not treat a successful CI run or a Core merge as Live Vault UI acceptance.
