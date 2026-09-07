import os
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

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

    FRONTEND_URL: str = Field(default="http://localhost:3000")
    # Used when the API is hosted (Render) but FRONTEND_URL was left on localhost.
    PRODUCTION_FRONTEND_URL: str = Field(default="https://aral-ai-three.vercel.app")

    # CORS
    CORS_ORIGINS: str = Field(
        default="http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001,tauri://localhost,capacitor://localhost"
    )

    # PDF Processing & OCR Optimization
    PDF_OCR_MAX_PAGES: int = Field(default=50, description="Max pages to perform OCR on synchronously in one request")
    PDF_OCR_DPI: int = Field(default=150, description="DPI for OCR page rendering (150 DPI saves ~44% RAM vs 200 DPI)")
    PDF_OCR_MAX_DIMENSION: int = Field(default=2000, description="Max pixel width/height for rendered OCR pages")
    PDF_OCR_CONCURRENCY: int = Field(default=1, description="Concurrency limit for Gemini Vision OCR tasks (1 strictly for free tier rate safety)")
    GEMINI_OCR_DELAY_SECONDS: float = Field(default=4.2, description="Mandatory delay between consecutive Gemini Vision calls to stay strictly under 15 RPM")

    # Freemium daily limits (UTC day)
    FREE_DAILY_NOTES: int = Field(default=3)
    FREE_DAILY_FLASHCARDS: int = Field(default=3)
    FREE_DAILY_QUIZZES: int = Field(default=3)
    FREE_DAILY_CHAT: int = Field(default=20)
    FREE_DAILY_UPLOADS: int = Field(default=3)

    STUDENT_DAILY_NOTES: int = Field(default=40)
    STUDENT_DAILY_FLASHCARDS: int = Field(default=40)
    STUDENT_DAILY_QUIZZES: int = Field(default=40)
    STUDENT_DAILY_CHAT: int = Field(default=300)
    STUDENT_DAILY_UPLOADS: int = Field(default=30)

    # Student plan price in Philippine pesos (display + stub checkout)
    STUDENT_PRICE_PHP: int = Field(default=199)

    # Billing: stub upgrades plan immediately; paymongo reserved for later
    BILLING_MODE: str = Field(default="stub")  # stub | paymongo
    PAYMONGO_SECRET_KEY: str = Field(default="")
    PAYMONGO_WEBHOOK_SECRET: str = Field(default="")

    # Optional secret used to obfuscate stored BYOK Gemini keys at rest
    BYOK_ENCRYPTION_SECRET: str = Field(default="aral-local-byok-secret")

    @property
    def frontend_origin(self) -> str:
        url = (self.FRONTEND_URL or "").strip().rstrip("/")
        hosted = bool(os.getenv("RENDER") or os.getenv("RENDER_EXTERNAL_URL"))
        local = (not url) or ("localhost" in url) or ("127.0.0.1" in url)
        if hosted and local:
            return (self.PRODUCTION_FRONTEND_URL or "https://aral-ai-three.vercel.app").rstrip("/")
        return url or "http://localhost:3000"

    @property
    def cors_origins_list(self) -> List[str]:
        origins = [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]
        live = self.frontend_origin
        if live and live not in origins:
            origins.append(live)
        return origins

    @property
    def is_production(self) -> bool:
        return (self.ENVIRONMENT or "").strip().lower() == "production"

    @property
    def allow_anonymous_fallback(self) -> bool:
        """Whether requests without a token may resolve to the shared local
        single-user identity.

        This convenience fallback keeps local development and the test suite
        working without configured auth. It is unsafe for a multi-user
        deployment, so it is disabled in production or whenever real Supabase
        auth is configured.
        """
        return not self.is_production and not self.has_supabase_credentials

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
