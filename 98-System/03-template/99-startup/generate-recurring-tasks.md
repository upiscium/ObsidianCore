<%*
try {
  const styleResult = await tp.user.sync_core_style(tp);
  if (styleResult?.status && styleResult.status !== "unchanged") {
    console.info("ObsidianCore CSS snippet synchronized:", styleResult);
  }
} catch (error) {
  console.error("ObsidianCore CSS startup synchronization failed:", error);
  new Notice("ObsidianCore CSSの起動時同期に失敗しました。Appearance > CSS snippets を確認してください。");
}

try {
  await tp.user.generate_recurring_tasks(tp);
} catch (error) {
  console.error("Recurring Task startup generation failed:", error);
  new Notice("Recurring Taskの起動時生成に失敗しました。Dashboardの手動生成を実行してください。");
}
-%>
