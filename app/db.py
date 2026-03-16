import json
import logging
import time

from sqlalchemy import create_engine, event, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings
from app.telemetry import record_sql_timing

logger = logging.getLogger(__name__)


class Base(DeclarativeBase):
    pass


is_sqlite = settings.database_url.startswith("sqlite")
connect_args = {"check_same_thread": False, "timeout": 120} if is_sqlite else {}
engine_kwargs = {
    "pool_pre_ping": True,
    # For mixed web + worker load we allow larger checkout headroom to avoid pool starvation.
    "pool_size": 24 if is_sqlite else 12,
    "max_overflow": 48 if is_sqlite else 24,
    "pool_timeout": 45 if is_sqlite else 45,
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
        cursor.execute("PRAGMA busy_timeout=120000")
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



def _is_sqlite_locked_error(exc: Exception | None) -> bool:
    return is_sqlite and "database is locked" in str(exc or "").lower()


def _run_sqlite_backfill_best_effort(label: str, statement: str) -> bool:
    try:
        with engine.begin() as conn:
            conn.execute(text("PRAGMA busy_timeout=1500"))
            conn.execute(text(statement))
        return True
    except OperationalError as exc:
        if _is_sqlite_locked_error(exc):
            logger.warning("Skipped SQLite backfill '%s' during startup because database is locked", label)
            return False
        raise


def run_lightweight_migrations():
    if not settings.database_url.startswith("sqlite"):
        return

    deferred_backfills: list[tuple[str, str]] = []
    try:
        with engine.begin() as conn:
            conn.execute(text("PRAGMA busy_timeout=1500"))
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
            if product_cols and "price_base" not in product_cols:
                conn.execute(text("ALTER TABLE products ADD COLUMN price_base FLOAT DEFAULT 0"))
            if product_cols and "price_discount" not in product_cols:
                conn.execute(text("ALTER TABLE products ADD COLUMN price_discount FLOAT DEFAULT 0"))
            if product_cols and "price_min" not in product_cols:
                conn.execute(text("ALTER TABLE products ADD COLUMN price_min FLOAT DEFAULT 0"))
            if product_cols and "price_marketing" not in product_cols:
                conn.execute(text("ALTER TABLE products ADD COLUMN price_marketing FLOAT DEFAULT 0"))
            if product_cols and "owner_member_id" not in product_cols:
                conn.execute(text("ALTER TABLE products ADD COLUMN owner_member_id INTEGER"))
            if product_cols and "photo_url" in product_cols:
                deferred_backfills.extend([
                    (
                        "products_photo_url_https_static",
                        """
                        UPDATE products
                        SET photo_url = '/static/' || substr(photo_url, length('https://static/') + 1)
                        WHERE photo_url LIKE 'https://static/%'
                        """,
                    ),
                    (
                        "products_photo_url_http_static",
                        """
                        UPDATE products
                        SET photo_url = '/static/' || substr(photo_url, length('http://static/') + 1)
                        WHERE photo_url LIKE 'http://static/%'
                        """,
                    ),
                ])

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
                    deferred_backfills.append(
                        (
                            "work_item_claims_claimed_at",
                            """
                            UPDATE work_item_claims
                            SET claimed_at = COALESCE(claimed_at, created_at, CURRENT_TIMESTAMP)
                            """,
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

            ann_cols = {row[1] for row in conn.execute(text("PRAGMA table_info(social_announcements)"))}
            if ann_cols and "target_user_ids_json" not in ann_cols:
                conn.execute(text("ALTER TABLE social_announcements ADD COLUMN target_user_ids_json TEXT DEFAULT '[]'"))
                deferred_backfills.append(
                    (
                        "social_announcements_target_user_ids_json",
                        """
                        UPDATE social_announcements
                        SET target_user_ids_json = CASE
                            WHEN user_id IS NULL THEN '[]'
                            ELSE ('[' || CAST(user_id AS TEXT) || ']')
                        END
                        WHERE target_user_ids_json IS NULL OR trim(target_user_ids_json) = ''
                        """,
                    )
                )

            task_cols = {row[1] for row in conn.execute(text("PRAGMA table_info(social_tasks)"))}
            if task_cols:
                if "task_kind" not in task_cols:
                    conn.execute(text("ALTER TABLE social_tasks ADD COLUMN task_kind VARCHAR(20) DEFAULT 'company'"))
                    deferred_backfills.append(
                        (
                            "social_tasks_task_kind",
                            """
                            UPDATE social_tasks
                            SET task_kind = CASE
                                WHEN task_kind IS NULL OR trim(task_kind) = '' THEN 'company'
                                ELSE lower(trim(task_kind))
                            END
                            """,
                        )
                    )
                if "sort_order" not in task_cols:
                    conn.execute(text("ALTER TABLE social_tasks ADD COLUMN sort_order INTEGER DEFAULT 0"))
                    deferred_backfills.append(
                        (
                            "social_tasks_sort_order",
                            """
                            UPDATE social_tasks
                            SET sort_order = COALESCE(sort_order, id, 0)
                            WHERE sort_order IS NULL OR sort_order = 0
                            """,
                        )
                    )
                if "completed_at" not in task_cols:
                    conn.execute(text("ALTER TABLE social_tasks ADD COLUMN completed_at DATETIME"))
                    deferred_backfills.append(
                        (
                            "social_tasks_completed_at",
                            """
                            UPDATE social_tasks
                            SET completed_at = COALESCE(completed_at, closed_at, updated_at, created_at)
                            WHERE lower(COALESCE(status, '')) = 'done' AND completed_at IS NULL
                            """,
                        )
                    )

            conn.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS social_task_project_members (
                        id INTEGER NOT NULL PRIMARY KEY,
                        project_id INTEGER NOT NULL,
                        actor_key VARCHAR(60) NOT NULL,
                        added_by_key VARCHAR(60) DEFAULT '',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY(project_id) REFERENCES social_task_projects (id)
                    )
                    """
                )
            )
            conn.execute(
                text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS uq_social_task_project_member "
                    "ON social_task_project_members(project_id, actor_key)"
                )
            )
            deferred_backfills.append(
                (
                    "social_task_project_members_backfill_active",
                    """
                    INSERT OR IGNORE INTO social_task_project_members (project_id, actor_key, added_by_key, created_at)
                    SELECT
                        p.id,
                        CASE
                            WHEN COALESCE(tm.is_owner, 0) = 1 THEN ('u:' || CAST(p.user_id AS TEXT))
                            ELSE ('m:' || CAST(tm.id AS TEXT))
                        END AS actor_key,
                        COALESCE(NULLIF(trim(p.created_by_key), ''), ('u:' || CAST(p.user_id AS TEXT))),
                        CURRENT_TIMESTAMP
                    FROM social_task_projects p
                    JOIN team_members tm
                        ON tm.user_id = p.user_id
                       AND COALESCE(tm.is_active, 0) = 1
                    """,
                )
            )
            deferred_backfills.append(
                (
                    "social_task_project_members_backfill_creator",
                    """
                    INSERT OR IGNORE INTO social_task_project_members (project_id, actor_key, added_by_key, created_at)
                    SELECT
                        p.id,
                        trim(p.created_by_key),
                        trim(p.created_by_key),
                        CURRENT_TIMESTAMP
                    FROM social_task_projects p
                    WHERE trim(COALESCE(p.created_by_key, '')) <> ''
                    """,
                )
            )
            team_member_cols = {row[1] for row in conn.execute(text("PRAGMA table_info(team_members)"))}
            if team_member_cols:
                if "city" not in team_member_cols:
                    conn.execute(text("ALTER TABLE team_members ADD COLUMN city VARCHAR(120) DEFAULT ''"))
                if "position_title" not in team_member_cols:
                    conn.execute(text("ALTER TABLE team_members ADD COLUMN position_title VARCHAR(120) DEFAULT ''"))

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
                    "CREATE INDEX IF NOT EXISTS ix_social_tasks_user_kind_status_due "
                    "ON social_tasks(user_id, task_kind, status, due_date)"
                )
            )
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_social_tasks_project_sort "
                    "ON social_tasks(project_id, sort_order, due_date)"
                )
            )
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_social_task_project_members_project_actor "
                    "ON social_task_project_members(project_id, actor_key)"
                )
            )
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_wb_ads_snapshots_user_deleted_campaign "
                    "ON wb_ads_campaign_snapshots(user_id, is_deleted, campaign_id DESC)"
                )
            )
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_products_user_last_position "
                    "ON products(user_id, last_position)"
                )
            )
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_products_user_owner_last_position "
                    "ON products(user_id, owner_member_id, last_position)"
                )
            )
            bidder_rule_cols = {row[1] for row in conn.execute(text("PRAGMA table_info(wb_ads_bidder_rules)"))}
            if bidder_rule_cols and "nm_id" not in bidder_rule_cols:
                conn.execute(text("ALTER TABLE wb_ads_bidder_rules ADD COLUMN nm_id INTEGER DEFAULT 0"))
                deferred_backfills.append(("wb_ads_bidder_rules_nm_id", "UPDATE wb_ads_bidder_rules SET nm_id = 0 WHERE nm_id IS NULL"))
            bidder_run_cols = {row[1] for row in conn.execute(text("PRAGMA table_info(wb_ads_bidder_runs)"))}
            if bidder_run_cols and "nm_id" not in bidder_run_cols:
                conn.execute(text("ALTER TABLE wb_ads_bidder_runs ADD COLUMN nm_id INTEGER DEFAULT 0"))
                deferred_backfills.append(("wb_ads_bidder_runs_nm_id", "UPDATE wb_ads_bidder_runs SET nm_id = 0 WHERE nm_id IS NULL"))
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_wb_ads_bidder_rules_user_active "
                    "ON wb_ads_bidder_rules(user_id, is_active, updated_at)"
                )
            )
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_wb_ads_bidder_runs_user_created "
                    "ON wb_ads_bidder_runs(user_id, created_at DESC)"
                )
            )
    except OperationalError as exc:
        if _is_sqlite_locked_error(exc):
            logger.warning("Skipped remaining SQLite lightweight migrations during startup because database is locked")
            return
        raise

    for label, statement in deferred_backfills:
        _run_sqlite_backfill_best_effort(label, statement)

def ensure_admin_emails():
    raw = settings.admin_emails or ""
    emails = [x.strip().lower() for x in raw.split(",") if x.strip()]
    if not emails:
        return
    try:
        with engine.begin() as conn:
            conn.execute(text("PRAGMA busy_timeout=1500"))
            for email in emails:
                conn.execute(text("UPDATE users SET role='admin' WHERE lower(email)=:email"), {"email": email})
    except OperationalError as exc:
        if _is_sqlite_locked_error(exc):
            logger.warning("Skipped ensure_admin_emails during startup because database is locked")
            return
        raise

