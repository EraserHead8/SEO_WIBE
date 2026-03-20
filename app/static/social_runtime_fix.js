(function socialRuntimeFixV20260320c() {
  if (typeof window === "undefined") return;
  if (window.__socialRuntimeFixV20260320c) return;
  window.__socialRuntimeFixV20260320c = true;

  function t(ru, en) {
    if (typeof tr === "function") return tr(ru, en);
    return (typeof currentLang !== "undefined" && currentLang === "en") ? en : ru;
  }

  function esc(value) {
    if (typeof escapeHtml === "function") return escapeHtml(value);
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function parseDate(value) {
    if (typeof socialCalendarParseDate === "function") return socialCalendarParseDate(value);
    const dt = new Date(value);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  function dayKey(value) {
    if (typeof socialCalendarDayKey === "function") return socialCalendarDayKey(value);
    const dt = parseDate(value);
    if (!dt) return "";
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");
    return `${dt.getFullYear()}-${m}-${d}`;
  }

  function dayLabel(value) {
    if (typeof socialCalendarDayLabel === "function") return socialCalendarDayLabel(value);
    const dt = parseDate(value);
    if (!dt) return String(value || "");
    return dt.toLocaleDateString(currentLang === "en" ? "en-US" : "ru-RU", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  function timeLabel(value) {
    if (typeof socialCalendarTimeLabel === "function") return socialCalendarTimeLabel(value);
    const dt = parseDate(value);
    if (!dt) return "";
    return dt.toLocaleTimeString(currentLang === "en" ? "en-GB" : "ru-RU", { hour: "2-digit", minute: "2-digit" });
  }

  function colorForRow(row, kind) {
    const raw = String(row?.color || "").trim();
    if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toLowerCase();
    if (kind === "event") return "#b8d7ff";
    return String(row?.task_kind || "").toLowerCase() === "personal" ? "#bde5c8" : "#d8e6ff";
  }

  function eventRowsForDay(day) {
    const rows = Array.isArray(window.socialState?.calendarEvents) ? window.socialState.calendarEvents : [];
    return rows
      .filter((row) => dayKey(row?.start_at || "") === day)
      .map((row) => ({ ...row, __swType: "event" }));
  }

  function taskRowsForDay(day) {
    const rows = Array.isArray(window.socialState?.tasks) ? window.socialState.tasks : [];
    return rows
      .filter((row) => dayKey(row?.due_date || "") === day)
      .map((row) => ({ ...row, __swType: "task" }));
  }

  function rowsForDay(day) {
    const merged = [...eventRowsForDay(day), ...taskRowsForDay(day)];
    merged.sort((a, b) => {
      const left = parseDate(a?.start_at || a?.due_date || "")?.getTime() || 0;
      const right = parseDate(b?.start_at || b?.due_date || "")?.getTime() || 0;
      if (left !== right) return left - right;
      return String(a?.title || "").localeCompare(String(b?.title || ""), currentLang === "en" ? "en" : "ru");
    });
    return merged;
  }

  function hideLegacyCalendarControls() {
    const root = document.getElementById("socialSubtabCalendar");
    if (!root) return;
    root.classList.add("social-calendar-samsung-mode");
    const selectors = [
      ".social-calendar-hero-actions",
      ".social-calendar-toolbar",
      ".social-calendar-toolbar--modern",
      ".social-calendar-toolbar--clean",
      ".social-calendar-nav--simple",
      ".social-calendar-nav--cluster",
      ".social-calendar-month-picker",
      "#socialCalendarPrimaryAction",
      "#socialCalendarTaskMode",
      ".social-calendar-sync-card",
      ".social-calendar-sync-panel",
      ".social-calendar-source-panel",
      ".social-calendar-import-panel",
      "[id*='socialCalendarGoogle']",
      "[id*='socialCalendarIcs']",
      "[id*='socialCalendarOAuth']",
      "[id*='socialCalendarOauth']"
    ];
    root.querySelectorAll(selectors.join(",")).forEach((node) => {
      if (!node || node.id === "socialCalendarGrid" || node.id === "socialCalendarEvents") return;
      node.style.setProperty("display", "none", "important");
    });
  }

  function ensureCalendarFab() {
    const shell = document.querySelector("#socialSubtabCalendar .social-calendar-shell") || document.getElementById("socialSubtabCalendar");
    if (!shell) return;
    let fab = document.getElementById("socialCalendarSamsungFab");
    if (!fab) {
      fab = document.createElement("button");
      fab.id = "socialCalendarSamsungFab";
      fab.className = "social-calendar-samsung-fab";
      fab.type = "button";
      fab.textContent = "+";
      fab.setAttribute("onclick", "socialRuntimeCalendarCreate()");
      shell.appendChild(fab);
    }
    fab.setAttribute("title", t("Добавить", "Add"));
    fab.setAttribute("aria-label", t("Добавить", "Add"));
  }

  function monthTitle(date) {
    const dt = date instanceof Date ? date : new Date();
    const label = dt.toLocaleDateString(currentLang === "en" ? "en-US" : "ru-RU", { month: "long" });
    return String(label || "").toUpperCase();
  }

  function chipMarkup(row) {
    const isEvent = String(row?.__swType || "event") === "event";
    const rawTime = isEvent ? String(row?.start_at || "") : String(row?.due_date || "");
    const time = rawTime ? `${timeLabel(rawTime)} ` : "";
    const title = String(row?.title || "-").trim() || "-";
    const color = colorForRow(row, isEvent ? "event" : "task");
    return `<span class="sw-calendar-chip ${isEvent ? "is-event" : "is-task"}" style="--sw-chip-color:${esc(color)}"><span class="sw-calendar-chip-title">${esc(`${time}${title}`)}</span></span>`;
  }

  function selectedDayFallback(year, month, todayKey) {
    const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}-`;
    const selected = String(window.socialState?.calendarSelectedDay || "").trim();
    if (selected.startsWith(monthPrefix)) return selected;
    if (todayKey && todayKey.startsWith(monthPrefix)) return todayKey;
    return `${monthPrefix}01`;
  }

  window.socialRuntimeCalendarCreate = function socialRuntimeCalendarCreate() {
    if (typeof socialOpenCalendarModal === "function") socialOpenCalendarModal();
  };

  window.socialRuntimeToggleCalendarItem = function socialRuntimeToggleCalendarItem(key) {
    if (!window.socialState) return;
    const current = String(window.socialState.calendarExpandedItemKey || "");
    window.socialState.calendarExpandedItemKey = current === String(key || "") ? "" : String(key || "");
    const selected = String(window.socialState.calendarSelectedDay || "").trim();
    if (selected && typeof window.socialShowDay === "function") window.socialShowDay(selected);
  };

  function renderCalendar() {
    const grid = document.getElementById("socialCalendarGrid");
    const list = document.getElementById("socialCalendarEvents");
    const monthLabelNode = document.getElementById("socialCalendarMonthLabel");
    if (!grid || !list || !window.socialState) return;

    hideLegacyCalendarControls();
    ensureCalendarFab();

    const date = window.socialState.calendarDate instanceof Date ? window.socialState.calendarDate : new Date();
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1, 0, 0, 0, 0);
    const lastDay = new Date(year, month + 1, 0, 0, 0, 0, 0);
    const shift = (firstDay.getDay() + 6) % 7;
    const days = lastDay.getDate();
    const todayKey = dayKey(new Date());
    const compact = typeof window.matchMedia === "function" && window.matchMedia("(max-width: 980px)").matches;
    const previewLimit = compact ? 2 : 3;

    if (monthLabelNode) monthLabelNode.textContent = monthTitle(date);

    let html = `<div class="social-calendar-row head">${[
      t("Пн", "Mon"),
      t("Вт", "Tue"),
      t("Ср", "Wed"),
      t("Чт", "Thu"),
      t("Пт", "Fri"),
      t("Сб", "Sat"),
      t("Вс", "Sun"),
    ].map((label) => `<span>${esc(label)}</span>`).join("")}</div><div class="social-calendar-cells">`;

    for (let i = 0; i < shift; i += 1) {
      html += "<button class=\"social-day muted rich\" type=\"button\" disabled></button>";
    }

    for (let day = 1; day <= days; day += 1) {
      const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const rows = rowsForDay(key);
      const preview = rows.slice(0, previewLimit).map(chipMarkup).join("");
      const more = rows.length - previewLimit;
      const active = String(window.socialState.calendarSelectedDay || "") === key ? "active" : "";
      const today = todayKey === key ? "today" : "";
      html += `
        <button class="social-day rich ${active} ${today} ${rows.length ? "has-preview" : ""}" type="button" data-day-key="${key}" onclick="socialShowDay('${key}')">
          <div class="social-day-head"><b>${day}</b></div>
          <div class="social-day-preview-stack">${preview}</div>
          ${more > 0 ? `<div class="social-day-more">+${more}</div>` : ""}
        </button>
      `;
    }

    html += "</div>";
    grid.innerHTML = html;

    const selected = selectedDayFallback(year, month, todayKey);
    window.socialShowDay(selected);
  }

  function renderDayCard(row, index, selectedDay) {
    const type = String(row?.__swType || "event") === "event" ? "event" : "task";
    const id = Number(row?.id || 0);
    const key = `${type}:${id}:${index}:${selectedDay}`;
    const expanded = String(window.socialState?.calendarExpandedItemKey || "") === key;
    const title = String(row?.title || "-").trim() || "-";
    const isEvent = type === "event";
    const time = isEvent
      ? (String(row?.start_at || "").trim() ? `${timeLabel(row.start_at)}${row?.end_at ? ` - ${timeLabel(row.end_at)}` : ""}` : t("Весь день", "All day"))
      : (String(row?.due_date || "").trim() ? timeLabel(row.due_date) : t("Без времени", "No time"));
    const desc = String((isEvent ? row?.details : row?.description) || "").replace(/\s+/g, " ").trim() || t("Без описания", "No description");
    const color = colorForRow(row, isEvent ? "event" : "task");
    const editFn = isEvent ? `socialOpenCalendarModal(${id})` : `socialOpenTaskModal(${id})`;
    const deleteFn = isEvent ? `socialDeleteEvent(${id})` : `socialDeleteTask(${id})`;
    return `
      <article class="sw-day-item ${expanded ? "is-expanded" : ""}" style="--sw-chip-color:${esc(color)}" onclick="socialRuntimeToggleCalendarItem('${esc(key)}')">
        <div class="sw-day-item-head">
          <div class="sw-day-item-title-wrap">
            <div class="sw-day-item-time">${esc(time)}</div>
            <h5 class="sw-day-item-title">${esc(title)}</h5>
          </div>
          <span class="sw-day-item-arrow">${expanded ? "v" : ">"}</span>
        </div>
        ${expanded ? `
          <div class="sw-day-item-body">
            <div class="sw-day-item-desc">${esc(desc)}</div>
            <div class="sw-day-item-actions">
              <button type="button" onclick="${editFn}; event.stopPropagation();">${esc(t("Редактировать", "Edit"))}</button>
              <button type="button" class="btn-danger" onclick="${deleteFn}; event.stopPropagation();">${esc(t("Удалить", "Delete"))}</button>
            </div>
          </div>
        ` : ""}
      </article>
    `;
  }

  function renderDay(day) {
    const list = document.getElementById("socialCalendarEvents");
    if (!list || !window.socialState) return;

    const selectedDay = String(day || "").trim();
    window.socialState.calendarSelectedDay = selectedDay;
    const rows = rowsForDay(selectedDay);

    list.innerHTML = `
      <section class="sw-day-sheet">
        <header class="sw-day-sheet-head">
          <div class="sw-day-sheet-kicker">${esc(t("Выбранный день", "Selected day"))}</div>
          <h4 class="sw-day-sheet-date">${esc(dayLabel(selectedDay))}</h4>
          <div class="sw-day-sheet-stat">${esc(String(rows.length))} ${esc(t("записей", "records"))}</div>
        </header>
        <div class="sw-day-sheet-list">${rows.length ? rows.map((row, index) => renderDayCard(row, index, selectedDay)).join("") : `<div class="social-note-empty">${esc(t("На этот день записей нет.", "No records for this day."))}</div>`}</div>
      </section>
    `;

    const grid = document.getElementById("socialCalendarGrid");
    if (grid) {
      grid.querySelectorAll(".social-day[data-day-key]").forEach((btn) => {
        btn.classList.toggle("active", String(btn.getAttribute("data-day-key") || "") === selectedDay);
      });
    }
  }

  function install() {
    window.socialRenderCalendar = renderCalendar;
    window.socialShowDay = renderDay;

    if (typeof switchSocialSubtab === "function" && !switchSocialSubtab.__runtimeCalendarWrapped) {
      const original = switchSocialSubtab;
      const wrapped = function wrappedSwitchSocialSubtab() {
        const result = original.apply(this, arguments);
        const active = String(arguments[0] || "").trim().toLowerCase();
        if (active === "calendar") {
          hideLegacyCalendarControls();
          ensureCalendarFab();
          if (typeof window.socialRenderCalendar === "function") window.socialRenderCalendar();
        }
        return result;
      };
      wrapped.__runtimeCalendarWrapped = true;
      switchSocialSubtab = wrapped;
    }

    if (typeof window.queueMojibakeDomNormalize === "function") {
      window.queueMojibakeDomNormalize(document.body || null);
    }
  }

  function start() {
    install();
    hideLegacyCalendarControls();
    ensureCalendarFab();
    if (String(window.currentTab || "").trim().toLowerCase() === "social"
      && String(window.currentSocialSubtab || "").trim().toLowerCase() === "calendar"
      && typeof window.socialRenderCalendar === "function") {
      window.socialRenderCalendar();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
