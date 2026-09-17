# Tokyo Night shared style bundle — first visual wave

Refs #103 / #106 / #111 / #113. Runtime baseline for the visual wave was
`974a0402b5a58c0e21ca053d59055b9dca411387`.

## Responsibility and scope

This wave adds namespaced design tokens, reusable components, a narrow adaptation
layer for existing Core UI, and a generated CSS bundle. It does not rearrange
Dashboard sections, move public entrypoints, change data storage or frontmatter
contracts, or connect any AI lifecycle work. No new Obsidian plugin, font download
or client-side build tool is required.

The installed Tokyo Night theme continues to own application chrome and prose.
Dark components use Night/Storm-inspired surfaces with blue accents. Light mode
uses existing Obsidian variables. Only the `oc-action` opt-in buttons, existing
metadata control classes, rendered callouts/Dataview tables and existing
Work/Finance components are targeted; ordinary application buttons are not.

Dashboard action emphasis is a reviewed UI role, not execution authority.
Navigation/maintenance controls may use `style: default` while creation/generation
controls use `style: primary`; action IDs and payloads remain independent of CSS.

## Source of truth and reproducibility

Run from the Core checkout with Node 22:

```sh
node 98-System/99-dev/tools/build-styles.mjs --write
node 98-System/99-dev/tools/build-styles.mjs --check
node --test 98-System/99-dev/test/*.test.mjs
```

`SOURCES` in the builder is the explicit cascade order. The existing eight
snippet files are temporarily retained unchanged as compatibility sources and
rollback assets. Their layout rules come first. The files under
`98-System/99-dev/styles/` are tokens, opt-in components and intentional adapters.
This is an incremental consolidation, not a claim that every duplicate legacy
rule has already been eliminated. Retire those rules one feature at a time after
visual acceptance; do not maintain a hand-edited generated stylesheet.

The builder commits the same generated base bytes to two delivery paths:

```text
.obsidian/snippets/obsidian-core.css
98-System/90-config/styles/obsidian-core.css
```

The first is the Live/config mirror used directly by the canonical Live Vault.
The second is a normal Vault-sync fallback for devices that do not synchronize
the Obsidian config directory. CI requires both files to equal `buildCss(root)`
exactly, so neither is an independent editable source of truth.

A small responsive compatibility layer is temporarily kept separate while the
mobile behavior is being accepted:

```text
.obsidian/snippets/obsidian-core-mobile.css
98-System/90-config/styles/obsidian-core-mobile.css
```

Those two files must be byte-identical. The override changes presentation only:
it keeps Dashboard/Meta Bind action groups and Mobile Home HUB links on one
horizontal row on narrow screens, using horizontal scrolling only when required,
and compacts fixed metadata controls without changing their 2/3/4/5-column
semantics. It will be folded into the base bundle in a later CSS consolidation.

The builder performs no network or plugin calls. It validates regular source and
output paths and byte limits. It is a development tool for a trusted checkout,
not a sandbox for hostile concurrent filesystem writers. `--check` is read-only;
`--write` updates only the two generated base bundle outputs. Preview uses an
explicit NEW output directory and refuses to overwrite an existing one.

## Shared config and redundant client distribution

The normal-Vault fallback is **not** a recommendation to disable `.obsidian` or a
custom Obsidian config directory synchronization. ObsidianCore currently manages
shared config such as app/appearance/plugin enablement, Daily Notes, graph,
hotkeys, types and snippets. A deployment that intentionally synchronizes those
settings may keep config directory synchronization enabled.

Plugin-local credentials, generated IDs and workspace/device state still need
local policy. Repository tracking and Core Promotion do not imply that every
plugin-local file should be synchronized.

For clients that do not synchronize the config directory, normal Vault sync
carries both fallback files under `98-System/90-config/styles/`. The existing
required Templater Startup Template calls `tp.user.sync_core_style(tp)`. The
installer uses `app.vault.configDir` and the Vault Adapter API to copy exact bytes
to:

```text
<vault.configDir>/snippets/obsidian-core.css
<vault.configDir>/snippets/obsidian-core-mobile.css
```

It does not use Node filesystem modules, so the same implementation is intended
for desktop and mobile adapters. Both sources and existing targets are validated
before writes begin. It creates only the missing `snippets` directory, verifies
bytes after writing, and returns without writing current files that already
match. If a different local file uses either managed name without the expected
ObsidianCore header, the installer refuses to overwrite it.

The installer deliberately does not edit `appearance.json`, plugin settings,
workspace state, or unrelated snippets. Canonical repository appearance enables
`obsidian-core` followed by `obsidian-core-mobile`. A client whose appearance
configuration is not synchronized may make the equivalent one-time local
selection after startup installation. This avoids relying on unsupported
internal APIs.

Obsidian's developer guidance says not to hard-code `.obsidian` when the
configuration directory may be customized, and notes that hidden config files
require Adapter-level access. The fallback therefore uses `Vault.configDir` and
`Vault.adapter` rather than desktop-only filesystem paths.

## Preserved behavior

- Metadata retains its 2/3/4/5-column grids and write semantics.
- On phone widths, metadata labels use compact single-line typography instead of
  becoming unnecessarily two lines; the grid column count does not change.
- Dashboard/Meta Bind action rows do not wrap into a second button row on narrow
  screens. If the labels cannot fit, the row scrolls horizontally rather than
  reordering controls.
- Mobile Home HUB links follow the same one-row behavior without changing link
  destinations.
- Focus indication, disabled states and coarse-pointer minimum heights remain.
- Work/Finance summaries use auto-fit grids for narrow panes.
- Horizontal stacked bar geometry, inline category colors, percentages and
  amount labels are not rewritten. Numeric glyph widths are aligned.
- No selector decides task/Knowledge state from a label or edits any note.
- `meta-bind-embed` and its binding context are not changed.
- No arbitrary plugin-local state is distributed by the style installer.

## Review fixture (not Obsidian acceptance)

```sh
node 98-System/99-dev/tools/build-styles.mjs --preview /tmp/oc-style-preview-new
```

Open `dark.html` and `light.html` in that new directory. All values are synthetic;
buttons have no actions and nothing is read from a Vault. There is no JavaScript,
network, external font or library. CI uploads the same static fixture and compiled
base CSS as a 7-day review artifact. A native HTML fixture checks only the modeled
DOM, not Obsidian's actual renderers or plugin behavior. The mobile compatibility
override has separate structural regression tests and still requires real-mobile
acceptance.

## Live Vault rollout and rollback

Merge is manual. Promote the generated CSS outputs, responsive override and
reviewed settings/button changes through the existing Core -> Live Vault process,
NOT the AI Writer mirror. No source compilation is needed on a client. Missing or
divergent managed style files must not be ignored as successful promotion.

In the canonical Live Vault, `appearance.json` enables `obsidian-core` then
`obsidian-core-mobile` and disables the eight managed legacy inputs:
`callout-colors`, `expense-dashboard-lite`, `mobile-home-buttons`,
`monthly-expanse`, `task-button`, `task-controls`, `task-status`, and `work-time`.
Unrelated private snippets may remain enabled after local reconciliation.

Review actual Dashboard, Task, Knowledge metadata, Work summaries and Finance in
Reading View and Live Preview, dark/light and narrow panes/mobile. On mobile,
confirm Dashboard action groups and the Mobile Home HUB row stay one row, and
metadata button labels remain legible without changing control order. Confirm
focus remains visible, charts retain values/colors, and editing still affects only
the intended note. Cancel creation/repair dialogs in a smoke test; do not run
System Doctor Apply merely to test presentation. The pre-existing empty Add
subscription command and duplicate subscription paths remain separate issues and
must not be attributed to the CSS change.

To roll back a device, disable `obsidian-core-mobile` first. If necessary also
disable `obsidian-core` and restore the former managed snippet selections. The
startup installer may continue to keep inactive managed files current; it does
not force activation. This does not roll back ordinary note edits.

## References

- https://docs.obsidian.md/Plugins/Vault
- https://docs.obsidian.md/oo/plugin
- https://www.moritzjung.dev/obsidian-meta-bind-plugin-docs/guides/stylingandcss/
- https://www.moritzjung.dev/obsidian-meta-bind-plugin-docs/guides/buttons/

Class-based styling follows Meta Bind's documented `.mb-button.CLASS > button`
selector. Actual installed plugin rendering is a separate user acceptance gate.
