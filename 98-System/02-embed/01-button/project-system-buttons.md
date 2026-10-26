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
label: "フォルダ削除 (Project)"
icon: "trash-2"
style: destructive
class: oc-action
hidden: true
id: delete-project
action:
  type: "runTemplaterFile"
  templateFile: "98-System/00-command/delete_entity.md"
```
**注意:** このProjectフォルダ全体（配下のNoteを含む）をゴミ箱へ移動します。

`BUTTON[delete-project]`
