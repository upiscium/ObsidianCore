> [!info]- Task metadata
> **状態:** `VIEW[{status}][text]`
>
> `BUTTON[task-status-todo, task-status-doing, task-status-done, task-status-cancelled]`
>
> **優先度:** `VIEW[{priority}][text]`
>
> `BUTTON[task-priority-high, task-priority-medium, task-priority-low, task-priority-none]`
>
> **整理済み:** `INPUT[toggle:triaged]`
>
> **Start:** `INPUT[datePicker:start]`
>
> **Due:** `INPUT[datePicker:due]`
>
> `BUTTON[task-reschedule]`
>
> **完了日:** `VIEW[{completed}][text]`
>
> **Source:** `VIEW[{source}][text]`
>
> **Workspace:** `VIEW[{workspace}][text]`
>
> **Project:** `VIEW[{project}][text]`
>
> `BUTTON[task-select-context]`

```meta-bind-button
id: task-status-todo
label: 未着手
icon: circle
style: default
class: task-status-button
hidden: true
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
class: task-status-button
hidden: true
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
class: task-status-button
hidden: true
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
class: task-status-button
hidden: true
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

```meta-bind-button
id: task-select-context
label: Workspace / Projectを選択
icon: folder-cog
style: default
hidden: true
action:
  type: runTemplaterFile
  templateFile: "98-System/00-command/select_task_context.md"
```

```meta-bind-button
id: task-reschedule
label: 日程を変更
icon: calendar-clock
style: default
hidden: true
action:
  type: runTemplaterFile
  templateFile: "98-System/00-command/reschedule_task.md"
```

```meta-bind-button
id: task-add-dependency
label: 依存Taskを追加
icon: link
style: default
hidden: true
action:
  type: runTemplaterFile
  templateFile: "98-System/00-command/add_task_dependency.md"
```

```meta-bind-button
id: task-remove-dependency
label: 依存Taskを削除
icon: unlink
style: default
hidden: true
action:
  type: runTemplaterFile
  templateFile: "98-System/00-command/remove_task_dependency.md"
```
