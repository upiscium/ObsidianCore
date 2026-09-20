(deps => (() => {
  const { U, R, S } = deps ?? {};
  if (!U || !R || !S || typeof S.compareFileMtimeDesc !== "function") {
    throw new Error("entity_view_utils requires entity metadata, reference, and shared view utilities");
  }

  function workspacePath(workspace) {
    if (typeof workspace === "string") return workspace;
    return workspace?.file?.path ?? null;
  }

  function projectMatchesWorkspace(project, workspace) {
    const target = workspacePath(workspace);
    return Boolean(target && R.matchesReference(project?.workspace, target));
  }

  function projectHasActiveWorkspace(project, workspaces) {
    const workspace = (workspaces ?? []).find(candidate =>
      projectMatchesWorkspace(project, candidate)
    );
    return Boolean(workspace && U.isWorkspaceActiveLifecycle(workspace.lifecycle));
  }

  function projectCountForWorkspace(projects, workspace) {
    return (projects ?? []).filter(project =>
      projectMatchesWorkspace(project, workspace)
    ).length;
  }

  function projectStatusCountsForWorkspace(projects, workspace) {
    const counts = {
      planning: 0,
      running: 0,
      stopped: 0,
      stable: 0
    };

    for (const project of projects ?? []) {
      if (!projectMatchesWorkspace(project, workspace)) continue;
      const status = U.normalizeProjectStatus(project?.status);
      if (Object.prototype.hasOwnProperty.call(counts, status)) {
        counts[status] += 1;
      }
    }

    return counts;
  }

  function formatProjectStatusCounts(counts) {
    return [
      Number(counts?.planning ?? 0),
      Number(counts?.running ?? 0),
      Number(counts?.stopped ?? 0),
      Number(counts?.stable ?? 0)
    ].join(" | ");
  }

  function compareRecent(a, b, compare) {
    return S.compareFileMtimeDesc(a, b, compare);
  }

  function compareHighPriorityProjects(a, b, compare) {
    const statusDelta = U.projectStatusOrder(a?.status) - U.projectStatusOrder(b?.status);
    if (statusDelta !== 0) return statusDelta;
    return compareRecent(a, b, compare);
  }

  function compareWorkspaceRows(a, b, compare) {
    const lifecycleDelta =
      U.workspaceLifecycleOrder(a?.lifecycle) - U.workspaceLifecycleOrder(b?.lifecycle);
    if (lifecycleDelta !== 0) return lifecycleDelta;
    return compareRecent(a, b, compare);
  }

  return Object.freeze({
    workspacePath,
    projectMatchesWorkspace,
    projectHasActiveWorkspace,
    projectCountForWorkspace,
    projectStatusCountsForWorkspace,
    formatProjectStatusCounts,
    compareRecent,
    compareHighPriorityProjects,
    compareWorkspaceRows
  });
})())
