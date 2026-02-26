import secrets

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "SEO WIBE"
    secret_key: str = ""
    token_expire_minutes: int = 60 * 24
    database_url: str = "sqlite:///./seo_wibe.db"
    admin_emails: str = "makc200690@gmail.com"
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()

if not settings.secret_key or settings.secret_key == "change-me-in-production":
    # Ephemeral fallback for local/dev startup when SECRET_KEY is not set.
    settings.secret_key = secrets.token_urlsafe(48)
