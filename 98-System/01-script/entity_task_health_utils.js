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

  function taskExecutionState(task, {
    today,
    isActionableStatus,
    isBlocked
  }) {
    const todayKey = S.normalizeDateKey(today);
    if (!todayKey) throw new Error("today must be a valid date");
    if (typeof isActionableStatus !== "function") throw new Error("isActionableStatus is required");
    if (typeof isBlocked !== "function") throw new Error("isBlocked is required");
    if (!task || !isActionableStatus(task.status) || task.backlog === true) return null;
    if (isBlocked(task)) return "blocked";
    return isStartReady(task, todayKey) ? "ready" : "future";
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
    let future = 0;
    let nextDue = null;
    let nextStart = null;

    for (const task of active) {
      if (isTodoStatus(task.status)) todo += 1;
      if (isDoingStatus(task.status)) doing += 1;

      const state = taskExecutionState(task, {
        today: todayKey,
        isActionableStatus,
        isBlocked
      });
      if (state === "ready") nextAction += 1;
      if (state === "blocked") blocked += 1;
      if (state === "future") future += 1;

      const start = S.normalizeDateKey(task.start);
      if (start && start > todayKey && compareDateKeys(start, nextStart) < 0) nextStart = start;

      const due = S.normalizeDateKey(task.due);
      if (due && due < todayKey) overdue += 1;
      if (due && due >= todayKey && compareDateKeys(due, nextDue) < 0) nextDue = due;
    }

    return {
      todo,
      doing,
      actionable: active.length,
      blocked,
      overdue,
      nextAction,
      future,
      nextDue,
      nextStart
    };
  }

  function projectExecutionState({ entityStatus, taskSummary, isRunningStatus }) {
    if (typeof isRunningStatus !== "function") throw new Error("isRunningStatus is required");
    if (!isRunningStatus(entityStatus)) return null;

    const nextAction = Number(taskSummary?.nextAction ?? 0);
    const blocked = Number(taskSummary?.blocked ?? 0);
    const future = Number(taskSummary?.future ?? 0);
    const overdue = Number(taskSummary?.overdue ?? 0);

    if (overdue > 0) return "attention";
    if (nextAction > 0 && blocked > 0) return "ready-with-blockers";
    if (nextAction > 0) return "ready";
    if (blocked > 0) return "blocked";
    if (future > 0) return "future";
    return "empty";
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
    const state = projectExecutionState({ entityStatus, taskSummary, isRunningStatus });
    if (!["blocked", "future", "empty"].includes(state)) return null;
    return "⚠️ runningですがNext Actionがありません";
  }

  return {
    isStartReady,
    taskExecutionState,
    summarizeTasks,
    projectExecutionState,
    summarizeProjects,
    projectAttention
  };
})())
