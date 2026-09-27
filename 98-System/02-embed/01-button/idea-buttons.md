```meta-bind-button
style: primary
icon: lightbulb
label: "Create Idea"
id: create-idea
class: oc-action
hidden: true
action:
  type: "runTemplaterFile"
  templateFile: "98-System/00-command/create_idea.md"
```
```meta-bind-button
style: default
icon: link
label: "Idea HUB"
id: open-idea-hub
class: oc-action
hidden: true
action:
  type: "open"
  link: "98-System/02-embed/hub/idea-hub"
```
`BUTTON[create-idea, open-idea-hub]`
