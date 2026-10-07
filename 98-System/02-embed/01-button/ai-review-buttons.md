```meta-bind-button
id: approve-ai-candidate
label: Approve
icon: check
style: primary
class: oc-action
hidden: true
action:
  type: updateMetadata
  bindTarget: review_request
  evaluate: false
  value: approve
```

```meta-bind-button
id: reject-ai-candidate
label: Reject
icon: x
style: destructive
class: oc-action
hidden: true
action:
  type: updateMetadata
  bindTarget: review_request
  evaluate: false
  value: reject
```

```meta-bind-button
id: keep-ai-candidate-as-idea
label: Keep as Idea
icon: lightbulb
style: default
class: oc-action
hidden: true
action:
  type: runTemplaterFile
  templateFile: "98-System/00-command/keep_ai_candidate_as_idea.md"
```

`BUTTON[approve-ai-candidate]` `BUTTON[reject-ai-candidate]` `BUTTON[keep-ai-candidate-as-idea]`
