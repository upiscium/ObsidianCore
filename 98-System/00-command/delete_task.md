<%*
// Templater user functions are unavailable on mobile. Use the fixed Core path.
if (tp.obsidian?.Platform?.isMobile === true) {
  const scriptPath = "98-System/01-script/delete_task.js";
  const appRef = tp.app ?? globalThis.app;
  const file = appRef?.vault?.getAbstractFileByPath(scriptPath);
  if (!file || file.path !== scriptPath || file.extension !== "js") {
    throw new Error("Task deletion script not found in ObsidianCore");
  }
  const source = await appRef.vault.read(file);
  if (typeof source !== "string" || source.length === 0 || source.length > 200000) {
    throw new Error("Invalid Task deletion script source");
  }
  const mod = { exports: {} };
  new Function("module", "exports", '"use strict";\n' + source)(mod, mod.exports);
  if (typeof mod.exports !== "function") {
    throw new Error("Task deletion script is not callable");
  }
  await mod.exports(tp, { app: appRef, Notice: tp.obsidian?.Notice ?? globalThis.Notice });
} else {
  await tp.user.delete_task(tp);
}
-%>
