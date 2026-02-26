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
    role: str
    created_at: datetime | None = None


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
    current_description: str
    target_keywords: str
    last_position: int | None


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
    created_at: datetime


class WbReviewOut(BaseModel):
    id: str
    date: str
    created_at: str
    product: str
    article: str
    barcode: str = ""
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


class WbReviewReplyOut(BaseModel):
    ok: bool
    message: str


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


class WbCampaignEnrichOut(BaseModel):
    summaries: dict[str, dict[str, Any]] = Field(default_factory=dict)
    stats: dict[str, dict[str, Any]] = Field(default_factory=dict)


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


class SalesStatsRowOut(BaseModel):
    date: str
    marketplace: str
    orders: int
    units: int
    revenue: float
    returns: int = 0
    ad_spend: float = 0.0
    other_costs: float = 0.0


class SalesStatsPointOut(BaseModel):
    date: str
    orders: int
    units: int
    revenue: float
    returns: int = 0
    ad_spend: float = 0.0
    other_costs: float = 0.0


class SalesStatsOut(BaseModel):
    marketplace: str
    date_from: str
    date_to: str
    rows: list[SalesStatsRowOut]
    chart: list[SalesStatsPointOut]
    totals: dict[str, float | int]
    warnings: list[str] = Field(default_factory=list)


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


class AdminUserProfileOut(BaseModel):
    user_id: int
    email: str
    role: str
    profile: dict[str, Any]
    plan: dict[str, Any]
    credentials: list[ApiCredentialOut]


class UiSettingsOut(BaseModel):
    theme_choice_enabled: bool
    default_theme: str
    allowed_themes: list[str]


class UiSettingsIn(BaseModel):
    theme_choice_enabled: bool = True
    default_theme: str = "classic"
    allowed_themes: list[str] = Field(default_factory=lambda: ["classic", "dark", "light", "newyear", "summer", "autumn", "winter", "spring"])
