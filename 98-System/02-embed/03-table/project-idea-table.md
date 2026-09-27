```dvjs
await dv.view("98-System/04-view/ideas/idea_table", {
  mode: "active",
  project: dv.current().file.path,
  emptyMessage: "このProjectのActive Ideaはありません。"
});
```
