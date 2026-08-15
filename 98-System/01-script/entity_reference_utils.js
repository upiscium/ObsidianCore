(G => (() => {
  if (!G) throw new Error("reference_utils.js is required");

  function findEntityNotes(app, { folder, types, isEligible, isActiveStatus }) {
    if (typeof isEligible !== "function" && typeof isActiveStatus !== "function") {
      throw new Error("isEligible or isActiveStatus is required");
    }
    return app.vault
      .getMarkdownFiles()
      .filter(file => file.path.startsWith(`${folder}/`))
      .map(file => {
        const fm = app.metadataCache.getFileCache(file)?.frontmatter ?? {};
        return {
          file,
          type: String(fm.type ?? "").trim(),
          status: String(fm.status ?? "").trim(),
          lifecycle: String(fm.lifecycle ?? "").trim(),
          displayName: String(fm.title ?? fm.project ?? fm.workspace ?? file.basename).trim(),
          workspace: fm.workspace ?? null
        };
      })
      .filter(entity => types.includes(entity.type))
      .filter(entity => typeof isEligible === "function" ? isEligible(entity) : isActiveStatus(entity.status))
      .sort((a, b) => a.displayName.localeCompare(b.displayName, "ja"));
  }

  function entityMatchesReference(value, entity) {
    if (!entity) return false;
    return G.matchesReference(value, [entity.file.path, entity.file.basename]);
  }

  function makeEntityLink(app, entity, sourcePath) {
    return entity
      ? app.fileManager.generateMarkdownLink(entity.file, sourcePath, undefined, entity.displayName)
      : null;
  }

  return {
    findEntityNotes,
    entityMatchesReference,
    makeEntityLink
  };
})())
