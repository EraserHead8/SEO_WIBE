import json

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings


class Base(DeclarativeBase):
    pass


connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def run_lightweight_migrations():
    if not settings.database_url.startswith("sqlite"):
        return

    with engine.begin() as conn:
        conn.execute(text("PRAGMA journal_mode=WAL"))
        conn.execute(text("PRAGMA busy_timeout=5000"))
        conn.execute(text("PRAGMA synchronous=NORMAL"))
        conn.execute(text("PRAGMA temp_store=MEMORY"))

        product_cols = {row[1] for row in conn.execute(text("PRAGMA table_info(products)"))}
        if product_cols and "external_id" not in product_cols:
            conn.execute(text("ALTER TABLE products ADD COLUMN external_id VARCHAR(120) DEFAULT ''"))
        if product_cols and "barcode" not in product_cols:
            conn.execute(text("ALTER TABLE products ADD COLUMN barcode VARCHAR(64) DEFAULT ''"))
        if product_cols and "photo_url" not in product_cols:
            conn.execute(text("ALTER TABLE products ADD COLUMN photo_url VARCHAR(500) DEFAULT ''"))
        if product_cols and "category_name" not in product_cols:
            conn.execute(text("ALTER TABLE products ADD COLUMN category_name VARCHAR(255) DEFAULT ''"))
        if product_cols and "owner_member_id" not in product_cols:
            conn.execute(text("ALTER TABLE products ADD COLUMN owner_member_id INTEGER"))

        seo_cols = {row[1] for row in conn.execute(text("PRAGMA table_info(seo_jobs)"))}
        if seo_cols and "competitor_snapshot" not in seo_cols:
            conn.execute(text("ALTER TABLE seo_jobs ADD COLUMN competitor_snapshot TEXT"))
        if seo_cols and "owner_member_id" not in seo_cols:
            conn.execute(text("ALTER TABLE seo_jobs ADD COLUMN owner_member_id INTEGER"))

        kw_cols = {row[1] for row in conn.execute(text("PRAGMA table_info(user_keywords)"))}
        if kw_cols and "owner_member_id" not in kw_cols:
            conn.execute(text("ALTER TABLE user_keywords ADD COLUMN owner_member_id INTEGER"))

        doc_cols = {row[1] for row in conn.execute(text("PRAGMA table_info(user_knowledge_docs)"))}
        if doc_cols and "owner_member_id" not in doc_cols:
            conn.execute(text("ALTER TABLE user_knowledge_docs ADD COLUMN owner_member_id INTEGER"))

        team_cols = {row[1] for row in conn.execute(text("PRAGMA table_info(team_members)"))}
        if team_cols and "hashed_password" not in team_cols:
            conn.execute(text("ALTER TABLE team_members ADD COLUMN hashed_password VARCHAR(255) DEFAULT ''"))

        audit_cols = {row[1] for row in conn.execute(text("PRAGMA table_info(audit_logs)"))}
        if audit_cols and "actor_email" not in audit_cols:
            conn.execute(text("ALTER TABLE audit_logs ADD COLUMN actor_email VARCHAR(255) DEFAULT ''"))
        if audit_cols and "actor_member_id" not in audit_cols:
            conn.execute(text("ALTER TABLE audit_logs ADD COLUMN actor_member_id INTEGER"))
        if audit_cols and "actor_is_owner" not in audit_cols:
            conn.execute(text("ALTER TABLE audit_logs ADD COLUMN actor_is_owner BOOLEAN DEFAULT 1"))
        if audit_cols and "module_code" not in audit_cols:
            conn.execute(text("ALTER TABLE audit_logs ADD COLUMN module_code VARCHAR(80) DEFAULT ''"))
        if audit_cols and "entity_type" not in audit_cols:
            conn.execute(text("ALTER TABLE audit_logs ADD COLUMN entity_type VARCHAR(80) DEFAULT ''"))
        if audit_cols and "entity_id" not in audit_cols:
            conn.execute(text("ALTER TABLE audit_logs ADD COLUMN entity_id VARCHAR(120) DEFAULT ''"))
        if audit_cols and "status" not in audit_cols:
            conn.execute(text("ALTER TABLE audit_logs ADD COLUMN status VARCHAR(24) DEFAULT 'ok'"))
        if audit_cols and "ip" not in audit_cols:
            conn.execute(text("ALTER TABLE audit_logs ADD COLUMN ip VARCHAR(80) DEFAULT ''"))
        if audit_cols and "user_agent" not in audit_cols:
            conn.execute(text("ALTER TABLE audit_logs ADD COLUMN user_agent VARCHAR(500) DEFAULT ''"))

        module_cols = {row[1] for row in conn.execute(text("PRAGMA table_info(module_access)"))}
        if module_cols:
            for code in ("sales_stats", "user_profile", "ai_assistant", "returns"):
                conn.execute(
                    text(
                        """
                        INSERT INTO module_access (user_id, module_code, enabled, created_at)
                        SELECT u.id, :code, 1, CURRENT_TIMESTAMP
                        FROM users u
                        WHERE NOT EXISTS (
                            SELECT 1
                            FROM module_access m
                            WHERE m.user_id = u.id AND m.module_code = :code
                        )
                        """
                    ),
                    {"code": code},
                )

        settings_cols = {row[1] for row in conn.execute(text("PRAGMA table_info(system_settings)"))}
        if settings_cols:
            default_ui = json.dumps(
                {
                    "theme_choice_enabled": True,
                    "force_theme": False,
                    "default_theme": "classic",
                    "allowed_themes": ["classic", "dark", "light", "newyear", "summer", "autumn", "winter", "spring", "japan", "greenland", "moon"],
                },
                ensure_ascii=False,
            )
            conn.execute(
                text(
                    """
                    INSERT INTO system_settings (key, value, updated_at)
                    SELECT :key, :value, CURRENT_TIMESTAMP
                    WHERE NOT EXISTS (
                        SELECT 1 FROM system_settings s WHERE s.key = :key
                    )
                    """
                ),
                {"key": "ui_settings", "value": default_ui},
            )
            conn.execute(
                text(
                    """
                    INSERT INTO system_settings (key, value, updated_at)
                    SELECT :key, :value, CURRENT_TIMESTAMP
                    WHERE NOT EXISTS (
                        SELECT 1 FROM system_settings s WHERE s.key = :key
                    )
                    """
                ),
                {"key": "ai_global_default", "value": json.dumps({"mode": "builtin", "service_id": None}, ensure_ascii=False)},
            )

        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS wb_ads_campaign_snapshots (
                    id INTEGER PRIMARY KEY,
                    user_id INTEGER NOT NULL,
                    campaign_id INTEGER NOT NULL,
                    payload_json TEXT DEFAULT '',
                    payload_hash VARCHAR(128) DEFAULT '',
                    status VARCHAR(40) DEFAULT '',
                    is_deleted BOOLEAN DEFAULT 0,
                    last_seen_at DATETIME NULL,
                    synced_at DATETIME NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
        )
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS work_item_claims (
                    id INTEGER PRIMARY KEY,
                    user_id INTEGER NOT NULL,
                    module_code VARCHAR(80) NOT NULL,
                    marketplace VARCHAR(30) DEFAULT '',
                    item_type VARCHAR(60) DEFAULT '',
                    item_external_id VARCHAR(180) DEFAULT '',
                    owner_member_id INTEGER NOT NULL,
                    claimed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
        )
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_wb_ads_campaign_snapshots_user_campaign ON wb_ads_campaign_snapshots (user_id, campaign_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_wb_ads_campaign_snapshots_user_deleted ON wb_ads_campaign_snapshots (user_id, is_deleted)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_work_item_claims_user_scope ON work_item_claims (user_id, module_code, item_type, item_external_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_audit_logs_created_user_action ON audit_logs (created_at, user_id, action)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_products_owner_member_id ON products (owner_member_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_products_category_name ON products (category_name)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_seo_jobs_owner_member_id ON seo_jobs (owner_member_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_user_keywords_owner_member_id ON user_keywords (owner_member_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_user_knowledge_docs_owner_member_id ON user_knowledge_docs (owner_member_id)"))

        conn.execute(
            text(
                """
                UPDATE products
                SET owner_member_id = (
                    SELECT tm.id
                    FROM team_members tm
                    WHERE tm.user_id = products.user_id AND tm.is_owner = 1
                    ORDER BY tm.id ASC
                    LIMIT 1
                )
                WHERE owner_member_id IS NULL
                """
            )
        )
        conn.execute(
            text(
                """
                UPDATE seo_jobs
                SET owner_member_id = (
                    SELECT tm.id
                    FROM team_members tm
                    WHERE tm.user_id = seo_jobs.user_id AND tm.is_owner = 1
                    ORDER BY tm.id ASC
                    LIMIT 1
                )
                WHERE owner_member_id IS NULL
                """
            )
        )
        conn.execute(
            text(
                """
                UPDATE user_keywords
                SET owner_member_id = (
                    SELECT tm.id
                    FROM team_members tm
                    WHERE tm.user_id = user_keywords.user_id AND tm.is_owner = 1
                    ORDER BY tm.id ASC
                    LIMIT 1
                )
                WHERE owner_member_id IS NULL
                """
            )
        )
        conn.execute(
            text(
                """
                UPDATE user_knowledge_docs
                SET owner_member_id = (
                    SELECT tm.id
                    FROM team_members tm
                    WHERE tm.user_id = user_knowledge_docs.user_id AND tm.is_owner = 1
                    ORDER BY tm.id ASC
                    LIMIT 1
                )
                WHERE owner_member_id IS NULL
                """
            )
        )


def ensure_admin_emails():
    raw = settings.admin_emails or ""
    emails = [x.strip().lower() for x in raw.split(",") if x.strip()]
    if not emails:
        return
    with engine.begin() as conn:
        for email in emails:
            conn.execute(text("UPDATE users SET role='admin' WHERE lower(email)=:email"), {"email": email})
