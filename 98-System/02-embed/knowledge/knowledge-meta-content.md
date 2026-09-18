> [!info]- メタデータ管理
> **状態:** `VIEW[{status}][text]`
>
> `BUTTON[knowledge-status-active, knowledge-status-outdated, knowledge-status-archived, knowledge-status-deleted]`
>
> ```meta-bind-embed
> [[knowledge-category-dropdown]]
> ```
> ```meta-bind-embed
> [[knowledge-source-dropdown]]
> ```
> **成熟度:** `VIEW[{maturity}][text]`
>
> `BUTTON[knowledge-maturity-seed, knowledge-maturity-draft, knowledge-maturity-verified, knowledge-maturity-stable, knowledge-maturity-none]`

```meta-bind-button
id: knowledge-status-active
label: 有効
icon: circle-check
style: primary
class: knowledge-status-button
hidden: true
action:
  type: updateMetadata
  bindTarget: status
  evaluate: false
  value: active
```

```meta-bind-button
id: knowledge-status-outdated
label: 古い
icon: triangle-alert
style: default
class: knowledge-status-button
hidden: true
action:
  type: updateMetadata
  bindTarget: status
  evaluate: false
  value: outdated
```

```meta-bind-button
id: knowledge-status-archived
label: アーカイブ
icon: archive
style: default
class: knowledge-status-button
hidden: true
action:
  type: updateMetadata
  bindTarget: status
  evaluate: false
  value: archived
```

```meta-bind-button
id: knowledge-status-deleted
label: 削除
icon: trash-2
style: destructive
class: knowledge-status-button
hidden: true
action:
  type: updateMetadata
  bindTarget: status
  evaluate: false
  value: deleted
```

```meta-bind-button
id: knowledge-maturity-seed
label: 🌱 断片
style: default
class: knowledge-maturity-button
hidden: true
action:
  type: updateMetadata
  bindTarget: maturity
  evaluate: false
  value: seed
```

```meta-bind-button
id: knowledge-maturity-draft
label: 📝 下書き
style: default
class: knowledge-maturity-button
hidden: true
action:
  type: updateMetadata
  bindTarget: maturity
  evaluate: false
  value: draft
```

```meta-bind-button
id: knowledge-maturity-verified
label: ✅ 確認済
style: primary
class: knowledge-maturity-button
hidden: true
action:
  type: updateMetadata
  bindTarget: maturity
  evaluate: false
  value: verified
```

```meta-bind-button
id: knowledge-maturity-stable
label: 📌 安定
style: primary
class: knowledge-maturity-button
hidden: true
action:
  type: updateMetadata
  bindTarget: maturity
  evaluate: false
  value: stable
```

```meta-bind-button
id: knowledge-maturity-none
label: ▫ 無
style: default
class: knowledge-maturity-button
hidden: true
action:
  type: updateMetadata
  bindTarget: maturity
  evaluate: true
  value: "null"
```
