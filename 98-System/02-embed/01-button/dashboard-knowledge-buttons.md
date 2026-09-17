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
style: default
icon: link
label: "Knowledge HUB"
id: open-knowledge-hub
hidden: true
action: 
  type: "open"
  link: "11-Knowledge/hub"
```
`BUTTON[create-knowledge]` `BUTTON[open-knowledge-hub]`
