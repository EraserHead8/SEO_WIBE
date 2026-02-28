from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
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
    ai_services: Mapped[list["AiServiceAccount"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    ai_preference: Mapped["UserAiPreference | None"] = relationship(back_populates="user", cascade="all, delete-orphan")
    billing_account: Mapped["BillingAccount | None"] = relationship(back_populates="user", cascade="all, delete-orphan")
    billing_events: Mapped[list["BillingEvent"]] = relationship(back_populates="user", cascade="all, delete-orphan")


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
    owner_member_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    marketplace: Mapped[str] = mapped_column(String(30), index=True)
    article: Mapped[str] = mapped_column(String(120), index=True)
    external_id: Mapped[str] = mapped_column(String(120), default="", index=True)
    barcode: Mapped[str] = mapped_column(String(64), default="", index=True)
    photo_url: Mapped[str] = mapped_column(String(500), default="")
    name: Mapped[str] = mapped_column(String(255))
    category_name: Mapped[str] = mapped_column(String(255), default="", index=True)
    current_description: Mapped[str] = mapped_column(Text, default="")
    target_keywords: Mapped[str] = mapped_column(Text, default="")
    last_position: Mapped[int | None] = mapped_column(Integer, nullable=True)
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
    owner_member_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), index=True)
    status: Mapped[str] = mapped_column(String(30), default="generated")
    generated_description: Mapped[str] = mapped_column(Text)
    keywords_snapshot: Mapped[str] = mapped_column(Text)
    competitor_snapshot: Mapped[str | None] = mapped_column(Text, nullable=True)
    target_position: Mapped[int] = mapped_column(Integer, default=5)
    current_position: Mapped[int | None] = mapped_column(Integer, nullable=True)
    next_check_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    attempt_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    product: Mapped["Product"] = relationship(back_populates="seo_jobs")


class UserKeyword(Base):
    __tablename__ = "user_keywords"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    owner_member_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    marketplace: Mapped[str] = mapped_column(String(30), default="all", index=True)
    keyword: Mapped[str] = mapped_column(String(255), index=True)
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
    owner_member_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    filename: Mapped[str] = mapped_column(String(255), default="")
    content_type: Mapped[str] = mapped_column(String(120), default="")
    content_text: Mapped[str] = mapped_column(Text, default="")
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
    nickname: Mapped[str] = mapped_column(String(120), default="")
    avatar_url: Mapped[str] = mapped_column(String(500), default="")
    hashed_password: Mapped[str] = mapped_column(String(255), default="")
    access_scope: Mapped[str] = mapped_column(Text, default="")
    is_owner: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="team_members")


class AiServiceAccount(Base):
    __tablename__ = "ai_service_accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True, nullable=True)
    name: Mapped[str] = mapped_column(String(120), default="")
    provider: Mapped[str] = mapped_column(String(40), default="openai")
    api_key: Mapped[str] = mapped_column(String(255), default="")
    model: Mapped[str] = mapped_column(String(120), default="")
    base_url: Mapped[str] = mapped_column(String(500), default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user: Mapped["User | None"] = relationship(back_populates="ai_services")


class UserAiPreference(Base):
    __tablename__ = "user_ai_preferences"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True, unique=True)
    use_global_default: Mapped[bool] = mapped_column(Boolean, default=True)
    mode: Mapped[str] = mapped_column(String(20), default="builtin")
    service_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="ai_preference")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    action: Mapped[str] = mapped_column(String(120))
    details: Mapped[str] = mapped_column(Text, default="")
    actor_email: Mapped[str] = mapped_column(String(255), default="")
    actor_member_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    actor_is_owner: Mapped[bool] = mapped_column(Boolean, default=True)
    module_code: Mapped[str] = mapped_column(String(80), default="")
    entity_type: Mapped[str] = mapped_column(String(80), default="")
    entity_id: Mapped[str] = mapped_column(String(120), default="")
    status: Mapped[str] = mapped_column(String(24), default="ok")
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


class SystemSetting(Base):
    __tablename__ = "system_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    value: Mapped[str] = mapped_column(Text, default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class WbAdsCampaignSnapshot(Base):
    __tablename__ = "wb_ads_campaign_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    campaign_id: Mapped[int] = mapped_column(Integer, index=True)
    payload_json: Mapped[str] = mapped_column(Text, default="")
    payload_hash: Mapped[str] = mapped_column(String(128), default="", index=True)
    status: Mapped[str] = mapped_column(String(40), default="")
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    synced_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class WorkItemClaim(Base):
    __tablename__ = "work_item_claims"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    module_code: Mapped[str] = mapped_column(String(80), index=True)
    marketplace: Mapped[str] = mapped_column(String(30), default="", index=True)
    item_type: Mapped[str] = mapped_column(String(60), default="", index=True)
    item_external_id: Mapped[str] = mapped_column(String(180), default="", index=True)
    owner_member_id: Mapped[int] = mapped_column(Integer, index=True)
    claimed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
