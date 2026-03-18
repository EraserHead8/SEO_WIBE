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
  chatSearchMessageThreadIds: [],
  chatSearchMessageQuery: "",
  chatSearchRequestSeq: 0,
  chatSearchTimer: null,
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
  tasksAll: [],
  tasksCacheKey: "",
  tasksCacheLoadedAt: 0,
  tasksLoadSeq: 0,
  calendarEvents: [],
  calendarTasks: [],
  calendarLastGoodEvents: [],
  calendarLastGoodTasks: [],
  calendarLoadSeq: 0,
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
  calendarAutoSyncInFlight: false,
  sendingMessage: false,
  chatReplyTo: null,
  chatContextMessageId: 0,
  chatContextThreadId: 0,
  chatContextX: 0,
  chatContextY: 0,
  chatImageViewerOpen: false,
  keepEmojiOpenUntil: 0,
  emojiRecents: [],
  mobileThreadAutoSelectEnabled: true,
  pollClientId: `poll-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
  fileUploadInFlight: false,
  chatHeadCollapsed: false,
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
const SOCIAL_CHAT_UPLOAD_MAX_BYTES = 25 * 1024 * 1024;
const SOCIAL_CHAT_IMAGE_TARGET_BYTES = 9 * 1024 * 1024;
const SOCIAL_CHAT_IMAGE_FORCE_TARGET_BYTES = 7 * 1024 * 1024;
const SOCIAL_CHAT_IMAGE_COMPRESS_MIN_BYTES = Math.floor(1.5 * 1024 * 1024);
const SOCIAL_CHAT_IMAGE_MAX_DIMENSION = 2560;
const SOCIAL_CHAT_IMAGE_FORCE_MAX_DIMENSION = 1920;

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

function socialIsImageFile(file) {
  const type = String(file?.type || "").toLowerCase();
  if (type.startsWith("image/")) return true;
  const name = String(file?.name || "").toLowerCase();
  return /\.(jpg|jpeg|png|webp|gif|bmp|heic|heif|avif)$/i.test(name);
}

function socialReplaceFileExtension(name, newExt) {
  const safeName = String(name || "photo").trim() || "photo";
  const ext = String(newExt || "").trim();
  if (!ext) return safeName;
  return safeName.replace(/\.[^.]+$/, "") + ext;
}

function socialCanvasToBlob(canvas, mimeType, quality) {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob || null), mimeType, quality);
    } catch (_) {
      resolve(null);
    }
  });
}

function socialLoadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image_decode_failed"));
    };
    img.src = url;
  });
}

async function socialCompressImageForChat(file, { force = false } = {}) {
  if (!socialIsImageFile(file)) {
    return { file, compressed: false, reason: "not-image" };
  }
  const originalSize = Number(file?.size || 0);
  if (!force && originalSize > 0 && originalSize < SOCIAL_CHAT_IMAGE_COMPRESS_MIN_BYTES) {
    return { file, compressed: false, reason: "small-image" };
  }
  if (typeof document === "undefined") {
    return { file, compressed: false, reason: "no-dom" };
  }
  let image = null;
  try {
    image = await socialLoadImageFromFile(file);
  } catch (_) {
    return { file, compressed: false, reason: "decode-failed" };
  }
  const sourceW = Math.max(1, Number(image.naturalWidth || image.width || 1));
  const sourceH = Math.max(1, Number(image.naturalHeight || image.height || 1));
  const maxDimension = force ? SOCIAL_CHAT_IMAGE_FORCE_MAX_DIMENSION : SOCIAL_CHAT_IMAGE_MAX_DIMENSION;
  const scale = Math.min(1, maxDimension / Math.max(sourceW, sourceH));
  const width = Math.max(1, Math.round(sourceW * scale));
  const height = Math.max(1, Math.round(sourceH * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) {
    return { file, compressed: false, reason: "no-canvas" };
  }
  ctx.drawImage(image, 0, 0, width, height);

  const mimePriority = String(file?.type || "").toLowerCase() === "image/png"
    ? ["image/webp", "image/jpeg"]
    : ["image/jpeg", "image/webp"];
  const qualitySteps = force
    ? [0.86, 0.76, 0.68, 0.6, 0.52, 0.46, 0.4]
    : [0.92, 0.84, 0.76, 0.68, 0.6, 0.52, 0.45];
  const targetBytes = force ? SOCIAL_CHAT_IMAGE_FORCE_TARGET_BYTES : SOCIAL_CHAT_IMAGE_TARGET_BYTES;

  let bestBlob = null;
  let bestType = "";
  for (const mimeType of mimePriority) {
    for (const quality of qualitySteps) {
      const blob = await socialCanvasToBlob(canvas, mimeType, quality);
      if (!blob || !Number(blob.size)) continue;
      if (!bestBlob || blob.size < bestBlob.size) {
        bestBlob = blob;
        bestType = mimeType;
      }
      if (blob.size <= targetBytes) {
        bestBlob = blob;
        bestType = mimeType;
        break;
      }
    }
    if (bestBlob && bestBlob.size <= targetBytes) break;
  }
  if (!bestBlob) {
    return { file, compressed: false, reason: "compress-failed" };
  }
  if (bestBlob.size >= originalSize * 0.97 && !force) {
    return { file, compressed: false, reason: "no-gain" };
  }
  const outExt = bestType === "image/webp" ? ".webp" : ".jpg";
  const outName = socialReplaceFileExtension(String(file?.name || "photo"), outExt);
  const compressedFile = new File([bestBlob], outName, { type: bestType, lastModified: Date.now() });
  return {
    file: compressedFile,
    compressed: true,
    originalSize,
    compressedSize: Number(compressedFile.size || 0),
    forced: force,
  };
}

function socialBuildUploadLargeError(file, limitBytes) {
  const fileName = String(file?.name || "").trim();
  const isImage = socialIsImageFile(file);
  const sizeInfo = `${socialFormatFileSize(file?.size || 0)} / ${socialFormatFileSize(limitBytes)}`;
  if (isImage) {
    return tr(
      `Р¤РѕС‚Рѕ СЃР»РёС€РєРѕРј Р±РѕР»СЊС€РѕРµ РґР»СЏ РѕС‚РїСЂР°РІРєРё (${sizeInfo}). РЎРѕР¶РјРёС‚Рµ РµРіРѕ РІ РіР°Р»РµСЂРµРµ РёР»Рё РІС‹Р±РµСЂРёС‚Рµ РґСЂСѓРіРѕР№ СЂР°Р·РјРµСЂ.`,
      `Image is too large to send (${sizeInfo}). Compress it in your gallery app or choose a smaller size.`
    );
  }
  const suffix = fileName ? ` (${fileName})` : "";
  return tr(
    `Р¤Р°Р№Р»${suffix} РїСЂРµРІС‹С€Р°РµС‚ Р»РёРјРёС‚ ${socialFormatFileSize(limitBytes)}.`,
    `File${suffix} exceeds the ${socialFormatFileSize(limitBytes)} limit.`
  );
}

function socialBuildUploadErrorMessage(err, fallbackFile) {
  const status = Number(err?.status || 0);
  const message = String(err?.message || "").trim();
  const lower = message.toLowerCase();
  if (status === 413 || lower.includes("request entity too large")) {
    const limit = socialFormatFileSize(SOCIAL_CHAT_UPLOAD_MAX_BYTES);
    const details = fallbackFile ? socialBuildUploadLargeError(fallbackFile, SOCIAL_CHAT_UPLOAD_MAX_BYTES) : "";
    return details || tr(
      `Р¤Р°Р№Р» СЃР»РёС€РєРѕРј Р±РѕР»СЊС€РѕР№ РґР»СЏ РѕС‚РїСЂР°РІРєРё. Р›РёРјРёС‚: ${limit}.`,
      `The file is too large to upload. Limit: ${limit}.`
    );
  }
  if (/(<html|<body|gateway time-?out|internal server error|bad gateway|traceback)/i.test(message)) {
    return tr(
      "РЎРµСЂРІРµСЂ РІСЂРµРјРµРЅРЅРѕ Р·Р°РЅСЏС‚. РџРѕРІС‚РѕСЂРёС‚Рµ РѕС‚РїСЂР°РІРєСѓ С‡РµСЂРµР· РЅРµСЃРєРѕР»СЊРєРѕ СЃРµРєСѓРЅРґ.",
      "The server is temporarily busy. Please retry in a few seconds."
    );
  }
  return message || tr("РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё С„Р°Р№Р»Р°", "File upload error");
}

async function socialSendChatFile(threadId, file, text, replyId, requestId) {
  const form = new FormData();
  form.append("file", file);
  if (text) form.append("text", text);
  if (replyId) form.append("reply_to_message_id", String(replyId));
  return socialRequest(`/api/social/chat/messages/${threadId}/files`, {
    method: "POST",
    body: form,
    headers: { "X-Request-ID": requestId },
    retryOnPost: true,
    maxRetries: 1,
  });
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

function socialCalendarPad(num) {
  return String(Math.max(0, Math.trunc(Number(num) || 0))).padStart(2, "0");
}

function socialCalendarParseDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(value.getTime());
  }
  const raw = String(value || "").trim();
  if (!raw) return null;
  const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]), 0, 0, 0, 0);
  }
  const localMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,3}))?$/);
  if (localMatch) {
    return new Date(
      Number(localMatch[1]),
      Number(localMatch[2]) - 1,
      Number(localMatch[3]),
      Number(localMatch[4]),
      Number(localMatch[5]),
      Number(localMatch[6] || 0),
      Number(String(localMatch[7] || "0").padEnd(3, "0"))
    );
  }
  const nativeDate = new Date(raw.replace(" ", "T"));
  if (!Number.isNaN(nativeDate.getTime())) return nativeDate;
  return socialParseDateSafe(raw);
}

function socialCalendarDayKey(value) {
  const dt = socialCalendarParseDate(value);
  if (dt) {
    return `${dt.getFullYear()}-${socialCalendarPad(dt.getMonth() + 1)}-${socialCalendarPad(dt.getDate())}`;
  }
  const raw = String(value || "").trim();
  const match = raw.match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : "";
}

function socialCalendarMonthValue(value = null) {
  const dt = socialCalendarParseDate(value) || new Date();
  return `${dt.getFullYear()}-${socialCalendarPad(dt.getMonth() + 1)}`;
}

function socialCalendarDateTimeValue(value) {
  const dt = socialCalendarParseDate(value);
  if (!dt) return String(value || "").trim().slice(0, 16);
  return `${dt.getFullYear()}-${socialCalendarPad(dt.getMonth() + 1)}-${socialCalendarPad(dt.getDate())}T${socialCalendarPad(dt.getHours())}:${socialCalendarPad(dt.getMinutes())}`;
}

function socialCalendarMonthLabel(value = null) {
  const dt = socialCalendarParseDate(value) || new Date();
  return dt.toLocaleDateString(currentLang === "en" ? "en-US" : "ru-RU", {
    month: "long",
    year: "numeric",
  });
}

function socialCalendarDayLabel(dayKey) {
  const dt = socialCalendarParseDate(dayKey);
  if (!dt) return String(dayKey || "").trim();
  return dt.toLocaleDateString(currentLang === "en" ? "en-GB" : "ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function socialCalendarTimeLabel(value) {
  const dt = socialCalendarParseDate(value);
  if (!dt) return String(value || "").trim().slice(11, 16);
  return dt.toLocaleTimeString(currentLang === "en" ? "en-GB" : "ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function socialCalendarRangeParam(value, endOfDay = false) {
  const dt = socialCalendarParseDate(value) || new Date();
  return `${dt.getFullYear()}-${socialCalendarPad(dt.getMonth() + 1)}-${socialCalendarPad(dt.getDate())}T${endOfDay ? "23:59:59" : "00:00:00"}`;
}

function socialCalendarSourceLabel(value) {
  const code = String(value || "").trim().toLowerCase();
  if (code === "ics_url") return "ICS URL";
  if (code === "google_oauth") return "Google OAuth";
  return code || "-";
}

function socialCalendarSyncStateLabel(value) {
  const code = String(value || "idle").trim().toLowerCase();
  if (code === "ok") return tr("РЈСЃРїРµС€РЅРѕ", "Successful");
  if (code === "partial") return tr("Р§Р°СЃС‚РёС‡РЅРѕ", "Partial");
  if (code === "empty") return tr("Р‘РµР· РёР·РјРµРЅРµРЅРёР№", "No changes");
  if (code === "error") return tr("РћС€РёР±РєР°", "Error");
  return tr("РћР¶РёРґР°РЅРёРµ", "Idle");
}

function socialSetCalendarSyncMessage(kind = "info", title = "", lines = []) {
  const node = document.getElementById("socialCalendarSyncMessage");
  if (!node) return;
  const safeTitle = String(title || "").trim();
  const safeLines = Array.isArray(lines)
    ? lines.map((line) => String(line || "").trim()).filter(Boolean)
    : [];
  if (!safeTitle && !safeLines.length) {
    node.className = "social-calendar-sync-message";
    node.innerHTML = "";
    return;
  }
  node.className = `social-calendar-sync-message ${String(kind || "info").trim().toLowerCase() || "info"}`;
  node.innerHTML = `
    ${safeTitle ? `<strong>${escapeHtml(safeTitle)}</strong>` : ""}
    ${safeLines.length ? `<div class="social-calendar-sync-lines">${safeLines.map((line) => `<span>${escapeHtml(line)}</span>`).join("")}</div>` : ""}
  `;
}

function socialRenderCalendarStatusMeta(status) {
  const node = document.getElementById("socialCalendarGoogleMeta");
  if (!node) return;
  if (!status || typeof status !== "object") {
    node.innerHTML = `<div class="hint">${escapeHtml(tr("РЎС‚Р°С‚СѓСЃ СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёРё РїРѕСЏРІРёС‚СЃСЏ РїРѕСЃР»Рµ РїРµСЂРІРѕР№ РїСЂРѕРІРµСЂРєРё.", "Sync status appears after the first check."))}</div>`;
    return;
  }
  const rows = [];
  const expiresAt = Number(status.expires_at || 0);
  const lastSyncAt = String(status.last_sync_at || "").trim();
  rows.push([tr("РџСѓР±Р»РёС‡РЅС‹Р№ Р°РґСЂРµСЃ", "Public base"), String(status.public_base_url || "").trim() || "-"]);
  rows.push([tr("Redirect URI", "Redirect URI"), String(status.redirect_uri || "").trim() || "-"]);
  rows.push([tr("Google OAuth", "Google OAuth"), status.oauth_configured ? tr("РќР°СЃС‚СЂРѕРµРЅ", "Configured") : tr("РќРµ РЅР°СЃС‚СЂРѕРµРЅ", "Not configured")]);
  rows.push([tr("РџРѕРґРєР»СЋС‡РµРЅРёРµ", "Connection"), status.connected ? tr("РџРѕРґРєР»СЋС‡РµРЅРѕ", "Connected") : tr("РќРµ РїРѕРґРєР»СЋС‡РµРЅРѕ", "Not connected")]);
  rows.push([tr("РџРѕСЃР»РµРґРЅСЏСЏ СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёСЏ", "Last sync"), lastSyncAt ? new Date(lastSyncAt).toLocaleString(currentLang === "en" ? "en-GB" : "ru-RU") : tr("Р•С‰С‘ РЅРµ Р·Р°РїСѓСЃРєР°Р»Р°СЃСЊ", "Not run yet")]);
  rows.push([tr("РСЃС‚РѕС‡РЅРёРє", "Source"), socialCalendarSourceLabel(status.last_sync_source)]);
  rows.push([tr("РЎРѕСЃС‚РѕСЏРЅРёРµ", "State"), socialCalendarSyncStateLabel(status.last_sync_state)]);
  if (expiresAt > 0) {
    rows.push([tr("РўРѕРєРµРЅ РґРѕ", "Token valid until"), new Date(expiresAt * 1000).toLocaleString(currentLang === "en" ? "en-GB" : "ru-RU")]);
  }
  node.innerHTML = rows.map(([label, value]) => `
    <div class="social-calendar-meta-row">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(value || "-").trim() || "-")}</strong>
    </div>
  `).join("");
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

  if (kind.startsWith("chat_")) {
    currentSocialSubtab = "chat";
    const socialBtn = document.querySelector(".nav-btn[data-tab='social']");
    if (typeof showTab === "function") showTab("social", socialBtn || null);
    const openThread = () => {
      if (typeof switchSocialSubtab === "function") switchSocialSubtab("chat", true);
      const threadId = Number(payload.thread_id || 0);
      if (threadId && typeof socialSelectThread === "function") {
        setTimeout(() => socialSelectThread(threadId), 180);
      }
    };
    setTimeout(openThread, 120);
    return;
  }

  if (kind.startsWith("task_")) {
    currentSocialSubtab = "tasks";
    const socialBtn = document.querySelector(".nav-btn[data-tab='social']");
    if (typeof showTab === "function") showTab("social", socialBtn || null);
    setTimeout(() => {
      if (typeof switchSocialSubtab === "function") switchSocialSubtab("tasks", true);
    }, 140);
    return;
  }

  if (kind.startsWith("calendar_")) {
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
      title: row.title || tr("РћР±СЉСЏРІР»РµРЅРёРµ", "Announcement"),
      body: row.body || "",
    });
  }
}

async function socialMarkNotificationsReadAll(syncLocal = true) {
  if (socialState.markReadInFlight) return;
  socialState.markReadInFlight = true;
  if (syncLocal) {
    socialState.unreadCount = 0;
    if (Array.isArray(socialState.notificationsFeed)) {
      socialState.notificationsFeed = socialState.notificationsFeed.map((row) => ({ ...row, is_read: true }));
    }
    socialSetBell(0);
    if (typeof socialRenderNotificationCenter === "function") {
      try { socialRenderNotificationCenter(); } catch (_) {}
    }
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
  const title = String(row.title || tr("РћР±СЉСЏРІР»РµРЅРёРµ", "Announcement")).trim();
  const body = String(row.body || "").trim();
  socialOpenModal(
    title || tr("РћР±СЉСЏРІР»РµРЅРёРµ", "Announcement"),
    `
      <div class="social-announcement-modal">
        <div class="social-announcement-body">${escapeHtml(body || tr("РќРµС‚ С‚РµРєСЃС‚Р° РѕР±СЉСЏРІР»РµРЅРёСЏ.", "Announcement text is empty."))}</div>
        <div class="actions">
          <button type="button" class="btn-primary" id="socialAnnouncementAckBtn">${escapeHtml(tr("РћРљ", "OK"))}</button>
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
  const text = socialResolveNotificationText(row);
  const title = String(text.title || tr("РЈРІРµРґРѕРјР»РµРЅРёРµ", "Notification")).trim();
  const body = String(text.body || "").trim();
  if (!title && !body) return;
  try {
    const n = new Notification(title || tr("РЈРІРµРґРѕРјР»РµРЅРёРµ", "Notification"), {
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

function socialNotificationKindTitle(kind) {
  const code = String(kind || "").trim().toLowerCase();
  if (code.startsWith("chat_")) return tr("Р§Р°С‚", "Chat");
  if (code.startsWith("task_")) return tr("Р—Р°РґР°С‡Рё", "Tasks");
  if (code.startsWith("calendar_")) return tr("РљР°Р»РµРЅРґР°СЂСЊ", "Calendar");
  return tr("РЎРёСЃС‚РµРјР°", "System");
}

function socialNotificationKindClass(kind) {
  const code = String(kind || "").trim().toLowerCase();
  if (code.startsWith("chat_")) return "chat";
  if (code.startsWith("task_")) return "task";
  if (code.startsWith("calendar_")) return "calendar";
  return "system";
}

function socialNotificationDecodeText(value) {
  const raw = String(value || "");
  if (typeof decodePossiblyMojibake === "function") {
    try { return decodePossiblyMojibake(raw); } catch (_) {}
  }
  return raw;
}

function socialResolveNotificationText(row) {
  const safeRow = row && typeof row === "object" ? row : {};
  const payload = safeRow.payload && typeof safeRow.payload === "object" ? safeRow.payload : {};
  const key = String(payload.i18n_key || "").trim().toLowerCase();
  const params = payload.i18n_params && typeof payload.i18n_params === "object" ? payload.i18n_params : {};
  const actorNick = String(params.actor_nick || "").trim();
  const assigneeNick = String(params.assignee_nick || "").trim();
  const taskTitle = String(params.task_title || params.title || "").trim();
  const dueText = String(params.due_text || "").trim();

  if (key === "task_assigned") {
    const title = tr("РќРѕРІР°СЏ Р·Р°РґР°С‡Р°", "New task");
    const body = [actorNick, taskTitle].filter(Boolean).join(": ") || taskTitle || tr("Р’Р°Рј РЅР°Р·РЅР°С‡РµРЅР° Р·Р°РґР°С‡Р°", "A task was assigned");
    return { title, body };
  }
  if (key === "task_done") {
    const title = tr("Р—Р°РґР°С‡Р° РІС‹РїРѕР»РЅРµРЅР°", "Task completed");
    const body = [actorNick, taskTitle].filter(Boolean).join(": ") || taskTitle || tr("Р—Р°РґР°С‡Р° РѕС‚РјРµС‡РµРЅР° РІС‹РїРѕР»РЅРµРЅРЅРѕР№", "Task was marked done");
    return { title, body };
  }
  if (key === "task_overdue") {
    const title = tr("Р—Р°РґР°С‡Р° РїСЂРѕСЃСЂРѕС‡РµРЅР°", "Task overdue");
    const body = [taskTitle, assigneeNick ? `${tr("РСЃРїРѕР»РЅРёС‚РµР»СЊ", "Assignee")}: ${assigneeNick}` : ""].filter(Boolean).join(" вЂў ") || tr("РЎСЂРѕРє Р·Р°РґР°С‡Рё РёСЃС‚РµРє", "Task deadline passed");
    return { title, body };
  }
  if (key === "task_reminder_3h") {
    const title = tr("РЎСЂРѕРє Р·Р°РґР°С‡Рё СЃРєРѕСЂРѕ", "Task deadline soon");
    const body = [taskTitle, dueText ? `${tr("Р”РµРґР»Р°Р№РЅ", "Deadline")}: ${dueText}` : ""].filter(Boolean).join(" вЂў ") || tr("Р”Рѕ РґРµРґР»Р°Р№РЅР° РѕСЃС‚Р°Р»РѕСЃСЊ РјРµРЅСЊС€Рµ 3 С‡Р°СЃРѕРІ", "Less than 3 hours left");
    return { title, body };
  }

  const title = socialNotificationDecodeText(safeRow.title || tr("РЈРІРµРґРѕРјР»РµРЅРёРµ", "Notification")).replace(/\s+/g, " ").trim();
  const body = socialNotificationDecodeText(safeRow.body || "").replace(/\s+/g, " ").trim();
  return { title, body };
}

function socialEnsureNotificationCenter() {
  let root = document.getElementById("socialNotificationCenter");
  if (root) return root;
  root = document.createElement("div");
  root.id = "socialNotificationCenter";
  root.className = "social-notif-center hidden";
  root.innerHTML = `
    <div class="social-notif-head">
      <strong>${escapeHtml(tr("РЈРІРµРґРѕРјР»РµРЅРёСЏ", "Notifications"))}</strong>
      <button type="button" class="btn-secondary" onclick="socialCloseNotificationCenter()">вњ•</button>
    </div>
    <div id="socialNotificationCenterList" class="social-notif-list"></div>
  `;
  document.body.appendChild(root);

  const list = root.querySelector("#socialNotificationCenterList");
  if (list) {
    list.addEventListener("scroll", () => {
      if (socialState.notificationCenterMarkOnScrollDone) return;
      if (list.scrollTop > 4) {
        socialState.notificationCenterMarkOnScrollDone = true;
        socialMarkNotificationsReadAll(true).catch(() => null);
      }
    }, { passive: true });
  }

  document.addEventListener("click", (event) => {
    if (!socialState.notificationCenterOpen) return;
    const panel = document.getElementById("socialNotificationCenter");
    if (!panel) return;
    const bell = document.getElementById("socialBellBtn");
    const drawerBell = document.getElementById("mobileDrawerBellBtn");
    const target = event.target;
    if (panel.contains(target)) return;
    if (bell && bell.contains(target)) return;
    if (drawerBell && drawerBell.contains(target)) return;
    if (target?.closest?.("#socialBellBtn, #mobileDrawerBellBtn, .icon-bell-btn")) return;
    socialCloseNotificationCenter();
  }, true);

  return root;
}

function socialRenderNotificationCenter() {
  const root = socialEnsureNotificationCenter();
  const list = root.querySelector("#socialNotificationCenterList");
  if (!list) return;
  const rows = Array.isArray(socialState.notificationsFeed) ? [...socialState.notificationsFeed] : [];
  rows.sort((a, b) => Number(b?.id || 0) - Number(a?.id || 0));
  if (!rows.length) {
    list.innerHTML = `<div class="hint">${escapeHtml(tr("РџРѕРєР° РЅРµС‚ СѓРІРµРґРѕРјР»РµРЅРёР№", "No notifications yet"))}</div>`;
    return;
  }
  list.innerHTML = rows.map((row) => {
    const id = Number(row?.id || 0);
    const kindClass = socialNotificationKindClass(row?.kind || "");
    const isRead = Boolean(row?.is_read);
    const text = socialResolveNotificationText(row);
    const created = socialFormatTaskDateTime(row?.created_at) || String(row?.created_at || "").replace("T", " ").slice(0, 16);
    return `
      <button type="button" class="social-notif-item ${isRead ? "is-read" : "is-unread"} kind-${escapeHtml(kindClass)}" onclick="socialOpenNotificationFromCenter(${id})">
        <div class="social-notif-item-head">
          <span class="social-notif-kind">${escapeHtml(socialNotificationKindTitle(row?.kind || ""))}</span>
          <small>${escapeHtml(created || "")}</small>
        </div>
        <b>${escapeHtml(text.title || tr("РЈРІРµРґРѕРјР»РµРЅРёРµ", "Notification"))}</b>
        <p>${escapeHtml(text.body || "-")}</p>
      </button>
    `;
  }).join("");
}

function socialCloseNotificationCenter(silent = false) {
  const root = document.getElementById("socialNotificationCenter");
  if (!root || root.classList.contains("hidden")) return false;
  root.classList.add("hidden");
  root.classList.remove("mobile-open");
  socialState.notificationCenterOpen = false;
  socialState.notificationCenterAnchorId = "";
  if (!silent && socialState.notificationCenterMarkOnScrollDone) {
    socialState.notificationCenterMarkOnScrollDone = false;
  }
  return true;
}

async function socialLoadNotificationCenterFeed(force = false) {
  if (!force && Array.isArray(socialState.notificationsFeed) && socialState.notificationsFeed.length) {
    return socialState.notificationsFeed;
  }
  if (socialState.notificationCenterLoading) return socialState.notificationsFeed || [];
  socialState.notificationCenterLoading = true;
  try {
    const data = await socialRequest('/api/social/notifications?limit=80').catch(() => null);
    const rows = Array.isArray(data?.rows) ? data.rows : [];
    socialState.notificationsFeed = rows.map((row) => ({
      ...row,
      title: socialNotificationDecodeText(row?.title || ""),
      body: socialNotificationDecodeText(row?.body || ""),
      is_read: Boolean(row?.is_read),
    }));
    socialState.unreadCount = Number(data?.unread || 0);
    socialSetBell(socialState.unreadCount);
    return socialState.notificationsFeed;
  } finally {
    socialState.notificationCenterLoading = false;
  }
}

async function socialToggleNotificationCenter(event = null) {
  if (event?.preventDefault) event.preventDefault();
  if (event?.stopPropagation) event.stopPropagation();
  const root = socialEnsureNotificationCenter();
  if (!root) return false;

  if (socialState.notificationCenterOpen) {
    socialCloseNotificationCenter();
    return true;
  }

  const anchor = event?.currentTarget || event?.target?.closest?.('#socialBellBtn, #mobileDrawerBellBtn, .icon-bell-btn') || document.getElementById('socialBellBtn') || document.getElementById('mobileDrawerBellBtn');
  await socialLoadNotificationCenterFeed(true);
  socialRenderNotificationCenter();

  const safeTop = 10 + Number(window.visualViewport?.offsetTop || 0);
  const bodyClassMobile = Boolean(
    document.body?.classList?.contains("mobile-client-mode")
    || document.body?.classList?.contains("mobile-apk-mode")
  );
  const coarsePointer = (() => {
    try { return Boolean(window.matchMedia && window.matchMedia("(pointer: coarse)").matches); } catch (_) { return false; }
  })();
  const uaMobile = (() => {
    try { return /android|iphone|ipad|ipod|mobile/i.test(String(navigator?.userAgent || "")); } catch (_) { return false; }
  })();
  const viewportWidth = (window.innerWidth || document.documentElement.clientWidth || 0);
  const isMobileShell = (typeof socialIsMobileClientShell === "function" && socialIsMobileClientShell())
    || (typeof socialIsMobileApkShell === "function" && socialIsMobileApkShell())
    || bodyClassMobile
    || (coarsePointer && viewportWidth <= 1280)
    || (uaMobile && viewportWidth <= 1400)
    || viewportWidth <= 980;
  if (isMobileShell) {
    const viewportHeight = Math.max(320, Math.round(window.visualViewport?.height || window.innerHeight || document.documentElement.clientHeight || 720));
    const panelTop = Math.round(safeTop + 52);
    root.classList.add("mobile-open");
    root.style.left = "8px";
    root.style.right = "8px";
    root.style.width = "auto";
    root.style.top = `${panelTop}px`;
    root.style.maxHeight = `${Math.max(260, viewportHeight - panelTop - 12)}px`;
  } else if (anchor?.getBoundingClientRect) {
    root.classList.remove("mobile-open");
    const rect = anchor.getBoundingClientRect();
    const top = Math.max(safeTop, Number(rect.bottom || 0) + 8);
    const right = Math.max(8, (window.innerWidth || document.documentElement.clientWidth || 0) - Number(rect.right || 0));
    root.style.left = "auto";
    root.style.right = `${Math.round(right)}px`;
    root.style.width = "min(390px, calc(100vw - 20px))";
    root.style.top = `${Math.round(top)}px`;
  } else {
    root.classList.remove("mobile-open");
    root.style.left = "auto";
    root.style.width = "min(390px, calc(100vw - 20px))";
    root.style.top = `${Math.round(safeTop + 56)}px`;
    root.style.right = `12px`;
  }

  socialState.notificationCenterOpen = true;
  socialState.notificationCenterMarkOnScrollDone = false;
  root.classList.remove('hidden');
  return true;
}

function socialOpenNotificationFromCenter(notificationId) {
  const id = Number(notificationId || 0);
  if (!id) return;
  const rows = Array.isArray(socialState.notificationsFeed) ? socialState.notificationsFeed : [];
  const row = rows.find((x) => Number(x?.id || 0) === id) || null;
  if (!row) return;
  row.is_read = true;
  if (typeof socialOpenNotificationTarget === 'function') {
    socialOpenNotificationTarget(row);
  }
  socialMarkNotificationsReadAll(true).catch(() => null);
  socialCloseNotificationCenter();
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
    const isBootstrapSync = Number(socialState.lastNotificationId || 0) <= 0;
    if (!Array.isArray(socialState.notificationsFeed)) socialState.notificationsFeed = [];
    for (const srcRow of rows) {
      const row = {
        ...srcRow,
        title: socialNotificationDecodeText(srcRow?.title || ""),
        body: socialNotificationDecodeText(srcRow?.body || ""),
        is_read: Boolean(srcRow?.is_read),
      };
      const rowId = Number(row.id || 0);
      if (rowId > 0) {
        const idx = socialState.notificationsFeed.findIndex((x) => Number(x?.id || 0) === rowId);
        if (idx >= 0) socialState.notificationsFeed[idx] = { ...socialState.notificationsFeed[idx], ...row };
        else socialState.notificationsFeed.push(row);
      }

      const id = Number(row.id || 0);
      if (id > socialState.lastNotificationId) socialState.lastNotificationId = id;
      if (!id || socialState.toastsSeen.has(id)) continue;
      socialState.toastsSeen.add(id);
      if (row.is_read || isBootstrapSync) continue;
      const text = socialResolveNotificationText(row);
      socialShowToast(text.title || tr("РЈРІРµРґРѕРјР»РµРЅРёРµ", "Notification"), text.body || "");
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
          title: row.title || tr("РћР±СЉСЏРІР»РµРЅРёРµ", "Announcement"),
          body: row.body || "",
        });
      }
    }
    if (Array.isArray(socialState.notificationsFeed) && socialState.notificationsFeed.length > 200) {
      socialState.notificationsFeed = socialState.notificationsFeed.slice(-200);
    }
    if (socialState.notificationCenterOpen) {
      try { socialRenderNotificationCenter(); } catch (_) {}
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
  if (socialState.chatSearchTimer) {
    clearTimeout(socialState.chatSearchTimer);
    socialState.chatSearchTimer = null;
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
    tasksAll: [],
    tasksCacheKey: "",
    tasksCacheLoadedAt: 0,
    tasksLoadSeq: 0,
    calendarEvents: [],
    calendarTasks: [],
    calendarLastGoodEvents: [],
    calendarLastGoodTasks: [],
    calendarLoadSeq: 0,
    calendarDate: new Date(),
    calendarSelectedDay: "",
    notes: [],
    currentNoteId: 0,
    noteSaveTimer: null,
    notificationsTimer: null,
    announcementsTimer: null,
    lastNotificationId: 0,
    unreadCount: 0,
    notificationsFeed: [],
    notificationCenterOpen: false,
    notificationCenterLoading: false,
    notificationCenterMarkOnScrollDone: false,
    notificationCenterAnchorId: "",
    markReadInFlight: false,
    notificationSettings: null,
    announcementModalId: 0,
    pendingAnnouncementIds: new Set(),
    participantProfileCache: new Map(),
    userInteracted: false,
    lastSoundAtByKind: {},
    moduleLoaded: false,
    chatSearch: "",
    chatSearchMessageThreadIds: [],
    chatSearchMessageQuery: "",
    chatSearchRequestSeq: 0,
    chatSearchTimer: null,
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
    calendarAutoSyncInFlight: false,
    sendingMessage: false,
    loadingMessagesThreadId: 0,
    chatReplyTo: null,
    chatContextMessageId: 0,
    chatContextThreadId: 0,
    chatContextX: 0,
    chatContextY: 0,
    chatImageViewerOpen: false,
    keepEmojiOpenUntil: 0,
    emojiRecents: [],
    mobileThreadAutoSelectEnabled: !socialIsMobileClientShell(),
    fileUploadInFlight: false,
    chatHeadCollapsed: false,
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
  socialSyncChatComposerState();
}

function socialEnsureChatListToolbar() {
  const head = document.querySelector("#socialSubtabChat .social-chat-sidebar-head");
  if (!head) return;
  if (head.dataset.toolbarReady === "1") return;
  const modulesLabel = tr("\u041c\u0435\u043d\u044e \u043c\u043e\u0434\u0443\u043b\u0435\u0439", "Modules menu");
  const actionsLabel = tr("\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u044f \u0447\u0430\u0442\u043e\u0432", "Chat actions");
  head.classList.add("social-chat-sidebar-toolbar");
  head.dataset.toolbarReady = "1";
  head.innerHTML = `
    <button id="socialChatModulesBtn" class="chip-btn social-chat-toolbar-btn" type="button" onclick="socialOpenModulesMenu()" aria-label="${escapeHtml(modulesLabel)}" title="${escapeHtml(modulesLabel)}">&#9776;</button>
    <h3>${escapeHtml(tr("\u0427\u0430\u0442\u044b", "Chats"))}</h3>
    <button id="socialChatListActionsBtn" class="chip-btn social-chat-toolbar-btn" type="button" onclick="socialOpenChatQuickMenu()" aria-label="${escapeHtml(actionsLabel)}" title="${escapeHtml(actionsLabel)}">&#8942;</button>
  `;
}

function switchSocialSubtab(tab, loadNow = true) {
  const safe = ["games", "chat", "tasks", "calendar", "calculator", "notes"].includes(String(tab || ""))
    ? String(tab)
    : "chat";
  socialState.currentSubtab = safe;
  currentSocialSubtab = safe;
  if (document && document.body) {
    document.body.setAttribute("data-active-social-subtab", safe);
  }
  if (typeof window.refreshSectionHeading === "function") {
    try { window.refreshSectionHeading("social"); } catch (_) {}
  }
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
  if (safe === "chat") socialEnsureChatListToolbar();
  socialSyncMobileChatChrome();
  socialApplyChatHeadCollapsed();
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
    socialLoadTaskActors().catch(() => null);
    socialLoadProjects().catch(() => null);
    socialHideCalendarDaySheet();
    socialLoadCalendar();
    setTimeout(() => {
      if (currentTab === "social" && socialState.currentSubtab === "calendar") {
        socialLoadCalendar();
      }
    }, 120);
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
  socialEnsureChatListToolbar();
  socialBindChatInputEnter();
  socialBindChatComposer();
  socialSyncChatComposerState();
  const chatSearchInput = document.getElementById("socialChatSearch");
  if (chatSearchInput) {
    chatSearchInput.placeholder = tr("\u041f\u043e\u0438\u0441\u043a \u043f\u043e \u0447\u0430\u0442\u0430\u043c \u0438 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f\u043c", "Search chats and messages");
  }
  socialRenderGames();
  switchSocialSubtab(currentSocialSubtab || socialState.currentSubtab || "chat", true);
  socialStartGlobalHooks();
  socialSyncMobileChatChrome();
  socialApplyChatHeadCollapsed();
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
function socialSyncChatComposerState() {
  const wrap = document.querySelector("#socialSubtabChat .social-chat-input-wrap");
  const input = document.getElementById("socialChatInput");
  const attachBtn = document.getElementById("socialAttachBtn");
  const sendBtn = document.getElementById("socialSendIconBtn");
  if (!wrap || !input || !attachBtn || !sendBtn) return;
  socialAutosizeChatInput(input);
  const hasThread = Number(socialState.currentThreadId || 0) > 0;
  const hasText = Boolean(String(input.value || "").trim()) && hasThread;
  wrap.classList.toggle("is-typing", hasText);
  attachBtn.classList.toggle("hidden", hasText);
  sendBtn.classList.toggle("hidden", !hasText);
  attachBtn.disabled = socialState.fileUploadInFlight || !hasThread;
  sendBtn.disabled = socialState.sendingMessage || !hasText;
}

function socialAutosizeChatInput(input = null) {
  const node = input || document.getElementById("socialChatInput");
  if (!node) return;
  const minHeight = 40;
  const maxHeight = 136;
  node.style.height = "auto";
  const nextHeight = Math.max(minHeight, Math.min(maxHeight, Number(node.scrollHeight || minHeight)));
  node.style.height = `${nextHeight}px`;
  node.style.overflowY = Number(node.scrollHeight || 0) > maxHeight ? "auto" : "hidden";
}
function socialBindChatComposer() {
  const input = document.getElementById("socialChatInput");
  if (!input || input.dataset.composeBind === "1") return;
  input.dataset.composeBind = "1";
  socialAutosizeChatInput(input);
  const sync = () => {
    socialAutosizeChatInput(input);
    socialSyncChatComposerState();
  };
  input.addEventListener("input", sync);
  input.addEventListener("change", sync);
  input.addEventListener("focus", sync);
  input.addEventListener("blur", sync);
}

function socialGetEmojiSets() {
  const recents = Array.isArray(socialState.emojiRecents)
    ? socialState.emojiRecents.filter((item) => String(item || "").trim())
    : [];
  return [
    {
      key: "recent",
      icon: "\uD83D\uDD58",
      title: tr("\u041d\u0435\u0434\u0430\u0432\u043d\u0438\u0435", "Recent"),
      items: recents,
    },
    {
      key: "faces",
      icon: "\uD83D\uDE42",
      title: tr("\u0421\u043c\u0430\u0439\u043b\u044b", "Smileys"),
      items: [
        "\uD83D\uDE42", "\uD83D\uDE09", "\uD83D\uDE0A", "\uD83D\uDE0D", "\uD83E\uDD70", "\uD83D\uDE0E",
        "\uD83D\uDE07", "\uD83E\uDD14", "\uD83D\uDE10", "\uD83D\uDE11", "\uD83D\uDE04", "\uD83D\uDE02",
        "\uD83D\uDE05", "\uD83D\uDE0C", "\uD83D\uDE14", "\uD83D\uDE22", "\uD83D\uDE2D", "\uD83D\uDE21",
        "\uD83E\uDD2F", "\uD83D\uDE31", "\uD83D\uDE2C", "\uD83D\uDE0F", "\uD83E\uDEE1", "\uD83E\uDD7A",
      ],
    },
    {
      key: "gestures",
      icon: "\uD83D\uDC4D",
      title: tr("\u0416\u0435\u0441\u0442\u044b", "Gestures"),
      items: [
        "\uD83D\uDC4D", "\uD83D\uDC4E", "\u270C\uFE0F", "\uD83E\uDD18", "\uD83D\uDE4F", "\uD83D\uDC4F",
        "\uD83D\uDCAA", "\uD83E\uDEF6", "\uD83D\uDC4C", "\uD83D\uDE4C", "\uD83D\uDC50", "\uD83D\uDC4B",
      ],
    },
    {
      key: "symbols",
      icon: "\u2764\uFE0F",
      title: tr("\u0421\u0438\u043c\u0432\u043e\u043b\u044b", "Symbols"),
      items: [
        "\u2764\uFE0F", "\uD83D\uDC9B", "\uD83D\uDC9A", "\uD83D\uDC99", "\uD83D\uDC9C", "\uD83D\uDCA5",
        "\u2728", "\u2B50", "\uD83D\uDD25", "\u2705", "\u274C", "\u26A0\uFE0F",
      ],
    },
  ].filter((set) => set.key !== "recent" || set.items.length > 0);
}

function socialRenderEmojiPicker(activeKey = "") {
  const picker = document.getElementById("socialEmojiPicker");
  if (!picker) return;
  const sets = socialGetEmojiSets();
  const fallbackKey = sets.find((set) => set.key === "faces")?.key || sets[0]?.key || "faces";
  const safeKey = sets.some((set) => set.key === activeKey)
    ? activeKey
    : (String(socialState.emojiSet || "").trim() || fallbackKey);
  const activeSet = sets.find((set) => set.key === safeKey) || sets[0] || { key: "faces", items: [] };
  socialState.emojiSet = activeSet.key;
  picker.innerHTML = `
    <div class="social-emoji-tabs">
      ${sets.map((set) => `
        <button
          type="button"
          class="social-emoji-tab ${set.key === activeSet.key ? "active" : ""}"
          onclick="socialSwitchEmojiSet('${set.key}')"
          aria-label="${escapeHtml(set.title)}"
          title="${escapeHtml(set.title)}"
        >
          <span class="social-emoji-tab-icon">${set.icon}</span>
        </button>
      `).join("")}
    </div>
    <div class="social-emoji-pane">
      ${activeSet.items.length ? `
        <div class="social-emoji-sections">
          <section class="social-emoji-section">
            <div class="social-emoji-section-title">${escapeHtml(activeSet.title)}</div>
            <div class="social-emoji-grid">
              ${activeSet.items.map((emoji) => `<button type="button" class="social-emoji-item" onclick="socialInsertEmoji('${escapeHtml(emoji)}')">${emoji}</button>`).join("")}
            </div>
          </section>
        </div>
      ` : `<div class="social-emoji-empty">${escapeHtml(tr("\u041f\u043e\u043a\u0430 \u043f\u0443\u0441\u0442\u043e", "Nothing yet"))}</div>`}
    </div>
  `;
}

function socialSwitchEmojiSet(setKey) {
  socialState.keepEmojiOpenUntil = Date.now() + 180;
  socialRenderEmojiPicker(String(setKey || "").trim());
}

function socialInsertEmoji(emoji) {
  const input = document.getElementById("socialChatInput");
  const safeEmoji = String(emoji || "").trim();
  if (!input || !safeEmoji) return false;
  const start = Number(input.selectionStart ?? input.value.length);
  const end = Number(input.selectionEnd ?? input.value.length);
  const before = String(input.value || "").slice(0, start);
  const after = String(input.value || "").slice(end);
  input.value = `${before}${safeEmoji}${after}`;
  const caret = start + safeEmoji.length;
  if (typeof input.setSelectionRange === "function") input.setSelectionRange(caret, caret);
  const recents = Array.isArray(socialState.emojiRecents) ? [...socialState.emojiRecents] : [];
  socialState.emojiRecents = [safeEmoji, ...recents.filter((item) => item !== safeEmoji)].slice(0, 24);
  socialState.keepEmojiOpenUntil = Date.now() + 180;
  socialAutosizeChatInput(input);
  socialSyncChatComposerState();
  input.focus();
  input.dispatchEvent(new Event("input", { bubbles: true }));
  socialRenderEmojiPicker(String(socialState.emojiSet || "").trim());
  return false;
}

function socialToggleEmojiPicker(forceOpen = null) {
  const picker = document.getElementById("socialEmojiPicker");
  const btn = document.getElementById("socialEmojiBtn");
  if (!picker) return false;
  const shouldOpen = typeof forceOpen === "boolean" ? forceOpen : picker.classList.contains("hidden");
  if (!shouldOpen) {
    picker.classList.add("hidden");
    picker.setAttribute("aria-hidden", "true");
    if (btn) btn.setAttribute("aria-expanded", "false");
    return false;
  }
  socialState.keepEmojiOpenUntil = Date.now() + 180;
  socialRenderEmojiPicker(String(socialState.emojiSet || "").trim());
  picker.classList.remove("hidden");
  picker.setAttribute("aria-hidden", "false");
  if (btn) btn.setAttribute("aria-expanded", "true");
  return true;
}

function socialCleanCalendarDetails(value) {
  const raw = String(value ?? "");
  let text = raw;
  if (typeof decodePossiblyMojibake === "function") {
    try { text = String(decodePossiblyMojibake(text) ?? ""); } catch (_) {}
  }
  return String(text || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

if (typeof globalThis !== "undefined") {
  globalThis.socialToggleEmojiPicker = socialToggleEmojiPicker;
  globalThis.socialCleanCalendarDetails = socialCleanCalendarDetails;
}

function socialOpenModal(title, html) {
  const modal = document.getElementById("socialModal");
  const host = document.getElementById("socialModalHost");
  const titleNode = document.getElementById("socialModalTitle");
  if (!modal || !host || !titleNode) return;
  titleNode.textContent = title || tr("РЎРѕС†РёР°Р»СЊРЅС‹Р№ РјРѕРґСѓР»СЊ", "Social module");
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
      { code: "snake", title: "Р—РјРµР№РєР°" },
      { code: "tetris", title: "РўРµС‚СЂРёСЃ" },
      { code: "2048", title: "2048" },
      { code: "checkers", title: "РЁР°С€РєРё" },
      { code: "chess", title: "РЁР°С…РјР°С‚С‹" },
      { code: "battleship", title: "РњРѕСЂСЃРєРѕР№ Р±РѕР№" },
    ];
  host.innerHTML = games.map((game) => {
    const icon = game.code === "snake"
      ? "рџђЌ"
      : (game.code === "tetris"
        ? "рџ§©"
        : (game.code === "checkers"
          ? "в™џ"
          : (game.code === "chess"
            ? "в™њ"
            : (game.code === "battleship" ? "вљ“" : "рџ”ў"))));
    return `
      <button class="social-game-card" type="button" ondblclick="socialOpenGameMenu('${escapeHtml(game.code)}')" onclick="socialOpenGameMenu('${escapeHtml(game.code)}')">
        <span class="social-game-icon" aria-hidden="true">${icon}</span>
        <span class="social-game-title">${escapeHtml(game.title || game.code)}</span>
        <small>${tr("РќР°Р¶РјРёС‚Рµ РґР»СЏ РІС…РѕРґР°", "Tap to open")}</small>
      </button>
    `;
  }).join("");
}

async function socialOpenGameMenu(gameCode) {
  const code = String(gameCode || "").trim().toLowerCase();
  if (!code) return;
  if (code === "checkers" && typeof window.socialCheckersOpenMenu === "function") {
    window.socialCheckersOpenMenu();
    return;
  }
  if (code === "chess" && typeof window.socialChessOpenMenu === "function") {
    window.socialChessOpenMenu();
    return;
  }
  if (code === "battleship" && typeof window.socialBattleshipOpenMenu === "function") {
    window.socialBattleshipOpenMenu();
    return;
  }
  socialState.currentGameCode = code;
  const lb = await socialRequest(`/api/social/games/leaderboard?game_code=${encodeURIComponent(code)}&limit=10`).catch(() => ({ my_best: 0, my_rank: null, top: [] }));
  socialState.gamesLeaderboardCache.set(code, lb || {});
  const title = code === "snake"
    ? tr("Р—РјРµР№РєР°", "Snake")
    : (code === "tetris"
      ? tr("РўРµС‚СЂРёСЃ", "Tetris")
      : (code === "2048"
        ? "2048"
        : (code === "chess"
          ? tr("РЁР°С…РјР°С‚С‹", "Chess")
          : (code === "battleship" ? tr("РњРѕСЂСЃРєРѕР№ Р±РѕР№", "Battleship") : code))));
  const myBest = Number(lb?.my_best || 0);
  const myRank = lb?.my_rank ? `#${lb.my_rank}` : "вЂ”";
  socialOpenModal(
    `${title}`,
    `
      <div class="social-game-menu">
        <div class="social-game-record">${tr("Р’Р°С€ СЂРµРєРѕСЂРґ", "Your best")}: <b>${myBest}</b> - ${tr("РњРµСЃС‚Рѕ", "Rank")}: <b>${myRank}</b></div>
        <div class="actions">
          <button type="button" onclick="socialStartGame('${escapeHtml(code)}')">${tr("РРіСЂР°", "Play")}</button>
          <button class="btn-secondary" type="button" onclick="socialShowLeaderboard('${escapeHtml(code)}')">${tr("Р РµР№С‚РёРЅРі РёРіСЂРѕРєРѕРІ", "Leaderboard")}</button>
          <button class="btn-secondary" type="button" onclick="socialShowGameTips('${escapeHtml(code)}')">${tr("РљР°Рє РёРіСЂР°С‚СЊ", "How to play")}</button>
        </div>
      </div>
    `
  );
}

function socialShowGameTips(code) {
  const safe = String(code || "").toLowerCase();
  if (safe === "checkers" && typeof window.socialCheckersShowTips === "function") {
    window.socialCheckersShowTips();
    return;
  }
  if (safe === "chess" && typeof window.socialChessShowTips === "function") {
    window.socialChessShowTips();
    return;
  }
  if (safe === "battleship" && typeof window.socialBattleshipShowTips === "function") {
    window.socialBattleshipShowTips();
    return;
  }
  const title = safe === "snake"
    ? tr("РљР°Рє РёРіСЂР°С‚СЊ РІ Р—РјРµР№РєСѓ", "How to play Snake")
    : (safe === "tetris"
      ? tr("РљР°Рє РёРіСЂР°С‚СЊ РІ РўРµС‚СЂРёСЃ", "How to play Tetris")
      : (safe === "2048" ? tr("РљР°Рє РёРіСЂР°С‚СЊ РІ 2048", "How to play 2048") : tr("РљР°Рє РёРіСЂР°С‚СЊ", "How to play")));
  const body = safe === "snake"
    ? tr("РЈРїСЂР°РІР»РµРЅРёРµ: СЃС‚СЂРµР»РєРё. Р•С€СЊС‚Рµ РµРґСѓ, РЅРµ РІСЂРµР·Р°Р№С‚РµСЃСЊ РІ СЃС‚РµРЅСѓ Рё РІ СЃРµР±СЏ. РљР°Р¶РґС‹Рµ 5 РѕС‡РєРѕРІ СЃРєРѕСЂРѕСЃС‚СЊ СЂР°СЃС‚РµС‚.", "Controls: arrows. Eat food and avoid walls or your body. Speed increases every 5 points.")
    : (safe === "tetris"
      ? tr("РЈРїСЂР°РІР»РµРЅРёРµ: в†ђ в†’, в†“, в†‘ РїРѕРІРѕСЂРѕС‚, РїСЂРѕР±РµР» вЂ” Р±С‹СЃС‚СЂС‹Р№ СЃР±СЂРѕСЃ. РЎРѕР±РёСЂР°Р№С‚Рµ Р»РёРЅРёРё Рё РЅР°Р±РёСЂР°Р№С‚Рµ РѕС‡РєРё.", "Controls: в†ђ в†’, в†“, в†‘ rotate, Space hard drop. Complete lines to gain score.")
      : tr("РЈРїСЂР°РІР»РµРЅРёРµ: СЃС‚СЂРµР»РєРё. РЎРѕРІРјРµС‰Р°Р№С‚Рµ РѕРґРёРЅР°РєРѕРІС‹Рµ РїР»РёС‚РєРё, С‡С‚РѕР±С‹ РїРѕР»СѓС‡РёС‚СЊ 2048. РҐРѕРґ Р·Р°РІРµСЂС€Р°РµС‚ РёРіСЂСѓ, РєРѕРіРґР° РЅРµС‚ РґРѕСЃС‚СѓРїРЅС‹С… С…РѕРґРѕРІ.", "Controls: arrows. Merge equal tiles to reach 2048. Game ends when no moves are available."));
  socialOpenModal(title, `<div class="hint">${escapeHtml(body)}</div><div class="actions"><button type="button" onclick="socialOpenGameMenu('${escapeHtml(safe)}')">${tr("РќР°Р·Р°Рґ", "Back")}</button></div>`);
}

async function socialShowLeaderboard(code) {
  const safe = String(code || "").toLowerCase();
  if (safe === "checkers" && typeof window.socialCheckersShowLeaderboard === "function") {
    window.socialCheckersShowLeaderboard();
    return;
  }
  if (safe === "chess" && typeof window.socialChessShowLeaderboard === "function") {
    window.socialChessShowLeaderboard();
    return;
  }
  if (safe === "battleship" && typeof window.socialBattleshipShowLeaderboard === "function") {
    window.socialBattleshipShowLeaderboard();
    return;
  }
  const data = await socialRequest(`/api/social/games/leaderboard?game_code=${encodeURIComponent(safe)}&limit=100`).catch((e) => {
    alert(e.message);
    return null;
  });
  if (!data) return;
  const rows = Array.isArray(data.top) ? data.top : [];
  const html = `
    <div class="table-card">
      <table>
        <thead><tr><th>#</th><th>${tr("РќРёРє", "Nickname")}</th><th>${tr("РћС‡РєРё", "Score")}</th></tr></thead>
        <tbody>
          ${rows.length ? rows.map((row) => `
            <tr class="${row.is_me ? "social-me-row" : ""}"><td>${Number(row.rank || 0)}</td><td>${escapeHtml(row.nick || "-")}</td><td>${Number(row.score || 0)}</td></tr>
          `).join("") : `<tr><td colspan="3">${tr("РџРѕРєР° РЅРµС‚ СЂРµР·СѓР»СЊС‚Р°С‚РѕРІ", "No records yet")}</td></tr>`}
        </tbody>
      </table>
    </div>
    <div class="hint">${tr("Р’Р°С€Рµ РјРµСЃС‚Рѕ", "Your rank")}: <b>${data.my_rank ? `#${data.my_rank}` : "вЂ”"}</b> - ${tr("Р’Р°С€ СЂРµРєРѕСЂРґ", "Your best")}: <b>${Number(data.my_best || 0)}</b></div>
    <div class="actions"><button type="button" onclick="socialOpenGameMenu('${escapeHtml(safe)}')">${tr("РќР°Р·Р°Рґ", "Back")}</button></div>
  `;
  socialOpenModal(tr("Р РµР№С‚РёРЅРі РёРіСЂРѕРєРѕРІ", "Leaderboard"), html);
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
      <div>${tr("РЎС‡РµС‚", "Score")}: <b>${Number(score || 0)}</b></div>
      <div class="actions">
        ${retryFn ? `<button type="button" onclick="${retryFn}">${tr("Р•С‰Рµ СЂР°Р·", "Retry")}</button>` : ""}
        <button class="btn-secondary" type="button" onclick="socialOpenGameMenu('${escapeHtml(socialState.currentGameCode || "snake")}')">${tr("Р’ РјРµРЅСЋ", "Menu")}</button>
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
        <button type="button" onclick="socialGameControl('up')">в†‘</button>
        <button type="button" onclick="socialGameControl('left')">в†ђ</button>
        <button type="button" onclick="socialGameControl('down')">в†“</button>
        <button type="button" onclick="socialGameControl('right')">в†’</button>
      </div>
    `;
  }
  if (safe === "2048") {
    return `
      <div class="social-game-controls">
        <button type="button" onclick="socialGameControl('up')">в†‘</button>
        <button type="button" onclick="socialGameControl('left')">в†ђ</button>
        <button type="button" onclick="socialGameControl('down')">в†“</button>
        <button type="button" onclick="socialGameControl('right')">в†’</button>
      </div>
    `;
  }
  if (safe === "tetris") {
    return `
      <div class="social-game-controls">
        <button type="button" onclick="socialGameControl('left')">в†ђ</button>
        <button type="button" onclick="socialGameControl('right')">в†’</button>
        <button type="button" onclick="socialGameControl('down')">в†“</button>
        <button type="button" onclick="socialGameControl('rotate')">${tr("РџРѕРІРѕСЂРѕС‚", "Rotate")}</button>
        <button type="button" onclick="socialGameControl('drop')">${tr("РЎР±СЂРѕСЃ", "Drop")}</button>
      </div>
    `;
  }
  return "";
}

function socialStartGame(code) {
  const safe = String(code || "").toLowerCase();
  if (safe === "checkers" && typeof window.socialCheckersQuickStart === "function") {
    window.socialCheckersQuickStart("medium");
    return;
  }
  if (safe === "chess" && typeof window.socialChessQuickStart === "function") {
    window.socialChessQuickStart("medium");
    return;
  }
  if (safe === "battleship" && typeof window.socialBattleshipQuickStart === "function") {
    window.socialBattleshipQuickStart("medium");
    return;
  }
  const title = safe === "snake"
    ? tr("Р—РјРµР№РєР°", "Snake")
    : (safe === "tetris"
      ? tr("РўРµС‚СЂРёСЃ", "Tetris")
      : (safe === "2048" ? "2048" : safe));
  const hint = safe === "snake"
    ? tr("РЈРїСЂР°РІР»РµРЅРёРµ: СЃС‚СЂРµР»РєРё, СЃРІР°Р№РїС‹ Рё С‚Р°Рї РїРѕ СЃС‚РѕСЂРѕРЅРµ РѕС‚ Р·РјРµР№РєРё. Р•С€СЊС‚Рµ РµРґСѓ Рё РЅРµ РІСЂРµР·Р°Р№С‚РµСЃСЊ.", "Controls: arrows, swipes, and tap around snake direction. Eat food and avoid collisions.")
    : (safe === "tetris"
      ? tr("РЈРїСЂР°РІР»РµРЅРёРµ: в†ђ в†’, в†“, в†‘ РїРѕРІРѕСЂРѕС‚, РїСЂРѕР±РµР» вЂ” Р±С‹СЃС‚СЂС‹Р№ СЃР±СЂРѕСЃ.", "Controls: в†ђ в†’, в†“, в†‘ rotate, Space hard drop.")
      : tr("РЈРїСЂР°РІР»РµРЅРёРµ: СЃС‚СЂРµР»РєРё. РЎРѕРІРјРµС‰Р°Р№С‚Рµ РѕРґРёРЅР°РєРѕРІС‹Рµ РїР»РёС‚РєРё.", "Controls: arrows. Merge equal tiles."));
  const canvasSize = socialGameCanvasSize(safe);
  const controls = socialGameControlsHtml(safe);
  socialOpenModal(
    title,
    `
      <div class="social-game-wrap">
        <div class="hint">${escapeHtml(hint)}</div>
        <canvas id="socialGameCanvas" width="${Number(canvasSize.width || 420)}" height="${Number(canvasSize.height || 620)}"></canvas>
        <div id="socialGameInfo" class="hint">${tr("РЎС‡РµС‚", "Score")}: 0</div>
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
    info.textContent = `${tr("РЎС‡РµС‚", "Score")}: ${score}`;
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
      socialOpenModal(tr("Р—РјРµР№РєР°", "Snake"), socialGameOverlay(tr("РРіСЂР° РѕРєРѕРЅС‡РµРЅР°", "Game over"), score, () => socialStartGame("snake")));
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
    info.textContent = `${tr("РЎС‡РµС‚", "Score")}: ${score}`;
  }

  function gameOver() {
    running = false;
    if (timer) clearTimeout(timer);
    document.removeEventListener("keydown", onKey);
    socialStoreGameScore("tetris", score).catch(() => null);
    socialOpenModal(tr("РўРµС‚СЂРёСЃ", "Tetris"), socialGameOverlay(tr("РРіСЂР° РѕРєРѕРЅС‡РµРЅР°", "Game over"), score, () => socialStartGame("tetris")));
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
      socialOpenModal("2048", socialGameOverlay(tr("РРіСЂР° РѕРєРѕРЅС‡РµРЅР°", "Game over"), score, () => socialStartGame("2048")));
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
    info.textContent = `${tr("РЎС‡РµС‚", "Score")}: ${score}`;
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
    .filter((row) => String(row.kind || "").trim().toLowerCase() !== "global")
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
  if (sameDay) return tr("\u0421\u0435\u0433\u043e\u0434\u043d\u044f", "Today");
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (dt.toDateString() === yesterday.toDateString()) return tr("\u0412\u0447\u0435\u0440\u0430", "Yesterday");
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
  const atWord = currentLang === "en" ? "at" : "\u0432";
  if (dt.toDateString() === now.toDateString()) return `${tr("\u0441\u0435\u0433\u043e\u0434\u043d\u044f", "today")} ${atWord} ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (dt.toDateString() === yesterday.toDateString()) return `${tr("\u0432\u0447\u0435\u0440\u0430", "yesterday")} ${atWord} ${time}`;
  return `${dt.toLocaleDateString(currentLang === "en" ? "en-GB" : "ru-RU", { day: "2-digit", month: "short" })} ${atWord} ${time}`;
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
    tr("\u0427\u0430\u0442", "Chat"),
  ]
    .map((value) => String(value || "").trim())
    .find((value) => Boolean(value))
    || tr("\u0427\u0430\u0442", "Chat");
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
  const avatarNode = document.getElementById("mobileChatCompactAvatar");
  const titleNode = document.getElementById("mobileChatCompactTitle");
  const subtitleNode = document.getElementById("mobileChatCompactSubtitle");
  const chatHead = document.querySelector("#socialSubtabChat .social-chat-head");
  if (!host || !backBtn || !avatarNode || !titleNode || !subtitleNode) return;
  const body = document.body;
  const shell = document.getElementById("appSection");
  const isMobileShell = socialIsMobileClientShell() || socialIsMobileApkShell();
  const isApkShell = socialIsMobileApkShell();
  const inSocialChat = typeof currentTab !== "undefined"
    && String(currentTab || "") === "social"
    && String(socialState.currentSubtab || "") === "chat";
  const activeThread = row || socialGetCurrentThread();
  const layout = document.querySelector("#socialSubtabChat .social-chat-layout");
  const sidebar = layout?.querySelector(".social-chat-sidebar");
  const layoutOpen = Boolean(layout?.classList?.contains("chat-open"))
    || String(layout?.dataset?.threadOpen || "") === "1";
  let sidebarVisible = false;
  try {
    sidebarVisible = Boolean(sidebar) && window.getComputedStyle(sidebar).display !== "none";
  } catch (_) {
    sidebarVisible = Boolean(sidebar);
  }
  const threadOpen = isMobileShell
    && inSocialChat
    && Number(socialState.currentThreadId || 0) > 0
    && Boolean(activeThread)
    && layoutOpen
    && !sidebarVisible;
  const show = isApkShell && threadOpen;
  const listMode = isMobileShell && inSocialChat && !threadOpen;
  const textWrap = titleNode.closest(".mobile-chat-compact-text");
  const openProfile = () => socialOpenCurrentParticipantProfile();
  const bindProfileTap = (node) => {
    if (!node || node.dataset.profileTapBound === "1") return;
    node.dataset.profileTapBound = "1";
    node.addEventListener("click", () => {
      if (!node.classList.contains("is-clickable")) return;
      openProfile();
    });
  };
  bindProfileTap(avatarNode);
  bindProfileTap(textWrap);
  bindProfileTap(titleNode);
  bindProfileTap(subtitleNode);
  const setProfileInteractive = (enabled) => {
    avatarNode.classList.toggle("is-clickable", enabled);
    textWrap?.classList?.toggle("is-clickable", enabled);
    titleNode.classList.toggle("is-clickable", enabled);
    subtitleNode.classList.toggle("is-clickable", enabled);
  };
  host.classList.toggle("hidden", !show);
  backBtn.classList.toggle("hidden", !show);
  body?.classList?.toggle("social-thread-open", threadOpen);
  shell?.classList?.toggle("social-thread-open", threadOpen);
  body?.classList?.toggle("social-chat-list-mode", listMode);
  shell?.classList?.toggle("social-chat-list-mode", listMode);
  chatHead?.classList?.toggle("hidden", threadOpen);
  socialSyncTopMenuButtonMode();
  if (!show) {
    titleNode.textContent = tr("\u0427\u0430\u0442\u044b", "Chats");
    subtitleNode.textContent = "";
    subtitleNode.classList.remove("online-now");
    avatarNode.classList.add("hidden");
    avatarNode.innerHTML = socialAvatarMarkup("", "--", "sm");
    setProfileInteractive(false);
    if (typeof window.refreshSectionHeading === "function") {
      try { window.refreshSectionHeading("social"); } catch (_) {}
    }
    return;
  }
  const display = socialThreadDisplay(activeThread);
  const participants = Array.isArray(display.participants) ? display.participants : [];
  avatarNode.classList.remove("hidden");
  avatarNode.innerHTML = socialAvatarMarkup(display.avatarUrl, display.avatarLabel, "sm", true);
  let subtitle = "";
  let subtitleOnline = false;
  if (activeThread?.kind === "direct") {
    const other = participants.find((p) => !p.is_me);
    const onlineNow = socialIsParticipantOnline(other);
    const lastSeen = socialFormatLastSeen(other?.last_seen_at || "");
    const stateText = onlineNow
      ? tr("\u043e\u043d\u043b\u0430\u0439\u043d", "online")
      : (lastSeen
        ? `${tr("\u0411\u044b\u043b(\u0430) \u0432 \u0441\u0435\u0442\u0438", "last seen")} ${lastSeen}`
        : tr("\u0411\u044b\u043b(\u0430) \u0432 \u0441\u0435\u0442\u0438 \u0434\u0430\u0432\u043d\u043e", "long ago"));
    subtitle = stateText;
    subtitleOnline = onlineNow;
  } else {
    subtitle = `${tr("\u0423\u0447\u0430\u0441\u0442\u043d\u0438\u043a\u043e\u0432", "Members")}: ${participants.length}`;
  }
  titleNode.textContent = String(display.title || tr("\u0427\u0430\u0442", "Chat"));
  subtitleNode.textContent = subtitle;
  subtitleNode.classList.toggle("online-now", subtitleOnline);
  setProfileInteractive(true);
}

function socialSyncTopMenuButtonMode() {
  const btn = document.getElementById("mobileNavToggle");
  if (!btn) return;
  const inSocialChat = String(currentTab || "") === "social"
    && String(socialState.currentSubtab || "") === "chat";
  const mobileShell = socialIsMobileClientShell() || socialIsMobileApkShell();
  const threadMode = mobileShell
    && inSocialChat
    && Boolean(document.body?.classList?.contains("social-thread-open"));
  btn.dataset.menuMode = threadMode ? "thread" : "modules";
  btn.classList.toggle("is-thread-menu", threadMode);
  btn.textContent = threadMode ? "\u22EE" : "\u2630";
  const label = threadMode
    ? tr("\u041c\u0435\u043d\u044e \u0447\u0430\u0442\u0430", "Chat menu")
    : tr("\u041c\u0435\u043d\u044e \u043c\u043e\u0434\u0443\u043b\u0435\u0439", "Modules menu");
  btn.title = label;
  btn.setAttribute("aria-label", label);
}

function socialFilterThreads() {
  const query = String(document.getElementById("socialChatSearch")?.value || "").trim().toLowerCase();
  socialState.chatSearch = query;
  if (socialState.chatSearchTimer) {
    clearTimeout(socialState.chatSearchTimer);
    socialState.chatSearchTimer = null;
  }
  if (!query || query.length < 2) {
    socialState.chatSearchMessageQuery = "";
    socialState.chatSearchMessageThreadIds = [];
    socialRenderThreads();
    return;
  }
  socialState.chatSearchMessageQuery = "";
  socialState.chatSearchMessageThreadIds = [];
  const requestSeq = Number(socialState.chatSearchRequestSeq || 0) + 1;
  socialState.chatSearchRequestSeq = requestSeq;
  socialRenderThreads();
  socialState.chatSearchTimer = setTimeout(() => {
    socialState.chatSearchTimer = null;
    socialFetchThreadSearchMatches(query, requestSeq).catch(() => null);
  }, 220);
}

async function socialFetchThreadSearchMatches(query, requestSeq) {
  const safeQuery = String(query || "").trim().toLowerCase();
  if (!safeQuery || safeQuery.length < 2) return;
  const payload = await socialRequest(`/api/social/chat/search?q=${encodeURIComponent(safeQuery)}`, {
    timeoutMs: 12000,
  }).catch(() => null);
  if (Number(requestSeq || 0) !== Number(socialState.chatSearchRequestSeq || 0)) return;
  if (safeQuery !== String(socialState.chatSearch || "").trim().toLowerCase()) return;
  const ids = Array.isArray(payload?.thread_ids) ? payload.thread_ids : [];
  socialState.chatSearchMessageQuery = safeQuery;
  socialState.chatSearchMessageThreadIds = ids
    .map((x) => Number(x || 0))
    .filter((x) => x > 0);
  socialRenderThreads();
}

function socialSetChatView(open) {
  const layout = document.querySelector("#socialSubtabChat .social-chat-layout");
  if (!layout) return;
  const nextOpen = Boolean(open);
  layout.classList.toggle("chat-open", nextOpen);
  layout.dataset.threadOpen = nextOpen ? "1" : "0";
  socialSyncMobileChatChrome();
  socialApplyChatHeadCollapsed();
  socialSyncTopMenuButtonMode();
}

function socialApplyChatHeadCollapsed() {
  const main = document.querySelector("#socialSubtabChat .social-chat-main");
  const collapseBtn = document.getElementById("socialChatHeadCollapseBtn");
  const collapsed = Boolean(socialState.chatHeadCollapsed);
  if (main) main.classList.toggle("chat-head-collapsed", collapsed);
  if (collapseBtn) {
    collapseBtn.setAttribute("aria-pressed", collapsed ? "true" : "false");
    collapseBtn.textContent = collapsed ? "+" : "-";
    collapseBtn.title = collapsed
      ? tr("Р Р°Р·РІРµСЂРЅСѓС‚СЊ С€Р°РїРєСѓ", "Expand header")
      : tr("РЎРІРµСЂРЅСѓС‚СЊ С€Р°РїРєСѓ", "Collapse header");
  }
}

function socialToggleChatHeadCollapsed() {
  socialState.chatHeadCollapsed = !Boolean(socialState.chatHeadCollapsed);
  socialApplyChatHeadCollapsed();
}

function socialIsThreadOpen() {
  const inChat = String(socialState.currentSubtab || currentSocialSubtab || "") === "chat";
  if (!inChat) return false;
  const currentId = Number(socialState.currentThreadId || 0);
  if (currentId <= 0) return false;
  const layout = document.querySelector("#socialSubtabChat .social-chat-layout");
  const layoutOpen = Boolean(layout?.classList?.contains("chat-open")) || String(layout?.dataset?.threadOpen || "") === "1";
  if (!layoutOpen) return false;
  if (socialGetCurrentThread()) return true;
  if (Number(socialState.loadingMessagesThreadId || 0) === currentId) return true;
  if (String(socialState.chatHeaderSignature || "").trim()) return true;
  return socialHasRenderedMessages();
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
  socialState.loadingMessagesThreadId = 0;
  socialState.chatHeaderSignature = "";
  socialState.chatContextMessageId = 0;
  socialState.chatContextThreadId = 0;
  socialState.mobileThreadAutoSelectEnabled = Boolean(opts.keepAutoSelect) || !socialIsMobileClientShell();
  socialState.chatManualClosedUntil = Boolean(opts.keepAutoSelect) ? 0 : (Date.now() + 30000);
  socialState.chatMessages = [];
  socialState.chatOldestId = 0;
  socialState.chatHasMore = true;
  socialState.chatHeadCollapsed = false;
  socialClearReply();
  socialCloseMessageContext();
  socialCloseImageViewer();
  const head = document.getElementById("socialChatHead");
  const sub = document.getElementById("socialChatHeadSubtitle");
  const avatar = document.getElementById("socialChatHeadAvatar");
  const meta = document.getElementById("socialChatHeadMeta");
  const avatarBtn = document.getElementById("socialChatAvatarBtn");
  const groupBtn = document.getElementById("socialChatGroupBtn");
  const menuBtn = document.getElementById("socialChatMenuBtn");
  const collapseBtn = document.getElementById("socialChatHeadCollapseBtn");
  const host = document.getElementById("socialChatMessages");
  if (head) head.textContent = tr("\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0447\u0430\u0442", "Select chat");
  if (sub) sub.textContent = "-";
  if (avatar) avatar.innerHTML = socialAvatarMarkup("", "--", "md");
  if (meta) {
    meta.textContent = "";
    meta.classList.add("hidden");
  }
  if (avatarBtn) avatarBtn.classList.add("hidden");
  if (groupBtn) groupBtn.classList.add("hidden");
  if (menuBtn) menuBtn.classList.add("hidden");
  if (collapseBtn) collapseBtn.classList.add("hidden");
  if (host) host.innerHTML = "";
  socialRenderThreads();
  socialSetChatView(false);
  socialSyncMobileChatChrome(null);
  socialApplyChatHeadCollapsed();
  socialSyncChatComposerState();
}
function socialRenderThreads() {
  const host = document.getElementById("socialChatThreads");
  if (!host) return;
  const query = String(socialState.chatSearch || "").trim().toLowerCase();
  const hasQuery = Boolean(query);
  const messageMatchSet = (
    query.length >= 2
    && String(socialState.chatSearchMessageQuery || "") === query
  )
    ? new Set(
      (Array.isArray(socialState.chatSearchMessageThreadIds) ? socialState.chatSearchMessageThreadIds : [])
        .map((x) => Number(x || 0))
        .filter((x) => x > 0)
    )
    : null;
  const rows = hasQuery
    ? socialState.chatThreads.filter((thread) => {
      const participants = Array.isArray(thread?.participants) ? thread.participants : [];
      const lastText = String(thread?.last_message?.text || "");
      const hay = `${thread?.title || ""} ${thread?.kind || ""} ${lastText} ${participants.map((p) => p?.nick || "").join(" ")}`.toLowerCase();
      if (hay.includes(query)) return true;
      if (!messageMatchSet) return false;
      return messageMatchSet.has(Number(thread?.id || 0));
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
          <div class="social-thread-preview">${escapeHtml(lastText || tr("\u0421\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0439 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442", "No messages yet"))}</div>
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
  const menuBtn = document.getElementById("socialChatMenuBtn");
  const collapseBtn = document.getElementById("socialChatHeadCollapseBtn");
  if (!row) {
    socialState.chatHeaderSignature = "";
    if (head) head.textContent = tr("\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0447\u0430\u0442", "Select chat");
    if (sub) sub.textContent = "-";
    if (avatar) avatar.innerHTML = socialAvatarMarkup("", "--", "md");
    if (meta) {
      meta.textContent = "";
      meta.classList.add("hidden");
    }
    if (avatarBtn) avatarBtn.classList.add("hidden");
    if (groupBtn) groupBtn.classList.add("hidden");
    if (menuBtn) menuBtn.classList.add("hidden");
    if (collapseBtn) collapseBtn.classList.add("hidden");
    socialSyncMobileChatChrome(null);
    socialApplyChatHeadCollapsed();
    return;
  }
  const display = socialThreadDisplay(row);
  const participants = display.participants || [];
  const subtitle = row.kind === "direct"
    ? tr("\u041b\u0438\u0447\u043d\u044b\u0439 \u0447\u0430\u0442", "Direct chat")
    : `${tr("\u0413\u0440\u0443\u043f\u043f\u0430", "Group")} - ${participants.length}`;
  let lastSeenLabel = "";
  let onlineNow = false;
  if (row.kind === "direct") {
    const other = participants.find((p) => !p.is_me);
    onlineNow = socialIsParticipantOnline(other);
    lastSeenLabel = onlineNow
      ? tr("\u043e\u043d\u043b\u0430\u0439\u043d", "online now")
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
    socialApplyChatHeadCollapsed();
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
      const label = lastSeenLabel || tr("\u043d\u0435\u0442 \u0434\u0430\u043d\u043d\u044b\u0445", "unknown");
      meta.textContent = `${tr("\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0439 \u0440\u0430\u0437 \u0432 \u0441\u0435\u0442\u0438", "Last seen")}: ${label}`;
      meta.classList.toggle("online-now", onlineNow);
      meta.classList.remove("hidden");
    } else {
      meta.textContent = "";
      meta.classList.remove("online-now");
      meta.classList.add("hidden");
    }
  }
  if (avatarBtn) avatarBtn.classList.add("hidden");
  if (groupBtn) groupBtn.classList.add("hidden");
  if (menuBtn) menuBtn.classList.remove("hidden");
  if (collapseBtn) collapseBtn.classList.remove("hidden");
  socialSyncMobileChatChrome(row);
  socialApplyChatHeadCollapsed();
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
  const kind = String(row.kind || "").trim().toLowerCase();
  if (kind === "group" || kind === "company") {
    socialOpenGroupParticipants();
    return;
  }
  const peer = socialCurrentDirectPeer(row);
  if (!peer || !peer.actor_key) return;
  socialOpenParticipantProfile(peer.actor_key, Number(row.id || 0));
}

function socialOpenChatActionsMenu() {
  const row = socialGetCurrentThread();
  if (!row) return;
  const kind = String(row.kind || "").trim().toLowerCase();
  const isGroup = kind === "group";
  const isCompany = kind === "company";
  const isTeamThread = isGroup || isCompany;
  const collapsed = Boolean(socialState.chatHeadCollapsed);
  const actions = [];
  actions.push(`
    <button type="button" class="btn-secondary" data-chat-action="toggle_header">
      ${escapeHtml(collapsed ? tr("Р Р°Р·РІРµСЂРЅСѓС‚СЊ С€Р°РїРєСѓ", "Expand header") : tr("РЎРІРµСЂРЅСѓС‚СЊ С€Р°РїРєСѓ", "Collapse header"))}
    </button>
  `);
  if (isTeamThread) {
    actions.push(`
      <button type="button" data-chat-action="participants">${escapeHtml(tr("РЈС‡Р°СЃС‚РЅРёРєРё", "Participants"))}</button>
      <button type="button" class="btn-secondary" data-chat-action="group_avatar">${escapeHtml(tr("РђРІР°С‚Р°СЂ С‡Р°С‚Р°", "Chat avatar"))}</button>
    `);
    if (isGroup) {
      actions.push(`
        <button type="button" data-chat-action="manage_group">${escapeHtml(tr("РР·РјРµРЅРёС‚СЊ СЃРѕСЃС‚Р°РІ", "Edit members"))}</button>
        <button type="button" class="btn-danger" data-chat-action="delete_group">${escapeHtml(tr("РЈРґР°Р»РёС‚СЊ РіСЂСѓРїРїСѓ", "Delete group"))}</button>
      `);
    }
    if (isCompany) {
      actions.push(`
        <button type="button" data-chat-action="manage_company">${escapeHtml(tr("РџРµСЂРµРёРјРµРЅРѕРІР°С‚СЊ С‡Р°С‚", "Rename chat"))}</button>
      `);
    }
  } else {
    actions.push(`
      <button type="button" data-chat-action="profile">${escapeHtml(tr("РћС‚РєСЂС‹С‚СЊ РїСЂРѕС„РёР»СЊ", "Open profile"))}</button>
    `);
  }
  actions.push(`
    <button type="button" class="btn-secondary" data-chat-action="direct">${escapeHtml(tr("Р›РёС‡РЅС‹Р№ С‡Р°С‚", "Direct chat"))}</button>
    <button type="button" class="btn-secondary" data-chat-action="new_group">${escapeHtml(tr("РќРѕРІР°СЏ РіСЂСѓРїРїР°", "New group"))}</button>
  `);
  socialOpenModal(
    tr("Р”РµР№СЃС‚РІРёСЏ С‡Р°С‚Р°", "Chat actions"),
    `<div class="social-chat-actions-menu">${actions.join("")}</div>`
  );
  document.querySelectorAll("[data-chat-action]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const action = String(btn.getAttribute("data-chat-action") || "").trim();
      socialCloseModal();
      if (action === "toggle_header") {
        socialToggleChatHeadCollapsed();
        return;
      }
      if (action === "participants") {
        socialOpenGroupParticipants();
        return;
      }
      if (action === "manage_group") {
        socialOpenGroupEditor(true);
        return;
      }
      if (action === "manage_company") {
        socialOpenCompanyChatEditor();
        return;
      }
      if (action === "group_avatar") {
        socialOpenGroupAvatarModal();
        return;
      }
      if (action === "delete_group") {
        await socialDeleteCurrentGroupThread();
        return;
      }
      if (action === "profile") {
        socialOpenCurrentParticipantProfile();
        return;
      }
      if (action === "direct") {
        socialOpenDirectPicker();
        return;
      }
      if (action === "new_group") {
        socialOpenGroupEditor();
      }
    });
  });
}
async function socialDeleteCurrentGroupThread() {
  const row = socialGetCurrentThread();
  const threadId = Number(row?.id || 0);
  if (!threadId || String(row?.kind || "") !== "group") return;
  const title = String(row?.title || tr("СЌС‚Сѓ РіСЂСѓРїРїСѓ", "this group")).trim();
  const ok = confirm(tr(`РЈРґР°Р»РёС‚СЊ РіСЂСѓРїРїСѓ "${title}"? Р­С‚Рѕ РґРµР№СЃС‚РІРёРµ РЅРµРѕР±СЂР°С‚РёРјРѕ.`, `Delete group "${title}"? This action cannot be undone.`));
  if (!ok) return;
  const result = await socialRequest(`/api/social/chat/groups/${threadId}`, {
    method: "DELETE",
    retryOnPost: false,
    maxRetries: 0,
  }).catch((e) => {
    alert(e?.message || tr("РќРµ СѓРґР°Р»РѕСЃСЊ СѓРґР°Р»РёС‚СЊ РіСЂСѓРїРїСѓ", "Failed to delete group"));
    return null;
  });
  if (!result) return;
  socialCloseThread({ keepAutoSelect: false });
  await socialLoadThreads({ silent: true });
  if (typeof socialShowToast === "function") {
    socialShowToast(tr("Р“СЂСѓРїРїР° СѓРґР°Р»РµРЅР°", "Group deleted"), tr("Р§Р°С‚ СѓРґР°Р»РµРЅ РёР· СЃРїРёСЃРєР°.", "The chat was removed from the list."));
  }
}

function socialOpenModulesMenu() {
  const shell = document.getElementById("appSection");
  if (shell) shell.classList.add("nav-open");
  const btn = document.getElementById("mobileNavToggle");
  if (btn) btn.setAttribute("aria-expanded", "true");
}

function socialOpenChatQuickMenu() {
  const hasThread = Number(socialState.currentThreadId || 0) > 0;
  const html = `
    <div class="social-chat-actions-menu">
      <button type="button" data-chat-quick="direct">${escapeHtml(tr("Р›РёС‡РЅС‹Р№ С‡Р°С‚", "Direct chat"))}</button>
      <button type="button" data-chat-quick="group">${escapeHtml(tr("РќРѕРІР°СЏ РіСЂСѓРїРїР°", "New group"))}</button>
      ${hasThread ? `<button type="button" class="btn-secondary" data-chat-quick="actions">${escapeHtml(tr("Р”РµР№СЃС‚РІРёСЏ С‚РµРєСѓС‰РµРіРѕ С‡Р°С‚Р°", "Current chat actions"))}</button>` : ""}
    </div>
  `;
  socialOpenModal(tr("Р§Р°С‚С‹", "Chats"), html);
  document.querySelectorAll("[data-chat-quick]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = String(btn.getAttribute("data-chat-quick") || "").trim();
      socialCloseModal();
      if (action === "direct") {
        socialOpenDirectPicker();
        return;
      }
      if (action === "group") {
        socialOpenGroupEditor();
        return;
      }
      if (action === "actions") {
        socialOpenChatActionsMenu();
      }
    });
  });
}

function socialOpenThreadMenu() {
  const inSocialChat = String(currentTab || "") === "social"
    && String(socialState.currentSubtab || "") === "chat";
  if (!inSocialChat || !socialIsThreadOpen()) return false;
  const row = socialGetCurrentThread();
  if (!row) return false;
  const kind = String(row.kind || "").trim().toLowerCase();
  const isGroup = kind === "group";
  const isCompany = kind === "company";
  const isTeamThread = isGroup || isCompany;
  const items = [];
  if (isTeamThread) {
    if (isGroup) {
      items.push({
        label: tr("РЈРїСЂР°РІР»РµРЅРёРµ РіСЂСѓРїРїРѕР№", "Manage group"),
        run: () => socialOpenGroupEditor(true),
      });
    }
    if (isCompany) {
      items.push({
        label: tr("РќР°СЃС‚СЂРѕР№РєРё С‡Р°С‚Р° РєРѕРјРїР°РЅРёРё", "Company chat settings"),
        run: () => socialOpenCompanyChatEditor(),
      });
    }
    items.push({
      label: tr("РЈС‡Р°СЃС‚РЅРёРєРё", "Participants"),
      run: () => socialOpenGroupParticipants(),
    });
    items.push({
      label: tr("РђРІР°С‚Р°СЂ С‡Р°С‚Р°", "Chat avatar"),
      run: () => socialOpenGroupAvatarModal(),
    });
    if (isGroup) {
      items.push({
        label: tr("РЈРґР°Р»РёС‚СЊ РіСЂСѓРїРїСѓ", "Delete group"),
        run: () => socialDeleteCurrentGroupThread(),
      });
    }
  } else {
    items.push({
      label: tr("РџСЂРѕС„РёР»СЊ СЃРѕР±РµСЃРµРґРЅРёРєР°", "Open profile"),
      run: () => socialOpenCurrentParticipantProfile(),
    });
  }
  items.push({
    label: tr("Р—Р°РєСЂС‹С‚СЊ С‡Р°С‚", "Close chat"),
    run: () => socialCloseThread({ keepAutoSelect: false }),
  });
  const itemsHtml = items.map((item, index) => `
    <button type="button" class="btn-secondary social-thread-menu-btn" data-social-thread-menu-item="${index}">
      ${escapeHtml(item.label)}
    </button>
  `).join("");
  socialOpenModal(
    tr("РњРµРЅСЋ С‡Р°С‚Р°", "Chat menu"),
    `<div class="social-thread-menu-list">${itemsHtml}</div>`
  );
  document.querySelectorAll("[data-social-thread-menu-item]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const index = Number(btn.getAttribute("data-social-thread-menu-item") || -1);
      const action = index >= 0 ? items[index] : null;
      socialCloseModal();
      if (!action || typeof action.run !== "function") return;
      setTimeout(() => {
        try { action.run(); } catch (_) {}
      }, 0);
    });
  });
  return true;
}
function socialOpenGroupParticipants() {
  const row = socialGetCurrentThread();
  const kind = String(row?.kind || "").trim().toLowerCase();
  const isGroup = kind === "group";
  const isCompany = kind === "company";
  if (!row || (!isGroup && !isCompany)) return;
  const threadId = Number(row.id || 0);
  const participants = Array.isArray(row.participants) ? row.participants : [];
  const listHtml = participants.map((p) => {
    const actorKey = String(p?.actor_key || "").trim();
    const nick = String(p?.nick || actorKey || "-").trim() || "-";
    const online = socialIsParticipantOnline(p);
    const state = online
      ? tr("РѕРЅР»Р°Р№РЅ", "online now")
      : (socialFormatLastSeen(p?.last_seen_at || "") || tr("РЅРµС‚ РґР°РЅРЅС‹С…", "unknown"));
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
  const actionsHtml = isGroup
    ? `
      <div class="actions social-group-participants-actions">
        <button type="button" onclick="socialOpenGroupEditor(true)">${escapeHtml(tr("РР·РјРµРЅРёС‚СЊ СЃРѕСЃС‚Р°РІ", "Edit members"))}</button>
        <button type="button" class="btn-danger" onclick="socialDeleteCurrentGroupThread()">${escapeHtml(tr("РЈРґР°Р»РёС‚СЊ РіСЂСѓРїРїСѓ", "Delete group"))}</button>
      </div>
    `
    : `
      <div class="actions social-group-participants-actions">
        <button type="button" onclick="socialOpenCompanyChatEditor()">${escapeHtml(tr("РќР°СЃС‚СЂРѕР№РєРё С‡Р°С‚Р°", "Chat settings"))}</button>
      </div>
    `;
  socialOpenModal(
    isCompany ? tr("РЈС‡Р°СЃС‚РЅРёРєРё С‡Р°С‚Р° РєРѕРјРїР°РЅРёРё", "Company chat members") : tr("РЈС‡Р°СЃС‚РЅРёРєРё РіСЂСѓРїРїС‹", "Group participants"),
    `
      ${actionsHtml}
      <div class="social-participant-list">
        ${listHtml || `<div class="hint">${escapeHtml(tr("РЎРїРёСЃРѕРє СѓС‡Р°СЃС‚РЅРёРєРѕРІ РїСѓСЃС‚.", "No participants yet."))}</div>`}
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
    alert(e?.message || tr("\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043e\u0442\u043a\u0440\u044b\u0442\u044c \u043f\u0440\u043e\u0444\u0438\u043b\u044c", "Failed to open profile"));
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
    ? tr("\u043e\u043d\u043b\u0430\u0439\u043d", "online now")
    : (socialFormatLastSeen(String(profile.last_seen_at || "")) || tr("\u043d\u0435\u0442 \u0434\u0430\u043d\u043d\u044b\u0445", "unknown"));
  socialOpenModal(
    tr("\u041f\u0440\u043e\u0444\u0438\u043b\u044c \u0443\u0447\u0430\u0441\u0442\u043d\u0438\u043a\u0430", "Participant profile"),
    `
      <div class="social-profile-view">
        <div class="social-profile-head">
          ${socialAvatarMarkup(String(profile.avatar_url || ""), nick, "md", true)}
          <div class="social-profile-head-text">
            <h4>${escapeHtml(nick)}</h4>
            <div class="hint">${escapeHtml(isOwner ? tr("\u0412\u043b\u0430\u0434\u0435\u043b\u0435\u0446", "Owner") : tr("\u0421\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a", "Employee"))}</div>
          </div>
        </div>
        <div class="social-profile-grid">
          <div><span>${escapeHtml(tr("\u041f\u043e\u043b\u043d\u043e\u0435 \u0438\u043c\u044f", "Full name"))}</span><b>${escapeHtml(fullName || "-")}</b></div>
          <div><span>${escapeHtml(tr("Email", "Email"))}</span><b>${escapeHtml(email || "-")}</b></div>
          <div><span>${escapeHtml(tr("\u041a\u043e\u043c\u043f\u0430\u043d\u0438\u044f", "Company"))}</span><b>${escapeHtml(company || "-")}</b></div>
          <div><span>${escapeHtml(tr("\u0413\u043e\u0440\u043e\u0434", "City"))}</span><b>${escapeHtml(city || "-")}</b></div>
          <div><span>${escapeHtml(tr("\u0414\u043e\u043b\u0436\u043d\u043e\u0441\u0442\u044c", "Position"))}</span><b>${escapeHtml(position || "-")}</b></div>
          <div><span>${escapeHtml(tr("\u0421\u0442\u0430\u0442\u0443\u0441", "Status"))}</span><b>${escapeHtml(lastSeen)}</b></div>
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
    socialSyncChatComposerState();
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
  socialSyncChatComposerState();
  const host = document.getElementById("socialChatMessages");
  if (host && Number(socialState.currentThreadId || 0) === id) {
    host.innerHTML = `<div class="hint social-chat-loading">${tr("\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0439...", "Loading messages...")}</div>`;
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
      <small>${escapeHtml(tr("\u041e\u0442\u0432\u0435\u0442 \u043d\u0430 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435", "Reply to message"))}</small>
      <b>${escapeHtml(String(row.sender_nick || "-"))}</b>
      <span>${escapeHtml(String(row.text || "").slice(0, 180))}</span>
    </div>
    <button type="button" class="btn-secondary" onclick="socialClearReply()">${tr("\u041e\u0442\u043c\u0435\u043d\u0430", "Cancel")}</button>
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

function socialGetImageViewerNode() {
  let viewer = document.getElementById("socialChatImageViewer");
  if (viewer) return viewer;
  const root = document.body || document.documentElement;
  if (!root) return null;
  viewer = document.createElement("div");
  viewer.id = "socialChatImageViewer";
  viewer.className = "social-chat-image-viewer hidden";
  viewer.setAttribute("aria-hidden", "true");
  viewer.innerHTML = `
    <button type="button" class="social-chat-image-close" aria-label="${escapeHtml(tr("\u0417\u0430\u043a\u0440\u044b\u0442\u044c", "Close"))}" onclick="return socialCloseImageViewer(event)">&#10005;</button>
    <div class="social-chat-image-shell"><img id="socialChatImageViewerImg" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" /></div>
  `;
  viewer.addEventListener("click", (event) => {
    if (event?.target === viewer) socialCloseImageViewer();
  });
  const shell = viewer.querySelector(".social-chat-image-shell");
  if (shell) {
    shell.addEventListener("click", (event) => {
      if (event?.stopPropagation) event.stopPropagation();
    });
  }
  root.appendChild(viewer);
  return viewer;
}

function socialIsImageViewerOpen() {
  const viewer = document.getElementById("socialChatImageViewer");
  return Boolean(viewer && !viewer.classList.contains("hidden"));
}

function socialOpenImageViewer(url, alt = "") {
  const safeUrl = String(url || "").trim();
  if (!safeUrl) return false;
  const viewer = socialGetImageViewerNode();
  if (!viewer) return false;
  const img = viewer.querySelector("#socialChatImageViewerImg");
  if (!(img instanceof HTMLImageElement)) return false;
  img.src = safeUrl;
  img.alt = String(alt || "").trim();
  viewer.classList.remove("hidden");
  viewer.setAttribute("aria-hidden", "false");
  socialState.chatImageViewerOpen = true;
  document.body?.classList?.add("social-image-viewer-open");
  return true;
}

function socialCloseImageViewer(event = null) {
  if (event?.preventDefault) event.preventDefault();
  if (event?.stopPropagation) event.stopPropagation();
  const viewer = document.getElementById("socialChatImageViewer");
  if (!viewer) return false;
  const img = viewer.querySelector("#socialChatImageViewerImg");
  if (img instanceof HTMLImageElement) {
    img.removeAttribute("src");
    img.alt = "";
  }
  viewer.classList.add("hidden");
  viewer.setAttribute("aria-hidden", "true");
  socialState.chatImageViewerOpen = false;
  document.body?.classList?.remove("social-image-viewer-open");
  return false;
}

function socialOpenImageFromAttachment(event) {
  const target = event?.currentTarget || event?.target?.closest?.(".tg-attach-image");
  if (!(target instanceof HTMLElement)) return true;
  const href = String(target.getAttribute("href") || "").trim();
  if (!href) return true;
  const alt = String(target.getAttribute("data-image-alt") || target.querySelector("img")?.getAttribute("alt") || "");
  const opened = socialOpenImageViewer(href, alt);
  if (opened) {
    if (event?.preventDefault) event.preventDefault();
    if (event?.stopPropagation) event.stopPropagation();
    socialCloseMessageContext();
    return false;
  }
  return true;
}

function socialHandleMobileBack() {
  if (socialIsImageViewerOpen()) {
    socialCloseImageViewer();
    return true;
  }
  if (typeof socialCloseNotificationCenter === "function" && socialCloseNotificationCenter(true)) {
    return true;
  }
  const menu = document.getElementById("socialChatContextMenu");
  if (menu && !menu.classList.contains("hidden")) {
    socialCloseMessageContext();
    return true;
  }
  const picker = document.getElementById("socialEmojiPicker");
  if (picker && !picker.classList.contains("hidden")) {
    socialToggleEmojiPicker(false);
    return true;
  }
  const daySheet = document.getElementById("socialCalendarDaySheet");
  if (daySheet && !daySheet.classList.contains("hidden")) {
    socialHideCalendarDaySheet();
    return true;
  }
  const modal = document.getElementById("socialModal");
  if (modal && !modal.classList.contains("hidden")) {
    socialCloseModal();
    return true;
  }
  if (Number(socialState.chatReplyTo?.id || 0) > 0) {
    socialClearReply();
    return true;
  }
  return false;
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
  const bubble = event?.target?.closest?.(".tg-msg-bubble") || event?.currentTarget?.closest?.(".tg-msg-bubble") || event?.target || null;
  const rect = bubble?.getBoundingClientRect ? bubble.getBoundingClientRect() : null;
  const fallbackX = Number(event?.clientX || 0) || Number(rect?.left || 0) + Math.max(18, Math.min(42, Number(rect?.width || 0) * 0.6));
  const fallbackY = Number(event?.clientY || 0) || Number(rect?.top || 0) + Math.max(18, Math.min(30, Number(rect?.height || 0) * 0.45));
  socialState.chatContextX = fallbackX;
  socialState.chatContextY = fallbackY;
  const quick = ["рџ‘Ќ", "рџ”Ґ", "вќ¤пёЏ", "рџ‚", "рџ™Џ", "вњ…"];
  menu.innerHTML = `
    <button type="button" class="social-chat-context-btn" onclick="socialContextReply()">${tr("РћС‚РІРµС‚РёС‚СЊ", "Reply")}</button>
    <div class="social-chat-context-reactions">
      ${quick.map((emoji) => `<button type="button" class="social-chat-context-emoji" onclick="socialContextReact('${escapeHtml(emoji)}')">${emoji}</button>`).join("")}
    </div>
  `;
  menu.style.left = "0px";
  menu.style.top = "0px";
  menu.style.maxWidth = "min(260px, calc(100vw - 20px))";
  menu.style.maxHeight = "min(220px, calc(100dvh - 20px))";
  menu.style.visibility = "hidden";
  menu.classList.remove("hidden");
  const menuRect = menu.getBoundingClientRect();
  const vw = window.innerWidth || document.documentElement.clientWidth || 0;
  const vh = window.innerHeight || document.documentElement.clientHeight || 0;
  const safeTop = 10;
  const safeRight = 10;
  const safeBottom = 10;
  const safeLeft = 10;
  let nextX = Number(rect?.left || fallbackX) + 8;
  let nextY = Number(rect?.bottom || fallbackY) + 8;
  if (nextX + menuRect.width + safeRight > vw) {
    nextX = Number(rect?.right || fallbackX) - menuRect.width;
  }
  if (nextY + menuRect.height + safeBottom > vh) {
    nextY = Number(rect?.top || fallbackY) - menuRect.height - 8;
  }
  if (nextY < safeTop && rect) {
    nextY = Math.max(safeTop, Math.min(vh - menuRect.height - safeBottom, rect.top + Math.max(8, rect.height * 0.2)));
  }
  if (nextX < safeLeft && rect) {
    nextX = Math.max(safeLeft, Math.min(vw - menuRect.width - safeRight, rect.right - menuRect.width));
  }
  const clampedX = Math.max(safeLeft, Math.min(nextX, Math.max(safeLeft, vw - menuRect.width - safeRight)));
  const clampedY = Math.max(safeTop, Math.min(nextY, Math.max(safeTop, vh - menuRect.height - safeBottom)));
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
      return `<a class="tg-attach tg-attach-image" href="${escapeHtml(url)}" data-image-alt="${escapeHtml(name)}" onclick="return socialOpenImageFromAttachment(event)"><img src="${escapeHtml(url)}" alt="${escapeHtml(name)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" /></a>`;
    }
    return `<a class="tg-attach tg-attach-file" href="${escapeHtml(url)}" target="_blank" rel="noopener">рџ“Ћ ${escapeHtml(name)}</a>`;
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
    sending: tr("РћС‚РїСЂР°РІР»СЏРµС‚СЃСЏвЂ¦", "Sending..."),
    failed: tr("РќРµ РѕС‚РїСЂР°РІР»РµРЅРѕ", "Not sent"),
    sent: tr("РћС‚РїСЂР°РІР»РµРЅРѕ, РЅРµ РїСЂРѕС‡РёС‚Р°РЅРѕ", "Sent, unread"),
    read: tr("РџСЂРѕС‡РёС‚Р°РЅРѕ", "Read"),
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
    tr("РђРІР°С‚Р°СЂ С‡Р°С‚Р°", "Chat avatar"),
    `
      <div class="social-avatar-editor">
        <div class="team-avatar-row">
          <div id="socialGroupAvatarPreview" class="profile-avatar-preview">--</div>
          <div class="team-avatar-controls">
            <label class="admin-user-field">
              <span>${escapeHtml(tr("РЎСЃС‹Р»РєР° РЅР° Р°РІР°С‚Р°СЂ", "Avatar URL"))}</span>
              <input id="socialGroupAvatarUrl" placeholder="https://..." />
            </label>
            <div id="socialGroupAvatarPicker" class="avatar-picker">${pickerHtml}</div>
          </div>
        </div>
        <div class="actions">
          <button id="socialGroupAvatarUploadBtn" class="btn-secondary" type="button">${tr("Р—Р°РіСЂСѓР·РёС‚СЊ С„Р°Р№Р»", "Upload file")}</button>
          <input id="socialGroupAvatarFileInput" type="file" accept="image/*" class="hidden" />
          <button id="socialGroupAvatarSave" type="button">${tr("РЎРѕС…СЂР°РЅРёС‚СЊ", "Save")}</button>
          <button id="socialGroupAvatarClear" class="btn-secondary" type="button">${tr("РЈРґР°Р»РёС‚СЊ", "Clear")}</button>
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
  const uploadBtn = document.getElementById("socialGroupAvatarUploadBtn");
  const uploadInput = document.getElementById("socialGroupAvatarFileInput");
  uploadBtn?.addEventListener("click", () => {
    uploadInput?.click();
  });
  uploadInput?.addEventListener("change", async () => {
    const file = uploadInput?.files?.[0] || null;
    if (!file) return;
    const prevText = String(uploadBtn?.textContent || "");
    if (uploadBtn) {
      uploadBtn.disabled = true;
      uploadBtn.textContent = tr("Р—Р°РіСЂСѓР·РєР°...", "Uploading...");
    }
    try {
      const updated = await socialUploadGroupAvatarFile(file);
      if (updated && input) {
        input.value = String(updated.avatar_url || "").trim();
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
      document.querySelectorAll("#socialGroupAvatarPicker .avatar-chip").forEach((el) => {
        el.classList.remove("active");
      });
    } finally {
      if (uploadBtn) {
        uploadBtn.disabled = false;
        uploadBtn.textContent = prevText || tr("Р—Р°РіСЂСѓР·РёС‚СЊ С„Р°Р№Р»", "Upload file");
      }
      if (uploadInput) uploadInput.value = "";
    }
  });
}

async function socialUploadGroupAvatarFile(file) {
  const thread = socialGetCurrentThread();
  if (!thread || !file) return null;
  const type = String(file?.type || "").toLowerCase();
  if (type && !type.startsWith("image/")) {
    alert(tr("РќСѓР¶РЅРѕ РІС‹Р±СЂР°С‚СЊ РёР·РѕР±СЂР°Р¶РµРЅРёРµ", "Please choose an image file"));
    return null;
  }
  const form = new FormData();
  form.append("file", file, String(file.name || "group-avatar"));
  const updated = await socialRequest(`/api/social/chat/threads/${Number(thread.id)}/avatar/upload`, {
    method: "POST",
    body: form,
    retryOnPost: false,
    maxRetries: 0,
  }).catch((e) => {
    if (e?.message) alert(e.message);
    return null;
  });
  if (!updated || typeof updated !== "object") return null;
  const idx = socialState.chatThreads.findIndex((x) => Number(x.id) === Number(updated.id));
  if (idx >= 0) socialState.chatThreads[idx] = updated;
  socialSetChatHeader(updated, { force: true });
  socialRenderThreads();
  return updated;
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
    ? `<button class="btn-secondary social-chat-loadmore" type="button" onclick="socialLoadOlderMessages()">${tr("Р—Р°РіСЂСѓР·РёС‚СЊ СЂР°РЅСЊС€Рµ", "Load earlier")}</button>`
    : `<div class="hint">${tr("РќР°С‡Р°Р»Рѕ С‡Р°С‚Р°", "Start of chat")}</div>`;
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
        host.innerHTML = `<div class="hint social-chat-error">${escapeHtml(tr("РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ СЃРѕРѕР±С‰РµРЅРёСЏ. РџРѕС‚СЏРЅРёС‚Рµ РІРЅРёР· РёР»Рё РѕС‚РєСЂРѕР№С‚Рµ С‡Р°С‚ СЃРЅРѕРІР°.", "Failed to load messages. Pull to refresh or reopen the chat."))}</div>`;
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
    socialSyncChatComposerState();
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
      alert(data.message || tr("РћС€РёР±РєР° РѕС‚РїСЂР°РІРєРё СЃРѕРѕР±С‰РµРЅРёСЏ", "Failed to send message"));
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
    socialSyncChatComposerState();
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
  socialSyncChatComposerState();
  try {
    let hasSuccess = false;
    for (const sourceFile of files) {
      let prep = { file: sourceFile, compressed: false };
      if (socialIsImageFile(sourceFile)) {
        prep = await socialCompressImageForChat(sourceFile).catch(() => ({ file: sourceFile, compressed: false }));
      }
      let uploadFile = prep?.file || sourceFile;
      if (Number(uploadFile?.size || 0) > SOCIAL_CHAT_UPLOAD_MAX_BYTES) {
        alert(socialBuildUploadLargeError(uploadFile, SOCIAL_CHAT_UPLOAD_MAX_BYTES));
        continue;
      }
      if (prep?.compressed && typeof socialShowToast === "function") {
        const before = socialFormatFileSize(prep.originalSize || sourceFile.size || 0);
        const after = socialFormatFileSize(prep.compressedSize || uploadFile.size || 0);
        socialShowToast(
          tr("Р¤РѕС‚Рѕ РѕРїС‚РёРјРёР·РёСЂРѕРІР°РЅРѕ", "Image optimized"),
          tr(`Р Р°Р·РјРµСЂ СѓРјРµРЅСЊС€РµРЅ: ${before} -> ${after}.`, `Size reduced: ${before} -> ${after}.`)
        );
      }

      let requestId = socialGetUploadRequestId(socialBuildFileUploadFingerprint(uploadFile, threadId, text, replyId || 0));
      let row = null;
      let uploadError = null;
      try {
        row = await socialSendChatFile(threadId, uploadFile, text, replyId, requestId);
      } catch (e) {
        uploadError = e;
      }

      if (!row && uploadError && Number(uploadError?.status || 0) === 413 && socialIsImageFile(sourceFile) && !prep?.compressed) {
        const forcedPrep = await socialCompressImageForChat(sourceFile, { force: true }).catch(() => ({ file: sourceFile, compressed: false }));
        if (forcedPrep?.compressed && forcedPrep.file) {
          uploadFile = forcedPrep.file;
          requestId = socialGetUploadRequestId(socialBuildFileUploadFingerprint(uploadFile, threadId, text, replyId || 0));
          try {
            row = await socialSendChatFile(threadId, uploadFile, text, replyId, requestId);
            uploadError = null;
            if (typeof socialShowToast === "function") {
              const before = socialFormatFileSize(sourceFile.size || 0);
              const after = socialFormatFileSize(uploadFile.size || 0);
              socialShowToast(
                tr("Р¤РѕС‚Рѕ РґРѕРїРѕР»РЅРёС‚РµР»СЊРЅРѕ СЃР¶Р°С‚Рѕ", "Image compressed more"),
                tr(`РћС‚РїСЂР°РІРёР»Рё РїРѕСЃР»Рµ РґРѕРїРѕР»РЅРёС‚РµР»СЊРЅРѕРіРѕ СЃР¶Р°С‚РёСЏ: ${before} -> ${after}.`, `Sent after additional compression: ${before} -> ${after}.`)
              );
            }
          } catch (retryErr) {
            uploadError = retryErr;
          }
        }
      }

      if (!row) {
        alert(socialBuildUploadErrorMessage(uploadError, uploadFile));
        continue;
      }
      hasSuccess = true;
    }
    socialClearReply();
    if (input) input.value = "";
    if (hasSuccess || files.length) {
      await socialLoadMessages(threadId, { silent: true });
      await socialLoadThreads({ silent: true });
    }
  } finally {
    socialState.fileUploadInFlight = false;
    if (attachBtn) attachBtn.disabled = false;
    socialSyncChatComposerState();
  }
}
async function socialOpenDirectPicker() {
  socialOpenModal(
    tr("\u041b\u0438\u0447\u043d\u044b\u0439 \u0447\u0430\u0442", "Direct chat"),
    `
      <div class="grid-2">
        <input id="socialDirectSearch" placeholder="${tr("РџРѕРёСЃРє РїРѕ email", "Search by email")}" oninput="socialFilterDirectActors()" />
        <button type="button" onclick="socialFilterDirectActors()">${tr("РќР°Р№С‚Рё", "Search")}</button>
      </div>
      <div class="hint">${tr("Р”СЂСѓРіРёРµ РєРѕРјРїР°РЅРёРё РґРѕСЃС‚СѓРїРЅС‹ С‡РµСЂРµР· РїРѕРёСЃРє РїРѕ email.", "Other companies appear only via email search.")}</div>
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

function socialCurrentCompanyThread() {
  const thread = socialGetCurrentThread();
  if (!thread || String(thread.kind || "") !== "company") return null;
  return thread;
}

function socialOpenCompanyChatEditor() {
  const thread = socialCurrentCompanyThread();
  if (!thread) {
    alert(tr("РЎРЅР°С‡Р°Р»Р° РѕС‚РєСЂРѕР№С‚Рµ С‡Р°С‚ РєРѕРјРїР°РЅРёРё.", "Open company chat first."));
    return;
  }
  socialOpenModal(
    tr("РќР°СЃС‚СЂРѕР№РєРё С‡Р°С‚Р° РєРѕРјРїР°РЅРёРё", "Company chat settings"),
    `
      <div class="social-group-editor">
        <label>
          <span>${tr("РќР°Р·РІР°РЅРёРµ С‡Р°С‚Р°", "Chat title")}</span>
          <input id="socialCompanyChatTitleInput" value="${escapeHtml(String(thread.title || "").trim())}" placeholder="${escapeHtml(tr("Р’РІРµРґРёС‚Рµ РЅР°Р·РІР°РЅРёРµ", "Enter title"))}" />
        </label>
        <div class="hint">${escapeHtml(tr("Р’СЃРµ СЃРѕС‚СЂСѓРґРЅРёРєРё РєРѕРјРїР°РЅРёРё РґРѕР±Р°РІР»СЏСЋС‚СЃСЏ РІ С‡Р°С‚ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё.", "All company employees are added automatically."))}</div>
        <div class="actions">
          <button type="button" onclick="socialSaveCompanyChatEditor()">${tr("РЎРѕС…СЂР°РЅРёС‚СЊ", "Save")}</button>
        </div>
      </div>
    `
  );
}

async function socialSaveCompanyChatEditor() {
  const thread = socialCurrentCompanyThread();
  if (!thread) return;
  const title = String(document.getElementById("socialCompanyChatTitleInput")?.value || "").trim();
  if (title.length < 2) {
    alert(tr("Р’РІРµРґРёС‚Рµ РЅР°Р·РІР°РЅРёРµ С‡Р°С‚Р°.", "Enter chat title."));
    return;
  }
  const row = await socialRequest(`/api/social/chat/company/${Number(thread.id || 0)}`, {
    method: "PUT",
    body: JSON.stringify({ title }),
    retryOnPost: true,
    maxRetries: 1,
  }).catch((e) => {
    alert(e?.message || tr("РћС€РёР±РєР° СЃРѕС…СЂР°РЅРµРЅРёСЏ С‡Р°С‚Р°", "Failed to save chat"));
    return null;
  });
  if (!row) return;
  const idx = socialState.chatThreads.findIndex((x) => Number(x?.id || 0) === Number(row.id || 0));
  if (idx >= 0) {
    socialState.chatThreads[idx] = row;
  }
  socialSetChatHeader(row, { force: true });
  socialRenderThreads();
  socialCloseModal();
}

function socialOpenGroupEditor(editCurrent = false) {
  const editing = Boolean(editCurrent);
  const thread = editing ? socialCurrentGroupThread() : null;
  if (editing && !thread) {
    alert(tr("РЎРЅР°С‡Р°Р»Р° РѕС‚РєСЂРѕР№С‚Рµ РіСЂСѓРїРїРѕРІРѕР№ С‡Р°С‚.", "Open a group chat first."));
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
        ${escapeHtml(row.nick || actorKey)}${isMe ? ` (${escapeHtml(tr("РІС‹", "you"))})` : ""}
      </label>
    `;
  }).join("");
  socialOpenModal(
    editing ? tr("РЈРїСЂР°РІР»РµРЅРёРµ РіСЂСѓРїРїРѕР№", "Manage group") : tr("РќРѕРІР°СЏ РіСЂСѓРїРїР°", "New group"),
    `
      <div class="social-group-editor">
        <label>
          <span>${tr("РќР°Р·РІР°РЅРёРµ РіСЂСѓРїРїС‹", "Group title")}</span>
          <input id="socialGroupTitleInput" value="${escapeHtml(String(thread?.title || "").trim())}" placeholder="${escapeHtml(tr("Р’РІРµРґРёС‚Рµ РЅР°Р·РІР°РЅРёРµ", "Enter title"))}" />
        </label>
        <label>
          <span>${tr("РђРІР°С‚Р°СЂ РіСЂСѓРїРїС‹", "Group avatar")}</span>
          <input id="socialGroupAvatarInput" value="${escapeHtml(avatarCurrent)}" placeholder="https://..." />
          <div id="socialGroupAvatarPreset" class="avatar-picker">${pickerHtml}</div>
        </label>
        <div class="social-group-members">
          <div class="hint">${tr("РЈС‡Р°СЃС‚РЅРёРєРё (С‚РѕР»СЊРєРѕ СЃРѕС‚СЂСѓРґРЅРёРєРё С‚РµРєСѓС‰РµР№ РєРѕРјРїР°РЅРёРё)", "Members (current company only)")}</div>
          <div class="social-group-members-list">${membersHtml}</div>
        </div>
        <div class="actions">
          <button type="button" onclick="socialSaveGroupEditor(${editing ? Number(thread.id || 0) : 0})">${editing ? tr("РЎРѕС…СЂР°РЅРёС‚СЊ", "Save") : tr("РЎРѕР·РґР°С‚СЊ РіСЂСѓРїРїСѓ", "Create group")}</button>
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
    alert(tr("Р’РІРµРґРёС‚Рµ РЅР°Р·РІР°РЅРёРµ РіСЂСѓРїРїС‹.", "Enter group title."));
    return;
  }
  if (member_keys.length < 2) {
    alert(tr("Р”РѕР±Р°РІСЊС‚Рµ РјРёРЅРёРјСѓРј РґРІСѓС… СѓС‡Р°СЃС‚РЅРёРєРѕРІ.", "Add at least two members."));
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
    alert(e?.message || tr("РћС€РёР±РєР° СЃРѕС…СЂР°РЅРµРЅРёСЏ РіСЂСѓРїРїС‹", "Failed to save group"));
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
    host.innerHTML = `<div class="hint">${escapeHtml(e.message || tr("РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё", "Loading error"))}</div>`;
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
  `).join("") || `<div class="hint">${tr("РќРёРєРѕРіРѕ РЅРµ РЅР°Р№РґРµРЅРѕ", "No users found")}</div>`;
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
  select.innerHTML = `<option value="">${tr("Р’СЃРµ РїСЂРѕРµРєС‚С‹", "All projects")}</option>${socialState.projects.map((p) => `<option value="${Number(p.id)}">${escapeHtml(p.title || "-")}</option>`).join("")}`;
  if ([...select.options].some((x) => x.value === keep)) select.value = keep;
}

function socialTaskIncludeDoneEnabled() {
  return Boolean(document.getElementById("socialTaskIncludeDone")?.checked);
}

function socialFilterTaskRows(rows, includeDone = false) {
  const source = Array.isArray(rows) ? rows : [];
  if (includeDone) return source.slice();
  return source.filter((row) => String(row?.status || "todo").trim().toLowerCase() !== "done");
}

function socialApplyTaskRowsFromCache() {
  const includeDone = socialTaskIncludeDoneEnabled();
  const allRows = Array.isArray(socialState.tasksAll) ? socialState.tasksAll : [];
  socialState.tasks = socialFilterTaskRows(allRows, includeDone);
}

async function socialLoadTasks(options = {}) {
  const force = Boolean(options && options.force);
  const projectId = document.getElementById("socialTaskProjectFilter")?.value || "";
  const kind = String(document.getElementById("socialTaskKindFilter")?.value || "all").trim().toLowerCase();
  const cacheKey = `${projectId || ""}|${kind || "all"}`;
  const cachedRows = Array.isArray(socialState.tasksAll) ? socialState.tasksAll : [];
  const hasCacheForKey = String(socialState.tasksCacheKey || "") === cacheKey
    && (cachedRows.length > 0 || Number(socialState.tasksCacheLoadedAt || 0) > 0);
  const cacheAgeMs = Date.now() - Number(socialState.tasksCacheLoadedAt || 0);
  const cacheFresh = hasCacheForKey && cacheAgeMs < 60000;

  if (!force && cacheFresh) {
    socialApplyTaskRowsFromCache();
    socialRenderTasks();
    return;
  }

  const qp = new URLSearchParams();
  if (projectId) qp.set("project_id", projectId);
  if (kind && kind !== "all") qp.set("task_kind", kind);
  qp.set("include_done", "1");

  const requestSeq = Number(socialState.tasksLoadSeq || 0) + 1;
  socialState.tasksLoadSeq = requestSeq;

  const rows = await socialRequest(`/api/social/tasks${qp.toString() ? `?${qp.toString()}` : ""}`).catch((e) => {
    alert(e.message);
    return null;
  });

  if (requestSeq !== Number(socialState.tasksLoadSeq || 0)) return;

  if (!Array.isArray(rows)) {
    if (hasCacheForKey) {
      socialApplyTaskRowsFromCache();
      socialRenderTasks();
    }
    return;
  }

  const decodeText = (value) => {
    const raw = String(value ?? "");
    if (typeof decodePossiblyMojibake === "function") {
      try { return decodePossiblyMojibake(raw); } catch (_) {}
    }
    return raw;
  };

  socialState.tasksAll = rows.map((row) => ({
    ...row,
    title: decodeText(row?.title || ""),
    description: decodeText(row?.description || ""),
    assignee_nick: decodeText(row?.assignee_nick || ""),
    creator_nick: decodeText(row?.creator_nick || ""),
    project_title: decodeText(row?.project_title || ""),
  }));
  socialState.tasksCacheKey = cacheKey;
  socialState.tasksCacheLoadedAt = Date.now();

  socialApplyTaskRowsFromCache();
  socialRenderTasks();
}

const socialTaskPendingStatus = new Map();

function socialTaskProjectTitle(task) {
  const direct = String(task?.project_title || task?.project || "").trim();
  if (direct) return direct;
  const pid = Number(task?.project_id || 0);
  if (pid > 0) {
    const project = (socialState.projects || []).find((row) => Number(row?.id || 0) === pid);
    const title = String(project?.title || "").trim();
    if (title) return title;
  }
  return tr("Р‘РµР· РїСЂРѕРµРєС‚Р°", "No project");
}

function socialTaskVisualStatus(task) {
  const id = Number(task?.id || 0);
  const pending = socialTaskPendingStatus.get(id);
  if (pending && pending.targetStatus) return String(pending.targetStatus);
  return String(task?.status || "todo");
}

function socialTaskPendingHint(taskId) {
  const pending = socialTaskPendingStatus.get(Number(taskId || 0));
  if (!pending) return "";
  if (String(pending.targetStatus) === "done") {
    return tr("5СЃ: РїРѕРІС‚РѕСЂРЅС‹Р№ РєР»РёРє РѕС‚РјРµРЅРёС‚ Р·Р°РІРµСЂС€РµРЅРёРµ", "5s: click again to cancel complete");
  }
  return tr("5СЃ: РїРѕРІС‚РѕСЂРЅС‹Р№ РєР»РёРє РѕС‚РјРµРЅРёС‚ РІРѕР·РІСЂР°С‚", "5s: click again to cancel restore");
}

function socialFormatTaskDateTime(iso) {
  const raw = String(iso || "").trim();
  if (!raw) return "";
  const dt = socialParseDateSafe(raw);
  if (!(dt instanceof Date) || Number.isNaN(dt.getTime())) {
    return raw.slice(0, 16).replace("T", ", ");
  }
  const locale = currentLang === "en" ? "en-GB" : "ru-RU";
  try {
    return dt.toLocaleString(locale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).replace(".", ".");
  } catch (_) {
    return raw.slice(0, 16).replace("T", ", ");
  }
}

function socialRenderTasks() {
  const host = document.getElementById("socialTasksBoard");
  if (!host) return;
  const rows = socialState.tasks || [];
  const myActorKey = String(socialState.boot?.actor?.actor_key || "").trim();
  const isOwner = Boolean(socialState.boot?.actor?.is_owner);
  if (!rows.length) {
    host.innerHTML = `<div class="hint">${tr("Р—Р°РґР°С‡ РїРѕРєР° РЅРµС‚", "No tasks yet")}</div>`;
    return;
  }
  host.innerHTML = `
    <div class="social-task-list">
      ${rows.map((task) => {
        const id = Number(task?.id || 0);
        const statusRaw = String(task?.status || "todo");
        const status = socialTaskVisualStatus(task);
        const statusLabel = status === "todo"
          ? tr("РќРѕРІС‹Рµ", "To do")
          : (status === "in_progress" ? tr("Р’ СЂР°Р±РѕС‚Рµ", "In progress") : tr("Р“РѕС‚РѕРІРѕ", "Done"));
        const priority = String(task?.priority || "normal");
        const due = socialFormatTaskDateTime(task?.due_date);
        const created = socialFormatTaskDateTime(task?.created_at);
        const dueDt = task?.due_date ? socialParseDateSafe(String(task.due_date || "")) : null;
        const isDone = status === "done";
        const isOverdue = !isDone && dueDt instanceof Date && !Number.isNaN(dueDt.getTime()) && dueDt.getTime() < Date.now();
        const project = socialTaskProjectTitle(task);
        const kind = String(task?.task_kind || "company").toLowerCase();
        const kindLabel = kind === "personal" ? tr("Р›РР§РќРђРЇ", "PERSONAL") : project;
        const isMine = myActorKey && String(task?.assignee_key || "") === myActorKey;
        const canToggle = Boolean(task?.can_complete || isMine || isOwner);
        const canDelete = Boolean(task?.can_delete || isOwner);
        const pendingText = socialTaskPendingHint(id);
        const mineBadge = isMine ? `<span class="social-task-tag">${tr("Р’Р°С€Р° Р·Р°РґР°С‡Р°", "Your task")}</span>` : "";
        const assigneeNick = String(task?.assignee_nick || "-");
        const avatar = socialAvatarMarkup(String(task?.assignee_avatar_url || ""), assigneeNick, "xs");
        return `
          <article class="social-task-row ${isMine ? "is-assignee" : ""} ${isDone ? "is-done" : ""} ${isOverdue ? "is-overdue" : ""}" ondblclick="socialOpenTaskModal(${id})">
            <button class="social-task-check ${isDone ? "is-done" : ""}" type="button" onclick="socialToggleTaskDone(${id}); event.stopPropagation();" title="${tr("РџРµСЂРµРєР»СЋС‡РёС‚СЊ РІС‹РїРѕР»РЅРµРЅРёРµ", "Toggle done")}" ${canToggle ? "" : "disabled"}>вњ“</button>
            <div class="social-task-main" onclick="socialOpenTaskModal(${id})">
              <div class="social-task-title">
                <b>${escapeHtml(task?.title || "-")}</b>
                <span class="social-task-kind-badge ${escapeHtml(kind)}">${escapeHtml(kindLabel || tr("РџР РћР•РљРў", "PROJECT"))}</span>
                ${mineBadge}
                <span class="social-status ${escapeHtml(status)}">${escapeHtml(statusLabel)}</span>
                <span class="social-priority ${escapeHtml(priority)}">${escapeHtml(priority)}</span>
              </div>
              <div class="social-task-meta">
                <span class="social-task-assignee">${avatar}<span class="social-task-assignee-name">${escapeHtml(assigneeNick)}</span></span>
                <span>${tr("Р”Р°С‚Р° СЃРѕР·РґР°РЅРёСЏ", "Created")}: ${escapeHtml(created || "-")}</span>
                <span>${tr("Р”РµРґР»Р°Р№РЅ", "Deadline")}: ${escapeHtml(due || tr("Р‘РµР· РґРµРґР»Р°Р№РЅР°", "No deadline"))}</span>
              </div>
              ${pendingText ? `<div class="social-task-pending-hint">${escapeHtml(pendingText)}</div>` : ""}
            </div>
            <div class="social-task-actions">
              ${canDelete ? `<button class="btn-danger" type="button" onclick="socialDeleteTask(${id}); event.stopPropagation();">${tr("РЈРґР°Р»РёС‚СЊ", "Delete")}</button>` : ""}
            </div>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

async function socialToggleTaskDone(taskId) {
  const id = Number(taskId || 0);
  if (!id) return;
  const row = (socialState.tasksAll || []).find((x) => Number(x?.id || 0) === id)
    || (socialState.tasks || []).find((x) => Number(x?.id || 0) === id)
    || null;
  if (!row) return;

  const myActorKey = String(socialState.boot?.actor?.actor_key || "").trim();
  const isOwner = Boolean(socialState.boot?.actor?.is_owner);
  const isMine = myActorKey && String(row.assignee_key || "") === myActorKey;
  const canToggle = Boolean(row?.can_complete || isMine || isOwner);
  if (!canToggle) {
    alert(tr("РЎРѕС‚СЂСѓРґРЅРёРє РјРѕР¶РµС‚ РјРµРЅСЏС‚СЊ СЃС‚Р°С‚СѓСЃ С‚РѕР»СЊРєРѕ СЃРІРѕРёС… Р·Р°РґР°С‡.", "Employees can update only their own tasks."));
    return;
  }

  const pending = socialTaskPendingStatus.get(id);
  if (pending) {
    try { clearTimeout(pending.timerId); } catch (_) {}
    socialTaskPendingStatus.delete(id);
    socialRenderTasks();
    return;
  }

  const currentStatus = String(row.status || "todo").toLowerCase();

  if (currentStatus !== "done") {
    const previousStatus = currentStatus;
    row.status = "done";
    row.completed_at = new Date().toISOString();
    socialApplyTaskRowsFromCache();
    socialRenderTasks();

    try {
      await socialRequest(`/api/social/tasks/${id}`, {
        method: "PUT",
        body: JSON.stringify({ status: "done" }),
      });
      await socialLoadTasks({ force: true });
    } catch (e) {
      row.status = previousStatus;
      row.completed_at = null;
      socialApplyTaskRowsFromCache();
      socialRenderTasks();
      alert(e?.message || tr("РќРµ СѓРґР°Р»РѕСЃСЊ РѕР±РЅРѕРІРёС‚СЊ СЃС‚Р°С‚СѓСЃ Р·Р°РґР°С‡Рё", "Failed to update task status"));
    }
    return;
  }

  const timerId = setTimeout(async () => {
    try {
      await socialRequest(`/api/social/tasks/${id}`, {
        method: "PUT",
        body: JSON.stringify({ status: "todo" }),
      });
      socialTaskPendingStatus.delete(id);
      await socialLoadTasks({ force: true });
    } catch (e) {
      socialTaskPendingStatus.delete(id);
      socialRenderTasks();
      alert(e?.message || tr("РќРµ СѓРґР°Р»РѕСЃСЊ РѕР±РЅРѕРІРёС‚СЊ СЃС‚Р°С‚СѓСЃ Р·Р°РґР°С‡Рё", "Failed to update task status"));
    }
  }, 5000);

  socialTaskPendingStatus.set(id, {
    targetStatus: "todo",
    timerId,
    startedAt: Date.now(),
  });
  socialRenderTasks();
}

function socialBuildTaskForm(task = null) {

  const actors = socialState.actors || [];
  const projects = socialState.projects || [];
  const status = task?.status || "todo";
  const due = task?.due_date ? String(task.due_date).slice(0, 16) : "";
  return `
    <div class="grid-2">
      <label><span>${tr("РќР°Р·РІР°РЅРёРµ", "Title")}</span><input id="socialTaskTitle" value="${escapeHtml(task?.title || "")}" /></label>
      <label><span>${tr("РџСЂРѕРµРєС‚", "Project")}</span><select id="socialTaskProject"><option value="">${tr("Р‘РµР· РїСЂРѕРµРєС‚Р°", "No project")}</option>${projects.map((p) => `<option value="${Number(p.id)}" ${Number(task?.project_id || 0) === Number(p.id) ? "selected" : ""}>${escapeHtml(p.title || "-")}</option>`).join("")}</select></label>
      <label><span>${tr("РСЃРїРѕР»РЅРёС‚РµР»СЊ", "Assignee")}</span><select id="socialTaskAssignee">${actors.map((a) => `<option value="${escapeHtml(String(a.actor_key || ""))}" ${String(task?.assignee_key || "") === String(a.actor_key || "") ? "selected" : ""}>${escapeHtml(a.nick || "-")}</option>`).join("")}</select></label>
      <label><span>${tr("РџСЂРёРѕСЂРёС‚РµС‚", "Priority")}</span><select id="socialTaskPriority"><option value="low" ${task?.priority === "low" ? "selected" : ""}>low</option><option value="normal" ${task?.priority === "normal" || !task ? "selected" : ""}>normal</option><option value="high" ${task?.priority === "high" ? "selected" : ""}>high</option><option value="critical" ${task?.priority === "critical" ? "selected" : ""}>critical</option></select></label>
      <label><span>${tr("\u0421\u0442\u0430\u0442\u0443\u0441", "Status")}</span><select id="socialTaskStatus"><option value="todo" ${status === "todo" ? "selected" : ""}>todo</option><option value="in_progress" ${status === "in_progress" ? "selected" : ""}>in_progress</option><option value="done" ${status === "done" ? "selected" : ""}>done</option></select></label>
      <label><span>${tr("Р”РµРґР»Р°Р№РЅ", "Deadline")}</span><input id="socialTaskDue" type="datetime-local" value="${escapeHtml(due)}" /></label>
      <label class="full"><span>${tr("РћРїРёСЃР°РЅРёРµ", "Description")}</span><textarea id="socialTaskDescription" rows="5">${escapeHtml(task?.description || "")}</textarea></label>
    </div>
  `;
}

function socialOpenProjectModal() {
  socialOpenModal(
    tr("РќРѕРІС‹Р№ РїСЂРѕРµРєС‚", "New project"),
    `
      <div class="grid-1">
        <input id="socialProjectTitle" placeholder="${tr("РќР°Р·РІР°РЅРёРµ РїСЂРѕРµРєС‚Р°", "Project title")}" />
        <textarea id="socialProjectDescription" rows="4" placeholder="${tr("РћРїРёСЃР°РЅРёРµ", "Description")}"></textarea>
      </div>
      <div class="actions">
        <button type="button" onclick="socialCreateProject()">${tr("РЎРѕР·РґР°С‚СЊ", "Create")}</button>
      </div>
    `
  );
}

async function socialCreateProject() {
  const title = String(document.getElementById("socialProjectTitle")?.value || "").trim();
  const description = String(document.getElementById("socialProjectDescription")?.value || "").trim();
  if (!title) return alert(tr("РЈРєР°Р¶РёС‚Рµ РЅР°Р·РІР°РЅРёРµ РїСЂРѕРµРєС‚Р°", "Enter project title"));
  await socialRequest("/api/social/tasks/projects", {
    method: "POST",
    body: JSON.stringify({ title, description }),
  }).catch((e) => alert(e.message));
  socialCloseModal();
  await socialLoadProjects();
}

async function socialOpenTaskModal(taskId = 0, taskSnapshot = null) {
  const targetId = Number(taskId || 0);
  if (!Array.isArray(socialState.actors) || !socialState.actors.length) {
    await socialLoadTaskActors().catch(() => null);
  }
  if (!Array.isArray(socialState.projects) || !socialState.projects.length) {
    await socialLoadProjects().catch(() => null);
  }

  let task = taskSnapshot && typeof taskSnapshot === "object" ? { ...taskSnapshot } : null;
  const pools = [
    Array.isArray(socialState.tasksAll) ? socialState.tasksAll : [],
    Array.isArray(socialState.tasks) ? socialState.tasks : [],
    Array.isArray(socialState.calendarTasks) ? socialState.calendarTasks : [],
  ];
  for (const list of pools) {
    task = list.find((x) => Number(x?.id || 0) === targetId) || task;
    if (task) break;
  }

  if (!task && targetId > 0) {
    await socialLoadTasks({ force: true }).catch(() => null);
    task = (Array.isArray(socialState.tasksAll) ? socialState.tasksAll : []).find((x) => Number(x?.id || 0) === targetId)
      || (Array.isArray(socialState.calendarTasks) ? socialState.calendarTasks : []).find((x) => Number(x?.id || 0) === targetId)
      || null;
  }

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

async function socialOpenCalendarTaskEdit(taskId = 0) {
  const id = Number(taskId || 0);
  if (!id) return;
  let row = (Array.isArray(socialState.calendarTasks) ? socialState.calendarTasks : []).find((x) => Number(x?.id || 0) === id)
    || (Array.isArray(socialState.tasksAll) ? socialState.tasksAll : []).find((x) => Number(x?.id || 0) === id)
    || (Array.isArray(socialState.tasks) ? socialState.tasks : []).find((x) => Number(x?.id || 0) === id)
    || null;
  if (!row) {
    await socialLoadTasks({ force: true }).catch(() => null);
    row = (Array.isArray(socialState.calendarTasks) ? socialState.calendarTasks : []).find((x) => Number(x?.id || 0) === id)
      || (Array.isArray(socialState.tasksAll) ? socialState.tasksAll : []).find((x) => Number(x?.id || 0) === id)
      || (Array.isArray(socialState.tasks) ? socialState.tasks : []).find((x) => Number(x?.id || 0) === id)
      || null;
  }
  socialCloseModal();
  await socialOpenTaskModal(id, row || null);
}

if (typeof globalThis !== "undefined") {
  globalThis.socialOpenTaskModal = socialOpenTaskModal;
  globalThis.socialOpenCalendarTaskEdit = socialOpenCalendarTaskEdit;
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
  if (!payload.title) return alert(tr("РќР°Р·РІР°РЅРёРµ Р·Р°РґР°С‡Рё РѕР±СЏР·Р°С‚РµР»СЊРЅРѕ", "Task title is required"));
  const req = taskId > 0
    ? socialRequest(`/api/social/tasks/${Number(taskId)}`, { method: "PUT", body: JSON.stringify(payload) })
    : socialRequest("/api/social/tasks", { method: "POST", body: JSON.stringify(payload) });
  await req.catch((e) => alert(e.message));
  socialCloseModal();
  await socialLoadTasks({ force: true });
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
  await socialLoadTasks({ force: true });
  socialOpenTaskModal(id);
}

async function socialQuickDone(taskId) {
  return socialToggleTaskDone(taskId);
}

async function socialDeleteTask(taskId) {
  const id = Number(taskId || 0);
  if (!id) return;
  const row = (socialState.tasksAll || []).find((x) => Number(x?.id || 0) === id)
    || (socialState.tasks || []).find((x) => Number(x?.id || 0) === id)
    || null;
  if (!row) return;
  const canDelete = Boolean(row?.can_delete || socialState.boot?.actor?.is_owner);
  if (!canDelete) {
    alert(tr("РЈРґР°Р»СЏС‚СЊ Р·Р°РґР°С‡Сѓ РјРѕР¶РµС‚ С‚РѕР»СЊРєРѕ СЃРѕР·РґР°С‚РµР»СЊ РёР»Рё РІР»Р°РґРµР»РµС†.", "Only creator or owner can delete task."));
    return;
  }
  if (!confirm(tr("РЈРґР°Р»РёС‚СЊ Р·Р°РґР°С‡Сѓ?", "Delete task?"))) return;

  const previousAll = Array.isArray(socialState.tasksAll) ? socialState.tasksAll.slice() : [];
  socialTaskPendingStatus.delete(id);
  socialState.tasksAll = previousAll.filter((item) => Number(item?.id || 0) !== id);
  socialApplyTaskRowsFromCache();
  socialRenderTasks();

  try {
    await socialRequest(`/api/social/tasks/${id}`, { method: "DELETE" });
    await socialLoadTasks({ force: true });
  } catch (e) {
    socialState.tasksAll = previousAll;
    socialApplyTaskRowsFromCache();
    socialRenderTasks();
    alert(e?.message || tr("РќРµ СѓРґР°Р»РѕСЃСЊ СѓРґР°Р»РёС‚СЊ Р·Р°РґР°С‡Сѓ", "Failed to delete task"));
  }
}

async function socialLoadGoogleCalendarStatus() {
  const statusNode = document.getElementById("socialCalendarGoogleStatus");
  const connectBtn = document.getElementById("socialCalendarGoogleConnectBtn");
  const syncBtn = document.querySelector(".social-calendar-sync-btn");
  const query = new URLSearchParams(window.location.search || "");
  const oauthConnected = String(query.get("google_oauth_connected") || "") === "1";
  const oauthError = String(query.get("google_oauth_error") || "").trim();
  const autoGoogleSync = oauthConnected && String(query.get("auto_google_sync") || "") === "1";
  let transientKind = "";
  let transientTitle = "";
  let transientLines = [];
  if (oauthConnected || oauthError || autoGoogleSync) {
    if (oauthConnected) {
      transientKind = "success";
      transientTitle = tr("Google Calendar РїРѕРґРєР»СЋС‡С‘РЅ", "Google Calendar connected");
      transientLines = [tr("РўРµРїРµСЂСЊ РјРѕР¶РЅРѕ Р·Р°РїСѓСЃРєР°С‚СЊ РїСЂСЏРјРѕР№ РёРјРїРѕСЂС‚ РєР°Р»РµРЅРґР°СЂСЏ Р±РµР· ICS-СЃСЃС‹Р»РєРё.", "Direct calendar import is now available without an ICS URL.")];
    } else if (oauthError) {
      transientKind = "error";
      transientTitle = tr("РћС€РёР±РєР° Google OAuth", "Google OAuth error");
      transientLines = [oauthError];
    }
    query.delete("google_oauth_connected");
    query.delete("google_oauth_error");
    query.delete("auto_google_sync");
    const nextSearch = query.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash || ""}`;
    window.history.replaceState({}, document.title, nextUrl);
  }
  const data = await socialRequest("/api/social/calendar/google-oauth/status", { timeoutMs: 12000 }).catch((e) => {
    socialState.googleCalendarOauth = null;
    if (statusNode) {
      statusNode.innerHTML = `<strong>${escapeHtml(tr("РќРµ СѓРґР°Р»РѕСЃСЊ РїРѕР»СѓС‡РёС‚СЊ СЃС‚Р°С‚СѓСЃ Google Calendar.", "Could not load Google Calendar status."))}</strong>`;
    }
    socialRenderCalendarStatusMeta(null);
    socialSetCalendarSyncMessage("error", tr("РџСЂРѕРІРµСЂРєР° СЃС‚Р°С‚СѓСЃР° РЅРµ СѓРґР°Р»Р°СЃСЊ", "Status check failed"), [e?.message || tr("РџРѕРІС‚РѕСЂРёС‚Рµ РїРѕРїС‹С‚РєСѓ С‡СѓС‚СЊ РїРѕР·Р¶Рµ.", "Please retry in a moment.")]);
    return null;
  });
  socialState.googleCalendarOauth = data && typeof data === "object" ? data : null;
  const status = socialState.googleCalendarOauth || {};
  const configured = Boolean(status.oauth_configured);
  const connected = Boolean(status.connected);
  const accountEmail = String(status.account_email || "").trim();
  const expiresAt = Number(status.expires_at || 0);
  const expiresText = expiresAt > 0
    ? new Date(expiresAt * 1000).toLocaleString(currentLang === "en" ? "en-GB" : "ru-RU")
    : "";
  if (statusNode) {
    if (connected) {
      statusNode.innerHTML = `
        <strong>${escapeHtml(tr("Р’Р°С€ Google РєР°Р»РµРЅРґР°СЂСЊ РїРѕРґРєР»СЋС‡С‘РЅ", "Your Google Calendar is connected"))}</strong>
        <span>${escapeHtml(accountEmail
          ? tr(`РџРѕРґРєР»СЋС‡С‘РЅ Р°РєРєР°СѓРЅС‚ ${accountEmail}. РњРѕР¶РЅРѕ Р·Р°РїСѓСЃРєР°С‚СЊ РїСЂСЏРјРѕР№ РёРјРїРѕСЂС‚ СЃРѕР±С‹С‚РёР№.`, `Account ${accountEmail} is connected. You can run direct event import now.`)
          : tr("РџРѕРґРєР»СЋС‡РµРЅРёРµ РіРѕС‚РѕРІРѕ. РњРѕР¶РЅРѕ Р·Р°РїСѓСЃРєР°С‚СЊ РїСЂСЏРјРѕР№ РёРјРїРѕСЂС‚ СЃРѕР±С‹С‚РёР№.", "Connection is ready. You can run direct event import now."))}</span>
      `;
    } else if (configured) {
      statusNode.innerHTML = `
        <strong>${escapeHtml(tr("РџРѕРґРєР»СЋС‡РёС‚Рµ СЃРІРѕР№ Google Р°РєРєР°СѓРЅС‚", "Connect your Google account"))}</strong>
        <span>${escapeHtml(tr("РќР°Р¶РјРёС‚Рµ РѕРґРЅСѓ РєРЅРѕРїРєСѓ РЅРёР¶Рµ. РџРѕСЃР»Рµ СЌС‚РѕРіРѕ SEO WIBE Р±СѓРґРµС‚ СЃРёРЅС…СЂРѕРЅРёР·РёСЂРѕРІР°С‚СЊ РєР°Р»РµРЅРґР°СЂСЊ РёРјРµРЅРЅРѕ СЌС‚РѕРіРѕ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ.", "Press the button below once. SEO WIBE will then sync this user's calendar only."))}</span>
      `;
    } else {
      statusNode.innerHTML = `
        <strong>${escapeHtml(tr("РџСЂСЏРјРѕР№ РёРјРїРѕСЂС‚ РµС‰С‘ РЅРµ РІРєР»СЋС‡С‘РЅ", "Direct import is not enabled yet"))}</strong>
        <span>${escapeHtml(tr("РђРґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂСѓ РЅСѓР¶РЅРѕ РѕРґРёРЅ СЂР°Р· РґРѕР±Р°РІРёС‚СЊ Google OAuth РЅР° СЃРµСЂРІРµСЂРµ. РџРѕСЃР»Рµ СЌС‚РѕРіРѕ РєР°Р¶РґС‹Р№ РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ РїРѕРґРєР»СЋС‡Р°РµС‚ СЃРІРѕР№ Google Р°РєРєР°СѓРЅС‚ РѕРґРЅРѕР№ РєРЅРѕРїРєРѕР№.", "An administrator needs to add Google OAuth on the server once. After that, each user connects their own Google account with one button."))}</span>
      `;
    }
  }
  socialRenderCalendarStatusMeta(status);
  if (connectBtn) {
    connectBtn.classList.toggle("btn-success", connected);
    connectBtn.disabled = connectBtn.dataset.loading === "1" ? true : !configured;
    if (connectBtn.dataset.loading !== "1") {
      connectBtn.textContent = connected
        ? tr("РџРµСЂРµРїРѕРґРєР»СЋС‡РёС‚СЊ Google", "Reconnect Google")
        : tr("РџРѕРґРєР»СЋС‡РёС‚СЊ Google РєР°Р»РµРЅРґР°СЂСЊ", "Connect Google Calendar");
    }
  }
  if (syncBtn) {
    syncBtn.textContent = connected
      ? tr("РЎРёРЅС…СЂРѕРЅРёР·РёСЂРѕРІР°С‚СЊ РёР· Google / ICS", "Sync from Google / ICS")
      : tr("РРјРїРѕСЂС‚ РїРѕ ICS URL", "Import via ICS URL");
  }
  if (autoGoogleSync && connected && !socialState.calendarAutoSyncInFlight) {
    socialState.calendarAutoSyncInFlight = true;
    try {
      await socialSyncGoogleCalendar({ autoStarted: true });
    } finally {
      socialState.calendarAutoSyncInFlight = false;
    }
    return;
  }
  if (transientTitle) {
    socialSetCalendarSyncMessage(transientKind || "info", transientTitle, transientLines);
    return;
  }
  const lastSyncState = String(status.last_sync_state || "idle").trim().toLowerCase();
  const lastSyncAt = String(status.last_sync_at || "").trim();
  const summary = status.last_sync_summary && typeof status.last_sync_summary === "object" ? status.last_sync_summary : {};
  const warnings = Array.isArray(summary.warnings) ? summary.warnings.map((line) => String(line || "").trim()).filter(Boolean) : [];
  const summaryLines = [];
  if (accountEmail) summaryLines.push(`${tr("Google Р°РєРєР°СѓРЅС‚", "Google account")}: ${accountEmail}`);
  if (lastSyncAt) {
    summaryLines.push(`${tr("Р’СЂРµРјСЏ", "Time")}: ${new Date(lastSyncAt).toLocaleString(currentLang === "en" ? "en-GB" : "ru-RU")}`);
  }
  summaryLines.push(`${tr("РРјРїРѕСЂС‚", "Imported")}: ${Number(summary.imported || 0)}`);
  summaryLines.push(`${tr("РћР±РЅРѕРІР»РµРЅРѕ", "Updated")}: ${Number(summary.updated || 0)}`);
  summaryLines.push(`${tr("РЈРґР°Р»РµРЅРѕ", "Deleted")}: ${Number(summary.deleted || 0)}`);
  summaryLines.push(`${tr("РџСЂРѕРїСѓС‰РµРЅРѕ", "Skipped")}: ${Number(summary.skipped || 0)}`);
  if (warnings.length) summaryLines.push(`${tr("РџСЂРµРґСѓРїСЂРµР¶РґРµРЅРёСЏ", "Warnings")}: ${warnings.join(" | ")}`);
  const lastError = String(status.last_sync_error || "").trim();
  if (lastSyncState === "error") {
    socialSetCalendarSyncMessage("error", tr("РџРѕСЃР»РµРґРЅСЏСЏ СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёСЏ Р·Р°РІРµСЂС€РёР»Р°СЃСЊ СЃ РѕС€РёР±РєРѕР№", "Last sync finished with an error"), lastError ? [lastError, ...summaryLines] : summaryLines);
  } else if (lastSyncState === "partial") {
    socialSetCalendarSyncMessage("warn", tr("РЎРёРЅС…СЂРѕРЅРёР·Р°С†РёСЏ Р·Р°РІРµСЂС€РёР»Р°СЃСЊ С‡Р°СЃС‚РёС‡РЅРѕ", "Sync completed partially"), summaryLines);
  } else if (lastSyncState === "ok" || lastSyncState === "empty") {
    socialSetCalendarSyncMessage("success", tr("РџРѕСЃР»РµРґРЅСЏСЏ СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёСЏ СЃРѕС…СЂР°РЅРµРЅР°", "Latest sync recorded"), summaryLines);
  } else if (!configured && !connected) {
    const setupLines = [tr("Р”Р»СЏ РїСЂСЏРјРѕРіРѕ РёРјРїРѕСЂС‚Р° РЅСѓР¶РµРЅ РѕРґРёРЅ СЂР°Р· РЅР°СЃС‚СЂРѕРµРЅРЅС‹Р№ Google OAuth РЅР° СЃРµСЂРІРµСЂРµ.", "Direct import needs a one-time Google OAuth setup on the server.")];
    const redirectUri = String(status.required_redirect_uri || status.redirect_uri || "").trim();
    if (redirectUri) setupLines.push(`${tr("Redirect URI", "Redirect URI")}: ${redirectUri}`);
    const setupHint = String(status.setup_hint || "").trim();
    if (setupHint) setupLines.push(setupHint);
    socialSetCalendarSyncMessage("warn", tr("Google OAuth РµС‰С‘ РЅРµ РЅР°СЃС‚СЂРѕРµРЅ", "Google OAuth is not configured yet"), setupLines);
  } else if (configured && !connected) {
    socialSetCalendarSyncMessage("info", tr("РћСЃС‚Р°Р»СЃСЏ РѕРґРёРЅ С€Р°Рі", "One step left"), [tr("РќР°Р¶РјРёС‚Рµ В«РџРѕРґРєР»СЋС‡РёС‚СЊ Google РєР°Р»РµРЅРґР°СЂСЊВ», РІРѕР№РґРёС‚Рµ РІ РЅСѓР¶РЅС‹Р№ Google-Р°РєРєР°СѓРЅС‚ Рё СЂР°Р·СЂРµС€РёС‚Рµ РґРѕСЃС‚СѓРї С‚РѕР»СЊРєРѕ Рє С‡С‚РµРЅРёСЋ РєР°Р»РµРЅРґР°СЂСЏ.", "Press вЂњConnect Google CalendarвЂќ, sign in to the required Google account, and grant read-only calendar access.")]);
  } else if (connected && expiresText) {
    socialSetCalendarSyncMessage("success", tr("РџСЂСЏРјРѕР№ РёРјРїРѕСЂС‚ РіРѕС‚РѕРІ", "Direct import is ready"), [`${tr("РўРѕРєРµРЅ РґРµР№СЃС‚РІСѓРµС‚ РґРѕ", "Token valid until")}: ${expiresText}`]);
  } else {
    socialSetCalendarSyncMessage();
  }
}
async function socialConnectGoogleCalendar() {
  const statusNode = document.getElementById("socialCalendarGoogleStatus");
  const connectBtn = document.getElementById("socialCalendarGoogleConnectBtn");
  const previousStatus = String(statusNode?.textContent || "").trim();
  const previousText = String(connectBtn?.textContent || "").trim();
  const restoreUi = () => {
    if (connectBtn) {
      connectBtn.disabled = false;
      connectBtn.dataset.loading = "0";
      connectBtn.textContent = previousText || tr("РџРѕРґРєР»СЋС‡РёС‚СЊ Google РєР°Р»РµРЅРґР°СЂСЊ", "Connect Google Calendar");
    }
    if (statusNode && previousStatus) {
      statusNode.textContent = previousStatus;
    }
  };
  if (connectBtn) {
    connectBtn.disabled = true;
    connectBtn.dataset.loading = "1";
    connectBtn.textContent = tr("РћС‚РєСЂС‹РІР°РµРј Google...", "Opening Google...");
  }
  if (statusNode) {
    statusNode.textContent = tr("Р“РѕС‚РѕРІРёРј Р±РµР·РѕРїР°СЃРЅРѕРµ РїРѕРґРєР»СЋС‡РµРЅРёРµ Google OAuth...", "Preparing secure Google OAuth connection...");
  }
  socialSetCalendarSyncMessage("info", tr("РћС‚РєСЂС‹РІР°РµРј Google OAuth", "Opening Google OAuth"), [tr("РџРѕРґС‚РІРµСЂРґРёС‚Рµ РІС…РѕРґ РІ РЅСѓР¶РЅС‹Р№ Google-Р°РєРєР°СѓРЅС‚. РџРѕСЃР»Рµ СЂР°Р·СЂРµС€РµРЅРёСЏ РґРѕСЃС‚СѓРїР° РѕС‚РєСЂРѕРµС‚СЃСЏ SEO WIBE СЃ СѓР¶Рµ РїРѕРґРєР»СЋС‡С‘РЅРЅС‹Рј РєР°Р»РµРЅРґР°СЂС‘Рј.", "Sign in with the required Google account. After granting access, SEO WIBE will open with the calendar connected.")]);
  const oauthStartUrl = socialIsMobileApkShell() ? "/api/social/calendar/google-oauth/start?return_target=apk" : "/api/social/calendar/google-oauth/start";
  const data = await socialRequest(oauthStartUrl, { timeoutMs: 12000 }).catch((e) => {
    restoreUi();
    socialSetCalendarSyncMessage("error", tr("РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РїСѓСЃС‚РёС‚СЊ Google OAuth", "Unable to start Google OAuth"), [e?.message || tr("РџСЂРѕРІРµСЂСЊС‚Рµ РЅР°СЃС‚СЂРѕР№РєРё OAuth РЅР° СЃРµСЂРІРµСЂРµ.", "Check OAuth server settings.")]);
    return null;
  });
  const url = String(data?.url || "").trim();
  if (!url) {
    restoreUi();
    socialSetCalendarSyncMessage("error", tr("РќРµ СѓРґР°Р»РѕСЃСЊ РїРѕР»СѓС‡РёС‚СЊ СЃСЃС‹Р»РєСѓ Google OAuth", "Unable to obtain Google OAuth URL"));
    return false;
  }
  window.location.assign(url);
  return true;
}
async function socialLoadCalendar() {
  const monthLabel = document.getElementById("socialCalendarMonthLabel");
  const baseDate = socialCalendarParseDate(socialState.calendarDate) || new Date();
  socialState.calendarDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1, 0, 0, 0, 0);

  if (monthLabel) {
    monthLabel.textContent = socialCalendarMonthLabel(socialState.calendarDate);
  }

  const cachedEvents = Array.isArray(socialState.calendarEvents) && socialState.calendarEvents.length
    ? socialState.calendarEvents
    : (Array.isArray(socialState.calendarLastGoodEvents) ? socialState.calendarLastGoodEvents : []);
  const cachedTasks = Array.isArray(socialState.calendarTasks) && socialState.calendarTasks.length
    ? socialState.calendarTasks
    : (
      Array.isArray(socialState.tasksAll) && socialState.tasksAll.length
        ? socialState.tasksAll
        : (Array.isArray(socialState.calendarLastGoodTasks) ? socialState.calendarLastGoodTasks : [])
    );

  socialState.calendarEvents = Array.isArray(cachedEvents) ? [...cachedEvents] : [];
  socialState.calendarTasks = Array.isArray(cachedTasks) ? [...cachedTasks] : [];
  socialRenderCalendar();

  const seq = Number(socialState.calendarLoadSeq || 0) + 1;
  socialState.calendarLoadSeq = seq;

  const start = new Date(socialState.calendarDate.getFullYear(), socialState.calendarDate.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(socialState.calendarDate.getFullYear(), socialState.calendarDate.getMonth() + 1, 0, 23, 59, 59, 0);
  const eventsQuery = new URLSearchParams({
    date_from: socialCalendarRangeParam(start, false),
    date_to: socialCalendarRangeParam(end, true),
  });

  const applyCalendarRows = (kind, rows, error = null) => {
    if (Number(socialState.calendarLoadSeq || 0) !== seq) return;
    if (Array.isArray(rows)) {
      if (kind === "events") {
        socialState.calendarEvents = [...rows];
        socialState.calendarLastGoodEvents = [...rows];
      } else {
        socialState.calendarTasks = [...rows];
        socialState.calendarLastGoodTasks = [...rows];
      }
    } else if (error && typeof socialShowToast === "function") {
      socialShowToast(
        tr("\u041a\u0430\u043b\u0435\u043d\u0434\u0430\u0440\u044c", "Calendar"),
        error?.message || (kind === "events"
          ? tr("\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u0441\u043e\u0431\u044b\u0442\u0438\u044f.", "Failed to load events.")
          : tr("\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u0437\u0430\u0434\u0430\u0447\u0438.", "Failed to load tasks."))
      );
    }
    socialRenderCalendar();
  };

  const eventPromise = socialRequest(`/api/social/calendar/events?${eventsQuery.toString()}`)
    .then((rows) => applyCalendarRows("events", rows))
    .catch((error) => applyCalendarRows("events", null, error));
  const taskPromise = socialRequest("/api/social/tasks?task_kind=all&include_done=true")
    .then((rows) => applyCalendarRows("tasks", rows))
    .catch((error) => applyCalendarRows("tasks", null, error));

  await Promise.allSettled([eventPromise, taskPromise]);
  if (Number(socialState.calendarLoadSeq || 0) === seq) {
    socialRenderCalendar();
    setTimeout(() => {
      if (Number(socialState.calendarLoadSeq || 0) === seq) {
        socialRenderCalendar();
      }
    }, 60);
  }
}

function socialShiftCalendar(deltaMonths = 0) {
  const delta = Number(deltaMonths || 0);
  if (!Number.isFinite(delta) || !delta) return;
  const d = socialState.calendarDate;
  socialState.calendarDate = new Date(d.getFullYear(), d.getMonth() + delta, 1, 0, 0, 0, 0);
  socialLoadCalendar();
}

function socialJumpCalendarToday() {
  const now = new Date();
  socialState.calendarDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  socialState.calendarSelectedDay = socialCalendarDayKey(now);
  socialLoadCalendar();
}

function socialCalendarEntryTypeLabel(type) {
  const safe = String(type || "event").toLowerCase();
  if (safe === "task") return tr("Р—Р°РґР°С‡Р°", "Task");
  if (safe === "reminder") return tr("РќР°РїРѕРјРёРЅР°РЅРёРµ", "Reminder");
  return tr("РЎРѕР±С‹С‚РёРµ", "Event");
}

function socialCalendarEntryColor(entry) {
  const kind = String(entry?.entry_type || "event").toLowerCase();
  const raw = String(entry?.color || "").trim();
  if (raw && /^#[0-9a-fA-F]{6}$/.test(raw)) return raw;
  if (kind === "task") {
    const task = entry?.task_row || entry;
    const status = String(typeof socialTaskVisualStatus === "function" ? socialTaskVisualStatus(task) : (task?.status || "todo")).toLowerCase();
    const bucket = String(task?.bucket || entry?.bucket || "").toLowerCase();
    if (status === "done" || bucket === "done") return "#16a34a";
    if (bucket === "overdue") return "#dc2626";
    return "#2563eb";
  }
  if (kind === "reminder") return "#8b5cf6";
  return "#d4a017";
}

function socialCalendarTaskBadge(task) {
  const status = String(typeof socialTaskVisualStatus === "function" ? socialTaskVisualStatus(task) : (task?.status || "todo")).toLowerCase();
  const bucket = String(task?.bucket || "").toLowerCase();
  if (status === "done" || bucket === "done") return tr("Выполнено", "Done");
  if (bucket === "overdue") return tr("Просрочено", "Overdue");
  return tr("Задача", "Task");
}

function socialCalendarDayBounds(dayKey) {
  const dt = socialCalendarParseDate(dayKey);
  if (!dt) return null;
  const start = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), 0, 0, 0, 0);
  const end = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), 23, 59, 59, 999);
  return { start, end };
}

function socialCalendarEntrySpansDay(startValue, endValue, dayKey) {
  const bounds = socialCalendarDayBounds(dayKey);
  const start = socialCalendarParseDate(startValue);
  if (!bounds || !start) return false;
  const end = socialCalendarParseDate(endValue || startValue) || start;
  return start.getTime() <= bounds.end.getTime() && end.getTime() >= bounds.start.getTime();
}

function socialCalendarCollectDayEntries(dayKey) {
  const entries = [];
  const events = Array.isArray(socialState.calendarEvents) ? socialState.calendarEvents : [];
  const tasks = Array.isArray(socialState.calendarTasks) ? socialState.calendarTasks : [];

  for (const row of events) {
    if (!socialCalendarEntrySpansDay(row?.start_at || "", row?.end_at || "", dayKey)) continue;
    entries.push({
      id: Number(row?.id || 0),
      entry_id: Number(row?.id || 0),
      source: "calendar",
      entry_type: String(row?.entry_type || "event").toLowerCase() === "reminder" ? "reminder" : "event",
      title: String(row?.title || "-").trim() || "-",
      details: socialCleanCalendarDetails(row?.details || ""),
      start_at: String(row?.start_at || ""),
      end_at: row?.end_at ? String(row.end_at) : "",
      is_all_day: Boolean(row?.is_all_day),
      is_public: Boolean(row?.is_public),
      color: socialCalendarEntryColor(row),
      sortTs: socialCalendarParseDate(row?.start_at || "")?.getTime() || 0,
    });
  }

  for (const task of tasks) {
    if (socialCalendarDayKey(task?.due_date || "") !== dayKey) continue;
    const due = socialCalendarParseDate(task?.due_date || "");
    entries.push({
      id: Number(task?.id || 0),
      entry_id: Number(task?.id || 0),
      source: "task",
      entry_type: "task",
      title: String(task?.title || "-").trim() || "-",
      details: String(task?.description || "").trim(),
      start_at: String(task?.due_date || ""),
      end_at: "",
      is_all_day: false,
      is_public: false,
      color: socialCalendarEntryColor({ entry_type: "task", color: "", task_row: task, bucket: task?.bucket || "", status: task?.status || "" }),
      task_row: task,
      sortTs: due?.getTime() || 0,
    });
  }

  entries.sort((a, b) => {
    if (a.is_all_day && !b.is_all_day) return -1;
    if (!a.is_all_day && b.is_all_day) return 1;
    return Number(a.sortTs || 0) - Number(b.sortTs || 0);
  });

  return entries;
}

function socialCalendarSnippetLabel(entry) {
  return String(entry?.title || "-").trim() || "-";
}

function socialRenderCalendar() {
  const grid = document.getElementById("socialCalendarGrid");
  const monthLabel = document.getElementById("socialCalendarMonthLabel");
  if (!grid) return;

  const d = socialState.calendarDate;
  const year = d.getFullYear();
  const month = d.getMonth();
  const firstDay = new Date(year, month, 1, 0, 0, 0, 0);
  const lastDay = new Date(year, month + 1, 0, 0, 0, 0, 0);
  const shift = (firstDay.getDay() + 6) % 7;
  const days = lastDay.getDate();
  const todayKey = socialCalendarDayKey(new Date());

  if (monthLabel) {
    monthLabel.textContent = socialCalendarMonthLabel(d);
  }

  const monthPrefix = `${year}-${socialCalendarPad(month + 1)}-`;
  const todayFallback = todayKey && String(todayKey).startsWith(monthPrefix) ? todayKey : `${monthPrefix}01`;
  const selected = String(socialState.calendarSelectedDay || "");
  const target = selected.startsWith(monthPrefix) ? selected : todayFallback;
  socialState.calendarSelectedDay = target;

  const dayEntriesMap = new Map();
  for (let day = 1; day <= days; day += 1) {
    const key = `${year}-${socialCalendarPad(month + 1)}-${socialCalendarPad(day)}`;
    dayEntriesMap.set(key, socialCalendarCollectDayEntries(key));
  }

  const daySheetNode = document.getElementById("socialCalendarDaySheet");
  const wasDaySheetOpen = Boolean(daySheetNode && !daySheetNode.classList.contains("hidden"));

  let html = `<div class="social-calendar-row head">${[tr("РџРЅ", "Mon"), tr("Р’С‚", "Tue"), tr("РЎСЂ", "Wed"), tr("Р§С‚", "Thu"), tr("РџС‚", "Fri"), tr("РЎР±", "Sat"), tr("Р’СЃ", "Sun")].map((x) => `<span>${x}</span>`).join("")}</div><div class="social-calendar-cells">`;
  for (let i = 0; i < shift; i += 1) {
    html += `<button class="social-day muted" disabled></button>`;
  }

  for (let day = 1; day <= days; day += 1) {
    const key = `${year}-${socialCalendarPad(month + 1)}-${socialCalendarPad(day)}`;
    const entries = dayEntriesMap.get(key) || [];
    const active = target === key ? "active" : "";
    const isToday = todayKey && key === todayKey ? "today" : "";

    const visible = entries.slice(0, 2);
    const hiddenCount = Math.max(0, entries.length - visible.length);
    const lines = visible.map((entry) => `<span class="social-day-snippet" style="--entry-color:${escapeHtml(socialCalendarEntryColor(entry))}">${escapeHtml(socialCalendarSnippetLabel(entry))}</span>`).join("");
    const more = hiddenCount > 0 ? `<span class="social-day-more">+${hiddenCount}</span>` : "";

    html += `
      <button class="social-day social-day--samsung ${active} ${isToday}" data-day-key="${key}" type="button" onclick="socialShowDay('${key}')">
        <b>${day}</b>
        <span class="social-day-snippets">${lines}${more}</span>
      </button>
    `;
  }

  html += `</div>`;
  grid.innerHTML = html;
  if (wasDaySheetOpen && socialState.calendarSelectedDay) {
    socialShowDay(socialState.calendarSelectedDay);
  } else {
    socialHideCalendarDaySheet();
  }
}

function socialBuildCalendarDaySheet(dayKey, entries) {
  const title = socialCalendarDayLabel(dayKey);
  const countLabel = entries.length === 1
    ? tr("1 Р·Р°РїРёСЃСЊ", "1 item")
    : currentLang === "en"
      ? `${entries.length} items`
      : `${entries.length} ${entries.length >= 2 && entries.length <= 4 ? "Р·Р°РїРёСЃРё" : "Р·Р°РїРёСЃРµР№"}`;
  const header = `
    <div class="social-calendar-day-sheet-head">
      <div class="social-calendar-day-sheet-title">
        <span>${escapeHtml(countLabel)}</span>
        <h4>${escapeHtml(title)}</h4>
      </div>
      <button type="button" class="social-calendar-day-sheet-close" onclick="socialHideCalendarDaySheet()" aria-label="${escapeHtml(tr("Р—Р°РєСЂС‹С‚СЊ", "Close"))}">&times;</button>
    </div>
  `;

  if (!entries.length) {
    return `${header}<div class="social-calendar-day-empty">${escapeHtml(tr("РќР° СЌС‚РѕС‚ РґРµРЅСЊ Р·Р°РїРёСЃРµР№ РЅРµС‚.", "No entries for this day."))}</div><div class="social-calendar-day-sheet-actions"><button type="button" class="social-calendar-day-sheet-add" onclick="socialOpenCalendarQuickAddMenu('${escapeHtml(dayKey)}')" aria-label="${escapeHtml(tr("Р”РѕР±Р°РІРёС‚СЊ", "Add"))}">+</button></div>`;
  }

  const rows = entries.map((entry) => {
    const kind = String(entry?.entry_type || "event").toLowerCase();
    const timeLabel = entry?.is_all_day
      ? tr("Весь день", "All day")
      : (entry?.start_at ? socialCalendarTimeLabel(entry.start_at) : "-");
    const taskRow = entry?.task_row || entry;
    const taskStatus = kind === "task" ? socialTaskVisualStatus(taskRow) : "";
    const taskBucket = String(taskRow?.bucket || entry?.bucket || "").toLowerCase();
    const entryColor = socialCalendarEntryColor(entry);
    const entryClass = kind === "task"
      ? (taskStatus === "done" || taskBucket === "done"
        ? "social-calendar-day-entry--done"
        : (taskBucket === "overdue" ? "social-calendar-day-entry--overdue" : "social-calendar-day-entry--active"))
      : `social-calendar-day-entry--${kind}`;
    const sub = kind === "task"
      ? `${socialCalendarTaskBadge(taskRow)} | ${entry?.task_row?.assignee_nick || tr("Без исполнителя", "No assignee")}`
      : `${socialCalendarEntryTypeLabel(kind)} | ${timeLabel}`;

    return `
      <button type="button" class="social-calendar-day-entry ${entryClass}" style="--entry-color:${escapeHtml(entryColor)}" onclick="socialOpenCalendarDetail('${kind}', ${Number(entry.entry_id || 0)}, '${escapeHtml(dayKey)}')">
        <span class="social-calendar-day-entry-dot"></span>
        <span class="social-calendar-day-entry-main">
          <b>${escapeHtml(String(entry.title || "-").trim() || "-")}</b>
          <small>${escapeHtml(sub)}</small>
        </span>
      </button>
    `;
  }).join("");

  return `${header}<div class="social-calendar-day-list">${rows}</div><div class="social-calendar-day-sheet-actions"><button type="button" class="social-calendar-day-sheet-add" onclick="socialOpenCalendarQuickAddMenu('${escapeHtml(dayKey)}')" aria-label="${escapeHtml(tr("Р”РѕР±Р°РІРёС‚СЊ", "Add"))}">+</button></div>`;
}

function socialHideCalendarDaySheet() {
  const shell = document.querySelector("#socialSubtabCalendar .social-calendar-shell--samsung");
  const backdrop = document.getElementById("socialCalendarDaySheetBackdrop");
  const sheet = document.getElementById("socialCalendarDaySheet");
  if (shell) shell.classList.remove("day-sheet-open");
  if (backdrop) backdrop.classList.add("hidden");
  if (sheet) {
    sheet.classList.add("hidden");
    sheet.setAttribute("aria-hidden", "true");
  }
}

function socialShowDay(dayKey) {
  const safeKey = String(dayKey || "").trim();
  if (!safeKey) return;
  socialState.calendarSelectedDay = safeKey;

  const grid = document.getElementById("socialCalendarGrid");
  if (grid) {
    grid.querySelectorAll(".social-day[data-day-key]").forEach((btn) => {
      btn.classList.toggle("active", String(btn.getAttribute("data-day-key") || "") === safeKey);
    });
  }

  const sheet = document.getElementById("socialCalendarDaySheet");
  const backdrop = document.getElementById("socialCalendarDaySheetBackdrop");
  const shell = document.querySelector("#socialSubtabCalendar .social-calendar-shell--samsung");
  if (!sheet) return;

  const entries = socialCalendarCollectDayEntries(safeKey);
  sheet.innerHTML = socialBuildCalendarDaySheet(safeKey, entries);
  sheet.classList.remove("hidden");
  sheet.setAttribute("aria-hidden", "false");
  if (backdrop) backdrop.classList.remove("hidden");
  if (shell) shell.classList.add("day-sheet-open");
}

function socialOpenCalendarDetail(kind, entryId, dayKey = "") {
  const safeKind = String(kind || "event").trim().toLowerCase();
  const id = Number(entryId || 0);
  if (!id) return;

  if (safeKind === "task") {
    const tasks = Array.isArray(socialState.calendarTasks) ? socialState.calendarTasks : [];
    const row = tasks.find((task) => Number(task?.id || 0) === id) || null;
    if (!row) return;

    const assignee = String(row?.assignee_nick || "").trim() || tr("РќРµ РЅР°Р·РЅР°С‡РµРЅРѕ", "Not assigned");
    const created = socialFormatTaskDateTime(row?.created_at) || "-";
    const due = socialFormatTaskDateTime(row?.due_date) || "-";
    socialOpenModal(
      tr("Р—Р°РґР°С‡Р°", "Task"),
      `
        <div class="social-calendar-detail-grid">
          <h3>${escapeHtml(String(row?.title || "-").trim() || "-")}</h3>
          <p>${escapeHtml(String(row?.description || "").trim() || tr("Р‘РµР· РѕРїРёСЃР°РЅРёСЏ", "No description"))}</p>
          <div class="social-calendar-detail-meta">
            <span>${escapeHtml(tr("РСЃРїРѕР»РЅРёС‚РµР»СЊ", "Assignee"))}: <b>${escapeHtml(assignee)}</b></span>
            <span>${escapeHtml(tr("РЎРѕР·РґР°РЅРѕ", "Created"))}: <b>${escapeHtml(created)}</b></span>
            <span>${escapeHtml(tr("Р”РµРґР»Р°Р№РЅ", "Deadline"))}: <b>${escapeHtml(due)}</b></span>
          </div>
        </div>
        <div class="actions social-calendar-detail-actions">
          <button type="button" onclick="socialOpenCalendarTaskEdit(${id})">${escapeHtml(tr("Р РµРґР°РєС‚РёСЂРѕРІР°С‚СЊ", "Edit"))}</button>
          ${Boolean(row?.can_delete || socialState.boot?.actor?.is_owner) ? `<button class="btn-danger" type="button" onclick="socialCloseModal(); socialDeleteTask(${id})">${escapeHtml(tr("РЈРґР°Р»РёС‚СЊ", "Delete"))}</button>` : ""}
        </div>
      `
    );
    return;
  }

  const events = Array.isArray(socialState.calendarEvents) ? socialState.calendarEvents : [];
  const row = events.find((eventRow) => Number(eventRow?.id || 0) === id) || null;
  if (!row) return;

  const startText = row?.is_all_day ? tr("Р’РµСЃСЊ РґРµРЅСЊ", "All day") : (socialFormatTaskDateTime(row?.start_at) || "-");
  const endText = row?.end_at ? (socialFormatTaskDateTime(row?.end_at) || "-") : tr("РќРµ Р·Р°РґР°РЅРѕ", "Not set");
  const scopeText = row?.is_public ? tr("РћР±С‰РµРµ", "Shared") : tr("Р›РёС‡РЅРѕРµ", "Private");

  socialOpenModal(
    socialCalendarEntryTypeLabel(row?.entry_type || "event"),
    `
      <div class="social-calendar-detail-grid">
        <h3>${escapeHtml(String(row?.title || "-").trim() || "-")}</h3>
        <p>${escapeHtml(socialCleanCalendarDetails(row?.details || "") || tr("Р‘РµР· РѕРїРёСЃР°РЅРёСЏ", "No description"))}</p>
        <div class="social-calendar-detail-meta">
          <span>${escapeHtml(tr("РќР°С‡Р°Р»Рѕ", "Start"))}: <b>${escapeHtml(startText)}</b></span>
          <span>${escapeHtml(tr("РљРѕРЅРµС†", "End"))}: <b>${escapeHtml(endText)}</b></span>
          <span>${escapeHtml(tr("Р’РёРґРёРјРѕСЃС‚СЊ", "Visibility"))}: <b>${escapeHtml(scopeText)}</b></span>
        </div>
      </div>
      <div class="actions social-calendar-detail-actions">
        <button type="button" onclick="socialCloseModal(); socialOpenCalendarModal(${id})">${escapeHtml(tr("Р РµРґР°РєС‚РёСЂРѕРІР°С‚СЊ", "Edit"))}</button>
        <button class="btn-danger" type="button" onclick="socialCloseModal(); socialDeleteEvent(${id})">${escapeHtml(tr("РЈРґР°Р»РёС‚СЊ", "Delete"))}</button>
      </div>
    `
  );
}

function socialOpenCalendarDetails(entryId, dayKey = "") {
  const id = Number(entryId || 0);
  if (!id) return false;
  const safeDay = String(dayKey || socialState.calendarSelectedDay || "").trim();
  const taskRow = (Array.isArray(socialState.calendarTasks) ? socialState.calendarTasks : []).find((task) => Number(task?.id || 0) === id) || null;
  if (taskRow) {
    socialOpenCalendarDetail("task", id, safeDay);
    return true;
  }
  const eventRow = (Array.isArray(socialState.calendarEvents) ? socialState.calendarEvents : []).find((row) => Number(row?.id || 0) === id) || null;
  if (eventRow) {
    socialOpenCalendarDetail(String(eventRow?.entry_type || "event").trim().toLowerCase() === "reminder" ? "reminder" : "event", id, safeDay);
    return true;
  }
  return false;
}
if (typeof globalThis !== "undefined") {
  globalThis.socialHideCalendarDaySheet = socialHideCalendarDaySheet;
  globalThis.socialShowDay = socialShowDay;
  globalThis.socialOpenCalendarDetail = socialOpenCalendarDetail;
  globalThis.socialOpenCalendarDetails = socialOpenCalendarDetails;
}

function socialCalendarDefaultDateTime(dayKey = "") {
  const safeKey = String(dayKey || socialState.calendarSelectedDay || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(safeKey)) {
    return `${safeKey}T09:00`;
  }
  const now = new Date();
  return `${now.getFullYear()}-${socialCalendarPad(now.getMonth() + 1)}-${socialCalendarPad(now.getDate())}T09:00`;
}

function socialOpenCalendarQuickAddEntry(dayKey = "", entryType = "event") {
  const safeDay = String(dayKey || socialState.calendarSelectedDay || socialCalendarDayKey(new Date())).trim();
  const safeType = String(entryType || "event").trim().toLowerCase() === "reminder" ? "reminder" : "event";
  socialHideCalendarDaySheet();
  socialCloseModal();
  setTimeout(() => {
    socialOpenCalendarModal(0, { dayKey: safeDay, entryType: safeType });
  }, 60);
}

function socialOpenCalendarTaskQuickAdd(dayKey = "") {
  const safeDay = String(dayKey || socialState.calendarSelectedDay || socialCalendarDayKey(new Date())).trim();
  socialHideCalendarDaySheet();
  socialCloseModal();
  setTimeout(() => {
    socialOpenCalendarTaskCreateModal(safeDay);
  }, 60);
}

function socialOpenCalendarQuickAddMenu(dayKey = "") {
  const safeDay = String(dayKey || socialState.calendarSelectedDay || socialCalendarDayKey(new Date())).trim();
  const html = [
    '<div class="social-calendar-quick-add-menu">',
    '<button type="button" onclick="socialOpenCalendarQuickAddEntry(&quot;' + escapeHtml(safeDay) + '&quot;, &quot;event&quot;)">' + escapeHtml(tr("Событие", "Event")) + '</button>',
    '<button type="button" onclick="socialOpenCalendarQuickAddEntry(&quot;' + escapeHtml(safeDay) + '&quot;, &quot;reminder&quot;)">' + escapeHtml(tr("Напоминание", "Reminder")) + '</button>',
    '<button type="button" onclick="socialOpenCalendarTaskQuickAdd(&quot;' + escapeHtml(safeDay) + '&quot;)">' + escapeHtml(tr("Задача", "Task")) + '</button>',
    '</div>',
  ].join("");
  socialOpenModal(tr("Добавить", "Add"), html);
}

if (typeof globalThis !== "undefined") {
  globalThis.socialOpenCalendarQuickAddEntry = socialOpenCalendarQuickAddEntry;
  globalThis.socialOpenCalendarTaskQuickAdd = socialOpenCalendarTaskQuickAdd;
  globalThis.socialOpenCalendarQuickAddMenu = socialOpenCalendarQuickAddMenu;
}

async function socialOpenCalendarTaskCreateModal(dayKey = "") {
  if (!Array.isArray(socialState.actors) || !socialState.actors.length) {
    await socialLoadTaskActors().catch(() => null);
  }
  if (!Array.isArray(socialState.projects) || !socialState.projects.length) {
    await socialLoadProjects().catch(() => null);
  }

  const actors = Array.isArray(socialState.actors) ? socialState.actors : [];
  const projects = Array.isArray(socialState.projects) ? socialState.projects : [];
  const due = socialCalendarDefaultDateTime(dayKey).slice(0, 16);
  const actorDefault = String(socialState.boot?.actor?.actor_key || "").trim();

  socialOpenModal(
    tr("РќРѕРІР°СЏ Р·Р°РґР°С‡Р°", "New task"),
    `
      <div class="grid-2">
        <label><span>${escapeHtml(tr("РќР°Р·РІР°РЅРёРµ", "Title"))}</span><input id="socialCalendarTaskTitle" /></label>
        <label><span>${escapeHtml(tr("РСЃРїРѕР»РЅРёС‚РµР»СЊ", "Assignee"))}</span><select id="socialCalendarTaskAssignee">${actors.map((a) => {
          const key = String(a?.actor_key || "");
          const selected = key === actorDefault ? "selected" : "";
          return `<option value="${escapeHtml(key)}" ${selected}>${escapeHtml(String(a?.nick || "-"))}</option>`;
        }).join("")}</select></label>
        <label><span>${escapeHtml(tr("РџСЂРѕРµРєС‚", "Project"))}</span><select id="socialCalendarTaskProject"><option value="">${escapeHtml(tr("Р‘РµР· РїСЂРѕРµРєС‚Р°", "No project"))}</option>${projects.map((p) => `<option value="${Number(p?.id || 0)}">${escapeHtml(String(p?.title || "-"))}</option>`).join("")}</select></label>
        <label><span>${escapeHtml(tr("РўРёРї", "Type"))}</span><select id="socialCalendarTaskKind"><option value="company">${escapeHtml(tr("РџСЂРѕРµРєС‚РЅР°СЏ", "Project"))}</option><option value="personal">${escapeHtml(tr("Р›РёС‡РЅР°СЏ", "Personal"))}</option></select></label>
        <label><span>${escapeHtml(tr("РџСЂРёРѕСЂРёС‚РµС‚", "Priority"))}</span><select id="socialCalendarTaskPriority"><option value="normal">normal</option><option value="high">high</option><option value="critical">critical</option><option value="low">low</option></select></label>
        <label><span>${escapeHtml(tr("Р”РµРґР»Р°Р№РЅ", "Deadline"))}</span><input id="socialCalendarTaskDue" type="datetime-local" value="${escapeHtml(due)}" /></label>
        <label class="full"><span>${escapeHtml(tr("РћРїРёСЃР°РЅРёРµ", "Description"))}</span><textarea id="socialCalendarTaskDescription" rows="4"></textarea></label>
      </div>
      <div class="actions">
        <button type="button" onclick="socialCreateTaskFromCalendar()">${escapeHtml(tr("РЎРѕР·РґР°С‚СЊ", "Create"))}</button>
      </div>
    `
  );
}

async function socialCreateTaskFromCalendar() {
  const taskKind = String(document.getElementById("socialCalendarTaskKind")?.value || "company").trim().toLowerCase();
  const payload = {
    title: String(document.getElementById("socialCalendarTaskTitle")?.value || "").trim(),
    description: String(document.getElementById("socialCalendarTaskDescription")?.value || "").trim(),
    due_date: String(document.getElementById("socialCalendarTaskDue")?.value || "").trim() || null,
    assignee_key: String(document.getElementById("socialCalendarTaskAssignee")?.value || "").trim(),
    task_kind: taskKind === "personal" ? "personal" : "company",
    priority: String(document.getElementById("socialCalendarTaskPriority")?.value || "normal").trim(),
    status: "todo",
    project_id: taskKind === "personal" ? null : (Number(document.getElementById("socialCalendarTaskProject")?.value || 0) || null),
  };

  if (!payload.title) {
    alert(tr("РќР°Р·РІР°РЅРёРµ Р·Р°РґР°С‡Рё РѕР±СЏР·Р°С‚РµР»СЊРЅРѕ", "Task title is required"));
    return;
  }

  try {
    await socialRequest("/api/social/tasks", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  } catch (e) {
    alert(e?.message || tr("РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕР·РґР°С‚СЊ Р·Р°РґР°С‡Сѓ", "Failed to create task"));
    return;
  }

  socialCloseModal();
  socialState.calendarSelectedDay = socialCalendarDayKey(payload.due_date || "") || socialState.calendarSelectedDay;
  await socialLoadCalendar();
  if (socialState.calendarSelectedDay) socialShowDay(socialState.calendarSelectedDay);
}

function socialOpenCalendarModal(eventId = 0, preset = null) {
  const row = (Array.isArray(socialState.calendarEvents) ? socialState.calendarEvents : []).find((x) => Number(x.id) === Number(eventId || 0)) || null;
  const dayKey = String(preset?.dayKey || socialState.calendarSelectedDay || socialCalendarDayKey(new Date())).trim();
  const defaultStart = socialCalendarDefaultDateTime(dayKey);
  const typeValue = String(row?.entry_type || preset?.entryType || "event").trim().toLowerCase() === "reminder" ? "reminder" : "event";
  const startValue = socialCalendarDateTimeValue(row?.start_at || defaultStart).slice(0, 16);
  const endValue = socialCalendarDateTimeValue(row?.end_at || "").slice(0, 16);
  const colorValue = /^#[0-9a-fA-F]{6}$/.test(String(row?.color || ""))
    ? String(row.color)
    : (typeValue === "reminder" ? "#8b5cf6" : "#d4a017");

  socialOpenModal(
    row ? tr("Р РµРґР°РєС‚РёСЂРѕРІР°С‚СЊ Р·Р°РїРёСЃСЊ", "Edit entry") : tr("РќРѕРІР°СЏ Р·Р°РїРёСЃСЊ", "New entry"),
    `
      <div class="grid-2">
        <label><span>${escapeHtml(tr("РќР°Р·РІР°РЅРёРµ", "Title"))}</span><input id="socialEventTitle" value="${escapeHtml(row?.title || "")}" /></label>
        <label><span>${escapeHtml(tr("РўРёРї", "Type"))}</span>
          <select id="socialEventType">
            <option value="event" ${typeValue === "event" ? "selected" : ""}>${escapeHtml(tr("РЎРѕР±С‹С‚РёРµ", "Event"))}</option>
            <option value="reminder" ${typeValue === "reminder" ? "selected" : ""}>${escapeHtml(tr("РќР°РїРѕРјРёРЅР°РЅРёРµ", "Reminder"))}</option>
          </select>
        </label>
        <label><span>${escapeHtml(tr("РќР°С‡Р°Р»Рѕ", "Start"))}</span><input id="socialEventStart" type="datetime-local" value="${escapeHtml(startValue)}" /></label>
        <label><span>${escapeHtml(tr("РљРѕРЅРµС†", "End"))}</span><input id="socialEventEnd" type="datetime-local" value="${escapeHtml(endValue)}" /></label>
        <label><span>${escapeHtml(tr("Р¦РІРµС‚", "Color"))}</span><input id="socialEventColor" type="color" value="${escapeHtml(colorValue)}" /></label>
        <label class="check"><input id="socialEventAllDay" type="checkbox" ${row?.is_all_day ? "checked" : ""} /> ${escapeHtml(tr("Р’РµСЃСЊ РґРµРЅСЊ", "All day"))}</label>
        <label class="check"><input id="socialEventPublic" type="checkbox" ${row?.is_public ? "checked" : ""} /> ${escapeHtml(tr("РћР±С‰РµРµ СЃРѕР±С‹С‚РёРµ (РІРёРґРЅРѕ РІСЃРµРј)", "Shared event (visible to everyone)"))}</label>
        <label class="full"><span>${escapeHtml(tr("РћРїРёСЃР°РЅРёРµ", "Details"))}</span><textarea id="socialEventDetails" rows="4">${escapeHtml(socialCleanCalendarDetails(row?.details || ""))}</textarea></label>
      </div>
      <div class="actions"><button type="button" onclick="socialSaveEvent(${row ? Number(row.id) : 0})">${row ? escapeHtml(tr("РЎРѕС…СЂР°РЅРёС‚СЊ", "Save")) : escapeHtml(tr("РЎРѕР·РґР°С‚СЊ", "Create"))}</button></div>
    `
  );
}

function socialCalendarNormalizeDateTimeInput(raw, fallback = "") {
  const text = String(raw || "").trim();
  if (!text) return String(fallback || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return `${text}T09:00`;
  return text;
}

if (typeof globalThis !== "undefined") {
  globalThis.socialOpenCalendarModal = socialOpenCalendarModal;
  globalThis.socialOpenCalendarTaskCreateModal = socialOpenCalendarTaskCreateModal;
  globalThis.socialCreateTaskFromCalendar = socialCreateTaskFromCalendar;
}

async function socialSaveEvent(eventId = 0) {
  const allDay = Boolean(document.getElementById("socialEventAllDay")?.checked);
  let startAt = socialCalendarNormalizeDateTimeInput(document.getElementById("socialEventStart")?.value || "", socialCalendarDefaultDateTime());
  let endAt = socialCalendarNormalizeDateTimeInput(document.getElementById("socialEventEnd")?.value || "", "");
  if (allDay) {
    const dateOnly = String(startAt || "").slice(0, 10);
    if (dateOnly) {
      startAt = `${dateOnly}T09:00`;
      if (!endAt) endAt = `${dateOnly}T18:00`;
    }
  }

  const payload = {
    title: String(document.getElementById("socialEventTitle")?.value || "").trim(),
    details: String(document.getElementById("socialEventDetails")?.value || "").trim(),
    start_at: startAt,
    end_at: endAt || null,
    is_public: Boolean(document.getElementById("socialEventPublic")?.checked),
    entry_type: String(document.getElementById("socialEventType")?.value || "event").trim().toLowerCase() === "reminder" ? "reminder" : "event",
    is_all_day: allDay,
    color: String(document.getElementById("socialEventColor")?.value || "").trim() || null,
  };

  if (!payload.title || !payload.start_at) {
    alert(tr("Р—Р°РїРѕР»РЅРёС‚Рµ РЅР°Р·РІР°РЅРёРµ Рё РґР°С‚Сѓ РЅР°С‡Р°Р»Р°", "Fill title and start date"));
    return;
  }

  const req = eventId > 0
    ? socialRequest(`/api/social/calendar/events/${Number(eventId)}`, { method: "PUT", body: JSON.stringify(payload) })
    : socialRequest("/api/social/calendar/events", { method: "POST", body: JSON.stringify(payload) });

  try {
    await req;
  } catch (e) {
    alert(e?.message || tr("РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕС…СЂР°РЅРёС‚СЊ Р·Р°РїРёСЃСЊ", "Failed to save entry"));
    return;
  }

  socialState.calendarSelectedDay = socialCalendarDayKey(payload.start_at || "") || socialState.calendarSelectedDay;
  socialCloseModal();
  await socialLoadCalendar();
  if (socialState.calendarSelectedDay) socialShowDay(socialState.calendarSelectedDay);
}

async function socialDeleteEvent(eventId) {
  const id = Number(eventId || 0);
  if (!id) return;
  await socialRequest(`/api/social/calendar/events/${id}`, { method: "DELETE" }).catch((e) => alert(e?.message || tr("РќРµ СѓРґР°Р»РѕСЃСЊ СѓРґР°Р»РёС‚СЊ Р·Р°РїРёСЃСЊ", "Failed to delete entry")));
  await socialLoadCalendar();
  socialHideCalendarDaySheet();
}

async function socialSyncGoogleCalendar() {
  const urlInput = document.getElementById("socialCalendarGoogleIcs");
  const replaceInput = document.getElementById("socialCalendarGoogleReplace");
  const syncBtn = document.querySelector(".social-calendar-sync-btn");
  const previousText = String(syncBtn?.textContent || "").trim();
  const url = String(urlInput?.value || "").trim();
  const replaceSource = Boolean(replaceInput?.checked);
  const oauthConnected = Boolean(socialState.googleCalendarOauth?.connected);
  const useIcs = Boolean(url);
  if (!useIcs && !oauthConnected) {
    await socialConnectGoogleCalendar();
    return;
  }
  if (useIcs) {
    try {
      localStorage.setItem("social_calendar_google_ics_url", url);
      localStorage.setItem("social_calendar_google_replace", replaceSource ? "1" : "0");
    } catch (_) {}
  }
  if (syncBtn) {
    syncBtn.disabled = true;
    syncBtn.textContent = tr("РЎРёРЅС…СЂРѕРЅРёР·РёСЂСѓРµРј...", "Syncing...");
  }
  socialSetCalendarSyncMessage("info", tr("РЎРёРЅС…СЂРѕРЅРёР·Р°С†РёСЏ Р·Р°РїСѓС‰РµРЅР°", "Sync started"), [tr("РџРѕРґРѕР¶РґРёС‚Рµ, РїРѕРєР° SEO WIBE РѕР±СЂР°Р±РѕС‚Р°РµС‚ РєР°Р»РµРЅРґР°СЂРЅС‹Рµ СЃРѕР±С‹С‚РёСЏ.", "Please wait while SEO WIBE processes calendar events.")]);
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
    socialSetCalendarSyncMessage("error", tr("РЎРёРЅС…СЂРѕРЅРёР·Р°С†РёСЏ РєР°Р»РµРЅРґР°СЂСЏ РЅРµ СѓРґР°Р»Р°СЃСЊ", "Calendar sync failed"), [e?.message || tr("РџСЂРѕРІРµСЂСЊС‚Рµ СЃСЃС‹Р»РєСѓ, РґРѕСЃС‚СѓРїРЅРѕСЃС‚СЊ Google OAuth РёР»Рё РїРѕРІС‚РѕСЂРёС‚Рµ РїРѕР·Р¶Рµ.", "Check the link, Google OAuth availability, or retry later.")]);
    return null;
  });
  if (syncBtn) {
    syncBtn.disabled = false;
    syncBtn.textContent = previousText || tr("РЎРёРЅС…СЂРѕРЅРёР·РёСЂРѕРІР°С‚СЊ СЃРµР№С‡Р°СЃ", "Sync now");
  }
  if (!data) return;
  const warnings = Array.isArray(data.warnings) ? data.warnings.map((line) => String(line || "").trim()).filter(Boolean) : [];
  const summaryLines = [
    `${tr("РРјРїРѕСЂС‚", "Imported")}: ${Number(data.imported || 0)}`,
    `${tr("РћР±РЅРѕРІР»РµРЅРѕ", "Updated")}: ${Number(data.updated || 0)}`,
    `${tr("РЈРґР°Р»РµРЅРѕ", "Deleted")}: ${Number(data.deleted || 0)}`,
    `${tr("РџСЂРѕРїСѓС‰РµРЅРѕ", "Skipped")}: ${Number(data.skipped || 0)}`,
    `${tr("РСЃС‚РѕС‡РЅРёРє", "Source")}: ${useIcs ? "ICS URL" : "Google OAuth"}`,
  ];
  if (warnings.length) summaryLines.push(`${tr("РџСЂРµРґСѓРїСЂРµР¶РґРµРЅРёСЏ", "Warnings")}: ${warnings.join(" | ")}`);
  socialSetCalendarSyncMessage(
    warnings.length ? "warn" : "success",
    warnings.length ? tr("РЎРёРЅС…СЂРѕРЅРёР·Р°С†РёСЏ Р·Р°РІРµСЂС€РёР»Р°СЃСЊ СЃ РїСЂРµРґСѓРїСЂРµР¶РґРµРЅРёСЏРјРё", "Sync completed with warnings") : tr("РљР°Р»РµРЅРґР°СЂСЊ СЃРёРЅС…СЂРѕРЅРёР·РёСЂРѕРІР°РЅ", "Calendar synchronized"),
    summaryLines
  );
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
    out.textContent = tr("РќРµРґРѕРїСѓСЃС‚РёРјРѕРµ РІС‹СЂР°Р¶РµРЅРёРµ", "Invalid expression");
    return;
  }
  try {
    // eslint-disable-next-line no-new-func
    const value = Function(`return (${safe.replace(/%/g, "/100")});`)();
    const normalized = Number(value);
    out.textContent = Number.isFinite(normalized)
      ? normalized.toLocaleString("ru-RU", { maximumFractionDigits: 8 })
      : tr("РћС€РёР±РєР° РІС‹С‡РёСЃР»РµРЅРёСЏ", "Calculation error");
    const input = document.getElementById("socialCalcExpr");
    if (input && Number.isFinite(normalized)) {
      input.value = String(normalized);
    }
  } catch (_) {
    out.textContent = tr("РћС€РёР±РєР° РІС‹С‡РёСЃР»РµРЅРёСЏ", "Calculation error");
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
  const status = payload.stale ? tr("РѕР±РЅРѕРІР»РµРЅРёРµ Р·Р°РґРµСЂР¶РёРІР°РµС‚СЃСЏ", "stale") : tr("РѕР±РЅРѕРІР»РµРЅРѕ", "updated");
  const stamp = date || (updated ? updated.slice(0, 16).replace("T", " ") : "-");
  meta.textContent = `${tr("РљСѓСЂСЃС‹ Р¦Р‘", "CBR rates")}: ${stamp} - ${status}${note ? ` - ${note}` : ""}`;
}

async function socialLoadCurrencyRates({ force = false } = {}) {
  if (socialState.currencyRatesLoading) return socialState.currencyRates;
  const now = Date.now();
  if (!force && socialState.currencyRates && (now - socialState.currencyRatesStamp) < SOCIAL_CURRENCY_REFRESH_MS) {
    return socialState.currencyRates;
  }
  if (!socialState.currencyRates) {
    socialUpdateCurrencyMeta(null, tr("Р—Р°РіСЂСѓР·РєР° РєСѓСЂСЃРѕРІ Р¦Р‘...", "Loading CBR rates..."));
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
    socialUpdateCurrencyMeta(null, tr("РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё", "Load failed"));
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
    RUB: tr("RUB (СЂСѓР±.)", "RUB"),
    USD: "USD",
    EUR: "EUR",
    CNY: "CNY",
    BYN: tr("BYN (Р±РµР». СЂСѓР±.)", "BYN (BYN)"),
    TRY: tr("TRY (Р»РёСЂР°)", "TRY (Lira)"),
    GBP: tr("GBP (С„СѓРЅС‚)", "GBP (Pound)"),
    UAH: tr("UAH (РіСЂРёРІРЅР°)", "UAH (Hryvnia)"),
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
    out.textContent = tr("Р’РІРµРґРёС‚Рµ С‡РёСЃР»Рѕ", "Enter a number");
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
    out.textContent = tr("Р’С‹Р±РµСЂРёС‚Рµ РµРґРёРЅРёС†С‹", "Select units");
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
    out.textContent = tr("Р’РІРµРґРёС‚Рµ РґР»РёРЅСѓ, С€РёСЂРёРЅСѓ Рё РІС‹СЃРѕС‚Сѓ", "Enter length, width and height");
    return;
  }
  const cm3 = a * b * c;
  const liters = cm3 / 1000;
  const m3 = cm3 / 1_000_000;
  out.textContent = `${tr("РћР±СЉРµРј", "Volume")}: ${cm3.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} СЃРјВі - ${liters.toLocaleString("ru-RU", { maximumFractionDigits: 3 })} Р» - ${m3.toLocaleString("ru-RU", { maximumFractionDigits: 6 })} РјВі`;
}

function socialNormalizeNoteText(value) {
  const raw = String(value || "");
  if (!raw) return "";
  if (typeof window.decodePossiblyMojibake === "function") {
    try {
      return String(window.decodePossiblyMojibake(raw) || "");
    } catch (_) {
      return raw;
    }
  }
  return raw;
}

function socialNormalizeNoteRow(row) {
  if (!row || typeof row !== "object") return row;
  return {
    ...row,
    title: socialNormalizeNoteText(row.title || ""),
    content: socialNormalizeNoteText(row.content || ""),
  };
}

async function socialLoadNotes() {
  const rows = await socialRequest("/api/social/notes").catch((e) => {
    alert(e.message);
    return [];
  });
  socialState.notes = Array.isArray(rows)
    ? rows.map((row) => socialNormalizeNoteRow(row)).filter(Boolean)
    : [];
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
        <b>${escapeHtml(row.title || tr("Р‘РµР· РЅР°Р·РІР°РЅРёСЏ", "Untitled"))}</b>
        <small>${escapeHtml(String(row.updated_at || "").slice(0,16).replace("T", " "))}</small>
      </button>
      <button class="btn-secondary social-note-delete" type="button" onclick="socialDeleteNote(${Number(row.id)})">вњ•</button>
    </div>
  `).join("") || `<div class="hint">${tr("Р—Р°РјРµС‚РѕРє РїРѕРєР° РЅРµС‚", "No notes yet")}</div>`;
}

function socialRenderCurrentNote() {
  const note = socialState.notes.find((x) => Number(x.id) === Number(socialState.currentNoteId || 0)) || null;
  const title = document.getElementById("socialNoteTitle");
  const content = document.getElementById("socialNoteContent");
  if (!title || !content) return;
  title.value = socialNormalizeNoteText(note?.title || "");
  content.value = socialNormalizeNoteText(note?.content || "");
  const autosave = document.getElementById("socialNoteAutosave");
  if (autosave) autosave.textContent = note ? tr("РђРІС‚РѕСЃРѕС…СЂР°РЅРµРЅРёРµ РІРєР»СЋС‡РµРЅРѕ", "Autosave enabled") : tr("Р’С‹Р±РµСЂРёС‚Рµ Р·Р°РјРµС‚РєСѓ", "Select note");
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
    body: JSON.stringify({ title: tr("РќРѕРІР°СЏ Р·Р°РјРµС‚РєР°", "New note"), content: "" }),
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
    title: String(titleNode?.value || "").trim() || tr("Р‘РµР· РЅР°Р·РІР°РЅРёСЏ", "Untitled"),
    content: String(contentNode?.value || ""),
  };
  if (autosave) autosave.textContent = tr("РЎРѕС…СЂР°РЅСЏРµРј...", "Saving...");
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
  if (autosave) autosave.textContent = tr("РЎРѕС…СЂР°РЅРµРЅРѕ", "Saved");
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
    host.innerHTML = `<div class="hint">${tr("Р¤Р°Р№Р»С‹ Р±СѓРґСѓС‚ РґРѕСЃС‚СѓРїРЅС‹ РїРѕСЃР»Рµ РІС‹Р±РѕСЂР° Р·Р°РјРµС‚РєРё", "Files will appear after selecting a note")}</div>`;
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
        <button class="btn-secondary" type="button" onclick="socialDeleteNoteFile(${Number(file.id || 0)})">вњ•</button>
      </div>
    `).join("")
    : `<div class="hint">${tr("Р¤Р°Р№Р»С‹ РїРѕРєР° РЅРµ Р·Р°РіСЂСѓР¶РµРЅС‹", "No files uploaded yet")}</div>`;
}

function socialTriggerNoteFileDialog() {
  const noteId = Number(socialState.currentNoteId || 0);
  if (!noteId) {
    alert(tr("РЎРЅР°С‡Р°Р»Р° РІС‹Р±РµСЂРёС‚Рµ Р·Р°РјРµС‚РєСѓ", "Select a note first"));
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
  if (autosave) autosave.textContent = tr("Р—Р°РіСЂСѓР¶Р°РµРј С„Р°Р№Р»С‹...", "Uploading files...");
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
    if (autosave) autosave.textContent = tr("Р¤Р°Р№Р»С‹ Р·Р°РіСЂСѓР¶РµРЅС‹", "Files uploaded");
  } catch (e) {
    if (autosave) autosave.textContent = String(e?.message || tr("РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё С„Р°Р№Р»Р°", "File upload error"));
    alert(e?.message || tr("РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё С„Р°Р№Р»Р°", "File upload error"));
  } finally {
    if (input) input.value = "";
  }
}

async function socialDeleteNoteFile(fileId) {
  const id = Number(fileId || 0);
  const noteId = Number(socialState.currentNoteId || 0);
  if (!id || !noteId) return;
  if (!confirm(tr("РЈРґР°Р»РёС‚СЊ С„Р°Р№Р»?", "Delete file?"))) return;
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
  if (!confirm(tr("РЈРґР°Р»РёС‚СЊ Р·Р°РјРµС‚РєСѓ?", "Delete note?"))) return;
  await socialRequest(`/api/social/notes/${id}`, { method: "DELETE" }).catch((e) => alert(e.message));
  if (socialState.currentNoteId === id) socialState.currentNoteId = 0;
  await socialLoadNotes();
}


function socialGetChatContextBoundsSafe() {
  const main = document.querySelector("#socialSubtabChat .social-chat-main");
  const mainRect = main?.getBoundingClientRect ? main.getBoundingClientRect() : null;
  const vv = window.visualViewport;
  const viewportLeft = Number(vv?.offsetLeft || 0);
  const viewportTop = Number(vv?.offsetTop || 0);
  const viewportWidth = Number(vv?.width || window.innerWidth || document.documentElement.clientWidth || 0);
  const viewportHeight = Number(vv?.height || window.innerHeight || document.documentElement.clientHeight || 0);
  const viewportRight = viewportLeft + viewportWidth;
  const viewportBottom = viewportTop + viewportHeight;

  if (!mainRect || mainRect.width <= 0 || mainRect.height <= 0) {
    return {
      container: null,
      left: viewportLeft,
      top: viewportTop,
      width: viewportWidth,
      height: viewportHeight,
    };
  }

  const left = Math.max(mainRect.left, viewportLeft);
  const top = Math.max(mainRect.top, viewportTop);
  const right = Math.min(mainRect.right, viewportRight);
  const bottom = Math.min(mainRect.bottom, viewportBottom);
  if (right - left < 120 || bottom - top < 120) {
    return {
      container: main,
      left: mainRect.left,
      top: mainRect.top,
      width: Math.max(0, mainRect.width),
      height: Math.max(0, mainRect.height),
    };
  }
  return {
    container: main,
    left,
    top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

function socialOpenMessageContextSafe(messageId, event) {
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

  const bubble = event?.target?.closest?.(".tg-msg-bubble") || event?.currentTarget?.closest?.(".tg-msg-bubble") || event?.target || null;
  const rect = bubble?.getBoundingClientRect ? bubble.getBoundingClientRect() : null;
  const fallbackX = Number(event?.clientX || 0) || Number(rect?.left || 0) + Math.max(18, Math.min(42, Number(rect?.width || 0) * 0.6));
  const fallbackY = Number(event?.clientY || 0) || Number(rect?.top || 0) + Math.max(18, Math.min(30, Number(rect?.height || 0) * 0.45));
  socialState.chatContextX = fallbackX;
  socialState.chatContextY = fallbackY;

  const quick = ["\u{1F44D}", "\u{1F525}", "\u2764\uFE0F", "\u{1F602}", "\u{1F64F}", "\u2705"];
  menu.innerHTML = `
    <button type="button" class="social-chat-context-btn" onclick="socialContextReply()">${tr("\u041E\u0442\u0432\u0435\u0442\u0438\u0442\u044C", "Reply")}</button>
    <div class="social-chat-context-reactions">
      ${quick.map((emoji) => `<button type="button" class="social-chat-context-emoji" onclick="socialContextReact('${escapeHtml(emoji)}')">${emoji}</button>`).join("")}
    </div>
  `;

  const bounds = socialGetChatContextBoundsSafe();
  if (bounds.container && menu.parentElement !== bounds.container) {
    bounds.container.appendChild(menu);
  }

  menu.style.position = bounds.container ? "absolute" : "fixed";
  menu.style.left = "0px";
  menu.style.top = "0px";
  const safe = 10;
  const usableWidth = Math.max(120, Number(bounds.width || 0));
  const usableHeight = Math.max(120, Number(bounds.height || 0));
  menu.style.maxWidth = `${Math.max(160, Math.min(300, usableWidth - safe * 2))}px`;
  menu.style.maxHeight = `${Math.max(120, Math.min(240, usableHeight - safe * 2))}px`;
  menu.style.visibility = "hidden";
  menu.classList.remove("hidden");

  const menuRect = menu.getBoundingClientRect();
  const anchorLeft = Number(rect?.left || fallbackX);
  const anchorRight = Number(rect?.right || fallbackX);
  const anchorTop = Number(rect?.top || fallbackY);
  const anchorBottom = Number(rect?.bottom || fallbackY);
  let nextX = (anchorLeft - Number(bounds.left || 0)) + 8;
  let nextY = (anchorBottom - Number(bounds.top || 0)) + 8;
  if (nextX + menuRect.width + safe > usableWidth) {
    nextX = (anchorRight - Number(bounds.left || 0)) - menuRect.width;
  }
  if (nextY + menuRect.height + safe > usableHeight) {
    nextY = (anchorTop - Number(bounds.top || 0)) - menuRect.height - 8;
  }
  const clampedX = Math.max(safe, Math.min(nextX, Math.max(safe, usableWidth - menuRect.width - safe)));
  const clampedY = Math.max(safe, Math.min(nextY, Math.max(safe, usableHeight - menuRect.height - safe)));
  menu.style.left = `${Math.round(clampedX)}px`;
  menu.style.top = `${Math.round(clampedY)}px`;
  menu.style.visibility = "visible";
}

socialOpenMessageContext = socialOpenMessageContextSafe;

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
window.socialOpenChatActionsMenu = socialOpenChatActionsMenu;
window.socialDeleteCurrentGroupThread = socialDeleteCurrentGroupThread;
window.socialOpenModulesMenu = socialOpenModulesMenu;
window.socialOpenChatQuickMenu = socialOpenChatQuickMenu;
window.socialToggleChatHeadCollapsed = socialToggleChatHeadCollapsed;
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
window.socialOpenImageViewer = socialOpenImageViewer;
window.socialCloseImageViewer = socialCloseImageViewer;
window.socialOpenImageFromAttachment = socialOpenImageFromAttachment;
window.socialHandleMobileBack = socialHandleMobileBack;
window.socialToggleReaction = socialToggleReaction;
window.socialLoadOlderMessages = socialLoadOlderMessages;
window.socialOpenGroupAvatarModal = socialOpenGroupAvatarModal;
window.socialOpenProjectModal = socialOpenProjectModal;
window.socialCreateProject = socialCreateProject;
window.socialOpenTaskModal = socialOpenTaskModal;
window.socialSaveTask = socialSaveTask;
window.socialAddTaskComment = socialAddTaskComment;
window.socialQuickDone = socialQuickDone;
window.socialToggleTaskDone = socialToggleTaskDone;
window.socialDeleteTask = socialDeleteTask;
window.socialOpenCalendarModal = socialOpenCalendarModal;
window.socialSaveEvent = socialSaveEvent;
window.socialDeleteEvent = socialDeleteEvent;
window.socialShiftCalendar = socialShiftCalendar;
window.socialJumpCalendarToday = socialJumpCalendarToday;
window.socialLoadCalendar = socialLoadCalendar;
window.socialConnectGoogleCalendar = socialConnectGoogleCalendar;
window.socialRenderCalendar = socialRenderCalendar;
window.socialShowDay = socialShowDay;
window.socialHideCalendarDaySheet = socialHideCalendarDaySheet;
window.socialOpenCalendarQuickAddMenu = socialOpenCalendarQuickAddMenu;
window.socialOpenCalendarQuickAddEntry = socialOpenCalendarQuickAddEntry;
window.socialOpenCalendarTaskQuickAdd = socialOpenCalendarTaskQuickAdd;
window.socialOpenCalendarDetail = socialOpenCalendarDetail;
window.socialOpenCalendarDetails = socialOpenCalendarDetails;
window.socialOpenCalendarTaskEdit = socialOpenCalendarTaskEdit;
window.socialCreateTaskFromCalendar = socialCreateTaskFromCalendar;
window.socialCleanCalendarDetails = socialCleanCalendarDetails;
window.socialOpenCalendarTaskCreateModal = socialOpenCalendarTaskCreateModal;
window.socialSetBell = socialSetBell;
window.socialMarkNotificationsReadAll = socialMarkNotificationsReadAll;
window.socialToggleNotificationCenter = socialToggleNotificationCenter;
window.socialCloseNotificationCenter = socialCloseNotificationCenter;
window.socialOpenNotificationFromCenter = socialOpenNotificationFromCenter;
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
window.socialSyncTopMenuButtonMode = socialSyncTopMenuButtonMode;
window.socialOpenThreadMenu = socialOpenThreadMenu;
window.socialIsThreadOpen = socialIsThreadOpen;
window.resetSocialState = resetSocialState;

document.addEventListener("visibilitychange", () => {
  if (document.hidden) return;
  socialApplySharedPollState();
  socialScheduleNotificationsPoll(true);
});

socialMaybeStartHooks();

(function patchSocialTasksAndNotificationsV3() {
  if (typeof window === "undefined") return;
  if (window.__socialTasksAndNotificationsV3) return;
  window.__socialTasksAndNotificationsV3 = true;

  function safeTaskBucket(task) {
    const raw = String(task?.bucket || "").trim().toLowerCase();
    if (["today", "tomorrow", "upcoming", "overdue", "done"].includes(raw)) return raw;
    const status = String(task?.status || "todo").trim().toLowerCase();
    if (status === "done") return "done";
    const due = task?.due_date ? socialParseDateSafe(String(task.due_date || "")) : null;
    if (!(due instanceof Date) || Number.isNaN(due.getTime())) return "upcoming";
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startTomorrow = new Date(startToday.getFullYear(), startToday.getMonth(), startToday.getDate() + 1);
    const startAfterTomorrow = new Date(startToday.getFullYear(), startToday.getMonth(), startToday.getDate() + 2);
    if (due < startToday) return "overdue";
    if (due < startTomorrow) return "today";
    if (due < startAfterTomorrow) return "tomorrow";
    return "upcoming";
  }

  function bucketLabel(bucket) {
    if (bucket === "today") return tr("РЎРµРіРѕРґРЅСЏ", "Today");
    if (bucket === "tomorrow") return tr("Р—Р°РІС‚СЂР°", "Tomorrow");
    if (bucket === "upcoming") return tr("РџСЂРµРґСЃС‚РѕСЏС‰РёРµ", "Upcoming");
    if (bucket === "overdue") return tr("РџСЂРѕСЃСЂРѕС‡РµРЅРЅС‹Рµ", "Overdue");
    if (bucket === "done") return tr("Р’С‹РїРѕР»РЅРµРЅРЅС‹Рµ", "Completed");
    return tr("Р—Р°РґР°С‡Рё", "Tasks");
  }

  const originalLoadTasks = typeof window.socialLoadTasks === "function" ? window.socialLoadTasks : null;
  if (originalLoadTasks) {
    window.socialLoadTasks = async function socialLoadTasksV3(options = {}) {
      const force = Boolean(options && options.force);
      const projectId = document.getElementById("socialTaskProjectFilter")?.value || "";
      const kind = String(document.getElementById("socialTaskKindFilter")?.value || "all").trim().toLowerCase();
      const cacheKey = `${projectId || ""}|${kind || "all"}`;
      const cachedRows = Array.isArray(socialState.tasksAll) ? socialState.tasksAll : [];
      const hasCacheForKey = String(socialState.tasksCacheKey || "") === cacheKey
        && (cachedRows.length > 0 || Number(socialState.tasksCacheLoadedAt || 0) > 0);
      const cacheAgeMs = Date.now() - Number(socialState.tasksCacheLoadedAt || 0);
      const cacheFresh = hasCacheForKey && cacheAgeMs < 60000;

      if (hasCacheForKey) {
        socialApplyTaskRowsFromCache();
        if (typeof window.socialRenderTasks === "function") window.socialRenderTasks();
        if (!force && cacheFresh) return;
      }

      socialState.tasksLastLoadError = false;
      try {
        await originalLoadTasks(options);
      } catch (error) {
        socialState.tasksLastLoadError = true;
        if (typeof socialShowToast === "function") {
          socialShowToast(tr("Р—Р°РґР°С‡Рё", "Tasks"), String(error?.message || tr("РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё Р·Р°РґР°С‡", "Failed to load tasks")));
        }
      }

      const currentRows = Array.isArray(socialState.tasks) ? socialState.tasks : [];
      if (currentRows.length || !socialState.tasksLastLoadError) {
        socialState.tasksLastGood = [...currentRows];
      }
      if (!currentRows.length && !socialTaskIncludeDoneEnabled()) {
        if (typeof window.socialRenderTasks === "function") window.socialRenderTasks();
      }
    };
  }

  window.socialTaskDragStart = function socialTaskDragStart(event, taskId) {
    if (typeof socialIsMobileApkShell === "function" && socialIsMobileApkShell()) return;
    const id = Number(taskId || 0);
    if (!id || !event?.dataTransfer) return;
    try {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", String(id));
    } catch (_) {}
    const node = event.currentTarget;
    if (node?.setAttribute) node.setAttribute("data-dragging", "1");
  };

  window.socialTaskDragEnd = function socialTaskDragEnd(event) {
    const node = event?.currentTarget;
    if (node?.removeAttribute) node.removeAttribute("data-dragging");
  };

  window.socialTaskDragOver = function socialTaskDragOver(event) {
    if (typeof socialIsMobileApkShell === "function" && socialIsMobileApkShell()) return;
    if (event?.preventDefault) event.preventDefault();
  };

  window.socialRenderTasks = function socialRenderTasksV3() {
    const host = document.getElementById("socialTasksBoard");
    if (!host) return;
    const rows = Array.isArray(socialState.tasks) ? socialState.tasks : [];
    const includeDone = socialTaskIncludeDoneEnabled();
    const myActorKey = String(socialState.boot?.actor?.actor_key || "").trim();
    const isOwner = Boolean(socialState.boot?.actor?.is_owner);

    const order = ["today", "tomorrow", "upcoming", "overdue", "done"];
    const bucketMap = new Map(order.map((x) => [x, []]));
    for (const row of rows) {
      const key = safeTaskBucket(row);
      if (!bucketMap.has(key)) bucketMap.set(key, []);
      bucketMap.get(key).push(row);
    }

    const sections = order
      .filter((bucket) => includeDone || bucket !== "done")
      .map((bucket) => {
        const items = bucketMap.get(bucket) || [];
        const listHtml = items.length
          ? items.map((task) => {
            const id = Number(task?.id || 0);
            const status = socialTaskVisualStatus(task);
            const isDone = status === "done";
            const due = socialFormatTaskDateTime(task?.due_date);
            const created = socialFormatTaskDateTime(task?.created_at);
            const project = socialTaskProjectTitle(task);
            const kind = String(task?.task_kind || "company").toLowerCase();
            const kindLabel = kind === "personal" ? tr("Р›РР§РќРђРЇ", "PERSONAL") : project;
            const assigneeNick = String(task?.assignee_nick || "-");
            const avatar = socialAvatarMarkup(String(task?.assignee_avatar_url || ""), assigneeNick, "xs");
            const pendingText = socialTaskPendingHint(id);
            const isMine = myActorKey && String(task?.assignee_key || "") === myActorKey;
            const canToggle = Boolean(task?.can_complete || isMine || isOwner);
            const canDelete = Boolean(task?.can_delete || isOwner);
            const dueDt = task?.due_date ? socialParseDateSafe(String(task.due_date || "")) : null;
            const isOverdue = !isDone && dueDt instanceof Date && !Number.isNaN(dueDt.getTime()) && dueDt.getTime() < Date.now();
            const canDrag = !(typeof socialIsMobileApkShell === "function" && socialIsMobileApkShell());
            return `
              <article class="social-task-item ${isMine ? "is-assignee" : ""} ${isDone ? "is-done" : ""} ${isOverdue ? "is-overdue" : ""}" data-task-id="${id}" draggable="${canDrag ? "true" : "false"}" ondragstart="socialTaskDragStart(event, ${id})" ondragend="socialTaskDragEnd(event)" ondblclick="socialOpenTaskModal(${id})">
                <button class="social-task-check ${isDone ? "is-done" : ""}" type="button" onclick="socialToggleTaskDone(${id}); event.stopPropagation();" title="${tr("РџРµСЂРµРєР»СЋС‡РёС‚СЊ РІС‹РїРѕР»РЅРµРЅРёРµ", "Toggle done")}" ${canToggle ? "" : "disabled"}>вњ“</button>
                <div class="social-task-content" onclick="socialOpenTaskModal(${id})">
                  <div class="social-task-title-row">
                    <div class="social-task-title-text">${escapeHtml(task?.title || "-")}</div>
                    <span class="social-task-kind ${kind === "personal" ? "personal" : "company"}">${escapeHtml(kindLabel || tr("Р‘РµР· РїСЂРѕРµРєС‚Р°", "No project"))}</span>
                  </div>
                  <div class="social-task-subline">
                    <span class="social-task-assignee">${avatar}<span class="social-task-assignee-name">${escapeHtml(assigneeNick)}</span></span>
                    <span>${tr("Р”Р°С‚Р° СЃРѕР·РґР°РЅРёСЏ", "Created")}: ${escapeHtml(created || "-")} вЂў ${tr("Р”РµРґР»Р°Р№РЅ", "Deadline")}: ${escapeHtml(due || tr("Р‘РµР· РґРµРґР»Р°Р№РЅР°", "No deadline"))}</span>
                  </div>
                  ${pendingText ? `<div class="social-task-pending">${escapeHtml(pendingText)}</div>` : ""}
                </div>
                ${canDelete ? `<button class="social-task-delete" type="button" onclick="socialDeleteTask(${id}); event.stopPropagation();" title="${tr("РЈРґР°Р»РёС‚СЊ", "Delete")}">вњ•</button>` : `<span></span>`}
              </article>
            `;
          }).join("")
          : `<div class="hint">${escapeHtml(tr("РќРµС‚ Р·Р°РґР°С‡", "No tasks"))}</div>`;

        return `
          <section class="social-task-bucket" data-bucket="${bucket}" ondragover="socialTaskDragOver(event)" ondrop="socialTaskDrop(event, '${bucket}')">
            <header>
              <h4>${escapeHtml(bucketLabel(bucket))}</h4>
              <span>${Number(items.length || 0)}</span>
            </header>
            <div class="social-task-bucket-list">${listHtml}</div>
          </section>
        `;
      })
      .join("");

    host.innerHTML = `<div class="social-task-board-v2">${sections}</div>`;
  };

  window.socialOpenProjectMembersModal = async function socialOpenProjectMembersModal() {
    const projectId = Number(document.getElementById("socialTaskProjectFilter")?.value || 0);
    if (!projectId) {
      if (typeof socialShowToast === "function") socialShowToast(tr("РџСЂРѕРµРєС‚С‹", "Projects"), tr("РЎРЅР°С‡Р°Р»Р° РІС‹Р±РµСЂРёС‚Рµ РїСЂРѕРµРєС‚ РІ С„РёР»СЊС‚СЂРµ.", "Select a project first."));
      else alert(tr("РЎРЅР°С‡Р°Р»Р° РІС‹Р±РµСЂРёС‚Рµ РїСЂРѕРµРєС‚ РІ С„РёР»СЊС‚СЂРµ.", "Select a project first."));
      return;
    }

    const project = (Array.isArray(socialState.projects) ? socialState.projects : []).find((row) => Number(row?.id || 0) === projectId);
    const title = String(project?.title || "").trim() || tr("РџСЂРѕРµРєС‚", "Project");
    const members = await socialRequest(`/api/social/tasks/projects/${projectId}/members`).catch((error) => {
      const msg = String(error?.message || tr("РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ СѓС‡Р°СЃС‚РЅРёРєРѕРІ", "Failed to load members"));
      if (typeof socialShowToast === "function") socialShowToast(tr("РЈС‡Р°СЃС‚РЅРёРєРё", "Members"), msg);
      else alert(msg);
      return null;
    });
    if (!Array.isArray(members)) return;

    const canEdit = Boolean(socialState.boot?.actor?.is_owner);
    const rowsHtml = members.map((row) => {
      const actorKey = String(row?.actor_key || "");
      const nick = String(row?.nick || actorKey || "-");
      const avatar = socialAvatarMarkup(String(row?.avatar_url || ""), nick, "xs");
      const checked = Boolean(row?.in_project) ? "checked" : "";
      const disabled = canEdit ? "" : "disabled";
      const ownerBadge = Boolean(row?.is_owner) ? `<span class="social-task-tag">${escapeHtml(tr("owner", "owner"))}</span>` : "";
      return `
        <label class="social-member-row">
          <input class="social-project-member-check" type="checkbox" value="${escapeHtml(actorKey)}" ${checked} ${disabled} />
          ${avatar}
          <span class="social-task-assignee-name">${escapeHtml(nick)}</span>
          ${ownerBadge}
        </label>
      `;
    }).join("");

    socialOpenModal(
      `${tr("РЈС‡Р°СЃС‚РЅРёРєРё РїСЂРѕРµРєС‚Р°", "Project members")}: ${escapeHtml(title)}`,
      `
        <div class="social-group-members">
          <div class="social-group-members-list" id="socialProjectMembersList">${rowsHtml || `<div class="hint">${escapeHtml(tr("РЈС‡Р°СЃС‚РЅРёРєРѕРІ РїРѕРєР° РЅРµС‚", "No members yet"))}</div>`}</div>
          <div class="actions">
            <button type="button" class="btn-secondary" onclick="socialCloseModal()">${tr("РћС‚РјРµРЅР°", "Cancel")}</button>
            ${canEdit ? `<button type="button" onclick="socialSaveProjectMembers(${projectId})">${tr("РЎРѕС…СЂР°РЅРёС‚СЊ", "Save")}</button>` : `<span class="hint">${escapeHtml(tr("РўРѕР»СЊРєРѕ РІР»Р°РґРµР»РµС† РјРѕР¶РµС‚ РјРµРЅСЏС‚СЊ СЃРѕСЃС‚Р°РІ", "Only owner can edit members"))}</span>`}
          </div>
        </div>
      `
    );
  };

  window.socialSaveProjectMembers = async function socialSaveProjectMembers(projectId) {
    const safeProjectId = Number(projectId || 0);
    if (!safeProjectId) return;
    const checks = [...document.querySelectorAll("#socialProjectMembersList .social-project-member-check")];
    const actorKeys = checks.filter((node) => node.checked).map((node) => String(node.value || "").trim()).filter(Boolean);
    await socialRequest(`/api/social/tasks/projects/${safeProjectId}/members`, {
      method: "PUT",
      body: JSON.stringify({ actor_keys: actorKeys }),
    }).catch((error) => {
      const msg = String(error?.message || tr("РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕС…СЂР°РЅРёС‚СЊ СѓС‡Р°СЃС‚РЅРёРєРѕРІ", "Failed to save members"));
      if (typeof socialShowToast === "function") socialShowToast(tr("РЈС‡Р°СЃС‚РЅРёРєРё", "Members"), msg);
      else alert(msg);
      throw error;
    });
    socialCloseModal();
    await socialLoadProjects();
    await window.socialLoadTasks({ force: true });
  };
})();


