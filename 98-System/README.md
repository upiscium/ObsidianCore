# ObsidianCore system map

System files provide the UI and automation inside Obsidian; normal user notes
remain in their existing numbered data folders. This map is not a migration.

| Location | Current responsibility | Refactoring boundary |
| --- | --- | --- |
| `00-command/` | Templater commands referenced by buttons | Keep public paths stable |
| `01-script/` | Templater/QuickAdd scripts and utility implementations | Preserve registered function names; split internals gradually |
| `02-embed/` | Metadata controls, buttons, sections, table wrappers | Preserve public embeds such as knowledge-meta |
| `03-template/` | Initial note content and startup templates | Do not silently change note schema or plugin registrations |
| `04-view/` | Dataview rendering and some mixed logic | Move logic to feature libraries only behind stable entrypoints |
| `99-dev/` | Setup contract, validation, tests and design | Run tools from public Core checkout, not the Live Vault |
| `.obsidian/snippets/` (Vault root) | Distributed CSS | Consolidate in the next independent design stage |

Future `05-lib/` and `90-config/` are reserved directions, not newly required
runtime directories. Start with the [ordered renewal plan](99-dev/design/core-renewal.md)
and the [public interface registry](99-dev/setup/system-interfaces.json).

To inspect the public system without executing it:

```sh
node 98-System/99-dev/tools/system-reference-audit.mjs --json
```

The output inventories static reference CANDIDATES and registered public
entrypoints. It does not prove that a file is unused or safe to remove. Private
notes, other repositories, actual plugin-local settings, dynamic calls and UI
behaviour are separate checks. See the design document for scope and limits.
