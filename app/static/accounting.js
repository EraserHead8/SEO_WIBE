let accountingReloadTimer = null;
let accountingExpenseEditId = 0;
let accountingRequestSeq = 0;
let accountingMonthlyRequestSeq = 0;
let accountingMonthlyLiveRefreshInFlight = false;
let accountingMonthlyState = { months: [], meta: {} };
let accountingMonthlyLastGoodState = null;

const ACCOUNTING_SUBTABS = ["overview", "analysis", "monthly", "expenses", "settings"];
const ACCOUNTING_RANGE_DAYS = {
  day: 0,
  week: 6,
  month: 29,
  quarter: 89,
  year: 364,
};

function accountingToYmd(value) {
  if (!value) return "";
  if (value instanceof Date) return toYmd(value);
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) return "";
  return toYmd(new Date(parsed));
}

function accountingFormatPercent(value) {
  const locale = currentLang === "en" ? "en-US" : "ru-RU";
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0));
}

function accountingNormalizeSubtab(raw) {
  const key = String(raw || "").trim().toLowerCase();
  return ACCOUNTING_SUBTABS.includes(key) ? key : "overview";
}

function syncAccountingRangeButtons(forcedKey = "") {
  const fromEl = document.getElementById("accountingDateFrom");
  const toEl = document.getElementById("accountingDateTo");
  const periodEl = document.getElementById("accountingPeriod");
  if (!fromEl || !toEl || !periodEl) return;

  let activeKey = forcedKey;
  if (!activeKey && fromEl.value && toEl.value) {
    const fromTs = Date.parse(`${fromEl.value}T00:00:00`);
    const toTs = Date.parse(`${toEl.value}T00:00:00`);
    const diffDays = Number.isFinite(fromTs) && Number.isFinite(toTs)
      ? Math.round((toTs - fromTs) / (24 * 3600 * 1000))
      : -1;
    if (diffDays === 0) activeKey = "day";
    else if (diffDays === 6) activeKey = "week";
    else if (diffDays === 29) activeKey = "month";
    else if (diffDays === 89) activeKey = "quarter";
    else if (diffDays === 364) activeKey = "year";
    else activeKey = "custom";
  }
  if (!activeKey) activeKey = "custom";
  periodEl.value = activeKey;
  document.querySelectorAll("[data-accounting-range]").forEach((btn) => {
    btn.classList.toggle("active", String(btn.dataset.accountingRange || "") === activeKey);
  });
}

function setAccountingRange(mode, autoLoad = true) {
  const fromEl = document.getElementById("accountingDateFrom");
  const toEl = document.getElementById("accountingDateTo");
  const periodEl = document.getElementById("accountingPeriod");
  if (!fromEl || !toEl || !periodEl) return;
  const key = String(mode || "custom").trim().toLowerCase();
  periodEl.value = key;
  if (key === "custom") {
    syncAccountingRangeButtons("custom");
    if (autoLoad) scheduleAccountingReload(120);
    return;
  }
  const days = ACCOUNTING_RANGE_DAYS[key];
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const start = new Date(end);
  if (Number.isFinite(days) && days > 0) {
    start.setDate(start.getDate() - days);
  }
  fromEl.value = toYmd(start);
  toEl.value = toYmd(end);
  syncAccountingRangeButtons(key);
  if (autoLoad) loadAccountingData();
}

function onAccountingPeriodChanged() {
  const period = String(document.getElementById("accountingPeriod")?.value || "day").trim().toLowerCase();
  setAccountingRange(period, period !== "custom");
}

function onAccountingDateChanged() {
  syncAccountingRangeButtons();
  scheduleAccountingReload(180);
}

function scheduleAccountingReload(delayMs = 260) {
  if (accountingReloadTimer) {
    clearTimeout(accountingReloadTimer);
    accountingReloadTimer = null;
  }
  accountingReloadTimer = setTimeout(() => {
    accountingReloadTimer = null;
    if (currentTab === "accounting") {
      loadAccountingData();
    }
  }, Math.max(80, Number(delayMs || 0)));
}

function ensureAccountingDefaults() {
  const marketEl = document.getElementById("accountingMarketplace");
  if (marketEl && !marketEl.value) marketEl.value = "all";
  const templateMarketEl = document.getElementById("accountingTemplateMarketplace");
  if (templateMarketEl) {
    const stored = String(localStorage.getItem("accounting_template_marketplace") || "").trim().toLowerCase();
    if (["all", "wb", "ozon"].includes(stored)) templateMarketEl.value = stored;
    if (!templateMarketEl.dataset.bound) {
      templateMarketEl.dataset.bound = "1";
      templateMarketEl.addEventListener("change", () => {
        const selected = String(templateMarketEl.value || "all").trim().toLowerCase();
        localStorage.setItem("accounting_template_marketplace", ["all", "wb", "ozon"].includes(selected) ? selected : "all");
      });
    }
  }

  const sortEl = document.getElementById("accountingAnalysisSort");
  if (sortEl && !sortEl.value) sortEl.value = accountingSortMode || "net_profit_desc";

  const fromEl = document.getElementById("accountingDateFrom");
  const toEl = document.getElementById("accountingDateTo");
  if (!fromEl || !toEl) return;
  if (!fromEl.value || !toEl.value) {
    setAccountingRange("day", false);
    return;
  }
  syncAccountingRangeButtons();
}

function resetAccountingAnalysisFilters() {
  const searchEl = document.getElementById("accountingAnalysisSearch");
  const sortEl = document.getElementById("accountingAnalysisSort");
  if (searchEl) searchEl.value = "";
  if (sortEl) sortEl.value = "net_profit_desc";
  accountingSortMode = "net_profit_desc";
  loadAccountingData();
}

function accountingSetMeta(id, message) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(message || "-");
}

function normalizeAccountingWarning(raw) {
  const text = String(raw || "").trim();
  if (!text) return "";
  const low = text.toLowerCase();
  if (low.includes("429") && low.includes("wb")) {
    return tr(
      "WB API РІСЂРµРјРµРЅРЅРѕ РѕРіСЂР°РЅРёС‡РёР» Р·Р°РїСЂРѕСЃС‹ (429). РџРѕРєР°Р·Р°РЅР° РґРѕСЃС‚СѓРїРЅР°СЏ С‡Р°СЃС‚СЊ РґР°РЅРЅС‹С….",
      "WB API rate-limited requests (429). Showing available partial data."
    );
  }
  if (low.includes("429") && low.includes("ozon")) {
    return tr(
      "Ozon API РІСЂРµРјРµРЅРЅРѕ РѕРіСЂР°РЅРёС‡РёР» Р·Р°РїСЂРѕСЃС‹ (429). РџРѕРєР°Р·Р°РЅР° РґРѕСЃС‚СѓРїРЅР°СЏ С‡Р°СЃС‚СЊ РґР°РЅРЅС‹С….",
      "Ozon API rate-limited requests (429). Showing available partial data."
    );
  }
  if (low.includes("bad_json") && low.includes("wb")) {
    return tr(
      "WB API РІРµСЂРЅСѓР» РЅРµСЃС‚Р°Р±РёР»СЊРЅС‹Р№ РѕС‚РІРµС‚. РСЃРїРѕР»СЊР·РѕРІР°РЅР° С‡Р°СЃС‚РёС‡РЅР°СЏ СЃС‚Р°С‚РёСЃС‚РёРєР°.",
      "WB API returned malformed data. Partial statistics were used."
    );
  }
  if (low.includes("wb finance api РЅРµРґРѕСЃС‚СѓРїРµРЅ") && (
    low.includes("wb sales api РІРµСЂРЅСѓР» РЅРµРєРѕСЂСЂРµРєС‚РЅС‹Р№ РѕС‚РІРµС‚")
    || low.includes("wb sales api РІРµСЂРЅСѓР» РЅРµРѕР¶РёРґР°РЅРЅС‹Р№ С„РѕСЂРјР°С‚")
    || low.includes("bad_json")
  )) {
    return tr(
      "WB API РІРµСЂРЅСѓР» РЅРµСЃС‚Р°Р±РёР»СЊРЅС‹Р№ РѕС‚РІРµС‚. РСЃРїРѕР»СЊР·РѕРІР°РЅР° С‡Р°СЃС‚РёС‡РЅР°СЏ СЃС‚Р°С‚РёСЃС‚РёРєР°.",
      "WB API returned unstable data. Partial statistics were used."
    );
  }
  if (low.includes("ads api РЅРµРґРѕСЃС‚СѓРїРµРЅ")) {
    return tr(
      "Р РµРєР»Р°РјРЅС‹Рµ СЂР°СЃС…РѕРґС‹ РІСЂРµРјРµРЅРЅРѕ РЅРµРґРѕСЃС‚СѓРїРЅС‹ РІ API. РћСЃС‚Р°Р»СЊРЅС‹Рµ РїРѕРєР°Р·Р°С‚РµР»Рё СЂР°СЃСЃС‡РёС‚Р°РЅС‹.",
      "Ads costs are temporarily unavailable from API. Other metrics are calculated."
    );
  }
  if (low.includes("РєР»СЋС‡") || low.includes("unauthorized")) {
    return tr("РџСЂРѕРІРµСЂСЊС‚Рµ API-РєР»СЋС‡Рё WB/Ozon РІ РїСЂРѕС„РёР»Рµ.", "Check WB/Ozon API keys in profile.");
  }
  return text;
}

function renderAccountingWarnings() {
  const warningEl = document.getElementById("accountingWarnings");
  if (!warningEl) return;
  const rawLines = Array.isArray(accountingWarnings) ? accountingWarnings : [];
  const lines = [...new Set(rawLines.map((x) => normalizeAccountingWarning(x)).filter(Boolean))];
  if (!lines.length) {
    warningEl.textContent = tr("Р”Р°РЅРЅС‹Рµ Р±СѓС…РіР°Р»С‚РµСЂРёРё Р·Р°РіСЂСѓР¶РµРЅС‹.", "Accounting data loaded.");
    return;
  }
  const visible = lines.slice(0, 3);
  const tail = lines.length > 3 ? tr(`(+ РµС‰Рµ ${lines.length - 3})`, `(+ ${lines.length - 3} more)`) : "";
  warningEl.textContent = [...visible, tail].filter(Boolean).join(" | ");
}

function renderAccountingOverview() {
  const cardsEl = document.getElementById("accountingOverviewCards");
  const marketEl = document.getElementById("accountingMarketCards");
  if (!cardsEl || !marketEl) return;
  const o = accountingOverview && typeof accountingOverview === "object" ? accountingOverview : {};

  const cards = [
    { label: tr("Orders", "Orders"), value: formatInt(o.orders || 0), tone: "neutral" },
    { label: tr("Units", "Units"), value: formatInt(o.units || 0), tone: "neutral" },
    { label: tr("Р’С‹РєСѓРїС‹", "Buyouts"), value: formatInt(o.buyouts || 0), tone: "neutral" },
    { label: tr("Р’РѕР·РІСЂР°С‚С‹", "Returns"), value: formatInt(o.returns || 0), tone: "neutral" },
    { label: tr("Р’С‹СЂСѓС‡РєР°", "Revenue"), value: formatMoney(o.revenue || 0), tone: "positive" },
    { label: tr("COGS", "COGS"), value: formatMoney(o.cogs || 0), tone: "negative" },
    { label: tr("Р’Р°Р»РѕРІР°СЏ РїСЂРёР±С‹Р»СЊ", "Gross profit"), value: formatMoney(o.gross_profit || 0), tone: "positive" },
    { label: tr("Р Р°СЃС…РѕРґС‹ РњРџ", "Marketplace expense"), value: formatMoney(o.marketplace_expense || 0), tone: "negative" },
    { label: tr("РћРїРµСЂР°С†РёРѕРЅРЅР°СЏ РїСЂРёР±С‹Р»СЊ", "Operating profit"), value: formatMoney(o.operating_profit || 0), tone: "positive" },
    { label: tr("Р”РѕРї. СЂР°СЃС…РѕРґС‹", "Custom expenses"), value: formatMoney(o.custom_expenses || 0), tone: "negative" },
    { label: tr("Taxes", "Taxes"), value: formatMoney((o.tax_amount || 0) + (o.vat_amount || 0)), tone: "negative" },
    { label: tr("Net profit", "Net profit"), value: formatMoney(o.net_profit || 0), tone: "net" },
    { label: tr("РњР°СЂР¶Р°", "Margin"), value: `${accountingFormatPercent(o.margin || 0)}%`, tone: "positive" },
    { label: tr("Commission", "Commission"), value: formatMoney(o.commission || 0), tone: "negative" },
    { label: tr("Logistics", "Logistics"), value: formatMoney(o.logistics || 0), tone: "negative" },
    { label: tr("Storage", "Storage"), value: formatMoney(o.storage || 0), tone: "negative" },
    { label: tr("РЈРґРµСЂР¶Р°РЅРёСЏ", "Deductions"), value: formatMoney(o.deductions || 0), tone: "negative" },
    { label: tr("РџСЂРёРµРјРєР°", "Acceptance"), value: formatMoney(o.acceptance || 0), tone: "negative" },
    { label: tr("Penalties", "Penalties"), value: formatMoney(o.penalties || 0), tone: "negative" },
    { label: tr("Р РµРєР»Р°РјР°", "Ads"), value: formatMoney(o.ad_spend || 0), tone: "negative" },
  ];

  cardsEl.innerHTML = cards
    .map((item) => {
      const toneClass = item.tone === "positive"
        ? "accounting-kpi-positive"
        : (item.tone === "negative"
          ? "accounting-kpi-negative"
          : (item.tone === "net" ? "accounting-kpi-net" : ""));
      return `<article class="sales-kpi ${toneClass}"><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(String(item.value))}</strong></article>`;
    })
    .join("");

  const byMarket = (o.by_marketplace && typeof o.by_marketplace === "object") ? o.by_marketplace : {};
  const preferred = ["wb", "ozon", "all"];
  const keys = [...new Set([...preferred, ...Object.keys(byMarket)])].filter((key) => byMarket[key] && typeof byMarket[key] === "object");
  if (!keys.length) {
    marketEl.innerHTML = `<article class="sales-kpi"><span>${tr("РњР°СЂРєРµС‚РїР»РµР№СЃС‹", "Marketplaces")}</span><strong>${tr("РќРµС‚ РґР°РЅРЅС‹С…", "No data")}</strong></article>`;
    return;
  }
  marketEl.innerHTML = keys
    .map((key) => {
      const row = byMarket[key] || {};
      const title = key === "all" ? tr("Р’СЃРµ РјР°СЂРєРµС‚РїР»РµР№СЃС‹", "All marketplaces") : key.toUpperCase();
      return `
        <article class="sales-kpi ${Number(row.net_profit || 0) >= 0 ? "accounting-kpi-positive" : "accounting-kpi-negative"}">
          <span>${escapeHtml(title)}</span>
          <strong>${escapeHtml(formatMoney(row.net_profit || 0))}</strong>
          <small>${escapeHtml(tr("Р’С‹СЂСѓС‡РєР°", "Revenue"))}: ${escapeHtml(formatMoney(row.revenue || 0))}</small>
          <small>${escapeHtml(tr("РњР°СЂР¶Р°", "Margin"))}: ${escapeHtml(`${accountingFormatPercent(row.margin || 0)}%`)}</small>
        </article>
      `;
    })
    .join("");
}

function renderAccountingChart() {
  const host = document.getElementById("accountingProfitChart");
  const meta = document.getElementById("accountingOverviewMeta");
  if (!host || !meta) return;
  const points = Array.isArray(accountingChartRows) ? accountingChartRows : [];
  if (!points.length) {
    clearChartHost(host);
    meta.textContent = tr("РќРµС‚ РґР°РЅРЅС‹С… РїРѕ РїСЂРёР±С‹Р»Рё Р·Р° РІС‹Р±СЂР°РЅРЅС‹Р№ РїРµСЂРёРѕРґ.", "No profit data for selected period.");
    return;
  }

  const labels = points.map((row) => String(row?.bucket || row?.date || "").trim() || "-");
  const revenue = points.map((row) => Number(row?.revenue || 0));
  const gross = points.map((row) => Number(row?.gross_profit || 0));
  const operating = points.map((row) => Number(row?.operating_profit || 0));
  const net = points.map((row) => Number(row?.net_profit || 0));
  const allValues = [...revenue, ...gross, ...operating, ...net];
  const peak = allValues.length ? Math.max(...allValues) : 0;
  const min = allValues.length ? Math.min(...allValues) : 0;

  if (canUseEcharts(host)) {
    const chart = getOrCreateChart(host);
    if (chart) {
      chart.setOption(
        {
          animationDuration: 420,
          grid: { top: 18, right: 22, bottom: 32, left: 58 },
          tooltip: {
            trigger: "axis",
            backgroundColor: "rgba(17,31,58,0.92)",
            borderWidth: 0,
            textStyle: { color: "#eff6ff" },
          },
          legend: {
            top: 2,
            textStyle: { color: "#5f7391", fontSize: 12 },
            data: [
              tr("Р’С‹СЂСѓС‡РєР°", "Revenue"),
              tr("Р’Р°Р»РѕРІР°СЏ", "Gross"),
              tr("РћРїРµСЂР°С†РёРѕРЅРЅР°СЏ", "Operating"),
              tr("Р§РёСЃС‚Р°СЏ", "Net"),
            ],
          },
          xAxis: {
            type: "category",
            boundaryGap: false,
            data: labels.map((x) => String(x).slice(-5)),
            axisLine: { lineStyle: { color: "rgba(97,122,156,0.35)" } },
            axisLabel: { color: "#6f86a7", fontSize: 11 },
            axisTick: { show: false },
          },
          yAxis: {
            type: "value",
            splitLine: { lineStyle: { color: "rgba(95,121,162,0.17)" } },
            axisLabel: {
              color: "#6f86a7",
              fontSize: 11,
              formatter: (value) => formatMoney(value),
            },
          },
          series: [
            {
              name: tr("Р’С‹СЂСѓС‡РєР°", "Revenue"),
              type: "line",
              smooth: true,
              showSymbol: false,
              data: revenue,
              lineStyle: { width: 2.4, color: "#2ec5ff" },
              itemStyle: { color: "#2ec5ff" },
            },
            {
              name: tr("Р’Р°Р»РѕРІР°СЏ", "Gross"),
              type: "line",
              smooth: true,
              showSymbol: false,
              data: gross,
              lineStyle: { width: 2.2, color: "#8266ff" },
              itemStyle: { color: "#8266ff" },
            },
            {
              name: tr("РћРїРµСЂР°С†РёРѕРЅРЅР°СЏ", "Operating"),
              type: "line",
              smooth: true,
              showSymbol: false,
              data: operating,
              lineStyle: { width: 2.2, color: "#3bd38c" },
              itemStyle: { color: "#3bd38c" },
            },
            {
              name: tr("Р§РёСЃС‚Р°СЏ", "Net"),
              type: "line",
              smooth: true,
              showSymbol: false,
              data: net,
              lineStyle: { width: 2.8, color: "#ff8a53" },
              itemStyle: { color: "#ff8a53" },
            },
          ],
        },
        true
      );
      try {
        chart.resize();
      } catch (_) {}
    }
  } else {
    clearChartHost(host);
  }

  meta.innerHTML = [
    `${tr("РџРµСЂРёРѕРґРѕРІ", "Points")}: <b>${formatInt(points.length)}</b>`,
    `${tr("РџРёРє", "Peak")}: <b>${formatMoney(peak)}</b>`,
    `${tr("РњРёРЅ", "Min")}: <b>${formatMoney(min)}</b>`,
  ].map((x) => `<span>${x}</span>`).join("");
}

function renderAccountingAnalysis() {
  const tbody = document.getElementById("accountingAnalysisTable");
  const meta = document.getElementById("accountingAnalysisMeta");
  if (!tbody || !meta) return;
  tbody.innerHTML = "";

  const rows = Array.isArray(accountingAnalysisRows) ? accountingAnalysisRows : [];
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="12">${escapeHtml(tr("РќРµС‚ РґР°РЅРЅС‹С… РґР»СЏ Р°РЅР°Р»РёР·Р°.", "No analytics data."))}</td></tr>`;
    meta.textContent = tr("РЎС‚СЂРѕРє: 0", "Rows: 0");
    return;
  }

  for (const row of rows) {
    const net = Number(row?.net_profit || 0);
    const lossClass = net < 0 ? "accounting-row-loss" : "accounting-row-profit";
    const trEl = document.createElement("tr");
    trEl.className = lossClass;
    trEl.innerHTML = `
      <td>${escapeHtml(String(row.marketplace || "-").toUpperCase())}</td>
      <td>${escapeHtml(String(row.article || row.external_id || "-"))}</td>
      <td>${escapeHtml(String(row.name || "-"))}</td>
      <td>${escapeHtml(formatInt(row.sold_units || 0))}</td>
      <td>${escapeHtml(`${accountingFormatPercent(row.return_rate || 0)}%`)}</td>
      <td>${escapeHtml(formatMoney(row.revenue || 0))}</td>
      <td>${escapeHtml(formatMoney(row.cogs || 0))}</td>
      <td>${escapeHtml(formatMoney(row.marketplace_expense || 0))}</td>
      <td>${escapeHtml(formatMoney(row.operating_profit || 0))}</td>
      <td>${escapeHtml(formatMoney((row.tax || 0) + (row.vat || 0)))}</td>
      <td>${escapeHtml(formatMoney(net))}</td>
      <td>${escapeHtml(`${accountingFormatPercent(row.margin || 0)}%`)}</td>
    `;
    tbody.appendChild(trEl);
  }
  meta.textContent = tr(`РЎС‚СЂРѕРє Р°РЅР°Р»РёР·Р°: ${rows.length}`, `Analysis rows: ${rows.length}`);
}

function resetAccountingExpenseForm() {
  accountingExpenseEditId = 0;
  const idEl = document.getElementById("accountingExpenseId");
  if (idEl) idEl.value = "";
  const market = document.getElementById("accountingExpenseMarketplace");
  if (market) market.value = "all";
  const category = document.getElementById("accountingExpenseCategory");
  if (category) category.value = "";
  const amount = document.getElementById("accountingExpenseAmount");
  if (amount) amount.value = "";
  const recurrence = document.getElementById("accountingExpenseRecurrence");
  if (recurrence) recurrence.value = "monthly";
  const start = document.getElementById("accountingExpenseStartDate");
  if (start) start.value = "";
  const end = document.getElementById("accountingExpenseEndDate");
  if (end) end.value = "";
  const note = document.getElementById("accountingExpenseNote");
  if (note) note.value = "";
  const active = document.getElementById("accountingExpenseActive");
  if (active) active.checked = true;
}

function editAccountingExpense(expenseId) {
  const id = Number(expenseId || 0);
  if (!id) return;
  const row = (Array.isArray(accountingExpensesRows) ? accountingExpensesRows : []).find((x) => Number(x?.id || 0) === id);
  if (!row) return;
  accountingExpenseEditId = id;
  const idEl = document.getElementById("accountingExpenseId");
  if (idEl) idEl.value = String(id);
  const market = document.getElementById("accountingExpenseMarketplace");
  if (market) market.value = String(row.marketplace || "all");
  const category = document.getElementById("accountingExpenseCategory");
  if (category) category.value = String(row.category || "");
  const amount = document.getElementById("accountingExpenseAmount");
  if (amount) amount.value = String(Number(row.amount || 0));
  const recurrence = document.getElementById("accountingExpenseRecurrence");
  if (recurrence) recurrence.value = String(row.recurrence || "monthly");
  const start = document.getElementById("accountingExpenseStartDate");
  if (start) start.value = accountingToYmd(row.start_date);
  const end = document.getElementById("accountingExpenseEndDate");
  if (end) end.value = accountingToYmd(row.end_date);
  const note = document.getElementById("accountingExpenseNote");
  if (note) note.value = String(row.note || "");
  const active = document.getElementById("accountingExpenseActive");
  if (active) active.checked = Boolean(row.is_active);
  switchAccountingSubtab("expenses", false);
  accountingSetMeta("accountingExpensesMeta", tr(`Р РµРґР°РєС‚РёСЂРѕРІР°РЅРёРµ СЂР°СЃС…РѕРґР° #${id}`, `Editing expense #${id}`));
}

async function deleteAccountingExpense(expenseId) {
  const id = Number(expenseId || 0);
  if (!id) return;
  if (!confirm(tr("РЈРґР°Р»РёС‚СЊ СЌС‚РѕС‚ СЂР°СЃС…РѕРґ?", "Delete this expense?"))) return;
  const data = await requestJson(`/api/accounting/expenses/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
    timeoutMs: 60000,
  }).catch((e) => {
    alert(e.message);
    return null;
  });
  if (!data) return;
  await loadAccountingExpenses();
  await loadAccountingData();
  accountingSetMeta("accountingExpensesMeta", String(data.message || tr("Р Р°СЃС…РѕРґ СѓРґР°Р»РµРЅ.", "Expense deleted.")));
}

function renderAccountingExpenses() {
  const tbody = document.getElementById("accountingExpensesTable");
  const meta = document.getElementById("accountingExpensesMeta");
  if (!tbody || !meta) return;
  const rows = Array.isArray(accountingExpensesRows) ? accountingExpensesRows : [];
  tbody.innerHTML = "";
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="9">${escapeHtml(tr("Р Р°СЃС…РѕРґС‹ РµС‰Рµ РЅРµ РґРѕР±Р°РІР»РµРЅС‹.", "No expenses yet."))}</td></tr>`;
    meta.textContent = tr("Р Р°СЃС…РѕРґРѕРІ: 0", "Expenses: 0");
    return;
  }
  for (const row of rows) {
    const id = Number(row?.id || 0);
    const active = Boolean(row?.is_active);
    const period = [accountingToYmd(row?.start_date), accountingToYmd(row?.end_date)].filter(Boolean).join(" в†’ ") || "-";
    const trEl = document.createElement("tr");
    trEl.innerHTML = `
      <td>${escapeHtml(String(id || "-"))}</td>
      <td>${escapeHtml(String(row?.marketplace || "all").toUpperCase())}</td>
      <td>${escapeHtml(String(row?.category || "-"))}</td>
      <td>${escapeHtml(formatMoney(row?.amount || 0))}</td>
      <td>${escapeHtml(String(row?.recurrence || "monthly"))}</td>
      <td>${escapeHtml(period)}</td>
      <td>${escapeHtml(active ? tr("РђРєС‚РёРІРµРЅ", "Active") : tr("РћС‚РєР»СЋС‡РµРЅ", "Disabled"))}</td>
      <td>${escapeHtml(String(row?.note || "-"))}</td>
      <td>
        <div class="row-actions">
          <button class="btn-secondary icon-action-btn" type="button" data-tip="${escapeHtml(tr("Р РµРґР°РєС‚РёСЂРѕРІР°С‚СЊ", "Edit"))}" onclick="editAccountingExpense(${id})">&#9998;</button>
          <button class="btn-danger icon-action-btn" type="button" data-tip="${escapeHtml(tr("РЈРґР°Р»РёС‚СЊ", "Delete"))}" onclick="deleteAccountingExpense(${id})">&#128465;</button>
        </div>
      </td>
    `;
    tbody.appendChild(trEl);
  }
  meta.textContent = tr(`Р Р°СЃС…РѕРґРѕРІ: ${rows.length}`, `Expenses: ${rows.length}`);
}

async function loadAccountingSettings() {
  const data = await requestJson("/api/accounting/settings", {
    headers: authHeaders(),
    timeoutMs: 60000,
  }).catch((e) => {
    accountingSetMeta("accountingSettingsMeta", e.message);
    return null;
  });
  if (!data) return null;
  accountingSettingsState = data;
  const setVal = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.value = String(Number(value || 0));
  };
  setVal("accountingVatRate", data.vat_rate);
  setVal("accountingTaxRate", data.tax_rate);
  setVal("accountingAdditionalRate", data.additional_rate);
  setVal("accountingFixedCostPerMonth", data.fixed_cost_per_month);
  accountingSetMeta("accountingSettingsMeta", tr("РќР°СЃС‚СЂРѕР№РєРё СЂР°СЃС‡РµС‚Р° Р·Р°РіСЂСѓР¶РµРЅС‹.", "Accounting settings loaded."));
  return data;
}

async function saveAccountingSettings() {
  const payload = {
    vat_rate: Number(document.getElementById("accountingVatRate")?.value || 0),
    tax_rate: Number(document.getElementById("accountingTaxRate")?.value || 0),
    additional_rate: Number(document.getElementById("accountingAdditionalRate")?.value || 0),
    fixed_cost_per_month: Number(document.getElementById("accountingFixedCostPerMonth")?.value || 0),
  };
  const data = await withBusy(
    tr("РЎРѕС…СЂР°РЅСЏРµРј РїР°СЂР°РјРµС‚СЂС‹ Р±СѓС…РіР°Р»С‚РµСЂРёРёвЂ¦", "Saving accounting settings..."),
    () => requestJson("/api/accounting/settings", {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify(payload),
      timeoutMs: 90000,
    }),
    tr("РџР°СЂР°РјРµС‚СЂС‹ РЅР°Р»РѕРіРѕРІ Рё РґРѕРї. СЂР°СЃС…РѕРґРѕРІ РІР»РёСЏСЋС‚ РЅР° СЂР°СЃС‡РµС‚ С‡РёСЃС‚РѕР№ РїСЂРёР±С‹Р»Рё.", "Tax and extra-cost settings affect net profit calculation.")
  ).catch((e) => {
    alert(e.message);
    return null;
  });
  if (!data) return;
  accountingSettingsState = data;
  accountingSetMeta("accountingSettingsMeta", tr("РџР°СЂР°РјРµС‚СЂС‹ СЃРѕС…СЂР°РЅРµРЅС‹.", "Settings saved."));
  await loadAccountingData();
}

async function loadAccountingExpenses() {
  const data = await requestJson("/api/accounting/expenses", {
    headers: authHeaders(),
    timeoutMs: 60000,
  }).catch((e) => {
    accountingSetMeta("accountingExpensesMeta", e.message);
    return null;
  });
  if (!data) return [];
  accountingExpensesRows = Array.isArray(data.rows) ? data.rows : [];
  renderAccountingExpenses();
  return accountingExpensesRows;
}

async function saveAccountingExpense() {
  const id = Number(document.getElementById("accountingExpenseId")?.value || accountingExpenseEditId || 0);
  const payload = {
    marketplace: String(document.getElementById("accountingExpenseMarketplace")?.value || "all"),
    category: String(document.getElementById("accountingExpenseCategory")?.value || "").trim(),
    amount: Number(document.getElementById("accountingExpenseAmount")?.value || 0),
    recurrence: String(document.getElementById("accountingExpenseRecurrence")?.value || "monthly"),
    start_date: accountingToYmd(document.getElementById("accountingExpenseStartDate")?.value || "") || null,
    end_date: accountingToYmd(document.getElementById("accountingExpenseEndDate")?.value || "") || null,
    note: String(document.getElementById("accountingExpenseNote")?.value || "").trim(),
    is_active: Boolean(document.getElementById("accountingExpenseActive")?.checked),
  };

  if (!payload.category) {
    alert(tr("РЈРєР°Р¶РёС‚Рµ РєР°С‚РµРіРѕСЂРёСЋ СЂР°СЃС…РѕРґР°.", "Specify expense category."));
    return;
  }
  if (!Number.isFinite(payload.amount) || payload.amount < 0) {
    alert(tr("РЈРєР°Р¶РёС‚Рµ РєРѕСЂСЂРµРєС‚РЅСѓСЋ СЃСѓРјРјСѓ СЂР°СЃС…РѕРґР°.", "Specify valid expense amount."));
    return;
  }

  const method = id > 0 ? "PUT" : "POST";
  const endpoint = id > 0 ? `/api/accounting/expenses/${id}` : "/api/accounting/expenses";
  const result = await withBusy(
    id > 0 ? tr("РћР±РЅРѕРІР»СЏРµРј СЂР°СЃС…РѕРґвЂ¦", "Updating expense...") : tr("Р”РѕР±Р°РІР»СЏРµРј СЂР°СЃС…РѕРґвЂ¦", "Adding expense..."),
    () => requestJson(endpoint, {
      method,
      headers: authHeaders(),
      body: JSON.stringify(payload),
      timeoutMs: 90000,
    })
  ).catch((e) => {
    alert(e.message);
    return null;
  });
  if (!result) return;

  resetAccountingExpenseForm();
  await loadAccountingExpenses();
  await loadAccountingData();
  accountingSetMeta("accountingExpensesMeta", id > 0 ? tr("Р Р°СЃС…РѕРґ РѕР±РЅРѕРІР»РµРЅ.", "Expense updated.") : tr("Р Р°СЃС…РѕРґ РґРѕР±Р°РІР»РµРЅ.", "Expense created."));
}

function accountingNormalizeMonthlyKpi(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const toNum = (key) => {
    const num = Number(src[key] || 0);
    return Number.isFinite(num) ? num : 0;
  };
  return {
    turnover: toNum("turnover"),
    orders: Math.round(toNum("orders")),
    units: Math.round(toNum("units")),
    buyouts: Math.round(toNum("buyouts")),
    cogs: toNum("cogs"),
    commission: toNum("commission"),
    acquiring: toNum("acquiring"),
    logistics: toNum("logistics"),
    storage: toNum("storage"),
    penalties: toNum("penalties"),
    ad_spend: toNum("ad_spend"),
    marketplace_expense: toNum("marketplace_expense"),
    custom_expenses: toNum("custom_expenses"),
    other_expenses: toNum("other_expenses"),
    tax_amount: toNum("tax_amount"),
    vat_amount: toNum("vat_amount"),
    tax_total: toNum("tax_total"),
    operating_profit: toNum("operating_profit"),
    net_profit: toNum("net_profit"),
    margin: toNum("margin"),
  };
}

function accountingNormalizeMonthlyPayload(raw) {
  if (!raw || typeof raw !== "object") return null;
  const sourceRows = Array.isArray(raw.months) ? raw.months : [];
  const rows = sourceRows.slice(0, 12).map((row) => {
    const item = row && typeof row === "object" ? row : {};
    return {
      month_key: String(item.month_key || ""),
      label: String(item.label || item.month_key || ""),
      date_from: String(item.date_from || ""),
      date_to: String(item.date_to || ""),
      wb: accountingNormalizeMonthlyKpi(item.wb),
      ozon: accountingNormalizeMonthlyKpi(item.ozon),
      total: accountingNormalizeMonthlyKpi(item.total),
    };
  });
  const metaSrc = raw.meta && typeof raw.meta === "object" ? raw.meta : {};
  return {
    months: rows,
    meta: {
      source: String(metaSrc.source || "live"),
      partial: Boolean(metaSrc.partial),
      warnings: Array.isArray(metaSrc.warnings) ? metaSrc.warnings.map((x) => String(x || "").trim()).filter(Boolean) : [],
      generated_at: String(metaSrc.generated_at || ""),
    },
  };
}

function accountingMonthlyMetric(label, value, tone = "neutral") {
  const toneCls = tone ? ` accounting-month-metric-${tone}` : "";
  return `<span class="accounting-month-metric${toneCls}"><b>${escapeHtml(label)}</b><strong>${escapeHtml(String(value))}</strong></span>`;
}

function renderAccountingMonthlySummary() {
  const host = document.getElementById("accountingMonthlyTable");
  if (!host) return;

  try {
    const state = accountingMonthlyState && typeof accountingMonthlyState === "object"
      ? accountingMonthlyState
      : { months: [], meta: {} };
    const rows = Array.isArray(state.months) ? state.months : [];
    const meta = state.meta && typeof state.meta === "object" ? state.meta : {};
    const warnings = Array.isArray(meta.warnings)
      ? [...new Set(meta.warnings.map((x) => normalizeAccountingWarning(x)).filter(Boolean))]
      : [];

    const statusParts = [];
    if (String(meta.source || "").trim()) {
      const sourceLabel = String(meta.source || "").toLowerCase().includes("cache")
        ? tr("РСЃС‚РѕС‡РЅРёРє: РєСЌС€", "Source: cache")
        : tr("РСЃС‚РѕС‡РЅРёРє: live", "Source: live");
      statusParts.push(sourceLabel);
    }
    if (meta.generated_at) {
      const parsed = Date.parse(String(meta.generated_at));
      if (Number.isFinite(parsed)) {
        statusParts.push(`${tr("РЎС„РѕСЂРјРёСЂРѕРІР°РЅРѕ", "Generated")}: ${new Date(parsed).toLocaleString()}`);
      }
    }
    if (warnings.length) {
      statusParts.push(warnings.slice(0, 2).join(" | "));
      if (warnings.length > 2) statusParts.push(tr(`(+ ${warnings.length - 2} РµС‰С‘ РїСЂРµРґСѓРїСЂРµР¶РґРµРЅРёР№)`, `(+ ${warnings.length - 2} more warnings)`));
    }
    accountingSetMeta("accountingMonthlyStatus", statusParts.join(" | ") || tr("РџРѕРјРµСЃСЏС‡РЅР°СЏ СЃРІРѕРґРєР° Р·Р°РіСЂСѓР¶РµРЅР°.", "Monthly summary loaded."));

    if (!rows.length) {
      host.innerHTML = `<div class="panel"><div class="hint">${escapeHtml(tr("РќРµС‚ РґР°РЅРЅС‹С… Р·Р° РїРѕСЃР»РµРґРЅРёРµ 12 РјРµСЃСЏС†РµРІ.", "No data for the last 12 months."))}</div></div>`;
      return;
    }

    host.innerHTML = rows.map((row) => {
      const wb = row.wb || accountingNormalizeMonthlyKpi({});
      const ozon = row.ozon || accountingNormalizeMonthlyKpi({});
      const total = row.total || accountingNormalizeMonthlyKpi({});
      const deltaNet = Number(wb.net_profit || 0) - Number(ozon.net_profit || 0);
      const deltaClass = deltaNet > 0 ? "accounting-month-delta-positive" : (deltaNet < 0 ? "accounting-month-delta-negative" : "");
      const totalNetClass = Number(total.net_profit || 0) >= 0 ? "accounting-month-total-positive" : "accounting-month-total-negative";

      const buildCard = (title, data, code) => `
        <article class="accounting-month-card accounting-month-card-${code}">
          <header>
            <h4>${escapeHtml(title)}</h4>
            <span>${escapeHtml(`${tr("Orders", "Orders")}: ${formatInt(data.orders || 0)} | ${tr("Units", "Units")}: ${formatInt(data.units || 0)}`)}</span>
          </header>
          <div class="accounting-month-metrics-grid">
            ${accountingMonthlyMetric(tr("Turnover", "Turnover"), formatMoney(data.turnover || 0), "neutral")}
            ${accountingMonthlyMetric(tr("Commission", "Commission"), formatMoney(data.commission || 0), "expense")}
            ${accountingMonthlyMetric(tr("Ad spend", "Ad spend"), formatMoney(data.ad_spend || 0), "expense")}
            ${accountingMonthlyMetric(tr("Logistics", "Logistics"), formatMoney(data.logistics || 0), "expense")}
            ${accountingMonthlyMetric(tr("Storage", "Storage"), formatMoney(data.storage || 0), "expense")}
            ${accountingMonthlyMetric(tr("Penalties", "Penalties"), formatMoney(data.penalties || 0), "expense")}
            ${accountingMonthlyMetric(tr("Acquiring", "Acquiring"), formatMoney(data.acquiring || 0), "expense")}
            ${accountingMonthlyMetric(tr("COGS", "COGS"), formatMoney(data.cogs || 0), "expense")}
            ${accountingMonthlyMetric(tr("Taxes", "Taxes"), formatMoney(data.tax_total || 0), "expense")}
            ${accountingMonthlyMetric(tr("Net profit", "Net profit"), formatMoney(data.net_profit || 0), Number(data.net_profit || 0) >= 0 ? "profit" : "expense")}
          </div>
        </article>
      `;

      return `
        <section class="accounting-month-row">
          <header class="accounting-month-row-head">
            <div>
              <h3>${escapeHtml(row.label || row.month_key || "-")}</h3>
              <span>${escapeHtml(`${row.date_from || ""} - ${row.date_to || ""}`)}</span>
            </div>
            <div class="accounting-month-row-summary">
              <span class="accounting-month-total ${totalNetClass}">${escapeHtml(`${tr("Total net", "Total net")}: ${formatMoney(total.net_profit || 0)}`)}</span>
              <span class="accounting-month-total">${escapeHtml(`${tr("Total turnover", "Total turnover")}: ${formatMoney(total.turnover || 0)}`)}</span>
              <span class="accounting-month-delta ${deltaClass}">${escapeHtml(`${tr("Delta net WB-Ozon", "Delta net WB-Ozon")}: ${formatMoney(deltaNet)}`)}</span>
            </div>
          </header>
          <div class="accounting-month-row-grid">
            ${buildCard("WB", wb, "wb")}
            ${buildCard("Ozon", ozon, "ozon")}
          </div>
        </section>
      `;
    }).join("");
  } catch (err) {
    if (accountingMonthlyLastGoodState) {
      accountingMonthlyState = accountingMonthlyLastGoodState;
    }
    accountingSetMeta(
      "accountingMonthlyStatus",
      tr("Monthly summary render error. Showing last saved data.", "Monthly summary render error. Showing last saved data.")
    );
  }
}

async function loadAccountingMonthlySummary(forceBusy = false) {
  if (modulesLoaded && enabledModules instanceof Set && !enabledModules.has("accounting")) {
    accountingSetMeta("accountingMonthlyStatus", tr("Accounting module is disabled by admin.", "Accounting module is disabled by admin."));
    return false;
  }

  accountingMonthlyRequestSeq += 1;
  const runSeq = accountingMonthlyRequestSeq;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Moscow";
  const fastQp = new URLSearchParams();
  fastQp.set("months", "12");
  fastQp.set("tz", tz);
  fastQp.set("fast", "1");

  accountingSetMeta("accountingMonthlyStatus", tr("Loading monthly profit summary...", "Loading monthly profit summary..."));

  const fastFetcher = () => requestJson(`/api/accounting/monthly-summary?${fastQp.toString()}`, {
    headers: authHeaders(),
    timeoutMs: 180000,
  });

  const fastPayload = forceBusy
    ? await withBusy(
      tr("Refreshing monthly profit summary...", "Refreshing monthly profit summary..."),
      fastFetcher
    ).catch(() => null)
    : await fastFetcher().catch(() => null);

  if (!fastPayload) {
    if (accountingMonthlyLastGoodState) {
      accountingMonthlyState = accountingMonthlyLastGoodState;
      renderAccountingMonthlySummary();
      accountingSetMeta("accountingMonthlyStatus", tr("network: showing last available data", "network: showing last available data"));
    } else {
      accountingSetMeta("accountingMonthlyStatus", tr("network: failed to load monthly summary", "network: failed to load monthly summary"));
    }
    return false;
  }
  if (runSeq !== accountingMonthlyRequestSeq) return false;

  const normalizedFast = accountingNormalizeMonthlyPayload(fastPayload);
  if (!normalizedFast) {
    if (accountingMonthlyLastGoodState) {
      accountingMonthlyState = accountingMonthlyLastGoodState;
      renderAccountingMonthlySummary();
      accountingSetMeta("accountingMonthlyStatus", tr("bad_payload: showing last available data", "bad_payload: showing last available data"));
    } else {
      accountingSetMeta("accountingMonthlyStatus", tr("bad_payload: server returned malformed response", "bad_payload: server returned malformed response"));
    }
    return false;
  }

  accountingMonthlyState = normalizedFast;
  accountingMonthlyLastGoodState = normalizedFast;
  renderAccountingMonthlySummary();

  const source = String(normalizedFast.meta?.source || "").toLowerCase();
  const fromCache = source.includes("cache") || source.includes("db-") || source.includes("fastpath") || source.includes("stale");
  if (!fromCache || accountingMonthlyLiveRefreshInFlight) {
    return true;
  }

  accountingMonthlyLiveRefreshInFlight = true;
  const liveQp = new URLSearchParams(fastQp.toString());
  liveQp.set("fast", "0");
  requestJson(`/api/accounting/monthly-summary?${liveQp.toString()}`, {
    headers: authHeaders(),
    timeoutMs: 180000,
  })
    .then((livePayload) => {
      if (runSeq !== accountingMonthlyRequestSeq) return;
      const normalizedLive = accountingNormalizeMonthlyPayload(livePayload);
      if (!normalizedLive) {
        accountingSetMeta("accountingMonthlyStatus", tr("partial: live refresh returned partial payload", "partial: live refresh returned partial payload"));
        return;
      }
      accountingMonthlyState = normalizedLive;
      accountingMonthlyLastGoodState = normalizedLive;
      renderAccountingMonthlySummary();
    })
    .catch(() => {
      if (runSeq !== accountingMonthlyRequestSeq) return;
      accountingSetMeta("accountingMonthlyStatus", tr("upstream-limited: cached data kept", "upstream-limited: cached data kept"));
    })
    .finally(() => {
      accountingMonthlyLiveRefreshInFlight = false;
    });

  return true;
}

async function loadAccountingData(forceBusy = false, retryAttempt = 0) {
  if (modulesLoaded && enabledModules instanceof Set && !enabledModules.has("accounting")) {
    accountingSetMeta("accountingWarnings", tr("РњРѕРґСѓР»СЊ Р±СѓС…РіР°Р»С‚РµСЂРёРё РѕС‚РєР»СЋС‡РµРЅ Р°РґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂРѕРј.", "Accounting module is disabled by admin."));
    return false;
  }

  accountingRequestSeq += 1;
  const runSeq = accountingRequestSeq;
  const marketplace = String(document.getElementById("accountingMarketplace")?.value || "all").trim().toLowerCase() || "all";
  const dateFrom = accountingToYmd(document.getElementById("accountingDateFrom")?.value || "");
  const dateTo = accountingToYmd(document.getElementById("accountingDateTo")?.value || "");
  const sortBy = String(document.getElementById("accountingAnalysisSort")?.value || "net_profit_desc").trim();
  const search = String(document.getElementById("accountingAnalysisSearch")?.value || "").trim();
  accountingSortMode = sortBy;

  const qp = new URLSearchParams();
  qp.set("marketplace", marketplace);
  qp.set("granularity", "auto");
  qp.set("sort_by", sortBy || "net_profit_desc");
  if (dateFrom) qp.set("date_from", dateFrom);
  if (dateTo) qp.set("date_to", dateTo);
  if (search) qp.set("q", search);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  qp.set("tz", tz);

  accountingSetMeta("accountingWarnings", tr("Р—Р°РіСЂСѓР¶Р°РµРј Р±СѓС…РіР°Р»С‚РµСЂСЃРєРёРµ РґР°РЅРЅС‹Рµ...", "Loading accounting data..."));

  const fetcher = () => requestJson(`/api/accounting/data?${qp.toString()}`, {
    headers: authHeaders(),
    timeoutMs: 180000,
  });

  const data = forceBusy
    ? await withBusy(
      tr("РћР±РЅРѕРІР»СЏРµРј РјРѕРґСѓР»СЊ Р‘СѓС…РіР°Р»С‚РµСЂРёСЏвЂ¦", "Refreshing Accounting module..."),
      fetcher,
      tr("Р—Р°РіСЂСѓР·РєР° С„РёРЅР°РЅСЃРѕРІС‹С… РґР°РЅРЅС‹С… WB/Ozon РјРѕР¶РµС‚ Р·Р°РЅСЏС‚СЊ РґРѕ 1-2 РјРёРЅСѓС‚.", "WB/Ozon financial data load may take up to 1-2 minutes.")
    ).catch((e) => {
      alert(e.message);
      return null;
    })
    : await fetcher().catch((e) => {
      accountingSetMeta("accountingWarnings", e.message);
      return null;
    });

  if (!data) return false;
  if (runSeq !== accountingRequestSeq) return false;
  const hasExpectedShape = Boolean(
    data
    && typeof data === "object"
    && (
      Object.prototype.hasOwnProperty.call(data, "overview")
      || Object.prototype.hasOwnProperty.call(data, "analysis_rows")
      || Object.prototype.hasOwnProperty.call(data, "chart")
      || Object.prototype.hasOwnProperty.call(data, "warnings")
    )
  );
  if (!hasExpectedShape) {
    accountingSetMeta(
      "accountingWarnings",
      tr(
        "РЎРµСЂРІРµСЂ РІРµСЂРЅСѓР» РЅРµРєРѕСЂСЂРµРєС‚РЅС‹Р№ РѕС‚РІРµС‚ РїРѕ Р±СѓС…РіР°Р»С‚РµСЂРёРё. Р”Р°РЅРЅС‹Рµ СЃРѕС…СЂР°РЅРµРЅС‹ РІ С‚РµРєСѓС‰РµРј СЃРѕСЃС‚РѕСЏРЅРёРё, РїРѕРІС‚РѕСЂРёС‚Рµ РѕР±РЅРѕРІР»РµРЅРёРµ.",
        "Server returned malformed accounting payload. Current data is kept, please retry refresh."
      )
    );
    return false;
  }

  accountingOverview = data.overview || {};
  accountingChartRows = Array.isArray(data.chart) ? data.chart : [];
  accountingAnalysisRows = Array.isArray(data.analysis_rows) ? data.analysis_rows : [];
  accountingWarnings = Array.isArray(data.warnings) ? data.warnings : [];
  const hasWb429 = accountingWarnings.some((x) => {
    const low = String(x || "").toLowerCase();
    return low.includes("429") && low.includes("wb");
  });
  if (hasWb429 && (marketplace === "all" || marketplace === "wb") && retryAttempt < 3) {
    accountingSetMeta(
      "accountingWarnings",
      tr(
        "WB API РѕРіСЂР°РЅРёС‡РёР» Р·Р°РїСЂРѕСЃС‹ (429). РџРѕРІС‚РѕСЂСЏРµРј Р·Р°РіСЂСѓР·РєСѓ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё...",
        "WB API rate-limited requests (429). Retrying automatically..."
      )
    );
    await delay(1800 + retryAttempt * 1400);
    if (runSeq !== accountingRequestSeq) return false;
    return loadAccountingData(forceBusy, retryAttempt + 1);
  }

  renderAccountingWarnings();
  renderAccountingOverview();
  renderAccountingChart();
  renderAccountingAnalysis();
  markModuleLoaded("accounting");
  return true;
}

async function loadAccountingWorkspace() {
  if (modulesLoaded && enabledModules instanceof Set && !enabledModules.has("accounting")) {
    return false;
  }
  ensureAccountingDefaults();
  applyAccountingUiLanguage();
  syncAccountingRangeButtons();
  await Promise.all([
    loadAccountingSettings(),
    loadAccountingExpenses(),
    loadAccountingData(),
  ]);
  switchAccountingSubtab(currentAccountingSubtab || "overview", false);
  if ((currentAccountingSubtab || "overview") === "monthly") {
    await loadAccountingMonthlySummary();
  }
  return true;
}

function switchAccountingSubtab(tab, preload = true) {
  const next = accountingNormalizeSubtab(tab);
  currentAccountingSubtab = next;
  for (const key of ACCOUNTING_SUBTABS) {
    const active = key === next;
    document.getElementById(`accountingSubtab${key[0].toUpperCase()}${key.slice(1)}`)?.classList.toggle("hidden", !active);
    document.getElementById(`accountingSubtab${key[0].toUpperCase()}${key.slice(1)}Btn`)?.classList.toggle("active", active);
  }
  try {
    sessionStorage.setItem("seo_wibe_last_accounting_subtab", String(next || "overview"));
  } catch (_) {}
  if (typeof window.refreshSectionHeading === "function") {
    try { window.refreshSectionHeading("accounting"); } catch (_) {}
  }
  if (!preload) return;
  if (next === "overview" || next === "analysis") {
    trackUiActivity("ui_subtab_opened", "accounting", `subtab=${next}`, { cooldownMs: 15000 });
    loadAccountingData();
  } else if (next === "monthly") {
    trackUiActivity("ui_subtab_opened", "accounting", "subtab=monthly", { cooldownMs: 15000 });
    loadAccountingMonthlySummary();
  } else if (next === "expenses") {
    trackUiActivity("ui_subtab_opened", "accounting", "subtab=expenses", { cooldownMs: 15000 });
    loadAccountingExpenses();
  } else if (next === "settings") {
    trackUiActivity("ui_subtab_opened", "accounting", "subtab=settings", { cooldownMs: 15000 });
    loadAccountingSettings();
  }
}

function accountingBuildDownloadFilename(response, fallback) {
  const raw = String(response.headers.get("content-disposition") || "");
  if (!raw) return fallback;
  const utf = raw.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf && utf[1]) {
    try {
      return decodeURIComponent(String(utf[1] || "").trim()).replaceAll('"', "");
    } catch (_) {}
  }
  const plain = raw.match(/filename="?([^";]+)"?/i);
  if (plain && plain[1]) return String(plain[1] || "").trim();
  return fallback;
}

function getAccountingTemplateMarketplace() {
  const picker = document.getElementById("accountingTemplateMarketplace");
  const selected = String(picker?.value || "").trim().toLowerCase();
  if (["all", "wb", "ozon"].includes(selected)) return selected;
  const market = String(document.getElementById("accountingMarketplace")?.value || "all").trim().toLowerCase();
  return ["all", "wb", "ozon"].includes(market) ? market : "all";
}

async function accountingDownload(path, fallbackName, marketplaceOverride = "") {
  const selected = String(marketplaceOverride || "").trim().toLowerCase();
  const marketplace = ["all", "wb", "ozon"].includes(selected) ? selected : getAccountingTemplateMarketplace();
  const headers = {};
  if (typeof token === "string" && token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${path}?marketplace=${encodeURIComponent(marketplace)}`, {
    method: "GET",
    headers,
    credentials: "same-origin",
    cache: "no-store",
  }).catch(() => null);
  if (!response) {
    alert(tr("РќРµ СѓРґР°Р»РѕСЃСЊ СЃРєР°С‡Р°С‚СЊ С„Р°Р№Р». РџСЂРѕРІРµСЂСЊС‚Рµ СЃРѕРµРґРёРЅРµРЅРёРµ.", "Failed to download file. Check network."));
    return;
  }
  if (!response.ok) {
    let errMsg = "";
    try {
      const payload = await response.json();
      errMsg = String(payload?.detail || payload?.message || "").trim();
    } catch (_) {}
    alert(errMsg || tr("РћС€РёР±РєР° СЃРєР°С‡РёРІР°РЅРёСЏ С„Р°Р№Р»Р°.", "Download failed."));
    return;
  }
  const blob = await response.blob();
  const filename = accountingBuildDownloadFilename(response, fallbackName);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 400);
}

async function downloadAccountingTemplate() {
  const selectedMarket = getAccountingTemplateMarketplace();
  localStorage.setItem("accounting_template_marketplace", selectedMarket);
  await accountingDownload("/api/accounting/purchase-prices/template", "purchase_price_template.xlsx", selectedMarket);
}

async function downloadAccountingExport() {
  const selectedMarket = getAccountingTemplateMarketplace();
  localStorage.setItem("accounting_template_marketplace", selectedMarket);
  await accountingDownload("/api/accounting/purchase-prices/export", "purchase_prices_export.xlsx", selectedMarket);
}

async function importAccountingPurchasePrices() {
  const input = document.getElementById("accountingImportFile");
  const file = input?.files?.[0] || null;
  if (!file) {
    alert(tr("Выберите файл Excel (.xlsx или .xlsm) для импорта.", "Select an Excel file (.xlsx or .xlsm) to import."));
    return;
  }
  const form = new FormData();
  form.append("file", file);
  const headers = {};
  if (typeof token === "string" && token) headers.Authorization = `Bearer ${token}`;
  const data = await withBusy(
    tr("Импортируем закупочные цены...", "Importing purchase prices..."),
    async () => {
      const response = await fetch("/api/accounting/purchase-prices/import", {
        method: "POST",
        headers,
        body: form,
        credentials: "same-origin",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String(payload?.detail || payload?.message || tr("Ошибка импорта файла.", "Import failed.")));
      }
      return payload;
    },
    tr("После импорта цены сразу попадут в расчеты прибыли.", "Imported prices are applied to profit calculations immediately.")
  ).catch((e) => {
    alert(e.message);
    return null;
  });
  if (!data) return;
  if (input) input.value = "";

  const lines = [
    `${tr("Обновлено", "Updated")}: ${formatInt(data.updated || 0)}`,
    `${tr("Без изменений", "Skipped")}: ${formatInt(data.skipped || 0)}`,
  ];
  if (Array.isArray(data.unmatched) && data.unmatched.length) {
    lines.push(`${tr("Не сопоставлено", "Unmatched")}: ${data.unmatched.slice(0, 8).join("; ")}`);
  }
  if (Array.isArray(data.errors) && data.errors.length) {
    const details = data.errors.slice(0, 8).map((x) => `- ${x}`).join("\n");
    lines.push(`${tr("Ошибки", "Errors")}:\n${details}`);
  }
  alert(lines.join("\n"));
  await loadAccountingData(true);
}

function applyAccountingUiLanguage() {
  const isEn = currentLang === "en";
  const setText = (selector, value) => {
    const el = document.querySelector(selector);
    if (el) el.textContent = value;
  };
  setText("#accountingSubtabOverviewBtn", isEn ? "Overview" : "РћР±Р·РѕСЂ");
  setText("#accountingSubtabAnalysisBtn", isEn ? "Analysis" : "РђРЅР°Р»РёР·");
  setText("#accountingSubtabMonthlyBtn", isEn ? "Monthly Profit" : "Monthly Profit");
  setText("#accountingSubtabExpensesBtn", isEn ? "Expenses" : "Р Р°СЃС…РѕРґС‹");
  setText("#accountingSubtabSettingsBtn", isEn ? "Taxes & settings" : "РќР°Р»РѕРіРё Рё РїР°СЂР°РјРµС‚СЂС‹");
  setText("#accountingSubtabOverview .panel h3", isEn ? "Profit overview" : "РџСЂРёР±С‹Р»СЊ Рё РѕР±Р·РѕСЂ");
  setText("#accountingSubtabMonthly .panel h3", isEn ? "Monthly Profit by Marketplace" : "Monthly Profit by Marketplace");
  setText("#accountingSubtabOverview .grid-6 button:nth-of-type(1)", isEn ? "Refresh data" : "РћР±РЅРѕРІРёС‚СЊ РґР°РЅРЅС‹Рµ");
  setText("#accountingSubtabOverview .grid-6 button:nth-of-type(2)", isEn ? "Reload all" : "РћР±РЅРѕРІРёС‚СЊ РІСЃРµ");
  const templateMarketSel = document.getElementById("accountingTemplateMarketplace");
  if (templateMarketSel) {
    const prev = String(templateMarketSel.value || localStorage.getItem("accounting_template_marketplace") || "all").toLowerCase();
    templateMarketSel.innerHTML = `
      <option value="all">${isEn ? "Template: WB + Ozon" : "РЁР°Р±Р»РѕРЅ: WB + Ozon"}</option>
      <option value="wb">${isEn ? "Template: WB only" : "РЁР°Р±Р»РѕРЅ: С‚РѕР»СЊРєРѕ WB"}</option>
      <option value="ozon">${isEn ? "Template: Ozon only" : "РЁР°Р±Р»РѕРЅ: С‚РѕР»СЊРєРѕ Ozon"}</option>
    `;
    templateMarketSel.value = ["all", "wb", "ozon"].includes(prev) ? prev : "all";
  }
  setText("#accountingSubtabOverview .accounting-file-actions button:nth-of-type(1)", isEn ? "Download Excel template" : "Скачать шаблон Excel");
  setText("#accountingSubtabOverview .accounting-file-actions button:nth-of-type(2)", isEn ? "Export prices" : "Экспорт цен");
  setText("#accountingSubtabOverview .accounting-file-actions button:nth-of-type(3)", isEn ? "Import purchase prices" : "Импорт закупочных цен");
  const marketSel = document.getElementById("accountingMarketplace");
  if (marketSel) {
    const val = marketSel.value || "all";
    marketSel.innerHTML = `
      <option value="all">${isEn ? "All marketplaces" : "Р’СЃРµ РјР°СЂРєРµС‚РїР»РµР№СЃС‹"}</option>
      <option value="wb">WB</option>
      <option value="ozon">Ozon</option>
    `;
    marketSel.value = ["all", "wb", "ozon"].includes(val) ? val : "all";
  }
  const periodSel = document.getElementById("accountingPeriod");
  if (periodSel) {
    const val = periodSel.value || "day";
    periodSel.innerHTML = `
      <option value="day">${isEn ? "Day" : "Р”РµРЅСЊ"}</option>
      <option value="week">${isEn ? "Week" : "РќРµРґРµР»СЏ"}</option>
      <option value="month">${isEn ? "Month" : "РњРµСЃСЏС†"}</option>
      <option value="quarter">${isEn ? "Quarter" : "РљРІР°СЂС‚Р°Р»"}</option>
      <option value="year">${isEn ? "Year" : "Р“РѕРґ"}</option>
      <option value="custom">${isEn ? "Custom" : "РџСЂРѕРёР·РІРѕР»СЊРЅС‹Р№ РїРµСЂРёРѕРґ"}</option>
    `;
    periodSel.value = val;
  }
  setText("#accountingSubtabAnalysis .panel h3", isEn ? "Product analytics" : "РўРѕРІР°СЂРЅР°СЏ Р°РЅР°Р»РёС‚РёРєР°");
  setText("#accountingSubtabAnalysis .grid-4 button:nth-of-type(1)", isEn ? "Refresh analytics" : "РћР±РЅРѕРІРёС‚СЊ Р°РЅР°Р»РёР·");
  setText("#accountingSubtabAnalysis .grid-4 button:nth-of-type(2)", isEn ? "Reset filters" : "РЎР±СЂРѕСЃРёС‚СЊ С„РёР»СЊС‚СЂС‹");
  setText("#accountingSubtabExpenses .panel h3", isEn ? "Expense management" : "РЈС‡РµС‚ СЂР°СЃС…РѕРґРѕРІ");
  setText("#accountingSubtabExpenses .actions button:nth-of-type(1)", isEn ? "Save expense" : "РЎРѕС…СЂР°РЅРёС‚СЊ СЂР°СЃС…РѕРґ");
  setText("#accountingSubtabExpenses .actions button:nth-of-type(2)", isEn ? "Reset form" : "РЎР±СЂРѕСЃРёС‚СЊ С„РѕСЂРјСѓ");
  setText("#accountingSubtabSettings .panel h3", isEn ? "Taxes and calculation settings" : "РќР°Р»РѕРіРё Рё РїР°СЂР°РјРµС‚СЂС‹ СЂР°СЃС‡РµС‚Р°");
  setText("#accountingSubtabSettings .accounting-settings-grid .field-label:nth-of-type(1) > span", isEn ? "VAT rate, %" : "РЎС‚Р°РІРєР° РќР”РЎ, %");
  setText("#accountingSubtabSettings .accounting-settings-grid .field-label:nth-of-type(2) > span", isEn ? "Profit/USN tax rate, %" : "РќР°Р»РѕРі РЅР° РїСЂРёР±С‹Р»СЊ/РЈРЎРќ, %");
  setText("#accountingSubtabSettings .accounting-settings-grid .field-label:nth-of-type(3) > span", isEn ? "Additional costs from revenue, %" : "Р”РѕРї. СЂР°СЃС…РѕРґС‹ РѕС‚ РІС‹СЂСѓС‡РєРё, %");
  setText("#accountingSubtabSettings .accounting-settings-grid .field-label:nth-of-type(4) > span", isEn ? "Fixed monthly costs, в‚Ѕ" : "Р¤РёРєСЃ. СЂР°СЃС…РѕРґС‹ РІ РјРµСЃСЏС†, в‚Ѕ");
  setText("#accountingSubtabSettings .panel > .hint", isEn ? "VAT and tax are applied to final period profit. Leave 0 for unused settings." : "РќР”РЎ Рё РЅР°Р»РѕРі РїСЂРёРјРµРЅСЏСЋС‚СЃСЏ Рє РёС‚РѕРіРѕРІРѕР№ РїСЂРёР±С‹Р»Рё РїРѕ РІС‹Р±СЂР°РЅРЅРѕРјСѓ РїРµСЂРёРѕРґСѓ. Р•СЃР»Рё РїР°СЂР°РјРµС‚СЂ РЅРµ РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ вЂ” РѕСЃС‚Р°РІСЊС‚Рµ 0.");
  setText("#accountingSubtabSettings .actions button:nth-of-type(1)", isEn ? "Save settings" : "РЎРѕС…СЂР°РЅРёС‚СЊ РїР°СЂР°РјРµС‚СЂС‹");
  setText("#accountingSubtabSettings .actions button:nth-of-type(2)", isEn ? "Refresh" : "РћР±РЅРѕРІРёС‚СЊ");
}

window.switchAccountingSubtab = switchAccountingSubtab;
window.loadAccountingWorkspace = loadAccountingWorkspace;
window.loadAccountingData = loadAccountingData;
window.loadAccountingMonthlySummary = loadAccountingMonthlySummary;
window.setAccountingRange = setAccountingRange;
window.onAccountingPeriodChanged = onAccountingPeriodChanged;
window.onAccountingDateChanged = onAccountingDateChanged;
window.scheduleAccountingReload = scheduleAccountingReload;
window.resetAccountingAnalysisFilters = resetAccountingAnalysisFilters;
window.downloadAccountingTemplate = downloadAccountingTemplate;
window.downloadAccountingExport = downloadAccountingExport;
window.importAccountingPurchasePrices = importAccountingPurchasePrices;
window.loadAccountingSettings = loadAccountingSettings;
window.saveAccountingSettings = saveAccountingSettings;
window.loadAccountingExpenses = loadAccountingExpenses;
window.saveAccountingExpense = saveAccountingExpense;
window.resetAccountingExpenseForm = resetAccountingExpenseForm;
window.editAccountingExpense = editAccountingExpense;
window.deleteAccountingExpense = deleteAccountingExpense;
window.applyAccountingUiLanguage = applyAccountingUiLanguage;

