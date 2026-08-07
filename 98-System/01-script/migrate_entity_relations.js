module.exports = async (tp) => {
  const workspaceFiles = findEntities("03-Workspace", "workspace");
  const projectFiles = findEntities("10-Project", "project");
  const workspaces = buildIndex(workspaceFiles);
  const projects = buildIndex(projectFiles);
  const report = { updated: 0, unresolved: [], ambiguous: [] };

  for (const file of [...workspaceFiles, ...projectFiles]) {
    await app.fileManager.processFrontMatter(file, (fm) => {
      fm.uid = fm.uid || `${fm.type === "workspace" ? "ws" : "prj"}_${crypto.randomUUID()}`;
      fm.title = fm.title || file.basename;
      fm.aliases = Array.isArray(fm.aliases) ? fm.aliases : [];
    });
    report.updated += 1;
  }

  for (const file of app.vault.getMarkdownFiles()) {
    const cache = app.metadataCache.getFileCache(file);
    const fm = cache?.frontmatter ?? {};
    if (!fm.type) continue;

    const updates = {};
    if (fm.workspace) {
      const resolved = resolveEntity(fm.workspace, workspaces);
      if (resolved.status === "ok") updates.workspace = linkTo(resolved.file, file.path);
      else if (resolved.status !== "linked") report[resolved.status].push(`${file.path}: workspace=${String(fm.workspace)}`);
    }

    if (fm.project) {
      const resolved = resolveEntity(fm.project, projects);
      if (resolved.status === "ok") updates.project = linkTo(resolved.file, file.path);
      else if (resolved.status !== "linked") report[resolved.status].push(`${file.path}: project=${String(fm.project)}`);
    }

    if (Object.keys(updates).length > 0) {
      await app.fileManager.processFrontMatter(file, (frontmatter) => Object.assign(frontmatter, updates));
      report.updated += 1;
    }
  }

  console.table(report);
  new Notice(`Relation移行完了: 更新 ${report.updated}件 / 未解決 ${report.unresolved.length}件 / 曖昧 ${report.ambiguous.length}件。詳細は開発者コンソールを確認してください。`);
};

function findEntities(root, type) {
  return app.vault.getMarkdownFiles().filter((file) => {
    if (!file.path.startsWith(`${root}/`)) return false;
    return app.metadataCache.getFileCache(file)?.frontmatter?.type === type;
  });
}

function buildIndex(files) {
  const index = new Map();
  for (const file of files) {
    const fm = app.metadataCache.getFileCache(file)?.frontmatter ?? {};
    const values = [file.basename, file.path, file.path.replace(/\.md$/, ""), fm.title, ...(Array.isArray(fm.aliases) ? fm.aliases : [])];
    for (const value of values) {
      const key = normalize(value);
      if (!key) continue;
      const matches = index.get(key) ?? [];
      matches.push(file);
      index.set(key, matches);
    }
  }
  return index;
}

function resolveEntity(value, index) {
  if (value && typeof value === "object" && value.path) return { status: "linked" };
  const key = normalize(value);
  const matches = index.get(key) ?? [];
  if (matches.length === 1) return { status: "ok", file: matches[0] };
  if (matches.length > 1) return { status: "ambiguous" };
  return { status: "unresolved" };
}

function normalize(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim().replace(/^\[\[/, "").replace(/\]\]$/, "").split("|")[0].replace(/\.md$/, "").toLowerCase();
}

function linkTo(target, sourcePath) {
  return app.fileManager.generateMarkdownLink(target, sourcePath);
}
