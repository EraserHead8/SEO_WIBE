from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    actor_email: EmailStr | None = None
    role: str
    created_at: datetime | None = None
    actor_key: str | None = None
    actor_nick: str | None = None
    actor_is_owner: bool | None = None
    actor_member_id: int | None = None
    avatar_url: str | None = None


class AvatarUploadOut(BaseModel):
    url: str


class ApiCredentialIn(BaseModel):
    marketplace: str
    api_key: str


class ApiCredentialOut(BaseModel):
    id: int
    marketplace: str
    api_key_masked: str
    active: bool


class AdminCredentialRowOut(BaseModel):
    id: int
    user_id: int
    user_email: str
    marketplace: str
    api_key_masked: str
    active: bool
    created_at: datetime


class CredentialTestOut(BaseModel):
    ok: bool
    message: str


class ImportProductsRequest(BaseModel):
    marketplace: str
    articles: list[str] = []
    import_all: bool = False


class ProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    marketplace: str
    article: str
    external_id: str
    barcode: str
    photo_url: str
    name: str
    category_name: str = ""
    purchase_price: float = 0.0
    price_base: float = 0.0
    price_discount: float = 0.0
    price_min: float = 0.0
    price_marketing: float = 0.0
    current_description: str
    target_keywords: str
    last_position: int | None


class ProductUpdateIn(BaseModel):
    name: str | None = None
    barcode: str | None = None
    category_name: str | None = None
    current_description: str | None = None
    photo_url: str | None = None
    photos_order: list[str] | None = None
    target_keywords: str | None = None
    purchase_price: float | None = None
    price_base: float | None = None
    price_discount: float | None = None
    price_min: float | None = None
    price_marketing: float | None = None


class ProductBulkDeleteIn(BaseModel):
    product_ids: list[int] = Field(default_factory=list)


class ProductDetailOut(BaseModel):
    product: ProductOut
    photos: list[str] = Field(default_factory=list)
    attributes: dict[str, Any] = Field(default_factory=dict)
    raw: dict[str, Any] = Field(default_factory=dict)
    warnings: list[str] = Field(default_factory=list)


class ProductPageOut(BaseModel):
    rows: list[ProductOut] = Field(default_factory=list)
    categories: list[str] = Field(default_factory=list)
    total: int = 0
    page: int = 1
    page_size: int = 30
    total_pages: int = 0


class SeoGenerateRequest(BaseModel):
    product_ids: list[int] = []
    extra_keywords: list[str] = []
    target_position: int = 5
    apply_to_all: bool = False


class SeoApplyRequest(BaseModel):
    job_ids: list[int]


class SeoRecheckRequest(BaseModel):
    job_ids: list[int] = []
    recheck_all_due: bool = False


class SeoDeleteRequest(BaseModel):
    job_ids: list[int] = []
    delete_all: bool = False


class PositionCheckRequest(BaseModel):
    product_ids: list[int] = []
    keywords: list[str] = []
    apply_to_all: bool = False


class PositionCheckOut(BaseModel):
    product_id: int
    article: str
    barcode: str
    name: str
    used_keywords: list[str]
    best_position: int
    avg_position: int
    keyword_positions: dict[str, int]


class SeoJobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    product_article: str
    product_name: str
    product_barcode: str
    status: str
    generated_description: str
    keywords_snapshot: str
    competitor_snapshot: str | None = None
    competitor_items: list[dict] = Field(default_factory=list)
    target_position: int
    current_position: int | None
    next_check_at: datetime | None


class DashboardOut(BaseModel):
    total_products: int
    total_jobs: int
    applied_jobs: int
    in_progress_jobs: int
    top5_products: int


class ModuleAccessIn(BaseModel):
    user_id: int
    module_code: str
    enabled: bool


class ModuleAccessOut(BaseModel):
    user_id: int
    module_code: str
    enabled: bool


class CurrentModuleOut(BaseModel):
    module_code: str
    enabled: bool


class KeywordIn(BaseModel):
    marketplace: str = "all"
    keyword: str


class KeywordOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    marketplace: str
    keyword: str
    created_at: datetime


class AdminCredentialIn(BaseModel):
    user_id: int
    marketplace: str
    api_key: str


class MessageOut(BaseModel):
    message: str


class ProductReloadRequest(BaseModel):
    marketplace: str
    import_all: bool = True
    articles: list[str] = []


class TrendPointOut(BaseModel):
    date: str
    checks: int
    avg_position: float
    top5_hits: int


class TrendOut(BaseModel):
    points: list[TrendPointOut]


class AdminStatsOut(BaseModel):
    total_users: int
    new_users_7d: int
    total_products: int
    total_jobs: int
    active_jobs: int
    total_team_members: int = 0
    employees_total: int = 0
    active_users_24h: int = 0
    audit_events_24h: int = 0


class AdminPasswordResetIn(BaseModel):
    user_id: int
    new_password: str


class AdminRoleUpdateIn(BaseModel):
    user_id: int
    role: str


class AuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int | None
    action: str
    details: str
    actor_email: str = ""
    actor_member_id: int | None = None
    actor_is_owner: bool = True
    module_code: str = ""
    entity_type: str = ""
    entity_id: str = ""
    status: str = "ok"
    ip: str = ""
    user_agent: str = ""
    created_at: datetime


class AuditLogPageOut(BaseModel):
    rows: list[AuditLogOut] = Field(default_factory=list)
    total: int = 0
    page: int = 1
    page_size: int = 100
    total_pages: int = 0


class ActivityTrackIn(BaseModel):
    action: str
    module_code: str = ""
    details: str = ""
    entity_type: str = ""
    entity_id: str = ""
    status: str = "ok"


class WbReviewOut(BaseModel):
    id: str
    date: str
    created_at: str
    product: str
    article: str
    barcode: str = ""
    state: str = ""
    sku: int | None = None
    stars: int
    text: str
    user: str
    answer: str
    is_answered: bool
    photos: list[str] = Field(default_factory=list)


class WbReviewsOut(BaseModel):
    new: list[WbReviewOut]
    answered: list[WbReviewOut]


class WbReviewReplyIn(BaseModel):
    id: str
    text: str
    state: str | None = None
    sku: int | None = None


class WbReviewReplyOut(BaseModel):
    ok: bool
    message: str


class ReturnActionIn(BaseModel):
    id: str
    action: str
    comment: str = ""


class ReturnActionOut(BaseModel):
    ok: bool
    message: str
    id: str
    action: str


class ReturnsOut(BaseModel):
    rows: list[dict[str, Any]]
    warnings: list[str] = Field(default_factory=list)


class ReviewAiSettingsIn(BaseModel):
    reply_mode: str = "manual"
    prompt: str = ""


class ReviewAiSettingsOut(BaseModel):
    reply_mode: str
    prompt: str


class GenerateReviewReplyIn(BaseModel):
    review_text: str = ""
    product_name: str = ""
    reviewer_name: str = ""
    stars: int | None = None


class GenerateReviewReplyOut(BaseModel):
    reply: str


class WbCampaignsOut(BaseModel):
    campaigns: list[dict[str, Any]]
    stats: dict[str, dict[str, Any]] = Field(default_factory=dict)
    meta: dict[str, Any] = Field(default_factory=dict)


class WbCampaignEnrichOut(BaseModel):
    summaries: dict[str, dict[str, Any]] = Field(default_factory=dict)
    stats: dict[str, dict[str, Any]] = Field(default_factory=dict)
    meta: dict[str, Any] = Field(default_factory=dict)


class WbCampaignRatesIn(BaseModel):
    campaign_id: int
    campaign_type: str = "search"


class WbCampaignRatesOut(BaseModel):
    campaign_id: int
    campaign_type: str
    data: dict[str, Any]


class WbCampaignDetailOut(BaseModel):
    campaign_id: int
    data: dict[str, Any]


class WbAdsActionIn(BaseModel):
    campaign_id: int
    action: str


class WbAdsActionOut(BaseModel):
    campaign_id: int
    action: str
    ok: bool
    message: str


class WbAdsBalanceOut(BaseModel):
    data: dict[str, Any]


class WbAdsAnalyticsOut(BaseModel):
    date_from: str
    date_to: str
    rows: list[dict[str, Any]]
    totals: dict[str, float]


class WbAdsRecommendationsOut(BaseModel):
    date_from: str
    date_to: str
    rows: list[dict[str, Any]]
    meta: dict[str, Any]


class WbBidderRuleIn(BaseModel):
    campaign_id: int
    target_kind: str = "normquery"
    nm_id: int = 0
    target_value: str = ""
    placement: str = "search"
    strategy: str = "optimal"
    desired_bid: int = 0
    min_bid: int = 0
    max_bid: int = 0
    step_bid: int = 100
    target_pos_from: float = 1.0
    target_pos_to: float = 5.0
    min_clicks: int = 0
    is_active: bool = True
    cooldown_sec: int = 300
    notes: str = ""


class WbBidderRuleUpdateIn(BaseModel):
    campaign_id: int | None = None
    target_kind: str | None = None
    nm_id: int | None = None
    target_value: str | None = None
    placement: str | None = None
    strategy: str | None = None
    desired_bid: int | None = None
    min_bid: int | None = None
    max_bid: int | None = None
    step_bid: int | None = None
    target_pos_from: float | None = None
    target_pos_to: float | None = None
    min_clicks: int | None = None
    is_active: bool | None = None
    cooldown_sec: int | None = None
    notes: str | None = None


class WbBidderRuleOut(BaseModel):
    id: int
    campaign_id: int
    target_kind: str
    nm_id: int
    target_value: str
    placement: str
    strategy: str
    desired_bid: int
    min_bid: int
    max_bid: int
    step_bid: int
    target_pos_from: float
    target_pos_to: float
    min_clicks: int
    is_active: bool
    cooldown_sec: int
    notes: str
    last_run_at: str | None
    last_status: str
    last_reason: str
    created_at: str
    updated_at: str


class WbBidderRulesOut(BaseModel):
    rows: list[WbBidderRuleOut]
    meta: dict[str, Any] = Field(default_factory=dict)


class WbBidderRunRowOut(BaseModel):
    id: int
    rule_id: int
    campaign_id: int
    target_kind: str
    nm_id: int
    target_value: str
    placement: str
    previous_bid: int
    next_bid: int
    min_bid_floor: int
    avg_position: float
    clicks: float
    orders: float
    spent: float
    changed: bool
    status: str
    reason: str
    created_at: str


class WbBidderRunsOut(BaseModel):
    rows: list[WbBidderRunRowOut]
    meta: dict[str, Any] = Field(default_factory=dict)


class WbBidderRunIn(BaseModel):
    rule_ids: list[int] = Field(default_factory=list)
    force: bool = False


class WbBidderRunOut(BaseModel):
    ok: bool
    message: str
    results: list[dict[str, Any]] = Field(default_factory=list)
    meta: dict[str, Any] = Field(default_factory=dict)


class CampaignIdsIn(BaseModel):
    ids: list[int] = []


class BillingPlanChangeIn(BaseModel):
    plan_code: str


class BillingOut(BaseModel):
    plan_code: str
    status: str
    monthly_price: int
    renew_at: str | None
    auto_renew: bool
    limits: dict[str, int]
    usage: dict[str, int]
    available_plans: list[dict[str, Any]]
    modules: list[dict[str, Any]]
    history: list[dict[str, Any]]


class KnowledgeDocOut(BaseModel):
    id: int
    filename: str
    content_type: str
    size_chars: int
    created_at: str


class HelpDocOut(BaseModel):
    module_code: str
    title: str
    content: str


class HelpReleaseOut(BaseModel):
    version: str
    released_at: str
    current: bool = False
    summary: str = ""
    diff_from_previous: list[str] = Field(default_factory=list)
    changes: list[str] = Field(default_factory=list)
    android_download_url: str = ""
    android_download_name: str = ""
    app_entry_url: str = ""
    notes: str = ""


class MobileApkLatestOut(BaseModel):
    version: str
    version_code: int = 0
    released_at: str = ""
    summary: str = ""
    android_download_url: str = ""
    android_download_name: str = ""
    notes: str = ""


class AiServiceIn(BaseModel):
    name: str = ""
    provider: str = "openai"
    api_key: str = ""
    model: str = ""
    base_url: str = ""


class AiServiceReorderIn(BaseModel):
    service_ids: list[int] = Field(default_factory=list)


class AiServiceOut(BaseModel):
    id: int
    scope: str
    user_id: int | None = None
    name: str
    provider: str
    model: str
    base_url: str
    api_key_masked: str
    priority: int = 1000
    is_active: bool = True
    created_at: str | None = None


class AiSelectionIn(BaseModel):
    use_global_default: bool = True
    mode: str = "builtin"
    service_id: int | None = None


class AiSelectionOut(BaseModel):
    use_global_default: bool
    mode: str
    service_id: int | None = None


class AiEffectiveOut(BaseModel):
    mode: str
    service_id: int | None = None
    service_name: str = ""
    provider: str = "builtin"
    model: str = ""
    source: str = "builtin"


class AiProfileOut(BaseModel):
    selection: AiSelectionOut
    global_default: AiSelectionOut
    effective: AiEffectiveOut
    effective_chain: list[AiEffectiveOut] = Field(default_factory=list)
    user_services: list[AiServiceOut] = Field(default_factory=list)
    global_services: list[AiServiceOut] = Field(default_factory=list)


class AiAssistantIn(BaseModel):
    question: str = ""
    module_code: str = ""


class AiAssistantOut(BaseModel):
    answer: str
    provider: str
    mode: str
    service_name: str = ""


class SalesStatsRowOut(BaseModel):
    date: str
    bucket: str | None = None
    marketplace: str
    orders: int
    units: int
    buyouts: int = 0
    order_amount: float = 0.0
    buyout_amount: float = 0.0
    revenue: float
    returns: int = 0
    ad_spend: float = 0.0
    penalties: float = 0.0
    income: float = 0.0
    expense: float = 0.0
    net: float = 0.0
    commission: float = 0.0
    logistics: float = 0.0
    storage: float = 0.0
    deductions: float = 0.0
    acceptance: float = 0.0
    other_expense: float = 0.0


class SalesStatsPointOut(BaseModel):
    date: str
    bucket: str | None = None
    orders: int
    units: int
    buyouts: int = 0
    order_amount: float = 0.0
    buyout_amount: float = 0.0
    revenue: float
    returns: int = 0
    ad_spend: float = 0.0
    penalties: float = 0.0
    income: float = 0.0
    expense: float = 0.0
    net: float = 0.0
    commission: float = 0.0
    logistics: float = 0.0
    storage: float = 0.0
    deductions: float = 0.0
    acceptance: float = 0.0
    other_expense: float = 0.0
    wb_orders: int = 0
    wb_units: int = 0
    wb_buyouts: int = 0
    wb_order_amount: float = 0.0
    wb_buyout_amount: float = 0.0
    wb_revenue: float = 0.0
    wb_returns: int = 0
    wb_ad_spend: float = 0.0
    wb_penalties: float = 0.0
    wb_income: float = 0.0
    wb_expense: float = 0.0
    wb_net: float = 0.0
    wb_commission: float = 0.0
    wb_logistics: float = 0.0
    wb_storage: float = 0.0
    wb_deductions: float = 0.0
    wb_acceptance: float = 0.0
    wb_other_expense: float = 0.0
    ozon_orders: int = 0
    ozon_units: int = 0
    ozon_buyouts: int = 0
    ozon_order_amount: float = 0.0
    ozon_buyout_amount: float = 0.0
    ozon_revenue: float = 0.0
    ozon_returns: int = 0
    ozon_ad_spend: float = 0.0
    ozon_penalties: float = 0.0
    ozon_income: float = 0.0
    ozon_expense: float = 0.0
    ozon_net: float = 0.0
    ozon_commission: float = 0.0
    ozon_logistics: float = 0.0
    ozon_storage: float = 0.0
    ozon_deductions: float = 0.0
    ozon_acceptance: float = 0.0
    ozon_other_expense: float = 0.0


class SalesStatsOut(BaseModel):
    marketplace: str
    date_from: str
    date_to: str
    granularity: str = "day"
    timezone: str = "UTC"
    rows: list[SalesStatsRowOut]
    chart: list[SalesStatsPointOut]
    comparison_rows: list[SalesStatsRowOut] = Field(default_factory=list)
    comparison_chart: list[SalesStatsPointOut] = Field(default_factory=list)
    totals: dict[str, float | int]
    comparison: dict[str, Any] = Field(default_factory=dict)
    warnings: list[str] = Field(default_factory=list)


class AccountingExpenseIn(BaseModel):
    marketplace: str = "all"
    category: str
    amount: float = 0.0
    recurrence: str = "monthly"
    start_date: str | None = None
    end_date: str | None = None
    note: str = ""
    is_active: bool = True


class AccountingExpenseOut(BaseModel):
    id: int
    marketplace: str
    category: str
    amount: float
    recurrence: str
    start_date: str | None = None
    end_date: str | None = None
    note: str
    is_active: bool
    created_at: str | None = None
    updated_at: str | None = None


class AccountingSettingsIn(BaseModel):
    vat_rate: float = 0.0
    tax_rate: float = 0.0
    additional_rate: float = 0.0
    fixed_cost_per_month: float = 0.0


class AccountingSettingsOut(BaseModel):
    vat_rate: float = 0.0
    tax_rate: float = 0.0
    additional_rate: float = 0.0
    fixed_cost_per_month: float = 0.0
    updated_at: str | None = None


class AccountingOverviewOut(BaseModel):
    orders: int = 0
    units: int = 0
    buyouts: int = 0
    returns: int = 0
    revenue: float = 0.0
    cogs: float = 0.0
    gross_profit: float = 0.0
    marketplace_expense: float = 0.0
    operating_profit: float = 0.0
    custom_expenses: float = 0.0
    additional_cost: float = 0.0
    vat_amount: float = 0.0
    tax_amount: float = 0.0
    net_profit: float = 0.0
    margin: float = 0.0
    commission: float = 0.0
    logistics: float = 0.0
    storage: float = 0.0
    deductions: float = 0.0
    acceptance: float = 0.0
    penalties: float = 0.0
    other_expense: float = 0.0
    ad_spend: float = 0.0
    settings: dict[str, float] = Field(default_factory=dict)
    by_marketplace: dict[str, dict[str, float | int]] = Field(default_factory=dict)


class AccountingChartPointOut(BaseModel):
    date: str
    bucket: str
    revenue: float = 0.0
    cogs: float = 0.0
    marketplace_expense: float = 0.0
    gross_profit: float = 0.0
    operating_profit: float = 0.0
    net_profit: float = 0.0


class AccountingAnalysisRowOut(BaseModel):
    marketplace: str
    article: str
    external_id: str = ""
    name: str = ""
    sold_units: int = 0
    returns: int = 0
    return_rate: float = 0.0
    revenue: float = 0.0
    purchase_price: float = 0.0
    cogs: float = 0.0
    commission: float = 0.0
    logistics: float = 0.0
    storage: float = 0.0
    deductions: float = 0.0
    acceptance: float = 0.0
    penalties: float = 0.0
    other_expense: float = 0.0
    ad_spend: float = 0.0
    marketplace_expense: float = 0.0
    gross_profit: float = 0.0
    operating_profit: float = 0.0
    extra_expenses: float = 0.0
    additional_cost: float = 0.0
    tax: float = 0.0
    vat: float = 0.0
    net_profit: float = 0.0
    margin: float = 0.0


class AccountingDataOut(BaseModel):
    marketplace: str
    date_from: str
    date_to: str
    overview: AccountingOverviewOut
    chart: list[AccountingChartPointOut] = Field(default_factory=list)
    analysis_rows: list[AccountingAnalysisRowOut] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class AccountingExpenseListOut(BaseModel):
    rows: list[AccountingExpenseOut] = Field(default_factory=list)


class AccountingPurchasePriceImportOut(BaseModel):
    updated: int = 0
    skipped: int = 0
    unmatched: list[str] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)


class UserProfileUpdateIn(BaseModel):
    full_name: str = ""
    company_name: str = ""
    city: str = ""
    legal_name: str = ""
    legal_address: str = ""
    tax_id: str = ""
    tax_rate: float = 0.0
    phone: str = ""
    position_title: str = ""
    team_size: int = 1
    company_structure: str = ""
    avatar_url: str = ""


class UserProfilePasswordIn(BaseModel):
    current_password: str
    new_password: str


class TeamMemberIn(BaseModel):
    email: str
    password: str = ""
    phone: str = ""
    full_name: str = ""
    city: str = ""
    position_title: str = ""
    nickname: str = ""
    avatar_url: str = ""
    access_scope: list[str] = Field(default_factory=list)


class TeamMemberOut(BaseModel):
    id: int
    email: str
    has_password: bool = False
    phone: str
    full_name: str
    city: str = ""
    position_title: str = ""
    nickname: str
    avatar_url: str
    access_scope: list[str] = Field(default_factory=list)
    is_owner: bool
    is_active: bool
    created_at: str | None = None


class UserProfileOut(BaseModel):
    email: str
    full_name: str
    company_name: str
    city: str
    legal_name: str
    legal_address: str
    tax_id: str
    tax_rate: float
    phone: str
    position_title: str
    team_size: int
    company_structure: str
    avatar_url: str
    plan_code: str
    plan_status: str
    monthly_price: int
    renew_at: str | None
    available_plans: list[dict[str, Any]]
    credentials: list[ApiCredentialOut]
    team_members: list[TeamMemberOut] = Field(default_factory=list)


class AdminUserProfileOut(BaseModel):
    user_id: int
    email: str
    role: str
    profile: dict[str, Any]
    plan: dict[str, Any]
    credentials: list[ApiCredentialOut]
    team_members: list[TeamMemberOut] = Field(default_factory=list)


class UiSettingsOut(BaseModel):
    theme_choice_enabled: bool
    force_theme: bool = False
    default_theme: str
    allowed_themes: list[str]


class UiSettingsIn(BaseModel):
    theme_choice_enabled: bool = True
    force_theme: bool = False
    default_theme: str = "classic"
    allowed_themes: list[str] = Field(default_factory=lambda: ["classic", "dark", "light", "newyear", "summer", "autumn", "winter", "spring", "japan", "greenland", "moon"])


class SocialGameScoreIn(BaseModel):
    game_code: str
    score: int = 0


class SocialGameScoreOut(BaseModel):
    game_code: str
    actor_key: str
    actor_nick: str
    best_score: int
    last_score: int
    play_count: int
    updated_at: str | None = None


class SocialLeaderboardOut(BaseModel):
    game_code: str
    top: list[dict[str, Any]] = Field(default_factory=list)
    my_rank: int | None = None
    my_best: int = 0


class SocialChatDirectStartIn(BaseModel):
    actor_key: str


class SocialChatMessageIn(BaseModel):
    text: str
    reply_to_message_id: int | None = None


class SocialChatReactionIn(BaseModel):
    emoji: str


class SocialChatGroupIn(BaseModel):
    title: str
    member_keys: list[str] = Field(default_factory=list)
    avatar_url: str = ""


class SocialChatGroupUpdateIn(BaseModel):
    title: str | None = None
    member_keys: list[str] | None = None
    avatar_url: str | None = None


class SocialChatThreadAvatarIn(BaseModel):
    avatar_url: str = ""


class SocialChatThreadOut(BaseModel):
    id: int
    kind: str
    title: str
    avatar_url: str | None = None
    last_message: dict[str, Any] = Field(default_factory=dict)
    unread: int = 0
    participants: list[dict[str, Any]] = Field(default_factory=list)


class SocialCurrencyRatesOut(BaseModel):
    base: str = "RUB"
    date: str | None = None
    updated_at: str | None = None
    source: str = "cbr"
    stale: bool = False
    rates: dict[str, float] = Field(default_factory=dict)


class SocialChatMessageOut(BaseModel):
    id: int
    thread_id: int
    sender_key: str
    sender_nick: str
    sender_avatar: str | None = None
    text: str
    created_at: str
    reply_to: dict[str, Any] | None = None
    attachments: list[dict[str, Any]] = Field(default_factory=list)
    reactions: list[dict[str, Any]] = Field(default_factory=list)
    is_mine: bool = False
    delivery_status: str | None = None
    delivery_read_by: int = 0
    delivery_total: int = 0


class SocialTaskProjectIn(BaseModel):
    title: str
    description: str = ""


class SocialTaskProjectOut(BaseModel):
    id: int
    title: str
    description: str = ""
    created_by_key: str
    created_by_nick: str
    created_at: str


class SocialTaskIn(BaseModel):
    project_id: int | None = None
    title: str
    description: str = ""
    priority: str = "normal"
    due_date: str | None = None
    assignee_key: str = ""


class SocialTaskUpdateIn(BaseModel):
    project_id: int | None = None
    title: str | None = None
    description: str | None = None
    status: str | None = None
    priority: str | None = None
    due_date: str | None = None
    assignee_key: str | None = None


class SocialTaskCommentIn(BaseModel):
    text: str


class SocialTaskOut(BaseModel):
    id: int
    project_id: int | None = None
    project_title: str = ""
    title: str
    description: str
    status: str
    priority: str
    due_date: str | None = None
    assignee_key: str = ""
    assignee_nick: str = ""
    creator_key: str = ""
    creator_nick: str = ""
    comments: list[dict[str, Any]] = Field(default_factory=list)
    created_at: str
    updated_at: str


class SocialCalendarEventIn(BaseModel):
    title: str
    details: str = ""
    start_at: str
    end_at: str | None = None
    is_public: bool = False


class SocialCalendarEventOut(BaseModel):
    id: int
    title: str
    details: str = ""
    start_at: str
    end_at: str | None = None
    created_at: str
    is_public: bool = False


class SocialCalendarGoogleSyncIn(BaseModel):
    ical_url: str
    is_public: bool = True
    replace_source_events: bool = False


class SocialCalendarGoogleSyncOut(BaseModel):
    ok: bool = True
    imported: int = 0
    updated: int = 0
    deleted: int = 0
    skipped: int = 0
    warnings: list[str] = Field(default_factory=list)


class SocialNoteIn(BaseModel):
    title: str = ""
    content: str = ""


class SocialNoteFileOut(BaseModel):
    id: int
    filename: str
    url: str
    content_type: str = ""
    size_bytes: int = 0
    created_at: str


class SocialNoteOut(BaseModel):
    id: int
    title: str
    content: str
    updated_at: str
    files: list[SocialNoteFileOut] = Field(default_factory=list)


class SocialNotificationOut(BaseModel):
    id: int
    kind: str
    title: str
    body: str
    payload: dict[str, Any] = Field(default_factory=dict)
    created_at: str


class NotificationSoundSettingsOut(BaseModel):
    desktop_enabled: bool = True
    chat_enabled: bool = True
    task_enabled: bool = True
    calendar_enabled: bool = True
    default_sound_url: str = ""
    chat_sound_url: str = ""
    task_sound_url: str = ""
    calendar_sound_url: str = ""


class NotificationSoundSettingsIn(BaseModel):
    desktop_enabled: bool = True
    chat_enabled: bool = True
    task_enabled: bool = True
    calendar_enabled: bool = True
    default_sound_url: str = ""
    chat_sound_url: str = ""
    task_sound_url: str = ""
    calendar_sound_url: str = ""


class SocialAnnouncementIn(BaseModel):
    title: str
    body: str = ""
    starts_at: str
    ends_at: str | None = None
    is_active: bool = True
    user_id: int | None = None
    user_ids: list[int] = Field(default_factory=list)


class SocialAnnouncementOut(BaseModel):
    id: int
    title: str
    body: str = ""
    starts_at: str
    ends_at: str | None = None
    is_active: bool = True
    user_id: int | None = None
    user_ids: list[int] = Field(default_factory=list)
    created_by_user_id: int | None = None
    created_at: str
    updated_at: str


class SocialAnnouncementPublicOut(BaseModel):
    id: int
    title: str
    body: str = ""
    starts_at: str
    ends_at: str | None = None
