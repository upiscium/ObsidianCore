```meta-bind-button
icon: "calendar-days"
style: default
class: oc-action
hidden: true
label: "Daily note"
id: open-daily-note
action:
  type: command
  command: daily-notes
```
```meta-bind-button
icon: "calendar-days"
style: default
class: oc-action
hidden: true
label: "Monthly note"
id: open-monthly-note
action:
  type: "runTemplaterFile"
  templateFile: "98-System/00-command/open_monthly_note.md"
```
`BUTTON[open-daily-note, open-monthly-note]`
