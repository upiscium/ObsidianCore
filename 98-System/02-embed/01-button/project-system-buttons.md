```meta-bind-button
label: "Rename Project"
icon: "pencil"
style: default
class: oc-action
hidden: true
id: rename-project
action:
  type: "runTemplaterFile"
  templateFile: "98-System/00-command/rename_entity.md"
```
`BUTTON[rename-project]`

```meta-bind-button
label: "削除 (Project)"
icon: "trash-2"
style: destructive
class: oc-action
hidden: true
id: delete-project
action:
  type: "runTemplaterFile"
  templateFile: "98-System/00-command/delete_entity.md"
```
`BUTTON[delete-project]`
