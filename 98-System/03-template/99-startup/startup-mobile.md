<%*
// Templater tp.user script functions are unavailable on Obsidian mobile.
// Instead, compile only the four trusted Core modules from fixed Vault paths
// using Obsidian Vault APIs (no desktop filesystem, Node require or network).
if (tp.obsidian?.Platform?.isMobile === true) {
  const appRef = tp.app ?? globalThis.app;
  const Notice = tp.obsidian?.Notice ?? globalThis.Notice;
  const sources = Object.freeze({
    style: "98-System/01-script/sync_core_style.js",
    periodic: "98-System/01-script/create_periodic_note.js",
    recurring: "98-System/01-script/generate_recurring_tasks.js",
    subscription: "98-System/01-script/sync_subscriptions.js",
  });

  async function runCoreScript(role, ...args) {
    const path = sources[role];
    if (!path) throw new Error(`Unknown mobile startup role: ${role}`);
    if (!appRef?.vault?.getAbstractFileByPath || !appRef.vault.read) {
      throw new Error("Obsidian Vault is unavailable");
    }
    const file = appRef.vault.getAbstractFileByPath(path);
    if (!file || file.path !== path || file.extension !== "js") {
      throw new Error(`Core startup script not found: ${path}`);
    }
    const source = await appRef.vault.read(file);
    if (typeof source !== "string" || source.length === 0 || source.length > 200000) {
      throw new Error(`Invalid Core startup script: ${path}`);
    }
    const mod = { exports: {} };
    // Inject Obsidian runtime dependencies into CommonJS module lexical scope.
    // This avoids tp.user, which Templater does not implement on mobile.
    new Function("module", "exports", "app", "window", "Notice", source)(
      mod, mod.exports, appRef, globalThis.window, Notice
    );
    if (typeof mod.exports !== "function") {
      throw new Error(`Core startup script is not a callable function: ${path}`);
    }
    return await mod.exports(tp, ...args);
  }

  try {
    const styleResult = await runCoreScript("style");
    if (styleResult?.runtimeActivation?.status === "reload_required") {
      new Notice("ObsidianCoreのCSS設定が変更されました。必要ならObsidianを再読み込みしてください。");
    }
  } catch (error) {
    console.error("Mobile CSS startup failed:", error);
    new Notice("ObsidianCore CSS起動時同期に失敗しました。");
  }
  try {
    await runCoreScript("periodic");
  } catch (error) {
    console.error("Mobile Periodic startup failed:", error);
    new Notice("Periodic Note起動時生成に失敗しました。");
  }
  try {
    await runCoreScript("recurring");
  } catch (error) {
    console.error("Mobile Recurring Task startup failed:", error);
    new Notice("Recurring Task起動時生成に失敗しました。Dashboardから手動生成も可能です。");
  }
  try {
    // Only the mobile profile writes automatic Subscription charges.
    const result = await runCoreScript("subscription", null, {
      automatic: true, silent: true,
    });
    if (!result?.ok) {
      new Notice("サブスク自動計上に失敗しました。Subscription設定・Monthly Note・接続を確認してください。", 8000);
    } else if (result.added > 0) {
      new Notice(`サブスク自動計上: ${result.added}件追加しました。`);
    }
  } catch (error) {
    console.error("Mobile Subscription startup failed:", error);
    new Notice("サブスク自動計上でエラーが発生しました。", 8000);
  }
}
-%>
