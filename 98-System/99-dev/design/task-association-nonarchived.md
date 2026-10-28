# Task所属先の選択拡張 — 非アーカイブWorkspace・Project

2026-10-27 の要求に基づき、Taskの所属先を選ぶ際の条件だけを拡張します。Workspace・Projectのメタデータ体系、Task v3のFrontmatter、運用上の表示制御は変更しません。

## 候補の扱い

- Workspace: lifecycle = active / inactive の両方が選択可能。archived、不明な値、欠落した値は候補に含めない。
- Project: status = planning / running / stopped / stable が選択可能。done（完了・アーカイブ相当）と cancelled（キャンセル・非表示）、不明な値、空欄は候補から除外する。
- 2026-10-28 の追加修正: cancelled は非アーカイブでも非表示状態としてTask所属先の候補から除外します。Project一覧や既存Taskの所属情報は変更しません。
- Workspace未指定の場合Projectも未指定とする既存仕様を維持する。Projectは選択済みWorkspaceへの参照が一致するものに限定するため、アーカイブ済みWorkspace配下のProjectは選択できない。

## 更新対象

1. 既存Task作成のQuickAdd詳細画面（task_creation_utils.chooseContext）。
2. 既存Taskノートの所属先を変更するTemplater（select_task_context）。
3. Recurring Task Definitionを新規作成するときのWorkspace/Project選択（create_recurring_task）。既存の生成スケジュールやファイル名は変更しない。
4. InboxのTask整理画面（task_table.js の mode=inbox）。

全経路が entity_meta_utils.js のTask所属専用述語を用います。isWorkspaceActiveLifecycle/isProjectActiveStatus等の既存述語を広げないため、Idea、Project作成、Knowledgeなど他用途の選択条件は変わりません。

## 重要な運用上の違い

非アーカイブのWorkspaceに所属できることと、Taskが通常のアクティブ一覧に表示されることは別です。Task operational visibilityの既存方針により、inactive Workspaceに所属するTaskは通常の主要表示から除外されたままです。Inbox/Backlogの可視性も既存の仕組みに従います。表示ポリシー変更は今回の対象外です。

Taskの所属先編集は、従来どおりTask単位でWorkspaceひとつ、Project最大ひとつを持つ方式です。複数Workspace/Projectへの同時所属は今回実装しません。

## 検証・運用

契約テストは既知の全status/lifecycle、無効・欠落値の除外、inactive Workspace + stopped/stable Projectの選択とcancelled Projectの除外、アーカイブWorkspaceの除外、QuickAddの新規Task作成、Templaterの所属変更、Recurring Definition作成、Inboxの整理選択をカバーします。既存Taskの一括更新やVaultの再生成・自動移動は行いません。

実機受入では、それぞれのWorkspaceでstopped/stable Projectを選択できること、cancelled/done/archivedが候補にないこと、所属保存後も関連整合性を維持することを確認してください。
