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
const dependencies = U.asArray(current?.depends_on);

if (dependencies.length === 0) {
  dv.paragraph("依存Taskはありません。");
} else {
  dv.table(
    ["Task", "Status"],
    dependencies.map(value => {
      const page = X.resolveDataviewPage(dv, value);
      const title = page
        ? String(page.title ?? page.file.name)
        : G.referenceLabel(value) || "不明";

      if (!page) {
        return [String(value), "⚠️ 参照不明"];
      }

      return [
        dv.fileLink(page.file.path, false, title),
        U.taskStatusLabel(page.status)
      ];
    })
  );
}
