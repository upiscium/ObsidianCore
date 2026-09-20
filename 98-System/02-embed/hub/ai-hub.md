# AI HUB
## Overview
```dataviewjs
await dv.view("98-System/04-view/ai/ai_dashboard_summary");
```

## Review Queue
```dataviewjs
await dv.view("98-System/04-view/ai/ai_stage_table", {
  sources: ["03-AI/50-Review"],
  emptyMessage: "Review待ちのAI成果物はありません。"
});
```

## Processing
```dataviewjs
await dv.view("98-System/04-view/ai/ai_stage_table", {
  sources: [
    "03-AI/00-Input",
    "03-AI/10-Context",
    "03-AI/20-Generation",
    "03-AI/30-Validation",
    "03-AI/40-Evaluation"
  ],
  emptyMessage: "処理中のAI成果物はありません。"
});
```

## Delivery
```dataviewjs
await dv.view("98-System/04-view/ai/ai_stage_table", {
  sources: ["03-AI/60-Execution", "03-AI/70-Transport"],
  emptyMessage: "実行・反映中のAI成果物はありません。"
});
```

## Completed
```dataviewjs
await dv.view("98-System/04-view/ai/ai_stage_table", {
  sources: ["03-AI/80-Completed"],
  emptyMessage: "完了済みのAI成果物はありません。"
});
```

## Failed
```dataviewjs
await dv.view("98-System/04-view/ai/ai_stage_table", {
  sources: ["03-AI/90-Failed"],
  emptyMessage: "失敗中のAI成果物はありません。"
});
```
