(function () {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const isMobileRuntimeTarget = () => {
    try {
      const url = new URL(window.location.href);
      if (window.location.pathname === "/mobile" || url.searchParams.get("mobile_app") === "1") return true;
    } catch (_) {}

    const body = document.body;
    if (body?.classList?.contains("mobile-client-mode") || body?.classList?.contains("mobile-apk-mode")) return true;

    try {
      if (typeof window.ReactNativeWebView !== "undefined") return true;
      const ua = String(navigator.userAgent || "").toLowerCase();
      if (/\bwv\b/.test(ua) || ua.includes("android")) return true;
      if (typeof navigator.standalone !== "undefined" && navigator.standalone) return true;
      if (typeof window.matchMedia === "function" && window.matchMedia("(display-mode: standalone)").matches) return true;
    } catch (_) {}

    const viewportWidth = Math.max(window.innerWidth || 0, document.documentElement?.clientWidth || 0);
    const coarsePointer = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
    return coarsePointer && viewportWidth > 0 && viewportWidth <= 980;
  };

  if (!isMobileRuntimeTarget()) return;
  if (window.__seoWibeMobileRuntimeFix20260403) return;
  window.__seoWibeMobileRuntimeFix20260403 = true;

  const safeInvoke = (fn, ...args) => {
    try {
      if (typeof fn === "function") return fn(...args);
    } catch (_) {}
    return undefined;
  };

  let reapplyTimer = 0;

  const scheduleReapply = (delay = 80) => {
    if (reapplyTimer) {
      clearTimeout(reapplyTimer);
      reapplyTimer = 0;
    }
    reapplyTimer = window.setTimeout(() => {
      reapplyTimer = 0;
      try {
        reapply();
      } catch (_) {}
    }, Math.max(0, Number(delay) || 0));
  };

  const scheduleReapplyBurst = (...delays) => {
    delays.forEach((delay) => {
      window.setTimeout(() => {
        try {
          reapply();
        } catch (_) {}
      }, Math.max(0, Number(delay) || 0));
    });
  };

  const ensureState = () => {
    window.socialState = window.socialState && typeof window.socialState === "object" ? window.socialState : {};
    return window.socialState;
  };

  const restoreStableRuntime = () => {
    try {
      if (typeof window.__seoWibeRestoreStableSocialRuntimeV20260402 === "function") {
        window.__seoWibeRestoreStableSocialRuntimeV20260402();
      }
    } catch (_) {}
  };

  const decodeText = (value) => {
    let text = String(value == null ? "" : value);
    if (!text) return "";
    try {
      if (typeof window.socialDecodeUiText === "function") text = String(window.socialDecodeUiText(text) || text);
    } catch (_) {}
    try {
      if (typeof window.decodePossiblyMojibake === "function") text = String(window.decodePossiblyMojibake(text) || text);
    } catch (_) {}
    try {
      if (typeof window.__repairMojibakeText === "function") text = String(window.__repairMojibakeText(text) || text);
    } catch (_) {}
    return text.replace(/\s{2,}/g, " ").trim();
  };

  const looksBroken = (value) => {
    const text = decodeText(value);
    if (!text) return true;
    if (/^\d+$/.test(text)) return true;
    if (text.includes("\uFFFD")) return true;
    if (/[РÐ][^a-zA-Zа-яА-ЯёЁ0-9\s]/.test(text) && /[ЃЌЋ]/.test(text)) return true;
    return false;
  };

  const pickText = (...values) => {
    for (const value of values) {
      const text = decodeText(value);
      if (!text || looksBroken(text)) continue;
      return text;
    }
    return "";
  };

  const normalizeNotificationRows = (rows) => {
    if (!Array.isArray(rows)) return [];
    return rows.map((row) => {
      const safeRow = row && typeof row === "object" ? row : {};
      const payload = safeRow.payload && typeof safeRow.payload === "object" ? safeRow.payload : {};
      const kind = String(safeRow.kind || payload.kind || "").toLowerCase();
      const fallbackTitle = kind.includes("chat")
        ? "Новое сообщение"
        : kind.includes("task")
          ? "Задачи"
          : kind.includes("calendar") || kind.includes("event") || kind.includes("reminder")
            ? "Календарь"
            : "Уведомление";
      const title = pickText(
        safeRow.title,
        safeRow.kind_label,
        safeRow.entity_name,
        safeRow.thread_title,
        safeRow.thread_name,
        payload.title,
        payload.kind_label,
        payload.entity_name,
        payload.thread_title,
        payload.thread_name,
        payload.event_title,
        payload.task_title,
        payload.note_title,
        fallbackTitle
      ) || fallbackTitle;
      const body = pickText(
        safeRow.body,
        safeRow.text,
        safeRow.message,
        safeRow.preview,
        payload.body,
        payload.text,
        payload.message,
        payload.preview,
        payload.event_title,
        payload.task_title,
        payload.note_title,
        payload.thread_title,
        payload.thread_name,
        title
      ) || title;
      return { ...safeRow, title, body };
    });
  };

  const normalizeNotificationCenterDom = () => {
    const center = document.getElementById("socialNotificationCenter");
    if (!center) return;
    center.querySelectorAll(".social-notif-item b, .social-notif-item p, .social-notif-head strong, .social-notif-head-actions button").forEach((node) => {
      const text = decodeText(node.textContent || "");
      if (text) node.textContent = text;
    });
  };

  const patchNotifications = () => {
    const originalLoad = typeof window.socialLoadNotificationCenterRows === "function"
      ? window.socialLoadNotificationCenterRows
      : null;
    if (originalLoad && originalLoad.__mobileRuntimeFixWrapped !== true) {
      window.socialLoadNotificationCenterRows = async function socialLoadNotificationCenterRowsMobileRuntimeFix() {
        const rows = await Promise.resolve(originalLoad.apply(this, arguments)).catch(() => []);
        const normalized = normalizeNotificationRows(rows);
        ensureState().notificationRows = normalized;
        return normalized;
      };
      window.socialLoadNotificationCenterRows.__mobileRuntimeFixWrapped = true;
    }

    const originalRender = typeof window.socialRenderNotificationCenter === "function"
      ? window.socialRenderNotificationCenter
      : null;
    if (originalRender && originalRender.__mobileRuntimeFixWrapped !== true) {
      window.socialRenderNotificationCenter = function socialRenderNotificationCenterMobileRuntimeFix(rows) {
        const normalized = normalizeNotificationRows(
          Array.isArray(rows) ? rows : (Array.isArray(ensureState().notificationRows) ? ensureState().notificationRows : [])
        );
        const center = originalRender.call(this, normalized);
        setTimeout(normalizeNotificationCenterDom, 0);
        setTimeout(normalizeNotificationCenterDom, 100);
        return center;
      };
      window.socialRenderNotificationCenter.__mobileRuntimeFixWrapped = true;
    }

    const originalToggle = typeof window.socialToggleNotificationCenter === "function"
      ? window.socialToggleNotificationCenter
      : null;
    if (originalToggle && originalToggle.__mobileRuntimeFixWrapped !== true) {
      window.socialToggleNotificationCenter = async function socialToggleNotificationCenterMobileRuntimeFix(forceOpen = null) {
        const result = await Promise.resolve(originalToggle.call(this, forceOpen)).catch(() => false);
        setTimeout(normalizeNotificationCenterDom, 0);
        setTimeout(normalizeNotificationCenterDom, 100);
        return result;
      };
      window.socialToggleNotificationCenter.__mobileRuntimeFixWrapped = true;
    }
  };

  const monthValue = (date) => {
    const d = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };

  const hideLegacyCalendarPanels = () => {
    const root = document.getElementById("socialSubtabCalendar");
    if (!root) return;
    root.querySelectorAll(
      "#socialCalendarEvents, #socialCalendarEventsLegacy, .social-calendar-events, .social-calendar-selected, .social-calendar-selected-day, .social-calendar-day-header, .social-calendar-day-details, .social-calendar-day-list, .social-calendar-records, .social-calendar-summary, [data-calendar-detail], [data-selected-day]"
    ).forEach((node) => {
      node.classList.add("hidden");
      node.style.setProperty("display", "none", "important");
      node.style.setProperty("visibility", "hidden", "important");
      node.style.setProperty("pointer-events", "none", "important");
    });
  };

  const ensureCalendarChrome = () => {
    const root = document.getElementById("socialSubtabCalendar");
    if (!root) return;
    const label = document.getElementById("socialCalendarMonthLabel");
    const monthInput = document.getElementById("socialCalendarMonth");
    const state = ensureState();

    if (label) {
      label.style.setProperty("display", "block", "important");
      label.style.setProperty("width", "100%", "important");
      label.style.setProperty("text-align", "center", "important");
      label.style.setProperty("margin", "0 auto", "important");
      label.style.setProperty("justify-self", "center", "important");
      label.style.setProperty("cursor", "pointer", "important");
      try { label.removeAttribute("title"); } catch (_) {}
      if (state.calendarDate instanceof Date && !Number.isNaN(state.calendarDate.getTime()) && typeof window.socialCalendarMonthLabel === "function") {
        label.textContent = String(window.socialCalendarMonthLabel(state.calendarDate) || label.textContent || "");
      }
      if (label.dataset.mobileRuntimeMonthBound !== "1") {
        label.dataset.mobileRuntimeMonthBound = "1";
        label.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          safeInvoke(window.socialOpenCalendarMonthYearPicker);
        });
      }
    }

    if (monthInput) {
      if (state.calendarDate instanceof Date && !Number.isNaN(state.calendarDate.getTime())) {
        monthInput.value = monthValue(state.calendarDate);
      }
      monthInput.classList.add("hidden");
      monthInput.style.setProperty("display", "none", "important");
      monthInput.style.setProperty("visibility", "hidden", "important");
      monthInput.style.setProperty("pointer-events", "none", "important");
    }

    root.querySelectorAll("#socialCalendarMonthSelect, #socialCalendarYearSelect, .social-calendar-picker").forEach((node) => {
      node.classList.add("hidden");
      node.style.setProperty("display", "none", "important");
      node.style.setProperty("visibility", "hidden", "important");
      node.style.setProperty("pointer-events", "none", "important");
    });
  };

  const recoverCalendarGrid = () => {
    const root = document.getElementById("socialSubtabCalendar");
    const grid = document.getElementById("socialCalendarGrid");
    if (!root || !grid) return;
    root.classList.remove("sw-calendar-awaiting-data");
    grid.style.setProperty("display", "block", "important");
    grid.style.setProperty("visibility", "visible", "important");
    grid.style.setProperty("opacity", "1", "important");
    grid.style.setProperty("touch-action", "pan-y", "important");
    hideLegacyCalendarPanels();
  };

  const repairEmptyCalendarGrid = () => {
    const root = document.getElementById("socialSubtabCalendar");
    const grid = document.getElementById("socialCalendarGrid");
    const state = ensureState();
    if (!root || !grid) return;
    if (String(state.currentSubtab || "").trim().toLowerCase() !== "calendar") return;
    if (state.calendarMonthPickerOpen || state.calendarDaySheetOpen) return;
    const dayCount = grid.querySelectorAll(".social-day[data-day-key]").length;
    if (dayCount > 0) return;
    const now = Date.now();
    if (now - Number(state.mobileCalendarRepairStamp || 0) < 600) return;
    state.mobileCalendarRepairStamp = now;
    const stable = window.__seoWibeStableSocialRuntimeV20260402 || {};
    if (typeof stable.loadCalendar === "function") {
      Promise.resolve(stable.loadCalendar.call(window))
        .catch(() => null)
        .finally(() => {
          setTimeout(recoverCalendarGrid, 0);
          setTimeout(recoverCalendarGrid, 120);
        });
      return;
    }
    if (typeof stable.renderCalendar === "function") {
      safeInvoke(stable.renderCalendar.bind(window));
      setTimeout(recoverCalendarGrid, 0);
      setTimeout(recoverCalendarGrid, 120);
    }
  };

  const refreshCalendarRuntime = () => {
    ensureCalendarChrome();
    recoverCalendarGrid();
    try {
      if (typeof window.socialBindCalendarSwipe === "function") {
        window.socialBindCalendarSwipe();
      }
    } catch (_) {}
    setTimeout(repairEmptyCalendarGrid, 0);
    setTimeout(repairEmptyCalendarGrid, 180);
  };

  const wrapCalendar = () => {
    ["socialRenderCalendar", "socialLoadCalendar", "socialShiftCalendar", "socialCloseCalendarMonthYearPicker", "socialApplyCalendarMonthYearPicker"].forEach((name) => {
      const original = typeof window[name] === "function" ? window[name] : null;
      if (!original || original.__mobileRuntimeFixWrapped !== true) {
        if (!original) return;
        window[name] = function wrappedMobileRuntimeCalendar() {
          const result = original.apply(this, arguments);
          Promise.resolve(result).finally(() => {
            setTimeout(refreshCalendarRuntime, 0);
            setTimeout(refreshCalendarRuntime, 120);
          });
          return result;
        };
        window[name].__mobileRuntimeFixWrapped = true;
      }
    });
  };

  const bindBellCapture = () => {
    if (window.__seoWibeMobileRuntimeBellCaptureBound) return;
    window.__seoWibeMobileRuntimeBellCaptureBound = true;
    let lastBellAt = 0;
    const handler = async (event) => {
      const bellBtn = event.target?.closest?.("#socialBellBtn, #mobileDrawerBellBtn");
      if (!bellBtn) return;
      const now = Date.now();
      if (now - lastBellAt < 220) return;
      lastBellAt = now;
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
      restoreStableRuntime();
      patchNotifications();
      if (bellBtn.id === "mobileDrawerBellBtn" && typeof window.closeMobileNav === "function") {
        try { window.closeMobileNav(); } catch (_) {}
      }
      await Promise.resolve(window.socialToggleNotificationCenter()).catch(() => false);
      setTimeout(normalizeNotificationCenterDom, 0);
      setTimeout(normalizeNotificationCenterDom, 100);
    };
    window.addEventListener("touchend", handler, { capture: true, passive: false });
    window.addEventListener("click", handler, { capture: true, passive: false });
  };

  const bindCalendarSwipeCapture = () => {
    if (window.__seoWibeMobileRuntimeCalendarSwipeBound) return;
    window.__seoWibeMobileRuntimeCalendarSwipeBound = true;
    const swipe = {
      active: false,
      startedInCalendar: false,
      x: 0,
      y: 0,
      moved: false,
      handled: false,
      lastAt: 0,
    };
    const canHandle = (target) => {
      const state = ensureState();
      if (String(state.currentSubtab || "").trim().toLowerCase() !== "calendar") return false;
      if (state.calendarMonthPickerOpen || state.calendarDaySheetOpen) return false;
      if (document.getElementById("socialModal") && !document.getElementById("socialModal").classList.contains("hidden")) return false;
      return Boolean(target?.closest?.("#socialCalendarGrid, #socialSubtabCalendar"));
    };
    const trigger = (dx) => {
      const now = Date.now();
      if (now - swipe.lastAt < 260) return;
      swipe.lastAt = now;
      const stable = window.__seoWibeStableSocialRuntimeV20260402 || {};
      const shift = typeof stable.shiftCalendar === "function"
        ? stable.shiftCalendar.bind(window)
        : (typeof window.socialShiftCalendar === "function" ? window.socialShiftCalendar.bind(window) : null);
      if (!shift) return;
      shift(dx > 0 ? -1 : 1);
      setTimeout(refreshCalendarRuntime, 0);
      setTimeout(refreshCalendarRuntime, 180);
    };
    window.addEventListener("touchstart", (event) => {
      const touch = event.touches?.[0] || event.changedTouches?.[0];
      swipe.active = Boolean(touch);
      swipe.startedInCalendar = canHandle(event.target);
      swipe.moved = false;
      swipe.handled = false;
      if (!touch || !swipe.startedInCalendar) return;
      swipe.x = Number(touch.clientX || 0);
      swipe.y = Number(touch.clientY || 0);
    }, { capture: true, passive: true });
    window.addEventListener("touchmove", (event) => {
      if (!swipe.active || !swipe.startedInCalendar || swipe.handled) return;
      const touch = event.changedTouches?.[0];
      if (!touch) return;
      const dx = Number(touch.clientX || 0) - swipe.x;
      const dy = Number(touch.clientY || 0) - swipe.y;
      if (Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy)) {
        swipe.moved = true;
        event.preventDefault();
      }
    }, { capture: true, passive: false });
    window.addEventListener("touchend", (event) => {
      if (!swipe.active || !swipe.startedInCalendar || swipe.handled) {
        swipe.active = false;
        return;
      }
      const touch = event.changedTouches?.[0];
      swipe.active = false;
      if (!touch) return;
      const dx = Number(touch.clientX || 0) - swipe.x;
      const dy = Number(touch.clientY || 0) - swipe.y;
      if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
      swipe.handled = true;
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
      trigger(dx);
    }, { capture: true, passive: false });
    window.addEventListener("touchcancel", () => {
      swipe.active = false;
      swipe.startedInCalendar = false;
      swipe.moved = false;
      swipe.handled = false;
    }, { capture: true, passive: true });
  };

  const reapply = () => {
    restoreStableRuntime();
    patchNotifications();
    wrapCalendar();
    refreshCalendarRuntime();
  };

  restoreStableRuntime();
  patchNotifications();
  wrapCalendar();
  bindBellCapture();
  bindCalendarSwipeCapture();
  refreshCalendarRuntime();
  window.addEventListener("seo-wibe-auth", () => {
    scheduleReapplyBurst(0, 220);
  });
  window.addEventListener("resize", () => {
    scheduleReapply(140);
  }, { passive: true });
  window.addEventListener("orientationchange", () => {
    scheduleReapply(180);
  }, { passive: true });
  document.addEventListener("click", (event) => {
    const monthLabel = event.target?.closest?.("#socialCalendarMonthLabel");
    if (monthLabel) {
      scheduleReapply(0);
      return;
    }
    const calendarNav = event.target?.closest?.("[onclick*='socialShiftCalendar'], [onclick*='socialApplyCalendarMonthYearPicker'], [onclick*='socialCloseCalendarMonthYearPicker']");
    if (calendarNav) {
      scheduleReapplyBurst(0, 160);
    }
  }, true);
  scheduleReapplyBurst(150, 620);
})();
