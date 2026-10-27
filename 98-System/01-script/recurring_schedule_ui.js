(function createRecurringScheduleUI({ app, document, recurrence, today }) {
  if (!app?.vault || !app?.fileManager?.processFrontMatter || !document || !recurrence) {
    throw new Error("Recurring editor requires the Obsidian Vault and schedule utilities");
  }
  const DAY_NAMES = ["月", "火", "水", "木", "金", "土", "日"];
  const WEEK_OPTIONS = [
    ["1", "第1"], ["2", "第2"], ["3", "第3"],
    ["4", "第4"], ["5", "第5"], ["last", "最終"]
  ];
  const FREQUENCIES = [
    ["daily", "毎日"], ["weekly", "毎週"], ["monthly", "毎月"]
  ];

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = String(text);
    return node;
  }

  function select(options, value, label) {
    const node = el("select", "oc-recurring-select");
    node.setAttribute("aria-label", label);
    for (const [key, title] of options) {
      const item = el("option", "", title);
      item.value = key;
      node.appendChild(item);
    }
    node.value = String(value);
    return node;
  }

  function field(label, control) {
    const wrapper = el("label", "oc-recurring-field");
    wrapper.appendChild(el("span", "oc-recurring-label", label));
    wrapper.appendChild(control);
    return wrapper;
  }

  function signature(def) {
    // Compare the full editing surface; refuse overwriting a concurrently
    // edited definition from another device / Obsidian pane.
    return JSON.stringify([
      def.uid, def.frequency, def.interval, def.anchor, def.lookaheadDays,
      def.enabled, def.weekdays, def.monthWeek, def.monthWeekday
    ]);
  }

  function render(parent, page) {
    let baseline;
    const card = el("article", "oc-recurring-card");
    parent.appendChild(card);
    try {
      baseline = recurrence.normalizeDefinition(page);
    } catch (error) {
      card.appendChild(el("p", "oc-recurring-error", "定義を読み込めません: " + error.message));
      return card;
    }

    const title = el("a", "oc-recurring-title internal-link", baseline.title);
    title.href = page.file.path;
    title.dataset.href = page.file.path;
    title.addEventListener("click", event => {
      if (!app.workspace?.openLinkText) return;
      event.preventDefault();
      app.workspace.openLinkText(page.file.path, "", false);
    });
    const heading = el("div", "oc-recurring-heading");
    heading.appendChild(title);
    heading.appendChild(el("span", "oc-recurring-caption", "UID: " + baseline.uid));
    card.appendChild(heading);

    const state = {
      enabled: baseline.enabled,
      frequency: baseline.frequency,
      interval: baseline.interval,
      anchor: baseline.anchor,
      lookahead: baseline.lookaheadDays,
      weekdays: baseline.weekdays ? [...baseline.weekdays] : [recurrence.weekday(baseline.anchor)],
      weeklyCustomized: baseline.weekdays !== null,
      monthMode: baseline.monthWeek === null ? "date" : "weekday",
      monthWeek: baseline.monthWeek ?? Math.floor((Number(baseline.anchor.slice(8, 10)) - 1) / 7) + 1,
      monthWeekday: baseline.monthWeekday ?? recurrence.weekday(baseline.anchor)
    };
    let saving = false;

    const form = el("form", "oc-recurring-form");
    card.appendChild(form);
    const settings = el("div", "oc-recurring-settings");
    const enabled = el("input", "oc-recurring-enabled");
    enabled.type = "checkbox";
    enabled.checked = state.enabled;
    settings.appendChild(field("自動生成", enabled));

    const frequency = select(FREQUENCIES, state.frequency, "繰り返し単位");
    settings.appendChild(field("頻度", frequency));
    const interval = el("input", "oc-recurring-number");
    interval.type = "number"; interval.min = "1"; interval.max = "365"; interval.step = "1";
    interval.value = String(state.interval); interval.required = true;
    settings.appendChild(field("間隔", interval));

    const anchor = el("input", "oc-recurring-date");
    anchor.type = "date"; anchor.value = state.anchor; anchor.required = true;
    settings.appendChild(field("基準日", anchor));

    const lookahead = el("input", "oc-recurring-number");
    lookahead.type = "number"; lookahead.min = "0"; lookahead.max = "90"; lookahead.step = "1";
    lookahead.value = String(state.lookahead); lookahead.required = true;
    settings.appendChild(field("先読み日数", lookahead));
    form.appendChild(settings);

    const weekly = el("fieldset", "oc-recurring-weekly");
    weekly.appendChild(el("legend", "", "曜日（複数選択可）"));
    const chips = el("div", "oc-recurring-weekdays");
    weekly.appendChild(chips);
    const dayButtons = [];
    for (let i = 1; i <= 7; i += 1) {
      const button = el("button", "oc-recurring-day", DAY_NAMES[i - 1]);
      button.type = "button";
      button.dataset.day = String(i);
      button.setAttribute("aria-label", DAY_NAMES[i - 1] + "曜日");
      button.addEventListener("click", () => {
        if (saving) return;
        state.weeklyCustomized = true;
        state.weekdays = state.weekdays.includes(i)
          ? state.weekdays.filter(day => day !== i)
          : [...state.weekdays, i].sort((a, b) => a - b);
        update();
      });
      chips.appendChild(button);
      dayButtons.push(button);
    }
    form.appendChild(weekly);

    const monthly = el("fieldset", "oc-recurring-monthly");
    monthly.appendChild(el("legend", "", "毎月の指定"));
    const monthMode = select([["date", "基準日と同じ日付"], ["weekday", "第n週の曜日"]], state.monthMode, "月次の指定方法");
    monthly.appendChild(field("方法", monthMode));
    const monthlyDetail = el("div", "oc-recurring-month-detail");
    const monthWeek = select(WEEK_OPTIONS, state.monthWeek, "月の第何週か");
    const monthDay = select(DAY_NAMES.map((label, index) => [String(index + 1), label + "曜日"]),
      state.monthWeekday, "月内の曜日");
    monthlyDetail.appendChild(field("週", monthWeek));
    monthlyDetail.appendChild(field("曜日", monthDay));
    monthly.appendChild(monthlyDetail);
    form.appendChild(monthly);

    const feedback = el("p", "oc-recurring-preview");
    feedback.setAttribute("aria-live", "polite");
    form.appendChild(feedback);
    const status = el("p", "oc-recurring-message");
    status.setAttribute("aria-live", "polite");
    form.appendChild(status);
    const footer = el("div", "oc-recurring-footer");
    footer.appendChild(el("span", "oc-recurring-hint", "変更は「保存」で反映されます"));
    const save = el("button", "oc-button oc-button--primary oc-recurring-save", "設定を保存");
    save.type = "submit";
    footer.appendChild(save);
    form.appendChild(footer);

    function proposedRaw() {
      // Editing-time empty inputs must not trigger frontmatter fallback values.
      if (!interval.value.trim() || !lookahead.value.trim() || !anchor.value.trim()) {
        throw new Error("間隔・基準日・先読み日数は空欄にできません");
      }
      // Explicit fields, no accidental mutation of DataArray or YAML aliases.
      const raw = {
        type: baseline.type, uid: baseline.uid, title: baseline.title,
        enabled: enabled.checked, frequency: frequency.value,
        interval: interval.value, anchor: anchor.value,
        lookahead_days: lookahead.value, start_offset_days: baseline.startOffsetDays,
        due_offset_days: baseline.dueOffsetDays, priority: baseline.priority,
        workspace: baseline.workspace, project: baseline.project
      };
      if (raw.frequency === "weekly" && (state.weeklyCustomized || baseline.frequency !== "weekly")) {
        raw.weekdays = [...state.weekdays];
      }
      if (raw.frequency === "monthly" && monthMode.value === "weekday") {
        raw.month_week = monthWeek.value === "last" ? "last" : Number(monthWeek.value);
        raw.month_weekday = Number(monthDay.value);
      }
      return raw;
    }

    function update() {
      // Legacy weekday follows the editable Anchor until a weekday chip is
      // explicitly selected. Otherwise the chips can misrepresent the
      // effective schedule when only the Anchor is changed.
      if (!state.weeklyCustomized) {
        try {
          state.weekdays = [recurrence.weekday(anchor.value)];
        } catch {
          state.weekdays = []; // Invalid date: no selected day; Save disabled.
        }
      }
      weekly.hidden = frequency.value !== "weekly";
      monthly.hidden = frequency.value !== "monthly";
      monthlyDetail.hidden = monthMode.value !== "weekday";
      dayButtons.forEach((button, index) =>
        button.setAttribute("aria-pressed", String(state.weekdays.includes(index + 1))));
      try {
        const draft = recurrence.normalizeDefinition(proposedRaw());
        const display = recurrence.nextOccurrences({ ...draft, enabled: true }, today(), 3, 400);
        const suffix = draft.enabled ? "" : "（現在は無効）";
        feedback.textContent = "次回候補: " + (display.join(" / ") || "先400日以内になし") + suffix;
        feedback.classList.remove("oc-recurring-error");
        save.disabled = saving || signature(draft) === signature(baseline);
        save.title = "";
      } catch (error) {
        feedback.textContent = "設定を確認してください: " + error.message;
        feedback.classList.add("oc-recurring-error");
        save.disabled = true;
      }
    }

    for (const input of [enabled, frequency, interval, anchor, lookahead, monthMode, monthWeek, monthDay]) {
      input.addEventListener("change", update);
      if (input.type === "number" || input.type === "date") input.addEventListener("input", update);
    }

    form.addEventListener("submit", async event => {
      event.preventDefault();
      if (saving) return;
      let draft;
      try { draft = recurrence.normalizeDefinition(proposedRaw()); }
      catch (error) { update(); return; }
      if (signature(draft) === signature(baseline)) return;
      saving = true; update();
      try {
        const file = app.vault.getAbstractFileByPath(page.file.path);
        if (!file || file.extension !== "md") throw new Error("Recurring Definitionが見つかりません");
        await app.fileManager.processFrontMatter(file, fm => {
          const current = recurrence.normalizeDefinition(fm);
          if (signature(current) !== signature(baseline)) {
            throw new Error("別の画面で変更されています。再読み込みして確認してください");
          }
          fm.frequency = draft.frequency;
          fm.interval = draft.interval;
          fm.anchor = draft.anchor;
          fm.lookahead_days = draft.lookaheadDays;
          fm.enabled = draft.enabled;
          if (draft.frequency === "weekly" && draft.weekdays !== null) {
            fm.weekdays = [...draft.weekdays];
          } else {
            delete fm.weekdays;
          }
          if (draft.frequency === "monthly" && draft.monthWeek !== null) {
            fm.month_week = draft.monthWeek;
            fm.month_weekday = draft.monthWeekday;
          } else {
            delete fm.month_week;
            delete fm.month_weekday;
          }
        });
        baseline = draft;
        // Keep the form-local selection mode consistent with committed YAML.
        // Without this, changing from daily/monthly to weekly leaves the
        // editor looking dirty and a later anchor edit can erase weekdays.
        state.weeklyCustomized = draft.weekdays !== null;
        status.textContent = "繰り返し設定を保存しました。";
        status.classList.remove("oc-recurring-error");
      } catch (error) {
        console.error(error);
        status.textContent = "保存できませんでした: " + error.message;
        status.classList.add("oc-recurring-error");
      } finally {
        saving = false;
        update();
      }
    });
    update();
    return card;
  }
  return { render, signature };
})