<%*
try {
  const styleResult = await tp.user.sync_core_style(tp);
  if (styleResult?.status && styleResult.status !== "unchanged") {
    console.info("ObsidianCore CSS/Appearance synchronized:", styleResult);
  }
  if (styleResult?.runtimeActivation?.status === "reload_required") {
    new Notice("ObsidianCoreのCSS有効化設定を修復しました。表示が変わらない場合はObsidianを再読み込みしてください。");
  }
} catch (error) {
  console.error("ObsidianCore CSS/Appearance startup synchronization failed:", error);
  new Notice("ObsidianCore CSS/Appearanceの起動時同期に失敗しました。Appearance > CSS snippets を確認してください。");
}

try {
  await tp.user.generate_recurring_tasks(tp);
} catch (error) {
  console.error("Recurring Task startup generation failed:", error);
  new Notice("Recurring Taskの起動時生成に失敗しました。Dashboardの手動生成を実行してください。");
}
-%>
