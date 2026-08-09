async function loadExpression(path) {
  const source = await dv.io.load(path);
  if (!source) throw new Error(`Dataview library not found: ${path}`);
  return new Function(`"use strict"; return (${source});`)();
}

const S = await loadExpression("98-System/01-script/task_schedule_utils.js");
const recurringFactory = await loadExpression("98-System/01-script/recurring_task_utils.js");
const R = recurringFactory(S);

const definitions = Array.from(
  dv.pages('"02-Task/Recurring"').where(page => page.type === "recurring-task")
).sort((a, b) => String(a.title ?? a.file.name).localeCompare(String(b.title ?? b.file.name), "ja"));

function title(page) {
  return String(page.title ?? "").trim() || page.file.name;
}

function enabledToggle(page) {
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = page.enabled === true;
  checkbox.setAttribute("aria-label", `${title(page)} のRecurring生成を有効化`);
  checkbox.addEventListener("change", async () => {
    checkbox.disabled = true;
    try {
      const file = app.vault.getAbstractFileByPath(page.file.path);
      if (!file || file.extension !== "md") throw new Error("Recurring Definitionが見つかりません");
      await app.fileManager.processFrontMatter(file, fm => { fm.enabled = checkbox.checked; });
    } catch (error) {
      console.error(error);
      checkbox.checked = !checkbox.checked;
      new Notice("Recurring Definitionの有効状態を更新できませんでした。");
    } finally {
      checkbox.disabled = false;
    }
  });
  return checkbox;
}

function scheduleText(page) {
  try {
    const def = R.normalizeDefinition(page);
    const suffix = def.interval === 1 ? "" : ` ×${def.interval}`;
    return `${def.frequency}${suffix}`;
  } catch (error) {
    return `⚠️ ${error.message}`;
  }
}

function nextOccurrences(page) {
  try {
    const todayValue = dv.date("today").startOf("day");
    const today = todayValue.toISODate ? todayValue.toISODate() : String(todayValue).slice(0, 10);
    const def = R.normalizeDefinition(page);
    if (!def.enabled) return "-";
    return R.occurrencesInWindow(def, today).slice(0, 3).join(", ") || "-";
  } catch {
    return "-";
  }
}

if (definitions.length === 0) {
  dv.paragraph("Recurring Definitionはありません。");
} else {
  dv.table(
    ["有効", "Definition", "Schedule", "Anchor", "Lookahead", "次回Occurrence"],
    definitions.map(page => [
      enabledToggle(page),
      dv.fileLink(page.file.path, false, title(page)),
      scheduleText(page),
      S.normalizeDateKey(page.anchor) ?? "-",
      `${page.lookahead_days ?? 7}日`,
      nextOccurrences(page)
    ])
  );
}
