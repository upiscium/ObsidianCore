**ライフサイクル:** `VIEW[{lifecycle}][text]`

`BUTTON[note-lifecycle-active, note-lifecycle-archived]`

```meta-bind-button
id: note-lifecycle-active
label: 有効
icon: circle-check
style: primary
class: note-lifecycle-button
hidden: true
action:
  type: updateMetadata
  bindTarget: lifecycle
  evaluate: false
  value: active
```

```meta-bind-button
id: note-lifecycle-archived
label: アーカイブ
icon: archive
style: default
class: note-lifecycle-button
hidden: true
action:
  type: updateMetadata
  bindTarget: lifecycle
  evaluate: false
  value: archived
```
