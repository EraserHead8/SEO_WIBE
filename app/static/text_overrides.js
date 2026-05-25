(function textOverridesV20260323s2() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.__textOverridesV20260323s2) return;
  window.__textOverridesV20260323s2 = true;
  window.__seoWibeSamsungCalendarController = "v4";
  const disableTextBehaviorOverrides = true;
  const disableInteractiveRuntimeOverrides = true;
  window.__seoWibeDisableTextBehaviorOverrides = disableTextBehaviorOverrides;
  window.__seoWibeDisableInteractiveRuntimeOverrides = disableInteractiveRuntimeOverrides;
  window.__seoWibeUseTextOverridesCalendarV4 = disableTextBehaviorOverrides ? false : true;
  const behaviorOverrideNames = new Set([
    "socialLoadNotificationCenterRows",
    "socialRenderNotificationCenter",
    "socialToggleNotificationCenter",
    "socialRenderCalendar",
    "socialLoadCalendar",
    "socialShiftCalendar",
    "socialShowDay",
    "socialOpenCalendarDaySheet",
    "socialOpenCalendarRecordDetail",
    "socialOpenCalendarMonthYearPicker",
    "socialApplyCalendarMonthYearPicker",
    "socialCalendarBackLayer",
    "socialOpenCalendarQuickAddMenu",
    "socialOpenCalendarModal",
    "socialCloseModal",
    "bindBellButtons",
    "bindBellButtonsLite",
    "rebindBellButtonsHotfix",
    "bindCalendarBackGestureFinal",
    "bindCalendarBackGestureHotfix",
    "bindBellButtonsFinal",
    "bindCalendarMonthSwipeFinal",
  ]);
  const shouldSkipBehaviorOverride = (name) => {
    const key = String(name || "").trim();
    return disableTextBehaviorOverrides && behaviorOverrideNames.has(key);
  };

  const TEXT_ATTRS = ["title", "placeholder", "aria-label", "data-tip"];
  const cp1251Table = new Map();
  const ruFallbackByEnglish = new Map([
    ["Dashboard", "Статистика"],
    ["Products", "Товары"],
    ["Reviews/Questions", "Отзывы/Вопросы"],
    ["Accounting", "Бухгалтерия"],
    ["Ads WB/Ozon", "Реклама WB/Ozon"],
    ["Social Hub", "Общее"],
    ["Common", "Общее"],
    ["Profile", "Профиль"],
    ["Help", "Справка"],
    ["Chats", "Чаты"],
    ["Tasks", "Задачи"],
    ["Notes", "Заметки"],
    ["Calendar", "Календарь"],
    ["Calculator", "Калькулятор"],
    ["Games", "Игры"],
    ["Reviews", "Отзывы"],
    ["Questions", "Вопросы"],
    ["Returns", "Возвраты"],
    ["Ads WB", "Реклама WB"],
    ["Ad analytics", "Аналитика рекламы"],
    ["Recommendations", "Рекомендации"],
    ["WB Ads bidder", "Бидер WB Ads"],
    ["Section", "Раздел"],
    ["Menu", "Меню"],
    ["Notifications", "Уведомления"],
    ["Send", "Отправить"],
    ["Create note", "Создать запись"],
    ["New task", "Новая задача"],
    ["New project", "Новый проект"],
    ["Project members", "Участники проекта"],
    ["Refresh", "Обновить"],
    ["Search", "Поиск"],
    ["Logout", "Выйти"],
    ["Mark all read", "Прочитать все"],
    ["No notifications yet.", "Уведомлений пока нет."],
    ["Notification", "Уведомление"],
  ]);
  const brokenQuestionMap = new Map([
    ["??????????", "Общее"],
    ["??????? WB/Ozon", "Реклама WB/Ozon"],
    ["??????? WB", "Реклама WB"],
    ["????????????", "Рекомендации"],
    ["??????? ????????", "Рекламные кампании"],
    ["???????", "Справка"],
    ["????????/?????????? ????", "Свернуть/развернуть меню"],
    ["??????", "Раздел"],
  ]);
  const directPhraseFixes = new Map([
    ["РџСѓСЃС‚Р°СЏ Р·Р°РјРµС‚РєР°", "Пустая заметка"],
    ["Р‘РµР· РЅР°Р·РІР°РЅРёСЏ", "Без названия"],
    ["Р—Р°РјРµС‚РѕРє РїРѕРєР° РЅРµС‚", "Заметок пока нет"],
    ["Р—Р°РєСЂС‹С‚СЊ", "Закрыть"],
    ["Р”РѕР±Р°РІРёС‚СЊ", "Добавить"],
    ["вњ•", "✕"],
    ["РўРѕРІР°СЂС‹", "Товары"],
    ["Р’СЃРµ РјР°СЂРєРµС‚РїР»РµР№СЃС‹", "Все маркетплейсы"],
    ["РРјРїРѕСЂС‚", "Импорт"],
    ["Р’С‹Р±СЂР°С‚СЊ РІСЃРµ", "Выбрать все"],
    ["Р”Р°Р»РµРµ", "Далее"],
    ["СЃРёРјРІ.", "симв."],
  ]);
  [
    ["Р—РјРµР№РєР°", "Змейка"],
    ["РўРµС‚СЂРёСЃ", "Тетрис"],
    ["РЁР°С€РєРё", "Шашки"],
    ["РЁР°С…РјР°С‚С‹", "Шахматы"],
    ["РњРѕСЂСЃРєРѕР№ Р±РѕР№", "Морской бой"],
    ["РќР°Р¶РјРёС‚Рµ РґР»СЏ РІС…РѕРґР°", "Нажмите для входа"],
    ["РЎРЊРЎвЂљРЎС“ Р С–РЎР‚РЎС“Р С—Р С—РЎС“", "эту группу"],
    ["РЅРµС‚ РґР°РЅРЅС‹С…", "нет данных"],
    ["Р Р…Р ВµРЎвЂљ Р Т‘Р В°Р Р…Р Р…РЎвЂ№РЎвЂ¦", "нет данных"],
    ["RUB (СЂСѓР±.)", "RUB (руб.)"],
  ].forEach(([from, to]) => {
    directPhraseFixes.set(String(from), String(to));
  });
  (function installDictionaryFixesV20260324a() {
    const ruFixed = {
      Dashboard: "\u0421\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043a\u0430",
      Products: "\u0422\u043e\u0432\u0430\u0440\u044b",
      "Reviews/Questions": "\u041e\u0442\u0437\u044b\u0432\u044b/\u0412\u043e\u043f\u0440\u043e\u0441\u044b",
      Accounting: "\u0411\u0443\u0445\u0433\u0430\u043b\u0442\u0435\u0440\u0438\u044f",
      "Ads WB/Ozon": "\u0420\u0435\u043a\u043b\u0430\u043c\u0430 WB/Ozon",
      "Social Hub": "\u041e\u0431\u0449\u0435\u0435",
      Common: "\u041e\u0431\u0449\u0435\u0435",
      Profile: "\u041f\u0440\u043e\u0444\u0438\u043b\u044c",
      Help: "\u0421\u043f\u0440\u0430\u0432\u043a\u0430",
      Chats: "\u0427\u0430\u0442\u044b",
      Tasks: "\u0417\u0430\u0434\u0430\u0447\u0438",
      Notes: "\u0417\u0430\u043c\u0435\u0442\u043a\u0438",
      Calendar: "\u041a\u0430\u043b\u0435\u043d\u0434\u0430\u0440\u044c",
      Calculator: "\u041a\u0430\u043b\u044c\u043a\u0443\u043b\u044f\u0442\u043e\u0440",
      Games: "\u0418\u0433\u0440\u044b",
      Reviews: "\u041e\u0442\u0437\u044b\u0432\u044b",
      Questions: "\u0412\u043e\u043f\u0440\u043e\u0441\u044b",
      Returns: "\u0412\u043e\u0437\u0432\u0440\u0430\u0442\u044b",
      "Ads WB": "\u0420\u0435\u043a\u043b\u0430\u043c\u0430 WB",
      "Ad analytics": "\u0410\u043d\u0430\u043b\u0438\u0442\u0438\u043a\u0430 \u0440\u0435\u043a\u043b\u0430\u043c\u044b",
      Recommendations: "\u0420\u0435\u043a\u043e\u043c\u0435\u043d\u0434\u0430\u0446\u0438\u0438",
      "WB Ads bidder": "\u0411\u0438\u0434\u0435\u0440 WB Ads",
      Section: "\u0420\u0430\u0437\u0434\u0435\u043b",
      Menu: "\u041c\u0435\u043d\u044e",
      Notifications: "\u0423\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f",
      Send: "\u041e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c",
      "Create note": "\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u0437\u0430\u043f\u0438\u0441\u044c",
      "New task": "\u041d\u043e\u0432\u0430\u044f \u0437\u0430\u0434\u0430\u0447\u0430",
      "New project": "\u041d\u043e\u0432\u044b\u0439 \u043f\u0440\u043e\u0435\u043a\u0442",
      "Project members": "\u0423\u0447\u0430\u0441\u0442\u043d\u0438\u043a\u0438 \u043f\u0440\u043e\u0435\u043a\u0442\u0430",
      Refresh: "\u041e\u0431\u043d\u043e\u0432\u0438\u0442\u044c",
      Search: "\u041f\u043e\u0438\u0441\u043a",
      Logout: "\u0412\u044b\u0439\u0442\u0438",
      "Mark all read": "\u041f\u0440\u043e\u0447\u0438\u0442\u0430\u0442\u044c \u0432\u0441\u0435",
      "No notifications yet.": "\u0423\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u0439 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442.",
      Notification: "\u0423\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u0435",
      "Server returned an invalid response.": "\u0421\u0435\u0440\u0432\u0435\u0440 \u0432\u0435\u0440\u043d\u0443\u043b \u043d\u0435\u043a\u043e\u0440\u0440\u0435\u043a\u0442\u043d\u044b\u0439 \u043e\u0442\u0432\u0435\u0442.",
      "Network error. Check connection and retry.": "\u041e\u0448\u0438\u0431\u043a\u0430 \u0441\u0435\u0442\u0438. \u041f\u0440\u043e\u0432\u0435\u0440\u044c\u0442\u0435 \u0441\u043e\u0435\u0434\u0438\u043d\u0435\u043d\u0438\u0435 \u0438 \u043f\u043e\u0432\u0442\u043e\u0440\u0438\u0442\u0435.",
      "Average rank": "\u0421\u0440\u0435\u0434\u043d\u044f\u044f \u043f\u043e\u0437\u0438\u0446\u0438\u044f",
      Generated: "\u0421\u0433\u0435\u043d\u0435\u0440\u0438\u0440\u043e\u0432\u0430\u043d\u043e",
      "Select a product in table first.": "\u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u0432\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0442\u043e\u0432\u0430\u0440 \u0432 \u0442\u0430\u0431\u043b\u0438\u0446\u0435.",
      "Saving product card changes...": "\u0421\u043e\u0445\u0440\u0430\u043d\u044f\u0435\u043c \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u044f \u043a\u0430\u0440\u0442\u043e\u0447\u043a\u0438 \u0442\u043e\u0432\u0430\u0440\u0430...",
      "Workspace Team": "\u0421\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a\u0438 \u043a\u043e\u043c\u0430\u043d\u0434\u044b",
      "Loading employees...": "\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043c \u0441\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a\u043e\u0432...",
      Statistics: "\u0421\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043a\u0430",
      "Ad campaigns": "\u0420\u0435\u043a\u043b\u0430\u043c\u043d\u044b\u0435 \u043a\u0430\u043c\u043f\u0430\u043d\u0438\u0438",
      Owner: "\u0412\u043b\u0430\u0434\u0435\u043b\u0435\u0446",
      Member: "\u0423\u0447\u0430\u0441\u0442\u043d\u0438\u043a",
      "Select a team member first.": "\u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u0432\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0441\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a\u0430.",
      "Generate reply": "\u0421\u0433\u0435\u043d\u0435\u0440\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u043e\u0442\u0432\u0435\u0442",
      "Select a file first.": "\u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u0432\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0444\u0430\u0439\u043b.",
      "API record state/status": "\u0421\u043e\u0441\u0442\u043e\u044f\u043d\u0438\u0435/\u0441\u0442\u0430\u0442\u0443\u0441 \u0437\u0430\u043f\u0438\u0441\u0438 API",
      Status: "\u0421\u0442\u0430\u0442\u0443\u0441",
      Created: "\u0421\u043e\u0437\u0434\u0430\u043d\u043e",
      Amount: "\u0421\u0443\u043c\u043c\u0430",
      Warehouse: "\u0421\u043a\u043b\u0430\u0434",
      Running: "\u0420\u0430\u0431\u043e\u0442\u0430\u0435\u0442",
      Spend: "\u0420\u0430\u0441\u0445\u043e\u0434",
      Bid: "\u0421\u0442\u0430\u0432\u043a\u0430",
      Updated: "\u041e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u043e",
      "Rates were not returned by API.": "\u0421\u0442\u0430\u0432\u043a\u0438 \u043d\u0435 \u0431\u044b\u043b\u0438 \u0432\u043e\u0437\u0432\u0440\u0430\u0449\u0435\u043d\u044b API.",
      "Stats are unavailable from API.": "\u0421\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043a\u0430 \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u0430 \u0438\u0437 API.",
      "Details are fetched via several WB API methods.": "\u0414\u0435\u0442\u0430\u043b\u0438 \u0437\u0430\u0433\u0440\u0443\u0436\u0430\u044e\u0442\u0441\u044f \u0447\u0435\u0440\u0435\u0437 \u043d\u0435\u0441\u043a\u043e\u043b\u044c\u043a\u043e \u043c\u0435\u0442\u043e\u0434\u043e\u0432 API WB.",
      "Load state": "\u0421\u043e\u0441\u0442\u043e\u044f\u043d\u0438\u0435 \u0437\u0430\u0433\u0440\u0443\u0437\u043a\u0438",
      "Server returned a malformed WB Ads response. Existing rows were preserved.": "\u0421\u0435\u0440\u0432\u0435\u0440 \u0432\u0435\u0440\u043d\u0443\u043b \u043d\u0435\u043a\u043e\u0440\u0440\u0435\u043a\u0442\u043d\u044b\u0439 \u043e\u0442\u0432\u0435\u0442 WB Ads. \u0422\u0435\u043a\u0443\u0449\u0438\u0435 \u0441\u0442\u0440\u043e\u043a\u0438 \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u044b.",
      "Recommendations loaded": "\u0420\u0435\u043a\u043e\u043c\u0435\u043d\u0434\u0430\u0446\u0438\u0438 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043d\u044b",
      "Sales statistics partially loaded": "\u0421\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043a\u0430 \u043f\u0440\u043e\u0434\u0430\u0436 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043d\u0430 \u0447\u0430\u0441\u0442\u0438\u0447\u043d\u043e",
      "Sales statistics loaded": "\u0421\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043a\u0430 \u043f\u0440\u043e\u0434\u0430\u0436 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043d\u0430",
      "Medium priority": "\u0421\u0440\u0435\u0434\u043d\u0438\u0439 \u043f\u0440\u0438\u043e\u0440\u0438\u0442\u0435\u0442",
      Medium: "\u0421\u0440\u0435\u0434\u043d\u0438\u0439",
      Low: "\u041d\u0438\u0437\u043a\u0438\u0439",
      "Recommendations are temporarily unavailable.": "\u0420\u0435\u043a\u043e\u043c\u0435\u043d\u0434\u0430\u0446\u0438\u0438 \u0432\u0440\u0435\u043c\u0435\u043d\u043d\u043e \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u044b.",
      "Recommendations are currently unavailable. Check API key and date range, then refresh the module.": "\u0420\u0435\u043a\u043e\u043c\u0435\u043d\u0434\u0430\u0446\u0438\u0438 \u0441\u0435\u0439\u0447\u0430\u0441 \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u044b. \u041f\u0440\u043e\u0432\u0435\u0440\u044c\u0442\u0435 API-\u043a\u043b\u044e\u0447 \u0438 \u0434\u0438\u0430\u043f\u0430\u0437\u043e\u043d \u0434\u0430\u0442, \u0437\u0430\u0442\u0435\u043c \u043e\u0431\u043d\u043e\u0432\u0438\u0442\u0435 \u043c\u043e\u0434\u0443\u043b\u044c.",
      "Recommendations are ready in cards and table. Start with high priority.": "\u0420\u0435\u043a\u043e\u043c\u0435\u043d\u0434\u0430\u0446\u0438\u0438 \u0433\u043e\u0442\u043e\u0432\u044b \u0432 \u043a\u0430\u0440\u0442\u043e\u0447\u043a\u0430\u0445 \u0438 \u0442\u0430\u0431\u043b\u0438\u0446\u0435. \u041d\u0430\u0447\u043d\u0438\u0442\u0435 \u0441 \u0432\u044b\u0441\u043e\u043a\u043e\u0433\u043e \u043f\u0440\u0438\u043e\u0440\u0438\u0442\u0435\u0442\u0430.",
      "No actionable recommendations. Service returned neutral or insufficient data for selected period.": "\u041f\u043e\u043b\u0435\u0437\u043d\u044b\u0445 \u0440\u0435\u043a\u043e\u043c\u0435\u043d\u0434\u0430\u0446\u0438\u0439 \u043d\u0435\u0442. \u0421\u0435\u0440\u0432\u0438\u0441 \u0432\u0435\u0440\u043d\u0443\u043b \u043d\u0435\u0439\u0442\u0440\u0430\u043b\u044c\u043d\u044b\u0435 \u0438\u043b\u0438 \u043d\u0435\u0434\u043e\u0441\u0442\u0430\u0442\u043e\u0447\u043d\u044b\u0435 \u0434\u0430\u043d\u043d\u044b\u0435 \u0437\u0430 \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u044b\u0439 \u043f\u0435\u0440\u0438\u043e\u0434.",
      "No recommendations for selected period.": "\u0420\u0435\u043a\u043e\u043c\u0435\u043d\u0434\u0430\u0446\u0438\u0439 \u0437\u0430 \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u044b\u0439 \u043f\u0435\u0440\u0438\u043e\u0434 \u043d\u0435\u0442.",
      Strategy: "\u0421\u0442\u0440\u0430\u0442\u0435\u0433\u0438\u044f",
      "Edit product": "\u0420\u0435\u0434\u0430\u043a\u0442\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u0435 \u0442\u043e\u0432\u0430\u0440\u0430",
      "Ads spend": "\u0420\u0430\u0441\u0445\u043e\u0434 \u043d\u0430 \u0440\u0435\u043a\u043b\u0430\u043c\u0443",
      "Ads Spend": "\u0420\u0430\u0441\u0445\u043e\u0434 \u043d\u0430 \u0440\u0435\u043a\u043b\u0430\u043c\u0443",
      "Orders amount": "\u0421\u0443\u043c\u043c\u0430 \u0437\u0430\u043a\u0430\u0437\u043e\u0432",
      "Buyouts amount": "\u0421\u0443\u043c\u043c\u0430 \u0432\u044b\u043a\u0443\u043f\u043e\u0432",
      Expense: "\u0420\u0430\u0441\u0445\u043e\u0434",
      Today: "\u0421\u0435\u0433\u043e\u0434\u043d\u044f",
      "No services": "\u041d\u0435\u0442 \u0441\u0435\u0440\u0432\u0438\u0441\u043e\u0432",
      "Save changes": "\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u044f",
      Save: "\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c",
      "Workspace employee": "\u0421\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a \u043a\u043e\u043c\u0430\u043d\u0434\u044b",
      "No employees yet.": "\u0421\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a\u043e\u0432 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442.",
      Employee: "\u0421\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a",
      "Edit employee": "\u0420\u0435\u0434\u0430\u043a\u0442\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u0441\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a\u0430",
      "No help data.": "\u041d\u0435\u0442 \u0434\u0430\u043d\u043d\u044b\u0445 \u0441\u043f\u0440\u0430\u0432\u043a\u0438.",
      "Module help not found.": "\u0421\u043f\u0440\u0430\u0432\u043a\u0430 \u043f\u043e \u043c\u043e\u0434\u0443\u043b\u044e \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u0430.",
    };
    Object.entries(ruFixed).forEach(([key, value]) => {
      ruFallbackByEnglish.set(String(key), String(value));
    });

    const brokenFixed = {
      "??????????": "\u0421\u043e\u0446\u0438\u0430\u043b\u044c\u043d\u044b\u0439",
      "??????? WB/Ozon": "\u0420\u0435\u043a\u043b\u0430\u043c\u0430 WB/Ozon",
      "??????? WB": "\u0420\u0435\u043a\u043b\u0430\u043c\u0430 WB",
      "????????????": "\u0420\u0435\u043a\u043e\u043c\u0435\u043d\u0434\u0430\u0446\u0438\u0438",
      "??????? ????????": "\u0420\u0435\u043a\u043b\u0430\u043c\u043d\u044b\u0435 \u043a\u0430\u043c\u043f\u0430\u043d\u0438\u0438",
      "???????": "\u0421\u043f\u0440\u0430\u0432\u043a\u0430",
      "????????/?????????? ????": "\u0421\u0432\u0435\u0440\u043d\u0443\u0442\u044c/\u0440\u0430\u0437\u0432\u0435\u0440\u043d\u0443\u0442\u044c \u043c\u0435\u043d\u044e",
      "??????": "\u0420\u0430\u0437\u0434\u0435\u043b",
    };
    Object.entries(brokenFixed).forEach(([key, value]) => {
      brokenQuestionMap.set(String(key), String(value));
    });
  })();
  let queueRaf = 0;
  let queueTimer = 0;
  let lastQueueRunAt = 0;
  const queuedRoots = new Set();
  let calendarRecoverAt = 0;
  let domObserver = null;
  let observerQueued = false;
  let fullRootSanitized = false;

  function isEn() {
    return String(window.currentLang || "").trim().toLowerCase() === "en";
  }

  function pick(ru, en) {
    const value = isEn() ? String(en || "") : String(ru || "");
    return repairText(value);
  }

  function localizeEnglishFallback(enValue) {
    const key = String(enValue || "").trim();
    if (!key) return "";
    if (ruFallbackByEnglish.has(key)) {
      const mapped = String(ruFallbackByEnglish.get(key) || "").trim();
      if (mapped && !looksBroken(mapped)) return mapped;
    }
    let m = key.match(/^Stats rows:\s*(.+)$/i);
    if (m) return `Строк статистики: ${m[1]}`;
    m = key.match(/^Generated jobs:\s*(.+)$/i);
    if (m) return `Сгенерировано задач: ${m[1]}`;
    return key;
  }

  function initCp1251Table() {
    if (cp1251Table.size || typeof TextDecoder === "undefined") return;
    const decoder = new TextDecoder("windows-1251");
    for (let i = 0; i < 256; i += 1) {
      const ch = decoder.decode(new Uint8Array([i]));
      if (!cp1251Table.has(ch)) cp1251Table.set(ch, i);
    }
  }

  function cyrillicScore(text) {
    const m = String(text || "").match(/[\u0400-\u04ff]/g);
    return m ? m.length : 0;
  }

  function mojibakeScore(text) {
    const value = String(text || "");
    if (!value) return 0;
    const m = value.match(/(?:\u0420[\u0400-\u04ffA-Za-z0-9$]|\u0421[\u0400-\u04ffA-Za-z0-9$]|\u0412[\u0400-\u04ffA-Za-z0-9$]|Р[\u00A0\s]*В|Р[\u00A0\s]*Р|\u00d0.|\u00d1.|вЂ|в„|вљ|[Pp]\$[A-Za-z\u0400-\u04ff]{0,6}|\uFFFD|\?{3,})/g);
    return m ? m.length : 0;
  }

  function normalizeArtifacts(text) {
    return String(text || "")
      .replace(/[\u0000-\u001F\u007F-\u009F]+/g, " ")
      .replace(/\u00a0/g, " ")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/[\u2060\u180E]/g, "")
      .replace(/([\u0420\u0421\u0412\u00d0\u00d1])(?:\s|\u00A0)+(?=[\u0420\u0421\u0412\u00d0\u00d1\u0400-\u04ffA-Za-z0-9])/g, "$1")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  function applySymbolFixes(text) {
    let out = String(text || "");
    if (!out) return "";
    [
      ["вЊ«", "\u232b"],
      ["В±", "\u00b1"],
      ["Г·", "\u00f7"],
      ["Г—", "\u00d7"],
      ["в€’", "\u2212"],
      ["вЂў", "\u2022"],
      ["вЂ¦", "\u2026"],
    ].forEach(([from, to]) => {
      if (out.includes(from)) out = out.split(from).join(to);
    });
    const replacements = [
      ["вњ•", "\u2715"],
      ["вЊ«", "\u232b"],
      ["В±", "\u00b1"],
      ["Г·", "\u00f7"],
      ["Г—", "\u00d7"],
      ["в€’", "\u2212"],
      ["вњ•", "\u2715"],
      ["вЊ«", "\u232b"],
      ["В±", "\u00b1"],
      ["Г·", "\u00f7"],
      ["Г—", "\u00d7"],
      ["в€’", "\u2212"],
      ["вЂ¦", "\u2026"],
      ["рџ””", "\ud83d\udd14"],
      ["вњ•", "\u2715"],
      ["вЊ«", "\u232b"],
      ["В±", "\u00b1"],
      ["Г·", "\u00f7"],
      ["Г—", "\u00d7"],
      ["в€’", "\u2212"],
    ];
    replacements.push(
      ["вЊ•", "\u2715"],
      ["вњ•", "\u2715"],
      ["в’", "\u2212"]
    );
    replacements.push(
      ["вЪ•", "\u2715"],
      ["вЊ«", "\u232b"],
      ["В±", "\u00b1"],
      ["Г·", "\u00f7"],
      ["Г—", "\u00d7"],
      ["в€’", "\u2212"]
    );
    replacements.push(
      ["вљ•", "\u2715"],
      ["вЬ•", "\u2715"],
      ["вь•", "\u2715"],
      ["Р’В«", "\u232b"],
      ["Р’В·", "\u00f7"],
      ["Р’вЂ”", "\u00d7"],
      ["Р’вЂ™", "\u2212"],
      ["Р’вЂ¦", "\u2026"]
    );
    const seen = new Set();
    replacements.forEach(([from, to]) => {
      const key = `${from}=>${to}`;
      if (seen.has(key)) return;
      seen.add(key);
      if (out.includes(from)) out = out.split(from).join(to);
    });
    return out;
  }

  function collapseBrokenSpacing(text) {
    let out = String(text || "");
    if (!out) return "";
    for (let i = 0; i < 4; i += 1) {
      out = out
        .replace(/([\u0420\u0421\u0412\u00d0\u00d1][^\s]{0,3})(?:\s|\u00A0)+(?=[\u0420\u0421\u0412\u00d0\u00d1][^\s]{0,3})/g, "$1")
        .replace(/(\b[\u0420\u0421\u0412\u00d0\u00d1][\u0400-\u04ffA-Za-z0-9'’.,:;!?-]{0,2}\b)(?:\s|\u00A0)+(?=\b[\u0420\u0421\u0412\u00d0\u00d1][\u0400-\u04ffA-Za-z0-9'’.,:;!?-]{0,2}\b)/g, "$1")
        .replace(/([\u0420\u0421\u0412\u00d0\u00d1])(?:\s|\u00A0)+(?=[\u0400-\u04ffA-Za-z0-9])/g, "$1")
        .replace(/([PCBHX])(?:\s|\u00A0)+(?=[PCBHX\u0400-\u04ffA-Za-z0-9])/g, "$1")
        .replace(/(?:\b[\u0420\u0421\u0412\u00d0\u00d1]\b(?:\s|\u00A0)+){3,}\b[\u0420\u0421\u0412\u00d0\u00d1]\b/g, (seq) => seq.replace(/[\s\u00A0]+/g, ""))
        .replace(/(?:\b[PCBHX]\b(?:\s|\u00A0)+){3,}\b[PCBHX]\b/g, (seq) => seq.replace(/[\s\u00A0]+/g, ""))
        .replace(/\s{2,}/g, " ");
    }
    return normalizeArtifacts(out);
  }

  function looksBroken(text) {
    const value = String(text || "");
    if (!value) return false;
    if (/\?{3,}|\uFFFD/.test(value)) return true;
    if (/(?:вЊ«|В±|Г·|Г—|в€’|вЂў|вЂ¦)/.test(value)) return true;
    if (/Р[\u00A0\s]*В|Р[\u00A0\s]*Р|вЂ|в„|вљ/.test(value)) return true;
    if (/(?:Р[\s\u00A0]*[A-Za-z0-9])|(?:С[\s\u00A0]*[A-Za-z0-9])|(?:В[\s\u00A0]*[A-Za-z0-9])/.test(value)) return true;
    if (/(?:Ð[\s\u00A0]*[A-Za-z0-9])|(?:Ñ[\s\u00A0]*[A-Za-z0-9])/.test(value)) return true;
    if (/(?:\bP[\$§\^]?[A-Za-zА-Яа-я0-9]{0,3}\b(?:\s+|$)){2,}/.test(value)) return true;
    if (/(?:[РСВÐÑ][^\s]{0,3}(?:\s+|$)){3,}/.test(value)) return true;
    if (/[РСВÐÑ][\s\u00A0]+[РСВÐÑ][\s\u00A0]+[РСВÐÑ]/.test(value)) return true;
    if (mojibakeScore(value) >= 2) return true;
    if (/(?:\b[\u0420\u0421\u0412\u00d0\u00d1]\b(?:\s|\u00A0)+){4,}/.test(value)) return true;
    if (/(?:[\u0420\u0421\u0412\u00d0\u00d1](?:\s|\u00A0)+){3,}/.test(value)) return true;
    if (/(?:[\u0420\u0421\u0412\u00d0\u00d1]\s+){3,}/.test(value)) return true;
    if (/(?:\b[PCBHX]\b(?:\s|\u00A0)+){3,}/.test(value)) return true;
    if (/[PBCXH][\s\u00A0]+[PBCXH][\s\u00A0]+[PBCXH]/.test(value)) return true;
    return false;
  }

  const baseLooksBroken = looksBroken;
  looksBroken = function patchedLooksBroken(text) {
    const value = String(text || "");
    if (!value) return false;
    if (baseLooksBroken(value)) return true;
    if (/(?:[\u0420\u0440\u0421\u0441\u0412\u0432\u00d0\u00d1][^\s]{0,3}(?:\s+|$)){3,}/.test(value)) return true;
    if (/[\u0420\u0440\u0421\u0441\u0412\u0432\u00d0\u00d1][\s\u00A0]+[\u0420\u0440\u0421\u0441\u0412\u0432\u00d0\u00d1][\s\u00A0]+[\u0420\u0440\u0421\u0441\u0412\u0432\u00d0\u00d1]/.test(value)) return true;
    return false;
  };

  function decodeCp1251Utf8(text) {
    initCp1251Table();
    if (!cp1251Table.size || typeof TextDecoder === "undefined") return "";
    const bytes = [];
    for (const ch of String(text || "")) {
      const b = cp1251Table.get(ch);
      if (b === undefined) return "";
      bytes.push(b);
    }
    try {
      return new TextDecoder("utf-8", { fatal: false }).decode(new Uint8Array(bytes));
    } catch (_) {
      return "";
    }
  }

  function decodeLatin1Utf8(text) {
    try {
      return decodeURIComponent(escape(String(text || "")));
    } catch (_) {
      return "";
    }
  }

  function repairText(input) {
    const raw = String(input == null ? "" : input);
    if (!raw) return "";
    const directPhraseFix = directPhraseFixes.get(raw.trim());
    if (directPhraseFix && !looksBroken(directPhraseFix)) return directPhraseFix;
    if (!looksBroken(raw)) {
      const cleanFast = normalizeArtifacts(raw);
      if (!looksBroken(cleanFast)) return cleanFast;
    }
    const directQuestionFix = brokenQuestionMap.get(raw.trim());
    if (directQuestionFix && !looksBroken(directQuestionFix)) return directQuestionFix;
    const symbolFixed = applySymbolFixes(raw);
    const collapsed = collapseBrokenSpacing(symbolFixed);
    const squeezed = symbolFixed.replace(/([A-Za-z\u0400-\u04ff\u0420\u0421\u0412\u00d0\u00d1])(?:\s|\u00A0)+(?=[A-Za-z\u0400-\u04ff\u0420\u0421\u0412\u00d0\u00d1])/g, "$1");
    const candidates = [symbolFixed, collapsed, squeezed];
    [symbolFixed, collapsed, squeezed].forEach((base) => {
      const cp = decodeCp1251Utf8(base);
      if (cp) candidates.push(cp);
      const latin = decodeLatin1Utf8(base);
      if (latin) candidates.push(latin);
    });
    let best = normalizeArtifacts(symbolFixed);
    let bestBad = mojibakeScore(best);
    let bestCyr = cyrillicScore(best);
    candidates.forEach((candRaw) => {
      let cand = normalizeArtifacts(candRaw);
      try {
        if (typeof window.decodePossiblyMojibake === "function") {
          cand = normalizeArtifacts(window.decodePossiblyMojibake(cand) || cand);
        }
      } catch (_) {}
      const bad = mojibakeScore(cand);
      const cyr = cyrillicScore(cand);
      if (bad < bestBad || (bad === bestBad && cyr > bestCyr)) {
        best = cand;
        bestBad = bad;
        bestCyr = cyr;
      }
    });
    let final = normalizeArtifacts(best);
    if (!looksBroken(raw) && !looksBroken(final)) return final;
    if (looksBroken(final)) {
      const compact = collapseBrokenSpacing(final);
      const decoded = normalizeArtifacts(decodeCp1251Utf8(compact) || decodeLatin1Utf8(compact) || compact);
      const finalBad = mojibakeScore(final);
      const compactBad = mojibakeScore(compact);
      const decodedBad = mojibakeScore(decoded);
      if (decodedBad < finalBad || (decodedBad === finalBad && cyrillicScore(decoded) > cyrillicScore(final))) {
        final = decoded;
      } else if (compactBad < finalBad || (compactBad === finalBad && cyrillicScore(compact) > cyrillicScore(final))) {
        final = compact;
      }
    }
    final = normalizeArtifacts(final);
    directPhraseFixes.forEach((to, from) => {
      if (to && !looksBroken(to) && final.includes(from)) final = final.split(from).join(to);
    });
    if (final.includes("Р”РѕР±Р°РІ. РЅР° ")) final = final.split("Р”РѕР±Р°РІ. РЅР° ").join("Добав. на ");
    return normalizeArtifacts(final);
  }

  window.__repairMojibakeText = repairText;

  function repairTextNode(node) {
    if (!node || node.nodeType !== Node.TEXT_NODE) return;
    const before = String(node.nodeValue || "");
    if (!before || !looksBroken(before)) return;
    const after = repairText(before);
    if (after && after !== before) node.nodeValue = after;
  }

  function repairElementAttrs(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return;
    const tag = String(node.tagName || "");
    if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT") return;
    for (const attr of TEXT_ATTRS) {
      const before = String(node.getAttribute?.(attr) || "");
      if (!before || !looksBroken(before)) continue;
      const after = repairText(before);
      if (after && after !== before) node.setAttribute(attr, after);
    }
  }

  function sanitizeTree(root) {
    const target = root || document.getElementById("appSection") || document.body;
    if (!target) return;
    const appRoot = document.getElementById("appSection");
    const isLargeRoot = target === appRoot || target === document.body || target === document.documentElement;
    if (target.nodeType === Node.ELEMENT_NODE) {
      if (!isLargeRoot || fullRootSanitized) {
        const snapshot = String(target.textContent || "").slice(0, 80000);
        if (!looksBroken(snapshot) && !/\uFFFD|\?{3,}/.test(snapshot)) return;
      }
    }
    if (target.nodeType === Node.TEXT_NODE) {
      repairTextNode(target);
      return;
    }
    if (target.nodeType === Node.ELEMENT_NODE) repairElementAttrs(target);
    const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, null);
    let current = walker.currentNode;
    while (current) {
      if (current.nodeType === Node.TEXT_NODE) repairTextNode(current);
      if (current.nodeType === Node.ELEMENT_NODE) repairElementAttrs(current);
      current = walker.nextNode();
    }
    if (isLargeRoot) {
      fullRootSanitized = true;
    }
  }

  function queueSanitize(root) {
    const safeRoot = (root && root.nodeType) ? root : (document.getElementById("appSection") || document.body);
    if (safeRoot) queuedRoots.add(safeRoot);
    const run = () => {
      queueRaf = 0;
      queueTimer = 0;
      lastQueueRunAt = Date.now();
      const roots = [...queuedRoots];
      queuedRoots.clear();
      if (!roots.length) roots.push(document.getElementById("appSection") || document.body);
      roots.forEach((node) => sanitizeTree(node));
      applyKnownCopy();
    };
    if (queueRaf || queueTimer) return;
    const now = Date.now();
    const delay = Math.max(0, 90 - (now - lastQueueRunAt));
    if (delay > 0) {
      queueTimer = setTimeout(run, delay);
      return;
    }
    queueRaf = requestAnimationFrame(run);
  }

  function isAppShellMode() {
    try {
      if (document.body?.classList?.contains("mobile-apk-mode")) return true;
      if (document.body?.classList?.contains("mobile-client-mode")) return true;
      if (typeof window.socialIsAppShellLike === "function") return Boolean(window.socialIsAppShellLike());
      if (String(window.location?.pathname || "") === "/mobile") return true;
    } catch (_) {}
    return false;
  }

  function isCompactMobileViewport() {
    try {
      const width = Number(window.innerWidth || document.documentElement?.clientWidth || 0);
      return width > 0 && width <= 980;
    } catch (_) {}
    return false;
  }

  function calendarBaseDate() {
    const d = window.socialState?.calendarDate;
    if (d instanceof Date && !Number.isNaN(d.getTime())) return d;
    return new Date();
  }

  function buildCalendarFallbackGrid(root) {
    const host = root || document.getElementById("socialSubtabCalendar");
    if (!host) return;
    const shell = host.querySelector(".social-calendar-shell") || host;
    let grid = document.getElementById("socialCalendarGrid");
    if (!grid) {
      grid = document.createElement("div");
      grid.id = "socialCalendarGrid";
      grid.className = "social-calendar-grid social-calendar-grid--samsung";
      shell.appendChild(grid);
    }
    const d = calendarBaseDate();
    const year = d.getFullYear();
    const month = d.getMonth();
    const firstDay = new Date(year, month, 1, 0, 0, 0, 0);
    const lastDay = new Date(year, month + 1, 0, 0, 0, 0, 0);
    const shift = (firstDay.getDay() + 6) % 7;
    const days = Number(lastDay.getDate() || 0);
    let html = `<div class="social-calendar-row head">${[
      pick("Пн", "Mon"),
      pick("Вт", "Tue"),
      pick("Ср", "Wed"),
      pick("Чт", "Thu"),
      pick("Пт", "Fri"),
      pick("Сб", "Sat"),
      pick("Вс", "Sun"),
    ].map((x) => `<span>${x}</span>`).join("")}</div><div class="social-calendar-cells">`;
    for (let i = 0; i < shift; i += 1) {
      html += `<button class="social-day muted" disabled></button>`;
    }
    for (let day = 1; day <= days; day += 1) {
      const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      html += `<button class="social-day rich" data-day-key="${key}" type="button" onclick="socialShowDay('${key}')"><div class="social-day-head"><b>${day}</b></div><div class="social-day-preview-stack"></div></button>`;
    }
    html += "</div>";
    grid.innerHTML = html;
    const monthLabel = document.getElementById("socialCalendarMonthLabel");
    if (monthLabel && typeof window.socialCalendarMonthLabel === "function") {
      monthLabel.textContent = String(window.socialCalendarMonthLabel(d) || "");
    }
  }

  function buildCalendarFallbackGridV2(root) {
    const host = root || document.getElementById("socialSubtabCalendar");
    if (!host) return;
    const shell = host.querySelector(".social-calendar-shell") || host;
    let grid = document.getElementById("socialCalendarGrid");
    if (!grid) {
      grid = document.createElement("div");
      grid.id = "socialCalendarGrid";
      grid.className = "social-calendar-grid social-calendar-grid--samsung";
      shell.appendChild(grid);
    } else if (grid.parentElement !== shell) {
      shell.appendChild(grid);
    }
    const d = calendarBaseDate();
    const year = d.getFullYear();
    const month = d.getMonth();
    const firstDay = new Date(year, month, 1, 0, 0, 0, 0);
    const lastDay = new Date(year, month + 1, 0, 0, 0, 0, 0);
    const shift = (firstDay.getDay() + 6) % 7;
    const days = Number(lastDay.getDate() || 0);
    let html = `<div class="social-calendar-row head">${[
      pick("\u041f\u043d", "Mon"),
      pick("\u0412\u0442", "Tue"),
      pick("\u0421\u0440", "Wed"),
      pick("\u0427\u0442", "Thu"),
      pick("\u041f\u0442", "Fri"),
      pick("\u0421\u0431", "Sat"),
      pick("\u0412\u0441", "Sun"),
    ].map((x) => `<span>${x}</span>`).join("")}</div><div class="social-calendar-cells">`;
    for (let i = 0; i < shift; i += 1) {
      html += `<button class="social-day muted" disabled></button>`;
    }
    for (let day = 1; day <= days; day += 1) {
      const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      html += `<button class="social-day rich" data-day-key="${key}" type="button" onclick="socialShowDay('${key}')"><div class="social-day-head"><b>${day}</b></div><div class="social-day-preview-stack"></div></button>`;
    }
    html += "</div>";
    grid.innerHTML = html;
    grid.style.setProperty("display", "block", "important");
    const head = grid.querySelector(".social-calendar-row.head");
    if (head) {
      head.style.setProperty("display", "grid", "important");
      head.style.setProperty("grid-template-columns", "repeat(7, minmax(0, 1fr))", "important");
    }
    const cells = grid.querySelector(".social-calendar-cells");
    if (cells) {
      cells.style.setProperty("display", "grid", "important");
      cells.style.setProperty("grid-template-columns", "repeat(7, minmax(0, 1fr))", "important");
    }
    const monthLabel = document.getElementById("socialCalendarMonthLabel");
    if (monthLabel && typeof window.socialCalendarMonthLabel === "function") {
      monthLabel.textContent = String(window.socialCalendarMonthLabel(d) || "");
    }
  }

  function installObserver() {
    if (!window.__enableTextMutationObserver) return;
    if (domObserver) return;
    const root = document.getElementById("appSection") || document.body;
    if (!root) return;
    domObserver = new MutationObserver((mutations) => {
      if (!Array.isArray(mutations) || !mutations.length) return;
      if (observerQueued) return;
      observerQueued = true;
      requestAnimationFrame(() => {
        observerQueued = false;
        mutations.forEach((mutation) => {
          if (mutation?.target) queueSanitize(mutation.target);
          if (mutation?.addedNodes?.length) {
            mutation.addedNodes.forEach((node) => queueSanitize(node));
          }
        });
      });
    });
    domObserver.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: TEXT_ATTRS,
    });
  }

  function applyKnownCopy() {
    function applyNodeText(node, value) {
      if (!node) return;
      const safeValue = repairText(value);
      if (!safeValue) return;
      const navLabel = node.querySelector?.(".nav-label");
      if (navLabel) {
        navLabel.textContent = safeValue;
        return;
      }
      node.textContent = safeValue;
    }

    const copy = [
      [".sidebar-toggle", "\u2630"],
      ["#mobileDrawerQuickNavLabel", pick("\u0420\u0430\u0437\u0434\u0435\u043b", "Section")],
      [".nav-btn[data-tab='sales']", pick("\u0421\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043a\u0430 \u0438 \u0434\u0430\u0448\u0431\u043e\u0440\u0434", "Dashboard")],
      [".nav-btn[data-tab='products']", pick("\u0422\u043e\u0432\u0430\u0440\u044b", "Products")],
      [".nav-btn[data-tab='reviews']", pick("\u041e\u0442\u0437\u044b\u0432\u044b/\u0412\u043e\u043f\u0440\u043e\u0441\u044b", "Reviews/Questions")],
      [".nav-btn[data-tab='accounting']", pick("\u0411\u0443\u0445\u0433\u0430\u043b\u0442\u0435\u0440\u0438\u044f", "Accounting")],
      [".nav-btn[data-tab='ads']", pick("\u0420\u0435\u043a\u043b\u0430\u043c\u0430 WB/Ozon", "Ads WB/Ozon")],
      [".nav-btn[data-tab='social']", pick("\u041e\u0431\u0449\u0435\u0435", "Common")],
      [".nav-btn[data-tab='help']", pick("\u0421\u043f\u0440\u0430\u0432\u043a\u0430", "Help")],
      [".nav-btn[data-tab='profile']", pick("\u041f\u0440\u043e\u0444\u0438\u043b\u044c", "Profile")],
      [".btn-danger.full[onclick='logout()']", pick("\u0412\u044b\u0439\u0442\u0438", "Logout")],
      ["#socialSubtabChatBtn", pick("\u0427\u0430\u0442", "Chat")],
      ["#socialSubtabTasksBtn", pick("\u0417\u0430\u0434\u0430\u0447\u0438", "Tasks")],
      ["#socialSubtabCalendarBtn", pick("\u041a\u0430\u043b\u0435\u043d\u0434\u0430\u0440\u044c", "Calendar")],
      ["#socialSubtabNotesBtn", pick("\u0417\u0430\u043c\u0435\u0442\u043a\u0438", "Notes")],
      ["#socialSubtabCalculatorBtn", pick("\u041a\u0430\u043b\u044c\u043a\u0443\u043b\u044f\u0442\u043e\u0440", "Calculator")],
      ["#socialSubtabGamesBtn", pick("\u0418\u0433\u0440\u044b", "Games")],
      ["#helpSubtabMainBtn", pick("\u0421\u043f\u0440\u0430\u0432\u043a\u0430", "Help")],
      ["#helpSubtabAssistantBtn", pick("AI \u043f\u043e\u043c\u043e\u0449\u043d\u0438\u043a", "AI assistant")],
      ["#helpSubtabDownloadsBtn", pick("\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0438", "Downloads")],
      ["#socialSubtabChat h3", pick("\u0427\u0430\u0442\u044b", "Chats")],
      ["#socialSubtabChat .social-chat-sidebar-head small", pick("\u041b\u0438\u0447\u043d\u044b\u0435 \u0438 \u0433\u0440\u0443\u043f\u043f\u043e\u0432\u044b\u0435", "Personal and group")],
      ["#socialChatHead", pick("\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0447\u0430\u0442", "Choose chat")],
      ["#socialChatGroupBtn", pick("\u0423\u0447\u0430\u0441\u0442\u043d\u0438\u043a\u0438", "Members")],
      ["#socialChatAvatarBtn", pick("\u0410\u0432\u0430\u0442\u0430\u0440", "Avatar")],
      ["#socialChatSendFallback", pick("\u041e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c", "Send")],
      ["#socialSubtabTasks button[onclick='socialOpenProjectModal()']", pick("\u041d\u043e\u0432\u044b\u0439 \u043f\u0440\u043e\u0435\u043a\u0442", "New project")],
      ["#socialSubtabTasks button[onclick='socialOpenTaskModal()']", pick("\u041d\u043e\u0432\u0430\u044f \u0437\u0430\u0434\u0430\u0447\u0430", "New task")],
      ["#socialSubtabTasks .social-task-toolbar-side button[onclick='socialOpenProjectMembersModal()']", pick("\u0423\u0447\u0430\u0441\u0442\u043d\u0438\u043a\u0438 \u043f\u0440\u043e\u0435\u043a\u0442\u0430", "Project members")],
      ["#socialSubtabTasks .social-task-toolbar-side button[onclick='socialLoadTasks()']", pick("\u041e\u0431\u043d\u043e\u0432\u0438\u0442\u044c", "Refresh")],
      ["#socialSubtabNotes button[onclick='socialCreateNote()']", pick("\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u0437\u0430\u043f\u0438\u0441\u044c", "Create note")],
      ["button[onclick='socialCreateNote()']", pick("\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u0437\u0430\u043f\u0438\u0441\u044c", "Create note")],
      ["#productsSubtabCatalogBtn", pick("\u0422\u043e\u0432\u0430\u0440\u044b", "Products")],
      ["#importMarketplace option[value='all']", pick("\u0412\u0441\u0435 \u043c\u0430\u0440\u043a\u0435\u0442\u043f\u043b\u0435\u0439\u0441\u044b", "All marketplaces")],
      ["#productsNextTopBtn", pick("\u0414\u0430\u043b\u0435\u0435", "Next")],
      ["#productsNextBottomBtn", pick("\u0414\u0430\u043b\u0435\u0435", "Next")],
      ["button[onclick='selectAllProducts()']", pick("\u0412\u044b\u0431\u0440\u0430\u0442\u044c \u0432\u0441\u0435 \u0442\u043e\u0432\u0430\u0440\u044b", "Select all products")],
      ["#mobileDrawerQuickNav option[value='social_games']", pick("\u0418\u0433\u0440\u044b", "Games")],
      ["#mobileDrawerQuickNav option[value='sales_dashboard']", pick("\u0421\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043a\u0430", "Dashboard")],
      ["#mobileDrawerQuickNav option[value='social_chat']", pick("\u0427\u0430\u0442\u044b", "Chats")],
      ["#mobileDrawerQuickNav option[value='social_tasks']", pick("\u0417\u0430\u0434\u0430\u0447\u0438", "Tasks")],
      ["#mobileDrawerQuickNav option[value='social_notes']", pick("\u0417\u0430\u043c\u0435\u0442\u043a\u0438", "Notes")],
      ["#mobileDrawerQuickNav option[value='social_calendar']", pick("\u041a\u0430\u043b\u0435\u043d\u0434\u0430\u0440\u044c", "Calendar")],
      ["#mobileDrawerQuickNav option[value='social_calculator']", pick("\u041a\u0430\u043b\u044c\u043a\u0443\u043b\u044f\u0442\u043e\u0440", "Calculator")],
      ["#mobileDrawerQuickNav option[value='reviews_reviews']", pick("\u041e\u0442\u0437\u044b\u0432\u044b", "Reviews")],
      ["#mobileDrawerQuickNav option[value='reviews_questions']", pick("\u0412\u043e\u043f\u0440\u043e\u0441\u044b", "Questions")],
      ["#mobileDrawerQuickNav option[value='reviews_returns']", pick("\u0412\u043e\u0437\u0432\u0440\u0430\u0442\u044b", "Returns")],
      ["#mobileDrawerQuickNav option[value='ads_campaigns']", pick("\u0420\u0435\u043a\u043b\u0430\u043c\u0430 WB", "Ads WB")],
      ["#mobileDrawerQuickNav option[value='ads_analytics']", pick("\u0410\u043d\u0430\u043b\u0438\u0442\u0438\u043a\u0430 \u0440\u0435\u043a\u043b\u0430\u043c\u044b", "Ad analytics")],
      ["#mobileDrawerQuickNav option[value='ads_recommendations']", pick("\u0420\u0435\u043a\u043e\u043c\u0435\u043d\u0434\u0430\u0446\u0438\u0438", "Recommendations")],
      ["#mobileDrawerQuickNav option[value='ads_bidder']", pick("\u0411\u0438\u0434\u0435\u0440 WB Ads", "WB Ads bidder")],
      ["#mobileDrawerQuickNav option[value='help_main']", pick("\u0421\u043f\u0440\u0430\u0432\u043a\u0430", "Help")],
      ["#mobileDrawerQuickNav option[value='profile_main']", pick("\u041f\u0440\u043e\u0444\u0438\u043b\u044c", "Profile")],
      ["#mobileQuickNav option[value='sales_dashboard']", pick("\u0421\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043a\u0430", "Dashboard")],
      ["#mobileQuickNav option[value='social_chat']", pick("\u0427\u0430\u0442\u044b", "Chats")],
      ["#mobileQuickNav option[value='social_tasks']", pick("\u0417\u0430\u0434\u0430\u0447\u0438", "Tasks")],
      ["#mobileQuickNav option[value='social_notes']", pick("\u0417\u0430\u043c\u0435\u0442\u043a\u0438", "Notes")],
      ["#mobileQuickNav option[value='social_calendar']", pick("\u041a\u0430\u043b\u0435\u043d\u0434\u0430\u0440\u044c", "Calendar")],
      ["#mobileQuickNav option[value='social_calculator']", pick("\u041a\u0430\u043b\u044c\u043a\u0443\u043b\u044f\u0442\u043e\u0440", "Calculator")],
      ["#accountingSubtabOverviewBtn", pick("\u041e\u0431\u0437\u043e\u0440", "Overview")],
      ["#accountingSubtabAnalysisBtn", pick("\u0410\u043d\u0430\u043b\u0438\u0437", "Analysis")],
      ["#accountingSubtabMonthlyBtn", pick("\u041f\u0440\u0438\u0431\u044b\u043b\u044c \u043f\u043e \u043c\u0435\u0441\u044f\u0446\u0430\u043c", "Monthly profit")],
      ["#accountingSubtabExpensesBtn", pick("\u0420\u0430\u0441\u0445\u043e\u0434\u044b", "Expenses")],
      ["#accountingSubtabSettingsBtn", pick("\u041d\u0430\u043b\u043e\u0433\u0438 \u0438 \u043f\u0430\u0440\u0430\u043c\u0435\u0442\u0440\u044b", "Taxes and settings")],
      ["#accountingMarketplace option[value='all']", pick("\u0412\u0441\u0435 \u043c\u0430\u0440\u043a\u0435\u0442\u043f\u043b\u0435\u0439\u0441\u044b", "All marketplaces")],
      ["#accountingPeriod option[value='day'], .accounting-quick-range [data-accounting-range='day']", pick("\u0414\u0435\u043d\u044c", "Day")],
      ["#accountingPeriod option[value='month'], .accounting-quick-range [data-accounting-range='month']", pick("\u041c\u0435\u0441\u044f\u0446", "Month")],
      ["#accountingPeriod option[value='quarter'], .accounting-quick-range [data-accounting-range='quarter']", pick("\u041a\u0432\u0430\u0440\u0442\u0430\u043b", "Quarter")],
      ["#accountingPeriod option[value='year'], .accounting-quick-range [data-accounting-range='year']", pick("\u0413\u043e\u0434", "Year")],
      ["button[onclick='downloadAccountingTemplate()']", pick("\u0421\u043a\u0430\u0447\u0430\u0442\u044c \u0448\u0430\u0431\u043b\u043e\u043d Excel", "Download Excel template")],
      ["button[onclick='downloadAccountingExport()']", pick("\u042d\u043a\u0441\u043f\u043e\u0440\u0442 \u0446\u0435\u043d", "Export prices")],
      ["button[onclick='importAccountingPurchasePrices()']", pick("\u0418\u043c\u043f\u043e\u0440\u0442 \u0437\u0430\u043a\u0443\u043f\u043e\u0447\u043d\u044b\u0445 \u0446\u0435\u043d", "Import purchase prices")],
      ["#accountingSubtabOverview .panel:nth-of-type(2) h3", pick("\u0421\u0432\u043e\u0434\u043a\u0430 \u043f\u043e \u043c\u0430\u0440\u043a\u0435\u0442\u043f\u043b\u0435\u0439\u0441\u0430\u043c", "Marketplace summary")],
      ["#accountingAnalysisSort option[value='expense_desc']", pick("\u0420\u0430\u0441\u0445\u043e\u0434\u044b \u041c\u041f: \u0431\u043e\u043b\u044c\u0448\u0435 \u2192 \u043c\u0435\u043d\u044c\u0448\u0435", "Marketplace expenses: high to low")],
      ["#accountingAnalysisSort option[value='expense_asc']", pick("\u0420\u0430\u0441\u0445\u043e\u0434\u044b \u041c\u041f: \u043c\u0435\u043d\u044c\u0448\u0435 \u2192 \u0431\u043e\u043b\u044c\u0448\u0435", "Marketplace expenses: low to high")],
      ["button[onclick='resetAccountingAnalysisFilters()']", pick("\u0421\u0431\u0440\u043e\u0441\u0438\u0442\u044c \u0444\u0438\u043b\u044c\u0442\u0440\u044b", "Reset filters")],
      ["#accountingSubtabExpenses h3", pick("\u0423\u0447\u0435\u0442 \u0440\u0430\u0441\u0445\u043e\u0434\u043e\u0432", "Expense tracking")],
      ["#accountingExpenseMarketplace option[value='all']", pick("\u0412\u0441\u0435 \u041c\u041f", "All marketplaces")],
      ["#accountingExpenseAmount", pick("\u0421\u0443\u043c\u043c\u0430", "Amount")],
      ["#accountingExpenseRecurrence option[value='once']", pick("\u0420\u0430\u0437\u043e\u0432\u043e", "Once")],
      ["#accountingExpenseRecurrence option[value='daily']", pick("\u0415\u0436\u0435\u0434\u043d\u0435\u0432\u043d\u043e", "Daily")],
      ["#accountingExpenseRecurrence option[value='weekly']", pick("\u0415\u0436\u0435\u043d\u0435\u0434\u0435\u043b\u044c\u043d\u043e", "Weekly")],
      ["#accountingExpenseRecurrence option[value='monthly']", pick("\u0415\u0436\u0435\u043c\u0435\u0441\u044f\u0447\u043d\u043e", "Monthly")],
      ["#accountingExpenseRecurrence option[value='quarterly']", pick("\u0415\u0436\u0435\u043a\u0432\u0430\u0440\u0442\u0430\u043b\u044c\u043d\u043e", "Quarterly")],
      ["#accountingExpenseRecurrence option[value='yearly']", pick("\u0415\u0436\u0435\u0433\u043e\u0434\u043d\u043e", "Yearly")],
      ["button[onclick='saveAccountingExpense()']", pick("\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u0440\u0430\u0441\u0445\u043e\u0434", "Save expense")],
      ["button[onclick='resetAccountingExpenseForm()']", pick("\u041e\u0447\u0438\u0441\u0442\u0438\u0442\u044c \u0444\u043e\u0440\u043c\u0443", "Clear form")],
      ["#accountingSubtabSettings .field-label:nth-child(1) span", pick("\u041d\u0414\u0421, %", "VAT, %")],
      ["#accountingSubtabSettings .field-label:nth-child(2) span", pick("\u041d\u0430\u043b\u043e\u0433 \u043d\u0430 \u043f\u0440\u0438\u0431\u044b\u043b\u044c/\u0423\u0421\u041d, %", "Profit tax / simplified tax, %")],
      ["button[onclick='saveAccountingSettings()']", pick("\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u043f\u0430\u0440\u0430\u043c\u0435\u0442\u0440\u044b", "Save settings")],
    ];
    copy.forEach(([selector, value]) => {
      document.querySelectorAll(selector).forEach((node) => {
        applyNodeText(node, value);
      });
    });

    const attrs = [
      [".sidebar-toggle", "title", pick("\u041c\u0435\u043d\u044e", "Menu")],
      [".sidebar-toggle", "aria-label", pick("\u041c\u0435\u043d\u044e", "Menu")],
      ["#socialBellBtn", "title", pick("\u0423\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f", "Notifications")],
      ["#socialBellBtn", "aria-label", pick("\u0423\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f", "Notifications")],
      ["#mobileDrawerBellBtn", "title", pick("\u0423\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f", "Notifications")],
      ["#mobileDrawerBellBtn", "aria-label", pick("\u0423\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f", "Notifications")],
      ["#mobileNavToggle", "title", pick("\u041c\u0435\u043d\u044e", "Menu")],
      ["#mobileNavToggle", "aria-label", pick("\u041c\u0435\u043d\u044e", "Menu")],
      ["#socialChatSearch", "placeholder", pick("\u041f\u043e\u0438\u0441\u043a", "Search")],
      ["#socialChatInput", "placeholder", pick("\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435...", "Type a message...")],
      ["#socialEmojiBtn", "title", pick("\u042d\u043c\u043e\u0434\u0437\u0438", "Emoji")],
      ["#socialAttachBtn", "title", pick("\u0424\u0430\u0439\u043b", "File")],
      ["#socialSendIconBtn", "title", pick("\u041e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c", "Send")],
      ["#socialSendIconBtn", "aria-label", pick("\u041e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c", "Send")],
      ["#socialChatHeadCollapseBtn", "title", pick("\u0421\u0432\u0435\u0440\u043d\u0443\u0442\u044c \u0448\u0430\u043f\u043a\u0443", "Collapse header")],
      ["#socialNoteTitle", "placeholder", pick("\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 \u0437\u0430\u043c\u0435\u0442\u043a\u0438", "Note title")],
      ["#socialNoteContent", "placeholder", pick("\u0422\u0435\u043a\u0441\u0442 \u0437\u0430\u043c\u0435\u0442\u043a\u0438...", "Note text...")],
      ["#accountingExpenseAmount", "placeholder", pick("\u0421\u0443\u043c\u043c\u0430", "Amount")],
      ["#productEditBarcode", "placeholder", pick("\u0411\u0430\u0440\u043a\u043e\u0434", "Barcode")],
      ["#productEditPhotoUrl", "placeholder", pick("URL \u0433\u043b\u0430\u0432\u043d\u043e\u0433\u043e \u0444\u043e\u0442\u043e", "Main photo URL")],
      ["#productEditKeywords", "placeholder", pick("\u0426\u0435\u043b\u0435\u0432\u044b\u0435 \u043a\u043b\u044e\u0447\u0435\u0432\u044b\u0435 \u0441\u043b\u043e\u0432\u0430 \u0447\u0435\u0440\u0435\u0437 \u0437\u0430\u043f\u044f\u0442\u0443\u044e", "Target keywords, comma separated")],
      ["#productsImportBtn", "data-tip", pick("\u0418\u043c\u043f\u043e\u0440\u0442", "Import")],
      ["#productsSelectAllBtn", "data-tip", pick("\u0412\u044b\u0431\u0440\u0430\u0442\u044c \u0432\u0441\u0435", "Select all")],
    ];
    attrs.forEach(([selector, attr, value]) => {
      document.querySelectorAll(selector).forEach((node) => node.setAttribute(attr, value));
    });
    document.querySelectorAll(".bell-emoji").forEach((node) => { node.textContent = "\u{1F514}"; });

    document.querySelectorAll(".photo-close, .campaign-close, .social-notif-head .btn-secondary:last-child").forEach((node) => {
      if (!node) return;
      const before = String(node.textContent || "").trim();
      if (!before || looksBroken(before) || /[РСВ]|вњ•|РІСљ/.test(before)) {
        node.textContent = "\u2715";
      }
    });
    document.querySelectorAll("#socialNotificationCenter .social-notif-head-actions button:last-child, #socialNotificationCenter .btn-secondary:last-child").forEach((node) => {
      if (!node) return;
      node.textContent = "\u2715";
      node.setAttribute("aria-label", pick("\u0417\u0430\u043a\u0440\u044b\u0442\u044c", "Close"));
      node.setAttribute("title", pick("\u0417\u0430\u043a\u0440\u044b\u0442\u044c", "Close"));
    });
    document.querySelectorAll(".social-modal-close, .modal-close, .sheet-close, [class*='close-btn']").forEach((node) => {
      if (!node) return;
      const before = String(node.textContent || "").trim();
      if (!before || before.length <= 2 || looksBroken(before) || /[Р РЎР’]|РІСљвЂў|Р Р†РЎС™|вЊ•|вњ•/.test(before)) {
        node.textContent = "\u2715";
      }
      node.setAttribute("aria-label", pick("\u0417\u0430\u043a\u0440\u044b\u0442\u044c", "Close"));
      node.setAttribute("title", pick("\u0417\u0430\u043a\u0440\u044b\u0442\u044c", "Close"));
    });
    document.querySelectorAll(".social-calc-back").forEach((node) => { node.textContent = "\u232b"; });
    document.querySelectorAll("[onclick*=\"socialCalcToggleSign\"]").forEach((node) => { node.textContent = "\u00b1"; });
    document.querySelectorAll("[onclick*=\"socialCalcPress('/')\"]").forEach((node) => { node.textContent = "\u00f7"; });
    document.querySelectorAll("[onclick*=\"socialCalcPress('*')\"]").forEach((node) => { node.textContent = "\u00d7"; });
    document.querySelectorAll("[onclick*=\"socialCalcPress('-')\"]").forEach((node) => { node.textContent = "\u2212"; });
  }

  function suppressMobileTooltips() {
    if (!(isAppShellMode() || isCompactMobileViewport())) return;
    document.querySelectorAll("button[title], [role='button'][title], input[title], select[title], textarea[title], .social-day[title]").forEach((node) => {
      try { node.removeAttribute("title"); } catch (_) {}
    });
  }

  function normalizeCalendarUi() {
    if (window.__seoWibeSamsungCalendarController === "v4") return;
    try {
      if (typeof window.socialNormalizeCalendarChrome === "function") {
        window.socialNormalizeCalendarChrome();
      }
      if (typeof window.socialEnsureCalendarNavigation === "function") {
        window.socialEnsureCalendarNavigation();
      }
      if (typeof window.socialEnsureCalendarFab === "function") {
        window.socialEnsureCalendarFab();
      }
    } catch (_) {}
    const root = document.getElementById("socialSubtabCalendar");
    if (!root) return;
    if (!window.socialState || typeof window.socialState !== "object") {
      window.socialState = {};
    }
    if (!(window.socialState.calendarDate instanceof Date) || Number.isNaN(window.socialState.calendarDate.getTime())) {
      window.socialState.calendarDate = calendarBaseDate();
    }
    root.classList.add("sw-calendar-samsung");
    root.setAttribute("data-calendar-sheet-mode", "overlay");
    try {
      if (typeof window.socialBindCalendarSwipe === "function") {
        window.socialBindCalendarSwipe();
      }
    } catch (_) {}
    root.querySelectorAll(
      "#socialCalendarEvents, #socialCalendarEventsLegacy, .social-calendar-events, .social-calendar-selected, .social-calendar-selected-day, .social-calendar-day-header, .social-calendar-day-details, .social-calendar-day-list, .social-calendar-records, .social-calendar-summary, [data-calendar-detail], [data-selected-day]"
    ).forEach((node) => {
      if (!node) return;
      node.innerHTML = "";
      node.hidden = true;
      node.setAttribute("aria-hidden", "true");
      node.style.setProperty("display", "none", "important");
      node.style.setProperty("max-height", "0", "important");
      node.style.setProperty("min-height", "0", "important");
      node.style.setProperty("overflow", "hidden", "important");
      node.style.setProperty("margin", "0", "important");
      node.style.setProperty("padding", "0", "important");
      node.style.setProperty("border", "0", "important");
      node.style.setProperty("box-shadow", "none", "important");
    });
    root.querySelectorAll(".social-calendar-board").forEach((board) => {
      [...board.children].forEach((child) => {
        if (child.classList?.contains("social-calendar-main")) return;
        if (child.id === "socialCalendarFab") return;
        child.hidden = true;
        child.setAttribute("aria-hidden", "true");
        child.style.setProperty("display", "none", "important");
      });
    });
    root.querySelectorAll(".social-calendar-main").forEach((main) => {
      [...main.children].forEach((child) => {
        if (!child) return;
        if (child.id === "socialCalendarGrid") return;
        if (child.id === "socialCalendarFab") return;
        if (String(child.id || "").includes("DaySheet")) return;
        child.innerHTML = "";
        child.hidden = true;
        child.setAttribute("aria-hidden", "true");
        child.style.setProperty("display", "none", "important");
        child.style.setProperty("max-height", "0", "important");
        child.style.setProperty("min-height", "0", "important");
        child.style.setProperty("overflow", "hidden", "important");
        child.style.setProperty("margin", "0", "important");
        child.style.setProperty("padding", "0", "important");
        child.style.setProperty("border", "0", "important");
      });
    });
    let nav = root.querySelector(".social-calendar-nav-controls");
    if (!nav) {
      try {
        if (typeof window.socialEnsureCalendarNavigation === "function") {
          window.socialEnsureCalendarNavigation();
        }
      } catch (_) {}
      nav = root.querySelector(".social-calendar-nav-controls");
    }
    if (nav) {
      const appMode = isAppShellMode();
      nav.classList.toggle("is-app-shell", appMode);
      nav.style.setProperty("display", appMode ? "none" : "flex", "important");
      nav.style.setProperty("width", "100%", "important");
      nav.style.setProperty("align-items", "center", "important");
      nav.style.setProperty("justify-content", appMode ? "center" : "space-between", "important");
      nav.style.setProperty("gap", "12px", "important");
      nav.style.removeProperty("grid-template-columns");
      nav.querySelectorAll(".social-calendar-picker").forEach((node) => {
        node.style.setProperty("display", "none", "important");
        node.style.setProperty("min-height", "42px", "important");
        node.style.setProperty("width", "100%", "important");
      });
      nav.querySelectorAll(".social-calendar-nav-btn").forEach((node) => {
        node.style.setProperty("display", appMode ? "none" : "inline-flex", "important");
      });
    }
    const grid = document.getElementById("socialCalendarGrid");
    if (grid) {
      grid.style.setProperty("display", "block", "important");
      const head = grid.querySelector(".social-calendar-row.head");
      if (head) {
        head.style.setProperty("display", "grid", "important");
        head.style.setProperty("grid-template-columns", "repeat(7, minmax(0, 1fr))", "important");
      }
      const cells = grid.querySelector(".social-calendar-cells");
      if (cells) {
        cells.style.setProperty("display", "grid", "important");
        cells.style.setProperty("grid-template-columns", "repeat(7, minmax(0, 1fr))", "important");
      }
      try {
        const totalRows = Number((window.socialState?.calendarEvents || []).length || 0)
          + Number((window.socialState?.tasks || []).length || 0);
        const chips = grid.querySelectorAll(".sw-calendar-chip").length;
        if (totalRows > 0 && chips === 0 && typeof window.socialRenderCalendar === "function") {
          window.socialRenderCalendar();
        }
      } catch (_) {}
      grid.querySelectorAll(".social-day[data-day-key]").forEach((node) => {
        const dayKey = String(node.getAttribute("data-day-key") || "").trim();
        if (!dayKey || node.dataset.sheetBound === "1") return;
        node.dataset.sheetBound = "1";
        node.style.setProperty("pointer-events", "auto", "important");
        node.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          try {
            if (typeof window.socialShowDay === "function") {
              window.socialShowDay(dayKey);
            }
          } catch (_) {}
        });
      });
    }
    if (
      window.socialState?.calendarDaySheetOpen &&
      window.socialState?.calendarSelectedDay &&
      typeof window.socialForceOpenCalendarDaySheet === "function"
    ) {
      setTimeout(() => {
        try {
          window.socialForceOpenCalendarDaySheet(window.socialState.calendarSelectedDay);
        } catch (_) {}
      }, 0);
    }
    const monthLabel = document.getElementById("socialCalendarMonthLabel");
    if (monthLabel) {
      monthLabel.style.setProperty("cursor", "pointer", "important");
      monthLabel.setAttribute("title", pick("\u0412\u044b\u0431\u043e\u0440 \u043c\u0435\u0441\u044f\u0446\u0430 \u0438 \u0433\u043e\u0434\u0430", "Choose month and year"));
    }
    root.querySelectorAll(".social-calendar-row.head span").forEach((node, index) => {
      const ru = ["\u041f\u043d", "\u0412\u0442", "\u0421\u0440", "\u0427\u0442", "\u041f\u0442", "\u0421\u0431", "\u0412\u0441"];
      const en = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      node.textContent = isEn() ? en[index] : ru[index];
    });
  }

  function normalizeNotificationCenter() {
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
    center.querySelectorAll(".social-notif-item").forEach((node) => {
      node.style.setProperty("height", "auto", "important");
      node.style.setProperty("min-height", "80px", "important");
      node.style.setProperty("overflow", "hidden", "important");
    });
    center.querySelectorAll(".social-notif-item-head b").forEach((node) => {
      node.style.setProperty("display", "block", "important");
      node.style.setProperty("line-height", "1.25", "important");
      node.style.setProperty("overflow-wrap", "anywhere", "important");
      node.style.setProperty("word-break", "break-word", "important");
      node.style.setProperty("max-height", "3.2em", "important");
      node.style.setProperty("overflow", "hidden", "important");
    });
    center.querySelectorAll(".social-notif-item p").forEach((node) => {
      node.style.setProperty("line-height", "1.3", "important");
      node.style.setProperty("overflow-wrap", "anywhere", "important");
      node.style.setProperty("word-break", "break-word", "important");
      node.style.setProperty("max-height", "5.2em", "important");
      node.style.setProperty("overflow", "hidden", "important");
      node.style.setProperty("margin", "6px 0 0", "important");
    });
    center.querySelectorAll(".social-notif-head-actions button:last-child, .social-notif-head .btn-secondary:last-child").forEach((btn) => {
      btn.textContent = "\u2715";
      btn.setAttribute("aria-label", pick("\u0417\u0430\u043a\u0440\u044b\u0442\u044c", "Close"));
      btn.setAttribute("title", pick("\u0417\u0430\u043a\u0440\u044b\u0442\u044c", "Close"));
    });
    return center;
  }

  function normalizeNotesGrid() {
    const host = document.getElementById("socialNotesList");
    if (!host) return;
    const compactMode = isAppShellMode() || isCompactMobileViewport();
    const cardHeight = compactMode ? 176 : 196;
    host.style.setProperty("display", "grid", "important");
    host.style.setProperty(
      "grid-template-columns",
      compactMode ? "repeat(3, minmax(92px, 1fr))" : "repeat(auto-fit, minmax(124px, 1fr))",
      "important"
    );
    host.style.setProperty("grid-auto-rows", `${cardHeight}px`, "important");
    host.style.setProperty("gap", "10px", "important");
    host.style.setProperty("width", "100%", "important");
    host.style.setProperty("min-width", "0", "important");
    host.style.setProperty("max-width", "100%", "important");
    host.style.setProperty("align-content", "start", "important");
    host.style.setProperty("justify-content", "stretch", "important");
    host.style.setProperty("justify-items", "stretch", "important");
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
      const editor = sidebar.parentElement?.querySelector(".social-notes-editor");
      if (editor) editor.style.setProperty("display", "none", "important");
      sidebar.style.setProperty("display", "block", "important");
      sidebar.style.setProperty("width", "100%", "important");
      sidebar.style.setProperty("max-width", "100%", "important");
      sidebar.style.setProperty("min-width", "0", "important");
      sidebar.style.setProperty("overflow-x", "hidden", "important");
      sidebar.style.setProperty("overflow-y", "auto", "important");
      [
        sidebar.closest(".social-card"),
        sidebar.closest(".social-notes-shell"),
        sidebar.closest(".social-notes-content"),
        host.parentElement,
      ].filter(Boolean).forEach((node) => {
        node.style.setProperty("width", "100%", "important");
        node.style.setProperty("min-width", "0", "important");
        node.style.setProperty("max-width", "100%", "important");
        node.style.setProperty("overflow-x", "hidden", "important");
      });
    }

    host.querySelectorAll(
      ".social-note-delete, [class*='note-delete'], [class*='note-remove'], [class*='note-close'], [data-action='delete'], button[onclick*='socialDeleteNote']"
    ).forEach((node) => node.remove?.());
    host.querySelectorAll(".social-note-row[data-note-id], .sw-note-card[data-note-id]").forEach((row) => {
      const noteId = Number(row.getAttribute("data-note-id") || 0);
      if (!noteId) return;
      row.style.cursor = "pointer";
      row.style.setProperty("width", "100%", "important");
      row.style.setProperty("height", `${cardHeight}px`, "important");
      row.style.setProperty("min-height", `${cardHeight}px`, "important");
      row.style.setProperty("max-height", `${cardHeight}px`, "important");
      row.style.setProperty("min-width", "0", "important");
      row.style.setProperty("max-width", "100%", "important");
      row.style.setProperty("overflow", "hidden", "important");
      row.style.setProperty("justify-self", "stretch", "important");
      row.style.setProperty("align-self", "stretch", "important");
      const main = row.querySelector(".social-note-main");
      if (main) {
        main.style.setProperty("display", "grid", "important");
        main.style.setProperty("grid-template-rows", "auto 1fr auto", "important");
        main.style.setProperty("width", "100%", "important");
        main.style.setProperty("height", "100%", "important");
        main.style.setProperty("min-height", "0", "important");
        main.style.setProperty("overflow", "hidden", "important");
      }
      row.querySelectorAll(".social-note-delete, [class*='note-delete'], [class*='note-remove'], [class*='note-close'], [data-action='delete'], button[onclick*='socialDeleteNote']").forEach((node) => node.remove?.());
      if (row.dataset.noteOpenBound !== "1") {
        row.dataset.noteOpenBound = "1";
        row.addEventListener("click", () => {
          if (compactMode && typeof window.socialOpenNoteEditor === "function") {
            window.socialOpenNoteEditor(noteId);
            return;
          }
          if (typeof window.socialSelectNote === "function") window.socialSelectNote(noteId);
        });
      }
      try {
        if (typeof window.socialGetNoteCoverColor === "function") {
          const color = String(window.socialGetNoteCoverColor(noteId) || "").trim();
          if (color) {
            row.style.setProperty("--sw-note-cover", color);
          }
        }
      } catch (_) {}
    });
  }

  function normalizeTasksUi() {
    const host = document.getElementById("socialTasksBoard");
    if (!host) return;
    host.querySelectorAll(".social-task-check").forEach((btn) => {
      const done = btn.classList.contains("is-done");
      btn.innerHTML = done ? "&#10003;" : "";
      btn.setAttribute("title", pick("\u041e\u0442\u043c\u0435\u0442\u0438\u0442\u044c \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043d\u043e\u0439", "Mark done"));
      btn.setAttribute("aria-label", pick("\u041e\u0442\u043c\u0435\u0442\u0438\u0442\u044c \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043d\u043e\u0439", "Mark done"));
    });
    host.querySelectorAll(".social-task-delete").forEach((btn) => {
      btn.innerHTML = "&times;";
      btn.setAttribute("title", pick("\u0423\u0434\u0430\u043b\u0438\u0442\u044c", "Delete"));
      btn.setAttribute("aria-label", pick("\u0423\u0434\u0430\u043b\u0438\u0442\u044c", "Delete"));
    });
    host.querySelectorAll(".social-task-pending").forEach((node) => {
      const before = String(node.textContent || "");
      if (!before || /[?]{3,}|[\u0420\u0421\u0412\u00d0\u00d1]/.test(before)) {
        node.textContent = pick("5\u0441: \u043f\u043e\u0432\u0442\u043e\u0440\u043d\u044b\u0439 \u043a\u043b\u0438\u043a \u043e\u0442\u043c\u0435\u043d\u0438\u0442", "5s: click again to undo");
      }
    });
    host.querySelectorAll(".social-task-assignee-name").forEach((node) => {
      const value = repairText(node.textContent || "").trim();
      if (!value) {
        node.textContent = pick("\u0411\u0435\u0437 \u0438\u0441\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u044f", "No assignee");
      } else if (value !== String(node.textContent || "").trim()) {
        node.textContent = value;
      }
    });
  }

  function normalizeGamesUi() {
    const host = document.getElementById("socialGamesGrid");
    if (!host) return;
    const iconByCode = {
      snake: "\u{1F40D}",
      tetris: "\u{1F9E9}",
      "2048": "\u{1F522}",
      checkers: "\u26C0",
      chess: "\u265C",
      battleship: "\u2693",
    };
    const titleByCode = {
      snake: pick("\u0417\u043c\u0435\u0439\u043a\u0430", "Snake"),
      tetris: pick("\u0422\u0435\u0442\u0440\u0438\u0441", "Tetris"),
      "2048": "2048",
      checkers: pick("\u0428\u0430\u0448\u043a\u0438", "Checkers"),
      chess: pick("\u0428\u0430\u0445\u043c\u0430\u0442\u044b", "Chess"),
      battleship: pick("\u041c\u043e\u0440\u0441\u043a\u043e\u0439 \u0431\u043e\u0439", "Battleship"),
    };
    host.querySelectorAll(".social-game-card").forEach((card) => {
      const onclickRaw = String(card.getAttribute("onclick") || card.getAttribute("ondblclick") || "");
      const match = onclickRaw.match(/socialOpenGameMenu\('([^']+)'/i);
      const code = String(match?.[1] || "").trim().toLowerCase();
      const iconNode = card.querySelector(".social-game-icon");
      if (iconNode) iconNode.textContent = iconByCode[code] || "\u{1F3AE}";
      const titleNode = card.querySelector(".social-game-title");
      if (titleNode) {
        const cleanFallback = repairText(titleNode.textContent || "");
        titleNode.textContent = titleByCode[code] || cleanFallback || code;
      }
      const hintNode = card.querySelector("small");
      if (hintNode) hintNode.textContent = pick("\u041d\u0430\u0436\u043c\u0438\u0442\u0435 \u0434\u043b\u044f \u0432\u0445\u043e\u0434\u0430", "Tap to open");
    });
  }

  function bindBellButtons() {
    if (disableTextBehaviorOverrides) {
      return;
    }
    document.querySelectorAll("#socialBellBtn, #mobileDrawerBellBtn").forEach((btn) => {
      if (!btn || btn.dataset.textFixBellBound === "1") return;
      btn.dataset.textFixBellBound = "1";
      try { btn.removeAttribute("onclick"); } catch (_) {}
      try { btn.onclick = null; } catch (_) {}
      btn.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === "function") {
          event.stopImmediatePropagation();
        }
        try {
          const center = document.getElementById("socialNotificationCenter");
          const isVisible = Boolean(center && !center.classList.contains("hidden") && center.style.display !== "none");
          const shouldOpen = !isVisible;
          if (btn.id === "mobileDrawerBellBtn" && typeof window.closeMobileNav === "function") {
            window.closeMobileNav();
            await new Promise((resolve) => window.setTimeout(resolve, 40));
          }
          if (typeof window.socialToggleNotificationCenter === "function") {
            await window.socialToggleNotificationCenter(shouldOpen);
          }
        } catch (_) {}
      }, true);
    });
    window.socialBindBellButtonsNow = bindBellButtons;
  }

  function bindBellDelegated() {
    // Intentionally empty: delegated bell listener caused duplicate open/close toggles.
  }

  function bindTaskTouchGuard() {
    if (document.body?.dataset?.taskTouchGuardBound === "1") return;
    if (!document.body?.dataset) return;
    document.body.dataset.taskTouchGuardBound = "1";
    const stopTouchDragInApp = (event) => {
      if (!isAppShellMode()) return;
      const target = event?.target?.closest?.(".social-task-item");
      if (!target) return;
      event.stopPropagation();
    };
    document.addEventListener("touchstart", stopTouchDragInApp, true);
    document.addEventListener("touchmove", stopTouchDragInApp, true);
    document.addEventListener("touchend", stopTouchDragInApp, true);
    document.addEventListener("touchcancel", stopTouchDragInApp, true);
  }

  function wrapFn(name, wrapper) {
    if (shouldSkipBehaviorOverride(name)) return;
    const original = window[name];
    if (typeof original !== "function") return;
    if (original.__textFixWrapped) return;
    const wrapped = wrapper(original);
    wrapped.__textFixWrapped = true;
    window[name] = wrapped;
  }

  function installWraps() {
    wrapFn("tr", (original) => function wrappedTr() {
      const result = original.apply(this, arguments);
      if (typeof result !== "string") return result;
      let safe = repairText(result);
      if (!isEn()) {
        const enFallback = String(arguments[1] || "").trim();
        if (enFallback) {
          const mostlyQuestionMarks = /^\s*[\?]{3,}\s*$/.test(safe) || (safe.includes("?") && !/[\u0400-\u04ff]/.test(safe));
          if (mostlyQuestionMarks || looksBroken(safe)) {
            safe = localizeEnglishFallback(enFallback);
          }
        }
      }
      return safe;
    });

    wrapFn("socialResolveNotificationText", (original) => function wrappedResolve(row) {
      const result = original.call(this, row) || {};
      return {
        ...result,
        title: repairText(result.title || ""),
        body: repairText(result.body || ""),
      };
    });

    wrapFn("socialDecodeUiText", (original) => function wrappedDecodeUiText() {
      const value = original.apply(this, arguments);
      return repairText(typeof value === "string" ? value : String(value || ""));
    });

    wrapFn("socialDecodeMaybeUtf8", (original) => function wrappedDecodeMaybeUtf8() {
      const value = original.apply(this, arguments);
      return repairText(typeof value === "string" ? value : String(value || ""));
    });

    wrapFn("socialRenderNotificationCenter", (original) => function wrappedRenderCenter() {
      const result = original.apply(this, arguments);
      const center = normalizeNotificationCenter();
      if (center) queueSanitize(center);
      return result;
    });

    wrapFn("socialToggleNotificationCenter", (original) => async function wrappedToggleCenter(forceOpen = null) {
      const result = await Promise.resolve(original.call(this, forceOpen));
      const center = normalizeNotificationCenter();
      if (center) {
        if (!window.socialState?.notificationCenterOpen) {
          center.classList.add("hidden");
          center.style.display = "none";
        }
        queueSanitize(center);
      }
      return result;
    });

    wrapFn("socialRenderCalendar", (original) => function wrappedRenderCalendar() {
      if (window.__seoWibeSamsungCalendarController === "v4") {
        return original.apply(this, arguments);
      }
      if (!window.socialState || typeof window.socialState !== "object") window.socialState = {};
      const currentDate = window.socialState.calendarDate;
      if (!(currentDate instanceof Date) || Number.isNaN(currentDate.getTime())) {
        window.socialState.calendarDate = calendarBaseDate();
      }
      const result = original.apply(this, arguments);
      normalizeCalendarUi();
      queueSanitize(document.getElementById("socialSubtabCalendar"));
      return result;
    });

    wrapFn("socialRenderNotesList", (original) => function wrappedRenderNotesList() {
      const result = original.apply(this, arguments);
      normalizeNotesGrid();
      queueSanitize(document.getElementById("socialSubtabNotes") || document.getElementById("socialNotesList"));
      return result;
    });

    wrapFn("socialLoadCalendar", (original) => async function wrappedLoadCalendar() {
      if (window.__seoWibeSamsungCalendarController === "v4") {
        return Promise.resolve(original.apply(this, arguments));
      }
      const result = await Promise.resolve(original.apply(this, arguments));
      normalizeCalendarUi();
      queueSanitize(document.getElementById("socialSubtabCalendar"));
      try {
        const totalRows = Number((window.socialState?.calendarEvents || []).length || 0)
          + Number((window.socialState?.tasks || []).length || 0);
        const chipCount = document.querySelectorAll("#socialCalendarGrid .sw-calendar-chip").length;
        if (totalRows > 0 && chipCount === 0 && typeof window.socialRenderCalendar === "function") {
          window.socialRenderCalendar();
        }
      } catch (_) {}
      return result;
    });

    wrapFn("switchAccountingSubtab", (original) => function wrappedSwitchAccountingSubtab() {
      const result = original.apply(this, arguments);
      const host = document.getElementById("accounting") || document.getElementById("appSection") || document.body;
      setTimeout(() => {
        applyKnownCopy();
        queueSanitize(host);
      }, 60);
      setTimeout(() => {
        applyKnownCopy();
        queueSanitize(host);
      }, 260);
      return result;
    });

    wrapFn("loadAccountingData", (original) => async function wrappedLoadAccountingData() {
      const result = await Promise.resolve(original.apply(this, arguments));
      const host = document.getElementById("accounting") || document.getElementById("appSection") || document.body;
      applyKnownCopy();
      queueSanitize(host);
      setTimeout(() => {
        applyKnownCopy();
        queueSanitize(host);
      }, 240);
      return result;
    });

    wrapFn("socialRenderThreads", (original) => function wrappedRenderThreads() {
      const result = original.apply(this, arguments);
      queueSanitize(document.getElementById("socialChatThreads"));
      return result;
    });

    wrapFn("socialRenderTasks", (original) => function wrappedRenderTasks() {
      const result = original.apply(this, arguments);
      normalizeTasksUi();
      queueSanitize(document.getElementById("socialSubtabTasks") || document.getElementById("socialTasksBoard"));
      return result;
    });

    wrapFn("socialRenderGames", (original) => function wrappedRenderGames() {
      const result = original.apply(this, arguments);
      normalizeGamesUi();
      queueSanitize(document.getElementById("socialSubtabGames") || document.getElementById("socialGamesGrid"));
      return result;
    });

    wrapFn("socialOpenGameMenu", (original) => async function wrappedOpenGameMenu() {
      const result = await Promise.resolve(original.apply(this, arguments));
      queueSanitize(document.getElementById("socialModal"));
      return result;
    });

    wrapFn("socialShowGameTips", (original) => function wrappedShowGameTips() {
      const result = original.apply(this, arguments);
      queueSanitize(document.getElementById("socialModal"));
      return result;
    });

    wrapFn("socialShowLeaderboard", (original) => async function wrappedShowLeaderboard() {
      const result = await Promise.resolve(original.apply(this, arguments));
      queueSanitize(document.getElementById("socialModal"));
      return result;
    });

    wrapFn("socialSetBell", (original) => function wrappedSetBell() {
      const result = original.apply(this, arguments);
      bindBellButtons();
      bindBellDelegated();
      return result;
    });

    wrapFn("switchSocialSubtab", (original) => function wrappedSwitchSocialSubtab(tab, loadNow = true) {
      const result = original.call(this, tab, loadNow);
      const safeTab = String(tab || "").trim().toLowerCase();
      setTimeout(() => {
        if (safeTab === "calendar") normalizeCalendarUi();
        if (safeTab === "notes") normalizeNotesGrid();
        if (safeTab === "tasks") normalizeTasksUi();
        if (safeTab === "games") normalizeGamesUi();
        normalizeNotificationCenter();
        suppressMobileTooltips();
        queueSanitize(document.getElementById("socialSection") || document.getElementById("appSection") || document.body);
      }, 80);
      setTimeout(() => {
        if (safeTab === "calendar") normalizeCalendarUi();
        if (safeTab === "notes") normalizeNotesGrid();
        suppressMobileTooltips();
        queueSanitize(document.getElementById("socialNotificationCenter") || document.body);
      }, 320);
      return result;
    });

    wrapFn("switchTab", (original) => function wrappedSwitchTab() {
      const result = original.apply(this, arguments);
      const root = document.getElementById("appSection") || document.body;
      setTimeout(() => {
        applyKnownCopy();
        queueSanitize(root);
      }, 80);
      setTimeout(() => {
        applyKnownCopy();
        queueSanitize(root);
      }, 320);
      return result;
    });

    wrapFn("switchHelpSubtab", (original) => function wrappedSwitchHelpSubtab() {
      const result = original.apply(this, arguments);
      const helpRoot = document.getElementById("helpSection") || document.getElementById("appSection") || document.body;
      setTimeout(() => {
        applyKnownCopy();
        queueSanitize(helpRoot);
      }, 80);
      setTimeout(() => {
        applyKnownCopy();
        queueSanitize(helpRoot);
      }, 320);
      return result;
    });
  }

  function init() {
    if (isAppShellMode()) {
      window.__socialDisableNotificationToasts = true;
    }
    installWraps();
    applyKnownCopy();
    bindBellButtons();
    bindBellDelegated();
    bindTaskTouchGuard();
    installObserver();
    normalizeCalendarUi();
    normalizeNotificationCenter();
    normalizeNotesGrid();
    normalizeTasksUi();
    normalizeGamesUi();
    suppressMobileTooltips();
    const root = document.getElementById("appSection") || document.body;
    queueSanitize(root);
    setTimeout(() => queueSanitize(document.getElementById("socialSection") || root), 320);
    setTimeout(() => queueSanitize(document.getElementById("socialNotificationCenter") || root), 1200);
    window.addEventListener("resize", () => {
      normalizeNotificationCenter();
      suppressMobileTooltips();
      queueSanitize(document.getElementById("socialNotificationCenter"));
    });
    document.body?.classList?.remove("text-fix-pending");
    document.body?.classList?.add("text-fix-ready");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();


(() => {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.__seoWibeDisableBellRuntimeFinalV20260331 !== false) return;
  const decodeText = (value) => {
    const raw = String(value == null ? "" : value);
    if (!raw) return "";
    try {
      if (typeof window.decodePossiblyMojibake === "function") {
        return String(window.decodePossiblyMojibake(raw) || raw);
      }
    } catch (_) {}
    return raw;
  };

  const cleanText = (value) => decodeText(value).replace(/[\u0000-\u001F\u007F-\u009F]+/g, " ").replace(/\s{2,}/g, " ").trim();

  const meaningfulText = (value) => {
    const text = cleanText(value);
    if (!text) return "";
    if (/^(true|false|null|none|undefined|nan)$/i.test(text)) return "";
    const compact = text.replace(/\s+/g, "");
    if (compact && /^[\d:.\-+/()]+$/.test(compact)) return "";
    if (!/[A-Za-zА-Яа-яЁё]/.test(text)) return "";
    return text;
  };

  const pickText = (items, fallback = "") => {
    const variants = (Array.isArray(items) ? items : [])
      .map((value) => meaningfulText(value))
      .filter(Boolean);
    if (!variants.length) return cleanText(fallback);
    return variants.sort((left, right) => {
      const leftScore = (left.match(/[\u0420\u0421\u0412\u00d0\u00d1]/g) || []).length;
      const rightScore = (right.match(/[\u0420\u0421\u0412\u00d0\u00d1]/g) || []).length;
      if (leftScore !== rightScore) return leftScore - rightScore;
      return left.length - right.length;
    })[0];
  };

  const kindLabel = (kind) => {
    const code = String(kind || "").trim().toLowerCase();
    if (code.includes("chat_reaction")) return window.tr ? window.tr("Новая реакция", "New reaction") : "New reaction";
    if (code.includes("chat")) return window.tr ? window.tr("Новое сообщение", "New message") : "New message";
    if (code.includes("task")) return window.tr ? window.tr("Задачи", "Tasks") : "Tasks";
    if (code.includes("calendar") || code.includes("event") || code.includes("reminder")) {
      return window.tr ? window.tr("Календарь", "Calendar") : "Calendar";
    }
    return window.tr ? window.tr("Уведомление", "Notification") : "Notification";
  };

  const resolveNotificationTextBellFinal = (row) => {
    const source = row && typeof row === "object" ? row : {};
    const payload = source.payload && typeof source.payload === "object" ? source.payload : {};
    const code = String(source.kind || payload.kind || "").trim().toLowerCase();
    const title = pickText([
      source.display_title,
      source.notification_title,
      source.title,
      source.subject,
      source.summary,
      payload.display_title,
      payload.notification_title,
      payload.display_kind,
      payload.title,
      payload.subject,
      payload.summary,
      payload.chat_title,
      payload.chat_name,
      payload.thread_title,
      payload.thread_name,
      payload.event_title,
      payload.task_title,
      payload.announcement_title,
      payload.sender_name,
      payload.sender_nick,
      payload.actor_nick,
      payload.author,
    ], kindLabel(code)) || kindLabel(code);
    let body = pickText([
      source.display_body,
      source.notification_body,
      source.body,
      source.text,
      source.preview,
      source.message,
      source.subtitle,
      payload.display_body,
      payload.notification_body,
      payload.body,
      payload.preview,
      payload.preview_text,
      payload.message_text,
      payload.text,
      payload.message,
      payload.content,
      payload.snippet,
      payload.note,
      payload.description,
      payload.task_description,
      payload.event_description,
    ], "");
    if (!body && code.includes("chat")) {
      const sender = pickText([
        payload.sender_nick,
        payload.sender_name,
        payload.actor_nick,
        payload.author,
      ], "");
      const preview = pickText([
        payload.preview_text,
        payload.preview,
        payload.message_text,
        payload.text,
        payload.message,
        source.preview,
        source.text,
        source.message,
      ], "");
      body = [sender, preview].filter(Boolean).join(": ");
    }
    if (!body) {
      body = window.tr ? window.tr("Без текста", "No text") : "No text";
    }
    return { title, body };
  };

  const normalizeRows = (rows) => (Array.isArray(rows) ? rows : []).map((row) => {
    const text = resolveNotificationTextBellFinal(row);
    return {
      ...(row && typeof row === "object" ? row : {}),
      title: String(text.title || "").trim(),
      body: String(text.body || "").trim(),
      display_title: String(text.title || "").trim(),
      display_body: String(text.body || "").trim(),
    };
  });

  const normalizeCenterDom = () => {
    const center = document.getElementById("socialNotificationCenter");
    const rows = Array.isArray(window.socialState?.notificationRows) ? window.socialState.notificationRows : [];
    if (!center) return;
    center.querySelectorAll("[title]").forEach((node) => {
      try { node.removeAttribute("title"); } catch (_) {}
    });
    center.querySelectorAll(".social-notif-item").forEach((item, index) => {
      const id = Number(item.getAttribute("data-notif-id") || 0);
      const row = rows.find((entry) => Number(entry?.id || 0) === id) || null;
      const text = resolveNotificationTextBellFinal(row);
      const titleNode = item.querySelector(".social-notif-item-head b");
      const bodyNode = item.querySelector("p");
      if (titleNode) titleNode.textContent = text.title;
      if (bodyNode) bodyNode.textContent = text.body;
    });
  };

  const previousResolve = typeof window.socialResolveNotificationText === "function"
    ? window.socialResolveNotificationText
    : null;
  const previousLoad = typeof window.socialLoadNotificationCenterRows === "function"
    ? window.socialLoadNotificationCenterRows
    : null;
  const previousRender = typeof window.socialRenderNotificationCenter === "function"
    ? window.socialRenderNotificationCenter
    : null;

  window.socialResolveNotificationText = function socialResolveNotificationTextBellFinal(row) {
    const base = previousResolve ? previousResolve.call(this, row) : {};
    const resolved = resolveNotificationTextBellFinal({
      ...(row && typeof row === "object" ? row : {}),
      title: base?.title || row?.title || "",
      body: base?.body || row?.body || "",
      display_title: row?.display_title || base?.title || "",
      display_body: row?.display_body || base?.body || "",
    });
    return {
      ...(base && typeof base === "object" ? base : {}),
      title: resolved.title,
      body: resolved.body,
    };
  };
  window.socialResolveNotificationText.__seoWibeBellFinalV20260331 = true;

  window.socialLoadNotificationCenterRows = async function socialLoadNotificationCenterRowsBellFinal() {
    const rows = previousLoad ? await Promise.resolve(previousLoad.apply(this, arguments)).catch(() => []) : [];
    const normalized = normalizeRows(rows);
    if (window.socialState && typeof window.socialState === "object") {
      window.socialState.notificationRows = normalized;
    }
    return normalized;
  };
  window.socialLoadNotificationCenterRows.__seoWibeBellFinalV20260331 = true;

  window.socialRenderNotificationCenter = function socialRenderNotificationCenterBellFinal() {
    const result = previousRender ? previousRender.apply(this, arguments) : null;
    setTimeout(normalizeCenterDom, 0);
    setTimeout(normalizeCenterDom, 120);
    setTimeout(normalizeCenterDom, 260);
    return result;
  };
  window.socialRenderNotificationCenter.__seoWibeBellFinalV20260331 = true;

  window.socialToggleNotificationCenter = async function socialToggleNotificationCenterBellFinal(forceOpen = null) {
    const center = typeof window.socialRenderNotificationCenter === "function"
      ? window.socialRenderNotificationCenter()
      : document.getElementById("socialNotificationCenter");
    if (!center) return false;
    const shouldOpen = typeof forceOpen === "boolean"
      ? forceOpen
      : center.classList.contains("hidden") || center.style.display === "none";
    if (!shouldOpen) {
      if (window.socialState && typeof window.socialState === "object") {
        window.socialState.notificationCenterOpen = false;
      }
      center.classList.add("hidden");
      center.style.display = "none";
      return false;
    }
    const rows = await Promise.resolve(window.socialLoadNotificationCenterRows()).catch(() => []);
    if (window.socialState && typeof window.socialState === "object") {
      window.socialState.notificationCenterOpen = true;
      window.socialState.notificationRows = normalizeRows(rows);
    }
    if (typeof window.socialRenderNotificationCenter === "function") {
      window.socialRenderNotificationCenter(window.socialState?.notificationRows || rows);
    }
    center.classList.remove("hidden");
    center.style.display = "flex";
    setTimeout(normalizeCenterDom, 0);
    setTimeout(normalizeCenterDom, 120);
    setTimeout(normalizeCenterDom, 260);
    return true;
  };
  window.socialToggleNotificationCenter.__seoWibeBellFinalV20260331 = true;

  const bindBellButtonsFinal = () => {
    ["socialBellBtn", "mobileDrawerBellBtn"].forEach((id) => {
      const button = document.getElementById(id);
      if (!button) return;
      if (button.dataset.seoWibeBellBoundV20260331 === "1") return;
      button.dataset.seoWibeBellOwnerV20260331 = "1";
      button.dataset.seoWibeBellBoundV20260331 = "1";
      button.removeAttribute("onclick");
      button.removeAttribute("title");
      button.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === "function") {
          event.stopImmediatePropagation();
        }
        const center = document.getElementById("socialNotificationCenter");
        const shouldOpen = !center || center.classList.contains("hidden") || center.style.display === "none";
        await Promise.resolve(window.socialToggleNotificationCenter(shouldOpen)).catch(() => false);
        if (id === "mobileDrawerBellBtn" && typeof window.closeMobileNav === "function") {
          try { window.closeMobileNav(); } catch (_) {}
        }
      }, true);
    });
  };

  window.socialBindBellButtonsNow = bindBellButtonsFinal;

  const scheduleBellRefresh = () => {
    bindBellButtonsFinal();
    normalizeCenterDom();
  };

  document.addEventListener("click", (event) => {
    const bellBtn = event.target?.closest?.("#socialBellBtn, #mobileDrawerBellBtn");
    if (!bellBtn) return;
    setTimeout(scheduleBellRefresh, 0);
    setTimeout(scheduleBellRefresh, 160);
  }, true);

  window.addEventListener("popstate", () => {
    setTimeout(scheduleBellRefresh, 0);
  });

  setTimeout(scheduleBellRefresh, 0);
  setTimeout(scheduleBellRefresh, 220);
})();


(() => {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.__seoWibeDisableTextBehaviorOverrides === true) return;
  if (window.__seoWibeCalendarNotificationStabilizer20260329 === true) return;
  window.__seoWibeCalendarNotificationStabilizer20260329 = true;

  const safeInvoke = (fn, ...args) => {
    try {
      if (typeof fn === "function") return fn(...args);
    } catch (_) {}
    return undefined;
  };

  const state = () => (window.socialState && typeof window.socialState === "object" ? window.socialState : {});
  const isAppShell = () => Boolean(
    safeInvoke(window.socialIsMobileApkShell)
    || safeInvoke(window.socialIsMobileClientShell)
    || safeInvoke(window.socialIsAppShellLike)
  );
  const trText = (ru, en) => (String(document.documentElement.lang || "").trim().toLowerCase() === "en" ? en : ru);
  const decodeText = (value) => {
    try {
      if (typeof window.socialDecodeUiText === "function") {
        return String(window.socialDecodeUiText(value) || "").trim();
      }
    } catch (_) {}
    return String(value == null ? "" : value).trim();
  };
  const sanitizeText = (value) => decodeText(value).replace(/\s+/g, " ").trim();
  const meaningfulText = (value) => {
    const text = sanitizeText(value);
    if (!text) return "";
    if (/^(true|false|null|none|undefined|nan)$/i.test(text)) return "";
    const compact = text.replace(/\s+/g, "");
    if (compact && /^[\d:.\-+/()]+$/.test(compact)) return "";
    if (!/[A-Za-zА-Яа-яЁё]/.test(text)) return "";
    return text;
  };
  const flattenValues = (value, acc = []) => {
    if (value == null) return acc;
    if (Array.isArray(value)) {
      value.forEach((item) => flattenValues(item, acc));
      return acc;
    }
    if (typeof value === "object") {
      Object.keys(value).forEach((key) => flattenValues(value[key], acc));
      return acc;
    }
    acc.push(String(value));
    return acc;
  };
  const notificationKindLabel = (kind) => {
    const code = String(kind || "").trim().toLowerCase();
    if (code.includes("chat_reaction")) return trText("Новая реакция", "New reaction");
    if (code.includes("chat")) return trText("Новое сообщение", "New message");
    if (code.includes("task")) return trText("Задачи", "Tasks");
    if (code.includes("calendar") || code.includes("event") || code.includes("reminder")) {
      return trText("Календарь", "Calendar");
    }
    return trText("Уведомление", "Notification");
  };
  const pickNotificationText = (candidates, fallback = "") => {
    const variants = flattenValues(candidates, [])
      .map((item) => meaningfulText(item))
      .filter(Boolean);
    if (!variants.length) return sanitizeText(fallback);
    const unique = [...new Set(variants)];
    return unique.sort((left, right) => {
      const leftPenalty = /[ÐÑРС]/.test(left) ? 1 : 0;
      const rightPenalty = /[ÐÑРС]/.test(right) ? 1 : 0;
      if (leftPenalty !== rightPenalty) return leftPenalty - rightPenalty;
      return right.length - left.length;
    })[0];
  };
  const resolveNotificationTextStable = (row) => {
    const safeRow = row && typeof row === "object" ? row : {};
    const payload = safeRow.payload && typeof safeRow.payload === "object" ? safeRow.payload : {};
    const kind = String(safeRow.kind || payload.kind || "").trim().toLowerCase();
    const titleFallback = notificationKindLabel(kind);
    const title = pickNotificationText([
      safeRow.title,
      safeRow.subject,
      safeRow.kind_label,
      payload.title,
      payload.subject,
      payload.chat_title,
      payload.thread_title,
      payload.sender_nick,
      payload.sender_name,
      payload.actor_nick,
      payload.author,
    ], titleFallback) || titleFallback;
    let body = pickNotificationText([
      safeRow.body,
      safeRow.text,
      safeRow.preview,
      safeRow.message,
      safeRow.subtitle,
      payload.body,
      payload.text,
      payload.preview,
      payload.message,
      payload.content,
      payload.snippet,
      payload.note,
      payload.description,
    ], "");
    if (!body && kind.includes("chat")) {
      const sender = pickNotificationText([
        payload.sender_nick,
        payload.sender_name,
        payload.actor_nick,
        payload.author,
      ], "");
      const preview = pickNotificationText([
        payload.preview,
        payload.text,
        payload.message,
        safeRow.preview,
        safeRow.message,
        safeRow.text,
      ], "");
      body = [sender, preview].filter(Boolean).join(": ");
    }
    if (!body && kind.includes("reaction")) {
      body = pickNotificationText([
        payload.sender_nick,
        payload.actor_nick,
        payload.emoji,
      ], "");
    }
    return {
      title: title || titleFallback,
      body: body || trText("Без текста", "No text"),
    };
  };

  if (!disableInteractiveRuntimeOverrides) {
    window.socialResolveNotificationText = function socialResolveNotificationTextStable20260329(row) {
      return resolveNotificationTextStable(row);
    };
    window.socialResolveNotificationText.__seoWibeStable20260329 = "1";
  }

  const normalizeNotificationCenterStable = () => {
    const center = document.getElementById("socialNotificationCenter");
    if (!center) return;
    center.querySelectorAll("[title]").forEach((node) => node.removeAttribute("title"));
    center.querySelectorAll(".social-notif-item").forEach((item) => {
      const id = Number(item.getAttribute("data-notif-id") || 0);
      const row = (Array.isArray(state().notificationRows) ? state().notificationRows : []).find((entry) => Number(entry?.id || 0) === id) || null;
      const text = resolveNotificationTextStable(row);
      const titleNode = item.querySelector(".social-notif-item-head b");
      const bodyNode = item.querySelector("p");
      if (titleNode) titleNode.textContent = text.title;
      if (bodyNode) bodyNode.textContent = text.body;
    });
  };

  const wrapStable = (name, factory) => {
    if (shouldSkipBehaviorOverride(name)) return;
    const original = typeof window[name] === "function" ? window[name] : null;
    if (!original || original.__seoWibeStable20260329 === "1") return;
    const wrapped = factory(original);
    if (typeof wrapped === "function") {
      wrapped.__seoWibeStable20260329 = "1";
      window[name] = wrapped;
    }
  };

  wrapStable("socialLoadNotificationCenterRows", (original) => async function wrappedLoadNotificationCenterRowsStable() {
    const rows = await original.apply(this, arguments);
    if (Array.isArray(state().notificationRows)) {
      state().notificationRows = state().notificationRows.map((row) => {
        const text = resolveNotificationTextStable(row);
        return {
          ...(row && typeof row === "object" ? row : {}),
          title: text.title,
          body: text.body,
        };
      });
    }
    normalizeNotificationCenterStable();
    return rows;
  });

  wrapStable("socialRenderNotificationCenter", (original) => function wrappedRenderNotificationCenterStable() {
    const result = original.apply(this, arguments);
    normalizeNotificationCenterStable();
    return result;
  });

  wrapStable("socialToggleNotificationCenter", (original) => async function wrappedToggleNotificationCenterStable() {
    const result = await original.apply(this, arguments);
    normalizeNotificationCenterStable();
    return result;
  });

  const pad = (value) => String(Number(value || 0)).padStart(2, "0");
  const calendarDayKey = (value) => String(safeInvoke(window.socialCalendarDayKey, value) || "").trim();
  const parseCalendarDate = (value) => {
    const parsed = safeInvoke(window.socialCalendarParseDate, value);
    if (parsed instanceof Date && !Number.isNaN(parsed.getTime())) return parsed;
    const fallback = new Date(value || Date.now());
    return fallback instanceof Date && !Number.isNaN(fallback.getTime()) ? fallback : new Date();
  };
  const normalizeCalendarDate = () => {
    const current = parseCalendarDate(state().calendarDate || new Date());
    const normalized = new Date(current.getFullYear(), current.getMonth(), 1, 12, 0, 0, 0);
    state().calendarDate = normalized;
    return normalized;
  };
  const calendarMonthValue = (value) => {
    const dt = parseCalendarDate(value);
    const safe = new Date(dt.getFullYear(), dt.getMonth(), 1, 12, 0, 0, 0);
    return String(safeInvoke(window.socialCalendarMonthValue, safe) || `${safe.getFullYear()}-${pad(safe.getMonth() + 1)}`).trim();
  };
  const calendarMonthLabel = (value) => {
    const dt = parseCalendarDate(value);
    return String(
      safeInvoke(window.socialCalendarMonthLabel, dt)
      || dt.toLocaleDateString(String(document.documentElement.lang || "").trim().toLowerCase() === "en" ? "en-US" : "ru-RU", {
        month: "long",
        year: "numeric",
      })
      || ""
    ).trim();
  };
  const calendarModalVisible = () => Boolean(document.getElementById("socialModal") && !document.getElementById("socialModal").classList.contains("hidden"));
  const calendarMonthPickerVisible = () => Boolean(document.querySelector("#socialModal:not(.hidden) .social-calendar-month-year-modal"));
  const calendarGrid = () => document.getElementById("socialCalendarGrid");
  const hasCalendarDays = () => Boolean(document.querySelector("#socialCalendarGrid .social-day[data-day-key]"));

  const ensureCalendarShellVisible = () => {
    const root = document.getElementById("socialSubtabCalendar");
    const grid = calendarGrid();
    [root, root?.querySelector(".social-calendar-shell"), root?.querySelector(".social-calendar-board"), root?.querySelector(".social-calendar-main"), grid].forEach((node) => {
      if (!node) return;
      node.hidden = false;
      node.style.removeProperty("display");
      node.style.removeProperty("visibility");
      node.style.removeProperty("opacity");
      node.style.removeProperty("max-height");
      node.style.removeProperty("min-height");
    });
    if (grid) {
      grid.style.setProperty("display", "block", "important");
      grid.style.setProperty("visibility", "visible", "important");
      grid.style.setProperty("opacity", "1", "important");
      grid.style.setProperty("min-height", "360px", "important");
    }
  };

  const hideLegacyCalendarPanels = () => {
    safeInvoke(window.socialHideCalendarLegacyDetails);
    const root = document.getElementById("socialSubtabCalendar");
    if (!root) return;
    [
      "#socialCalendarEvents",
      "#socialCalendarEventsLegacy",
      ".social-calendar-events",
      ".social-calendar-selected",
      ".social-calendar-selected-day",
      ".social-calendar-day-header",
      ".social-calendar-day-details",
      ".social-calendar-day-list",
      ".social-calendar-records",
      ".social-calendar-summary",
      ".social-calendar-selected-wrap",
      ".social-calendar-selected-panel",
      ".social-calendar-day-panel",
      ".social-calendar-day-cards",
      ".social-calendar-day-entries",
      ".social-calendar-bottom",
      ".social-calendar-lower",
      "[data-calendar-detail]",
      "[data-selected-day]",
    ].forEach((selector) => {
      root.querySelectorAll(selector).forEach((node) => {
        if (!node || node.id === "socialCalendarDaySheet" || node.id === "socialCalendarDaySheetBackdrop") return;
        if (node.closest?.("#socialCalendarDaySheet")) return;
        node.hidden = true;
        node.style.setProperty("display", "none", "important");
        node.style.setProperty("max-height", "0", "important");
        node.style.setProperty("min-height", "0", "important");
      });
    });
  };

  const normalizeCalendarHeaderStable = () => {
    const root = document.getElementById("socialSubtabCalendar");
    const label = document.getElementById("socialCalendarMonthLabel");
    if (label) {
      label.textContent = calendarMonthLabel(normalizeCalendarDate());
      label.style.setProperty("display", "block", "important");
      label.style.setProperty("width", "100%", "important");
      label.style.setProperty("margin", "0 auto 8px", "important");
      label.style.setProperty("text-align", "center", "important");
      label.style.setProperty("justify-self", "center", "important");
      label.style.setProperty("align-self", "center", "important");
      label.style.setProperty("cursor", "pointer", "important");
      label.removeAttribute("title");
    }
    if (root && isAppShell()) {
      root.querySelectorAll("#socialCalendarMonthSelect, #socialCalendarYearSelect, .social-calendar-picker, .social-calendar-nav-controls, #socialCalendarMonth, #socialCalendarYear").forEach((node) => {
        if (!node || node === label) return;
        node.hidden = true;
        node.style.setProperty("display", "none", "important");
        node.style.setProperty("visibility", "hidden", "important");
        node.style.setProperty("pointer-events", "none", "important");
      });
    }
  };

  const renderCalendarGridStable = () => {
    const grid = calendarGrid();
    if (!grid) return false;
    ensureCalendarShellVisible();
    const d = normalizeCalendarDate();
    const year = d.getFullYear();
    const month = d.getMonth();
    const todayKey = calendarDayKey(new Date());
    const firstDay = new Date(year, month, 1, 0, 0, 0, 0);
    const lastDay = new Date(year, month + 1, 0, 0, 0, 0, 0);
    const shift = (firstDay.getDay() + 6) % 7;
    const days = lastDay.getDate();
    const eventsByDay = new Map();
    const tasksByDay = new Map();
    const myTasksByDay = new Map();
    const myActorKey = String(state().boot?.actor?.actor_key || "").trim();

    (Array.isArray(state().calendarEvents) ? state().calendarEvents : []).forEach((eventRow) => {
      const key = calendarDayKey(safeInvoke(window.socialCalendarResolveEventStart, eventRow));
      if (!key) return;
      if (!eventsByDay.has(key)) eventsByDay.set(key, []);
      eventsByDay.get(key).push(eventRow);
    });
    (Array.isArray(state().tasks) ? state().tasks : []).forEach((taskRow) => {
      const key = calendarDayKey(safeInvoke(window.socialCalendarResolveTaskDue, taskRow));
      if (!key) return;
      if (!tasksByDay.has(key)) tasksByDay.set(key, []);
      tasksByDay.get(key).push(taskRow);
      if (myActorKey && String(taskRow?.assignee_key || "").trim() === myActorKey) {
        if (!myTasksByDay.has(key)) myTasksByDay.set(key, []);
        myTasksByDay.get(key).push(taskRow);
      }
    });

    const weekdays = [
      trText("Пн", "Mon"),
      trText("Вт", "Tue"),
      trText("Ср", "Wed"),
      trText("Чт", "Thu"),
      trText("Пт", "Fri"),
      trText("Сб", "Sat"),
      trText("Вс", "Sun"),
    ];
    let html = `<div class="social-calendar-row head">${weekdays.map((label) => `<span>${label}</span>`).join("")}</div><div class="social-calendar-cells">`;
    for (let i = 0; i < shift; i += 1) html += `<button class="social-day muted" disabled></button>`;
    for (let day = 1; day <= days; day += 1) {
      const key = `${year}-${pad(month + 1)}-${pad(day)}`;
      const eventsCount = (eventsByDay.get(key) || []).length;
      const tasksCount = (tasksByDay.get(key) || []).length;
      const myTasksCount = (myTasksByDay.get(key) || []).length;
      const active = String(state().calendarSelectedDay || "").trim() === key ? "active" : "";
      const isToday = todayKey && key === todayKey ? "today" : "";
      const hasEvents = eventsCount > 0 ? "has-event" : "";
      const hasTasks = tasksCount > 0 ? "has-task" : "";
      const hasMyTasks = myTasksCount > 0 ? "has-my-task" : "";
      const previewRows = [];
      (eventsByDay.get(key) || []).forEach((eventRow) => {
        const title = sanitizeText(safeInvoke(window.socialCalendarResolveEventTitle, eventRow) || eventRow?.title || "") || trText("Запись", "Entry");
        previewRows.push({
          title,
          color: String(eventRow?.color || "#8fb8ff").trim() || "#8fb8ff",
        });
      });
      (tasksByDay.get(key) || []).forEach((taskRow) => {
        const title = sanitizeText(safeInvoke(window.socialCalendarResolveTaskTitle, taskRow) || taskRow?.title || "") || trText("Задача", "Task");
        const ownTask = myActorKey && String(taskRow?.assignee_key || "").trim() === myActorKey;
        previewRows.push({
          title,
          color: ownTask ? "#8fd0a7" : "#d9bcff",
        });
      });
      const chips = previewRows.slice(0, 3).map((item) => {
        const shortTitle = item.title.length > 20 ? `${item.title.slice(0, 19)}...` : item.title;
        return `<span class="sw-calendar-chip" style="--sw-chip-color:${String(item.color || "#8fb8ff").trim()}"><span class="sw-calendar-chip-title">${shortTitle.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[ch]))}</span></span>`;
      }).join("");
      const hiddenCount = Math.max(0, (eventsCount + tasksCount) - Math.min(3, previewRows.length));
      const more = hiddenCount > 0 ? `<span class="sw-calendar-more">+${hiddenCount}</span>` : "";
      html += `<button class="social-day rich ${active} ${isToday} ${hasEvents} ${hasTasks} ${hasMyTasks}" data-day-key="${key}" type="button" onclick="socialShowDay('${key}')"><div class="social-day-head"><b>${day}</b></div><div class="social-day-preview-stack">${chips}</div>${more}</button>`;
    }
    html += "</div>";
    grid.innerHTML = html;
    ensureCalendarShellVisible();
    normalizeCalendarHeaderStable();
    const todayFallback = todayKey && String(todayKey).startsWith(`${year}-${pad(month + 1)}-`) ? todayKey : "";
    const fallback = todayFallback || `${year}-${pad(month + 1)}-01`;
    const inMonth = String(state().calendarSelectedDay || "").startsWith(`${year}-${pad(month + 1)}-`);
    const selectedKey = inMonth ? String(state().calendarSelectedDay || "") : fallback;
    state().calendarSelectedDay = selectedKey;
    try {
      document.querySelector(`#socialCalendarGrid .social-day[data-day-key="${CSS.escape(selectedKey)}"]`)?.classList?.add("active");
    } catch (_) {}
    hideLegacyCalendarPanels();
    if (state().calendarDaySheetOpen && selectedKey && !calendarMonthPickerVisible() && !document.querySelector("#socialCalendarDaySheet.hidden")) {
      setTimeout(() => safeInvoke(window.socialOpenCalendarDaySheet, selectedKey), 0);
    }
    return true;
  };

  const recoverCalendarStable = () => {
    ensureCalendarShellVisible();
    normalizeCalendarHeaderStable();
    hideLegacyCalendarPanels();
    renderCalendarGridStable();
    setTimeout(() => {
      ensureCalendarShellVisible();
      normalizeCalendarHeaderStable();
      hideLegacyCalendarPanels();
      if (!hasCalendarDays()) {
        renderCalendarGridStable();
      }
    }, 120);
  };

  wrapStable("socialRenderCalendar", (original) => function wrappedRenderCalendarStable() {
    const result = original.apply(this, arguments);
    setTimeout(recoverCalendarStable, 0);
    return result;
  });

  wrapStable("socialLoadCalendar", (original) => async function wrappedLoadCalendarStable() {
    const result = await original.apply(this, arguments);
    setTimeout(recoverCalendarStable, 0);
    setTimeout(recoverCalendarStable, 180);
    return result;
  });

  wrapStable("socialShiftCalendar", (original) => function wrappedShiftCalendarStable() {
    const result = original.apply(this, arguments);
    setTimeout(recoverCalendarStable, 40);
    setTimeout(recoverCalendarStable, 180);
    return result;
  });

  wrapStable("socialShowDay", (original) => function wrappedShowDayStable() {
    const result = original.apply(this, arguments);
    setTimeout(hideLegacyCalendarPanels, 0);
    return result;
  });

  wrapStable("socialOpenCalendarDaySheet", (original) => function wrappedOpenCalendarDaySheetStable() {
    const result = original.apply(this, arguments);
    setTimeout(hideLegacyCalendarPanels, 0);
    return result;
  });

  wrapStable("socialOpenCalendarRecordDetail", (original) => function wrappedOpenCalendarRecordDetailStable() {
    const result = original.apply(this, arguments);
    setTimeout(() => document.querySelectorAll("#socialModal [title]").forEach((node) => node.removeAttribute("title")), 0);
    return result;
  });

  wrapStable("socialOpenCalendarMonthYearPicker", (original) => function wrappedOpenCalendarMonthYearPickerStable() {
    const result = original.apply(this, arguments);
    state().calendarMonthPickerOpen = true;
    setTimeout(() => {
      document.querySelectorAll("#socialModal [title]").forEach((node) => node.removeAttribute("title"));
      normalizeCalendarHeaderStable();
    }, 0);
    return result;
  });

  wrapStable("socialApplyCalendarMonthYearPicker", (original) => function wrappedApplyCalendarMonthYearPickerStable() {
    const result = original.apply(this, arguments);
    state().calendarMonthPickerOpen = false;
    setTimeout(recoverCalendarStable, 40);
    setTimeout(recoverCalendarStable, 220);
    return result;
  });

  wrapStable("socialCloseModal", (original) => function wrappedCloseModalStable() {
    const wasMonthPicker = calendarMonthPickerVisible();
    const result = original.apply(this, arguments);
    if (wasMonthPicker) {
      state().calendarMonthPickerOpen = false;
      setTimeout(recoverCalendarStable, 0);
      setTimeout(recoverCalendarStable, 180);
    }
    return result;
  });

  wrapStable("socialCalendarBackLayer", (original) => function wrappedCalendarBackLayerStable() {
    const result = original.apply(this, arguments);
    setTimeout(recoverCalendarStable, 0);
    return result;
  });

  const refreshStable = () => {
    normalizeNotificationCenterStable();
    if (disableTextBehaviorOverrides) return;
    normalizeCalendarHeaderStable();
    hideLegacyCalendarPanels();
    if (!hasCalendarDays()) {
      recoverCalendarStable();
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", refreshStable, { once: true });
  } else {
    refreshStable();
  }
  window.addEventListener("resize", refreshStable);
  setTimeout(refreshStable, 120);
  setTimeout(refreshStable, 480);
})();

// Keep legacy Samsung patch in notes mode only; calendar is owned by the newer stabilizer above.
window.__seoWibeSamsungCalendarController = "v4";

(function patchSamsungCalendarAndNotesV20260326() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.__patchSamsungCalendarAndNotesV20260326) return;
  window.__patchSamsungCalendarAndNotesV20260326 = true;

  const calendarOwnedByV4 = () => window.__seoWibeSamsungCalendarController === "v4";

  const isAppShell = () => {
    try {
      if (document.body?.classList?.contains("mobile-apk-mode")) return true;
      if (document.body?.classList?.contains("mobile-client-mode")) return true;
      if (typeof window.socialIsAppShellLike === "function") return Boolean(window.socialIsAppShellLike());
      return String(window.location?.pathname || "").trim() === "/mobile";
    } catch (_) {
      return false;
    }
  };

  const isCompact = () => {
    try {
      const width = Number(window.innerWidth || document.documentElement?.clientWidth || 0);
      return width > 0 && width <= 980;
    } catch (_) {
      return false;
    }
  };

  const t = (ru, en) => {
    try {
      if (typeof window.tr === "function") return String(window.tr(ru, en) || ru || en || "");
    } catch (_) {}
    const lang = String(window.currentLang || document.documentElement?.lang || "").trim().toLowerCase();
    return (lang === "en" ? en : ru) || ru || en || "";
  };

  const safeInvoke = (fn, ...args) => {
    if (typeof fn !== "function") return undefined;
    try {
      return fn(...args);
    } catch (_) {
      return undefined;
    }
  };

  const hideLegacyCalendarPanels = () => {
    if (calendarOwnedByV4()) return;
    const root = document.getElementById("socialSubtabCalendar");
    if (!root) return;
    const selectors = [
      "#socialCalendarEvents",
      "#socialCalendarEventsLegacy",
      ".social-calendar-events",
      ".social-calendar-selected",
      ".social-calendar-selected-day",
      ".social-calendar-day-header",
      ".social-calendar-day-details",
      ".social-calendar-day-list",
      ".social-calendar-records",
      ".social-calendar-summary",
      ".social-calendar-selected-wrap",
      ".social-calendar-selected-panel",
      ".social-calendar-day-panel",
      ".social-calendar-day-cards",
      ".social-calendar-day-entries",
      ".social-calendar-bottom",
      ".social-calendar-lower",
      "[data-calendar-detail]",
      "[data-selected-day]",
    ];
    root.querySelectorAll(selectors.join(",")).forEach((node) => {
      if (!node) return;
      node.hidden = true;
      node.setAttribute("aria-hidden", "true");
      node.style.setProperty("display", "none", "important");
      node.style.setProperty("max-height", "0", "important");
      node.style.setProperty("min-height", "0", "important");
      node.style.setProperty("overflow", "hidden", "important");
      node.style.setProperty("margin", "0", "important");
      node.style.setProperty("padding", "0", "important");
      node.style.setProperty("border", "0", "important");
      node.style.setProperty("box-shadow", "none", "important");
    });
    const shell = root.querySelector(".social-calendar-shell") || root;
    Array.from(shell.children || []).forEach((child) => {
      if (!child) return;
      if (child.classList?.contains("social-calendar-hero")) return;
      if (child.classList?.contains("social-calendar-board")) return;
      if (child.id === "socialCalendarFab") return;
      child.hidden = true;
      child.setAttribute("aria-hidden", "true");
      child.style.setProperty("display", "none", "important");
    });
    root.querySelectorAll(".social-calendar-board").forEach((board) => {
      Array.from(board.children || []).forEach((child) => {
        if (!child) return;
        if (child.classList?.contains("social-calendar-main")) return;
        if (child.id === "socialCalendarFab") return;
        child.hidden = true;
        child.setAttribute("aria-hidden", "true");
        child.style.setProperty("display", "none", "important");
      });
    });
    root.querySelectorAll(".social-calendar-main").forEach((main) => {
      Array.from(main.children || []).forEach((child) => {
        if (!child) return;
        if (child.id === "socialCalendarGrid") return;
        child.hidden = true;
        child.setAttribute("aria-hidden", "true");
        child.style.setProperty("display", "none", "important");
      });
    });
  };

  const ensureCalendarOverlayNodes = () => {
    if (calendarOwnedByV4()) return;
    const backdrop = document.getElementById("socialCalendarDaySheetBackdrop");
    const sheet = document.getElementById("socialCalendarDaySheet");
    if (backdrop && backdrop.parentElement !== document.body) document.body.appendChild(backdrop);
    if (sheet && sheet.parentElement !== document.body) document.body.appendChild(sheet);
  };

  const ensureCalendarHeader = () => {
    if (calendarOwnedByV4()) return;
    const root = document.getElementById("socialSubtabCalendar");
    if (!root) return;
    const hero = root.querySelector(".social-calendar-hero");
    const heroCopy = root.querySelector(".social-calendar-hero-copy");
    const monthLabel = document.getElementById("socialCalendarMonthLabel");
    const monthInput = document.getElementById("socialCalendarMonth");
    const nav = root.querySelector(".social-calendar-nav-controls");
    if (hero) {
      hero.style.setProperty("display", "grid", "important");
      hero.style.setProperty("justify-items", "center", "important");
      hero.style.setProperty("align-items", "center", "important");
    }
    if (heroCopy) {
      heroCopy.style.setProperty("display", "grid", "important");
      heroCopy.style.setProperty("place-items", "center", "important");
      heroCopy.style.setProperty("width", "100%", "important");
      heroCopy.style.setProperty("text-align", "center", "important");
    }
    if (monthLabel) {
      monthLabel.style.setProperty("display", "block", "important");
      monthLabel.style.setProperty("width", "100%", "important");
      monthLabel.style.setProperty("text-align", "center", "important");
      monthLabel.style.setProperty("justify-self", "center", "important");
      monthLabel.style.setProperty("margin", "0 auto", "important");
      monthLabel.style.setProperty("cursor", "pointer", "important");
      monthLabel.setAttribute("title", t("Выбрать месяц и год", "Select month and year"));
      if (monthLabel.dataset.sheetMonthBound !== "1") {
        monthLabel.dataset.sheetMonthBound = "1";
        monthLabel.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          safeInvoke(window.socialOpenCalendarMonthYearPicker);
        });
      }
    }
    if (monthInput) {
      monthInput.classList.add("hidden");
      monthInput.style.setProperty("display", "none", "important");
    }
    root.querySelectorAll("#socialCalendarMonthSelect, #socialCalendarYearSelect, .social-calendar-picker").forEach((node) => {
      node.classList.add("hidden");
      node.style.setProperty("display", "none", "important");
    });
    if (nav) {
      nav.classList.toggle("is-app-shell", isAppShell());
      nav.style.setProperty("width", "100%", "important");
      nav.style.setProperty("justify-content", isAppShell() ? "center" : "space-between", "important");
      nav.querySelectorAll(".social-calendar-picker").forEach((node) => {
        node.style.setProperty("display", "none", "important");
      });
      nav.querySelectorAll(".social-calendar-nav-btn").forEach((btn) => {
        btn.style.setProperty("display", isAppShell() ? "none" : "inline-flex", "important");
      });
    }
  };

  const ensureCalendarSwipe = () => {
    if (calendarOwnedByV4()) return;
    const grid = document.getElementById("socialCalendarGrid");
    if (!grid || grid.dataset.samsungSwipeBound === "1") return;
    grid.dataset.samsungSwipeBound = "1";
    let startX = 0;
    let startY = 0;
    let active = false;
    const commitSwipe = (dx, dy) => {
      if (!isAppShell()) return;
      if (Math.abs(dx) < 42 || Math.abs(dx) <= Math.abs(dy)) return;
      safeInvoke(window.socialHideCalendarDaySheet, true);
      safeInvoke(window.socialShiftCalendar, dx > 0 ? -1 : 1);
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
      commitSwipe(touch.clientX - startX, touch.clientY - startY);
    }, { passive: true });
    grid.addEventListener("touchcancel", () => {
      active = false;
    }, { passive: true });
  };

  const forceCalendarSheet = (dayKey) => {
    if (calendarOwnedByV4()) return;
    const safeDayKey = String(dayKey || window.socialState?.calendarSelectedDay || "").trim();
    if (!safeDayKey) return;
    window.socialState = window.socialState && typeof window.socialState === "object" ? window.socialState : {};
    window.socialState.calendarSelectedDay = safeDayKey;
    window.socialState.calendarDaySheetOpen = true;
    safeInvoke(window.socialHideCalendarLegacyDetails);
    ensureCalendarOverlayNodes();
    safeInvoke(window.socialForceOpenCalendarDaySheet, safeDayKey);
    setTimeout(hideLegacyCalendarPanels, 0);
    setTimeout(hideLegacyCalendarPanels, 50);
    setTimeout(hideLegacyCalendarPanels, 180);
  };

  const normalizeNotesGrid = () => {
    const root = document.getElementById("socialSubtabNotes");
    const host = document.getElementById("socialNotesList");
    if (!root || !host) return;
    const compactMode = isAppShell() || isCompact();
    const columns = compactMode ? "repeat(3, minmax(94px, 1fr))" : "repeat(auto-fit, minmax(124px, 1fr))";
    const cardHeight = compactMode ? 172 : 196;
    host.style.setProperty("display", "grid", "important");
    host.style.setProperty("grid-template-columns", columns, "important");
    host.style.setProperty("grid-auto-rows", `${cardHeight}px`, "important");
    host.style.setProperty("gap", compactMode ? "12px" : "14px", "important");
    host.style.setProperty("padding-top", "0", "important");
    host.style.setProperty("margin-top", compactMode ? "12px" : "8px", "important");
    host.style.setProperty("padding-bottom", compactMode ? "88px" : "24px", "important");
    root.style.setProperty("position", "relative", "important");
    root.querySelectorAll("button[onclick*='socialCreateNote']").forEach((node) => node.remove?.());
    root.querySelectorAll(".social-notes-sidebar > button").forEach((node) => node.remove?.());
    root.querySelectorAll(".social-notes-sidebar > button").forEach((node) => {
      const label = repairText(node.textContent || "").trim().toLowerCase();
      if (label === "создать запись" || label === "create note") {
        node.remove?.();
      }
    });
    let fab = document.getElementById("socialNotesFab");
    if (!fab) {
      fab = document.createElement("button");
      fab.id = "socialNotesFab";
      fab.className = "social-notes-fab";
      fab.type = "button";
      fab.textContent = "+";
      fab.setAttribute("aria-label", pick("Создать заметку", "Create note"));
      fab.setAttribute("title", pick("Создать заметку", "Create note"));
      fab.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (typeof window.socialCreateNote === "function") {
          await window.socialCreateNote();
        }
      });
      root.appendChild(fab);
    } else if (fab.parentElement !== root) {
      root.appendChild(fab);
    }
    fab.setAttribute("aria-label", pick("\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u0437\u0430\u043c\u0435\u0442\u043a\u0443", "Create note"));
    fab.setAttribute("title", pick("\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u0437\u0430\u043c\u0435\u0442\u043a\u0443", "Create note"));
    host.querySelectorAll(".social-note-delete, [class*='note-delete'], [class*='note-remove'], [class*='note-close'], [data-action='delete']").forEach((node) => {
      node.remove?.();
    });
    host.querySelectorAll(".social-note-row[data-note-id], .sw-note-card[data-note-id]").forEach((row) => {
      const id = Number(row.getAttribute("data-note-id") || 0);
      if (!id) return;
      const cover = typeof window.socialGetNoteCoverColor === "function"
        ? String(window.socialGetNoteCoverColor(id) || "").trim()
        : "";
      if (cover) row.style.setProperty("--sw-note-cover", cover);
      row.style.setProperty("background-color", cover || "#edf4ff", "important");
      row.style.setProperty("background-image", "linear-gradient(180deg, rgba(255,255,255,0.34), rgba(255,255,255,0.12))", "important");
      row.style.setProperty("height", `${cardHeight}px`, "important");
      row.style.setProperty("min-height", `${cardHeight}px`, "important");
      row.style.setProperty("max-height", `${cardHeight}px`, "important");
      row.style.setProperty("overflow", "hidden", "important");
      row.style.setProperty("width", "100%", "important");
      row.style.setProperty("min-width", "0", "important");
      row.style.setProperty("display", "block", "important");
      row.onclick = () => safeInvoke(window.socialOpenNoteEditor, id);
      const main = row.querySelector(".social-note-main");
      if (main) {
        main.style.setProperty("display", "grid", "important");
        main.style.setProperty("grid-template-rows", "auto 1fr auto", "important");
        main.style.setProperty("height", "100%", "important");
        main.style.setProperty("overflow", "hidden", "important");
        main.style.setProperty("background", "transparent", "important");
      }
    });
  };

  const wrapFn = (name, make) => {
    if (shouldSkipBehaviorOverride(name)) return;
    const original = typeof window[name] === "function" ? window[name] : null;
    if (!original) return;
    window[name] = make(original);
  };

  wrapFn("socialLoadCalendar", (original) => async function wrappedSocialLoadCalendarSamsung() {
    if (calendarOwnedByV4()) {
      return Promise.resolve(original.apply(this, arguments));
    }
    const result = await Promise.resolve(original.apply(this, arguments));
    ensureCalendarHeader();
    ensureCalendarOverlayNodes();
    ensureCalendarSwipe();
    hideLegacyCalendarPanels();
    return result;
  });

  wrapFn("socialRenderCalendar", (original) => function wrappedSocialRenderCalendarSamsung() {
    if (calendarOwnedByV4()) {
      return original.apply(this, arguments);
    }
    const result = original.apply(this, arguments);
    ensureCalendarHeader();
    ensureCalendarOverlayNodes();
    ensureCalendarSwipe();
    hideLegacyCalendarPanels();
    const monthLabel = document.getElementById("socialCalendarMonthLabel");
    if (monthLabel) {
      monthLabel.setAttribute("title", t("Выбрать месяц и год", "Select month and year"));
    }
    if (window.socialState?.calendarDaySheetOpen && window.socialState?.calendarSelectedDay) {
      setTimeout(() => forceCalendarSheet(window.socialState.calendarSelectedDay), 0);
    }
    const grid = document.getElementById("socialCalendarGrid");
    if (grid) {
      grid.querySelectorAll(".social-day[data-day-key], .sw-calendar-chip, .sw-calendar-chip-title, .sw-calendar-more").forEach((node) => {
        try {
          node.removeAttribute("title");
        } catch (_) {}
      });
      grid.querySelectorAll(".social-day[data-day-key]").forEach((node) => {
        const dayKey = String(node.getAttribute("data-day-key") || "").trim();
        if (!dayKey || node.dataset.samsungSheetBound === "1") return;
        node.dataset.samsungSheetBound = "1";
        node.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          safeInvoke(window.socialShowDay, dayKey);
        });
      });
    }
    return result;
  });

  wrapFn("socialShowDay", (original) => function wrappedSocialShowDaySamsung(dayKey) {
    if (calendarOwnedByV4()) {
      return original.apply(this, arguments);
    }
    const safeDayKey = String(dayKey || "").trim();
    const result = original.apply(this, arguments);
    if (safeDayKey) {
      forceCalendarSheet(safeDayKey);
    }
    return result;
  });

  wrapFn("socialHideCalendarDaySheet", (original) => function wrappedHideCalendarDaySheetSamsung(force) {
    if (calendarOwnedByV4()) {
      return original.apply(this, arguments);
    }
    const result = original.apply(this, arguments);
    hideLegacyCalendarPanels();
    return result;
  });

  wrapFn("socialShiftCalendar", (original) => function wrappedSocialShiftCalendarSamsung() {
    if (calendarOwnedByV4()) {
      return original.apply(this, arguments);
    }
    if (window.socialState && typeof window.socialState === "object") {
      window.socialState.calendarDaySheetOpen = false;
    }
    safeInvoke(window.socialHideCalendarDaySheet, true);
    const result = original.apply(this, arguments);
    setTimeout(() => {
      ensureCalendarHeader();
      ensureCalendarSwipe();
      hideLegacyCalendarPanels();
    }, 0);
    return result;
  });

  wrapFn("socialRenderNotesList", (original) => function wrappedSocialRenderNotesListSamsung() {
    const result = original.apply(this, arguments);
    normalizeNotesGrid();
    return result;
  });

  window.addEventListener("popstate", () => {
    setTimeout(() => {
      if (calendarOwnedByV4()) {
        normalizeNotesGrid();
        return;
      }
      ensureCalendarHeader();
      ensureCalendarOverlayNodes();
      ensureCalendarSwipe();
      hideLegacyCalendarPanels();
    }, 0);
  });

  setTimeout(() => {
    if (!calendarOwnedByV4()) {
      ensureCalendarHeader();
      ensureCalendarOverlayNodes();
      ensureCalendarSwipe();
      hideLegacyCalendarPanels();
    }
    normalizeNotesGrid();
  }, 0);
})();

(() => {
  if (window.__seoWibeUseTextOverridesCalendarV4 === false) return;
  if (window.__seoWibeSamsungCalendarFinalV4) return;
  window.__seoWibeSamsungCalendarFinalV4 = true;

  const safeInvoke = (fn, ...args) => {
    try {
      if (typeof fn === "function") return fn(...args);
    } catch (_) {}
    return undefined;
  };

  const ensureCalendarVisibleFinal = () => {
    try {
      if (typeof window.showTab === "function") {
        window.showTab("social");
      }
      if (typeof window.switchSocialSubtab !== "function") return;
      const current = String(window.socialState?.currentSubtab || "").trim().toLowerCase();
      if (current !== "calendar") {
        window.switchSocialSubtab("calendar", false);
      }
    } catch (_) {}
  };

  const ensureState = () => {
    window.socialState = window.socialState && typeof window.socialState === "object" ? window.socialState : {};
    if (!Array.isArray(window.socialState.calendarHistoryLayers)) window.socialState.calendarHistoryLayers = [];
    return window.socialState;
  };

  const isAppShell = () => {
    try {
      if (document.body?.classList?.contains("mobile-apk-mode")) return true;
      if (document.body?.classList?.contains("mobile-client-mode")) return true;
      if (typeof window.socialIsAppShellLike === "function") return Boolean(window.socialIsAppShellLike());
      return String(window.location?.pathname || "").trim() === "/mobile" || window.innerWidth <= 980;
    } catch (_) {
      return window.innerWidth <= 980;
    }
  };

  const stripCalendarTitles = (root) => {
    (root || document).querySelectorAll?.(
      "#socialCalendarGrid .social-day[data-day-key], #socialCalendarGrid .sw-calendar-chip, #socialCalendarGrid .sw-calendar-chip-title, #socialCalendarGrid .sw-calendar-more, .sw-day-sheet-card button"
    )?.forEach((node) => {
      try {
        node.removeAttribute("title");
      } catch (_) {}
    });
  };

  const hideLegacyCalendarPanelsFinal = () => {
    if (disableTextBehaviorOverrides) return;
    const root = document.getElementById("socialSubtabCalendar");
    if (!root) return;
    root.dataset.calendarSheetMode = "overlay";
    root.setAttribute("data-calendar-sheet-mode", "overlay");
    [
      root,
      document,
    ].forEach((scope) => {
      if (!scope?.querySelectorAll) return;
      scope.querySelectorAll(
        "#socialCalendarEvents, #socialCalendarEventsLegacy, .social-calendar-events, .social-calendar-selected, .social-calendar-selected-day, .social-calendar-day-header, .social-calendar-day-details, .social-calendar-day-list, .social-calendar-records, .social-calendar-summary, .social-calendar-selected-wrap, .social-calendar-selected-panel, .social-calendar-day-panel, .social-calendar-day-cards, .social-calendar-day-entries, .social-calendar-bottom, .social-calendar-lower, [data-calendar-detail], [data-selected-day]"
      ).forEach((node) => {
        if (!node) return;
        node.hidden = true;
        node.setAttribute("aria-hidden", "true");
        node.style.setProperty("display", "none", "important");
        node.style.setProperty("max-height", "0", "important");
        node.style.setProperty("min-height", "0", "important");
        node.style.setProperty("overflow", "hidden", "important");
        node.style.setProperty("margin", "0", "important");
        node.style.setProperty("padding", "0", "important");
        node.style.setProperty("border", "0", "important");
        node.style.setProperty("box-shadow", "none", "important");
      });
    });
    stripCalendarTitles(root);
  };

  const normalizeCalendarHeaderFinal = () => {
    if (disableTextBehaviorOverrides) return;
    const root = document.getElementById("socialSubtabCalendar");
    if (!root) return;
    const hero = root.querySelector(".social-calendar-hero");
    const heroCopy = root.querySelector(".social-calendar-hero-copy");
    const monthLabel = document.getElementById("socialCalendarMonthLabel");
    const monthInput = document.getElementById("socialCalendarMonth");
    const nav = root.querySelector(".social-calendar-nav-controls");
    if (hero) {
      hero.style.setProperty("display", "grid", "important");
      hero.style.setProperty("grid-template-columns", "1fr", "important");
      hero.style.setProperty("justify-items", "center", "important");
      hero.style.setProperty("align-items", "center", "important");
      hero.style.setProperty("width", "100%", "important");
    }
    if (heroCopy) {
      heroCopy.style.setProperty("display", "grid", "important");
      heroCopy.style.setProperty("place-items", "center", "important");
      heroCopy.style.setProperty("width", "100%", "important");
      heroCopy.style.setProperty("text-align", "center", "important");
    }
    if (monthLabel) {
      monthLabel.style.setProperty("display", "block", "important");
      monthLabel.style.setProperty("width", "100%", "important");
      monthLabel.style.setProperty("text-align", "center", "important");
      monthLabel.style.setProperty("justify-self", "center", "important");
      monthLabel.style.setProperty("margin", "0 auto", "important");
      monthLabel.style.setProperty("cursor", "pointer", "important");
      monthLabel.removeAttribute("title");
      monthLabel.setAttribute("aria-label", typeof window.tr === "function"
        ? window.tr("\u0412\u044b\u0431\u0440\u0430\u0442\u044c \u043c\u0435\u0441\u044f\u0446 \u0438 \u0433\u043e\u0434", "Select month and year")
        : "Select month and year");
      if (monthLabel.dataset.finalMonthPickerBound !== "1") {
        monthLabel.dataset.finalMonthPickerBound = "1";
        monthLabel.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          safeInvoke(window.socialOpenCalendarMonthYearPicker);
        });
      }
    }
    if (monthInput) {
      monthInput.classList.add("hidden");
      monthInput.style.setProperty("display", "none", "important");
    }
    root.querySelectorAll("#socialCalendarMonthSelect, #socialCalendarYearSelect, .social-calendar-picker").forEach((node) => {
      node.classList.add("hidden");
      node.style.setProperty("display", "none", "important");
      node.style.setProperty("visibility", "hidden", "important");
      node.style.setProperty("pointer-events", "none", "important");
    });
    if (nav) {
      nav.classList.toggle("is-app-shell", isAppShell());
      nav.style.setProperty("display", isAppShell() ? "none" : "flex", "important");
      nav.style.setProperty("justify-content", "space-between", "important");
      nav.style.setProperty("align-items", "center", "important");
      nav.style.setProperty("width", "100%", "important");
      nav.querySelectorAll(".social-calendar-picker").forEach((node) => {
        node.style.setProperty("display", "none", "important");
      });
      nav.querySelectorAll(".social-calendar-nav-btn").forEach((btn) => {
        btn.style.setProperty("display", isAppShell() ? "none" : "inline-flex", "important");
        btn.removeAttribute("title");
      });
    }
  };

  const cleanMonthPickerModal = () => {
    const modal = document.getElementById("socialModal");
    const host = document.getElementById("socialModalHost");
    const title = document.getElementById("socialModalTitle");
    if (!modal || modal.classList.contains("hidden") || !host) return;
    if (!host.querySelector(".social-calendar-month-year-modal")) return;
    if (title) {
      title.textContent = typeof window.tr === "function"
        ? window.tr("\u0412\u044b\u0431\u0440\u0430\u0442\u044c \u043c\u0435\u0441\u044f\u0446 \u0438 \u0433\u043e\u0434", "Select month and year")
        : "Select month and year";
    }
    host.querySelectorAll("label > span").forEach((node, index) => {
      node.textContent = index === 0
        ? (typeof window.tr === "function" ? window.tr("\u041c\u0435\u0441\u044f\u0446", "Month") : "Month")
        : (typeof window.tr === "function" ? window.tr("\u0413\u043e\u0434", "Year") : "Year");
    });
    host.querySelectorAll(".actions button").forEach((btn, index) => {
      btn.textContent = index === 0
        ? (typeof window.tr === "function" ? window.tr("\u041e\u0442\u043c\u0435\u043d\u0430", "Cancel") : "Cancel")
        : (typeof window.tr === "function" ? window.tr("\u041f\u0440\u0438\u043c\u0435\u043d\u0438\u0442\u044c", "Apply") : "Apply");
      btn.removeAttribute("title");
    });
  };

  const ensureCalendarOverlayNodesFinal = () => {
    const backdrop = document.getElementById("socialCalendarDaySheetBackdrop");
    const sheet = document.getElementById("socialCalendarDaySheet");
    if (backdrop && backdrop.parentElement !== document.body) document.body.appendChild(backdrop);
    if (sheet && sheet.parentElement !== document.body) document.body.appendChild(sheet);
  };

  const reopenDaySheetFinal = (dayKey = "") => {
    const safeDayKey = String(dayKey || window.socialState?.calendarSelectedDay || "").trim();
    if (!safeDayKey) return;
    ensureCalendarVisibleFinal();
    safeInvoke(window.socialHideCalendarLegacyDetails);
    ensureCalendarOverlayNodesFinal();
    safeInvoke(window.socialForceOpenCalendarDaySheet, safeDayKey);
    setTimeout(hideLegacyCalendarPanelsFinal, 0);
    setTimeout(hideLegacyCalendarPanelsFinal, 60);
    setTimeout(hideLegacyCalendarPanelsFinal, 180);
  };

  const bindCalendarDayClicksFinal = () => {
    const grid = document.getElementById("socialCalendarGrid");
    if (!grid || grid.dataset.finalDayClickBound === "1") return;
    grid.dataset.finalDayClickBound = "1";
    grid.addEventListener("click", (event) => {
      const dayNode = event.target?.closest?.(".social-day[data-day-key]");
      if (!dayNode) return;
      const dayKey = String(dayNode.getAttribute("data-day-key") || "").trim();
      if (!dayKey) return;
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
      safeInvoke(window.socialShowDay, dayKey);
      setTimeout(() => reopenDaySheetFinal(dayKey), 0);
    }, true);
  };

  const bindCalendarBackGestureFinal = () => {
    if (!isAppShell()) return;
    const hasCalendarFlow = () => {
      const state = ensureState();
      const daySheet = document.getElementById("socialCalendarDaySheet");
      const modal = document.getElementById("socialModal");
      return Boolean(
        state.calendarHistoryLayers?.length
        || (daySheet && !daySheet.classList.contains("hidden"))
        || (modal && !modal.classList.contains("hidden"))
      );
    };
    const isOverlayTarget = (target) => Boolean(
      target?.closest?.(
        "#socialCalendarDaySheet, #socialCalendarDaySheetBackdrop, #socialModal, #socialModalHost, .sw-day-sheet-card, .social-calendar-record-detail, .social-calendar-month-year-modal"
      )
    );
    const isInteractiveField = (target) => Boolean(
      target?.closest?.("input, textarea, select, option, [contenteditable='true']")
    );
    const resolveTouch = (event) => event?.changedTouches?.[0] || event?.touches?.[0] || null;
    let catcher = document.getElementById("socialCalendarBackSwipeCatcherV4");
    if (!catcher) {
      catcher = document.createElement("div");
      catcher.id = "socialCalendarBackSwipeCatcherV4";
      catcher.setAttribute("aria-hidden", "true");
      catcher.style.setProperty("position", "fixed", "important");
      catcher.style.setProperty("left", "0", "important");
      catcher.style.setProperty("top", "0", "important");
      catcher.style.setProperty("bottom", "0", "important");
      catcher.style.setProperty("width", "40px", "important");
      catcher.style.setProperty("z-index", "2147483500", "important");
      catcher.style.setProperty("background", "transparent", "important");
      catcher.style.setProperty("touch-action", "none", "important");
      catcher.style.setProperty("pointer-events", "none", "important");
      catcher.style.setProperty("display", "none", "important");
      document.body.appendChild(catcher);
    }
    const updateCatcher = () => {
      const visible = hasCalendarFlow();
      catcher.style.setProperty("display", visible ? "block" : "none", "important");
      catcher.style.setProperty("pointer-events", visible ? "auto" : "none", "important");
    };
    window.socialCalendarUpdateBackSwipeCatcherV4 = updateCatcher;
    updateCatcher();
    if (document.body.dataset.calendarEdgeBackBoundV4 === "1") return;
    document.body.dataset.calendarEdgeBackBoundV4 = "1";
    let startX = 0;
    let startY = 0;
    let active = false;
    let intercept = false;
    const beginSwipe = (event) => {
      const touch = resolveTouch(event);
      if (!touch || !hasCalendarFlow()) return;
      const edgeStart = Number(touch.clientX || 0) <= 42;
      const overlayStart = isOverlayTarget(event.target);
      if ((!edgeStart && !overlayStart) || isInteractiveField(event.target)) return;
      startX = Number(touch.clientX || 0);
      startY = Number(touch.clientY || 0);
      active = true;
      intercept = true;
      event.stopPropagation();
    };
    const moveSwipe = (event) => {
      if (!active || !intercept) return;
      const touch = resolveTouch(event);
      if (!touch) return;
      const dx = Number(touch.clientX || 0) - startX;
      const dy = Number(touch.clientY || 0) - startY;
      if (Math.abs(dx) >= Math.abs(dy)) {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
      }
    };
    const finishSwipe = (event) => {
      const touch = resolveTouch(event);
      const dx = touch ? Number(touch.clientX || 0) - startX : 0;
      const dy = touch ? Number(touch.clientY || 0) - startY : 0;
      const shouldBack = active && intercept && touch && dx >= 62 && dx > Math.abs(dy) + 10;
      active = false;
      intercept = false;
      if (!shouldBack) {
        updateCatcher();
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
      safeInvoke(window.socialCalendarBackLayer);
      setTimeout(updateCatcher, 0);
    };
    document.addEventListener("touchstart", beginSwipe, { passive: false, capture: true });
    document.addEventListener("touchmove", moveSwipe, { passive: false, capture: true });
    document.addEventListener("touchend", finishSwipe, { passive: false, capture: true });
    document.addEventListener("touchcancel", () => {
      active = false;
      intercept = false;
      updateCatcher();
    }, { passive: true, capture: true });
  };

  const refreshCalendarUiFinal = () => {
    normalizeCalendarHeaderFinal();
    hideLegacyCalendarPanelsFinal();
    ensureCalendarOverlayNodesFinal();
    bindCalendarDayClicksFinal();
    bindCalendarBackGestureFinal();
    safeInvoke(window.socialCalendarUpdateBackSwipeCatcherV4);
    cleanMonthPickerModal();
    if (!document.querySelectorAll("#socialCalendarGrid .social-day[data-day-key]").length) {
      setTimeout(() => {
        if (!document.querySelectorAll("#socialCalendarGrid .social-day[data-day-key]").length) {
          safeInvoke(window.socialRenderCalendar);
          normalizeCalendarHeaderFinal();
          hideLegacyCalendarPanelsFinal();
        }
      }, 120);
    }
  };

  const patchBackLayerFinal = () => {
    if (disableInteractiveRuntimeOverrides || shouldSkipBehaviorOverride("socialCalendarBackLayer")) return;
    const original = typeof window.socialCalendarBackLayer === "function"
      ? window.socialCalendarBackLayer
      : null;
    if (!original || original.__calendarFinalBackPatchedV4 === "1") return;
    window.socialCalendarBackLayer = function socialCalendarBackLayerFinalV4() {
      ensureCalendarVisibleFinal();
      if (!isAppShell()) return original.apply(this, arguments);
      const state = ensureState();
      const stack = Array.isArray(state.calendarHistoryLayers) ? state.calendarHistoryLayers : [];
      if (!stack.length) {
        safeInvoke(window.socialCloseModal, { force: true });
        safeInvoke(window.socialHideCalendarDaySheet, true);
        ensureCalendarVisibleFinal();
        refreshCalendarUiFinal();
        return;
      }
      stack.pop();
      const previous = stack.length ? stack[stack.length - 1] : null;
      safeInvoke(window.socialCloseModal, { force: true });
      safeInvoke(window.socialHideCalendarDaySheet, true);
      if (previous) {
        ensureCalendarVisibleFinal();
        safeInvoke(window.socialCalendarRestoreHistoryLayer, previous);
      } else {
        ensureCalendarVisibleFinal();
      }
      setTimeout(refreshCalendarUiFinal, 0);
    };
    window.socialCalendarBackLayer.__calendarFinalBackPatchedV4 = "1";
  };

  const wrap = (name, make) => {
    if (shouldSkipBehaviorOverride(name)) return;
    const original = typeof window[name] === "function" ? window[name] : null;
    if (!original || original.__calendarFinalWrappedV4 === "1") return;
    const wrapped = make(original);
    if (typeof wrapped === "function") wrapped.__calendarFinalWrappedV4 = "1";
    window[name] = wrapped;
  };

  patchBackLayerFinal();

  wrap("socialLoadCalendar", (original) => async function patchedSocialLoadCalendarFinalV4() {
    const result = await Promise.resolve(original.apply(this, arguments));
    refreshCalendarUiFinal();
    if (isAppShell()) safeInvoke(window.socialBindCalendarSwipe);
    return result;
  });

  wrap("socialRenderCalendar", (original) => function patchedSocialRenderCalendarFinalV4() {
    const result = original.apply(this, arguments);
    refreshCalendarUiFinal();
    return result;
  });

  wrap("socialShiftCalendar", (original) => function patchedSocialShiftCalendarFinalV4() {
    const state = ensureState();
    const now = Date.now();
    if (now - Number(state.calendarFinalShiftAtV4 || 0) < 260) return undefined;
    state.calendarFinalShiftAtV4 = now;
    state.calendarDaySheetOpen = false;
    safeInvoke(window.socialHideCalendarDaySheet, true);
    const result = original.apply(this, arguments);
    setTimeout(refreshCalendarUiFinal, 0);
    setTimeout(refreshCalendarUiFinal, 120);
    return result;
  });

  wrap("socialShowDay", (original) => function patchedSocialShowDayFinalV4(dayKey) {
    const safeDayKey = String(dayKey || "").trim();
    ensureCalendarVisibleFinal();
    const result = original.apply(this, arguments);
    if (safeDayKey) reopenDaySheetFinal(safeDayKey);
    else hideLegacyCalendarPanelsFinal();
    return result;
  });

  wrap("socialOpenCalendarMonthYearPicker", (original) => function patchedSocialOpenCalendarMonthYearPickerFinalV4() {
    ensureCalendarVisibleFinal();
    safeInvoke(window.socialHideCalendarDaySheet, true);
    const result = original.apply(this, arguments);
    setTimeout(cleanMonthPickerModal, 0);
    return result;
  });

  wrap("socialOpenCalendarRecordDetail", (original) => function patchedSocialOpenCalendarRecordDetailFinalV4() {
    ensureCalendarVisibleFinal();
    return original.apply(this, arguments);
  });

  wrap("socialOpenCalendarModal", (original) => async function patchedSocialOpenCalendarModalFinalV4() {
    ensureCalendarVisibleFinal();
    return Promise.resolve(original.apply(this, arguments));
  });

  window.addEventListener("popstate", () => {
    setTimeout(() => {
      ensureCalendarVisibleFinal();
      refreshCalendarUiFinal();
    }, 0);
  });

  window.socialSamsungCalendarRefreshFinal = refreshCalendarUiFinal;
  setTimeout(refreshCalendarUiFinal, 0);
})();

(() => {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.__seoWibeUiHotfix20260328D) return;
  window.__seoWibeUiHotfix20260328D = true;

  const safeInvoke = (fn, ...args) => {
    try {
      if (typeof fn === "function") return fn(...args);
    } catch (_) {}
    return undefined;
  };

  const loc = (ru, en) => {
    try {
      if (typeof window.tr === "function") return window.tr(ru, en);
    } catch (_) {}
    const lang = String(window.currentLang || document.documentElement?.lang || navigator.language || "ru").toLowerCase();
    return lang.startsWith("en") ? en : ru;
  };

  const decodeText = (value) => {
    let text = String(value ?? "");
    if (!text) return "";
    try {
      if (typeof window.socialDecodeUiText === "function") {
        text = String(window.socialDecodeUiText(text) || text);
      }
    } catch (_) {}
    return text
      .replace(/\u00a0/g, " ")
      .replace(/\s+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  };

  const escapeAttr = (value) => String(value ?? "").replace(/"/g, "&quot;");

  const isAppShell = () => {
    try {
      return Boolean(
        document.body?.classList?.contains("mobile-apk-mode")
        || document.body?.classList?.contains("mobile-client-mode")
        || typeof window.socialIsAppShellLike === "function" && window.socialIsAppShellLike()
        || typeof window.socialIsMobileClientShell === "function" && window.socialIsMobileClientShell()
        || typeof window.socialIsMobileApkShell === "function" && window.socialIsMobileApkShell()
        || String(window.location?.pathname || "").trim() === "/mobile"
        || window.innerWidth <= 980
      );
    } catch (_) {
      return window.innerWidth <= 980;
    }
  };

  const ensureState = () => {
    window.socialState = window.socialState && typeof window.socialState === "object" ? window.socialState : {};
    if (!Array.isArray(window.socialState.calendarHistoryLayers)) window.socialState.calendarHistoryLayers = [];
    if (!Array.isArray(window.socialState.calendarBrowserLayersHotfix)) window.socialState.calendarBrowserLayersHotfix = [];
    return window.socialState;
  };

  const ensureBrowserLayers = () => ensureState().calendarBrowserLayersHotfix;

  const ensureSocialTabVisible = () => {
    try {
      if (typeof window.showTab === "function") window.showTab("social");
    } catch (_) {}
  };

  const ensureSocialCalendarVisible = () => {
    ensureSocialTabVisible();
    try {
      const current = String(window.socialState?.currentSubtab || "").trim().toLowerCase();
      if (current !== "calendar" && typeof window.switchSocialSubtab === "function") {
        window.switchSocialSubtab("calendar", false);
      }
    } catch (_) {}
  };

  const hasCalendarFlow = () => {
    const state = ensureState();
    if (!isAppShell()) return false;
    if (Array.isArray(state.calendarHistoryLayers) && state.calendarHistoryLayers.length > 0) return true;
    if (Array.isArray(state.calendarBrowserLayersHotfix) && state.calendarBrowserLayersHotfix.length > 0) return true;
    if (state.calendarDaySheetOpen) return true;
    const sheet = document.getElementById("socialCalendarDaySheet");
    if (sheet && !sheet.classList.contains("hidden")) return true;
    const modal = document.getElementById("socialModal");
    return Boolean(modal && !modal.classList.contains("hidden") && String(state.currentSubtab || "").trim().toLowerCase() === "calendar");
  };

  const hideLegacyCalendarPanels = () => {
    const root = document.getElementById("socialSubtabCalendar");
    if (!root) return;
    root.dataset.calendarSheetMode = "overlay";
    [
      "#socialCalendarEvents",
      "#socialCalendarSelectedDay",
      ".social-calendar-selected",
      ".social-calendar-selected-day",
      ".social-calendar-day-details",
      ".social-calendar-day-panel",
      ".social-calendar-day-summary",
      ".social-calendar-summary",
      ".social-calendar-details",
      ".social-calendar-events-panel",
      ".social-calendar-bottom",
      ".social-calendar-day-footer"
    ].forEach((selector) => {
      root.querySelectorAll(selector).forEach((node) => {
        if (node.id === "socialCalendarGrid") return;
        node.style.setProperty("display", "none", "important");
        node.style.setProperty("max-height", "0", "important");
        node.style.setProperty("min-height", "0", "important");
        node.style.setProperty("overflow", "hidden", "important");
        node.style.setProperty("margin", "0", "important");
        node.style.setProperty("padding", "0", "important");
      });
    });
  };

  const normalizeCalendarHeader = () => {
    const root = document.getElementById("socialSubtabCalendar");
    if (!root) return;
    const monthLabel = document.getElementById("socialCalendarMonthLabel");
    if (monthLabel) {
      monthLabel.style.setProperty("display", "block", "important");
      monthLabel.style.setProperty("width", "100%", "important");
      monthLabel.style.setProperty("margin", "0 auto", "important");
      monthLabel.style.setProperty("text-align", "center", "important");
      monthLabel.style.setProperty("justify-self", "center", "important");
      monthLabel.style.setProperty("align-self", "center", "important");
      monthLabel.style.setProperty("cursor", "pointer", "important");
      monthLabel.style.setProperty("left", "0", "important");
      monthLabel.style.setProperty("right", "0", "important");
      if (monthLabel.dataset.monthPickerHotfix !== "1") {
        monthLabel.dataset.monthPickerHotfix = "1";
        monthLabel.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          safeInvoke(window.socialOpenCalendarMonthYearPicker);
        });
      }
    }
    root.querySelectorAll("#socialCalendarMonth, #socialCalendarMonthSelect, #socialCalendarYearSelect, .social-calendar-picker").forEach((node) => {
      node.classList.add("hidden");
      node.style.setProperty("display", "none", "important");
      node.style.setProperty("visibility", "hidden", "important");
      node.style.setProperty("pointer-events", "none", "important");
    });
    if (isAppShell()) {
      root.querySelectorAll(".social-calendar-nav-btn, .social-calendar-nav-controls").forEach((node) => {
        node.style.setProperty("display", "none", "important");
      });
    }
  };

  const refreshCalendarUi = () => {
    safeInvoke(window.socialSamsungCalendarRefreshFinal);
    normalizeCalendarHeader();
    hideLegacyCalendarPanels();
    safeInvoke(window.socialCalendarUpdateBackSwipeCatcherV4);
  };

  const noteCardBackground = (rawColor) => {
    const cover = String(rawColor || "#eaf2ff").trim() || "#eaf2ff";
    return `linear-gradient(180deg, color-mix(in srgb, ${cover} 58%, #ffffff), color-mix(in srgb, ${cover} 26%, #ffffff))`;
  };

  const paintNoteColorSwatches = (scope = document) => {
    if (!scope || typeof scope.querySelectorAll !== "function") return;
    scope.querySelectorAll(".sw-note-color").forEach((node) => {
      const computed = typeof window.getComputedStyle === "function" ? window.getComputedStyle(node) : null;
      const color = String(
        node.getAttribute("data-note-color")
        || node.dataset.noteColor
        || node.style.getPropertyValue("--sw-note-cover")
        || computed?.getPropertyValue("--sw-note-cover")
        || computed?.backgroundColor
        || ""
      ).trim();
      if (!color) return;
      node.style.setProperty("--sw-note-cover", color);
      node.style.setProperty("background", color, "important");
      node.style.setProperty("background-color", color, "important");
      node.style.setProperty("background-image", "none", "important");
      node.style.setProperty("border-color", "rgba(127, 151, 188, 0.35)", "important");
      node.style.setProperty("opacity", "1", "important");
      node.style.setProperty("color", "transparent", "important");
      node.textContent = "";
    });
  };

  const ensureNotesFab = () => {
    let fab = document.getElementById("socialNotesFab");
    if (!fab) {
      fab = document.createElement("button");
      fab.id = "socialNotesFab";
      fab.type = "button";
      fab.className = "social-notes-fab";
      fab.innerHTML = '<span aria-hidden="true">+</span>';
      fab.setAttribute("aria-label", loc("\u041d\u043e\u0432\u0430\u044f \u0437\u0430\u043c\u0435\u0442\u043a\u0430", "New note"));
      document.body.appendChild(fab);
      fab.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (typeof window.socialCreateNote === "function") {
          await Promise.resolve(window.socialCreateNote());
        }
      });
    }
    fab.innerHTML = '<span aria-hidden="true">+</span>';
    fab.removeAttribute("title");
    fab.style.setProperty("display", "grid", "important");
    fab.style.setProperty("place-items", "center", "important");
    return fab;
  };

  const normalizeNotesHotfix = () => {
    const root = document.getElementById("socialSubtabNotes");
    if (!root) return;
    const isCreateButton = (text) => {
      const normalized = decodeText(text || "").trim().toLowerCase();
      return normalized.includes("создать запись")
        || normalized.includes("создать заметку")
        || normalized.includes("create note")
        || normalized.includes("new note");
    };
    root.querySelectorAll("button").forEach((node) => {
      if (!node || node.id === "socialNotesFab" || node.classList?.contains("social-note-main")) return;
      if (isCreateButton(node.textContent || "") || isCreateButton(node.getAttribute("aria-label") || "") || isCreateButton(node.getAttribute("title") || "")) {
        node.remove?.();
      }
    });
    root.querySelectorAll(
      ".social-notes-sidebar > button, .social-notes-sidebar > .btn-secondary, #socialNotesCreateBtn, .social-note-create, [data-action='create-note'], button[onclick*='socialCreateNote']"
    ).forEach((node) => node.remove?.());
    ensureNotesFab();
    const list = document.getElementById("socialNotesList");
    if (list) {
      list.style.setProperty("margin-top", "16px", "important");
      list.style.setProperty("padding-top", "4px", "important");
      list.style.setProperty("padding-bottom", "92px", "important");
      list.querySelectorAll(".social-note-row, .sw-note-card").forEach((node) => {
        const noteId = Number(node.getAttribute("data-note-id") || 0);
        const cover = typeof window.socialGetNoteCoverColor === "function"
          ? String(window.socialGetNoteCoverColor(noteId) || "").trim()
          : "";
        const fill = cover || "#eaf2ff";
        node.style.setProperty("--sw-note-cover", fill);
        node.style.setProperty("--sw-note-card-fill", noteCardBackground(fill));
        node.style.setProperty("background", noteCardBackground(fill), "important");
        node.style.setProperty("background-color", fill, "important");
        node.style.setProperty("background-image", noteCardBackground(fill), "important");
        const main = node.querySelector(".social-note-main");
        if (main) {
          main.style.setProperty("background", "transparent", "important");
          main.style.setProperty("background-color", "transparent", "important");
          main.style.setProperty("background-image", "none", "important");
        }
      });
    }
    paintNoteColorSwatches(root);
    paintNoteColorSwatches(document.getElementById("socialModalHost") || document);
  };

  const isDoneTaskItem = (item) => {
    if (!item) return false;
    if (item.classList?.contains("is-done")) return true;
    if (item.dataset.taskDone === "1") return true;
    const check = item.querySelector(".social-task-check");
    return Boolean(check?.classList?.contains("is-done"));
  };

  const normalizeTasksHotfix = () => {
    const host = document.getElementById("socialTasksBoard");
    if (!host) return;
    const includeDone = Boolean(document.getElementById("socialTaskIncludeDone")?.checked);
    host.querySelectorAll(".social-task-check").forEach((node) => {
      const done = node.classList.contains("is-done") || node.closest(".social-task-item")?.classList?.contains("is-done");
      node.textContent = done ? "\u2713" : "";
      node.setAttribute("title", loc("\u041e\u0442\u043c\u0435\u0442\u0438\u0442\u044c \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043d\u043e\u0439", "Mark done"));
      node.style.setProperty("display", "grid", "important");
      node.style.setProperty("place-items", "center", "important");
    });
    host.querySelectorAll(".social-task-delete").forEach((node) => {
      node.textContent = "\u00d7";
      node.setAttribute("title", loc("\u0423\u0434\u0430\u043b\u0438\u0442\u044c", "Delete"));
      node.style.setProperty("display", "grid", "important");
      node.style.setProperty("place-items", "center", "important");
    });
    host.querySelectorAll(".social-task-item").forEach((item) => {
      const assigneeLine = item.querySelector(".social-task-assignee-line");
      const assigneeName = item.querySelector(".social-task-assignee-name");
      if (assigneeLine && !assigneeLine.querySelector(".social-task-assignee")) {
        const name = loc("\u0411\u0435\u0437 \u0438\u0441\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u044f", "No assignee");
        assigneeLine.innerHTML = `
          <div class="social-task-assignee" title="${escapeAttr(name)}">
            <span class="social-task-assignee-avatar">${typeof window.socialAvatarMarkup === "function" ? window.socialAvatarMarkup("", name, "xs") : ""}</span>
            <span class="social-task-assignee-name">${name}</span>
          </div>
        `;
      } else if (assigneeName && !String(assigneeName.textContent || "").trim()) {
        assigneeName.textContent = loc("\u0411\u0435\u0437 \u0438\u0441\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u044f", "No assignee");
      }
      if (!includeDone && isDoneTaskItem(item)) {
        item.style.setProperty("display", "none", "important");
      } else {
        item.style.removeProperty("display");
      }
    });
    host.querySelectorAll(".social-task-bucket").forEach((bucket) => {
      const key = String(bucket.getAttribute("data-bucket") || "").trim().toLowerCase();
      const visible = [...bucket.querySelectorAll(".social-task-item")].filter((item) => getComputedStyle(item).display !== "none");
      const count = bucket.querySelector("header span");
      if (count) count.textContent = String(visible.length);
      if (!includeDone && (key === "done" || key === "completed" || key === "closed")) {
        bucket.style.setProperty("display", "none", "important");
      } else {
        bucket.style.removeProperty("display");
      }
    });
  };

  const normalizeNotificationCenterHotfix = () => {
    const center = document.getElementById("socialNotificationCenter");
    if (!center) return;
    center.querySelectorAll(".social-notif-item-head b, .social-notif-item p").forEach((node) => {
      const text = decodeText(node.textContent || "");
      if (text) node.textContent = text;
    });
    const buttons = center.querySelectorAll(".social-notif-head-actions > button, .social-notif-head-actions > .btn-secondary");
    if (buttons[1]) {
      buttons[1].textContent = "\u00d7";
      buttons[1].style.setProperty("display", "grid", "important");
      buttons[1].style.setProperty("place-items", "center", "important");
    }
  };

  const stripAppActionTitles = () => {
    if (!isAppShell()) return;
    document.querySelectorAll(
      "#socialCalendarFab, #socialNotesFab, #socialBellBtn, #mobileDrawerBellBtn, #socialNotificationCenter .social-notif-head-actions > button, #socialCalendarDaySheet .social-calendar-fab-mini, #socialCalendarDaySheet .sw-day-sheet-close"
    ).forEach((node) => {
      node?.removeAttribute?.("title");
    });
  };

  const bindBellButtonsLite = () => {
    if (disableTextBehaviorOverrides) {
      return;
    }
    ["socialBellBtn", "mobileDrawerBellBtn"].forEach((id) => {
      const btn = document.getElementById(id);
      if (!btn || btn.dataset.uiHotfixBellLite === "1") return;
      btn.dataset.uiHotfixBellLite = "1";
      btn.removeAttribute("onclick");
      try { btn.onclick = null; } catch (_) {}
      btn.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
        const shouldOpen = !Boolean(window.socialState?.notificationCenterOpen);
        if (id === "mobileDrawerBellBtn" && typeof window.closeMobileNav === "function") {
          try { window.closeMobileNav(); } catch (_) {}
          await new Promise((resolve) => window.setTimeout(resolve, 40));
        }
        if (typeof window.socialToggleNotificationCenter === "function") {
          await window.socialToggleNotificationCenter(shouldOpen);
        }
        setTimeout(normalizeNotificationCenterHotfix, 0);
      }, true);
    });
    window.socialBindBellButtonsNow = bindBellButtonsLite;
  };

  wrap("socialToggleNotificationCenter", (original) => async function wrappedToggleNotificationCenterHotfix() {
    const result = await Promise.resolve(original.apply(this, arguments));
    setTimeout(async () => {
      const center = document.getElementById("socialNotificationCenter");
      if (!center) return;
      const visible = !center.classList.contains("hidden") && center.style.display !== "none";
      if (!visible) return;
      const hasItems = Boolean(center.querySelector(".social-notif-item"));
      if (!hasItems && typeof window.socialLoadNotificationCenterRows === "function" && typeof window.socialRenderNotificationCenter === "function") {
        const rows = await Promise.resolve(window.socialLoadNotificationCenterRows()).catch(() => null);
        window.socialRenderNotificationCenter(rows);
      }
      normalizeNotificationCenterHotfix();
    }, 0);
    return result;
  });

  wrap("socialRenderNotificationCenter", (original) => function wrappedRenderNotificationCenterHotfix() {
    const result = original.apply(this, arguments);
    setTimeout(normalizeNotificationCenterHotfix, 0);
    return result;
  });

  wrap("switchSocialSubtab", (original) => function wrappedSwitchSocialSubtabHotfix() {
    const result = original.apply(this, arguments);
    setTimeout(refreshAllLiteHotfix, 0);
    return result;
  });

  wrap("showTab", (original) => function wrappedShowTabHotfix() {
    const result = original.apply(this, arguments);
    setTimeout(refreshAllLiteHotfix, 0);
    return result;
  });

  const refreshAllLiteHotfix = () => {
    stripAppActionTitles();
    normalizeNotesHotfix();
    normalizeTasksHotfix();
    paintNoteColorSwatches(document);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", refreshAllLiteHotfix, { once: true });
  } else {
    refreshAllLiteHotfix();
  }

  window.addEventListener("resize", refreshAllLiteHotfix);
  setTimeout(refreshAllLiteHotfix, 120);
  setTimeout(refreshAllLiteHotfix, 600);
  return;

  const rebindBellButtonsHotfix = () => {
    if (disableTextBehaviorOverrides) {
      return;
    }
    ["socialBellBtn", "mobileDrawerBellBtn"].forEach((id) => {
      const btn = document.getElementById(id);
      if (!btn || btn.dataset.uiHotfixBellBind === "1") return;
      btn.dataset.uiHotfixBellBind = "1";
      btn.removeAttribute("onclick");
      try { btn.onclick = null; } catch (_) {}
      btn.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
        const shouldOpen = !Boolean(window.socialState?.notificationCenterOpen);
        if (id === "mobileDrawerBellBtn" && typeof window.closeMobileNav === "function") {
          try { window.closeMobileNav(); } catch (_) {}
          await new Promise((resolve) => window.setTimeout(resolve, 40));
        }
        if (typeof window.socialToggleNotificationCenter === "function") {
          await window.socialToggleNotificationCenter(shouldOpen);
        }
        setTimeout(normalizeNotificationCenterHotfix, 0);
      }, true);
    });
    window.socialBindBellButtonsNow = rebindBellButtonsHotfix;
  };

  const pushBrowserLayer = (layer, payload = {}) => {
    if (!isAppShell()) return;
    ensureBrowserLayers().push({ layer, payload });
    try {
      window.history?.pushState?.({
        ...(window.history?.state && typeof window.history.state === "object" ? window.history.state : {}),
        seoWibeCalendarFlow: true,
        seoWibeCalendarLayer: layer,
        seoWibeCalendarStamp: Date.now(),
      }, document.title);
    } catch (_) {}
  };

  const performCalendarBack = () => {
    ensureSocialCalendarVisible();
    if (isAppShell() && ensureBrowserLayers().length > 0) {
      try {
        window.history?.back?.();
        return true;
      } catch (_) {}
    }
    safeInvoke(window.socialCalendarBackLayer);
    return true;
  };

  const bindCalendarBackGestureHotfix = () => {
    if (disableTextBehaviorOverrides) return;
    if (document.body?.dataset.calendarBackGestureHotfix20260328 !== "1") {
      document.body.dataset.calendarBackGestureHotfix20260328 = "1";
      let active = false;
      let startX = 0;
      let startY = 0;
      const start = (event) => {
        if (!isAppShell() || !hasCalendarFlow()) return;
        const point = event.touches?.[0] || event;
        const x = Number(point?.clientX || 0);
        const y = Number(point?.clientY || 0);
        if (x > 28) return;
        active = true;
        startX = x;
        startY = y;
      };
      const move = (event) => {
        if (!active) return;
        const point = event.touches?.[0] || event;
        const dx = Number(point?.clientX || 0) - startX;
        const dy = Number(point?.clientY || 0) - startY;
        if (dx > 56 && dx > Math.abs(dy) * 1.15) {
          active = false;
          event.preventDefault?.();
          event.stopPropagation?.();
          performCalendarBack();
        }
      };
      const stop = () => { active = false; };
      document.addEventListener("touchstart", start, true);
      document.addEventListener("touchmove", move, { capture: true, passive: false });
      document.addEventListener("touchend", stop, true);
      document.addEventListener("touchcancel", stop, true);
      document.addEventListener("pointerdown", start, true);
      document.addEventListener("pointermove", move, { capture: true, passive: false });
      document.addEventListener("pointerup", stop, true);
      document.addEventListener("pointercancel", stop, true);
    }
  };

  const wrap = (name, make) => {
    if (shouldSkipBehaviorOverride(name)) return;
    const original = typeof window[name] === "function" ? window[name] : null;
    if (!original || original.__uiHotfix20260328D === "1") return;
    const wrapped = make(original);
    if (typeof wrapped === "function") wrapped.__uiHotfix20260328D = "1";
    window[name] = wrapped;
  };

  window.socialTaskBucketTitle = function socialTaskBucketTitleHotfix(bucket) {
    const key = String(bucket || "upcoming").trim().toLowerCase();
    if (key === "today") return loc("\u0421\u0435\u0433\u043e\u0434\u043d\u044f", "Today");
    if (key === "tomorrow") return loc("\u0417\u0430\u0432\u0442\u0440\u0430", "Tomorrow");
    if (key === "overdue") return loc("\u041f\u0440\u043e\u0441\u0440\u043e\u0447\u0435\u043d\u043d\u044b\u0435", "Overdue");
    if (key === "done") return loc("\u0412\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043d\u044b\u0435", "Done");
    return loc("\u041f\u0440\u0435\u0434\u0441\u0442\u043e\u044f\u0449\u0438\u0435", "Upcoming");
  };

  window.socialTaskAssigneeMeta = function socialTaskAssigneeMetaHotfix(task) {
    const nickRaw = task?.assignee_nick
      || task?.assignee_name
      || task?.assignee?.nick
      || task?.assignee?.name
      || task?.creator_nick
      || task?.creator_name
      || task?.creator?.nick
      || task?.creator?.name
      || task?.assignee_key
      || task?.creator_key
      || "";
    const nick = decodeText(nickRaw) || loc("\u0411\u0435\u0437 \u0438\u0441\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u044f", "No assignee");
    const avatar = String(
      task?.assignee_avatar_url
      || task?.assignee_avatar
      || task?.assignee_image
      || task?.assignee?.avatar_url
      || task?.assignee?.avatar
      || task?.assignee?.image
      || task?.creator_avatar_url
      || task?.creator_avatar
      || task?.creator?.avatar_url
      || task?.creator?.avatar
      || ""
    ).trim();
    return `
      <div class="social-task-assignee" title="${escapeAttr(nick)}">
        <span class="social-task-assignee-avatar">${typeof window.socialAvatarMarkup === "function" ? window.socialAvatarMarkup(avatar, nick, "xs") : ""}</span>
        <span class="social-task-assignee-name">${nick}</span>
      </div>
    `;
  };

  wrap("socialRenderNotificationCenter", (original) => function wrappedRenderNotificationCenterHotfix() {
    const result = original.apply(this, arguments);
    setTimeout(normalizeNotificationCenterHotfix, 0);
    return result;
  });

  wrap("socialLoadNotificationCenterRows", (original) => async function wrappedLoadNotificationCenterRowsHotfix() {
    const result = await Promise.resolve(original.apply(this, arguments));
    setTimeout(normalizeNotificationCenterHotfix, 0);
    return result;
  });

  wrap("socialRenderNotesList", (original) => function wrappedRenderNotesListHotfix() {
    const result = original.apply(this, arguments);
    setTimeout(normalizeNotesHotfix, 0);
    return result;
  });

  wrap("socialOpenNoteEditor", (original) => function wrappedOpenNoteEditorHotfix() {
    const result = original.apply(this, arguments);
    setTimeout(() => {
      normalizeNotesHotfix();
      paintNoteColorSwatches(document.getElementById("socialModalHost") || document);
    }, 0);
    return result;
  });

  wrap("socialPickNoteCoverColor", (original) => function wrappedPickNoteCoverColorHotfix() {
    const result = original.apply(this, arguments);
    setTimeout(() => {
      normalizeNotesHotfix();
      paintNoteColorSwatches(document.getElementById("socialModalHost") || document);
    }, 0);
    return result;
  });

  wrap("socialCreateNote", (original) => async function wrappedCreateNoteHotfix() {
    const result = await Promise.resolve(original.apply(this, arguments));
    setTimeout(normalizeNotesHotfix, 0);
    return result;
  });

  wrap("socialRenderTasks", (original) => function wrappedRenderTasksHotfix() {
    const result = original.apply(this, arguments);
    setTimeout(normalizeTasksHotfix, 0);
    return result;
  });

  wrap("socialLoadCalendar", (original) => async function wrappedLoadCalendarHotfix() {
    const result = await Promise.resolve(original.apply(this, arguments));
    setTimeout(refreshCalendarUi, 0);
    return result;
  });

  wrap("socialRenderCalendar", (original) => function wrappedRenderCalendarHotfix() {
    const result = original.apply(this, arguments);
    setTimeout(refreshCalendarUi, 0);
    return result;
  });

  wrap("socialShiftCalendar", (original) => function wrappedShiftCalendarHotfix() {
    const result = original.apply(this, arguments);
    setTimeout(refreshCalendarUi, 0);
    return result;
  });

  wrap("socialApplyCalendarMonthYearPicker", (original) => function wrappedApplyMonthYearHotfix() {
    const result = original.apply(this, arguments);
    setTimeout(refreshCalendarUi, 0);
    return result;
  });

  wrap("socialOpenCalendarMonthYearPicker", (original) => function wrappedOpenMonthYearHotfix() {
    if (!hasCalendarFlow()) pushBrowserLayer("month-picker", {});
    return original.apply(this, arguments);
  });

  wrap("socialOpenCalendarQuickAddMenu", (original) => function wrappedOpenQuickAddHotfix() {
    if (!hasCalendarFlow()) pushBrowserLayer("quick-add", {});
    return original.apply(this, arguments);
  });

  wrap("socialShowDay", (original) => function wrappedShowDayHotfix(dayKey) {
    ensureSocialCalendarVisible();
    const opts = arguments[1] && typeof arguments[1] === "object" ? arguments[1] : {};
    if (!opts.skipHistory) pushBrowserLayer("day", { dayKey: String(dayKey || "").trim() });
    const result = original.apply(this, arguments);
    setTimeout(refreshCalendarUi, 0);
    setTimeout(hideLegacyCalendarPanels, 60);
    return result;
  });

  wrap("socialOpenCalendarRecordDetail", (original) => function wrappedOpenCalendarRecordDetailHotfix(kind, id, options = {}) {
    ensureSocialCalendarVisible();
    if (!options || !options.skipHistory) {
      pushBrowserLayer("detail", {
        kind: String(kind || "event").trim().toLowerCase(),
        id: Number(id || 0),
        dayKey: String(options?.dayKey || window.socialState?.calendarSelectedDay || "").trim(),
      });
    }
    const result = original.apply(this, arguments);
    setTimeout(refreshCalendarUi, 0);
    return result;
  });

  wrap("socialOpenCalendarModal", (original) => async function wrappedOpenCalendarModalHotfix(eventId = 0, options = {}) {
    const opts = options && typeof options === "object" ? options : {};
    if (!opts.skipHistory && (hasCalendarFlow() || opts.dayKey || opts.returnKind)) {
      pushBrowserLayer("event-edit", {
        eventId: Number(eventId || 0),
        dayKey: String(opts.dayKey || window.socialState?.calendarSelectedDay || "").trim(),
        kind: String(opts.returnKind || "event").trim().toLowerCase(),
        recordId: Number(opts.returnId || 0),
      });
    }
    const result = await Promise.resolve(original.apply(this, arguments));
    setTimeout(refreshCalendarUi, 0);
    return result;
  });

  wrap("socialCalendarBackLayer", (original) => function wrappedCalendarBackLayerHotfix() {
    if (!window.__seoWibeCalendarPopHandling && ensureBrowserLayers().length > 0) {
      ensureBrowserLayers().pop();
    }
    const result = original.apply(this, arguments);
    setTimeout(() => {
      ensureSocialCalendarVisible();
      refreshCalendarUi();
    }, 0);
    return result;
  });

  window.addEventListener("popstate", () => {
    if (!isAppShell()) return;
    if (!hasCalendarFlow() && !ensureBrowserLayers().length) return;
    window.__seoWibeCalendarPopHandling = true;
    if (ensureBrowserLayers().length > 0) ensureBrowserLayers().pop();
    setTimeout(() => {
      ensureSocialCalendarVisible();
      safeInvoke(window.socialCalendarBackLayer);
      refreshCalendarUi();
      window.__seoWibeCalendarPopHandling = false;
    }, 0);
  });

  const refreshAll = () => {
    if (!disableTextBehaviorOverrides) {
      rebindBellButtonsHotfix();
      bindCalendarBackGestureHotfix();
    }
    normalizeNotificationCenterHotfix();
    normalizeNotesHotfix();
    normalizeTasksHotfix();
    paintNoteColorSwatches(document);
    refreshCalendarUi();
    safeInvoke(window.socialSetBell, Number(window.socialState?.unreadCount || 0));
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", refreshAll, { once: true });
  } else {
    refreshAll();
  }

  window.addEventListener("resize", refreshAll);
  setTimeout(refreshAll, 120);
  setTimeout(refreshAll, 600);
  return;

  if (false) {
  if (window.__seoWibeUiHotfix20260327C) return;
  if (window.__seoWibeSamsungCalendarController === "v4") return;
  window.__seoWibeUiHotfix20260327C = true;

  const safeInvoke = (fn, ...args) => {
    try {
      if (typeof fn === "function") return fn(...args);
    } catch (_) {}
    return undefined;
  };

  const loc = (ru, en) => {
    try {
      if (typeof window.tr === "function") return window.tr(ru, en);
    } catch (_) {}
    const lang = String(window.currentLang || document.documentElement?.lang || navigator.language || "ru").toLowerCase();
    return lang.startsWith("en") ? en : ru;
  };

  const isAppShell = () => {
    try {
      return Boolean(
        document.body?.classList?.contains("mobile-apk-mode")
        || document.body?.classList?.contains("mobile-client-mode")
        || typeof window.socialIsAppShellLike === "function" && window.socialIsAppShellLike()
        || typeof window.socialIsMobileClientShell === "function" && window.socialIsMobileClientShell()
        || typeof window.socialIsMobileApkShell === "function" && window.socialIsMobileApkShell()
        || String(window.location?.pathname || "").trim() === "/mobile"
        || window.innerWidth <= 980
      );
    } catch (_) {
      return window.innerWidth <= 980;
    }
  };

  const ensureSocialCalendarVisible = () => {
    try {
      if (typeof window.showTab === "function") window.showTab("social");
    } catch (_) {}
    try {
      if (typeof window.switchSocialSubtab === "function") window.switchSocialSubtab("calendar", false);
    } catch (_) {}
  };

  const hideLegacyCalendarPanels = () => {
    const root = document.getElementById("socialSubtabCalendar");
    if (!root) return;
    root.dataset.calendarSheetMode = "overlay";
    root.setAttribute("data-calendar-sheet-mode", "overlay");
    root.querySelectorAll(
      "#socialCalendarEvents, #socialCalendarEventsLegacy, .social-calendar-events, .social-calendar-selected, .social-calendar-selected-day, .social-calendar-day-header, .social-calendar-day-details, .social-calendar-day-list, .social-calendar-records, .social-calendar-summary, .social-calendar-selected-wrap, .social-calendar-selected-panel, .social-calendar-day-panel, .social-calendar-day-cards, .social-calendar-day-entries, .social-calendar-bottom, .social-calendar-lower, [data-calendar-detail], [data-selected-day]"
    ).forEach((node) => {
      if (!node) return;
      node.hidden = true;
      node.setAttribute("aria-hidden", "true");
      node.style.setProperty("display", "none", "important");
      node.style.setProperty("max-height", "0", "important");
      node.style.setProperty("min-height", "0", "important");
      node.style.setProperty("overflow", "hidden", "important");
      node.style.setProperty("margin", "0", "important");
      node.style.setProperty("padding", "0", "important");
      node.style.setProperty("border", "0", "important");
    });
  };

  const hasCalendarFlow = () => {
    const stack = Array.isArray(window.socialState?.calendarHistoryLayers) ? window.socialState.calendarHistoryLayers : [];
    const daySheet = document.getElementById("socialCalendarDaySheet");
    const modal = document.getElementById("socialModal");
    return Boolean(
      stack.length
      || (daySheet && !daySheet.classList.contains("hidden"))
      || (modal && !modal.classList.contains("hidden"))
    );
  };

  const noteCardBackground = (colorRaw) => {
    const color = String(colorRaw || "").trim() || "#edf4ff";
    return `linear-gradient(180deg, color-mix(in srgb, ${color} 58%, #ffffff), color-mix(in srgb, ${color} 26%, #ffffff))`;
  };

  const paintNoteColorSwatches = (scope = document) => {
    scope.querySelectorAll?.(".sw-note-color").forEach((node) => {
      const color = String(
        node.getAttribute("data-note-color")
        || node.style.getPropertyValue("--sw-note-cover")
        || node.style.backgroundColor
        || ""
      ).trim() || "#edf4ff";
      node.style.setProperty("--sw-note-cover", color);
      node.style.setProperty("background", color, "important");
      node.style.setProperty("background-color", color, "important");
      node.style.setProperty("background-image", "none", "important");
      node.style.setProperty("color", "transparent", "important");
    });
  };

  const normalizeNotesHotfix = () => {
    const root = document.getElementById("socialSubtabNotes");
    const host = document.getElementById("socialNotesList");
    if (!root || !host) return;
    root.style.setProperty("position", "relative", "important");
    host.style.setProperty("margin-top", "18px", "important");
    host.style.setProperty("padding-top", "8px", "important");
    root.querySelectorAll(".social-notes-sidebar > button, button[onclick*='socialCreateNote']").forEach((node) => node.remove?.());
    let fab = document.getElementById("socialNotesFab");
    if (!fab) {
      fab = document.createElement("button");
      fab.id = "socialNotesFab";
      fab.className = "social-notes-fab";
      fab.type = "button";
      fab.innerHTML = "+";
      fab.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        await Promise.resolve(safeInvoke(window.socialCreateNote));
      });
      root.appendChild(fab);
    } else if (fab.parentElement !== root) {
      root.appendChild(fab);
    }
    fab.setAttribute("title", loc("Создать заметку", "Create note"));
    fab.setAttribute("aria-label", loc("Создать заметку", "Create note"));
    host.querySelectorAll(".social-note-row[data-note-id], .sw-note-card[data-note-id]").forEach((row) => {
      const noteId = Number(row.getAttribute("data-note-id") || 0);
      const cover = safeInvoke(window.socialGetNoteCoverColor, noteId) || "#edf4ff";
      row.style.setProperty("--sw-note-cover", String(cover));
      row.style.setProperty("background", noteCardBackground(cover), "important");
      row.style.setProperty("background-color", String(cover), "important");
      row.style.setProperty("background-image", noteCardBackground(cover), "important");
      row.querySelectorAll("button:not(.social-note-main)").forEach((node) => node.remove?.());
      const main = row.querySelector(".social-note-main");
      if (main) {
        main.style.setProperty("background", "transparent", "important");
        main.style.setProperty("background-color", "transparent", "important");
        main.style.setProperty("box-shadow", "none", "important");
      }
    });
    paintNoteColorSwatches(root);
  };

  const normalizeTasksHotfix = () => {
    const host = document.getElementById("socialTasksBoard");
    if (!host) return;
    const includeDone = Boolean(document.getElementById("socialTaskIncludeDone")?.checked);
    host.querySelectorAll(".social-task-check").forEach((btn) => {
      btn.innerHTML = btn.classList.contains("is-done") ? "&#10003;" : "";
      btn.setAttribute("title", loc("Отметить выполненной", "Mark done"));
      btn.setAttribute("aria-label", loc("Отметить выполненной", "Mark done"));
    });
    host.querySelectorAll(".social-task-delete").forEach((btn) => {
      btn.innerHTML = "&times;";
      btn.setAttribute("title", loc("Удалить", "Delete"));
      btn.setAttribute("aria-label", loc("Удалить", "Delete"));
    });
    host.querySelectorAll(".social-task-assignee-name").forEach((node) => {
      const text = String(node.textContent || "").trim();
      if (!text) node.textContent = loc("Без исполнителя", "No assignee");
    });
    host.querySelectorAll(".social-task-item.is-done").forEach((item) => {
      item.style.setProperty("display", includeDone ? "" : "none", "important");
    });
    host.querySelectorAll(".social-task-bucket").forEach((bucket) => {
      const items = [...bucket.querySelectorAll(".social-task-item")].filter((node) => node.style.display !== "none");
      const counter = bucket.querySelector("header span");
      if (counter) counter.textContent = String(items.length);
    });
  };

  const rebindBellButtonsHotfix = () => {
    if (disableTextBehaviorOverrides) {
      return;
    }
    ["socialBellBtn", "mobileDrawerBellBtn"].forEach((id) => {
      const original = document.getElementById(id);
      if (!original || original.dataset.hotfixBellBound === "1") return;
      original.dataset.hotfixBellBound = "1";
      original.removeAttribute("onclick");
      original.removeAttribute("title");
      original.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
        if (id === "mobileDrawerBellBtn" && typeof window.closeMobileNav === "function") {
          safeInvoke(window.closeMobileNav);
          await new Promise((resolve) => window.setTimeout(resolve, 40));
        }
        const center = document.getElementById("socialNotificationCenter");
        const isVisible = Boolean(center && !center.classList.contains("hidden") && center.style.display !== "none");
        if (isVisible) {
          if (window.socialState && typeof window.socialState === "object") window.socialState.notificationCenterOpen = false;
          if (center) {
            center.classList.add("hidden");
            center.style.display = "none";
          }
          return;
        }
        const rows = typeof window.socialLoadNotificationCenterRows === "function"
          ? await Promise.resolve(window.socialLoadNotificationCenterRows())
          : null;
        const rendered = typeof window.socialRenderNotificationCenter === "function"
          ? window.socialRenderNotificationCenter(rows)
          : document.getElementById("socialNotificationCenter");
        const activeCenter = rendered || document.getElementById("socialNotificationCenter");
        if (window.socialState && typeof window.socialState === "object") window.socialState.notificationCenterOpen = true;
        if (activeCenter) {
          activeCenter.classList.remove("hidden");
          activeCenter.style.display = "flex";
          safeInvoke(window.socialEnsureNotificationCenterLayout, activeCenter);
        }
      }, true);
    });
  };

  const bindCalendarBackGestureHotfix = () => {
    if (disableTextBehaviorOverrides) return;
    if (!isAppShell()) return;
    if (document.body?.dataset?.calendarDocBackHotfix === "1") return;
    if (!document.body?.dataset) return;
    document.body.dataset.calendarDocBackHotfix = "1";
    let startX = 0;
    let startY = 0;
    let active = false;
    const start = (event) => {
      const touch = event.changedTouches?.[0];
      if (!touch || !hasCalendarFlow()) return;
      if (Number(touch.clientX || 0) > 42) return;
      startX = Number(touch.clientX || 0);
      startY = Number(touch.clientY || 0);
      active = true;
      event.stopPropagation();
    };
    const move = (event) => {
      if (!active) return;
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
    };
    const finish = (event) => {
      if (!active) return;
      const touch = event.changedTouches?.[0];
      active = false;
      if (!touch) return;
      const dx = Number(touch.clientX || 0) - startX;
      const dy = Number(touch.clientY || 0) - startY;
      if (dx < 56 || dx <= Math.abs(dy)) return;
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
      ensureSocialCalendarVisible();
      safeInvoke(window.socialCalendarBackLayer);
      setTimeout(() => {
        ensureSocialCalendarVisible();
        hideLegacyCalendarPanels();
      }, 0);
    };
    document.addEventListener("touchstart", start, true);
    document.addEventListener("touchmove", move, true);
    document.addEventListener("touchend", finish, true);
    document.addEventListener("touchcancel", () => { active = false; }, true);
  };

  const wrap = (name, make) => {
    if (shouldSkipBehaviorOverride(name)) return;
    const original = typeof window[name] === "function" ? window[name] : null;
    if (!original || original.__uiHotfix20260327C === "1") return;
    const wrapped = make(original);
    if (typeof wrapped === "function") wrapped.__uiHotfix20260327C = "1";
    window[name] = wrapped;
  };

  window.socialTaskBucketTitle = function socialTaskBucketTitleHotfix(bucket) {
    const key = String(bucket || "upcoming").trim().toLowerCase();
    if (key === "today") return loc("Сегодня", "Today");
    if (key === "tomorrow") return loc("Завтра", "Tomorrow");
    if (key === "overdue") return loc("Просроченные", "Overdue");
    if (key === "done") return loc("Выполненные", "Done");
    return loc("Предстоящие", "Upcoming");
  };

  window.socialTaskAssigneeMeta = function socialTaskAssigneeMetaHotfix(task) {
    const nickRaw = task?.assignee_nick
      || task?.assignee_name
      || task?.assignee?.nick
      || task?.assignee?.name
      || task?.creator_nick
      || task?.creator_name
      || task?.creator?.nick
      || task?.creator?.name
      || task?.assignee_key
      || task?.creator_key
      || "";
    const nick = String(
      (typeof window.socialDecodeUiText === "function" ? window.socialDecodeUiText(nickRaw || "") : nickRaw || "")
      || ""
    ).trim() || loc("Без исполнителя", "No assignee");
    const avatar = String(
      task?.assignee_avatar_url
      || task?.assignee_avatar
      || task?.assignee_image
      || task?.assignee?.avatar_url
      || task?.assignee?.avatar
      || task?.assignee?.image
      || task?.creator_avatar_url
      || task?.creator_avatar
      || task?.creator?.avatar_url
      || task?.creator?.avatar
      || ""
    ).trim();
    return `
      <div class="social-task-assignee" title="${String(nick).replace(/"/g, "&quot;")}">
        <span class="social-task-assignee-avatar">${typeof window.socialAvatarMarkup === "function" ? window.socialAvatarMarkup(avatar, nick, "xs") : ""}</span>
        <span class="social-task-assignee-name">${String(nick)}</span>
      </div>
    `;
  };

  wrap("socialRenderNotesList", (original) => function wrappedRenderNotesListHotfix() {
    const result = original.apply(this, arguments);
    normalizeNotesHotfix();
    return result;
  });

  wrap("socialOpenNoteEditor", (original) => function wrappedOpenNoteEditorHotfix() {
    const result = original.apply(this, arguments);
    setTimeout(() => {
      normalizeNotesHotfix();
      paintNoteColorSwatches(document.getElementById("socialModalHost") || document);
    }, 0);
    return result;
  });

  wrap("socialPickNoteCoverColor", (original) => function wrappedPickNoteCoverColorHotfix() {
    const result = original.apply(this, arguments);
    setTimeout(() => {
      normalizeNotesHotfix();
      paintNoteColorSwatches(document.getElementById("socialModalHost") || document);
    }, 0);
    return result;
  });

  wrap("socialCreateNote", (original) => async function wrappedCreateNoteHotfix() {
    const result = await Promise.resolve(original.apply(this, arguments));
    setTimeout(normalizeNotesHotfix, 0);
    return result;
  });

  wrap("socialRenderTasks", (original) => function wrappedRenderTasksHotfix() {
    const result = original.apply(this, arguments);
    normalizeTasksHotfix();
    return result;
  });

  wrap("socialShowDay", (original) => function wrappedShowDayHotfix(dayKey) {
    ensureSocialCalendarVisible();
    const result = original.apply(this, arguments);
    setTimeout(hideLegacyCalendarPanels, 0);
    setTimeout(hideLegacyCalendarPanels, 80);
    return result;
  });

  wrap("socialOpenCalendarRecordDetail", (original) => function wrappedOpenCalendarRecordDetailHotfix() {
    ensureSocialCalendarVisible();
    const result = original.apply(this, arguments);
    setTimeout(hideLegacyCalendarPanels, 0);
    return result;
  });

  wrap("socialCalendarBackLayer", (original) => function wrappedCalendarBackLayerHotfix() {
    ensureSocialCalendarVisible();
    const result = original.apply(this, arguments);
    setTimeout(() => {
      ensureSocialCalendarVisible();
      hideLegacyCalendarPanels();
    }, 0);
    return result;
  });

  const refreshAll = () => {
    rebindBellButtonsHotfix();
    bindCalendarBackGestureHotfix();
    normalizeNotesHotfix();
    normalizeTasksHotfix();
    paintNoteColorSwatches(document);
    hideLegacyCalendarPanels();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", refreshAll, { once: true });
  } else {
    refreshAll();
  }

  window.addEventListener("resize", refreshAll);
  setTimeout(refreshAll, 120);
  setTimeout(refreshAll, 600);
  }
})();

(() => {
  if (window.__seoWibeUiUltimate20260328) return;
  window.__seoWibeUiUltimate20260328 = true;

  const state = () => {
    if (!window.socialState || typeof window.socialState !== "object") window.socialState = {};
    return window.socialState;
  };

  const safeInvoke = (fn, ...args) => {
    try {
      return typeof fn === "function" ? fn(...args) : undefined;
    } catch (_) {
      return undefined;
    }
  };

  const trText = (ru, en) => {
    try {
      return typeof window.tr === "function" ? window.tr(ru, en) : ru;
    } catch (_) {
      return ru;
    }
  };

  const escHtml = (value) => {
    const text = String(value == null ? "" : value);
    if (typeof window.escapeHtml === "function") {
      try {
        return window.escapeHtml(text);
      } catch (_) {}
    }
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };

  const decodeText = (value) => {
    let text = String(value == null ? "" : value);
    if (typeof window.socialDecodeUiText === "function") {
      try {
        text = window.socialDecodeUiText(text);
      } catch (_) {}
    }
    return text.trim();
  };

  const isAppShell = () => Boolean(
    document.body?.classList?.contains("mobile-apk-mode")
    || document.body?.classList?.contains("mobile-client-mode")
    || safeInvoke(window.socialIsAppShellLike)
    || safeInvoke(window.socialIsMobileClientShell)
    || safeInvoke(window.socialIsMobileApkShell)
    || String(window.location?.pathname || "").trim() === "/mobile"
  );

  const calendarModalVisible = () => {
    const modal = document.getElementById("socialModal");
    return Boolean(modal && !modal.classList.contains("hidden"));
  };

  const originalCloseModalFinal = typeof window.socialCloseModal === "function"
    ? window.socialCloseModal
    : null;

  const calendarMonthPickerVisibleFinal = () => Boolean(
    document.querySelector("#socialModal:not(.hidden) .social-calendar-month-year-modal")
  );

  const pad2Final = (value) => String(Number(value || 0)).padStart(2, "0");

  const calendarDayKeyFinal = (value) => {
    const resolved = safeInvoke(window.socialCalendarDayKey, value);
    if (String(resolved || "").trim()) {
      return String(resolved || "").trim();
    }
    const parsed = value instanceof Date ? value : new Date(value);
    if (!(parsed instanceof Date) || Number.isNaN(parsed.getTime())) return "";
    return `${parsed.getFullYear()}-${pad2Final(parsed.getMonth() + 1)}-${pad2Final(parsed.getDate())}`;
  };

  const calendarEventRowsFinal = () => {
    const st = state();
    if (Array.isArray(st.calendarEvents) && st.calendarEvents.length) return st.calendarEvents;
    if (Array.isArray(st.calendarEventsLastGood) && st.calendarEventsLastGood.length) return st.calendarEventsLastGood;
    return Array.isArray(st.calendarEvents) ? st.calendarEvents : [];
  };

  const forceHideModalFinal = () => {
    const modal = document.getElementById("socialModal");
    const host = document.getElementById("socialModalHost");
    if (host) host.innerHTML = "";
    if (modal) modal.classList.add("hidden");
    state().activeGameRunner = null;
  };

  const hasCalendarDaysFinal = () => Boolean(
    document.querySelector("#socialCalendarGrid .social-day[data-day-key]")
  );

  const ensureCalendarGridVisibleFinal = () => {
    const root = document.getElementById("socialSubtabCalendar");
    const grid = document.getElementById("socialCalendarGrid");
    [root, root?.querySelector(".social-calendar-shell"), root?.querySelector(".social-calendar-board"), root?.querySelector(".social-calendar-main"), grid].forEach((node) => {
      if (!node) return;
      node.hidden = false;
      node.style.removeProperty("display");
      node.style.removeProperty("visibility");
      node.style.removeProperty("opacity");
      node.style.removeProperty("max-height");
      node.style.removeProperty("min-height");
    });
    if (grid) {
      grid.style.setProperty("display", "block", "important");
      grid.style.setProperty("visibility", "visible", "important");
      grid.style.setProperty("opacity", "1", "important");
    }
    return hasCalendarDaysFinal();
  };

  const hideNode = (node) => {
    if (!node) return;
    node.hidden = true;
    node.style.setProperty("display", "none", "important");
    node.style.setProperty("max-height", "0", "important");
    node.style.setProperty("min-height", "0", "important");
    node.style.setProperty("overflow", "hidden", "important");
    node.style.setProperty("margin", "0", "important");
    node.style.setProperty("padding", "0", "important");
    node.style.setProperty("border", "0", "important");
    node.style.setProperty("box-shadow", "none", "important");
  };

  const hideLegacyCalendarPanelsFinal = () => {
    if (disableTextBehaviorOverrides) return;
    const root = document.getElementById("socialSubtabCalendar");
    if (!root) return;
    [
      "#socialCalendarEvents",
      "#socialCalendarEventsLegacy",
      ".social-calendar-events",
      ".social-calendar-selected",
      ".social-calendar-selected-day",
      ".social-calendar-day-header",
      ".social-calendar-day-details",
      ".social-calendar-day-list",
      ".social-calendar-records",
      ".social-calendar-summary",
      ".social-calendar-selected-wrap",
      ".social-calendar-selected-panel",
      ".social-calendar-day-panel",
      ".social-calendar-day-cards",
      ".social-calendar-day-entries",
      ".social-calendar-bottom",
      ".social-calendar-lower",
      ".social-calendar-selected-info",
      ".social-calendar-selected-content",
      "[data-calendar-detail]",
      "[data-selected-day]",
      "[data-calendar-selected-panel]"
    ].forEach((selector) => {
      root.querySelectorAll(selector).forEach((node) => {
        if (!node) return;
        if (node.id === "socialCalendarDaySheet" || node.id === "socialCalendarDaySheetBackdrop") return;
        if (node.closest?.("#socialCalendarDaySheet")) return;
        hideNode(node);
      });
    });
  };

  const normalizeCalendarHeaderFinal = () => {
    if (disableTextBehaviorOverrides) return;
    const root = document.getElementById("socialSubtabCalendar");
    if (!root) return;
    const label = document.getElementById("socialCalendarMonthLabel");
    if (label) {
      label.style.setProperty("display", "block", "important");
      label.style.setProperty("width", "100%", "important");
      label.style.setProperty("margin", "0 auto 8px", "important");
      label.style.setProperty("text-align", "center", "important");
      label.style.setProperty("justify-self", "center", "important");
      label.style.setProperty("align-self", "center", "important");
      label.style.setProperty("cursor", "pointer", "important");
      label.removeAttribute("title");
      if (label.dataset.seoWibeMonthPickerFinal !== "1") {
        label.dataset.seoWibeMonthPickerFinal = "1";
        label.addEventListener("click", (event) => {
          if (event?.preventDefault) event.preventDefault();
          if (event?.stopPropagation) event.stopPropagation();
          safeInvoke(window.socialOpenCalendarMonthYearPicker, { source: "month-label" });
        });
      }
    }
    if (isAppShell()) {
      root.querySelectorAll("#socialCalendarMonthSelect, #socialCalendarYearSelect, .social-calendar-picker, .social-calendar-nav-controls, #socialCalendarMonth, #socialCalendarYear").forEach((node) => {
        if (!node || node === label) return;
        node.hidden = true;
        node.style.setProperty("display", "none", "important");
        node.style.setProperty("visibility", "hidden", "important");
        node.style.setProperty("pointer-events", "none", "important");
      });
    }
    const grid = document.getElementById("socialCalendarGrid");
    if (grid) {
      grid.hidden = false;
      grid.style.removeProperty("display");
      grid.style.removeProperty("visibility");
      grid.style.removeProperty("opacity");
      grid.querySelectorAll("[title]").forEach((node) => node.removeAttribute("title"));
    }
  };

  const renderCalendarGridFallbackFinal = () => {
    if (disableTextBehaviorOverrides) return false;
    const root = document.getElementById("socialSubtabCalendar");
    const grid = document.getElementById("socialCalendarGrid");
    if (!root || !grid) return false;
    const st = state();
    const base = st.calendarDate instanceof Date && !Number.isNaN(st.calendarDate.getTime())
      ? new Date(st.calendarDate.getTime())
      : new Date();
    const calendarDate = new Date(base.getFullYear(), base.getMonth(), 1, 0, 0, 0, 0);
    st.calendarDate = calendarDate;
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstDay = new Date(year, month, 1, 0, 0, 0, 0);
    const lastDay = new Date(year, month + 1, 0, 0, 0, 0, 0);
    const shift = (firstDay.getDay() + 6) % 7;
    const days = lastDay.getDate();
    const todayKey = calendarDayKeyFinal(new Date());
    const monthPrefix = `${year}-${pad2Final(month + 1)}-`;
    const myActorKey = String(st.boot?.actor?.actor_key || "").trim();
    const eventsByDay = new Map();
    const tasksByDay = new Map();

    calendarEventRowsFinal().forEach((eventRow) => {
      const key = calendarDayKeyFinal(safeInvoke(window.socialCalendarResolveEventStart, eventRow));
      if (!key) return;
      if (!eventsByDay.has(key)) eventsByDay.set(key, []);
      eventsByDay.get(key).push(eventRow);
    });

    (Array.isArray(st.tasks) ? st.tasks : []).forEach((taskRow) => {
      const key = calendarDayKeyFinal(safeInvoke(window.socialCalendarResolveTaskDue, taskRow));
      if (!key) return;
      if (!tasksByDay.has(key)) tasksByDay.set(key, []);
      tasksByDay.get(key).push(taskRow);
    });

    const monthInput = document.getElementById("socialCalendarMonth");
    if (monthInput) {
      monthInput.value = String(
        safeInvoke(window.socialCalendarMonthValue, calendarDate) || `${year}-${pad2Final(month + 1)}`
      ).trim();
    }
    const monthLabel = document.getElementById("socialCalendarMonthLabel");
    if (monthLabel) {
      monthLabel.textContent = String(
        safeInvoke(window.socialCalendarMonthLabel, calendarDate)
        || calendarDate.toLocaleDateString(document.documentElement.lang === "en" ? "en-US" : "ru-RU", {
          month: "long",
          year: "numeric",
        })
      ).trim();
    }

    const weekdayHead = [
      trText("Пн", "Mon"),
      trText("Вт", "Tue"),
      trText("Ср", "Wed"),
      trText("Чт", "Thu"),
      trText("Пт", "Fri"),
      trText("Сб", "Sat"),
      trText("Вс", "Sun"),
    ].map((label) => `<span>${escHtml(label)}</span>`).join("");

    let html = `<div class="social-calendar-row head">${weekdayHead}</div><div class="social-calendar-cells">`;
    for (let index = 0; index < shift; index += 1) {
      html += `<button class="social-day muted" type="button" disabled></button>`;
    }
    for (let day = 1; day <= days; day += 1) {
      const key = `${year}-${pad2Final(month + 1)}-${pad2Final(day)}`;
      const previewRows = [];
      (eventsByDay.get(key) || []).forEach((eventRow) => {
        const title = decodeText(safeInvoke(window.socialCalendarResolveEventTitle, eventRow) || "")
          || trText("Событие", "Event");
        previewRows.push({
          kind: "event",
          title,
          color: String(eventRow?.color || "#8fb8ff").trim() || "#8fb8ff",
        });
      });
      (tasksByDay.get(key) || []).forEach((taskRow) => {
        const title = decodeText(safeInvoke(window.socialCalendarResolveTaskTitle, taskRow) || "")
          || trText("Задача", "Task");
        const ownTask = myActorKey && String(taskRow?.assignee_key || "").trim() === myActorKey;
        previewRows.push({
          kind: "task",
          title,
          color: ownTask ? "#95d8aa" : "#d7b6ff",
        });
      });
      const chips = previewRows.slice(0, 3).map((item) => {
        const chipTitle = String(item.title || "").trim() || trText("Запись", "Entry");
        const shortTitle = chipTitle.length > 20 ? `${chipTitle.slice(0, 19)}...` : chipTitle;
        return `<span class="sw-calendar-chip" style="--sw-chip-color:${escHtml(item.color)}"><span class="sw-calendar-chip-title">${escHtml(shortTitle)}</span></span>`;
      }).join("");
      const moreCount = Math.max(0, previewRows.length - 3);
      const more = moreCount > 0 ? `<span class="sw-calendar-more">+${moreCount}</span>` : "";
      const active = String(st.calendarSelectedDay || "") === key ? "active" : "";
      const isToday = todayKey === key ? "today" : "";
      const hasEvent = previewRows.some((row) => row.kind === "event") ? "has-event" : "";
      const hasTask = previewRows.some((row) => row.kind === "task") ? "has-task" : "";
      html += `<button class="social-day rich ${active} ${isToday} ${hasEvent} ${hasTask}" data-day-key="${escHtml(key)}" type="button" onclick="socialShowDay('${key}')"><div class="social-day-head"><b>${day}</b></div><div class="social-day-preview-stack">${chips}</div>${more}</button>`;
    }
    html += "</div>";
    grid.innerHTML = html;
    grid.hidden = false;
    grid.style.setProperty("display", "block", "important");
    grid.style.setProperty("visibility", "visible", "important");
    grid.style.setProperty("opacity", "1", "important");
    if (!String(st.calendarSelectedDay || "").startsWith(monthPrefix)) {
      st.calendarSelectedDay = todayKey && todayKey.startsWith(monthPrefix) ? todayKey : `${monthPrefix}01`;
    }
    try {
      document.querySelector(`#socialCalendarGrid .social-day[data-day-key="${CSS.escape(String(st.calendarSelectedDay || ""))}"]`)?.classList?.add("active");
    } catch (_) {}
    safeInvoke(window.socialHideCalendarLegacyDetails);
    hideLegacyCalendarPanelsFinal();
    if (st.calendarDaySheetOpen && String(st.calendarSelectedDay || "").trim()) {
      safeInvoke(window.socialOpenCalendarDaySheet, st.calendarSelectedDay);
    }
    return hasCalendarDaysFinal();
  };

  const paintNoteColorSwatchesFinal = () => {
    document.querySelectorAll("#socialNoteModalColors .sw-note-color, #socialModalHost .sw-note-color, #socialModal .sw-note-color").forEach((node) => {
      const color = String(
        node.getAttribute("data-note-color")
        || node.style.getPropertyValue("--sw-note-cover")
        || ""
      ).trim() || "#eef4ff";
      node.style.setProperty("--sw-note-cover", color, "important");
      node.style.setProperty("background", color, "important");
      node.style.setProperty("background-color", color, "important");
      node.style.setProperty("background-image", "none", "important");
      node.style.setProperty("opacity", "1", "important");
      node.style.setProperty("border-color", "rgba(127, 151, 188, 0.35)", "important");
      node.textContent = "";
      node.innerHTML = "";
      node.removeAttribute("title");
    });
  };

  const ensureNotesFabFinal = () => {
    const root = document.getElementById("socialSubtabNotes");
    const host = document.getElementById("socialNotesList");
    if (!root || !host) return;
    root.style.setProperty("position", "relative", "important");
    root.querySelectorAll("button").forEach((btn) => {
      if (!btn || btn.id === "socialNotesFab") return;
      const text = String(btn.textContent || btn.getAttribute("aria-label") || btn.getAttribute("title") || "").trim();
      if (/создать\s+(запись|заметку)|create\s+(note|entry)/i.test(text)) {
        btn.hidden = true;
        btn.style.setProperty("display", "none", "important");
      }
      btn.removeAttribute("title");
    });
    let fab = document.getElementById("socialNotesFab");
    if (!fab) {
      fab = document.createElement("button");
      fab.id = "socialNotesFab";
      fab.type = "button";
      fab.className = "social-notes-fab";
      root.appendChild(fab);
    }
    fab.textContent = "+";
    fab.setAttribute("aria-label", trText("Создать заметку", "Create note"));
    fab.removeAttribute("title");
    fab.onclick = async (event) => {
      if (event?.preventDefault) event.preventDefault();
      if (event?.stopPropagation) event.stopPropagation();
      await safeInvoke(window.socialCreateNote);
      normalizeNotesFinal();
    };
    host.style.setProperty("margin-top", "18px", "important");
    host.style.setProperty("padding-top", "6px", "important");
  };

  const normalizeNotesFinal = () => {
    const host = document.getElementById("socialNotesList");
    if (!host) return;
    ensureNotesFabFinal();
    host.querySelectorAll(".social-note-row[data-note-id], .sw-note-card[data-note-id]").forEach((row) => {
      const noteId = Number(row.getAttribute("data-note-id") || 0);
      const cover = String(
        row.style.getPropertyValue("--sw-note-cover")
        || getComputedStyle(row).getPropertyValue("--sw-note-cover")
        || "#eef4ff"
      ).trim() || "#eef4ff";
      const fill = `linear-gradient(180deg, color-mix(in srgb, ${cover} 58%, #ffffff), color-mix(in srgb, ${cover} 26%, #ffffff))`;
      row.style.setProperty("--sw-note-cover", cover, "important");
      row.style.setProperty("--sw-note-card-fill", fill, "important");
      row.style.setProperty("background", fill, "important");
      row.style.setProperty("background-color", cover, "important");
      row.style.setProperty("background-image", fill, "important");
      row.style.setProperty("margin-top", "0", "important");
      row.querySelectorAll("[title]").forEach((node) => node.removeAttribute("title"));
      if (noteId > 0) {
        row.onclick = () => safeInvoke(window.socialOpenNoteEditor, noteId);
      }
    });
    paintNoteColorSwatchesFinal();
  };

  const normalizeTasksFinal = () => {
    const host = document.getElementById("socialTasksBoard");
    if (!host) return;
    const includeDone = Boolean(document.getElementById("socialTaskIncludeDone")?.checked);
    host.querySelectorAll(".social-task-item").forEach((item) => {
      const done = item.classList.contains("is-done");
      item.style.setProperty("display", (!includeDone && done) ? "none" : "", "important");
      const badge = item.querySelector(".social-task-kind");
      if (badge) {
        badge.style.setProperty("max-width", "68px", "important");
        badge.style.setProperty("width", "auto", "important");
        badge.style.setProperty("white-space", "nowrap", "important");
        badge.style.setProperty("overflow", "hidden", "important");
        badge.style.setProperty("text-overflow", "ellipsis", "important");
      }
      item.querySelectorAll(".social-task-delete, .social-task-check").forEach((node) => {
        node.removeAttribute("title");
        node.style.setProperty("display", "flex", "important");
        node.style.setProperty("align-items", "center", "important");
        node.style.setProperty("justify-content", "center", "important");
        node.style.setProperty("line-height", "1", "important");
      });
      const assigneeName = item.querySelector(".social-task-assignee-name");
      if (assigneeName) {
        assigneeName.textContent = decodeText(assigneeName.textContent || "");
      }
    });
  };

  const baseNotificationResolverFinal = typeof window.socialResolveNotificationText === "function"
    ? window.socialResolveNotificationText
    : null;

  const flattenNotificationValuesFinal = (value, acc = []) => {
    if (value == null) return acc;
    if (Array.isArray(value)) {
      value.forEach((item) => flattenNotificationValuesFinal(item, acc));
      return acc;
    }
    if (typeof value === "object") {
      Object.keys(value).forEach((key) => flattenNotificationValuesFinal(value[key], acc));
      return acc;
    }
    acc.push(String(value));
    return acc;
  };

  const sanitizeNotificationCandidateFinal = (value) => decodeText(value).replace(/\s+/g, " ").trim();

  const meaningfulNotificationTextFinal = (value) => {
    const text = sanitizeNotificationCandidateFinal(value);
    if (!text) return "";
    if (/^(true|false|null|none|undefined|nan)$/i.test(text)) return "";
    const compact = text.replace(/\s+/g, "");
    if (compact && /^[\d:.\-+/()]+$/.test(compact)) return "";
    if (!/[A-Za-zА-Яа-яЁё]/.test(text)) return "";
    return text;
  };

  const notificationKindLabelFinal = (kind) => {
    const safeKind = String(kind || "").trim().toLowerCase();
    if (safeKind.includes("chat_reaction")) return trText("Новая реакция", "New reaction");
    if (safeKind.includes("chat")) return trText("Новое сообщение", "New message");
    if (safeKind.includes("task")) return trText("Задачи", "Tasks");
    if (safeKind.includes("calendar") || safeKind.includes("event") || safeKind.includes("reminder")) {
      return trText("Календарь", "Calendar");
    }
    return trText("Уведомление", "Notification");
  };

  const pickNotificationTextFinal = (candidates, fallback = "") => {
    const variants = flattenNotificationValuesFinal(candidates, [])
      .map((item) => meaningfulNotificationTextFinal(item))
      .filter(Boolean);
    if (!variants.length) return sanitizeNotificationCandidateFinal(fallback);
    const unique = [...new Set(variants)];
    return unique.sort((left, right) => {
      const leftPenalty = /[ÐÑРС]/.test(left) ? 1 : 0;
      const rightPenalty = /[ÐÑРС]/.test(right) ? 1 : 0;
      if (leftPenalty !== rightPenalty) return leftPenalty - rightPenalty;
      return right.length - left.length;
    })[0];
  };

  const resolveNotificationEntityTitleFinal = (kind, payload) => {
    const safeKind = String(kind || "").trim().toLowerCase();
    const safePayload = payload && typeof payload === "object" ? payload : {};
    if (safeKind.includes("task")) {
      const taskId = Number(safePayload.task_id || safePayload.id || 0);
      if (taskId > 0) {
        const taskRow = (Array.isArray(state().tasks) ? state().tasks : []).find((row) => Number(row?.id || 0) === taskId);
        const title = decodeText(taskRow?.title || "");
        if (title) return title;
      }
    }
    if (safeKind.includes("calendar") || safeKind.includes("event") || safeKind.includes("reminder")) {
      const eventId = Number(safePayload.event_id || safePayload.source_event_id || safePayload.calendar_event_id || 0);
      if (eventId > 0) {
        const eventRow = calendarEventRowsFinal().find((row) => Number(row?.id || 0) === eventId);
        const title = decodeText(safeInvoke(window.socialCalendarResolveEventTitle, eventRow) || eventRow?.title || "");
        if (title) return title;
      }
    }
    return "";
  };

  const notificationTextFinal = (row) => {
    const safeRow = row && typeof row === "object" ? row : {};
    const payload = safeRow.payload && typeof safeRow.payload === "object" ? safeRow.payload : {};
    let safe = {};
    try {
      safe = baseNotificationResolverFinal ? (baseNotificationResolverFinal(safeRow) || {}) : safeRow;
    } catch (_) {
      safe = safeRow;
    }
    const kind = String(safeRow.kind || payload.kind || "").trim().toLowerCase();
    const titleFallback = notificationKindLabelFinal(kind);
    let title = pickNotificationTextFinal([
      safe?.title,
      safeRow.title,
      safeRow.subject,
      payload.title,
      payload.subject,
      payload.chat_title,
      payload.thread_title,
      payload.sender_nick,
      payload.sender_name,
      payload.actor_nick,
      payload.author,
    ], titleFallback) || titleFallback;
    if (!meaningfulNotificationTextFinal(title) || /^[\d\s:.\-+/()]+$/.test(String(title || "").trim())) {
      title = resolveNotificationEntityTitleFinal(kind, payload) || titleFallback;
    }
    let body = pickNotificationTextFinal([
      safe?.body,
      safeRow.body,
      safeRow.text,
      safeRow.preview,
      safeRow.message,
      safeRow.subtitle,
      payload.body,
      payload.text,
      payload.preview,
      payload.message,
      payload.content,
      payload.snippet,
      payload.note,
      payload.description,
    ], "");
    if (!body && kind.includes("chat")) {
      const sender = pickNotificationTextFinal([
        payload.sender_nick,
        payload.sender_name,
        payload.actor_nick,
        payload.author,
      ], "");
      const preview = pickNotificationTextFinal([
        payload.preview,
        payload.text,
        payload.message,
        safeRow.preview,
        safeRow.message,
        safeRow.text,
      ], "");
      body = [sender, preview].filter(Boolean).join(": ");
    }
    if (!body && kind.includes("reaction")) {
      body = pickNotificationTextFinal([
        payload.sender_nick,
        payload.actor_nick,
        payload.emoji,
      ], "");
    }
    if (!body || !meaningfulNotificationTextFinal(body) || /^[\d\s:.\-+/()]+$/.test(String(body || "").trim())) {
      body = resolveNotificationEntityTitleFinal(kind, payload) || body;
    }
    return {
      title: title || titleFallback,
      body: body || trText("Без текста", "No text")
    };
  };

  const notificationTextForDisplayFinal = (row) => {
    if (disableTextBehaviorOverrides) {
      try {
        const base = notificationTextFinal(row) || (baseNotificationResolverFinal ? (baseNotificationResolverFinal(row) || {}) : {});
        return {
          title: String(base?.title || row?.title || "").trim(),
          body: String(base?.body || row?.body || "").trim(),
        };
      } catch (_) {
        return {
          title: String(row?.title || "").trim(),
          body: String(row?.body || "").trim(),
        };
      }
    }
    return notificationTextFinal(row);
  };

  if (!disableTextBehaviorOverrides) {
    window.socialResolveNotificationText = function socialResolveNotificationTextUltimate(row) {
      return notificationTextFinal(row);
    };
    window.socialResolveNotificationText.__seoWibeFinalWrapped = true;
  }

  const normalizeNotificationCenterFinal = () => {
    const center = document.getElementById("socialNotificationCenter");
    if (!center) return;
    const rows = Array.isArray(state().notificationRows) ? state().notificationRows : [];
    center.querySelectorAll("[title]").forEach((node) => node.removeAttribute("title"));
    center.querySelectorAll(".social-notif-item").forEach((item) => {
      const id = Number(item.getAttribute("data-notif-id") || 0);
      const row = rows.find((entry) => Number(entry?.id || 0) === id) || null;
      if (!row) return;
      const text = notificationTextForDisplayFinal(row);
      const titleNode = item.querySelector(".social-notif-item-head b");
      const bodyNode = item.querySelector("p");
      if (titleNode) titleNode.textContent = text.title;
      if (bodyNode) bodyNode.textContent = text.body;
    });
  };

  const bindBellButtonsFinal = () => {
    if (enableBehaviorOverridesFinal === false) return;
    ["socialBellBtn", "mobileDrawerBellBtn"].forEach((id) => {
      const btn = document.getElementById(id);
      if (!btn || btn.dataset.seoWibeBellFinal === "1") return;
      btn.dataset.seoWibeBellFinal = "1";
      btn.removeAttribute("title");
      btn.addEventListener("click", async (event) => {
        if (event?.preventDefault) event.preventDefault();
        if (event?.stopPropagation) event.stopPropagation();
        if (typeof window.socialToggleNotificationCenter === "function") {
          await window.socialToggleNotificationCenter();
          normalizeNotificationCenterFinal();
        }
      }, true);
    });
  };

  const calendarLayerActive = () => {
    const st = state();
    return Boolean(
      Array.isArray(st.calendarHistoryLayers) && st.calendarHistoryLayers.length
      || st.calendarDaySheetOpen
      || calendarModalVisible()
    );
  };

  const shiftCalendarMonthFinal = (delta) => {
    const st = state();
    let base = safeInvoke(window.socialCalendarParseDate, st.calendarDate || new Date());
    if (!(base instanceof Date) || Number.isNaN(base.getTime())) base = new Date();
    base.setHours(12, 0, 0, 0);
    base.setDate(1);
    base.setMonth(base.getMonth() + Number(delta || 0));
    st.calendarDate = base;
    st.calendarSelectedDay = "";
    safeInvoke(window.socialHideCalendarDaySheet, true);
    safeInvoke(window.socialLoadCalendar, { preserveSelection: false, silent: false });
    setTimeout(() => restoreCalendarGridFinal({ reload: true }), 60);
  };

  const bindCalendarMonthSwipeFinal = () => {
    if (enableBehaviorOverridesFinal === false) return;
    const grid = document.getElementById("socialCalendarGrid");
    if (!grid || grid.dataset.seoWibeMonthSwipeFinal === "1") return;
    grid.dataset.seoWibeMonthSwipeFinal = "1";
    let startX = 0;
    let startY = 0;
    let active = false;
    grid.addEventListener("touchstart", (event) => {
      if (!isAppShell()) return;
      const touch = event.touches?.[0];
      if (!touch) return;
      startX = touch.clientX;
      startY = touch.clientY;
      active = true;
    }, { passive: true });
    grid.addEventListener("touchend", (event) => {
      if (!active || !isAppShell()) return;
      active = false;
      const touch = event.changedTouches?.[0];
      if (!touch) return;
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      if (Math.abs(dx) < 58 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      shiftCalendarMonthFinal(dx < 0 ? 1 : -1);
    }, { passive: true });
  };

  const bindCalendarBackGestureFinal = () => {
    if (enableBehaviorOverridesFinal === false) return;
    if (document.body?.dataset?.seoWibeCalendarBackFinal === "1") return;
    if (document.body) document.body.dataset.seoWibeCalendarBackFinal = "1";
    let startX = 0;
    let startY = 0;
    let armed = false;
    let locking = false;
    document.addEventListener("touchstart", (event) => {
      if (!isAppShell() || !calendarLayerActive()) return;
      const touch = event.touches?.[0];
      if (!touch) return;
      startX = touch.clientX;
      startY = touch.clientY;
      armed = startX <= 36;
      locking = false;
    }, { capture: true, passive: true });
    document.addEventListener("touchmove", (event) => {
      if (!armed) return;
      const touch = event.touches?.[0];
      if (!touch) return;
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      if (dx > 14 && Math.abs(dy) < 48) {
        locking = true;
        if (event.cancelable) event.preventDefault();
      }
    }, { capture: true, passive: false });
    document.addEventListener("touchend", (event) => {
      if (!armed) return;
      armed = false;
      const touch = event.changedTouches?.[0];
      if (!touch) return;
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      if (locking && dx > 72 && Math.abs(dy) < 56) {
        if (event.cancelable) event.preventDefault();
        safeInvoke(window.socialCalendarBackLayer);
      }
      locking = false;
    }, { capture: true, passive: false });
  };

  const finalizeCalendarChromeFinal = () => {
    ensureCalendarGridVisibleFinal();
    normalizeCalendarHeaderFinal();
    bindCalendarMonthSwipeFinal();
    hideLegacyCalendarPanelsFinal();
  };

  const restoreCalendarGridFinal = (options = {}) => {
    const opts = options && typeof options === "object" ? options : { reload: Boolean(options) };
    const reload = Boolean(opts.reload);
    const attempt = Number(opts.attempt || 0);
    const monthInput = document.getElementById("socialCalendarMonth");
    const monthValue = safeInvoke(window.socialCalendarMonthValue, state().calendarDate);
    if (monthInput && typeof monthValue === "string" && monthValue.trim()) {
      monthInput.value = monthValue.trim();
    }
    finalizeCalendarChromeFinal();
    safeInvoke(window.socialRenderCalendar);
    ensureCalendarGridVisibleFinal();
    if (!hasCalendarDaysFinal()) {
      renderCalendarGridFallbackFinal();
      ensureCalendarGridVisibleFinal();
    }
    if (!reload) {
      setTimeout(() => {
        finalizeCalendarChromeFinal();
        ensureCalendarGridVisibleFinal();
        if (!hasCalendarDaysFinal()) {
          safeInvoke(window.socialRenderCalendar);
          ensureCalendarGridVisibleFinal();
          if (!hasCalendarDaysFinal()) {
            renderCalendarGridFallbackFinal();
            ensureCalendarGridVisibleFinal();
          }
          if (attempt < 2) {
            setTimeout(() => restoreCalendarGridFinal({ reload: false, attempt: attempt + 1 }), 180);
          }
        }
      }, 80);
      return;
    }
    Promise.resolve(safeInvoke(window.socialLoadCalendar, { preserveSelection: false, silent: false }))
      .catch(() => undefined)
      .finally(() => {
        setTimeout(() => {
          finalizeCalendarChromeFinal();
          ensureCalendarGridVisibleFinal();
          if (!hasCalendarDaysFinal()) {
            safeInvoke(window.socialRenderCalendar);
            ensureCalendarGridVisibleFinal();
            if (!hasCalendarDaysFinal()) {
              renderCalendarGridFallbackFinal();
              ensureCalendarGridVisibleFinal();
            }
            if (attempt < 2) {
              setTimeout(() => restoreCalendarGridFinal({ reload: true, attempt: attempt + 1 }), 220);
            }
          }
        }, 110);
      });
  };

  const closeMonthPickerFinal = (options = {}) => {
    const opts = options && typeof options === "object" ? options : { reload: Boolean(options) };
    const st = state();
    st.calendarMonthPickerOpen = false;
    const stack = Array.isArray(st.calendarHistoryLayers) ? st.calendarHistoryLayers : [];
    if (stack.length && String(stack[stack.length - 1]?.layer || "").trim() === "month-picker") {
      stack.pop();
    }
    st.calendarGestureStackActive = stack.length > 0;
    forceHideModalFinal();
    safeInvoke(window.socialHideCalendarDaySheet, true);
    st.calendarSelectedDay = "";
    st.calendarDaySheetOpen = false;
    safeInvoke(window.socialHideCalendarLegacyDetails);
    safeInvoke(window.socialSyncCalendarMonthYearInputs);
    safeInvoke(window.socialRenderCalendar);
    ensureCalendarGridVisibleFinal();
    setTimeout(() => restoreCalendarGridFinal({ reload: Boolean(opts.reload) || !hasCalendarDaysFinal() }), 30);
  };

  const originalNotificationRender = typeof window.socialRenderNotificationCenter === "function"
    ? window.socialRenderNotificationCenter
    : null;
  if (originalNotificationRender && originalNotificationRender.__seoWibeFinalWrapped !== true) {
    const wrapped = function wrappedNotificationRenderFinal() {
      const result = originalNotificationRender.apply(this, arguments);
      normalizeNotificationCenterFinal();
      bindBellButtonsFinal();
      return result;
    };
    wrapped.__seoWibeFinalWrapped = true;
    window.socialRenderNotificationCenter = wrapped;
  }

  const originalNotificationToggle = typeof window.socialToggleNotificationCenter === "function"
    ? window.socialToggleNotificationCenter
    : null;
  if (originalNotificationToggle && originalNotificationToggle.__seoWibeFinalWrapped !== true) {
    const wrapped = async function wrappedNotificationToggleFinal() {
      const result = await originalNotificationToggle.apply(this, arguments);
      normalizeNotificationCenterFinal();
      bindBellButtonsFinal();
      return result;
    };
    wrapped.__seoWibeFinalWrapped = true;
    window.socialToggleNotificationCenter = wrapped;
  }

  if (originalCloseModalFinal && originalCloseModalFinal.__seoWibeFinalWrapped !== true) {
    const wrapped = function wrappedCloseModalFinal(evt = null) {
      const forced = Boolean(evt && typeof evt === "object" && evt.force === true);
      if (!forced && calendarMonthPickerVisibleFinal()) {
        closeMonthPickerFinal({ reload: true });
        return true;
      }
      return originalCloseModalFinal.apply(this, arguments);
    };
    wrapped.__seoWibeFinalWrapped = true;
    window.socialCloseModal = wrapped;
  }

  const originalOpenCalendarDaySheet = typeof window.socialOpenCalendarDaySheet === "function"
    ? window.socialOpenCalendarDaySheet
    : null;
  window.socialOpenCalendarDaySheet = function socialOpenCalendarDaySheetFinal(dayKey) {
    const safeDayKey = String(dayKey || "").trim();
    if (!safeDayKey) return;
    const nodes = safeInvoke(window.socialEnsureCalendarDaySheetNodes);
    const backdrop = nodes?.backdrop;
    const sheet = nodes?.sheet;
    if (!backdrop || !sheet) {
      return safeInvoke(originalOpenCalendarDaySheet, safeDayKey);
    }
    safeInvoke(window.socialSetCalendarDaySheetOpen, true);
    hideLegacyCalendarPanelsFinal();
    const rows = safeInvoke(window.socialCalendarCollectDayEntries, safeDayKey) || { events: [], tasks: [] };
    const events = Array.isArray(rows.events) ? rows.events : [];
    const tasks = Array.isArray(rows.tasks) ? rows.tasks : [];
    const parsedDay = safeInvoke(window.socialCalendarParseDate, `${safeDayKey}T12:00:00`);
    const dayNumber = parsedDay instanceof Date && !Number.isNaN(parsedDay.getTime()) ? String(parsedDay.getDate()) : safeDayKey.slice(-2).replace(/^0/, "");
    const weekdayLabel = parsedDay instanceof Date && !Number.isNaN(parsedDay.getTime())
      ? parsedDay.toLocaleDateString(document.documentElement.lang === "en" ? "en-US" : "ru-RU", { weekday: "long" })
      : (safeInvoke(window.socialCalendarDayLabel, safeDayKey) || safeDayKey);
    const shortDateLabel = parsedDay instanceof Date && !Number.isNaN(parsedDay.getTime())
      ? parsedDay.toLocaleDateString(document.documentElement.lang === "en" ? "en-US" : "ru-RU", { day: "numeric", month: "short" })
      : safeDayKey;
    const cards = [];
    events.forEach((row) => {
      const id = Number(row?.id || 0);
      if (!id) return;
      const title = decodeText(safeInvoke(window.socialCalendarResolveEventTitle, row) || "") || trText("Событие", "Event");
      const startAt = safeInvoke(window.socialCalendarResolveEventStart, row);
      const endAt = safeInvoke(window.socialCalendarResolveEventEnd, row);
      const timeLabel = startAt
        ? `${safeInvoke(window.socialCalendarTimeLabel, startAt) || ""}${endAt ? ` - ${safeInvoke(window.socialCalendarTimeLabel, endAt) || ""}` : ""}`.trim()
        : trText("Весь день", "All day");
      const color = String(row?.color || "#8fb8ff").trim() || "#8fb8ff";
      cards.push(`
        <button type="button" class="sw-day-item is-event" style="--sw-sheet-color:${escHtml(color)}" onclick="socialOpenCalendarRecordDetail('event', ${id}, { dayKey: '${safeDayKey}' })">
          <span class="sw-calendar-sheet-badge">${escHtml(trText("Событие", "Event"))}</span>
          <b>${escHtml(title)}</b>
          <small>${escHtml(timeLabel || trText("Весь день", "All day"))}</small>
        </button>
      `);
    });
    tasks.forEach((row) => {
      const id = Number(row?.id || 0);
      if (!id) return;
      const title = decodeText(safeInvoke(window.socialCalendarResolveTaskTitle, row) || "") || trText("Задача", "Task");
      const dueAt = safeInvoke(window.socialCalendarResolveTaskDue, row);
      const timeLabel = dueAt ? (safeInvoke(window.socialCalendarTimeLabel, dueAt) || "") : trText("Без срока", "No due date");
      const ownTask = String(row?.task_kind || "company") === "personal";
      const color = ownTask ? "#89d3a5" : "#d9bcff";
      cards.push(`
        <button type="button" class="sw-day-item is-task" style="--sw-sheet-color:${escHtml(color)}" onclick="socialOpenCalendarRecordDetail('task', ${id}, { dayKey: '${safeDayKey}' })">
          <span class="sw-calendar-sheet-badge">${escHtml(trText("Задача", "Task"))}</span>
          <b>${escHtml(title)}</b>
          <small>${escHtml(timeLabel || trText("Без срока", "No due date"))}</small>
        </button>
      `);
    });
    sheet.innerHTML = `
      <section class="sw-day-sheet-card">
        <div class="sw-day-sheet-head">
          <div class="sw-day-sheet-title-block">
            <h4><span class="sw-day-sheet-daynum">${escHtml(dayNumber)}</span> ${escHtml(weekdayLabel)}</h4>
            <small>${escHtml(shortDateLabel)}</small>
          </div>
          <button type="button" class="btn-secondary sw-day-sheet-close" aria-label="${escHtml(trText("Закрыть", "Close"))}" onclick="socialCalendarBackLayer()">&times;</button>
        </div>
        <div class="sw-day-sheet-list">
          ${cards.join("") || `<div class="hint">${escHtml(trText("На этот день записей нет.", "No records for this day."))}</div>`}
        </div>
        <div class="sw-day-sheet-foot">
          <button type="button" class="sw-day-sheet-add" onclick="socialOpenCalendarQuickAddMenu({ dayKey: '${safeDayKey}' })">${escHtml(trText(`Добавить на ${shortDateLabel}`, `Add on ${shortDateLabel}`))}</button>
          <button type="button" class="social-calendar-fab social-calendar-fab-mini" aria-label="${escHtml(trText("Добавить", "Add"))}" onclick="socialOpenCalendarQuickAddMenu({ dayKey: '${safeDayKey}' })">+</button>
        </div>
      </section>
    `;
    sheet.querySelectorAll("[title]").forEach((node) => node.removeAttribute("title"));
    backdrop.classList.remove("hidden");
    sheet.classList.remove("hidden");
    sheet.setAttribute("aria-hidden", "false");
    normalizeCalendarHeaderFinal();
    hideLegacyCalendarPanelsFinal();
  };
  window.socialForceOpenCalendarDaySheet = window.socialOpenCalendarDaySheet;

  const originalShowDay = typeof window.socialShowDay === "function" ? window.socialShowDay : null;
  window.socialShowDay = function socialShowDayFinal(dayKey, options = {}) {
    const safeDayKey = String(dayKey || "").trim();
    if (!safeDayKey) return;
    state().calendarSelectedDay = safeDayKey;
    document.querySelectorAll("#socialCalendarGrid .social-day.active").forEach((node) => node.classList.remove("active"));
    try {
      document.querySelector(`#socialCalendarGrid .social-day[data-day-key="${CSS.escape(safeDayKey)}"]`)?.classList?.add("active");
    } catch (_) {}
    if (!options || options.skipHistory !== true) {
      safeInvoke(window.socialCalendarPushHistoryLayer, "day", { dayKey: safeDayKey }, { replaceTop: true });
    }
    safeInvoke(window.socialSetCalendarDaySheetOpen, true);
    hideLegacyCalendarPanelsFinal();
    safeInvoke(window.socialOpenCalendarDaySheet, safeDayKey);
    setTimeout(hideLegacyCalendarPanelsFinal, 40);
    normalizeCalendarHeaderFinal();
    return safeInvoke(originalShowDay, safeDayKey, { ...(options || {}), skipHistory: true });
  };

  const originalOpenRecordDetail = typeof window.socialOpenCalendarRecordDetail === "function"
    ? window.socialOpenCalendarRecordDetail
    : null;
  if (originalOpenRecordDetail && originalOpenRecordDetail.__seoWibeFinalWrapped !== true) {
    const wrapped = function wrappedOpenCalendarRecordDetailFinal() {
      const result = originalOpenRecordDetail.apply(this, arguments);
      setTimeout(() => {
        document.querySelectorAll("#socialModal [title]").forEach((node) => node.removeAttribute("title"));
        hideLegacyCalendarPanelsFinal();
      }, 0);
      return result;
    };
    wrapped.__seoWibeFinalWrapped = true;
    window.socialOpenCalendarRecordDetail = wrapped;
  }

  const originalOpenCalendarModal = typeof window.socialOpenCalendarModal === "function"
    ? window.socialOpenCalendarModal
    : null;
  if (originalOpenCalendarModal && originalOpenCalendarModal.__seoWibeFinalWrapped !== true) {
    const wrapped = function wrappedOpenCalendarModalFinal() {
      const result = originalOpenCalendarModal.apply(this, arguments);
      setTimeout(() => {
        document.querySelectorAll("#socialModal [title]").forEach((node) => node.removeAttribute("title"));
        hideLegacyCalendarPanelsFinal();
      }, 0);
      return result;
    };
    wrapped.__seoWibeFinalWrapped = true;
    window.socialOpenCalendarModal = wrapped;
  }

  const originalOpenQuickAdd = typeof window.socialOpenCalendarQuickAddMenu === "function"
    ? window.socialOpenCalendarQuickAddMenu
    : null;
  if (originalOpenQuickAdd && originalOpenQuickAdd.__seoWibeFinalWrapped !== true) {
    const wrapped = function wrappedOpenQuickAddFinal() {
      const result = originalOpenQuickAdd.apply(this, arguments);
      setTimeout(() => document.querySelectorAll("#socialModal [title]").forEach((node) => node.removeAttribute("title")), 0);
      return result;
    };
    wrapped.__seoWibeFinalWrapped = true;
    window.socialOpenCalendarQuickAddMenu = wrapped;
  }

  const originalOpenMonthPicker = typeof window.socialOpenCalendarMonthYearPicker === "function"
    ? window.socialOpenCalendarMonthYearPicker
    : null;
  if (originalOpenMonthPicker && originalOpenMonthPicker.__seoWibeFinalWrapped !== true) {
    const wrapped = function wrappedOpenMonthPickerFinal() {
      state().calendarMonthPickerOpen = true;
      const result = originalOpenMonthPicker.apply(this, arguments);
      setTimeout(() => document.querySelectorAll("#socialModal [title]").forEach((node) => node.removeAttribute("title")), 0);
      return result;
    };
    wrapped.__seoWibeFinalWrapped = true;
    window.socialOpenCalendarMonthYearPicker = wrapped;
  }

  const originalApplyMonthPicker = typeof window.socialApplyCalendarMonthYearPicker === "function"
    ? window.socialApplyCalendarMonthYearPicker
    : null;
  if (originalApplyMonthPicker && originalApplyMonthPicker.__seoWibeFinalWrapped !== true) {
    const wrapped = function wrappedApplyMonthPickerFinal() {
      const monthNode = document.getElementById("socialCalendarPickerMonth");
      const yearNode = document.getElementById("socialCalendarPickerYear");
      const month = Number(monthNode?.value);
      const year = Number(yearNode?.value);
      if (Number.isFinite(month) && Number.isFinite(year)) {
        if (typeof window.socialCalendarSetMonthYear === "function") {
          safeInvoke(window.socialCalendarSetMonthYear, year, month);
        } else {
          const base = state().calendarDate instanceof Date && !Number.isNaN(state().calendarDate.getTime())
            ? new Date(state().calendarDate.getTime())
            : new Date();
          base.setHours(12, 0, 0, 0);
          base.setDate(1);
          base.setFullYear(year, month, 1);
          state().calendarDate = base;
        }
      }
      state().calendarSelectedDay = "";
      closeMonthPickerFinal({ reload: true });
      return true;
    };
    wrapped.__seoWibeFinalWrapped = true;
    window.socialApplyCalendarMonthYearPicker = wrapped;
  }

  const originalCalendarBackLayer = typeof window.socialCalendarBackLayer === "function"
    ? window.socialCalendarBackLayer
    : null;
  window.socialCalendarBackLayer = function socialCalendarBackLayerFinal() {
    const stack = Array.isArray(state().calendarHistoryLayers) ? state().calendarHistoryLayers : [];
    if (stack.length && String(stack[stack.length - 1]?.layer || "").trim() === "month-picker") {
      closeMonthPickerFinal({ reload: true });
      return true;
    }
    if (isAppShell()) {
      if (!stack.length) {
        if (calendarMonthPickerVisibleFinal()) {
          closeMonthPickerFinal({ reload: true });
          return true;
        }
        if (calendarModalVisible()) {
          safeInvoke(originalCloseModalFinal, { force: true });
          finalizeCalendarChromeFinal();
          return true;
        }
        if (state().calendarDaySheetOpen) {
          safeInvoke(window.socialHideCalendarDaySheet, true);
          finalizeCalendarChromeFinal();
          return true;
        }
        return safeInvoke(originalCalendarBackLayer) || false;
      }
      stack.pop();
      const previous = stack.length ? stack[stack.length - 1] : null;
      state().calendarGestureStackActive = stack.length > 0;
      safeInvoke(originalCloseModalFinal, { force: true });
      safeInvoke(window.socialHideCalendarDaySheet, true);
      if (previous) {
        safeInvoke(window.socialCalendarRestoreHistoryLayer, previous);
      } else {
        state().calendarSelectedDay = "";
        finalizeCalendarChromeFinal();
      }
      setTimeout(finalizeCalendarChromeFinal, 0);
      return true;
    }
    if (calendarMonthPickerVisibleFinal()) {
      closeMonthPickerFinal({ reload: false });
      return true;
    }
    if (calendarModalVisible()) {
      safeInvoke(originalCloseModalFinal, { force: true });
      finalizeCalendarChromeFinal();
      return true;
    }
    if (state().calendarDaySheetOpen) {
      safeInvoke(window.socialHideCalendarDaySheet, true);
      finalizeCalendarChromeFinal();
      return true;
    }
    return safeInvoke(originalCalendarBackLayer) || false;
  };

  const originalRenderCalendar = typeof window.socialRenderCalendar === "function"
    ? window.socialRenderCalendar
    : null;
  if (originalRenderCalendar && originalRenderCalendar.__seoWibeFinalWrapped !== true) {
    const wrapped = function wrappedRenderCalendarFinal() {
      const result = originalRenderCalendar.apply(this, arguments);
      setTimeout(() => {
        finalizeCalendarChromeFinal();
        if (!hasCalendarDaysFinal()) {
          restoreCalendarGridFinal({ reload: false, attempt: 1 });
        }
      }, 0);
      return result;
    };
    wrapped.__seoWibeFinalWrapped = true;
    window.socialRenderCalendar = wrapped;
  }

  const originalLoadCalendar = typeof window.socialLoadCalendar === "function"
    ? window.socialLoadCalendar
    : null;
  if (originalLoadCalendar && originalLoadCalendar.__seoWibeFinalWrapped !== true) {
    const wrapped = async function wrappedLoadCalendarFinal() {
      const result = await originalLoadCalendar.apply(this, arguments);
      finalizeCalendarChromeFinal();
      if (!hasCalendarDaysFinal()) {
        setTimeout(() => restoreCalendarGridFinal({ reload: false, attempt: 1 }), 80);
      }
      return result;
    };
    wrapped.__seoWibeFinalWrapped = true;
    window.socialLoadCalendar = wrapped;
  }

  const originalRenderNotesList = typeof window.socialRenderNotesList === "function"
    ? window.socialRenderNotesList
    : null;
  if (originalRenderNotesList && originalRenderNotesList.__seoWibeFinalWrapped !== true) {
    const wrapped = function wrappedRenderNotesListFinal() {
      const result = originalRenderNotesList.apply(this, arguments);
      setTimeout(normalizeNotesFinal, 0);
      return result;
    };
    wrapped.__seoWibeFinalWrapped = true;
    window.socialRenderNotesList = wrapped;
  }

  const originalOpenNoteEditor = typeof window.socialOpenNoteEditor === "function"
    ? window.socialOpenNoteEditor
    : null;
  if (originalOpenNoteEditor && originalOpenNoteEditor.__seoWibeFinalWrapped !== true) {
    const wrapped = function wrappedOpenNoteEditorFinal() {
      const result = originalOpenNoteEditor.apply(this, arguments);
      setTimeout(paintNoteColorSwatchesFinal, 0);
      return result;
    };
    wrapped.__seoWibeFinalWrapped = true;
    window.socialOpenNoteEditor = wrapped;
  }

  const originalPickNoteColor = typeof window.socialPickNoteCoverColor === "function"
    ? window.socialPickNoteCoverColor
    : null;
  if (originalPickNoteColor && originalPickNoteColor.__seoWibeFinalWrapped !== true) {
    const wrapped = function wrappedPickNoteColorFinal() {
      const result = originalPickNoteColor.apply(this, arguments);
      setTimeout(() => {
        paintNoteColorSwatchesFinal();
        normalizeNotesFinal();
      }, 0);
      return result;
    };
    wrapped.__seoWibeFinalWrapped = true;
    window.socialPickNoteCoverColor = wrapped;
  }

  const originalCreateNote = typeof window.socialCreateNote === "function"
    ? window.socialCreateNote
    : null;
  if (originalCreateNote && originalCreateNote.__seoWibeFinalWrapped !== true) {
    const wrapped = async function wrappedCreateNoteFinal() {
      const result = await originalCreateNote.apply(this, arguments);
      setTimeout(normalizeNotesFinal, 0);
      return result;
    };
    wrapped.__seoWibeFinalWrapped = true;
    window.socialCreateNote = wrapped;
  }

  const originalRenderTasks = typeof window.socialRenderTasks === "function"
    ? window.socialRenderTasks
    : null;
  if (originalRenderTasks && originalRenderTasks.__seoWibeFinalWrapped !== true) {
    const wrapped = function wrappedRenderTasksFinal() {
      const result = originalRenderTasks.apply(this, arguments);
      setTimeout(normalizeTasksFinal, 0);
      return result;
    };
    wrapped.__seoWibeFinalWrapped = true;
    window.socialRenderTasks = wrapped;
  }

  const enableBehaviorOverridesFinal = false;
  if (!enableBehaviorOverridesFinal) {
    if (originalNotificationRender) window.socialRenderNotificationCenter = originalNotificationRender;
    if (originalNotificationToggle) window.socialToggleNotificationCenter = originalNotificationToggle;
    if (originalCloseModalFinal) window.socialCloseModal = originalCloseModalFinal;
    if (originalOpenCalendarDaySheet) {
      window.socialOpenCalendarDaySheet = originalOpenCalendarDaySheet;
      window.socialForceOpenCalendarDaySheet = originalOpenCalendarDaySheet;
    }
    if (originalShowDay) window.socialShowDay = originalShowDay;
    if (originalOpenRecordDetail) window.socialOpenCalendarRecordDetail = originalOpenRecordDetail;
    if (originalOpenCalendarModal) window.socialOpenCalendarModal = originalOpenCalendarModal;
    if (originalOpenQuickAdd) window.socialOpenCalendarQuickAddMenu = originalOpenQuickAdd;
    if (originalOpenMonthPicker) window.socialOpenCalendarMonthYearPicker = originalOpenMonthPicker;
    if (originalApplyMonthPicker) window.socialApplyCalendarMonthYearPicker = originalApplyMonthPicker;
    if (originalCalendarBackLayer) window.socialCalendarBackLayer = originalCalendarBackLayer;
    if (originalRenderCalendar) window.socialRenderCalendar = originalRenderCalendar;
    if (originalLoadCalendar) window.socialLoadCalendar = originalLoadCalendar;
  }

  const refreshAllFinal = () => {
    if (enableBehaviorOverridesFinal) {
      bindBellButtonsFinal();
    }
    normalizeNotificationCenterFinal();
    if (!disableTextBehaviorOverrides) {
      normalizeCalendarHeaderFinal();
    }
    if (enableBehaviorOverridesFinal) {
      bindCalendarMonthSwipeFinal();
      bindCalendarBackGestureFinal();
    }
    if (!disableTextBehaviorOverrides) {
      hideLegacyCalendarPanelsFinal();
    }
    normalizeNotesFinal();
    normalizeTasksFinal();
    paintNoteColorSwatchesFinal();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", refreshAllFinal, { once: true });
  } else {
    refreshAllFinal();
  }

  window.addEventListener("resize", refreshAllFinal);
  setTimeout(refreshAllFinal, 100);
  setTimeout(refreshAllFinal, 450);
  setTimeout(refreshAllFinal, 1200);
})();

(() => {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.__seoWibeCalendarBellHotfixV20260330) return;
  window.__seoWibeCalendarBellHotfixV20260330 = true;
  if (window.__seoWibeDisableTextBehaviorOverrides === true) return;

  const safeInvoke = (fn, ...args) => {
    try {
      if (typeof fn === "function") return fn(...args);
    } catch (_) {}
    return undefined;
  };

  const decodeText = (value) => {
    let out = String(value == null ? "" : value);
    try { out = String(window.socialDecodeUiText ? (window.socialDecodeUiText(out) || out) : out); } catch (_) {}
    try { out = String(window.socialNormalizeDecodedText ? (window.socialNormalizeDecodedText(out) || out) : out); } catch (_) {}
    try { out = String(window.decodePossiblyMojibake ? (window.decodePossiblyMojibake(out) || out) : out); } catch (_) {}
    try { out = String(window.__repairMojibakeText ? (window.__repairMojibakeText(out) || out) : out); } catch (_) {}
    return out.replace(/[\u0000-\u001F\u007F-\u009F]+/g, " ").replace(/\s{2,}/g, " ").trim();
  };

  const meaningfulText = (value) => {
    const text = decodeText(value);
    if (!text) return "";
    if (/^(true|false|null|none|undefined|nan)$/i.test(text)) return "";
    const compact = text.replace(/\s+/g, "");
    if (compact && /^[\d:.\-+/()]+$/.test(compact)) return "";
    if (!/[A-Za-zА-Яа-яЁё]/.test(text)) return "";
    return text;
  };

  const textPenalty = (value) => (String(value || "").match(/[\u0420\u0421\u0412\u00d0\u00d1]/g) || []).length;

  const pickText = (items, fallback = "") => {
    const variants = (Array.isArray(items) ? items : [])
      .map((value) => meaningfulText(value))
      .filter(Boolean);
    if (!variants.length) return decodeText(fallback);
    return variants.sort((left, right) => {
      const leftScore = textPenalty(left);
      const rightScore = textPenalty(right);
      if (leftScore !== rightScore) return leftScore - rightScore;
      return left.length - right.length;
    })[0];
  };

  const kindLabel = (kind) => {
    const code = String(kind || "").trim().toLowerCase();
    if (code.includes("chat_reaction")) return window.tr ? window.tr("\u041d\u043e\u0432\u0430\u044f \u0440\u0435\u0430\u043a\u0446\u0438\u044f", "New reaction") : "New reaction";
    if (code.includes("chat")) return window.tr ? window.tr("\u041d\u043e\u0432\u043e\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435", "New message") : "New message";
    if (code.includes("task")) return window.tr ? window.tr("\u0417\u0430\u0434\u0430\u0447\u0438", "Tasks") : "Tasks";
    if (code.includes("calendar") || code.includes("event") || code.includes("reminder")) {
      return window.tr ? window.tr("\u041a\u0430\u043b\u0435\u043d\u0434\u0430\u0440\u044c", "Calendar") : "Calendar";
    }
    return window.tr ? window.tr("\u0423\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u0435", "Notification") : "Notification";
  };

  const resolveNotificationTextHotfix = (row) => {
    const source = row && typeof row === "object" ? row : {};
    const payload = source.payload && typeof source.payload === "object" ? source.payload : {};
    const code = String(source.kind || payload.kind || "").trim().toLowerCase();
    const title = pickText([
      source.display_title,
      source.notification_title,
      source.title,
      source.subject,
      payload.display_title,
      payload.notification_title,
      payload.display_kind,
      payload.title,
      payload.subject,
      payload.chat_title,
      payload.thread_title,
      payload.sender_name,
      source.kind_label,
    ], kindLabel(code)) || kindLabel(code);
    let body = pickText([
      source.display_body,
      source.notification_body,
      source.body,
      source.text,
      source.preview,
      source.message,
      source.subtitle,
      payload.display_body,
      payload.notification_body,
      payload.body,
      payload.text,
      payload.message,
      payload.preview_text,
      payload.preview,
      payload.content,
      payload.snippet,
      payload.note,
      payload.description,
    ], "");
    if (!body && code.includes("chat")) {
      const sender = pickText([
        payload.sender_nick,
        payload.sender_name,
        payload.actor_nick,
        payload.author,
      ], "");
      const preview = pickText([
        payload.preview_text,
        payload.preview,
        payload.text,
        payload.message,
        source.preview,
        source.text,
        source.message,
      ], "");
      body = [sender, preview].filter(Boolean).join(": ");
    }
    return {
      title: title || kindLabel(code),
      body: body || (window.tr ? window.tr("\u0411\u0435\u0437 \u0442\u0435\u043a\u0441\u0442\u0430", "No text") : "No text"),
    };
  };

  const normalizeNotificationCenterHotfix = () => {
    const center = document.getElementById("socialNotificationCenter");
    const rows = Array.isArray(window.socialState?.notificationRows) ? window.socialState.notificationRows : [];
    if (!center) return;
    center.querySelectorAll("[title]").forEach((node) => {
      try { node.removeAttribute("title"); } catch (_) {}
    });
    center.querySelectorAll(".social-notif-item").forEach((item, index) => {
      const id = Number(item.getAttribute("data-notif-id") || 0);
      const row = rows.find((entry) => Number(entry?.id || 0) === id) || null;
      const text = resolveNotificationTextHotfix(row);
      const titleNode = item.querySelector(".social-notif-item-head b");
      const bodyNode = item.querySelector("p");
      if (titleNode) titleNode.textContent = text.title;
      if (bodyNode) bodyNode.textContent = text.body;
    });
  };

  const originalResolveNotificationText = typeof window.socialResolveNotificationText === "function"
    ? window.socialResolveNotificationText
    : null;
  if (originalResolveNotificationText && originalResolveNotificationText.__seoWibeHotfixWrappedV20260330 !== true) {
    window.socialResolveNotificationText = function socialResolveNotificationTextHotfixV20260330(row) {
      const base = safeInvoke(originalResolveNotificationText, row) || {};
      const resolved = resolveNotificationTextHotfix({
        ...(row && typeof row === "object" ? row : {}),
        title: base.title || row?.title || "",
        body: base.body || row?.body || "",
      });
      return {
        ...base,
        title: resolved.title,
        body: resolved.body,
      };
    };
    window.socialResolveNotificationText.__seoWibeHotfixWrappedV20260330 = true;
  }

  const originalLoadNotificationRows = typeof window.socialLoadNotificationCenterRows === "function"
    ? window.socialLoadNotificationCenterRows
    : null;
  if (originalLoadNotificationRows && originalLoadNotificationRows.__seoWibeHotfixWrappedV20260330 !== true) {
    window.socialLoadNotificationCenterRows = async function socialLoadNotificationCenterRowsHotfixV20260330() {
      const rows = await Promise.resolve(originalLoadNotificationRows.apply(this, arguments)).catch(() => []);
      const normalized = Array.isArray(rows) ? rows.map((row) => {
        const text = resolveNotificationTextHotfix(row);
        return {
          ...(row && typeof row === "object" ? row : {}),
          title: String(text.title || "").trim(),
          body: String(text.body || "").trim(),
        };
      }) : [];
      if (window.socialState && typeof window.socialState === "object") {
        window.socialState.notificationRows = normalized;
      }
      return normalized;
    };
    window.socialLoadNotificationCenterRows.__seoWibeHotfixWrappedV20260330 = true;
  }

  const originalRenderNotificationCenter = typeof window.socialRenderNotificationCenter === "function"
    ? window.socialRenderNotificationCenter
    : null;
  if (originalRenderNotificationCenter && originalRenderNotificationCenter.__seoWibeHotfixWrappedV20260330 !== true) {
    window.socialRenderNotificationCenter = function socialRenderNotificationCenterHotfixV20260330() {
      const result = originalRenderNotificationCenter.apply(this, arguments);
      setTimeout(normalizeNotificationCenterHotfix, 0);
      setTimeout(normalizeNotificationCenterHotfix, 120);
      return result;
    };
    window.socialRenderNotificationCenter.__seoWibeHotfixWrappedV20260330 = true;
  }

  const monthPickerVisible = () => Boolean(document.querySelector("#socialModal:not(.hidden) .social-calendar-month-year-modal"));

  const trimMonthPickerHistory = () => {
    const stack = Array.isArray(window.socialState?.calendarHistoryLayers) ? window.socialState.calendarHistoryLayers : [];
    if (stack.length && String(stack[stack.length - 1]?.layer || "").trim() === "month-picker") {
      stack.pop();
    }
    if (window.socialState && typeof window.socialState === "object") {
      window.socialState.calendarGestureStackActive = stack.length > 0;
    }
  };

  const calendarHasDays = () => Boolean(document.querySelector("#socialCalendarGrid .social-day[data-day-key]"));

  const refreshCalendarViewportHotfix = (reload = false) => {
    safeInvoke(window.socialNormalizeCalendarChrome);
    safeInvoke(window.socialEnsureCalendarNavigation);
    safeInvoke(window.socialSyncCalendarMonthYearInputs);
    safeInvoke(window.socialEnsureCalendarFab);
    safeInvoke(window.socialHideCalendarLegacyDetails);
    safeInvoke(window.socialEnsureCalendarDaySheetNodes);
    safeInvoke(window.socialRenderCalendar);
    safeInvoke(window.socialBindCalendarSwipe);
    if (!reload && calendarHasDays()) {
      return;
    }
    Promise.resolve(
      typeof window.socialLoadCalendar === "function"
        ? window.socialLoadCalendar({ preserveSelection: true, silent: false })
        : null
    ).catch(() => null).finally(() => {
      setTimeout(() => {
        safeInvoke(window.socialRenderCalendar);
        safeInvoke(window.socialBindCalendarSwipe);
      }, 0);
    });
  };

  const originalCloseModal = typeof window.socialCloseModal === "function"
    ? window.socialCloseModal
    : null;
  if (originalCloseModal && originalCloseModal.__seoWibeHotfixWrappedV20260330 !== true) {
    window.socialCloseModal = function socialCloseModalHotfixV20260330(evt = null) {
      const forced = Boolean(evt && typeof evt === "object" && evt.force === true);
      const wasMonthPicker = monthPickerVisible();
      if (!forced && wasMonthPicker) {
        trimMonthPickerHistory();
        safeInvoke(originalCloseModal, { force: true });
        safeInvoke(window.socialHideCalendarDaySheet, true);
        setTimeout(() => refreshCalendarViewportHotfix(false), 0);
        return;
      }
      const result = originalCloseModal.apply(this, arguments);
      if (wasMonthPicker) {
        setTimeout(() => refreshCalendarViewportHotfix(false), 0);
      }
      return result;
    };
    window.socialCloseModal.__seoWibeHotfixWrappedV20260330 = true;
  }

  const originalApplyMonthYearPicker = typeof window.socialApplyCalendarMonthYearPicker === "function"
    ? window.socialApplyCalendarMonthYearPicker
    : null;
  if (originalApplyMonthYearPicker && originalApplyMonthYearPicker.__seoWibeHotfixWrappedV20260330 !== true) {
    window.socialApplyCalendarMonthYearPicker = function socialApplyCalendarMonthYearPickerHotfixV20260330() {
      const monthNode = document.getElementById("socialCalendarPickerMonth");
      const yearNode = document.getElementById("socialCalendarPickerYear");
      const month = Number(monthNode?.value || 0);
      const year = Number(yearNode?.value || 0);
      if (Number.isFinite(month) && Number.isFinite(year)) {
        safeInvoke(window.socialCalendarSetMonthYear, year, month);
      }
      trimMonthPickerHistory();
      safeInvoke(window.socialCloseModal, { force: true });
      safeInvoke(window.socialHideCalendarDaySheet, true);
      setTimeout(() => refreshCalendarViewportHotfix(true), 0);
    };
    window.socialApplyCalendarMonthYearPicker.__seoWibeHotfixWrappedV20260330 = true;
  }

  const originalCalendarRestore = typeof window.socialCalendarRestoreHistoryLayer === "function"
    ? window.socialCalendarRestoreHistoryLayer
    : null;
  if (originalCalendarRestore && originalCalendarRestore.__seoWibeHotfixWrappedV20260330 !== true) {
    window.socialCalendarRestoreHistoryLayer = function socialCalendarRestoreHistoryLayerHotfixV20260330(entry) {
      const result = originalCalendarRestore.apply(this, arguments);
      if (!entry || typeof entry !== "object") {
        setTimeout(() => refreshCalendarViewportHotfix(false), 0);
      }
      return result;
    };
    window.socialCalendarRestoreHistoryLayer.__seoWibeHotfixWrappedV20260330 = true;
  }

  const originalShiftCalendar = typeof window.socialShiftCalendar === "function"
    ? window.socialShiftCalendar
    : null;
  if (originalShiftCalendar && originalShiftCalendar.__seoWibeHotfixWrappedV20260330 !== true) {
    window.socialShiftCalendar = function socialShiftCalendarHotfixV20260330() {
      const result = originalShiftCalendar.apply(this, arguments);
      setTimeout(() => refreshCalendarViewportHotfix(false), 0);
      return result;
    };
    window.socialShiftCalendar.__seoWibeHotfixWrappedV20260330 = true;
  }

  document.addEventListener("click", (event) => {
    const bellBtn = event.target?.closest?.("#socialBellBtn, #mobileDrawerBellBtn");
    if (bellBtn) {
      setTimeout(normalizeNotificationCenterHotfix, 0);
      setTimeout(normalizeNotificationCenterHotfix, 120);
      return;
    }
    const monthLabel = event.target?.closest?.("#socialCalendarMonthLabel");
    if (monthLabel) {
      setTimeout(() => refreshCalendarViewportHotfix(false), 120);
    }
  }, true);

  window.addEventListener("popstate", () => {
    setTimeout(() => {
      if (!monthPickerVisible()) {
        refreshCalendarViewportHotfix(false);
      }
      normalizeNotificationCenterHotfix();
    }, 0);
  });

  setTimeout(() => {
    normalizeNotificationCenterHotfix();
    refreshCalendarViewportHotfix(false);
  }, 0);
  setTimeout(() => {
    normalizeNotificationCenterHotfix();
    refreshCalendarViewportHotfix(false);
  }, 180);
})();

(() => {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.__seoWibeDisableBellRuntimeFinalV20260331 !== false) return;
  const decodeText = (value) => {
    const raw = String(value == null ? "" : value);
    if (!raw) return "";
    try {
      if (typeof window.decodePossiblyMojibake === "function") {
        return String(window.decodePossiblyMojibake(raw) || raw);
      }
    } catch (_) {}
    return raw;
  };

  const cleanText = (value) => decodeText(value).replace(/[\u0000-\u001F\u007F-\u009F]+/g, " ").replace(/\s{2,}/g, " ").trim();

  const meaningfulText = (value) => {
    const text = cleanText(value);
    if (!text) return "";
    if (/^(true|false|null|none|undefined|nan)$/i.test(text)) return "";
    const compact = text.replace(/\s+/g, "");
    if (compact && /^[\d:.\-+/()]+$/.test(compact)) return "";
    if (!/[A-Za-zА-Яа-яЁё]/.test(text)) return "";
    return text;
  };

  const pickText = (items, fallback = "") => {
    const variants = (Array.isArray(items) ? items : [])
      .map((value) => meaningfulText(value))
      .filter(Boolean);
    if (!variants.length) return cleanText(fallback);
    return variants.sort((left, right) => {
      const leftScore = (left.match(/[\u0420\u0421\u0412\u00d0\u00d1]/g) || []).length;
      const rightScore = (right.match(/[\u0420\u0421\u0412\u00d0\u00d1]/g) || []).length;
      if (leftScore !== rightScore) return leftScore - rightScore;
      return left.length - right.length;
    })[0];
  };

  const kindLabel = (kind) => {
    const code = String(kind || "").trim().toLowerCase();
    if (code.includes("chat_reaction")) return window.tr ? window.tr("Новая реакция", "New reaction") : "New reaction";
    if (code.includes("chat")) return window.tr ? window.tr("Новое сообщение", "New message") : "New message";
    if (code.includes("task")) return window.tr ? window.tr("Задачи", "Tasks") : "Tasks";
    if (code.includes("calendar") || code.includes("event") || code.includes("reminder")) {
      return window.tr ? window.tr("Календарь", "Calendar") : "Calendar";
    }
    return window.tr ? window.tr("Уведомление", "Notification") : "Notification";
  };

  const resolveNotificationTextBellFinal = (row) => {
    const source = row && typeof row === "object" ? row : {};
    const payload = source.payload && typeof source.payload === "object" ? source.payload : {};
    const code = String(source.kind || payload.kind || "").trim().toLowerCase();
    const title = pickText([
      source.display_title,
      source.notification_title,
      source.title,
      source.subject,
      source.summary,
      payload.display_title,
      payload.notification_title,
      payload.display_kind,
      payload.title,
      payload.subject,
      payload.summary,
      payload.chat_title,
      payload.chat_name,
      payload.thread_title,
      payload.thread_name,
      payload.event_title,
      payload.task_title,
      payload.announcement_title,
      payload.sender_name,
      payload.sender_nick,
      payload.actor_nick,
      payload.author,
    ], kindLabel(code)) || kindLabel(code);
    let body = pickText([
      source.display_body,
      source.notification_body,
      source.body,
      source.text,
      source.preview,
      source.message,
      source.subtitle,
      payload.display_body,
      payload.notification_body,
      payload.body,
      payload.preview,
      payload.preview_text,
      payload.message_text,
      payload.text,
      payload.message,
      payload.content,
      payload.snippet,
      payload.note,
      payload.description,
      payload.task_description,
      payload.event_description,
    ], "");
    if (!body && code.includes("chat")) {
      const sender = pickText([
        payload.sender_nick,
        payload.sender_name,
        payload.actor_nick,
        payload.author,
      ], "");
      const preview = pickText([
        payload.preview_text,
        payload.preview,
        payload.message_text,
        payload.text,
        payload.message,
        source.preview,
        source.text,
        source.message,
      ], "");
      body = [sender, preview].filter(Boolean).join(": ");
    }
    if (!body) {
      body = window.tr ? window.tr("Без текста", "No text") : "No text";
    }
    return { title, body };
  };

  const normalizeRows = (rows) => (Array.isArray(rows) ? rows : []).map((row) => {
    const text = resolveNotificationTextBellFinal(row);
    return {
      ...(row && typeof row === "object" ? row : {}),
      title: String(text.title || "").trim(),
      body: String(text.body || "").trim(),
      display_title: String(text.title || "").trim(),
      display_body: String(text.body || "").trim(),
    };
  });

  const normalizeCenterDom = () => {
    const center = document.getElementById("socialNotificationCenter");
    const rows = Array.isArray(window.socialState?.notificationRows) ? window.socialState.notificationRows : [];
    if (!center) return;
    center.querySelectorAll("[title]").forEach((node) => {
      try { node.removeAttribute("title"); } catch (_) {}
    });
    center.querySelectorAll(".social-notif-item").forEach((item, index) => {
      const id = Number(item.getAttribute("data-notif-id") || 0);
      const row = rows.find((entry) => Number(entry?.id || 0) === id) || null;
      const text = resolveNotificationTextBellFinal(row);
      const titleNode = item.querySelector(".social-notif-item-head b");
      const bodyNode = item.querySelector("p");
      if (titleNode) titleNode.textContent = text.title;
      if (bodyNode) bodyNode.textContent = text.body;
    });
  };

  const previousResolve = typeof window.socialResolveNotificationText === "function"
    ? window.socialResolveNotificationText
    : null;
  const previousLoad = typeof window.socialLoadNotificationCenterRows === "function"
    ? window.socialLoadNotificationCenterRows
    : null;
  const previousRender = typeof window.socialRenderNotificationCenter === "function"
    ? window.socialRenderNotificationCenter
    : null;

  window.socialResolveNotificationText = function socialResolveNotificationTextBellFinalRuntime(row) {
    const base = previousResolve ? previousResolve.call(this, row) : {};
    const resolved = resolveNotificationTextBellFinal({
      ...(row && typeof row === "object" ? row : {}),
      title: base?.title || row?.title || "",
      body: base?.body || row?.body || "",
      display_title: row?.display_title || base?.title || "",
      display_body: row?.display_body || base?.body || "",
    });
    return {
      ...(base && typeof base === "object" ? base : {}),
      title: resolved.title,
      body: resolved.body,
    };
  };
  window.socialResolveNotificationText.__seoWibeBellFinalV20260331 = true;

  window.socialLoadNotificationCenterRows = async function socialLoadNotificationCenterRowsBellFinalRuntime() {
    const rows = previousLoad ? await Promise.resolve(previousLoad.apply(this, arguments)).catch(() => []) : [];
    const normalized = normalizeRows(rows);
    if (window.socialState && typeof window.socialState === "object") {
      window.socialState.notificationRows = normalized;
    }
    return normalized;
  };
  window.socialLoadNotificationCenterRows.__seoWibeBellFinalV20260331 = true;

  window.socialRenderNotificationCenter = function socialRenderNotificationCenterBellFinalRuntime() {
    const result = previousRender ? previousRender.apply(this, arguments) : null;
    setTimeout(normalizeCenterDom, 0);
    setTimeout(normalizeCenterDom, 120);
    setTimeout(normalizeCenterDom, 260);
    return result;
  };
  window.socialRenderNotificationCenter.__seoWibeBellFinalV20260331 = true;

  window.socialToggleNotificationCenter = async function socialToggleNotificationCenterBellFinalRuntime(forceOpen = null) {
    const center = typeof window.socialRenderNotificationCenter === "function"
      ? window.socialRenderNotificationCenter()
      : document.getElementById("socialNotificationCenter");
    if (!center) return false;
    const shouldOpen = typeof forceOpen === "boolean"
      ? forceOpen
      : center.classList.contains("hidden") || center.style.display === "none";
    if (!shouldOpen) {
      if (window.socialState && typeof window.socialState === "object") {
        window.socialState.notificationCenterOpen = false;
      }
      center.classList.add("hidden");
      center.style.display = "none";
      return false;
    }
    const rows = await Promise.resolve(window.socialLoadNotificationCenterRows()).catch(() => []);
    if (window.socialState && typeof window.socialState === "object") {
      window.socialState.notificationCenterOpen = true;
      window.socialState.notificationRows = normalizeRows(rows);
    }
    if (typeof window.socialRenderNotificationCenter === "function") {
      window.socialRenderNotificationCenter(window.socialState?.notificationRows || rows);
    }
    center.classList.remove("hidden");
    center.style.display = "flex";
    setTimeout(normalizeCenterDom, 0);
    setTimeout(normalizeCenterDom, 120);
    setTimeout(normalizeCenterDom, 260);
    return true;
  };
  window.socialToggleNotificationCenter.__seoWibeBellFinalV20260331 = true;

  const bindBellButtonsFinal = () => {
    ["socialBellBtn", "mobileDrawerBellBtn"].forEach((id) => {
      const original = document.getElementById(id);
      if (!original) return;
      if (original.dataset.seoWibeBellBoundV20260331 === "1") return;
      original.dataset.seoWibeBellOwnerV20260331 = "1";
      original.dataset.seoWibeBellBoundV20260331 = "1";
      original.removeAttribute("onclick");
      original.removeAttribute("title");
      original.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === "function") {
          event.stopImmediatePropagation();
        }
        const center = document.getElementById("socialNotificationCenter");
        const shouldOpen = !center || center.classList.contains("hidden") || center.style.display === "none";
        await Promise.resolve(window.socialToggleNotificationCenter(shouldOpen)).catch(() => false);
        if (id === "mobileDrawerBellBtn" && typeof window.closeMobileNav === "function") {
          try { window.closeMobileNav(); } catch (_) {}
        }
      }, true);
    });
  };

  window.socialBindBellButtonsNow = bindBellButtonsFinal;

  const scheduleBellRefresh = () => {
    bindBellButtonsFinal();
    normalizeCenterDom();
  };

  document.addEventListener("click", (event) => {
    const bellBtn = event.target?.closest?.("#socialBellBtn, #mobileDrawerBellBtn");
    if (!bellBtn) return;
    setTimeout(scheduleBellRefresh, 0);
    setTimeout(scheduleBellRefresh, 160);
  }, true);

  window.addEventListener("popstate", () => {
    setTimeout(scheduleBellRefresh, 0);
  });

  setTimeout(scheduleBellRefresh, 0);
  setTimeout(scheduleBellRefresh, 220);
})();

(() => {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.__seoWibeRuntimeRestoreFromSocialV20260402) return;
  window.__seoWibeRuntimeRestoreFromSocialV20260402 = true;
  if (window.__seoWibeDisableTextBehaviorOverrides !== true) return;
  const restore = window.__seoWibeRestoreStableSocialRuntimeV20260402;
  if (typeof restore !== "function") return;
  try {
    restore();
    if (typeof window.socialBindBellButtonsNow === "function") {
      window.socialBindBellButtonsNow();
    }
    if (typeof window.socialBindCalendarSwipe === "function") {
      window.socialBindCalendarSwipe();
    }
  } catch (_) {}
})();

(() => {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.__seoWibeBellCalendarFinalV20260402c) return;
  window.__seoWibeBellCalendarFinalV20260402c = true;

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

  const looksBrokenText = (value) => {
    const text = decodeSafe(value);
    if (!text) return true;
    if (/^\d+$/.test(text)) return true;
    if (/[�]/.test(text)) return true;
    if (/(?:Р.|Ð.|Ñ.)/.test(text)) return true;
    return false;
  };

  const firstUsefulText = (...values) => {
    for (const value of values) {
      const text = decodeSafe(value);
      if (!text) continue;
      if (looksBrokenText(text)) continue;
      return text;
    }
    return "";
  };

  const normalizeNotificationRows = (rows) => {
    if (!Array.isArray(rows)) return [];
    return rows.map((row) => {
      const safeRow = row && typeof row === "object" ? row : {};
      const payload = safeRow.payload && typeof safeRow.payload === "object" ? safeRow.payload : {};
      const title = firstUsefulText(
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
        safeRow.kind === "chat" ? "Новое сообщение" : "",
        safeRow.kind && String(safeRow.kind).includes("task") ? "Задачи" : "",
        "Уведомление"
      );
      const body = firstUsefulText(
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
        safeRow.title
      );
      return {
        ...safeRow,
        title,
        body: body || title,
      };
    });
  };

  const isCenterOpen = () => {
    const center = document.getElementById("socialNotificationCenter");
    return Boolean(center && !center.classList.contains("hidden") && center.style.display !== "none");
  };

  const normalizeCenterDom = () => {
    const center = document.getElementById("socialNotificationCenter");
    if (!center) return null;
    center.querySelectorAll(".social-notif-item b, .social-notif-item p").forEach((node) => {
      const before = String(node.textContent || "");
      const after = decodeSafe(before);
      if (after && after !== before) {
        node.textContent = after;
      }
    });
    return center;
  };

  const bindBellButtonFlags = () => {
    ["socialBellBtn", "mobileDrawerBellBtn"].forEach((id) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.removeAttribute("title");
      btn.removeAttribute("onclick");
      try { btn.onclick = null; } catch (_) {}
      try { delete btn.dataset.finalBellBind; } catch (_) { btn.dataset.finalBellBind = ""; }
      try { delete btn.dataset.seoWibeBellBoundV20260331; } catch (_) { btn.dataset.seoWibeBellBoundV20260331 = ""; }
      try { delete btn.dataset.seoWibeBellOwnerV20260331; } catch (_) { btn.dataset.seoWibeBellOwnerV20260331 = ""; }
      try { delete btn.dataset.seoWibeBellBound; } catch (_) { btn.dataset.seoWibeBellBound = ""; }
    });
  };

  const toggleNotificationCenterStable = async (forceOpen = null) => {
    bindBellButtonFlags();
    let center = document.getElementById("socialNotificationCenter");
    if (!center && typeof window.socialRenderNotificationCenter === "function") {
      center = window.socialRenderNotificationCenter() || document.getElementById("socialNotificationCenter");
    }
    if (!center) return false;
    const shouldOpen = typeof forceOpen === "boolean" ? forceOpen : !isCenterOpen();
    if (!shouldOpen) {
      if (window.socialState && typeof window.socialState === "object") {
        window.socialState.notificationCenterOpen = false;
      }
      center.classList.add("hidden");
      center.style.display = "none";
      return false;
    }
    let rows = [];
    try {
      if (typeof window.socialLoadNotificationCenterRows === "function") {
        rows = await Promise.resolve(window.socialLoadNotificationCenterRows());
      }
    } catch (_) {
      rows = [];
    }
    rows = normalizeNotificationRows(
      Array.isArray(window.socialState?.notificationRows) && window.socialState.notificationRows.length
        ? window.socialState.notificationRows
        : rows
    );
    if (window.socialState && typeof window.socialState === "object") {
      window.socialState.notificationCenterOpen = true;
      window.socialState.notificationRows = rows;
    }
    if (typeof window.socialRenderNotificationCenter === "function") {
      center = window.socialRenderNotificationCenter(rows) || document.getElementById("socialNotificationCenter") || center;
    }
    center.classList.remove("hidden");
    center.style.display = "flex";
    try {
      if (typeof window.socialEnsureNotificationCenterLayout === "function") {
        window.socialEnsureNotificationCenterLayout(center);
      }
    } catch (_) {}
    setTimeout(normalizeCenterDom, 0);
    setTimeout(normalizeCenterDom, 120);
    return true;
  };

  window.socialToggleNotificationCenter = toggleNotificationCenterStable;

  const recoverCalendarGrid = () => {
    const root = document.getElementById("socialSubtabCalendar");
    if (!root) return;
    root.classList.remove("sw-calendar-awaiting-data");
    const grid = document.getElementById("socialCalendarGrid");
    if (grid) {
      grid.style.removeProperty("display");
      grid.style.removeProperty("visibility");
      grid.style.removeProperty("opacity");
    }
    try {
      if (typeof window.socialHideCalendarLegacyDetails === "function") {
        window.socialHideCalendarLegacyDetails();
      }
    } catch (_) {}
  };

  const bindBellCapture = () => {
    if (window.__seoWibeBellCaptureV20260402d === true) return;
    window.__seoWibeBellCaptureV20260402d = true;
    let lastBellAt = 0;
    const handleBell = async (event) => {
      const bellBtn = event.target?.closest?.("#socialBellBtn, #mobileDrawerBellBtn");
      if (!bellBtn) return;
      const now = Date.now();
      if (now - lastBellAt < 180) return;
      lastBellAt = now;
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") {
        event.stopImmediatePropagation();
      }
      bindBellButtonFlags();
      if (bellBtn.id === "mobileDrawerBellBtn" && typeof window.closeMobileNav === "function") {
        try { window.closeMobileNav(); } catch (_) {}
      }
      await toggleNotificationCenterStable(true);
      setTimeout(normalizeCenterDom, 0);
      setTimeout(normalizeCenterDom, 120);
    };
    window.addEventListener("pointerup", handleBell, { capture: true, passive: false });
    window.addEventListener("touchend", handleBell, { capture: true, passive: false });
    window.addEventListener("click", handleBell, { capture: true, passive: false });
  };

  const bindCalendarSwipeCapture = () => {
    if (window.__seoWibeCalendarSwipeCaptureV20260402d === true) return;
    window.__seoWibeCalendarSwipeCaptureV20260402d = true;
    const swipeState = { active: false, x: 0, y: 0, pointerId: null };
    const canSwipeCalendar = (target) => {
      if (!target?.closest?.("#socialCalendarGrid, #socialSubtabCalendar")) return false;
      if (target.closest?.("#socialModal, #socialCalendarDaySheet, .social-calendar-day-sheet, .social-calendar-month-year-modal, #socialNotificationCenter")) {
        return false;
      }
      return true;
    };
    const tryShift = (dx, dy, event) => {
      if (Math.abs(dx) < 42 || Math.abs(dx) <= Math.abs(dy) + 8) return;
      const lastShift = Number(window.socialState?.calendarShiftStampV20260327c || 0);
      if (Date.now() - lastShift < 220) return;
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") {
        event.stopImmediatePropagation();
      }
      recoverCalendarGrid();
      if (typeof window.socialShiftCalendar === "function") {
        window.socialShiftCalendar(dx > 0 ? -1 : 1);
      }
      setTimeout(recoverCalendarGrid, 0);
      setTimeout(recoverCalendarGrid, 140);
    };
    window.addEventListener("touchstart", (event) => {
      const touch = event.changedTouches?.[0];
      if (!touch || !canSwipeCalendar(event.target)) {
        swipeState.active = false;
        return;
      }
      swipeState.active = true;
      swipeState.x = Number(touch.clientX || 0);
      swipeState.y = Number(touch.clientY || 0);
    }, { capture: true, passive: true });
    window.addEventListener("touchend", (event) => {
      if (!swipeState.active) return;
      swipeState.active = false;
      const touch = event.changedTouches?.[0];
      if (!touch) return;
      tryShift(Number(touch.clientX || 0) - Number(swipeState.x || 0), Number(touch.clientY || 0) - Number(swipeState.y || 0), event);
    }, { capture: true, passive: false });
    window.addEventListener("touchcancel", () => {
      swipeState.active = false;
    }, { capture: true, passive: true });
    window.addEventListener("pointerdown", (event) => {
      if (!event?.isPrimary) return;
      if (String(event.pointerType || "").toLowerCase() === "mouse") return;
      if (!canSwipeCalendar(event.target)) {
        swipeState.active = false;
        return;
      }
      swipeState.active = true;
      swipeState.pointerId = event.pointerId;
      swipeState.x = Number(event.clientX || 0);
      swipeState.y = Number(event.clientY || 0);
    }, { capture: true, passive: true });
    window.addEventListener("pointerup", (event) => {
      if (!swipeState.active || !event?.isPrimary) return;
      if (swipeState.pointerId != null && event.pointerId !== swipeState.pointerId) return;
      if (String(event.pointerType || "").toLowerCase() === "mouse") {
        swipeState.active = false;
        return;
      }
      swipeState.active = false;
      tryShift(Number(event.clientX || 0) - Number(swipeState.x || 0), Number(event.clientY || 0) - Number(swipeState.y || 0), event);
    }, { capture: true, passive: false });
    window.addEventListener("pointercancel", () => {
      swipeState.active = false;
    }, { capture: true, passive: true });
  };

  bindBellButtonFlags();
  bindBellCapture();
  bindCalendarSwipeCapture();
  recoverCalendarGrid();
  setTimeout(recoverCalendarGrid, 180);
})();
