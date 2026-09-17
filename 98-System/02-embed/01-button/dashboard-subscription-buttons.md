```meta-bind-button
label: "Sync"
icon: refresh-cw
style: primary
id: "sync-subscriptions"
class: oc-action
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
class: oc-action
hidden: true
actions:
  - type: runTemplaterFile
    templateFile: 98-System/00-command/create_subscription.md
```
`BUTTON[sync-subscriptions]` `BUTTON[create-subscription]`
