# Core renewal: scope and ordered gates

Baseline: `9303edff9ff8e107c92f392ebc2c0be0759864a6` (Dashboard button embeds).
Tracking: ObsidianCore #103. First implementation: #104.

## Sequence

1. Inventory public-system references and pin published entrypoints. No runtime
   layout, path or data changes. This PR implements this preparation stage.
2. Consolidate Tokyo Night-derived tokens and common controls. Preview Dashboard,
   Task, Knowledge metadata, Work and Finance in Reading View/Live Preview and a
   narrow pane/mobile before replacing active snippets.
3. Split small features, starting with Work, into stable entrypoints, logic and
   views. Add replacements before switching callers. Keep compatibility wrappers
   where private callers or plugin registrations cannot yet be inspected.
4. Retire compatibility only after public AND private callsites are checked.

Each stage has its own reviewed PR and manual merge. CI is not Live Vault UI
acceptance. A Core merge is not evidence that promotion/deployment has happened.

## Destination, not an immediate filesystem migration

Keep numbered data folders and `98-System`. Use the existing 00-command and
01-script as thin, stable plugin-facing entrypoints; 02-embed composes pages;
03-template defines initial note content; 04-view draws; future 05-lib contains
feature logic, and future 90-config contains public configuration. Keep design,
tests, fixtures and build tools in 99-dev until publication/promotion ownership
can explicitly support moving development-only files out of the Vault tree.

Organize internal lib/view/embed implementations by tasks, entities, work,
knowledge and finance; do not rename every public filename for stylistic uniformity.
For example, `tp.user.add_work` is a function interface, not a cosmetic filename.
`knowledge-meta` is also referenced by ObsidianAutomation and historical live notes.

## Design contract for the next stage

- Existing Tokyo Night theme is the base. Dark navy backgrounds; blue primary;
  purple/cyan informational accents; green success; amber warning; rose errors.
- Share spacing, radii, focus, table, badge, button and metadata-control rules.
  Use normal readable Japanese body text; monospace/tabular digits where useful.
- Keep the self-contained button embeds. Primary/secondary/danger express role;
  a primary-looking System Doctor button must still require its existing Apply.
- Preserve long-horizon high-priority tasks, dependency and workspace visibility.
- Use source CSS modules and a reviewable deterministic bundle at development
  time; do not require Node/build tools on the user's devices.
- Do not run old and replacement component rules concurrently without an explicit
  compatibility decision. Do not add styling frontmatter across existing notes.

## Reference policy

A file known only to an external consumer can have zero incoming edges in Core.
The registry is an explicit initial set, not a declaration that everything else
is private or deletable. Changes to it require the same compatibility review as
changes to entrypoints themselves. Pin paths, not content hashes: implementations
are allowed to evolve while preserving the interface.

Keep Meta Bind embeds as Meta Bind embeds; ordinary Obsidian transclusion does
not preserve their metadata target semantics. Give new internal references an
unambiguous system path and readable alias. Full paths reduce ambiguity but do
not provide automatic move safety. Retain existing short entrypoints when they
are intentionally public, and check for basename collisions.

Templater/QuickAdd/Daily Notes/plugin-local settings, hotkeys and Advanced URI
bindings must be checked in the user's environment before any registered path
moves. Do not publish raw device IDs or private note lists to perform that check.
The inventory cannot inspect references inside ObsidianAutomation, private Gitea,
other repositories, normal personal notes, or actual installed plugin settings.

## Authority remains unchanged

No Task/Workspace/Project/Knowledge schema, state rule, Work data format, top-level
note folder, credential, ACL or AI lifecycle artifact changes are part of this
renewal. Never edit the AI Writer pull-only mirror as a deployment method, never
rewrite old proposals/reviews/receipts, and never treat graph findings as
permission to move/delete private data. Promotion keeps its existing bounded
review and concurrency checks; there is no new unconditional remote write.

## First-stage inventory tools

Run only in a PUBLIC CORE CHECKOUT (not in the live/private Vault):

```sh
node 98-System/99-dev/tools/system-reference-audit.mjs
node 98-System/99-dev/tools/system-reference-audit.mjs --json
node 98-System/99-dev/tools/system-reference-audit.mjs --check-interfaces
```

Only Git-tracked files in explicit runtime roots, selected public configuration
files and CSS snippets are read. Untracked notes, private data roots,
`.obsidian/plugins`, development tests and fixture files are excluded. The CLI
reads local source and Git index only: no HTTP, code evaluation, file writes,
link rewriting, note creation, or automatic cleanup. Source and registry limits,
symlinks and unsafe paths fail collection rather than being followed. Use a
trusted local checkout; this is not a sandbox against a concurrent malicious
filesystem writer.

JSON lists source/line/kind/target and resolution candidates. The summary is
stable for unchanged inputs and has no timestamp. `resolved_file` means a file
candidate exists in this public subset; it does NOT prove runtime invocation,
plugin configuration, heading/block anchor validity, or user-facing correctness.
`directory_candidate` is not an executable. `missing_system`, `ambiguous`, and
`unsafe_or_unsupported_path` are printed as REVIEW findings. A missing short or
private path is `external_vault_unchecked`, not silently accepted as existing.
Variables, interpolation, escaped literals and nonliteral supported calls are
`dynamic_unchecked`. Files without observed incoming references are NOT unused.

This is a bounded lexical scanner, not a JS/Markdown/YAML parser. It recognises
common literal forms of wikilinks, Meta Bind embeds/templateFile/open targets,
Templater tp.user names, Dataview view/load calls and system path strings.
Generic fenced examples are excluded. Code comments/strings are masked for
call detection. Regex literals, HTML comments, YAML extensions, computed module
loads, custom loaders, generated code and nested template expressions can yield
false positives or omissions. No complete dependency/callgraph or reference-free
file claim is made. Runtime button-ID registration is not validated globally:
compatibility libraries intentionally repeat definitions across different views.

Initial CI gates the registered public interface paths, non-empty status and
applicable basename/function-name collisions. It also validates registry shape. All other
reference findings are report-only for triage. An exit 0 is NOT a clean whole-
Vault link audit. Exit 1 is a registered-interface regression; exit 2 is a failed
inventory/invalid invocation. Add higher-confidence reference gates separately
once the findings and external/missing targets have been triaged, rather than
silencing them with a broad missing-path allowlist.

## External semantics checked during design

- Templater script filenames define user function names:
  https://silentvoid13.github.io/Templater/user-functions/script-user-functions.html
- Meta Bind embeds have different metadata-target behaviour from native embeds:
  https://www.moritzjung.dev/obsidian-meta-bind-plugin-docs/guides/metabindembed/

The scanner's interpretation remains deliberately narrower than the full APIs.
