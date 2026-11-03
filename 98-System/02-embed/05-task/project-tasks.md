> [!danger]- Overdue
> ```dvjs
> await dv.view("98-System/04-view/tasks/task_table", {
>   mode: "overdue",
>   project: dv.current().file.link,
>   emptyMessage: "期限切れのTaskはありません。"
> });
> ```

> [!warning]- Today
> ```dvjs
> await dv.view("98-System/04-view/tasks/task_table", {
>   mode: "today",
>   project: dv.current().file.link,
>   emptyMessage: "今日が期限のTaskはありません。"
> });
> ```

> [!todo] Primary
> ```dvjs
> await dv.view("98-System/04-view/tasks/task_table", {
>   mode: "primary",
>   project: dv.current().file.link,
>   emptyMessage: "表示対象のTaskはありません。"
> });
> ```

> [!success]- Completed
> ```dvjs
> await dv.view("98-System/04-view/tasks/task_table", {
>   mode: "completed",
>   project: dv.current().file.link,
>   emptyMessage: "完了済みのTaskはありません。"
> });
> ```

> [!inbox]- Inbox
> ```dvjs
> await dv.view("98-System/04-view/tasks/task_table", {
>   mode: "inbox",
>   project: dv.current().file.link,
>   emptyMessage: "未整理のTaskはありません。"
> });
> ```
