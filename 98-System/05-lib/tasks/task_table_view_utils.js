(deps => (() => {
  const { U, O, E, G } = deps ?? {};
  if (!U || !O || !E || !G) {
    throw new Error("task_table_view_utils requires Task metadata, sort, Entity metadata, and reference utilities");
  }

  function taskTitle(task) {
    return String(task?.title ?? "").trim()
      || U.stripTaskTimestamp(task?.file?.name)
      || task?.file?.name
      || "(untitled)";
  }

  function dateSortKey(value, dv) {
    const date = U.dateOnly(value, dv);
    if (!date) return O.FAR_FUTURE;
    if (typeof date.toFormat === "function") return date.toFormat("yyyy-MM-dd");
    if (typeof date.toISODate === "function") return date.toISODate();
    return String(value).slice(0, 10);
  }

  function projectForTask(task, projects) {
    return (projects ?? []).find(project =>
      G.matchesReference(task?.project, [project.file.path, project.file.name])
    ) ?? null;
  }

  function projectPriorityOrder(task, projects) {
    const project = projectForTask(task, projects);
    return E.priorityOrder(project?.priority ?? null);
  }

  function isPrimary(task, { dv, today, primaryLimit }) {
    if (!U.isTaskActionableStatus(task?.status)) return false;
    if (task?.backlog === true || task?.triaged === false) return false;

    const start = U.dateOnly(task?.start, dv);
    if (start && dv.compare(start, today) > 0) return false;

    const due = U.dateOnly(task?.due, dv);
    if (due && dv.compare(due, today) <= 0) return false;

    const dueWithinTwoWeeks = due && dv.compare(due, primaryLimit) <= 0;
    const highPriority = U.normalizeTaskPriority(task?.priority) === "high";
    return Boolean(dueWithinTwoWeeks || highPriority);
  }

  function taskSortKey(task, { dv, projects }) {
    return {
      taskPriority: U.taskPriorityOrder(task?.priority),
      projectPriority: projectPriorityOrder(task, projects),
      due: dateSortKey(task?.due, dv),
      start: dateSortKey(task?.start, dv),
      title: taskTitle(task)
    };
  }

  return Object.freeze({
    taskTitle,
    dateSortKey,
    projectForTask,
    projectPriorityOrder,
    isPrimary,
    taskSortKey
  });
})())
