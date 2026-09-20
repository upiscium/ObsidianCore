# AI HUB
## Overview
```dataviewjs
await dv.view("98-System/04-view/ai/ai_dashboard_summary");
```

## Review Queue
```dataviewjs
await dv.view("98-System/04-view/ai/ai_stage_table", {
  mode: "review",
  emptyMessage: "Review待ちのAI成果物はありません。"
});
```

## Processing
```dataviewjs
await dv.view("98-System/04-view/ai/ai_stage_table", {
  mode: "processing",
  emptyMessage: "処理中のAI成果物はありません。"
});
```

## Delivery
```dataviewjs
await dv.view("98-System/04-view/ai/ai_stage_table", {
  mode: "delivery",
  emptyMessage: "実行・反映中のAI成果物はありません。"
});
```

## Completed
```dataviewjs
await dv.view("98-System/04-view/ai/ai_stage_table", {
  mode: "completed",
  emptyMessage: "完了済みのAI成果物はありません。"
});
```

## Failed
```dataviewjs
await dv.view("98-System/04-view/ai/ai_stage_table", {
  mode: "failed",
  emptyMessage: "失敗中のAI成果物はありません。"
});
```
