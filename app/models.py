from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), default="client")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    credentials: Mapped[list["ApiCredential"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    products: Mapped[list["Product"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    keywords: Mapped[list["UserKeyword"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    ai_settings: Mapped["UserAiSettings | None"] = relationship(back_populates="user", cascade="all, delete-orphan")
    question_ai_settings: Mapped["UserQuestionAiSettings | None"] = relationship(back_populates="user", cascade="all, delete-orphan")
    knowledge_docs: Mapped[list["UserKnowledgeDoc"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    profile: Mapped["UserProfile | None"] = relationship(back_populates="user", cascade="all, delete-orphan")
    team_members: Mapped[list["TeamMember"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    billing_account: Mapped["BillingAccount | None"] = relationship(back_populates="user", cascade="all, delete-orphan")
    billing_events: Mapped[list["BillingEvent"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    accounting_settings: Mapped["AccountingSettings | None"] = relationship(back_populates="user", cascade="all, delete-orphan")
    accounting_expenses: Mapped[list["AccountingExpense"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class ApiCredential(Base):
    __tablename__ = "api_credentials"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    marketplace: Mapped[str] = mapped_column(String(30), index=True)
    api_key: Mapped[str] = mapped_column(String(255))
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="credentials")


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    marketplace: Mapped[str] = mapped_column(String(30), index=True)
    article: Mapped[str] = mapped_column(String(120), index=True)
    external_id: Mapped[str] = mapped_column(String(120), default="", index=True)
    barcode: Mapped[str] = mapped_column(String(64), default="", index=True)
    photo_url: Mapped[str] = mapped_column(String(500), default="")
    photos_json: Mapped[str] = mapped_column(Text, default="[]")
    name: Mapped[str] = mapped_column(String(255))
    category_name: Mapped[str] = mapped_column(String(255), default="", index=True)
    purchase_price: Mapped[float] = mapped_column(Float, default=0.0)
    price_base: Mapped[float] = mapped_column(Float, default=0.0)
    price_discount: Mapped[float] = mapped_column(Float, default=0.0)
    price_min: Mapped[float] = mapped_column(Float, default=0.0)
    price_marketing: Mapped[float] = mapped_column(Float, default=0.0)
    current_description: Mapped[str] = mapped_column(Text, default="")
    target_keywords: Mapped[str] = mapped_column(Text, default="")
    last_position: Mapped[int | None] = mapped_column(Integer, nullable=True)
    owner_member_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="products")
    seo_jobs: Mapped[list["SeoJob"]] = relationship(back_populates="product", cascade="all, delete-orphan")
    position_snapshots: Mapped[list["PositionSnapshot"]] = relationship(
        back_populates="product",
        cascade="all, delete-orphan",
    )


class SeoJob(Base):
    __tablename__ = "seo_jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), index=True)
    status: Mapped[str] = mapped_column(String(30), default="generated")
    generated_description: Mapped[str] = mapped_column(Text)
    keywords_snapshot: Mapped[str] = mapped_column(Text)
    competitor_snapshot: Mapped[str | None] = mapped_column(Text, nullable=True)
    target_position: Mapped[int] = mapped_column(Integer, default=5)
    current_position: Mapped[int | None] = mapped_column(Integer, nullable=True)
    next_check_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    attempt_count: Mapped[int] = mapped_column(Integer, default=0)
    owner_member_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    product: Mapped["Product"] = relationship(back_populates="seo_jobs")


class UserKeyword(Base):
    __tablename__ = "user_keywords"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    marketplace: Mapped[str] = mapped_column(String(30), default="all", index=True)
    keyword: Mapped[str] = mapped_column(String(255), index=True)
    owner_member_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="keywords")


class ModuleAccess(Base):
    __tablename__ = "module_access"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    module_code: Mapped[str] = mapped_column(String(60), index=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class UserAiSettings(Base):
    __tablename__ = "user_ai_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True, unique=True)
    reply_mode: Mapped[str] = mapped_column(String(16), default="manual")
    prompt: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="ai_settings")


class UserQuestionAiSettings(Base):
    __tablename__ = "user_question_ai_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True, unique=True)
    reply_mode: Mapped[str] = mapped_column(String(16), default="manual")
    prompt: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="question_ai_settings")


class UserKnowledgeDoc(Base):
    __tablename__ = "user_knowledge_docs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    filename: Mapped[str] = mapped_column(String(255), default="")
    content_type: Mapped[str] = mapped_column(String(120), default="")
    content_text: Mapped[str] = mapped_column(Text, default="")
    owner_member_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="knowledge_docs")


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True, unique=True)
    full_name: Mapped[str] = mapped_column(String(255), default="")
    company_name: Mapped[str] = mapped_column(String(255), default="")
    city: Mapped[str] = mapped_column(String(120), default="")
    legal_name: Mapped[str] = mapped_column(String(255), default="")
    legal_address: Mapped[str] = mapped_column(String(255), default="")
    tax_id: Mapped[str] = mapped_column(String(40), default="")
    tax_rate: Mapped[float] = mapped_column(Float, default=0.0)
    phone: Mapped[str] = mapped_column(String(40), default="")
    position_title: Mapped[str] = mapped_column(String(120), default="")
    team_size: Mapped[int] = mapped_column(Integer, default=1)
    company_structure: Mapped[str] = mapped_column(Text, default="")
    avatar_url: Mapped[str] = mapped_column(String(500), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="profile")


class TeamMember(Base):
    __tablename__ = "team_members"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    email: Mapped[str] = mapped_column(String(255), default="", index=True)
    phone: Mapped[str] = mapped_column(String(40), default="")
    full_name: Mapped[str] = mapped_column(String(255), default="")
    city: Mapped[str] = mapped_column(String(120), default="")
    position_title: Mapped[str] = mapped_column(String(120), default="")
    nickname: Mapped[str] = mapped_column(String(120), default="")
    avatar_url: Mapped[str] = mapped_column(String(500), default="")
    hashed_password: Mapped[str] = mapped_column(String(255), default="")
    access_scope: Mapped[str] = mapped_column(Text, default="")
    is_owner: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="team_members")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    action: Mapped[str] = mapped_column(String(120))
    details: Mapped[str] = mapped_column(Text, default="")
    actor_email: Mapped[str] = mapped_column(String(255), default="", index=True)
    actor_member_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    actor_is_owner: Mapped[bool] = mapped_column(Boolean, default=True)
    module_code: Mapped[str] = mapped_column(String(80), default="", index=True)
    entity_type: Mapped[str] = mapped_column(String(80), default="", index=True)
    entity_id: Mapped[str] = mapped_column(String(120), default="", index=True)
    status: Mapped[str] = mapped_column(String(24), default="ok", index=True)
    ip: Mapped[str] = mapped_column(String(80), default="")
    user_agent: Mapped[str] = mapped_column(String(500), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class PositionSnapshot(Base):
    __tablename__ = "position_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), index=True)
    source: Mapped[str] = mapped_column(String(30), default="check")
    position: Mapped[int] = mapped_column(Integer)
    keywords: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

    product: Mapped["Product"] = relationship(back_populates="position_snapshots")


class BillingAccount(Base):
    __tablename__ = "billing_accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True, unique=True)
    plan_code: Mapped[str] = mapped_column(String(30), default="starter")
    status: Mapped[str] = mapped_column(String(20), default="active")
    monthly_price: Mapped[int] = mapped_column(Integer, default=0)
    renew_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    auto_renew: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="billing_account")


class BillingEvent(Base):
    __tablename__ = "billing_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    event_type: Mapped[str] = mapped_column(String(40), default="info")
    amount: Mapped[int] = mapped_column(Integer, default=0)
    note: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="billing_events")


class AccountingSettings(Base):
    __tablename__ = "accounting_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True, unique=True)
    vat_rate: Mapped[float] = mapped_column(Float, default=0.0)
    tax_rate: Mapped[float] = mapped_column(Float, default=0.0)
    additional_rate: Mapped[float] = mapped_column(Float, default=0.0)
    fixed_cost_per_month: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="accounting_settings")


class AccountingExpense(Base):
    __tablename__ = "accounting_expenses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    marketplace: Mapped[str] = mapped_column(String(20), default="all", index=True)
    category: Mapped[str] = mapped_column(String(120), default="")
    amount: Mapped[float] = mapped_column(Float, default=0.0)
    recurrence: Mapped[str] = mapped_column(String(20), default="monthly", index=True)
    start_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)
    end_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)
    note: Mapped[str] = mapped_column(Text, default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="accounting_expenses")


class SystemSetting(Base):
    __tablename__ = "system_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    value: Mapped[str] = mapped_column(Text, default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class WbAdsCampaignSnapshot(Base):
    __tablename__ = "wb_ads_campaign_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True)
    campaign_id: Mapped[int] = mapped_column(Integer, index=True)
    payload_json: Mapped[str] = mapped_column(Text, default="{}")
    payload_hash: Mapped[str] = mapped_column(String(64), default="")
    status: Mapped[str] = mapped_column(String(40), default="")
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    synced_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)

    user: Mapped["User"] = relationship()


class WbAdsBidderRule(Base):
    __tablename__ = "wb_ads_bidder_rules"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "campaign_id",
            "target_kind",
            "nm_id",
            "target_value",
            name="uq_wb_ads_bidder_rule_target",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True)
    campaign_id: Mapped[int] = mapped_column(Integer, index=True)
    target_kind: Mapped[str] = mapped_column(String(24), default="normquery", index=True)  # normquery | nm
    nm_id: Mapped[int] = mapped_column(Integer, default=0, index=True)
    target_value: Mapped[str] = mapped_column(String(255), default="", index=True)  # normquery text or nm id
    placement: Mapped[str] = mapped_column(String(24), default="search", index=True)  # search | recommendations | combined
    strategy: Mapped[str] = mapped_column(String(24), default="optimal", index=True)  # hold | range | position | optimal
    desired_bid: Mapped[int] = mapped_column(Integer, default=0)
    min_bid: Mapped[int] = mapped_column(Integer, default=0)
    max_bid: Mapped[int] = mapped_column(Integer, default=0)
    step_bid: Mapped[int] = mapped_column(Integer, default=100)
    target_pos_from: Mapped[float] = mapped_column(Float, default=1.0)
    target_pos_to: Mapped[float] = mapped_column(Float, default=5.0)
    min_clicks: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    cooldown_sec: Mapped[int] = mapped_column(Integer, default=300)
    notes: Mapped[str] = mapped_column(String(500), default="")
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)
    last_status: Mapped[str] = mapped_column(String(24), default="")
    last_reason: Mapped[str] = mapped_column(String(500), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user: Mapped["User"] = relationship()


class WbAdsBidderRun(Base):
    __tablename__ = "wb_ads_bidder_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True)
    rule_id: Mapped[int] = mapped_column(Integer, ForeignKey("wb_ads_bidder_rules.id"), index=True)
    campaign_id: Mapped[int] = mapped_column(Integer, index=True)
    target_kind: Mapped[str] = mapped_column(String(24), default="normquery", index=True)
    nm_id: Mapped[int] = mapped_column(Integer, default=0, index=True)
    target_value: Mapped[str] = mapped_column(String(255), default="", index=True)
    placement: Mapped[str] = mapped_column(String(24), default="search", index=True)
    previous_bid: Mapped[int] = mapped_column(Integer, default=0)
    next_bid: Mapped[int] = mapped_column(Integer, default=0)
    min_bid_floor: Mapped[int] = mapped_column(Integer, default=0)
    avg_position: Mapped[float] = mapped_column(Float, default=0.0)
    clicks: Mapped[float] = mapped_column(Float, default=0.0)
    orders: Mapped[float] = mapped_column(Float, default=0.0)
    spent: Mapped[float] = mapped_column(Float, default=0.0)
    changed: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    status: Mapped[str] = mapped_column(String(24), default="ok", index=True)  # ok | skipped | error
    reason: Mapped[str] = mapped_column(String(500), default="")
    response_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

    user: Mapped["User"] = relationship()
    rule: Mapped["WbAdsBidderRule"] = relationship()


class MarketplaceApiCache(Base):
    __tablename__ = "marketplace_api_cache"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "module_code",
            "marketplace",
            "cache_key",
            name="uq_marketplace_api_cache_key",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True)
    module_code: Mapped[str] = mapped_column(String(80), index=True)
    marketplace: Mapped[str] = mapped_column(String(30), index=True)
    cache_key: Mapped[str] = mapped_column(String(120), index=True)
    payload_json: Mapped[str] = mapped_column(Text, default="{}")
    payload_hash: Mapped[str] = mapped_column(String(64), default="")
    hit_count: Mapped[int] = mapped_column(Integer, default=0)
    refresh_count: Mapped[int] = mapped_column(Integer, default=0)
    last_error: Mapped[str] = mapped_column(String(500), default="")
    fetched_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_hit_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user: Mapped["User"] = relationship()


class AiServiceAccount(Base):
    __tablename__ = "ai_service_accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True, nullable=True)
    name: Mapped[str] = mapped_column(String(120), default="")
    provider: Mapped[str] = mapped_column(String(40), default="openai")
    api_key: Mapped[str] = mapped_column(String(255), default="")
    model: Mapped[str] = mapped_column(String(120), default="")
    base_url: Mapped[str] = mapped_column(String(500), default="")
    priority: Mapped[int] = mapped_column(Integer, default=1000, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user: Mapped["User | None"] = relationship()


class UserAiPreference(Base):
    __tablename__ = "user_ai_preferences"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True, unique=True)
    use_global_default: Mapped[bool] = mapped_column(Boolean, default=True)
    mode: Mapped[str] = mapped_column(String(16), default="builtin")
    service_id: Mapped[int | None] = mapped_column(ForeignKey("ai_service_accounts.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user: Mapped["User"] = relationship()
    service: Mapped["AiServiceAccount | None"] = relationship()


class WorkItemClaim(Base):
    __tablename__ = "work_item_claims"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "module_code",
            "marketplace",
            "item_type",
            "item_external_id",
            name="uq_work_item_claim_key",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    module_code: Mapped[str] = mapped_column(String(60), index=True)
    marketplace: Mapped[str] = mapped_column(String(30), index=True)
    item_type: Mapped[str] = mapped_column(String(30), index=True)
    item_external_id: Mapped[str] = mapped_column(String(128), index=True)
    owner_member_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    claimed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user: Mapped["User"] = relationship()


class SocialGameScore(Base):
    __tablename__ = "social_game_scores"
    __table_args__ = (
        UniqueConstraint("game_code", "actor_key", name="uq_social_game_actor"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True)
    game_code: Mapped[str] = mapped_column(String(40), index=True)
    actor_key: Mapped[str] = mapped_column(String(60), index=True)
    actor_nick: Mapped[str] = mapped_column(String(120), default="")
    best_score: Mapped[int] = mapped_column(Integer, default=0)
    last_score: Mapped[int] = mapped_column(Integer, default=0)
    play_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user: Mapped["User"] = relationship()


class SocialChatThread(Base):
    __tablename__ = "social_chat_threads"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    kind: Mapped[str] = mapped_column(String(20), index=True)  # global | company | direct
    owner_user_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(255), default="")
    avatar_url: Mapped[str] = mapped_column(String(500), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user: Mapped["User | None"] = relationship()


class SocialChatThreadMember(Base):
    __tablename__ = "social_chat_thread_members"
    __table_args__ = (
        UniqueConstraint("thread_id", "actor_key", name="uq_social_chat_thread_actor"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    thread_id: Mapped[int] = mapped_column(Integer, ForeignKey("social_chat_threads.id"), index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True)
    member_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("team_members.id"), nullable=True, index=True)
    actor_key: Mapped[str] = mapped_column(String(60), index=True)
    actor_nick: Mapped[str] = mapped_column(String(120), default="")
    last_read_message_id: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    thread: Mapped["SocialChatThread"] = relationship()
    user: Mapped["User"] = relationship()
    member: Mapped["TeamMember | None"] = relationship()


class SocialChatMessage(Base):
    __tablename__ = "social_chat_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    thread_id: Mapped[int] = mapped_column(Integer, ForeignKey("social_chat_threads.id"), index=True)
    sender_user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True)
    sender_member_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("team_members.id"), nullable=True, index=True)
    sender_key: Mapped[str] = mapped_column(String(60), index=True)
    sender_nick: Mapped[str] = mapped_column(String(120), default="")
    text: Mapped[str] = mapped_column(Text, default="")
    reply_to_message_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    attachments_json: Mapped[str] = mapped_column(Text, default="[]")
    reactions_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

    thread: Mapped["SocialChatThread"] = relationship()
    sender_user: Mapped["User"] = relationship()
    sender_member: Mapped["TeamMember | None"] = relationship()


class SocialTaskProject(Base):
    __tablename__ = "social_task_projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(255), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    created_by_key: Mapped[str] = mapped_column(String(60), index=True)
    created_by_nick: Mapped[str] = mapped_column(String(120), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user: Mapped["User"] = relationship()


class SocialTask(Base):
    __tablename__ = "social_tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True)
    project_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("social_task_projects.id"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(255), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(30), default="todo", index=True)  # todo | in_progress | done
    priority: Mapped[str] = mapped_column(String(20), default="normal")
    due_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)
    assignee_key: Mapped[str] = mapped_column(String(60), default="", index=True)
    assignee_nick: Mapped[str] = mapped_column(String(120), default="")
    creator_key: Mapped[str] = mapped_column(String(60), default="", index=True)
    creator_nick: Mapped[str] = mapped_column(String(120), default="")
    closed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user: Mapped["User"] = relationship()
    project: Mapped["SocialTaskProject | None"] = relationship()


class SocialTaskComment(Base):
    __tablename__ = "social_task_comments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    task_id: Mapped[int] = mapped_column(Integer, ForeignKey("social_tasks.id"), index=True)
    author_key: Mapped[str] = mapped_column(String(60), index=True)
    author_nick: Mapped[str] = mapped_column(String(120), default="")
    text: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    task: Mapped["SocialTask"] = relationship()


class SocialNotification(Base):
    __tablename__ = "social_notifications"
    __table_args__ = (
        UniqueConstraint("recipient_key", "kind", "dedupe_key", name="uq_social_notif_dedupe"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True)
    recipient_key: Mapped[str] = mapped_column(String(60), index=True)
    kind: Mapped[str] = mapped_column(String(40), index=True)
    dedupe_key: Mapped[str] = mapped_column(String(120), default="")
    title: Mapped[str] = mapped_column(String(255), default="")
    body: Mapped[str] = mapped_column(Text, default="")
    payload_json: Mapped[str] = mapped_column(Text, default="{}")
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

    user: Mapped["User"] = relationship()


class SocialAnnouncement(Base):
    __tablename__ = "social_announcements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    target_user_ids_json: Mapped[str] = mapped_column(Text, default="[]")
    title: Mapped[str] = mapped_column(String(255), default="")
    body: Mapped[str] = mapped_column(Text, default="")
    starts_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    ends_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_by_user_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user: Mapped["User | None"] = relationship(foreign_keys=[user_id])


class SocialAnnouncementAck(Base):
    __tablename__ = "social_announcement_acks"
    __table_args__ = (
        UniqueConstraint("announcement_id", "user_id", "actor_key", name="uq_social_announcement_ack"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    announcement_id: Mapped[int] = mapped_column(Integer, ForeignKey("social_announcements.id"), index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True)
    actor_key: Mapped[str] = mapped_column(String(60), index=True)
    acked_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

    announcement: Mapped["SocialAnnouncement"] = relationship()
    user: Mapped["User"] = relationship()


class SocialCalendarEvent(Base):
    __tablename__ = "social_calendar_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True)
    actor_key: Mapped[str] = mapped_column(String(60), index=True)
    is_public: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    title: Mapped[str] = mapped_column(String(255), default="")
    details: Mapped[str] = mapped_column(Text, default="")
    start_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    end_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user: Mapped["User"] = relationship()


class SocialNote(Base):
    __tablename__ = "social_notes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True)
    actor_key: Mapped[str] = mapped_column(String(60), index=True)
    title: Mapped[str] = mapped_column(String(255), default="")
    content: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user: Mapped["User"] = relationship()
    files: Mapped[list["SocialNoteFile"]] = relationship(
        cascade="all, delete-orphan",
        passive_deletes=True,
        back_populates="note",
    )


class SocialNoteFile(Base):
    __tablename__ = "social_note_files"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    note_id: Mapped[int] = mapped_column(Integer, ForeignKey("social_notes.id"), index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True)
    actor_key: Mapped[str] = mapped_column(String(60), index=True)
    filename: Mapped[str] = mapped_column(String(255), default="")
    url: Mapped[str] = mapped_column(String(500), default="")
    content_type: Mapped[str] = mapped_column(String(120), default="")
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    note: Mapped["SocialNote"] = relationship(back_populates="files")
    user: Mapped["User"] = relationship()
