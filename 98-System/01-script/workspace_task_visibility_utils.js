((G, E) => (() => {
  if (!G || typeof G.matchesReference !== "function") {
    throw new Error("reference_utils.js is required");
  }
  if (!E || typeof E.isWorkspaceActiveLifecycle !== "function") {
    throw new Error("entity_meta_utils.js is required");
  }

  function workspaceForTask(task, workspaces) {
    if (!task?.workspace) return null;
    return Array.from(workspaces ?? []).find(workspace =>
      workspace?.file?.path && G.matchesReference(task.workspace, workspace.file.path)
    ) ?? null;
  }

  function isTaskOperationallyVisible(task, workspaces) {
    if (!task?.workspace) return true;
    const workspace = workspaceForTask(task, workspaces);
    if (!workspace) return true;
    return E.isWorkspaceActiveLifecycle(workspace.lifecycle);
  }

  return {
    workspaceForTask,
    isTaskOperationallyVisible
  };
})())