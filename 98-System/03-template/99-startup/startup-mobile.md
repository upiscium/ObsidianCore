<%*
// Mobile owns the automatic Subscription writer. Do not register a second
// automatic writer on desktop with the same synchronized Monthly Notes.
if (tp.obsidian?.Platform?.isMobile === true) {
  try {
    const styleResult = await tp.user.sync_core_style(tp);
    if (styleResult?.runtimeActivation?.status === "reload_required") {
      new Notice("ObsidianCoreのCSS設定が変更されました。必要ならObsidianを再読み込みしてください。");
    }
  } catch (error) {
    console.error("Mobile CSS startup failed:", error);
    new Notice("ObsidianCore CSS起動時同期に失敗しました。");
  }
  try {
    await tp.user.create_periodic_note(tp);
  } catch (error) {
    console.error("Mobile Periodic startup failed:", error);
    new Notice("Periodic Note起動時生成に失敗しました。");
  }
  // Recurring occurrences are deterministic by definition UID and due date.
  // Run on mobile too, independently of the sole Subscription auto-writer.
  try {
    await tp.user.generate_recurring_tasks(tp);
  } catch (error) {
    console.error("Mobile Recurring Task startup failed:", error);
    new Notice("Recurring Task起動時生成に失敗しました。Dashboardから手動生成も可能です。");
  }
  try {
    const result = await tp.user.sync_subscriptions(tp, null, {
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
