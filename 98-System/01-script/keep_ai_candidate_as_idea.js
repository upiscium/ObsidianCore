module.exports = async function keepAiCandidateAsIdea(tp) {
  const activeFile = app.workspace.getActiveFile();
  if (!activeFile || activeFile.extension !== "md") {
    new Notice("AI Human Reviewを開いてから実行してください。");
    return { status: "rejected", reason: "no-active-review" };
  }

  const frontmatter = app.metadataCache.getFileCache(activeFile)?.frontmatter ?? {};
  if (
    frontmatter.type !== "ai-pipeline-projection"
    || frontmatter.ai_stage !== "review"
    || !activeFile.path.startsWith("04-AI/50-Review/")
  ) {
    new Notice("現在のファイルはAI Human Reviewではありません。");
    return { status: "rejected", reason: "not-review-projection" };
  }

  const currentRequest = normalizeOptional(frontmatter.review_request);
  if (currentRequest && currentRequest !== "keep_as_idea") {
    new Notice(`Review requestは既に${currentRequest}です。`);
    return { status: "rejected", reason: "review-already-decided" };
  }

  const U = await loadExpression("98-System/01-script/ai_review_idea_utils.js");
  const { ER, E } = await loadEntityUtils();

  const caseId = U.requireSha(frontmatter.ai_case_id, "ai_case_id");
  const proposalSha = U.requireSha(frontmatter.proposal_sha256, "proposal_sha256");
  const evaluationSha = U.requireSha(frontmatter.evaluation_sha256, "evaluation_sha256");
  const mutationSha = U.requireSha(frontmatter.mutation_sha256, "mutation_sha256");
  const title = U.ideaTitleFromTarget(frontmatter.target_path);

  const existing = findExistingIdea(caseId, proposalSha, evaluationSha, mutationSha);
  if (existing.length > 1) {
    new Notice("同じAI caseに対応するIdeaが複数あります。System Doctorで確認してください。");
    return { status: "rejected", reason: "duplicate-existing-idea" };
  }

  let ideaFile = existing[0] ?? null;
  let createdNow = false;

  if (!ideaFile) {
    if (currentRequest === "keep_as_idea") {
      new Notice("ReviewはKeep as Idea済みですが，対応Ideaが見つかりません。");
      return { status: "rejected", reason: "decision-without-idea" };
    }

    const context = await chooseContext(tp, ER, E);
    if (!context) return { status: "cancelled" };

    const reviewContent = await app.vault.read(activeFile);
    const candidate = U.extractCandidateMarkdown(reviewContent);
    const body = U.stripKnowledgeEnvelope(candidate);

    await ensureFolder(U.IDEA_ROOT);
    const ideaPath = await uniqueMarkdownPath(U.IDEA_ROOT, sanitizeFileName(title));
    const workspaceLink = ER.makeEntityLink(app, context.workspace, ideaPath);
    const projectLink = ER.makeEntityLink(app, context.project, ideaPath);
    const created = window.moment().format("YYYY-MM-DD");

    const content = U.buildIdeaContent({
      title,
      created,
      workspace: workspaceLink,
      project: projectLink,
      caseId,
      proposalSha256: proposalSha,
      evaluationSha256: evaluationSha,
      mutationSha256: mutationSha,
      body,
    });

    ideaFile = await app.vault.create(ideaPath, content);
    createdNow = true;
  }

  if (currentRequest !== "keep_as_idea") {
    try {
      await app.fileManager.processFrontMatter(activeFile, fm => {
        const current = normalizeOptional(fm.review_request);
        if (current && current !== "keep_as_idea") {
          throw new Error(`Review request changed concurrently: ${current}`);
        }
        fm.review_request = "keep_as_idea";
      });
    } catch (error) {
      if (createdNow && ideaFile) {
        try {
          await app.vault.delete(ideaFile);
          ideaFile = null;
        } catch (rollbackError) {
          console.error("Keep as Idea rollback failed", rollbackError);
        }
      }
      new Notice(`Idea保存後のReview更新に失敗しました: ${String(error?.message ?? error)}`);
      return {
        status: "failed",
        reason: "review-update-failed",
        ideaPath: ideaFile?.path ?? null,
      };
    }
  }

  if (ideaFile) {
    try {
      await app.workspace?.getLeaf?.(false)?.openFile?.(ideaFile);
    } catch (error) {
      console.warn("保存したIdeaを開けませんでした", error);
    }
  }

  new Notice(`AI candidateをIdeaとして保存しました: ${ideaFile?.path ?? "existing"}`);
  return {
    status: createdNow ? "created" : "already_existing",
    ideaPath: ideaFile?.path ?? null,
    reviewRequest: "keep_as_idea",
  };

  function findExistingIdea(caseIdValue, proposalValue, evaluationValue, mutationValue) {
    return app.vault.getMarkdownFiles()
      .filter(file => file.path.startsWith("05-Idea/"))
      .filter(file => {
        const fm = app.metadataCache.getFileCache(file)?.frontmatter ?? {};
        if (fm.type !== "idea" || String(fm.ai_case_id ?? "").trim() !== caseIdValue) {
          return false;
        }
        if (
          String(fm.ai_source_proposal_sha256 ?? "").trim() !== proposalValue
          || String(fm.ai_source_evaluation_sha256 ?? "").trim() !== evaluationValue
          || String(fm.ai_source_mutation_sha256 ?? "").trim() !== mutationValue
        ) {
          throw new Error("同一ai_case_idのIdea provenanceが現在のReviewと一致しません");
        }
        return true;
      });
  }

  async function chooseContext(runtimeTp, relation, entityMeta) {
    const workspaces = relation.findEntityNotes(app, {
      folder: "03-Workspace",
      types: ["workspace"],
      isEligible: entity => entityMeta.isWorkspaceActiveLifecycle(entity.lifecycle),
    });
    if (workspaces.length === 0) {
      new Notice("Active Workspaceがありません。Ideaを保存できません。");
      return null;
    }

    const workspace = await runtimeTp.system.suggester(
      workspaces.map(entity => entity.displayName),
      workspaces,
      false,
      "IdeaのWorkspaceを選択"
    );
    if (!workspace) return null;

    const projects = relation.findEntityNotes(app, {
      folder: "10-Project",
      types: ["project"],
      isEligible: entity => entityMeta.isProjectActiveStatus(entity.status),
    }).filter(project => relation.entityMatchesReference(project.workspace, workspace));

    if (projects.length === 0) return { workspace, project: null };

    const none = { kind: "none" };
    const project = await runtimeTp.system.suggester(
      ["▫️ Projectを設定しない", ...projects.map(entity => entity.displayName)],
      [none, ...projects],
      false,
      "IdeaのProjectを選択"
    );
    if (!project) return null;
    return { workspace, project: project.kind === "none" ? null : project };
  }

  async function loadEntityUtils() {
    const G = await loadExpression("98-System/01-script/reference_utils.js");
    const factory = await loadExpression("98-System/01-script/entity_reference_utils.js");
    const E = await loadExpression("98-System/01-script/entity_meta_utils.js");
    return { ER: factory(G), E };
  }

  async function loadExpression(path) {
    const file = app.vault.getAbstractFileByPath(path);
    if (!file || file.extension !== "js") throw new Error(`Utilityが見つかりません: ${path}`);
    const source = await app.vault.read(file);
    return new Function(`"use strict"; return (${source});`)();
  }

  async function ensureFolder(path) {
    const parts = String(path).split("/").filter(Boolean);
    let current = "";
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      const existingFolder = app.vault.getAbstractFileByPath(current);
      if (existingFolder) {
        if (!Array.isArray(existingFolder.children)) {
          throw new Error(`フォルダではありません: ${current}`);
        }
        continue;
      }
      await app.vault.createFolder(current);
    }
  }

  async function uniqueMarkdownPath(folder, basename) {
    if (!basename) throw new Error("Idea filenameが空です");
    let suffix = 1;
    while (true) {
      const name = suffix === 1 ? basename : `${basename}-${suffix}`;
      const path = `${folder}/${name}.md`;
      if (!app.vault.getAbstractFileByPath(path)) return path;
      suffix += 1;
    }
  }

  function sanitizeFileName(input) {
    const name = String(input ?? "")
      .trim()
      .replace(/[\\/:*?"<>|#^\[\]]/g, "")
      .replace(/\s+/g, " ");
    if (!name || name === "." || name === "..") return "";
    return name;
  }

  function normalizeOptional(value) {
    if (value === null || value === undefined) return "";
    return String(value).trim();
  }
};
