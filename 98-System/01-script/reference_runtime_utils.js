(G => (() => {
  if (!G) throw new Error("reference_utils.js is required");

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

  return {
    resolveLinkFile,
    resolveDataviewPage,
    dataviewReferenceDisplay
  };
})())
