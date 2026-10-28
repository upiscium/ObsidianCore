// Canonical, human-confirmed Idea transitions. No migration and no inferred history.
module.exports = async function transitionIdea(tp, action) {
  const appRef = tp?.app ?? (typeof app === "undefined" ? null : app);
  const NoticeRef = tp?.obsidian?.Notice ?? (typeof Notice === "undefined" ? null : Notice);
  const notify = message => { if (typeof NoticeRef === "function") new NoticeRef(message, 8000); };
  class Refusal extends Error {}
  const refuse = message => { throw new Refusal(message); };
  const retry = () => refuse("Ideaまたは参照先が変更されました。キャッシュの更新を待ち、最初から実行してください。");
  const repair = () => refuse("採用履歴が不完全です。Idea adoptionの手動照合手順で正式なProjectと実際の採用日を確認してください。自動補完はしません。");
  const ideaKeys = ["type", "status", "workspace", "project", "adopted_project", "adopted_at"];
  const projectKeys = ["type", "status", "workspace"];
  const workspaceKeys = ["type", "lifecycle"];
  const projection = (fm, keys) => JSON.stringify(keys.map(key => fm?.[key]));
  const version = file => [file.stat?.mtime, file.stat?.size];
  const sameVersion = (file, stamp) => JSON.stringify(version(file)) === JSON.stringify(stamp);
  const safePath = path => typeof path === "string" && !/^[\/]|[\\\[\]#|\r\n]/.test(path) &&
    path.split("/").every(part => part && part !== "." && part !== "..");
  let source;
  let sourcePath;
  try {
    if (!["adopt", "revoke", "archive"].includes(action)) refuse("不明なIdea操作です。");
    if (!appRef?.vault?.read || !appRef?.metadataCache?.getFileCache ||
        !appRef?.fileManager?.processFrontMatter || !tp?.system?.suggester ||
        typeof tp?.obsidian?.parseYaml !== "function") {
      refuse("Idea操作にはObsidianとTemplaterが必要です。設定を確認してください。");
    }
    source = appRef.workspace?.getActiveFile?.();
    sourcePath = source?.path;
    if (!validFile(source, "05-Idea")) refuse("05-Idea内のIdeaを開いてから実行してください。");
    const R = await utility("reference_utils");
    const E = await utility("entity_meta_utils");
    const I = await utility("idea_meta_utils");
    const initial = await readSnapshot(source, ideaKeys);
    const initialState = projection(initial.fm, ideaKeys);
    validateIdea(initial.fm);
    const historical = action !== "adopt";
    const initialContext = await context(initial.fm, historical);

    let selected = null;
    if (action === "adopt") {
      if (initial.fm.status === "archived") refuse("Archived Ideaは採用できません。");
      const candidates = [];
      for (const file of markdownFiles().filter(file => validFile(file, "10-Project"))) {
        const snapshot = await readSnapshot(file, projectKeys);
        if (snapshot.fm.type !== "project" || !E.isProjectActiveStatus(snapshot.fm.status)) continue;
        // Invalid, stale, ambiguous or foreign owners are not selectable.
        try {
          const owner = resolve(snapshot.fm.workspace, "03-Workspace");
          if (owner === initialContext.workspace.file) candidates.push(snapshot);
        } catch (error) {
          if (!(error instanceof Refusal)) throw error;
        }
      }
      if (!candidates.length) refuse("同じActive Workspaceに採用可能なProject（planning / running）がありません。");
      selected = await tp.system.suggester(
        candidates.map(item => item.path), candidates, false, "正式な採用先Projectを選択"
      );
      if (!selected) return { status: "cancelled" };
      if (!candidates.includes(selected)) refuse("選択されたProjectは採用候補ではありません。");
    } else if (action === "revoke" && initial.fm.status !== "adopted") {
      refuse("採用取消はAdopted Ideaで実行してください。Archiveの履歴は保持します。");
    } else if (action === "archive" && initial.fm.status === "archived") {
      return { status: "unchanged" };
    }

    const prompt = action === "adopt" ? `このProjectへ正式に採用しますか？ ${selected.path}`
      : action === "revoke" ? "採用を取り消しActiveへ戻しますか？採用先と採用日を両方クリアします。"
        : "IdeaをArchiveしますか？既存の完全な採用履歴は保持します。";
    const confirmed = await tp.system.suggester(["キャンセル", "確認して実行"], [false, true], false, prompt);
    if (confirmed !== true) return { status: "cancelled" };

    // Fresh disk YAML, not chooser-era cache data, is authoritative here.
    const current = await readSnapshot(source, ideaKeys);
    if (projection(current.fm, ideaKeys) !== initialState) retry();
    validateIdea(current.fm);
    const finalContext = await context(current.fm, historical);
    if (finalContext.workspace.file !== initialContext.workspace.file) retry();
    for (const before of initialContext.dependencies) {
      const after = finalContext.dependencies.find(item => item.file === before.file);
      if (!after || projection(before.fm, before.keys) !== projection(after.fm, after.keys)) retry();
    }
    let target = null;
    if (selected) {
      if (selected.file.path !== selected.path) retry();
      target = await readSnapshot(selected.file, projectKeys);
      if (projection(target.fm, projectKeys) !== projection(selected.fm, projectKeys)) retry();
      validateProject(target, finalContext.workspace, false);
    }
    const dependencies = [...finalContext.dependencies, ...(target ? [target] : [])];
    const date = action === "adopt" && current.fm.status === "active"
      ? I.normalizeAdoptionDate((typeof window === "undefined" ? globalThis.window : window)?.moment?.().format("YYYY-MM-DD"))
      : null;
    if (action === "adopt" && current.fm.status === "active" && !date) refuse("ローカル採用日を取得できませんでした。日付設定を確認してください。");
    const targetLink = target ? `[[${target.path.replace(/\.md$/, "")}]]` : null;
    const idempotent = action === "adopt" && current.fm.status === "adopted";
    if (idempotent && finalContext.adopted.file !== target.file) {
      refuse("別のProjectへは上書きできません。明示的に採用取消してから再採用してください。");
    }

    // Synchronous optimistic boundary: no awaits and no assignments until all
    // checks succeed. Obsidian offers no cross-file / cross-device transaction.
    const checkBoundary = fm => {
      if (appRef.workspace?.getActiveFile?.() !== source || source.path !== sourcePath ||
          !validFile(source, "05-Idea") || projection(fm, ideaKeys) !== initialState) retry();
      validateIdea(fm);
      for (const dependency of dependencies) assertCurrent(dependency);
      if (resolve(fm.workspace, "03-Workspace") !== finalContext.workspace.file) retry();
      if (I.hasAdoptionValue(fm.project) && resolve(fm.project, "10-Project") !== finalContext.related?.file) retry();
      for (const project of [finalContext.related, finalContext.adopted, target].filter(Boolean)) {
        if (resolve(project.fm.workspace, "03-Workspace") !== finalContext.workspace.file) retry();
      }
      if (finalContext.adopted && resolve(fm.adopted_project, "10-Project") !== finalContext.adopted.file) retry();
      if (target) validateProject(target, finalContext.workspace, false);
    };
    if (idempotent) {
      assertCurrent(current);
      checkBoundary(current.fm);
      notify("同じProjectへ採用済みです。採用日は変更しません。");
      return { status: "unchanged" };
    }
    let callbackRan = false;
    await appRef.fileManager.processFrontMatter(source, fm => {
      checkBoundary(fm);
      if (action === "adopt") {
        Object.assign(fm, { status: "adopted", adopted_project: targetLink, adopted_at: date });
      } else if (action === "revoke") {
        fm.status = "active";
        delete fm.adopted_project;
        delete fm.adopted_at;
      } else {
        fm.status = "archived";
      }
      callbackRan = true;
    });
    if (!callbackRan) throw new Error("Frontmatter callback did not run");
    notify(action === "adopt" ? "IdeaをProjectへ正式に採用しました。"
      : action === "revoke" ? "採用を取り消しました。関連先と本文は保持しました。" : "IdeaをArchiveしました。採用履歴は保持しました。");
    return { status: action === "adopt" ? "adopted" : action === "revoke" ? "revoked" : "archived" };

    function validateIdea(fm) {
      if (fm.type !== "idea" || !["active", "adopted", "archived"].includes(fm.status)) refuse("有効なIdeaの状態ではありません。");
      const state = I.adoptionState(fm);
      if (state === "legacy" || state === "partial" || (fm.status === "active" && state !== "none")) repair();
      if (state === "complete" && !I.normalizeAdoptionDate(fm.adopted_at)) repair();
    }
    async function context(fm, history) {
      const workspace = await readSnapshot(resolve(fm.workspace, "03-Workspace"), workspaceKeys);
      if (workspace.fm.type !== "workspace") refuse("IdeaのWorkspace参照が無効です。");
      if (!history && !E.isWorkspaceActiveLifecycle(workspace.fm.lifecycle)) refuse("採用にはActive Workspaceが必要です。");
      const dependencies = [workspace];
      let related = null;
      let adopted = null;
      if (I.hasAdoptionValue(fm.project)) {
        related = await readSnapshot(resolve(fm.project, "10-Project"), projectKeys);
        validateProject(related, workspace, true);
        dependencies.push(related);
      }
      if (I.adoptionState(fm) === "complete") {
        adopted = await readSnapshot(resolve(fm.adopted_project, "10-Project"), projectKeys);
        validateProject(adopted, workspace, true);
        dependencies.push(adopted);
      }
      return { workspace, related, adopted, dependencies };
    }
    function validateProject(snapshot, workspace, history) {
      if (!validFile(snapshot.file, "10-Project") || snapshot.fm.type !== "project" ||
          resolve(snapshot.fm.workspace, "03-Workspace") !== workspace.file) {
        refuse("ProjectはIdeaと同じWorkspaceに所属する必要があります。");
      }
      if (!history && !E.isProjectActiveStatus(snapshot.fm.status)) refuse("採用先Projectはplanning / runningである必要があります。");
    }
    function resolve(value, folder) {
      const files = markdownFiles();
      const result = R.inspectReference(value, files.map(file => ({ file })), files);
      const file = result.target?.file;
      const linkpath = R.normalizeLinkpath(value);
      if (result.status !== "resolved" || !safePath(linkpath) || !validFile(file, folder)) {
        refuse("参照が不明・古い・曖昧、または対象範囲外です。完全なVault内リンクを確認してください。");
      }
      return file;
    }
  } catch (error) {
    // Never echo an exception, filename contents, YAML, or plugin error text.
    notify(error instanceof Refusal ? error.message : "Idea操作を完了できませんでした。対象ノートを確認してから再試行するか、Templater設定を確認してください。");
    return { status: error instanceof Refusal ? "refused" : "error" };
  }

  function markdownFiles() { return appRef.vault.getMarkdownFiles(); }
  function validFile(file, folder) {
    return !!file && file.extension === "md" && safePath(file.path) && file.path.startsWith(`${folder}/`) &&
      appRef.vault.getAbstractFileByPath(file.path) === file;
  }
  async function utility(name) {
    const path = `98-System/01-script/${name}.js`;
    const file = appRef.vault.getAbstractFileByPath(path);
    if (!file || file.path !== path || file.extension !== "js") refuse("Idea操作のCore utilityがありません。");
    const code = await appRef.vault.read(file);
    if (typeof code !== "string" || !code.length || code.length > 200000) refuse("Idea操作のCore utilityが無効です。");
    return new Function(`"use strict"; return (${code});`)();
  }
  async function readSnapshot(file, keys) {
    const path = file.path;
    const stamp = version(file);
    if (!stamp.every(Number.isFinite)) retry();
    const raw = await appRef.vault.read(file);
    if (appRef.vault.getAbstractFileByPath(path) !== file || file.path !== path || !sameVersion(file, stamp)) retry();
    const match = typeof raw === "string" && raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    if (!match) refuse("参照ノートのfrontmatterを確認してください。");
    const fm = tp.obsidian.parseYaml(match[1]);
    if (!fm || typeof fm !== "object" || Array.isArray(fm)) refuse("参照ノートのfrontmatterが無効です。");
    const snapshot = { file, path, stamp, fm, keys };
    assertCurrent(snapshot);
    return snapshot;
  }
  function assertCurrent(snapshot) {
    if (snapshot.file.path !== snapshot.path || appRef.vault.getAbstractFileByPath(snapshot.path) !== snapshot.file ||
        !sameVersion(snapshot.file, snapshot.stamp) ||
        projection(appRef.metadataCache.getFileCache(snapshot.file)?.frontmatter, snapshot.keys) !== projection(snapshot.fm, snapshot.keys)) retry();
  }
};
