module.exports = async function validateVault(tp) {
  const R = await loadReferenceUtils();
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

  const notes = files
    .filter(file => file.path.startsWith("03-Workspace/") || file.path.startsWith("10-Project/"))
    .map(file => ({ file, fm: app.metadataCache.getFileCache(file)?.frontmatter ?? {} }))
    .filter(item => item.fm.type === "workspace-note" || item.fm.type === "project-note");

  const tasks = files
    .filter(file => file.path.startsWith("02-Task/"))
    .map(file => ({ file, fm: app.metadataCache.getFileCache(file)?.frontmatter ?? {} }))
    .filter(item => item.fm.type === "task" || item.fm.type === "task-pack");

  const ideas = files
    .filter(file => file.path.startsWith("05-Idea/"))
    .map(file => ({ file, fm: app.metadataCache.getFileCache(file)?.frontmatter ?? {} }))
    .filter(item => item.fm.type === "idea");

  const knowledge = files
    .filter(file => file.path.startsWith("11-Knowledge/"))
    .map(file => ({ file, fm: app.metadataCache.getFileCache(file)?.frontmatter ?? {} }))
    .filter(item => item.fm.type === "knowledge-note");

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

  const workspaceByPath = R.indexByFilePath(workspaces);
  const projectByPath = R.indexByFilePath(projects);

  for (const project of projects) {
    validateRelation({ owner: project, field: "workspace", targets: workspaceByPath, required: true, issues, R });
  }

  if (notes.length > 0) {
    const N = await loadNoteMetaUtils();
    for (const note of notes) validateNoteSchema(note, issues, N);
  }

  for (const note of notes) {
    if (note.fm.type === "workspace-note") {
      validateRelation({ owner: note, field: "workspace", targets: workspaceByPath, required: true, issues, R });
      continue;
    }

    const project = validateRelation({ owner: note, field: "project", targets: projectByPath, required: true, issues, R });
    const workspace = validateRelation({ owner: note, field: "workspace", targets: workspaceByPath, required: false, issues, R });

    if (project) {
      const projectWorkspace = R.resolveIndexedReference(project.fm.workspace, workspaceByPath);
      if (!projectWorkspace) {
        issues.push(issue("error", note.file.path, "project", "参照ProjectのWorkspaceを解決できません"));
      } else if (!workspace) {
        issues.push(issue("warning", note.file.path, "workspace", "Project NoteにWorkspaceが未設定です"));
      } else if (projectWorkspace.file.path !== workspace.file.path) {
        issues.push(issue("error", note.file.path, "workspace/project", `Project NoteのWorkspaceとProject所属Workspaceが一致しません: ${workspace.file.basename} / ${projectWorkspace.file.basename}`));
      }
    }
  }

  for (const task of tasks) {
    validateTaskSchema(task, issues, R);

    const workspace = validateRelation({ owner: task, field: "workspace", targets: workspaceByPath, required: false, issues, R });
    const project = validateRelation({ owner: task, field: "project", targets: projectByPath, required: false, issues, R });

    if (project) {
      const projectWorkspace = R.resolveIndexedReference(project.fm.workspace, workspaceByPath);
      if (!projectWorkspace) {
        issues.push(issue("error", task.file.path, "project", "参照ProjectのWorkspaceを解決できません"));
      } else if (!workspace) {
        issues.push(issue("warning", task.file.path, "workspace", "Projectは設定されていますがWorkspaceが未設定です"));
      } else if (projectWorkspace.file.path !== workspace.file.path) {
        issues.push(issue("error", task.file.path, "workspace/project", `TaskのWorkspaceとProject所属Workspaceが一致しません: ${workspace.file.basename} / ${projectWorkspace.file.basename}`));
      }
    }
  }

  if (ideas.length > 0) {
    const I = await loadIdeaMetaUtils();
    for (const idea of ideas) {
      validateIdeaSchema(idea, issues, I);

      const workspace = validateRelation({
        owner: idea,
        field: "workspace",
        targets: workspaces,
        required: true,
        strict: true,
        files,
        issues,
        R
      });
      for (const field of ["project", "adopted_project"]) {
        const project = validateRelation({
          owner: idea, field, targets: projects, required: false, strict: true, files, issues, R
        });
        if (project) {
          const projectWorkspace = R.inspectReference(project.fm.workspace, workspaces, files).target;
          if (!projectWorkspace) {
            issues.push(issue("error", idea.file.path, field, "参照ProjectのWorkspaceは単一の有効な参照である必要があります（欠落・曖昧・不正な参照を確認してください）"));
          } else if (workspace && projectWorkspace.file.path !== workspace.file.path) {
            issues.push(issue(
              "error",
              idea.file.path,
              `workspace/${field}`,
              `IdeaのWorkspaceとProject所属Workspaceが一致しません: ${workspace.file.basename} / ${projectWorkspace.file.basename}`
            ));
          }
        }
      }
    }
  }

  if (knowledge.length > 0) {
    const K = await loadKnowledgeMetaUtils();
    for (const note of knowledge) validateKnowledgeSchema(note, issues, K);
  }

  const summary = {
    errors: issues.filter(x => x.severity === "error").length,
    warnings: issues.filter(x => x.severity === "warning").length,
    entities: entities.length,
    notes: notes.length,
    tasks: tasks.length,
    ideas: ideas.length
  };

  console.log("ObsidianCore System Doctor", { summary, issues });
  if (issues.length > 0) console.table(issues);

  new Notice(
    `System Doctor: error ${summary.errors} / warning ${summary.warnings} / ` +
    `entity ${summary.entities} / note ${summary.notes} / task ${summary.tasks} / idea ${summary.ideas}. 詳細は開発者コンソールを確認してください。`
  );

  return { summary, issues };
};

async function loadReferenceUtils() {
  const path = "98-System/01-script/reference_utils.js";
  const file = app.vault.getAbstractFileByPath(path);
  if (!file || file.extension !== "js") {
    throw new Error(`Reference utilityが見つかりません: ${path}`);
  }
  const source = await app.vault.read(file);
  return new Function(`"use strict"; return (${source});`)();
}

async function loadNoteMetaUtils() {
  const path = "98-System/01-script/note_meta_utils.js";
  const file = app.vault.getAbstractFileByPath(path);
  if (!file || file.extension !== "js") {
    throw new Error(`Note metadata utilityが見つかりません: ${path}`);
  }
  const source = await app.vault.read(file);
  return new Function(`"use strict"; return (${source});`)();
}

async function loadIdeaMetaUtils() {
  const path = "98-System/01-script/idea_meta_utils.js";
  const file = app.vault.getAbstractFileByPath(path);
  if (!file || file.extension !== "js") {
    throw new Error(`Idea metadata utilityが見つかりません: ${path}`);
  }
  const source = await app.vault.read(file);
  return new Function(`"use strict"; return (${source});`)();
}

async function loadKnowledgeMetaUtils() {
  const path = "98-System/01-script/knowledge_meta_utils.js";
  const file = app.vault.getAbstractFileByPath(path);
  if (!file || file.extension !== "js") {
    throw new Error(`Knowledge metadata utilityが見つかりません: ${path}`);
  }
  const source = await app.vault.read(file);
  return new Function(`"use strict"; return (${source});`)();
}

function validateEntitySchema(entity, issues) {
  const fm = entity.fm;
  if (fm.type === "workspace") {
    if (!["active", "inactive", "archived"].includes(fm.lifecycle)) {
      issues.push(issue("error", entity.file.path, "lifecycle", `不正なWorkspace lifecycle: ${String(fm.lifecycle)}`));
    }
    if (Object.prototype.hasOwnProperty.call(fm, "status")) {
      issues.push(issue("error", entity.file.path, "status", "旧Workspace statusが残っています"));
    }
    if (Object.prototype.hasOwnProperty.call(fm, "priority")) {
      issues.push(issue("error", entity.file.path, "priority", "旧Workspace priorityが残っています"));
    }
    return;
  }

  const allowedStatus = new Set(["planning", "running", "stopped", "stable", "done", "cancelled"]);
  const allowedPriority = new Set(["high", "medium", "low", null, undefined, ""]);

  if (!allowedStatus.has(fm.status)) {
    issues.push(issue("error", entity.file.path, "status", `不正なProject status: ${String(fm.status)}`));
  }
  if (!allowedPriority.has(fm.priority)) {
    issues.push(issue("error", entity.file.path, "priority", `不正なProject priority: ${String(fm.priority)}`));
  }
  if ((fm.status === "done" || fm.status === "cancelled") && fm.github_watch === true) {
    issues.push(issue("warning", entity.file.path, "github_watch", "終端ProjectですがGitHub監視が有効です"));
  }
}

function validateNoteSchema(note, issues, N) {
  const fm = note.fm;

  if (N.normalizeLifecycle(fm.lifecycle) === null) {
    issues.push(issue("error", note.file.path, "lifecycle", `不正なNote lifecycle: ${String(fm.lifecycle)}`));
  }
  if (N.normalizeCategory(fm.category) === null) {
    issues.push(issue("error", note.file.path, "category", `不正なNote category: ${String(fm.category)}`));
  }
  if (!N.isStringArray(fm.aliases)) {
    issues.push(issue("error", note.file.path, "aliases", "Note aliasesは文字列配列である必要があります"));
  }
  if (!N.isStringArray(fm.tags)) {
    issues.push(issue("error", note.file.path, "tags", "Note tagsは文字列配列である必要があります"));
  }
  if (Object.prototype.hasOwnProperty.call(fm, "status")) {
    issues.push(issue("error", note.file.path, "status", "旧Note statusが残っています"));
  }
  if (Object.prototype.hasOwnProperty.call(fm, "priority")) {
    issues.push(issue("error", note.file.path, "priority", "旧Note priorityが残っています"));
  }
}

function validateTaskSchema(task, issues, R) {
  const fm = task.fm;
  const allowedStatus = new Set(["todo", "doing", "done", "cancelled"]);
  const allowedPriority = new Set(["high", "medium", "low", null, undefined, ""]);

  if (fm.type !== "task") {
    issues.push(issue("error", task.file.path, "type", `旧Task typeが残っています: ${String(fm.type)}`));
  }

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

  if (fm.workspace && !R.looksLikeLink(fm.workspace)) {
    issues.push(issue("warning", task.file.path, "workspace", "旧文字列形式のWorkspace参照が残っています"));
  }

  if (fm.project && !R.looksLikeLink(fm.project)) {
    issues.push(issue("warning", task.file.path, "project", "旧文字列形式のProject参照が残っています"));
  }
}

function validateIdeaSchema(idea, issues, I) {
  const fm = idea.fm;

  if (typeof fm.title !== "string" || !fm.title.trim()) {
    issues.push(issue("error", idea.file.path, "title", "Idea titleが未設定です"));
  }
  if (!asDate(fm.created)) {
    issues.push(issue("error", idea.file.path, "created", `不正なIdea created: ${String(fm.created)}`));
  }
  if (I.normalizeStatus(fm.status) === null) {
    issues.push(issue("error", idea.file.path, "status", `不正なIdea status: ${String(fm.status)}`));
  }
  if (!I.isStringArray(fm.aliases)) {
    issues.push(issue("error", idea.file.path, "aliases", "Idea aliasesは文字列配列である必要があります"));
  }
  if (!I.isStringArray(fm.tags)) {
    issues.push(issue("error", idea.file.path, "tags", "Idea tagsは文字列配列である必要があります"));
  }

  const adoption = I.adoptionState(fm);
  if (adoption === "legacy") {
    issues.push(issue("warning", idea.file.path, "adopted_project/adopted_at", "旧Idea: adoptedですが正式採用先・採用日が未記録です。履歴を保全したまま、ユーザーが採用先Projectと採用日を確認し手動で両方を記録してください。関連projectから推測・自動補完しません"));
  } else if (adoption === "partial") {
    issues.push(issue("error", idea.file.path, "adopted_project/adopted_at", "採用履歴が不完全です。adopted_projectとadopted_atは両方が必要です。履歴を確認して手動で整合させてください"));
  }
  if (I.isActive(fm.status) && adoption !== "none") {
    issues.push(issue("error", idea.file.path, "adopted_project/adopted_at", "active Ideaに採用済みメタデータを設定できません。採用履歴とstatusを手動で確認してください"));
  }
  if (I.hasAdoptionValue(fm.adopted_at) && !I.normalizeAdoptionDate(fm.adopted_at)) {
    issues.push(issue("error", idea.file.path, "adopted_at", "Idea adopted_atは実在する日付（厳密なYYYY-MM-DD）である必要があります"));
  }
}

function validateKnowledgeSchema(note, issues, K) {
  const fm = note.fm;

  if (K.normalizeStatus(fm.status) === null) {
    issues.push(issue("error", note.file.path, "status", `不正なKnowledge status: ${String(fm.status)}`));
  }
  if (K.normalizeCategory(fm.category) === null) {
    issues.push(issue("error", note.file.path, "category", `不正なKnowledge category: ${String(fm.category)}`));
  }
  if (K.normalizeMaturity(fm.maturity) === null) {
    issues.push(issue("error", note.file.path, "maturity", `不正なKnowledge maturity: ${String(fm.maturity)}`));
  }
  if (K.normalizeSourceType(fm.source_type) === null) {
    issues.push(issue("error", note.file.path, "source_type", `不正なKnowledge source_type: ${String(fm.source_type)}`));
  }
}

function validateRelation({ owner, field, targets, required, strict = false, files, issues, R }) {
  if (strict) {
    const result = R.inspectReference(owner.fm[field], targets, files);
    if (result.status === "missing") {
      if (required) issues.push(issue("error", owner.file.path, field, `${field}が未設定です（単一の参照が必須です）`));
    } else if (result.status === "malformed") {
      issues.push(issue("error", owner.file.path, field, `${field}は単一の有効なノートリンクである必要があります（配列・複数・不正な参照は不可）`));
    } else if (result.status === "ambiguous") {
      issues.push(issue("error", owner.file.path, field, `参照先が曖昧です。ノートの完全パスを指定してください: ${String(owner.fm[field])}`));
    } else if (result.status === "unresolved") {
      issues.push(issue("error", owner.file.path, field, `参照先を解決できません（パス・type・所属フォルダを確認してください）: ${String(owner.fm[field])}`));
    } else if (result.legacy) {
      issues.push(issue("warning", owner.file.path, field, "旧文字列形式の参照です。参照先を確認しノートリンクで記録してください"));
    }
    return result.target;
  }

  const value = owner.fm[field];
  if (!value) {
    if (required) issues.push(issue("error", owner.file.path, field, `${field}が未設定です`));
    return null;
  }

  if (!R.looksLikeLink(value)) {
    issues.push(issue("warning", owner.file.path, field, "旧文字列形式の参照です"));
  }

  const resolved = R.resolveIndexedReference(value, targets);
  if (!resolved) {
    issues.push(issue("error", owner.file.path, field, `参照先を解決できません: ${String(value)}`));
  }
  return resolved;
}

function asDate(value) {
  if (!value) return null;
  const parsed = window.moment(value, ["YYYY-MM-DD", window.moment.ISO_8601], true);
  return parsed.isValid() ? parsed.format("YYYY-MM-DD") : null;
}

function issue(severity, path, field, message) {
  return { severity, path, field, message };
}
