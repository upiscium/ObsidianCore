# Tokyo Night shared style bundle — first visual wave

Refs #103 / #106. Runtime baseline: `974a0402b5a58c0e21ca053d59055b9dca411387`.

## Responsibility and scope

This wave adds namespaced design tokens, reusable components, a narrow adaptation
layer for existing Core UI, and one committed CSS delivery file. It does not
rearrange Dashboard sections, move public entrypoints, change data storage or
frontmatter contracts, or connect any AI lifecycle work. No new Obsidian plugin,
font download or build tool on client devices is required. Source files are not
moved in the same change as this visual refresh.

The installed Tokyo Night theme continues to own application chrome and prose.
Dark components use Night/Storm-inspired surfaces with blue accents. Light mode
uses existing Obsidian variables. Only the new `oc-action` opt-in buttons,
existing metadata control classes, rendered callouts/Dataview tables and existing
Work/Finance components are targeted; ordinary application buttons are not.

The Dashboard's 12 existing buttons gain only `class: oc-action`. Their IDs,
labels, icons, ordering and action payloads stay unchanged. Primary remains the
fallback style for these existing controls. Secondary/danger primitives are
available in the fixture; role reclassification accompanies the later Dashboard
layout wave, not this change. The old hidden dashboard button library is retained.

## Source of truth and reproducibility

Run from the Core checkout with Node 22:

```sh
node 98-System/99-dev/tools/build-styles.mjs --write
node 98-System/99-dev/tools/build-styles.mjs --check
node --test 98-System/99-dev/test/*.test.mjs
```

`SOURCES` in the builder is the explicit cascade order. The existing eight
snippet files are temporarily retained unchanged as compatibility sources and
rollback assets. Their layout rules come first. The new files under
`98-System/99-dev/styles/` are tokens, opt-in components and intentional adapters.
This is an incremental consolidation, not a claim that every duplicate legacy
rule has already been eliminated. Retire those rules one feature at a time after
visual acceptance; do not maintain a second hand-edited generated stylesheet.

The committed `.obsidian/snippets/obsidian-core.css` includes all sources, LF
normalized, with a source marker per section. CI rejects stale/missing generated
bytes and double activation. New snippets unrelated to this bundle may coexist;
the eight legacy inputs must NOT also be enabled. Original file paths remain
available but inactive, including the known misspelling `monthly-expanse.css`.

The builder performs no network or plugin calls. It validates regular source
paths and byte limits. It is a development tool for a trusted checkout, not a
sandbox for hostile concurrent filesystem writers. `--check` is read-only;
`--write` updates only the generated bundle. Preview uses an explicit NEW output
directory and refuses to overwrite an existing one.

## Preserved behavior

- Metadata's 2/3/4/5-column grids, wrapping and overflow protection remain present.
- Focus indication, disabled states and coarse-pointer minimum heights are added.
- Work/Finance summaries use auto-fit grids for narrow panes.
- Horizontal stacked bar geometry, inline category colors, percentages and
  amount labels are not rewritten. Numeric glyph widths are aligned.
- No selector decides task/Knowledge state from a label or edits any note.
- `meta-bind-embed` and its binding context are not changed.
- No arbitrary host appearance settings or plugin-local state are distributed.

## Review fixture (not Obsidian acceptance)

```sh
node 98-System/99-dev/tools/build-styles.mjs --preview /tmp/oc-style-preview-new
```

Open `dark.html` and `light.html` in that new directory. All values are synthetic;
buttons have no actions and nothing is read from a Vault. There is no JavaScript,
network, external font or library. CI uploads the same static fixture and compiled
CSS as a 7-day review artifact. A native HTML fixture checks only the modeled DOM,
not Obsidian's actual renderers or plugin behavior.

## Live Vault rollout and rollback

Merge is manual. Promote the compiled CSS and the reviewed settings/button
changes through the existing Core -> Live Vault process, NOT the AI Writer mirror.
Place the compiled CSS before activating it; do not depend on an atomic multi-file
Nextcloud update. No source compilation is needed on a client. A missing bundle
must not be ignored as successful promotion.

In Appearance, enable `obsidian-core` and disable only these managed legacy inputs:
`callout-colors`, `expense-dashboard-lite`, `mobile-home-buttons`, `monthly-expanse`,
`task-button`, `task-controls`, `task-status`, `work-time`.
Retain unrelated private snippets and other appearance settings. A private/local
change conflicting with the reviewed appearance JSON needs reconciliation, not an
unconditional configuration overwrite.

Review actual Dashboard, Task, Knowledge metadata, Work summaries and Finance in
Reading View and Live Preview, dark/light and narrow panes/mobile. Confirm button
labels are contained, focus is visible, charts retain values/colors, and editing
still affects only the intended note. Cancel creation/repair dialogs in a smoke
test; do not run System Doctor Apply just to test presentation. The pre-existing
empty Add subscription command and duplicate subscription paths remain separate
issues and must not be attributed to the CSS change.

To roll back the appearance, disable `obsidian-core` and restore the former eight
snippet selections. They have not been deleted or edited. The added `oc-action`
classes become inert and old button behavior is unchanged. This does not roll
back any user's ordinary note edits, nor should it.

## References

- https://www.moritzjung.dev/obsidian-meta-bind-plugin-docs/guides/stylingandcss/
- https://www.moritzjung.dev/obsidian-meta-bind-plugin-docs/guides/buttons/

Class-based styling follows Meta Bind's documented `.mb-button.CLASS > button`
selector. Actual installed plugin rendering is a separate user acceptance gate.
