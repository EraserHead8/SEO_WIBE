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
  calendarEvents: [],
  calendarEventsLastGood: [],
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
  // Google sync flow is intentionally disabled in Samsung-like calendar UX.
  window.__socialDisableGoogleCalendarFlow = true;
  // Keep legacy experimental task/calendar patches disabled to avoid UI regressions.
  if (typeof window.__socialDisableLegacyTaskCalendarPatches === "undefined") {
    window.__socialDisableLegacyTaskCalendarPatches = true;
  }
  // Disable extra heavy hardening wrapper block; we keep fixes in core flow and lightweight overrides.
  if (typeof window.__socialDisableHardeningV20260323 === "undefined") {
    window.__socialDisableHardeningV20260323 = true;
  }
  // Disable legacy heavy monkey-patch layers; canonical behavior is in core + lightweight text_overrides.
  if (typeof window.__socialDisableUiRecoveryV20260323b === "undefined") {
    window.__socialDisableUiRecoveryV20260323b = true;
  }
  if (typeof window.__socialDisableUiFinalV20260323c === "undefined") {
    window.__socialDisableUiFinalV20260323c = true;
  }
  if (typeof window.__socialDisableUiTextFixesV1 === "undefined") {
    window.__socialDisableUiTextFixesV1 = true;
  }
  if (typeof window.__socialDisableCurrencyPatchV2 === "undefined") {
    window.__socialDisableCurrencyPatchV2 = true;
  }
  if (typeof window.__socialDisableTaskGlyphPatchV1 === "undefined") {
    window.__socialDisableTaskGlyphPatchV1 = true;
  }
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

function socialIsAppShellLike() {
  try {
    if (socialIsMobileClientShell() || socialIsMobileApkShell()) return true;
  } catch (_) {}
  try {
    if (document.body?.classList?.contains("mobile-client-mode")) return true;
    if (document.body?.classList?.contains("mobile-apk-mode")) return true;
  } catch (_) {}
  try {
    const href = String(window.location?.href || "");
    const path = String(window.location?.pathname || "");
    if (path === "/mobile") return true;
    if (/([?&])mobile_app=1(?:[&#]|$)/i.test(href)) return true;
  } catch (_) {}
  try {
    const ua = String(navigator?.userAgent || "").toLowerCase();
    if (ua.includes("seowibe") && ua.includes("android")) return true;
    if (ua.includes("wibeapp")) return true;
    if (ua.includes("wv") && ua.includes("android")) return true;
    if (ua.includes("reactnative")) return true;
  } catch (_) {}
  try {
    if (typeof window.ReactNativeWebView !== "undefined") return true;
    if (window.webkit?.messageHandlers?.seoWibeApp) return true;
    if (window.AndroidBridge || window.SeoWibeBridge) return true;
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
      `Изображение слишком большое для отправки (${sizeInfo}). Сожмите его в галерее или выберите файл меньшего размера.`,
      `Image is too large to send (${sizeInfo}). Compress it in your gallery app or choose a smaller size.`
    );
  }
  const suffix = fileName ? ` (${fileName})` : "";
  return tr(
    `Файл${suffix} превышает лимит ${socialFormatFileSize(limitBytes)}.`,
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
      `Файл слишком большой для отправки. Лимит: ${limit}.`,
      `The file is too large to upload. Limit: ${limit}.`
    );
  }
  if (/(<html|<body|gateway time-?out|internal server error|bad gateway|traceback)/i.test(message)) {
    return tr(
      "Сервер временно занят. Повторите отправку файла через несколько секунд.",
      "The server is temporarily busy. Please retry in a few seconds."
    );
  }
  return message || tr("Ошибка загрузки файла", "File upload error");
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
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value < 1e12 ? value * 1000 : value;
    const numericDate = new Date(ms);
    if (!Number.isNaN(numericDate.getTime())) return numericDate;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(value.getTime());
  }
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (/^\d{10,13}$/.test(raw)) {
    const num = Number(raw);
    if (Number.isFinite(num)) {
      const ms = raw.length <= 10 ? num * 1000 : num;
      const numericDate = new Date(ms);
      if (!Number.isNaN(numericDate.getTime())) return numericDate;
    }
  }
  const compact = raw
    .replace(/\u00a0/g, " ")
    .replace(/,\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  const dateOnly = compact.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]), 0, 0, 0, 0);
  }
  const localMatch = compact.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,3}))?$/);
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
  const localTzNoColon = compact.match(/^(\d{4}-\d{2}-\d{2})[T\s](\d{2}:\d{2}(?::\d{2})?)([+\-]\d{4})$/);
  if (localTzNoColon) {
    const nativeTz = new Date(`${localTzNoColon[1]}T${localTzNoColon[2]}${localTzNoColon[3].slice(0, 3)}:${localTzNoColon[3].slice(3)}`);
    if (!Number.isNaN(nativeTz.getTime())) return nativeTz;
  }
  const dmyMatch = compact.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (dmyMatch) {
    return new Date(
      Number(dmyMatch[3]),
      Number(dmyMatch[2]) - 1,
      Number(dmyMatch[1]),
      Number(dmyMatch[4] || 0),
      Number(dmyMatch[5] || 0),
      Number(dmyMatch[6] || 0),
      0
    );
  }
  const ymdSlash = compact.match(/^(\d{4})[./](\d{1,2})[./](\d{1,2})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (ymdSlash) {
    return new Date(
      Number(ymdSlash[1]),
      Number(ymdSlash[2]) - 1,
      Number(ymdSlash[3]),
      Number(ymdSlash[4] || 0),
      Number(ymdSlash[5] || 0),
      Number(ymdSlash[6] || 0),
      0
    );
  }
  const nativeDate = new Date(compact.replace(" ", "T"));
  if (!Number.isNaN(nativeDate.getTime())) return nativeDate;
  return socialParseDateSafe(compact);
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

function socialCalendarFirstNonEmpty(source, keys = []) {
  if (!source || typeof source !== "object") return "";
  for (const key of keys) {
    const value = source?.[key];
    if (value == null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
}

function socialCalendarNestedFirstNonEmpty(source, containerKeys = [], valueKeys = []) {
  if (!source || typeof source !== "object") return "";
  for (const containerKey of containerKeys) {
    const nested = source?.[containerKey];
    if (!nested || typeof nested !== "object") continue;
    const direct = socialCalendarFirstNonEmpty(nested, valueKeys);
    if (direct) return direct;
  }
  return "";
}

function socialCalendarResolveEventStart(eventRow) {
  const direct = socialCalendarFirstNonEmpty(eventRow, [
    "start_at",
    "occurrence_start",
    "start_date",
    "start_datetime",
    "starts_at",
    "startAt",
    "occurrenceStart",
    "date_from",
    "from_at",
    "start",
    "date",
    "event_date",
    "start_day",
    "day_key",
    "date_key",
    "scheduled_for",
    "scheduled_at",
  ]);
  if (direct) return direct;
  return socialCalendarNestedFirstNonEmpty(eventRow, ["payload", "event", "source"], [
    "start_at",
    "occurrence_start",
    "start_date",
    "start_datetime",
    "starts_at",
    "startAt",
    "occurrenceStart",
    "date_from",
    "from_at",
    "start",
    "date",
    "event_date",
    "start_day",
    "day_key",
    "date_key",
    "scheduled_for",
    "scheduled_at",
  ]);
}

function socialCalendarResolveEventEnd(eventRow) {
  const direct = socialCalendarFirstNonEmpty(eventRow, [
    "end_at",
    "occurrence_end",
    "end_date",
    "end_datetime",
    "ends_at",
    "endAt",
    "occurrenceEnd",
    "date_to",
    "to_at",
    "end",
    "finish_at",
  ]);
  if (direct) return direct;
  return socialCalendarNestedFirstNonEmpty(eventRow, ["payload", "event", "source"], [
    "end_at",
    "occurrence_end",
    "end_date",
    "end_datetime",
    "ends_at",
    "endAt",
    "occurrenceEnd",
    "date_to",
    "to_at",
    "end",
    "finish_at",
  ]);
}

function socialCalendarResolveEventTitle(eventRow) {
  const direct = socialCalendarFirstNonEmpty(eventRow, [
    "title",
    "event_title",
    "name",
    "summary",
    "subject",
    "text",
    "label",
  ]);
  if (direct) return direct;
  return socialCalendarNestedFirstNonEmpty(eventRow, ["payload", "event", "source"], [
    "title",
    "event_title",
    "name",
    "summary",
    "subject",
    "text",
    "label",
  ]);
}

function socialCalendarResolveTaskDue(taskRow) {
  const direct = socialCalendarFirstNonEmpty(taskRow, [
    "due_date",
    "due_at",
    "due_datetime",
    "deadline_at",
    "deadline",
    "end_at",
    "due_on",
    "planned_date",
    "day_key",
    "date_key",
    "dueAt",
    "deadlineAt",
    "date",
    "planned_at",
  ]);
  if (direct) return direct;
  return socialCalendarNestedFirstNonEmpty(taskRow, ["payload", "task", "source"], [
    "due_date",
    "due_at",
    "due_datetime",
    "deadline_at",
    "deadline",
    "end_at",
    "due_on",
    "planned_date",
    "day_key",
    "date_key",
    "dueAt",
    "deadlineAt",
    "date",
    "planned_at",
  ]);
}

function socialCalendarResolveTaskTitle(taskRow) {
  return socialCalendarFirstNonEmpty(taskRow, [
    "title",
    "name",
    "summary",
    "subject",
  ]);
}

function socialCalendarExtractRows(raw) {
  if (Array.isArray(raw)) return raw.filter((row) => row && typeof row === "object");
  if (!raw || typeof raw !== "object") return [];
  const queue = [raw];
  const visited = new Set();
  const keysPriority = ["rows", "events", "items", "data", "result", "list", "records"];
  while (queue.length) {
    const node = queue.shift();
    if (!node || typeof node !== "object") continue;
    if (visited.has(node)) continue;
    visited.add(node);
    for (const key of keysPriority) {
      const value = node[key];
      if (Array.isArray(value)) {
        const rows = value.filter((row) => row && typeof row === "object");
        if (rows.length) return rows;
      }
    }
    const nestedArray = Object.values(node).find((value) => Array.isArray(value) && value.some((row) => row && typeof row === "object"));
    if (Array.isArray(nestedArray)) {
      return nestedArray.filter((row) => row && typeof row === "object");
    }
    Object.values(node).forEach((value) => {
      if (value && typeof value === "object" && !Array.isArray(value)) queue.push(value);
    });
  }
  return [];
}

function socialCalendarNormalizeRecurrenceKind(kindRaw) {
  const kind = String(kindRaw || "none").trim().toLowerCase();
  if (!kind || kind === "none" || kind === "never" || kind === "off" || kind === "no") return "none";
  if (["day", "daily", "each_day", "every_day", "days"].includes(kind)) return "day";
  if (["week", "weekly", "each_week", "every_week", "weeks"].includes(kind)) return "week";
  if (["month", "monthly", "each_month", "every_month", "months"].includes(kind)) return "month";
  if (["year", "yearly", "annual", "annually", "each_year", "every_year", "years"].includes(kind)) return "year";
  return ["none", "day", "week", "month", "year"].includes(kind) ? kind : "none";
}

function socialCalendarNormalizeRecurrenceInterval(intervalRaw) {
  const value = Math.round(Number(intervalRaw || 1));
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(365, value));
}

function socialCalendarAdvanceOccurrence(startAt, kindRaw, intervalRaw, indexRaw) {
  const safeStart = socialCalendarParseDate(startAt);
  if (!safeStart) return null;
  const kind = socialCalendarNormalizeRecurrenceKind(kindRaw);
  const interval = socialCalendarNormalizeRecurrenceInterval(intervalRaw);
  const index = Math.max(0, Math.round(Number(indexRaw || 0)));
  if (!index || kind === "none") return safeStart;
  const out = new Date(safeStart.getTime());
  if (kind === "day") out.setDate(out.getDate() + index * interval);
  if (kind === "week") out.setDate(out.getDate() + index * interval * 7);
  if (kind === "month") out.setMonth(out.getMonth() + index * interval);
  if (kind === "year") out.setFullYear(out.getFullYear() + index * interval);
  return out;
}

function socialCalendarDateToLocalIso(value) {
  const dt = socialCalendarParseDate(value);
  if (!dt) return "";
  return `${dt.getFullYear()}-${socialCalendarPad(dt.getMonth() + 1)}-${socialCalendarPad(dt.getDate())}T${socialCalendarPad(dt.getHours())}:${socialCalendarPad(dt.getMinutes())}:${socialCalendarPad(dt.getSeconds())}`;
}

function socialCalendarProjectRowsForMonth(rows, baseDate) {
  const dt = socialCalendarParseDate(baseDate) || new Date();
  const monthStart = new Date(dt.getFullYear(), dt.getMonth(), 1, 0, 0, 0, 0);
  const monthEnd = new Date(dt.getFullYear(), dt.getMonth() + 1, 0, 23, 59, 59, 999);
  const monthPrefix = `${dt.getFullYear()}-${socialCalendarPad(dt.getMonth() + 1)}-`;
  const projected = [];
  const sourceRows = Array.isArray(rows) ? rows : [];
  sourceRows.forEach((row) => {
    if (!row || typeof row !== "object") return;
    const startRaw = socialCalendarResolveEventStart(row);
    const startAt = socialCalendarParseDate(startRaw);
    if (!startAt) return;
    const key = socialCalendarDayKey(startAt);
    if (key.startsWith(monthPrefix)) {
      projected.push(row);
      return;
    }
    const recurrenceKind = socialCalendarNormalizeRecurrenceKind(
      socialCalendarFirstNonEmpty(row, ["recurrence_kind", "repeat_kind", "repeat"])
    );
    if (recurrenceKind === "none") return;
    const recurrenceInterval = socialCalendarNormalizeRecurrenceInterval(
      socialCalendarFirstNonEmpty(row, ["recurrence_interval", "repeat_every", "repeat_interval"]) || 1
    );
    const endAt = socialCalendarParseDate(socialCalendarResolveEventEnd(row));
    const durationMs = endAt ? Math.max(0, endAt.getTime() - startAt.getTime()) : 0;
    for (let index = 1; index <= 480; index += 1) {
      const occurrenceStart = socialCalendarAdvanceOccurrence(startAt, recurrenceKind, recurrenceInterval, index);
      if (!(occurrenceStart instanceof Date) || Number.isNaN(occurrenceStart.getTime())) break;
      if (occurrenceStart > monthEnd) break;
      if (occurrenceStart < monthStart) continue;
      const occurrenceEnd = durationMs > 0 ? new Date(occurrenceStart.getTime() + durationMs) : null;
      projected.push({
        ...row,
        occurrence_index: Number(index || 0),
        occurrence_start: socialCalendarDateToLocalIso(occurrenceStart),
        occurrence_end: occurrenceEnd ? socialCalendarDateToLocalIso(occurrenceEnd) : "",
      });
    }
  });
  return projected;
}

function socialCalendarFilterRowsByMonth(rows, baseDate) {
  const projected = socialCalendarProjectRowsForMonth(rows, baseDate);
  if (projected.length) return projected;
  const dt = socialCalendarParseDate(baseDate) || new Date();
  const monthPrefix = `${dt.getFullYear()}-${socialCalendarPad(dt.getMonth() + 1)}-`;
  return (Array.isArray(rows) ? rows : []).filter((row) => {
    const key = socialCalendarDayKey(socialCalendarResolveEventStart(row));
    return key.startsWith(monthPrefix);
  });
}

function socialCalendarSourceLabel(value) {
  const code = String(value || "").trim().toLowerCase();
  if (code === "ics_url") return "ICS URL";
  if (code === "google_oauth") return "Google OAuth";
  return code || "-";
}

function socialCalendarSyncStateLabel(value) {
  const code = String(value || "idle").trim().toLowerCase();
  if (code === "ok") return tr("Успешно", "Successful");
  if (code === "partial") return tr("Частично", "Partial");
  if (code === "empty") return tr("Без изменений", "No changes");
  if (code === "error") return tr("Ошибка", "Error");
  return tr("Ожидание", "Idle");
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
    node.innerHTML = `<div class="hint">${escapeHtml(tr("Статус синхронизации появится после первого запуска.", "Sync status appears after the first check."))}</div>`;
    return;
  }
  const rows = [];
  const expiresAt = Number(status.expires_at || 0);
  const lastSyncAt = String(status.last_sync_at || "").trim();
  rows.push([tr("Публичный адрес", "Public base"), String(status.public_base_url || "").trim() || "-"]);
  rows.push([tr("Redirect URI", "Redirect URI"), String(status.redirect_uri || "").trim() || "-"]);
  rows.push([tr("Google OAuth", "Google OAuth"), status.oauth_configured ? tr("Настроен", "Configured") : tr("Не настроен", "Not configured")]);
  rows.push([tr("Подключение", "Connection"), status.connected ? tr("Подключено", "Connected") : tr("Не подключено", "Not connected")]);
  rows.push([tr("Последняя синхронизация", "Last sync"), lastSyncAt ? new Date(lastSyncAt).toLocaleString(currentLang === "en" ? "en-GB" : "ru-RU") : tr("Ещё не запускалась", "Not run yet")]);
  rows.push([tr("Источник", "Source"), socialCalendarSourceLabel(status.last_sync_source)]);
  rows.push([tr("Состояние", "State"), socialCalendarSyncStateLabel(status.last_sync_state)]);
  if (expiresAt > 0) {
    rows.push([tr("Токен до", "Token valid until"), new Date(expiresAt * 1000).toLocaleString(currentLang === "en" ? "en-GB" : "ru-RU")]);
  }
  node.innerHTML = rows.map(([label, value]) => `
    <div class="social-calendar-meta-row">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(value || "-").trim() || "-")}</strong>
    </div>
  `).join("");
}
function socialDecodeUiText(value) {
  const raw = String(value == null ? "" : value);
  if (!raw) return "";
  let out = raw;
  for (let i = 0; i < 4; i += 1) {
    try {
      if (typeof window.__repairMojibakeText === "function") {
        out = String(window.__repairMojibakeText(out) || out);
      }
    } catch (_) {}
    try {
      if (typeof window.decodePossiblyMojibake === "function") {
        out = String(window.decodePossiblyMojibake(out) || out);
      }
    } catch (_) {}
    out = out
      .replace(/([\u0420\u0421\u0412\u00d0\u00d1])\u00A0(?=[\u0420\u0421\u0412\u00d0\u00d1\u0400-\u04ffA-Za-z0-9])/g, "$1")
      .replace(/(?:\b[\u0420\u0421\u0412\u00d0\u00d1]\b(?:\s|\u00A0)+){3,}\b[\u0420\u0421\u0412\u00d0\u00d1]\b/g, (seq) => seq.replace(/[\s\u00A0]+/g, ""))
      .replace(/(?:\b[\u0420\u0421\u0412\u00d0\u00d1]\b(?:\s|\u00A0)+){5,}/g, (seq) => seq.replace(/[\s\u00A0]+/g, ""))
      .replace(/([\u0420\u0421\u0412\u00d0\u00d1])(?:\s|\u00A0)+(?=[\u0420\u0421\u0412\u00d0\u00d1])/g, "$1")
      .replace(/([\u0420\u0421][^\s]{0,2})(?:\s|\u00A0)+(?=[\u0420\u0421][^\s]{0,2})/g, "$1")
      .replace(/([\u00d0\u00d1][^\s]{0,2})(?:\s|\u00A0)+(?=[\u00d0\u00d1][^\s]{0,2})/g, "$1")
      .replace(/[\u0000-\u001F\u007F-\u009F]+/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
    const compact = out.replace(/([\u0420\u0421\u0412\u00d0\u00d1])\s+(?=[\u0420\u0421\u0412\u00d0\u00d1\u0400-\u04ffA-Za-z0-9])/g, "$1");
    if (compact && compact !== out) {
      out = compact;
    }
  }
  try {
    if (/[\u0420\u0421\u0412]\s+[\u0420\u0421\u0412]/.test(out) && typeof window.decodePossiblyMojibake === "function") {
      out = String(window.decodePossiblyMojibake(out.replace(/[\u00A0\s]+/g, " ")) || out);
    }
  } catch (_) {}
  try {
    if ((out.match(/[\u0420\u0421\u0412\u00d0\u00d1]/g) || []).length >= 4 && typeof window.decodePossiblyMojibake === "function") {
      const collapsed = out.replace(/([\u0420\u0421\u0412\u00d0\u00d1])\s+(?=[\u0420\u0421\u0412\u00d0\u00d1\u0400-\u04ffA-Za-z0-9])/g, "$1");
      out = String(window.decodePossiblyMojibake(collapsed) || collapsed || out);
    }
  } catch (_) {}
  try {
    const markers = (out.match(/[\u0420\u0421\u0412\u00d0\u00d1]/g) || []).length;
    if (markers >= 6) {
      const squeezed = out
        .replace(/([A-Za-z\u0400-\u04ff\u0420\u0421\u0412\u00d0\u00d1])(?:\s|\u00A0)+(?=[A-Za-z\u0400-\u04ff\u0420\u0421\u0412\u00d0\u00d1])/g, "$1");
      if (squeezed && squeezed !== out) {
        if (typeof window.decodePossiblyMojibake === "function") {
          out = String(window.decodePossiblyMojibake(squeezed) || squeezed);
        } else {
          out = squeezed;
        }
      }
    }
  } catch (_) {}
  try {
    if (/(?:[\u0420\u0421\u0412\u00d0\u00d1]\s+){3,}/.test(out)) {
      const compact = out.replace(
        /([\u0420\u0421\u0412\u00d0\u00d1])(?:\s|\u00A0)+(?=[\u0420\u0421\u0412\u00d0\u00d1\u0400-\u04ffA-Za-z0-9])/g,
        "$1"
      );
      if (compact && compact !== out) {
        if (typeof window.decodePossiblyMojibake === "function") {
          out = String(window.decodePossiblyMojibake(compact) || compact);
        } else {
          out = compact;
        }
      }
    }
  } catch (_) {}
  out = out.replace(/[\u0000-\u001F\u007F-\u009F]+/g, " ").replace(/\s{2,}/g, " ").trim();
  return out;
}

function socialNormalizeDecodedText(value) {
  let out = socialDecodeUiText(value);
  try {
    if (typeof window.__repairMojibakeText === "function") {
      out = String(window.__repairMojibakeText(out) || out);
    }
  } catch (_) {}
  try {
    const markerCount = (String(out || "").match(/[\u0420\u0421\u0412\u00d0\u00d1]/g) || []).length;
    if (markerCount >= 4) {
      let compact = String(out || "")
        .replace(/([\u0420\u0421\u0412\u00d0\u00d1])(?:\s|\u00A0)+(?=[\u0420\u0421\u0412\u00d0\u00d1\u0400-\u04ffA-Za-z0-9])/g, "$1")
        .replace(/(?:\b[\u0420\u0421\u0412\u00d0\u00d1]\b(?:\s|\u00A0)+){3,}\b[\u0420\u0421\u0412\u00d0\u00d1]\b/g, (seq) => seq.replace(/[\s\u00A0]+/g, ""));
      compact = compact.replace(/([\u0420\u0421\u0412\u00d0\u00d1])\s+(?=[\u0420\u0421\u0412\u00d0\u00d1])/g, "$1");
      if (compact && compact !== out) {
        if (typeof window.decodePossiblyMojibake === "function") {
          out = String(window.decodePossiblyMojibake(compact) || compact);
        } else {
          out = compact;
        }
      }
    }
  } catch (_) {}
  return String(out || "")
    .replace(/[\u0000-\u001F\u007F-\u009F]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function socialResolveNotificationText(row) {
  const source = row && typeof row === "object" ? row : {};
  const payload = source.payload && typeof source.payload === "object" ? source.payload : {};
  const rawTitle = source.title || source.subject || source.kind_label || tr("\u0423\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u0435", "Notification");
  const rawBody = source.body || source.text || source.preview || source.message || payload.body || payload.text || payload.message || "";
  return {
    title: socialNormalizeDecodedText(rawTitle),
    body: socialNormalizeDecodedText(rawBody),
  };
}

function socialShowToast(title, body) {
  const suppressToasts = window.__socialDisableNotificationToasts === true
    || socialIsMobileClientShell()
    || socialIsMobileApkShell()
    || socialIsAppShellLike()
    || (window.innerWidth || 0) <= 980;
  if (suppressToasts) return;
  const host = document.getElementById("socialToastHost");
  if (!host) return;
  const item = document.createElement("div");
  const safeTitle = socialDecodeUiText(title);
  const safeBody = socialDecodeUiText(body);
  item.className = "social-toast";
  item.innerHTML = `<strong>${escapeHtml(String(safeTitle || ""))}</strong><div>${escapeHtml(String(safeBody || ""))}</div>`;
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

function socialRenderNotificationCenter(rows = null) {
  let center = document.getElementById("socialNotificationCenter");
  if (!center) {
    center = document.createElement("section");
    center.id = "socialNotificationCenter";
    center.className = "social-notif-center social-notification-center hidden";
    document.body.appendChild(center);
  } else if (center.parentElement !== document.body) {
    document.body.appendChild(center);
  }
  const sourceRows = Array.isArray(rows) ? rows : (Array.isArray(socialState.notificationRows) ? socialState.notificationRows : []);
  const items = sourceRows.map((row) => {
    const safe = socialResolveNotificationText(row);
    const id = Number(row?.id || 0);
    const stamp = String(row?.created_at || "").replace("T", " ").slice(0, 16);
    return `
      <article class="social-notif-item" data-notif-id="${id}">
        <div class="social-notif-item-head">
          <b>${escapeHtml(safe.title || tr("\u0423\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u0435", "Notification"))}</b>
          <small>${escapeHtml(stamp || "-")}</small>
        </div>
        <p>${escapeHtml(safe.body || tr("\u0411\u0435\u0437 \u0442\u0435\u043a\u0441\u0442\u0430", "No text"))}</p>
      </article>
    `;
  }).join("");
  center.innerHTML = `
    <header class="social-notif-head">
      <strong>${escapeHtml(tr("\u0423\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f", "Notifications"))}</strong>
      <div class="social-notif-head-actions">
        <button type="button" class="btn-secondary" onclick="socialMarkNotificationsReadAll(true); socialToggleNotificationCenter(false);">${escapeHtml(tr("\u041f\u0440\u043e\u0447\u0438\u0442\u0430\u0442\u044c \u0432\u0441\u0435", "Mark all read"))}</button>
        <button type="button" class="btn-secondary" onclick="socialToggleNotificationCenter(false)">&times;</button>
      </div>
    </header>
    <div class="social-notif-list">${items || `<div class="hint">${escapeHtml(tr("\u0423\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u0439 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442.", "No notifications yet."))}</div>`}</div>
  `;
  socialEnsureNotificationCenterLayout(center);
  const shouldOpen = Boolean(socialState.notificationCenterOpen);
  center.classList.toggle("hidden", !shouldOpen);
  center.style.display = shouldOpen ? "flex" : "none";
  return center;
}

function socialEnsureNotificationCenterLayout(centerNode = null) {
  const center = centerNode || document.getElementById("socialNotificationCenter");
  if (!center) return null;
  if (center.parentElement !== document.body) {
    document.body.appendChild(center);
  }
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
    center.style.setProperty("right", "12px", "important");
    center.style.setProperty("left", "auto", "important");
    center.style.setProperty("width", "min(420px, calc(100vw - 24px))", "important");
    center.style.setProperty("max-height", "calc(100vh - 84px)", "important");
  }
  return center;
}

async function socialLoadNotificationCenterRows() {
  const data = await socialRequest(`/api/social/notifications?since_id=0&limit=40`).catch(() => null);
  const rows = Array.isArray(data?.rows) ? data.rows : [];
  socialState.notificationRows = rows;
  const unread = Number(data?.unread || socialState.unreadCount || 0);
  socialState.unreadCount = Number.isFinite(unread) ? Math.max(0, unread) : 0;
  socialSetBell(socialState.unreadCount);
  return rows;
}

async function socialToggleNotificationCenter(forceOpen = null) {
  const center = socialRenderNotificationCenter();
  socialEnsureNotificationCenterLayout(center);
  const open = typeof forceOpen === "boolean"
    ? forceOpen
    : !Boolean(socialState.notificationCenterOpen);
  if (open) {
    const rows = await socialLoadNotificationCenterRows();
    const renderedCenter = socialRenderNotificationCenter(rows);
    socialState.notificationCenterOpen = true;
    const activeCenter = renderedCenter || center;
    activeCenter.classList.remove("hidden");
    activeCenter.style.display = "flex";
    socialEnsureNotificationCenterLayout(activeCenter);
    return true;
  }
  socialState.notificationCenterOpen = false;
  center.classList.add("hidden");
  center.style.display = "none";
  return false;
}

function socialCloseNotificationCenter() {
  return socialToggleNotificationCenter(false);
}

function socialOpenAnnouncementModal(row) {
  if (!row || typeof row !== "object") return;
  const annId = Number(row.id || 0);
  if (!annId || socialState.announcementModalId === annId) return;
  socialState.announcementModalId = annId;
  const title = socialDecodeUiText(String(row.title || tr("Объявление", "Announcement")).trim());
  const body = socialDecodeUiText(String(row.body || "").trim());
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
  const title = socialDecodeUiText(String(row.title || tr("Уведомление", "Notification")).trim());
  const body = socialDecodeUiText(String(row.body || "").trim());
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
  if (!buttons.length) return;
  const canUse = !modulesLoaded || (enabledModules instanceof Set && enabledModules.has("social_hub"));
  buttons.forEach((btn) => btn.classList.toggle("hidden", !canUse));
  buttons.forEach((btn) => {
    if (!btn || btn.dataset?.notifBound === "1") return;
    if (btn.dataset) btn.dataset.notifBound = "1";
    btn.addEventListener("click", (event) => {
      if (event?.preventDefault) event.preventDefault();
      if (event?.stopPropagation) event.stopPropagation();
      if (event?.stopImmediatePropagation) event.stopImmediatePropagation();
      socialToggleNotificationCenter().catch(() => null);
      return false;
    }, true);
  });
  if (!canUse) return;
  const value = Math.max(0, Number(unread || 0));
  if (badges.length) {
    badges.forEach((badge) => {
      badge.classList.toggle("hidden", value <= 0);
      badge.textContent = value > 99 ? "99+" : String(value);
    });
  }
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
      const resolvedText = socialResolveNotificationText(row);
      if (id > socialState.lastNotificationId) socialState.lastNotificationId = id;
      if (!id || socialState.toastsSeen.has(id)) continue;
      socialState.toastsSeen.add(id);
      const suppressToasts = window.__socialDisableNotificationToasts === true
        || socialIsMobileClientShell()
        || socialIsMobileApkShell();
      if (!suppressToasts) {
        socialShowToast(resolvedText.title || tr("\u0423\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u0435", "Notification"), resolvedText.body || "");
      }
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
    notificationRows: [],
    notificationCenterOpen: false,
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
  if (typeof socialCloseNotificationCenter === "function") {
    try { socialCloseNotificationCenter(); } catch (_) {}
  }
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
    try {
      if (typeof window.socialEnsureCalendarNavigation === "function") window.socialEnsureCalendarNavigation();
      if (typeof window.socialEnsureCalendarFab === "function") window.socialEnsureCalendarFab();
    } catch (_) {}
    Promise.resolve(socialLoadCalendar()).catch(() => {
      try { socialRenderCalendar(); } catch (_) {}
    }).finally(() => {
      setTimeout(() => {
        try {
          if (typeof window.socialNormalizeCalendarChrome === "function") window.socialNormalizeCalendarChrome();
          if (typeof window.socialEnsureCalendarFab === "function") window.socialEnsureCalendarFab();
          const dayCount = document.querySelectorAll("#socialCalendarGrid .social-day[data-day-key]").length;
          if (!dayCount && typeof window.socialRenderCalendar === "function") {
            window.socialRenderCalendar();
          }
        } catch (_) {}
      }, 60);
    });
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

function socialOpenModal(title, html) {
  const modal = document.getElementById("socialModal");
  const host = document.getElementById("socialModalHost");
  const titleNode = document.getElementById("socialModalTitle");
  if (!modal || !host || !titleNode) return;
    titleNode.textContent = title || tr("\u0421\u043e\u0446\u0438\u0430\u043b\u044c\u043d\u044b\u0439 \u043c\u043e\u0434\u0443\u043b\u044c", "Social module");
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
      { code: "checkers", title: "Шашки" },
      { code: "chess", title: "Шахматы" },
      { code: "battleship", title: "Морской бой" },
    ];
  host.innerHTML = games.map((game) => {
    const icon = game.code === "snake"
      ? "??"
      : (game.code === "tetris"
        ? "??"
        : (game.code === "checkers"
          ? "в™џ"
          : (game.code === "chess"
            ? "в™њ"
            : (game.code === "battleship" ? "?" : "??"))));
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
    ? tr("Змейка", "Snake")
    : (code === "tetris"
      ? tr("Тетрис", "Tetris")
      : (code === "2048"
        ? "2048"
        : (code === "chess"
          ? tr("Шахматы", "Chess")
          : (code === "battleship" ? tr("Морской бой", "Battleship") : code))));
  const myBest = Number(lb?.my_best || 0);
  const myRank = lb?.my_rank ? `#${lb.my_rank}` : "?";
  socialOpenModal(
    `${title}`,
    `
      <div class="social-game-menu">
        <div class="social-game-record">${tr("Ваш рекорд", "Your best")}: <b>${myBest}</b> - ${tr("Место", "Rank")}: <b>${myRank}</b></div>
        <div class="actions">
          <button type="button" onclick="socialStartGame('${escapeHtml(code)}')">${tr("Игра", "Play")}</button>
          <button class="btn-secondary" type="button" onclick="socialShowLeaderboard('${escapeHtml(code)}')">${tr("Таблица лидеров", "Leaderboard")}</button>
          <button class="btn-secondary" type="button" onclick="socialShowGameTips('${escapeHtml(code)}')">${tr("Как играть", "How to play")}</button>
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
    ? tr("Как играть в Змейку", "How to play Snake")
    : (safe === "tetris"
      ? tr("Как играть в Тетрис", "How to play Tetris")
      : (safe === "2048" ? tr("Как играть в 2048", "How to play 2048") : tr("Как играть", "How to play")));
  const body = safe === "snake"
    ? tr("Управление: стрелки. Ешьте еду, не врезайтесь в стену и в себя. Каждые 5 очков скорость растет.", "Controls: arrows. Eat food and avoid walls or your body. Speed increases every 5 points.")
    : (safe === "tetris"
      ? tr("Управление: < >, v, ^ вращение, пробел — быстрый спуск. Собирайте линии и набирайте очки.", "Controls: < >, v, ^ rotate, Space hard drop. Complete lines to gain score.")
      : tr("Управление: стрелки. Объединяйте одинаковые плитки, чтобы получить 2048. Игра заканчивается, когда ходы недоступны.", "Controls: arrows. Merge equal tiles to reach 2048. Game ends when no moves are available."));
  socialOpenModal(title, `<div class="hint">${escapeHtml(body)}</div><div class="actions"><button type="button" onclick="socialOpenGameMenu('${escapeHtml(safe)}')">${tr("Назад", "Back")}</button></div>`);
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
        <thead><tr><th>#</th><th>${tr("Ник", "Nickname")}</th><th>${tr("Очки", "Score")}</th></tr></thead>
        <tbody>
          ${rows.length ? rows.map((row) => `
            <tr class="${row.is_me ? "social-me-row" : ""}"><td>${Number(row.rank || 0)}</td><td>${escapeHtml(row.nick || "-")}</td><td>${Number(row.score || 0)}</td></tr>
          `).join("") : `<tr><td colspan="3">${tr("Пока нет результатов", "No records yet")}</td></tr>`}
        </tbody>
      </table>
    </div>
    <div class="hint">${tr("Ваше место", "Your rank")}: <b>${data.my_rank ? `#${data.my_rank}` : "—"}</b> - ${tr("Ваш рекорд", "Your best")}: <b>${Number(data.my_best || 0)}</b></div>
    <div class="actions"><button type="button" onclick="socialOpenGameMenu('${escapeHtml(safe)}')">${tr("Назад", "Back")}</button></div>
  `;
  socialOpenModal(tr("Таблица лидеров", "Leaderboard"), html);
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
      <div>${tr("Счёт", "Score")}: <b>${Number(score || 0)}</b></div>
      <div class="actions">
        ${retryFn ? `<button type="button" onclick="${retryFn}">${tr("Ещё раз", "Retry")}</button>` : ""}
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
        <button type="button" onclick="socialGameControl('left')"><</button>
        <button type="button" onclick="socialGameControl('down')">v</button>
        <button type="button" onclick="socialGameControl('right')">></button>
      </div>
    `;
  }
  if (safe === "2048") {
    return `
      <div class="social-game-controls">
        <button type="button" onclick="socialGameControl('up')">↑</button>
        <button type="button" onclick="socialGameControl('left')"><</button>
        <button type="button" onclick="socialGameControl('down')">v</button>
        <button type="button" onclick="socialGameControl('right')">></button>
      </div>
    `;
  }
  if (safe === "tetris") {
    return `
      <div class="social-game-controls">
        <button type="button" onclick="socialGameControl('left')"><</button>
        <button type="button" onclick="socialGameControl('right')">></button>
        <button type="button" onclick="socialGameControl('down')">v</button>
        <button type="button" onclick="socialGameControl('rotate')">${tr("Поворот", "Rotate")}</button>
        <button type="button" onclick="socialGameControl('drop')">${tr("Сброс", "Drop")}</button>
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
    ? tr("Змейка", "Snake")
    : (safe === "tetris"
      ? tr("Тетрис", "Tetris")
      : (safe === "2048" ? "2048" : safe));
  const hint = safe === "snake"
    ? tr("Управление: стрелки, свайпы и тап по стороне от змейки. Ешьте еду и не врезайтесь.", "Controls: arrows, swipes, and tap around snake direction. Eat food and avoid collisions.")
    : (safe === "tetris"
      ? tr("Управление: ← →, ↓, ↑ поворот, пробел — быстрый сброс.", "Controls: ← →, ↓, ↑ rotate, Space hard drop.")
      : tr("Управление: стрелки. Объединяйте одинаковые плитки.", "Controls: arrows. Merge equal tiles."));
  const canvasSize = socialGameCanvasSize(safe);
  const controls = socialGameControlsHtml(safe);
  socialOpenModal(
    title,
    `
      <div class="social-game-wrap">
        <div class="hint">${escapeHtml(hint)}</div>
        <canvas id="socialGameCanvas" width="${Number(canvasSize.width || 420)}" height="${Number(canvasSize.height || 620)}"></canvas>
        <div id="socialGameInfo" class="hint">${tr("Счёт", "Score")}: 0</div>
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
    info.textContent = `${tr("Счёт", "Score")}: ${score}`;
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
    info.textContent = `${tr("Счёт", "Score")}: ${score}`;
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
    info.textContent = `${tr("Счёт", "Score")}: ${score}`;
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
      ? tr("Развернуть шапку", "Expand header")
    : tr("\u0421\u0432\u0435\u0440\u043d\u0443\u0442\u044c \u0448\u0430\u043f\u043a\u0443", "Collapse header");
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
      const lastText = socialDecodeUiText(String(thread?.last_message?.text || ""));
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
    const lastText = socialDecodeUiText(String(thread.last_message?.text || ""));
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
          ${escapeHtml(collapsed ? tr("\u0420\u0430\u0437\u0432\u0435\u0440\u043d\u0443\u0442\u044c \u0448\u0430\u043f\u043a\u0443", "Expand header") : tr("\u0421\u0432\u0435\u0440\u043d\u0443\u0442\u044c \u0448\u0430\u043f\u043a\u0443", "Collapse header"))}
    </button>
  `);
  if (isTeamThread) {
    actions.push(`
      <button type="button" data-chat-action="participants">${escapeHtml(tr("Участники", "Participants"))}</button>
      <button type="button" class="btn-secondary" data-chat-action="group_avatar">${escapeHtml(tr("Аватар чата", "Chat avatar"))}</button>
    `);
    if (isGroup) {
      actions.push(`
        <button type="button" data-chat-action="manage_group">${escapeHtml(tr("Изменить состав", "Edit members"))}</button>
        <button type="button" class="btn-danger" data-chat-action="delete_group">${escapeHtml(tr("Удалить группу", "Delete group"))}</button>
      `);
    }
    if (isCompany) {
      actions.push(`
        <button type="button" data-chat-action="manage_company">${escapeHtml(tr("Переименовать чат", "Rename chat"))}</button>
      `);
    }
  } else {
    actions.push(`
      <button type="button" data-chat-action="profile">${escapeHtml(tr("Открыть профиль", "Open profile"))}</button>
    `);
  }
  actions.push(`
    <button type="button" class="btn-secondary" data-chat-action="direct">${escapeHtml(tr("Личный чат", "Direct chat"))}</button>
    <button type="button" class="btn-secondary" data-chat-action="new_group">${escapeHtml(tr("Новая группа", "New group"))}</button>
  `);
  socialOpenModal(
    tr("Действия чата", "Chat actions"),
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
async function socialDeleteCurrentGroupThreadLegacyMojibake() {
  const row = socialGetCurrentThread();
  const threadId = Number(row?.id || 0);
  if (!threadId || String(row?.kind || "") !== "group") return;
  const title = String(row?.title || tr("СЌС‚Сѓ РіСЂСѓРїРїСѓ", "this group")).trim();
  const ok = confirm(tr(`Удалить группу "${title}"? Это действие необратимо.`, `Delete group "${title}"? This action cannot be undone.`));
  if (!ok) return;
  const result = await socialRequest(`/api/social/chat/groups/${threadId}`, {
    method: "DELETE",
    retryOnPost: false,
    maxRetries: 0,
  }).catch((e) => {
    alert(e?.message || tr("Не удалось удалить группу", "Failed to delete group"));
    return null;
  });
  if (!result) return;
  socialCloseThread({ keepAutoSelect: false });
  await socialLoadThreads({ silent: true });
  if (typeof socialShowToast === "function") {
    socialShowToast(tr("Группа удалена", "Group deleted"), tr("Чат удален из списка.", "The chat was removed from the list."));
  }
}

async function socialDeleteCurrentGroupThread() {
  const row = socialGetCurrentThread();
  const threadId = Number(row?.id || 0);
  if (!threadId || String(row?.kind || "") !== "group") return;
  const title = String(row?.title || tr("эту группу", "this group")).trim();
  const ok = confirm(tr(`Удалить группу "${title}"? Это действие необратимо.`, `Delete group "${title}"? This action cannot be undone.`));
  if (!ok) return;
  const result = await socialRequest(`/api/social/chat/groups/${threadId}`, {
    method: "DELETE",
    retryOnPost: false,
    maxRetries: 0,
  }).catch((e) => {
    alert(e?.message || tr("Не удалось удалить группу", "Failed to delete group"));
    return null;
  });
  if (!result) return;
  socialCloseThread({ keepAutoSelect: false });
  await socialLoadThreads({ silent: true });
  if (typeof socialShowToast === "function") {
    socialShowToast(tr("Группа удалена", "Group deleted"), tr("Чат удален из списка.", "The chat was removed from the list."));
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
      <button type="button" data-chat-quick="direct">${escapeHtml(tr("Личный чат", "Direct chat"))}</button>
      <button type="button" data-chat-quick="group">${escapeHtml(tr("Новая группа", "New group"))}</button>
      ${hasThread ? `<button type="button" class="btn-secondary" data-chat-quick="actions">${escapeHtml(tr("Действия текущего чата", "Current chat actions"))}</button>` : ""}
    </div>
  `;
  socialOpenModal(tr("Чаты", "Chats"), html);
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
        label: tr("Управление группой", "Manage group"),
        run: () => socialOpenGroupEditor(true),
      });
    }
    if (isCompany) {
      items.push({
        label: tr("Настройки чата компании", "Company chat settings"),
        run: () => socialOpenCompanyChatEditor(),
      });
    }
    items.push({
      label: tr("Участники", "Participants"),
      run: () => socialOpenGroupParticipants(),
    });
    items.push({
      label: tr("Аватар чата", "Chat avatar"),
      run: () => socialOpenGroupAvatarModal(),
    });
    if (isGroup) {
      items.push({
        label: tr("Удалить группу", "Delete group"),
        run: () => socialDeleteCurrentGroupThread(),
      });
    }
  } else {
    items.push({
      label: tr("Профиль собеседника", "Open profile"),
      run: () => socialOpenCurrentParticipantProfile(),
    });
  }
  items.push({
    label: tr("Закрыть чат", "Close chat"),
    run: () => socialCloseThread({ keepAutoSelect: false }),
  });
  const itemsHtml = items.map((item, index) => `
    <button type="button" class="btn-secondary social-thread-menu-btn" data-social-thread-menu-item="${index}">
      ${escapeHtml(item.label)}
    </button>
  `).join("");
  socialOpenModal(
    tr("Меню чата", "Chat menu"),
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
      ? tr("онлайн", "online now")
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
        <button type="button" onclick="socialOpenGroupEditor(true)">${escapeHtml(tr("Изменить состав", "Edit members"))}</button>
        <button type="button" class="btn-danger" onclick="socialDeleteCurrentGroupThread()">${escapeHtml(tr("Удалить группу", "Delete group"))}</button>
      </div>
    `
    : `
      <div class="actions social-group-participants-actions">
        <button type="button" onclick="socialOpenCompanyChatEditor()">${escapeHtml(tr("Настройки чата", "Chat settings"))}</button>
      </div>
    `;
  socialOpenModal(
    isCompany ? tr("Участники чата компании", "Company chat members") : tr("Участники группы", "Group participants"),
    `
      ${actionsHtml}
      <div class="social-participant-list">
            ${listHtml || `<div class="hint">${escapeHtml(tr("\u0423\u0447\u0430\u0441\u0442\u043d\u0438\u043a\u043e\u0432 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442.", "No participants yet."))}</div>`}
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
  const quick = ["??", "??", "??", "??", "??", "?"];
  menu.innerHTML = `
    <button type="button" class="social-chat-context-btn" onclick="socialContextReply()">${tr("Ответить", "Reply")}</button>
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
    return `<a class="tg-attach tg-attach-file" href="${escapeHtml(url)}" target="_blank" rel="noopener">?? ${escapeHtml(name)}</a>`;
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
            <span>${escapeHtml(tr("\u0421\u0441\u044b\u043b\u043a\u0430 \u043d\u0430 \u0430\u0432\u0430\u0442\u0430\u0440", "Avatar URL"))}</span>
              <input id="socialGroupAvatarUrl" placeholder="https://..." />
            </label>
            <div id="socialGroupAvatarPicker" class="avatar-picker">${pickerHtml}</div>
          </div>
        </div>
        <div class="actions">
          <button id="socialGroupAvatarUploadBtn" class="btn-secondary" type="button">${tr("Загрузить файл", "Upload file")}</button>
          <input id="socialGroupAvatarFileInput" type="file" accept="image/*" class="hidden" />
            <button id="socialGroupAvatarSave" type="button">${tr("\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c", "Save")}</button>
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
      uploadBtn.textContent = tr("Загрузка...", "Uploading...");
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
        uploadBtn.textContent = prevText || tr("Загрузить файл", "Upload file");
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
    alert(tr("Нужно выбрать изображение", "Please choose an image file"));
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
          tr("Фото оптимизировано", "Image optimized"),
          tr(`Размер уменьшен: ${before} -> ${after}.`, `Size reduced: ${before} -> ${after}.`)
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
                tr("Фото дополнительно сжато", "Image compressed more"),
                tr(`Отправили после дополнительного сжатия: ${before} -> ${after}.`, `Sent after additional compression: ${before} -> ${after}.`)
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

function socialCurrentCompanyThread() {
  const thread = socialGetCurrentThread();
  if (!thread || String(thread.kind || "") !== "company") return null;
  return thread;
}

function socialOpenCompanyChatEditor() {
  const thread = socialCurrentCompanyThread();
  if (!thread) {
    alert(tr("\u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u043e\u0442\u043a\u0440\u043e\u0439\u0442\u0435 \u0447\u0430\u0442 \u043a\u043e\u043c\u043f\u0430\u043d\u0438\u0438.", "Open company chat first."));
    return;
  }
  socialOpenModal(
    tr("Настройки чата компании", "Company chat settings"),
    `
      <div class="social-group-editor">
        <label>
          <span>${tr("Название чата", "Chat title")}</span>
          <input id="socialCompanyChatTitleInput" value="${escapeHtml(String(thread.title || "").trim())}" placeholder="${escapeHtml(tr("Введите название", "Enter title"))}" />
        </label>
        <div class="hint">${escapeHtml(tr("Все сотрудники компании добавляются в чат автоматически.", "All company employees are added automatically."))}</div>
        <div class="actions">
        <button type="button" onclick="socialSaveCompanyChatEditor()">${tr("\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c", "Save")}</button>
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
    alert(tr("Введите название чата.", "Enter chat title."));
    return;
  }
  const row = await socialRequest(`/api/social/chat/company/${Number(thread.id || 0)}`, {
    method: "PUT",
    body: JSON.stringify({ title }),
    retryOnPost: true,
    maxRetries: 1,
  }).catch((e) => {
    alert(e?.message || tr("Ошибка сохранения чата", "Failed to save chat"));
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
    alert(tr("\u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u043e\u0442\u043a\u0440\u043e\u0439\u0442\u0435 \u043d\u0443\u0436\u043d\u044b\u0439 \u0447\u0430\u0442.", "Open a group chat first."));
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
        <button type="button" onclick="socialSaveGroupEditor(${editing ? Number(thread.id || 0) : 0})">${editing ? tr("\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c", "Save") : tr("\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u0433\u0440\u0443\u043f\u043f\u0443", "Create group")}</button>
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
    return null;
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

let socialTaskLoadReqSeq = 0;
const socialTaskPendingDone = new Map();
let socialTaskDragTaskId = 0;

async function socialLoadTaskActors() {
  const rows = await socialRequest("/api/social/tasks/actors").catch(() => []);
  socialState.actors = Array.isArray(rows) ? rows : [];
}

async function socialLoadProjects() {
  const rows = await socialRequest("/api/social/tasks/projects").catch((e) => {
    if (typeof socialShowToast === "function") {
      socialShowToast(tr("Ошибка", "Error"), e.message || tr("Не удалось загрузить проекты", "Failed to load projects"));
    }
    return [];
  });
  socialState.projects = Array.isArray(rows) ? rows : [];
  const select = document.getElementById("socialTaskProjectFilter");
  if (!select) return;
  const keep = String(select.value || "");
  select.innerHTML = `<option value="">${tr("Все проекты", "All projects")}</option>${socialState.projects.map((p) => `<option value="${Number(p.id)}">${escapeHtml(p.title || "-")}</option>`).join("")}`;
  if ([...select.options].some((x) => x.value === keep)) select.value = keep;
}

function socialTaskBucketTitle(bucket) {
  const key = String(bucket || "upcoming").toLowerCase();
  if (key === "today") return tr("\u0421\u0435\u0433\u043e\u0434\u043d\u044f", "Today");
  if (key === "tomorrow") return tr("Завтра", "Tomorrow");
  if (key === "overdue") return tr("Просроченные", "Overdue");
  if (key === "done") return tr("Выполненные", "Done");
  return tr("Предстоящие", "Upcoming");
}

function socialTaskBucketSort(bucket) {
  const key = String(bucket || "upcoming").toLowerCase();
  if (key === "overdue") return 0;
  if (key === "today") return 1;
  if (key === "tomorrow") return 2;
  if (key === "upcoming") return 3;
  if (key === "done") return 4;
  return 9;
}

function socialTaskDueLabel(task) {
  const raw = String(socialCalendarResolveTaskDue(task) || "").trim();
  if (!raw) return tr("Без дедлайна", "No deadline");
  const parsed = socialParseDateSafe(raw);
  if (!(parsed instanceof Date) || Number.isNaN(parsed.getTime())) {
    return escapeHtml(raw.replace("T", " ").slice(0, 16));
  }
  return escapeHtml(parsed.toLocaleString(currentLang === "en" ? "en-US" : "ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }));
}

function socialTaskAssigneeMeta(task) {
  const nick = socialDecodeUiText(task?.assignee_nick || "-") || "-";
  const avatar = String(task?.assignee_avatar_url || "").trim();
  return `
    <div class="social-task-assignee">
      <span class="social-task-assignee-avatar">${socialAvatarMarkup(avatar, nick, "xs")}</span>
      <span class="social-task-assignee-name">${escapeHtml(nick)}</span>
    </div>
  `;
}

async function socialLoadTasks(opts = {}) {
  const projectId = document.getElementById("socialTaskProjectFilter")?.value || "";
  const kind = document.getElementById("socialTaskKindFilter")?.value || "all";
  const includeDone = Boolean(document.getElementById("socialTaskIncludeDone")?.checked);
  const qp = new URLSearchParams();
  if (projectId) qp.set("project_id", projectId);
  if (kind && kind !== "all") qp.set("task_kind", kind);
  if (includeDone) qp.set("include_done", "1");

  const reqId = ++socialTaskLoadReqSeq;
  const host = document.getElementById("socialTasksBoard");
  if (host && !opts?.silent) {
    host.innerHTML = `<div class="hint">${tr("Загрузка задач...", "Loading tasks...")}</div>`;
  }

  const rows = await socialRequest(`/api/social/tasks${qp.toString() ? `?${qp.toString()}` : ""}`).catch((e) => {
    if (typeof socialShowToast === "function") {
      socialShowToast(tr("Ошибка загрузки", "Loading error"), e.message || tr("Не удалось загрузить задачи", "Failed to load tasks"));
    }
    return null;
  });

  if (reqId !== socialTaskLoadReqSeq) return;
  if (!Array.isArray(rows)) {
    if (Array.isArray(socialState.tasks) && socialState.tasks.length) {
      socialRenderTasks();
    } else if (host) {
      host.innerHTML = `<div class="hint">${tr("Не удалось загрузить задачи", "Failed to load tasks")}</div>`;
    }
    return;
  }

  socialState.tasks = rows;
  socialState.tasksLastGood = rows;
  socialRenderTasks();
}

function socialRenderTasks() {
  const host = document.getElementById("socialTasksBoard");
  if (!host) return;
  const rows = Array.isArray(socialState.tasks) ? socialState.tasks : [];
  const myActorKey = String(socialState.boot?.actor?.actor_key || "").trim();
  const href = String(window.location?.href || "");
  const path = String(window.location?.pathname || "");
  const hasFinePointer = typeof window.matchMedia === "function"
    ? (window.matchMedia("(pointer:fine)").matches || window.matchMedia("(any-pointer:fine)").matches)
    : true;
  const dragEnabled = hasFinePointer && !(
    socialIsAppShellLike()
    || socialIsMobileClientShell()
    || socialIsMobileApkShell()
    || document.body?.classList?.contains("mobile-client-mode")
    || document.body?.classList?.contains("mobile-apk-mode")
    || path === "/mobile"
    || /([?&])mobile_app=1(?:[&#]|$)/i.test(href)
  );

  if (!rows.length) {
    host.innerHTML = `<div class="hint">${tr("Задач пока нет", "No tasks yet")}</div>`;
    return;
  }

  const grouped = new Map();
  rows.forEach((task) => {
    const bucket = String(task?.bucket || "upcoming").toLowerCase();
    if (!grouped.has(bucket)) grouped.set(bucket, []);
    grouped.get(bucket).push(task);
  });

  const bucketOrder = [...grouped.keys()].sort((a, b) => socialTaskBucketSort(a) - socialTaskBucketSort(b));
  const html = bucketOrder.map((bucket) => {
    const items = grouped.get(bucket) || [];
    const itemsHtml = items.map((task) => {
      const id = Number(task?.id || 0);
      const status = String(task?.status || "todo");
      const pending = socialTaskPendingDone.has(id);
      const isDone = status === "done" || pending;
      const isMine = myActorKey && String(task?.assignee_key || "") === myActorKey;
      const classes = ["social-task-item"];
      if (isMine) classes.push("is-assignee");
      if (isDone) classes.push("is-done");
      if (bucket === "overdue" && !isDone) classes.push("is-overdue");
      const pendingHint = pending ? `<span class="social-task-pending">${tr("5с: повторный клик отменит", "5s: click again to undo")}</span>` : "";
      return `
        <article class="${classes.join(" ")}" data-task-id="${id}" ${dragEnabled ? `draggable="true" ondragstart="socialTaskDragStart(event, ${id})"` : `draggable="false"`}>
          <button class="social-task-check ${isDone ? "is-done" : ""}" type="button" onclick="socialToggleTaskDone(${id}); event.stopPropagation();" title="${tr("Отметить выполненной", "Mark done")}">${isDone ? "✓" : ""}</button>
          <div class="social-task-content" onclick="socialOpenTaskModal(${id})">
            <div class="social-task-title-row">
              <b class="social-task-title-text">${escapeHtml(socialDecodeUiText(task?.title || "-") || "-")}</b>
              <span class="social-task-kind ${escapeHtml(String(task?.task_kind || "company"))}">${escapeHtml(String(task?.task_kind || "company") === "personal" ? tr("\u041c\u041e\u0418", "MINE") : tr("\u041f\u0420\u041e\u0415\u041a\u0422", "PROJECT"))}</span>
            </div>
            <div class="social-task-subline">
              <span>${socialTaskDueLabel(task)}</span>
              ${socialTaskAssigneeMeta(task)}
            </div>
            ${pendingHint}
          </div>
          <button class="social-task-delete" type="button" onclick="socialDeleteTask(${id}); event.stopPropagation();" title="${tr("Удалить", "Delete")}">✕</button>
        </article>
      `;
    }).join("");

    return `
      <section class="social-task-bucket" data-bucket="${escapeHtml(bucket)}">
        <header>
          <h4>${escapeHtml(socialTaskBucketTitle(bucket))}</h4>
          <span>${items.length}</span>
        </header>
        <div class="social-task-bucket-list" ${dragEnabled ? `ondragover="socialTaskAllowDrop(event)" ondrop="socialTaskDrop(event, '${escapeHtml(bucket)}')"` : ""}>${itemsHtml}</div>
      </section>
    `;
  }).join("");

  host.innerHTML = `<div class="social-task-board-v2">${html}</div>`;
  host.querySelectorAll(".social-task-check").forEach((btn) => {
    if (!btn.classList.contains("is-done")) {
      btn.textContent = "";
    } else {
      btn.textContent = "✓";
    }
    const title = String(btn.getAttribute("title") || "");
    if (!title || /[?]{3,}|[\u0420\u0421\u0412\u00d0\u00d1]/.test(title)) {
      btn.setAttribute("title", tr("\u041e\u0442\u043c\u0435\u0442\u0438\u0442\u044c \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043d\u043e\u0439", "Mark done"));
    }
  });
  host.querySelectorAll(".social-task-delete").forEach((btn) => {
    btn.textContent = "✕";
    const title = String(btn.getAttribute("title") || "");
    if (!title || /[?]{3,}|[\u0420\u0421\u0412\u00d0\u00d1]/.test(title)) {
      btn.setAttribute("title", tr("\u0423\u0434\u0430\u043b\u0438\u0442\u044c", "Delete"));
    }
  });
}

function socialTaskDragStart(event, taskId) {
  if (socialIsAppShellLike()) {
    socialTaskDragTaskId = 0;
    return;
  }
  const id = Number(taskId || 0);
  if (!id) return;
  socialTaskDragTaskId = id;
  if (event?.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    try { event.dataTransfer.setData("text/plain", String(id)); } catch (_) {}
  }
}

function socialTaskAllowDrop(event) {
  if (socialIsAppShellLike()) return;
  if (event?.preventDefault) event.preventDefault();
}

async function socialTaskDrop(event, bucket) {
  if (socialIsAppShellLike()) {
    socialTaskDragTaskId = 0;
    return;
  }
  if (event?.preventDefault) event.preventDefault();
  let id = Number(socialTaskDragTaskId || 0);
  if (!id && event?.dataTransfer) {
    try {
      id = Number(event.dataTransfer.getData("text/plain") || 0);
    } catch (_) {
      id = 0;
    }
  }
  socialTaskDragTaskId = 0;
  if (!id) return;
  const safeBucket = String(bucket || "").trim().toLowerCase();
  const ok = await socialRequest("/api/social/tasks/reorder", {
    method: "POST",
    body: JSON.stringify({ items: [{ task_id: id, bucket: safeBucket, to_index: 0 }] }),
  }).then(() => true).catch((e) => {
    if (typeof socialShowToast === "function") {
      socialShowToast(tr("Ошибка", "Error"), e.message || tr("Не удалось перенести задачу", "Failed to move task"));
    }
    return false;
  });
  if (!ok) return;
  await socialLoadTasks({ silent: true });
}

function socialTaskCurrentActorKey() {
  return String(socialState.boot?.actor?.actor_key || "").trim();
}

function socialSyncTaskKindForm() {
  const kind = String(document.getElementById("socialTaskKind")?.value || "company").trim().toLowerCase();
  const personal = kind === "personal";
  const project = document.getElementById("socialTaskProject");
  const assignee = document.getElementById("socialTaskAssignee");
  const hint = document.getElementById("socialTaskKindHint");
  const actorKey = socialTaskCurrentActorKey();

  if (project) {
    project.disabled = personal;
    if (personal) project.value = "";
  }
  if (assignee) {
    if (personal && actorKey) {
      const hasOption = [...assignee.options].some((opt) => String(opt.value || "") === actorKey);
      if (hasOption) assignee.value = actorKey;
      assignee.disabled = true;
    } else {
      assignee.disabled = false;
    }
  }
  if (hint) {
    hint.textContent = personal
      ? tr("Личная задача будет видна только вам и автоматически назначится на вас.", "Personal task is visible only to you and is automatically assigned to you.")
      : tr("Проектная задача доступна участникам проекта и назначенному исполнителю.", "Project task is visible to project members and the assigned teammate.");
  }
}

function socialBuildTaskForm(task = null) {
  const actorsRaw = Array.isArray(socialState.actors) ? socialState.actors : [];
  const projects = Array.isArray(socialState.projects) ? socialState.projects : [];
  const status = task?.status || "todo";
  const due = task?.due_date ? String(task?.due_date).slice(0, 16) : "";
  const kind = String(task?.task_kind || "company");
  const myKey = socialTaskCurrentActorKey();
  const myNick = String(socialState.boot?.actor?.nick || myKey || "Me").trim() || "Me";
  const actorMap = new Map();
  actorsRaw.forEach((row) => {
    const key = String(row?.actor_key || "").trim();
    if (!key || actorMap.has(key)) return;
    actorMap.set(key, row);
  });
  if (myKey && !actorMap.has(myKey)) {
    actorMap.set(myKey, { actor_key: myKey, nick: myNick });
  }
  const actors = [...actorMap.values()];
  const personal = kind === "personal";
  const currentAssignee = personal && myKey
    ? myKey
    : (String(task?.assignee_key || "").trim() || myKey || String(actors[0]?.actor_key || ""));
  const hint = personal
    ? tr("Личная задача будет видна только вам и автоматически назначится на вас.", "Personal task is visible only to you and is automatically assigned to you.")
    : tr("Проектная задача доступна участникам проекта и назначенному исполнителю.", "Project task is visible to project members and the assigned teammate.");
  return `
    <div class="grid-2">
      <label><span>${tr("Название", "Title")}</span><input id="socialTaskTitle" value="${escapeHtml(task?.title || "")}" /></label>
      <label><span>${tr("Тип", "Kind")}</span><select id="socialTaskKind" onchange="socialSyncTaskKindForm()"><option value="company" ${kind === "company" ? "selected" : ""}>${tr("Проектная", "Company")}</option><option value="personal" ${kind === "personal" ? "selected" : ""}>${tr("МОИ ЗАДАЧИ", "Personal")}</option></select></label>
      <label><span>${tr("Проект", "Project")}</span><select id="socialTaskProject" ${personal ? "disabled" : ""}><option value="">${tr("Без проекта", "No project")}</option>${projects.map((p) => `<option value="${Number(p.id)}" ${!personal && Number(task?.project_id || 0) === Number(p.id) ? "selected" : ""}>${escapeHtml(p.title || "-")}</option>`).join("")}</select></label>
      <label><span>${tr("Исполнитель", "Assignee")}</span><select id="socialTaskAssignee" ${personal ? "disabled" : ""}>${actors.map((a) => `<option value="${escapeHtml(String(a.actor_key || ""))}" ${currentAssignee === String(a.actor_key || "") ? "selected" : ""}>${escapeHtml(a.nick || "-")}</option>`).join("")}</select></label>
      <div id="socialTaskKindHint" class="hint full">${escapeHtml(hint)}</div>
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
        <button type="button" onclick="socialCreateProject()">${tr("\u0421\u043e\u0437\u0434\u0430\u0442\u044c", "Create")}</button>
      </div>
    `
  );
}

async function socialCreateProject() {
  const title = String(document.getElementById("socialProjectTitle")?.value || "").trim();
  const description = String(document.getElementById("socialProjectDescription")?.value || "").trim();
  if (!title) {
    alert(tr("Укажите название проекта", "Enter project title"));
    return;
  }
  await socialRequest("/api/social/tasks/projects", {
    method: "POST",
    body: JSON.stringify({ title, description }),
  }).catch((e) => alert(e.message));
  socialCloseModal();
  await socialLoadProjects();
  await socialLoadTasks({ silent: true });
}

async function socialOpenProjectMembersModal() {
  const projectId = Number(document.getElementById("socialTaskProjectFilter")?.value || 0);
  if (!projectId) {
    alert(tr("\u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u0432\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043f\u0440\u043e\u0435\u043a\u0442 \u0432 \u0444\u0438\u043b\u044c\u0442\u0440\u0435", "Select a project in filter first"));
    return;
  }
  const rows = await socialRequest(`/api/social/tasks/projects/${projectId}/members`).catch((e) => {
    alert(e.message || tr("Не удалось загрузить участников", "Failed to load members"));
    return null;
  });
  if (!Array.isArray(rows)) return;
  const list = rows.map((row) => {
    const key = String(row?.actor_key || "");
    const nick = String(row?.nick || key || "-");
    const checked = row?.in_project ? "checked" : "";
    const ownerTag = row?.is_owner ? `<span class="social-task-kind company">${tr("owner", "owner")}</span>` : "";
    return `<label class="check social-member-row"><input type="checkbox" data-member-key="${escapeHtml(key)}" ${checked} /> ${socialAvatarMarkup(String(row?.avatar_url || ""), nick, "xs")} <span>${escapeHtml(nick)}</span> ${ownerTag}</label>`;
  }).join("");
  socialOpenModal(
    tr("Участники проекта", "Project members"),
    `
      <div id="socialProjectMembersList" class="social-group-members-list">${list || `<div class="hint">${tr("\u0421\u043f\u0438\u0441\u043e\u043a \u043f\u0443\u0441\u0442", "List is empty")}</div>`}</div>
      <div class="actions">
        <button type="button" onclick="socialSaveProjectMembers(${projectId})">${tr("\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c", "Save")}</button>
      </div>
    `
  );
}

async function socialSaveProjectMembers(projectId) {
  const id = Number(projectId || 0);
  if (!id) return;
  const host = document.getElementById("socialProjectMembersList");
  if (!host) return;
  const actorKeys = [...host.querySelectorAll("input[data-member-key]")]
    .filter((el) => el.checked)
    .map((el) => String(el.getAttribute("data-member-key") || "").trim())
    .filter(Boolean);
  await socialRequest(`/api/social/tasks/projects/${id}/members`, {
    method: "PUT",
    body: JSON.stringify({ actor_keys: actorKeys }),
  }).catch((e) => {
    alert(e.message || tr("Не удалось сохранить участников", "Failed to save members"));
    return null;
  });
  socialCloseModal();
  await socialLoadTasks({ silent: true });
}

function socialOpenTaskModal(taskId = 0) {
  const task = (socialState.tasks || []).find((x) => Number(x.id) === Number(taskId || 0)) || null;
  const comments = Array.isArray(task?.comments) ? task.comments : [];
  socialOpenModal(
    task ? tr("\u0420\u0435\u0434\u0430\u043a\u0442\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u0437\u0430\u0434\u0430\u0447\u0443", "Edit task") : tr("\u041d\u043e\u0432\u0430\u044f \u0437\u0430\u0434\u0430\u0447\u0430", "New task"),
    `
      ${socialBuildTaskForm(task)}
      ${task ? `<div class="social-task-comments"><h4>${tr("Комментарии", "Comments")}</h4>${comments.map((c) => `<div class="social-task-comment"><b>${escapeHtml(c.author_nick || "-")}</b><small>${escapeHtml((c.created_at || "").slice(0,16).replace("T"," "))}</small><div>${escapeHtml(c.text || "")}</div></div>`).join("") || `<div class="hint">${tr("Комментариев пока нет", "No comments yet")}</div>`}<div class="grid-2"><input id="socialTaskCommentInput" placeholder="${tr("Комментарий", "Comment")}" /><button type="button" onclick="socialAddTaskComment(${Number(task.id)})">${tr("Добавить", "Add")}</button></div></div>` : ""}
      <div class="actions">
          <button type="button" onclick="socialSaveTask(${task ? Number(task.id) : 0})">${task ? tr("\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c", "Save") : tr("\u0421\u043e\u0437\u0434\u0430\u0442\u044c", "Create")}</button>
      </div>
    `
  );
  socialSyncTaskKindForm();
}
async function socialSaveTask(taskId = 0) {
  const payload = {
    project_id: Number(document.getElementById("socialTaskProject")?.value || 0) || null,
    title: String(document.getElementById("socialTaskTitle")?.value || "").trim(),
    description: String(document.getElementById("socialTaskDescription")?.value || "").trim(),
    status: String(document.getElementById("socialTaskStatus")?.value || "todo"),
    priority: String(document.getElementById("socialTaskPriority")?.value || "normal"),
    task_kind: String(document.getElementById("socialTaskKind")?.value || "company"),
    due_date: String(document.getElementById("socialTaskDue")?.value || "").trim() || null,
    assignee_key: String(document.getElementById("socialTaskAssignee")?.value || "").trim(),
  };
  if (payload.task_kind === "personal") {
    payload.project_id = null;
    payload.assignee_key = socialTaskCurrentActorKey() || payload.assignee_key;
  }
  if (!payload.title) {
    alert(tr("Название задачи обязательно", "Task title is required"));
    return;
  }
  const req = taskId > 0
    ? socialRequest(`/api/social/tasks/${Number(taskId)}`, { method: "PUT", body: JSON.stringify(payload) })
    : socialRequest("/api/social/tasks", { method: "POST", body: JSON.stringify(payload) });
  await req.catch((e) => alert(e.message));
  socialCloseModal();
  await socialLoadTasks({ silent: true });
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
  await socialLoadTasks({ silent: true });
  socialOpenTaskModal(id);
}

async function socialDeleteTask(taskId) {
  const id = Number(taskId || 0);
  if (!id) return;
  if (!confirm(tr("Удалить задачу?", "Delete task?"))) return;
  const prev = Array.isArray(socialState.tasks) ? [...socialState.tasks] : [];
  socialState.tasks = prev.filter((x) => Number(x?.id || 0) !== id);
  socialRenderTasks();
  const ok = await socialRequest(`/api/social/tasks/${id}`, { method: "DELETE" }).then(() => true).catch((e) => {
    if (typeof socialShowToast === "function") socialShowToast(tr("Ошибка", "Error"), e.message || tr("Не удалось удалить задачу", "Failed to delete task"));
    return false;
  });
  if (!ok) {
    socialState.tasks = prev;
    socialRenderTasks();
    return;
  }
  await socialLoadTasks({ silent: true });
}

async function socialToggleTaskDone(taskId) {
  const id = Number(taskId || 0);
  if (!id) return;
  const row = (socialState.tasks || []).find((x) => Number(x?.id || 0) === id);
  if (!row) return;

  const pending = socialTaskPendingDone.get(id);
  if (pending) {
    clearTimeout(pending.timerId);
    socialTaskPendingDone.delete(id);
    socialRenderTasks();
    if (typeof socialShowToast === "function") {
      socialShowToast(tr("Отмена", "Cancelled"), tr("Закрытие задачи отменено", "Task completion cancelled"));
    }
    return;
  }

  const timerId = setTimeout(async () => {
    socialTaskPendingDone.delete(id);
    await socialRequest(`/api/social/tasks/${id}`, {
      method: "PUT",
      body: JSON.stringify({ status: "done" }),
    }).catch((e) => {
      if (typeof socialShowToast === "function") {
        socialShowToast(tr("Ошибка", "Error"), e.message || tr("Не удалось закрыть задачу", "Failed to complete task"));
      }
    });
    await socialLoadTasks({ silent: true });
  }, 5000);

  socialTaskPendingDone.set(id, { timerId, at: Date.now() });
  socialRenderTasks();
  if (typeof socialShowToast === "function") {
    socialShowToast(tr("Готово через 5 секунд", "Will complete in 5 seconds"), tr("Нажмите чек ещё раз, чтобы отменить", "Click the check again to undo"));
  }
}

async function socialQuickDone(taskId) {
  await socialToggleTaskDone(taskId);
}
async function socialLoadGoogleCalendarStatus() {
  if (typeof window !== "undefined" && window.__socialDisableGoogleCalendarFlow === true) {
    socialSetCalendarSyncMessage();
    return null;
  }
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
      transientTitle = tr("Google Calendar подключён", "Google Calendar connected");
      transientLines = [tr("Теперь можно запускать прямой импорт календаря без ICS-ссылки.", "Direct calendar import is now available without an ICS URL.")];
    } else if (oauthError) {
      transientKind = "error";
      transientTitle = tr("Ошибка Google OAuth", "Google OAuth error");
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
      statusNode.innerHTML = `<strong>${escapeHtml(tr("Не удалось получить статус Google Calendar.", "Could not load Google Calendar status."))}</strong>`;
    }
    socialRenderCalendarStatusMeta(null);
    socialSetCalendarSyncMessage("error", tr("Проверка статуса не удалась", "Status check failed"), [e?.message || tr("Повторите попытку чуть позже.", "Please retry in a moment.")]);
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
        <strong>${escapeHtml(tr("Ваш Google календарь подключён", "Your Google Calendar is connected"))}</strong>
        <span>${escapeHtml(accountEmail
          ? tr(`Подключён аккаунт ${accountEmail}. Можно запускать прямой импорт событий.`, `Account ${accountEmail} is connected. You can run direct event import now.`)
          : tr("Подключение готово. Можно запускать прямой импорт событий.", "Connection is ready. You can run direct event import now."))}</span>
      `;
    } else if (configured) {
      statusNode.innerHTML = `
        <strong>${escapeHtml(tr("Подключите свой Google аккаунт", "Connect your Google account"))}</strong>
        <span>${escapeHtml(tr("Нажмите одну кнопку ниже. После этого SEO WIBE будет синхронизировать календарь именно этого пользователя.", "Press the button below once. SEO WIBE will then sync this user's calendar only."))}</span>
      `;
    } else {
      statusNode.innerHTML = `
        <strong>${escapeHtml(tr("Прямой импорт ещё не включён", "Direct import is not enabled yet"))}</strong>
        <span>${escapeHtml(tr("Администратору нужно один раз добавить Google OAuth на сервере. После этого каждый пользователь подключает свой Google аккаунт одной кнопкой.", "An administrator needs to add Google OAuth on the server once. After that, each user connects their own Google account with one button."))}</span>
      `;
    }
  }
  socialRenderCalendarStatusMeta(status);
  if (connectBtn) {
    connectBtn.classList.toggle("btn-success", connected);
    connectBtn.disabled = connectBtn.dataset.loading === "1" ? true : !configured;
    if (connectBtn.dataset.loading !== "1") {
      connectBtn.textContent = connected
        ? tr("Переподключить Google", "Reconnect Google")
        : tr("Подключить Google календарь", "Connect Google Calendar");
    }
  }
  if (syncBtn) {
    syncBtn.textContent = connected
      ? tr("Синхронизация из Google / ICS", "Sync from Google / ICS")
      : tr("Импорт по ICS URL", "Import via ICS URL");
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
  if (accountEmail) summaryLines.push(`${tr("Google аккаунт", "Google account")}: ${accountEmail}`);
  if (lastSyncAt) {
    summaryLines.push(`${tr("Время", "Time")}: ${new Date(lastSyncAt).toLocaleString(currentLang === "en" ? "en-GB" : "ru-RU")}`);
  }
  summaryLines.push(`${tr("Импорт", "Imported")}: ${Number(summary.imported || 0)}`);
  summaryLines.push(`${tr("Обновлено", "Updated")}: ${Number(summary.updated || 0)}`);
  summaryLines.push(`${tr("Удалено", "Deleted")}: ${Number(summary.deleted || 0)}`);
  summaryLines.push(`${tr("Пропущено", "Skipped")}: ${Number(summary.skipped || 0)}`);
  if (warnings.length) summaryLines.push(`${tr("Предупреждения", "Warnings")}: ${warnings.join(" | ")}`);
  const lastError = String(status.last_sync_error || "").trim();
  if (lastSyncState === "error") {
    socialSetCalendarSyncMessage("error", tr("Последняя синхронизация завершилась с ошибкой", "Last sync finished with an error"), lastError ? [lastError, ...summaryLines] : summaryLines);
  } else if (lastSyncState === "partial") {
    socialSetCalendarSyncMessage("warn", tr("Синхронизация завершена частично", "Sync completed partially"), summaryLines);
  } else if (lastSyncState === "ok" || lastSyncState === "empty") {
    socialSetCalendarSyncMessage("success", tr("Последняя синхронизация сохранена", "Latest sync recorded"), summaryLines);
  } else if (!configured && !connected) {
    const setupLines = [tr("Для прямого импорта нужен один раз настроенный Google OAuth на сервере.", "Direct import needs a one-time Google OAuth setup on the server.")];
    const redirectUri = String(status.required_redirect_uri || status.redirect_uri || "").trim();
    if (redirectUri) setupLines.push(`${tr("Redirect URI", "Redirect URI")}: ${redirectUri}`);
    const setupHint = String(status.setup_hint || "").trim();
    if (setupHint) setupLines.push(setupHint);
    socialSetCalendarSyncMessage("warn", tr("Google OAuth ещё не настроен", "Google OAuth is not configured yet"), setupLines);
  } else if (configured && !connected) {
    socialSetCalendarSyncMessage("info", tr("Остался один шаг", "One step left"), [tr("Нажмите «Подключить Google календарь», войдите в нужный Google-аккаунт и разрешите доступ только к чтению календаря.", "Press “Connect Google Calendar”, sign in to the required Google account, and grant read-only calendar access.")]);
  } else if (connected && expiresText) {
    socialSetCalendarSyncMessage("success", tr("Прямой импорт готов", "Direct import is ready"), [`${tr("Токен действует до", "Token valid until")}: ${expiresText}`]);
  } else {
    socialSetCalendarSyncMessage();
  }
}
async function socialConnectGoogleCalendar() {
  if (typeof window !== "undefined" && window.__socialDisableGoogleCalendarFlow === true) {
    return false;
  }
  const statusNode = document.getElementById("socialCalendarGoogleStatus");
  const connectBtn = document.getElementById("socialCalendarGoogleConnectBtn");
  const previousStatus = String(statusNode?.textContent || "").trim();
  const previousText = String(connectBtn?.textContent || "").trim();
  const restoreUi = () => {
    if (connectBtn) {
      connectBtn.disabled = false;
      connectBtn.dataset.loading = "0";
      connectBtn.textContent = previousText || tr("Подключить Google календарь", "Connect Google Calendar");
    }
    if (statusNode && previousStatus) {
      statusNode.textContent = previousStatus;
    }
  };
  if (connectBtn) {
    connectBtn.disabled = true;
    connectBtn.dataset.loading = "1";
    connectBtn.textContent = tr("Открываем Google...", "Opening Google...");
  }
  if (statusNode) {
    statusNode.textContent = tr("Готовим безопасное подключение Google OAuth...", "Preparing secure Google OAuth connection...");
  }
  socialSetCalendarSyncMessage("info", tr("Открываем Google OAuth", "Opening Google OAuth"), [tr("Подтвердите вход в нужный Google-аккаунт. После разрешения доступа откроется SEO WIBE с уже подключённым календарём.", "Sign in with the required Google account. After granting access, SEO WIBE will open with the calendar connected.")]);
  const oauthStartUrl = socialIsMobileApkShell() ? "/api/social/calendar/google-oauth/start?return_target=apk" : "/api/social/calendar/google-oauth/start";
  const data = await socialRequest(oauthStartUrl, { timeoutMs: 12000 }).catch((e) => {
    restoreUi();
    socialSetCalendarSyncMessage("error", tr("Не удалось запустить Google OAuth", "Unable to start Google OAuth"), [e?.message || tr("Проверьте настройки OAuth на сервере.", "Check OAuth server settings.")]);
    return null;
  });
  const url = String(data?.url || "").trim();
  if (!url) {
    restoreUi();
    socialSetCalendarSyncMessage("error", tr("Не удалось получить ссылку Google OAuth", "Unable to obtain Google OAuth URL"));
    return false;
  }
  window.location.assign(url);
  return true;
}
async function socialLoadCalendar() {
  const monthInput = document.getElementById("socialCalendarMonth");
  const monthLabel = document.getElementById("socialCalendarMonthLabel");
  if (!Array.isArray(socialState.calendarEventsLastGood)) {
    socialState.calendarEventsLastGood = [];
  }
  const googleFlowEnabled = !(typeof window !== "undefined" && window.__socialDisableGoogleCalendarFlow === true);
  if (googleFlowEnabled) {
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
  }
  if (monthInput && !monthInput.value) {
    monthInput.value = socialCalendarMonthValue(socialState.calendarDate);
  }
  const monthVal = String(monthInput?.value || "").trim();
  if (monthVal) {
    const [y, m] = monthVal.split("-").map((x) => Number(x || 0));
    if (y && m) {
      socialState.calendarDate = new Date(y, m - 1, 1, 0, 0, 0, 0);
    }
  }
  if (monthLabel) {
    monthLabel.textContent = socialCalendarMonthLabel(socialState.calendarDate);
  }
  if (googleFlowEnabled) {
    try {
      await socialLoadGoogleCalendarStatus();
    } catch (_) {
      socialSetCalendarSyncMessage();
    }
  } else {
    socialSetCalendarSyncMessage();
  }
  const previousTasks = Array.isArray(socialState.tasks) ? [...socialState.tasks] : [];
  const taskRowsRaw = await socialRequest("/api/social/tasks?task_kind=all&include_done=0", { timeoutMs: 12000 }).catch(() => null);
  const taskRows = socialCalendarExtractRows(taskRowsRaw);
  const taskLoadFailed = taskRowsRaw == null;
  socialState.tasks = taskRows.length ? taskRows : (taskLoadFailed ? previousTasks : []);
  const start = new Date(socialState.calendarDate.getFullYear(), socialState.calendarDate.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(socialState.calendarDate.getFullYear(), socialState.calendarDate.getMonth() + 1, 0, 23, 59, 59, 0);
  const qp = new URLSearchParams({
    date_from: socialCalendarRangeParam(start, false),
    date_to: socialCalendarRangeParam(end, true),
  });
  const previousEvents = Array.isArray(socialState.calendarEvents) ? [...socialState.calendarEvents] : [];
  const previousLastGood = Array.isArray(socialState.calendarEventsLastGood) ? [...socialState.calendarEventsLastGood] : [];
  let eventsLoadFailed = false;
  let rowsRaw = await socialRequest(`/api/social/calendar/events?${qp.toString()}`, { timeoutMs: 12000 }).catch((e) => {
    eventsLoadFailed = true;
    socialSetCalendarSyncMessage("error", tr("Не удалось загрузить события календаря", "Failed to load calendar events"), [e?.message || tr("Повторите попытку чуть позже.", "Please retry in a moment.")]);
    return null;
  });
  const sourceRows = socialCalendarExtractRows(rowsRaw);
  let rows = socialCalendarFilterRowsByMonth(sourceRows, socialState.calendarDate);
  if (!rows.length && sourceRows.length) {
    rows = sourceRows;
  }
  if (!rows.length) {
    const wideRowsRaw = await socialRequest("/api/social/calendar/events", { timeoutMs: 12000 }).catch(() => null);
    const wideRows = socialCalendarExtractRows(wideRowsRaw);
    if (wideRows.length) {
      rows = socialCalendarFilterRowsByMonth(wideRows, socialState.calendarDate);
      if (!rows.length) {
        rows = wideRows;
      }
      rowsRaw = wideRowsRaw;
    }
  }
  if (rows.length) {
    socialState.calendarEvents = rows;
    const lastGoodSource = socialCalendarExtractRows(rowsRaw);
    socialState.calendarEventsLastGood = lastGoodSource.length ? [...lastGoodSource] : [...rows];
  } else {
    const fallbackMonthRows = socialCalendarFilterRowsByMonth(
      previousLastGood.length ? previousLastGood : previousEvents,
      socialState.calendarDate
    );
    if (eventsLoadFailed && previousEvents.length) {
      socialState.calendarEvents = [...previousEvents];
    } else if (fallbackMonthRows.length) {
      socialState.calendarEvents = fallbackMonthRows;
    } else {
      socialState.calendarEvents = [];
    }
  }
  socialRenderCalendar();
}
function socialShiftCalendar(deltaMonths = 0) {
  const delta = Number(deltaMonths || 0);
  if (!Number.isFinite(delta) || !delta) return;
  const d = socialState.calendarDate;
  socialState.calendarDate = new Date(d.getFullYear(), d.getMonth() + delta, 1, 0, 0, 0, 0);
  const monthInput = document.getElementById("socialCalendarMonth");
  if (monthInput) {
    monthInput.value = socialCalendarMonthValue(socialState.calendarDate);
  }
  socialLoadCalendar();
}

function socialJumpCalendarToday() {
  const now = new Date();
  socialState.calendarDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  socialState.calendarSelectedDay = socialCalendarDayKey(now);
  const monthInput = document.getElementById("socialCalendarMonth");
  if (monthInput) {
    monthInput.value = socialCalendarMonthValue(socialState.calendarDate);
  }
  socialLoadCalendar();
}

function socialCalendarSetMonthYear(year, monthIndex) {
  const y = Math.max(1970, Math.min(2100, Number(year || 0)));
  const m = Math.max(0, Math.min(11, Number(monthIndex || 0)));
  if (!Number.isFinite(y) || !Number.isFinite(m)) return;
  socialState.calendarDate = new Date(y, m, 1, 0, 0, 0, 0);
  const monthInput = document.getElementById("socialCalendarMonth");
  if (monthInput) {
    monthInput.value = socialCalendarMonthValue(socialState.calendarDate);
  }
}

function socialSyncCalendarMonthYearInputs() {
  const monthSelect = document.getElementById("socialCalendarMonthSelect");
  const yearSelect = document.getElementById("socialCalendarYearSelect");
  const base = socialState.calendarDate instanceof Date && !Number.isNaN(socialState.calendarDate.getTime())
    ? socialState.calendarDate
    : new Date();
  const currentYear = base.getFullYear();
  const currentMonth = base.getMonth();

  if (monthSelect && !monthSelect.options.length) {
    for (let month = 0; month < 12; month += 1) {
      const option = document.createElement("option");
      option.value = String(month);
      option.textContent = new Date(2026, month, 1).toLocaleDateString(currentLang === "en" ? "en-US" : "ru-RU", {
        month: "long",
      });
      monthSelect.appendChild(option);
    }
  }
  if (monthSelect) {
    monthSelect.value = String(currentMonth);
  }

  if (yearSelect && !yearSelect.options.length) {
    for (let year = currentYear - 6; year <= currentYear + 6; year += 1) {
      const option = document.createElement("option");
      option.value = String(year);
      option.textContent = String(year);
      yearSelect.appendChild(option);
    }
  }
  if (yearSelect) {
    const hasYear = [...yearSelect.options].some((opt) => Number(opt.value) === currentYear);
    if (!hasYear) {
      const option = document.createElement("option");
      option.value = String(currentYear);
      option.textContent = String(currentYear);
      yearSelect.appendChild(option);
      [...yearSelect.options]
        .sort((a, b) => Number(a.value) - Number(b.value))
        .forEach((opt) => yearSelect.appendChild(opt));
    }
    yearSelect.value = String(currentYear);
  }
}

function socialApplyCalendarMonthYearPicker() {
  const monthNode = document.getElementById("socialCalendarPickerMonth");
  const yearNode = document.getElementById("socialCalendarPickerYear");
  const month = Number(monthNode?.value || 0);
  const year = Number(yearNode?.value || 0);
  if (!Number.isFinite(month) || !Number.isFinite(year)) return;
  socialCalendarSetMonthYear(year, month);
  socialCloseModal?.();
  socialLoadCalendar();
}

function socialOpenCalendarMonthYearPicker() {
  const base = socialState.calendarDate instanceof Date && !Number.isNaN(socialState.calendarDate.getTime())
    ? socialState.calendarDate
    : new Date();
  const currentYear = base.getFullYear();
  const currentMonth = base.getMonth();
  const monthsHtml = Array.from({ length: 12 }, (_, monthIndex) => {
    const label = new Date(2026, monthIndex, 1).toLocaleDateString(currentLang === "en" ? "en-US" : "ru-RU", { month: "long" });
    return `<option value="${monthIndex}" ${monthIndex === currentMonth ? "selected" : ""}>${escapeHtml(label)}</option>`;
  }).join("");
  const yearsHtml = Array.from({ length: 17 }, (_, index) => {
    const year = currentYear - 8 + index;
    return `<option value="${year}" ${year === currentYear ? "selected" : ""}>${year}</option>`;
  }).join("");
  socialOpenModal(
    tr("Выбрать месяц и год", "Select month and year"),
    `
      <div class="social-calendar-month-year-modal">
        <label>
          <span>${escapeHtml(tr("Месяц", "Month"))}</span>
          <select id="socialCalendarPickerMonth">${monthsHtml}</select>
        </label>
        <label>
          <span>${escapeHtml(tr("Год", "Year"))}</span>
          <select id="socialCalendarPickerYear">${yearsHtml}</select>
        </label>
        <div class="actions">
          <button type="button" class="btn-secondary" onclick="socialCloseModal()">${escapeHtml(tr("Отмена", "Cancel"))}</button>
          <button type="button" onclick="socialApplyCalendarMonthYearPicker()">${escapeHtml(tr("Применить", "Apply"))}</button>
        </div>
      </div>
    `
  );
}

function socialBindCalendarSwipe() {
  const grid = document.getElementById("socialCalendarGrid");
  if (!grid || grid.dataset.swipeBound === "1") return;
  grid.dataset.swipeBound = "1";
  let startX = 0;
  let startY = 0;
  let active = false;
  let pointerType = "";
  const threshold = 40;
  let lastSwipeAt = 0;
  const triggerSwipe = (dx, dy) => {
    if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy)) return;
    const now = Date.now();
    if (now - lastSwipeAt < 260) return;
    lastSwipeAt = now;
    socialShiftCalendar(dx > 0 ? -1 : 1);
  };
  grid.addEventListener("touchstart", (event) => {
    const touch = event.changedTouches?.[0];
    if (!touch) return;
    startX = touch.clientX;
    startY = touch.clientY;
    active = true;
  }, { passive: true });
  grid.addEventListener("touchend", (event) => {
    if (!active) return;
    active = false;
    const touch = event.changedTouches?.[0];
    if (!touch) return;
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;
    triggerSwipe(dx, dy);
  }, { passive: true });
  grid.addEventListener("touchcancel", () => {
    active = false;
  }, { passive: true });
  grid.addEventListener("pointerdown", (event) => {
    if (!event || !event.isPrimary) return;
    pointerType = String(event.pointerType || "").toLowerCase();
    if (pointerType === "mouse") return;
    startX = Number(event.clientX || 0);
    startY = Number(event.clientY || 0);
    active = true;
  }, { passive: true });
  grid.addEventListener("pointerup", (event) => {
    if (!active) return;
    if (!event || !event.isPrimary) return;
    const currentType = String(event.pointerType || pointerType || "").toLowerCase();
    active = false;
    if (currentType === "mouse") return;
    const dx = Number(event.clientX || 0) - startX;
    const dy = Number(event.clientY || 0) - startY;
    triggerSwipe(dx, dy);
  }, { passive: true });
  grid.addEventListener("pointercancel", () => {
    active = false;
  }, { passive: true });
}

function socialEnsureCalendarNavigation() {
  const root = document.getElementById("socialSubtabCalendar");
  if (!root) return;
  let hero = root.querySelector(".social-calendar-hero");
  if (!hero) {
    const shell = root.querySelector(".social-calendar-shell") || root;
    hero = document.createElement("div");
    hero.className = "social-calendar-hero";
    shell.prepend(hero);
  }
  let nav = hero.querySelector(".social-calendar-nav-controls");
  if (!nav) {
    nav = document.createElement("div");
    nav.className = "social-calendar-nav-controls";
    nav.innerHTML = `
      <button id="socialCalendarPrevBtn" type="button" class="social-calendar-nav-btn">&#8249;</button>
      <select id="socialCalendarMonthSelect" class="social-calendar-picker"></select>
      <select id="socialCalendarYearSelect" class="social-calendar-picker"></select>
      <button id="socialCalendarNextBtn" type="button" class="social-calendar-nav-btn">&#8250;</button>
    `;
    hero.appendChild(nav);
  }
  const appMode = socialIsAppShellLike();
  nav.classList.toggle("is-app-shell", appMode);
  const prevBtn = nav.querySelector("#socialCalendarPrevBtn");
  const nextBtn = nav.querySelector("#socialCalendarNextBtn");
  const monthSelect = nav.querySelector("#socialCalendarMonthSelect");
  const yearSelect = nav.querySelector("#socialCalendarYearSelect");
  const monthLabel = document.getElementById("socialCalendarMonthLabel");
  if (prevBtn && prevBtn.dataset.bound !== "1") {
    prevBtn.dataset.bound = "1";
    prevBtn.addEventListener("click", () => socialShiftCalendar(-1));
  }
  if (nextBtn && nextBtn.dataset.bound !== "1") {
    nextBtn.dataset.bound = "1";
    nextBtn.addEventListener("click", () => socialShiftCalendar(1));
  }
  if (monthSelect && monthSelect.dataset.bound !== "1") {
    monthSelect.dataset.bound = "1";
    monthSelect.addEventListener("change", () => {
      const selectedMonth = Number(monthSelect.value || 0);
      const selectedYear = Number(yearSelect?.value || socialState.calendarDate?.getFullYear() || new Date().getFullYear());
      socialCalendarSetMonthYear(selectedYear, selectedMonth);
      socialLoadCalendar();
    });
  }
  if (yearSelect && yearSelect.dataset.bound !== "1") {
    yearSelect.dataset.bound = "1";
    yearSelect.addEventListener("change", () => {
      const selectedYear = Number(yearSelect.value || new Date().getFullYear());
      const selectedMonth = Number(monthSelect?.value || socialState.calendarDate?.getMonth() || 0);
      socialCalendarSetMonthYear(selectedYear, selectedMonth);
      socialLoadCalendar();
    });
  }
  if (monthLabel && monthLabel.dataset.boundPicker !== "1") {
    monthLabel.dataset.boundPicker = "1";
    monthLabel.style.cursor = "pointer";
    monthLabel.setAttribute("title", tr("Выбрать месяц и год", "Select month and year"));
    monthLabel.addEventListener("click", () => {
      socialOpenCalendarMonthYearPicker();
    });
  }
  socialSyncCalendarMonthYearInputs();
}

function socialNormalizeCalendarChrome() {
  const root = document.getElementById("socialSubtabCalendar");
  if (!root) return;
  root.classList.add("sw-calendar-samsung");
  const shell = root.querySelector(".social-calendar-shell") || root.querySelector(".panel") || root;
  let hero = shell.querySelector(".social-calendar-hero");
  if (!hero) {
    hero = document.createElement("div");
    hero.className = "social-calendar-hero";
    shell.prepend(hero);
  }
  let heroCopy = hero.querySelector(".social-calendar-hero-copy");
  if (!heroCopy) {
    heroCopy = document.createElement("div");
    heroCopy.className = "social-calendar-hero-copy";
    hero.prepend(heroCopy);
  }
  let monthLabel = document.getElementById("socialCalendarMonthLabel");
  if (!monthLabel) {
    monthLabel = document.createElement("h3");
    monthLabel.id = "socialCalendarMonthLabel";
  }
  monthLabel.textContent = socialCalendarMonthLabel(socialState.calendarDate);
  if (monthLabel.parentElement !== heroCopy) {
    heroCopy.appendChild(monthLabel);
  }
  heroCopy.querySelectorAll("*").forEach((node) => {
    if (node.id === "socialCalendarMonthLabel") return;
    node.style.setProperty("display", "none", "important");
  });
  let monthInput = document.getElementById("socialCalendarMonth");
  if (!monthInput) {
    monthInput = document.createElement("input");
    monthInput.id = "socialCalendarMonth";
    monthInput.type = "month";
    monthInput.onchange = () => socialLoadCalendar();
    hero.appendChild(monthInput);
  } else if (monthInput.parentElement !== hero) {
    hero.appendChild(monthInput);
  }
  monthInput.value = socialCalendarMonthValue(socialState.calendarDate);
  monthInput.classList.add("hidden");
  monthInput.style.setProperty("display", "none", "important");
  socialEnsureCalendarNavigation();
  root.querySelectorAll(
    ".social-calendar-toolbar, .social-calendar-toolbar--modern, .social-calendar-toolbar--clean, " +
    ".social-calendar-filters, .social-calendar-hero-actions, " +
    ".social-calendar-nav, .social-calendar-nav--minimal, .social-calendar-nav--simple, .social-calendar-nav--cluster, " +
    ".social-calendar-sync-card, .social-calendar-sync-panel, .social-calendar-source-panel, .social-calendar-import-panel, " +
    "[id*='GoogleCalendar'], [id*='GoogleOauth'], [id*='GoogleOAuth'], [id*='CalendarOAuth'], [id*='CalendarIcs']"
  ).forEach((node) => {
    node.style.setProperty("display", "none", "important");
  });
  root.querySelectorAll(
    "button[onclick*='socialShiftCalendar'], " +
    "button[onclick*='socialJumpCalendarToday'], " +
    "button[onclick*='socialOpenCalendarModal']:not(#socialCalendarFab), " +
    "button[onclick*='socialOpenCalendarQuickAddMenu']:not(#socialCalendarFab), " +
    "button[onclick*='socialSetCalendarTaskMode'], " +
    "button[onclick*='socialLoadCalendar']"
  ).forEach((node) => {
    node.style.setProperty("display", "none", "important");
  });
  root.querySelectorAll("button").forEach((btn) => {
    if (btn.id === "socialCalendarFab") return;
    if (btn.classList.contains("social-calendar-nav-btn")) return;
    if (btn.classList.contains("social-day")) return;
    if (btn.classList.contains("social-day-item-button")) return;
    btn.style.setProperty("display", "none", "important");
  });
  let grid = document.getElementById("socialCalendarGrid");
  if (!grid) {
    grid = document.createElement("div");
    grid.id = "socialCalendarGrid";
    grid.className = "social-calendar-grid social-calendar-grid--samsung";
    shell.appendChild(grid);
  } else if (grid.parentElement !== shell) {
    shell.appendChild(grid);
  }
  grid.style.setProperty("display", "block", "important");
  let events = document.getElementById("socialCalendarEvents");
  if (!events) {
    events = document.createElement("div");
    events.id = "socialCalendarEvents";
    events.className = "social-calendar-events";
    shell.appendChild(events);
  } else if (events.parentElement !== shell) {
    shell.appendChild(events);
  }
  events.style.setProperty("display", "block", "important");
}

function socialRenderCalendar() {
  socialNormalizeCalendarChrome();
  socialEnsureCalendarNavigation();
  socialSyncCalendarMonthYearInputs();
  socialEnsureCalendarFab();
  const grid = document.getElementById("socialCalendarGrid");
  const list = document.getElementById("socialCalendarEvents");
  const monthLabel = document.getElementById("socialCalendarMonthLabel");
  if (!grid || !list) return;
  const d = socialState.calendarDate;
  const todayKey = socialCalendarDayKey(new Date());
  const year = d.getFullYear();
  const month = d.getMonth();
  const firstDay = new Date(year, month, 1, 0, 0, 0, 0);
  const lastDay = new Date(year, month + 1, 0, 0, 0, 0, 0);
  const shift = (firstDay.getDay() + 6) % 7;
  const days = lastDay.getDate();
  const eventsByDay = new Map();
  const tasksByDay = new Map();
  const myTasksByDay = new Map();
  const myActorKey = String(socialState.boot?.actor?.actor_key || "").trim();
  (socialState.calendarEvents || []).forEach((eventRow) => {
    const key = socialCalendarDayKey(socialCalendarResolveEventStart(eventRow));
    if (!key) return;
    if (!eventsByDay.has(key)) eventsByDay.set(key, []);
    eventsByDay.get(key).push(eventRow);
  });
  (socialState.tasks || []).forEach((task) => {
    const key = socialCalendarDayKey(socialCalendarResolveTaskDue(task));
    if (!key) return;
    if (!tasksByDay.has(key)) tasksByDay.set(key, []);
    tasksByDay.get(key).push(task);
    if (myActorKey && String(task.assignee_key || "") === myActorKey) {
      if (!myTasksByDay.has(key)) myTasksByDay.set(key, []);
      myTasksByDay.get(key).push(task);
    }
  });
  if (monthLabel) {
    monthLabel.textContent = socialCalendarMonthLabel(d);
  }
  let html = `<div class="social-calendar-row head">${[tr("\u041f\u043d", "Mon"), tr("\u0412\u0442", "Tue"), tr("\u0421\u0440", "Wed"), tr("\u0427\u0442", "Thu"), tr("\u041f\u0442", "Fri"), tr("\u0421\u0431", "Sat"), tr("\u0412\u0441", "Sun")].map((x) => `<span>${x}</span>`).join("")}</div><div class="social-calendar-cells">`;
  for (let i = 0; i < shift; i += 1) html += `<button class="social-day muted" disabled></button>`;
  for (let day = 1; day <= days; day += 1) {
    const key = `${year}-${socialCalendarPad(month + 1)}-${socialCalendarPad(day)}`;
    const eventsCount = (eventsByDay.get(key) || []).length;
    const tasksCount = (tasksByDay.get(key) || []).length;
    const myTasksCount = (myTasksByDay.get(key) || []).length;
    const active = socialState.calendarSelectedDay === key ? "active" : "";
    const isToday = todayKey && key === todayKey ? "today" : "";
    const hasEvents = eventsCount > 0 ? "has-event" : "";
    const hasTasks = tasksCount > 0 ? "has-task" : "";
    const hasMyTasks = myTasksCount > 0 ? "has-my-task" : "";
    const manyMyTasks = myTasksCount > 1 ? "my-task-many" : "";
    const previewRows = [];
    (eventsByDay.get(key) || []).forEach((eventRow) => {
      const safeTitle = socialDecodeUiText(socialCalendarResolveEventTitle(eventRow) || "");
      previewRows.push({
        kind: "event",
        title: String(safeTitle || "").trim(),
        color: String(eventRow?.color || "#b8d2ff").trim() || "#b8d2ff",
      });
    });
    (tasksByDay.get(key) || []).forEach((taskRow) => {
      const ownTask = myActorKey && String(taskRow?.assignee_key || "") === myActorKey;
      const safeTitle = socialDecodeUiText(socialCalendarResolveTaskTitle(taskRow) || "");
      previewRows.push({
        kind: "task",
        title: String(safeTitle || "").trim(),
        color: ownTask ? "#a9dfb8" : "#c9dcff",
      });
    });
    const chips = previewRows.slice(0, 3).map((item) => {
      const chipTitle = String(item.title || "").trim() || tr("\u0417\u0430\u043f\u0438\u0441\u044c", "Entry");
      const shortTitle = chipTitle.length > 20 ? `${chipTitle.slice(0, 19)}...` : chipTitle;
      return `<span class="sw-calendar-chip" style="--sw-chip-color:${escapeHtml(item.color)}"><span class="sw-calendar-chip-title">${escapeHtml(shortTitle)}</span></span>`;
    }).join("");
    const hiddenCount = Math.max(0, (eventsCount + tasksCount) - Math.min(3, previewRows.length));
    const more = hiddenCount > 0 ? `<span class="sw-calendar-more">+${hiddenCount}</span>` : "";
    html += `<button class="social-day rich ${active} ${isToday} ${hasEvents} ${hasTasks} ${hasMyTasks} ${manyMyTasks}" data-day-key="${key}" type="button" onclick="socialShowDay('${key}')"><div class="social-day-head"><b>${day}</b></div><div class="social-day-preview-stack">${chips}</div>${more}</button>`;
  }
  html += `</div>`;
  grid.innerHTML = html;
  const todayFallback = todayKey && String(todayKey).startsWith(`${year}-${socialCalendarPad(month + 1)}-`)
    ? todayKey
    : "";
  const fallback = todayFallback || `${year}-${socialCalendarPad(month + 1)}-01`;
  const inMonth = String(socialState.calendarSelectedDay || "").startsWith(`${year}-${socialCalendarPad(month + 1)}-`);
  socialShowDay(inMonth ? socialState.calendarSelectedDay : fallback);
  socialBindCalendarSwipe();
}

function socialEnsureCalendarFab() {
  const root = document.getElementById("socialSubtabCalendar");
  if (!root) return;
  const shell = root.querySelector(".social-calendar-shell") || root;
  let fab = document.getElementById("socialCalendarFab");
  if (!fab) {
    fab = document.createElement("button");
    fab.id = "socialCalendarFab";
    fab.type = "button";
    fab.className = "social-calendar-fab";
    shell.appendChild(fab);
  }
  fab.textContent = "+";
  fab.classList.remove("hidden");
  fab.setAttribute("aria-label", tr("\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c", "Add"));
  fab.setAttribute("title", tr("\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c", "Add"));
  fab.onclick = () => socialOpenCalendarQuickAddMenu();
}

function socialOpenCalendarQuickAddMenu() {
  socialOpenModal(
    tr("\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c", "Add"),
    `
      <div class="sw-calendar-quick-menu">
        <button type="button" onclick="socialCalendarQuickCreate('event')">${escapeHtml(tr("\u0421\u043e\u0431\u044b\u0442\u0438\u0435", "Event"))}</button>
        <button type="button" onclick="socialCalendarQuickCreate('reminder')">${escapeHtml(tr("\u041d\u0430\u043f\u043e\u043c\u0438\u043d\u0430\u043d\u0438\u0435", "Reminder"))}</button>
        <button type="button" onclick="socialCalendarQuickCreate('task')">${escapeHtml(tr("\u0417\u0430\u0434\u0430\u0447\u0430", "Task"))}</button>
      </div>
    `
  );
}

function socialCalendarQuickCreate(kind) {
  const mode = String(kind || "event").trim().toLowerCase();
  const selectedDay = String(socialState.calendarSelectedDay || "").trim();
  socialCloseModal?.();
  if (mode === "task") {
    if (typeof switchSocialSubtab === "function") switchSocialSubtab("tasks", true);
    setTimeout(() => {
      if (typeof socialOpenTaskModal === "function") socialOpenTaskModal(0);
      const dueNode = document.getElementById("socialTaskDue");
      if (dueNode && selectedDay && !String(dueNode.value || "").trim()) {
        dueNode.value = `${selectedDay}T09:00`;
      }
    }, 60);
    return;
  }
  socialOpenCalendarModal(0);
  setTimeout(() => {
    const kindNode = document.getElementById("socialEventEntryKind");
    if (kindNode && (mode === "event" || mode === "reminder")) {
      kindNode.value = mode;
      kindNode.dispatchEvent(new Event("change", { bubbles: true }));
    }
    const startNode = document.getElementById("socialEventStart");
    const endNode = document.getElementById("socialEventEnd");
    if (selectedDay) {
      if (startNode && !String(startNode.value || "").trim()) startNode.value = `${selectedDay}T08:00`;
      if (endNode && !String(endNode.value || "").trim()) endNode.value = `${selectedDay}T09:00`;
    }
  }, 80);
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

function socialOpenCalendarRecordDetail(kind, id) {
  const safeKind = String(kind || "event").trim().toLowerCase() === "task" ? "task" : "event";
  const safeId = Number(id || 0);
  if (!safeId) return;
  if (safeKind === "event") {
    const eventRow = (socialState.calendarEvents || []).find((row) => Number(row?.id || 0) === safeId);
    if (!eventRow) return;
    const editId = socialCalendarEventBaseId(eventRow);
    const startAt = socialCalendarResolveEventStart(eventRow);
    const endAt = socialCalendarResolveEventEnd(eventRow);
    const eventTitle = socialCalendarResolveEventTitle(eventRow);
    const timeLabel = startAt
      ? `${socialCalendarTimeLabel(startAt)}${endAt ? ` - ${socialCalendarTimeLabel(endAt)}` : ""}`
      : tr("\u0412\u0435\u0441\u044c \u0434\u0435\u043d\u044c", "All day");
    const scopeLabel = eventRow?.is_public ? tr("\u041e\u0431\u0449\u0435\u0435", "Shared") : tr("\u041b\u0438\u0447\u043d\u043e\u0435", "Private");
    const repeatLabel = socialCalendarRecurrenceLabel(eventRow?.recurrence_kind, eventRow?.recurrence_interval);
    const reminderLabel = socialCalendarReminderSummary(eventRow?.reminder_offsets_min, eventRow?.reminder_enabled !== false);
    const cleanDetails = socialDecodeUiText(socialCleanCalendarDetails(eventRow?.details || "") || "");
    const metaBits = [scopeLabel];
    if (repeatLabel) metaBits.push(repeatLabel);
    if (reminderLabel) metaBits.push(reminderLabel);
    socialOpenModal(
      socialDecodeUiText(String(eventTitle || tr("\u0421\u043e\u0431\u044b\u0442\u0438\u0435", "Event")).trim()) || tr("\u0421\u043e\u0431\u044b\u0442\u0438\u0435", "Event"),
      `
        <div class="social-calendar-record-detail">
          <div><b>${escapeHtml(timeLabel || "-")}</b></div>
          <div>${escapeHtml(metaBits.join(" / ") || "-")}</div>
          <div>${cleanDetails ? escapeHtml(cleanDetails) : `<span class="hint">${escapeHtml(tr("\u0411\u0435\u0437 \u043e\u043f\u0438\u0441\u0430\u043d\u0438\u044f", "No description"))}</span>`}</div>
          <div class="actions">
            <button type="button" class="btn-secondary" onclick="socialOpenCalendarModal(${Number(editId || 0)}); socialCloseModal();">${escapeHtml(tr("\u0418\u0437\u043c\u0435\u043d\u0438\u0442\u044c", "Edit"))}</button>
            <button type="button" class="btn-danger" onclick="socialDeleteEvent(${Number(editId || 0)}); socialCloseModal();">${escapeHtml(tr("\u0423\u0434\u0430\u043b\u0438\u0442\u044c", "Delete"))}</button>
          </div>
        </div>
      `
    );
    return;
  }
  const task = (socialState.tasks || []).find((row) => Number(row?.id || 0) === safeId);
  if (!task) return;
  const dueRaw = socialCalendarResolveTaskDue(task);
  const dueLabel = dueRaw ? socialCalendarTimeLabel(dueRaw) : tr("\u0411\u0435\u0437 \u0441\u0440\u043e\u043a\u0430", "No due date");
  const meta = [];
  if (String(task?.project_title || "").trim()) meta.push(socialDecodeUiText(task.project_title || ""));
  if (String(task?.assignee_nick || "").trim()) meta.push(socialDecodeUiText(task.assignee_nick || ""));
  const status = socialDecodeUiText(task?.status || "") || tr("\u0411\u0435\u0437 \u0441\u0442\u0430\u0442\u0443\u0441\u0430", "No status");
  const description = socialDecodeUiText(task?.description || "");
  socialOpenModal(
    socialDecodeUiText(String(task?.title || tr("\u0417\u0430\u0434\u0430\u0447\u0430", "Task")).trim()) || tr("\u0417\u0430\u0434\u0430\u0447\u0430", "Task"),
    `
      <div class="social-calendar-record-detail">
        <div><b>${escapeHtml(dueLabel)}</b></div>
        <div>${escapeHtml(meta.join(" / ") || status)}</div>
        <div>${escapeHtml(description || tr("\u0411\u0435\u0437 \u043e\u043f\u0438\u0441\u0430\u043d\u0438\u044f", "No description"))}</div>
        <div class="actions">
          <button type="button" class="btn-secondary" onclick="switchSocialSubtab('tasks'); socialOpenTaskModal(${safeId}); socialCloseModal();">${escapeHtml(tr("\u0418\u0437\u043c\u0435\u043d\u0438\u0442\u044c", "Edit"))}</button>
          <button type="button" class="btn-danger" onclick="socialDeleteTask(${safeId}); socialCloseModal();">${escapeHtml(tr("\u0423\u0434\u0430\u043b\u0438\u0442\u044c", "Delete"))}</button>
        </div>
      </div>
    `
  );
}

function socialShowDay(dayKey) {
  const list = document.getElementById("socialCalendarEvents");
  if (!list) return;
  socialNormalizeCalendarChrome();
  socialState.calendarSelectedDay = dayKey;
  const events = (socialState.calendarEvents || [])
    .filter((eventRow) => socialCalendarDayKey(socialCalendarResolveEventStart(eventRow)) === dayKey)
    .sort((a, b) => {
      const left = socialCalendarParseDate(socialCalendarResolveEventStart(a))?.getTime() || 0;
      const right = socialCalendarParseDate(socialCalendarResolveEventStart(b))?.getTime() || 0;
      return left - right;
    });
  const tasks = (socialState.tasks || [])
    .filter((task) => socialCalendarDayKey(socialCalendarResolveTaskDue(task)) === dayKey)
    .sort((a, b) => {
      const left = socialDecodeUiText(socialCalendarResolveTaskTitle(a) || "");
      const right = socialDecodeUiText(socialCalendarResolveTaskTitle(b) || "");
      return String(left || "").localeCompare(String(right || ""), currentLang === "en" ? "en" : "ru");
    });

  const eventCards = events.length
    ? events.map((eventRow) => {
        const startAt = socialCalendarResolveEventStart(eventRow);
        const endAt = socialCalendarResolveEventEnd(eventRow);
        const eventTitle = socialCalendarResolveEventTitle(eventRow);
        const timeLabel = startAt
          ? `${socialCalendarTimeLabel(startAt)}${endAt ? ` - ${socialCalendarTimeLabel(endAt)}` : ""}`
          : "-";
        const scopeLabel = eventRow?.is_public ? tr("\u041e\u0431\u0449\u0435\u0435", "Shared") : tr("\u041b\u0438\u0447\u043d\u043e\u0435", "Private");
        const repeatLabel = socialCalendarRecurrenceLabel(eventRow?.recurrence_kind, eventRow?.recurrence_interval);
        const reminderLabel = socialCalendarReminderSummary(eventRow?.reminder_offsets_min, eventRow?.reminder_enabled !== false);
        const editId = socialCalendarEventBaseId(eventRow);
        const cleanDetails = socialCleanCalendarDetails(eventRow?.details || "");
        const metaBits = [scopeLabel];
        if (repeatLabel) metaBits.push(repeatLabel);
        if (reminderLabel) metaBits.push(reminderLabel);
        return `
          <button type="button" class="social-day-item social-day-item-button" onclick="socialOpenCalendarRecordDetail('event', ${Number(eventRow?.id || 0)})">
            <b>${escapeHtml(socialDecodeUiText(eventTitle || "-") || "-")}</b>
            <small>${escapeHtml(timeLabel)}${metaBits.length ? ` - ${escapeHtml(metaBits.join(" / "))}` : ""}</small>
            <div>${cleanDetails ? escapeHtml(socialDecodeUiText(cleanDetails) || cleanDetails) : `<span class="hint">${escapeHtml(tr("\u0411\u0435\u0437 \u043e\u043f\u0438\u0441\u0430\u043d\u0438\u044f", "No description"))}</span>`}</div>
          </button>
        `;
      }).join("")
    : `<div class="hint">${tr("\u041d\u0430 \u044d\u0442\u043e\u0442 \u0434\u0435\u043d\u044c \u0441\u043e\u0431\u044b\u0442\u0438\u0439 \u043d\u0435\u0442.", "No events for this day.")}</div>`;

  const taskCards = tasks.length
    ? tasks.map((task) => {
        const metaBits = [];
        if (String(task?.task_kind || "company") === "personal") {
          metaBits.push(tr("\u041c\u043e\u0438 \u0437\u0430\u0434\u0430\u0447\u0438", "Personal"));
        } else if (String(task?.project_title || "").trim()) {
          metaBits.push(socialDecodeUiText(task.project_title || ""));
        }
        if (String(task?.assignee_nick || "").trim()) {
          metaBits.push(socialDecodeUiText(task.assignee_nick || ""));
        }
        const statusLabel = socialDecodeUiText(task?.status || "");
        return `
          <button type="button" class="social-day-item social-day-item-button" onclick="socialOpenCalendarRecordDetail('task', ${Number(task?.id || 0)})">
            <b>${escapeHtml(socialDecodeUiText(socialCalendarResolveTaskTitle(task) || "-") || "-")}</b>
            <small>${escapeHtml(metaBits.join(" / ") || tr("\u0411\u0435\u0437 \u043c\u0435\u0442\u043e\u043a", "No labels"))}</small>
            <div>${escapeHtml(statusLabel || tr("\u0411\u0435\u0437 \u0441\u0442\u0430\u0442\u0443\u0441\u0430", "No status"))}</div>
          </button>
        `;
      }).join("")
    : `<div class="hint">${tr("\u041d\u0430 \u044d\u0442\u043e\u0442 \u0434\u0435\u043d\u044c \u0434\u0435\u0434\u043b\u0430\u0439\u043d\u043e\u0432 \u043d\u0435\u0442.", "No task deadlines for this day.")}</div>`;

  list.innerHTML = `
    <div class="social-calendar-day-header">
      <div>
        <span>${escapeHtml(tr("\u0412\u044b\u0431\u0440\u0430\u043d\u043d\u044b\u0439 \u0434\u0435\u043d\u044c", "Selected day"))}</span>
        <h4>${escapeHtml(socialCalendarDayLabel(dayKey))}</h4>
      </div>
      <div class="social-calendar-day-stats">
        <span>${escapeHtml(`${tr("\u0421\u043e\u0431\u044b\u0442\u0438\u044f", "Events")}: ${events.length}`)}</span>
        <span>${escapeHtml(`${tr("\u0417\u0430\u0434\u0430\u0447\u0438", "Tasks")}: ${tasks.length}`)}</span>
      </div>
    </div>
    <div class="social-day-events">
      <h5>${tr("\u0421\u043e\u0431\u044b\u0442\u0438\u044f", "Events")}</h5>
      ${eventCards}
    </div>
    <div class="social-day-events">
      <h5>${tr("\u0414\u0435\u0434\u043b\u0430\u0439\u043d\u044b \u0437\u0430\u0434\u0430\u0447", "Task deadlines")}</h5>
      ${taskCards}
    </div>
  `;

  const grid = document.getElementById("socialCalendarGrid");
  if (grid) {
    grid.querySelectorAll(".social-day[data-day-key]").forEach((btn) => {
      btn.classList.toggle("active", String(btn.getAttribute("data-day-key") || "") === dayKey);
    });
  }
}
const SOCIAL_EMOJI_STORAGE_KEY = "seo_wibe_social_emoji_recent_v2";
const SOCIAL_EMOJI_RECENT_LIMIT = 30;
const SOCIAL_EMOJI_TAB_ORDER = ["recent", "all"];
const SOCIAL_EMOJI_GROUPS = [
  {
    id: "faces",
    label: tr("\u041b\u0438\u0446\u0430", "Faces"),
    items: ["🙂", "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚", "🤗", "🤩", "🥳", "😎", "🤓", "🧐", "🥺", "😏", "😒", "🙄", "😬", "🤨", "😶", "🫠", "🤔", "🫡", "😴", "🤤", "🤯", "😮", "😲", "😳", "🥵", "🥶", "😱", "😨", "😰", "😥", "😢", "😭", "😤", "😠", "😡", "🤬", "🤢", "🤮", "🤧", "😷", "🤒", "🤕", "🤑", "🤠", "🥴", "😵", "🫨", "🤥"],
  },
  {
    id: "gestures",
    label: tr("\u0416\u0435\u0441\u0442\u044b", "Gestures"),
    items: ["👍", "👎", "👌", "✌️", "🤞", "🫶", "🤟", "🤘", "🤙", "👈", "👉", "👆", "👇", "☝️", "✋", "🤚", "🖐️", "🖖", "👋", "🤝", "👏", "🙌", "🫡", "🙏", "💪", "🦾", "🫂", "👐", "🤲", "🫴", "🫷", "🫸"],
  },
  {
    id: "symbols",
    label: tr("\u0421\u0438\u043c\u0432\u043e\u043b\u044b", "Symbols"),
    items: ["❤️", "🩷", "🩵", "💙", "💚", "💛", "🧡", "💜", "🖤", "🤍", "🤎", "💔", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💯", "✅", "☑️", "✔️", "❌", "⛔", "⚠️", "🚫", "‼️", "❓", "❗", "🔔", "🔕", "⭐", "🌟", "✨", "🔥", "⚡", "🎯", "📌"],
  },
  {
    id: "work",
    label: tr("\u0414\u0435\u043b\u043e", "Work"),
    items: ["💼", "📁", "📂", "🗂️", "📊", "📈", "📉", "🧾", "🧮", "📎", "📌", "🗓️", "📅", "⏰", "⌛", "🕒", "📝", "✏️", "🖊️", "🖋️", "📚", "📖", "💡", "🛠️", "🧰", "⚙️", "🖥️", "💻", "⌨️", "📱", "🔋", "🔌", "📡", "🧠", "🧑‍💻", "📦", "📬", "📢", "📣", "📨"],
  },
  {
    id: "objects",
    label: tr("\u041f\u0440\u0435\u0434\u043c\u0435\u0442\u044b", "Objects"),
    items: ["🛍️", "🛒", "🎁", "🔑", "🔒", "🔓", "💳", "💵", "💶", "💷", "💴", "🪙", "🏷️", "🧴", "🧼", "🧻", "🧹", "🧽", "🪥", "🪮", "🪞", "🧸", "🎮", "📷", "📸", "🎥", "🎧", "🎤", "🔍", "🔎", "🔬", "🧪", "🧫", "🧯", "🕯️", "🪫", "💿", "📀", "🧲", "📼"],
  },
  {
    id: "food",
    label: tr("\u0415\u0434\u0430", "Food"),
    items: ["☕", "🍵", "🧋", "🥤", "🍶", "🍺", "🍷", "🍸", "🍹", "🍾", "🍎", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🫐", "🍍", "🥭", "🍒", "🍑", "🥝", "🍅", "🥑", "🥦", "🥒", "🌶️", "🌽", "🥕", "🍞", "🥐", "🥖", "🧀", "🍔", "🍟", "🍕", "🌭", "🍜", "🍣"],
  },
  {
    id: "travel",
    label: tr("\u041f\u043e\u0435\u0437\u0434\u043a\u0438", "Travel"),
    items: ["🚗", "🚕", "🚙", "🚌", "🚎", "🏎️", "🚓", "🚑", "🚒", "🚚", "🚛", "🚜", "🛵", "🏍️", "🚲", "✈️", "🛫", "🛬", "🚁", "🚀", "🛸", "🚢", "⛴️", "🚆", "🚇", "🚝", "🚞", "🚊", "🚉", "⛽", "🗺️", "🧭", "🏖️", "🏝️", "🏔️", "🏕️", "🏙️", "🌆", "🌉", "🗽"],
  },
  {
    id: "nature",
    label: tr("\u041f\u0440\u0438\u0440\u043e\u0434\u0430", "Nature"),
    items: ["🌤️", "⛅", "🌥️", "☁️", "🌦️", "🌧️", "⛈️", "🌩️", "🌨️", "❄️", "☀️", "🌙", "⭐", "🌟", "✨", "🌈", "🌪️", "🌊", "💧", "🌿", "🍀", "🌱", "🌳", "🌲", "🌴", "🌵", "🌸", "🌼", "🌻", "🌺", "🌹", "🌷", "🪻", "🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻"],
  },
];
let socialEmojiSetKey = "recent";

function socialLoadEmojiRecents() {
  try {
    const raw = localStorage.getItem(SOCIAL_EMOJI_STORAGE_KEY);
    const list = JSON.parse(String(raw || "[]"));
    if (!Array.isArray(list)) return [];
    return list
      .map((x) => String(x || "").trim())
      .filter(Boolean)
      .slice(0, SOCIAL_EMOJI_RECENT_LIMIT);
  } catch (_) {
    return [];
  }
}

function socialSaveEmojiRecents(list) {
  try {
    localStorage.setItem(SOCIAL_EMOJI_STORAGE_KEY, JSON.stringify(Array.isArray(list) ? list.slice(0, SOCIAL_EMOJI_RECENT_LIMIT) : []));
  } catch (_) {}
}

function socialGetEmojiRecents() {
  if (!Array.isArray(socialState.emojiRecents)) {
    socialState.emojiRecents = socialLoadEmojiRecents();
  }
  return socialState.emojiRecents;
}

function socialRememberRecentEmoji(emoji) {
  const code = String(emoji || "").trim();
  if (!code) return;
  const current = socialGetEmojiRecents().filter((x) => x !== code);
  current.unshift(code);
  socialState.emojiRecents = current.slice(0, SOCIAL_EMOJI_RECENT_LIMIT);
  socialSaveEmojiRecents(socialState.emojiRecents);
}

function socialSwitchEmojiSetByDelta(delta = 0) {
  const step = Number(delta || 0);
  if (!step) return;
  const idx = Math.max(0, SOCIAL_EMOJI_TAB_ORDER.indexOf(socialEmojiSetKey));
  const next = Math.max(0, Math.min(SOCIAL_EMOJI_TAB_ORDER.length - 1, idx + step));
  if (next === idx) return;
  socialSwitchEmojiSet(SOCIAL_EMOJI_TAB_ORDER[next]);
}

function socialBindEmojiSwipe(host) {
  if (!host || host.dataset.swipeBind === "1") return;
  host.dataset.swipeBind = "1";
  let startX = 0;
  let startY = 0;
  host.addEventListener("pointerdown", (e) => {
    if (!e.target?.closest?.(".social-emoji-pane")) return;
    startX = Number(e.clientX || 0);
    startY = Number(e.clientY || 0);
  }, { passive: true });
  host.addEventListener("pointermove", (e) => {
    if (!startX) return;
    const dx = Number(e.clientX || 0) - startX;
    const dy = Number(e.clientY || 0) - startY;
    if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      socialState.keepEmojiOpenUntil = Date.now() + 260;
      socialSwitchEmojiSetByDelta(dx < 0 ? 1 : -1);
      startX = 0;
      startY = 0;
    }
  }, { passive: true });
  const stop = () => {
    startX = 0;
    startY = 0;
  };
  host.addEventListener("pointerup", stop, { passive: true });
  host.addEventListener("pointercancel", stop, { passive: true });
}

function socialBuildEmojiSectionsHtml() {
  return SOCIAL_EMOJI_GROUPS.map((group) => {
    const itemsHtml = group.items.map((emoji) => `<button type="button" class="social-emoji-item" onclick="socialInsertEmoji('${emoji}')">${emoji}</button>`).join("");
    return `
      <section class="social-emoji-section" data-emoji-group="${escapeHtml(group.id)}">
        <header class="social-emoji-section-title">${escapeHtml(group.label)}</header>
        <div class="social-emoji-grid">${itemsHtml}</div>
      </section>
    `;
  }).join("");
}

function socialBuildRecentEmojiHtml() {
  const recents = socialGetEmojiRecents();
  if (!recents.length) {
    return `<div class="social-emoji-empty">${escapeHtml(tr("\u041d\u0435\u0434\u0430\u0432\u043d\u0438\u0445 \u0441\u043c\u0430\u0439\u043b\u0438\u043a\u043e\u0432 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442", "No recent emoji yet"))}</div>`;
  }
  const items = recents.map((emoji) => `<button type="button" class="social-emoji-item" onclick="socialInsertEmoji('${emoji}')">${emoji}</button>`).join("");
  return `<div class="social-emoji-grid">${items}</div>`;
}

function socialEnsureEmojiPicker() {
  const host = document.getElementById("socialEmojiPicker");
  if (!host) return;
  socialGetEmojiRecents();
  const tabs = `
    <button type="button" class="social-emoji-tab ${socialEmojiSetKey === "recent" ? "active" : ""}" onclick="socialSwitchEmojiSet('recent')" aria-label="${escapeHtml(tr("\u041d\u0435\u0434\u0430\u0432\u043d\u0438\u0435", "Recent"))}" title="${escapeHtml(tr("\u041d\u0435\u0434\u0430\u0432\u043d\u0438\u0435", "Recent"))}">
      <span class="social-emoji-tab-icon" aria-hidden="true">??</span>
    </button>
    <button type="button" class="social-emoji-tab ${socialEmojiSetKey === "all" ? "active" : ""}" onclick="socialSwitchEmojiSet('all')" aria-label="${escapeHtml(tr("\u0412\u0441\u0435 \u0441\u043c\u0430\u0439\u043b\u0438\u043a\u0438", "All emoji"))}" title="${escapeHtml(tr("\u0412\u0441\u0435 \u0441\u043c\u0430\u0439\u043b\u0438\u043a\u0438", "All emoji"))}">
      <span class="social-emoji-tab-icon" aria-hidden="true">??</span>
    </button>
  `;
  const pane = socialEmojiSetKey === "recent"
    ? socialBuildRecentEmojiHtml()
    : `<div class="social-emoji-sections">${socialBuildEmojiSectionsHtml()}</div>`;
  host.innerHTML = `
    <div class="social-emoji-tabs">${tabs}</div>
    <div class="social-emoji-pane">${pane}</div>
  `;
  socialBindEmojiSwipe(host);
}

function socialToggleEmojiPicker(force = null) {
  const host = document.getElementById("socialEmojiPicker");
  if (!host) return;
  const shouldOpen = force === null ? host.classList.contains("hidden") : Boolean(force);
  if (shouldOpen) socialEnsureEmojiPicker();
  host.classList.toggle("hidden", !shouldOpen);
  if (shouldOpen) {
    const input = document.getElementById("socialChatInput");
    if (input) input.focus();
  }
}

function socialSwitchEmojiSet(key) {
  const normalized = ({ business: "all", quick: "all", smile: "all", all: "all", recent: "recent" })[String(key || "").trim()] || "all";
  if (normalized === socialEmojiSetKey) return;
  socialState.keepEmojiOpenUntil = Date.now() + 220;
  socialEmojiSetKey = normalized;
  socialEnsureEmojiPicker();
}

function socialInsertEmoji(emoji) {
  const code = String(emoji || "").trim();
  if (!code) return;
  const input = document.getElementById("socialChatInput");
  if (!input) return;
  const value = String(input.value || "");
  const start = Number(input.selectionStart || value.length);
  const end = Number(input.selectionEnd || value.length);
  const next = `${value.slice(0, start)}${code}${value.slice(end)}`;
  input.value = next;
  const caret = start + code.length;
  input.setSelectionRange(caret, caret);
  input.focus();
  socialRememberRecentEmoji(code);
  socialSyncChatComposerState();
  socialToggleEmojiPicker(true);
}

const SOCIAL_CALENDAR_REMINDER_PRESETS = Object.freeze([
  { value: 0 },
  { value: 10 },
  { value: 30 },
  { value: 60 },
  { value: 24 * 60 },
  { value: 3 * 24 * 60 },
  { value: 7 * 24 * 60 },
]);

function socialCalendarEventBaseId(eventRow) {
  const sourceId = Number(eventRow?.source_event_id || 0);
  const ownId = Number(eventRow?.id || 0);
  return sourceId || ownId || 0;
}

function socialCalendarNormalizeReminderOffsets(input, fallbackDefault = true) {
  let source = input;
  if (typeof source === "string") {
    const raw = String(source || "").trim();
    if (!raw) {
      source = [];
    } else {
      try {
        source = JSON.parse(raw);
      } catch (_) {
        source = [raw];
      }
    }
  }
  if (source == null) source = [];
  if (!Array.isArray(source)) source = [source];
  const seen = new Set();
  const values = [];
  source.forEach((item) => {
    const minutes = Math.round(Number(item));
    if (!Number.isFinite(minutes) || minutes < 0 || minutes > 60 * 24 * 365) return;
    if (seen.has(minutes)) return;
    seen.add(minutes);
    values.push(minutes);
  });
  values.sort((a, b) => a - b);
  if (values.length) return values;
  return fallbackDefault ? [10] : [];
}

function socialCalendarReminderLabel(minutesRaw) {
  const minutes = Math.round(Number(minutesRaw || 0));
  if (!Number.isFinite(minutes) || minutes < 0) return "";
  const isEn = typeof currentLang !== "undefined" && currentLang === "en";
  if (minutes === 0) return tr("\u0412 \u043c\u043e\u043c\u0435\u043d\u0442 \u0441\u043e\u0431\u044b\u0442\u0438\u044f", "At event time");
  if (minutes % (7 * 24 * 60) === 0) {
    const weeks = Math.max(1, Math.round(minutes / (7 * 24 * 60)));
    return isEn ? `${weeks} week${weeks === 1 ? "" : "s"} before` : `${weeks} ${tr("\u043d\u0435\u0434.", "wk.")} ${tr("\u0437\u0430\u0440\u0430\u043d\u0435\u0435", "before")}`;
  }
  if (minutes % (24 * 60) === 0) {
    const days = Math.max(1, Math.round(minutes / (24 * 60)));
    return isEn ? `${days} day${days === 1 ? "" : "s"} before` : `${days} ${tr("\u0434\u043d.", "day")} ${tr("\u0437\u0430\u0440\u0430\u043d\u0435\u0435", "before")}`;
  }
  if (minutes % 60 === 0) {
    const hours = Math.max(1, Math.round(minutes / 60));
    return isEn ? `${hours} hour${hours === 1 ? "" : "s"} before` : `${hours} ${tr("\u0447.", "hr")} ${tr("\u0437\u0430\u0440\u0430\u043d\u0435\u0435", "before")}`;
  }
  return isEn ? `${minutes} min before` : `${minutes} ${tr("\u043c\u0438\u043d.", "min")} ${tr("\u0437\u0430\u0440\u0430\u043d\u0435\u0435", "before")}`;
}

function socialCalendarReminderSummary(offsets, enabled = true) {
  if (!enabled) return tr("\u0411\u0435\u0437 \u043d\u0430\u043f\u043e\u043c\u0438\u043d\u0430\u043d\u0438\u0439", "No reminders");
  const values = socialCalendarNormalizeReminderOffsets(offsets, true);
  if (!values.length) return tr("\u0411\u0435\u0437 \u043d\u0430\u043f\u043e\u043c\u0438\u043d\u0430\u043d\u0438\u0439", "No reminders");
  const labels = values.map((minutes) => socialCalendarReminderLabel(minutes)).filter(Boolean);
  if (!labels.length) return tr("\u0411\u0435\u0437 \u043d\u0430\u043f\u043e\u043c\u0438\u043d\u0430\u043d\u0438\u0439", "No reminders");
  const preview = labels.slice(0, 2).join(", ");
  const extra = labels.length > 2 ? ` +${labels.length - 2}` : "";
  return `${tr("\u041d\u0430\u043f\u043e\u043c\u0438\u043d\u0430\u043d\u0438\u044f", "Reminders")}: ${preview}${extra}`;
}

function socialCalendarRecurrenceLabel(kindRaw, intervalRaw) {
  const kind = String(kindRaw || "none").trim().toLowerCase();
  const interval = Math.max(1, Math.round(Number(intervalRaw || 1)) || 1);
  if (kind === "none") return "";
  if (interval === 1) {
    if (kind === "day") return tr("\u041a\u0430\u0436\u0434\u044b\u0439 \u0434\u0435\u043d\u044c", "Daily");
    if (kind === "week") return tr("\u041a\u0430\u0436\u0434\u0443\u044e \u043d\u0435\u0434\u0435\u043b\u044e", "Weekly");
    if (kind === "month") return tr("\u041a\u0430\u0436\u0434\u044b\u0439 \u043c\u0435\u0441\u044f\u0446", "Monthly");
    if (kind === "year") return tr("\u041a\u0430\u0436\u0434\u044b\u0439 \u0433\u043e\u0434", "Yearly");
  }
  const isEn = typeof currentLang !== "undefined" && currentLang === "en";
  if (isEn) {
    if (kind === "day") return `Every ${interval} days`;
    if (kind === "week") return `Every ${interval} weeks`;
    if (kind === "month") return `Every ${interval} months`;
    if (kind === "year") return `Every ${interval} years`;
    return "";
  }
  if (kind === "day") return `\u041a\u0430\u0436\u0434\u044b\u0435 ${interval} \u0434\u043d.`;
  if (kind === "week") return `\u041a\u0430\u0436\u0434\u044b\u0435 ${interval} \u043d\u0435\u0434.`;
  if (kind === "month") return `\u041a\u0430\u0436\u0434\u044b\u0435 ${interval} \u043c\u0435\u0441.`;
  if (kind === "year") return `\u041a\u0430\u0436\u0434\u044b\u0435 ${interval} \u0433.`;
  return "";
}

function socialCalendarReminderParts(minutesRaw) {
  const minutes = Math.max(0, Math.round(Number(minutesRaw || 0)) || 0);
  if (minutes > 0 && minutes % (7 * 24 * 60) === 0) {
    return { amount: Math.max(1, Math.round(minutes / (7 * 24 * 60))), unit: "week" };
  }
  if (minutes > 0 && minutes % (24 * 60) === 0) {
    return { amount: Math.max(1, Math.round(minutes / (24 * 60))), unit: "day" };
  }
  if (minutes > 0 && minutes % 60 === 0) {
    return { amount: Math.max(1, Math.round(minutes / 60)), unit: "hour" };
  }
  return { amount: Math.max(1, minutes || 30), unit: "minute" };
}

function socialCalendarReminderUnitFactor(unitRaw) {
  const unit = String(unitRaw || "minute").trim().toLowerCase();
  if (unit === "hour") return 60;
  if (unit === "day") return 24 * 60;
  if (unit === "week") return 7 * 24 * 60;
  return 1;
}

function socialCalendarReminderUnitOptions(selected = "minute") {
  const unit = String(selected || "minute").trim().toLowerCase();
  const options = [
    { value: "minute", label: tr("\u041c\u0438\u043d\u0443\u0442\u044b", "Minutes") },
    { value: "hour", label: tr("\u0427\u0430\u0441\u044b", "Hours") },
    { value: "day", label: tr("\u0414\u043d\u0438", "Days") },
    { value: "week", label: tr("\u041d\u0435\u0434\u0435\u043b\u0438", "Weeks") },
  ];
  return options.map((option) => `<option value="${option.value}" ${option.value === unit ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("");
}

function socialCalendarGetCustomReminderOffsets() {
  const host = document.getElementById("socialEventReminderCustomList");
  if (host) {
    const rows = Array.from(host.querySelectorAll(".social-calendar-reminder-custom-row"));
    if (rows.length) {
      const values = rows.map((row) => {
        const amount = Math.round(Number(row.querySelector('[data-role="amount"]')?.value || 0));
        const unit = String(row.querySelector('[data-role="unit"]')?.value || "minute").trim().toLowerCase();
        if (!Number.isFinite(amount) || amount <= 0) return null;
        return amount * socialCalendarReminderUnitFactor(unit);
      }).filter((value) => Number.isFinite(value));
      return socialCalendarNormalizeReminderOffsets(values, false);
    }
  }
  const hidden = document.getElementById("socialEventReminderCustomState");
  return socialCalendarNormalizeReminderOffsets(hidden?.value || [], false);
}

function socialCalendarSetCustomReminderOffsets(offsets) {
  const values = socialCalendarNormalizeReminderOffsets(offsets, false);
  const hidden = document.getElementById("socialEventReminderCustomState");
  if (hidden) hidden.value = JSON.stringify(values);
  const host = document.getElementById("socialEventReminderCustomList");
  if (!host) return;
  if (!values.length) {
    host.innerHTML = `<div class="hint">${escapeHtml(tr("\u041d\u0435\u0442 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c\u0441\u043a\u0438\u0445 \u043d\u0430\u043f\u043e\u043c\u0438\u043d\u0430\u043d\u0438\u0439", "No custom reminders"))}</div>`;
    return;
  }
  host.innerHTML = values.map((minutes, index) => {
    const parts = socialCalendarReminderParts(minutes);
    return `
      <div class="social-calendar-reminder-custom-row">
        <input type="number" min="1" step="1" value="${escapeHtml(String(parts.amount || 1))}" data-role="amount" oninput="socialCalendarToggleReminderFields()" />
        <select data-role="unit" onchange="socialCalendarToggleReminderFields()">${socialCalendarReminderUnitOptions(parts.unit)}</select>
        <button class="btn-secondary" type="button" onclick="socialCalendarRemoveCustomReminder(${index})">${tr("\u0423\u0434\u0430\u043b\u0438\u0442\u044c", "Remove")}</button>
      </div>
    `;
  }).join("");
}

function socialCalendarCollectReminderOffsets() {
  const enabled = Boolean(document.getElementById("socialEventReminderEnabled")?.checked);
  if (!enabled) return [];
  const presetValues = Array.from(document.querySelectorAll('input[name="socialEventReminderPreset"]:checked'))
    .map((node) => Number(node.value || 0));
  const customValues = socialCalendarGetCustomReminderOffsets();
  return socialCalendarNormalizeReminderOffsets([...presetValues, ...customValues], true);
}

function socialCalendarAddCustomReminder(offset = 180) {
  const current = socialCalendarGetCustomReminderOffsets();
  current.push(Number(offset || 180) || 180);
  socialCalendarSetCustomReminderOffsets(current);
  socialCalendarToggleReminderFields();
  const inputs = document.querySelectorAll('.social-calendar-reminder-custom-row [data-role="amount"]');
  const input = inputs[inputs.length - 1];
  if (input) {
    input.focus();
    input.select?.();
  }
}

function socialCalendarRemoveCustomReminder(index) {
  const current = socialCalendarGetCustomReminderOffsets();
  current.splice(Math.max(0, Number(index || 0)), 1);
  socialCalendarSetCustomReminderOffsets(current);
  socialCalendarToggleReminderFields();
}

function socialCalendarToggleReminderFields() {
  const enabled = Boolean(document.getElementById("socialEventReminderEnabled")?.checked);
  const fields = document.getElementById("socialEventReminderFields");
  if (fields) fields.classList.toggle("hidden", !enabled);
  if (enabled) {
    const hasPreset = Boolean(document.querySelector('input[name="socialEventReminderPreset"]:checked'));
    const hasCustom = socialCalendarGetCustomReminderOffsets().length > 0;
    if (!hasPreset && !hasCustom) {
      const fallback = document.querySelector('input[name="socialEventReminderPreset"][value="10"]');
      if (fallback) fallback.checked = true;
    }
  }
  const note = document.getElementById("socialEventReminderNote");
  if (note) {
    note.textContent = enabled
      ? socialCalendarReminderSummary(socialCalendarCollectReminderOffsets(), true)
      : tr("\u041d\u0430\u043f\u043e\u043c\u0438\u043d\u0430\u043d\u0438\u044f \u043e\u0442\u043a\u043b\u044e\u0447\u0435\u043d\u044b", "Reminders are off");
  }
}

function socialCalendarToggleRecurrenceFields() {
  const kind = String(document.getElementById("socialEventRecurrenceKind")?.value || "none").trim().toLowerCase();
  const intervalWrap = document.getElementById("socialEventRecurrenceIntervalWrap");
  if (intervalWrap) intervalWrap.classList.toggle("hidden", kind === "none");
  const note = document.getElementById("socialEventRecurrenceNote");
  if (note) {
    const interval = Math.max(1, Math.round(Number(document.getElementById("socialEventRecurrenceInterval")?.value || 1)) || 1);
    note.textContent = kind === "none"
      ? tr("\u0421\u043e\u0431\u044b\u0442\u0438\u0435 \u043d\u0435 \u043f\u043e\u0432\u0442\u043e\u0440\u044f\u0435\u0442\u0441\u044f", "This event does not repeat")
      : socialCalendarRecurrenceLabel(kind, interval);
  }
}

async function socialOpenCalendarModal(eventId = 0) {
  const baseId = Number(eventId || 0);
  const fallbackRow = (socialState.calendarEvents || []).find((x) => socialCalendarEventBaseId(x) === baseId) || null;
  let row = fallbackRow;
  if (baseId > 0) {
    const loaded = await socialRequest(`/api/social/calendar/events/${baseId}`).catch(() => null);
    if (loaded && typeof loaded === "object") {
      row = loaded;
    } else if (!fallbackRow || String(fallbackRow?.recurrence_kind || "none").trim().toLowerCase() !== "none") {
      alert(tr("\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u0441\u043e\u0431\u044b\u0442\u0438\u0435 \u0434\u043b\u044f \u0440\u0435\u0434\u0430\u043a\u0442\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u044f", "Failed to load event for editing"));
      return;
    }
  }

  const selectedDay = String(socialState.calendarSelectedDay || socialCalendarDayKey(new Date()) || socialCalendarDayKey(new Date())).trim();
  const startValue = socialCalendarDateTimeValue(row?.start_at || `${selectedDay}T09:00`);
  const endValue = socialCalendarDateTimeValue(row?.end_at || `${selectedDay}T10:00`);
  const reminderEnabled = row ? row?.reminder_enabled !== false : true;
  const reminderOffsets = socialCalendarNormalizeReminderOffsets(row?.reminder_offsets_min, reminderEnabled);
  const presetValues = new Set(SOCIAL_CALENDAR_REMINDER_PRESETS.map((item) => Number(item.value || 0)));
  const presetChecked = new Set(reminderOffsets.filter((value) => presetValues.has(value)));
  const customOffsets = reminderOffsets.filter((value) => !presetValues.has(value));
  const recurrenceKind = String(row?.recurrence_kind || "none").trim().toLowerCase() || "none";
  const recurrenceInterval = Math.max(1, Math.round(Number(row?.recurrence_interval || 1)) || 1);
  const safeEventId = socialCalendarEventBaseId(row) || baseId;

  socialOpenModal(
    row ? tr("\u0418\u0437\u043c\u0435\u043d\u0438\u0442\u044c \u0441\u043e\u0431\u044b\u0442\u0438\u0435", "Edit event") : tr("\u041d\u043e\u0432\u043e\u0435 \u0441\u043e\u0431\u044b\u0442\u0438\u0435", "New event"),
    `
      <div class="grid-2 social-calendar-edit-grid">
        <label>
          <span>${tr("\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435", "Title")}</span>
          <input id="socialEventTitle" value="${escapeHtml(row?.title || "")}" />
        </label>
        <label>
          <span>${tr("\u041d\u0430\u0447\u0430\u043b\u043e", "Start")}</span>
          <input id="socialEventStart" type="datetime-local" value="${escapeHtml(startValue)}" />
        </label>
        <label>
          <span>${tr("\u041e\u043a\u043e\u043d\u0447\u0430\u043d\u0438\u0435", "End")}</span>
          <input id="socialEventEnd" type="datetime-local" value="${escapeHtml(endValue)}" />
        </label>
        <label class="check social-calendar-edit-check">
          <input id="socialEventPublic" type="checkbox" ${row?.is_public ? "checked" : ""} />
          ${tr("\u041e\u0431\u0449\u0435\u0435 \u0441\u043e\u0431\u044b\u0442\u0438\u0435 (\u0432\u0438\u0434\u043d\u043e \u0432\u0441\u0435\u043c)", "Shared event (visible to all)")}
        </label>
        <label class="full">
          <span>${tr("\u041e\u043f\u0438\u0441\u0430\u043d\u0438\u0435", "Details")}</span>
          <textarea id="socialEventDetails" rows="5">${escapeHtml(socialCleanCalendarDetails(row?.details || ""))}</textarea>
        </label>
      </div>
      <div class="social-calendar-edit-section">
        <div class="social-calendar-edit-section-head">
          <strong>${tr("\u041f\u043e\u0432\u0442\u043e\u0440\u0435\u043d\u0438\u0435", "Repeat")}</strong>
          <span id="socialEventRecurrenceNote" class="hint"></span>
        </div>
        <div class="social-calendar-inline-row">
          <label>
            <span>${tr("\u0422\u0438\u043f \u043f\u043e\u0432\u0442\u043e\u0440\u0430", "Repeat type")}</span>
            <select id="socialEventRecurrenceKind" onchange="socialCalendarToggleRecurrenceFields()">
              <option value="none" ${recurrenceKind === "none" ? "selected" : ""}>${tr("\u041d\u0435 \u043f\u043e\u0432\u0442\u043e\u0440\u044f\u0442\u044c", "Does not repeat")}</option>
              <option value="day" ${recurrenceKind === "day" ? "selected" : ""}>${tr("\u041a\u0430\u0436\u0434\u044b\u0439 \u0434\u0435\u043d\u044c", "Every day")}</option>
              <option value="week" ${recurrenceKind === "week" ? "selected" : ""}>${tr("\u041a\u0430\u0436\u0434\u0443\u044e \u043d\u0435\u0434\u0435\u043b\u044e", "Every week")}</option>
              <option value="month" ${recurrenceKind === "month" ? "selected" : ""}>${tr("\u041a\u0430\u0436\u0434\u044b\u0439 \u043c\u0435\u0441\u044f\u0446", "Every month")}</option>
              <option value="year" ${recurrenceKind === "year" ? "selected" : ""}>${tr("\u041a\u0430\u0436\u0434\u044b\u0439 \u0433\u043e\u0434", "Every year")}</option>
            </select>
          </label>
          <label id="socialEventRecurrenceIntervalWrap">
            <span>${tr("\u0418\u043d\u0442\u0435\u0440\u0432\u0430\u043b", "Interval")}</span>
            <input id="socialEventRecurrenceInterval" type="number" min="1" max="365" value="${escapeHtml(String(recurrenceInterval))}" oninput="socialCalendarToggleRecurrenceFields()" />
          </label>
        </div>
      </div>
      <div class="social-calendar-edit-section">
        <div class="social-calendar-edit-section-head">
          <label class="check social-calendar-edit-check">
            <input id="socialEventReminderEnabled" type="checkbox" ${reminderEnabled ? "checked" : ""} onchange="socialCalendarToggleReminderFields()" />
            ${tr("\u041d\u0430\u043f\u043e\u043c\u0438\u043d\u0430\u043d\u0438\u044f \u0432\u043a\u043b\u044e\u0447\u0435\u043d\u044b", "Reminders enabled")}
          </label>
          <span id="socialEventReminderNote" class="hint"></span>
        </div>
        <div id="socialEventReminderFields" class="social-calendar-reminder-fields">
          <div class="social-calendar-reminder-presets">
            ${SOCIAL_CALENDAR_REMINDER_PRESETS.map((preset) => `
              <label class="check social-calendar-reminder-choice">
                <input type="checkbox" name="socialEventReminderPreset" value="${Number(preset.value || 0)}" ${presetChecked.has(Number(preset.value || 0)) ? "checked" : ""} onchange="socialCalendarToggleReminderFields()" />
                ${escapeHtml(socialCalendarReminderLabel(preset.value))}
              </label>
            `).join("")}
          </div>
          <input id="socialEventReminderCustomState" type="hidden" value="${escapeHtml(JSON.stringify(customOffsets))}" />
          <div>
            <div class="social-calendar-edit-section-head">
              <strong>${tr("\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c\u0441\u043a\u0438\u0435 \u043d\u0430\u043f\u043e\u043c\u0438\u043d\u0430\u043d\u0438\u044f", "Custom reminders")}</strong>
              <span class="hint">${tr("\u0414\u043e\u0431\u0430\u0432\u044c\u0442\u0435 \u0441\u0432\u043e\u0438 \u0438\u043d\u0442\u0435\u0440\u0432\u0430\u043b\u044b, \u043d\u0430\u043f\u0440\u0438\u043c\u0435\u0440 \u0437\u0430 2 \u0434\u043d\u044f \u0438\u043b\u0438 \u0437\u0430 5 \u0447\u0430\u0441\u043e\u0432.", "Add your own offsets, for example 2 days or 5 hours before.")}</span>
            </div>
            <div id="socialEventReminderCustomList" class="social-calendar-reminder-custom-list"></div>
          </div>
          <div class="actions social-calendar-edit-footer">
            <button class="btn-secondary" type="button" onclick="socialCalendarAddCustomReminder()">${tr("\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0441\u0432\u043e\u0435 \u043d\u0430\u043f\u043e\u043c\u0438\u043d\u0430\u043d\u0438\u0435", "Add custom reminder")}</button>
          </div>
        </div>
      </div>
      <div class="actions social-calendar-edit-footer">
        <button type="button" onclick="socialSaveEvent(${safeEventId})">${row ? tr("\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c", "Save") : tr("\u0421\u043e\u0437\u0434\u0430\u0442\u044c", "Create")}</button>
      </div>
    `
  );

  socialCalendarSetCustomReminderOffsets(customOffsets);
  socialCalendarToggleRecurrenceFields();
  socialCalendarToggleReminderFields();
}

async function socialSaveEvent(eventId = 0) {
  const startAt = String(document.getElementById("socialEventStart")?.value || "").trim();
  const endAt = String(document.getElementById("socialEventEnd")?.value || "").trim();
  const recurrenceKind = String(document.getElementById("socialEventRecurrenceKind")?.value || "none").trim().toLowerCase();
  const recurrenceInterval = Math.max(1, Math.round(Number(document.getElementById("socialEventRecurrenceInterval")?.value || 1)) || 1);
  const reminderEnabled = Boolean(document.getElementById("socialEventReminderEnabled")?.checked);
  const payload = {
    title: String(document.getElementById("socialEventTitle")?.value || "").trim(),
    details: String(document.getElementById("socialEventDetails")?.value || "").trim(),
    start_at: startAt,
    end_at: endAt || null,
    is_public: Boolean(document.getElementById("socialEventPublic")?.checked),
    recurrence_kind: recurrenceKind,
    recurrence_interval: recurrenceKind === "none" ? 1 : recurrenceInterval,
    reminder_enabled: reminderEnabled,
    reminder_offsets_min: reminderEnabled ? socialCalendarCollectReminderOffsets() : [],
  };
  if (!payload.title || !payload.start_at) {
    alert(tr("\u0417\u0430\u043f\u043e\u043b\u043d\u0438\u0442\u0435 \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 \u0438 \u0434\u0430\u0442\u0443 \u043d\u0430\u0447\u0430\u043b\u0430", "Fill title and start date"));
    return;
  }
  const startDate = socialCalendarParseDate(payload.start_at);
  const endDate = payload.end_at ? socialCalendarParseDate(payload.end_at) : null;
  if (startDate && endDate && endDate.getTime() < startDate.getTime()) {
    alert(tr("\u0412\u0440\u0435\u043c\u044f \u043e\u043a\u043e\u043d\u0447\u0430\u043d\u0438\u044f \u043d\u0435 \u043c\u043e\u0436\u0435\u0442 \u0431\u044b\u0442\u044c \u0440\u0430\u043d\u044c\u0448\u0435 \u043d\u0430\u0447\u0430\u043b\u0430", "End time cannot be earlier than start time"));
    return;
  }
  const requestPromise = eventId > 0
    ? socialRequest(`/api/social/calendar/events/${Number(eventId)}`, { method: "PUT", body: JSON.stringify(payload) })
    : socialRequest("/api/social/calendar/events", { method: "POST", body: JSON.stringify(payload) });
  const saved = await requestPromise.catch((e) => {
    alert(e.message);
    return null;
  });
  if (!saved) return;
  socialState.calendarSelectedDay = socialCalendarDayKey(saved?.start_at || payload.start_at) || socialState.calendarSelectedDay;
  socialCloseModal();
  await socialLoadCalendar();
}

async function socialDeleteEvent(eventId) {
  const id = Number(eventId || 0);
  if (!id) return;
  const row = (socialState.calendarEvents || []).find((item) => socialCalendarEventBaseId(item) === id) || null;
  const recurring = String(row?.recurrence_kind || "none").trim().toLowerCase() !== "none";
  const confirmed = confirm(recurring
    ? tr("\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u0432\u0441\u044e \u0441\u0435\u0440\u0438\u044e \u0441\u043e\u0431\u044b\u0442\u0438\u0439?", "Delete the whole event series?")
    : tr("\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u0441\u043e\u0431\u044b\u0442\u0438\u0435?", "Delete event?"));
  if (!confirmed) return;
  const ok = await socialRequest(`/api/social/calendar/events/${id}`, { method: "DELETE" }).then(() => true).catch((e) => {
    alert(e.message);
    return false;
  });
  if (!ok) return;
  socialCloseModal?.();
  await socialLoadCalendar();
}
async function socialSyncGoogleCalendar() {
  if (typeof window !== "undefined" && window.__socialDisableGoogleCalendarFlow === true) {
    return false;
  }
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
    syncBtn.textContent = tr("Синхронизация...", "Syncing...");
  }
  socialSetCalendarSyncMessage("info", tr("Синхронизация начата", "Sync started"), [tr("Подождите, пока SEO WIBE обработает календарные события.", "Please wait while SEO WIBE processes calendar events.")]);
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
    socialSetCalendarSyncMessage("error", tr("Синхронизация календаря не удалась", "Calendar sync failed"), [e?.message || tr("Проверьте ссылку, подключение Google OAuth или повторите позже.", "Check the link, Google OAuth availability, or retry later.")]);
    return null;
  });
  if (syncBtn) {
    syncBtn.disabled = false;
    syncBtn.textContent = previousText || tr("Синхронизировать сейчас", "Sync now");
  }
  if (!data) return;
  const warnings = Array.isArray(data.warnings) ? data.warnings.map((line) => String(line || "").trim()).filter(Boolean) : [];
  const summaryLines = [
    `${tr("Импорт", "Imported")}: ${Number(data.imported || 0)}`,
    `${tr("Обновлено", "Updated")}: ${Number(data.updated || 0)}`,
    `${tr("Удалено", "Deleted")}: ${Number(data.deleted || 0)}`,
    `${tr("Пропущено", "Skipped")}: ${Number(data.skipped || 0)}`,
    `${tr("Источник", "Source")}: ${useIcs ? "ICS URL" : "Google OAuth"}`,
  ];
  if (warnings.length) summaryLines.push(`${tr("Предупреждения", "Warnings")}: ${warnings.join(" | ")}`);
  socialSetCalendarSyncMessage(
    warnings.length ? "warn" : "success",
    warnings.length ? tr("Синхронизация завершена с предупреждениями", "Sync completed with warnings") : tr("Календарь синхронизирован", "Calendar synchronized"),
    summaryLines
  );
  await socialLoadGoogleCalendarStatus();
  const taskRows = await socialRequest("/api/social/tasks?task_kind=all&include_done=0", { timeoutMs: 12000 }).catch(() => null);
  if (Array.isArray(taskRows)) {
    socialState.tasks = taskRows;
  }
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
  meta.textContent = `${tr("Курсы ЦБ", "CBR rates")}: ${stamp} - ${status}${note ? ` - ${note}` : ""}`;
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
    RUB: tr("RUB (СЂСѓР±.)", "RUB"),
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
  out.textContent = `${tr("Объём", "Volume")}: ${cm3.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} см³ - ${liters.toLocaleString("ru-RU", { maximumFractionDigits: 3 })} л - ${m3.toLocaleString("ru-RU", { maximumFractionDigits: 6 })} м³`;
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

const SOCIAL_NOTE_COLOR_KEY = "seo_wibe_note_cover_colors_v5";
const SOCIAL_NOTE_COLOR_PALETTE = [
  "#f8fbff",
  "#fff7d6",
  "#e9f7ff",
  "#f5ecff",
  "#ebffe9",
  "#ffeef5",
  "#fff3e5",
  "#eef2ff",
  "#f4f4f5",
];

function socialGetNoteColorMap() {
  try {
    const parsed = JSON.parse(String(localStorage.getItem(SOCIAL_NOTE_COLOR_KEY) || "{}"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_) {
    return {};
  }
}

function socialGetNoteCoverColor(noteId) {
  const id = Number(noteId || 0);
  if (!id) return "#f8fbff";
  const map = socialGetNoteColorMap();
  const key = String(id);
  const value = String(map[key] || "").trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(value) ? value : "#f8fbff";
}

function socialSetNoteCoverColor(noteId, color) {
  const id = Number(noteId || 0);
  if (!id) return;
  const safe = /^#[0-9a-fA-F]{6}$/.test(String(color || "").trim())
    ? String(color || "").trim().toLowerCase()
    : "#f8fbff";
  const map = socialGetNoteColorMap();
  map[String(id)] = safe;
  try {
    localStorage.setItem(SOCIAL_NOTE_COLOR_KEY, JSON.stringify(map));
  } catch (_) {}
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

function socialNotePreviewText(note) {
  const raw = socialNormalizeNoteText(note?.content || "").replace(/\s+/g, " ").trim();
  return raw || tr("Пустая заметка", "Empty note");
}

function socialNoteUpdatedLabel(note) {
  const value = String(note?.updated_at || "").trim();
  if (!value) return "-";
  const parsed = socialParseDateSafe(value);
  if (!(parsed instanceof Date) || Number.isNaN(parsed.getTime())) {
    return value.replace("T", " ").slice(0, 16);
  }
  return parsed.toLocaleString(currentLang === "en" ? "en-GB" : "ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function socialRenderNotesList() {
  const host = document.getElementById("socialNotesList");
  if (!host) return;
  const cardHeight = socialIsAppShellLike() ? 146 : 148;
  host.style.setProperty("display", "grid", "important");
  host.style.setProperty("grid-template-columns", "repeat(3, minmax(0, 1fr))", "important");
  host.style.setProperty("grid-auto-rows", `${cardHeight}px`, "important");
  host.style.setProperty("gap", "10px", "important");
  host.style.setProperty("width", "100%", "important");
  host.style.setProperty("min-width", "0", "important");
  host.style.setProperty("max-width", "100%", "important");
  host.style.setProperty("overflow-x", "hidden", "important");
  host.style.setProperty("overflow-y", "auto", "important");
  const sidebar = host.closest(".social-notes-sidebar");
  if (sidebar) {
    const layout = sidebar.closest(".social-notes-layout");
    if (layout) {
      layout.style.setProperty("display", "block", "important");
      layout.style.setProperty("grid-template-columns", "1fr", "important");
      layout.style.setProperty("width", "100%", "important");
      layout.style.setProperty("min-width", "0", "important");
      layout.style.setProperty("max-width", "100%", "important");
    }
    sidebar.style.setProperty("width", "100%", "important");
    sidebar.style.setProperty("max-width", "100%", "important");
    sidebar.style.setProperty("min-width", "0", "important");
    const containerChain = [
      sidebar.closest(".social-card"),
      sidebar.closest(".social-notes-shell"),
      sidebar.closest(".social-notes-content"),
      host.parentElement,
    ].filter(Boolean);
    containerChain.forEach((node) => {
      node.style.setProperty("width", "100%", "important");
      node.style.setProperty("min-width", "0", "important");
      node.style.setProperty("max-width", "100%", "important");
      node.style.setProperty("overflow-x", "hidden", "important");
    });
  }
  const rows = Array.isArray(socialState.notes) ? socialState.notes : [];
  host.innerHTML = rows.map((row) => {
    const active = Number(row.id) === Number(socialState.currentNoteId || 0);
    const title = String(row.title || tr("Без названия", "Untitled")).trim() || tr("Без названия", "Untitled");
    const preview = socialNotePreviewText(row);
    const updated = socialNoteUpdatedLabel(row);
    const sizeLabel = `${String(row.content || "").trim().length} ${tr("симв.", "chars")}`;
    const cover = socialGetNoteCoverColor(row.id);
    return `
      <div class="social-note-row ${active ? "active" : ""}" data-note-id="${Number(row.id)}" style="--sw-note-cover:${escapeHtml(cover)}" onclick="socialSelectNote(${Number(row.id)})">
        <button class="social-note-main" data-note-id="${Number(row.id)}" type="button" onclick="socialSelectNote(${Number(row.id)})">
          <b>${escapeHtml(title)}</b>
          <div class="social-note-snippet">${escapeHtml(preview)}</div>
          <div class="social-note-meta">
            <span>${escapeHtml(updated)}</span>
            <span>${escapeHtml(sizeLabel)}</span>
          </div>
        </button>
      </div>
    `;
  }).join("") || `<div class="hint">${tr("Заметок пока нет", "No notes yet")}</div>`;
  host.querySelectorAll(".social-note-row[data-note-id]").forEach((row) => {
    const noteId = Number(row.getAttribute("data-note-id") || 0);
    if (!noteId) return;
    row.querySelectorAll("button:not(.social-note-main)").forEach((node) => node.remove?.());
    row.style.cursor = "pointer";
    row.style.setProperty("min-width", "0", "important");
    row.style.setProperty("width", "100%", "important");
    row.style.setProperty("height", `${cardHeight}px`, "important");
    row.style.setProperty("min-height", `${cardHeight}px`, "important");
    row.style.setProperty("max-height", `${cardHeight}px`, "important");
    row.style.setProperty("overflow", "hidden", "important");
    row.style.setProperty("word-break", "break-word", "important");
    const main = row.querySelector(".social-note-main");
    if (main) {
      main.style.setProperty("display", "grid", "important");
      main.style.setProperty("grid-template-rows", "auto 1fr auto", "important");
      main.style.setProperty("height", "100%", "important");
      main.style.setProperty("overflow", "hidden", "important");
      main.style.setProperty("word-break", "break-word", "important");
    }
    row.onclick = () => socialSelectNote(noteId);
  });
}

function socialRenderCurrentNote() {
  const note = socialState.notes.find((x) => Number(x.id) === Number(socialState.currentNoteId || 0)) || null;
  const title = document.getElementById("socialNoteTitle");
  const content = document.getElementById("socialNoteContent");
  const autosave = document.getElementById("socialNoteAutosave");
  const editor = document.querySelector("#socialSubtabNotes .social-notes-editor");
  if (!title || !content) return;
  const hasNote = Boolean(note);
  if (editor) editor.classList.toggle("is-empty", !hasNote);
  title.disabled = !hasNote;
  content.disabled = !hasNote;
  title.value = hasNote ? socialNormalizeNoteText(note?.title || "") : "";
  content.value = hasNote ? socialNormalizeNoteText(note?.content || "") : "";
  title.placeholder = hasNote
    ? tr("Название заметки", "Note title")
    : tr("Выберите или создайте заметку", "Select or create a note");
  content.placeholder = hasNote
    ? tr("Текст заметки...", "Write your note...")
    : tr("Откройте карточку заметки слева или создайте новую", "Open a note card on the left or create a new one");
  if (autosave) autosave.textContent = hasNote ? tr("Автосохранение включено", "Autosave enabled") : tr("Выберите заметку", "Select note");
  socialRenderNoteFiles(note);
}

function socialSelectNote(noteId) {
  const safeId = Number(noteId || 0);
  socialState.currentNoteId = safeId;
  socialRenderNotesList();
  socialRenderCurrentNote();
  if (safeId > 0 && typeof window.socialOpenNoteEditor === "function") {
    window.socialOpenNoteEditor(safeId);
  }
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
  if (autosave) autosave.textContent = tr("\u0421\u043e\u0445\u0440\u0430\u043d\u044f\u0435\u043c...", "Saving...");
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
  if (autosave) autosave.textContent = tr("\u0421\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u043e", "Saved");
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
        <button class="btn-secondary" type="button" onclick="socialDeleteNoteFile(${Number(file.id || 0)})">&times;</button>
      </div>
    `).join("")
    : `<div class="hint">${tr("Файлы пока не загружены", "No files uploaded yet")}</div>`;
}

function socialTriggerNoteFileDialog() {
  const noteId = Number(socialState.currentNoteId || 0);
  if (!noteId) {
    alert(tr("\u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u0432\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0437\u0430\u043c\u0435\u0442\u043a\u0443", "Select a note first"));
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

function socialFindNoteById(noteId) {
  const id = Number(noteId || 0);
  if (!id) return null;
  return (socialState.notes || []).find((row) => Number(row?.id || 0) === id) || null;
}

function socialNoteModalFilesMarkup(note) {
  const files = Array.isArray(note?.files) ? note.files : [];
  if (!files.length) {
    return `<div class="hint">${escapeHtml(tr("\u0424\u0430\u0439\u043b\u044b \u043d\u0435 \u0434\u043e\u0431\u0430\u0432\u043b\u0435\u043d\u044b", "No files attached"))}</div>`;
  }
  return files.map((file) => {
    const fid = Number(file?.id || 0);
    return `
      <div class="social-note-file-row">
        <a href="${escapeHtml(file?.url || "#")}" target="_blank" rel="noopener noreferrer">${escapeHtml(file?.filename || "file")}</a>
        <small>${escapeHtml(socialFormatFileSize(file?.size_bytes || 0))}</small>
        <button class="btn-secondary" type="button" onclick="socialDeleteNoteFileFromEditor(${Number(note?.id || 0)}, ${fid})">&times;</button>
      </div>
    `;
  }).join("");
}

function socialNoteModalColorsMarkup(noteId) {
  const active = socialGetNoteCoverColor(noteId);
  return SOCIAL_NOTE_COLOR_PALETTE.map((color) => {
    const selected = active === color ? "is-active" : "";
    return `<button type="button" class="sw-note-color ${selected}" style="--sw-note-cover:${escapeHtml(color)}" onclick="socialPickNoteCoverColor(${Number(noteId || 0)}, '${color}')"></button>`;
  }).join("");
}

function socialOpenNoteEditor(noteId) {
  const id = Number(noteId || socialState.currentNoteId || 0);
  if (!id) return;
  const note = socialFindNoteById(id);
  if (!note) return;
  socialState.currentNoteId = id;
  socialRenderNotesList();
  socialRenderCurrentNote();
  socialOpenModal(
    tr("\u0417\u0430\u043c\u0435\u0442\u043a\u0430", "Note"),
    `
      <div class="social-note-editor-modal">
        <label>
          <span>${escapeHtml(tr("\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435", "Title"))}</span>
          <input id="socialNoteModalTitle" value="${escapeHtml(socialNormalizeNoteText(note?.title || ""))}" />
        </label>
        <label>
          <span>${escapeHtml(tr("\u0422\u0435\u043a\u0441\u0442", "Text"))}</span>
          <textarea id="socialNoteModalContent" rows="10">${escapeHtml(socialNormalizeNoteText(note?.content || ""))}</textarea>
        </label>
        <label>
          <span>${escapeHtml(tr("\u0426\u0432\u0435\u0442 \u043e\u0431\u043b\u043e\u0436\u043a\u0438", "Cover color"))}</span>
          <div id="socialNoteModalColors" class="sw-note-colors">${socialNoteModalColorsMarkup(id)}</div>
        </label>
        <div class="social-note-files-head">
          <b>${escapeHtml(tr("\u0424\u0430\u0439\u043b\u044b", "Files"))}</b>
          <input id="socialNoteModalUpload" type="file" multiple onchange="socialUploadNoteFilesFromEditor(${id}, 'socialNoteModalUpload')" />
          <button class="btn-secondary" type="button" onclick="document.getElementById('socialNoteModalUpload').click()">${escapeHtml(tr("\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0444\u0430\u0439\u043b\u044b", "Add files"))}</button>
        </div>
        <div id="socialNoteModalFilesList">${socialNoteModalFilesMarkup(note)}</div>
        <details class="sw-note-settings">
          <summary>${escapeHtml(tr("\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438 \u0437\u0430\u043c\u0435\u0442\u043a\u0438", "Note settings"))}</summary>
          <button class="btn-danger" type="button" onclick="socialDeleteNoteFromEditorSettings(${id})">${escapeHtml(tr("\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u0437\u0430\u043c\u0435\u0442\u043a\u0443", "Delete note"))}</button>
        </details>
        <div class="actions">
          <button type="button" class="btn-secondary" onclick="socialCloseModal()">${escapeHtml(tr("\u041e\u0442\u043c\u0435\u043d\u0430", "Cancel"))}</button>
          <button type="button" onclick="socialSaveNoteEditor(${id})">${escapeHtml(tr("\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c", "Save"))}</button>
        </div>
      </div>
    `
  );
}

function socialPickNoteCoverColor(noteId, color) {
  const id = Number(noteId || 0);
  if (!id) return;
  socialSetNoteCoverColor(id, color);
  const active = socialGetNoteCoverColor(id);
  document.querySelectorAll("#socialNoteModalColors .sw-note-color").forEach((node) => {
    const own = String(node.style.getPropertyValue("--sw-note-cover") || "").trim().toLowerCase();
    node.classList.toggle("is-active", own === active);
  });
  socialRenderNotesList();
}

async function socialSaveNoteEditor(noteId) {
  const id = Number(noteId || 0);
  if (!id) return;
  const payload = {
    title: String(document.getElementById("socialNoteModalTitle")?.value || "").trim() || tr("\u0411\u0435\u0437 \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u044f", "Untitled"),
    content: String(document.getElementById("socialNoteModalContent")?.value || ""),
  };
  const saved = await socialRequest(`/api/social/notes/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }).catch((e) => {
    alert(e?.message || tr("\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u0437\u0430\u043c\u0435\u0442\u043a\u0443", "Failed to save note"));
    return null;
  });
  if (!saved) return;
  socialState.currentNoteId = id;
  await socialLoadNotes();
  socialRenderNotesList();
  socialRenderCurrentNote();
  socialCloseModal();
}

async function socialUploadNoteFilesFromEditor(noteId, inputId) {
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
      if (token) headers.Authorization = `Bearer ${token}`;
      await requestJson(`/api/social/notes/${id}/files`, {
        method: "POST",
        headers,
        body,
        timeoutMs: 90000,
        retryOnPost: true,
        maxRetries: 1,
      });
    }
    socialState.currentNoteId = id;
    await socialLoadNotes();
    socialOpenNoteEditor(id);
  } catch (e) {
    alert(e?.message || tr("\u041e\u0448\u0438\u0431\u043a\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043a\u0438 \u0444\u0430\u0439\u043b\u0430", "File upload error"));
  } finally {
    if (input) input.value = "";
  }
}

async function socialDeleteNoteFileFromEditor(noteId, fileId) {
  const id = Number(noteId || 0);
  const fid = Number(fileId || 0);
  if (!id || !fid) return;
  if (!confirm(tr("\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u0444\u0430\u0439\u043b?", "Delete file?"))) return;
  await socialRequest(`/api/social/notes/${id}/files/${fid}`, { method: "DELETE" }).catch((e) => {
    alert(e?.message || tr("\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0443\u0434\u0430\u043b\u0438\u0442\u044c \u0444\u0430\u0439\u043b", "Failed to delete file"));
    return null;
  });
  socialState.currentNoteId = id;
  await socialLoadNotes();
  socialOpenNoteEditor(id);
}

async function socialDeleteNoteFromEditorSettings(noteId) {
  const id = Number(noteId || 0);
  if (!id) return;
  if (!confirm(tr("\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u0437\u0430\u043c\u0435\u0442\u043a\u0443?", "Delete note?"))) return;
  await socialRequest(`/api/social/notes/${id}`, { method: "DELETE" }).catch((e) => {
    alert(e?.message || tr("\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0443\u0434\u0430\u043b\u0438\u0442\u044c \u0437\u0430\u043c\u0435\u0442\u043a\u0443", "Failed to delete note"));
    return null;
  });
  if (socialState.currentNoteId === id) socialState.currentNoteId = 0;
  await socialLoadNotes();
  socialCloseModal();
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
window.socialOpenProjectMembersModal = socialOpenProjectMembersModal;
window.socialSaveProjectMembers = socialSaveProjectMembers;
window.socialOpenTaskModal = socialOpenTaskModal;
window.socialSaveTask = socialSaveTask;
window.socialAddTaskComment = socialAddTaskComment;
window.socialQuickDone = socialQuickDone;
window.socialDeleteTask = socialDeleteTask;
window.socialSyncTaskKindForm = socialSyncTaskKindForm;
window.socialToggleTaskDone = socialToggleTaskDone;
window.socialTaskDragStart = socialTaskDragStart;
window.socialTaskAllowDrop = socialTaskAllowDrop;
window.socialTaskDrop = socialTaskDrop;
window.socialOpenCalendarModal = socialOpenCalendarModal;
window.socialSaveEvent = socialSaveEvent;
window.socialDeleteEvent = socialDeleteEvent;
window.socialOpenCalendarQuickAddMenu = socialOpenCalendarQuickAddMenu;
window.socialCalendarQuickCreate = socialCalendarQuickCreate;
window.socialCalendarAddCustomReminder = socialCalendarAddCustomReminder;
window.socialCalendarRemoveCustomReminder = socialCalendarRemoveCustomReminder;
window.socialCalendarToggleReminderFields = socialCalendarToggleReminderFields;
window.socialCalendarToggleRecurrenceFields = socialCalendarToggleRecurrenceFields;
window.socialShiftCalendar = socialShiftCalendar;
window.socialOpenCalendarMonthYearPicker = socialOpenCalendarMonthYearPicker;
window.socialApplyCalendarMonthYearPicker = socialApplyCalendarMonthYearPicker;
window.socialJumpCalendarToday = socialJumpCalendarToday;
window.socialLoadCalendar = socialLoadCalendar;
window.socialConnectGoogleCalendar = socialConnectGoogleCalendar;
window.socialNormalizeCalendarChrome = socialNormalizeCalendarChrome;
window.socialRenderCalendar = socialRenderCalendar;
window.socialShowDay = socialShowDay;
window.socialOpenCalendarRecordDetail = socialOpenCalendarRecordDetail;
window.socialCleanCalendarDetails = socialCleanCalendarDetails;
window.socialSetBell = socialSetBell;
window.socialEnsureNotificationCenterLayout = socialEnsureNotificationCenterLayout;
window.socialRenderNotificationCenter = socialRenderNotificationCenter;
window.socialLoadNotificationCenterRows = socialLoadNotificationCenterRows;
window.socialToggleNotificationCenter = socialToggleNotificationCenter;
window.socialCloseNotificationCenter = socialCloseNotificationCenter;
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
window.socialOpenNoteEditor = socialOpenNoteEditor;
window.socialPickNoteCoverColor = socialPickNoteCoverColor;
window.socialSaveNoteEditor = socialSaveNoteEditor;
window.socialUploadNoteFilesFromEditor = socialUploadNoteFilesFromEditor;
window.socialDeleteNoteFileFromEditor = socialDeleteNoteFileFromEditor;
window.socialDeleteNoteFromEditorSettings = socialDeleteNoteFromEditorSettings;
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




































(function configureStableSocialRuntimeV20260324() {
  if (typeof window === "undefined") return;
  // Disable old emergency runtime patch packs that override core calendar/notes/notification
  // rendering and can conflict with the current stable implementation.
  window.__socialDisableLegacyTaskCalendarPatches = true;
  window.__socialDisableTaskMouseDropV2 = true;
  window.__socialDisableUiRecoveryV20260323b = true;
  window.__socialDisableUiTextFixesV1 = true;
  window.__socialDisableCurrencyPatchV2 = true;
  window.__socialDisableTaskGlyphPatchV1 = true;
  window.__socialDisableHardeningV20260323 = true;
  window.__socialDisableUiFinalV20260323c = true;
})();

(function attachSocialTasksPlanPatchV2() {
  if (typeof window === "undefined") return;
  if (window.__socialDisableLegacyTaskCalendarPatches !== false) return;
  if (window.__socialTasksPlanPatchV2) return;
  window.__socialTasksPlanPatchV2 = true;

  function ensurePatchStyles() {
    if (document.getElementById("socialTasksPlanPatchV2Styles")) return;
    const style = document.createElement("style");
    style.id = "socialTasksPlanPatchV2Styles";
    style.textContent = `
      .social-calendar-task-mode {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        margin-left: auto;
      }
      .social-calendar-task-mode .chip-btn {
        min-height: 36px;
      }
      .social-calendar-task-mode .chip-btn.is-active {
        border-color: color-mix(in srgb, var(--accent) 58%, var(--line));
        background: color-mix(in srgb, var(--accent) 16%, var(--panel-bg));
        box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 24%, transparent);
      }
      .social-task-bucket-list.is-touch-drop-target {
        outline: 2px dashed color-mix(in srgb, var(--accent) 62%, var(--line));
        outline-offset: 3px;
        border-radius: 12px;
      }
      .social-task-item.is-touch-dragging {
        opacity: 0.75;
        transform: scale(0.985);
      }
      @media (max-width: 980px) {
        .social-calendar-task-mode {
          width: 100%;
          margin-left: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureTaskStateDefaults() {
    if (!window.socialState || typeof window.socialState !== "object") return;
    if (!Array.isArray(window.socialState.tasksLastGood)) {
      window.socialState.tasksLastGood = Array.isArray(window.socialState.tasks)
        ? [...window.socialState.tasks]
        : [];
    }
    const mode = String(window.socialState.calendarTaskFilter || "").toLowerCase();
    if (!["events", "tasks", "my_tasks"].includes(mode)) {
      window.socialState.calendarTaskFilter = "events";
    }
  }

  ensurePatchStyles();
  ensureTaskStateDefaults();

  const originalResetSocialState = typeof window.resetSocialState === "function" ? window.resetSocialState : null;
  if (originalResetSocialState) {
    window.resetSocialState = function patchedResetSocialState() {
      originalResetSocialState();
      ensureTaskStateDefaults();
      ensurePatchStyles();
    };
  }

  const originalSocialLoadTasks = typeof window.socialLoadTasks === "function" ? window.socialLoadTasks : null;
  if (originalSocialLoadTasks) {
    window.socialLoadTasks = async function patchedSocialLoadTasks(opts = {}) {
      ensureTaskStateDefaults();
      const previousGood = Array.isArray(window.socialState.tasksLastGood)
        ? [...window.socialState.tasksLastGood]
        : [];
      const result = await originalSocialLoadTasks(opts);
      const currentRows = Array.isArray(window.socialState.tasks) ? window.socialState.tasks : [];
      if (currentRows.length) {
        window.socialState.tasksLastGood = [...currentRows];
      } else if (previousGood.length) {
        window.socialState.tasks = [...previousGood];
        if (typeof window.socialRenderTasks === "function") {
          window.socialRenderTasks();
        }
      }
      return result;
    };
  }

  function normalizeCalendarMode(mode) {
    const safe = String(mode || "").trim().toLowerCase();
    if (safe === "tasks") return "tasks";
    if (safe === "my_tasks") return "my_tasks";
    return "events";
  }

  function getCalendarTaskRowsByMode() {
    ensureTaskStateDefaults();
    const mode = normalizeCalendarMode(window.socialState.calendarTaskFilter);
    const allTasks = Array.isArray(window.socialState.tasks) ? window.socialState.tasks : [];
    if (mode === "events") return [];
    if (mode === "my_tasks") {
      return allTasks.filter((task) => String(task?.task_kind || "").toLowerCase() === "personal");
    }
    return allTasks;
  }

  function syncCalendarModeButtons() {
    const mode = normalizeCalendarMode(window.socialState?.calendarTaskFilter);
    const host = document.getElementById("socialCalendarTaskMode");
    if (!host) return;
    host.querySelectorAll("button[data-mode]").forEach((btn) => {
      btn.classList.toggle("is-active", String(btn.getAttribute("data-mode") || "") === mode);
    });
  }

  function ensureCalendarTaskModeControls() {
    const toolbar = document.querySelector("#socialSubtabCalendar .social-calendar-toolbar--modern");
    if (!toolbar) return;
    let host = document.getElementById("socialCalendarTaskMode");
    if (!host) {
      host = document.createElement("div");
      host.id = "socialCalendarTaskMode";
      host.className = "social-calendar-task-mode";
      host.innerHTML = `
        <button type="button" class="chip-btn" data-mode="events">${window.tr("\u0421\u043e\u0431\u044b\u0442\u0438\u044f", "Events")}</button>
        <button type="button" class="chip-btn" data-mode="tasks">${window.tr("Задачи", "Tasks")}</button>
        <button type="button" class="chip-btn" data-mode="my_tasks">${window.tr("МОИ ЗАДАЧИ", "MY TASKS")}</button>
      `;
      host.addEventListener("click", (event) => {
        const btn = event.target.closest("button[data-mode]");
        if (!btn) return;
        window.socialSetCalendarTaskMode(String(btn.getAttribute("data-mode") || "events"));
      });
      toolbar.appendChild(host);
    }
    syncCalendarModeButtons();
  }

  window.socialSetCalendarTaskMode = function socialSetCalendarTaskMode(mode) {
    ensureTaskStateDefaults();
    const safe = normalizeCalendarMode(mode);
    window.socialState.calendarTaskFilter = safe;
    try {
      localStorage.setItem("social_calendar_task_mode", safe);
    } catch (_) {}
    syncCalendarModeButtons();
    if (String(window.socialState.currentSubtab || "") === "calendar" && typeof window.socialRenderCalendar === "function") {
      window.socialRenderCalendar();
    }
  };

  try {
    const persistedMode = normalizeCalendarMode(localStorage.getItem("social_calendar_task_mode") || "events");
    window.socialState.calendarTaskFilter = persistedMode;
  } catch (_) {
    window.socialState.calendarTaskFilter = normalizeCalendarMode(window.socialState.calendarTaskFilter);
  }

  const originalSocialLoadCalendar = typeof window.socialLoadCalendar === "function" ? window.socialLoadCalendar : null;
  if (originalSocialLoadCalendar) {
    window.socialLoadCalendar = async function patchedSocialLoadCalendar() {
      ensureTaskStateDefaults();
      ensureCalendarTaskModeControls();
      const result = await originalSocialLoadCalendar();
      syncCalendarModeButtons();
      return result;
    };
  }

  const originalSocialRenderCalendar = typeof window.socialRenderCalendar === "function" ? window.socialRenderCalendar : null;
  if (originalSocialRenderCalendar) {
    window.socialRenderCalendar = function patchedSocialRenderCalendar() {
      ensureTaskStateDefaults();
      ensureCalendarTaskModeControls();
      const sourceTasks = Array.isArray(window.socialState.tasks) ? window.socialState.tasks : [];
      const filteredTasks = getCalendarTaskRowsByMode();
      if (filteredTasks === sourceTasks) {
        const result = originalSocialRenderCalendar();
        syncCalendarModeButtons();
        return result;
      }
      window.socialState.tasks = filteredTasks;
      try {
        const result = originalSocialRenderCalendar();
        syncCalendarModeButtons();
        return result;
      } finally {
        window.socialState.tasks = sourceTasks;
      }
    };
  }

  const originalSocialShowDay = typeof window.socialShowDay === "function" ? window.socialShowDay : null;
  if (originalSocialShowDay) {
    window.socialShowDay = function patchedSocialShowDay(dayKey) {
      ensureTaskStateDefaults();
      const sourceTasks = Array.isArray(window.socialState.tasks) ? window.socialState.tasks : [];
      const filteredTasks = getCalendarTaskRowsByMode();
      if (filteredTasks === sourceTasks) {
        return originalSocialShowDay(dayKey);
      }
      window.socialState.tasks = filteredTasks;
      try {
        return originalSocialShowDay(dayKey);
      } finally {
        window.socialState.tasks = sourceTasks;
      }
    };
  }

  const touchDrag = {
    taskId: 0,
    moved: false,
    sourceBucket: "",
    targetBucket: "",
    targetList: null,
    startX: 0,
    startY: 0,
    lastY: 0,
  };
  const isTouchDragEnabled = () => {
    const href = String(window.location?.href || "");
    const path = String(window.location?.pathname || "");
    const hasFinePointer = typeof window.matchMedia === "function"
      ? (window.matchMedia("(pointer:fine)").matches || window.matchMedia("(any-pointer:fine)").matches)
      : false;
    if (!hasFinePointer) return false;
    if (socialIsAppShellLike()) return false;
    if (document.body?.classList?.contains("mobile-client-mode")) return false;
    if (document.body?.classList?.contains("mobile-apk-mode")) return false;
    if (path === "/mobile") return false;
    if (/([?&])mobile_app=1(?:[&#]|$)/i.test(href)) return false;
    return true;
  };

  function clearTouchDropMarkers() {
    document.querySelectorAll(".social-task-bucket-list.is-touch-drop-target")
      .forEach((node) => node.classList.remove("is-touch-drop-target"));
  }

  function findTaskElement(taskId) {
    return document.querySelector(`.social-task-item[data-task-id="${Number(taskId || 0)}"]`);
  }

  function resetTouchDrag() {
    clearTouchDropMarkers();
    if (touchDrag.taskId) {
      findTaskElement(touchDrag.taskId)?.classList.remove("is-touch-dragging");
    }
    touchDrag.taskId = 0;
    touchDrag.moved = false;
    touchDrag.sourceBucket = "";
    touchDrag.targetBucket = "";
    touchDrag.targetList = null;
    touchDrag.startX = 0;
    touchDrag.startY = 0;
    touchDrag.lastY = 0;
  }

  function resolveDropTarget(clientX, clientY) {
    const hovered = document.elementFromPoint(clientX, clientY);
    const list = hovered?.closest?.(".social-task-bucket-list");
    if (!list) return null;
    const bucket = String(list.closest(".social-task-bucket")?.getAttribute("data-bucket") || "").trim().toLowerCase();
    if (!bucket) return null;
    return { bucket, list };
  }

  function resolveDropIndex(list, clientY, draggedTaskId) {
    if (!list) return 0;
    const items = [...list.querySelectorAll(".social-task-item")]
      .filter((node) => Number(node.getAttribute("data-task-id") || 0) !== Number(draggedTaskId || 0));
    if (!items.length) return 0;
    let index = items.length;
    for (let i = 0; i < items.length; i += 1) {
      const rect = items[i].getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) {
        index = i;
        break;
      }
    }
    return Math.max(0, index);
  }

  async function commitTouchDragDrop() {
    if (!touchDrag.taskId || !touchDrag.targetBucket) return;
    const toIndex = resolveDropIndex(touchDrag.targetList, touchDrag.lastY, touchDrag.taskId);
    const moved = await window.socialRequest("/api/social/tasks/reorder", {
      method: "POST",
      body: JSON.stringify({
        items: [
          {
            task_id: Number(touchDrag.taskId),
            bucket: String(touchDrag.targetBucket || "upcoming"),
            to_index: Number(toIndex || 0),
          },
        ],
      }),
    }).then(() => true).catch((error) => {
      if (typeof window.socialShowToast === "function") {
        window.socialShowToast(window.tr("Ошибка", "Error"), error?.message || window.tr("Не удалось перенести задачу", "Failed to move task"));
      }
      return false;
    });
    if (moved && typeof window.socialLoadTasks === "function") {
      await window.socialLoadTasks({ silent: true });
    }
  }

  function onTaskTouchStart(event) {
    if (!isTouchDragEnabled()) return;
    if (String(window.socialState?.currentSubtab || "") !== "tasks") return;
    if (!event.touches || event.touches.length !== 1) return;
    const item = event.target.closest(".social-task-item");
    if (!item) return;
    const taskId = Number(item.getAttribute("data-task-id") || 0);
    if (!taskId) return;
    const point = event.touches[0];
    touchDrag.taskId = taskId;
    touchDrag.sourceBucket = String(item.closest(".social-task-bucket")?.getAttribute("data-bucket") || "").trim().toLowerCase();
    touchDrag.startX = Number(point.clientX || 0);
    touchDrag.startY = Number(point.clientY || 0);
    touchDrag.lastY = touchDrag.startY;
    touchDrag.moved = false;
    touchDrag.targetBucket = "";
    touchDrag.targetList = null;
    item.classList.add("is-touch-dragging");
  }

  function onTaskTouchMove(event) {
    if (!isTouchDragEnabled()) return;
    if (!touchDrag.taskId) return;
    if (!event.touches || event.touches.length !== 1) return;
    const point = event.touches[0];
    const dx = Math.abs(Number(point.clientX || 0) - touchDrag.startX);
    const dy = Math.abs(Number(point.clientY || 0) - touchDrag.startY);
    touchDrag.lastY = Number(point.clientY || 0);
    if (!touchDrag.moved && (dx > 10 || dy > 10)) {
      touchDrag.moved = true;
    }
    if (!touchDrag.moved) return;
    event.preventDefault();
    const target = resolveDropTarget(Number(point.clientX || 0), Number(point.clientY || 0));
    clearTouchDropMarkers();
    if (!target) {
      touchDrag.targetBucket = "";
      touchDrag.targetList = null;
      return;
    }
    touchDrag.targetBucket = target.bucket;
    touchDrag.targetList = target.list;
    target.list.classList.add("is-touch-drop-target");
  }

  async function onTaskTouchEnd() {
    if (!isTouchDragEnabled()) return;
    if (!touchDrag.taskId) return;
    const shouldCommit = Boolean(touchDrag.moved && touchDrag.targetBucket);
    const pendingTaskId = touchDrag.taskId;
    const pendingBucket = touchDrag.targetBucket || touchDrag.sourceBucket;
    if (findTaskElement(pendingTaskId)) {
      findTaskElement(pendingTaskId)?.classList.remove("is-touch-dragging");
    }
    clearTouchDropMarkers();
    if (shouldCommit) {
      touchDrag.targetBucket = pendingBucket;
      await commitTouchDragDrop();
    }
    resetTouchDrag();
  }

  function onTaskTouchCancel() {
    if (!isTouchDragEnabled()) return;
    resetTouchDrag();
  }

  document.addEventListener("touchstart", onTaskTouchStart, { passive: true });
  document.addEventListener("touchmove", onTaskTouchMove, { passive: false });
  document.addEventListener("touchend", onTaskTouchEnd, { passive: false });
  document.addEventListener("touchcancel", onTaskTouchCancel, { passive: true });

  ensureCalendarTaskModeControls();
  syncCalendarModeButtons();
})();

(function patchSocialTaskMouseDropV2() {
  if (typeof window === "undefined") return;
  if (window.__socialDisableTaskMouseDropV2 !== false) return;
  if (window.__socialTaskMouseDropV2) return;
  window.__socialTaskMouseDropV2 = true;

  function resolveDropIndex(list, clientY, draggedTaskId) {
    if (!list) return 0;
    const items = [...list.querySelectorAll(".social-task-item")]
      .filter((node) => Number(node.getAttribute("data-task-id") || 0) !== Number(draggedTaskId || 0));
    if (!items.length) return 0;
    let index = items.length;
    for (let i = 0; i < items.length; i += 1) {
      const rect = items[i].getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) {
        index = i;
        break;
      }
    }
    return Math.max(0, index);
  }

  window.socialTaskDrop = async function socialTaskDropEnhanced(event, bucket) {
    if (socialIsAppShellLike()) {
      return;
    }
    if (event?.preventDefault) event.preventDefault();
    let id = 0;
    try {
      id = Number(event?.dataTransfer?.getData("text/plain") || 0);
    } catch (_) {
      id = 0;
    }
    if (!id) {
      const node = document.querySelector(".social-task-item.is-touch-dragging")
        || document.querySelector(".social-task-item[draggable='true'][data-dragging='1']");
      id = Number(node?.getAttribute("data-task-id") || 0);
    }
    if (!id) return;

    const safeBucket = String(bucket || "").trim().toLowerCase();
    const list = event?.target?.closest?.(".social-task-bucket-list")
      || document.querySelector(`.social-task-bucket[data-bucket="${safeBucket}"] .social-task-bucket-list`);
    const toIndex = resolveDropIndex(list, Number(event?.clientY || 0), id);

    const ok = await window.socialRequest("/api/social/tasks/reorder", {
      method: "POST",
      body: JSON.stringify({
        items: [{ task_id: id, bucket: safeBucket, to_index: toIndex }],
      }),
    }).then(() => true).catch((e) => {
      if (typeof window.socialShowToast === "function") {
        window.socialShowToast(window.tr("Ошибка", "Error"), e?.message || window.tr("Не удалось перенести задачу", "Failed to move task"));
      }
      return false;
    });

    if (!ok) return;
    if (typeof window.socialLoadTasks === "function") {
      await window.socialLoadTasks({ silent: true });
    }
  };
})();

(function patchSocialCalendarModeVisualsV1() {
  if (typeof window === "undefined") return;
  if (window.__socialDisableLegacyTaskCalendarPatches !== false) return;
  if (window.__socialCalendarModeVisualsV1) return;
  window.__socialCalendarModeVisualsV1 = true;

  function normalizeMode(mode) {
    const safe = String(mode || "").trim().toLowerCase();
    if (safe === "tasks") return "tasks";
    if (safe === "my_tasks") return "my_tasks";
    return "events";
  }

  function ensureModeStyle() {
    if (document.getElementById("socialCalendarModeVisualsV1Style")) return;
    const style = document.createElement("style");
    style.id = "socialCalendarModeVisualsV1Style";
    style.textContent = `
      #socialSubtabCalendar[data-task-mode="events"] #socialCalendarEvents .social-day-events:nth-of-type(2) { display: none; }
      #socialSubtabCalendar[data-task-mode="tasks"] #socialCalendarEvents .social-day-events:nth-of-type(1) { display: none; }
      #socialSubtabCalendar[data-task-mode="my_tasks"] #socialCalendarEvents .social-day-events:nth-of-type(1) { display: none; }
    `;
    document.head.appendChild(style);
  }

  function applyModeDataset() {
    const mode = normalizeMode(window.socialState?.calendarTaskFilter || "events");
    const root = document.getElementById("socialSubtabCalendar");
    if (root) root.setAttribute("data-task-mode", mode);
  }

  ensureModeStyle();
  applyModeDataset();

  const originalSetMode = typeof window.socialSetCalendarTaskMode === "function"
    ? window.socialSetCalendarTaskMode
    : null;
  if (originalSetMode) {
    window.socialSetCalendarTaskMode = function patchedSetCalendarTaskMode(mode) {
      const result = originalSetMode(mode);
      applyModeDataset();
      return result;
    };
  }

  const originalRenderCalendar = typeof window.socialRenderCalendar === "function"
    ? window.socialRenderCalendar
    : null;
  if (originalRenderCalendar) {
    window.socialRenderCalendar = function patchedRenderCalendarWithMode() {
      const result = originalRenderCalendar.apply(this, arguments);
      applyModeDataset();
      return result;
    };
  }
})();

(function patchSocialUiRecoveryV20260323b() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.__socialDisableUiRecoveryV20260323b !== false) return;
  if (window.__socialUiRecoveryV20260323b) return;
  window.__socialUiRecoveryV20260323b = true;

  const decodeSafe = (value) => {
    let out = String(value == null ? "" : value);
    if (!out) return "";
    try {
      if (typeof window.socialDecodeUiText === "function") {
        out = String(window.socialDecodeUiText(out) || out);
      }
    } catch (_) {}
    try {
      if (typeof window.decodePossiblyMojibake === "function") {
        out = String(window.decodePossiblyMojibake(out) || out);
      }
    } catch (_) {}
    try {
      if (typeof window.__repairMojibakeText === "function") {
        out = String(window.__repairMojibakeText(out) || out);
      }
    } catch (_) {}
    return out.replace(/\s{2,}/g, " ").trim();
  };

  const sanitizeNodeTree = (root) => {
    const target = root || document.body;
    if (!target) return;
    const textAttrs = ["title", "placeholder", "aria-label", "data-tip"];
    const walker = document.createTreeWalker(target, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, null);
    let node = walker.currentNode;
    while (node) {
      if (node.nodeType === Node.TEXT_NODE) {
        const before = String(node.nodeValue || "");
        const after = decodeSafe(before);
        if (after && after !== before) node.nodeValue = after;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        textAttrs.forEach((attr) => {
          const before = String(node.getAttribute?.(attr) || "");
          if (!before) return;
          const after = decodeSafe(before);
          if (after && after !== before) node.setAttribute(attr, after);
        });
      }
      node = walker.nextNode();
    }
  };

  const ensureCalendarUi = () => {
    const root = document.getElementById("socialSubtabCalendar");
    if (!root) return;
    root.classList.add("sw-calendar-samsung");
    const shell = root.querySelector(".social-calendar-shell") || root;
    shell.querySelectorAll("button").forEach((btn) => {
      if (btn.id === "socialCalendarFab") return;
      if (btn.classList.contains("social-day")) return;
      if (btn.classList.contains("social-day-item-button")) return;
      btn.style.setProperty("display", "none", "important");
    });
    let fab = document.getElementById("socialCalendarFab");
    if (!fab) {
      fab = document.createElement("button");
      fab.id = "socialCalendarFab";
      fab.type = "button";
      fab.className = "social-calendar-fab";
      shell.appendChild(fab);
    }
    fab.textContent = "+";
    fab.classList.remove("hidden");
    fab.onclick = () => {
      if (typeof window.socialOpenCalendarQuickAddMenu === "function") {
        window.socialOpenCalendarQuickAddMenu();
      }
    };
    const dayCount = root.querySelectorAll("#socialCalendarGrid .social-day[data-day-key]").length;
    if (!dayCount) {
      root.classList.add("sw-calendar-awaiting-data");
    } else {
      root.classList.remove("sw-calendar-awaiting-data");
    }
  };

  const ensureNotesCards = () => {
    const host = document.getElementById("socialNotesList");
    if (!host) return;
    host.querySelectorAll(".social-note-delete, [class*='note-delete'], [class*='note-remove'], [class*='note-close'], [data-action='delete'], button[onclick*='socialDeleteNote']").forEach((node) => {
      if (node?.remove) node.remove();
    });
    host.querySelectorAll(".social-note-row[data-note-id], .sw-note-card[data-note-id]").forEach((row) => {
      const noteId = Number(row.getAttribute("data-note-id") || 0);
      if (!noteId) return;
      row.onclick = () => {
        if (typeof window.socialSelectNote === "function") window.socialSelectNote(noteId);
      };
      const color = typeof window.socialGetNoteCoverColor === "function"
        ? String(window.socialGetNoteCoverColor(noteId) || "").trim()
        : "";
      if (color) row.style.setProperty("--sw-note-cover", color);
    });
  };

  const ensureNotificationCenterState = () => {
    const center = document.getElementById("socialNotificationCenter");
    if (!center) return;
    sanitizeNodeTree(center);
    if (!window.socialState?.notificationCenterOpen) {
      center.classList.add("hidden");
      center.style.display = "none";
    }
  };

  const patchFn = (name, make) => {
    const original = typeof window[name] === "function" ? window[name] : null;
    if (!original) return;
    window[name] = make(original);
  };

  patchFn("socialRenderNotificationCenter", (original) => function patchedRenderNotificationCenter() {
    const result = original.apply(this, arguments);
    ensureNotificationCenterState();
    return result;
  });

  patchFn("socialToggleNotificationCenter", (original) => async function patchedToggleNotificationCenter(forceOpen = null) {
    const result = await Promise.resolve(original.call(this, forceOpen));
    ensureNotificationCenterState();
    return result;
  });

  patchFn("socialRenderNotesList", (original) => function patchedRenderNotesList() {
    const result = original.apply(this, arguments);
    ensureNotesCards();
    sanitizeNodeTree(document.getElementById("socialSubtabNotes"));
    return result;
  });

  patchFn("socialRenderCalendar", (original) => function patchedRenderCalendar() {
    const result = original.apply(this, arguments);
    ensureCalendarUi();
    sanitizeNodeTree(document.getElementById("socialSubtabCalendar"));
    return result;
  });

  patchFn("socialLoadCalendar", (original) => async function patchedLoadCalendar() {
    const result = await Promise.resolve(original.apply(this, arguments)).catch(() => null);
    setTimeout(() => {
      ensureCalendarUi();
      sanitizeNodeTree(document.getElementById("socialSubtabCalendar"));
    }, 0);
    return result;
  });

  patchFn("switchSocialSubtab", (original) => function patchedSwitchSocialSubtab(tab, loadNow = true) {
    const result = original.call(this, tab, loadNow);
    const safeTab = String(tab || "").trim().toLowerCase();
    if (safeTab === "calendar") {
      setTimeout(() => {
        ensureCalendarUi();
        sanitizeNodeTree(document.getElementById("socialSubtabCalendar"));
      }, 80);
    }
    if (safeTab === "notes") {
      setTimeout(() => {
        ensureNotesCards();
        sanitizeNodeTree(document.getElementById("socialSubtabNotes"));
      }, 80);
    }
    return result;
  });

  patchFn("socialRenderConverterOptions", (original) => function patchedRenderConverterOptions() {
    const result = original.apply(this, arguments);
    const type = String(document.getElementById("socialConvType")?.value || "currency");
    if (type === "currency") {
      const labels = {
        RUB: window.tr("\u20bd (\u0440\u0443\u0431.)", "RUB"),
        USD: "USD",
        EUR: "EUR",
        CNY: "CNY",
        BYN: window.tr("BYN (\u0431\u0435\u043b. \u0440\u0443\u0431.)", "BYN"),
        TRY: window.tr("TRY (\u043b\u0438\u0440\u0430)", "TRY"),
        GBP: window.tr("GBP (\u0444\u0443\u043d\u0442)", "GBP"),
        UAH: window.tr("UAH (\u0433\u0440\u0438\u0432\u043d\u0430)", "UAH"),
      };
      ["socialConvFrom", "socialConvTo"].forEach((id) => {
        const node = document.getElementById(id);
        if (!node) return;
        [...node.options].forEach((opt) => {
          const code = String(opt?.value || "").trim().toUpperCase();
          if (labels[code]) opt.textContent = labels[code];
        });
      });
    }
    return result;
  });

  const deleteGroupThreadSafe = async () => {
    const row = typeof socialGetCurrentThread === "function" ? socialGetCurrentThread() : null;
    const threadId = Number(row?.id || 0);
    if (!threadId || String(row?.kind || "") !== "group") return;
    const title = String(row?.title || window.tr("\u044d\u0442\u0443 \u0433\u0440\u0443\u043f\u043f\u0443", "this group")).trim();
    const ok = confirm(window.tr(`\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u0433\u0440\u0443\u043f\u043f\u0443 "${title}"? \u042d\u0442\u043e \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u043d\u0435\u043e\u0431\u0440\u0430\u0442\u0438\u043c\u043e.`, `Delete group "${title}"? This action cannot be undone.`));
    if (!ok) return;
    const requestFn = typeof socialRequest === "function"
      ? socialRequest
      : (typeof window.socialRequest === "function" ? window.socialRequest : null);
    if (typeof requestFn !== "function") return;
    const result = await requestFn(`/api/social/chat/groups/${threadId}`, {
      method: "DELETE",
      retryOnPost: false,
      maxRetries: 0,
    }).catch((error) => {
      alert(error?.message || window.tr("\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0443\u0434\u0430\u043b\u0438\u0442\u044c \u0433\u0440\u0443\u043f\u043f\u0443", "Failed to delete group"));
      return null;
    });
    if (!result) return;
    if (typeof socialCloseThread === "function") socialCloseThread({ keepAutoSelect: false });
    if (typeof socialLoadThreads === "function") await socialLoadThreads({ silent: true });
    if (typeof socialShowToast === "function") {
      socialShowToast(window.tr("\u0413\u0440\u0443\u043f\u043f\u0430 \u0443\u0434\u0430\u043b\u0435\u043d\u0430", "Group deleted"), window.tr("\u0427\u0430\u0442 \u0443\u0434\u0430\u043b\u0435\u043d \u0438\u0437 \u0441\u043f\u0438\u0441\u043a\u0430.", "The chat was removed from the list."));
    }
  };

  window.socialDeleteCurrentGroupThreadLegacyMojibake = deleteGroupThreadSafe;
  window.socialDeleteCurrentGroupThread = deleteGroupThreadSafe;

  setTimeout(() => {
    ensureCalendarUi();
    ensureNotesCards();
    ensureNotificationCenterState();
    sanitizeNodeTree(document.body);
  }, 0);
})();

(function patchSocialUiTextFixesV1() {
  if (typeof window === "undefined") return;
  if (window.__socialDisableUiTextFixesV1 !== false) return;
  if (window.__socialUiTextFixesV1) return;
  window.__socialUiTextFixesV1 = true;

  function decodeSafe(value) {
    let out = String(value == null ? "" : value);
    if (!out) return "";
    for (let i = 0; i < 4; i += 1) {
      try {
        if (typeof window.__repairMojibakeText === "function") {
          out = String(window.__repairMojibakeText(out) || out);
        }
      } catch (_) {}
      try {
        if (typeof window.decodePossiblyMojibake === "function") {
          out = String(window.decodePossiblyMojibake(out) || out);
        }
      } catch (_) {}
      out = out
        .replace(/(?:\b[\u0420\u0421\u0412\u00d0\u00d1]\b(?:\s|\u00A0)+){3,}\b[\u0420\u0421\u0412\u00d0\u00d1]\b/g, (seq) => seq.replace(/[\s\u00A0]+/g, ""))
        .replace(/([\u0420\u0421\u0412\u00d0\u00d1])(?:\s|\u00A0)+(?=[\u0420\u0421\u0412\u00d0\u00d1])/g, "$1")
        .replace(/\s{2,}/g, " ")
        .trim();
    }
    return out;
  }

  const originalResolve = typeof window.socialResolveNotificationText === "function"
    ? window.socialResolveNotificationText
    : null;
  if (originalResolve) {
    window.socialResolveNotificationText = function patchedResolveNotificationText(row) {
      const result = originalResolve.call(this, row) || {};
      return {
        ...result,
        title: decodeSafe(result.title || ""),
        body: decodeSafe(result.body || ""),
      };
    };
  }

  const originalRenderConv = typeof window.socialRenderConverterOptions === "function"
    ? window.socialRenderConverterOptions
    : null;
  if (originalRenderConv) {
    window.socialRenderConverterOptions = function patchedRenderConverterOptions() {
      const result = originalRenderConv.apply(this, arguments);
      const type = String(document.getElementById("socialConvType")?.value || "currency");
      if (type !== "currency") return result;
      const from = document.getElementById("socialConvFrom");
      const to = document.getElementById("socialConvTo");
      const labels = {
        RUB: window.tr("RUB (руб.)", "RUB"),
        USD: "USD",
        EUR: "EUR",
        CNY: "CNY",
        BYN: window.tr("BYN (бел. руб.)", "BYN (BYN)"),
        TRY: window.tr("TRY (лира)", "TRY (Lira)"),
        GBP: window.tr("GBP (фунт)", "GBP (Pound)"),
        UAH: window.tr("UAH (гривна)", "UAH (Hryvnia)"),
      };
      [from, to].forEach((node) => {
        if (!node) return;
        [...node.options].forEach((opt) => {
          const code = String(opt?.value || "").trim().toUpperCase();
          if (!code) return;
          if (labels[code]) opt.textContent = labels[code];
        });
      });
      return result;
    };
  }
})();

(function patchSocialCurrencyLabelsV2() {
  if (typeof window === "undefined") return;
  if (window.__socialDisableCurrencyPatchV2 !== false) return;
  if (window.__socialCurrencyLabelsV2) return;
  window.__socialCurrencyLabelsV2 = true;

  const originalRenderConv = typeof window.socialRenderConverterOptions === "function"
    ? window.socialRenderConverterOptions
    : null;
  if (!originalRenderConv) return;

  window.socialRenderConverterOptions = function patchedRenderConverterOptionsV2() {
    const result = originalRenderConv.apply(this, arguments);
    const type = String(document.getElementById("socialConvType")?.value || "currency");
    if (type !== "currency") return result;
    const labels = {
      RUB: window.tr("RUB (руб.)", "RUB"),
      USD: "USD",
      EUR: "EUR",
      CNY: "CNY",
      BYN: window.tr("BYN (бел. руб.)", "BYN (BYN)"),
      TRY: window.tr("TRY (лира)", "TRY (Lira)"),
      GBP: window.tr("GBP (фунт)", "GBP (Pound)"),
      UAH: window.tr("UAH (гривна)", "UAH (Hryvnia)"),
    };
    ["socialConvFrom", "socialConvTo"].forEach((id) => {
      const node = document.getElementById(id);
      if (!node) return;
      [...node.options].forEach((opt) => {
        const code = String(opt?.value || "").trim().toUpperCase();
        if (labels[code]) opt.textContent = labels[code];
      });
    });
    return result;
  };
})();

(function patchSocialTaskGlyphsV1() {
  if (typeof window === "undefined") return;
  if (window.__socialDisableTaskGlyphPatchV1 !== false) return;
  if (window.__socialTaskGlyphsV1) return;
  window.__socialTaskGlyphsV1 = true;

  function normalizeTaskButtons() {
    const host = document.getElementById("socialTasksBoard");
    if (!host) return;
    host.querySelectorAll(".social-task-check").forEach((btn) => {
      const done = btn.classList.contains("is-done");
      btn.textContent = done ? "\u2713" : "";
      const title = String(btn.getAttribute("title") || "");
      if (!title || /[?]{3,}|[\u0420\u0421\u0412\u00d0\u00d1]/.test(title)) {
        btn.setAttribute("title", window.tr ? window.tr("Отметить выполненной", "Mark done") : "Mark done");
      }
    });
    host.querySelectorAll(".social-task-delete").forEach((btn) => {
      btn.textContent = "\u2715";
      const title = String(btn.getAttribute("title") || "");
      if (!title || /[?]{3,}|[\u0420\u0421\u0412\u00d0\u00d1]/.test(title)) {
        btn.setAttribute("title", window.tr ? window.tr("Удалить", "Delete") : "Delete");
      }
    });
    host.querySelectorAll(".social-task-pending").forEach((node) => {
      const text = String(node.textContent || "");
      if (!text || /[?]{3,}|[\u0420\u0421\u0412\u00d0\u00d1]/.test(text)) {
        node.textContent = window.tr ? window.tr("5с: повторный клик отменит", "5s: click again to undo") : "5s: click again to undo";
      }
    });
  }

  const originalRenderTasks = typeof window.socialRenderTasks === "function" ? window.socialRenderTasks : null;
  if (originalRenderTasks) {
    window.socialRenderTasks = function patchedRenderTasksWithGlyphs() {
      const result = originalRenderTasks.apply(this, arguments);
      normalizeTaskButtons();
      return result;
    };
  }

  const originalLoadTasks = typeof window.socialLoadTasks === "function" ? window.socialLoadTasks : null;
  if (originalLoadTasks) {
    window.socialLoadTasks = async function patchedLoadTasksWithGlyphs() {
      const result = await Promise.resolve(originalLoadTasks.apply(this, arguments));
      normalizeTaskButtons();
      return result;
    };
  }
})();

(function patchSocialHardeningV20260323() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.__socialDisableHardeningV20260323 !== false) return;
  if (window.__socialHardeningV20260323) return;
  window.__socialHardeningV20260323 = true;

  const decodeSafe = (value) => {
    let out = String(value == null ? "" : value);
    if (!out) return "";
    try {
      if (typeof window.socialDecodeUiText === "function") {
        out = String(window.socialDecodeUiText(out) || out);
      }
    } catch (_) {}
    try {
      if (typeof window.decodePossiblyMojibake === "function") {
        out = String(window.decodePossiblyMojibake(out) || out);
      }
    } catch (_) {}
    try {
      if (typeof window.__repairMojibakeText === "function") {
        out = String(window.__repairMojibakeText(out) || out);
      }
    } catch (_) {}
    return out.replace(/\s{2,}/g, " ").trim();
  };

  const ensureNotificationCenterPosition = () => {
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
  };

  const originalRenderCenter = typeof window.socialRenderNotificationCenter === "function"
    ? window.socialRenderNotificationCenter
    : null;
  if (originalRenderCenter) {
    window.socialRenderNotificationCenter = function patchedRenderNotificationCenter(rows = null) {
      const result = originalRenderCenter.call(this, rows);
      const center = ensureNotificationCenterPosition();
      if (!center) return result;
      center.querySelectorAll(".social-notif-item b, .social-notif-item p").forEach((node) => {
        const before = String(node.textContent || "");
        const after = decodeSafe(before);
        if (after && after !== before) node.textContent = after;
      });
      return result;
    };
  }

  const originalToggleCenter = typeof window.socialToggleNotificationCenter === "function"
    ? window.socialToggleNotificationCenter
    : null;
  if (originalToggleCenter) {
    window.socialToggleNotificationCenter = async function patchedToggleNotificationCenter(forceOpen = null) {
      const opened = await Promise.resolve(originalToggleCenter.call(this, forceOpen));
      const center = ensureNotificationCenterPosition();
      if (!center) return opened;
      if (opened) {
        center.classList.remove("hidden");
        center.style.display = "flex";
      } else {
        center.classList.add("hidden");
        center.style.display = "none";
      }
      return opened;
    };
  }

  const originalRenderThreads = typeof window.socialRenderThreads === "function"
    ? window.socialRenderThreads
    : null;
  if (originalRenderThreads) {
    window.socialRenderThreads = function patchedRenderThreads() {
      const result = originalRenderThreads.apply(this, arguments);
      const host = document.getElementById("socialChatThreads");
      if (host) {
        host.querySelectorAll(".social-thread-preview").forEach((node) => {
          const before = String(node.textContent || "");
          const after = decodeSafe(before);
          if (after && after !== before) node.textContent = after;
        });
      }
      return result;
    };
  }

  const originalAnnouncementModal = typeof window.socialOpenAnnouncementModal === "function"
    ? window.socialOpenAnnouncementModal
    : null;
  if (originalAnnouncementModal) {
    window.socialOpenAnnouncementModal = function patchedOpenAnnouncementModal(row) {
      const payload = row && typeof row === "object"
        ? {
            ...row,
            title: decodeSafe(row.title || ""),
            body: decodeSafe(row.body || ""),
          }
        : row;
      return originalAnnouncementModal.call(this, payload);
    };
  }

  const originalNotifyDesktop = typeof window.socialNotifyDesktop === "function"
    ? window.socialNotifyDesktop
    : null;
  if (originalNotifyDesktop) {
    window.socialNotifyDesktop = function patchedNotifyDesktop(row) {
      const payload = row && typeof row === "object"
        ? {
            ...row,
            title: decodeSafe(row.title || ""),
            body: decodeSafe(row.body || ""),
          }
        : row;
      return originalNotifyDesktop.call(this, payload);
    };
  }

  const buildFallbackCalendarGrid = () => {
    const root = document.getElementById("socialSubtabCalendar");
    if (!root) return;
    try {
      if (typeof window.socialNormalizeCalendarChrome === "function") {
        window.socialNormalizeCalendarChrome();
      }
    } catch (_) {}
    const shell = root.querySelector(".social-calendar-shell") || root;
    let grid = document.getElementById("socialCalendarGrid");
    if (!grid) {
      grid = document.createElement("div");
      grid.id = "socialCalendarGrid";
      grid.className = "social-calendar-grid social-calendar-grid--samsung";
      shell.appendChild(grid);
    }
    const monthLabel = document.getElementById("socialCalendarMonthLabel");
    const baseDate = (window.socialState && window.socialState.calendarDate instanceof Date && !Number.isNaN(window.socialState.calendarDate.getTime()))
      ? window.socialState.calendarDate
      : new Date();
    const year = baseDate.getFullYear();
    const month = baseDate.getMonth();
    const firstDay = new Date(year, month, 1, 0, 0, 0, 0);
    const lastDay = new Date(year, month + 1, 0, 0, 0, 0, 0);
    const shift = (firstDay.getDay() + 6) % 7;
    const days = Number(lastDay.getDate() || 0);
    if (monthLabel && typeof window.socialCalendarMonthLabel === "function") {
      monthLabel.textContent = window.socialCalendarMonthLabel(baseDate);
    }
    let html = `<div class="social-calendar-row head">${[(window.tr ? window.tr("Пн", "Mon") : "Mon"), (window.tr ? window.tr("Вт", "Tue") : "Tue"), (window.tr ? window.tr("Ср", "Wed") : "Wed"), (window.tr ? window.tr("Чт", "Thu") : "Thu"), (window.tr ? window.tr("Пт", "Fri") : "Fri"), (window.tr ? window.tr("Сб", "Sat") : "Sat"), (window.tr ? window.tr("Вс", "Sun") : "Sun")].map((x) => `<span>${x}</span>`).join("")}</div><div class="social-calendar-cells">`;
    for (let i = 0; i < shift; i += 1) html += `<button class="social-day muted" disabled></button>`;
    for (let day = 1; day <= days; day += 1) {
      const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      html += `<button class="social-day rich" data-day-key="${key}" type="button" onclick="socialShowDay('${key}')"><div class="social-day-head"><b>${day}</b></div><div class="social-day-preview-stack"></div></button>`;
    }
    html += `</div>`;
    grid.innerHTML = html;
  };

  const ensureCalendarUi = () => {
    const root = document.getElementById("socialSubtabCalendar");
    if (!root) return;
    const grid = document.getElementById("socialCalendarGrid");
    const dayCount = grid ? grid.querySelectorAll(".social-day[data-day-key]").length : 0;
    if (dayCount === 0) buildFallbackCalendarGrid();
    const shell = root.querySelector(".social-calendar-shell") || root;
    let fab = document.getElementById("socialCalendarFab");
    if (!fab) {
      fab = document.createElement("button");
      fab.id = "socialCalendarFab";
      fab.type = "button";
      fab.className = "social-calendar-fab";
      shell.appendChild(fab);
    }
    fab.textContent = "+";
    fab.classList.remove("hidden");
    fab.onclick = () => {
      if (typeof window.socialOpenCalendarQuickAddMenu === "function") {
        window.socialOpenCalendarQuickAddMenu();
      }
    };
    root.querySelectorAll("button").forEach((btn) => {
      if (btn.id === "socialCalendarFab") return;
      if (btn.classList.contains("social-day")) return;
      if (btn.classList.contains("social-day-item-button")) return;
      btn.style.setProperty("display", "none", "important");
    });
  };

  const originalRenderCalendar = typeof window.socialRenderCalendar === "function"
    ? window.socialRenderCalendar
    : null;
  if (originalRenderCalendar) {
    window.socialRenderCalendar = function patchedRenderCalendar() {
      try {
        const result = originalRenderCalendar.apply(this, arguments);
        ensureCalendarUi();
        return result;
      } catch (_) {
        buildFallbackCalendarGrid();
        ensureCalendarUi();
        return null;
      }
    };
  }

  const originalLoadCalendar = typeof window.socialLoadCalendar === "function"
    ? window.socialLoadCalendar
    : null;
  if (originalLoadCalendar) {
    window.socialLoadCalendar = async function patchedLoadCalendar() {
      let result = null;
      try {
        result = await Promise.resolve(originalLoadCalendar.apply(this, arguments));
      } catch (_) {
        result = null;
      }
      setTimeout(() => ensureCalendarUi(), 0);
      return result;
    };
  }

  const originalSwitchSocialSubtab = typeof window.switchSocialSubtab === "function"
    ? window.switchSocialSubtab
    : null;
  if (originalSwitchSocialSubtab) {
    window.switchSocialSubtab = function patchedSwitchSocialSubtab(tab, loadNow = true) {
      const result = originalSwitchSocialSubtab.call(this, tab, loadNow);
      if (String(tab || "").trim().toLowerCase() === "calendar") {
        setTimeout(() => {
          try {
            ensureCalendarUi();
            const dayCount = document.querySelectorAll("#socialCalendarGrid .social-day[data-day-key]").length;
            if (!dayCount && typeof window.socialRenderCalendar === "function") {
              window.socialRenderCalendar();
            }
          } catch (_) {}
        }, 60);
        setTimeout(() => {
          try { ensureCalendarUi(); } catch (_) {}
        }, 220);
      }
      return result;
    };
  }

  const originalRenderNotesList = typeof window.socialRenderNotesList === "function"
    ? window.socialRenderNotesList
    : null;
  if (originalRenderNotesList) {
    window.socialRenderNotesList = function patchedRenderNotesList() {
      const result = originalRenderNotesList.apply(this, arguments);
      const host = document.getElementById("socialNotesList");
      if (!host) return result;
      host.querySelectorAll(".social-note-delete, [class*='note-delete'], [data-action='delete'], button[onclick*='socialDeleteNote']").forEach((node) => {
        if (node?.remove) node.remove();
      });
      host.querySelectorAll(".social-note-row[data-note-id]").forEach((row) => {
        const id = Number(row.getAttribute("data-note-id") || 0);
        if (id <= 0) return;
        row.onclick = () => {
          if (typeof window.socialSelectNote === "function") window.socialSelectNote(id);
        };
        const color = typeof window.socialGetNoteCoverColor === "function"
          ? String(window.socialGetNoteCoverColor(id) || "").trim()
          : "";
        if (color) row.style.setProperty("--sw-note-cover", color);
      });
      return result;
    };
  }
})();

(function patchSocialUiFinalV20260323c() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.__socialDisableUiFinalV20260323c !== false) return;
  if (window.__socialUiFinalV20260323c) return;
  window.__socialUiFinalV20260323c = true;

  const decodeSafe = (value) => {
    let out = String(value == null ? "" : value);
    if (!out) return "";
    try {
      if (typeof window.socialDecodeUiText === "function") out = String(window.socialDecodeUiText(out) || out);
    } catch (_) {}
    try {
      if (typeof window.decodePossiblyMojibake === "function") out = String(window.decodePossiblyMojibake(out) || out);
    } catch (_) {}
    try {
      if (typeof window.__repairMojibakeText === "function") out = String(window.__repairMojibakeText(out) || out);
    } catch (_) {}
    return out.replace(/\s{2,}/g, " ").trim();
  };

  const sanitizeTree = (root) => {
    const target = root || document.body;
    if (!target) return;
    const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT, null);
    let node = walker.currentNode;
    while (node) {
      const before = String(node.nodeValue || "");
      const after = decodeSafe(before);
      if (after && after !== before) node.nodeValue = after;
      node = walker.nextNode();
    }
  };

  const ensureCalendarUi = () => {
    const root = document.getElementById("socialSubtabCalendar");
    if (!root) return;
    root.classList.add("sw-calendar-samsung");
    const shell = root.querySelector(".social-calendar-shell") || root;
    shell.querySelectorAll("button").forEach((btn) => {
      if (btn.id === "socialCalendarFab") return;
      if (btn.classList.contains("social-day")) return;
      if (btn.classList.contains("social-day-item-button")) return;
      btn.style.setProperty("display", "none", "important");
    });
    const dayCount = root.querySelectorAll("#socialCalendarGrid .social-day[data-day-key]").length;
    if (!dayCount) {
      root.classList.add("sw-calendar-awaiting-data");
    } else {
      root.classList.remove("sw-calendar-awaiting-data");
    }
  };

  const ensureNotesUi = () => {
    const host = document.getElementById("socialNotesList");
    if (!host) return;
    host.querySelectorAll(".social-note-delete, [class*='note-delete'], [class*='note-remove'], [class*='note-close'], [data-action='delete'], button[onclick*='socialDeleteNote']").forEach((node) => {
      if (node?.remove) node.remove();
    });
    host.querySelectorAll(".social-note-row[data-note-id], .sw-note-card[data-note-id]").forEach((row) => {
      const id = Number(row.getAttribute("data-note-id") || 0);
      if (!id) return;
      row.onclick = () => {
        if (typeof window.socialSelectNote === "function") window.socialSelectNote(id);
      };
    });
  };

  const ensureNotificationCenter = () => {
    const center = document.getElementById("socialNotificationCenter");
    if (!center) return;
    sanitizeTree(center);
    if (!window.socialState?.notificationCenterOpen) {
      center.classList.add("hidden");
      center.style.display = "none";
    }
  };

  const bindBellButtons = () => {
    ["socialBellBtn", "mobileDrawerBellBtn"].forEach((id) => {
      const btn = document.getElementById(id);
      if (!btn || btn.dataset.finalBellBind === "1") return;
      btn.dataset.finalBellBind = "1";
      btn.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (typeof window.socialToggleNotificationCenter === "function") {
          await window.socialToggleNotificationCenter();
        }
      });
    });
  };

  const patchFn = (name, make) => {
    const original = typeof window[name] === "function" ? window[name] : null;
    if (!original) return;
    window[name] = make(original);
  };

  patchFn("socialRenderConverterOptions", (original) => function patchedRenderConverterOptionsFinal() {
    const result = original.apply(this, arguments);
    const type = String(document.getElementById("socialConvType")?.value || "currency");
    if (type !== "currency") return result;
    const labels = {
      RUB: window.tr("\u20bd (\u0440\u0443\u0431.)", "RUB"),
      USD: "USD",
      EUR: "EUR",
      CNY: "CNY",
      BYN: window.tr("BYN (\u0431\u0435\u043b. \u0440\u0443\u0431.)", "BYN"),
      TRY: window.tr("TRY (\u043b\u0438\u0440\u0430)", "TRY"),
      GBP: window.tr("GBP (\u0444\u0443\u043d\u0442)", "GBP"),
      UAH: window.tr("UAH (\u0433\u0440\u0438\u0432\u043d\u0430)", "UAH"),
    };
    ["socialConvFrom", "socialConvTo"].forEach((id) => {
      const node = document.getElementById(id);
      if (!node) return;
      [...node.options].forEach((opt) => {
        const code = String(opt?.value || "").trim().toUpperCase();
        if (labels[code]) opt.textContent = labels[code];
      });
    });
    return result;
  });

  const normalizeTaskButtons = () => {
    const host = document.getElementById("socialTasksBoard");
    if (!host) return;
    host.querySelectorAll(".social-task-check").forEach((btn) => {
      const done = btn.classList.contains("is-done");
      btn.textContent = done ? "\u2713" : "";
      btn.setAttribute("title", window.tr("\u041e\u0442\u043c\u0435\u0442\u0438\u0442\u044c \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043d\u043e\u0439", "Mark done"));
    });
    host.querySelectorAll(".social-task-delete").forEach((btn) => {
      btn.textContent = "\u2715";
      btn.setAttribute("title", window.tr("\u0423\u0434\u0430\u043b\u0438\u0442\u044c", "Delete"));
    });
    host.querySelectorAll(".social-task-pending").forEach((node) => {
      const before = String(node.textContent || "");
      if (!before || /[?]{3,}|[\u0420\u0421\u0412\u00d0\u00d1]/.test(before)) {
        node.textContent = window.tr("5\u0441: \u043f\u043e\u0432\u0442\u043e\u0440\u043d\u044b\u0439 \u043a\u043b\u0438\u043a \u043e\u0442\u043c\u0435\u043d\u0438\u0442", "5s: click again to undo");
      }
    });
  };

  patchFn("socialRenderTasks", (original) => function patchedRenderTasksFinal() {
    const result = original.apply(this, arguments);
    normalizeTaskButtons();
    sanitizeTree(document.getElementById("socialSubtabTasks"));
    return result;
  });
  patchFn("socialLoadTasks", (original) => async function patchedLoadTasksFinal() {
    const result = await Promise.resolve(original.apply(this, arguments));
    normalizeTaskButtons();
    sanitizeTree(document.getElementById("socialSubtabTasks"));
    return result;
  });

  const deleteGroupSafe = async () => {
    const row = typeof socialGetCurrentThread === "function" ? socialGetCurrentThread() : null;
    const threadId = Number(row?.id || 0);
    if (!threadId || String(row?.kind || "") !== "group") return;
    const title = String(row?.title || window.tr("\u044d\u0442\u0443 \u0433\u0440\u0443\u043f\u043f\u0443", "this group")).trim();
    const ok = confirm(window.tr(`\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u0433\u0440\u0443\u043f\u043f\u0443 "${title}"? \u042d\u0442\u043e \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u043d\u0435\u043e\u0431\u0440\u0430\u0442\u0438\u043c\u043e.`, `Delete group "${title}"? This action cannot be undone.`));
    if (!ok) return;
    const requestFn = typeof socialRequest === "function"
      ? socialRequest
      : (typeof window.socialRequest === "function" ? window.socialRequest : null);
    if (!requestFn) return;
    const result = await requestFn(`/api/social/chat/groups/${threadId}`, {
      method: "DELETE",
      retryOnPost: false,
      maxRetries: 0,
    }).catch((error) => {
      alert(error?.message || window.tr("\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0443\u0434\u0430\u043b\u0438\u0442\u044c \u0433\u0440\u0443\u043f\u043f\u0443", "Failed to delete group"));
      return null;
    });
    if (!result) return;
    if (typeof socialCloseThread === "function") socialCloseThread({ keepAutoSelect: false });
    if (typeof socialLoadThreads === "function") await socialLoadThreads({ silent: true });
    if (typeof socialShowToast === "function") {
      socialShowToast(window.tr("\u0413\u0440\u0443\u043f\u043f\u0430 \u0443\u0434\u0430\u043b\u0435\u043d\u0430", "Group deleted"), window.tr("\u0427\u0430\u0442 \u0443\u0434\u0430\u043b\u0435\u043d \u0438\u0437 \u0441\u043f\u0438\u0441\u043a\u0430.", "The chat was removed from the list."));
    }
  };
  window.socialDeleteCurrentGroupThreadLegacyMojibake = deleteGroupSafe;
  window.socialDeleteCurrentGroupThread = deleteGroupSafe;

  patchFn("socialRenderNotificationCenter", (original) => function patchedRenderNotificationCenterFinal() {
    const result = original.apply(this, arguments);
    ensureNotificationCenter();
    return result;
  });
  patchFn("socialToggleNotificationCenter", (original) => async function patchedToggleNotificationCenterFinal(forceOpen = null) {
    const result = await Promise.resolve(original.call(this, forceOpen));
    ensureNotificationCenter();
    return result;
  });
  patchFn("socialRenderCalendar", (original) => function patchedRenderCalendarFinal() {
    const result = original.apply(this, arguments);
    ensureCalendarUi();
    sanitizeTree(document.getElementById("socialSubtabCalendar"));
    return result;
  });
  patchFn("socialRenderNotesList", (original) => function patchedRenderNotesListFinal() {
    const result = original.apply(this, arguments);
    ensureNotesUi();
    sanitizeTree(document.getElementById("socialSubtabNotes"));
    return result;
  });

  setTimeout(() => {
    ensureCalendarUi();
    ensureNotesUi();
    ensureNotificationCenter();
    bindBellButtons();
    sanitizeTree(document.body);
  }, 0);
})();
