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
        product_cols = {row[1] for row in conn.execute(text("PRAGMA table_info(products)"))}
        if product_cols and "external_id" not in product_cols:
            conn.execute(text("ALTER TABLE products ADD COLUMN external_id VARCHAR(120) DEFAULT ''"))
        if product_cols and "barcode" not in product_cols:
            conn.execute(text("ALTER TABLE products ADD COLUMN barcode VARCHAR(64) DEFAULT ''"))
        if product_cols and "photo_url" not in product_cols:
            conn.execute(text("ALTER TABLE products ADD COLUMN photo_url VARCHAR(500) DEFAULT ''"))

        seo_cols = {row[1] for row in conn.execute(text("PRAGMA table_info(seo_jobs)"))}
        if seo_cols and "competitor_snapshot" not in seo_cols:
            conn.execute(text("ALTER TABLE seo_jobs ADD COLUMN competitor_snapshot TEXT"))

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

        settings_cols = {row[1] for row in conn.execute(text("PRAGMA table_info(system_settings)"))}
        if settings_cols:
            default_ui = json.dumps(
                {
                    "theme_choice_enabled": True,
                    "default_theme": "classic",
                    "allowed_themes": ["classic", "dark", "light", "newyear", "summer", "autumn", "winter", "spring"],
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


def ensure_admin_emails():
    raw = settings.admin_emails or ""
    emails = [x.strip().lower() for x in raw.split(",") if x.strip()]
    if not emails:
        return
    with engine.begin() as conn:
        for email in emails:
            conn.execute(text("UPDATE users SET role='admin' WHERE lower(email)=:email"), {"email": email})
