(() => {
  const PROMOTABLE_TYPES = new Set(["project-note", "workspace-note"]);
  const KNOWLEDGE_ROOT = "11-Knowledge";

  function isPromotableType(value) {
    return PROMOTABLE_TYPES.has(String(value ?? "").trim());
  }

  function destinationPath(sourcePath, root = KNOWLEDGE_ROOT) {
    const name = String(sourcePath ?? "").split("/").pop();
    if (!name || !name.endsWith(".md")) return null;
    return `${String(root).replace(/\/+$/, "")}/${name}`;
  }

  function promotedFrontmatter(frontmatter) {
    const next = { ...(frontmatter ?? {}) };
    next.type = "knowledge-note";
    next.status = "active";
    next.category = null;
    next.maturity = "draft";
    next.source_type = "self";

    delete next.priority;
    delete next.project;
    delete next.workspace;

    return next;
  }

  function applyPromotedFrontmatter(frontmatter) {
    const next = promotedFrontmatter(frontmatter);
    for (const key of Object.keys(frontmatter)) {
      if (!Object.prototype.hasOwnProperty.call(next, key)) delete frontmatter[key];
    }
    for (const [key, value] of Object.entries(next)) frontmatter[key] = value;
    return frontmatter;
  }

  function managedEmbedName(type) {
    if (type === "project-note") return "project-note-meta";
    if (type === "workspace-note") return "workspace-note-meta";
    return null;
  }

  function embedBlockPattern(name) {
    const escaped = String(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(
      "```meta-bind-embed[ \\t]*\\r?\\n[ \\t]*\\[\\[" + escaped + "\\]\\][ \\t]*\\r?\\n```",
      "g"
    );
  }

  function countMatches(content, pattern) {
    return [...String(content ?? "").matchAll(pattern)].length;
  }

  function transformManagedEmbed(content, type) {
    const sourceName = managedEmbedName(type);
    if (!sourceName) {
      return { ok: false, error: `Promotion対象外のtypeです: ${String(type)}` };
    }

    const sourcePattern = embedBlockPattern(sourceName);
    const otherPattern = embedBlockPattern(
      type === "project-note" ? "workspace-note-meta" : "project-note-meta"
    );

    const sourceCount = countMatches(content, sourcePattern);
    const otherCount = countMatches(content, otherPattern);

    if (sourceCount !== 1 || otherCount !== 0) {
      return {
        ok: false,
        error: `managed metadata embedを安全に特定できません: expected=${sourceCount}, conflicting=${otherCount}`
      };
    }

    const replacement = "```meta-bind-embed\n[[knowledge-meta]]\n```";
    return { ok: true, content: String(content).replace(sourcePattern, replacement) };
  }

  function planPromotion({ sourcePath, frontmatter, content, knowledgeRoot = KNOWLEDGE_ROOT }) {
    const type = frontmatter?.type;
    if (!isPromotableType(type)) {
      return { ok: false, error: `Promotion対象外のtypeです: ${String(type ?? "")}` };
    }

    const destination = destinationPath(sourcePath, knowledgeRoot);
    if (!destination) {
      return { ok: false, error: `Destinationを計算できません: ${String(sourcePath ?? "")}` };
    }

    const body = transformManagedEmbed(content, type);
    if (!body.ok) return body;

    return {
      ok: true,
      sourcePath,
      destinationPath: destination,
      frontmatter: promotedFrontmatter(frontmatter),
      content: body.content
    };
  }

  return {
    KNOWLEDGE_ROOT,
    isPromotableType,
    destinationPath,
    promotedFrontmatter,
    applyPromotedFrontmatter,
    managedEmbedName,
    transformManagedEmbed,
    planPromotion
  };
})()
