<%*
try {
  await tp.user.generate_recurring_tasks(tp);
} catch (error) {
  console.error("Recurring Task startup generation failed:", error);
  new Notice("Recurring Taskの起動時生成に失敗しました。Dashboardの手動生成を実行してください。");
}
-%>
