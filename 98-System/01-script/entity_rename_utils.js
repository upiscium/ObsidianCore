(() => {
  const SPECS = Object.freeze({
    project: Object.freeze({
      root: "10-Project",
      relationField: "project",
      label: "Project"
    }),
    workspace: Object.freeze({
      root: "03-Workspace",
      relationField: "workspace",
      label: "Workspace"
    })
  });

  function sanitizeFileName(input) {
    if (!input) return "";
    const name = String(input)
      .trim()
      .replace(/[\\/:*?"<>|#^\[\]]/g, "")
      .replace(/\s+/g, " ");
    if (!name || name === "." || name === "..") return "";
    return name;
  }

  function normalizeReferencePath(value) {
    if (value && typeof value === "object" && value.path) {
      return String(value.path).replace(/\.md$/, "").trim();
    }

    return String(value ?? "")
      .trim()
      .replace(/^["']|["']$/g, "")
      .replace(/^\[\[/, "")
      .replace(/\]\]$/, "")
      .split("|")[0]
      .replace(/\.md$/, "")
      .trim();
  }

  function asArray(value) {
    if (value === undefined || value === null || value === "") return [];
    if (Array.isArray(value)) return value;
    if (typeof value === "object" && value !== null && typeof value.array === "function") {
      return value.array();
    }
    return [value];
  }

  function matchesEntityReference(value, oldEntryPath, oldName) {
    const canonical = String(oldEntryPath ?? "").replace(/\.md$/, "");
    const basename = String(oldName ?? "").trim();
    if (!canonical || !basename) return false;

    return asArray(value).some(item => {
      const path = normalizeReferencePath(item);
      return path === canonical || path === basename;
    });
  }

  function normalizeAliases(value) {
    const raw = Array.isArray(value)
      ? value
      : value === undefined || value === null || value === ""
        ? []
        : [value];

    const out = [];
    const seen = new Set();
    for (const item of raw) {
      const text = String(item ?? "").trim();
      if (!text || seen.has(text)) continue;
      seen.add(text);
      out.push(text);
    }
    return out;
  }

  function nextAliases(existing, oldTitle, oldName, newName) {
    const result = normalizeAliases(existing);
    const seen = new Set(result);
    for (const candidate of [oldTitle, oldName]) {
      const value = String(candidate ?? "").trim();
      if (!value || value === newName || seen.has(value)) continue;
      seen.add(value);
      result.push(value);
    }
    return result;
  }

  function planRename({
    filePath,
    fileBasename,
    type,
    frontmatter,
    rawName,
    pathExists = () => false
  }) {
    const spec = SPECS[String(type ?? "")];
    if (!spec) {
      return { ok: false, reason: "unsupported-type" };
    }

    const oldName = String(fileBasename ?? "").trim();
    const oldFolderPath = `${spec.root}/${oldName}`;
    const oldEntryPath = `${oldFolderPath}/${oldName}.md`;

    if (!oldName || String(filePath ?? "") !== oldEntryPath) {
      return {
        ok: false,
        reason: "noncanonical-entry",
        expectedPath: oldEntryPath
      };
    }

    const uid = String(frontmatter?.uid ?? "").trim();
    if (!uid) {
      return { ok: false, reason: "missing-uid" };
    }

    const newName = sanitizeFileName(rawName);
    if (!newName) {
      return { ok: false, reason: "invalid-name" };
    }

    if (newName === oldName) {
      return { ok: false, reason: "unchanged-name" };
    }

    if (newName.toLocaleLowerCase() === oldName.toLocaleLowerCase()) {
      return { ok: false, reason: "case-only-rename" };
    }

    const newFolderPath = `${spec.root}/${newName}`;
    const newEntryPath = `${newFolderPath}/${newName}.md`;

    if (pathExists(newFolderPath) || pathExists(newEntryPath)) {
      return {
        ok: false,
        reason: "destination-collision",
        newFolderPath,
        newEntryPath
      };
    }

    const oldTitle = String(frontmatter?.title ?? oldName).trim() || oldName;

    return {
      ok: true,
      type,
      label: spec.label,
      relationField: spec.relationField,
      root: spec.root,
      uid,
      oldName,
      newName,
      oldTitle,
      oldFolderPath,
      newFolderPath,
      oldEntryPath,
      newEntryPath,
      nextAliases: nextAliases(frontmatter?.aliases, oldTitle, oldName, newName)
    };
  }

  function mapPathAfterFolderRename(path, oldFolderPath, newFolderPath) {
    const value = String(path ?? "");
    if (value === oldFolderPath) return newFolderPath;
    if (!value.startsWith(`${oldFolderPath}/`)) return value;
    return `${newFolderPath}${value.slice(oldFolderPath.length)}`;
  }

  return Object.freeze({
    SPECS,
    sanitizeFileName,
    normalizeReferencePath,
    matchesEntityReference,
    normalizeAliases,
    nextAliases,
    planRename,
    mapPathAfterFolderRename
  });
})()
