<%*
const safeNotice = tp?.obsidian?.Notice ?? globalThis.Notice;
try {
  if (!tp) throw new Error("Templater unavailable");
  const scriptPath = "98-System/01-script/transition_idea.js";
  if (tp.obsidian?.Platform?.isMobile === true || typeof tp.user?.transition_idea !== "function") {
    const appRef = tp.app ?? globalThis.app;
    const file = appRef?.vault?.getAbstractFileByPath(scriptPath);
    if (!file || file.path !== scriptPath || file.extension !== "js") throw new Error("script unavailable");
    const source = await appRef.vault.read(file);
    if (typeof source !== "string" || source.length === 0 || source.length > 200000) throw new Error("invalid script");
    const mod = { exports: {} };
    new Function("module", "exports", "app", "window", "Notice", source)(mod, mod.exports, appRef, globalThis.window, safeNotice);
    if (typeof mod.exports !== "function") throw new Error("script unavailable");
    await mod.exports(tp, "revoke");
  } else {
    await tp.user.transition_idea(tp, "revoke");
  }
} catch {
  if (typeof safeNotice === "function") new safeNotice("Ideaの採用取消を実行できませんでした。設定と対象Ideaを確認してください。", 8000);
}
-%>
