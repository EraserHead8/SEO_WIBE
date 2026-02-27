let adminToken = localStorage.getItem("admin_token") || "";
let adminMe = null;
let adminUsers = [];
let adminModules = [];
let adminCredentials = [];
let adminUiSettings = null;
let adminAuditRows = [];
const adminUserProfileCache = new Map();

const UI_THEMES = ["classic", "dark", "light", "newyear", "summer", "autumn", "winter", "spring", "japan", "greenland"];
const BILLING_PLAN_CODES = ["starter", "pro", "business"];

let adminLang = (localStorage.getItem("admin_ui_lang") || "ru").toLowerCase() === "en" ? "en" : "ru";
let adminTheme = String(localStorage.getItem("admin_ui_theme") || "classic").toLowerCase();
if (!UI_THEMES.includes(adminTheme)) adminTheme = "classic";

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
  appearance: {
    ru: ["Оформление", "Темы интерфейса и политика выбора темы"],
    en: ["Appearance", "UI themes and theme access policy"],
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
  "user_profile",
  "wb_reviews_ai",
  "wb_questions_ai",
  "wb_ads",
  "wb_ads_analytics",
  "wb_ads_recommendations",
  "help_center",
  "billing",
];

const MODULE_TITLES = {
  seo_generation: { ru: "SEO генерация", en: "SEO generation" },
  rank_tracking: { ru: "Трекинг позиций", en: "Rank tracking" },
  competitor_insights: { ru: "Анализ конкурентов", en: "Competitor insights" },
  auto_apply: { ru: "Автоприменение SEO", en: "SEO auto apply" },
  sales_stats: { ru: "Статистика продаж", en: "Sales statistics" },
  user_profile: { ru: "Профиль пользователя", en: "User profile" },
  wb_reviews_ai: { ru: "Отзывы и AI-ответы (WB/Ozon)", en: "Reviews and AI replies (WB/Ozon)" },
  wb_questions_ai: { ru: "Вопросы и AI-ответы (WB/Ozon)", en: "Questions and AI replies (WB/Ozon)" },
  wb_ads: { ru: "Реклама WB", en: "WB Ads" },
  wb_ads_analytics: { ru: "Аналитика рекламы WB", en: "WB Ads analytics" },
  wb_ads_recommendations: { ru: "Рекомендации WB Ads", en: "WB Ads recommendations" },
  help_center: { ru: "Справка по модулям", en: "Help center" },
  billing: { ru: "Биллинг", en: "Billing" },
};

const THEME_LABELS = {
  classic: { ru: "Классика", en: "Classic" },
  dark: { ru: "Темная", en: "Dark" },
  light: { ru: "Светлая", en: "Light" },
  newyear: { ru: "Новогодняя", en: "New Year" },
  summer: { ru: "Лето", en: "Summer" },
  autumn: { ru: "Осень", en: "Autumn" },
  winter: { ru: "Зима", en: "Winter" },
  spring: { ru: "Весна", en: "Spring" },
  japan: { ru: "Япония", en: "Japan" },
  greenland: { ru: "Гренландия", en: "Greenland" },
};

const adminHeaders = () => ({
  "Content-Type": "application/json",
  "Authorization": `Bearer ${adminToken}`,
});

function aTr(ru, en) {
  return adminLang === "en" ? en : ru;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function formatDateTime(raw) {
  if (!raw) return "-";
  const text = String(raw);
  return text.slice(0, 19).replace("T", " ");
}

function parseAdminTeamScope(raw) {
  return String(raw || "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
}

async function adminRequest(url, opts = {}) {
  const r = await fetch(url, opts);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.detail || data.message || aTr("Ошибка запроса", "Request failed"));
  return data;
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
    ["appearance", aTr("Оформление", "Appearance")],
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
    ["#adminTab-modules .grid-3 .hint", aTr("Выберите пользователя и переключайте статусы модулей в таблице ниже.", "Select user and toggle module access below.")],
    ["#adminTab-modules .grid-3 button", aTr("Обновить таблицу", "Refresh table")],
    ["#adminTab-appearance .panel h3", aTr("Оформление интерфейса", "UI appearance")],
    ["#adminThemeChoiceEnabled", aTr("Разрешить выбор темы пользователям", "Allow users to choose theme")],
    ["#adminTab-appearance .grid-3 button", aTr("Сохранить оформление", "Save appearance")],
    ["#adminTab-appearance .hint", aTr("Разрешенные темы для выбора:", "Allowed themes:")],
    ["#adminTab-credentials .panel h3", aTr("API ключи пользователей", "User API keys")],
    ["#adminTab-credentials .grid-2 button", aTr("Обновить таблицу", "Refresh table")],
    ["#adminTab-audit .panel h3", aTr("Журнал действий", "Activity log")],
    ["#adminTab-audit .grid-4 button", aTr("Обновить журнал", "Refresh log")],
    ["#adminAuditActionFilter", aTr("Фильтр по действию (action)", "Filter by action")],
    ["#adminAuditTextFilter", aTr("Текст в деталях / user_id", "Details text / user_id")],
  ];

  for (const [selector, value] of staticTexts) {
    const el = document.querySelector(selector);
    if (!el) continue;
    if (el.tagName.toLowerCase() === "input") {
      el.setAttribute("placeholder", value);
    } else if (el.tagName.toLowerCase() === "label") {
      const input = el.querySelector("input");
      el.textContent = "";
      if (input) el.appendChild(input);
      el.append(document.createTextNode(` ${value}`));
    } else {
      el.textContent = value;
    }
  }

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
    const labels = [aTr("ID", "ID"), aTr("ВРЕМЯ", "TIME"), aTr("USER", "USER"), aTr("ДЕЙСТВИЕ", "ACTION"), aTr("ДЕТАЛИ", "DETAILS")];
    th.textContent = labels[idx] || th.textContent;
  });

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
  renderAdminAuditTable();
  renderAdminAppearance();
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
}

function buildUserOption(user) {
  const role = user.role || "client";
  return `<option value="${user.id}">#${user.id} ${escapeHtml(user.email)} (${escapeHtml(role)})</option>`;
}

function refreshUserSelects() {
  const html = adminUsers.map(buildUserOption).join("");
  ["adminModuleUserSelect", "adminCredUserSelect"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const prev = el.value;
    el.innerHTML = html;
    if (prev && [...el.options].some((o) => o.value === prev)) {
      el.value = prev;
    }
  });
}

async function adminLogin() {
  const email = document.getElementById("adminEmail")?.value.trim() || "";
  const password = document.getElementById("adminPassword")?.value || "";
  const data = await adminRequest("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  }).catch((e) => {
    alert(e.message);
    return null;
  });
  if (!data) return;
  adminToken = data.access_token;
  localStorage.setItem("admin_token", adminToken);
  await ensureAdminAuth();
}

function adminLogout() {
  adminToken = "";
  adminMe = null;
  adminUsers = [];
  adminModules = [];
  adminCredentials = [];
  adminAuditRows = [];
  adminUserProfileCache.clear();
  localStorage.removeItem("admin_token");
  setAdminVisible(false);
}

async function ensureAdminAuth() {
  if (!adminToken) {
    setAdminVisible(false);
    applyAdminTheme(adminTheme);
    applyAdminLanguage();
    return;
  }
  const me = await adminRequest("/api/auth/me", { headers: adminHeaders() }).catch(() => null);
  if (!me || me.role !== "admin") {
    adminLogout();
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
  const [stats, users, modules, allCreds, uiSettings] = await Promise.all([
    adminRequest("/api/admin/stats", { headers: adminHeaders() }).catch(() => null),
    adminRequest("/api/admin/users", { headers: adminHeaders() }).catch(() => null),
    adminRequest("/api/admin/modules", { headers: adminHeaders() }).catch(() => null),
    adminRequest("/api/admin/credentials/all", { headers: adminHeaders() }).catch(() => []),
    adminRequest("/api/admin/ui/settings", { headers: adminHeaders() }).catch(() => null),
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
  adminCredentials = Array.isArray(allCreds) ? allCreds : [];
  adminUiSettings = uiSettings && typeof uiSettings === "object" ? uiSettings : null;

  renderAdminDashboard(stats, users || [], modules || []);
  renderAdminUsersTable();
  renderAdminModulesTable();
  renderAdminCredentialsTable();
  renderAdminAppearance();
}

function renderAdminDashboard(stats, users, modules) {
  const kpiHost = document.getElementById("adminKpis");
  if (!kpiHost || !stats) return;
  const items = [
    [aTr("Пользователи", "Users"), stats.total_users || 0],
    [aTr("Новые за 7 дней", "New in 7 days"), stats.new_users_7d || 0],
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
  svg.innerHTML = `
    <defs>
      <linearGradient id="adminTrendLine" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#21e7ff"/>
        <stop offset="100%" stop-color="#7f8dff"/>
      </linearGradient>
    </defs>
    <polyline points="${points}" fill="none" stroke="url(#adminTrendLine)" stroke-width="3" stroke-linecap="round"></polyline>
  `;
  meta.innerHTML = `<span>${aTr("Всего пользователей", "Total users")}: <b>${total}</b></span><span>${aTr("Новые за 7 дней", "New in 7 days")}: <b>${fresh}</b></span>`;
}

function renderAdminUsersTable() {
  const tbody = document.getElementById("adminUsersTable");
  if (!tbody) return;
  tbody.innerHTML = "";

  const search = String(document.getElementById("adminUsersSearch")?.value || "").trim().toLowerCase();
  const rows = search
    ? adminUsers.filter((u) => `${u.id} ${u.email} ${u.role}`.toLowerCase().includes(search))
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
    const created = formatDateTime(user.created_at);
    const profileRowId = `admin-user-profile-${user.id}`;
    tr.innerHTML = `
      <td>${user.id}</td>
      <td>${escapeHtml(user.email)}</td>
      <td>
        <select data-role-user="${user.id}">
          <option value="client"${user.role === "client" ? " selected" : ""}>client</option>
          <option value="admin"${user.role === "admin" ? " selected" : ""}>admin</option>
        </select>
      </td>
      <td>${escapeHtml(created)}</td>
      <td>
        <div class="actions">
          <button class="btn-secondary" data-save-role="${user.id}">${aTr("Сменить роль", "Change role")}</button>
          <input class="inline-pass" type="password" placeholder="${escapeHtml(aTr("Новый пароль (>=8)", "New password (>=8)"))}" data-pass-user="${user.id}" />
          <button class="btn-secondary" data-save-pass="${user.id}">${aTr("Сменить пароль", "Change password")}</button>
          <button class="btn-secondary" data-profile-user="${user.id}">${aTr("Профиль", "Profile")}</button>
          <button class="btn-danger" data-del-user="${user.id}">${aTr("Удалить", "Delete")}</button>
        </div>
      </td>
    `;

    tr.querySelector(`[data-save-role="${user.id}"]`)?.addEventListener("click", async () => {
      const role = tr.querySelector(`[data-role-user="${user.id}"]`)?.value || "client";
      await adminSetUserRole(user.id, role);
    });
    tr.querySelector(`[data-save-pass="${user.id}"]`)?.addEventListener("click", async () => {
      const newPass = tr.querySelector(`[data-pass-user="${user.id}"]`)?.value || "";
      await adminSetUserPassword(user.id, newPass);
    });
    tr.querySelector(`[data-profile-user="${user.id}"]`)?.addEventListener("click", async () => {
      await adminToggleUserProfile(user.id, profileRowId);
    });
    tr.querySelector(`[data-del-user="${user.id}"]`)?.addEventListener("click", async () => {
      await adminDeleteUser(user.id);
    });
    tbody.appendChild(tr);

    const detailsTr = document.createElement("tr");
    detailsTr.id = profileRowId;
    detailsTr.className = "hidden";
    detailsTr.innerHTML = `
      <td colspan="5">
        <div class="admin-user-details">${aTr("Нажмите «Профиль», чтобы загрузить данные.", "Click Profile to load details.")}</div>
      </td>
    `;
    tbody.appendChild(detailsTr);
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
    ["avatar_url", aTr("Ссылка на аватар", "Avatar URL")],
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

      <div class="admin-user-profile-grid">
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
          <span class="hint">${aTr("Владелец имеет полный доступ (*).", "Owner always has full access (*).")}</span>
        </div>
        <div class="admin-team-create">
          <input data-team-new-email placeholder="${escapeHtml(aTr("Email сотрудника", "Employee email"))}" />
          <input data-team-new-password type="password" placeholder="${escapeHtml(aTr("Пароль (>=8)", "Password (>=8)"))}" />
          <input data-team-new-full placeholder="${escapeHtml(aTr("ФИО", "Full name"))}" />
          <input data-team-new-phone placeholder="${escapeHtml(aTr("Телефон", "Phone"))}" />
          <input data-team-new-nick placeholder="${escapeHtml(aTr("Ник", "Nickname"))}" />
          <input data-team-new-avatar placeholder="${escapeHtml(aTr("Ссылка на аватар", "Avatar URL"))}" />
          <input data-team-new-access placeholder="products, seo_generation, wb_reviews_ai" />
          <button type="button" data-team-add>${aTr("Добавить сотрудника", "Add employee")}</button>
        </div>
        <div class="table-card admin-team-table-wrap">
          <table class="admin-team-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>${aTr("EMAIL", "EMAIL")}</th>
                <th>${aTr("ФИО", "FULL NAME")}</th>
                <th>${aTr("Телефон", "PHONE")}</th>
                <th>${aTr("Ник", "NICK")}</th>
                <th>${aTr("Роль", "ROLE")}</th>
                <th>${aTr("Доступ", "ACCESS")}</th>
                <th>${aTr("Пароль", "PASSWORD")}</th>
                <th>${aTr("Действия", "ACTIONS")}</th>
              </tr>
            </thead>
            <tbody>
              ${
                teamMembers.length
                  ? teamMembers
                      .map((member) => {
                        const memberId = Number(member.id || 0);
                        const isOwner = Boolean(member.is_owner);
                        const access = Array.isArray(member.access_scope) ? member.access_scope.join(", ") : "";
                        return `
                          <tr data-team-row="${memberId}">
                            <td>${memberId || "-"}</td>
                            <td><input data-team-email="${memberId}" value="${escapeHtml(String(member.email || ""))}" ${isOwner ? "disabled" : ""} /></td>
                            <td><input data-team-full="${memberId}" value="${escapeHtml(String(member.full_name || ""))}" /></td>
                            <td><input data-team-phone="${memberId}" value="${escapeHtml(String(member.phone || ""))}" /></td>
                            <td><input data-team-nick="${memberId}" value="${escapeHtml(String(member.nickname || ""))}" /></td>
                            <td>${isOwner ? aTr("Владелец", "Owner") : aTr("Сотрудник", "Employee")}</td>
                            <td><input data-team-access="${memberId}" value="${escapeHtml(access)}" ${isOwner ? "disabled" : ""} /></td>
                            <td>${isOwner ? "-" : `<input type="password" data-team-pass="${memberId}" placeholder="${escapeHtml(aTr("Новый пароль", "New password"))}" />`}</td>
                            <td>
                              <div class="actions">
                                <button class="btn-secondary" type="button" data-team-save="${memberId}">${aTr("Сохранить", "Save")}</button>
                                ${
                                  isOwner
                                    ? ""
                                    : `<button class="btn-danger" type="button" data-team-del="${memberId}">${aTr("Удалить", "Delete")}</button>`
                                }
                              </div>
                            </td>
                          </tr>
                        `;
                      })
                      .join("")
                  : `<tr><td colspan="9">${aTr("Сотрудники не добавлены.", "No employees added.")}</td></tr>`
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  const refreshProfile = async () => {
    adminUserProfileCache.delete(payload.user_id);
    await adminToggleUserProfile(payload.user_id, rowId, true);
  };
  host.querySelector("[data-save-profile]")?.addEventListener("click", async () => {
    await adminSaveUserProfileFromPanel(payload.user_id, rowId);
  });
  host.querySelector("[data-save-plan]")?.addEventListener("click", async () => {
    await adminSaveUserPlanFromPanel(payload.user_id, rowId);
  });
  host.querySelector("[data-refresh-profile]")?.addEventListener("click", async () => {
    await refreshProfile();
  });
  host.querySelector("[data-team-add]")?.addEventListener("click", async () => {
    const teamPayload = {
      email: String(host.querySelector("[data-team-new-email]")?.value || "").trim().toLowerCase(),
      password: String(host.querySelector("[data-team-new-password]")?.value || ""),
      full_name: String(host.querySelector("[data-team-new-full]")?.value || "").trim(),
      phone: String(host.querySelector("[data-team-new-phone]")?.value || "").trim(),
      nickname: String(host.querySelector("[data-team-new-nick]")?.value || "").trim(),
      avatar_url: String(host.querySelector("[data-team-new-avatar]")?.value || "").trim(),
      access_scope: parseAdminTeamScope(host.querySelector("[data-team-new-access]")?.value || ""),
    };
    if (!teamPayload.email) {
      alert(aTr("Укажите email сотрудника", "Enter employee email"));
      return;
    }
    const created = await adminRequest(`/api/admin/users/${payload.user_id}/team`, {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify(teamPayload),
    }).catch((e) => {
      alert(e.message);
      return null;
    });
    if (!created) return;
    await refreshProfile();
  });
  host.querySelectorAll("[data-team-save]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const memberId = Number(btn.dataset.teamSave || 0);
      if (!memberId) return;
      const updatePayload = {
        email: String(host.querySelector(`[data-team-email="${memberId}"]`)?.value || "").trim().toLowerCase(),
        password: String(host.querySelector(`[data-team-pass="${memberId}"]`)?.value || ""),
        full_name: String(host.querySelector(`[data-team-full="${memberId}"]`)?.value || "").trim(),
        phone: String(host.querySelector(`[data-team-phone="${memberId}"]`)?.value || "").trim(),
        nickname: String(host.querySelector(`[data-team-nick="${memberId}"]`)?.value || "").trim(),
        avatar_url: "",
        access_scope: parseAdminTeamScope(host.querySelector(`[data-team-access="${memberId}"]`)?.value || ""),
      };
      const current = teamMembers.find((x) => Number(x.id) === memberId);
      updatePayload.avatar_url = String(current?.avatar_url || "").trim();
      const updated = await adminRequest(`/api/admin/users/${payload.user_id}/team/${memberId}`, {
        method: "PUT",
        headers: adminHeaders(),
        body: JSON.stringify(updatePayload),
      }).catch((e) => {
        alert(e.message);
        return null;
      });
      if (!updated) return;
      await refreshProfile();
    });
  });
  host.querySelectorAll("[data-team-del]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const memberId = Number(btn.dataset.teamDel || 0);
      if (!memberId) return;
      if (!confirm(aTr("Удалить сотрудника из кабинета?", "Delete employee from workspace?"))) return;
      const deleted = await adminRequest(`/api/admin/users/${payload.user_id}/team/${memberId}`, {
        method: "DELETE",
        headers: adminHeaders(),
      }).catch((e) => {
        alert(e.message);
        return null;
      });
      if (!deleted) return;
      await refreshProfile();
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
}

async function adminSetUserPassword(user_id, new_password) {
  if (!new_password) return alert(aTr("Введите новый пароль", "Enter new password"));
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
}

async function adminDeleteUser(user_id) {
  if (!confirm(aTr(`Удалить пользователя #${user_id} вместе с его данными?`, `Delete user #${user_id} with all data?`))) return;
  const data = await adminRequest(`/api/admin/users/${user_id}`, {
    method: "DELETE",
    headers: adminHeaders(),
  }).catch((e) => {
    alert(e.message);
    return null;
  });
  if (data) alert(data.message);
  await loadAdminAll();
}

async function adminToggleUserProfile(user_id, rowId, forceReload = false) {
  const row = document.getElementById(rowId);
  if (!row) return;
  if (!forceReload && !row.classList.contains("hidden")) {
    row.classList.add("hidden");
    return;
  }

  const holder = row.querySelector(".admin-user-details");
  if (holder) holder.textContent = aTr("Загрузка...", "Loading...");

  let payload = forceReload ? null : (adminUserProfileCache.get(user_id) || null);
  if (!payload) {
    payload = await adminRequest(`/api/admin/users/${user_id}/profile`, {
      headers: adminHeaders(),
    }).catch((e) => {
      alert(e.message);
      return null;
    });
    if (!payload) return;
    adminUserProfileCache.set(user_id, payload);
  }

  renderAdminUserProfilePanel(payload, rowId);
  row.classList.remove("hidden");
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
  const existing = new Map();
  for (const row of adminModules) {
    if (Number(row.user_id) !== Number(userId)) continue;
    existing.set(row.module_code, Boolean(row.enabled));
  }
  const codes = new Set(DEFAULT_MODULE_CODES);
  for (const row of adminModules) codes.add(row.module_code);
  return [...codes]
    .sort()
    .map((code) => ({
      module_code: code,
      title: MODULE_TITLES[code]?.[adminLang] || code,
      enabled: existing.has(code) ? existing.get(code) : false,
    }));
}

function renderAdminModulesTable() {
  const tbody = document.getElementById("adminModulesTable");
  if (!tbody) return;
  tbody.innerHTML = "";

  const userId = Number(document.getElementById("adminModuleUserSelect")?.value || 0);
  if (!userId) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="4">${aTr("Выберите пользователя.", "Select user.")}</td>`;
    tbody.appendChild(tr);
    return;
  }

  const rows = getModuleRowsForUser(userId);
  if (!rows.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="4">${aTr("Модули не найдены.", "No modules found.")}</td>`;
    tbody.appendChild(tr);
    return;
  }

  for (const row of rows) {
    const tr = document.createElement("tr");
    const statusLabel = row.enabled ? aTr("Включен", "Enabled") : aTr("Отключен", "Disabled");
    const actionLabel = row.enabled ? aTr("Отключить", "Disable") : aTr("Включить", "Enable");
    const actionClass = row.enabled ? "btn-danger" : "btn-secondary";
    tr.innerHTML = `
      <td>${escapeHtml(row.module_code)}</td>
      <td>${escapeHtml(row.title)}</td>
      <td>${statusLabel}</td>
      <td><button class="${actionClass}" data-module-code="${escapeHtml(row.module_code)}">${actionLabel}</button></td>
    `;
    const btn = tr.querySelector("button");
    if (btn) {
      btn.onclick = () => adminToggleModule(row.module_code, !row.enabled);
    }
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

  const actionFilter = String(document.getElementById("adminAuditActionFilter")?.value || "").trim().toLowerCase();
  const textFilter = String(document.getElementById("adminAuditTextFilter")?.value || "").trim().toLowerCase();

  const rows = adminAuditRows.filter((row) => {
    const action = String(row.action || "").toLowerCase();
    const details = String(row.details || "").toLowerCase();
    const uid = String(row.user_id ?? "").toLowerCase();
    if (actionFilter && !action.includes(actionFilter)) return false;
    if (textFilter && !(`${details} ${uid}`.includes(textFilter))) return false;
    return true;
  });

  if (meta) {
    const uniqueActions = new Set(rows.map((row) => String(row.action || "").trim()).filter(Boolean));
    meta.textContent = aTr(
      `Событий: ${rows.length}. Уникальных действий: ${uniqueActions.size}.`,
      `Events: ${rows.length}. Unique actions: ${uniqueActions.size}.`
    );
  }

  if (!rows.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="5">${aTr("Записи аудита не найдены.", "No audit records.")}</td>`;
    tbody.appendChild(tr);
    return;
  }

  const userMap = new Map(adminUsers.map((u) => [Number(u.id), u.email]));
  for (const row of rows) {
    const tr = document.createElement("tr");
    const parsed = parseAuditDetails(row.details);
    const userEmail = userMap.get(Number(row.user_id)) || "";
    const userLabel = row.user_id ? `#${row.user_id}${userEmail ? ` ${userEmail}` : ""}` : "-";
    const detailHtml = parsed.kv.length
      ? `<div class="admin-audit-kv">${parsed.kv.map(([k, v]) => `<span><b>${escapeHtml(k)}</b>: ${escapeHtml(v)}</span>`).join("")}</div>`
      : `<span class="hint">${escapeHtml(parsed.summary)}</span>`;

    tr.innerHTML = `
      <td>${row.id}</td>
      <td>${escapeHtml(formatDateTime(row.created_at))}</td>
      <td>${escapeHtml(userLabel)}</td>
      <td><span class="admin-chip">${escapeHtml(String(row.action || "-"))}</span></td>
      <td>${detailHtml}</td>
    `;
    tbody.appendChild(tr);
  }
}

async function loadAdminAudit() {
  const limit = Number(document.getElementById("adminAuditLimit")?.value || 200);
  const data = await adminRequest(`/api/admin/audit?limit=${limit}`, { headers: adminHeaders() }).catch((e) => {
    alert(e.message);
    return null;
  });
  if (!data) return;
  adminAuditRows = Array.isArray(data) ? data : [];
  const raw = document.getElementById("adminAuditView");
  if (raw) raw.textContent = JSON.stringify(adminAuditRows, null, 2);
  renderAdminAuditTable();
}

function renderAdminAppearance() {
  const rawEl = document.getElementById("adminUiSettingsRaw");
  const enabledEl = document.getElementById("adminThemeChoiceEnabled");
  const defaultEl = document.getElementById("adminDefaultThemeSelect");
  const allowedEl = document.getElementById("adminAllowedThemes");
  if (!rawEl || !enabledEl || !defaultEl || !allowedEl) return;

  const payload = adminUiSettings && typeof adminUiSettings === "object"
    ? adminUiSettings
    : { theme_choice_enabled: true, default_theme: "classic", allowed_themes: [...UI_THEMES] };
  const allowed = Array.isArray(payload.allowed_themes)
    ? payload.allowed_themes.filter((x) => UI_THEMES.includes(String(x)))
    : [...UI_THEMES];

  enabledEl.checked = Boolean(payload.theme_choice_enabled);
  defaultEl.innerHTML = UI_THEMES.map((code) => `<option value="${code}">${escapeHtml(THEME_LABELS[code]?.[adminLang] || code)}</option>`).join("");
  defaultEl.value = UI_THEMES.includes(payload.default_theme) ? payload.default_theme : "classic";

  allowedEl.innerHTML = UI_THEMES.map((code) => {
    const checked = allowed.includes(code) ? "checked" : "";
    const label = THEME_LABELS[code]?.[adminLang] || code;
    return `<label class="check"><input type="checkbox" data-theme-code="${code}" ${checked} /> ${escapeHtml(label)} (${code})</label>`;
  }).join("");
  rawEl.textContent = JSON.stringify(payload, null, 2);
}

async function adminSaveUiSettings() {
  const enabled = Boolean(document.getElementById("adminThemeChoiceEnabled")?.checked);
  const defaultTheme = document.getElementById("adminDefaultThemeSelect")?.value || "classic";
  const allowed = [...document.querySelectorAll("#adminAllowedThemes [data-theme-code]")]
    .filter((el) => el.checked)
    .map((el) => el.dataset.themeCode)
    .filter((x) => UI_THEMES.includes(String(x)));
  const payload = {
    theme_choice_enabled: enabled,
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
  alert(aTr("Оформление сохранено", "Appearance saved"));
}

document.getElementById("adminModuleUserSelect")?.addEventListener("change", () => renderAdminModulesTable());
window.showAdminTab = showAdminTab;
window.adminLogin = adminLogin;
window.adminLogout = adminLogout;
window.loadAdminAll = loadAdminAll;
window.loadAdminAudit = loadAdminAudit;
window.adminSaveUiSettings = adminSaveUiSettings;
window.adminSaveCredential2 = adminSaveCredential2;
window.adminChangeLanguage = adminChangeLanguage;
window.adminChangeTheme = adminChangeTheme;

applyAdminTheme(adminTheme);
applyAdminLanguage();
ensureAdminAuth();
