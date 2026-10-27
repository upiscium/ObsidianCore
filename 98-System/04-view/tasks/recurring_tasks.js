async function loadExpression(path) {
  const source = await dv.io.load(path);
  if (!source) throw new Error("Dataview library not found: " + path);
  return new Function('"use strict"; return (' + source + ');')();
}

const S = await loadExpression("98-System/01-script/task_schedule_utils.js");
const createRecurring = await loadExpression("98-System/01-script/recurring_task_utils.js");
const createUI = await loadExpression("98-System/01-script/recurring_schedule_ui.js");
const R = createRecurring(S);

const only = typeof input?.only === "string" ? input.only : null;
const definitions = Array.from(
  dv.pages('"02-Task/Recurring"').where(page => page.type === "recurring-task")
).filter(page => only === null || page.file.path === only)
  .sort((a, b) => String(a.title ?? a.file.name).localeCompare(String(b.title ?? b.file.name), "ja"));

if (definitions.length === 0) {
  dv.paragraph(only ? "Recurring Definitionが見つかりません。" : "Recurring Definitionはありません。");
} else {
  const root = dv.el("div", "", { cls: "oc-recurring-list" });
  const editor = createUI({
    app, document, recurrence: R,
    today: () => window.moment().format("YYYY-MM-DD")
  });
  for (const page of definitions) editor.render(root, page);
}