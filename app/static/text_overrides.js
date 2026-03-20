(function textOverridesV20260320() {
  if (typeof window === "undefined") return;
  if (window.__textOverridesV20260320) return;
  window.__textOverridesV20260320 = true;

  const CP1251_TABLE = [
    "\u0402","\u0403","\u201A","\u0453","\u201E","\u2026","\u2020","\u2021",
    "\u20AC","\u2030","\u0409","\u2039","\u040A","\u040C","\u040B","\u040F",
    "\u0452","\u2018","\u2019","\u201C","\u201D","\u2022","\u2013","\u2014",
    "","\u2122","\u0459","\u203A","\u045A","\u045C","\u045B","\u045F",
    "\u00A0","\u040E","\u045E","\u0408","\u00A4","\u0490","\u00A6","\u00A7",
    "\u0401","\u00A9","\u0404","\u00AB","\u00AC","\u00AD","\u00AE","\u0407",
    "\u00B0","\u00B1","\u0406","\u0456","\u0491","\u00B5","\u00B6","\u00B7",
    "\u0451","\u2116","\u0454","\u00BB","\u0458","\u0405","\u0455","\u0457",
  ];

  const CP1251_REVERSE = new Map();
  for (let index = 0; index < CP1251_TABLE.length; index += 1) {
    const ch = CP1251_TABLE[index];
    if (ch) CP1251_REVERSE.set(ch.charCodeAt(0), 0x80 + index);
  }

  const TEXT_ATTRS = ["title", "placeholder", "aria-label", "data-tip"];
  let repairQueued = false;
  let copyQueued = false;

  function pick(ru, en) {
    return currentLang === "en" ? en : ru;
  }

  function countMatches(value, regex) {
    const match = String(value || "").match(regex);
    return match ? match.length : 0;
  }

  function encodeCp1251(value) {
    const bytes = [];
    for (const ch of String(value || "")) {
      const code = ch.charCodeAt(0);
      if (code <= 0x7f) {
        bytes.push(code);
        continue;
      }
      if (code >= 0x0410 && code <= 0x042f) {
        bytes.push(0xc0 + (code - 0x0410));
        continue;
      }
      if (code >= 0x0430 && code <= 0x044f) {
        bytes.push(0xe0 + (code - 0x0430));
        continue;
      }
      if (code === 0x0401) {
        bytes.push(0xa8);
        continue;
      }
      if (code === 0x0451) {
        bytes.push(0xb8);
        continue;
      }
      const mapped = CP1251_REVERSE.get(code);
      if (typeof mapped === "number") {
        bytes.push(mapped);
        continue;
      }
      return null;
    }
    return new Uint8Array(bytes);
  }

  function brokenScore(value) {
    const text = String(value || "");
    let score = 0;
    score += countMatches(text, /[\u0402-\u040f\u0452-\u045f\u2018\u2019\u201a\u201c\u201d\u201e\u2020\u2021\u2022\u2026\u2030\u2039\u203a\u20ac\u2122]/g) * 6;
    score += countMatches(text, /\uFFFD/g) * 8;
    score += countMatches(text, /\?{3,}/g) * 10;
    score += countMatches(text, /[\u0420\u0421]/g) * 2;
    score += countMatches(text, /\u0432\u0402/g) * 5;
    score += countMatches(text, /[\u00d0\u00d1\u00e2]/g) * 4;
    return score;
  }

  function readableScore(value) {
    const text = String(value || "");
    let score = 0;
    score += countMatches(text, /[\u0410-\u042f\u0430-\u044f\u0401\u0451]/g) * 3;
    score += countMatches(text, /[A-Za-z]/g) * 1;
    score += countMatches(text, /\d/g) * 0.5;
    score -= brokenScore(text);
    return score;
  }

  function looksBroken(value) {
    const text = String(value || "");
    return brokenScore(text) >= 6;
  }

  function looksLikeUtf8Mojibake(value) {
    const text = String(value || "");
    return /(?:[\u0420\u0421][\u0400-\u04ff]){2,}/.test(text);
  }

  function maybeRepairOnce(value) {
    const original = String(value || "");
    const forced = looksLikeUtf8Mojibake(original);
    if (!original || (!forced && !looksBroken(original))) return original;
    const bytes = encodeCp1251(original);
    if (!bytes) return original;
    let fixed = "";
    try {
      fixed = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch (_) {
      return original;
    }
    if (!fixed || fixed === original) return original;
    if (!forced && readableScore(fixed) <= readableScore(original)) return original;
    return fixed;
  }

  function repairText(value) {
    let current = String(value ?? "");
    for (let step = 0; step < 3; step += 1) {
      const next = maybeRepairOnce(current);
      if (next === current) break;
      current = next;
    }
    return current;
  }

  window.__repairMojibakeText = repairText;

  function repairTextNode(node) {
    if (!node || node.nodeType !== Node.TEXT_NODE) return;
    const original = String(node.nodeValue || "");
    const fixed = repairText(original);
    if (fixed !== original) node.nodeValue = fixed;
  }

  function repairElementAttributes(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return;
    if (["SCRIPT", "STYLE", "NOSCRIPT"].includes(node.tagName)) return;
    TEXT_ATTRS.forEach((attr) => {
      if (!node.hasAttribute(attr)) return;
      const original = node.getAttribute(attr) || "";
      const fixed = repairText(original);
      if (fixed !== original) node.setAttribute(attr, fixed);
    });
    if (node.tagName === "INPUT" || node.tagName === "TEXTAREA") {
      const type = String(node.getAttribute("type") || "").toLowerCase();
      if (["button", "submit", "reset"].includes(type)) {
        const original = node.value || "";
        const fixed = repairText(original);
        if (fixed !== original) node.value = fixed;
      }
    }
  }

  function repairTree(root) {
    if (!root) return;
    if (root.nodeType === Node.TEXT_NODE) {
      repairTextNode(root);
      return;
    }
    if (root.nodeType === Node.ELEMENT_NODE) {
      repairElementAttributes(root);
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, null);
    let current = walker.currentNode;
    while (current) {
      if (current.nodeType === Node.TEXT_NODE) repairTextNode(current);
      if (current.nodeType === Node.ELEMENT_NODE) repairElementAttributes(current);
      current = walker.nextNode();
    }
  }

  function setText(selector, ru, en) {
    document.querySelectorAll(selector).forEach((node) => {
      node.textContent = pick(ru, en);
    });
  }

  function setHtml(selector, ru, en) {
    document.querySelectorAll(selector).forEach((node) => {
      node.innerHTML = pick(ru, en);
    });
  }

  function setAttr(selector, attr, ru, en) {
    document.querySelectorAll(selector).forEach((node) => {
      node.setAttribute(attr, pick(ru, en));
    });
  }

  function headingCopy() {
    const tab = typeof currentTab === "undefined" ? "sales" : String(currentTab || "sales").trim().toLowerCase();
    const productsSubtab = typeof currentProductsSubtab === "undefined" ? "catalog" : String(currentProductsSubtab || "catalog").trim().toLowerCase();
    const reviewsSubtab = typeof currentReviewsSubtab === "undefined" ? "reviews" : String(currentReviewsSubtab || "reviews").trim().toLowerCase();
    const accountingSubtab = typeof currentAccountingSubtab === "undefined" ? "overview" : String(currentAccountingSubtab || "overview").trim().toLowerCase();
    const adsSubtab = typeof currentAdsSubtab === "undefined" ? "campaigns" : String(currentAdsSubtab || "campaigns").trim().toLowerCase();
    const socialSubtab = typeof currentSocialSubtab === "undefined" ? "chat" : String(currentSocialSubtab || "chat").trim().toLowerCase();
    const helpSubtab = typeof currentHelpSubtab === "undefined" ? "docs" : String(currentHelpSubtab || "docs").trim().toLowerCase();

    const main = {
      sales: { ru: ["\u0421\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043a\u0430 \u0438 \u0434\u0430\u0448\u0431\u043e\u0440\u0434", "\u041f\u0440\u043e\u0434\u0430\u0436\u0438, KPI \u0438 \u0434\u0438\u043d\u0430\u043c\u0438\u043a\u0430 \u0432 \u043e\u0434\u043d\u043e\u043c \u043c\u043e\u0434\u0443\u043b\u0435"], en: ["Statistics & Dashboard", "Sales, KPIs and trends in one module"] },
      products: { ru: ["\u0422\u043e\u0432\u0430\u0440\u044b", "\u0418\u043c\u043f\u043e\u0440\u0442, \u043a\u0430\u0440\u0442\u043e\u0447\u043a\u0438 \u0438 SEO-\u043f\u0440\u0430\u0432\u043a\u0438"], en: ["Products", "Import, product cards, and SEO updates"] },
      reviews: { ru: ["\u041e\u0442\u0437\u044b\u0432\u044b / \u0412\u043e\u043f\u0440\u043e\u0441\u044b", "\u041e\u0442\u0432\u0435\u0442\u044b \u043a\u043b\u0438\u0435\u043d\u0442\u0430\u043c \u0438 AI-\u0447\u0435\u0440\u043d\u043e\u0432\u0438\u043a\u0438"], en: ["Reviews / Questions", "Customer replies and AI drafts"] },
      accounting: { ru: ["\u0411\u0443\u0445\u0433\u0430\u043b\u0442\u0435\u0440\u0438\u044f", "\u041f\u0440\u0438\u0431\u044b\u043b\u044c, \u0440\u0430\u0441\u0445\u043e\u0434\u044b \u0438 \u044d\u043a\u043e\u043d\u043e\u043c\u0438\u043a\u0430 WB/Ozon"], en: ["Accounting", "Profit, costs, and WB/Ozon economics"] },
      ads: { ru: ["\u0420\u0435\u043a\u043b\u0430\u043c\u0430 WB/Ozon", "\u041a\u0430\u043c\u043f\u0430\u043d\u0438\u0438, \u0430\u043d\u0430\u043b\u0438\u0442\u0438\u043a\u0430 \u0438 \u0440\u0435\u043a\u043e\u043c\u0435\u043d\u0434\u0430\u0446\u0438\u0438"], en: ["WB/Ozon Ads", "Campaigns, analytics, and recommendations"] },
      social: { ru: ["\u0421\u043e\u0446\u0438\u0430\u043b\u044c\u043d\u044b\u0439", "\u0427\u0430\u0442\u044b, \u0437\u0430\u0434\u0430\u0447\u0438, \u043a\u0430\u043b\u0435\u043d\u0434\u0430\u0440\u044c \u0438 \u043a\u043e\u043c\u0430\u043d\u0434\u043d\u0430\u044f \u0440\u0430\u0431\u043e\u0442\u0430"], en: ["Social Hub", "Chats, tasks, calendar, and teamwork"] },
      profile: { ru: ["\u041f\u0440\u043e\u0444\u0438\u043b\u044c", "\u041f\u0440\u043e\u0444\u0438\u043b\u044c \u043a\u043e\u043c\u043f\u0430\u043d\u0438\u0438, \u0434\u043e\u0441\u0442\u0443\u043f\u044b \u0438 \u0438\u043d\u0442\u0435\u0433\u0440\u0430\u0446\u0438\u0438"], en: ["Profile", "Company profile, access, and integrations"] },
      help: { ru: ["\u0421\u043f\u0440\u0430\u0432\u043a\u0430", "\u0414\u043e\u043a\u0443\u043c\u0435\u043d\u0442\u0430\u0446\u0438\u044f \u0438 \u043f\u043e\u043c\u043e\u0449\u044c \u043f\u043e \u043c\u043e\u0434\u0443\u043b\u044f\u043c"], en: ["Help Center", "Documentation and help by module"] },
    };

    const subtabs = {
      products: {
        catalog: { ru: ["\u0422\u043e\u0432\u0430\u0440\u044b", "\u041a\u0430\u0442\u0430\u043b\u043e\u0433, \u043a\u0430\u0440\u0442\u043e\u0447\u043a\u0438 \u0438 \u0441\u0438\u043d\u0445\u0440\u043e\u043d\u0438\u0437\u0430\u0446\u0438\u044f"], en: ["Products", "Catalog, product cards, and sync"] },
        seo: { ru: ["SEO-\u0437\u0430\u0434\u0430\u0447\u0438", "\u0413\u0435\u043d\u0435\u0440\u0430\u0446\u0438\u044f, \u043f\u0440\u043e\u0432\u0435\u0440\u043a\u0430 \u0438 \u043f\u0440\u0438\u043c\u0435\u043d\u0435\u043d\u0438\u0435 \u0442\u0435\u043a\u0441\u0442\u043e\u0432"], en: ["SEO Jobs", "Generate, review, and apply texts"] },
      },
      reviews: {
        reviews: { ru: ["\u041e\u0442\u0432\u0435\u0442\u044b \u043d\u0430 \u043e\u0442\u0437\u044b\u0432\u044b", "\u041e\u0442\u0437\u044b\u0432\u044b WB \u0438 Ozon \u0441 AI-\u043e\u0442\u0432\u0435\u0442\u0430\u043c\u0438"], en: ["Review Replies", "WB and Ozon reviews with AI replies"] },
        questions: { ru: ["\u041e\u0442\u0432\u0435\u0442\u044b \u043d\u0430 \u0432\u043e\u043f\u0440\u043e\u0441\u044b", "\u0412\u043e\u043f\u0440\u043e\u0441\u044b \u043f\u043e\u043a\u0443\u043f\u0430\u0442\u0435\u043b\u0435\u0439 \u0438 \u0431\u044b\u0441\u0442\u0440\u044b\u0435 \u043e\u0442\u0432\u0435\u0442\u044b"], en: ["Question Replies", "Customer questions and quick answers"] },
        returns: { ru: ["\u0412\u043e\u0437\u0432\u0440\u0430\u0442\u044b", "\u0417\u0430\u044f\u0432\u043a\u0438 \u043d\u0430 \u0432\u043e\u0437\u0432\u0440\u0430\u0442 \u0438 \u043f\u043e\u043d\u044f\u0442\u043d\u044b\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044f"], en: ["Returns", "Return requests and next actions"] },
      },
      accounting: {
        overview: { ru: ["\u0411\u0443\u0445\u0433\u0430\u043b\u0442\u0435\u0440\u0438\u044f", "KPI, \u043f\u0440\u0438\u0431\u044b\u043b\u044c \u0438 \u044d\u043a\u043e\u043d\u043e\u043c\u0438\u043a\u0430 \u043f\u043e \u043f\u0435\u0440\u0438\u043e\u0434\u0430\u043c"], en: ["Accounting", "KPIs, profit, and period economics"] },
        analysis: { ru: ["\u0410\u043d\u0430\u043b\u0438\u0437 \u043f\u0440\u0438\u0431\u044b\u043b\u0438", "\u0412\u044b\u0440\u0443\u0447\u043a\u0430, \u0440\u0430\u0441\u0445\u043e\u0434\u044b \u0438 \u043c\u0430\u0440\u0436\u0438\u043d\u0430\u043b\u044c\u043d\u043e\u0441\u0442\u044c"], en: ["Profit Analysis", "Revenue, costs, and margin"] },
        monthly: { ru: ["\u041f\u043e\u043c\u0435\u0441\u044f\u0447\u043d\u0430\u044f \u043f\u0440\u0438\u0431\u044b\u043b\u044c", "\u0421\u0440\u0430\u0432\u043d\u0435\u043d\u0438\u0435 WB \u0438 Ozon \u043f\u043e 12 \u043c\u0435\u0441\u044f\u0446\u0430\u043c"], en: ["Monthly Profit", "WB and Ozon comparison by 12 months"] },
        expenses: { ru: ["\u0420\u0430\u0441\u0445\u043e\u0434\u044b", "\u0423\u0447\u0435\u0442 \u0440\u0430\u0441\u0445\u043e\u0434\u043e\u0432 \u0438 \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u0439"], en: ["Expenses", "Expense tracking and categories"] },
        settings: { ru: ["\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438 \u0431\u0443\u0445\u0433\u0430\u043b\u0442\u0435\u0440\u0438\u0438", "\u0428\u0430\u0431\u043b\u043e\u043d\u044b, \u0441\u0442\u0430\u0432\u043a\u0438 \u0438 \u043f\u0440\u0430\u0432\u0438\u043b\u0430 \u0440\u0430\u0441\u0447\u0435\u0442\u0430"], en: ["Accounting Settings", "Templates, rates, and rules"] },
      },
      ads: {
        campaigns: { ru: ["\u0420\u0435\u043a\u043b\u0430\u043c\u043d\u044b\u0435 \u043a\u0430\u043c\u043f\u0430\u043d\u0438\u0438", "\u041a\u0430\u043c\u043f\u0430\u043d\u0438\u0438 WB \u0441 \u0431\u044e\u0434\u0436\u0435\u0442\u0430\u043c\u0438 \u0438 \u0441\u0442\u0430\u0442\u0443\u0441\u0430\u043c\u0438"], en: ["Ad Campaigns", "WB campaigns with budgets and statuses"] },
        analytics: { ru: ["\u0410\u043d\u0430\u043b\u0438\u0442\u0438\u043a\u0430 \u0440\u0435\u043a\u043b\u0430\u043c\u044b", "\u041f\u043e\u043a\u0430\u0437\u044b, \u043a\u043b\u0438\u043a\u0438, \u0437\u0430\u043a\u0430\u0437\u044b \u0438 \u0440\u0430\u0441\u0445\u043e\u0434\u044b"], en: ["Ads Analytics", "Views, clicks, orders, and spend"] },
        recommendations: { ru: ["\u0420\u0435\u043a\u043e\u043c\u0435\u043d\u0434\u0430\u0446\u0438\u0438 \u043f\u043e \u0440\u0435\u043a\u043b\u0430\u043c\u0435", "\u0421\u0442\u0430\u0432\u043a\u0438 \u0438 \u0440\u0435\u0437\u0435\u0440\u0432\u044b \u0434\u043b\u044f \u043e\u043f\u0442\u0438\u043c\u0438\u0437\u0430\u0446\u0438\u0438"], en: ["Ads Recommendations", "Bids and efficiency recommendations"] },
        bidder: { ru: ["\u0411\u0438\u0434\u0435\u0440 WB Ads", "\u0410\u0432\u0442\u043e\u043c\u0430\u0442\u0438\u0447\u0435\u0441\u043a\u043e\u0435 \u0443\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0438\u0435 \u0441\u0442\u0430\u0432\u043a\u0430\u043c\u0438"], en: ["WB Ads Bidder", "Automatic bid management"] },
        ozon: { ru: ["\u0420\u0435\u043a\u043b\u0430\u043c\u0430 Ozon", "\u041a\u0430\u043c\u043f\u0430\u043d\u0438\u0438 \u0438 \u0441\u0442\u0430\u0432\u043a\u0438 Ozon"], en: ["Ozon Ads", "Ozon campaigns and bids"] },
      },
      social: {
        chat: { ru: ["\u0427\u0430\u0442\u044b", "\u041a\u043e\u043c\u0430\u043d\u0434\u043d\u044b\u0435 \u0438 \u043b\u0438\u0447\u043d\u044b\u0435 \u043f\u0435\u0440\u0435\u043f\u0438\u0441\u043a\u0438"], en: ["Chats", "Team and direct conversations"] },
        tasks: { ru: ["\u0417\u0430\u0434\u0430\u0447\u0438", "\u041f\u0440\u043e\u0435\u043a\u0442\u043d\u044b\u0435 \u0438 \u043b\u0438\u0447\u043d\u044b\u0435 \u0437\u0430\u0434\u0430\u0447\u0438 \u0441 \u0434\u0435\u0434\u043b\u0430\u0439\u043d\u0430\u043c\u0438"], en: ["Tasks", "Project and personal tasks with deadlines"] },
        calendar: { ru: ["\u041a\u0430\u043b\u0435\u043d\u0434\u0430\u0440\u044c", "\u0421\u043e\u0431\u044b\u0442\u0438\u044f, \u0434\u0435\u0434\u043b\u0430\u0439\u043d\u044b \u0438 \u0441\u0438\u043d\u0445\u0440\u043e\u043d\u0438\u0437\u0430\u0446\u0438\u044f"], en: ["Calendar", "Events, deadlines, and sync"] },
        calculator: { ru: ["\u041a\u0430\u043b\u044c\u043a\u0443\u043b\u044f\u0442\u043e\u0440", "\u0411\u044b\u0441\u0442\u0440\u044b\u0435 \u0440\u0430\u0441\u0447\u0435\u0442\u044b \u0438 \u043a\u043e\u043d\u0432\u0435\u0440\u0442\u0430\u0446\u0438\u044f"], en: ["Calculator", "Quick calculations and conversion"] },
        notes: { ru: ["\u0417\u0430\u043c\u0435\u0442\u043a\u0438", "\u041b\u0438\u0447\u043d\u044b\u0435 \u0438 \u043a\u043e\u043c\u0430\u043d\u0434\u043d\u044b\u0435 \u0437\u0430\u043c\u0435\u0442\u043a\u0438"], en: ["Notes", "Personal and team notes"] },
        games: { ru: ["\u0418\u0433\u0440\u044b", "\u0428\u0430\u0445\u043c\u0430\u0442\u044b, \u043c\u043e\u0440\u0441\u043a\u043e\u0439 \u0431\u043e\u0439 \u0438 \u0448\u0430\u0448\u043a\u0438"], en: ["Games", "Chess, battleship, and checkers"] },
      },
      help: {
        docs: { ru: ["\u0421\u043f\u0440\u0430\u0432\u043a\u0430", "\u0414\u043e\u043a\u0443\u043c\u0435\u043d\u0442\u0430\u0446\u0438\u044f \u043f\u043e \u043c\u043e\u0434\u0443\u043b\u044f\u043c \u0438 \u0441\u0446\u0435\u043d\u0430\u0440\u0438\u044f\u043c"], en: ["Help Center", "Documentation by module and scenario"] },
        assistant: { ru: ["AI-\u043f\u043e\u043c\u043e\u0449\u043d\u0438\u043a", "\u041e\u0442\u0432\u0435\u0442\u044b \u043f\u043e \u0440\u0430\u0431\u043e\u0442\u0435 \u0441\u0435\u0440\u0432\u0438\u0441\u0430 \u0438 \u043c\u043e\u0434\u0443\u043b\u0435\u0439"], en: ["AI Assistant", "Answers about the service and modules"] },
        downloads: { ru: ["\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0438", "APK, \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0438\u044f \u0438 \u0438\u0441\u0442\u043e\u0440\u0438\u044f \u0440\u0435\u043b\u0438\u0437\u043e\u0432"], en: ["Downloads", "APK, updates, and release history"] },
      },
    };

    if (tab === "products") return subtabs.products[productsSubtab] || main.products;
    if (tab === "reviews") return subtabs.reviews[reviewsSubtab] || main.reviews;
    if (tab === "accounting") return subtabs.accounting[accountingSubtab] || main.accounting;
    if (tab === "ads") return subtabs.ads[adsSubtab] || main.ads;
    if (tab === "social") return subtabs.social[socialSubtab] || main.social;
    if (tab === "help") return subtabs.help[helpSubtab] || main.help;
    return main[tab] || main.sales;
  }

  function applySectionHeadingOverride() {
    const titleNode = document.getElementById("sectionTitle");
    const subtitleNode = document.getElementById("sectionSubtitle");
    if (!titleNode || !subtitleNode) return;
    const copy = headingCopy();
    const [ruTitle, ruSubtitle] = copy.ru || ["", ""];
    const [enTitle, enSubtitle] = copy.en || ["", ""];
    titleNode.textContent = pick(ruTitle, enTitle);
    subtitleNode.textContent = pick(ruSubtitle, enSubtitle);
  }

  function applyKnownCopy() {
    setText("#authToolbarSubtitle", "\u0432\u0441\u0451 \u0434\u043b\u044f \u043c\u0430\u0440\u043a\u0435\u0442\u043f\u043b\u0435\u0439\u0441\u043e\u0432", "everything for marketplaces");
    setText(".auth-toolbar-nav a[href='#authSection']", "\u041f\u043b\u0430\u0442\u0444\u043e\u0440\u043c\u0430", "Platform");
    setText(".auth-toolbar-nav a[href='#landingModules']", "\u041c\u043e\u0434\u0443\u043b\u0438", "Modules");
    setText(".auth-toolbar-nav a[href='#authSection'][onclick*='switchAuthMode']", "\u0420\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u044f", "Sign up");
    setText("#authToolbarLoginBtn, #authModeLoginBtn, #authLoginTitle", "\u0412\u0445\u043e\u0434", "Log in");
    setText("#authToolbarRegisterBtn, #authModeRegisterBtn, #authRegisterTitle", "\u0420\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u044f", "Sign up");
    setText("#authLoginHint", "\u0418\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u0439\u0442\u0435 email \u0432\u043b\u0430\u0434\u0435\u043b\u044c\u0446\u0430 \u0438\u043b\u0438 \u0441\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a\u0430.", "Use the owner or employee email.");
    setText("#authToRegisterBtn", "\u041d\u0435\u0442 \u0430\u043a\u043a\u0430\u0443\u043d\u0442\u0430? \u0420\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u044f", "Need an account? Sign up");
    setText("#authRegisterHint", "\u0421\u043e\u0437\u0434\u0430\u0439\u0442\u0435 \u043d\u043e\u0432\u044b\u0439 \u0430\u043a\u043a\u0430\u0443\u043d\u0442. \u041f\u043e\u0441\u043b\u0435 \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u0438 \u043f\u043e\u044f\u0432\u0438\u0442\u0441\u044f \u0432\u0430\u0448 \u043b\u0438\u0447\u043d\u044b\u0439 \u043a\u0430\u0431\u0438\u043d\u0435\u0442.", "Create a new account. After registration your workspace will be ready.");
    setText("#authRegisterSubmitBtn", "\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u0430\u043a\u043a\u0430\u0443\u043d\u0442", "Create account");
    setText("#authToLoginBtn", "\u0423\u0436\u0435 \u0435\u0441\u0442\u044c \u0430\u043a\u043a\u0430\u0443\u043d\u0442? \u0412\u0445\u043e\u0434", "Already have an account? Log in");
    setText("#landingCard3Meta2", "AI-\u043e\u0442\u0432\u0435\u0442\u044b + \u0435\u0434\u0438\u043d\u044b\u0439 \u0438\u043d\u0442\u0435\u0440\u0444\u0435\u0439\u0441", "AI replies + one interface");
    setHtml("#landingCard4Item3", "<b>\u041a\u043e\u043c\u0430\u043d\u0434\u0430:</b> \u0447\u0430\u0442\u044b, \u0437\u0430\u0434\u0430\u0447\u0438 \u0438 \u043a\u0430\u043b\u0435\u043d\u0434\u0430\u0440\u044c.", "<b>Team:</b> chats, tasks, and calendar.");
    setAttr(".sidebar-toggle", "title", "\u0421\u0432\u0435\u0440\u043d\u0443\u0442\u044c / \u0440\u0430\u0437\u0432\u0435\u0440\u043d\u0443\u0442\u044c \u043c\u0435\u043d\u044e", "Collapse / expand menu");
    setText("#mobileDrawerQuickNavLabel", "\u0420\u0430\u0437\u0434\u0435\u043b", "Section");
    setText(".nav-btn[data-tab='sales']", "\u0421\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043a\u0430 \u0438 \u0434\u0430\u0448\u0431\u043e\u0440\u0434", "Statistics & Dashboard");
    setText(".nav-btn[data-tab='social']", "\u0421\u043e\u0446\u0438\u0430\u043b\u044c\u043d\u044b\u0439", "Social Hub");
    setText(".nav-btn[data-tab='help']", "\u0421\u043f\u0440\u0430\u0432\u043a\u0430", "Help Center");
    setText("#mobileDrawerQuickNav option[value='sales_dashboard'], #mobileQuickNav option[value='sales_dashboard']", "\u0414\u0430\u0448\u0431\u043e\u0440\u0434", "Dashboard");
    setText("#mobileDrawerQuickNav option[value='ads_recommendations'], #mobileQuickNav option[value='ads_recommendations']", "\u0420\u0435\u043a\u043e\u043c\u0435\u043d\u0434\u0430\u0446\u0438\u0438", "Recommendations");
    setText("#mobileDrawerQuickNav option[value='help_main'], #mobileQuickNav option[value='help_main']", "\u0421\u043f\u0440\u0430\u0432\u043a\u0430", "Help Center");
    setText("#mobileDrawerThemeSelect option[value='light'], #uiThemeSelect option[value='light']", "\u0421\u0432\u0435\u0442\u043b\u0430\u044f", "Light");
    setAttr("#socialChatHeadCollapseBtn", "title", "\u0421\u0432\u0435\u0440\u043d\u0443\u0442\u044c \u0448\u0430\u043f\u043a\u0443", "Collapse header");
    setText("button[onclick='socialCalcVolume()']", "\u0420\u0430\u0441\u0441\u0447\u0438\u0442\u0430\u0442\u044c \u043e\u0431\u044a\u0435\u043c", "Calculate volume");
    setText("#teamModalSaveBtn", "\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c", "Save");
    setText("#teamMemberEditTitle", "\u0421\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a", "Team member");
    setText("#socialModalTitle", "\u0421\u043e\u0446\u0438\u0430\u043b\u044c\u043d\u044b\u0439 \u043c\u043e\u0434\u0443\u043b\u044c", "Social module");
    setText("#productsPageInfoTop, #productsPageInfoBottom", "\u0421\u0442\u0440\u0430\u043d\u0438\u0446\u0430 1 \u0438\u0437 1", "Page 1 of 1");
    applySectionHeadingOverride();
  }

  function queueRepair(root) {
    if (repairQueued) return;
    repairQueued = true;
    requestAnimationFrame(() => {
      repairQueued = false;
      repairTree(root || document.body);
    });
  }

  function queueCopy() {
    if (copyQueued) return;
    copyQueued = true;
    requestAnimationFrame(() => {
      copyQueued = false;
      applyKnownCopy();
    });
  }

  function wrapTranslator(name) {
    if (typeof globalThis[name] !== "function") return;
    const original = globalThis[name];
    if (original.__mojibakeWrapped) return;
    const wrapped = function wrappedTranslator() {
      const args = Array.from(arguments).map((value, index) => {
        if ((index === 0 || index === 1) && typeof value === "string") {
          return repairText(value);
        }
        return value;
      });
      return original.apply(this, args);
    };
    wrapped.__mojibakeWrapped = true;
    globalThis[name] = wrapped;
  }

  function wrapMessageFunction(name) {
    if (typeof globalThis[name] !== "function") return;
    const original = globalThis[name];
    if (original.__mojibakeWrapped) return;
    const wrapped = function wrappedMessageFn() {
      const args = Array.from(arguments);
      if (typeof args[0] === "string") args[0] = repairText(args[0]);
      if (typeof args[1] === "string") args[1] = repairText(args[1]);
      return original.apply(this, args);
    };
    wrapped.__mojibakeWrapped = true;
    globalThis[name] = wrapped;
  }

  function wrapAfter(name) {
    if (typeof globalThis[name] !== "function") return;
    const original = globalThis[name];
    if (original.__copyWrapped) return;
    const wrapped = function wrappedAfter() {
      const result = original.apply(this, arguments);
      queueCopy();
      queueRepair();
      return result;
    };
    wrapped.__copyWrapped = true;
    globalThis[name] = wrapped;
  }

  wrapTranslator("tr");
  wrapTranslator("t");
  wrapMessageFunction("alert");
  wrapMessageFunction("confirm");
  wrapMessageFunction("showToast");
  wrapMessageFunction("showGlobalToast");

  [
    "showTab",
    "refreshSectionHeading",
    "switchProductsSubtab",
    "switchReviewsSubtab",
    "switchAccountingSubtab",
    "switchAdsSubtab",
    "switchSocialSubtab",
    "switchHelpSubtab",
    "changeUiLang",
    "changeUiLangFromDrawer",
    "changeAuthLang",
    "renderWbQuestions",
    "renderWbReviews",
    "socialRenderTasks",
    "socialRenderCalendar",
    "socialRenderNotes",
    "socialOpenModal",
  ].forEach(wrapAfter);

  const observer = new MutationObserver((mutations) => {
    let shouldRepair = false;
    for (const mutation of mutations) {
      if (mutation.type === "characterData") {
        shouldRepair = true;
        repairTextNode(mutation.target);
        continue;
      }
      if (mutation.type === "attributes") {
        shouldRepair = true;
        repairElementAttributes(mutation.target);
        continue;
      }
      if (mutation.type === "childList" && mutation.addedNodes.length) {
        shouldRepair = true;
        mutation.addedNodes.forEach((node) => repairTree(node));
      }
    }
    if (shouldRepair) queueCopy();
  });

  function start() {
    queueRepair();
    queueCopy();
    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: TEXT_ATTRS,
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
