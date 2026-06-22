```meta-bind-button
style: primary
icon: brain
label: "Create knowledge"
id: create-knowledge
hidden: true
action: 
  type: "runTemplaterFile"
  templateFile: "98-System/00-command/create_knowledge"
```
```meta-bind-button
style: primary
icon: link
label: "Knowledge HUB"
id: open-knowledge-hub
hidden: true
action: 
  type: "open"
  link: "11-Knowledge/hub"
```
```meta-bind-button
icon: "folder-plus"
style: primary
hidden: true
label: "Create workspace"
id: create-workspace
action:
  type: "runTemplaterFile"
  templateFile: "98-System/00-command/create_workspace"
```
```meta-bind-button
icon: "calendar-days"
style: primary
hidden: true
label: "Monthly note"
id: open-monthly-note
action:
  type: "runTemplaterFile"
  templateFile: "98-System/00-command/open_monthly_note.md"
```
```meta-bind-button
icon: "calendar-days"
style: primary
hidden: true
label: "Daily note"
id: open-daily-note
action:
  type: command
  command: daily-notes
```
```meta-bind-button
label: "Sync"
icon: refresh-cw
style: primary
id: "sync-subscriptions"
hidden: true
actions:
  - type: runTemplaterFile
    templateFile: 98-System/00-command/sync_subscriptions.md
```
```meta-bind-button
label: "Add subscription"
icon: plus
style: primary
id: "create-subscription"
hidden: true
actions:
  - type: runTemplaterFile
    templateFile: 98-System/00-command/create_subscription.md
```
