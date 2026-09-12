import os
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

# Always allowed in local/dev, even if CORS_ORIGINS is overridden.
LOCAL_FRONTEND_ORIGINS = (
    "http://localhost:3000",
    "http://localhost:3005",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3005",
    "http://localhost",
    "tauri://localhost",
    "capacitor://localhost",
)

# Localhost on any port, plus every Vercel production/preview hostname.
CORS_ORIGIN_REGEX = (
    r"^https?://(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$"
    r"|^https://.+\.vercel\.app$"
)


def _normalize_origin(url: str) -> str:
    return (url or "").strip().rstrip("/")


class Settings(BaseSettings):
    ENVIRONMENT: str = Field(default="development")
    PORT: int = Field(default=8000)
    HOST: str = Field(default="0.0.0.0")
    
    # Gemini
    GEMINI_API_KEY: str = Field(default="")
    GEMINI_MODEL: str = Field(default="gemini-flash-lite-latest")
    
    # Supabase
    SUPABASE_URL: str = Field(default="")
    SUPABASE_KEY: str = Field(default="")
    SUPABASE_JWT_SECRET: str = Field(default="")
    
    # Email / SMTP
    SMTP_HOST: str = Field(default="smtp.gmail.com")
    SMTP_PORT: int = Field(default=587)
    SMTP_USER: str = Field(default="aral.ai.app@gmail.com")
    SMTP_PASSWORD: str = Field(default="")
    SMTP_FROM_NAME: str = Field(default="Aral.ai")
    SUPPORT_EMAIL: str = Field(default="aral.ai.app@gmail.com")

    FRONTEND_URL: str = Field(default="http://localhost:3005")
    # Used when the API is hosted (Cloud Run / Render) but FRONTEND_URL was left on localhost.
    PRODUCTION_FRONTEND_URL: str = Field(default="https://aral-ai-three.vercel.app")

    # Extra CORS origins (comma-separated). Merged with LOCAL_FRONTEND_ORIGINS
    # and the live frontend URLs so a custom domain still works in production.
    CORS_ORIGINS: str = Field(
        default=(
            "http://localhost:3000,http://localhost:3005,"
            "http://127.0.0.1:3000,http://127.0.0.1:3005,"
            "https://aral-ai.vercel.app,https://aral-ai-three.vercel.app,"
            "tauri://localhost,capacitor://localhost"
        )
    )

    # PDF Processing & OCR Optimization
    PDF_OCR_MAX_PAGES: int = Field(default=50, description="Max pages to perform OCR on synchronously in one request")
    PDF_OCR_DPI: int = Field(default=150, description="DPI for OCR page rendering (150 DPI saves ~44% RAM vs 200 DPI)")
    PDF_OCR_MAX_DIMENSION: int = Field(default=2000, description="Max pixel width/height for rendered OCR pages")
    PDF_OCR_CONCURRENCY: int = Field(default=1, description="Concurrency limit for Gemini Vision OCR tasks (1 strictly for free tier rate safety)")
    GEMINI_OCR_DELAY_SECONDS: float = Field(default=4.2, description="Mandatory delay between consecutive Gemini Vision calls to stay strictly under 15 RPM")

    @property
    def is_hosted(self) -> bool:
        # Cloud Run sets K_SERVICE; Cloud Run jobs set CLOUD_RUN_JOB; Render sets RENDER*.
        return bool(
            os.getenv("K_SERVICE")
            or os.getenv("CLOUD_RUN_JOB")
            or os.getenv("RENDER")
            or os.getenv("RENDER_EXTERNAL_URL")
        )

    @property
    def is_production(self) -> bool:
        env = (self.ENVIRONMENT or "").strip().lower()
        return env in {"production", "prod"} or self.is_hosted

    @property
    def allow_anonymous_auth(self) -> bool:
        """Local/dev may use the single-user identity. Hosted APIs must not."""
        return not self.is_production

    @property
    def frontend_origin(self) -> str:
        url = _normalize_origin(self.FRONTEND_URL)
        local = (not url) or ("localhost" in url) or ("127.0.0.1" in url)
        if self.is_hosted and local:
            return _normalize_origin(self.PRODUCTION_FRONTEND_URL) or "https://aral-ai-three.vercel.app"
        return url or "http://localhost:3005"

    @property
    def cors_origin_regex(self) -> str:
        return CORS_ORIGIN_REGEX

    @property
    def cors_origins_list(self) -> List[str]:
        seen = set()
        origins: List[str] = []

        def add(raw: str) -> None:
            origin = _normalize_origin(raw)
            if origin and origin not in seen:
                seen.add(origin)
                origins.append(origin)

        for origin in LOCAL_FRONTEND_ORIGINS:
            add(origin)
        for origin in self.CORS_ORIGINS.split(","):
            add(origin)
        add(self.frontend_origin)
        add(self.PRODUCTION_FRONTEND_URL)
        return origins

    @property
    def has_gemini_key(self) -> bool:
        return bool(self.GEMINI_API_KEY and len(self.GEMINI_API_KEY.strip()) > 5)

    @property
    def has_supabase_credentials(self) -> bool:
        return bool(
            self.SUPABASE_URL 
            and self.SUPABASE_KEY 
            and self.SUPABASE_URL.startswith("http")
        )

    @property
    def has_smtp_credentials(self) -> bool:
        return bool(self.SMTP_USER and self.SMTP_PASSWORD and len(self.SMTP_PASSWORD.strip()) > 3)

    model_config = SettingsConfigDict(
        env_file=[
            os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), ".env"),
            ".env"
        ],
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
