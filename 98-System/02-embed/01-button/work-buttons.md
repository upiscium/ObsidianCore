```meta-bind-button
style: primary
icon: clock-3
label: "Add work"
id: add-work
class: oc-action
hidden: true
action:
  type: runTemplaterFile
  templateFile: "98-System/00-command/add_work.md"
```
```meta-bind-button
style: default
icon: settings-2
label: "Workplace settings"
id: manage-workplaces
class: oc-action
hidden: true
action:
  type: runTemplaterFile
  templateFile: "98-System/00-command/manage_workplaces.md"
```
`BUTTON[add-work, manage-workplaces]`
