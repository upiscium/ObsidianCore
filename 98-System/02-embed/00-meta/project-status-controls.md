**状態:** `VIEW[{status}][text]`

`BUTTON[entity-status-planning, entity-status-running, entity-status-stopped, entity-status-done, entity-status-cancelled]`

```meta-bind-button
id: entity-status-planning
label: 計画
icon: clipboard-list
style: default
class: project-status-button
hidden: true
action:
  type: updateMetadata
  bindTarget: status
  evaluate: false
  value: planning
```

```meta-bind-button
id: entity-status-running
label: 進行中
icon: play
style: primary
class: project-status-button
hidden: true
action:
  type: updateMetadata
  bindTarget: status
  evaluate: false
  value: running
```

```meta-bind-button
id: entity-status-stopped
label: 停止
icon: pause
style: default
class: project-status-button
hidden: true
action:
  type: updateMetadata
  bindTarget: status
  evaluate: false
  value: stopped
```

```meta-bind-button
id: entity-status-done
label: 完了
icon: circle-check
style: primary
class: project-status-button
hidden: true
action:
  type: updateMetadata
  bindTarget: status
  evaluate: false
  value: done
```

```meta-bind-button
id: entity-status-cancelled
label: キャンセル
icon: circle-x
style: destructive
class: project-status-button
hidden: true
action:
  type: updateMetadata
  bindTarget: status
  evaluate: false
  value: cancelled
```
