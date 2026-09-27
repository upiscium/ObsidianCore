module.exports = async function createIdea(tp) {
  const { ER, E } = await loadEntityUtils();
  const context = await chooseContext(tp, ER, E);
  if (!context) return;

  const rawTitle = await tp.system.prompt("Idea名を入力してください:");
  if (rawTitle === null || rawTitle === undefined) return;
  const title = sanitizeFileName(String(rawTitle));
  if (!title) {
    new Notice("Idea名が空か，ファイル名として使用できません。");
    return;
  }

  const root = "05-Idea";
  await ensureFolder(root);
  const path = await uniqueMarkdownPath(root, title);
  const templateFile = app.vault.getAbstractFileByPath("98-System/03-template/01-note/idea-note-template.md");
  if (!templateFile || templateFile.extension !== "md") {
    throw new Error("Idea Note templateが見つかりません。");
  }

  const template = await app.vault.read(templateFile);
  const body = stripLeadingFrontmatter(template).replaceAll("__TITLE__", title);
  const workspaceLink = ER.makeEntityLink(app, context.workspace, path);
  const projectLink = ER.makeEntityLink(app, context.project, path);
  const created = window.moment().format("YYYY-MM-DD");
  const content = [
    "---",
    "type: idea",
    `title: ${yamlString(title)}`,
    `created: ${created}`,
    `workspace: ${yamlString(workspaceLink)}`,
    `project: ${projectLink ? yamlString(projectLink) : ""}`,
    "status: active",
    "aliases: []",
    "tags: []",
    "---",
    body.trimStart()
  ].join("\n");

  const file = await app.vault.create(path, content.endsWith("\n") ? content : content + "\n");
  try {
    await app.workspace?.getLeaf?.(false)?.openFile?.(file);
  } catch (error) {
    console.warn("作成したIdeaを開けませんでした", error);
  }

  const suffix = context.project
    ? ` / Project: ${context.project.displayName}`
    : "";
  new Notice(`Idea「${title}」を作成しました。Workspace: ${context.workspace.displayName}${suffix}`);
  return { status: "created", path, workspace: workspaceLink, project: projectLink };
};

async function chooseContext(tp, ER, E) {
  const workspaces = ER.findEntityNotes(app, {
    folder: "03-Workspace",
    types: ["workspace"],
    isEligible: entity => E.isWorkspaceActiveLifecycle(entity.lifecycle)
  });

  if (workspaces.length === 0) {
    new Notice("Active Workspaceがありません。Ideaを作成できません。");
    return null;
  }

  const workspace = await tp.system.suggester(
    workspaces.map(entity => entity.displayName),
    workspaces,
    false,
    "Workspaceを選択"
  );
  if (!workspace) return null;

  const projects = ER.findEntityNotes(app, {
    folder: "10-Project",
    types: ["project"],
    isEligible: entity => E.isProjectActiveStatus(entity.status)
  }).filter(project => ER.entityMatchesReference(project.workspace, workspace));

  if (projects.length === 0) return { workspace, project: null };

  const none = { kind: "none" };
  const project = await tp.system.suggester(
    ["▫️ Projectを設定しない", ...projects.map(entity => entity.displayName)],
    [none, ...projects],
    false,
    "Projectを選択"
  );
  if (!project) return null;
  return { workspace, project: project.kind === "none" ? null : project };
}

async function loadEntityUtils() {
  const genericPath = "98-System/01-script/reference_utils.js";
  const referencePath = "98-System/01-script/entity_reference_utils.js";
  const metadataPath = "98-System/01-script/entity_meta_utils.js";
  const genericFile = app.vault.getAbstractFileByPath(genericPath);
  const referenceFile = app.vault.getAbstractFileByPath(referencePath);
  const metadataFile = app.vault.getAbstractFileByPath(metadataPath);
  if (!genericFile || genericFile.extension !== "js") throw new Error(`Reference utilityが見つかりません: ${genericPath}`);
  if (!referenceFile || referenceFile.extension !== "js") throw new Error(`Entity reference utilityが見つかりません: ${referencePath}`);
  if (!metadataFile || metadataFile.extension !== "js") throw new Error(`Entity metadata utilityが見つかりません: ${metadataPath}`);
  const G = new Function(`"use strict"; return (${await app.vault.read(genericFile)});`)();
  const factory = new Function(`"use strict"; return (${await app.vault.read(referenceFile)});`)();
  const E = new Function(`"use strict"; return (${await app.vault.read(metadataFile)});`)();
  return { ER: factory(G), E };
}

async function ensureFolder(path) {
  const parts = String(path).split("/").filter(Boolean);
  let current = "";
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    const existing = app.vault.getAbstractFileByPath(current);
    if (existing) {
      if (!Array.isArray(existing.children)) throw new Error(`フォルダではありません: ${current}`);
      continue;
    }
    await app.vault.createFolder(current);
  }
}

async function uniqueMarkdownPath(folder, basename) {
  let suffix = 1;
  while (true) {
    const name = suffix === 1 ? basename : `${basename}-${suffix}`;
    const path = `${folder}/${name}.md`;
    if (!app.vault.getAbstractFileByPath(path)) return path;
    suffix += 1;
  }
}

function stripLeadingFrontmatter(content) {
  const text = String(content ?? "");
  const match = text.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  return match ? text.slice(match[0].length) : text;
}

function sanitizeFileName(input) {
  const name = String(input ?? "")
    .trim()
    .replace(/[\\/:*?"<>|#^\[\]]/g, "")
    .replace(/\s+/g, " ");
  if (!name || name === "." || name === "..") return "";
  return name;
}

function yamlString(value) {
  return JSON.stringify(String(value ?? ""));
}
