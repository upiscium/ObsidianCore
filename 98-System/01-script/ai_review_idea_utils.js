(() => {
  const KNOWLEDGE_ROOT = "11-Knowledge";
  const IDEA_ROOT = "05-Idea";
  const SHA256 = /^[0-9a-f]{64}$/;

  function requireSha(value, label) {
    const text = String(value ?? "").trim();
    if (!SHA256.test(text)) throw new Error(`${label}が不正です`);
    return text;
  }

  function ideaTitleFromTarget(targetPath) {
    const target = String(targetPath ?? "");
    const prefix = `${KNOWLEDGE_ROOT}/`;
    if (!target.startsWith(prefix) || !target.endsWith(".md")) {
      throw new Error("AI candidate targetがKnowledge直下のMarkdownではありません");
    }
    const relative = target.slice(prefix.length, -3);
    if (!relative || relative.includes("/") || relative === "." || relative === "..") {
      throw new Error("AI candidate titleを安全に導出できません");
    }
    return relative;
  }

  function extractCandidateMarkdown(reviewContent) {
    const text = String(reviewContent ?? "").replace(/\r\n/g, "\n");
    if (text.includes("\r")) throw new Error("Review projectionにlone CRがあります");

    const marker = "\n## Candidate\n";
    const markerIndex = text.indexOf(marker);
    if (markerIndex < 0) throw new Error("Review projectionにCandidate sectionがありません");

    const lines = text.slice(markerIndex + marker.length).split("\n");
    let openIndex = 0;
    while (openIndex < lines.length && lines[openIndex].trim() === "") openIndex += 1;
    if (openIndex >= lines.length) throw new Error("Candidate code fenceがありません");

    const match = lines[openIndex].match(/^(`{3,})markdown[ \t]*$/);
    if (!match) throw new Error("Candidate code fenceがcanonical Markdown形式ではありません");
    const fence = match[1];

    let closeIndex = openIndex + 1;
    while (closeIndex < lines.length && lines[closeIndex].trim() !== fence) closeIndex += 1;
    if (closeIndex >= lines.length) throw new Error("Candidate code fenceが閉じていません");

    const candidate = lines.slice(openIndex + 1, closeIndex).join("\n");
    if (!candidate.trim()) throw new Error("Candidateが空です");
    return candidate;
  }

  function stripKnowledgeEnvelope(candidate) {
    const text = String(candidate ?? "").replace(/\r\n/g, "\n");
    if (!text.startsWith("---\n")) {
      throw new Error("CandidateにKnowledge frontmatterがありません");
    }
    const close = text.indexOf("\n---\n", 4);
    if (close < 0) throw new Error("Candidate frontmatterが閉じていません");

    const frontmatter = text.slice(4, close).split("\n");
    if (!frontmatter.some(line => line.trim() === "type: knowledge-note")) {
      throw new Error("Candidateはknowledge-noteではありません");
    }

    let body = text.slice(close + 5).replace(/^\n+/, "");
    body = body.replace(
      /^\`\`\`meta-bind-embed[ \t]*\n[ \t]*\[\[(?:98-System\/02-embed\/00-meta\/)?knowledge-meta(?:\|knowledge-meta)?\]\][ \t]*\n\`\`\`[ \t]*\n*/m,
      ""
    );
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
    caseId,
    proposalSha256,
    evaluationSha256,
    mutationSha256,
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
      "origin: ai-pipeline",
      `ai_case_id: ${requireSha(caseId, "ai_case_id")}`,
      `ai_source_proposal_sha256: ${requireSha(proposalSha256, "proposal_sha256")}`,
      `ai_source_evaluation_sha256: ${requireSha(evaluationSha256, "evaluation_sha256")}`,
      `ai_source_mutation_sha256: ${requireSha(mutationSha256, "mutation_sha256")}`,
      "---",
      "```meta-bind-embed",
      "[[idea-meta]]",
      "```",
      "",
      normalizedBody.trimEnd(),
      "",
    ].join("\n");
  }

  return {
    KNOWLEDGE_ROOT,
    IDEA_ROOT,
    requireSha,
    ideaTitleFromTarget,
    extractCandidateMarkdown,
    stripKnowledgeEnvelope,
    buildIdeaContent,
  };
})()
