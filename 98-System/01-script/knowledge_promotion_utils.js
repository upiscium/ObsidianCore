(() => {
  const PROMOTABLE_TYPES = new Set(["project-note", "workspace-note", "idea", "knowledge-proposal"]);
  const KNOWLEDGE_ROOT = "11-Knowledge";
  const MANAGED_EMBEDS = {
    "project-note": "project-note-meta",
    "workspace-note": "workspace-note-meta",
    "idea": "idea-meta",
    // AI proposals written by ObsidianAutomation under 04-AI/Proposals/.
    "knowledge-proposal": "knowledge-proposal-meta"
  };
  // Mirrors the Knowledge note policy allow-lists (knowledge-note-v0).
  const KNOWLEDGE_CATEGORIES = new Set([
    "explanation", "manual", "troubleshooting", "spec", "reference", "summary"
  ]);
  const KNOWLEDGE_SOURCE_TYPES = new Set(["self", "official", "paper", "book", "web", "other"]);

  function isPromotableType(value) {
    return PROMOTABLE_TYPES.has(String(value ?? "").trim());
  }

  function destinationPath(sourcePath, root = KNOWLEDGE_ROOT) {
    const name = String(sourcePath ?? "").split("/").pop();
    if (!name || !name.endsWith(".md")) return null;
    return `${String(root).replace(/\/+$/, "")}/${name}`;
  }

  function promotedFrontmatter(frontmatter) {
    const original = frontmatter ?? {};
    const next = { ...original };
    next.type = "knowledge-note";
    next.status = "active";
    next.maturity = "draft";
    if (original.type === "knowledge-proposal") {
      // The proposal already carries policy-valid classification; keep it
      // when valid so approval is a pure move, never a silent reclassification.
      next.category = KNOWLEDGE_CATEGORIES.has(original.category) ? original.category : null;
      next.source_type = KNOWLEDGE_SOURCE_TYPES.has(original.source_type) ? original.source_type : "self";
    } else {
      next.category = null;
      next.source_type = "self";
    }

    delete next.priority;
    delete next.lifecycle;
    delete next.project;
    delete next.workspace;
    delete next.created;
    delete next.title;

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
    return Object.prototype.hasOwnProperty.call(MANAGED_EMBEDS, type) ? MANAGED_EMBEDS[type] : null;
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
    const sourceCount = countMatches(content, sourcePattern);
    const otherNames = Object.values(MANAGED_EMBEDS)
      .filter(name => name !== sourceName);
    const otherCount = otherNames
      .map(name => countMatches(content, embedBlockPattern(name)))
      .reduce((sum, count) => sum + count, 0);

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
