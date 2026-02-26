from __future__ import annotations

import io
import json
from datetime import date, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.auth import create_access_token, get_password_hash, verify_password
from app.db import get_db
from app.deps import get_admin_user, get_current_user
from app.models import (
    ApiCredential,
    AuditLog,
    BillingAccount,
    BillingEvent,
    ModuleAccess,
    PositionSnapshot,
    Product,
    SeoJob,
    User,
    UserAiSettings,
    UserKnowledgeDoc,
    UserProfile,
    UserQuestionAiSettings,
    UserKeyword,
    SystemSetting,
)
from app.schemas import (
    AdminUserProfileOut,
    AdminCredentialRowOut,
    AdminCredentialIn,
    BillingOut,
    BillingPlanChangeIn,
    AdminPasswordResetIn,
    AdminRoleUpdateIn,
    AdminStatsOut,
    AuditLogOut,
    ApiCredentialIn,
    ApiCredentialOut,
    CurrentModuleOut,
    CredentialTestOut,
    DashboardOut,
    GenerateReviewReplyIn,
    GenerateReviewReplyOut,
    ImportProductsRequest,
    KeywordIn,
    KeywordOut,
    LoginRequest,
    MessageOut,
    ModuleAccessIn,
    ModuleAccessOut,
    PositionCheckOut,
    PositionCheckRequest,
    ProductOut,
    ProductReloadRequest,
    SalesStatsOut,
    HelpDocOut,
    KnowledgeDocOut,
    ReviewAiSettingsIn,
    ReviewAiSettingsOut,
    CampaignIdsIn,
    RegisterRequest,
    SeoApplyRequest,
    SeoDeleteRequest,
    SeoGenerateRequest,
    SeoJobOut,
    SeoRecheckRequest,
    TokenResponse,
    TrendOut,
    TrendPointOut,
    UserProfileOut,
    UserProfilePasswordIn,
    UserProfileUpdateIn,
    UserOut,
    WbCampaignRatesIn,
    WbCampaignDetailOut,
    WbAdsActionIn,
    WbAdsActionOut,
    WbAdsAnalyticsOut,
    WbAdsRecommendationsOut,
    WbAdsBalanceOut,
    WbCampaignEnrichOut,
    WbCampaignRatesOut,
    WbCampaignsOut,
    WbReviewReplyIn,
    WbReviewReplyOut,
    WbReviewsOut,
    UiSettingsIn,
    UiSettingsOut,
)
from app.services.sales import build_sales_report
from app.services.marketplace import (
    fetch_products_from_marketplace,
    find_competitors,
    resolve_wb_external_id,
    test_marketplace_credentials,
    update_product_description,
)
from app.services.modules import DEFAULT_MODULES
from app.services.seo import (
    build_seo_description,
    discover_keywords,
    evaluate_position,
    evaluate_positions_for_keywords,
    schedule_next_check,
)
from app.services.wb_modules import (
    probe_ozon_feedback_access,
    probe_wb_feedback_access,
    fetch_ozon_reviews,
    fetch_ozon_questions,
    fetch_wb_ads_balance,
    fetch_wb_campaign_summaries,
    fetch_wb_campaign_details,
    fetch_wb_campaign_rates,
    fetch_wb_campaign_stats_bulk,
    fetch_wb_campaigns,
    fetch_wb_questions,
    fetch_wb_questions_fast,
    fetch_wb_reviews,
    fetch_wb_reviews_fast,
    generate_review_reply,
    post_ozon_question_reply,
    post_ozon_review_reply,
    post_wb_question_reply,
    post_wb_review_reply,
    update_wb_campaign_state,
)

router = APIRouter(prefix="/api")
DISABLED_BY_DEFAULT_MODULES = {"billing", "wb_reviews_ai", "wb_questions_ai", "wb_ads", "wb_ads_analytics", "wb_ads_recommendations", "help_center"}
AVAILABLE_THEMES = ("classic", "dark", "light", "newyear", "summer", "autumn", "winter", "spring")
DEFAULT_UI_SETTINGS = {
    "theme_choice_enabled": True,
    "default_theme": "classic",
    "allowed_themes": list(AVAILABLE_THEMES),
}

BILLING_PLANS: dict[str, dict[str, Any]] = {
    "starter": {"title": "Starter", "price": 990, "limits": {"products": 500, "seo_jobs_month": 1500, "ai_replies_month": 800}},
    "pro": {"title": "Pro", "price": 2990, "limits": {"products": 5000, "seo_jobs_month": 10000, "ai_replies_month": 5000}},
    "business": {"title": "Business", "price": 8990, "limits": {"products": 50000, "seo_jobs_month": 100000, "ai_replies_month": 50000}},
}

HELP_DOCS_RU: dict[str, dict[str, str]] = {
    "dashboard": {
        "title": "Дашборд",
        "content": (
            "Назначение: ежедневный контроль состояния проекта.\n\n"
            "Блоки и функции:\n"
            "1) KPI-карточки: показывают общее число товаров, SEO-задач, задач в работе и в топ-5.\n"
            "2) Тренд позиций (21 день): отображает динамику средней позиции и плотность проверок.\n"
            "3) Быстрые действия:\n"
            "- Импортировать товары: переход в модуль «Товары».\n"
            "- Запустить SEO-генерацию: переход в «SEO задачи».\n"
            "- Проверить позиции всех: массовая проверка позиций.\n\n"
            "Пример: утром откройте дашборд, проверьте рост KPI и запустите массовую проверку, если снизилось число товаров в топ-5."
        ),
    },
    "products": {
        "title": "Товары",
        "content": (
            "Назначение: импорт каталога, фильтрация и проверка позиций.\n\n"
            "Кнопки и поля:\n"
            "- Импорт: загружает товары из выбранного маркетплейса.\n"
            "- Перезагрузить базу: полностью пересобирает локальный каталог.\n"
            "- Выбрать все: выделяет все строки в текущей выдаче.\n"
            "- Проверить выбранные: проверяет позиции только у отмеченных карточек.\n"
            "- Проверить все: проверяет позиции по всему каталогу.\n"
            "- Поле «Фильтр»: быстрый поиск по артикулу/названию.\n"
            "- Поле «Ключи для проверки»: ключевые фразы через запятую.\n\n"
            "Результат проверки позиции:\n"
            "- 1..500: реальная позиция карточки в поиске.\n"
            "- 501+: карточка не найдена в первых 500 позициях.\n"
            "- Если по нескольким ключам позиции отличаются, система показывает лучшую и среднюю.\n\n"
            "Рекомендуемый порядок работы:\n"
            "1) Импортируйте каталог.\n"
            "2) Отфильтруйте нужную группу SKU.\n"
            "3) Укажите релевантные ключи.\n"
            "4) Запустите «Проверить выбранные» и сравните результат до/после SEO.\n\n"
            "Диагностика:\n"
            "- Если позиции не обновляются, проверьте валидность API-ключа WB/Ozon в «Профиле».\n"
            "- Если у товара часто 501+, уточните набор ключей и проверьте корректность артикула/внешнего ID.\n"
            "- Если таблица пустая после импорта, очистите фильтр и повторите загрузку.\n\n"
            "Пример: импортируйте товары Ozon, задайте ключи «утеплитель трубы, теплоизоляция», нажмите «Проверить выбранные», затем сравните динамику в SEO-задачах."
        ),
    },
    "seo_generation": {
        "title": "SEO задачи",
        "content": (
            "Назначение: генерация SEO-описаний и итеративное улучшение.\n\n"
            "Кнопки и действия:\n"
            "- Сгенерировать для выбранных / для всех: создает SEO-задачи.\n"
            "- Применить: отправляет утвержденные описания в маркетплейс.\n"
            "- Recheck выбранных: повторная проверка метрик/позиций по задачам.\n"
            "- Recheck просроченных: массовая актуализация задач с истекшей датой.\n"
            "- Выбрать все: выделение всех задач в текущем списке.\n"
            "- Удалить выбранные / Очистить все SEO задачи: удаление задач.\n\n"
            "Жизненный цикл задачи:\n"
            "1) generated: текст сгенерирован и доступен для просмотра.\n"
            "2) in_progress: задача проверяется или дорабатывается.\n"
            "3) applied: описание применено в маркетплейсе.\n"
            "4) top_5: достигнута целевая позиция (если была задана).\n\n"
            "Рекомендации:\n"
            "- Используйте «Recheck выбранных» после ручных правок текста.\n"
            "- Используйте «Recheck просроченных» как регулярную операцию, например раз в день.\n"
            "- Перед «Применить» проверяйте блок «Предпросмотр» и список конкурентов.\n\n"
            "Диагностика:\n"
            "- Если применение не проходит, проверьте доступность API маркетплейса и права ключа.\n"
            "- Если прогресс задач не меняется, запустите recheck и сверяйте дату следующей проверки.\n\n"
            "Пример: сгенерируйте описания для 20 SKU, проверьте превью, отправьте «Применить», затем через recheck оцените изменение позиции."
        ),
    },
    "wb_reviews_ai": {
        "title": "Отзывы WB/Ozon",
        "content": (
            "Назначение: обработка отзывов и отправка ответов.\n\n"
            "Что делает каждая кнопка:\n"
            "- Обновить отзывы: загружает новые данные из WB/Ozon.\n"
            "- Сохранить AI-настройки: сохраняет режим и промпт генератора.\n"
            "- Иконка AI в строке: генерирует черновик ответа.\n"
            "- Иконка отправки: публикует ответ (или обновляет ранее отправленный).\n"
            "- Фильтры: маркетплейс, оценка, статус, сортировка, период.\n\n"
            "Важно:\n"
            "- Дата «с/по» фильтрует уже загруженные записи. Если строк нет, сначала очистите фильтр дат.\n"
            "- Статус-бар показывает прогресс догрузки: сначала быстрый слой, затем полный.\n"
            "- В колонке «Ответ» сохраняется черновик; отправка в маркетплейс выполняется только по кнопке действия.\n\n"
            "Типовой сценарий:\n"
            "1) Выберите WB или Ozon.\n"
            "2) Поставьте фильтр «Неотвеченные».\n"
            "3) Нажмите иконку AI, отредактируйте текст при необходимости.\n"
            "4) Нажмите отправку и дождитесь статуса «отвечен».\n\n"
            "Пример: выберите «Неотвеченные», нажмите AI-иконку, поправьте тон ответа и отправьте в карточку отзыва."
        ),
    },
    "wb_questions_ai": {
        "title": "Вопросы WB/Ozon",
        "content": (
            "Назначение: ответы на вопросы покупателей по товарам.\n\n"
            "Кнопки и блоки:\n"
            "- Обновить вопросы: загружает вопросы из WB/Ozon.\n"
            "- Сохранить AI-настройки: сохраняет режим и промпт.\n"
            "- Загрузить в базу знаний: добавляет документ для контекста AI.\n"
            "- Удалить выбранный документ: удаляет документ из базы знаний.\n"
            "- Иконка AI в строке: генерирует ответ на вопрос.\n"
            "- Иконка отправки: публикует/обновляет ответ.\n\n"
            "Важно:\n"
            "- Для быстрых ответов загрузите FAQ/регламент в базу знаний перед генерацией.\n"
            "- При пустой таблице сначала проверьте фильтр дат и маркетплейс.\n"
            "- Статус-бар и RAW-блок помогают понять, идет ли загрузка или есть ошибка API.\n\n"
            "Типовой сценарий:\n"
            "1) Выберите маркетплейс и статус «Новые».\n"
            "2) При необходимости загрузите документ в базу знаний.\n"
            "3) Сгенерируйте ответ, отредактируйте формулировки.\n"
            "4) Отправьте ответ и обновите список.\n\n"
            "Пример: загрузите FAQ поставщика в базу знаний, затем сгенерируйте и отправьте ответы на новые вопросы."
        ),
    },
    "wb_ads": {
        "title": "Реклама WB",
        "content": (
            "Назначение: мониторинг и оперативное управление рекламными кампаниями WB.\n\n"
            "Кнопки и функции:\n"
            "- Загрузить кампании: быстрая загрузка списка кампаний.\n"
            "- Получить ставки: запрос ставок по campaign_id.\n"
            "- Сбросить фильтры: возврат фильтрации и сортировки к умолчанию.\n"
            "- Поиск/фильтры: ID, название, статус, тип, работает, бюджет.\n"
            "- Двойной клик по строке: открывает модальное окно с деталями.\n"
            "- В деталях кампании: Запустить / Пауза / Остановить / Обновить детали.\n\n"
            "Пример: отфильтруйте «только работает», найдите кампании с высоким расходом и проверьте детали двойным кликом."
        ),
    },
    "wb_ads_analytics": {
        "title": "Аналитика WB Ads",
        "content": (
            "Назначение: отчет по эффективности рекламы за период.\n\n"
            "Поля и действия:\n"
            "- Дата с / по: временной диапазон отчета.\n"
            "- campaign_id (опционально): выбор одной кампании.\n"
            "- Построить отчет: формирует таблицу и агрегированные totals.\n"
            "- Метрики: показы, клики, CTR, заказы, расход, CPC, CPO.\n\n"
            "Пример: укажите последние 7 дней и сравните CPO между кампаниями, чтобы найти неэффективные."
        ),
    },
    "wb_ads_recommendations": {
        "title": "Рекомендации WB Ads",
        "content": (
            "Назначение: автоматические рекомендации по оптимизации WB Ads.\n\n"
            "Параметры:\n"
            "- Дата с / по: период анализа.\n"
            "- Мин. расход: порог включения кампании в анализ.\n"
            "- Построить рекомендации: рассчитывает приоритет и действие.\n"
            "- Колонки результата: priority, recommendation, reason, action.\n\n"
            "Пример: задайте «Мин. расход = 500», найдите high-priority кампании и начните с действий pause/refresh."
        ),
    },
    "billing": {
        "title": "Биллинг",
        "content": (
            "Назначение: управление тарифом и лимитами.\n\n"
            "Кнопки:\n"
            "- Сменить тариф: переводит аккаунт на выбранный план.\n"
            "- Продлить на 30 дней: продление текущего плана.\n"
            "- Обновить: повторная загрузка статуса биллинга.\n"
            "- Блоки «Статус и лимиты» и «История»: текущие квоты и операции.\n\n"
            "Пример: если упираетесь в лимит AI-ответов, выберите plan pro и нажмите «Сменить тариф»."
        ),
    },
    "sales_stats": {
        "title": "Статистика продаж",
        "content": (
            "Назначение: анализ продаж по датам и маркетплейсам.\n\n"
            "Кнопки и поля:\n"
            "- Маркетплейс: all / wb / ozon.\n"
            "- Дата с / по: период отчета.\n"
            "- Быстрые периоды: день, неделя, месяц, квартал, 6 месяцев, год.\n"
            "- Переключатель метрики графика: штуки / выручка / заказы / отказы / реклама / прочие траты.\n"
            "- Чекбоксы графика: всего / WB / Ozon для сравнения линий.\n"
            "- Поле «Прочие траты»: ручные расходы, которые не пришли из API.\n"
            "- Загрузить статистику: ручной принудительный рефреш.\n\n"
            "Важно:\n"
            "- KPI-карточки сверху показывают агрегаты за выбранный период.\n"
            "- Данные загружаются автоматически при смене маркетплейса и дат.\n"
            "- Формат чисел адаптируется под язык интерфейса (ru/en).\n"
            "- Для сравнения каналов оставьте включенными сразу WB и Ozon.\n\n"
            "Диагностика:\n"
            "- Если по WB видите предупреждение API 429, это лимит WB; повторите чуть позже.\n"
            "- Если таблица пустая, сначала выберите «День/Неделя» и проверьте ключи API в «Профиле».\n"
            "- Если график кажется пустым, переключите метрику и убедитесь, что включена хотя бы одна линия (Всего/WB/Ozon).\n\n"
            "Пример: выберите «Квартал», метрику «Выручка», включите WB+Ozon и сравните динамику каналов. Затем переключитесь на «Реклама», чтобы сопоставить рост выручки и затрат."
        ),
    },
    "user_profile": {
        "title": "Профиль",
        "content": (
            "Назначение: управление личными и юридическими данными, тарифом и ключами API.\n\n"
            "Что доступно:\n"
            "- Поля профиля: ФИО, компания, город, ИНН, налоговая ставка, телефон, структура команды.\n"
            "- Тариф: выбор и продление в этом же модуле.\n"
            "- API ключи WB/Ozon: добавление, проверка, удаление.\n"
            "- Безопасность: смена пароля.\n\n"
            "Практика:\n"
            "1) Сначала заполните реквизиты и контактные поля.\n"
            "2) Затем подключите WB/Ozon ключи и нажмите «Проверить».\n"
            "3) После успешной проверки обновите модуль «Товары» и запустите импорт.\n"
            "4) Если лимитов мало, смените тариф и обновите экран.\n\n"
            "Диагностика:\n"
            "- Ошибка ключа Ozon обычно связана с форматом: нужен `client_id:api_key`.\n"
            "- Если модуль не открывается, проверьте доступы в админке (раздел «Модули»).\n"
            "- Если пароль не меняется, убедитесь, что новый пароль не короче 8 символов.\n\n"
            "Пример: обновите реквизиты компании, смените тариф на pro и проверьте ключи интеграции в одном месте."
        ),
    },
    "help_center": {
        "title": "Справка",
        "content": (
            "Назначение: централизованная инструкция по всем модулям.\n\n"
            "Как пользоваться:\n"
            "- Выберите модуль в первом списке.\n"
            "- Выберите язык (ru/en).\n"
            "- Нажмите «Обновить справку» для перезагрузки содержимого.\n\n"
            "Что есть в каждом разделе:\n"
            "- Назначение модуля и ожидаемый результат.\n"
            "- Расшифровка кнопок, полей и переключателей.\n"
            "- Типовой рабочий сценарий по шагам.\n"
            "- Пример практического использования.\n\n"
            "Дополнительно:\n"
            "- Кнопка «Открыть модуль» переводит сразу на нужную вкладку.\n"
            "- Кнопка «Только этот модуль» фильтрует справку по одному разделу.\n"
            "- Чек-лист в карточке помогает быстро проверить, что вы не пропустили обязательные шаги.\n\n"
            "Как использовать справку в работе:\n"
            "1) Откройте нужный модуль из карточки.\n"
            "2) Выполните действия из блока «Типовой сценарий».\n"
            "3) При ошибке сверяйтесь с блоком «Диагностика» в соответствующем разделе.\n"
            "4) Возвращайтесь в справку и фиксируйте рабочие сценарии команды.\n\n"
            "Совет: используйте кнопку «Открыть модуль» прямо из справки, чтобы сразу перейти к нужному экрану."
        ),
    },
}

HELP_DOCS_EN: dict[str, dict[str, str]] = {
    "dashboard": {
        "title": "Dashboard",
        "content": (
            "Purpose: daily control center for your workspace.\n\n"
            "Sections and actions:\n"
            "1) KPI cards: products, SEO jobs, in-progress jobs, top-5 products.\n"
            "2) 21-day trend: average ranking trend and checks density.\n"
            "3) Quick actions:\n"
            "- Import products\n"
            "- Open SEO jobs\n"
            "- Check all rankings\n\n"
            "Example: open dashboard every morning, verify top-5 trend, then run a full ranking check if metrics dropped."
        ),
    },
    "products": {
        "title": "Products",
        "content": (
            "Purpose: catalog import, filtering, and ranking checks.\n\n"
            "Buttons and fields:\n"
            "- Import: imports products from selected marketplace.\n"
            "- Reload Catalog: fully rebuilds local catalog.\n"
            "- Select All: selects all rows in current table view.\n"
            "- Check Selected / Check All: runs ranking checks.\n"
            "- Filter input: quick search by article/title.\n"
            "- Ranking keywords input: custom comma-separated keywords.\n\n"
            "Ranking result meaning:\n"
            "- 1..500: real card rank in search.\n"
            "- 501+: card is outside first 500 positions.\n"
            "- For multiple keywords, the system tracks both best and average rank.\n\n"
            "Recommended workflow:\n"
            "1) Import catalog.\n"
            "2) Filter priority SKU group.\n"
            "3) Set focused keywords.\n"
            "4) Run Check Selected and compare before/after SEO changes.\n\n"
            "Troubleshooting:\n"
            "- If ranks are not updating, validate WB/Ozon API keys in Profile.\n"
            "- If many rows show 501+, refine keyword set and verify external identifiers.\n"
            "- If table looks empty after import, clear filters and reload data.\n\n"
            "Example: import Ozon catalog, set custom keywords, run Check Selected for priority SKUs, then compare with SEO Jobs results."
        ),
    },
    "seo_generation": {
        "title": "SEO Jobs",
        "content": (
            "Purpose: generate, validate, and apply SEO descriptions.\n\n"
            "Actions:\n"
            "- Generate Selected / Generate All.\n"
            "- Apply: publish approved descriptions.\n"
            "- Recheck Selected / Recheck Due.\n"
            "- Select All.\n"
            "- Delete Selected / Delete All SEO Jobs.\n\n"
            "Job lifecycle:\n"
            "1) generated: draft text is ready.\n"
            "2) in_progress: job is being re-evaluated.\n"
            "3) applied: marketplace update is completed.\n"
            "4) top_5: target rank reached.\n\n"
            "Best practices:\n"
            "- Run Recheck Selected after manual edits.\n"
            "- Use Recheck Due daily for scheduled maintenance.\n"
            "- Review preview and competitor context before Apply.\n\n"
            "Troubleshooting:\n"
            "- If Apply fails, verify API permissions and marketplace availability.\n"
            "- If status does not change, trigger recheck and inspect next-check timestamp.\n\n"
            "Example: generate tasks for 30 products, review preview text, apply approved jobs, then recheck to measure ranking delta."
        ),
    },
    "wb_reviews_ai": {
        "title": "WB/Ozon Reviews",
        "content": (
            "Purpose: process marketplace reviews and publish replies.\n\n"
            "Controls:\n"
            "- Refresh Reviews: reload reviews from WB/Ozon.\n"
            "- Save AI settings: stores mode and prompt.\n"
            "- AI icon in row: generate draft reply.\n"
            "- Send icon in row: publish or update reply.\n"
            "- Filters: marketplace, rating, status, sort, date range.\n\n"
            "Important:\n"
            "- Date range filters already loaded rows. If the table is empty, clear date filters first.\n"
            "- Status bar shows progressive loading (fast layer first, full layer next).\n"
            "- Reply textarea is a draft until you explicitly press Send/Update.\n\n"
            "Typical workflow:\n"
            "1) Select marketplace.\n"
            "2) Filter by Unanswered.\n"
            "3) Generate draft with AI icon and adjust tone.\n"
            "4) Publish and verify status.\n\n"
            "Example: filter Unanswered reviews, generate draft, edit tone, then publish."
        ),
    },
    "wb_questions_ai": {
        "title": "WB/Ozon Questions",
        "content": (
            "Purpose: answer customer questions for product cards.\n\n"
            "Controls:\n"
            "- Refresh Questions.\n"
            "- Save AI settings.\n"
            "- Upload to Knowledge Base / Delete Selected Document.\n"
            "- AI icon in row: generate answer.\n"
            "- Send icon in row: publish/update answer.\n\n"
            "Important:\n"
            "- Upload FAQ/guidelines to knowledge base before bulk answering.\n"
            "- If rows are missing, verify marketplace and date filters.\n"
            "- Use status bar and RAW block to diagnose API-side issues.\n\n"
            "Typical workflow:\n"
            "1) Choose marketplace and New status.\n"
            "2) Upload a reference document if needed.\n"
            "3) Generate and edit answer.\n"
            "4) Publish and refresh list.\n\n"
            "Example: upload supplier FAQ into knowledge base, then generate consistent answers for new questions."
        ),
    },
    "wb_ads": {
        "title": "WB Ads",
        "content": (
            "Purpose: monitor and manage WB ad campaigns.\n\n"
            "Main controls:\n"
            "- Load Campaigns: fast campaign list load.\n"
            "- Get Rates: fetch bid rates by campaign_id.\n"
            "- Reset Filters.\n"
            "- Filters: search, status, type, running flag, budget range.\n"
            "- Double-click row: open campaign details modal.\n"
            "- In modal: Start / Pause / Stop / Refresh details.\n\n"
            "Example: filter running campaigns, sort by spend, inspect a campaign in detail modal."
        ),
    },
    "wb_ads_analytics": {
        "title": "WB Ads Analytics",
        "content": (
            "Purpose: period analytics report for WB Ads.\n\n"
            "Inputs and output:\n"
            "- Date from / date to.\n"
            "- Optional campaign_id.\n"
            "- Build Report: produces table + totals.\n"
            "- Metrics: views, clicks, CTR, orders, spend, CPC, CPO.\n\n"
            "Example: run a 7-day report and compare CPO between campaigns before scaling budget."
        ),
    },
    "wb_ads_recommendations": {
        "title": "WB Ads Recommendations",
        "content": (
            "Purpose: prioritize optimization actions automatically.\n\n"
            "Parameters:\n"
            "- Date range.\n"
            "- Minimum spend threshold.\n"
            "- Build Recommendations: calculates priority/action/reason.\n"
            "- Output columns: priority, recommendation, reason, action.\n\n"
            "Example: set min spend to 500 and start from high-priority campaigns with pause/refresh actions."
        ),
    },
    "billing": {
        "title": "Billing",
        "content": (
            "Purpose: plan and limit management.\n\n"
            "Buttons:\n"
            "- Change Plan.\n"
            "- Renew for 30 days.\n"
            "- Refresh.\n"
            "- Status/Limits and History blocks show current quota usage and billing events.\n\n"
            "Example: if AI limits are reached, switch to a higher plan, then refresh to verify new limits."
        ),
    },
    "sales_stats": {
        "title": "Sales Statistics",
        "content": (
            "Purpose: track sales by date range and marketplace.\n\n"
            "Controls:\n"
            "- Marketplace: all / wb / ozon.\n"
            "- Date from / date to.\n"
            "- Quick ranges: day, week, month, quarter, 6 months, year.\n"
            "- Chart metric switch: units / revenue / orders / returns / ad spend / other costs.\n"
            "- Chart series toggles: total / WB / Ozon for side-by-side comparison.\n"
            "- Other costs field: manual costs not provided by marketplace API.\n"
            "- Load stats: manual forced refresh.\n\n"
            "Important:\n"
            "- KPI cards show total orders, units, and revenue for the selected range.\n"
            "- Data also auto-refreshes when marketplace or dates are changed.\n"
            "- Number formatting follows selected UI language.\n"
            "- Keep WB and Ozon enabled to compare trends visually.\n\n"
            "Troubleshooting:\n"
            "- WB warning 429 means API rate limit, retry later.\n"
            "- Empty table usually means no sales in range or invalid API keys.\n"
            "- If chart looks empty, switch metric and verify at least one line is enabled.\n\n"
            "Example: choose Quarter, switch to Revenue, enable WB+Ozon, compare line trends, then switch to Ads Spend to compare revenue growth against ad costs."
        ),
    },
    "user_profile": {
        "title": "Profile",
        "content": (
            "Purpose: manage personal/company data, plan, API keys, and password.\n\n"
            "Includes:\n"
            "- Profile fields: full name, company, city, legal details, tax rate, phone, team structure.\n"
            "- Plan management in the same module.\n"
            "- WB/Ozon API keys management.\n"
            "- Password change.\n\n"
            "Recommended flow:\n"
            "1) Fill profile and legal fields.\n"
            "2) Connect and validate WB/Ozon keys.\n"
            "3) Re-open Products and run import.\n"
            "4) Upgrade plan if limits are insufficient.\n\n"
            "Troubleshooting:\n"
            "- Ozon key must be in `client_id:api_key` format.\n"
            "- If a module is unavailable, check admin module access toggles.\n"
            "- New password must contain at least 8 characters.\n\n"
            "Example: update legal details, switch plan, and validate marketplace API keys from a single screen."
        ),
    },
    "help_center": {
        "title": "Help Center",
        "content": (
            "Purpose: centralized documentation for every module.\n\n"
            "Usage:\n"
            "- Select module in the first dropdown.\n"
            "- Select language (ru/en).\n"
            "- Click Refresh Help.\n\n"
            "Each section includes:\n"
            "- Module purpose and expected result.\n"
            "- Button/field reference.\n"
            "- Typical workflow.\n"
            "- Practical example.\n\n"
            "Additional tools:\n"
            "- Open Module button jumps directly to module tab.\n"
            "- Show only this button filters help to one module.\n"
            "- Built-in checklist helps verify required steps.\n\n"
            "How teams use it:\n"
            "1) Open module from help card.\n"
            "2) Execute the workflow section step by step.\n"
            "3) Use troubleshooting notes when API/UI behavior is unexpected.\n"
            "4) Keep internal team SOPs aligned with these cards.\n\n"
            "Tip: use Open Module buttons in help cards to jump directly to the required screen."
        ),
    },
}


@router.post("/auth/register", response_model=TokenResponse)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    exists = db.scalar(select(User).where(User.email == payload.email))
    if exists:
        raise HTTPException(status_code=400, detail="Пользователь уже существует")

    users_count = db.scalar(select(func.count()).select_from(User)) or 0
    role = "admin" if users_count == 0 else "client"
    user = User(email=payload.email, hashed_password=get_password_hash(payload.password), role=role)
    db.add(user)
    db.flush()

    for module_code in DEFAULT_MODULES:
        db.add(
            ModuleAccess(
                user_id=user.id,
                module_code=module_code,
                enabled=(module_code not in DISABLED_BY_DEFAULT_MODULES),
            )
        )

    db.add(AuditLog(user_id=user.id, action="user_registered", details=f"role={role}"))
    db.commit()

    return TokenResponse(access_token=create_access_token(payload.email))


@router.post("/auth/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == payload.email))
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Неверный email или пароль")
    return TokenResponse(access_token=create_access_token(user.email))


@router.get("/auth/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.get("/modules/current", response_model=list[CurrentModuleOut])
def current_modules(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(ModuleAccess).where(ModuleAccess.user_id == user.id)).all()
    return [CurrentModuleOut(module_code=x.module_code, enabled=x.enabled) for x in rows]


@router.get("/ui/settings", response_model=UiSettingsOut)
def ui_settings(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _ = user
    return _get_ui_settings(db)


@router.post("/credentials", response_model=ApiCredentialOut)
def save_credential(payload: ApiCredentialIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    marketplace = validate_marketplace(payload.marketplace)

    creds = db.scalars(
        select(ApiCredential)
        .where(ApiCredential.user_id == user.id, ApiCredential.marketplace == marketplace)
        .order_by(ApiCredential.id.desc())
    ).all()
    if creds:
        cred = creds[0]
        cred.api_key = payload.api_key
        cred.active = True
        for stale in creds[1:]:
            stale.active = False
    else:
        cred = ApiCredential(user_id=user.id, marketplace=marketplace, api_key=payload.api_key, active=True)
        db.add(cred)

    db.add(AuditLog(user_id=user.id, action="credential_saved", details=f"marketplace={marketplace}"))
    db.commit()
    return ApiCredentialOut(id=cred.id, marketplace=cred.marketplace, api_key_masked=mask_key(cred.api_key), active=cred.active)


@router.get("/credentials", response_model=list[ApiCredentialOut])
def list_credentials(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    creds = db.scalars(
        select(ApiCredential).where(ApiCredential.user_id == user.id).order_by(ApiCredential.id.desc())
    ).all()
    return [ApiCredentialOut(id=c.id, marketplace=c.marketplace, api_key_masked=mask_key(c.api_key), active=c.active) for c in creds]


@router.post("/credentials/test", response_model=CredentialTestOut)
def test_credential(payload: ApiCredentialIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    marketplace = validate_marketplace(payload.marketplace)
    ok, message = test_marketplace_credentials(marketplace, payload.api_key)
    db.add(AuditLog(user_id=user.id, action="credential_tested", details=f"marketplace={marketplace};ok={ok}"))
    db.commit()
    return CredentialTestOut(ok=ok, message=message)


@router.delete("/credentials/{marketplace}", response_model=MessageOut)
def delete_credential(marketplace: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    market = validate_marketplace(marketplace)
    creds = db.scalars(
        select(ApiCredential).where(ApiCredential.user_id == user.id, ApiCredential.marketplace == market)
    ).all()
    if not creds:
        raise HTTPException(status_code=404, detail="Ключ не найден")

    for cred in creds:
        db.delete(cred)
    db.add(AuditLog(user_id=user.id, action="credential_deleted", details=f"marketplace={market}"))
    db.commit()
    return MessageOut(message="Ключ удален")


@router.get("/keywords", response_model=list[KeywordOut])
def list_keywords(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.scalars(select(UserKeyword).where(UserKeyword.user_id == user.id).order_by(UserKeyword.id.desc())).all()


@router.post("/keywords", response_model=KeywordOut)
def add_keyword(payload: KeywordIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    marketplace = payload.marketplace.strip().lower()
    if marketplace not in {"all", "wb", "ozon"}:
        raise HTTPException(status_code=400, detail="marketplace должен быть all, wb или ozon")
    keyword = payload.keyword.strip()
    if not keyword:
        raise HTTPException(status_code=400, detail="Ключевое слово не должно быть пустым")

    exists = db.scalar(
        select(UserKeyword).where(
            UserKeyword.user_id == user.id,
            UserKeyword.marketplace == marketplace,
            UserKeyword.keyword == keyword,
        )
    )
    if exists:
        return exists

    row = UserKeyword(user_id=user.id, marketplace=marketplace, keyword=keyword)
    db.add(row)
    db.add(AuditLog(user_id=user.id, action="keyword_added", details=f"marketplace={marketplace};keyword={keyword}"))
    db.commit()
    db.refresh(row)
    return row


@router.delete("/keywords/{keyword_id}", response_model=MessageOut)
def delete_keyword(keyword_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    row = db.scalar(select(UserKeyword).where(UserKeyword.id == keyword_id, UserKeyword.user_id == user.id))
    if not row:
        raise HTTPException(status_code=404, detail="Ключ не найден")
    db.delete(row)
    db.add(AuditLog(user_id=user.id, action="keyword_deleted", details=f"id={keyword_id}"))
    db.commit()
    return MessageOut(message="Ключ удален")


@router.get("/wb/reviews", response_model=WbReviewsOut)
def wb_reviews(
    stars: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    fast: bool = False,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_module_enabled(db, user.id, "wb_reviews_ai")
    wb_key = _get_active_marketplace_api_key(db, user.id, "wb")
    if not wb_key:
        raise HTTPException(status_code=400, detail="Сначала сохраните API ключ для wb")
    if stars is not None and (stars < 1 or stars > 5):
        raise HTTPException(status_code=400, detail="stars должен быть от 1 до 5")

    if fast:
        data = fetch_wb_reviews_fast(
            wb_key,
            stars=stars,
            date_from=date_from.isoformat() if date_from else None,
            date_to=date_to.isoformat() if date_to else None,
        )
    else:
        data = fetch_wb_reviews(
            wb_key,
            stars=stars,
            date_from=date_from.isoformat() if date_from else None,
            date_to=date_to.isoformat() if date_to else None,
            max_pages=8,
        )
    if not data.get("new") and not data.get("answered"):
        ok, message = probe_wb_feedback_access(wb_key, feedback_kind="reviews")
        if not ok:
            raise HTTPException(status_code=400, detail=message)
    db.add(
        AuditLog(
            user_id=user.id,
            action="wb_reviews_read",
            details=f"new={len(data.get('new', []))};answered={len(data.get('answered', []))}",
        )
    )
    db.commit()
    return WbReviewsOut(new=data.get("new", []), answered=data.get("answered", []))


@router.post("/wb/reviews/reply", response_model=WbReviewReplyOut)
def wb_reply_review(payload: WbReviewReplyIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_module_enabled(db, user.id, "wb_reviews_ai")
    wb_key = _get_active_marketplace_api_key(db, user.id, "wb")
    if not wb_key:
        raise HTTPException(status_code=400, detail="Сначала сохраните API ключ для wb")
    ok, message = post_wb_review_reply(wb_key, payload.id, payload.text)
    db.add(AuditLog(user_id=user.id, action="wb_review_reply", details=f"feedback_id={payload.id};ok={ok}"))
    db.commit()
    if not ok:
        raise HTTPException(status_code=400, detail=message)
    return WbReviewReplyOut(ok=True, message=message)


@router.post("/wb/reviews/generate-reply", response_model=GenerateReviewReplyOut)
def wb_generate_reply(payload: GenerateReviewReplyIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_module_enabled(db, user.id, "wb_reviews_ai")
    settings_row = _get_or_create_ai_settings(db, user.id)
    knowledge_ctx = _build_user_knowledge_context(db, user.id)
    prompt = _compose_ai_prompt(settings_row.prompt if settings_row and settings_row.prompt else "", knowledge_ctx, content_kind="review")
    reply = generate_review_reply(
        review_text=payload.review_text,
        product_name=payload.product_name,
        stars=payload.stars,
        prompt=prompt,
        reviewer_name=payload.reviewer_name,
        marketplace="wb",
        content_kind="review",
    )
    db.add(AuditLog(user_id=user.id, action="wb_review_reply_generated", details=f"model={settings.openai_model}"))
    db.commit()
    return GenerateReviewReplyOut(reply=reply)


@router.get("/ozon/reviews", response_model=WbReviewsOut)
def ozon_reviews(
    stars: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    fast: bool = False,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_module_enabled(db, user.id, "wb_reviews_ai")
    ozon_key = _get_active_marketplace_api_key(db, user.id, "ozon")
    if not ozon_key:
        raise HTTPException(status_code=400, detail="Сначала сохраните API ключ для ozon")
    if stars is not None and (stars < 1 or stars > 5):
        raise HTTPException(status_code=400, detail="stars должен быть от 1 до 5")

    data = fetch_ozon_reviews(
        ozon_key,
        stars=stars,
        date_from=date_from.isoformat() if date_from else None,
        date_to=date_to.isoformat() if date_to else None,
        max_pages=1 if fast else 8,
        enrich_products=not fast,
    )
    if not data.get("new") and not data.get("answered"):
        ok, message = probe_ozon_feedback_access(ozon_key, feedback_kind="reviews")
        if not ok:
            raise HTTPException(status_code=400, detail=message)
    db.add(
        AuditLog(
            user_id=user.id,
            action="ozon_reviews_read",
            details=f"new={len(data.get('new', []))};answered={len(data.get('answered', []))}",
        )
    )
    db.commit()
    return WbReviewsOut(new=data.get("new", []), answered=data.get("answered", []))


@router.post("/ozon/reviews/reply", response_model=WbReviewReplyOut)
def ozon_reply_review(payload: WbReviewReplyIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_module_enabled(db, user.id, "wb_reviews_ai")
    ozon_key = _get_active_marketplace_api_key(db, user.id, "ozon")
    if not ozon_key:
        raise HTTPException(status_code=400, detail="Сначала сохраните API ключ для ozon")
    ok, message = post_ozon_review_reply(ozon_key, payload.id, payload.text)
    db.add(AuditLog(user_id=user.id, action="ozon_review_reply", details=f"review_id={payload.id};ok={ok}"))
    db.commit()
    if not ok:
        raise HTTPException(status_code=400, detail=message)
    return WbReviewReplyOut(ok=True, message=message)


@router.post("/ozon/reviews/generate-reply", response_model=GenerateReviewReplyOut)
def ozon_generate_reply(payload: GenerateReviewReplyIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_module_enabled(db, user.id, "wb_reviews_ai")
    settings_row = _get_or_create_ai_settings(db, user.id)
    knowledge_ctx = _build_user_knowledge_context(db, user.id)
    prompt = _compose_ai_prompt(settings_row.prompt if settings_row and settings_row.prompt else "", knowledge_ctx, content_kind="review")
    reply = generate_review_reply(
        review_text=payload.review_text,
        product_name=payload.product_name,
        stars=payload.stars,
        prompt=prompt,
        reviewer_name=payload.reviewer_name,
        marketplace="ozon",
        content_kind="review",
    )
    db.add(AuditLog(user_id=user.id, action="ozon_review_reply_generated", details=f"model={settings.openai_model}"))
    db.commit()
    return GenerateReviewReplyOut(reply=reply)


@router.get("/wb/questions", response_model=WbReviewsOut)
def wb_questions(
    date_from: date | None = None,
    date_to: date | None = None,
    fast: bool = False,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_module_enabled(db, user.id, "wb_questions_ai")
    wb_key = _get_active_marketplace_api_key(db, user.id, "wb")
    if not wb_key:
        raise HTTPException(status_code=400, detail="Сначала сохраните API ключ для wb")
    if fast:
        data = fetch_wb_questions_fast(
            wb_key,
            date_from=date_from.isoformat() if date_from else None,
            date_to=date_to.isoformat() if date_to else None,
        )
    else:
        data = fetch_wb_questions(
            wb_key,
            date_from=date_from.isoformat() if date_from else None,
            date_to=date_to.isoformat() if date_to else None,
            max_pages=8,
        )
    if not data.get("new") and not data.get("answered"):
        ok, message = probe_wb_feedback_access(wb_key, feedback_kind="questions")
        if not ok:
            raise HTTPException(status_code=400, detail=message)
    db.add(
        AuditLog(
            user_id=user.id,
            action="wb_questions_read",
            details=f"new={len(data.get('new', []))};answered={len(data.get('answered', []))}",
        )
    )
    db.commit()
    return WbReviewsOut(new=data.get("new", []), answered=data.get("answered", []))


@router.post("/wb/questions/reply", response_model=WbReviewReplyOut)
def wb_reply_question(payload: WbReviewReplyIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_module_enabled(db, user.id, "wb_questions_ai")
    wb_key = _get_active_marketplace_api_key(db, user.id, "wb")
    if not wb_key:
        raise HTTPException(status_code=400, detail="Сначала сохраните API ключ для wb")
    ok, message = post_wb_question_reply(wb_key, payload.id, payload.text)
    db.add(AuditLog(user_id=user.id, action="wb_question_reply", details=f"question_id={payload.id};ok={ok}"))
    db.commit()
    if not ok:
        raise HTTPException(status_code=400, detail=message)
    return WbReviewReplyOut(ok=True, message=message)


@router.post("/wb/questions/generate-reply", response_model=GenerateReviewReplyOut)
def wb_generate_question_reply(payload: GenerateReviewReplyIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_module_enabled(db, user.id, "wb_questions_ai")
    settings_row = _get_or_create_question_ai_settings(db, user.id)
    knowledge_ctx = _build_user_knowledge_context(db, user.id)
    prompt = _compose_ai_prompt(settings_row.prompt if settings_row and settings_row.prompt else "", knowledge_ctx, content_kind="question")
    reply = generate_review_reply(
        review_text=payload.review_text,
        product_name=payload.product_name,
        stars=None,
        prompt=prompt,
        reviewer_name=payload.reviewer_name,
        marketplace="wb",
        content_kind="question",
    )
    db.add(AuditLog(user_id=user.id, action="wb_question_reply_generated", details=f"model={settings.openai_model}"))
    db.commit()
    return GenerateReviewReplyOut(reply=reply)


@router.get("/ozon/questions", response_model=WbReviewsOut)
def ozon_questions(
    date_from: date | None = None,
    date_to: date | None = None,
    fast: bool = False,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_module_enabled(db, user.id, "wb_questions_ai")
    ozon_key = _get_active_marketplace_api_key(db, user.id, "ozon")
    if not ozon_key:
        raise HTTPException(status_code=400, detail="Сначала сохраните API ключ для ozon")
    data = fetch_ozon_questions(
        ozon_key,
        date_from=date_from.isoformat() if date_from else None,
        date_to=date_to.isoformat() if date_to else None,
        max_pages=1 if fast else 8,
        enrich_products=not fast,
    )
    if not data.get("new") and not data.get("answered"):
        ok, message = probe_ozon_feedback_access(ozon_key, feedback_kind="questions")
        if not ok:
            raise HTTPException(status_code=400, detail=message)
    db.add(
        AuditLog(
            user_id=user.id,
            action="ozon_questions_read",
            details=f"new={len(data.get('new', []))};answered={len(data.get('answered', []))}",
        )
    )
    db.commit()
    return WbReviewsOut(new=data.get("new", []), answered=data.get("answered", []))


@router.post("/ozon/questions/reply", response_model=WbReviewReplyOut)
def ozon_reply_question(payload: WbReviewReplyIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_module_enabled(db, user.id, "wb_questions_ai")
    ozon_key = _get_active_marketplace_api_key(db, user.id, "ozon")
    if not ozon_key:
        raise HTTPException(status_code=400, detail="Сначала сохраните API ключ для ozon")
    ok, message = post_ozon_question_reply(ozon_key, payload.id, payload.text)
    db.add(AuditLog(user_id=user.id, action="ozon_question_reply", details=f"question_id={payload.id};ok={ok}"))
    db.commit()
    if not ok:
        raise HTTPException(status_code=400, detail=message)
    return WbReviewReplyOut(ok=True, message=message)


@router.post("/ozon/questions/generate-reply", response_model=GenerateReviewReplyOut)
def ozon_generate_question_reply(payload: GenerateReviewReplyIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_module_enabled(db, user.id, "wb_questions_ai")
    settings_row = _get_or_create_question_ai_settings(db, user.id)
    knowledge_ctx = _build_user_knowledge_context(db, user.id)
    prompt = _compose_ai_prompt(settings_row.prompt if settings_row and settings_row.prompt else "", knowledge_ctx, content_kind="question")
    reply = generate_review_reply(
        review_text=payload.review_text,
        product_name=payload.product_name,
        stars=None,
        prompt=prompt,
        reviewer_name=payload.reviewer_name,
        marketplace="ozon",
        content_kind="question",
    )
    db.add(AuditLog(user_id=user.id, action="ozon_question_reply_generated", details=f"model={settings.openai_model}"))
    db.commit()
    return GenerateReviewReplyOut(reply=reply)


@router.get("/wb/questions/ai-settings", response_model=ReviewAiSettingsOut)
def wb_questions_get_ai_settings(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_module_enabled(db, user.id, "wb_questions_ai")
    row = _get_or_create_question_ai_settings(db, user.id)
    db.commit()
    return ReviewAiSettingsOut(reply_mode=row.reply_mode, prompt=row.prompt)


@router.post("/wb/questions/ai-settings", response_model=ReviewAiSettingsOut)
def wb_questions_save_ai_settings(payload: ReviewAiSettingsIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_module_enabled(db, user.id, "wb_questions_ai")
    row = _get_or_create_question_ai_settings(db, user.id)
    mode = payload.reply_mode.strip().lower()
    if mode not in {"manual", "suggest", "auto"}:
        raise HTTPException(status_code=400, detail="reply_mode должен быть manual, suggest или auto")
    row.reply_mode = mode
    row.prompt = _sanitize_ai_prompt(payload.prompt)
    db.add(AuditLog(user_id=user.id, action="wb_questions_ai_settings_saved", details=f"reply_mode={mode}"))
    db.commit()
    return ReviewAiSettingsOut(reply_mode=row.reply_mode, prompt=row.prompt)


@router.get("/wb/reviews/ai-settings", response_model=ReviewAiSettingsOut)
def wb_get_ai_settings(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_module_enabled(db, user.id, "wb_reviews_ai")
    row = _get_or_create_ai_settings(db, user.id)
    db.commit()
    return ReviewAiSettingsOut(reply_mode=row.reply_mode, prompt=row.prompt)


@router.post("/wb/reviews/ai-settings", response_model=ReviewAiSettingsOut)
def wb_save_ai_settings(payload: ReviewAiSettingsIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_module_enabled(db, user.id, "wb_reviews_ai")
    row = _get_or_create_ai_settings(db, user.id)
    mode = payload.reply_mode.strip().lower()
    if mode not in {"manual", "suggest", "auto"}:
        raise HTTPException(status_code=400, detail="reply_mode должен быть manual, suggest или auto")
    row.reply_mode = mode
    row.prompt = _sanitize_ai_prompt(payload.prompt)
    db.add(AuditLog(user_id=user.id, action="wb_ai_settings_saved", details=f"reply_mode={mode}"))
    db.commit()
    return ReviewAiSettingsOut(reply_mode=row.reply_mode, prompt=row.prompt)


@router.get("/wb/ads/campaigns", response_model=WbCampaignsOut)
def wb_ads_campaigns(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_module_enabled(db, user.id, "wb_ads")
    wb_key = _get_active_marketplace_api_key(db, user.id, "wb")
    if not wb_key:
        raise HTTPException(status_code=400, detail="Сначала сохраните API ключ для wb")
    rows = fetch_wb_campaigns(wb_key)
    ids = sorted({_to_int_safe(_campaign_id_from_any(row)) for row in rows if _to_int_safe(_campaign_id_from_any(row)) > 0})
    db.add(
        AuditLog(
            user_id=user.id,
            action="wb_ads_campaigns_read",
            details=f"count={len(rows)};ids={len(ids)};mode=fast",
        )
    )
    db.commit()
    return WbCampaignsOut(campaigns=rows, stats={})


@router.post("/wb/ads/campaigns/enrich", response_model=WbCampaignEnrichOut)
def wb_ads_campaigns_enrich(payload: CampaignIdsIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_module_enabled(db, user.id, "wb_ads")
    wb_key = _get_active_marketplace_api_key(db, user.id, "wb")
    if not wb_key:
        raise HTTPException(status_code=400, detail="Сначала сохраните API ключ для wb")

    ids = sorted({int(x) for x in payload.ids if int(x) > 0})[:140]
    if not ids:
        return WbCampaignEnrichOut(summaries={}, stats={})

    summaries = fetch_wb_campaign_summaries(wb_key, ids, fallback_limit=40)
    stats = fetch_wb_campaign_stats_bulk(wb_key, ids, date_from=None, date_to=None)
    db.add(
        AuditLog(
            user_id=user.id,
            action="wb_ads_campaigns_enrich",
            details=f"ids={len(ids)};summaries={len(summaries)};stats={len(stats)}",
        )
    )
    db.commit()
    return WbCampaignEnrichOut(summaries=summaries, stats=stats)


@router.post("/wb/ads/rates", response_model=WbCampaignRatesOut)
def wb_ads_rates(payload: WbCampaignRatesIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_module_enabled(db, user.id, "wb_ads")
    wb_key = _get_active_marketplace_api_key(db, user.id, "wb")
    if not wb_key:
        raise HTTPException(status_code=400, detail="Сначала сохраните API ключ для wb")
    data = fetch_wb_campaign_rates(wb_key, payload.campaign_id, payload.campaign_type)
    if data is None:
        raise HTTPException(status_code=400, detail="Не удалось получить ставки по кампании")
    db.add(
        AuditLog(
            user_id=user.id,
            action="wb_ads_rates_read",
            details=f"campaign_id={payload.campaign_id};type={payload.campaign_type}",
        )
    )
    db.commit()
    return WbCampaignRatesOut(campaign_id=payload.campaign_id, campaign_type=payload.campaign_type, data=data)


@router.get("/wb/ads/campaign-details", response_model=WbCampaignDetailOut)
def wb_ads_campaign_details(campaign_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_module_enabled(db, user.id, "wb_ads")
    wb_key = _get_active_marketplace_api_key(db, user.id, "wb")
    if not wb_key:
        raise HTTPException(status_code=400, detail="Сначала сохраните API ключ для wb")
    if campaign_id <= 0:
        raise HTTPException(status_code=400, detail="campaign_id должен быть > 0")

    data = fetch_wb_campaign_details(wb_key, campaign_id=campaign_id)
    db.add(AuditLog(user_id=user.id, action="wb_ads_campaign_details_read", details=f"campaign_id={campaign_id}"))
    db.commit()
    return WbCampaignDetailOut(campaign_id=campaign_id, data=data)


@router.get("/wb/ads/balance", response_model=WbAdsBalanceOut)
def wb_ads_balance(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_module_enabled(db, user.id, "wb_ads")
    wb_key = _get_active_marketplace_api_key(db, user.id, "wb")
    if not wb_key:
        raise HTTPException(status_code=400, detail="Сначала сохраните API ключ для wb")
    data = fetch_wb_ads_balance(wb_key)
    if data is None:
        raise HTTPException(status_code=400, detail="Не удалось получить баланс WB Ads")
    db.add(AuditLog(user_id=user.id, action="wb_ads_balance_read", details="ok=1"))
    db.commit()
    return WbAdsBalanceOut(data=data)


@router.post("/wb/ads/action", response_model=WbAdsActionOut)
def wb_ads_action(payload: WbAdsActionIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_module_enabled(db, user.id, "wb_ads")
    wb_key = _get_active_marketplace_api_key(db, user.id, "wb")
    if not wb_key:
        raise HTTPException(status_code=400, detail="Сначала сохраните API ключ для wb")
    ok, message, raw = update_wb_campaign_state(wb_key, campaign_id=payload.campaign_id, action=payload.action)
    db.add(
        AuditLog(
            user_id=user.id,
            action="wb_ads_action",
            details=f"campaign_id={payload.campaign_id};action={payload.action};ok={ok};raw={json.dumps(raw, ensure_ascii=False)[:600]}",
        )
    )
    db.commit()
    if not ok:
        raise HTTPException(status_code=400, detail=message)
    return WbAdsActionOut(campaign_id=payload.campaign_id, action=payload.action, ok=ok, message=message)


@router.get("/wb/ads/analytics", response_model=WbAdsAnalyticsOut)
def wb_ads_analytics(
    date_from: date | None = None,
    date_to: date | None = None,
    campaign_id: int | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_module_enabled(db, user.id, "wb_ads_analytics")
    wb_key = _get_active_marketplace_api_key(db, user.id, "wb")
    if not wb_key:
        raise HTTPException(status_code=400, detail="Сначала сохраните API ключ для wb")

    rows = fetch_wb_campaigns(wb_key)
    all_ids = sorted({_to_int_safe(_campaign_id_from_any(row)) for row in rows if _to_int_safe(_campaign_id_from_any(row)) > 0})
    if campaign_id is not None and campaign_id > 0:
        ids = [campaign_id]
    else:
        ids = all_ids[:120]
    if not ids:
        raise HTTPException(status_code=400, detail="Не удалось получить кампании WB Ads. Проверьте API-ключ и доступ в кабинете.")
    summaries = fetch_wb_campaign_summaries(wb_key, ids, fallback_limit=120)
    stats = fetch_wb_campaign_stats_bulk(
        wb_key,
        ids,
        date_from=date_from.isoformat() if date_from else None,
        date_to=date_to.isoformat() if date_to else None,
    )

    out_rows: list[dict[str, Any]] = []
    for cid in ids:
        key = str(cid)
        summary = summaries.get(key, {"campaign_id": cid, "name": f"Кампания {cid}", "status": "-", "type": "-", "budget": "-"})
        stat = stats.get(key, {})
        out_rows.append(
            {
                "campaign_id": cid,
                "name": summary.get("name") or f"Кампания {cid}",
                "status": summary.get("status") or "-",
                "type": summary.get("type") or "-",
                "budget": summary.get("budget") or "-",
                "views": float(stat.get("views") or 0),
                "clicks": float(stat.get("clicks") or 0),
                "orders": float(stat.get("orders") or 0),
                "spent": float(stat.get("spent") or 0),
                "ctr": float(stat.get("ctr") or 0),
                "cr": float(stat.get("cr") or 0),
                "cpc": float(stat.get("cpc") or 0),
                "cpo": float(stat.get("cpo") or 0),
            }
        )
    out_rows.sort(key=lambda x: x.get("spent", 0), reverse=True)
    totals = {
        "views": float(round(sum(x.get("views", 0) for x in out_rows), 3)),
        "clicks": float(round(sum(x.get("clicks", 0) for x in out_rows), 3)),
        "orders": float(round(sum(x.get("orders", 0) for x in out_rows), 3)),
        "spent": float(round(sum(x.get("spent", 0) for x in out_rows), 3)),
        "ctr_avg": float(round((sum(x.get("ctr", 0) for x in out_rows) / len(out_rows)) if out_rows else 0.0, 4)),
        "cr_avg": float(round((sum(x.get("cr", 0) for x in out_rows) / len(out_rows)) if out_rows else 0.0, 4)),
    }

    left = date_from.isoformat() if date_from else (date.today() - timedelta(days=6)).isoformat()
    right = date_to.isoformat() if date_to else date.today().isoformat()
    db.add(
        AuditLog(
            user_id=user.id,
            action="wb_ads_analytics_read",
            details=f"date_from={left};date_to={right};campaigns={len(out_rows)}",
        )
    )
    db.commit()
    return WbAdsAnalyticsOut(date_from=left, date_to=right, rows=out_rows, totals=totals)


@router.get("/wb/ads/recommendations", response_model=WbAdsRecommendationsOut)
def wb_ads_recommendations(
    date_from: date | None = None,
    date_to: date | None = None,
    min_spent: float = 200.0,
    campaign_id: int | None = None,
    offset: int = 0,
    limit: int = 80,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_module_enabled(db, user.id, "wb_ads_recommendations")
    wb_key = _get_active_marketplace_api_key(db, user.id, "wb")
    if not wb_key:
        raise HTTPException(status_code=400, detail="Сначала сохраните API ключ для wb")

    base_rows = fetch_wb_campaigns(wb_key)
    all_ids = sorted({_to_int_safe(_campaign_id_from_any(row)) for row in base_rows if _to_int_safe(_campaign_id_from_any(row)) > 0})
    if campaign_id is not None and campaign_id > 0:
        ids = [campaign_id]
        total_available = 1
        slice_offset = 0
        slice_limit = 1
    else:
        safe_offset = max(0, int(offset or 0))
        safe_limit = max(1, min(int(limit or 1), 120))
        ids = all_ids[safe_offset:safe_offset + safe_limit]
        total_available = len(all_ids)
        slice_offset = safe_offset
        slice_limit = safe_limit
    if not ids:
        raise HTTPException(status_code=400, detail="Не удалось получить кампании WB Ads. Проверьте API-ключ и доступ в кабинете.")
    summaries = fetch_wb_campaign_summaries(wb_key, ids, fallback_limit=120)
    stats = fetch_wb_campaign_stats_bulk(
        wb_key,
        ids,
        date_from=date_from.isoformat() if date_from else None,
        date_to=date_to.isoformat() if date_to else None,
    )

    safe_min_spent = max(0.0, float(min_spent or 0.0))
    recommendations: list[dict[str, Any]] = []
    for cid in ids:
        key = str(cid)
        summary = summaries.get(key, {})
        stat = stats.get(key, {})
        views = float(stat.get("views") or 0.0)
        clicks = float(stat.get("clicks") or 0.0)
        orders = float(stat.get("orders") or 0.0)
        spent = float(stat.get("spent") or 0.0)
        ctr = float(stat.get("ctr") or 0.0)
        cpc = float(stat.get("cpc") or 0.0)
        cpo = float(stat.get("cpo") or 0.0)
        status_text = str(summary.get("status") or "-")
        type_text = str(summary.get("type") or "-")
        status_label, is_running = _wb_status_label(status_text)
        type_label = _wb_type_label(type_text)

        recommendation = ""
        priority = "low"
        reason = ""
        action = ""
        if spent >= safe_min_spent and orders <= 0:
            recommendation = "Пауза и доработка"
            priority = "high"
            action = "pause"
            reason = "Есть расход за период, но нет заказов."
        elif spent >= safe_min_spent and clicks >= 20 and ctr < 0.5:
            recommendation = "Перезапуск креатива/семантики"
            priority = "high"
            action = "refresh"
            reason = "Низкий CTR при достаточном объеме кликов."
        elif orders >= 3 and cpo > 0 and cpo <= 700 and ctr >= 1.0:
            recommendation = "Масштабировать"
            priority = "medium"
            action = "scale"
            reason = "Стабильные заказы с приемлемым CPO."
        elif orders > 0 and cpo >= 1800:
            recommendation = "Снизить ставки"
            priority = "medium"
            action = "decrease_bids"
            reason = "Высокий CPO, кампания неэффективна."
        elif (not is_running) and orders >= 2 and cpo > 0 and cpo <= 900:
            recommendation = "Возобновить показы"
            priority = "low"
            action = "start"
            reason = "Кампания на паузе/завершена, но метрики были рабочие."

        if not recommendation:
            continue
        recommendations.append(
            {
                "campaign_id": cid,
                "name": summary.get("name") or f"Кампания {cid}",
                "status": status_label,
                "type": type_label,
                "is_running": is_running,
                "views": round(views, 3),
                "clicks": round(clicks, 3),
                "orders": round(orders, 3),
                "spent": round(spent, 3),
                "ctr": round(ctr, 4),
                "cpc": round(cpc, 4),
                "cpo": round(cpo, 4),
                "priority": priority,
                "recommendation": recommendation,
                "action": action,
                "reason": reason,
            }
        )

    priority_weight = {"high": 3, "medium": 2, "low": 1}
    recommendations.sort(
        key=lambda row: (
            -priority_weight.get(str(row.get("priority") or "").lower(), 0),
            -float(row.get("spent") or 0),
        )
    )

    left = date_from.isoformat() if date_from else (date.today() - timedelta(days=6)).isoformat()
    right = date_to.isoformat() if date_to else date.today().isoformat()
    db.add(
        AuditLog(
            user_id=user.id,
            action="wb_ads_recommendations_read",
            details=f"date_from={left};date_to={right};rows={len(recommendations)};min_spent={safe_min_spent}",
        )
    )
    db.commit()
    return WbAdsRecommendationsOut(
        date_from=left,
        date_to=right,
        rows=recommendations,
        meta={
            "min_spent": safe_min_spent,
            "campaigns_scanned": len(ids),
            "total_campaigns": total_available,
            "offset": slice_offset,
            "limit": slice_limit,
            "has_more": (slice_offset + slice_limit) < total_available,
            "next_offset": (slice_offset + slice_limit) if (slice_offset + slice_limit) < total_available else None,
        },
    )


@router.get("/ai/docs", response_model=list[KnowledgeDocOut])
def list_ai_docs(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.scalars(
        select(UserKnowledgeDoc).where(UserKnowledgeDoc.user_id == user.id).order_by(UserKnowledgeDoc.id.desc())
    ).all()
    return [
        KnowledgeDocOut(
            id=row.id,
            filename=row.filename,
            content_type=row.content_type,
            size_chars=len(row.content_text or ""),
            created_at=row.created_at.isoformat() if row.created_at else "",
        )
        for row in rows
    ]


@router.post("/ai/docs/upload", response_model=KnowledgeDocOut)
async def upload_ai_doc(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    raw = await file.read()
    text = _extract_text_from_upload(file.filename or "document", file.content_type or "", raw)
    if len(text) < 30:
        raise HTTPException(status_code=400, detail="Документ слишком короткий или не удалось извлечь текст")

    row = UserKnowledgeDoc(
        user_id=user.id,
        filename=(file.filename or "document")[:255],
        content_type=(file.content_type or "application/octet-stream")[:120],
        content_text=text[:160000],
    )
    db.add(row)
    db.add(AuditLog(user_id=user.id, action="ai_doc_uploaded", details=f"filename={row.filename};size={len(row.content_text)}"))
    db.commit()
    db.refresh(row)
    return KnowledgeDocOut(
        id=row.id,
        filename=row.filename,
        content_type=row.content_type,
        size_chars=len(row.content_text or ""),
        created_at=row.created_at.isoformat() if row.created_at else "",
    )


@router.delete("/ai/docs/{doc_id}", response_model=MessageOut)
def delete_ai_doc(doc_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    row = db.scalar(select(UserKnowledgeDoc).where(UserKnowledgeDoc.id == doc_id, UserKnowledgeDoc.user_id == user.id))
    if not row:
        raise HTTPException(status_code=404, detail="Документ не найден")
    fname = row.filename
    db.delete(row)
    db.add(AuditLog(user_id=user.id, action="ai_doc_deleted", details=f"id={doc_id};filename={fname}"))
    db.commit()
    return MessageOut(message="Документ удален")


@router.get("/help/docs", response_model=list[HelpDocOut])
def get_help_docs(
    module_code: str = "",
    lang: str = "ru",
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_module_enabled(db, user.id, "help_center")
    docs = HELP_DOCS_EN if (lang or "").strip().lower() == "en" else HELP_DOCS_RU
    items = []
    for code, payload in docs.items():
        if module_code and code != module_code:
            continue
        items.append(HelpDocOut(module_code=code, title=payload["title"], content=payload["content"]))
    return items


def _resolve_credential(db: Session, user_id: int, marketplace: str) -> ApiCredential:
    cred = db.scalar(
        select(ApiCredential)
        .where(
            ApiCredential.user_id == user_id,
            ApiCredential.marketplace == marketplace,
            ApiCredential.active.is_(True),
        )
        .order_by(ApiCredential.id.desc())
    )
    if not cred:
        raise HTTPException(status_code=400, detail=f"Сначала сохраните API ключ для {marketplace}")
    return cred


@router.post("/products/import", response_model=list[ProductOut])
def import_products(payload: ImportProductsRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    marketplace = validate_marketplace(payload.marketplace)
    cred = _resolve_credential(db, user.id, marketplace)
    upserted = upsert_products(db, user.id, marketplace, cred.api_key, payload.articles, payload.import_all)
    db.add(AuditLog(user_id=user.id, action="products_imported", details=f"count={len(upserted)};marketplace={marketplace}"))
    db.commit()
    return upserted


@router.post("/products/reload", response_model=list[ProductOut])
def reload_products(payload: ProductReloadRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    marketplace = validate_marketplace(payload.marketplace)
    cred = _resolve_credential(db, user.id, marketplace)

    existing = db.scalars(select(Product).where(Product.user_id == user.id, Product.marketplace == marketplace)).all()
    if existing:
        product_ids = [p.id for p in existing]
        old_jobs = db.scalars(select(SeoJob).where(SeoJob.user_id == user.id, SeoJob.product_id.in_(product_ids))).all()
        old_snapshots = db.scalars(
            select(PositionSnapshot).where(PositionSnapshot.user_id == user.id, PositionSnapshot.product_id.in_(product_ids))
        ).all()
        for job in old_jobs:
            db.delete(job)
        for snapshot in old_snapshots:
            db.delete(snapshot)
        for product in existing:
            db.delete(product)
        db.flush()

    upserted = upsert_products(db, user.id, marketplace, cred.api_key, payload.articles, payload.import_all)
    db.add(AuditLog(user_id=user.id, action="products_reloaded", details=f"count={len(upserted)};marketplace={marketplace}"))
    db.commit()
    return upserted


@router.post("/products/refresh", response_model=list[ProductOut])
def refresh_products_alias(payload: ProductReloadRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Backward compatibility alias for older frontend builds.
    return reload_products(payload, user, db)


@router.post("/products/reset", response_model=list[ProductOut])
def reset_products_alias(payload: ProductReloadRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return reload_products(payload, user, db)


@router.post("/products/reimport", response_model=list[ProductOut])
def reimport_products_alias(payload: ProductReloadRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return reload_products(payload, user, db)


@router.get("/products", response_model=list[ProductOut])
def list_products(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(Product).where(Product.user_id == user.id).order_by(Product.id.desc())).all()
    for row in rows:
        if not row.photo_url:
            row.photo_url = f"https://placehold.co/120x120/e8eefc/1b2a52?text={row.marketplace.upper()}%20{row.id}"
    return rows


@router.get("/products/{product_id}/keyword-suggestions", response_model=list[str])
def product_keyword_suggestions(product_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    product = db.scalar(select(Product).where(Product.id == product_id, Product.user_id == user.id))
    if not product:
        raise HTTPException(status_code=404, detail="Товар не найден")

    _hydrate_external_id_if_needed(db, user.id, product)
    competitors = find_competitors(
        product.marketplace,
        product.name,
        product.current_description,
        exclude_external_id=product.external_id or "",
    )
    discovered = discover_keywords(
        product.name,
        product.current_description,
        competitors,
        get_user_keywords(db, user.id, product.marketplace),
        [],
    )
    primary = _preferred_keyword_from_name(product.name)
    ranked = []
    if primary:
        ranked.append(primary)
    ranked.extend(discovered)
    dedup: list[str] = []
    seen: set[str] = set()
    for kw in ranked:
        k = kw.strip()
        if not k:
            continue
        lk = k.lower()
        if lk in seen:
            continue
        seen.add(lk)
        dedup.append(k)
        if len(dedup) >= 10:
            break
    return dedup


@router.post("/seo/positions/check", response_model=list[PositionCheckOut])
def check_current_positions(payload: PositionCheckRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_module_enabled(db, user.id, "rank_tracking")

    product_ids = payload.product_ids
    if payload.apply_to_all:
        product_ids = db.scalars(select(Product.id).where(Product.user_id == user.id)).all()
    if not product_ids:
        raise HTTPException(status_code=400, detail="Выберите товары для проверки позиций")

    result: list[PositionCheckOut] = []
    for product_id in product_ids:
        product = db.scalar(select(Product).where(Product.id == product_id, Product.user_id == user.id))
        if not product:
            continue
        _hydrate_external_id_if_needed(db, user.id, product)
        marketplace_api_key = _get_active_marketplace_api_key(db, user.id, product.marketplace)

        explicit_keywords = [x.strip() for x in payload.keywords if x.strip()]
        # Preserve order and remove duplicates to keep deterministic "primary keyword".
        used_keywords = list(dict.fromkeys(explicit_keywords))
        explicit_mode = bool(used_keywords)
        if not used_keywords:
            competitors = find_competitors(
                product.marketplace,
                product.name,
                product.current_description,
                exclude_external_id=product.external_id or "",
            )
            used_keywords = discover_keywords(
                product.name,
                product.current_description,
                competitors,
                get_user_keywords(db, user.id, product.marketplace),
                [],
            )[:5]

        keyword_positions = evaluate_positions_for_keywords(
            product.marketplace,
            product.article,
            used_keywords,
            external_id=product.external_id,
            product_name=product.name,
            wb_api_key=marketplace_api_key if product.marketplace == "wb" else "",
        )
        # When user explicitly requested keywords, every keyword should produce a visible position.
        # If parser cannot find exact card for a keyword, mark it as 501 (outside top-500).
        if explicit_mode:
            if not keyword_positions:
                keyword_positions = {kw: 501 for kw in used_keywords}
            else:
                for kw in used_keywords:
                    keyword_positions.setdefault(kw, 501)
        if not keyword_positions:
            fallback_pos = _safe_known_position(product.last_position)
            if fallback_pos == 0 and used_keywords:
                fallback_pos = 501
            product.last_position = fallback_pos
            linked_jobs = db.scalars(
                select(SeoJob).where(
                    SeoJob.user_id == user.id,
                    SeoJob.product_id == product.id,
                    SeoJob.status.in_(["generated", "in_progress", "applied", "top_reached"]),
                )
            ).all()
            for job in linked_jobs:
                job.current_position = fallback_pos

            result.append(
                PositionCheckOut(
                    product_id=product.id,
                    article=product.article,
                    barcode=product.barcode,
                    name=product.name,
                    used_keywords=used_keywords,
                    best_position=fallback_pos,
                    avg_position=fallback_pos,
                    keyword_positions={kw: fallback_pos for kw in used_keywords},
                )
            )
            continue
        if explicit_mode and used_keywords:
            primary_kw = used_keywords[0]
            best_position = int(keyword_positions.get(primary_kw, 501))
        else:
            best_position = min(keyword_positions.values())
        avg_position = int(round(sum(keyword_positions.values()) / len(keyword_positions)))
        product.last_position = best_position
        linked_jobs = db.scalars(
            select(SeoJob).where(
                SeoJob.user_id == user.id,
                SeoJob.product_id == product.id,
                SeoJob.status.in_(["generated", "in_progress", "applied", "top_reached"]),
            )
        ).all()
        for job in linked_jobs:
            job.current_position = best_position
            if best_position <= job.target_position:
                job.status = "top_reached"
            elif job.status == "top_reached":
                job.status = "in_progress"
            job.next_check_at = schedule_next_check(best_position, job.target_position)
        db.add(
            PositionSnapshot(
                user_id=user.id,
                product_id=product.id,
                source="manual_check",
                position=best_position,
                keywords=", ".join(used_keywords),
            )
        )

        result.append(
            PositionCheckOut(
                product_id=product.id,
                article=product.article,
                barcode=product.barcode,
                name=product.name,
                used_keywords=used_keywords,
                best_position=best_position,
                avg_position=avg_position,
                keyword_positions=keyword_positions,
            )
        )

    db.add(AuditLog(user_id=user.id, action="positions_checked", details=f"count={len(result)}"))
    db.commit()
    return result


@router.post("/seo/generate", response_model=list[SeoJobOut])
def generate_seo(payload: SeoGenerateRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_module_enabled(db, user.id, "seo_generation")

    product_ids = payload.product_ids
    if payload.apply_to_all:
        product_ids = db.scalars(select(Product.id).where(Product.user_id == user.id)).all()

    if not product_ids:
        raise HTTPException(status_code=400, detail="Нет выбранных товаров для SEO")

    jobs: list[SeoJob] = []
    for product_id in product_ids:
        product = db.scalar(select(Product).where(Product.id == product_id, Product.user_id == user.id))
        if not product:
            continue
        _hydrate_external_id_if_needed(db, user.id, product)
        marketplace_api_key = _get_active_marketplace_api_key(db, user.id, product.marketplace)

        competitors = find_competitors(
            product.marketplace,
            product.name,
            product.current_description,
            exclude_external_id=product.external_id or "",
        )
        keywords = discover_keywords(
            product.name,
            product.current_description,
            competitors,
            get_user_keywords(db, user.id, product.marketplace),
            payload.extra_keywords,
        )
        generated = build_seo_description(product.name, product.current_description, keywords, competitors)
        current_position = evaluate_position(
            product.marketplace,
            product.article,
            keywords,
            external_id=product.external_id,
            product_name=product.name,
            wb_api_key=marketplace_api_key if product.marketplace == "wb" else "",
        )
        if current_position is None:
            current_position = _safe_known_position(product.last_position)
            if current_position == 0 and keywords:
                current_position = 501
        product.target_keywords = ", ".join(keywords)
        product.last_position = current_position
        db.add(
            PositionSnapshot(
                user_id=user.id,
                product_id=product.id,
                source="generate",
                position=current_position,
                keywords=", ".join(keywords),
            )
        )

        job = SeoJob(
            user_id=user.id,
            product_id=product.id,
            status="generated",
            generated_description=generated,
            keywords_snapshot=", ".join(keywords),
            competitor_snapshot=json.dumps(
                [
                    {
                        "name": c.name,
                        "position": c.position,
                        "keywords": c.keywords[:6],
                        "url": c.url,
                    }
                    for c in competitors[:5]
                ],
                ensure_ascii=False,
            ),
            target_position=payload.target_position,
            current_position=current_position,
            next_check_at=schedule_next_check(current_position, payload.target_position),
        )
        db.add(job)
        jobs.append(job)

    db.add(AuditLog(user_id=user.id, action="seo_generated", details=f"count={len(jobs)};apply_to_all={payload.apply_to_all}"))
    db.commit()
    return [build_seo_job_out(db, x) for x in jobs]


@router.get("/seo/jobs", response_model=list[SeoJobOut])
def list_seo_jobs(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    jobs = db.scalars(select(SeoJob).where(SeoJob.user_id == user.id).order_by(SeoJob.id.desc())).all()
    return [build_seo_job_out(db, x) for x in jobs]


@router.post("/seo/jobs/delete", response_model=MessageOut)
def delete_seo_jobs(payload: SeoDeleteRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if payload.delete_all:
        jobs = db.scalars(select(SeoJob).where(SeoJob.user_id == user.id)).all()
    else:
        if not payload.job_ids:
            raise HTTPException(status_code=400, detail="Укажите задачи для удаления")
        jobs = db.scalars(select(SeoJob).where(SeoJob.user_id == user.id, SeoJob.id.in_(payload.job_ids))).all()

    deleted = 0
    for job in jobs:
        db.delete(job)
        deleted += 1

    db.add(AuditLog(user_id=user.id, action="seo_deleted", details=f"count={deleted};all={payload.delete_all}"))
    db.commit()
    return MessageOut(message=f"Удалено SEO задач: {deleted}")


@router.post("/seo/delete", response_model=MessageOut)
def delete_seo_jobs_alias(payload: SeoDeleteRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Backward compatibility alias for older frontend builds.
    return delete_seo_jobs(payload, user, db)


@router.post("/seo/clear", response_model=MessageOut)
def clear_seo_jobs_alias(payload: SeoDeleteRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return delete_seo_jobs(payload, user, db)


@router.post("/seo/jobs/clear", response_model=MessageOut)
def clear_seo_jobs_alias_v2(payload: SeoDeleteRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return delete_seo_jobs(payload, user, db)


@router.post("/seo/apply", response_model=list[SeoJobOut])
def apply_seo(payload: SeoApplyRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_module_enabled(db, user.id, "auto_apply")

    if not payload.job_ids:
        raise HTTPException(status_code=400, detail="Выберите хотя бы одну SEO-задачу")

    jobs = db.scalars(select(SeoJob).where(SeoJob.user_id == user.id, SeoJob.id.in_(payload.job_ids))).all()
    if not jobs:
        raise HTTPException(status_code=404, detail="Задачи не найдены")

    updated_jobs: list[SeoJob] = []
    for job in jobs:
        product = db.get(Product, job.product_id)
        if not product:
            continue
        _hydrate_external_id_if_needed(db, user.id, product)

        cred = _resolve_credential(db, user.id, product.marketplace)
        ok = update_product_description(product.marketplace, cred.api_key, product.article, job.generated_description)
        if not ok:
            raise HTTPException(status_code=500, detail="Ошибка применения изменений в маркетплейс")

        product.current_description = job.generated_description
        job.status = "applied"
        job.next_check_at = schedule_next_check(job.current_position, job.target_position)
        updated_jobs.append(job)

    db.add(AuditLog(user_id=user.id, action="seo_applied", details=f"count={len(updated_jobs)}"))
    db.commit()
    return [build_seo_job_out(db, x) for x in updated_jobs]


@router.post("/seo/recheck", response_model=list[SeoJobOut])
def recheck_seo(payload: SeoRecheckRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_module_enabled(db, user.id, "rank_tracking")

    if payload.recheck_all_due:
        jobs = db.scalars(
            select(SeoJob).where(
                SeoJob.user_id == user.id,
                SeoJob.status.in_(["applied", "in_progress", "generated"]),
                SeoJob.next_check_at.is_not(None),
                SeoJob.next_check_at <= datetime.utcnow(),
            )
        ).all()
    else:
        jobs = db.scalars(select(SeoJob).where(SeoJob.user_id == user.id, SeoJob.id.in_(payload.job_ids))).all()

    result: list[SeoJob] = []
    for job in jobs:
        product = db.get(Product, job.product_id)
        if not product:
            continue
        marketplace_api_key = _get_active_marketplace_api_key(db, user.id, product.marketplace)

        keywords = [k.strip() for k in job.keywords_snapshot.split(",") if k.strip()]
        current_position = evaluate_position(
            product.marketplace,
            product.article,
            keywords,
            external_id=product.external_id,
            product_name=product.name,
            wb_api_key=marketplace_api_key if product.marketplace == "wb" else "",
        )
        if current_position is None:
            current_position = _safe_known_position(job.current_position)
            if current_position == 0:
                current_position = _safe_known_position(product.last_position)
            if current_position == 0 and keywords:
                current_position = 501
        job.current_position = current_position
        product.last_position = current_position
        db.add(
            PositionSnapshot(
                user_id=user.id,
                product_id=product.id,
                source="recheck",
                position=current_position,
                keywords=", ".join(keywords),
            )
        )
        job.attempt_count += 1

        if current_position <= job.target_position:
            job.status = "top_reached"
        else:
            job.status = "in_progress"

        job.next_check_at = schedule_next_check(current_position, job.target_position)
        result.append(job)

    db.add(AuditLog(user_id=user.id, action="seo_rechecked", details=f"count={len(result)}"))
    db.commit()
    return [build_seo_job_out(db, x) for x in result]


@router.get("/dashboard", response_model=DashboardOut)
def dashboard(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    total_products = db.scalar(select(func.count()).select_from(Product).where(Product.user_id == user.id)) or 0
    total_jobs = db.scalar(select(func.count()).select_from(SeoJob).where(SeoJob.user_id == user.id)) or 0
    applied_jobs = db.scalar(select(func.count()).select_from(SeoJob).where(SeoJob.user_id == user.id, SeoJob.status == "applied")) or 0
    in_progress_jobs = db.scalar(select(func.count()).select_from(SeoJob).where(SeoJob.user_id == user.id, SeoJob.status.in_(["in_progress", "generated"]))) or 0
    top5_products = db.scalar(
        select(func.count()).select_from(Product).where(Product.user_id == user.id, Product.last_position.is_not(None), Product.last_position <= 5)
    ) or 0

    return DashboardOut(total_products=total_products, total_jobs=total_jobs, applied_jobs=applied_jobs, in_progress_jobs=in_progress_jobs, top5_products=top5_products)


@router.get("/seo/trend", response_model=TrendOut)
def seo_trend(
    days: int = 21,
    product_id: int | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    clamped_days = max(3, min(days, 90))
    since = datetime.utcnow() - timedelta(days=clamped_days - 1)
    query = select(PositionSnapshot).where(
        PositionSnapshot.user_id == user.id,
        PositionSnapshot.created_at >= since,
    )
    if product_id is not None:
        query = query.where(PositionSnapshot.product_id == product_id)

    snapshots = db.scalars(query.order_by(PositionSnapshot.created_at.asc())).all()
    buckets: dict[str, list[int]] = {}
    for snap in snapshots:
        day_key = snap.created_at.strftime("%Y-%m-%d")
        buckets.setdefault(day_key, []).append(int(snap.position))

    points: list[TrendPointOut] = []
    for offset in range(clamped_days):
        day = (since + timedelta(days=offset)).strftime("%Y-%m-%d")
        vals = buckets.get(day, [])
        checks = len(vals)
        avg = round(sum(vals) / checks, 2) if checks else 0.0
        top5 = sum(1 for x in vals if x <= 5)
        points.append(TrendPointOut(date=day, checks=checks, avg_position=avg, top5_hits=top5))

    return TrendOut(points=points)


@router.get("/sales/stats", response_model=SalesStatsOut)
def sales_stats(
    marketplace: str = "all",
    date_from: date | None = None,
    date_to: date | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_module_enabled(db, user.id, "sales_stats")
    selected_market = (marketplace or "all").strip().lower()
    if selected_market not in {"all", "wb", "ozon"}:
        raise HTTPException(status_code=400, detail="marketplace должен быть all, wb или ozon")

    right = date_to or date.today()
    left = date_from or (right - timedelta(days=29))
    if left > right:
        left, right = right, left
    if (right - left).days > 365:
        left = right - timedelta(days=365)

    wb_key = _get_active_marketplace_api_key(db, user.id, "wb")
    ozon_key = _get_active_marketplace_api_key(db, user.id, "ozon")
    payload = build_sales_report(
        marketplace=selected_market,
        date_from=left,
        date_to=right,
        wb_api_key=wb_key,
        ozon_api_key=ozon_key,
    )
    rows = payload.get("rows") if isinstance(payload, dict) else []
    chart = payload.get("chart") if isinstance(payload, dict) else []
    totals = payload.get("totals") if isinstance(payload, dict) else {}
    warnings = payload.get("warnings") if isinstance(payload, dict) else []
    rows = rows if isinstance(rows, list) else []
    chart = chart if isinstance(chart, list) else []
    totals = totals if isinstance(totals, dict) else {}
    warnings = warnings if isinstance(warnings, list) else []

    db.add(
        AuditLog(
            user_id=user.id,
            action="sales_stats_read",
            details=f"market={selected_market};from={left.isoformat()};to={right.isoformat()};rows={len(rows)}",
        )
    )
    db.commit()
    return SalesStatsOut(
        marketplace=selected_market,
        date_from=left.isoformat(),
        date_to=right.isoformat(),
        rows=rows,
        chart=chart,
        totals=totals,
        warnings=[str(x) for x in warnings],
    )


@router.get("/profile", response_model=UserProfileOut)
def profile_state(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_module_enabled(db, user.id, "user_profile")
    profile = _get_or_create_user_profile(db, user.id)
    account = _get_or_create_billing_account(db, user.id)
    payload = _build_user_profile_payload(db, user, profile, account)
    db.commit()
    return payload


@router.put("/profile", response_model=UserProfileOut)
def profile_update(payload: UserProfileUpdateIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_module_enabled(db, user.id, "user_profile")
    profile = _get_or_create_user_profile(db, user.id)

    profile.full_name = payload.full_name.strip()[:255]
    profile.company_name = payload.company_name.strip()[:255]
    profile.city = payload.city.strip()[:120]
    profile.legal_name = payload.legal_name.strip()[:255]
    profile.legal_address = payload.legal_address.strip()[:255]
    profile.tax_id = payload.tax_id.strip()[:40]
    profile.tax_rate = max(0.0, min(float(payload.tax_rate or 0.0), 100.0))
    profile.phone = payload.phone.strip()[:40]
    profile.position_title = payload.position_title.strip()[:120]
    profile.team_size = max(1, min(int(payload.team_size or 1), 100000))
    profile.company_structure = payload.company_structure.strip()[:12000]
    profile.avatar_url = payload.avatar_url.strip()[:500]

    db.add(
        AuditLog(
            user_id=user.id,
            action="profile_updated",
            details=f"company={profile.company_name};city={profile.city};team={profile.team_size}",
        )
    )
    account = _get_or_create_billing_account(db, user.id)
    db.commit()
    return _build_user_profile_payload(db, user, profile, account)


@router.post("/profile/password", response_model=MessageOut)
def profile_change_password(payload: UserProfilePasswordIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_module_enabled(db, user.id, "user_profile")
    if len(payload.new_password or "") < 8:
        raise HTTPException(status_code=400, detail="Новый пароль должен быть минимум 8 символов")
    if not verify_password(payload.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Текущий пароль указан неверно")
    user.hashed_password = get_password_hash(payload.new_password)
    db.add(AuditLog(user_id=user.id, action="profile_password_changed", details="ok=1"))
    db.commit()
    return MessageOut(message="Пароль обновлен")


@router.post("/profile/plan", response_model=UserProfileOut)
def profile_change_plan(payload: BillingPlanChangeIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_module_enabled(db, user.id, "user_profile")
    plan_code = (payload.plan_code or "").strip().lower()
    if plan_code not in BILLING_PLANS:
        raise HTTPException(status_code=400, detail=f"Неизвестный план: {plan_code}")

    account = _get_or_create_billing_account(db, user.id)
    account.plan_code = plan_code
    account.status = "active"
    account.monthly_price = int(BILLING_PLANS[plan_code]["price"])
    if not account.renew_at or account.renew_at < datetime.utcnow():
        account.renew_at = datetime.utcnow() + timedelta(days=30)
    db.add(account)
    db.add(
        BillingEvent(
            user_id=user.id,
            event_type="plan_changed",
            amount=account.monthly_price,
            note=f"План изменен на {plan_code}",
        )
    )
    db.add(AuditLog(user_id=user.id, action="profile_plan_changed", details=f"plan={plan_code}"))
    profile = _get_or_create_user_profile(db, user.id)
    db.commit()
    return _build_user_profile_payload(db, user, profile, account)


@router.post("/profile/renew", response_model=UserProfileOut)
def profile_renew_plan(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_module_enabled(db, user.id, "user_profile")
    account = _get_or_create_billing_account(db, user.id)
    base = account.renew_at if account.renew_at and account.renew_at > datetime.utcnow() else datetime.utcnow()
    account.renew_at = base + timedelta(days=30)
    account.status = "active"
    db.add(account)
    db.add(
        BillingEvent(
            user_id=user.id,
            event_type="renew",
            amount=account.monthly_price,
            note=f"Продление до {account.renew_at.isoformat()}",
        )
    )
    db.add(AuditLog(user_id=user.id, action="profile_plan_renewed", details=f"renew_at={account.renew_at.isoformat()}"))
    profile = _get_or_create_user_profile(db, user.id)
    db.commit()
    return _build_user_profile_payload(db, user, profile, account)


@router.get("/billing", response_model=BillingOut)
def billing_state(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_module_enabled(db, user.id, "billing")
    account = _get_or_create_billing_account(db, user.id)
    payload = _build_billing_payload(db, user.id, account)
    db.commit()
    return payload


@router.post("/billing/plan", response_model=BillingOut)
def billing_change_plan(payload: BillingPlanChangeIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_module_enabled(db, user.id, "billing")
    plan_code = (payload.plan_code or "").strip().lower()
    if plan_code not in BILLING_PLANS:
        raise HTTPException(status_code=400, detail=f"Неизвестный план: {plan_code}")

    account = _get_or_create_billing_account(db, user.id)
    account.plan_code = plan_code
    account.status = "active"
    account.monthly_price = int(BILLING_PLANS[plan_code]["price"])
    if not account.renew_at or account.renew_at < datetime.utcnow():
        account.renew_at = datetime.utcnow() + timedelta(days=30)
    db.add(account)
    db.add(
        BillingEvent(
            user_id=user.id,
            event_type="plan_changed",
            amount=account.monthly_price,
            note=f"План изменен на {plan_code}",
        )
    )
    db.add(AuditLog(user_id=user.id, action="billing_plan_changed", details=f"plan={plan_code}"))
    db.commit()
    return _build_billing_payload(db, user.id, account)


@router.post("/billing/renew", response_model=BillingOut)
def billing_renew(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_module_enabled(db, user.id, "billing")
    account = _get_or_create_billing_account(db, user.id)
    base = account.renew_at if account.renew_at and account.renew_at > datetime.utcnow() else datetime.utcnow()
    account.renew_at = base + timedelta(days=30)
    account.status = "active"
    db.add(account)
    db.add(
        BillingEvent(
            user_id=user.id,
            event_type="renew",
            amount=account.monthly_price,
            note=f"Продление до {account.renew_at.isoformat()}",
        )
    )
    db.add(AuditLog(user_id=user.id, action="billing_renewed", details=f"renew_at={account.renew_at.isoformat()}"))
    db.commit()
    return _build_billing_payload(db, user.id, account)


@router.get("/admin/users", response_model=list[UserOut])
def admin_users(_: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    return db.scalars(select(User).order_by(User.id.desc())).all()


@router.get("/admin/users/{user_id}/profile", response_model=AdminUserProfileOut)
def admin_user_profile(user_id: int, _: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    db.commit()
    return _build_admin_user_profile_payload(db, target)


@router.put("/admin/users/{user_id}/profile", response_model=AdminUserProfileOut)
def admin_user_profile_update(
    user_id: int,
    payload: UserProfileUpdateIn,
    me: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    profile = _get_or_create_user_profile(db, target.id)

    profile.full_name = payload.full_name.strip()[:255]
    profile.company_name = payload.company_name.strip()[:255]
    profile.city = payload.city.strip()[:120]
    profile.legal_name = payload.legal_name.strip()[:255]
    profile.legal_address = payload.legal_address.strip()[:255]
    profile.tax_id = payload.tax_id.strip()[:40]
    profile.tax_rate = max(0.0, min(float(payload.tax_rate or 0.0), 100.0))
    profile.phone = payload.phone.strip()[:40]
    profile.position_title = payload.position_title.strip()[:120]
    profile.team_size = max(1, min(int(payload.team_size or 1), 100000))
    profile.company_structure = payload.company_structure.strip()[:12000]
    profile.avatar_url = payload.avatar_url.strip()[:500]

    db.add(
        AuditLog(
            user_id=me.id,
            action="admin_user_profile_updated",
            details=f"user_id={target.id};company={profile.company_name};city={profile.city};team={profile.team_size}",
        )
    )
    db.commit()
    return _build_admin_user_profile_payload(db, target)


@router.post("/admin/users/{user_id}/plan", response_model=AdminUserProfileOut)
def admin_user_change_plan(
    user_id: int,
    payload: BillingPlanChangeIn,
    me: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    plan_code = (payload.plan_code or "").strip().lower()
    if plan_code not in BILLING_PLANS:
        raise HTTPException(status_code=400, detail=f"Неизвестный план: {plan_code}")

    account = _get_or_create_billing_account(db, target.id)
    account.plan_code = plan_code
    account.status = "active"
    account.monthly_price = int(BILLING_PLANS[plan_code]["price"])
    if not account.renew_at or account.renew_at < datetime.utcnow():
        account.renew_at = datetime.utcnow() + timedelta(days=30)
    db.add(account)
    db.add(
        BillingEvent(
            user_id=target.id,
            event_type="admin_plan_changed",
            amount=account.monthly_price,
            note=f"Администратор изменил план на {plan_code}",
        )
    )
    db.add(
        AuditLog(
            user_id=me.id,
            action="admin_user_plan_changed",
            details=f"user_id={target.id};plan={plan_code}",
        )
    )
    db.commit()
    return _build_admin_user_profile_payload(db, target)


@router.get("/admin/stats", response_model=AdminStatsOut)
def admin_stats(_: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    week_ago = datetime.utcnow() - timedelta(days=7)
    total_users = db.scalar(select(func.count()).select_from(User)) or 0
    new_users_7d = db.scalar(select(func.count()).select_from(User).where(User.created_at >= week_ago)) or 0
    total_products = db.scalar(select(func.count()).select_from(Product)) or 0
    total_jobs = db.scalar(select(func.count()).select_from(SeoJob)) or 0
    active_jobs = db.scalar(select(func.count()).select_from(SeoJob).where(SeoJob.status.in_(["generated", "in_progress"]))) or 0
    return AdminStatsOut(
        total_users=total_users,
        new_users_7d=new_users_7d,
        total_products=total_products,
        total_jobs=total_jobs,
        active_jobs=active_jobs,
    )


@router.post("/admin/users/password", response_model=MessageOut)
def admin_reset_password(payload: AdminPasswordResetIn, _: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    user = db.get(User, payload.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    if len(payload.new_password) < 8:
        raise HTTPException(status_code=400, detail="Пароль должен быть минимум 8 символов")

    user.hashed_password = get_password_hash(payload.new_password)
    db.add(AuditLog(user_id=user.id, action="admin_password_reset", details="password_updated"))
    db.commit()
    return MessageOut(message="Пароль пользователя обновлен")


@router.post("/admin/users/role", response_model=MessageOut)
def admin_set_role(payload: AdminRoleUpdateIn, me: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    user = db.get(User, payload.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    role = payload.role.strip().lower()
    if role not in {"admin", "client"}:
        raise HTTPException(status_code=400, detail="role должен быть admin или client")
    if user.id == me.id and role != "admin":
        raise HTTPException(status_code=400, detail="Нельзя снять admin c текущего пользователя")
    user.role = role
    db.add(AuditLog(user_id=me.id, action="admin_role_updated", details=f"user_id={user.id};role={role}"))
    db.commit()
    return MessageOut(message="Роль пользователя обновлена")


@router.delete("/admin/users/{user_id}", response_model=MessageOut)
def admin_delete_user(user_id: int, me: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    if user.id == me.id:
        raise HTTPException(status_code=400, detail="Нельзя удалить текущего администратора")
    db.delete(user)
    db.add(AuditLog(user_id=me.id, action="admin_user_deleted", details=f"user_id={user_id}"))
    db.commit()
    return MessageOut(message="Пользователь удален")


@router.get("/admin/modules", response_model=list[ModuleAccessOut])
def admin_modules(_: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(ModuleAccess)).all()
    return [ModuleAccessOut(user_id=r.user_id, module_code=r.module_code, enabled=r.enabled) for r in rows]


@router.get("/admin/ui/settings", response_model=UiSettingsOut)
def admin_get_ui_settings(_: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    return _get_ui_settings(db)


@router.post("/admin/ui/settings", response_model=UiSettingsOut)
def admin_save_ui_settings(payload: UiSettingsIn, me: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    next_payload = _sanitize_ui_settings_payload(
        {
            "theme_choice_enabled": bool(payload.theme_choice_enabled),
            "default_theme": payload.default_theme,
            "allowed_themes": payload.allowed_themes,
        }
    )
    _set_system_setting(db, "ui_settings", json.dumps(next_payload, ensure_ascii=False))
    db.add(AuditLog(user_id=me.id, action="admin_ui_settings_updated", details=json.dumps(next_payload, ensure_ascii=False)))
    db.commit()
    return UiSettingsOut(**next_payload)


@router.post("/admin/modules", response_model=ModuleAccessOut)
def set_module_access(payload: ModuleAccessIn, me: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    if payload.module_code not in DEFAULT_MODULES:
        raise HTTPException(status_code=400, detail=f"Неизвестный module_code: {payload.module_code}")
    row = db.scalar(select(ModuleAccess).where(ModuleAccess.user_id == payload.user_id, ModuleAccess.module_code == payload.module_code))
    if not row:
        row = ModuleAccess(user_id=payload.user_id, module_code=payload.module_code, enabled=payload.enabled)
        db.add(row)
    else:
        row.enabled = payload.enabled

    db.add(
        AuditLog(
            user_id=me.id,
            action="admin_module_updated",
            details=f"user_id={payload.user_id};module={payload.module_code};enabled={payload.enabled}",
        )
    )
    db.commit()
    return ModuleAccessOut(user_id=row.user_id, module_code=row.module_code, enabled=row.enabled)


@router.get("/admin/credentials", response_model=list[ApiCredentialOut])
def admin_list_credentials(user_id: int, _: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    creds = db.scalars(
        select(ApiCredential).where(ApiCredential.user_id == user_id).order_by(ApiCredential.id.desc())
    ).all()
    return [ApiCredentialOut(id=c.id, marketplace=c.marketplace, api_key_masked=mask_key(c.api_key), active=c.active) for c in creds]


@router.get("/admin/credentials/all", response_model=list[AdminCredentialRowOut])
def admin_list_all_credentials(_: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    rows = db.execute(
        select(ApiCredential, User.email)
        .join(User, User.id == ApiCredential.user_id)
        .order_by(ApiCredential.id.desc())
    ).all()
    return [
        AdminCredentialRowOut(
            id=cred.id,
            user_id=cred.user_id,
            user_email=email,
            marketplace=cred.marketplace,
            api_key_masked=mask_key(cred.api_key),
            active=cred.active,
            created_at=cred.created_at,
        )
        for cred, email in rows
    ]


@router.post("/admin/credentials", response_model=ApiCredentialOut)
def admin_save_credential(payload: AdminCredentialIn, _: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    marketplace = validate_marketplace(payload.marketplace)
    user = db.get(User, payload.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    creds = db.scalars(
        select(ApiCredential)
        .where(ApiCredential.user_id == payload.user_id, ApiCredential.marketplace == marketplace)
        .order_by(ApiCredential.id.desc())
    ).all()
    if creds:
        cred = creds[0]
        cred.api_key = payload.api_key
        cred.active = True
        for stale in creds[1:]:
            stale.active = False
    else:
        cred = ApiCredential(user_id=payload.user_id, marketplace=marketplace, api_key=payload.api_key, active=True)
        db.add(cred)

    db.add(AuditLog(user_id=payload.user_id, action="admin_credential_saved", details=f"marketplace={marketplace}"))
    db.commit()
    return ApiCredentialOut(id=cred.id, marketplace=cred.marketplace, api_key_masked=mask_key(cred.api_key), active=cred.active)


@router.delete("/admin/credentials/{credential_id}", response_model=MessageOut)
def admin_delete_credential(credential_id: int, _: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    cred = db.get(ApiCredential, credential_id)
    if not cred:
        raise HTTPException(status_code=404, detail="Ключ не найден")
    db.delete(cred)
    db.commit()
    return MessageOut(message="Ключ удален")


@router.get("/admin/audit", response_model=list[AuditLogOut])
def admin_audit(limit: int = 200, _: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    clamped = max(10, min(limit, 1000))
    return db.scalars(select(AuditLog).order_by(AuditLog.id.desc()).limit(clamped)).all()


def upsert_products(db: Session, user_id: int, marketplace: str, api_key: str, articles: list[str], import_all: bool) -> list[Product]:
    data = fetch_products_from_marketplace(marketplace, api_key, articles, import_all)
    upserted: list[Product] = []
    for item in data:
        product = db.scalar(
            select(Product).where(Product.user_id == user_id, Product.marketplace == marketplace, Product.article == item.article)
        )
        if not product:
            product = Product(
                user_id=user_id,
                marketplace=marketplace,
                article=item.article,
                external_id=item.external_id,
                barcode=item.barcode,
                photo_url=item.photo_url or f"https://placehold.co/120x120/e8eefc/1b2a52?text={marketplace.upper()}",
                name=item.name,
                current_description=item.description,
                target_keywords="",
            )
            db.add(product)
        else:
            product.name = item.name
            product.external_id = item.external_id or product.external_id
            product.barcode = item.barcode
            product.photo_url = item.photo_url or product.photo_url
            product.current_description = item.description
        upserted.append(product)
    return upserted


def build_seo_job_out(db: Session, job: SeoJob) -> SeoJobOut:
    product = db.get(Product, job.product_id)
    article = product.article if product else "-"
    name = product.name if product else "Удаленный товар"
    barcode = product.barcode if product else ""
    competitor_items: list[dict] = []
    competitor_snapshot = job.competitor_snapshot
    if competitor_snapshot:
        try:
            parsed = json.loads(competitor_snapshot)
            if isinstance(parsed, list):
                competitor_items = [x for x in parsed if isinstance(x, dict)]
                lines = []
                for idx, c in enumerate(competitor_items, start=1):
                    cname = c.get("name") or f"Конкурент {idx}"
                    cpos = c.get("position") or idx
                    ckw = ", ".join(c.get("keywords") or [])
                    lines.append(f"#{cpos}: {cname}" + (f" | ключи: {ckw}" if ckw else ""))
                competitor_snapshot = "\n".join(lines) if lines else competitor_snapshot
        except Exception:
            pass

    generated = _sanitize_generated_description(job.generated_description)

    return SeoJobOut(
        id=job.id,
        product_id=job.product_id,
        product_article=article,
        product_name=name,
        product_barcode=barcode,
        status=job.status,
        generated_description=generated,
        keywords_snapshot=job.keywords_snapshot,
        competitor_snapshot=competitor_snapshot,
        competitor_items=competitor_items,
        target_position=job.target_position,
        current_position=job.current_position,
        next_check_at=job.next_check_at,
    )


def get_user_keywords(db: Session, user_id: int, marketplace: str) -> list[str]:
    rows = db.scalars(
        select(UserKeyword.keyword).where(UserKeyword.user_id == user_id, UserKeyword.marketplace.in_(["all", marketplace]))
    ).all()
    return list(dict.fromkeys([x.strip() for x in rows if x and x.strip()]))


def _get_active_marketplace_api_key(db: Session, user_id: int, marketplace: str) -> str:
    cred = db.scalar(
        select(ApiCredential)
        .where(
            ApiCredential.user_id == user_id,
            ApiCredential.marketplace == marketplace,
            ApiCredential.active.is_(True),
        )
        .order_by(ApiCredential.id.desc())
    )
    return cred.api_key if cred and cred.api_key else ""


def _get_or_create_ai_settings(db: Session, user_id: int) -> UserAiSettings:
    row = db.scalar(select(UserAiSettings).where(UserAiSettings.user_id == user_id))
    if row:
        return row
    row = UserAiSettings(user_id=user_id, reply_mode="manual", prompt="")
    db.add(row)
    db.flush()
    return row


def _get_or_create_question_ai_settings(db: Session, user_id: int) -> UserQuestionAiSettings:
    row = db.scalar(select(UserQuestionAiSettings).where(UserQuestionAiSettings.user_id == user_id))
    if row:
        return row
    row = UserQuestionAiSettings(user_id=user_id, reply_mode="manual", prompt="")
    db.add(row)
    db.flush()
    return row


def _campaign_id_from_any(row: dict[str, Any]) -> str:
    if not isinstance(row, dict):
        return ""
    for key in ("advertId", "advert_id", "campaignId", "campaign_id", "id", "adId"):
        value = row.get(key)
        text = str(value).strip() if value is not None else ""
        if text and text != "0":
            return text
    return ""


def _to_int_safe(value: Any) -> int:
    try:
        return int(str(value).strip())
    except Exception:
        return 0


def _wb_status_label(raw_value: str) -> tuple[str, bool]:
    raw = (raw_value or "").strip()
    code = _to_int_safe(raw)
    labels = {
        -1: "удалена",
        1: "черновик",
        2: "модерация",
        3: "отклонена",
        4: "готова к запуску",
        5: "запланирована",
        6: "идут показы",
        7: "завершена",
        8: "отменена",
        9: "активна",
        10: "пауза по дневному лимиту",
        11: "пауза",
    }
    if code:
        label = labels.get(code, f"статус {code}")
        return f"{code} ({label})", code in {6, 9}
    lower = raw.lower()
    if not lower or lower == "-":
        return "-", False
    is_running = ("active" in lower) or ("актив" in lower)
    return raw, is_running


def _wb_type_label(raw_value: str) -> str:
    raw = (raw_value or "").strip()
    code = _to_int_safe(raw)
    labels = {
        4: "search",
        5: "catalog",
        6: "cards",
        7: "recommendation",
        8: "auto-cpm",
        9: "search + catalog",
    }
    if code:
        label = labels.get(code, f"type-{code}")
        return f"{code} ({label})"
    return raw or "-"


def _merge_campaign_row(row: dict[str, Any], summary: dict[str, Any], stat: dict[str, Any]) -> dict[str, Any]:
    next_row = dict(row or {})
    if summary:
        if not _campaign_id_from_any(next_row) and summary.get("campaign_id"):
            next_row["advertId"] = summary.get("campaign_id")
        if summary.get("name") and not str(next_row.get("name") or "").strip():
            next_row["name"] = summary.get("name")
        if summary.get("status") and not str(next_row.get("status") or next_row.get("state") or "").strip():
            next_row["status"] = summary.get("status")
        if summary.get("type") and not str(next_row.get("type") or next_row.get("campaignType") or "").strip():
            next_row["type"] = summary.get("type")
        if summary.get("budget") and not str(next_row.get("dailyBudget") or next_row.get("budget") or "").strip():
            next_row["budget"] = summary.get("budget")
    if stat:
        for key in ("views", "clicks", "orders", "spent", "ctr", "cr", "cpc", "cpo", "add_to_cart"):
            if key in stat:
                next_row[key] = stat.get(key)
    return next_row


def _build_user_knowledge_context(db: Session, user_id: int, max_chars: int = 12000) -> str:
    rows = db.scalars(
        select(UserKnowledgeDoc).where(UserKnowledgeDoc.user_id == user_id).order_by(UserKnowledgeDoc.updated_at.desc()).limit(30)
    ).all()
    if not rows:
        return ""
    parts: list[str] = []
    budget = max(1000, max_chars)
    for row in rows:
        text = " ".join((row.content_text or "").split())
        if not text:
            continue
        head = f"[{row.filename}] "
        rest = max(0, budget - len(head))
        if rest <= 0:
            break
        chunk = text[:rest]
        parts.append(f"{head}{chunk}")
        budget -= len(head) + len(chunk)
        if budget <= 0:
            break
    return "\n\n".join(parts)


def _compose_ai_prompt(base_prompt: str, knowledge_context: str, content_kind: str) -> str:
    base = (base_prompt or "").strip()
    docs = (knowledge_context or "").strip()
    if not docs:
        return base
    preface = (
        "Используй базу знаний ниже как приоритетный источник фактов для ответа на вопрос клиента."
        if (content_kind or "").strip().lower() == "question"
        else "Используй базу знаний ниже как приоритетный источник фактов для ответа на отзыв клиента."
    )
    if base:
        return f"{base}\n\n{preface}\n\nБаза знаний:\n{docs}"
    return f"{preface}\n\nБаза знаний:\n{docs}"


def _extract_text_from_upload(filename: str, content_type: str, raw: bytes) -> str:
    if not raw:
        return ""
    name = (filename or "").strip().lower()
    ctype = (content_type or "").strip().lower()
    if len(raw) > 7_000_000:
        raise HTTPException(status_code=400, detail="Файл слишком большой (максимум 7MB)")

    is_pdf = name.endswith(".pdf") or "pdf" in ctype
    if is_pdf:
        text = _extract_pdf_text(raw)
        if not text:
            raise HTTPException(status_code=400, detail="Не удалось извлечь текст из PDF. Проверьте, что PDF не скан-изображение.")
        return " ".join(text.split())

    allowed = (".txt", ".md", ".csv", ".tsv", ".log", ".json", ".xml", ".yml", ".yaml")
    if not any(name.endswith(ext) for ext in allowed) and "text/" not in ctype:
        raise HTTPException(status_code=400, detail="Поддерживаются txt/md/csv/tsv/log/json/xml/yml/yaml/pdf")
    return " ".join(_decode_bytes(raw).split())


def _decode_bytes(raw: bytes) -> str:
    for enc in ("utf-8", "cp1251", "latin-1"):
        try:
            return raw.decode(enc)
        except Exception:
            continue
    return raw.decode("utf-8", errors="ignore")


def _extract_pdf_text(raw: bytes) -> str:
    bio = io.BytesIO(raw)
    # Optional dependency support to keep deploy lightweight.
    for module_name, class_name in (("pypdf", "PdfReader"), ("PyPDF2", "PdfReader")):
        try:
            module = __import__(module_name, fromlist=[class_name])
            reader_cls = getattr(module, class_name)
            reader = reader_cls(bio)
            parts: list[str] = []
            for page in list(reader.pages)[:120]:
                try:
                    parts.append(page.extract_text() or "")
                except Exception:
                    continue
            return "\n".join(parts)
        except Exception:
            bio.seek(0)
            continue
    raise HTTPException(
        status_code=400,
        detail="PDF-парсинг недоступен: установите пакет pypdf и перезапустите сервис.",
    )


def _get_or_create_user_profile(db: Session, user_id: int) -> UserProfile:
    row = db.scalar(select(UserProfile).where(UserProfile.user_id == user_id))
    if row:
        return row
    row = UserProfile(
        user_id=user_id,
        full_name="",
        company_name="",
        city="",
        legal_name="",
        legal_address="",
        tax_id="",
        tax_rate=0.0,
        phone="",
        position_title="",
        team_size=1,
        company_structure="",
        avatar_url="",
    )
    db.add(row)
    db.flush()
    return row


def _build_admin_user_profile_payload(db: Session, target: User) -> AdminUserProfileOut:
    profile = _get_or_create_user_profile(db, target.id)
    account = _get_or_create_billing_account(db, target.id)
    credentials = db.scalars(select(ApiCredential).where(ApiCredential.user_id == target.id).order_by(ApiCredential.id.desc())).all()
    return AdminUserProfileOut(
        user_id=target.id,
        email=target.email,
        role=target.role,
        profile={
            "full_name": profile.full_name,
            "company_name": profile.company_name,
            "city": profile.city,
            "legal_name": profile.legal_name,
            "legal_address": profile.legal_address,
            "tax_id": profile.tax_id,
            "tax_rate": profile.tax_rate,
            "phone": profile.phone,
            "position_title": profile.position_title,
            "team_size": profile.team_size,
            "company_structure": profile.company_structure,
            "avatar_url": profile.avatar_url,
        },
        plan={
            "plan_code": account.plan_code,
            "status": account.status,
            "monthly_price": int(account.monthly_price or 0),
            "renew_at": account.renew_at.isoformat() if account.renew_at else None,
        },
        credentials=[
            ApiCredentialOut(
                id=c.id,
                marketplace=c.marketplace,
                api_key_masked=mask_key(c.api_key),
                active=bool(c.active),
            )
            for c in credentials
        ],
    )


def _build_user_profile_payload(db: Session, user: User, profile: UserProfile, account: BillingAccount) -> UserProfileOut:
    creds = db.scalars(select(ApiCredential).where(ApiCredential.user_id == user.id).order_by(ApiCredential.id.desc())).all()
    plans = [
        {
            "code": code,
            "title": str(info.get("title") or code),
            "price": int(info.get("price") or 0),
            "limits": dict(info.get("limits") or {}),
        }
        for code, info in BILLING_PLANS.items()
    ]
    return UserProfileOut(
        email=user.email,
        full_name=profile.full_name,
        company_name=profile.company_name,
        city=profile.city,
        legal_name=profile.legal_name,
        legal_address=profile.legal_address,
        tax_id=profile.tax_id,
        tax_rate=float(profile.tax_rate or 0.0),
        phone=profile.phone,
        position_title=profile.position_title,
        team_size=int(profile.team_size or 1),
        company_structure=profile.company_structure,
        avatar_url=profile.avatar_url,
        plan_code=account.plan_code,
        plan_status=account.status,
        monthly_price=int(account.monthly_price or 0),
        renew_at=account.renew_at.isoformat() if account.renew_at else None,
        available_plans=plans,
        credentials=[
            ApiCredentialOut(
                id=c.id,
                marketplace=c.marketplace,
                api_key_masked=mask_key(c.api_key),
                active=bool(c.active),
            )
            for c in creds
        ],
    )


def _get_or_create_billing_account(db: Session, user_id: int) -> BillingAccount:
    row = db.scalar(select(BillingAccount).where(BillingAccount.user_id == user_id))
    if row:
        return row
    plan_code = "starter"
    info = BILLING_PLANS[plan_code]
    row = BillingAccount(
        user_id=user_id,
        plan_code=plan_code,
        status="active",
        monthly_price=int(info["price"]),
        renew_at=datetime.utcnow() + timedelta(days=30),
        auto_renew=True,
    )
    db.add(row)
    db.flush()
    db.add(BillingEvent(user_id=user_id, event_type="created", amount=int(info["price"]), note="Создан billing аккаунт"))
    return row


def _build_billing_payload(db: Session, user_id: int, account: BillingAccount) -> BillingOut:
    plan_code = (account.plan_code or "starter").lower()
    if plan_code not in BILLING_PLANS:
        plan_code = "starter"
    limits = dict(BILLING_PLANS[plan_code]["limits"])

    now = datetime.utcnow()
    month_start = datetime(now.year, now.month, 1)
    usage_products = db.scalar(select(func.count()).select_from(Product).where(Product.user_id == user_id)) or 0
    usage_jobs = db.scalar(select(func.count()).select_from(SeoJob).where(SeoJob.user_id == user_id, SeoJob.created_at >= month_start)) or 0
    usage_replies = db.scalar(
        select(func.count()).select_from(AuditLog).where(
            AuditLog.user_id == user_id,
            AuditLog.created_at >= month_start,
            AuditLog.action.in_(["wb_review_reply", "ozon_review_reply", "wb_question_reply", "ozon_question_reply"]),
        )
    ) or 0
    usage = {
        "products": int(usage_products),
        "seo_jobs_month": int(usage_jobs),
        "ai_replies_month": int(usage_replies),
    }

    mods = db.scalars(select(ModuleAccess).where(ModuleAccess.user_id == user_id).order_by(ModuleAccess.module_code.asc())).all()
    modules = [{"module_code": x.module_code, "enabled": bool(x.enabled)} for x in mods]

    hist_rows = db.scalars(
        select(BillingEvent).where(BillingEvent.user_id == user_id).order_by(BillingEvent.id.desc()).limit(100)
    ).all()
    history = [
        {
            "id": row.id,
            "event_type": row.event_type,
            "amount": row.amount,
            "note": row.note,
            "created_at": row.created_at.isoformat() if row.created_at else "",
        }
        for row in hist_rows
    ]

    plans = [
        {
            "code": code,
            "title": str(info.get("title") or code),
            "price": int(info.get("price") or 0),
            "limits": dict(info.get("limits") or {}),
        }
        for code, info in BILLING_PLANS.items()
    ]
    renew_at = account.renew_at.isoformat() if account.renew_at else None
    return BillingOut(
        plan_code=plan_code,
        status=account.status,
        monthly_price=int(account.monthly_price or 0),
        renew_at=renew_at,
        auto_renew=bool(account.auto_renew),
        limits=limits,
        usage=usage,
        available_plans=plans,
        modules=modules,
        history=history,
    )


def _sanitize_ai_prompt(text: str) -> str:
    compact = " ".join((text or "").split())
    if len(compact) > 6000:
        return compact[:6000]
    return compact


def _hydrate_external_id_if_needed(db: Session, user_id: int, product: Product) -> None:
    if product.marketplace != "wb":
        return
    if product.external_id:
        return
    cred = db.scalar(
        select(ApiCredential)
        .where(
            ApiCredential.user_id == user_id,
            ApiCredential.marketplace == "wb",
            ApiCredential.active.is_(True),
        )
        .order_by(ApiCredential.id.desc())
    )
    if not cred:
        return
    resolved = resolve_wb_external_id(cred.api_key, product.article, product.name)
    if resolved:
        product.external_id = resolved


def _safe_known_position(value: int | None) -> int:
    if value is None:
        return 0
    if value <= 0:
        return 0
    if value > 500:
        return 501
    return int(value)


def _get_system_setting(db: Session, key: str) -> str:
    row = db.scalar(select(SystemSetting).where(SystemSetting.key == key))
    if not row:
        return ""
    return str(row.value or "")


def _set_system_setting(db: Session, key: str, value: str) -> None:
    row = db.scalar(select(SystemSetting).where(SystemSetting.key == key))
    if not row:
        row = SystemSetting(key=key, value=value)
        db.add(row)
        db.flush()
        return
    row.value = value


def _sanitize_ui_settings_payload(raw: dict[str, Any] | None) -> dict[str, Any]:
    data = raw if isinstance(raw, dict) else {}
    enabled = bool(data.get("theme_choice_enabled", DEFAULT_UI_SETTINGS["theme_choice_enabled"]))
    default_theme = str(data.get("default_theme") or DEFAULT_UI_SETTINGS["default_theme"]).strip().lower()
    if default_theme not in AVAILABLE_THEMES:
        default_theme = str(DEFAULT_UI_SETTINGS["default_theme"])
    allowed_raw = data.get("allowed_themes")
    allowed_in = allowed_raw if isinstance(allowed_raw, list) else list(DEFAULT_UI_SETTINGS["allowed_themes"])
    allowed: list[str] = []
    seen: set[str] = set()
    for theme in allowed_in:
        code = str(theme or "").strip().lower()
        if not code or code not in AVAILABLE_THEMES or code in seen:
            continue
        seen.add(code)
        allowed.append(code)
    if not allowed:
        allowed = [str(DEFAULT_UI_SETTINGS["default_theme"])]
    if default_theme not in allowed:
        default_theme = allowed[0]
    return {
        "theme_choice_enabled": enabled,
        "default_theme": default_theme,
        "allowed_themes": allowed,
    }


def _get_ui_settings(db: Session) -> UiSettingsOut:
    raw = _get_system_setting(db, "ui_settings")
    if not raw:
        safe_default = _sanitize_ui_settings_payload(DEFAULT_UI_SETTINGS)
        _set_system_setting(db, "ui_settings", json.dumps(safe_default, ensure_ascii=False))
        db.commit()
        return UiSettingsOut(**safe_default)
    try:
        parsed = json.loads(raw)
    except Exception:
        parsed = {}
    safe = _sanitize_ui_settings_payload(parsed)
    if safe != parsed:
        _set_system_setting(db, "ui_settings", json.dumps(safe, ensure_ascii=False))
        db.commit()
    return UiSettingsOut(**safe)


def _preferred_keyword_from_name(name: str) -> str:
    low = name.lower()
    if "утепл" in low and "труб" in low:
        return "утеплитель для труб"
    if "дымоход" in low and "труб" in low:
        return "труба дымохода"
    if "колено" in low and "дымоход" in low:
        return "колено дымохода"
    words = [w for w in low.replace("/", " ").replace("-", " ").split() if len(w) >= 4]
    if len(words) >= 2:
        return f"{words[0]} {words[1]}"
    if words:
        return words[0]
    return ""


def _sanitize_generated_description(text: str) -> str:
    raw = text or ""
    banned = (
        "Формулировки сделаны короткими и понятными, чтобы быстро оценить назначение и совместимость товара.",
    )
    for phrase in banned:
        raw = raw.replace(phrase, "").strip()
    raw = " ".join(raw.split())
    return raw


def ensure_module_enabled(db: Session, user_id: int, module_code: str):
    row = db.scalar(
        select(ModuleAccess).where(
            ModuleAccess.user_id == user_id,
            ModuleAccess.module_code == module_code,
            ModuleAccess.enabled.is_(True),
        )
    )
    if not row:
        raise HTTPException(status_code=403, detail=f"Модуль '{module_code}' отключен для вашего тарифа")


def validate_marketplace(value: str) -> str:
    marketplace = value.strip().lower()
    if marketplace not in {"wb", "ozon"}:
        raise HTTPException(status_code=400, detail="marketplace должен быть wb или ozon")
    return marketplace


def mask_key(api_key: str) -> str:
    if len(api_key) <= 8:
        return "*" * len(api_key)
    return f"{api_key[:4]}...{api_key[-4:]}"
