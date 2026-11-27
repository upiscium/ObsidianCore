(() => {
  const PROPOSAL_ROOT = "04-AI/Proposals";
  const IDEA_ROOT = "05-Idea";
  const PROPOSAL_TYPE = "knowledge-proposal";
  const SHA256 = /^[0-9a-f]{64}$/;
  const PROVENANCE = /^<!-- oa-proposal: (\{.*\}) -->[ \t]*$/;
  const PROPOSAL_EMBED =
    /^\`\`\`meta-bind-embed[ \t]*\n[ \t]*\[\[(?:98-System\/02-embed\/00-meta\/)?knowledge-proposal-meta(?:\|knowledge-proposal-meta)?\]\][ \t]*\n\`\`\`[ \t]*\n*/m;

  function requireSha(value, label) {
    const text = String(value ?? "").trim();
    if (!SHA256.test(text)) throw new Error(`${label}が不正です`);
    return text;
  }

  // Only a Markdown file directly inside 04-AI/Proposals/ is a proposal note.
  function isProposalPath(path) {
    const value = String(path ?? "");
    const prefix = `${PROPOSAL_ROOT}/`;
    if (!value.startsWith(prefix) || !value.endsWith(".md")) return false;
    const name = value.slice(prefix.length, -3);
    return Boolean(name) && !name.includes("/") && name !== "." && name !== "..";
  }

  function isProposalNote(path, frontmatter) {
    return isProposalPath(path) && String(frontmatter?.type ?? "").trim() === PROPOSAL_TYPE;
  }

  function ideaTitleFromPath(path) {
    if (!isProposalPath(path)) throw new Error("提案ノートのパスではありません");
    return String(path).slice(`${PROPOSAL_ROOT}/`.length, -3);
  }

  // The provenance comment is the last non-blank line written by ObsidianAutomation.
  function parseProvenance(content) {
    const lines = String(content ?? "").replace(/\r\n/g, "\n").split("\n");
    let index = lines.length - 1;
    while (index >= 0 && lines[index].trim() === "") index -= 1;
    const match = index >= 0 ? lines[index].match(PROVENANCE) : null;
    if (!match) throw new Error("提案の出所の記録が見つかりません");
    let record;
    try {
      record = JSON.parse(match[1]);
    } catch (error) {
      throw new Error("提案の出所の記録を読み取れません");
    }
    if (!record || typeof record !== "object" || Array.isArray(record)) {
      throw new Error("提案の出所の記録が不正です");
    }
    return {
      sourceSha256: requireSha(record.source_sha256, "source_sha256"),
      generationSha256: requireSha(record.generation_sha256, "generation_sha256"),
      lineIndex: index,
    };
  }

  // Remove everything that belongs to the proposal workflow; keep the note body.
  function stripProposalEnvelope(content) {
    const text = String(content ?? "").replace(/\r\n/g, "\n");
    if (text.includes("\r")) throw new Error("提案ノートにlone CRがあります");
    if (!text.startsWith("---\n")) throw new Error("提案ノートにfrontmatterがありません");
    const close = text.indexOf("\n---\n", 4);
    if (close < 0) throw new Error("提案ノートのfrontmatterが閉じていません");
    const frontmatter = text.slice(4, close).split("\n");
    if (!frontmatter.some(line => line.trim() === `type: ${PROPOSAL_TYPE}`)) {
      throw new Error("knowledge-proposalではありません");
    }

    parseProvenance(text); // the trailing record must be present and valid
    const lines = text.slice(close + 5).split("\n");
    let last = lines.length - 1;
    while (last >= 0 && lines[last].trim() === "") last -= 1;
    if (last < 0 || !PROVENANCE.test(lines[last])) {
      throw new Error("提案の出所の記録が末尾にありません");
    }

    let body = lines.slice(0, last).join("\n").replace(/^\n+/, "");
    if (!PROPOSAL_EMBED.test(body)) throw new Error("提案の承認用の埋め込みが見つかりません");
    body = body.replace(PROPOSAL_EMBED, "");
    if (!body.trim()) throw new Error("Ideaとして保存する本文が空です");
    return body.replace(/\s+$/, "") + "\n";
  }

  function yamlString(value) {
    return JSON.stringify(String(value ?? ""));
  }

  function buildIdeaContent({
    title,
    created,
    workspace,
    project = null,
    sourceSha256,
    generationSha256,
    body,
  }) {
    const safeTitle = String(title ?? "").trim();
    const safeDate = String(created ?? "").trim();
    const safeWorkspace = String(workspace ?? "").trim();
    if (!safeTitle) throw new Error("Idea titleが空です");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(safeDate)) throw new Error("Idea createdが不正です");
    if (!safeWorkspace) throw new Error("Idea Workspaceが空です");

    const normalizedBody = String(body ?? "").replace(/\r\n/g, "\n");
    if (!normalizedBody.trim() || normalizedBody.includes("\r")) {
      throw new Error("Idea bodyが不正です");
    }

    return [
      "---",
      "type: idea",
      `title: ${yamlString(safeTitle)}`,
      `created: ${safeDate}`,
      `workspace: ${yamlString(safeWorkspace)}`,
      `project: ${project ? yamlString(project) : ""}`,
      "status: active",
      "aliases: []",
      "tags: []",
      "origin: ai-proposal",
      `ai_proposal_source_sha256: ${requireSha(sourceSha256, "source_sha256")}`,
      `ai_proposal_generation_sha256: ${requireSha(generationSha256, "generation_sha256")}`,
      "---",
      "```meta-bind-embed",
      "[[idea-meta]]",
      "```",
      "",
      normalizedBody.trimEnd(),
      "",
    ].join("\n");
  }

  // Pure planning step: everything that can be decided without touching the Vault.
  function planIdeaConversion({ sourcePath, frontmatter, content, created, workspace, project = null }) {
    try {
      if (!isProposalNote(sourcePath, frontmatter)) {
        return { ok: false, error: "04-AI/Proposals直下のknowledge-proposalではありません" };
      }
      const provenance = parseProvenance(content);
      const body = stripProposalEnvelope(content);
      const title = ideaTitleFromPath(sourcePath);
      return {
        ok: true,
        title,
        sourceSha256: provenance.sourceSha256,
        generationSha256: provenance.generationSha256,
        content: buildIdeaContent({
          title,
          created,
          workspace,
          project,
          sourceSha256: provenance.sourceSha256,
          generationSha256: provenance.generationSha256,
          body,
        }),
      };
    } catch (error) {
      return { ok: false, error: String(error?.message ?? error) };
    }
  }

  return {
    PROPOSAL_ROOT,
    IDEA_ROOT,
    PROPOSAL_TYPE,
    requireSha,
    isProposalPath,
    isProposalNote,
    ideaTitleFromPath,
    parseProvenance,
    stripProposalEnvelope,
    buildIdeaContent,
    planIdeaConversion,
  };
})()
