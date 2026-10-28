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

  const scheduleFields = [];
  if (frequency === "weekly") {
    const answer = await tp.system.prompt("曜日 (1=月〜7=日、複数は1,3,5、空欄=Anchorの曜日)");
    if (answer === null) return;
    const value = String(answer).replace(/[、，\s]/g, "");
    if (value) {
      if (!/^[1-7](,[1-7])*$/.test(value)) {
        new Notice("曜日は1〜7をカンマ区切りで指定してください。");
        return;
      }
      const days = value.split(",").map(Number);
      if (new Set(days).size !== days.length) {
        new Notice("同じ曜日が重複しています。");
        return;
      }
      scheduleFields.push("weekdays: [" + days.sort((a,b)=>a-b).join(", ") + "]");
    }
  } else if (frequency === "monthly") {
    const mode = await tp.system.suggester(
      ["Anchorと同じ日付", "毎月の第n週・指定曜日"], ["date", "week"], false, "月次スケジュール"
    );
    if (!mode) return;
    if (mode === "week") {
      const nth = await tp.system.suggester(
        ["第1", "第2", "第3", "第4", "第5", "最終"],
        [1, 2, 3, 4, 5, "last"], false, "第何週"
      );
      if (!nth) return;
      const day = await tp.system.suggester(
        ["月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日", "日曜日"],
        [1, 2, 3, 4, 5, 6, 7], false, "曜日"
      );
      if (!day) return;
      scheduleFields.push("month_week: " + nth, "month_weekday: " + day);
    }
  }

  const lookaheadRaw = String(await tp.system.prompt("先何日分まで生成するか (0〜90)") ?? "7").trim() || "7";
  const lookahead = Number(lookaheadRaw);
  if (!Number.isInteger(lookahead) || lookahead < 0 || lookahead > 90) {
    new Notice("lookahead_daysは0〜90の整数にしてください。");
    return;
  }

  const priorityChoice = await tp.system.suggester(
    ["🔴 高", "🟡 中", "🟢 低", "▫️ 無"],
    ["high", "medium", "low", "none"],
    false,
    "Priority"
  );
  if (!priorityChoice) return;
  const priority = priorityChoice === "none" ? null : priorityChoice;

  const { ER, E } = await loadEntityUtils();
  const workspaces = ER.findEntityNotes(app, {
    folder: "03-Workspace",
    types: ["workspace"],
    isEligible: entity => E.isWorkspaceTaskAssignableLifecycle(entity.lifecycle)
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
      isEligible: entity => E.isProjectTaskAssignableStatus(entity.status)
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
    ...scheduleFields,
    `lookahead_days: ${lookahead}`,
    "start_offset_days:",
    "due_offset_days: 0",
    `priority: ${priority ?? ""}`,
    `workspace: ${workspaceLink ? yamlString(workspaceLink) : ""}`,
    `project: ${projectLink ? yamlString(projectLink) : ""}`,
    "---",
    `# ${title}`,
    "",
    "## 繰り返し設定",
    "",
    "```dvjs",
    'await dv.view("98-System/04-view/tasks/recurring_tasks", { only: dv.current().file.path });',
    "```",
    "",
    "- `frequency`: daily / weekly / monthly",
    "- `interval`: 1なら毎回、2なら隔回",
    "- weeklyは曜日の複数指定、monthlyは第n曜日（最終を含む）を選択できます。第5曜日がない月はスキップします。",
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
    return { ER: factory(G), E };
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
