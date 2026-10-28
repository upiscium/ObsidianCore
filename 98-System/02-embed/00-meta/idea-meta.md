> [!info]- Idea metadata
> **状態:** `VIEW[{status}][text]`
>
> `BUTTON[idea-status-adopted, idea-cancel-adoption, idea-status-archived]`
>
> **Adopted project:** `VIEW[{adopted_project}][text]`
>
> **Adopted at:** `VIEW[{adopted_at}][text]`
>
> Legacy repair: see [[idea-adoption#Legacy metadata repair|manual repair instructions]] if these fields are inconsistent.
>
> **Workspace:** `VIEW[{workspace}][text]`
>
> **Project:** `VIEW[{project}][text]`
>
> `BUTTON[idea-select-context]`
>
> **作成日:** `VIEW[{created}][text]`
>
> ```meta-bind-embed
> [[knowledge-promotion-button]]
> ```

```meta-bind-button
id: idea-status-adopted
label: Adopt (Project)
icon: circle-check
style: primary
class: oc-action
hidden: true
action:
  type: runTemplaterFile
  templateFile: "98-System/00-command/adopt_idea.md"
```

```meta-bind-button
id: idea-status-archived
label: Archive Idea
icon: archive
style: default
class: oc-action
hidden: true
action:
  type: runTemplaterFile
  templateFile: "98-System/00-command/archive_idea.md"
```

```meta-bind-button
id: idea-cancel-adoption
label: Cancel Adoption
icon: circle-x
style: default
class: oc-action
hidden: true
action:
  type: runTemplaterFile
  templateFile: "98-System/00-command/cancel_idea_adoption.md"
```

```meta-bind-button
id: idea-select-context
label: Workspace / Projectを選択
icon: folder-cog
style: default
class: oc-action
hidden: true
action:
  type: runTemplaterFile
  templateFile: "98-System/00-command/select_idea_context.md"
```
