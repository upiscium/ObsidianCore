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

const U = await loadLib("98-System/01-script/task_meta_utils.js");
const R = await loadLib("98-System/01-script/task_reference_utils.js");
const current = dv.current();
const dependencies = U.asArray(current?.depends_on);

if (dependencies.length === 0) {
  dv.paragraph("依存Taskはありません。");
} else {
  dv.table(
    ["Task", "Status"],
    dependencies.map(value => {
      const page = R.resolveDataviewPage(dv, value);
      const title = page
        ? String(page.title ?? page.file.name)
        : R.referenceLabel(value) || "不明";

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
