(() => {
  function asArray(value) {
    if (value === null || value === undefined || value === "") return [];
    if (Array.isArray(value)) return value;
    if (typeof value === "object" && value !== null && typeof value.array === "function") {
      return value.array();
    }
    return [value];
  }

  function normalizeLinkpath(value) {
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

  function parseReference(value) {
    if (value && typeof value === "object" && value.path) {
      return {
        path: normalizeLinkpath(value),
        alias: value.display ?? null
      };
    }

    const raw = String(value ?? "").trim();
    return {
      path: normalizeLinkpath(raw),
      alias: raw.match(/\|([^\]]+)\]\]$/)?.[1] ?? null
    };
  }

  function normalizeReferences(value) {
    return asArray(value).map(normalizeLinkpath).filter(Boolean);
  }

  function referenceKeys(value) {
    return normalizeReferences(value).flatMap(path => [path, path.split("/").pop()]);
  }

  function matchesReference(value, target) {
    if (!target) return true;
    const keys = new Set(referenceKeys(value));
    return referenceKeys(target).some(key => keys.has(key));
  }

  function referenceLabel(value) {
    if (!value) return "";
    const ref = parseReference(value);
    return ref.alias ?? ref.path.split("/").pop() ?? "";
  }

  function looksLikeLink(value) {
    if (value && typeof value === "object" && value.path) return true;
    const raw = String(value ?? "").trim();
    return raw.startsWith("[[") && raw.endsWith("]]" );
  }

  function normalizePath(value) {
    return normalizeLinkpath(value).toLowerCase();
  }

  function indexByFilePath(items) {
    const index = new Map();
    for (const item of items) {
      const path = item?.file?.path;
      const basename = item?.file?.basename;
      if (!path || !basename) continue;
      index.set(normalizePath(path), item);
      index.set(normalizePath(String(path).replace(/\.md$/, "")), item);
      index.set(normalizePath(basename), item);
    }
    return index;
  }

  function resolveIndexedReference(value, index) {
    const path = normalizeLinkpath(value);
    if (!path) return null;
    return index.get(normalizePath(path)) ??
      index.get(normalizePath(path.split("/").pop())) ??
      null;
  }

  // Strict diagnostics must not silently pick a duplicate basename or repair a
  // stale qualified path by falling back to its basename. Keep the permissive
  // indexed reader above unchanged for existing callers.
  function inspectReference(value, items, files = items.map(item => item.file)) {
    if (value === null || value === undefined || value === "") {
      return { status: "missing", target: null };
    }
    const objectLink = value && typeof value === "object" && !Array.isArray(value) &&
      typeof value.path === "string";
    if (typeof value !== "string" && !objectLink) {
      return { status: "malformed", target: null };
    }
    const raw = objectLink ? value.path : value.trim();
    const wikiLink = !objectLink && /^\[\[[^\[\]|\r\n]+(?:\|[^\[\]|\r\n]+)?\]\]$/.test(raw);
    if ((!objectLink && !wikiLink && /[\[\]|\r\n]/.test(raw)) ||
        (objectLink && /[\[\]|\r\n]/.test(raw))) {
      return { status: "malformed", target: null };
    }
    const path = normalizePath(objectLink ? raw : value);
    if (!path || path.includes("#")) return { status: "malformed", target: null };
    const qualified = path.includes("/");
    const matches = files.filter(file => qualified
      ? normalizePath(file.path) === path
      : normalizePath(file.basename) === path);
    if (matches.length !== 1) {
      return { status: matches.length ? "ambiguous" : "unresolved", target: null };
    }
    const target = items.find(item => item.file.path === matches[0].path);
    if (!target) return { status: "unresolved", target: null };
    return { status: "resolved", target, legacy: !objectLink && !wikiLink };
  }

  return {
    asArray,
    normalizeLinkpath,
    parseReference,
    normalizeReferences,
    referenceKeys,
    matchesReference,
    referenceLabel,
    looksLikeLink,
    normalizePath,
    indexByFilePath,
    resolveIndexedReference,
    inspectReference
  };
})()
