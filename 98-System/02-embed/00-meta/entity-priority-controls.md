**優先度:** `VIEW[{priority}][text]`

`BUTTON[entity-priority-high, entity-priority-medium, entity-priority-low, entity-priority-none]`

```meta-bind-button
id: entity-priority-high
label: 🔴 高
style: default
class: entity-priority-button
hidden: true
action:
  type: updateMetadata
  bindTarget: priority
  evaluate: false
  value: high
```

```meta-bind-button
id: entity-priority-medium
label: 🟡 中
style: default
class: entity-priority-button
hidden: true
action:
  type: updateMetadata
  bindTarget: priority
  evaluate: false
  value: medium
```

```meta-bind-button
id: entity-priority-low
label: 🟢 低
style: default
class: entity-priority-button
hidden: true
action:
  type: updateMetadata
  bindTarget: priority
  evaluate: false
  value: low
```

```meta-bind-button
id: entity-priority-none
label: ▫ 無
style: default
class: entity-priority-button
hidden: true
action:
  type: updateMetadata
  bindTarget: priority
  evaluate: true
  value: "null"
```
