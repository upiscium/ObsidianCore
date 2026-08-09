module.exports = async function createRecurringTask(tp) {
  const title = String(await tp.system.prompt("Recurring Taskタイトル") ?? "").trim();
  if (!title) return;

  const frequency = await tp.system.suggester(
    ["毎日系", "毎週系", "毎月系"],
    ["daily", "weekly", "monthly"],
    false,
    "繰り返し単位"
  );
  if (!frequency) return;

  const today = window.moment().format("YYYY-MM-DD");
  const anchorRaw = String(await tp.system.prompt("Anchor日 (YYYY-MM-DD / 空欄=今日)") ?? "").trim();
  const anchor = anchorRaw || today;
  if (!window.moment(anchor, "YYYY-MM-DD", true).isValid()) {
    new Notice("Anchor日はYYYY-MM-DD形式にしてください。");
    return;
  }

  const intervalRaw = String(await tp.system.prompt("Interval (例: 1 = 毎回)") ?? "1").trim() || "1";
  const interval = Number(intervalRaw);
  if (!Number.isInteger(interval) || interval < 1 || interval > 365) {
    new Notice("Intervalは1〜365の整数にしてください。");
    return;
  }

  const lookaheadRaw = String(await tp.system.prompt("先何日分まで生成するか (0〜90)") ?? "7").trim() || "7";
  const lookahead = Number(lookaheadRaw);
  if (!Number.isInteger(lookahead) || lookahead < 0 || lookahead > 90) {
    new Notice("lookahead_daysは0〜90の整数にしてください。");
    return;
  }

  const priorityChoice = await tp.system.suggester(
    ["🔴 高", "🟡 中", "🟢 低", "▫️ 無"],
    ["high", "medium", "low", null],
    false,
    "Priority"
  );
  if (priorityChoice === undefined) return;

  const { G, ER, E } = await loadEntityUtils();
  const workspaces = ER.findEntityNotes(app, {
    folder: "03-Workspace",
    types: ["workspace"],
    isActiveStatus: E.isActiveStatus
  });
  const none = { none: true };
  const workspace = await tp.system.suggester(
    ["▫️ Workspaceなし", ...workspaces.map(item => item.displayName)],
    [none, ...workspaces],
    false,
    "Workspace"
  );
  if (!workspace) return;

  let project = none;
  if (!workspace.none) {
    const projects = ER.findEntityNotes(app, {
      folder: "10-Project",
      types: ["project"],
      isActiveStatus: E.isActiveStatus
    }).filter(item => ER.entityMatchesReference(item.workspace, workspace));
    project = await tp.system.suggester(
      ["▫️ Projectなし", ...projects.map(item => item.displayName)],
      [none, ...projects],
      false,
      "Project"
    );
    if (!project) return;
  }

  const folder = "02-Task/Recurring";
  await ensureFolder(folder);
  const path = await uniquePath(folder, sanitizeFilename(title));
  const uid = `rct_${crypto.randomUUID()}`;
  const workspaceLink = workspace.none ? null : ER.makeEntityLink(app, workspace, path);
  const projectLink = project.none ? null : ER.makeEntityLink(app, project, path);

  const content = [
    "---",
    "type: recurring-task",
    `uid: ${uid}`,
    `title: ${yamlString(title)}`,
    "enabled: true",
    `frequency: ${frequency}`,
    `interval: ${interval}`,
    `anchor: ${anchor}`,
    `lookahead_days: ${lookahead}`,
    "start_offset_days:",
    "due_offset_days: 0",
    `priority: ${priorityChoice ?? ""}`,
    `workspace: ${workspaceLink ? yamlString(workspaceLink) : ""}`,
    `project: ${projectLink ? yamlString(projectLink) : ""}`,
    "---",
    `# ${title}`,
    "",
    "**有効:** `INPUT[toggle:enabled]`",
    "",
    "- `frequency`: daily / weekly / monthly",
    "- `interval`: 1なら毎回、2なら隔回",
    "- weeklyはAnchorと同じ曜日、monthlyはAnchorと同じ日付です。存在しない月日はskipします。",
    "- `lookahead_days`: Generatorが先何日分までTaskを用意するか",
    "- `start_offset_days`: 空欄ならStartなし。Occurrence日からの相対日数を指定できます。",
    "- `due_offset_days`: Occurrence日からDueまでの相対日数です。"
  ].join("\n");

  const file = await app.vault.create(path, content);
  await app.workspace.getLeaf(false).openFile(file);
  new Notice(`Recurring Task Definitionを作成しました: ${title}`);

  async function loadEntityUtils() {
    const genericFile = app.vault.getAbstractFileByPath("98-System/01-script/reference_utils.js");
    const referenceFile = app.vault.getAbstractFileByPath("98-System/01-script/entity_reference_utils.js");
    const metaFile = app.vault.getAbstractFileByPath("98-System/01-script/entity_meta_utils.js");
    if (!genericFile || !referenceFile || !metaFile) throw new Error("Entity utilityが見つかりません");
    const G = new Function(`"use strict"; return (${await app.vault.read(genericFile)});`)();
    const factory = new Function(`"use strict"; return (${await app.vault.read(referenceFile)});`)();
    const E = new Function(`"use strict"; return (${await app.vault.read(metaFile)});`)();
    return { G, ER: factory(G), E };
  }

  async function ensureFolder(folderPath) {
    let current = "";
    for (const part of folderPath.split("/").filter(Boolean)) {
      current = current ? `${current}/${part}` : part;
      if (!app.vault.getAbstractFileByPath(current)) await app.vault.createFolder(current);
    }
  }

  async function uniquePath(folderPath, baseName) {
    let path = `${folderPath}/${baseName}.md`;
    let index = 2;
    while (app.vault.getAbstractFileByPath(path)) {
      path = `${folderPath}/${baseName}-${index}.md`;
      index += 1;
    }
    return path;
  }

  function sanitizeFilename(value) {
    const result = String(value).replace(/[\\/:*?"<>|#^\[\]]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 100);
    return result || "Recurring Task";
  }

  function yamlString(value) { return JSON.stringify(String(value ?? "")); }
};
