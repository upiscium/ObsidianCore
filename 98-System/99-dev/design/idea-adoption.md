# Idea adoption — explicit Human actions

Issue #233 / DES-02. This is an operation contract, not a Vault migration.
`project` is the optional related Project; `adopted_project` is the one formally
chosen adoption target. They may differ, but both belong to the Idea's Workspace.

## Controls and canonical writer

`idea-meta` displays status, related Workspace/Project and the adoption target/date
as read-only text. Viewing it does not run a writer or repair existing notes.

- **Adopt (Project):** choose an existing Project, then explicitly confirm. Only
  `planning` / `running` Projects owned by the Idea's **active** Workspace are
  selectable. Neither Workspace creation nor Task selector eligibility is reused.
- **Cancel Adoption:** explicitly confirm `adopted` → `active`; clear both
  `adopted_project` and `adopted_at`. Keep related Project, Workspace, body,
  AI provenance and other user fields.
- **Archive Idea:** explicitly confirm; preserve a complete historical adoption
  pair. Archived Ideas cannot be newly adopted or cancelled through these normal
  controls. There is no status-only Active/Adopted toggle.
- Reattempting the same valid adoption is a no-write operation and retains the
  original date. Another target is refused: cancel first, then choose again.
- A finished Project or inactive Workspace does not erase history: a coherent
  adopted record can still be revoked or archived. New Adopt (including a
  reattempt through its chooser) retains the current active eligibility rules.

The three `00-command` files call `01-script/transition_idea.js` with an explicit
action. Desktop uses the registered Templater user function; Mobile, or desktop
without that function, loads **only** that fixed Core path from the Vault, using
the established CommonJS loader style. No Node imports, services or new plugin
are needed. Missing context/Core/Templater produces a safe Notice, not raw YAML or
exception text. `tp.obsidian.parseYaml` parses fresh Vault frontmatter;
`window.moment().format("YYYY-MM-DD")` supplies the local date, checked by the
shared strict real-calendar adoption-date validator. No UTC-date substitution.

The writer checks the current Idea type/location, scalar unambiguous references
against **all** Markdown files (including collisions outside entity folders),
Workspace ownership and target eligibility. Official targets are written as full
Vault-qualified wikilinks. It rereads source and dependency YAML after all dialogs,
rejects changed critical selection state and cache lag, and checks file identity,
copied stat values and current cache/reference resolution inside the single
synchronous `processFrontMatter` callback. The callback-supplied Idea frontmatter
is authoritative, not its preflight copy. All checks precede assignment.

Only transition-owned fields are assigned; concurrent unrelated metadata/body
edits are retained. Obsidian may reserialize YAML formatting/comments, so this is
semantic frontmatter preservation, not a claim of byte-identical YAML. A callback
refusal must leave the note unwritten. The body is not supplied or rewritten by
the command.

### Concurrency limit

This is an optimistic **local** check plus atomic Idea-frontmatter update, not a
multi-file or distributed lock. Copied mtime/size and cache agreement detect
observed changes but cannot guarantee detection of an external same-size edit
with unchanged timestamps or sync activity after validation. Do not concurrently
edit/move these notes or resolve sync conflicts during adoption. Retry after
Obsidian metadata settles if the command refuses stale context. Actual Desktop /
Mobile parser, callback-abort behavior and sync acceptance remain a separate
manual test gate; Node mocks are not that device acceptance.

## Legacy metadata repair

Legacy `status: adopted` without both adoption fields is intentionally **blocked**
from automatic Adopt, Cancel Adoption and Archive. Partial, malformed and invalid
date records are also blocked. No target is inferred from `project`, no date from
`created`, file timestamps or today, and no note is changed merely by viewing it.

Use this explicit, per-note human procedure (not a bulk tool):

1. Stop concurrent editing/sync conflict resolution and retain a backup/history
   copy of the affected Idea. Open its source frontmatter, not just its embed.
2. Verify the **actual historical adoption decision**, its one existing Project
   and its actual adoption date using trusted human records. Confirm that the
   Idea and Project refer unambiguously to the **same** existing Workspace.
   Resolve stale/ambiguous links manually using full Vault-relative paths.
3. If either the Project or date cannot be established, **stop and leave the
   record unresolved**. Ask the owner to reconcile; never guess or use today.
4. After consciously confirming both facts, edit the pair together in source
   mode, keeping `status: adopted` (or `archived` for an already archived historical
   record). For example, replace the placeholders below with verified values;
   quote the real date so YAML preserves its strict string type:

   ```yaml
   adopted_project: "[[10-Project/Verified historical Project]]"
   adopted_at: "2024-02-29"
   ```

   This is an example of a valid calendar date, **not** a suggested repair date.
   Preserve Workspace, related `project`, body, aliases/tags and all provenance.
   Do not move an Idea to another Workspace to make a mismatched history pass.
5. Run the read-only System Doctor and check the full relation/date pair. Only
   after reconciliation may the normal explicit controls be used (for example,
   Cancel Adoption if the owner now wants to revoke it). Archived history remains
   archived; this issue introduces no unarchive or historical retarget command.

## Narrow overlap with #235

The existing `select_idea_context.js` could move an adopted Idea to a different
Workspace and immediately break the adoption relation. It now refuses context
editing when status is adopted **or either adoption field is present**, at entry,
after selection, and in its own frontmatter callback. This includes malformed or
archived history. Cancel a valid current adoption first; reconcile invalid legacy
history explicitly. This conservative guard also blocks related-Project editing
on history-bearing notes; it does not rewrite history or infer a new Workspace.
Context-aware creation, AI/Knowledge integration and broader selector changes
remain #235, outside this issue. Task lifecycle work (#230), AI auto-Adopt (#198)
and the independent date-display Draft PR #229 are unchanged.

## Verification map

- `idea-adoption-transitions.test.mjs`: actual writer with a transactional
  frontmatter mock; valid adoption, explicit confirmation, no-write cancellation,
  date/idempotency, revoke/archive, preserved metadata/body, stale/raced source
  and dependency context, cache lag, strict references and safe failures.
- `idea-adoption-wiring.test.mjs`: real command execution via desktop/mobile and
  fallback loaders, no direct status buttons, read-only UI and context guards.
- Existing metadata/Doctor tests continue to cover the v2 schema and strict
  historical date/reference diagnostics. No real user note is a test fixture.

Canonical local verification from the Core clone:

```sh
nix-shell -p nodejs_22 --run 'node --test 98-System/99-dev/test/*.test.mjs'
nix-shell -p nodejs_22 --run 'node 98-System/99-dev/validate-repo.mjs'
git diff --check
```
