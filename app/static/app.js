let token = localStorage.getItem("token") || "";
let me = null;
let selectedProducts = new Set();
let selectedJobs = new Set();
let currentProducts = [];
let currentJobs = [];
let selectedProductId = null;
let autoKeywordProductId = null;
let enabledModules = new Set();
let wbReviewRows = [];
const wbReviewDrafts = new Map();
let currentReviewMarketplace = "wb";
let wbQuestionRows = [];
const wbQuestionDrafts = new Map();
let currentQuestionMarketplace = "wb";
let reviewLoadProgress = { active: false, total: 0, loaded: 0 };
let questionLoadProgress = { active: false, total: 0, loaded: 0 };
let reviewLoadToken = 0;
let questionLoadToken = 0;
let wbCampaignRows = [];
let selectedWbCampaignId = "";
const wbCampaignDetailCache = new Map();
let wbAdsBalanceData = null;
let currentCampaignDetailId = 0;
let wbAdsLoadProgress = { active: false, total: 0, loaded: 0, failed: 0 };
let wbAdsLoadToken = 0;
let adsAnalyticsRows = [];
let adsRecommendationRows = [];
let adsRecLoadProgress = { active: false, total: 0, loaded: 0 };
let adsRecLoadToken = 0;
let salesRows = [];
let salesChartRows = [];
let salesLoadToken = 0;
let salesAutoLoadTimer = null;
let reviewPhotoItems = [];
let reviewPhotoIndex = 0;
let currentLang = (localStorage.getItem("ui_lang") || "ru").toLowerCase() === "en" ? "en" : "ru";
let currentTheme = (localStorage.getItem("ui_theme") || "classic").toLowerCase();
let uiThemeSettings = {
  theme_choice_enabled: true,
  default_theme: "classic",
  allowed_themes: ["classic", "dark", "light", "newyear", "summer", "autumn", "winter", "spring"],
};
let currentTab = "dashboard";
const POSITION_LIMIT = 500;

const authHeaders = () => ({
  "Content-Type": "application/json",
  "Authorization": `Bearer ${token}`,
});

const TAB_TITLES = {
  dashboard: { ru: ["Дашборд", "Контроль SEO-цикла и KPI"], en: ["Dashboard", "SEO lifecycle control and KPIs"] },
  products: { ru: ["Товары", "Импорт, обновление и проверка позиций"], en: ["Products", "Import, refresh and ranking checks"] },
  seo: { ru: ["SEO задачи", "Генерация, recheck и управление итерациями"], en: ["SEO Jobs", "Generation, recheck and iteration control"] },
  sales: { ru: ["Статистика продаж", "Продажи по периодам и маркетплейсам"], en: ["Sales Statistics", "Sales by period and marketplace"] },
  reviews: { ru: ["Отзывы WB/Ozon", "Мониторинг отзывов, AI-ответы и отправка в кабинет маркетплейса"], en: ["WB/Ozon Reviews", "Review monitoring, AI replies and publishing"] },
  questions: { ru: ["Вопросы WB/Ozon", "Мониторинг вопросов, AI-ответы и отправка в кабинет маркетплейса"], en: ["WB/Ozon Questions", "Question monitoring, AI replies and publishing"] },
  ads: { ru: ["Реклама WB", "Кампании и текущие ставки из рекламного кабинета WB"], en: ["WB Ads", "Campaigns and rates from WB ads cabinet"] },
  "ads-analytics": { ru: ["Аналитика WB Ads", "Статистика кампаний за период"], en: ["WB Ads Analytics", "Campaign statistics by period"] },
  "ads-recommendations": { ru: ["Рекомендации WB Ads", "Действия по оптимизации рекламных кампаний"], en: ["WB Ads Recommendations", "Actionable optimization suggestions"] },
  profile: { ru: ["Профиль", "Личные данные, тариф, API ключи и безопасность"], en: ["Profile", "Personal data, plan, API keys and security"] },
  billing: { ru: ["Биллинг", "Тарифы, лимиты, продление и история операций"], en: ["Billing", "Plans, limits, renewals and history"] },
  help: { ru: ["Справка", "Документация по модулям"], en: ["Help Center", "Module usage documentation"] },
  keywords: { ru: ["Ключевики", "Ручное усиление автоматического ядра"], en: ["Keywords", "Manual boost of auto semantic core"] },
  admin: { ru: ["Админка", "Управление пользователями и модулями"], en: ["Admin", "Users and modules management"] },
};

const HELP_MODULE_TAB_MAP = {
  dashboard: "dashboard",
  products: "products",
  seo_generation: "seo",
  rank_tracking: "products",
  competitor_insights: "seo",
  auto_apply: "seo",
  sales_stats: "sales",
  wb_reviews_ai: "reviews",
  wb_questions_ai: "questions",
  wb_ads: "ads",
  wb_ads_analytics: "ads-analytics",
  wb_ads_recommendations: "ads-recommendations",
  user_profile: "profile",
  billing: "billing",
  help_center: "help",
  keywords: "keywords",
};

const UI_TEXT = {
  ru: {
    nav_dashboard: "Дашборд",
    nav_products: "Товары",
    nav_seo: "SEO задачи",
    nav_sales: "Статистика продаж",
    nav_reviews: "Отзывы WB/Ozon",
    nav_questions: "Вопросы WB/Ozon",
    nav_ads: "Реклама WB",
    nav_ads_analytics: "Аналитика WB Ads",
    nav_ads_recommendations: "Рекомендации WB Ads",
    nav_profile: "Профиль",
    nav_help: "Справка",
    nav_keywords: "Ключевики",
    logout: "Выйти",
    theme_classic: "Классика",
    theme_dark: "Темная",
    theme_light: "Светлая",
    theme_newyear: "Новогодняя",
    theme_summer: "Лето",
    theme_autumn: "Осень",
    theme_winter: "Зима",
    theme_spring: "Весна",
  },
  en: {
    nav_dashboard: "Dashboard",
    nav_products: "Products",
    nav_seo: "SEO Jobs",
    nav_sales: "Sales Statistics",
    nav_reviews: "WB/Ozon Reviews",
    nav_questions: "WB/Ozon Questions",
    nav_ads: "WB Ads",
    nav_ads_analytics: "WB Ads Analytics",
    nav_ads_recommendations: "WB Ads Recommendations",
    nav_profile: "Profile",
    nav_help: "Help Center",
    nav_keywords: "Keywords",
    logout: "Logout",
    theme_classic: "Classic",
    theme_dark: "Dark",
    theme_light: "Light",
    theme_newyear: "New Year",
    theme_summer: "Summer",
    theme_autumn: "Autumn",
    theme_winter: "Winter",
    theme_spring: "Spring",
  },
};

function t(key, fallback = "") {
  const pack = UI_TEXT[currentLang] || UI_TEXT.ru;
  return pack[key] || fallback || key;
}

function tr(ru, en) {
  return currentLang === "en" ? en : ru;
}

function applyTheme(theme) {
  const configured = Array.isArray(uiThemeSettings.allowed_themes) && uiThemeSettings.allowed_themes.length
    ? uiThemeSettings.allowed_themes
    : ["classic", "dark", "light", "newyear", "summer", "autumn", "winter", "spring"];
  const allowed = new Set(configured.map((x) => String(x || "").toLowerCase()).filter(Boolean));
  const requested = String(theme || "").toLowerCase();
  const fallback = String(uiThemeSettings.default_theme || "classic").toLowerCase();
  const forced = uiThemeSettings.theme_choice_enabled ? requested : fallback;
  const nextTheme = allowed.has(forced) ? forced : (allowed.has(fallback) ? fallback : "classic");
  currentTheme = nextTheme;
  localStorage.setItem("ui_theme", nextTheme);
  document.body.setAttribute("data-theme", nextTheme);
  const sel = document.getElementById("uiThemeSelect");
  if (sel) {
    if (sel.value !== nextTheme) sel.value = nextTheme;
    sel.disabled = !uiThemeSettings.theme_choice_enabled;
  }
}

function changeTheme() {
  if (!uiThemeSettings.theme_choice_enabled) return;
  const value = document.getElementById("uiThemeSelect")?.value || "classic";
  applyTheme(value);
}

window.changeTheme = changeTheme;

function applyUiThemeSettingsToSelect() {
  const sel = document.getElementById("uiThemeSelect");
  if (!sel) return;
  const allowed = Array.isArray(uiThemeSettings.allowed_themes) && uiThemeSettings.allowed_themes.length
    ? uiThemeSettings.allowed_themes
    : ["classic", "dark", "light", "newyear", "summer", "autumn", "winter", "spring"];
  const allowedSet = new Set(allowed.map((x) => String(x || "").toLowerCase()));
  [...sel.options].forEach((opt) => {
    opt.hidden = !allowedSet.has(String(opt.value || "").toLowerCase());
    opt.disabled = !allowedSet.has(String(opt.value || "").toLowerCase());
  });
  sel.disabled = !uiThemeSettings.theme_choice_enabled;
}

function applyProductToolbarIcons(isEn) {
  const items = [
    { id: "productsImportBtn", icon: "&#8681;", ru: "Импорт", en: "Import" },
    { id: "productsReloadBtn", icon: "&#10227;", ru: "Перезагрузить базу", en: "Reload Catalog" },
    { id: "productsSelectAllBtn", icon: "&#9745;", ru: "Выбрать все", en: "Select All" },
    { id: "productsCheckSelectedBtn", icon: "&#128269;", ru: "Проверить выбранные", en: "Check Selected" },
    { id: "productsCheckAllBtn", icon: "&#128640;", ru: "Проверить все", en: "Check All" },
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

function applyUiLanguage() {
  const lang = currentLang === "en" ? "en" : "ru";
  currentLang = lang;
  localStorage.setItem("ui_lang", lang);
  document.documentElement.setAttribute("lang", lang);
  const langSelect = document.getElementById("uiLangSelect");
  if (langSelect && langSelect.value !== lang) langSelect.value = lang;

  const setText = (selector, value) => {
    const el = document.querySelector(selector);
    if (el) el.textContent = value;
  };
  const setTextAll = (selector, value) => {
    document.querySelectorAll(selector).forEach((el) => {
      el.textContent = value;
    });
  };
  const setOptions = (selector, labels) => {
    const el = document.querySelector(selector);
    if (!el) return;
    labels.forEach((label, idx) => {
      if (el.options[idx]) el.options[idx].textContent = label;
    });
  };
  const setCheckLabel = (selector, labelText) => {
    const el = document.querySelector(selector);
    if (!el) return;
    const input = el.querySelector("input");
    el.textContent = "";
    if (input) el.appendChild(input);
    el.append(document.createTextNode(` ${labelText}`));
  };
  setText(".nav-btn[data-tab='dashboard']", t("nav_dashboard"));
  setText(".nav-btn[data-tab='products']", t("nav_products"));
  setText(".nav-btn[data-tab='seo']", t("nav_seo"));
  setText(".nav-btn[data-tab='sales']", t("nav_sales"));
  setText(".nav-btn[data-tab='reviews']", t("nav_reviews"));
  setText(".nav-btn[data-tab='questions']", t("nav_questions"));
  setText(".nav-btn[data-tab='ads']", t("nav_ads"));
  setText(".nav-btn[data-tab='ads-analytics']", t("nav_ads_analytics"));
  setText(".nav-btn[data-tab='ads-recommendations']", t("nav_ads_recommendations"));
  setText(".nav-btn[data-tab='profile']", t("nav_profile"));
  setText(".nav-btn[data-tab='help']", t("nav_help"));
  setText(".nav-btn[data-tab='keywords']", t("nav_keywords"));
  setText(".btn-danger.full", t("logout"));
  setText("#authSection .auth-box:nth-of-type(1) h3", lang === "en" ? "Register" : "Регистрация");
  setText("#authSection .auth-box:nth-of-type(2) h3", lang === "en" ? "Login" : "Вход");
  setText("#authSection .auth-box:nth-of-type(1) button", lang === "en" ? "Create Account" : "Создать аккаунт");
  setText("#authSection .auth-box:nth-of-type(2) button", lang === "en" ? "Sign In" : "Войти в кабинет");

  const isEn = lang === "en";
  setText("#dashboard .panel h3", isEn ? "Quick Actions" : "Быстрые действия");
  setText("#dashboard .quick-actions button:nth-of-type(1)", isEn ? "Import Products" : "Импортировать товары");
  setText("#dashboard .quick-actions button:nth-of-type(2)", isEn ? "Run SEO Generation" : "Запустить SEO-генерацию");
  setText("#dashboard .quick-actions button:nth-of-type(3)", isEn ? "Check All Rankings" : "Проверить позиции всех");
  applyProductToolbarIcons(isEn);
  const importAllLabel = document.querySelector("#products .panel .grid-6 .check");
  if (importAllLabel) {
    const input = importAllLabel.querySelector("input");
    importAllLabel.textContent = "";
    if (input) importAllLabel.appendChild(input);
    importAllLabel.append(document.createTextNode(` ${isEn ? "Import all" : "Импортировать все"}`));
  }
  setText("#seo .panel .grid-5 button:nth-of-type(1)", isEn ? "Generate Selected" : "Сгенерировать для выбранных");
  setText("#seo .panel .grid-5 button:nth-of-type(2)", isEn ? "Generate All" : "Сгенерировать для всех");
  setText("#seo .panel .grid-5 button:nth-of-type(3)", isEn ? "Apply" : "Применить");
  setText("#sales .panel h3", isEn ? "Sales Statistics" : "Статистика продаж");
  setText("#sales .grid-4 button", isEn ? "Load Stats" : "Загрузить статистику");
  setText("#sales .sales-cost-field span", isEn ? "Other costs" : "Прочие траты");
  setText("#sales [data-sales-range='day']", isEn ? "Day" : "День");
  setText("#sales [data-sales-range='week']", isEn ? "Week" : "Неделя");
  setText("#sales [data-sales-range='month']", isEn ? "Month" : "Месяц");
  setText("#sales [data-sales-range='quarter']", isEn ? "Quarter" : "Квартал");
  setText("#sales [data-sales-range='halfyear']", isEn ? "6 months" : "6 месяцев");
  setText("#sales [data-sales-range='year']", isEn ? "Year" : "Год");
  setText("#reviews .panel h3", isEn ? "Reviews & Replies WB/Ozon" : "Отзывы и ответы WB/Ozon");
  setText("#questions .panel h3", isEn ? "Questions & Replies WB/Ozon" : "Вопросы и ответы WB/Ozon");
  setText("#ads .panel h3", isEn ? "WB Ad Campaigns" : "Рекламные кампании WB");
  setText("#ads .grid-4 button:nth-of-type(1)", isEn ? "Load Campaigns" : "Загрузить кампании");
  setText("#ads .grid-4 button:nth-of-type(2)", isEn ? "Get Rates" : "Получить ставки");
  setText("#ads .grid-3 button", isEn ? "Reset Filters" : "Сбросить фильтры");
  setText("#ads-analytics .panel h3", isEn ? "WB Ads Analytics" : "Аналитика рекламы WB");
  setText("#ads-analytics .grid-4 button", isEn ? "Build Report" : "Построить отчет");
  setText("#ads-recommendations .panel h3", isEn ? "WB Ads Recommendations" : "Рекомендации WB Ads");
  setText("#ads-recommendations .grid-4 button", isEn ? "Build Recommendations" : "Построить рекомендации");
  setText("#profile .panel:nth-of-type(1) h3", isEn ? "User Profile" : "Профиль пользователя");
  setText("#profile .panel:nth-of-type(1) .grid-3 button:nth-of-type(1)", isEn ? "Save Profile" : "Сохранить профиль");
  setText("#profile .panel:nth-of-type(1) .grid-3 button:nth-of-type(2)", isEn ? "Refresh Profile" : "Обновить профиль");
  setText("#profile .panel:nth-of-type(2) h3", isEn ? "Plan" : "Тариф");
  setText("#profile .panel:nth-of-type(2) .grid-4 button:nth-of-type(1)", isEn ? "Change Plan" : "Сменить тариф");
  setText("#profile .panel:nth-of-type(2) .grid-4 button:nth-of-type(2)", isEn ? "Renew for 30 days" : "Продлить на 30 дней");
  setText("#profile .panel:nth-of-type(2) .grid-4 button:nth-of-type(3)", isEn ? "Refresh" : "Обновить");
  setText("#profile .panel:nth-of-type(3) h3", isEn ? "API Keys" : "API ключи");
  setText("#profile .panel:nth-of-type(4) h3", isEn ? "Security" : "Безопасность");
  setText("#profile .panel:nth-of-type(4) .grid-3 button", isEn ? "Change Password" : "Сменить пароль");
  setText("#help .panel h3", isEn ? "Module Help Center" : "Справка по модулям");
  setText("#help .grid-3 button", isEn ? "Refresh Help" : "Обновить справку");
  setText("#reviews .grid-6 button.btn-secondary", isEn ? "Refresh Reviews" : "Обновить отзывы");
  setText("#reviews .grid-2 button", isEn ? "Save AI Settings" : "Сохранить AI-настройки");
  setText("#questions .grid-6 button.btn-secondary", isEn ? "Refresh Questions" : "Обновить вопросы");
  setText("#questions .grid-2 button", isEn ? "Save AI Settings" : "Сохранить AI-настройки");
  setText("#questions .grid-4 button:nth-of-type(1)", isEn ? "Upload to Knowledge Base" : "Загрузить в базу знаний");
  setText("#questions .grid-4 button:nth-of-type(2)", isEn ? "Delete Selected Document" : "Удалить выбранный документ");
  setText("#campaignDetailModal .campaign-modal-head h3", isEn ? "WB Campaign Details" : "Детали кампании WB");
  setText("#campaignDetailModal .actions button:nth-of-type(1)", isEn ? "Start" : "Запустить");
  setText("#campaignDetailModal .actions button:nth-of-type(2)", isEn ? "Pause" : "Пауза");
  setText("#campaignDetailModal .actions button:nth-of-type(3)", isEn ? "Stop" : "Остановить");
  setText("#campaignDetailModal .actions button:nth-of-type(4)", isEn ? "Refresh details" : "Обновить детали");
  setText("#reviews thead th:nth-child(1)", isEn ? "Status" : "Статус");
  setText("#reviews thead th:nth-child(2)", isEn ? "Date" : "Дата");
  setText("#reviews thead th:nth-child(3)", isEn ? "Product" : "Товар");
  setText("#reviews thead th:nth-child(4)", isEn ? "Rating" : "Оценка");
  setText("#reviews thead th:nth-child(5)", isEn ? "Review" : "Отзыв");
  setText("#reviews thead th:nth-child(6)", isEn ? "Reply" : "Ответ");
  setText("#reviews thead th:nth-child(7)", isEn ? "Actions" : "Действия");
  setText("#questions thead th:nth-child(1)", isEn ? "Status" : "Статус");
  setText("#questions thead th:nth-child(2)", isEn ? "Date" : "Дата");
  setText("#questions thead th:nth-child(3)", isEn ? "Product" : "Товар");
  setText("#questions thead th:nth-child(4)", isEn ? "Question" : "Вопрос");
  setText("#questions thead th:nth-child(5)", isEn ? "Reply" : "Ответ");
  setText("#questions thead th:nth-child(6)", isEn ? "Actions" : "Действия");
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
  setText("#ads-recommendations thead th:nth-child(1)", "ID");
  setText("#ads-recommendations thead th:nth-child(2)", isEn ? "Name" : "Название");
  setText("#ads-recommendations thead th:nth-child(3)", isEn ? "Status" : "Статус");
  setText("#ads-recommendations thead th:nth-child(4)", isEn ? "Type" : "Тип");
  setText("#ads-recommendations thead th:nth-child(5)", isEn ? "Views" : "Показы");
  setText("#ads-recommendations thead th:nth-child(6)", isEn ? "Clicks" : "Клики");
  setText("#ads-recommendations thead th:nth-child(7)", "CTR");
  setText("#ads-recommendations thead th:nth-child(8)", isEn ? "Orders" : "Заказы");
  setText("#ads-recommendations thead th:nth-child(9)", isEn ? "Spend" : "Расход");
  setText("#ads-recommendations thead th:nth-child(10)", "CPC");
  setText("#ads-recommendations thead th:nth-child(11)", "CPO");
  setText("#ads-recommendations thead th:nth-child(12)", isEn ? "Priority" : "Приоритет");
  setText("#ads-recommendations thead th:nth-child(13)", isEn ? "Recommendation" : "Рекомендация");
  setText("#ads-recommendations thead th:nth-child(14)", isEn ? "Reason" : "Причина");
  setText("#sales thead th:nth-child(1)", isEn ? "Date" : "Дата");
  setText("#sales thead th:nth-child(2)", isEn ? "Marketplace" : "МП");
  setText("#sales thead th:nth-child(3)", isEn ? "Orders" : "Заказы");
  setText("#sales thead th:nth-child(4)", isEn ? "Units" : "Шт.");
  setText("#sales thead th:nth-child(5)", isEn ? "Revenue" : "Выручка");
  setText("#sales thead th:nth-child(6)", isEn ? "Returns" : "Отказы");
  setText("#sales thead th:nth-child(7)", isEn ? "Ads Spend" : "Реклама");
  setText("#sales thead th:nth-child(8)", isEn ? "Other Costs" : "Прочие траты");
  setText("#profile .panel:nth-of-type(3) .cols-2 > div:nth-of-type(1) h3", "WB");
  setText("#profile .panel:nth-of-type(3) .cols-2 > div:nth-of-type(2) h3", "Ozon");
  setTextAll("#profile .panel:nth-of-type(3) .actions button:nth-of-type(1)", isEn ? "Save" : "Сохранить");
  setTextAll("#profile .panel:nth-of-type(3) .actions button:nth-of-type(2)", isEn ? "Test" : "Проверить");
  setTextAll("#profile .panel:nth-of-type(3) .actions button:nth-of-type(3)", isEn ? "Delete" : "Удалить");

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
    isEn ? "Newest first" : "Сначала новые",
    isEn ? "Oldest first" : "Сначала старые",
  ]);
  setOptions("#questionStatusFilter", [
    isEn ? "All" : "Все",
    isEn ? "New" : "Новые",
    isEn ? "Unanswered" : "Неотвеченные",
    isEn ? "Answered" : "Отвеченные",
  ]);
  setOptions("#questionDateSort", [
    isEn ? "Newest first" : "Сначала новые",
    isEn ? "Oldest first" : "Сначала старые",
  ]);
  setOptions("#reviewAiMode", ["manual", "suggest", "auto"]);
  setOptions("#questionAiMode", ["manual", "suggest", "auto"]);
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
    isEn ? "Status: code asc" : "Статус: по коду ↑",
    isEn ? "Status: code desc" : "Статус: по коду ↓",
  ]);
  setOptions("#salesMarketplace", [
    isEn ? "All marketplaces" : "Все маркетплейсы",
    "WB",
    "Ozon",
  ]);
  setOptions("#salesMetricMode", [
    isEn ? "Units" : "Штуки",
    isEn ? "Revenue" : "Выручка",
    isEn ? "Orders" : "Заказы",
    isEn ? "Returns" : "Отказы",
    isEn ? "Ads Spend" : "Реклама",
    isEn ? "Other Costs" : "Прочие траты",
  ]);
  setCheckLabel("#sales .sales-chart-controls label:nth-of-type(1)", isEn ? "Total" : "Всего");
  setCheckLabel("#sales .sales-chart-controls label:nth-of-type(2)", "WB");
  setCheckLabel("#sales .sales-chart-controls label:nth-of-type(3)", "Ozon");

  const placeholders = [
    ["#articles", isEn ? "Articles comma separated (or empty)" : "Артикулы через запятую (или пусто)"],
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
    ["#profileFullName", isEn ? "Full name" : "ФИО"],
    ["#profilePositionTitle", isEn ? "Position title" : "Должность"],
    ["#profileCompanyName", isEn ? "Company name" : "Название компании"],
    ["#profileCity", isEn ? "City" : "Город"],
    ["#profileLegalName", isEn ? "Legal entity name" : "Юридическое наименование"],
    ["#profileLegalAddress", isEn ? "Legal address" : "Юридический адрес"],
    ["#profileTaxId", isEn ? "Tax ID" : "ИНН"],
    ["#profileTaxRate", isEn ? "Tax rate, %" : "Налоговая ставка, %"],
    ["#profilePhone", isEn ? "Phone" : "Телефон"],
    ["#profileTeamSize", isEn ? "Team size" : "Состав компании, чел."],
    ["#profileAvatarUrl", isEn ? "Avatar URL" : "Ссылка на аватар"],
    ["#profileCompanyStructure", isEn ? "Team structure, roles, departments" : "Структура компании, роли, отделы"],
    ["#profileCurrentPassword", isEn ? "Current password" : "Текущий пароль"],
    ["#profileNewPassword", isEn ? "New password (>=8)" : "Новый пароль (>=8)"],
  ];
  for (const [selector, text] of placeholders) {
    const el = document.querySelector(selector);
    if (el) el.placeholder = text;
  }

  const themeSel = document.getElementById("uiThemeSelect");
  if (themeSel) {
    const labels = [
      ["classic", t("theme_classic")],
      ["dark", t("theme_dark")],
      ["light", t("theme_light")],
      ["newyear", t("theme_newyear")],
      ["summer", t("theme_summer")],
      ["autumn", t("theme_autumn")],
      ["winter", t("theme_winter")],
      ["spring", t("theme_spring")],
    ];
    for (const [value, label] of labels) {
      const opt = [...themeSel.options].find((x) => x.value === value);
      if (opt) opt.textContent = label;
    }
  }

  const helpLang = document.getElementById("helpLangSelect");
  if (helpLang) helpLang.value = lang;
  const helpModule = document.getElementById("helpModuleSelect");
  if (helpModule) delete helpModule.dataset.ready;
  const titlePack = TAB_TITLES[currentTab] || TAB_TITLES.dashboard;
  const [title, subtitle] = titlePack[lang] || titlePack.ru;
  document.getElementById("sectionTitle").textContent = title;
  document.getElementById("sectionSubtitle").textContent = subtitle;
  updateReviewLoadStatus();
  updateQuestionLoadStatus();
  updateWbAdsLoadStatus();
  updateAdsRecLoadStatus();
  applyUiThemeSettingsToSelect();
}

function changeUiLang() {
  const raw = (document.getElementById("uiLangSelect")?.value || "ru").toLowerCase();
  currentLang = raw === "en" ? "en" : "ru";
  applyUiLanguage();
  applyButtonTooltips();
  if (currentTab === "reviews") renderWbReviews();
  if (currentTab === "questions") renderWbQuestions();
  if (currentTab === "ads") renderWbCampaignRows();
  if (currentTab === "ads-analytics") renderAdsAnalyticsRows();
  if (currentTab === "help") loadHelpDocs();
  if (currentTab === "ads-recommendations") renderAdsRecommendationsRows();
  if (currentTab === "sales") renderSalesStats();
  if (currentTab === "profile") loadProfile();
}

window.changeUiLang = changeUiLang;

async function requestJson(url, opts = {}) {
  const timeoutMs = Number(opts.timeoutMs || 0);
  const fetchOpts = { ...opts };
  delete fetchOpts.timeoutMs;

  let controller = null;
  let timer = null;
  if (timeoutMs > 0) {
    controller = new AbortController();
    fetchOpts.signal = controller.signal;
    timer = setTimeout(() => controller.abort(), timeoutMs);
  }

  let r;
  try {
    r = await fetch(url, fetchOpts);
  } catch (e) {
    if (e?.name === "AbortError") {
      throw new Error(currentLang === "en" ? "Request timed out. Please retry." : "Превышено время ожидания. Повторите запрос.");
    }
    throw e;
  } finally {
    if (timer) clearTimeout(timer);
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.detail || data.message || (currentLang === "en" ? "Request error" : "Ошибка запроса"));
  return data;
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
    "Сгенерировать": "Создает черновик ответа AI по тексту клиента.",
    "Отправить": "Публикует ответ в маркетплейс.",
    "Обновить": "Обновляет ранее отправленный ответ в маркетплейсе.",
    "Загрузить кампании": "Загружает список рекламных кампаний из кабинета WB Ads.",
    "Получить ставки": "Запрашивает ставки по выбранной рекламной кампании.",
    "Сбросить фильтры": "Сбрасывает фильтры и сортировку рекламных кампаний.",
    "Построить отчет": "Формирует аналитический отчет по WB Ads за выбранный период.",
    "Построить рекомендации": "Формирует список приоритетных действий по оптимизации рекламных кампаний.",
    "Загрузить статистику": "Загружает продажи за выбранный период и строит график.",
    "Сохранить профиль": "Сохраняет личные и юридические данные пользователя.",
    "Обновить профиль": "Перезагружает данные профиля с сервера.",
    "Сменить тариф": "Переключает тарифный план текущего аккаунта.",
    "Продлить на 30 дней": "Продлевает тариф на следующий расчетный период.",
    "Сменить пароль": "Обновляет пароль текущего аккаунта.",
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
  const dict = BUTTON_TIPS[currentLang] || BUTTON_TIPS.ru;
  if (dict[cleaned]) return dict[cleaned];
  return currentLang === "en" ? `Action: ${cleaned}` : `Действие: ${cleaned}`;
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
    svg.innerHTML = "";
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

  svg.innerHTML = `
    <defs>
      <linearGradient id="${svgId}-line" x1="0%" x2="100%" y1="0%" y2="0%">
        <stop offset="0%" stop-color="#21e7ff"/>
        <stop offset="100%" stop-color="#7b8dff"/>
      </linearGradient>
    </defs>
    <polyline points="${polyline}" fill="none" stroke="url(#${svgId}-line)" stroke-width="3" stroke-linecap="round" />
  `;
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
    input.dataset.autofilled === "1" ||
    autoKeywordProductId !== productId;
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

function applyModuleVisibility() {
  document.querySelectorAll(".nav-btn[data-module]").forEach((btn) => {
    const moduleCode = btn.dataset.module;
    const allowed = enabledModules.has(moduleCode);
    btn.classList.toggle("hidden", !allowed);
  });
}

async function loadCurrentModules() {
  const rows = await requestJson("/api/modules/current", { headers: authHeaders() }).catch(() => []);
  const active = new Set();
  if (Array.isArray(rows)) {
    for (const row of rows) {
      if (row && row.enabled && row.module_code) active.add(row.module_code);
    }
  }
  enabledModules = active;
  applyModuleVisibility();
}

async function loadUiThemeSettings() {
  const data = await requestJson("/api/ui/settings", { headers: authHeaders() }).catch(() => null);
  if (!data || typeof data !== "object") return;
  uiThemeSettings = {
    theme_choice_enabled: Boolean(data.theme_choice_enabled),
    default_theme: String(data.default_theme || "classic").toLowerCase(),
    allowed_themes: Array.isArray(data.allowed_themes) ? data.allowed_themes.map((x) => String(x || "").toLowerCase()) : ["classic"],
  };
  applyUiThemeSettingsToSelect();
  const desired = uiThemeSettings.theme_choice_enabled
    ? (localStorage.getItem("ui_theme") || currentTheme || uiThemeSettings.default_theme || "classic")
    : (uiThemeSettings.default_theme || "classic");
  applyTheme(desired);
}

function showTab(name, btn = null) {
  currentTab = name;
  document.querySelectorAll(".tab").forEach((el) => el.classList.add("hidden"));
  const tab = document.getElementById(name);
  if (!tab) return;
  tab.classList.remove("hidden");

  const pack = TAB_TITLES[name] || TAB_TITLES.dashboard;
  const [title, subtitle] = pack[currentLang] || pack.ru;
  document.getElementById("sectionTitle").textContent = title;
  document.getElementById("sectionSubtitle").textContent = subtitle;

  if (btn && btn.dataset.tab) setActiveNav(btn.dataset.tab);
  else setActiveNav(name);

  if (name === "dashboard") loadDashboard();
  if (name === "keys") loadKeys();
  if (name === "keywords") loadKeywords();
  if (name === "products") loadProducts();
  if (name === "seo") loadSeoJobs();
  if (name === "sales") loadSalesStats();
  if (name === "reviews") loadReviewsWorkspace();
  if (name === "questions") loadQuestionsWorkspace();
  if (name === "ads") loadWbAdCampaigns();
  if (name === "ads-analytics") loadAdsAnalytics();
  if (name === "ads-recommendations") loadAdsRecommendations();
  if (name === "profile") loadProfile();
  if (name === "billing") loadBilling();
  if (name === "help") loadHelpDocs();
  if (name === "admin") loadAdmin();
}

async function register() {
  const email = document.getElementById("regEmail").value.trim();
  const password = document.getElementById("regPassword").value;
  const data = await requestJson("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  }).catch((e) => alert(e.message));
  if (!data) return;
  token = data.access_token;
  localStorage.setItem("token", token);
  await ensureAuth();
}

async function login() {
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  const data = await requestJson("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  }).catch((e) => alert(e.message));
  if (!data) return;
  token = data.access_token;
  localStorage.setItem("token", token);
  await ensureAuth();
}

function logout() {
  token = "";
  me = null;
  selectedProducts.clear();
  selectedJobs.clear();
  selectedProductId = null;
  enabledModules = new Set();
  wbReviewRows = [];
  wbQuestionRows = [];
  wbCampaignRows = [];
  adsAnalyticsRows = [];
  adsRecommendationRows = [];
  salesRows = [];
  salesChartRows = [];
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
  localStorage.removeItem("token");
  document.getElementById("appSection").classList.add("hidden");
  document.getElementById("authSection").classList.remove("hidden");
}

async function ensureAuth() {
  if (!token) return;
  const user = await requestJson("/api/auth/me", { headers: authHeaders() }).catch(() => null);
  if (!user) {
    logout();
    return;
  }
  me = user;
  document.getElementById("authSection").classList.add("hidden");
  document.getElementById("appSection").classList.remove("hidden");

  if (me.role !== "admin") {
    const adminBtn = document.querySelector(".nav-btn[data-tab='admin']");
    if (adminBtn) adminBtn.style.display = "none";
  }
  await loadCurrentModules();
  await loadUiThemeSettings();
  if (!uiThemeSettings.theme_choice_enabled) {
    currentTheme = uiThemeSettings.default_theme || "classic";
  }
  applyUiThemeSettingsToSelect();
  applyTheme(currentTheme);
  applyUiLanguage();
  applyButtonTooltips();
  showTab("dashboard", document.querySelector(".nav-btn[data-tab='dashboard']"));
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
  document.getElementById("keywordsList").textContent = JSON.stringify(data, null, 2);
}

async function loadReviewsWorkspace() {
  if (!enabledModules.has("wb_reviews_ai")) return;
  normalizeFeedbackDateDefaults("reviews", "reviewDateFrom", "reviewDateTo");
  await loadReviewAiSettings();
  await loadWbReviews();
}

async function loadReviewAiSettings() {
  const data = await requestJson("/api/wb/reviews/ai-settings", { headers: authHeaders() }).catch(() => null);
  if (!data) return;
  const promptInput = document.getElementById("reviewAiPrompt");
  const modeInput = document.getElementById("reviewAiMode");
  if (promptInput) promptInput.value = data.prompt || "";
  if (modeInput) modeInput.value = data.reply_mode || "manual";
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
  const failedText = failed > 0 ? ` • ${tr("ошибок", "errors")}: ${failed}` : "";
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

async function loadWbReviews() {
  if (!enabledModules.has("wb_reviews_ai")) {
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
    for (const row of payload.new || []) incoming.push({ ...row, _type: "new" });
    for (const row of payload.answered || []) incoming.push({ ...row, _type: "answered" });
    wbReviewRows = incoming;
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
        updateReviewLoadStatus(tr("Не удалось загрузить полный список отзывов.", "Failed to load full reviews list."));
        if (!wbReviewRows.length) {
          setTableMessage("wbReviewsTable", 7, tr("Не удалось загрузить отзывы.", "Failed to load reviews."));
          if (raw) raw.textContent = tr("Ошибка загрузки отзывов.", "Reviews loading failed.");
        }
        if (e?.message) alert(e.message);
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
    const lowered = fastMsg.toLowerCase();
    if (lowered && (lowered.includes("ключ") || lowered.includes("api key") || lowered.includes("401") || lowered.includes("403") || lowered.includes("client_id"))) {
      reviewLoadProgress.active = false;
      updateReviewLoadStatus(tr("Проверьте API-ключи WB/Ozon в разделе «Профиль».", "Check WB/Ozon API keys in Profile."));
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
    if (e?.message) alert(e.message);
  });
  if (runToken !== reviewLoadToken) return;
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
    const ta = parseReviewDate(a);
    const tb = parseReviewDate(b);
    if (dateSort === "oldest") return ta - tb;
    return tb - ta;
  });

  if (!visibleRows.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="7">${
      wbReviewRows.length
        ? (currentLang === "en" ? "No reviews for current filters." : "По текущим фильтрам отзывы не найдены.")
        : (currentLang === "en" ? "No reviews found." : "Отзывы не найдены.")
    }</td>`;
    tbody.appendChild(tr);
    reviewLoadProgress = { active: false, total: wbReviewRows.length, loaded: wbReviewRows.length };
    updateReviewLoadStatus();
    return;
  }

  const appendRow = (row) => {
    const status = normalizeReviewStatus(row);
    const tr = document.createElement("tr");

    const tdType = document.createElement("td");
    const pill = document.createElement("span");
    pill.className = "review-type-pill";
    pill.textContent = status === "new" ? (currentLang === "en" ? "new" : "новый") : (currentLang === "en" ? "answered" : "отвечен");
    tdType.appendChild(pill);

    const tdDate = document.createElement("td");
    tdDate.textContent = row.date || "-";
    tdDate.className = "cell-meta-small";

    const tdProduct = document.createElement("td");
    tdProduct.textContent = renderProductCellText(row);

    const tdStars = document.createElement("td");
    tdStars.textContent = String(row.stars ?? "-");

    const tdText = document.createElement("td");
    if (row.user) {
      const userTag = document.createElement("div");
      userTag.className = "cell-meta-small";
      userTag.textContent = `${currentLang === "en" ? "Author" : "Автор"}: ${row.user}`;
      tdText.appendChild(userTag);
    }
    const body = document.createElement("div");
    body.className = "cell-main-text";
    body.textContent = row.text || "-";
    tdText.appendChild(body);
    const photos = Array.isArray(row.photos) ? row.photos.filter((x) => typeof x === "string" && x.trim()) : [];
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
      tdText.appendChild(previewWrap);
    }

    const tdReply = document.createElement("td");
    const replyInput = document.createElement("textarea");
    replyInput.rows = 3;
    replyInput.className = "review-reply-input";
    replyInput.placeholder = currentLang === "en" ? "Reply text to customer" : "Текст ответа клиенту";
    const draftKey = reviewDraftKey(currentReviewMarketplace, row.id);
    replyInput.value = wbReviewDrafts.get(draftKey) ?? row.answer ?? "";
    replyInput.oninput = () => wbReviewDrafts.set(draftKey, replyInput.value);
    tdReply.appendChild(replyInput);

    const tdActions = document.createElement("td");
    const wrap = document.createElement("div");
    wrap.className = "review-actions";
    const btnGenerate = makeIconActionButton({
      icon: "&#9889;",
      tip: tr("Сгенерировать ответ", "Generate reply"),
      onClick: () => generateReviewReply(row.id),
      secondary: true,
    });
    const btnSend = makeIconActionButton({
      icon: status === "answered" ? "&#9998;" : "&#10148;",
      tip: status === "answered" ? tr("Обновить ответ", "Update reply") : tr("Отправить ответ", "Send reply"),
      onClick: () => sendReviewReply(row.id),
    });
    wrap.append(btnGenerate, btnSend);
    tdActions.appendChild(wrap);

    tr.append(tdType, tdDate, tdProduct, tdStars, tdText, tdReply, tdActions);
    tbody.appendChild(tr);
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

async function generateReviewReply(reviewId) {
  const row = wbReviewRows.find((x) => x.id === reviewId);
  if (!row) return alert(tr("Отзыв не найден", "Review not found"));
  const endpoint = `${getReviewsEndpoint(currentReviewMarketplace)}/generate-reply`;
  const mpLabel = currentReviewMarketplace === "ozon" ? "Ozon" : "WB";
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
      timeoutMs: 60000,
    }),
    tr(`Генерация зависит от AI-конфигурации сервиса (${mpLabel}).`, `Generation depends on AI settings (${mpLabel}).`)
  ).catch((e) => {
    alert(e.message);
    return null;
  });
  if (!data) return;
  wbReviewDrafts.set(reviewDraftKey(currentReviewMarketplace, reviewId), data.reply || "");
  renderWbReviews();
}

async function sendReviewReply(reviewId) {
  const text = (wbReviewDrafts.get(reviewDraftKey(currentReviewMarketplace, reviewId)) || "").trim();
  if (!text) return alert(tr("Введите или сгенерируйте текст ответа", "Enter or generate reply text"));
  const endpoint = `${getReviewsEndpoint(currentReviewMarketplace)}/reply`;
  const mpLabel = currentReviewMarketplace === "ozon" ? "Ozon" : "WB";
  const data = await withBusy(
    tr(`Отправляем ответ в ${mpLabel}…`, `Sending reply to ${mpLabel}...`),
    () => requestJson(endpoint, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ id: reviewId, text }),
      timeoutMs: 60000,
    }),
    tr("Ответ отправляется в карточку отзыва через API маркетплейса.", "Reply is sent to marketplace review card via API.")
  ).catch((e) => {
    alert(e.message);
    return null;
  });
  if (!data) return;
  alert(data.message || tr("Ответ отправлен", "Reply sent"));
  await loadWbReviews();
}

async function loadQuestionsWorkspace() {
  if (!enabledModules.has("wb_questions_ai")) return;
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

async function loadQuestionAiSettings() {
  const data = await requestJson("/api/wb/questions/ai-settings", { headers: authHeaders() }).catch(() => null);
  if (!data) return;
  const promptInput = document.getElementById("questionAiPrompt");
  const modeInput = document.getElementById("questionAiMode");
  if (promptInput) promptInput.value = data.prompt || "";
  if (modeInput) modeInput.value = data.reply_mode || "manual";
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
  if (!file) return alert(tr("Сначала выберите файл.", "Select a file first."));
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
  if (!enabledModules.has("wb_questions_ai")) {
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
    for (const row of payload.new || []) incoming.push({ ...row, _type: "new" });
    for (const row of payload.answered || []) incoming.push({ ...row, _type: "answered" });
    wbQuestionRows = incoming;

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
        updateQuestionLoadStatus(tr("Не удалось загрузить полный список вопросов.", "Failed to load full questions list."));
        if (!wbQuestionRows.length) {
          setTableMessage("wbQuestionsTable", 6, tr("Не удалось загрузить вопросы.", "Failed to load questions."));
          if (raw) raw.textContent = tr("Ошибка загрузки вопросов.", "Questions loading failed.");
        }
        if (e?.message) alert(e.message);
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
    const lowered = fastMsg.toLowerCase();
    if (lowered && (lowered.includes("ключ") || lowered.includes("api key") || lowered.includes("401") || lowered.includes("403") || lowered.includes("client_id"))) {
      questionLoadProgress.active = false;
      updateQuestionLoadStatus(tr("Проверьте API-ключи WB/Ozon в разделе «Профиль».", "Check WB/Ozon API keys in Profile."));
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
    if (e?.message) alert(e.message);
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
    const ta = parseReviewDate(a);
    const tb = parseReviewDate(b);
    if (dateSort === "oldest") return ta - tb;
    return tb - ta;
  });

  if (!visibleRows.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="6">${
      wbQuestionRows.length
        ? (currentLang === "en" ? "No questions for current filters." : "По текущим фильтрам вопросы не найдены.")
        : (currentLang === "en" ? "No questions found." : "Вопросы не найдены.")
    }</td>`;
    tbody.appendChild(tr);
    questionLoadProgress = { active: false, total: wbQuestionRows.length, loaded: wbQuestionRows.length };
    updateQuestionLoadStatus();
    return;
  }

  const appendRow = (row) => {
    const status = normalizeQuestionStatus(row);
    const tr = document.createElement("tr");

    const tdType = document.createElement("td");
    const pill = document.createElement("span");
    pill.className = "review-type-pill";
    pill.textContent = status === "new" ? (currentLang === "en" ? "new" : "новый") : (currentLang === "en" ? "answered" : "отвечен");
    tdType.appendChild(pill);

    const tdDate = document.createElement("td");
    tdDate.textContent = row.date || "-";
    tdDate.className = "cell-meta-small";

    const tdProduct = document.createElement("td");
    tdProduct.textContent = renderProductCellText(row);

    const tdText = document.createElement("td");
    if (row.user) {
      const userTag = document.createElement("div");
      userTag.className = "cell-meta-small";
      userTag.textContent = `${currentLang === "en" ? "Author" : "Автор"}: ${row.user}`;
      tdText.appendChild(userTag);
    }
    const body = document.createElement("div");
    body.className = "cell-main-text";
    body.textContent = row.text || "-";
    tdText.appendChild(body);
    const photos = Array.isArray(row.photos) ? row.photos.filter((x) => typeof x === "string" && x.trim()) : [];
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
      tdText.appendChild(previewWrap);
    }

    const tdReply = document.createElement("td");
    const replyInput = document.createElement("textarea");
    replyInput.rows = 3;
    replyInput.className = "review-reply-input";
    replyInput.placeholder = currentLang === "en" ? "Reply text to customer" : "Текст ответа клиенту";
    const draftKey = questionDraftKey(currentQuestionMarketplace, row.id);
    replyInput.value = wbQuestionDrafts.get(draftKey) ?? row.answer ?? "";
    replyInput.oninput = () => wbQuestionDrafts.set(draftKey, replyInput.value);
    tdReply.appendChild(replyInput);

    const tdActions = document.createElement("td");
    const wrap = document.createElement("div");
    wrap.className = "review-actions";
    const btnGenerate = makeIconActionButton({
      icon: "&#9889;",
      tip: tr("Сгенерировать ответ", "Generate reply"),
      onClick: () => generateQuestionReply(row.id),
      secondary: true,
    });
    const btnSend = makeIconActionButton({
      icon: status === "answered" ? "&#9998;" : "&#10148;",
      tip: status === "answered" ? tr("Обновить ответ", "Update reply") : tr("Отправить ответ", "Send reply"),
      onClick: () => sendQuestionReply(row.id),
    });
    wrap.append(btnGenerate, btnSend);
    tdActions.appendChild(wrap);

    tr.append(tdType, tdDate, tdProduct, tdText, tdReply, tdActions);
    tbody.appendChild(tr);
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
  const row = wbQuestionRows.find((x) => x.id === questionId);
  if (!row) return alert(tr("Вопрос не найден", "Question not found"));
  const endpoint = `${getQuestionsEndpoint(currentQuestionMarketplace)}/generate-reply`;
  const mpLabel = currentQuestionMarketplace === "ozon" ? "Ozon" : "WB";
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
      timeoutMs: 60000,
    }),
    tr(`Генерация зависит от AI-конфигурации сервиса (${mpLabel}).`, `Generation depends on AI settings (${mpLabel}).`)
  ).catch((e) => {
    alert(e.message);
    return null;
  });
  if (!data) return;
  wbQuestionDrafts.set(questionDraftKey(currentQuestionMarketplace, questionId), data.reply || "");
  renderWbQuestions();
}

async function sendQuestionReply(questionId) {
  const text = (wbQuestionDrafts.get(questionDraftKey(currentQuestionMarketplace, questionId)) || "").trim();
  if (!text) return alert(tr("Введите или сгенерируйте текст ответа", "Enter or generate reply text"));
  const endpoint = `${getQuestionsEndpoint(currentQuestionMarketplace)}/reply`;
  const mpLabel = currentQuestionMarketplace === "ozon" ? "Ozon" : "WB";
  const data = await withBusy(
    tr(`Отправляем ответ в ${mpLabel}…`, `Sending reply to ${mpLabel}...`),
    () => requestJson(endpoint, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ id: questionId, text }),
      timeoutMs: 60000,
    }),
    tr("Ответ отправляется в карточку вопроса через API маркетплейса.", "Reply is sent to marketplace question card via API.")
  ).catch((e) => {
    alert(e.message);
    return null;
  });
  if (!data) return;
  alert(data.message || tr("Ответ отправлен", "Reply sent"));
  await loadWbQuestions();
}

async function loadWbAdCampaigns() {
  if (!enabledModules.has("wb_ads")) return;
  wbAdsLoadToken += 1;
  const runToken = wbAdsLoadToken;
  wbAdsLoadProgress = { active: true, total: 0, loaded: 0, failed: 0 };
  updateWbAdsLoadStatus(tr("Загрузка списка кампаний…", "Loading campaign list..."));

  const data = await requestJson("/api/wb/ads/campaigns", { headers: authHeaders(), timeoutMs: 120000 }).catch((e) => {
    alert(e.message);
    return null;
  });
  if (!data) {
    wbAdsLoadProgress.active = false;
    updateWbAdsLoadStatus(tr("Не удалось загрузить кампании.", "Failed to load campaigns."));
    return;
  }
  wbCampaignRows = Array.isArray(data.campaigns) ? data.campaigns : [];
  const statsMap = (data && typeof data.stats === "object" && data.stats) ? data.stats : {};
  wbCampaignRows = wbCampaignRows.map((row) => {
    const cid = getCampaignRowId(row);
    if (!cid || !statsMap[cid]) return row;
    return { ...row, ...statsMap[cid] };
  });
  const ids = wbCampaignRows.map((row) => Number(getCampaignRowId(row) || 0)).filter((id) => id > 0);
  wbAdsLoadProgress.total = ids.length;
  wbAdsLoadProgress.loaded = 0;
  if (selectedWbCampaignId && !wbCampaignRows.some((x) => getCampaignRowId(x) === selectedWbCampaignId)) {
    selectedWbCampaignId = "";
  }
  updateWbAdsLoadStatus();
  renderWbCampaignRows();
  requestJson("/api/wb/ads/balance", { headers: authHeaders(), timeoutMs: 30000 })
    .then((payload) => {
      if (runToken !== wbAdsLoadToken) return;
      wbAdsBalanceData = payload;
      renderWbCampaignRows();
    })
    .catch(() => null);
  await enrichWbCampaignRows(runToken);
}

function getCampaignRowId(row) {
  return String(row?.advertId || row?.advert_id || row?.campaignId || row?.campaign_id || row?.id || row?.adId || "");
}

function campaignHasContext(row) {
  const name = String(row?.name || row?.campaignName || row?.campaign_name || row?.subject || row?.title || "").trim();
  const status = String(row?.status || row?.state || "").trim();
  const type = String(row?.type || row?.adType || row?.campaignType || row?.typeId || "").trim();
  const budget = String(row?.dailyBudget || row?.budget || row?.sum || "").trim();
  return Boolean(name || status || type || budget);
}

function mergeCampaignSummaryIntoRow(row, summary) {
  if (!summary || typeof summary !== "object") return row;
  const next = { ...row };
  if ((!next.name || next.name === "-") && summary.name) next.name = summary.name;
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
  holder.innerHTML = buildLoadStatusHtml({
    title: active
      ? tr("Догрузка кампаний", "Loading campaigns")
      : tr("Догрузка кампаний завершена", "Campaign load complete"),
    loaded,
    total,
    active,
    failed,
  });
}

async function enrichWbCampaignRows(runToken) {
  const allIds = wbCampaignRows
    .map((row) => Number(getCampaignRowId(row) || 0))
    .filter((id) => id > 0);
  if (!allIds.length) {
    wbAdsLoadProgress = { active: false, total: 0, loaded: 0, failed: 0 };
    updateWbAdsLoadStatus(tr("Кампании не найдены.", "No campaigns found."));
    return;
  }
  const pending = [...new Set(allIds)];
  wbAdsLoadProgress.total = pending.length;
  wbAdsLoadProgress.loaded = 0;
  wbAdsLoadProgress.failed = 0;
  updateWbAdsLoadStatus();

  const batchSize = 12;
  for (let i = 0; i < pending.length; i += batchSize) {
    if (runToken !== wbAdsLoadToken) return;
    const chunk = pending.slice(i, i + batchSize);
    const payload = await requestJson("/api/wb/ads/campaigns/enrich", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ ids: chunk }),
      timeoutMs: 120000,
    }).catch(() => null);

    if (!payload) {
      wbAdsLoadProgress.failed += chunk.length;
      wbAdsLoadProgress.loaded += chunk.length;
      updateWbAdsLoadStatus();
      continue;
    }

    const summaries = payload?.summaries && typeof payload.summaries === "object" ? payload.summaries : {};
    const stats = payload?.stats && typeof payload.stats === "object" ? payload.stats : {};
    wbCampaignRows = wbCampaignRows.map((row) => {
      const cid = getCampaignRowId(row);
      if (!cid) return row;
      const merged = mergeCampaignSummaryIntoRow(row, summaries[cid] || null);
      if (stats[cid] && typeof stats[cid] === "object") return { ...merged, ...stats[cid] };
      return merged;
    });
    wbAdsLoadProgress.loaded += chunk.length;
    updateWbAdsLoadStatus();
    renderWbCampaignRows();
  }
  if (runToken !== wbAdsLoadToken) return;
  wbAdsLoadProgress.active = false;
  updateWbAdsLoadStatus();
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
  const raw = row?.dailyBudget ?? row?.budget ?? row?.sum ?? row?.money ?? 0;
  const num = Number(raw);
  return Number.isFinite(num) ? num : 0;
}

function parseCampaignMetric(row, key, fixed = 0) {
  const val = Number(row?.[key]);
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
    const name = String(row?.name || row?.campaignName || row?.campaign_name || row?.subject || row?.title || "").trim();
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
    const aname = String(a?.name || a?.campaignName || a?.campaign_name || a?.subject || a?.title || "").toLowerCase();
    const bname = String(b?.name || b?.campaignName || b?.campaign_name || b?.subject || b?.title || "").toLowerCase();
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
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="11">${currentLang === "en" ? "No campaigns found." : "Кампании не найдены."}</td>`;
    tbody.appendChild(tr);
    return;
  }
  for (const row of rows) {
    const rowId = getCampaignRowId(row);
    const id = rowId || "-";
    const name = row.name || row.campaignName || row.campaign_name || row.subject || row.title || (id !== "-" ? (currentLang === "en" ? `Campaign ${id}` : `Кампания ${id}`) : "-");
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
    const tr = document.createElement("tr");
    if (selectedWbCampaignId && id === selectedWbCampaignId) tr.classList.add("selected-row");
    tr.innerHTML = `
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
    tr.onclick = () => {
      if (id === "-") return;
      selectedWbCampaignId = id;
      const campaignInput = document.getElementById("wbRateCampaignId");
      if (campaignInput) campaignInput.value = String(id);
      const typeInput = document.getElementById("wbRateCampaignType");
      const typeRaw = String(typeMeta.label || type).toLowerCase();
      if (typeInput) {
        if (typeRaw.includes("auto")) typeInput.value = "auto-cpm";
        else if (typeRaw.includes("search")) typeInput.value = "search";
      }
      renderWbCampaignRows();
    };
    tr.ondblclick = () => {
      if (id === "-") return;
      openCampaignDetailModal(Number(id));
    };
    tbody.appendChild(tr);
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
  const statusText = normalizeCampaignStatus(summary.status || "-");
  const typeText = normalizeCampaignType(summary.type || "-");
  const workingText = campaignStatusMeta(summary.status || "-").isWorking ? tr("Да", "Yes") : tr("Нет", "No");
  const summaryRows = [
    `ID: ${summary.campaign_id || "-"}`,
    `${tr("Название", "Name")}: ${summary.name || "-"}`,
    `${tr("Статус", "Status")}: ${statusText}`,
    `${tr("Тип", "Type")}: ${typeText}`,
    `${tr("Работает", "Running")}: ${workingText}`,
    `${tr("Бюджет", "Budget")}: ${summary.budget || "-"}`,
    `${tr("Создана", "Created")}: ${summary.created_at || "-"}`,
    `${tr("Обновлена", "Updated")}: ${summary.updated_at || "-"}`,
  ];
  summaryEl.textContent = summaryRows.join(" | ");

  productsEl.innerHTML = "";
  const products = Array.isArray(data?.products) ? data.products : [];
  if (!products.length) {
    const rowEl = document.createElement("tr");
    rowEl.innerHTML = `<td colspan="3">${tr("Товары кампании не обнаружены в ответах API.", "Campaign products were not found in API responses.")}</td>`;
    productsEl.appendChild(rowEl);
  } else {
    for (const row of products.slice(0, 600)) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(row.nmId ?? "-")}</td>
        <td>${escapeHtml(row.offer ?? "-")}</td>
        <td>${escapeHtml(row.name ?? "-")}</td>
      `;
      productsEl.appendChild(tr);
    }
  }

  ratesEl.textContent = JSON.stringify(data?.rates || {}, null, 2);
  statsEl.textContent = JSON.stringify(data?.stats || {}, null, 2);
  rawEl.textContent = JSON.stringify(data?.raw || {}, null, 2);
}

async function openCampaignDetailModal(campaignId) {
  if (!campaignId || campaignId <= 0) return;
  currentCampaignDetailId = Number(campaignId) || 0;
  const modal = document.getElementById("campaignDetailModal");
  if (!modal) return;

  modal.classList.remove("hidden");
  const summaryEl = document.getElementById("campaignDetailSummary");
  const productsEl = document.getElementById("campaignProductsTable");
  const ratesEl = document.getElementById("campaignRatesRaw");
  const statsEl = document.getElementById("campaignStatsRaw");
  const rawEl = document.getElementById("campaignDetailRaw");
  if (summaryEl) summaryEl.textContent = tr("Загружаем детали кампании…", "Loading campaign details...");
  if (productsEl) productsEl.innerHTML = "";
  if (ratesEl) ratesEl.textContent = "-";
  if (statsEl) statsEl.textContent = "-";
  if (rawEl) rawEl.textContent = "-";

  const cacheKey = String(campaignId);
  let payload = wbCampaignDetailCache.get(cacheKey) || null;
  if (!payload) {
    payload = await withBusy(
      tr(`Загружаем детали кампании ${campaignId}…`, `Loading campaign ${campaignId} details...`),
      () => requestJson(`/api/wb/ads/campaign-details?campaign_id=${campaignId}`, {
        headers: authHeaders(),
        timeoutMs: 120000,
      }),
      tr("Сбор деталей идет через несколько методов API WB.", "Details are fetched via several WB API methods.")
    ).catch((e) => {
      alert(e.message);
      return null;
    });
    if (!payload) return;
    wbCampaignDetailCache.set(cacheKey, payload);
  }
  renderCampaignDetail(payload.data || {});
}

async function refreshCampaignDetails() {
  if (!currentCampaignDetailId) return;
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

async function loadAdsAnalytics() {
  if (!enabledModules.has("wb_ads_analytics")) return;
  const dateFrom = (document.getElementById("adsAnalyticsFrom")?.value || "").trim();
  const dateTo = (document.getElementById("adsAnalyticsTo")?.value || "").trim();
  const campaignId = Number(document.getElementById("adsAnalyticsCampaignId")?.value || 0);
  const qp = new URLSearchParams();
  if (dateFrom) qp.set("date_from", dateFrom);
  if (dateTo) qp.set("date_to", dateTo);
  if (campaignId > 0) qp.set("campaign_id", String(campaignId));
  const suffix = qp.toString() ? `?${qp.toString()}` : "";
  const totalBox = document.getElementById("adsAnalyticsTotals");
  const rawBox = document.getElementById("adsAnalyticsRaw");
  if (totalBox) totalBox.textContent = tr("Загружаем аналитику...", "Loading analytics...");
  const data = await requestJson(`/api/wb/ads/analytics${suffix}`, { headers: authHeaders(), timeoutMs: 120000 }).catch((e) => {
    adsAnalyticsRows = [];
    renderAdsAnalyticsRows();
    if (totalBox) totalBox.textContent = tr("Ошибка загрузки аналитики. Проверьте API-ключ и период.", "Analytics loading failed. Check API key and period.");
    if (rawBox) rawBox.textContent = tr("Ошибка загрузки аналитики.", "Analytics loading failed.");
    alert(e.message);
    return null;
  });
  if (!data) return;
  adsAnalyticsRows = Array.isArray(data.rows) ? data.rows : [];
  if (totalBox) totalBox.textContent = JSON.stringify(data.totals || {}, null, 2);
  if (rawBox) rawBox.textContent = JSON.stringify(data, null, 2);
  renderAdsAnalyticsRows();
}

function renderAdsAnalyticsRows() {
  const tbody = document.getElementById("adsAnalyticsTable");
  if (!tbody) return;
  tbody.innerHTML = "";
  if (!adsAnalyticsRows.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="12">${currentLang === "en" ? "No data." : "Нет данных."}</td>`;
    tbody.appendChild(tr);
    return;
  }
  for (const row of adsAnalyticsRows) {
    const ctrVal = parseCampaignMetric(row, "ctr", 2);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(row.campaign_id ?? "-")}</td>
      <td>${escapeHtml(row.name ?? "-")}</td>
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
    tbody.appendChild(tr);
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
      : tr("Рекомендации загружены", "Recommendations loaded"),
    loaded,
    total,
    active,
  });
}

async function loadAdsRecommendations() {
  if (!enabledModules.has("wb_ads_recommendations")) return;
  adsRecLoadToken += 1;
  const runToken = adsRecLoadToken;
  const dateFrom = (document.getElementById("adsRecFrom")?.value || "").trim();
  const dateTo = (document.getElementById("adsRecTo")?.value || "").trim();
  const minSpent = Number(document.getElementById("adsRecMinSpent")?.value || 0);
  const qp = new URLSearchParams();
  if (dateFrom) qp.set("date_from", dateFrom);
  if (dateTo) qp.set("date_to", dateTo);
  if (Number.isFinite(minSpent) && minSpent > 0) qp.set("min_spent", String(minSpent));

  const meta = document.getElementById("adsRecMeta");
  if (meta) meta.textContent = tr("Загружаем рекомендации...", "Loading recommendations...");
  adsRecommendationRows = [];
  renderAdsRecommendationsRows();
  adsRecLoadProgress = { active: true, total: 0, loaded: 0 };
  updateAdsRecLoadStatus(tr("Подготовка догрузки...", "Preparing progressive load..."));

  let offset = 0;
  const pageLimit = 40;
  let finalMeta = {};
  while (true) {
    if (runToken !== adsRecLoadToken) return;
    const qpLocal = new URLSearchParams(qp);
    qpLocal.set("offset", String(offset));
    qpLocal.set("limit", String(pageLimit));
    const localSuffix = `?${qpLocal.toString()}`;
    const data = await requestJson(`/api/wb/ads/recommendations${localSuffix}`, { headers: authHeaders(), timeoutMs: 120000 }).catch((e) => {
      if (offset === 0) alert(e.message);
      return null;
    });
    if (!data) break;
    if (runToken !== adsRecLoadToken) return;

    const chunkRows = Array.isArray(data.rows) ? data.rows : [];
    adsRecommendationRows.push(...chunkRows);
    const byCampaign = new Map();
    for (const row of adsRecommendationRows) {
      const key = row?.campaign_id != null ? String(row.campaign_id) : JSON.stringify(row);
      byCampaign.set(key, row);
    }
    adsRecommendationRows = [...byCampaign.values()];
    renderAdsRecommendationsRows();

    const info = data.meta || {};
    const totalCampaigns = Number(info.total_campaigns || 0);
    const nextOffset = Number(info.next_offset || 0);
    const hasMore = Boolean(info.has_more);
    const scanned = Number(info.offset || offset) + Number(info.limit || pageLimit);
    adsRecLoadProgress.total = totalCampaigns > 0 ? totalCampaigns : Math.max(adsRecLoadProgress.total, scanned);
    adsRecLoadProgress.loaded = Math.min(adsRecLoadProgress.total, scanned);
    updateAdsRecLoadStatus();
    finalMeta = {
      date_from: data.date_from,
      date_to: data.date_to,
      campaigns_scanned: info.campaigns_scanned || 0,
      loaded_campaigns: adsRecLoadProgress.loaded,
      total_campaigns: adsRecLoadProgress.total,
      min_spent: info.min_spent ?? minSpent ?? 0,
      recommendations: adsRecommendationRows.length,
    };
    if (meta) meta.textContent = JSON.stringify(finalMeta, null, 2);
    if (!hasMore) break;
    offset = nextOffset > offset ? nextOffset : offset + pageLimit;
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  if (runToken !== adsRecLoadToken) return;
  adsRecLoadProgress.active = false;
  updateAdsRecLoadStatus();

  if (meta && Object.keys(finalMeta).length) {
    meta.textContent = JSON.stringify(finalMeta, null, 2);
  }
  const raw = document.getElementById("adsRecRaw");
  if (raw) raw.textContent = JSON.stringify({ rows: adsRecommendationRows, meta: finalMeta }, null, 2);
  renderAdsRecommendationsRows();
}

function renderAdsRecommendationsRows() {
  const tbody = document.getElementById("adsRecTable");
  if (!tbody) return;
  tbody.innerHTML = "";
  if (!adsRecommendationRows.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="14">${currentLang === "en" ? "No recommendations for selected period." : "Рекомендаций за выбранный период нет."}</td>`;
    tbody.appendChild(tr);
    return;
  }
  for (const row of adsRecommendationRows) {
    const ctrVal = parseCampaignMetric(row, "ctr", 2);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(row.campaign_id ?? "-")}</td>
      <td>${escapeHtml(row.name ?? "-")}</td>
      <td>${escapeHtml(row.status ?? "-")}</td>
      <td>${escapeHtml(row.type ?? "-")}</td>
      <td>${escapeHtml(parseCampaignMetric(row, "views"))}</td>
      <td>${escapeHtml(parseCampaignMetric(row, "clicks"))}</td>
      <td>${escapeHtml(ctrVal === "-" ? "-" : `${ctrVal}%`)}</td>
      <td>${escapeHtml(parseCampaignMetric(row, "orders"))}</td>
      <td>${escapeHtml(parseCampaignMetric(row, "spent", 2))}</td>
      <td>${escapeHtml(parseCampaignMetric(row, "cpc", 2))}</td>
      <td>${escapeHtml(parseCampaignMetric(row, "cpo", 2))}</td>
      <td>${escapeHtml(row.priority ?? "-")}</td>
      <td>${escapeHtml(row.recommendation ?? "-")}</td>
      <td>${escapeHtml(row.reason ?? "-")}</td>
    `;
    tbody.appendChild(tr);
  }
}

function getImportPayload() {
  const marketplace = document.getElementById("importMarketplace").value;
  const rawArticles = document.getElementById("articles").value.trim();
  const articles = rawArticles ? rawArticles.split(",").map((x) => x.trim()).filter(Boolean) : [];
  const import_all = document.getElementById("importAll").checked;
  return { marketplace, articles, import_all };
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
  await loadProducts();
  await loadDashboard();
  alert(tr(`Импортировано: ${data.length}`, `Imported: ${data.length}`));
}

async function reloadProducts() {
  if (!confirm(tr("Очистить локальную базу товаров по выбранному маркетплейсу и загрузить заново?", "Clear local catalog for selected marketplace and reload?"))) return;
  const payload = getImportPayload();
  const body = JSON.stringify(payload);
  const data = await withBusy(
    tr("Обновляем локальную базу товаров…", "Refreshing local catalog..."),
    () => tryRequestChain([
      { url: "/api/products/reload", opts: { method: "POST", headers: authHeaders(), body, timeoutMs: 120000 } },
      { url: "/api/products/refresh", opts: { method: "POST", headers: authHeaders(), body, timeoutMs: 120000 } },
      { url: "/api/products/reset", opts: { method: "POST", headers: authHeaders(), body, timeoutMs: 120000 } },
      { url: "/api/products/reimport", opts: { method: "POST", headers: authHeaders(), body, timeoutMs: 120000 } },
    ]),
    tr("Сначала очищаем локальные данные, затем загружаем карточки заново.", "First local data is cleared, then products are loaded again.")
  ).catch((e) => {
    alert(e.message);
    return null;
  });
  if (!data) return;
  selectedProducts.clear();
  await loadProducts();
  await loadSeoJobs();
  await loadDashboard();
  alert(tr(`База обновлена, товаров: ${data.length}`, `Catalog refreshed, products: ${data.length}`));
}

async function loadProducts() {
  const rows = await requestJson("/api/products", { headers: authHeaders() }).catch(() => null);
  if (!rows) return;

  const filter = (document.getElementById("productFilter")?.value || "").trim().toLowerCase();
  currentProducts = filter
    ? rows.filter((p) => `${p.article} ${p.name} ${p.barcode || ""}`.toLowerCase().includes(filter))
    : rows;

  const tbody = document.getElementById("productsTable");
  tbody.innerHTML = "";

  for (const p of currentProducts) {
    const tr = document.createElement("tr");
    if (p.id === selectedProductId) tr.classList.add("selected-row");
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
    const tdArticle = document.createElement("td");
    tdArticle.textContent = p.article;
    const tdBarcode = document.createElement("td");
    tdBarcode.textContent = p.barcode || "-";
    const tdName = document.createElement("td");
    tdName.textContent = p.name;
    const tdPos = document.createElement("td");
    tdPos.textContent = formatPositionValue(p.last_position);

    tr.append(tdSelect, tdPhoto, tdId, tdMp, tdArticle, tdBarcode, tdName, tdPos);
    tr.onclick = () => {
      selectedProductId = p.id;
      suggestKeywordsForSelectedProduct(p.id);
      loadProducts();
    };
    tbody.appendChild(tr);
  }

  if (!selectedProductId && currentProducts.length) {
    selectedProductId = currentProducts[0].id;
  }
  const selected = currentProducts.find((x) => x.id === selectedProductId) || currentProducts[0] || null;
  if (selected?.id) {
    suggestKeywordsForSelectedProduct(selected.id);
  }
}

function toggleProduct(id, checked) {
  if (checked) selectedProducts.add(id);
  else selectedProducts.delete(id);
}

function selectAllProducts() {
  selectedProducts = new Set(currentProducts.map((x) => x.id));
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
  await loadSeoJobs();
  await loadDashboard();
  if (data.length) renderSeoPreview(data[0]);
  alert(tr(`Сгенерировано задач: ${data.length}`, `Generated jobs: ${data.length}`));
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
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input type="checkbox" ${selectedJobs.has(j.id) ? "checked" : ""} onchange="toggleJob(${j.id}, this.checked)"></td>
      <td>${j.id}</td>
      <td>${article}</td>
      <td>${name}</td>
      <td>${j.status}</td>
      <td>${formatPositionValue(j.current_position)}</td>
      <td>${j.next_check_at ?? "-"}</td>
    `;
    tr.onclick = () => renderSeoPreview(j);
    tbody.appendChild(tr);
  }
  renderSeoKanban(rows);
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
  await loadSeoJobs();
  await loadDashboard();
  alert(tr(`Переоценено просроченных задач: ${data.length}`, `Rechecked overdue jobs: ${data.length}`));
}

async function loadDashboard() {
  const d = await requestJson("/api/dashboard", { headers: authHeaders() }).catch(() => null);
  if (!d) return;

  const stats = [
    [tr("Товаров", "Products"), d.total_products],
    [tr("SEO задач", "SEO jobs"), d.total_jobs],
    [tr("Применено", "Applied"), d.applied_jobs],
    [tr("В работе", "In progress"), d.in_progress_jobs],
    [tr("Топ-5", "Top-5"), d.top5_products],
  ];

  const maxVal = Math.max(...stats.map((x) => x[1]), 1);
  document.getElementById("stats").innerHTML = stats
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

  const points = await loadTrend({ days: 21 });
  renderTrendChart("dashboardTrendChart", "dashboardTrendMeta", points);
}

function initSalesPeriodDefaults() {
  const toEl = document.getElementById("salesDateTo");
  const fromEl = document.getElementById("salesDateFrom");
  if (!toEl || !fromEl) return;
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
  if (!host) return;
  const manualOtherCosts = Math.max(0, Number(document.getElementById("salesOtherCosts")?.value || 0));
  const totals = {
    orders: salesRows.reduce((acc, row) => acc + Number(row.orders || 0), 0),
    units: salesRows.reduce((acc, row) => acc + Number(row.units || 0), 0),
    revenue: salesRows.reduce((acc, row) => acc + Number(row.revenue || 0), 0),
    returns: salesRows.reduce((acc, row) => acc + Number(row.returns || 0), 0),
    ad_spend: salesRows.reduce((acc, row) => acc + Number(row.ad_spend || 0), 0),
    other_costs: salesRows.reduce((acc, row) => acc + Number(row.other_costs || 0), 0) + manualOtherCosts,
  };
  totals.gross_profit = Number(totals.revenue || 0) - Number(totals.ad_spend || 0) - Number(totals.other_costs || 0);
  host.innerHTML = `
    <article class="sales-kpi"><span>${tr("Заказы", "Orders")}</span><strong>${formatInt(totals.orders)}</strong></article>
    <article class="sales-kpi"><span>${tr("Штуки", "Units")}</span><strong>${formatInt(totals.units)}</strong></article>
    <article class="sales-kpi"><span>${tr("Выручка", "Revenue")}</span><strong>${formatMoney(totals.revenue)}</strong></article>
    <article class="sales-kpi"><span>${tr("Отказы", "Returns")}</span><strong>${formatInt(totals.returns)}</strong></article>
    <article class="sales-kpi"><span>${tr("Реклама", "Ads Spend")}</span><strong>${formatMoney(totals.ad_spend)}</strong></article>
    <article class="sales-kpi"><span>${tr("Прочие траты", "Other Costs")}</span><strong>${formatMoney(totals.other_costs)}</strong></article>
    <article class="sales-kpi"><span>${tr("Валовая прибыль", "Gross Profit")}</span><strong>${formatMoney(totals.gross_profit)}</strong></article>
  `;
}

function renderSalesChart(points) {
  const svg = document.getElementById("salesTrendChart");
  const meta = document.getElementById("salesTrendMeta");
  if (!svg || !meta) return;
  if (!Array.isArray(points) || !points.length || !Array.isArray(salesRows) || !salesRows.length) {
    svg.innerHTML = "";
    meta.textContent = tr("Нет данных за период.", "No data for selected period.");
    return;
  }
  const metric = (document.getElementById("salesMetricMode")?.value || "units").trim().toLowerCase();
  const showTotal = Boolean(document.getElementById("salesShowTotal")?.checked);
  const showWb = Boolean(document.getElementById("salesShowWb")?.checked);
  const showOzon = Boolean(document.getElementById("salesShowOzon")?.checked);
  const dayMap = new Map();
  for (const row of salesRows) {
    const day = String(row.date || "").trim();
    if (!day) continue;
    const bucket = dayMap.get(day) || {
      wb: { orders: 0, units: 0, revenue: 0, returns: 0, ad_spend: 0, other_costs: 0 },
      ozon: { orders: 0, units: 0, revenue: 0, returns: 0, ad_spend: 0, other_costs: 0 },
    };
    const mp = String(row.marketplace || "").toLowerCase() === "ozon" ? "ozon" : "wb";
    bucket[mp].orders += Number(row.orders || 0);
    bucket[mp].units += Number(row.units || 0);
    bucket[mp].revenue += Number(row.revenue || 0);
    bucket[mp].returns += Number(row.returns || 0);
    bucket[mp].ad_spend += Number(row.ad_spend || 0);
    bucket[mp].other_costs += Number(row.other_costs || 0);
    dayMap.set(day, bucket);
  }
  const days = [...dayMap.keys()].sort();
  const valueOf = (bucket, key) => {
    if (key === "orders") return Number(bucket.orders || 0);
    if (key === "revenue") return Number(bucket.revenue || 0);
    if (key === "returns") return Number(bucket.returns || 0);
    if (key === "ad_spend") return Number(bucket.ad_spend || 0);
    if (key === "other_costs") return Number(bucket.other_costs || 0);
    return Number(bucket.units || 0);
  };
  const series = [];
  if (showTotal) {
    series.push({
      key: "total",
      label: tr("Всего", "Total"),
      color: "#8a94ff",
      values: days.map((day) => {
        const b = dayMap.get(day);
        return valueOf(b.wb, metric) + valueOf(b.ozon, metric);
      }),
    });
  }
  if (showWb) {
    series.push({
      key: "wb",
      label: "WB",
      color: "#20d7ff",
      values: days.map((day) => valueOf(dayMap.get(day).wb, metric)),
    });
  }
  if (showOzon) {
    series.push({
      key: "ozon",
      label: "Ozon",
      color: "#39efc1",
      values: days.map((day) => valueOf(dayMap.get(day).ozon, metric)),
    });
  }
  if (!series.length) {
    svg.innerHTML = "";
    meta.textContent = tr("Выберите хотя бы одну линию графика.", "Select at least one chart line.");
    return;
  }

  const allValues = series.flatMap((x) => x.values);
  const min = Math.min(...allValues, 0);
  const max = Math.max(...allValues, 0);
  const range = Math.max(1, max - min);
  const width = 720;
  const height = 150;
  const padX = 14;
  const padY = 12;
  const step = (width - padX * 2) / Math.max(1, days.length - 1);
  const lineTo = (values) => values
    .map((v, idx) => {
      const x = padX + idx * step;
      const y = padY + (1 - ((Number(v || 0) - min) / range)) * (height - padY * 2);
      return `${x},${y}`;
    })
    .join(" ");
  const circleAt = (value, idx, color) => {
    const x = padX + idx * step;
    const y = padY + (1 - ((Number(value || 0) - min) / range)) * (height - padY * 2);
    return `<circle cx="${x}" cy="${y}" r="4.5" fill="${color}" stroke="rgba(255,255,255,0.48)" stroke-width="1"></circle>`;
  };
  svg.innerHTML = series
    .map((item) => {
      const line = item.values.length > 1
        ? `<polyline points="${lineTo(item.values)}" fill="none" stroke="${item.color}" stroke-width="3" stroke-linecap="round"></polyline>`
        : "";
      const points = item.values.map((v, idx) => circleAt(v, idx, item.color)).join("");
      return `${line}${points}`;
    })
    .join("");
  const metricLabel = metric === "revenue"
    ? tr("Выручка", "Revenue")
    : (metric === "orders"
      ? tr("Заказы", "Orders")
      : (metric === "returns"
        ? tr("Отказы", "Returns")
        : (metric === "ad_spend"
          ? tr("Реклама", "Ads Spend")
          : (metric === "other_costs" ? tr("Прочие траты", "Other Costs") : tr("Штуки", "Units")))));
  const formatValue = (metric === "revenue" || metric === "ad_spend" || metric === "other_costs") ? formatMoney : formatInt;
  meta.innerHTML = `
    <span>${metricLabel}: <b>${series.map((item) => `${item.label} ${formatValue(item.values.reduce((a, b) => a + Number(b || 0), 0))}`).join(" • ")}</b></span>
  `;
}

function buildSalesChartFromRows(rows) {
  if (!Array.isArray(rows) || !rows.length) return [];
  const dayMap = new Map();
  for (const row of rows) {
    const day = String(row?.date || "").trim();
    if (!day) continue;
    const bucket = dayMap.get(day) || {
      date: day,
      orders: 0,
      units: 0,
      revenue: 0,
      returns: 0,
      ad_spend: 0,
      other_costs: 0,
    };
    bucket.orders += Number(row?.orders || 0);
    bucket.units += Number(row?.units || 0);
    bucket.revenue += Number(row?.revenue || 0);
    bucket.returns += Number(row?.returns || 0);
    bucket.ad_spend += Number(row?.ad_spend || 0);
    bucket.other_costs += Number(row?.other_costs || 0);
    dayMap.set(day, bucket);
  }
  return [...dayMap.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

function renderSalesStats() {
  const tbody = document.getElementById("salesTable");
  const raw = document.getElementById("salesRaw");
  if (!tbody || !raw) return;
  tbody.innerHTML = "";
  if (!Array.isArray(salesRows) || !salesRows.length) {
    const trEl = document.createElement("tr");
    trEl.innerHTML = `<td colspan="8">${tr("Нет продаж за период.", "No sales for selected period.")}</td>`;
    tbody.appendChild(trEl);
  } else {
    for (const row of salesRows) {
      const trEl = document.createElement("tr");
      trEl.innerHTML = `
        <td>${escapeHtml(row.date || "-")}</td>
        <td>${escapeHtml((row.marketplace || "-").toUpperCase())}</td>
        <td>${escapeHtml(formatInt(row.orders ?? 0))}</td>
        <td>${escapeHtml(formatInt(row.units ?? 0))}</td>
        <td>${escapeHtml(formatMoney(Number(row.revenue || 0)))}</td>
        <td>${escapeHtml(formatInt(row.returns ?? 0))}</td>
        <td>${escapeHtml(formatMoney(Number(row.ad_spend || 0)))}</td>
        <td>${escapeHtml(formatMoney(Number(row.other_costs || 0)))}</td>
      `;
      tbody.appendChild(trEl);
    }
  }
  renderSalesTotals();
  const chartRows = (Array.isArray(salesChartRows) && salesChartRows.length)
    ? salesChartRows
    : buildSalesChartFromRows(salesRows);
  renderSalesChart(chartRows);
  raw.textContent = JSON.stringify({
    rows: salesRows,
    chart: chartRows,
    manual_other_costs: Number(document.getElementById("salesOtherCosts")?.value || 0),
  }, null, 2);
}

async function loadSalesStats() {
  if (!enabledModules.has("sales_stats")) {
    const meta = document.getElementById("salesStatsMeta");
    if (meta) meta.textContent = tr("Модуль статистики продаж отключен администратором.", "Sales statistics module is disabled by admin.");
    salesRows = [];
    salesChartRows = [];
    renderSalesStats();
    return;
  }
  salesLoadToken += 1;
  const runToken = salesLoadToken;
  initSalesPeriodDefaults();
  const market = (document.getElementById("salesMarketplace")?.value || "all").trim().toLowerCase();
  const date_from = (document.getElementById("salesDateFrom")?.value || "").trim();
  const date_to = (document.getElementById("salesDateTo")?.value || "").trim();
  syncSalesRangeButtons();
  const qp = new URLSearchParams();
  qp.set("marketplace", market || "all");
  if (date_from) qp.set("date_from", date_from);
  if (date_to) qp.set("date_to", date_to);
  const meta = document.getElementById("salesStatsMeta");
  if (meta) meta.textContent = tr("Загрузка статистики продаж...", "Loading sales statistics...");

  const data = await requestJson(`/api/sales/stats?${qp.toString()}`, {
    headers: authHeaders(),
    timeoutMs: 120000,
  }).catch((e) => {
    if (runToken !== salesLoadToken) return null;
    salesRows = [];
    salesChartRows = [];
    renderSalesStats();
    if (meta) meta.textContent = tr("Ошибка загрузки статистики. Проверьте API-ключи и период.", "Sales loading failed. Check API keys and period.");
    alert(e.message);
    return null;
  });
  if (!data) return;
  if (runToken !== salesLoadToken) return;

  salesRows = Array.isArray(data.rows) ? data.rows : [];
  salesChartRows = Array.isArray(data.chart) ? data.chart : [];
  if (!salesChartRows.length && salesRows.length) {
    salesChartRows = buildSalesChartFromRows(salesRows);
  }
  const totals = data.totals || {};
  const warnings = Array.isArray(data.warnings) ? data.warnings.filter(Boolean) : [];
  if (meta) {
    const totalTxt = tr(
      `Заказы: ${formatInt(totals.orders || 0)}, шт.: ${formatInt(totals.units || 0)}, выручка: ${formatMoney(totals.revenue || 0)}, отказы: ${formatInt(totals.returns || 0)}, реклама: ${formatMoney(totals.ad_spend || 0)}, прочие: ${formatMoney(totals.other_costs || 0)}.`,
      `Orders: ${formatInt(totals.orders || 0)}, units: ${formatInt(totals.units || 0)}, revenue: ${formatMoney(totals.revenue || 0)}, returns: ${formatInt(totals.returns || 0)}, ads: ${formatMoney(totals.ad_spend || 0)}, other: ${formatMoney(totals.other_costs || 0)}.`
    );
    const warnTxt = warnings.length ? ` ${warnings.join(" | ")}` : "";
    meta.textContent = `${totalTxt}${warnTxt}`;
  }
  renderSalesStats();
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
  if (el) el.value = value ?? "";
}

function renderProfileData(data) {
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
  setInputValue("profileAvatarUrl", data.avatar_url || "");
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

  const planSummary = document.getElementById("profilePlanSummary");
  if (planSummary) {
    planSummary.textContent = JSON.stringify(
      {
        email: data.email || "",
        plan_code: data.plan_code || "",
        plan_status: data.plan_status || "",
        monthly_price: data.monthly_price || 0,
        renew_at: data.renew_at || null,
      },
      null,
      2
    );
  }

  const keysView = document.getElementById("profileKeysList");
  if (keysView) keysView.textContent = JSON.stringify(data.credentials || [], null, 2);
}

async function loadProfile() {
  if (!enabledModules.has("user_profile")) return;
  const data = await requestJson("/api/profile", { headers: authHeaders(), timeoutMs: 60000 }).catch((e) => {
    alert(e.message);
    return null;
  });
  if (!data) return;
  renderProfileData(data);
}

async function saveProfileData() {
  if (!enabledModules.has("user_profile")) return;
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
  await loadProfile();
}

async function loadHelpDocs() {
  if (!enabledModules.has("help_center")) return;
  const moduleCode = (document.getElementById("helpModuleSelect")?.value || "").trim();
  const lang = (document.getElementById("helpLangSelect")?.value || currentLang || "ru").trim().toLowerCase();
  const qp = new URLSearchParams();
  if (moduleCode) qp.set("module_code", moduleCode);
  qp.set("lang", lang === "en" ? "en" : "ru");
  const data = await requestJson(`/api/help/docs?${qp.toString()}`, { headers: authHeaders() }).catch((e) => {
    alert(e.message);
    return null;
  });
  if (!data) return;
  const rows = Array.isArray(data) ? data : [];
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
    if (prev && [...select.options].some((opt) => opt.value === prev)) {
      select.value = prev;
    }
  }
  const view = document.getElementById("helpDocsView");
  if (!view) return;
  if (!rows.length) {
    view.innerHTML = `<div class="help-empty">${lang === "en" ? "No help data." : "Справка не найдена."}</div>`;
    return;
  }
  const moduleChips = rows.map((row) => {
    const code = String(row?.module_code || "").trim();
    const title = String(row?.title || code || "-").trim();
    if (!code) return "";
    return `
      <button class="help-chip-btn" type="button" onclick="openHelpModule('${escapeHtml(code)}')">
        ${escapeHtml(title)}
      </button>
    `;
  }).join("");

  const cards = rows.map((row) => {
    const code = String(row?.module_code || "").trim();
    const title = String(row?.title || code || "-").trim();
    return `
      <article class="help-card" id="help-card-${escapeHtml(code)}">
        <header class="help-card-head">
          <div>
            <h4>${escapeHtml(title)}</h4>
            <small>[${escapeHtml(code)}]</small>
          </div>
          <div class="help-card-actions">
            <button class="btn-secondary help-open-btn" type="button" onclick="openHelpModule('${escapeHtml(code)}')">
              ${lang === "en" ? "Open module" : "Открыть модуль"}
            </button>
            <button class="help-filter-btn" type="button" onclick="filterHelpModule('${escapeHtml(code)}')">
              ${lang === "en" ? "Show only this" : "Только этот модуль"}
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
            <li>${lang === "en" ? "If needed, inspect RAW block for diagnostics." : "При необходимости откройте RAW-блок для диагностики."}</li>
          </ol>
        </div>
      </article>
    `;
  }).join("");

  view.innerHTML = `
    <div class="help-header">
      <div class="help-header-title">
        <h4>${lang === "en" ? "Interactive help center" : "Интерактивная справка"}</h4>
        <p>${lang === "en" ? "Click any module and jump directly to it." : "Нажмите на модуль и перейдите к нему прямо из справки."}</p>
      </div>
      <div class="help-chip-list">${moduleChips}</div>
    </div>
    <div class="help-card-list">${cards}</div>
  `;
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
    const bullets = lines.every((line) => /^[-–—]\s+/.test(line));
    const headerAndBullets = lines.length > 1 && /:\s*$/.test(firstRaw) && lines.slice(1).every((line) => /^[-–—]\s+/.test(line));

    if (headerAndBullets) {
      const items = lines.slice(1).map((line) => `<li>${escapeHtml(line.replace(/^[-–—]\s+/, ""))}</li>`).join("");
      return `<section class="help-block"><h5>${escapeHtml(firstRaw)}</h5><ul>${items}</ul></section>`;
    }
    if (numbered) {
      const items = lines.map((line) => `<li>${escapeHtml(line.replace(/^\d+[).]\s+/, ""))}</li>`).join("");
      return `<section class="help-block"><ol>${items}</ol></section>`;
    }
    if (bullets) {
      const items = lines.map((line) => `<li>${escapeHtml(line.replace(/^[-–—]\s+/, ""))}</li>`).join("");
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
  const code = String(moduleCode || "").trim().toLowerCase();
  const tab = HELP_MODULE_TAB_MAP[code];
  if (!tab) return;
  const btn = document.querySelector(`.nav-btn[data-tab="${tab}"]`);
  showTab(tab, btn || null);
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
applyButtonTooltips();
initHoverTips();
ensureAuth();

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

const salesOtherCostsInput = document.getElementById("salesOtherCosts");
if (salesOtherCostsInput) {
  salesOtherCostsInput.addEventListener("input", () => renderSalesStats());
  salesOtherCostsInput.addEventListener("change", () => renderSalesStats());
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
