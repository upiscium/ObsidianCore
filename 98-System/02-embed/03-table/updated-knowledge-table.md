```dataview
TABLE WITHOUT ID
  file.link AS "リンク",
  dateformat(file.mday, "yyyy-MM-dd") AS "最終更新日"
FROM "11-Knowledge"
WHERE file.name != "hub"
WHERE status = null OR (status != "archived" AND status != "deleted")
WHERE file.mtime >= date(today) - dur(7 days)
SORT file.mtime DESC
LIMIT 5
```
