```dataview
TABLE WITHOUT ID
  link(ws) AS "Workspace",
  max(rows.file.mtime) AS "最終更新",
  length(rows) AS "更新ファイル数"
FROM ""
WHERE workspace
  AND file.mtime >= date(today) - dur(1 month)
  AND !contains(file.path, "98-System")
  AND !contains(file.name, "hub")
FLATTEN workspace AS ws
GROUP BY ws
SORT max(rows.file.mtime) DESC
```
