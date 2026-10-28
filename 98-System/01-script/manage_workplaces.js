const ADD_WORK_SOURCE = "98-System/01-script/add_work.js";

async function loadWorkCommands(app) {
  const file = app.vault.getFileByPath?.(ADD_WORK_SOURCE) ??
    app.vault.getAbstractFileByPath?.(ADD_WORK_SOURCE);
  if (!file || file.path !== ADD_WORK_SOURCE || file.extension !== "js") {
    throw new Error("ObsidianCore Work commands are unavailable");
  }
  const source = await app.vault.read(file);
  if (typeof source !== "string" || !source || source.length > 200000) {
    throw new Error("Invalid Work command script");
  }
  const mod = { exports: {} };
  new Function("module", "exports", '"use strict";\n' + source)(mod, mod.exports);
  if (typeof mod.exports.loadWorkplaceRegistry !== "function" ||
      typeof mod.exports.registerFromPrompt !== "function") {
    throw new Error("Invalid Work command exports");
  }
  return mod.exports;
}

function notify(context, message) {
  const NoticeCtor = context?.Notice ?? globalThis.Notice;
  if (typeof NoticeCtor === "function") new NoticeCtor(message);
}

async function runManageWorkplaces(context = {}) {
  const app = context.app ?? globalThis.app;
  if (!app?.vault) throw new Error("Obsidian app runtime is unavailable");
  const Work = await loadWorkCommands(app);
  const registry = await Work.loadWorkplaceRegistry(app);
  const prompt = Work.resolvePrompt(context);
  const suggester = Work.resolveSuggester(context);
  const state = await registry.readRegistry(app);

  const actions = [{ type: "register" }];
  const labels = ["＋ 勤務先を登録"];
  if (state.workplaces.length > 0) {
    actions.push({ type: "default" });
    labels.push("★ デフォルト勤務先を変更");
  }
  if (state.default_workplace !== null) {
    actions.push({ type: "clear" });
    labels.push("デフォルト設定を解除");
  }

  const choice = await suggester(labels, actions, "Workplace 設定");
  if (!choice) return null;

  if (choice.type === "register") {
    const name = await Work.registerFromPrompt({
      registry, app, prompt, suggester, context,
      currentDefault: state.default_workplace, hasWorkplaces: state.workplaces.length > 0
    });
    return name === null ? null : { operation: "register", workplace: name };
  }

  if (choice.type === "default") {
    const selected = await suggester(
      state.workplaces.map(name => name === state.default_workplace
        ? "★ " + name + " (現在のデフォルト)" : name),
      state.workplaces,
      "デフォルト勤務先を選択"
    );
    if (selected === null || selected === undefined) return null;
    const result = await registry.setDefaultWorkplace(app, selected);
    notify(context, "デフォルト勤務先を設定しました: " + result.default_workplace);
    return { operation: "default", workplace: result.default_workplace };
  }

  if (choice.type === "clear" && state.default_workplace !== null) {
    await registry.setDefaultWorkplace(app, null);
    notify(context, "デフォルト勤務先を解除しました。");
    return { operation: "clear", workplace: null };
  }
  throw new Error("無効なWorkplace操作です。");
}

async function manageWorkplaces(context = {}) {
  try {
    return await runManageWorkplaces(context);
  } catch (error) {
    notify(context, "勤務先設定の読込・保存に失敗しました。97-Settings/workplaces.jsonを確認してください。");
    throw error;
  }
}

module.exports = manageWorkplaces;
