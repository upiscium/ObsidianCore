((G, X) => (() => {
  if (!G) throw new Error("reference_utils.js is required");
  if (!X) throw new Error("reference_runtime_utils.js is required");

  function dependencyPages(dv, task) {
    return G.asArray(task?.depends_on).map(raw => ({ raw, page: X.resolveDataviewPage(dv, raw) }));
  }

  function dependencyHasPathTo(dv, task, targetPath, visited = new Set()) {
    const path = String(task?.file?.path ?? "");
    if (!path) return false;
    if (path === targetPath) return true;
    if (visited.has(path)) return false;
    visited.add(path);
    return dependencyPages(dv, task)
      .filter(item => item.page)
      .some(item => dependencyHasPathTo(dv, item.page, targetPath, visited));
  }

  function dependencyInfo(dv, task, isClosedStatus) {
    const dependencies = dependencyPages(dv, task);
    const unresolved = [];
    const missing = [];
    for (const dependency of dependencies) {
      if (!dependency.page) {
        missing.push(G.referenceLabel(dependency.raw) || "不明");
        continue;
      }
      if (!isClosedStatus(dependency.page.status)) unresolved.push(dependency.page);
    }
    const cyclic = dependencies
      .filter(item => item.page)
      .some(item => dependencyHasPathTo(dv, item.page, task.file.path, new Set()));
    return { blocked: cyclic || unresolved.length > 0 || missing.length > 0, cyclic, unresolved, missing };
  }

  return {
    dependencyPages,
    dependencyHasPathTo,
    dependencyInfo
  };
})())
