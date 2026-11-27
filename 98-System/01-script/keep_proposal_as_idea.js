module.exports = async function keepProposalAsIdea(tp) {
  const U = await loadExpression("98-System/01-script/proposal_idea_utils.js");
  const sourceFile = app.workspace?.getActiveFile?.();

  if (!sourceFile || sourceFile.extension !== "md") {
    new Notice("Ideaとして保持: 対象Markdownノートが開かれていません。");
    return { status: "rejected", reason: "no-active-markdown" };
  }

  const frontmatter = app.metadataCache.getFileCache(sourceFile)?.frontmatter ?? {};
  if (!U.isProposalNote(sourceFile.path, frontmatter)) {
    new Notice("Ideaとして保持: 04-AI/Proposalsの提案ノートを開いてから実行してください。");
    return { status: "rejected", reason: "not-a-proposal" };
  }

  const originalContent = await app.vault.read(sourceFile);
  // Validate the whole conversion before asking anything or touching the Vault.
  const preview = U.planIdeaConversion({
    sourcePath: sourceFile.path,
    frontmatter,
    content: originalContent,
    created: "2000-01-01",
    workspace: "preview",
  });
  if (!preview.ok) {
    new Notice(`Ideaとして保持: ${preview.error}`);
    return { status: "rejected", reason: "unsafe-source", error: preview.error };
  }

  let existing;
  try {
    existing = findExistingIdeas(preview.sourceSha256, preview.generationSha256);
  } catch (error) {
    new Notice(`Ideaとして保持: ${String(error?.message ?? error)}`);
    return { status: "rejected", reason: "provenance-mismatch" };
  }
  if (existing.length > 0) {
    // Never delete the proposal on the user's behalf: a person decides which copy stays.
    new Notice(`同じ提案から作られたIdeaが既にあります: ${existing[0].path}。不要な提案ノートは削除してください。`);
    return { status: "rejected", reason: "idea-already-exists", ideaPath: existing[0].path };
  }

  const context = await chooseContext(tp);
  if (!context) {
    new Notice("Ideaとして保持をキャンセルしました。");
    return { status: "cancelled" };
  }

  const { ER } = await loadEntityUtils();
  await ensureFolder(U.IDEA_ROOT);
  const ideaPath = await uniqueMarkdownPath(U.IDEA_ROOT, sanitizeFileName(preview.title));
  const created = window.moment().format("YYYY-MM-DD");
  const plan = U.planIdeaConversion({
    sourcePath: sourceFile.path,
    frontmatter,
    content: originalContent,
    created,
    workspace: ER.makeEntityLink(app, context.workspace, ideaPath),
    project: ER.makeEntityLink(app, context.project, ideaPath),
  });
  if (!plan.ok) {
    new Notice(`Ideaとして保持: ${plan.error}`);
    return { status: "rejected", reason: "unsafe-source", error: plan.error };
  }

  const sourcePath = sourceFile.path;
  try {
    await app.vault.rename(sourceFile, ideaPath);
    const ideaFile = app.vault.getAbstractFileByPath(ideaPath);
    if (!ideaFile || ideaFile.extension !== "md") {
      throw new Error(`移動後のファイルを取得できません: ${ideaPath}`);
    }
    await app.vault.modify(ideaFile, plan.content);

    try {
      await app.workspace?.getLeaf?.(false)?.openFile?.(ideaFile);
    } catch (openError) {
      console.warn("保存したIdeaを開けませんでした", openError);
    }
    new Notice(`Ideaとして保持しました: ${ideaPath}`);
    return { status: "kept", sourcePath, ideaPath };
  } catch (error) {
    const rollback = await rollbackMove({ sourcePath, ideaPath, originalContent });
    const suffix = rollback.ok
      ? "元のノートへロールバックしました。"
      : `ロールバックにも失敗しました: ${rollback.errors.join(" / ")}`;
    new Notice(`Ideaとして保持に失敗しました: ${String(error?.message ?? error)}. ${suffix}`);
    return {
      status: "failed",
      sourcePath,
      ideaPath,
      rolledBack: rollback.ok,
      error: String(error?.message ?? error),
      rollbackErrors: rollback.errors,
    };
  }

  function findExistingIdeas(sourceSha, generationSha) {
    return app.vault.getMarkdownFiles()
      .filter(file => file.path.startsWith(`${U.IDEA_ROOT}/`))
      .filter(file => {
        const fm = app.metadataCache.getFileCache(file)?.frontmatter ?? {};
        if (fm.type !== "idea" || String(fm.ai_proposal_source_sha256 ?? "").trim() !== sourceSha) {
          return false;
        }
        if (String(fm.ai_proposal_generation_sha256 ?? "").trim() !== generationSha) {
          throw new Error("同じ出所のIdeaの生成記録が、この提案と一致しません。System Doctorで確認してください。");
        }
        return true;
      });
  }

  async function chooseContext(runtimeTp) {
    const { ER, E } = await loadEntityUtils();
    const workspaces = ER.findEntityNotes(app, {
      folder: "03-Workspace",
      types: ["workspace"],
      isEligible: entity => E.isWorkspaceActiveLifecycle(entity.lifecycle),
    });
    if (workspaces.length === 0) {
      new Notice("Active Workspaceがありません。Ideaを保存できません。");
      return null;
    }
    if (!runtimeTp?.system?.suggester) {
      new Notice("Ideaとして保持: 選択UIを利用できません。");
      return null;
    }

    const workspace = await runtimeTp.system.suggester(
      workspaces.map(entity => entity.displayName),
      workspaces,
      false,
      "IdeaのWorkspaceを選択"
    );
    if (!workspace) return null;

    const projects = ER.findEntityNotes(app, {
      folder: "10-Project",
      types: ["project"],
      isEligible: entity => E.isProjectActiveStatus(entity.status),
    }).filter(project => ER.entityMatchesReference(project.workspace, workspace));

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

  async function rollbackMove({ sourcePath, ideaPath, originalContent }) {
    const errors = [];
    const moved = app.vault.getAbstractFileByPath(ideaPath);
    if (moved) {
      try {
        await app.vault.rename(moved, sourcePath);
      } catch (error) {
        errors.push(`rename: ${String(error?.message ?? error)}`);
      }
    }
    const restored = app.vault.getAbstractFileByPath(sourcePath)
      ?? app.vault.getAbstractFileByPath(ideaPath);
    if (restored) {
      try {
        await app.vault.modify(restored, originalContent);
      } catch (error) {
        errors.push(`content: ${String(error?.message ?? error)}`);
      }
    } else {
      errors.push("file: 元のノートも移動先も見つかりません");
    }
    return { ok: errors.length === 0 && Boolean(app.vault.getAbstractFileByPath(sourcePath)), errors };
  }
};
