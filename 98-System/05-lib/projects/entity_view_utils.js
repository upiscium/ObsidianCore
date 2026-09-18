(deps => (() => {
  const { U, R } = deps ?? {};
  if (!U || !R) {
    throw new Error("entity_view_utils requires entity metadata and reference utilities");
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

  function compareRecent(a, b, compare) {
    return compare(b?.file?.mtime, a?.file?.mtime);
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
    compareRecent,
    compareHighPriorityProjects,
    compareWorkspaceRows
  });
})())
