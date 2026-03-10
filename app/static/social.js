let socialState = {
  boot: null,
  currentSubtab: "chat",
  gamesLeaderboardCache: new Map(),
  currentGameCode: "",
  activeGameRunner: null,
  chatThreads: [],
  chatActors: [],
  currentThreadId: 0,
  chatLastThreadId: 0,
  currentThreadKind: "",
  chatMessages: [],
  chatOldestId: 0,
  chatHasMore: true,
  chatRefreshTimer: null,
  chatSearch: "",
  chatThreadsSignature: "",
  chatHeaderSignature: "",
  chatMessagesSignatureByThread: {},
  chatMessagesInflightByThread: {},
  chatMessagesRequestSeqByThread: {},
  chatManualClosedUntil: 0,
  loadingMessagesThreadId: 0,
  actors: [],
  projects: [],
  tasks: [],
  calendarEvents: [],
  calendarDate: new Date(),
  calendarSelectedDay: "",
  notes: [],
  currentNoteId: 0,
  noteSaveTimer: null,
  notificationsTimer: null,
  announcementsTimer: null,
  lastNotificationId: 0,
  unreadCount: 0,
  markReadInFlight: false,
  notificationSettings: null,
  announcementModalId: 0,
  pendingAnnouncementIds: new Set(),
  participantProfileCache: new Map(),
  userInteracted: false,
  lastSoundAtByKind: {},
  moduleLoaded: false,
  toastsSeen: new Set(),
  currencyRates: null,
  currencyRatesStamp: 0,
  currencyRatesTimer: null,
  currencyRatesLoading: false,
  googleCalendarOauth: null,
  sendingMessage: false,
  chatReplyTo: null,
  chatContextMessageId: 0,
  chatContextThreadId: 0,
  chatContextX: 0,
  chatContextY: 0,
  keepEmojiOpenUntil: 0,
  mobileThreadAutoSelectEnabled: true,
  pollClientId: `poll-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
  fileUploadInFlight: false,
  notificationsPollInFlight: false,
  pendingAnnouncementsInFlight: false,
  globalHooksStarted: false,
};
if (typeof window !== "undefined") {
  window.socialState = socialState;
}

const SOCIAL_POLL_LEADER_KEY = "seo_wibe_social_poll_leader_v1";
const SOCIAL_POLL_SHARED_STATE_KEY = "seo_wibe_social_poll_shared_v1";
const SOCIAL_POLL_LEASE_MS = 22000;
const SOCIAL_UPLOAD_DEDUPE_TTL_MS = 120000;
const SOCIAL_UPLOAD_REQUEST_CACHE = new Map();

function socialIsMobileClientShell() {
  try {
    if (document.body?.classList?.contains("mobile-client-mode")) return true;
    if (typeof mobileClientMode !== "undefined") return Boolean(mobileClientMode);
  } catch (_) {}
  return false;
}

function socialIsMobileApkShell() {
  try {
    if (document.body?.classList?.contains("mobile-apk-mode")) return true;
    if (typeof mobileApkMode !== "undefined") return Boolean(mobileApkMode);
  } catch (_) {}
  return false;
}

function socialBuildFileUploadFingerprint(file, threadId, text, replyId) {
  const safeName = String(file?.name || "").trim().toLowerCase();
  const safeSize = Number(file?.size || 0);
  const safeMtime = Number(file?.lastModified || 0);
  const textPart = String(text || "").trim().slice(0, 220).replace(/\s+/g, " ");
  return `${Number(threadId || 0)}|${Number(replyId || 0)}|${safeName}|${safeSize}|${safeMtime}|${textPart}`;
}

function socialGetUploadRequestId(fingerprint) {
  const key = String(fingerprint || "").trim();
  if (!key) {
    return `chat-file-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
  }
  const nowTs = Date.now();
  for (const [k, meta] of SOCIAL_UPLOAD_REQUEST_CACHE.entries()) {
    const expiresAt = Number(meta?.expiresAt || 0);
    if (!expiresAt || expiresAt <= nowTs) {
      SOCIAL_UPLOAD_REQUEST_CACHE.delete(k);
    }
  }
  const cached = SOCIAL_UPLOAD_REQUEST_CACHE.get(key);
  if (cached && Number(cached.expiresAt || 0) > nowTs && String(cached.requestId || "").trim()) {
    return String(cached.requestId).trim();
  }
  const requestId = `chat-file-${nowTs}-${Math.random().toString(16).slice(2, 10)}`;
  SOCIAL_UPLOAD_REQUEST_CACHE.set(key, { requestId, expiresAt: nowTs + SOCIAL_UPLOAD_DEDUPE_TTL_MS });
  return requestId;
}

function socialMaybeStartHooks() {
  if (!token && !me) return;
  if (window.__socialHooksRequested) {
    try { socialStartGlobalHooks(); } catch (_) {}
  }
}

function socialRequest(url, opts = {}) {
  const method = String(opts.method || "GET").trim().toUpperCase() || "GET";
  const safeOpts = { ...opts };
  if (method === "POST" && safeOpts.retryOnPost === undefined) {
    safeOpts.retryOnPost = true;
  }
  if (safeOpts.maxRetries === undefined && (method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE")) {
    safeOpts.maxRetries = 2;
  }
  if (safeOpts.timeoutMs === undefined && (method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE")) {
    safeOpts.timeoutMs = 60000;
  }
  const headers = {
    ...(safeOpts.headers || {}),
    ...authHeaders(),
  };
  if (safeOpts.body instanceof FormData) {
    delete headers["Content-Type"];
    delete headers["content-type"];
  }
  return requestJson(url, {
    ...safeOpts,
    headers,
  });
}

function socialParseDateSafe(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const rawNorm = raw.replace(" ", "T");
  const hasExplicitTz = /(Z|[+\-]\d{2}:?\d{2})$/i.test(rawNorm);
  const looksDateTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(rawNorm);
  if (hasExplicitTz || !looksDateTime) {
    const firstTry = new Date(raw);
    if (!Number.isNaN(firstTry.getTime())) return firstTry;
  }
  let normalized = raw.replace(" ", "T");
  const tzMatch = normalized.match(/(Z|[+\-]\d{2}:?\d{2})$/i);
  let tzPart = "";
  if (tzMatch) {
    tzPart = tzMatch[1];
    normalized = normalized.slice(0, -tzPart.length);
  }
  normalized = normalized.replace(/\.(\d{1,9})/, (_, frac) => `.${String(frac).slice(0, 3).padEnd(3, "0")}`);
  if (!tzPart) {
    tzPart = "Z";
  } else if (/^[+\-]\d{4}$/.test(tzPart)) {
    tzPart = `${tzPart.slice(0, 3)}:${tzPart.slice(3)}`;
  }
  const secondTry = new Date(`${normalized}${tzPart}`);
  if (!Number.isNaN(secondTry.getTime())) return secondTry;
  return null;
}

function socialShowToast(title, body) {
  const host = document.getElementById("socialToastHost");
  if (!host) return;
  const item = document.createElement("div");
  item.className = "social-toast";
  item.innerHTML = `<strong>${escapeHtml(String(title || ""))}</strong><div>${escapeHtml(String(body || ""))}</div>`;
  host.appendChild(item);
  setTimeout(() => item.classList.add("show"), 20);
  setTimeout(() => {
    item.classList.remove("show");
    setTimeout(() => item.remove(), 260);
  }, 2600);
}

function socialNotificationKindGroup(kind) {
  const code = String(kind || "").trim().toLowerCase();
  if (code.startsWith("chat_")) return "chat";
  if (code.startsWith("task_")) return "task";
  if (code.startsWith("calendar_")) return "calendar";
  if (code.startsWith("announcement")) return "default";
  return "default";
}

function socialNotificationSoundUrl(kindGroup) {
  const cfg = socialState.notificationSettings || {};
  const code = String(kindGroup || "default");
  if (code === "chat") return String(cfg.chat_sound_url || cfg.default_sound_url || "").trim();
  if (code === "task") return String(cfg.task_sound_url || cfg.default_sound_url || "").trim();
  if (code === "calendar") return String(cfg.calendar_sound_url || cfg.default_sound_url || "").trim();
  return String(cfg.default_sound_url || "").trim();
}

function socialPlayFallbackBeep(kindGroup = "default") {
  if (!socialState.userInteracted) return;
  const key = String(kindGroup || "default");
  const now = Date.now();
  const last = Number(socialState.lastSoundAtByKind[key] || 0);
  if (now - last < 450) return;
  socialState.lastSoundAtByKind[key] = now;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  try {
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.value = key === "chat" ? 880 : (key === "task" ? 740 : 660);
    const t0 = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.16, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
    osc.start(t0);
    osc.stop(t0 + 0.23);
    setTimeout(() => {
      try { ctx.close(); } catch (_) {}
    }, 300);
  } catch (_) {}
}

function socialPlayNotificationSound(kindGroup = "default") {
  const cfg = socialState.notificationSettings || {};
  if (cfg.desktop_enabled === false) return;
  if (kindGroup === "chat" && cfg.chat_enabled === false) return;
  if (kindGroup === "task" && cfg.task_enabled === false) return;
  if (kindGroup === "calendar" && cfg.calendar_enabled === false) return;
  const soundUrl = socialNotificationSoundUrl(kindGroup);
  if (!soundUrl) {
    socialPlayFallbackBeep(kindGroup);
    return;
  }
  if (!socialState.userInteracted) return;
  const key = String(kindGroup || "default");
  const now = Date.now();
  const last = Number(socialState.lastSoundAtByKind[key] || 0);
  if (now - last < 450) return;
  socialState.lastSoundAtByKind[key] = now;
  try {
    const audio = new Audio(soundUrl);
    audio.preload = "auto";
    audio.volume = 0.9;
    audio.play().catch(() => socialPlayFallbackBeep(kindGroup));
  } catch (_) {
    socialPlayFallbackBeep(kindGroup);
  }
}

function socialCanDesktopNotify() {
  return typeof Notification !== "undefined" && Notification.permission === "granted";
}

function socialRequestDesktopPermission() {
  if (typeof Notification === "undefined") return;
  if (!socialState.userInteracted) return;
  if (Notification.permission !== "default") return;
  Notification.requestPermission().catch(() => null);
}

function socialOpenNotificationTarget(row) {
  if (!row || typeof row !== "object") return;
  const kind = String(row.kind || "").trim().toLowerCase();
  const payload = row.payload && typeof row.payload === "object" ? row.payload : {};
  if (kind === "chat_message" || kind === "chat_reaction") {
    if (typeof openSocialChatFromBell === "function") openSocialChatFromBell();
    const threadId = Number(payload.thread_id || 0);
    if (threadId && typeof socialSelectThread === "function") {
      setTimeout(() => socialSelectThread(threadId), 180);
    }
    return;
  }
  if (kind === "task_reminder") {
    currentSocialSubtab = "tasks";
    const socialBtn = document.querySelector(".nav-btn[data-tab='social']");
    if (typeof showTab === "function") showTab("social", socialBtn || null);
    setTimeout(() => {
      if (typeof switchSocialSubtab === "function") switchSocialSubtab("tasks", true);
    }, 140);
    return;
  }
  if (kind === "calendar_reminder") {
    currentSocialSubtab = "calendar";
    const socialBtn = document.querySelector(".nav-btn[data-tab='social']");
    if (typeof showTab === "function") showTab("social", socialBtn || null);
    setTimeout(() => {
      if (typeof switchSocialSubtab === "function") switchSocialSubtab("calendar", true);
    }, 140);
    return;
  }
  if (kind === "announcement") {
    socialOpenAnnouncementModal({
      id: Number(payload.announcement_id || 0),
      title: row.title || tr("Объявление", "Announcement"),
      body: row.body || "",
    });
  }
}

async function socialMarkNotificationsReadAll(syncLocal = true) {
  if (socialState.markReadInFlight) return;
  socialState.markReadInFlight = true;
  if (syncLocal) {
    socialState.unreadCount = 0;
    socialSetBell(0);
    socialWriteSharedPollState({
      unread: 0,
      last_notification_id: Number(socialState.lastNotificationId || 0),
      stamp: socialNowMs(),
    });
  }
  try {
    await socialRequest("/api/social/notifications/read-all", {
      method: "POST",
      body: JSON.stringify({}),
      timeoutMs: 12000,
    });
  } catch (_) {
  } finally {
    socialState.markReadInFlight = false;
  }
}

function socialOpenAnnouncementModal(row) {
  if (!row || typeof row !== "object") return;
  const annId = Number(row.id || 0);
  if (!annId || socialState.announcementModalId === annId) return;
  socialState.announcementModalId = annId;
  const title = String(row.title || tr("Объявление", "Announcement")).trim();
  const body = String(row.body || "").trim();
  socialOpenModal(
    title || tr("Объявление", "Announcement"),
    `
      <div class="social-announcement-modal">
        <div class="social-announcement-body">${escapeHtml(body || tr("Нет текста объявления.", "Announcement text is empty."))}</div>
        <div class="actions">
          <button type="button" class="btn-primary" id="socialAnnouncementAckBtn">${escapeHtml(tr("ОК", "OK"))}</button>
        </div>
      </div>
    `
  );
  const ackBtn = document.getElementById("socialAnnouncementAckBtn");
  if (ackBtn) {
    ackBtn.addEventListener("click", async () => {
      if (annId > 0) {
        await socialRequest(`/api/social/announcements/${annId}/ack`, {
          method: "POST",
          body: JSON.stringify({}),
          timeoutMs: 12000,
        }).catch(() => null);
      }
      socialState.announcementModalId = 0;
      socialCloseModal();
      socialMarkNotificationsReadAll(true);
      socialLoadPendingAnnouncements().catch(() => null);
    });
  }
}

async function socialLoadPendingAnnouncements() {
  if (socialState.pendingAnnouncementsInFlight) return;
  socialState.pendingAnnouncementsInFlight = true;
  const data = await socialRequest("/api/social/announcements/pending?limit=5", {
    timeoutMs: 12000,
  }).catch(() => null);
  try {
    const rows = Array.isArray(data?.rows) ? data.rows : [];
    if (!rows.length) return;
    for (const row of rows) {
      const annId = Number(row?.id || 0);
      if (!annId || socialState.pendingAnnouncementIds.has(annId)) continue;
      socialState.pendingAnnouncementIds.add(annId);
      socialOpenAnnouncementModal(row);
      break;
    }
  } finally {
    socialState.pendingAnnouncementsInFlight = false;
  }
}

function socialNotifyDesktop(row) {
  const cfg = socialState.notificationSettings || {};
  if (cfg.desktop_enabled === false) return;
  if (!socialCanDesktopNotify()) return;
  const kindGroup = socialNotificationKindGroup(row.kind || "");
  if (kindGroup === "chat" && cfg.chat_enabled === false) return;
  if (kindGroup === "task" && cfg.task_enabled === false) return;
  if (kindGroup === "calendar" && cfg.calendar_enabled === false) return;
  const title = String(row.title || tr("Уведомление", "Notification")).trim();
  const body = String(row.body || "").trim();
  if (!title && !body) return;
  try {
    const n = new Notification(title || tr("Уведомление", "Notification"), {
      body,
      tag: `social-${String(row.kind || "event")}-${Number(row.id || 0) || Date.now()}`,
      renotify: true,
    });
    n.onclick = () => {
      try { window.focus(); } catch (_) {}
      socialOpenNotificationTarget(row);
      try { n.close(); } catch (_) {}
    };
  } catch (_) {}
}

async function socialLoadNotificationSettings(force = false) {
  if (!force && socialState.notificationSettings) return socialState.notificationSettings;
  const data = await socialRequest("/api/social/notification-settings").catch(() => null);
  if (!data || typeof data !== "object") return socialState.notificationSettings;
  socialState.notificationSettings = data;
  return data;
}

function socialSetBell(unread) {
  const topBtn = document.getElementById("socialBellBtn");
  const topBadge = document.getElementById("socialBellBadge");
  const drawerBtn = document.getElementById("mobileDrawerBellBtn");
  const drawerBadge = document.getElementById("mobileDrawerBellBadge");
  const buttons = [topBtn, drawerBtn].filter(Boolean);
  const badges = [topBadge, drawerBadge].filter(Boolean);
  if (!buttons.length || !badges.length) return;
  const canUse = !modulesLoaded || (enabledModules instanceof Set && enabledModules.has("social_hub"));
  buttons.forEach((btn) => btn.classList.toggle("hidden", !canUse));
  if (!canUse) return;
  const value = Math.max(0, Number(unread || 0));
  badges.forEach((badge) => {
    badge.classList.toggle("hidden", value <= 0);
    badge.textContent = value > 99 ? "99+" : String(value);
  });
}

function socialNowMs() {
  return Date.now();
}

function socialReadPollLeader() {
  try {
    const raw = localStorage.getItem(SOCIAL_POLL_LEADER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const holder = String(parsed.holder || "").trim();
    const expiresAt = Number(parsed.expires_at || 0);
    if (!holder || !Number.isFinite(expiresAt) || expiresAt <= 0) return null;
    return { holder, expiresAt };
  } catch (_) {
    return null;
  }
}

function socialWritePollLeader(holder, expiresAt) {
  try {
    localStorage.setItem(
      SOCIAL_POLL_LEADER_KEY,
      JSON.stringify({ holder: String(holder || ""), expires_at: Number(expiresAt || 0) })
    );
  } catch (_) {}
}

function socialTryAcquirePollLeader() {
  const now = socialNowMs();
  const mine = String(socialState.pollClientId || "").trim();
  if (!mine) return false;
  const current = socialReadPollLeader();
  if (!current || current.expiresAt <= now || current.holder === mine) {
    socialWritePollLeader(mine, now + SOCIAL_POLL_LEASE_MS);
    return true;
  }
  return false;
}

function socialReadSharedPollState() {
  try {
    const raw = localStorage.getItem(SOCIAL_POLL_SHARED_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch (_) {
    return null;
  }
}

function socialWriteSharedPollState(payload) {
  try {
    localStorage.setItem(SOCIAL_POLL_SHARED_STATE_KEY, JSON.stringify(payload || {}));
  } catch (_) {}
}

function socialApplySharedPollState() {
  const shared = socialReadSharedPollState();
  if (!shared) return;
  const unread = Number(shared.unread || 0);
  const lastId = Number(shared.last_notification_id || 0);
  if (Number.isFinite(unread) && unread >= 0) {
    socialState.unreadCount = unread;
    socialSetBell(unread);
  }
  if (Number.isFinite(lastId) && lastId > socialState.lastNotificationId) {
    socialState.lastNotificationId = lastId;
  }
}

async function socialPollNotifications() {
  if (socialState.notificationsPollInFlight) return;
  socialState.notificationsPollInFlight = true;
  try {
    if (!token && !me) return;
    if (modulesLoaded && (!(enabledModules instanceof Set) || !enabledModules.has("social_hub"))) {
      socialSetBell(0);
      return;
    }
    const isLeader = socialTryAcquirePollLeader();
    if (!isLeader) {
      socialApplySharedPollState();
      return;
    }
    const data = await socialRequest(`/api/social/notifications?since_id=${socialState.lastNotificationId}&limit=60`).catch(() => null);
    if (!data || typeof data !== "object") return;
    socialState.unreadCount = Number(data.unread || 0);
    socialSetBell(socialState.unreadCount);
    const rows = Array.isArray(data.rows) ? data.rows : [];
    for (const row of rows) {
      const id = Number(row.id || 0);
      if (id > socialState.lastNotificationId) socialState.lastNotificationId = id;
      if (!id || socialState.toastsSeen.has(id)) continue;
      socialState.toastsSeen.add(id);
      socialShowToast(row.title || tr("Уведомление", "Notification"), row.body || "");
      const kindGroup = socialNotificationKindGroup(row.kind || "");
      socialPlayNotificationSound(kindGroup);
      const shouldDesktopNotify = document.hidden
        || currentTab !== "social"
        || socialState.currentSubtab !== "chat";
      if (shouldDesktopNotify) {
        socialNotifyDesktop(row);
      }
      if (String(row.kind || "") === "chat_message" && currentTab === "social" && socialState.currentSubtab === "chat") {
        const threadId = Number(row.payload?.thread_id || 0);
        if (threadId && threadId === socialState.currentThreadId) {
          socialLoadMessages(threadId, { silent: true });
        }
      }
      if (String(row.kind || "").trim().toLowerCase() === "announcement") {
        socialOpenAnnouncementModal({
          id: Number(row.payload?.announcement_id || 0),
          title: row.title || tr("Объявление", "Announcement"),
          body: row.body || "",
        });
      }
    }
    socialWriteSharedPollState({
      unread: Number(socialState.unreadCount || 0),
      last_notification_id: Number(socialState.lastNotificationId || 0),
      stamp: socialNowMs(),
    });
    socialLoadPendingAnnouncements().catch(() => null);
  } finally {
    socialState.notificationsPollInFlight = false;
  }
}

function socialNextPollDelayMs() {
  if (document.hidden) return 30000;
  if (currentTab === "social" && socialState.currentSubtab === "chat") return 10000;
  return 16000;
}

function socialScheduleNotificationsPoll(immediate = false) {
  if (socialState.notificationsTimer) {
    clearTimeout(socialState.notificationsTimer);
    socialState.notificationsTimer = null;
  }
  const delayMs = immediate ? 500 : socialNextPollDelayMs();
  socialState.notificationsTimer = setTimeout(() => {
    socialPollNotifications()
      .catch(() => null)
      .finally(() => socialScheduleNotificationsPoll(false));
  }, Math.max(250, Number(delayMs || 0)));
}

function socialStartGlobalHooks() {
  if (socialState.globalHooksStarted) return;
  socialState.globalHooksStarted = true;
  if (socialState.notificationsTimer) {
    clearTimeout(socialState.notificationsTimer);
    socialState.notificationsTimer = null;
  }
  socialLoadNotificationSettings().catch(() => null);
  socialRequestDesktopPermission();
  socialApplySharedPollState();
  socialSetBell(socialState.unreadCount || 0);
  socialScheduleNotificationsPoll(true);
  socialLoadPendingAnnouncements().catch(() => null);
}

function socialStopGlobalHooks() {
  socialState.globalHooksStarted = false;
  if (socialState.notificationsTimer) {
    clearTimeout(socialState.notificationsTimer);
    socialState.notificationsTimer = null;
  }
  if (socialState.announcementsTimer) {
    clearTimeout(socialState.announcementsTimer);
    socialState.announcementsTimer = null;
  }
  if (socialState.chatRefreshTimer) {
    clearInterval(socialState.chatRefreshTimer);
    socialState.chatRefreshTimer = null;
  }
  if (socialState.currencyRatesTimer) {
    clearInterval(socialState.currencyRatesTimer);
    socialState.currencyRatesTimer = null;
  }
}

function resetSocialState() {
  socialStopGlobalHooks();
  SOCIAL_UPLOAD_REQUEST_CACHE.clear();
  socialState = {
    boot: null,
    currentSubtab: "chat",
    gamesLeaderboardCache: new Map(),
    currentGameCode: "",
    activeGameRunner: null,
    chatThreads: [],
    chatActors: [],
    currentThreadId: 0,
    chatLastThreadId: 0,
    currentThreadKind: "",
    chatMessages: [],
    chatOldestId: 0,
    chatHasMore: true,
    actors: [],
    projects: [],
    tasks: [],
    calendarEvents: [],
    calendarDate: new Date(),
    calendarSelectedDay: "",
    notes: [],
    currentNoteId: 0,
    noteSaveTimer: null,
    notificationsTimer: null,
    announcementsTimer: null,
    lastNotificationId: 0,
    unreadCount: 0,
    markReadInFlight: false,
    notificationSettings: null,
    announcementModalId: 0,
    pendingAnnouncementIds: new Set(),
    participantProfileCache: new Map(),
    userInteracted: false,
    lastSoundAtByKind: {},
    moduleLoaded: false,
    chatSearch: "",
    chatThreadsSignature: "",
    chatHeaderSignature: "",
    chatMessagesSignatureByThread: {},
    chatMessagesInflightByThread: {},
    chatMessagesRequestSeqByThread: {},
    chatManualClosedUntil: 0,
    toastsSeen: new Set(),
    currencyRates: null,
    currencyRatesStamp: 0,
    currencyRatesTimer: null,
    currencyRatesLoading: false,
    googleCalendarOauth: null,
    sendingMessage: false,
    loadingMessagesThreadId: 0,
    chatReplyTo: null,
    chatContextMessageId: 0,
    chatContextThreadId: 0,
    chatContextX: 0,
    chatContextY: 0,
    keepEmojiOpenUntil: 0,
    mobileThreadAutoSelectEnabled: !socialIsMobileClientShell(),
    fileUploadInFlight: false,
    notificationsPollInFlight: false,
    pendingAnnouncementsInFlight: false,
    globalHooksStarted: false,
    pollClientId: `poll-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
  };
  if (typeof window !== "undefined") {
    window.socialState = socialState;
  }
  socialSetBell(0);
  socialSyncMobileChatChrome(null);
}

function switchSocialSubtab(tab, loadNow = true) {
  const safe = ["games", "chat", "tasks", "calendar", "calculator", "notes"].includes(String(tab || ""))
    ? String(tab)
    : "chat";
  socialState.currentSubtab = safe;
  currentSocialSubtab = safe;
  if (typeof window.syncMobileQuickNavSelection === "function") {
    try { window.syncMobileQuickNavSelection(); } catch (_) {}
  }
  const mapping = {
    games: "socialSubtabGames",
    chat: "socialSubtabChat",
    tasks: "socialSubtabTasks",
    calendar: "socialSubtabCalendar",
    calculator: "socialSubtabCalculator",
    notes: "socialSubtabNotes",
  };
  Object.entries(mapping).forEach(([key, id]) => {
    const node = document.getElementById(id);
    if (node) node.classList.toggle("hidden", key !== safe);
    const btn = document.getElementById(`socialSubtab${key.charAt(0).toUpperCase()}${key.slice(1)}Btn`);
    if (btn) btn.classList.toggle("active", key === safe);
  });
  socialSyncMobileChatChrome();
  if (!loadNow) return;
  if (safe !== "chat") socialSetChatView(false);
  if (safe === "games") socialRenderGames();
  if (safe === "chat") {
    socialLoadThreads({ ensureCurrentMessages: false }).then(() => {
      if (socialState.currentThreadId) {
        socialLoadMessages(socialState.currentThreadId, { silent: true, ensureVisible: true }).catch(() => null);
      }
    }).catch(() => null);
    if (!socialState.chatRefreshTimer) {
      socialState.chatRefreshTimer = setInterval(() => {
        if (document.hidden) return;
        if (currentTab === "social" && socialState.currentSubtab === "chat") {
          socialLoadThreads({ silent: true, ensureCurrentMessages: false }).catch(() => null);
          if (socialState.currentThreadId) {
            socialLoadMessages(socialState.currentThreadId, { silent: true }).catch(() => null);
          }
        }
      }, 12000);
    }
  }
  if (safe === "tasks") {
    socialLoadTaskActors();
    socialLoadProjects();
    socialLoadTasks();
  }
  if (safe === "calendar") {
    socialLoadCalendar();
  }
  if (safe === "calculator") {
    socialRenderConverterOptions();
  }
  if (safe === "notes") {
    socialLoadNotes();
  }
}

async function loadSocialWorkspace() {
  if (modulesLoaded && (!(enabledModules instanceof Set) || !enabledModules.has("social_hub"))) return;
  const boot = await socialRequest("/api/social/bootstrap").catch((e) => {
    if (e?.message) alert(e.message);
    return null;
  });
  if (!boot) return;
  socialState.boot = boot;
  socialState.moduleLoaded = true;
  socialState.mobileThreadAutoSelectEnabled = !socialIsMobileClientShell();
  socialState.actors = Array.isArray(boot.company_actors) ? boot.company_actors : [];
  socialBindChatInputEnter();
  socialRenderGames();
  switchSocialSubtab(currentSocialSubtab || socialState.currentSubtab || "chat", true);
  socialStartGlobalHooks();
  socialSyncMobileChatChrome();
}

function socialBindChatInputEnter() {
  const input = document.getElementById("socialChatInput");
  if (!input || input.dataset.enterBind === "1") return;
  input.dataset.enterBind = "1";
  input.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey || e.isComposing) return;
    const isCoarsePointer = (() => {
      try {
        return Boolean(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
      } catch (_) {
        return false;
      }
    })();
    if (socialIsMobileClientShell() || socialIsMobileApkShell() || isCoarsePointer || (window.innerWidth || 0) <= 980) return;
    e.preventDefault();
    socialSendMessage();
  });
}

function socialOpenModal(title, html) {
  const modal = document.getElementById("socialModal");
  const host = document.getElementById("socialModalHost");
  const titleNode = document.getElementById("socialModalTitle");
  if (!modal || !host || !titleNode) return;
  titleNode.textContent = title || tr("Социальный модуль", "Social module");
  host.innerHTML = html || "";
  modal.classList.remove("hidden");
}

function socialCloseModal(evt = null) {
  const modal = document.getElementById("socialModal");
  if (!modal) return;
  if (evt && evt.target && evt.target !== modal) return;
  if (socialState.activeGameRunner && typeof socialState.activeGameRunner.stop === "function") {
    try { socialState.activeGameRunner.stop(); } catch (_) {}
  }
  socialState.activeGameRunner = null;
  modal.classList.add("hidden");
}

function socialRenderGames() {
  const host = document.getElementById("socialGamesGrid");
  if (!host) return;
  const games = Array.isArray(socialState.boot?.games) && socialState.boot.games.length
    ? socialState.boot.games
    : [
      { code: "snake", title: "Змейка" },
      { code: "tetris", title: "Тетрис" },
      { code: "2048", title: "2048" },
    ];
  host.innerHTML = games.map((game) => {
    const icon = game.code === "snake" ? "🐍" : (game.code === "tetris" ? "🧩" : "🔢");
    return `
      <button class="social-game-card" type="button" ondblclick="socialOpenGameMenu('${escapeHtml(game.code)}')" onclick="socialOpenGameMenu('${escapeHtml(game.code)}')">
        <span class="social-game-icon" aria-hidden="true">${icon}</span>
        <span class="social-game-title">${escapeHtml(game.title || game.code)}</span>
        <small>${tr("Нажмите для входа", "Tap to open")}</small>
      </button>
    `;
  }).join("");
}

async function socialOpenGameMenu(gameCode) {
  const code = String(gameCode || "").trim().toLowerCase();
  if (!code) return;
  socialState.currentGameCode = code;
  const lb = await socialRequest(`/api/social/games/leaderboard?game_code=${encodeURIComponent(code)}&limit=10`).catch(() => ({ my_best: 0, my_rank: null, top: [] }));
  socialState.gamesLeaderboardCache.set(code, lb || {});
  const title = code === "snake"
    ? tr("Змейка", "Snake")
    : (code === "tetris" ? tr("Тетрис", "Tetris") : "2048");
  const myBest = Number(lb?.my_best || 0);
  const myRank = lb?.my_rank ? `#${lb.my_rank}` : "—";
  socialOpenModal(
    `${title}`,
    `
      <div class="social-game-menu">
        <div class="social-game-record">${tr("Ваш рекорд", "Your best")}: <b>${myBest}</b> • ${tr("Место", "Rank")}: <b>${myRank}</b></div>
        <div class="actions">
          <button type="button" onclick="socialStartGame('${escapeHtml(code)}')">${tr("Игра", "Play")}</button>
          <button class="btn-secondary" type="button" onclick="socialShowLeaderboard('${escapeHtml(code)}')">${tr("Рейтинг игроков", "Leaderboard")}</button>
          <button class="btn-secondary" type="button" onclick="socialShowGameTips('${escapeHtml(code)}')">${tr("Как играть", "How to play")}</button>
        </div>
      </div>
    `
  );
}

function socialShowGameTips(code) {
  const safe = String(code || "").toLowerCase();
  const title = safe === "snake"
    ? tr("Как играть в Змейку", "How to play Snake")
    : (safe === "tetris" ? tr("Как играть в Тетрис", "How to play Tetris") : tr("Как играть в 2048", "How to play 2048"));
  const body = safe === "snake"
    ? tr("Управление: стрелки. Ешьте еду, не врезайтесь в стену и в себя. Каждые 5 очков скорость растет.", "Controls: arrows. Eat food and avoid walls or your body. Speed increases every 5 points.")
    : (safe === "tetris"
      ? tr("Управление: ← →, ↓, ↑ поворот, пробел — быстрый сброс. Собирайте линии и набирайте очки.", "Controls: ← →, ↓, ↑ rotate, Space hard drop. Complete lines to gain score.")
      : tr("Управление: стрелки. Совмещайте одинаковые плитки, чтобы получить 2048. Ход завершает игру, когда нет доступных ходов.", "Controls: arrows. Merge equal tiles to reach 2048. Game ends when no moves are available."));
  socialOpenModal(title, `<div class="hint">${escapeHtml(body)}</div><div class="actions"><button type="button" onclick="socialOpenGameMenu('${escapeHtml(safe)}')">${tr("Назад", "Back")}</button></div>`);
}

async function socialShowLeaderboard(code) {
  const safe = String(code || "").toLowerCase();
  const data = await socialRequest(`/api/social/games/leaderboard?game_code=${encodeURIComponent(safe)}&limit=100`).catch((e) => {
    alert(e.message);
    return null;
  });
  if (!data) return;
  const rows = Array.isArray(data.top) ? data.top : [];
  const html = `
    <div class="table-card">
      <table>
        <thead><tr><th>#</th><th>${tr("Ник", "Nickname")}</th><th>${tr("Очки", "Score")}</th></tr></thead>
        <tbody>
          ${rows.length ? rows.map((row) => `
            <tr class="${row.is_me ? "social-me-row" : ""}"><td>${Number(row.rank || 0)}</td><td>${escapeHtml(row.nick || "-")}</td><td>${Number(row.score || 0)}</td></tr>
          `).join("") : `<tr><td colspan="3">${tr("Пока нет результатов", "No records yet")}</td></tr>`}
        </tbody>
      </table>
    </div>
    <div class="hint">${tr("Ваше место", "Your rank")}: <b>${data.my_rank ? `#${data.my_rank}` : "—"}</b> • ${tr("Ваш рекорд", "Your best")}: <b>${Number(data.my_best || 0)}</b></div>
    <div class="actions"><button type="button" onclick="socialOpenGameMenu('${escapeHtml(safe)}')">${tr("Назад", "Back")}</button></div>
  `;
  socialOpenModal(tr("Рейтинг игроков", "Leaderboard"), html);
}

async function socialStoreGameScore(code, score) {
  const safe = String(code || "").toLowerCase();
  if (!["snake", "tetris", "2048"].includes(safe)) return;
  await socialRequest("/api/social/games/score", {
    method: "POST",
    body: JSON.stringify({ game_code: safe, score: Math.max(0, Math.floor(Number(score || 0)))}),
  }).catch(() => null);
}

function socialGameOverlay(title, score, onRetry) {
  const retryFn = typeof onRetry === "function" ? "socialGameRetry()" : "";
  window.socialGameRetryCb = onRetry || null;
  return `
    <div class="social-game-overlay">
      <h3>${escapeHtml(title)}</h3>
      <div>${tr("Счет", "Score")}: <b>${Number(score || 0)}</b></div>
      <div class="actions">
        ${retryFn ? `<button type="button" onclick="${retryFn}">${tr("Еще раз", "Retry")}</button>` : ""}
        <button class="btn-secondary" type="button" onclick="socialOpenGameMenu('${escapeHtml(socialState.currentGameCode || "snake")}')">${tr("В меню", "Menu")}</button>
      </div>
    </div>
  `;
}

function socialGameRetry() {
  if (typeof window.socialGameRetryCb === "function") window.socialGameRetryCb();
}

function socialGameCanvasSize(gameCode) {
  const code = String(gameCode || "").toLowerCase();
  const vw = Math.max(document.documentElement?.clientWidth || 0, window.innerWidth || 0);
  const vh = Math.max(document.documentElement?.clientHeight || 0, window.innerHeight || 0);
  const mobile = vw <= 900;
  if (code === "tetris") {
    const targetWidth = mobile ? Math.min(320, Math.max(220, vw - 72)) : 420;
    const cell = Math.max(16, Math.floor(targetWidth / 10));
    return { width: cell * 10, height: cell * 20 };
  }
  if (code === "2048") {
    const side = mobile ? Math.min(360, Math.max(240, vw - 72)) : 420;
    return { width: side, height: side };
  }
  const width = mobile ? Math.min(360, Math.max(240, vw - 72)) : 420;
  const maxHeight = mobile ? Math.max(360, Math.min(620, vh - 300)) : 620;
  return { width, height: Math.max(340, maxHeight) };
}

function socialGameControlsHtml(code) {
  const safe = String(code || "").toLowerCase();
  if (safe === "snake") {
    return `
      <div class="social-game-controls">
        <button type="button" onclick="socialGameControl('up')">↑</button>
        <button type="button" onclick="socialGameControl('left')">←</button>
        <button type="button" onclick="socialGameControl('down')">↓</button>
        <button type="button" onclick="socialGameControl('right')">→</button>
      </div>
    `;
  }
  if (safe === "2048") {
    return `
      <div class="social-game-controls">
        <button type="button" onclick="socialGameControl('up')">↑</button>
        <button type="button" onclick="socialGameControl('left')">←</button>
        <button type="button" onclick="socialGameControl('down')">↓</button>
        <button type="button" onclick="socialGameControl('right')">→</button>
      </div>
    `;
  }
  if (safe === "tetris") {
    return `
      <div class="social-game-controls">
        <button type="button" onclick="socialGameControl('left')">←</button>
        <button type="button" onclick="socialGameControl('right')">→</button>
        <button type="button" onclick="socialGameControl('down')">↓</button>
        <button type="button" onclick="socialGameControl('rotate')">${tr("Поворот", "Rotate")}</button>
        <button type="button" onclick="socialGameControl('drop')">${tr("Сброс", "Drop")}</button>
      </div>
    `;
  }
  return "";
}

function socialStartGame(code) {
  const safe = String(code || "").toLowerCase();
  const title = safe === "snake"
    ? tr("Змейка", "Snake")
    : (safe === "tetris" ? tr("Тетрис", "Tetris") : "2048");
  const hint = safe === "snake"
    ? tr("Управление: стрелки, свайпы и тап по стороне от змейки. Ешьте еду и не врезайтесь.", "Controls: arrows, swipes, and tap around snake direction. Eat food and avoid collisions.")
    : (safe === "tetris"
      ? tr("Управление: ← →, ↓, ↑ поворот, пробел — быстрый сброс.", "Controls: ← →, ↓, ↑ rotate, Space hard drop.")
      : tr("Управление: стрелки. Совмещайте одинаковые плитки.", "Controls: arrows. Merge equal tiles."));
  const canvasSize = socialGameCanvasSize(safe);
  const controls = socialGameControlsHtml(safe);
  socialOpenModal(
    title,
    `
      <div class="social-game-wrap">
        <div class="hint">${escapeHtml(hint)}</div>
        <canvas id="socialGameCanvas" width="${Number(canvasSize.width || 420)}" height="${Number(canvasSize.height || 620)}"></canvas>
        <div id="socialGameInfo" class="hint">${tr("Счет", "Score")}: 0</div>
        ${controls}
      </div>
    `
  );
  if (socialState.activeGameRunner && typeof socialState.activeGameRunner.stop === "function") {
    socialState.activeGameRunner.stop();
  }
  if (safe === "snake") socialState.activeGameRunner = socialRunSnake();
  else if (safe === "tetris") socialState.activeGameRunner = socialRunTetris();
  else socialState.activeGameRunner = socialRun2048();
}

function socialGameControl(action) {
  const runner = socialState.activeGameRunner;
  if (!runner) return;
  if (action === "up" && typeof runner.moveUp === "function") runner.moveUp();
  if (action === "left" && typeof runner.moveLeft === "function") runner.moveLeft();
  if (action === "right" && typeof runner.moveRight === "function") runner.moveRight();
  if (action === "down" && typeof runner.moveDown === "function") runner.moveDown();
  if (action === "rotate" && typeof runner.rotate === "function") runner.rotate();
  if (action === "drop" && typeof runner.hardDrop === "function") runner.hardDrop();
}

function socialRunSnake() {
  const canvas = document.getElementById("socialGameCanvas");
  const info = document.getElementById("socialGameInfo");
  if (!canvas || !info) return { stop() {} };
  const ctx = canvas.getContext("2d");
  const size = 20;
  const cols = Math.floor(canvas.width / size);
  const rows = Math.floor(canvas.height / size);
  let snake = [{ x: 8, y: 8 }, { x: 7, y: 8 }, { x: 6, y: 8 }];
  let dir = { x: 1, y: 0 };
  let nextDir = { x: 1, y: 0 };
  let food = { x: 12, y: 12 };
  let running = true;
  let score = 0;
  let speed = 130;
  let timer = null;
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTs = 0;

  function setDirection(next) {
    if (!next || typeof next.x !== "number" || typeof next.y !== "number") return;
    if (next.x === -dir.x && next.y === -dir.y) return;
    nextDir = { x: next.x, y: next.y };
  }

  function spawnFood() {
    while (true) {
      const fx = Math.floor(Math.random() * cols);
      const fy = Math.floor(Math.random() * rows);
      if (!snake.some((s) => s.x === fx && s.y === fy)) {
        food = { x: fx, y: fy };
        return;
      }
    }
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#0f1731";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#19d3a2";
    snake.forEach((part, idx) => {
      ctx.globalAlpha = idx === 0 ? 1 : 0.85;
      ctx.fillRect(part.x * size + 1, part.y * size + 1, size - 2, size - 2);
    });
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#ff6f91";
    ctx.fillRect(food.x * size + 2, food.y * size + 2, size - 4, size - 4);
    info.textContent = `${tr("Счет", "Score")}: ${score}`;
  }

  function stopGame(gameOver = false) {
    running = false;
    if (timer) clearTimeout(timer);
    document.removeEventListener("keydown", onKey);
    canvas.removeEventListener("touchstart", onTouchStart);
    canvas.removeEventListener("touchend", onTouchEnd);
    canvas.removeEventListener("pointerdown", onPointerDown);
    socialStoreGameScore("snake", score).catch(() => null);
    if (gameOver) {
      socialOpenModal(tr("Змейка", "Snake"), socialGameOverlay(tr("Игра окончена", "Game over"), score, () => socialStartGame("snake")));
    }
  }

  function step() {
    if (!running) return;
    dir = nextDir;
    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
    if (head.x < 0 || head.y < 0 || head.x >= cols || head.y >= rows || snake.some((s) => s.x === head.x && s.y === head.y)) {
      stopGame(true);
      return;
    }
    snake.unshift(head);
    if (head.x === food.x && head.y === food.y) {
      score += 1;
      if (score % 5 === 0) speed = Math.max(70, speed - 8);
      spawnFood();
    } else {
      snake.pop();
    }
    draw();
    timer = setTimeout(step, speed);
  }

  function onKey(e) {
    const k = e.key;
    if (k.startsWith("Arrow")) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (k === "ArrowUp") setDirection({ x: 0, y: -1 });
    if (k === "ArrowDown") setDirection({ x: 0, y: 1 });
    if (k === "ArrowLeft") setDirection({ x: -1, y: 0 });
    if (k === "ArrowRight") setDirection({ x: 1, y: 0 });
    if (k === "Escape") stopGame(false);
  }

  function onTouchStart(e) {
    const touch = e.touches?.[0];
    if (!touch) return;
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    touchStartTs = Date.now();
  }

  function setDirectionByPoint(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const head = snake[0];
    const hx = (head.x + 0.5) * size;
    const hy = (head.y + 0.5) * size;
    const dx = px - hx;
    const dy = py - hy;
    if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
    if (Math.abs(dx) > Math.abs(dy)) {
      setDirection(dx > 0 ? { x: 1, y: 0 } : { x: -1, y: 0 });
    } else {
      setDirection(dy > 0 ? { x: 0, y: 1 } : { x: 0, y: -1 });
    }
  }

  function onTouchEnd(e) {
    const touch = e.changedTouches?.[0];
    if (!touch) return;
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;
    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) {
      setDirectionByPoint(touch.clientX, touch.clientY);
      return;
    }
    if (Math.abs(dx) > Math.abs(dy)) {
      setDirection(dx > 0 ? { x: 1, y: 0 } : { x: -1, y: 0 });
    } else {
      setDirection(dy > 0 ? { x: 0, y: 1 } : { x: 0, y: -1 });
    }
  }

  function onPointerDown(e) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (e.pointerType === "touch" && Date.now() - touchStartTs < 180) return;
    setDirectionByPoint(e.clientX, e.clientY);
  }

  document.addEventListener("keydown", onKey);
  canvas.addEventListener("touchstart", onTouchStart, { passive: true });
  canvas.addEventListener("touchend", onTouchEnd, { passive: true });
  canvas.addEventListener("pointerdown", onPointerDown, { passive: true });
  spawnFood();
  draw();
  timer = setTimeout(step, speed);

  return {
    stop() {
      stopGame(false);
    },
    moveUp() {
      setDirection({ x: 0, y: -1 });
    },
    moveLeft() {
      setDirection({ x: -1, y: 0 });
    },
    moveRight() {
      setDirection({ x: 1, y: 0 });
    },
    moveDown() {
      setDirection({ x: 0, y: 1 });
    },
  };
}

function socialRunTetris() {
  const canvas = document.getElementById("socialGameCanvas");
  const info = document.getElementById("socialGameInfo");
  if (!canvas || !info) return { stop() {} };
  const ctx = canvas.getContext("2d");
  const cols = 10;
  const rows = 20;
  const cell = Math.floor(canvas.width / cols);
  canvas.height = cell * rows;
  const pad = Math.max(1, Math.round(cell * 0.08));
  const board = Array.from({ length: rows }, () => Array(cols).fill(0));
  const colors = ["#000000", "#19d3a2", "#52a7ff", "#ffb347", "#ff6f91", "#c39bff", "#4dd0e1", "#8bc34a"];
  const shapes = [
    [[1, 1, 1, 1]],
    [[2, 0, 0], [2, 2, 2]],
    [[0, 0, 3], [3, 3, 3]],
    [[4, 4], [4, 4]],
    [[0, 5, 5], [5, 5, 0]],
    [[0, 6, 0], [6, 6, 6]],
    [[7, 7, 0], [0, 7, 7]],
  ];

  let score = 0;
  let running = true;
  let timer = null;
  let speed = 450;
  let current = null;

  function randShape() {
    const matrix = JSON.parse(JSON.stringify(shapes[Math.floor(Math.random() * shapes.length)]));
    return { matrix, x: Math.floor(cols / 2) - Math.ceil(matrix[0].length / 2), y: 0 };
  }

  function collides(piece) {
    for (let y = 0; y < piece.matrix.length; y += 1) {
      for (let x = 0; x < piece.matrix[y].length; x += 1) {
        const val = piece.matrix[y][x];
        if (!val) continue;
        const px = piece.x + x;
        const py = piece.y + y;
        if (px < 0 || px >= cols || py >= rows) return true;
        if (py >= 0 && board[py][px]) return true;
      }
    }
    return false;
  }

  function merge(piece) {
    piece.matrix.forEach((row, y) => {
      row.forEach((val, x) => {
        if (!val) return;
        const py = piece.y + y;
        const px = piece.x + x;
        if (py >= 0 && py < rows && px >= 0 && px < cols) board[py][px] = val;
      });
    });
  }

  function rotate(matrix) {
    const w = matrix[0].length;
    const h = matrix.length;
    const rotated = Array.from({ length: w }, () => Array(h).fill(0));
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        rotated[x][h - y - 1] = matrix[y][x];
      }
    }
    return rotated;
  }

  function clearLines() {
    let lines = 0;
    for (let y = rows - 1; y >= 0; y -= 1) {
      if (board[y].every((v) => v > 0)) {
        board.splice(y, 1);
        board.unshift(Array(cols).fill(0));
        lines += 1;
        y += 1;
      }
    }
    if (lines > 0) {
      score += [0, 100, 250, 450, 700][Math.min(lines, 4)];
      speed = Math.max(120, speed - lines * 8);
    }
  }

  function drawCell(x, y, val) {
    ctx.fillStyle = colors[val] || "#ffffff";
    ctx.fillRect(x * cell + pad, y * cell + pad, cell - pad * 2, cell - pad * 2);
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#0f1731";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    board.forEach((row, y) => row.forEach((val, x) => val && drawCell(x, y, val)));
    if (current) {
      current.matrix.forEach((row, y) => {
        row.forEach((val, x) => {
          if (!val) return;
          drawCell(current.x + x, current.y + y, val);
        });
      });
    }
    info.textContent = `${tr("Счет", "Score")}: ${score}`;
  }

  function gameOver() {
    running = false;
    if (timer) clearTimeout(timer);
    document.removeEventListener("keydown", onKey);
    socialStoreGameScore("tetris", score).catch(() => null);
    socialOpenModal(tr("Тетрис", "Tetris"), socialGameOverlay(tr("Игра окончена", "Game over"), score, () => socialStartGame("tetris")));
  }

  function tick() {
    if (!running) return;
    current.y += 1;
    if (collides(current)) {
      current.y -= 1;
      merge(current);
      clearLines();
      current = randShape();
      if (collides(current)) {
        gameOver();
        return;
      }
    }
    draw();
    timer = setTimeout(tick, speed);
  }

  function hardDrop() {
    while (!collides(current)) current.y += 1;
    current.y -= 1;
  }

  function moveLeft() {
    current.x -= 1;
    if (collides(current)) current.x += 1;
  }

  function moveRight() {
    current.x += 1;
    if (collides(current)) current.x -= 1;
  }

  function moveDown() {
    current.y += 1;
    if (collides(current)) current.y -= 1;
  }

  function rotateCurrent() {
    const prev = current.matrix;
    current.matrix = rotate(current.matrix);
    if (collides(current)) current.matrix = prev;
  }

  function onKey(e) {
    if (!running) return;
    if (e.key.startsWith("Arrow") || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
    }
    if (e.key === "ArrowLeft") {
      moveLeft();
    } else if (e.key === "ArrowRight") {
      moveRight();
    } else if (e.key === "ArrowDown") {
      moveDown();
    } else if (e.key === "ArrowUp") {
      rotateCurrent();
    } else if (e.key === " ") {
      hardDrop();
    } else if (e.key === "Escape") {
      running = false;
      if (timer) clearTimeout(timer);
      document.removeEventListener("keydown", onKey);
      socialStoreGameScore("tetris", score).catch(() => null);
      socialOpenGameMenu("tetris");
      return;
    }
    draw();
  }

  current = randShape();
  if (collides(current)) {
    gameOver();
    return { stop() {} };
  }
  document.addEventListener("keydown", onKey);
  draw();
  timer = setTimeout(tick, speed);

  return {
    stop() {
      running = false;
      if (timer) clearTimeout(timer);
      document.removeEventListener("keydown", onKey);
    },
    moveLeft,
    moveRight,
    moveDown,
    rotate: rotateCurrent,
    hardDrop,
  };
}

function socialRun2048() {
  const canvas = document.getElementById("socialGameCanvas");
  const info = document.getElementById("socialGameInfo");
  if (!canvas || !info) return { stop() {} };
  const ctx = canvas.getContext("2d");
  const size = 4;
  const cell = Math.floor(Math.min(canvas.width, canvas.height) / size);
  const offsetX = Math.floor((canvas.width - cell * size) / 2);
  const offsetY = Math.floor((canvas.height - cell * size) / 2);
  let board = Array.from({ length: size }, () => Array(size).fill(0));
  let score = 0;
  let running = true;
  let touchStartX = 0;
  let touchStartY = 0;

  function spawnTile() {
    const empty = [];
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        if (!board[y][x]) empty.push([x, y]);
      }
    }
    if (!empty.length) return;
    const [x, y] = empty[Math.floor(Math.random() * empty.length)];
    board[y][x] = Math.random() < 0.9 ? 2 : 4;
  }

  function canMove() {
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        if (!board[y][x]) return true;
        const v = board[y][x];
        if (x < size - 1 && board[y][x + 1] === v) return true;
        if (y < size - 1 && board[y + 1][x] === v) return true;
      }
    }
    return false;
  }

  function slide(row) {
    const filtered = row.filter((v) => v);
    const merged = [];
    let i = 0;
    while (i < filtered.length) {
      if (filtered[i] && filtered[i] === filtered[i + 1]) {
        const next = filtered[i] * 2;
        score += next;
        merged.push(next);
        i += 2;
      } else {
        merged.push(filtered[i]);
        i += 1;
      }
    }
    while (merged.length < size) merged.push(0);
    return merged;
  }

  function move(dir) {
    const prev = board.map((r) => r.slice());
    if (dir === "left") {
      board = board.map((row) => slide(row));
    } else if (dir === "right") {
      board = board.map((row) => slide([...row].reverse()).reverse());
    } else if (dir === "up") {
      const cols = Array.from({ length: size }, (_, x) => slide(board.map((r) => r[x])));
      board = board.map((_, y) => cols.map((c) => c[y]));
    } else if (dir === "down") {
      const cols = Array.from({ length: size }, (_, x) => slide(board.map((r) => r[x]).reverse()).reverse());
      board = board.map((_, y) => cols.map((c) => c[y]));
    }
    const changed = board.some((row, y) => row.some((val, x) => val !== prev[y][x]));
    if (changed) spawnTile();
    draw();
    if (!canMove()) {
      running = false;
      socialStoreGameScore("2048", score).catch(() => null);
      socialOpenModal("2048", socialGameOverlay(tr("Игра окончена", "Game over"), score, () => socialStartGame("2048")));
    }
  }

  function drawCell(x, y, value) {
    const colors = {
      0: "#111b33",
      2: "#f5f3ff",
      4: "#dbeafe",
      8: "#bfdbfe",
      16: "#93c5fd",
      32: "#60a5fa",
      64: "#3b82f6",
      128: "#f59e0b",
      256: "#f97316",
      512: "#ef4444",
      1024: "#ec4899",
      2048: "#a855f7",
    };
    ctx.fillStyle = colors[value] || "#1f2937";
    ctx.fillRect(offsetX + x * cell + 4, offsetY + y * cell + 4, cell - 8, cell - 8);
    if (value) {
      ctx.fillStyle = value <= 4 ? "#0f172a" : "#f8fafc";
      ctx.font = `bold ${Math.floor(cell * 0.35)}px 'Unbounded', sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(value), offsetX + x * cell + cell / 2, offsetY + y * cell + cell / 2);
    }
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#0f1731";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        drawCell(x, y, board[y][x]);
      }
    }
    info.textContent = `${tr("Счет", "Score")}: ${score}`;
  }

  function onKey(e) {
    if (!running) return;
    if (e.key.startsWith("Arrow")) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (e.key === "ArrowLeft") move("left");
    if (e.key === "ArrowRight") move("right");
    if (e.key === "ArrowUp") move("up");
    if (e.key === "ArrowDown") move("down");
    if (e.key === "Escape") {
      running = false;
      socialStoreGameScore("2048", score).catch(() => null);
      socialOpenGameMenu("2048");
    }
  }

  function onTouchStart(e) {
    const touch = e.touches?.[0];
    if (!touch) return;
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
  }

  function onTouchEnd(e) {
    if (!running) return;
    const touch = e.changedTouches?.[0];
    if (!touch) return;
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;
    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) {
      move(dx > 0 ? "right" : "left");
    } else {
      move(dy > 0 ? "down" : "up");
    }
  }

  document.addEventListener("keydown", onKey);
  canvas.addEventListener("touchstart", onTouchStart, { passive: true });
  canvas.addEventListener("touchend", onTouchEnd, { passive: true });
  spawnTile();
  spawnTile();
  draw();

  return {
    stop() {
      running = false;
      document.removeEventListener("keydown", onKey);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchend", onTouchEnd);
    },
    moveUp() {
      if (running) move("up");
    },
    moveLeft() {
      if (running) move("left");
    },
    moveRight() {
      if (running) move("right");
    },
    moveDown() {
      if (running) move("down");
    },
  };
}

if (typeof window !== "undefined") {
  const markInteraction = () => {
    socialState.userInteracted = true;
    socialRequestDesktopPermission();
  };
  window.addEventListener("pointerdown", markInteraction, { passive: true });
  window.addEventListener("keydown", markInteraction, { passive: true });
  window.addEventListener("seo-wibe-auth", () => {
    socialMaybeStartHooks();
  });
  if (document.readyState === "complete") {
    setTimeout(() => socialMaybeStartHooks(), 0);
  } else {
    window.addEventListener("load", () => {
      setTimeout(() => socialMaybeStartHooks(), 0);
    });
  }
  document.addEventListener("click", (e) => {
    const menu = document.getElementById("socialChatContextMenu");
    if (menu && !menu.classList.contains("hidden")) {
      const target = e.target;
      const inContext = target?.closest && target.closest("#socialChatContextMenu");
      if (!inContext) socialCloseMessageContext();
    }
    const picker = document.getElementById("socialEmojiPicker");
    const btn = document.getElementById("socialEmojiBtn");
    if (!picker || picker.classList.contains("hidden")) return;
    if (Date.now() < Number(socialState.keepEmojiOpenUntil || 0)) return;
    const target = e.target;
    const inPicker = target?.closest && (
      target.closest("#socialEmojiPicker")
      || target.closest(".social-emoji-tab")
      || target.closest(".social-emoji-item")
    );
    if (inPicker || (btn && btn.contains(target))) return;
    socialToggleEmojiPicker(false);
    socialCloseMessageContext();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const picker = document.getElementById("socialEmojiPicker");
    if (picker && !picker.classList.contains("hidden")) socialToggleEmojiPicker(false);
    socialCloseMessageContext();
  });
}

async function socialLoadThreads(opts = {}) {
  const hasThreadContent = (thread) => {
    if (!thread || typeof thread !== "object") return false;
    const kind = String(thread.kind || "").trim();
    const title = String(thread.title || "").trim();
    const participants = Array.isArray(thread.participants) ? thread.participants : [];
    const last = thread.last_message && typeof thread.last_message === "object" ? thread.last_message : null;
    const lastText = String(last?.text || "").trim();
    const lastSender = String(last?.sender_nick || "").trim();
    const lastId = Number(last?.id || 0);
    return Boolean(kind || title || participants.length || lastText || lastSender || lastId > 0);
  };
  const mergeThreadRow = (nextRow, prevRow) => {
    const next = (nextRow && typeof nextRow === "object") ? nextRow : {};
    const prev = (prevRow && typeof prevRow === "object") ? prevRow : {};
    const merged = { ...prev, ...next };
    const nextLast = (next.last_message && typeof next.last_message === "object") ? next.last_message : null;
    const prevLast = (prev.last_message && typeof prev.last_message === "object") ? prev.last_message : null;
    if (nextLast || prevLast) {
      merged.last_message = { ...(prevLast || {}), ...(nextLast || {}) };
      const mergedText = String(merged.last_message?.text || "").trim();
      if (!mergedText && prevLast && String(prevLast.text || "").trim()) {
        merged.last_message.text = String(prevLast.text || "");
      }
    }
    const nextParticipants = Array.isArray(next.participants) ? next.participants : [];
    const prevParticipants = Array.isArray(prev.participants) ? prev.participants : [];
    if (!nextParticipants.length && prevParticipants.length) {
      merged.participants = prevParticipants;
    }
    const title = String(merged.title || "").trim();
    const prevTitle = String(prev.title || "").trim();
    if (!title && prevTitle) merged.title = prevTitle;
    const avatar = String(merged.avatar_url || "").trim();
    const prevAvatar = String(prev.avatar_url || "").trim();
    if (!avatar && prevAvatar) merged.avatar_url = prevAvatar;
    return merged;
  };
  const signatureOf = (rows) => rows.map((thread) => {
    const last = thread?.last_message || {};
    const participants = Array.isArray(thread?.participants) ? thread.participants : [];
    const peersSig = participants
      .map((p) => `${String(p?.actor_key || "")}:${String(p?.nick || "")}:${String(p?.avatar_url || "")}`)
      .join(",");
    return [
      Number(thread?.id || 0),
      Number(thread?.unread || 0),
      Number(last?.id || 0),
      String(last?.text || ""),
      String(last?.sender_key || ""),
      String(thread?.kind || ""),
      String(thread?.title || ""),
      String(thread?.avatar_url || ""),
      peersSig,
    ].join("|");
  }).join(";");
  const data = await socialRequest("/api/social/chat/threads").catch((e) => {
    if (!opts.silent && e?.message) alert(e.message);
    return null;
  });
  if (!Array.isArray(data)) return;
  const prevMap = new Map(
    (Array.isArray(socialState.chatThreads) ? socialState.chatThreads : [])
      .map((row) => [Number(row?.id || 0), row])
      .filter((item) => Number(item[0] || 0) > 0)
  );
  const rows = data
    .filter((row) => row && typeof row === "object")
    .filter((row) => Number(row.id || 0) > 0)
    .map((row) => mergeThreadRow(row, prevMap.get(Number(row.id || 0))))
    .filter((row) => hasThreadContent(row));
  const nextSig = signatureOf(rows);
  const prevSig = String(socialState.chatThreadsSignature || "");
  const hadRows = Array.isArray(socialState.chatThreads) && socialState.chatThreads.length > 0;
  const selectionMissing = Boolean(
    socialState.currentThreadId
    && !rows.some((x) => Number(x.id) === Number(socialState.currentThreadId))
  );
  const shouldRender = !opts.silent || !hadRows || selectionMissing || nextSig !== prevSig;
  socialState.chatThreads = rows;
  socialState.chatThreadsSignature = nextSig;
  if (shouldRender) socialRenderThreads();
  if (socialState.currentThreadId) {
    const current = rows.find((x) => Number(x.id) === Number(socialState.currentThreadId));
    if (current) socialSetChatHeader(current);
  }
  if (socialState.currentThreadId && opts.ensureCurrentMessages) {
    await socialLoadMessages(
      Number(socialState.currentThreadId),
      { silent: true, bypassUnchanged: true }
    ).catch(() => null);
  }
  const allowAutoSelect = !socialIsMobileClientShell()
    || socialState.mobileThreadAutoSelectEnabled
    || Boolean(opts.forceAutoSelect);
  const autoSelectBlockedByManualClose = Date.now() < Number(socialState.chatManualClosedUntil || 0);
  if ((!socialState.currentThreadId || selectionMissing) && rows.length && allowAutoSelect && !autoSelectBlockedByManualClose) {
    const lastPreferred = Number(socialState.chatLastThreadId || 0);
    const preferred = rows.find((x) => Number(x.id) === lastPreferred) || rows[0];
    if (preferred) {
      await socialSelectThread(Number(preferred.id || 0), { bypassUnchanged: true });
    }
  }
}

function socialFormatChatTime(iso) {
  if (!iso) return "";
  const dt = socialParseDateSafe(iso);
  if (!dt) return String(iso).slice(11, 16).replace("T", " ");
  return dt.toLocaleTimeString(currentLang === "en" ? "en-GB" : "ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function socialFormatChatDate(iso) {
  if (!iso) return "";
  const dt = socialParseDateSafe(iso);
  if (!dt) return String(iso).slice(0, 10);
  const today = new Date();
  const sameDay = dt.toDateString() === today.toDateString();
  if (sameDay) return tr("Сегодня", "Today");
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (dt.toDateString() === yesterday.toDateString()) return tr("Вчера", "Yesterday");
  return dt.toLocaleDateString(currentLang === "en" ? "en-GB" : "ru-RU", { day: "2-digit", month: "short", year: "numeric" });
}

function socialFormatThreadTime(iso) {
  if (!iso) return "";
  const dt = socialParseDateSafe(iso);
  if (!dt) return String(iso).slice(11, 16).replace("T", " ");
  const now = new Date();
  if (dt.toDateString() === now.toDateString()) {
    return dt.toLocaleTimeString(currentLang === "en" ? "en-GB" : "ru-RU", { hour: "2-digit", minute: "2-digit" });
  }
  return dt.toLocaleDateString(currentLang === "en" ? "en-GB" : "ru-RU", { day: "2-digit", month: "2-digit" });
}

function socialFormatLastSeen(iso) {
  if (!iso) return "";
  const dt = socialParseDateSafe(iso);
  if (!dt) return String(iso).slice(0, 16).replace("T", " ");
  const now = new Date();
  const time = dt.toLocaleTimeString(currentLang === "en" ? "en-GB" : "ru-RU", { hour: "2-digit", minute: "2-digit" });
  if (dt.toDateString() === now.toDateString()) return `${tr("сегодня", "today")} ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (dt.toDateString() === yesterday.toDateString()) return `${tr("вчера", "yesterday")} ${time}`;
  return `${dt.toLocaleDateString(currentLang === "en" ? "en-GB" : "ru-RU", { day: "2-digit", month: "short" })} ${time}`;
}

function socialIsParticipantOnline(participant) {
  if (!participant || typeof participant !== "object") return false;
  if (participant.is_online === true) return true;
  const dt = socialParseDateSafe(participant.last_seen_at || "");
  if (!dt) return false;
  return (Date.now() - dt.getTime()) <= (2 * 60 * 1000);
}

const TG_USER_COLORS = [
  "#6C9BFF",
  "#FF8E72",
  "#58C4B4",
  "#FFB547",
  "#9B7BFF",
  "#4CC2FF",
  "#FF6F91",
  "#7CD38A",
  "#F39C6B",
  "#5CB0FF",
  "#D986FF",
  "#45C1C9",
];

function socialColorForSender(key) {
  const raw = String(key || "").trim();
  if (!raw) return "";
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash * 31 + raw.charCodeAt(i)) >>> 0;
  }
  return TG_USER_COLORS[hash % TG_USER_COLORS.length];
}

function socialAvatarMarkup(url, label, size = "sm", eager = false) {
  const safeUrl = String(url || "").trim();
  const fallback = typeof computeAvatarInitials === "function"
    ? computeAvatarInitials(label, "")
    : String(label || "--").slice(0, 2).toUpperCase();
  const loading = eager ? "eager" : "lazy";
  return `
    <div class="tg-avatar tg-avatar-${size}${safeUrl ? " has-image is-pending" : " no-image"}">
      ${safeUrl
        ? `<img src="${escapeHtml(safeUrl)}" alt="${escapeHtml(label || "avatar")}" loading="${loading}" decoding="async" referrerpolicy="no-referrer" draggable="false" onload="this.parentElement&&this.parentElement.classList.remove('is-pending');" onerror="this.remove();this.parentElement&&this.parentElement.classList.remove('has-image');this.parentElement&&this.parentElement.classList.remove('is-pending');this.parentElement&&this.parentElement.classList.add('no-image');" />`
        : ""}
      <span class="tg-avatar-fallback">${escapeHtml(fallback)}</span>
    </div>
  `;
}

function socialThreadDisplay(thread) {
  const participants = Array.isArray(thread?.participants) ? thread.participants : [];
  const isDirect = thread?.kind === "direct";
  const other = isDirect ? participants.find((p) => !p.is_me) : null;
  const title = [
    thread?.title,
    other?.nick,
    thread?.last_message?.sender_nick,
    thread?.kind,
    tr("Чат", "Chat"),
  ]
    .map((value) => String(value || "").trim())
    .find((value) => Boolean(value))
    || tr("Чат", "Chat");
  const avatarUrl = isDirect ? (other?.avatar_url || "") : (thread?.avatar_url || "");
  return {
    title,
    avatarLabel: isDirect ? (other?.nick || title) : title,
    avatarUrl,
    participants,
  };
}

function socialSyncMobileChatChrome(row = null) {
  const host = document.getElementById("mobileChatCompactHead");
  const backBtn = document.getElementById("mobileChatCompactBack");
  const titleNode = document.getElementById("mobileChatCompactTitle");
  const subtitleNode = document.getElementById("mobileChatCompactSubtitle");
  if (!host || !backBtn || !titleNode || !subtitleNode) return;
  const isApkShell = socialIsMobileApkShell();
  const inSocialChat = typeof currentTab !== "undefined"
    && String(currentTab || "") === "social"
    && String(socialState.currentSubtab || "") === "chat";
  const activeThread = row || socialGetCurrentThread();
  const show = isApkShell && inSocialChat && Number(socialState.currentThreadId || 0) > 0 && Boolean(activeThread);
  host.classList.toggle("hidden", !show);
  backBtn.classList.toggle("hidden", !show);
  if (!show) {
    titleNode.textContent = tr("Чаты", "Chats");
    subtitleNode.textContent = "";
    subtitleNode.classList.remove("online-now");
    titleNode.classList.remove("is-clickable");
    subtitleNode.classList.remove("is-clickable");
    titleNode.onclick = null;
    subtitleNode.onclick = null;
    return;
  }
  const display = socialThreadDisplay(activeThread);
  const participants = Array.isArray(display.participants) ? display.participants : [];
  let subtitle = "";
  let subtitleOnline = false;
  if (activeThread?.kind === "direct") {
    const other = participants.find((p) => !p.is_me);
    const onlineNow = socialIsParticipantOnline(other);
    const stateText = onlineNow
      ? tr("сейчас онлайн", "online now")
      : (socialFormatLastSeen(other?.last_seen_at || "") || tr("нет данных", "unknown"));
    subtitle = `${tr("Личный чат", "Direct chat")} • ${stateText}`;
    subtitleOnline = onlineNow;
  } else {
    subtitle = `${tr("Группа", "Group")} • ${participants.length}`;
  }
  titleNode.textContent = String(display.title || tr("Чат", "Chat"));
  subtitleNode.textContent = subtitle;
  subtitleNode.classList.toggle("online-now", subtitleOnline);
  titleNode.classList.toggle("is-clickable", true);
  subtitleNode.classList.toggle("is-clickable", true);
  titleNode.onclick = () => socialOpenCurrentParticipantProfile();
  subtitleNode.onclick = () => socialOpenCurrentParticipantProfile();
}

function socialFilterThreads() {
  socialState.chatSearch = String(document.getElementById("socialChatSearch")?.value || "").trim().toLowerCase();
  socialRenderThreads();
}

function socialSetChatView(open) {
  const layout = document.querySelector("#socialSubtabChat .social-chat-layout");
  if (!layout) return;
  layout.classList.toggle("chat-open", Boolean(open));
  socialSyncMobileChatChrome();
}

function socialIsThreadOpen() {
  const currentId = Number(socialState.currentThreadId || 0);
  if (currentId > 0) return true;
  const layout = document.querySelector("#socialSubtabChat .social-chat-layout");
  return Boolean(layout?.classList.contains("chat-open"));
}

function socialHasRenderedMessages(host = null) {
  const node = host || document.getElementById("socialChatMessages");
  if (!node) return false;
  return Boolean(node.querySelector(".tg-msg-row"));
}

function socialCloseThread(opts = {}) {
  socialState.currentSubtab = "chat";
  if (typeof currentSocialSubtab !== "undefined") currentSocialSubtab = "chat";
  socialState.currentThreadId = 0;
  socialState.currentThreadKind = "";
  socialState.mobileThreadAutoSelectEnabled = Boolean(opts.keepAutoSelect) || !socialIsMobileClientShell();
  socialState.chatManualClosedUntil = Boolean(opts.keepAutoSelect) ? 0 : (Date.now() + 30000);
  socialState.chatMessages = [];
  socialState.chatOldestId = 0;
  socialState.chatHasMore = true;
  socialClearReply();
  socialCloseMessageContext();
  const head = document.getElementById("socialChatHead");
  const sub = document.getElementById("socialChatHeadSubtitle");
  const avatar = document.getElementById("socialChatHeadAvatar");
  const meta = document.getElementById("socialChatHeadMeta");
  const avatarBtn = document.getElementById("socialChatAvatarBtn");
  const host = document.getElementById("socialChatMessages");
  if (head) head.textContent = tr("Выберите чат", "Select chat");
  if (sub) sub.textContent = "-";
  if (avatar) avatar.innerHTML = socialAvatarMarkup("", "--", "md");
  if (meta) {
    meta.textContent = "";
    meta.classList.add("hidden");
  }
  if (avatarBtn) avatarBtn.classList.add("hidden");
  if (host) host.innerHTML = "";
  socialRenderThreads();
  socialSetChatView(false);
  socialSyncMobileChatChrome(null);
}

function socialRenderThreads() {
  const host = document.getElementById("socialChatThreads");
  if (!host) return;
  const query = String(socialState.chatSearch || "").trim().toLowerCase();
  const rows = query
    ? socialState.chatThreads.filter((thread) => {
      const participants = Array.isArray(thread?.participants) ? thread.participants : [];
      const hay = `${thread?.title || ""} ${thread?.kind || ""} ${participants.map((p) => p?.nick || "").join(" ")}`.toLowerCase();
      return hay.includes(query);
    })
    : socialState.chatThreads;
  const existing = new Map();
  host.querySelectorAll(".social-thread-item[data-thread-id]").forEach((node) => {
    const id = Number(node.getAttribute("data-thread-id") || 0);
    if (id > 0) existing.set(id, node);
  });
  const usedIds = new Set();
  let cursor = host.firstElementChild;
  for (const thread of rows) {
    const threadId = Number(thread.id || 0);
    if (!threadId) continue;
    const unread = Number(thread.unread || 0);
    const lastText = String(thread.last_message?.text || "");
    const lastTime = socialFormatThreadTime(thread.last_message?.created_at || "");
    const display = socialThreadDisplay(thread);
    const active = threadId === Number(socialState.currentThreadId || 0);
    const rowSig = [
      threadId,
      active ? 1 : 0,
      unread,
      String(lastText || ""),
      String(lastTime || ""),
      String(display.title || ""),
      String(display.avatarLabel || ""),
      String(display.avatarUrl || ""),
    ].join("|");
    let node = existing.get(threadId);
    if (!node) {
      node = document.createElement("button");
      node.type = "button";
      node.className = "social-thread-item";
      node.setAttribute("data-thread-id", String(threadId));
      node.addEventListener("click", () => socialSelectThread(threadId));
    }
    if (String(node.getAttribute("data-row-sig") || "") !== rowSig) {
      node.classList.toggle("active", active);
      node.innerHTML = `
        <div class="social-thread-avatar">${socialAvatarMarkup(display.avatarUrl, display.avatarLabel, "sm")}</div>
        <div class="social-thread-body">
          <div class="social-thread-row">
            <div class="social-thread-title">${escapeHtml(display.title)}</div>
            <div class="social-thread-time">${escapeHtml(lastTime)}</div>
          </div>
          <div class="social-thread-preview">${escapeHtml(lastText || tr("Сообщений пока нет", "No messages yet"))}</div>
        </div>
        ${unread > 0 ? `<span class="social-thread-unread">${unread > 99 ? "99+" : unread}</span>` : ""}
      `;
      node.setAttribute("data-row-sig", rowSig);
    } else if (node.classList.contains("active") !== active) {
      node.classList.toggle("active", active);
    }
    usedIds.add(threadId);
    if (node !== cursor) {
      host.insertBefore(node, cursor);
    } else {
      cursor = cursor?.nextElementSibling || null;
    }
  }
  existing.forEach((node, id) => {
    if (!usedIds.has(id)) node.remove();
  });
  while (cursor) {
    const next = cursor.nextElementSibling;
    cursor.remove();
    cursor = next;
  }
}

function socialSetChatHeader(row, opts = {}) {
  const force = Boolean(opts.force);
  const head = document.getElementById("socialChatHead");
  const sub = document.getElementById("socialChatHeadSubtitle");
  const avatar = document.getElementById("socialChatHeadAvatar");
  const meta = document.getElementById("socialChatHeadMeta");
  const avatarBtn = document.getElementById("socialChatAvatarBtn");
  const groupBtn = document.getElementById("socialChatGroupBtn");
  if (!row) {
    socialState.chatHeaderSignature = "";
    if (head) head.textContent = tr("Выберите чат", "Select chat");
    if (sub) sub.textContent = "-";
    if (avatar) avatar.innerHTML = socialAvatarMarkup("", "--", "md");
    if (meta) {
      meta.textContent = "";
      meta.classList.add("hidden");
    }
    if (avatarBtn) avatarBtn.classList.add("hidden");
    if (groupBtn) groupBtn.classList.add("hidden");
    socialSyncMobileChatChrome(null);
    return;
  }
  const display = socialThreadDisplay(row);
  const participants = display.participants || [];
  const subtitle = row.kind === "direct"
    ? tr("Личный чат", "Direct chat")
    : `${tr("Группа", "Group")} • ${participants.length}`;
  let lastSeenLabel = "";
  let onlineNow = false;
  if (row.kind === "direct") {
    const other = participants.find((p) => !p.is_me);
    onlineNow = socialIsParticipantOnline(other);
    lastSeenLabel = onlineNow
      ? tr("сейчас онлайн", "online now")
      : socialFormatLastSeen(other?.last_seen_at || "");
  }
  const headerSig = [
    Number(row?.id || 0),
    String(display.title || ""),
    String(display.avatarUrl || ""),
    String(subtitle || ""),
    String(lastSeenLabel || ""),
    String(onlineNow ? "1" : "0"),
    String(row?.kind || ""),
    Number(participants.length || 0),
  ].join("|");
  if (!force && headerSig && String(socialState.chatHeaderSignature || "") === headerSig) {
    socialSyncMobileChatChrome(row);
    return;
  }
  socialState.chatHeaderSignature = headerSig;
  if (head) head.textContent = display.title;
  if (sub) sub.textContent = subtitle;
  if (avatar) avatar.innerHTML = socialAvatarMarkup(display.avatarUrl, display.avatarLabel, "md", true);
  if (head) {
    head.classList.toggle("is-clickable", true);
    head.onclick = () => socialOpenCurrentParticipantProfile();
  }
  if (sub) {
    sub.classList.toggle("is-clickable", true);
    sub.onclick = () => socialOpenCurrentParticipantProfile();
  }
  if (meta) {
    if (row.kind === "direct") {
      const label = lastSeenLabel || tr("нет данных", "unknown");
      meta.textContent = `${tr("Последний раз в сети", "Last seen")}: ${label}`;
      meta.classList.toggle("online-now", onlineNow);
      meta.classList.remove("hidden");
    } else {
      meta.textContent = "";
      meta.classList.remove("online-now");
      meta.classList.add("hidden");
    }
  }
  if (avatarBtn) {
    avatarBtn.classList.toggle("hidden", String(row.kind || "") === "direct");
  }
  if (groupBtn) {
    groupBtn.classList.toggle("hidden", String(row.kind || "") !== "group");
  }
  socialSyncMobileChatChrome(row);
}

function socialCurrentDirectPeer(thread = null) {
  const row = thread || socialGetCurrentThread();
  if (!row || String(row.kind || "") !== "direct") return null;
  const participants = Array.isArray(row.participants) ? row.participants : [];
  return participants.find((p) => !p.is_me) || null;
}

function socialOpenCurrentParticipantProfile() {
  const row = socialGetCurrentThread();
  if (!row) return;
  if (String(row.kind || "") === "group") {
    socialOpenGroupParticipants();
    return;
  }
  const peer = socialCurrentDirectPeer(row);
  if (!peer || !peer.actor_key) return;
  socialOpenParticipantProfile(peer.actor_key, Number(row.id || 0));
}

function socialOpenGroupParticipants() {
  const row = socialGetCurrentThread();
  if (!row || String(row.kind || "") !== "group") return;
  const threadId = Number(row.id || 0);
  const participants = Array.isArray(row.participants) ? row.participants : [];
  const listHtml = participants.map((p) => {
    const actorKey = String(p?.actor_key || "").trim();
    const nick = String(p?.nick || actorKey || "-").trim() || "-";
    const online = socialIsParticipantOnline(p);
    const state = online
      ? tr("сейчас онлайн", "online now")
      : (socialFormatLastSeen(p?.last_seen_at || "") || tr("нет данных", "unknown"));
    return `
      <button type="button" class="social-participant-row" data-social-profile-actor="${escapeHtml(actorKey)}">
        <span class="social-participant-avatar">${socialAvatarMarkup(p?.avatar_url || "", nick, "xs")}</span>
        <span class="social-participant-main">
          <b>${escapeHtml(nick)}</b>
          <small>${escapeHtml(state)}</small>
        </span>
        <span class="social-participant-open">&#8250;</span>
      </button>
    `;
  }).join("");
  socialOpenModal(
    tr("Участники группы", "Group participants"),
    `
      <div class="social-participant-list">
        ${listHtml || `<div class="hint">${escapeHtml(tr("Список участников пуст.", "No participants yet."))}</div>`}
      </div>
    `
  );
  document.querySelectorAll("[data-social-profile-actor]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const actorKey = String(btn.getAttribute("data-social-profile-actor") || "").trim();
      if (!actorKey) return;
      socialOpenParticipantProfile(actorKey, threadId);
    });
  });
}

async function socialOpenParticipantProfile(actorKey, threadId = 0) {
  const safeActorKey = String(actorKey || "").trim();
  const safeThreadId = Number(threadId || socialState.currentThreadId || 0);
  if (!safeActorKey || !safeThreadId) return;
  const cacheKey = `${safeThreadId}:${safeActorKey.toLowerCase()}`;
  const cached = socialState.participantProfileCache.get(cacheKey);
  if (cached && Number(cached.stamp || 0) > 0 && (socialNowMs() - Number(cached.stamp || 0)) < 120000) {
    socialRenderParticipantProfileModal(cached.data || {}, safeActorKey);
    return;
  }
  const profile = await socialRequest(
    `/api/social/chat/participant/profile?thread_id=${safeThreadId}&actor_key=${encodeURIComponent(safeActorKey)}`
  ).catch((e) => {
    alert(e?.message || tr("Не удалось открыть профиль", "Failed to open profile"));
    return null;
  });
  if (!profile || typeof profile !== "object") return;
  socialState.participantProfileCache.set(cacheKey, {
    stamp: socialNowMs(),
    data: profile,
  });
  socialRenderParticipantProfileModal(profile, safeActorKey);
}

function socialRenderParticipantProfileModal(profile, safeActorKey = "") {
  if (!profile || typeof profile !== "object") return;
  const nick = String(profile.nick || safeActorKey || "-").trim() || "-";
  const email = String(profile.email || "").trim();
  const company = String(profile.company_name || "").trim();
  const city = String(profile.city || "").trim();
  const position = String(profile.position_title || "").trim();
  const fullName = String(profile.full_name || "").trim();
  const isOwner = Boolean(profile.is_owner);
  const online = Boolean(profile.is_online);
  const lastSeen = online
    ? tr("сейчас онлайн", "online now")
    : (socialFormatLastSeen(String(profile.last_seen_at || "")) || tr("нет данных", "unknown"));
  socialOpenModal(
    tr("Профиль участника", "Participant profile"),
    `
      <div class="social-profile-view">
        <div class="social-profile-head">
          ${socialAvatarMarkup(String(profile.avatar_url || ""), nick, "md", true)}
          <div class="social-profile-head-text">
            <h4>${escapeHtml(nick)}</h4>
            <div class="hint">${escapeHtml(isOwner ? tr("Владелец", "Owner") : tr("Сотрудник", "Employee"))}</div>
          </div>
        </div>
        <div class="social-profile-grid">
          <div><span>${escapeHtml(tr("Полное имя", "Full name"))}</span><b>${escapeHtml(fullName || "-")}</b></div>
          <div><span>${escapeHtml(tr("Email", "Email"))}</span><b>${escapeHtml(email || "-")}</b></div>
          <div><span>${escapeHtml(tr("Компания", "Company"))}</span><b>${escapeHtml(company || "-")}</b></div>
          <div><span>${escapeHtml(tr("Город", "City"))}</span><b>${escapeHtml(city || "-")}</b></div>
          <div><span>${escapeHtml(tr("Должность", "Position"))}</span><b>${escapeHtml(position || "-")}</b></div>
          <div><span>${escapeHtml(tr("Статус", "Status"))}</span><b>${escapeHtml(lastSeen)}</b></div>
        </div>
      </div>
    `
  );
}

async function socialSelectThread(threadId, opts = {}) {
  const id = Number(threadId || 0);
  if (!id) return;
  const sameThread = Number(socialState.currentThreadId || 0) === id;
  if (sameThread && !opts.bypassUnchanged && !opts.forceReload) {
    socialSetChatView(true);
    socialSyncMobileChatChrome();
    return;
  }
  socialState.currentThreadId = id;
  socialState.chatLastThreadId = id;
  socialState.chatManualClosedUntil = 0;
  socialState.mobileThreadAutoSelectEnabled = true;
  if (!sameThread) {
    socialState.chatMessages = [];
    socialState.chatMessagesSignatureByThread[id] = "";
    socialState.chatOldestId = 0;
    socialState.chatHasMore = true;
  }
  const row = socialState.chatThreads.find((x) => Number(x.id) === id) || null;
  socialState.currentThreadKind = String(row?.kind || "");
  socialClearReply();
  socialCloseMessageContext();
  socialSetChatHeader(row);
  socialRenderThreads();
  socialSetChatView(true);
  const host = document.getElementById("socialChatMessages");
  if (host && Number(socialState.currentThreadId || 0) === id) {
    host.innerHTML = `<div class="hint social-chat-loading">${tr("Загрузка сообщений…", "Loading messages…")}</div>`;
  }
  await socialLoadMessages(id, {
    forceBottom: true,
    bypassUnchanged: true,
    ensureVisible: true,
  });
  await socialRequest(`/api/social/chat/read/${id}`, { method: "POST" }).catch(() => null);
  socialPollNotifications().catch(() => null);
}

function socialGetCurrentThread() {
  if (!socialState.currentThreadId) return null;
  return socialState.chatThreads.find((x) => Number(x.id) === Number(socialState.currentThreadId)) || null;
}

function socialSetReplyTo(message) {
  if (!message || Number(message.id || 0) <= 0) return;
  socialState.chatReplyTo = {
    id: Number(message.id || 0),
    sender_nick: String(message.sender_nick || ""),
    text: String(message.text || ""),
  };
  socialRenderReplyBar();
}

function socialSetReplyById(messageId) {
  const id = Number(messageId || 0);
  if (!id) return;
  const row = (socialState.chatMessages || []).find((x) => Number(x.id) === id);
  if (!row) return;
  socialSetReplyTo(row);
}

function socialClearReply() {
  socialState.chatReplyTo = null;
  socialRenderReplyBar();
}

function socialRenderReplyBar() {
  const bar = document.getElementById("socialChatReplyBar");
  if (!bar) return;
  const row = socialState.chatReplyTo;
  if (!row || Number(row.id || 0) <= 0) {
    bar.classList.add("hidden");
    bar.innerHTML = "";
    return;
  }
  bar.classList.remove("hidden");
  bar.innerHTML = `
    <div class="social-chat-reply-content">
      <small>${escapeHtml(tr("Ответ на сообщение", "Reply to message"))}</small>
      <b>${escapeHtml(String(row.sender_nick || "-"))}</b>
      <span>${escapeHtml(String(row.text || "").slice(0, 180))}</span>
    </div>
    <button type="button" class="btn-secondary" onclick="socialClearReply()">${tr("Отмена", "Cancel")}</button>
  `;
}

function socialCloseMessageContext() {
  socialState.chatContextMessageId = 0;
  socialState.chatContextThreadId = 0;
  const menu = document.getElementById("socialChatContextMenu");
  if (!menu) return;
  menu.classList.add("hidden");
  menu.innerHTML = "";
}

function socialOpenMessageContext(messageId, event) {
  const id = Number(messageId || 0);
  if (!id) return;
  const row = (socialState.chatMessages || []).find((x) => Number(x.id) === id);
  if (!row) return;
  const menu = document.getElementById("socialChatContextMenu");
  if (!menu) return;
  if (event?.preventDefault) event.preventDefault();
  if (event?.stopPropagation) event.stopPropagation();
  socialState.chatContextMessageId = id;
  socialState.chatContextThreadId = Number(socialState.currentThreadId || 0);
  let x = Number(event?.clientX || 0);
  let y = Number(event?.clientY || 0);
  if ((!Number.isFinite(x) || x <= 0 || !Number.isFinite(y) || y <= 0) && event?.target?.getBoundingClientRect) {
    const rect = event.target.getBoundingClientRect();
    x = Number(rect.left || 0) + Math.max(12, Math.min(40, Number(rect.width || 0) * 0.5));
    y = Number(rect.top || 0) + Math.max(12, Math.min(26, Number(rect.height || 0) * 0.4));
  }
  if (!Number.isFinite(x) || x <= 0) x = 18;
  if (!Number.isFinite(y) || y <= 0) y = 18;
  socialState.chatContextX = x;
  socialState.chatContextY = y;
  const quick = ["👍", "🔥", "❤️", "😂", "🙏", "✅"];
  menu.innerHTML = `
    <button type="button" class="social-chat-context-btn" onclick="socialContextReply()">${tr("Ответить", "Reply")}</button>
    <div class="social-chat-context-reactions">
      ${quick.map((emoji) => `<button type="button" class="social-chat-context-emoji" onclick="socialContextReact('${escapeHtml(emoji)}')">${emoji}</button>`).join("")}
    </div>
  `;
  menu.style.left = `${Math.max(8, x)}px`;
  menu.style.top = `${Math.max(8, y)}px`;
  menu.style.maxWidth = "min(320px, calc(100vw - 20px))";
  menu.style.visibility = "hidden";
  menu.classList.remove("hidden");
  const rect = menu.getBoundingClientRect();
  const vw = window.innerWidth || document.documentElement.clientWidth || 0;
  const vh = window.innerHeight || document.documentElement.clientHeight || 0;
  const margin = 8;
  let nextX = x + 6;
  let nextY = y + 6;
  if (nextX + rect.width + margin > vw) nextX = x - rect.width - 6;
  if (nextY + rect.height + margin > vh) nextY = y - rect.height - 6;
  const clampedX = Math.max(margin, Math.min(nextX, Math.max(margin, vw - rect.width - margin)));
  const clampedY = Math.max(margin, Math.min(nextY, Math.max(margin, vh - rect.height - margin)));
  menu.style.left = `${clampedX}px`;
  menu.style.top = `${clampedY}px`;
  menu.style.visibility = "visible";
}

function socialContextReply() {
  const id = Number(socialState.chatContextMessageId || 0);
  if (!id) return;
  socialSetReplyById(id);
  socialCloseMessageContext();
}

async function socialToggleReaction(messageId, emoji) {
  const threadId = Number(socialState.currentThreadId || 0);
  const id = Number(messageId || 0);
  const code = String(emoji || "").trim();
  if (!threadId || !id || !code) return;
  const row = await socialRequest(`/api/social/chat/messages/${threadId}/${id}/reactions`, {
    method: "POST",
    body: JSON.stringify({ emoji: code }),
    retryOnPost: true,
    maxRetries: 1,
  }).catch((e) => {
    if (e?.message) alert(e.message);
    return null;
  });
  if (!row) return;
  const idx = (socialState.chatMessages || []).findIndex((x) => Number(x.id) === id);
  if (idx >= 0) {
    socialState.chatMessages[idx] = row;
  }
  socialLoadMessages(threadId, { silent: true }).catch(() => null);
}

function socialContextReact(emoji) {
  const id = Number(socialState.chatContextMessageId || 0);
  if (!id) return;
  socialToggleReaction(id, emoji);
  socialCloseMessageContext();
}

function socialMessageAttachmentsHtml(message) {
  const rows = Array.isArray(message?.attachments) ? message.attachments : [];
  if (!rows.length) return "";
  const body = rows.map((item) => {
    const url = String(item?.url || "").trim();
    if (!url) return "";
    const name = String(item?.filename || "file").trim() || "file";
    const ctype = String(item?.content_type || "").toLowerCase();
    const isImage = ctype.startsWith("image/") || /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(url);
    if (isImage) {
      return `<a class="tg-attach tg-attach-image" href="${escapeHtml(url)}" target="_blank" rel="noopener"><img src="${escapeHtml(url)}" alt="${escapeHtml(name)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" /></a>`;
    }
    return `<a class="tg-attach tg-attach-file" href="${escapeHtml(url)}" target="_blank" rel="noopener">📎 ${escapeHtml(name)}</a>`;
  }).join("");
  if (!body) return "";
  return `<div class="tg-msg-attachments">${body}</div>`;
}

function socialMessageReactionsHtml(message) {
  const rows = Array.isArray(message?.reactions) ? message.reactions : [];
  if (!rows.length) return "";
  const id = Number(message?.id || 0);
  const buttons = rows.map((row) => {
    const emoji = String(row?.emoji || "").trim();
    if (!emoji) return "";
    const count = Math.max(1, Number(row?.count || 1));
    const active = row?.my ? "active" : "";
    return `<button type="button" class="tg-reaction ${active}" onclick="socialToggleReaction(${id}, '${escapeHtml(emoji)}')">${emoji} ${count}</button>`;
  }).join("");
  return `<div class="tg-msg-reactions">${buttons}</div>`;
}

function socialMessageDeliveryStatus(message) {
  if (!message || !message.is_mine) return "";
  const raw = String(message.delivery_status || message._local_delivery_status || "").trim().toLowerCase();
  if (raw === "sending" || raw === "failed" || raw === "sent" || raw === "read") return raw;
  return "sent";
}

function socialMessageStatusDotHtml(message) {
  const status = socialMessageDeliveryStatus(message);
  if (!status) return "";
  const readBy = Math.max(0, Number(message?.delivery_read_by || 0));
  const readTotal = Math.max(0, Number(message?.delivery_total || 0));
  const titleByStatus = {
    sending: tr("Отправляется…", "Sending..."),
    failed: tr("Не отправлено", "Not sent"),
    sent: tr("Отправлено, не прочитано", "Sent, unread"),
    read: tr("Прочитано", "Read"),
  };
  const title = status === "read" && readTotal > 0
    ? `${titleByStatus.read} (${readBy}/${readTotal})`
    : titleByStatus[status] || titleByStatus.sent;
  return `<span class="tg-msg-status-dot ${status}" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}"></span>`;
}

function socialOpenGroupAvatarModal() {
  const thread = socialGetCurrentThread();
  if (!thread || String(thread.kind || "") === "direct") return;
  const current = String(thread.avatar_url || "").trim();
  const picks = typeof GROUP_AVATARS !== "undefined"
    ? GROUP_AVATARS
    : (typeof DEFAULT_AVATARS !== "undefined" ? DEFAULT_AVATARS : []);
  const pickerHtml = picks.map((url) => {
    const active = current && url === current ? "active" : "";
    return `<button type="button" class="avatar-chip ${active}" data-avatar-url="${escapeHtml(url)}"><img src="${escapeHtml(url)}" alt="avatar" /></button>`;
  }).join("");
  socialOpenModal(
    tr("Аватар чата", "Chat avatar"),
    `
      <div class="social-avatar-editor">
        <div class="team-avatar-row">
          <div id="socialGroupAvatarPreview" class="profile-avatar-preview">--</div>
          <div class="team-avatar-controls">
            <label class="admin-user-field">
              <span>${escapeHtml(tr("Ссылка на аватар", "Avatar URL"))}</span>
              <input id="socialGroupAvatarUrl" placeholder="https://..." />
            </label>
            <div id="socialGroupAvatarPicker" class="avatar-picker">${pickerHtml}</div>
          </div>
        </div>
        <div class="actions">
          <button id="socialGroupAvatarSave" type="button">${tr("Сохранить", "Save")}</button>
          <button id="socialGroupAvatarClear" class="btn-secondary" type="button">${tr("Удалить", "Clear")}</button>
        </div>
      </div>
    `
  );
  const input = document.getElementById("socialGroupAvatarUrl");
  const preview = document.getElementById("socialGroupAvatarPreview");
  if (input) input.value = current;
  const applyPreview = (url) => {
    const safe = String(url || "").trim();
    if (!preview) return;
    if (!safe) {
      preview.textContent = "--";
      return;
    }
    preview.innerHTML = `<img src="${escapeHtml(safe)}" alt="avatar" class="avatar-img" />`;
  };
  applyPreview(current);
  input?.addEventListener("input", () => applyPreview(input.value));
  document.querySelectorAll("#socialGroupAvatarPicker [data-avatar-url]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const url = String(btn.dataset.avatarUrl || "").trim();
      if (input) input.value = url;
      applyPreview(url);
      document.querySelectorAll("#socialGroupAvatarPicker .avatar-chip").forEach((el) => {
        el.classList.toggle("active", el === btn);
      });
    });
  });
  document.getElementById("socialGroupAvatarSave")?.addEventListener("click", () => {
    socialSaveGroupAvatar();
  });
  document.getElementById("socialGroupAvatarClear")?.addEventListener("click", () => {
    if (input) input.value = "";
    applyPreview("");
    document.querySelectorAll("#socialGroupAvatarPicker .avatar-chip").forEach((el) => {
      el.classList.remove("active");
    });
  });
}

async function socialSaveGroupAvatar() {
  const thread = socialGetCurrentThread();
  if (!thread) return;
  const input = document.getElementById("socialGroupAvatarUrl");
  const avatar_url = String(input?.value || "").trim();
  const updated = await socialRequest(`/api/social/chat/threads/${Number(thread.id)}/avatar`, {
    method: "PUT",
    body: JSON.stringify({ avatar_url }),
  }).catch((e) => {
    if (e?.message) alert(e.message);
    return null;
  });
  if (!updated) return;
  const idx = socialState.chatThreads.findIndex((x) => Number(x.id) === Number(updated.id));
  if (idx >= 0) socialState.chatThreads[idx] = updated;
  socialSetChatHeader(updated);
  socialRenderThreads();
  socialCloseModal();
}

function socialRenderChatMessages(opts = {}) {
  const host = document.getElementById("socialChatMessages");
  if (!host) return;
  const keepOffset = Boolean(opts.keepOffset);
  const forceBottom = Boolean(opts.forceBottom);
  const prevScrollHeight = Number(opts.prevScrollHeight || 0);
  const prevScrollTop = Number(opts.prevScrollTop || 0);
  const wasAtBottom = typeof opts.wasAtBottom === "boolean"
    ? opts.wasAtBottom
    : (host.scrollHeight - host.scrollTop - host.clientHeight < 40);
  const loadMoreBtn = socialState.chatHasMore
    ? `<button class="btn-secondary social-chat-loadmore" type="button" onclick="socialLoadOlderMessages()">${tr("Загрузить раньше", "Load earlier")}</button>`
    : `<div class="hint">${tr("Начало чата", "Start of chat")}</div>`;
  const isGroup = String(socialState.currentThreadKind || "") !== "direct";
  let lastDate = "";
  let lastSender = "";
  let lastMine = false;
  const messagesHtml = (socialState.chatMessages || []).map((msg) => {
    const dateKey = String(msg.created_at || "").slice(0, 10);
    let dateBlock = "";
    if (dateKey && dateKey !== lastDate) {
      dateBlock = `<div class="tg-date-sep"><span>${escapeHtml(socialFormatChatDate(msg.created_at || ""))}</span></div>`;
      lastDate = dateKey;
      lastSender = "";
      lastMine = false;
    }
    const senderKey = String(msg.sender_key || msg.sender_nick || "");
    const sameSender = senderKey && senderKey === lastSender && lastMine === Boolean(msg.is_mine);
    const compact = sameSender;
    lastSender = senderKey;
    lastMine = Boolean(msg.is_mine);
    const showName = !msg.is_mine && isGroup && !compact;
    const time = socialFormatChatTime(msg.created_at || "");
    const accent = socialColorForSender(senderKey || msg.sender_nick || (msg.is_mine ? (me?.actor_key || "me") : ""));
    const accentStyle = accent ? `style="--tg-user-accent: ${accent};"` : "";
    const avatar = !msg.is_mine && !compact
      ? `<div class="tg-msg-avatar">${socialAvatarMarkup(msg.sender_avatar, msg.sender_nick || "-", "xs")}</div>`
      : `<div class="tg-msg-avatar placeholder"></div>`;
    const rowClass = `tg-msg-row ${msg.is_mine ? "mine" : "in"}${compact ? " compact" : ""}`;
    const reply = msg.reply_to && Number(msg.reply_to.id || 0) > 0
      ? `
        <div class="tg-msg-reply" onclick="socialSetReplyById(${Number(msg.reply_to.id || 0)})">
          <b>${escapeHtml(String(msg.reply_to.sender_nick || "-"))}</b>
          <span>${escapeHtml(String(msg.reply_to.text || "").slice(0, 200))}</span>
        </div>
      `
      : "";
    const attachments = socialMessageAttachmentsHtml(msg);
    const reactions = socialMessageReactionsHtml(msg);
    const statusDot = socialMessageStatusDotHtml(msg);
    return `
      ${dateBlock}
      <div class="${rowClass}" ${accentStyle}>
        ${msg.is_mine ? "" : avatar}
        <div class="tg-msg-bubble" oncontextmenu="socialOpenMessageContext(${Number(msg.id || 0)}, event)" ondblclick="socialSetReplyById(${Number(msg.id || 0)})">
          ${showName ? `<div class="tg-msg-name">${escapeHtml(msg.sender_nick || "-")}</div>` : ""}
          ${reply}
          <div class="tg-msg-text">${escapeHtml(msg.text || "")}</div>
          ${attachments}
          ${reactions}
          <div class="tg-msg-time">${statusDot}${escapeHtml(time)}</div>
        </div>
      </div>
    `;
  }).join("");
  host.innerHTML = `
    <div class="social-chat-load">${loadMoreBtn}</div>
    ${messagesHtml}
  `;
  if (keepOffset) {
    const nextScroll = host.scrollHeight - prevScrollHeight + prevScrollTop;
    host.scrollTop = Math.max(0, nextScroll);
  } else if (forceBottom || wasAtBottom) {
    host.scrollTop = host.scrollHeight;
  }
  socialRenderReplyBar();
}

async function socialLoadMessages(threadId, opts = {}) {
  const signatureOf = (rows) => rows.map((row) => {
    const reactions = Array.isArray(row?.reactions)
      ? row.reactions.map((rx) => `${String(rx?.emoji || "")}:${Number(rx?.count || 0)}:${rx?.my ? 1 : 0}`).join(",")
      : "";
    const attachments = Array.isArray(row?.attachments)
      ? row.attachments.map((att) => `${String(att?.name || "")}:${String(att?.url || "")}:${String(att?.content_type || "")}`).join(",")
      : "";
    return [
      Number(row?.id || 0),
      String(row?.created_at || ""),
      String(row?.sender_key || ""),
      String(row?.sender_avatar || ""),
      Number(row?.reply_to_id || 0),
      String(row?.text || ""),
      String(row?.delivery_status || ""),
      Number(row?.delivery_read_by || 0),
      Number(row?.delivery_total || 0),
      reactions,
      attachments,
    ].join("|");
  }).join(";");
  const id = Number(threadId || socialState.currentThreadId || 0);
  if (!id) return;
  const beforeId = Number(opts.beforeId || 0);
  if (!beforeId) {
    const inflight = socialState.chatMessagesInflightByThread?.[id];
    if (inflight) {
      await inflight.catch(() => null);
      const hostNode = document.getElementById("socialChatMessages");
      const mustEnsureVisible = Boolean(opts.ensureVisible);
      if (mustEnsureVisible && !socialHasRenderedMessages(hostNode) && !opts.__retryAfterInflight) {
        await socialLoadMessages(id, {
          ...opts,
          silent: true,
          bypassUnchanged: true,
          forceBottom: true,
          ensureVisible: false,
          __retryAfterInflight: true,
        });
      }
      if (opts.forceBottom) {
        if (hostNode) hostNode.scrollTop = hostNode.scrollHeight;
      }
      return;
    }
  }
  const requestSeq = !beforeId
    ? (Number(socialState.chatMessagesRequestSeqByThread?.[id] || 0) + 1)
    : 0;
  if (!beforeId) socialState.chatMessagesRequestSeqByThread[id] = requestSeq;
  socialState.loadingMessagesThreadId = id;
  const runLoad = async () => {
  try {
  const limit = Number(opts.limit || 80);
  const host = document.getElementById("socialChatMessages");
  const prevScrollHeight = host ? host.scrollHeight : 0;
  const prevScrollTop = host ? host.scrollTop : 0;
  const atBottom = host ? (host.scrollHeight - host.scrollTop - host.clientHeight < 40) : true;
  const hasRenderedMessages = socialHasRenderedMessages(host);
  const rows = await socialRequest(`/api/social/chat/messages/${id}?limit=${limit}${beforeId ? `&before_id=${beforeId}` : ""}`).catch((e) => {
    if (!opts.silent && e?.message) alert(e.message);
    return null;
  });
  if (!Array.isArray(rows)) {
    if (!beforeId && Number(socialState.currentThreadId || 0) === id) {
      socialState.chatMessages = [];
      socialState.chatMessagesSignatureByThread[id] = "";
      socialState.chatOldestId = 0;
      socialState.chatHasMore = true;
      if (host) {
        host.innerHTML = `<div class="hint social-chat-error">${escapeHtml(tr("Не удалось загрузить сообщения. Потяните вниз или откройте чат снова.", "Failed to load messages. Pull to refresh or reopen the chat."))}</div>`;
      }
    }
    return;
  }
  const currentThread = (socialState.chatThreads || []).find((x) => Number(x?.id || 0) === id) || null;
  const expectedLastId = Number(currentThread?.last_message?.id || 0);
  const emptyRetryCount = Number(opts.__retryOnEmptyCount || 0);
  const emptyRetryLimit = expectedLastId > 0 ? 4 : (opts.ensureVisible ? 3 : 0);
  if (!beforeId && !rows.length && emptyRetryCount < emptyRetryLimit) {
    await new Promise((resolve) => setTimeout(resolve, 180 * (emptyRetryCount + 1)));
    await socialLoadMessages(id, {
      ...opts,
      silent: true,
      bypassUnchanged: true,
      forceBottom: true,
      __retryOnEmptyCount: emptyRetryCount + 1,
    });
    return;
  }
  if (!beforeId && Number(socialState.chatMessagesRequestSeqByThread?.[id] || 0) !== requestSeq) return;
  const prevSig = String(socialState.chatMessagesSignatureByThread?.[id] || "");
  const nextSig = signatureOf(rows);
  const unchanged = !beforeId
    && opts.silent
    && !opts.bypassUnchanged
    && nextSig === prevSig
    && !opts.forceBottom
    && hasRenderedMessages;
  if (beforeId) {
    socialState.chatMessages = [...rows, ...(socialState.chatMessages || [])];
  } else {
    socialState.chatMessages = rows;
  }
  socialState.chatMessagesSignatureByThread[id] = beforeId
    ? signatureOf(socialState.chatMessages || [])
    : nextSig;
  socialState.chatOldestId = socialState.chatMessages.length ? Number(socialState.chatMessages[0].id || 0) : 0;
  socialState.chatHasMore = rows.length >= limit;
  if (unchanged) return;
  socialRenderChatMessages({
    keepOffset: Boolean(beforeId),
    prevScrollHeight,
    prevScrollTop,
    wasAtBottom: atBottom,
    forceBottom: Boolean(opts.forceBottom),
  });
  } finally {
    // keep existing finally semantics inside wrapper
  }
  };
  const runPromise = runLoad();
  if (!beforeId) socialState.chatMessagesInflightByThread[id] = runPromise;
  try {
    await runPromise;
  } finally {
    if (!beforeId && socialState.chatMessagesInflightByThread?.[id] === runPromise) {
      delete socialState.chatMessagesInflightByThread[id];
    }
    if (Number(socialState.loadingMessagesThreadId || 0) === id) {
      socialState.loadingMessagesThreadId = 0;
    }
  }
}

function socialLoadOlderMessages() {
  if (!socialState.chatOldestId || !socialState.chatHasMore) return;
  socialLoadMessages(socialState.currentThreadId, { beforeId: socialState.chatOldestId, append: true, silent: true });
}

async function socialSendMessage() {
  const threadId = Number(socialState.currentThreadId || 0);
  if (!threadId || socialState.sendingMessage) return;
  const input = document.getElementById("socialChatInput");
  if (!input) return;
  const text = String(input.value || "").trim();
  const replyId = Number(socialState.chatReplyTo?.id || 0) || null;
  if (!text) return;
  socialState.sendingMessage = true;
  const localNow = new Date().toISOString();
  const localId = -Math.max(1, Date.now());
  const optimisticReply = replyId > 0
    ? {
        id: replyId,
        sender_nick: String(socialState.chatReplyTo?.sender_nick || "-"),
        text: String(socialState.chatReplyTo?.text || ""),
      }
    : null;
  const optimisticRow = {
    id: localId,
    text,
    is_mine: true,
    sender_key: String(me?.actor_key || "me"),
    sender_nick: String(me?.nick || me?.email || "Me"),
    sender_avatar: String(me?.avatar_url || ""),
    created_at: localNow,
    updated_at: localNow,
    attachments: [],
    reactions: [],
    reply_to: optimisticReply,
    delivery_status: "sending",
    delivery_read_by: 0,
    delivery_total: 0,
  };
  const sendMessageOnce = () => socialRequest(`/api/social/chat/messages/${threadId}`, {
    method: "POST",
    body: JSON.stringify({ text, reply_to_message_id: replyId }),
    retryOnPost: true,
    maxRetries: 2,
    retryBaseDelayMs: 350,
    timeoutMs: 45000,
  });
  const isMineByText = () => {
    const needle = String(text || "").trim();
    if (!needle) return false;
    return (socialState.chatMessages || []).some((row) => {
      if (!row || !row.is_mine) return false;
      return String(row.text || "").trim() === needle;
    });
  };
  try {
    socialState.chatMessages = [...(socialState.chatMessages || []), optimisticRow];
    socialRenderChatMessages({ forceBottom: true });
    input.value = "";
    socialClearReply();
    let data = await sendMessageOnce().catch((e) => e);
    if (data instanceof Error) {
      socialState.chatMessages = (socialState.chatMessages || []).map((row) => {
        if (Number(row?.id || 0) !== localId) return row;
        return {
          ...row,
          delivery_status: "failed",
          _local_delivery_status: "failed",
        };
      });
      socialRenderChatMessages({ forceBottom: true });
      if (typeof isNetworkError === "function" && isNetworkError(data)) {
        await delay(220);
        await socialLoadMessages(threadId, { silent: true, forceBottom: true });
        if (isMineByText()) {
          socialState.chatMessages = (socialState.chatMessages || []).filter((row) => Number(row?.id || 0) !== localId);
          socialLoadThreads({ silent: true }).catch(() => null);
          return;
        }
      }
      alert(data.message || tr("Ошибка отправки сообщения", "Failed to send message"));
      return;
    }
    if (!data) {
      socialState.chatMessages = (socialState.chatMessages || []).map((row) => {
        if (Number(row?.id || 0) !== localId) return row;
        return {
          ...row,
          delivery_status: "failed",
          _local_delivery_status: "failed",
        };
      });
      socialRenderChatMessages({ forceBottom: true });
      return;
    }
    socialState.chatMessages = (socialState.chatMessages || []).map((row) => {
      if (Number(row?.id || 0) !== localId) return row;
      return data;
    });
    socialRenderChatMessages({ forceBottom: true });
    socialLoadMessages(threadId, { silent: true, forceBottom: true }).catch(() => null);
    socialLoadThreads({ silent: true }).catch(() => null);
  } finally {
    socialState.sendingMessage = false;
  }
}

function socialTriggerChatFileDialog() {
  if (socialState.fileUploadInFlight) return;
  const input = document.getElementById("socialChatFileInput");
  if (!input) return;
  input.click();
}

async function socialUploadChatFiles(fileList) {
  const threadId = Number(socialState.currentThreadId || 0);
  const files = Array.from(fileList || []);
  if (!threadId || !files.length || socialState.fileUploadInFlight) return;
  socialState.fileUploadInFlight = true;
  const input = document.getElementById("socialChatFileInput");
  const attachBtn = document.getElementById("socialAttachBtn");
  if (attachBtn) attachBtn.disabled = true;
  const textInput = document.getElementById("socialChatInput");
  const text = String(textInput?.value || "").trim();
  const replyId = Number(socialState.chatReplyTo?.id || 0) || null;
  if (textInput) textInput.value = "";
  try {
    for (const file of files) {
      const fingerprint = socialBuildFileUploadFingerprint(file, threadId, text, replyId || 0);
      const requestId = socialGetUploadRequestId(fingerprint);
      const form = new FormData();
      form.append("file", file);
      if (text) form.append("text", text);
      if (replyId) form.append("reply_to_message_id", String(replyId));
      const row = await socialRequest(`/api/social/chat/messages/${threadId}/files`, {
        method: "POST",
        body: form,
        headers: { "X-Request-ID": requestId },
        retryOnPost: true,
        maxRetries: 1,
      }).catch((e) => {
        alert(e?.message || tr("Ошибка загрузки файла", "File upload error"));
        return null;
      });
      if (!row) {
        await socialLoadMessages(threadId, { silent: true });
        continue;
      }
    }
    socialClearReply();
    if (input) input.value = "";
    await socialLoadMessages(threadId, { silent: true });
    await socialLoadThreads({ silent: true });
  } finally {
    socialState.fileUploadInFlight = false;
    if (attachBtn) attachBtn.disabled = false;
  }
}

async function socialOpenDirectPicker() {
  socialOpenModal(
    tr("Личный чат", "Direct chat"),
    `
      <div class="grid-2">
        <input id="socialDirectSearch" placeholder="${tr("Поиск по email", "Search by email")}" oninput="socialFilterDirectActors()" />
        <button type="button" onclick="socialFilterDirectActors()">${tr("Найти", "Search")}</button>
      </div>
      <div class="hint">${tr("Другие компании доступны через поиск по email.", "Other companies appear only via email search.")}</div>
      <div id="socialDirectActors" class="social-direct-list"></div>
    `
  );
  socialLoadDirectActors("");
}

function socialCompanyActors() {
  const rows = Array.isArray(socialState.boot?.company_actors) ? socialState.boot.company_actors : [];
  const myKey = String(socialState.boot?.actor?.actor_key || "");
  const dedupe = new Set();
  const out = [];
  for (const row of rows) {
    const actorKey = String(row?.actor_key || "").trim();
    if (!actorKey || dedupe.has(actorKey)) continue;
    dedupe.add(actorKey);
    out.push({
      actor_key: actorKey,
      nick: String(row?.nick || actorKey).trim() || actorKey,
      is_owner: Boolean(row?.is_owner),
      is_me: actorKey === myKey,
    });
  }
  if (!out.some((x) => x.is_me) && myKey) {
    out.unshift({ actor_key: myKey, nick: String(socialState.boot?.actor?.nick || "Me"), is_owner: false, is_me: true });
  }
  return out;
}

function socialCurrentGroupThread() {
  const thread = socialGetCurrentThread();
  if (!thread || String(thread.kind || "") !== "group") return null;
  return thread;
}

function socialOpenGroupEditor(editCurrent = false) {
  const editing = Boolean(editCurrent);
  const thread = editing ? socialCurrentGroupThread() : null;
  if (editing && !thread) {
    alert(tr("Сначала откройте групповой чат.", "Open a group chat first."));
    return;
  }
  const actors = socialCompanyActors();
  const initialMembers = thread && Array.isArray(thread.participants)
    ? thread.participants.map((x) => String(x.actor_key || "").trim()).filter(Boolean)
    : [String(socialState.boot?.actor?.actor_key || "")];
  const checked = new Set(initialMembers);
  const myKey = String(socialState.boot?.actor?.actor_key || "");
  if (myKey) checked.add(myKey);
  const avatarCurrent = String(thread?.avatar_url || "").trim();
  const pickerHtml = (typeof GROUP_AVATARS !== "undefined" ? GROUP_AVATARS : [])
    .map((url) => `<button type="button" class="avatar-chip ${url === avatarCurrent ? "active" : ""}" data-group-avatar="${escapeHtml(url)}"><img src="${escapeHtml(url)}" alt="avatar" /></button>`)
    .join("");
  const membersHtml = actors.map((row) => {
    const actorKey = String(row.actor_key || "");
    const isMe = actorKey === myKey;
    const disabled = isMe ? "disabled" : "";
    const forceChecked = checked.has(actorKey) || isMe;
    return `
      <label class="check">
        <input type="checkbox" data-group-member="${escapeHtml(actorKey)}" ${forceChecked ? "checked" : ""} ${disabled} />
        ${escapeHtml(row.nick || actorKey)}${isMe ? ` (${escapeHtml(tr("вы", "you"))})` : ""}
      </label>
    `;
  }).join("");
  socialOpenModal(
    editing ? tr("Управление группой", "Manage group") : tr("Новая группа", "New group"),
    `
      <div class="social-group-editor">
        <label>
          <span>${tr("Название группы", "Group title")}</span>
          <input id="socialGroupTitleInput" value="${escapeHtml(String(thread?.title || "").trim())}" placeholder="${escapeHtml(tr("Введите название", "Enter title"))}" />
        </label>
        <label>
          <span>${tr("Аватар группы", "Group avatar")}</span>
          <input id="socialGroupAvatarInput" value="${escapeHtml(avatarCurrent)}" placeholder="https://..." />
          <div id="socialGroupAvatarPreset" class="avatar-picker">${pickerHtml}</div>
        </label>
        <div class="social-group-members">
          <div class="hint">${tr("Участники (только сотрудники текущей компании)", "Members (current company only)")}</div>
          <div class="social-group-members-list">${membersHtml}</div>
        </div>
        <div class="actions">
          <button type="button" onclick="socialSaveGroupEditor(${editing ? Number(thread.id || 0) : 0})">${editing ? tr("Сохранить", "Save") : tr("Создать группу", "Create group")}</button>
        </div>
      </div>
    `
  );
  document.querySelectorAll("[data-group-avatar]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const url = String(btn.getAttribute("data-group-avatar") || "").trim();
      const input = document.getElementById("socialGroupAvatarInput");
      if (input) input.value = url;
      document.querySelectorAll("[data-group-avatar]").forEach((x) => {
        x.classList.toggle("active", x === btn);
      });
    });
  });
}

async function socialSaveGroupEditor(threadId = 0) {
  const title = String(document.getElementById("socialGroupTitleInput")?.value || "").trim();
  const avatar_url = String(document.getElementById("socialGroupAvatarInput")?.value || "").trim();
  const member_keys = [...document.querySelectorAll("[data-group-member]")]
    .filter((el) => el.checked)
    .map((el) => String(el.getAttribute("data-group-member") || "").trim())
    .filter(Boolean);
  if (title.length < 2) {
    alert(tr("Введите название группы.", "Enter group title."));
    return;
  }
  if (member_keys.length < 2) {
    alert(tr("Добавьте минимум двух участников.", "Add at least two members."));
    return;
  }
  const isEdit = Number(threadId || 0) > 0;
  const endpoint = isEdit
    ? `/api/social/chat/groups/${Number(threadId || 0)}`
    : "/api/social/chat/groups";
  const method = isEdit ? "PUT" : "POST";
  const row = await socialRequest(endpoint, {
    method,
    body: JSON.stringify({ title, avatar_url, member_keys }),
    retryOnPost: true,
    maxRetries: 1,
  }).catch((e) => {
    alert(e?.message || tr("Ошибка сохранения группы", "Failed to save group"));
    return null;
  });
  if (!row) return;
  socialCloseModal();
  await socialLoadThreads({ silent: true });
  if (Number(row.id || 0)) {
    await socialSelectThread(Number(row.id || 0));
  }
}

let socialDirectSearchTimer = null;

async function socialLoadDirectActors(query) {
  const q = String(query || "").trim();
  const host = document.getElementById("socialDirectActors");
  if (!host) return;
  const endpoint = q ? `/api/social/chat/actors?q=${encodeURIComponent(q)}` : "/api/social/chat/actors";
  const actors = await socialRequest(endpoint).catch((e) => {
    host.innerHTML = `<div class="hint">${escapeHtml(e.message || tr("Ошибка загрузки", "Loading error"))}</div>`;
    return [];
  });
  if (!Array.isArray(actors)) return;
  const myActor = socialState.boot?.actor?.actor_key || "";
  socialState.chatActors = actors.filter((x) => String(x.actor_key || "") !== String(myActor || ""));
  const rows = socialState.chatActors;
  host.innerHTML = rows.map((row) => `
    <button class="social-direct-row" type="button" onclick="socialStartDirectChat('${escapeHtml(String(row.actor_key || ""))}')">
      <div class="social-direct-avatar">${socialAvatarMarkup(row.avatar_url, row.nick || "-", "xs")}</div>
      <div class="social-direct-info">
        <b>${escapeHtml(row.nick || "-")}</b>
        <small>${escapeHtml(row.company || "")}</small>
      </div>
    </button>
  `).join("") || `<div class="hint">${tr("Никого не найдено", "No users found")}</div>`;
}

function socialFilterDirectActors() {
  const q = String(document.getElementById("socialDirectSearch")?.value || "");
  if (socialDirectSearchTimer) clearTimeout(socialDirectSearchTimer);
  socialDirectSearchTimer = setTimeout(() => {
    socialLoadDirectActors(q);
  }, 240);
}

async function socialStartDirectChat(actorKey) {
  const key = String(actorKey || "").trim();
  if (!key) return;
  const thread = await socialRequest("/api/social/chat/direct", {
    method: "POST",
    body: JSON.stringify({ actor_key: key }),
  }).catch((e) => {
    alert(e.message);
    return null;
  });
  if (!thread) return;
  socialCloseModal();
  await socialLoadThreads({ silent: true });
  await socialSelectThread(Number(thread.id || 0));
}

async function socialLoadTaskActors() {
  const rows = await socialRequest("/api/social/tasks/actors").catch(() => []);
  socialState.actors = Array.isArray(rows) ? rows : [];
}

async function socialLoadProjects() {
  const rows = await socialRequest("/api/social/tasks/projects").catch((e) => {
    alert(e.message);
    return [];
  });
  socialState.projects = Array.isArray(rows) ? rows : [];
  const select = document.getElementById("socialTaskProjectFilter");
  if (!select) return;
  const keep = String(select.value || "");
  select.innerHTML = `<option value="">${tr("Все проекты", "All projects")}</option>${socialState.projects.map((p) => `<option value="${Number(p.id)}">${escapeHtml(p.title || "-")}</option>`).join("")}`;
  if ([...select.options].some((x) => x.value === keep)) select.value = keep;
}

async function socialLoadTasks() {
  const projectId = document.getElementById("socialTaskProjectFilter")?.value || "";
  const status = document.getElementById("socialTaskStatusFilter")?.value || "";
  const qp = new URLSearchParams();
  if (projectId) qp.set("project_id", projectId);
  if (status) qp.set("status", status);
  const rows = await socialRequest(`/api/social/tasks${qp.toString() ? `?${qp.toString()}` : ""}`).catch((e) => {
    alert(e.message);
    return [];
  });
  socialState.tasks = Array.isArray(rows) ? rows : [];
  socialRenderTasks();
}

function socialRenderTasks() {
  const host = document.getElementById("socialTasksBoard");
  if (!host) return;
  const rows = socialState.tasks || [];
  const myActorKey = String(socialState.boot?.actor?.actor_key || "").trim();
  const isOwner = Boolean(socialState.boot?.actor?.is_owner);
  if (!rows.length) {
    host.innerHTML = `<div class="hint">${tr("Задач пока нет", "No tasks yet")}</div>`;
    return;
  }
  host.innerHTML = `
    <div class="social-task-list">
      ${rows.map((task) => {
        const status = String(task.status || "todo");
        const statusLabel = status === "todo"
          ? tr("Новые", "To do")
          : (status === "in_progress" ? tr("В работе", "In progress") : tr("Готово", "Done"));
        const priority = String(task.priority || "normal");
        const due = task.due_date ? String(task.due_date).slice(0, 10) : "";
        const dueDt = task.due_date ? socialParseDateSafe(String(task.due_date || "")) : null;
        const isDone = status === "done";
        const isOverdue = !isDone && dueDt instanceof Date && !Number.isNaN(dueDt.getTime()) && dueDt.getTime() < Date.now();
        const project = task.project_title || tr("Без проекта", "No project");
        const isMine = myActorKey && String(task.assignee_key || "") === myActorKey;
        const canClose = Boolean(isMine || isOwner);
        const mineBadge = isMine ? `<span class="social-task-tag">${tr("Ваша задача", "Your task")}</span>` : "";
        return `
          <article class="social-task-row ${isMine ? "is-assignee" : ""} ${isDone ? "is-done" : ""} ${isOverdue ? "is-overdue" : ""}" ondblclick="socialOpenTaskModal(${Number(task.id || 0)})">
            <div class="social-task-main">
              <div class="social-task-title">
                <b>${escapeHtml(task.title || "-")}</b>
                ${mineBadge}
                <span class="social-status ${escapeHtml(status)}">${escapeHtml(statusLabel)}</span>
                <span class="social-priority ${escapeHtml(priority)}">${escapeHtml(priority)}</span>
              </div>
              <div class="social-task-meta">
                <span>${escapeHtml(project)}</span>
                <span>${tr("Исполнитель", "Assignee")}: <b>${escapeHtml(task.assignee_nick || "-")}</b></span>
                <span>${due ? `${tr("Дедлайн", "Deadline")}: ${escapeHtml(due)}` : tr("Без дедлайна", "No deadline")}</span>
              </div>
            </div>
            <div class="social-task-actions">
              <button type="button" onclick="socialOpenTaskModal(${Number(task.id || 0)})">${tr("Открыть", "Open")}</button>
              ${status !== "done" && canClose ? `<button class="btn-secondary" type="button" onclick="socialQuickDone(${Number(task.id || 0)})">${tr("Закрыть", "Done")}</button>` : ""}
            </div>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function socialBuildTaskForm(task = null) {
  const actors = socialState.actors || [];
  const projects = socialState.projects || [];
  const status = task?.status || "todo";
  const due = task?.due_date ? String(task.due_date).slice(0, 16) : "";
  return `
    <div class="grid-2">
      <label><span>${tr("Название", "Title")}</span><input id="socialTaskTitle" value="${escapeHtml(task?.title || "")}" /></label>
      <label><span>${tr("Проект", "Project")}</span><select id="socialTaskProject"><option value="">${tr("Без проекта", "No project")}</option>${projects.map((p) => `<option value="${Number(p.id)}" ${Number(task?.project_id || 0) === Number(p.id) ? "selected" : ""}>${escapeHtml(p.title || "-")}</option>`).join("")}</select></label>
      <label><span>${tr("Исполнитель", "Assignee")}</span><select id="socialTaskAssignee">${actors.map((a) => `<option value="${escapeHtml(String(a.actor_key || ""))}" ${String(task?.assignee_key || "") === String(a.actor_key || "") ? "selected" : ""}>${escapeHtml(a.nick || "-")}</option>`).join("")}</select></label>
      <label><span>${tr("Приоритет", "Priority")}</span><select id="socialTaskPriority"><option value="low" ${task?.priority === "low" ? "selected" : ""}>low</option><option value="normal" ${task?.priority === "normal" || !task ? "selected" : ""}>normal</option><option value="high" ${task?.priority === "high" ? "selected" : ""}>high</option><option value="critical" ${task?.priority === "critical" ? "selected" : ""}>critical</option></select></label>
      <label><span>${tr("Статус", "Status")}</span><select id="socialTaskStatus"><option value="todo" ${status === "todo" ? "selected" : ""}>todo</option><option value="in_progress" ${status === "in_progress" ? "selected" : ""}>in_progress</option><option value="done" ${status === "done" ? "selected" : ""}>done</option></select></label>
      <label><span>${tr("Дедлайн", "Deadline")}</span><input id="socialTaskDue" type="datetime-local" value="${escapeHtml(due)}" /></label>
      <label class="full"><span>${tr("Описание", "Description")}</span><textarea id="socialTaskDescription" rows="5">${escapeHtml(task?.description || "")}</textarea></label>
    </div>
  `;
}

function socialOpenProjectModal() {
  socialOpenModal(
    tr("Новый проект", "New project"),
    `
      <div class="grid-1">
        <input id="socialProjectTitle" placeholder="${tr("Название проекта", "Project title")}" />
        <textarea id="socialProjectDescription" rows="4" placeholder="${tr("Описание", "Description")}"></textarea>
      </div>
      <div class="actions">
        <button type="button" onclick="socialCreateProject()">${tr("Создать", "Create")}</button>
      </div>
    `
  );
}

async function socialCreateProject() {
  const title = String(document.getElementById("socialProjectTitle")?.value || "").trim();
  const description = String(document.getElementById("socialProjectDescription")?.value || "").trim();
  if (!title) return alert(tr("Укажите название проекта", "Enter project title"));
  await socialRequest("/api/social/tasks/projects", {
    method: "POST",
    body: JSON.stringify({ title, description }),
  }).catch((e) => alert(e.message));
  socialCloseModal();
  await socialLoadProjects();
}

function socialOpenTaskModal(taskId = 0) {
  const task = socialState.tasks.find((x) => Number(x.id) === Number(taskId || 0)) || null;
  const comments = Array.isArray(task?.comments) ? task.comments : [];
  socialOpenModal(
    task ? tr("Редактировать задачу", "Edit task") : tr("Новая задача", "New task"),
    `
      ${socialBuildTaskForm(task)}
      ${task ? `<div class="social-task-comments"><h4>${tr("Комментарии", "Comments")}</h4>${comments.map((c) => `<div class="social-task-comment"><b>${escapeHtml(c.author_nick || "-")}</b><small>${escapeHtml((c.created_at || "").slice(0,16).replace("T"," "))}</small><div>${escapeHtml(c.text || "")}</div></div>`).join("") || `<div class="hint">${tr("Комментариев пока нет", "No comments yet")}</div>`}<div class="grid-2"><input id="socialTaskCommentInput" placeholder="${tr("Комментарий", "Comment")}" /><button type="button" onclick="socialAddTaskComment(${Number(task.id)})">${tr("Добавить", "Add")}</button></div></div>` : ""}
      <div class="actions">
        <button type="button" onclick="socialSaveTask(${task ? Number(task.id) : 0})">${task ? tr("Сохранить", "Save") : tr("Создать", "Create")}</button>
      </div>
    `
  );
}

async function socialSaveTask(taskId = 0) {
  const payload = {
    project_id: Number(document.getElementById("socialTaskProject")?.value || 0) || null,
    title: String(document.getElementById("socialTaskTitle")?.value || "").trim(),
    description: String(document.getElementById("socialTaskDescription")?.value || "").trim(),
    status: String(document.getElementById("socialTaskStatus")?.value || "todo"),
    priority: String(document.getElementById("socialTaskPriority")?.value || "normal"),
    due_date: String(document.getElementById("socialTaskDue")?.value || "").trim() || null,
    assignee_key: String(document.getElementById("socialTaskAssignee")?.value || "").trim(),
  };
  if (!payload.title) return alert(tr("Название задачи обязательно", "Task title is required"));
  const req = taskId > 0
    ? socialRequest(`/api/social/tasks/${Number(taskId)}`, { method: "PUT", body: JSON.stringify(payload) })
    : socialRequest("/api/social/tasks", { method: "POST", body: JSON.stringify(payload) });
  await req.catch((e) => alert(e.message));
  socialCloseModal();
  await socialLoadTasks();
}

async function socialAddTaskComment(taskId) {
  const id = Number(taskId || 0);
  if (!id) return;
  const input = document.getElementById("socialTaskCommentInput");
  const text = String(input?.value || "").trim();
  if (!text) return;
  await socialRequest(`/api/social/tasks/${id}/comments`, {
    method: "POST",
    body: JSON.stringify({ text }),
  }).catch((e) => alert(e.message));
  await socialLoadTasks();
  socialOpenTaskModal(id);
}

async function socialQuickDone(taskId) {
  const id = Number(taskId || 0);
  if (!id) return;
  const row = (socialState.tasks || []).find((x) => Number(x.id || 0) === id) || null;
  if (!row) return;
  const myActorKey = String(socialState.boot?.actor?.actor_key || "").trim();
  const isOwner = Boolean(socialState.boot?.actor?.is_owner);
  const isMine = myActorKey && String(row.assignee_key || "") === myActorKey;
  if (!isOwner && !isMine) {
    alert(tr("Сотрудник может закрывать только свои задачи.", "Employee can close only own tasks."));
    return;
  }
  await socialRequest(`/api/social/tasks/${id}`, {
    method: "PUT",
    body: JSON.stringify({ status: "done" }),
  }).catch((e) => alert(e.message));
  await socialLoadTasks();
}

async function socialLoadGoogleCalendarStatus() {
  const statusNode = document.getElementById("socialCalendarGoogleStatus");
  const connectBtn = document.getElementById("socialCalendarGoogleConnectBtn");
  const query = new URLSearchParams(window.location.search || "");
  const oauthConnected = String(query.get("google_oauth_connected") || "") === "1";
  const oauthError = String(query.get("google_oauth_error") || "").trim();
  if (oauthConnected || oauthError) {
    if (oauthConnected) {
      alert(tr("Google Calendar успешно подключен.", "Google Calendar connected successfully."));
    } else if (oauthError) {
      alert(`${tr("Ошибка Google OAuth", "Google OAuth error")}: ${oauthError}`);
    }
    query.delete("google_oauth_connected");
    query.delete("google_oauth_error");
    const nextSearch = query.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash || ""}`;
    window.history.replaceState({}, document.title, nextUrl);
  }
  const data = await socialRequest("/api/social/calendar/google-oauth/status", { timeoutMs: 12000 }).catch(() => null);
  socialState.googleCalendarOauth = data && typeof data === "object" ? data : null;
  const connected = Boolean(socialState.googleCalendarOauth?.connected);
  const expiresAt = Number(socialState.googleCalendarOauth?.expires_at || 0);
  const expiresText = (expiresAt > 0)
    ? new Date(expiresAt * 1000).toLocaleString()
    : "";
  if (statusNode) {
    statusNode.textContent = connected
      ? tr(
        `Google Calendar подключен${expiresText ? ` (токен до ${expiresText})` : ""}. Можно синхронизировать без ICS-ссылки.`,
        `Google Calendar is connected${expiresText ? ` (token valid until ${expiresText})` : ""}. Sync can run without ICS URL.`
      )
      : tr("Google Calendar не подключен. Нажмите «Подключить Google».", "Google Calendar is not connected. Click Connect Google.");
  }
  if (connectBtn) {
    connectBtn.classList.toggle("btn-success", connected);
    connectBtn.textContent = connected
      ? tr("Переподключить Google", "Reconnect Google")
      : tr("Подключить Google", "Connect Google");
  }
}

async function socialConnectGoogleCalendar() {
  const data = await socialRequest("/api/social/calendar/google-oauth/start", { timeoutMs: 12000 }).catch((e) => {
    alert(e.message || tr("Не удалось запустить Google OAuth.", "Unable to start Google OAuth."));
    return null;
  });
  const url = String(data?.url || "").trim();
  if (!url) {
    alert(tr("Не удалось получить ссылку Google OAuth.", "Unable to obtain Google OAuth URL."));
    return;
  }
  window.location.href = url;
}

async function socialLoadCalendar() {
  const monthInput = document.getElementById("socialCalendarMonth");
  const syncUrlInput = document.getElementById("socialCalendarGoogleIcs");
  if (syncUrlInput && !String(syncUrlInput.value || "").trim()) {
    try {
      syncUrlInput.value = String(localStorage.getItem("social_calendar_google_ics_url") || "").trim();
    } catch (_) {}
  }
  const syncReplace = document.getElementById("socialCalendarGoogleReplace");
  if (syncReplace && !syncReplace.dataset.bound) {
    syncReplace.dataset.bound = "1";
    try {
      syncReplace.checked = localStorage.getItem("social_calendar_google_replace") === "1";
    } catch (_) {}
  }
  if (monthInput && !monthInput.value) {
    const d = socialState.calendarDate;
    monthInput.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  const monthVal = String(monthInput?.value || "");
  if (monthVal) {
    const [y, m] = monthVal.split("-").map((x) => Number(x || 0));
    if (y && m) socialState.calendarDate = new Date(y, m - 1, 1);
  }
  await socialLoadGoogleCalendarStatus();
  const start = new Date(socialState.calendarDate.getFullYear(), socialState.calendarDate.getMonth(), 1);
  const end = new Date(socialState.calendarDate.getFullYear(), socialState.calendarDate.getMonth() + 1, 0, 23, 59, 59);
  const qp = new URLSearchParams({
    date_from: start.toISOString(),
    date_to: end.toISOString(),
  });
  const rows = await socialRequest(`/api/social/calendar/events?${qp.toString()}`).catch((e) => {
    alert(e.message);
    return [];
  });
  socialState.calendarEvents = Array.isArray(rows) ? rows : [];
  socialRenderCalendar();
}

function socialShiftCalendar(deltaMonths = 0) {
  const delta = Number(deltaMonths || 0);
  if (!Number.isFinite(delta) || !delta) return;
  const d = socialState.calendarDate;
  socialState.calendarDate = new Date(d.getFullYear(), d.getMonth() + delta, 1);
  const monthInput = document.getElementById("socialCalendarMonth");
  if (monthInput) {
    monthInput.value = `${socialState.calendarDate.getFullYear()}-${String(socialState.calendarDate.getMonth() + 1).padStart(2, "0")}`;
  }
  socialLoadCalendar();
}

function socialRenderCalendar() {
  const grid = document.getElementById("socialCalendarGrid");
  const list = document.getElementById("socialCalendarEvents");
  if (!grid || !list) return;
  const d = socialState.calendarDate;
  const todayKey = typeof toYmd === "function" ? toYmd(new Date()) : "";
  const year = d.getFullYear();
  const month = d.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const shift = (firstDay.getDay() + 6) % 7;
  const days = lastDay.getDate();
  const compactCalendar = typeof window !== "undefined"
    && window.matchMedia
    && window.matchMedia("(max-width: 980px)").matches;
  const tasksByDay = new Map();
  const myTasksByDay = new Map();
  const myActorKey = String(socialState.boot?.actor?.actor_key || "").trim();
  (socialState.tasks || []).forEach((task) => {
    if (!task.due_date) return;
    const key = String(task.due_date).slice(0, 10);
    if (!tasksByDay.has(key)) tasksByDay.set(key, []);
    tasksByDay.get(key).push(task);
    if (myActorKey && String(task.assignee_key || "") === myActorKey) {
      if (!myTasksByDay.has(key)) myTasksByDay.set(key, []);
      myTasksByDay.get(key).push(task);
    }
  });
  let html = `<div class="social-calendar-row head">${[tr("Пн", "Mon"), tr("Вт", "Tue"), tr("Ср", "Wed"), tr("Чт", "Thu"), tr("Пт", "Fri"), tr("Сб", "Sat"), tr("Вс", "Sun")].map((x) => `<span>${x}</span>`).join("")}</div><div class="social-calendar-cells">`;
  for (let i = 0; i < shift; i += 1) html += `<button class="social-day muted" disabled></button>`;
  for (let day = 1; day <= days; day += 1) {
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const eventsCount = socialState.calendarEvents.filter((e) => String(e.start_at || "").slice(0, 10) === key).length;
    const tasksCount = (tasksByDay.get(key) || []).length;
    const myTasksCount = (myTasksByDay.get(key) || []).length;
    const active = socialState.calendarSelectedDay === key ? "active" : "";
    const isToday = todayKey && key === todayKey ? "today" : "";
    const hasEvents = eventsCount > 0 ? "has-event" : "";
    const hasTasks = tasksCount > 0 ? "has-task" : "";
    const hasMyTasks = myTasksCount > 0 ? "has-my-task" : "";
    const manyMyTasks = myTasksCount > 1 ? "my-task-many" : "";
    const countsHtml = compactCalendar
      ? `<small><span class="calendar-count calendar-events">${eventsCount}</span><span class="calendar-sep">•</span><span class="calendar-count calendar-tasks ${myTasksCount ? "my-task" : ""}">${tasksCount}</span></small>`
      : `<small><span class="calendar-count calendar-events">${eventsCount} ${tr("соб.", "ev.")}</span><span class="calendar-sep">•</span><span class="calendar-count calendar-tasks ${myTasksCount ? "my-task" : ""}">${tasksCount} ${tr("задач", "tasks")}</span></small>`;
    html += `<button class="social-day ${active} ${isToday} ${hasEvents} ${hasTasks} ${hasMyTasks} ${manyMyTasks}" type="button" onclick="socialShowDay('${key}')"><b>${day}</b>${countsHtml}</button>`;
  }
  html += `</div>`;
  grid.innerHTML = html;
  const todayFallback = todayKey && String(todayKey).startsWith(`${year}-${String(month + 1).padStart(2, "0")}-`)
    ? todayKey
    : "";
  const fallback = todayFallback || `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const inMonth = String(socialState.calendarSelectedDay || "").startsWith(`${year}-${String(month + 1).padStart(2, "0")}-`);
  socialShowDay(inMonth ? socialState.calendarSelectedDay : fallback);
}

function socialCleanCalendarDetails(raw) {
  const value = String(raw || "");
  if (!value.trim()) return "";
  const cleaned = value
    .split("\n")
    .filter((line) => !/^\s*\[\[gcal_sync\s+source=[a-f0-9]{16}\s+uid=[^\]\s]+\]\]\s*$/i.test(String(line || "")))
    .join("\n")
    .trim();
  return cleaned;
}

function socialShowDay(dayKey) {
  const list = document.getElementById("socialCalendarEvents");
  if (!list) return;
  socialState.calendarSelectedDay = dayKey;
  const events = socialState.calendarEvents.filter((e) => String(e.start_at || "").slice(0, 10) === dayKey);
  const tasks = (socialState.tasks || []).filter((t) => t.due_date && String(t.due_date).slice(0, 10) === dayKey);
  list.innerHTML = `
    <h4>${escapeHtml(dayKey)}</h4>
    <div class="social-day-events">
      <h5>${tr("События", "Events")}</h5>
      ${events.length ? events.map((e) => `<div class="social-day-item"><b>${escapeHtml(e.title || "-")}</b><small>${escapeHtml(String(e.start_at || "").slice(11,16))}${e.is_public ? ` • ${escapeHtml(tr("Общее", "Public"))}` : ` • ${escapeHtml(tr("Личное", "Private"))}`}</small><div>${escapeHtml(socialCleanCalendarDetails(e.details || ""))}</div><div class="actions"><button type="button" onclick="socialOpenCalendarModal(${Number(e.id)})">${tr("Изменить", "Edit")}</button><button class="btn-danger" type="button" onclick="socialDeleteEvent(${Number(e.id)})">${tr("Удалить", "Delete")}</button></div></div>`).join("") : `<div class="hint">${tr("Нет событий", "No events")}</div>`}
    </div>
    <div class="social-day-events">
      <h5>${tr("Дедлайны задач", "Task deadlines")}</h5>
      ${tasks.length ? tasks.map((t) => `<div class="social-day-item"><b>${escapeHtml(t.title || "-")}</b><small>${escapeHtml(t.assignee_nick || "-")}</small><div>${escapeHtml(t.status || "")}</div></div>`).join("") : `<div class="hint">${tr("Нет задач", "No tasks")}</div>`}
    </div>
  `;
  const grid = document.getElementById("socialCalendarGrid");
  if (grid) {
    grid.querySelectorAll(".social-day").forEach((btn) => {
      const label = btn.querySelector("b");
      if (!label) return;
      const day = String(label.textContent || "").padStart(2, "0");
      const month = String(socialState.calendarDate.getMonth() + 1).padStart(2, "0");
      const year = String(socialState.calendarDate.getFullYear());
      const key = `${year}-${month}-${day}`;
      btn.classList.toggle("active", key === dayKey);
    });
  }
}

const SOCIAL_EMOJI_SETS = {
  business: { label: "Деловые", items: ["👍", "✅", "📌", "📊", "📈", "💼", "🧾", "📎", "✉️", "🤝", "💬", "⏱️"] },
  quick: { label: "Быстрые", items: ["👌", "⚡", "🔥", "💡", "👏", "🙏", "🎯", "💥", "🔔", "🔎", "🧠", "🛠️"] },
  smile: { label: "Эмоции", items: ["🙂", "😀", "😁", "😅", "😊", "😎", "🤗", "😇", "🙌", "😉", "🫡", "🤩"] },
};
let socialEmojiSetKey = "business";

function socialEnsureEmojiPicker() {
  const host = document.getElementById("socialEmojiPicker");
  if (!host || host.childElementCount) return;
  const setEntries = Object.entries(SOCIAL_EMOJI_SETS);
  const setHtml = setEntries.map(([key, meta]) => `
    <button type="button" class="social-emoji-tab ${key === socialEmojiSetKey ? "active" : ""}" onclick="socialSwitchEmojiSet('${key}')">
      ${escapeHtml(meta.label)}
    </button>
  `).join("");
  const items = SOCIAL_EMOJI_SETS[socialEmojiSetKey]?.items || [];
  const itemsHtml = items.map((emoji) => `
    <button type="button" class="social-emoji-item" onclick="socialInsertEmoji('${emoji}')">${emoji}</button>
  `).join("");
  host.innerHTML = `
    <div class="social-emoji-tabs">${setHtml}</div>
    <div class="social-emoji-grid">${itemsHtml}</div>
  `;
}

function socialToggleEmojiPicker(force = null) {
  const host = document.getElementById("socialEmojiPicker");
  if (!host) return;
  socialEnsureEmojiPicker();
  const shouldOpen = force === null ? host.classList.contains("hidden") : Boolean(force);
  host.classList.toggle("hidden", !shouldOpen);
  if (shouldOpen) {
    const input = document.getElementById("socialChatInput");
    if (input) input.focus();
  }
}

function socialSwitchEmojiSet(key) {
  if (!SOCIAL_EMOJI_SETS[key]) return;
  socialState.keepEmojiOpenUntil = Date.now() + 220;
  socialEmojiSetKey = key;
  const host = document.getElementById("socialEmojiPicker");
  if (!host) return;
  host.innerHTML = "";
  socialEnsureEmojiPicker();
}

function socialInsertEmoji(emoji) {
  const input = document.getElementById("socialChatInput");
  if (!input) return;
  const value = String(input.value || "");
  const start = Number(input.selectionStart || value.length);
  const end = Number(input.selectionEnd || value.length);
  const next = `${value.slice(0, start)}${emoji}${value.slice(end)}`;
  input.value = next;
  const caret = start + emoji.length;
  input.setSelectionRange(caret, caret);
  input.focus();
  socialToggleEmojiPicker(true);
}

function socialOpenCalendarModal(eventId = 0) {
  const row = socialState.calendarEvents.find((x) => Number(x.id) === Number(eventId || 0)) || null;
  socialOpenModal(
    row ? tr("Изменить событие", "Edit event") : tr("Новое событие", "New event"),
    `
      <div class="grid-2">
        <label><span>${tr("Название", "Title")}</span><input id="socialEventTitle" value="${escapeHtml(row?.title || "")}" /></label>
        <label><span>${tr("Начало", "Start")}</span><input id="socialEventStart" type="datetime-local" value="${escapeHtml(row?.start_at ? String(row.start_at).slice(0,16) : "")}" /></label>
        <label><span>${tr("Конец", "End")}</span><input id="socialEventEnd" type="datetime-local" value="${escapeHtml(row?.end_at ? String(row.end_at).slice(0,16) : "")}" /></label>
        <label class="check"><input id="socialEventPublic" type="checkbox" ${row?.is_public ? "checked" : ""} /> ${tr("Общее событие (видно всем)", "Public event (visible to all)")}</label>
        <label class="full"><span>${tr("Описание", "Details")}</span><textarea id="socialEventDetails" rows="4">${escapeHtml(socialCleanCalendarDetails(row?.details || ""))}</textarea></label>
      </div>
      <div class="actions"><button type="button" onclick="socialSaveEvent(${row ? Number(row.id) : 0})">${row ? tr("Сохранить", "Save") : tr("Создать", "Create")}</button></div>
    `
  );
}

async function socialSaveEvent(eventId = 0) {
  const payload = {
    title: String(document.getElementById("socialEventTitle")?.value || "").trim(),
    details: String(document.getElementById("socialEventDetails")?.value || "").trim(),
    start_at: String(document.getElementById("socialEventStart")?.value || "").trim(),
    end_at: String(document.getElementById("socialEventEnd")?.value || "").trim() || null,
    is_public: Boolean(document.getElementById("socialEventPublic")?.checked),
  };
  if (!payload.title || !payload.start_at) return alert(tr("Заполните название и дату начала", "Fill title and start date"));
  const req = eventId > 0
    ? socialRequest(`/api/social/calendar/events/${Number(eventId)}`, { method: "PUT", body: JSON.stringify(payload) })
    : socialRequest("/api/social/calendar/events", { method: "POST", body: JSON.stringify(payload) });
  await req.catch((e) => alert(e.message));
  socialCloseModal();
  await socialLoadCalendar();
}

async function socialDeleteEvent(eventId) {
  const id = Number(eventId || 0);
  if (!id) return;
  await socialRequest(`/api/social/calendar/events/${id}`, { method: "DELETE" }).catch((e) => alert(e.message));
  await socialLoadCalendar();
}

async function socialSyncGoogleCalendar() {
  const urlInput = document.getElementById("socialCalendarGoogleIcs");
  const replaceInput = document.getElementById("socialCalendarGoogleReplace");
  const url = String(urlInput?.value || "").trim();
  const replaceSource = Boolean(replaceInput?.checked);
  const oauthConnected = Boolean(socialState.googleCalendarOauth?.connected);
  const useIcs = Boolean(url);
  if (!useIcs && !oauthConnected) {
    alert(
      tr(
        "Подключите Google OAuth или вставьте ICS-ссылку календаря.",
        "Connect Google OAuth or paste an ICS calendar URL."
      )
    );
    return;
  }
  if (useIcs) {
    try {
      localStorage.setItem("social_calendar_google_ics_url", url);
      localStorage.setItem("social_calendar_google_replace", replaceSource ? "1" : "0");
    } catch (_) {}
  }
  const data = await socialRequest("/api/social/calendar/google-sync", {
    method: "POST",
    body: JSON.stringify({
      ical_url: useIcs ? url : "",
      is_public: true,
      replace_source_events: replaceSource,
    }),
    timeoutMs: 90000,
    retryOnPost: true,
    maxRetries: 1,
  }).catch((e) => {
    alert(e.message || tr("Не удалось синхронизировать календарь.", "Calendar sync failed."));
    return null;
  });
  if (!data) return;
  const warnings = Array.isArray(data.warnings) ? data.warnings.filter(Boolean) : [];
  const summary = [
    `${tr("Импорт", "Imported")}: ${Number(data.imported || 0)}`,
    `${tr("Обновлено", "Updated")}: ${Number(data.updated || 0)}`,
    `${tr("Удалено", "Deleted")}: ${Number(data.deleted || 0)}`,
    `${tr("Пропущено", "Skipped")}: ${Number(data.skipped || 0)}`,
    `${tr("Источник", "Source")}: ${useIcs ? tr("ICS URL", "ICS URL") : "Google OAuth"}`,
  ];
  if (warnings.length) summary.push(`${tr("Предупреждения", "Warnings")}: ${warnings.join(" | ")}`);
  alert(summary.join("\n"));
  await socialLoadGoogleCalendarStatus();
  await socialLoadCalendar();
}

function socialCalcEvaluate() {
  const expr = String(document.getElementById("socialCalcExpr")?.value || "").trim();
  const out = document.getElementById("socialCalcResult");
  if (!out) return;
  if (!expr) {
    out.textContent = "0";
    return;
  }
  const safe = expr.replace(/\s+/g, "");
  if (!/^[0-9+\-*/().,%]+$/.test(safe)) {
    out.textContent = tr("Недопустимое выражение", "Invalid expression");
    return;
  }
  try {
    // eslint-disable-next-line no-new-func
    const value = Function(`return (${safe.replace(/%/g, "/100")});`)();
    const normalized = Number(value);
    out.textContent = Number.isFinite(normalized)
      ? normalized.toLocaleString("ru-RU", { maximumFractionDigits: 8 })
      : tr("Ошибка вычисления", "Calculation error");
    const input = document.getElementById("socialCalcExpr");
    if (input && Number.isFinite(normalized)) {
      input.value = String(normalized);
    }
  } catch (_) {
    out.textContent = tr("Ошибка вычисления", "Calculation error");
  }
}

function socialCalcPress(value) {
  const input = document.getElementById("socialCalcExpr");
  if (!input) return;
  const next = String(value || "");
  if (!input.value || input.value === "0") {
    input.value = next === "." ? "0." : next;
  } else {
    input.value = `${input.value || ""}${next}`;
  }
}

function socialCalcClear() {
  const input = document.getElementById("socialCalcExpr");
  const out = document.getElementById("socialCalcResult");
  if (input) input.value = "";
  if (out) out.textContent = "0";
}

function socialCalcBackspace() {
  const input = document.getElementById("socialCalcExpr");
  if (!input) return;
  input.value = String(input.value || "").slice(0, -1);
}

function socialCalcToggleSign() {
  const input = document.getElementById("socialCalcExpr");
  if (!input) return;
  const expr = String(input.value || "").trim();
  if (!expr) {
    input.value = "-";
    return;
  }
  const match = expr.match(/(-?\d*\.?\d+)(?!.*\d)/);
  if (!match || match.index === undefined) return;
  const numberText = match[1];
  const toggled = numberText.startsWith("-") ? numberText.slice(1) : `-${numberText}`;
  const start = match.index;
  const end = start + numberText.length;
  input.value = `${expr.slice(0, start)}${toggled}${expr.slice(end)}`;
}

const SOCIAL_CURRENCY_FALLBACK = {
  RUB: 1,
  USD: 77.8009,
  EUR: 90.7458,
  CNY: 11.2488,
  BYN: 26.9291,
  TRY: 1.77099,
  GBP: 103.4908,
  UAH: 1.79039,
};
const SOCIAL_CURRENCY_REFRESH_MS = 2 * 60 * 60 * 1000;

function socialUpdateCurrencyMeta(payload, note = "") {
  const meta = document.getElementById("socialConvRateMeta");
  if (!meta) return;
  if (!payload) {
    meta.textContent = note || "";
    return;
  }
  const date = String(payload.date || "").trim();
  const updated = String(payload.updated_at || "").trim();
  const status = payload.stale ? tr("обновление задерживается", "stale") : tr("обновлено", "updated");
  const stamp = date || (updated ? updated.slice(0, 16).replace("T", " ") : "-");
  meta.textContent = `${tr("Курсы ЦБ", "CBR rates")}: ${stamp} • ${status}${note ? ` • ${note}` : ""}`;
}

async function socialLoadCurrencyRates({ force = false } = {}) {
  if (socialState.currencyRatesLoading) return socialState.currencyRates;
  const now = Date.now();
  if (!force && socialState.currencyRates && (now - socialState.currencyRatesStamp) < SOCIAL_CURRENCY_REFRESH_MS) {
    return socialState.currencyRates;
  }
  if (!socialState.currencyRates) {
    socialUpdateCurrencyMeta(null, tr("Загрузка курсов ЦБ...", "Loading CBR rates..."));
  }
  socialState.currencyRatesLoading = true;
  try {
    const data = await socialRequest("/api/social/currency/rates").catch(() => null);
    if (data && typeof data === "object") {
      socialState.currencyRates = data;
      socialState.currencyRatesStamp = Date.now();
      socialUpdateCurrencyMeta(data);
      return data;
    }
    socialUpdateCurrencyMeta(null, tr("Ошибка загрузки", "Load failed"));
    return null;
  } finally {
    socialState.currencyRatesLoading = false;
  }
}

function socialMaybeStartCurrencyRates() {
  if (socialState.currencyRatesTimer) return;
  socialLoadCurrencyRates().catch(() => null);
  socialState.currencyRatesTimer = setInterval(() => {
    socialLoadCurrencyRates().catch(() => null);
  }, SOCIAL_CURRENCY_REFRESH_MS);
}

function socialRenderConverterOptions() {
  const type = String(document.getElementById("socialConvType")?.value || "currency");
  const from = document.getElementById("socialConvFrom");
  const to = document.getElementById("socialConvTo");
  if (!from || !to) return;
  const packs = {
    currency: ["RUB", "USD", "EUR", "CNY", "BYN", "TRY", "GBP", "UAH"],
    length: ["mm", "cm", "m", "km", "inch", "ft"],
    weight: ["g", "kg", "t", "lb"],
    volume: ["ml", "l", "m3", "cm3"],
  };
  const currencyLabels = {
    RUB: tr("RUB (руб.)", "RUB"),
    USD: "USD",
    EUR: "EUR",
    CNY: "CNY",
    BYN: tr("BYN (бел. руб.)", "BYN (BYN)"),
    TRY: tr("TRY (лира)", "TRY (Lira)"),
    GBP: tr("GBP (фунт)", "GBP (Pound)"),
    UAH: tr("UAH (гривна)", "UAH (Hryvnia)"),
  };
  const options = packs[type] || packs.currency;
  from.innerHTML = options.map((x) => `<option value="${x}">${escapeHtml(currencyLabels[x] || x)}</option>`).join("");
  to.innerHTML = options.map((x) => `<option value="${x}">${escapeHtml(currencyLabels[x] || x)}</option>`).join("");
  if (options.length > 1) to.value = options[1];
  if (type === "currency") {
    socialMaybeStartCurrencyRates();
    socialUpdateCurrencyMeta(socialState.currencyRates);
  } else {
    socialUpdateCurrencyMeta(null, "");
  }
}

function socialConvert() {
  const value = Number(document.getElementById("socialConvValue")?.value || 0);
  const type = String(document.getElementById("socialConvType")?.value || "currency");
  const from = String(document.getElementById("socialConvFrom")?.value || "");
  const to = String(document.getElementById("socialConvTo")?.value || "");
  const out = document.getElementById("socialConvResult");
  if (!out) return;
  if (!Number.isFinite(value)) {
    out.textContent = tr("Введите число", "Enter a number");
    return;
  }
  const liveRates = socialState.currencyRates?.rates && typeof socialState.currencyRates.rates === "object"
    ? socialState.currencyRates.rates
    : {};
  const toBase = {
    currency: { ...SOCIAL_CURRENCY_FALLBACK, ...liveRates },
    length: { mm: 0.001, cm: 0.01, m: 1, km: 1000, inch: 0.0254, ft: 0.3048 },
    weight: { g: 0.001, kg: 1, t: 1000, lb: 0.45359237 },
    volume: { ml: 0.001, l: 1, m3: 1000, cm3: 0.001 },
  };
  const pack = toBase[type] || toBase.currency;
  if (!pack[from] || !pack[to]) {
    out.textContent = tr("Выберите единицы", "Select units");
    return;
  }
  const base = value * pack[from];
  const converted = base / pack[to];
  out.textContent = `${value} ${from} = ${converted.toLocaleString("ru-RU", { maximumFractionDigits: 8 })} ${to}`;
  if (type === "currency" && !socialState.currencyRates) {
    socialMaybeStartCurrencyRates();
  }
}

function socialCalcVolume() {
  const a = Number(document.getElementById("socialVolA")?.value || 0);
  const b = Number(document.getElementById("socialVolB")?.value || 0);
  const c = Number(document.getElementById("socialVolC")?.value || 0);
  const out = document.getElementById("socialVolResult");
  if (!out) return;
  if (![a, b, c].every((n) => Number.isFinite(n) && n > 0)) {
    out.textContent = tr("Введите длину, ширину и высоту", "Enter length, width and height");
    return;
  }
  const cm3 = a * b * c;
  const liters = cm3 / 1000;
  const m3 = cm3 / 1_000_000;
  out.textContent = `${tr("Объем", "Volume")}: ${cm3.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} см³ • ${liters.toLocaleString("ru-RU", { maximumFractionDigits: 3 })} л • ${m3.toLocaleString("ru-RU", { maximumFractionDigits: 6 })} м³`;
}

async function socialLoadNotes() {
  const rows = await socialRequest("/api/social/notes").catch((e) => {
    alert(e.message);
    return [];
  });
  socialState.notes = Array.isArray(rows) ? rows : [];
  if (!socialState.currentNoteId && socialState.notes.length) {
    socialState.currentNoteId = Number(socialState.notes[0].id || 0);
  }
  socialRenderNotesList();
  socialRenderCurrentNote();
}

function socialRenderNotesList() {
  const host = document.getElementById("socialNotesList");
  if (!host) return;
  host.innerHTML = socialState.notes.map((row) => `
    <div class="social-note-row ${Number(row.id) === socialState.currentNoteId ? "active" : ""}">
      <button class="social-note-main" type="button" onclick="socialSelectNote(${Number(row.id)})">
        <b>${escapeHtml(row.title || tr("Без названия", "Untitled"))}</b>
        <small>${escapeHtml(String(row.updated_at || "").slice(0,16).replace("T", " "))}</small>
      </button>
      <button class="btn-secondary social-note-delete" type="button" onclick="socialDeleteNote(${Number(row.id)})">✕</button>
    </div>
  `).join("") || `<div class="hint">${tr("Заметок пока нет", "No notes yet")}</div>`;
}

function socialRenderCurrentNote() {
  const note = socialState.notes.find((x) => Number(x.id) === Number(socialState.currentNoteId || 0)) || null;
  const title = document.getElementById("socialNoteTitle");
  const content = document.getElementById("socialNoteContent");
  if (!title || !content) return;
  title.value = note?.title || "";
  content.value = note?.content || "";
  const autosave = document.getElementById("socialNoteAutosave");
  if (autosave) autosave.textContent = note ? tr("Автосохранение включено", "Autosave enabled") : tr("Выберите заметку", "Select note");
  socialRenderNoteFiles(note);
}

function socialSelectNote(noteId) {
  socialState.currentNoteId = Number(noteId || 0);
  socialRenderNotesList();
  socialRenderCurrentNote();
}

async function socialCreateNote() {
  const row = await socialRequest("/api/social/notes", {
    method: "POST",
    body: JSON.stringify({ title: tr("Новая заметка", "New note"), content: "" }),
  }).catch((e) => {
    alert(e.message);
    return null;
  });
  if (!row) return;
  await socialLoadNotes();
  socialSelectNote(Number(row.id || 0));
}

function socialScheduleNoteSave() {
  if (socialState.noteSaveTimer) clearTimeout(socialState.noteSaveTimer);
  socialState.noteSaveTimer = setTimeout(() => {
    socialSaveCurrentNote().catch(() => null);
  }, 800);
}

async function socialSaveCurrentNote() {
  const noteId = Number(socialState.currentNoteId || 0);
  if (!noteId) return;
  const titleNode = document.getElementById("socialNoteTitle");
  const contentNode = document.getElementById("socialNoteContent");
  const autosave = document.getElementById("socialNoteAutosave");
  const payload = {
    title: String(titleNode?.value || "").trim() || tr("Без названия", "Untitled"),
    content: String(contentNode?.value || ""),
  };
  if (autosave) autosave.textContent = tr("Сохраняем...", "Saving...");
  const saved = await socialRequest(`/api/social/notes/${noteId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }).catch((e) => {
    if (autosave) autosave.textContent = e.message;
    return null;
  });
  if (!saved) return;
  const idx = socialState.notes.findIndex((x) => Number(x.id) === noteId);
  if (idx >= 0) socialState.notes[idx] = saved;
  socialRenderNotesList();
  socialRenderCurrentNote();
  if (autosave) autosave.textContent = tr("Сохранено", "Saved");
}

function socialFormatFileSize(sizeRaw) {
  const size = Math.max(0, Number(sizeRaw || 0));
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function socialRenderNoteFiles(note) {
  const host = document.getElementById("socialNoteFiles");
  const uploader = document.getElementById("socialNoteFileUpload");
  if (!host) return;
  if (!note) {
    host.innerHTML = `<div class="hint">${tr("Файлы будут доступны после выбора заметки", "Files will appear after selecting a note")}</div>`;
    if (uploader) uploader.disabled = true;
    return;
  }
  if (uploader) uploader.disabled = false;
  const files = Array.isArray(note.files) ? note.files : [];
  host.innerHTML = files.length
    ? files.map((file) => `
      <div class="social-note-file-row">
        <a href="${escapeHtml(file.url || "#")}" target="_blank" rel="noopener noreferrer">${escapeHtml(file.filename || "file")}</a>
        <small>${escapeHtml(socialFormatFileSize(file.size_bytes || 0))}</small>
        <button class="btn-secondary" type="button" onclick="socialDeleteNoteFile(${Number(file.id || 0)})">✕</button>
      </div>
    `).join("")
    : `<div class="hint">${tr("Файлы пока не загружены", "No files uploaded yet")}</div>`;
}

function socialTriggerNoteFileDialog() {
  const noteId = Number(socialState.currentNoteId || 0);
  if (!noteId) {
    alert(tr("Сначала выберите заметку", "Select a note first"));
    return;
  }
  const input = document.getElementById("socialNoteFileUpload");
  if (input) input.click();
}

async function socialUploadNoteFiles(fileList) {
  const noteId = Number(socialState.currentNoteId || 0);
  const autosave = document.getElementById("socialNoteAutosave");
  const input = document.getElementById("socialNoteFileUpload");
  const files = Array.from(fileList || []);
  if (!noteId || !files.length) return;
  if (autosave) autosave.textContent = tr("Загружаем файлы...", "Uploading files...");
  try {
    for (const file of files) {
      const body = new FormData();
      body.append("file", file);
      const headers = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      await requestJson(`/api/social/notes/${noteId}/files`, {
        method: "POST",
        headers,
        body,
        timeoutMs: 90000,
        retryOnPost: true,
        maxRetries: 1,
      });
    }
    await socialLoadNotes();
    socialState.currentNoteId = noteId;
    socialRenderNotesList();
    socialRenderCurrentNote();
    if (autosave) autosave.textContent = tr("Файлы загружены", "Files uploaded");
  } catch (e) {
    if (autosave) autosave.textContent = String(e?.message || tr("Ошибка загрузки файла", "File upload error"));
    alert(e?.message || tr("Ошибка загрузки файла", "File upload error"));
  } finally {
    if (input) input.value = "";
  }
}

async function socialDeleteNoteFile(fileId) {
  const id = Number(fileId || 0);
  const noteId = Number(socialState.currentNoteId || 0);
  if (!id || !noteId) return;
  if (!confirm(tr("Удалить файл?", "Delete file?"))) return;
  await socialRequest(`/api/social/notes/${noteId}/files/${id}`, {
    method: "DELETE",
  }).catch((e) => {
    alert(e.message);
    return null;
  });
  await socialLoadNotes();
  socialState.currentNoteId = noteId;
  socialRenderNotesList();
  socialRenderCurrentNote();
}

async function socialDeleteCurrentNote() {
  const noteId = Number(socialState.currentNoteId || 0);
  if (!noteId) return;
  await socialRequest(`/api/social/notes/${noteId}`, { method: "DELETE" }).catch((e) => alert(e.message));
  socialState.currentNoteId = 0;
  await socialLoadNotes();
}

async function socialDeleteNote(noteId) {
  const id = Number(noteId || 0);
  if (!id) return;
  if (!confirm(tr("Удалить заметку?", "Delete note?"))) return;
  await socialRequest(`/api/social/notes/${id}`, { method: "DELETE" }).catch((e) => alert(e.message));
  if (socialState.currentNoteId === id) socialState.currentNoteId = 0;
  await socialLoadNotes();
}

window.loadSocialWorkspace = loadSocialWorkspace;
window.switchSocialSubtab = switchSocialSubtab;
window.socialOpenGameMenu = socialOpenGameMenu;
window.socialShowLeaderboard = socialShowLeaderboard;
window.socialShowGameTips = socialShowGameTips;
window.socialStartGame = socialStartGame;
window.socialGameControl = socialGameControl;
window.socialCloseModal = socialCloseModal;
window.socialGameRetry = socialGameRetry;
window.socialOpenDirectPicker = socialOpenDirectPicker;
window.socialOpenGroupEditor = socialOpenGroupEditor;
window.socialOpenGroupParticipants = socialOpenGroupParticipants;
window.socialOpenCurrentParticipantProfile = socialOpenCurrentParticipantProfile;
window.socialOpenParticipantProfile = socialOpenParticipantProfile;
window.socialSaveGroupEditor = socialSaveGroupEditor;
window.socialFilterDirectActors = socialFilterDirectActors;
window.socialStartDirectChat = socialStartDirectChat;
window.socialSelectThread = socialSelectThread;
window.socialCloseThread = socialCloseThread;
window.socialSendMessage = socialSendMessage;
window.socialTriggerChatFileDialog = socialTriggerChatFileDialog;
window.socialUploadChatFiles = socialUploadChatFiles;
window.socialSetReplyById = socialSetReplyById;
window.socialClearReply = socialClearReply;
window.socialOpenMessageContext = socialOpenMessageContext;
window.socialContextReply = socialContextReply;
window.socialContextReact = socialContextReact;
window.socialToggleReaction = socialToggleReaction;
window.socialLoadOlderMessages = socialLoadOlderMessages;
window.socialOpenGroupAvatarModal = socialOpenGroupAvatarModal;
window.socialOpenProjectModal = socialOpenProjectModal;
window.socialCreateProject = socialCreateProject;
window.socialOpenTaskModal = socialOpenTaskModal;
window.socialSaveTask = socialSaveTask;
window.socialAddTaskComment = socialAddTaskComment;
window.socialQuickDone = socialQuickDone;
window.socialOpenCalendarModal = socialOpenCalendarModal;
window.socialSaveEvent = socialSaveEvent;
window.socialDeleteEvent = socialDeleteEvent;
window.socialShiftCalendar = socialShiftCalendar;
window.socialLoadCalendar = socialLoadCalendar;
window.socialConnectGoogleCalendar = socialConnectGoogleCalendar;
window.socialRenderCalendar = socialRenderCalendar;
window.socialShowDay = socialShowDay;
window.socialSetBell = socialSetBell;
window.socialMarkNotificationsReadAll = socialMarkNotificationsReadAll;
window.socialMaybeStartHooks = socialMaybeStartHooks;
window.socialToggleEmojiPicker = socialToggleEmojiPicker;
window.socialInsertEmoji = socialInsertEmoji;
window.socialSwitchEmojiSet = socialSwitchEmojiSet;
window.socialCalcEvaluate = socialCalcEvaluate;
window.socialCalcPress = socialCalcPress;
window.socialCalcClear = socialCalcClear;
window.socialCalcBackspace = socialCalcBackspace;
window.socialCalcToggleSign = socialCalcToggleSign;
window.socialRenderConverterOptions = socialRenderConverterOptions;
window.socialConvert = socialConvert;
window.socialCalcVolume = socialCalcVolume;
window.socialCreateNote = socialCreateNote;
window.socialSelectNote = socialSelectNote;
window.socialScheduleNoteSave = socialScheduleNoteSave;
window.socialDeleteCurrentNote = socialDeleteCurrentNote;
window.socialDeleteNote = socialDeleteNote;
window.socialTriggerNoteFileDialog = socialTriggerNoteFileDialog;
window.socialUploadNoteFiles = socialUploadNoteFiles;
window.socialDeleteNoteFile = socialDeleteNoteFile;
window.socialStartGlobalHooks = socialStartGlobalHooks;
window.socialStopGlobalHooks = socialStopGlobalHooks;
window.socialSyncMobileChatChrome = socialSyncMobileChatChrome;
window.socialIsThreadOpen = socialIsThreadOpen;
window.resetSocialState = resetSocialState;

document.addEventListener("visibilitychange", () => {
  if (document.hidden) return;
  socialApplySharedPollState();
  socialScheduleNotificationsPoll(true);
});

socialMaybeStartHooks();
