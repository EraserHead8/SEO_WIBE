(function feedbackOverridesV20260320() {
  if (typeof window === "undefined") return;
  if (window.__feedbackOverridesV20260320) return;
  window.__feedbackOverridesV20260320 = true;

  function setSelectOptionText(selectId, value, ru, en) {
    const select = document.getElementById(selectId);
    if (!select) return;
    const option = Array.from(select.options || []).find((node) => String(node.value || "") === value);
    if (!option) return;
    option.textContent = currentLang === "en" ? en : ru;
  }

  function setButtonText(selector, ru, en) {
    const button = document.querySelector(selector);
    if (button) button.textContent = currentLang === "en" ? en : ru;
  }

  function setTableHead(selector, labelsRu, labelsEn) {
    const head = document.querySelector(selector);
    if (!head) return;
    const labels = currentLang === "en" ? labelsEn : labelsRu;
    const cells = head.querySelectorAll("th");
    labels.forEach((label, index) => {
      if (cells[index]) cells[index].textContent = label;
    });
  }

  function repairFeedbackUiCopy() {
    setSelectOptionText("reviewStatusFilter", "all", "Все", "All");
    setSelectOptionText("reviewStatusFilter", "answered", "Отвеченные", "Answered");
    setSelectOptionText("reviewDateSort", "newest", "Сначала новые", "Newest first");
    setSelectOptionText("reviewDateSort", "oldest", "Сначала старые", "Oldest first");
    setSelectOptionText("questionStatusFilter", "all", "Все", "All");
    setSelectOptionText("questionStatusFilter", "answered", "Отвеченные", "Answered");
    setSelectOptionText("questionDateSort", "newest", "Сначала новые", "Newest first");
    setSelectOptionText("questionDateSort", "oldest", "Сначала старые", "Oldest first");
    setButtonText("button[onclick='saveReviewAiSettings()']", "Сохранить AI-настройки", "Save AI settings");
    setButtonText("button[onclick='saveQuestionAiSettings()']", "Сохранить AI-настройки", "Save AI settings");
    setTableHead("#reviewsSubtabReviews thead tr", ["Статус", "Дата", "Товар", "Отзыв", "Ответ", "Автор", "Действия"], ["Status", "Date", "Product", "Review", "Reply", "Author", "Actions"]);
    setTableHead("#reviewsSubtabQuestions thead tr", ["Статус", "Дата", "Товар", "Вопрос", "Ответ", "Действия"], ["Status", "Date", "Product", "Question", "Reply", "Actions"]);
    setTableHead("#reviewsSubtabReturns thead tr", ["Статус", "Дата", "Товар", "Причина / комментарий", "Тип", "Что делать"], ["Status", "Date", "Product", "Reason / comment", "Type", "Action"]);
  }

  const originalRenderWbQuestions = typeof renderWbQuestions === "function" ? renderWbQuestions : null;
  if (originalRenderWbQuestions) {
    renderWbQuestions = async function renderWbQuestionsWithCopy() {
      const result = await originalRenderWbQuestions.apply(this, arguments);
      repairFeedbackUiCopy();
      return result;
    };
  }

  const originalRenderWbReviews = typeof renderWbReviews === "function" ? renderWbReviews : null;
  if (originalRenderWbReviews) {
    renderWbReviews = async function renderWbReviewsWithCopy() {
      const result = await originalRenderWbReviews.apply(this, arguments);
      repairFeedbackUiCopy();
      return result;
    };
  }

  const originalLoadWbQuestions = typeof loadWbQuestions === "function" ? loadWbQuestions : null;
  if (originalLoadWbQuestions) {
    loadWbQuestions = async function loadWbQuestionsWithCopy() {
      repairFeedbackUiCopy();
      const result = await originalLoadWbQuestions.apply(this, arguments);
      repairFeedbackUiCopy();
      return result;
    };
  }

  const originalLoadWbReviews = typeof loadWbReviews === "function" ? loadWbReviews : null;
  if (originalLoadWbReviews) {
    loadWbReviews = async function loadWbReviewsWithCopy() {
      repairFeedbackUiCopy();
      const result = await originalLoadWbReviews.apply(this, arguments);
      repairFeedbackUiCopy();
      return result;
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", repairFeedbackUiCopy, { once: true });
  } else {
    repairFeedbackUiCopy();
  }
  window.addEventListener("languagechange", repairFeedbackUiCopy);
})();