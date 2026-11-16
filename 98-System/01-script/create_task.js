// Legacy Task: Create endpoint. Remains actionable without a mode prompt.
module.exports = async params => {
  const path = "98-System/01-script/task_create_flow.js";
  const file = params.app.vault.getAbstractFileByPath(path);
  if (!file || file.extension !== "js") throw new Error(`Task creation flowが見つかりません: ${path}`);
  const flow = new Function(`"use strict"; return (${await params.app.vault.read(file)});`)();
  return flow.create({ params, mode: "actionable" });
};
