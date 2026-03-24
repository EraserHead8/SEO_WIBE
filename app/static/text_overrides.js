(function textOverridesV20260323s2() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.__textOverridesV20260323s2) return;
  window.__textOverridesV20260323s2 = true;

  const TEXT_ATTRS = ["title", "placeholder", "aria-label", "data-tip"];
  const cp1251Table = new Map();
  const ruFallbackByEnglish = new Map([
    ["Dashboard", "Статистика"],
    ["Products", "Товары"],
    ["Reviews/Questions", "Отзывы/Вопросы"],
    ["Accounting", "Бухгалтерия"],
    ["Ads WB/Ozon", "Реклама WB/Ozon"],
    ["Social Hub", "Социальный"],
    ["Profile", "Профиль"],
    ["Help", "Справка"],
    ["Chats", "Чаты"],
    ["Tasks", "Задачи"],
    ["Notes", "Заметки"],
    ["Calendar", "Календарь"],
    ["Calculator", "Калькулятор"],
    ["Games", "Игры"],
    ["Reviews", "Отзывы"],
    ["Questions", "Вопросы"],
    ["Returns", "Возвраты"],
    ["Ads WB", "Реклама WB"],
    ["Ad analytics", "Аналитика рекламы"],
    ["Recommendations", "Рекомендации"],
    ["WB Ads bidder", "Бидер WB Ads"],
    ["Section", "Раздел"],
    ["Menu", "Меню"],
    ["Notifications", "Уведомления"],
    ["Send", "Отправить"],
    ["Create note", "Создать запись"],
    ["New task", "Новая задача"],
    ["New project", "Новый проект"],
    ["Project members", "Участники проекта"],
    ["Refresh", "Обновить"],
    ["Search", "Поиск"],
    ["Logout", "Выйти"],
    ["Mark all read", "Прочитать все"],
    ["No notifications yet.", "Уведомлений пока нет."],
    ["Notification", "Уведомление"],
  ]);
  const brokenQuestionMap = new Map([
    ["??????????", "Социальный"],
    ["??????? WB/Ozon", "Реклама WB/Ozon"],
    ["??????? WB", "Реклама WB"],
    ["????????????", "Рекомендации"],
    ["??????? ????????", "Рекламные кампании"],
    ["???????", "Справка"],
    ["????????/?????????? ????", "Свернуть/развернуть меню"],
    ["??????", "Раздел"],
  ]);
  (function installDictionaryFixesV20260324a() {
    const ruFixed = {
      Dashboard: "\u0421\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043a\u0430",
      Products: "\u0422\u043e\u0432\u0430\u0440\u044b",
      "Reviews/Questions": "\u041e\u0442\u0437\u044b\u0432\u044b/\u0412\u043e\u043f\u0440\u043e\u0441\u044b",
      Accounting: "\u0411\u0443\u0445\u0433\u0430\u043b\u0442\u0435\u0440\u0438\u044f",
      "Ads WB/Ozon": "\u0420\u0435\u043a\u043b\u0430\u043c\u0430 WB/Ozon",
      "Social Hub": "\u0421\u043e\u0446\u0438\u0430\u043b\u044c\u043d\u044b\u0439",
      Profile: "\u041f\u0440\u043e\u0444\u0438\u043b\u044c",
      Help: "\u0421\u043f\u0440\u0430\u0432\u043a\u0430",
      Chats: "\u0427\u0430\u0442\u044b",
      Tasks: "\u0417\u0430\u0434\u0430\u0447\u0438",
      Notes: "\u0417\u0430\u043c\u0435\u0442\u043a\u0438",
      Calendar: "\u041a\u0430\u043b\u0435\u043d\u0434\u0430\u0440\u044c",
      Calculator: "\u041a\u0430\u043b\u044c\u043a\u0443\u043b\u044f\u0442\u043e\u0440",
      Games: "\u0418\u0433\u0440\u044b",
      Reviews: "\u041e\u0442\u0437\u044b\u0432\u044b",
      Questions: "\u0412\u043e\u043f\u0440\u043e\u0441\u044b",
      Returns: "\u0412\u043e\u0437\u0432\u0440\u0430\u0442\u044b",
      "Ads WB": "\u0420\u0435\u043a\u043b\u0430\u043c\u0430 WB",
      "Ad analytics": "\u0410\u043d\u0430\u043b\u0438\u0442\u0438\u043a\u0430 \u0440\u0435\u043a\u043b\u0430\u043c\u044b",
      Recommendations: "\u0420\u0435\u043a\u043e\u043c\u0435\u043d\u0434\u0430\u0446\u0438\u0438",
      "WB Ads bidder": "\u0411\u0438\u0434\u0435\u0440 WB Ads",
      Section: "\u0420\u0430\u0437\u0434\u0435\u043b",
      Menu: "\u041c\u0435\u043d\u044e",
      Notifications: "\u0423\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f",
      Send: "\u041e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c",
      "Create note": "\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u0437\u0430\u043f\u0438\u0441\u044c",
      "New task": "\u041d\u043e\u0432\u0430\u044f \u0437\u0430\u0434\u0430\u0447\u0430",
      "New project": "\u041d\u043e\u0432\u044b\u0439 \u043f\u0440\u043e\u0435\u043a\u0442",
      "Project members": "\u0423\u0447\u0430\u0441\u0442\u043d\u0438\u043a\u0438 \u043f\u0440\u043e\u0435\u043a\u0442\u0430",
      Refresh: "\u041e\u0431\u043d\u043e\u0432\u0438\u0442\u044c",
      Search: "\u041f\u043e\u0438\u0441\u043a",
      Logout: "\u0412\u044b\u0439\u0442\u0438",
      "Mark all read": "\u041f\u0440\u043e\u0447\u0438\u0442\u0430\u0442\u044c \u0432\u0441\u0435",
      "No notifications yet.": "\u0423\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u0439 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442.",
      Notification: "\u0423\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u0435",
    };
    Object.entries(ruFixed).forEach(([key, value]) => {
      ruFallbackByEnglish.set(String(key), String(value));
    });

    const brokenFixed = {
      "??????????": "\u0421\u043e\u0446\u0438\u0430\u043b\u044c\u043d\u044b\u0439",
      "??????? WB/Ozon": "\u0420\u0435\u043a\u043b\u0430\u043c\u0430 WB/Ozon",
      "??????? WB": "\u0420\u0435\u043a\u043b\u0430\u043c\u0430 WB",
      "????????????": "\u0420\u0435\u043a\u043e\u043c\u0435\u043d\u0434\u0430\u0446\u0438\u0438",
      "??????? ????????": "\u0420\u0435\u043a\u043b\u0430\u043c\u043d\u044b\u0435 \u043a\u0430\u043c\u043f\u0430\u043d\u0438\u0438",
      "???????": "\u0421\u043f\u0440\u0430\u0432\u043a\u0430",
      "????????/?????????? ????": "\u0421\u0432\u0435\u0440\u043d\u0443\u0442\u044c/\u0440\u0430\u0437\u0432\u0435\u0440\u043d\u0443\u0442\u044c \u043c\u0435\u043d\u044e",
      "??????": "\u0420\u0430\u0437\u0434\u0435\u043b",
    };
    Object.entries(brokenFixed).forEach(([key, value]) => {
      brokenQuestionMap.set(String(key), String(value));
    });
  })();
  let queueRaf = 0;
  const queuedRoots = new Set();
  let calendarRecoverAt = 0;
  let domObserver = null;
  let observerQueued = false;

  function isEn() {
    return String(window.currentLang || "").trim().toLowerCase() === "en";
  }

  function pick(ru, en) {
    const value = isEn() ? String(en || "") : String(ru || "");
    return repairText(value);
  }

  function localizeEnglishFallback(enValue) {
    const key = String(enValue || "").trim();
    if (!key) return "";
    return ruFallbackByEnglish.get(key) || key;
  }

  function initCp1251Table() {
    if (cp1251Table.size || typeof TextDecoder === "undefined") return;
    const decoder = new TextDecoder("windows-1251");
    for (let i = 0; i < 256; i += 1) {
      const ch = decoder.decode(new Uint8Array([i]));
      if (!cp1251Table.has(ch)) cp1251Table.set(ch, i);
    }
  }

  function cyrillicScore(text) {
    const m = String(text || "").match(/[\u0400-\u04ff]/g);
    return m ? m.length : 0;
  }

  function mojibakeScore(text) {
    const value = String(text || "");
    if (!value) return 0;
    const m = value.match(/(?:\u0420[\u0400-\u04ffA-Za-z0-9]|\u0421[\u0400-\u04ffA-Za-z0-9]|\u0412[\u0400-\u04ffA-Za-z0-9]|\u00d0.|\u00d1.|\uFFFD|\?{3,})/g);
    return m ? m.length : 0;
  }

  function normalizeArtifacts(text) {
    return String(text || "")
      .replace(/[\u0000-\u001F\u007F-\u009F]+/g, " ")
      .replace(/\u00a0/g, " ")
      .replace(/([\u0420\u0421\u0412\u00d0\u00d1])(?:\s|\u00A0)+(?=[\u0420\u0421\u0412\u00d0\u00d1\u0400-\u04ffA-Za-z0-9])/g, "$1")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  function collapseBrokenSpacing(text) {
    let out = String(text || "");
    if (!out) return "";
    for (let i = 0; i < 4; i += 1) {
      out = out
        .replace(/([\u0420\u0421\u0412\u00d0\u00d1][^\s]{0,3})(?:\s|\u00A0)+(?=[\u0420\u0421\u0412\u00d0\u00d1][^\s]{0,3})/g, "$1")
        .replace(/(\b[\u0420\u0421\u0412\u00d0\u00d1][\u0400-\u04ffA-Za-z0-9'’.,:;!?-]{0,2}\b)(?:\s|\u00A0)+(?=\b[\u0420\u0421\u0412\u00d0\u00d1][\u0400-\u04ffA-Za-z0-9'’.,:;!?-]{0,2}\b)/g, "$1")
        .replace(/([\u0420\u0421\u0412\u00d0\u00d1])(?:\s|\u00A0)+(?=[\u0400-\u04ffA-Za-z0-9])/g, "$1")
        .replace(/(?:\b[\u0420\u0421\u0412\u00d0\u00d1]\b(?:\s|\u00A0)+){3,}\b[\u0420\u0421\u0412\u00d0\u00d1]\b/g, (seq) => seq.replace(/[\s\u00A0]+/g, ""))
        .replace(/\s{2,}/g, " ");
    }
    return normalizeArtifacts(out);
  }

  function looksBroken(text) {
    const value = String(text || "");
    if (!value) return false;
    if (/\?{3,}|\uFFFD/.test(value)) return true;
    if (mojibakeScore(value) >= 2) return true;
    if (/(?:\b[\u0420\u0421\u0412\u00d0\u00d1]\b(?:\s|\u00A0)+){4,}/.test(value)) return true;
    if (/(?:[\u0420\u0421\u0412\u00d0\u00d1](?:\s|\u00A0)+){3,}/.test(value)) return true;
    if (/(?:[\u0420\u0421\u0412\u00d0\u00d1]\s+){3,}/.test(value)) return true;
    return false;
  }

  function decodeCp1251Utf8(text) {
    initCp1251Table();
    if (!cp1251Table.size || typeof TextDecoder === "undefined") return "";
    const bytes = [];
    for (const ch of String(text || "")) {
      const b = cp1251Table.get(ch);
      if (b === undefined) return "";
      bytes.push(b);
    }
    try {
      return new TextDecoder("utf-8", { fatal: false }).decode(new Uint8Array(bytes));
    } catch (_) {
      return "";
    }
  }

  function decodeLatin1Utf8(text) {
    try {
      return decodeURIComponent(escape(String(text || "")));
    } catch (_) {
      return "";
    }
  }

  function repairText(input) {
    const raw = String(input == null ? "" : input);
    if (!raw) return "";
    const directQuestionFix = brokenQuestionMap.get(raw.trim());
    if (directQuestionFix) return directQuestionFix;
    if (!looksBroken(raw)) return normalizeArtifacts(raw);
    const collapsed = collapseBrokenSpacing(raw);
    const candidates = [
      raw,
      collapsed,
      decodeCp1251Utf8(raw),
      decodeCp1251Utf8(collapsed),
      decodeLatin1Utf8(raw),
      decodeLatin1Utf8(collapsed),
      raw.replace(/([A-Za-z\u0400-\u04ff\u0420\u0421\u0412\u00d0\u00d1])(?:\s|\u00A0)+(?=[A-Za-z\u0400-\u04ff\u0420\u0421\u0412\u00d0\u00d1])/g, "$1"),
    ].filter(Boolean);
    let best = normalizeArtifacts(raw);
    let bestBad = mojibakeScore(best);
    let bestCyr = cyrillicScore(best);
    candidates.forEach((candRaw) => {
      let cand = normalizeArtifacts(candRaw);
      try {
        if (typeof window.decodePossiblyMojibake === "function") {
          cand = normalizeArtifacts(window.decodePossiblyMojibake(cand) || cand);
        }
      } catch (_) {}
      const bad = mojibakeScore(cand);
      const cyr = cyrillicScore(cand);
      if (bad < bestBad || (bad === bestBad && cyr > bestCyr)) {
        best = cand;
        bestBad = bad;
        bestCyr = cyr;
      }
    });
    return normalizeArtifacts(best);
  }

  window.__repairMojibakeText = repairText;

  function repairTextNode(node) {
    if (!node || node.nodeType !== Node.TEXT_NODE) return;
    const before = String(node.nodeValue || "");
    if (!before || !looksBroken(before)) return;
    const after = repairText(before);
    if (after && after !== before) node.nodeValue = after;
  }

  function repairElementAttrs(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return;
    const tag = String(node.tagName || "");
    if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT") return;
    for (const attr of TEXT_ATTRS) {
      const before = String(node.getAttribute?.(attr) || "");
      if (!before || !looksBroken(before)) continue;
      const after = repairText(before);
      if (after && after !== before) node.setAttribute(attr, after);
    }
  }

  function sanitizeTree(root) {
    const target = root || document.getElementById("appSection") || document.body;
    if (!target) return;
    if (target.nodeType === Node.TEXT_NODE) {
      repairTextNode(target);
      return;
    }
    if (target.nodeType === Node.ELEMENT_NODE) repairElementAttrs(target);
    const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, null);
    let current = walker.currentNode;
    while (current) {
      if (current.nodeType === Node.TEXT_NODE) repairTextNode(current);
      if (current.nodeType === Node.ELEMENT_NODE) repairElementAttrs(current);
      current = walker.nextNode();
    }
  }

  function queueSanitize(root) {
    const safeRoot = (root && root.nodeType) ? root : (document.getElementById("appSection") || document.body);
    if (safeRoot) queuedRoots.add(safeRoot);
    if (queueRaf) return;
    queueRaf = requestAnimationFrame(() => {
      queueRaf = 0;
      const roots = [...queuedRoots];
      queuedRoots.clear();
      if (!roots.length) roots.push(document.getElementById("appSection") || document.body);
      roots.forEach((node) => sanitizeTree(node));
      applyKnownCopy();
      normalizeCalendarUi();
      normalizeNotificationCenter();
      normalizeNotesGrid();
      normalizeTasksUi();
      normalizeGamesUi();
    });
  }

  function isAppShellMode() {
    try {
      if (document.body?.classList?.contains("mobile-apk-mode")) return true;
      if (document.body?.classList?.contains("mobile-client-mode")) return true;
      if (typeof window.socialIsAppShellLike === "function") return Boolean(window.socialIsAppShellLike());
      if (String(window.location?.pathname || "") === "/mobile") return true;
    } catch (_) {}
    return false;
  }

  function calendarBaseDate() {
    const d = window.socialState?.calendarDate;
    if (d instanceof Date && !Number.isNaN(d.getTime())) return d;
    return new Date();
  }

  function buildCalendarFallbackGrid(root) {
    const host = root || document.getElementById("socialSubtabCalendar");
    if (!host) return;
    const shell = host.querySelector(".social-calendar-shell") || host;
    let grid = document.getElementById("socialCalendarGrid");
    if (!grid) {
      grid = document.createElement("div");
      grid.id = "socialCalendarGrid";
      grid.className = "social-calendar-grid social-calendar-grid--samsung";
      shell.appendChild(grid);
    }
    const d = calendarBaseDate();
    const year = d.getFullYear();
    const month = d.getMonth();
    const firstDay = new Date(year, month, 1, 0, 0, 0, 0);
    const lastDay = new Date(year, month + 1, 0, 0, 0, 0, 0);
    const shift = (firstDay.getDay() + 6) % 7;
    const days = Number(lastDay.getDate() || 0);
    let html = `<div class="social-calendar-row head">${[
      pick("Пн", "Mon"),
      pick("Вт", "Tue"),
      pick("Ср", "Wed"),
      pick("Чт", "Thu"),
      pick("Пт", "Fri"),
      pick("Сб", "Sat"),
      pick("Вс", "Sun"),
    ].map((x) => `<span>${x}</span>`).join("")}</div><div class="social-calendar-cells">`;
    for (let i = 0; i < shift; i += 1) {
      html += `<button class="social-day muted" disabled></button>`;
    }
    for (let day = 1; day <= days; day += 1) {
      const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      html += `<button class="social-day rich" data-day-key="${key}" type="button" onclick="socialShowDay('${key}')"><div class="social-day-head"><b>${day}</b></div><div class="social-day-preview-stack"></div></button>`;
    }
    html += "</div>";
    grid.innerHTML = html;
    const monthLabel = document.getElementById("socialCalendarMonthLabel");
    if (monthLabel && typeof window.socialCalendarMonthLabel === "function") {
      monthLabel.textContent = String(window.socialCalendarMonthLabel(d) || "");
    }
  }

  function buildCalendarFallbackGridV2(root) {
    const host = root || document.getElementById("socialSubtabCalendar");
    if (!host) return;
    const shell = host.querySelector(".social-calendar-shell") || host;
    let grid = document.getElementById("socialCalendarGrid");
    if (!grid) {
      grid = document.createElement("div");
      grid.id = "socialCalendarGrid";
      grid.className = "social-calendar-grid social-calendar-grid--samsung";
      shell.appendChild(grid);
    } else if (grid.parentElement !== shell) {
      shell.appendChild(grid);
    }
    const d = calendarBaseDate();
    const year = d.getFullYear();
    const month = d.getMonth();
    const firstDay = new Date(year, month, 1, 0, 0, 0, 0);
    const lastDay = new Date(year, month + 1, 0, 0, 0, 0, 0);
    const shift = (firstDay.getDay() + 6) % 7;
    const days = Number(lastDay.getDate() || 0);
    let html = `<div class="social-calendar-row head">${[
      pick("\u041f\u043d", "Mon"),
      pick("\u0412\u0442", "Tue"),
      pick("\u0421\u0440", "Wed"),
      pick("\u0427\u0442", "Thu"),
      pick("\u041f\u0442", "Fri"),
      pick("\u0421\u0431", "Sat"),
      pick("\u0412\u0441", "Sun"),
    ].map((x) => `<span>${x}</span>`).join("")}</div><div class="social-calendar-cells">`;
    for (let i = 0; i < shift; i += 1) {
      html += `<button class="social-day muted" disabled></button>`;
    }
    for (let day = 1; day <= days; day += 1) {
      const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      html += `<button class="social-day rich" data-day-key="${key}" type="button" onclick="socialShowDay('${key}')"><div class="social-day-head"><b>${day}</b></div><div class="social-day-preview-stack"></div></button>`;
    }
    html += "</div>";
    grid.innerHTML = html;
    grid.style.setProperty("display", "block", "important");
    const head = grid.querySelector(".social-calendar-row.head");
    if (head) {
      head.style.setProperty("display", "grid", "important");
      head.style.setProperty("grid-template-columns", "repeat(7, minmax(0, 1fr))", "important");
    }
    const cells = grid.querySelector(".social-calendar-cells");
    if (cells) {
      cells.style.setProperty("display", "grid", "important");
      cells.style.setProperty("grid-template-columns", "repeat(7, minmax(0, 1fr))", "important");
    }
    const monthLabel = document.getElementById("socialCalendarMonthLabel");
    if (monthLabel && typeof window.socialCalendarMonthLabel === "function") {
      monthLabel.textContent = String(window.socialCalendarMonthLabel(d) || "");
    }
  }

  function installObserver() {
    if (!window.__enableTextMutationObserver) return;
    if (domObserver) return;
    const root = document.getElementById("appSection") || document.body;
    if (!root) return;
    domObserver = new MutationObserver((mutations) => {
      if (!Array.isArray(mutations) || !mutations.length) return;
      if (observerQueued) return;
      observerQueued = true;
      requestAnimationFrame(() => {
        observerQueued = false;
        mutations.forEach((mutation) => {
          if (mutation?.target) queueSanitize(mutation.target);
          if (mutation?.addedNodes?.length) {
            mutation.addedNodes.forEach((node) => queueSanitize(node));
          }
        });
      });
    });
    domObserver.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: TEXT_ATTRS,
    });
  }

  function applyKnownCopy() {
    const copy = [
      [".sidebar-toggle", "\u2630"],
      ["#mobileDrawerQuickNavLabel", pick("\u0420\u0430\u0437\u0434\u0435\u043b", "Section")],
      [".nav-btn[data-tab='sales']", pick("\u0421\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043a\u0430 \u0438 \u0434\u0430\u0448\u0431\u043e\u0440\u0434", "Dashboard")],
      [".nav-btn[data-tab='products']", pick("\u0422\u043e\u0432\u0430\u0440\u044b", "Products")],
      [".nav-btn[data-tab='reviews']", pick("\u041e\u0442\u0437\u044b\u0432\u044b/\u0412\u043e\u043f\u0440\u043e\u0441\u044b", "Reviews/Questions")],
      [".nav-btn[data-tab='accounting']", pick("\u0411\u0443\u0445\u0433\u0430\u043b\u0442\u0435\u0440\u0438\u044f", "Accounting")],
      [".nav-btn[data-tab='ads']", pick("\u0420\u0435\u043a\u043b\u0430\u043c\u0430 WB/Ozon", "Ads WB/Ozon")],
      [".nav-btn[data-tab='social']", pick("\u0421\u043e\u0446\u0438\u0430\u043b\u044c\u043d\u044b\u0439", "Social Hub")],
      [".nav-btn[data-tab='help']", pick("\u0421\u043f\u0440\u0430\u0432\u043a\u0430", "Help")],
      [".nav-btn[data-tab='profile']", pick("\u041f\u0440\u043e\u0444\u0438\u043b\u044c", "Profile")],
      [".btn-danger.full[onclick='logout()']", pick("\u0412\u044b\u0439\u0442\u0438", "Logout")],
      ["#socialSubtabChatBtn", pick("\u0427\u0430\u0442", "Chat")],
      ["#socialSubtabTasksBtn", pick("\u0417\u0430\u0434\u0430\u0447\u0438", "Tasks")],
      ["#socialSubtabCalendarBtn", pick("\u041a\u0430\u043b\u0435\u043d\u0434\u0430\u0440\u044c", "Calendar")],
      ["#socialSubtabNotesBtn", pick("\u0417\u0430\u043c\u0435\u0442\u043a\u0438", "Notes")],
      ["#socialSubtabCalculatorBtn", pick("\u041a\u0430\u043b\u044c\u043a\u0443\u043b\u044f\u0442\u043e\u0440", "Calculator")],
      ["#socialSubtabGamesBtn", pick("\u0418\u0433\u0440\u044b", "Games")],
      ["#socialModalTitle", pick("\u0421\u043e\u0446\u0438\u0430\u043b\u044c\u043d\u044b\u0439 \u043c\u043e\u0434\u0443\u043b\u044c", "Social module")],
      ["#socialSubtabChat h3", pick("\u0427\u0430\u0442\u044b", "Chats")],
      ["#socialSubtabChat .social-chat-sidebar-head small", pick("\u041b\u0438\u0447\u043d\u044b\u0435 \u0438 \u0433\u0440\u0443\u043f\u043f\u043e\u0432\u044b\u0435", "Personal and group")],
      ["#socialChatHead", pick("\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0447\u0430\u0442", "Choose chat")],
      ["#socialChatGroupBtn", pick("\u0423\u0447\u0430\u0441\u0442\u043d\u0438\u043a\u0438", "Members")],
      ["#socialChatAvatarBtn", pick("\u0410\u0432\u0430\u0442\u0430\u0440", "Avatar")],
      ["#socialChatSendFallback", pick("\u041e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c", "Send")],
      ["#socialSubtabTasks button[onclick='socialOpenProjectModal()']", pick("\u041d\u043e\u0432\u044b\u0439 \u043f\u0440\u043e\u0435\u043a\u0442", "New project")],
      ["#socialSubtabTasks button[onclick='socialOpenTaskModal()']", pick("\u041d\u043e\u0432\u0430\u044f \u0437\u0430\u0434\u0430\u0447\u0430", "New task")],
      ["#socialSubtabTasks .social-task-toolbar-side button[onclick='socialOpenProjectMembersModal()']", pick("\u0423\u0447\u0430\u0441\u0442\u043d\u0438\u043a\u0438 \u043f\u0440\u043e\u0435\u043a\u0442\u0430", "Project members")],
      ["#socialSubtabTasks .social-task-toolbar-side button[onclick='socialLoadTasks()']", pick("\u041e\u0431\u043d\u043e\u0432\u0438\u0442\u044c", "Refresh")],
      ["#socialSubtabNotes button[onclick='socialCreateNote()']", pick("\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u0437\u0430\u043f\u0438\u0441\u044c", "Create note")],
      ["button[onclick='socialCreateNote()']", pick("\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u0437\u0430\u043f\u0438\u0441\u044c", "Create note")],
      ["#mobileDrawerQuickNav option[value='social_games']", pick("\u0418\u0433\u0440\u044b", "Games")],
      ["#mobileDrawerQuickNav option[value='sales_dashboard']", pick("\u0421\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043a\u0430", "Dashboard")],
      ["#mobileDrawerQuickNav option[value='social_chat']", pick("\u0427\u0430\u0442\u044b", "Chats")],
      ["#mobileDrawerQuickNav option[value='social_tasks']", pick("\u0417\u0430\u0434\u0430\u0447\u0438", "Tasks")],
      ["#mobileDrawerQuickNav option[value='social_notes']", pick("\u0417\u0430\u043c\u0435\u0442\u043a\u0438", "Notes")],
      ["#mobileDrawerQuickNav option[value='social_calendar']", pick("\u041a\u0430\u043b\u0435\u043d\u0434\u0430\u0440\u044c", "Calendar")],
      ["#mobileDrawerQuickNav option[value='social_calculator']", pick("\u041a\u0430\u043b\u044c\u043a\u0443\u043b\u044f\u0442\u043e\u0440", "Calculator")],
      ["#mobileDrawerQuickNav option[value='reviews_reviews']", pick("\u041e\u0442\u0437\u044b\u0432\u044b", "Reviews")],
      ["#mobileDrawerQuickNav option[value='reviews_questions']", pick("\u0412\u043e\u043f\u0440\u043e\u0441\u044b", "Questions")],
      ["#mobileDrawerQuickNav option[value='reviews_returns']", pick("\u0412\u043e\u0437\u0432\u0440\u0430\u0442\u044b", "Returns")],
      ["#mobileDrawerQuickNav option[value='ads_campaigns']", pick("\u0420\u0435\u043a\u043b\u0430\u043c\u0430 WB", "Ads WB")],
      ["#mobileDrawerQuickNav option[value='ads_analytics']", pick("\u0410\u043d\u0430\u043b\u0438\u0442\u0438\u043a\u0430 \u0440\u0435\u043a\u043b\u0430\u043c\u044b", "Ad analytics")],
      ["#mobileDrawerQuickNav option[value='ads_recommendations']", pick("\u0420\u0435\u043a\u043e\u043c\u0435\u043d\u0434\u0430\u0446\u0438\u0438", "Recommendations")],
      ["#mobileDrawerQuickNav option[value='ads_bidder']", pick("\u0411\u0438\u0434\u0435\u0440 WB Ads", "WB Ads bidder")],
      ["#mobileDrawerQuickNav option[value='help_main']", pick("\u0421\u043f\u0440\u0430\u0432\u043a\u0430", "Help")],
      ["#mobileDrawerQuickNav option[value='profile_main']", pick("\u041f\u0440\u043e\u0444\u0438\u043b\u044c", "Profile")],
      ["#mobileQuickNav option[value='sales_dashboard']", pick("\u0421\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043a\u0430", "Dashboard")],
      ["#mobileQuickNav option[value='social_chat']", pick("\u0427\u0430\u0442\u044b", "Chats")],
      ["#mobileQuickNav option[value='social_tasks']", pick("\u0417\u0430\u0434\u0430\u0447\u0438", "Tasks")],
      ["#mobileQuickNav option[value='social_notes']", pick("\u0417\u0430\u043c\u0435\u0442\u043a\u0438", "Notes")],
      ["#mobileQuickNav option[value='social_calendar']", pick("\u041a\u0430\u043b\u0435\u043d\u0434\u0430\u0440\u044c", "Calendar")],
      ["#mobileQuickNav option[value='social_calculator']", pick("\u041a\u0430\u043b\u044c\u043a\u0443\u043b\u044f\u0442\u043e\u0440", "Calculator")],
    ];
    copy.forEach(([selector, value]) => {
      document.querySelectorAll(selector).forEach((node) => {
        node.textContent = value;
      });
    });

    const attrs = [
      [".sidebar-toggle", "title", pick("\u041c\u0435\u043d\u044e", "Menu")],
      [".sidebar-toggle", "aria-label", pick("\u041c\u0435\u043d\u044e", "Menu")],
      ["#socialBellBtn", "title", pick("\u0423\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f", "Notifications")],
      ["#socialBellBtn", "aria-label", pick("\u0423\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f", "Notifications")],
      ["#mobileDrawerBellBtn", "title", pick("\u0423\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f", "Notifications")],
      ["#mobileDrawerBellBtn", "aria-label", pick("\u0423\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f", "Notifications")],
      ["#mobileNavToggle", "title", pick("\u041c\u0435\u043d\u044e", "Menu")],
      ["#mobileNavToggle", "aria-label", pick("\u041c\u0435\u043d\u044e", "Menu")],
      ["#socialChatSearch", "placeholder", pick("\u041f\u043e\u0438\u0441\u043a", "Search")],
      ["#socialChatInput", "placeholder", pick("\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435...", "Type a message...")],
      ["#socialEmojiBtn", "title", pick("\u042d\u043c\u043e\u0434\u0437\u0438", "Emoji")],
      ["#socialAttachBtn", "title", pick("\u0424\u0430\u0439\u043b", "File")],
      ["#socialSendIconBtn", "title", pick("\u041e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c", "Send")],
      ["#socialSendIconBtn", "aria-label", pick("\u041e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c", "Send")],
      ["#socialChatHeadCollapseBtn", "title", pick("\u0421\u0432\u0435\u0440\u043d\u0443\u0442\u044c \u0448\u0430\u043f\u043a\u0443", "Collapse header")],
      ["#socialNoteTitle", "placeholder", pick("\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 \u0437\u0430\u043c\u0435\u0442\u043a\u0438", "Note title")],
      ["#socialNoteContent", "placeholder", pick("\u0422\u0435\u043a\u0441\u0442 \u0437\u0430\u043c\u0435\u0442\u043a\u0438...", "Note text...")],
    ];
    attrs.forEach(([selector, attr, value]) => {
      document.querySelectorAll(selector).forEach((node) => node.setAttribute(attr, value));
    });
    document.querySelectorAll(".bell-emoji").forEach((node) => { node.textContent = "\u{1F514}"; });
  }

  function normalizeCalendarUi() {
    try {
      if (typeof window.socialNormalizeCalendarChrome === "function") {
        window.socialNormalizeCalendarChrome();
      }
      if (typeof window.socialEnsureCalendarFab === "function") {
        window.socialEnsureCalendarFab();
      }
    } catch (_) {}
    const root = document.getElementById("socialSubtabCalendar");
    if (!root) return;
    if (!window.socialState || typeof window.socialState !== "object") {
      window.socialState = {};
    }
    if (!(window.socialState.calendarDate instanceof Date) || Number.isNaN(window.socialState.calendarDate.getTime())) {
      window.socialState.calendarDate = calendarBaseDate();
    }
    root.classList.add("sw-calendar-samsung");
    const shell = root.querySelector(".social-calendar-shell") || root;
    shell.querySelectorAll("button").forEach((btn) => {
      if (btn.id === "socialCalendarFab") return;
      if (btn.classList.contains("social-day")) return;
      if (btn.classList.contains("social-day-item-button")) return;
      btn.style.setProperty("display", "none", "important");
    });
    root.querySelectorAll("#socialCalendarGrid .social-day").forEach((btn) => {
      btn.style.setProperty("display", "grid", "important");
    });
    const grid = document.getElementById("socialCalendarGrid");
    if (grid) {
      grid.style.setProperty("display", "block", "important");
      const head = grid.querySelector(".social-calendar-row.head");
      if (head) {
        head.style.setProperty("display", "grid", "important");
        head.style.setProperty("grid-template-columns", "repeat(7, minmax(0, 1fr))", "important");
      }
      const cells = grid.querySelector(".social-calendar-cells");
      if (cells) {
        cells.style.setProperty("display", "grid", "important");
        cells.style.setProperty("grid-template-columns", "repeat(7, minmax(0, 1fr))", "important");
      }
    }
    const dayCount = root.querySelectorAll("#socialCalendarGrid .social-day[data-day-key]").length;
    if (dayCount > 0) return;
    buildCalendarFallbackGridV2(root);
    const now = Date.now();
    if (now - calendarRecoverAt < 1300) return;
    calendarRecoverAt = now;
    setTimeout(() => {
      try {
        if (typeof window.socialRenderCalendar === "function") {
          window.socialRenderCalendar();
        }
        const rebuilt = root.querySelectorAll("#socialCalendarGrid .social-day[data-day-key]").length;
        if (!rebuilt && typeof window.socialLoadCalendar === "function") {
          window.socialLoadCalendar();
        }
      } catch (_) {}
    }, 90);
    setTimeout(() => {
      const refreshed = root.querySelectorAll("#socialCalendarGrid .social-day[data-day-key]").length;
      if (!refreshed) buildCalendarFallbackGridV2(root);
    }, 260);
  }

  function normalizeNotificationCenter() {
    const center = document.getElementById("socialNotificationCenter");
    if (!center) return null;
    if (center.parentElement !== document.body) document.body.appendChild(center);
    const mobile = (window.innerWidth || 0) <= 980;
    center.classList.add("social-notif-center", "social-notification-center");
    center.style.setProperty("position", "fixed", "important");
    center.style.setProperty("z-index", "2147483000", "important");
    center.style.setProperty("bottom", "auto", "important");
    center.style.setProperty("transform", "none", "important");
    center.style.setProperty("visibility", "visible", "important");
    center.style.setProperty("pointer-events", "auto", "important");
    center.style.setProperty("overflow-y", "auto", "important");
    if (mobile) {
      center.style.setProperty("top", "84px", "important");
      center.style.setProperty("left", "8px", "important");
      center.style.setProperty("right", "8px", "important");
      center.style.setProperty("width", "auto", "important");
      center.style.setProperty("max-height", "calc(100vh - 96px)", "important");
    } else {
      center.style.setProperty("top", "72px", "important");
      center.style.setProperty("left", "auto", "important");
      center.style.setProperty("right", "12px", "important");
      center.style.setProperty("width", "min(420px, calc(100vw - 24px))", "important");
      center.style.setProperty("max-height", "calc(100vh - 84px)", "important");
    }
    return center;
  }

  function normalizeNotesGrid() {
    const host = document.getElementById("socialNotesList");
    if (!host) return;
    host.querySelectorAll(
      ".social-note-delete, [class*='note-delete'], [class*='note-remove'], [class*='note-close'], [data-action='delete'], button[onclick*='socialDeleteNote']"
    ).forEach((node) => node.remove?.());
    host.querySelectorAll(".social-note-row[data-note-id], .sw-note-card[data-note-id]").forEach((row) => {
      const noteId = Number(row.getAttribute("data-note-id") || 0);
      if (!noteId) return;
      row.style.cursor = "pointer";
      row.style.setProperty("width", "100%", "important");
      row.style.setProperty("max-width", "none", "important");
      row.style.setProperty("justify-self", "stretch", "important");
      row.style.setProperty("height", "148px", "important");
      row.style.setProperty("min-height", "148px", "important");
      row.style.setProperty("max-height", "148px", "important");
      const main = row.querySelector(".social-note-main");
      if (main) {
        main.style.setProperty("width", "100%", "important");
        main.style.setProperty("height", "100%", "important");
      }
      if (row.dataset.noteOpenBound !== "1") {
        row.dataset.noteOpenBound = "1";
        row.addEventListener("click", () => {
          if (typeof window.socialOpenNoteEditor === "function") {
            window.socialOpenNoteEditor(noteId);
            return;
          }
          if (typeof window.socialSelectNote === "function") window.socialSelectNote(noteId);
        });
      }
      try {
        if (typeof window.socialGetNoteCoverColor === "function") {
          const color = String(window.socialGetNoteCoverColor(noteId) || "").trim();
          if (color) row.style.setProperty("--sw-note-cover", color);
        }
      } catch (_) {}
    });
  }

  function normalizeTasksUi() {
    const host = document.getElementById("socialTasksBoard");
    if (!host) return;
    host.querySelectorAll(".social-task-check").forEach((btn) => {
      const done = btn.classList.contains("is-done");
      btn.textContent = done ? "\u2713" : "";
      btn.setAttribute("title", pick("\u041e\u0442\u043c\u0435\u0442\u0438\u0442\u044c \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043d\u043e\u0439", "Mark done"));
    });
    host.querySelectorAll(".social-task-delete").forEach((btn) => {
      btn.textContent = "\u2715";
      btn.setAttribute("title", pick("\u0423\u0434\u0430\u043b\u0438\u0442\u044c", "Delete"));
    });
    host.querySelectorAll(".social-task-pending").forEach((node) => {
      const before = String(node.textContent || "");
      if (!before || /[?]{3,}|[\u0420\u0421\u0412\u00d0\u00d1]/.test(before)) {
        node.textContent = pick("5\u0441: \u043f\u043e\u0432\u0442\u043e\u0440\u043d\u044b\u0439 \u043a\u043b\u0438\u043a \u043e\u0442\u043c\u0435\u043d\u0438\u0442", "5s: click again to undo");
      }
    });
  }

  function normalizeGamesUi() {
    const host = document.getElementById("socialGamesGrid");
    if (!host) return;
    const iconByCode = {
      snake: "\u{1F40D}",
      tetris: "\u{1F9E9}",
      "2048": "\u{1F522}",
      checkers: "\u26C0",
      chess: "\u265C",
      battleship: "\u2693",
    };
    const titleByCode = {
      snake: pick("\u0417\u043c\u0435\u0439\u043a\u0430", "Snake"),
      tetris: pick("\u0422\u0435\u0442\u0440\u0438\u0441", "Tetris"),
      "2048": "2048",
      checkers: pick("\u0428\u0430\u0448\u043a\u0438", "Checkers"),
      chess: pick("\u0428\u0430\u0445\u043c\u0430\u0442\u044b", "Chess"),
      battleship: pick("\u041c\u043e\u0440\u0441\u043a\u043e\u0439 \u0431\u043e\u0439", "Battleship"),
    };
    host.querySelectorAll(".social-game-card").forEach((card) => {
      const onclickRaw = String(card.getAttribute("onclick") || card.getAttribute("ondblclick") || "");
      const match = onclickRaw.match(/socialOpenGameMenu\('([^']+)'/i);
      const code = String(match?.[1] || "").trim().toLowerCase();
      const iconNode = card.querySelector(".social-game-icon");
      if (iconNode) iconNode.textContent = iconByCode[code] || "\u{1F3AE}";
      const titleNode = card.querySelector(".social-game-title");
      if (titleNode) {
        const cleanFallback = repairText(titleNode.textContent || "");
        titleNode.textContent = titleByCode[code] || cleanFallback || code;
      }
      const hintNode = card.querySelector("small");
      if (hintNode) hintNode.textContent = pick("\u041d\u0430\u0436\u043c\u0438\u0442\u0435 \u0434\u043b\u044f \u0432\u0445\u043e\u0434\u0430", "Tap to open");
    });
  }

  function bindBellButtons() {
    document.querySelectorAll("#socialBellBtn, #mobileDrawerBellBtn").forEach((btn) => {
      if (!btn || btn.dataset.textFixBellBound === "1") return;
      btn.dataset.textFixBellBound = "1";
      btn.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        try {
          if (typeof window.socialToggleNotificationCenter === "function") {
            await window.socialToggleNotificationCenter();
          }
          if (btn.id === "mobileDrawerBellBtn" && typeof window.closeMobileNav === "function") {
            window.closeMobileNav();
          }
        } catch (_) {}
      }, true);
    });
  }

  function bindBellDelegated() {
    if (!document.body?.dataset) return;
    if (document.body.dataset.textFixBellDelegated === "1") return;
    document.body.dataset.textFixBellDelegated = "1";
    document.addEventListener("click", async (event) => {
      const btn = event?.target?.closest?.("#socialBellBtn, #mobileDrawerBellBtn, .icon-bell-btn");
      if (!btn) return;
      event.preventDefault?.();
      event.stopPropagation?.();
      event.stopImmediatePropagation?.();
      try {
        if (typeof window.socialToggleNotificationCenter === "function") {
          await window.socialToggleNotificationCenter();
        }
        if (btn.id === "mobileDrawerBellBtn" && typeof window.closeMobileNav === "function") {
          window.closeMobileNav();
        }
      } catch (_) {}
    }, true);
  }

  function bindTaskTouchGuard() {
    if (document.body?.dataset?.taskTouchGuardBound === "1") return;
    if (!document.body?.dataset) return;
    document.body.dataset.taskTouchGuardBound = "1";
    const stopTouchDragInApp = (event) => {
      if (!isAppShellMode()) return;
      const target = event?.target?.closest?.(".social-task-item");
      if (!target) return;
      event.stopPropagation();
    };
    document.addEventListener("touchstart", stopTouchDragInApp, true);
    document.addEventListener("touchmove", stopTouchDragInApp, true);
    document.addEventListener("touchend", stopTouchDragInApp, true);
    document.addEventListener("touchcancel", stopTouchDragInApp, true);
  }

  function wrapFn(name, wrapper) {
    const original = window[name];
    if (typeof original !== "function") return;
    if (original.__textFixWrapped) return;
    const wrapped = wrapper(original);
    wrapped.__textFixWrapped = true;
    window[name] = wrapped;
  }

  function installWraps() {
    wrapFn("tr", (original) => function wrappedTr() {
      const result = original.apply(this, arguments);
      if (typeof result !== "string") return result;
      let safe = repairText(result);
      if (!isEn()) {
        const enFallback = String(arguments[1] || "").trim();
        if (enFallback) {
          const mostlyQuestionMarks = /^\s*[\?]{3,}\s*$/.test(safe) || (safe.includes("?") && !/[\u0400-\u04ff]/.test(safe));
          if (mostlyQuestionMarks || looksBroken(safe)) {
            safe = localizeEnglishFallback(enFallback);
          }
        }
      }
      return safe;
    });

    wrapFn("socialResolveNotificationText", (original) => function wrappedResolve(row) {
      const result = original.call(this, row) || {};
      return {
        ...result,
        title: repairText(result.title || ""),
        body: repairText(result.body || ""),
      };
    });

    wrapFn("socialDecodeUiText", (original) => function wrappedDecodeUiText() {
      const value = original.apply(this, arguments);
      return repairText(typeof value === "string" ? value : String(value || ""));
    });

    wrapFn("socialDecodeMaybeUtf8", (original) => function wrappedDecodeMaybeUtf8() {
      const value = original.apply(this, arguments);
      return repairText(typeof value === "string" ? value : String(value || ""));
    });

    wrapFn("socialRenderNotificationCenter", (original) => function wrappedRenderCenter() {
      const result = original.apply(this, arguments);
      const center = normalizeNotificationCenter();
      if (center) queueSanitize(center);
      return result;
    });

    wrapFn("socialToggleNotificationCenter", (original) => async function wrappedToggleCenter(forceOpen = null) {
      const result = await Promise.resolve(original.call(this, forceOpen));
      const center = normalizeNotificationCenter();
      if (center) {
        if (!window.socialState?.notificationCenterOpen) {
          center.classList.add("hidden");
          center.style.display = "none";
        }
        queueSanitize(center);
      }
      return result;
    });

    wrapFn("socialRenderCalendar", (original) => function wrappedRenderCalendar() {
      if (!window.socialState || typeof window.socialState !== "object") window.socialState = {};
      const currentDate = window.socialState.calendarDate;
      if (!(currentDate instanceof Date) || Number.isNaN(currentDate.getTime())) {
        window.socialState.calendarDate = calendarBaseDate();
      }
      let result = null;
      try {
        result = original.apply(this, arguments);
      } catch (_) {
        const root = document.getElementById("socialSubtabCalendar");
        if (root) buildCalendarFallbackGridV2(root);
      }
      normalizeCalendarUi();
      queueSanitize(document.getElementById("socialSubtabCalendar"));
      return result;
    });

    wrapFn("socialRenderNotesList", (original) => function wrappedRenderNotesList() {
      const result = original.apply(this, arguments);
      normalizeNotesGrid();
      queueSanitize(document.getElementById("socialSubtabNotes") || document.getElementById("socialNotesList"));
      return result;
    });

    wrapFn("socialLoadCalendar", (original) => async function wrappedLoadCalendar() {
      const result = await Promise.resolve(original.apply(this, arguments));
      normalizeCalendarUi();
      queueSanitize(document.getElementById("socialSubtabCalendar"));
      return result;
    });

    wrapFn("socialRenderThreads", (original) => function wrappedRenderThreads() {
      const result = original.apply(this, arguments);
      queueSanitize(document.getElementById("socialChatThreads"));
      return result;
    });

    wrapFn("socialRenderTasks", (original) => function wrappedRenderTasks() {
      const result = original.apply(this, arguments);
      normalizeTasksUi();
      queueSanitize(document.getElementById("socialSubtabTasks") || document.getElementById("socialTasksBoard"));
      return result;
    });

    wrapFn("socialRenderGames", (original) => function wrappedRenderGames() {
      const result = original.apply(this, arguments);
      normalizeGamesUi();
      queueSanitize(document.getElementById("socialSubtabGames") || document.getElementById("socialGamesGrid"));
      return result;
    });

    wrapFn("socialOpenGameMenu", (original) => async function wrappedOpenGameMenu() {
      const result = await Promise.resolve(original.apply(this, arguments));
      queueSanitize(document.getElementById("socialModal"));
      return result;
    });

    wrapFn("socialShowGameTips", (original) => function wrappedShowGameTips() {
      const result = original.apply(this, arguments);
      queueSanitize(document.getElementById("socialModal"));
      return result;
    });

    wrapFn("socialShowLeaderboard", (original) => async function wrappedShowLeaderboard() {
      const result = await Promise.resolve(original.apply(this, arguments));
      queueSanitize(document.getElementById("socialModal"));
      return result;
    });

    wrapFn("socialSetBell", (original) => function wrappedSetBell() {
      const result = original.apply(this, arguments);
      bindBellButtons();
      bindBellDelegated();
      return result;
    });
  }

  function init() {
    if (isAppShellMode()) {
      window.__socialDisableNotificationToasts = true;
    }
    installWraps();
    applyKnownCopy();
    bindBellButtons();
    bindBellDelegated();
    bindTaskTouchGuard();
    installObserver();
    normalizeCalendarUi();
    normalizeNotificationCenter();
    normalizeNotesGrid();
    normalizeTasksUi();
    normalizeGamesUi();
    const root = document.getElementById("appSection") || document.body;
    queueSanitize(root);
    setTimeout(() => queueSanitize(document.getElementById("socialSection") || root), 320);
    setTimeout(() => queueSanitize(document.getElementById("socialNotificationCenter") || root), 1200);
    window.addEventListener("resize", () => {
      normalizeNotificationCenter();
      queueSanitize(document.getElementById("socialNotificationCenter"));
    });
    document.body?.classList?.remove("text-fix-pending");
    document.body?.classList?.add("text-fix-ready");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
