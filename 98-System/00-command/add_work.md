<%*
// Obsidian Mobile cannot use tp.user functions. Load this trusted Core script
// through the Vault API; desktop retains its registered Templater user function.
if (tp.obsidian?.Platform?.isMobile === true) {
  const scriptPath = "98-System/01-script/add_work.js";
  const appRef = tp.app ?? globalThis.app;
  const file = appRef?.vault?.getFileByPath?.(scriptPath) ??
    appRef?.vault?.getAbstractFileByPath?.(scriptPath);
  if (!file || file.path !== scriptPath || file.extension !== "js") {
    throw new Error("Work script not found in ObsidianCore");
  }
  const source = await appRef.vault.read(file);
  if (typeof source !== "string" || !source || source.length > 200000) {
    throw new Error("Invalid Work script source");
  }
  const mod = { exports: {} };
  new Function("module", "exports", '"use strict";\n' + source)(mod, mod.exports);
  if (typeof mod.exports !== "function") {
    throw new Error("Work script is not callable");
  }
  await mod.exports({
    app: appRef, system: tp.system,
    moment: globalThis.window?.moment,
    Notice: tp.obsidian?.Notice ?? globalThis.Notice
  });
} else {
  await tp.user.add_work(tp);
}
-%>
