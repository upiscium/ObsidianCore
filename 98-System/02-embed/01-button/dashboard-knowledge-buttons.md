```meta-bind-button
style: primary
icon: brain
label: "Create knowledge"
id: create-knowledge
class: oc-action
hidden: true
action: 
  type: "runTemplaterFile"
  templateFile: "98-System/00-command/create_knowledge"
```
```meta-bind-button
style: default
icon: link
label: "Knowledge HUB"
id: open-knowledge-hub
class: oc-action
hidden: true
action: 
  type: "open"
  link: "98-System/02-embed/hub/knowledge-hub"
```
`BUTTON[create-knowledge, open-knowledge-hub]`
