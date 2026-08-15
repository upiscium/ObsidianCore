(S => (() => {
  if (!S || typeof S.normalizeDateKey !== "function") {
    throw new Error("task_schedule_utils.js is required");
  }

  function compareDateKeys(a, b) {
    if (a === b) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return a < b ? -1 : 1;
  }

  function isStartReady(task, today) {
    const start = S.normalizeDateKey(task?.start);
    if (!start) return true;
    return start <= today;
  }

  function summarizeTasks(tasks, {
    today,
    isTodoStatus,
    isDoingStatus,
    isActionableStatus,
    isBlocked
  }) {
    const todayKey = S.normalizeDateKey(today);
    if (!todayKey) throw new Error("today must be a valid date");
    if (typeof isTodoStatus !== "function") throw new Error("isTodoStatus is required");
    if (typeof isDoingStatus !== "function") throw new Error("isDoingStatus is required");
    if (typeof isActionableStatus !== "function") throw new Error("isActionableStatus is required");
    if (typeof isBlocked !== "function") throw new Error("isBlocked is required");

    const active = Array.from(tasks ?? []).filter(task =>
      task && isActionableStatus(task.status) && task.backlog !== true
    );

    let todo = 0;
    let doing = 0;
    let blocked = 0;
    let overdue = 0;
    let nextAction = 0;
    let nextDue = null;

    for (const task of active) {
      if (isTodoStatus(task.status)) todo += 1;
      if (isDoingStatus(task.status)) doing += 1;

      const taskBlocked = Boolean(isBlocked(task));
      if (taskBlocked) blocked += 1;

      const due = S.normalizeDateKey(task.due);
      if (due && due < todayKey) overdue += 1;
      if (due && due >= todayKey && compareDateKeys(due, nextDue) < 0) nextDue = due;

      if (!taskBlocked && isStartReady(task, todayKey)) nextAction += 1;
    }

    return {
      todo,
      doing,
      actionable: active.length,
      blocked,
      overdue,
      nextAction,
      nextDue
    };
  }

  function summarizeProjects(projects, taskSummaryForProject, isActiveProjectStatus, isRunningProjectStatus) {
    if (typeof taskSummaryForProject !== "function") throw new Error("taskSummaryForProject is required");
    if (typeof isActiveProjectStatus !== "function") throw new Error("isActiveProjectStatus is required");
    if (typeof isRunningProjectStatus !== "function") throw new Error("isRunningProjectStatus is required");

    const activeProjects = Array.from(projects ?? []).filter(project => isActiveProjectStatus(project?.status));
    let runningWithoutNextAction = 0;

    for (const project of activeProjects) {
      if (!isRunningProjectStatus(project.status)) continue;
      const summary = taskSummaryForProject(project);
      if (!summary || Number(summary.nextAction ?? 0) === 0) runningWithoutNextAction += 1;
    }

    return {
      active: activeProjects.length,
      runningWithoutNextAction
    };
  }

  function projectAttention({ entityStatus, taskSummary, isRunningStatus }) {
    if (typeof isRunningStatus !== "function") throw new Error("isRunningStatus is required");
    if (!isRunningStatus(entityStatus)) return null;
    if (Number(taskSummary?.nextAction ?? 0) > 0) return null;
    return "⚠️ runningですがNext Actionがありません";
  }

  return {
    isStartReady,
    summarizeTasks,
    summarizeProjects,
    projectAttention
  };
})())
