# AI HUB
## 提案（承認待ち）
```dvjs
await dv.view("98-System/04-view/ai/proposal_table", {
  emptyMessage: "承認待ちの提案はありません。"
});
```

> [!info]- 旧AIパイプライン（参考）
> 以前の自動処理の記録です。通常は見る必要はありません。
> ```dvjs
> await dv.view("98-System/04-view/ai/ai_dashboard_summary");
> ```
> **Review Queue**
> ```dvjs
> await dv.view("98-System/04-view/ai/ai_stage_table", {
>   mode: "review",
>   emptyMessage: "Review待ちのAI成果物はありません。"
> });
> ```
> **Processing**
> ```dvjs
> await dv.view("98-System/04-view/ai/ai_stage_table", {
>   mode: "processing",
>   emptyMessage: "処理中のAI成果物はありません。"
> });
> ```
> **Delivery**
> ```dvjs
> await dv.view("98-System/04-view/ai/ai_stage_table", {
>   mode: "delivery",
>   emptyMessage: "実行・反映中のAI成果物はありません。"
> });
> ```
> **Completed**
> ```dvjs
> await dv.view("98-System/04-view/ai/ai_stage_table", {
>   mode: "completed",
>   emptyMessage: "完了済みのAI成果物はありません。"
> });
> ```
> **Failed**
> ```dvjs
> await dv.view("98-System/04-view/ai/ai_stage_table", {
>   mode: "failed",
>   emptyMessage: "失敗中のAI成果物はありません。"
> });
> ```
