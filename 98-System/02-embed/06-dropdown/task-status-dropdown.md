**状態:** `VIEW[{status}][text]`
`BUTTON[task-status-todo, task-status-doing, task-status-done, task-status-cancelled]`

```meta-bind-button
id: task-status-todo
label: 未着手
icon: circle
style: default
hidden: true
class: task-status-button
actions:
  - type: updateMetadata
    bindTarget: status
    evaluate: false
    value: todo
  - type: updateMetadata
    bindTarget: completed
    evaluate: true
    value: "null"
```
```meta-bind-button
id: task-status-doing
label: 進行中
icon: play
style: primary
hidden: true
class: task-status-button
actions:
  - type: updateMetadata
    bindTarget: status
    evaluate: false
    value: doing
  - type: updateMetadata
    bindTarget: completed
    evaluate: true
    value: "null"
```
```meta-bind-button
id: task-status-done
label: 完了
icon: circle-check
style: primary
hidden: true
class: task-status-button
actions:
  - type: updateMetadata
    bindTarget: status
    evaluate: false
    value: done
  - type: updateMetadata
    bindTarget: completed
    evaluate: true
    value: "getMetadata('completed') || new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date())"
```
```meta-bind-button
id: task-status-cancelled
label: 中止
icon: circle-x
style: destructive
hidden: true
class: task-status-button
actions:
  - type: updateMetadata
    bindTarget: status
    evaluate: false
    value: cancelled
  - type: updateMetadata
    bindTarget: completed
    evaluate: true
    value: "null"
```
