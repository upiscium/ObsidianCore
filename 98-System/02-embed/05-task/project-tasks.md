> [!todo] Active Tasks
> ```dataview
> TABLE
>   status AS "Status",
>   priority AS "Priority",
>   start AS "Start",
>   scheduled AS "Scheduled",
>   due AS "Due"
> FROM "02-Task"
> WHERE type = "task-pack"
> WHERE project = this.title OR project = this.file.name
> WHERE !contains(list("done", "cancelled", "waiting", "blocked", "someday"), status)
> SORT date(due) ASC, date(scheduled) ASC, date(start) ASC
> ```

> [!info]- Waiting / Blocked
> ```dataview
> TABLE
>   status AS "Status",
>   priority AS "Priority",
>   due AS "Due",
>   reviewed AS "Reviewed"
> FROM "02-Task"
> WHERE type = "task-pack"
> WHERE project = this.title OR project = this.file.name
> WHERE contains(list("waiting", "blocked"), status)
> SORT date(due) ASC, date(reviewed) ASC
> ```
