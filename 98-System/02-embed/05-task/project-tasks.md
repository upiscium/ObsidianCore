> [!todo] Active Tasks
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
>   due AS "Due"
> FROM "02-Task"
> WHERE type = "task-pack"
> WHERE project = this.file.name
> WHERE !contains(
>   list("done", "cancelled", "waiting", "blocked", "someday"),
>   status
> )
> SORT
>   choice(due, date(due), date("9999-12-31")) ASC,
>   choice(scheduled, date(scheduled), date("9999-12-31")) ASC,
>   choice(start, date(start), date("9999-12-31")) ASC
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
>   reviewed AS "Reviewed"
> FROM "02-Task"
> WHERE type = "task-pack"
> WHERE
>   project = this.title
>   OR project = this.file.name
>   OR project = this.file.link
> WHERE contains(
>   list("waiting", "blocked"),
>   status
> )
> SORT
>   choice(due, date(due), date("9999-12-31")) ASC,
>   choice(reviewed, date(reviewed), date("9999-12-31")) ASC
> ```
