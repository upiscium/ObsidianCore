module.exports = async function validateVault(tp) {
  const files = app.vault.getMarkdownFiles();

  const workspaces = files
    .filter(file => file.path.startsWith("03-Workspace/"))
    .map(file => ({ file, fm: app.metadataCache.getFileCache(file)?.frontmatter ?? {} }))
    .filter(item => item.fm.type === "workspace");

  const projects = files
    .filter(file => file.path.startsWith("10-Project/"))
    .map(file => ({ file, fm: app.metadataCache.getFileCache(file)?.frontmatter ?? {} }))
    .filter(item => item.fm.type === "project");

  const entities = [...workspaces, ...projects];

  const tasks = files
    .filter(file => file.path.startsWith("02-Task/"))
    .map(file => ({ file, fm: app.metadataCache.getFileCache(file)?.frontmatter ?? {} }))
    .filter(item => item.fm.type === "task");

  const issues = [];
  const uidOwners = new Map();

  for (const entity of entities) {
    validateEntitySchema(entity, issues);

    const uid = String(entity.fm.uid ?? "").trim();
    if (!uid) {
      issues.push(issue("error", entity.file.path, "uid", "Workspace/Project Entryにuidがありません"));
      continue;
    }

    const owners = uidOwners.get(uid) ?? [];
    owners.push(entity.file.path);
    uidOwners.set(uid, owners);
  }

  for (const [uid, owners] of uidOwners) {
    if (owners.length <= 1) continue;
    for (const path of owners) {
      issues.push(issue("error", path, "uid", `uidが重複しています: ${uid}`));
    }
  }

  const workspaceByPath = indexByPath(workspaces);
  const projectByPath = indexByPath(projects);

  for (const project of projects) {
    validateRelation({ owner: project, field: "workspace", targets: workspaceByPath, required: true, issues });
  }

  for (const task of tasks) {
    validateTaskSchema(task, issues);

    const workspace = validateRelation({ owner: task, field: "workspace", targets: workspaceByPath, required: false, issues });
    const project = validateRelation({ owner: task, field: "project", targets: projectByPath, required: false, issues });

    if (project) {
      const projectWorkspace = resolveRelation(project.fm.workspace, workspaceByPath);
      if (!projectWorkspace) {
        issues.push(issue("error", task.file.path, "project", "参照ProjectのWorkspaceを解決できません"));
      } else if (!workspace) {
        issues.push(issue("warning", task.file.path, "workspace", "Projectは設定されていますがWorkspaceが未設定です"));
      } else if (projectWorkspace.file.path !== workspace.file.path) {
        issues.push(issue("error", task.file.path, "workspace/project", `TaskのWorkspaceとProject所属Workspaceが一致しません: ${workspace.file.basename} / ${projectWorkspace.file.basename}`));
      }
    }
  }

  const summary = {
    errors: issues.filter(x => x.severity === "error").length,
    warnings: issues.filter(x => x.severity === "warning").length,
    entities: entities.length,
    tasks: tasks.length
  };

  console.log("ObsidianCore System Doctor", { summary, issues });
  if (issues.length > 0) console.table(issues);

  new Notice(
    `System Doctor: error ${summary.errors} / warning ${summary.warnings} / ` +
    `entity ${summary.entities} / task ${summary.tasks}. 詳細は開発者コンソールを確認してください。`
  );

  return { summary, issues };
};

function validateEntitySchema(entity, issues) {
  const allowedStatus = new Set(["planning", "running", "done", "cancelled"]);
  const allowedPriority = new Set(["high", "medium", "low", null, undefined, ""]);

  if (!allowedStatus.has(entity.fm.status)) {
    issues.push(issue("error", entity.file.path, "status", `不正なEntity status: ${String(entity.fm.status)}`));
  }

  if (!allowedPriority.has(entity.fm.priority)) {
    issues.push(issue("error", entity.file.path, "priority", `不正なEntity priority: ${String(entity.fm.priority)}`));
  }
}

function validateTaskSchema(task, issues) {
  const fm = task.fm;
  const allowedStatus = new Set(["todo", "doing", "done", "cancelled"]);
  const allowedPriority = new Set(["high", "medium", "low", null, undefined, ""]);

  if (!allowedStatus.has(fm.status)) {
    issues.push(issue("error", task.file.path, "status", `不正なTask status: ${String(fm.status)}`));
  }

  if (!allowedPriority.has(fm.priority)) {
    issues.push(issue("error", task.file.path, "priority", `不正なTask priority: ${String(fm.priority)}`));
  }

  if (fm.status === "done" && !asDate(fm.completed)) {
    issues.push(issue("error", task.file.path, "completed", "doneですがcompletedがありません"));
  }

  if (fm.status !== "done" && fm.completed) {
    issues.push(issue("warning", task.file.path, "completed", "done以外ですがcompletedが設定されています"));
  }

  const start = asDate(fm.start);
  const due = asDate(fm.due);
  if (start && due && start > due) {
    issues.push(issue("error", task.file.path, "start/due", "StartがDueより後です"));
  }

  if (fm.backlog !== true && fm.triaged === true && !due) {
    issues.push(issue("warning", task.file.path, "due", "Backlogではないtriaged済みTaskにDueがありません"));
  }

  if (fm.workspace && !looksLikeLink(fm.workspace)) {
    issues.push(issue("warning", task.file.path, "workspace", "旧文字列形式のWorkspace参照が残っています"));
  }

  if (fm.project && !looksLikeLink(fm.project)) {
    issues.push(issue("warning", task.file.path, "project", "旧文字列形式のProject参照が残っています"));
  }
}

function validateRelation({ owner, field, targets, required, issues }) {
  const value = owner.fm[field];
  if (!value) {
    if (required) issues.push(issue("error", owner.file.path, field, `${field}が未設定です`));
    return null;
  }

  if (!looksLikeLink(value)) {
    issues.push(issue("warning", owner.file.path, field, "旧文字列形式の参照です"));
  }

  const resolved = resolveRelation(value, targets);
  if (!resolved) {
    issues.push(issue("error", owner.file.path, field, `参照先を解決できません: ${String(value)}`));
  }
  return resolved;
}

function indexByPath(items) {
  const index = new Map();
  for (const item of items) {
    index.set(normalizePath(item.file.path), item);
    index.set(normalizePath(item.file.path.replace(/\.md$/, "")), item);
    index.set(normalizePath(item.file.basename), item);
  }
  return index;
}

function resolveRelation(value, targets) {
  const path = relationPath(value);
  if (!path) return null;
  return targets.get(normalizePath(path)) ?? targets.get(normalizePath(path.split("/").pop())) ?? null;
}

function relationPath(value) {
  if (value && typeof value === "object" && value.path) return String(value.path).replace(/\.md$/, "");
  return String(value ?? "")
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/^\[\[/, "")
    .replace(/\]\]$/, "")
    .split("|")[0]
    .replace(/\.md$/, "")
    .trim();
}

function looksLikeLink(value) {
  if (value && typeof value === "object" && value.path) return true;
  const raw = String(value ?? "").trim();
  return raw.startsWith("[[") && raw.endsWith("]] ".trim());
}

function normalizePath(value) {
  return String(value ?? "").trim().replace(/\.md$/, "").toLowerCase();
}

function asDate(value) {
  if (!value) return null;
  const parsed = window.moment(value, ["YYYY-MM-DD", window.moment.ISO_8601], true);
  return parsed.isValid() ? parsed.format("YYYY-MM-DD") : null;
}

function issue(severity, path, field, message) {
  return { severity, path, field, message };
}
