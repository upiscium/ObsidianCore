```meta-bind-button
icon: "folder-plus"
style: primary
class: oc-action
hidden: true
label: "Create workspace"
id: create-workspace
action:
  type: "runTemplaterFile"
  templateFile: "98-System/00-command/create_workspace"
```
```meta-bind-button
icon: "link"
style: default
class: oc-action
hidden: true
label: "Project HUB"
id: open-project-hub
action:
  type: "open"
  link: "10-Project/hub"
```
`BUTTON[create-workspace, open-project-hub]`
