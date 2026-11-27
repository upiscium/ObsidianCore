`BUTTON[proposal-promote-to-knowledge, proposal-keep-as-idea, proposal-discard]`

```meta-bind-button
id: proposal-promote-to-knowledge
label: Knowledgeに昇格
icon: brain
style: primary
class: oc-action
hidden: true
action:
  type: runTemplaterFile
  templateFile: "98-System/00-command/promote_to_knowledge.md"
```

```meta-bind-button
id: proposal-keep-as-idea
label: Ideaとして保持
icon: lightbulb
style: default
class: oc-action
hidden: true
action:
  type: runTemplaterFile
  templateFile: "98-System/00-command/keep_proposal_as_idea.md"
```

```meta-bind-button
id: proposal-discard
label: 破棄
icon: trash
style: destructive
class: oc-action
hidden: true
action:
  type: runTemplaterFile
  templateFile: "98-System/00-command/discard_proposal.md"
```
