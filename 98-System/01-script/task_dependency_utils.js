(() => {
  function normalizePath(value) {
    return String(value ?? "").trim();
  }

  function outgoingPaths(path, getOutgoing) {
    const raw = getOutgoing(normalizePath(path));
    if (!Array.isArray(raw)) return [];
    return [...new Set(raw.map(normalizePath).filter(Boolean))];
  }

  function reaches(startPath, targetPath, getOutgoing, visited = new Set()) {
    const start = normalizePath(startPath);
    const target = normalizePath(targetPath);
    if (!start || !target) return false;
    if (start === target) return true;
    if (visited.has(start)) return false;

    visited.add(start);
    return outgoingPaths(start, getOutgoing)
      .some(next => reaches(next, target, getOutgoing, visited));
  }

  function wouldCreateCycle(taskPath, dependencyPath, getOutgoing) {
    const task = normalizePath(taskPath);
    const dependency = normalizePath(dependencyPath);
    if (!task || !dependency) return false;
    if (task === dependency) return true;
    return reaches(dependency, task, getOutgoing, new Set());
  }

  function cycleMembers(paths, getOutgoing) {
    const nodes = [...new Set((Array.isArray(paths) ? paths : []).map(normalizePath).filter(Boolean))];
    const nodeSet = new Set(nodes);
    const members = new Set();
    const knownOutgoing = path => outgoingPaths(path, getOutgoing).filter(next => nodeSet.has(next));

    for (const path of nodes) {
      const cyclic = knownOutgoing(path)
        .some(next => reaches(next, path, knownOutgoing, new Set()));
      if (cyclic) members.add(path);
    }

    return members;
  }

  return {
    reaches,
    wouldCreateCycle,
    cycleMembers
  };
})()
