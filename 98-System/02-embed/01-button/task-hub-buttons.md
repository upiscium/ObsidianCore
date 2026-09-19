```meta-bind-button
style: primary
icon: repeat
label: "Create recurring"
id: hub-create-recurring-task
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
id: hub-generate-recurring-tasks
class: oc-action
hidden: true
action:
  type: runTemplaterFile
  templateFile: "98-System/00-command/generate_recurring_tasks.md"
```
`BUTTON[hub-create-recurring-task, hub-generate-recurring-tasks]`
