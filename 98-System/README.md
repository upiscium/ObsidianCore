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
| `90-config/` | Portable configuration payloads that must travel through ordinary Vault sync | Do not place credentials or device-local plugin state here |
| `99-dev/` | Setup contract, validation, tests and design | Run tools from public Core checkout, not the Live Vault |
| `.obsidian/snippets/` (Vault root) | Live/config mirror of the generated Core CSS bundle | Keep byte-identical with the normal-sync distribution copy |

`90-config/styles/obsidian-core.css` is the ordinary-sync delivery copy of the
Core stylesheet. The existing Templater Startup Template copies that exact file
into `<vault.configDir>/snippets/obsidian-core.css` on each device. This avoids
requiring Remotely Save to synchronize the whole Obsidian config directory.
Snippet activation remains a one-time device-local Appearance setting.

Future `05-lib/` remains a reserved direction. Start with the
[ordered renewal plan](99-dev/design/core-renewal.md), the
[public interface registry](99-dev/setup/system-interfaces.json), and the
[automation setup contract](99-dev/setup/README.md).

To inspect the public system without executing it:

```sh
node 98-System/99-dev/tools/system-reference-audit.mjs --json
```

The output inventories static reference CANDIDATES and registered public
entrypoints. It does not prove that a file is unused or safe to remove. Private
notes, other repositories, actual plugin-local settings, dynamic calls and UI
behaviour are separate checks. See the design document for scope and limits.
