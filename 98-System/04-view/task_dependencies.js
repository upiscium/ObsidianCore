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
const current = dv.current();

function normalizeReference(value) {
  if (value && typeof value === "object" && value.path) {
    return String(value.path).replace(/\.md$/, "");
  }

  return String(value ?? "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/^\[\[/, "")
    .replace(/\]\]$/, "")
    .split("|")[0]
    .replace(/\.md$/, "");
}

function resolveDependency(value) {
  if (!value) return null;

  if (value && typeof value === "object" && value.path) {
    return dv.page(value.path);
  }

  const target = normalizeReference(value);

  if (!target) return null;

  return dv.page(target) ?? dv.page(target.split("/").pop());
}

function dependencyTitle(value, page) {
  if (page) {
    return String(page.title ?? page.file.name);
  }

  const raw = String(value ?? "");
  const alias = raw.match(/\|([^\]]+)\]\]$/)?.[1];

  return alias ?? normalizeReference(value).split("/").pop() ?? "不明";
}

const dependencies = U.asArray(current?.depends_on);

if (dependencies.length === 0) {
  dv.paragraph("依存Taskはありません。");
} else {
  dv.table(
    ["Task", "Status"],
    dependencies.map(value => {
      const page = resolveDependency(value);
      const title = dependencyTitle(value, page);

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
