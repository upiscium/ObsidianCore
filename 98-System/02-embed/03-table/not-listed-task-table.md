> [!abstract]- Not listed
> ```dataview
> TABLE
>   file.link AS "Task",
>   status AS "Status",
>   priority AS "Priority",
>   workspace AS "Workspace",
>   project AS "Project",
>   created AS "Created"
> FROM "02-Task"
> WHERE type = "task-pack"
> WHERE !contains(list("done", "cancelled"), status)
> WHERE !due
> WHERE !scheduled
> SORT date(created) DESC, file.ctime DESC
> ```