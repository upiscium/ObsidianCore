(S => (() => {
  if (!S || typeof S.compareFileMtimeDesc !== "function") {
    throw new Error("knowledge_view_utils requires shared view utilities");
  }

  function isRecentStatusVisible(value) {
    const status = String(value ?? "").trim();
    return status !== "archived" && status !== "deleted";
  }

  function isRecentKnowledgeCandidate(page, cutoff, compare) {
    if (!page?.file || page.file.name === "hub") return false;
    if (!isRecentStatusVisible(page.status)) return false;
    return compare(page.file.mtime, cutoff) >= 0;
  }

  function compareRecent(a, b, compare) {
    return S.compareFileMtimeDesc(a, b, compare);
  }

  function selectRecent(pages, { cutoff, compare, limit = 5 }) {
    if (typeof compare !== "function") {
      throw new Error("Knowledge recent view requires compare");
    }
    if (!Number.isInteger(limit) || limit < 0) {
      throw new Error("Knowledge recent view limit must be a non-negative integer");
    }
    return Array.from(pages ?? [])
      .filter(page => isRecentKnowledgeCandidate(page, cutoff, compare))
      .sort((a, b) => compareRecent(a, b, compare))
      .slice(0, limit);
  }

  return Object.freeze({
    isRecentStatusVisible,
    isRecentKnowledgeCandidate,
    compareRecent,
    selectRecent
  });
})())
