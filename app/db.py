import json
import time

from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings
from app.telemetry import record_sql_timing


class Base(DeclarativeBase):
    pass


is_sqlite = settings.database_url.startswith("sqlite")
connect_args = {"check_same_thread": False, "timeout": 30} if is_sqlite else {}
engine_kwargs = {
    "pool_pre_ping": True,
    "pool_size": 20 if is_sqlite else 12,
    "max_overflow": 40 if is_sqlite else 24,
    "pool_timeout": 90 if is_sqlite else 45,
    "pool_recycle": 1800,
    "pool_use_lifo": True,
}
# Under concurrent web polling + worker jobs default QueuePool values are too low
# and may cause connection checkout timeouts during traffic spikes.
engine = create_engine(settings.database_url, connect_args=connect_args, **engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@event.listens_for(engine, "before_cursor_execute")
def _before_cursor_execute(_conn, _cursor, _statement, _parameters, context, _executemany):
    context._seo_wibe_sql_started_at = time.perf_counter()


@event.listens_for(engine, "connect")
def _on_connect(dbapi_connection, _connection_record):
    if not is_sqlite:
        return
    cursor = dbapi_connection.cursor()
    try:
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.execute("PRAGMA busy_timeout=30000")
    finally:
        cursor.close()


@event.listens_for(engine, "after_cursor_execute")
def _after_cursor_execute(_conn, _cursor, statement, _parameters, context, _executemany):
    started = getattr(context, "_seo_wibe_sql_started_at", None)
    if started is None:
        return
    duration_ms = (time.perf_counter() - float(started)) * 1000.0
    record_sql_timing(str(statement or ""), duration_ms)


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
        product_cols = {row[1] for row in conn.execute(text("PRAGMA table_info(products)"))}
        if product_cols and "external_id" not in product_cols:
            conn.execute(text("ALTER TABLE products ADD COLUMN external_id VARCHAR(120) DEFAULT ''"))
        if product_cols and "barcode" not in product_cols:
            conn.execute(text("ALTER TABLE products ADD COLUMN barcode VARCHAR(64) DEFAULT ''"))
        if product_cols and "photo_url" not in product_cols:
            conn.execute(text("ALTER TABLE products ADD COLUMN photo_url VARCHAR(500) DEFAULT ''"))
        if product_cols and "photos_json" not in product_cols:
            conn.execute(text("ALTER TABLE products ADD COLUMN photos_json TEXT DEFAULT '[]'"))
        if product_cols and "category_name" not in product_cols:
            conn.execute(text("ALTER TABLE products ADD COLUMN category_name VARCHAR(255) DEFAULT ''"))
        if product_cols and "purchase_price" not in product_cols:
            conn.execute(text("ALTER TABLE products ADD COLUMN purchase_price FLOAT DEFAULT 0"))
        if product_cols and "owner_member_id" not in product_cols:
            conn.execute(text("ALTER TABLE products ADD COLUMN owner_member_id INTEGER"))

        seo_cols = {row[1] for row in conn.execute(text("PRAGMA table_info(seo_jobs)"))}
        if seo_cols and "competitor_snapshot" not in seo_cols:
            conn.execute(text("ALTER TABLE seo_jobs ADD COLUMN competitor_snapshot TEXT"))
        if seo_cols and "owner_member_id" not in seo_cols:
            conn.execute(text("ALTER TABLE seo_jobs ADD COLUMN owner_member_id INTEGER"))

        team_cols = {row[1] for row in conn.execute(text("PRAGMA table_info(team_members)"))}
        if team_cols and "hashed_password" not in team_cols:
            conn.execute(text("ALTER TABLE team_members ADD COLUMN hashed_password VARCHAR(255) DEFAULT ''"))

        keyword_cols = {row[1] for row in conn.execute(text("PRAGMA table_info(user_keywords)"))}
        if keyword_cols and "owner_member_id" not in keyword_cols:
            conn.execute(text("ALTER TABLE user_keywords ADD COLUMN owner_member_id INTEGER"))

        doc_cols = {row[1] for row in conn.execute(text("PRAGMA table_info(user_knowledge_docs)"))}
        if doc_cols and "owner_member_id" not in doc_cols:
            conn.execute(text("ALTER TABLE user_knowledge_docs ADD COLUMN owner_member_id INTEGER"))

        claim_cols = {row[1] for row in conn.execute(text("PRAGMA table_info(work_item_claims)"))}
        if claim_cols:
            if "owner_member_id" not in claim_cols:
                conn.execute(text("ALTER TABLE work_item_claims ADD COLUMN owner_member_id INTEGER"))
            if "claimed_at" not in claim_cols:
                conn.execute(text("ALTER TABLE work_item_claims ADD COLUMN claimed_at DATETIME DEFAULT CURRENT_TIMESTAMP"))
            if "created_at" not in claim_cols:
                conn.execute(text("ALTER TABLE work_item_claims ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP"))
            if "updated_at" not in claim_cols:
                conn.execute(text("ALTER TABLE work_item_claims ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP"))
            if "claimed_at" in claim_cols:
                conn.execute(
                    text(
                        """
                        UPDATE work_item_claims
                        SET claimed_at = COALESCE(claimed_at, created_at, CURRENT_TIMESTAMP)
                        """
                    )
                )

        module_cols = {row[1] for row in conn.execute(text("PRAGMA table_info(module_access)"))}
        if module_cols:
            for code in ("sales_stats", "user_profile"):
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
                {"code": "accounting"},
            )
            conn.execute(
                text(
                    """
                    INSERT INTO module_access (user_id, module_code, enabled, created_at)
                    SELECT u.id, :code, 0, CURRENT_TIMESTAMP
                    FROM users u
                    WHERE NOT EXISTS (
                        SELECT 1
                        FROM module_access m
                        WHERE m.user_id = u.id AND m.module_code = :code
                    )
                    """
                ),
                {"code": "social_hub"},
            )

        chat_thread_cols = {row[1] for row in conn.execute(text("PRAGMA table_info(social_chat_threads)"))}
        if chat_thread_cols and "avatar_url" not in chat_thread_cols:
            conn.execute(text("ALTER TABLE social_chat_threads ADD COLUMN avatar_url VARCHAR(500) DEFAULT ''"))

        chat_message_cols = {row[1] for row in conn.execute(text("PRAGMA table_info(social_chat_messages)"))}
        if chat_message_cols:
            if "reply_to_message_id" not in chat_message_cols:
                conn.execute(text("ALTER TABLE social_chat_messages ADD COLUMN reply_to_message_id INTEGER"))
            if "attachments_json" not in chat_message_cols:
                conn.execute(text("ALTER TABLE social_chat_messages ADD COLUMN attachments_json TEXT DEFAULT '[]'"))
            if "reactions_json" not in chat_message_cols:
                conn.execute(text("ALTER TABLE social_chat_messages ADD COLUMN reactions_json TEXT DEFAULT '{}'"))

        settings_cols = {row[1] for row in conn.execute(text("PRAGMA table_info(system_settings)"))}
        if settings_cols:
            default_ui = json.dumps(
                {
                    "theme_choice_enabled": True,
                    "default_theme": "classic",
                    "allowed_themes": ["classic", "dark", "light", "newyear", "summer", "autumn", "winter", "spring", "japan", "greenland"],
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

        audit_cols = {row[1] for row in conn.execute(text("PRAGMA table_info(audit_logs)"))}
        if audit_cols:
            if "actor_email" not in audit_cols:
                conn.execute(text("ALTER TABLE audit_logs ADD COLUMN actor_email VARCHAR(255) DEFAULT ''"))
            if "actor_member_id" not in audit_cols:
                conn.execute(text("ALTER TABLE audit_logs ADD COLUMN actor_member_id INTEGER"))
            if "actor_is_owner" not in audit_cols:
                conn.execute(text("ALTER TABLE audit_logs ADD COLUMN actor_is_owner BOOLEAN DEFAULT 1"))
            if "module_code" not in audit_cols:
                conn.execute(text("ALTER TABLE audit_logs ADD COLUMN module_code VARCHAR(80) DEFAULT ''"))
            if "entity_type" not in audit_cols:
                conn.execute(text("ALTER TABLE audit_logs ADD COLUMN entity_type VARCHAR(80) DEFAULT ''"))
            if "entity_id" not in audit_cols:
                conn.execute(text("ALTER TABLE audit_logs ADD COLUMN entity_id VARCHAR(120) DEFAULT ''"))
            if "status" not in audit_cols:
                conn.execute(text("ALTER TABLE audit_logs ADD COLUMN status VARCHAR(24) DEFAULT 'ok'"))
            if "ip" not in audit_cols:
                conn.execute(text("ALTER TABLE audit_logs ADD COLUMN ip VARCHAR(80) DEFAULT ''"))
            if "user_agent" not in audit_cols:
                conn.execute(text("ALTER TABLE audit_logs ADD COLUMN user_agent VARCHAR(500) DEFAULT ''"))

        calendar_cols = {row[1] for row in conn.execute(text("PRAGMA table_info(social_calendar_events)"))}
        if calendar_cols and "is_public" not in calendar_cols:
            conn.execute(text("ALTER TABLE social_calendar_events ADD COLUMN is_public BOOLEAN DEFAULT 0"))

        ai_cols = {row[1] for row in conn.execute(text("PRAGMA table_info(ai_service_accounts)"))}
        if ai_cols and "priority" not in ai_cols:
            conn.execute(text("ALTER TABLE ai_service_accounts ADD COLUMN priority INTEGER DEFAULT 1000"))

        # Hot-path indexes for chat + ads snapshot reads under mobile/web polling.
        conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_social_chat_messages_thread_id_id "
                "ON social_chat_messages(thread_id, id DESC)"
            )
        )
        conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_social_chat_thread_members_thread_actor "
                "ON social_chat_thread_members(thread_id, actor_key)"
            )
        )
        conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_social_chat_thread_members_actor_thread "
                "ON social_chat_thread_members(actor_key, thread_id)"
            )
        )
        conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_wb_ads_snapshots_user_deleted_campaign "
                "ON wb_ads_campaign_snapshots(user_id, is_deleted, campaign_id DESC)"
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
