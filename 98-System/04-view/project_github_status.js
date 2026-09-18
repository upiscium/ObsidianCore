const current = dv.current();
const root = dv.container;

root.innerHTML = "";

function isTrue(value) {
  if (value === true) return true;
  const normalized = String(value ?? "").trim().toLowerCase();
  return ["true", "yes", "1", "on"].includes(normalized);
}

function externalLink(parent, label, href) {
  parent.createEl("a", {
    text: label,
    cls: "external-link",
    attr: {
      href,
      target: "_blank",
      rel: "noopener noreferrer"
    }
  });
}

const repository = String(current?.github_repo ?? "").trim();
const enabled = isTrue(current?.github_watch) && repository.length > 0;

if (enabled) {
  root.createEl("h1", { text: "GitHub Status" });

  const statusPath = `${current.file.folder}/Status`;
  const status = dv.page(statusPath);

  if (!status) {
    root.createEl("p", { text: "GitHub Statusはまだ同期されていません。" });
  } else if (
    !isTrue(status.github_status_managed)
    || String(status.github_repo ?? "").trim() !== repository
  ) {
    root.createEl("p", { text: "GitHub Statusの同期データがProjectと一致しません。" });
  } else if (status.github_pull_requests == null) {
    root.createEl("p", { text: "GitHub PR詳細はまだ同期されていません。" });
  } else {
    const pulls = Array.from(status.github_pull_requests);

    if (pulls.length === 0) {
      root.createEl("p", { text: "Open PRはありません。" });
    } else {
      const table = root.createEl("table", {
        cls: "dataview table-view-table"
      });
      const head = table.createEl("thead").createEl("tr");
      for (const label of ["PR", "PR Status", "Bound Issue"]) {
        head.createEl("th", { text: label });
      }

      const body = table.createEl("tbody");
      for (const pull of pulls) {
        const row = body.createEl("tr");
        const prCell = row.createEl("td");
        const number = Number(pull?.number);
        const title = String(pull?.title ?? "").trim();
        const url = String(pull?.url ?? "").trim();
        const statusValue = String(pull?.status ?? "").trim().toLowerCase();

        if (Number.isInteger(number) && number > 0 && url) {
          externalLink(
            prCell,
            `#${number}${title ? ` ${title}` : ""}`,
            url
          );
        } else {
          prCell.setText(title || "-");
        }

        const statusCell = row.createEl("td");
        statusCell.setText(
          statusValue === "draft"
            ? "Draft"
            : statusValue === "ready"
              ? "Ready"
              : "Unknown"
        );

        const issueCell = row.createEl("td");
        const boundIssues = pull?.bound_issues
          ? Array.from(pull.bound_issues)
          : [];
        if (boundIssues.length === 0) {
          issueCell.setText("-");
        } else {
          boundIssues.forEach((issue, index) => {
            if (index > 0) issueCell.appendText(", ");
            const issueNumber = Number(issue?.number);
            const issueUrl = String(issue?.url ?? "").trim();
            if (Number.isInteger(issueNumber) && issueNumber > 0 && issueUrl) {
              const issueRepository = String(issue?.repository ?? "").trim();
              const issueLabel = issueRepository && issueRepository !== repository
                ? `${issueRepository}#${issueNumber}`
                : `#${issueNumber}`;
              externalLink(issueCell, issueLabel, issueUrl);
            } else {
              issueCell.appendText("-");
            }
          });
        }
      }
    }
  }
}
