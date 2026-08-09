(G => (() => {
  if (!G) throw new Error("reference_utils.js is required");

  function blank(value) {
    return value === null || value === undefined || value === "";
  }

  function normalized(value) {
    return G.normalizePath(value);
  }

  function entityKeys(entity) {
    const fm = entity?.fm ?? {};
    const values = [
      entity?.file?.path,
      entity?.file?.path?.replace(/\.md$/, ""),
      entity?.file?.basename,
      fm.title,
      ...(Array.isArray(fm.aliases) ? fm.aliases : [])
    ];
    return [...new Set(values.map(normalized).filter(Boolean))];
  }

  function buildEntityIndex(entities) {
    const index = new Map();
    for (const entity of entities) {
      for (const key of entityKeys(entity)) {
        const matches = index.get(key) ?? [];
        if (!matches.some(item => item.file.path === entity.file.path)) matches.push(entity);
        index.set(key, matches);
      }
    }
    return index;
  }

  function uniqueMatches(matches) {
    const byPath = new Map();
    for (const match of matches ?? []) byPath.set(match.file.path, match);
    return [...byPath.values()];
  }

  function resolveUnique(value, index) {
    if (blank(value)) return { status: "unresolved", matches: [] };
    const path = G.normalizeLinkpath(value);
    const keys = [normalized(path), normalized(path.split("/").pop())].filter(Boolean);
    const matches = uniqueMatches(keys.flatMap(key => index.get(key) ?? []));
    if (matches.length === 1) return { status: "ok", entity: matches[0] };
    if (matches.length > 1) return { status: "ambiguous", matches };
    return { status: "unresolved", matches: [] };
  }

  function buildFolderIndex(entities) {
    const index = new Map();
    for (const entity of entities) {
      const folder = entity?.file?.parent?.path ?? entity?.parentPath ?? null;
      if (!folder) continue;
      const matches = index.get(folder) ?? [];
      matches.push(entity);
      index.set(folder, matches);
    }
    return index;
  }

  function inferUniqueFromFolder(record, folderIndex) {
    const folder = record?.file?.parent?.path ?? record?.parentPath ?? null;
    if (!folder) return { status: "unresolved", matches: [] };
    const matches = uniqueMatches(folderIndex.get(folder) ?? []);
    if (matches.length === 1) return { status: "ok", entity: matches[0] };
    if (matches.length > 1) return { status: "ambiguous", matches };
    return { status: "unresolved", matches: [] };
  }

  function doctorIssueSet(issues) {
    return new Set((issues ?? []).map(item => `${item.path}\u0000${item.field}`));
  }

  function hasIssue(issueSet, record, field) {
    return issueSet.has(`${record.file.path}\u0000${field}`);
  }

  function makeFix({ record, field, target, kind, reason, makeLink }) {
    const before = blank(record.fm[field]) ? null : record.fm[field];
    const after = makeLink(target, record.file.path);
    if (!after) return null;
    if (!blank(before) && String(before) === String(after)) return null;
    return {
      id: `${record.file.path}::${field}::${kind}`,
      path: record.file.path,
      field,
      before,
      after,
      targetPath: target.file.path,
      kind,
      reason
    };
  }

  function planSafeFixes({ records, doctorIssues, makeLink }) {
    if (typeof makeLink !== "function") throw new Error("makeLink is required");
    const issueSet = doctorIssueSet(doctorIssues);
    const workspaces = records.filter(record => record.fm.type === "workspace");
    const projects = records.filter(record => record.fm.type === "project");
    const workspaceIndex = buildEntityIndex(workspaces);
    const projectIndex = buildEntityIndex(projects);
    const workspaceByFolder = buildFolderIndex(workspaces);
    const projectByFolder = buildFolderIndex(projects);
    const fixes = [];
    const plannedFields = new Set();

    function addFix(fix) {
      if (!fix) return null;
      const key = `${fix.path}\u0000${fix.field}`;
      if (plannedFields.has(key)) return fixes.find(item => `${item.path}\u0000${item.field}` === key) ?? null;
      plannedFields.add(key);
      fixes.push(fix);
      return fix;
    }

    function planResolvableRelation(record, field, index, label) {
      if (!hasIssue(issueSet, record, field) || blank(record.fm[field])) return null;
      const resolved = resolveUnique(record.fm[field], index);
      if (resolved.status !== "ok") return null;
      return addFix(makeFix({
        record,
        field,
        target: resolved.entity,
        kind: "canonicalize-relation",
        reason: `${label}参照を一意に解決してcanonical linkへ正規化`,
        makeLink
      }));
    }

    for (const record of records) {
      if (record.fm.type === "project") {
        planResolvableRelation(record, "workspace", workspaceIndex, "Workspace");
      } else if (record.fm.type === "workspace-note") {
        planResolvableRelation(record, "workspace", workspaceIndex, "Workspace");
      } else if (record.fm.type === "project-note" || record.fm.type === "task") {
        planResolvableRelation(record, "workspace", workspaceIndex, "Workspace");
        planResolvableRelation(record, "project", projectIndex, "Project");
      }
    }

    for (const record of records.filter(item => item.fm.type === "workspace-note")) {
      if (!hasIssue(issueSet, record, "workspace") || !blank(record.fm.workspace) || plannedFields.has(`${record.file.path}\u0000workspace`)) continue;
      const inferred = inferUniqueFromFolder(record, workspaceByFolder);
      if (inferred.status !== "ok") continue;
      addFix(makeFix({
        record,
        field: "workspace",
        target: inferred.entity,
        kind: "infer-folder-workspace",
        reason: "親フォルダ内のWorkspace Entryが1件だけなのでrelationを補完",
        makeLink
      }));
    }

    for (const record of records.filter(item => item.fm.type === "project-note")) {
      let effectiveProject = null;
      const currentProject = resolveUnique(record.fm.project, projectIndex);
      if (currentProject.status === "ok") effectiveProject = currentProject.entity;

      if (!effectiveProject && hasIssue(issueSet, record, "project") && blank(record.fm.project)) {
        const inferred = inferUniqueFromFolder(record, projectByFolder);
        if (inferred.status === "ok") {
          effectiveProject = inferred.entity;
          addFix(makeFix({
            record,
            field: "project",
            target: inferred.entity,
            kind: "infer-folder-project",
            reason: "親フォルダ内のProject Entryが1件だけなのでrelationを補完",
            makeLink
          }));
        }
      }

      if (!hasIssue(issueSet, record, "workspace") || !blank(record.fm.workspace) || plannedFields.has(`${record.file.path}\u0000workspace`) || !effectiveProject) continue;
      const projectWorkspace = resolveUnique(effectiveProject.fm.workspace, workspaceIndex);
      if (projectWorkspace.status !== "ok") continue;
      addFix(makeFix({
        record,
        field: "workspace",
        target: projectWorkspace.entity,
        kind: "derive-project-workspace",
        reason: "参照Projectの所属Workspaceが一意なのでWorkspace relationを補完",
        makeLink
      }));
    }

    for (const record of records.filter(item => item.fm.type === "task")) {
      if (!hasIssue(issueSet, record, "workspace") || !blank(record.fm.workspace) || plannedFields.has(`${record.file.path}\u0000workspace`)) continue;
      const project = resolveUnique(record.fm.project, projectIndex);
      if (project.status !== "ok") continue;
      const projectWorkspace = resolveUnique(project.entity.fm.workspace, workspaceIndex);
      if (projectWorkspace.status !== "ok") continue;
      addFix(makeFix({
        record,
        field: "workspace",
        target: projectWorkspace.entity,
        kind: "derive-project-workspace",
        reason: "Taskの参照Project所属Workspaceが一意なのでWorkspace relationを補完",
        makeLink
      }));
    }

    return fixes;
  }

  function applySafeFixToFrontmatter(frontmatter, fix) {
    if (!frontmatter || typeof frontmatter !== "object") throw new Error("frontmatter is required");
    const current = frontmatter[fix.field];
    if (fix.before === null) {
      if (!blank(current)) return false;
    } else if (String(current) !== String(fix.before)) {
      return false;
    }
    frontmatter[fix.field] = fix.after;
    return true;
  }

  return {
    buildEntityIndex,
    resolveUnique,
    inferUniqueFromFolder,
    planSafeFixes,
    applySafeFixToFrontmatter
  };
})())
