> [!check] Upcoming(in 2weeks)
> ```dataview
> TABLE
>   file.link AS "Task",
>   status AS "Status",
>   priority AS "Priority",
>   scheduled AS "Scheduled",
>   due AS "Due",
>   workspace AS "Workspace",
>   project AS "Project"
> FROM "02-Task"
> FLATTEN choice(
>   priority = "urgent", 0,
>   choice(
>     priority = "high", 1,
>     choice(
>       priority = "normal", 2,
>       choice(priority = "low", 3, 9)
>     )
>   )
> ) AS priority_order
> WHERE type = "task-pack"
> WHERE !contains(list("done", "cancelled"), status)
> WHERE scheduled AND date(scheduled) < date(today) + dur(1 day)
> WHERE due AND date(due) > date(today)
> WHERE date(due) < date(today) + dur(15 days)
> SORT priority_order ASC, date(scheduled) ASC, date(due) ASC
> ```
