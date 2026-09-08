async function loadLib(path) {
  const source = await dv.io.load(path);

  if (!source) {
    throw new Error(`Dataview library not found: ${path}`);
  }

  return new Function(
    "dv",
    `"use strict"; return (${source});`
  )(dv);
}

async function loadReferenceLibs() {
  const genericSource = await dv.io.load("98-System/01-script/reference_utils.js");
  const runtimeSource = await dv.io.load("98-System/01-script/reference_runtime_utils.js");

  if (!genericSource) {
    throw new Error("Dataview library not found: 98-System/01-script/reference_utils.js");
  }

  if (!runtimeSource) {
    throw new Error("Dataview library not found: 98-System/01-script/reference_runtime_utils.js");
  }

  const G = new Function(`"use strict"; return (${genericSource});`)();
  const runtimeFactory = new Function(`"use strict"; return (${runtimeSource});`)();
  return { G, X: runtimeFactory(G) };
}

const U = await loadLib("98-System/01-script/task_meta_utils.js");
const { G, X } = await loadReferenceLibs();
const current = dv.current();

function taskTitle(page) {
  return String(page?.title ?? "").trim() || U.stripTaskTimestamp(page?.file?.name ?? "Task");
}

function taskRow(page, raw = null) {
  if (!page) {
    return [String(raw ?? ""), "⚠️ 参照不明"];
  }

  return [
    dv.fileLink(page.file.path, false, taskTitle(page)),
    U.taskStatusLabel(page.status)
  ];
}

dv.header(3, "このTaskが依存するTask");
const dependencies = U.asArray(current?.depends_on);
if (dependencies.length === 0) {
  dv.paragraph("依存Taskはありません。");
} else {
  dv.table(
    ["Task", "Status"],
    dependencies.map(value => taskRow(X.resolveDataviewPage(dv, value), value))
  );
}

dv.header(3, "このTaskに依存するTask");
const dependents = dv.pages('"02-Task"')
  .where(page => U.isTaskType(page.type))
  .where(page => page.file.path !== current?.file?.path)
  .where(page => U.asArray(page.depends_on).some(value =>
    X.resolveDataviewPage(dv, value)?.file?.path === current?.file?.path
  ))
  .array()
  .sort((a, b) => {
    const status = U.taskStatusOrder(a.status) - U.taskStatusOrder(b.status);
    return status !== 0 ? status : taskTitle(a).localeCompare(taskTitle(b), "ja");
  });

if (dependents.length === 0) {
  dv.paragraph("このTaskに依存するTaskはありません。");
} else {
  dv.table(["Task", "Status"], dependents.map(page => taskRow(page)));
}
