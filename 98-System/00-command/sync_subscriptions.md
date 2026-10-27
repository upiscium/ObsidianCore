<%*
// Templater User Functions are not supported on mobile. Use the same fixed
// Core script as Startup, while preserving the desktop tp.user entrypoint.
const ManualNotice = tp.obsidian?.Notice ?? globalThis.Notice;
try {
  if (tp.obsidian?.Platform?.isMobile === true) {
    const scriptPath = "98-System/01-script/sync_subscriptions.js";
    const appRef = tp.app ?? globalThis.app;
    const file = appRef?.vault?.getAbstractFileByPath(scriptPath);
    if (!file || file.path !== scriptPath || file.extension !== "js") {
      throw new Error("Subscription Sync script not found in ObsidianCore");
    }
    const source = await appRef.vault.read(file);
    if (typeof source !== "string" || source.length === 0 || source.length > 200000) {
      throw new Error("Invalid Subscription Sync script source");
    }
    const mod = { exports: {} };
    new Function("module", "exports", "app", "window", "Notice", source)(
      mod, mod.exports, appRef, globalThis.window, ManualNotice
    );
    if (typeof mod.exports !== "function") {
      throw new Error("Subscription Sync script is not callable");
    }
    await mod.exports(tp);
  } else {
    await tp.user.sync_subscriptions(tp);
  }
} catch (error) {
  console.error("Manual Subscription Sync failed:", error);
  if (typeof ManualNotice === "function") {
    new ManualNotice("サブスク同期を実行できませんでした。TemplaterとConsoleを確認してください。", 8000);
  }
  throw error;
}
-%>
