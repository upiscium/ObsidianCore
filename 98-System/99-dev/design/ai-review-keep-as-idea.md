# AI Review Keep as Idea

Refs #196.

## Boundary

The AI pipeline remains a Knowledge-candidate pipeline. `Keep as Idea` is a
Human disposition applied after Review; it does not grant Automation a second
canonical writer.

The Obsidian client creates the Idea through ObsidianCore. Only after that local
Vault mutation succeeds does the Review projection receive:

```yaml
review_request: keep_as_idea
```

Automation may interpret that value as a Human terminal decision, but it does
not create, read, verify or mutate `05-Idea/**`.

## Human flow

```text
04-AI/50-Review/<case>.md
        |
        | Keep as Idea
        v
select required Workspace
select optional Project
        |
        v
05-Idea/<candidate title>.md
        |
        | successful creation/adoption
        v
review_request = keep_as_idea
```

The command is fail-closed:

- active file must be the exact Review projection shape;
- protected SHA fields must be lowercase SHA-256 values;
- candidate must be extracted from the deterministic Candidate code fence;
- candidate must contain a Knowledge Note envelope;
- Workspace cannot be omitted;
- Project candidates are restricted to the chosen Workspace;
- the Review request is not changed before Idea creation succeeds.

## Idempotency

AI-created Ideas persist:

- `ai_case_id`;
- source Proposal SHA;
- source Evaluation SHA;
- source mutation SHA.

A repeated action searches `05-Idea` by `ai_case_id`. One exact provenance
match is adopted instead of creating another Idea. Multiple matches or mismatched
provenance fail closed.

If Review frontmatter update fails after a new Idea is created, the command
attempts to delete only that newly-created file. If rollback also fails, the
provenance fields make the next invocation converge on the existing Idea rather
than duplicate it.

## Idea content conversion

The deterministic Knowledge frontmatter envelope and repository-managed
`knowledge-meta` embed are removed. The remaining candidate Markdown becomes
the Idea body below the canonical `idea-meta` embed.

Idea ownership metadata is supplied by the Human-selected context, not copied
from the generated Knowledge candidate.

## Authority

This design deliberately does not expand:

- Automation WebDAV write roots;
- Reviewer Nextcloud permissions;
- Sync authority;
- Executor roots.

The Human action is an attestation that the candidate was retained as an Idea.
The corresponding Automation decision is terminal and must never be interpreted
as Knowledge approval.
