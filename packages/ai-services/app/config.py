"""Application configuration."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Server settings
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = False
    
    # Logging settings
    LOG_LEVEL: str = "info"  # debug, info, warning, error, critical

    # CORS settings
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:3001"]

    # AI Services settings
    AI_MODEL_PATH: str | None = None
    AI_SERVICE_ENABLED: bool = True


settings = Settings()
