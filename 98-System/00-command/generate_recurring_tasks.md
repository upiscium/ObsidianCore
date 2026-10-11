<%*
// Templater User Functions are unavailable on mobile. Keep the canonical
// Recurring generator shared; load its fixed, trusted Core path through Vault.
if (tp.obsidian?.Platform?.isMobile === true) {
  const scriptPath = "98-System/01-script/generate_recurring_tasks.js";
  const appRef = tp.app ?? globalThis.app;
  const file = appRef?.vault?.getAbstractFileByPath(scriptPath);
  if (!file || file.path !== scriptPath || file.extension !== "js") {
    throw new Error("Recurring Task generator not found in ObsidianCore");
  }
  const source = await appRef.vault.read(file);
  if (typeof source !== "string" || source.length === 0 || source.length > 200000) {
    throw new Error("Invalid Recurring Task generator source");
  }
  const mod = { exports: {} };
  const MobileNotice = tp.obsidian?.Notice ?? globalThis.Notice;
  new Function("module", "exports", "app", "window", "Notice", source)(
    mod, mod.exports, appRef, globalThis.window, MobileNotice
  );
  if (typeof mod.exports !== "function") {
    throw new Error("Recurring Task generator is not callable");
  }
  await mod.exports(tp);
} else {
  await tp.user.generate_recurring_tasks(tp);
}
-%>
