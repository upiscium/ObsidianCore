(() => {
  const FAR_FUTURE = "9999-12-31";

  function rank(value) {
    return Number.isFinite(value) ? value : 999;
  }

  function dateKey(value) {
    const key = String(value ?? "").trim();
    return key || FAR_FUTURE;
  }

  function compareTaskSortKeys(a, b) {
    const taskPriority = rank(a?.taskPriority) - rank(b?.taskPriority);
    if (taskPriority !== 0) return taskPriority;

    const projectPriority = rank(a?.projectPriority) - rank(b?.projectPriority);
    if (projectPriority !== 0) return projectPriority;

    const due = dateKey(a?.due).localeCompare(dateKey(b?.due));
    if (due !== 0) return due;

    const start = dateKey(a?.start).localeCompare(dateKey(b?.start));
    if (start !== 0) return start;

    return String(a?.title ?? "").localeCompare(String(b?.title ?? ""), "ja");
  }

  return {
    FAR_FUTURE,
    compareTaskSortKeys
  };
})()
