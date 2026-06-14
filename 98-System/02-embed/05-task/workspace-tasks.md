> [!warning] Today
> ```dataview
> TABLE
>   file.link AS "Task",
>   status AS "Status",
>   priority AS "Priority",
>   scheduled AS "Scheduled",
>   due AS "Due",
>   project AS "Project"
> FROM "02-Task"
> WHERE type = "task-pack"
> WHERE workspace = this.title OR workspace = this.file.name
> WHERE !contains(list("done", "cancelled", "waiting", "blocked", "someday"), status)
> WHERE
>   (due AND date(due) = date(today))
>   OR
>   (scheduled AND date(scheduled) = date(today))
> SORT date(due) ASC, date(scheduled) ASC
> ```

> [!todo] Available
> ```dataview
> TABLE
>   file.link AS "Task",
>   status AS "Status",
>   priority AS "Priority",
>   start AS "Start",
>   scheduled AS "Scheduled",
>   due AS "Due",
>   project AS "Project"
> FROM "02-Task"
> WHERE type = "task-pack"
> WHERE workspace = this.title OR workspace = this.file.name
> WHERE !contains(list("done", "cancelled", "waiting", "blocked", "someday"), status)
> WHERE !due OR date(due) > date(today)
> WHERE
>   (scheduled AND date(scheduled) < date(today))
>   OR
>   (start AND date(start) <= date(today))
> WHERE !(scheduled AND date(scheduled) = date(today))
> SORT date(scheduled) ASC, date(start) ASC, date(due) ASC
> ```

> [!info]- Waiting / Blocked
> ```dataview
> TABLE
>   file.link AS "Task",
>   status AS "Status",
>   priority AS "Priority",
>   due AS "Due",
>   project AS "Project"
> FROM "02-Task"
> WHERE type = "task-pack"
> WHERE workspace = this.title OR workspace = this.file.name
> WHERE contains(list("waiting", "blocked"), status)
> SORT date(due) ASC, priority ASC
> ```
