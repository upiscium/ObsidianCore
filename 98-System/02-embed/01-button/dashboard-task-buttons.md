```meta-bind-button
style: primary
icon: link
label: "Task Backlog"
id: open-task-backlog
class: oc-action
hidden: true
action: 
  type: "open"
  link: "02-Task/backlog"
```
```meta-bind-button
style: primary
icon: repeat
label: "Create recurring"
id: create-recurring-task
class: oc-action
hidden: true
action:
  type: runTemplaterFile
  templateFile: "98-System/00-command/create_recurring_task.md"
```
```meta-bind-button
style: primary
icon: refresh-cw
label: "Generate recurring"
id: generate-recurring-tasks
class: oc-action
hidden: true
action:
  type: runTemplaterFile
  templateFile: "98-System/00-command/generate_recurring_tasks.md"
```
`BUTTON[open-task-backlog]` 
`BUTTON[create-recurring-task, generate-recurring-tasks]`
