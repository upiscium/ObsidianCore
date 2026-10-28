const MONTHLY_FOLDER = "01-MonthlyNote";
const WORK_HEADING = "# 今月の勤務";
const WORKPLACE_REGISTRY_SOURCE = "98-System/05-lib/work/workplace_registry.js";

function parseWorkDuration(value) {
  const match = String(value ?? "").trim().match(/^(\d{1,2}):([0-5]\d)$/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 24 || (hours === 24 && minutes !== 0)) return null;

  const total = hours * 60 + minutes;
  return total > 0 ? total : null;
}

function formatWorkDuration(value) {
  const total = Number(value);
  if (!Number.isInteger(total) || total < 0) return "0m";

  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours && minutes) return `${hours}h ${minutes}m`;
  if (hours) return `${hours}h`;
  return `${minutes}m`;
}

function normalizeWorkplaceInput(value) {
  const workplace = String(value ?? "").trim();
  return workplace && !/[\[\]\u0000-\u001f]/.test(workplace) ? workplace : null;
}

function buildWorkRecord(date, workMin, workplace) {
  const normalized = normalizeWorkplaceInput(workplace);
  if (normalized === null) throw new TypeError("A valid Workplace is required");
  return `- [date:: ${date}] [workplace:: ${normalized}] [work_min:: ${workMin}]`;
}

function appendWorkRecord(content, record) {
  const source = String(content ?? "");
  const eol = source.includes("\r\n") ? "\r\n" : "\n";
  const lines = source.split(/\r?\n/);
  const headingIndex = lines.findIndex(line => line.trim() === WORK_HEADING);

  if (headingIndex < 0) {
    const trimmedEnd = source.replace(/[\r\n]+$/, "");
    return `${trimmedEnd}${trimmedEnd ? eol + eol : ""}${WORK_HEADING}${eol}${record}${eol}`;
  }

  let sectionEnd = headingIndex + 1;
  while (sectionEnd < lines.length && !/^#{1,6}\s+/.test(lines[sectionEnd])) {
    sectionEnd += 1;
  }

  let insertAt = sectionEnd;
  while (insertAt > headingIndex + 1 && lines[insertAt - 1].trim() === "") {
    insertAt -= 1;
  }
  lines.splice(insertAt, 0, record);
  return lines.join(eol);
}

function resolveApp(context) {
  if (context?.app?.workspace && context?.app?.vault) return context.app;
  if (globalThis.app?.workspace && globalThis.app?.vault) return globalThis.app;
  throw new Error("Obsidian app runtime is unavailable");
}

function resolveMoment(context) {
  if (typeof context?.moment === "function") return context.moment;
  if (typeof globalThis.window?.moment === "function") return globalThis.window.moment;
  if (typeof globalThis.moment === "function") return globalThis.moment;
  throw new Error("moment runtime is unavailable");
}

function resolvePrompt(context) {
  if (typeof context?.system?.prompt === "function") {
    return message => context.system.prompt(message);
  }
  if (typeof context?.quickAddApi?.inputPrompt === "function") {
    return message => context.quickAddApi.inputPrompt(message);
  }
  throw new Error("No supported prompt provider was supplied");
}

function notify(context, message) {
  const NoticeCtor = context?.Notice ?? globalThis.Notice;
  if (typeof NoticeCtor === "function") new NoticeCtor(message);
}

function resolveSuggester(context) {
  if (typeof context?.system?.suggester === "function") {
    return (labels, values, placeholder) =>
      context.system.suggester(labels, values, false, placeholder);
  }
  if (typeof context?.quickAddApi?.suggester === "function") {
    return (labels, values) => context.quickAddApi.suggester(labels, values);
  }
  throw new Error("Workplace selection requires Templater or QuickAdd suggester");
}

// Fixed, trusted Vault path; no Node require or plugin-local path dependency.
async function loadWorkplaceRegistry(app) {
  const file = app.vault.getFileByPath?.(WORKPLACE_REGISTRY_SOURCE) ??
    app.vault.getAbstractFileByPath?.(WORKPLACE_REGISTRY_SOURCE);
  if (!file || file.path !== WORKPLACE_REGISTRY_SOURCE || file.extension !== "js") {
    throw new Error("ObsidianCore Workplace registry library is unavailable");
  }
  const source = await app.vault.read(file);
  if (typeof source !== "string" || !source || source.length > 200000) {
    throw new Error("Invalid Workplace registry library source");
  }
  const mod = { exports: {} };
  new Function("module", "exports", '"use strict";\n' + source)(mod, mod.exports);
  if (typeof mod.exports.readRegistry !== "function" ||
      typeof mod.exports.registerWorkplace !== "function" ||
      typeof mod.exports.setDefaultWorkplace !== "function") {
    throw new Error("Invalid Workplace registry module");
  }
  return mod.exports;
}

async function registerFromPrompt({ registry, app, prompt, suggester, context, currentDefault, hasWorkplaces }) {
  const rawName = await prompt("登録する勤務先名 (80文字以内)");
  if (rawName === null || rawName === undefined) return null;
  const name = registry.normalizeName(rawName);
  if (name === null) {
    notify(context, "勤務先名が不正です。空欄、角括弧、改行は使用できません。");
    return null;
  }

  let makeDefault = currentDefault === null && !hasWorkplaces;
  if (!makeDefault) {
    const selection = await suggester(
      ["新しい勤務先をデフォルトに設定", "現在のデフォルトを維持"],
      [true, false],
      "デフォルトの勤務先を変更しますか？"
    );
    if (selection === null || selection === undefined) return null;
    makeDefault = selection;
  }

  const result = await registry.registerWorkplace(app, name, makeDefault);
  notify(context, result.created ? "勤務先を登録しました: " + result.name :
    "既に登録済みの勤務先です: " + result.name);
  return result.name;
}

async function chooseWorkplace({ registry, app, prompt, suggester, context }) {
  const state = await registry.readRegistry(app);
  if (state.workplaces.length === 0) {
    return registerFromPrompt({
      registry, app, prompt, suggester, context, currentDefault: null, hasWorkplaces: false
    });
  }

  const ordered = [...state.workplaces].sort((a, b) => {
    if (a === state.default_workplace) return -1;
    if (b === state.default_workplace) return 1;
    return a.localeCompare(b);
  });
  const choices = ordered.map(name => ({ kind: "workplace", name }));
  choices.push({ kind: "register" });
  const labels = ordered.map(name =>
    name === state.default_workplace ? "★ " + name + " (デフォルト)" : name
  );
  labels.push("＋ 新しい勤務先を登録");

  const selected = await suggester(labels, choices, "勤務先を選択");
  if (!selected) return null;
  if (selected.kind === "register") {
    return registerFromPrompt({
      registry, app, prompt, suggester, context,
      currentDefault: state.default_workplace, hasWorkplaces: true
    });
  }
  if (selected.kind !== "workplace" || !state.workplaces.includes(selected.name)) {
    throw new Error("無効な勤務先選択です。");
  }
  return selected.name;
}

async function addWork(context = {}) {
  const runtimeApp = resolveApp(context);
  const runtimeMoment = resolveMoment(context);
  const prompt = resolvePrompt(context);

  const activeFile = runtimeApp.workspace.getActiveFile();
  const activeDate = activeFile?.basename && /^\d{4}-\d{2}-\d{2}$/.test(activeFile.basename)
    ? activeFile.basename
    : null;
  const today = runtimeMoment().format("YYYY-MM-DD");
  const defaultDate = activeDate || today;

  const dateRaw = await prompt(`勤務日 (YYYY-MM-DD / 空欄=${defaultDate})`);
  if (dateRaw === null || dateRaw === undefined) return null;

  const date = String(dateRaw).trim() || defaultDate;
  const dateMoment = runtimeMoment(date, "YYYY-MM-DD", true);
  if (!dateMoment.isValid()) {
    notify(context, "勤務日はYYYY-MM-DD形式の実在する日付にしてください。");
    return null;
  }

  const durationRaw = await prompt("勤務時間 (H:MM / 例: 7:30)");
  if (durationRaw === null || durationRaw === undefined) return null;

  const workMin = parseWorkDuration(durationRaw);
  if (workMin === null) {
    notify(context, "勤務時間は0:01〜24:00のH:MM形式で入力してください。");
    return null;
  }

  const year = dateMoment.format("YYYY");
  const month = dateMoment.format("YYYY-MM");
  const targetPath = `${MONTHLY_FOLDER}/${year}/${month}.md`;
  const targetFile = runtimeApp.vault.getFileByPath(targetPath);

  if (!targetFile) {
    notify(context, `対象のMonthly Noteが見つかりません:\n${targetPath}`);
    return null;
  }
  if (typeof runtimeApp.vault.process !== "function") {
    notify(context, "安全な勤務記録の追記APIが利用できません。");
    throw new Error("Work recording requires Obsidian Vault.process");
  }

  let workplace;
  try {
    const registry = await loadWorkplaceRegistry(runtimeApp);
    workplace = await chooseWorkplace({
      registry, app: runtimeApp, prompt,
      suggester: resolveSuggester(context), context
    });
  } catch (error) {
    notify(context, "勤務先設定の読込・保存に失敗しました。96-Global/01-workplace/workplaces.jsonを確認してください。");
    throw error;
  }
  if (workplace === null) return null;

  const record = buildWorkRecord(date, workMin, workplace);
  // Obsidian process serializes same-Vault writes and avoids lost updates
  // from concurrent Add work calls on the same client.
  await runtimeApp.vault.process(targetFile, current => appendWorkRecord(current, record));

  notify(context, `勤務時間を記録しました: ${date} / ${workplace} / ${formatWorkDuration(workMin)}`);
  return {
    date,
    workplace,
    work_min: workMin,
    target_path: targetPath
  };
}

module.exports = addWork;
module.exports.parseWorkDuration = parseWorkDuration;
module.exports.formatWorkDuration = formatWorkDuration;
module.exports.buildWorkRecord = buildWorkRecord;
module.exports.normalizeWorkplaceInput = normalizeWorkplaceInput;
module.exports.appendWorkRecord = appendWorkRecord;
module.exports.resolvePrompt = resolvePrompt;
module.exports.resolveSuggester = resolveSuggester;
module.exports.loadWorkplaceRegistry = loadWorkplaceRegistry;
module.exports.chooseWorkplace = chooseWorkplace;
module.exports.registerFromPrompt = registerFromPrompt;
module.exports.resolveApp = resolveApp;
