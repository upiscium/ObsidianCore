**ライフサイクル:** `VIEW[{lifecycle}][text]`

`BUTTON[workspace-lifecycle-active, workspace-lifecycle-inactive, workspace-lifecycle-archived]`

```meta-bind-button
id: workspace-lifecycle-active
label: 有効
icon: circle-check
style: primary
class: workspace-lifecycle-button
hidden: true
action:
  type: updateMetadata
  bindTarget: lifecycle
  evaluate: false
  value: active
```

```meta-bind-button
id: workspace-lifecycle-inactive
label: 休止
icon: pause
style: default
class: workspace-lifecycle-button
hidden: true
action:
  type: updateMetadata
  bindTarget: lifecycle
  evaluate: false
  value: inactive
```

```meta-bind-button
id: workspace-lifecycle-archived
label: アーカイブ
icon: archive
style: default
class: workspace-lifecycle-button
hidden: true
action:
  type: updateMetadata
  bindTarget: lifecycle
  evaluate: false
  value: archived
```
