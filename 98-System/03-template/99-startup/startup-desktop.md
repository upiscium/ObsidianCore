<%*
// Device guard: never execute the desktop startup profile from an Android/iOS Obsidian session.
if (tp.obsidian?.Platform?.isMobile === false) {
  try {
    const styleResult = await tp.user.sync_core_style(tp);
    if (styleResult?.runtimeActivation?.status === "reload_required") {
      new Notice("ObsidianCoreのCSS設定が変更されました。必要ならObsidianを再読み込みしてください。");
    }
  } catch (error) {
    console.error("Desktop CSS startup failed:", error);
    new Notice("ObsidianCore CSS起動時同期に失敗しました。");
  }
  try {
    await tp.user.create_periodic_note(tp);
  } catch (error) {
    console.error("Desktop Periodic startup failed:", error);
    new Notice("Periodic Note起動時生成に失敗しました。");
  }
  try {
    await tp.user.generate_recurring_tasks(tp);
  } catch (error) {
    console.error("Desktop Recurring Task startup failed:", error);
    new Notice("Recurring Task起動時生成に失敗しました。");
  }
}
-%>
