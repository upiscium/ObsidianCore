module.exports = async (tp) => {
  const workspaceFiles = findEntities("03-Workspace", "workspace");
  const projectFiles = findEntities("10-Project", "project");
  const report = { updated: 0, inferred: 0, unresolved: [], ambiguous: [] };

  for (const file of [...workspaceFiles, ...projectFiles]) {
    await app.fileManager.processFrontMatter(file, (fm) => {
      fm.uid = fm.uid || `${fm.type === "workspace" ? "ws" : "prj"}_${crypto.randomUUID()}`;
      fm.title = fm.title || file.basename;
      fm.aliases = Array.isArray(fm.aliases) ? fm.aliases : [];
    });
    report.updated += 1;
  }

  // Rebuild indexes after metadata normalization so title/aliases are current.
  const workspaces = buildIndex(workspaceFiles);
  const projects = buildIndex(projectFiles);
  const workspaceByFolder = buildFolderIndex(workspaceFiles);
  const projectByFolder = buildFolderIndex(projectFiles);

  for (const file of app.vault.getMarkdownFiles()) {
    const cache = app.metadataCache.getFileCache(file);
    const fm = cache?.frontmatter ?? {};
    if (!fm.type) continue;

    const updates = {};

    if (fm.workspace) {
      const resolved = resolveEntity(fm.workspace, workspaces);
      if (resolved.status === "ok") {
        updates.workspace = linkTo(resolved.file, file.path);
      } else if (resolved.status === "ambiguous") {
        report.ambiguous.push(formatAmbiguous(file.path, "workspace", fm.workspace, resolved.matches));
      } else if (resolved.status !== "linked") {
        report.unresolved.push(`${file.path}: workspace=${String(fm.workspace)}`);
      }
    }

    if (fm.project) {
      const resolved = resolveEntity(fm.project, projects);
      if (resolved.status === "ok") {
        updates.project = linkTo(resolved.file, file.path);
      } else if (resolved.status === "ambiguous") {
        report.ambiguous.push(formatAmbiguous(file.path, "project", fm.project, resolved.matches));
      } else if (resolved.status !== "linked") {
        report.unresolved.push(`${file.path}: project=${String(fm.project)}`);
      }
    }

    if (fm.type === "workspace-note" && !fm.workspace) {
      const inferred = inferFromFolder(file, workspaceByFolder);
      if (inferred.status === "ok") {
        updates.workspace = linkTo(inferred.file, file.path);
        report.inferred += 1;
      } else {
        recordInferenceFailure(report, file.path, "workspace", inferred);
      }
    }

    if (fm.type === "project-note") {
      let projectFile = null;

      if (fm.project) {
        const resolvedProject = resolveEntityFile(fm.project, projects);
        if (resolvedProject.status === "ok") projectFile = resolvedProject.file;
      } else {
        const inferred = inferFromFolder(file, projectByFolder);
        if (inferred.status === "ok") {
          projectFile = inferred.file;
          updates.project = linkTo(projectFile, file.path);
          report.inferred += 1;
        } else {
          recordInferenceFailure(report, file.path, "project", inferred);
        }
      }

      if (!fm.workspace && projectFile) {
        const projectFm = app.metadataCache.getFileCache(projectFile)?.frontmatter ?? {};
        const projectWorkspace = resolveEntityFile(projectFm.workspace, workspaces);
        if (projectWorkspace.status === "ok") {
          updates.workspace = linkTo(projectWorkspace.file, file.path);
          report.inferred += 1;
        } else if (projectWorkspace.status === "ambiguous") {
          report.ambiguous.push(formatAmbiguous(file.path, "workspace", projectFm.workspace, projectWorkspace.matches));
        } else {
          report.unresolved.push(`${file.path}: workspaceをProject ${projectFile.path} から推定できません`);
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      await app.fileManager.processFrontMatter(file, (frontmatter) => Object.assign(frontmatter, updates));
      report.updated += 1;
    }
  }

  console.log("Entity relation migration report", report);
  if (report.unresolved.length > 0) console.warn("Unresolved relations", report.unresolved);
  if (report.ambiguous.length > 0) console.warn("Ambiguous relations", report.ambiguous);

  new Notice(
    `Relation移行完了: 更新 ${report.updated}件 / 推定 ${report.inferred}件 / ` +
    `未解決 ${report.unresolved.length}件 / 曖昧 ${report.ambiguous.length}件。` +
    " 詳細は開発者コンソールを確認してください。"
  );

  return report;
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
    const values = [
      file.basename,
      file.path,
      file.path.replace(/\.md$/, ""),
      fm.title,
      ...(Array.isArray(fm.aliases) ? fm.aliases : [])
    ];

    for (const value of values) {
      const key = normalize(value);
      if (!key) continue;

      const matches = index.get(key) ?? [];
      if (!matches.some(existing => existing.path === file.path)) {
        matches.push(file);
      }
      index.set(key, matches);
    }
  }

  return index;
}

function buildFolderIndex(files) {
  const index = new Map();
  for (const file of files) {
    const folder = file.parent?.path;
    if (!folder) continue;
    const matches = index.get(folder) ?? [];
    matches.push(file);
    index.set(folder, matches);
  }
  return index;
}

function inferFromFolder(file, folderIndex) {
  const folder = file.parent?.path;
  if (!folder) return { status: "unresolved" };
  const matches = folderIndex.get(folder) ?? [];
  if (matches.length === 1) return { status: "ok", file: matches[0] };
  if (matches.length > 1) return { status: "ambiguous", matches };
  return { status: "unresolved" };
}

function resolveEntity(value, index) {
  if (value && typeof value === "object" && value.path) {
    return { status: "linked" };
  }
  return resolveEntityFile(value, index);
}

function resolveEntityFile(value, index) {
  const key = normalize(value && typeof value === "object" && value.path ? value.path : value);
  if (!key) return { status: "unresolved" };

  const matches = index.get(key) ?? [];
  if (matches.length === 1) return { status: "ok", file: matches[0] };
  if (matches.length > 1) return { status: "ambiguous", matches };

  const basename = key.split("/").pop();
  const basenameMatches = index.get(basename) ?? [];
  if (basenameMatches.length === 1) return { status: "ok", file: basenameMatches[0] };
  if (basenameMatches.length > 1) return { status: "ambiguous", matches: basenameMatches };
  return { status: "unresolved" };
}

function recordInferenceFailure(report, ownerPath, field, result) {
  if (result.status === "ambiguous") {
    report.ambiguous.push(formatAmbiguous(ownerPath, field, "(parent folder)", result.matches));
  } else {
    report.unresolved.push(`${ownerPath}: ${field}を親フォルダから推定できません`);
  }
}

function formatAmbiguous(ownerPath, field, value, matches) {
  return {
    owner: ownerPath,
    field,
    value: String(value),
    candidates: matches.map(file => file.path)
  };
}

function normalize(value) {
  if (value === null || value === undefined) return "";

  return String(value)
    .trim()
    .replace(/^\[\[/, "")
    .replace(/\]\]$/, "")
    .split("|")[0]
    .replace(/\.md$/, "")
    .toLowerCase();
}

function linkTo(target, sourcePath) {
  return app.fileManager.generateMarkdownLink(target, sourcePath);
}
