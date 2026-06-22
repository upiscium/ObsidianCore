> [!warning] Today
> ```dataview
> TABLE WITHOUT ID
>   link(
>     file.path,
>     default(
>       title,
>       regexreplace(file.name, "^[0-9]{8}-[0-9]{4}-", "")
>     )
>   ) AS "Task",
>   status AS "Status",
>   priority AS "Priority",
>   scheduled AS "Scheduled",
>   due AS "Due",
>   project AS "Project"
> FROM "02-Task"
> WHERE type = "task-pack"
> WHERE
>   workspace = this.title
>   OR workspace = this.file.name
>   OR workspace = this.file.link
> WHERE !contains(
>   list("done", "cancelled", "waiting", "blocked", "someday"),
>   status
> )
> WHERE due AND date(due) = date(today)
> SORT
>   choice(scheduled, date(scheduled), date("9999-12-31")) ASC,
>   priority ASC
> ```

> [!todo] Available
> ```dataview
> TABLE WITHOUT ID
>   link(
>     file.path,
>     default(
>       title,
>       regexreplace(file.name, "^[0-9]{8}-[0-9]{4}-", "")
>     )
>   ) AS "Task",
>   status AS "Status",
>   priority AS "Priority",
>   start AS "Start",
>   scheduled AS "Scheduled",
>   due AS "Due",
>   project AS "Project"
> FROM "02-Task"
> WHERE type = "task-pack"
> WHERE
>   workspace = this.title
>   OR workspace = this.file.name
>   OR workspace = this.file.link
> WHERE !contains(
>   list("done", "cancelled", "waiting", "blocked", "someday"),
>   status
> )
> WHERE !due OR date(due) > date(today)
> WHERE
>   (scheduled AND date(scheduled) <= date(today))
>   OR
>   (start AND date(start) <= date(today))
> SORT
>   choice(scheduled, date(scheduled), date("9999-12-31")) ASC,
>   choice(start, date(start), date("9999-12-31")) ASC,
>   choice(due, date(due), date("9999-12-31")) ASC,
>   priority ASC
> ```

> [!info]- Waiting / Blocked
> ```dataview
> TABLE WITHOUT ID
>   link(
>     file.path,
>     default(
>       title,
>       regexreplace(file.name, "^[0-9]{8}-[0-9]{4}-", "")
>     )
>   ) AS "Task",
>   status AS "Status",
>   priority AS "Priority",
>   due AS "Due",
>   project AS "Project"
> FROM "02-Task"
> WHERE type = "task-pack"
> WHERE
>   workspace = this.title
>   OR workspace = this.file.name
>   OR workspace = this.file.link
> WHERE contains(
>   list("waiting", "blocked"),
>   status
> )
> SORT
>   choice(due, date(due), date("9999-12-31")) ASC,
>   priority ASC
> ```
