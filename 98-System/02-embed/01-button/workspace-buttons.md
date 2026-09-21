```meta-bind-button
label: "Create note"
icon: "file-plus"
style: primary
class: oc-action
hidden: true
id: create-workspace-note
action:
  type: "runTemplaterFile"
  templateFile: "98-System/00-command/create_workspace_note"
```
```meta-bind-button
style: primary
class: oc-action
icon: link
label: "Project HUB"
id: open-project-hub
hidden: true
action: 
  type: "open"
  link: "98-System/02-embed/hub/project-hub"
```
```meta-bind-button
label: "Create project"
icon: "folder-plus"
style: primary
class: oc-action
hidden: true
id: create-workspace-project
action:
  type: "runTemplaterFile"
  templateFile: "98-System/00-command/create_workspace_project"
```
