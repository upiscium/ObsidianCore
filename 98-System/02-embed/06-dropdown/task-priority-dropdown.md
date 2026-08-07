**優先度:** `BUTTON[task-priority-high, task-priority-medium, task-priority-low, task-priority-none]`

```meta-bind-button
id: task-priority-high
label: 🔴 高
style: default
class: task-priority-button
hidden: true
action:
  type: updateMetadata
  bindTarget: priority
  evaluate: false
  value: high
```
```meta-bind-button
id: task-priority-medium
label: 🟡 中
style: default
class: task-priority-button
hidden: true
action:
  type: updateMetadata
  bindTarget: priority
  evaluate: false
  value: medium
```
```meta-bind-button
id: task-priority-low
label: 🟢 低
style: default
class: task-priority-button
hidden: true
action:
  type: updateMetadata
  bindTarget: priority
  evaluate: false
  value: low
```
```meta-bind-button
id: task-priority-none
label: ▫ 無
style: default
class: task-priority-button
hidden: true
action:
  type: updateMetadata
  bindTarget: priority
  evaluate: true
  value: "null"
```