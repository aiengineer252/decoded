from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    anthropic_api_key: str = ""
    github_token: str = ""
    database_url: str = "sqlite:///./decoded.db"

    # Signal score below which an item is dropped before triage. The triage
    # stage is the only expensive part of the pipeline, so this threshold is
    # what keeps the whole thing runnable on a free tier.
    signal_threshold: float = 0.45

    triage_model: str = "claude-opus-5"

    # Per-run caps, so a bad day on GitHub trending can't drain the budget.
    max_ingest_per_source: int = 40
    max_triage_per_run: int = 5


settings = Settings()
