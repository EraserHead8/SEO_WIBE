function sanitizeToken(raw) {
  let value = String(raw || "").trim();
  if (!value || value === "null" || value === "undefined") return "";
  if (value.toLowerCase().startsWith("bearer ")) {
    value = value.slice(7).trim();
  }
  if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1).trim();
  }
  if (!value || !value.includes(".") || value.split(".").length < 3) return "";
  return value;
}

function decodeJwtPayload(tokenValue) {
  try {
    const tokenParts = String(tokenValue || "").split(".");
    if (tokenParts.length < 2) return null;
    const raw = tokenParts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = raw + "=".repeat((4 - (raw.length % 4)) % 4);
    const json = atob(padded);
    return JSON.parse(json);
  } catch (_) {
    return null;
  }
}

function isTokenExpired(tokenValue, skewSec = 45) {
  const payload = decodeJwtPayload(tokenValue);
  if (!payload || !payload.exp) return false;
  let expSec = 0;
  if (typeof payload.exp === "number") {
    expSec = payload.exp;
  } else if (typeof payload.exp === "string") {
    const parsed = Date.parse(payload.exp);
    if (!Number.isNaN(parsed)) expSec = Math.floor(parsed / 1000);
  }
  if (!expSec) return false;
  const nowSec = Math.floor(Date.now() / 1000);
  return (expSec - Math.max(0, Number(skewSec) || 0)) <= nowSec;
}

const storedSessionToken = sanitizeToken(sessionStorage.getItem("token") || "");
const storedLocalToken = sanitizeToken(localStorage.getItem("token") || "");
const storedShadowToken = sanitizeToken(localStorage.getItem("token_shadow") || "");
let token = storedSessionToken || storedLocalToken || storedShadowToken || "";
let tokenStorage = storedSessionToken
  ? "session"
  : (storedLocalToken || storedShadowToken ? "local" : "");
let forceCookieAuth = false;
let modulesLoaded = false;
let lastModulesLoadAt = 0;
let appUiBootstrapped = false;
let lastUiSettingsLoadAt = 0;
if (token && !storedSessionToken && !storedLocalToken) {
  localStorage.setItem("token", token);
  tokenStorage = "local";
}
let suppressAlerts = false;
let me = null;
let authRetryCount = 0;
let lastAuthSuccessAt = Number(sessionStorage.getItem("last_auth_ok_at") || 0);
let ensureAuthPromise = null;
let selectedProducts = new Set();
let selectedJobs = new Set();
let currentProducts = [];
let currentJobs = [];
let productPage = 1;
let productPageSize = 30;
let productTotal = 0;
let productTotalPages = 0;
let productCategoryLoadMeta = null;
let productCategoryRefreshTimer = null;
const PRODUCT_PAGE_SIZE_OPTIONS = [30, 50, 100, 200, 500, 1000];
let selectedProductId = null;
let selectedProductDetails = null;
let activeProductViewId = 0;
let activeProductEditId = 0;
let activeProductViewIsRefreshing = false;
let productEditPhotoOrder = [];
let productEditDragIndex = -1;
const PRODUCT_DETAILS_CACHE_TTL_MS = 3 * 60 * 1000;
const productDetailsCache = new Map();
let autoKeywordProductId = null;
let enabledModules = new Set();
let wbReviewRows = [];
const wbReviewDrafts = new Map();
let currentReviewMarketplace = "wb";
let lastAutoReplyDryRun = null;
const feedbackInFlight = {
  reviewGenerate: new Set(),
  reviewSend: new Set(),
  questionGenerate: new Set(),
  questionSend: new Set(),
};
let reviewBackgroundReloadTimer = null;
let wbQuestionRows = [];
const wbQuestionDrafts = new Map();
let currentQuestionMarketplace = "wb";
let questionBackgroundReloadTimer = null;
const feedbackPromptVisibility = {
  review: localStorage.getItem("review_prompt_visible") === "1",
  question: localStorage.getItem("question_prompt_visible") === "1",
};
let returnsRows = [];
let currentReturnsMarketplace = "wb";
let reviewLoadProgress = { active: false, total: 0, loaded: 0 };
let questionLoadProgress = { active: false, total: 0, loaded: 0 };
let reviewLoadToken = 0;
let questionLoadToken = 0;
let wbCampaignRows = [];
let selectedWbCampaignId = "";
const wbCampaignDetailCache = new Map();
let campaignDetailRefreshTimer = null;
let campaignDetailRefreshKey = "";
let campaignDetailRefreshAttempts = 0;
let wbAdsBalanceData = null;
let currentCampaignDetailId = 0;
let wbAdsLoadProgress = { active: false, total: 0, loaded: 0, failed: 0 };
let wbAdsLoadToken = 0;
let wbAdsLoadInflight = null;
let wbAdsEnrichSignature = "";
let wbAdsEnrichSignatureAt = 0;
let adsAnalyticsRows = [];
let adsAnalyticsMeta = {};
let adsAnalyticsRefreshTimer = null;
let adsAnalyticsRefreshSignature = "";
let adsAnalyticsRefreshAttempts = 0;
let adsRecommendationRows = [];
let adsRecLoadProgress = { active: false, total: 0, loaded: 0 };
let adsRecLoadToken = 0;
let wbBidderRules = [];
let wbBidderRuns = [];
let salesRows = [];
let salesChartRows = [];
let salesCompareRows = [];
let salesCompareChartRows = [];
let salesTotalsData = {};
let salesComparisonData = {};
let salesCompareLabel = "";
let salesCurrentLabel = "";
let salesLoadProgress = { active: false, total: 0, loaded: 0 };
let salesLoadState = "idle";
let salesLoadToken = 0;
let salesLoadInflightKey = "";
let salesLastRequestSignature = "";
let salesLastLoadedAt = 0;
let salesAutoLoadTimer = null;
let salesLiveRefreshTimer = null;
let salesBootstrapRetryTimer = null;
let accountingOverview = null;
let accountingChartRows = [];
let accountingAnalysisRows = [];
let accountingWarnings = [];
let accountingExpensesRows = [];
let accountingSettingsState = null;
let accountingLoadToken = 0;
let accountingSortMode = "net_profit_desc";
let teamMembers = [];
let activeTeamMemberId = 0;
let teamModalMode = "edit";
let profileAiState = null;
let activeProfileSectionId = "";
let pendingProfileActorFocus = false;
const profileSectionNodes = new Map();
let reviewPhotoItems = [];
let reviewPhotoIndex = 0;
let helpDocsRows = [];
let helpReleaseRows = [];
let helpAssistantHistory = [];
const DEFAULT_AVATARS = Array.from({ length: 8 }, (_, i) => `/static/avatars/avatar-${String(i + 1).padStart(2, "0")}.svg`);
const GROUP_AVATARS = Array.from({ length: 8 }, (_, i) => `/static/avatars/group-${String(i + 1).padStart(2, "0")}.svg`);
let currentLang = (localStorage.getItem("ui_lang") || "ru").toLowerCase() === "en" ? "en" : "ru";
let currentTheme = (localStorage.getItem("ui_theme") || "classic").toLowerCase();
function isLikelyNativeMobileShell() {
  try {
    if (typeof window.ReactNativeWebView !== "undefined") return true;
    const ua = String(navigator.userAgent || "").toLowerCase();
    if (/\bwv\b/.test(ua) || ua.includes("android")) return true;
    if (typeof navigator.standalone !== "undefined" && navigator.standalone) return true;
    if (typeof window.matchMedia === "function" && window.matchMedia("(display-mode: standalone)").matches) return true;
    const viewportWidth = Math.max(window.innerWidth || 0, document.documentElement?.clientWidth || 0);
    const touchPoints = Math.max(0, Number(navigator.maxTouchPoints || 0));
    const coarsePointer = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
    if (viewportWidth > 0 && viewportWidth <= 980 && (touchPoints > 0 || coarsePointer)) return true;
  } catch (_) {}
  return false;
}
const mobileClientMode = (() => {
  try {
    const url = new URL(window.location.href);
    return window.location.pathname === "/mobile"
      || url.searchParams.get("mobile_app") === "1"
      || isLikelyNativeMobileShell();
  } catch (_) {
    return String(window.location.pathname || "").trim() === "/mobile" || isLikelyNativeMobileShell();
  }
})();
const mobileApkMode = (() => {
  try {
    const url = new URL(window.location.href);
    return url.searchParams.get("mobile_app") === "1" || isLikelyNativeMobileShell();
  } catch (_) {
    return isLikelyNativeMobileShell();
  }
})();
function shouldForceMobileCalendarStart() {
  try {
    if (mobileClientMode || mobileApkMode) return true;
    const body = document.body;
    if (body?.classList?.contains("mobile-client-mode") || body?.classList?.contains("mobile-apk-mode")) return true;
    const viewportWidth = Math.max(window.innerWidth || 0, document.documentElement?.clientWidth || 0);
    const touchPoints = Math.max(0, Number(navigator.maxTouchPoints || 0));
    const coarsePointer = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
    return viewportWidth > 0 && viewportWidth <= 980 && (touchPoints > 0 || coarsePointer);
  } catch (_) {
    return Boolean(mobileClientMode || mobileApkMode);
  }
}

function applyMobileCalendarStartupRoute(delayMs = 0) {
  if (!shouldForceMobileCalendarStart()) return;
  const run = () => {
    currentSocialSubtab = "calendar";
    try {
      sessionStorage.setItem("seo_wibe_last_tab", "social");
      sessionStorage.setItem("seo_wibe_last_social_subtab", "calendar");
    } catch (_) {}
    const appSection = document.getElementById("appSection");
    if (!appSection || appSection.classList.contains("hidden")) return;
    const socialBtn = document.querySelector(".nav-btn[data-tab='social']");
    if (!socialBtn) return;
    try {
      showTab("social", socialBtn);
    } catch (_) {}
    if (typeof switchSocialSubtab === "function") {
      setTimeout(() => {
        try { switchSocialSubtab("calendar", true); } catch (_) {}
      }, 80);
    }
  };
  if (delayMs > 0) {
    setTimeout(run, Math.max(0, Number(delayMs) || 0));
    return;
  }
  run();
}
let sidebarCompact = localStorage.getItem("sidebar_compact") === "1";
let authMode = "login";
let uiThemeSettings = {
  theme_choice_enabled: true,
  force_theme: false,
  default_theme: "classic",
  allowed_themes: ["classic", "dark", "light", "moon", "newyear", "summer", "autumn", "winter", "spring", "japan", "greenland"],
};
let currentTab = shouldForceMobileCalendarStart() ? "social" : "sales";
let currentProductsSubtab = "catalog";
let currentReviewsSubtab = "reviews";
let currentAdsSubtab = "campaigns";
let currentAccountingSubtab = "overview";
let currentHelpSubtab = "docs";
let currentSocialSubtab = shouldForceMobileCalendarStart() ? "calendar" : "chat";
const moduleLoadState = new Map();
const moduleInflightState = new Map();
const MODULE_CACHE_TTL_MS = 30 * 60 * 1000;
const MODULE_AUTO_REFRESH_MS = 60 * 60 * 1000;
let moduleAutoRefreshTimer = null;
const POSITION_LIMIT = 500;
const uiActivityThrottle = new Map();
const chartInstances = new Map();
let chartResizeBound = false;

const realAlert = window.alert ? window.alert.bind(window) : null;
if (realAlert) {
  window.alert = (msg) => {
    if (suppressAlerts) return;
    realAlert(msg);
  };
}

function setToken(nextToken = "", persist = null) {
  token = String(nextToken || "");
  if (!token) {
    tokenStorage = "";
    forceCookieAuth = false;
    localStorage.removeItem("token");
    localStorage.removeItem("token_shadow");
    sessionStorage.removeItem("token");
    return;
  }
  forceCookieAuth = false;
  const useLocal = persist === null ? tokenStorage === "local" : Boolean(persist);
  tokenStorage = useLocal ? "local" : "session";
  if (useLocal) {
    localStorage.setItem("token", token);
    sessionStorage.removeItem("token");
  } else {
    sessionStorage.setItem("token", token);
    localStorage.removeItem("token");
  }
  localStorage.setItem("remember_me", useLocal ? "1" : "0");
  localStorage.setItem("token_shadow", token);
}

function canUseEcharts(host) {
  return Boolean(
    host
    && typeof window !== "undefined"
    && window.echarts
    && typeof window.echarts.init === "function"
    && host instanceof HTMLElement
  );
}

function ensureChartResizeBinding() {
  if (chartResizeBound) return;
  chartResizeBound = true;
  window.addEventListener("resize", () => {
    for (const inst of chartInstances.values()) {
      try {
        inst.resize();
      } catch (_) {}
    }
  }, { passive: true });
}

function getOrCreateChart(host) {
  if (!canUseEcharts(host)) return null;
  ensureChartResizeBinding();
  let instance = null;
  try {
    instance = window.echarts.getInstanceByDom(host);
  } catch (_) {
    instance = null;
  }
  if (!instance) {
    instance = window.echarts.init(host, null, { renderer: "canvas" });
  }
  chartInstances.set(host.id || String(Math.random()), instance);
  return instance;
}

function clearChartHost(host) {
  if (!host) return;
  if (canUseEcharts(host)) {
    try {
      const instance = window.echarts.getInstanceByDom(host);
      if (instance) {
        instance.clear();
      }
    } catch (_) {}
  }
  if (host.tagName && host.tagName.toLowerCase() === "svg") {
    host.innerHTML = "";
  }
}

const authHeaders = () => {
  const headers = { "Content-Type": "application/json" };
  if (token && !forceCookieAuth) headers["Authorization"] = `Bearer ${token}`;
  return headers;
};

const authHeadersStrict = () => {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
};

const TAB_TITLES = {
  products: { ru: ["Товары", "Импорт, обновление и проверка позиций"], en: ["Products", "Import, refresh and ranking checks"] },
  sales: { ru: ["Статистика и дашборд", "Продажи, KPI и динамика в одном модуле"], en: ["Statistics & Dashboard", "Sales, KPIs and trends in one module"] },
  reviews: { ru: ["Отзывы/Вопросы", "Единый модуль обратной связи"], en: ["Reviews/Questions", "Unified customer feedback module"] },
  accounting: { ru: ["Бухгалтерия", "Прибыль, расходы и экономика WB/Ozon"], en: ["Accounting", "Profit, costs, and WB/Ozon economics"] },
  ads: { ru: ["Реклама WB/Ozon", "Кампании, аналитика и рекомендации"], en: ["WB/Ozon Ads", "Campaigns, analytics and recommendations"] },
  social: { ru: ["Социальный", "Чаты, коммуникация и совместная работа"], en: ["Social Hub", "Break, communication and teamwork"] },
  profile: { ru: ["Профиль", "Профиль компании, доступы команды и интеграции"], en: ["Profile", "Company profile, team access and integrations"] },
  billing: { ru: ["Биллинг", "Тарифы, лимиты, продление и история операций"], en: ["Billing", "Plans, limits, renewals and history"] },
  help: { ru: ["Справка", "Документация по модулям"], en: ["Help Center", "Module usage documentation"] },
  admin: { ru: ["Админка", "Управление пользователями и модулями"], en: ["Admin", "Users and modules management"] },
};

const SUBTAB_TITLES = {
  products: {
    catalog: { ru: ["Товары", "Каталог, карточки и синхронизация остатков"], en: ["Products", "Catalog, product cards, and stock sync"] },
    seo: { ru: ["SEO-задачи", "Генерация, проверка и применение SEO-описаний"], en: ["SEO Jobs", "Generate, review, and apply SEO descriptions"] },
  },
  reviews: {
    reviews: { ru: ["Ответы на отзывы", "Отзывы WB и Ozon с AI-ответами"], en: ["Review Replies", "WB and Ozon reviews with AI replies"] },
    questions: { ru: ["Ответы на вопросы", "Вопросы покупателей и быстрые ответы"], en: ["Question Replies", "Customer questions and quick answers"] },
    returns: { ru: ["Возвраты", "Заявки на возврат WB и Ozon с понятными действиями"], en: ["Returns", "WB and Ozon return requests with clear actions"] },
  },
  accounting: {
    overview: { ru: ["Бухгалтерия", "KPI, прибыль и экономика по периодам"], en: ["Accounting", "KPIs, profit, and period economics"] },
    analysis: { ru: ["Анализ прибыли", "Доходы, расходы и маржинальность"], en: ["Profit Analysis", "Revenue, costs, and margin breakdown"] },
    monthly: { ru: ["Прибыль по месяцам", "Сравнение WB и Ozon по месяцам за 12 периодов"], en: ["Monthly Profit", "WB and Ozon comparison across the last 12 months"] },
    expenses: { ru: ["Расходы", "Все расходы и детализация по категориям"], en: ["Expenses", "Expense tracking and category split"] },
    settings: { ru: ["Настройки бухгалтерии", "Шаблоны, ставки и правила расчета"], en: ["Accounting Settings", "Templates, rates, and calculation rules"] },
  },
  ads: {
    campaigns: { ru: ["Рекламные кампании", "Кампании WB с бюджетами, статусами и метриками"], en: ["Ad Campaigns", "WB campaigns with budgets, statuses, and metrics"] },
    analytics: { ru: ["Аналитика рекламы", "Показы, клики, заказы и расходы по кампаниям"], en: ["Ads Analytics", "Views, clicks, orders, and spend by campaign"] },
    recommendations: { ru: ["Рекомендации по рекламе", "Подсказки по ставкам и эффективности кампаний"], en: ["Ads Recommendations", "Bid and efficiency recommendations"] },
    bidder: { ru: ["Бидер WB Ads", "Автоматическое управление ставками по правилам"], en: ["WB Ads Bidder", "Automatic bid management by rules"] },
    ozon: { ru: ["Реклама Ozon", "Кампании и ставки Ozon"], en: ["Ozon Ads", "Ozon campaigns and bids"] },
  },
  social: {
    chat: { ru: ["Чаты", "Командные и личные переписки"], en: ["Chats", "Team and direct conversations"] },
    tasks: { ru: ["Задачи", "Командные задачи, дедлайны и контроль"], en: ["Tasks", "Team tasks, deadlines, and control"] },
    calendar: { ru: ["Календарь", "События, дедлайны и напоминания"], en: ["Calendar", "Events, deadlines, and reminders"] },
    calculator: { ru: ["Калькулятор", "Быстрые расчеты и конвертация"], en: ["Calculator", "Quick calculations and conversion"] },
    notes: { ru: ["Заметки", "Личные и командные заметки"], en: ["Notes", "Personal and team notes"] },
    games: { ru: ["Игры", "Небольшая пауза внутри приложения"], en: ["Games", "A short break inside the app"] },
  },
  help: {
    docs: { ru: ["Справка", "Документация по модулям и подсказки"], en: ["Help Center", "Module documentation and tips"] },
    assistant: { ru: ["AI-помощник", "Ответы по работе сервиса и модулей"], en: ["AI Assistant", "Answers about the service and modules"] },
    downloads: { ru: ["Загрузки", "APK, обновления и история релизов"], en: ["Downloads", "APK, updates, and release history"] },
  },
};

function resolveSectionHeading(tab = currentTab) {
  const safeTab = String(tab || "sales").trim().toLowerCase() || "sales";
  const pick = (pack) => {
    const fallback = TAB_TITLES[safeTab] || TAB_TITLES.sales;
    const source = pack && typeof pack === "object" ? pack : fallback;
    const pair = source[currentLang] || source.ru || fallback[currentLang] || fallback.ru || ["-", ""];
    return {
      title: String(pair[0] || "").trim(),
      subtitle: String(pair[1] || "").trim(),
    };
  };
  if (safeTab === "products") return pick(SUBTAB_TITLES.products?.[String(currentProductsSubtab || "catalog")]);
  if (safeTab === "reviews") return pick(SUBTAB_TITLES.reviews?.[String(currentReviewsSubtab || "reviews")]);
  if (safeTab === "accounting") return pick(SUBTAB_TITLES.accounting?.[String(currentAccountingSubtab || "overview")]);
  if (safeTab === "ads") return pick(SUBTAB_TITLES.ads?.[String(currentAdsSubtab || "campaigns")]);
  if (safeTab === "social") return pick(SUBTAB_TITLES.social?.[String(currentSocialSubtab || "chat")]);
  if (safeTab === "help") return pick(SUBTAB_TITLES.help?.[String(currentHelpSubtab || "docs")]);
  return pick(null);
}

function normalizeHeadingTabName(tabName) {
  const raw = String(tabName || "").trim().toLowerCase();
  const safe = raw || "sales";
  if (typeof normalizeLegacyTabName === "function") {
    const mapped = normalizeLegacyTabName(safe);
    if (mapped && typeof mapped === "object" && mapped.tab) {
      return String(mapped.tab || "sales").trim().toLowerCase() || "sales";
    }
  }
  return safe;
}

function refreshSectionHeading(tab = currentTab) {
  const titleNode = document.getElementById("sectionTitle");
  const subtitleNode = document.getElementById("sectionSubtitle");
  if (!titleNode || !subtitleNode) return;
  const requestedTab = normalizeHeadingTabName(tab);
  const activeTab = normalizeHeadingTabName(currentTab);
  if (requestedTab !== activeTab) return;
  const heading = resolveSectionHeading(activeTab);
  titleNode.textContent = heading.title || "-";
  subtitleNode.textContent = heading.subtitle || "";
}

const LEGACY_TAB_REDIRECT = {
  seo: { tab: "products", productsSubtab: "seo", reviewsSubtab: "", adsSubtab: "" },
  dashboard: { tab: "sales", reviewsSubtab: "", adsSubtab: "" },
  questions: { tab: "reviews", reviewsSubtab: "questions", adsSubtab: "" },
  "ads-analytics": { tab: "ads", reviewsSubtab: "", adsSubtab: "analytics" },
  "ads-recommendations": { tab: "ads", reviewsSubtab: "", adsSubtab: "recommendations" },
  "ads-bidder": { tab: "ads", reviewsSubtab: "", adsSubtab: "bidder" },
  keywords: { tab: "products", productsSubtab: "seo", reviewsSubtab: "", adsSubtab: "" },
};

const TEAM_ACCESS_MODULES = [
  "products",
  "seo_generation",
  "sales_stats",
  "accounting",
  "wb_reviews_ai",
  "wb_questions_ai",
  "returns",
  "wb_ads",
  "wb_ads_analytics",
  "wb_ads_recommendations",
  "user_profile",
  "help_center",
  "ai_assistant",
  "social_hub",
];

const NAV_BUTTON_ICONS = {
  products: "/static/icons/nav-products.svg",
  sales: "/static/icons/nav-sales.svg",
  reviews: "/static/icons/nav-reviews.svg",
  accounting: "/static/icons/nav-accounting.svg",
  ads: "/static/icons/nav-ads.svg",
  social: "/static/icons/nav-social.svg",
  profile: "/static/icons/nav-profile.svg",
  help: "/static/icons/nav-help.svg",
};

const UI_TEXT = {
  ru: {
    nav_products: "Товары",
    nav_sales: "Статистика и дашборд",
    nav_reviews: "Отзывы/Вопросы",
    nav_accounting: "Бухгалтерия",
    nav_ads: "Реклама WB/Ozon",
    nav_social: "Социальный",
    nav_profile: "Профиль",
    nav_help: "Справка",
    logout: "Выйти",
    theme_classic: "Классика",
    theme_dark: "Темная",
    theme_light: "Светлая",
    theme_moon: "Луна",
    theme_newyear: "Новогодняя",
    theme_summer: "Лето",
    theme_autumn: "Осень",
    theme_winter: "Зима",
    theme_spring: "Весна",
    theme_japan: "Япония",
    theme_greenland: "Гренландия",
  },
  en: {
    nav_products: "Products",
    nav_sales: "Statistics & Dashboard",
    nav_reviews: "Reviews/Questions",
    nav_accounting: "Accounting",
    nav_ads: "WB/Ozon Ads",
    nav_social: "Social Hub",
    nav_profile: "Profile",
    nav_help: "Help Center",
    logout: "Logout",
    theme_classic: "Classic",
    theme_dark: "Dark",
    theme_light: "Light",
    theme_moon: "Moon",
    theme_newyear: "New Year",
    theme_summer: "Summer",
    theme_autumn: "Autumn",
    theme_winter: "Winter",
    theme_spring: "Spring",
    theme_japan: "Japan",
    theme_greenland: "Greenland",
  },
};

Object.assign(UI_TEXT.ru, {
  nav_products: "\u0422\u043e\u0432\u0430\u0440\u044b",
  nav_sales: "\u0421\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043a\u0430 \u0438 \u0434\u0430\u0448\u0431\u043e\u0440\u0434",
  nav_reviews: "\u041e\u0442\u0437\u044b\u0432\u044b/\u0412\u043e\u043f\u0440\u043e\u0441\u044b",
  nav_accounting: "\u0411\u0443\u0445\u0433\u0430\u043b\u0442\u0435\u0440\u0438\u044f",
  nav_ads: "\u0420\u0435\u043a\u043b\u0430\u043c\u0430 WB/Ozon",
  nav_social: "\u0421\u043e\u0446\u0438\u0430\u043b\u044c\u043d\u044b\u0439",
  nav_profile: "\u041f\u0440\u043e\u0444\u0438\u043b\u044c",
  nav_help: "\u0421\u043f\u0440\u0430\u0432\u043a\u0430",
  logout: "\u0412\u044b\u0439\u0442\u0438",
  theme_classic: "\u041a\u043b\u0430\u0441\u0441\u0438\u043a\u0430",
  theme_dark: "\u0422\u0435\u043c\u043d\u0430\u044f",
  theme_light: "\u0421\u0432\u0435\u0442\u043b\u0430\u044f",
  theme_moon: "\u041b\u0443\u043d\u0430",
  theme_newyear: "\u041d\u043e\u0432\u043e\u0433\u043e\u0434\u043d\u044f\u044f",
  theme_summer: "\u041b\u0435\u0442\u043e",
  theme_autumn: "\u041e\u0441\u0435\u043d\u044c",
  theme_winter: "\u0417\u0438\u043c\u0430",
  theme_spring: "\u0412\u0435\u0441\u043d\u0430",
  theme_japan: "\u042f\u043f\u043e\u043d\u0438\u044f",
  theme_greenland: "\u0413\u0440\u0435\u043d\u043b\u0430\u043d\u0434\u0438\u044f",
});

function t(key, fallback = "") {
  const pack = UI_TEXT[currentLang] || UI_TEXT.ru;
  const ruPack = UI_TEXT.ru || {};
  const enPack = UI_TEXT.en || {};
  const source = pack[key] || fallback || key;
  const rawRu = String(ruPack[key] || source || "");
  const repairedRu = _repairUiCandidate(rawRu);
  const repairedEn = _repairUiCandidate(enPack[key] || fallback || key);
  let value = _repairUiCandidate(source);
  if (currentLang !== "en") {
    const broken = /\?{3,}|�|(?:Ð.|Ñ.|вЂ|рџ|[ЃЉЊЋЏђѓљњћџ])/.test(rawRu);
    if (_looksReadableRussian(repairedRu) || _looksReadableCyrillic(repairedRu)) {
      value = repairedRu;
    } else if (!(_looksReadableRussian(value) || _looksReadableCyrillic(value)) && (broken || _mojibakeScore(rawRu) >= 2 || /\uFFFD/.test(rawRu))) {
      value = repairedEn || repairedRu || value;
    }
  }
  return value;
}

function _mojibakeScore(text) {
  const value = String(text || "");
  if (!value) return 0;
  const markerMatches = value.match(/(?:\u0420[\u0400-\u04FF\u00A0]|\u0421[\u0400-\u04FF\u00A0]|\u00d0.|\u00d1.)/g);
  const markerScore = markerMatches ? markerMatches.length : 0;
  const spacedMatches = value.match(/(?:[\u0420\u0421\u0412](?:\s|\u00A0){1,3}[\u0420\u0421\u0412\u0400-\u04FFA-Za-z0-9])/g);
  const spacedScore = spacedMatches ? spacedMatches.length : 0;
  const replacementScore = (value.match(/\uFFFD/g) || []).length * 3;
  return markerScore + spacedScore + replacementScore;
}

function _cyrillicScore(text) {
  const value = String(text || "");
  if (!value) return 0;
  const matches = value.match(/[\u0400-\u04FF]/g);
  return matches ? matches.length : 0;
}

function _repairUiCandidate(input) {
  let value = String(input ?? "");
  if (!value) return "";
  try {
    value = String(decodePossiblyMojibake(value) || value);
  } catch (_) {}
  try {
    if (typeof window !== "undefined" && typeof window.__repairMojibakeText === "function") {
      value = String(window.__repairMojibakeText(value) || value);
    }
  } catch (_) {}
  return String(value || "")
    .replace(/[\u0000-\u001F\u007F-\u009F]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function _looksReadableRussian(text) {
  const value = String(text || "").trim();
  if (!value) return false;
  const broken = /\?{3,}|\uFFFD|(?:\u00D0.|\u00D1.|РІР‚|СЂСџ|[РѓР‰РЉР‹РЏС’С“С™СљС›СџР С“Р вЂ°Р Р‰Р вЂ№Р РЏРЎвЂ™РЎвЂњРЎв„ўРЎС™РЎвЂєРЎСџ])/u.test(value)
    || _mojibakeScore(value) >= 2
    || /(?:\b[\u0420\u0421\u0412\u00D0\u00D1]\b(?:\s|\u00A0)+){3,}/u.test(value);
  if (broken) return false;
  return _cyrillicScore(value) >= 2;
}

function _looksReadableCyrillic(text) {
  const value = String(text || "").trim();
  if (!value) return false;
  if (!_cyrillicScore(value)) return false;
  if (_mojibakeScore(value) > 1 || /\uFFFD/.test(value)) return false;
  if (/[РСВÐÑ](?:\s|\u00A0){0,1}[РСВÐÑ]/.test(value)) return false;
  return _cyrillicScore(value) >= 2 || /[А-Яа-яЁё]/.test(value);
}

let _cp1251ReverseMap = null;
const _mojibakeDecodeCache = new Map();

function _cp1251DecodeUtf8(text) {
  if (typeof TextDecoder === "undefined") return "";
  if (!_cp1251ReverseMap) {
    const decoder = new TextDecoder("windows-1251");
    const map = new Map();
    for (let i = 0; i < 256; i += 1) {
      const ch = decoder.decode(new Uint8Array([i]));
      if (!map.has(ch)) map.set(ch, i);
    }
    _cp1251ReverseMap = map;
  }
  const bytes = [];
  for (const ch of String(text || "")) {
    const byte = _cp1251ReverseMap.get(ch);
    if (byte === undefined) return "";
    bytes.push(byte);
  }
  try {
    return new TextDecoder("utf-8", { fatal: false }).decode(new Uint8Array(bytes));
  } catch (_) {
    return "";
  }
}

function _latin1DecodeUtf8(text) {
  const value = String(text || "");
  if (!value) return "";
  try {
    return decodeURIComponent(escape(value));
  } catch (_) {
    return "";
  }
}

function _collapseMojibakeSpacing(text) {
  const raw = String(text || "");
  if (!raw) return "";
  if (!/[\u0420\u0421](?:\s|\u00A0)+[\u0400-\u04FFA-Za-z0-9]/.test(raw)) return raw;
  return raw
    .replace(/([\u0420\u0421\u0412])\u00A0(?=[\u0420\u0421\u0412\u0400-\u04FFA-Za-z0-9])/g, "$1")
    .replace(/(?:\b[\u0420\u0421\u0412]\b(?:\s|\u00A0)+){2,}\b[\u0420\u0421\u0412]\b/g, (seq) => seq.replace(/[\s\u00A0]+/g, ""))
    .replace(/([\u0420\u0421])\s+(?=[\u0420\u0421])/g, "$1")
    .replace(/([\u0420\u0421])\s+(?=[\u0400-\u04FFA-Za-z0-9])/g, "$1")
    .replace(/([\u0420\u0421][^\s]{0,2})(?:\s|\u00A0)+(?=[\u0420\u0421][^\s]{0,2})/g, "$1")
    .replace(/([\u00d0\u00d1][^\s]{0,2})(?:\s|\u00A0)+(?=[\u00d0\u00d1][^\s]{0,2})/g, "$1")
    .replace(/([\u0400-\u04FFA-Za-z0-9])\s+(?=[\u0420\u0421][\u0400-\u04FFA-Za-z0-9])/g, "$1")
    .replace(/([\u0400-\u04FF])\s+(?=[\u0400-\u04FF])/g, "$1")
    .replace(/\s{2,}/g, " ");
}

function decodePossiblyMojibake(input) {
  const raw = String(input ?? "");
  if (!raw) return "";
  const cached = _mojibakeDecodeCache.get(raw);
  if (typeof cached === "string") return cached;
  const collapsed = _collapseMojibakeSpacing(raw);

  const baseScore = Math.max(_mojibakeScore(raw), _mojibakeScore(collapsed));
  if (!baseScore) {
    _mojibakeDecodeCache.set(raw, raw);
    if (_mojibakeDecodeCache.size > 4096) _mojibakeDecodeCache.clear();
    return raw;
  }

  const candidates = [
    raw,
    collapsed,
    _cp1251DecodeUtf8(raw),
    _cp1251DecodeUtf8(collapsed),
    _latin1DecodeUtf8(raw),
    _latin1DecodeUtf8(collapsed),
  ].filter(Boolean);
  let best = collapsed || raw;
  let bestScore = baseScore;
  let bestCyr = Math.max(_cyrillicScore(raw), _cyrillicScore(collapsed));
  for (const cand of candidates) {
    const normalized = _collapseMojibakeSpacing(cand);
    const score = _mojibakeScore(normalized);
    const cyr = _cyrillicScore(cand);
    const shouldUse = (
      score < bestScore
      || (score === bestScore && cyr > bestCyr + 1)
      || (score <= bestScore - 2)
    ) && !(score > bestScore && cyr <= bestCyr);
    if (shouldUse) {
      best = normalized || cand;
      bestScore = score;
      bestCyr = cyr;
    }
  }

  _mojibakeDecodeCache.set(raw, best);
  if (collapsed && collapsed !== raw) _mojibakeDecodeCache.set(collapsed, best);
  if (_mojibakeDecodeCache.size > 4096) _mojibakeDecodeCache.clear();
  return best;
}

if (typeof window !== "undefined") {
  window.decodePossiblyMojibake = decodePossiblyMojibake;
}

function __legacyTr(ru, en) {
  const rawRu = String(ru == null ? "" : ru);
  const rawEn = String(en == null ? "" : en);
  const repairedRu = _repairUiCandidate(rawRu);
  const repairedEn = _repairUiCandidate(rawEn);
  let value = currentLang === "en" ? repairedEn : repairedRu;
  try {
    if (typeof window !== "undefined" && typeof window.__repairMojibakeText === "function") {
      value = String(window.__repairMojibakeText(value) || value);
    }
  } catch (_) {}
  if (currentLang !== "en") {
    const broken = /\?{3,}|\uFFFD|(?:\u00D0.|\u00D1.|вЂ|рџ|[ЃЉЊЋЏђѓљњћџ])/u.test(String(value || ""));
    if ((_looksReadableRussian(repairedRu) || _looksReadableCyrillic(repairedRu))) {
      value = repairedRu;
    } else if ((broken || _mojibakeScore(String(value || "")) >= 2 || /\uFFFD/.test(String(value || ""))) && rawEn.trim()) {
      value = decodePossiblyMojibake(rawEn);
    }
  }
  return _repairUiCandidate(value);
}

const RU_FALLBACK_BY_EN = {
  "Generate reply": "Сгенерировать ответ",
  "Select a file first.": "Сначала выберите файл.",
  "API record state/status": "Состояние записи API",
  "Status": "Статус",
  "Created": "Создано",
  "Updated": "Обновлено",
  "Amount": "Сумма",
  "Warehouse": "Склад",
  "Running": "Работает",
  "Spend": "Расход",
  "Bid": "Ставка",
  "Rates were not returned by API.": "Ставки не вернулись из API.",
  "Stats are unavailable from API.": "Статистика недоступна из API.",
  "Recommendations loaded": "Рекомендации загружены",
  "Sales statistics partially loaded": "Статистика продаж загружена частично",
  "Sales statistics loaded": "Статистика продаж загружена",
  "Recommendations": "Рекомендации",
  "Medium priority": "Средний приоритет",
  "Medium": "Средний",
  "Low": "Низкий",
  "Strategy": "Стратегия",
  "Edit product": "Редактировать товар",
  "Saving product card changes...": "Сохраняем изменения карточки товара...",
  "Plan": "Тариф",
  "Load state": "Состояние загрузки",
  "Recommendations are temporarily unavailable.": "Рекомендации временно недоступны.",
  "Recommendations are currently unavailable. Check API key and date range, then refresh the module.": "Рекомендации сейчас недоступны. Проверьте API-ключ и период, затем обновите модуль.",
  "Recommendations are ready in cards and table. Start with high priority.": "Рекомендации готовы в карточках и таблице. Начните с высокого приоритета.",
  "No actionable recommendations. Service returned neutral or insufficient data for selected period.": "Нет actionable-рекомендаций. За выбранный период недостаточно данных или показатели нейтральные.",
  "No recommendation cards yet. Build recommendations for selected dates.": "Карточки рекомендаций пока пусты. Постройте рекомендации за выбранный период.",
  "No recommendations for selected period.": "За выбранный период рекомендаций нет.",
  "Details are fetched via several WB API methods.": "Детали загружаются через несколько методов API WB.",
  "Server returned a malformed WB Ads response. Existing rows were preserved.": "Сервер вернул некорректный ответ WB Ads. Текущие строки сохранены.",
};

function russianFallbackFromEnglish(text) {
  const value = String(text == null ? "" : text).trim();
  if (!value) return "";
  if (RU_FALLBACK_BY_EN[value]) return RU_FALLBACK_BY_EN[value];
  let match = value.match(/^Generated jobs:\s*(\d+)$/i);
  if (match) return `Сгенерировано задач: ${match[1]}`;
  match = value.match(/^Stats rows:\s*(\d+)$/i);
  if (match) return `Строк статистики: ${match[1]}`;
  match = value.match(/^Editing rule\s*#(.+)$/i);
  if (match) return `Редактирование правила #${match[1]}`;
  return "";
}

// Harden translation decoding for double-encoded/space-split mojibake variants.
function tr(ru, en) {
  const rawRu = String(ru == null ? "" : ru);
  const rawEn = String(en == null ? "" : en);
  const fixSymbols = (input) => String(input == null ? "" : input)
    .replace(/вЊ«/g, "\u232b")
    .replace(/В±/g, "\u00b1")
    .replace(/Г·/g, "\u00f7")
    .replace(/Г—/g, "\u00d7")
    .replace(/в€’/g, "\u2212")
    .replace(/вЂў/g, "\u2022")
    .replace(/вЂ¦/g, "\u2026");
  const clean = (input) => String(input == null ? "" : input)
    .replace(/[\u0000-\u001F\u007F-\u009F]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  const decodeChain = (input) => {
    let value = clean(fixSymbols(input));
    if (!value) return "";
    for (let i = 0; i < 3; i += 1) {
      value = clean(decodePossiblyMojibake(value));
      try {
        if (typeof window !== "undefined" && typeof window.__repairMojibakeText === "function") {
          value = clean(window.__repairMojibakeText(value) || value);
        }
      } catch (_) {}
      value = clean(fixSymbols(value));
    }
    return clean(fixSymbols(value));
  };
  const decodedRu = decodeChain(rawRu);
  const decodedEn = decodeChain(rawEn);
  let value = currentLang === "en" ? decodedEn : decodedRu;
  if (currentLang !== "en") {
    const current = clean(value);
    const broken = /\?{3,}|\uFFFD|(?:\u00D0.|\u00D1.|РІР‚|СЂСџ|[РѓР‰РЉР‹РЏС’С“С™СљС›Сџ])/u.test(current)
      || _mojibakeScore(current) >= 2
      || /(?:\b[\u0420\u0421\u0412\u00D0\u00D1]\b(?:\s|\u00A0)+){3,}/u.test(current);
    const ruFallback = russianFallbackFromEnglish(decodedEn || rawEn);
    if (_looksReadableRussian(decodedRu) || _looksReadableCyrillic(decodedRu)) {
      value = decodedRu;
    } else if (broken && ruFallback) {
      value = ruFallback;
    } else if (broken && decodedEn) {
      value = decodedEn;
    }
  }
  return clean(value || (currentLang === "en" ? decodedEn : decodedRu) || rawRu || rawEn);
}

function normalizeAppText(value, fallback = "") {
  const fixSymbols = (input) => String(input == null ? "" : input)
    .replace(/РІРЉВ«/g, "\u232b")
    .replace(/Р’В±/g, "\u00b1")
    .replace(/Р“В·/g, "\u00f7")
    .replace(/Р“вЂ”/g, "\u00d7")
    .replace(/РІв‚¬вЂ™/g, "\u2212")
    .replace(/РІР‚Сћ/g, "\u2022")
    .replace(/РІР‚В¦/g, "\u2026");
  const clean = (input) => String(input == null ? "" : input)
    .replace(/[\u0000-\u001F\u007F-\u009F]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  const looksBroken = (input) => {
    const raw = clean(input);
    if (!raw) return false;
    if (/\?{3,}|\uFFFD|пїЅ/.test(raw)) return true;
    if (/(?:\u00D0.|\u00D1.|Ð.|Ñ.|РІР‚|СЂСџ|рџ|вЂ|[ЃЉЊЋЏђѓљњћџРѓР‰РЉР‹РЏС’С“С™СљС›Сџ])/u.test(raw)) return true;
    try {
      if (typeof _mojibakeScore === "function" && _mojibakeScore(raw) >= 2) return true;
    } catch (_) {}
    return false;
  };
  const decodeChain = (input) => {
    let text = clean(fixSymbols(input));
    if (!text) return "";
    for (let i = 0; i < 3; i += 1) {
      try {
        if (typeof decodePossiblyMojibake === "function") {
          text = clean(decodePossiblyMojibake(text) || text);
        }
      } catch (_) {}
      try {
        if (typeof window !== "undefined" && typeof window.__repairMojibakeText === "function") {
          text = clean(window.__repairMojibakeText(text) || text);
        }
      } catch (_) {}
      text = clean(fixSymbols(text));
    }
    return text;
  };
  const primary = decodeChain(value);
  const backup = decodeChain(fallback);
  if (looksBroken(primary) && backup && !looksBroken(backup)) return backup;
  return primary || backup || clean(fixSymbols(value));
}

function shouldTrackUiActivity(key, cooldownMs = 30000) {
  const now = Date.now();
  const prev = Number(uiActivityThrottle.get(key) || 0);
  if (prev && (now - prev) < Math.max(1000, Number(cooldownMs || 0))) return false;
  uiActivityThrottle.set(key, now);
  return true;
}

async function trackUiActivity(action, moduleCode = "", details = "", options = {}) {
  if (!token) return;
  const safeAction = String(action || "").trim().toLowerCase();
  if (!safeAction) return;
  const safeModule = String(moduleCode || "").trim().toLowerCase();
  const safeDetails = String(details || "").trim();
  const key = `${safeAction}:${safeModule}:${safeDetails}`;
  if (!options.force && !shouldTrackUiActivity(key, Number(options.cooldownMs || 30000))) return;
  await requestJson("/api/activity/track", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      action: safeAction,
      module_code: safeModule,
      details: safeDetails,
      entity_type: String(options.entityType || "").trim().toLowerCase(),
      entity_id: String(options.entityId || "").trim(),
      status: String(options.status || "ok").trim().toLowerCase() || "ok",
    }),
    timeoutMs: 8000,
  }).catch(() => null);
}

function moduleLabel(code) {
  const key = String(code || "").trim().toLowerCase();
  const labels = {
    products: tr("Товары", "Products"),
    seo_generation: tr("SEO задачи", "SEO Jobs"),
    sales_stats: tr("Статистика продаж", "Sales Statistics"),
    accounting: tr("Бухгалтерия", "Accounting"),
    wb_reviews_ai: tr("Отзывы", "Reviews"),
    wb_questions_ai: tr("Вопросы", "Questions"),
    returns: tr("Возвраты", "Returns"),
    wb_ads: tr("Реклама", "Ads"),
    ads_campaigns: tr("Рекламные кампании", "Ad Campaigns"),
    ads_bidder: tr("Бидер WB", "WB Bidder"),
    wb_ads_analytics: tr("Аналитика Ads", "Ads Analytics"),
    wb_ads_recommendations: tr("Рекомендации Ads", "Ads Recommendations"),
    user_profile: tr("Профиль", "Profile"),
    help_center: tr("Справка", "Help"),
    ai_assistant: tr("AI помощник", "AI Assistant"),
    social_hub: tr("Социальный", "Social Hub"),
  };
  return labels[key] || key;
}

function applyTheme(theme) {
  const configured = Array.isArray(uiThemeSettings.allowed_themes) && uiThemeSettings.allowed_themes.length
    ? uiThemeSettings.allowed_themes
    : ["classic", "dark", "light", "moon", "newyear", "summer", "autumn", "winter", "spring", "japan", "greenland"];
  const allowed = new Set(configured.map((x) => String(x || "").toLowerCase()).filter(Boolean));
  const requested = String(theme || "").toLowerCase();
  const fallback = String(uiThemeSettings.default_theme || "classic").toLowerCase();
  const forcedTheme = Boolean(uiThemeSettings.force_theme) || !uiThemeSettings.theme_choice_enabled;
  const target = forcedTheme ? fallback : requested;
  const nextTheme = allowed.has(target) ? target : (allowed.has(fallback) ? fallback : "classic");
  currentTheme = nextTheme;
  localStorage.setItem("ui_theme", nextTheme);
  document.body.setAttribute("data-theme", nextTheme);
  const sel = document.getElementById("uiThemeSelect");
  if (sel) {
    if (sel.value !== nextTheme) sel.value = nextTheme;
    sel.disabled = forcedTheme;
  }
  const drawerSel = document.getElementById("mobileDrawerThemeSelect");
  if (drawerSel) {
    if (drawerSel.value !== nextTheme) drawerSel.value = nextTheme;
    drawerSel.disabled = forcedTheme;
  }
}

function changeTheme() {
  if (Boolean(uiThemeSettings.force_theme) || !uiThemeSettings.theme_choice_enabled) return;
  const value = document.getElementById("uiThemeSelect")?.value || "classic";
  applyTheme(value);
}

window.changeTheme = changeTheme;

function applyUiThemeSettingsToSelect() {
  const sel = document.getElementById("uiThemeSelect");
  const drawerSel = document.getElementById("mobileDrawerThemeSelect");
  if (!sel && !drawerSel) return;
  const targets = [sel, drawerSel].filter(Boolean);
  const allowed = Array.isArray(uiThemeSettings.allowed_themes) && uiThemeSettings.allowed_themes.length
    ? uiThemeSettings.allowed_themes
    : ["classic", "dark", "light", "moon", "newyear", "summer", "autumn", "winter", "spring", "japan", "greenland"];
  const allowedSet = new Set(allowed.map((x) => String(x || "").toLowerCase()));
  const fallbackTheme = String(uiThemeSettings.default_theme || allowed[0] || "classic").toLowerCase();
  targets.forEach((node) => {
    const currentValue = String(node.value || "").toLowerCase();
    if (!allowedSet.has(currentValue)) {
      const preferred = allowedSet.has(fallbackTheme) ? fallbackTheme : String(allowed[0] || "classic").toLowerCase();
      const next = [...node.options].find((opt) => String(opt.value || "").toLowerCase() === preferred);
      if (next) node.value = next.value;
    }
    [...node.options].forEach((opt) => {
      opt.hidden = !allowedSet.has(String(opt.value || "").toLowerCase());
      opt.disabled = !allowedSet.has(String(opt.value || "").toLowerCase());
    });
    node.disabled = Boolean(uiThemeSettings.force_theme) || !uiThemeSettings.theme_choice_enabled;
  });
}

function syncMobileDrawerSelectors() {
  const langSel = document.getElementById("uiLangSelect");
  const drawerLangSel = document.getElementById("mobileDrawerLangSelect");
  if (langSel && drawerLangSel) {
    drawerLangSel.innerHTML = langSel.innerHTML;
    drawerLangSel.value = langSel.value;
  }
  const themeSel = document.getElementById("uiThemeSelect");
  const drawerThemeSel = document.getElementById("mobileDrawerThemeSelect");
  if (themeSel && drawerThemeSel) {
    drawerThemeSel.innerHTML = themeSel.innerHTML;
    if ([...drawerThemeSel.options].some((opt) => opt.value === themeSel.value)) {
      drawerThemeSel.value = themeSel.value;
    }
    drawerThemeSel.disabled = themeSel.disabled;
  }
}

function toolbarIconSvg(name) {
  const icons = {
    import: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12"></path><polyline points="7 11 12 16 17 11"></polyline><path d="M5 20h14"></path></svg>`,
    refresh: `<svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.5 9a9 9 0 0 1 14.8-3.3L23 10"></path><path d="M20.5 15a9 9 0 0 1-14.8 3.3L1 14"></path></svg>`,
    select: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"></rect><polyline points="8 12 11 15 16 9"></polyline></svg>`,
    search: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`,
    rocket: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 19.5c2.4-1.4 4.8-1.6 7.2-.6 1-2.7.7-5.5-.8-8.3 2.8-4.3 6.2-6.5 10.1-6.6-.1 4-2.3 7.4-6.6 10.2-2.8-1.5-5.6-1.8-8.3-.8-.9 2.3-.7 4.7.6 7.1z"></path><circle cx="15.5" cy="8.5" r="1.5"></circle></svg>`,
  };
  return icons[name] || "";
}

function applyProductToolbarIcons(isEn) {
  const items = [
    { id: "productsImportBtn", icon: toolbarIconSvg("import"), ru: "Импорт", en: "Import" },
    { id: "productsReloadBtn", icon: toolbarIconSvg("refresh"), ru: "Перезагрузить базу", en: "Reload Catalog" },
    { id: "productsSelectAllBtn", icon: toolbarIconSvg("select"), ru: "Выбрать все", en: "Select All" },
    { id: "productsCheckSelectedBtn", icon: toolbarIconSvg("search"), ru: "Проверить выбранные", en: "Check Selected" },
    { id: "productsCheckAllBtn", icon: toolbarIconSvg("rocket"), ru: "Проверить все", en: "Check All" },
  ];
  for (const item of items) {
    const btn = document.getElementById(item.id);
    if (!btn) continue;
    btn.innerHTML = item.icon;
    const tip = isEn ? item.en : item.ru;
    btn.dataset.tip = tip;
    btn.setAttribute("aria-label", tip);
    btn.title = tip;
  }
}

function iconByButtonLabel(labelRaw) {
  const label = String(labelRaw || "").trim().toLowerCase();
  if (!label) return "";
  const rules = [
    [/обнов|refresh|reload|renew/, "↻"],
    [/загруз|load|import/, "⇩"],
    [/сохран|save/, "⎘"],
    [/удал|delete|clear/, "✖"],
    [/примен|apply|publish/, "✓"],
    [/провер|check|test|audit/, "⌕"],
    [/генер|generate|ai/, "⚡"],
    [/отправ|send|reply/, "➤"],
    [/сменить|change|switch/, "⇄"],
    [/выбрать|select/, "☑"],
    [/построить|build|report|recommend/, "◈"],
    [/статист|sales/, "◷"],
  ];
  for (const [pattern, icon] of rules) {
    if (pattern.test(label)) return icon;
  }
  return "";
}

function applyNavIcons() {
  document.querySelectorAll(".side-nav .nav-btn").forEach((btn) => {
    const tabCode = String(btn.dataset.tab || "").trim();
    const iconSrc = NAV_BUTTON_ICONS[tabCode] || "";
    const labelNode = btn.querySelector(".nav-label");
    const label = String((labelNode?.textContent || btn.textContent || "")).trim();
    const currentIcon = String(btn.querySelector(".nav-icon img")?.getAttribute("src") || "");
    const currentLabel = String(btn.querySelector(".nav-label")?.textContent || "").trim();
    if (currentIcon === iconSrc && currentLabel === label) return;
    const iconHtml = iconSrc
      ? `<span class="nav-icon" aria-hidden="true"><img src="${iconSrc}" alt="" loading="eager" decoding="async" /></span>`
      : `<span class="nav-icon" aria-hidden="true">?</span>`;
    btn.innerHTML = `${iconHtml}<span class="nav-label">${escapeHtml(label)}</span>`;
  });
}

function applySidebarMode() {
  const sidebar = document.getElementById("mainSidebar");
  const shell = document.getElementById("appSection");
  if (!sidebar) return;
  const vw = Math.max(window.innerWidth || 0, document.documentElement?.clientWidth || 0);
  const compact = (mobileClientMode || vw <= 1200) ? false : Boolean(sidebarCompact);
  sidebar.classList.toggle("compact", compact);
  if (shell) shell.classList.toggle("sidebar-compact", compact);
  const toggle = sidebar.querySelector(".sidebar-toggle");
  if (toggle) {
    toggle.textContent = "\u2630";
    toggle.dataset.tip = compact
      ? tr("Показать подписи", "Show labels")
      : tr("Скрыть подписи", "Hide labels");
    toggle.title = toggle.dataset.tip;
  }
}

function toggleSidebarMode() {
  sidebarCompact = !sidebarCompact;
  localStorage.setItem("sidebar_compact", sidebarCompact ? "1" : "0");
  applySidebarMode();
}

window.toggleSidebarMode = toggleSidebarMode;

function switchAuthMode(mode = "login") {
  authMode = String(mode || "").toLowerCase() === "register" ? "register" : "login";
  const isLogin = authMode === "login";
  document.getElementById("authLoginPane")?.classList.toggle("hidden", !isLogin);
  document.getElementById("authRegisterPane")?.classList.toggle("hidden", isLogin);
  document.getElementById("authModeLoginBtn")?.classList.toggle("active", isLogin);
  document.getElementById("authModeRegisterBtn")?.classList.toggle("active", !isLogin);
  document.getElementById("authToolbarLoginBtn")?.classList.toggle("active", isLogin);
  document.getElementById("authToolbarRegisterBtn")?.classList.toggle("active", !isLogin);
  if (isLogin) initAuthRemember();
}

function changeAuthLang() {
  const value = String(document.getElementById("authLangSelect")?.value || "ru").toLowerCase();
  currentLang = value === "en" ? "en" : "ru";
  applyUiLanguage();
}

window.switchAuthMode = switchAuthMode;
window.changeAuthLang = changeAuthLang;

function applyModuleActionIcons() {
  const buttons = document.querySelectorAll(".workspace .panel button, .workspace .table-card button");
  for (const btn of buttons) {
    if (
      btn.classList.contains("nav-btn")
      || btn.classList.contains("icon-only-btn")
      || btn.classList.contains("icon-action-btn")
      || btn.classList.contains("feedback-ai-save-btn")
      || btn.classList.contains("chip-btn")
      || btn.classList.contains("profile-section-row")
      || btn.classList.contains("help-chip-btn")
      || btn.classList.contains("help-filter-btn")
      || btn.classList.contains("help-open-btn")
      || btn.classList.contains("campaign-close")
      || btn.closest(".review-actions")
    ) {
      continue;
    }
    const labelNode = btn.querySelector(".btn-label");
    const label = String((labelNode?.textContent || btn.textContent || "")).trim();
    const icon = iconByButtonLabel(label);
    if (!icon) continue;
    btn.classList.remove("btn-with-icon");
    btn.classList.add("btn-icon-only-auto");
    btn.innerHTML = `<span class="btn-icon" aria-hidden="true">${icon}</span>`;
    if (!btn.dataset.tip) btn.dataset.tip = label;
    if (!btn.getAttribute("aria-label")) btn.setAttribute("aria-label", label);
    if (!btn.title) btn.title = label;
  }
}

function applyUiLanguage() {
  pruneLegacyUi();
  ensureProfileTeamUi();
  const lang = currentLang === "en" ? "en" : "ru";
  currentLang = lang;
  localStorage.setItem("ui_lang", lang);
  document.documentElement.setAttribute("lang", lang);
  const langSelect = document.getElementById("uiLangSelect");
  if (langSelect && langSelect.value !== lang) langSelect.value = lang;
  const drawerLangSelect = document.getElementById("mobileDrawerLangSelect");
  if (drawerLangSelect && drawerLangSelect.value !== lang) drawerLangSelect.value = lang;
  const authLangSelect = document.getElementById("authLangSelect");
  if (authLangSelect && authLangSelect.value !== lang) authLangSelect.value = lang;

  const normalizeUiText = (value, fallback = "") => {
    const looksBrokenUiText = (rawValue) => {
      const raw = String(rawValue == null ? "" : rawValue);
      if (!raw) return false;
      if (/\?{3,}|\uFFFD/.test(raw)) return true;
      try {
        if (typeof _mojibakeScore === "function" && _mojibakeScore(raw) >= 2) return true;
      } catch (_) {}
      return false;
    };
    let text = String(value == null ? "" : value);
    try {
      if (typeof decodePossiblyMojibake === "function") {
        text = String(decodePossiblyMojibake(text) || text);
      }
    } catch (_) {}
    try {
      if (typeof window !== "undefined" && typeof window.__repairMojibakeText === "function") {
        text = String(window.__repairMojibakeText(text) || text);
      }
    } catch (_) {}
    if (lang !== "en" && looksBrokenUiText(text)) {
      let fb = String(fallback == null ? "" : fallback);
      try {
        if (typeof decodePossiblyMojibake === "function") {
          fb = String(decodePossiblyMojibake(fb) || fb);
        }
      } catch (_) {}
      try {
        if (typeof window !== "undefined" && typeof window.__repairMojibakeText === "function") {
          fb = String(window.__repairMojibakeText(fb) || fb);
        }
      } catch (_) {}
      if (fb && !looksBrokenUiText(fb)) text = fb;
    }
    return text;
  };
  const setText = (selector, value) => {
    const el = document.querySelector(selector);
    if (!el) return;
    const normalized = normalizeUiText(value, el.textContent || "");
    if (normalized) el.textContent = normalized;
  };
  const setTextAll = (selector, value) => {
    document.querySelectorAll(selector).forEach((el) => {
      const normalized = normalizeUiText(value, el.textContent || "");
      if (normalized) el.textContent = normalized;
    });
  };
  const setOptions = (selector, labels) => {
    const el = document.querySelector(selector);
    if (!el) return;
    labels.forEach((label, idx) => {
      if (el.options[idx]) {
        const normalized = normalizeUiText(label, el.options[idx].textContent || "");
        if (normalized) el.options[idx].textContent = normalized;
      }
    });
  };
  const setCheckLabel = (selector, labelText) => {
    const el = document.querySelector(selector);
    if (!el) return;
    const input = el.querySelector("input");
    const normalized = normalizeUiText(labelText, el.textContent || "");
    el.textContent = "";
    if (input) el.appendChild(input);
    el.append(document.createTextNode(` ${normalized}`));
  };
  setText(".nav-btn[data-tab='products']", t("nav_products"));
  setText(".nav-btn[data-tab='sales']", t("nav_sales"));
  setText(".nav-btn[data-tab='reviews']", t("nav_reviews"));
  setText(".nav-btn[data-tab='accounting']", t("nav_accounting"));
  setText(".nav-btn[data-tab='ads']", t("nav_ads"));
  setText(".nav-btn[data-tab='social']", t("nav_social"));
  setText(".nav-btn[data-tab='profile']", t("nav_profile"));
  setText(".nav-btn[data-tab='help']", t("nav_help"));
  setText("#topbarOpenProfileBtn", lang === "en" ? "Open profile" : "Открыть профиль");
  applyNavIcons();
  applySidebarMode();
  setText(".btn-danger.full", t("logout"));
  setText("#authToolbarSubtitle", lang === "en" ? "Marketplace Seller OS" : "Панель для маркетплейсов");
  setText("#authToolbarLoginBtn", lang === "en" ? "Login" : "Вход");
  setText("#authToolbarRegisterBtn", lang === "en" ? "Sign up" : "Регистрация");
  setText("#authModeLoginBtn", lang === "en" ? "Login" : "Вход");
  setText("#authModeRegisterBtn", lang === "en" ? "Sign up" : "Регистрация");
  setText("#authLoginTitle", lang === "en" ? "Login" : "Вход");
  setText("#authLoginHint", lang === "en" ? "Use owner or employee email to enter workspace." : "Используйте email владельца или сотрудника.");
  setText("#authRegisterTitle", lang === "en" ? "Registration" : "Регистрация");
  setText("#authRegisterHint", lang === "en" ? "Create owner account first. Team members are added in profile." : "Сначала создайте аккаунт владельца. Сотрудников можно добавить в профиле.");
  setText("#authLoginSubmitBtn", lang === "en" ? "Sign In" : "Войти в кабинет");
  setText("#authRegisterSubmitBtn", lang === "en" ? "Create Account" : "Создать аккаунт");
  setText("#authToRegisterBtn", lang === "en" ? "No account? Sign up" : "Нет аккаунта? Зарегистрируйтесь");
  setText("#authToLoginBtn", lang === "en" ? "Already have account? Login" : "Уже есть аккаунт? Вход");
  setText("#authLeadText", lang === "en" ? "Marketplace operations center for WB/Ozon: sales, catalog, ads, support and team workflows in one interface." : "Операционный центр продавца WB/Ozon: продажи, каталог, реклама, поддержка и командные процессы в одном интерфейсе.");
  setText("#authWhatTitle", lang === "en" ? "What you get" : "Что дает сервис");
  setText("#authWhatItem1", lang === "en" ? "One timeline for revenue, ad costs, returns and penalties." : "Одна лента для выручки, рекламных расходов, возвратов и штрафов.");
  setText("#authWhatItem2", lang === "en" ? "Bulk card updates and SEO routines without manual chaos." : "Массовые обновления карточек и SEO-рутины без ручного хаоса.");
  setText("#authWhatItem3", lang === "en" ? "AI-assisted review/question handling with predictable quality." : "AI-обработка отзывов и вопросов с предсказуемым качеством.");
  setText("#authStartTitle", lang === "en" ? "How to start quickly" : "Как быстро стартовать");
  setText("#authStartItem1", lang === "en" ? "Sign in as owner or create a new workspace." : "Войдите как владелец или создайте новый кабинет.");
  setText(
    "#authStartItem2",
    mobileApkMode
      ? (lang === "en" ? "Open your workspace module and start right away." : "Откройте нужный модуль и сразу начинайте работу.")
      : (lang === "en" ? "Connect WB/Ozon API keys in Profile." : "Подключите API-ключи WB/Ozon в профиле.")
  );
  setText("#authStartItem3", lang === "en" ? "Open a module and run the first workflow." : "Откройте модуль и запустите первый рабочий сценарий.");
  setText("#authPitchNote", lang === "en" ? "Designed for teams from solo operators to multi-role departments with strict access boundaries." : "Подходит как для соло-продавцов, так и для многоуровневых команд со строгими границами доступа.");
  setText("#landingCard1Title", lang === "en" ? "Revenue control center" : "Центр управления выручкой");
  setText("#landingCard1Text", lang === "en" ? "Monitor orders, units, returns, penalties and ad costs in one timeline and quickly find growth bottlenecks." : "Контролируйте заказы, штуки, возвраты, штрафы и рекламные расходы в одной ленте, чтобы быстро находить точки роста.");
  setText("#landingCard2Title", lang === "en" ? "Catalog performance" : "Эффективность каталога");
  setText("#landingCard2Text", lang === "en" ? "Sync WB/Ozon cards, enrich content, run SEO tasks and keep product visibility under control." : "Синхронизируйте карточки WB/Ozon, улучшайте контент, запускайте SEO-задачи и контролируйте видимость товаров.");
  setText("#landingCard3Title", lang === "en" ? "Team productivity" : "Продуктивность команды");
  setText("#landingCard3Quote1", lang === "en" ? "Owner has full control, employees work only within assigned modules." : "«Владелец контролирует весь кабинет, сотрудники работают только в назначенных модулях»");
  setText("#landingCard3Meta1", lang === "en" ? "Granular permissions + action history" : "Гибкие права + история действий");
  setText("#landingCard3Quote2", lang === "en" ? "AI keeps response quality high while reducing routine workload." : "«AI сохраняет качество ответов и снижает рутинную нагрузку команды»");
  setText("#landingCard3Meta2", lang === "en" ? "Reply templates + knowledge snippets" : "Шаблоны ответов + база знаний");
  setText("#landingCard4Title", lang === "en" ? "Execution modules" : "Рабочие модули");
  setText("#landingCard4Item1", lang === "en" ? "Products: import, editing, media and ranking checkpoints." : "Товары: импорт, редактирование, медиа и контроль позиций.");
  setText("#landingCard4Item2", lang === "en" ? "Feedback: reviews, questions and returns in one operational queue." : "Обратная связь: отзывы, вопросы и возвраты в единой рабочей очереди.");
  setText("#landingCard4Item3", lang === "en" ? "Ads: campaign table, analytics and actionable recommendations." : "Реклама: таблица кампаний, аналитика и рекомендации для быстрых действий.");
  setText("#landingBandTitle", lang === "en" ? "Commercial outcome" : "Коммерческий результат");
  setText("#landingBandText", lang === "en" ? "SEO WIBE shortens the cycle from data to action, reduces manual operations and helps teams scale marketplace turnover with less operational risk." : "SEO WIBE сокращает путь от данных к действию, уменьшает ручные операции и помогает командам масштабировать оборот на маркетплейсах с меньшими операционными рисками.");

  const isEn = lang === "en";
  setText("#sales .panel:nth-of-type(3) h3", isEn ? "Quick Actions" : "Быстрые действия");
  setText("#sales .panel:nth-of-type(3) .quick-actions button:nth-of-type(1)", isEn ? "Import Products" : "Импортировать товары");
  setText("#sales .panel:nth-of-type(3) .quick-actions button:nth-of-type(2)", isEn ? "Run SEO Generation" : "Запустить SEO-генерацию");
  setText("#sales .panel:nth-of-type(3) .quick-actions button:nth-of-type(3)", isEn ? "Check All Rankings" : "Проверить позиции всех");
  applyProductToolbarIcons(isEn);
  const importMarketplace = document.getElementById("importMarketplace");
  if (importMarketplace) {
    const currentValue = String(importMarketplace.value || "all");
    importMarketplace.innerHTML = `
      <option value="all">${isEn ? "All marketplaces" : "Все маркетплейсы"}</option>
      <option value="wb">WB</option>
      <option value="ozon">Ozon</option>
    `;
    if ([...importMarketplace.options].some((opt) => opt.value === currentValue)) {
      importMarketplace.value = currentValue;
    }
  }
  const categoryFilter = document.getElementById("productCategoryFilter");
  if (categoryFilter && categoryFilter.options.length) {
    if (categoryFilter.options[0]?.value === "all") {
      categoryFilter.options[0].textContent = isEn ? "All categories" : "Все категории";
    }
  }
  syncCategoryFilterState();
  setText("label[for='productPageSizeTop']", isEn ? "Rows per page" : "\u041d\u0430 \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0435");
  setText("label[for='productPageSizeBottom']", isEn ? "Rows per page" : "\u041d\u0430 \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0435");
  setText("#productsPrevTopBtn", isEn ? "Prev" : "\u041d\u0430\u0437\u0430\u0434");
  setText("#productsNextTopBtn", isEn ? "Next" : "\u0414\u0430\u043b\u0435\u0435");
  setText("#productsPrevBottomBtn", isEn ? "Prev" : "\u041d\u0430\u0437\u0430\u0434");
  setText("#productsNextBottomBtn", isEn ? "Next" : "\u0414\u0430\u043b\u0435\u0435");
  setText("#seo .panel .grid-4 button:nth-of-type(4)", isEn ? "Select all products" : "Выбрать все товары");
  setText("#seo .panel .grid-5 button:nth-of-type(1)", isEn ? "Generate Selected" : "Сгенерировать для выбранных");
  setText("#seo .panel .grid-5 button:nth-of-type(2)", isEn ? "Generate All" : "Сгенерировать для всех");
  setText("#seo .panel .grid-5 button:nth-of-type(3)", isEn ? "Apply" : "Применить");
  setText("#sales .panel:nth-of-type(4) h3", isEn ? "Sales Statistics" : "Статистика продаж");
  setText("#sales .panel:nth-of-type(4) .grid-4 button", isEn ? "Load Stats" : "Загрузить статистику");
  setText("#sales [data-sales-range='day']", isEn ? "Day" : "День");
  setText("#sales [data-sales-range='week']", isEn ? "Week" : "Неделя");
  setText("#sales [data-sales-range='month']", isEn ? "Month" : "Месяц");
  setText("#sales [data-sales-range='quarter']", isEn ? "Quarter" : "Квартал");
  setText("#sales [data-sales-range='halfyear']", isEn ? "6 months" : "6 месяцев");
  setText("#sales [data-sales-range='year']", isEn ? "Year" : "Год");
  setText("#salesExtraHint", isEn ? "Additional metrics" : "Дополнительные метрики");
  setText("#reviews .panel h3", isEn ? "Reviews WB/Ozon" : "Отзывы WB/Ozon");
  setText("#reviewsSubtabQuestions .panel h3", isEn ? "Questions & Replies WB/Ozon" : "Вопросы и ответы WB/Ozon");
  setText("#ads .panel h3", isEn ? "WB Ad Campaigns" : "Рекламные кампании WB");
  setText("#ads .grid-4 button:nth-of-type(1)", isEn ? "Load Campaigns" : "Загрузить кампании");
  setText("#ads .grid-4 button:nth-of-type(2)", isEn ? "Get Rates" : "Получить ставки");
  setText("#ads .grid-3 button", isEn ? "Reset Filters" : "Сбросить фильтры");
  setText("#adsSubtabAnalytics .panel h3", isEn ? "WB Ads Analytics" : "Аналитика рекламы WB");
  setText("#adsSubtabAnalytics .grid-4 button", isEn ? "Build Report" : "Построить отчет");
  setText("#adsSubtabRecommendations .panel h3", isEn ? "WB Ads Recommendations" : "Рекомендации WB Ads");
  setText("#adsSubtabRecommendations .grid-4 button", isEn ? "Build Recommendations" : "Построить рекомендации");
  setText("#adsSubtabBidder .panel h3", isEn ? "WB Ads Bidder" : "Бидер WB Ads");
  applyWbBidderFieldHints();
  setText("#adsSubtabOzon .panel h3", isEn ? "Ozon Ads (beta)" : "Реклама Ozon (бета)");
  setText("#profileCompanyHeader", isEn ? "Company Profile" : "Профиль компании");
  setText("#profileMainPanel h3", isEn ? "Company Profile" : "Профиль компании");
  setText("#profileMenuCompanyTitle", isEn ? "Company" : "Компания");
  setText("#profileMenuCompanyMeta", isEn ? "Company legal details and owner identity" : "Реквизиты и данные владельца/ИП");
  setText("#profileMenuPlanTitle", isEn ? "Plan" : "Тариф");
  setText("#profileMenuPlanMeta", isEn ? "Subscription, renewal and status" : "План, продление и статус");
  setText("#profileMenuKeysTitle", isEn ? "API Keys" : "API ключи");
  setText("#profileMenuKeysMeta", isEn ? "WB/Ozon integration keys" : "Подключение WB и Ozon");
  setText("#profileMenuAiTitle", isEn ? "AI Services" : "AI сервисы");
  setText("#profileMenuAiMeta", isEn ? "AI source and custom providers" : "Источник AI и пользовательские сервисы");
  setText("#profileMenuTeamTitle", isEn ? "Employees" : "Сотрудники");
  setText("#profileMenuTeamMeta", isEn ? "Roles and module access" : "Доступы и роли команды");
  setText("#profileSectionsIntroTitle", isEn ? "User profile settings" : "Настройки профиля пользователя");
  setText("#profileSectionsIntroLabel", isEn ? "Current user:" : "Текущий пользователь:");
  setText("#profileMainPanel .grid-3 button:nth-of-type(1)", isEn ? "Save Profile" : "Сохранить профиль");
  setText("#profileMainPanel .grid-3 button:nth-of-type(2)", isEn ? "Refresh Profile" : "Обновить профиль");
  setText("#profileAvatarUploadBtn", isEn ? "Upload photo" : "Загрузить фото");
  setText("#teamAvatarUploadBtn", isEn ? "Upload photo" : "Загрузить фото");
  setText("#profilePlanPanel h3", isEn ? "Plan" : "Тариф");
  setText("#profilePlanPanel .grid-4 button:nth-of-type(1)", isEn ? "Change Plan" : "Сменить тариф");
  setText("#profilePlanPanel .grid-4 button:nth-of-type(2)", isEn ? "Renew for 30 days" : "Продлить на 30 дней");
  setText("#profilePlanPanel .grid-4 button:nth-of-type(3)", isEn ? "Refresh" : "Обновить");
  setText("#profileKeysPanel h3", isEn ? "API Keys" : "API ключи");
  setText("#profileAiPanel h3", isEn ? "AI Services" : "AI сервисы");
  setText("#profileAiPanel .grid-4 button:nth-of-type(1)", isEn ? "Save AI Selection" : "Сохранить выбор AI");
  setText("#profileAiPanel .grid-4 button:nth-of-type(2)", isEn ? "Refresh AI" : "Обновить AI");
  setText("#profileAiPanel .grid-6 button", isEn ? "Add AI Service" : "Добавить AI сервис");
  setText("#profileTeamPanel h3", isEn ? "Workspace Team" : "Команда кабинета");
  setText("#teamPanelHint", isEn ? "Add or edit employees via popup window." : "Добавление и редактирование сотрудника выполняется через pop-up окно.");
  setText("#teamAddMemberBtn", isEn ? "Add employee" : "Добавить сотрудника");
  setText("#helpSubtabDocs .panel h3", isEn ? "Module Help Center" : "Справка по модулям");
  setText("#helpSubtabDocs .grid-2 button", isEn ? "Refresh Help" : "Обновить справку");
  setText("#helpSubtabAssistant .panel h3", isEn ? "AI assistant (any question)" : "AI помощник (любой вопрос)");
  setText("#helpSubtabAssistant .grid-3 button", isEn ? "Ask" : "Спросить");
  setText("#helpSubtabDownloads .panel h3", isEn ? "Android APK versions" : "Android APK версии");
  setText("#teamModalSaveBtn", isEn ? "Save" : "Сохранить");
  setText("#teamModalDeleteBtn", isEn ? "Delete" : "Удалить");
  setText("#teamMemberEditModal .actions .btn-secondary", isEn ? "Cancel" : "Отмена");
  setText("#helpSubtabDocsBtn", isEn ? "Help" : "Справка");
  setText("#helpSubtabAssistantBtn", isEn ? "AI assistant" : "AI помощник");
  setText("#helpSubtabDownloadsBtn", isEn ? "Downloads" : "Загрузки");
  setText("#mobileDrawerQuickNavLabel", isEn ? "Section" : "Раздел");
  setText("#reviewsSubtabReviewsBtn", isEn ? "Reviews" : "Отзывы");
  setText("#reviewsSubtabQuestionsBtn", isEn ? "Questions" : "Вопросы");
  setText("#reviewsSubtabReturnsBtn", isEn ? "Returns" : "Возвраты");
  setText("#productsSubtabCatalogBtn", isEn ? "Products" : "Товары");
  setText("#productsSubtabSeoBtn", isEn ? "SEO Jobs" : "SEO задачи");
  setText("#adsSubtabCampaignsBtn", isEn ? "Campaigns" : "Кампании");
  setText("#adsSubtabAnalyticsBtn", isEn ? "Analytics" : "Аналитика");
  setText("#adsSubtabRecommendationsBtn", isEn ? "Recommendations" : "Рекомендации");
  setText("#adsSubtabBidderBtn", isEn ? "Bidder" : "Бидер");
  setText("#adsSubtabOzonBtn", isEn ? "Ozon Ads" : "Реклама Ozon");
  setText("#socialSubtabGamesBtn", isEn ? "Games" : "Игры");
  setText("#socialSubtabChatBtn", isEn ? "Chat" : "Чат");
  setText("#socialSubtabTasksBtn", isEn ? "Tasks" : "Задачи");
  setText("#socialSubtabCalendarBtn", isEn ? "Calendar" : "Календарь");
  setText("#socialSubtabCalculatorBtn", isEn ? "Calculator" : "Калькулятор");
  setText("#socialSubtabNotesBtn", isEn ? "Notes" : "Заметки");
  setText("#reviews .grid-6 button.btn-secondary", isEn ? "Refresh Reviews" : "Обновить отзывы");
  setText("#reviews .grid-2 .feedback-ai-save-btn", isEn ? "Save AI" : "Сохранить AI");
  setText("#reviewsSubtabQuestions .grid-6 button.btn-secondary", isEn ? "Refresh Questions" : "Обновить вопросы");
  setText("#reviewsSubtabQuestions .grid-2 .feedback-ai-save-btn", isEn ? "Save AI" : "Сохранить AI");
  setText("#reviewsSubtabQuestions .grid-4 button:nth-of-type(1)", isEn ? "Upload to Knowledge Base" : "Загрузить в базу знаний");
  setText("#reviewsSubtabQuestions .grid-4 button:nth-of-type(2)", isEn ? "Delete Selected Document" : "Удалить выбранный документ");
  setText("#campaignDetailModal .campaign-modal-head h3", isEn ? "WB Campaign Details" : "Детали кампании WB");
  setText("#campaignDetailModal .actions button:nth-of-type(1)", isEn ? "Start" : "Запустить");
  setText("#campaignDetailModal .actions button:nth-of-type(2)", isEn ? "Pause" : "Пауза");
  setText("#campaignDetailModal .actions button:nth-of-type(3)", isEn ? "Stop" : "Остановить");
  setText("#campaignDetailModal .actions button:nth-of-type(4)", isEn ? "Refresh details" : "Обновить детали");
  setText("#productViewRefreshBtn", isEn ? "Refresh from API" : "Обновить из API");
  setText("#productViewEditBtn", isEn ? "Edit" : "Редактировать");
  setText("#productEditPhotoAddBtn", isEn ? "Add photo" : "Добавить фото");
  setText("#productEditPhotoAddUrlBtn", isEn ? "Add URL" : "Добавить URL");
  setText("#productEditPhotoPickBtn", isEn ? "Choose files" : "Выбрать файлы");
  setText("#reviews thead th:nth-child(1)", isEn ? "Status" : "Статус");
  setText("#reviews thead th:nth-child(2)", isEn ? "Date" : "Дата");
  setText("#reviews thead th:nth-child(3)", isEn ? "Product" : "Товар");
  setText("#reviews thead th:nth-child(4)", isEn ? "Rating" : "Оценка");
  setText("#reviews thead th:nth-child(5)", isEn ? "Review" : "Отзыв");
  setText("#reviews thead th:nth-child(6)", isEn ? "Reply" : "Ответ");
  setText("#reviews thead th:nth-child(7)", isEn ? "Actions" : "Действия");
  setText("#reviewsSubtabQuestions thead th:nth-child(1)", isEn ? "Status" : "Статус");
  setText("#reviewsSubtabQuestions thead th:nth-child(2)", isEn ? "Date" : "Дата");
  setText("#reviewsSubtabQuestions thead th:nth-child(3)", isEn ? "Product" : "Товар");
  setText("#reviewsSubtabQuestions thead th:nth-child(4)", isEn ? "Question" : "Вопрос");
  setText("#reviewsSubtabQuestions thead th:nth-child(5)", isEn ? "Reply" : "Ответ");
  setText("#reviewsSubtabQuestions thead th:nth-child(6)", isEn ? "Actions" : "Действия");
  setText("#ads thead th:nth-child(1)", "ID");
  setText("#ads thead th:nth-child(2)", isEn ? "Name" : "Название");
  setText("#ads thead th:nth-child(3)", isEn ? "Status" : "Статус");
  setText("#ads thead th:nth-child(4)", isEn ? "Type" : "Тип");
  setText("#ads thead th:nth-child(5)", isEn ? "Budget" : "Бюджет");
  setText("#ads thead th:nth-child(6)", isEn ? "Running" : "Работает");
  setText("#ads thead th:nth-child(7)", isEn ? "Views" : "Показы");
  setText("#ads thead th:nth-child(8)", isEn ? "Clicks" : "Клики");
  setText("#ads thead th:nth-child(9)", "CTR");
  setText("#ads thead th:nth-child(10)", isEn ? "Orders" : "Заказы");
  setText("#ads thead th:nth-child(11)", isEn ? "Spend" : "Расход");
  setText("#adsSubtabRecommendations thead th:nth-child(1)", "ID");
  setText("#adsSubtabRecommendations thead th:nth-child(2)", isEn ? "Name" : "Название");
  setText("#adsSubtabRecommendations thead th:nth-child(3)", isEn ? "Status" : "Статус");
  setText("#adsSubtabRecommendations thead th:nth-child(4)", isEn ? "Type" : "Тип");
  setText("#adsSubtabRecommendations thead th:nth-child(5)", isEn ? "Views" : "Показы");
  setText("#adsSubtabRecommendations thead th:nth-child(6)", isEn ? "Clicks" : "Клики");
  setText("#adsSubtabRecommendations thead th:nth-child(7)", "CTR");
  setText("#adsSubtabRecommendations thead th:nth-child(8)", isEn ? "Orders" : "Заказы");
  setText("#adsSubtabRecommendations thead th:nth-child(9)", isEn ? "Spend" : "Расход");
  setText("#adsSubtabRecommendations thead th:nth-child(10)", "CPC");
  setText("#adsSubtabRecommendations thead th:nth-child(11)", "CPO");
  setText("#adsSubtabRecommendations thead th:nth-child(12)", isEn ? "Priority" : "Приоритет");
  setText("#adsSubtabRecommendations thead th:nth-child(13)", isEn ? "Recommendation" : "Рекомендация");
  setText("#adsSubtabRecommendations thead th:nth-child(14)", isEn ? "Reason" : "Причина");
  setText("#sales thead th:nth-child(1)", isEn ? "Date" : "Дата");
  setText("#sales thead th:nth-child(2)", isEn ? "Marketplace" : "МП");
  setText("#sales thead th:nth-child(3)", isEn ? "Orders" : "Заказы");
  setText("#sales thead th:nth-child(4)", isEn ? "Units" : "Шт.");
  setText("#sales thead th:nth-child(5)", isEn ? "Buyouts" : "Выкупы");
  setText("#sales thead th:nth-child(6)", isEn ? "Revenue" : "Выручка");
  setText("#sales thead th:nth-child(7)", isEn ? "Returns" : "Отказы");
  setText("#sales thead th:nth-child(8)", isEn ? "Ads Spend" : "Реклама");
  setText("#sales thead th:nth-child(9)", isEn ? "Penalties" : "Штрафы");
  setText("#profileKeysPanel .cols-2 > div:nth-of-type(1) h3", "WB");
  setText("#profileKeysPanel .cols-2 > div:nth-of-type(2) h3", "Ozon");
  setTextAll("#profileKeysPanel .actions button:nth-of-type(1)", isEn ? "Save" : "Сохранить");
  setTextAll("#profileKeysPanel .actions button:nth-of-type(2)", isEn ? "Test" : "Проверить");
  setTextAll("#profileKeysPanel .actions button:nth-of-type(3)", isEn ? "Delete" : "Удалить");

  setOptions("#reviewStarsFilter", [
    isEn ? "All ratings" : "Все оценки",
    "5", "4", "3", "2", "1",
  ]);
  setOptions("#reviewStatusFilter", [
    isEn ? "All" : "Все",
    isEn ? "New" : "Новые",
    isEn ? "Unanswered" : "Неотвеченные",
    isEn ? "Answered" : "Отвеченные",
  ]);
  setOptions("#reviewDateSort", [
    isEn ? "Newest first" : "Новые сверху",
    isEn ? "Oldest first" : "Старые сверху",
  ]);
  setOptions("#questionStatusFilter", [
    isEn ? "All" : "Все",
    isEn ? "New" : "Новые",
    isEn ? "Unanswered" : "Неотвеченные",
    isEn ? "Answered" : "Отвеченные",
  ]);
  setOptions("#questionDateSort", [
    isEn ? "Newest first" : "Новые сверху",
    isEn ? "Oldest first" : "Старые сверху",
  ]);
  setOptions("#reviewAiMode", ["manual", "suggest", "auto"]);
  setOptions("#questionAiMode", ["manual", "suggest", "auto"]);
  setOptions("#profileAiSourceSelect", [
    isEn ? "Global default (admin)" : "Глобальный default (админ)",
    isEn ? "Built-in OpenAI" : "Встроенный OpenAI",
    isEn ? "Global service" : "Глобальный сервис",
    isEn ? "My service" : "Мой сервис",
  ]);
  setOptions("#wbAdsStatusFilter", [
    isEn ? "All statuses" : "Все статусы",
    isEn ? "-1 deleted" : "-1 удалена",
    isEn ? "1 draft (media)" : "1 черновик (медиа)",
    isEn ? "2 moderation (media)" : "2 модерация (медиа)",
    isEn ? "3 rejected (media)" : "3 отклонена (медиа)",
    isEn ? "4 ready to start" : "4 готова к запуску",
    isEn ? "5 scheduled (media)" : "5 запланирована (медиа)",
    isEn ? "6 running (media)" : "6 идут показы (медиа)",
    isEn ? "7 completed" : "7 завершена",
    isEn ? "8 canceled" : "8 отменена",
    isEn ? "9 active" : "9 активна",
    isEn ? "10 day-limit pause (media)" : "10 дневной лимит (медиа)",
    isEn ? "11 paused" : "11 пауза",
  ]);
  setOptions("#wbAdsTypeFilter", [
    isEn ? "All types" : "Все типы",
    "4 search",
    "5 catalog",
    "6 cards",
    "7 recommendation",
    "8 auto-cpm",
    "9 search+catalog",
    "search",
    "catalog",
    "cards",
    "auto-cpm",
  ]);
  setOptions("#wbAdsWorkingFilter", [
    isEn ? "Running: all" : "Работает: все",
    isEn ? "Only running" : "Только работает",
    isEn ? "Only stopped" : "Только не работает",
  ]);
  setOptions("#wbAdsSortBy", [
    isEn ? "ID: newest first" : "ID: новые сверху",
    isEn ? "ID: oldest first" : "ID: старые сверху",
    isEn ? "Budget: high to low" : "Бюджет: больше -> меньше",
    isEn ? "Budget: low to high" : "Бюджет: меньше -> больше",
    isEn ? "Name: A -> Z" : "Название: А -> Я",
    isEn ? "Name: Z -> A" : "Название: Я -> А",
    isEn ? "Status: code asc" : "Статус: по коду ^",
    isEn ? "Status: code desc" : "Статус: по коду v",
  ]);
  setOptions("#salesMarketplace", [
    isEn ? "All marketplaces" : "Все маркетплейсы",
    "WB",
    "Ozon",
  ]);
  setOptions("#accountingTemplateMarketplace", [
    isEn ? "Template: WB + Ozon" : "Шаблон: WB + Ozon",
    isEn ? "Template: WB only" : "Шаблон: только WB",
    isEn ? "Template: Ozon only" : "Шаблон: только Ozon",
  ]);
  setOptions("#salesMetricMode", [
    isEn ? "Units" : "Штуки",
    isEn ? "Buyouts" : "Выкупы",
    isEn ? "Revenue" : "Выручка",
    isEn ? "Income" : "Приход",
    isEn ? "Expense" : "Расход",
    isEn ? "Net" : "Изменение баланса",
    isEn ? "Orders" : "Заказы",
    isEn ? "Returns" : "Отказы",
    isEn ? "Ads Spend" : "Реклама",
    isEn ? "Penalties" : "Штрафы",
  ]);
  setCheckLabel("#sales .sales-chart-controls label:nth-of-type(1)", "WB");
  setOptions("#salesMarketplace", [
    isEn ? "All marketplaces" : "Все маркетплейсы",
    "WB",
    "Ozon",
  ]);
  setOptions("#accountingTemplateMarketplace", [
    isEn ? "Template: WB + Ozon" : "Шаблон: WB + Ozon",
    isEn ? "Template: WB only" : "Шаблон: только WB",
    isEn ? "Template: Ozon only" : "Шаблон: только Ozon",
  ]);
  setOptions("#salesMetricMode", [
    isEn ? "Units" : "Штуки",
    isEn ? "Buyouts" : "Выкупы",
    isEn ? "Revenue" : "Выручка",
    isEn ? "Income" : "Приход",
    isEn ? "Expense" : "Расход",
    isEn ? "Net" : "Изменение баланса",
    isEn ? "Orders" : "Заказы",
    isEn ? "Returns" : "Отказы",
    isEn ? "Ads Spend" : "Реклама",
    isEn ? "Penalties" : "Штрафы",
  ]);
  setCheckLabel("#sales .sales-chart-controls label:nth-of-type(2)", "Ozon");

  const placeholders = [
    ["#loginEmail", "Email"],
    ["#regEmail", "Email"],
    ["#loginPassword", isEn ? "Password" : "Пароль"],
    ["#regPassword", isEn ? "Password (>=8)" : "Пароль (>=8)"],
    ["#productFilter", isEn ? "Filter by article/name" : "Фильтр: артикул/название"],
    ["#positionKeywords", isEn ? "Ranking keywords (optional)" : "Ключи для проверки (опционально)"],
    ["#extraKeywords", isEn ? "Extra keywords (optional)" : "Доп. ключи (опционально)"],
    ["#seoFilter", isEn ? "Filter: article/product/status" : "Фильтр: артикул/товар/статус"],
    ["#wbAdsSearch", isEn ? "Search by ID/name" : "Поиск по ID/названию"],
    ["#wbAdsBudgetMin", isEn ? "Budget from" : "Бюджет от"],
    ["#wbAdsBudgetMax", isEn ? "Budget to" : "Бюджет до"],
    ["#questionAiPrompt", isEn ? "Optional prompt for question replies" : "Промпт для генерации ответов на вопросы (опционально)"],
    ["#reviewAiPrompt", isEn ? "Optional prompt for review replies" : "Промпт для генерации ответов (опционально)"],
    ["#adsAnalyticsCampaignId", isEn ? "campaign_id (optional)" : "campaign_id (опционально)"],
    ["#adsRecMinSpent", isEn ? "Min spend" : "Мин. расход"],
    ["#profileFullName", isEn ? "Director / Sole proprietor full name" : "ФИО директора/ИП"],
    ["#profilePositionTitle", isEn ? "Position title" : "Должность"],
    ["#profileCompanyName", isEn ? "Company name" : "Название компании"],
    ["#profileCity", isEn ? "City" : "Город"],
    ["#profileLegalName", isEn ? "Legal entity name" : "Юридическое наименование"],
    ["#profileLegalAddress", isEn ? "Legal address" : "Юридический адрес"],
    ["#profileTaxId", isEn ? "Tax ID" : "ИНН"],
    ["#profileTaxRate", isEn ? "Tax rate, %" : "Налоговая ставка, %"],
    ["#profilePhone", isEn ? "Phone" : "Телефон"],
    ["#profileTeamSize", isEn ? "Team size" : "Размер команды, чел."],
    ["#profileAvatarUrl", isEn ? "Avatar URL" : "Ссылка на аватар"],
    ["#profileCompanyStructure", isEn ? "Team structure, roles, departments" : "Структура команды, роли, отделы"],
    ["#teamModalEmail", isEn ? "Employee email" : "Email сотрудника"],
    ["#teamModalPassword", isEn ? "New password (optional)" : "Новый пароль (опц.)"],
    ["#teamModalPhone", isEn ? "Phone" : "Телефон"],
    ["#teamModalFullName", isEn ? "Full name" : "ФИО"],
    ["#teamModalCity", isEn ? "City" : "Город"],
    ["#teamModalPosition", isEn ? "Position title" : "Должность"],
    ["#teamModalNickname", isEn ? "Nickname" : "Ник"],
    ["#teamModalAvatar", isEn ? "Avatar URL" : "Ссылка на аватар"],
    ["#profileAiName", isEn ? "AI service name" : "Название AI сервиса"],
    ["#profileAiModel", isEn ? "Model (e.g. gpt-4o-mini)" : "Модель (например gpt-4o-mini)"],
    ["#profileAiBaseUrl", isEn ? "Base URL (optional)" : "Base URL (опционально)"],
    ["#profileAiApiKey", isEn ? "Service API key" : "API key сервиса"],
    ["#helpAssistantQuestion", isEn ? "Ask any question" : "Задайте любой вопрос"],
  ];
  for (const [selector, text] of placeholders) {
    const el = document.querySelector(selector);
    if (el) el.placeholder = text;
  }
  const teamModal = document.getElementById("teamMemberEditModal");
  if (teamModal && !teamModal.classList.contains("hidden")) {
    if (teamModalMode === "create") {
      applyTeamModalHeader("create", null);
    } else {
      applyTeamModalHeader("edit", findTeamMemberById(activeTeamMemberId));
    }
  }
  applyFeedbackPromptVisibility("review");
  applyFeedbackPromptVisibility("question");
  switchAuthMode(authMode);

  const themeSel = document.getElementById("uiThemeSelect");
  if (themeSel) {
    const labels = [
      ["classic", t("theme_classic")],
      ["dark", t("theme_dark")],
      ["light", t("theme_light")],
      ["moon", t("theme_moon")],
      ["newyear", t("theme_newyear")],
      ["summer", t("theme_summer")],
      ["autumn", t("theme_autumn")],
      ["winter", t("theme_winter")],
      ["spring", t("theme_spring")],
      ["japan", t("theme_japan")],
      ["greenland", t("theme_greenland")],
    ];
    for (const [value, label] of labels) {
      const opt = [...themeSel.options].find((x) => x.value === value);
      if (opt) opt.textContent = label;
    }
  }
  syncMobileDrawerSelectors();

  const helpModule = document.getElementById("helpModuleSelect");
  if (helpModule) delete helpModule.dataset.ready;
  refreshSectionHeading();
  updateReviewLoadStatus();
  updateQuestionLoadStatus();
  updateWbAdsLoadStatus();
  updateAdsRecLoadStatus();
  updateSalesLoadStatus();
  syncProductsPagerControls();
  applyUiThemeSettingsToSelect();
  if (typeof renderTeamAccessOptions === "function") {
    renderTeamAccessOptions();
  }
  renderTeamMembers();
  if (profileAiState) renderProfileAiState(profileAiState);
  renderHelpAssistantHistory();
  renderHelpAssistantModuleOptions();
  if (typeof applyAccountingUiLanguage === "function") {
    applyAccountingUiLanguage();
  }
  refreshMobileQuickNavOptions();
  syncMobileQuickNavSelection();
  applyModuleActionIcons();
}

function changeUiLang() {
  const raw = (document.getElementById("uiLangSelect")?.value || "ru").toLowerCase();
  currentLang = raw === "en" ? "en" : "ru";
  applyUiLanguage();
  if (typeof applyAccountingUiLanguage === "function") {
    applyAccountingUiLanguage();
  }
  applyButtonTooltips();
  if (currentTab === "reviews") renderWbReviews();
  if (currentTab === "reviews") renderWbQuestions();
  if (currentTab === "ads") {
    renderWbCampaignRows();
    renderAdsAnalyticsRows();
    renderAdsRecommendationsRows();
  }
  if (currentTab === "help") loadHelpWorkspace();
  if (currentTab === "accounting" && typeof loadAccountingWorkspace === "function") loadAccountingWorkspace();
  if (currentTab === "sales") renderSalesStats();
  if (currentTab === "profile") loadProfile();
}

function changeUiLangFromDrawer() {
  const drawer = document.getElementById("mobileDrawerLangSelect");
  const top = document.getElementById("uiLangSelect");
  if (drawer && top) top.value = drawer.value;
  changeUiLang();
}

function changeThemeFromDrawer() {
  if (Boolean(uiThemeSettings.force_theme) || !uiThemeSettings.theme_choice_enabled) return;
  const drawer = document.getElementById("mobileDrawerThemeSelect");
  const top = document.getElementById("uiThemeSelect");
  if (!drawer || !top) return;
  top.value = drawer.value || "classic";
  changeTheme();
}

window.changeUiLang = changeUiLang;
window.changeUiLangFromDrawer = changeUiLangFromDrawer;
window.changeThemeFromDrawer = changeThemeFromDrawer;
window.refreshSectionHeading = refreshSectionHeading;

async function requestJson(url, opts = {}) {
  const timeoutMs = Math.max(0, Number(opts.timeoutMs || 0));
  const fetchOptsBase = { credentials: "same-origin", ...opts };
  if (fetchOptsBase.cache === undefined && String(url || "").startsWith("/api/")) {
    fetchOptsBase.cache = "no-store";
  }
  delete fetchOptsBase.timeoutMs;
  delete fetchOptsBase.maxRetries;
  delete fetchOptsBase.retryOnPost;
  delete fetchOptsBase.retryStatuses;
  delete fetchOptsBase.retryBaseDelayMs;

  const method = String(fetchOptsBase.method || "GET").trim().toUpperCase() || "GET";
  const isIdempotentMethod = ["GET", "HEAD", "OPTIONS", "PUT", "PATCH", "DELETE"].includes(method);
  const allowRetry = isIdempotentMethod || Boolean(opts.retryOnPost);
  const defaultRetries = allowRetry ? (method === "GET" || method === "HEAD" || method === "OPTIONS" ? 2 : 1) : 0;
  const maxRetries = Math.max(0, Number.isFinite(Number(opts.maxRetries)) ? Number(opts.maxRetries) : defaultRetries);
  const retryStatuses = new Set(
    Array.isArray(opts.retryStatuses) && opts.retryStatuses.length
      ? opts.retryStatuses.map((x) => Number(x)).filter((x) => Number.isFinite(x))
      : [408, 425, 429, 500, 502, 503, 504]
  );
  const retryBaseDelayMs = Math.max(120, Number(opts.retryBaseDelayMs || 320));

  const copyHeaders = (raw) => {
    if (!raw) return {};
    if (raw instanceof Headers) {
      const out = {};
      raw.forEach((v, k) => { out[k] = v; });
      return out;
    }
    if (Array.isArray(raw)) {
      const out = {};
      for (const pair of raw) {
        if (!Array.isArray(pair) || pair.length < 2) continue;
        out[String(pair[0])] = String(pair[1]);
      }
      return out;
    }
    if (typeof raw === "object") return { ...raw };
    return {};
  };

  const makeRequestId = () => {
    try {
      if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    } catch (_) {}
    return `req-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
  };

  const compactRawText = (raw) => {
    const normalized = String(raw || "").replace(/\s+/g, " ").trim();
    if (!normalized) return "";
    return normalized.length > 280 ? `${normalized.slice(0, 277)}...` : normalized;
  };

  const looksLikeHtmlError = (raw) => /<\s*!doctype|<\s*html|<\/\s*html|nginx|bad gateway/i.test(String(raw || ""));
  const friendlyHttpMessage = (status, raw = "") => {
    const code = Number(status || 0);
    const htmlError = looksLikeHtmlError(raw);
    if (code === 502 || code === 503 || code === 504) {
      return currentLang === "en"
        ? "Service is temporarily unavailable or restarting. Please retry in a few seconds."
        : "Сервис временно недоступен или перезапускается. Повторите запрос через несколько секунд.";
    }
    if (htmlError) {
      return currentLang === "en"
        ? `Server returned an HTML error page${code ? ` (HTTP ${code})` : ""}. Please retry.`
        : `Сервер вернул HTML-страницу ошибки${code ? ` (HTTP ${code})` : ""}. Повторите запрос.`;
    }
    return "";
  };

  const makeRequestError = (message, extra = {}) => {
    const err = new Error(String(message || (currentLang === "en" ? "Request error" : "Ошибка запроса")));
    err.kind = String(extra.kind || "http");
    err.url = String(extra.url || url || "");
    if (Number.isFinite(Number(extra.status)) && Number(extra.status) > 0) {
      err.status = Number(extra.status);
    }
    if (extra.payload !== undefined) err.payload = extra.payload;
    if (typeof extra.rawText === "string") {
      err.rawText = extra.rawText;
      err.raw_text = extra.rawText;
    }
    if (extra.cause !== undefined) err.cause = extra.cause;
    return err;
  };

  const parseResponseBody = async (response) => {
    const text = await response.text().catch(() => "");
    const rawText = compactRawText(text);
    if (!String(text || "").trim()) {
      return {
        ok: true,
        hasBody: false,
        payload: {},
        rawText,
      };
    }
    try {
      return {
        ok: true,
        hasBody: true,
        payload: JSON.parse(text),
        rawText,
      };
    } catch (parseError) {
      return {
        ok: false,
        hasBody: true,
        payload: null,
        rawText,
        parseError,
      };
    }
  };

  const headersTemplate = copyHeaders(fetchOptsBase.headers);
  const requestId = method !== "GET" && method !== "HEAD" && method !== "OPTIONS" ? makeRequestId() : "";
  if (requestId && !headersTemplate["X-Request-ID"] && !headersTemplate["x-request-id"]) {
    headersTemplate["X-Request-ID"] = requestId;
  }

  let lastError = null;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const fetchOpts = {
      ...fetchOptsBase,
      method,
      headers: copyHeaders(headersTemplate),
    };

    let timer = null;
    if (timeoutMs > 0) {
      const controller = new AbortController();
      fetchOpts.signal = controller.signal;
      timer = setTimeout(() => controller.abort(), timeoutMs);
    }

    try {
      const response = await fetch(url, fetchOpts);
      const refreshed = response.headers.get("x-auth-refresh");
      if (refreshed) {
        setToken(refreshed, tokenStorage === "local");
      }

      const parsed = await parseResponseBody(response);
      if (response.ok) {
        if (!parsed.hasBody) return {};
        if (parsed.ok) return parsed.payload;
        throw makeRequestError(
          currentLang === "en" ? "Server returned an invalid response." : "Сервер вернул некорректный ответ.",
          {
            kind: "parse",
            status: response.status,
            payload: null,
            rawText: parsed.rawText,
            cause: parsed.parseError,
          }
        );
      }

      const payload = parsed.ok ? parsed.payload : {};
      let detail = payload && typeof payload === "object"
        ? String(payload.detail || payload.message || "").trim()
        : "";
      if (detail && typeof decodePossiblyMojibake === "function") {
        detail = String(decodePossiblyMojibake(detail) || detail).trim();
      }
      if (!detail) {
        detail = friendlyHttpMessage(response.status, parsed.rawText);
      }
      const err = makeRequestError(
        detail || parsed.rawText || (currentLang === "en" ? "Request error" : "Ошибка запроса"),
        {
          kind: parsed.ok ? "http" : "parse",
          status: response.status,
          payload,
          rawText: parsed.rawText,
          cause: parsed.ok ? undefined : parsed.parseError,
        }
      );
      lastError = err;
      if (response.status === 401 || response.status === 403) {
        const safeUrl = String(url || "");
        const isAuthEndpoint = safeUrl.includes("/api/auth/login")
          || safeUrl.includes("/api/auth/register")
          || safeUrl.includes("/api/auth/logout")
          || safeUrl.includes("/api/auth/me");
        if (!isAuthEndpoint) {
          try { scheduleEnsureAuth(450, false); } catch (_) {}
        }
      }

      if (attempt < maxRetries && allowRetry && retryStatuses.has(Number(response.status || 0))) {
        const backoff = Math.round(retryBaseDelayMs * (2 ** attempt) + Math.random() * 180);
        await delay(backoff);
        continue;
      }
      throw err;
    } catch (e) {
      const existingKind = String(e?.kind || "").trim().toLowerCase();
      const isAbort = e?.name === "AbortError" || existingKind === "timeout";
      const msg = String(e?.message || "").toLowerCase();
      const isFetchNetwork = existingKind === "network"
        || (!existingKind && (isAbort
          || msg.includes("failed to fetch")
          || msg.includes("networkerror")
          || msg.includes("load failed")
          || msg.includes("network")));
      if (attempt < maxRetries && allowRetry && isFetchNetwork) {
        lastError = e;
        const backoff = Math.round(retryBaseDelayMs * (2 ** attempt) + Math.random() * 180);
        await delay(backoff);
        continue;
      }
      if (isAbort) {
        throw makeRequestError(
          currentLang === "en" ? "Request timed out. Please retry." : "Превышено время ожидания. Повторите запрос.",
          { kind: "timeout", cause: e }
        );
      }
      if (isFetchNetwork) {
        throw makeRequestError(
          currentLang === "en" ? "Network error. Check connection and retry." : "Сетевая ошибка. Проверьте подключение и повторите.",
          { kind: "network", cause: e }
        );
      }
      if (e && typeof e === "object" && !e.url) e.url = String(url || "");
      throw e;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  if (lastError?.name === "AbortError") {
    throw makeRequestError(
      currentLang === "en" ? "Request timed out. Please retry." : "Превышено время ожидания. Повторите запрос.",
      { kind: "timeout", cause: lastError }
    );
  }
  if (isNetworkError(lastError)) {
    throw makeRequestError(
      currentLang === "en" ? "Network error. Check connection and retry." : "Сетевая ошибка. Проверьте подключение и повторите.",
      { kind: "network", cause: lastError }
    );
  }
  throw lastError || new Error(currentLang === "en" ? "Request error" : "Ошибка запроса");
}
function isNetworkError(err) {
  const msg = String(err?.message || "").toLowerCase();
  return msg.includes("network error")
    || msg.includes("сетевая ошибка")
    || msg.includes("failed to fetch")
    || msg.includes("load failed")
    || msg.includes("networkerror")
    || msg.includes("timeout")
    || msg.includes("timed out")
    || msg.includes("time out")
    || msg.includes("время ожидания")
    || msg.includes("превышено время ожидания");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
}

function setBusy(label = "", active = false, hint = "") {
  const overlay = document.getElementById("busyOverlay");
  if (!overlay) return;
  const defaultLabel = currentLang === "en" ? "Processing…" : "Выполняем операцию…";
  const defaultHint = currentLang === "en" ? "Usually it takes around 20-40 seconds." : "Обычно это занимает до 20-40 секунд.";
  document.getElementById("busyTitle").textContent = label || defaultLabel;
  document.getElementById("busyHint").textContent = hint || defaultHint;
  overlay.classList.toggle("hidden", !active);
}

async function withBusy(label, fn, hint) {
  setBusy(label, true, hint);
  try {
    return await fn();
  } finally {
    setBusy("", false);
  }
}

async function tryRequestChain(requests) {
  let lastError = null;
  for (const req of requests) {
    const res = await requestJson(req.url, req.opts).catch((e) => {
      lastError = e;
      return null;
    });
    if (res !== null) return res;
  }
  if (lastError) throw lastError;
  throw new Error(tr("Ошибка запроса", "Request error"));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function formatPositionValue(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num) || num <= 0) return tr("н/д", "n/a");
  if (num > POSITION_LIMIT) return `${POSITION_LIMIT + 1}+`;
  return String(Math.round(num));
}

const BUTTON_TIPS = {
  ru: {
    "Импорт": "Импортирует товары из выбранного маркетплейса в локальную базу.",
    "Перезагрузить базу": "Полностью пересоздает локальную базу товаров по выбранному маркетплейсу.",
    "Проверить выбранные": "Проверяет позиции только выбранных товаров по указанным ключам.",
    "Проверить все": "Проверяет позиции всех товаров в базе.",
    "Сгенерировать": "Создаёт черновик ответа AI по тексту клиента.",
    "Отправить": "Публикует ответ в маркетплейс.",
    "Обновить": "Обновляет ранее отправленный ответ в маркетплейсе.",
    "Загрузить кампании": "Загружает список рекламных кампаний из кабинета WB Ads.",
    "Получить ставки": "Запрашивает ставки по выбранной рекламной кампании.",
    "Сбросить фильтры": "Сбрасывает фильтры и сортировку рекламных кампаний.",
    "Построить отчет": "Формирует аналитический отчет по WB Ads за выбранный период.",
    "Построить рекомендации": "Формирует список приоритетных действий по оптимизации рекламных кампаний.",
    "Загрузить статистику": "Загружает продажи за выбранный период и строит график.",
    "Сохранить профиль": "Сохраняет данные профиля и компании пользователя.",
    "Обновить профиль": "Перезагружает данные профиля с сервера.",
    "Сменить план": "Переключает текущий тариф учётной записи.",
    "Продлить на 30 дней": "Продлевает тариф на следующий расчетный период.",
    "Сменить пароль": "Изменяет пароль текущего аккаунта.",
    "Загрузить в базу знаний": "Загружает документ, который AI будет учитывать в ответах.",
    "Удалить выбранный документ": "Удаляет выбранный документ из базы знаний AI.",
    "Обновить справку": "Перезагружает справочную информацию по модулям.",
  },
  en: {
    "Import": "Imports products from selected marketplace into local catalog.",
    "Reload Catalog": "Rebuilds local product catalog for selected marketplace.",
    "Check Selected": "Checks rankings for selected products and keywords.",
    "Check All": "Checks rankings for all products in catalog.",
    "Generate": "Creates AI draft reply from customer text.",
    "Send": "Publishes reply to marketplace.",
    "Update": "Updates previously published reply in marketplace.",
    "Load Campaigns": "Loads campaign list from WB Ads cabinet.",
    "Get Rates": "Requests bid rates for selected campaign.",
    "Reset Filters": "Resets campaign filters and sorting.",
    "Build Report": "Builds WB Ads analytics report for selected period.",
    "Build Recommendations": "Builds prioritized optimization actions for ad campaigns.",
    "Load Stats": "Loads sales stats for selected period and builds chart.",
    "Save Profile": "Saves personal and company profile data.",
    "Refresh Profile": "Reloads profile data from server.",
    "Change Plan": "Switches current account billing plan.",
    "Renew for 30 days": "Extends billing period by 30 days.",
    "Change Password": "Updates current account password.",
    "Upload to Knowledge Base": "Uploads document used by AI when generating replies.",
    "Delete Selected Document": "Removes selected document from AI knowledge base.",
    "Refresh Help": "Reloads module documentation.",
  },
};

function inferButtonTip(text) {
  const cleaned = String(text || "").trim();
  if (!cleaned) return "";
  try {
    const body = document.body;
    const href = String(window.location?.href || "");
    const isAppShell = Boolean(
      body?.classList?.contains("mobile-client-mode")
      || body?.classList?.contains("mobile-apk-mode")
      || /([?&])mobile_app=1(?:[&#]|$)/i.test(href)
      || typeof window.ReactNativeWebView !== "undefined"
      || (navigator.maxTouchPoints || 0) > 0
    );
    if (isAppShell) return "";
  } catch (_) {}
  const dict = BUTTON_TIPS[currentLang] || BUTTON_TIPS.ru;
  if (dict[cleaned]) return dict[cleaned];
  if (currentLang !== "en") return `\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435: ${cleaned}`;
  return `Action: ${cleaned}`;
}

function applyButtonTooltips() {
  document.querySelectorAll("button").forEach((btn) => {
    const forced = (btn.dataset.tip || "").trim();
    if (forced) return;
    const label = btn.textContent || "";
    btn.dataset.tip = inferButtonTip(label);
  });
}

let hoverTipTimer = null;
let hoverTipTarget = null;
const HOVER_TIP_DELAY_MS = 320;

function hideHoverTip() {
  const tip = document.getElementById("hoverTip");
  if (!tip) return;
  tip.classList.add("hidden");
  tip.textContent = "";
}

function showHoverTip(target, text) {
  const tip = document.getElementById("hoverTip");
  if (!tip || !target || !text) return;
  tip.textContent = text;
  tip.classList.remove("hidden");
  const rect = target.getBoundingClientRect();
  const maxLeft = window.innerWidth - tip.offsetWidth - 10;
  const left = Math.max(10, Math.min(rect.left, maxLeft));
  const top = Math.max(10, rect.top - tip.offsetHeight - 8);
  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;
}

function initHoverTips() {
  try {
    const body = document.body;
    const href = String(window.location?.href || "");
    const isAppShell = Boolean(
      body?.classList?.contains("mobile-client-mode")
      || body?.classList?.contains("mobile-apk-mode")
      || /([?&])mobile_app=1(?:[&#]|$)/i.test(href)
      || typeof window.ReactNativeWebView !== "undefined"
      || (navigator.maxTouchPoints || 0) > 0
    );
    if (isAppShell) {
      hideHoverTip();
      return;
    }
  } catch (_) {}
  document.addEventListener("mouseover", (e) => {
    const el = e.target?.closest?.("button,[data-tip]");
    if (!el) return;
    if (!el.dataset.tip) {
      el.dataset.tip = inferButtonTip(el.textContent || "");
    }
    const tipText = String(el.dataset.tip || "").trim();
    if (!tipText) return;
    if (hoverTipTimer) clearTimeout(hoverTipTimer);
    hoverTipTarget = el;
    hoverTipTimer = setTimeout(() => {
      if (hoverTipTarget !== el) return;
      showHoverTip(el, tipText);
    }, HOVER_TIP_DELAY_MS);
  });
  document.addEventListener("mouseout", (e) => {
    const el = e.target?.closest?.("button,[data-tip]");
    if (!el) return;
    if (hoverTipTimer) clearTimeout(hoverTipTimer);
    hoverTipTarget = null;
    hideHoverTip();
  });
  document.addEventListener("focusin", (e) => {
    const el = e.target?.closest?.("button,[data-tip]");
    if (!el) return;
    if (!el.dataset.tip) {
      el.dataset.tip = inferButtonTip(el.textContent || "");
    }
    const tipText = String(el.dataset.tip || "").trim();
    if (!tipText) return;
    if (hoverTipTimer) clearTimeout(hoverTipTimer);
    hoverTipTarget = el;
    hoverTipTimer = setTimeout(() => {
      if (hoverTipTarget !== el) return;
      showHoverTip(el, tipText);
    }, 120);
  });
  document.addEventListener("focusout", () => {
    if (hoverTipTimer) clearTimeout(hoverTipTimer);
    hoverTipTarget = null;
    hideHoverTip();
  });
  window.addEventListener("scroll", hideHoverTip, { passive: true });
  window.addEventListener("resize", hideHoverTip, { passive: true });
}

async function loadTrend({ productId = null, days = 21 } = {}) {
  const qp = new URLSearchParams({ days: String(days) });
  if (productId) qp.set("product_id", String(productId));
  const data = await requestJson(`/api/seo/trend?${qp.toString()}`, { headers: authHeaders() }).catch(() => null);
  return data?.points || [];
}

function renderTrendChart(svgId, metaId, points) {
  const svg = document.getElementById(svgId);
  const meta = document.getElementById(metaId);
  if (!svg || !meta) return;

  if (!points.length) {
    clearChartHost(svg);
    meta.textContent = tr("Пока нет данных по проверкам.", "No checks data yet.");
    return;
  }

  const values = points.map((p) => (p.avg_position > 0 ? p.avg_position : 50));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const width = 720;
  const height = 180;
  const padX = 16;
  const padY = 14;
  const step = (width - padX * 2) / Math.max(1, points.length - 1);

  const coords = points
    .map((p, i) => {
      const v = p.avg_position > 0 ? p.avg_position : 50;
      const x = padX + i * step;
      const y = padY + ((v - min) / range) * (height - padY * 2);
      return [x, y];
    });

  const polyline = coords.map(([x, y]) => `${x},${y}`).join(" ");
  const avgAll = points.filter((p) => p.avg_position > 0);
  const avgPos = avgAll.length ? (avgAll.reduce((a, b) => a + b.avg_position, 0) / avgAll.length).toFixed(2) : "-";
  const checks = points.reduce((a, b) => a + b.checks, 0);
  const top5 = points.reduce((a, b) => a + b.top5_hits, 0);

  const echartsHost = canUseEcharts(svg) ? svg : null;
  if (echartsHost) {
    const chart = getOrCreateChart(echartsHost);
    if (chart) {
      chart.setOption(
        {
          animationDuration: 380,
          grid: { top: 18, right: 18, bottom: 24, left: 44 },
          tooltip: {
            trigger: "axis",
            backgroundColor: "rgba(17,31,58,0.92)",
            borderWidth: 0,
            textStyle: { color: "#eff6ff" },
          },
          xAxis: {
            type: "category",
            boundaryGap: false,
            data: points.map((p) => String(p.bucket || p.date || "").slice(-5)),
            axisLine: { lineStyle: { color: "rgba(97,122,156,0.35)" } },
            axisLabel: { color: "#6f86a7", fontSize: 11 },
            axisTick: { show: false },
          },
          yAxis: {
            type: "value",
            inverse: true,
            min,
            max,
            splitLine: { lineStyle: { color: "rgba(95,121,162,0.17)" } },
            axisLabel: { color: "#6f86a7", fontSize: 11 },
          },
          series: [
            {
              name: tr("Позиция", "Rank"),
              type: "line",
              smooth: true,
              showSymbol: false,
              lineStyle: { width: 3, color: "#2f8cff" },
              areaStyle: {
                color: {
                  type: "linear",
                  x: 0, y: 0, x2: 0, y2: 1,
                  colorStops: [
                    { offset: 0, color: "rgba(47,140,255,0.24)" },
                    { offset: 1, color: "rgba(47,140,255,0.02)" },
                  ],
                },
              },
              data: points.map((p) => (p.avg_position > 0 ? p.avg_position : 50)),
            },
          ],
        },
        true
      );
      meta.innerHTML = `
        <span>${tr("Проверок", "Checks")}: <b>${checks}</b></span>
        <span>${tr("Средняя позиция", "Average rank")}: <b>${avgPos}</b></span>
        <span>${tr("Входов в топ-5", "Top-5 hits")}: <b>${top5}</b></span>
      `;
      return;
    }
  }

  const fallbackMarkup = `
    <defs>
      <linearGradient id="${svgId}-line" x1="0%" x2="100%" y1="0%" y2="0%">
        <stop offset="0%" stop-color="#21e7ff"/>
        <stop offset="100%" stop-color="#7b8dff"/>
      </linearGradient>
    </defs>
    <polyline points="${polyline}" fill="none" stroke="url(#${svgId}-line)" stroke-width="3" stroke-linecap="round" />
  `;
  if (String(svg.tagName || "").toLowerCase() === "svg") {
    svg.innerHTML = fallbackMarkup;
  } else {
    svg.innerHTML = `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">${fallbackMarkup}</svg>`;
  }
  meta.innerHTML = `
    <span>${tr("Проверок", "Checks")}: <b>${checks}</b></span>
    <span>${tr("Средняя позиция", "Average rank")}: <b>${avgPos}</b></span>
    <span>${tr("Входов в топ-5", "Top-5 hits")}: <b>${top5}</b></span>
  `;
}

function renderSeoKanban(rows) {
  const board = document.getElementById("seoKanban");
  if (!board) return;
  const columns = [
    { key: "generated", title: tr("Сгенерировано", "Generated"), cls: "generated" },
    { key: "in_progress", title: tr("В работе", "In progress"), cls: "in-progress" },
    { key: "applied", title: tr("Применено", "Applied"), cls: "applied" },
    { key: "top_reached", title: tr("Топ-5 достигнут", "Top-5 reached"), cls: "top" },
  ];

  const html = columns
    .map((c) => {
      const items = rows.filter((r) => r.status === c.key).slice(0, 6);
      return `
        <section class="kanban-col ${c.cls}">
          <header><strong>${c.title}</strong><span>${rows.filter((r) => r.status === c.key).length}</span></header>
          <div class="kanban-items">
            ${
              items.length
                ? items
                    .map(
                      (i) => `
                <article class="kanban-item">
                  <div>${escapeHtml(i.product_article || "-")}</div>
                  <small>${escapeHtml(i.product_name || tr("Товар", "Product"))}</small>
                </article>
              `
                    )
                    .join("")
                : `<div class="kanban-empty">${tr("Нет задач", "No jobs")}</div>`
            }
          </div>
        </section>
      `;
    })
    .join("");
  board.innerHTML = html;
}

async function renderProductPreview(product) {
  const card = document.getElementById("productPreviewCard");
  if (!card) return;
  if (!product) {
    card.innerHTML = `<p class="hint">${tr("Выберите товар в таблице.", "Select a product in table.")}</p>`;
    renderTrendChart("productTrendChart", "productTrendMeta", []);
    renderProductDetailsPane(null, null);
    return;
  }
  const photo = product.photo_url
    ? `<div class="preview-photo-wrap"><img class="preview-photo" src="${escapeHtml(product.photo_url)}" alt="${escapeHtml(product.name || "photo")}"></div>`
    : `<div class="preview-photo-wrap"><div class="preview-photo ph"></div></div>`;
  card.innerHTML = `
    ${photo}
    <h4>${escapeHtml(product.name)}</h4>
    <div class="preview-grid">
      <span>${tr("Артикул", "Article")}</span><b>${escapeHtml(product.article)}</b>
      <span>${tr("Баркод", "Barcode")}</span><b>${escapeHtml(product.barcode || "-")}</b>
      <span>${tr("Маркетплейс", "Marketplace")}</span><b>${escapeHtml((product.marketplace || "").toUpperCase())}</b>
      <span>${tr("Позиция", "Rank")}</span><b>${escapeHtml(formatPositionValue(product.last_position))}</b>
    </div>
  `;
  const previewImg = card.querySelector(".preview-photo");
  if (previewImg) {
    previewImg.onerror = () => {
      const wrap = previewImg.parentElement;
      if (!wrap) return;
      wrap.innerHTML = '<div class="preview-photo ph"></div>';
    };
  }
  const points = await loadTrend({ productId: product.id, days: 21 });
  renderTrendChart("productTrendChart", "productTrendMeta", points);
}

function renderProductDetailsPane(product, payload) {
  const warnEl = document.getElementById("productDetailsWarn");
  const photosEl = document.getElementById("productDetailsPhotos");
  const rawEl = document.getElementById("productDetailRaw");
  const nameEl = document.getElementById("productDetailName");
  const descEl = document.getElementById("productDetailDescription");
  const photoEl = document.getElementById("productDetailPhotoUrl");
  const kwEl = document.getElementById("productDetailKeywords");
  if (!warnEl || !photosEl || !rawEl || !nameEl || !descEl || !photoEl || !kwEl) return;
  if (!product) {
    warnEl.textContent = tr("Выберите товар в таблице, чтобы увидеть детали.", "Select a product in table to view details.");
    photosEl.innerHTML = "";
    rawEl.textContent = "-";
    nameEl.value = "";
    descEl.value = "";
    photoEl.value = "";
    kwEl.value = "";
    return;
  }
  const warnings = Array.isArray(payload?.warnings) ? payload.warnings.filter(Boolean) : [];
  warnEl.textContent = warnings.length
    ? warnings.join(" | ")
    : tr("Детали карточки загружены. Можно редактировать и сохранять.", "Product details loaded. You can edit and save.");
  const photos = Array.isArray(payload?.photos)
    ? payload.photos.filter((x) => typeof x === "string" && x.trim())
    : [];
  const fallbackPhoto = String(product.photo_url || "").trim();
  const photoRows = photos.length ? photos : (fallbackPhoto ? [fallbackPhoto] : []);
  photosEl.innerHTML = photoRows.length
    ? photoRows.map((url, idx) => `<img src="${escapeHtml(url)}" alt="product-photo-${idx + 1}" class="product-detail-photo" loading="lazy" />`).join("")
    : `<div class="hint">${tr("Фотографии не найдены.", "No photos found.")}</div>`;
  nameEl.value = String(payload?.product?.name || product?.name || "");
  descEl.value = String(payload?.product?.current_description || product?.current_description || "");
  photoEl.value = String(payload?.product?.photo_url || product?.photo_url || "");
  kwEl.value = String(payload?.product?.target_keywords || product?.target_keywords || "");
  const safePayload = payload && typeof payload === "object" ? payload : { product };
  rawEl.textContent = JSON.stringify(safePayload, null, 2);
}

async function loadSelectedProductDetails(productId = selectedProductId, opts = {}) {
  const id = Number(productId || 0);
  if (!id) {
    renderProductDetailsPane(null, null);
    return;
  }
  const silent = Boolean(opts?.silent);
  const product = currentProducts.find((x) => Number(x.id) === id) || null;
  const data = await requestJson(`/api/products/${id}/details`, {
    headers: authHeaders(),
    timeoutMs: 90000,
  }).catch((e) => {
    if (!silent) alert(e.message);
    return null;
  });
  if (!data) return;
  selectedProductDetails = data;
  renderProductDetailsPane(product, data);
}

async function saveSelectedProductDetails() {
  const id = Number(selectedProductId || 0);
  if (!id) {
    alert(tr("Сначала выберите товар в таблице.", "Select a product in table first."));
    return;
  }
  const payload = {
    name: String(document.getElementById("productDetailName")?.value || "").trim(),
    current_description: String(document.getElementById("productDetailDescription")?.value || ""),
    photo_url: String(document.getElementById("productDetailPhotoUrl")?.value || "").trim(),
    target_keywords: String(document.getElementById("productDetailKeywords")?.value || "").trim(),
  };
  const updated = await withBusy(
    tr("Сохраняем изменения карточки товара...", "Saving product card changes..."),
    () => requestJson(`/api/products/${id}`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify(payload),
      timeoutMs: 120000,
    }),
    tr("Если изменено описание, сервис отправит его в маркетплейс через API.", "If description changed, service also sends it to marketplace API.")
  ).catch((e) => {
    alert(e.message);
    return null;
  });
  if (!updated) return;
  invalidateModuleCache("products", "seo");
  await loadProducts();
  await loadSelectedProductDetails(id, { silent: true });
  alert(tr("Карточка товара обновлена.", "Product card updated."));
}

async function suggestKeywordsForSelectedProduct(productId) {
  if (!productId) return;
  const input = document.getElementById("positionKeywords");
  if (!input) return;
  const suggestions = await requestJson(`/api/products/${productId}/keyword-suggestions`, {
    headers: authHeaders(),
    timeoutMs: 30000,
  }).catch(() => []);
  if (!Array.isArray(suggestions) || !suggestions.length) return;

  const allowAutofill =
    !input.value.trim() ||
    input.dataset.autofilled === "1";
  if (allowAutofill) {
    input.value = suggestions[0];
    input.dataset.autofilled = "1";
  }
  autoKeywordProductId = productId;
}

function setActiveNav(tabName) {
  document.querySelectorAll(".nav-btn").forEach((b) => {
    if (b.dataset.tab === tabName) b.classList.add("active");
    else b.classList.remove("active");
  });
}

function ensureProfileTeamUi() {
  if (document.getElementById("teamMembersList")) return;
  const profileTab = document.getElementById("profile");
  if (!profileTab) return;
  const panel = document.createElement("div");
  panel.className = "panel";
  panel.id = "profileTeamPanel";
  panel.innerHTML = `
    <h3>${tr("Команда кабинета", "Workspace Team")}</h3>
    <div class="team-member-toolbar">
      <div id="teamPanelHint" class="hint">${tr("Добавление и редактирование сотрудника выполняется через pop-up окно.", "Add or edit employees via popup window.")}</div>
      <button id="teamAddMemberBtn" class="btn-secondary" type="button" onclick="openTeamMemberCreator()">${tr("Добавить сотрудника", "Add employee")}</button>
    </div>
    <div class="team-member-list" id="teamMembersList">
      <div class="hint">${tr("Загружаем сотрудников...", "Loading employees...")}</div>
    </div>
  `;
  profileTab.appendChild(panel);
}

function ensureProductsSeoSubtabUi() {
  const seoHost = document.getElementById("productsSubtabSeo");
  const seoLegacySection = document.getElementById("seo");
  if (!seoHost) return;
  if (seoHost.dataset.migrated === "1") return;
  if (seoLegacySection) {
    const nodes = [...seoLegacySection.children];
    for (const node of nodes) {
      seoHost.appendChild(node);
    }
    seoLegacySection.classList.add("hidden");
  }
  seoHost.dataset.migrated = "1";
}

function switchProductsSubtab(tab, preload = true) {
  ensureProductsSeoSubtabUi();
  const next = tab === "seo" ? "seo" : "catalog";
  currentProductsSubtab = next;
  const showCatalog = next === "catalog";
  document.getElementById("productsSubtabCatalog")?.classList.toggle("hidden", !showCatalog);
  document.getElementById("productsSubtabSeo")?.classList.toggle("hidden", showCatalog);
  document.getElementById("productsSubtabCatalogBtn")?.classList.toggle("active", showCatalog);
  document.getElementById("productsSubtabSeoBtn")?.classList.toggle("active", !showCatalog);
  refreshSectionHeading("products");
  if (!preload) return;
  if (showCatalog) {
    trackUiActivity("ui_subtab_opened", "products", "subtab=catalog", { cooldownMs: 15000 });
    loadProducts();
    return;
  }
  trackUiActivity("ui_subtab_opened", "seo_generation", "subtab=seo", { cooldownMs: 15000 });
  loadSeoJobs();
  loadKeywords();
}

function normalizeSalesLayout() {
  const sales = document.getElementById("sales");
  if (!sales) return;
  const statsPanel = [...sales.querySelectorAll(":scope > .panel")]
    .find((panel) => panel.querySelector("#salesMarketplace"));
  if (!statsPanel) return;
  const firstElement = sales.firstElementChild;
  if (firstElement !== statsPanel) {
    sales.insertBefore(statsPanel, firstElement);
  }
}

function migrateLegacyModuleSection(legacyId, targetId, requiredSelector = "") {
  const legacySection = document.getElementById(legacyId);
  const targetSection = document.getElementById(targetId);
  if (!legacySection || !targetSection) return;
  if (requiredSelector && targetSection.querySelector(requiredSelector)) return;
  const nodes = [...legacySection.children];
  for (const node of nodes) {
    targetSection.appendChild(node);
  }
}

function migrateLegacyDashboardIntoSales() {
  const legacyDashboard = document.getElementById("dashboard");
  const salesSection = document.getElementById("sales");
  if (!legacyDashboard || !salesSection) return;
  const blocks = [...legacyDashboard.children];
  for (let i = blocks.length - 1; i >= 0; i -= 1) {
    const block = blocks[i];
    const hasStats = block.id === "stats" || Boolean(block.querySelector?.("#stats"));
    const hasTrend = Boolean(block.querySelector?.("#dashboardTrendChart"));
    const hasQuick = Boolean(block.querySelector?.(".quick-actions"));
    if (!hasStats && !hasTrend && !hasQuick) continue;
    if (hasStats && salesSection.querySelector("#stats")) continue;
    if (hasTrend && salesSection.querySelector("#dashboardTrendChart")) continue;
    if (hasQuick && salesSection.querySelector(".quick-actions")) continue;
    salesSection.insertBefore(block, salesSection.firstChild);
  }
}

function pruneLegacyUi() {
  ensureProductsSeoSubtabUi();
  normalizeSalesLayout();
  migrateLegacyDashboardIntoSales();
  migrateLegacyModuleSection("questions", "reviewsSubtabQuestions", "#wbQuestionsTable");
  migrateLegacyModuleSection("ads-analytics", "adsSubtabAnalytics", "#adsAnalyticsTable");
  migrateLegacyModuleSection("ads-recommendations", "adsSubtabRecommendations", "#adsRecTable");
  const legacyTabs = ["dashboard", "questions", "ads-analytics", "ads-recommendations", "keywords"];
  const legacyTextPattern = /^(дашборд|dashboard|вопросы wb\/ozon|questions wb\/ozon|аналитика wb ads|wb ads analytics|рекомендации wb ads|wb ads recommendations|ключевики|keywords)$/i;
  for (const btn of document.querySelectorAll(".side-nav .nav-btn")) {
    const tab = String(btn.dataset.tab || "").trim();
    if (tab === "seo") {
      btn.remove();
      continue;
    }
    if (legacyTabs.includes(tab)) {
      btn.remove();
      continue;
    }
    const label = String(btn.querySelector(".nav-label")?.textContent || btn.textContent || "").trim();
    if (legacyTextPattern.test(label)) btn.remove();
  }
  for (const tab of legacyTabs) {
    const section = document.getElementById(tab);
    if (section) section.remove();
  }
  const langDup = document.getElementById("helpLangSelect");
  if (langDup) {
    const wrap = langDup.closest(".grid-2, .grid-3, .grid-4, .grid-5, .grid-6");
    if (wrap && wrap.querySelectorAll("select").length === 1 && wrap.querySelectorAll("button").length === 0) {
      wrap.remove();
    } else {
      langDup.remove();
    }
  }
}

function normalizeLegacyTabName(rawName) {
  const key = String(rawName || "").trim();
  const mapped = LEGACY_TAB_REDIRECT[key];
  if (!mapped) return { tab: key, productsSubtab: "", reviewsSubtab: "", adsSubtab: "" };
  return mapped;
}

function applyModuleVisibility() {
  pruneLegacyUi();
  document.querySelectorAll(".nav-btn[data-module]").forEach((btn) => {
    const moduleCode = btn.dataset.module;
    let allowed = enabledModules.has(moduleCode);
    const tab = String(btn.dataset.tab || "");
    if (tab === "reviews") {
      allowed = enabledModules.has("wb_reviews_ai") || enabledModules.has("wb_questions_ai") || enabledModules.has("returns");
    } else if (tab === "ads") {
      allowed = enabledModules.has("wb_ads") || enabledModules.has("wb_ads_analytics") || enabledModules.has("wb_ads_recommendations");
    } else if (tab === "help") {
      allowed = enabledModules.has("help_center") || enabledModules.has("ai_assistant");
    }
    btn.classList.toggle("hidden", !allowed);
  });
}

async function loadCurrentModules() {
  const rows = await requestJson("/api/modules/current", { headers: authHeaders() }).catch(() => null);
  if (!rows) return false;
  const active = new Set();
  if (Array.isArray(rows)) {
    for (const row of rows) {
      if (row && row.enabled && row.module_code) active.add(row.module_code);
    }
  }
  enabledModules = active;
  modulesLoaded = true;
  lastModulesLoadAt = Date.now();
  applyModuleVisibility();
  return true;
}

async function ensureModuleAccess(moduleCodes, opts = {}) {
  const codes = (Array.isArray(moduleCodes) ? moduleCodes : [moduleCodes])
    .map((code) => String(code || "").trim())
    .filter(Boolean);
  if (!codes.length) return true;
  if (codes.some((code) => enabledModules.has(code))) return true;
  if (!token) return false;
  const maxAgeMs = Math.max(0, Number(opts.maxAgeMs || 120000));
  const ageMs = Date.now() - Number(lastModulesLoadAt || 0);
  const shouldReload = !modulesLoaded || !lastModulesLoadAt || ageMs > maxAgeMs;
  if (shouldReload) {
    await loadCurrentModules().catch(() => false);
  }
  return codes.some((code) => enabledModules.has(code));
}

async function loadUiThemeSettings() {
  const data = await requestJson("/api/ui/settings", { headers: authHeaders() }).catch(() => null);
  if (!data || typeof data !== "object") return;
  uiThemeSettings = {
    theme_choice_enabled: Boolean(data.theme_choice_enabled),
    force_theme: Boolean(data.force_theme),
    default_theme: String(data.default_theme || "classic").toLowerCase(),
    allowed_themes: Array.isArray(data.allowed_themes) ? data.allowed_themes.map((x) => String(x || "").toLowerCase()) : ["classic", "dark", "light", "moon"],
  };
  const desired = (uiThemeSettings.theme_choice_enabled && !uiThemeSettings.force_theme)
    ? (localStorage.getItem("ui_theme") || currentTheme || uiThemeSettings.default_theme || "classic")
    : (uiThemeSettings.default_theme || "classic");
  applyTheme(desired);
  applyUiThemeSettingsToSelect();
  lastUiSettingsLoadAt = Date.now();
}

function isModuleFresh(key, maxAgeMs = MODULE_CACHE_TTL_MS) {
  const stamp = Number(moduleLoadState.get(key) || 0);
  if (!stamp) return false;
  return (Date.now() - stamp) <= Math.max(1000, Number(maxAgeMs || 0));
}

function markModuleLoaded(key) {
  moduleLoadState.set(String(key), Date.now());
}

function invalidateModuleCache(...keys) {
  for (const key of keys) {
    if (!key) continue;
    moduleLoadState.delete(String(key));
  }
}

async function runModuleLoader(key, loader, { force = false, maxAgeMs = MODULE_CACHE_TTL_MS } = {}) {
  const cacheKey = String(key || "");
  if (!cacheKey || typeof loader !== "function") return;
  if (!force && isModuleFresh(cacheKey, maxAgeMs)) return;
  const existing = moduleInflightState.get(cacheKey);
  if (existing) {
    await existing;
    return;
  }
  const task = (async () => {
    const ok = await loader();
    if (ok !== false) markModuleLoaded(cacheKey);
  })()
    .catch(() => null)
    .finally(() => moduleInflightState.delete(cacheKey));
  moduleInflightState.set(cacheKey, task);
  await task;
}

async function loadProductsWorkspace() {
  ensureProductsSeoSubtabUi();
  switchProductsSubtab(currentProductsSubtab || "catalog", false);
  await loadProducts();
  await loadSeoJobs();
  await loadKeywords();
}

function getModuleLoaderForTab(tabCode) {
  const code = String(tabCode || "").trim().toLowerCase();
  if (code === "sales") return { key: "sales", load: loadSalesBundle };
  if (code === "products") return { key: "products", load: loadProductsWorkspace };
  if (code === "reviews") return { key: "reviews", load: loadReviewsWorkspace };
  if (code === "accounting") return { key: "accounting", load: loadAccountingWorkspace };
  if (code === "ads") return { key: "ads", load: loadAdsWorkspace };
  if (code === "social") return { key: "social", load: () => (typeof loadSocialWorkspace === "function" ? loadSocialWorkspace() : Promise.resolve()) };
  if (code === "profile") return { key: "profile", load: loadProfile };
  if (code === "billing") return { key: "billing", load: loadBilling };
  if (code === "help") return { key: "help", load: loadHelpWorkspace };
  return null;
}

async function preloadModulesInBackground({ force = false, scope = "light" } = {}) {
  const safeScope = String(scope || "light").trim().toLowerCase();
  if (safeScope === "active") {
    const activeStep = getModuleLoaderForTab(currentTab);
    if (!activeStep) return;
    await runModuleLoader(activeStep.key, activeStep.load, {
      force,
      maxAgeMs: force ? 0 : MODULE_CACHE_TTL_MS,
    });
    return;
  }
  if (safeScope !== "full") {
    const lightQueue = [
      { key: "profile", load: loadProfile, enabled: () => enabledModules.has("user_profile") },
      { key: "help", load: loadHelpWorkspace, enabled: () => enabledModules.has("help_center") || enabledModules.has("ai_assistant") },
    ];
    for (const step of lightQueue) {
      if (!step.enabled()) continue;
      await runModuleLoader(step.key, step.load, {
        force,
        maxAgeMs: force ? 0 : MODULE_CACHE_TTL_MS,
      });
    }
    return;
  }
  const queue = [
    { key: "sales", load: loadSalesBundle, enabled: () => !modulesLoaded || enabledModules.has("sales_stats") },
    { key: "products", load: loadProductsWorkspace, enabled: () => true },
    { key: "reviews", load: loadReviewsWorkspace, enabled: () => enabledModules.has("wb_reviews_ai") || enabledModules.has("wb_questions_ai") || enabledModules.has("returns") },
    { key: "accounting", load: loadAccountingWorkspace, enabled: () => enabledModules.has("accounting") },
    { key: "ads", load: loadAdsWorkspace, enabled: () => enabledModules.has("wb_ads") || enabledModules.has("wb_ads_analytics") || enabledModules.has("wb_ads_recommendations") },
    { key: "social", load: () => (typeof loadSocialWorkspace === "function" ? loadSocialWorkspace() : Promise.resolve()), enabled: () => !modulesLoaded || enabledModules.has("social_hub") },
    { key: "profile", load: loadProfile, enabled: () => enabledModules.has("user_profile") },
    { key: "help", load: loadHelpWorkspace, enabled: () => enabledModules.has("help_center") || enabledModules.has("ai_assistant") },
  ];
  for (const step of queue) {
    if (!step.enabled()) continue;
    await runModuleLoader(step.key, step.load, {
      force,
      maxAgeMs: force ? 0 : MODULE_CACHE_TTL_MS,
    });
  }
}

async function refreshModulesInBackground() {
  const prev = suppressAlerts;
  suppressAlerts = true;
  try {
    await preloadModulesInBackground({ force: true, scope: "active" });
  } finally {
    suppressAlerts = prev;
  }
}

function stopModuleAutoRefresh() {
  if (moduleAutoRefreshTimer) {
    clearInterval(moduleAutoRefreshTimer);
    moduleAutoRefreshTimer = null;
  }
}

function startModuleAutoRefresh() {
  stopModuleAutoRefresh();
  moduleAutoRefreshTimer = setInterval(() => {
    refreshModulesInBackground().catch(() => null);
  }, MODULE_AUTO_REFRESH_MS);
}

function resolveInitialTab() {
  if (!modulesLoaded || !(enabledModules instanceof Set) || enabledModules.size === 0) {
    return "sales";
  }
  const has = (code) => enabledModules.has(code);
  const checks = [
    ["sales", has("sales_stats")],
    ["products", true],
    ["reviews", has("wb_reviews_ai") || has("wb_questions_ai") || has("returns")],
    ["accounting", has("accounting")],
    ["ads", has("wb_ads") || has("wb_ads_analytics") || has("wb_ads_recommendations")],
    ["social", has("social_hub")],
    ["profile", has("user_profile")],
    ["help", has("help_center") || has("ai_assistant")],
    ["billing", has("billing")],
    ["admin", me && me.role === "admin"],
  ];
  const first = checks.find((x) => Boolean(x[1]));
  return first ? String(first[0]) : "products";
}

function isTabAvailable(tabCode) {
  const code = String(tabCode || "").trim().toLowerCase();
  if (!code) return false;
  const has = (moduleCode) => !modulesLoaded || !(enabledModules instanceof Set) || enabledModules.has(moduleCode);
  if (code === "sales") return has("sales_stats");
  if (code === "products") return true;
  if (code === "reviews") return has("wb_reviews_ai") || has("wb_questions_ai") || has("returns");
  if (code === "accounting") return has("accounting");
  if (code === "ads") return has("wb_ads") || has("wb_ads_analytics") || has("wb_ads_recommendations");
  if (code === "social") return has("social_hub");
  if (code === "profile") return has("user_profile");
  if (code === "help") return has("help_center") || has("ai_assistant");
  if (code === "billing") return has("billing");
  if (code === "admin") return Boolean(me && me.role === "admin");
  return false;
}

function salesDashboardHasRenderableContent() {
  const statsHost = document.getElementById("stats");
  const trendMeta = document.getElementById("dashboardTrendMeta");
  const trendChart = document.getElementById("dashboardTrendChart");
  return Boolean(
    (statsHost && statsHost.children && statsHost.children.length > 0)
    || String(trendMeta?.textContent || "").trim()
    || (trendChart && trendChart.querySelector && trendChart.querySelector("svg, canvas, .trend-empty, .trend-point"))
  );
}

function scheduleSalesBootstrapRetry(delayMs = 900) {
  if (salesBootstrapRetryTimer) {
    clearTimeout(salesBootstrapRetryTimer);
  }
  salesBootstrapRetryTimer = setTimeout(async () => {
    salesBootstrapRetryTimer = null;
    if (currentTab !== "sales") return;
    if (salesDashboardHasRenderableContent()) return;
    const inflight = moduleInflightState.get("sales");
    if (inflight) {
      await inflight.catch(() => null);
    }
    if (currentTab !== "sales" || salesDashboardHasRenderableContent()) return;
    await runModuleLoader("sales", loadSalesBundle, { force: true, maxAgeMs: 0 }).catch(() => null);
  }, Math.max(250, Number(delayMs) || 0));
}

function showTab(name, btn = null) {
  const mapped = normalizeLegacyTabName(name);
  if (mapped.productsSubtab) currentProductsSubtab = mapped.productsSubtab;
  if (mapped.reviewsSubtab) currentReviewsSubtab = mapped.reviewsSubtab;
  if (mapped.adsSubtab) currentAdsSubtab = mapped.adsSubtab;
  const targetTab = mapped.tab;
  currentTab = targetTab;
  if (document && document.body) {
    document.body.setAttribute("data-active-tab", String(targetTab || ""));
    if (targetTab !== "social") {
      document.body.setAttribute("data-active-social-subtab", "none");
    }
  }
  try {
    sessionStorage.setItem("seo_wibe_last_tab", String(targetTab || ""));
    sessionStorage.setItem("seo_wibe_last_products_subtab", String(currentProductsSubtab || ""));
    sessionStorage.setItem("seo_wibe_last_reviews_subtab", String(currentReviewsSubtab || ""));
    sessionStorage.setItem("seo_wibe_last_ads_subtab", String(currentAdsSubtab || ""));
    sessionStorage.setItem("seo_wibe_last_accounting_subtab", String(currentAccountingSubtab || ""));
    sessionStorage.setItem("seo_wibe_last_help_subtab", String(currentHelpSubtab || ""));
    sessionStorage.setItem("seo_wibe_last_social_subtab", String(currentSocialSubtab || ""));
  } catch (_) {}
  document.querySelectorAll(".tab").forEach((el) => el.classList.add("hidden"));
  const tab = document.getElementById(targetTab);
  if (!tab) return;
  tab.classList.remove("hidden");

  refreshSectionHeading(targetTab);

  if (btn && btn.dataset.tab) {
    const mappedBtn = normalizeLegacyTabName(btn.dataset.tab);
    setActiveNav(mappedBtn.tab);
  } else {
    setActiveNav(targetTab);
  }

  if (targetTab === "sales") {
    normalizeSalesLayout();
    runModuleLoader("sales", loadSalesBundle);
    setTimeout(() => {
      if (currentTab === "sales") renderSalesStats();
    }, 120);
    scheduleSalesBootstrapRetry();
  }
  if (targetTab === "products") runModuleLoader("products", loadProductsWorkspace);
  if (targetTab === "reviews") runModuleLoader("reviews", loadReviewsWorkspace);
  if (targetTab === "accounting") runModuleLoader("accounting", loadAccountingWorkspace);
  if (targetTab === "ads") runModuleLoader("ads", loadAdsWorkspace);
  if (targetTab === "social") runModuleLoader("social", () => (typeof loadSocialWorkspace === "function" ? loadSocialWorkspace() : Promise.resolve()));
  if (targetTab === "profile") runModuleLoader("profile", loadProfile);
  if (targetTab === "billing") runModuleLoader("billing", loadBilling);
  if (targetTab === "help") runModuleLoader("help", loadHelpWorkspace, { maxAgeMs: MODULE_CACHE_TTL_MS });
  if (targetTab === "admin") loadAdmin();
  syncMobileQuickNavSelection();
  if (typeof window.socialSyncMobileChatChrome === "function") {
    try { window.socialSyncMobileChatChrome(); } catch (_) {}
  }
  closeMobileNav();
  if ((window.innerWidth || 0) <= 980) {
    try { window.scrollTo(0, 0); } catch (_) {}
    try { document.documentElement.scrollTop = 0; } catch (_) {}
    try { document.body.scrollTop = 0; } catch (_) {}
  }
  const activityMap = {
    sales: "sales_stats",
    products: currentProductsSubtab === "seo" ? "seo_generation" : "products",
    reviews: currentReviewsSubtab === "questions" ? "wb_questions_ai" : (currentReviewsSubtab === "returns" ? "returns" : "wb_reviews_ai"),
    accounting: "accounting",
    ads: currentAdsSubtab === "analytics" ? "wb_ads_analytics" : (currentAdsSubtab === "recommendations" ? "wb_ads_recommendations" : "wb_ads"),
    social: "social_hub",
    profile: "user_profile",
    billing: "billing",
    help: currentHelpSubtab === "assistant" ? "ai_assistant" : "help_center",
    admin: "admin",
  };
  const activityModule = activityMap[targetTab] || targetTab;
  trackUiActivity("ui_module_opened", activityModule, `tab=${targetTab}`, { cooldownMs: 15000 });
  setTimeout(() => {
    applyModuleActionIcons();
    applyButtonTooltips();
  }, 0);
}

async function openSocialChatFromBell(event = null) {
  if (event?.preventDefault) event.preventDefault();
  if (event?.stopPropagation) event.stopPropagation();
  const openCenter = async () => {
    if (typeof window.socialToggleNotificationCenter !== "function") return false;
    try {
      const opened = await window.socialToggleNotificationCenter(true);
      return opened !== false;
    } catch (_) {
      return false;
    }
  };

  if (await openCenter()) {
    closeMobileNav();
    return;
  }

  const socialBtn = document.querySelector(".nav-btn[data-tab='social']");
  if (String(currentTab || "") !== "social") {
    currentSocialSubtab = String(currentSocialSubtab || "chat");
    showTab("social", socialBtn || null);
  }

  if (typeof runModuleLoader === "function" && typeof loadSocialWorkspace === "function") {
    try {
      await runModuleLoader("social", () => loadSocialWorkspace());
    } catch (_) {}
  } else if (typeof loadSocialWorkspace === "function") {
    try {
      await loadSocialWorkspace();
    } catch (_) {}
  }

  for (let i = 0; i < 8; i += 1) {
    if (await openCenter()) {
      closeMobileNav();
      return false;
    }
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  closeMobileNav();
  return false;
}

function handleMobileBackPress() {
  if (!mobileApkMode) return false;
  const shell = document.getElementById("appSection");
  const isNavOpen = Boolean(shell?.classList.contains("nav-open"));
  const activeModal = document.querySelector(".modal:not(.hidden)");
  if (activeModal) {
    const closeBtn = activeModal.querySelector(".modal-close");
    if (closeBtn instanceof HTMLElement) {
      closeBtn.click();
    } else {
      activeModal.classList.add("hidden");
    }
    return true;
  }
  if (String(currentTab || "") === "social") {
    if (typeof window.socialHandleMobileBack === "function") {
      try {
        if (window.socialHandleMobileBack()) return true;
      } catch (_) {}
    }
    const subtab = String(currentSocialSubtab || window.socialState?.currentSubtab || "chat");
    const currentThreadId = Number(window.socialState?.currentThreadId || 0);
    const threadOpen = typeof window.socialIsThreadOpen === "function"
      ? Boolean(window.socialIsThreadOpen())
      : currentThreadId > 0;
    if (subtab === "chat" && (threadOpen || currentThreadId > 0) && typeof window.socialCloseThread === "function") {
      currentSocialSubtab = "chat";
      window.socialCloseThread({ keepAutoSelect: false });
      return true;
    }
    if (subtab !== "chat" && typeof window.switchSocialSubtab === "function") {
      currentSocialSubtab = "chat";
      window.switchSocialSubtab("chat", true);
      return true;
    }
    if (shell && !isNavOpen) {
      shell.classList.add("nav-open");
      const btn = document.getElementById("mobileNavToggle");
      if (btn) btn.setAttribute("aria-expanded", "true");
      return true;
    }
    return false;
  }
  if (isNavOpen) {
    closeMobileNav();
    return true;
  }
  const socialBtn = document.querySelector(".nav-btn[data-tab='social']");
  showTab("social", socialBtn || null);
  if (typeof window.switchSocialSubtab === "function") {
    currentSocialSubtab = "chat";
    setTimeout(() => {
      try { window.switchSocialSubtab("chat", true); } catch (_) {}
    }, 120);
  }
  return true;
}
function handleTopMenuButton() {
  toggleMobileNav();
}

function toggleMobileNav() {
  const shell = document.getElementById("appSection");
  if (!shell) return;
  shell.classList.toggle("nav-open");
  const btn = document.getElementById("mobileNavToggle");
  if (btn) btn.setAttribute("aria-expanded", shell.classList.contains("nav-open") ? "true" : "false");
}

function closeMobileNav(evt = null) {
  const shell = document.getElementById("appSection");
  if (!shell) return;
  if (evt && evt.target && evt.target.id !== "mobileNavOverlay") return;
  shell.classList.remove("nav-open");
  const btn = document.getElementById("mobileNavToggle");
  if (btn) btn.setAttribute("aria-expanded", "false");
}

function getMobileQuickNavSelects() {
  return ["mobileQuickNav", "mobileDrawerQuickNav"]
    .map((id) => document.getElementById(id))
    .filter(Boolean);
}

function getMobileQuickNavOptions() {
  const isEn = currentLang === "en";
  const has = (code) => {
    if (!modulesLoaded) return true;
    return enabledModules instanceof Set && enabledModules.has(code);
  };
  const options = [{ value: "sales_dashboard", label: isEn ? "Statistics" : "Статистика" }];
  if (has("social_hub")) {
    options.push({ value: "social_chat", label: isEn ? "Chat" : "Чат" });
    options.push({ value: "social_tasks", label: isEn ? "Tasks" : "Задачи" });
    options.push({ value: "social_notes", label: isEn ? "Notes" : "Заметки" });
    options.push({ value: "social_calculator", label: isEn ? "Calculator" : "Калькулятор" });
    options.push({ value: "social_calendar", label: isEn ? "Calendar" : "Календарь" });
    options.push({ value: "social_games", label: isEn ? "Games" : "Игры" });
  }
  if (has("wb_reviews_ai") || has("wb_questions_ai") || has("returns")) {
    if (has("wb_reviews_ai")) options.push({ value: "reviews_reviews", label: isEn ? "Review replies" : "Ответы на отзывы" });
    if (has("wb_questions_ai")) options.push({ value: "reviews_questions", label: isEn ? "Question replies" : "Ответы на вопросы" });
    if (has("returns")) options.push({ value: "reviews_returns", label: isEn ? "Returns" : "Возвраты" });
  }
  if (has("wb_ads") || has("wb_ads_analytics") || has("wb_ads_recommendations")) {
    if (has("wb_ads")) options.push({ value: "ads_campaigns", label: isEn ? "Ad campaigns" : "Рекламные кампании" });
    if (has("wb_ads_analytics")) options.push({ value: "ads_analytics", label: isEn ? "Ads analytics" : "Аналитика рекламы" });
    if (has("wb_ads_recommendations")) options.push({ value: "ads_recommendations", label: isEn ? "Recommendations" : "Рекомендации" });
    if (has("wb_ads")) options.push({ value: "ads_bidder", label: isEn ? "WB Ads bidder" : "Бидер WB Ads" });
  }
  options.push({ value: "profile_main", label: isEn ? "Profile" : "Профиль" });
  if (has("help_center")) {
    options.push({ value: "help_main", label: isEn ? "Help" : "Справка" });
  }
  return options;
}

const __swGetMobileQuickNavOptionsSafe = function getMobileQuickNavOptionsSafe() {
  const isEn = currentLang === "en";
  const has = (code) => {
    if (!modulesLoaded) return true;
    return enabledModules instanceof Set && enabledModules.has(code);
  };
  const options = [{ value: "sales_dashboard", label: isEn ? "Statistics" : "\u0421\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043a\u0430" }];
  if (has("social_hub")) {
    options.push({ value: "social_chat", label: isEn ? "Chat" : "\u0427\u0430\u0442" });
    options.push({ value: "social_tasks", label: isEn ? "Tasks" : "\u0417\u0430\u0434\u0430\u0447\u0438" });
    options.push({ value: "social_notes", label: isEn ? "Notes" : "\u0417\u0430\u043c\u0435\u0442\u043a\u0438" });
    options.push({ value: "social_calculator", label: isEn ? "Calculator" : "\u041a\u0430\u043b\u044c\u043a\u0443\u043b\u044f\u0442\u043e\u0440" });
    options.push({ value: "social_calendar", label: isEn ? "Calendar" : "\u041a\u0430\u043b\u0435\u043d\u0434\u0430\u0440\u044c" });
    options.push({ value: "social_games", label: isEn ? "Games" : "\u0418\u0433\u0440\u044b" });
  }
  if (has("wb_reviews_ai") || has("wb_questions_ai") || has("returns")) {
    if (has("wb_reviews_ai")) options.push({ value: "reviews_reviews", label: isEn ? "Review replies" : "\u041e\u0442\u0432\u0435\u0442\u044b \u043d\u0430 \u043e\u0442\u0437\u044b\u0432\u044b" });
    if (has("wb_questions_ai")) options.push({ value: "reviews_questions", label: isEn ? "Question replies" : "\u041e\u0442\u0432\u0435\u0442\u044b \u043d\u0430 \u0432\u043e\u043f\u0440\u043e\u0441\u044b" });
    if (has("returns")) options.push({ value: "reviews_returns", label: isEn ? "Returns" : "\u0412\u043e\u0437\u0432\u0440\u0430\u0442\u044b" });
  }
  if (has("wb_ads") || has("wb_ads_analytics") || has("wb_ads_recommendations")) {
    if (has("wb_ads")) options.push({ value: "ads_campaigns", label: isEn ? "Ad campaigns" : "\u0420\u0435\u043a\u043b\u0430\u043c\u043d\u044b\u0435 \u043a\u0430\u043c\u043f\u0430\u043d\u0438\u0438" });
    if (has("wb_ads_analytics")) options.push({ value: "ads_analytics", label: isEn ? "Ads analytics" : "\u0410\u043d\u0430\u043b\u0438\u0442\u0438\u043a\u0430 \u0440\u0435\u043a\u043b\u0430\u043c\u044b" });
    if (has("wb_ads_recommendations")) options.push({ value: "ads_recommendations", label: isEn ? "Recommendations" : "\u0420\u0435\u043a\u043e\u043c\u0435\u043d\u0434\u0430\u0446\u0438\u0438" });
    if (has("wb_ads")) options.push({ value: "ads_bidder", label: isEn ? "WB Ads bidder" : "\u0411\u0438\u0434\u0435\u0440 WB Ads" });
  }
  options.push({ value: "profile_main", label: isEn ? "Profile" : "\u041f\u0440\u043e\u0444\u0438\u043b\u044c" });
  if (has("help_center")) {
    options.push({ value: "help_main", label: isEn ? "Help" : "\u0421\u043f\u0440\u0430\u0432\u043a\u0430" });
  }
  return options;
};
getMobileQuickNavOptions = __swGetMobileQuickNavOptionsSafe;
window.getMobileQuickNavOptions = __swGetMobileQuickNavOptionsSafe;

function getCurrentMobileQuickValue() {
  if (currentTab === "sales") return "sales_dashboard";
  if (currentTab === "ads") {
    const allowed = new Set(["campaigns", "analytics", "recommendations", "bidder", "ozon"]);
    const sub = allowed.has(String(currentAdsSubtab || "")) ? String(currentAdsSubtab || "campaigns") : "campaigns";
    return `ads_${sub}`;
  }
  if (currentTab === "social") {
    const sub = ["games", "chat", "tasks", "notes", "calculator", "calendar"].includes(String(currentSocialSubtab || ""))
      ? String(currentSocialSubtab)
      : "chat";
    return `social_${sub}`;
  }
  if (currentTab === "reviews") {
    if (currentReviewsSubtab === "questions") return "reviews_questions";
    if (currentReviewsSubtab === "returns") return "reviews_returns";
    return "reviews_reviews";
  }
  if (currentTab === "profile") {
    return "profile_main";
  }
  if (currentTab === "help") {
    return "help_main";
  }
  return "";
}

function renderMobileQuickList() {
  if (!mobileClientMode) return;
  const host = document.getElementById("mobileDrawerQuickList");
  if (!host) return;
  const options = getMobileQuickNavOptions();
  const active = getCurrentMobileQuickValue();
  host.innerHTML = options.map((row) => {
    const cls = row.value === active ? "chip-btn mobile-drawer-nav-item active" : "chip-btn mobile-drawer-nav-item";
    return `<button type="button" class="${cls}" data-mobile-quick-value="${escapeHtml(row.value)}">${escapeHtml(row.label)}</button>`;
  }).join("");
  host.querySelectorAll("[data-mobile-quick-value]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const value = String(btn.getAttribute("data-mobile-quick-value") || "").trim();
      if (!value) return;
      openMobileQuickNavValue(value);
    });
  });
}

function refreshMobileQuickNavOptions() {
  if (!mobileClientMode) return;
  const options = getMobileQuickNavOptions();
  const values = getMobileQuickNavSelects().map((node) => String(node.value || "").trim());
  getMobileQuickNavSelects().forEach((select, idx) => {
    const previous = values[idx] || "";
    select.innerHTML = options
      .map((row) => `<option value="${escapeHtml(row.value)}">${escapeHtml(row.label)}</option>`)
      .join("");
    if ([...select.options].some((opt) => opt.value === previous)) {
      select.value = previous;
    }
  });
  renderMobileQuickList();
}

function syncMobileQuickNavSelection() {
  if (!mobileClientMode) return;
  const value = getCurrentMobileQuickValue();
  if (!value) return;
  getMobileQuickNavSelects().forEach((select) => {
    if ([...select.options].some((opt) => opt.value === value)) {
      select.value = value;
    }
  });
  renderMobileQuickList();
}

function openMobileQuickNavValue(valueRaw) {
  const value = String(valueRaw || "").trim();
  if (!value) return;
  getMobileQuickNavSelects().forEach((node) => {
    if ([...node.options].some((opt) => opt.value === value)) {
      node.value = value;
    }
  });
  if (value.startsWith("social_")) {
    const sub = value.replace(/^social_/, "") || "chat";
    showTab("social", document.querySelector(".nav-btn[data-tab='social']"));
    const runSwitch = () => {
      if (typeof window.switchSocialSubtab !== "function") return false;
      window.switchSocialSubtab(sub, true);
      return true;
    };
    if (!runSwitch()) setTimeout(runSwitch, 160);
    closeMobileNav();
    return;
  }
  if (value === "sales_dashboard") {
    showTab("sales", document.querySelector(".nav-btn[data-tab='sales']"));
    closeMobileNav();
    return;
  }
  if (value.startsWith("ads_")) {
    const sub = value.replace(/^ads_/, "") || "campaigns";
    const safeSub = ["campaigns", "analytics", "recommendations", "bidder", "ozon"].includes(sub) ? sub : "campaigns";
    showTab("ads", document.querySelector(".nav-btn[data-tab='ads']"));
    if (typeof switchAdsSubtab === "function") {
      setTimeout(() => {
        try { switchAdsSubtab(safeSub, true); } catch (_) {}
      }, 120);
    }
    closeMobileNav();
    return;
  }
  if (value.startsWith("reviews_")) {
    const suffix = value.replace(/^reviews_/, "") || "reviews";
    const sub = suffix === "questions" ? "questions" : (suffix === "returns" ? "returns" : "reviews");
    showTab("reviews", document.querySelector(".nav-btn[data-tab='reviews']"));
    switchReviewsSubtab(sub, true);
    closeMobileNav();
    return;
  }
  if (value === "profile_main") {
    showTab("profile", document.querySelector(".nav-btn[data-tab='profile']"));
    closeMobileNav();
    return;
  }
  if (value === "help_main") {
    showTab("help", document.querySelector(".nav-btn[data-tab='help']"));
    closeMobileNav();
  }
}

function onMobileQuickNavChanged(sourceId = "mobileQuickNav") {
  if (!mobileClientMode) return;
  const select = typeof sourceId === "string"
    ? document.getElementById(sourceId)
    : (sourceId?.target || document.getElementById("mobileQuickNav"));
  const value = String(select?.value || "").trim();
  if (!value) return;
  getMobileQuickNavSelects().forEach((node) => {
    if (node !== select && [...node.options].some((opt) => opt.value === value)) {
      node.value = value;
    }
  });
  openMobileQuickNavValue(value);
}

function setupMobileClientMode() {
  if (!shouldForceMobileCalendarStart()) return;
  currentSocialSubtab = "calendar";
  try {
    sessionStorage.setItem("seo_wibe_last_tab", "social");
    sessionStorage.setItem("seo_wibe_last_social_subtab", "calendar");
  } catch (_) {}
  document.body.classList.add("mobile-client-mode");
  if (mobileApkMode) document.body.classList.add("mobile-apk-mode");
  const drawer = document.getElementById("mobileDrawerControls");
  if (drawer) drawer.classList.remove("hidden");
  const select = document.getElementById("mobileQuickNav");
  if (select && !mobileApkMode) select.classList.remove("hidden");
  syncMobileDrawerSelectors();
  refreshMobileQuickNavOptions();
  syncMobileQuickNavSelection();
  applyMobileCalendarStartupRoute(0);
  applyMobileCalendarStartupRoute(220);
}

async function register() {
  const email = document.getElementById("regEmail").value.trim();
  const password = document.getElementById("regPassword").value;
  const { data, err } = await retryAuthRequest("/api/auth/register", { email, password });
  if (!data) {
    if (err) alert(err.message);
    return;
  }
  const persist = localStorage.getItem("remember_me") !== "0";
  setToken(data.access_token, persist);
  localStorage.setItem("login_email", email);
  await ensureAuth();
}

async function retryAuthRequest(url, payload, attempts = 4) {
  let lastErr = null;
  for (let i = 0; i < attempts; i += 1) {
    const data = await requestJson(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch((e) => {
      lastErr = e;
      return null;
    });
    if (data) return { data, err: null };
    if (!lastErr || !isNetworkError(lastErr)) break;
    await delay(500 + i * 450);
  }
  return { data: null, err: lastErr };
}

async function login() {
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  const remember = Boolean(document.getElementById("loginRemember")?.checked);
  const { data, err } = await retryAuthRequest("/api/auth/login", { email, password }, 4);
  if (!data) {
    if (err && isNetworkError(err)) {
      const ok = await ensureAuth().catch(() => false);
      if (ok) return;
    }
    if (err) alert(err.message);
    return;
  }
  setToken(data.access_token, remember);
  localStorage.setItem("login_email", email);
  await ensureAuth();
}

async function logout() {
  stopModuleAutoRefresh();
  authRetryCount = 0;
  lastAuthSuccessAt = 0;
  sessionStorage.removeItem("last_auth_ok_at");
  if (token) {
    await requestJson("/api/auth/logout", {
      method: "POST",
      headers: authHeaders(),
      timeoutMs: 10000,
    }).catch(() => null);
  }
  setToken("");
  window.__socialHooksRequested = false;
  me = null;
  renderTopbarUser();
  selectedProducts.clear();
  selectedJobs.clear();
  selectedProductId = null;
  productPage = 1;
  productPageSize = 30;
  productTotal = 0;
  productTotalPages = 0;
  enabledModules = new Set();
  wbReviewRows = [];
  wbQuestionRows = [];
  wbCampaignRows = [];
  adsAnalyticsRows = [];
  adsRecommendationRows = [];
  salesRows = [];
  salesChartRows = [];
  salesCompareRows = [];
  salesCompareChartRows = [];
  salesTotalsData = {};
  salesComparisonData = {};
  salesCompareLabel = "";
  salesCurrentLabel = "";
  moduleLoadState.clear();
  moduleInflightState.clear();
  modulesLoaded = false;
  lastModulesLoadAt = 0;
  lastUiSettingsLoadAt = 0;
  appUiBootstrapped = false;
  currentProductsSubtab = "catalog";
  currentReviewsSubtab = "reviews";
  currentAdsSubtab = "campaigns";
  currentHelpSubtab = "docs";
  currentSocialSubtab = "chat";
  helpAssistantHistory = [];
  profileAiState = null;
  wbReviewDrafts.clear();
  wbQuestionDrafts.clear();
  selectedWbCampaignId = "";
  wbCampaignDetailCache.clear();
  reviewPhotoItems = [];
  reviewPhotoIndex = 0;
  reviewLoadProgress = { active: false, total: 0, loaded: 0 };
  questionLoadProgress = { active: false, total: 0, loaded: 0 };
  wbAdsLoadProgress = { active: false, total: 0, loaded: 0, failed: 0 };
  adsRecLoadProgress = { active: false, total: 0, loaded: 0 };
  if (typeof window.resetSocialState === "function") {
    try { window.resetSocialState(); } catch (_) {}
  }
  localStorage.removeItem("token");
  sessionStorage.removeItem("token");
  document.getElementById("appSection").classList.add("hidden");
  document.getElementById("authSection").classList.remove("hidden");
  switchAuthMode("login");
}

function readStoredToken() {
  const fromSession = sanitizeToken(sessionStorage.getItem("token") || "");
  const fromLocal = sanitizeToken(localStorage.getItem("token") || "");
  const fromShadow = sanitizeToken(localStorage.getItem("token_shadow") || "");
  return {
    session: fromSession,
    local: fromLocal,
    shadow: fromShadow,
    value: fromSession || fromLocal || fromShadow || "",
  };
}

function scheduleEnsureAuth(delayMs = 1000, allowFallback = true) {
  setTimeout(() => {
    ensureAuth(allowFallback).catch(() => null);
  }, Math.max(120, Number(delayMs) || 0));
}

function resetViewportAfterAuth() {
  try {
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }
  } catch (_) {}
  try { window.scrollTo(0, 0); } catch (_) {}
  try { document.documentElement.scrollTop = 0; } catch (_) {}
  try { document.body.scrollTop = 0; } catch (_) {}
}

async function ensureAuth(allowFallback = true) {
  if (ensureAuthPromise) return ensureAuthPromise;
  ensureAuthPromise = (async () => {
    if (!token) {
      const stored = readStoredToken();
      if (stored.value) {
        const persist = stored.session ? false : (localStorage.getItem("remember_me") !== "0");
        setToken(stored.value, persist);
      }
    }

    let authError = null;
    let user = null;

    const fetchMe = async (useAuthHeader) => {
      let err = null;
      const headers = useAuthHeader ? authHeadersStrict() : { "Content-Type": "application/json" };
      const data = await requestJson("/api/auth/me", { headers, timeoutMs: 15000 }).catch((e) => {
        err = e;
        return null;
      });
      return { data, err };
    };

    if (token) {
      const authRes = await fetchMe(true);
      if (authRes.data) {
        user = authRes.data;
        forceCookieAuth = false;
      } else {
        authError = authRes.err;
      }
    }
    if (!user) {
      const cookieRes = await fetchMe(false);
      if (cookieRes.data) {
        user = cookieRes.data;
        forceCookieAuth = true;
      } else if (!authError) {
        authError = cookieRes.err;
      }
    }

    if (!user) {
      const status = Number(authError?.status || 0);
      if (status === 401 || status === 403) {
        authRetryCount += 1;
        if (allowFallback && token) {
          const stored = readStoredToken();
          if (stored.value && stored.value !== token) {
            const persist = stored.session ? false : (localStorage.getItem("remember_me") !== "0");
            setToken(stored.value, persist);
            scheduleEnsureAuth(350, false);
            return false;
          }
        }
        const hasFreshToken = Boolean(token) && !isTokenExpired(token);
        const recentlyAuthenticated = lastAuthSuccessAt > 0 && (Date.now() - lastAuthSuccessAt) < (30 * 60 * 1000);
        if ((recentlyAuthenticated || hasFreshToken) && authRetryCount <= 42) {
          const retryDelay = Math.min(30000, 900 + authRetryCount * 420);
          scheduleEnsureAuth(retryDelay, false);
          const authSection = document.getElementById("authSection");
          const appSection = document.getElementById("appSection");
          if (authSection) authSection.classList.add("hidden");
          if (appSection) appSection.classList.remove("hidden");
          return false;
        }
        if (token && isTokenExpired(token)) {
          setToken("");
        }
        me = null;
        renderTopbarUser();
        document.getElementById("appSection")?.classList.add("hidden");
        document.getElementById("authSection")?.classList.remove("hidden");
        return false;
      }
      if (authError && isNetworkError(authError)) {
        scheduleEnsureAuth(1200, allowFallback);
        return false;
      }
      scheduleEnsureAuth(1300, allowFallback);
      return false;
    }

    const authSection = document.getElementById("authSection");
    const appSection = document.getElementById("appSection");
    const appWasHidden = Boolean(appSection?.classList.contains("hidden"));
    if (authSection) authSection.classList.add("hidden");
    if (appSection) appSection.classList.remove("hidden");
    if (appWasHidden) resetViewportAfterAuth();
    me = user;
    authRetryCount = 0;
    lastAuthSuccessAt = Date.now();
    sessionStorage.setItem("last_auth_ok_at", String(lastAuthSuccessAt));
    pruneLegacyUi();
    ensureProfileTeamUi();
    renderTopbarUser();

    if (me.role !== "admin") {
      const adminBtn = document.querySelector(".nav-btn[data-tab='admin']");
      if (adminBtn) adminBtn.style.display = "none";
    }
    const nowTs = Date.now();
    const shouldRefreshModules = !modulesLoaded || (nowTs - Number(lastModulesLoadAt || 0)) > (5 * 60 * 1000);
    const shouldRefreshUiSettings = !lastUiSettingsLoadAt || (nowTs - Number(lastUiSettingsLoadAt || 0)) > (5 * 60 * 1000);
    const shouldRunFullBootstrap = appWasHidden || !appUiBootstrapped;
    const prevAlerts = suppressAlerts;
    suppressAlerts = true;
    try {
      if (shouldRefreshModules) {
        const modulesOk = await loadCurrentModules();
        if (!modulesOk) {
          scheduleEnsureAuth(1200, false);
        }
      }
      if (shouldRefreshUiSettings || shouldRunFullBootstrap) {
        await loadUiThemeSettings();
      }
      if (Boolean(uiThemeSettings.force_theme) || !uiThemeSettings.theme_choice_enabled) {
        currentTheme = uiThemeSettings.default_theme || "classic";
      }
      applyUiThemeSettingsToSelect();
      applyTheme(currentTheme);
      applyUiLanguage();
      applySidebarMode();
      applyButtonTooltips();

      // Keep social hooks alive globally, even before opening Social tab.
      window.__socialHooksRequested = true;
      if (typeof window.socialSetBell === "function") window.socialSetBell(0);
      if (typeof window.socialStartGlobalHooks === "function") {
        try { window.socialStartGlobalHooks(); } catch (_) {}
      } else if (typeof window.socialMaybeStartHooks === "function") {
        window.socialMaybeStartHooks();
      }

      startModuleAutoRefresh();
      try { window.dispatchEvent(new Event("seo-wibe-auth")); } catch (_) {}
      if (shouldRunFullBootstrap) {
        const storedProductsSubtab = String(sessionStorage.getItem("seo_wibe_last_products_subtab") || "").trim();
        if (storedProductsSubtab === "catalog" || storedProductsSubtab === "seo") currentProductsSubtab = storedProductsSubtab;
        const storedReviewsSubtab = String(sessionStorage.getItem("seo_wibe_last_reviews_subtab") || "").trim();
        if (["reviews", "questions", "returns"].includes(storedReviewsSubtab)) currentReviewsSubtab = storedReviewsSubtab;
        const storedAdsSubtab = String(sessionStorage.getItem("seo_wibe_last_ads_subtab") || "").trim();
        if (["campaigns", "analytics", "recommendations", "bidder", "ozon"].includes(storedAdsSubtab)) currentAdsSubtab = storedAdsSubtab;
        const storedAccountingSubtab = String(sessionStorage.getItem("seo_wibe_last_accounting_subtab") || "").trim();
        if (["overview", "analysis", "monthly", "expenses", "settings"].includes(storedAccountingSubtab)) currentAccountingSubtab = storedAccountingSubtab;
        const storedHelpSubtab = String(sessionStorage.getItem("seo_wibe_last_help_subtab") || "").trim();
        if (["docs", "assistant", "downloads"].includes(storedHelpSubtab)) currentHelpSubtab = storedHelpSubtab;
        const storedSocialSubtab = String(sessionStorage.getItem("seo_wibe_last_social_subtab") || "").trim();
        if (["games", "chat", "tasks", "calendar", "calculator", "notes"].includes(storedSocialSubtab)) currentSocialSubtab = storedSocialSubtab;
        const storedRaw = String(sessionStorage.getItem("seo_wibe_last_tab") || "").trim();
        const storedTab = normalizeLegacyTabName(storedRaw).tab;
        let initialTab = isTabAvailable(storedTab) ? storedTab : resolveInitialTab();
      if (shouldForceMobileCalendarStart()) {
          // Mobile app should open the social hub on Calendar by default.
          currentSocialSubtab = "calendar";
          if (isTabAvailable("social")) initialTab = "social";
          else if (isTabAvailable("sales")) initialTab = "sales";
          else if (isTabAvailable("reviews")) initialTab = "reviews";
          else if (isTabAvailable("profile")) initialTab = "profile";
        }
        showTab(initialTab, document.querySelector(`.nav-btn[data-tab='${initialTab}']`));
        appUiBootstrapped = true;
        setTimeout(() => {
          // Avoid hammering all module APIs right after login. A light preload is enough.
          preloadModulesInBackground({ force: false, scope: "light" });
        }, 3000);
      }
    } finally {
      suppressAlerts = prevAlerts;
    }
    return true;
  })()
    .catch(() => false)
    .finally(() => {
      ensureAuthPromise = null;
    });
  return ensureAuthPromise;
}

function computeAvatarInitials(name, email) {
  const raw = String(name || "").trim() || String(email || "").trim();
  if (!raw) return "--";
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
  }
  const base = raw.includes("@") ? raw.split("@")[0] : raw;
  return base.slice(0, 2).toUpperCase();
}

function setTopbarAvatarImage(imgNode, urlRaw, { wrapper = null, fallbackTextNode = null } = {}) {
  if (!imgNode) return;
  const safeUrl = String(urlRaw || "").trim();
  const showFallback = () => {
    imgNode.classList.add("hidden");
    imgNode.removeAttribute("src");
    if (wrapper) wrapper.classList.remove("has-avatar");
    if (fallbackTextNode) fallbackTextNode.classList.remove("hidden");
  };
  if (!safeUrl) {
    showFallback();
    return;
  }
  if (wrapper) wrapper.classList.add("has-avatar");
  if (fallbackTextNode) fallbackTextNode.classList.add("hidden");
  imgNode.classList.remove("hidden");
  imgNode.onerror = () => {
    showFallback();
    imgNode.onerror = null;
  };
  imgNode.onload = () => {
    if (wrapper) wrapper.classList.add("has-avatar");
    if (fallbackTextNode) fallbackTextNode.classList.add("hidden");
    imgNode.classList.remove("hidden");
  };
  imgNode.src = safeUrl;
}

function renderProfileMenuIntro() {
  const nickNode = document.getElementById("profileSectionsIntroNick");
  if (!nickNode) return;
  nickNode.textContent = normalizeAppText(me?.actor_nick || me?.actor_email || me?.email || "-", "-");
}

function renderMobileDrawerUser() {
  const btn = document.getElementById("mobileDrawerProfileBtn");
  if (!btn) return;
  if (!me) {
    btn.classList.add("hidden");
    return;
  }
  const actorEmail = normalizeAppText(String(me.actor_email || me.email || "").trim(), "-");
  const name = normalizeAppText(String(me.actor_nick || actorEmail || "-"), actorEmail || "-");
  const isOwner = Boolean(me.actor_is_owner);
  const fixedRoleText = me.role === "admin"
    ? tr("Админ", "Admin")
    : (isOwner ? tr("Владелец", "Owner") : tr("Участник", "Member"));
  const initials = computeAvatarInitials(name, actorEmail);
  const avatarText = document.getElementById("mobileDrawerAvatarText");
  const avatarName = document.getElementById("mobileDrawerAvatarName");
  const avatarImg = document.getElementById("mobileDrawerAvatarImg");
  if (avatarText) avatarText.textContent = initials;
  if (avatarName) avatarName.textContent = name;
  setTopbarAvatarImage(avatarImg, String(me.avatar_url || "").trim(), { fallbackTextNode: avatarText });
  btn.classList.remove("hidden");
}

function renderTopbarUser() {
  const btn = document.getElementById("topbarAvatarBtn");
  const popover = document.getElementById("topbarUserPopover");
  if (!btn || !popover) {
    renderMobileDrawerUser();
    return;
  }
  if (!me) {
    btn.classList.add("hidden");
    popover.classList.add("hidden");
    renderProfileMenuIntro();
    renderMobileDrawerUser();
    return;
  }
  const actorEmail = normalizeAppText(String(me.actor_email || me.email || "").trim(), "-");
  const name = normalizeAppText(String(me.actor_nick || actorEmail || "-"), actorEmail || "-");
  const isOwner = Boolean(me.actor_is_owner);
  const roleText = me.role === "admin"
    ? tr("Админ", "Admin")
    : (isOwner ? tr("Владелец", "Owner") : tr("Участник", "Member"));
  const initials = computeAvatarInitials(name, actorEmail);
  const avatarText = document.getElementById("topbarAvatarText");
  const avatarName = document.getElementById("topbarAvatarName");
  const popAvatar = document.getElementById("topbarPopoverAvatar");
  const avatarImg = document.getElementById("topbarAvatarImg");
  const popAvatarImg = document.getElementById("topbarPopoverAvatarImg");
  const popAvatarText = document.getElementById("topbarPopoverAvatarText");
  const popName = document.getElementById("topbarPopoverName");
  const popRole = document.getElementById("topbarPopoverRole");
  const popEmail = document.getElementById("topbarPopoverEmail");
  const avatarUrl = String(me.avatar_url || "").trim();
  if (avatarText) avatarText.textContent = initials;
  if (avatarName) avatarName.textContent = name;
  if (popAvatarText) popAvatarText.textContent = initials;
  setTopbarAvatarImage(avatarImg, avatarUrl, { fallbackTextNode: avatarText });
  setTopbarAvatarImage(popAvatarImg, avatarUrl, { wrapper: popAvatar, fallbackTextNode: popAvatarText });
  if (popName) popName.textContent = name;
  if (popRole) popRole.textContent = roleText;
  if (popEmail) popEmail.textContent = actorEmail || "-";
  renderProfileMenuIntro();
  btn.classList.remove("hidden");
  renderMobileDrawerUser();
}

function toggleTopbarUserPopover() {
  const popover = document.getElementById("topbarUserPopover");
  if (!popover) return;
  popover.classList.toggle("hidden");
}

function closeTopbarUserPopover() {
  const popover = document.getElementById("topbarUserPopover");
  if (popover) popover.classList.add("hidden");
}

function openMyProfileFromTopbar() {
  pendingProfileActorFocus = true;
  closeTopbarUserPopover();
  showTab("profile", document.querySelector(".nav-btn[data-tab='profile']"));
  runModuleLoader("profile", loadProfile, { maxAgeMs: 120000 });
}

function renderAvatarPreview(previewId, url, fallbackText = "--") {
  const preview = document.getElementById(previewId);
  if (!preview) return;
  const safe = String(url || "").trim();
  if (!safe) {
    preview.innerHTML = escapeHtml(fallbackText);
    return;
  }
  preview.innerHTML = `<img src="${escapeHtml(safe)}" alt="avatar" class="avatar-img" />`;
}

function renderAvatarPicker(hostId, currentUrl, onPick) {
  const host = document.getElementById(hostId);
  if (!host) return;
  const selected = String(currentUrl || "").trim();
  host.innerHTML = DEFAULT_AVATARS
    .map((url) => {
      const active = selected && url === selected ? "active" : "";
      return `<button type="button" class="avatar-chip ${active}" data-avatar-url="${escapeHtml(url)}"><img src="${escapeHtml(url)}" alt="avatar" /></button>`;
    })
    .join("");
  host.querySelectorAll("[data-avatar-url]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const url = String(btn.dataset.avatarUrl || "").trim();
      if (typeof onPick === "function") onPick(url);
    });
  });
}

async function uploadAvatarFile(inputId, endpoint) {
  const input = document.getElementById(inputId);
  const file = input?.files?.[0] || null;
  if (!file) {
    alert(tr("Выберите файл изображения.", "Choose an image file."));
    return null;
  }
  if (!String(file.type || "").startsWith("image/")) {
    alert(tr("Файл должен быть изображением.", "File must be an image."));
    return null;
  }
  if (file.size > 4 * 1024 * 1024) {
    alert(tr("Файл слишком большой (до 4 МБ).", "File is too large (max 4 MB)."));
    return null;
  }
  const form = new FormData();
  form.append("file", file);
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const data = await requestJson(endpoint, {
      method: "POST",
      headers,
      body: form,
      timeoutMs: 60000,
      retryOnPost: true,
      maxRetries: 1,
    });
    return data;
  } finally {
    if (input) input.value = "";
  }
}

async function uploadProfileAvatar() {
  try {
    const data = await uploadAvatarFile("profileAvatarUpload", "/api/profile/avatar/upload");
    if (!data?.url) return;
    setInputValue("profileAvatarUrl", String(data.url || ""));
    renderAvatarPreview("profileAvatarPreview", String(data.url || ""), computeAvatarInitials(me?.actor_nick, me?.email));
    renderAvatarPicker("profileAvatarPicker", String(data.url || ""), (url) => {
      setInputValue("profileAvatarUrl", url);
      renderAvatarPreview("profileAvatarPreview", url, computeAvatarInitials(me?.actor_nick, me?.email));
    });
    if (me && !me.actor_is_owner) {
      me.avatar_url = String(data.url || "");
      renderTopbarUser();
    }
    await loadProfile();
  } catch (e) {
    alert(e.message);
  }
}

function triggerProfileAvatarUpload() {
  document.getElementById("profileAvatarUpload")?.click();
}

function triggerTeamAvatarUpload() {
  document.getElementById("teamAvatarUpload")?.click();
}

async function uploadTeamAvatar() {
  if (!activeTeamMemberId) {
    alert(tr("Сначала выберите сотрудника.", "Select a team member first."));
    return;
  }
  try {
    const data = await uploadAvatarFile("teamAvatarUpload", `/api/profile/team/${activeTeamMemberId}/avatar/upload`);
    if (!data?.url) return;
    setInputValue("teamModalAvatar", String(data.url || ""));
    renderAvatarPreview("teamAvatarPreview", String(data.url || ""), "--");
    renderAvatarPicker("teamAvatarPicker", String(data.url || ""), (url) => {
      setInputValue("teamModalAvatar", url);
      renderAvatarPreview("teamAvatarPreview", url, "--");
    });
    const row = findTeamMemberById(activeTeamMemberId);
    if (row) {
      row.avatar_url = String(data.url || "");
      if (me && Number(me.actor_member_id || 0) === Number(activeTeamMemberId || 0)) {
        me.avatar_url = String(data.url || "");
        renderTopbarUser();
      }
      renderTeamMembers();
    }
  } catch (e) {
    alert(e.message);
  }
}

function initAuthRemember() {
  const emailEl = document.getElementById("loginEmail");
  const rememberEl = document.getElementById("loginRemember");
  const savedEmail = String(localStorage.getItem("login_email") || "");
  if (emailEl && savedEmail && !emailEl.value) emailEl.value = savedEmail;
  if (rememberEl) {
    rememberEl.checked = localStorage.getItem("remember_me") !== "0";
  }
}

async function saveKey(marketplace) {
  const inputId = marketplace === "wb" ? "wbKey" : "ozonKey";
  const api_key = document.getElementById(inputId).value.trim();
  await requestJson("/api/credentials", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ marketplace, api_key }),
  }).catch((e) => alert(e.message));
  await loadKeys();
}

async function testKey(marketplace) {
  const inputId = marketplace === "wb" ? "wbKey" : "ozonKey";
  const api_key = document.getElementById(inputId).value.trim();
  if (!api_key) return alert(tr("Введите ключ", "Enter API key"));
  const data = await requestJson("/api/credentials/test", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ marketplace, api_key }),
  }).catch((e) => alert(e.message));
  if (data) alert(data.message);
}

async function deleteKey(marketplace) {
  await requestJson(`/api/credentials/${marketplace}`, { method: "DELETE", headers: authHeaders() }).catch((e) => alert(e.message));
  await loadKeys();
}

async function loadKeys() {
  const data = await requestJson("/api/credentials", { headers: authHeaders() }).catch(() => null);
  if (!data) return;
  document.getElementById("keysList").textContent = JSON.stringify(data, null, 2);
}

async function addKeyword() {
  const marketplace = document.getElementById("kwMarketplace").value;
  const keyword = document.getElementById("kwText").value.trim();
  if (!keyword) return alert(tr("Введите ключевик", "Enter keyword"));
  await requestJson("/api/keywords", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ marketplace, keyword }),
  }).catch((e) => alert(e.message));
  document.getElementById("kwText").value = "";
  await loadKeywords();
}

async function loadKeywords() {
  const data = await requestJson("/api/keywords", { headers: authHeaders() }).catch(() => null);
  if (!data) return;
  const host = document.getElementById("keywordsList");
  if (!host) return;
  const rows = Array.isArray(data) ? data : [];
  if (!rows.length) {
    host.innerHTML = `<div class="hint">${tr("Пока нет ручных ключей.", "No manual keywords yet.")}</div>`;
    return;
  }
  host.innerHTML = rows
    .slice()
    .sort((a, b) => Number(b.id || 0) - Number(a.id || 0))
    .map((row) => `
      <article class="keyword-item">
        <div>
          <b>${escapeHtml(String(row.keyword || "-"))}</b>
          <span>${escapeHtml(String(row.marketplace || "all").toUpperCase())}</span>
        </div>
        <button class="btn-danger icon-action-btn" type="button" data-tip="${tr("Удалить ключ", "Delete keyword")}" onclick="deleteKeyword(${Number(row.id || 0)})">✖</button>
      </article>
    `)
    .join("");
}

async function deleteKeyword(keywordId) {
  const id = Number(keywordId || 0);
  if (!id) return;
  await requestJson(`/api/keywords/${id}`, { method: "DELETE", headers: authHeaders() }).catch((e) => alert(e.message));
  await loadKeywords();
}

function switchReviewsSubtab(tab, preload = true) {
  const safeTab = String(tab || "").trim().toLowerCase();
  const next = safeTab === "questions" ? "questions" : (safeTab === "returns" ? "returns" : "reviews");
  currentReviewsSubtab = next;
  const showReviews = next === "reviews";
  const showQuestions = next === "questions";
  const showReturns = next === "returns";
  document.getElementById("reviewsSubtabReviews")?.classList.toggle("hidden", !showReviews);
  document.getElementById("reviewsSubtabQuestions")?.classList.toggle("hidden", !showQuestions);
  document.getElementById("reviewsSubtabReturns")?.classList.toggle("hidden", !showReturns);
  document.getElementById("reviewsSubtabReviewsBtn")?.classList.toggle("active", showReviews);
  document.getElementById("reviewsSubtabQuestionsBtn")?.classList.toggle("active", showQuestions);
  document.getElementById("reviewsSubtabReturnsBtn")?.classList.toggle("active", showReturns);
  refreshSectionHeading("reviews");
  syncMobileQuickNavSelection();
  if (!preload) return;
  if (showReviews) {
    trackUiActivity("ui_subtab_opened", "wb_reviews_ai", "subtab=reviews", { cooldownMs: 15000 });
    if (!wbReviewRows.length) loadWbReviews();
  } else if (showQuestions) {
    trackUiActivity("ui_subtab_opened", "wb_questions_ai", "subtab=questions", { cooldownMs: 15000 });
    if (!wbQuestionRows.length) loadQuestionsWorkspace();
  } else if (showReturns) {
    trackUiActivity("ui_subtab_opened", "returns", "subtab=returns", { cooldownMs: 15000 });
    if (!returnsRows.length) loadReturns();
  }
}

function syncReviewsSubtabAccess() {
  const canReviews = enabledModules.has("wb_reviews_ai");
  const canQuestions = enabledModules.has("wb_questions_ai");
  const canReturns = enabledModules.has("returns");
  document.getElementById("reviewsSubtabReviewsBtn")?.classList.toggle("hidden", !canReviews);
  document.getElementById("reviewsSubtabQuestionsBtn")?.classList.toggle("hidden", !canQuestions);
  document.getElementById("reviewsSubtabReturnsBtn")?.classList.toggle("hidden", !canReturns);
  if (!canReviews && canQuestions) currentReviewsSubtab = "questions";
  if (!canQuestions && canReviews) currentReviewsSubtab = "reviews";
  if (!canReviews && !canQuestions && canReturns) currentReviewsSubtab = "returns";
  if (!canReturns && currentReviewsSubtab === "returns") {
    currentReviewsSubtab = canReviews ? "reviews" : (canQuestions ? "questions" : "reviews");
  }
}

function switchAdsSubtab(tab, preload = true) {
  const allowed = new Set(["campaigns", "analytics", "recommendations", "bidder", "ozon"]);
  const next = allowed.has(String(tab || "")) ? String(tab) : "campaigns";
  currentAdsSubtab = next;
  try {
    sessionStorage.setItem("seo_wibe_last_ads_subtab", String(currentAdsSubtab || "campaigns"));
  } catch (_) {}
  const all = ["campaigns", "analytics", "recommendations", "bidder", "ozon"];
  for (const key of all) {
    const active = key === next;
    document.getElementById(`adsSubtab${key[0].toUpperCase()}${key.slice(1)}`)?.classList.toggle("hidden", !active);
    document.getElementById(`adsSubtab${key[0].toUpperCase()}${key.slice(1)}Btn`)?.classList.toggle("active", active);
  }
  refreshSectionHeading("ads");
  syncMobileQuickNavSelection();
  if (!preload) return;
  if (next === "campaigns" && enabledModules.has("wb_ads")) {
    trackUiActivity("ui_subtab_opened", "wb_ads", "subtab=campaigns", { cooldownMs: 15000 });
    loadWbAdCampaigns();
  }
  if (next === "analytics" && enabledModules.has("wb_ads_analytics")) {
    trackUiActivity("ui_subtab_opened", "wb_ads_analytics", "subtab=analytics", { cooldownMs: 15000 });
    loadAdsAnalytics();
  }
  if (next === "recommendations" && enabledModules.has("wb_ads_recommendations")) {
    trackUiActivity("ui_subtab_opened", "wb_ads_recommendations", "subtab=recommendations", { cooldownMs: 15000 });
    loadAdsRecommendations();
  }
  if (next === "bidder" && enabledModules.has("wb_ads")) {
    trackUiActivity("ui_subtab_opened", "wb_ads", "subtab=bidder", { cooldownMs: 15000 });
    syncWbBidderTargetKindUi();
    loadWbBidderWorkspace();
  }
}

function syncAdsSubtabAccess() {
  const access = {
    campaigns: enabledModules.has("wb_ads"),
    analytics: enabledModules.has("wb_ads_analytics"),
    recommendations: enabledModules.has("wb_ads_recommendations"),
    bidder: enabledModules.has("wb_ads"),
    ozon: true,
  };
  for (const [tab, ok] of Object.entries(access)) {
    const label = tab[0].toUpperCase() + tab.slice(1);
    document.getElementById(`adsSubtab${label}Btn`)?.classList.toggle("hidden", !ok);
  }
  if (!access[currentAdsSubtab]) {
    currentAdsSubtab = access.campaigns ? "campaigns" : (access.analytics ? "analytics" : (access.recommendations ? "recommendations" : (access.bidder ? "bidder" : "ozon")));
  }
}

function syncHelpSubtabAccess() {
  const canDocs = enabledModules.has("help_center");
  const canAssistant = enabledModules.has("ai_assistant");
  const docsBtn = document.getElementById("helpSubtabDocsBtn");
  const aiBtn = document.getElementById("helpSubtabAssistantBtn");
  const downloadsBtn = document.getElementById("helpSubtabDownloadsBtn");
  if (docsBtn) docsBtn.classList.toggle("hidden", !canDocs);
  if (aiBtn) aiBtn.classList.toggle("hidden", !canAssistant);
  if (downloadsBtn) downloadsBtn.classList.toggle("hidden", !canDocs);
  if (!canDocs && canAssistant) currentHelpSubtab = "assistant";
  if (!canAssistant && canDocs && currentHelpSubtab === "assistant") currentHelpSubtab = "docs";
  if (!canDocs && !canAssistant) currentHelpSubtab = "docs";
  if (canDocs && !["docs", "assistant", "downloads"].includes(String(currentHelpSubtab || ""))) {
    currentHelpSubtab = "docs";
  }
}

function switchHelpSubtab(tab, preload = true) {
  const canDocs = enabledModules.has("help_center");
  const canAssistant = enabledModules.has("ai_assistant");
  let next = ["assistant", "downloads", "docs"].includes(String(tab || "")) ? String(tab) : "docs";
  if (next === "assistant" && !canAssistant && canDocs) next = "docs";
  if ((next === "docs" || next === "downloads") && !canDocs && canAssistant) next = "assistant";
  currentHelpSubtab = next;
  const showDocs = next === "docs" && canDocs;
  const showAssistant = next === "assistant" && canAssistant;
  const showDownloads = next === "downloads" && canDocs;
  document.getElementById("helpSubtabDocs")?.classList.toggle("hidden", !showDocs);
  document.getElementById("helpSubtabAssistant")?.classList.toggle("hidden", !showAssistant);
  document.getElementById("helpSubtabDownloads")?.classList.toggle("hidden", !showDownloads);
  document.getElementById("helpSubtabDocsBtn")?.classList.toggle("active", showDocs);
  document.getElementById("helpSubtabAssistantBtn")?.classList.toggle("active", showAssistant);
  document.getElementById("helpSubtabDownloadsBtn")?.classList.toggle("active", showDownloads);
  refreshSectionHeading("help");
  syncMobileQuickNavSelection();
  if (!preload) return;
  if (showDocs) {
    trackUiActivity("ui_subtab_opened", "help_center", "subtab=docs", { cooldownMs: 15000 });
    loadHelpDocs();
  } else if (showAssistant) {
    trackUiActivity("ui_subtab_opened", "ai_assistant", "subtab=assistant", { cooldownMs: 15000 });
    renderHelpAssistantHistory();
    renderHelpAssistantModuleOptions();
  } else if (showDownloads) {
    trackUiActivity("ui_subtab_opened", "help_center", "subtab=downloads", { cooldownMs: 15000 });
    loadHelpReleases();
  }
}

async function loadAdsWorkspace() {
  const hasAnyAdsModule = enabledModules.has("wb_ads") || enabledModules.has("wb_ads_analytics") || enabledModules.has("wb_ads_recommendations");
  if (!hasAnyAdsModule) return;
  syncAdsSubtabAccess();
  switchAdsSubtab(currentAdsSubtab || "campaigns", true);
}

async function loadHelpWorkspace() {
  const canDocs = enabledModules.has("help_center");
  const canAssistant = enabledModules.has("ai_assistant");
  if (!canDocs && !canAssistant) return;
  syncHelpSubtabAccess();
  if (!canDocs && canAssistant) currentHelpSubtab = "assistant";
  if (canDocs) await loadHelpDocs();
  if (canDocs) await loadHelpReleases();
  renderHelpAssistantHistory();
  renderHelpAssistantModuleOptions();
  switchHelpSubtab(currentHelpSubtab || (canDocs ? "docs" : "assistant"), false);
}

async function loadReviewsWorkspace() {
  await ensureModuleAccess(["wb_reviews_ai", "wb_questions_ai", "returns"]);
  const hasReviews = enabledModules.has("wb_reviews_ai");
  const hasQuestions = enabledModules.has("wb_questions_ai");
  const hasReturns = enabledModules.has("returns");
  if (!hasReviews && !hasQuestions && !hasReturns) return;
  normalizeFeedbackDateDefaults("reviews", "reviewDateFrom", "reviewDateTo");
  normalizeFeedbackDateDefaults("questions", "questionDateFrom", "questionDateTo");
  syncReviewsSubtabAccess();
  const next = currentReviewsSubtab || (hasReviews ? "reviews" : (hasQuestions ? "questions" : "returns"));
  switchReviewsSubtab(next, false);
  if (next === "reviews" && hasReviews) {
    await loadReviewAiSettings();
    await loadAutoReplyStatus(false);
    await loadWbReviews();
  } else if (next === "questions" && hasQuestions) {
    await loadQuestionAiSettings();
    await loadAiDocs();
    await loadWbQuestions();
  } else if (next === "returns" && hasReturns) {
    await loadReturns();
  }
  applyFeedbackPromptVisibility("review");
  applyFeedbackPromptVisibility("question");
}

function applyFeedbackPromptVisibility(kind) {
  const key = String(kind || "").trim().toLowerCase();
  if (!["review", "question"].includes(key)) return;
  const visible = Boolean(feedbackPromptVisibility[key]);
  const wrapId = key === "review" ? "reviewPromptWrap" : "questionPromptWrap";
  const btnId = key === "review" ? "reviewPromptToggleBtn" : "questionPromptToggleBtn";
  const wrap = document.getElementById(wrapId);
  const btn = document.getElementById(btnId);
  if (wrap) wrap.classList.toggle("hidden", !visible);
  if (btn) {
    btn.textContent = visible
      ? tr("Скрыть промпт обучения", "Hide training prompt")
      : tr("Показать промпт обучения", "Show training prompt");
    btn.setAttribute(
      "aria-label",
      visible
        ? tr("Скрыть промпт обучения", "Hide training prompt")
        : tr("Показать промпт обучения", "Show training prompt")
    );
  }
}

function toggleFeedbackPrompt(kind) {
  const key = String(kind || "").trim().toLowerCase();
  if (!["review", "question"].includes(key)) return;
  feedbackPromptVisibility[key] = !Boolean(feedbackPromptVisibility[key]);
  localStorage.setItem(`${key}_prompt_visible`, feedbackPromptVisibility[key] ? "1" : "0");
  applyFeedbackPromptVisibility(key);
}

function renderFeedbackLearning(kind, data = {}) {
  const key = String(kind || "").trim().toLowerCase() === "question" ? "question" : "review";
  const prefix = key === "question" ? "question" : "review";
  const learned = String(data?.learned_prompt || "").trim();
  const meta = data?.learning_meta || {};
  const panel = document.getElementById(`${prefix}LearningPanel`);
  const metaBox = document.getElementById(`${prefix}LearningMeta`);
  const promptBox = document.getElementById(`${prefix}LearnedPrompt`);
  if (panel) panel.classList.toggle("is-empty", !learned);
  if (promptBox) {
    promptBox.textContent = learned || tr("Пока недостаточно реальных ответов для автообучения. Нажмите обновить после загрузки отвеченных отзывов/вопросов.", "Not enough real replies for learning yet. Refresh after loading answered reviews/questions.");
  }
  if (metaBox) {
    const count = Number(meta.source_count || 0);
    const status = String(meta.status || (learned ? "ready" : "empty"));
    const generated = meta.generated_at ? String(meta.generated_at).slice(0, 16).replace("T", " ") : "-";
    const next = meta.next_run_at ? String(meta.next_run_at).slice(0, 16).replace("T", " ") : "-";
    metaBox.textContent = tr(
      `Статус: ${status}; источников: ${count}; обновлено: ${generated}; следующее: ${next}`,
      `Status: ${status}; sources: ${count}; updated: ${generated}; next: ${next}`
    );
  }
}

async function refreshFeedbackLearning(kind) {
  const key = String(kind || "").trim().toLowerCase() === "question" ? "question" : "review";
  const endpoint = key === "question" ? "/api/wb/questions/ai-settings/learn" : "/api/wb/reviews/ai-settings/learn";
  const btn = document.getElementById(key === "question" ? "questionLearningRefreshBtn" : "reviewLearningRefreshBtn");
  if (btn) btn.disabled = true;
  const data = await requestJson(endpoint, {
    method: "POST",
    headers: authHeaders(),
  }).catch((e) => {
    alert(e.message);
    return null;
  });
  if (btn) btn.disabled = false;
  if (!data) return;
  renderFeedbackLearning(key, data);
}

async function loadReviewAiSettings() {
  const data = await requestJson("/api/wb/reviews/ai-settings", { headers: authHeaders() }).catch(() => null);
  if (!data) return;
  const promptInput = document.getElementById("reviewAiPrompt");
  const modeInput = document.getElementById("reviewAiMode");
  if (promptInput) promptInput.value = data.prompt || "";
  if (modeInput) modeInput.value = data.reply_mode || "manual";
  renderFeedbackLearning("review", data);
  applyFeedbackPromptVisibility("review");
}

async function saveReviewAiSettings() {
  if (!enabledModules.has("wb_reviews_ai")) return;
  const prompt = document.getElementById("reviewAiPrompt")?.value || "";
  const reply_mode = document.getElementById("reviewAiMode")?.value || "manual";
  const data = await requestJson("/api/wb/reviews/ai-settings", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ prompt, reply_mode }),
  }).catch((e) => {
    alert(e.message);
    return null;
  });
  if (!data) return;
  alert(tr("AI-настройки сохранены", "AI settings saved"));
  renderFeedbackLearning("review", data);
}

function getAutoReplyPayload(extra = {}) {
  const marketplaces = [];
  if (document.getElementById("autoReplyWb")?.checked) marketplaces.push("wb");
  if (document.getElementById("autoReplyOzon")?.checked) marketplaces.push("ozon");
  const minStars = Number(document.getElementById("autoReplyMinStars")?.value || 4);
  const limit = Number(document.getElementById("autoReplyLimit")?.value || 50);
  return {
    marketplaces: marketplaces.length ? marketplaces : ["wb", "ozon"],
    min_stars: Math.max(1, Math.min(5, Number.isFinite(minStars) ? minStars : 4)),
    limit: Math.max(1, Math.min(200, Number.isFinite(limit) ? limit : 50)),
    ...extra,
  };
}

function setAutoReplyStatus(message, tone = "") {
  const box = document.getElementById("autoReplyStatusBox");
  if (!box) return;
  box.classList.toggle("is-danger", tone === "danger");
  box.classList.toggle("is-ok", tone === "ok");
  box.innerHTML = message;
}

function updateAutoReplyKillBadge(enabled) {
  const badge = document.getElementById("autoReplyKillBadge");
  if (!badge) return;
  badge.classList.toggle("is-on", Boolean(enabled));
  badge.textContent = enabled ? "аварийный стоп включен" : "стоп выключен";
}

function renderAutoReplyStatus(data, mode = "status") {
  const counts = data?.counts || {};
  const rows = Array.isArray(data?.rows) ? data.rows : [];
  updateAutoReplyKillBadge(Boolean(data?.kill_switch));
  if (mode === "dry-run") {
    const candidates = Array.isArray(data?.candidates) ? data.candidates : [];
    const warnings = Array.isArray(data?.warnings) ? data.warnings : [];
    const skipped = data?.skipped || {};
    const preview = candidates.slice(0, 6).map((item) => {
      const market = String(item.marketplace || "").toUpperCase();
      const product = escapeHtml(item.product || "товар без названия");
      const rating = escapeHtml(item.rating || "");
      const text = escapeHtml(item.text || "отзыв без текста").slice(0, 180);
      return `<div class="auto-reply-row"><b>${market} ${rating}★</b><span>${product}</span><small>${text}</small></div>`;
    }).join("");
    const warningHtml = warnings.length
      ? `<div class="auto-reply-warning">${warnings.map((x) => escapeHtml(x)).join("<br>")}</div>`
      : "";
    setAutoReplyStatus(
      `<b>Dry-run готов:</b> найдено ${Number(data?.eligible || 0)} отзывов для очереди. ` +
      `Пропущено: дублей ${Number(skipped.duplicate || 0)}, уже отвеченных ${Number(skipped.already_answered || 0)}, ниже оценки ${Number(skipped.low_rating || 0)}.` +
      warningHtml +
      (preview ? `<div class="auto-reply-preview">${preview}</div>` : "<div>Подходящих отзывов нет.</div>"),
      candidates.length ? "ok" : ""
    );
    return;
  }
  const rowHtml = rows.slice(0, 8).map((row) => {
    const market = escapeHtml(String(row.marketplace || "").toUpperCase());
    const status = escapeHtml(row.status || "");
    const rating = escapeHtml(row.rating || "");
    const error = row.error ? `<small>${escapeHtml(row.error)}</small>` : "";
    return `<div class="auto-reply-row"><b>${market} ${rating}★</b><span>${status}</span>${error}</div>`;
  }).join("");
  setAutoReplyStatus(
    `<b>Журнал:</b> запланировано ${Number(counts.planned || 0)}, отправляется ${Number(counts.sending || 0)}, отправлено ${Number(counts.sent || 0)}, ошибок ${Number(counts.error || 0)}, пропущено ${Number(counts.skipped || 0)}.` +
    (rowHtml ? `<div class="auto-reply-preview">${rowHtml}</div>` : "<div>Записей пока нет.</div>"),
    Number(counts.error || 0) ? "danger" : ""
  );
}

function renderAutoReplyStatus(data, mode = "status") {
  const counts = data?.counts || {};
  const rows = Array.isArray(data?.rows) ? data.rows : [];
  updateAutoReplyKillBadge(Boolean(data?.kill_switch));
  if (mode === "dry-run") {
    const candidates = Array.isArray(data?.candidates) ? data.candidates : [];
    const warnings = Array.isArray(data?.warnings) ? data.warnings : [];
    const skipped = data?.skipped || {};
    const preview = candidates.slice(0, 6).map((item) => {
      const market = String(item.marketplace || "").toUpperCase();
      const product = escapeHtml(item.product || "товар без названия");
      const rating = escapeHtml(item.rating || "");
      const text = escapeHtml(item.text || "отзыв без текста").slice(0, 180);
      return `<div class="auto-reply-row"><b>${market} ${rating}&#9733;</b><span>${product}</span><small>${text}</small></div>`;
    }).join("");
    const warningHtml = warnings.length
      ? `<div class="auto-reply-warning">${warnings.map((x) => escapeHtml(x)).join("<br>")}</div>`
      : "";
    setAutoReplyStatus(
      `<b>Dry-run готов:</b> найдено ${Number(data?.eligible || 0)} отзывов для очереди. ` +
      `Пропущено: дублей ${Number(skipped.duplicate || 0)}, уже отвеченных ${Number(skipped.already_answered || 0)}, ниже оценки ${Number(skipped.low_rating || 0)}, без текста ${Number(skipped.empty_text || 0)}.` +
      warningHtml +
      (preview ? `<div class="auto-reply-preview">${preview}</div>` : "<div>Подходящих отзывов нет.</div>"),
      candidates.length ? "ok" : ""
    );
    return;
  }
  const rowHtml = rows.slice(0, 8).map((row) => {
    const market = escapeHtml(String(row.marketplace || "").toUpperCase());
    const status = escapeHtml(row.status || "");
    const rating = escapeHtml(row.rating || "");
    const error = row.error ? `<small>${escapeHtml(row.error)}</small>` : "";
    return `<div class="auto-reply-row"><b>${market} ${rating}&#9733;</b><span>${status}</span>${error}</div>`;
  }).join("");
  setAutoReplyStatus(
    `<b>Журнал:</b> запланировано ${Number(counts.planned || 0)}, отправляется ${Number(counts.sending || 0)}, отправлено ${Number(counts.sent || 0)}, ошибок ${Number(counts.error || 0)}, пропущено ${Number(counts.skipped || 0)}.` +
    (rowHtml ? `<div class="auto-reply-preview">${rowHtml}</div>` : "<div>Записей пока нет.</div>"),
    Number(counts.error || 0) ? "danger" : ""
  );
}

async function loadAutoReplyStatus(showErrors = true) {
  if (!enabledModules.has("wb_reviews_ai")) return null;
  const data = await requestJson("/api/feedback/auto-replies/status?limit=20", {
    headers: authHeaders(),
    timeoutMs: 30000,
  }).catch((e) => {
    if (showErrors) setAutoReplyStatus(escapeHtml(e.message || "Не удалось загрузить журнал автоответов."), "danger");
    return null;
  });
  if (!data) return null;
  renderAutoReplyStatus(data);
  return data;
}

async function runAutoReplyDryRun() {
  if (!enabledModules.has("wb_reviews_ai")) return;
  setAutoReplyStatus("Проверяю отзывы без отправки...");
  const payload = getAutoReplyPayload();
  const data = await requestJson("/api/feedback/auto-replies/dry-run", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
    timeoutMs: 60000,
  }).catch((e) => {
    setAutoReplyStatus(escapeHtml(e.message || "Dry-run не выполнен."), "danger");
    return null;
  });
  if (!data) return;
  lastAutoReplyDryRun = { at: Date.now(), eligible: Number(data.eligible || 0), payload, data };
  renderAutoReplyStatus(data, "dry-run");
}

async function legacyQueueAutoReplies() {
  if (!enabledModules.has("wb_reviews_ai")) return;
  const basePayload = getAutoReplyPayload();
  const dryRunFresh = lastAutoReplyDryRun
    && (Date.now() - Number(lastAutoReplyDryRun.at || 0) < 10 * 60 * 1000)
    && JSON.stringify(lastAutoReplyDryRun.payload || {}) === JSON.stringify(basePayload);
  if (!dryRunFresh) {
    alert("Сначала нажмите «Проверить без отправки». Это защита от случайной массовой публикации.");
    return;
  }
  if (!Number(lastAutoReplyDryRun.eligible || 0)) {
    alert("Dry-run не нашел отзывов для автоответа.");
    return;
  }
  const ok = confirm(`Поставить в очередь ${lastAutoReplyDryRun.eligible} автоответов? Они будут опубликованы в WB/Ozon от имени вашего магазина.`);
  if (!ok) return;
  setAutoReplyStatus("Ставлю автоответы в очередь...");
  const data = await requestJson("/api/feedback/auto-replies/start", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ ...basePayload, confirm: true, from_dry_run: true, allow_stale_wb: basePayload.marketplaces.includes("wb") }),
    timeoutMs: 60000,
  }).catch((e) => {
    setAutoReplyStatus(escapeHtml(e.message || "Не удалось поставить автоответы в очередь."), "danger");
    return null;
  });
  if (!data) return;
  setAutoReplyStatus(data.queued ? "Очередь автоответов запущена. Обновляю журнал..." : "Подходящих отзывов для очереди нет.", data.queued ? "ok" : "");
  setTimeout(() => loadAutoReplyStatus(false), 1200);
}

async function queueAutoReplies() {
  if (!enabledModules.has("wb_reviews_ai")) return;
  const basePayload = getAutoReplyPayload();
  const dryRunFresh = lastAutoReplyDryRun
    && (Date.now() - Number(lastAutoReplyDryRun.at || 0) < 10 * 60 * 1000)
    && JSON.stringify(lastAutoReplyDryRun.payload || {}) === JSON.stringify(basePayload);
  if (!dryRunFresh) {
    alert("Сначала нажмите «Проверить без отправки». Это защита от случайной массовой публикации.");
    return;
  }
  if (!Number(lastAutoReplyDryRun.eligible || 0)) {
    alert("Dry-run не нашел отзывов для автоответа.");
    return;
  }
  const ok = confirm(`Поставить в очередь ${lastAutoReplyDryRun.eligible} автоответов? Они будут опубликованы в WB/Ozon от имени вашего магазина.`);
  if (!ok) return;
  setAutoReplyStatus("Ставлю автоответы в очередь...");
  const data = await requestJson("/api/feedback/auto-replies/start", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ ...basePayload, confirm: true, from_dry_run: true, allow_stale_wb: basePayload.marketplaces.includes("wb") }),
    timeoutMs: 60000,
  }).catch((e) => {
    setAutoReplyStatus(escapeHtml(e.message || "Не удалось поставить автоответы в очередь."), "danger");
    return null;
  });
  if (!data) return;
  if (!data.queued) {
    const skipped = data.skipped || {};
    const warnings = Array.isArray(data.warnings) ? data.warnings : [];
    const warningHtml = warnings.length ? `<div class="auto-reply-warning">${warnings.map((x) => escapeHtml(x)).join("<br>")}</div>` : "";
    setAutoReplyStatus(
      `Подходящих отзывов для очереди нет. Причина: ${escapeHtml(data.reason || "no_candidates")}. ` +
      `Пропущено: дублей ${Number(skipped.duplicate || 0)}, уже отвеченных ${Number(skipped.already_answered || 0)}, ` +
      `без текста ${Number(skipped.empty_text || 0)}, с прежней 404-ошибкой ${Number(skipped.previous_error || 0)}, WB-кэш ${Number(skipped.stale_wb || 0)}.` +
      warningHtml,
      "danger"
    );
    return;
  }
  setAutoReplyStatus("Очередь автоответов запущена. Обновляю журнал...", "ok");
  setTimeout(() => loadAutoReplyStatus(false), 1200);
}

async function setAutoReplyKillSwitch(enabled) {
  if (!enabledModules.has("wb_reviews_ai")) return;
  const flag = Boolean(enabled);
  if (flag && !confirm("Включить аварийный стоп? Новые автоответы из очереди будут пропускаться.")) return;
  const data = await requestJson("/api/feedback/auto-replies/kill-switch", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ enabled: flag }),
    timeoutMs: 30000,
  }).catch((e) => {
    setAutoReplyStatus(escapeHtml(e.message || "Не удалось изменить аварийный стоп."), "danger");
    return null;
  });
  if (!data) return;
  updateAutoReplyKillBadge(Boolean(data.enabled));
  await loadAutoReplyStatus(false);
}

function getReviewsMarketplace() {
  const raw = (document.getElementById("reviewMarketplace")?.value || "wb").trim().toLowerCase();
  return raw === "ozon" ? "ozon" : "wb";
}

function getReviewsEndpoint(marketplace) {
  return marketplace === "ozon" ? "/api/ozon/reviews" : "/api/wb/reviews";
}

function reviewDraftKey(marketplace, reviewId) {
  return `${marketplace}:${String(reviewId || "")}`;
}

function applyDraftToVisibleInputs(selector, id, text) {
  const safeId = String(id || "");
  if (!safeId) return;
  const nodes = document.querySelectorAll(selector);
  for (const node of nodes) {
    if (String(node?.dataset?.itemId || "") !== safeId) continue;
    if (typeof node.value === "string") node.value = String(text || "");
  }
}

function scheduleBackgroundReviewsReload(delayMs = 1400) {
  if (reviewBackgroundReloadTimer) clearTimeout(reviewBackgroundReloadTimer);
  reviewBackgroundReloadTimer = setTimeout(() => {
    reviewBackgroundReloadTimer = null;
    loadWbReviews().catch(() => null);
  }, Math.max(250, Number(delayMs || 0)));
}

function scheduleBackgroundQuestionsReload(delayMs = 1400) {
  if (questionBackgroundReloadTimer) clearTimeout(questionBackgroundReloadTimer);
  questionBackgroundReloadTimer = setTimeout(() => {
    questionBackgroundReloadTimer = null;
    loadWbQuestions().catch(() => null);
  }, Math.max(250, Number(delayMs || 0)));
}

function parseDateValue(raw) {
  const value = String(raw || "").trim();
  if (!value) return 0;
  const t = Date.parse(value);
  if (Number.isFinite(t)) return t;
  return 0;
}

function parseReviewDate(row) {
  return parseDateValue(row?.created_at || row?.date || "");
}

function rowMatchesDateRange(row, dateFromRaw, dateToRaw) {
  const rowTs = parseReviewDate(row);
  if (!rowTs) return false;
  const fromTs = parseDateValue(dateFromRaw ? `${dateFromRaw}T00:00:00` : "");
  const toTs = parseDateValue(dateToRaw ? `${dateToRaw}T23:59:59` : "");
  if (fromTs && rowTs < fromTs) return false;
  if (toTs && rowTs > toTs) return false;
  return true;
}

function normalizeReviewStatus(row) {
  const answered = Boolean(
    row?.is_answered ||
    row?._type === "answered" ||
    String(row?.answer || "").trim()
  );
  return answered ? "answered" : "new";
}

function feedbackStatusPriority(row, resolveStatus) {
  const status = typeof resolveStatus === "function" ? String(resolveStatus(row) || "") : "";
  return status === "new" ? 0 : 1;
}

function closeReviewPhotoViewer() {
  const modal = document.getElementById("reviewPhotoModal");
  if (!modal) return;
  modal.classList.add("hidden");
}

function renderReviewPhotoViewer() {
  const modal = document.getElementById("reviewPhotoModal");
  const img = document.getElementById("reviewPhotoModalImg");
  const counter = document.getElementById("reviewPhotoModalCounter");
  if (!modal || !img || !counter) return;
  if (!reviewPhotoItems.length) {
    closeReviewPhotoViewer();
    return;
  }
  const idx = Math.max(0, Math.min(reviewPhotoIndex, reviewPhotoItems.length - 1));
  reviewPhotoIndex = idx;
  img.src = reviewPhotoItems[idx];
  counter.textContent = `${idx + 1} / ${reviewPhotoItems.length}`;
}

function openReviewPhotoViewer(photos, startIndex = 0) {
  const rows = Array.isArray(photos) ? photos.filter((x) => typeof x === "string" && x.trim()) : [];
  if (!rows.length) return;
  reviewPhotoItems = rows;
  reviewPhotoIndex = Math.max(0, Math.min(startIndex, rows.length - 1));
  const modal = document.getElementById("reviewPhotoModal");
  if (!modal) return;
  modal.classList.remove("hidden");
  renderReviewPhotoViewer();
}

function reviewPhotoPrev() {
  if (!reviewPhotoItems.length) return;
  reviewPhotoIndex = (reviewPhotoIndex - 1 + reviewPhotoItems.length) % reviewPhotoItems.length;
  renderReviewPhotoViewer();
}

function reviewPhotoNext() {
  if (!reviewPhotoItems.length) return;
  reviewPhotoIndex = (reviewPhotoIndex + 1) % reviewPhotoItems.length;
  renderReviewPhotoViewer();
}

window.openReviewPhotoViewer = openReviewPhotoViewer;
window.closeReviewPhotoViewer = closeReviewPhotoViewer;
window.reviewPhotoPrev = reviewPhotoPrev;
window.reviewPhotoNext = reviewPhotoNext;

function updateReviewLoadStatus(message = "") {
  const el = document.getElementById("reviewLoadStatus");
  if (!el) return;
  if (message) {
    el.innerHTML = buildLoadStatusHtml({
      title: message,
      loaded: reviewLoadProgress.loaded || 0,
      total: reviewLoadProgress.total || 0,
      active: reviewLoadProgress.active,
    });
    return;
  }
  const { active, loaded, total } = reviewLoadProgress;
  if (!total) {
    el.textContent = "-";
    return;
  }
  el.innerHTML = buildLoadStatusHtml({
    title: active
      ? tr("Загрузка отзывов", "Loading reviews")
      : tr("Отзывы загружены", "Reviews loaded"),
    loaded,
    total,
    active,
  });
}

function updateQuestionLoadStatus(message = "") {
  const el = document.getElementById("questionLoadStatus");
  if (!el) return;
  if (message) {
    el.innerHTML = buildLoadStatusHtml({
      title: message,
      loaded: questionLoadProgress.loaded || 0,
      total: questionLoadProgress.total || 0,
      active: questionLoadProgress.active,
    });
    return;
  }
  const { active, loaded, total } = questionLoadProgress;
  if (!total) {
    el.textContent = "-";
    return;
  }
  el.innerHTML = buildLoadStatusHtml({
    title: active
      ? tr("Загрузка вопросов", "Loading questions")
      : tr("Вопросы загружены", "Questions loaded"),
    loaded,
    total,
    active,
  });
}

function buildLoadStatusHtml({ title = "", loaded = 0, total = 0, active = false, failed = 0 }) {
  const safeTotal = Math.max(0, Number(total || 0));
  const safeLoaded = Math.max(0, Math.min(safeTotal || Number(loaded || 0), Number(loaded || 0)));
  const ratio = safeTotal > 0 ? Math.max(0, Math.min(100, (safeLoaded / safeTotal) * 100)) : (active ? 8 : 0);
  const progressText = safeTotal > 0 ? `${safeLoaded} / ${safeTotal}` : (active ? tr("подготовка", "preparing") : "-");
  const failedText = failed > 0 ? ` ? ${tr("\u043e\u0448\u0438\u0431\u043e\u043a", "errors")}: ${failed}` : "";
  return `
    <div class="status-wrap ${active ? "active" : "done"}">
      <div class="status-head">
        <span>${escapeHtml(title || (active ? tr("Загрузка", "Loading") : tr("Готово", "Done")))}</span>
        <b>${escapeHtml(progressText)}${escapeHtml(failedText)}</b>
      </div>
      <div class="status-track"><i style="width:${ratio.toFixed(2)}%"></i></div>
    </div>
  `;
}

function renderProductCellText(row) {
  const name = String(row?.product || "-");
  const article = String(row?.article || "-");
  const barcode = String(row?.barcode || "").trim();
  if (!barcode) return `${name} (${article})`;
  return `${name} (${article}; ${currentLang === "en" ? "barcode" : "штрихкод"}: ${barcode})`;
}

function renderFeedbackProductCell(targetCell, row) {
  if (!targetCell) return;
  targetCell.className = "cell-product-text";
  targetCell.innerHTML = "";
  const name = String(row?.product || "-").trim() || "-";
  const article = String(row?.article || "").trim();
  const barcode = String(row?.barcode || "").trim();

  const nameEl = document.createElement("div");
  nameEl.className = "cell-product-name";
  nameEl.textContent = name;
  targetCell.appendChild(nameEl);

  if (article) {
    const articleEl = document.createElement("div");
    articleEl.className = "cell-meta-small";
    articleEl.textContent = `${currentLang === "en" ? "Article" : "Артикул"}: ${article}`;
    targetCell.appendChild(articleEl);
  }
  if (barcode) {
    const barcodeEl = document.createElement("div");
    barcodeEl.className = "cell-meta-small";
    barcodeEl.textContent = `${currentLang === "en" ? "Barcode" : "Штрихкод"}: ${barcode}`;
    targetCell.appendChild(barcodeEl);
  }
}

function makeIconActionButton({ icon, tip, onClick, secondary = false }) {
  const btn = document.createElement("button");
  btn.className = secondary ? "btn-secondary icon-action-btn" : "icon-action-btn";
  btn.type = "button";
  btn.innerHTML = icon;
  btn.dataset.tip = tip;
  btn.onclick = onClick;
  return btn;
}

function setTableMessage(tableBodyId, colspan, message) {
  const tbody = document.getElementById(tableBodyId);
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="${Math.max(1, Number(colspan || 1))}">${escapeHtml(String(message || "-"))}</td></tr>`;
}

function normalizeFeedbackText(value) {
  if (typeof value === "string") return value;
  if (value == null) return "";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch (_) {
    return "";
  }
}

function normalizeFeedbackPhotos(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const item of value) {
    if (typeof item === "string" && item.trim()) {
      out.push(item.trim());
      continue;
    }
    if (item && typeof item === "object") {
      const raw = item.url || item.link || item.photo || item.src || "";
      const text = typeof raw === "string" ? raw.trim() : "";
      if (text) out.push(text);
    }
  }
  return out;
}

function normalizeFeedbackRow(rawRow, rowType, idx, marketplace) {
  if (!rawRow || typeof rawRow !== "object") return null;
  const rawId = rawRow.id
    ?? rawRow.feedbackId
    ?? rawRow.feedback_id
    ?? rawRow.reviewId
    ?? rawRow.review_id
    ?? rawRow.questionId
    ?? rawRow.question_id
    ?? rawRow.commentId
    ?? rawRow.comment_id
    ?? "";
  const syntheticId = buildFeedbackSyntheticId(rawRow, marketplace);
  const id = String(rawId || "").trim() || syntheticId || `${marketplace || "row"}-${rowType}-${idx + 1}`;
  return {
    ...rawRow,
    id,
    _type: rowType,
    _marketplace: marketplace,
    date: normalizeFeedbackText(rawRow.date || ""),
    created_at: normalizeFeedbackText(rawRow.created_at || rawRow.date || ""),
    product: normalizeFeedbackText(rawRow.product || ""),
    article: normalizeFeedbackText(rawRow.article || ""),
    barcode: normalizeFeedbackText(rawRow.barcode || ""),
    text: normalizeFeedbackText(rawRow.text || ""),
    answer: normalizeFeedbackText(rawRow.answer || ""),
    user: normalizeFeedbackText(
      rawRow.user
      ?? rawRow.userName
      ?? rawRow.username
      ?? rawRow.customerName
      ?? rawRow.customer_name
      ?? rawRow.author
      ?? rawRow.authorName
      ?? rawRow.author_name
      ?? rawRow.buyer_name
      ?? rawRow.buyerName
      ?? ""
    ),
    photos: normalizeFeedbackPhotos(rawRow.photos),
  };
}

function stableTextHash(value) {
  const text = String(value || "");
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function buildFeedbackSyntheticId(rawRow, marketplace = "") {
  if (!rawRow || typeof rawRow !== "object") return "";
  const parts = [
    normalizeFeedbackText(rawRow.created_at || rawRow.createdAt || rawRow.createdDate || rawRow.date || ""),
    normalizeFeedbackText(rawRow.product || rawRow.product_name || rawRow.productName || ""),
    normalizeFeedbackText(rawRow.article || rawRow.offer_id || rawRow.offerId || ""),
    normalizeFeedbackText(rawRow.barcode || ""),
    normalizeFeedbackText(rawRow.user || rawRow.userName || rawRow.customerName || rawRow.author || ""),
    normalizeFeedbackText(rawRow.stars ?? rawRow.rating ?? rawRow.productValuation ?? ""),
    normalizeFeedbackText(rawRow.text || rawRow.question || rawRow.content || rawRow.message || ""),
    normalizeFeedbackText(rawRow.answer || rawRow.answerText || rawRow.reply || ""),
  ];
  const fingerprint = parts.join("|").trim().toLowerCase();
  if (!fingerprint || !fingerprint.replace(/\|/g, "")) return "";
  return `${marketplace || "row"}-fb-${stableTextHash(fingerprint)}`;
}

function getFeedbackExternalId(row, marketplace = "") {
  if (!row || typeof row !== "object") return "";
  const candidates = [
    row.feedbackId,
    row.feedback_id,
    row.reviewId,
    row.review_id,
    row.commentId,
    row.comment_id,
    row.id,
  ];
  const syntheticPrefix = `${String(marketplace || row._marketplace || "").trim().toLowerCase()}-fb-`;
  for (const raw of candidates) {
    const value = String(raw || "").trim();
    if (!value) continue;
    if (syntheticPrefix && value.toLowerCase().startsWith(syntheticPrefix)) continue;
    if (/^[a-z]+-fb-[0-9a-f]{8}$/i.test(value)) continue;
    return value;
  }
  return "";
}

function buildFeedbackCabinetUrl(row, marketplace = "wb") {
  const mp = String(marketplace || row?._marketplace || "wb").trim().toLowerCase() === "ozon" ? "ozon" : "wb";
  const feedbackId = getFeedbackExternalId(row, mp);
  if (mp === "ozon") {
    const url = new URL("https://seller.ozon.ru/app/reviews");
    if (feedbackId) {
      url.searchParams.set("review_id", feedbackId);
      url.searchParams.set("search", feedbackId);
    }
    return url.toString();
  }
  const url = new URL("https://seller.wildberries.ru/content-ratings/feedback");
  if (feedbackId) {
    url.searchParams.set("feedbackId", feedbackId);
    url.searchParams.set("search", feedbackId);
  }
  return url.toString();
}

function appendFeedbackCabinetLink(card, row, marketplace = "wb") {
  if (!card) return;
  const mp = String(marketplace || row?._marketplace || "wb").trim().toLowerCase() === "ozon" ? "ozon" : "wb";
  const feedbackId = getFeedbackExternalId(row, mp);
  const line = document.createElement("div");
  line.className = "feedback-cabinet-line";

  const link = document.createElement("a");
  link.className = "btn-secondary feedback-cabinet-link";
  link.href = buildFeedbackCabinetUrl(row, mp);
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = currentLang === "en" ? `Open in ${mp.toUpperCase()} cabinet` : `Открыть в ЛК ${mp.toUpperCase()}`;
  link.dataset.tip = currentLang === "en"
    ? "Opens the marketplace seller cabinet in a new tab."
    : "Откроет личный кабинет маркетплейса в новой вкладке.";
  line.appendChild(link);

  const idHint = document.createElement("span");
  idHint.className = "cell-meta-small feedback-cabinet-id";
  idHint.textContent = feedbackId
    ? (currentLang === "en" ? `Review ID: ${feedbackId}` : `ID отзыва: ${feedbackId}`)
    : (currentLang === "en" ? "Review ID is unavailable in API response" : "ID отзыва не пришел в ответе API");
  line.appendChild(idHint);
  card.appendChild(line);
}

function isFeedbackAnsweredRow(row) {
  return Boolean(
    row?.is_answered ||
    row?._type === "answered" ||
    String(row?.answer || "").trim()
  );
}

function feedbackRowQuality(row) {
  if (!row || typeof row !== "object") return 0;
  let score = 0;
  if (isFeedbackAnsweredRow(row)) score += 100;
  score += Math.min(60, String(row.answer || "").trim().length);
  score += Math.min(40, String(row.text || "").trim().length);
  if (String(row.created_at || row.date || "").trim()) score += 8;
  if (String(row.product || "").trim()) score += 5;
  if (String(row.article || "").trim()) score += 3;
  if (String(row.barcode || "").trim()) score += 2;
  return score;
}

function dedupeFeedbackRows(rows) {
  const out = new Map();
  if (!Array.isArray(rows)) return [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const primaryId = String(row.id || "").trim();
    const syntheticId = buildFeedbackSyntheticId(row, row._marketplace || "");
    const key = primaryId || syntheticId;
    if (!key) continue;
    const prev = out.get(key);
    if (!prev) {
      out.set(key, row);
      continue;
    }
    const keepCurrent = feedbackRowQuality(row) >= feedbackRowQuality(prev);
    const base = keepCurrent ? prev : row;
    const preferred = keepCurrent ? row : prev;
    const merged = {
      ...base,
      ...preferred,
      id: key,
      is_answered: isFeedbackAnsweredRow(prev) || isFeedbackAnsweredRow(row),
    };
    merged._type = merged.is_answered ? "answered" : "new";
    out.set(key, merged);
  }
  return [...out.values()];
}

async function loadWbReviews() {
  if (reviewBackgroundReloadTimer) {
    clearTimeout(reviewBackgroundReloadTimer);
    reviewBackgroundReloadTimer = null;
  }
  if (!(await ensureModuleAccess("wb_reviews_ai"))) {
    setTableMessage("wbReviewsTable", 7, tr("Модуль отзывов отключен администратором.", "Reviews module is disabled by admin."));
    updateReviewLoadStatus(tr("Модуль отключен.", "Module is disabled."));
    return;
  }
  reviewLoadToken += 1;
  const runToken = reviewLoadToken;
  const marketplace = getReviewsMarketplace();
  const switchedMarketplace = currentReviewMarketplace !== marketplace;
  currentReviewMarketplace = marketplace;
  if (switchedMarketplace) {
    wbReviewRows = [];
    reviewLoadProgress = { active: false, total: 0, loaded: 0 };
    updateReviewLoadStatus();
    renderWbReviews();
  }
  const starsRaw = document.getElementById("reviewStarsFilter")?.value || "";
  const { dateFrom, dateTo } = resolveFeedbackDateFilters("reviews", "reviewDateFrom", "reviewDateTo");
  const qp = new URLSearchParams();
  if (starsRaw) qp.set("stars", starsRaw);
  if (dateFrom) qp.set("date_from", dateFrom);
  if (dateTo) qp.set("date_to", dateTo);
  const fastParams = new URLSearchParams(qp);
  fastParams.set("fast", "1");
  const fastSuffix = fastParams.toString() ? `?${fastParams.toString()}` : "";
  const fullSuffix = qp.toString() ? `?${qp.toString()}` : "";
  const endpoint = getReviewsEndpoint(marketplace);
  const raw = document.getElementById("wbReviewsRaw");
  reviewLoadProgress = { active: true, total: 0, loaded: 0 };
  updateReviewLoadStatus(tr("Запрос отзывов к API...", "Requesting reviews from API..."));
  setTableMessage("wbReviewsTable", 7, tr("Загружаем отзывы...", "Loading reviews..."));
  if (raw) raw.textContent = tr("Загрузка отзывов...", "Loading reviews...");

  const applyReviewsPayload = async (payload) => {
    const incoming = [];
    (Array.isArray(payload?.new) ? payload.new : []).forEach((row, idx) => {
      const normalized = normalizeFeedbackRow(row, "new", idx, marketplace);
      if (normalized) incoming.push(normalized);
    });
    (Array.isArray(payload?.answered) ? payload.answered : []).forEach((row, idx) => {
      const normalized = normalizeFeedbackRow(row, "answered", idx, marketplace);
      if (normalized) incoming.push(normalized);
    });
    wbReviewRows = dedupeFeedbackRows(incoming);
    for (const row of wbReviewRows) {
      if (!row?.id) continue;
      const key = reviewDraftKey(marketplace, row.id);
      const serverAnswer = String(row.answer || "").trim();
      if (!wbReviewDrafts.has(key)) {
        wbReviewDrafts.set(key, serverAnswer);
        continue;
      }
      const currentDraft = String(wbReviewDrafts.get(key) || "").trim();
      if ((!currentDraft && serverAnswer) || (normalizeReviewStatus(row) === "answered" && serverAnswer)) {
        wbReviewDrafts.set(key, serverAnswer);
      }
    }
    await renderWbReviews();
    if (raw) raw.textContent = JSON.stringify(payload, null, 2);
    const warnings = Array.isArray(payload?.warnings) ? payload.warnings.filter(Boolean) : [];
    if (warnings.length) updateReviewLoadStatus(warnings.join(" | "));
    markModuleLoaded("reviews");
  };

  const requestFullReload = () => {
    requestJson(`${endpoint}${fullSuffix}`, { headers: authHeaders(), timeoutMs: 240000 })
      .then(async (fullData) => {
        if (runToken !== reviewLoadToken) return;
        await applyReviewsPayload(fullData);
      })
      .catch((e) => {
        if (runToken !== reviewLoadToken) return;
        reviewLoadProgress.active = false;
        const msg = String(e?.message || "").trim();
        if (isMarketplaceRateLimitError(msg)) {
          updateReviewLoadStatus(tr("WB API временно ограничил запросы. Показаны последние доступные данные.", "WB API is rate-limited. Showing the latest available data."));
          return;
        }
        if (isMarketplaceKeyError(msg)) {
          updateReviewLoadStatus(tr("Проверьте API-ключи WB/Ozon в разделе «Профиль».", "Check WB/Ozon API keys in Profile."));
          return;
        }
        updateReviewLoadStatus(tr("Не удалось загрузить полный список отзывов.", "Failed to load full reviews list."));
        if (!wbReviewRows.length) {
          setTableMessage("wbReviewsTable", 7, tr("Не удалось загрузить отзывы.", "Failed to load reviews."));
          if (raw) raw.textContent = tr("Ошибка загрузки отзывов.", "Reviews loading failed.");
        }
      });
  };

  let fastError = null;
  const fastData = await requestJson(`${endpoint}${fastSuffix}`, { headers: authHeaders(), timeoutMs: 45000 }).catch((e) => {
    fastError = e;
    return null;
  });
  if (runToken !== reviewLoadToken) return;

  if (!fastData) {
    const fastMsg = fastError?.message || "";
    updateReviewLoadStatus(
      fastMsg
        ? tr(`Быстрая загрузка не удалась: ${fastMsg}`, `Fast load failed: ${fastMsg}`)
        : tr("Быстрая загрузка не удалась, запускаем расширенный запрос...", "Fast load failed, running extended request...")
    );
    setTableMessage("wbReviewsTable", 7, tr("Быстрый слой недоступен, выполняем расширенный запрос...", "Fast layer unavailable, running extended request..."));
    if (raw && fastMsg) raw.textContent = fastMsg;
    if (isMarketplaceKeyError(fastMsg)) {
      reviewLoadProgress.active = false;
      updateReviewLoadStatus(tr("Проверьте API-ключи WB/Ozon в разделе «Профиль».", "Check WB/Ozon API keys in Profile."));
      return;
    }
    if (isMarketplaceRateLimitError(fastMsg)) {
      reviewLoadProgress.active = false;
      updateReviewLoadStatus(tr("WB API временно ограничил запросы. Повторите позже.", "WB API is temporarily rate-limited. Try again later."));
      setTableMessage("wbReviewsTable", 7, tr("WB API временно ограничил запросы. Ozon-отзывы доступны, WB обновится после снятия лимита.", "WB API is temporarily rate-limited. Ozon reviews are available; WB will refresh after the limit clears."));
      return;
    }
    requestFullReload();
    return;
  }

  await applyReviewsPayload(fastData).catch((e) => {
    reviewLoadProgress = { active: false, total: 0, loaded: 0 };
    updateReviewLoadStatus(tr("Ошибка отрисовки отзывов.", "Failed to render reviews."));
    setTableMessage("wbReviewsTable", 7, tr("Не удалось отобразить отзывы.", "Failed to render reviews."));
    if (raw) raw.textContent = tr("Ошибка отрисовки отзывов.", "Reviews rendering failed.");
  });
  if (runToken !== reviewLoadToken) return;
  if (marketplace === "wb") {
    reviewLoadProgress.active = false;
    updateReviewLoadStatus();
    return;
  }
  reviewLoadProgress.active = true;
  updateReviewLoadStatus(tr("Быстрая загрузка готова, догружаем полный список...", "Fast load complete, fetching full list..."));
  requestFullReload();
}

async function renderWbReviews() {
  const tbody = document.getElementById("wbReviewsTable");
  if (!tbody) return;
  tbody.innerHTML = "";
  const statusFilter = (document.getElementById("reviewStatusFilter")?.value || "all").trim().toLowerCase();
  const starsFilter = (document.getElementById("reviewStarsFilter")?.value || "").trim();
  const dateSort = (document.getElementById("reviewDateSort")?.value || "newest").trim().toLowerCase();
  const { dateFrom, dateTo } = resolveFeedbackDateFilters("reviews", "reviewDateFrom", "reviewDateTo");
  const visibleRows = wbReviewRows.filter((row) => {
    const status = normalizeReviewStatus(row);
    if (statusFilter === "answered" && status !== "answered") return false;
    if ((statusFilter === "new" || statusFilter === "unanswered") && status !== "new") return false;
    if (starsFilter && String(row?.stars ?? "") !== starsFilter) return false;
    if ((dateFrom || dateTo) && !rowMatchesDateRange(row, dateFrom, dateTo)) return false;
    return true;
  });
  visibleRows.sort((a, b) => {
    if (dateSort === "newest" && statusFilter === "all") {
      const pa = feedbackStatusPriority(a, normalizeReviewStatus);
      const pb = feedbackStatusPriority(b, normalizeReviewStatus);
      if (pa !== pb) return pa - pb;
    }
    const ta = parseReviewDate(a);
    const tb = parseReviewDate(b);
    if (dateSort === "oldest") {
      if (ta !== tb) return ta - tb;
      return String(a?.id || "").localeCompare(String(b?.id || ""));
    }
    if (tb !== ta) return tb - ta;
    return String(b?.id || "").localeCompare(String(a?.id || ""));
  });

  if (!visibleRows.length) {
    const rowEl = document.createElement("tr");
    rowEl.innerHTML = `<td colspan="7">${
      wbReviewRows.length
        ? (currentLang === "en" ? "No reviews for current filters." : "По текущим фильтрам отзывы не найдены.")
        : (currentLang === "en" ? "No reviews found." : "Отзывы не найдены.")
    }</td>`;
    tbody.appendChild(rowEl);
    reviewLoadProgress = { active: false, total: wbReviewRows.length, loaded: wbReviewRows.length };
    updateReviewLoadStatus();
    return;
  }

  const appendRow = (row) => {
    const status = normalizeReviewStatus(row);
    const rowEl = document.createElement("tr");
    const reviewId = String(row?.id || "").trim();
    const reviewHasText = Boolean(String(row?.text || "").trim());
    const reviewHasMedia = Array.isArray(row?.photos) && row.photos.some((x) => typeof x === "string" && x.trim());
    const reviewHasContent = reviewHasText || reviewHasMedia;
    const tdWrap = document.createElement("td");
    tdWrap.colSpan = 7;
    tdWrap.className = "feedback-card-cell";
    const card = document.createElement("article");
    card.className = "feedback-row-card";

    const head = document.createElement("div");
    head.className = "feedback-row-head";
    const meta = document.createElement("div");
    meta.className = "feedback-meta-row";
    const reviewMp = (currentReviewMarketplace || "wb").trim().toLowerCase() === "ozon" ? "ozon" : "wb";
    const canReply = row?.can_reply !== false && !(reviewMp === "ozon" && !reviewHasContent);
    const replyBlockReason = String(row?.reply_block_reason || "").trim()
      || tr("Ozon не разрешает отвечать на отзывы без текста, фото и видео (только оценка).", "Ozon does not allow replies to empty rating-only reviews.");
    const pill = document.createElement("span");
    pill.className = "review-type-pill";
    pill.textContent = status === "new" ? "??" : "?";
    pill.dataset.tip = status === "new" ? tr("Новый отзыв", "New review") : tr("Отвеченный отзыв", "Answered review");
    pill.textContent = status === "new" ? "NEW" : "\u2713";
    pill.dataset.tip = status === "new" ? tr("Новый отзыв", "New review") : tr("Отвеченный отзыв", "Answered review");
    pill.textContent = status === "new" ? "NEW" : "\u2713";
    pill.dataset.tip = status === "new" ? tr("Новый вопрос", "New question") : tr("Отвеченный вопрос", "Answered question");
    pill.textContent = status === "new" ? "NEW" : "\u2713";
    pill.dataset.tip = status === "new" ? tr("Новый отзыв", "New review") : tr("Отвеченный отзыв", "Answered review");
    meta.appendChild(pill);
    const dateBadge = document.createElement("span");
    dateBadge.className = "feedback-meta-badge";
    dateBadge.classList.add(`feedback-date-${reviewMp}`);
    dateBadge.textContent = row?.date || "-";
    meta.appendChild(dateBadge);
    const stars = Number(row.stars || 0);
    if (stars > 0) {
      const starBadge = document.createElement("span");
      starBadge.className = "feedback-meta-badge";
      const ratingVal = Math.max(1, Math.min(5, Number(stars || 0)));
      starBadge.classList.add(`feedback-rating-${ratingVal}`);
      starBadge.textContent = `? ${stars}`;
      starBadge.dataset.tip = tr("Оценка покупателя", "Customer rating");
      starBadge.textContent = `\u2605 ${stars}`;
      starBadge.dataset.tip = tr("Оценка покупателя", "Customer rating");
      meta.appendChild(starBadge);
    }
    const mpBadge = document.createElement("span");
    mpBadge.className = "feedback-meta-badge";
    mpBadge.classList.add(`feedback-market-${reviewMp}`);
    mpBadge.textContent = reviewMp.toUpperCase();
    meta.appendChild(mpBadge);
    head.appendChild(meta);
    if (row?.user) {
      const author = document.createElement("div");
      author.className = "cell-meta-small";
      author.textContent = `${currentLang === "en" ? "Author" : "Автор"}: ${row.user}`;
      if (currentLang !== "en") author.textContent = `\u0410\u0432\u0442\u043e\u0440: ${row.user}`;
      head.appendChild(author);
    }
    card.appendChild(head);

    const productBlock = document.createElement("div");
    productBlock.className = "feedback-product-line";
    renderFeedbackProductCell(productBlock, row);
    card.appendChild(productBlock);

    const textBlock = document.createElement("div");
    textBlock.className = "feedback-text-line";
    const textTitle = document.createElement("span");
    textTitle.className = "cell-meta-small";
    textTitle.textContent = tr("Отзыв", "Review");
    textBlock.appendChild(textTitle);
    const body = document.createElement("div");
    body.className = "cell-main-text";
    body.classList.add("feedback-customer-text");
    body.textContent = row?.text || (reviewMp === "ozon"
      ? (reviewHasMedia ? tr("Отзыв с фото без текста", "Photo review without text") : tr("Отзыв без текста, фото и видео (только оценка)", "Empty rating-only review"))
      : "-");
    textBlock.appendChild(body);
    card.appendChild(textBlock);
    appendFeedbackCabinetLink(card, row, reviewMp);

    const photos = Array.isArray(row?.photos) ? row.photos.filter((x) => typeof x === "string" && x.trim()) : [];
    if (photos.length) {
      const previewWrap = document.createElement("div");
      previewWrap.className = "review-photo-list";
      for (let i = 0; i < Math.min(photos.length, 3); i += 1) {
        const thumb = document.createElement("img");
        thumb.src = photos[i];
        thumb.alt = `review-photo-${i + 1}`;
        thumb.className = "review-photo-thumb";
        thumb.onclick = () => openReviewPhotoViewer(photos, i);
        previewWrap.appendChild(thumb);
      }
      const btnAll = document.createElement("button");
      btnAll.type = "button";
      btnAll.className = "btn-secondary";
      btnAll.textContent = photos.length > 3
        ? (currentLang === "en" ? `All photos (${photos.length})` : `Все фото (${photos.length})`)
        : (currentLang === "en" ? "Open photos" : "Открыть фото");
      btnAll.onclick = () => openReviewPhotoViewer(photos, 0);
      previewWrap.appendChild(btnAll);
      card.appendChild(previewWrap);
    }

    const replyBlock = document.createElement("div");
    replyBlock.className = "feedback-reply-line";
    const replyTitle = document.createElement("span");
    replyTitle.className = "cell-meta-small";
    replyTitle.textContent = tr("Ответ", "Reply");
    replyBlock.appendChild(replyTitle);
    const replyInput = document.createElement("textarea");
    replyInput.rows = 3;
    replyInput.className = "review-reply-input";
    replyInput.dataset.itemId = reviewId;
    replyInput.placeholder = currentLang === "en" ? "Reply text to customer" : "Текст ответа клиенту";
    if (currentLang !== "en") replyInput.placeholder = "\u0422\u0435\u043a\u0441\u0442 \u043e\u0442\u0432\u0435\u0442\u0430 \u043a\u043b\u0438\u0435\u043d\u0442\u0443";
    if (!canReply) {
      replyInput.disabled = true;
      replyInput.placeholder = replyBlockReason;
    }
    const draftKey = reviewDraftKey(currentReviewMarketplace, reviewId);
    replyInput.value = wbReviewDrafts.get(draftKey) ?? row?.answer ?? "";
    replyInput.oninput = () => wbReviewDrafts.set(draftKey, replyInput.value);
    replyBlock.appendChild(replyInput);
    card.appendChild(replyBlock);

    const wrap = document.createElement("div");
    wrap.className = "review-actions feedback-actions-row";
    const btnGenerate = makeIconActionButton({
      icon: "&#9889;",
      tip: tr("????????????? ?????", "Generate reply"),
      onClick: () => generateReviewReply(reviewId),
      secondary: true,
    });
    btnGenerate.dataset.tip = tr("\u0421\u0433\u0435\u043d\u0435\u0440\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u043e\u0442\u0432\u0435\u0442", "Generate reply");
    const btnSend = makeIconActionButton({
      icon: status === "answered" ? "&#9998;" : "&#10148;",
      tip: status === "answered" ? tr("Обновить ответ", "Update reply") : tr("Отправить ответ", "Send reply"),
      onClick: () => sendReviewReply(reviewId),
    });
    if (!reviewId) {
      btnGenerate.disabled = true;
      btnSend.disabled = true;
      btnGenerate.dataset.tip = tr("У записи нет ID", "Record has no ID");
      btnSend.dataset.tip = tr("У записи нет ID", "Record has no ID");
    } else if (!canReply) {
      btnGenerate.disabled = true;
      btnSend.disabled = true;
      btnGenerate.dataset.tip = replyBlockReason;
      btnSend.dataset.tip = replyBlockReason;
    }
    wrap.append(btnGenerate, btnSend);
    card.appendChild(wrap);
    tdWrap.appendChild(card);
    rowEl.appendChild(tdWrap);
    tbody.appendChild(rowEl);
  };

  const total = Math.max(visibleRows.length, wbReviewRows.length);
  const hiddenByFilter = Math.max(0, total - visibleRows.length);
  reviewLoadProgress = { active: true, total, loaded: hiddenByFilter };
  updateReviewLoadStatus();
  const chunkSize = 18;
  for (let i = 0; i < visibleRows.length; i += chunkSize) {
    const chunk = visibleRows.slice(i, i + chunkSize);
    try {
      for (const row of chunk) appendRow(row);
    } catch (e) {
      reviewLoadProgress.active = false;
      updateReviewLoadStatus(tr("Ошибка отображения строки отзыва.", "Review row rendering error."));
      setTableMessage("wbReviewsTable", 7, tr("Не удалось отобразить часть отзывов.", "Failed to render part of reviews."));
      if (e?.message) console.error(e);
      return;
    }
    reviewLoadProgress.loaded = Math.min(total, hiddenByFilter + i + chunk.length);
    updateReviewLoadStatus();
    if (i + chunk.length < visibleRows.length) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  }
  reviewLoadProgress.active = false;
  updateReviewLoadStatus();
}

function feedbackRateLimitMessage(action = "send") {
  if (action === "send") {
    return "WB \u0432\u0440\u0435\u043c\u0435\u043d\u043d\u043e \u043e\u0433\u0440\u0430\u043d\u0438\u0447\u0438\u043b \u043e\u0442\u043f\u0440\u0430\u0432\u043a\u0443 \u043e\u0442\u0432\u0435\u0442\u043e\u0432 (429). \u0427\u0435\u0440\u043d\u043e\u0432\u0438\u043a \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d. \u041f\u043e\u0434\u043e\u0436\u0434\u0438\u0442\u0435 \u043d\u0435\u0441\u043a\u043e\u043b\u044c\u043a\u043e \u043c\u0438\u043d\u0443\u0442 \u0438 \u043d\u0430\u0436\u043c\u0438\u0442\u0435 \u00ab\u041e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c\u00bb \u0441\u043d\u043e\u0432\u0430.";
  }
  return "WB \u0432\u0440\u0435\u043c\u0435\u043d\u043d\u043e \u043e\u0433\u0440\u0430\u043d\u0438\u0447\u0438\u043b \u0437\u0430\u043f\u0440\u043e\u0441\u044b (429). \u041f\u043e\u0434\u043e\u0436\u0434\u0438\u0442\u0435 \u043d\u0435\u0441\u043a\u043e\u043b\u044c\u043a\u043e \u043c\u0438\u043d\u0443\u0442 \u0438 \u043f\u043e\u0432\u0442\u043e\u0440\u0438\u0442\u0435.";
}

async function generateReviewReply(reviewId) {
  const reviewIdText = String(reviewId || "").trim();
  if (!reviewIdText) return;
  if (feedbackInFlight.reviewGenerate.has(reviewIdText)) return;
  const row = wbReviewRows.find((x) => String(x?.id || "") === reviewIdText);
  if (!row) return alert(tr("Отзыв не найден", "Review not found"));
  const rowHasMedia = Array.isArray(row?.photos) && row.photos.some((x) => typeof x === "string" && x.trim());
  if (currentReviewMarketplace === "ozon" && (row?.can_reply === false || (!String(row?.text || "").trim() && !rowHasMedia))) {
    return alert(String(row?.reply_block_reason || "").trim() || tr("Ozon не разрешает отвечать на отзывы без текста, фото и видео (только оценка).", "Ozon does not allow replies to empty rating-only reviews."));
  }
  const endpoint = `${getReviewsEndpoint(currentReviewMarketplace)}/generate-reply`;
  const mpLabel = currentReviewMarketplace === "ozon" ? "Ozon" : "WB";
  feedbackInFlight.reviewGenerate.add(reviewIdText);
  try {
    const data = await withBusy(
      tr("Генерируем ответ…", "Generating reply..."),
      () => requestJson(endpoint, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          review_text: row.text || "",
          product_name: row.product || "",
          reviewer_name: row.user || "",
          stars: Number.isFinite(Number(row.stars)) ? Number(row.stars) : null,
        }),
        timeoutMs: 120000,
        retryOnPost: true,
        maxRetries: 3,
        retryBaseDelayMs: 420,
      }),
      tr(`Генерация зависит от AI-конфигурации сервиса (${mpLabel}).`, `Generation depends on AI settings (${mpLabel}).`)
    ).catch((e) => {
      const message = typeof decodePossiblyMojibake === "function"
        ? String(decodePossiblyMojibake(e.message || "") || e.message || "")
        : String(e.message || "");
      const isRateLimit = Number(e.status || 0) === 429 || message.includes("429") || message.toLowerCase().includes("too many requests");
      const friendly = isRateLimit ? feedbackRateLimitMessage("request") : message;
      updateReviewLoadStatus(friendly);
      alert(friendly);
      return null;
    });
    if (!data) return;
    const replyText = String(data.reply || "");
    wbReviewDrafts.set(reviewDraftKey(currentReviewMarketplace, reviewIdText), replyText);
    applyDraftToVisibleInputs("#wbReviewsTable .review-reply-input", reviewIdText, replyText);
    updateReviewLoadStatus(tr("Черновик ответа обновлен.", "Draft updated."));
  } finally {
    feedbackInFlight.reviewGenerate.delete(reviewIdText);
  }
}

async function sendReviewReply(reviewId) {
  const reviewIdText = String(reviewId || "").trim();
  if (!reviewIdText) return;
  if (feedbackInFlight.reviewSend.has(reviewIdText)) return;
  const row = wbReviewRows.find((x) => String(x?.id || "") === reviewIdText);
  const rowHasMedia = row && Array.isArray(row?.photos) && row.photos.some((x) => typeof x === "string" && x.trim());
  if (currentReviewMarketplace === "ozon" && row && (row?.can_reply === false || (!String(row?.text || "").trim() && !rowHasMedia))) {
    return alert(String(row?.reply_block_reason || "").trim() || tr("Ozon не разрешает отвечать на отзывы без текста, фото и видео (только оценка).", "Ozon does not allow replies to empty rating-only reviews."));
  }
  const key = reviewDraftKey(currentReviewMarketplace, reviewIdText);
  const text = (wbReviewDrafts.get(key) || "").trim();
  if (!text) return alert(tr("Введите или сгенерируйте текст ответа", "Enter or generate reply text"));
  const endpoint = `${getReviewsEndpoint(currentReviewMarketplace)}/reply`;
  const mpLabel = currentReviewMarketplace === "ozon" ? "Ozon" : "WB";
  feedbackInFlight.reviewSend.add(reviewIdText);
  try {
    const data = await withBusy(
      tr(`Отправляем ответ в ${mpLabel}…`, `Sending reply to ${mpLabel}...`),
      () => requestJson(endpoint, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ id: reviewIdText, text }),
        timeoutMs: 120000,
        retryOnPost: false,
        maxRetries: 0,
        retryBaseDelayMs: 420,
      }),
      tr("Ответ отправляется в карточку отзыва через API маркетплейса.", "Reply is sent to marketplace review card via API.")
    ).catch((e) => {
      const message = typeof decodePossiblyMojibake === "function"
        ? String(decodePossiblyMojibake(e.message || "") || e.message || "")
        : String(e.message || "");
      const isRateLimit = Number(e.status || 0) === 429 || message.includes("429") || message.toLowerCase().includes("too many requests");
      const friendly = isRateLimit ? feedbackRateLimitMessage("send") : message;
      updateReviewLoadStatus(friendly);
      alert(friendly);
      return null;
    });
    if (!data) return;
    if (data.queued || data.ok === false) {
      const queuedMessage = typeof decodePossiblyMojibake === "function"
        ? String(decodePossiblyMojibake(data.message || "") || data.message || feedbackRateLimitMessage("send"))
        : String(data.message || feedbackRateLimitMessage("send"));
      wbReviewDrafts.set(key, text);
      applyDraftToVisibleInputs("#wbReviewsTable .review-reply-input", reviewIdText, text);
      updateReviewLoadStatus(queuedMessage);
      alert(queuedMessage);
      return;
    }
    const sentRow = wbReviewRows.find((x) => String(x?.id || "") === reviewIdText);
    if (sentRow) {
      sentRow.answer = text;
      sentRow.is_answered = true;
      sentRow._type = "answered";
    }
    wbReviewDrafts.set(key, text);
    applyDraftToVisibleInputs("#wbReviewsTable .review-reply-input", reviewIdText, text);
    updateReviewLoadStatus(tr("Ответ отправлен.", "Reply sent."));
    renderWbReviews();
    scheduleBackgroundReviewsReload(1800);
  } finally {
    feedbackInFlight.reviewSend.delete(reviewIdText);
  }
}

async function loadQuestionsWorkspace() {
  if (!(await ensureModuleAccess("wb_questions_ai"))) return;
  normalizeFeedbackDateDefaults("questions", "questionDateFrom", "questionDateTo");
  await loadQuestionAiSettings();
  await loadAiDocs();
  await loadWbQuestions();
}

function normalizeFeedbackDateDefaults(scope, fromId, toId) {
  const marker = `seo_wibe_${scope}_date_autofix_v3`;
  if (sessionStorage.getItem(marker) === "1") return;
  sessionStorage.setItem(marker, "1");
  const fromEl = document.getElementById(fromId);
  const toEl = document.getElementById(toId);
  if (!fromEl || !toEl) return;
  fromEl.dataset.userSet = "0";
  toEl.dataset.userSet = "0";
  const fromVal = String(fromEl.value || "").trim();
  const toVal = String(toEl.value || "").trim();
  if (!fromVal || !toVal) return;
  const today = toYmd(new Date());
  if (fromVal === today && toVal === today) {
    fromEl.value = "";
    toEl.value = "";
    fromEl.dataset.userSet = "0";
    toEl.dataset.userSet = "0";
  }
}

function resolveFeedbackDateFilters(scope, fromId, toId) {
  const fromEl = document.getElementById(fromId);
  const toEl = document.getElementById(toId);
  const fromVal = String(fromEl?.value || "").trim();
  const toVal = String(toEl?.value || "").trim();
  const fromUserSet = String(fromEl?.dataset?.userSet || "0") === "1";
  const toUserSet = String(toEl?.dataset?.userSet || "0") === "1";
  // Do not apply stale browser-restored date values until user explicitly changes date fields.
  if (!fromUserSet && !toUserSet) {
    return { dateFrom: "", dateTo: "" };
  }
  const today = toYmd(new Date());
  if (scope && fromVal && toVal && fromVal === today && toVal === today && !fromUserSet && !toUserSet) {
    return { dateFrom: "", dateTo: "" };
  }
  return { dateFrom: fromVal, dateTo: toVal };
}

function isMarketplaceKeyError(message) {
  const lowered = String(message || "").toLowerCase();
  if (!lowered) return false;
  return (
    lowered.includes("ключ") ||
    lowered.includes("api key") ||
    lowered.includes("apikey") ||
    lowered.includes("token") ||
    lowered.includes("client_id") ||
    lowered.includes("unauthorized") ||
    lowered.includes("forbidden") ||
    lowered.includes("401") ||
    lowered.includes("403")
  );
}

function isMarketplaceRateLimitError(message) {
  const lowered = String(message || "").toLowerCase();
  if (!lowered) return false;
  return lowered.includes("429")
    || lowered.includes("rate limit")
    || lowered.includes("rate-limited")
    || lowered.includes("лимит");
}

function formatReturnsWarnings(warnings = []) {
  const out = [];
  for (const raw of warnings) {
    const text = String(raw || "").trim();
    if (!text) continue;
    const lowered = text.toLowerCase();
    if (lowered.includes("endpoint unavailable") || lowered.includes("returns endpoint")) {
      out.push(tr("API возвратов WB временно недоступен.", "WB returns API is temporarily unavailable."));
      continue;
    }
    if (isMarketplaceKeyError(lowered)) {
      out.push(tr("Проверьте API-ключи возвратов WB/Ozon.", "Check WB/Ozon returns API keys."));
      continue;
    }
    out.push(tr("Возвраты загружены с предупреждениями.", "Returns loaded with warnings."));
  }
  return [...new Set(out)];
}

async function loadQuestionAiSettings() {
  const data = await requestJson("/api/wb/questions/ai-settings", { headers: authHeaders() }).catch(() => null);
  if (!data) return;
  const promptInput = document.getElementById("questionAiPrompt");
  const modeInput = document.getElementById("questionAiMode");
  if (promptInput) promptInput.value = data.prompt || "";
  if (modeInput) modeInput.value = data.reply_mode || "manual";
  renderFeedbackLearning("question", data);
  applyFeedbackPromptVisibility("question");
}

async function saveQuestionAiSettings() {
  if (!enabledModules.has("wb_questions_ai")) return;
  const prompt = document.getElementById("questionAiPrompt")?.value || "";
  const reply_mode = document.getElementById("questionAiMode")?.value || "manual";
  const data = await requestJson("/api/wb/questions/ai-settings", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ prompt, reply_mode }),
  }).catch((e) => {
    alert(e.message);
    return null;
  });
  if (!data) return;
  alert(tr("AI-настройки сохранены", "AI settings saved"));
  renderFeedbackLearning("question", data);
}

async function loadAiDocs() {
  const data = await requestJson("/api/ai/docs", { headers: authHeaders() }).catch(() => []);
  const rows = Array.isArray(data) ? data : [];
  const raw = document.getElementById("aiDocsList");
  if (raw) raw.textContent = JSON.stringify(rows, null, 2);
  const sel = document.getElementById("aiDocDeleteSelect");
  if (sel) {
    sel.innerHTML = rows.length
      ? rows.map((x) => `<option value="${x.id}">#${x.id} ${escapeHtml(x.filename)} (${x.size_chars} ch)</option>`).join("")
      : `<option value="">${tr("Документов нет", "No documents")}</option>`;
  }
}

async function uploadAiDoc() {
  const input = document.getElementById("aiDocUploadInput");
  const file = input?.files?.[0];
  if (!file) return alert(tr("??????? ???????? ????.", "Select a file first."));
  const form = new FormData();
  form.append("file", file);
  const data = await withBusy(
    tr("Загружаем документ в базу знаний…", "Uploading knowledge document..."),
    () => fetch("/api/ai/docs/upload", {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}` },
      body: form,
    }).then(async (r) => {
      const payload = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(payload.detail || payload.message || "Upload error");
      return payload;
    }),
    tr("Текст документа будет использован AI в ответах.", "The text will be used by AI for generated replies.")
  ).catch((e) => {
    alert(e.message);
    return null;
  });
  if (!data) return;
  if (input) input.value = "";
  await loadAiDocs();
  alert(tr("Документ загружен.", "Document uploaded."));
}

async function deleteAiDoc() {
  const id = Number(document.getElementById("aiDocDeleteSelect")?.value || 0);
  if (!id) return alert(tr("Выберите документ.", "Select a document."));
  const data = await requestJson(`/api/ai/docs/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  }).catch((e) => {
    alert(e.message);
    return null;
  });
  if (!data) return;
  await loadAiDocs();
}

function getQuestionsMarketplace() {
  const raw = (document.getElementById("questionMarketplace")?.value || "wb").trim().toLowerCase();
  return raw === "ozon" ? "ozon" : "wb";
}

function getQuestionsEndpoint(marketplace) {
  return marketplace === "ozon" ? "/api/ozon/questions" : "/api/wb/questions";
}

function questionDraftKey(marketplace, questionId) {
  return `${marketplace}:${String(questionId || "")}`;
}

function normalizeQuestionStatus(row) {
  const answered = Boolean(
    row?.is_answered ||
    row?._type === "answered" ||
    String(row?.answer || "").trim()
  );
  return answered ? "answered" : "new";
}

async function loadWbQuestions() {
  if (questionBackgroundReloadTimer) {
    clearTimeout(questionBackgroundReloadTimer);
    questionBackgroundReloadTimer = null;
  }
  if (!(await ensureModuleAccess("wb_questions_ai"))) {
    setTableMessage("wbQuestionsTable", 6, tr("Модуль вопросов отключен администратором.", "Questions module is disabled by admin."));
    updateQuestionLoadStatus(tr("Модуль отключен.", "Module is disabled."));
    return;
  }
  questionLoadToken += 1;
  const runToken = questionLoadToken;
  const marketplace = getQuestionsMarketplace();
  const switchedMarketplace = currentQuestionMarketplace !== marketplace;
  currentQuestionMarketplace = marketplace;
  if (switchedMarketplace) {
    wbQuestionRows = [];
    questionLoadProgress = { active: false, total: 0, loaded: 0 };
    updateQuestionLoadStatus();
    renderWbQuestions();
  }
  const { dateFrom, dateTo } = resolveFeedbackDateFilters("questions", "questionDateFrom", "questionDateTo");
  const qp = new URLSearchParams();
  if (dateFrom) qp.set("date_from", dateFrom);
  if (dateTo) qp.set("date_to", dateTo);
  const fastParams = new URLSearchParams(qp);
  fastParams.set("fast", "1");
  const fastSuffix = fastParams.toString() ? `?${fastParams.toString()}` : "";
  const fullSuffix = qp.toString() ? `?${qp.toString()}` : "";
  const endpoint = getQuestionsEndpoint(marketplace);
  const raw = document.getElementById("wbQuestionsRaw");
  questionLoadProgress = { active: true, total: 0, loaded: 0 };
  updateQuestionLoadStatus(tr("Запрос вопросов к API...", "Requesting questions from API..."));
  setTableMessage("wbQuestionsTable", 6, tr("Загружаем вопросы...", "Loading questions..."));
  if (raw) raw.textContent = tr("Загрузка вопросов...", "Loading questions...");

  const applyQuestionsPayload = async (payload) => {
    const incoming = [];
    (Array.isArray(payload?.new) ? payload.new : []).forEach((row, idx) => {
      const normalized = normalizeFeedbackRow(row, "new", idx, marketplace);
      if (normalized) incoming.push(normalized);
    });
    (Array.isArray(payload?.answered) ? payload.answered : []).forEach((row, idx) => {
      const normalized = normalizeFeedbackRow(row, "answered", idx, marketplace);
      if (normalized) incoming.push(normalized);
    });
    wbQuestionRows = dedupeFeedbackRows(incoming);

    for (const row of wbQuestionRows) {
      if (!row?.id) continue;
      const key = questionDraftKey(marketplace, row.id);
      const serverAnswer = String(row.answer || "").trim();
      if (!wbQuestionDrafts.has(key)) {
        wbQuestionDrafts.set(key, serverAnswer);
        continue;
      }
      const currentDraft = String(wbQuestionDrafts.get(key) || "").trim();
      if ((!currentDraft && serverAnswer) || (normalizeQuestionStatus(row) === "answered" && serverAnswer)) {
        wbQuestionDrafts.set(key, serverAnswer);
      }
    }
    await renderWbQuestions();
    if (raw) raw.textContent = JSON.stringify(payload, null, 2);
    const warnings = Array.isArray(payload?.warnings) ? payload.warnings.filter(Boolean) : [];
    if (warnings.length) updateQuestionLoadStatus(warnings.join(" | "));
    markModuleLoaded("reviews");
  };

  const requestFullReload = () => {
    requestJson(`${endpoint}${fullSuffix}`, { headers: authHeaders(), timeoutMs: 240000 })
      .then(async (fullData) => {
        if (runToken !== questionLoadToken) return;
        await applyQuestionsPayload(fullData);
      })
      .catch((e) => {
        if (runToken !== questionLoadToken) return;
        questionLoadProgress.active = false;
        const msg = String(e?.message || "").trim();
        if (isMarketplaceRateLimitError(msg)) {
          updateQuestionLoadStatus(tr("WB API временно ограничил запросы. Показаны последние доступные данные.", "WB API is rate-limited. Showing the latest available data."));
          return;
        }
        if (isMarketplaceKeyError(msg)) {
          updateQuestionLoadStatus(tr("Проверьте API-ключи WB/Ozon в разделе «Профиль».", "Check WB/Ozon API keys in Profile."));
          return;
        }
        updateQuestionLoadStatus(tr("Не удалось загрузить полный список вопросов.", "Failed to load full questions list."));
        if (!wbQuestionRows.length) {
          setTableMessage("wbQuestionsTable", 6, tr("Не удалось загрузить вопросы.", "Failed to load questions."));
          if (raw) raw.textContent = tr("Ошибка загрузки вопросов.", "Questions loading failed.");
        }
      });
  };

  let fastError = null;
  const fastData = await requestJson(`${endpoint}${fastSuffix}`, { headers: authHeaders(), timeoutMs: 45000 }).catch((e) => {
    fastError = e;
    return null;
  });
  if (runToken !== questionLoadToken) return;
  if (!fastData) {
    const fastMsg = fastError?.message || "";
    updateQuestionLoadStatus(
      fastMsg
        ? tr(`Быстрая загрузка не удалась: ${fastMsg}`, `Fast load failed: ${fastMsg}`)
        : tr("Быстрая загрузка не удалась, запускаем расширенный запрос...", "Fast load failed, running extended request...")
    );
    setTableMessage("wbQuestionsTable", 6, tr("Быстрый слой недоступен, выполняем расширенный запрос...", "Fast layer unavailable, running extended request..."));
    if (raw && fastMsg) raw.textContent = fastMsg;
    if (isMarketplaceKeyError(fastMsg)) {
      questionLoadProgress.active = false;
      updateQuestionLoadStatus(tr("Проверьте API-ключи WB/Ozon в разделе «Профиль».", "Check WB/Ozon API keys in Profile."));
      return;
    }
    if (isMarketplaceRateLimitError(fastMsg)) {
      questionLoadProgress.active = false;
      updateQuestionLoadStatus(tr("WB API временно ограничил запросы. Повторите позже.", "WB API is temporarily rate-limited. Try again later."));
      setTableMessage("wbQuestionsTable", 6, tr("WB API временно ограничил запросы. Ozon-вопросы доступны, WB обновится после снятия лимита.", "WB API is temporarily rate-limited. Ozon questions are available; WB will refresh after the limit clears."));
      return;
    }
    requestFullReload();
    return;
  }

  await applyQuestionsPayload(fastData).catch((e) => {
    questionLoadProgress = { active: false, total: 0, loaded: 0 };
    updateQuestionLoadStatus(tr("Ошибка отрисовки вопросов.", "Failed to render questions."));
    setTableMessage("wbQuestionsTable", 6, tr("Не удалось отобразить вопросы.", "Failed to render questions."));
    if (raw) raw.textContent = tr("Ошибка отрисовки вопросов.", "Questions rendering failed.");
  });
  if (runToken !== questionLoadToken) return;
  questionLoadProgress.active = true;
  updateQuestionLoadStatus(tr("Быстрая загрузка готова, догружаем полный список...", "Fast load complete, fetching full list..."));
  requestFullReload();
}

async function renderWbQuestions() {
  const tbody = document.getElementById("wbQuestionsTable");
  if (!tbody) return;
  tbody.innerHTML = "";
  const statusFilter = (document.getElementById("questionStatusFilter")?.value || "all").trim().toLowerCase();
  const dateSort = (document.getElementById("questionDateSort")?.value || "newest").trim().toLowerCase();
  const { dateFrom, dateTo } = resolveFeedbackDateFilters("questions", "questionDateFrom", "questionDateTo");
  const visibleRows = wbQuestionRows.filter((row) => {
    const status = normalizeQuestionStatus(row);
    if (statusFilter === "answered" && status !== "answered") return false;
    if ((statusFilter === "new" || statusFilter === "unanswered") && status !== "new") return false;
    if ((dateFrom || dateTo) && !rowMatchesDateRange(row, dateFrom, dateTo)) return false;
    return true;
  });
  visibleRows.sort((a, b) => {
    if (dateSort === "newest" && statusFilter === "all") {
      const pa = feedbackStatusPriority(a, normalizeQuestionStatus);
      const pb = feedbackStatusPriority(b, normalizeQuestionStatus);
      if (pa !== pb) return pa - pb;
    }
    const ta = parseReviewDate(a);
    const tb = parseReviewDate(b);
    if (dateSort === "oldest") {
      if (ta !== tb) return ta - tb;
      return String(a?.id || "").localeCompare(String(b?.id || ""));
    }
    if (tb !== ta) return tb - ta;
    return String(b?.id || "").localeCompare(String(a?.id || ""));
  });

  if (!visibleRows.length) {
    const rowEl = document.createElement("tr");
    rowEl.innerHTML = `<td colspan="6">${
      wbQuestionRows.length
        ? (currentLang === "en" ? "No questions for current filters." : "По текущим фильтрам вопросы не найдены.")
        : (currentLang === "en" ? "No questions found." : "Вопросы не найдены.")
    }</td>`;
    tbody.appendChild(rowEl);
    questionLoadProgress = { active: false, total: wbQuestionRows.length, loaded: wbQuestionRows.length };
    updateQuestionLoadStatus();
    return;
  }

  const appendRow = (row) => {
    const status = normalizeQuestionStatus(row);
    const rowEl = document.createElement("tr");
    const questionId = String(row?.id || "").trim();
    const tdWrap = document.createElement("td");
    tdWrap.colSpan = 6;
    tdWrap.className = "feedback-card-cell";
    const card = document.createElement("article");
    card.className = "feedback-row-card";

    const head = document.createElement("div");
    head.className = "feedback-row-head";
    const meta = document.createElement("div");
    meta.className = "feedback-meta-row";
    const questionMp = (currentQuestionMarketplace || "wb").trim().toLowerCase() === "ozon" ? "ozon" : "wb";
    const pill = document.createElement("span");
    pill.className = "review-type-pill";
    pill.textContent = status === "new" ? "??" : "?";
    pill.dataset.tip = status === "new" ? tr("Новый вопрос", "New question") : tr("Отвеченный вопрос", "Answered question");
    pill.textContent = status === "new" ? "NEW" : "\u2713";
    pill.dataset.tip = status === "new" ? tr("Новый вопрос", "New question") : tr("Отвеченный вопрос", "Answered question");
    meta.appendChild(pill);
    const dateBadge = document.createElement("span");
    dateBadge.className = "feedback-meta-badge";
    dateBadge.classList.add(`feedback-date-${questionMp}`);
    dateBadge.textContent = row?.date || "-";
    meta.appendChild(dateBadge);
    const mpBadge = document.createElement("span");
    mpBadge.className = "feedback-meta-badge";
    mpBadge.classList.add(`feedback-market-${questionMp}`);
    mpBadge.textContent = questionMp.toUpperCase();
    meta.appendChild(mpBadge);
    const stateLabel = String(row?.state || "").trim();
    if (stateLabel) {
      const stateBadge = document.createElement("span");
      stateBadge.className = "feedback-meta-badge";
      stateBadge.textContent = stateLabel;
      stateBadge.dataset.tip = tr("??????/????????? ?????? API", "API record state/status");
      meta.appendChild(stateBadge);
    }
    head.appendChild(meta);
    if (row?.user) {
      const author = document.createElement("div");
      author.className = "cell-meta-small";
      author.textContent = `${currentLang === "en" ? "Author" : "Автор"}: ${row.user}`;
      head.appendChild(author);
    }
    card.appendChild(head);

    const productBlock = document.createElement("div");
    productBlock.className = "feedback-product-line";
    renderFeedbackProductCell(productBlock, row);
    card.appendChild(productBlock);

    const textBlock = document.createElement("div");
    textBlock.className = "feedback-text-line";
    const textTitle = document.createElement("span");
    textTitle.className = "cell-meta-small";
    textTitle.textContent = tr("Вопрос", "Question");
    textBlock.appendChild(textTitle);
    const body = document.createElement("div");
    body.className = "cell-main-text";
    body.classList.add("feedback-customer-text");
    body.textContent = row?.text || "-";
    textBlock.appendChild(body);
    card.appendChild(textBlock);

    const photos = Array.isArray(row?.photos) ? row.photos.filter((x) => typeof x === "string" && x.trim()) : [];
    if (photos.length) {
      const previewWrap = document.createElement("div");
      previewWrap.className = "review-photo-list";
      for (let i = 0; i < Math.min(photos.length, 3); i += 1) {
        const thumb = document.createElement("img");
        thumb.src = photos[i];
        thumb.alt = `question-photo-${i + 1}`;
        thumb.className = "review-photo-thumb";
        thumb.onclick = () => openReviewPhotoViewer(photos, i);
        previewWrap.appendChild(thumb);
      }
      const btnAll = document.createElement("button");
      btnAll.type = "button";
      btnAll.className = "btn-secondary";
      btnAll.textContent = photos.length > 3
        ? (currentLang === "en" ? `All photos (${photos.length})` : `Все фото (${photos.length})`)
        : (currentLang === "en" ? "Open photos" : "Открыть фото");
      btnAll.onclick = () => openReviewPhotoViewer(photos, 0);
      previewWrap.appendChild(btnAll);
      card.appendChild(previewWrap);
    }

    const replyBlock = document.createElement("div");
    replyBlock.className = "feedback-reply-line";
    const replyTitle = document.createElement("span");
    replyTitle.className = "cell-meta-small";
    replyTitle.textContent = tr("Ответ", "Reply");
    replyBlock.appendChild(replyTitle);
    const replyInput = document.createElement("textarea");
    replyInput.rows = 3;
    replyInput.className = "review-reply-input";
    replyInput.dataset.itemId = questionId;
    replyInput.placeholder = currentLang === "en" ? "Reply text to customer" : "Текст ответа клиенту";
    const draftKey = questionDraftKey(currentQuestionMarketplace, questionId);
    replyInput.value = wbQuestionDrafts.get(draftKey) ?? row?.answer ?? "";
    replyInput.oninput = () => wbQuestionDrafts.set(draftKey, replyInput.value);
    replyBlock.appendChild(replyInput);
    card.appendChild(replyBlock);

    const wrap = document.createElement("div");
    wrap.className = "review-actions feedback-actions-row";
    const btnGenerate = makeIconActionButton({
      icon: "&#9889;",
      tip: tr("????????????? ?????", "Generate reply"),
      onClick: () => generateQuestionReply(questionId),
      secondary: true,
    });
    const btnSend = makeIconActionButton({
      icon: status === "answered" ? "&#9998;" : "&#10148;",
      tip: status === "answered" ? tr("Обновить ответ", "Update reply") : tr("Отправить ответ", "Send reply"),
      onClick: () => sendQuestionReply(questionId),
    });
    if (!questionId) {
      btnGenerate.disabled = true;
      btnSend.disabled = true;
      btnGenerate.dataset.tip = tr("У записи нет ID", "Record has no ID");
      btnSend.dataset.tip = tr("У записи нет ID", "Record has no ID");
    }
    wrap.append(btnGenerate, btnSend);
    card.appendChild(wrap);
    tdWrap.appendChild(card);
    rowEl.appendChild(tdWrap);
    tbody.appendChild(rowEl);
  };

  const total = Math.max(visibleRows.length, wbQuestionRows.length);
  const hiddenByFilter = Math.max(0, total - visibleRows.length);
  questionLoadProgress = { active: true, total, loaded: hiddenByFilter };
  updateQuestionLoadStatus();
  const chunkSize = 18;
  for (let i = 0; i < visibleRows.length; i += chunkSize) {
    const chunk = visibleRows.slice(i, i + chunkSize);
    try {
      for (const row of chunk) appendRow(row);
    } catch (e) {
      questionLoadProgress.active = false;
      updateQuestionLoadStatus(tr("Ошибка отображения строки вопроса.", "Question row rendering error."));
      setTableMessage("wbQuestionsTable", 6, tr("Не удалось отобразить часть вопросов.", "Failed to render part of questions."));
      if (e?.message) console.error(e);
      return;
    }
    questionLoadProgress.loaded = Math.min(total, hiddenByFilter + i + chunk.length);
    updateQuestionLoadStatus();
    if (i + chunk.length < visibleRows.length) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  }
  questionLoadProgress.active = false;
  updateQuestionLoadStatus();
}

async function generateQuestionReply(questionId) {
  const questionIdText = String(questionId || "").trim();
  if (!questionIdText) return;
  if (feedbackInFlight.questionGenerate.has(questionIdText)) return;
  const row = wbQuestionRows.find((x) => String(x?.id || "") === questionIdText);
  if (!row) return alert(tr("Вопрос не найден", "Question not found"));
  const endpoint = `${getQuestionsEndpoint(currentQuestionMarketplace)}/generate-reply`;
  const mpLabel = currentQuestionMarketplace === "ozon" ? "Ozon" : "WB";
  feedbackInFlight.questionGenerate.add(questionIdText);
  try {
    const data = await withBusy(
      tr("Генерируем ответ…", "Generating reply..."),
      () => requestJson(endpoint, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          review_text: row.text || "",
          product_name: row.product || "",
          reviewer_name: row.user || "",
          stars: null,
        }),
        timeoutMs: 120000,
        retryOnPost: true,
        maxRetries: 3,
        retryBaseDelayMs: 420,
      }),
      tr(`Генерация зависит от AI-конфигурации сервиса (${mpLabel}).`, `Generation depends on AI settings (${mpLabel}).`)
    ).catch((e) => {
      alert(e.message);
      return null;
    });
    if (!data) return;
    const replyText = String(data.reply || "");
    wbQuestionDrafts.set(questionDraftKey(currentQuestionMarketplace, questionIdText), replyText);
    applyDraftToVisibleInputs("#wbQuestionsTable .review-reply-input", questionIdText, replyText);
    updateQuestionLoadStatus(tr("Черновик ответа обновлен.", "Draft updated."));
  } finally {
    feedbackInFlight.questionGenerate.delete(questionIdText);
  }
}

async function sendQuestionReply(questionId) {
  const questionIdText = String(questionId || "").trim();
  if (!questionIdText) return;
  if (feedbackInFlight.questionSend.has(questionIdText)) return;
  const row = wbQuestionRows.find((x) => String(x?.id || "") === questionIdText);
  if (!row) return alert(tr("Вопрос не найден", "Question not found"));
  const key = questionDraftKey(currentQuestionMarketplace, questionIdText);
  const text = (wbQuestionDrafts.get(key) || "").trim();
  if (!text) return alert(tr("Введите или сгенерируйте текст ответа", "Enter or generate reply text"));
  const payload = { id: questionIdText, text };
  if (currentQuestionMarketplace === "wb") {
    const state = String(row?.state || "").trim();
    if (state) payload.state = state;
  } else if (currentQuestionMarketplace === "ozon") {
    const skuNum = Number(row?.sku || 0);
    if (Number.isFinite(skuNum) && skuNum > 0) {
      payload.sku = Math.trunc(skuNum);
    } else {
      const articleSku = Number(String(row?.article || "").trim());
      if (Number.isFinite(articleSku) && articleSku > 0) {
        payload.sku = Math.trunc(articleSku);
      }
    }
    if (!payload.sku) {
      return alert(tr(
        "Для вопроса Ozon не найден SKU. Обновите вопросы и повторите.",
        "SKU is missing for Ozon question. Reload questions and retry."
      ));
    }
  }
  const endpoint = `${getQuestionsEndpoint(currentQuestionMarketplace)}/reply`;
  const mpLabel = currentQuestionMarketplace === "ozon" ? "Ozon" : "WB";
  feedbackInFlight.questionSend.add(questionIdText);
  try {
    const data = await withBusy(
      tr(`Отправляем ответ в ${mpLabel}…`, `Sending reply to ${mpLabel}...`),
      () => requestJson(endpoint, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
        timeoutMs: 120000,
        retryOnPost: true,
        maxRetries: 3,
        retryBaseDelayMs: 420,
      }),
      tr("Ответ отправляется в карточку вопроса через API маркетплейса.", "Reply is sent to marketplace question card via API.")
    ).catch((e) => {
      alert(e.message);
      return null;
    });
    if (!data) return;
    row.answer = text;
    row.is_answered = true;
    row._type = "answered";
    wbQuestionDrafts.set(key, text);
    applyDraftToVisibleInputs("#wbQuestionsTable .review-reply-input", questionIdText, text);
    updateQuestionLoadStatus(tr("Ответ отправлен.", "Reply sent."));
    renderWbQuestions();
    scheduleBackgroundQuestionsReload(1800);
  } finally {
    feedbackInFlight.questionSend.delete(questionIdText);
  }
}

function getReturnsMarketplace() {
  const raw = String(document.getElementById("returnsMarketplace")?.value || "wb").trim().toLowerCase();
  return raw === "ozon" ? "ozon" : "wb";
}

function normalizeReturnRow(rawRow, marketplace, idx) {
  if (!rawRow || typeof rawRow !== "object") return null;
  const row = { ...rawRow };
  const synthetic = buildFeedbackSyntheticId(rawRow, `${marketplace}-return`);
  const normalizeReturnPhotoUrl = (value) => {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (/^https?:\/\//i.test(raw)) return raw;
    if (raw.startsWith("//")) return `https:${raw}`;
    if (raw.startsWith("/")) return `${window.location.origin}${raw}`;
    if (/^(static|uploads)\//i.test(raw)) return `${window.location.origin}/${raw.replace(/^\/+/, "")}`;
    return "";
  };
  const pickText = (...paths) => {
    for (const path of paths) {
      const text = normalizeFeedbackText(getValueByPath(rawRow, path));
      if (!text) continue;
      const low = String(text).trim().toLowerCase();
      if (!low || low === "-" || low === "?" || low === "null" || low === "undefined") continue;
      return String(text).trim();
    }
    return "";
  };
  const joinLines = (...values) => {
    const seen = new Set();
    return values
      .map((value) => String(value || "").trim())
      .filter((value) => {
        if (!value) return false;
        const key = value.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .join("\n");
  };
  const rid = pickText(
    "id",
    "claim_id",
    "claimId",
    "return_id",
    "returnId",
    "claim.id",
    "return.id",
    "posting_number",
    "posting.number",
    "raw.id",
    "raw.claim_id",
    "raw.claimId",
    "raw.return_id",
    "raw.returnId",
    "raw.claim.id",
    "raw.return.id",
    "raw.posting_number",
    "raw.posting.number"
  ) || String(synthetic || `${marketplace}-return-${idx + 1}`).trim();
  row.id = rid;
  row._marketplace = marketplace;
  row.status = pickText(
    "status",
    "state",
    "status_ex",
    "claim_status",
    "claimState",
    "claim.status",
    "return.status",
    "return.state",
    "status.name",
    "state.name",
    "raw.status",
    "raw.state",
    "raw.status_ex",
    "raw.claim.status",
    "raw.return.status",
    "raw.status.name",
    "raw.state.name"
  );
  row.status_code = pickText(
    "status_id",
    "statusId",
    "status.code",
    "state.code",
    "claim.status_id",
    "return.status_id",
    "raw.status_id",
    "raw.statusId",
    "raw.status.code",
    "raw.state.code"
  );
  row.status_note = pickText(
    "status_ex",
    "statusEx",
    "status_detail",
    "statusDetail",
    "decision_comment",
    "rejectReason",
    "reject_reason",
    "raw.status_ex",
    "raw.statusEx",
    "raw.status_detail",
    "raw.statusDetail",
    "raw.decision_comment",
    "raw.rejectReason",
    "raw.reject_reason"
  );
  row.date = pickText(
    "date",
    "created_at",
    "createdAt",
    "created_date",
    "createdDate",
    "dt",
    "order_dt",
    "delivery_dt",
    "updated_at",
    "updatedAt",
    "claim.createdAt",
    "return.createdAt",
    "raw.date",
    "raw.created_at",
    "raw.createdAt",
    "raw.created_date",
    "raw.createdDate",
    "raw.dt",
    "raw.order_dt",
    "raw.delivery_dt",
    "raw.updated_at",
    "raw.updatedAt",
    "raw.claim.createdAt",
    "raw.return.createdAt"
  );
  row.created_at = pickText(
    "created_at",
    "createdAt",
    "created_date",
    "createdDate",
    "date",
    "dt",
    "order_dt",
    "updated_at",
    "updatedAt",
    "raw.created_at",
    "raw.createdAt",
    "raw.created_date",
    "raw.createdDate",
    "raw.date",
    "raw.dt",
    "raw.order_dt",
    "raw.updated_at",
    "raw.updatedAt"
  );
  row.updated_at = pickText(
    "updated_at",
    "updatedAt",
    "dt_update",
    "delivery_dt",
    "raw.updated_at",
    "raw.updatedAt",
    "raw.dt_update",
    "raw.delivery_dt"
  );
  row.product = pickText(
    "product",
    "product_name",
    "productName",
    "name",
    "title",
    "imt_name",
    "imtName",
    "item.name",
    "item.title",
    "claim.item.name",
    "claim.item.title",
    "return.item.name",
    "return.item.title",
    "claim.name",
    "return.name",
    "product.name",
    "product.title",
    "subjectName",
    "raw.product",
    "raw.product_name",
    "raw.productName",
    "raw.name",
    "raw.title",
    "raw.imt_name",
    "raw.imtName",
    "raw.item.name",
    "raw.item.title",
    "raw.claim.item.name",
    "raw.claim.item.title",
    "raw.return.item.name",
    "raw.return.item.title",
    "raw.claim.name",
    "raw.return.name",
    "raw.product.name",
    "raw.product.title",
    "raw.subjectName"
  );
  row.vendor_code = pickText(
    "vendor_code",
    "vendorCode",
    "supplierVendorCode",
    "origin_id_info.vendor_code",
    "item.vendorCode",
    "raw.vendor_code",
    "raw.vendorCode",
    "raw.supplierVendorCode",
    "raw.origin_id_info.vendor_code",
    "raw.item.vendorCode"
  );
  row.nm_id = pickText(
    "nm_id",
    "nmId",
    "imt_id",
    "imtId",
    "item.nm_id",
    "raw.nm_id",
    "raw.nmId",
    "raw.imt_id",
    "raw.imtId",
    "raw.item.nm_id"
  );
  row.article = pickText(
    "article",
    "offer_id",
    "offerId",
    "vendorCode",
    "supplierVendorCode",
    "item.article",
    "item.offerId",
    "claim.item.article",
    "claim.item.offerId",
    "return.item.article",
    "return.item.offerId",
    "item.offer_id",
    "raw.article",
    "raw.offer_id",
    "raw.offerId",
    "raw.vendorCode",
    "raw.supplierVendorCode",
    "raw.item.article",
    "raw.item.offer_id",
    "raw.item.offerId",
    "raw.claim.item.article",
    "raw.claim.item.offer_id",
    "raw.claim.item.offerId",
    "raw.return.item.article",
    "raw.return.item.offer_id",
    "raw.return.item.offerId"
  ) || row.vendor_code || row.nm_id;
  row.barcode = pickText(
    "barcode",
    "item.barcode",
    "claim.item.barcode",
    "return.item.barcode",
    "raw.barcode",
    "raw.item.barcode",
    "raw.claim.item.barcode",
    "raw.return.item.barcode"
  );
  row.quantity = pickText(
    "quantity",
    "count",
    "itemsCount",
    "qty",
    "item.quantity",
    "claim.item.quantity",
    "return.item.quantity",
    "raw.quantity",
    "raw.count",
    "raw.itemsCount",
    "raw.qty",
    "raw.item.quantity",
    "raw.claim.item.quantity",
    "raw.return.item.quantity"
  );
  row.amount = pickText(
    "amount",
    "sum",
    "total",
    "refundAmount",
    "returnAmount",
    "price",
    "claim.amount",
    "return.amount",
    "raw.amount",
    "raw.sum",
    "raw.total",
    "raw.refundAmount",
    "raw.returnAmount",
    "raw.price",
    "raw.claim.amount",
    "raw.return.amount"
  );
  row.customer_comment = pickText(
    "user_comment",
    "customer_comment",
    "comment",
    "reason",
    "raw.user_comment",
    "raw.customer_comment",
    "raw.comment",
    "raw.reason"
  );
  row.seller_comment = pickText(
    "wb_comment",
    "seller_comment",
    "decision_comment",
    "raw.wb_comment",
    "raw.seller_comment",
    "raw.decision_comment"
  );
  const baseDescription = pickText(
    "description",
    "reason",
    "comment",
    "text",
    "rejectReason",
    "reject_reason",
    "decision_comment",
    "claim.description",
    "claim.reason",
    "claim.comment",
    "claim.rejectReason",
    "return.reason",
    "return.description",
    "return.comment",
    "return.rejectReason",
    "raw.description",
    "raw.reason",
    "raw.comment",
    "raw.text",
    "raw.rejectReason",
    "raw.reject_reason",
    "raw.decision_comment",
    "raw.claim.description",
    "raw.claim.reason",
    "raw.claim.comment",
    "raw.claim.rejectReason",
    "raw.return.reason",
    "raw.return.description",
    "raw.return.comment",
    "raw.return.rejectReason"
  );
  row.description = joinLines(baseDescription, row.status_note, row.customer_comment, row.seller_comment);
  row.reason = row.description;
  const rawPhotos = normalizeFeedbackPhotos(
    rawRow.photos
    || rawRow.images
    || rawRow.pictures
    || rawRow.attachments
    || rawRow.files
    || rawRow.evidences
    || rawRow.claim?.photos
    || rawRow.claim?.images
    || rawRow.return?.photos
    || rawRow.return?.images
    || rawRow.raw?.photos
    || rawRow.raw?.images
    || rawRow.raw?.pictures
    || rawRow.raw?.attachments
    || rawRow.raw?.files
    || rawRow.raw?.evidences
    || rawRow.raw?.claim?.photos
    || rawRow.raw?.claim?.images
    || rawRow.raw?.return?.photos
    || rawRow.raw?.return?.images
    || []
  );
  row.photos = [...new Set(rawPhotos.map((url) => normalizeReturnPhotoUrl(url)).filter(Boolean))];
  return row;
}

function refreshReturnsStatusOptions(rows, preserve = "") {
  const select = document.getElementById("returnsStatusFilter");
  if (!select) return;
  const uniq = new Set();
  for (const row of Array.isArray(rows) ? rows : []) {
    const status = String(row?.status || "").trim();
    if (status) uniq.add(status);
  }
  const options = [`<option value="">${tr("Все статусы", "All statuses")}</option>`];
  [...uniq].sort((a, b) => a.localeCompare(b)).forEach((status) => {
    options.push(`<option value="${escapeHtml(status)}">${escapeHtml(status)}</option>`);
  });
  select.innerHTML = options.join("");
  if (preserve && [...select.options].some((x) => String(x.value) === preserve)) {
    select.value = preserve;
  }
}

function returnRowNeedsHydration(row) {
  if (!row || typeof row !== "object") return false;
  const hasProduct = Boolean(String(row.product || "").trim());
  const hasReason = Boolean(String(row.description || row.reason || "").trim());
  const hasPhotos = Array.isArray(row.photos) && row.photos.length > 0;
  return !hasProduct || !hasReason || !hasPhotos;
}

async function hydrateReturnsRowsFromDetails(rows, marketplace) {
  const list = Array.isArray(rows) ? rows : [];
  const pending = list
    .filter((row) => returnRowNeedsHydration(row))
    .slice(0, 18);
  if (!pending.length) return;
  await Promise.all(pending.map(async (row) => {
    const rid = String(row?.id || "").trim();
    if (!rid) return;
    const endpoint = marketplace === "ozon"
      ? `/api/ozon/returns/${encodeURIComponent(rid)}`
      : `/api/wb/returns/${encodeURIComponent(rid)}`;
    const detail = await requestJson(endpoint, { headers: authHeaders(), timeoutMs: 60000 }).catch(() => null);
    if (!detail || typeof detail !== "object") return;
    const normalized = normalizeReturnRow({ ...row, ...detail }, marketplace, 0);
    if (!normalized) return;
    if (!String(row.product || "").trim() && String(normalized.product || "").trim()) row.product = normalized.product;
    if (!String(row.article || "").trim() && String(normalized.article || "").trim()) row.article = normalized.article;
    if (!String(row.description || row.reason || "").trim() && String(normalized.description || normalized.reason || "").trim()) {
      row.description = String(normalized.description || normalized.reason || "");
      row.reason = String(normalized.reason || normalized.description || "");
    }
    if ((!Array.isArray(row.photos) || !row.photos.length) && Array.isArray(normalized.photos) && normalized.photos.length) {
      row.photos = normalized.photos.slice();
    }
    if (!String(row.status || "").trim() && String(normalized.status || "").trim()) row.status = normalized.status;
    if (!String(row.date || row.created_at || "").trim() && String(normalized.date || normalized.created_at || "").trim()) {
      row.date = String(normalized.date || normalized.created_at || "");
      row.created_at = String(normalized.created_at || normalized.date || "");
    }
  }));
}

async function loadReturns() {
  if (!(await ensureModuleAccess("returns"))) {
    setTableMessage("returnsTable", 6, tr("Модуль возвратов отключен администратором.", "Returns module is disabled by admin."));
    const status = document.getElementById("returnsLoadStatus");
    if (status) status.textContent = tr("Модуль отключен.", "Module is disabled.");
    return;
  }
  const marketplace = getReturnsMarketplace();
  currentReturnsMarketplace = marketplace;
  const statusFilter = String(document.getElementById("returnsStatusFilter")?.value || "").trim();
  const dateFrom = String(document.getElementById("returnsDateFrom")?.value || "").trim();
  const dateTo = String(document.getElementById("returnsDateTo")?.value || "").trim();
  const qp = new URLSearchParams();
  if (statusFilter) qp.set("status", statusFilter);
  if (dateFrom) qp.set("date_from", dateFrom);
  if (dateTo) qp.set("date_to", dateTo);
  const suffix = qp.toString() ? `?${qp.toString()}` : "";
  const endpoint = marketplace === "ozon" ? `/api/ozon/returns${suffix}` : `/api/wb/returns${suffix}`;
  const statusEl = document.getElementById("returnsLoadStatus");
  if (statusEl) statusEl.textContent = tr("Загрузка возвратов...", "Loading returns...");
  setTableMessage("returnsTable", 6, tr("Загружаем возвраты...", "Loading returns..."));
  const data = await requestJson(endpoint, { headers: authHeaders(), timeoutMs: 120000 }).catch((e) => {
    const msg = String(e?.message || "").trim();
    if (isMarketplaceKeyError(msg)) {
      if (statusEl) statusEl.textContent = tr("Проверьте API-ключи возвратов WB/Ozon.", "Check WB/Ozon returns API keys.");
      setTableMessage("returnsTable", 6, tr("Не удалось загрузить возвраты. Проверьте ключи.", "Failed to load returns. Check API keys."));
      return null;
    }
    if (statusEl) statusEl.textContent = tr("Ошибка загрузки возвратов.", "Failed to load returns.");
    return null;
  });
  if (!data) return;
  returnsRows = (Array.isArray(data.rows) ? data.rows : [])
    .map((row, idx) => normalizeReturnRow(row, marketplace, idx))
    .filter(Boolean);
  await hydrateReturnsRowsFromDetails(returnsRows, marketplace);
  refreshReturnsStatusOptions(returnsRows, statusFilter);
  renderReturns();
  const warnings = Array.isArray(data.warnings) ? data.warnings.filter(Boolean) : [];
  if (statusEl) {
    if (warnings.length) {
      const cleaned = formatReturnsWarnings(warnings);
      statusEl.textContent = cleaned.length
        ? cleaned.join(" • ")
        : tr("Возвраты загружены с предупреждениями.", "Returns loaded with warnings.");
    } else {
      statusEl.textContent = tr("Возвраты загружены", "Returns loaded");
    }
  }
  markModuleLoaded("reviews");
}

function closeReturnDetailModal(evt = null) {
  const modal = document.getElementById("returnDetailModal");
  if (!modal) return;
  if (evt && evt.target && evt.target !== modal) return;
  modal.classList.add("hidden");
}

function extractReturnDetailContext(detail, returnId = "") {
  const raw = detail && typeof detail === "object" ? detail : {};
  const containers = [
    raw,
    raw.raw,
    raw.claim,
    raw.return,
    raw.item,
    raw.product,
    raw.result,
    raw.data,
    raw.payload,
    raw.response,
  ].filter((item) => item && typeof item === "object");
  const normalizeScalar = (value, options = {}) => {
    const text = String(normalizeProductDetailValue(value) || "").trim();
    const low = text.toLowerCase();
    if (!text || low === "-" || low === "?" || low === "?" || low === "null" || low === "undefined") return "";
    if (!options.allowZero && (low === "0" || low === "0.0")) return "";
    return text;
  };
  const pick = (paths, options = {}) => {
    for (const path of paths) {
      for (const container of containers) {
        const val = normalizeScalar(getValueByPath(container, path), options);
        if (val) return val;
      }
    }
    return "";
  };
  const appendPhotos = (out, src, depth = 0) => {
    if (!src || depth > 4) return;
    if (Array.isArray(src)) {
      src.forEach((item) => appendPhotos(out, item, depth + 1));
      return;
    }
    if (typeof src === "string") {
      const url = String(src || "").trim();
      if (/^https?:\/\//i.test(url) && !out.includes(url)) out.push(url);
      return;
    }
    if (typeof src === "object") {
      const directUrl = normalizeFeedbackText(src.url || src.photo || src.src || src.link || src.href || src.path || "");
      if (/^https?:\/\//i.test(directUrl) && !out.includes(directUrl)) out.push(directUrl);
      Object.keys(src).forEach((key) => {
        if (/photo|image|picture|attachment|file/i.test(String(key || ""))) {
          appendPhotos(out, src[key], depth + 1);
        }
      });
    }
  };

  const id = pick(["id", "claimId", "claim_id", "returnId", "return_id", "claim.id", "return.id", "posting_number"], { allowZero: true })
    || String(returnId || "");
  const marketplace = currentReturnsMarketplace === "ozon" ? "Ozon" : "WB";
  const status = pick(["status", "state", "claimStatus", "claim.status", "return.status", "return.state"], { allowZero: true });
  const statusNote = pick([
    "status_note",
    "statusComment",
    "status_comment",
    "statusDescription",
    "status_description",
    "claim.statusDescription",
    "return.statusDescription",
  ]);
  const createdAt = pick(["created_at", "createdAt", "date", "createdDate", "claim.createdAt", "return.createdAt"], { allowZero: true });
  const updatedAt = pick(["updated_at", "updatedAt", "claim.updatedAt", "return.updatedAt"], { allowZero: true });
  const article = pick([
    "article",
    "supplierVendorCode",
    "supplier_vendor_code",
    "vendorCode",
    "vendor_code",
    "offerId",
    "offer_id",
    "item.article",
    "claim.item.article",
    "return.item.article",
  ]);
  const vendorCode = pick([
    "vendor_code",
    "vendorCode",
    "supplierVendorCode",
    "supplier_vendor_code",
    "item.vendorCode",
    "claim.item.vendorCode",
    "return.item.vendorCode",
  ]);
  const nmId = pick([
    "nm_id",
    "nmId",
    "nmID",
    "sku",
    "item.nmId",
    "claim.item.nmId",
    "return.item.nmId",
  ], { allowZero: true });
  const product = pick([
    "product",
    "productName",
    "name",
    "subjectName",
    "imtName",
    "item.name",
    "claim.item.name",
    "return.item.name",
  ]);
  const quantity = pick(["quantity", "count", "itemsCount", "qty", "item.quantity", "claim.item.quantity", "return.item.quantity"], { allowZero: true });
  const amount = pick(["amount", "sum", "total", "refundAmount", "returnAmount", "price", "claim.amount", "return.amount"], { allowZero: true });
  const reason = pick([
    "reason",
    "rejectReason",
    "reject_reason",
    "claim.reason",
    "return.reason",
  ]);
  const description = pick([
    "description",
    "comment",
    "text",
    "claim.comment",
    "return.comment",
    "claim.description",
    "return.description",
  ]);
  const customerComment = pick([
    "customer_comment",
    "customerComment",
    "buyerComment",
    "buyer_comment",
    "clientComment",
    "client_comment",
  ]);
  const sellerComment = pick([
    "seller_comment",
    "sellerComment",
    "merchantComment",
    "merchant_comment",
  ]);
  const orderId = pick(["order_id", "orderId", "posting_number", "srid"], { allowZero: true });
  const barcode = pick(["barcode", "barcodes.0", "item.barcode"], { allowZero: true });
  const warehouse = pick(["warehouse", "warehouseName", "warehouse_name", "place", "place_name"]);

  const photos = [];
  for (const container of containers) {
    appendPhotos(photos, container.photos);
    appendPhotos(photos, container.images);
    appendPhotos(photos, container.pictures);
    appendPhotos(photos, container.attachments);
    appendPhotos(photos, container.files);
  }

  return {
    id,
    marketplace,
    status,
    statusNote,
    createdAt,
    updatedAt,
    article,
    vendorCode,
    nmId,
    product,
    quantity,
    amount,
    reason,
    description,
    customerComment,
    sellerComment,
    orderId,
    barcode,
    warehouse,
    photos,
    raw,
  };
}

function renderReturnDetailModal(detail, returnId = "") {
  const modal = document.getElementById("returnDetailModal");
  if (!modal) return;
  const titleEl = document.getElementById("returnDetailTitle");
  const summaryEl = document.getElementById("returnDetailSummary");
  const cardsEl = document.getElementById("returnDetailCards");
  const descEl = document.getElementById("returnDetailDescription");
  const photosEl = document.getElementById("returnDetailPhotos");
  const ctx = extractReturnDetailContext(detail, returnId);

  if (titleEl) {
    const rid = ctx.id || String(returnId || "-");
    titleEl.textContent = `${tr("Детали возврата", "Return details")} #${rid}`;
  }
  if (summaryEl) {
    const parts = [
      ctx.marketplace ? `${tr("Маркетплейс", "Marketplace")}: ${ctx.marketplace}` : "",
      ctx.status ? `${tr("??????", "Status")}: ${ctx.status}` : "",
      ctx.createdAt ? `${tr("??????", "Created")}: ${ctx.createdAt}` : "",
      ctx.updatedAt ? `${tr("Обновлен", "Updated")}: ${ctx.updatedAt}` : "",
    ].filter(Boolean);
    summaryEl.textContent = parts.join(" | ") || tr("Карточка возврата загружена.", "Return card loaded.");
  }
  if (cardsEl) {
    cardsEl.innerHTML = renderProductInfoGrid(
      [
        { label: "id", value: ctx.id || "-" },
        { label: tr("Маркетплейс", "Marketplace"), value: ctx.marketplace || "-" },
        { label: tr("??????", "Status"), value: ctx.status || "-" },
        { label: tr("Комментарий к статусу", "Status note"), value: ctx.statusNote || "-" },
        { label: tr("Товар", "Product"), value: ctx.product || "-" },
        { label: tr("Артикул", "Article"), value: ctx.article || "-" },
        { label: tr("Vendor code", "Vendor code"), value: ctx.vendorCode || "-" },
        { label: tr("NM ID", "NM ID"), value: ctx.nmId || "-" },
        { label: tr("Количество", "Quantity"), value: ctx.quantity || "-" },
        { label: tr("?????", "Amount"), value: ctx.amount || "-" },
        { label: tr("Заказ", "Order"), value: ctx.orderId || "-" },
        { label: tr("?????", "Warehouse"), value: ctx.warehouse || "-" },
      ],
      tr("Ключевые поля отсутствуют.", "No key fields.")
    );
  }
  if (descEl) {
    const lines = [];
    const addLine = (label, value) => {
      const safe = String(value || "").trim();
      if (!safe) return;
      lines.push(`<p><b>${escapeHtml(label)}:</b> ${escapeHtml(safe)}</p>`);
    };
    addLine(tr("Причина", "Reason"), ctx.reason);
    if (String(ctx.description || "").trim() && String(ctx.description || "").trim() !== String(ctx.reason || "").trim()) {
      addLine(tr("Описание", "Description"), ctx.description);
    }
    addLine(tr("Комментарий покупателя", "Customer comment"), ctx.customerComment);
    addLine(tr("Комментарий продавца", "Seller comment"), ctx.sellerComment);
    addLine(tr("Штрихкод", "Barcode"), ctx.barcode);
    descEl.innerHTML = lines.length
      ? lines.join("")
      : `<div class="hint">${escapeHtml(tr("Подробное описание пока не пришло от API.", "Detailed description is not available yet."))}</div>`;
  }
  if (photosEl) {
    photosEl.innerHTML = ctx.photos.length
      ? ctx.photos.map((url, idx) => `<img src="${escapeHtml(String(url))}" alt="return-photo-${idx + 1}" loading="lazy" class="product-detail-photo">`).join("")
      : `<div class="hint">${escapeHtml(tr("Фото не прикреплены.", "No photos attached."))}</div>`;
    if (ctx.photos.length) {
      photosEl.querySelectorAll("img.product-detail-photo").forEach((imgEl, idx) => {
        imgEl.classList.add("clickable-photo");
        imgEl.addEventListener("click", () => openReviewPhotoViewer(ctx.photos, idx));
      });
    }
  }
  modal.classList.remove("hidden");
}

async function openReturnDetails(returnId) {
  const rid = String(returnId || "").trim();
  if (!rid) return;
  const endpoint = currentReturnsMarketplace === "ozon"
    ? `/api/ozon/returns/${encodeURIComponent(rid)}`
    : `/api/wb/returns/${encodeURIComponent(rid)}`;
  const data = await requestJson(endpoint, { headers: authHeaders(), timeoutMs: 60000 }).catch((e) => {
    alert(e.message);
    return null;
  });
  const listRow = (returnsRows || []).find((x) => String(x?.id || "").trim() === rid) || null;
  if (!data) {
    if (listRow) renderReturnDetailModal(listRow, rid);
    return;
  }
  const merged = data && typeof data === "object" ? { ...data } : {};
  if (listRow && typeof listRow === "object") {
    if (!normalizeFeedbackText(merged.reason) && normalizeFeedbackText(listRow.reason || listRow.description)) {
      merged.reason = String(listRow.reason || listRow.description || "");
    }
    if (!normalizeFeedbackText(merged.description) && normalizeFeedbackText(listRow.description || listRow.reason)) {
      merged.description = String(listRow.description || listRow.reason || "");
    }
    const detailPhotos = Array.isArray(merged.photos) ? merged.photos : [];
    if (!detailPhotos.length && Array.isArray(listRow.photos) && listRow.photos.length) {
      merged.photos = listRow.photos.slice();
    }
    if (!normalizeFeedbackText(merged.status) && normalizeFeedbackText(listRow.status)) merged.status = String(listRow.status || "");
    if (!normalizeFeedbackText(merged.created_at) && normalizeFeedbackText(listRow.created_at || listRow.date)) {
      merged.created_at = String(listRow.created_at || listRow.date || "");
    }
    if (!normalizeFeedbackText(merged.article) && normalizeFeedbackText(listRow.article)) merged.article = String(listRow.article || "");
    if (!normalizeFeedbackText(merged.product) && normalizeFeedbackText(listRow.product)) merged.product = String(listRow.product || "");
  }
  renderReturnDetailModal(merged, rid);
}

async function actionReturn(returnId, actionCode) {
  const rid = String(returnId || "").trim();
  if (!rid) return;
  if (currentReturnsMarketplace !== "wb") {
    alert(tr("Для Ozon действия по возвратам пока в staged-режиме (только чтение).", "Ozon return actions are staged (read-only)."));
    return;
  }
  const safeAction = String(actionCode || "").trim().toLowerCase();
  if (!safeAction) return;
  const comment = (safeAction === "reject" || safeAction === "comment")
    ? (prompt(tr("Комментарий к действию (опционально):", "Action comment (optional):"), "") || "")
    : "";
  const data = await requestJson("/api/wb/returns/action", {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ id: rid, action: safeAction, comment }),
    timeoutMs: 60000,
  }).catch((e) => {
    alert(e.message);
    return null;
  });
  if (!data) return;
  alert(data.message || tr("Действие выполнено.", "Action completed."));
  await loadReturns();
}

function renderReturns() {
  const tbody = document.getElementById("returnsTable");
  if (!tbody) return;
  tbody.innerHTML = "";
  const statusFilter = String(document.getElementById("returnsStatusFilter")?.value || "").trim();
  const dateFrom = String(document.getElementById("returnsDateFrom")?.value || "").trim();
  const dateTo = String(document.getElementById("returnsDateTo")?.value || "").trim();
  const rows = returnsRows.filter((row) => {
    if (statusFilter && String(row?.status || "") !== statusFilter) return false;
    if ((dateFrom || dateTo) && !rowMatchesDateRange(row, dateFrom, dateTo)) return false;
    return true;
  });
  if (!rows.length) {
    setTableMessage("returnsTable", 6, tr("Заявки на возврат не найдены.", "No returns found."));
    return;
  }
  for (const row of rows) {
    const trEl = document.createElement("tr");
    const rid = String(row.id || "").trim();
    const photos = Array.isArray(row.photos) ? row.photos : [];
    const statusValue = String(row.status || row.status_code || "-").trim() || "-";
    const statusNote = String(row.status_note || "").trim();
    const photosHtml = photos.length
      ? photos.slice(0, 3).map((photo, idx) => (
        `<img src="${escapeHtml(photo)}" alt="return-photo-${idx + 1}" loading="lazy" class="review-photo-thumb clickable-photo" data-return-photo-idx="${idx}" data-return-id="${escapeHtml(rid)}">`
      )).join("")
      : `<span class="hint">-</span>`;
    const productMeta = [row.article, row.vendor_code, row.nm_id].map((value) => String(value || "").trim()).filter(Boolean);
    const descriptionMeta = [row.status_note, row.customer_comment, row.seller_comment].map((value) => String(value || "").trim()).filter(Boolean);
    const dateParts = [row.date || row.created_at || "-", row.updated_at ? `${tr("обновлено", "updated")}: ${row.updated_at}` : ""].filter(Boolean);
    const fallbackMeta = [];
    if (String(row.quantity || "").trim()) fallbackMeta.push(`${tr("Кол-во", "Qty")}: ${row.quantity}`);
    if (String(row.amount || "").trim()) fallbackMeta.push(`${tr("?????", "Amount")}: ${row.amount}`);
    const actionButtons = currentReturnsMarketplace === "wb"
      ? `
        <div class="review-actions">
          <button type="button" class="btn-secondary returns-action-btn" onclick="openReturnDetails('${escapeHtml(rid)}')">${escapeHtml(tr("Открыть карточку", "Open card"))}</button>
          <button type="button" class="btn-secondary returns-action-btn" onclick="actionReturn('${escapeHtml(rid)}', 'approve')">${escapeHtml(tr("Одобрить возврат", "Approve return"))}</button>
          <button type="button" class="btn-danger returns-action-btn" onclick="actionReturn('${escapeHtml(rid)}', 'reject')">${escapeHtml(tr("Отклонить возврат", "Reject return"))}</button>
        </div>
      `
      : `
        <div class="review-actions">
          <button type="button" class="btn-secondary returns-action-btn" onclick="openReturnDetails('${escapeHtml(rid)}')">${escapeHtml(tr("Открыть карточку", "Open card"))}</button>
          <button type="button" class="returns-action-btn" disabled>${escapeHtml(tr("Только просмотр (Ozon)", "Read only (Ozon)"))}</button>
        </div>
      `;
    trEl.innerHTML = `
      <td data-label="${escapeHtml(tr("??????", "Status"))}">
        <span class="review-type-pill return-status-pill">${escapeHtml(statusValue)}</span>
        <div class="cell-meta-small">${escapeHtml(statusNote || "-")}</div>
      </td>
      <td data-label="${escapeHtml(tr("Дата", "Date"))}" class="cell-meta-small">${escapeHtml(dateParts.join(" | "))}</td>
      <td data-label="${escapeHtml(tr("Товар", "Product"))}">
        <div class="cell-product-name">${escapeHtml(String(row.product || "-"))}</div>
        <div class="cell-meta-small">${escapeHtml(productMeta.join(" | ") || "-")}</div>
      </td>
      <td data-label="${escapeHtml(tr("Причина / комментарий", "Reason / comments"))}">
        <div class="cell-main-text">${escapeHtml(String(row.description || row.reason || "-"))}</div>
        <div class="cell-meta-small">${escapeHtml(descriptionMeta.join(" | ") || fallbackMeta.join(" | ") || "-")}</div>
      </td>
      <td data-label="${escapeHtml(tr("Фото", "Photos"))}"><div class="review-photo-list">${photosHtml}</div></td>
      <td data-label="${escapeHtml(tr("Что сделать", "Actions"))}">${actionButtons}</td>
    `;
    tbody.appendChild(trEl);
    if (photos.length) {
      trEl.querySelectorAll("[data-return-photo-idx]").forEach((node) => {
        node.addEventListener("click", () => {
          const idx = Number(node.getAttribute("data-return-photo-idx") || 0);
          openReviewPhotoViewer(photos, Number.isFinite(idx) ? idx : 0);
        });
      });
    }
  }
  applyButtonTooltips();
}

async function loadWbAdCampaigns(options = {}) {
  if (!enabledModules.has("wb_ads")) return;
  const force = Boolean(options && typeof options === "object" && options.force);
  if (!force && wbCampaignRows.length && hasFreshModuleLoad("ads", 45000)) {
    wbAdsLoadProgress = {
      active: false,
      total: wbCampaignRows.length,
      loaded: wbCampaignRows.length,
      failed: 0,
    };
    updateWbAdsLoadStatus(
      tr(
        "Показаны свежие данные из кеша. Для полного обновления нажмите «Загрузить кампании».",
        "Showing fresh cached campaigns. Press \"Load campaigns\" to force refresh."
      )
    );
    renderWbCampaignRows();
    refreshWbBidderCampaignHints();
    return;
  }
  if (wbAdsLoadInflight) return wbAdsLoadInflight;

  const runTask = (async () => {
    wbAdsLoadToken += 1;
    const runToken = wbAdsLoadToken;
    wbAdsLoadProgress = { active: true, total: 0, loaded: 0, failed: 0 };
    updateWbAdsLoadStatus(force
      ? tr("Запускаем обновление кампаний…", "Starting campaign refresh...")
      : tr("Загрузка списка кампаний…", "Loading campaign list...")
    );

    const formatAdsLoadError = (err) => {
      const status = Number(err?.status || 0);
      const msg = String(err?.message || "").trim();
      const low = msg.toLowerCase();
      if (status === 400 && (low.includes("ключ") || low.includes("api key") || low.includes("token"))) {
        return tr(
          "Не удалось загрузить кампании: проверьте API-ключ WB Ads в профиле.",
          "Unable to load campaigns: check WB Ads API key in profile."
        );
      }
      if (status === 403) {
        return tr(
          "Нет доступа к модулю рекламы в этом кабинете.",
          "No access to Ads module in this workspace."
        );
      }
      if (status === 429) {
        return tr(
          "WB Ads временно ограничил запросы. Показаны последние доступные данные.",
          "WB Ads temporarily rate-limited requests. Showing the latest available data."
        );
      }
      return msg || tr(
        "Не удалось обновить кампании сейчас. Повторим при следующем цикле загрузки.",
        "Unable to refresh campaigns now. Will retry on next refresh cycle."
      );
    };

    const requestCampaigns = async (fastMode, timeoutMs = 120000) => {
      try {
        const payload = await requestJson(`/api/wb/ads/campaigns?fast=${fastMode ? 1 : 0}`, {
          headers: authHeaders(),
          timeoutMs,
        });
        return { payload, error: null };
      } catch (error) {
        return { payload: null, error };
      }
    };

    if (force) {
      await requestJson("/api/wb/ads/campaigns/sync", {
        method: "POST",
        headers: authHeaders(),
        timeoutMs: 25000,
      }).catch(() => null);
      updateWbAdsLoadStatus(tr("Берем свежий снимок кампаний…", "Loading the latest campaign snapshot..."));
    }

    const fastResult = await requestCampaigns(true, force ? 45000 : 25000);
    let data = fastResult.payload;
    let lastError = fastResult.error;

    if (!data && !force) {
      await requestJson("/api/wb/ads/campaigns/sync", {
        method: "POST",
        headers: authHeaders(),
        timeoutMs: 25000,
      }).catch(() => null);
      const retryFast = await requestCampaigns(true, 45000);
      data = retryFast.payload;
      if (!data) lastError = retryFast.error || lastError;
    }

    if (!data) {
      wbAdsLoadProgress.active = false;
      updateWbAdsLoadStatus(formatAdsLoadError(lastError));
      return;
    }

    if (!Array.isArray(data.campaigns) || !data.campaigns.length) {
      await requestJson("/api/wb/ads/campaigns/sync", {
        method: "POST",
        headers: authHeaders(),
        timeoutMs: 25000,
      }).catch(() => null);
      const retry = (await requestCampaigns(true, 45000)).payload;
      if (retry && Array.isArray(retry.campaigns)) data = retry;
    }

    applyWbCampaignPayload(data);
    wbAdsEnrichSignature = "";
    wbAdsEnrichSignatureAt = 0;

    const ids = wbCampaignRows.map((row) => Number(getCampaignRowId(row) || 0)).filter((id) => id > 0);
    setWbAdsLoadProgressStatus(
      tr(
        `Быстрый список загружен: ${formatInt(ids.length)}. Проверяем актуальность…`,
        `Fast list loaded: ${formatInt(ids.length)}. Checking freshness...`
      ),
      { loaded: ids.length, total: ids.length, active: true }
    );

    if (selectedWbCampaignId && !wbCampaignRows.some((x) => getCampaignRowId(x) === selectedWbCampaignId)) {
      selectedWbCampaignId = "";
    }
    if (!wbCampaignRows.length) {
      updateWbAdsLoadStatus(
        tr(
          "Кампании пока не получены: проверьте ключ WB Ads и нажмите обновить.",
          "No campaigns yet: verify WB Ads key and refresh."
        )
      );
    } else {
      updateWbAdsLoadStatus();
    }

    renderWbCampaignRows();
    refreshWbBidderCampaignHints();
    await pollWbCampaignSnapshotRefresh(runToken, requestCampaigns, data?.meta || {}, { force });
    requestJson("/api/wb/ads/balance", { headers: authHeaders(), timeoutMs: 30000 })
      .then((payload) => {
        if (runToken !== wbAdsLoadToken) return;
        wbAdsBalanceData = payload;
        renderWbCampaignRows();
      })
      .catch(() => null);
    markModuleLoaded("ads");
    void enrichWbCampaignRows(runToken, { force }).catch(() => null);
  })();

  wbAdsLoadInflight = runTask.finally(() => {
    wbAdsLoadInflight = null;
  });
  return wbAdsLoadInflight;
}
function getCampaignRowId(row) {
  return String(row?.advertId || row?.advert_id || row?.campaignId || row?.campaign_id || row?.id || row?.adId || "");
}

function campaignFallbackName(campaignId = "") {
  const id = String(campaignId || "").trim();
  if (!id || id === "-") return "-";
  return currentLang === "en" ? `Campaign ${id}` : `\u041a\u0430\u043c\u043f\u0430\u043d\u0438\u044f ${id}`;
}

function rawCampaignName(row) {
  return String(row?.name || row?.campaignName || row?.campaign_name || row?.subject || row?.title || "").trim();
}

function isBrokenCampaignName(value) {
  const text = String(value || "").trim();
  if (!text) return false;
  const score = typeof _mojibakeScore === "function" ? Number(_mojibakeScore(text) || 0) : 0;
  if (score >= 3) return true;
  return /(?:\u0420[\u00a0\u00b0-\u00bf\u2019\u0402-\u040f\u0452-\u045f]|\u0421[\u00a0\u00b0-\u00bf\u0402-\u040f\u0452-\u045f]|\u0420\u00a0|\u00d0|\u00d1|\u00c3|\u00e2\u20ac|\uFFFD)/.test(text);
}

function safeCampaignName(row, campaignId = "", { fallback = true } = {}) {
  const id = campaignId || getCampaignRowId(row);
  const raw = rawCampaignName(row);
  let name = raw;
  if (name) {
    try {
      name = String(decodePossiblyMojibake(name) || name).trim();
    } catch (_) {}
    try {
      if (typeof window !== "undefined" && typeof window.__repairMojibakeText === "function") {
        name = String(window.__repairMojibakeText(name) || name).trim();
      }
    } catch (_) {}
  }
  if (!name || isBrokenCampaignName(name) || isPlaceholderCampaignName(name, id)) {
    return fallback ? campaignFallbackName(id) : "";
  }
  return name;
}

function campaignHasContext(row) {
  const name = safeCampaignName(row, getCampaignRowId(row), { fallback: false });
  const status = String(row?.status || row?.state || "").trim();
  const type = String(row?.type || row?.adType || row?.campaignType || row?.typeId || "").trim();
  const budget = String(row?.dailyBudget || row?.budget || row?.sum || "").trim();
  return Boolean(name || status || type || budget);
}

function isPlaceholderCampaignName(name, campaignId = "") {
  const text = String(name || "").trim();
  if (!text) return true;
  const low = text.toLowerCase();
  const compact = low.replace(/\s+/g, " ").trim();
  if (/^\d{4,}$/.test(compact)) return true;

  const ruCampaignRoot = "\u043a\u0430\u043c\u043f\u0430\u043d";
  const ruAdRoot = "\u0440\u0435\u043a\u043b\u0430\u043c";
  const genericWords = new Set([
    "campaign",
    "camp",
    "advert",
    "advertising",
    "ad",
    "ads",
    "\u043a\u0430\u043c\u043f\u0430\u043d\u0438\u044f",
    "\u043a\u0430\u043c\u043f\u0430\u043d\u0438\u0438",
    "\u0440\u0435\u043a\u043b\u0430\u043c\u0430",
    "\u0440\u0435\u043a\u043b\u0430\u043c\u043d\u0430\u044f",
  ]);
  const compactSingle = new RegExp(`^(?:campaign|camp|advert|advertising|ads?|${ruAdRoot}[a-z\u0400-\u04ff0-9_]*|${ruCampaignRoot}[a-z\u0400-\u04ff0-9_]*)\\s*[#?:\\-]?\\s*\\d+$`, "iu");
  const compactDouble = new RegExp(`^(?:${ruAdRoot}[a-z\u0400-\u04ff0-9_]*|advert|advertising|ads?|campaign|camp)\\s+(?:${ruCampaignRoot}[a-z\u0400-\u04ff0-9_]*|campaign|camp)\\s*[#?:\\-]?\\s*\\d+$`, "iu");
  if (compactSingle.test(compact) || compactDouble.test(compact)) return true;

  const cidRaw = String(campaignId || "").trim();
  const cidMatch = cidRaw.match(/\d+/);
  const cid = cidMatch ? cidMatch[0] : "";
  if (cid) {
    const cidRe = new RegExp(`\\b${cid}\\b`);
    if (compact === cid || cidRe.test(compact)) {
      let reduced = compact.replace(new RegExp(`\\b${cid}\\b`, "g"), " ");
      reduced = reduced.replace(/[#?:;,_\-.()\[\]/]+/g, " ").replace(/\s+/g, " ").trim();
      if (!reduced) return true;
      const words = reduced.match(/[a-z\u0400-\u04ff]+/gi) || [];
      if (words.length && words.every((word) => {
        const normalized = String(word || "").toLowerCase();
        return genericWords.has(normalized)
          || normalized.startsWith(ruCampaignRoot)
          || normalized.startsWith(ruAdRoot);
      })) {
        return true;
      }
    }
  }
  return false;
}

function campaignHasRealName(row) {
  const cid = getCampaignRowId(row);
  return Boolean(safeCampaignName(row, cid, { fallback: false }));
}

function campaignHasStats(row) {
  if (!row || typeof row !== "object") return false;
  if (row.stat_has_context === true) return true;
  if (row.stat_has_context === false) return false;
  const metricKeys = ["views", "clicks", "orders", "spent", "ctr", "cr", "cpc", "cpo"];
  return metricKeys.some((key) => {
    if (!(key in row)) return false;
    const val = Number(row[key]);
    if (!Number.isFinite(val)) return false;
    return Math.abs(val) > 0.000001 || Number(row.metric_hits || 0) > 0;
  });
}
function mergeCampaignSummaryIntoRow(row, summary) {
  if (!summary || typeof summary !== "object") return row;
  const next = { ...row };
  const currentId = getCampaignRowId(next) || String(summary.campaign_id || "");
  const summaryName = safeCampaignName({ name: summary.name }, currentId, { fallback: false });
  if (summaryName && !safeCampaignName(next, currentId, { fallback: false })) {
    next.name = summaryName;
  }
  if ((!next.status || next.status === "-") && summary.status) next.status = summary.status;
  if ((!next.type || next.type === "-") && summary.type) next.type = summary.type;
  if ((!next.dailyBudget && (!next.budget || next.budget === "-")) && summary.budget) next.budget = summary.budget;
  if (summary.campaign_id && !getCampaignRowId(next)) next.advertId = summary.campaign_id;
  return next;
}

function updateWbAdsLoadStatus(message = "") {
  const holder = document.getElementById("wbAdsLoadStatus");
  if (!holder) return;
  if (message) {
    holder.innerHTML = buildLoadStatusHtml({
      title: message,
      loaded: wbAdsLoadProgress.loaded || 0,
      total: wbAdsLoadProgress.total || 0,
      active: wbAdsLoadProgress.active,
      failed: wbAdsLoadProgress.failed || 0,
    });
    return;
  }
  const { active, total, loaded, failed } = wbAdsLoadProgress;
  if (!active && !total) {
    holder.textContent = "-";
    return;
  }
  const doneTitle = failed > 0
    ? tr("Догрузка завершена частично", "Campaign load completed partially")
    : tr("Догрузка кампаний завершена", "Campaign load complete");
  holder.innerHTML = buildLoadStatusHtml({
    title: active
      ? tr("Догрузка кампаний", "Loading campaigns")
      : doneTitle,
    loaded,
    total,
    active,
    failed,
  });
}

function setWbAdsLoadProgressStatus(message, { loaded = 0, total = 0, active = true, failed = 0 } = {}) {
  wbAdsLoadProgress = {
    active: Boolean(active),
    total: Math.max(0, Number(total || 0)),
    loaded: Math.max(0, Number(loaded || 0)),
    failed: Math.max(0, Number(failed || 0)),
  };
  updateWbAdsLoadStatus(message);
}

function applyWbCampaignPayload(data) {
  wbCampaignRows = Array.isArray(data?.campaigns) ? data.campaigns : [];
  const statsMap = (data && typeof data.stats === "object" && data.stats) ? data.stats : {};
  wbCampaignRows = wbCampaignRows.map((row) => {
    const cid = getCampaignRowId(row);
    if (!cid || !statsMap[cid]) return row;
    return { ...row, ...statsMap[cid] };
  });
  return wbCampaignRows;
}

async function pollWbCampaignSnapshotRefresh(runToken, requestCampaigns, initialMeta = {}, options = {}) {
  const shouldPoll = Boolean(
    options?.force
    || initialMeta?.stale
    || initialMeta?.refresh_queued
    || String(initialMeta?.source || "").includes("queue")
  );
  if (!shouldPoll) return null;
  const startedSyncedAt = String(initialMeta?.snapshot_synced_at || "");
  const maxPolls = options?.force ? 10 : 6;
  for (let attempt = 1; attempt <= maxPolls; attempt += 1) {
    if (runToken !== wbAdsLoadToken) return null;
    setWbAdsLoadProgressStatus(
      tr(
        `Список показан. Обновляем кампании в фоне (${attempt}/${maxPolls})…`,
        `List is visible. Refreshing campaigns in background (${attempt}/${maxPolls})...`
      ),
      { loaded: attempt - 1, total: maxPolls, active: true }
    );
    await delay(attempt === 1 ? 1600 : 3500);
    if (runToken !== wbAdsLoadToken) return null;
    const result = await requestCampaigns(true, 20000);
    const payload = result.payload;
    if (!payload || !Array.isArray(payload.campaigns)) continue;
    const meta = payload.meta && typeof payload.meta === "object" ? payload.meta : {};
    const syncedAt = String(meta.snapshot_synced_at || "");
    const gotFreshSnapshot = Boolean(syncedAt && syncedAt !== startedSyncedAt) || meta.stale === false;
    if (!gotFreshSnapshot && attempt < maxPolls) continue;
    applyWbCampaignPayload(payload);
    renderWbCampaignRows();
    refreshWbBidderCampaignHints();
    setWbAdsLoadProgressStatus(
      gotFreshSnapshot
        ? tr(
            `Кампании обновлены: ${formatInt(wbCampaignRows.length)}. Догружаем подробности…`,
            `Campaigns refreshed: ${formatInt(wbCampaignRows.length)}. Loading details...`
          )
        : tr(
            `Список кампаний показан: ${formatInt(wbCampaignRows.length)}. Обновление продолжится в фоне, догружаем подробности…`,
            `Campaign list is visible: ${formatInt(wbCampaignRows.length)}. Refresh continues in background; loading details...`
          ),
      { loaded: wbCampaignRows.length, total: wbCampaignRows.length, active: true }
    );
    return payload;
  }
  setWbAdsLoadProgressStatus(
    tr(
      `Список кампаний показан: ${formatInt(wbCampaignRows.length)}. Обновление продолжится в фоне, догружаем подробности…`,
      `Campaign list is visible: ${formatInt(wbCampaignRows.length)}. Refresh continues in background; loading details...`
    ),
    { loaded: wbCampaignRows.length, total: wbCampaignRows.length, active: true }
  );
  return null;
}

async function enrichWbCampaignRows(runToken, options = {}) {
  const allIds = wbCampaignRows
    .map((row) => Number(getCampaignRowId(row) || 0))
    .filter((id) => id > 0);
  if (!allIds.length) {
    wbAdsLoadProgress = { active: false, total: 0, loaded: 0, failed: 0 };
    updateWbAdsLoadStatus(tr("Кампании не найдены.", "No campaigns found."));
    return;
  }
  const pendingRaw = [...new Set(
    wbCampaignRows
      .filter((row) => {
        const cid = Number(getCampaignRowId(row) || 0);
        if (cid <= 0) return false;
        return !campaignHasContext(row) || !campaignHasRealName(row) || !campaignHasStats(row);
      })
      .map((row) => Number(getCampaignRowId(row) || 0))
      .filter((id) => id > 0)
  )];
  const autoEnrichLimit = Boolean(options && options.force) ? 1200 : 360;
  const pending = pendingRaw.slice(0, autoEnrichLimit);
  const deferredCount = Math.max(0, pendingRaw.length - pending.length);
  if (!pending.length) {
    wbAdsLoadProgress.active = false;
    wbAdsLoadProgress.total = allIds.length;
    wbAdsLoadProgress.loaded = allIds.length;
    wbAdsLoadProgress.failed = 0;
    updateWbAdsLoadStatus(
      tr(
        `Список и подробности актуальны: ${formatInt(allIds.length)} кампаний.`,
        `List and details are up to date: ${formatInt(allIds.length)} campaigns.`
      )
    );
    renderWbCampaignRows();
    return;
  }
  const enrichSignature = pending.join(",");
  const nowMs = Date.now();
  if (
    wbAdsEnrichSignature
    && wbAdsEnrichSignature === enrichSignature
    && (nowMs - Number(wbAdsEnrichSignatureAt || 0)) < 45000
    && Number(wbAdsLoadProgress.loaded || 0) >= pending.length
    && !wbAdsLoadProgress.active
  ) {
    updateWbAdsLoadStatus();
    renderWbCampaignRows();
    return;
  }
  wbAdsEnrichSignature = enrichSignature;
  wbAdsEnrichSignatureAt = nowMs;

  wbAdsLoadProgress.total = pending.length;
  wbAdsLoadProgress.loaded = 0;
  wbAdsLoadProgress.failed = 0;
  updateWbAdsLoadStatus(
    tr(
      `Догружаем подробности кампаний: 0/${formatInt(pending.length)}…`,
      `Loading campaign details: 0/${formatInt(pending.length)}...`
    )
  );

  const batchSize = pending.length > 80 ? 12 : 8;
  const requestEnrichChunk = async (ids, timeoutMs = 45000) => requestJson("/api/wb/ads/campaigns/enrich", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ ids }),
    timeoutMs,
  }).catch(() => null);
  const applyEnrichPayload = (chunk, payload) => {
    const summaries = payload?.summaries && typeof payload.summaries === "object" ? payload.summaries : {};
    const stats = payload?.stats && typeof payload.stats === "object" ? payload.stats : {};
    const meta = payload?.meta && typeof payload.meta === "object" ? payload.meta : {};
    const partialStatsIds = Array.isArray(meta?.partial_stats_ids)
      ? meta.partial_stats_ids.map((x) => Number(x || 0)).filter((x) => Number.isFinite(x) && x > 0)
      : [];
    let partialSummaryIds = Array.isArray(meta?.partial_summary_ids)
      ? meta.partial_summary_ids.map((x) => Number(x || 0)).filter((x) => Number.isFinite(x) && x > 0)
      : [];
    const temporaryUnavailable = Boolean(meta?.temporary_unavailable);
    partialStatsMissingTotal += partialStatsIds.length;
    const hasMissingMeta = Array.isArray(meta?.hard_missing_ids) || Array.isArray(meta?.missing_ids) || Array.isArray(meta?.partial_summary_ids);
    if (temporaryUnavailable) {
      temporaryUnavailableChunks += 1;
      partialFallback = true;
      if (!partialStatsIds.length) partialStatsMissingTotal += chunk.length;
      if (!partialSummaryIds.length) partialSummaryMissingTotal += chunk.length;
    }
    wbCampaignRows = wbCampaignRows.map((row) => {
      const cid = getCampaignRowId(row);
      if (!cid) return row;
      const merged = mergeCampaignSummaryIntoRow(row, summaries[cid] || null);
      if (stats[cid] && typeof stats[cid] === "object") return { ...merged, ...stats[cid] };
      return merged;
    });
    const chunkContextMissing = chunk.filter((cid) => {
      const cidText = String(cid);
      const row = wbCampaignRows.find((item) => getCampaignRowId(item) === cidText);
      return !row || !campaignHasContext(row);
    });
    const chunkSummaryMissing = chunk.filter((cid) => {
      const cidText = String(cid);
      const row = wbCampaignRows.find((item) => getCampaignRowId(item) === cidText);
      return !row || !campaignHasRealName(row);
    });
    if (!partialSummaryIds.length) partialSummaryIds = chunkSummaryMissing;
    partialSummaryMissingTotal += partialSummaryIds.length;
    if (!temporaryUnavailable && chunkContextMissing.length > 0 && !hasMissingMeta) {
      partialFallback = true;
    }
  };
  let partialFallback = false;
  let partialStatsMissingTotal = 0;
  let partialSummaryMissingTotal = 0;
  let temporaryUnavailableChunks = 0;
  let hardTransportErrors = 0;
  for (let i = 0; i < pending.length; i += batchSize) {
    if (runToken !== wbAdsLoadToken) return;
    const chunk = pending.slice(i, i + batchSize);
    const payload = await requestEnrichChunk(chunk, 45000);

    if (!payload) {
      partialFallback = true;
      const fallbackBatchSize = chunk.length > 8 ? 4 : (chunk.length > 3 ? 2 : 1);
      for (let j = 0; j < chunk.length; j += fallbackBatchSize) {
        if (runToken !== wbAdsLoadToken) return;
        const subChunk = chunk.slice(j, j + fallbackBatchSize);
        const subPayload = await requestEnrichChunk(subChunk, 30000);
        if (!subPayload) {
          hardTransportErrors += subChunk.length;
          continue;
        }
        applyEnrichPayload(subChunk, subPayload);
        wbAdsLoadProgress.loaded += subChunk.length;
      }
      wbAdsLoadProgress.failed = hardTransportErrors;
      updateWbAdsLoadStatus(
        tr(
          `Догружаем подробности кампаний: ${formatInt(wbAdsLoadProgress.loaded)}/${formatInt(wbAdsLoadProgress.total)}…`,
          `Loading campaign details: ${formatInt(wbAdsLoadProgress.loaded)}/${formatInt(wbAdsLoadProgress.total)}...`
        )
      );
      renderWbCampaignRows();
      continue;
    }
    applyEnrichPayload(chunk, payload);
    wbAdsLoadProgress.loaded += chunk.length;
    wbAdsLoadProgress.failed = hardTransportErrors;
    updateWbAdsLoadStatus(
      tr(
        `Догружаем подробности кампаний: ${formatInt(wbAdsLoadProgress.loaded)}/${formatInt(wbAdsLoadProgress.total)}…`,
        `Loading campaign details: ${formatInt(wbAdsLoadProgress.loaded)}/${formatInt(wbAdsLoadProgress.total)}...`
      )
    );
    renderWbCampaignRows();
  }
  if (runToken !== wbAdsLoadToken) return;
  wbAdsLoadProgress.active = false;
  if (partialFallback || Number(wbAdsLoadProgress.failed || 0) > 0) {
    let msg = tr(
      "Кампании загружены частично: часть детальных полей временно недоступна.",
      "Campaigns loaded partially: some detailed fields are temporarily unavailable."
    );
    if (temporaryUnavailableChunks > 0) {
      msg = tr(
        "WB Ads API временно ограничил детализацию. Кампании загружены, но часть полей пока недоступна.",
        "WB Ads API temporarily limited details. Campaigns are loaded, but some fields are not available yet."
      );
    }
    if (temporaryUnavailableChunks <= 0 && partialStatsMissingTotal > 0 && Number(wbAdsLoadProgress.failed || 0) <= 0) {
      msg = tr(
        `Кампании загружены. Для ${formatInt(partialStatsMissingTotal)} кампаний статистика за период пока не вернулась API.`,
        `Campaigns loaded. Period stats are not returned yet for ${formatInt(partialStatsMissingTotal)} campaigns.`
      );
    } else if (partialSummaryMissingTotal > 0 && Number(wbAdsLoadProgress.failed || 0) <= 0) {
      msg = tr(
        `Кампании загружены. Для ${formatInt(partialSummaryMissingTotal)} кампаний API WB не вернуло человекочитаемое название.`,
        `Campaigns loaded. WB API returned no readable name for ${formatInt(partialSummaryMissingTotal)} campaigns.`
      );
    } else if (partialStatsMissingTotal > 0 || partialSummaryMissingTotal > 0) {
      msg += ` ${tr("Неполные поля", "Incomplete fields")}: ${formatInt(partialStatsMissingTotal + partialSummaryMissingTotal)}.`;
    }
    updateWbAdsLoadStatus(msg);
  } else if (deferredCount > 0) {
    updateWbAdsLoadStatus(
      tr(
        `Кампании загружены. Для снижения нагрузки детальная догрузка ограничена: отложено ${formatInt(deferredCount)}.`,
        `Campaigns loaded. To reduce load, detailed enrichment is deferred for ${formatInt(deferredCount)} campaigns.`
      )
    );
  } else {
    updateWbAdsLoadStatus(
      tr(
        `Подробности загружены: ${formatInt(wbAdsLoadProgress.loaded)}/${formatInt(wbAdsLoadProgress.total)}.`,
        `Details loaded: ${formatInt(wbAdsLoadProgress.loaded)}/${formatInt(wbAdsLoadProgress.total)}.`
      )
    );
  }
  renderWbCampaignRows();
}

function campaignStatusMeta(value) {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "-") return { code: "", label: "-", isWorking: false };
  const num = Number(raw);
  if (Number.isFinite(num)) {
    const dict = currentLang === "en"
      ? {
        "-1": "deleted",
        "1": "draft (media)",
        "2": "moderation (media)",
        "3": "rejected (media)",
        "4": "ready to start",
        "5": "scheduled (media)",
        "6": "running (media)",
        "7": "completed",
        "8": "cancelled",
        "9": "active",
        "10": "day-limit pause (media)",
        "11": "paused",
      }
      : {
        "-1": "удалена",
        "1": "черновик (медиа)",
        "2": "на модерации (медиа)",
        "3": "отклонена (медиа)",
        "4": "готова к запуску",
        "5": "запланирована (медиа)",
        "6": "идут показы (медиа)",
        "7": "завершена",
        "8": "отменена",
        "9": "активна",
        "10": "пауза по дневному лимиту (медиа)",
        "11": "пауза",
      };
    const label = dict[String(num)] || (currentLang === "en" ? `status ${num}` : `статус ${num}`);
    const isWorking = num === 6 || num === 9;
    return { code: String(num), label, isWorking };
  }
  const low = raw.toLowerCase();
  const isWorking = low.includes("active") || low.includes("актив");
  return { code: raw, label: raw, isWorking };
}

function normalizeCampaignStatus(value) {
  const meta = campaignStatusMeta(value);
  if (!meta.code) return "-";
  return `${meta.code} (${meta.label})`;
}

function campaignTypeMeta(value) {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "-") return { code: "", label: "-" };
  const num = Number(raw);
  if (Number.isFinite(num)) {
    const map = {
      "4": "search",
      "5": "catalog",
      "6": "cards",
      "7": "recommendation",
      "8": "auto-cpm",
      "9": "search + catalog",
    };
    return { code: String(num), label: map[String(num)] || `type-${num}` };
  }
  return { code: raw, label: raw };
}

function normalizeCampaignType(value) {
  const meta = campaignTypeMeta(value);
  if (!meta.code) return "-";
  if (meta.code === meta.label) return meta.label;
  return `${meta.code} (${meta.label})`;
}

function parseCampaignBudget(row) {
  const finance = (row && typeof row.finance === "object") ? row.finance : {};
  const settings = (row && typeof row.settings === "object") ? row.settings : {};
  const raw = row?.dailyBudget
    ?? row?.budget
    ?? row?.sum
    ?? row?.money
    ?? finance?.budget
    ?? finance?.dailyBudget
    ?? settings?.budget
    ?? settings?.dailyBudget
    ?? row?.balance
    ?? 0;
  const normalized = normalizeCampaignNumber(raw);
  const num = Number(normalized);
  return Number.isFinite(num) ? num : 0;
}

function normalizeCampaignNumber(value) {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return value;
  const compact = value
    .replace(/\s+/g, "")
    .replace(",", ".")
    .replace(/[^\d.\-]/g, "");
  return compact;
}

function parseCampaignMetric(row, key, fixed = 0) {
  const aliases = {
    views: ["views", "impressions", "shows", "view_count"],
    clicks: ["clicks", "click_count"],
    orders: ["orders", "orders_count", "order_count", "orders_sum", "purchases", "atbs", "ordersCnt"],
    spent: ["spent", "sum", "cost", "expense", "total_spent", "totalCost"],
    ctr: ["ctr"],
    cr: ["cr", "cvr", "conversion"],
    cpc: ["cpc"],
    cpo: ["cpo", "cpa"],
  };
  const keyList = aliases[key] || [key];
  let raw = null;
  for (const code of keyList) {
    if (row && row[code] !== undefined && row[code] !== null && row[code] !== "") {
      raw = row[code];
      break;
    }
  }
  if (raw === null) return "-";
  const normalized = normalizeCampaignNumber(raw);
  const val = Number(normalized);
  if (!Number.isFinite(val)) return "-";
  if (fixed > 0) return val.toFixed(fixed);
  if (Number.isInteger(val)) return String(val);
  return String(Math.round(val * 1000) / 1000);
}

function getAdsSortMode() {
  return (document.getElementById("wbAdsSortBy")?.value || "id_desc").trim().toLowerCase();
}

function getFilteredCampaignRows() {
  const q = (document.getElementById("wbAdsSearch")?.value || "").trim().toLowerCase();
  const statusFilter = (document.getElementById("wbAdsStatusFilter")?.value || "all").trim().toLowerCase();
  const typeFilter = (document.getElementById("wbAdsTypeFilter")?.value || "all").trim().toLowerCase();
  const workingFilter = (document.getElementById("wbAdsWorkingFilter")?.value || "all").trim().toLowerCase();
  const minBudget = Number(document.getElementById("wbAdsBudgetMin")?.value || "");
  const maxBudget = Number(document.getElementById("wbAdsBudgetMax")?.value || "");
  const rows = wbCampaignRows.filter((row) => {
    const id = getCampaignRowId(row);
    const name = safeCampaignName(row, id);
    const statusRaw = String(row?.status ?? row?.state ?? "").trim();
    const typeRaw = String(row?.type ?? row?.adType ?? row?.campaignType ?? row?.typeId ?? "").trim();
    const statusMeta = campaignStatusMeta(statusRaw);
    const typeMeta = campaignTypeMeta(typeRaw);
    const budget = parseCampaignBudget(row);

    if (q) {
      const hay = `${id} ${name} ${statusMeta.code} ${statusMeta.label} ${typeMeta.code} ${typeMeta.label}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (statusFilter !== "all" && statusMeta.code !== statusFilter) return false;
    if (typeFilter !== "all") {
      const code = String(typeMeta.code || "").toLowerCase();
      const label = String(typeMeta.label || "").toLowerCase();
      if (typeFilter !== code && typeFilter !== label) return false;
    }
    if (workingFilter === "yes" && !statusMeta.isWorking) return false;
    if (workingFilter === "no" && statusMeta.isWorking) return false;
    if (Number.isFinite(minBudget) && budget < minBudget) return false;
    if (Number.isFinite(maxBudget) && budget > maxBudget) return false;
    return true;
  });

  const mode = getAdsSortMode();
  rows.sort((a, b) => {
    const aid = Number(getCampaignRowId(a) || 0);
    const bid = Number(getCampaignRowId(b) || 0);
    const aname = safeCampaignName(a, aid).toLowerCase();
    const bname = safeCampaignName(b, bid).toLowerCase();
    const ab = parseCampaignBudget(a);
    const bb = parseCampaignBudget(b);
    const as = Number(campaignStatusMeta(a?.status ?? a?.state ?? "").code || 0);
    const bs = Number(campaignStatusMeta(b?.status ?? b?.state ?? "").code || 0);

    if (mode === "id_asc") return aid - bid;
    if (mode === "budget_desc") return bb - ab;
    if (mode === "budget_asc") return ab - bb;
    if (mode === "name_asc") return aname.localeCompare(bname, "ru");
    if (mode === "name_desc") return bname.localeCompare(aname, "ru");
    if (mode === "status_asc") return as - bs;
    if (mode === "status_desc") return bs - as;
    return bid - aid;
  });
  return rows;
}

function resetAdsFilters() {
  const ids = [
    ["wbAdsSearch", ""],
    ["wbAdsStatusFilter", "all"],
    ["wbAdsTypeFilter", "all"],
    ["wbAdsWorkingFilter", "all"],
    ["wbAdsBudgetMin", ""],
    ["wbAdsBudgetMax", ""],
    ["wbAdsSortBy", "id_desc"],
  ];
  for (const [id, val] of ids) {
    const el = document.getElementById(id);
    if (el) el.value = val;
  }
  renderWbCampaignRows();
}

window.resetAdsFilters = resetAdsFilters;

function renderWbCampaignRows() {
  const tbody = document.getElementById("wbAdsCampaignsTable");
  if (!tbody) return;
  tbody.innerHTML = "";
  const rows = getFilteredCampaignRows();
  refreshWbBidderCampaignHints();

  const meta = document.getElementById("wbAdsMeta");
  if (meta) {
    const rawBalance = wbAdsBalanceData?.data || {};
    const extractedBalance = Number(
      rawBalance.balance
      ?? rawBalance.total
      ?? rawBalance.sum
      ?? rawBalance.available
      ?? rawBalance.cash
      ?? 0
    );
    const balanceText = wbAdsBalanceData?.data
      ? (Number.isFinite(extractedBalance) && extractedBalance > 0 ? formatMoney(extractedBalance) : tr("доступен", "available"))
      : (currentLang === "en" ? "unavailable" : "не получен");
    meta.textContent = currentLang === "en"
      ? `Campaigns: ${rows.length}/${wbCampaignRows.length}. Balance: ${balanceText}`
      : `Кампаний: ${rows.length}/${wbCampaignRows.length}. Баланс: ${balanceText}`;
  }

  if (!rows.length) {
    const rowEl = document.createElement("tr");
    rowEl.innerHTML = `<td colspan="11">${currentLang === "en" ? "No campaigns found." : "Кампании не найдены."}</td>`;
    tbody.appendChild(rowEl);
    return;
  }
  for (const row of rows) {
    const rowId = getCampaignRowId(row);
    const id = rowId || "-";
    const name = safeCampaignName(row, id);
    const statusMeta = campaignStatusMeta(row.status || row.state || "-");
    const typeMeta = campaignTypeMeta(row.type || row.adType || row.campaignType || row.typeId || "-");
    const status = normalizeCampaignStatus(row.status || row.state || "-");
    const type = normalizeCampaignType(row.type || row.adType || row.campaignType || row.typeId || "-");
    const budget = parseCampaignBudget(row);
    const workingText = statusMeta.isWorking ? (currentLang === "en" ? "Yes" : "Да") : (currentLang === "en" ? "No" : "Нет");
    const views = parseCampaignMetric(row, "views");
    const clicks = parseCampaignMetric(row, "clicks");
    const ctr = parseCampaignMetric(row, "ctr", 2);
    const orders = parseCampaignMetric(row, "orders");
    const spent = parseCampaignMetric(row, "spent", 2);
    const rowEl = document.createElement("tr");
    if (selectedWbCampaignId && id === selectedWbCampaignId) rowEl.classList.add("selected-row");
    rowEl.innerHTML = `
      <td>${escapeHtml(id)}</td>
      <td>${escapeHtml(name)}</td>
      <td>${escapeHtml(status)}</td>
      <td>${escapeHtml(type)}</td>
      <td>${escapeHtml(String(budget))}</td>
      <td>${escapeHtml(workingText)}</td>
      <td>${escapeHtml(views)}</td>
      <td>${escapeHtml(clicks)}</td>
      <td>${escapeHtml(ctr === "-" ? "-" : `${ctr}%`)}</td>
      <td>${escapeHtml(orders)}</td>
      <td>${escapeHtml(spent)}</td>
    `;
    rowEl.onclick = () => {
      if (id === "-") return;
      selectedWbCampaignId = id;
      const campaignInput = document.getElementById("wbRateCampaignId");
      if (campaignInput) campaignInput.value = String(id);
      const bidderCampaignInput = document.getElementById("wbBidderCampaignId");
      if (bidderCampaignInput) bidderCampaignInput.value = String(id);
      const analyticsInput = document.getElementById("adsAnalyticsCampaignId");
      if (analyticsInput) analyticsInput.value = String(id);
      const typeInput = document.getElementById("wbRateCampaignType");
      const typeRaw = String(typeMeta.label || type).toLowerCase();
      if (typeInput) {
        if (typeRaw.includes("auto")) typeInput.value = "auto-cpm";
        else if (typeRaw.includes("search")) typeInput.value = "search";
      }
      renderWbCampaignRows();
      openCampaignDetailModal(Number(id));
    };
    rowEl.ondblclick = () => {
      if (id === "-") return;
      openCampaignDetailModal(Number(id));
    };
    tbody.appendChild(rowEl);
  }
}

function closeCampaignDetailModal() {
  const modal = document.getElementById("campaignDetailModal");
  if (!modal) return;
  modal.classList.add("hidden");
  currentCampaignDetailId = 0;
}

window.closeCampaignDetailModal = closeCampaignDetailModal;

function renderCampaignDetail(data) {
  const summaryEl = document.getElementById("campaignDetailSummary");
  const productsEl = document.getElementById("campaignProductsTable");
  const ratesEl = document.getElementById("campaignRatesRaw");
  const statsEl = document.getElementById("campaignStatsRaw");
  const rawEl = document.getElementById("campaignDetailRaw");
  if (!summaryEl || !productsEl || !ratesEl || !statsEl || !rawEl) return;

  const summary = data?.summary || {};
  const statsPayload = data?.stats && typeof data.stats === "object" ? data.stats : {};
  const statItems = Array.isArray(statsPayload.items) ? statsPayload.items : [];
  const collectByKey = (node, matcher, out, depth = 0) => {
    if (!node || depth > 8 || out.length >= 120) return;
    if (Array.isArray(node)) {
      for (const item of node) {
        if (out.length >= 120) break;
        collectByKey(item, matcher, out, depth + 1);
      }
      return;
    }
    if (typeof node !== "object") return;
    for (const [k, v] of Object.entries(node)) {
      if (out.length >= 120) break;
      const key = String(k || "").toLowerCase();
      if (matcher(key)) {
        if (Array.isArray(v)) {
          for (const item of v) {
            if (out.length >= 120) break;
            const text = String(item ?? "").trim();
            if (text) out.push(text);
          }
        } else {
          const text = String(v ?? "").trim();
          if (text) out.push(text);
        }
      }
      collectByKey(v, matcher, out, depth + 1);
    }
  };
  const dedupeTexts = (items) => {
    const seen = new Set();
    const out = [];
    for (const raw of Array.isArray(items) ? items : []) {
      const text = String(raw || "").replace(/\s+/g, " ").trim();
      if (!text) continue;
      const key = text.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(text);
      if (out.length >= 40) break;
    }
    return out;
  };
  const keywords = [];
  const minusWords = [];
  collectByKey(data?.raw || {}, (k) => /keyword|phrase|query|search/.test(k), keywords);
  collectByKey(data?.rates || {}, (k) => /keyword|phrase|query|search/.test(k), keywords);
  collectByKey(data?.raw || {}, (k) => /minus|negative|excluded|stopword|stop_word/.test(k), minusWords);
  collectByKey(data?.rates || {}, (k) => /minus|negative|excluded|stopword|stop_word/.test(k), minusWords);
  const keywordList = dedupeTexts(keywords);
  const minusList = dedupeTexts(minusWords);
  const statsRows = Array.isArray(statItems) ? statItems.filter((x) => x && typeof x === "object") : [];
  const sumMetric = (name) => statsRows.reduce((acc, row) => {
    const n = Number(row?.[name] || 0);
    return acc + (Number.isFinite(n) ? n : 0);
  }, 0);
  const statTotals = {
    views: sumMetric("views"),
    clicks: sumMetric("clicks"),
    orders: sumMetric("orders"),
    spent: sumMetric("spent"),
  };
  const ctr = statTotals.views > 0 ? (statTotals.clicks / statTotals.views) * 100 : 0;
  const cpo = statTotals.orders > 0 ? (statTotals.spent / statTotals.orders) : 0;
  const statusText = normalizeCampaignStatus(summary.status || "-");
  const typeText = normalizeCampaignType(summary.type || "-");
  const workingText = campaignStatusMeta(summary.status || "-").isWorking ? tr("Да", "Yes") : tr("Нет", "No");
  const summaryRows = [
    `${tr("ID", "ID")}: ${summary.campaign_id || "-"}`,
    `${tr("Название", "Name")}: ${summary.name || "-"}`,
    `${tr("??????", "Status")}: ${statusText}`,
    `${tr("Тип", "Type")}: ${typeText}`,
    `${tr("????????", "Running")}: ${workingText}`,
    `${tr("Бюджет", "Budget")}: ${summary.budget || "-"}`,
    `${tr("Показы", "Views")}: ${formatInt(statTotals.views)}`,
    `${tr("Клики", "Clicks")}: ${formatInt(statTotals.clicks)}`,
    `${tr("Заказы", "Orders")}: ${formatInt(statTotals.orders)}`,
    `${tr("??????", "Spend")}: ${formatMoney(statTotals.spent)}`,
    `CTR: ${Number(ctr || 0).toFixed(2)}%`,
    `CPO: ${formatMoney(cpo)}`,
    `${tr("???????", "Created")}: ${summary.created_at || "-"}`,
    `${tr("Обновлена", "Updated")}: ${summary.updated_at || "-"}`,
  ];
  summaryEl.textContent = summaryRows.join(" • ");

  productsEl.innerHTML = "";
  const products = Array.isArray(data?.products) ? data.products : [];
  if (!products.length) {
    const rowEl = document.createElement("tr");
    rowEl.innerHTML = `<td colspan="3">${tr("Товары кампании не обнаружены в ответах API.", "Campaign products were not found in API responses.")}</td>`;
    productsEl.appendChild(rowEl);
  } else {
    for (const row of products.slice(0, 600)) {
      const rowEl = document.createElement("tr");
      rowEl.innerHTML = `
        <td>${escapeHtml(row.nmId ?? "-")}</td>
        <td>${escapeHtml(row.offer ?? "-")}</td>
        <td>${escapeHtml(row.name ?? "-")}</td>
      `;
      productsEl.appendChild(rowEl);
    }
  }

  const ratesSource = data?.rates && typeof data.rates === "object" ? data.rates : {};
  const ratesLines = [];
  for (const [mode, payload] of Object.entries(ratesSource)) {
    const body = payload && typeof payload === "object" ? payload : {};
    const cpm = body.cpm ?? body.bid ?? body.price ?? "-";
    const updated = body.updatedAt ?? body.updated_at ?? body.last_update ?? "-";
    ratesLines.push(`[${mode}] ${tr("??????", "Bid")}: ${cpm}; ${tr("?????????", "Updated")}: ${updated}`);
  }
  if (!ratesLines.length) {
    ratesLines.push(tr("?????? ?? ???????? ?? API.", "Rates were not returned by API."));
  }
  if (keywordList.length) {
    ratesLines.push("");
    ratesLines.push(tr("Ключевые фразы:", "Keywords:"));
    ratesLines.push(...keywordList.slice(0, 30).map((x) => `? ${x}`));
  }
  if (minusList.length) {
    ratesLines.push("");
    ratesLines.push(tr("Минус-слова:", "Negative keywords:"));
    ratesLines.push(...minusList.slice(0, 30).map((x) => `? ${x}`));
  }
  ratesEl.textContent = ratesLines.join("\n");

  const statsLines = [];
  if (statsRows.length) {
    statsLines.push(tr(`????? ??????????: ${statsRows.length}`, `Stats rows: ${statsRows.length}`));
    const sorted = [...statsRows]
      .sort((a, b) => Number(b?.spent || 0) - Number(a?.spent || 0))
      .slice(0, 20);
    for (const row of sorted) {
      const dateLabel = String(row?.date || row?.day || row?.bucket || "-");
      const views = formatInt(Number(row?.views || 0));
      const clicks = formatInt(Number(row?.clicks || 0));
      const orders = formatInt(Number(row?.orders || 0));
      const spent = formatMoney(Number(row?.spent || 0));
      statsLines.push(`${dateLabel}: ${tr("показы", "views")} ${views}, ${tr("клики", "clicks")} ${clicks}, ${tr("заказы", "orders")} ${orders}, ${tr("расход", "spent")} ${spent}`);
    }
  } else {
    statsLines.push(tr("?????????? ?????????? ?? API.", "Stats are unavailable from API."));
  }
  statsEl.textContent = statsLines.join("\n");
  rawEl.textContent = JSON.stringify(data?.raw || {}, null, 2);
}

async function openCampaignDetailModal(campaignId, options = {}) {
  if (!campaignId || campaignId <= 0) return;
  const silentRefresh = Boolean(options && options.silentRefresh);
  currentCampaignDetailId = Number(campaignId) || 0;
  const modal = document.getElementById("campaignDetailModal");
  if (!modal) return;

  modal.classList.remove("hidden");
  const summaryEl = document.getElementById("campaignDetailSummary");
  const productsEl = document.getElementById("campaignProductsTable");
  const ratesEl = document.getElementById("campaignRatesRaw");
  const statsEl = document.getElementById("campaignStatsRaw");
  const rawEl = document.getElementById("campaignDetailRaw");
  if (summaryEl && !silentRefresh) {
    const baseRow = wbCampaignRows.find((row) => Number(getCampaignRowId(row) || 0) === currentCampaignDetailId) || null;
    if (baseRow) {
      const baseName = safeCampaignName(baseRow, currentCampaignDetailId);
      const baseStatus = normalizeCampaignStatus(baseRow?.status || baseRow?.state || "-");
      const baseType = normalizeCampaignType(baseRow?.type || baseRow?.adType || baseRow?.campaignType || baseRow?.typeId || "-");
      summaryEl.textContent = tr(
        `Кампания ${currentCampaignDetailId}: ${baseName || "-"} | ${baseStatus} | ${baseType}. Догружаем расширенные детали...`,
        `Campaign ${currentCampaignDetailId}: ${baseName || "-"} | ${baseStatus} | ${baseType}. Loading extended details...`
      );
    } else {
      summaryEl.textContent = tr("Загружаем детали кампании…", "Loading campaign details...");
    }
  }
  if (!silentRefresh) {
    if (productsEl) productsEl.innerHTML = "";
    if (ratesEl) ratesEl.textContent = "-";
    if (statsEl) statsEl.textContent = "-";
    if (rawEl) rawEl.textContent = "-";
  }

  const cacheKey = String(campaignId);
  let payload = wbCampaignDetailCache.get(cacheKey) || null;
  if (!payload) {
    payload = await withBusy(
      tr(`Загружаем детали кампании ${campaignId}…`, `Loading campaign ${campaignId} details...`),
      () => requestJson(`/api/wb/ads/campaign-details?campaign_id=${campaignId}`, {
        headers: authHeaders(),
        timeoutMs: 30000,
      }),
      tr("\u041f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u0435\u043c \u043a\u044d\u0448 \u0438 \u0434\u043e\u0433\u0440\u0443\u0436\u0430\u0435\u043c \u0441\u0432\u0435\u0436\u0438\u0435 \u0434\u0435\u0442\u0430\u043b\u0438 WB \u0432 \u0444\u043e\u043d\u0435.", "Showing cached details and loading fresh WB details in the background.")
    ).catch((e) => {
      if (!silentRefresh) alert(e.message);
      return null;
    });
    if (!payload) {
      if (summaryEl && !silentRefresh) {
        summaryEl.textContent = tr(
          "Не удалось загрузить детали кампании. Проверьте ключ WB Ads и повторите.",
          "Failed to load campaign details. Check WB Ads key and retry."
        );
      }
      return;
    }
    wbCampaignDetailCache.set(cacheKey, payload);
  }
  renderCampaignDetail(payload.data || {});
  const detailMeta = payload?.data?.meta && typeof payload.data.meta === "object" ? payload.data.meta : {};
  if (detailMeta.refresh_queued && summaryEl) {
    summaryEl.textContent = `${summaryEl.textContent}\n${tr("\u0421\u0432\u0435\u0436\u0438\u0435 \u0434\u0435\u0442\u0430\u043b\u0438 \u0434\u043e\u0433\u0440\u0443\u0436\u0430\u044e\u0442\u0441\u044f. \u041e\u043a\u043d\u043e \u043e\u0431\u043d\u043e\u0432\u0438\u0442\u0441\u044f \u0430\u0432\u0442\u043e\u043c\u0430\u0442\u0438\u0447\u0435\u0441\u043a\u0438.", "Fresh details are loading. This window will refresh automatically.")}`;
    const refreshKey = String(campaignId);
    if (campaignDetailRefreshKey !== refreshKey) {
      campaignDetailRefreshKey = refreshKey;
      campaignDetailRefreshAttempts = 0;
    }
    if (!campaignDetailRefreshTimer && campaignDetailRefreshAttempts < 2) {
      campaignDetailRefreshAttempts += 1;
      campaignDetailRefreshTimer = setTimeout(() => {
        campaignDetailRefreshTimer = null;
        if (currentCampaignDetailId === Number(campaignId)) {
          wbCampaignDetailCache.delete(String(campaignId));
          openCampaignDetailModal(campaignId, { silentRefresh: true }).catch(() => null);
        }
      }, 18000);
    }
  } else if (campaignDetailRefreshKey === String(campaignId)) {
    campaignDetailRefreshAttempts = 0;
  }
}

async function refreshCampaignDetails() {
  if (!currentCampaignDetailId) return;
  if (campaignDetailRefreshTimer) {
    clearTimeout(campaignDetailRefreshTimer);
    campaignDetailRefreshTimer = null;
  }
  campaignDetailRefreshKey = String(currentCampaignDetailId);
  campaignDetailRefreshAttempts = 0;
  wbCampaignDetailCache.delete(String(currentCampaignDetailId));
  await openCampaignDetailModal(currentCampaignDetailId);
}

async function applyCampaignAction(action) {
  if (!currentCampaignDetailId) return alert(tr("Кампания не выбрана", "Campaign is not selected"));
  const data = await withBusy(
    tr(`Выполняем ${action} для кампании ${currentCampaignDetailId}…`, `Running ${action} for campaign ${currentCampaignDetailId}...`),
    () => requestJson("/api/wb/ads/action", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ campaign_id: currentCampaignDetailId, action }),
      timeoutMs: 60000,
    }),
    tr("Операция отправляется в рекламный API WB.", "Operation is sent to WB Ads API.")
  ).catch((e) => {
    alert(e.message);
    return null;
  });
  if (!data) return;
  invalidateModuleCache("ads", "sales");
  alert(data.message || tr("Операция выполнена", "Operation completed"));
  await loadWbAdCampaigns();
  await refreshCampaignDetails();
}

window.refreshCampaignDetails = refreshCampaignDetails;
window.applyCampaignAction = applyCampaignAction;

async function loadWbCampaignRates() {
  if (!enabledModules.has("wb_ads")) return;
  const campaign_id = Number(document.getElementById("wbRateCampaignId")?.value || 0);
  if (!campaign_id) return alert(tr("Укажите campaign_id", "Specify campaign_id"));
  const campaign_type = document.getElementById("wbRateCampaignType")?.value || "search";
  const data = await withBusy(
    tr("Загружаем ставки кампании…", "Loading campaign rates..."),
    () => requestJson("/api/wb/ads/rates", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ campaign_id, campaign_type }),
      timeoutMs: 60000,
    }),
    tr("Запрос выполняется в рекламный API WB.", "Request is sent to WB Ads API.")
  ).catch((e) => {
    alert(e.message);
    return null;
  });
  if (!data) return;
  const holder = document.getElementById("wbAdsRatesResult");
  if (holder) holder.textContent = JSON.stringify(data, null, 2);
}

function computeAdsAnalyticsTotals(rows) {
  const out = {
    views: 0,
    clicks: 0,
    orders: 0,
    spent: 0,
    ctr: 0,
    cr: 0,
    cpc: 0,
    cpo: 0,
  };
  const list = Array.isArray(rows) ? rows : [];
  for (const row of list) {
    out.views += Number(row?.views || 0);
    out.clicks += Number(row?.clicks || 0);
    out.orders += Number(row?.orders || 0);
    out.spent += Number(row?.spent || 0);
  }
  out.views = Number.isFinite(out.views) ? out.views : 0;
  out.clicks = Number.isFinite(out.clicks) ? out.clicks : 0;
  out.orders = Number.isFinite(out.orders) ? out.orders : 0;
  out.spent = Number.isFinite(out.spent) ? out.spent : 0;
  out.ctr = out.views > 0 ? (out.clicks / out.views) * 100 : 0;
  out.cr = out.clicks > 0 ? (out.orders / out.clicks) * 100 : 0;
  out.cpc = out.clicks > 0 ? out.spent / out.clicks : 0;
  out.cpo = out.orders > 0 ? out.spent / out.orders : 0;
  return out;
}

function buildAdsAnalyticsSummaryText(meta, totals) {
  const periodFrom = String(meta?.date_from || "-");
  const periodTo = String(meta?.date_to || "-");
  const campaignsLoaded = Number(meta?.campaigns_loaded || 0);
  const campaignFilter = Number(meta?.campaign_id || 0);
  const analyticsMeta = meta?.analytics_meta && typeof meta.analytics_meta === "object" ? meta.analytics_meta : {};
  const lines = [
    `${tr("Период", "Period")}: ${periodFrom} - ${periodTo}`,
    `${tr("Кампаний в отчете", "Campaigns in report")}: ${formatInt(campaignsLoaded)}`,
    `${tr("Показы", "Views")}: ${formatInt(totals.views)}`,
    `${tr("Клики", "Clicks")}: ${formatInt(totals.clicks)}`,
    `${tr("Заказы", "Orders")}: ${formatInt(totals.orders)}`,
    `${tr("??????", "Spend")}: ${formatMoney(totals.spent)}`,
    `CTR: ${Number(totals.ctr || 0).toFixed(2)}%`,
    `CR: ${Number(totals.cr || 0).toFixed(2)}%`,
    `CPC: ${formatMoney(totals.cpc)}`,
    `CPO: ${formatMoney(totals.cpo)}`,
  ];
  if (campaignFilter > 0) {
    lines.unshift(`${tr("Фильтр campaign_id", "campaign_id filter")}: ${campaignFilter}`);
  }
  lines.push(...buildAdsAnalyticsMetaLines(analyticsMeta));
  return lines.join("\n");
}

function describeAdsAnalyticsWarning(code) {
  const key = String(code || "").trim().toLowerCase();
  if (key === "temporary_unavailable") {
    return tr("WB Ads временно не вернул пригодные детали по этому периоду.", "WB Ads temporarily returned no usable details for this period.");
  }
  if (key === "summary_partial") {
    return tr("Часть кампаний пока без нормальных названий или статусов.", "Some campaigns still have placeholder names or statuses.");
  }
  if (key === "stats_partial") {
    return tr("Часть кампаний пока без показов/кликов/расхода за выбранный период.", "Some campaigns still have no views/clicks/spend for the selected period.");
  }
  if (key === "base_fetch_failed") {
    return tr("Не удалось обновить базовый список кампаний.", "Base campaign list refresh failed.");
  }
  if (key === "summary_fetch_failed") {
    return tr("Не удалось догрузить реальные названия и статусы кампаний.", "Campaign names and statuses could not be enriched.");
  }
  if (key === "stats_fetch_failed") {
    return tr("Не удалось догрузить статистику кампаний из WB Ads.", "Campaign statistics could not be loaded from WB Ads.");
  }
  return key || "-";
}

function buildAdsAnalyticsMetaLines(meta) {
  if (!meta || typeof meta !== "object") return [];
  const lines = [];
  if (meta.temporary_unavailable) {
    lines.push(tr("WB Ads сейчас отдает только частичные данные. Таблица сохранена без обнуления уже загруженных строк.", "WB Ads is returning partial data right now. Existing rows are preserved instead of being blanked."));
  }
  const partialSummaryCount = Number(meta.partial_summary_count || 0);
  const partialStatsCount = Number(meta.partial_stats_count || 0);
  if (partialSummaryCount > 0) {
    lines.push(`${tr("Без полного названия или статуса", "Without full name/status")}: ${formatInt(partialSummaryCount)}`);
  }
  if (partialStatsCount > 0) {
    lines.push(`${tr("Без метрик за период", "Without period metrics")}: ${formatInt(partialStatsCount)}`);
  }
  const warnings = Array.isArray(meta.warnings)
    ? meta.warnings.map((code) => describeAdsAnalyticsWarning(code)).filter(Boolean)
    : [];
  if (warnings.length) {
    lines.push(`${tr("????????? ????????", "Load state")}: ${warnings.join(" | ")}`);
  }
  if (meta.refresh_queued) {
    lines.push(tr("\u0421\u0432\u0435\u0436\u0438\u0435 \u0434\u0435\u0442\u0430\u043b\u0438 \u0434\u043e\u0433\u0440\u0443\u0436\u0430\u044e\u0442\u0441\u044f \u0432 \u0444\u043e\u043d\u0435. \u0422\u0430\u0431\u043b\u0438\u0446\u0430 \u043e\u0431\u043d\u043e\u0432\u0438\u0442\u0441\u044f \u0430\u0432\u0442\u043e\u043c\u0430\u0442\u0438\u0447\u0435\u0441\u043a\u0438.", "Fresh details are loading in the background. The table will refresh automatically."));
  }
  const sourceParts = [];
  if (Array.isArray(meta.base_sources) && meta.base_sources.length) sourceParts.push(`base=${meta.base_sources.join(",")}`);
  if (Array.isArray(meta.summary_sources) && meta.summary_sources.length) sourceParts.push(`summary=${meta.summary_sources.join(",")}`);
  if (Array.isArray(meta.stats_sources) && meta.stats_sources.length) sourceParts.push(`stats=${meta.stats_sources.join(",")}`);
  if (sourceParts.length) {
    lines.push(`${tr("Источники кэша", "Cache sources")}: ${sourceParts.join("; ")}`);
  }
  const errors = Array.isArray(meta.errors) ? meta.errors.map((msg) => String(msg || "").trim()).filter(Boolean) : [];
  if (errors.length) {
    lines.push(`${tr("Ошибки", "Errors")}: ${errors.join(" | ")}`);
  }
  return lines;
}
function describeAdsAnalyticsLoadFailure(err) {
  const kind = String(err?.kind || "").trim().toLowerCase();
  const status = Number(err?.status || 0);
  if (kind === "timeout") {
    return tr("WB Ads не ответил вовремя. Уже загруженные строки сохранены, повторите запрос чуть позже.", "WB Ads timed out. Existing rows were preserved, please retry shortly.");
  }
  if (kind === "network") {
    return tr("Не удалось связаться с сервером WB Ads. Проверьте соединение и повторите загрузку.", "Could not reach WB Ads. Check the connection and retry.");
  }
  if (kind === "parse") {
    return tr("?????? ?????? ???????????? ????? WB Ads. ??????? ?????? ?? ???? ???????.", "Server returned a malformed WB Ads response. Existing rows were preserved.");
  }
  if (status >= 500) {
    return tr(`WB Ads временно недоступен (HTTP ${status}). Текущие строки не были очищены.`, `WB Ads is temporarily unavailable (HTTP ${status}). Existing rows were preserved.`);
  }
  if (status >= 400) {
    return tr(`WB Ads отклонил запрос (HTTP ${status}). Проверьте ключ API и выбранный период.`, `WB Ads rejected the request (HTTP ${status}). Check the API key and selected period.`);
  }
  return tr("Не удалось загрузить аналитику WB Ads. Уже загруженные строки сохранены.", "Failed to load WB Ads analytics. Existing rows were preserved.");
}
async function loadAdsAnalytics() {
  if (!enabledModules.has("wb_ads_analytics")) return;
  if (adsAnalyticsRefreshTimer) {
    clearTimeout(adsAnalyticsRefreshTimer);
    adsAnalyticsRefreshTimer = null;
  }
  const dateFrom = (document.getElementById("adsAnalyticsFrom")?.value || "").trim();
  const dateTo = (document.getElementById("adsAnalyticsTo")?.value || "").trim();
  const campaignId = Number(document.getElementById("adsAnalyticsCampaignId")?.value || 0);
  const totalBox = document.getElementById("adsAnalyticsTotals");
  const rawBox = document.getElementById("adsAnalyticsRaw");
  if (totalBox) totalBox.textContent = tr("Загружаем аналитику по кампаниям...", "Loading campaign analytics...");
  if (rawBox) rawBox.textContent = tr("Запрашиваем данные...", "Requesting data...");

  const pageLimit = 80;
  let offset = 0;
  let keepLoading = true;
  let page = 0;
  const mergedRows = [];
  let periodFrom = "";
  let periodTo = "";
  const mergedMeta = {
    requested_count: 0,
    summary_count: 0,
    stats_count: 0,
    partial_summary_count: 0,
    partial_stats_count: 0,
    partial_summary_ids: [],
    partial_stats_ids: [],
    temporary_unavailable: false,
    refresh_queued: false,
    warnings: new Set(),
    base_sources: new Set(),
    summary_sources: new Set(),
    stats_sources: new Set(),
    errors: new Set(),
  };
  while (keepLoading) {
    page += 1;
    const qp = new URLSearchParams();
    if (dateFrom) qp.set("date_from", dateFrom);
    if (dateTo) qp.set("date_to", dateTo);
    if (campaignId > 0) qp.set("campaign_id", String(campaignId));
    qp.set("offset", String(offset));
    qp.set("limit", String(pageLimit));
    if (totalBox) {
      totalBox.textContent = tr(
        `Загружаем аналитику: страница ${page} (offset ${offset})...`,
        `Loading analytics: page ${page} (offset ${offset})...`
      );
    }
    const data = await requestJson(`/api/wb/ads/analytics?${qp.toString()}`, {
      headers: authHeaders(),
      timeoutMs: 45000,
    }).catch((e) => {
      adsAnalyticsMeta = {
        temporary_unavailable: false,
        warnings: [],
        errors: [String(e?.message || tr("Ошибка загрузки аналитики.", "Analytics loading failed."))],
      };
      if (totalBox) totalBox.textContent = describeAdsAnalyticsLoadFailure(e);
      if (rawBox) {
        rawBox.textContent = JSON.stringify({
          error: {
            message: String(e?.message || ""),
            status: Number(e?.status || 0),
            kind: String(e?.kind || ""),
            url: String(e?.url || `/api/wb/ads/analytics?${qp.toString()}`),
            raw_text: String(e?.rawText || e?.raw_text || ""),
          },
          meta: adsAnalyticsMeta,
        }, null, 2);
      }
      return null;
    });
    if (!data) return;

    if (!periodFrom) periodFrom = String(data.date_from || "");
    if (!periodTo) periodTo = String(data.date_to || "");
    const rows = Array.isArray(data.rows) ? data.rows : [];
    const pageMeta = data?.meta && typeof data.meta === "object" ? data.meta : {};
    mergedRows.push(...rows);
    mergedMeta.requested_count += Number(pageMeta.requested_count || rows.length || 0);
    mergedMeta.summary_count += Number(pageMeta.summary_count || 0);
    mergedMeta.stats_count += Number(pageMeta.stats_count || 0);
    mergedMeta.partial_summary_count += Number(pageMeta.partial_summary_count || 0);
    mergedMeta.partial_stats_count += Number(pageMeta.partial_stats_count || 0);
    mergedMeta.temporary_unavailable = mergedMeta.temporary_unavailable || Boolean(pageMeta.temporary_unavailable);
    mergedMeta.refresh_queued = mergedMeta.refresh_queued || Boolean(pageMeta.refresh_queued);
    if (Array.isArray(pageMeta.partial_summary_ids)) mergedMeta.partial_summary_ids.push(...pageMeta.partial_summary_ids.map((x) => Number(x || 0)).filter((x) => Number.isFinite(x) && x > 0));
    if (Array.isArray(pageMeta.partial_stats_ids)) mergedMeta.partial_stats_ids.push(...pageMeta.partial_stats_ids.map((x) => Number(x || 0)).filter((x) => Number.isFinite(x) && x > 0));
    if (Array.isArray(pageMeta.warnings)) pageMeta.warnings.forEach((code) => mergedMeta.warnings.add(String(code || "").trim()));
    if (pageMeta.base_source) mergedMeta.base_sources.add(String(pageMeta.base_source || "").trim());
    if (pageMeta.summary_source) mergedMeta.summary_sources.add(String(pageMeta.summary_source || "").trim());
    if (pageMeta.stats_source) mergedMeta.stats_sources.add(String(pageMeta.stats_source || "").trim());
    if (pageMeta.base_error) mergedMeta.errors.add(String(pageMeta.base_error || "").trim());
    if (pageMeta.summary_error) mergedMeta.errors.add(String(pageMeta.summary_error || "").trim());
    if (pageMeta.stats_error) mergedMeta.errors.add(String(pageMeta.stats_error || "").trim());
    if (campaignId > 0) {
      keepLoading = false;
    } else {
      keepLoading = rows.length >= pageLimit;
      offset += pageLimit;
      if (offset >= 10000) keepLoading = false;
    }
  }

  adsAnalyticsRows = mergedRows.slice().sort((a, b) => Number(b?.spent || 0) - Number(a?.spent || 0));
  refreshWbBidderCampaignHints();
  adsAnalyticsMeta = {
    requested_count: mergedMeta.requested_count,
    summary_count: mergedMeta.summary_count,
    stats_count: mergedMeta.stats_count,
    partial_summary_count: mergedMeta.partial_summary_count,
    partial_stats_count: mergedMeta.partial_stats_count,
    partial_summary_ids: [...new Set(mergedMeta.partial_summary_ids)].slice(0, 160),
    partial_stats_ids: [...new Set(mergedMeta.partial_stats_ids)].slice(0, 160),
    temporary_unavailable: mergedMeta.temporary_unavailable,
    refresh_queued: mergedMeta.refresh_queued,
    warnings: [...mergedMeta.warnings].filter(Boolean),
    base_sources: [...mergedMeta.base_sources].filter(Boolean),
    summary_sources: [...mergedMeta.summary_sources].filter(Boolean),
    stats_sources: [...mergedMeta.stats_sources].filter(Boolean),
    errors: [...mergedMeta.errors].filter(Boolean),
  };
  const totals = computeAdsAnalyticsTotals(adsAnalyticsRows);
  if (totalBox) {
    totalBox.textContent = buildAdsAnalyticsSummaryText(
      {
        date_from: periodFrom || dateFrom || "-",
        date_to: periodTo || dateTo || "-",
        campaigns_loaded: adsAnalyticsRows.length,
        campaign_id: campaignId,
        analytics_meta: adsAnalyticsMeta,
      },
      totals
    );
  }
  if (rawBox) {
    rawBox.textContent = JSON.stringify(
      {
        date_from: periodFrom || dateFrom || null,
        date_to: periodTo || dateTo || null,
        campaign_id: campaignId > 0 ? campaignId : null,
        campaigns_loaded: adsAnalyticsRows.length,
        totals,
        meta: adsAnalyticsMeta,
        rows: adsAnalyticsRows,
      },
      null,
      2
    );
  }
  renderAdsAnalyticsRows();
  markModuleLoaded("ads");
  const refreshSignature = `${dateFrom}|${dateTo}|${campaignId}`;
  if (adsAnalyticsMeta.refresh_queued) {
    if (adsAnalyticsRefreshSignature !== refreshSignature) {
      adsAnalyticsRefreshSignature = refreshSignature;
      adsAnalyticsRefreshAttempts = 0;
    }
    if (adsAnalyticsRefreshAttempts < 2 && !adsAnalyticsRefreshTimer) {
      adsAnalyticsRefreshAttempts += 1;
      adsAnalyticsRefreshTimer = setTimeout(() => {
        adsAnalyticsRefreshTimer = null;
        if (enabledModules.has("wb_ads_analytics")) {
          loadAdsAnalytics().catch(() => null);
        }
      }, 18000);
    }
  } else if (adsAnalyticsRefreshSignature === refreshSignature) {
    adsAnalyticsRefreshAttempts = 0;
  }
}

function renderAdsAnalyticsRows() {
  const tbody = document.getElementById("adsAnalyticsTable");
  if (!tbody) return;
  tbody.innerHTML = "";
  if (!adsAnalyticsRows.length) {
    const rowEl = document.createElement("tr");
    const emptyMessage = adsAnalyticsMeta?.temporary_unavailable
      ? (currentLang === "en" ? "WB Ads temporarily returned no usable analytics for this period." : "WB Ads временно не вернул пригодную аналитику за этот период.")
      : (Array.isArray(adsAnalyticsMeta?.errors) && adsAnalyticsMeta.errors.length
        ? adsAnalyticsMeta.errors[0]
        : (currentLang === "en" ? "No data." : "Нет данных."));
    rowEl.innerHTML = `<td colspan="12">${escapeHtml(emptyMessage)}</td>`;
    tbody.appendChild(rowEl);
    return;
  }
  for (const row of adsAnalyticsRows) {
    const rowCampaignId = String(row.campaign_id ?? row.id ?? "").trim();
    const rowName = safeCampaignName(row, rowCampaignId);
    const ctrVal = parseCampaignMetric(row, "ctr", 2);
    const rowEl = document.createElement("tr");
    const rowWarnings = [];
    if (row.summary_has_context === false) rowWarnings.push(currentLang === "en" ? "Name/status still partial" : "Название/статус ещё частичные");
    if (row.stat_has_context === false) rowWarnings.push(currentLang === "en" ? "Metrics not loaded for selected period" : "Метрики за период не загружены");
    if (rowWarnings.length) rowEl.title = rowWarnings.join(" • ");
    rowEl.innerHTML = `
      <td>${escapeHtml(row.campaign_id ?? "-")}</td>
      <td>${escapeHtml(rowName)}</td>
      <td>${escapeHtml(normalizeCampaignStatus(row.status ?? "-"))}</td>
      <td>${escapeHtml(normalizeCampaignType(row.type ?? "-"))}</td>
      <td>${escapeHtml(String(row.budget ?? "-"))}</td>
      <td>${escapeHtml(parseCampaignMetric(row, "views"))}</td>
      <td>${escapeHtml(parseCampaignMetric(row, "clicks"))}</td>
      <td>${escapeHtml(ctrVal === "-" ? "-" : `${ctrVal}%`)}</td>
      <td>${escapeHtml(parseCampaignMetric(row, "orders"))}</td>
      <td>${escapeHtml(parseCampaignMetric(row, "spent", 2))}</td>
      <td>${escapeHtml(parseCampaignMetric(row, "cpc", 2))}</td>
      <td>${escapeHtml(parseCampaignMetric(row, "cpo", 2))}</td>
    `;
    rowEl.onclick = () => {
      const cid = Number(row?.campaign_id || 0);
      if (cid <= 0) return;
      const analyticsInput = document.getElementById("adsAnalyticsCampaignId");
      if (analyticsInput) analyticsInput.value = String(cid);
      const rateInput = document.getElementById("wbRateCampaignId");
      if (rateInput) rateInput.value = String(cid);
      selectedWbCampaignId = String(cid);
      renderWbCampaignRows();
    };
    tbody.appendChild(rowEl);
  }
}

function updateAdsRecLoadStatus(message = "") {
  const holder = document.getElementById("adsRecLoadStatus");
  if (!holder) return;
  if (message) {
    holder.innerHTML = buildLoadStatusHtml({
      title: message,
      loaded: adsRecLoadProgress.loaded || 0,
      total: adsRecLoadProgress.total || 0,
      active: adsRecLoadProgress.active,
    });
    return;
  }
  const { active, total, loaded } = adsRecLoadProgress;
  if (!active && !total) {
    holder.textContent = "-";
    return;
  }
  holder.innerHTML = buildLoadStatusHtml({
    title: active
      ? tr("Догрузка рекомендаций", "Loading recommendations")
      : tr("???????????? ?????????", "Recommendations loaded"),
    loaded,
    total,
    active,
  });
}

function updateSalesLoadStatus(message = "") {
  const holder = document.getElementById("salesLoadStatus");
  if (!holder) return;
  if (message) {
    holder.innerHTML = buildLoadStatusHtml({
      title: message,
      loaded: salesLoadProgress.loaded || 0,
      total: salesLoadProgress.total || 0,
      active: salesLoadProgress.active,
    });
    return;
  }
  const { active, total, loaded } = salesLoadProgress;
  if (!active && !total) {
    holder.textContent = "-";
    return;
  }
  const state = salesLoadState || "idle";
  const title = active
    ? tr("Загрузка статистики продаж", "Loading sales statistics")
    : (state === "error"
      ? tr("Ошибка загрузки статистики продаж", "Sales statistics loading failed")
      : (state === "partial"
        ? tr("?????????? ?????? ????????? ????????", "Sales statistics partially loaded")
        : tr("?????????? ?????? ?????????", "Sales statistics loaded")));
  const fixedTitle = currentLang === "en"
    ? title
    : (active
      ? "\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430 \u0441\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043a\u0438 \u043f\u0440\u043e\u0434\u0430\u0436"
      : (state === "error"
        ? "\u041e\u0448\u0438\u0431\u043a\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043a\u0438 \u0441\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043a\u0438 \u043f\u0440\u043e\u0434\u0430\u0436"
        : (state === "partial" ? "\u0421\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043a\u0430 \u043f\u0440\u043e\u0434\u0430\u0436 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043d\u0430 \u0447\u0430\u0441\u0442\u0438\u0447\u043d\u043e" : "\u0421\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043a\u0430 \u043f\u0440\u043e\u0434\u0430\u0436 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043d\u0430")));
  holder.innerHTML = buildLoadStatusHtml({
    title: fixedTitle,
    loaded,
    total,
    active,
  });
}

function renderAdsRecommendationsMeta(payload) {
  const host = document.getElementById("adsRecMeta");
  if (!host) return;
  if (!payload || typeof payload !== "object") {
    host.innerHTML = `<div class="hint">-</div>`;
    return;
  }
  if (payload.error) {
    host.innerHTML = `<div class="help-callout warn"><strong>${escapeHtml(String(payload.error))}</strong></div>`;
    return;
  }
  const rows = [
    [tr("Период", "Period"), `${payload.date_from || "-"} - ${payload.date_to || "-"}`],
    [tr("Проверено кампаний", "Scanned campaigns"), `${formatInt(payload.campaigns_scanned || 0)} / ${formatInt(payload.total_campaigns || 0)}`],
    [tr("Мин. расход", "Min spend"), formatMoney(payload.min_spent || 0)],
    [tr("????????????", "Recommendations"), formatInt(payload.recommendations || 0)],
  ];
  if (Number(payload.high || 0) || Number(payload.medium || 0) || Number(payload.low || 0)) {
    rows.push([tr("Высокий приоритет", "High priority"), formatInt(payload.high || 0)]);
    rows.push([tr("??????? ?????????", "Medium priority"), formatInt(payload.medium || 0)]);
    rows.push([tr("Низкий приоритет", "Low priority"), formatInt(payload.low || 0)]);
  }
  host.innerHTML = `
    <div class="ads-rec-meta-grid">
      ${rows.map(([label, value]) => `<article class="ads-rec-kv"><span>${escapeHtml(String(label))}</span><strong>${escapeHtml(String(value))}</strong></article>`).join("")}
    </div>
    ${payload.note ? `<div class="hint">${escapeHtml(String(payload.note))}</div>` : ""}
  `;
}

function renderAdsRecommendationsInsights() {
  const host = document.getElementById("adsRecInsights");
  if (!host) return;
  if (!Array.isArray(adsRecommendationRows) || !adsRecommendationRows.length) {
    host.innerHTML = `<div class="hint">${
      currentLang === "en"
        ? "No recommendation cards yet. Build recommendations for selected dates."
        : "Карточки рекомендаций пока пусты. Постройте рекомендации за выбранный период."
    }</div>`;
    return;
  }
  const topRows = adsRecommendationRows.slice(0, 8);
  host.innerHTML = topRows.map((row) => {
    const rowCampaignId = String(row?.campaign_id || row?.id || "").trim();
    const rowName = safeCampaignName(row, rowCampaignId);
    const prio = String(row?.priority || "low").toLowerCase();
    const prioLabel = prio === "high"
      ? tr("Высокий", "High")
      : (prio === "medium" ? tr("???????", "Medium") : tr("??????", "Low"));
    const views = Number(row?.views || 0);
    const clicks = Number(row?.clicks || 0);
    const orders = Number(row?.orders || 0);
    const spent = Number(row?.spent || 0);
    const metricBits = [
      `${tr("Показы", "Views")}: ${formatInt(Number.isFinite(views) ? views : 0)}`,
      `${tr("Клики", "Clicks")}: ${formatInt(Number.isFinite(clicks) ? clicks : 0)}`,
      `${tr("Заказы", "Orders")}: ${formatInt(Number.isFinite(orders) ? orders : 0)}`,
      `${tr("??????", "Spend")}: ${formatMoney(Number.isFinite(spent) ? spent : 0)}`,
    ];
    return `
      <article class="ads-rec-insight-card ${escapeHtml(prio)}">
        <header>
          <strong>#${escapeHtml(String(row?.campaign_id || "-"))} ${escapeHtml(rowName)}</strong>
          <span>${escapeHtml(prioLabel)}</span>
        </header>
        <div class="ads-rec-insight-title">${escapeHtml(String(row?.recommendation || "-"))}</div>
        <div class="ads-rec-insight-reason">${escapeHtml(String(row?.reason || "-"))}</div>
        <div class="ads-rec-insight-metrics">${metricBits.map((x) => `<span>${escapeHtml(x)}</span>`).join("")}</div>
      </article>
    `;
  }).join("");
}

async function loadAdsRecommendations() {
  if (!enabledModules.has("wb_ads_recommendations")) return;
  adsRecLoadToken += 1;
  const runToken = adsRecLoadToken;
  const dateFrom = (document.getElementById("adsRecFrom")?.value || "").trim();
  const dateTo = (document.getElementById("adsRecTo")?.value || "").trim();
  const minSpent = Number(document.getElementById("adsRecMinSpent")?.value || 0);
  const qpBase = new URLSearchParams();
  if (dateFrom) qpBase.set("date_from", dateFrom);
  if (dateTo) qpBase.set("date_to", dateTo);
  if (Number.isFinite(minSpent)) qpBase.set("min_spent", String(Math.max(0, minSpent)));

  renderAdsRecommendationsMeta({
    date_from: dateFrom || "-",
    date_to: dateTo || "-",
    campaigns_scanned: 0,
    total_campaigns: 0,
    min_spent: Number.isFinite(minSpent) ? minSpent : 0,
    recommendations: 0,
    note: tr("Загружаем рекомендации...", "Loading recommendations..."),
  });
  adsRecommendationRows = [];
  renderAdsRecommendationsRows();
  renderAdsRecommendationsInsights();
  adsRecLoadProgress = { active: true, total: 0, loaded: 0 };
  updateAdsRecLoadStatus(tr("Запрашиваем рекомендации...", "Requesting recommendations..."));

  const pageLimit = 80;
  let offset = 0;
  let keepLoading = true;
  let seenTotal = 0;
  let scanned = 0;
  let finalDateFrom = dateFrom;
  let finalDateTo = dateTo;
  let fallbackMode = false;
  let partialLoadWarning = "";
  while (keepLoading) {
    if (runToken !== adsRecLoadToken) return;
    const qp = new URLSearchParams(qpBase);
    qp.set("offset", String(offset));
    qp.set("limit", String(pageLimit));
    let data = null;
    let lastError = "";
    for (let attempt = 0; attempt < 2; attempt += 1) {
      data = await requestJson(`/api/wb/ads/recommendations?${qp.toString()}`, {
        headers: authHeaders(),
        timeoutMs: 120000,
      }).catch((e) => {
        lastError = String(e?.message || "");
        return null;
      });
      if (data) break;
      if (attempt < 1) {
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
    }
    if (!data || runToken !== adsRecLoadToken) {
      partialLoadWarning = tr(
        `Часть рекомендаций не загрузилась (offset ${offset}).`,
        `Part of recommendations failed to load (offset ${offset}).`
      );
      if (lastError && !adsRecommendationRows.length) {
        adsRecLoadProgress = { active: false, total: Math.max(0, seenTotal), loaded: Math.max(0, scanned) };
        updateAdsRecLoadStatus(tr("???????????? ???????? ??????????.", "Recommendations are temporarily unavailable."));
        renderAdsRecommendationsMeta({
          error: tr(
            "???????????? ???? ??????????. ????????? API-???? ? ??????, ????? ???????? ??????.",
            "Recommendations are currently unavailable. Check API key and date range, then refresh the module."
          ),
        });
        return;
      }
      break;
    }

    const batchRows = Array.isArray(data.rows)
      ? data.rows
      : (Array.isArray(data.recommendations) ? data.recommendations : []);
    adsRecommendationRows.push(...batchRows);
    const info = data.meta || {};
    finalDateFrom = data.date_from || finalDateFrom;
    finalDateTo = data.date_to || finalDateTo;
    fallbackMode = fallbackMode || Boolean(info.fallback_mode);
    seenTotal = Math.max(
      seenTotal,
      Number(info.total_campaigns || 0),
      Number(info.campaigns_scanned || 0),
      offset + pageLimit
    );
    scanned = Math.max(scanned, Number(info.campaigns_scanned || (offset + batchRows.length)));
    adsRecLoadProgress = {
      active: true,
      total: Math.max(0, seenTotal),
      loaded: Math.max(0, scanned),
    };
    updateAdsRecLoadStatus();
    renderAdsRecommendationsRows();
    renderAdsRecommendationsInsights();
    keepLoading = Boolean(info.has_more);
    const nextOffset = Number(info.next_offset ?? (offset + pageLimit));
    offset = Number.isFinite(nextOffset) && nextOffset > offset ? nextOffset : (offset + pageLimit);
    if (!keepLoading) break;
  }

  const weight = { high: 3, medium: 2, low: 1 };
  adsRecommendationRows.sort((a, b) => {
    const pa = weight[String(a?.priority || "").toLowerCase()] || 0;
    const pb = weight[String(b?.priority || "").toLowerCase()] || 0;
    if (pb !== pa) return pb - pa;
    return Number(b?.spent || 0) - Number(a?.spent || 0);
  });
  const prioCounts = adsRecommendationRows.reduce((acc, row) => {
    const key = String(row?.priority || "low").toLowerCase();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, { high: 0, medium: 0, low: 0 });
  const explain = adsRecommendationRows.length
    ? tr("???????????? ???????????? ? ???? ???????? ? ???????. ??????? ? ???????? ??????????.", "Recommendations are ready in cards and table. Start with high priority.")
    : tr(
      "??? ??????? ????????????. ?????? ?????? ??????????? ?????????? ??? ??????????? ?????? ?? ??????.",
      "No actionable recommendations. Service returned neutral or insufficient data for selected period."
    );
  const finalMeta = {
    date_from: finalDateFrom || dateFrom,
    date_to: finalDateTo || dateTo,
    campaigns_scanned: scanned,
    total_campaigns: seenTotal,
    min_spent: Number.isFinite(minSpent) ? minSpent : 0,
    recommendations: adsRecommendationRows.length,
    high: prioCounts.high || 0,
    medium: prioCounts.medium || 0,
    low: prioCounts.low || 0,
    note: `${explain}${
      fallbackMode ? ` ${tr("Часть строк собрана в fallback-режиме.", "Some rows are generated in fallback mode.")}` : ""
    }${
      partialLoadWarning ? ` ${partialLoadWarning}` : ""
    }`,
  };
  adsRecLoadProgress = {
    active: false,
    total: Math.max(0, seenTotal),
    loaded: Math.max(0, scanned),
  };
  if (partialLoadWarning) {
    updateAdsRecLoadStatus(tr("Загрузка завершена частично.", "Load completed partially."));
  } else {
    updateAdsRecLoadStatus();
  }
  renderAdsRecommendationsMeta(finalMeta);
  renderAdsRecommendationsRows();
  renderAdsRecommendationsInsights();
  markModuleLoaded("ads");
}

function renderAdsRecommendationsRows() {
  const tbody = document.getElementById("adsRecTable");
  if (!tbody) return;
  tbody.innerHTML = "";
  if (!adsRecommendationRows.length) {
    const rowEl = document.createElement("tr");
    rowEl.innerHTML = `<td colspan="14">${escapeHtml(tr("За выбранный период рекомендаций нет.", "No recommendations for selected period."))}</td>`;
    tbody.appendChild(rowEl);
    return;
  }
  for (const row of adsRecommendationRows) {
    const rowCampaignId = String(row.campaign_id ?? row.id ?? "").trim();
    const rowName = safeCampaignName(row, rowCampaignId);
    const ctrVal = parseCampaignMetric(row, "ctr", 2);
    const actionCode = String(row.action || "").trim();
    const actionLabel = actionCode
      ? ` (${actionCode})`
      : "";
    const priorityRaw = String(row.priority || "low").toLowerCase();
    const priorityLabel = priorityRaw === "high"
      ? tr("Высокий", "High")
      : (priorityRaw === "medium" ? tr("???????", "Medium") : tr("??????", "Low"));
    const rowEl = document.createElement("tr");
    rowEl.innerHTML = `
      <td>${escapeHtml(row.campaign_id ?? "-")}</td>
      <td>${escapeHtml(rowName)}</td>
      <td>${escapeHtml(normalizeCampaignStatus(row.status ?? "-"))}</td>
      <td>${escapeHtml(normalizeCampaignType(row.type ?? "-"))}</td>
      <td>${escapeHtml(parseCampaignMetric(row, "views"))}</td>
      <td>${escapeHtml(parseCampaignMetric(row, "clicks"))}</td>
      <td>${escapeHtml(ctrVal === "-" ? "-" : `${ctrVal}%`)}</td>
      <td>${escapeHtml(parseCampaignMetric(row, "orders"))}</td>
      <td>${escapeHtml(parseCampaignMetric(row, "spent", 2))}</td>
      <td>${escapeHtml(parseCampaignMetric(row, "cpc", 2))}</td>
      <td>${escapeHtml(parseCampaignMetric(row, "cpo", 2))}</td>
      <td>${escapeHtml(priorityLabel)}</td>
      <td>${escapeHtml(String(row.recommendation || "-") + actionLabel)}</td>
      <td>${escapeHtml(row.reason ?? "-")}</td>
    `;
    tbody.appendChild(rowEl);
  }
}

function getCampaignLookupRow(campaignId) {
  const key = String(campaignId || "").trim();
  if (!key) return null;
  return wbCampaignRows.find((row) => getCampaignRowId(row) === key)
    || adsAnalyticsRows.find((row) => String(row?.campaign_id || row?.id || "").trim() === key)
    || null;
}

function getCampaignLookupName(campaignId) {
  const key = String(campaignId || "").trim();
  if (!key) return "";
  const row = getCampaignLookupRow(key);
  if (!row || typeof row !== "object") return "";
  return safeCampaignName(row, key, { fallback: false });
}

function refreshWbBidderCampaignHints() {
  const host = document.getElementById("wbBidderCampaignHints");
  if (!host) return;
  const rows = [...wbCampaignRows, ...adsAnalyticsRows];
  const seen = new Set();
  const options = [];
  for (const row of rows) {
    const id = String(getCampaignRowId(row) || row?.campaign_id || row?.id || "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const name = getCampaignLookupName(id) || campaignFallbackName(id);
    const status = normalizeCampaignStatus(row?.status || row?.state || "-");
    const type = normalizeCampaignType(row?.type || row?.adType || row?.campaignType || row?.typeId || "-");
    const meta = [name, status, type].filter((part) => String(part || "").trim() && String(part || "").trim() !== "-");
    options.push(`<option value="${escapeHtml(id)}" label="${escapeHtml(meta.join(" | "))}"></option>`);
  }
  host.innerHTML = options.join("");
}

function setWbBidderStatus(message = "-", tone = "") {
  const box = document.getElementById("wbBidderStatus");
  if (!box) return;
  box.classList.remove("ads-bidder-status-ok", "ads-bidder-status-error", "ads-bidder-status-skipped");
  if (tone === "ok") box.classList.add("ads-bidder-status-ok");
  if (tone === "error") box.classList.add("ads-bidder-status-error");
  if (tone === "skipped") box.classList.add("ads-bidder-status-skipped");
  box.textContent = String(message || "-");
}

function applyWbBidderFieldHints() {
  const isEn = currentLang === "en";
  const setInputHint = (id, placeholder, title = "") => {
    const el = document.getElementById(id);
    if (!el) return;
    if (typeof placeholder === "string") el.placeholder = placeholder;
    if (title) el.title = title;
  };
  const setOptionText = (id, map) => {
    const el = document.getElementById(id);
    if (!el || !map || typeof map !== "object") return;
    [...el.options].forEach((opt) => {
      const key = String(opt?.value || "").trim();
      if (!key || !map[key]) return;
      opt.textContent = map[key];
    });
  };
  const ensureFieldCard = (id, titleText, noteText = "") => {
    const input = document.getElementById(id);
    if (!input) return;
    let card = input.closest(".ads-bidder-field");
    if (!card) {
      card = document.createElement("div");
      card.className = "ads-bidder-field";
      if (input.parentNode) {
        input.parentNode.insertBefore(card, input);
      }
      card.appendChild(input);
    }
    let titleEl = card.querySelector(".ads-bidder-field-title");
    if (!titleEl) {
      titleEl = document.createElement("div");
      titleEl.className = "ads-bidder-field-title";
      card.insertBefore(titleEl, input);
    }
    titleEl.textContent = titleText;
    let noteEl = card.querySelector(".ads-bidder-field-note");
    const safeNote = String(noteText || "").trim();
    if (safeNote) {
      if (!noteEl) {
        noteEl = document.createElement("div");
        noteEl.className = "ads-bidder-field-note";
        card.appendChild(noteEl);
      }
      noteEl.textContent = safeNote;
    } else if (noteEl) {
      noteEl.remove();
    }
  };

  setInputHint(
    "wbBidderCampaignId",
    isEn ? "WB campaign ID from campaign list" : "ID кампании WB из списка кампаний",
    isEn ? "Numeric campaign id from WB Ads campaigns table" : "Числовой ID кампании из таблицы рекламных кампаний"
  );
  setInputHint(
    "wbBidderNmId",
    isEn ? "Product nmID" : "nmID карточки товара",
    isEn ? "nmID of the product card the rule controls" : "nmID карточки товара, для которой действует правило"
  );
  setInputHint("wbBidderTargetValue", isEn ? "Search phrase for normquery mode" : "Поисковая фраза для режима normquery");
  setInputHint("wbBidderDesiredBid", isEn ? "Target bid, RUB" : "Целевая ставка, ₽");
  setInputHint("wbBidderMinBid", isEn ? "Minimum bid, RUB" : "Минимальная ставка, ₽");
  setInputHint("wbBidderMaxBid", isEn ? "Maximum bid, RUB" : "Максимальная ставка, ₽");
  setInputHint("wbBidderStepBid", isEn ? "Bid change step, RUB" : "Шаг изменения ставки, ₽");
  setInputHint("wbBidderPosFrom", isEn ? "Target position from" : "Целевая позиция от");
  setInputHint("wbBidderPosTo", isEn ? "Target position to" : "Целевая позиция до");
  setInputHint("wbBidderMinClicks", isEn ? "Min clicks before auto-step" : "Мин. кликов для автошага");
  setInputHint("wbBidderCooldownSec", isEn ? "Cooldown between runs, sec" : "Интервал между пересчетами, сек");
  setInputHint("wbBidderNotes", isEn ? "Rule note (optional)" : "Комментарий к правилу (опционально)");

  setOptionText("wbBidderTargetKind", {
    normquery: isEn ? "Search phrase (normquery)" : "Поисковая фраза (normquery)",
    nm: isEn ? "Product card (nm)" : "Карточка товара (nm)",
  });
  setOptionText("wbBidderPlacement", {
    search: isEn ? "Search only" : "Только поиск",
    recommendations: isEn ? "Recommendations only" : "Только рекомендации",
    combined: isEn ? "Search + recommendations" : "Поиск + рекомендации",
  });
  setOptionText("wbBidderStrategy", {
    optimal: isEn ? "Optimal (auto balance)" : "Optimal (авто баланс)",
    position: isEn ? "Position hold" : "Position (держать позицию)",
    range: isEn ? "Range hold" : "Range (держать диапазон)",
    hold: isEn ? "Hold fixed bid" : "Hold (фиксированная ставка)",
  });

  ensureFieldCard("wbBidderCampaignId", isEn ? "Campaign ID" : "ID кампании", isEn ? "Select from campaign list to avoid mismatch." : "Выбирайте ID из списка кампаний, чтобы не ошибиться.");
  ensureFieldCard("wbBidderNmId", isEn ? "Product nmID" : "nmID карточки товара", isEn ? "Use nmID from the same campaign." : "Укажите nmID из этой же кампании.");
  ensureFieldCard("wbBidderTargetKind", isEn ? "Target type" : "Тип цели");
  ensureFieldCard("wbBidderTargetValue", isEn ? "Search phrase (for normquery)" : "Поисковая фраза (для normquery)", isEn ? "Used only in normquery mode." : "Используется только в режиме normquery.");
  ensureFieldCard("wbBidderPlacement", isEn ? "Placement" : "Площадка");
  ensureFieldCard("wbBidderStrategy", isEn ? "Strategy" : "Стратегия");
  ensureFieldCard("wbBidderDesiredBid", isEn ? "Target bid, RUB" : "Целевая ставка, ₽");
  ensureFieldCard("wbBidderMinBid", isEn ? "Minimum bid, RUB" : "Минимальная ставка, ₽");
  ensureFieldCard("wbBidderMaxBid", isEn ? "Maximum bid, RUB" : "Максимальная ставка, ₽");
  ensureFieldCard("wbBidderStepBid", isEn ? "Bid step, RUB" : "Шаг изменения ставки, ₽", isEn ? "How much to increase/decrease bid per step." : "На сколько рублей повышать/понижать ставку за шаг.");
  ensureFieldCard("wbBidderPosFrom", isEn ? "Target position from" : "Целевая позиция от", isEn ? "Lower bound of desired position range." : "Нижняя граница желаемого диапазона позиции.");
  ensureFieldCard("wbBidderPosTo", isEn ? "Target position to" : "Целевая позиция до", isEn ? "Upper bound of desired position range." : "Верхняя граница желаемого диапазона позиции.");
  ensureFieldCard("wbBidderMinClicks", isEn ? "Minimum clicks" : "Минимум кликов", isEn ? "0 means no clicks threshold." : "0 = без порога по кликам.");
  ensureFieldCard("wbBidderCooldownSec", isEn ? "Cooldown, sec" : "Интервал пересчета, сек", isEn ? "Pause between auto-runs for one rule." : "Пауза между автозапусками одного правила.");
  ensureFieldCard("wbBidderNotes", isEn ? "Comment" : "Комментарий", isEn ? "Optional note for your team." : "Опциональная пометка для команды.");

  const hint = document.getElementById("wbBidderFieldsHint");
  if (hint) {
    hint.textContent = isEn
      ? "campaign_id = campaign ID, nmID = product card ID. Step/position/clicks/cooldown are optimization controls. Bid values are in RUB."
      : "campaign_id = ID кампании, nmID = ID карточки товара. Шаг, позиция, клики и cooldown управляют оптимизацией. Ставки указываются в рублях.";
  }
}

function syncWbBidderTargetKindUi() {
  applyWbBidderFieldHints();
  const kind = String(document.getElementById("wbBidderTargetKind")?.value || "normquery").trim().toLowerCase();
  const targetValueEl = document.getElementById("wbBidderTargetValue");
  if (!targetValueEl) return;
  if (kind === "nm") {
    targetValueEl.disabled = true;
    targetValueEl.placeholder = tr("Для режима «Карточка (nm)» не используется", "Not used in product-card (nm) mode");
    targetValueEl.title = tr("Поле фразы работает только для режима normquery.", "Phrase field is used only for normquery mode.");
    targetValueEl.value = "";
    return;
  }
  targetValueEl.disabled = false;
  targetValueEl.placeholder = tr("Поисковая фраза (режим normquery)", "Search phrase (normquery mode)");
  targetValueEl.title = tr("Укажите фразу, по которой нужно держать ставку/позицию.", "Set phrase used to control bid/position.");
}
function resetWbBidderForm() {
  const defaults = [
    ["wbBidderRuleId", ""],
    ["wbBidderCampaignId", ""],
    ["wbBidderNmId", ""],
    ["wbBidderTargetKind", "normquery"],
    ["wbBidderTargetValue", ""],
    ["wbBidderPlacement", "search"],
    ["wbBidderStrategy", "optimal"],
    ["wbBidderDesiredBid", ""],
    ["wbBidderMinBid", ""],
    ["wbBidderMaxBid", ""],
    ["wbBidderStepBid", "100"],
    ["wbBidderPosFrom", "1"],
    ["wbBidderPosTo", "5"],
    ["wbBidderMinClicks", "0"],
    ["wbBidderCooldownSec", "300"],
    ["wbBidderNotes", ""],
  ];
  for (const [id, value] of defaults) {
    const el = document.getElementById(id);
    if (el) el.value = value;
  }
  const activeEl = document.getElementById("wbBidderIsActive");
  if (activeEl) activeEl.checked = true;
  syncWbBidderTargetKindUi();
}

function fillWbBidderForm(row) {
  if (!row || typeof row !== "object") return;
  const values = [
    ["wbBidderRuleId", String(row.id || "")],
    ["wbBidderCampaignId", String(row.campaign_id || "")],
    ["wbBidderNmId", String(row.nm_id || "")],
    ["wbBidderTargetKind", String(row.target_kind || "normquery")],
    ["wbBidderTargetValue", String(row.target_value || "")],
    ["wbBidderPlacement", String(row.placement || "search")],
    ["wbBidderStrategy", String(row.strategy || "optimal")],
    ["wbBidderDesiredBid", String(row.desired_bid || "")],
    ["wbBidderMinBid", String(row.min_bid || "")],
    ["wbBidderMaxBid", String(row.max_bid || "")],
    ["wbBidderStepBid", String(row.step_bid || "100")],
    ["wbBidderPosFrom", String(row.target_pos_from || "1")],
    ["wbBidderPosTo", String(row.target_pos_to || "5")],
    ["wbBidderMinClicks", String(row.min_clicks || "0")],
    ["wbBidderCooldownSec", String(row.cooldown_sec || "300")],
    ["wbBidderNotes", String(row.notes || "")],
  ];
  for (const [id, value] of values) {
    const el = document.getElementById(id);
    if (el) el.value = value;
  }
  const activeEl = document.getElementById("wbBidderIsActive");
  if (activeEl) activeEl.checked = Boolean(row.is_active);
  syncWbBidderTargetKindUi();
}

function collectWbBidderPayload() {
  const asInt = (id, fallback = 0) => {
    const num = Number(document.getElementById(id)?.value || fallback);
    return Number.isFinite(num) ? Math.trunc(num) : fallback;
  };
  const asFloat = (id, fallback = 0) => {
    const num = Number(document.getElementById(id)?.value || fallback);
    return Number.isFinite(num) ? num : fallback;
  };
  return {
    campaign_id: asInt("wbBidderCampaignId", 0),
    nm_id: asInt("wbBidderNmId", 0),
    target_kind: String(document.getElementById("wbBidderTargetKind")?.value || "normquery").trim().toLowerCase(),
    target_value: String(document.getElementById("wbBidderTargetValue")?.value || "").trim(),
    placement: String(document.getElementById("wbBidderPlacement")?.value || "search").trim().toLowerCase(),
    strategy: String(document.getElementById("wbBidderStrategy")?.value || "optimal").trim().toLowerCase(),
    desired_bid: asInt("wbBidderDesiredBid", 0),
    min_bid: asInt("wbBidderMinBid", 0),
    max_bid: asInt("wbBidderMaxBid", 0),
    step_bid: asInt("wbBidderStepBid", 100),
    target_pos_from: asFloat("wbBidderPosFrom", 1),
    target_pos_to: asFloat("wbBidderPosTo", 5),
    min_clicks: asInt("wbBidderMinClicks", 0),
    cooldown_sec: asInt("wbBidderCooldownSec", 300),
    notes: String(document.getElementById("wbBidderNotes")?.value || "").trim(),
    is_active: Boolean(document.getElementById("wbBidderIsActive")?.checked),
  };
}

function bidderPlacementLabel(value) {
  const key = String(value || "").trim().toLowerCase();
  if (key === "search") return tr("Поиск", "Search");
  if (key === "recommendations") return tr("????????????", "Recommendations");
  if (key === "combined") return tr("Поиск + рекомендации", "Search + recommendations");
  return key || "-";
}

function bidderStrategyLabel(value) {
  const key = String(value || "").trim().toLowerCase();
  if (key === "optimal") return tr("Optimal (авто баланс)", "Optimal (auto balance)");
  if (key === "position") return tr("Position (держать позицию)", "Position hold");
  if (key === "range") return tr("Range (держать диапазон)", "Range hold");
  if (key === "hold") return tr("Hold (фиксированная ставка)", "Hold fixed bid");
  return key || "-";
}

function bidderRuleTargetText(row) {
  const kind = String(row?.target_kind || "").toLowerCase();
  const nm = Number(row?.nm_id || 0);
  if (kind === "normquery") {
    return `${tr("nmID", "nmID")}: ${nm} ? ${String(row?.target_value || "-")}`;
  }
  return `${tr("Карточка nmID", "nmID card")}: ${nm}`;
}

function bidderStatusBadge(status) {
  const low = String(status || "").trim().toLowerCase();
  if (low === "ok") return `<span class="ads-bidder-status-ok">${escapeHtml(tr("ok", "ok"))}</span>`;
  if (low === "error") return `<span class="ads-bidder-status-error">${escapeHtml(tr("ошибка", "error"))}</span>`;
  if (low === "skipped") return `<span class="ads-bidder-status-skipped">${escapeHtml(tr("пропуск", "skipped"))}</span>`;
  return escapeHtml(String(status || "-"));
}

async function loadWbBidderWorkspace() {
  if (!enabledModules.has("wb_ads")) return;
  refreshWbBidderCampaignHints();
  const tasks = [loadWbBidderRules(), loadWbBidderRuns()];
  if (!wbCampaignRows.length) {
    tasks.push(loadWbAdCampaigns());
  }
  await Promise.all(tasks);
  refreshWbBidderCampaignHints();
}

async function loadWbBidderRules() {
  if (!enabledModules.has("wb_ads")) return;
  const data = await requestJson("/api/wb/ads/bidder/rules", {
    headers: authHeaders(),
    timeoutMs: 60000,
  }).catch((e) => {
    setWbBidderStatus(e.message || tr("Не удалось загрузить правила биддера.", "Unable to load bidder rules."), "error");
    return null;
  });
  if (!data) return;
  wbBidderRules = Array.isArray(data.rows) ? data.rows : [];
  renderWbBidderRules();
  syncWbBidderTargetKindUi();
  const activeCount = wbBidderRules.filter((x) => Boolean(x?.is_active)).length;
  setWbBidderStatus(
    tr(`Правил: ${wbBidderRules.length}, активных: ${activeCount}`, `Rules: ${wbBidderRules.length}, active: ${activeCount}`),
    wbBidderRules.length ? "ok" : "skipped"
  );
}

function renderWbBidderRules() {
  const tbody = document.getElementById("wbBidderRulesTable");
  if (!tbody) return;
  tbody.innerHTML = "";
  if (!Array.isArray(wbBidderRules) || !wbBidderRules.length) {
    const row = document.createElement("tr");
    row.innerHTML = `<td colspan="11">${escapeHtml(tr("Правила пока не созданы.", "No bidder rules yet."))}</td>`;
    tbody.appendChild(row);
    return;
  }
  for (const row of wbBidderRules) {
    const campaignName = getCampaignLookupName(row.campaign_id);
    const trEl = document.createElement("tr");
    trEl.innerHTML = `
      <td>${escapeHtml(String(row.id || "-"))}</td>
      <td>${row.is_active ? "?" : "??"}</td>
      <td>${escapeHtml(String(row.campaign_id || "-"))}${campaignName ? `<div class="cell-meta-small">${escapeHtml(campaignName)}</div>` : ""}</td>
      <td>${escapeHtml(bidderRuleTargetText(row))}</td>
      <td>${escapeHtml(bidderStrategyLabel(row.strategy))} ? ${escapeHtml(bidderPlacementLabel(row.placement))}</td>
      <td>${escapeHtml(String(row.min_bid || 0))} .. ${escapeHtml(String(row.max_bid || 0))} ? step ${escapeHtml(String(row.step_bid || 0))}</td>
      <td>${escapeHtml(String(row.target_pos_from || 0))} .. ${escapeHtml(String(row.target_pos_to || 0))}</td>
      <td>${escapeHtml(String(row.cooldown_sec || 0))}s</td>
      <td>${escapeHtml(String(row.last_run_at || "-"))}</td>
      <td>${bidderStatusBadge(row.last_status)}<br><small>${escapeHtml(String(row.last_reason || ""))}</small></td>
      <td>
        <div class="ads-bidder-row-actions">
          <button type="button" class="btn-secondary" onclick="editWbBidderRule(${Number(row.id || 0)})">?</button>
          <button type="button" class="btn-secondary" onclick="runWbBidderRuleNow(${Number(row.id || 0)})">?</button>
          <button type="button" class="btn-secondary" onclick="toggleWbBidderRule(${Number(row.id || 0)}, ${row.is_active ? "false" : "true"})">${row.is_active ? "?" : "?"}</button>
          <button type="button" class="btn-danger" onclick="deleteWbBidderRule(${Number(row.id || 0)})">??</button>
        </div>
      </td>
    `;
    tbody.appendChild(trEl);
  }
}

function editWbBidderRule(ruleId) {
  const row = wbBidderRules.find((x) => Number(x?.id || 0) === Number(ruleId || 0));
  if (!row) return;
  fillWbBidderForm(row);
  setWbBidderStatus(
    tr(`?????????????? ??????? #${row.id}`, `Editing rule #${row.id}`),
    "skipped"
  );
}

async function saveWbBidderRule() {
  if (!enabledModules.has("wb_ads")) return;
  const payload = collectWbBidderPayload();
  const ruleId = Number(document.getElementById("wbBidderRuleId")?.value || 0);
  if (!payload.campaign_id || !payload.nm_id) {
    setWbBidderStatus(
      tr("Заполните campaign_id и nm_id.", "Fill campaign_id and nm_id."),
      "error"
    );
    return;
  }
  if (payload.target_kind === "normquery" && !payload.target_value) {
    setWbBidderStatus(
      tr("Для normquery укажите фразу.", "For normquery provide the phrase."),
      "error"
    );
    return;
  }
  const method = ruleId > 0 ? "PATCH" : "POST";
  const endpoint = ruleId > 0 ? `/api/wb/ads/bidder/rules/${ruleId}` : "/api/wb/ads/bidder/rules";
  const data = await requestJson(endpoint, {
    method,
    headers: authHeaders(),
    body: JSON.stringify(payload),
    timeoutMs: 60000,
  }).catch((e) => {
    setWbBidderStatus(e.message || tr("Не удалось сохранить правило.", "Unable to save rule."), "error");
    return null;
  });
  if (!data) return;
  resetWbBidderForm();
  setWbBidderStatus(
    ruleId > 0
      ? tr(`Правило #${ruleId} обновлено.`, `Rule #${ruleId} updated.`)
      : tr("Правило создано.", "Rule created."),
    "ok"
  );
  await loadWbBidderRules();
  await loadWbBidderRuns();
}

async function deleteWbBidderRule(ruleId) {
  const id = Number(ruleId || 0);
  if (id <= 0) return;
  const sure = window.confirm(tr(`Удалить правило #${id}?`, `Delete rule #${id}?`));
  if (!sure) return;
  const data = await requestJson(`/api/wb/ads/bidder/rules/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
    timeoutMs: 60000,
  }).catch((e) => {
    setWbBidderStatus(e.message || tr("Не удалось удалить правило.", "Unable to delete rule."), "error");
    return null;
  });
  if (!data) return;
  setWbBidderStatus(tr(`Правило #${id} удалено.`, `Rule #${id} deleted.`), "ok");
  await loadWbBidderRules();
  await loadWbBidderRuns();
}

async function toggleWbBidderRule(ruleId, active) {
  const id = Number(ruleId || 0);
  if (id <= 0) return;
  const isActive = active === true || active === "true";
  const data = await requestJson(`/api/wb/ads/bidder/rules/${id}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ is_active: isActive }),
    timeoutMs: 60000,
  }).catch((e) => {
    setWbBidderStatus(e.message || tr("Не удалось обновить статус правила.", "Unable to update rule state."), "error");
    return null;
  });
  if (!data) return;
  setWbBidderStatus(
    tr(`Правило #${id}: ${isActive ? "включено" : "выключено"}.`, `Rule #${id}: ${isActive ? "enabled" : "disabled"}.`),
    isActive ? "ok" : "skipped"
  );
  await loadWbBidderRules();
}

async function runWbBidder(force = false, ruleIds = []) {
  const ids = Array.isArray(ruleIds)
    ? ruleIds.map((x) => Number(x || 0)).filter((x) => Number.isFinite(x) && x > 0)
    : [];
  const data = await requestJson("/api/wb/ads/bidder/run", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ rule_ids: ids, force: Boolean(force) }),
    timeoutMs: 120000,
  }).catch((e) => {
    setWbBidderStatus(e.message || tr("Не удалось запустить биддер.", "Unable to run bidder."), "error");
    return null;
  });
  if (!data) return;
  const tone = data.ok ? "ok" : "error";
  setWbBidderStatus(String(data.message || "-"), tone);
  await loadWbBidderRules();
  await loadWbBidderRuns();
}

async function runWbBidderRuleNow(ruleId) {
  const id = Number(ruleId || 0);
  if (id <= 0) return;
  await runWbBidder(true, [id]);
}

async function loadWbBidderRuns() {
  if (!enabledModules.has("wb_ads")) return;
  const data = await requestJson("/api/wb/ads/bidder/runs?limit=120", {
    headers: authHeaders(),
    timeoutMs: 60000,
  }).catch(() => null);
  if (!data) return;
  wbBidderRuns = Array.isArray(data.rows) ? data.rows : [];
  renderWbBidderRuns();
}

function renderWbBidderRuns() {
  const tbody = document.getElementById("wbBidderRunsTable");
  if (!tbody) return;
  tbody.innerHTML = "";
  if (!Array.isArray(wbBidderRuns) || !wbBidderRuns.length) {
    const row = document.createElement("tr");
    row.innerHTML = `<td colspan="9">${escapeHtml(tr("Логи пока пусты.", "Run logs are empty."))}</td>`;
    tbody.appendChild(row);
    return;
  }
  for (const row of wbBidderRuns) {
    const campaignName = getCampaignLookupName(row.campaign_id);
    const trEl = document.createElement("tr");
    trEl.innerHTML = `
      <td>${escapeHtml(String(row.created_at || "-"))}</td>
      <td>#${escapeHtml(String(row.rule_id || "-"))}</td>
      <td>${escapeHtml(String(row.campaign_id || "-"))}${campaignName ? `<div class="cell-meta-small">${escapeHtml(campaignName)}</div>` : ""}</td>
      <td>${escapeHtml(bidderRuleTargetText(row))}</td>
      <td>${escapeHtml(String(row.previous_bid || 0))} > ${escapeHtml(String(row.next_bid || 0))}</td>
      <td>${escapeHtml(String(row.avg_position || 0))}</td>
      <td>${escapeHtml(String(row.clicks || 0))} / ${escapeHtml(String(row.orders || 0))}</td>
      <td>${bidderStatusBadge(row.status)}</td>
      <td>${escapeHtml(String(row.reason || "-"))}</td>
    `;
    tbody.appendChild(trEl);
  }
}

function getImportPayload(options = {}) {
  const marketplace = String(document.getElementById("importMarketplace")?.value || "all").trim().toLowerCase();
  const articlesEl = document.getElementById("articles");
  const rawArticles = String(articlesEl?.value || "").trim();
  const articles = rawArticles
    ? rawArticles.split(",").map((x) => x.trim()).filter(Boolean)
    : [];
  const forceAll = Boolean(options.forceAll);
  const import_all = forceAll || articles.length === 0;
  return { marketplace, articles, import_all };
}

function normalizeProductPageSize(rawValue) {
  const num = Number(rawValue || 0);
  if (PRODUCT_PAGE_SIZE_OPTIONS.includes(num)) return num;
  return 30;
}

function productCategoryKey(value) {
  return String(value || "").replace(/\u00a0/g, " ").trim().replace(/\s+/g, " ").toLowerCase();
}

function syncCategoryFilterOptions(categories = []) {
  const selectEl = document.getElementById("productCategoryFilter");
  if (!selectEl) return false;
  const prev = String(selectEl.value || "all");
  const prevKey = productCategoryKey(prev);
  const normalized = [];
  const seen = new Set();
  for (const raw of Array.isArray(categories) ? categories : []) {
    const value = String(raw || "").replace(/\u00a0/g, " ").trim().replace(/\s+/g, " ");
    if (!value) continue;
    const key = productCategoryKey(value);
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(value);
  }
  normalized.sort((a, b) => a.localeCompare(b, "ru", { sensitivity: "base" }));
  const allLabel = currentLang === "en" ? "All categories" : "Все категории";
  const optionsHtml = [`<option value="all">${escapeHtml(allLabel)}</option>`]
    .concat(normalized.map((x) => `<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`))
    .join("");
  selectEl.innerHTML = optionsHtml;
  const match = [...selectEl.options].find((o) => productCategoryKey(o.value) === prevKey);
  const wanted = prevKey && match ? match.value : "all";
  selectEl.value = wanted;
  return wanted !== prev;
}

function syncCategoryFilterState() {
  const marketEl = document.getElementById("importMarketplace");
  const categoryEl = document.getElementById("productCategoryFilter");
  if (!marketEl || !categoryEl) return false;
  const market = String(marketEl.value || "all").trim().toLowerCase();
  const categoryEnabled = ["all", "wb", "ozon"].includes(market);
  const shouldResetToAll = !categoryEnabled && String(categoryEl.value || "all").toLowerCase() !== "all";
  const allLabel = currentLang === "en" ? "All categories" : "Все категории";
  if (!categoryEnabled && categoryEl.options.length > 1) {
    categoryEl.innerHTML = `<option value="all">${escapeHtml(allLabel)}</option>`;
  } else if (!categoryEl.options.length) {
    categoryEl.innerHTML = `<option value="all">${escapeHtml(allLabel)}</option>`;
  }
  if (!categoryEnabled || shouldResetToAll) {
    categoryEl.value = "all";
  }
  categoryEl.disabled = !categoryEnabled;
  categoryEl.title = categoryEnabled
    ? ""
    : tr("Категории появятся после загрузки товаров.", "Categories appear after products are loaded.");
  return shouldResetToAll;
}

function syncSelectedProductsActions() {
  const btn = document.getElementById("productsDeleteSelectedBtn");
  if (!btn) return;
  const count = selectedProducts.size;
  btn.disabled = count <= 0;
  btn.classList.toggle("is-soft-hidden", count <= 0);
  const tip = count > 0
    ? tr(`Удалить выбранные (${count}) из локальной базы`, `Delete selected (${count}) from local database`)
    : tr("Удалить выбранные из локальной базы", "Delete selected from local database");
  btn.dataset.tip = tip;
  btn.setAttribute("aria-label", tip);
}

function syncProductsPagerControls() {
  const safePage = Math.max(1, Number(productPage || 1));
  const safeTotalPages = Math.max(0, Number(productTotalPages || 0));
  const effectiveTotalPages = safeTotalPages || 1;
  const totalItems = Math.max(0, Number(productTotal || 0));
  let infoText = totalItems
    ? tr(`\u0421\u0442\u0440\u0430\u043d\u0438\u0446\u0430 ${safePage} \u0438\u0437 ${effectiveTotalPages} \u2022 \u0432\u0441\u0435\u0433\u043e \u0442\u043e\u0432\u0430\u0440\u043e\u0432: ${totalItems}`, `Page ${safePage} of ${effectiveTotalPages} \u2022 total products: ${totalItems}`)
    : tr("\u0422\u043e\u0432\u0430\u0440\u044b \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u044b", "No products found");
  const categoryMeta = productCategoryLoadMeta && typeof productCategoryLoadMeta === "object" ? productCategoryLoadMeta : {};
  const missingCategories = Number(categoryMeta.missing_ozon_categories || 0);
  const localBackfilled = Number(categoryMeta.local_backfilled || 0);
  const liveBackfilled = Number(categoryMeta.live_backfilled || 0);
  if (categoryMeta.background_queued) {
    infoText += tr(" \u2022 \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u0438 Ozon \u0434\u043e\u0433\u0440\u0443\u0436\u0430\u044e\u0442\u0441\u044f", " \u2022 Ozon categories are loading");
  } else if (missingCategories > 0 && (localBackfilled > 0 || liveBackfilled > 0)) {
    infoText += tr(" \u2022 \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u0438 \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u044b", " \u2022 categories updated");
  }

  ["productPageSizeTop", "productPageSizeBottom"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const nextVal = String(productPageSize);
    if (el.value !== nextVal) el.value = nextVal;
  });
  ["productsPageInfoTop", "productsPageInfoBottom"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = infoText;
  });
  ["productsPrevTopBtn", "productsPrevBottomBtn"].forEach((id) => {
    const btn = document.getElementById(id);
    if (btn) btn.disabled = safePage <= 1;
  });
  ["productsNextTopBtn", "productsNextBottomBtn"].forEach((id) => {
    const btn = document.getElementById(id);
    if (btn) btn.disabled = totalItems <= 0 || safePage >= effectiveTotalPages;
  });
  syncSelectedProductsActions();
}

function onProductsFilterChanged() {
  syncCategoryFilterState();
  productPage = 1;
  loadProducts();
}

function setProductsPageSize(value) {
  const next = normalizeProductPageSize(value);
  if (next === productPageSize) {
    syncProductsPagerControls();
    return;
  }
  productPageSize = next;
  productPage = 1;
  loadProducts();
}

function productsPrevPage() {
  if (productPage <= 1) return;
  productPage -= 1;
  loadProducts();
}

function productsNextPage() {
  if (productTotalPages > 0 && productPage >= productTotalPages) return;
  productPage += 1;
  loadProducts();
}

async function importProducts() {
  const payload = getImportPayload();
  const data = await withBusy(
    tr("Импортируем товары…", "Importing products..."),
    () => requestJson("/api/products/import", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
      timeoutMs: 120000,
    }),
    tr("Загрузка зависит от ответа маркетплейса.", "Loading depends on marketplace API response.")
  ).catch((e) => {
    alert(e.message);
    return null;
  });
  if (!data) return;
  invalidateModuleCache("products", "seo", "sales");
  productPage = 1;
  await loadProducts();
  await loadDashboard();
  const safeMp = String(payload.marketplace || "all").toLowerCase();
  await trackUiActivity("products_import_completed", "products", `marketplace=${safeMp};import_all=${payload.import_all ? 1 : 0};count=${Number(data.length || 0)}`);
  alert(tr(`Импортировано: ${data.length}`, `Imported: ${data.length}`));
}

async function reloadProducts() {
  if (!confirm(tr("Обновить локальную базу товаров по выбранному маркетплейсу (добавит новые и обновит измененные)?", "Refresh local catalog for selected marketplace (add new and update changed)?"))) return;
  const payload = getImportPayload({ forceAll: true });
  const body = JSON.stringify(payload);
  const data = await withBusy(
    tr("Обновляем локальную базу товаров…", "Refreshing local catalog..."),
    () => tryRequestChain([
      { url: "/api/products/reload", opts: { method: "POST", headers: authHeaders(), body, timeoutMs: 240000 } },
      { url: "/api/products/refresh", opts: { method: "POST", headers: authHeaders(), body, timeoutMs: 240000 } },
      { url: "/api/products/reset", opts: { method: "POST", headers: authHeaders(), body, timeoutMs: 240000 } },
      { url: "/api/products/reimport", opts: { method: "POST", headers: authHeaders(), body, timeoutMs: 240000 } },
    ]),
    tr("Данные обновляются без удаления: добавим новые товары и обновим измененные карточки.", "Updates without deletion: new items added, changed ones updated.")
  ).catch((e) => {
    alert(e.message);
    return null;
  });
  if (!data) return;
  invalidateModuleCache("products", "seo", "sales");
  selectedProducts.clear();
  productPage = 1;
  await loadProducts();
  await loadSeoJobs();
  await loadDashboard();
  const safeMp = String(payload.marketplace || "all").toLowerCase();
  await trackUiActivity("products_reload_completed", "products", `marketplace=${safeMp};import_all=${payload.import_all ? 1 : 0};count=${Number(data.length || 0)}`);
  alert(tr(`База обновлена, товаров: ${data.length}`, `Catalog refreshed, products: ${data.length}`));
}

async function loadProducts() {
  const marketplace = String(document.getElementById("importMarketplace")?.value || "all").trim().toLowerCase();
  const categoryEnabled = ["all", "wb", "ozon"].includes(marketplace);
  const category = String(document.getElementById("productCategoryFilter")?.value || "all").trim();
  const filter = (document.getElementById("productFilter")?.value || "").trim().toLowerCase();
  const categoryReset = syncCategoryFilterState();
  if (categoryReset) {
    productPage = 1;
  }
  productPageSize = normalizeProductPageSize(
    document.getElementById("productPageSizeTop")?.value || document.getElementById("productPageSizeBottom")?.value || productPageSize
  );

  const qp = new URLSearchParams();
  qp.set("marketplace", ["all", "wb", "ozon"].includes(marketplace) ? marketplace : "all");
  if (categoryEnabled && category && category.toLowerCase() !== "all") qp.set("category", category);
  qp.set("page", String(Math.max(1, Number(productPage || 1))));
  qp.set("page_size", String(productPageSize));
  if (filter) qp.set("q", filter);

  const data = await requestJson(`/api/products?${qp.toString()}`, { headers: authHeaders() }).catch(() => null);
  if (!data) {
    currentProducts = [];
    productTotal = 0;
    productPage = 1;
    productTotalPages = 0;
    productCategoryLoadMeta = null;
    syncCategoryFilterOptions([]);
    syncCategoryFilterState();
    syncProductsPagerControls();
    const tbodyError = document.getElementById("productsTable");
    if (tbodyError) {
      tbodyError.innerHTML = `<tr><td colspan="10">${escapeHtml(tr("Не удалось загрузить товары. Проверьте API ключи и фильтры.", "Failed to load products. Check API keys and filters."))}</td></tr>`;
    }
    markModuleLoaded("products");
    return;
  }

  if (Array.isArray(data)) {
    currentProducts = data;
    productCategoryLoadMeta = null;
    syncCategoryFilterOptions([]);
    syncCategoryFilterState();
    productTotal = data.length;
    productPage = 1;
    productTotalPages = data.length ? 1 : 0;
  } else {
    currentProducts = Array.isArray(data.rows) ? data.rows : [];
    productCategoryLoadMeta = (data.meta && typeof data.meta === "object" && data.meta.categories && typeof data.meta.categories === "object")
      ? data.meta.categories
      : null;
    const categoryList = Array.isArray(data.categories) ? data.categories : [];
    const optionsReset = syncCategoryFilterOptions(categoryList);
    const resetByState = syncCategoryFilterState();
    if (optionsReset || resetByState) {
      productPage = 1;
      await loadProducts();
      return;
    }
    productTotal = Math.max(0, Number(data.total || currentProducts.length));
    productPage = Math.max(1, Number(data.page || productPage || 1));
    productPageSize = normalizeProductPageSize(data.page_size || productPageSize);
    productTotalPages = Math.max(0, Number(data.total_pages || 0));
    if (productCategoryLoadMeta?.background_queued && !productCategoryRefreshTimer) {
      productCategoryRefreshTimer = setTimeout(() => {
        productCategoryRefreshTimer = null;
        if (String(currentTab || "") === "products") {
          loadProducts().catch(() => null);
        }
      }, 12000);
    }
  }
  syncProductsPagerControls();

  const tbody = document.getElementById("productsTable");
  tbody.innerHTML = "";

  for (const p of currentProducts) {
    const rowEl = document.createElement("tr");
    rowEl.dataset.productId = String(p.id);
    if (p.id === selectedProductId) rowEl.classList.add("selected-row");
    const tdSelect = document.createElement("td");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = selectedProducts.has(p.id);
    checkbox.onchange = () => toggleProduct(p.id, checkbox.checked);
    checkbox.onclick = (e) => e.stopPropagation();
    tdSelect.appendChild(checkbox);

    const tdPhoto = document.createElement("td");
    if (p.photo_url) {
      const img = document.createElement("img");
      img.className = "product-photo";
      img.src = p.photo_url;
      img.alt = p.name || "photo";
      img.loading = "lazy";
      img.onerror = () => {
        const ph = document.createElement("div");
        ph.className = "product-photo ph";
        img.replaceWith(ph);
      };
      tdPhoto.appendChild(img);
    } else {
      const ph = document.createElement("div");
      ph.className = "product-photo ph";
      tdPhoto.appendChild(ph);
    }

    const tdId = document.createElement("td");
    tdId.textContent = String(p.id);
    const tdMp = document.createElement("td");
    tdMp.textContent = p.marketplace;
    const tdCategory = document.createElement("td");
    tdCategory.textContent = p.category_name || "-";
    const tdArticle = document.createElement("td");
    tdArticle.textContent = p.article;
    const tdBarcode = document.createElement("td");
    tdBarcode.textContent = p.barcode || "-";
    const tdName = document.createElement("td");
    tdName.textContent = p.name;
    const tdPos = document.createElement("td");
    tdPos.textContent = formatPositionValue(p.last_position);
    const tdActions = document.createElement("td");
    tdActions.className = "product-actions-cell";
    tdActions.innerHTML = `
      <div class="product-row-actions">
        <button class="btn-secondary btn-row-action btn-row-action-icon" type="button" data-tip="${escapeHtml(tr("Посмотреть", "View"))}" aria-label="${escapeHtml(tr("Посмотреть", "View"))}">&#128065;</button>
        <button class="btn-danger btn-row-action btn-row-action-icon" type="button" data-tip="${escapeHtml(tr("Удалить локально", "Delete local"))}" aria-label="${escapeHtml(tr("Удалить локально", "Delete local"))}">&#128465;</button>
      </div>
    `;
    const [viewBtn, deleteBtn] = tdActions.querySelectorAll("button");
    if (viewBtn) {
      viewBtn.onclick = (e) => {
        e.stopPropagation();
        openProductViewModal(p.id);
      };
    }
    if (deleteBtn) {
      deleteBtn.onclick = (e) => {
        e.stopPropagation();
        deleteLocalProduct(p.id);
      };
    }

    rowEl.append(tdSelect, tdPhoto, tdId, tdMp, tdCategory, tdArticle, tdBarcode, tdName, tdPos, tdActions);
    rowEl.onclick = () => {
      selectedProductId = p.id;
      suggestKeywordsForSelectedProduct(p.id);
      for (const row of tbody.querySelectorAll("tr")) row.classList.remove("selected-row");
      rowEl.classList.add("selected-row");
    };
    tbody.appendChild(rowEl);
  }

  if (!selectedProductId && currentProducts.length) {
    selectedProductId = currentProducts[0].id;
  }
  const selected = currentProducts.find((x) => x.id === selectedProductId) || currentProducts[0] || null;
  selectedProductId = selected?.id || null;
  if (selectedProductId) {
    suggestKeywordsForSelectedProduct(selectedProductId);
    const row = [...tbody.querySelectorAll("tr")]
      .find((el) => Number(el.dataset.productId || 0) === Number(selectedProductId));
    if (row) row.classList.add("selected-row");
  }
  if (!currentProducts.length) {
    tbody.innerHTML = `<tr><td colspan="10">${escapeHtml(tr("Товары не найдены", "No products found"))}</td></tr>`;
  }
  markModuleLoaded("products");
}

function closeProductViewModal() {
  const modal = document.getElementById("productViewModal");
  if (modal) modal.classList.add("hidden");
  activeProductViewId = 0;
  activeProductViewIsRefreshing = false;
}

function closeProductEditModal() {
  const modal = document.getElementById("productEditModal");
  if (modal) modal.classList.add("hidden");
  activeProductEditId = 0;
  productEditPhotoOrder = [];
  productEditDragIndex = -1;
  const addInput = document.getElementById("productEditPhotoAddUrl");
  if (addInput) addInput.value = "";
  const uploadInput = document.getElementById("productEditPhotoUploadInput");
  if (uploadInput) uploadInput.value = "";
}

async function fetchProductDetailsById(productId, opts = {}) {
  const id = Number(productId || 0);
  if (!id) return null;
  const silent = Boolean(opts?.silent);
  const refresh = Boolean(opts?.refresh);
  const cached = productDetailsCache.get(id);
  if (!refresh) {
    if (
      cached
      && (Date.now() - Number(cached.ts || 0)) <= PRODUCT_DETAILS_CACHE_TTL_MS
      && cached.payload
    ) {
      return cached.payload;
    }
  }
  const data = await requestJson(`/api/products/${id}/details?refresh=${refresh ? 1 : 0}`, {
    headers: authHeaders(),
    timeoutMs: 90000,
  }).catch((e) => {
    if (cached?.payload) return cached.payload;
    if (!silent) alert(e.message);
    return null;
  });
  if (data) {
    productDetailsCache.set(id, { ts: Date.now(), payload: data });
    if (productDetailsCache.size > 120) {
      const oldest = productDetailsCache.keys().next().value;
      if (oldest !== undefined) productDetailsCache.delete(oldest);
    }
  }
  return data;
}

function openProductEditFromView() {
  const id = Number(activeProductViewId || 0);
  if (!id) return;
  closeProductViewModal();
  openProductEditModal(id);
}

async function refreshProductViewModal() {
  const id = Number(activeProductViewId || 0);
  if (!id || activeProductViewIsRefreshing) return;
  activeProductViewIsRefreshing = true;
  const refreshBtn = document.getElementById("productViewRefreshBtn");
  if (refreshBtn) refreshBtn.disabled = true;
  const warnEl = document.getElementById("productViewWarn");
  if (warnEl) warnEl.textContent = tr("Обновляем данные по API…", "Refreshing data from API...");
  await openProductViewModal(id, { refresh: true });
  if (refreshBtn) refreshBtn.disabled = false;
  activeProductViewIsRefreshing = false;
}

function normalizeProductDetailValue(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") {
    const text = value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
    if (!text || text === "-" || text === "?") return "";
    return text;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "";
    return String(value);
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) {
    const parts = value.map((x) => normalizeProductDetailValue(x)).filter(Boolean);
    return parts.join(", ");
  }
  if (typeof value === "object") {
    const obj = value || {};
    for (const key of ["value", "name", "title", "url", "id"]) {
      const text = normalizeProductDetailValue(obj[key]);
      if (text) return text;
    }
    try {
      return JSON.stringify(obj);
    } catch (_) {
      return "";
    }
  }
  return "";
}

function getValueByPath(source, path) {
  if (!source || typeof source !== "object") return "";
  const chunks = String(path || "").split(".").filter(Boolean);
  if (!chunks.length) return "";
  let cursor = source;
  for (const chunk of chunks) {
    if (!cursor || typeof cursor !== "object") return "";
    cursor = cursor[chunk];
  }
  return normalizeProductDetailValue(cursor);
}

function extractProductDetailContext(details, fallbackProduct) {
  const base = (details && details.product && typeof details.product === "object") ? details.product : (fallbackProduct || {});
  const raw = (details && details.raw && typeof details.raw === "object") ? details.raw : {};
  const attributesRaw = (details && details.attributes && typeof details.attributes === "object") ? details.attributes : {};
  const photosRaw = Array.isArray(details?.photos) ? details.photos : [];
  const knownPhoto = normalizeProductDetailValue(base.photo_url);
  const photos = photosRaw.filter((x) => normalizeProductDetailValue(x)).map((x) => String(x));
  if (!photos.length && knownPhoto) photos.push(knownPhoto);

  const rawCandidates = [raw];
  if (raw.product_info && typeof raw.product_info === "object") rawCandidates.push(raw.product_info);
  if (raw.merged_source && typeof raw.merged_source === "object") rawCandidates.push(raw.merged_source);
  if (raw.result && typeof raw.result === "object") rawCandidates.push(raw.result);
  if (raw.data && typeof raw.data === "object") rawCandidates.push(raw.data);
  const collectRawPhotos = () => {
    const out = [];
    const seen = new Set();
    const push = (value) => {
      const text = normalizeProductDetailValue(value);
      if (!text) return;
      const lower = text.toLowerCase();
      if (!/^https?:\/\//.test(lower) && !text.startsWith("/static/")) return;
      if (seen.has(lower)) return;
      seen.add(lower);
      out.push(text);
    };
    const queue = rawCandidates.slice();
    const visited = new Set();
    let hops = 0;
    while (queue.length && hops < 2400) {
      hops += 1;
      const node = queue.shift();
      if (!node || typeof node !== "object") continue;
      if (visited.has(node)) continue;
      visited.add(node);
      if (Array.isArray(node)) {
        node.forEach((item) => {
          if (item && typeof item === "object") queue.push(item);
          else push(item);
        });
        continue;
      }
      Object.entries(node).forEach(([key, value]) => {
        const keyNorm = String(key || "").toLowerCase();
        if (typeof value === "string") {
          if (/(photo|image|picture|media|preview|cover)/.test(keyNorm) || /^https?:\/\//i.test(value)) {
            push(value);
          }
          return;
        }
        if (Array.isArray(value) || (value && typeof value === "object")) {
          if (/(photo|image|picture|media|preview|cover)/.test(keyNorm)) queue.unshift(value);
          else queue.push(value);
        }
      });
    }
    return out;
  };
  const rawPhotoFallback = collectRawPhotos();
  for (const url of rawPhotoFallback) {
    const safe = String(url || "").trim();
    if (!safe) continue;
    if (!photos.some((x) => String(x || "").trim().toLowerCase() === safe.toLowerCase())) {
      photos.push(safe);
    }
  }

  const pickAttr = (...keys) => {
    for (const key of keys) {
      const text = normalizeProductDetailValue(attributesRaw?.[key]);
      if (text) return text;
    }
    return "";
  };
  const pickRaw = (...keys) => {
    for (const key of keys) {
      for (const item of rawCandidates) {
        const text = getValueByPath(item, key);
        if (text) return text;
      }
    }
    return "";
  };
  const pickAny = (...values) => {
    for (const value of values) {
      const text = normalizeProductDetailValue(value);
      if (text) return text;
    }
    return "";
  };
  const pickPrice = (...values) => {
    let fallback = "";
    for (const value of values) {
      const text = normalizeProductDetailValue(value);
      if (!text) continue;
      if (!fallback) fallback = text;
      const normalized = String(text).replace(/\s+/g, "").replace(",", ".").replace(/[^0-9.\-]/g, "");
      const amount = Number.parseFloat(normalized);
      if (Number.isFinite(amount) && amount > 0) return text;
    }
    return fallback;
  };
  const pickDeep = (...keys) => {
    const wanted = new Set(
      keys
        .map((x) => String(x || "").trim().toLowerCase())
        .filter(Boolean)
    );
    if (!wanted.size) return "";
    const queue = rawCandidates.slice();
    const seen = new Set();
    while (queue.length) {
      const node = queue.shift();
      if (!node || typeof node !== "object") continue;
      if (seen.has(node)) continue;
      seen.add(node);
      if (Array.isArray(node)) {
        for (const item of node) {
          if (item && typeof item === "object") queue.push(item);
        }
        continue;
      }
      for (const [key, value] of Object.entries(node)) {
        const keyNorm = String(key || "").trim().toLowerCase();
        const text = normalizeProductDetailValue(value);
        if (wanted.has(keyNorm) && text) return text;
        if (value && typeof value === "object") queue.push(value);
      }
    }
    return "";
  };

  const name = pickAny(base.name, pickAttr("name", "title"), pickRaw("name", "title"));
  const marketplace = pickAny(base.marketplace)?.toUpperCase() || "-";
  const category = pickAny(base.category_name, pickAttr("category_name"), pickRaw("category_name", "category.name", "subjectName")) || "-";
  const brand = pickAny(pickAttr("brand"), pickRaw("brand", "vendor", "trademark"));
  const article = pickAny(base.article, pickAttr("offer_id", "vendorCode"), pickRaw("offer_id", "vendorCode"));
  const externalId = pickAny(base.external_id, pickAttr("id", "nmID"), pickRaw("id", "product_id", "nmID"));
  const barcode = pickAny(base.barcode, pickAttr("barcode", "barcodes"), pickRaw("barcode", "barcodes"));
  const description = pickAny(
    base.current_description,
    pickAttr("description"),
    pickRaw("description", "marketing_description", "annotation")
  );

  const summaryItems = [
    { label: tr("Маркетплейс", "Marketplace"), value: marketplace },
    { label: tr("Категория", "Category"), value: category },
    { label: tr("Бренд", "Brand"), value: brand || "-" },
    { label: tr("Артикул", "Article"), value: article || "-" },
    { label: tr("Внешний ID", "External ID"), value: externalId || "-" },
    { label: tr("Баркод", "Barcode"), value: barcode || "-" },
  ];

  const purchasePriceValue = pickPrice(
    pickAttr("purchase_price", "cost_price"),
    pickRaw("purchase_price", "cost_price"),
    pickDeep("purchase_price", "cost_price", "buy_price", "supplier_price"),
    base.purchase_price
  );
  const priceBaseValue = pickPrice(
    pickAttr("old_price", "oldprice", "price_base", "base_price", "list_price", "price_without_discount", "original_price"),
    pickRaw(
      "old_price",
      "oldprice",
      "price_base",
      "base_price",
      "price_without_discount",
      "list_price",
      "original_price",
      "price_info.old_price",
      "price_info.price.old_price",
      "price_info.price_without_discount",
      "price_info.price.price_without_discount",
      "result.old_price",
      "result.price_without_discount",
      "sizes.0.price",
      "sizes.0.originalPrice",
      "sizes.0.priceWithoutDiscount"
    ),
    pickDeep("old_price", "oldprice", "base_price", "list_price", "price_without_discount", "before_discount_price", "original_price"),
    base.price_base
  );
  const priceDiscountValue = pickPrice(
    pickAttr("price", "discounted_price", "discountedPrice", "discount_price", "sale_price", "price_with_discount", "final_price", "current_price"),
    pickRaw(
      "price",
      "discounted_price",
      "discountedPrice",
      "discount_price",
      "sale_price",
      "price_with_discount",
      "final_price",
      "current_price",
      "promo_price",
      "price_info.price",
      "price_info.price.price",
      "price_info.discount_price",
      "price_info.price.discount_price",
      "price_info.sale_price",
      "price_info.price.sale_price",
      "price_info.final_price",
      "price_info.price.final_price",
      "sizes.0.discountedPrice",
      "sizes.0.salePrice",
      "result.price",
      "result.discounted_price"
    ),
    pickDeep("discounted_price", "discountedprice", "discount_price", "sale_price", "saleprice", "price_with_discount", "final_price", "current_price", "promo_price"),
    base.price_discount
  );
  const priceMinValue = pickPrice(
    pickAttr("min_price", "price_min", "minimum_price", "min_ozon_price", "auto_action_min_price"),
    pickRaw(
      "min_price",
      "price_min",
      "minimum_price",
      "min_ozon_price",
      "auto_action_min_price",
      "price_info.min_price",
      "price_info.price.min_price",
      "price_info.price.min_ozon_price",
      "result.min_price"
    ),
    pickDeep("min_price", "price_min", "minimum_price", "min_ozon_price", "auto_action_min_price"),
    base.price_min
  );
  const priceMarketingValue = pickPrice(
    pickAttr("marketing_price", "promo_price", "promotion_price", "campaign_price", "recommended_price", "premium_price"),
    pickRaw(
      "marketing_price",
      "promo_price",
      "promotion_price",
      "advert_price",
      "campaign_price",
      "recommended_price",
      "premium_price",
      "price_info.marketing_price",
      "price_info.price.marketing_price",
      "price_info.price.promo_price",
      "price_info.price.recommended_price",
      "price_info.price.premium_price",
      "result.marketing_price"
    ),
    pickDeep("marketing_price", "promo_price", "promotion_price", "campaign_price", "special_price", "advert_price", "recommended_price", "premium_price"),
    base.price_marketing
  );

  const commerceItems = [
    { label: tr("Закупочная цена", "Purchase price"), value: purchasePriceValue || "-" },
    { label: tr("Цена без скидки", "Base price"), value: priceBaseValue || "-" },
    { label: tr("Цена со скидкой", "Discounted price"), value: priceDiscountValue || "-" },
    { label: tr("Мин. цена", "Min price"), value: priceMinValue || "-" },
    { label: tr("Маркетинг цена", "Marketing price"), value: priceMarketingValue || "-" },
    { label: tr("Валюта", "Currency"), value: pickAny(pickAttr("currency_code", "currency"), pickRaw("currency_code", "currency", "price_info.currency_code", "price_info.price.currency_code")) || "-" },
    { label: tr("НДС", "VAT"), value: pickAny(pickAttr("vat", "vat_rate", "nds"), pickRaw("vat", "vat_rate", "nds", "price_info.vat", "price_info.price.vat")) || "-" },
    { label: tr("??????", "Status"), value: pickAny(pickAttr("state"), pickRaw("state.name", "state")) || "-" },
    { label: tr("Видимость", "Visibility"), value: pickAny(pickAttr("visibility"), pickRaw("visibility")) || "-" },
  ];

  const logisticsItems = [
    { label: tr("Вес", "Weight"), value: pickAny(pickAttr("weight"), pickRaw("weight")) || "-" },
    { label: tr("Ед. веса", "Weight unit"), value: pickAny(pickAttr("weight_unit"), pickRaw("weight_unit")) || "-" },
    { label: tr("Длина", "Length"), value: pickAny(pickAttr("depth"), pickRaw("depth")) || "-" },
    { label: tr("Ширина", "Width"), value: pickAny(pickAttr("width"), pickRaw("width")) || "-" },
    { label: tr("Высота", "Height"), value: pickAny(pickAttr("height"), pickRaw("height")) || "-" },
    { label: tr("Ед. габаритов", "Dimension unit"), value: pickAny(pickAttr("dimension_unit"), pickRaw("dimension_unit")) || "-" },
    { label: tr("Упаковка: вес", "Package: weight"), value: pickAny(pickAttr("package_weight"), pickRaw("package_dimensions.weight")) || "-" },
    { label: tr("Упаковка: длина", "Package: depth"), value: pickAny(pickAttr("package_depth"), pickRaw("package_dimensions.depth")) || "-" },
    { label: tr("Упаковка: ширина", "Package: width"), value: pickAny(pickAttr("package_width"), pickRaw("package_dimensions.width")) || "-" },
    { label: tr("Упаковка: высота", "Package: height"), value: pickAny(pickAttr("package_height"), pickRaw("package_dimensions.height")) || "-" },
  ];

  const technicalItems = [
    { label: "offer_id", value: pickAny(pickAttr("offer_id"), pickRaw("offer_id"), base.article) || "-" },
    { label: "id/product_id", value: pickAny(pickAttr("id"), pickRaw("id", "product_id"), base.external_id) || "-" },
    { label: "sku", value: pickAny(pickAttr("sku"), pickRaw("sku")) || "-" },
    { label: "fbo_sku", value: pickAny(pickAttr("fbo_sku"), pickRaw("fbo_sku")) || "-" },
    { label: "fbs_sku", value: pickAny(pickAttr("fbs_sku"), pickRaw("fbs_sku")) || "-" },
    { label: "nmID", value: pickAny(pickAttr("nmID"), pickRaw("nmID")) || "-" },
    { label: "imtID", value: pickAny(pickAttr("imtID"), pickRaw("imtID")) || "-" },
    { label: "description_category_id", value: pickAny(pickAttr("description_category_id"), pickRaw("description_category_id", "category_id")) || "-" },
  ];

  const displayAttributes = [];
  for (const [key, value] of Object.entries(attributesRaw)) {
    const text = normalizeProductDetailValue(value);
    if (!text) continue;
    if (key.startsWith("attr:") || key.startsWith("char:")) {
      displayAttributes.push({ label: key.split(":").slice(1).join(":").trim() || key, value: text });
      continue;
    }
  }
  if (!displayAttributes.length) {
    for (const [key, value] of Object.entries(attributesRaw)) {
      if (String(key).startsWith("attr:") || String(key).startsWith("char:")) continue;
      const text = normalizeProductDetailValue(value);
      if (!text) continue;
      displayAttributes.push({ label: String(key), value: text });
      if (displayAttributes.length >= 30) break;
    }
  }

  const cleanedAttributes = [];
  for (const item of displayAttributes) {
    const label = normalizeProductDetailValue(item.label);
    const value = normalizeProductDetailValue(item.value);
    if (!label || !value) continue;
    cleanedAttributes.push({ label, value });
  }

  return {
    base,
    raw,
    photos,
    name: name || tr("Товар", "Product"),
    description,
    summaryItems,
    commerceItems,
    priceValues: {
      purchase_price: purchasePriceValue,
      price_base: priceBaseValue,
      price_discount: priceDiscountValue,
      price_min: priceMinValue,
      price_marketing: priceMarketingValue,
    },
    logisticsItems,
    technicalItems,
    attributeItems: cleanedAttributes,
  };
}

function renderProductInfoGrid(items, emptyLabel, options = {}) {
  const keepEmptyRows = Boolean(options && options.keepEmptyRows);
  const emptyValueLabel = String(
    options && options.emptyValueLabel !== undefined
      ? options.emptyValueLabel
      : tr("нет данных", "n/a")
  );
  const rows = (Array.isArray(items) ? items : [])
    .map((item) => {
      const label = normalizeProductDetailValue(item?.label);
      const value = normalizeProductDetailValue(item?.value);
      if (!label) return "";
      if (!value && !keepEmptyRows) return "";
      return `<article class="product-kv-card"><span>${escapeHtml(label)}</span><b>${escapeHtml(value || emptyValueLabel)}</b></article>`;
    })
    .filter(Boolean)
    .join("");
  if (rows) return rows;
  return `<div class="hint">${escapeHtml(emptyLabel)}</div>`;
}

function renderProductAttributeTable(items) {
  const rows = (Array.isArray(items) ? items : [])
    .map((item) => {
      const label = normalizeProductDetailValue(item?.label);
      const value = normalizeProductDetailValue(item?.value);
      if (!label || !value) return "";
      return `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`;
    })
    .filter(Boolean)
    .join("");
  if (!rows) {
    return `<div class="hint">${escapeHtml(tr("Атрибуты не найдены.", "No attributes found."))}</div>`;
  }
  return `
    <div class="table-card product-attrs-table-wrap">
      <table class="product-attrs-table">
        <thead>
          <tr>
            <th>${escapeHtml(tr("Параметр", "Parameter"))}</th>
            <th>${escapeHtml(tr("Значение", "Value"))}</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

async function openProductViewModal(productId, opts = {}) {
  const id = Number(productId || 0);
  if (!id) return;
  const refresh = Boolean(opts?.refresh);
  const modal = document.getElementById("productViewModal");
  if (!modal) return;
  activeProductViewId = id;
  const product = currentProducts.find((x) => Number(x.id) === id) || null;
  const name = product?.name || tr("Товар", "Product");
  const titleEl = modal.querySelector("h3");
  const editBtn = document.getElementById("productViewEditBtn");
  const refreshBtn = document.getElementById("productViewRefreshBtn");
  if (editBtn) {
    editBtn.disabled = false;
    editBtn.dataset.productId = String(id);
  }
  if (refreshBtn) refreshBtn.disabled = activeProductViewIsRefreshing;
  if (titleEl) titleEl.textContent = `${tr("Карточка товара", "Product card")}: ${name}`;
  modal.classList.remove("hidden");
  const metaEl = document.getElementById("productViewMeta");
  const warnEl = document.getElementById("productViewWarn");
  const summaryEl = document.getElementById("productViewSummary");
  const photosEl = document.getElementById("productViewPhotos");
  const descEl = document.getElementById("productViewDescription");
  const commerceEl = document.getElementById("productViewCommerce");
  const logisticsEl = document.getElementById("productViewLogistics");
  const technicalEl = document.getElementById("productViewTechnical");
  const attrsEl = document.getElementById("productViewAttrs");
  const rawEl = document.getElementById("productViewRaw");
  if (metaEl) {
    metaEl.textContent = product
      ? `${tr("ID", "ID")}: ${product.id} ? ${tr("\u041c\u041f", "MP")}: ${String(product.marketplace || "").toUpperCase()} ? ${tr("\u041a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u044f", "Category")}: ${product.category_name || "-"}`
      : "-";
  }
  if (warnEl) warnEl.textContent = tr("Загружаем детали карточки…", "Loading product details...");
  if (summaryEl) summaryEl.innerHTML = "";
  if (photosEl) photosEl.innerHTML = "";
  if (descEl) descEl.textContent = "-";
  if (commerceEl) commerceEl.innerHTML = "";
  if (logisticsEl) logisticsEl.innerHTML = "";
  if (technicalEl) technicalEl.innerHTML = "";
  if (attrsEl) attrsEl.innerHTML = "";
  if (rawEl) rawEl.textContent = "-";

  const details = await fetchProductDetailsById(id, { silent: true, refresh });
  if (!details || activeProductViewId !== id) return;
  const context = extractProductDetailContext(details, product || {});
  if (titleEl) titleEl.textContent = `${tr("Карточка товара", "Product card")}: ${context.name}`;
  const allPhotos = context.photos;
  if (summaryEl) {
    summaryEl.innerHTML = renderProductInfoGrid(
      context.summaryItems,
      tr("Краткая информация недоступна.", "Summary is unavailable.")
    );
  }
  if (descEl) {
    descEl.textContent = context.description || tr("Описание отсутствует.", "Description is not available.");
  }
  if (photosEl) {
    photosEl.innerHTML = allPhotos.length
      ? allPhotos.map((url, idx) => `<img src="${escapeHtml(String(url))}" alt="product-photo-${idx + 1}" loading="lazy" class="product-detail-photo">`).join("")
      : `<div class="hint">${escapeHtml(tr("Фотографии не найдены.", "No photos found."))}</div>`;
    if (allPhotos.length) {
      const imgNodes = photosEl.querySelectorAll("img.product-detail-photo");
      imgNodes.forEach((imgEl, idx) => {
        imgEl.classList.add("clickable-photo");
        imgEl.addEventListener("click", () => openReviewPhotoViewer(allPhotos, idx));
      });
    }
  }
  if (warnEl) {
    const warnings = Array.isArray(details.warnings) ? details.warnings.filter(Boolean) : [];
    warnEl.textContent = warnings.length ? warnings.join(" | ") : tr("Детали загружены.", "Details loaded.");
  }
  if (commerceEl) {
    commerceEl.innerHTML = renderProductInfoGrid(
      context.commerceItems,
      tr("Коммерческие данные не найдены.", "Commerce data not found."),
      { keepEmptyRows: true, emptyValueLabel: tr("нет данных", "n/a") }
    );
  }
  if (logisticsEl) {
    logisticsEl.innerHTML = renderProductInfoGrid(
      context.logisticsItems,
      tr("Логистические данные не найдены.", "Logistics data not found.")
    );
  }
  if (technicalEl) {
    technicalEl.innerHTML = renderProductInfoGrid(
      context.technicalItems,
      tr("Технические идентификаторы не найдены.", "Technical identifiers not found.")
    );
  }
  if (attrsEl) attrsEl.innerHTML = renderProductAttributeTable(context.attributeItems);
  if (rawEl) rawEl.textContent = JSON.stringify(context.raw || {}, null, 2);
  const points = await loadTrend({ productId: id, days: 21 });
  if (activeProductViewId !== id) return;
  renderTrendChart("productViewTrendChart", "productViewTrendMeta", points);
}

async function openProductEditModal(productId) {
  const id = Number(productId || 0);
  if (!id) return;
  const modal = document.getElementById("productEditModal");
  if (!modal) return;
  activeProductEditId = id;
  const product = currentProducts.find((x) => Number(x.id) === id) || null;
  const titleEl = modal.querySelector("h3");
  if (titleEl) titleEl.textContent = `${tr("????????????? ?????", "Edit product")}: ${product?.name || id}`;
  const hintEl = document.getElementById("productEditHint");
  const summaryEl = document.getElementById("productEditSummary");
  const detailsEl = document.getElementById("productEditDetails");
  const photosEl = document.getElementById("productEditPhotos");
  const attrsEl = document.getElementById("productEditAttrs");
  if (hintEl) hintEl.textContent = tr("Загружаем данные карточки…", "Loading product data...");
  if (summaryEl) summaryEl.innerHTML = "";
  if (detailsEl) detailsEl.innerHTML = "";
  if (photosEl) photosEl.innerHTML = "";
  if (attrsEl) attrsEl.innerHTML = "";
  modal.classList.remove("hidden");

  const details = await fetchProductDetailsById(id, { silent: true });
  if (activeProductEditId !== id) return;
  const context = extractProductDetailContext(details, product || {});
  const base = context.base || product || {};
  const warnings = Array.isArray(details?.warnings) ? details.warnings.filter(Boolean) : [];
  if (titleEl) titleEl.textContent = `${tr("????????????? ?????", "Edit product")}: ${context.name || id}`;
  if (hintEl) {
    hintEl.textContent = warnings.length
      ? warnings.join(" | ")
      : tr("Можно редактировать и сохранять изменения.", "You can edit and save changes.");
  }
  const setValue = (idValue, value) => {
    const el = document.getElementById(idValue);
    if (el) el.value = String(value ?? "");
  };
  const pickPreferredValue = (...values) => {
    for (const value of values) {
      if (normalizeProductDetailValue(value)) return value;
    }
    return values.length ? values[values.length - 1] : "";
  };
  const priceValues = context?.priceValues && typeof context.priceValues === "object" ? context.priceValues : {};
  setValue("productEditName", base.name);
  setValue("productEditCategory", base.category_name);
  setValue("productEditBarcode", base.barcode);
  setValue("productEditPhotoUrl", base.photo_url);
  setValue("productEditPhotoAddUrl", "");
  setValue("productEditPurchasePrice", pickPreferredValue(priceValues.purchase_price, base.purchase_price));
  setValue("productEditPriceBase", pickPreferredValue(priceValues.price_base, base.price_base));
  setValue("productEditPriceDiscount", pickPreferredValue(priceValues.price_discount, base.price_discount));
  setValue("productEditPriceMin", pickPreferredValue(priceValues.price_min, base.price_min));
  setValue("productEditPriceMarketing", pickPreferredValue(priceValues.price_marketing, base.price_marketing));
  setValue("productEditDescription", base.current_description || context.description);
  setValue("productEditKeywords", base.target_keywords);
  if (summaryEl) {
    summaryEl.innerHTML = renderProductInfoGrid(
      context.summaryItems,
      tr("Краткая информация недоступна.", "Summary is unavailable.")
    );
  }
  if (detailsEl) {
    const editInfo = [...context.commerceItems, ...context.logisticsItems, ...context.technicalItems];
    detailsEl.innerHTML = renderProductInfoGrid(
      editInfo,
      tr("Детали карточки недоступны.", "Details are unavailable.")
    );
  }
  productEditPhotoOrder = Array.isArray(context.photos) ? context.photos.map((x) => String(x || "")).filter(Boolean) : [];
  productEditDragIndex = -1;
  if (!productEditPhotoOrder.length) {
    const fallbackPhoto = String(base.photo_url || "").trim();
    if (fallbackPhoto) productEditPhotoOrder = [fallbackPhoto];
  }
  syncProductEditMainPhotoUrl(true);
  renderProductEditPhotos();
  if (attrsEl) attrsEl.innerHTML = renderProductAttributeTable(context.attributeItems);
}

function syncProductEditMainPhotoUrl(force = false) {
  const input = document.getElementById("productEditPhotoUrl");
  if (!input) return;
  const first = String((Array.isArray(productEditPhotoOrder) && productEditPhotoOrder.length ? productEditPhotoOrder[0] : "") || "").trim();
  if (!first) {
    if (force) input.value = "";
    return;
  }
  const current = String(input.value || "").trim();
  if (force || !current || current === "-") {
    input.value = first;
  }
}

function movePhotoInOrder(fromIdx, toIdx) {
  if (!Array.isArray(productEditPhotoOrder) || !productEditPhotoOrder.length) return;
  const from = Math.max(0, Math.min(productEditPhotoOrder.length - 1, Number(fromIdx)));
  const to = Math.max(0, Math.min(productEditPhotoOrder.length - 1, Number(toIdx)));
  if (from === to) return;
  const next = productEditPhotoOrder.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  productEditPhotoOrder = next;
  syncProductEditMainPhotoUrl(true);
}

function addProductEditPhoto(photoUrl, options = {}) {
  const prepend = Boolean(options?.prepend);
  const clean = String(photoUrl || "").trim();
  if (!clean) return false;
  const current = Array.isArray(productEditPhotoOrder) ? productEditPhotoOrder.slice() : [];
  const exists = current.some((item) => String(item || "").trim().toLowerCase() === clean.toLowerCase());
  if (exists) return false;
  if (prepend) {
    current.unshift(clean);
  } else {
    current.push(clean);
  }
  productEditPhotoOrder = current;
  syncProductEditMainPhotoUrl(prepend || current.length <= 1);
  renderProductEditPhotos();
  return true;
}

function addProductEditPhotoFromInput() {
  const input = document.getElementById("productEditPhotoAddUrl");
  const raw = String(input?.value || "").trim();
  if (!raw) {
    alert(tr("Вставьте URL фото или используйте кнопку «Добавить фото».", "Paste photo URL or use the Add photo button."));
    return;
  }
  const added = addProductEditPhoto(raw);
  if (!added) {
    alert(tr("Фото уже добавлено.", "Photo is already added."));
    return;
  }
  if (input) input.value = "";
}

function pickProductEditPhotoFiles() {
  const input = document.getElementById("productEditPhotoUploadInput");
  if (!input) return;
  input.click();
}

function onProductEditPhotoFilesChanged() {
  uploadProductEditPhotos({ silentNoFiles: true });
}

async function uploadProductEditPhotos(options = {}) {
  const silentNoFiles = Boolean(options?.silentNoFiles);
  const productId = Number(activeProductEditId || 0);
  if (!productId) return;
  const input = document.getElementById("productEditPhotoUploadInput");
  const files = Array.from(input?.files || []);
  if (!files.length) {
    if (!silentNoFiles) {
      alert(tr("Выберите изображения для загрузки.", "Select images to upload."));
    }
    return;
  }
  const imageFiles = files.filter((file) => String(file?.type || "").startsWith("image/"));
  if (!imageFiles.length) {
    alert(tr("Допускаются только файлы изображений.", "Only image files are allowed."));
    return;
  }
  const oversized = imageFiles.find((file) => Number(file?.size || 0) > 8 * 1024 * 1024);
  if (oversized) {
    alert(tr("Один из файлов больше 8 МБ.", "One of files is larger than 8 MB."));
    return;
  }
  const uploadedUrls = [];
  for (const file of imageFiles) {
    const form = new FormData();
    form.append("file", file);
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const payload = await requestJson(`/api/products/${productId}/photos/upload`, {
      method: "POST",
      headers,
      body: form,
      timeoutMs: 120000,
      retryOnPost: true,
      maxRetries: 1,
    }).catch((e) => {
      alert(e.message || tr("Не удалось загрузить фото.", "Failed to upload photo."));
      return null;
    });
    if (!payload?.url) continue;
    uploadedUrls.push(String(payload.url || ""));
  }
  if (input) input.value = "";
  if (!uploadedUrls.length) return;
  for (let idx = uploadedUrls.length - 1; idx >= 0; idx -= 1) {
    addProductEditPhoto(uploadedUrls[idx], { prepend: true });
  }
  alert(
    tr(
      `Загружено фото: ${uploadedUrls.length}. Фото сразу добавлены в карточку.`,
      `Uploaded photos: ${uploadedUrls.length}. Photos were added to product card immediately.`
    )
  );
}

function removeProductEditPhoto(index) {
  const idx = Number(index || -1);
  if (!Array.isArray(productEditPhotoOrder) || !productEditPhotoOrder.length) return;
  if (!Number.isFinite(idx) || idx < 0 || idx >= productEditPhotoOrder.length) return;
  const next = productEditPhotoOrder.slice();
  next.splice(idx, 1);
  productEditPhotoOrder = next;
  syncProductEditMainPhotoUrl(true);
  renderProductEditPhotos();
}

function renderProductEditPhotos() {
  const photosEl = document.getElementById("productEditPhotos");
  if (!photosEl) return;
  const photos = Array.isArray(productEditPhotoOrder) ? productEditPhotoOrder : [];
  if (!photos.length) {
    photosEl.innerHTML = `<div class="hint">${escapeHtml(tr("Фотографии не найдены.", "No photos found."))}</div>`;
    return;
  }
  photosEl.innerHTML = photos
    .map((url, idx) => `
      <div
        class="product-edit-photo-item${idx === 0 ? " is-main" : ""}"
        draggable="true"
        data-idx="${idx}"
      >
        <img src="${escapeHtml(String(url))}" alt="edit-photo-${idx + 1}" loading="lazy" class="product-detail-photo">
        <span class="product-edit-photo-index">${idx + 1}</span>
        <button class="product-edit-photo-remove" type="button" data-remove-idx="${idx}" aria-label="${escapeHtml(tr("Удалить фото", "Remove photo"))}">✕</button>
        ${idx === 0 ? `<span class="product-edit-photo-main">${escapeHtml(tr("Главное", "Main"))}</span>` : ""}
      </div>
    `)
    .join("");
  const removeNodes = photosEl.querySelectorAll(".product-edit-photo-remove");
  removeNodes.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const idx = Number(btn.getAttribute("data-remove-idx") || -1);
      removeProductEditPhoto(idx);
    });
  });
  const nodes = photosEl.querySelectorAll(".product-edit-photo-item");
  nodes.forEach((node) => {
    const idx = Number(node.getAttribute("data-idx") || -1);
    node.addEventListener("dragstart", (e) => {
      productEditDragIndex = idx;
      node.classList.add("drag-source");
      try {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(idx));
      } catch (_) {}
    });
    node.addEventListener("dragover", (e) => {
      e.preventDefault();
      node.classList.add("drag-target");
      try {
        e.dataTransfer.dropEffect = "move";
      } catch (_) {}
    });
    node.addEventListener("dragleave", () => {
      node.classList.remove("drag-target");
    });
    node.addEventListener("drop", (e) => {
      e.preventDefault();
      const fromData = Number((() => {
        try {
          return e.dataTransfer.getData("text/plain");
        } catch (_) {
          return productEditDragIndex;
        }
      })());
      const from = Number.isFinite(fromData) ? fromData : productEditDragIndex;
      const to = idx;
      movePhotoInOrder(from, to);
      productEditDragIndex = -1;
      renderProductEditPhotos();
    });
    node.addEventListener("dragend", () => {
      productEditDragIndex = -1;
      photosEl.querySelectorAll(".product-edit-photo-item").forEach((item) => {
        item.classList.remove("drag-target", "drag-source");
      });
    });
  });
}

async function saveProductEditModal() {
  const id = Number(activeProductEditId || 0);
  if (!id) return;
  const parseMoneyField = (idValue) => {
    const raw = String(document.getElementById(idValue)?.value || "").trim().replace(",", ".");
    if (!raw) return null;
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  };
  const purchasePrice = parseMoneyField("productEditPurchasePrice");
  const priceBase = parseMoneyField("productEditPriceBase");
  const priceDiscount = parseMoneyField("productEditPriceDiscount");
  const priceMin = parseMoneyField("productEditPriceMin");
  const priceMarketing = parseMoneyField("productEditPriceMarketing");
  const rawMainPhoto = String(document.getElementById("productEditPhotoUrl")?.value || "").trim();
  const nextPhotosOrder = Array.isArray(productEditPhotoOrder) ? productEditPhotoOrder.slice() : [];
  let mainPhoto = rawMainPhoto;
  if (mainPhoto && !nextPhotosOrder.some((x) => String(x || "").trim().toLowerCase() === mainPhoto.toLowerCase())) {
    nextPhotosOrder.unshift(mainPhoto);
  }
  if (!mainPhoto && nextPhotosOrder.length) {
    mainPhoto = String(nextPhotosOrder[0] || "").trim();
  }
  const payload = {
    name: String(document.getElementById("productEditName")?.value || "").trim(),
    category_name: String(document.getElementById("productEditCategory")?.value || "").trim(),
    barcode: String(document.getElementById("productEditBarcode")?.value || "").trim(),
    photo_url: mainPhoto,
    purchase_price: purchasePrice,
    price_base: priceBase,
    price_discount: priceDiscount,
    price_min: priceMin,
    price_marketing: priceMarketing,
    photos_order: nextPhotosOrder,
    current_description: String(document.getElementById("productEditDescription")?.value || ""),
    target_keywords: String(document.getElementById("productEditKeywords")?.value || "").trim(),
  };
  const updated = await withBusy(
    tr("????????? ????????? ???????? ??????", "Saving product card changes..."),
    () => requestJson(`/api/products/${id}`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify(payload),
      timeoutMs: 120000,
    }),
    tr("Если изменено описание, сервис отправит его в маркетплейс через API.", "If description changed, service also sends it to marketplace API.")
  ).catch((e) => {
    alert(e.message);
    return null;
  });
  if (!updated) return;
  invalidateModuleCache("products", "seo");
  productDetailsCache.delete(id);
  await loadProducts();
  closeProductEditModal();
  alert(tr("Карточка товара обновлена.", "Product card updated."));
}

async function deleteLocalProduct(productId) {
  const id = Number(productId || 0);
  if (!id) return;
  const row = currentProducts.find((x) => Number(x?.id || 0) === id) || null;
  const label = String(row?.name || row?.article || `#${id}`);
  const confirmText = tr(
    `Удалить товар "${label}" только из локальной базы?`,
    `Delete "${label}" from local database only?`
  );
  if (!confirm(confirmText)) return;

  const deleted = await withBusy(
    tr("Удаляем товар из локальной базы…", "Deleting product from local database..."),
    () => requestJson(`/api/products/${id}/local`, {
      method: "DELETE",
      headers: authHeaders(),
      timeoutMs: 90000,
    }),
    tr("Удаляется только локальная запись. На маркетплейсе товар не удаляется.", "Only local record is deleted. Marketplace item is untouched.")
  ).catch((e) => {
    alert(e.message);
    return null;
  });
  if (!deleted) return;

  selectedProducts.delete(id);
  if (Number(selectedProductId || 0) === id) selectedProductId = null;
  invalidateModuleCache("products", "seo");
  await loadProducts();
  alert(tr("Товар удален из локальной базы.", "Product deleted from local database."));
}

async function deleteSelectedLocalProducts() {
  const ids = [...selectedProducts]
    .map((x) => Number(x || 0))
    .filter((x) => Number.isFinite(x) && x > 0);
  if (!ids.length) {
    alert(tr("Выберите товары для удаления.", "Select products to delete."));
    return;
  }
  const confirmText = tr(
    `Удалить ${ids.length} выбранных товаров только из локальной базы?`,
    `Delete ${ids.length} selected products from local database only?`
  );
  if (!confirm(confirmText)) return;
  const payload = await withBusy(
    tr("Удаляем выбранные товары из локальной базы…", "Deleting selected products from local database..."),
    () => requestJson("/api/products/local/delete", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ product_ids: ids }),
      timeoutMs: 120000,
      retryOnPost: true,
      maxRetries: 1,
    }),
    tr("Удаляются только локальные записи. На маркетплейсе товары не удаляются.", "Only local records are removed. Marketplace items stay unchanged.")
  ).catch((e) => {
    alert(e.message);
    return null;
  });
  if (!payload) return;
  selectedProducts.clear();
  selectedProductId = null;
  syncSelectedProductsActions();
  invalidateModuleCache("products", "seo");
  await loadProducts();
  alert(String(payload?.message || tr("Выбранные товары удалены из локальной базы.", "Selected products were removed from local database.")));
}

function toggleProduct(id, checked) {
  if (checked) selectedProducts.add(id);
  else selectedProducts.delete(id);
  syncSelectedProductsActions();
}

function selectAllProducts() {
  selectedProducts = new Set(currentProducts.map((x) => x.id));
  syncSelectedProductsActions();
  loadProducts();
}

async function checkCurrentPositions(applyToAll) {
  const rawKeywords = document.getElementById("positionKeywords").value.trim();
  const keywords = rawKeywords ? rawKeywords.split(",").map((x) => x.trim()).filter(Boolean) : [];

  if (!applyToAll && !selectedProducts.size) {
    if (selectedProductId) {
      selectedProducts.add(selectedProductId);
    } else {
      return alert(tr("Выберите товары во вкладке 'Товары' или запустите проверку для всех.", "Select products in Products tab or run check for all."));
    }
  }

  const data = await withBusy(
    tr("Проверяем текущие позиции…", "Checking current rankings..."),
    () => requestJson("/api/seo/positions/check", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ product_ids: [...selectedProducts], keywords, apply_to_all: applyToAll }),
      timeoutMs: 120000,
    }),
    tr("Если проверка идет дольше 2 минут, сервис покажет ошибку таймаута.", "If check takes over 2 minutes, timeout error is shown.")
  ).catch((e) => {
    alert(e.message);
    return null;
  });
  if (!data) return;
  invalidateModuleCache("products", "seo", "sales");

  const criterion = keywords.length
    ? tr(`Критерий: позиции рассчитаны по вашим ключам (${keywords.join(", ")}).`, `Criteria: rankings calculated by your keywords (${keywords.join(", ")}).`)
    : tr("Критерий: позиции рассчитаны по автоядру ключей (название + описание + конкуренты).", "Criteria: rankings calculated by auto semantic core (title + description + competitors).");
  document.getElementById("positionCheckResult").textContent = `${criterion}\n\n${JSON.stringify(data, null, 2)}`;
  await loadProducts();
  await loadDashboard();
  const withoutPos = data.filter((x) => !x.best_position || x.best_position <= 0).length;
  if (withoutPos > 0) {
    alert(tr(`Проверка завершена. Товаров: ${data.length}. Без достоверной позиции: ${withoutPos}.`, `Check completed. Products: ${data.length}. Without reliable rank: ${withoutPos}.`));
  } else {
    alert(tr(`Проверка завершена. Товаров: ${data.length}.`, `Check completed. Products: ${data.length}.`));
  }
}

async function generateSeo(applyToAll) {
  if (!applyToAll && !selectedProducts.size) return alert(tr("Выберите товары во вкладке 'Товары'.", "Select products in Products tab."));
  const extraRaw = document.getElementById("extraKeywords").value.trim();
  const extra_keywords = extraRaw ? extraRaw.split(",").map((x) => x.trim()).filter(Boolean) : [];
  const target_position = Number(document.getElementById("targetPosition").value || 5);

  const data = await withBusy(
    tr("Генерируем SEO-описания…", "Generating SEO descriptions..."),
    () => requestJson("/api/seo/generate", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ product_ids: [...selectedProducts], extra_keywords, target_position, apply_to_all: applyToAll }),
      timeoutMs: 120000,
    }),
    tr("Генерация учитывает ключи и конкурентную выдачу, это может занять до 2 минут.", "Generation uses keywords and competitors, it can take up to 2 minutes.")
  ).catch((e) => {
    alert(e.message);
    return null;
  });

  if (!data) return;
  invalidateModuleCache("seo", "sales");
  await loadSeoJobs();
  await loadDashboard();
  if (data.length) renderSeoPreview(data[0]);
  alert(tr(`????????????? ?????: ${data.length}`, `Generated jobs: ${data.length}`));
}

function renderSeoPreview(job) {
  const title = job.product_name || tr("Товар", "Product");
  const article = job.product_article || "-";
  document.getElementById("seoPreview").textContent = [
    `${tr("Товар", "Product")}: ${title} (${article})`,
    "",
    job.generated_description || "",
  ].join("\n");

  const holder = document.getElementById("competitorLinks");
  if (!holder) return;
  const items = Array.isArray(job.competitor_items) ? job.competitor_items : [];
  if (!items.length) {
    holder.innerHTML = `<div class="hint">${tr("Данные по конкурентам появятся после новой генерации SEO.", "Competitor data will appear after next SEO generation.")}</div>`;
    return;
  }
  holder.innerHTML = items
    .map((c, idx) => {
      const name = escapeHtml(c.name || `${tr("Конкурент", "Competitor")} ${idx + 1}`);
      const position = escapeHtml(c.position || idx + 1);
      const kws = Array.isArray(c.keywords) ? c.keywords.slice(0, 4).join(", ") : "";
      const fallbackQ = encodeURIComponent((Array.isArray(c.keywords) && c.keywords.length ? c.keywords[0] : tr("товар wb", "wb product")));
      const href = c.url ? escapeHtml(c.url) : `https://www.wildberries.ru/catalog/0/search.aspx?search=${fallbackQ}`;
      const isLink = href.startsWith("http://") || href.startsWith("https://");
      return `
        <a class="competitor-link" ${isLink ? `href="${href}" target="_blank" rel="noopener noreferrer"` : ""}>
          <strong>#${position} ${name}</strong>
          <div>${escapeHtml(kws)}</div>
        </a>
      `;
    })
    .join("");
}

async function loadSeoJobs() {
  const rows = await requestJson("/api/seo/jobs", { headers: authHeaders() }).catch(() => null);
  if (!rows) return;

  const filter = (document.getElementById("seoFilter")?.value || "").trim().toLowerCase();
  currentJobs = filter
    ? rows.filter((j) => `${j.product_article || ""} ${j.product_name || ""} ${j.status || ""}`.toLowerCase().includes(filter))
    : rows;

  const tbody = document.getElementById("seoTable");
  tbody.innerHTML = "";

  for (const j of currentJobs) {
    const article = j.product_article || "-";
    const name = j.product_name || tr("Товар", "Product");
    const rowEl = document.createElement("tr");
    rowEl.innerHTML = `
      <td><input type="checkbox" ${selectedJobs.has(j.id) ? "checked" : ""} onchange="toggleJob(${j.id}, this.checked)"></td>
      <td>${j.id}</td>
      <td>${article}</td>
      <td>${name}</td>
      <td>${j.status}</td>
      <td>${formatPositionValue(j.current_position)}</td>
      <td>${j.next_check_at ?? "-"}</td>
    `;
    rowEl.onclick = () => renderSeoPreview(j);
    tbody.appendChild(rowEl);
  }
  const kanban = document.getElementById("seoKanban");
  if (kanban && getComputedStyle(kanban).display !== "none") {
    renderSeoKanban(rows);
  }
  markModuleLoaded("seo");
}

function toggleJob(id, checked) {
  if (checked) selectedJobs.add(id);
  else selectedJobs.delete(id);
}

function selectAllJobs() {
  selectedJobs = new Set(currentJobs.map((x) => x.id));
  loadSeoJobs();
}

async function deleteSeoSelected() {
  if (!selectedJobs.size) return alert(tr("Выберите задачи для удаления", "Select jobs to delete"));
  if (!confirm(tr("Удалить выбранные SEO-задачи?", "Delete selected SEO jobs?"))) return;
  const body = JSON.stringify({ job_ids: [...selectedJobs], delete_all: false });
  const data = await tryRequestChain([
    { url: "/api/seo/jobs/delete", opts: { method: "POST", headers: authHeaders(), body } },
    { url: "/api/seo/delete", opts: { method: "POST", headers: authHeaders(), body } },
    { url: "/api/seo/clear", opts: { method: "POST", headers: authHeaders(), body } },
    { url: "/api/seo/jobs/clear", opts: { method: "POST", headers: authHeaders(), body } },
  ]).catch((e) => {
    alert(e.message);
    return null;
  });
  if (!data) return;
  invalidateModuleCache("seo", "sales");

  selectedJobs.clear();
  await loadSeoJobs();
  await loadDashboard();
  alert(data.message || tr("Выбранные SEO-задачи удалены.", "Selected SEO jobs removed."));
}

async function deleteSeoAll() {
  if (!confirm(tr("Полностью очистить все SEO-задачи?", "Completely clear all SEO jobs?"))) return;
  const body = JSON.stringify({ job_ids: [], delete_all: true });
  const data = await tryRequestChain([
    { url: "/api/seo/jobs/delete", opts: { method: "POST", headers: authHeaders(), body } },
    { url: "/api/seo/delete", opts: { method: "POST", headers: authHeaders(), body } },
    { url: "/api/seo/clear", opts: { method: "POST", headers: authHeaders(), body } },
    { url: "/api/seo/jobs/clear", opts: { method: "POST", headers: authHeaders(), body } },
  ]).catch((e) => {
    alert(e.message);
    return null;
  });
  if (!data) return;
  invalidateModuleCache("seo", "sales");

  selectedJobs.clear();
  await loadSeoJobs();
  await loadDashboard();
  alert(data.message || tr("Все SEO-задачи удалены.", "All SEO jobs removed."));
}

async function applySeo() {
  if (!selectedJobs.size) return alert(tr("Выберите SEO задачи", "Select SEO jobs"));
  const data = await withBusy(
    tr("Применяем SEO-изменения в маркетплейс…", "Applying SEO updates to marketplace..."),
    () => requestJson("/api/seo/apply", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ job_ids: [...selectedJobs] }),
      timeoutMs: 120000,
    }),
    tr("Подождите завершения отправки обновлений.", "Wait for update publishing to finish.")
  ).catch((e) => {
    alert(e.message);
    return null;
  });
  if (!data) return;
  invalidateModuleCache("seo", "products", "sales");
  await loadSeoJobs();
  await loadDashboard();
  alert(tr(`Применено: ${data.length}`, `Applied: ${data.length}`));
}

async function recheckSelected() {
  if (!selectedJobs.size) return alert(tr("Выберите SEO задачи для recheck", "Select SEO jobs for recheck"));
  const data = await withBusy(
    tr("Запускаем recheck выбранных задач…", "Running recheck for selected jobs..."),
    () => requestJson("/api/seo/recheck", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ job_ids: [...selectedJobs], recheck_all_due: false }),
      timeoutMs: 120000,
    }),
    tr("Переоценка зависит от доступности поиска WB/Ozon.", "Recheck depends on WB/Ozon search availability.")
  ).catch((e) => {
    alert(e.message);
    return null;
  });
  if (!data) return;
  invalidateModuleCache("seo", "products", "sales");
  await loadSeoJobs();
  await loadDashboard();
  alert(tr(`Переоценено задач: ${data.length}`, `Rechecked jobs: ${data.length}`));
}

async function recheckDue() {
  const data = await withBusy(
    tr("Переоцениваем просроченные задачи…", "Rechecking overdue jobs..."),
    () => requestJson("/api/seo/recheck", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ job_ids: [], recheck_all_due: true }),
      timeoutMs: 120000,
    }),
    tr("Процесс может занять до 2 минут.", "This can take up to 2 minutes.")
  ).catch((e) => {
    alert(e.message);
    return null;
  });
  if (!data) return;
  invalidateModuleCache("seo", "products", "sales");
  await loadSeoJobs();
  await loadDashboard();
  alert(tr(`Переоценено просроченных задач: ${data.length}`, `Rechecked overdue jobs: ${data.length}`));
}

async function loadDashboard() {
  const d = await requestJson("/api/dashboard", {
    headers: authHeaders(),
    timeoutMs: 20000,
    maxRetries: 1,
  }).catch(() => null);
  if (!d) return false;
  const statsHost = document.getElementById("stats");
  if (!statsHost) return false;

  const stats = [
    [tr("Товаров", "Products"), d.total_products],
    [tr("SEO задач", "SEO jobs"), d.total_jobs],
    [tr("Применено", "Applied"), d.applied_jobs],
    [tr("В работе", "In progress"), d.in_progress_jobs],
    [tr("Топ-5", "Top-5"), d.top5_products],
  ];

  const maxVal = Math.max(...stats.map((x) => x[1]), 1);
  if (currentLang !== "en") {
    stats[0][0] = "Товаров";
    stats[1][0] = "SEO задач";
    stats[2][0] = "Применено";
    stats[3][0] = "В работе";
    stats[4][0] = "Топ-5";
    stats[0][0] = "\u0422\u043e\u0432\u0430\u0440\u043e\u0432";
    stats[1][0] = "SEO \u0437\u0430\u0434\u0430\u0447";
    stats[2][0] = "\u041f\u0440\u0438\u043c\u0435\u043d\u0435\u043d\u043e";
    stats[3][0] = "\u0412 \u0440\u0430\u0431\u043e\u0442\u0435";
    stats[4][0] = "\u0422\u043e\u043f-5";
  }
  statsHost.innerHTML = stats
    .map(([name, val]) => {
      const pct = Math.max(4, Math.round((val / maxVal) * 100));
      return `
        <div class="kpi">
          <div class="kpi-head"><strong>${val}</strong><span>${name}</span></div>
          <div class="kpi-track"><i style="width:${pct}%"></i></div>
        </div>
      `;
    })
    .join("");

  loadTrend({ days: 21 })
    .then((points) => {
      renderTrendChart("dashboardTrendChart", "dashboardTrendMeta", points);
    })
    .catch(() => {
      renderTrendChart("dashboardTrendChart", "dashboardTrendMeta", []);
    });
  return true;
}

async function loadSalesBundle() {
  const [dashRes, salesRes] = await Promise.allSettled([
    loadDashboard(),
    loadSalesStats(),
  ]);
  const dashOk = dashRes.status === "fulfilled" ? dashRes.value !== false : false;
  const salesOk = salesRes.status === "fulfilled" ? salesRes.value !== false : false;
  return dashOk || salesOk;
}

function initSalesPeriodDefaults() {
  const marketEl = document.getElementById("salesMarketplace");
  const toEl = document.getElementById("salesDateTo");
  const fromEl = document.getElementById("salesDateFrom");
  if (!toEl || !fromEl) return;
  if (marketEl && !marketEl.value) marketEl.value = "all";
  const showWb = document.getElementById("salesShowWb");
  const showOzon = document.getElementById("salesShowOzon");
  if (showWb && typeof showWb.checked === "boolean") showWb.checked = true;
  if (showOzon && typeof showOzon.checked === "boolean") showOzon.checked = true;
  if (!toEl.value || !fromEl.value) {
    setSalesRange("day", false);
    return;
  }
  syncSalesRangeButtons();
}

function scheduleSalesReload(delayMs = 260) {
  if (salesAutoLoadTimer) {
    clearTimeout(salesAutoLoadTimer);
  }
  salesAutoLoadTimer = setTimeout(() => {
    salesAutoLoadTimer = null;
    if (currentTab === "sales") {
      loadSalesStats();
    }
  }, Math.max(0, Number(delayMs) || 0));
}

function scheduleSalesLiveRefresh(delayMs = 18000) {
  if (salesLiveRefreshTimer) {
    clearTimeout(salesLiveRefreshTimer);
  }
  salesLiveRefreshTimer = setTimeout(() => {
    salesLiveRefreshTimer = null;
    if (currentTab === "sales") {
      loadSalesStats().catch(() => null);
    }
  }, Math.max(3000, Number(delayMs) || 18000));
}

function toYmd(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function setSalesRange(mode, autoLoad = true) {
  const toEl = document.getElementById("salesDateTo");
  const fromEl = document.getElementById("salesDateFrom");
  if (!toEl || !fromEl) return;
  const today = new Date();
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const start = new Date(end);
  const key = String(mode || "day").toLowerCase();
  if (key === "week") start.setDate(start.getDate() - 6);
  else if (key === "month") start.setDate(start.getDate() - 29);
  else if (key === "quarter") start.setDate(start.getDate() - 89);
  else if (key === "halfyear") start.setDate(start.getDate() - 181);
  else if (key === "year") start.setDate(start.getDate() - 364);

  fromEl.value = toYmd(start);
  toEl.value = toYmd(end);
  syncSalesRangeButtons(key);
  if (autoLoad) loadSalesStats();
}

window.setSalesRange = setSalesRange;

function syncSalesRangeButtons(forcedKey = "") {
  const toEl = document.getElementById("salesDateTo");
  const fromEl = document.getElementById("salesDateFrom");
  if (!toEl || !fromEl) return;
  let activeKey = forcedKey;
  if (!activeKey && fromEl.value && toEl.value) {
    const fromTs = Date.parse(`${fromEl.value}T00:00:00`);
    const toTs = Date.parse(`${toEl.value}T00:00:00`);
    const diffDays = Number.isFinite(fromTs) && Number.isFinite(toTs)
      ? Math.round((toTs - fromTs) / (24 * 3600 * 1000))
      : 0;
    if (diffDays === 0) activeKey = "day";
    else if (diffDays === 6) activeKey = "week";
    else if (diffDays === 29) activeKey = "month";
    else if (diffDays === 89) activeKey = "quarter";
    else if (diffDays === 181) activeKey = "halfyear";
    else if (diffDays === 364) activeKey = "year";
  }
  document.querySelectorAll("[data-sales-range]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.salesRange === activeKey);
  });
}

function formatInt(value) {
  const locale = currentLang === "en" ? "en-US" : "ru-RU";
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatMoney(value) {
  const locale = currentLang === "en" ? "en-US" : "ru-RU";
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0));
}

function renderSalesTotals() {
  const host = document.getElementById("salesTotalsCards");
  const extraHost = document.getElementById("salesTotalsExtra");
  const extraWrap = document.getElementById("salesExtraWrap");
  if (!host) return;
  const fallbackTotals = {
    orders: salesRows.reduce((acc, row) => acc + Number(row.orders || 0), 0),
    units: salesRows.reduce((acc, row) => acc + Number(row.units || 0), 0),
    buyouts: salesRows.reduce((acc, row) => acc + Number(row.buyouts || Math.max(0, Number(row.units || 0) - Number(row.returns || 0))), 0),
    order_amount: salesRows.reduce((acc, row) => acc + Number(row.order_amount || 0), 0),
    buyout_amount: salesRows.reduce((acc, row) => acc + Number(row.buyout_amount || 0), 0),
    revenue: salesRows.reduce((acc, row) => acc + Number(row.revenue || 0), 0),
    returns: salesRows.reduce((acc, row) => acc + Number(row.returns || 0), 0),
    ad_spend: salesRows.reduce((acc, row) => acc + Number(row.ad_spend || 0), 0),
    penalties: salesRows.reduce((acc, row) => acc + Number(row.penalties || 0), 0),
    income: salesRows.reduce((acc, row) => acc + Number(row.income || 0), 0),
    expense: salesRows.reduce((acc, row) => acc + Number(row.expense || 0), 0),
    net: salesRows.reduce((acc, row) => acc + Number(row.net || 0), 0),
    commission: salesRows.reduce((acc, row) => acc + Number(row.commission || 0), 0),
    logistics: salesRows.reduce((acc, row) => acc + Number(row.logistics || 0), 0),
    storage: salesRows.reduce((acc, row) => acc + Number(row.storage || 0), 0),
    deductions: salesRows.reduce((acc, row) => acc + Number(row.deductions || 0), 0),
    acceptance: salesRows.reduce((acc, row) => acc + Number(row.acceptance || 0), 0),
    other_expense: salesRows.reduce((acc, row) => acc + Number(row.other_expense || 0), 0),
  };
  const totals = { ...fallbackTotals };
  const source = (salesTotalsData && typeof salesTotalsData === "object") ? salesTotalsData : {};
  const syncKeys = [
    "orders",
    "units",
    "buyouts",
    "order_amount",
    "buyout_amount",
    "revenue",
    "returns",
    "ad_spend",
    "penalties",
    "income",
    "expense",
    "net",
    "commission",
    "logistics",
    "storage",
    "deductions",
    "acceptance",
    "other_expense",
  ];
  for (const key of syncKeys) {
    const value = Number(source?.[key]);
    if (Number.isFinite(value)) totals[key] = value;
  }
  totals.gross_profit = Number(totals.revenue || 0) - Number(totals.ad_spend || 0) - Number(totals.penalties || 0);
  host.innerHTML = `
    <article class="sales-kpi"><span>${tr("Заказы", "Orders")}</span><strong>${formatInt(totals.orders)}</strong></article>
    <article class="sales-kpi"><span>${tr("Штуки", "Units")}</span><strong>${formatInt(totals.units)}</strong></article>
    <article class="sales-kpi"><span>${tr("Выкупы", "Buyouts")}</span><strong>${formatInt(totals.buyouts)}</strong></article>
    <article class="sales-kpi"><span>${tr("Выручка", "Revenue")}</span><strong>${formatMoney(totals.revenue)}</strong></article>
    <article class="sales-kpi"><span>${tr("Отказы", "Returns")}</span><strong>${formatInt(totals.returns)}</strong></article>
    <article class="sales-kpi"><span>${tr("Реклама", "Ads spend")}</span><strong>${formatMoney(totals.ad_spend)}</strong></article>
    <article class="sales-kpi"><span>${tr("Валовая прибыль", "Gross Profit")}</span><strong>${formatMoney(totals.gross_profit)}</strong></article>
  `;
  if (currentLang !== "en") {
    const today = toYmd(new Date());
    const isTodayRange = String(document.getElementById("salesDateFrom")?.value || "") === today
      && String(document.getElementById("salesDateTo")?.value || "") === today;
    const labels = isTodayRange
      ? ["Заказано сегодня", "Штук сегодня", "Выкупов сегодня", "Выручка сегодня", "Отказов сегодня", "Реклама сегодня", "Валовая прибыль"]
      : ["Заказы", "Штуки", "Выкупы", "Выручка", "Отказы", "Реклама", "Валовая прибыль"];
    host.querySelectorAll(".sales-kpi span").forEach((node, idx) => {
      if (labels[idx]) node.textContent = labels[idx];
    });
    const fixedLabels = isTodayRange
      ? ["\u0417\u0430\u043a\u0430\u0437\u0430\u043d\u043e \u0441\u0435\u0433\u043e\u0434\u043d\u044f", "\u0428\u0442\u0443\u043a \u0441\u0435\u0433\u043e\u0434\u043d\u044f", "\u0412\u044b\u043a\u0443\u043f\u043e\u0432 \u0441\u0435\u0433\u043e\u0434\u043d\u044f", "\u0412\u044b\u0440\u0443\u0447\u043a\u0430 \u0441\u0435\u0433\u043e\u0434\u043d\u044f", "\u041e\u0442\u043a\u0430\u0437\u043e\u0432 \u0441\u0435\u0433\u043e\u0434\u043d\u044f", "\u0420\u0435\u043a\u043b\u0430\u043c\u0430 \u0441\u0435\u0433\u043e\u0434\u043d\u044f", "\u0412\u0430\u043b\u043e\u0432\u0430\u044f \u043f\u0440\u0438\u0431\u044b\u043b\u044c"]
      : ["\u0417\u0430\u043a\u0430\u0437\u044b", "\u0428\u0442\u0443\u043a\u0438", "\u0412\u044b\u043a\u0443\u043f\u044b", "\u0412\u044b\u0440\u0443\u0447\u043a\u0430", "\u041e\u0442\u043a\u0430\u0437\u044b", "\u0420\u0435\u043a\u043b\u0430\u043c\u0430", "\u0412\u0430\u043b\u043e\u0432\u0430\u044f \u043f\u0440\u0438\u0431\u044b\u043b\u044c"];
    host.querySelectorAll(".sales-kpi span").forEach((node, idx) => {
      if (fixedLabels[idx]) node.textContent = fixedLabels[idx];
    });
  }
  if (extraHost) {
    extraHost.innerHTML = `
      <article class="sales-kpi"><span>${tr("Сумма заказов", "Orders amount")}</span><strong>${formatMoney(totals.order_amount)}</strong></article>
      <article class="sales-kpi"><span>${tr("Сумма выкупов", "Buyouts amount")}</span><strong>${formatMoney(totals.buyout_amount)}</strong></article>
      <article class="sales-kpi"><span>${tr("Приход", "Income")}</span><strong>${formatMoney(totals.income)}</strong></article>
      <article class="sales-kpi"><span>${tr("Расход", "Expense")}</span><strong>${formatMoney(totals.expense)}</strong></article>
      <article class="sales-kpi"><span>${tr("Изм. баланса", "Net change")}</span><strong>${formatMoney(totals.net)}</strong></article>
      <article class="sales-kpi"><span>${tr("Штрафы", "Penalties")}</span><strong>${formatMoney(totals.penalties)}</strong></article>
      <article class="sales-kpi"><span>${tr("Комиссия", "Commission")}</span><strong>${formatMoney(totals.commission)}</strong></article>
      <article class="sales-kpi"><span>${tr("Логистика", "Logistics")}</span><strong>${formatMoney(totals.logistics)}</strong></article>
      <article class="sales-kpi"><span>${tr("Хранение", "Storage")}</span><strong>${formatMoney(totals.storage)}</strong></article>
      <article class="sales-kpi"><span>${tr("Удержания", "Deductions")}</span><strong>${formatMoney(totals.deductions)}</strong></article>
      <article class="sales-kpi"><span>${tr("Приемка", "Acceptance")}</span><strong>${formatMoney(totals.acceptance)}</strong></article>
      <article class="sales-kpi"><span>${tr("Прочие расходы", "Other expense")}</span><strong>${formatMoney(totals.other_expense)}</strong></article>
    `;
    if (currentLang !== "en") {
      const extraLabels = [
        "\u0421\u0443\u043c\u043c\u0430 \u0437\u0430\u043a\u0430\u0437\u043e\u0432",
        "\u0421\u0443\u043c\u043c\u0430 \u0432\u044b\u043a\u0443\u043f\u043e\u0432",
        "\u041f\u0440\u0438\u0445\u043e\u0434",
        "\u0420\u0430\u0441\u0445\u043e\u0434",
        "\u0418\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u0435 \u0431\u0430\u043b\u0430\u043d\u0441\u0430",
        "\u0428\u0442\u0440\u0430\u0444\u044b",
        "\u041a\u043e\u043c\u0438\u0441\u0441\u0438\u044f",
        "\u041b\u043e\u0433\u0438\u0441\u0442\u0438\u043a\u0430",
        "\u0425\u0440\u0430\u043d\u0435\u043d\u0438\u0435",
        "\u0423\u0434\u0435\u0440\u0436\u0430\u043d\u0438\u044f",
        "\u041f\u0440\u0438\u0435\u043c\u043a\u0430",
        "\u041f\u0440\u043e\u0447\u0438\u0435 \u0440\u0430\u0441\u0445\u043e\u0434\u044b",
      ];
      extraHost.querySelectorAll(".sales-kpi span").forEach((node, idx) => {
        if (extraLabels[idx]) node.textContent = extraLabels[idx];
      });
  }
  }
  if (extraWrap) {
    extraWrap.classList.toggle("hidden", !Object.keys(totals).length);
  }
}

function renderSalesChart(points) {
  const svg = document.getElementById("salesTrendChart");
  const meta = document.getElementById("salesTrendMeta");
  if (!svg || !meta) return;
  if (!Array.isArray(points) || !points.length) {
    clearChartHost(svg);
    meta.textContent = tr("Нет данных за период.", "No data for selected period.");
    return;
  }
  const metric = (document.getElementById("salesMetricMode")?.value || "units").trim().toLowerCase();
  const showWb = Boolean(document.getElementById("salesShowWb")?.checked);
  const showOzon = Boolean(document.getElementById("salesShowOzon")?.checked);
  const normalizeChartPoints = (rows) => (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      label: String(row?.bucket || row?.date || ""),
      day: String(row?.date || "").trim() || String(row?.bucket || "").trim().slice(0, 10),
      orders: Number(row?.orders || 0),
      units: Number(row?.units || 0),
      buyouts: Number(row?.buyouts || Math.max(0, Number(row?.units || 0) - Number(row?.returns || 0))),
      order_amount: Number(row?.order_amount || 0),
      buyout_amount: Number(row?.buyout_amount || 0),
      revenue: Number(row?.revenue || 0),
      returns: Number(row?.returns || 0),
      ad_spend: Number(row?.ad_spend || 0),
      penalties: Number(row?.penalties || 0),
      income: Number(row?.income || 0),
      expense: Number(row?.expense || 0),
      net: Number(row?.net || 0),
      commission: Number(row?.commission || 0),
      logistics: Number(row?.logistics || 0),
      storage: Number(row?.storage || 0),
      deductions: Number(row?.deductions || 0),
      acceptance: Number(row?.acceptance || 0),
      other_expense: Number(row?.other_expense || 0),
      wb_orders: Number(row?.wb_orders || 0),
      wb_units: Number(row?.wb_units || 0),
      wb_buyouts: Number(row?.wb_buyouts || Math.max(0, Number(row?.wb_units || 0) - Number(row?.wb_returns || 0))),
      wb_order_amount: Number(row?.wb_order_amount || 0),
      wb_buyout_amount: Number(row?.wb_buyout_amount || 0),
      wb_revenue: Number(row?.wb_revenue || 0),
      wb_returns: Number(row?.wb_returns || 0),
      wb_ad_spend: Number(row?.wb_ad_spend || 0),
      wb_penalties: Number(row?.wb_penalties || 0),
      wb_income: Number(row?.wb_income || 0),
      wb_expense: Number(row?.wb_expense || 0),
      wb_net: Number(row?.wb_net || 0),
      wb_commission: Number(row?.wb_commission || 0),
      wb_logistics: Number(row?.wb_logistics || 0),
      wb_storage: Number(row?.wb_storage || 0),
      wb_deductions: Number(row?.wb_deductions || 0),
      wb_acceptance: Number(row?.wb_acceptance || 0),
      wb_other_expense: Number(row?.wb_other_expense || 0),
      ozon_orders: Number(row?.ozon_orders || 0),
      ozon_units: Number(row?.ozon_units || 0),
      ozon_buyouts: Number(row?.ozon_buyouts || Math.max(0, Number(row?.ozon_units || 0) - Number(row?.ozon_returns || 0))),
      ozon_order_amount: Number(row?.ozon_order_amount || 0),
      ozon_buyout_amount: Number(row?.ozon_buyout_amount || 0),
      ozon_revenue: Number(row?.ozon_revenue || 0),
      ozon_returns: Number(row?.ozon_returns || 0),
      ozon_ad_spend: Number(row?.ozon_ad_spend || 0),
      ozon_penalties: Number(row?.ozon_penalties || 0),
      ozon_income: Number(row?.ozon_income || 0),
      ozon_expense: Number(row?.ozon_expense || 0),
      ozon_net: Number(row?.ozon_net || 0),
      ozon_commission: Number(row?.ozon_commission || 0),
      ozon_logistics: Number(row?.ozon_logistics || 0),
      ozon_storage: Number(row?.ozon_storage || 0),
      ozon_deductions: Number(row?.ozon_deductions || 0),
      ozon_acceptance: Number(row?.ozon_acceptance || 0),
      ozon_other_expense: Number(row?.ozon_other_expense || 0),
    }))
    .filter((row) => row.label);
  const chartPoints = normalizeChartPoints(points);
  const compareSource = (Array.isArray(salesCompareChartRows) && salesCompareChartRows.length)
    ? salesCompareChartRows
    : buildSalesChartFromRows(salesCompareRows);
  const comparePoints = normalizeChartPoints(compareSource);
  if (!chartPoints.length) {
    clearChartHost(svg);
    meta.textContent = tr("Нет данных за период.", "No data for selected period.");
    return;
  }
  const labels = chartPoints.map((x) => x.label);
  const labelDayCount = new Map();
  for (const point of chartPoints) {
    const day = String(point.day || point.label || "").slice(0, 10);
    if (!day) continue;
    labelDayCount.set(day, Number(labelDayCount.get(day) || 0) + 1);
  }
  const valueOf = (bucket, key) => {
    if (key === "orders") return Number(bucket.orders || 0);
    if (key === "buyouts") return Number(bucket.buyouts || 0);
    if (key === "order_amount") return Number(bucket.order_amount || 0);
    if (key === "buyout_amount") return Number(bucket.buyout_amount || 0);
    if (key === "revenue") return Number(bucket.revenue || 0);
    if (key === "income") return Number(bucket.income || 0);
    if (key === "expense") return Number(bucket.expense || 0);
    if (key === "net") return Number(bucket.net || 0);
    if (key === "commission") return Number(bucket.commission || 0);
    if (key === "logistics") return Number(bucket.logistics || 0);
    if (key === "storage") return Number(bucket.storage || 0);
    if (key === "deductions") return Number(bucket.deductions || 0);
    if (key === "acceptance") return Number(bucket.acceptance || 0);
    if (key === "other_expense") return Number(bucket.other_expense || 0);
    if (key === "returns") return Number(bucket.returns || 0);
    if (key === "ad_spend") return Number(bucket.ad_spend || 0);
    if (key === "penalties") return Number(bucket.penalties || 0);
    return Number(bucket.units || 0);
  };
  const countMetrics = new Set(["orders", "units", "buyouts", "returns"]);
  const normalizeMetricValue = (value) => (
    countMetrics.has(metric) ? Math.round(Number(value || 0)) : Number(value || 0)
  );
  const series = [];
  const buildMpMaps = (rows) => {
    const byBucket = new Map();
    const byDay = new Map();
    for (const row of Array.isArray(rows) ? rows : []) {
      const bucket = String(row?.bucket || row?.date || "").trim();
      const day = String(row?.date || "").trim() || bucket.slice(0, 10);
      if (!bucket) continue;
      const mp = String(row?.marketplace || "").trim().toLowerCase() === "ozon" ? "ozon" : "wb";
      const key = `${bucket}::${mp}`;
      const dayKey = `${day}::${mp}`;
      const item = byBucket.get(key) || {
        orders: 0,
        units: 0,
        buyouts: 0,
        order_amount: 0,
        buyout_amount: 0,
        revenue: 0,
        income: 0,
        expense: 0,
        net: 0,
        commission: 0,
        logistics: 0,
        storage: 0,
        deductions: 0,
        acceptance: 0,
        other_expense: 0,
        returns: 0,
        ad_spend: 0,
        penalties: 0,
      };
      item.orders += Number(row?.orders || 0);
      item.units += Number(row?.units || 0);
      item.buyouts += Number(row?.buyouts || Math.max(0, Number(row?.units || 0) - Number(row?.returns || 0)));
      item.order_amount += Number(row?.order_amount || 0);
      item.buyout_amount += Number(row?.buyout_amount || 0);
      item.revenue += Number(row?.revenue || 0);
      item.income += Number(row?.income || 0);
      item.expense += Number(row?.expense || 0);
      item.net += Number(row?.net || 0);
      item.commission += Number(row?.commission || 0);
      item.logistics += Number(row?.logistics || 0);
      item.storage += Number(row?.storage || 0);
      item.deductions += Number(row?.deductions || 0);
      item.acceptance += Number(row?.acceptance || 0);
      item.other_expense += Number(row?.other_expense || 0);
      item.returns += Number(row?.returns || 0);
      item.ad_spend += Number(row?.ad_spend || 0);
      item.penalties += Number(row?.penalties || 0);
      byBucket.set(key, item);
      const dayItem = byDay.get(dayKey) || {
        orders: 0,
        units: 0,
        buyouts: 0,
        order_amount: 0,
        buyout_amount: 0,
        revenue: 0,
        income: 0,
        expense: 0,
        net: 0,
        commission: 0,
        logistics: 0,
        storage: 0,
        deductions: 0,
        acceptance: 0,
        other_expense: 0,
        returns: 0,
        ad_spend: 0,
        penalties: 0,
      };
      dayItem.orders += Number(row?.orders || 0);
      dayItem.units += Number(row?.units || 0);
      dayItem.buyouts += Number(row?.buyouts || Math.max(0, Number(row?.units || 0) - Number(row?.returns || 0)));
      dayItem.order_amount += Number(row?.order_amount || 0);
      dayItem.buyout_amount += Number(row?.buyout_amount || 0);
      dayItem.revenue += Number(row?.revenue || 0);
      dayItem.income += Number(row?.income || 0);
      dayItem.expense += Number(row?.expense || 0);
      dayItem.net += Number(row?.net || 0);
      dayItem.commission += Number(row?.commission || 0);
      dayItem.logistics += Number(row?.logistics || 0);
      dayItem.storage += Number(row?.storage || 0);
      dayItem.deductions += Number(row?.deductions || 0);
      dayItem.acceptance += Number(row?.acceptance || 0);
      dayItem.other_expense += Number(row?.other_expense || 0);
      dayItem.returns += Number(row?.returns || 0);
      dayItem.ad_spend += Number(row?.ad_spend || 0);
      dayItem.penalties += Number(row?.penalties || 0);
      byDay.set(dayKey, dayItem);
    }
    return { byBucket, byDay };
  };
  const currentMaps = buildMpMaps(salesRows);
  const compareMaps = buildMpMaps(salesCompareRows);
  const pointMarketplaceValue = (point, mp, key) => {
    const map = {
      orders: `${mp}_orders`,
      units: `${mp}_units`,
      buyouts: `${mp}_buyouts`,
      order_amount: `${mp}_order_amount`,
      buyout_amount: `${mp}_buyout_amount`,
      revenue: `${mp}_revenue`,
      income: `${mp}_income`,
      expense: `${mp}_expense`,
      net: `${mp}_net`,
      commission: `${mp}_commission`,
      logistics: `${mp}_logistics`,
      storage: `${mp}_storage`,
      deductions: `${mp}_deductions`,
      acceptance: `${mp}_acceptance`,
      other_expense: `${mp}_other_expense`,
      returns: `${mp}_returns`,
      ad_spend: `${mp}_ad_spend`,
      penalties: `${mp}_penalties`,
    };
    const prop = map[key] || map.units;
    return Number(point?.[prop] || 0);
  };
  const hasPointMarketplaceData = (pointsList, mp) => pointsList.some((point) => {
    const val = pointMarketplaceValue(point, mp, metric);
    return Number.isFinite(val) && Math.abs(val) > 0;
  });
  const resolveMarketplaceSeries = (pointsList, maps, mp) => {
    if (hasPointMarketplaceData(pointsList, mp)) {
      return pointsList.map((point) => normalizeMetricValue(pointMarketplaceValue(point, mp, metric)));
    }
    return pointsList.map((point) => {
      const exact = maps.byBucket.get(`${point.label}::${mp}`);
      if (exact) return normalizeMetricValue(valueOf(exact, metric));
      const day = String(point.day || point.label || "").slice(0, 10);
      const dayRow = maps.byDay.get(`${day}::${mp}`);
      if (!dayRow) return 0;
      const bucketsPerDay = Math.max(1, Number(labelDayCount.get(day) || 1));
      return normalizeMetricValue(Number(valueOf(dayRow, metric) / bucketsPerDay));
    });
  };
  const currentLabel = salesCurrentLabel || tr("Текущий период", "Current period");
  const compareLabel = salesCompareLabel || tr("Предыдущий период", "Previous period");
  const palette = {
    wb: { current: "#2ec5ff", previous: "#7c61ff" },
    ozon: { current: "#34d9a3", previous: "#ff9f6b" },
  };
  if (showWb) {
    series.push({
      key: "wb",
      label: `WB • ${currentLabel}`,
      color: palette.wb.current,
      values: resolveMarketplaceSeries(chartPoints, currentMaps, "wb"),
    });
  }
  if (showOzon) {
    series.push({
      key: "ozon",
      label: `Ozon • ${currentLabel}`,
      color: palette.ozon.current,
      values: resolveMarketplaceSeries(chartPoints, currentMaps, "ozon"),
    });
  }
  if (comparePoints.length) {
    const alignCompareValues = (mp) => {
      const baseValues = resolveMarketplaceSeries(comparePoints, compareMaps, mp);
      if (baseValues.length === labels.length) return baseValues;
      return labels.map((_, idx) => baseValues[idx] ?? 0);
    };
    if (showWb) {
      series.push({
        key: "wb_prev",
        label: `WB • ${compareLabel}`,
        color: palette.wb.previous,
        values: alignCompareValues("wb"),
      });
    }
    if (showOzon) {
      series.push({
        key: "ozon_prev",
        label: `Ozon • ${compareLabel}`,
        color: palette.ozon.previous,
        values: alignCompareValues("ozon"),
      });
    }
  }
  if (!series.length) {
    clearChartHost(svg);
    meta.textContent = tr("Выберите хотя бы одну линию графика.", "Select at least one chart line.");
    return;
  }

  const allValues = series.flatMap((x) => x.values);
  const min = Math.min(...allValues, 0);
  const max = Math.max(...allValues, 0);
  const rawRange = Math.max(0, max - min);
  const yPadding = rawRange > 0 ? (rawRange * 0.08) : 1;
  const yMin = min - yPadding;
  const yMax = max + yPadding;
  const ySpan = Math.max(1e-9, yMax - yMin);
  const width = 720;
  const height = 220;
  const padX = 14;
  const padY = 12;
  const singlePoint = labels.length <= 1;
  const step = (width - padX * 2) / Math.max(1, labels.length - 1);
  const calcY = (value) => padY + (1 - ((Number(value || 0) - yMin) / ySpan)) * (height - padY * 2);
  const lineTo = (values) => values
    .map((v, idx) => {
      const x = singlePoint ? (width / 2) : (padX + idx * step);
      const y = calcY(v);
      return `${x},${y}`;
    })
    .join(" ");
  const circleAt = (value, idx, color) => {
    const x = singlePoint ? (width / 2) : (padX + idx * step);
    const y = calcY(value);
    return `<circle cx="${x}" cy="${y}" r="4.5" fill="${color}" stroke="rgba(255,255,255,0.48)" stroke-width="1"></circle>`;
  };
  const gridLines = Array.from({ length: 5 }).map((_, idx) => {
    const ratio = idx / 4;
    const y = padY + ratio * (height - padY * 2);
    const val = yMax - ratio * ySpan;
    const valueText = (metric === "revenue" || metric === "ad_spend" || metric === "penalties")
      ? formatMoney(val)
      : formatInt(val);
    return `
      <line x1="${padX}" y1="${y}" x2="${width - padX}" y2="${y}" stroke="rgba(133,165,255,0.18)" stroke-width="1" />
      <text x="${padX + 4}" y="${Math.max(10, y - 4)}" fill="rgba(205,222,255,0.7)" font-size="10">${valueText}</text>
    `;
  }).join("");
  const xTicks = labels.map((label, idx) => {
    if (labels.length > 12 && idx % Math.ceil(labels.length / 6) !== 0 && idx !== labels.length - 1) return "";
    const x = singlePoint ? (width / 2) : (padX + idx * step);
    const short = formatBucketLabel(label);
    return `<text x="${x}" y="${height - 2}" fill="rgba(205,222,255,0.66)" font-size="10" text-anchor="middle">${escapeHtml(short)}</text>`;
  }).join("");
  const lineMarkup = series.map((item, idx) => {
    const line = item.values.length > 1
      ? `<polyline points="${lineTo(item.values)}" fill="none" stroke="${item.color}" stroke-width="${idx === 0 ? 3.2 : 2.4}" stroke-linecap="round"></polyline>`
      : "";
    const points = item.values.map((v, pointIdx) => circleAt(v, pointIdx, item.color)).join("");
    return `${line}${points}`;
  }).join("");
  const metricLabels = {
    units: tr("Штуки", "Units"),
    orders: tr("Заказы", "Orders"),
    buyouts: tr("Выкупы", "Buyouts"),
    order_amount: tr("Сумма заказов", "Orders amount"),
    buyout_amount: tr("Сумма выкупов", "Buyouts amount"),
    revenue: tr("Выручка", "Revenue"),
    income: tr("Приход", "Income"),
    expense: tr("Расход", "Expense"),
    net: tr("Изменение баланса", "Net change"),
    returns: tr("Отказы", "Returns"),
    ad_spend: tr("Реклама", "Ads Spend"),
    penalties: tr("Штрафы", "Penalties"),
    commission: tr("Комиссия", "Commission"),
    logistics: tr("Логистика", "Logistics"),
    storage: tr("Хранение", "Storage"),
    deductions: tr("Удержания", "Deductions"),
    acceptance: tr("Приемка", "Acceptance"),
    other_expense: tr("Прочие расходы", "Other expense"),
  };
  const metricLabel = metricLabels[metric] || tr("Штуки", "Units");
  const moneyMetrics = new Set([
    "revenue",
    "income",
    "expense",
    "net",
    "order_amount",
    "buyout_amount",
    "ad_spend",
    "penalties",
    "commission",
    "logistics",
    "storage",
    "deductions",
    "acceptance",
    "other_expense",
  ]);
  const formatValue = moneyMetrics.has(metric) ? formatMoney : formatInt;
  const seriesSummaryHtml = series
    .map((item) => {
      const total = item.values.reduce((acc, val) => acc + Number(val || 0), 0);
      return `<span class="trend-series-item" style="--series-color:${item.color}">${escapeHtml(item.label)} <b>${escapeHtml(formatValue(total))}</b></span>`;
    })
    .join(" • ");
  const topSeries = series[0] || { values: [] };
  const topValues = Array.isArray(topSeries.values) ? topSeries.values : [];
  const peak = topValues.length ? Math.max(...topValues) : 0;
  const low = topValues.length ? Math.min(...topValues) : 0;

  function formatBucketLabel(raw) {
    const text = String(raw || "").trim();
    if (!text) return "";
    if (text.includes(" ")) return text.slice(-5);
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text.slice(5);
    return text.length > 8 ? text.slice(-8) : text;
  }
  const echartsHost = canUseEcharts(svg) ? svg : null;
  if (echartsHost) {
    const chart = getOrCreateChart(echartsHost);
    if (chart) {
      chart.setOption(
        {
          animationDuration: 420,
          grid: { top: 16, right: 18, bottom: 28, left: 56 },
          legend: {
            top: 2,
            textStyle: { color: "#5f7391", fontSize: 12 },
            data: series.map((item) => item.label),
          },
          tooltip: {
            trigger: "axis",
            backgroundColor: "rgba(17,31,58,0.92)",
            borderWidth: 0,
            textStyle: { color: "#eff6ff" },
          },
          xAxis: {
            type: "category",
            boundaryGap: singlePoint,
            data: labels.map((x) => formatBucketLabel(x)),
            axisLine: { lineStyle: { color: "rgba(99,124,161,0.35)" } },
            axisTick: { show: false },
            axisLabel: { color: "#6e86a8", fontSize: 11 },
          },
          yAxis: {
            type: "value",
            min: yMin,
            max: yMax,
            splitLine: { lineStyle: { color: "rgba(96,122,162,0.16)" } },
            axisLabel: { color: "#6e86a8", fontSize: 11 },
          },
          series: series.map((item, idx) => ({
            name: item.label,
            type: "line",
            smooth: true,
            showSymbol: false,
            data: item.values,
            lineStyle: { width: idx === 0 ? 3 : 2.2, color: item.color, type: "solid" },
            itemStyle: { color: item.color },
            areaStyle: undefined,
          })),
        },
        true
      );
      try {
        chart.resize();
      } catch (_) {}
      requestAnimationFrame(() => {
        try {
          chart.resize();
        } catch (_) {}
        setTimeout(() => {
          try {
            chart.resize();
          } catch (_) {}
        }, 90);
      });
      meta.innerHTML = `
        <span>${metricLabel}: ${seriesSummaryHtml}</span>
        <span>${tr("Пик", "Peak")}: <b>${formatValue(peak)}</b></span>
        <span>${tr("Мин", "Min")}: <b>${formatValue(low)}</b></span>
      `;
      return;
    }
  }

  const fallbackMarkup = `${gridLines}${lineMarkup}${xTicks}`;
  if (String(svg.tagName || "").toLowerCase() === "svg") {
    svg.innerHTML = fallbackMarkup;
  } else {
    svg.innerHTML = `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">${fallbackMarkup}</svg>`;
  }

  meta.innerHTML = `
    <span>${metricLabel}: ${seriesSummaryHtml}</span>
    <span>${tr("Пик", "Peak")}: <b>${formatValue(peak)}</b></span>
    <span>${tr("Мин", "Min")}: <b>${formatValue(low)}</b></span>
  `;
}

function buildSalesChartFromRows(rows) {
  if (!Array.isArray(rows) || !rows.length) return [];
  const dayMap = new Map();
  for (const row of rows) {
    const bucketKey = String(row?.bucket || row?.date || "").trim();
    const day = String(row?.date || "").trim() || bucketKey;
    if (!bucketKey) continue;
    const bucket = dayMap.get(bucketKey) || {
      date: day,
      bucket: bucketKey,
      orders: 0,
      units: 0,
      buyouts: 0,
      order_amount: 0,
      buyout_amount: 0,
      revenue: 0,
      income: 0,
      expense: 0,
      net: 0,
      commission: 0,
      logistics: 0,
      storage: 0,
      deductions: 0,
      acceptance: 0,
      other_expense: 0,
      returns: 0,
      ad_spend: 0,
      penalties: 0,
      wb_orders: 0,
      wb_units: 0,
      wb_buyouts: 0,
      wb_order_amount: 0,
      wb_buyout_amount: 0,
      wb_revenue: 0,
      wb_income: 0,
      wb_expense: 0,
      wb_net: 0,
      wb_commission: 0,
      wb_logistics: 0,
      wb_storage: 0,
      wb_deductions: 0,
      wb_acceptance: 0,
      wb_other_expense: 0,
      wb_returns: 0,
      wb_ad_spend: 0,
      wb_penalties: 0,
      ozon_orders: 0,
      ozon_units: 0,
      ozon_buyouts: 0,
      ozon_order_amount: 0,
      ozon_buyout_amount: 0,
      ozon_revenue: 0,
      ozon_income: 0,
      ozon_expense: 0,
      ozon_net: 0,
      ozon_commission: 0,
      ozon_logistics: 0,
      ozon_storage: 0,
      ozon_deductions: 0,
      ozon_acceptance: 0,
      ozon_other_expense: 0,
      ozon_returns: 0,
      ozon_ad_spend: 0,
      ozon_penalties: 0,
    };
    const mp = String(row?.marketplace || "").trim().toLowerCase();
    bucket.orders += Number(row?.orders || 0);
    bucket.units += Number(row?.units || 0);
    bucket.buyouts += Number(row?.buyouts || Math.max(0, Number(row?.units || 0) - Number(row?.returns || 0)));
    bucket.order_amount += Number(row?.order_amount || 0);
    bucket.buyout_amount += Number(row?.buyout_amount || 0);
    bucket.revenue += Number(row?.revenue || 0);
    bucket.income += Number(row?.income || 0);
    bucket.expense += Number(row?.expense || 0);
    bucket.net += Number(row?.net || 0);
    bucket.commission += Number(row?.commission || 0);
    bucket.logistics += Number(row?.logistics || 0);
    bucket.storage += Number(row?.storage || 0);
    bucket.deductions += Number(row?.deductions || 0);
    bucket.acceptance += Number(row?.acceptance || 0);
    bucket.other_expense += Number(row?.other_expense || 0);
    bucket.returns += Number(row?.returns || 0);
    bucket.ad_spend += Number(row?.ad_spend || 0);
    bucket.penalties += Number(row?.penalties || 0);
    if (mp === "wb" || mp === "ozon") {
      bucket[`${mp}_orders`] += Number(row?.orders || 0);
      bucket[`${mp}_units`] += Number(row?.units || 0);
      bucket[`${mp}_buyouts`] += Number(row?.buyouts || Math.max(0, Number(row?.units || 0) - Number(row?.returns || 0)));
      bucket[`${mp}_order_amount`] += Number(row?.order_amount || 0);
      bucket[`${mp}_buyout_amount`] += Number(row?.buyout_amount || 0);
      bucket[`${mp}_revenue`] += Number(row?.revenue || 0);
      bucket[`${mp}_income`] += Number(row?.income || 0);
      bucket[`${mp}_expense`] += Number(row?.expense || 0);
      bucket[`${mp}_net`] += Number(row?.net || 0);
      bucket[`${mp}_commission`] += Number(row?.commission || 0);
      bucket[`${mp}_logistics`] += Number(row?.logistics || 0);
      bucket[`${mp}_storage`] += Number(row?.storage || 0);
      bucket[`${mp}_deductions`] += Number(row?.deductions || 0);
      bucket[`${mp}_acceptance`] += Number(row?.acceptance || 0);
      bucket[`${mp}_other_expense`] += Number(row?.other_expense || 0);
      bucket[`${mp}_returns`] += Number(row?.returns || 0);
      bucket[`${mp}_ad_spend`] += Number(row?.ad_spend || 0);
      bucket[`${mp}_penalties`] += Number(row?.penalties || 0);
    }
    dayMap.set(bucketKey, bucket);
  }
  return [...dayMap.values()].sort((a, b) => String(a.bucket || a.date).localeCompare(String(b.bucket || b.date)));
}

function isSalesSourceWarningFatal(source, warnings = []) {
  const safeWarnings = Array.isArray(warnings) ? warnings : [];
  return safeWarnings.some((item) => {
    const warning = String(item || "").toLowerCase();
    if (!warning) return false;
    if (warning.includes("ошибка загрузки статистики")) return true;
    if (source === "wb") {
      if (!warning.includes("wb")) return false;
      if (warning.includes("кампаний много")) return false;
      if (warning.includes("показаны кэшированные данные")) return false;
      return (
        warning.includes("ключ") ||
        warning.includes("sales api") ||
        warning.includes("429") ||
        warning.includes("error") ||
        warning.includes("недоступ")
      );
    }
    if (!warning.includes("ozon")) return false;
    return (
      warning.includes("ключ") ||
      warning.includes("client_id") ||
      warning.includes("analytics api") ||
      warning.includes("error") ||
      warning.includes("недоступ")
    );
  });
}

function resolveSalesLoadProgress(market, rows, warnings = []) {
  const selected = market === "all" ? ["wb", "ozon"] : [market];
  const safeRows = Array.isArray(rows) ? rows : [];
  let loaded = 0;
  for (const source of selected) {
    const hasRows = safeRows.some((row) => String(row?.marketplace || "").toLowerCase() === source);
    if (hasRows || !isSalesSourceWarningFatal(source, warnings)) loaded += 1;
  }
  return { total: selected.length, loaded };
}

function renderSalesStats() {
  const tbody = document.getElementById("salesTable");
  if (!tbody) return;
  tbody.innerHTML = "";
  if (!Array.isArray(salesRows) || !salesRows.length) {
    const trEl = document.createElement("tr");
    trEl.innerHTML = `<td colspan="9">${tr("Нет продаж за период.", "No sales for selected period.")}</td>`;
    tbody.appendChild(trEl);
  } else {
    for (const row of salesRows) {
      const trEl = document.createElement("tr");
      trEl.innerHTML = `
        <td>${escapeHtml(row.bucket || row.date || "-")}</td>
        <td>${escapeHtml((row.marketplace || "-").toUpperCase())}</td>
        <td>${escapeHtml(formatInt(row.orders ?? 0))}</td>
        <td>${escapeHtml(formatInt(row.units ?? 0))}</td>
        <td>${escapeHtml(formatInt(row.buyouts ?? Math.max(0, Number(row.units || 0) - Number(row.returns || 0))))}</td>
        <td>${escapeHtml(formatMoney(Number(row.revenue || 0)))}</td>
        <td>${escapeHtml(formatInt(row.returns ?? 0))}</td>
        <td>${escapeHtml(formatMoney(Number(row.ad_spend || 0)))}</td>
        <td>${escapeHtml(formatMoney(Number(row.penalties || 0)))}</td>
      `;
      tbody.appendChild(trEl);
    }
  }
  renderSalesTotals();
  const chartRows = (Array.isArray(salesChartRows) && salesChartRows.length)
    ? salesChartRows
    : buildSalesChartFromRows(salesRows);
  renderSalesChart(chartRows);
}

async function loadSalesStats(retryAttempt = 0, forceRefresh = false) {
  if (modulesLoaded && !enabledModules.has("sales_stats")) {
    const meta = document.getElementById("salesStatsMeta");
    if (meta) meta.textContent = tr("Модуль статистики продаж отключен администратором.", "Sales statistics module is disabled by admin.");
    salesRows = [];
    salesChartRows = [];
    salesCompareRows = [];
    salesCompareChartRows = [];
    salesTotalsData = {};
    salesComparisonData = {};
    salesLoadProgress = { active: false, total: 0, loaded: 0 };
    salesLoadState = "idle";
    salesLoadInflightKey = "";
    updateSalesLoadStatus();
    renderSalesStats();
    return false;
  }
  let runToken = salesLoadToken;
  initSalesPeriodDefaults();
  const market = (document.getElementById("salesMarketplace")?.value || "all").trim().toLowerCase();
  const date_from = (document.getElementById("salesDateFrom")?.value || "").trim();
  const date_to = (document.getElementById("salesDateTo")?.value || "").trim();
  syncSalesRangeButtons();
  let compare_from = "";
  let compare_to = "";
  salesCompareLabel = "";
  salesCurrentLabel = "";
  if (date_from && date_to) {
    const fromDate = new Date(`${date_from}T00:00:00`);
    const toDate = new Date(`${date_to}T00:00:00`);
    const diffDays = Number.isFinite(fromDate.getTime()) && Number.isFinite(toDate.getTime())
      ? Math.round((toDate.getTime() - fromDate.getTime()) / (24 * 3600 * 1000))
      : 0;
    if (diffDays >= 0) {
      const prevTo = new Date(fromDate);
      prevTo.setDate(prevTo.getDate() - 1);
      const prevFrom = new Date(prevTo);
      prevFrom.setDate(prevFrom.getDate() - diffDays);
      compare_from = toYmd(prevFrom);
      compare_to = toYmd(prevTo);
      if (diffDays === 0) {
        salesCurrentLabel = tr("Сегодня", "Today");
        salesCompareLabel = tr("Вчера", "Yesterday");
      } else {
        salesCurrentLabel = tr("Текущий период", "Current period");
        salesCompareLabel = tr("Предыдущий период", "Previous period");
      }
    }
  }
  const qp = new URLSearchParams();
  qp.set("marketplace", market || "all");
  qp.set("granularity", "auto");
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const requestKey = `${market || "all"}|${date_from || ""}|${date_to || ""}|${tz}|${forceRefresh ? 1 : 0}`;
  if (!forceRefresh && retryAttempt === 0 && salesLoadState === "loading" && salesLoadInflightKey === requestKey) {
    return true;
  }
  salesLoadInflightKey = requestKey;
  salesLoadToken += 1;
  runToken = salesLoadToken;
  qp.set("tz", tz);
  const requestSignature = `${market || "all"}|${date_from || ""}|${date_to || ""}|${tz}`;
  if (forceRefresh) qp.set("force_refresh", "1");
  if (date_from) qp.set("date_from", date_from);
  if (date_to) qp.set("date_to", date_to);
  const meta = document.getElementById("salesStatsMeta");
  const hasRenderedSalesData = Boolean(
    (Array.isArray(salesRows) && salesRows.length)
    || (Array.isArray(salesChartRows) && salesChartRows.length)
    || Number(salesTotalsData?.orders || 0) > 0
    || Math.abs(Number(salesTotalsData?.revenue || 0)) > 0.000001
  );
  if (
    retryAttempt === 0
    && !forceRefresh
    && hasRenderedSalesData
    && salesLastRequestSignature === requestSignature
    && (Date.now() - Number(salesLastLoadedAt || 0)) < 14000
  ) {
    if (meta) meta.textContent = tr(
      "Показаны актуальные данные без повторного запроса к API.",
      "Showing up-to-date data without another API request."
    );
    salesLoadState = "success";
    salesLoadProgress = { active: false, total: market === "all" ? 2 : 1, loaded: market === "all" ? 2 : 1 };
    updateSalesLoadStatus();
    renderSalesStats();
    salesLoadInflightKey = "";
    return true;
  }
  if (meta) meta.textContent = tr("Загрузка статистики продаж...", "Loading sales statistics...");
  
  salesLoadState = "loading";
  salesLoadProgress = { active: true, total: market === "all" ? 2 : 1, loaded: 0 };
  updateSalesLoadStatus();

  let data = null;
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    data = await requestJson(`/api/sales/stats?${qp.toString()}`, {
      headers: authHeaders(),
      timeoutMs: 120000,
    }).catch((e) => {
      lastError = String(e?.message || "");
      return null;
    });
    if (data) break;
    if (attempt < 1) {
      updateSalesLoadStatus(tr("Повторный запрос статистики...", "Retrying sales request..."));
      await new Promise((resolve) => setTimeout(resolve, 900));
    }
  }
  if (!data) {
    if (runToken !== salesLoadToken) return;
    salesLoadState = "error";
    salesLoadProgress = { active: false, total: market === "all" ? 2 : 1, loaded: 0 };
    salesLoadInflightKey = "";
    updateSalesLoadStatus();
    if (meta) {
      const hasLastData = Array.isArray(salesRows) && salesRows.length > 0;
      const baseText = tr("Sales loading failed. Check API keys and period.", "Sales loading failed. Check API keys and period.");
      meta.textContent = hasLastData
        ? `${baseText} ${tr("Showing last loaded data.", "Showing last loaded data.")}`
        : baseText;
    }
    scheduleSalesLiveRefresh();
    return false;
  }

  if (runToken !== salesLoadToken) return;
  const rawRows = Array.isArray(data.rows) ? data.rows : [];
  salesRows = rawRows.filter((row) => {
    const mp = String(row?.marketplace || "").toLowerCase();
    if (market === "all") return mp === "wb" || mp === "ozon";
    return mp === market;
  });
  salesChartRows = Array.isArray(data.chart) ? data.chart : [];
  if (!salesChartRows.length && salesRows.length) {
    salesChartRows = buildSalesChartFromRows(salesRows);
  }
  const rawCompareRows = Array.isArray(data.comparison_rows) ? data.comparison_rows : [];
  salesCompareRows = rawCompareRows.filter((row) => {
    const mp = String(row?.marketplace || "").toLowerCase();
    if (market === "all") return mp === "wb" || mp === "ozon";
    return mp === market;
  });
  salesCompareChartRows = Array.isArray(data.comparison_chart) ? data.comparison_chart : [];
  if (!salesCompareChartRows.length && salesCompareRows.length) {
    salesCompareChartRows = buildSalesChartFromRows(salesCompareRows);
  }
  const totals = data.totals || {};
  const comparison = data.comparison && typeof data.comparison === "object" ? data.comparison : {};
  salesTotalsData = totals && typeof totals === "object" ? totals : {};
  salesComparisonData = comparison;
  const warnings = Array.isArray(data.warnings) ? data.warnings.filter(Boolean) : [];
  const hasWb429 = warnings.some((x) => String(x || "").includes("429"));
  if (hasWb429 && (market === "wb" || market === "all") && retryAttempt < 1) {
    if (meta) {
      meta.textContent = tr(
        "WB API временно ограничил запрос (429). Повторяем загрузку автоматически...",
        "WB API rate-limited this request (429). Retrying automatically..."
      );
    }
    salesLoadProgress = {
      active: true,
      total: market === "all" ? 2 : 1,
      loaded: 0,
    };
    salesLoadState = "loading";
    updateSalesLoadStatus(tr("Повторный запрос статистики...", "Retrying sales request..."));
    await new Promise((resolve) => setTimeout(resolve, 1200));
    if (runToken !== salesLoadToken) return;
    await loadSalesStats(retryAttempt + 1, forceRefresh);
    return;
  }
  if (meta) {
    const totalTxt = tr(
      `\u0417\u0430\u043a\u0430\u0437\u044b ${formatInt(totals.orders || 0)} \u2022 \u0428\u0442\u0443\u043a\u0438 ${formatInt(totals.units || 0)} \u2022 \u0412\u044b\u043a\u0443\u043f\u044b ${formatInt(totals.buyouts || 0)} \u2022 \u0412\u044b\u0440\u0443\u0447\u043a\u0430 ${formatMoney(totals.revenue || 0)} \u2022 \u041e\u0442\u043a\u0430\u0437\u044b ${formatInt(totals.returns || 0)}`,
      `Orders ${formatInt(totals.orders || 0)} \u2022 Units ${formatInt(totals.units || 0)} \u2022 Buyouts ${formatInt(totals.buyouts || 0)} \u2022 Revenue ${formatMoney(totals.revenue || 0)} \u2022 Returns ${formatInt(totals.returns || 0)}`
    );
    const byMarketText = market === "all"
      ? tr(
        `WB: ${formatInt(totals.wb_orders || 0)} / ${formatMoney(totals.wb_revenue || 0)} \u2022 Ozon: ${formatInt(totals.ozon_orders || 0)} / ${formatMoney(totals.ozon_revenue || 0)}`,
        `WB: ${formatInt(totals.wb_orders || 0)} / ${formatMoney(totals.wb_revenue || 0)} \u2022 Ozon: ${formatInt(totals.ozon_orders || 0)} / ${formatMoney(totals.ozon_revenue || 0)}`
      )
      : "";
    let compareText = "";
    if (Number(comparison?.period_days || 0) === 1 && comparison?.metrics) {
      const unitsCurrent = Number(comparison.metrics?.units?.current || 0);
      const unitsPrev = Number(comparison.metrics?.units?.previous || 0);
      const revenueCurrent = Number(comparison.metrics?.revenue?.current || 0);
      const revenuePrev = Number(comparison.metrics?.revenue?.previous || 0);
      compareText = tr(
        `\u0421\u0435\u0433\u043e\u0434\u043d\u044f/\u0432\u0447\u0435\u0440\u0430: \u0448\u0442\u0443\u043a\u0438 ${formatInt(unitsCurrent)} / ${formatInt(unitsPrev)}, \u0432\u044b\u0440\u0443\u0447\u043a\u0430 ${formatMoney(revenueCurrent)} / ${formatMoney(revenuePrev)}`,
        `Today/yesterday: units ${formatInt(unitsCurrent)} / ${formatInt(unitsPrev)}, revenue ${formatMoney(revenueCurrent)} / ${formatMoney(revenuePrev)}`
      );
    }
    const warnText = warnings.length
      ? tr(`\u041f\u0440\u0435\u0434\u0443\u043f\u0440\u0435\u0436\u0434\u0435\u043d\u0438\u0439: ${warnings.length}.`, `Warnings: ${warnings.length}.`)
      : "";
    meta.textContent = [totalTxt, byMarketText, compareText, warnText].filter(Boolean).join(" \u2022 ");
  }
  const progress = resolveSalesLoadProgress(market, salesRows, warnings);
  salesLoadProgress = { active: false, total: progress.total, loaded: progress.loaded };
  if (progress.total > 0 && progress.loaded === 0 && warnings.length) {
    salesLoadState = "error";
  } else if (progress.total > 0 && progress.loaded < progress.total) {
    salesLoadState = "partial";
  } else {
    salesLoadState = "success";
  }
  updateSalesLoadStatus();
  renderSalesStats();
  const shouldPollWarmSales = !forceRefresh && warnings.some((item) => {
    const text = String(item || "").toLowerCase();
    return text.includes("догру") || text.includes("фон") || text.includes("background");
  });
  if (shouldPollWarmSales) {
    updateSalesLoadStatus(tr("Данные показаны. WB догружается в фоне...", "Data is visible. WB is refreshing in background..."));
    scheduleSalesLiveRefresh();
  }
  if (retryAttempt === 0) {
    salesLastRequestSignature = requestSignature;
    salesLastLoadedAt = Date.now();
  }
  markModuleLoaded("sales");
  salesLoadInflightKey = "";
  return true;
}

async function loadBilling() {
  if (!enabledModules.has("billing")) return;
  const data = await requestJson("/api/billing", { headers: authHeaders(), timeoutMs: 60000 }).catch((e) => {
    alert(e.message);
    return null;
  });
  if (!data) return;

  const planSelect = document.getElementById("billingPlanSelect");
  if (planSelect) planSelect.value = data.plan_code || "starter";

  const summary = {
    plan_code: data.plan_code,
    status: data.status,
    monthly_price: data.monthly_price,
    renew_at: data.renew_at,
    auto_renew: data.auto_renew,
    limits: data.limits || {},
    usage: data.usage || {},
    modules: data.modules || [],
    available_plans: data.available_plans || [],
  };
  const summaryBox = document.getElementById("billingSummary");
  if (summaryBox) summaryBox.textContent = JSON.stringify(summary, null, 2);

  const historyBox = document.getElementById("billingHistory");
  if (historyBox) historyBox.textContent = JSON.stringify(data.history || [], null, 2);
}

async function changeBillingPlan() {
  if (!enabledModules.has("billing")) return;
  const plan_code = (document.getElementById("billingPlanSelect")?.value || "").trim().toLowerCase();
  if (!plan_code) return alert(tr("Выберите тариф", "Select plan"));
  const data = await requestJson("/api/billing/plan", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ plan_code }),
    timeoutMs: 60000,
  }).catch((e) => {
    alert(e.message);
    return null;
  });
  if (!data) return;
  alert(tr("Тариф обновлен", "Plan updated"));
  await loadBilling();
}

async function renewBilling() {
  if (!enabledModules.has("billing")) return;
  const data = await requestJson("/api/billing/renew", {
    method: "POST",
    headers: authHeaders(),
    timeoutMs: 60000,
  }).catch((e) => {
    alert(e.message);
    return null;
  });
  if (!data) return;
  alert(tr("Продление выполнено", "Renewal completed"));
  await loadBilling();
}

function setInputValue(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  if (typeof value === "string") {
    el.value = normalizeAppText(value, el.value || "");
    return;
  }
  el.value = value ?? "";
}

function getProfileSectionNode(sectionId) {
  const key = String(sectionId || "").trim().toLowerCase();
  if (!key) return null;
  if (profileSectionNodes.has(key)) return profileSectionNodes.get(key) || null;
  const node = document.querySelector(`#profileSectionsStorage [data-profile-section="${key}"]`);
  if (node) profileSectionNodes.set(key, node);
  return node || null;
}

function openProfileSectionModal(sectionId) {
  const key = String(sectionId || "").trim().toLowerCase();
  const modal = document.getElementById("profileSectionModal");
  const host = document.getElementById("profileSectionModalHost");
  const title = document.getElementById("profileSectionModalTitle");
  if (!modal || !host || !key) return;
  const node = getProfileSectionNode(key);
  if (!node) return;
  closeProfileSectionModal();
  activeProfileSectionId = key;
  host.appendChild(node);
  const header = String(node.dataset.profileSectionTitle || node.querySelector("h3")?.textContent || "").trim();
  if (title) title.textContent = header || tr("Профиль компании", "Company profile");
  modal.classList.remove("hidden");
}

function closeProfileSectionModal(evt) {
  const modal = document.getElementById("profileSectionModal");
  const host = document.getElementById("profileSectionModalHost");
  const storage = document.getElementById("profileSectionsStorage");
  if (!modal || !host || !storage) return;
  if (evt && evt.target && evt.target !== modal) return;
  if (activeProfileSectionId) {
    const node = getProfileSectionNode(activeProfileSectionId);
    if (node) storage.appendChild(node);
  }
  activeProfileSectionId = "";
  modal.classList.add("hidden");
}

function renderProfileData(data) {
  const actorMemberId = Number(me?.actor_member_id || 0);
  const actorRow = Array.isArray(data?.team_members)
    ? data.team_members.find((x) => Number(x.id || 0) === actorMemberId)
    : null;
  const companyAvatar = String(data?.avatar_url || "").trim();
  const actorPersonalAvatar = String(actorRow?.avatar_url || "").trim();
  const actorName = normalizeAppText(
    String(actorRow?.full_name || actorRow?.nickname || me?.actor_nick || me?.actor_email || me?.email || ""),
    String(me?.actor_nick || me?.actor_email || me?.email || "")
  );
  const actorAvatar = actorPersonalAvatar || companyAvatar;
  const introNickNode = document.getElementById("profileSectionsIntroNick");
  if (introNickNode) introNickNode.textContent = actorName || normalizeAppText(String(me?.actor_nick || me?.email || "-"), "-");

  setInputValue("profileFullName", data.full_name || "");
  setInputValue("profilePositionTitle", data.position_title || "");
  setInputValue("profileCompanyName", data.company_name || "");
  setInputValue("profileCity", data.city || "");
  setInputValue("profileLegalName", data.legal_name || "");
  setInputValue("profileLegalAddress", data.legal_address || "");
  setInputValue("profileTaxId", data.tax_id || "");
  setInputValue("profileTaxRate", data.tax_rate ?? 0);
  setInputValue("profilePhone", data.phone || "");
  setInputValue("profileTeamSize", data.team_size ?? 1);
  setInputValue("profileAvatarUrl", actorAvatar || "");
  const initials = computeAvatarInitials(actorName, me?.email);
  renderAvatarPreview("profileAvatarPreview", actorAvatar || "", initials);
  renderAvatarPicker("profileAvatarPicker", actorAvatar || "", (url) => {
    setInputValue("profileAvatarUrl", url);
    renderAvatarPreview("profileAvatarPreview", url, initials);
    if (me) {
      me.avatar_url = String(url || "");
      renderTopbarUser();
    }
  });
  if (me) {
    me.avatar_url = String(actorAvatar || "");
    renderTopbarUser();
  }
  setInputValue("profileCompanyStructure", data.company_structure || "");

  const planSelect = document.getElementById("profilePlanSelect");
  if (planSelect) {
    const plans = Array.isArray(data.available_plans) ? data.available_plans : [];
    const options = plans
      .map((x) => {
        const code = String(x.code || "").trim();
        const title = String(x.title || code).trim();
        const price = Number(x.price || 0);
        return `<option value="${escapeHtml(code)}">${escapeHtml(title)} (${price})</option>`;
      })
      .join("");
    planSelect.innerHTML = options || `<option value="${escapeHtml(data.plan_code || "starter")}">${escapeHtml(data.plan_code || "starter")}</option>`;
    planSelect.value = data.plan_code || "starter";
  }

  const planSummaryTable = document.getElementById("profilePlanSummaryTable");
  if (planSummaryTable) {
    const renewAt = String(data.renew_at || "").trim();
    const planStatus = String(data.plan_status || "-").trim() || "-";
    const planCode = String(data.plan_code || "-").trim() || "-";
    const monthlyPrice = formatMoney(Number(data.monthly_price || 0));
    planSummaryTable.innerHTML = `
      <tr><td>${escapeHtml(tr("План", "Plan"))}</td><td><b>${escapeHtml(planCode)}</b></td></tr>
      <tr><td>${escapeHtml(tr("??????", "Status"))}</td><td>${escapeHtml(planStatus)}</td></tr>
      <tr><td>${escapeHtml(tr("Цена/мес.", "Monthly price"))}</td><td>${escapeHtml(monthlyPrice)}</td></tr>
      <tr><td>${escapeHtml(tr("Продление", "Renew date"))}</td><td>${escapeHtml(renewAt || "-")}</td></tr>
    `;
  }

  if (currentLang !== "en" && planSummaryTable) {
      ["\u0422\u0430\u0440\u0438\u0444", "\u0421\u0442\u0430\u0442\u0443\u0441", "\u0426\u0435\u043d\u0430/\u043c\u0435\u0441.", "\u041f\u0440\u043e\u0434\u043b\u0435\u043d\u0438\u0435"].forEach((label, idx) => {
        const cell = planSummaryTable.querySelectorAll("td:first-child")[idx];
        if (cell) cell.textContent = label;
      });
  }
  const credentials = Array.isArray(data.credentials) ? data.credentials : [];
  const keysTable = document.getElementById("profileKeysTable");
  if (keysTable) {
    if (!credentials.length) {
      keysTable.innerHTML = `<tr><td colspan="3">${escapeHtml(tr("Ключи не подключены.", "No API keys connected."))}</td></tr>`;
    } else {
      keysTable.innerHTML = credentials
        .map((row) => `
          <tr>
            <td>${escapeHtml(String(row.marketplace || "-").toUpperCase())}</td>
            <td>${escapeHtml(String(row.api_key_masked || "-"))}</td>
            <td>${row.active ? escapeHtml(tr("Активен", "Active")) : escapeHtml(tr("Отключен", "Disabled"))}</td>
          </tr>
        `)
        .join("");
    }
  }

  const keysPanel = document.getElementById("profileKeysPanel");
  if (keysPanel && me && !me.actor_is_owner) {
    keysPanel.querySelectorAll("input").forEach((el) => { el.disabled = true; });
    keysPanel.querySelectorAll("button").forEach((el) => { el.disabled = true; });
  }

  const companySummary = document.getElementById("profileCompanySummary");
  if (companySummary) {
    const parts = [String(data.company_name || "").trim(), String(data.full_name || "").trim()].filter(Boolean);
    companySummary.textContent = parts.join(" \u2022 ") || "-";
  }
  const planSummaryShort = document.getElementById("profilePlanSummaryShort");
  if (planSummaryShort) {
    const code = String(data.plan_code || "-").trim() || "-";
    const status = String(data.plan_status || "-").trim() || "-";
    planSummaryShort.textContent = `${code} \u2022 ${status}`;
  }
  const keysSummaryShort = document.getElementById("profileKeysSummaryShort");
  if (keysSummaryShort) {
    const activeCount = credentials.filter((x) => Boolean(x?.active)).length;
    keysSummaryShort.textContent = tr(`${activeCount} активных`, `${activeCount} active`);
  }
  const aiSummaryShort = document.getElementById("profileAiSummaryShort");
  if (aiSummaryShort) {
    const effective = profileAiState?.effective || null;
    aiSummaryShort.textContent = effective
      ? `${effective.provider || "-"} \u2022 ${effective.model || "-"}`
      : tr("\u041d\u0435 \u0432\u044b\u0431\u0440\u0430\u043d", "Not selected");
  }
  const teamSummaryShort = document.getElementById("profileTeamSummaryShort");
  if (teamSummaryShort) {
    teamSummaryShort.textContent = tr(`${Array.isArray(data.team_members) ? data.team_members.length : 0} сотрудников`, `${Array.isArray(data.team_members) ? data.team_members.length : 0} employees`);
  }

  teamMembers = Array.isArray(data.team_members) ? data.team_members : [];
  const addBtn = document.getElementById("teamAddMemberBtn");
  if (addBtn) addBtn.classList.toggle("hidden", Boolean(me && !me.actor_is_owner));
  renderTeamMembers();
}

function renderProfileAiServiceOptions(forcedMode = "") {
  const sourceSelect = document.getElementById("profileAiSourceSelect");
  const serviceSelect = document.getElementById("profileAiServiceSelect");
  if (!sourceSelect || !serviceSelect) return;
  const mode = String(forcedMode || sourceSelect.value || "global_default").trim().toLowerCase();
  const globalRows = Array.isArray(profileAiState?.global_services) ? profileAiState.global_services : [];
  const userRows = Array.isArray(profileAiState?.user_services) ? profileAiState.user_services : [];
  const activeRows = mode === "global" ? globalRows : userRows;
  const prev = String(serviceSelect.value || "").trim();
  serviceSelect.innerHTML = activeRows.length
    ? activeRows.map((row) => `<option value="${Number(row.id || 0)}">#${Number(row.id || 0)} ${escapeHtml(String(row.name || "-"))} (${escapeHtml(String(row.provider || "-"))})</option>`).join("")
    : `<option value="">${tr("Нет сервисов", "No services")}</option>`;
  if (prev && [...serviceSelect.options].some((x) => x.value === prev)) {
    serviceSelect.value = prev;
    return;
  }
  const selectionServiceId = Number(profileAiState?.selection?.service_id || 0);
  if (selectionServiceId && [...serviceSelect.options].some((x) => Number(x.value) === selectionServiceId)) {
    serviceSelect.value = String(selectionServiceId);
  }
}

function renderProfileAiState(data) {
  profileAiState = data && typeof data === "object" ? data : null;
  const sourceSelect = document.getElementById("profileAiSourceSelect");
  const serviceSelect = document.getElementById("profileAiServiceSelect");
  const effectiveBox = document.getElementById("profileAiEffective");
  const table = document.getElementById("profileAiServicesTable");
  if (!sourceSelect || !serviceSelect || !effectiveBox || !table) return;

  const globalRows = Array.isArray(profileAiState?.global_services) ? profileAiState.global_services : [];
  const userRows = Array.isArray(profileAiState?.user_services) ? profileAiState.user_services : [];
  const selection = profileAiState?.selection || { use_global_default: true, mode: "builtin", service_id: null };
  const currentMode = selection.use_global_default ? "global_default" : String(selection.mode || "builtin");
  sourceSelect.value = ["global_default", "builtin", "global", "user"].includes(currentMode) ? currentMode : "global_default";
  renderProfileAiServiceOptions(sourceSelect.value);

  const effective = profileAiState?.effective || {};
  effectiveBox.textContent = `${tr("Эффективный AI", "Effective AI")}: ${effective.mode || "-"} | ${effective.provider || "-"} | ${effective.model || "-"} | ${effective.service_name || "-"}`;
  const aiSummaryShort = document.getElementById("profileAiSummaryShort");
  if (aiSummaryShort) {
    aiSummaryShort.textContent = `${effective.provider || "-"} ? ${effective.model || "-"}`;
  }

  const merged = [...globalRows, ...userRows];
  table.innerHTML = merged.length
    ? merged.map((row) => `
      <tr>
        <td>${Number(row.id || 0)}</td>
        <td>${escapeHtml(String(row.scope || "-"))}</td>
        <td>${escapeHtml(String(row.name || "-"))}</td>
        <td>${escapeHtml(String(row.provider || "-"))}</td>
        <td>${escapeHtml(String(row.model || "-"))}</td>
        <td>${escapeHtml(String(row.base_url || "-"))}</td>
        <td>${escapeHtml(String(row.api_key_masked || "-"))}</td>
        <td>
          ${row.scope === "user"
            ? `<div class="actions">
                <button class="btn-secondary" type="button" data-profile-ai-edit="${Number(row.id || 0)}">${tr("Изменить", "Edit")}</button>
                <button class="btn-danger" type="button" data-profile-ai-del="${Number(row.id || 0)}">${tr("Удалить", "Delete")}</button>
              </div>`
            : "-"}
        </td>
      </tr>
    `).join("")
    : `<tr><td colspan="8">${tr("AI сервисов пока нет.", "No AI services yet.")}</td></tr>`;

  table.querySelectorAll("[data-profile-ai-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = Number(btn.dataset.profileAiEdit || 0);
      const row = userRows.find((x) => Number(x.id) === id);
      if (!row) return;
      setInputValue("profileAiName", row.name || "");
      const provider = document.getElementById("profileAiProvider");
      if (provider) provider.value = String(row.provider || "openai");
      setInputValue("profileAiModel", row.model || "");
      setInputValue("profileAiBaseUrl", row.base_url || "");
      const addBtn = document.querySelector("button[onclick='addProfileAiService()']");
      if (addBtn) {
        addBtn.dataset.editId = String(id);
        addBtn.textContent = tr("Сохранить изменения", "Save changes");
      }
      document.getElementById("profileAiApiKey")?.focus();
    });
  });
  table.querySelectorAll("[data-profile-ai-del]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = Number(btn.dataset.profileAiDel || 0);
      if (!id) return;
      if (!confirm(tr(`Удалить AI сервис #${id}?`, `Delete AI service #${id}?`))) return;
      await requestJson(`/api/profile/ai/services/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      }).catch((e) => alert(e.message));
      await loadProfileAi();
    });
  });
}

function setTeamModalMode(mode) {
  teamModalMode = mode === "create" ? "create" : "edit";
}

function applyTeamModalHeader(mode, row = null) {
  const titleEl = document.getElementById("teamMemberEditTitle");
  const metaEl = document.getElementById("teamMemberEditMeta");
  const saveBtn = document.getElementById("teamModalSaveBtn");
  const deleteBtn = document.getElementById("teamModalDeleteBtn");
  const passLabelEl = document.getElementById("teamModalPasswordLabel");
  const passEl = document.getElementById("teamModalPassword");
  if (mode === "create") {
    if (titleEl) titleEl.textContent = tr("Новый сотрудник", "New employee");
    if (metaEl) metaEl.textContent = tr("Заполните данные и выдайте доступы к модулям.", "Fill details and grant module access.");
    if (saveBtn) saveBtn.textContent = tr("Добавить", "Add");
    if (deleteBtn) deleteBtn.classList.add("hidden");
    if (passLabelEl) passLabelEl.textContent = tr("Пароль", "Password");
    if (passEl) passEl.placeholder = tr("Пароль сотрудника (>=8)", "Employee password (>=8)");
    return;
  }
  if (saveBtn) saveBtn.textContent = tr("Сохранить", "Save");
  if (passLabelEl) passLabelEl.textContent = tr("Новый пароль", "New password");
  if (passEl) passEl.placeholder = tr("Новый пароль (опц.)", "New password (optional)");
  if (!row) return;
  if (titleEl) {
    titleEl.textContent = row.is_owner
      ? tr("Владелец кабинета", "Workspace owner")
      : tr("Сотрудник кабинета", "Workspace employee");
  }
  const isSelfEmployee = Boolean(
    me
    && !me.actor_is_owner
    && Number(me.actor_member_id || 0) > 0
    && Number(row.id || 0) === Number(me.actor_member_id || 0)
  );
  if (metaEl) {
    const metaText = row.is_owner
      ? tr("Права владельца", "Owner permissions")
      : (isSelfEmployee
        ? tr("Можно менять только свои ФИО, телефон, ник и фото.", "You can edit only your own name, phone, nickname and avatar.")
        : tr("Можно менять доступы и данные", "You can edit access and profile fields"));
    metaEl.textContent = `#${Number(row.id || 0)} - ${metaText}`;
  }
  if (deleteBtn) deleteBtn.classList.toggle("hidden", Boolean(row.is_owner || isSelfEmployee));
}

function findTeamMemberById(memberId) {
  const id = Number(memberId || 0);
  if (!id) return null;
  return teamMembers.find((x) => Number(x.id) === id) || null;
}

function summarizeTeamAccess(row) {
  if (row?.is_owner) {
    return {
      title: tr("Полный доступ", "Full access"),
      details: tr("Все модули доступны владельцу кабинета.", "All modules are available for workspace owner."),
    };
  }
  const accessCodes = Array.isArray(row?.access_scope)
    ? row.access_scope.map((x) => String(x || "").trim().toLowerCase()).filter(Boolean)
    : [];
  if (!accessCodes.length) {
    return {
      title: tr("Доступ не выдан", "No access"),
      details: tr("Модули не выбраны.", "No modules selected."),
    };
  }
  const labels = accessCodes.map((code) => moduleLabel(code));
  const shortList = labels.slice(0, 3).join(", ");
  const left = labels.length - 3;
  return {
    title: shortList || tr("Доступ назначен", "Access granted"),
    details: left > 0
      ? tr(`И еще модулей: ${left}`, `And ${left} more modules`)
      : tr(`Модулей: ${labels.length}`, `Modules: ${labels.length}`),
  };
}

function renderTeamMembers() {
  const host = document.getElementById("teamMembersList");
  if (!host) return;
  host.innerHTML = "";
  if (!Array.isArray(teamMembers) || !teamMembers.length) {
    closeTeamMemberEditor();
    host.innerHTML = `<div class="hint">${escapeHtml(tr("Сотрудников пока нет.", "No employees yet."))}</div>`;
    return;
  }
  for (const row of teamMembers) {
    const access = summarizeTeamAccess(row);
    const card = document.createElement("article");
    card.className = "team-member-row";
    const roleLabel = row.is_owner
      ? tr("Владелец", "Owner")
      : tr("Сотрудник", "Employee");
    const roleMeta = row.is_owner
      ? ""
      : (row.has_password ? tr("пароль задан", "password set") : tr("пароль не задан", "password missing"));
    const editLabel = tr("Редактировать сотрудника", "Edit employee");
    card.innerHTML = `
      <div class="team-member-row-main">
        <div class="team-member-identity">
          <strong>${escapeHtml(String(row.full_name || row.nickname || row.email || "-"))}</strong>
          <div class="hint">${escapeHtml(String(row.email || "-"))}</div>
        </div>
        <div class="team-member-role">${escapeHtml(roleMeta ? `${roleLabel} - ${roleMeta}` : roleLabel)}</div>
        <div class="team-member-access">
          <strong>${escapeHtml(access.title)}</strong>
          <div class="hint">${escapeHtml(access.details)}</div>
        </div>
      </div>
      <button class="team-row-edit" type="button" title="${escapeHtml(editLabel)}" aria-label="${escapeHtml(editLabel)}" data-team-edit="${Number(row.id || 0)}">?</button>
    `;
    card.querySelector(`[data-team-edit="${Number(row.id || 0)}"]`)?.addEventListener("click", () => openTeamMemberEditor(row.id));
    card.addEventListener("dblclick", () => openTeamMemberEditor(row.id));
    host.appendChild(card);
  }
  if (activeTeamMemberId && !findTeamMemberById(activeTeamMemberId)) {
    closeTeamMemberEditor();
  }
}

function renderTeamModalAccessPicks(selected = [], disabled = false) {
  const host = document.getElementById("teamModalAccessPicks");
  if (!host) return;
  const selectedSet = new Set(
    (Array.isArray(selected) ? selected : [])
      .map((x) => String(x || "").trim().toLowerCase())
      .filter(Boolean)
  );
  host.innerHTML = TEAM_ACCESS_MODULES
    .map((code) => `
      <label class="check">
        <input type="checkbox" data-team-modal-access="${escapeHtml(code)}" ${selectedSet.has(code) ? "checked" : ""} ${disabled ? "disabled" : ""} />
        ${escapeHtml(moduleLabel(code))}
      </label>
    `)
    .join("");
}

function collectTeamModalAccess() {
  return [...document.querySelectorAll("#teamModalAccessPicks [data-team-modal-access]")]
    .filter((el) => el.checked)
    .map((el) => String(el.dataset.teamModalAccess || "").trim().toLowerCase())
    .filter(Boolean);
}

function openTeamMemberEditor(memberId) {
  const row = findTeamMemberById(memberId);
  const modal = document.getElementById("teamMemberEditModal");
  if (!row || !modal) return;
  setTeamModalMode("edit");
  activeTeamMemberId = Number(row.id || 0);
  setInputValue("teamModalEmail", String(row.email || ""));
  setInputValue("teamModalFullName", String(row.full_name || ""));
  setInputValue("teamModalCity", String(row.city || ""));
  setInputValue("teamModalPosition", String(row.position_title || ""));
  setInputValue("teamModalPhone", String(row.phone || ""));
  setInputValue("teamModalNickname", String(row.nickname || ""));
  setInputValue("teamModalAvatar", String(row.avatar_url || ""));
  renderAvatarPreview("teamAvatarPreview", String(row.avatar_url || ""), "--");
  renderAvatarPicker("teamAvatarPicker", String(row.avatar_url || ""), (url) => {
    setInputValue("teamModalAvatar", url);
    renderAvatarPreview("teamAvatarPreview", url, "--");
  });
  setInputValue("teamModalPassword", "");
  const isSelfEmployee = Boolean(
    me
    && !me.actor_is_owner
    && Number(me.actor_member_id || 0) > 0
    && Number(row.id || 0) === Number(me.actor_member_id || 0)
  );
  const canEditIdentity = !row.is_owner && !isSelfEmployee;
  const emailEl = document.getElementById("teamModalEmail");
  const passEl = document.getElementById("teamModalPassword");
  if (emailEl) emailEl.disabled = !canEditIdentity;
  if (passEl) passEl.disabled = !canEditIdentity;
  renderTeamModalAccessPicks(Array.isArray(row.access_scope) ? row.access_scope : [], row.is_owner || isSelfEmployee);
  applyTeamModalHeader("edit", row);
  modal.classList.remove("hidden");
}

function openTeamMemberCreator() {
  if (me && !me.actor_is_owner) {
    alert(tr("Только владелец кабинета может добавлять сотрудников.", "Only workspace owner can add employees."));
    return;
  }
  const modal = document.getElementById("teamMemberEditModal");
  if (!modal) return;
  setTeamModalMode("create");
  activeTeamMemberId = 0;
  setInputValue("teamModalEmail", "");
  setInputValue("teamModalFullName", "");
  setInputValue("teamModalCity", "");
  setInputValue("teamModalPosition", "");
  setInputValue("teamModalPhone", "");
  setInputValue("teamModalNickname", "");
  setInputValue("teamModalAvatar", "");
  renderAvatarPreview("teamAvatarPreview", "", "--");
  renderAvatarPicker("teamAvatarPicker", "", (url) => {
    setInputValue("teamModalAvatar", url);
    renderAvatarPreview("teamAvatarPreview", url, "--");
  });
  setInputValue("teamModalPassword", "");
  const emailEl = document.getElementById("teamModalEmail");
  const passEl = document.getElementById("teamModalPassword");
  if (emailEl) emailEl.disabled = false;
  if (passEl) passEl.disabled = false;
  renderTeamModalAccessPicks([], false);
  applyTeamModalHeader("create", null);
  modal.classList.remove("hidden");
}

function closeTeamMemberEditor() {
  const modal = document.getElementById("teamMemberEditModal");
  if (modal) modal.classList.add("hidden");
  activeTeamMemberId = 0;
  setTeamModalMode("edit");
}

function buildTeamMemberPayloadFromModal(memberId) {
  const row = teamModalMode === "create" ? null : findTeamMemberById(memberId);
  if (teamModalMode !== "create" && !row) return null;
  const emailRaw = String(document.getElementById("teamModalEmail")?.value || "").trim();
  const email = row?.is_owner ? String(row.email || "").trim() : emailRaw;
  return {
    email,
    password: String(document.getElementById("teamModalPassword")?.value || ""),
    phone: String(document.getElementById("teamModalPhone")?.value || "").trim(),
    full_name: String(document.getElementById("teamModalFullName")?.value || "").trim(),
    city: String(document.getElementById("teamModalCity")?.value || "").trim(),
    position_title: String(document.getElementById("teamModalPosition")?.value || "").trim(),
    nickname: String(document.getElementById("teamModalNickname")?.value || "").trim(),
    avatar_url: String(document.getElementById("teamModalAvatar")?.value || "").trim(),
    access_scope: row?.is_owner ? ["*"] : collectTeamModalAccess(),
  };
}

async function saveTeamMemberEditor() {
  const id = Number(activeTeamMemberId || 0);
  const payload = buildTeamMemberPayloadFromModal(id);
  if (!payload) return;
  if (!payload.email) {
    alert(tr("Укажите email сотрудника.", "Enter employee email."));
    return;
  }
  if (teamModalMode === "create") {
    const created = await addTeamMember(payload);
    if (created) closeTeamMemberEditor();
    return;
  }
  if (!id) return;
  const updated = await updateTeamMember(id, payload);
  if (updated) closeTeamMemberEditor();
}

async function deleteTeamMemberFromModal() {
  const id = Number(activeTeamMemberId || 0);
  if (!id) return;
  const deleted = await deleteTeamMember(id);
  if (deleted) closeTeamMemberEditor();
}

async function loadProfileAi() {
  if (!enabledModules.has("user_profile")) return;
  const data = await requestJson("/api/profile/ai", {
    headers: authHeaders(),
    timeoutMs: 60000,
  }).catch((e) => {
    alert(e.message);
    return null;
  });
  if (!data) return;
  renderProfileAiState(data);
}

async function saveProfileAiSelection() {
  if (!enabledModules.has("user_profile")) return;
  const source = String(document.getElementById("profileAiSourceSelect")?.value || "global_default").trim().toLowerCase();
  const serviceId = Number(document.getElementById("profileAiServiceSelect")?.value || 0);
  const payload = {
    use_global_default: source === "global_default",
    mode: source === "global_default" ? "builtin" : source,
    service_id: source === "global" || source === "user" ? serviceId : null,
  };
  const data = await requestJson("/api/profile/ai/select", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
    timeoutMs: 60000,
  }).catch((e) => {
    alert(e.message);
    return null;
  });
  if (!data) return;
  renderProfileAiState(data);
  alert(tr("AI выбор сохранен", "AI selection saved"));
}

async function addProfileAiService() {
  if (!enabledModules.has("user_profile")) return;
  const btn = document.querySelector("button[onclick='addProfileAiService()']");
  const editId = Number(btn?.dataset?.editId || 0);
  const payload = {
    name: String(document.getElementById("profileAiName")?.value || "").trim(),
    provider: String(document.getElementById("profileAiProvider")?.value || "openai").trim().toLowerCase(),
    model: String(document.getElementById("profileAiModel")?.value || "").trim(),
    base_url: String(document.getElementById("profileAiBaseUrl")?.value || "").trim(),
    api_key: String(document.getElementById("profileAiApiKey")?.value || "").trim(),
  };
  if (!payload.name || !payload.api_key) {
    alert(tr("Укажите название и API key сервиса", "Provide service name and API key"));
    return;
  }
  const url = editId ? `/api/profile/ai/services/${editId}` : "/api/profile/ai/services";
  const method = editId ? "PUT" : "POST";
  const data = await requestJson(url, {
    method,
    headers: authHeaders(),
    body: JSON.stringify(payload),
    timeoutMs: 60000,
  }).catch((e) => {
    alert(e.message);
    return null;
  });
  if (!data) return;
  setInputValue("profileAiName", "");
  setInputValue("profileAiModel", "");
  setInputValue("profileAiBaseUrl", "");
  setInputValue("profileAiApiKey", "");
  const provider = document.getElementById("profileAiProvider");
  if (provider) provider.value = "openai";
  if (btn) {
    btn.dataset.editId = "";
    btn.textContent = tr("Добавить AI сервис", "Add AI service");
  }
  await loadProfileAi();
}

async function addTeamMember(payloadOverride = null) {
  if (!enabledModules.has("user_profile")) return null;
  if (me && !me.actor_is_owner) {
    alert(tr("Только владелец кабинета может добавлять сотрудников.", "Only workspace owner can add employees."));
    return null;
  }
  const payload = payloadOverride && typeof payloadOverride === "object"
    ? payloadOverride
    : buildTeamMemberPayloadFromModal(0);
  if (!payload) return null;
  payload.email = String(payload.email || "").trim();
  payload.password = String(payload.password || "");
  payload.phone = String(payload.phone || "").trim();
  payload.full_name = String(payload.full_name || "").trim();
  payload.city = String(payload.city || "").trim();
  payload.position_title = String(payload.position_title || "").trim();
  payload.nickname = String(payload.nickname || "").trim();
  payload.avatar_url = String(payload.avatar_url || "").trim();
  if (!Array.isArray(payload.access_scope)) payload.access_scope = [];
  if (!payload.email) {
    alert(tr("Укажите email сотрудника.", "Enter employee email."));
    return null;
  }
  const row = await requestJson("/api/profile/team", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
    timeoutMs: 60000,
  }).catch((e) => {
    alert(e.message);
    return null;
  });
  if (!row) return null;
  invalidateModuleCache("profile");
  teamMembers = [row, ...teamMembers.filter((x) => Number(x.id) !== Number(row.id))];
  renderTeamMembers();
  return row;
}

async function updateTeamMember(memberId, payloadOverride = null) {
  const id = Number(memberId || 0);
  if (!id) return;
  const current = findTeamMemberById(id);
  if (!current) return null;
  const payload = payloadOverride || {
    email: String(current.email || "").trim(),
    password: "",
    phone: String(current.phone || "").trim(),
    full_name: String(current.full_name || "").trim(),
    city: String(current.city || "").trim(),
    position_title: String(current.position_title || "").trim(),
    nickname: String(current.nickname || "").trim(),
    avatar_url: String(current.avatar_url || "").trim(),
    access_scope: Array.isArray(current.access_scope) ? current.access_scope : [],
  };
  payload.email = String(payload.email || "").trim();
  payload.phone = String(payload.phone || "").trim();
  payload.full_name = String(payload.full_name || "").trim();
  payload.city = String(payload.city || "").trim();
  payload.position_title = String(payload.position_title || "").trim();
  payload.nickname = String(payload.nickname || "").trim();
  payload.avatar_url = String(payload.avatar_url || "").trim();
  if (!payload.email) {
    alert(tr("Email сотрудника обязателен.", "Employee email is required."));
    return null;
  }
  const row = await requestJson(`/api/profile/team/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(payload),
    timeoutMs: 60000,
  }).catch((e) => {
    alert(e.message);
    return null;
  });
  if (!row) return;
  invalidateModuleCache("profile");
  teamMembers = teamMembers.map((x) => (Number(x.id) === id ? row : x));
  if (me && Number(me.actor_member_id || 0) === id) {
    me.avatar_url = String(row.avatar_url || "").trim();
    renderTopbarUser();
  }
  renderTeamMembers();
  return row;
}

async function deleteTeamMember(memberId) {
  const id = Number(memberId || 0);
  if (!id) return false;
  if (!confirm(tr("Удалить сотрудника из кабинета?", "Delete employee from workspace?"))) return false;
  const result = await requestJson(`/api/profile/team/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
    timeoutMs: 60000,
  }).catch((e) => {
    alert(e.message);
    return null;
  });
  if (!result) return false;
  invalidateModuleCache("profile");
  teamMembers = teamMembers.filter((x) => Number(x.id) !== id);
  renderTeamMembers();
  if (activeTeamMemberId === id) closeTeamMemberEditor();
  return true;
}

async function loadProfile() {
  if (!enabledModules.has("user_profile")) return;
  ensureProfileTeamUi();
  const data = await requestJson("/api/profile", { headers: authHeaders(), timeoutMs: 60000 }).catch((e) => {
    alert(e.message);
    return null;
  });
  if (!data) return;
  renderProfileData(data);
  await loadProfileAi();
  markModuleLoaded("profile");
  if (pendingProfileActorFocus) {
    pendingProfileActorFocus = false;
    const actorMemberId = Number(me?.actor_member_id || 0);
    if (actorMemberId && findTeamMemberById(actorMemberId)) {
      openTeamMemberEditor(actorMemberId);
    } else {
      openProfileSectionModal("company");
    }
  }
}

async function saveProfileData() {
  if (!enabledModules.has("user_profile")) return;
  if (me && !me.actor_is_owner) {
    const actorMemberId = Number(me.actor_member_id || 0);
    const actorRow = findTeamMemberById(actorMemberId);
    if (!actorMemberId || !actorRow) {
      alert(tr("Профиль сотрудника не найден.", "Employee profile is not found."));
      return;
    }
    const updated = await updateTeamMember(actorMemberId, {
      email: String(actorRow.email || "").trim(),
      password: "",
      phone: String(document.getElementById("profilePhone")?.value || "").trim(),
      full_name: String(document.getElementById("profileFullName")?.value || "").trim(),
      city: String(document.getElementById("profileCity")?.value || "").trim(),
      position_title: String(document.getElementById("profilePositionTitle")?.value || "").trim(),
      nickname: String(actorRow.nickname || "").trim(),
      avatar_url: String(document.getElementById("profileAvatarUrl")?.value || "").trim(),
      access_scope: Array.isArray(actorRow.access_scope) ? actorRow.access_scope : [],
    });
    if (!updated) return;
    invalidateModuleCache("profile");
    await loadProfile();
    alert(tr("Профиль сохранен", "Profile saved"));
    return;
  }
  const payload = {
    full_name: document.getElementById("profileFullName")?.value || "",
    position_title: document.getElementById("profilePositionTitle")?.value || "",
    company_name: document.getElementById("profileCompanyName")?.value || "",
    city: document.getElementById("profileCity")?.value || "",
    legal_name: document.getElementById("profileLegalName")?.value || "",
    legal_address: document.getElementById("profileLegalAddress")?.value || "",
    tax_id: document.getElementById("profileTaxId")?.value || "",
    tax_rate: Number(document.getElementById("profileTaxRate")?.value || 0),
    phone: document.getElementById("profilePhone")?.value || "",
    team_size: Number(document.getElementById("profileTeamSize")?.value || 1),
    avatar_url: document.getElementById("profileAvatarUrl")?.value || "",
    company_structure: document.getElementById("profileCompanyStructure")?.value || "",
  };
  const data = await requestJson("/api/profile", {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(payload),
    timeoutMs: 60000,
  }).catch((e) => {
    alert(e.message);
    return null;
  });
  if (!data) return;
  invalidateModuleCache("profile");
  renderProfileData(data);
  alert(tr("Профиль сохранен", "Profile saved"));
}

async function changeProfilePlan() {
  if (!enabledModules.has("user_profile")) return;
  const plan_code = (document.getElementById("profilePlanSelect")?.value || "").trim().toLowerCase();
  if (!plan_code) return alert(tr("Выберите тариф", "Select plan"));
  const data = await requestJson("/api/profile/plan", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ plan_code }),
    timeoutMs: 60000,
  }).catch((e) => {
    alert(e.message);
    return null;
  });
  if (!data) return;
  invalidateModuleCache("profile", "billing");
  renderProfileData(data);
  alert(tr("Тариф обновлен", "Plan updated"));
}

async function renewProfilePlan() {
  if (!enabledModules.has("user_profile")) return;
  const data = await requestJson("/api/profile/renew", {
    method: "POST",
    headers: authHeaders(),
    timeoutMs: 60000,
  }).catch((e) => {
    alert(e.message);
    return null;
  });
  if (!data) return;
  invalidateModuleCache("profile", "billing");
  renderProfileData(data);
  alert(tr("Продление выполнено", "Renewal completed"));
}

async function changeProfilePassword() {
  if (!enabledModules.has("user_profile")) return;
  const current_password = document.getElementById("profileCurrentPassword")?.value || "";
  const new_password = document.getElementById("profileNewPassword")?.value || "";
  if (!current_password || !new_password) {
    return alert(tr("Заполните текущий и новый пароль", "Fill both current and new passwords"));
  }
  if (new_password.length < 8) {
    return alert(tr("Новый пароль должен быть минимум 8 символов", "New password must be at least 8 characters"));
  }
  const data = await requestJson("/api/profile/password", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ current_password, new_password }),
    timeoutMs: 60000,
  }).catch((e) => {
    alert(e.message);
    return null;
  });
  if (!data) return;
  invalidateModuleCache("profile");
  setInputValue("profileCurrentPassword", "");
  setInputValue("profileNewPassword", "");
  alert(data.message || tr("Пароль обновлен", "Password updated"));
}

function getProfileKeyInput(marketplace) {
  return document.getElementById(marketplace === "wb" ? "profileWbKey" : "profileOzonKey");
}

async function saveProfileKey(marketplace) {
  const input = getProfileKeyInput(marketplace);
  const api_key = input?.value?.trim() || "";
  if (!api_key) return alert(tr("Введите API ключ", "Enter API key"));
  await requestJson("/api/credentials", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ marketplace, api_key }),
  }).catch((e) => alert(e.message));
  invalidateModuleCache("profile", "products", "sales", "accounting", "ads", "reviews");
  if (input) input.value = "";
  await loadProfile();
}

async function testProfileKey(marketplace) {
  const input = getProfileKeyInput(marketplace);
  const api_key = input?.value?.trim() || "";
  if (!api_key) return alert(tr("Введите API ключ", "Enter API key"));
  const data = await requestJson("/api/credentials/test", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ marketplace, api_key }),
  }).catch((e) => {
    alert(e.message);
    return null;
  });
  if (!data) return;
  alert(data.message || (data.ok ? tr("Ключ валиден", "Key is valid") : tr("Ключ не валиден", "Invalid key")));
}

async function deleteProfileKey(marketplace) {
  if (!confirm(tr(`Удалить ключ ${marketplace.toUpperCase()}?`, `Delete ${marketplace.toUpperCase()} key?`))) return;
  const data = await requestJson(`/api/credentials/${marketplace}`, {
    method: "DELETE",
    headers: authHeaders(),
  }).catch((e) => {
    alert(e.message);
    return null;
  });
  if (data?.message) alert(data.message);
  invalidateModuleCache("profile", "products", "sales", "accounting", "ads", "reviews");
  await loadProfile();
}

async function loadHelpDocs() {
  const canDocs = enabledModules.has("help_center");
  const canAssistant = enabledModules.has("ai_assistant");
  if (!canDocs && !canAssistant) return;
  pruneLegacyUi();
  const lang = (currentLang || "ru").trim().toLowerCase();
  if (!canDocs) {
    helpDocsRows = [];
    helpReleaseRows = [];
    const select = document.getElementById("helpModuleSelect");
    if (select) {
      select.innerHTML = `<option value="">${lang === "en" ? "Help module is disabled" : "Модуль справки отключен"}</option>`;
      select.value = "";
    }
    const view = document.getElementById("helpDocsView");
    if (view) {
      view.innerHTML = `<div class="help-empty">${
        lang === "en"
          ? "Help docs are disabled for your account."
          : "Документация отключена для вашего доступа."
      }</div>`;
    }
    const downloadsCurrent = document.getElementById("helpDownloadsCurrent");
    const downloadsList = document.getElementById("helpDownloadsList");
    if (downloadsCurrent) {
      downloadsCurrent.innerHTML = `<div class="help-empty">${
        lang === "en"
          ? "Downloads are unavailable for your access."
          : "Загрузки недоступны для вашего доступа."
      }</div>`;
    }
    if (downloadsList) downloadsList.innerHTML = "";
    renderHelpAssistantModuleOptions();
    markModuleLoaded("help");
    return;
  }
  const moduleCode = (document.getElementById("helpModuleSelect")?.value || "").trim();
  const qp = new URLSearchParams();
  qp.set("lang", lang === "en" ? "en" : "ru");
  const data = await requestJson(`/api/help/docs?${qp.toString()}`, { headers: authHeaders() }).catch((e) => {
    alert(e.message);
    return null;
  });
  if (!data) return;
  const rows = Array.isArray(data) ? data : [];
  helpDocsRows = rows;
  const select = document.getElementById("helpModuleSelect");
  if (select) {
    const prev = select.value;
    const pairs = new Map();
    for (const item of rows) {
      const code = String(item?.module_code || "").trim();
      if (!code) continue;
      const title = String(item?.title || code).trim();
      if (!pairs.has(code)) pairs.set(code, title);
    }
    const options = [...pairs.entries()].map(([code, title]) => `<option value="${code}">${escapeHtml(title)} (${escapeHtml(code)})</option>`).join("");
    select.innerHTML = `<option value="">${lang === "en" ? "All modules" : "Все модули"}</option>${options}`;
    select.innerHTML = `<option value="">${lang === "en" ? "All modules" : "\u0412\u0441\u0435 \u043c\u043e\u0434\u0443\u043b\u0438"}</option>${options}`;
    if (prev && [...select.options].some((opt) => opt.value === prev)) {
      select.value = prev;
    } else if (moduleCode && [...select.options].some((opt) => opt.value === moduleCode)) {
      select.value = moduleCode;
    }
  }
  const selectedCode = (document.getElementById("helpModuleSelect")?.value || "").trim();
  const view = document.getElementById("helpDocsView");
  if (!view) return;
  if (!rows.length) {
    view.innerHTML = `<div class="help-empty">${lang === "en" ? "No help data." : "Нет данных справки."}</div>`;
    return;
  }
  const unique = new Map();
  for (const row of rows) {
    const code = String(row?.module_code || "").trim();
    const title = String(row?.title || code || "-").trim();
    if (!code || unique.has(code)) continue;
    unique.set(code, title);
  }
  const moduleChips = [...unique.entries()].map(([code, title]) => {
    const activeClass = selectedCode === code ? "active" : "";
    return `
      <button class="help-chip-btn ${activeClass}" type="button" onclick="filterHelpModule('${escapeHtml(code)}')">
        ${escapeHtml(title)}
      </button>
    `;
  }).join("");

  const filteredRows = selectedCode
    ? rows.filter((row) => String(row?.module_code || "").trim() === selectedCode)
    : rows;
  const cards = filteredRows.map((row) => {
    const code = String(row?.module_code || "").trim();
    const title = String(row?.title || code || "-").trim();
    const activeClass = selectedCode === code ? "active" : "";
    return `
      <article class="help-card ${activeClass ? "selected" : ""}" id="help-card-${escapeHtml(code)}">
        <header class="help-card-head">
          <div>
            <h4>${escapeHtml(title)}</h4>
            <small>[${escapeHtml(code)}]</small>
          </div>
          <div class="help-card-actions">
            <button class="btn-secondary help-open-btn" type="button" onclick="filterHelpModule('${escapeHtml(code)}')">
              ${lang === "en" ? "Show module help" : "Показать справку модуля"}
            </button>
            <button class="help-filter-btn" type="button" onclick="filterHelpModule('${escapeHtml(code)}')">
              ${lang === "en" ? "Highlight module" : "Подсветить модуль"}
            </button>
          </div>
        </header>
        <div class="help-card-body">${formatHelpContent(String(row?.content || ""), lang)}</div>
        <div class="help-checklist">
          <strong>${lang === "en" ? "Quick checklist" : "Быстрый чек-лист"}</strong>
          <ol>
            <li>${lang === "en" ? "Open the module from the left menu." : "Откройте модуль через левое меню."}</li>
            <li>${lang === "en" ? "Fill required filters/fields before action." : "Заполните обязательные поля/фильтры перед запуском."}</li>
            <li>${lang === "en" ? "Run action and watch the status bar." : "Запустите действие и контролируйте статус-бар."}</li>
            <li>${lang === "en" ? "Check resulting table and totals." : "Проверьте итоговую таблицу и сводные показатели."}</li>
            <li>${lang === "en" ? "If something looks wrong, refresh the module and check warnings in the status line." : "Если данные выглядят некорректно, обновите модуль и проверьте предупреждения в строке статуса."}</li>
          </ol>
        </div>
      </article>
    `;
  }).join("");

  view.innerHTML = `
    <div class="help-header">
      <div class="help-header-title">
        <h4>${lang === "en" ? "Interactive help center" : "Интерактивная справка"}</h4>
        <p>${lang === "en"
      ? (selectedCode ? "Showing help for selected module." : "Select module to open focused help.")
      : (selectedCode ? "Показана справка только по выбранному модулю." : "Выберите модуль, чтобы открыть целевую справку.")}</p>
      </div>
      <div class="help-chip-list">${moduleChips}</div>
    </div>
    <div class="help-card-list">${cards || `<div class="help-empty">${lang === "en" ? "Module help not found." : "Справка по модулю не найдена."}</div>`}</div>
  `;
  if (lang !== "en") {
    const helpTitle = view.querySelector(".help-header-title h4");
    if (helpTitle) helpTitle.textContent = "Интерактивная справка";
    const helpSubtitle = view.querySelector(".help-header-title p");
    if (helpSubtitle) {
      helpSubtitle.textContent = selectedCode
        ? "Показана справка только по выбранному модулю."
        : "Выберите модуль, чтобы открыть целевую справку.";
    }
    view.querySelectorAll(".help-open-btn").forEach((btn) => {
      btn.textContent = "Показать справку модуля";
    });
    view.querySelectorAll(".help-filter-btn").forEach((btn) => {
      btn.textContent = "Подсветить модуль";
    });
    view.querySelectorAll(".help-checklist strong").forEach((el) => {
      el.textContent = "Быстрый чек-лист";
    });
    const checklistRows = [
      "Откройте модуль через левое меню.",
      "Заполните обязательные поля и фильтры перед запуском.",
      "Запустите действие и контролируйте статус-бар.",
      "Проверьте итоговую таблицу и сводные показатели.",
      "Если данные выглядят некорректно, обновите модуль и проверьте предупреждения в строке статуса.",
    ];
    view.querySelectorAll(".help-checklist li").forEach((el, index) => {
      if (checklistRows[index]) el.textContent = checklistRows[index];
    });
    const emptyHelp = view.querySelector(".help-card-list .help-empty");
    if (emptyHelp) emptyHelp.textContent = "Справка по модулю не найдена.";
  }
  renderHelpAssistantModuleOptions();
  markModuleLoaded("help");
}

async function loadHelpReleases() {
  if (!enabledModules.has("help_center")) return;
  const lang = (currentLang || "ru").trim().toLowerCase() === "en" ? "en" : "ru";
  const currentHost = document.getElementById("helpDownloadsCurrent");
  const listHost = document.getElementById("helpDownloadsList");
  if (!currentHost || !listHost) return;
  const qp = new URLSearchParams();
  qp.set("lang", lang);
  const data = await requestJson(`/api/help/releases?${qp.toString()}`, { headers: authHeaders() }).catch((e) => {
    currentHost.innerHTML = `<div class="help-callout warn"><strong>${escapeHtml(String(e?.message || "Error"))}</strong></div>`;
    return null;
  });
  if (!data) return;
  const rows = Array.isArray(data) ? data : [];
  helpReleaseRows = rows;
  if (!rows.length) {
    currentHost.innerHTML = `<div class="help-empty">${lang === "en" ? "No release data yet." : "Данные релизов пока отсутствуют."}</div>`;
    if (lang !== "en") currentHost.innerHTML = `<div class="help-empty">Данные релизов пока отсутствуют.</div>`;
    listHost.innerHTML = "";
    return;
  }
  const currentRow = rows.find((x) => Boolean(x?.current)) || rows[0];
  const currentVersion = escapeHtml(String(currentRow?.version || "-"));
  const currentCode = Number(currentRow?.android_version_code || 0);
  const releaseDate = escapeHtml(String(currentRow?.released_at || "-"));
  const currentSummary = escapeHtml(String(currentRow?.summary || ""));
  const downloadUrl = String(currentRow?.android_download_url || "/static/downloads/seo-wibe-mobile-latest.apk");
  const downloadName = escapeHtml(String(currentRow?.android_download_name || "SEO WIBE Mobile"));
  const diffItems = Array.isArray(currentRow?.diff_from_previous)
    ? currentRow.diff_from_previous.filter(Boolean).map((line) => `<li>${escapeHtml(String(line))}</li>`).join("")
    : "";
  const notesText = escapeHtml(String(currentRow?.notes || ""));
  currentHost.innerHTML = `
    <article class="help-card selected">
      <header class="help-card-head">
        <div>
          <h4>${lang === "en" ? "Current version" : "Текущая версия"} ${currentVersion}</h4>
          <small>${releaseDate}${currentCode > 0 ? ` ? code ${currentCode}` : ""}</small>
        </div>
        <div class="help-card-actions">
          <a class="btn-secondary help-open-btn" href="${escapeHtml(downloadUrl)}" target="_blank" rel="noopener noreferrer">
            ${lang === "en" ? "Download Android APK" : "Скачать Android APK"}
          </a>
        </div>
      </header>
      <div class="help-card-body">
        <section class="help-callout main"><strong>${currentSummary || "-"}</strong></section>
        <section class="help-block">
          <h5>${lang === "en" ? "Android APK" : "Android APK"}</h5>
          <p>${downloadName}</p>
          ${notesText ? `<p>${notesText}</p>` : ""}
        </section>
        ${diffItems ? `<section class="help-block"><h5>${lang === "en" ? "Difference from previous version" : "Отличия от прошлой версии"}</h5><ul>${diffItems}</ul></section>` : ""}
      </div>
    </article>
  `;
  if (lang !== "en") {
    const currentTitle = currentHost.querySelector(".help-card-head h4");
    if (currentTitle) currentTitle.textContent = `Текущая версия ${currentVersion}`;
    const currentMeta = currentHost.querySelector(".help-card-head small");
    if (currentMeta) currentMeta.textContent = `${releaseDate}${currentCode > 0 ? `, code ${currentCode}` : ""}`;
    const downloadBtn = currentHost.querySelector(".help-open-btn");
    if (downloadBtn) downloadBtn.textContent = "Скачать Android APK";
    const currentBlocks = currentHost.querySelectorAll(".help-block h5");
    if (currentBlocks[1]) currentBlocks[1].textContent = "Отличия от прошлой версии";
  }

  const cards = rows.map((row) => {
    const version = escapeHtml(String(row?.version || "-"));
    const versionCode = Number(row?.android_version_code || 0);
    const date = escapeHtml(String(row?.released_at || "-"));
    const summary = escapeHtml(String(row?.summary || ""));
    const changes = Array.isArray(row?.changes)
      ? row.changes.filter(Boolean).map((line) => `<li>${escapeHtml(String(line))}</li>`).join("")
      : "";
    return `
      <article class="help-card ${row?.current ? "selected" : ""}">
        <header class="help-card-head">
          <div>
            <h4>${version}</h4>
            <small>${date}${versionCode > 0 ? ` ? code ${versionCode}` : ""}</small>
          </div>
        </header>
        <div class="help-card-body">
          <section class="help-block"><p>${summary || "-"}</p></section>
          ${changes ? `<section class="help-block"><ul>${changes}</ul></section>` : ""}
        </div>
      </article>
    `;
  }).join("");

  listHost.innerHTML = `
    <div class="help-header">
      <div class="help-header-title">
        <h4>${lang === "en" ? "APK version history" : "История APK версий"}</h4>
        <p>${lang === "en" ? "Only Android APK releases with short release notes." : "Здесь отображаются только Android APK версии и краткие примечания к релизу."}</p>
      </div>
    </div>
    <div class="help-card-list">${cards}</div>
  `;
  if (lang !== "en") {
    const releasesTitle = listHost.querySelector(".help-header-title h4");
    if (releasesTitle) releasesTitle.textContent = "История APK версий";
    const releasesSubtitle = listHost.querySelector(".help-header-title p");
    if (releasesSubtitle) {
      releasesSubtitle.textContent = "Здесь отображаются только Android APK версии и краткие примечания к релизу.";
    }
    listHost.querySelectorAll(".help-card-head small").forEach((el, index) => {
      const row = rows[index];
      const code = Number(row?.android_version_code || 0);
      const date = String(row?.released_at || "-");
      el.textContent = `${date}${code > 0 ? `, code ${code}` : ""}`;
    });
  }
}

function formatHelpContent(text, lang = "ru") {
  const blocks = String(text || "")
    .split(/\n{2,}/)
    .map((x) => x.trim())
    .filter(Boolean);
  if (!blocks.length) return `<p>-</p>`;

  const isRu = String(lang || "ru").toLowerCase() !== "en";
  return blocks.map((block) => {
    const lines = block.split("\n").map((x) => x.trim()).filter(Boolean);
    if (!lines.length) return "";
    const firstRaw = lines[0];
    const first = firstRaw.toLowerCase();

    const numbered = lines.every((line) => /^\d+[).]\s+/.test(line));
    const bullets = lines.every((line) => /^[-??]\s+/.test(line));
    const headerAndBullets = lines.length > 1 && /:\s*$/.test(firstRaw) && lines.slice(1).every((line) => /^[-??]\s+/.test(line));

    if (headerAndBullets) {
      const items = lines.slice(1).map((line) => `<li>${escapeHtml(line.replace(/^[-??]\s+/, ""))}</li>`).join("");
      return `<section class="help-block"><h5>${escapeHtml(firstRaw)}</h5><ul>${items}</ul></section>`;
    }
    if (numbered) {
      const items = lines.map((line) => `<li>${escapeHtml(line.replace(/^\d+[).]\s+/, ""))}</li>`).join("");
      return `<section class="help-block"><ol>${items}</ol></section>`;
    }
    if (bullets) {
      const items = lines.map((line) => `<li>${escapeHtml(line.replace(/^[-??]\s+/, ""))}</li>`).join("");
      return `<section class="help-block"><ul>${items}</ul></section>`;
    }
    if (first.startsWith("назначение:") || first.startsWith("purpose:")) {
      return `<section class="help-callout main"><strong>${escapeHtml(firstRaw)}</strong></section>`;
    }
    if (first.startsWith("пример:") || first.startsWith("example:")) {
      return `<section class="help-callout example"><strong>${isRu ? "Пример" : "Example"}:</strong> ${escapeHtml(firstRaw.replace(/^пример:\s*/i, "").replace(/^example:\s*/i, ""))}</section>`;
    }
    if (first.startsWith("важно:") || first.startsWith("important:")) {
      return `<section class="help-callout warn"><strong>${escapeHtml(firstRaw)}</strong></section>`;
    }
    return `<section class="help-block"><p>${lines.map((line) => escapeHtml(line)).join("<br>")}</p></section>`;
  }).join("");
}

function filterHelpModule(moduleCode) {
  const select = document.getElementById("helpModuleSelect");
  if (!select) return;
  select.value = String(moduleCode || "").trim();
  loadHelpDocs();
}

function openHelpModule(moduleCode) {
  filterHelpModule(moduleCode);
}

function renderHelpAssistantModuleOptions() {
  const select = document.getElementById("helpAssistantModuleSelect");
  const hint = document.getElementById("helpAssistantHint");
  if (!select) return;

  const prev = String(select.value || "").trim();
  const byCode = new Map();
  for (const row of Array.isArray(helpDocsRows) ? helpDocsRows : []) {
    const code = String(row?.module_code || "").trim();
    if (!code || byCode.has(code)) continue;
    byCode.set(code, String(row?.title || moduleLabel(code) || code).trim());
  }
  if (!byCode.size) {
    for (const code of [...enabledModules]) {
      const safe = String(code || "").trim();
      if (!safe) continue;
      byCode.set(safe, moduleLabel(safe));
    }
  }
  const rows = [...byCode.entries()];
  const allLabel = currentLang === "en" ? "All modules" : "Все модули";
  select.innerHTML = `<option value="">${escapeHtml(allLabel)}</option>${rows
    .map(([code, title]) => `<option value="${escapeHtml(code)}">${escapeHtml(title)} (${escapeHtml(code)})</option>`)
    .join("")}`;
  if (prev && [...select.options].some((x) => x.value === prev)) {
    select.value = prev;
  }

  if (!hint) return;
  if (!enabledModules.has("ai_assistant")) {
    hint.textContent = currentLang === "en"
      ? "AI assistant is disabled for your access."
      : "AI помощник отключен для вашего доступа.";
    return;
  }
  const effective = profileAiState?.effective || {};
  const provider = String(effective.provider || "-");
  const model = String(effective.model || "-");
  const source = String(effective.service_name || effective.mode || "-");
  hint.textContent = `${tr("Текущий AI", "Current AI")}: ${source} | ${provider} | ${model}`;
}

function renderHelpAssistantHistory() {
  const host = document.getElementById("helpAssistantHistory");
  if (!host) return;
  if (!helpAssistantHistory.length) {
    host.innerHTML = `<div class="help-empty">${currentLang === "en" ? "Ask your first question." : "Задайте первый вопрос."}</div>`;
    return;
  }
  host.innerHTML = helpAssistantHistory
    .slice()
    .reverse()
    .map((item) => {
      const metaBits = [];
      if (item?.module_code) metaBits.push(`#${String(item.module_code)}`);
      if (item?.provider) metaBits.push(String(item.provider));
      if (item?.service_name) metaBits.push(String(item.service_name));
      const meta = metaBits.join(" • ");
      return `
        <article class="help-card selected">
          <header class="help-card-head">
            <div>
              <h4>${escapeHtml(tr("Вопрос", "Question"))}</h4>
              <small>${escapeHtml(meta || "-")}</small>
            </div>
          </header>
          <div class="help-card-body">
            <section class="help-block"><p>${escapeHtml(String(item?.question || "-"))}</p></section>
            <section class="help-callout main"><strong>${escapeHtml(tr("Ответ", "Answer"))}:</strong> ${escapeHtml(String(item?.answer || "-"))}</section>
          </div>
        </article>
      `;
    })
    .join("");
}

async function askHelpAssistant() {
  if (!enabledModules.has("ai_assistant")) {
    alert(tr("Модуль AI помощника недоступен.", "AI assistant module is unavailable."));
    return;
  }
  const input = document.getElementById("helpAssistantQuestion");
  const moduleSel = document.getElementById("helpAssistantModuleSelect");
  const askBtn = document.querySelector("#helpSubtabAssistant .grid-3 button");
  const hint = document.getElementById("helpAssistantHint");
  const question = String(input?.value || "").split(/\s+/).join(" ").trim();
  if (question.length < 3) {
    alert(tr("Введите вопрос подробнее (минимум 3 символа).", "Enter a more detailed question (min 3 chars)."));
    return;
  }
  const moduleCode = String(moduleSel?.value || "").trim();
  if (askBtn) askBtn.disabled = true;
  if (hint) hint.textContent = tr("Генерирую ответ...", "Generating response...");
  const data = await requestJson("/api/help/assistant", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ question, module_code: moduleCode }),
    timeoutMs: 120000,
  }).catch((e) => {
    alert(e.message);
    return null;
  });
  if (askBtn) askBtn.disabled = false;
  if (!data) {
    if (hint) hint.textContent = tr("Не удалось получить ответ. Повторите запрос.", "Failed to get response. Please retry.");
    return;
  }
  helpAssistantHistory.push({
    question,
    answer: String(data.answer || ""),
    provider: String(data.provider || ""),
    mode: String(data.mode || ""),
    service_name: String(data.service_name || ""),
    module_code: moduleCode,
  });
  if (helpAssistantHistory.length > 20) {
    helpAssistantHistory = helpAssistantHistory.slice(-20);
  }
  if (input) input.value = "";
  if (hint) {
    hint.textContent = `${tr("Ответ получен", "Response ready")}: ${data.service_name || data.mode || "-"} | ${data.provider || "-"}`;
  }
  renderHelpAssistantHistory();
}

window.openHelpModule = openHelpModule;
window.filterHelpModule = filterHelpModule;

async function loadAdmin() {
  if (!me || me.role !== "admin") return;
  const [users, modules, stats] = await Promise.all([
    requestJson("/api/admin/users", { headers: authHeaders() }).catch(() => null),
    requestJson("/api/admin/modules", { headers: authHeaders() }).catch(() => null),
    requestJson("/api/admin/stats", { headers: authHeaders() }).catch(() => null),
  ]);

  if (users) document.getElementById("adminUsers").textContent = JSON.stringify(users, null, 2);
  if (modules) document.getElementById("adminModules").textContent = JSON.stringify(modules, null, 2);
  if (stats) document.getElementById("adminStats").textContent = JSON.stringify(stats, null, 2);
}

async function setModule() {
  const user_id = Number(document.getElementById("moduleUserId").value);
  const module_code = document.getElementById("moduleCode").value.trim();
  const enabled = document.getElementById("moduleEnabled").value === "true";

  await requestJson("/api/admin/modules", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ user_id, module_code, enabled }),
  }).catch((e) => alert(e.message));
  await loadAdmin();
}

async function adminSaveCredential() {
  const user_id = Number(document.getElementById("adminCredUserId").value);
  const marketplace = document.getElementById("adminCredMarketplace").value;
  const api_key = document.getElementById("adminCredKey").value.trim();

  await requestJson("/api/admin/credentials", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ user_id, marketplace, api_key }),
  }).catch((e) => alert(e.message));
  await adminListCredentials();
}

async function adminListCredentials() {
  const userId = Number(document.getElementById("adminCredUserId").value);
  if (!userId) return alert(tr("Укажите user_id", "Specify user_id"));
  const data = await requestJson(`/api/admin/credentials?user_id=${userId}`, { headers: authHeaders() }).catch((e) => {
    alert(e.message);
    return null;
  });
  if (data) document.getElementById("adminCreds").textContent = JSON.stringify(data, null, 2);
}

async function adminDeleteCredential() {
  const credentialId = Number(document.getElementById("adminDeleteCredentialId").value);
  if (!credentialId) return alert(tr("Укажите credential_id", "Specify credential_id"));

  await requestJson(`/api/admin/credentials/${credentialId}`, {
    method: "DELETE",
    headers: authHeaders(),
  }).catch((e) => alert(e.message));
  await adminListCredentials();
}

async function adminResetUserPassword() {
  const user_id = Number(document.getElementById("adminResetUserId").value);
  const new_password = document.getElementById("adminResetPassword").value;
  if (!user_id || !new_password) return alert(tr("Укажите user_id и новый пароль", "Specify user_id and new password"));

  const data = await requestJson("/api/admin/users/password", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ user_id, new_password }),
  }).catch((e) => {
    alert(e.message);
    return null;
  });
  if (data) alert(data.message);
}

applyTheme(currentTheme);
applyUiLanguage();
switchAuthMode("login");
initAuthRemember();
applySidebarMode();
applyButtonTooltips();
setupMobileClientMode();
initHoverTips();
window.__socialHooksRequested = true;
window.addEventListener("seo-wibe-auth", () => {
  applyMobileCalendarStartupRoute(0);
  applyMobileCalendarStartupRoute(180);
  applyMobileCalendarStartupRoute(650);
});
ensureAuth();

window.addEventListener("resize", () => {
  applySidebarMode();
}, { passive: true });

window.addEventListener("focus", () => {
  if (token || me) ensureAuth(false).catch(() => null);
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) return;
  if (token || me) ensureAuth(false).catch(() => null);
});

["loginEmail", "loginPassword"].forEach((id) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    login();
  });
});

["regEmail", "regPassword"].forEach((id) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    register();
  });
});

const profileAvatarUploadInput = document.getElementById("profileAvatarUpload");
if (profileAvatarUploadInput) {
  profileAvatarUploadInput.addEventListener("change", () => {
    if (profileAvatarUploadInput.files?.length) uploadProfileAvatar();
  });
}

const teamAvatarUploadInput = document.getElementById("teamAvatarUpload");
if (teamAvatarUploadInput) {
  teamAvatarUploadInput.addEventListener("change", () => {
    if (teamAvatarUploadInput.files?.length) uploadTeamAvatar();
  });
}

const keywordInput = document.getElementById("positionKeywords");
if (keywordInput) {
  keywordInput.addEventListener("input", () => {
    keywordInput.dataset.autofilled = "0";
  });
}

["salesDateFrom", "salesDateTo"].forEach((id) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener("change", () => {
    syncSalesRangeButtons();
    scheduleSalesReload(180);
  });
});

const salesMarketplaceSelect = document.getElementById("salesMarketplace");
if (salesMarketplaceSelect) {
  salesMarketplaceSelect.addEventListener("change", () => {
    if (currentTab === "sales") {
      loadSalesStats();
      return;
    }
    scheduleSalesReload(120);
  });
}

const profileAiSourceSelectEl = document.getElementById("profileAiSourceSelect");
if (profileAiSourceSelectEl) {
  profileAiSourceSelectEl.addEventListener("change", () => {
    renderProfileAiServiceOptions(profileAiSourceSelectEl.value);
  });
}

const helpAssistantQuestionInput = document.getElementById("helpAssistantQuestion");
if (helpAssistantQuestionInput) {
  helpAssistantQuestionInput.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    askHelpAssistant();
  });
}

["reviewDateFrom", "reviewDateTo", "questionDateFrom", "questionDateTo"].forEach((id) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener("change", () => {
    el.dataset.userSet = "1";
  });
});

const reviewPhotoModal = document.getElementById("reviewPhotoModal");
if (reviewPhotoModal) {
  reviewPhotoModal.addEventListener("click", (e) => {
    if (e.target === reviewPhotoModal) closeReviewPhotoViewer();
  });
  document.addEventListener("keydown", (e) => {
    if (reviewPhotoModal.classList.contains("hidden")) return;
    if (e.key === "Escape") closeReviewPhotoViewer();
    if (e.key === "ArrowLeft") reviewPhotoPrev();
    if (e.key === "ArrowRight") reviewPhotoNext();
  });
}

const campaignDetailModal = document.getElementById("campaignDetailModal");
if (campaignDetailModal) {
  campaignDetailModal.addEventListener("click", (e) => {
    if (e.target === campaignDetailModal) closeCampaignDetailModal();
  });
  document.addEventListener("keydown", (e) => {
    if (campaignDetailModal.classList.contains("hidden")) return;
    if (e.key === "Escape") closeCampaignDetailModal();
  });
}

const productViewModal = document.getElementById("productViewModal");
if (productViewModal) {
  productViewModal.addEventListener("click", (e) => {
    if (e.target === productViewModal) closeProductViewModal();
  });
  document.addEventListener("keydown", (e) => {
    if (productViewModal.classList.contains("hidden")) return;
    if (e.key === "Escape") closeProductViewModal();
  });
}

const productEditModal = document.getElementById("productEditModal");
if (productEditModal) {
  productEditModal.addEventListener("click", (e) => {
    if (e.target === productEditModal) closeProductEditModal();
  });
  document.addEventListener("keydown", (e) => {
    if (productEditModal.classList.contains("hidden")) return;
    if (e.key === "Escape") closeProductEditModal();
  });
}

const teamMemberEditModal = document.getElementById("teamMemberEditModal");
if (teamMemberEditModal) {
  teamMemberEditModal.addEventListener("click", (e) => {
    if (e.target === teamMemberEditModal) closeTeamMemberEditor();
  });
  document.addEventListener("keydown", (e) => {
    if (teamMemberEditModal.classList.contains("hidden")) return;
    if (e.key === "Escape") closeTeamMemberEditor();
  });
}

const profileSectionModal = document.getElementById("profileSectionModal");
if (profileSectionModal) {
  profileSectionModal.addEventListener("click", (e) => {
    if (e.target === profileSectionModal) closeProfileSectionModal();
  });
  document.addEventListener("keydown", (e) => {
    if (profileSectionModal.classList.contains("hidden")) return;
    if (e.key === "Escape") closeProfileSectionModal();
  });
}

document.addEventListener("click", (e) => {
  const popover = document.getElementById("topbarUserPopover");
  const btn = document.getElementById("topbarAvatarBtn");
  if (!popover || !btn) return;
  if (popover.classList.contains("hidden")) return;
  const target = e.target;
  if (popover.contains(target) || btn.contains(target)) return;
  closeTopbarUserPopover();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeTopbarUserPopover();
});

window.switchHelpSubtab = switchHelpSubtab;
window.askHelpAssistant = askHelpAssistant;
window.loadProfileAi = loadProfileAi;
window.saveProfileAiSelection = saveProfileAiSelection;
window.addProfileAiService = addProfileAiService;
window.openMyProfileFromTopbar = openMyProfileFromTopbar;
window.openProfileSectionModal = openProfileSectionModal;
window.closeProfileSectionModal = closeProfileSectionModal;
window.closeTeamMemberEditor = closeTeamMemberEditor;
window.saveTeamMemberEditor = saveTeamMemberEditor;
window.deleteTeamMemberFromModal = deleteTeamMemberFromModal;
window.triggerProfileAvatarUpload = triggerProfileAvatarUpload;
window.uploadProfileAvatar = uploadProfileAvatar;
window.triggerTeamAvatarUpload = triggerTeamAvatarUpload;
window.uploadTeamAvatar = uploadTeamAvatar;
window.toggleFeedbackPrompt = toggleFeedbackPrompt;
window.handleTopMenuButton = handleTopMenuButton;
window.toggleMobileNav = toggleMobileNav;
window.closeMobileNav = closeMobileNav;
window.handleMobileBackPress = handleMobileBackPress;
window.onMobileQuickNavChanged = onMobileQuickNavChanged;
window.syncMobileQuickNavSelection = syncMobileQuickNavSelection;


