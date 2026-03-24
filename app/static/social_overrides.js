(function socialOverridesV20260321a() {
  if (typeof window === "undefined") return;
  if (window.__socialOverridesV20260321a) return;
  window.__socialOverridesV20260321a = true;
  window.__socialDisableNotificationToasts = true;

  const NOTE_COLORS_KEY = "seo_wibe_note_cover_colors_v1";
  const NOTE_DEFAULT_COLOR = "#f8fbff";
  const NOTE_PALETTE = ["#f8fbff", "#fff8dc", "#e9f8ff", "#f6ecff", "#e9ffe9", "#ffeef2", "#fff2e1", "#f0f4ff", "#f2f2f2"];
  const REMINDER_PRESETS = [10, 60, 180, 1440, 4320, 10080];
  const RECURRENCE_OPTIONS = ["none", "daily", "weekly", "monthly", "yearly"];

  function ensureSocialState() {
    if (!window.socialState || typeof window.socialState !== "object") {
      window.socialState = {};
    }
    return window.socialState;
  }

  function t(ru, en) {
    const safeRu = cleanText(ru);
    const safeEn = cleanText(en);
    try {
      if (typeof window.tr === "function") return cleanText(String(window.tr(safeRu, safeEn) || ""));
    } catch (_) {}
    return String(window.currentLang || "ru").toLowerCase() === "en" ? safeEn : safeRu;
  }

  function esc(value) {
    const raw = String(value ?? "");
    if (typeof window.escapeHtml === "function") return window.escapeHtml(raw);
    return raw
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function cleanText(value) {
    let text = String(value ?? "");
    try {
      if (typeof window.decodePossiblyMojibake === "function") {
        text = String(window.decodePossiblyMojibake(text) || text);
      }
    } catch (_) {}
    try {
      if (typeof window.__repairMojibakeText === "function") {
        text = String(window.__repairMojibakeText(text) || text);
      }
    } catch (_) {}
    return text;
  }

  function compactText(value, maxLen = 40) {
    const text = cleanText(value).replace(/\s+/g, " ").trim();
    if (!text) return "";
    if (text.length <= maxLen) return text;
    return `${text.slice(0, Math.max(0, maxLen - 1)).trim()}…`;
  }

  function parseDate(value) {
    if (!value) return null;
    try {
      if (typeof window.socialParseDateSafe === "function") {
        const parsed = window.socialParseDateSafe(value);
        if (parsed instanceof Date && !Number.isNaN(parsed.getTime())) return parsed;
      }
    } catch (_) {}
    const d = new Date(value);
    return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
  }

  function pad2(value) {
    return String(Math.max(0, Number(value || 0))).padStart(2, "0");
  }

  function dayKey(value) {
    try {
      if (typeof window.socialCalendarDayKey === "function") {
        const key = String(window.socialCalendarDayKey(value) || "").trim();
        if (key) return key;
      }
    } catch (_) {}
    const d = value instanceof Date ? value : parseDate(value);
    if (!(d instanceof Date)) return "";
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  function dateTimeInputValue(value) {
    if (!value) return "";
    try {
      if (typeof window.socialCalendarDateTimeValue === "function") {
        return String(window.socialCalendarDateTimeValue(value) || "");
      }
    } catch (_) {}
    const d = parseDate(value);
    if (!(d instanceof Date)) return String(value || "").replace(" ", "T").slice(0, 16);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }

  function calendarTimeLabel(value) {
    try {
      if (typeof window.socialCalendarTimeLabel === "function") {
        return String(window.socialCalendarTimeLabel(value) || "");
      }
    } catch (_) {}
    const d = parseDate(value);
    if (!(d instanceof Date)) return "";
    return d.toLocaleTimeString(String(window.currentLang || "ru").toLowerCase() === "en" ? "en-GB" : "ru-RU", { hour: "2-digit", minute: "2-digit" });
  }

  function calendarMonthLabel(value) {
    try {
      if (typeof window.socialCalendarMonthLabel === "function") {
        return String(window.socialCalendarMonthLabel(value) || "");
      }
    } catch (_) {}
    const d = value instanceof Date ? value : parseDate(value);
    if (!(d instanceof Date)) return "";
    return d.toLocaleDateString(String(window.currentLang || "ru").toLowerCase() === "en" ? "en-GB" : "ru-RU", { month: "long", year: "numeric" });
  }

  function calendarDayLabel(key) {
    try {
      if (typeof window.socialCalendarDayLabel === "function") {
        return String(window.socialCalendarDayLabel(key) || key);
      }
    } catch (_) {}
    const d = parseDate(`${key}T00:00:00`);
    if (!(d instanceof Date)) return key;
    return d.toLocaleDateString(String(window.currentLang || "ru").toLowerCase() === "en" ? "en-GB" : "ru-RU", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
  }

  function normalizeColor(value, fallback = "#b8d2ff") {
    const raw = String(value || "").trim();
    return /^#[0-9a-fA-F]{6}$/.test(raw) ? raw.toLowerCase() : fallback;
  }

  function repairTextNodes(root) {
    const target = root || document.body;
    if (!target) return;
    const suspect = /(?:Р[\u0400-\u04ff]|С[\u0400-\u04ff]|вЂ|рџ|\?{4,})/;
    const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT, null);
    let node = walker.nextNode();
    while (node) {
      const original = String(node.nodeValue || "");
      if (original && suspect.test(original)) {
        const fixed = cleanText(original);
        if (fixed && fixed !== original) node.nodeValue = fixed;
      }
      node = walker.nextNode();
    }
  }

  let repairTimer = 0;
  function queueTextRepair() {
    if (repairTimer) return;
    repairTimer = window.setTimeout(() => {
      repairTimer = 0;
      repairTextNodes(document.body);
    }, 120);
  }

  function applyKnownCopy() {
    document.querySelectorAll(".bell-emoji").forEach((node) => { node.textContent = "🔔"; });
    const map = [
      [".nav-btn[data-tab='social']", t("Социальный", "Social")],
      ["#socialSubtabChatBtn", t("Чат", "Chat")],
      ["#socialSubtabTasksBtn", t("Задачи", "Tasks")],
      ["#socialSubtabCalendarBtn", t("Календарь", "Calendar")],
      ["#socialSubtabNotesBtn", t("Заметки", "Notes")],
    ];
    map.forEach(([selector, text]) => {
      document.querySelectorAll(selector).forEach((node) => { node.textContent = text; });
    });
  }

  function applyKnownCopy() {
    document.querySelectorAll(".bell-emoji").forEach((node) => { node.textContent = "🔔"; });
    const map = [
      [".nav-btn[data-tab='social']", t("Социальный", "Social")],
      ["#socialSubtabChatBtn", t("Чат", "Chat")],
      ["#socialSubtabTasksBtn", t("Задачи", "Tasks")],
      ["#socialSubtabCalendarBtn", t("Календарь", "Calendar")],
      ["#socialSubtabNotesBtn", t("Заметки", "Notes")],
    ];
    map.forEach(([selector, text]) => {
      document.querySelectorAll(selector).forEach((node) => { node.textContent = text; });
    });
  }

  function applyKnownCopy() {
    document.querySelectorAll(".bell-emoji").forEach((node) => { node.textContent = "\u{1F514}"; });
    [
      ".nav-btn[data-tab='social']",
      "#socialSubtabChatBtn",
      "#socialSubtabTasksBtn",
      "#socialSubtabCalendarBtn",
      "#socialSubtabNotesBtn",
      "#socialSubtabCalculatorBtn",
      "#socialSubtabGamesBtn",
    ].forEach((selector) => {
      document.querySelectorAll(selector).forEach((node) => {
        node.textContent = cleanText(String(node.textContent || ""));
      });
    });
  }

  function bindBellButtons() {
    ["socialBellBtn", "mobileDrawerBellBtn"].forEach((id) => {
      const button = document.getElementById(id);
      if (!button || button.dataset.swBellBound === "1") return;
      button.dataset.swBellBound = "1";
      button.addEventListener("click", (event) => {
        if (typeof window.openSocialChatFromBell === "function") {
          window.openSocialChatFromBell(event);
        }
      });
    });
  }

  function normalizeNotificationCenter() {
    const center = document.getElementById("socialNotificationCenter");
    if (!center) return null;
    if (center.parentElement !== document.body) {
      document.body.appendChild(center);
    }
    center.classList.add("social-notif-center");
    center.style.position = "fixed";
    center.style.zIndex = "1200";
    return center;
  }

  const originalOpenBell = typeof window.openSocialChatFromBell === "function" ? window.openSocialChatFromBell : null;
  window.openSocialChatFromBell = async function openSocialChatFromBellOverride(event = null) {
    if (event?.preventDefault) event.preventDefault();
    if (event?.stopPropagation) event.stopPropagation();
    if (typeof window.socialToggleNotificationCenter === "function") {
      try {
        await window.socialToggleNotificationCenter(event || null);
        queueTextRepair();
        return false;
      } catch (_) {}
    }
    if (originalOpenBell) return originalOpenBell.call(this, event);
    return false;
  };

  const originalRenderNotificationCenter = typeof window.socialRenderNotificationCenter === "function"
    ? window.socialRenderNotificationCenter
    : null;
  if (originalRenderNotificationCenter && !originalRenderNotificationCenter.__swWrapped) {
    const wrapped = function socialRenderNotificationCenterOverride() {
      const result = originalRenderNotificationCenter.apply(this, arguments);
      const center = normalizeNotificationCenter();
      if (center) repairTextNodes(center);
      return result;
    };
    wrapped.__swWrapped = true;
    window.socialRenderNotificationCenter = wrapped;
  }

  const originalToggleNotificationCenter = typeof window.socialToggleNotificationCenter === "function"
    ? window.socialToggleNotificationCenter
    : null;
  if (originalToggleNotificationCenter && !originalToggleNotificationCenter.__swWrapped) {
    const wrapped = async function socialToggleNotificationCenterOverride(event = null) {
      const result = await originalToggleNotificationCenter.call(this, event);
      const center = normalizeNotificationCenter();
      if (center) repairTextNodes(center);
      return result;
    };
    wrapped.__swWrapped = true;
    window.socialToggleNotificationCenter = wrapped;
  }

  function calendarMode() {
    const state = ensureSocialState();
    const mode = String(state.calendarTaskFilter || "events").trim().toLowerCase();
    if (mode === "tasks") return "tasks";
    if (mode === "my_tasks") return "my_tasks";
    return "events";
  }

  function calendarRowsForDay(key) {
    const safeKey = String(key || "").trim();
    if (!safeKey) return [];
    const state = ensureSocialState();
    const mode = calendarMode();
    const rows = [];
    if (mode === "events") {
      const events = Array.isArray(state.calendarEvents) ? state.calendarEvents : [];
      events.forEach((row, index) => {
        if (dayKey(row?.start_at || "") !== safeKey) return;
        rows.push({ kind: "event", row, id: Number(row?.id || 0), order: index });
      });
    } else {
      const tasks = Array.isArray(state.tasks) ? state.tasks : [];
      tasks.forEach((row, index) => {
        if (dayKey(row?.due_date || "") !== safeKey) return;
        if (mode === "my_tasks" && String(row?.task_kind || "").trim().toLowerCase() !== "personal") return;
        rows.push({ kind: "task", row, id: Number(row?.id || 0), order: index });
      });
    }
    rows.sort((a, b) => {
      const leftTs = parseDate(a.kind === "event" ? a.row?.start_at : a.row?.due_date)?.getTime() || 0;
      const rightTs = parseDate(b.kind === "event" ? b.row?.start_at : b.row?.due_date)?.getTime() || 0;
      if (leftTs !== rightTs) return leftTs - rightTs;
      return a.order - b.order;
    });
    return rows;
  }

  function calendarRowColor(item) {
    if (item.kind === "event") return normalizeColor(item.row?.color, "#b8d2ff");
    return String(item.row?.task_kind || "").trim().toLowerCase() === "personal" ? "#b8e7c8" : "#c9dcff";
  }

  function calendarRowTime(item) {
    if (item.kind === "event") {
      const start = String(item.row?.start_at || "").trim();
      const end = String(item.row?.end_at || "").trim();
      if (!start) return t("Весь день", "All day");
      const left = calendarTimeLabel(start);
      const right = end ? calendarTimeLabel(end) : "";
      return right ? `${left} - ${right}` : left;
    }
    const due = String(item.row?.due_date || "").trim();
    return due ? calendarTimeLabel(due) : t("Без времени", "No time");
  }

  function calendarRowMeta(item) {
    if (item.kind === "event") {
      const shared = item.row?.is_public ? t("Общее", "Shared") : t("Личное", "Private");
      const recurrence = String(item.row?.recurrence_kind || "none").trim().toLowerCase();
      const interval = Math.max(1, Number(item.row?.recurrence_interval || 1));
      let recLabel = "";
      if (recurrence !== "none") {
        const map = {
          daily: t("каждый день", "daily"),
          weekly: t("каждую неделю", "weekly"),
          monthly: t("каждый месяц", "monthly"),
          yearly: t("каждый год", "yearly"),
        };
        const base = map[recurrence] || recurrence;
        recLabel = interval > 1 ? `${base} x${interval}` : base;
      }
      return [shared, recLabel].filter(Boolean).join(" • ");
    }
    const assignee = cleanText(item.row?.assignee_nick || "").trim();
    const status = String(item.row?.status || "todo").trim().toLowerCase();
    const statusLabel = status === "done"
      ? t("Выполнена", "Done")
      : status === "in_progress"
        ? t("В работе", "In progress")
        : t("К выполнению", "To do");
    return [assignee, statusLabel].filter(Boolean).join(" • ");
  }

  function calendarRowDescription(item) {
    if (item.kind === "event") {
      let text = String(item.row?.details || "").trim();
      if (typeof window.socialCleanCalendarDetails === "function") {
        text = String(window.socialCleanCalendarDetails(text) || text).trim();
      }
      return text || t("Без описания", "No description");
    }
    return String(item.row?.description || "").trim() || t("Без описания", "No description");
  }

  function calendarRowTitle(item) {
    return cleanText(item.row?.title || "").trim() || "-";
  }

  function calendarCellChips(key) {
    const rows = calendarRowsForDay(key);
    if (!rows.length) return "";
    const limit = 3;
    const chips = rows.slice(0, limit).map((item) => `
      <span class="sw-cal-chip ${item.kind === "task" ? "is-task" : "is-event"}" style="--sw-chip-color:${esc(calendarRowColor(item))}">
        <span class="sw-cal-chip-text">${esc(compactText(calendarRowTitle(item), 18))}</span>
      </span>
    `).join("");
    const remain = rows.length - limit;
    const more = remain > 0 ? `<span class="sw-cal-more">+${remain}</span>` : "";
    return `<div class="sw-cal-chip-list">${chips}${more}</div>`;
  }

  function ensureSelectedDayInMonth() {
    const state = ensureSocialState();
    const d = state.calendarDate instanceof Date ? state.calendarDate : new Date();
    const monthPrefix = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-`;
    const selected = String(state.calendarSelectedDay || "").trim();
    if (!selected.startsWith(monthPrefix)) {
      state.calendarSelectedDay = `${monthPrefix}01`;
    }
  }

  function renderCalendarGrid() {
    const grid = document.getElementById("socialCalendarGrid");
    if (!grid) return;
    const state = ensureSocialState();
    const d = state.calendarDate instanceof Date ? state.calendarDate : new Date();
    ensureSelectedDayInMonth();
    const selected = String(state.calendarSelectedDay || "").trim();
    const today = dayKey(new Date());
    const first = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0, 0, 0, 0, 0);
    const shift = (first.getDay() + 6) % 7;
    const days = last.getDate();
    const weekdays = [t("Пн", "Mon"), t("Вт", "Tue"), t("Ср", "Wed"), t("Чт", "Thu"), t("Пт", "Fri"), t("Сб", "Sat"), t("Вс", "Sun")];

    let html = `<div class="social-calendar-row head">${weekdays.map((x) => `<span>${esc(x)}</span>`).join("")}</div><div class="social-calendar-cells">`;
    for (let i = 0; i < shift; i += 1) html += `<button class="social-day muted" disabled></button>`;
    for (let day = 1; day <= days; day += 1) {
      const key = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(day)}`;
      const active = selected === key ? "active" : "";
      const todayClass = today === key ? "today" : "";
      html += `
        <button class="social-day ${active} ${todayClass}" data-day-key="${key}" type="button" onclick="socialShowDay('${key}')">
          <b>${day}</b>
          ${calendarCellChips(key)}
        </button>
      `;
    }
    html += "</div>";
    grid.innerHTML = html;

    const monthLabel = document.getElementById("socialCalendarMonthLabel");
    if (monthLabel) monthLabel.textContent = cleanText(calendarMonthLabel(d));
  }

  function normalizeCalendarScaffold() {
    const root = document.getElementById("socialSubtabCalendar");
    if (!root) return;
    root.classList.add("social-calendar-samsung-mode");
    root.querySelectorAll("#socialCalendarEvents, .social-calendar-events, .social-calendar-sync, .social-calendar-google, .social-calendar-filters, .social-calendar-toolbar, .social-calendar-toolbar--modern, .social-calendar-toolbar--clean, #socialCalendarTaskMode, #socialCalendarPrimaryAction").forEach((node) => {
      node.classList.add("hidden");
      node.setAttribute("aria-hidden", "true");
    });
    const fab = document.getElementById("socialCalendarFab");
    if (fab) fab.classList.remove("hidden");
  }

  function renderDaySheet(openSheet = false) {
    const backdrop = document.getElementById("socialCalendarDaySheetBackdrop");
    const sheet = document.getElementById("socialCalendarDaySheet");
    if (!backdrop || !sheet) return;
    const state = ensureSocialState();
    const selected = String(state.calendarSelectedDay || "").trim();
    if (!selected) {
      sheet.classList.add("hidden");
      backdrop.classList.add("hidden");
      return;
    }

    const rows = calendarRowsForDay(selected);
    const cards = rows.length
      ? rows.map((item, index) => {
        const key = `${item.kind}:${item.id || 0}:${index}`;
        const encodedKey = encodeURIComponent(key);
        const expanded = Boolean(window.__swCalExpanded?.has(key));
        const title = calendarRowTitle(item);
        const time = calendarRowTime(item);
        const meta = calendarRowMeta(item);
        const desc = calendarRowDescription(item);
        const editAction = item.kind === "event"
          ? `socialOpenCalendarModal(${Number(item.id || 0)});event.stopPropagation();`
          : `switchSocialSubtab('tasks');socialOpenTaskModal(${Number(item.id || 0)});event.stopPropagation();`;
        const deleteAction = item.kind === "event"
          ? `socialDeleteEvent(${Number(item.id || 0)});event.stopPropagation();`
          : `socialDeleteTask(${Number(item.id || 0)});event.stopPropagation();`;
        return `
          <article class="sw-day-item ${item.kind === "task" ? "is-task" : "is-event"} ${expanded ? "is-expanded" : ""}" style="--sw-chip-color:${esc(calendarRowColor(item))}" onclick="socialToggleCalendarItemExpanded('${encodedKey}')">
            <div class="sw-day-item-head">
              <b>${esc(compactText(title, 56))}</b>
              <small>${esc(time)}</small>
            </div>
            <div class="sw-day-item-meta">${esc(meta || "")}</div>
            ${expanded ? `<div class="sw-day-item-desc">${esc(desc)}</div><div class="sw-day-item-actions"><button type="button" class="btn-secondary" onclick="${editAction}">${esc(t("Редактировать", "Edit"))}</button><button type="button" class="btn-danger" onclick="${deleteAction}">${esc(t("Удалить", "Delete"))}</button></div>` : ""}
          </article>
        `;
      }).join("")
      : `<div class="hint">${esc(t("На этот день событий нет.", "No events for this day."))}</div>`;

    sheet.innerHTML = `
      <section class="sw-day-sheet-card">
        <div class="sw-day-sheet-head">
          <div>
            <div class="sw-day-sheet-kicker">${esc(t("Выбранный день", "Selected day"))}</div>
            <h4>${esc(cleanText(calendarDayLabel(selected)))}</h4>
          </div>
          <button type="button" class="btn-secondary" onclick="socialHideCalendarDaySheet()">✕</button>
        </div>
        <div class="sw-day-sheet-list">${cards}</div>
        <div class="sw-day-sheet-footer">
          <button type="button" class="btn-secondary" onclick="socialOpenCalendarQuickAddMenu()">${esc(t("Добавить", "Add"))}</button>
        </div>
      </section>
    `;

    if (openSheet) {
      sheet.classList.remove("hidden");
      backdrop.classList.remove("hidden");
      sheet.setAttribute("aria-hidden", "false");
    }
  }

  window.socialHideCalendarDaySheet = function socialHideCalendarDaySheet() {
    const backdrop = document.getElementById("socialCalendarDaySheetBackdrop");
    const sheet = document.getElementById("socialCalendarDaySheet");
    if (sheet) {
      sheet.classList.add("hidden");
      sheet.setAttribute("aria-hidden", "true");
    }
    if (backdrop) backdrop.classList.add("hidden");
  };

  window.__swCalExpanded = new Set();

  window.socialToggleCalendarItemExpanded = function socialToggleCalendarItemExpanded(encodedKey) {
    const key = decodeURIComponent(String(encodedKey || ""));
    if (!key) return;
    if (window.__swCalExpanded.has(key)) window.__swCalExpanded.delete(key);
    else window.__swCalExpanded.add(key);
    renderDaySheet(true);
  };

  window.socialShowDay = function socialShowDayOverride(key) {
    const safe = String(key || "").trim();
    if (!safe) return;
    const state = ensureSocialState();
    state.calendarSelectedDay = safe;
    renderCalendarGrid();
    renderDaySheet(true);
  };

  window.socialRenderCalendar = function socialRenderCalendarSamsung() {
    const state = ensureSocialState();
    if (!(state.calendarDate instanceof Date)) state.calendarDate = new Date();
    normalizeCalendarScaffold();
    renderCalendarGrid();
    renderDaySheet(false);
    queueTextRepair();
  };

  window.socialLoadCalendar = async function socialLoadCalendarSamsungOverride() {
    const state = ensureSocialState();
    normalizeCalendarScaffold();
    if (!(state.calendarDate instanceof Date) || Number.isNaN(state.calendarDate.getTime())) {
      const now = new Date();
      state.calendarDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    }

    const monthInput = document.getElementById("socialCalendarMonth");
    if (monthInput && !String(monthInput.value || "").trim()) {
      monthInput.value = `${state.calendarDate.getFullYear()}-${pad2(state.calendarDate.getMonth() + 1)}`;
    }
    const monthVal = String(monthInput?.value || "").trim();
    if (monthVal) {
      const parts = monthVal.split("-");
      const y = Number(parts[0] || 0);
      const m = Number(parts[1] || 0);
      if (Number.isFinite(y) && Number.isFinite(m) && y > 0 && m > 0) {
        state.calendarDate = new Date(y, m - 1, 1, 0, 0, 0, 0);
      }
    }
    const monthLabel = document.getElementById("socialCalendarMonthLabel");
    if (monthLabel) monthLabel.textContent = cleanText(calendarMonthLabel(state.calendarDate));

    const start = new Date(state.calendarDate.getFullYear(), state.calendarDate.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(state.calendarDate.getFullYear(), state.calendarDate.getMonth() + 1, 0, 23, 59, 59, 0);
    const qp = new URLSearchParams({
      date_from: `${start.getFullYear()}-${pad2(start.getMonth() + 1)}-${pad2(start.getDate())} 00:00:00`,
      date_to: `${end.getFullYear()}-${pad2(end.getMonth() + 1)}-${pad2(end.getDate())} 23:59:59`,
    });

    const rows = await window.socialRequest(`/api/social/calendar/events?${qp.toString()}`).catch((error) => {
      state.calendarEvents = [];
      if (typeof window.socialSetCalendarSyncMessage === "function") {
        window.socialSetCalendarSyncMessage("error", t("Не удалось загрузить события календаря", "Failed to load calendar events"), [String(error?.message || "")]);
      }
      return [];
    });
    state.calendarEvents = Array.isArray(rows) ? rows : [];

    if (calendarMode() !== "events" && typeof window.socialLoadTasks === "function") {
      await window.socialLoadTasks({ silent: true }).catch(() => null);
    }

    window.socialRenderCalendar();
    return state.calendarEvents;
  };

  const originalSocialShowToast = typeof window.socialShowToast === "function" ? window.socialShowToast : null;
  if (originalSocialShowToast && !originalSocialShowToast.__swTextWrapped) {
    const wrappedToast = function socialShowToastTextSafe(title, body) {
      return originalSocialShowToast.call(this, cleanText(title), cleanText(body));
    };
    wrappedToast.__swTextWrapped = true;
    window.socialShowToast = wrappedToast;
  }

  function recurrenceLabel(kind) {
    const map = {
      none: t("Не повторять", "Does not repeat"),
      daily: t("Каждый день", "Daily"),
      weekly: t("Каждую неделю", "Weekly"),
      monthly: t("Каждый месяц", "Monthly"),
      yearly: t("Каждый год", "Yearly"),
    };
    return map[String(kind || "none").trim().toLowerCase()] || map.none;
  }

  function reminderLabel(min) {
    const value = Math.max(0, Number(min || 0));
    if (value === 0) return t("В момент события", "At event time");
    if (value < 60) return t(`За ${value} мин.`, `${value} min before`);
    if (value < 1440) return t(`За ${Math.round(value / 60)} ч`, `${Math.round(value / 60)} h before`);
    return t(`За ${Math.round(value / 1440)} дн.`, `${Math.round(value / 1440)} d before`);
  }

  function renderReminderChecks(activeValues) {
    const active = new Set((Array.isArray(activeValues) ? activeValues : [10]).map((n) => Math.max(0, Number(n || 0))));
    const presets = REMINDER_PRESETS.map((value) => `
      <label class="check social-reminder-check">
        <input class="social-event-reminder-item" type="checkbox" value="${value}" ${active.has(value) ? "checked" : ""} />
        ${esc(reminderLabel(value))}
      </label>
    `).join("");
    const customValue = [...active].find((value) => !REMINDER_PRESETS.includes(value) && value > 0) || "";
    return `${presets}<label><span>${esc(t("Свой интервал (мин.)", "Custom offset (min)"))}</span><input id="socialEventReminderCustom" type="number" min="1" step="1" value="${esc(customValue)}" /></label>`;
  }

  function reminderOffsetsFromModal() {
    const values = [];
    document.querySelectorAll(".social-event-reminder-item:checked").forEach((node) => {
      const val = Math.max(0, Number(node?.value || 0));
      if (Number.isFinite(val) && val >= 0) values.push(val);
    });
    const custom = Math.max(0, Number(document.getElementById("socialEventReminderCustom")?.value || 0));
    if (Number.isFinite(custom) && custom > 0) values.push(custom);
    const uniq = [...new Set(values)].filter((v) => Number.isFinite(v) && v >= 0);
    return uniq.sort((a, b) => a - b);
  }

  function taskQuickCreate(dueValue = "") {
    if (typeof window.switchSocialSubtab === "function") window.switchSocialSubtab("tasks");
    window.setTimeout(() => {
      if (typeof window.socialOpenTaskModal === "function") window.socialOpenTaskModal(0);
      if (dueValue) {
        window.setTimeout(() => {
          const dueInput = document.getElementById("socialTaskDue");
          if (dueInput && !String(dueInput.value || "").trim()) dueInput.value = dueValue;
        }, 80);
      }
    }, 80);
  }
  window.socialOpenCalendarModal = function socialOpenCalendarModalOverride(eventId = 0, options = {}) {
    const row = (Array.isArray(window.socialState?.calendarEvents) ? window.socialState.calendarEvents : [])
      .find((item) => Number(item?.id || 0) === Number(eventId || 0)) || null;
    const selectedDay = String(options?.selectedDay || window.socialState?.calendarSelectedDay || "").trim();
    const presetKind = String(options?.presetKind || "event").trim().toLowerCase();
    const isReminder = presetKind === "reminder";

    const defaultStart = selectedDay ? `${selectedDay}T09:00` : dateTimeInputValue(new Date());
    const startValue = dateTimeInputValue(row?.start_at || defaultStart);
    const endValue = dateTimeInputValue(row?.end_at || "");
    const recurrenceKind = String(row?.recurrence_kind || "none").trim().toLowerCase();
    const recurrenceInterval = Math.max(1, Number(row?.recurrence_interval || 1));
    const reminders = Array.isArray(row?.reminder_offsets_min) && row.reminder_offsets_min.length
      ? row.reminder_offsets_min
      : [10];
    const reminderEnabled = row?.reminder_enabled !== false;
    const isPublic = row?.is_public === true && !isReminder;

    const recurrenceSelect = RECURRENCE_OPTIONS.map((kind) => `<option value="${kind}" ${kind === recurrenceKind ? "selected" : ""}>${esc(recurrenceLabel(kind))}</option>`).join("");

    if (typeof window.socialOpenModal !== "function") return;
    window.socialOpenModal(
      row ? t("Изменить событие", "Edit event") : (isReminder ? t("Новое напоминание", "New reminder") : t("Новое событие", "New event")),
      `
        <input id="socialEventEntryKind" type="hidden" value="${isReminder ? "reminder" : "event"}" />
        <div class="grid-2 social-calendar-modal-grid">
          <label class="full"><span>${esc(t("Название", "Title"))}</span><input id="socialEventTitle" value="${esc(cleanText(row?.title || ""))}" /></label>
          <label><span>${esc(t("Цвет", "Color"))}</span><input id="socialEventColor" type="color" value="${esc(normalizeColor(row?.color, "#4c92ff"))}" /></label>
          <label class="check"><input id="socialEventPublic" type="checkbox" ${isPublic ? "checked" : ""} ${isReminder ? "disabled" : ""} /> ${esc(t("Общее событие", "Shared event"))}</label>
          <label><span>${esc(t("Начало", "Start"))}</span><input id="socialEventStart" type="datetime-local" value="${esc(startValue)}" /></label>
          <label><span>${esc(t("Конец", "End"))}</span><input id="socialEventEnd" type="datetime-local" value="${esc(endValue)}" /></label>
          <label><span>${esc(t("Повтор", "Repeat"))}</span><select id="socialEventRecurrenceKind">${recurrenceSelect}</select></label>
          <label><span>${esc(t("Интервал", "Interval"))}</span><input id="socialEventRecurrenceInterval" type="number" min="1" step="1" value="${esc(recurrenceInterval)}" /></label>
          <label class="check"><input id="socialEventReminderEnabled" type="checkbox" ${reminderEnabled ? "checked" : ""} /> ${esc(t("Включить напоминания", "Enable reminders"))}</label>
          <div class="full social-reminder-grid" id="socialEventReminderGrid">${renderReminderChecks(reminders)}</div>
          <label class="full"><span>${esc(t("Примечание", "Details"))}</span><textarea id="socialEventDetails" rows="4">${esc(cleanText(row?.details || ""))}</textarea></label>
        </div>
        <div class="actions">
          <button type="button" onclick="socialSaveEvent(${Number(row?.id || 0)})">${esc(row ? t("Сохранить", "Save") : t("Создать", "Create"))}</button>
        </div>
      `
    );
    queueTextRepair();
  };

  window.socialSaveEvent = async function socialSaveEventOverride(eventId = 0) {
    const title = cleanText(document.getElementById("socialEventTitle")?.value || "").trim();
    const startAt = String(document.getElementById("socialEventStart")?.value || "").trim();
    const endAt = String(document.getElementById("socialEventEnd")?.value || "").trim();
    const entryKind = String(document.getElementById("socialEventEntryKind")?.value || "event").trim().toLowerCase();
    const reminderEnabled = Boolean(document.getElementById("socialEventReminderEnabled")?.checked);
    const recurrenceKind = String(document.getElementById("socialEventRecurrenceKind")?.value || "none").trim().toLowerCase();
    const recurrenceInterval = Math.max(1, Number(document.getElementById("socialEventRecurrenceInterval")?.value || 1));
    const reminderOffsets = reminderEnabled ? reminderOffsetsFromModal() : [];

    if (!title || !startAt) {
      alert(t("Заполните название и дату начала", "Fill title and start date"));
      return;
    }

    const payload = {
      title,
      details: cleanText(document.getElementById("socialEventDetails")?.value || "").trim(),
      start_at: startAt,
      end_at: endAt || null,
      is_public: entryKind === "reminder" ? false : Boolean(document.getElementById("socialEventPublic")?.checked),
      color: normalizeColor(document.getElementById("socialEventColor")?.value || "", "#4c92ff"),
      recurrence_kind: RECURRENCE_OPTIONS.includes(recurrenceKind) ? recurrenceKind : "none",
      recurrence_interval: recurrenceInterval,
      reminder_enabled: reminderEnabled,
      reminder_offsets_min: reminderOffsets.length ? reminderOffsets : [10],
    };

    const req = Number(eventId || 0) > 0
      ? window.socialRequest(`/api/social/calendar/events/${Number(eventId)}`, { method: "PUT", body: JSON.stringify(payload) })
      : window.socialRequest("/api/social/calendar/events", { method: "POST", body: JSON.stringify(payload) });

    await req.catch((error) => {
      alert(error?.message || t("Не удалось сохранить событие", "Failed to save event"));
      return null;
    });

    if (typeof window.socialCloseModal === "function") window.socialCloseModal();
    if (typeof window.socialLoadCalendar === "function") await window.socialLoadCalendar();
    renderDaySheet(false);
  };

  window.socialDeleteEvent = async function socialDeleteEventOverride(eventId) {
    const id = Number(eventId || 0);
    if (!id) return;
    if (!confirm(t("Удалить событие?", "Delete event?"))) return;
    await window.socialRequest(`/api/social/calendar/events/${id}`, { method: "DELETE" }).catch((error) => {
      alert(error?.message || t("Не удалось удалить событие", "Failed to delete event"));
      return null;
    });
    if (typeof window.socialLoadCalendar === "function") await window.socialLoadCalendar();
    renderDaySheet(false);
  };

  window.socialOpenCalendarQuickAddMenu = function socialOpenCalendarQuickAddMenu() {
    const state = ensureSocialState();
    const selectedDay = String(state.calendarSelectedDay || "").trim();
    if (typeof window.socialOpenModal !== "function") return;
    window.socialOpenModal(
      t("Добавить", "Add"),
      `
        <div class="sw-calendar-quick-menu">
          <button type="button" onclick="socialCalendarQuickCreate('event')">${esc(t("Событие", "Event"))}</button>
          <button type="button" onclick="socialCalendarQuickCreate('reminder')">${esc(t("Напоминание", "Reminder"))}</button>
          <button type="button" onclick="socialCalendarQuickCreate('task')">${esc(t("Задача", "Task"))}</button>
          <div class="hint">${esc(selectedDay ? `${t("Дата", "Date")}: ${selectedDay}` : t("Выберите день в календаре", "Select a day in calendar"))}</div>
        </div>
      `
    );
  };

  window.socialCalendarQuickCreate = function socialCalendarQuickCreate(kind) {
    const safe = String(kind || "event").trim().toLowerCase();
    const state = ensureSocialState();
    const selectedDay = String(state.calendarSelectedDay || "").trim();
    const dueValue = selectedDay ? `${selectedDay}T09:00` : "";
    if (typeof window.socialCloseModal === "function") window.socialCloseModal();
    if (safe === "task") {
      taskQuickCreate(dueValue);
      return;
    }
    window.socialOpenCalendarModal(0, { presetKind: safe, selectedDay });
  };

  function noteColorMap() {
    try {
      const parsed = JSON.parse(String(localStorage.getItem(NOTE_COLORS_KEY) || "{}"));
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function getNoteColor(noteId) {
    const id = Number(noteId || 0);
    if (!id) return NOTE_DEFAULT_COLOR;
    const map = noteColorMap();
    const raw = String(map[String(id)] || "").trim();
    return /^#[0-9a-fA-F]{6}$/.test(raw) ? raw : NOTE_DEFAULT_COLOR;
  }

  function setNoteColor(noteId, color) {
    const id = Number(noteId || 0);
    if (!id) return;
    const map = noteColorMap();
    map[String(id)] = normalizeColor(color, NOTE_DEFAULT_COLOR);
    try { localStorage.setItem(NOTE_COLORS_KEY, JSON.stringify(map)); } catch (_) {}
  }

  function ensureNotesCompactLayout() {
    const root = document.getElementById("socialSubtabNotes");
    if (!root) return;
    root.classList.add("sw-notes-compact");
    const createBtn = root.querySelector(".social-notes-sidebar > button");
    if (createBtn) createBtn.textContent = t("Создать запись", "Create note");
  }

  function noteCardsHtml() {
    const rows = Array.isArray(window.socialState?.notes) ? window.socialState.notes : [];
    if (!rows.length) return `<div class="hint">${esc(t("Заметок пока нет", "No notes yet"))}</div>`;
    return `<div class="sw-notes-grid">${rows.map((note) => {
      const id = Number(note?.id || 0);
      const title = compactText(note?.title || t("Без названия", "Untitled"), 28);
      const snippet = compactText(note?.content || "", 76) || t("Пустая заметка", "Empty note");
      const stamp = String(note?.updated_at || note?.created_at || "").replace("T", " ").slice(0, 16);
      return `
        <button type="button" class="sw-note-card" style="--sw-note-cover:${esc(getNoteColor(id))}" onclick="socialOpenNoteEditor(${id})">
          <b class="sw-note-title">${esc(title)}</b>
          <div class="sw-note-snippet">${esc(snippet)}</div>
          <small class="sw-note-meta">${esc(stamp)}</small>
        </button>
      `;
    }).join("")}</div>`;
  }

  window.socialRenderNotesList = function socialRenderNotesListOverride() {
    ensureNotesCompactLayout();
    const host = document.getElementById("socialNotesList");
    if (!host) return;
    host.innerHTML = noteCardsHtml();
    queueTextRepair();
  };

  window.socialSelectNote = function socialSelectNoteOverride(noteId) {
    window.socialOpenNoteEditor(noteId);
  };

  window.socialOpenNoteEditor = function socialOpenNoteEditor(noteId) {
    const id = Number(noteId || 0);
    if (!id || typeof window.socialOpenModal !== "function") return;
    const note = (Array.isArray(window.socialState?.notes) ? window.socialState.notes : []).find((row) => Number(row?.id || 0) === id) || null;
    if (!note) return;

    const files = Array.isArray(note.files) ? note.files : [];
    const fileRows = files.length
      ? files.map((file) => `
          <div class="social-note-file-row">
            <a href="${esc(file?.url || "#")}" target="_blank" rel="noopener noreferrer">${esc(cleanText(file?.filename || "file"))}</a>
            <button class="btn-secondary" type="button" onclick="socialDeleteNoteFileFromModal(${id}, ${Number(file?.id || 0)})">✕</button>
          </div>
        `).join("")
      : `<div class="hint">${esc(t("Файлы не добавлены", "No files attached"))}</div>`;

    const palette = NOTE_PALETTE.map((color) => {
      const active = normalizeColor(getNoteColor(id), NOTE_DEFAULT_COLOR) === color ? "is-active" : "";
      return `<button type="button" class="sw-note-color ${active}" style="--sw-note-cover:${esc(color)}" onclick="socialPickNoteColor(${id}, '${color}')"></button>`;
    }).join("");

    window.socialOpenModal(
      t("Заметка", "Note"),
      `
        <div class="social-note-editor-modal">
          <label><span>${esc(t("Название", "Title"))}</span><input id="socialNoteModalTitle" value="${esc(cleanText(note?.title || ""))}" /></label>
          <label><span>${esc(t("Текст", "Text"))}</span><textarea id="socialNoteModalContent" rows="10">${esc(cleanText(note?.content || ""))}</textarea></label>
          <label><span>${esc(t("Цвет обложки", "Cover color"))}</span><div class="sw-note-colors">${palette}</div></label>
          <div class="social-note-files-head">
            <b>${esc(t("Файлы", "Files"))}</b>
            <input id="socialNoteModalUpload" type="file" multiple onchange="socialUploadNoteFilesFromModal(${id}, 'socialNoteModalUpload')" />
            <button class="btn-secondary" type="button" onclick="document.getElementById('socialNoteModalUpload').click()">${esc(t("Добавить файлы", "Add files"))}</button>
          </div>
          <div id="socialNoteModalFilesList">${fileRows}</div>
          <details class="sw-note-settings">
            <summary>${esc(t("Настройки заметки", "Note settings"))}</summary>
            <button class="btn-danger" type="button" onclick="socialDeleteNoteFromSettings(${id})">${esc(t("Удалить заметку", "Delete note"))}</button>
          </details>
          <div class="actions">
            <button type="button" onclick="socialSaveNoteEditor(${id})">${esc(t("Сохранить", "Save"))}</button>
          </div>
        </div>
      `
    );
  };

  window.socialPickNoteColor = function socialPickNoteColor(noteId, color) {
    const id = Number(noteId || 0);
    if (!id) return;
    setNoteColor(id, color);
    const buttons = document.querySelectorAll(".sw-note-color");
    buttons.forEach((button) => {
      const nodeColor = window.getComputedStyle(button).getPropertyValue("--sw-note-cover").trim().toLowerCase();
      button.classList.toggle("is-active", nodeColor === normalizeColor(color).toLowerCase());
    });
  };

  window.socialSaveNoteEditor = async function socialSaveNoteEditor(noteId) {
    const id = Number(noteId || 0);
    if (!id) return;
    const payload = {
      title: cleanText(document.getElementById("socialNoteModalTitle")?.value || "").trim() || t("Без названия", "Untitled"),
      content: cleanText(document.getElementById("socialNoteModalContent")?.value || ""),
    };
    await window.socialRequest(`/api/social/notes/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }).catch((error) => {
      alert(error?.message || t("Не удалось сохранить заметку", "Failed to save note"));
      return null;
    });
    await window.socialLoadNotes();
    if (typeof window.socialCloseModal === "function") window.socialCloseModal();
  };

  window.socialUploadNoteFilesFromModal = async function socialUploadNoteFilesFromModal(noteId, inputId) {
    const id = Number(noteId || 0);
    if (!id) return;
    const input = document.getElementById(String(inputId || ""));
    const files = Array.from(input?.files || []);
    if (!files.length) return;

    try {
      for (const file of files) {
        const body = new FormData();
        body.append("file", file);
        const headers = {};
        if (window.token) headers.Authorization = `Bearer ${window.token}`;
        await window.requestJson(`/api/social/notes/${id}/files`, {
          method: "POST",
          headers,
          body,
          timeoutMs: 90000,
          retryOnPost: true,
          maxRetries: 1,
        });
      }
      await window.socialLoadNotes();
      window.socialOpenNoteEditor(id);
    } catch (error) {
      alert(error?.message || t("Ошибка загрузки файла", "File upload error"));
    } finally {
      if (input) input.value = "";
    }
  };

  window.socialDeleteNoteFileFromModal = async function socialDeleteNoteFileFromModal(noteId, fileId) {
    const id = Number(noteId || 0);
    const fid = Number(fileId || 0);
    if (!id || !fid) return;
    if (!confirm(t("Удалить файл?", "Delete file?"))) return;
    await window.socialRequest(`/api/social/notes/${id}/files/${fid}`, { method: "DELETE" }).catch((error) => {
      alert(error?.message || t("Не удалось удалить файл", "Failed to delete file"));
      return null;
    });
    await window.socialLoadNotes();
    window.socialOpenNoteEditor(id);
  };

  window.socialDeleteNoteFromSettings = async function socialDeleteNoteFromSettings(noteId) {
    const id = Number(noteId || 0);
    if (!id) return;
    if (!confirm(t("Удалить заметку?", "Delete note?"))) return;
    await window.socialRequest(`/api/social/notes/${id}`, { method: "DELETE" }).catch((error) => {
      alert(error?.message || t("Не удалось удалить заметку", "Failed to delete note"));
      return null;
    });
    await window.socialLoadNotes();
    if (typeof window.socialCloseModal === "function") window.socialCloseModal();
  };

  window.socialCreateNote = async function socialCreateNoteOverride() {
    const row = await window.socialRequest("/api/social/notes", {
      method: "POST",
      body: JSON.stringify({ title: t("Новая заметка", "New note"), content: "" }),
    }).catch((error) => {
      alert(error?.message || t("Не удалось создать заметку", "Failed to create note"));
      return null;
    });
    if (!row) return;
    await window.socialLoadNotes();
    window.socialOpenNoteEditor(Number(row?.id || 0));
  };
  const originalSwitchSocialSubtab = typeof window.switchSocialSubtab === "function"
    ? window.switchSocialSubtab
    : null;
  if (originalSwitchSocialSubtab && !originalSwitchSocialSubtab.__swSamsungWrapped) {
    const wrappedSwitchSocialSubtab = function wrappedSwitchSocialSubtab() {
      const result = originalSwitchSocialSubtab.apply(this, arguments);
      const requested = String(arguments[0] || "").trim().toLowerCase();
      window.setTimeout(() => {
        normalizeNotificationCenter();
        if (requested === "calendar" && typeof window.socialLoadCalendar === "function") {
          window.socialLoadCalendar().catch(() => {
            if (typeof window.socialRenderCalendar === "function") window.socialRenderCalendar();
          });
        }
        if (requested === "notes" && typeof window.socialRenderNotesList === "function") {
          window.socialRenderNotesList();
        }
        queueTextRepair();
      }, 0);
      return result;
    };
    wrappedSwitchSocialSubtab.__swSamsungWrapped = true;
    window.switchSocialSubtab = wrappedSwitchSocialSubtab;
  }

  function init() {
    ensureSocialState();
    ensureNotesCompactLayout();
    applyKnownCopy();
    bindBellButtons();
    normalizeNotificationCenter();
    queueTextRepair();
    if (String(window.socialState?.currentSubtab || "") === "calendar") {
      normalizeCalendarScaffold();
      if (typeof window.socialLoadCalendar === "function") {
        window.socialLoadCalendar().catch(() => {
          if (typeof window.socialRenderCalendar === "function") window.socialRenderCalendar();
        });
      } else if (typeof window.socialRenderCalendar === "function") {
        window.socialRenderCalendar();
      }
    }
    if (String(window.socialState?.currentSubtab || "") === "notes") {
      window.socialRenderNotesList();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
  window.setTimeout(init, 250);
})();



















