const storedAdminSession = sessionStorage.getItem("admin_token") || "";
const storedAdminLocal = localStorage.getItem("admin_token") || "";
let adminToken = storedAdminSession || storedAdminLocal || "";
let adminTokenStorage = storedAdminSession ? "session" : (storedAdminLocal ? "local" : "");
let adminMe = null;
let adminUsers = [];
let adminModules = [];
let adminMobileModules = [];
let adminCredentials = [];
let adminUiSettings = null;
let adminAuditRows = [];
let adminAuditPage = 1;
let adminAuditPageSize = 100;
let adminAuditTotal = 0;
let adminAuditTotalPages = 0;
let adminAiGlobalState = null;
let adminSelectedUserAiState = null;
let adminServerMetrics = null;
let adminServerHistory = [];
let adminNotificationSettings = null;
let adminAnnouncements = [];
let adminAnnouncementEditId = 0;
let adminServerAutoTimer = null;
const adminUserProfileCache = new Map();
let adminTeamModalState = {
  userId: 0,
  rowId: "",
  mode: "create",
  memberId: 0,
  teamMembers: [],
};

const UI_THEMES = ["classic", "dark", "light", "moon", "newyear", "summer", "autumn", "winter", "spring", "japan", "greenland"];
const BILLING_PLAN_CODES = ["starter", "pro", "business"];
const ADMIN_DEFAULT_AVATARS = Array.from({ length: 8 }, (_, i) => `/static/avatars/avatar-${String(i + 1).padStart(2, "0")}.svg`);

let adminLang = (localStorage.getItem("admin_ui_lang") || "ru").toLowerCase() === "en" ? "en" : "ru";
let adminTheme = String(localStorage.getItem("admin_ui_theme") || "classic").toLowerCase();
if (!UI_THEMES.includes(adminTheme)) adminTheme = "classic";

function setAdminToken(nextToken = "", persist = null) {
  adminToken = String(nextToken || "");
  if (!adminToken) {
    adminTokenStorage = "";
    localStorage.removeItem("admin_token");
    sessionStorage.removeItem("admin_token");
    return;
  }
  const useLocal = persist === null ? adminTokenStorage === "local" : Boolean(persist);
  adminTokenStorage = useLocal ? "local" : "session";
  if (useLocal) {
    localStorage.setItem("admin_token", adminToken);
    sessionStorage.removeItem("admin_token");
    localStorage.setItem("admin_remember_me", "1");
  } else {
    sessionStorage.setItem("admin_token", adminToken);
    localStorage.removeItem("admin_token");
    localStorage.setItem("admin_remember_me", "0");
  }
}

function initAdminRemember() {
  const rememberEl = document.getElementById("adminRemember");
  if (rememberEl) {
    rememberEl.checked = localStorage.getItem("admin_remember_me") !== "0";
  }
}

const ADMIN_TABS = {
  dashboard: {
    ru: ["Админ дашборд", "Обзор системы и быстрый контроль"],
    en: ["Admin Dashboard", "System overview and quick control"],
  },
  users: {
    ru: ["Пользователи", "Роли, пароли, профиль и редактирование данных"],
    en: ["Users", "Roles, passwords, profile and data editing"],
  },
  modules: {
    ru: ["Модули", "Включение и отключение доступов"],
    en: ["Modules", "Enable and disable user access"],
  },
  ai: {
    ru: ["AI", "Глобальные и пользовательские AI сервисы"],
    en: ["AI", "Global and user AI services"],
  },
  appearance: {
    ru: ["Оформление", "Темы интерфейса и политика выбора темы"],
    en: ["Appearance", "UI themes and theme access policy"],
  },
  server: {
    ru: ["Сервер", "Нагрузка и ресурсы VPS в реальном времени"],
    en: ["Server", "VPS load and resources in real time"],
  },
  credentials: {
    ru: ["API ключи", "Ключи WB/Ozon по пользователям"],
    en: ["API Keys", "WB/Ozon keys by users"],
  },
  audit: {
    ru: ["Аудит", "Журнал административных действий"],
    en: ["Audit", "Administrative action journal"],
  },
};

const DEFAULT_MODULE_CODES = [
  "seo_generation",
  "rank_tracking",
  "competitor_insights",
  "auto_apply",
  "sales_stats",
  "accounting",
  "user_profile",
  "wb_reviews_ai",
  "wb_questions_ai",
  "returns",
  "wb_ads",
  "wb_ads_analytics",
  "wb_ads_recommendations",
  "help_center",
  "ai_assistant",
  "social_hub",
  "billing",
];

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

const MODULE_TITLES = {
  seo_generation: { ru: "SEO генерация", en: "SEO generation" },
  rank_tracking: { ru: "Трекинг позиций", en: "Rank tracking" },
  competitor_insights: { ru: "Анализ конкурентов", en: "Competitor insights" },
  auto_apply: { ru: "Автоприменение SEO", en: "SEO auto apply" },
  sales_stats: { ru: "Статистика продаж", en: "Sales statistics" },
  accounting: { ru: "Бухгалтерия", en: "Accounting" },
  user_profile: { ru: "Профиль пользователя", en: "User profile" },
  wb_reviews_ai: { ru: "Отзывы и AI-ответы (WB/Ozon)", en: "Reviews and AI replies (WB/Ozon)" },
  wb_questions_ai: { ru: "Вопросы и AI-ответы (WB/Ozon)", en: "Questions and AI replies (WB/Ozon)" },
  returns: { ru: "Возвраты WB/Ozon", en: "WB/Ozon returns" },
  wb_ads: { ru: "Реклама WB", en: "WB Ads" },
  wb_ads_analytics: { ru: "Аналитика рекламы WB", en: "WB Ads analytics" },
  wb_ads_recommendations: { ru: "Рекомендации WB Ads", en: "WB Ads recommendations" },
  help_center: { ru: "Справка по модулям", en: "Help center" },
  ai_assistant: { ru: "AI помощник", en: "AI assistant" },
  social_hub: { ru: "Общее", en: "Common" },
  billing: { ru: "Биллинг", en: "Billing" },
};

const THEME_LABELS = {
  classic: { ru: "Классика", en: "Classic" },
  dark: { ru: "Темная", en: "Dark" },
  light: { ru: "Светлая", en: "Light" },
  moon: { ru: "Луна", en: "Moon" },
  newyear: { ru: "Новогодняя", en: "New Year" },
  summer: { ru: "Лето", en: "Summer" },
  autumn: { ru: "Осень", en: "Autumn" },
  winter: { ru: "Зима", en: "Winter" },
  spring: { ru: "Весна", en: "Spring" },
  japan: { ru: "Япония", en: "Japan" },
  greenland: { ru: "Гренландия", en: "Greenland" },
};

const AUDIT_MODULE_TITLES = {
  auth: { ru: "Авторизация", en: "Authentication" },
  products: { ru: "Товары", en: "Products" },
  seo_generation: { ru: "SEO задачи", en: "SEO jobs" },
  rank_tracking: { ru: "Позиции", en: "Rank tracking" },
  sales_stats: { ru: "Статистика продаж", en: "Sales statistics" },
  accounting: { ru: "Бухгалтерия", en: "Accounting" },
  wb_reviews_ai: { ru: "Отзывы", en: "Reviews" },
  wb_questions_ai: { ru: "Вопросы", en: "Questions" },
  returns: { ru: "Возвраты", en: "Returns" },
  wb_ads: { ru: "Реклама WB", en: "WB ads" },
  wb_ads_analytics: { ru: "Аналитика Ads", en: "Ads analytics" },
  wb_ads_recommendations: { ru: "Рекомендации Ads", en: "Ads recommendations" },
  user_profile: { ru: "Профиль", en: "Profile" },
  help_center: { ru: "Справка", en: "Help center" },
  ai_assistant: { ru: "AI помощник", en: "AI assistant" },
  social_hub: { ru: "Общее", en: "Common" },
  admin: { ru: "Админка", en: "Admin panel" },
};

const AUDIT_ACTION_TITLES = {
  auth_login_success: { ru: "Успешный вход", en: "Login success" },
  auth_login_failed: { ru: "Ошибка входа", en: "Login failed" },
  auth_logout: { ru: "Выход из системы", en: "Logout" },
  auth_session_check: { ru: "Проверка сессии", en: "Session check" },
  user_registered: { ru: "Регистрация пользователя", en: "User registration" },
  ui_modules_loaded: { ru: "Загрузка доступных модулей", en: "Available modules loaded" },
  ui_module_opened: { ru: "Открыт модуль интерфейса", en: "UI module opened" },
  ui_subtab_opened: { ru: "Открыт подмодуль интерфейса", en: "UI submodule opened" },
  products_import_completed: { ru: "Импорт товаров завершен", en: "Products import completed" },
  products_reload_completed: { ru: "Перезагрузка товаров завершена", en: "Products reload completed" },
  credential_saved: { ru: "Сохранен API ключ", en: "API key saved" },
  credential_tested: { ru: "Проверка API ключа", en: "API key tested" },
  credential_deleted: { ru: "Удален API ключ", en: "API key deleted" },
  keyword_added: { ru: "Добавлено ключевое слово", en: "Keyword added" },
  keyword_deleted: { ru: "Удалено ключевое слово", en: "Keyword deleted" },
  wb_questions_ai_settings_saved: { ru: "Сохранены AI-настройки вопросов", en: "Question AI settings saved" },
  wb_ai_settings_saved: { ru: "Сохранены AI-настройки отзывов", en: "Review AI settings saved" },
  products_imported: { ru: "Импорт товаров", en: "Products import" },
  products_reloaded: { ru: "Полная перезагрузка товаров", en: "Products full reload" },
  product_details_read: { ru: "Просмотр деталей товара", en: "Product details read" },
  product_updated: { ru: "Обновление карточки товара", en: "Product card updated" },
  sales_stats_read: { ru: "Чтение статистики продаж", en: "Sales statistics read" },
  accounting_read: { ru: "Чтение данных бухгалтерии", en: "Accounting data read" },
  accounting_settings_updated: { ru: "Обновлены настройки бухгалтерии", en: "Accounting settings updated" },
  accounting_expense_created: { ru: "Добавлен расход", en: "Expense created" },
  accounting_expense_updated: { ru: "Изменен расход", en: "Expense updated" },
  accounting_expense_deleted: { ru: "Удален расход", en: "Expense deleted" },
  accounting_purchase_price_imported: { ru: "Импорт закупочных цен", en: "Purchase price import" },
  wb_ads_campaigns_read: { ru: "Чтение кампаний WB Ads", en: "Read WB Ads campaigns" },
  wb_ads_campaigns_sync: { ru: "Синхронизация кампаний WB Ads", en: "Sync WB Ads campaigns" },
  ozon_ads_campaigns_read: { ru: "Чтение кампаний Ozon Ads", en: "Read Ozon Ads campaigns" },
  ozon_ads_analytics_read: { ru: "Чтение аналитики Ozon Ads", en: "Read Ozon Ads analytics" },
  wb_ads_campaigns_enrich: { ru: "Обогащение кампаний WB Ads", en: "Enrich WB Ads campaigns" },
  wb_ads_rates_read: { ru: "Чтение ставок WB Ads", en: "Read WB Ads rates" },
  wb_ads_campaign_details_read: { ru: "Чтение деталей кампании WB Ads", en: "Read WB Ads campaign details" },
  wb_ads_balance_read: { ru: "Чтение баланса WB Ads", en: "Read WB Ads balance" },
  wb_ads_action: { ru: "Действие по кампании WB Ads", en: "WB Ads campaign action" },
  wb_ads_analytics_read: { ru: "Чтение аналитики WB Ads", en: "Read WB Ads analytics" },
  wb_ads_recommendations_read: { ru: "Чтение рекомендаций WB Ads", en: "Read WB Ads recommendations" },
  wb_review_reply_generated: { ru: "Генерация ответа на отзыв", en: "Generate review reply" },
  wb_review_reply: { ru: "Публикация ответа на отзыв", en: "Publish review reply" },
  ozon_review_reply_generated: { ru: "Генерация ответа на отзыв (Ozon)", en: "Generate review reply (Ozon)" },
  ozon_review_reply: { ru: "Публикация ответа на отзыв (Ozon)", en: "Publish review reply (Ozon)" },
  wb_question_reply_generated: { ru: "Генерация ответа на вопрос", en: "Generate question reply" },
  wb_question_reply: { ru: "Публикация ответа на вопрос", en: "Publish question reply" },
  ozon_question_reply_generated: { ru: "Генерация ответа на вопрос (Ozon)", en: "Generate question reply (Ozon)" },
  ozon_question_reply: { ru: "Публикация ответа на вопрос (Ozon)", en: "Publish question reply (Ozon)" },
  wb_returns_read: { ru: "Чтение списка возвратов WB", en: "WB returns list read" },
  ozon_returns_read: { ru: "Чтение списка возвратов Ozon", en: "Ozon returns list read" },
  wb_return_detail_read: { ru: "Просмотр деталей возврата WB", en: "WB return detail read" },
  wb_return_action: { ru: "Действие по возврату", en: "Return action" },
  profile_updated: { ru: "Обновление профиля", en: "Profile updated" },
  profile_ai_selected: { ru: "Выбор AI режима профиля", en: "Profile AI selection updated" },
  profile_ai_service_added: { ru: "Добавлен AI сервис профиля", en: "Profile AI service added" },
  profile_ai_service_updated: { ru: "Обновлен AI сервис профиля", en: "Profile AI service updated" },
  profile_ai_service_deleted: { ru: "Удален AI сервис профиля", en: "Profile AI service deleted" },
  profile_team_member_added: { ru: "Добавлен сотрудник", en: "Employee added" },
  profile_team_member_updated: { ru: "Изменен сотрудник", en: "Employee updated" },
  profile_team_member_deleted: { ru: "Удален сотрудник", en: "Employee deleted" },
  profile_password_changed: { ru: "Изменен пароль", en: "Password changed" },
  profile_plan_changed: { ru: "Изменен тариф в профиле", en: "Profile plan changed" },
  profile_plan_renewed: { ru: "Продлен тариф в профиле", en: "Profile plan renewed" },
  billing_plan_changed: { ru: "Изменен тариф в биллинге", en: "Billing plan changed" },
  billing_renewed: { ru: "Продлен тариф в биллинге", en: "Billing plan renewed" },
  admin_team_member_added: { ru: "Админ добавил сотрудника", en: "Admin added employee" },
  admin_team_member_updated: { ru: "Админ изменил сотрудника", en: "Admin updated employee" },
  admin_team_member_deleted: { ru: "Админ удалил сотрудника", en: "Admin deleted employee" },
  admin_user_profile_updated: { ru: "Админ обновил профиль пользователя", en: "Admin updated user profile" },
  admin_user_plan_changed: { ru: "Админ обновил тариф пользователя", en: "Admin updated user plan" },
  admin_password_reset: { ru: "Админ сменил пароль пользователя", en: "Admin reset user password" },
  admin_role_updated: { ru: "Админ изменил роль пользователя", en: "Admin changed user role" },
  admin_user_deleted: { ru: "Админ удалил пользователя", en: "Admin deleted user" },
  admin_module_updated: { ru: "Админ изменил доступ к модулю", en: "Admin changed module access" },
  admin_mobile_module_updated: { ru: "Админ изменил доступ к APK модулю", en: "Admin changed APK module access" },
  admin_credential_saved: { ru: "Админ сохранил API ключ", en: "Admin saved API key" },
  admin_ai_global_default_saved: { ru: "Админ обновил AI default", en: "Admin updated AI default" },
  admin_ai_global_service_added: { ru: "Админ добавил глобальный AI сервис", en: "Admin added global AI service" },
  admin_ai_global_service_updated: { ru: "Админ обновил глобальный AI сервис", en: "Admin updated global AI service" },
  admin_ai_global_service_deleted: { ru: "Админ удалил глобальный AI сервис", en: "Admin deleted global AI service" },
  admin_ai_global_service_reordered: { ru: "Админ изменил порядок глобальных AI сервисов", en: "Admin reordered global AI services" },
  admin_user_ai_selected: { ru: "Админ изменил AI режим пользователя", en: "Admin changed user AI mode" },
  admin_user_ai_service_added: { ru: "Админ добавил AI сервис пользователю", en: "Admin added user AI service" },
  admin_user_ai_service_updated: { ru: "Админ обновил AI сервис пользователя", en: "Admin updated user AI service" },
  admin_user_ai_service_deleted: { ru: "Админ удалил AI сервис пользователя", en: "Admin deleted user AI service" },
  admin_user_ai_service_reordered: { ru: "Админ изменил порядок AI сервисов пользователя", en: "Admin reordered user AI services" },
  profile_ai_service_reordered: { ru: "Изменен порядок AI сервисов профиля", en: "Profile AI services reordered" },
  help_assistant_asked: { ru: "Запрос к AI помощнику", en: "AI assistant request" },
  social_note_created: { ru: "Создана заметка", en: "Note created" },
  social_note_updated: { ru: "Обновлена заметка", en: "Note updated" },
  social_note_deleted: { ru: "Удалена заметка", en: "Note deleted" },
  social_calendar_event_created: { ru: "Создано событие календаря", en: "Calendar event created" },
  social_calendar_event_updated: { ru: "Обновлено событие календаря", en: "Calendar event updated" },
  social_calendar_event_deleted: { ru: "Удалено событие календаря", en: "Calendar event deleted" },
  social_chat_message_sent: { ru: "Сообщение в чате", en: "Chat message sent" },
  admin_ui_settings_updated: { ru: "Изменены настройки оформления", en: "UI settings updated" },
};

const adminHeaders = () => ({
  "Content-Type": "application/json",
  "Authorization": `Bearer ${adminToken}`,
});

function aTr(ru, en) {
  return adminLang === "en" ? en : ru;
}

function humanAuditModule(codeRaw) {
  const code = String(codeRaw || "").trim().toLowerCase();
  if (!code) return "-";
  const base = AUDIT_MODULE_TITLES[code] || MODULE_TITLES[code];
  if (base && typeof base === "object") return base[adminLang] || base.ru || code;
  return code.replaceAll("_", " ");
}

function humanAuditAction(actionRaw) {
  const action = String(actionRaw || "").trim().toLowerCase();
  if (!action) return "-";
  const mapped = AUDIT_ACTION_TITLES[action];
  if (mapped && typeof mapped === "object") return mapped[adminLang] || mapped.ru || action;
  if (action.endsWith("_read")) return aTr(`Чтение: ${action.replaceAll("_", " ")}`, `Read: ${action.replaceAll("_", " ")}`);
  if (action.endsWith("_updated")) return aTr(`Обновление: ${action.replaceAll("_", " ")}`, `Update: ${action.replaceAll("_", " ")}`);
  if (action.endsWith("_saved")) return aTr(`Сохранение: ${action.replaceAll("_", " ")}`, `Save: ${action.replaceAll("_", " ")}`);
  if (action.endsWith("_deleted")) return aTr(`Удаление: ${action.replaceAll("_", " ")}`, `Delete: ${action.replaceAll("_", " ")}`);
  if (action.endsWith("_added")) return aTr(`Добавление: ${action.replaceAll("_", " ")}`, `Add: ${action.replaceAll("_", " ")}`);
  if (action.endsWith("_changed")) return aTr(`Изменение: ${action.replaceAll("_", " ")}`, `Change: ${action.replaceAll("_", " ")}`);
  return action.replaceAll("_", " ");
}

function humanAuditDetailKey(keyRaw) {
  const key = String(keyRaw || "").trim().toLowerCase();
  const labels = {
    user_id: aTr("Пользователь", "User"),
    member_id: aTr("Сотрудник", "Employee"),
    feedback_id: aTr("ID записи", "Record ID"),
    question_id: aTr("ID вопроса", "Question ID"),
    review_id: aTr("ID отзыва", "Review ID"),
    product_id: aTr("ID товара", "Product ID"),
    event_id: aTr("ID события", "Event ID"),
    thread_id: aTr("ID чата", "Thread ID"),
    message_id: aTr("ID сообщения", "Message ID"),
    service_id: aTr("ID сервиса", "Service ID"),
    service_ids: aTr("Сервисы", "Services"),
    action: aTr("Операция", "Operation"),
    role: aTr("Роль", "Role"),
    source: aTr("Источник", "Source"),
    provider: aTr("Провайдер", "Provider"),
    model: aTr("Модель", "Model"),
    mode: aTr("Режим", "Mode"),
    module: aTr("Модуль", "Module"),
    marketplace: aTr("Маркетплейс", "Marketplace"),
    reply: aTr("Ответ", "Reply"),
    answer: aTr("Ответ", "Answer"),
    question: aTr("Вопрос", "Question"),
    preview: aTr("Превью", "Preview"),
    title: aTr("Название", "Title"),
    start_at: aTr("Начало", "Start"),
    is_public: aTr("Общее", "Public"),
    recipients: aTr("Получатели", "Recipients"),
    sku: "SKU",
    state: aTr("Статус", "State"),
    knowledge: aTr("База знаний", "Knowledge"),
    count: aTr("Количество", "Count"),
    rows: aTr("Строк", "Rows"),
    loaded: aTr("Загружено", "Loaded"),
    total: aTr("Всего", "Total"),
    tab: aTr("Вкладка", "Tab"),
    subtab: aTr("Подвкладка", "Subtab"),
    enabled: aTr("Доступно", "Enabled"),
    import_all: aTr("Импорт всех", "Import all"),
    status: aTr("Статус", "Status"),
    ok: aTr("Успех", "Success"),
    date_from: aTr("Период с", "Date from"),
    date_to: aTr("Период по", "Date to"),
    ip: "IP",
    ua: "UA",
  };
  return labels[key] || keyRaw || "-";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function renderAdminAvatarPreview(hostId, url, fallbackText = "--") {
  const host = document.getElementById(hostId);
  if (!host) return;
  const safe = String(url || "").trim();
  if (!safe) {
    host.textContent = fallbackText;
    return;
  }
  host.innerHTML = `<img src="${escapeHtml(safe)}" alt="avatar" class="avatar-img" />`;
}

function renderAdminAvatarPicker(hostId, currentUrl, onPick) {
  const host = document.getElementById(hostId);
  if (!host) return;
  const selected = String(currentUrl || "").trim();
  host.innerHTML = ADMIN_DEFAULT_AVATARS
    .map((url) => {
      const active = selected && url === selected ? "active" : "";
      return `<button type="button" class="avatar-chip ${active}" data-avatar-url="${escapeHtml(url)}"><img src="${escapeHtml(url)}" alt="avatar" /></button>`;
    })
    .join("");
  host.querySelectorAll("[data-avatar-url]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const url = String(btn.dataset.avatarUrl || "").trim();
      if (typeof onPick === "function") onPick(url);
      host.querySelectorAll(".avatar-chip").forEach((chip) => {
        chip.classList.toggle("active", chip === btn);
      });
    });
  });
}

function formatDateTime(raw) {
  if (!raw) return "-";
  const text = String(raw).trim();
  if (!text) return "-";

  let dt = null;
  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) {
    // Backend stores naive UTC timestamps; interpret them as UTC to avoid -3h shift in UI.
    const hasTz = /[zZ]$|[+-]\d{2}:\d{2}$/.test(text);
    dt = new Date(hasTz ? text : `${text}Z`);
  } else if (/^\d{4}-\d{2}-\d{2}\s/.test(text)) {
    dt = new Date(`${text.replace(" ", "T")}Z`);
  } else {
    dt = new Date(text);
  }
  if (!dt || Number.isNaN(dt.getTime())) {
    return text.slice(0, 19).replace("T", " ");
  }

  const pad = (n) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} `
    + `${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`;
}

function parseAdminTeamScope(raw) {
  return String(raw || "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
}

function normalizeAdminTeamScope(values) {
  const source = Array.isArray(values) ? values : parseAdminTeamScope(values);
  const allowed = new Set(TEAM_ACCESS_MODULES);
  const seen = new Set();
  const out = [];
  for (const item of source) {
    const code = String(item || "").trim().toLowerCase();
    if (!code || !allowed.has(code) || seen.has(code)) continue;
    seen.add(code);
    out.push(code);
  }
  return out;
}

function renderAdminTeamScopePicks(selected = [], memberId = 0, disabled = false, key = "row") {
  const selectedSet = new Set(normalizeAdminTeamScope(selected));
  return `<div class="team-access-picks">${TEAM_ACCESS_MODULES.map((code) => `
    <label class="check">
      <input type="checkbox" data-team-scope-pick="${key}:${memberId}" data-code="${escapeHtml(code)}" ${selectedSet.has(code) ? "checked" : ""} ${disabled ? "disabled" : ""} />
      ${escapeHtml(MODULE_TITLES[code]?.[adminLang] || code)}
    </label>
  `).join("")}</div>`;
}

function collectAdminTeamScope(root, memberId, key = "row") {
  const selector = `[data-team-scope-pick="${key}:${memberId}"]`;
  const values = [...(root?.querySelectorAll(selector) || [])]
    .filter((el) => el.checked)
    .map((el) => String(el.dataset.code || "").trim().toLowerCase());
  return normalizeAdminTeamScope(values);
}

function summarizeAdminTeamAccess(scope = [], isOwner = false) {
  if (isOwner) return aTr("Полный доступ", "Full access");
  const values = normalizeAdminTeamScope(scope);
  if (!values.length) return aTr("Доступы не выданы", "No access granted");
  const head = values.slice(0, 3).map((code) => MODULE_TITLES[code]?.[adminLang] || code);
  const tail = values.length - head.length;
  return tail > 0 ? `${head.join(", ")} ${aTr(`и еще ${tail}`, `and ${tail} more`)}` : head.join(", ");
}

async function adminRequest(url, opts = {}) {
  const r = await fetch(url, opts);
  const refreshed = r.headers.get("x-auth-refresh");
  if (refreshed) {
    setAdminToken(refreshed, adminTokenStorage === "local");
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.detail || data.message || aTr("Ошибка запроса", "Request failed"));
  return data;
}

function stopAdminServerAutoRefresh() {
  if (!adminServerAutoTimer) return;
  clearInterval(adminServerAutoTimer);
  adminServerAutoTimer = null;
}

function startAdminServerAutoRefresh() {
  stopAdminServerAutoRefresh();
  adminServerAutoTimer = setInterval(() => {
    if (document.getElementById("adminTab-server")?.classList.contains("hidden")) return;
    loadAdminServerMetrics({ silent: true }).catch(() => null);
  }, 60 * 1000);
}

function normalizeAdminNotificationSettings(payload) {
  const raw = payload && typeof payload === "object" ? payload : {};
  return {
    desktop_enabled: raw.desktop_enabled !== false,
    chat_enabled: raw.chat_enabled !== false,
    task_enabled: raw.task_enabled !== false,
    calendar_enabled: raw.calendar_enabled !== false,
    default_sound_url: String(raw.default_sound_url || "").trim(),
    chat_sound_url: String(raw.chat_sound_url || "").trim(),
    task_sound_url: String(raw.task_sound_url || "").trim(),
    calendar_sound_url: String(raw.calendar_sound_url || "").trim(),
  };
}

function setAdminVisible(loggedIn) {
  document.getElementById("adminAuthSection")?.classList.toggle("hidden", loggedIn);
  document.getElementById("adminPanelSection")?.classList.toggle("hidden", !loggedIn);
}

function applyAdminTheme(nextTheme) {
  const code = String(nextTheme || "classic").toLowerCase();
  adminTheme = UI_THEMES.includes(code) ? code : "classic";
  localStorage.setItem("admin_ui_theme", adminTheme);
  document.body.setAttribute("data-theme", adminTheme);
  const sel = document.getElementById("adminUiThemeSelect");
  if (sel && sel.value !== adminTheme) sel.value = adminTheme;
}

function adminChangeTheme() {
  const value = document.getElementById("adminUiThemeSelect")?.value || "classic";
  applyAdminTheme(value);
}

function applyAdminLanguage() {
  adminLang = adminLang === "en" ? "en" : "ru";
  localStorage.setItem("admin_ui_lang", adminLang);
  document.documentElement.setAttribute("lang", adminLang);

  const langSel = document.getElementById("adminUiLangSelect");
  if (langSel) langSel.value = adminLang;

  const themeSel = document.getElementById("adminUiThemeSelect");
  if (themeSel) {
    themeSel.innerHTML = UI_THEMES
      .map((code) => `<option value="${code}">${escapeHtml(THEME_LABELS[code]?.[adminLang] || code)}</option>`)
      .join("");
    themeSel.value = adminTheme;
  }

  const navMap = [
    ["dashboard", aTr("Дашборд", "Dashboard")],
    ["users", aTr("Пользователи", "Users")],
    ["modules", aTr("Модули", "Modules")],
    ["ai", aTr("AI", "AI")],
    ["appearance", aTr("Оформление", "Appearance")],
    ["server", aTr("Сервер", "Server")],
    ["credentials", aTr("API ключи", "API Keys")],
    ["audit", aTr("Аудит", "Audit")],
  ];
  for (const [code, label] of navMap) {
    const btn = document.querySelector(`.admin-nav[data-admin-tab="${code}"]`);
    if (btn) btn.textContent = label;
  }

  const staticTexts = [
    ["#adminAuthSection .auth-box h3", aTr("Вход администратора", "Admin login")],
    ["#adminAuthSection .auth-box button", aTr("Войти в админку", "Sign in")],
    ["#adminAuthSection .admin-link", aTr("Открыть пользовательский сервис", "Open user app")],
    ["#adminPanelSection .btn-danger.full", aTr("Выйти", "Logout")],
    ["#adminTab-dashboard .trend-panel .panel-head h3", aTr("Новые пользователи за 7 дней", "New users in 7 days")],
    ["#adminTab-dashboard .trend-panel .panel-head .hint", aTr("По данным текущей базы", "From current database")],
    ["#adminTab-dashboard .cols-2 .panel:nth-of-type(1) h3", aTr("Распределение ролей", "Role distribution")],
    ["#adminTab-dashboard .cols-2 .panel:nth-of-type(2) h3", aTr("Модули доступа", "Enabled modules")],
    ["#adminTab-dashboard .panel:last-of-type h3", aTr("RAW статистика", "Raw stats")],
    ["#adminTab-users .panel h3", aTr("Пользователи", "Users")],
    ["#adminTab-users .grid-3 button", aTr("Обновить таблицу", "Refresh table")],
    ["#adminUsersSearch", aTr("Поиск email / id / компания / город", "Search by email / id / company / city")],
    ["#adminTab-modules .panel h3", aTr("Модули доступа", "Module access")],
    ["#adminTab-modules .grid-3 .hint", aTr("Выберите пользователя и переключайте статусы модулей отдельно для Web и APK.", "Select user and toggle module access separately for Web and APK.")],
    ["#adminTab-modules .grid-3 button", aTr("Обновить таблицу", "Refresh table")],
    ["#adminTab-modules thead th:nth-child(1)", aTr("Код", "Code")],
    ["#adminTab-modules thead th:nth-child(2)", aTr("Название", "Name")],
    ["#adminTab-modules thead th:nth-child(3)", "Web"],
    ["#adminTab-modules thead th:nth-child(4)", aTr("Web действие", "Web action")],
    ["#adminTab-modules thead th:nth-child(5)", "APK"],
    ["#adminTab-modules thead th:nth-child(6)", aTr("APK действие", "APK action")],
    ["#adminTab-ai .panel:nth-of-type(1) h3", aTr("Глобальные AI сервисы", "Global AI services")],
    ["#adminTab-ai .panel:nth-of-type(1) .grid-4 button:nth-of-type(1)", aTr("Сохранить global default", "Save global default")],
    ["#adminTab-ai .panel:nth-of-type(1) .grid-4 button:nth-of-type(2)", aTr("Обновить", "Refresh")],
    ["#adminTab-ai .panel:nth-of-type(1) .actions button", aTr("Добавить глобальный AI", "Add global AI")],
    ["#adminAiGlobalSaveBtn", aTr("Сохранить", "Save")],
    ["#adminTab-ai .panel:nth-of-type(2) h3", aTr("AI сервисы пользователей", "User AI services")],
    ["#adminTab-ai .panel:nth-of-type(2) .grid-4 button", aTr("Сохранить выбор пользователя", "Save user selection")],
    ["#adminTab-ai .panel:nth-of-type(2) .actions button", aTr("Добавить AI пользователю", "Add AI for user")],
    ["#adminAiUserSaveBtn", aTr("Сохранить", "Save")],
    ["#adminAiGlobalPrimary", aTr("Приоритет задается порядком в списке ниже", "Priority is defined by the list order below")],
    ["#adminAiUserPrimary", aTr("Приоритет задается порядком в списке", "Priority is defined by the list order")],
    ["#adminTab-appearance .panel h3", aTr("Оформление интерфейса", "UI appearance")],
    ["#adminTab-appearance .grid-3 button:nth-of-type(1)", aTr("Настроить оформление", "Configure appearance")],
    ["#adminTab-appearance .grid-3 button:nth-of-type(2)", aTr("Обновить", "Refresh")],
    ["#adminAppearanceSummary", aTr("Параметры оформления загружены.", "Appearance settings loaded.")],
    ["#adminThemeChoiceEnabled", aTr("Разрешить выбор темы пользователям", "Allow users to choose theme")],
    ["#adminForceThemeEnabled", aTr("Принудительно применять тему всем", "Force this theme for all users")],
    ["#adminTab-server .panel h3", aTr("Мониторинг сервера", "Server monitoring")],
    ["#adminTab-server .grid-3 button", aTr("Обновить метрики", "Refresh metrics")],
    ["#adminAppearanceModalTitle", aTr("Оформление интерфейса", "UI appearance")],
    ["#adminAppearanceModal .actions button", aTr("Сохранить оформление", "Save appearance")],
    ["#adminAppearanceModal .hint", aTr("Разрешенные темы для выбора:", "Allowed themes:")],
    ["#adminTab-credentials .panel h3", aTr("API ключи пользователей", "User API keys")],
    ["#adminTab-credentials .grid-2 button", aTr("Обновить таблицу", "Refresh table")],
    ["#adminTab-audit .panel h3", aTr("Журнал действий", "Activity log")],
    ["#adminAuditRefreshBtn", aTr("Обновить журнал", "Refresh log")],
    ["#adminAuditTextFilter", aTr("Поиск по деталям / entity / actor / ip / ua", "Search in details / entity / actor / ip / ua")],
    ["#adminAuditPageInfo", aTr("Страница 1 из 1", "Page 1 of 1")],
    ["#adminAuditPrevBtn", aTr("Назад", "Prev")],
    ["#adminAuditNextBtn", aTr("Далее", "Next")],
    ["#adminTeamModalSaveBtn", aTr("Сохранить", "Save")],
    ["#adminTeamModalDeleteBtn", aTr("Удалить", "Delete")],
    ["#adminTeamModalEmail", aTr("Email сотрудника", "Employee email")],
    ["#adminTeamModalPassword", aTr("Новый пароль (опц.)", "New password (optional)")],
    ["#adminTeamModalFullName", aTr("ФИО", "Full name")],
    ["#adminTeamModalPhone", aTr("Телефон", "Phone")],
    ["#adminTeamModalNickname", aTr("Ник", "Nickname")],
    ["#adminTeamModalAvatar", aTr("Ссылка на аватар", "Avatar URL")],
    ["#adminAiGlobalName", aTr("Название сервиса", "Service name")],
    ["#adminAiGlobalModel", aTr("Модель", "Model")],
    ["#adminAiGlobalBaseUrl", aTr("Base URL (опц.)", "Base URL (opt.)")],
    ["#adminAiGlobalApiKey", "API key"],
    ["#adminAiUserName", aTr("Название сервиса пользователя", "User service name")],
    ["#adminAiUserModel", aTr("Модель", "Model")],
    ["#adminAiUserBaseUrl", aTr("Base URL (опц.)", "Base URL (opt.)")],
    ["#adminAiUserApiKey", "API key"],
  ];

  for (const [selector, value] of staticTexts) {
    const el = document.querySelector(selector);
    if (!el) continue;
    if (el.tagName.toLowerCase() === "input") {
      const input = el;
      if (String(input.type || "").toLowerCase() === "checkbox") {
        const label = input.closest("label");
        if (label) {
          label.textContent = "";
          label.appendChild(input);
          label.append(document.createTextNode(` ${value}`));
        }
      } else {
        input.setAttribute("placeholder", value);
      }
    } else if (el.tagName.toLowerCase() === "label") {
      const input = el.querySelector("input");
      el.textContent = "";
      if (input) el.appendChild(input);
      el.append(document.createTextNode(` ${value}`));
    } else {
      el.textContent = value;
    }
  }

  const appearanceSummaryRows = document.querySelectorAll("#adminAppearanceSummaryTable tr");
  const appearanceLabels = [
    aTr("Выбор темы", "Theme choice"),
    aTr("Принудительная тема", "Forced theme"),
    aTr("Тема по умолчанию", "Default theme"),
    aTr("Разрешено тем", "Allowed themes"),
  ];
  appearanceSummaryRows.forEach((row, idx) => {
    const first = row.querySelector("td:first-child");
    if (first && appearanceLabels[idx]) first.textContent = appearanceLabels[idx];
  });

  document.querySelectorAll("#adminTab-users thead th").forEach((th, idx) => {
    const labels = [
      aTr("ID", "ID"),
      aTr("EMAIL", "EMAIL"),
      aTr("РОЛЬ", "ROLE"),
      aTr("СОЗДАН", "CREATED"),
      aTr("ДЕЙСТВИЯ", "ACTIONS"),
    ];
    th.textContent = labels[idx] || th.textContent;
  });

  document.querySelectorAll("#adminTab-audit thead th").forEach((th, idx) => {
    const labels = [
      aTr("ID", "ID"),
      aTr("ВРЕМЯ", "TIME"),
      aTr("АКТЕР", "ACTOR"),
      aTr("МОДУЛЬ", "MODULE"),
      aTr("ДЕЙСТВИЕ", "ACTION"),
      aTr("СТАТУС", "STATUS"),
      aTr("СУЩНОСТЬ", "ENTITY"),
      aTr("ДЕТАЛИ", "DETAILS"),
    ];
    th.textContent = labels[idx] || th.textContent;
  });

  const aiGlobalMode = document.getElementById("adminAiGlobalMode");
  if (aiGlobalMode) {
    aiGlobalMode.innerHTML = [
      `<option value="builtin">${escapeHtml(aTr("Встроенный OpenAI", "Built-in OpenAI"))}</option>`,
      `<option value="global">${escapeHtml(aTr("Глобальный сервис", "Global service"))}</option>`,
    ].join("");
  }
  const aiUserMode = document.getElementById("adminAiUserMode");
  if (aiUserMode) {
    aiUserMode.innerHTML = [
      `<option value="global_default">${escapeHtml(aTr("Глобальный default (админ)", "Global default (admin)"))}</option>`,
      `<option value="builtin">${escapeHtml(aTr("Встроенный OpenAI", "Built-in OpenAI"))}</option>`,
      `<option value="global">${escapeHtml(aTr("Глобальный сервис", "Global service"))}</option>`,
      `<option value="user">${escapeHtml(aTr("Сервис пользователя", "User service"))}</option>`,
    ].join("");
  }

  const activeBtn = document.querySelector(".admin-nav.active");
  if (activeBtn?.dataset?.adminTab) {
    const pack = ADMIN_TABS[activeBtn.dataset.adminTab] || ADMIN_TABS.dashboard;
    const [title, subtitle] = pack[adminLang] || pack.ru;
    const titleEl = document.getElementById("adminSectionTitle");
    const subEl = document.getElementById("adminSectionSubtitle");
    if (titleEl) titleEl.textContent = title;
    if (subEl) subEl.textContent = subtitle;
  }

  renderAdminUsersTable();
  renderAdminModulesTable();
  renderAdminCredentialsTable();
  refreshAdminAuditFilterOptions(adminAuditRows);
  renderAdminAuditTable();
  renderAdminAuditPager();
  renderAdminAppearance();
  renderAdminNotificationSettings();
  renderAdminAiTab();
  renderAdminServerMetrics();
}

function adminChangeLanguage() {
  const next = document.getElementById("adminUiLangSelect")?.value || "ru";
  adminLang = String(next).toLowerCase() === "en" ? "en" : "ru";
  applyAdminLanguage();
}

function showAdminTab(tab, btn = null) {
  document.querySelectorAll(".admin-tab").forEach((el) => el.classList.add("hidden"));
  const target = document.getElementById(`adminTab-${tab}`);
  if (target) target.classList.remove("hidden");

  document.querySelectorAll(".admin-nav").forEach((el) => {
    if (el.dataset.adminTab === tab) el.classList.add("active");
    else el.classList.remove("active");
  });
  if (btn?.dataset?.adminTab) btn.classList.add("active");

  const pack = ADMIN_TABS[tab] || ADMIN_TABS.dashboard;
  const [title, subtitle] = pack[adminLang] || pack.ru;
  const titleEl = document.getElementById("adminSectionTitle");
  const subEl = document.getElementById("adminSectionSubtitle");
  if (titleEl) titleEl.textContent = title;
  if (subEl) subEl.textContent = subtitle;

  if (tab === "audit" && !adminAuditRows.length) {
    loadAdminAudit();
  }
  if (tab === "ai") {
    renderAdminAiTab();
    if (!adminSelectedUserAiState) {
      loadAdminUserAi().catch(() => null);
    }
  }
  if (tab === "server" && !adminServerMetrics) {
    loadAdminServerMetrics().catch(() => null);
  }
  if (tab === "server") {
    startAdminServerAutoRefresh();
  } else {
    stopAdminServerAutoRefresh();
  }
  if (tab === "appearance" && !adminNotificationSettings) {
    adminLoadNotificationSettings().catch(() => null);
  } else if (tab === "appearance") {
    renderAdminNotificationSettings();
  }
  adminCloseMobileNav();
}

function adminToggleMobileNav() {
  const shell = document.getElementById("adminPanelSection");
  if (!shell) return;
  shell.classList.toggle("nav-open");
  const btn = document.getElementById("adminMobileNavToggle");
  if (btn) btn.setAttribute("aria-expanded", shell.classList.contains("nav-open") ? "true" : "false");
}

function adminCloseMobileNav(evt = null) {
  const shell = document.getElementById("adminPanelSection");
  if (!shell) return;
  if (evt && evt.target && evt.target.id !== "adminMobileNavOverlay") return;
  shell.classList.remove("nav-open");
  const btn = document.getElementById("adminMobileNavToggle");
  if (btn) btn.setAttribute("aria-expanded", "false");
}

function buildUserOption(user) {
  const role = user.role || "client";
  return `<option value="${user.id}">#${user.id} ${escapeHtml(user.email)} (${escapeHtml(role)})</option>`;
}

function refreshUserSelects() {
  const html = adminUsers.map(buildUserOption).join("");
  ["adminModuleUserSelect", "adminCredUserSelect", "adminAiUserSelect"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const prev = el.value;
    el.innerHTML = html;
    if (prev && [...el.options].some((o) => o.value === prev)) {
      el.value = prev;
    }
  });
  const annSelect = document.getElementById("adminAnnouncementTargetUser");
  if (annSelect) {
    const prev = Array.from(annSelect.selectedOptions || [])
      .map((opt) => Number(opt?.value || 0))
      .filter((value) => Number.isFinite(value));
    annSelect.innerHTML = `<option value="0">${escapeHtml(aTr("Все пользователи", "All users"))}</option>${html}`;
    if (annSelect.multiple) {
      const safePrev = prev.filter((value) => value > 0);
      if (safePrev.length) {
        for (const opt of annSelect.options) {
          const value = Number(opt?.value || 0);
          opt.selected = value > 0 && safePrev.includes(value);
        }
      } else if (annSelect.options.length) {
        annSelect.options[0].selected = true;
      }
    } else if (prev.length) {
      const single = String(Number(prev[0] || 0));
      if ([...annSelect.options].some((o) => o.value === single)) {
        annSelect.value = single;
      }
    }
  }
}

async function adminLogin() {
  const email = document.getElementById("adminEmail")?.value.trim() || "";
  const password = document.getElementById("adminPassword")?.value || "";
  const remember = Boolean(document.getElementById("adminRemember")?.checked);
  const data = await adminRequest("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  }).catch((e) => {
    alert(e.message);
    return null;
  });
  if (!data) return;
  setAdminToken(data.access_token, remember);
  await ensureAdminAuth();
}

async function adminLogout() {
  stopAdminServerAutoRefresh();
  if (adminToken) {
    await adminRequest("/api/auth/logout", {
      method: "POST",
      headers: adminHeaders(),
    }).catch(() => null);
  }
  setAdminToken("");
  adminMe = null;
  adminUsers = [];
  adminModules = [];
  adminMobileModules = [];
  adminCredentials = [];
  adminAuditRows = [];
  adminAuditPage = 1;
  adminAuditPageSize = 100;
  adminAuditTotal = 0;
  adminAuditTotalPages = 0;
  adminAiGlobalState = null;
  adminSelectedUserAiState = null;
  adminNotificationSettings = null;
  adminAnnouncements = [];
  adminAnnouncementEditId = 0;
  adminUserProfileCache.clear();
  localStorage.removeItem("admin_token");
  sessionStorage.removeItem("admin_token");
  setAdminVisible(false);
}

async function ensureAdminAuth() {
  if (!adminToken) {
    stopAdminServerAutoRefresh();
    setAdminVisible(false);
    applyAdminTheme(adminTheme);
    applyAdminLanguage();
    return;
  }
  const me = await adminRequest("/api/auth/me", { headers: adminHeaders() }).catch(() => null);
  if (!me || me.role !== "admin") {
    stopAdminServerAutoRefresh();
    await adminLogout();
    alert(aTr("Доступ только для admin-пользователя", "Admin access only"));
    return;
  }
  adminMe = me;
  setAdminVisible(true);
  applyAdminTheme(adminTheme);
  applyAdminLanguage();
  await loadAdminAll();
  showAdminTab("dashboard", document.querySelector(".admin-nav[data-admin-tab='dashboard']"));
}

async function loadAdminAll() {
  const [stats, users, modules, mobileModules, allCreds, uiSettings, aiGlobal, serverMetrics, notifSettings, announcements] = await Promise.all([
    adminRequest("/api/admin/stats", { headers: adminHeaders() }).catch(() => null),
    adminRequest("/api/admin/users", { headers: adminHeaders() }).catch(() => null),
    adminRequest("/api/admin/modules", { headers: adminHeaders() }).catch(() => null),
    adminRequest("/api/admin/modules/mobile", { headers: adminHeaders() }).catch(() => null),
    adminRequest("/api/admin/credentials/all", { headers: adminHeaders() }).catch(() => []),
    adminRequest("/api/admin/ui/settings", { headers: adminHeaders() }).catch(() => null),
    adminRequest("/api/admin/ai/global", { headers: adminHeaders() }).catch(() => null),
    adminRequest("/api/admin/server/metrics", { headers: adminHeaders() }).catch(() => null),
    adminRequest("/api/admin/notification-settings", { headers: adminHeaders() }).catch(() => null),
    adminRequest("/api/admin/announcements", { headers: adminHeaders() }).catch(() => []),
  ]);

  const statsView = document.getElementById("adminStatsView");
  if (stats && statsView) statsView.textContent = JSON.stringify(stats, null, 2);
  if (Array.isArray(users)) {
    adminUsers = users;
    refreshUserSelects();
    adminUserProfileCache.clear();
  }
  if (Array.isArray(modules)) {
    adminModules = modules;
  }
  if (Array.isArray(mobileModules)) {
    adminMobileModules = mobileModules;
  }
  adminCredentials = Array.isArray(allCreds) ? allCreds : [];
  adminUiSettings = uiSettings && typeof uiSettings === "object" ? uiSettings : null;
  adminAiGlobalState = aiGlobal && typeof aiGlobal === "object" ? aiGlobal : null;
  adminServerMetrics = serverMetrics && typeof serverMetrics === "object" ? serverMetrics : null;
  adminNotificationSettings = normalizeAdminNotificationSettings(notifSettings);
  adminAnnouncements = Array.isArray(announcements) ? announcements : [];
  adminSelectedUserAiState = null;

  renderAdminDashboard(stats, users || [], modules || []);
  renderAdminUsersTable();
  renderAdminModulesTable();
  renderAdminCredentialsTable();
  renderAdminAppearance();
  renderAdminNotificationSettings();
  renderAdminAnnouncements();
  renderAdminAiTab();
  renderAdminServerMetrics();
}

function renderAdminDashboard(stats, users, modules) {
  const kpiHost = document.getElementById("adminKpis");
  if (!kpiHost || !stats) return;
  const items = [
    [aTr("Пользователи", "Users"), stats.total_users || 0],
    [aTr("Новые за 7 дней", "New in 7 days"), stats.new_users_7d || 0],
    [aTr("Сотрудники", "Employees"), stats.employees_total || 0],
    [aTr("Команда всего", "Team members total"), stats.total_team_members || 0],
    [aTr("Активные пользователи 24ч", "Active users 24h"), stats.active_users_24h || 0],
    [aTr("События аудита 24ч", "Audit events 24h"), stats.audit_events_24h || 0],
    [aTr("Товаров", "Products"), stats.total_products || 0],
    [aTr("SEO задач", "SEO jobs"), stats.total_jobs || 0],
    [aTr("Активные", "Active"), stats.active_jobs || 0],
  ];
  const max = Math.max(...items.map((x) => Number(x[1] || 0)), 1);
  kpiHost.innerHTML = items
    .map(([name, val]) => {
      const p = Math.max(4, Math.round((Number(val) / max) * 100));
      return `
        <div class="kpi">
          <div class="kpi-head"><strong>${escapeHtml(String(val))}</strong><span>${escapeHtml(String(name))}</span></div>
          <div class="kpi-track"><i style="width:${p}%"></i></div>
        </div>
      `;
    })
    .join("");

  const roleMap = new Map();
  for (const u of users || []) {
    const role = (u.role || "client").toLowerCase();
    roleMap.set(role, (roleMap.get(role) || 0) + 1);
  }
  renderBarList("adminRoleBars", [...roleMap.entries()].map(([k, v]) => ({ label: k, value: v })));

  const moduleMap = new Map();
  for (const m of modules || []) {
    const code = m.module_code || "unknown";
    if (!m.enabled) continue;
    moduleMap.set(code, (moduleMap.get(code) || 0) + 1);
  }
  renderBarList("adminModuleBars", [...moduleMap.entries()].map(([k, v]) => ({ label: k, value: v })));
  renderAdminUsersTrend(stats);
}

function renderBarList(id, rows) {
  const host = document.getElementById(id);
  if (!host) return;
  if (!rows || !rows.length) {
    host.innerHTML = `<div class="hint">${aTr("Нет данных", "No data")}</div>`;
    return;
  }
  const max = Math.max(...rows.map((x) => Number(x.value || 0)), 1);
  host.innerHTML = rows
    .sort((a, b) => Number(b.value) - Number(a.value))
    .map((row) => {
      const pct = Math.max(4, Math.round((Number(row.value || 0) / max) * 100));
      return `
        <div class="bar-item">
          <div class="meta"><span>${escapeHtml(String(row.label))}</span><b>${escapeHtml(String(row.value))}</b></div>
          <div class="line"><i style="width:${pct}%"></i></div>
        </div>
      `;
    })
    .join("");
}

function renderAdminUsersTrend(stats) {
  const svg = document.getElementById("adminUsersTrendChart");
  const meta = document.getElementById("adminTrendMeta");
  if (!svg || !meta || !stats) return;
  const total = Number(stats.total_users || 0);
  const fresh = Number(stats.new_users_7d || 0);
  const base = Math.max(0, total - fresh);
  const series = [base, base + Math.round(fresh * 0.2), base + Math.round(fresh * 0.4), base + Math.round(fresh * 0.55), base + Math.round(fresh * 0.72), base + Math.round(fresh * 0.9), total];

  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = Math.max(1, max - min);
  const w = 720;
  const h = 180;
  const px = 14;
  const py = 14;
  const step = (w - px * 2) / (series.length - 1);
  const points = series
    .map((v, i) => {
      const x = px + i * step;
      const y = py + (1 - ((v - min) / range)) * (h - py * 2);
      return `${x},${y}`;
    })
    .join(" ");

  const canUseEcharts = Boolean(
    typeof window !== "undefined"
    && window.echarts
    && typeof window.echarts.init === "function"
    && svg instanceof HTMLElement
  );
  if (canUseEcharts) {
    let chart = null;
    try {
      chart = window.echarts.getInstanceByDom(svg);
    } catch (_) {
      chart = null;
    }
    if (!chart) {
      chart = window.echarts.init(svg, null, { renderer: "canvas" });
    }
    chart.setOption(
      {
        animationDuration: 380,
        grid: { top: 14, right: 16, bottom: 22, left: 44 },
        tooltip: {
          trigger: "axis",
          backgroundColor: "rgba(17,31,58,0.92)",
          borderWidth: 0,
          textStyle: { color: "#eff6ff" },
        },
        xAxis: {
          type: "category",
          boundaryGap: false,
          data: ["D-6", "D-5", "D-4", "D-3", "D-2", "D-1", "D0"],
          axisLine: { lineStyle: { color: "rgba(97,122,156,0.35)" } },
          axisTick: { show: false },
          axisLabel: { color: "#6f86a7", fontSize: 11 },
        },
        yAxis: {
          type: "value",
          min,
          max,
          splitLine: { lineStyle: { color: "rgba(95,121,162,0.17)" } },
          axisLabel: { color: "#6f86a7", fontSize: 11 },
        },
        series: [
          {
            name: aTr("Пользователи", "Users"),
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
                  { offset: 1, color: "rgba(47,140,255,0.03)" },
                ],
              },
            },
            data: series,
          },
        ],
      },
      true
    );
    meta.innerHTML = `<span>${aTr("Всего пользователей", "Total users")}: <b>${total}</b></span><span>${aTr("Новые за 7 дней", "New in 7 days")}: <b>${fresh}</b></span>`;
    return;
  }

  const fallbackMarkup = `
    <defs>
      <linearGradient id="adminTrendLine" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#21e7ff"/>
        <stop offset="100%" stop-color="#7f8dff"/>
      </linearGradient>
    </defs>
    <polyline points="${points}" fill="none" stroke="url(#adminTrendLine)" stroke-width="3" stroke-linecap="round"></polyline>
  `;
  if (String(svg.tagName || "").toLowerCase() === "svg") {
    svg.innerHTML = fallbackMarkup;
  } else {
    svg.innerHTML = `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${fallbackMarkup}</svg>`;
  }
  meta.innerHTML = `<span>${aTr("Всего пользователей", "Total users")}: <b>${total}</b></span><span>${aTr("Новые за 7 дней", "New in 7 days")}: <b>${fresh}</b></span>`;
}

function renderAdminUsersTable() {
  const tbody = document.getElementById("adminUsersTable");
  if (!tbody) return;
  tbody.innerHTML = "";

  const search = String(document.getElementById("adminUsersSearch")?.value || "").trim().toLowerCase();
  const rows = search
    ? adminUsers.filter((u) => {
      const haystack = `${u.id} ${u.email} ${u.role} ${u.company_name || ""} ${u.city || ""}`;
      return haystack.toLowerCase().includes(search);
    })
    : adminUsers;

  const meta = document.getElementById("adminUsersMeta");
  if (meta) {
    meta.textContent = aTr(`Показано пользователей: ${rows.length} из ${adminUsers.length}`, `Users shown: ${rows.length} of ${adminUsers.length}`);
  }

  if (!rows.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="5">${aTr("Пользователи не найдены.", "Users not found.")}</td>`;
    tbody.appendChild(tr);
    return;
  }

  for (const user of rows) {
    const tr = document.createElement("tr");
    tr.className = "admin-user-row";
    const created = formatDateTime(user.created_at);
    tr.innerHTML = `
      <td>${user.id}</td>
      <td>${escapeHtml(user.email)}</td>
      <td>${escapeHtml(user.role || "client")}</td>
      <td>${escapeHtml(created)}</td>
      <td class="admin-user-row-actions"><button class="btn-secondary admin-user-edit-btn" data-edit-user="${user.id}">${aTr("Изменить", "Edit")}</button></td>
    `;
    tr.querySelector(`[data-edit-user="${user.id}"]`)?.addEventListener("click", async () => {
      await adminOpenUserEditModal(user.id);
    });
    tbody.appendChild(tr);
  }
}

function renderAdminUserProfilePanel(payload, rowId) {
  const row = document.getElementById(rowId);
  if (!row) return;
  const host = row.querySelector(".admin-user-details");
  if (!host) return;

  const profile = payload?.profile && typeof payload.profile === "object" ? payload.profile : {};
  const plan = payload?.plan && typeof payload.plan === "object" ? payload.plan : {};
  const credentials = Array.isArray(payload?.credentials) ? payload.credentials : [];
  const teamMembers = Array.isArray(payload?.team_members) ? payload.team_members : [];

  const fullName = String(profile.full_name || "").trim();
  const avatarUrl = String(profile.avatar_url || "").trim();
  const initials = (fullName || payload.email || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0])
    .join("")
    .toUpperCase() || "?";

  const profileFields = [
    ["full_name", aTr("ФИО", "Full name")],
    ["position_title", aTr("Должность", "Position")],
    ["company_name", aTr("Название компании", "Company")],
    ["city", aTr("Город", "City")],
    ["legal_name", aTr("Юр. наименование", "Legal name")],
    ["legal_address", aTr("Юр. адрес", "Legal address")],
    ["tax_id", aTr("ИНН", "Tax ID")],
    ["tax_rate", aTr("Налоговая ставка, %", "Tax rate, %")],
    ["phone", aTr("Телефон", "Phone")],
    ["team_size", aTr("Размер команды", "Team size")],
  ];

  const credentialsHtml = credentials.length
    ? credentials
      .map((rowCred) => `<span class="admin-chip">${escapeHtml(String(rowCred.marketplace || "").toUpperCase())}: ${escapeHtml(String(rowCred.api_key_masked || "-"))}</span>`)
      .join("")
    : `<span class="hint">${aTr("Ключи не подключены.", "No keys connected.")}</span>`;

  host.innerHTML = `
    <div class="admin-user-profile-card">
      <div class="admin-user-profile-head">
        <div class="admin-user-avatar">${avatarUrl ? `<img src="${escapeHtml(avatarUrl)}" alt="avatar" />` : `<span>${escapeHtml(initials)}</span>`}</div>
        <div>
          <h4>${escapeHtml(payload.email || "-")}</h4>
          <div class="hint">#${escapeHtml(String(payload.user_id || "-"))} • role: ${escapeHtml(payload.role || "client")}</div>
          <div class="admin-chip-row">
            <span class="admin-chip">${aTr("Тариф", "Plan")}: ${escapeHtml(String(plan.plan_code || "-"))}</span>
            <span class="admin-chip">${aTr("Статус", "Status")}: ${escapeHtml(String(plan.status || "-"))}</span>
            <span class="admin-chip">${aTr("Продление", "Renew")}: ${escapeHtml(formatDateTime(plan.renew_at))}</span>
          </div>
        </div>
      </div>

      <div class="admin-user-core-actions">
        <label class="admin-user-field">
          <span>${aTr("Роль", "Role")}</span>
          <select data-user-role>
            <option value="client"${payload.role === "client" ? " selected" : ""}>client</option>
            <option value="admin"${payload.role === "admin" ? " selected" : ""}>admin</option>
          </select>
        </label>
        <label class="admin-user-field">
          <span>${aTr("Новый пароль", "New password")}</span>
          <input type="password" data-user-newpass placeholder="${escapeHtml(aTr("Новый пароль (>=8)", "New password (>=8)"))}" />
        </label>
        <div class="actions">
          <button class="btn-secondary" type="button" data-user-save-role>${aTr("Сменить роль", "Change role")}</button>
          <button class="btn-secondary" type="button" data-user-save-pass>${aTr("Сменить пароль", "Change password")}</button>
          <button class="btn-danger" type="button" data-user-delete>${aTr("Удалить пользователя", "Delete user")}</button>
        </div>
      </div>

      <div class="admin-user-profile-grid">
        <div class="team-avatar-row">
          <div id="adminUserAvatarPreview" class="profile-avatar-preview">${avatarUrl ? "" : escapeHtml(initials)}</div>
          <div class="team-avatar-controls">
            <label class="admin-user-field">
              <span>${aTr("Ссылка на аватар", "Avatar URL")}</span>
              <input id="adminUserAvatarUrl" type="text" data-profile-field="avatar_url" value="${escapeHtml(avatarUrl)}" placeholder="https://..." />
            </label>
            <div id="adminUserAvatarPicker" class="avatar-picker"></div>
          </div>
        </div>
        ${profileFields
          .map(([key, label]) => {
            const value = profile[key] ?? "";
            const numeric = key === "tax_rate" || key === "team_size";
            const type = numeric ? "number" : "text";
            const step = key === "tax_rate" ? "0.1" : "1";
            const min = key === "tax_rate" ? "0" : (key === "team_size" ? "1" : "");
            return `
              <label class="admin-user-field">
                <span>${escapeHtml(label)}</span>
                <input type="${type}" data-profile-field="${escapeHtml(key)}" value="${escapeHtml(String(value))}" ${numeric ? `step="${step}" ${min ? `min="${min}"` : ""}` : ""} />
              </label>
            `;
          })
          .join("")}
        <label class="admin-user-field admin-user-field-wide">
          <span>${aTr("Структура компании", "Company structure")}</span>
          <textarea rows="4" data-profile-field="company_structure">${escapeHtml(String(profile.company_structure || ""))}</textarea>
        </label>
      </div>

      <div class="admin-user-plan-bar">
        <select data-profile-plan>
          ${BILLING_PLAN_CODES.map((code) => `<option value="${code}" ${String(plan.plan_code || "") === code ? "selected" : ""}>${code}</option>`).join("")}
        </select>
        <button data-save-profile>${aTr("Сохранить профиль", "Save profile")}</button>
        <button class="btn-secondary" data-save-plan>${aTr("Сменить тариф", "Change plan")}</button>
        <button class="btn-secondary" data-refresh-profile>${aTr("Обновить", "Refresh")}</button>
      </div>

      <div class="admin-user-credentials">
        <strong>${aTr("API ключи", "API keys")}:</strong>
        <div class="admin-chip-row">${credentialsHtml}</div>
      </div>

      <div class="admin-team-box">
        <div class="admin-team-head">
          <strong>${aTr("Сотрудники кабинета", "Workspace employees")}</strong>
          <div class="actions">
            <span class="hint">${aTr("Редактирование сотрудника открывается в pop-up.", "Employee editing opens in popup.")}</span>
            <button class="btn-secondary" type="button" data-team-open-create>${aTr("Добавить сотрудника", "Add employee")}</button>
          </div>
        </div>
        <div class="table-card admin-team-table-wrap">
          <table class="admin-team-table">
            <thead>
              <tr>
                <th>${aTr("Сотрудник", "Employee")}</th>
                <th>${aTr("Роль", "Role")}</th>
                <th>${aTr("Доступ к модулям", "Module access")}</th>
                <th>${aTr("Действия", "Actions")}</th>
              </tr>
            </thead>
            <tbody>
              ${
                teamMembers.length
                  ? teamMembers.map((member) => {
                    const memberId = Number(member.id || 0);
                    const isOwner = Boolean(member.is_owner);
                    const memberTitle = String(member.full_name || "").trim() || String(member.nickname || "").trim() || String(member.email || "-");
                    const roleTitle = isOwner ? aTr("Владелец", "Owner") : aTr("Сотрудник", "Employee");
                    const accessSummary = summarizeAdminTeamAccess(member.access_scope, isOwner);
                    return `
                      <tr data-team-row="${memberId}">
                        <td>
                          <strong>${escapeHtml(memberTitle)}</strong>
                          <div class="hint">${escapeHtml(String(member.email || "-"))}</div>
                        </td>
                        <td><span class="admin-chip">${roleTitle}</span></td>
                        <td>${escapeHtml(accessSummary)}</td>
                        <td class="admin-user-row-actions"><button class="btn-secondary admin-user-edit-btn" type="button" data-team-open-edit="${memberId}">${aTr("Изменить", "Edit")}</button></td>
                      </tr>
                    `;
                  }).join("")
                  : `<tr><td colspan="4">${aTr("Сотрудники не добавлены.", "No employees added.")}</td></tr>`
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  renderAdminAvatarPreview("adminUserAvatarPreview", avatarUrl, initials);
  renderAdminAvatarPicker("adminUserAvatarPicker", avatarUrl, (url) => {
    const input = document.getElementById("adminUserAvatarUrl");
    if (input) input.value = url;
    renderAdminAvatarPreview("adminUserAvatarPreview", url, initials);
  });
  const avatarInput = document.getElementById("adminUserAvatarUrl");
  avatarInput?.addEventListener("input", () => {
    renderAdminAvatarPreview("adminUserAvatarPreview", avatarInput.value, initials);
  });

  const refreshProfile = async () => {
    await adminLoadUserProfileInto(payload.user_id, rowId, true);
  };
  host.querySelector("[data-user-save-role]")?.addEventListener("click", async () => {
    const role = host.querySelector("[data-user-role]")?.value || "client";
    await adminSetUserRole(payload.user_id, role);
    await refreshProfile();
  });
  host.querySelector("[data-user-save-pass]")?.addEventListener("click", async () => {
    const newPass = String(host.querySelector("[data-user-newpass]")?.value || "");
    const ok = await adminSetUserPassword(payload.user_id, newPass);
    if (ok) {
      const passInput = host.querySelector("[data-user-newpass]");
      if (passInput) passInput.value = "";
    }
  });
  host.querySelector("[data-user-delete]")?.addEventListener("click", async () => {
    const deleted = await adminDeleteUser(payload.user_id);
    if (deleted) adminCloseUserEditModal();
  });
  host.querySelector("[data-save-profile]")?.addEventListener("click", async () => {
    await adminSaveUserProfileFromPanel(payload.user_id, rowId);
  });
  host.querySelector("[data-save-plan]")?.addEventListener("click", async () => {
    await adminSaveUserPlanFromPanel(payload.user_id, rowId);
  });
  host.querySelector("[data-refresh-profile]")?.addEventListener("click", async () => {
    await refreshProfile();
  });
  host.querySelector("[data-team-open-create]")?.addEventListener("click", () => {
    adminOpenTeamMemberModal({
      userId: Number(payload.user_id || 0),
      rowId,
      mode: "create",
      teamMembers,
    });
  });
  host.querySelectorAll("[data-team-open-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const memberId = Number(btn.dataset.teamOpenEdit || 0);
      adminOpenTeamMemberModal({
        userId: Number(payload.user_id || 0),
        rowId,
        mode: "edit",
        memberId,
        teamMembers,
      });
    });
  });
}

function collectAdminProfilePayload(rowId) {
  const row = document.getElementById(rowId);
  const host = row?.querySelector(".admin-user-details");
  if (!host) return null;
  const out = {
    full_name: "",
    company_name: "",
    city: "",
    legal_name: "",
    legal_address: "",
    tax_id: "",
    tax_rate: 0,
    phone: "",
    position_title: "",
    team_size: 1,
    company_structure: "",
    avatar_url: "",
  };
  host.querySelectorAll("[data-profile-field]").forEach((el) => {
    const key = el.dataset.profileField;
    if (!key || !(key in out)) return;
    const value = el.value;
    if (key === "tax_rate") out[key] = Number(value || 0);
    else if (key === "team_size") out[key] = Math.max(1, Number(value || 1));
    else out[key] = String(value || "").trim();
  });
  return out;
}

async function adminSetUserRole(user_id, role) {
  const data = await adminRequest("/api/admin/users/role", {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({ user_id, role }),
  }).catch((e) => {
    alert(e.message);
    return null;
  });
  if (data) alert(data.message);
  await loadAdminAll();
  return Boolean(data);
}

async function adminSetUserPassword(user_id, new_password) {
  if (!new_password) {
    alert(aTr("Введите новый пароль", "Enter new password"));
    return false;
  }
  const data = await adminRequest("/api/admin/users/password", {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({ user_id, new_password }),
  }).catch((e) => {
    alert(e.message);
    return null;
  });
  if (data) alert(data.message);
  await loadAdminAll();
  return Boolean(data);
}

async function adminDeleteUser(user_id) {
  if (!confirm(aTr(`Удалить пользователя #${user_id} вместе с его данными?`, `Delete user #${user_id} with all data?`))) return false;
  const data = await adminRequest(`/api/admin/users/${user_id}`, {
    method: "DELETE",
    headers: adminHeaders(),
  }).catch((e) => {
    alert(e.message);
    return null;
  });
  if (data) alert(data.message);
  await loadAdminAll();
  return Boolean(data);
}

async function adminLoadUserProfileInto(user_id, rowId, forceReload = false) {
  const row = document.getElementById(rowId);
  if (!row) return null;
  const holder = row.querySelector(".admin-user-details");
  if (holder) holder.textContent = aTr("Загрузка...", "Loading...");
  if (forceReload) adminUserProfileCache.delete(user_id);
  let payload = forceReload ? null : (adminUserProfileCache.get(user_id) || null);
  if (!payload) {
    payload = await adminRequest(`/api/admin/users/${user_id}/profile`, {
      headers: adminHeaders(),
    }).catch((e) => {
      alert(e.message);
      return null;
    });
    if (!payload) return null;
    adminUserProfileCache.set(user_id, payload);
  }

  renderAdminUserProfilePanel(payload, rowId);
  return payload;
}

async function adminOpenUserEditModal(user_id) {
  const modal = document.getElementById("adminUserEditModal");
  const host = document.getElementById("adminUserEditHost");
  if (!modal || !host) return;
  modal.classList.remove("hidden");
  const title = document.getElementById("adminUserEditTitle");
  if (title) {
    const user = adminUsers.find((x) => Number(x.id) === Number(user_id));
    title.textContent = aTr("Профиль пользователя", "User profile") + ` #${user_id}${user?.email ? ` • ${user.email}` : ""}`;
  }
  await adminLoadUserProfileInto(user_id, "adminUserEditHost", false);
}

function adminCloseUserEditModal(evt) {
  const modal = document.getElementById("adminUserEditModal");
  if (!modal) return;
  if (evt && evt.target && evt.target !== modal) return;
  modal.classList.add("hidden");
}

function getAdminTeamMemberFromState(memberId) {
  const id = Number(memberId || 0);
  if (!id) return null;
  return (Array.isArray(adminTeamModalState.teamMembers) ? adminTeamModalState.teamMembers : [])
    .find((row) => Number(row.id || 0) === id) || null;
}

function fillAdminTeamMemberModal() {
  const modal = document.getElementById("adminTeamMemberModal");
  const titleEl = document.getElementById("adminTeamMemberModalTitle");
  const metaEl = document.getElementById("adminTeamMemberModalMeta");
  const scopeEl = document.getElementById("adminTeamModalScope");
  const saveBtn = document.getElementById("adminTeamModalSaveBtn");
  const delBtn = document.getElementById("adminTeamModalDeleteBtn");
  if (!modal || !titleEl || !metaEl || !scopeEl || !saveBtn || !delBtn) return;

  const mode = adminTeamModalState.mode === "create" ? "create" : "edit";
  const member = mode === "edit" ? getAdminTeamMemberFromState(adminTeamModalState.memberId) : null;
  const isOwner = Boolean(member?.is_owner);
  const scopeKey = mode === "create" ? "new" : String(Number(member?.id || 0));
  titleEl.textContent = mode === "create"
    ? aTr("Новый сотрудник", "New employee")
    : (isOwner ? aTr("Владелец кабинета", "Workspace owner") : aTr("Сотрудник кабинета", "Workspace employee"));
  metaEl.textContent = mode === "create"
    ? aTr("Заполните данные и назначьте доступы к модулям.", "Fill details and assign module access.")
    : `#${Number(member?.id || 0)} • ${isOwner ? aTr("Права владельца фиксированы.", "Owner access is fixed.") : aTr("Измените данные и доступы.", "Update fields and access.")}`;
  saveBtn.textContent = mode === "create" ? aTr("Добавить", "Add") : aTr("Сохранить", "Save");
  delBtn.classList.toggle("hidden", mode === "create" || isOwner);

  const emailEl = document.getElementById("adminTeamModalEmail");
  const passEl = document.getElementById("adminTeamModalPassword");
  const fullEl = document.getElementById("adminTeamModalFullName");
  const phoneEl = document.getElementById("adminTeamModalPhone");
  const nickEl = document.getElementById("adminTeamModalNickname");
  const avatarEl = document.getElementById("adminTeamModalAvatar");

  if (emailEl) {
    emailEl.value = String(member?.email || "");
    emailEl.disabled = isOwner;
  }
  if (passEl) {
    passEl.value = "";
    passEl.placeholder = mode === "create"
      ? aTr("Пароль сотрудника (>=8)", "Employee password (>=8)")
      : aTr("Новый пароль (опц.)", "New password (optional)");
  }
  if (fullEl) fullEl.value = String(member?.full_name || "");
  if (phoneEl) phoneEl.value = String(member?.phone || "");
  if (nickEl) nickEl.value = String(member?.nickname || "");
  if (avatarEl) avatarEl.value = String(member?.avatar_url || "");
  renderAdminAvatarPreview("adminTeamAvatarPreview", avatarEl?.value || "", "--");
  renderAdminAvatarPicker("adminTeamAvatarPicker", avatarEl?.value || "", (url) => {
    if (avatarEl) avatarEl.value = url;
    renderAdminAvatarPreview("adminTeamAvatarPreview", url, "--");
  });
  if (avatarEl) {
    avatarEl.oninput = () => {
      renderAdminAvatarPreview("adminTeamAvatarPreview", avatarEl.value, "--");
    };
  }

  scopeEl.innerHTML = renderAdminTeamScopePicks(member?.access_scope || [], scopeKey, isOwner, "modal");
  modal.classList.remove("hidden");
}

function adminOpenTeamMemberModal({ userId, rowId, mode, memberId = 0, teamMembers = [] }) {
  adminTeamModalState = {
    userId: Number(userId || 0),
    rowId: String(rowId || ""),
    mode: mode === "create" ? "create" : "edit",
    memberId: Number(memberId || 0),
    teamMembers: Array.isArray(teamMembers) ? teamMembers : [],
  };
  fillAdminTeamMemberModal();
}

function adminCloseTeamMemberModal(evt) {
  const modal = document.getElementById("adminTeamMemberModal");
  if (!modal) return;
  if (evt && evt.target && evt.target !== modal) return;
  modal.classList.add("hidden");
}

async function adminSaveTeamMemberFromModal() {
  const userId = Number(adminTeamModalState.userId || 0);
  const rowId = String(adminTeamModalState.rowId || "");
  if (!userId || !rowId) return;
  const mode = adminTeamModalState.mode === "create" ? "create" : "edit";
  const member = mode === "edit" ? getAdminTeamMemberFromState(adminTeamModalState.memberId) : null;
  const memberId = Number(member?.id || 0);
  const scopeKey = mode === "create" ? "new" : String(memberId);
  const modal = document.getElementById("adminTeamMemberModal");

  const payload = {
    email: String(document.getElementById("adminTeamModalEmail")?.value || "").trim().toLowerCase(),
    password: String(document.getElementById("adminTeamModalPassword")?.value || ""),
    full_name: String(document.getElementById("adminTeamModalFullName")?.value || "").trim(),
    phone: String(document.getElementById("adminTeamModalPhone")?.value || "").trim(),
    nickname: String(document.getElementById("adminTeamModalNickname")?.value || "").trim(),
    avatar_url: String(document.getElementById("adminTeamModalAvatar")?.value || "").trim(),
    access_scope: collectAdminTeamScope(modal, scopeKey, "modal"),
  };
  if (!payload.email && !Boolean(member?.is_owner)) {
    alert(aTr("Укажите email сотрудника", "Enter employee email"));
    return;
  }
  if (Boolean(member?.is_owner)) {
    payload.email = String(member?.email || "").trim().toLowerCase();
    payload.access_scope = normalizeAdminTeamScope(member?.access_scope || []);
  }

  const url = mode === "create"
    ? `/api/admin/users/${userId}/team`
    : `/api/admin/users/${userId}/team/${memberId}`;
  const method = mode === "create" ? "POST" : "PUT";
  const saved = await adminRequest(url, {
    method,
    headers: adminHeaders(),
    body: JSON.stringify(payload),
  }).catch((e) => {
    alert(e.message);
    return null;
  });
  if (!saved) return;
  adminCloseTeamMemberModal();
  await adminLoadUserProfileInto(userId, rowId, true);
}

async function adminDeleteTeamMemberFromModal() {
  const userId = Number(adminTeamModalState.userId || 0);
  const rowId = String(adminTeamModalState.rowId || "");
  const member = getAdminTeamMemberFromState(adminTeamModalState.memberId);
  const memberId = Number(member?.id || 0);
  if (!userId || !rowId || !memberId) return;
  if (Boolean(member?.is_owner)) return;
  if (!confirm(aTr("Удалить сотрудника из кабинета?", "Delete employee from workspace?"))) return;
  const deleted = await adminRequest(`/api/admin/users/${userId}/team/${memberId}`, {
    method: "DELETE",
    headers: adminHeaders(),
  }).catch((e) => {
    alert(e.message);
    return null;
  });
  if (!deleted) return;
  adminCloseTeamMemberModal();
  await adminLoadUserProfileInto(userId, rowId, true);
}

async function adminSaveUserProfileFromPanel(userId, rowId) {
  const payload = collectAdminProfilePayload(rowId);
  if (!payload) return;
  const next = await adminRequest(`/api/admin/users/${userId}/profile`, {
    method: "PUT",
    headers: adminHeaders(),
    body: JSON.stringify(payload),
  }).catch((e) => {
    alert(e.message);
    return null;
  });
  if (!next) return;
  adminUserProfileCache.set(userId, next);
  renderAdminUserProfilePanel(next, rowId);
  alert(aTr("Профиль пользователя обновлен", "User profile updated"));
}

async function adminSaveUserPlanFromPanel(userId, rowId) {
  const row = document.getElementById(rowId);
  const planCode = row?.querySelector("[data-profile-plan]")?.value || "starter";
  const next = await adminRequest(`/api/admin/users/${userId}/plan`, {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({ plan_code: planCode }),
  }).catch((e) => {
    alert(e.message);
    return null;
  });
  if (!next) return;
  adminUserProfileCache.set(userId, next);
  renderAdminUserProfilePanel(next, rowId);
  alert(aTr("Тариф пользователя обновлен", "User plan updated"));
}

async function adminSaveCredential2() {
  const user_id = Number(document.getElementById("adminCredUserSelect")?.value || 0);
  const marketplace = document.getElementById("adminCredMarketplace2")?.value || "wb";
  const api_key = document.getElementById("adminCredKey2")?.value.trim() || "";
  if (!user_id || !api_key) return alert(aTr("Выберите пользователя и укажите api_key", "Select user and provide api_key"));
  await adminRequest("/api/admin/credentials", {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({ user_id, marketplace, api_key }),
  }).catch((e) => alert(e.message));
  const keyInput = document.getElementById("adminCredKey2");
  if (keyInput) keyInput.value = "";
  await loadAdminAll();
}

function renderAdminCredentialsTable() {
  const tbody = document.getElementById("adminCredsTable");
  if (!tbody) return;
  tbody.innerHTML = "";
  if (!adminCredentials.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="7">${aTr("Ключей нет.", "No keys.")}</td>`;
    tbody.appendChild(tr);
    return;
  }

  for (const row of adminCredentials) {
    const tr = document.createElement("tr");
    const created = formatDateTime(row.created_at);
    tr.innerHTML = `
      <td>${row.id}</td>
      <td>#${row.user_id} ${escapeHtml(row.user_email)}</td>
      <td>${escapeHtml(row.marketplace)}</td>
      <td>${escapeHtml(row.api_key_masked)}</td>
      <td>${row.active ? "active" : "disabled"}</td>
      <td>${escapeHtml(created)}</td>
      <td><button class="btn-danger" data-del-cred="${row.id}">${aTr("Удалить", "Delete")}</button></td>
    `;
    tr.querySelector(`[data-del-cred="${row.id}"]`)?.addEventListener("click", async () => {
      await adminDeleteCredential(row.id);
    });
    tbody.appendChild(tr);
  }
}

async function adminDeleteCredential(credential_id) {
  if (!credential_id) return;
  await adminRequest(`/api/admin/credentials/${credential_id}`, {
    method: "DELETE",
    headers: adminHeaders(),
  }).catch((e) => alert(e.message));
  await loadAdminAll();
}

function getModuleRowsForUser(userId) {
  const existingWeb = new Map();
  for (const row of adminModules) {
    if (Number(row.user_id) !== Number(userId)) continue;
    existingWeb.set(String(row.module_code || "").trim(), Boolean(row.enabled));
  }
  const existingMobile = new Map();
  for (const row of adminMobileModules) {
    if (Number(row.user_id) !== Number(userId)) continue;
    existingMobile.set(String(row.module_code || "").trim(), Boolean(row.enabled));
  }
  const codes = new Set(DEFAULT_MODULE_CODES);
  for (const row of adminModules) codes.add(row.module_code);
  for (const row of adminMobileModules) codes.add(row.module_code);
  return [...codes]
    .sort()
    .map((code) => ({
      module_code: code,
      title: MODULE_TITLES[code]?.[adminLang] || code,
      enabled: existingWeb.has(code) ? existingWeb.get(code) : false,
      mobile_overridden: existingMobile.has(code),
      mobile_enabled: existingMobile.has(code)
        ? existingMobile.get(code)
        : (existingWeb.has(code) ? existingWeb.get(code) : false),
    }));
}

function renderAdminModulesTable() {
  const tbody = document.getElementById("adminModulesTable");
  if (!tbody) return;
  tbody.innerHTML = "";

  const userId = Number(document.getElementById("adminModuleUserSelect")?.value || 0);
  if (!userId) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="6">${aTr("Выберите пользователя.", "Select user.")}</td>`;
    tbody.appendChild(tr);
    return;
  }

  const rows = getModuleRowsForUser(userId);
  if (!rows.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="6">${aTr("Модули не найдены.", "No modules found.")}</td>`;
    tbody.appendChild(tr);
    return;
  }

  for (const row of rows) {
    const tr = document.createElement("tr");
    const webStatusLabel = row.enabled ? aTr("Включен", "Enabled") : aTr("Отключен", "Disabled");
    const webActionLabel = row.enabled ? aTr("Отключить", "Disable") : aTr("Включить", "Enable");
    const webActionClass = row.enabled ? "btn-danger" : "btn-secondary";
    const apkStatusLabel = row.mobile_enabled
      ? aTr("Включен", "Enabled")
      : aTr("Отключен", "Disabled");
    const apkStatusFull = row.mobile_overridden
      ? apkStatusLabel
      : `${apkStatusLabel} (${aTr("по web", "web default")})`;
    const apkActionLabel = row.mobile_enabled ? aTr("Отключить", "Disable") : aTr("Включить", "Enable");
    const apkActionClass = row.mobile_enabled ? "btn-danger" : "btn-secondary";
    tr.innerHTML = `
      <td>${escapeHtml(row.module_code)}</td>
      <td>${escapeHtml(row.title)}</td>
      <td>${webStatusLabel}</td>
      <td><button class="${webActionClass}" data-module-code="${escapeHtml(row.module_code)}" data-kind="web">${webActionLabel}</button></td>
      <td>${apkStatusFull}</td>
      <td><button class="${apkActionClass}" data-module-code="${escapeHtml(row.module_code)}" data-kind="apk">${apkActionLabel}</button></td>
    `;
    tr.querySelectorAll("button[data-module-code]").forEach((btn) => {
      const kind = String(btn.dataset.kind || "web");
      if (kind === "apk") {
        btn.onclick = () => adminToggleMobileModule(row.module_code, !row.mobile_enabled);
      } else {
        btn.onclick = () => adminToggleModule(row.module_code, !row.enabled);
      }
    });
    tbody.appendChild(tr);
  }
}

async function adminToggleModule(module_code, enabled) {
  const user_id = Number(document.getElementById("adminModuleUserSelect")?.value || 0);
  if (!user_id || !module_code) return alert(aTr("Выберите пользователя и модуль", "Select user and module"));
  await adminRequest("/api/admin/modules", {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({ user_id, module_code, enabled }),
  }).catch((e) => {
    alert(e.message);
    return null;
  });
  await loadAdminAll();
}

async function adminToggleMobileModule(module_code, enabled) {
  const user_id = Number(document.getElementById("adminModuleUserSelect")?.value || 0);
  if (!user_id || !module_code) return alert(aTr("Выберите пользователя и модуль", "Select user and module"));
  await adminRequest("/api/admin/modules/mobile", {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({ user_id, module_code, enabled }),
  }).catch((e) => {
    alert(e.message);
    return null;
  });
  await loadAdminAll();
}

function normalizeAiModeSelection(value) {
  const mode = String(value || "").trim().toLowerCase();
  return ["global_default", "builtin", "global", "user"].includes(mode) ? mode : "global_default";
}

function buildAiServicePayload(prefix) {
  return {
    name: String(document.getElementById(`${prefix}Name`)?.value || "").trim(),
    provider: String(document.getElementById(`${prefix}Provider`)?.value || "openai").trim().toLowerCase(),
    model: String(document.getElementById(`${prefix}Model`)?.value || "").trim(),
    base_url: String(document.getElementById(`${prefix}BaseUrl`)?.value || "").trim(),
    api_key: String(document.getElementById(`${prefix}ApiKey`)?.value || "").trim(),
  };
}

function clearAiServiceForm(prefix) {
  ["Name", "Model", "BaseUrl", "ApiKey"].forEach((suffix) => {
    const el = document.getElementById(`${prefix}${suffix}`);
    if (el) el.value = "";
  });
  const providerSel = document.getElementById(`${prefix}Provider`);
  if (providerSel) providerSel.value = "openai";
  const actionBtn = document.getElementById(prefix.includes("Global") ? "adminAiGlobalSaveBtn" : "adminAiUserSaveBtn");
  if (actionBtn) {
    actionBtn.dataset.editId = "";
    actionBtn.textContent = prefix.includes("Global")
      ? aTr("Добавить глобальный AI", "Add global AI")
      : aTr("Добавить AI пользователю", "Add AI for user");
  }
}

function renderAiPriorityList(host, rows, options = {}) {
  if (!host) return;
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) {
    host.innerHTML = `<div class="hint">${aTr("Сервисов нет.", "No services yet.")}</div>`;
    return;
  }
  const draggable = Boolean(options.draggable);
  const readonly = Boolean(options.readonly);
  host.innerHTML = list.map((row, idx) => {
    const label = String(row?.name || "-");
    const provider = String(row?.provider || "-");
    const model = String(row?.model || "-");
    const base = String(row?.base_url || "-");
    return `
      <div class="admin-ai-item${readonly ? " readonly" : ""}" draggable="${draggable ? "true" : "false"}" data-id="${Number(row.id || 0)}">
        <div class="drag-handle" aria-hidden="true">${draggable ? "↕" : "•"}</div>
        <div class="ai-main">
          <div class="ai-title"><b>${escapeHtml(label)}</b><span class="hint">#${idx + 1}</span></div>
          <div class="ai-meta">${escapeHtml(provider)} · ${escapeHtml(model)} · ${escapeHtml(base)}</div>
        </div>
        ${readonly ? "" : `
          <div class="actions">
            <button class="btn-secondary" type="button" data-ai-edit="${Number(row.id || 0)}">${aTr("Изменить", "Edit")}</button>
            <button class="btn-danger" type="button" data-ai-del="${Number(row.id || 0)}">${aTr("Удалить", "Delete")}</button>
          </div>
        `}
      </div>
    `;
  }).join("");
}

function bindAiDragSort(host, { onReorder } = {}) {
  if (!host || typeof onReorder !== "function") return;
  let dragItem = null;
  host.querySelectorAll(".admin-ai-item").forEach((item) => {
    if (item.getAttribute("draggable") !== "true") return;
    item.addEventListener("dragstart", (e) => {
      dragItem = item;
      item.classList.add("dragging");
      if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
    });
    item.addEventListener("dragend", () => {
      item.classList.remove("dragging");
      dragItem = null;
    });
  });
  host.addEventListener("dragover", (e) => {
    if (!dragItem) return;
    e.preventDefault();
    const target = e.target.closest(".admin-ai-item");
    if (!target || target === dragItem || target.getAttribute("draggable") !== "true") return;
    const rect = target.getBoundingClientRect();
    const after = e.clientY > rect.top + rect.height / 2;
    host.insertBefore(dragItem, after ? target.nextSibling : target);
  });
  host.addEventListener("drop", (e) => {
    if (!dragItem) return;
    e.preventDefault();
    dragItem.classList.remove("dragging");
    dragItem = null;
    const ids = [...host.querySelectorAll(".admin-ai-item")]
      .map((el) => Number(el.dataset.id || 0))
      .filter((id) => id > 0);
    onReorder(ids);
  });
}

function renderAdminAiTab(preserveUserMode = false) {
  const globalMode = document.getElementById("adminAiGlobalMode");
  const globalList = document.getElementById("adminAiGlobalPriorityList");
  if (!globalMode || !globalList) return;

  const globalDefault = adminAiGlobalState?.global_default || { mode: "builtin", service_id: null };
  const globalServices = Array.isArray(adminAiGlobalState?.global_services) ? adminAiGlobalState.global_services : [];
  globalMode.value = String(globalDefault.mode || "builtin");
  renderAiPriorityList(globalList, globalServices, { draggable: true });
  bindAiDragSort(globalList, {
    onReorder: async (ids) => {
      const data = await adminRequest("/api/admin/ai/global/services/reorder", {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({ service_ids: ids }),
      }).catch((e) => {
        alert(e.message);
        return null;
      });
      if (!data) return;
      if (adminAiGlobalState) adminAiGlobalState.global_services = data;
      renderAdminAiTab(true);
    },
  });
  globalList.querySelectorAll("[data-ai-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = Number(btn.dataset.aiEdit || 0);
      const row = globalServices.find((x) => Number(x.id) === id);
      if (!row) return;
      const map = {
        adminAiGlobalName: row.name || "",
        adminAiGlobalModel: row.model || "",
        adminAiGlobalBaseUrl: row.base_url || "",
      };
      Object.entries(map).forEach(([idKey, val]) => {
        const el = document.getElementById(idKey);
        if (el) el.value = String(val || "");
      });
      const p = document.getElementById("adminAiGlobalProvider");
      if (p) p.value = String(row.provider || "openai");
      const actionBtn = document.getElementById("adminAiGlobalSaveBtn");
      if (actionBtn) {
        actionBtn.dataset.editId = String(id);
        actionBtn.textContent = aTr("Сохранить изменения", "Save changes");
      }
      adminOpenAiGlobalModal(true);
      const keyInput = document.getElementById("adminAiGlobalApiKey");
      if (keyInput) keyInput.focus();
    });
  });
  globalList.querySelectorAll("[data-ai-del]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = Number(btn.dataset.aiDel || 0);
      if (!id) return;
      if (!confirm(aTr(`Удалить глобальный AI сервис #${id}?`, `Delete global AI service #${id}?`))) return;
      await adminRequest(`/api/admin/ai/global/services/${id}`, {
        method: "DELETE",
        headers: adminHeaders(),
      }).catch((e) => alert(e.message));
      await loadAdminAll();
    });
  });

  const userSelect = document.getElementById("adminAiUserSelect");
  const userMode = document.getElementById("adminAiUserMode");
  const userList = document.getElementById("adminAiUserPriorityList");
  const userGlobalList = document.getElementById("adminAiUserGlobalList");
  if (!userSelect || !userMode || !userList || !userGlobalList) return;
  if (userSelect.value && !adminSelectedUserAiState) {
    loadAdminUserAi().catch(() => null);
    return;
  }
  const userState = adminSelectedUserAiState && typeof adminSelectedUserAiState === "object" ? adminSelectedUserAiState : null;
  const stateMode = userState?.selection?.use_global_default
    ? "global_default"
    : (String(userState?.selection?.mode || "builtin"));
  const selectedMode = preserveUserMode ? normalizeAiModeSelection(userMode.value || stateMode) : normalizeAiModeSelection(stateMode);
  userMode.value = selectedMode;
  const globalRows = Array.isArray(userState?.global_services) ? userState.global_services : [];
  const userRows = Array.isArray(userState?.user_services) ? userState.user_services : [];
  const effective = userState?.effective || {};
  const chain = Array.isArray(userState?.effective_chain) ? userState.effective_chain : [];
  const eff = document.getElementById("adminAiUserEffective");
  if (eff) {
    const chainText = chain.length
      ? chain.map((x, idx) => `${idx + 1}. ${x.provider || "-"} ${x.model || "-"}`).join(" → ")
      : `${effective.provider || "-"} ${effective.model || "-"}`;
    eff.textContent = `${aTr("Эффективно", "Effective")}: ${effective.mode || "-"} | ${effective.provider || "-"} | ${effective.model || "-"} | ${effective.service_name || "-"} • ${aTr("Цепочка fallback", "Fallback chain")}: ${chainText}`;
  }
  renderAiPriorityList(userList, userRows, { draggable: true });
  renderAiPriorityList(userGlobalList, globalRows, { draggable: false, readonly: true });
  bindAiDragSort(userList, {
    onReorder: async (ids) => {
      const userId = Number(document.getElementById("adminAiUserSelect")?.value || 0);
      if (!userId) return;
      const data = await adminRequest(`/api/admin/users/${userId}/ai/services/reorder`, {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({ service_ids: ids }),
      }).catch((e) => {
        alert(e.message);
        return null;
      });
      if (!data) return;
      if (adminSelectedUserAiState) adminSelectedUserAiState.user_services = data;
      renderAdminAiTab(true);
    },
  });

  userList.querySelectorAll("[data-ai-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = Number(btn.dataset.aiEdit || 0);
      const row = userRows.find((x) => Number(x.id) === id);
      if (!row) return;
      const map = {
        adminAiUserName: row.name || "",
        adminAiUserModel: row.model || "",
        adminAiUserBaseUrl: row.base_url || "",
      };
      Object.entries(map).forEach(([idKey, val]) => {
        const el = document.getElementById(idKey);
        if (el) el.value = String(val || "");
      });
      const p = document.getElementById("adminAiUserProvider");
      if (p) p.value = String(row.provider || "openai");
      const actionBtn = document.getElementById("adminAiUserSaveBtn");
      if (actionBtn) {
        actionBtn.dataset.editId = String(id);
        actionBtn.textContent = aTr("Сохранить изменения", "Save changes");
      }
      adminOpenAiUserModal(true);
      const keyInput = document.getElementById("adminAiUserApiKey");
      if (keyInput) keyInput.focus();
    });
  });
  userList.querySelectorAll("[data-ai-del]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = Number(btn.dataset.aiDel || 0);
      const userId = Number(document.getElementById("adminAiUserSelect")?.value || 0);
      if (!id || !userId) return;
      if (!confirm(aTr(`Удалить AI сервис пользователя #${id}?`, `Delete user AI service #${id}?`))) return;
      await adminRequest(`/api/admin/users/${userId}/ai/services/${id}`, {
        method: "DELETE",
        headers: adminHeaders(),
      }).catch((e) => alert(e.message));
      await loadAdminUserAi();
    });
  });
}

async function loadAdminUserAi() {
  const userId = Number(document.getElementById("adminAiUserSelect")?.value || 0);
  if (!userId) {
    adminSelectedUserAiState = null;
    renderAdminAiTab();
    return;
  }
  const data = await adminRequest(`/api/admin/users/${userId}/ai`, {
    headers: adminHeaders(),
  }).catch((e) => {
    alert(e.message);
    return null;
  });
  if (!data) return;
  adminSelectedUserAiState = data;
  renderAdminAiTab();
}

function adminOpenAiGlobalModal(preserveState = false) {
  const modal = document.getElementById("adminAiGlobalModal");
  if (!modal) return;
  if (!preserveState) clearAiServiceForm("adminAiGlobal");
  const title = document.getElementById("adminAiGlobalModalTitle");
  const saveBtn = document.getElementById("adminAiGlobalSaveBtn");
  if (title) {
    title.textContent = saveBtn?.dataset?.editId
      ? aTr("Глобальный AI сервис: редактирование", "Global AI service: edit")
      : aTr("Глобальный AI сервис: добавление", "Global AI service: add");
  }
  modal.classList.remove("hidden");
}

function adminCloseAiGlobalModal(evt) {
  const modal = document.getElementById("adminAiGlobalModal");
  if (!modal) return;
  if (evt && evt.target && evt.target !== modal) return;
  modal.classList.add("hidden");
}

function adminOpenAiUserModal(preserveState = false) {
  const userId = Number(document.getElementById("adminAiUserSelect")?.value || 0);
  if (!userId) {
    alert(aTr("Сначала выберите пользователя", "Select user first"));
    return;
  }
  const modal = document.getElementById("adminAiUserModal");
  if (!modal) return;
  if (!preserveState) clearAiServiceForm("adminAiUser");
  const title = document.getElementById("adminAiUserModalTitle");
  const saveBtn = document.getElementById("adminAiUserSaveBtn");
  if (title) {
    title.textContent = saveBtn?.dataset?.editId
      ? aTr("AI сервис пользователя: редактирование", "User AI service: edit")
      : aTr("AI сервис пользователя: добавление", "User AI service: add");
  }
  modal.classList.remove("hidden");
}

function adminCloseAiUserModal(evt) {
  const modal = document.getElementById("adminAiUserModal");
  if (!modal) return;
  if (evt && evt.target && evt.target !== modal) return;
  modal.classList.add("hidden");
}

function adminOpenAppearanceModal() {
  const modal = document.getElementById("adminAppearanceModal");
  if (!modal) return;
  modal.classList.remove("hidden");
}

function adminCloseAppearanceModal(evt) {
  const modal = document.getElementById("adminAppearanceModal");
  if (!modal) return;
  if (evt && evt.target && evt.target !== modal) return;
  modal.classList.add("hidden");
}

async function adminSaveAiGlobalDefault() {
  const mode = String(document.getElementById("adminAiGlobalMode")?.value || "builtin").trim().toLowerCase();
  const globalRows = Array.isArray(adminAiGlobalState?.global_services) ? adminAiGlobalState.global_services : [];
  const serviceId = Number(globalRows[0]?.id || 0);
  if (mode === "global" && !serviceId) {
    alert(aTr("Сначала добавьте глобальный AI сервис.", "Add a global AI service first."));
    return;
  }
  const payload = {
    use_global_default: false,
    mode,
    service_id: mode === "global" ? (serviceId || null) : null,
  };
  await adminRequest("/api/admin/ai/global/default", {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify(payload),
  }).catch((e) => alert(e.message));
  await loadAdminAll();
}

async function adminAddGlobalAiService() {
  const btn = document.getElementById("adminAiGlobalSaveBtn");
  const editId = Number(btn?.dataset?.editId || 0);
  const payload = buildAiServicePayload("adminAiGlobal");
  if (!payload.name || !payload.api_key) {
    alert(aTr("Укажите название и API key", "Provide name and API key"));
    return;
  }
  const url = editId ? `/api/admin/ai/global/services/${editId}` : "/api/admin/ai/global/services";
  const method = editId ? "PUT" : "POST";
  await adminRequest(url, {
    method,
    headers: adminHeaders(),
    body: JSON.stringify(payload),
  }).catch((e) => alert(e.message));
  clearAiServiceForm("adminAiGlobal");
  adminCloseAiGlobalModal();
  await loadAdminAll();
}

async function adminSaveUserAiSelection() {
  const userId = Number(document.getElementById("adminAiUserSelect")?.value || 0);
  if (!userId) {
    alert(aTr("Выберите пользователя", "Select user"));
    return;
  }
  const rawMode = normalizeAiModeSelection(document.getElementById("adminAiUserMode")?.value || "global_default");
  const userRows = Array.isArray(adminSelectedUserAiState?.user_services) ? adminSelectedUserAiState.user_services : [];
  const globalRows = Array.isArray(adminSelectedUserAiState?.global_services) ? adminSelectedUserAiState.global_services : [];
  const topUserId = Number(userRows[0]?.id || 0);
  const topGlobalId = Number(globalRows[0]?.id || 0);
  const serviceId = rawMode === "user" ? topUserId : (rawMode === "global" ? topGlobalId : 0);
  if (rawMode === "user" && !topUserId) {
    alert(aTr("Сначала добавьте AI сервис пользователю.", "Add a user AI service first."));
    return;
  }
  if (rawMode === "global" && !topGlobalId) {
    alert(aTr("Сначала добавьте глобальный AI сервис.", "Add a global AI service first."));
    return;
  }
  const payload = {
    use_global_default: rawMode === "global_default",
    mode: rawMode === "global_default" ? "builtin" : rawMode,
    service_id: rawMode === "global" || rawMode === "user" ? (serviceId || null) : null,
  };
  await adminRequest(`/api/admin/users/${userId}/ai/select`, {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify(payload),
  }).catch((e) => alert(e.message));
  await loadAdminUserAi();
}

async function adminAddUserAiService() {
  const userId = Number(document.getElementById("adminAiUserSelect")?.value || 0);
  if (!userId) {
    alert(aTr("Выберите пользователя", "Select user"));
    return;
  }
  const btn = document.getElementById("adminAiUserSaveBtn");
  const editId = Number(btn?.dataset?.editId || 0);
  const payload = buildAiServicePayload("adminAiUser");
  if (!payload.name || !payload.api_key) {
    alert(aTr("Укажите название и API key", "Provide name and API key"));
    return;
  }
  const url = editId
    ? `/api/admin/users/${userId}/ai/services/${editId}`
    : `/api/admin/users/${userId}/ai/services`;
  const method = editId ? "PUT" : "POST";
  await adminRequest(url, {
    method,
    headers: adminHeaders(),
    body: JSON.stringify(payload),
  }).catch((e) => alert(e.message));
  clearAiServiceForm("adminAiUser");
  adminCloseAiUserModal();
  await loadAdminUserAi();
}

function formatAdminBytes(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num) || num <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let idx = 0;
  let n = num;
  while (n >= 1024 && idx < units.length - 1) {
    n /= 1024;
    idx += 1;
  }
  return `${n.toFixed(idx === 0 ? 0 : 2)} ${units[idx]}`;
}

function formatAdminDuration(seconds) {
  const sec = Math.max(0, Number(seconds || 0));
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}д ${h}ч ${m}м`;
  if (h > 0) return `${h}ч ${m}м`;
  return `${m}м`;
}

function formatAdminTimeShort(raw) {
  if (!raw) return "-";
  const dt = new Date(String(raw));
  if (!dt || Number.isNaN(dt.getTime())) return "-";
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

function pushAdminServerHistory(payload) {
  const ts = payload.timestamp || new Date().toISOString();
  adminServerHistory.push({
    ts,
    cpu: Number(payload?.cpu?.usage_percent || 0),
    mem: Number(payload?.memory?.usage_percent || 0),
    disk: Number(payload?.disk?.usage_percent || 0),
    rx: Number(payload?.network?.rx_bytes_per_sec || 0),
    tx: Number(payload?.network?.tx_bytes_per_sec || 0),
  });
  if (adminServerHistory.length > 60) {
    adminServerHistory = adminServerHistory.slice(-60);
  }
}

function renderAdminServerChart(hostId, labels, series, { yMax = null, valueFormatter } = {}) {
  const host = document.getElementById(hostId);
  if (!host) return;
  if (!labels.length || !series.length) {
    host.innerHTML = `<div class="hint">${aTr("Нет данных", "No data")}</div>`;
    return;
  }
  const canUseEcharts = Boolean(
    typeof window !== "undefined"
    && window.echarts
    && typeof window.echarts.init === "function"
    && host instanceof HTMLElement
  );
  if (!canUseEcharts) {
    host.innerHTML = `<div class="hint">${aTr("Графики доступны при загрузке ECharts.", "Charts require ECharts.")}</div>`;
    return;
  }
  let chart = null;
  try {
    chart = window.echarts.getInstanceByDom(host);
  } catch (_) {
    chart = null;
  }
  if (!chart) {
    chart = window.echarts.init(host, null, { renderer: "canvas" });
  }
  chart.setOption(
    {
      animationDuration: 320,
      grid: { top: 12, right: 16, bottom: 24, left: 46 },
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(17,31,58,0.92)",
        borderWidth: 0,
        textStyle: { color: "#eff6ff" },
        valueFormatter: valueFormatter || undefined,
      },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: labels,
        axisLine: { lineStyle: { color: "rgba(97,122,156,0.35)" } },
        axisTick: { show: false },
        axisLabel: { color: "#6f86a7", fontSize: 10 },
      },
      yAxis: {
        type: "value",
        min: 0,
        max: yMax || undefined,
        splitLine: { lineStyle: { color: "rgba(95,121,162,0.17)" } },
        axisLabel: { color: "#6f86a7", fontSize: 10 },
      },
      series: series.map((item) => ({
        name: item.name,
        type: "line",
        smooth: true,
        showSymbol: false,
        data: item.values,
        lineStyle: { width: 2.4, color: item.color },
        itemStyle: { color: item.color },
      })),
    },
    true
  );
  try {
    chart.resize();
  } catch (_) {}
}

function renderAdminServerMetrics() {
  const meta = document.getElementById("adminServerMeta");
  const uptime = document.getElementById("adminServerUptime");
  const kpis = document.getElementById("adminServerKpis");
  const table = document.getElementById("adminServerTable");
  if (!meta || !uptime || !kpis || !table) return;

  const payload = adminServerMetrics && typeof adminServerMetrics === "object" ? adminServerMetrics : null;
  if (!payload) {
    meta.textContent = aTr("Метрики недоступны.", "Metrics unavailable.");
    uptime.textContent = "-";
    kpis.innerHTML = "";
    table.innerHTML = `<tr><td>${escapeHtml(aTr("Нет данных по серверу.", "No server data."))}</td></tr>`;
    return;
  }

  const cpu = payload.cpu || {};
  const memory = payload.memory || {};
  const disk = payload.disk || {};
  const network = payload.network || {};
  const marketCache = payload.market_cache || {};
  const perf = payload.performance || {};
  const apiPerf = perf.api || {};
  const sqlPerf = perf.sql || {};
  const queue = payload.task_queue || {};
  const ts = formatDateTime(payload.timestamp || "");
  meta.textContent = `${aTr("Обновлено", "Updated")}: ${ts}`;
  uptime.textContent = `${aTr("Uptime", "Uptime")}: ${formatAdminDuration(payload.uptime_seconds || 0)}`;
  pushAdminServerHistory(payload);

  const blocks = [
    [aTr("CPU", "CPU"), `${Number(cpu.usage_percent || 0).toFixed(1)}%`],
    [aTr("RAM", "RAM"), `${Number(memory.usage_percent || 0).toFixed(1)}%`],
    [aTr("Диск /", "Disk /"), `${Number(disk.usage_percent || 0).toFixed(1)}%`],
    [aTr("RX скорость", "RX speed"), `${formatAdminBytes(network.rx_bytes_per_sec || 0)}/s`],
    [aTr("TX скорость", "TX speed"), `${formatAdminBytes(network.tx_bytes_per_sec || 0)}/s`],
    [aTr("Кэш попадания", "Cache hits"), Number(marketCache.hits || 0).toLocaleString()],
    [aTr("Сохранено API", "Saved API"), Number(marketCache.api_calls_saved || 0).toLocaleString()],
    [aTr("API p95", "API p95"), `${Number(apiPerf.p95_ms || 0).toFixed(1)} ms`],
    [aTr("API p99", "API p99"), `${Number(apiPerf.p99_ms || 0).toFixed(1)} ms`],
    [aTr("SQL p95", "SQL p95"), `${Number(sqlPerf.p95_ms || 0).toFixed(1)} ms`],
    [aTr("Очередь задач", "Task queue"), Number(queue.depth || 0).toLocaleString()],
  ];
  kpis.innerHTML = blocks.map(([name, value]) => `
    <article class="kpi">
      <div class="kpi-head"><strong>${escapeHtml(String(value || "-"))}</strong><span>${escapeHtml(String(name || "-"))}</span></div>
    </article>
  `).join("");

  const topApiSlow = Array.isArray(apiPerf.top_slowest) && apiPerf.top_slowest.length
    ? String(apiPerf.top_slowest[0]?.key || "-")
    : "-";
  const topSqlSlow = Array.isArray(sqlPerf.top_slowest) && sqlPerf.top_slowest.length
    ? String(sqlPerf.top_slowest[0]?.key || "-")
    : "-";

  table.innerHTML = `
    <tr><td>${escapeHtml(aTr("CPU ядра", "CPU cores"))}</td><td>${escapeHtml(String(cpu.cores || 1))}</td></tr>
    <tr><td>${escapeHtml(aTr("Load average", "Load average"))}</td><td>${escapeHtml(`${cpu.load_avg_1m ?? 0} / ${cpu.load_avg_5m ?? 0} / ${cpu.load_avg_15m ?? 0}`)}</td></tr>
    <tr><td>${escapeHtml(aTr("Память занято", "Memory used"))}</td><td>${escapeHtml(`${formatAdminBytes(memory.used_bytes || 0)} / ${formatAdminBytes(memory.total_bytes || 0)}`)}</td></tr>
    <tr><td>${escapeHtml(aTr("Swap занято", "Swap used"))}</td><td>${escapeHtml(`${formatAdminBytes(memory.swap_used_bytes || 0)} / ${formatAdminBytes(memory.swap_total_bytes || 0)}`)}</td></tr>
    <tr><td>${escapeHtml(aTr("Диск занято", "Disk used"))}</td><td>${escapeHtml(`${formatAdminBytes(disk.used_bytes || 0)} / ${formatAdminBytes(disk.total_bytes || 0)}`)}</td></tr>
    <tr><td>${escapeHtml(aTr("Сеть RX/TX всего", "Network RX/TX total"))}</td><td>${escapeHtml(`${formatAdminBytes(network.rx_bytes_total || 0)} / ${formatAdminBytes(network.tx_bytes_total || 0)}`)}</td></tr>
    <tr><td>${escapeHtml(aTr("Кэш записей", "Cache entries"))}</td><td>${escapeHtml(Number(marketCache.entries || 0).toLocaleString())}</td></tr>
    <tr><td>${escapeHtml(aTr("Кэш обновлений", "Cache refreshes"))}</td><td>${escapeHtml(Number(marketCache.refreshes || 0).toLocaleString())}</td></tr>
    <tr><td>${escapeHtml(aTr("Кэш просрочено", "Cache expired"))}</td><td>${escapeHtml(Number(marketCache.expired || 0).toLocaleString())}</td></tr>
    <tr><td>${escapeHtml(aTr("API запросов (15м)", "API requests (15m)"))}</td><td>${escapeHtml(Number(apiPerf.count || 0).toLocaleString())}</td></tr>
    <tr><td>${escapeHtml(aTr("SQL запросов (15м)", "SQL queries (15m)"))}</td><td>${escapeHtml(Number(sqlPerf.count || 0).toLocaleString())}</td></tr>
    <tr><td>${escapeHtml(aTr("API p95 / p99 (мс)", "API p95 / p99 (ms)"))}</td><td>${escapeHtml(`${Number(apiPerf.p95_ms || 0).toFixed(1)} / ${Number(apiPerf.p99_ms || 0).toFixed(1)}`)}</td></tr>
    <tr><td>${escapeHtml(aTr("SQL p95 / p99 (мс)", "SQL p95 / p99 (ms)"))}</td><td>${escapeHtml(`${Number(sqlPerf.p95_ms || 0).toFixed(1)} / ${Number(sqlPerf.p99_ms || 0).toFixed(1)}`)}</td></tr>
    <tr><td>${escapeHtml(aTr("Медленный API", "Slow API"))}</td><td>${escapeHtml(topApiSlow)}</td></tr>
    <tr><td>${escapeHtml(aTr("Медленный SQL", "Slow SQL"))}</td><td>${escapeHtml(topSqlSlow)}</td></tr>
    <tr><td>${escapeHtml(aTr("Очередь Redis", "Redis queue"))}</td><td>${escapeHtml(`${queue.available ? "online" : "offline"} • depth=${Number(queue.depth || 0)}`)}</td></tr>
  `;

  const labels = adminServerHistory.map((row) => formatAdminTimeShort(row.ts));
  renderAdminServerChart("adminServerChartCpu", labels, [
    { name: "CPU %", values: adminServerHistory.map((row) => row.cpu), color: "#2ec5ff" },
  ], { yMax: 100 });
  renderAdminServerChart("adminServerChartMem", labels, [
    { name: "RAM %", values: adminServerHistory.map((row) => row.mem), color: "#7c5cff" },
  ], { yMax: 100 });
  renderAdminServerChart("adminServerChartDisk", labels, [
    { name: "Disk %", values: adminServerHistory.map((row) => row.disk), color: "#ffb347" },
  ], { yMax: 100 });
  renderAdminServerChart("adminServerChartNet", labels, [
    { name: "RX", values: adminServerHistory.map((row) => row.rx), color: "#34d9a3" },
    { name: "TX", values: adminServerHistory.map((row) => row.tx), color: "#ff6b6b" },
  ], { valueFormatter: (val) => formatAdminBytes(val) });
}

async function loadAdminServerMetrics(opts = {}) {
  const silent = Boolean(opts?.silent);
  const data = await adminRequest("/api/admin/server/metrics", { headers: adminHeaders() }).catch((e) => {
    if (!silent) alert(e.message);
    return null;
  });
  if (!data) return;
  adminServerMetrics = data;
  renderAdminServerMetrics();
}

function openAdminAuditDetails(row) {
  const modal = document.getElementById("adminAuditDetailsModal");
  const title = document.getElementById("adminAuditDetailsTitle");
  const meta = document.getElementById("adminAuditDetailsMeta");
  const grid = document.getElementById("adminAuditDetailsGrid");
  const raw = document.getElementById("adminAuditDetailsRaw");
  if (!modal || !title || !meta || !raw || !grid) return;
  const actionLabel = humanAuditAction(row?.action || "");
  const moduleLabel = humanAuditModule(row?.module_code || "");
  const actorEmail = String(row?.actor_email || "").trim();
  const actorMemberId = Number(row?.actor_member_id || 0);
  title.textContent = `${actionLabel} • ${moduleLabel}`;
  meta.textContent = `${aTr("Время", "Time")}: ${formatDateTime(row?.created_at)} • ${aTr("Актер", "Actor")}: ${actorEmail || "-"}${actorMemberId > 0 ? ` (#${actorMemberId})` : ""} • ID: ${row?.id ?? "-"}`;
  const entityType = String(row?.entity_type || "").trim();
  const entityId = String(row?.entity_id || "").trim();
  const entityLabel = (entityType || entityId) ? `${entityType || "-"}:${entityId || "-"}` : "-";
  const parsed = parseAuditDetails(row?.details || "");
  const baseRows = [
    [aTr("Актер", "Actor"), actorEmail || "-"],
    [aTr("Роль", "Role"), row?.actor_is_owner ? aTr("Владелец", "Owner") : aTr("Сотрудник", "Employee")],
    [aTr("Member ID", "Member ID"), actorMemberId > 0 ? `#${actorMemberId}` : "-"],
    [aTr("Модуль", "Module"), moduleLabel || "-"],
    [aTr("Действие", "Action"), actionLabel || "-"],
    [aTr("Статус", "Status"), String(row?.status || "ok")],
    [aTr("Entity", "Entity"), entityLabel],
    [aTr("IP", "IP"), String(row?.ip || "-")],
    [aTr("User-Agent", "User-Agent"), String(row?.user_agent || "-")],
  ];
  const detailRows = parsed.kv.length
    ? parsed.kv.map(([k, v]) => [humanAuditDetailKey(k), v])
    : (parsed.summary ? [[aTr("Детали", "Details"), parsed.summary]] : []);
  grid.innerHTML = [...baseRows, ...detailRows]
    .filter(([, v]) => String(v || "").trim())
    .map(([k, v]) => `<div class="row"><b>${escapeHtml(String(k))}</b><span>${escapeHtml(String(v))}</span></div>`)
    .join("");
  const pretty = {
    ...row,
    details_json: (() => {
      try {
        return JSON.parse(String(row?.details || ""));
      } catch (_) {
        return null;
      }
    })(),
  };
  raw.textContent = JSON.stringify(pretty, null, 2);
  modal.classList.remove("hidden");
}

function adminCloseAuditDetailsModal(evt) {
  const modal = document.getElementById("adminAuditDetailsModal");
  if (!modal) return;
  if (evt && evt.target && evt.target !== modal) return;
  modal.classList.add("hidden");
}

function parseAuditDetails(raw) {
  const text = String(raw || "").trim();
  if (!text) return { summary: "-", kv: [] };

  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object") {
      const kv = Object.entries(parsed).slice(0, 10).map(([k, v]) => [String(k), typeof v === "string" ? v : JSON.stringify(v)]);
      return { summary: kv.map(([k, v]) => `${k}=${v}`).join("; "), kv };
    }
  } catch (_) {
    // not JSON
  }

  const chunks = text.split(";").map((x) => x.trim()).filter(Boolean);
  const kv = [];
  for (const chunk of chunks.slice(0, 12)) {
    const idx = chunk.indexOf("=");
    if (idx > 0) {
      kv.push([chunk.slice(0, idx).trim(), chunk.slice(idx + 1).trim()]);
    }
  }
  return { summary: text, kv };
}

function renderAdminAuditTable() {
  const tbody = document.getElementById("adminAuditTable");
  const meta = document.getElementById("adminAuditMeta");
  if (!tbody) return;
  tbody.innerHTML = "";
  const rows = Array.isArray(adminAuditRows) ? adminAuditRows : [];

  if (meta) {
    const uniqueActions = new Set(rows.map((row) => String(row.action || "").trim()).filter(Boolean));
    const uniqueModules = new Set(rows.map((row) => String(row.module_code || "").trim()).filter(Boolean));
    const uniqueActors = new Set(rows.map((row) => String(row.actor_email || "").trim()).filter(Boolean));
    meta.textContent = aTr(
      `Показано: ${rows.length} из ${adminAuditTotal}. Уникальных действий: ${uniqueActions.size}. Модулей: ${uniqueModules.size}. Актеров: ${uniqueActors.size}.`,
      `Showing: ${rows.length} of ${adminAuditTotal}. Unique actions: ${uniqueActions.size}. Modules: ${uniqueModules.size}. Actors: ${uniqueActors.size}.`
    );
  }

  if (!rows.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="8">${aTr("Записи аудита не найдены.", "No audit records.")}</td>`;
    tbody.appendChild(tr);
    return;
  }

  const userMap = new Map(adminUsers.map((u) => [Number(u.id), u.email]));
  for (const row of rows) {
    const tr = document.createElement("tr");
    const parsed = parseAuditDetails(row.details);
    const userEmail = userMap.get(Number(row.user_id)) || "";
    const fallbackUserLabel = row.user_id ? `#${row.user_id}${userEmail ? ` ${userEmail}` : ""}` : "-";
    const actorEmail = String(row.actor_email || "").trim();
    const actorMemberId = Number(row.actor_member_id || 0);
    const actorRole = row.actor_is_owner ? aTr("owner", "owner") : aTr("employee", "employee");
    let actorLabel = actorEmail || fallbackUserLabel;
    if (!row.actor_is_owner && actorMemberId > 0) {
      const ownerHint = userEmail && actorEmail.toLowerCase() !== userEmail.toLowerCase()
        ? ` (${userEmail})`
        : (row.user_id ? ` (owner #${row.user_id})` : "");
      actorLabel = `${actorLabel}${ownerHint}`;
    }
    const actorMeta = actorMemberId > 0
      ? `${aTr("member", "member")} #${actorMemberId} • ${actorRole}`
      : (row.user_id ? `user #${row.user_id}` : "-");
    const moduleLabel = humanAuditModule(row.module_code);
    const statusLabel = String(row.status || "").trim() || "ok";
    const actionLabel = humanAuditAction(row.action);
    const entityType = String(row.entity_type || "").trim();
    const entityId = String(row.entity_id || "").trim();
    const entityLabel = (entityType || entityId) ? `${entityType || "-"}:${entityId || "-"}` : "-";
    const detailHtml = parsed.kv.length
      ? `<div class="admin-audit-kv">${parsed.kv.map(([k, v]) => `<span><b>${escapeHtml(humanAuditDetailKey(k))}</b>: ${escapeHtml(v)}</span>`).join("")}
          ${row.ip ? `<span><b>ip</b>: ${escapeHtml(String(row.ip))}</span>` : ""}
          ${row.user_agent ? `<span><b>ua</b>: ${escapeHtml(String(row.user_agent))}</span>` : ""}
        </div>`
      : `<div class="admin-audit-kv"><span>${escapeHtml(parsed.summary)}</span>${row.ip ? `<span><b>ip</b>: ${escapeHtml(String(row.ip))}</span>` : ""}${row.user_agent ? `<span><b>ua</b>: ${escapeHtml(String(row.user_agent))}</span>` : ""}</div>`;

    tr.innerHTML = `
      <td>${row.id}</td>
      <td>${escapeHtml(formatDateTime(row.created_at))}</td>
      <td><div><b>${escapeHtml(actorLabel)}</b></div><div class="hint">${escapeHtml(actorMeta)}</div></td>
      <td><span class="admin-chip">${escapeHtml(moduleLabel)}</span></td>
      <td><span class="admin-chip">${escapeHtml(actionLabel)}</span></td>
      <td><span class="admin-chip">${escapeHtml(statusLabel)}</span></td>
      <td>${escapeHtml(entityLabel)}</td>
      <td><div class="admin-audit-row-detail">${detailHtml}<div class="actions"><button class="btn-secondary" type="button" data-audit-open="${Number(row.id || 0)}">${aTr("Открыть", "Open")}</button></div></div></td>
    `;
    tr.querySelector(`[data-audit-open="${Number(row.id || 0)}"]`)?.addEventListener("click", () => openAdminAuditDetails(row));
    tr.addEventListener("dblclick", () => openAdminAuditDetails(row));
    tbody.appendChild(tr);
  }
}

function renderAdminAuditPager() {
  const info = document.getElementById("adminAuditPageInfo");
  const prev = document.getElementById("adminAuditPrevBtn");
  const next = document.getElementById("adminAuditNextBtn");
  const safePages = Math.max(1, Number(adminAuditTotalPages || 1));
  const safePage = Math.min(safePages, Math.max(1, Number(adminAuditPage || 1)));
  if (info) {
    info.textContent = aTr(
      `Страница ${safePage} из ${safePages} • всего ${adminAuditTotal}`,
      `Page ${safePage} of ${safePages} • total ${adminAuditTotal}`
    );
  }
  if (prev) prev.disabled = safePage <= 1;
  if (next) next.disabled = safePage >= safePages;
}

function refreshAdminAuditFilterOptions(rows) {
  const actionEl = document.getElementById("adminAuditActionFilter");
  const moduleEl = document.getElementById("adminAuditModuleFilter");
  const actorEl = document.getElementById("adminAuditActorFilter");
  const memberEl = document.getElementById("adminAuditMemberFilter");
  if (!actionEl || !moduleEl || !actorEl || !memberEl) return;

  const safeRows = Array.isArray(rows) ? rows : [];
  const uniq = (items) => [...new Set(items.filter(Boolean))];
  const actions = uniq([
    ...Object.keys(AUDIT_ACTION_TITLES || {}),
    ...safeRows.map((row) => String(row.action || "").trim()),
  ]).sort();
  const modules = uniq([
    ...Object.keys(MODULE_TITLES || {}),
    ...Object.keys(AUDIT_MODULE_TITLES || {}),
    ...safeRows.map((row) => String(row.module_code || "").trim()),
  ]).sort();
  const actorEmails = uniq(safeRows.map((row) => String(row.actor_email || "").trim().toLowerCase())).sort();
  const memberIds = uniq(safeRows.map((row) => Number(row.actor_member_id || 0)).filter((x) => x > 0)).sort((a, b) => a - b);

  const currentAction = String(actionEl.value || "");
  const currentModule = String(moduleEl.value || "");
  const currentActor = String(actorEl.value || "");
  const currentMember = String(memberEl.value || "");

  actionEl.innerHTML = `<option value="">${aTr("Все действия", "All actions")}</option>` +
    actions.map((val) => `<option value="${escapeHtml(val)}">${escapeHtml(val)}</option>`).join("");
  if (currentAction && !actions.includes(currentAction)) {
    actionEl.insertAdjacentHTML("beforeend", `<option value="${escapeHtml(currentAction)}">${escapeHtml(currentAction)}</option>`);
  }
  actionEl.value = currentAction;

  moduleEl.innerHTML = `<option value="">${aTr("Все модули", "All modules")}</option>` +
    modules.map((val) => `<option value="${escapeHtml(val)}">${escapeHtml(humanAuditModule(val))}</option>`).join("");
  if (currentModule && !modules.includes(currentModule)) {
    moduleEl.insertAdjacentHTML("beforeend", `<option value="${escapeHtml(currentModule)}">${escapeHtml(currentModule)}</option>`);
  }
  moduleEl.value = currentModule;

  actorEl.innerHTML = `<option value="">${aTr("Все пользователи", "All actors")}</option>` +
    actorEmails.map((val) => `<option value="${escapeHtml(val)}">${escapeHtml(val)}</option>`).join("");
  if (currentActor && !actorEmails.includes(currentActor)) {
    actorEl.insertAdjacentHTML("beforeend", `<option value="${escapeHtml(currentActor)}">${escapeHtml(currentActor)}</option>`);
  }
  actorEl.value = currentActor;

  memberEl.innerHTML = `<option value="">${aTr("Все сотрудники", "All members")}</option>` +
    memberIds.map((val) => `<option value="${val}">#${val}</option>`).join("");
  if (currentMember && !memberIds.map((x) => String(x)).includes(currentMember)) {
    memberEl.insertAdjacentHTML("beforeend", `<option value="${escapeHtml(currentMember)}">#${escapeHtml(currentMember)}</option>`);
  }
  memberEl.value = currentMember;
}

async function loadAdminAudit(options = {}) {
  const resetPage = Boolean(options && options.resetPage);
  const pageSize = Number(document.getElementById("adminAuditLimit")?.value || adminAuditPageSize || 100);
  if (resetPage || pageSize !== adminAuditPageSize) {
    adminAuditPage = 1;
  }
  adminAuditPageSize = Math.max(50, Math.min(pageSize, 500));
  const action = String(document.getElementById("adminAuditActionFilter")?.value || "").trim();
  const moduleCode = String(document.getElementById("adminAuditModuleFilter")?.value || "").trim();
  const status = String(document.getElementById("adminAuditStatusFilter")?.value || "").trim();
  const dateFrom = String(document.getElementById("adminAuditDateFrom")?.value || "").trim();
  const dateTo = String(document.getElementById("adminAuditDateTo")?.value || "").trim();
  const textFilter = String(document.getElementById("adminAuditTextFilter")?.value || "").trim();
  const actorFilter = String(document.getElementById("adminAuditActorFilter")?.value || "").trim();
  const memberFilter = String(document.getElementById("adminAuditMemberFilter")?.value || "").trim();

  const qp = new URLSearchParams();
  qp.set("page_size", String(adminAuditPageSize));
  qp.set("page", String(Math.max(1, adminAuditPage)));
  if (action) qp.set("action", action);
  if (moduleCode) qp.set("module_code", moduleCode);
  if (status) qp.set("status", status);
  if (dateFrom) qp.set("date_from", dateFrom);
  if (dateTo) qp.set("date_to", dateTo);
  if (textFilter) qp.set("q", textFilter);
  if (actorFilter) qp.set("actor_email", actorFilter);
  if (/^\d+$/.test(memberFilter)) qp.set("actor_member_id", memberFilter);

  const data = await adminRequest(`/api/admin/audit?${qp.toString()}`, { headers: adminHeaders() }).catch((e) => {
    alert(e.message);
    return null;
  });
  if (!data) return;
  if (Array.isArray(data)) {
    adminAuditRows = data;
    adminAuditTotal = data.length;
    adminAuditTotalPages = data.length ? 1 : 0;
    adminAuditPage = 1;
  } else {
    adminAuditRows = Array.isArray(data.rows) ? data.rows : [];
    adminAuditTotal = Number(data.total || 0);
    adminAuditPage = Math.max(1, Number(data.page || 1));
    adminAuditPageSize = Math.max(50, Math.min(Number(data.page_size || adminAuditPageSize || 100), 500));
    adminAuditTotalPages = Math.max(0, Number(data.total_pages || 0));
  }
  const raw = document.getElementById("adminAuditView");
  if (raw) raw.textContent = JSON.stringify(data, null, 2);
  refreshAdminAuditFilterOptions(adminAuditRows);
  renderAdminAuditTable();
  renderAdminAuditPager();
}

async function loadAdminAuditReset() {
  await loadAdminAudit({ resetPage: true });
}

async function adminAuditPrevPage() {
  if (adminAuditPage <= 1) return;
  adminAuditPage -= 1;
  await loadAdminAudit();
}

async function adminAuditNextPage() {
  if (adminAuditTotalPages > 0 && adminAuditPage >= adminAuditTotalPages) return;
  adminAuditPage += 1;
  await loadAdminAudit();
}

function renderAdminNotificationSettings() {
  const cfg = normalizeAdminNotificationSettings(adminNotificationSettings);
  const desktopEl = document.getElementById("adminNotifDesktopEnabled");
  const chatEl = document.getElementById("adminNotifChatEnabled");
  const taskEl = document.getElementById("adminNotifTaskEnabled");
  const calEl = document.getElementById("adminNotifCalendarEnabled");
  const defaultEl = document.getElementById("adminNotifDefaultUrl");
  const chatUrlEl = document.getElementById("adminNotifChatUrl");
  const taskUrlEl = document.getElementById("adminNotifTaskUrl");
  const calUrlEl = document.getElementById("adminNotifCalendarUrl");
  const metaEl = document.getElementById("adminNotifSettingsMeta");
  if (desktopEl) desktopEl.checked = Boolean(cfg.desktop_enabled);
  if (chatEl) chatEl.checked = Boolean(cfg.chat_enabled);
  if (taskEl) taskEl.checked = Boolean(cfg.task_enabled);
  if (calEl) calEl.checked = Boolean(cfg.calendar_enabled);
  if (defaultEl) defaultEl.value = cfg.default_sound_url;
  if (chatUrlEl) chatUrlEl.value = cfg.chat_sound_url;
  if (taskUrlEl) taskUrlEl.value = cfg.task_sound_url;
  if (calUrlEl) calUrlEl.value = cfg.calendar_sound_url;
  if (metaEl) {
    const enabledCount = [cfg.chat_enabled, cfg.task_enabled, cfg.calendar_enabled].filter(Boolean).length;
    metaEl.textContent = aTr(`Каналов со звуком: ${enabledCount} из 3`, `Enabled sound channels: ${enabledCount} of 3`);
  }
}

async function adminLoadNotificationSettings() {
  const data = await adminRequest("/api/admin/notification-settings", { headers: adminHeaders() }).catch((e) => {
    alert(e.message);
    return null;
  });
  if (!data) return;
  adminNotificationSettings = normalizeAdminNotificationSettings(data);
  renderAdminNotificationSettings();
}

async function adminSaveNotificationSettings() {
  const payload = normalizeAdminNotificationSettings({
    desktop_enabled: Boolean(document.getElementById("adminNotifDesktopEnabled")?.checked),
    chat_enabled: Boolean(document.getElementById("adminNotifChatEnabled")?.checked),
    task_enabled: Boolean(document.getElementById("adminNotifTaskEnabled")?.checked),
    calendar_enabled: Boolean(document.getElementById("adminNotifCalendarEnabled")?.checked),
    default_sound_url: document.getElementById("adminNotifDefaultUrl")?.value || "",
    chat_sound_url: document.getElementById("adminNotifChatUrl")?.value || "",
    task_sound_url: document.getElementById("adminNotifTaskUrl")?.value || "",
    calendar_sound_url: document.getElementById("adminNotifCalendarUrl")?.value || "",
  });
  const data = await adminRequest("/api/admin/notification-settings", {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify(payload),
  }).catch((e) => {
    alert(e.message);
    return null;
  });
  if (!data) return;
  adminNotificationSettings = normalizeAdminNotificationSettings(data);
  renderAdminNotificationSettings();
  const metaEl = document.getElementById("adminNotifSettingsMeta");
  if (metaEl) metaEl.textContent = aTr("Настройки уведомлений сохранены.", "Notification settings saved.");
}

async function adminUploadNotificationSound(group) {
  const key = String(group || "").trim().toLowerCase();
  const inputId = {
    default: "adminNotifUploadDefault",
    chat: "adminNotifUploadChat",
    task: "adminNotifUploadTask",
    calendar: "adminNotifUploadCalendar",
  }[key];
  const input = inputId ? document.getElementById(inputId) : null;
  const file = input?.files?.[0];
  if (!file) {
    alert(aTr("Сначала выберите аудио файл.", "Select an audio file first."));
    return;
  }
  const form = new FormData();
  form.append("group", key);
  form.append("file", file);
  const headers = { "Authorization": `Bearer ${adminToken}` };
  const data = await adminRequest("/api/admin/notification-settings/upload", {
    method: "POST",
    headers,
    body: form,
  }).catch((e) => {
    alert(e.message);
    return null;
  });
  if (!data) return;
  const url = String(data.url || "").trim();
  if (key === "default") {
    const el = document.getElementById("adminNotifDefaultUrl");
    if (el) el.value = url;
  } else if (key === "chat") {
    const el = document.getElementById("adminNotifChatUrl");
    if (el) el.value = url;
  } else if (key === "task") {
    const el = document.getElementById("adminNotifTaskUrl");
    if (el) el.value = url;
  } else if (key === "calendar") {
    const el = document.getElementById("adminNotifCalendarUrl");
    if (el) el.value = url;
  }
  if (input) input.value = "";
  await adminSaveNotificationSettings();
}

function toDateTimeLocalValue(raw) {
  const text = String(raw || "").trim();
  if (!text) return "";
  const dt = new Date(text);
  if (Number.isNaN(dt.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

function adminResetAnnouncementForm() {
  adminAnnouncementEditId = 0;
  const titleEl = document.getElementById("adminAnnouncementTitle");
  const bodyEl = document.getElementById("adminAnnouncementBody");
  const startsEl = document.getElementById("adminAnnouncementStartsAt");
  const endsEl = document.getElementById("adminAnnouncementEndsAt");
  const targetEl = document.getElementById("adminAnnouncementTargetUser");
  const activeEl = document.getElementById("adminAnnouncementActive");
  const metaEl = document.getElementById("adminAnnouncementMeta");
  if (titleEl) titleEl.value = "";
  if (bodyEl) bodyEl.value = "";
  if (startsEl) startsEl.value = toDateTimeLocalValue(new Date().toISOString());
  if (endsEl) endsEl.value = "";
  if (targetEl) {
    for (const opt of targetEl.options) opt.selected = false;
    if (targetEl.options.length) targetEl.options[0].selected = true;
  }
  if (activeEl) activeEl.checked = true;
  if (metaEl) metaEl.textContent = aTr("Новое объявление", "New announcement");
}

function adminGetAnnouncementTargetUserIds() {
  const targetEl = document.getElementById("adminAnnouncementTargetUser");
  if (!targetEl) return [];
  const source = targetEl.multiple
    ? Array.from(targetEl.selectedOptions || []).map((opt) => Number(opt?.value || 0))
    : [Number(targetEl.value || 0)];
  const ids = [...new Set(source.map((x) => Number(x || 0)).filter((x) => Number.isFinite(x) && x > 0))];
  return ids;
}

function adminSetAnnouncementTargetUserIds(userIds = []) {
  const targetEl = document.getElementById("adminAnnouncementTargetUser");
  if (!targetEl) return;
  const safeIds = [...new Set((Array.isArray(userIds) ? userIds : []).map((x) => Number(x || 0)).filter((x) => Number.isFinite(x) && x > 0))];
  for (const opt of targetEl.options) {
    const value = Number(opt?.value || 0);
    opt.selected = safeIds.length ? (value > 0 && safeIds.includes(value)) : (value === 0);
  }
}

function renderAdminAnnouncements() {
  const tbody = document.getElementById("adminAnnouncementsTable");
  if (!tbody) return;
  const rows = Array.isArray(adminAnnouncements) ? adminAnnouncements : [];
  tbody.innerHTML = "";
  if (!rows.length) {
    const trEl = document.createElement("tr");
    trEl.innerHTML = `<td colspan="6">${escapeHtml(aTr("Объявлений пока нет.", "No announcements yet."))}</td>`;
    tbody.appendChild(trEl);
    if (!adminAnnouncementEditId) adminResetAnnouncementForm();
    return;
  }
  for (const row of rows) {
    const id = Number(row?.id || 0);
    const trEl = document.createElement("tr");
    const startsAt = formatDateTime(row?.starts_at);
    const endsAt = row?.ends_at ? formatDateTime(row?.ends_at) : "—";
    const title = String(row?.title || "").trim() || "-";
    const userIds = Array.isArray(row?.user_ids)
      ? row.user_ids.map((x) => Number(x || 0)).filter((x) => Number.isFinite(x) && x > 0)
      : [];
    const userId = Number(row?.user_id || 0);
    const targetLabel = userIds.length > 1
      ? aTr(`${userIds.length} пользователей`, `${userIds.length} users`)
      : (userIds.length === 1 ? `#${userIds[0]}` : (userId > 0 ? `#${userId}` : aTr("Все", "All")));
    const status = row?.is_active ? aTr("Активно", "Active") : aTr("Отключено", "Disabled");
    trEl.innerHTML = `
      <td>${escapeHtml(String(id || "-"))}</td>
      <td>${escapeHtml(`${startsAt} → ${endsAt}`)}</td>
      <td>${escapeHtml(targetLabel)}</td>
      <td>${escapeHtml(title)}</td>
      <td>${escapeHtml(status)}</td>
      <td class="actions">
        <button class="btn-secondary" type="button" data-ann-edit="${escapeHtml(String(id))}">${escapeHtml(aTr("Изменить", "Edit"))}</button>
        <button class="btn-danger" type="button" data-ann-del="${escapeHtml(String(id))}">${escapeHtml(aTr("Отключить", "Disable"))}</button>
      </td>
    `;
    tbody.appendChild(trEl);
  }
  tbody.querySelectorAll("[data-ann-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = Number(btn.getAttribute("data-ann-edit") || 0);
      const row = adminAnnouncements.find((x) => Number(x?.id || 0) === id);
      if (!row) return;
      adminAnnouncementEditId = id;
      const titleEl = document.getElementById("adminAnnouncementTitle");
      const bodyEl = document.getElementById("adminAnnouncementBody");
      const startsEl = document.getElementById("adminAnnouncementStartsAt");
      const endsEl = document.getElementById("adminAnnouncementEndsAt");
      const activeEl = document.getElementById("adminAnnouncementActive");
      const metaEl = document.getElementById("adminAnnouncementMeta");
      if (titleEl) titleEl.value = String(row?.title || "");
      if (bodyEl) bodyEl.value = String(row?.body || "");
      if (startsEl) startsEl.value = toDateTimeLocalValue(row?.starts_at || "");
      if (endsEl) endsEl.value = toDateTimeLocalValue(row?.ends_at || "");
      const rowTargets = Array.isArray(row?.user_ids)
        ? row.user_ids.map((x) => Number(x || 0)).filter((x) => Number.isFinite(x) && x > 0)
        : [];
      if (!rowTargets.length && Number(row?.user_id || 0) > 0) rowTargets.push(Number(row.user_id));
      adminSetAnnouncementTargetUserIds(rowTargets);
      if (activeEl) activeEl.checked = Boolean(row?.is_active);
      if (metaEl) metaEl.textContent = aTr(`Редактирование #${id}`, `Editing #${id}`);
    });
  });
  tbody.querySelectorAll("[data-ann-del]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = Number(btn.getAttribute("data-ann-del") || 0);
      if (id <= 0) return;
      if (!confirm(aTr(`Отключить объявление #${id}?`, `Disable announcement #${id}?`))) return;
      const ok = await adminRequest(`/api/admin/announcements/${id}`, {
        method: "DELETE",
        headers: adminHeaders(),
      }).catch((e) => {
        alert(e.message);
        return null;
      });
      if (!ok) return;
      await adminLoadAnnouncements();
    });
  });
  if (!adminAnnouncementEditId) adminResetAnnouncementForm();
}

async function adminLoadAnnouncements() {
  const rows = await adminRequest("/api/admin/announcements", { headers: adminHeaders() }).catch((e) => {
    alert(e.message);
    return null;
  });
  if (!rows) return;
  adminAnnouncements = Array.isArray(rows) ? rows : [];
  renderAdminAnnouncements();
}

async function adminSaveAnnouncement() {
  const title = String(document.getElementById("adminAnnouncementTitle")?.value || "").trim();
  const body = String(document.getElementById("adminAnnouncementBody")?.value || "").trim();
  const startsAtRaw = String(document.getElementById("adminAnnouncementStartsAt")?.value || "").trim();
  const endsAtRaw = String(document.getElementById("adminAnnouncementEndsAt")?.value || "").trim();
  const targetUserIds = adminGetAnnouncementTargetUserIds();
  const isActive = Boolean(document.getElementById("adminAnnouncementActive")?.checked);
  if (!title) {
    alert(aTr("Введите заголовок объявления.", "Enter announcement title."));
    return;
  }
  if (!startsAtRaw) {
    alert(aTr("Укажите дату и время публикации.", "Specify publish date and time."));
    return;
  }
  const startsAtIso = new Date(startsAtRaw).toISOString();
  const endsAtIso = endsAtRaw ? new Date(endsAtRaw).toISOString() : "";
  const payload = {
    title,
    body,
    starts_at: startsAtIso,
    ends_at: endsAtIso || null,
    is_active: isActive,
    user_id: targetUserIds.length === 1 ? targetUserIds[0] : null,
    user_ids: targetUserIds,
  };
  const url = adminAnnouncementEditId > 0
    ? `/api/admin/announcements/${adminAnnouncementEditId}`
    : "/api/admin/announcements";
  const method = adminAnnouncementEditId > 0 ? "PUT" : "POST";
  const saved = await adminRequest(url, {
    method,
    headers: adminHeaders(),
    body: JSON.stringify(payload),
  }).catch((e) => {
    alert(e.message);
    return null;
  });
  if (!saved) return;
  adminAnnouncementEditId = 0;
  await adminLoadAnnouncements();
}

function renderAdminAppearance() {
  const summaryEl = document.getElementById("adminAppearanceSummary");
  const summaryTable = document.getElementById("adminAppearanceSummaryTable");
  const enabledEl = document.getElementById("adminThemeChoiceEnabled");
  const forceEl = document.getElementById("adminForceThemeEnabled");
  const defaultEl = document.getElementById("adminDefaultThemeSelect");
  const allowedEl = document.getElementById("adminAllowedThemes");
  if (!enabledEl || !forceEl || !defaultEl || !allowedEl) return;

  const payload = adminUiSettings && typeof adminUiSettings === "object"
    ? adminUiSettings
    : { theme_choice_enabled: true, force_theme: false, default_theme: "classic", allowed_themes: [...UI_THEMES] };
  const allowed = Array.isArray(payload.allowed_themes)
    ? payload.allowed_themes.filter((x) => UI_THEMES.includes(String(x)))
    : [...UI_THEMES];

  enabledEl.checked = Boolean(payload.theme_choice_enabled);
  forceEl.checked = Boolean(payload.force_theme);
  defaultEl.innerHTML = UI_THEMES.map((code) => `<option value="${code}">${escapeHtml(THEME_LABELS[code]?.[adminLang] || code)}</option>`).join("");
  defaultEl.value = UI_THEMES.includes(payload.default_theme) ? payload.default_theme : "classic";

  allowedEl.innerHTML = UI_THEMES.map((code) => {
    const checked = allowed.includes(code) ? "checked" : "";
    const label = THEME_LABELS[code]?.[adminLang] || code;
    return `<label class="check"><input type="checkbox" data-theme-code="${code}" ${checked} /> ${escapeHtml(label)} (${code})</label>`;
  }).join("");

  if (summaryEl) {
    const forceLabel = forceEl.checked
      ? aTr("включено", "enabled")
      : aTr("выключено", "disabled");
    summaryEl.textContent = aTr(
      `Тема: ${defaultEl.value || "classic"} • Принудительно: ${forceLabel}`,
      `Theme: ${defaultEl.value || "classic"} • Forced: ${forceLabel}`
    );
  }
  if (summaryTable) {
    const selectedTheme = String(defaultEl.value || "classic");
    const allowedCount = allowed.length;
    summaryTable.innerHTML = `
      <tr><td>${escapeHtml(aTr("Выбор темы", "Theme choice"))}</td><td>${enabledEl.checked ? escapeHtml(aTr("Разрешен", "Enabled")) : escapeHtml(aTr("Отключен", "Disabled"))}</td></tr>
      <tr><td>${escapeHtml(aTr("Принудительная тема", "Forced theme"))}</td><td>${forceEl.checked ? escapeHtml(aTr("Да", "Yes")) : escapeHtml(aTr("Нет", "No"))}</td></tr>
      <tr><td>${escapeHtml(aTr("Тема по умолчанию", "Default theme"))}</td><td>${escapeHtml(THEME_LABELS[selectedTheme]?.[adminLang] || selectedTheme)}</td></tr>
      <tr><td>${escapeHtml(aTr("Разрешено тем", "Allowed themes"))}</td><td>${escapeHtml(String(allowedCount))}</td></tr>
    `;
  }
}

async function adminSaveUiSettings() {
  const enabled = Boolean(document.getElementById("adminThemeChoiceEnabled")?.checked);
  const forceTheme = Boolean(document.getElementById("adminForceThemeEnabled")?.checked);
  const defaultTheme = document.getElementById("adminDefaultThemeSelect")?.value || "classic";
  const allowed = [...document.querySelectorAll("#adminAllowedThemes [data-theme-code]")]
    .filter((el) => el.checked)
    .map((el) => el.dataset.themeCode)
    .filter((x) => UI_THEMES.includes(String(x)));
  const payload = {
    theme_choice_enabled: enabled,
    force_theme: forceTheme,
    default_theme: defaultTheme,
    allowed_themes: allowed,
  };
  const data = await adminRequest("/api/admin/ui/settings", {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify(payload),
  }).catch((e) => {
    alert(e.message);
    return null;
  });
  if (!data) return;
  adminUiSettings = data;
  renderAdminAppearance();
  adminCloseAppearanceModal();
  alert(aTr("Оформление сохранено", "Appearance saved"));
}

document.getElementById("adminModuleUserSelect")?.addEventListener("change", () => renderAdminModulesTable());
document.getElementById("adminAiUserSelect")?.addEventListener("change", () => {
  adminSelectedUserAiState = null;
  loadAdminUserAi().catch(() => null);
});
document.getElementById("adminAiUserMode")?.addEventListener("change", () => renderAdminAiTab(true));
document.getElementById("adminTeamModalSaveBtn")?.addEventListener("click", () => {
  adminSaveTeamMemberFromModal().catch(() => null);
});
document.getElementById("adminTeamModalDeleteBtn")?.addEventListener("click", () => {
  adminDeleteTeamMemberFromModal().catch(() => null);
});
document.getElementById("adminAiGlobalSaveBtn")?.addEventListener("click", () => {
  adminAddGlobalAiService().catch(() => null);
});
document.getElementById("adminAiUserSaveBtn")?.addEventListener("click", () => {
  adminAddUserAiService().catch(() => null);
});
["adminEmail", "adminPassword"].forEach((id) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    adminLogin();
  });
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  adminCloseUserEditModal();
  adminCloseTeamMemberModal();
  adminCloseAiGlobalModal();
  adminCloseAiUserModal();
  adminCloseAppearanceModal();
  adminCloseAuditDetailsModal();
});
window.showAdminTab = showAdminTab;
window.adminLogin = adminLogin;
window.adminLogout = adminLogout;
window.loadAdminAll = loadAdminAll;
window.loadAdminAudit = loadAdminAudit;
window.loadAdminAuditReset = loadAdminAuditReset;
window.adminAuditPrevPage = adminAuditPrevPage;
window.adminAuditNextPage = adminAuditNextPage;
window.adminSaveUiSettings = adminSaveUiSettings;
window.adminSaveNotificationSettings = adminSaveNotificationSettings;
window.adminLoadNotificationSettings = adminLoadNotificationSettings;
window.adminUploadNotificationSound = adminUploadNotificationSound;
window.adminSaveAnnouncement = adminSaveAnnouncement;
window.adminResetAnnouncementForm = adminResetAnnouncementForm;
window.adminLoadAnnouncements = adminLoadAnnouncements;
window.loadAdminServerMetrics = loadAdminServerMetrics;
window.adminOpenAppearanceModal = adminOpenAppearanceModal;
window.adminCloseAppearanceModal = adminCloseAppearanceModal;
window.adminSaveCredential2 = adminSaveCredential2;
window.adminSaveAiGlobalDefault = adminSaveAiGlobalDefault;
window.adminAddGlobalAiService = adminAddGlobalAiService;
window.adminOpenAiGlobalModal = adminOpenAiGlobalModal;
window.adminCloseAiGlobalModal = adminCloseAiGlobalModal;
window.adminSaveUserAiSelection = adminSaveUserAiSelection;
window.adminAddUserAiService = adminAddUserAiService;
window.adminOpenAiUserModal = adminOpenAiUserModal;
window.adminCloseAiUserModal = adminCloseAiUserModal;
window.adminChangeLanguage = adminChangeLanguage;
window.adminChangeTheme = adminChangeTheme;
window.adminOpenUserEditModal = adminOpenUserEditModal;
window.adminCloseUserEditModal = adminCloseUserEditModal;
window.adminCloseTeamMemberModal = adminCloseTeamMemberModal;
window.adminCloseAuditDetailsModal = adminCloseAuditDetailsModal;
window.adminToggleMobileNav = adminToggleMobileNav;
window.adminCloseMobileNav = adminCloseMobileNav;

applyAdminTheme(adminTheme);
applyAdminLanguage();
initAdminRemember();
ensureAdminAuth();
