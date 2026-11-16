// Primary Task creation UI: choose Actionable or Backlog, then use one flow.
module.exports = async params => {
  const path = "98-System/01-script/task_create_flow.js";
  const file = params.app.vault.getAbstractFileByPath(path);
  if (!file || file.extension !== "js") throw new Error(`Task creation flowが見つかりません: ${path}`);
  const flow = new Function(`"use strict"; return (${await params.app.vault.read(file)});`)();
  const choice = await flow.selectMode({ quickAddApi: params.quickAddApi, variables: params.variables });
  if (choice.cancelled) return;
  return flow.create({ params, mode: choice.mode });
};
