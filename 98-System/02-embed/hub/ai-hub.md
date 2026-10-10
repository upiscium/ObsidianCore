# AI HUB
## Overview
```dvjs
await dv.view("98-System/04-view/ai/ai_dashboard_summary");
```

## Review Queue
```dvjs
await dv.view("98-System/04-view/ai/ai_stage_table", {
  mode: "review",
  emptyMessage: "Review待ちのAI成果物はありません。"
});
```

## Processing
```dvjs
await dv.view("98-System/04-view/ai/ai_stage_table", {
  mode: "processing",
  emptyMessage: "処理中のAI成果物はありません。"
});
```

## Delivery
> [!appendix]- 実行・反映中の成果物
> ```dvjs
> await dv.view("98-System/04-view/ai/ai_stage_table", {
  > mode: "delivery",
  > emptyMessage: "実行・反映中のAI成果物はありません。"
> });
> ```

## Completed
> [!info]- 完了済みの成果物
> ```dvjs
> await dv.view("98-System/04-view/ai/ai_stage_table", {
  > mode: "completed",
  > emptyMessage: "完了済みのAI成果物はありません。"
> });
> ```

## Rejected
> [!info]- Validationで却下された生成候補（Acknowledge可能）
> ```dvjs
> await dv.view("98-System/04-view/ai/ai_stage_table", {
  > mode: "rejected",
  > emptyMessage: "確認待ちのRejected候補はありません。"
> });
> ```

## Failed
> [!error]- 失敗した成果物
> ```dvjs
>await dv.view("98-System/04-view/ai/ai_stage_table", {
  >mode: "failed",
  >emptyMessage: "失敗中のAI成果物はありません。"
>});
>```
