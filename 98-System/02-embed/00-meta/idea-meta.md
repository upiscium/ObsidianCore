> [!info]- Idea metadata
> **状態:** `VIEW[{status}][text]`
>
> `BUTTON[idea-status-active, idea-status-adopted, idea-status-archived]`
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
id: idea-status-active
label: Active
icon: lightbulb
style: primary
class: idea-status-button
hidden: true
action:
  type: updateMetadata
  bindTarget: status
  evaluate: false
  value: active
```

```meta-bind-button
id: idea-status-adopted
label: Adopted
icon: circle-check
style: default
class: idea-status-button
hidden: true
action:
  type: updateMetadata
  bindTarget: status
  evaluate: false
  value: adopted
```

```meta-bind-button
id: idea-status-archived
label: Archived
icon: archive
style: default
class: idea-status-button
hidden: true
action:
  type: updateMetadata
  bindTarget: status
  evaluate: false
  value: archived
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
