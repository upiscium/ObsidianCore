(G => (() => {
  const ACTIVE_ENTITY_STATUSES = new Set(["planning", "running"]);

  if (!G) throw new Error("reference_utils.js is required");

  function stripTaskTimestamp(name) {
    return String(name)
      .replace(/^\d{8}-\d{6}-\d{3}-/, "")
      .replace(/^\d{8}-\d{4}-/, "")
      .replace(/^\d{8}_\d{4}_/, "")
      .replace(/^\d{12}[\s_-]+/, "")
      .replace(/^[\s_-]+|[\s_-]+$/g, "")
      .trim();
  }

  function resolveLinkFile(app, value, sourcePath) {
    const linkpath = G.normalizeLinkpath(value);
    if (!linkpath) return null;
    return app.metadataCache.getFirstLinkpathDest(linkpath, sourcePath) ?? null;
  }

  function resolveDataviewPage(dv, value) {
    if (!value) return null;
    const reference = G.parseReference(value);
    if (!reference.path) return null;
    return dv.page(reference.path) ?? dv.page(reference.path.split("/").pop()) ?? null;
  }

  function dataviewReferenceDisplay(dv, value, empty = "-") {
    if (!value) return empty;
    const reference = G.parseReference(value);
    if (!reference.path) return empty;
    const page = resolveDataviewPage(dv, value);
    if (!page) return reference.alias ?? reference.path.split("/").pop() ?? empty;
    return dv.fileLink(page.file.path, false, reference.alias ?? page.file.name);
  }

  function dependencyPages(dv, task) {
    return G.asArray(task?.depends_on).map(raw => ({
      raw,
      page: resolveDataviewPage(dv, raw)
    }));
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

    return {
      blocked: cyclic || unresolved.length > 0 || missing.length > 0,
      cyclic,
      unresolved,
      missing
    };
  }

  function findEntityNotes(app, { folder, types }) {
    return app.vault
      .getMarkdownFiles()
      .filter(file => file.path.startsWith(`${folder}/`))
      .map(file => {
        const fm = app.metadataCache.getFileCache(file)?.frontmatter ?? {};
        return {
          file,
          type: String(fm.type ?? "").trim(),
          status: String(fm.status ?? "").trim(),
          displayName: String(
            fm.title ?? fm.project ?? fm.workspace ?? file.basename
          ).trim(),
          workspace: fm.workspace ?? null
        };
      })
      .filter(entity => types.includes(entity.type) && ACTIVE_ENTITY_STATUSES.has(entity.status))
      .sort((a, b) => a.displayName.localeCompare(b.displayName, "ja"));
  }

  function entityMatchesReference(value, entity) {
    if (!entity) return false;
    return G.matchesReference(value, [entity.file.path, entity.file.basename]);
  }

  function makeEntityLink(app, entity, sourcePath) {
    return entity
      ? app.fileManager.generateMarkdownLink(
          entity.file,
          sourcePath,
          undefined,
          entity.displayName
        )
      : null;
  }

  return {
    asArray: G.asArray,
    stripTaskTimestamp,
    normalizeLinkpath: G.normalizeLinkpath,
    parseReference: G.parseReference,
    normalizeReferences: G.normalizeReferences,
    referenceKeys: G.referenceKeys,
    matchesReference: G.matchesReference,
    referenceLabel: G.referenceLabel,
    resolveLinkFile,
    resolveDataviewPage,
    dataviewReferenceDisplay,
    dependencyPages,
    dependencyHasPathTo,
    dependencyInfo,
    findEntityNotes,
    entityMatchesReference,
    makeEntityLink
  };
})())
