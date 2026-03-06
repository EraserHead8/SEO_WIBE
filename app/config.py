import secrets
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "SEO WIBE"
    secret_key: str = ""
    token_expire_minutes: int = 60 * 24 * 3
    database_url: str = "sqlite:///./seo_wibe.db"
    redis_url: str = "redis://127.0.0.1:6379/0"
    task_queue_enabled: bool = True
    task_queue_name: str = "seo_wibe:tasks"
    task_queue_dedupe_prefix: str = "seo_wibe:task_dedupe"
    admin_emails: str = "makc200690@gmail.com"
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()

if not settings.secret_key or settings.secret_key == "change-me-in-production":
    # Persist local secret to avoid invalidating tokens after restarts.
    secret_path = Path(__file__).resolve().parent.parent / ".secret_key"
    try:
        if secret_path.exists():
            persisted = secret_path.read_text(encoding="utf-8").strip()
            if persisted:
                settings.secret_key = persisted
        if not settings.secret_key:
            settings.secret_key = secrets.token_urlsafe(48)
            secret_path.write_text(settings.secret_key, encoding="utf-8")
    except Exception:
        settings.secret_key = secrets.token_urlsafe(48)
