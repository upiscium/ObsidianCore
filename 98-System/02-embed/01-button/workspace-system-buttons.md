```meta-bind-button
label: "Rename Workspace"
icon: "pencil"
style: default
class: oc-action
hidden: true
id: rename-workspace
action:
  type: "runTemplaterFile"
  templateFile: "98-System/00-command/rename_entity.md"
```
`BUTTON[rename-workspace]`

```meta-bind-button
label: "フォルダ削除 (Workspace)"
icon: "trash-2"
style: destructive
class: oc-action
hidden: true
id: delete-workspace
action:
  type: "runTemplaterFile"
  templateFile: "98-System/00-command/delete_entity.md"
```
**注意:** このWorkspaceフォルダ全体（配下のNoteを含む）をゴミ箱へ移動します。別フォルダのProjectは残ります。

`BUTTON[delete-workspace]`
